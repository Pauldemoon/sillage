import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";

export default function SearchScreen() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");

  const handleLaunch = () => {
    if (!title.trim() || !artist.trim()) return;
    router.push({ pathname: "/generating", params: { title, artist } });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.logo}>SILLAGE</Text>
        <Text style={styles.subtitle}>Tape un titre. Écoute une émission.</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Titre du morceau"
          placeholderTextColor="#444"
          value={title}
          onChangeText={setTitle}
          returnKeyType="next"
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          placeholder="Artiste"
          placeholderTextColor="#444"
          value={artist}
          onChangeText={setArtist}
          returnKeyType="done"
          autoCapitalize="words"
          onSubmitEditing={handleLaunch}
        />
        <TouchableOpacity
          style={[
            styles.button,
            (!title.trim() || !artist.trim()) && styles.buttonDisabled,
          ]}
          onPress={handleLaunch}
          disabled={!title.trim() || !artist.trim()}
        >
          <Text style={styles.buttonText}>Lancer Sillage →</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    justifyContent: "center",
    padding: 28,
  },
  header: {
    marginBottom: 56,
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
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: "#111",
    color: "#fff",
    borderRadius: 10,
    padding: 18,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#222",
  },
  button: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 18,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.2,
  },
  buttonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 1,
  },
});
