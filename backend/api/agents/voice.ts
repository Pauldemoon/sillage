import axios from "axios";
import { getCachedTts, setCachedTts } from "../../lib/cache/matter";

// Ton éditorial de la voix : disquaire radio, posé, complice.
const VOICE_INSTRUCTIONS =
  "Voix chaude de disquaire radio, à la FIP ou Nova. Posée, complice, " +
  "naturelle, comme si tu confiais une histoire à une seule personne autour " +
  "d'un verre. Débit tranquille, jamais récité.";

async function synthOpenAI(text: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
  const voice = process.env.OPENAI_TTS_VOICE || "ash";

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

async function synthElevenLabs(text: string): Promise<Buffer> {
  const voiceId = process.env.ELEVENLABS_VOICE_ID!;
  const apiKey = process.env.ELEVENLABS_API_KEY!;

  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.3,
        use_speaker_boost: true,
      },
    },
    {
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      responseType: "arraybuffer",
    },
  );

  return Buffer.from(response.data);
}

interface Provider {
  tag: string;
  synth: (text: string) => Promise<Buffer>;
}

// OpenAI en principal (~10x moins cher), ElevenLabs en secours pour ne
// jamais casser une émission si OpenAI échoue (quota, incident...).
function providers(): Provider[] {
  const list: Provider[] = [];
  if (process.env.OPENAI_API_KEY) {
    const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
    const voice = process.env.OPENAI_TTS_VOICE || "ash";
    list.push({ tag: `openai:${model}:${voice}`, synth: synthOpenAI });
  }
  if (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID) {
    list.push({
      tag: `elevenlabs:${process.env.ELEVENLABS_VOICE_ID}`,
      synth: synthElevenLabs,
    });
  }
  return list;
}

export async function generateVoice(text: string): Promise<Buffer> {
  const chain = providers();
  if (chain.length === 0) {
    throw new Error("Aucun fournisseur TTS configuré");
  }

  let lastError: unknown;
  for (const provider of chain) {
    // Couche 1 : un texte déjà synthétisé (même voix) = 0 appel TTS.
    const cached = await getCachedTts(provider.tag, text);
    if (cached) return cached;

    try {
      const audio = await provider.synth(text);
      await setCachedTts(provider.tag, text, audio);
      return audio;
    } catch (error) {
      lastError = error;
      // On tente le fournisseur suivant.
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Échec de synthèse vocale");
}
