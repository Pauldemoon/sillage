import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";
import { logDebug } from "./debug";

let currentPlayer: AudioPlayer | null = null;

// IMPORTANT : on ne reste PAS en "duckOthers" en permanence. Le mettre au
// démarrage vole le focus audio à Spotify AVANT qu'il se connecte, et un
// Spotify "froid" refuse alors la socket App Remote ("Connection refused").
// On reste donc en "mixWithOthers" (ne vole pas le focus → Spotify se connecte
// et joue), et on bascule en "duckOthers" UNIQUEMENT le temps de la narration.
async function setInterruption(
  mode: "mixWithOthers" | "duckOthers",
): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: mode,
  });
}

export async function setupAudio(): Promise<void> {
  await setInterruption("mixWithOthers");
}

// Fade-in court de la voix pour ne pas "claquer" par-dessus la musique duckée.
const FADE_IN_MS = 600;
// Filet anti-gel : on n'attend JAMAIS une narration plus longtemps que ça.
// Une loupe de 170 mots ≈ 70-80 s de voix ; au-delà de 2 min, c'est qu'un
// son n'a pas chargé.
const NARRATION_MAX_MS = 120000;

// Lit musical sous la voix — l'habillage radio (boucle ambiante ~30 s fournie
// par Paul). Il démarre avec Charlie, tourne à bas volume sous lui, et meurt
// en fondu quand la voix se tait : c'est lui qui fait le pont sonore entre la
// fin de la voix et la montée du morceau suivant.
const BED_SOURCE = require("../assets/audio/ambiance.mp3");
const BED_VOLUME = 0.22;
const BED_FADE_OUT_MS = 900;

// Habillage d'antenne — sonal (signature d'ouverture), sweeper (entrée de
// voix), stinger (départ de titre). Sons v1 synthétisés (Fa majeur, famille
// "mer" assortie au lit) — remplaçables par les assets de Paul, mêmes noms.
// Tout est réglable/désactivable en OTA.
const SFX = {
  sonal: { source: require("../assets/audio/sonal.m4a"), volume: 0.7, enabled: true },
  sweeper: { source: require("../assets/audio/sweeper.m4a"), volume: 0.32, enabled: true },
  stinger: { source: require("../assets/audio/stinger.m4a"), volume: 0.38, enabled: true },
} as const;

export function playSfx(kind: keyof typeof SFX): void {
  const sfx = SFX[kind];
  if (!sfx.enabled) return;
  try {
    const player = createAudioPlayer(sfx.source);
    player.volume = sfx.volume;
    player.play();
    // Les éléments font < 4 s : nettoyage différé, sans suivi d'état.
    setTimeout(() => {
      try {
        player.pause();
        player.remove();
      } catch {}
    }, 6000);
  } catch {
    // L'habillage ne doit jamais casser l'antenne.
  }
}

let bedPlayer: AudioPlayer | null = null;

function startBed(): void {
  stopBed();
  const player = createAudioPlayer(BED_SOURCE);
  bedPlayer = player;
  player.loop = true;
  player.volume = 0;
  player.play();
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    setTimeout(() => {
      if (bedPlayer === player) player.volume = (BED_VOLUME / steps) * i;
    }, (FADE_IN_MS / steps) * i);
  }
}

function stopBed(): void {
  if (bedPlayer) {
    bedPlayer.pause();
    bedPlayer.remove();
    bedPlayer = null;
  }
}

// Fondu de sortie du lit : il survit ~1 s à la voix, le temps que le morceau
// suivant (déjà lancé par le talk-up) prenne la place.
async function fadeOutBed(): Promise<void> {
  const player = bedPlayer;
  if (!player) return;
  bedPlayer = null;
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    setTimeout(() => {
      player.volume = Math.max(0, BED_VOLUME * (1 - i / steps));
    }, (BED_FADE_OUT_MS / steps) * i);
  }
  await new Promise((r) => setTimeout(r, BED_FADE_OUT_MS + 80));
  player.pause();
  player.remove();
}

export async function playNarration(
  uri: string,
  // Talk-up radio : `onTail` est appelé UNE fois quand il reste ~`tailMs` de
  // voix. Le player lance alors le morceau suivant, qui naît DUCKÉ sous les
  // derniers mots (duckOthers est encore actif) et monte quand la voix se
  // tait — au lieu d'un blanc entre la dernière syllabe et la musique.
  options?: { tailMs?: number; onTail?: () => void },
): Promise<void> {
  logDebug(`narration play (${uri.slice(0, 32)}…)`);
  await stopAudio();
  // On ducke Spotify uniquement maintenant (il est déjà connecté et joue).
  await setInterruption("duckOthers");
  // Habillage : la vague d'entrée annonce la voix, le lit s'installe dessous.
  playSfx("sweeper");
  startBed();
  const player = createAudioPlayer({ uri: uri });
  currentPlayer = player;
  player.volume = 0;
  player.play();

  // Montée progressive du volume sur FADE_IN_MS.
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    setTimeout(() => {
      if (currentPlayer === player) player.volume = i / steps;
    }, (FADE_IN_MS / steps) * i);
  }

  const tailMs = options?.tailMs ?? 0;
  let tailFired = false;

  try {
    await new Promise<void>((resolve) => {
      let done = false;
      let timer: ReturnType<typeof setTimeout>;
      const subscription = player.addListener(
        "playbackStatusUpdate",
        (status) => {
          if (done) return;
          // Talk-up : on déclenche quand la fin de la voix approche.
          if (
            !tailFired &&
            options?.onTail &&
            tailMs > 0 &&
            status.isLoaded &&
            status.duration > 0 &&
            (status.duration - status.currentTime) * 1000 <= tailMs
          ) {
            tailFired = true;
            logDebug(`talk-up: lancement du morceau sous la voix (${tailMs}ms)`);
            try {
              options.onTail();
            } catch {}
          }
          // Échec de chargement (URL injoignable, 404, data-URI illisible…) :
          // `didJustFinish` n'arrivera JAMAIS. On lit `status.error` (champ
          // expo-audio), on log, et on enchaîne — au lieu de geler tout le
          // player en attendant une fin qui ne viendra pas.
          if (status.error) logDebug(`❌ audio: ${status.error}`);
          else if (!(status.isLoaded && status.didJustFinish)) return;
          done = true;
          clearTimeout(timer);
          subscription.remove();
          resolve();
        },
      );
      // Dernier filet : on ne reste jamais bloqué indéfiniment sur la voix.
      timer = setTimeout(() => {
        if (done) return;
        done = true;
        logDebug("⚠️ audio: timeout, on enchaîne sans bloquer");
        subscription.remove();
        resolve();
      }, NARRATION_MAX_MS);
    });
  } finally {
    // Habillage : le stinger marque le départ du titre pendant que le lit
    // s'éteint et que la musique remonte.
    playSfx("stinger");
    // Le lit survit ~1 s à la voix (fondu), puis on rend le focus → Spotify
    // remonte à plein volume sous la fin du fondu.
    await fadeOutBed();
    await setInterruption("mixWithOthers");
    logDebug("narration end");
  }
}

export async function stopAudio(): Promise<void> {
  stopBed();
  if (currentPlayer) {
    currentPlayer.pause();
    currentPlayer.remove();
    currentPlayer = null;
  }
}
