import { Text, View, StyleSheet } from "react-native";
import { palette } from "./theme";

function formatTime(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Barre fine des maquettes : piste discrète, remplissage doré, perle
// blanche, temps écoulé / restant de part et d'autre.
export function ProgressBar({
  positionMs,
  durationMs,
  showTimes = true,
}: {
  positionMs: number;
  durationMs: number;
  showTimes?: boolean;
}) {
  const pct =
    durationMs > 0
      ? Math.min(100, Math.max(0, (positionMs / durationMs) * 100))
      : 0;

  return (
    <View style={styles.wrap}>
      {showTimes && (
        <Text style={styles.time}>{formatTime(positionMs)}</Text>
      )}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
        <View style={[styles.knob, { left: `${pct}%` }]} />
      </View>
      {showTimes && (
        <Text style={[styles.time, styles.timeRight]}>
          -{formatTime(Math.max(0, durationMs - positionMs))}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    gap: 10,
  },
  track: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: palette.barTrack,
  },
  fill: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: palette.goldSoft,
  },
  knob: {
    position: "absolute",
    top: -5.5,
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    shadowColor: "#8A7350",
    shadowOpacity: 0.35,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  time: {
    fontSize: 12,
    color: palette.sub,
    width: 44,
    fontVariant: ["tabular-nums"],
  },
  timeRight: {
    textAlign: "right",
  },
});
