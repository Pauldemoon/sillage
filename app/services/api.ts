import axios from "axios";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:3000";

export interface EmissionTrack {
  id: string;
  title: string;
  artist: string;
  cover: string;
  spotifyUri: string;
  duration: number;
  editorialRole?: string;
  editorialReason?: string;
  sources: { label: string; url: string }[];
}

export interface BroadcastPlan {
  mode: "seed-first";
  startsWithTrackIndex: number;
  narrationStartsBeforeTrackIndex: number;
  preparationWindowMs: number;
  fallback: "short-hold" | "instrumental-bed";
  rules: string[];
}

export interface UserMemoryInput {
  knownArtists?: string[];
  likedArtists?: string[];
  dislikedArtists?: string[];
  savedTracks?: string[];
  skippedTracks?: string[];
  discoveryTolerance?: "low" | "medium" | "high";
}

export interface UserMemoryProfile extends Required<UserMemoryInput> {}

export interface MemoryPatch {
  heardArtists: string[];
  heardTracks: string[];
  discoveredArtists: string[];
}

export interface Emission {
  angle: string;
  description: string;
  broadcastPlan?: BroadcastPlan;
  editorialSummary?: string;
  memoryProfile?: UserMemoryProfile;
  memoryPatch?: MemoryPatch;
  tracks: EmissionTrack[];
  narrations: string[];
  audioUrls: string[];
}

export async function generateEmission(
  title: string,
  artist: string,
  memory?: UserMemoryInput,
): Promise<Emission> {
  const res = await axios.post(`${BACKEND}/api/generate`, {
    title,
    artist,
    memory,
  });
  return res.data;
}

export async function resolveSeedTrack(
  title: string,
  artist: string,
): Promise<EmissionTrack> {
  const res = await axios.post(`${BACKEND}/api/seed`, { title, artist });
  return res.data;
}
