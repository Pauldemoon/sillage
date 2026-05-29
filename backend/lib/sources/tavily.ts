import axios from "axios";
import { SourcedFact } from "../research";

/**
 * Tavily — moteur de recherche pour IA.
 * Ramène le contenu éditorial des magazines musicaux
 * (Pitchfork, Rolling Stone, Les Inrocks, etc.) avec sources.
 * Clé gratuite sur https://tavily.com
 */
export async function fetchTavily(
  title: string,
  artist: string,
  domains?: string[],
): Promise<SourcedFact[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];

  try {
    const res = await axios.post(
      "https://api.tavily.com/search",
      {
        api_key: key,
        query: `"${title}" ${artist} signification analyse critique histoire`,
        search_depth: "advanced",
        max_results: 4,
        include_domains:
          domains && domains.length
            ? domains
            : [
                "pitchfork.com",
                "rollingstone.com",
                "lesinrocks.com",
                "nme.com",
                "stereogum.com",
                "consequence.net",
              ],
      },
      { timeout: 20000 },
    );

    const results = res.data?.results || [];
    return results
      .filter((r: any) => r.content)
      .map((r: any) => ({
        content: r.content.slice(0, 1200),
        source: new URL(r.url).hostname.replace("www.", ""),
        url: r.url,
      }));
  } catch (e: any) {
    console.error("Tavily failed:", e.message);
    return [];
  }
}
