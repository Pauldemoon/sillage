import Anthropic from "@anthropic-ai/sdk";
import {
  findBestTrackMatch,
  searchTracks,
  SpotifyTrack,
} from "../../lib/spotify";

// L'émission visée fait 7-8 titres (~30 min) : assez pour deux grandes
// histoires (loupes) et de vrais liens courts entre elles.
const TARGET_TRACKS = 8;
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
  // Graine déjà résolue par l'app (l'utilisateur a cliqué un VRAI titre
  // Spotify, id compris) : on lui fait confiance, on ne re-cherche pas.
  preResolvedSeed?: SpotifyTrack,
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
    max_tokens: 1000,
    // Prompt caching : la charte (longue) est partagée entre émissions proches.
    system: [
      {
        type: "text",
        text: `Tu es un programmateur radio musical expert. Tu sélectionnes 7 à 8 morceaux pour une émission d'environ une demi-heure.

${SILLAGE_EDITORIAL_CHARTER}

Règles :
- Le morceau de départ est TOUJOURS le premier
- Tous les suivants doivent correspondre à l'angle éditorial
- Cohérence de scène : la playlist SUIT l'angle, et n'est jamais figée. Une graine francophone donne le plus souvent une playlist francophone — et elle peut très bien être 100 % FR (une lignée, un mouvement local : rap FR → rap FR). Mais si l'angle est un vrai croisement ou un duel (ex. « Sevran contre Chicago »), la playlist peut faire dialoguer les deux scènes. La seule règle dure : pas de titres étrangers SANS que l'angle les justifie. À l'inverse, n'hésite jamais à rester 100 % dans la scène de la graine quand l'angle est local. Au cas par cas, ni « toujours FR » ni « toujours croisé »
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

Donne-moi 14 morceaux candidats, classés du plus au moins essentiel à l'angle. Le premier doit être le morceau de départ. (On en gardera 8 : les candidats au-delà servent de réserve quand un titre est introuvable sur Spotify.)`,
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
  const [seedExact, candidates] = await Promise.all([
    preResolvedSeed
      ? Promise.resolve(preResolvedSeed)
      : findBestTrackMatch(title, artist).catch(() => null),
    Promise.all(
      suggestions.map((s) =>
        findBestTrackMatch(s.title, s.artist).catch(() => null),
      ),
    ),
  ]);

  // La graine est SACRÉE : l'utilisateur l'a choisie depuis la recherche
  // Spotify. Si le match strict échoue, on repêche dans le top 5 UNIQUEMENT
  // un titre du MÊME artiste — jamais le premier résultat brut (vu en test :
  // « Submarine Addison Rae » → un titre de DJ Scheme). Sinon, erreur claire :
  // une émission qui démarre sur le mauvais morceau n'a pas de sens.
  const seed =
    seedExact ||
    (await searchTracks(`${title} ${artist}`, 5).catch(() => [])).find((t) =>
      sameArtist(t.artist, artist),
    ) ||
    null;
  if (!seed) {
    throw new Error(
      `Morceau de départ introuvable sur Spotify : "${title}" de ${artist}`,
    );
  }

  // Filtre dur : un artiste explicitement rejeté ne doit JAMAIS apparaître,
  // même si le modèle l'a proposé malgré la consigne. Le morceau de départ
  // reste sacré (l'utilisateur l'a choisi), on ne le filtre donc pas.
  const isDisliked = (artist: string) =>
    memory.dislikedArtists.some((disliked) => sameArtist(disliked, artist));

  const tracks: SpotifyTrack[] = [seed];

  for (const track of candidates) {
    if (!track) continue;
    if (isDisliked(track.artist)) continue;
    if (tracks.some((existing) => sameArtist(existing.artist, track.artist))) {
      continue;
    }

    tracks.push(track);
    if (tracks.length >= TARGET_TRACKS) break;
  }

  if (tracks.length < 7) {
    console.error(
      `playlist: seulement ${tracks.length} titres résolus sur ${suggestions.length} candidats`,
    );
  }

  return tracks;
}
