import { requireNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

// Pont MusicKit (iOS uniquement) — voir ios/SillageMusicModule.swift.
export interface AppleSong {
  id: string;
  title: string;
  artist: string;
  durationSec: number;
  artwork?: string | null;
}

export interface ApplePlayerState {
  status:
    | "playing"
    | "paused"
    | "stopped"
    | "interrupted"
    | "seekingForward"
    | "seekingBackward"
    | "unknown";
  positionSec: number;
  currentTitle?: string | null;
}

interface SillageMusicNative {
  requestAuthorization(): Promise<string>;
  searchSongs(term: string, limit: number): Promise<AppleSong[]>;
  playSongIds(ids: string[]): Promise<void>;
  pausePlayer(): Promise<void>;
  resumePlayer(): Promise<void>;
  stopPlayer(): Promise<void>;
  skipToNext(): Promise<void>;
  getState(): ApplePlayerState;
  setCrossfade(seconds: number): Promise<boolean>;
}

// Chargé paresseusement : sur Android/web ou un binaire sans le module,
// l'import ne doit pas faire planter l'app.
let native: SillageMusicNative | null = null;

export function getAppleMusic(): SillageMusicNative | null {
  if (Platform.OS !== "ios") return null;
  if (!native) {
    try {
      native = requireNativeModule<SillageMusicNative>("SillageMusic");
    } catch {
      return null;
    }
  }
  return native;
}
