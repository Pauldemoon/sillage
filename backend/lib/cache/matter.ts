import { createHash } from "crypto";
import { getCache, cacheKey } from "./client";

// Durées de vie : la matière musicale (faits, crédits, discographie) est
// stable. On rafraîchit malgré tout périodiquement pour capter nouveautés.
const RESEARCH_TTL_DAYS = 60;
const TRACK_TTL_DAYS = 90;

function expiresAt(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

// --- Recherche / dossiers (déterministe, mutualisé) ---

export async function getCachedResearch<T>(
  title: string,
  artist: string,
): Promise<T | null> {
  const db = getCache();
  if (!db) return null;
  try {
    const { data } = await db
      .from("research_cache")
      .select("payload, expires_at")
      .eq("cache_key", cacheKey(title, artist))
      .maybeSingle();
    if (!data) return null;
    if (new Date(data.expires_at).getTime() < Date.now()) return null;
    return data.payload as T;
  } catch {
    return null;
  }
}

export async function setCachedResearch(
  title: string,
  artist: string,
  payload: unknown,
): Promise<void> {
  const db = getCache();
  if (!db) return;
  try {
    await db.from("research_cache").upsert({
      cache_key: cacheKey(title, artist),
      title,
      artist,
      payload,
      expires_at: expiresAt(RESEARCH_TTL_DAYS),
    });
  } catch {
    // Le cache ne doit jamais bloquer la génération.
  }
}

// --- Résolution Spotify ---

export async function getCachedTrack<T>(
  title: string,
  artist: string,
): Promise<T | null> {
  const db = getCache();
  if (!db) return null;
  try {
    const { data } = await db
      .from("track_resolution")
      .select("payload, expires_at")
      .eq("cache_key", cacheKey(title, artist))
      .maybeSingle();
    if (!data) return null;
    if (new Date(data.expires_at).getTime() < Date.now()) return null;
    return data.payload as T;
  } catch {
    return null;
  }
}

export async function setCachedTrack(
  title: string,
  artist: string,
  payload: unknown,
): Promise<void> {
  const db = getCache();
  if (!db) return;
  try {
    await db.from("track_resolution").upsert({
      cache_key: cacheKey(title, artist),
      title,
      artist,
      payload,
      expires_at: expiresAt(TRACK_TTL_DAYS),
    });
  } catch {
    // no-op
  }
}

// --- Audio TTS (clé = hash voix + texte exact) ---

function ttsHash(voice: string, text: string): string {
  return createHash("sha256").update(`${voice}\n${text}`).digest("hex");
}

export async function getCachedTts(
  voice: string,
  text: string,
): Promise<Buffer | null> {
  const db = getCache();
  if (!db) return null;
  try {
    const { data } = await db
      .from("tts_cache")
      .select("audio")
      .eq("text_hash", ttsHash(voice, text))
      .maybeSingle();
    if (!data?.audio) return null;
    return Buffer.from(data.audio as string, "base64");
  } catch {
    return null;
  }
}

export async function setCachedTts(
  voice: string,
  text: string,
  audio: Buffer,
): Promise<void> {
  const db = getCache();
  if (!db) return;
  try {
    await db.from("tts_cache").upsert({
      text_hash: ttsHash(voice, text),
      voice,
      audio: audio.toString("base64"),
    });
  } catch {
    // no-op
  }
}
