// L'horloge de l'émission — le rythme d'une vraie radio.
//
// Avant : toutes les narrations visaient 130-160 mots, soit quatre monologues
// d'une minute de poids identique. Aucune émission réelle ne fait ça : un
// animateur alterne le lien de quinze secondes et la grande histoire. C'est
// l'uniformité qui sonnait « pas naturel », plus que la plume.
//
// Chaque narration reçoit donc un RÔLE avec un budget de mots et une consigne
// propre. Le gabarit suit la référence éditoriale du projet
// (intro → fil → loupe → sortie, cf. mémoire charlie-transitions-radio) :
// - lancement : pose l'angle, peut planter une question payée à la fin
// - lien      : transition courte — un fait, une bascule, le titre
// - loupe     : LA grande histoire de l'épisode, une seule
// - sortie    : le payoff, l'au-revoir, la graine d'un prochain voyage

export type NarrationRole = "lancement" | "lien" | "loupe" | "sortie";

export interface PacingSlot {
  role: NarrationRole;
  minWords: number;
  maxWords: number;
  brief: string;
}

const BRIEFS: Record<NarrationRole, Omit<PacingSlot, "role">> = {
  lancement: {
    minWords: 90,
    maxWords: 130,
    brief:
      "RÔLE : LANCEMENT (90 à 130 mots). Tu ouvres l'émission éditoriale : pose l'angle en l'incarnant dans le morceau qui arrive, donne le ton du voyage. Si l'angle s'y prête, plante UNE question ou une promesse concrète qui sera payée en fin d'émission (« d'ici la fin, tu sauras pourquoi… ») — sans la résoudre maintenant.",
  },
  lien: {
    minWords: 35,
    maxWords: 60,
    brief:
      "RÔLE : LIEN (35 à 60 mots, c'est COURT et c'est voulu). La transition de vraie radio : UN seul fait sourcé qui relie le titre fini au titre qui arrive, la bascule, et on y est. Pas d'histoire développée, pas de deuxième fait, pas de contexte biographique. Si ton texte dépasse 60 mots, coupe.",
  },
  loupe: {
    minWords: 130,
    maxWords: 170,
    brief:
      "RÔLE : LOUPE (130 à 170 mots). C'est LA grande histoire de l'émission, le sommet : prends le temps d'un vrai récit avec un arc (chute, genèse, bascule, révélation) autour du morceau qui arrive. C'est la seule narration longue de l'épisode — elle doit le mériter.",
  },
  sortie: {
    minWords: 70,
    maxWords: 110,
    brief:
      "RÔLE : SORTIE (70 à 110 mots). Dernière narration de l'émission. Une vraie révélation-payoff sur le morceau qui arrive (et si une question a été plantée au lancement, c'est ici qu'on la paie). Puis un au-revoir sans cérémonie, dans la confidence. Enfin, UNE graine pour un prochain voyage : une phrase de disquaire (« un jour, lance-moi sur X : … ») ancrée sur un fait réel du dossier qui relie X à l'épisode — jamais un ton promotionnel.",
  },
};

function rolesFor(slotCount: number): NarrationRole[] {
  if (slotCount <= 0) return [];
  if (slotCount === 1) return ["lancement"];
  if (slotCount === 2) return ["lancement", "sortie"];
  if (slotCount === 3) return ["lancement", "loupe", "sortie"];
  // 4 et plus : une seule loupe au centre, des liens autour.
  const middle: NarrationRole[] = Array(slotCount - 2).fill("lien");
  middle[Math.floor((middle.length - 1) / 2)] = "loupe";
  return ["lancement", ...middle, "sortie"];
}

export function planPacing(slotCount: number): PacingSlot[] {
  return rolesFor(slotCount).map((role) => ({ role, ...BRIEFS[role] }));
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
