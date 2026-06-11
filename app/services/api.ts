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

// La génération neuve dure ~110-160 s (narrations séquentielles + relecture
// d'épisode). Impossible de la tenir en UNE requête : iOS coupe DUR toute
// requête HTTP à 60 s (limite native NSURLSession, non contournable côté JS).
// On passe donc en ASYNCHRONE : on démarre un job (requête courte), puis on
// interroge le résultat toutes les 3 s (requêtes courtes) → jamais le mur des
// 60 s. Tout ça tourne en fond pendant que le morceau de départ joue.
const POLL_INTERVAL_MS = 3000;
// 7-8 titres = ~7 narrations séquentielles : une génération neuve peut
// prendre 4-5 min. Le morceau de départ couvre l'essentiel de l'attente.
const GENERATION_DEADLINE_MS = 7 * 60 * 1000;

export interface Teaser {
  text: string;
  audioUrl: string;
}

export async function generateEmission(
  title: string,
  artist: string,
  memory?: UserMemoryInput,
  // Appelé UNE fois si le backend publie la promesse de Charlie pendant que
  // la génération tourne — l'app la joue par-dessus le morceau de départ.
  onTeaser?: (teaser: Teaser) => void,
): Promise<Emission> {
  // 1) Démarrer le job — requête courte, renvoie un jobId immédiatement.
  let start;
  try {
    start = await axios.post(
      `${BACKEND}/api/generate`,
      { title, artist, memory },
      { timeout: 20000 },
    );
  } catch (e: any) {
    if (!e?.response) {
      throw new Error(`Backend injoignable (${BACKEND}) — ${e?.message}`);
    }
    throw e;
  }
  // Compat : si un ancien backend renvoie directement l'émission, on la prend.
  if (start.data?.tracks) return start.data;
  if (start.data?.error) throw new Error(start.data.message || start.data.error);
  const jobId = start.data?.jobId;
  if (!jobId) throw new Error("Démarrage de la génération impossible");

  // 2) Poller le résultat — chaque requête est courte, donc jamais coupée.
  const deadline = Date.now() + GENERATION_DEADLINE_MS;
  let teaserDelivered = false;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    let poll;
    try {
      poll = await axios.post(
        `${BACKEND}/api/generate`,
        { jobId },
        { timeout: 20000 },
      );
    } catch (e: any) {
      // Hoquet réseau ponctuel sur un poll : on retente au prochain tick.
      if (!e?.response) continue;
      throw e;
    }
    const data = poll.data;
    if (data?.status === "done") return data.emission as Emission;
    if (data?.status === "error") {
      throw new Error(data.message || "Génération échouée");
    }
    // status "pending" → on continue d'attendre. Le teaser arrive en
    // résultat partiel, une seule fois.
    if (!teaserDelivered && onTeaser && data?.teaser?.audioUrl) {
      teaserDelivered = true;
      try {
        onTeaser(data.teaser as Teaser);
      } catch {}
    }
  }
  throw new Error("La génération a pris trop de temps (5 min)");
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
