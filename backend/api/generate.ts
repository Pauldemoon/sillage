import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "crypto";
import { generateAngle } from "./agents/angle";
import { buildPlaylist } from "./agents/playlist";
import { generateNarration, fitNarrationToBudget } from "./agents/narration";
import { verifyNarration } from "./agents/verify";
import { reviewEpisode } from "./agents/episode";
import { generateVoice } from "./agents/voice";
import {
  reviewPlaylist,
  type EditorialReview,
  type TrackDossier,
} from "./agents/editor";
import { planBroadcast } from "./agents/producer";
import { planPacing, countWords } from "../lib/editorial/pacing";
import { researchArtist, type SourcedFact } from "../lib/research";
import { uploadNarrationAudio } from "../lib/storage";
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

// Synthèse vocale d'un texte, avec retry sur 429. Chaque texte déjà
// synthétisé tape tts_cache → 0 appel API, quasi-instantané.
async function synthOne(text: string): Promise<Buffer | null> {
  if (!text) return null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await generateVoice(text);
    } catch (e: any) {
      if (e?.response?.status === 429 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      } else {
        throw e;
      }
    }
  }
  return null;
}

// Synthèse vocale EN PARALLÈLE (OpenAI TTS encaisse les appels concurrents ;
// le séquentiel d'avant n'existait que pour le plan ElevenLabs Starter, retiré).
// Chaque voix est hébergée sur Supabase Storage et renvoyée en URL : expo-audio
// lit une URL mais pas un data-URI base64, et ça garde la réponse /generate
// légère. Repli sur un data-URI seulement si l'hébergement échoue.
async function synthNarrations(narrationTexts: string[]): Promise<string[]> {
  return Promise.all(
    narrationTexts.map(async (text) => {
      const buf = await synthOne(text);
      if (!buf) return "";
      const url = await uploadNarrationAudio(buf);
      return url ?? `data:audio/mpeg;base64,${buf.toString("base64")}`;
    }),
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

// Layer 2 — pool de candidats validés, dérivé des voyages déjà en cache pour
// cette graine. On agrège les morceaux de découverte (hors graine) de tous
// les voyages, classés par fréquence d'apparition (les plus éprouvés d'abord).
// Aucun stockage ni appel DB supplémentaire : on réutilise journeyCandidates.
function buildCandidatePool(
  candidates: CachedJourney<JourneyCore>[],
  limit = 12,
): { title: string; artist: string }[] {
  const counts = new Map<
    string,
    { title: string; artist: string; count: number }
  >();

  for (const journey of candidates) {
    // On saute la position 1 (la graine) : elle est toujours imposée.
    for (const track of journey.payload.tracks.slice(1)) {
      const key = `${normalize(track.title)}|${normalize(track.artist)}`;
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else
        counts.set(key, {
          title: track.title,
          artist: track.artist,
          count: 1,
        });
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ title, artist }) => ({ title, artist }));
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
  // 0 = une seule review (attribution des rôles éditoriaux), SANS passe de
  // remplacement : on évite une 2e vague de recherche + résolution Spotify,
  // gros poste de latence. Compromis assumé pour tenir sous 60 s.
  const maxReplacementRounds = 0;

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

// --- Génération ASYNCHRONE (jobs) -----------------------------------------
// iOS coupe DUR toute requête HTTP à 60 s (limite native NSURLSession, non
// contournable côté JS/OTA — le heartbeat ne suffit pas). Une génération neuve
// dure ~110-160 s → impossible à tenir en une seule requête. On découpe :
//   POST {title,artist,memory} → démarre un job, renvoie {jobId} tout de suite
//   POST {jobId}               → renvoie {status:"pending"|"done"|"error"}
// Chaque requête est courte → jamais le mur des 60 s. Le travail lourd tourne
// en fond. Stockage en mémoire (Railway = 1 instance) ; si le service
// redémarre pendant un job, le poll renvoie "inconnu" et l'app relance.
type Job =
  | { status: "pending"; ts: number }
  | { status: "done"; result: unknown; ts: number }
  | { status: "error"; message: string; ts: number };

const jobs = new Map<string, Job>();
const JOB_TTL_MS = 15 * 60 * 1000;

function sweepJobs() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.ts > JOB_TTL_MS) jobs.delete(id);
  }
}

