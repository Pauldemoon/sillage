import type { VercelRequest, VercelResponse } from "@vercel/node";
import { searchTracks } from "../lib/spotify";

// Autocomplete endpoint for the search box: returns up to 8 track
// suggestions for a free-text query (title and/or artist). Picking a
// suggestion gives the app a fully resolved seed track, so the old
// exact title+artist lookup (and its 404s) is no longer needed.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const q = (req.query.q ?? req.body?.q ?? "").toString().trim();
  if (q.length < 2) {
    return res.json({ tracks: [] });
  }

  try {
    const tracks = await searchTracks(q, 8);
    return res.json({
      tracks: tracks.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        cover: t.cover,
        spotifyUri: t.spotifyUri,
        duration: t.duration,
      })),
    });
  } catch (err: any) {
    console.error(err);
    return res
      .status(500)
      .json({ error: "Search failed", message: err.message });
  }
}
