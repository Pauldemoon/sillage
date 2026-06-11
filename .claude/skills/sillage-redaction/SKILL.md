---
name: sillage-redaction
description: Le métier de la salle de rédaction de Sillage — trouver les pistes d'émission, les repérer, choisir sur preuves, écrire le conducteur. DÉCLENCHE dès qu'il faut concevoir, juger ou corriger un angle d'émission, une piste, un déroulé ou un conducteur Sillage, ou dès que l'utilisateur dit « le déroulé est nul », « l'angle est tiède », « ça ne raconte rien », « pourquoi ces morceaux ».
---

# Sillage — La salle de rédaction

Le déroulé d'une émission ne s'improvise pas en bout de chaîne : il se **décide avant d'écrire**. La salle de rédaction produit la seule chose qui compte — un voyage documenté qui avance — et les narrations l'exécutent.

> Créée le 2026-06-11 après le verdict de Paul sur l'émission Aquamarine v9 (« déroulé tiède, pas naturel, pas cohérent »). Implémentation : `backend/api/agents/redaction.ts`. Ce document est le maître ; le code distille.

---

## 1 — La chaîne (et pourquoi chaque maillon existe)

1. **Pistes** — neuf propositions en trois familles forcées (3 appels × 3) : un seul appel s'auto-ancre et produit trois variations du même réflexe.
   - **rester** : la lignée, la scène, le studio — la profondeur.
   - **voyager** : la traversée par étapes documentées — la distance justifiée.
   - **contexte** : le moment, le lieu, la bascule dont la graine est un symptôme.
2. **Repérage** — AVANT de choisir : recherches sur le FIL (pas sur un titre) + résolution Spotify des candidats. La matière dit quels voyages sont possibles.
3. **Choix** — la piste la mieux **documentée** gagne, pas la plus séduisante. Une piste brillante sans matière est un piège : elle produira du creux.
4. **Conducteur** — le storyboard : l'ordre des morceaux et son POURQUOI, le pont factuel de chaque étape, la mission de chaque narration, la question plantée à l'ouverture et payée à la fin.
5. **Contrôle des ponts** — chaque pont est une affirmation ; contrôlé contre la matière avant écriture. Douteux = étape éjectée. Mieux vaut une émission plus courte qu'un pont faux.

## 2 — Ce qui fait une bonne piste

- Elle part d'un **fait qui pique** trouvé dans le dossier — jamais d'un thème. « La pop des années 2010 » n'est pas une piste ; « le beat refusé par Booba » en est une.
- Elle contient une **question** dont on veut vraiment la réponse, dicible à un ami en une phrase.
- Elle implique un **voyage qui avance** : chaque morceau est une étape qui apporte du neuf, pas un exemple de plus.
- Elle est **racontable avec des morceaux entiers** (contrainte Spotify : pas d'extraits). Si la démonstration exige d'écouter 10 secondes précises, c'est un article, pas une émission.
- **Test d'élimination** : si la piste sert telle quelle pour un autre artiste du même genre, elle est générique — poubelle.

## 3 — Ce qui fait un bon conducteur

- L'ordre **raconte** : chronologie, géographie, filiation — une progression nommable, pas une collection sur un thème.
- Chaque étape a un **pont factuel** (le fait qui relie au morceau précédent) et une **mission** (ce que la narration révèle là, et nulle part ailleurs).
- La **question** est plantée au lancement sans être résolue, et la dernière étape la **paie** — c'est l'arc qui fait rester jusqu'au bout.
- Moins de morceaux bien reliés > plus de morceaux flous. Un slot sans pont réel saute.
- Les missions les plus riches vont aux étapes qui auront les loupes (cf. l'horloge, skill sillage-narration §1).

## 4 — Les pièges constatés (vécu, pas théorie)

- **L'angle avant la matière** : décider le sujet sur la seule graine puis chercher des morceaux « qui collent » → des ponts inventés après coup (l'erreur du pipeline v9, émission Aquamarine « tiède »).
- **La playlist de mémoire** : demander des titres au modèle sans vérifier les liens → de l'europop « qui ressemble » sans pont réel (Clean Bandit dans une émission MXM).
- **Le concept de conférence** : une piste qui sonne dossier de presse (« une génération refait la pop ») au lieu d'un fait (« deux productrices de 24 ans dans le studio de Max Martin »).
- **Le pont gonflé** : affirmer un lien précis (date, crédit) non soutenu par la matière — il sera dit à l'antenne. C'est pour ça que le contrôle des ponts existe.
- **La même piste à chaque écoute** : la rotation des archétypes déjà servis est obligatoire (`avoidArchetypes`), sinon cliquer deux fois la même graine donne deux fois la même émission.

## 5 — Références du déroulé (ce qu'on copie, ce qu'on ne copie pas)

- **Very Good Trip (Assayas)** : le cadre curatorial assumé (« le concert idéal ») et l'énigme tenue sur toute l'émission. C'est le modèle du couple question/payoff.
- **L'Histoire secrète de la French Touch (France Inter)** : la progression par LIEU (Versailles, épisode entier) — un déroulé géographique qui avance sans jamais le dire.
- **Music Story (Pat Angeli)** : l'arc en quatre temps (chute → genèse → bascule → révélation) — transposé à l'échelle de l'émission : le conducteur EST cet arc, étalé sur 7 morceaux.
- ⚠️ Ne pas copier : leurs durées (compresser fort), leurs extraits audio (morceaux entiers chez nous), le vécu du narrateur (Charlie n'en a pas).

## 6 — Vérification finale d'un conducteur (avant de valider)

1. La question donne-t-elle envie de rester jusqu'au bout — et est-elle PAYÉE à la fin ?
2. Peut-on nommer la progression en un mot (chronologique, géographique, filiation…) ?
3. Chaque pont est-il un FAIT qu'on peut sourcer — ou une ressemblance déguisée ?
4. Chaque mission apporte-t-elle du neuf, ou redit-elle une étape précédente ?
5. Si on retire un morceau, le déroulé boite-t-il ? (Si non, ce morceau était du remplissage.)

## 7 — Le golden set des conducteurs : À CONSTRUIRE

Même méthode que la narration : les conducteurs que Paul juge excellents à l'écoute deviennent les exemples few-shot de `writeConducteur`. Aucun pour l'instant — c'est le verdict d'écoute de Paul qui les sacre, un par un.
