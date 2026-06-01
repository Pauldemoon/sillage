import axios from "axios";
import { getCachedTrack, setCachedTrack } from "./cache/matter";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;

let tokenCache: { token: string; expires: number } | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expires) {
    return tokenCache.token;
  }

  const res = await axios.post(
    "https://accounts.spotify.com/api/token",
    "grant_type=client_credentials",
    {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  tokenCache = {
    token: res.data.access_token,
    expires: Date.now() + res.data.expires_in * 1000 - 60000,
  };

  return tokenCache.token;
}

export interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  spotifyUri: string;
  duration: number;
  previewUrl: string | null;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesArtist(actual: string, expected: string): boolean {
  const a = normalize(actual);
  const e = normalize(expected);
  return a === e || a.includes(e) || e.includes(a);
}

function matchesTitle(actual: string, expected: string): boolean {
  const a = normalize(actual);
  const e = normalize(expected);
  return a === e || a.startsWith(`${e} `) || a.includes(` ${e} `);
}

function isLikelyMatch(
  track: SpotifyTrack,
  title: string,
  artist: string,
): boolean {
  return (
    matchesArtist(track.artist, artist) && matchesTitle(track.title, title)
  );
}

export async function searchTrack(
  title: string,
  artist: string,
): Promise<SpotifyTrack | null> {
  const token = await getToken();
  const query = encodeURIComponent(`track:${title} artist:${artist}`);
  const res = await axios.get(
    `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  const item = res.data.tracks?.items?.[0];
  if (!item) return null;

  return {
    id: item.id,
    title: item.name,
    artist: item.artists[0].name,
    album: item.album.name,
    cover: item.album.images[0]?.url || "",
    spotifyUri: item.uri,
    duration: item.duration_ms,
    previewUrl: item.preview_url,
  };
}

export async function findBestTrackMatch(
  title: string,
  artist: string,
): Promise<SpotifyTrack | null> {
  // Couche 1 : résolution Spotify mise en cache (stable, mutualisée).
  const hit = await getCachedTrack<SpotifyTrack>(title, artist);
  if (hit) return hit;

  const exact = await searchTrack(title, artist);
  if (exact && isLikelyMatch(exact, title, artist)) {
    await setCachedTrack(title, artist, exact);
    return exact;
  }

  const results = await searchTracks(`${title} ${artist}`);
  const match =
    results.find((track) => isLikelyMatch(track, title, artist)) || null;
  if (match) await setCachedTrack(title, artist, match);
  return match;
}

export async function searchTracks(
  query: string,
  limit = 5,
): Promise<SpotifyTrack[]> {
  const token = await getToken();
  const encoded = encodeURIComponent(query);
  const res = await axios.get(
    `https://api.spotify.com/v1/search?q=${encoded}&type=track&limit=${limit}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  return (res.data.tracks?.items || []).map((item: any) => ({
    id: item.id,
    title: item.name,
    artist: item.artists[0].name,
    album: item.album.name,
    cover: item.album.images[0]?.url || "",
    spotifyUri: item.uri,
    duration: item.duration_ms,
    previewUrl: item.preview_url,
  }));
}
