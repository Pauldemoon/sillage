import { useEffect, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { getAppleMusic, type AppleSong } from "../modules/sillage-music";
import { palette, serif, glassShadowSmall } from "../ui/theme";
import { SilkBackground } from "../ui/silk";

// LABO MusicKit — écran de spike, accessible par appui long sur le logo.
// Objectif : mesurer sur appareil ce que la doc ne dit pas clairement —
// surtout : duckOthers baisse-t-il ApplicationMusicPlayer depuis notre app ?
export default function LaboScreen() {
  const [lines, setLines] = useState<string[]>(["Labo MusicKit — spike Apple Music"]);
  const [state, setState] = useState("");
  const songs = useRef<AppleSong[]>([]);

  const log = (l: string) =>
    setLines((prev) => [...prev.slice(-30), `${new Date().toLocaleTimeString()} ${l}`]);

  useEffect(() => {
    const id = setInterval(() => {
      const am = getAppleMusic();
      if (!am) return;
      try {
        const s = am.getState();
        setState(`${s.status} | ${Math.round(s.positionSec)}s | ${s.currentTitle ?? "—"}`);
      } catch {}
    }, 500);
    return () => clearInterval(id);
  }, []);

  const am = getAppleMusic();

  async function autoriser() {
    if (!am) return log("module absent de ce binaire");
    try {
      log(`autorisation → ${await am.requestAuthorization()}`);
    } catch (e: any) {
      log(`❌ ${e?.message || e}`);
    }
  }

  async function chargerEtJouer() {
    if (!am) return;
    try {
      const a = await am.searchSongs("Aquamarine Addison Rae", 3);
      const b = await am.searchSongs("Diet Pepsi Addison Rae", 3);
      songs.current = [a[0], b[0]].filter(Boolean);
      log(`résolus : ${songs.current.map((s) => s.title).join(" + ")}`);
      await am.playSongIds(songs.current.map((s) => s.id));
      log("lecture lancée");
    } catch (e: any) {
      log(`❌ ${e?.message || e}`);
    }
  }

  // LE test du spike : pendant que la musique Apple joue, on passe la session
  // en duckOthers et on joue le lit fort 6 s. Si la musique baisse → le modèle
  // talk-over Spotify se transpose. Si elle ne baisse pas → alternance habillée.
  async function testDuck() {
    if (!am) return;
    try {
      log("DUCK ON — écoute si la musique baisse…");
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: "duckOthers",
      });
      const bed = createAudioPlayer(require("../assets/audio/ambiance.mp3"));
      bed.volume = 1;
      bed.play();
      setTimeout(async () => {
        bed.pause();
        bed.remove();
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: "mixWithOthers",
        });
        log("DUCK OFF — la musique est-elle remontée ?");
      }, 6000);
    } catch (e: any) {
      log(`❌ ${e?.message || e}`);
    }
  }

  async function testCrossfade() {
    if (!am) return;
    try {
      const ok = await am.setCrossfade(3);
      log(ok ? "crossfade 3 s activé → passe au titre suivant" : "crossfade indisponible (iOS < 18)");
      await am.skipToNext();
    } catch (e: any) {
      log(`❌ ${e?.message || e}`);
    }
  }

  const bouton = (label: string, onPress: () => void) => (
    <TouchableOpacity style={[styles.btn, glassShadowSmall]} onPress={onPress}>
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SilkBackground />
      <Text style={styles.title}>Labo</Text>
      <Text style={styles.state}>{state || "lecteur arrêté"}</Text>
      <View style={styles.grid}>
        {bouton("1 · Autoriser MusicKit", autoriser)}
        {bouton("2 · Charger 2 titres + jouer", chargerEtJouer)}
        {bouton("3 · TEST DUCK (6 s de lit)", testDuck)}
        {bouton("4 · Crossfade + titre suivant", testCrossfade)}
        {bouton("Pause", () => am?.pausePlayer())}
        {bouton("Reprendre", () => am?.resumePlayer())}
        {bouton("Stop", () => am?.stopPlayer())}
      </View>
      <ScrollView style={styles.log}>
        {lines.map((l, i) => (
          <Text key={i} style={styles.logLine}>
            {l}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
    paddingTop: 70,
    paddingHorizontal: 22,
  },
  title: {
    fontFamily: serif,
    fontSize: 34,
    color: palette.ink,
    textAlign: "center",
  },
  state: {
    fontSize: 13,
    color: palette.sub,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 14,
    fontVariant: ["tabular-nums"],
  },
  grid: {
    gap: 10,
  },
  btn: {
    backgroundColor: palette.glass,
    borderWidth: 1,
    borderColor: palette.glassBorder,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  btnText: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "600",
  },
  log: {
    marginTop: 16,
    marginBottom: 30,
  },
  logLine: {
    fontSize: 11,
    color: palette.faint,
    fontFamily: "Courier",
    lineHeight: 16,
  },
});
