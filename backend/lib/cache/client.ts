import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Client Supabase côté serveur (service_role : bypass RLS).
// Dégradation gracieuse : si les variables d'env ne sont pas configurées,
// on renvoie null et tout le système de cache devient un no-op silencieux —
// le pipeline continue de fonctionner en recalculant tout normalement.
let cached: SupabaseClient | null | undefined;

export function getCache(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  cached =
    url && key
      ? createClient(url, key, { auth: { persistSession: false } })
      : null;

  return cached;
}

export function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cacheKey(title: string, artist: string): string {
  return `${normalizeKey(title)}|${normalizeKey(artist)}`;
}
