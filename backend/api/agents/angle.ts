import Anthropic from "@anthropic-ai/sdk";
import {
  FRENCH_STYLE_RULES,
  FRENCH_TITLE_RULES,
} from "../../lib/editorial/french";

const getClient = () =>
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Palette d'archétypes d'angle. La clé sert de tag stable pour le cache de
// voyages (diversité) ; le label est ce que lit le directeur éditorial.
export const ARCHETYPES: Record<string, string> = {
  filiation:
    "La filiation cachée — qui a influencé qui, la dette d'un artiste envers un autre",
  geographie:
    "Le contre-pied géographique — une ville, une scène, contre une autre",
  objet: "L'objet ou le détail — une anecdote concrète qui ouvre tout un monde",
  rivalite: "La rivalité — deux camps, deux écoles qui s'opposent",
  bascule:
    "Le moment-bascule — l'instant précis où quelque chose change dans la musique",
  heritage: "L'héritage — ce que ce morceau a engendré, ses enfants",
  envers:
    "L'envers du décor — le revers, le secret, le malentendu derrière le succès",
  fil: "Le fil thématique — un thème, un son, un geste commun à plusieurs morceaux",
};

export interface AngleResult {
  angle: string;
  description: string;
  archetype: string;
}

export async function generateAngle(
  title: string,
  artist: string,
  facts: string,
  avoidArchetypes: string[] = [],
): Promise<AngleResult> {
  const palette = Object.entries(ARCHETYPES)
    .map(([key, label]) => `- ${key} : ${label}`)
    .join("\n");

  const avoidNote =
    avoidArchetypes.length > 0
      ? `\n\nIMPORTANT — diversité : l'auditeur a déjà eu des émissions sur ce morceau avec ces archétypes : ${avoidArchetypes.join(
          ", ",
        )}. Choisis OBLIGATOIREMENT un archétype DIFFÉRENT pour lui offrir un nouveau voyage.`
      : "";

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 400,
    system: `Tu es directeur éditorial d'une radio musicale, dans l'esprit de FIP ou Nova. À partir d'un morceau de départ et de faits réels sourcés, tu trouves l'angle d'une émission qui fera découvrir 5 morceaux cohérents.

Tu choisis D'ABORD un archétype d'angle dans cette palette (utilise sa CLÉ), puis tu l'incarnes avec les faits réels du morceau :
${palette}

L'angle doit :
- S'appuyer sur les faits fournis, jamais sur l'invention
- Être spécifique et un peu inattendu — surtout pas "l'histoire du groupe"
- Garantir une vraie cohérence entre les 5 morceaux (attention aux contradictions : ne propose pas un angle "contre l'Angleterre" si tu comptes mettre des groupes anglais)
- Avoir un titre d'émission qui SONNE : court, rythmé, avec une accroche (4 à 9 mots)

${FRENCH_STYLE_RULES}

${FRENCH_TITLE_RULES}

Réponds UNIQUEMENT en JSON valide, sans markdown :
{"archetype": "la clé de l'archétype choisi", "angle": "le titre de l'émission", "description": "une phrase qui explique l'angle et le fil rouge entre les morceaux"}`,
    messages: [
      {
        role: "user",
        content: `Titre de départ : "${title}" de ${artist}

Faits sourcés disponibles :
${facts}${avoidNote}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const clean = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  const parsed = JSON.parse(clean) as Partial<AngleResult>;

  // Garde-fou : si le modèle renvoie un archétype hors palette, on retombe
  // sur une clé neutre pour ne pas casser le tag de cache.
  const archetype =
    parsed.archetype && ARCHETYPES[parsed.archetype] ? parsed.archetype : "fil";

  const angle = await refineTitle(parsed.angle || "", artist);

  return {
    angle,
    description: parsed.description || "",
    archetype,
  };
}

// Garde-fou de langue ciblé sur le titre — le texte le plus visible de
// l'émission. Une passe Haiku (quasi gratuite) qui réécrit le titre UNIQUEMENT
// s'il sonne traduit de l'anglais ou s'appuie sur une métaphore creuse.
// Renvoie le titre tel quel s'il est déjà bon, ou en cas d'échec.
async function refineTitle(title: string, artist: string): Promise<string> {
  if (!title.trim()) return title;
  try {
    const response = await getClient().messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 80,
      system: `Tu es un éditeur de radio musicale française (FIP, Nova) dont le français est la langue maternelle. On te donne un titre d'émission. Ton seul rôle : garantir qu'il sonne comme un vrai titre français, pas comme une traduction de l'anglais.

${FRENCH_TITLE_RULES}

Si le titre est déjà bon, renvoie-le À L'IDENTIQUE.
S'il sonne traduit, vague ou creux, réécris-le en mieux (court, concret, idiomatique).
Ne traduis JAMAIS le titre d'un morceau ou d'un groupe : il reste en anglais.
Réponds UNIQUEMENT par le titre final, sans guillemets, sans explication.`,
      messages: [
        {
          role: "user",
          content: `Artiste de départ : ${artist}\nTitre d'émission proposé : ${title}`,
        },
      ],
    });
    const refined =
      response.content[0].type === "text"
        ? response.content[0].text.trim().replace(/^["«»\s]+|["«»\s]+$/g, "")
        : "";
    return refined || title;
  } catch {
    return title;
  }
}
