// Banc de comparaison Tavily vs Firecrawl sur la recherche presse de Sillage.
// Usage : FIRECRAWL_API_KEY=fc-… npx tsx --env-file=.env scripts/compare-research.ts
// (la clé Tavily vient du .env ; ne touche PAS au cache de prod)
//
// Méthode : même requête que la prod (lib/sources/tavily.ts), même nettoyage,
// même plafond 4000 car./source. Tavily = config prod exacte (domaines de
// presse par genre). Firecrawl = /v1/search avec scraping markdown intégré
// (pas de filtre domaine équivalent — c'est une vraie différence produit, on
// la mesure au lieu de la masquer).

import axios from "axios";
import * as fs from "fs";
import { fetchTavily } from "../lib/sources/tavily";
import { pickDomains } from "../lib/sources/genres";

const SEEDS = [
  { title: "Or Noir", artist: "Kaaris", genreSignal: "genres: rap français hip hop" },
  { title: "Sexual Healing", artist: "Marvin Gaye", genreSignal: "genres: soul r&b funk" },
  { title: "Sexy Boy", artist: "Air", genreSignal: "genres: electronic french house downtempo" },
];

// Copie de lib/sources/tavily.ts (fonction privée) — même nettoyage des deux côtés.
function stripBoilerplate(raw: string): string {
  return raw
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_]+/g, "")
    .replace(/^[ \t]*[#>+\-]+[ \t]*/gm, "")
    .replace(
      /^[ \t]*(commenter|partager|facebook|twitter|google\+?|share|tweet|pinterest|whatsapp|email|imprimer|newsletter|publicit[ée]|s'abonner|abonnez-vous|menu|accueil|connexion|s'inscrire)[ \t)\]]*$/gim,
      "",
    )
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface Extract {
  source: string;
  url: string;
  chars: number;
  content: string;
}

async function runFirecrawl(title: string, artist: string): Promise<Extract[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY manquante");
  const res = await axios.post(
    "https://api.firecrawl.dev/v1/search",
    {
      query: `"${title}" ${artist} signification analyse critique histoire`,
      limit: 4,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    },
    {
      headers: { Authorization: `Bearer ${key}` },
      timeout: 60000,
    },
  );
  const items = res.data?.data || [];
  return items
    .map((r: any) => {
      const raw = r.markdown || r.description || "";
      const content = stripBoilerplate(raw).slice(0, 4000);
      return {
        source: r.url ? new URL(r.url).hostname.replace("www.", "") : "?",
        url: r.url || "",
        chars: content.length,
        content,
      };
    })
    .filter((e: Extract) => e.chars > 0);
}

async function main() {
  const report: any[] = [];

  for (const seed of SEEDS) {
    const { domains, label } = pickDomains(seed.genreSignal);
    console.log(`\n=== ${seed.title} — ${seed.artist} (genre: ${label}) ===`);

    const t0 = Date.now();
    const tavily = await fetchTavily(seed.title, seed.artist, domains);
    const tavilyMs = Date.now() - t0;

    const t1 = Date.now();
    let firecrawl: Extract[] = [];
    let fcError = "";
    try {
      firecrawl = await runFirecrawl(seed.title, seed.artist);
    } catch (e: any) {
      fcError = e?.response
        ? `${e.response.status} ${JSON.stringify(e.response.data).slice(0, 200)}`
        : String(e?.message || e);
    }
    const firecrawlMs = Date.now() - t1;

    const tavilyExtracts: Extract[] = tavily.map((s) => ({
      source: s.source,
      url: s.url,
      chars: s.content.length,
      content: s.content,
    }));

    const fmt = (list: Extract[]) =>
      list
        .map((e) => `  - ${e.source} (${e.chars} car.)`)
        .join("\n") || "  (rien)";
    console.log(`Tavily    : ${tavilyMs} ms, ${tavilyExtracts.length} source(s)\n${fmt(tavilyExtracts)}`);
    console.log(`Firecrawl : ${firecrawlMs} ms, ${firecrawl.length} source(s)${fcError ? ` ERREUR: ${fcError}` : ""}\n${fmt(firecrawl)}`);

    report.push({
      seed,
      genre: label,
      domains,
      tavily: { ms: tavilyMs, extracts: tavilyExtracts },
      firecrawl: { ms: firecrawlMs, error: fcError, extracts: firecrawl },
    });
  }

  fs.writeFileSync(
    "/tmp/research-compare.json",
    JSON.stringify(report, null, 2),
  );
  console.log("\nDétail complet : /tmp/research-compare.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
