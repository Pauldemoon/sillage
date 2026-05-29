export interface UserMemoryInput {
  knownArtists?: string[];
  likedArtists?: string[];
  dislikedArtists?: string[];
  savedTracks?: string[];
  skippedTracks?: string[];
  discoveryTolerance?: "low" | "medium" | "high";
}

export interface UserMemoryProfile {
  knownArtists: string[];
  likedArtists: string[];
  dislikedArtists: string[];
  savedTracks: string[];
  skippedTracks: string[];
  discoveryTolerance: "low" | "medium" | "high";
}

export interface MemoryPatch {
  heardArtists: string[];
  heardTracks: string[];
  discoveredArtists: string[];
}

function uniq(values: string[] = []) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function buildMemoryProfile(
  memory?: UserMemoryInput,
): UserMemoryProfile {
  return {
    knownArtists: uniq(memory?.knownArtists),
    likedArtists: uniq(memory?.likedArtists),
    dislikedArtists: uniq(memory?.dislikedArtists),
    savedTracks: uniq(memory?.savedTracks),
    skippedTracks: uniq(memory?.skippedTracks),
    discoveryTolerance: memory?.discoveryTolerance || "medium",
  };
}

export function formatMemoryForPrompt(memory: UserMemoryProfile): string {
  const lines = [
    `Tolerance a la decouverte : ${memory.discoveryTolerance}`,
    memory.knownArtists.length
      ? `Artistes deja connus : ${memory.knownArtists.join(", ")}`
      : "",
    memory.likedArtists.length
      ? `Artistes deja aimes : ${memory.likedArtists.join(", ")}`
      : "",
    memory.dislikedArtists.length
      ? `Artistes a eviter : ${memory.dislikedArtists.join(", ")}`
      : "",
    memory.savedTracks.length
      ? `Morceaux sauvegardes : ${memory.savedTracks.join(", ")}`
      : "",
    memory.skippedTracks.length
      ? `Morceaux souvent passes : ${memory.skippedTracks.join(", ")}`
      : "",
  ].filter(Boolean);

  return lines.join("\n");
}

export function buildMemoryPatch(
  tracks: { title: string; artist: string }[],
  seedArtist: string,
): MemoryPatch {
  return {
    heardArtists: uniq(tracks.map((track) => track.artist)),
    heardTracks: uniq(
      tracks.map((track) => `${track.title} — ${track.artist}`),
    ),
    discoveredArtists: uniq(
      tracks
        .slice(1)
        .map((track) => track.artist)
        .filter((artist) => artist !== seedArtist),
    ),
  };
}
