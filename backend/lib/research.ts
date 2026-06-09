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
  const tavily = await fetchTavily(title, artist, domains);

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
