import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { searchTracks, TrackSuggestion } from "../services/api";

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TrackSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      const id = ++reqId.current;
      try {
        const tracks = await searchTracks(q);
        if (id === reqId.current) setResults(tracks);
      } catch {
        if (id === reqId.current) setResults([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 350);
  }, [query]);

  function pick(track: TrackSuggestion) {
    router.push({
      pathname: "/player",
      params: {
        title: track.title,
        artist: track.artist,
        seed: JSON.stringify({ ...track, sources: [] }),
      },
    });
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.logo}>SILLAGE</Text>
        <Text style={styles.subtitle}>
          Cherche un morceau. Écoute une émission.
        </Text>
      </View>

      <View style={styles.searchBox}>
        <TextInput
          style={styles.input}
          placeholder="Rechercher un titre ou un artiste"
          placeholderTextColor="#444"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          autoFocus
        />
        {loading && (
          <ActivityIndicator style={styles.inlineSpinner} color="#666" />
        )}
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => pick(item)}>
            <Image source={{ uri: item.cover }} style={styles.cover} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.rowArtist} numberOfLines={1}>
                {item.artist}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          query.trim().length >= 2 && !loading ? (
            <Text style={styles.empty}>Aucun résultat</Text>
          ) : null
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    paddingHorizontal: 20,
    paddingTop: 96,
  },
  header: {
    marginBottom: 32,
  },
  logo: {
    fontSize: 36,
    fontWeight: "200",
    color: "#fff",
    letterSpacing: 12,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    letterSpacing: 1,
  },
  searchBox: {
    justifyContent: "center",
  },
  input: {
    backgroundColor: "#111",
    color: "#fff",
    borderRadius: 12,
    padding: 18,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#222",
  },
  inlineSpinner: {
    position: "absolute",
    right: 16,
  },
  list: {
    marginTop: 8,
  },
  listContent: {
    paddingTop: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: "#1a1a1a",
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "500",
  },
  rowArtist: {
    fontSize: 13,
    color: "#666",
  },
  empty: {
    color: "#444",
    textAlign: "center",
    marginTop: 32,
    fontSize: 14,
  },
});
