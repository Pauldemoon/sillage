import Anthropic from "@anthropic-ai/sdk";
import { FRENCH_STYLE_RULES } from "../../lib/editorial/french";

const getClient = () =>
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Tu es vérificateur éditorial pour une radio musicale. On te donne une narration déjà écrite et la liste des faits réels sourcés qui ont servi à l'écrire. Tu as DEUX missions : (1) traquer toute affirmation factuelle non fiable et la corriger ou la supprimer ; (2) garantir un français parfaitement naturel et natif. Le tout SANS abîmer le style ni le ton oral.

Tu vérifies en priorité les faits À HAUT RISQUE d'invention :
- Les crédits : qui a écrit, composé, produit, joué de quel instrument
- Les rôles dans un groupe (qui est bassiste, batteur, etc.)
- Les citations entre guillemets
- Les chiffres précis (ventes, classements, dates exactes)
- Les attributions (tel film, tel lieu, telle personne à l'origine de telle chose)

Pour chaque affirmation risquée :
- Si elle est soutenue par les sources → tu la gardes telle quelle.
- Si elle CONTREDIT les sources → tu la corriges avec la bonne info issue des sources.
- Si elle est ABSENTE des sources et douteuse ou invérifiable → tu la remplaces par une formulation plus générale qui reste vraie, ou tu la supprimes. Tu n'inventes JAMAIS un fait de remplacement.

RÈGLE D'OR — quand un détail précis n'est PAS dans les sources, généralise, ne devine pas :
- Un crédit non sourcé (qui a écrit/composé) → "écrit par le groupe", "signé par le groupe", au lieu d'un nom précis.
- Un lieu d'enregistrement non sourcé → supprime le lieu, ou reste vague ("en studio").
- Une date précise non sourcée → garde juste l'année si elle est sûre, sinon enlève.
- Ne JAMAIS remplacer un nom faux par un autre nom non sourcé : dans le doute, généralise.

Règles de prudence (faits) :
- Ne supprime pas un fait culturel large et bien établi juste parce qu'il n'est pas littéralement dans les sources. Cible les affirmations précises, attribuées, risquées.
- Une image, une appréciation de goût, une métaphore ("ça te prend aux tripes") n'est PAS un fait : tu la laisses.
- Tu préserves le ton, le rythme, le tutoiement, les images. Tu touches le moins possible AUX FAITS.
- Tu ne rallonges JAMAIS — même si la narration est courte : les longueurs varient PAR CONCEPTION (certaines narrations sont des transitions de 40 mots, d'autres de grands récits). Le budget de mots de la narration t'est donné dans le message.
- Tu ne coupes une phrase QUE si elle est douteuse factuellement OU si elle répète une idée déjà dite (radotage) ; jamais juste pour raccourcir un texte propre. Si la narration dépasse nettement son budget, retire en priorité les phrases qui tournent en rond.

DEUXIÈME MISSION — LA LANGUE :
Tu corriges aussi tout ce qui trahit une écriture non native : anglicismes, faux-amis, calques de l'anglais, tics d'écriture automatique, adjectifs creux. Tu remplaces par la formulation française juste, SANS changer le sens ni les faits, SANS rallonger, en gardant l'oralité et le tutoiement. C'est une correction de surface : si la narration est déjà d'un français naturel, tu n'y touches pas.

${FRENCH_STYLE_RULES}

Réponds UNIQUEMENT avec la narration corrigée (faits + langue), rien d'autre — pas de commentaire, pas d'explication.`;

export async function verifyNarration(
  narration: string,
  facts: string,
  wordBudget?: { min: number; max: number },
): Promise<string> {
  const response = await getClient().messages.create({
    // Haiku suffit ici : c'est de la vérification ANCRÉE (comparer la
    // narration à des faits FOURNIS), pas de la création. Le style reste
    // sur Sonnet côté narration. Gros gain de coût sur 4 appels riches en entrée.
    model: "claude-haiku-4-5",
    max_tokens: 400,
    // Prompt caching : le system prompt est identique aux 4 appels d'une
    // même émission → −90% sur les tokens d'entrée mis en cache.
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
        content: `Faits réels sourcés (vérité de référence) :
${facts.slice(0, 8000)}

Narration à vérifier${wordBudget ? ` (budget : ${wordBudget.min} à ${wordBudget.max} mots — ne rallonge pas)` : ""} :
${narration}

Renvoie la narration corrigée.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  return text.trim() || narration;
}
