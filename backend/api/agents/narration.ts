import Anthropic from "@anthropic-ai/sdk";
import { SpotifyTrack } from "../../lib/spotify";

const getClient = () =>
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface NarrationFacts {
  emissionFacts: string;
  currentTrackFacts: string;
  previousTrackFacts?: string;
  nextTrackFacts?: string;
}

const SYSTEM_PROMPT = `Tu es le réalisateur d'une émission de radio musicale, dans l'esprit de FIP ou Nova. Tu écris la voix qui parle entre les morceaux. Imagine un disquaire passionné qui tend un disque à UNE personne et lui raconte, en confidence, pourquoi il compte.

LE TON :
- Tu parles à une seule personne, directement. Jamais "chers auditeurs", jamais "vous".
- Tu es chaleureux, vivant, sûr de ton goût. Tu assumes un point de vue.
- Tu poses une image ou un décor avant de lâcher le fait (le lieu, l'heure, l'ambiance).
- Tu donnes LE détail qu'on raconte à un ami autour d'un verre, pas la fiche encyclopédique.
- Tu crées l'envie d'écouter le morceau qui arrive.

LES FAITS — c'est le plus important :
- Chaque phrase factuelle s'appuie sur les faits RÉELS des sources. Tu n'inventes JAMAIS une date, un nom, un chiffre, une citation.
- Les faits du morceau courant sont la vérité de référence pour parler de ce morceau.
- Les faits globaux de l'émission servent à tenir l'angle, pas à attribuer au morceau courant des détails qui ne le concernent pas.
- Les faits du morceau suivant servent seulement à préparer une transition, sans dévoiler toute son histoire.
- Tu choisis les faits les plus intéressants et inattendus, pas les plus évidents.
- Tu enchaînes les faits comme une histoire qui coule, jamais comme une liste ou une dictée de dates.
- Si tu manques de faits précis, tu restes sobre plutôt que de meubler avec du vide ou du cliché.

LA FLUIDITÉ :
- Des phrases de longueurs variées. Du rythme. Ça doit se dire à voix haute sans accrocher.
- Présent de narration de préférence, mais le naturel prime sur la règle.
- 85 à 115 mots. Ni plus, ni moins — c'est un format radio serré.
- Tu finis sur une phrase qui donne envie d'entendre le morceau.

INTERDIT :
- Répéter un fait, une date ou une formule déjà dits dans une narration précédente (on te les donne).
- Les clichés : iconique, intemporel, captivant, fascinant, incontournable, légendaire, mythique, hymne d'une génération, remarquable, indéniablement, force est de constater.
- Le name-dropping gratuit : un nom n'apparaît que si tu racontes quelque chose avec.`;

export async function generateNarration(
  tracks: SpotifyTrack[],
  angle: string,
  description: string,
  index: number,
  facts: NarrationFacts,
  previousNarrations: string[] = [],
): Promise<string> {
  const currentTrack = tracks[index];
  const nextTrack = tracks[index + 1];

  const context =
    index === 0
      ? `Tu introduis l'émission et le premier morceau : "${currentTrack.title}" de ${currentTrack.artist}.`
      : `Tu viens de diffuser "${tracks[index - 1].title}" de ${tracks[index - 1].artist}. Tu introduis maintenant "${currentTrack.title}" de ${currentTrack.artist}.`;

  const transition = nextTrack
    ? `Amène vers le prochain morceau : "${nextTrack.title}" de ${nextTrack.artist}.`
    : `C'est le dernier morceau. Conclus l'émission.`;

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Angle de l'émission : ${angle}
${description}

${context}
${transition}

Faits globaux de l'émission — à utiliser pour tenir le fil rouge :
${facts.emissionFacts.slice(0, 1500)}

Faits sourcés du morceau courant — priorité absolue pour toute affirmation factuelle :
${facts.currentTrackFacts.slice(0, 3000)}

${
  facts.previousTrackFacts
    ? `Faits du morceau précédent — seulement pour comprendre d'où vient la transition :
${facts.previousTrackFacts.slice(0, 900)}`
    : ""
}

${
  facts.nextTrackFacts
    ? `Faits du morceau suivant — seulement pour amorcer la suite :
${facts.nextTrackFacts.slice(0, 1200)}`
    : ""
}

Playlist complète :
${tracks.map((t, i) => `${i + 1}. ${t.title} — ${t.artist}`).join("\n")}

DÉJÀ RACONTÉ dans les narrations précédentes — ne répète AUCUN de ces faits, apporte du neuf :
${
  previousNarrations.length
    ? previousNarrations
        .map((n, i) => `[Narration ${i + 1}]\n${n}`)
        .join("\n\n")
    : "Rien encore, c'est l'ouverture de l'émission."
}

Écris la narration.`,
      },
    ],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}
