import { createHash } from "crypto";
import { getCache } from "./cache/client";

// Narration audio is stored in a public Supabase Storage bucket and served
// as a plain https URL. The app's audio player (expo-audio) can stream a
// remote URL but NOT a base64 `data:` URI, and inlining MP3s as base64 also
// bloated the generate response to several MB. Files are keyed by content
// hash, so identical narration text reuses the same object (free dedup).

const BUCKET = "narrations";
let bucketReady = false;

async function ensureBucket(
  client: NonNullable<ReturnType<typeof getCache>>,
): Promise<void> {
  if (bucketReady) return;
  // Idempotent: ignores the "already exists" error on subsequent cold starts.
  await client.storage
    .createBucket(BUCKET, { public: true })
    .catch(() => undefined);
  bucketReady = true;
}

// L'audio peut être du MP3 (OpenAI) ou du WAV (Gemini, PCM emballé). On lit
// les octets de tête pour étiqueter correctement le fichier — un WAV servi
// en audio/mpeg ne se lit pas dans l'app.
function audioFormat(buf: Buffer): { ext: string; contentType: string } {
  if (buf.length >= 4 && buf.toString("ascii", 0, 4) === "RIFF") {
    return { ext: "wav", contentType: "audio/wav" };
  }
  return { ext: "mp3", contentType: "audio/mpeg" };
}

export async function uploadNarrationAudio(
  buf: Buffer,
): Promise<string | null> {
  const client = getCache();
  if (!client) return null;

  try {
    await ensureBucket(client);
    const { ext, contentType } = audioFormat(buf);
    const path = `${createHash("sha1").update(buf).digest("hex")}.${ext}`;
    const { error } = await client.storage
      .from(BUCKET)
      .upload(path, buf, { contentType, upsert: true });
    if (error) {
      console.error("[storage] narration upload failed:", error.message);
      return null;
    }
    return client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch (e: any) {
    console.error("[storage] narration upload threw:", e?.message);
    return null;
  }
}
