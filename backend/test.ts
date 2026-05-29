import * as dotenv from "dotenv";
dotenv.config();

import { researchArtist } from "./lib/research";
import { generateAngle } from "./api/agents/angle";
import { buildPlaylist } from "./api/agents/playlist";
import { generateNarration } from "./api/agents/narration";
import { generateVoice } from "./api/agents/voice";
import { buildMemoryProfile } from "./lib/memory/profile";
import * as fs from "fs";

async function test() {
  const memory = buildMemoryProfile();

  console.log("1. Test Spotify + Firecrawl...");
  const { facts, sources } = await researchArtist(
    "Smells Like Teen Spirit",
    "Nirvana",
  );
  console.log("   ✅ Sources:", sources.map((s) => s.source).join(", "));

  console.log("2. Agent 1 — angle...");
  const { angle, description } = await generateAngle(
    "Smells Like Teen Spirit",
    "Nirvana",
    facts,
  );
  console.log("   ✅ Angle:", angle);

  console.log("3. Agent 2 — playlist...");
  const tracks = await buildPlaylist(
    "Smells Like Teen Spirit",
    "Nirvana",
    angle,
    description,
    facts,
    memory,
  );
  tracks.forEach((t, i) =>
    console.log(`   ${i + 1}. ${t.title} — ${t.artist}`),
  );

  console.log("4. Agent 3 — narration intro...");
  const narration = await generateNarration(tracks, angle, description, 0, {
    emissionFacts: facts,
    currentTrackFacts: facts,
    nextTrackFacts: facts,
  });
  console.log("   ✅ Narration:", narration.slice(0, 150) + "...");

  console.log("5. Agent 4 — voix ElevenLabs...");
  const audio = await generateVoice(narration);
  fs.writeFileSync("test-output.mp3", audio);
  console.log("   ✅ Audio généré:", audio.length, "bytes → test-output.mp3");

  console.log("\n🎉 Pipeline complet OK !");
}

test().catch(console.error);
