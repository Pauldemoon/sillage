import { Platform } from "react-native";

// Thème "soie ivoire" — la direction artistique des maquettes : fond crème
// nacré, surfaces en verre dépoli, typo serif (Didot, native iOS), accents
// dorés discrets. Tout est faisable en pur React Native (pas de gradient,
// pas de SVG, pas de police à charger) → livrable en OTA sans rebuild.

export const palette = {
  bg: "#F3ECDF",
  ink: "#332C20",
  sub: "#9B8F7B",
  faint: "#B8AD99",
  gold: "#B8995E",
  goldSoft: "#C9AE7C",
  barTrack: "rgba(70, 58, 36, 0.12)",
  glass: "rgba(255, 255, 255, 0.55)",
  glassBorder: "rgba(255, 255, 255, 0.75)",
  danger: "#A3543E",
};

// Didot est embarquée dans iOS — c'est la typo des maquettes. Android
// retombe sur sa serif système (Noto Serif).
export const serif = Platform.select({ ios: "Didot", default: "serif" });

// Ombre chaude et diffuse qui "pose" une surface de verre sur la soie.
export const glassShadow = {
  shadowColor: "#8A7350",
  shadowOffset: { width: 0, height: 14 },
  shadowOpacity: 0.18,
  shadowRadius: 24,
  elevation: 8,
} as const;

// Halo plus serré pour les petits éléments (boutons ronds, pilules).
export const glassShadowSmall = {
  shadowColor: "#8A7350",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.14,
  shadowRadius: 12,
  elevation: 4,
} as const;
