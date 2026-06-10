// Banque de recettes d'angles — générée depuis angle-recipes.md (source
// humaine) par scripts/gen-recipes.cjs. Ne pas éditer à la main : modifier le
// .md puis régénérer. En module TS plutôt qu'en lecture de fichier au runtime :
// zéro dépendance au cwd en prod.
//
// Une recette est une LENTILLE éditoriale, pas un angle fini : l'agent angle
// l'incarne avec les faits réels de la graine. On n'injecte JAMAIS les 100
// dans un prompt : un tirage aléatoire (~12) par génération suffit et garde
// les angles frais d'une émission à l'autre.

export interface AngleRecipe {
  family: string;
  title: string;
  detail: string;
}

export const ANGLE_RECIPES: AngleRecipe[] = [
  { family: "Les gens de l'ombre", title: "Le sideman de l'ombre", detail: "le musicien de session jamais crédité, retrouvé sur dix tubes sans rapport" },
  { family: "Les gens de l'ombre", title: "Le producteur invisible", detail: "un seul homme derrière cinq nº 1 qu'on n'aurait jamais reliés" },
  { family: "Les gens de l'ombre", title: "L'ingénieur du son qui a tout changé", detail: "celui qui a inventé le son qu'on attribue à l'artiste" },
  { family: "Les gens de l'ombre", title: "La choriste qui portait le tube", detail: "la voix d'arrière-plan qui fait le morceau" },
  { family: "Les gens de l'ombre", title: "L'arrangeur fantôme", detail: "celui qui a écrit la partie qu'on fredonne, sans son nom sur la pochette" },
  { family: "Les gens de l'ombre", title: "Le bassiste qui relie tout", detail: "un instrumentiste comme fil rouge entre des morceaux ennemis" },
  { family: "Les gens de l'ombre", title: "L'homme de l'ombre côté business", detail: "le manager / tourneur qui a fabriqué le mythe" },
  { family: "Les gens de l'ombre", title: "Le featuring oublié", detail: "l'invité non crédité qu'on entend sans le savoir" },
  { family: "Les gens de l'ombre", title: "Le groupe de studio anonyme", detail: "les musiciens maison d'un label sur cent disques (Wrecking Crew, Funk Brothers)" },
  { family: "Les gens de l'ombre", title: "Le remplaçant d'un soir", detail: "celui qui a joué la session à la place du titulaire" },
  { family: "La fabrique", title: "Une nuit, un disque", detail: "enregistré en une session, sans filet" },
  { family: "La fabrique", title: "L'accident de studio", detail: "la panne, l'erreur, l'instrument cassé devenu le son" },
  { family: "La fabrique", title: "Le studio comme personnage", detail: "un lieu (Muscle Shoals, Hansa, Compass Point) qui imprime sa marque" },
  { family: "La fabrique", title: "La première prise", detail: "le morceau gardé tel quel, défauts compris" },
  { family: "La fabrique", title: "Le home-studio avant l'heure", detail: "fait dans une chambre, contre l'industrie" },
  { family: "La fabrique", title: "La technique volée à un autre métier", detail: "un procédé importé d'ailleurs (le mur du son, le sampling)" },
  { family: "La fabrique", title: "Le morceau réenregistré dix fois", detail: "la quête obsessionnelle d'un son" },
  { family: "La fabrique", title: "Le bidouillage qui fait le hook", detail: "un objet, une bande à l'envers, un bruit du quotidien" },
  { family: "La fabrique", title: "La maquette devenue disque", detail: "la démo qu'on n'a jamais réussi à refaire mieux" },
  { family: "La fabrique", title: "Le silence et l'espace", detail: "un morceau défini par ce qu'on n'y a PAS mis" },
  { family: "L'industrie", title: "Le tube né d'une engueulade", detail: "sorti d'un clash, d'une rupture, d'un procès" },
  { family: "L'industrie", title: "Le procès du sample", detail: "la note empruntée qui a coûté une fortune" },
  { family: "L'industrie", title: "Le flop devenu culte", detail: "boudé à sa sortie, sauvé vingt ans plus tard" },
  { family: "L'industrie", title: "Le label qui n'y croyait pas", detail: "sorti à contrecœur, devenu nº 1" },
  { family: "L'industrie", title: "La guerre des versions", detail: "single radio contre version album, qui a gagné" },
  { family: "L'industrie", title: "Le contrat qui a tué l'artiste", detail: "la signature qui l'a ruiné" },
  { family: "L'industrie", title: "Le coup marketing", detail: "la sortie pensée comme une opération (géniale ou cynique)" },
  { family: "L'industrie", title: "Le morceau interdit d'antenne", detail: "censuré, et ce que ça a déclenché" },
  { family: "L'industrie", title: "L'indé contre le major", detail: "un disque fait pour défier l'industrie" },
  { family: "L'industrie", title: "Le bootleg qui a forcé la sortie officielle", detail: "la demande pirate qui précède l'officiel" },
  { family: "Villes & scènes", title: "Deux villes, une guerre", detail: "une scène contre une autre (Detroit/Chicago, Manchester/Londres)" },
  { family: "Villes & scènes", title: "Le son d'un quartier", detail: "un pâté de maisons qui a inventé un genre" },
  { family: "Villes & scènes", title: "L'exil fondateur", detail: "l'artiste qui a fait son meilleur disque loin de chez lui" },
  { family: "Villes & scènes", title: "La scène d'un seul club", detail: "un lieu de nuit comme berceau (le Rex, le Paradise Garage)" },
  { family: "Villes & scènes", title: "La province contre la capitale", detail: "le son venu d'où on ne l'attendait pas" },
  { family: "Villes & scènes", title: "Le malentendu géographique", detail: "un genre nommé d'après une ville qui n'y est pour rien" },
  { family: "Villes & scènes", title: "La diaspora", detail: "un son qui voyage avec ceux qui émigrent" },
  { family: "Villes & scènes", title: "La ville-frontière", detail: "là où deux musiques se rencontrent et fusionnent" },
  { family: "Villes & scènes", title: "Le climat dans le son", detail: "un froid, une chaleur, une lumière qu'on entend" },
  { family: "Villes & scènes", title: "La carte postale truquée", detail: "l'image d'une ville vendue par sa musique vs la réalité" },
  { family: "L'époque", title: "Le moment-bascule", detail: "l'instant précis où la musique change" },
  { family: "L'époque", title: "La réponse à l'actualité", detail: "écrit contre une guerre, une loi, un drame" },
  { family: "L'époque", title: "La technologie qui a tout permis", detail: "un instrument neuf (synthé, boîte à rythmes) qui rebat les cartes" },
  { family: "L'époque", title: "La fin d'une ère", detail: "le disque qui clôt un âge d'or sans le savoir" },
  { family: "L'époque", title: "Le morceau en avance de dix ans", detail: "incompris parce que trop tôt" },
  { family: "L'époque", title: "La nostalgie d'une époque jamais vécue", detail: "un son qui invente un passé" },
  { family: "L'époque", title: "La bande-son d'une génération malgré elle", detail: "adopté par un mouvement qu'il ne visait pas" },
  { family: "L'époque", title: "Le disque-document", detail: "il fige un moment social précis" },
  { family: "L'époque", title: "La rupture politique dans une carrière", detail: "l'artiste qui prend parti et perd (ou gagne)" },
  { family: "L'époque", title: "L'avant / après d'une invention", detail: "le même geste avant et après une rupture technique" },
  { family: "La vie du morceau", title: "Le sample voyageur", detail: "un même break à travers trente ans et cinq genres" },
  { family: "La vie du morceau", title: "La reprise qui a volé l'original", detail: "la version que tout le monde croit la vraie" },
  { family: "La vie du morceau", title: "La face B qui a enterré la face A", detail: "" },
  { family: "La vie du morceau", title: "La seconde vie par le cinéma", detail: "un morceau ressuscité par une scène" },
  { family: "La vie du morceau", title: "La pub qui a tout changé", detail: "relancé par une réclame, pour le meilleur ou le pire" },
  { family: "La vie du morceau", title: "Le morceau qui a engendré un genre", detail: "sa descendance directe" },
  { family: "La vie du morceau", title: "L'interpolation cachée", detail: "une mélodie qui en cite une autre sans le dire" },
  { family: "La vie du morceau", title: "Le mashup avant l'heure", detail: "deux mondes collés bien avant la mode" },
  { family: "La vie du morceau", title: "La version live devenue référence", detail: "quand le concert remplace le studio" },
  { family: "La vie du morceau", title: "La réédition qui a changé de sens", detail: "un remix, un nouveau titre, un nouveau public" },
  { family: "Sang & filiation", title: "La filière familiale", detail: "frères, couples, parents-enfants" },
  { family: "Sang & filiation", title: "La dette cachée", detail: "qui a copié qui, et ne l'a jamais dit" },
  { family: "Sang & filiation", title: "Le mentor et l'élève", detail: "la passation entre deux générations" },
  { family: "Sang & filiation", title: "La rivalité fraternelle", detail: "deux du même sang, deux directions" },
  { family: "Sang & filiation", title: "L'arbre généalogique d'un riff", detail: "une idée transmise de disque en disque" },
  { family: "Sang & filiation", title: "Le disciple qui dépasse le maître", detail: "" },
  { family: "Sang & filiation", title: "La reprise comme hommage filial", detail: "reprendre pour saluer une influence" },
  { family: "Sang & filiation", title: "Le couple à la ville et au studio", detail: "l'amour qui fait (ou défait) la musique" },
  { family: "Sang & filiation", title: "La transmission par accident", detail: "l'influence reçue par un disque trouvé au hasard" },
  { family: "Sang & filiation", title: "Le faux frère", detail: "deux artistes qu'on croit liés et qui ne se sont jamais croisés" },
  { family: "L'envers du mythe", title: "Le mensonge fondateur", detail: "le mythe entretenu par le groupe, et la vraie histoire" },
  { family: "L'envers du mythe", title: "Le morceau que l'artiste détestait", detail: "le tube qu'il a renié, refusé de jouer" },
  { family: "L'envers du mythe", title: "Le malentendu qui a fait le succès", detail: "aimé pour de mauvaises raisons" },
  { family: "L'envers du mythe", title: "Le titre qu'on a tous mal compris", detail: "le sens réel des paroles" },
  { family: "L'envers du mythe", title: "Le succès qui a brisé l'artiste", detail: "le tube comme malédiction" },
  { family: "L'envers du mythe", title: "L'imposture assumée", detail: "un personnage, un faux nom, une légende inventée" },
  { family: "L'envers du mythe", title: "Le secret de fabrication", detail: "ce que le groupe n'a jamais voulu avouer" },
  { family: "L'envers du mythe", title: "Écrit sur commande, devenu intime", detail: "l'inverse de ce qu'on croit" },
  { family: "L'envers du mythe", title: "La brouille effacée des récits", detail: "ce que l'histoire officielle a gommé" },
  { family: "L'envers du mythe", title: "Le sample qu'on n'a jamais repéré", detail: "l'emprunt resté invisible" },
  { family: "Le geste & le son", title: "L'instrument qui ne devait pas être là", detail: "un son d'un autre monde (Moog dans la soul, sitar dans la pop)" },
  { family: "Le geste & le son", title: "Le riff qui tient tout", detail: "une seule idée musicale comme colonne vertébrale" },
  { family: "Le geste & le son", title: "La voix-instrument", detail: "un chant traité jusqu'à devenir machine (vocoder, talkbox)" },
  { family: "Le geste & le son", title: "Le rythme volé à une danse", detail: "un groove importé d'un pas précis" },
  { family: "Le geste & le son", title: "La basse qui mène la danse", detail: "le low-end comme vrai chef d'orchestre" },
  { family: "Le geste & le son", title: "Le son d'une seule machine", detail: "un appareil qui définit un genre (TB-303, TR-808)" },
  { family: "Le geste & le son", title: "La dissonance assumée", detail: "la fausse note qui est un choix" },
  { family: "Le geste & le son", title: "La montée", detail: "un morceau construit comme une seule tension" },
  { family: "Le geste & le son", title: "Le hook non-verbal", detail: "un « ah », un sifflement, un cri qu'on retient mieux que les paroles" },
  { family: "Le geste & le son", title: "Le tempo qui raconte", detail: "une vitesse qui porte tout le sens" },
  { family: "La rupture & la fin", title: "Le dernier enregistrement", detail: "gravé juste avant la fin (mort, split, silence)" },
  { family: "La rupture & la fin", title: "Le disque de la séparation", detail: "fait pendant que le groupe explose" },
  { family: "La rupture & la fin", title: "Le retour impossible", detail: "le comeback qui ne devait pas marcher" },
  { family: "La rupture & la fin", title: "Le testament involontaire", detail: "un morceau qui prend tout son sens après coup" },
  { family: "La rupture & la fin", title: "Le projet éclair", detail: "un seul disque, puis plus rien" },
  { family: "La rupture & la fin", title: "La reformation qui a tout gâché (ou tout sauvé)", detail: "" },
  { family: "La rupture & la fin", title: "Le morceau posthume", detail: "terminé par d'autres après la mort" },
  { family: "La rupture & la fin", title: "L'adieu déguisé", detail: "une chanson qui dit au revoir sans le dire" },
  { family: "La rupture & la fin", title: "La carrière en une chanson", detail: "l'artiste réduit (injustement) à un seul titre" },
  { family: "La rupture & la fin", title: "Le silence d'après", detail: "ce que l'artiste a fait (ou pas) quand la musique s'est arrêtée" },
];

// Tirage aléatoire sans remise (Fisher-Yates) : la variété vient du tirage,
// la pertinence vient du choix laissé à l'agent parmi les tirées.
export function sampleRecipes(n = 12): AngleRecipe[] {
  const shuffled = [...ANGLE_RECIPES];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

export function formatRecipes(recipes: AngleRecipe[]): string {
  return recipes
    .map((r) => `- ${r.title} (${r.family}) : ${r.detail}`)
    .join("\n");
}
