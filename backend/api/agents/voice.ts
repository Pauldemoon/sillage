import axios from "axios";
import { getCachedTts, setCachedTts } from "../../lib/cache/matter";

// Deux fournisseurs TTS :
//  - GEMINI = la voix PREMIUM (qualité « NotebookLM », nettement préférée).
//    Voix par défaut : Gacrux (vivante, bien articulée). Renvoie du PCM brut.
//  - OPENAI = secours automatique (gpt-4o-mini-tts / ash) : si Gemini est
//    indisponible (quota du tier gratuit, erreur réseau), on ne casse jamais
//    une émission, on bascule dessus en silence.
// Le cache TTS est taggé par fournisseur+modèle+voix → changer de voix ne
// resert jamais un vieil audio.

// ---- Gemini (principal) ---------------------------------------------------
const GEMINI_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const GEMINI_VOICE = process.env.GEMINI_TTS_VOICE || "Gacrux";
// Direction de jeu en langage naturel : Gemini la SUIT. C'est ce qui rend la
// voix vivante au lieu de « récitée » — exactement le reproche fait à OpenAI.
const GEMINI_STYLE =
  "Dis ce texte comme un disquaire passionné à la radio, façon FIP ou Nova : " +
  "voix chaude, posée, complice, vivante et naturelle, comme si tu confiais " +
  "une histoire à une seule personne autour d'un verre. Débit tranquille, des " +
  "respirations naturelles, jamais récité, jamais monocorde.";

const geminiTag = () => `gemini:${GEMINI_MODEL}:${GEMINI_VOICE}`;

async function synthGemini(text: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      contents: [{ parts: [{ text: `${GEMINI_STYLE}\n\n${text}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_VOICE } },
        },
      },
    },
    { headers: { "Content-Type": "application/json" }, timeout: 60000 },
  );

  const part = response.data?.candidates?.[0]?.content?.parts?.[0];
  const b64 = part?.inlineData?.data;
  if (!b64) throw new Error("Gemini TTS : pas d'audio dans la réponse");
  // Gemini renvoie du PCM brut signé 16 bits, 24 kHz, mono → on l'emballe en
  // WAV pour que l'app (expo-audio) le lise comme un fichier audio normal.
  return pcmToWav(Buffer.from(b64, "base64"), 24000, 1, 16);
}

function pcmToWav(
  pcm: Buffer,
  sampleRate: number,
  channels: number,
  bits: number,
): Buffer {
  const byteRate = (sampleRate * channels * bits) / 8;
  const blockAlign = (channels * bits) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // taille du sous-chunk fmt
  header.writeUInt16LE(1, 20); // format PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bits, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// ---- OpenAI (secours) -----------------------------------------------------
const OPENAI_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const OPENAI_VOICE = process.env.OPENAI_TTS_VOICE || "ash";
const OPENAI_INSTRUCTIONS =
  "Voix chaude de disquaire radio, à la FIP ou Nova. Posée, complice, " +
  "naturelle, comme si tu confiais une histoire à une seule personne autour " +
  "d'un verre. Débit tranquille, jamais récité.";

const openaiTag = () => `openai:${OPENAI_MODEL}:${OPENAI_VOICE}`;

async function synthOpenAI(text: string): Promise<Buffer> {
  const response = await axios.post(
    "https://api.openai.com/v1/audio/speech",
    {
      model: OPENAI_MODEL,
      voice: OPENAI_VOICE,
      input: text,
      instructions: OPENAI_INSTRUCTIONS,
      response_format: "mp3",
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      responseType: "arraybuffer",
    },
  );
  return Buffer.from(response.data);
}

// ---- Point d'entrée -------------------------------------------------------
export async function generateVoice(text: string): Promise<Buffer> {
  // 1) Gemini en priorité (voix premium) si la clé est présente.
  if (process.env.GEMINI_API_KEY) {
    const tag = geminiTag();
    const cached = await getCachedTts(tag, text);
    if (cached) return cached;
    try {
      const audio = await synthGemini(text);
      await setCachedTts(tag, text, audio);
      return audio;
    } catch (e: any) {
      // Quota Gemini, erreur réseau… : on bascule sur OpenAI sans casser l'émission.
      console.error(
        "[voice] Gemini TTS indisponible, repli OpenAI :",
        e?.response?.status || e?.message,
      );
    }
  }

  // 2) OpenAI : secours, ou défaut si pas de clé Gemini.
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Aucun fournisseur TTS configuré (ni Gemini ni OpenAI)");
  }
  const tag = openaiTag();
  const cached = await getCachedTts(tag, text);
  if (cached) return cached;
  const audio = await synthOpenAI(text);
  await setCachedTts(tag, text, audio);
  return audio;
}
