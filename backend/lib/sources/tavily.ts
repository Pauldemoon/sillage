import axios from "axios";
import { SourcedFact } from "../research";

/**
 * Tavily — moteur de recherche pour IA.
 * Ramène le contenu éditorial des magazines musicaux
 * (Pitchfork, Rolling Stone, Les Inrocks, etc.) avec sources.
 * Clé gratuite sur https://tavily.com
 */

// Nettoie le markdown que renvoie `raw_content` : images, liens, boutons de
// partage, nav de page. On GARDE le texte des liens et on jette le reste —
// sinon le dossier se remplit de « Partager / Facebook / Twitter » et d'URLs,
// qui polluent le contexte des agents.
function stripBoilerplate(raw: string): string {
  return raw
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images ![alt](url)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // liens [texte](url) → texte
    .replace(/https?:\/\/\S+/g, "") // URLs nues restantes
    .replace(/[*_]+/g, "") // gras / italique markdown
    .replace(/^[ \t]*[#>+\-]+[ \t]*/gm, "") // puces / titres en début de ligne
    .replace(
      /^[ \t]*(commenter|partager|facebook|twitter|google\+?|share|tweet|pinterest|whatsapp|email|imprimer|newsletter|publicit[ée]|s'abonner|abonnez-vous|menu|accueil|connexion|s'inscrire)[ \t)\]]*$/gim,
      "",
    ) // lignes de pure navigation / partage
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function fetchTavily(
  title: string,
  artist: string,
  domains?: string[],
  // Requête de repli quand la première moisson est jugée hors-sujet par le
  // filtre de pertinence (cf. research.ts) — recentrée différemment.
  queryOverride?: string,
): Promise<SourcedFact[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];

  try {
    const res = await axios.post(
      "https://api.tavily.com/search",
      {
        api_key: key,
        query:
          queryOverride ||
          `"${title}" ${artist} signification analyse critique histoire`,
        search_depth: "advanced",
        max_results: 4,
        // On veut l'ARTICLE complet, pas la bribe. Sans ça, Tavily ne renvoie
        // qu'un extrait d'un paragraphe (`content`) : tout le corps d'une
        // interview-fleuve (Abcdr, Konbini…) passe à la trappe. `raw_content`
        // = le texte nettoyé de TOUTE la page. Mis en cache 60 j → payé 1 fois.
        include_raw_content: true,
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
      { timeout: 30000 },
    );

    const results = res.data?.results || [];
    return results
      .filter((r: any) => r.raw_content || r.content)
      .map((r: any) => ({
        content: stripBoilerplate(r.raw_content || r.content).slice(0, 4000),
        source: new URL(r.url).hostname.replace("www.", ""),
        url: r.url,
      }));
  } catch (e: any) {
    console.error("Tavily failed:", e.message);
    return [];
  }
}
