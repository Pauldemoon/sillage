import type { VercelRequest, VercelResponse } from "@vercel/node";
import { researchArtist } from "../lib/research";
import { generateAngle } from "./agents/angle";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const results: Record<string, any> = {};

  // Check env vars
  results.env = {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    spotify: !!process.env.SPOTIFY_CLIENT_ID,
    tavily: !!process.env.TAVILY_API_KEY,
  };

  // Test recherche documentaire (sources)
  try {
    const { sources } = await researchArtist("Nirvana", "Nirvana");
    results.research = { ok: true, sources: sources.map((s) => s.source) };
  } catch (e: any) {
    results.research = { ok: false, error: e.message };
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
