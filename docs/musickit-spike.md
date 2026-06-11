# Spike MusicKit — passage Apple Music (phase 2)

Décision Paul (2026-06-11) : abandonner Spotify (cap 5 testeurs, policy anti-overlay)
et passer la lecture sur Apple Music / MusicKit. Ce document = résultats du spike
de faisabilité, architecture cible, et ce qui reste à vérifier sur appareil.

## Résultats de recherche (2026-06-11)

### 1. Conditions d'usage — NETTEMENT plus sûres que Spotify
- Aucune clause équivalente à l'interdit Spotify « ne pas superposer/mixer de
  l'audio avec le contenu » dans les guidelines MusicKit publiques.
- Contraintes réelles : ne pas monétiser l'accès à Apple Music ; métadonnées et
  pochettes uniquement dans le contexte de lecture ; licences sync nécessaires
  seulement pour du contenu PRODUIT/exporté (pas notre cas : lecture live).
- Pas de plafond de testeurs : tout abonné Apple Music peut utiliser l'app.
  TestFlight externe : jusqu'à 10 000 testeurs.
- Sources : developer.apple.com/musickit, Apple Music API docs, forums dev.

### 2. Lecture — une très bonne surprise et un point dur
- ✅ **Crossfade NATIF entre morceaux** (WWDC 2024) :
  `ApplicationMusicPlayer.shared.transition = .crossfade(duration: N)`.
  Le geste impossible avec Spotify est une PROPRIÉTÉ chez Apple.
- ✅ Position/durée exactes, événements d'état, file de lecture (queue) :
  fin du polling estimé de l'état (waitForTrackEnd disparaît).
- ⚠️ **POINT DUR — le ducking** : `ApplicationMusicPlayer` n'expose PAS de
  volume par lecteur, et des rapports (GitHub audioplayers #1496, forums Apple)
  indiquent que `duckOthers` ne baisse PAS la sortie d'ApplicationMusicPlayer
  depuis sa PROPRE app. → Le modèle Spotify « voix sur outro duckée » ne
  transfère peut-être pas tel quel. À VÉRIFIER SUR APPAREIL (un seul rapport
  ferme ; le comportement réel peut différer selon iOS).
- Plan B si le ducking échoue : **alternance habillée** — le morceau se termine
  (ou crossfade), Charlie parle sur le LIT MUSICAL (qu'on contrôle à 100 %),
  le morceau suivant démarre. Jamais de blanc grâce au lit. Le montage de
  référence de Paul dira si ce modèle sonne aussi bien que le talk-over.

### 3. Pont React Native / Expo — faisable, écosystème maigre
- `@lomray/react-native-apple-music` : le plus vivant, support new arch.
  `expo-music-kit` : abandonné (l'auteur recommande un module Expo neuf).
- Besoins réels étroits → module Expo local en Swift (~300-500 lignes) :
  autorisation, recherche/résolution catalogue, queue+play, événements de
  position, transition crossfade. Probable : partir de @lomray pour évaluer,
  écrire le nôtre si trop limité.
- Conséquence : cette couche = build natif TestFlight (pas d'OTA pour elle).
  iOS 16+ minimum recommandé pour MusicKit.

## Architecture cible
- `app/services/player.ts` : interface lecteur abstraite (play/queue/position/
  onTrackEnd/transition). Implémentations : AppleMusicPlayer (native),
  SpotifyPlayer (l'actuelle, en sommeil derrière l'interface).
- Backend : résolution des morceaux via Apple Music API (developer token JWT
  ES256 signé avec une clé MusicKit). `lib/spotify.ts` → `lib/catalog.ts`
  avec deux providers ; les caches gagnent un champ appleMusicId.
- Le cerveau éditorial (rédaction, narrations, TTS, horloge) : ZÉRO changement.

## Actions PAUL (bloquantes pour le test sur appareil)
1. **Créer une clé MusicKit** : developer.apple.com → Certificates, IDs &
   Profiles → Keys → « + » → cocher « Media Services (MusicKit) » → télécharger
   le .p8 (UNE seule fois) + noter le Key ID. (Team ID déjà connu : 9MRRF555LJ.)
2. **S'abonner à Apple Music** sur son iPhone (essai gratuit OK).

## Étapes suivantes (côté Claude)
1. Module Expo local Swift (ou évaluation @lomray) + écran de test :
   autoriser → chercher un titre → le jouer → événements de position →
   jouer une narration par-dessus → MESURER le comportement du ducking.
2. Build dev-client EAS, test sur l'iPhone de Paul.
3. Verdict ducking → choisir le modèle de mise en ondes (talk-over ou
   alternance habillée) → câbler player.ts.
4. Backend : developer token + résolution Apple Music.
