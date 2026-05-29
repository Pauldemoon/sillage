import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { resolveSeedTrack } from "../services/api";

const STEPS = [
  "Sillage retrouve le morceau…",
  "Sillage ouvre l'écoute…",
  "Sillage prépare l'émission en fond…",
];

export default function GeneratingScreen() {
  const { title, artist } = useLocalSearchParams<{
    title: string;
    artist: string;
  }>();
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, 4000);

    resolveSeedTrack(title, artist)
      .then((seed) => {
        clearInterval(interval);
        router.replace({
          pathname: "/player",
          params: {
            title,
            artist,
            seed: JSON.stringify(seed),
          },
        });
      })
      .catch((err) => {
        clearInterval(interval);
        console.error(err);
        router.back();
      });

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#fff" style={styles.spinner} />
      <Text style={styles.step}>{STEPS[stepIndex]}</Text>
      <Text style={styles.track}>
        "{title}" — {artist}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
    gap: 20,
  },
  spinner: {
    marginBottom: 8,
  },
  step: {
    fontSize: 17,
    color: "#fff",
    textAlign: "center",
    fontWeight: "300",
    letterSpacing: 0.5,
  },
  track: {
    fontSize: 13,
    color: "#444",
    textAlign: "center",
    letterSpacing: 0.5,
  },
});
