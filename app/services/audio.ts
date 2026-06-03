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

export async function playNarration(base64Uri: string): Promise<void> {
  logDebug(`narration play (${base64Uri.slice(0, 32)}…)`);
  await stopAudio();
  // On ducke Spotify uniquement maintenant (il est déjà connecté et joue).
  await setInterruption("duckOthers");
  const player = createAudioPlayer({ uri: base64Uri });
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

  await new Promise<void>((resolve) => {
    const subscription = player.addListener(
      "playbackStatusUpdate",
      (status) => {
        if (status.isLoaded && status.didJustFinish) {
          subscription.remove();
          resolve();
        }
      },
    );
  });

  // Narration finie : on rend le focus → Spotify remonte à plein volume.
  await setInterruption("mixWithOthers");
  logDebug("narration end");
}

export async function stopAudio(): Promise<void> {
  if (currentPlayer) {
    currentPlayer.pause();
    currentPlayer.remove();
    currentPlayer = null;
  }
}
