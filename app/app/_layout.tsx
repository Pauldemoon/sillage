import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import { BACKEND } from "../services/api";
import { logDebug, logError } from "../services/debug";

export default function RootLayout() {
  useEffect(() => {
    // Diagnostic au démarrage (visible dans l'overlay du player) : quel
    // bundle tourne et vers quel backend il pointe — pour ne plus jamais
    // deviner d'où vient un "Network Error".
    logDebug(`backend: ${BACKEND.replace(/^https?:\/\//, "")}`);
    logDebug(
      Updates.isEmbeddedLaunch
        ? "bundle: embarqué (build natif)"
        : `bundle: OTA ${Updates.updateId?.slice(0, 8) ?? "?"}`,
    );

    if (__DEV__) return;
    // Auto-OTA : on télécharge ET applique la mise à jour dès le lancement,
    // au lieu d'exiger le rituel "fermer/rouvrir deux fois". Le redémarrage
    // arrive dans les premières secondes, avant que l'écoute commence.
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable) return;
        logDebug("OTA disponible → téléchargement…");
        await Updates.fetchUpdateAsync();
        logDebug("OTA téléchargé → redémarrage");
        await Updates.reloadAsync();
      } catch (e) {
        // Hors-ligne ou store indisponible : on continue sur le bundle actuel.
        logError("OTA", e);
      }
    })();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0a0a0a" },
          animation: "fade",
        }}
      />
    </>
  );
}
