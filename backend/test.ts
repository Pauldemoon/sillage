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
  const TITLE = process.argv[2] || "Smells Like Teen Spirit";
  const ARTIST = process.argv[3] || "Nirvana";
  console.log(`🎵 Graine : ${TITLE} — ${ARTIST}\n`);
  const memory = buildMemoryProfile();

  console.log("1. Test recherche documentaire (sources)...");
  const { facts, sources } = await researchArtist(TITLE, ARTIST);
  console.log("   ✅ Sources:", sources.map((s) => s.source).join(", "));
  console.log(`   📊 Dossier : ${facts.length} caractères`);
  console.log(
    "   — Début du dossier (= ce qui arrive en premier aux agents) —\n" +
      facts.slice(0, 700) +
      "\n",
  );

  console.log("2. Agent 1 — angle...");
  const { angle, description } = await generateAngle(TITLE, ARTIST, facts);
  console.log("   ✅ Angle:", angle);

  console.log("3. Agent 2 — playlist...");
  const tracks = await buildPlaylist(TITLE, ARTIST, angle, description, facts, memory);
  tracks.forEach((t, i) =>
    console.log(`   ${i + 1}. ${t.title} — ${t.artist}`),
  );

  console.log("4. Agent 3 — narration intro...");
  const narration = await generateNarration(tracks, angle, description, 0, {
    emissionFacts: facts,
    currentTrackFacts: facts,
  });
  console.log("   ✅ Narration:", narration.slice(0, 150) + "...");

  console.log("5. Agent 4 — voix OpenAI TTS...");
  const audio = await generateVoice(narration);
  fs.writeFileSync("test-output.mp3", audio);
  console.log("   ✅ Audio généré:", audio.length, "bytes → test-output.mp3");

  console.log("\n🎉 Pipeline complet OK !");
}

test().catch(console.error);
