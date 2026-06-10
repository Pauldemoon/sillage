import axios from "axios";
import {
  auth as SpotifyAuth,
  remote as SpotifyRemote,
  ApiScope,
  ApiConfig,
} from "react-native-spotify-remote";
import { logDebug, logError } from "./debug";
import { BACKEND } from "./api";

const SPOTIFY_API = "https://api.spotify.com/v1";

const spotifyConfig: ApiConfig = {
  // Le clientID Spotify est une valeur publique (déjà dans eas.json) : on la
  // met en dur en filet, sinon un bundle sans env donnait un login cassé.
  clientID:
    process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ||
    "1321be8fccd049babb9d281004b586ad",
  redirectURL: "sillage://spotify-auth",
  tokenRefreshURL: `${BACKEND}/api/spotify/refresh`,
  tokenSwapURL: `${BACKEND}/api/spotify/swap`,
  scopes: [
    ApiScope.AppRemoteControlScope,
    ApiScope.UserReadCurrentlyPlayingScope,
    ApiScope.UserReadPlaybackStateScope,
    ApiScope.UserModifyPlaybackStateScope,
  ],
  // Réveille Spotify pendant l'autorisation. Après ça, le pilotage de
  // l'émission passe par la Web API, plus par la socket App Remote.
  playURI: "",
};

let accessToken: string | null = null;
let remoteWakeInFlight: Promise<void> | null = null;

interface WebPlaybackState {
  is_playing?: boolean;
  progress_ms?: number;
  item?: {
    uri?: string;
    name?: string;
    duration_ms?: number;
  } | null;
  device?: {
    id?: string | null;
    is_active?: boolean;
    is_restricted?: boolean;
    name?: string;
    type?: string;
  } | null;
}

function sameUri(a?: string, b?: string): boolean {
  return !!a && !!b && a.split("#")[0] === b.split("#")[0];
}

function statusOf(e: unknown): number | undefined {
  return axios.isAxiosError(e) ? e.response?.status : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function authorize(label: string): Promise<string> {
  logDebug(`${label}: Spotify authorize…`);
  const session = await SpotifyAuth.authorize(spotifyConfig);
  accessToken = session.accessToken;
  logDebug(`authorize OK (token ${session.accessToken?.slice(0, 6)}…)`);
  return accessToken;
}

async function token(label = "spotify"): Promise<string> {
  if (accessToken) return accessToken;
  return authorize(label);
}

async function wakeSpotifyApp(label: string): Promise<void> {
  if (remoteWakeInFlight) return remoteWakeInFlight;
  remoteWakeInFlight = (async () => {
    const t = await token(label);
    try {
      logDebug(`${label}: wake Remote…`);
      await SpotifyRemote.connect(t);
      logDebug(`${label}: Remote wake OK`);
    } catch (e) {
      // Ce n'est plus le moteur de lecture : un échec Remote ne bloque pas
      // l'émission si Spotify Connect est disponible côté Web API.
      logError(`${label}: Remote wake ignored`, e);
    }
  })().finally(() => {
    remoteWakeInFlight = null;
  });
  return remoteWakeInFlight;
}

async function spotifyRequest<T>(
  label: string,
  run: (t: string) => Promise<T>,
): Promise<T> {
  try {
    return await run(await token(label));
  } catch (e) {
    if (statusOf(e) !== 401) throw e;
    logDebug(`${label}: token expiré, réautorisation…`);
    accessToken = null;
    return run(await authorize(label));
  }
}

async function getPlaybackState(): Promise<WebPlaybackState | null> {
  return spotifyRequest("web state", async (t) => {
    const res = await axios.get(`${SPOTIFY_API}/me/player`, {
      headers: { Authorization: `Bearer ${t}` },
      validateStatus: (status) => status === 200 || status === 204,
      timeout: 10000,
    });
    return res.status === 204 ? null : (res.data as WebPlaybackState);
  });
}

async function getActiveDeviceId(): Promise<string | undefined> {
  const state = await getPlaybackState().catch(() => null);
  if (state?.device?.id && !state.device.is_restricted) {
    logDebug(
      `device: ${state.device.name || "?"} (${state.device.type || "?"})`,
    );
    return state.device.id;
  }

  return spotifyRequest("web devices", async (t) => {
    const res = await axios.get(`${SPOTIFY_API}/me/player/devices`, {
      headers: { Authorization: `Bearer ${t}` },
      timeout: 10000,
    });
    const devices = (res.data?.devices || []) as Array<{
      id?: string;
      is_active?: boolean;
      is_restricted?: boolean;
      name?: string;
      type?: string;
    }>;
    const device =
      devices.find((d) => d.is_active && !d.is_restricted) ||
      devices.find((d) => !d.is_restricted);
    if (device?.id) {
      logDebug(`device: ${device.name || "?"} (${device.type || "?"})`);
    } else {
      logDebug("⚠️ aucun device Spotify Connect disponible");
    }
    return device?.id;
  });
}

async function webPlay(spotifyUri: string): Promise<void> {
  const deviceId = await getActiveDeviceId();
  await spotifyRequest("web play", async (t) => {
    await axios.put(
      `${SPOTIFY_API}/me/player/play`,
      { uris: [spotifyUri], position_ms: 0 },
      {
        headers: { Authorization: `Bearer ${t}` },
        params: deviceId ? { device_id: deviceId } : undefined,
        timeout: 10000,
      },
    );
  });
}

export async function connectSpotify(): Promise<void> {
  await authorize("connectSpotify");
  await wakeSpotifyApp("connectSpotify");
}

export async function playTrack(spotifyUri: string): Promise<void> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      logDebug(`web play ${spotifyUri.slice(0, 28)}… tentative ${attempt}`);
      await webPlay(spotifyUri);
      if (await waitForExpectedTrack(spotifyUri)) return;
      lastError = new Error("Spotify Web API n'a pas confirmé le morceau");
      logDebug("⚠️ web play non confirmé");
    } catch (e) {
      lastError = e;
      logError(`web play tentative ${attempt}`, e);
      const status = statusOf(e);
      if (status === 401) accessToken = null;
    }

    // Si aucun device actif n'a pris la commande, on réveille Spotify puis on
    // retente en HTTP. La socket Remote ne sert pas à enchaîner les titres.
    await wakeSpotifyApp(`web play retry ${attempt}`);
    if (attempt === 2) accessToken = null;
    await sleep(1200);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Lecture Spotify impossible");
}

