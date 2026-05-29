import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateAngle } from "./agents/angle";
import { buildPlaylist } from "./agents/playlist";
import { generateNarration } from "./agents/narration";
import { verifyNarration } from "./agents/verify";
import { generateVoice } from "./agents/voice";
import {
  reviewPlaylist,
  type EditorialReview,
  type TrackDossier,
} from "./agents/editor";
import { planBroadcast } from "./agents/producer";
import { researchArtist, type SourcedFact } from "../lib/research";
import { findBestTrackMatch, type SpotifyTrack } from "../lib/spotify";
import {
  buildMemoryPatch,
  buildMemoryProfile,
  type UserMemoryProfile,
} from "../lib/memory/profile";
import {
  getJourneyCandidates,
  saveJourney,
  type CachedJourney,
} from "../lib/cache/journeys";

function publicSources(sources: SourcedFact[]) {
  const seen = new Set<string>();

  return sources
    .filter((source) => {
      const key = source.url || source.source;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8)
    .map((source) => ({ label: source.source, url: source.url }));
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sameArtist(a: string, b: string) {
  return normalize(a) === normalize(b);
}

function sameTrack(a: SpotifyTrack, b: SpotifyTrack) {
  return (
    normalize(a.title) === normalize(b.title) && sameArtist(a.artist, b.artist)
  );
}

// --- Layer 3 : voyage mis en cache (sans audio) ---------------------------
// Tout ce qui rend un voyage rejouable, hors audio (resynthétisé depuis les
// textes → tape tts_cache) et hors profil/patch mémoire (recalculés par
// utilisateur). Les pistes gardent title/artist : suffisant pour la mémoire.
interface JourneyCore {
  angle: string;
  description: string;
  archetype: string;
  broadcastPlan: ReturnType<typeof planBroadcast>;
  editorialSummary: string;
  tracks: {
    id: string;
    title: string;
    artist: string;
    cover: string;
    spotifyUri: string;
    duration: number;
    editorialRole?: string;
    editorialReason?: string;
    sources: { label: string; url: string }[];
  }[];
  narrations: string[];
}

// Synthèse vocale séquentielle (plan ElevenLabs Starter = 2 requêtes max).
// Chaque texte déjà synthétisé tape tts_cache → 0 appel API, quasi-instantané.
async function synthNarrations(narrationTexts: string[]): Promise<string[]> {
  const audioBuffers = Array<Buffer | null>(narrationTexts.length).fill(null);
  for (let i = 0; i < narrationTexts.length; i++) {
    const text = narrationTexts[i];
    if (!text) continue;

    let buf: Buffer | null = null;
    for (let attempt = 0; attempt < 3 && !buf; attempt++) {
      try {
        buf = await generateVoice(text);
      } catch (e: any) {
        if (e?.response?.status === 429 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        } else {
          throw e;
        }
      }
    }
    audioBuffers[i] = buf;
  }

  return audioBuffers.map((buf) =>
    buf ? `data:audio/mpeg;base64,${buf.toString("base64")}` : "",
  );
}

// Choisit un voyage déjà en cache pour cette graine, en respectant la
// politique de diversité : jamais un voyage déjà entendu, jamais un artiste
// rejeté, et on privilégie un archétype d'angle que l'auditeur n'a pas connu.
function pickReusableJourney(
  candidates: CachedJourney<JourneyCore>[],
  memory: UserMemoryProfile,
  heardJourneys: string[],
): CachedJourney<JourneyCore> | null {
  const heard = new Set(heardJourneys);
  const isDisliked = (artist: string) =>
    memory.dislikedArtists.some((disliked) => sameArtist(disliked, artist));

  const fresh = candidates.filter(
    (journey) =>
      !heard.has(journey.journeyId) && !journey.artists.some(isDisliked),
  );
  if (fresh.length === 0) return null;

  const heardArchetypes = new Set(
    candidates
      .filter((journey) => heard.has(journey.journeyId))
      .map((journey) => journey.archetype),
  );

  // Priorité à un archétype neuf ; sinon, le plus ancien voyage non entendu.
  return (
    fresh.find((journey) => !heardArchetypes.has(journey.archetype)) || fresh[0]
  );
}

// Archétypes déjà servis à cet auditeur pour cette graine : on les évite
// lors d'une génération neuve pour garantir un voyage différent.
function heardArchetypesFor(
  candidates: CachedJourney<JourneyCore>[],
  heardJourneys: string[],
): string[] {
  const heard = new Set(heardJourneys);
  return [
    ...new Set(
      candidates
        .filter((journey) => heard.has(journey.journeyId))
        .map((journey) => journey.archetype),
    ),
  ];
}

async function buildDossiers(
  tracks: SpotifyTrack[],
  seedResearch: Awaited<ReturnType<typeof researchArtist>>,
): Promise<TrackDossier[]> {
  const research = await Promise.all(
    tracks.map((track, index) =>
      index === 0
        ? Promise.resolve(seedResearch)
        : researchArtist(track.title, track.artist),
    ),
  );

  return tracks.map((track, index) => ({
    track,
    facts: research[index].facts,
    sources: research[index].sources,
  }));
}

function applyAssignments(
  dossiers: TrackDossier[],
  review: EditorialReview,
): TrackDossier[] {
  return dossiers.map((dossier, index) => {
    const assignment = review.assignments.find(
      (item) => item.position === index + 1,
    );

    return {
      ...dossier,
      editorialRole: assignment?.role || dossier.editorialRole,
      editorialReason: assignment?.reason || dossier.editorialReason,
    };
  });
}

async function applyReplacements(
  dossiers: TrackDossier[],
  review: EditorialReview,
  memory: UserMemoryProfile,
): Promise<TrackDossier[]> {
  const isDisliked = (artist: string) =>
    memory.dislikedArtists.some((disliked) => sameArtist(disliked, artist));

  const next = [...dossiers];
  const replacements = review.replacements
    .filter(
      (replacement) => replacement.position >= 2 && replacement.position <= 5,
    )
    .slice(0, 2);

  // Résolution Spotify + recherche documentaire en parallèle : ce sont les
  // deux opérations les plus lentes du pipeline. On applique ensuite les
  // remplacements séquentiellement pour garder une déduplication déterministe.
  const resolved = await Promise.all(
    replacements.map(async (replacement) => {
      const track = await findBestTrackMatch(
        replacement.title,
        replacement.artist,
      ).catch(() => null);
      if (!track) return null;
      // Garde-fou : ne jamais réintroduire un artiste rejeté via un remplacement.
      if (isDisliked(track.artist)) return null;
      const research = await researchArtist(track.title, track.artist);
      return { replacement, track, research };
    }),
  );

  for (const item of resolved) {
    if (!item) continue;
    const { replacement, track, research } = item;
    const index = replacement.position - 1;

    const duplicate = next.some(
      (dossier, dossierIndex) =>
        dossierIndex !== index &&
        (sameTrack(dossier.track, track) ||
          sameArtist(dossier.track.artist, track.artist)),
    );
    if (duplicate) continue;

    next[index] = {
      track,
      facts: research.facts,
      sources: research.sources,
      editorialRole: replacement.role,
      editorialReason: replacement.reason,
    };
  }

  return next.filter(Boolean).slice(0, 5);
}

async function curateDossiers(
  seedTitle: string,
  seedArtist: string,
  angle: string,
  description: string,
  dossiers: TrackDossier[],
  memory: UserMemoryProfile,
): Promise<{ dossiers: TrackDossier[]; summaries: string[] }> {
  let current = dossiers;
  const summaries: string[] = [];
  const maxReplacementRounds = 2;

  for (let pass = 0; pass <= maxReplacementRounds; pass++) {
    const review = await reviewPlaylist(
      seedTitle,
      seedArtist,
      angle,
      description,
      current,
      memory,
    );
    summaries.splice(0, summaries.length, review.summary);
    current = applyAssignments(current, review);

    if (review.replacements.length === 0 || pass === maxReplacementRounds) {
      break;
    }

    const replaced = await applyReplacements(current, review, memory);
    const unchanged =
      replaced.length === current.length &&
      replaced.every(
        (dossier, index) =>
          current[index] && sameTrack(dossier.track, current[index].track),
      );

    if (unchanged) {
      break;
    }
    current = replaced;
  }

  return { dossiers: current, summaries };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { title, artist, memory } = req.body;
  if (!title || !artist)
    return res.status(400).json({ error: "title and artist required" });

  try {
    const memoryProfile = buildMemoryProfile(memory);
    const heardJourneys: string[] = Array.isArray(memory?.heardJourneys)
      ? memory.heardJourneys
      : [];

    // --- Layer 3 : tenter de resservir un voyage déjà préparé -------------
    // Si un voyage existe pour cette graine, qu'il n'a pas été entendu et ne
    // contient aucun artiste rejeté, on le rejoue. L'audio est resynthétisé
    // depuis les textes (tape tts_cache) : quasi-instantané, 0 appel TTS,
    // 0 appel Claude. Sinon on génère un voyage neuf et on le mémorise.
    const journeyCandidates = await getJourneyCandidates<JourneyCore>(
      title,
      artist,
    );
    const reusable = pickReusableJourney(
      journeyCandidates,
      memoryProfile,
      heardJourneys,
    );
    if (reusable) {
      const core = reusable.payload;
      const audioUrls = await synthNarrations(core.narrations);
      console.log(
        `Voyage réutilisé (${reusable.journeyId}, archétype ${core.archetype})`,
      );
      return res.json({
        angle: core.angle,
        description: core.description,
        broadcastPlan: core.broadcastPlan,
        editorialSummary: core.editorialSummary,
        memoryProfile,
        memoryPatch: buildMemoryPatch(core.tracks, artist),
        journeyId: reusable.journeyId,
        cached: true,
        tracks: core.tracks,
        narrations: core.narrations,
        audioUrls,
      });
    }

    // Recherche initiale : elle sert à trouver l'angle global de l'émission.
    const seedResearch = await researchArtist(title, artist);

    // Agent 1 — angle éditorial basé sur des faits réels.
    // On évite les archétypes déjà servis à cet auditeur pour cette graine.
    const { angle, description, archetype } = await generateAngle(
      title,
      artist,
      seedResearch.facts,
      heardArchetypesFor(journeyCandidates, heardJourneys),
    );

    // Agent 2 — playlist
    const tracks = await buildPlaylist(
      title,
      artist,
      angle,
      description,
      seedResearch.facts,
      memoryProfile,
    );

    if (tracks.length === 0) {
      throw new Error("No Spotify tracks found for generated playlist");
    }

    const initialDossiers = await buildDossiers(tracks, seedResearch);
    const { dossiers, summaries: editorialSummaries } = await curateDossiers(
      title,
      artist,
      angle,
      description,
      initialDossiers,
      memoryProfile,
    );
    const curatedTracks = dossiers.map((dossier) => dossier.track);
    const broadcastPlan = planBroadcast(curatedTracks);
    const narrationStartIndex = Math.min(
      Math.max(broadcastPlan.narrationStartsBeforeTrackIndex, 0),
      Math.max(curatedTracks.length - 1, 0),
    );

    // Agent 3 — narrations SÉQUENTIELLES, chacune consciente des précédentes
    // pour éviter les répétitions et construire une vraie progression.
    const narrationTexts = Array<string>(curatedTracks.length).fill("");
    const spokenNarrations: string[] = [];
    for (let i = narrationStartIndex; i < curatedTracks.length; i++) {
      const draft = await generateNarration(
        curatedTracks,
        angle,
        description,
        i,
        {
          emissionFacts: seedResearch.facts,
          currentTrackFacts: dossiers[i].facts,
          previousTrackFacts: dossiers[i - 1]?.facts,
          nextTrackFacts: dossiers[i + 1]?.facts,
        },
        spokenNarrations,
      );
      // Agent 4 — vérification factuelle contre les sources
      const verificationFacts = [
        `[Angle de l'émission]\n${seedResearch.facts}`,
        `[Morceau courant]\n${dossiers[i].facts}`,
        dossiers[i + 1] ? `[Morceau suivant]\n${dossiers[i + 1].facts}` : "",
      ]
        .filter(Boolean)
        .join("\n\n---\n\n");
      const verified = await verifyNarration(draft, verificationFacts);
      narrationTexts[i] = verified;
      spokenNarrations.push(verified);
    }

    const audioUrls = await synthNarrations(narrationTexts);

    const publicTracks = dossiers.map((dossier) => ({
      id: dossier.track.id,
      title: dossier.track.title,
      artist: dossier.track.artist,
      cover: dossier.track.cover,
      spotifyUri: dossier.track.spotifyUri,
      duration: dossier.track.duration,
      editorialRole: dossier.editorialRole,
      editorialReason: dossier.editorialReason,
      sources: publicSources(dossier.sources),
    }));

    // --- Layer 3 : mémoriser ce voyage neuf pour de futures écoutes -------
    // On stocke tout le rejouable SAUF l'audio (resynthétisé depuis les
    // textes). Le journeyId permet à l'app de l'ajouter à heardJourneys.
    const journeyCore: JourneyCore = {
      angle,
      description,
      archetype,
      broadcastPlan,
      editorialSummary: editorialSummaries.join(" "),
      tracks: publicTracks,
      narrations: narrationTexts,
    };
    const journeyId = await saveJourney(
      title,
      artist,
      archetype,
      curatedTracks.map((track) => track.artist),
      journeyCore,
    );

    return res.json({
      angle,
      description,
      broadcastPlan,
      editorialSummary: editorialSummaries.join(" "),
      memoryProfile,
      memoryPatch: buildMemoryPatch(curatedTracks, artist),
      journeyId,
      cached: false,
      tracks: publicTracks,
      narrations: narrationTexts,
      audioUrls,
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({
      error: "Generation failed",
      message: err.message,
      url: err.config?.url,
      stack: err.stack?.split("\n").slice(0, 3),
    });
  }
}
