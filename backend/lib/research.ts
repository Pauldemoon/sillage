import Anthropic from "@anthropic-ai/sdk";
import { fetchWikipediaTrack } from "./sources/wikipedia";
import { fetchMusicBrainz } from "./sources/musicbrainz";
import { fetchTheAudioDB } from "./sources/theaudiodb";
import { fetchLastFm } from "./sources/lastfm";
import { fetchGenius } from "./sources/genius";
import { fetchDiscogs } from "./sources/discogs";
import { fetchTavily } from "./sources/tavily";
import { pickDomains } from "./sources/genres";
import { getCachedResearch, setCachedResearch } from "./cache/matter";

export interface SourcedFact {
  content: string;
  source: string;
  url: string;
}

export interface ResearchResult {
  facts: string;
  sources: SourcedFact[];
}

// Filtre de pertinence sur la presse : le filtre de DOMAINES garantit la
// qualité de la plume, pas le sujet (constaté au banc : 4 extraits de bonne
// presse musicale dont AUCUN ne parlait de « Sexual Healing »). Un extrait
// hors-sujet entre dans le dossier et le modèle meuble avec → narration
// creuse. Une passe Haiku jette ce qui ne parle ni du morceau ni de
// l'artiste. En cas de panne du juge, on garde tout (fail-open).
async function filterRelevantPress(
  title: string,
  artist: string,
  extracts: SourcedFact[],
): Promise<SourcedFact[]> {
  if (extracts.length === 0) return extracts;
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 150,
      system: `Tu juges la pertinence d'extraits de presse pour le dossier documentaire d'un morceau de musique. Pour chaque extrait, réponds :
- "morceau" : il parle vraiment du morceau visé (chronique, analyse, histoire de l'enregistrement…)
- "artiste" : il parle substantiellement de l'artiste visé (interview, portrait, chronique d'un autre de ses disques)
- "hors-sujet" : il ne fait que mentionner l'artiste en passant, ou parle d'autre chose

Réponds UNIQUEMENT en JSON valide, sans markdown : {"verdicts": ["morceau"|"artiste"|"hors-sujet", …]} — un verdict par extrait, dans l'ordre.`,
      messages: [
        {
          role: "user",
          content: `Morceau visé : "${title}" de ${artist}

${extracts
  .map(
    (extract, index) =>
      `[Extrait ${index + 1} — ${extract.source}]\n${extract.content.slice(0, 1500)}`,
  )
  .join("\n\n")}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(
      text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim(),
    ) as { verdicts?: string[] };
    const verdicts = parsed.verdicts || [];
    if (verdicts.length !== extracts.length) return extracts;

    const kept = extracts.filter((_, index) => verdicts[index] !== "hors-sujet");
    if (kept.length < extracts.length) {
      console.log(
        `Pertinence : ${extracts.length - kept.length} extrait(s) hors-sujet écarté(s) pour ${title} — ${artist}`,
      );
    }
    return kept;
  } catch {
    return extracts;
  }
}

/**
 * Agrège plusieurs sources musicales.
 * Phase 1 : sources qui révèlent le genre (parallèle).
 * Phase 2 : Tavily ciblé sur la presse spécialisée du genre détecté.
 * Chaque source échoue silencieusement (retourne null/[]) sans bloquer.
 */
export async function researchArtist(
  title: string,
  artist: string,
): Promise<ResearchResult> {
  // --- Couche 1 : cache de matière (déterministe, mutualisé entre users) ---
  const hit = await getCachedResearch<ResearchResult>(title, artist);
  if (hit) {
    console.log(`Recherche (cache) : ${title} — ${artist}`);
    return hit;
  }

  // --- Phase 1 : tout sauf Tavily ---
  // Bio d'artiste : portée par Last.fm (plus vivante, en FR), PAS par la bio
  // Wikipédia — trop générique et redondante. On garde la page Wikipédia du
  // MORCEAU, qui apporte le contexte spécifique au titre.
  const [wikiTrack, musicbrainz, audiodb, lastfm, genius, discogs] =
    await Promise.all([
      fetchWikipediaTrack(title, artist),
      fetchMusicBrainz(artist),
      fetchTheAudioDB(artist),
      fetchLastFm(artist),
      fetchGenius(title, artist),
      fetchDiscogs(title, artist),
    ]);

  // Détection du genre : UNIQUEMENT sur les lignes de tags/genres/styles/pays
  // (jamais sur les bios en prose, sinon faux positifs type "un classique du rap").
  const genreSignals = [musicbrainz, audiodb, lastfm, discogs]
    .filter((s): s is SourcedFact => s !== null)
    .map((s) => {
      const lines =
        s.content.match(
          /(?:genres?|tags?|styles?|pays|country|origine)\s*:\s*[^\n]+/gi,
        ) || [];
      return lines.join(" ");
    })
    .join(" ");
  const { label: genreLabel, domains } = pickDomains(genreSignals);

  // --- Phase 2 : Tavily ciblé sur la presse du genre ---
  // Choix éditorial assumé : on interroge TOUJOURS la presse spécialisée
  // (Pitchfork, Les Inrocks, Jazz Mag, Resident Advisor…) pour avoir de
  // vraies plumes, pas seulement des métadonnées. Tavily est la seule source
  // payante, mais le résultat est mis en cache 60 j : la presse n'est donc
  // payée qu'UNE fois par morceau, jamais re-payée ensuite.
  // Chaque moisson passe le filtre de pertinence ; si la première est trop
  // maigre après tri, une seconde requête recentrée sur l'artiste complète.
  let tavily = await filterRelevantPress(
    title,
    artist,
    await fetchTavily(title, artist, domains),
  );
  if (tavily.length < 2) {
    const retry = await filterRelevantPress(
      title,
      artist,
      await fetchTavily(
        title,
        artist,
        domains,
        `${artist} "${title}" interview chronique enregistrement album`,
      ),
    );
    const seen = new Set(tavily.map((s) => s.url));
    tavily = [...tavily, ...retry.filter((s) => !seen.has(s.url))];
  }

  // L'ORDRE du dossier = sa priorité éditoriale, parce que les agents en aval
  // tronquent (la narration ne lit que les premiers milliers de caractères).
  // On met donc EN TÊTE la matière qui raconte : la presse spécialisée (Tavily),
  // puis les sources riches en faits précis (Genius, Discogs). Wikipédia ferme
  // la marche — c'est le filet générique, pas le plat principal.
  const all: SourcedFact[] = [
    ...tavily,
    genius,
    discogs,
    lastfm,
    musicbrainz,
    audiodb,
    wikiTrack,
  ].filter((s): s is SourcedFact => s !== null);

  const factBlocks = all.map((s) => `[${s.source}]\n${s.content}`);

  if (factBlocks.length === 0) {
    factBlocks.push(`[Contexte]\nArtiste : ${artist}. Morceau : ${title}.`);
  }

  console.log(
    `Genre détecté : ${genreLabel} → presse : ${domains.join(", ")} | ` +
      `presse trouvée : ${tavily.length} extrait(s)`,
  );

  const result: ResearchResult = {
    facts: factBlocks.join("\n\n---\n\n"),
    sources: all,
  };

  // On ne met en cache que de la vraie matière (au moins une source réelle),
  // jamais le placeholder de contexte vide.
  if (all.length > 0) {
    await setCachedResearch(title, artist, result);
  }

  return result;
}
