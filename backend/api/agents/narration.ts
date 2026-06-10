import Anthropic from "@anthropic-ai/sdk";
import { SpotifyTrack } from "../../lib/spotify";
import { FRENCH_STYLE_RULES } from "../../lib/editorial/french";
import { GOLDEN_SET_FEWSHOT } from "../../lib/editorial/golden-set";

const getClient = () =>
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface NarrationFacts {
  emissionFacts: string;
  currentTrackFacts: string;
  previousTrackFacts?: string;
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
- Les faits du morceau qui vient de passer servent à amorcer le pont — tu repars d'un détail concret de ce qu'on vient d'entendre, sans le réexpliquer en entier.
- Tu choisis les faits les plus intéressants et inattendus, pas les plus évidents.
- Tu enchaînes les faits comme une histoire qui coule, jamais comme une liste ou une dictée de dates.
- Si tu manques de faits précis, tu restes sobre plutôt que de meubler avec du vide ou du cliché.

LA CONSTRUCTION — un arc, pas une liste :
- Tu racontes UNE histoire qui avance (une chute, une genèse, une bascule, une révélation) — jamais une dictée de noms et de dates.
- Tu choisis DEUX OU TROIS faits forts, pas dix. Mieux vaut un détail qu'on retient que cinq qu'on oublie. Si tu cites un nom, tu en fais quelque chose ; sinon tu le coupes.
- Le fait qui pique, jamais l'adjectif : montre l'émotion par ce qui s'est passé, ne la commente pas.
- Une vraie citation crue de l'artiste vaut mieux qu'une paraphrase polie — si elle est dans les faits.

LA FLUIDITÉ :
- Des phrases de longueurs variées. Du rythme. Ça doit se dire à voix haute sans accrocher.
- Présent de narration de préférence, mais le naturel prime sur la règle.
- Format : environ 130 à 160 mots. Assez pour raconter une vraie histoire, façon "Very Good Trip", mais sans délayer. Chaque phrase fait avancer ; à la moindre phrase qui n'ajoute rien, tu coupes.
- NE TOURNE PAS EN ROND : tu dis chaque idée UNE fois. Tu ne reformules pas un fait déjà donné, tu ne reviens pas sur un point pour le redire autrement, tu ne répètes pas en conclusion ce que tu as déjà raconté. Une narration avance en ligne droite, elle ne fait pas de boucle.

LA CHUTE — obligatoirement CONCRÈTE :
- Tu finis sur une image, une révélation (un « did-you-know » qui récompense) ou une consigne d'écoute sur le morceau qui arrive — quelque chose qu'on peut voir ou entendre.
- JAMAIS un slogan abstrait ni une morale (« la musique n'a jamais été aussi vivante », « marquer une génération », « une œuvre intemporelle »). Si ta dernière phrase pourrait conclure n'importe quelle autre narration, elle est ratée : réécris-la avec un détail de CE morceau.
- Ta dernière phrase doit pouvoir précéder directement la musique.

INTERDIT :
- Répéter un fait, une date ou une formule déjà dits dans une narration précédente (on te les donne).
- Recopier la forme d'ouverture ou de chute d'une narration précédente : chaque narration entre et sort autrement.
- Tout vécu feint : tu n'as rien vécu, tu n'étais nulle part. Jamais « j'ai vu ça naître », « à l'époque ». Ton autorité vient des faits et de la surprise, pas d'une mémoire.
- Toute référence à un extrait isolé : le morceau passe EN ENTIER, ta consigne d'écoute pointe le morceau entier qui arrive.
- Les clichés : iconique, intemporel, captivant, fascinant, incontournable, légendaire, mythique, hymne d'une génération, remarquable, indéniablement, force est de constater.

${GOLDEN_SET_FEWSHOT}

${FRENCH_STYLE_RULES}`;

export async function generateNarration(
  tracks: SpotifyTrack[],
  angle: string,
  description: string,
  index: number,
  facts: NarrationFacts,
  previousNarrations: string[] = [],
): Promise<string> {
  const currentTrack = tracks[index];

  // La narration d'index i passe JUSTE AVANT le morceau i (cf. player.tsx) :
  // c'est le pont entre le morceau qui vient de finir (i-1) et celui qui
  // démarre immédiatement après la voix (i). La chute doit donc atterrir sur
  // CE morceau-ci, pas sur un titre plus loin dans la playlist.
  const context =
    index === 0
      ? `Tu ouvres l'émission. Le tout premier morceau, "${currentTrack.title}" de ${currentTrack.artist}, démarre juste après ta voix. Pose l'angle et donne envie de l'écouter.`
      : `Ta narration est un PONT entre deux morceaux.
- Celui qui vient de se terminer : "${tracks[index - 1].title}" de ${tracks[index - 1].artist}.
- Celui qui démarre IMMÉDIATEMENT après ta voix : "${currentTrack.title}" de ${currentTrack.artist}.
Le pont tient sur un FAIT concret tiré des sources, jamais sur une impression ou un thème vague. Les manières de relier deux titres par un fait sont innombrables — producteur, sample, studio, label, ville, année, instrument, ingénieur du son, reprise, dispute, rencontre, hasard de calendrier, influence directe de l'un sur l'autre… : trouve celle qui colle À CES deux titres-là, et ne reprends pas le même type de lien deux fois de suite dans l'émission. Si aucun fait ne relie vraiment les deux, n'en fabrique pas : embraye franchement sur le fait le plus fort du morceau qui arrive. Écris fluide et vivant, garde la vibe — mais c'est le fait qui porte la phrase, pas l'inverse. Ta toute dernière phrase précède directement "${currentTrack.title}" : elle pointe CE morceau-là.`;

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 400,
    // Prompt caching : system identique aux 4 narrations d'une émission.
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
        content: `Angle de l'émission : ${angle}
${description}

${context}

Faits globaux de l'émission — à utiliser pour tenir le fil rouge :
${facts.emissionFacts.slice(0, 2500)}

Faits sourcés du morceau qui ARRIVE (celui que tu introduis) — priorité absolue pour toute affirmation factuelle :
${facts.currentTrackFacts.slice(0, 6000)}

${
  facts.previousTrackFacts
    ? `Faits du morceau qui VIENT DE PASSER — pour bâtir le pont, repartir d'un détail concret de ce qu'on vient d'entendre (ne le réexplique pas en entier) :
${facts.previousTrackFacts.slice(0, 1500)}`
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
