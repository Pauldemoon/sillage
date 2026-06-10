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
import { palette, serif, glassShadow, glassShadowSmall } from "../ui/theme";
import { SilkBackground } from "../ui/silk";
import { SearchIcon } from "../ui/icons";

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

  const hasResults = results.length > 0 || loading;

  return (
    <View style={styles.container}>
      <SilkBackground />
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, hasResults && styles.headerCompact]}>
          <Text style={styles.logo}>Sillage</Text>
        </View>

        <View style={[styles.searchBox, glassShadow]}>
          <SearchIcon size={18} color={palette.sub} />
          <TextInput
            style={styles.input}
            placeholder="Titre, artiste"
            placeholderTextColor={palette.faint}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            autoFocus
          />
          {loading && <ActivityIndicator color={palette.sub} />}
        </View>

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, glassShadowSmall]}
              onPress={() => pick(item)}
              activeOpacity={0.7}
            >
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
    marginTop: 150,
    marginBottom: 44,
  },
  headerCompact: {
    marginTop: 84,
    marginBottom: 28,
  },
  logo: {
    fontFamily: serif,
    fontSize: 58,
    color: palette.ink,
    letterSpacing: 1,
    textShadowColor: "rgba(255, 255, 255, 0.9)",
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 1,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: palette.glass,
    borderWidth: 1,
    borderColor: palette.glassBorder,
    borderRadius: 32,
    paddingHorizontal: 22,
    height: 62,
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: palette.ink,
  },
  list: {
    marginTop: 18,
  },
  listContent: {
    paddingBottom: 32,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(255, 255, 255, 0.38)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.55)",
    borderRadius: 20,
    padding: 10,
  },
  cover: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    fontSize: 16,
    color: palette.ink,
    fontWeight: "600",
  },
  rowArtist: {
    fontSize: 13,
    color: palette.sub,
  },
  empty: {
    color: palette.faint,
    textAlign: "center",
    marginTop: 32,
    fontSize: 14,
  },
});
