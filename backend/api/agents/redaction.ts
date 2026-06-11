import Anthropic from "@anthropic-ai/sdk";
import type { SpotifyTrack } from "../../lib/spotify";
import { FRENCH_STYLE_RULES, FRENCH_SUBJECT_RULES } from "../../lib/editorial/french";
import { ARCHETYPES } from "./angle";

const getClient = () =>
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ---------------------------------------------------------------------------
// La SALLE DE RÉDACTION — remplace le couple « un angle décidé sur la seule
// graine » + « une playlist de mémoire ». Trois étapes :
//   1. proposePistes  : TROIS pistes d'angle tirées des faits, avec candidats
//                       et requêtes de repérage.
//   2. (le repérage tourne dans generate.ts : recherches + résolution Spotify)
//   3. choosePiste    : le jury choisit la piste la MIEUX DOCUMENTÉE, pas la
//                       plus séduisante sur le papier.
//   4. writeConducteur: le déroulé de l'émission écrit AVANT les narrations —
//                       quel morceau à quelle place et pourquoi, ce que chaque
//                       transition révèle, la question plantée et son payoff.
// ---------------------------------------------------------------------------

export interface PisteCandidate {
  title: string;
  artist: string;
  lien: string; // le lien AFFIRMÉ avec le fil (à vérifier au repérage)
}

export interface Piste {
  archetype: string;
  enonce: string;
  description: string;
  candidats: PisteCandidate[];
  requetes: string[]; // recherches de repérage pour documenter le fil
}

function parseJson<T>(raw: string): T {
  return JSON.parse(
    raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim(),
  ) as T;
}

// Deux familles de pistes, demandées par deux appels parallèles : un seul
// appel s'auto-ancre et produit trois variations du même réflexe. En forçant
// une famille « rester » et une famille « voyager », la diversité est
// structurelle.
export type PisteFlavor = "rester" | "voyager" | "contexte";

const FLAVOR_BRIEFS: Record<PisteFlavor, string> = {
  rester:
    "Tes pistes RESTENT dans le monde de la graine : la lignée, la scène, l'époque, le label, le studio — la profondeur plutôt que la distance. Trois manières différentes de creuser CHEZ elle.",
  voyager:
    "Tes pistes OSENT le voyage : une traversée par étapes documentées (chaîne de samples, filiation de producteurs, migration d'un son d'un pays à l'autre), un aller-retour vers une scène étrangère qui éclaire la graine. La distance est permise — à condition que CHAQUE étape soit un pont factuel. Trois voyages différents.",
  contexte:
    "Tes pistes racontent le MOMENT : l'année, le lieu, la bascule culturelle ou technologique dont la graine est un symptôme (une ville à un instant précis, une invention qui change le son, un événement que la musique traverse). La graine est la porte d'entrée d'une époque — les morceaux sont les témoins. Trois moments différents.",
};

// La doctrine de la piste — distillée de la skill sillage-redaction (le
// maître-document, .claude/skills/sillage-redaction). Remplace l'ancienne
// banque de 100 recettes auto-générées.
const PISTE_DOCTRINE = `CE QUI FAIT UNE BONNE PISTE (doctrine maison) :
- Elle part d'un FAIT qui pique trouvé dans le dossier — jamais d'un thème (« la pop des années 2010 » n'est pas une piste, « le beat refusé par Booba » en est une).
- Elle contient une QUESTION à laquelle l'émission répond — quelque chose qu'on a vraiment envie de savoir, dicible à un ami en une phrase.
- Elle implique un VOYAGE qui avance : chaque morceau est une étape qui apporte du neuf, pas un exemple de plus du même point.
- Elle est RACONTABLE avec des morceaux entiers : si la démonstration exige d'écouter 10 secondes précises, c'est une piste d'article, pas d'émission.
- Test d'élimination : si la piste pourrait servir telle quelle pour un AUTRE artiste du même genre, elle est trop générique — jette-la.`;

