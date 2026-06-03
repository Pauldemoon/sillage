import axios from "axios";
import { getCachedTts, setCachedTts } from "../../lib/cache/matter";

// Ton éditorial de la voix : disquaire radio, posé, complice.
const VOICE_INSTRUCTIONS =
  "Voix chaude de disquaire radio, à la FIP ou Nova. Posée, complice, " +
  "naturelle, comme si tu confiais une histoire à une seule personne autour " +
  "d'un verre. Débit tranquille, jamais récité.";

// Réglages TTS OpenAI.
function ttsConfig() {
  const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
  const voice = process.env.OPENAI_TTS_VOICE || "ash";
  return { model, voice, tag: `openai:${model}:${voice}` };
}

async function synthOpenAI(text: string, model: string, voice: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY!;

  const response = await axios.post(
    "https://api.openai.com/v1/audio/speech",
    {
      model,
      voice,
      input: text,
      instructions: VOICE_INSTRUCTIONS,
      response_format: "mp3",
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      responseType: "arraybuffer",
    },
  );

  return Buffer.from(response.data);
}

export async function generateVoice(text: string): Promise<Buffer> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY manquante — aucun fournisseur TTS configuré");
  }

  const { model, voice, tag } = ttsConfig();

  // Couche 1 : un texte déjà synthétisé (même voix) = 0 appel TTS.
  const cached = await getCachedTts(tag, text);
  if (cached) return cached;

  const audio = await synthOpenAI(text, model, voice);
  await setCachedTts(tag, text, audio);
  return audio;
}
