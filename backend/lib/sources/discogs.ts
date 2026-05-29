import axios from "axios";
import { SourcedFact } from "../research";

const UA = "Sillage/1.0 (https://sillage.app)";

/**
 * Discogs — base de données discographique, tous genres.
 * Très profonde sur les CRÉDITS (qui a écrit, produit, joué quoi),
 * les labels, années, genres/styles. Comble les trous d'attribution.
 * Token gratuit : https://www.discogs.com/settings/developers
 */
export async function fetchDiscogs(
  title: string,
  artist: string,
): Promise<SourcedFact | null> {
  const token = process.env.DISCOGS_TOKEN;
  if (!token) return null;

  try {
    // 1. Cherche une sortie (release) correspondant au morceau
    const search = await axios.get("https://api.discogs.com/database/search", {
      params: {
        q: `${artist} ${title}`,
        type: "release",
        per_page: 1,
        token,
      },
      headers: { "User-Agent": UA },
      timeout: 10000,
    });

    const hit = search.data?.results?.[0];
    if (!hit?.resource_url) return null;

    // 2. Récupère le détail de la sortie (crédits inclus)
    const rel = await axios.get(hit.resource_url, {
      params: { token },
      headers: { "User-Agent": UA },
      timeout: 10000,
    });
    const r = rel.data;
    if (!r) return null;

    const parts: string[] = [];
    if (r.title) parts.push(`Sortie : ${r.title}`);
    if (r.year) parts.push(`Année : ${r.year}`);
    if (r.labels?.length)
      parts.push(`Label : ${r.labels.map((l: any) => l.name).join(", ")}`);
    if (r.genres?.length) parts.push(`Genres : ${r.genres.join(", ")}`);
    if (r.styles?.length) parts.push(`Styles : ${r.styles.join(", ")}`);

    // Crédits : rôles clés (écriture, production, instruments)
    const credits = (r.extraartists || [])
      .filter((a: any) => a.role && a.name)
      .slice(0, 12)
      .map((a: any) => `${a.role} : ${a.name}`);
    if (credits.length) parts.push(`Crédits :\n${credits.join("\n")}`);

    if (parts.length === 0) return null;

    return {
      content: parts.join("\n"),
      source: "Discogs",
      url: r.uri || `https://www.discogs.com/release/${r.id}`,
    };
  } catch (e: any) {
    console.error("Discogs failed:", e.message);
    return null;
  }
}