// Lance la génération en fond en réutilisant runHandler TEL QUEL, via un faux
// res qui capture le JSON final au lieu de l'écrire sur une socket.
function startGenerationJob(
  title: string,
  artist: string,
  memory: unknown,
): string {
  const id = randomUUID();
  jobs.set(id, { status: "pending", ts: Date.now() });

  const mockRes: any = {
    headersSent: false,
    setHeader() {},
    flushHeaders() {},
    write() {},
    end() {},
    status(code: number) {
      this._code = code;
      return this;
    },
    json(body: any) {
      if ((this._code && this._code >= 400) || body?.error) {
        jobs.set(id, {
          status: "error",
          message: body?.message || body?.error || "Génération échouée",
          ts: Date.now(),
        });
      } else {
        jobs.set(id, { status: "done", result: body, ts: Date.now() });
      }
    },
  };

  Promise.resolve(
    runHandler(
      { method: "POST", body: { title, artist, memory } } as any,
      mockRes,
    ),
  ).catch((err: any) => {
    console.error(err);
    jobs.set(id, {
      status: "error",
      message: err?.message || "Erreur interne",
      ts: Date.now(),
    });
  });

  return id;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { jobId, title, artist, memory } = req.body || {};

  // Poll : l'app interroge un job déjà lancé. Requête courte.
  if (jobId) {
    const job = jobs.get(jobId);
    if (!job) {
      return res.status(200).json({
        status: "error",
        message: "Job inconnu (serveur redémarré ?) — relance l'émission.",
      });
    }
    if (job.status === "pending") return res.status(200).json({ status: "pending" });
    jobs.delete(jobId);
    if (job.status === "error")
      return res.status(200).json({ status: "error", message: job.message });
    return res.status(200).json({ status: "done", emission: job.result });
  }

  // Démarrage : on crée le job et on rend la main immédiatement.
  if (!title || !artist)
    return res.status(400).json({ error: "title and artist required" });
  sweepJobs();
  const id = startGenerationJob(title, artist, memory);
  return res.status(200).json({ status: "pending", jobId: id });
}

