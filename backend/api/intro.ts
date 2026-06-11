import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateVoice } from "./agents/voice";
import { uploadNarrationAudio } from "../lib/storage";

// L'ouverture d'antenne personnalisée : « Salut Paul. Aujourd'hui, on part en
// voyage à partir de Neil Young. C'est parti. » — jouée AVANT le premier
// morceau. Phrase-gabarit (aucun appel LLM) → TTS. generateVoice met le TTS
// en cache : un prénom+graine déjà entendus ne coûtent ni temps ni argent.
function introText(
  name: string | undefined,
  title: string,
  artist: string,
): string {
  const hello = name ? `Salut ${name}. ` : "";
  // Deux registres mêlés : l'annonce (on part de X) et l'invitation
  // (ferme les yeux, installe-toi) — le ton du compagnon, pas du présentateur.
  const variants = [
    `${hello}Aujourd'hui, on part en voyage à partir de ${artist}. C'est parti.`,
    `${hello}Tout commence avec ${title}, de ${artist}. On y va.`,
    `${hello}Ferme les yeux si tu veux, détends-toi. On part de ${artist}, et on se laisse porter.`,
    `${hello}Installe-toi, je m'occupe de tout. On démarre avec ${title}. C'est parti.`,
    `${hello}Mets-toi bien. Le point de départ, c'est ${artist} — la suite, tu verras. On y va.`,
  ];
  // Choix stable par prénom+graine → la même ouverture retombe sur le cache TTS.
  const key = `${name ?? ""}|${artist}|${title}`;
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0;
  return variants[Math.abs(h) % variants.length];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { name, title, artist } = req.body || {};
  if (!title || !artist)
    return res.status(400).json({ error: "title and artist required" });

  const safeName =
    typeof name === "string" && name.trim() ? name.trim().slice(0, 30) : undefined;
  const text = introText(safeName, String(title), String(artist));

  try {
    const buf = await generateVoice(text);
    const url = await uploadNarrationAudio(buf);
    if (!url) throw new Error("upload de l'audio impossible");
    return res.status(200).json({ text, audioUrl: url });
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: "intro failed", message: e?.message });
  }
}
