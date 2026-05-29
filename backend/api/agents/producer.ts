import type { SpotifyTrack } from "../../lib/spotify";

export interface BroadcastPlan {
  mode: "seed-first";
  startsWithTrackIndex: number;
  narrationStartsBeforeTrackIndex: number;
  preparationWindowMs: number;
  fallback: "short-hold" | "instrumental-bed";
  rules: string[];
}

const MIN_PREPARATION_WINDOW_MS = 90000;

export function planBroadcast(tracks: SpotifyTrack[]): BroadcastPlan {
  const seedTrack = tracks[0];
  const preparationWindowMs = Math.max(
    seedTrack?.duration || 0,
    MIN_PREPARATION_WINDOW_MS,
  );

  return {
    mode: "seed-first",
    startsWithTrackIndex: 0,
    narrationStartsBeforeTrackIndex: tracks.length > 1 ? 1 : 0,
    preparationWindowMs,
    fallback: "short-hold",
    rules: [
      "Lancer le morceau de depart immediatement des qu'il est trouve sur Spotify.",
      "Preparer l'angle, la curation, les sources, les narrations et les voix pendant ce premier morceau.",
      "Ne pas interrompre le morceau de depart avec une longue introduction.",
      "Faire commencer l'emission editoriale avant le deuxieme morceau.",
      "Si la preparation depasse la duree du premier morceau, afficher une attente courte plutot que lancer un morceau non valide.",
    ],
  };
}