async function runHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { title, artist, memory } = req.body;
  if (!title || !artist)
    return res.status(400).json({ error: "title and artist required" });

  // La génération neuve dure ~100 s. La couche réseau d'iOS abandonne une
  // requête restée sans octet ~60 s : on stream donc un espace toutes les 10 s
  // pour garder la connexion vivante. Le corps final reste un JSON valide
  // (espaces de tête autorisés). Effet de bord : dès qu'on a streamé, le code
  // HTTP est figé à 200 → les erreurs se signalent via le champ `error`.
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  const finishJson = (statusCode: number, body: unknown) => {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    if (res.headersSent) {
      res.end(JSON.stringify(body));
    } else {
      res.status(statusCode).json(body);
    }
  };

  try {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    (res as any).flushHeaders?.();
    res.write(" ");
    heartbeat = setInterval(() => {
      try {
        res.write(" ");
      } catch {
        // client déconnecté : on ignore.
      }
    }, 10000);

    const _t0 = Date.now();
    const _lap = (s: string) =>
      console.error(`⏱ ${s} +${((Date.now() - _t0) / 1000).toFixed(1)}s`);

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
      return finishJson(200, {
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
    _lap("seedResearch");

    // Agent 1 — angle éditorial basé sur des faits réels.
    // On évite les archétypes déjà servis à cet auditeur pour cette graine.
    const { angle, description, archetype } = await generateAngle(
      title,
      artist,
      seedResearch.facts,
      heardArchetypesFor(journeyCandidates, heardJourneys),
    );
    _lap("angle");

    // Agent 2 — playlist (nourrie du pool de candidats validés, Layer 2)
    const candidatePool = buildCandidatePool(journeyCandidates);
    const tracks = await buildPlaylist(
      title,
      artist,
      angle,
      description,
      seedResearch.facts,
      memoryProfile,
      candidatePool,
    );

    if (tracks.length === 0) {
      throw new Error("No Spotify tracks found for generated playlist");
    }
    _lap("playlist");

    const initialDossiers = await buildDossiers(tracks, seedResearch);
    _lap("buildDossiers");
    const { dossiers, summaries: editorialSummaries } = await curateDossiers(
      title,
      artist,
      angle,
      description,
      initialDossiers,
      memoryProfile,
    );
    _lap("curateDossiers");
    const curatedTracks = dossiers.map((dossier) => dossier.track);
    const broadcastPlan = planBroadcast(curatedTracks);
    const narrationStartIndex = Math.min(
      Math.max(broadcastPlan.narrationStartsBeforeTrackIndex, 0),
      Math.max(curatedTracks.length - 1, 0),
    );

    // Agent 3 — narrations SÉQUENTIELLES : chaque narration lit le texte
    // EXACT des précédentes. C'est ce qui tue les redites, les gabarits
    // identiques et les spoilers entre narrations — le « mal construit ».
    // Le parallèle était un compromis forcé par le cap 60 s de Vercel ;
    // Railway n'a pas ce cap, on paie ~10-15 s de plus par narration une
    // seule fois par voyage neuf (Layer 3 ressert les suivants).
    // La vérification factuelle, elle, reste hors du chemin critique : elle
    // ne corrige que des détails et ne nourrit pas la narration suivante.
    // L'horloge de l'émission : un rôle et un budget de mots par narration
    // (lancement / lien / loupe / sortie) — le rythme d'une vraie radio,
    // pas une suite de monologues de même taille.
    const pacingPlan = planPacing(curatedTracks.length - narrationStartIndex);
    const narrationTexts = Array<string>(curatedTracks.length).fill("");
    const previousDrafts: string[] = [];
    const verifications: Promise<void>[] = [];
    for (let i = narrationStartIndex; i < curatedTracks.length; i++) {
      const pacingSlot = pacingPlan[i - narrationStartIndex];
      const draft = await generateNarration(
        curatedTracks,
        angle,
        description,
        i,
        {
          emissionFacts: seedResearch.facts,
          currentTrackFacts: dossiers[i].facts,
          previousTrackFacts: dossiers[i - 1]?.facts,
        },
        [...previousDrafts],
        pacingSlot,
      );
      previousDrafts.push(draft);

      const verificationFacts = [
        `[Angle de l'émission]\n${seedResearch.facts}`,
        `[Morceau courant]\n${dossiers[i].facts}`,
        dossiers[i - 1] ? `[Morceau précédent]\n${dossiers[i - 1].facts}` : "",
      ]
        .filter(Boolean)
        .join("\n\n---\n\n");
      verifications.push(
        verifyNarration(draft, verificationFacts, {
          min: pacingSlot.minWords,
          max: pacingSlot.maxWords,
        }).then(async (verified) => {
          // Garde-fou d'horloge : les consignes seules ne tiennent pas le
          // budget (le modèle imite la longueur des narrations précédentes).
          // Au-delà de 10% de dépassement, une passe de montage compresse.
          let final = verified;
          if (countWords(final) > pacingSlot.maxWords * 1.1) {
            final = await fitNarrationToBudget(
              final,
              pacingSlot.minWords,
              pacingSlot.maxWords,
            ).catch(() => final);
          }
          narrationTexts[i] = final;
        }),
      );
    }
    await Promise.all(verifications);
    _lap("narrations+verify");

    // Agent 3bis — relecture d'ÉPISODE : gabarits répétés, redites et
    // closers-slogans sont invisibles narration par narration ; on relit
    // l'ensemble d'un seul regard avant de passer au studio.
    const trackLabels = curatedTracks.map(
      (track) => `${track.title} — ${track.artist}`,
    );
    const reviewedTexts = await reviewEpisode(
      angle,
      trackLabels,
      narrationTexts,
      pacingPlan,
    );
    for (let i = 0; i < narrationTexts.length; i++) {
      narrationTexts[i] = reviewedTexts[i];
    }
    _lap("episodeReview");

    const audioUrls = await synthNarrations(narrationTexts);
    _lap("synthNarrations");

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

    return finishJson(200, {
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
    return finishJson(500, {
      error: "Generation failed",
      message: err.message,
      url: err.config?.url,
      stack: err.stack?.split("\n").slice(0, 3),
    });
  }
}
