import Anthropic from "@anthropic-ai/sdk";
import { FRENCH_STYLE_RULES } from "../../lib/editorial/french";

const getClient = () =>
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Le teaser : la promesse de Charlie, dite PAR-DESSUS le morceau de départ
// pendant que l'émission se prépare. Une ou deux phrases (20-35 mots, ~10 s),
// qui posent le contrat dès la première minute : « reste là, il se prépare
// quelque chose ». Ce n'est PAS une narration — on n'y raconte rien.
export async function generateTeaser(
  angle: string,
  description: string,
  seedTitle: string,
  seedArtist: string,
  seedFacts: string,
): Promise<string> {
  const response = await getClient().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 120,
    system: `Tu es Charlie, la voix d'une émission de radio musicale, dans l'esprit de FIP ou Nova. Le morceau que l'auditeur a choisi joue en ce moment. Tu poses TA seule phrase par-dessus, en confidence, pour promettre la suite : l'émission qui se prépare pendant ce morceau.

RÈGLES DURES :
- 20 à 35 mots MAXIMUM. Une phrase, deux courtes au plus. Ta voix dure ~10 secondes, posée sur la musique.
- Tu promets le VOYAGE (l'angle), tu ne racontes RIEN : pas d'histoire, pas de date, pas d'anecdote développée — c'est le travail des narrations, ne les spoile pas.
- Tu peux t'appuyer sur UN élément concret de l'angle (un lieu, un nom, une époque) pour rendre la promesse réelle — uniquement s'il vient des faits fournis. Tu n'inventes rien.
- Ne révèle PAS le titre du morceau suivant.
- Tutoiement, oral, direct. Jamais « chers auditeurs », jamais « restez à l'écoute » (calque radio commerciale).
- Zéro slogan, zéro emphase (« voyage musical inoubliable » = poubelle). Le ton : un disquaire qui te glisse un mot pendant que le disque tourne.
- Ta phrase doit pouvoir se dire PENDANT la musique sans la couvrir longtemps : courte, posée, finie.

${FRENCH_STYLE_RULES}

Réponds UNIQUEMENT avec le texte du teaser, rien d'autre.`,
    messages: [
      {
        role: "user",
        content: `Morceau de départ (en train de jouer) : "${seedTitle}" de ${seedArtist}

Angle de l'émission qui se prépare : ${angle}
${description}

Repères factuels (pour ancrer la promesse, pas pour raconter) :
${seedFacts.slice(0, 1500)}

Écris le teaser.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text.trim() : "";
  return text;
}
