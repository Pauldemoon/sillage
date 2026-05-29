import {
  auth as SpotifyAuth,
  remote as SpotifyRemote,
  ApiScope,
  ApiConfig,
} from "react-native-spotify-remote";

const spotifyConfig: ApiConfig = {
  clientID: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID!,
  redirectURL: "sillage://spotify-auth",
  tokenRefreshURL: `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/spotify/refresh`,
  tokenSwapURL: `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/spotify/swap`,
  scopes: [
    ApiScope.AppRemoteControlScope,
    ApiScope.UserReadCurrentlyPlayingScope,
  ],
};

let connected = false;

export async function connectSpotify(): Promise<void> {
  if (connected) return;
  const session = await SpotifyAuth.authorize(spotifyConfig);
  await SpotifyRemote.connect(session.accessToken);
  connected = true;
}

export async function playTrack(spotifyUri: string): Promise<void> {
  await SpotifyRemote.playUri(spotifyUri);
}

export async function pauseTrack(): Promise<void> {
  await SpotifyRemote.pause();
}

export async function resumeTrack(): Promise<void> {
  await SpotifyRemote.resume();
}

export async function waitForTrackEnd(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

export function disconnectSpotify(): void {
  SpotifyRemote.disconnect();
  connected = false;
}
