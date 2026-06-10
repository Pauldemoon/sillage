import axios from "axios";

// Adresse de production écrite EN DUR comme filet. Si le bundle qui tourne a
// été construit sans EXPO_PUBLIC_BACKEND_URL (vieux build, OTA publié sans
// env), l'app visait http://localhost:3000 → "Network Error" immédiat sur
// device. Avec ce filet, un bundle sans env vise quand même la prod ; le
// repli localhost ne subsiste qu'en dev (`expo start` sans .env).
const PROD_BACKEND = "https://sillage-production-cb36.up.railway.app";

export const BACKEND =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  (__DEV__ ? "http://localhost:3000" : PROD_BACKEND);

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
  // Voyages déjà entendus (Layer 3) : évite de resservir le même voyage.
  heardJourneys?: string[];
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
  // Identifiant du voyage (Layer 3) — à mémoriser dans heardJourneys.
  journeyId?: string;
  cached?: boolean;
  tracks: EmissionTrack[];
  narrations: string[];
  audioUrls: string[];
}

export async function generateEmission(
  title: string,
  artist: string,
  memory?: UserMemoryInput,
): Promise<Emission> {
  let res;
  try {
    res = await axios.post(
      `${BACKEND}/api/generate`,
      { title, artist, memory },
      // La génération NEUVE est désormais SÉQUENTIELLE (narrations qui se
      // lisent l'une l'autre + relecture d'épisode) : ~110-160 s, jusqu'à
      // ~200 s sur une graine lourde. On laisse 300 s pour ne jamais couper
      // alors que le serveur travaille encore (sinon axios abandonne et
      // l'app croit le backend "injoignable"). Le backend stream un espace
      // toutes les 10 s pour garder la connexion vivante pendant ce temps.
      // La génération tourne EN FOND pendant que le morceau de départ joue,
      // donc cette durée ne se voit pas (sauf graine très courte).
      { timeout: 300000 },
    );
  } catch (e: any) {
    // Pas de réponse du tout (DNS, connexion refusée, hôte injoignable) :
    // le "Network Error" générique d'axios ne dit pas QUI était visé.
    if (!e?.response) {
      throw new Error(`Backend injoignable (${BACKEND}) — ${e?.message}`);
    }
    throw e;
  }
  // Le backend stream un keep-alive pendant la génération (~100 s) pour ne pas
  // se faire couper par le timeout réseau iOS. Conséquence : le code HTTP est
  // figé à 200, donc une erreur arrive avec un champ `error` dans le corps.
  if (res.data?.error) {
    throw new Error(res.data.message || res.data.error);
  }
  return res.data;
}

export async function resolveSeedTrack(
  title: string,
  artist: string,
): Promise<EmissionTrack> {
  const res = await axios.post(`${BACKEND}/api/seed`, { title, artist });
  return res.data;
}

export interface TrackSuggestion {
  id: string;
  title: string;
  artist: string;
  cover: string;
  spotifyUri: string;
  duration: number;
}

export async function searchTracks(query: string): Promise<TrackSuggestion[]> {
  const res = await axios.get(`${BACKEND}/api/search`, {
    params: { q: query },
  });
  return res.data.tracks || [];
}
