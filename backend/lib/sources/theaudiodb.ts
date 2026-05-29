import axios from "axios";
import { SourcedFact } from "../research";

/**
 * TheAudioDB — bios d'artistes en plusieurs langues.
 * Clé de test publique "2" (gratuite, limitée mais suffisante).
 */
export async function fetchTheAudioDB(
  artist: string,
): Promise<SourcedFact | null> {
  try {
    const q = encodeURIComponent(artist);
    const res = await axios.get(
      `https://www.theaudiodb.com/api/v1/json/2/search.php?s=${q}`,
      { timeout: 10000 },
    );

    const a = res.data?.artists?.[0];
    if (!a) return null;

    // Préférer la bio française, sinon anglaise
    const bio = a.strBiographyFR || a.strBiographyEN || a.strBiographyDE || "";
    if (!bio) return null;

    const meta: string[] = [];
    if (a.intFormedYear) meta.push(`Formé en ${a.intFormedYear}`);
    if (a.strCountry) meta.push(`Origine : ${a.strCountry}`);
    if (a.strGenre) meta.push(`Genre : ${a.strGenre}`);
    if (a.strStyle) meta.push(`Style : ${a.strStyle}`);

    const content =
      (meta.length ? meta.join(" · ") + "\n\n" : "") + bio.slice(0, 2000);

    return {
      content,
      source: "TheAudioDB",
      url: a.strWebsite
        ? `https://${a.strWebsite}`
        : "https://www.theaudiodb.com",
    };
  } catch (e: any) {
    console.error("TheAudioDB failed:", e.message);
    return null;
  }
}
