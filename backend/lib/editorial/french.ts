// Garde-fous de langue partagés par tous les agents qui écrivent du français
// destiné à l'auditeur (angle, narration, éditeur). Objectif : un français
// d'éditeur natif (FIP / Nova), jamais une traduction de l'anglais.

export const FRENCH_STYLE_RULES = `RÈGLES DE LANGUE (impératives) :
- Tu écris dans un français naturel d'éditeur dont c'est la langue maternelle, comme à FIP ou Nova. Jamais une traduction de l'anglais.
- INTERDIT les calques de l'anglais et les traductions littérales d'expressions ou de titres. Le titre d'un morceau ("Be My Baby", "Just Like Honey") reste EN ANGLAIS et ne se traduit jamais.
- INTERDIT les métaphores creuses et le sous-titre poétique qui ne veut rien dire ("le battement qui traverse le siècle", "un voyage à travers le temps", "l'écho de l'éternité", "au cœur de l'émotion"). Chaque mot doit porter un sens concret et vérifiable.
- Préfère le concret au décoratif : un lieu, une date, un nom, un geste musical réels valent mieux qu'une image vague.
- Une phrase doit être comprise par un francophone sans contexte. Si elle sonne traduite ou nébuleuse, réécris-la.`;

// Règles spécifiques au TITRE d'émission : c'est le texte le plus visible.
export const FRENCH_TITLE_RULES = `RÈGLES DU TITRE :
- Le titre sonne comme un vrai titre d'émission radio française : court, idiomatique, qui veut dire quelque chose de précis.
- Évite la formule paresseuse "Titre anglais : sous-titre poétique" — surtout quand le sous-titre est vague.
- Pas de calque, pas de métaphore décorative vide. Un titre concret et un peu inattendu vaut mieux qu'une jolie phrase floue.

EXEMPLES :
- MAUVAIS : "Be My Baby : Le battement qui traverse le siècle" (sous-titre creux, ton traduit)
- BON : "Le mur du son, de Phil Spector aux Jesus and Mary Chain"
- MAUVAIS : "Just Like Honey : Un voyage sucré dans le shoegaze"
- BON : "Quand le bruit blanc est devenu une caresse"`;
