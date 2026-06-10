// Golden-set — le levier le plus puissant de la qualité narration.
// Des règles INSPIRENT ; des exemples DÉCIDENT. Un LLM imite un style à partir
// d'exemples bien mieux qu'à partir de consignes. Ces narrations sont au
// format Sillage exact (transition 85-115 mots), positions et modes variés.
//
// PROVENANCE : exemple Or Noir/Kaaris co-écrit puis validé À L'OREILLE par
// Paul (natif) ; les trois autres forgés par workflow multi-agents (écriture
// + jury « calques de l'anglais / craft / fact-checking »), faits vérifiés en
// ligne. Le golden-set est la spec vivante : on l'enrichit, on ne le dilue pas.
//
// ⚠️ Ces exemples parlent d'AUTRES morceaux. On en vole la VOIX et la
// CONSTRUCTION — jamais les faits. Voir lib/editorial/french.ts pour les
// règles de langue, et la skill sillage-narration pour le métier complet.

interface GoldenExample {
  position: string; // ouverture | milieu | fin
  mode: string; // portrait | mouvement
  context: string; // ce que l'exemple démontre
  text: string;
}

const EXAMPLES: GoldenExample[] = [
  {
    position: "ouverture",
    mode: "portrait",
    context:
      "Ouverture d'épisode, on ancre sur le morceau cliqué (Or Noir de Kaaris). Le fait brut, la vraie citation de l'artiste gardée crue, une chute en révélation (le beat destiné à Booba).",
    text: "Quand Or Noir sort, en octobre 2013, ça fait déjà plus de dix ans que Kaaris rappe. Il vient de Sevran, et c'est son premier vrai album : dix-sept morceaux, un seul producteur, Therapy. La politique, les bons sentiments, il s'en cogne — c'est lui qui le dit. Ce qui l'intéresse, c'est la formule : « shit au gramme, vite on l'crame, tête de mort sur le pictogramme ». Mais le morceau-titre, celui que tu vas entendre, c'est le seul où Kaaris laisse tomber le personnage et parle de lui : son enfance, sa famille. Et le beat, à l'origine, n'était même pas pour lui : il était pour Booba. Booba le lui a laissé, avec une seule consigne : « bousille-le ».",
  },
  {
    position: "milieu",
    mode: "mouvement",
    context:
      "Transition de milieu, mode mouvement : on raconte la SCÈNE (la French Touch versaillaise) par le lieu et la bande. On ne change pas de sujet, on se déplace dans la même ville. Sortie qui pose le morceau qui arrive sans le sur-vendre.",
    text: "On ne bouge pas, on reste à Versailles. Début 98, Air joue Sexy Boy à la télé, sur le plateau de Nulle Part Ailleurs. Derrière eux ce jour-là, les musiciens, c'est une bande de gamins du Chesnay, la commune juste à côté — de parfaits inconnus. Air, leur histoire a commencé au lycée Jules-Ferry. Ces gamins-là, eux, se sont trouvés au collège, puis au lycée Hoche, toujours à Versailles. Leur groupe s'appelle Phoenix. Leur guitariste avait même monté un groupe avec deux gars qui ont fondé Daft Punk dans la foulée. Deux ans après ce plateau, ils sortent leur premier disque, et un single cartonne en Angleterre. Le voilà.",
  },
  {
    position: "milieu",
    mode: "portrait",
    context:
      "Transition de milieu, mode portrait : on ouvre sur l'écart entre les deux titres, un arc chute → renaissance, une consigne d'écoute fondue dans le récit, une chute qui reboucle (les premiers Grammys).",
    text: "Entre ce que tu viens d'entendre et ce qui arrive, il y a onze ans — et une dégringolade. Début 81, Marvin Gaye est à la dérive : ruiné, harcelé par le fisc, rongé par la cocaïne, son deuxième mariage en miettes. Un promoteur de concerts belge, Freddy Cousaert, le ramasse et l'installe chez lui à Ostende. Marvin court sur la plage, lève le pied sur la drogue. C'est là, dans cet appart, qu'il écrit Sexual Healing sur une boîte à rythmes — le battement que tu vas entendre dès que ça démarre. Ce morceau lui vaudra ses premiers Grammys — les premiers, oui : l'homme qui avait fait What's Going On n'en avait jamais gagné un.",
  },
  {
    position: "fin",
    mode: "portrait",
    context:
      "Dernière narration de l'épisode : un did-you-know retenu jusqu'à la fin, le titre lâché à l'avant-dernière phrase, une clôture sans cérémonie (« on se quitte là-dessus ») qui précède directement la musique.",
    text: "Allez, on redescend. Après les dix minutes de Sinnerman, je t'ai gardé le plus léger pour la fin. 1957 : Nina Simone enregistre son premier album. On la paie trois mille dollars, et pas un centime de droits derrière. Dedans, une chansonnette des années trente — elle dira plus tard qu'elle n'a jamais voulu la chanter. Trente ans après, une pub Chanel la passe à la télé anglaise, et ça ressort en single : numéro cinq là-bas, numéro un aux Pays-Bas. Elle, elle ne touche presque rien — tout était vendu. Écoute le piano qui ouvre le morceau, cette petite mécanique de boîte à musique. C'est My Baby Just Cares for Me, et on se quitte là-dessus.",
  },
];

// Bloc few-shot injecté dans le system prompt de narration.ts. STABLE (mêmes
// exemples à chaque appel) → reste dans le cache prompt ephemeral.
export const GOLDEN_SET_FEWSHOT = `EXEMPLES DE NARRATIONS QUI PASSENT — étudie-les comme un mètre-étalon.
Ce sont des transitions Sillage réussies. Vole leur VOIX (orale, sûre, intime), leur CONSTRUCTION (un arc qui avance, une entrée et une chute jamais interchangeables) et leur RETENUE (le fait brut plutôt que l'adjectif, la chute concrète plutôt que le slogan).
⚠️ Ces exemples parlent d'AUTRES morceaux que le tien. N'en réutilise JAMAIS les faits, les noms ni les citations — uniquement la manière. Et ne recopie pas leur structure d'ouverture : chaque narration entre et sort à sa façon.

${EXAMPLES.map(
  (ex, i) =>
    `— Exemple ${i + 1} (${ex.position}, ${ex.mode}) — ${ex.context}\n« ${ex.text} »`,
).join("\n\n")}`;
