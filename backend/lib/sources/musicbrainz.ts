import axios from "axios";
import { SourcedFact } from "../research";

const UA = "Sillage/1.0 (https://sillage.app)";

/**
 * MusicBrainz — base de données musicale ouverte.
 * Dates, pays d'origine, type de groupe, relations.
 */
export async function fetchMusicBrainz(
  artist: string,
): Promise<SourcedFact | null> {
  try {
    const q = encodeURIComponent(artist);
    const search = await axios.get(
      `https://musicbrainz.org/ws/2/artist?query=${q}&fmt=json&limit=1`,
      { headers: { "User-Agent": UA }, timeout: 10000 },
    );

    const a = search.data?.artists?.[0];
    if (!a) return null;

    const parts: string[] = [];
    if (a.name) parts.push(`Nom : ${a.name}`);
    if (a.type) parts.push(`Type : ${a.type}`);
    if (a.country) parts.push(`Pays : ${a.country}`);
    if (a["life-span"]?.begin) parts.push(`Début : ${a["life-span"].begin}`);
    if (a["life-span"]?.end) parts.push(`Fin : ${a["life-span"].end}`);
    if (a.disambiguation) parts.push(`Précision : ${a.disambiguation}`);
    if (a.tags?.length)
      parts.push(
        `Genres : ${a.tags
          .slice(0, 5)
          .map((t: any) => t.name)
          .join(", ")}`,
      );

    if (parts.length === 0) return null;

    return {
      content: parts.join("\n"),
      source: "MusicBrainz",
      url: `https://musicbrainz.org/artist/${a.id}`,
    };
  } catch (e: any) {
    console.error("MusicBrainz failed:", e.message);
    return null;
  }
}
