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
// Les narrations font < 1 min ; au-delà, c'est qu'un son n'a pas chargé.
const NARRATION_MAX_MS = 90000;

export async function playNarration(uri: string): Promise<void> {
  logDebug(`narration play (${uri.slice(0, 32)}…)`);
  await stopAudio();
  // On ducke Spotify uniquement maintenant (il est déjà connecté et joue).
  await setInterruption("duckOthers");
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

  try {
    await new Promise<void>((resolve) => {
      let done = false;
      let timer: ReturnType<typeof setTimeout>;
      const subscription = player.addListener(
        "playbackStatusUpdate",
        (status) => {
          if (done) return;
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
    // Quoi qu'il arrive, on rend le focus → Spotify remonte à plein volume.
    await setInterruption("mixWithOthers");
    logDebug("narration end");
  }
}

export async function stopAudio(): Promise<void> {
  if (currentPlayer) {
    currentPlayer.pause();
    currentPlayer.remove();
    currentPlayer = null;
  }
}
