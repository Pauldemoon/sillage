import type { VercelRequest, VercelResponse } from "@vercel/node";
import { researchArtist } from "../lib/research";
import { generateAngle } from "./agents/angle";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const results: Record<string, any> = {};

  // Check env vars
  results.env = {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    elevenlabs: !!process.env.ELEVENLABS_API_KEY,
    spotify: !!process.env.SPOTIFY_CLIENT_ID,
    firecrawl: !!process.env.FIRECRAWL_API_KEY,
  };

  // Test Firecrawl
  try {
    const { sources } = await researchArtist("Nirvana", "Nirvana");
    results.firecrawl = { ok: true, sources: sources.map((s) => s.source) };
  } catch (e: any) {
    results.firecrawl = { ok: false, error: e.message };
  }

  // Test Anthropic
  try {
    const angle = await generateAngle(
      "Smells Like Teen Spirit",
      "Nirvana",
      "Nirvana est un groupe de grunge américain.",
    );
    results.anthropic = { ok: true, angle: angle.angle };
  } catch (e: any) {
    results.anthropic = { ok: false, error: e.message };
  }

  return res.json(results);
}
