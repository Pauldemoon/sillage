import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MemoryPatch, UserMemoryInput } from "./api";

const KEY = "sillage:memory:v1";

// Garde-fou : on borne la mémoire pour éviter une croissance infinie
// qui finirait par gonfler le prompt envoyé au backend.
const MAX_ARTISTS = 200;
const MAX_TRACKS = 300;
const MAX_JOURNEYS = 500;

const EMPTY: UserMemoryInput = {
  knownArtists: [],
  likedArtists: [],
  dislikedArtists: [],
  savedTracks: [],
  skippedTracks: [],
  discoveryTolerance: "medium",
  heardJourneys: [],
};

function uniq(values: string[] = []): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

// On garde les entrées les plus récentes en fin de liste.
function cap(values: string[], max: number): string[] {
  return values.length > max ? values.slice(values.length - max) : values;
}

export async function loadMemory(): Promise<UserMemoryInput> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as UserMemoryInput;
    return { ...EMPTY, ...parsed };
  } catch {
    return { ...EMPTY };
  }
}

async function saveMemory(memory: UserMemoryInput): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // En cas d'échec de persistance on n'interrompt pas l'écoute.
  }
}

// Fusionne le patch renvoyé par le backend après une émission.
// Les artistes entendus / découverts deviennent "connus" pour que
// la prochaine émission pousse la découverte au lieu de se répéter.
export async function mergeMemoryPatch(
  patch: MemoryPatch | undefined,
): Promise<UserMemoryInput> {
  const current = await loadMemory();
  if (!patch) return current;

  const next: UserMemoryInput = {
    ...current,
    knownArtists: cap(
      uniq([
        ...(current.knownArtists || []),
        ...(patch.heardArtists || []),
        ...(patch.discoveredArtists || []),
      ]),
      MAX_ARTISTS,
    ),
    savedTracks: cap(
      uniq([...(current.savedTracks || []), ...(patch.heardTracks || [])]),
      MAX_TRACKS,
    ),
  };

  await saveMemory(next);
  return next;
}

// Mémorise un voyage entendu (Layer 3) pour ne plus le resservir.
// Appelé après chaque émission avec le journeyId renvoyé par le backend.
export async function rememberJourney(
  journeyId: string | undefined,
): Promise<void> {
  if (!journeyId) return;
  const current = await loadMemory();
  await saveMemory({
    ...current,
    heardJourneys: cap(
      uniq([...(current.heardJourneys || []), journeyId]),
      MAX_JOURNEYS,
    ),
  });
}

// Signaux utilisateur explicites (pour une future UI like/dislike).
export async function likeArtist(artist: string): Promise<void> {
  const current = await loadMemory();
  await saveMemory({
    ...current,
    likedArtists: cap(
      uniq([...(current.likedArtists || []), artist]),
      MAX_ARTISTS,
    ),
  });
}

export async function dislikeArtist(artist: string): Promise<void> {
  const current = await loadMemory();
  await saveMemory({
    ...current,
    dislikedArtists: cap(
      uniq([...(current.dislikedArtists || []), artist]),
      MAX_ARTISTS,
    ),
  });
}

export async function setDiscoveryTolerance(
  tolerance: "low" | "medium" | "high",
): Promise<void> {
  const current = await loadMemory();
  await saveMemory({ ...current, discoveryTolerance: tolerance });
}

export async function resetMemory(): Promise<void> {
  await saveMemory({ ...EMPTY });
}
