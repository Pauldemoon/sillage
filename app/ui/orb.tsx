import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { glassShadow, palette } from "./theme";

// L'orbe de narration : un disque de verre dans lequel des ondes douces
// respirent pendant que Charlie parle. Trois bandes nacrées + un halo
// central, animés en boucle (translate/scale/opacity, natif).

function useBreathing(duration: number, delay: number) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value, duration, delay]);
  return value;
}

export function VoiceOrb({ size = 250, active = true }) {
  const a = useBreathing(1900, 0);
  const b = useBreathing(2300, 350);
  const c = useBreathing(2700, 700);

  const wave = (
    anim: Animated.Value,
    width: number,
    height: number,
    color: string,
    rotate: string,
    amplitude: number,
  ) => (
    <Animated.View
      style={{
        position: "absolute",
        width,
        height,
        borderRadius: height / 2,
        backgroundColor: color,
        transform: [
          { rotate },
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [amplitude, -amplitude],
            }),
          },
          {
            scaleX: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.07],
            }),
          },
        ],
        opacity: active ? 1 : 0.4,
      }}
    />
  );

  return (
    <View style={[styles.orb, glassShadow, { width: size, height: size, borderRadius: size / 2 }]}>
      <Animated.View
        style={[
          styles.glow,
          {
            width: size * 0.62,
            height: size * 0.62,
            borderRadius: size * 0.31,
            opacity: a.interpolate({
              inputRange: [0, 1],
              outputRange: [0.35, active ? 0.7 : 0.4],
            }),
            transform: [
              {
                scale: a.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.92, 1.06],
                }),
              },
            ],
          },
        ]}
      />
      {wave(a, size * 0.78, size * 0.30, "rgba(216, 192, 146, 0.30)", "-7deg", 7)}
      {wave(b, size * 0.70, size * 0.22, "rgba(255, 248, 232, 0.55)", "4deg", 9)}
      {wave(c, size * 0.60, size * 0.15, "rgba(201, 174, 124, 0.38)", "-3deg", 11)}
      <View
        style={[
          styles.rim,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.42)",
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    backgroundColor: "rgba(255, 243, 214, 0.9)",
    shadowColor: "#FFE9BF",
    shadowOpacity: 1,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
  },
  rim: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: palette.glassBorder,
  },
});
