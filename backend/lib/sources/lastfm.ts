import axios from "axios";
import { SourcedFact } from "../research";

/**
 * Last.fm — bio d'artiste, tags/genres, artistes similaires.
 * Clé gratuite sur https://www.last.fm/api
 */
export async function fetchLastFm(artist: string): Promise<SourcedFact | null> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return null;

  try {
    const q = encodeURIComponent(artist);
    const res = await axios.get(
      `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${q}&api_key=${key}&format=json&lang=fr`,
      { timeout: 10000 },
    );

    const a = res.data?.artist;
    if (!a) return null;

    const parts: string[] = [];
    const tags = a.tags?.tag?.map((t: any) => t.name).join(", ");
    if (tags) parts.push(`Tags : ${tags}`);

    const similar = a.similar?.artist?.map((s: any) => s.name).join(", ");
    if (similar) parts.push(`Artistes similaires : ${similar}`);

    const bio = (a.bio?.content || a.bio?.summary || "")
      .replace(/<[^>]*>/g, "")
      .replace(/User-contributed text.*$/s, "")
      .trim();
    if (bio) parts.push(bio.slice(0, 1500));

    if (parts.length === 0) return null;

    return {
      content: parts.join("\n\n"),
      source: "Last.fm",
      url: a.url || "https://www.last.fm",
    };
  } catch (e: any) {
    console.error("Last.fm failed:", e.message);
    return null;
  }
}
