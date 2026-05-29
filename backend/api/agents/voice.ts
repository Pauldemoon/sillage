import axios from "axios";
import { getCachedTts, setCachedTts } from "../../lib/cache/matter";

export async function generateVoice(text: string): Promise<Buffer> {
  const voiceId = process.env.ELEVENLABS_VOICE_ID!;
  const apiKey = process.env.ELEVENLABS_API_KEY!;

  // Couche 1 : un texte déjà synthétisé (même voix) = 0 appel TTS.
  const cached = await getCachedTts(voiceId, text);
  if (cached) return cached;

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

  const audio = Buffer.from(response.data);
  await setCachedTts(voiceId, text, audio);
  return audio;
}