export async function pauseTrack(): Promise<void> {
  await spotifyRequest("web pause", async (t) => {
    await axios.put(
      `${SPOTIFY_API}/me/player/pause`,
      {},
      { headers: { Authorization: `Bearer ${t}` }, timeout: 10000 },
    );
  });
}

export async function resumeTrack(): Promise<void> {
  await spotifyRequest("web resume", async (t) => {
    await axios.put(
      `${SPOTIFY_API}/me/player/play`,
      {},
      { headers: { Authorization: `Bearer ${t}` }, timeout: 10000 },
    );
  });
}

async function waitForExpectedTrack(spotifyUri: string): Promise<boolean> {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const st = await getPlaybackState();
      const uri = st?.item?.uri;
      logDebug(
        `web state: "${st?.item?.name ?? "?"}" playing=${st?.is_playing} pos=${st?.progress_ms}`,
      );
      if (sameUri(uri, spotifyUri) && st?.is_playing) return true;
    } catch (e) {
      logError("web state", e);
    }
    await sleep(900);
  }
  return false;
}

// Attend la fin réelle du morceau depuis Spotify Connect, mais rend la main
// `leadMs` AVANT la fin pour lancer la narration suivante sans blanc.
export async function waitForTrackEnd(
  durationMs: number,
  spotifyUri?: string,
  leadMs = 0,
): Promise<void> {
  const fallbackDeadline = Date.now() + Math.max(10000, durationMs + 30000);
  let lastPosition = 0;
  let stagnantTicks = 0;

  while (Date.now() < fallbackDeadline) {
    await sleep(1200);
    try {
      const st = await getPlaybackState();
      const trackDuration = st?.item?.duration_ms || durationMs;
      const position = Number(st?.progress_ms || 0);
      const currentUri = st?.item?.uri;

      if (spotifyUri && currentUri && !sameUri(currentUri, spotifyUri)) {
        logDebug("track changed externally, on enchaîne");
        return;
      }

      if (st?.is_playing) {
        stagnantTicks = position <= lastPosition + 250 ? stagnantTicks + 1 : 0;
        lastPosition = position;
      }

      const remaining = trackDuration - position;
      if (remaining <= leadMs + 900) {
        logDebug(`track end: remaining=${Math.max(0, remaining)}ms`);
        return;
      }

      if (st?.is_playing && stagnantTicks >= 8) {
        logDebug("⚠️ position figée, on enchaîne");
        return;
      }
    } catch (e) {
      logError("waitForTrackEnd web", e);
      if (statusOf(e) === 401) accessToken = null;
    }
  }

  logDebug("⚠️ fin morceau: timeout fallback, on enchaîne");
}

export function disconnectSpotify(): void {
  SpotifyRemote.disconnect();
}
