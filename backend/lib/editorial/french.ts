// Garde-fous de langue partagés par tous les agents qui écrivent du français
// destiné à l'auditeur (angle, narration, éditeur) et par le vérificateur.
// Objectif : un français d'éditeur natif (FIP / Nova), jamais une traduction
// de l'anglais, jamais un texte qui "sonne IA".
//
// Registre : la narration est ORALE et chaleureuse. Le tutoiement, le "on",
// les élisions et le parler naturel sont les bienvenus. Ce qu'on bannit, ce
// n'est pas l'oralité — c'est l'anglicisme, le faux-ami, le calque et le tic
// d'écriture automatique.

export const FRENCH_STYLE_RULES = `RÈGLES DE LANGUE — FRANÇAIS NATUREL (impératives) :
Tu écris dans un français d'éditeur dont c'est la langue maternelle. Jamais une traduction de l'anglais, jamais un texte qui sonne "généré par une machine". Le ton peut rester oral et chaleureux (tutoiement, "on", élisions naturelles) ; ce qui est interdit, c'est ce qui suit.

1) AUCUN calque syntaxique de l'anglais :
- "faire du sens" → "avoir du sens", "être cohérent"
- "être en charge de" → "être responsable de", "s'occuper de"
- "sous contrôle" → "maîtrisé"
- "adresser un problème / un sujet" → "traiter", "aborder"
- "supporter" un artiste / un groupe → "soutenir"
- "baser sur" → "reposer sur", "fonder sur"
- "au final" → "finalement", "au bout du compte"
- "définitivement" (pour insister) → "vraiment", "sans aucun doute"

2) AUCUN faux-ami :
- "réaliser" (= comprendre) → "se rendre compte", "saisir"
- "actuellement" / "actually" (= en fait) → "en réalité", "en fait"
- "éventuellement" / "eventually" (= à terme) → "finalement", "à terme"
- "versatile" → "polyvalent"
- "dramatiquement" → "radicalement", "brutalement"
- "digital" → "numérique"
- "opportunité" (simple occasion) → "occasion"

3) AUCUN anglicisme lexical inutile :
- "implémenter" → "mettre en place"
- "impacter" → "marquer", "bouleverser", "toucher"
- garde EN ANGLAIS les titres de morceaux, d'albums et les noms de groupes : on ne les traduit JAMAIS ("Be My Baby" reste "Be My Baby").

4) AUCUN tic d'écriture automatique (signature IA) :
- pas d'ouverture passe-partout : "il est important de noter que", "il convient de souligner", "force est de constater", "dans un paysage en constante évolution", "au cœur de", "plonger dans", "tirer parti de", "à l'ère de".
- pas d'ouvertures symétriques en série : "cela signifie que", "un autre élément clé", "cela met en évidence".
- pas de connecteurs scolaires en tête de chaque phrase ("de plus", "en outre", "par ailleurs", "en effet" à la chaîne).

5) AUCUN adjectif creux ni hyperbole vide :
- bannis : "robuste", "puissant", "incontournable", "résolument", "véritablement", "à couper le souffle", "unique en son genre", "riche" (vague), "fascinant", "captivant", "iconique", "intemporel", "légendaire", "mythique".
- à la place : un fait concret, une image précise, une date, un geste musical réel.

6) RYTHME HUMAIN :
- alterne des phrases très courtes (5 à 10 mots) et des phrases plus longues et articulées. Évite le rythme régulier et prévisible.
- une affirmation tranchée vaut mieux qu'une précaution oratoire. Assume ton point de vue.

TEST FINAL : si une phrase sonne traduite, vague ou écrite par une machine, réécris-la jusqu'à ce qu'un francophone natif la dise spontanément.`;

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
