import { randomUUID } from "crypto";
import { getCache, cacheKey } from "./client";

// Layer 3 — cache des VOYAGES (flexible, plusieurs par seed).
// Contrairement à la matière (Layer 1), un voyage n'est PAS déterministe :
// pour une même graine on garde plusieurs voyages, taggés par archétype
// d'angle, et on applique une politique de diversité côté lecture pour ne
// jamais resservir à un utilisateur un voyage qu'il a déjà entendu.
//
// L'audio n'est volontairement PAS stocké ici : il vit déjà dans tts_cache
// (clé = voix + texte exact). À la relecture, on resynthétise depuis les
// textes de narration, ce qui tape tts_cache → quasi-instantané, 0 appel TTS.
// La ligne reste donc légère (~30 Ko de JSON au lieu de ~5 Mo d'audio).

const JOURNEY_TTL_DAYS = 120;

// Version du pipeline éditorial, embarquée dans la clé de graine. À
// incrémenter quand la qualité de narration change assez pour que les
// voyages déjà en cache ne soient plus représentatifs (ex. refonte du
// prompt, golden-set) : les anciennes lignes ne matchent plus et expirent
// d'elles-mêmes, sans toucher à la table.
// v2 (2026-06-10) : narration séquentielle + few-shot + relecture d'épisode.
// v3 (2026-06-10) : narration resserrée (130-160 mots, anti-radotage) + voix
//                   Gemini. Les voyages v2 (longs/circulaires) ne sont plus
//                   resservis et expirent seuls.
// v4 (2026-06-10) : narration recadrée en PONT (morceau fini → morceau qui
//                   arrive). Corrige l'off-by-one qui faisait amorcer le titre
//                   i+1 (deux crans plus loin) et "conclure" avant le dernier
//                   morceau — d'où le lien faible entre les titres.
// v5 (2026-06-10) : horloge d'épisode (lancement / lien court / loupe /
//                   sortie) — longueurs par rôle au lieu de 4 monologues
//                   uniformes de 130-160 mots ; sortie avec graine de
//                   prochain voyage.
// v6 (2026-06-10) : l'horloge TENUE — brief de rôle déplacé en fin de prompt
//                   (le modèle imitait la longueur des narrations précédentes)
//                   + compression de montage si dépassement >10%. Les voyages
//                   v5 (budgets explosés, sortie sans graine) expirent seuls.
// v7 (2026-06-10) : titres d'émission NOMINAUX (2-5 mots, ancrage concret) —
//                   fini les « Quand… / Le jour où… » dramatiques.
const PIPELINE_VERSION = "v7";

function seedKey(title: string, artist: string): string {
  return `${PIPELINE_VERSION}:${cacheKey(title, artist)}`;
}

function expiresAt(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export interface CachedJourney<T = unknown> {
  journeyId: string;
  archetype: string;
  artists: string[];
  payload: T;
}

// Tous les voyages encore valides pour une graine donnée.
export async function getJourneyCandidates<T = unknown>(
  title: string,
  artist: string,
): Promise<CachedJourney<T>[]> {
  const db = getCache();
  if (!db) return [];
  try {
    const { data } = await db
      .from("journey_cache")
      .select("journey_id, archetype, artists, payload, expires_at")
      .eq("seed_key", seedKey(title, artist))
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });

    if (!data) return [];
    return data.map((row) => ({
      journeyId: row.journey_id as string,
      archetype: row.archetype as string,
      artists: (row.artists as string[]) || [],
      payload: row.payload as T,
    }));
  } catch {
    return [];
  }
}

// Enregistre un nouveau voyage et renvoie son identifiant.
export async function saveJourney(
  title: string,
  artist: string,
  archetype: string,
  artists: string[],
  payload: unknown,
): Promise<string> {
  const journeyId = randomUUID();
  const db = getCache();
  if (!db) return journeyId;
  try {
    await db.from("journey_cache").insert({
      journey_id: journeyId,
      seed_key: seedKey(title, artist),
      archetype,
      artists,
      payload,
      expires_at: expiresAt(JOURNEY_TTL_DAYS),
    });
  } catch {
    // Le cache ne doit jamais bloquer la génération.
  }
  return journeyId;
}
