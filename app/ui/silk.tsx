import { View, StyleSheet } from "react-native";
import { palette } from "./theme";

// Fond "soie" des maquettes : une base ivoire et de grands voiles blancs
// translucides, inclinés, aux bords très arrondis. Sans gradient natif, ce
// sont leurs ombres blanches portées qui font la lumière nacrée.
export function SilkBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.veil, styles.veilTop]} />
      <View style={[styles.veil, styles.veilMid]} />
      <View style={[styles.veil, styles.veilBottom]} />
      <View style={[styles.veil, styles.veilSheen]} />
    </View>
  );
}

const styles = StyleSheet.create({
  veil: {
    position: "absolute",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.9,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 0 },
  },
  veilTop: {
    top: -160,
    left: -120,
    width: 460,
    height: 380,
    borderRadius: 230,
    transform: [{ rotate: "-18deg" }],
  },
  veilMid: {
    top: "30%",
    right: -180,
    width: 480,
    height: 360,
    borderRadius: 240,
    backgroundColor: "rgba(255, 252, 244, 0.20)",
    transform: [{ rotate: "14deg" }],
  },
  veilBottom: {
    bottom: -200,
    left: -100,
    width: 520,
    height: 420,
    borderRadius: 260,
    backgroundColor: "rgba(255, 250, 238, 0.14)",
    transform: [{ rotate: "-10deg" }],
  },
  veilSheen: {
    top: "12%",
    left: "20%",
    width: 280,
    height: 180,
    borderRadius: 140,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    transform: [{ rotate: "24deg" }],
  },
});

export const silkBase = { flex: 1, backgroundColor: palette.bg } as const;