export async function proposePistes(
  title: string,
  artist: string,
  facts: string,
  avoidArchetypes: string[] = [],
  knownCandidates: { title: string; artist: string }[] = [],
  flavor: PisteFlavor = "rester",
): Promise<Piste[]> {
  const palette = Object.entries(ARCHETYPES)
    .map(([key, label]) => `- ${key} : ${label}`)
    .join("\n");

  const avoidNote = avoidArchetypes.length
    ? `\nL'auditeur a déjà eu des émissions sur cette graine avec ces archétypes : ${avoidArchetypes.join(", ")} — propose des pistes DIFFÉRENTES.`
    : "";

  const poolNote = knownCandidates.length
    ? `\nMorceaux déjà validés pour cette graine (existent sur Spotify) — réutilisables si un fil les justifie :\n${knownCandidates.map((c) => `- ${c.title} — ${c.artist}`).join("\n")}`
    : "";

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4000,
    system: `Tu es rédacteur en chef d'une radio musicale (esprit FIP/Nova). À partir d'un morceau de départ et de faits sourcés, tu proposes TROIS PISTES d'émission distinctes — pas une. Une piste = un voyage possible de 7-8 morceaux.

TA FAMILLE DE PISTES : ${FLAVOR_BRIEFS[flavor]}

${PISTE_DOCTRINE}

Pour chaque piste tu donnes :
- "archetype" : une clé de la palette ci-dessous (trois pistes = trois archétypes différents)
- "enonce" : la phrase que l'animateur dirait pour annoncer le sujet (règles plus bas)
- "description" : le fil rouge en une phrase
- "candidats" : 8 à 10 morceaux qui pourraient jalonner ce voyage. Pour CHACUN, "lien" = le lien CONCRET affirmé avec le fil (producteur commun, sample, label, influence, scène, date…). Pas de morceau « qui ressemble » : un morceau sans lien nommable ne se propose pas. Le morceau de départ n'est PAS dans les candidats (il ouvre toujours).
- "requetes" : 3 recherches web (en français ou anglais) qui permettraient de DOCUMENTER ce fil (vérifier les liens, trouver les anecdotes).

Les trois pistes doivent être réellement différentes : pas trois variations du même sujet.
Les liens des candidats doivent être plausibles et vérifiables — au repérage, un lien faux élimine le candidat, une piste pleine de liens faux meurt. Ne gonfle rien.

Palette d'archétypes :
${palette}

${FRENCH_SUBJECT_RULES}

${FRENCH_STYLE_RULES}

Réponds UNIQUEMENT en JSON valide, sans markdown :
{"pistes": [{"archetype": "…", "enonce": "…", "description": "…", "candidats": [{"title": "…", "artist": "…", "lien": "…"}], "requetes": ["…", "…", "…"]}]}`,
    messages: [
      {
        role: "user",
        content: `Morceau de départ : "${title}" de ${artist}

Faits sourcés sur la graine :
${facts.slice(0, 7000)}${avoidNote}${poolNote}

Propose les trois pistes.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const parsed = parseJson<{ pistes?: Piste[] }>(text);
  return (parsed.pistes || []).slice(0, 3);
}

export interface Reperage {
  piste: Piste;
  flavor?: PisteFlavor;
  matter: string; // matière trouvée au repérage (extraits concaténés)
  resolved: { candidate: PisteCandidate; track: SpotifyTrack }[];
}

export async function choosePiste(
  title: string,
  artist: string,
  reperages: Reperage[],
): Promise<number> {
  const response = await getClient().messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 500,
    system: `Tu es rédacteur en chef. Plusieurs pistes d'émission ont été repérées : pour chacune tu vois ses MÉTRIQUES (morceaux réellement disponibles, volume de matière documentaire trouvée) et la matière elle-même. Tu choisis la piste qui fera la meilleure émission, sur ces critères dans l'ordre :
1. La RICHESSE DOCUMENTÉE : des faits précis, des anecdotes, des citations trouvées au repérage — pas la séduction du concept. Une piste séduisante sans matière est un piège : élimine-la.
2. Le VOYAGE : assez de morceaux disponibles (6 minimum) avec des liens vérifiés entre eux, qui permettent un déroulé qui AVANCE — une progression, pas une collection.
3. La SURPRISE : à richesse égale, la piste la moins attendue gagne.

Réponds UNIQUEMENT en JSON : {"choix": <index de la piste>, "raison": "une phrase"}`,
    messages: [
      {
        role: "user",
        content: `Graine : "${title}" de ${artist}
${reperages.length} pistes repérées (index 0 à ${reperages.length - 1}).

${reperages
  .map(
    (r, i) => `=== PISTE ${i} [famille ${r.flavor ?? "?"}] — ${r.piste.enonce}
Fil : ${r.piste.description}
MÉTRIQUES : ${r.resolved.length} morceaux disponibles | ${r.matter.length} car. de matière
Morceaux : ${r.resolved.map((x) => `${x.track.title} — ${x.track.artist} (lien : ${x.candidate.lien})`).join(" | ") || "AUCUN"}
Matière (extrait) :
${r.matter.slice(0, 1800) || "(rien)"}`,
  )
  .join("\n\n")}

Choisis.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const parsed = parseJson<{ choix?: number; raison?: string }>(text);
    const idx = Number(parsed.choix);
    if (parsed.raison) console.log(`Rédaction — choix piste ${idx} : ${parsed.raison}`);
    return idx >= 0 && idx < reperages.length ? idx : 0;
  } catch {
    return 0;
  }
}

export interface ConducteurSlot {
  title: string;
  artist: string;
  pont: string; // le fait qui relie au morceau précédent
  mission: string; // ce que la narration doit révéler / faire avancer
}

export interface Conducteur {
  enonce: string;
  description: string;
  question: string; // la question plantée au lancement, payée à la fin
  slots: ConducteurSlot[]; // dans l'ordre de diffusion, APRÈS la graine
}

export async function writeConducteur(
  seed: SpotifyTrack,
  reperage: Reperage,
  seedFacts: string,
): Promise<Conducteur | null> {
  const available = reperage.resolved
    .map(
      (x, i) =>
        `${i + 1}. ${x.track.title} — ${x.track.artist} (lien affirmé : ${x.candidate.lien})`,
    )
    .join("\n");

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 3500,
    system: `Tu es réalisateur d'une émission de radio musicale. On te donne un fil rouge documenté et des morceaux disponibles. Tu écris le CONDUCTEUR : le déroulé de l'émission, AVANT que les narrations soient écrites. C'est le storyboard — c'est lui qui décide si l'émission est cohérente et si elle avance.

RÈGLES DU DÉROULÉ :
- Le morceau de départ ouvre toujours (il est donné, ne le replace pas).
- Choisis et ORDONNE 6 à 7 morceaux parmi les disponibles — uniquement ceux dont le lien sert vraiment le fil. Moins de morceaux bien reliés > plus de morceaux flous. Jamais deux fois le même artiste.
- L'ordre raconte une HISTOIRE qui avance : chaque morceau est une étape, pas un exemple de plus. Une vraie progression (chronologique, géographique, de filiation… au choix) — pas une liste de morceaux « sur le thème ».
- "question" : la question concrète plantée en début d'émission et PAYÉE à la fin (le dernier slot doit contenir la réponse dans sa mission).
- Pour chaque slot : "pont" = LE fait concret qui relie ce morceau au précédent (c'est la transition que la narration devra raconter — s'il n'y a pas de fait, le morceau ne se place pas là) ; "mission" = ce que la narration doit révéler à cette étape (un fait précis, une bascule du récit — jamais « parler de X »).
- Les missions ne se répètent pas : chaque étape apporte du NEUF vers la question.
- L'horloge de l'émission (tu n'as pas à la gérer, mais sache-la) : la 1re narration pose le sujet, deux étapes auront droit à un grand récit, les autres seront des transitions courtes — donc mets les missions les plus riches aux étapes 2-3 et 4-5.

${FRENCH_STYLE_RULES}

Réponds UNIQUEMENT en JSON valide, sans markdown :
{"enonce": "…", "description": "…", "question": "…", "slots": [{"title": "…", "artist": "…", "pont": "…", "mission": "…"}]}`,
    messages: [
      {
        role: "user",
        content: `Morceau de départ (ouvre l'émission) : "${seed.title}" de ${seed.artist}

Fil rouge choisi : ${reperage.piste.enonce}
${reperage.piste.description}

Morceaux disponibles (vérifiés sur Spotify) :
${available}

Faits sur la graine :
${seedFacts.slice(0, 3000)}

Matière du repérage :
${reperage.matter.slice(0, 5000)}

Écris le conducteur.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const parsed = parseJson<Conducteur>(text);
    if (!Array.isArray(parsed.slots) || parsed.slots.length < 2) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Contrôle du conducteur : chaque pont est une AFFIRMATION — s'il est faux,
// toutes les narrations en aval héritent de l'erreur. On vérifie chaque pont
// contre la matière du repérage AVANT d'écrire quoi que ce soit. Un pont
// contredit ou risqué-invérifiable éjecte son slot (le déroulé se resserre,
// il ne ment pas). Fail-open : si le contrôleur tombe, on garde tout.
export async function verifyConducteur(
  conducteur: Conducteur,
  reperage: Reperage,
): Promise<Conducteur> {
  try {
    const response = await getClient().messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 800,
      system: `Tu es vérificateur éditorial. On te donne le conducteur d'une émission musicale : une suite d'étapes dont chacune affirme un PONT factuel (ce qui relie un morceau au précédent). Tu juges chaque pont contre la matière documentaire fournie et la connaissance solidement établie :
- "soutenu" : la matière le confirme, ou c'est un fait culturel large et incontesté.
- "plausible" : non confirmé par la matière mais cohérent et peu risqué (pas de date précise, pas de chiffre, pas d'attribution pointue).
- "douteux" : contredit par la matière, OU affirmation précise et risquée (date exacte, crédit pointu, citation) qu'aucune source ne soutient.

Sois exigeant sur les ponts "douteux" : mieux vaut une émission plus courte qu'un pont faux à l'antenne.

Réponds UNIQUEMENT en JSON : {"verdicts": ["soutenu"|"plausible"|"douteux", …]} — un par étape, dans l'ordre.`,
      messages: [
        {
          role: "user",
          content: `Ponts du conducteur, dans l'ordre :
${conducteur.slots.map((s, i) => `${i + 1}. [avant « ${s.title} » de ${s.artist}] ${s.pont}`).join("\n")}

Matière documentaire du repérage :
${reperage.matter.slice(0, 6000) || "(aucune)"}

Liens affirmés aux candidats :
${reperage.resolved.map((x) => `- ${x.track.title} — ${x.track.artist} : ${x.candidate.lien}`).join("\n")}

Renvoie les verdicts.`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = parseJson<{ verdicts?: string[] }>(text);
    const verdicts = parsed.verdicts || [];
    if (verdicts.length !== conducteur.slots.length) return conducteur;

    const kept = conducteur.slots.filter((_, i) => verdicts[i] !== "douteux");
    const dropped = conducteur.slots.length - kept.length;
    if (dropped > 0) {
      console.log(
        `Conducteur : ${dropped} étape(s) au pont douteux éjectée(s)`,
      );
    }
    // En dessous de 3 étapes le déroulé ne tient plus : on garde l'original
    // (les garde-fous narration/verify restent en aval).
    if (kept.length < 3) return conducteur;
    return { ...conducteur, slots: kept };
  } catch {
    return conducteur;
  }
}
