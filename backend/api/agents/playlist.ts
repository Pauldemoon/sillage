import Anthropic from "@anthropic-ai/sdk";
import { findBestTrackMatch, SpotifyTrack } from "../../lib/spotify";
import { SILLAGE_EDITORIAL_CHARTER } from "../../lib/editorial/charter";
import type { UserMemoryProfile } from "../../lib/memory/profile";
import { formatMemoryForPrompt } from "../../lib/memory/profile";

const getClient = () =>
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sameArtist(a: string, b: string) {
  return normalize(a) === normalize(b);
}

export async function buildPlaylist(
  title: string,
  artist: string,
  angle: string,
  description: string,
  facts: string,
  memory: UserMemoryProfile,
  knownCandidates: { title: string; artist: string }[] = [],
): Promise<SpotifyTrack[]> {
  // Layer 2 — pool de candidats validés (dérivé des voyages déjà en cache
  // pour cette graine). Ce sont des morceaux déjà résolus sur Spotify et
  // déjà retenus éditorialement : on les propose comme inspiration fiable,
  // sans contraindre, pour gagner en qualité/disponibilité sans figer la
  // diversité (l'angle reste le pilote).
  const poolBlock = knownCandidates.length
    ? `\n\nMorceaux déjà validés pour ce morceau de départ (présents sur Spotify, retenus dans de précédentes émissions). Tu peux en réutiliser s'ils SERVENT VRAIMENT l'angle ci-dessus, mais tu restes libre — et encouragé — à proposer de meilleurs choix neufs :
${knownCandidates.map((c) => `- ${c.title} — ${c.artist}`).join("\n")}`
    : "";
  const response = await getClient().messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 800,
    // Prompt caching : la charte (longue) est partagée entre émissions proches.
    system: [
      {
        type: "text",
        text: `Tu es un programmateur radio musical expert. Tu sélectionnes 5 morceaux pour une émission.

${SILLAGE_EDITORIAL_CHARTER}

Règles :
- Le morceau de départ est TOUJOURS le premier
- Les 4 suivants doivent correspondre à l'angle éditorial
- Cohérence de scène : pour une graine francophone, la MAJORITÉ des titres reste francophone (rap FR → rap FR, soul → soul). Un titre étranger est un accent RARE (un, à la rigueur deux), JAMAIS la majorité — une graine FR ne donne jamais une playlist 100 % étrangère. Une influence étrangère se raconte surtout dans la narration. Si l'angle est un croisement, il reste ANCRÉ dans la scène de la graine (l'étranger = contrepoint, pas destination). Souple mais pas n'importe quoi : au cas par cas, dans le doute reste à la maison. Même un angle de duel/croisement (ex. « Sevran contre Chicago ») garde la MAJORITÉ du côté de la graine : pour une graine FR, au moins 3 titres sur 5 sont francophones (la graine compte)
- Chaque morceau doit exister sur Spotify
- Diversifie les artistes (pas 2 morceaux du même artiste)
- Ordonne les morceaux pour créer une progression narrative cohérente avec les faits disponibles
- Évite les suites trop évidentes : au moins deux choix doivent ouvrir vers une découverte réelle
- Tiens compte de la mémoire utilisateur : évite les artistes explicitement rejetés, et ne remplis pas l'émission avec des artistes déjà connus si la tolérance à la découverte le permet.
- Ne cherche pas à écrire ni à commenter : donne seulement des choix de morceaux

Réponds UNIQUEMENT en JSON valide :
[{"title": "...", "artist": "..."}, ...]`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Morceau de départ : "${title}" de ${artist}
Angle : ${angle}
Description : ${description}

Mémoire utilisateur :
${formatMemoryForPrompt(memory) || "Aucune mémoire disponible."}

Faits sourcés :
${facts.slice(0, 1000)}${poolBlock}

Donne-moi 8 morceaux candidats. Le premier doit être le morceau de départ.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "[]";
  const clean = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  const suggestions: { title: string; artist: string }[] = JSON.parse(clean);

  // Les recherches Spotify sont indépendantes : on les lance toutes en
  // parallèle (au lieu d'une boucle séquentielle) pour réduire fortement la
  // latence, puis on applique la déduplication dans l'ordre des suggestions.
  const [seed, candidates] = await Promise.all([
    findBestTrackMatch(title, artist),
    Promise.all(
      suggestions.map((s) =>
        findBestTrackMatch(s.title, s.artist).catch(() => null),
      ),
    ),
  ]);

  // Filtre dur : un artiste explicitement rejeté ne doit JAMAIS apparaître,
  // même si le modèle l'a proposé malgré la consigne. Le morceau de départ
  // reste sacré (l'utilisateur l'a choisi), on ne le filtre donc pas.
  const isDisliked = (artist: string) =>
    memory.dislikedArtists.some((disliked) => sameArtist(disliked, artist));

  const tracks: SpotifyTrack[] = [];
  if (seed) tracks.push(seed);

  for (const track of candidates) {
    if (!track) continue;
    if (isDisliked(track.artist)) continue;
    if (tracks.some((existing) => sameArtist(existing.artist, track.artist))) {
      continue;
    }

    tracks.push(track);
    if (tracks.length >= 5) break;
  }

  return tracks;
}
