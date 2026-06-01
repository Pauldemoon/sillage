import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";

let currentPlayer: AudioPlayer | null = null;

export async function setupAudio(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
  });
}

export async function playNarration(base64Uri: string): Promise<void> {
  await stopAudio();
  const player = createAudioPlayer({ uri: base64Uri });
  currentPlayer = player;
  player.play();

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
}

export async function stopAudio(): Promise<void> {
  if (currentPlayer) {
    currentPlayer.pause();
    currentPlayer.remove();
    currentPlayer = null;
  }
}
