import Anthropic from "@anthropic-ai/sdk";
import {
  FRENCH_STYLE_RULES,
  FRENCH_SUBJECT_RULES,
} from "../../lib/editorial/french";
import { sampleRecipes, formatRecipes } from "../../lib/editorial/recipes";

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

  // Rotation de recettes : ~12 lentilles tirées au sort dans la banque de 100,
  // différentes à chaque génération. Elles inspirent l'angle sans l'imposer —
  // la fraîcheur vient du tirage, la pertinence du choix laissé au modèle.
  const recipesNote = `\n\nPour t'inspirer, douze lentilles éditoriales tirées au sort (des patterns, pas des angles finis — n'en utilise une que si les faits réels du dossier l'incarnent vraiment ; sinon ignore-les) :
${formatRecipes(sampleRecipes(12))}`;

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 400,
    system: `Tu es directeur éditorial d'une radio musicale, dans l'esprit de FIP ou Nova. À partir d'un morceau de départ et de faits réels sourcés, tu trouves l'angle d'une émission qui fera découvrir 5 morceaux cohérents.

Tu choisis D'ABORD un archétype d'angle dans cette palette (utilise sa CLÉ), puis tu l'incarnes avec les faits réels du morceau :
${palette}

L'angle doit :
- S'appuyer sur les faits fournis, jamais sur l'invention
- Être spécifique et un peu inattendu — surtout pas "l'histoire du groupe"
- Passer le test du naturel : l'angle doit pouvoir se dire à un ami en UNE phrase qui lui fait lever un sourcil (« tu savais que tout ce son vient d'un seul immeuble de Versailles ? »). Si la phrase sonne comme un concept de conférence ou un dossier de presse, c'est raté — reformule à partir du fait le plus surprenant du dossier
- Garantir une vraie cohérence entre les 5 morceaux (attention aux contradictions : ne propose pas un angle "contre l'Angleterre" si tu comptes mettre des groupes anglais)
- La SCÈNE du voyage (souple, jamais figée) : le plus souvent, le voyage RESTE dans le monde de la graine (rap FR → rap FR, soul → soul), surtout pour une graine francophone — c'est le réflexe par défaut. Une influence étrangère, même revendiquée (ex. la drill de Chicago derrière un rappeur français), se RACONTE dans l'émission ; elle ne fait pas partir le voyage à l'étranger pour autant. Croiser pour de vrai vers une autre scène ou un autre pays reste possible, mais c'est l'EXCEPTION : seulement quand le lien est si fort et si évident que l'épisode serait bancal sans lui. Juge au cas par cas — ni "toujours français", ni "toujours croisé" — mais dans le doute, tu restes à la maison. Et même quand tu croises, la scène de la graine reste la BASE et la majorité des titres : la scène étrangère n'est qu'un contrepoint ou une source qu'on raconte (ex. un duel "Sevran contre Chicago" ancré à Sevran), jamais la destination où l'on déménage toute la playlist
- Être DIT, pas titré : il n'y a pas de titre d'émission. Tu écris la phrase que l'animateur dirait au micro pour lancer son sujet — une vraie phrase parlée, avec un verbe conjugué (« on va parler de… », « je t'emmène… »), jamais un fragment nominal. Les RÈGLES DE L'ÉNONCÉ ci-dessous font foi

${FRENCH_STYLE_RULES}

${FRENCH_SUBJECT_RULES}

Réponds UNIQUEMENT en JSON valide, sans markdown :
{"archetype": "la clé de l'archétype choisi", "angle": "l'énoncé du sujet — la phrase naturelle qui dit de quoi l'émission va parler", "description": "une phrase qui explique le fil rouge entre les morceaux"}`,
    messages: [
      {
        role: "user",
        content: `Titre de départ : "${title}" de ${artist}

Faits sourcés disponibles :
${facts}${avoidNote}${recipesNote}`,
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

  const angle = await refineSubject(parsed.angle || "", artist);

  return {
    angle,
    description: parsed.description || "",
    archetype,
  };
}

// Garde-fou de langue ciblé sur l'énoncé du sujet — le texte le plus visible
// de l'émission. Une passe Haiku (quasi gratuite) qui le réécrit UNIQUEMENT
// s'il sonne titre tout fait, traduit de l'anglais ou creux.
// Renvoie l'énoncé tel quel s'il est déjà bon, ou en cas d'échec.
async function refineSubject(subject: string, artist: string): Promise<string> {
  if (!subject.trim()) return subject;
  try {
    const response = await getClient().messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 100,
      system: `Tu es un éditeur de radio musicale française (FIP, Nova) dont le français est la langue maternelle. On te donne l'énoncé du sujet d'une émission — la phrase qui dit de quoi on va parler. Ton seul rôle : garantir qu'elle sonne naturelle à voix haute, jamais comme un titre tout fait ni une traduction de l'anglais.

${FRENCH_SUBJECT_RULES}

Si l'énoncé est déjà bon, renvoie-le À L'IDENTIQUE.
S'il sonne titre packagé, traduit, vague ou creux, réécris-le en mieux (naturel, concret, dicible).
Ne traduis JAMAIS le titre d'un morceau ou d'un groupe : il reste en anglais.
Réponds UNIQUEMENT par l'énoncé final, sans guillemets, sans explication.`,
      messages: [
        {
          role: "user",
          content: `Artiste de départ : ${artist}\nÉnoncé proposé : ${subject}`,
        },
      ],
    });
    const refined =
      response.content[0].type === "text"
        ? response.content[0].text.trim().replace(/^["«»\s]+|["«»\s]+$/g, "")
        : "";
    return refined || subject;
  } catch {
    return subject;
  }
}
