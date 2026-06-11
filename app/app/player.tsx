import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Emission, EmissionTrack, generateEmission } from "../services/api";
import {
  loadMemory,
  mergeMemoryPatch,
  rememberJourney,
} from "../services/memory";
import { setupAudio, playNarration, stopAudio } from "../services/audio";
import { logDebug, subscribeDebug } from "../services/debug";
import {
  connectSpotify,
  playTrack,
  pauseTrack,
  resumeTrack,
  waitForTrackEnd,
  disconnectSpotify,
} from "../services/spotify";
import { palette, serif, glassShadow, glassShadowSmall } from "../ui/theme";
import { SilkBackground } from "../ui/silk";
import { VoiceOrb } from "../ui/orb";
import { ProgressBar } from "../ui/progress";
import {
  ChevronLeftIcon,
  DotsIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from "../ui/icons";

type Phase =
  | "connecting"
  | "preparing"
  | "narration"
  | "music"
  | "paused"
  | "done";

// Délai d'anticipation : la narration suivante démarre ce nombre de ms AVANT
// la fin réelle du morceau, pour chevaucher sa toute fin (duckée par iOS)
// plutôt que de laisser un blanc, et pour garder l'App Remote vivante.
const NARRATION_LEAD_MS = 7000;
// Talk-up : le morceau suivant est lancé quand il reste ce temps de voix —
// il naît ducké sous les derniers mots et monte quand Charlie se tait.
// Couvre aussi la latence du play Web API (~0,5-1 s). Réglable en OTA.
const TALKUP_MS = 2200;

export default function PlayerScreen() {
  const {
    emission: raw,
    seed: rawSeed,
    title,
    artist,
  } = useLocalSearchParams<{
    emission?: string;
    seed?: string;
    title?: string;
    artist?: string;
  }>();

  const initialEmission: Emission | null = raw ? JSON.parse(raw) : null;
  const seedTrack: EmissionTrack | null = rawSeed
    ? JSON.parse(rawSeed)
    : initialEmission?.tracks[0] || null;

  const [emission, setEmission] = useState<Emission | null>(initialEmission);
  const [trackIndex, setTrackIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [showSources, setShowSources] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const isPaused = useRef(false);
  const stopped = useRef(false);
  // Phase lisible depuis les callbacks asynchrones (teaser) sans closure périmée.
  const phaseRef = useRef<Phase>("connecting");

  // Abonnement au journal de debug (overlay à l'écran).
  useEffect(() => subscribeDebug(setDebugLines), []);
  // Trace chaque changement de phase.
  useEffect(() => {
    phaseRef.current = phase;
    logDebug(`phase → ${phase}`);
  }, [phase]);

  const tracks = emission?.tracks || (seedTrack ? [seedTrack] : []);
  const track = tracks[trackIndex] || tracks[0];

  // --- Progression locale du morceau (la Web API n'est pas interrogée pour
  // l'UI : horloge locale, suspendue pendant la pause, remise à zéro quand
  // le morceau change). Suffisant pour une barre de lecture.
  const [positionMs, setPositionMs] = useState(0);
  const anchor = useRef({ base: 0, startedAt: 0, forIndex: -1 });

  useEffect(() => {
    if (phase === "music") {
      if (anchor.current.forIndex !== trackIndex) {
        anchor.current = { base: 0, startedAt: Date.now(), forIndex: trackIndex };
      } else {
        anchor.current.startedAt = Date.now();
      }
    } else if (phase === "paused") {
      if (anchor.current.startedAt) {
        anchor.current.base += Date.now() - anchor.current.startedAt;
        anchor.current.startedAt = 0;
      }
    } else {
      anchor.current = { base: 0, startedAt: 0, forIndex: -1 };
      setPositionMs(0);
    }
  }, [phase, trackIndex]);

  useEffect(() => {
    if (phase !== "music") return;
    const id = setInterval(() => {
      const a = anchor.current;
      const pos = a.base + (a.startedAt ? Date.now() - a.startedAt : 0);
      setPositionMs(Math.min(pos, track?.duration ?? pos));
    }, 500);
    return () => clearInterval(id);
  }, [phase, trackIndex, track?.duration]);

  useEffect(() => {
    startEmission();
    return () => {
      stopped.current = true;
      stopAudio();
      disconnectSpotify();
    };
  }, []);

  async function startEmission() {
    try {
      await setupAudio();

      if (initialEmission) {
        mergeMemoryPatch(initialEmission.memoryPatch).catch(() => {});
        rememberJourney(initialEmission.journeyId).catch(() => {});
        await connectSpotify();
        await playPreparedEmission(initialEmission, false);
        return;
      }

      if (!seedTrack || !title || !artist) {
        throw new Error("Morceau de départ manquant");
      }

      // On charge la mémoire persistée (artistes déjà entendus, goûts,
      // tolérance à la découverte) pour la passer au backend : c'est ce qui
      // permet à la découverte de s'accumuler d'une émission à l'autre.
      const memory = await loadMemory();
      logDebug(`generate "${title}" / "${artist}"…`);
      // Teaser : la promesse de Charlie arrive en cours de génération et se
      // joue par-dessus le morceau de départ — uniquement si on y est encore.
      const onTeaser = ({ audioUrl }: { audioUrl: string }) => {
        if (stopped.current || phaseRef.current !== "music") return;
        logDebug("teaser reçu → lecture par-dessus la graine");
        playNarration(audioUrl).catch(() => {});
      };
      const generationPromise = generateEmission(
        title,
        artist,
        memory,
        onTeaser,
        seedTrack,
      ).then(
        (data) => {
          logDebug(
            `generate OK: cached=${(data as any)?.cached} tracks=${data?.tracks?.length}`,
          );
          return { data };
        },
        (generationError) => {
          logDebug(
            `❌ generate: ${String(generationError?.message || generationError).slice(0, 120)}`,
          );
          return { generationError };
        },
      );

      await connectSpotify();
      setPhase("music");
      await playTrack(seedTrack.spotifyUri);
      await waitForTrackEnd(
        seedTrack.duration,
        seedTrack.spotifyUri,
        NARRATION_LEAD_MS,
      );
      if (stopped.current) return;

      setPhase("preparing");
      const generated = await generationPromise;
      if ("generationError" in generated) throw generated.generationError;

      const generatedEmission = generated.data;
      if (stopped.current) return;

      // On enregistre ce que l'utilisateur vient d'entendre pour la suite.
      mergeMemoryPatch(generatedEmission.memoryPatch).catch(() => {});
      rememberJourney(generatedEmission.journeyId).catch(() => {});

      setEmission(generatedEmission);
      await playPreparedEmission(generatedEmission, true);
    } catch (e: any) {
      logDebug(
        `❌ ERREUR: ${String(e?.message || e).replace(/\s+/g, " ").slice(0, 220)}`,
      );
      setError(e.message || "Erreur de connexion Spotify");
    }
  }

  async function playPreparedEmission(
    data: Emission,
    seedAlreadyPlayed: boolean,
  ) {
    if (data.tracks.length === 0) {
      setPhase("done");
      return;
    }

    const startsAt = data.broadcastPlan?.narrationStartsBeforeTrackIndex ?? 1;
    const startIndex = seedAlreadyPlayed
      ? Math.min(Math.max(startsAt, 0), data.tracks.length - 1)
      : 0;

    await playSequence(data, startIndex, {
      skipNarration:
        !seedAlreadyPlayed && data.broadcastPlan?.mode === "seed-first",
    });
  }

  async function playSequence(
    data: Emission,
    index: number,
    options: { skipNarration?: boolean } = {},
  ) {
    if (stopped.current) return;
    if (index >= data.tracks.length) {
      setPhase("done");
      return;
    }

    setEmission(data);
    setTrackIndex(index);

    // Talk-up : pendant la fin de la narration, le morceau démarre déjà,
    // ducké sous la voix. `early` garde la promesse pour ne pas relancer.
    let early: Promise<void> | null = null;
    if (!options.skipNarration && data.audioUrls[index]) {
      setPhase("narration");
      await playNarration(data.audioUrls[index], {
        tailMs: TALKUP_MS,
        onTail: () => {
          if (stopped.current) return;
          early = playTrack(data.tracks[index].spotifyUri);
          // L'échec éventuel est re-géré au `await` ci-dessous.
          early.catch(() => {});
        },
      });
      if (stopped.current) return;
    }

    setPhase("music");
    await (early ?? playTrack(data.tracks[index].spotifyUri));
    const hasNext = index < data.tracks.length - 1;
    // On anticipe la fin seulement s'il reste une narration à enchaîner.
    await waitForTrackEnd(
      data.tracks[index].duration,
      data.tracks[index].spotifyUri,
      hasNext ? NARRATION_LEAD_MS : 0,
    );
    if (stopped.current) return;

    if (hasNext) {
      await playSequence(data, index + 1);
    } else {
      setPhase("done");
    }
  }

  async function handlePause() {
    if (phase === "music") {
      await pauseTrack();
      setPhase("paused");
      isPaused.current = true;
    }
  }

  async function handleResume() {
    if (phase === "paused") {
      await resumeTrack();
      setPhase("music");
      isPaused.current = false;
    }
  }

  function goHome() {
    router.replace("/");
  }

  const isVoiceLayout =
    phase === "narration" || phase === "preparing" || phase === "connecting";

  const topBar = (
    <View style={styles.topBar}>
      <TouchableOpacity
        style={[styles.roundBtn, glassShadowSmall]}
        onPress={goHome}
        activeOpacity={0.7}
      >
        <ChevronLeftIcon size={15} color={palette.ink} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.roundBtn, glassShadowSmall]}
        onPress={() => setShowDebug((v) => !v)}
        activeOpacity={0.7}
      >
        <DotsIcon size={4.5} color={palette.ink} />
      </TouchableOpacity>
    </View>
  );

  const debugOverlay = showDebug ? (
    <ScrollView style={styles.debugBox} contentContainerStyle={{ padding: 6 }}>
      {debugLines.map((l, i) => (
        <Text key={i} style={styles.debugLine}>
          {l}
        </Text>
      ))}
    </ScrollView>
  ) : null;

  if (error) {
    return (
      <View style={styles.container}>
        <SilkBackground />
        {topBar}
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Un accroc</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={[styles.pillBtn, glassShadow]}
            onPress={goHome}
          >
            <Text style={styles.pillBtnText}>Retour</Text>
          </TouchableOpacity>
        </View>
        {debugOverlay}
      </View>
    );
  }

  if (!track) {
    return (
      <View style={styles.container}>
        <SilkBackground />
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Morceau introuvable</Text>
        </View>
      </View>
    );
  }

  const controls = (
    <View style={styles.controls}>
      <View style={styles.skipBtn}>
        <SkipBackIcon size={17} color={palette.faint} />
      </View>
      <TouchableOpacity
        style={[
          styles.playBtn,
          glassShadow,
          isVoiceLayout && styles.playBtnDisabled,
        ]}
        onPress={phase === "paused" ? handleResume : handlePause}
        disabled={isVoiceLayout}
        activeOpacity={0.7}
      >
        {phase === "paused" ? (
          <PlayIcon size={24} color={palette.ink} />
        ) : (
          <PauseIcon size={22} color={palette.ink} />
        )}
      </TouchableOpacity>
      <View style={styles.skipBtn}>
        <SkipForwardIcon size={17} color={palette.faint} />
      </View>
    </View>
  );

  // --- Écran narration : l'orbe qui respire pendant que Charlie parle.
  if (isVoiceLayout) {
    return (
      <View style={styles.container}>
        <SilkBackground />
        {topBar}
        <Text style={styles.logoSmall}>Sillage</Text>
        <View style={[styles.statusPill, glassShadowSmall]}>
          <View style={styles.statusDot} />
          <Text style={styles.statusPillText}>
            {phase === "narration" ? "EN NARRATION" : "PRÉPARATION"}
          </Text>
        </View>

        <View style={styles.orbWrap}>
          <VoiceOrb size={246} active={phase === "narration"} />
        </View>

        <Text style={styles.emissionTitle} numberOfLines={3}>
          {emission?.angle || "Le voyage se prépare"}
        </Text>
        <Text style={styles.emissionSub}>
          {phase === "narration"
            ? "La voix raconte"
            : phase === "preparing"
              ? "Sillage termine l'émission"
              : "Connexion Spotify"}
        </Text>

        {phase === "narration" && emission?.narrations[trackIndex] ? (
          <ScrollView style={styles.narrationBox}>
            <Text style={styles.narrationText}>
              {emission.narrations[trackIndex]}
            </Text>
          </ScrollView>
        ) : (
          <View style={styles.narrationBox} />
        )}

        <View style={styles.bottomArea}>
          <ProgressBar
            positionMs={trackIndex}
            durationMs={Math.max(tracks.length - 1, 1)}
            showTimes={false}
          />
          {controls}
        </View>
        {debugOverlay}
      </View>
    );
  }

  // --- Écran musique : la carte de verre avec la pochette.
  return (
    <View style={styles.container}>
      <SilkBackground />
      {topBar}

      <View style={[styles.coverCard, glassShadow]}>
        <Image source={{ uri: track.cover }} style={styles.cover} />
      </View>

      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={2}>
          {track.title}
        </Text>
        <Text style={styles.trackArtist} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>

      <View style={styles.bottomArea}>
        <ProgressBar
          positionMs={positionMs}
          durationMs={track.duration || 0}
          showTimes
        />

        {phase === "done" ? (
          <TouchableOpacity
            style={[styles.pillBtn, glassShadow]}
            onPress={goHome}
          >
            <Text style={styles.pillBtnText}>Nouveau voyage</Text>
          </TouchableOpacity>
        ) : (
          controls
        )}

        {(track.sources?.length ?? 0) > 0 && (
          <>
            <TouchableOpacity
              onPress={() => setShowSources(!showSources)}
              style={styles.sourcesToggle}
            >
              <Text style={styles.sourcesLabel}>
                {showSources ? "Masquer les sources" : "Sources"}
              </Text>
            </TouchableOpacity>
            {showSources && (
              <View style={styles.sourcesList}>
                {track.sources.map((s, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => Linking.openURL(s.url)}
                  >
                    <Text style={styles.sourceLink}>↗ {s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </View>
      {debugOverlay}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
    paddingHorizontal: 26,
    alignItems: "center",
  },
  topBar: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 62,
    marginBottom: 8,
  },
  roundBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: palette.glass,
    borderWidth: 1,
    borderColor: palette.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },

  // — écran musique
  coverCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 34,
    backgroundColor: palette.glass,
    borderWidth: 1,
    borderColor: palette.glassBorder,
  },
  cover: {
    width: 282,
    height: 282,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  trackInfo: {
    alignItems: "center",
    gap: 6,
    marginTop: 30,
    paddingHorizontal: 10,
  },
  trackTitle: {
    fontFamily: serif,
    fontSize: 32,
    color: palette.ink,
    textAlign: "center",
  },
  trackArtist: {
    fontSize: 16,
    color: palette.sub,
    textAlign: "center",
  },

  // — écran narration
  logoSmall: {
    fontFamily: serif,
    fontSize: 40,
    color: palette.ink,
    marginTop: -46,
    textShadowColor: "rgba(255,255,255,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: palette.glass,
    borderWidth: 1,
    borderColor: palette.glassBorder,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.gold,
  },
  statusPillText: {
    fontSize: 11,
    letterSpacing: 2.4,
    color: palette.sub,
  },
  orbWrap: {
    marginTop: 28,
    marginBottom: 26,
  },
  // L'énoncé du sujet — une phrase dicible, pas un titre. Serif plus petit,
  // jusqu'à trois lignes.
  emissionTitle: {
    fontFamily: serif,
    fontSize: 21,
    lineHeight: 30,
    color: palette.ink,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  emissionSub: {
    fontSize: 15,
    color: palette.sub,
    marginTop: 6,
  },
  narrationBox: {
    maxHeight: 84,
    width: "100%",
    marginTop: 14,
  },
  narrationText: {
    fontSize: 13,
    color: palette.faint,
    lineHeight: 20,
    textAlign: "center",
  },

  // — bas d'écran commun
  bottomArea: {
    width: "100%",
    marginTop: "auto",
    marginBottom: 54,
    alignItems: "center",
    gap: 26,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 44,
  },
  skipBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.55,
  },
  playBtn: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: palette.glass,
    borderWidth: 1,
    borderColor: palette.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtnDisabled: {
    opacity: 0.55,
  },
  pillBtn: {
    backgroundColor: palette.glass,
    borderWidth: 1,
    borderColor: palette.glassBorder,
    borderRadius: 26,
    paddingHorizontal: 30,
    paddingVertical: 15,
  },
  pillBtnText: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "600",
  },

  // — sources
  sourcesToggle: {
    marginTop: -8,
  },
  sourcesLabel: {
    fontSize: 12,
    color: palette.faint,
    textDecorationLine: "underline",
  },
  sourcesList: {
    gap: 6,
    alignItems: "center",
  },
  sourceLink: {
    fontSize: 12,
    color: palette.sub,
  },

  // — erreur
  errorWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingBottom: 80,
  },
  errorTitle: {
    fontFamily: serif,
    fontSize: 30,
    color: palette.ink,
  },
  errorText: {
    color: palette.danger,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 12,
    marginBottom: 10,
  },

  // — debug (toggle via le bouton …)
  debugBox: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: 220,
    backgroundColor: "rgba(20, 16, 8, 0.88)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  debugLine: {
    color: "#9fdc9f",
    fontSize: 10,
    fontFamily: "Courier",
    lineHeight: 14,
  },
});
