import { Audio } from "expo-av";

let currentSound: Audio.Sound | null = null;

export async function setupAudio(): Promise<void> {
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
  });
}

export async function playNarration(base64Uri: string): Promise<void> {
  await stopAudio();
  const { sound } = await Audio.Sound.createAsync({ uri: base64Uri });
  currentSound = sound;
  await sound.playAsync();

  await new Promise<void>((resolve) => {
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) resolve();
    });
  });
}

export async function stopAudio(): Promise<void> {
  if (currentSound) {
    await currentSound.stopAsync();
    await currentSound.unloadAsync();
    currentSound = null;
  }
}
