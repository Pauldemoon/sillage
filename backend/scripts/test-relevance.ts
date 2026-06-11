// Validation du filtre de pertinence sur le cas pathologique du banc.
import { researchArtist } from "../lib/research";

const seed = { title: "Sexual Healing", artist: "Marvin Gaye" };
researchArtist(seed.title, seed.artist).then((r) => {
  console.log(`\nSources retenues (${r.sources.length}) :`);
  for (const s of r.sources) console.log(`  - ${s.source}`);
  console.log(`\nDossier : ${r.facts.length} caractères`);
});
