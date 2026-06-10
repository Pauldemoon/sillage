import { View, StyleSheet } from "react-native";
import { palette } from "./theme";

// Icônes de transport dessinées en Views (l'app n'embarque ni lib d'icônes
// ni SVG, et les glyphes Unicode ⏯ sortent en emoji colorés sur iOS).

export function PlayIcon({ size = 22, color = palette.ink }) {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        marginLeft: size * 0.18,
        borderTopWidth: size * 0.62,
        borderBottomWidth: size * 0.62,
        borderLeftWidth: size,
        borderTopColor: "transparent",
        borderBottomColor: "transparent",
        borderLeftColor: color,
      }}
    />
  );
}

export function PauseIcon({ size = 22, color = palette.ink }) {
  const bar = {
    width: size * 0.28,
    height: size * 1.15,
    borderRadius: size * 0.12,
    backgroundColor: color,
  };
  return (
    <View style={[styles.row, { gap: size * 0.3 }]}>
      <View style={bar} />
      <View style={bar} />
    </View>
  );
}

function SkipTriangle({
  size,
  color,
  direction,
}: {
  size: number;
  color: string;
  direction: "left" | "right";
}) {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderTopWidth: size * 0.5,
        borderBottomWidth: size * 0.5,
        borderTopColor: "transparent",
        borderBottomColor: "transparent",
        ...(direction === "right"
          ? { borderLeftWidth: size * 0.82, borderLeftColor: color }
          : { borderRightWidth: size * 0.82, borderRightColor: color }),
      }}
    />
  );
}

export function SkipBackIcon({ size = 18, color = palette.ink }) {
  return (
    <View style={[styles.row, { gap: size * 0.12 }]}>
      <View
        style={{
          width: size * 0.18,
          height: size,
          borderRadius: size * 0.09,
          backgroundColor: color,
        }}
      />
      <SkipTriangle size={size} color={color} direction="left" />
    </View>
  );
}

export function SkipForwardIcon({ size = 18, color = palette.ink }) {
  return (
    <View style={[styles.row, { gap: size * 0.12 }]}>
      <SkipTriangle size={size} color={color} direction="right" />
      <View
        style={{
          width: size * 0.18,
          height: size,
          borderRadius: size * 0.09,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function ChevronLeftIcon({ size = 16, color = palette.ink }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderLeftWidth: 2.5,
        borderBottomWidth: 2.5,
        borderColor: color,
        transform: [{ rotate: "45deg" }, { translateX: size * 0.12 }],
      }}
    />
  );
}

export function DotsIcon({ size = 5, color = palette.ink }) {
  const dot = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
  };
  return (
    <View style={[styles.row, { gap: size * 0.8 }]}>
      <View style={dot} />
      <View style={dot} />
      <View style={dot} />
    </View>
  );
}

export function SearchIcon({ size = 18, color = palette.sub }) {
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          width: size * 0.72,
          height: size * 0.72,
          borderRadius: size * 0.36,
          borderWidth: 2,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          right: size * 0.02,
          bottom: size * 0.02,
          width: size * 0.36,
          height: 2,
          borderRadius: 1,
          backgroundColor: color,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
});
