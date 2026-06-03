import {
  auth as SpotifyAuth,
  remote as SpotifyRemote,
  ApiScope,
  ApiConfig,
} from "react-native-spotify-remote";
import { logDebug, logError } from "./debug";

const spotifyConfig: ApiConfig = {
  clientID: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID!,
  redirectURL: "sillage://spotify-auth",
  tokenRefreshURL: `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/spotify/refresh`,
  tokenSwapURL: `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/spotify/swap`,
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

export async function connectSpotify(): Promise<void> {
  if (connected) return;
  logDebug("connectSpotify: authorize…");
  const session = await SpotifyAuth.authorize(spotifyConfig);
  lastAccessToken = session.accessToken;
  logDebug(`authorize OK (token ${session.accessToken?.slice(0, 6)}…), connect…`);
  await SpotifyRemote.connect(session.accessToken);
  connected = true;
  logDebug("connect OK ✅");
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
    await SpotifyRemote.connect(lastAccessToken);
    connected = true;
    logDebug("reconnect OK ✅");
  } else {
    logDebug("⚠️ pas de token pour reconnect");
  }
}

export async function playTrack(spotifyUri: string): Promise<void> {
  await ensureConnected();
  logDebug(`playUri ${spotifyUri.slice(0, 28)}…`);
  await SpotifyRemote.playUri(spotifyUri);
  // On laisse Spotify basculer sur le morceau (~1,5 s) avant de lire l'état,
  // sinon on voit encore le morceau précédent. Vérifie que la lecture a
  // VRAIMENT démarré sur le bon titre (et pas sur un autre appareil).
  await new Promise((r) => setTimeout(r, 1500));
  try {
    const st: any = await SpotifyRemote.getPlayerState();
    logDebug(
      `state: "${st?.track?.name ?? "?"}" paused=${st?.isPaused} pos=${st?.playbackPosition}`,
    );
  } catch (e) {
    logError("getPlayerState", e);
  }
}

export async function pauseTrack(): Promise<void> {
  await SpotifyRemote.pause();
}

export async function resumeTrack(): Promise<void> {
  await ensureConnected();
  await SpotifyRemote.resume();
}

// Attend la fin du morceau, mais rend la main `leadMs` AVANT la fin réelle
// pour que la narration suivante démarre en chevauchant la toute fin du
// morceau (qui se fait ducker par iOS) au lieu de subir un blanc.
export async function waitForTrackEnd(
  durationMs: number,
  leadMs = 0,
): Promise<void> {
  const wait = Math.max(0, durationMs - leadMs);
  return new Promise((resolve) => setTimeout(resolve, wait));
}

export function disconnectSpotify(): void {
  SpotifyRemote.disconnect();
  connected = false;
}
