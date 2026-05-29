import { fetchWikipediaArtist, fetchWikipediaTrack } from "./sources/wikipedia";
import { fetchMusicBrainz } from "./sources/musicbrainz";
import { fetchTheAudioDB } from "./sources/theaudiodb";
import { fetchLastFm } from "./sources/lastfm";
import { fetchGenius } from "./sources/genius";
import { fetchDiscogs } from "./sources/discogs";
import { fetchTavily } from "./sources/tavily";
import { pickDomains } from "./sources/genres";

export interface SourcedFact {
  content: string;
  source: string;
  url: string;
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
): Promise<{ facts: string; sources: SourcedFact[] }> {
  // --- Phase 1 : tout sauf Tavily ---
  const [wikiArtist, wikiTrack, musicbrainz, audiodb, lastfm, genius, discogs] =
    await Promise.all([
      fetchWikipediaArtist(artist),
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
  // Tavily est la SEULE source payante ici. On ne l'appelle que si les
  // sources gratuites sont maigres : sinon elle n'ajoute qu'à la marge et
  // consomme un crédit. Seuil : moins de 3 sources OU moins de 1200 caractères.
  const freeSources = [
    wikiArtist,
    wikiTrack,
    musicbrainz,
    audiodb,
    lastfm,
    genius,
    discogs,
  ].filter((s): s is SourcedFact => s !== null);
  const freeChars = freeSources.reduce((sum, s) => sum + s.content.length, 0);
  const needsTavily = freeSources.length < 3 || freeChars < 1200;

  const tavily = needsTavily ? await fetchTavily(title, artist, domains) : [];

  const all: SourcedFact[] = [...freeSources, ...tavily];

  const factBlocks = all.map((s) => `[${s.source}]\n${s.content}`);

  if (factBlocks.length === 0) {
    factBlocks.push(`[Contexte]\nArtiste : ${artist}. Morceau : ${title}.`);
  }

  console.log(
    `Genre détecté : ${genreLabel} → ${domains.join(", ")} | Tavily : ${
      needsTavily ? "oui" : "non (sources gratuites suffisantes)"
    }`,
  );

  return {
    facts: factBlocks.join("\n\n---\n\n"),
    sources: all,
  };
}
