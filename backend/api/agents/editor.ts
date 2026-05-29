import Anthropic from "@anthropic-ai/sdk";
import type { SpotifyTrack } from "../../lib/spotify";
import type { SourcedFact } from "../../lib/research";
import { SILLAGE_EDITORIAL_CHARTER } from "../../lib/editorial/charter";
import { FRENCH_STYLE_RULES } from "../../lib/editorial/french";
import type { UserMemoryProfile } from "../../lib/memory/profile";
import { formatMemoryForPrompt } from "../../lib/memory/profile";

const getClient = () =>
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface TrackDossier {
  track: SpotifyTrack;
  facts: string;
  sources: SourcedFact[];
  editorialRole?: string;
  editorialReason?: string;
}

export interface EditorialAssignment {
  position: number;
  role: string;
  reason: string;
  discoveryLevel: "anchor" | "bridge" | "detour" | "surprise" | "resolution";
}

export interface EditorialReplacement {
  position: number;
  title: string;
  artist: string;
  role: string;
  reason: string;
}

export interface EditorialReview {
  summary: string;
  assignments: EditorialAssignment[];
  replacements: EditorialReplacement[];
}

function parseJson<T>(text: string): T {
  const clean = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  return JSON.parse(clean.slice(start, end + 1));
}

function normalizeReview(review: Partial<EditorialReview>): EditorialReview {
  return {
    summary: review.summary || "",
    assignments: Array.isArray(review.assignments) ? review.assignments : [],
    replacements: Array.isArray(review.replacements) ? review.replacements : [],
  };
}

function fallbackReview(dossiers: TrackDossier[]): EditorialReview {
  const roles = ["ancrage", "pont", "déplacement", "surprise", "résolution"];
  const levels: EditorialAssignment["discoveryLevel"][] = [
    "anchor",
    "bridge",
    "detour",
    "surprise",
    "resolution",
  ];

  return {
    summary:
      "Relecture éditoriale conservatrice : la playlist est gardée faute de JSON valide.",
    assignments: dossiers.map((_, index) => ({
      position: index + 1,
      role: roles[index] || "étape",
      reason: "Morceau conservé dans la progression éditoriale.",
      discoveryLevel: levels[index] || "bridge",
    })),
    replacements: [],
  };
}

async function repairEditorialJson(text: string): Promise<EditorialReview> {
  const response = await getClient().messages.create({
    // Réparation purement mécanique : Haiku largement suffisant.
    model: "claude-haiku-4-5",
    max_tokens: 900,
    system: `Tu répares du JSON invalide.
Renvoie UNIQUEMENT un JSON valide conforme à ce schéma :
{
  "summary": "string",
  "assignments": [
    {
      "position": 1,
      "role": "string",
      "reason": "string",
      "discoveryLevel": "anchor"
    }
  ],
  "replacements": [
    {
      "position": 2,
      "title": "string",
      "artist": "string",
      "role": "string",
      "reason": "string"
    }
  ]
}
Valeurs autorisées pour discoveryLevel : anchor, bridge, detour, surprise, resolution.`,
    messages: [
      {
        role: "user",
        content: `JSON invalide à réparer :
${text.slice(0, 6000)}`,
      },
    ],
  });

  const repaired =
    response.content[0].type === "text" ? response.content[0].text : "{}";
  return normalizeReview(parseJson<Partial<EditorialReview>>(repaired));
}

const SYSTEM_PROMPT = `Tu es le rédacteur en chef de Sillage, une émission musicale personnalisée.

${SILLAGE_EDITORIAL_CHARTER}

TA MISSION :
- Protéger l'angle global de l'émission.
- Vérifier que chaque morceau défend cet angle avec des faits sourcés.
- Construire une progression : ancrage, pont, déplacement, surprise, résolution.
- Favoriser la découverte sans perdre l'utilisateur.
- Remplacer les morceaux trop évidents, redondants, faibles ou mal reliés à l'angle.
- Produire une décision éditoriale exploitable, pas une narration finale.

RÈGLES :
- Le morceau 1 est sacré : ne le remplace jamais.
- Les morceaux 2 à 5 doivent ouvrir progressivement le champ culturel, géographique, historique ou esthétique.
- Au moins deux morceaux après le premier doivent faire découvrir un artiste moins évident pour un auditeur venu du morceau de départ.
- Évite deux morceaux du même artiste.
- Tiens compte de la mémoire utilisateur : évite les artistes explicitement rejetés et augmente la découverte si l'utilisateur connaît déjà beaucoup d'artistes proches.
- Une bonne source ne suffit pas : le morceau doit avoir un rôle narratif.
- Si tu proposes un remplacement, choisis un morceau très probablement disponible sur Spotify.
- Propose au maximum 2 remplacements à la fois.
- Si la playlist tient debout, ne remplace rien.
- Écris les rôles et raisons de façon sèche, précise, vérifiable. Pas de métaphore décorative, pas de formule poétique, pas de critique musicale vague.
- N'utilise pas de descripteurs flous comme "tension froide", "beauté inquiète", "organique", "intime", "suspendu", "presque", "à la fois".
- Si tu ne peux pas justifier un morceau par un fait ou par une fonction claire dans le trajet, demande son remplacement.
- N'écris jamais "aucun" comme rôle. Un morceau a un rôle clair, ou il doit être remplacé.

${FRENCH_STYLE_RULES}

Réponds UNIQUEMENT en JSON valide, sans markdown :
{
  "summary": "diagnostic éditorial en une phrase",
  "assignments": [
    {
      "position": 1,
      "role": "ancrage",
      "reason": "fonction exacte du morceau dans le trajet",
      "discoveryLevel": "anchor"
    }
  ],
  "replacements": [
    {
      "position": 3,
      "title": "titre du morceau de remplacement",
      "artist": "artiste",
      "role": "rôle éditorial prévu",
      "reason": "fonction exacte du remplacement dans le trajet"
    }
  ]
}`;

export async function reviewPlaylist(
  seedTitle: string,
  seedArtist: string,
  angle: string,
  description: string,
  dossiers: TrackDossier[],
  memory: UserMemoryProfile,
): Promise<EditorialReview> {
  const response = await getClient().messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 900,
    // Prompt caching : la charte éditoriale (longue) est identique à chaque
    // passe de relecture (jusqu'à 3 par émission) → −90% sur ces tokens.
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Morceau de départ demandé par l'utilisateur :
"${seedTitle}" — ${seedArtist}

Angle global :
${angle}

Description :
${description}

Mémoire utilisateur :
${formatMemoryForPrompt(memory) || "Aucune mémoire disponible."}

Playlist documentée à relire :
${dossiers
  .map(
    (dossier, index) => `Position ${index + 1}
Morceau : "${dossier.track.title}" — ${dossier.track.artist}
Album : ${dossier.track.album}
Sources disponibles : ${
      dossier.sources.map((source) => source.source).join(", ") || "aucune"
    }
Faits sourcés :
${dossier.facts.slice(0, 1400)}`,
  )
  .join("\n\n---\n\n")}

Relis cette playlist comme un rédacteur en chef. Attribue un rôle éditorial à chaque position existante. Propose des remplacements seulement si le voyage devient plus fort.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "{}";
  try {
    return normalizeReview(parseJson<Partial<EditorialReview>>(text));
  } catch {
    try {
      return await repairEditorialJson(text);
    } catch {
      return fallbackReview(dossiers);
    }
  }
}
