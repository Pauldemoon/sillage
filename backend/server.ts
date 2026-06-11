// Serveur HTTP persistant pour héberger le backend hors Vercel (Render,
// Railway…) — ces plateformes n'ont pas le cap 60 s par requête du tier
// gratuit Vercel, ce qui laisse la génération (~50-65 s) aller au bout.
// On réutilise TELS QUELS les handlers Vercel (req, res compatibles Express) :
// aucun changement de logique, Charlie garde toute sa profondeur.
import express from "express";
import generate from "./api/generate";
import seed from "./api/seed";
import search from "./api/search";
import intro from "./api/intro";
import debug from "./api/debug";
import spotifySwap from "./api/spotify/swap";
import spotifyRefresh from "./api/spotify/refresh";

const app = express();
app.use(express.json({ limit: "2mb" }));
// Le SDK Spotify (token swap/refresh) envoie en form-urlencoded, pas en JSON :
// sans ce parseur, req.body est vide → "code required". Vercel le parsait
// automatiquement ; sur Express il faut l'ajouter explicitement.
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// CORS permissif (inoffensif : l'app native n'en a pas besoin, mais utile
// pour tester depuis un navigateur).
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  next();
});

// Adapte un handler Vercel en handler Express, avec filet anti-crash.
const route =
  (handler: (req: any, res: any) => Promise<unknown> | unknown) =>
  (req: express.Request, res: express.Response) => {
    Promise.resolve(handler(req, res)).catch((e: any) => {
      console.error(e);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal error", message: e?.message });
      } else {
        res.end();
      }
    });
  };

app.all("/api/generate", route(generate));
app.all("/api/seed", route(seed));
app.all("/api/search", route(search));
app.all("/api/intro", route(intro));
app.all("/api/debug", route(debug));
app.all("/api/spotify/swap", route(spotifySwap));
app.all("/api/spotify/refresh", route(spotifyRefresh));

app.get("/", (_req, res) => res.send("Sillage backend OK"));

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Sillage backend listening on :${port}`));
