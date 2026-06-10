import {
  auth as SpotifyAuth,
  remote as SpotifyRemote,
  ApiScope,
  ApiConfig,
} from "react-native-spotify-remote";
import { logDebug, logError } from "./debug";
import { BACKEND } from "./api";

const spotifyConfig: ApiConfig = {
  // Le clientID Spotify est une valeur publique (déjà dans eas.json) : on la
  // met en dur en filet, sinon un bundle sans env donnait un login cassé
  // (clientID undefined — vu sur le tout premier build).
  clientID:
    process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ||
    "1321be8fccd049babb9d281004b586ad",
  redirectURL: "sillage://spotify-auth",
  tokenRefreshURL: `${BACKEND}/api/spotify/refresh`,
  tokenSwapURL: `${BACKEND}/api/spotify/swap`,
  scopes: [
    ApiScope.AppRemoteControlScope,
    ApiScope.UserReadCurrentlyPlayingScope,
  ],
  // Wake the Spotify app on authorization so SPTAppRemote can attach.
  // Without this, a "cold" Spotify refuses the App Remote socket
  // ("Connection refused"). "" resumes the last playback to activate it.
  playURI: "",
};

let connected = false;
// On garde le dernier token pour pouvoir reconnecter l'App Remote sans
// relancer tout le flux OAuth : Spotify coupe la socket dès que la lecture
// s'arrête (fin de file), ce qui faisait échouer le morceau suivant
// ("player is not ready").
let lastAccessToken: string | null = null;

// L'App Remote refuse souvent la socket JUSTE après l'autorisation, le temps
// que l'app Spotify se réveille et accepte le transport ("Connection refused" /
// "ensure Spotify app is installed and try to reconnect"). Plutôt qu'échouer du
// premier coup, on retente quelques fois avec un court délai : l'autorisation a
// réveillé Spotify, il lui faut juste une ou deux secondes pour être prêt.
async function connectWithRetry(token: string, label: string): Promise<void> {
  const MAX = 5;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    try {
      await SpotifyRemote.connect(token);
      logDebug(`${label} OK ✅ (tentative ${attempt})`);
      return;
    } catch (e) {
      logError(`${label} tentative ${attempt}/${MAX}`, e);
      if (attempt === MAX) {
        throw new Error(
          "Spotify n'a pas répondu. Ouvre l'app Spotify, lance un morceau, puis réessaie (compte Premium requis).",
        );
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

export async function connectSpotify(): Promise<void> {
  if (connected) return;
  logDebug("connectSpotify: authorize…");
  const session = await SpotifyAuth.authorize(spotifyConfig);
  lastAccessToken = session.accessToken;
  logDebug(`authorize OK (token ${session.accessToken?.slice(0, 6)}…), connect…`);
  await connectWithRetry(session.accessToken, "connect");
  connected = true;
}

// Garantit une App Remote vivante avant toute commande de lecture. Si la
// socket est tombée (fin de morceau, app Spotify mise en veille...), on la
// rouvre avec le token déjà obtenu.
async function ensureConnected(): Promise<void> {
  let isConn = false;
  try {
    isConn = await SpotifyRemote.isConnectedAsync();
  } catch (e) {
    logError("isConnectedAsync", e);
  }
  logDebug(`ensureConnected: isConnected=${isConn}`);
  if (isConn) return;
  if (lastAccessToken) {
    logDebug("reconnect…");
    await connectWithRetry(lastAccessToken, "reconnect");
    connected = true;
  } else {
    logDebug("⚠️ pas de token pour reconnect");
  }
}

export async function playTrack(spotifyUri: string): Promise<void> {
  await ensureConnected();
  logDebug(`playUri ${spotifyUri.slice(0, 28)}…`);
  await SpotifyRemote.playUri(spotifyUri);

  // Spotify peut accepter la commande avant d'avoir réellement basculé de
  // morceau. On attend le bon URI, sinon l'enchaînement se cale sur l'ancien
  // titre et la suite part de travers.
  const started = await waitForExpectedTrack(spotifyUri);
  if (!started) {
    logDebug("⚠️ playUri non confirmé, nouvelle tentative…");
    await ensureConnected();
    await SpotifyRemote.playUri(spotifyUri);
    await waitForExpectedTrack(spotifyUri);
  }
}

export async function pauseTrack(): Promise<void> {
  await SpotifyRemote.pause();
}

export async function resumeTrack(): Promise<void> {
  await ensureConnected();
  await SpotifyRemote.resume();
}

function sameUri(a?: string, b?: string): boolean {
  return !!a && !!b && a.split("#")[0] === b.split("#")[0];
}

async function waitForExpectedTrack(spotifyUri: string): Promise<boolean> {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const st: any = await SpotifyRemote.getPlayerState();
      const uri = st?.track?.uri;
      logDebug(
        `state: "${st?.track?.name ?? "?"}" paused=${st?.isPaused} pos=${st?.playbackPosition}`,
      );
      if (sameUri(uri, spotifyUri) && !st?.isPaused) return true;
    } catch (e) {
      logError("getPlayerState", e);
      await ensureConnected();
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  return false;
}

// Attend la fin réelle du morceau depuis l'état Spotify, mais rend la main
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
    await new Promise((r) => setTimeout(r, 1000));
    try {
      await ensureConnected();
      const st: any = await SpotifyRemote.getPlayerState();
      const trackDuration = st?.track?.duration || durationMs;
      const position = Number(st?.playbackPosition || 0);
      const currentUri = st?.track?.uri;

      if (spotifyUri && currentUri && !sameUri(currentUri, spotifyUri)) {
        logDebug("track changed externally, on enchaîne");
        return;
      }

      if (!st?.isPaused) {
        stagnantTicks = position <= lastPosition + 250 ? stagnantTicks + 1 : 0;
        lastPosition = position;
      }

      const remaining = trackDuration - position;
      if (remaining <= leadMs + 750) {
        logDebug(`track end: remaining=${Math.max(0, remaining)}ms`);
        return;
      }

      // Si Spotify dit "pas en pause" mais que la position ne bouge plus, on
      // ne bloque pas l'émission indéfiniment.
      if (!st?.isPaused && stagnantTicks >= 8) {
        logDebug("⚠️ position figée, on enchaîne");
        return;
      }
    } catch (e) {
      logError("waitForTrackEnd", e);
    }
  }

  logDebug("⚠️ fin morceau: timeout fallback, on enchaîne");
}

export function disconnectSpotify(): void {
  SpotifyRemote.disconnect();
  connected = false;
}
