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
import {
  connectSpotify,
  playTrack,
  pauseTrack,
  resumeTrack,
  waitForTrackEnd,
  disconnectSpotify,
} from "../services/spotify";

type Phase =
  | "connecting"
  | "preparing"
  | "narration"
  | "music"
  | "paused"
  | "done";

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
  const [error, setError] = useState<string | null>(null);
  const isPaused = useRef(false);
  const stopped = useRef(false);

  const tracks = emission?.tracks || (seedTrack ? [seedTrack] : []);
  const track = tracks[trackIndex] || tracks[0];

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
      const generationPromise = generateEmission(title, artist, memory).then(
        (data) => ({ data }),
        (generationError) => ({ generationError }),
      );

      await connectSpotify();
      setPhase("music");
      await playTrack(seedTrack.spotifyUri);
      await waitForTrackEnd(seedTrack.duration);
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

    if (!options.skipNarration && data.audioUrls[index]) {
      setPhase("narration");
      await playNarration(data.audioUrls[index]);
      if (stopped.current) return;
    }

    setPhase("music");
    await playTrack(data.tracks[index].spotifyUri);
    await waitForTrackEnd(data.tracks[index].duration);
    if (stopped.current) return;

    if (index < data.tracks.length - 1) {
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

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.restartBtn}
          onPress={() => router.replace("/")}
        >
          <Text style={styles.restartText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!track) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Morceau introuvable</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Angle */}
      <Text style={styles.angle}>
        {(emission?.angle || "Sillage prépare le voyage").toUpperCase()}
      </Text>

      {/* Cover */}
      <Image source={{ uri: track.cover }} style={styles.cover} />

      {/* Infos morceau */}
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle}>{track.title}</Text>
        <Text style={styles.trackArtist}>{track.artist}</Text>
      </View>

      {/* État de lecture */}
      <View style={styles.phaseRow}>
        {phase === "connecting" && (
          <Text style={styles.phaseText}>Connexion Spotify…</Text>
        )}
        {phase === "preparing" && (
          <Text style={styles.phaseText}>Sillage termine l'émission…</Text>
        )}
        {phase === "narration" && (
          <Text style={styles.phaseText}>● Narration en cours</Text>
        )}
        {phase === "music" && (
          <TouchableOpacity onPress={handlePause}>
            <Text style={styles.phaseText}>
              ♫ {track.title} — appuie pour pause
            </Text>
          </TouchableOpacity>
        )}
        {phase === "paused" && (
          <TouchableOpacity onPress={handleResume}>
            <Text style={styles.phaseText}>
              ⏸ Pause — appuie pour reprendre
            </Text>
          </TouchableOpacity>
        )}
        {phase === "done" && (
          <TouchableOpacity
            style={styles.restartBtn}
            onPress={() => router.replace("/")}
          >
            <Text style={styles.restartText}>Nouvelle émission →</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Narration text */}
      {phase === "narration" && emission && (
        <ScrollView style={styles.narrationBox}>
          <Text style={styles.narrationText}>
            {emission.narrations[trackIndex]}
          </Text>
        </ScrollView>
      )}

      {/* Progression */}
      <View style={styles.progress}>
        {tracks.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === trackIndex && styles.dotActive,
              i < trackIndex && styles.dotDone,
            ]}
          />
        ))}
      </View>

      {/* Sources */}
      <TouchableOpacity
        style={styles.sourcesToggle}
        onPress={() => setShowSources(!showSources)}
      >
        <Text style={styles.sourcesLabel}>
          {showSources ? "Masquer les sources" : "Voir les sources"}
        </Text>
      </TouchableOpacity>

      {showSources && (
        <View style={styles.sourcesList}>
          {track.sources?.map((s, i) => (
            <TouchableOpacity key={i} onPress={() => Linking.openURL(s.url)}>
              <Text style={styles.sourceLink}>↗ {s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    padding: 24,
    paddingTop: 56,
    alignItems: "center",
    gap: 16,
  },
  angle: {
    fontSize: 11,
    color: "#555",
    letterSpacing: 3,
    textAlign: "center",
  },
  cover: {
    width: 240,
    height: 240,
    borderRadius: 12,
  },
  trackInfo: {
    alignItems: "center",
    gap: 4,
  },
  trackTitle: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "600",
    textAlign: "center",
  },
  trackArtist: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
  },
  phaseRow: {
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  phaseText: {
    fontSize: 14,
    color: "#aaa",
    textAlign: "center",
  },
  narrationBox: {
    maxHeight: 100,
    width: "100%",
  },
  narrationText: {
    fontSize: 13,
    color: "#555",
    lineHeight: 20,
    textAlign: "center",
  },
  progress: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#222",
  },
  dotActive: {
    backgroundColor: "#fff",
  },
  dotDone: {
    backgroundColor: "#444",
  },
  sourcesToggle: {
    marginTop: 8,
  },
  sourcesLabel: {
    fontSize: 12,
    color: "#444",
    textDecorationLine: "underline",
  },
  sourcesList: {
    gap: 6,
    alignItems: "center",
  },
  sourceLink: {
    fontSize: 12,
    color: "#666",
  },
  restartBtn: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  restartText: {
    color: "#000",
    fontWeight: "600",
    fontSize: 15,
  },
  errorText: {
    color: "#ff4444",
    textAlign: "center",
    fontSize: 15,
    marginBottom: 24,
  },
});
