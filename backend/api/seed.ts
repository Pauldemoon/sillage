import type { VercelRequest, VercelResponse } from "@vercel/node";
import { searchTrack } from "../lib/spotify";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { title, artist } = req.body;
  if (!title || !artist) {
    return res.status(400).json({ error: "title and artist required" });
  }

  try {
    const track = await searchTrack(title, artist);
    if (!track) {
      return res.status(404).json({ error: "Track not found" });
    }

    return res.json({
      id: track.id,
      title: track.title,
      artist: track.artist,
      cover: track.cover,
      spotifyUri: track.spotifyUri,
      duration: track.duration,
      sources: [],
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({
      error: "Seed lookup failed",
      message: err.message,
    });
  }
}
