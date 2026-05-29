import axios from "axios";
import { SourcedFact } from "../research";

/**
 * Genius — contexte des morceaux, descriptions éditoriales.
 * Token gratuit sur https://genius.com/api-clients
 */
export async function fetchGenius(
  title: string,
  artist: string,
): Promise<SourcedFact | null> {
  const token = process.env.GENIUS_ACCESS_TOKEN;
  if (!token) return null;

  try {
    // Recherche du morceau
    const q = encodeURIComponent(`${title} ${artist}`);
    const search = await axios.get(`https://api.genius.com/search?q=${q}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });

    const hit = search.data?.response?.hits?.[0]?.result;
    if (!hit) return null;

    // Détails du morceau (description éditoriale)
    const details = await axios.get(
      `https://api.genius.com/songs/${hit.id}?text_format=plain`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      },
    );

    const song = details.data?.response?.song;
    if (!song) return null;

    const parts: string[] = [];
    if (song.release_date_for_display)
      parts.push(`Sortie : ${song.release_date_for_display}`);
    if (song.album?.name) parts.push(`Album : ${song.album.name}`);

    const desc = song.description?.plain;
    if (desc && desc !== "?" && desc.length > 10)
      parts.push(desc.slice(0, 1500));

    if (parts.length === 0) return null;

    return {
      content: parts.join("\n"),
      source: "Genius",
      url: song.url || "https://genius.com",
    };
  } catch (e: any) {
    console.error("Genius failed:", e.message);
    return null;
  }
}
