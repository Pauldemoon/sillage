import Anthropic from "@anthropic-ai/sdk";
import { FRENCH_STYLE_RULES } from "../../lib/editorial/french";

const getClient = () =>
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Relecture d'ÉPISODE : la passe qui voit ce qu'aucune vérification
// narration-par-narration ne peut voir. Deux narrations qui ouvrent de la
// même manière, un fait raconté deux fois, un fil rouge qui tourne en rond —
// tout ça n'existe qu'à l'échelle de l'ensemble. Cette passe arrive APRÈS la
// vérification factuelle individuelle et ne doit jamais la défaire.
const SYSTEM_PROMPT = `Tu es le réalisateur final d'une émission de radio musicale. On te donne TOUTES les narrations d'un épisode, dans l'ordre de diffusion. Prises une à une, elles ont déjà été vérifiées (faits et langue). Ton travail porte UNIQUEMENT sur ce qui ne se voit que sur l'ensemble :

1) GABARITS RÉPÉTÉS — deux narrations ne partagent JAMAIS la même forme d'ouverture ni de chute (interdit : trois narrations qui ouvrent par le même geste, ou qui finissent toutes par « Écoute… »). Si ça arrive, réécris l'entrée ou la sortie des doublons pour varier la FORME. Attention : remplacer une formule répétée par une autre formule répétée reste un gabarit.
2) REDITES — un fait, une date, une formule marquante ne se raconte qu'UNE fois dans l'épisode. Si deux narrations racontent la même chose, garde la meilleure occurrence et retravaille l'autre à partir d'éléments DÉJÀ présents dans la narration concernée.
3) FIL ROUGE — l'épisode avance : chaque narration apporte du neuf vers l'angle, aucune ne refait le chemin d'une précédente.
4) CLOSERS — chaque narration finit concret : une image, une révélation, ou une consigne d'écoute sur le morceau qui arrive. Jamais un slogan abstrait (« la musique n'a jamais été aussi vivante »). Si un closer éditorialise dans le vide, remplace-le par du concret pris dans la narration elle-même.

RÈGLES DURES :
- Tu n'ajoutes AUCUN fait, nom, date, chiffre ou citation qui ne soit déjà dans les narrations fournies. Tu réorganises, tu varies, tu coupes — tu n'inventes pas.
- Tu modifies le MOINS possible : une narration sans défaut d'ensemble est rendue TELLE QUELLE, au caractère près.
- Chaque narration reste entre 85 et 130 mots, orale, au tutoiement, et sa dernière phrase doit pouvoir précéder directement le morceau qui arrive.
- Même nombre de narrations, même ordre.

${FRENCH_STYLE_RULES}

Réponds UNIQUEMENT en JSON valide, sans markdown : {"narrations": ["…", "…"]} — exactement le même nombre, dans le même ordre.`;

export async function reviewEpisode(
  angle: string,
  trackLabels: string[],
  narrations: string[],
): Promise<string[]> {
  // Seules les positions qui ont un texte sont relues ; les emplacements
  // vides (ex. pas de narration avant la graine en seed-first) sont
  // préservés tels quels. Moins de deux textes = rien à comparer.
  const filled = narrations
    .map((text, index) => ({ text, index }))
    .filter((item) => item.text.trim());
  if (filled.length < 2) return narrations;

  try {
    const response = await getClient().messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Angle de l'émission : ${angle}

Playlist :
${trackLabels.map((label, i) => `${i + 1}. ${label}`).join("\n")}

Narrations de l'épisode, dans l'ordre (chacune précède le morceau indiqué) :
${filled
  .map(
    (item, k) =>
      `[Narration ${k + 1} — avant « ${trackLabels[item.index] ?? "?"} »]\n${item.text}`,
  )
  .join("\n\n")}

Renvoie le JSON.`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const clean = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(clean) as { narrations?: string[] };
    if (
      !Array.isArray(parsed.narrations) ||
      parsed.narrations.length !== filled.length
    ) {
      return narrations;
    }

    const out = [...narrations];
    filled.forEach((item, k) => {
      const revised = (parsed.narrations![k] || "").trim();
      if (revised) out[item.index] = revised;
    });
    return out;
  } catch {
    // La relecture améliore ; elle ne doit jamais casser une génération.
    return narrations;
  }
}
