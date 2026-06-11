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

export async function proposePistes(
  title: string,
  artist: string,
  facts: string,
  avoidArchetypes: string[] = [],
  knownCandidates: { title: string; artist: string }[] = [],
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

Pour chaque piste tu donnes :
- "archetype" : une clé de la palette ci-dessous (trois pistes = trois archétypes différents)
- "enonce" : la phrase que l'animateur dirait pour annoncer le sujet (règles plus bas)
- "description" : le fil rouge en une phrase
- "candidats" : 8 à 10 morceaux qui pourraient jalonner ce voyage. Pour CHACUN, "lien" = le lien CONCRET affirmé avec le fil (producteur commun, sample, label, influence, scène, date…). Pas de morceau « qui ressemble » : un morceau sans lien nommable ne se propose pas. Le morceau de départ n'est PAS dans les candidats (il ouvre toujours).
- "requetes" : 2 recherches web (en français ou anglais) qui permettraient de DOCUMENTER ce fil (vérifier les liens, trouver les anecdotes).

Les trois pistes doivent être réellement différentes : pas trois variations du même sujet. Au moins une piste doit oser un vrai VOYAGE (une traversée par étapes documentées — chaque morceau est le pont vers le suivant), pas seulement « la scène de la graine ».
Les liens des candidats doivent être plausibles et vérifiables — au repérage, un lien faux élimine le candidat, une piste pleine de liens faux meurt. Ne gonfle rien.

Palette d'archétypes :
${palette}

${FRENCH_SUBJECT_RULES}

${FRENCH_STYLE_RULES}

Réponds UNIQUEMENT en JSON valide, sans markdown :
{"pistes": [{"archetype": "…", "enonce": "…", "description": "…", "candidats": [{"title": "…", "artist": "…", "lien": "…"}], "requetes": ["…", "…"]}]}`,
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
    system: `Tu es rédacteur en chef. Trois pistes d'émission ont été repérées : pour chacune tu vois la matière documentaire RÉELLEMENT trouvée et les morceaux RÉELLEMENT disponibles. Tu choisis la piste qui fera la meilleure émission, sur ces critères dans l'ordre :
1. La RICHESSE DOCUMENTÉE : des faits précis, des anecdotes, des citations trouvées au repérage — pas la séduction du concept.
2. Le VOYAGE : assez de morceaux disponibles (7 minimum) avec des liens vérifiés entre eux, qui permettent un déroulé qui avance.
3. La SURPRISE : à concept égal, la piste la moins attendue.

Réponds UNIQUEMENT en JSON : {"choix": <index 0, 1 ou 2>, "raison": "une phrase"}`,
    messages: [
      {
        role: "user",
        content: `Graine : "${title}" de ${artist}

${reperages
  .map(
    (r, i) => `=== PISTE ${i} — ${r.piste.enonce}
Fil : ${r.piste.description}
Morceaux disponibles (${r.resolved.length}) : ${r.resolved.map((x) => `${x.track.title} — ${x.track.artist} (lien : ${x.candidate.lien})`).join(" | ") || "AUCUN"}
Matière trouvée au repérage (${r.matter.length} car.) :
${r.matter.slice(0, 2500) || "(rien)"}`,
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
