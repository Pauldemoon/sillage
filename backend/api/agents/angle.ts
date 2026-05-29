import Anthropic from "@anthropic-ai/sdk";

const getClient = () =>
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateAngle(
  title: string,
  artist: string,
  facts: string,
): Promise<{ angle: string; description: string }> {
  const response = await getClient().messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 400,
    system: `Tu es directeur éditorial d'une radio musicale, dans l'esprit de FIP ou Nova. À partir d'un morceau de départ et de faits réels sourcés, tu trouves l'angle d'une émission qui fera découvrir 5 morceaux cohérents.

Tu choisis D'ABORD un archétype d'angle dans cette palette, puis tu l'incarnes avec les faits réels du morceau :
- La filiation cachée — qui a influencé qui, la dette d'un artiste envers un autre
- Le contre-pied géographique — une ville, une scène, contre une autre
- L'objet ou le détail — une anecdote concrète qui ouvre tout un monde
- La rivalité — deux camps, deux écoles qui s'opposent
- Le moment-bascule — l'instant précis où quelque chose change dans la musique
- L'héritage — ce que ce morceau a engendré, ses enfants
- L'envers du décor — le revers, le secret, le malentendu derrière le succès
- Le fil thématique — un thème, un son, un geste commun à plusieurs morceaux

L'angle doit :
- S'appuyer sur les faits fournis, jamais sur l'invention
- Être spécifique et un peu inattendu — surtout pas "l'histoire du groupe"
- Garantir une vraie cohérence entre les 5 morceaux (attention aux contradictions : ne propose pas un angle "contre l'Angleterre" si tu comptes mettre des groupes anglais)
- Avoir un titre d'émission qui SONNE : court, rythmé, avec une accroche (4 à 9 mots)
- Être en français

Réponds UNIQUEMENT en JSON valide, sans markdown :
{"angle": "le titre de l'émission", "description": "une phrase qui explique l'angle et le fil rouge entre les morceaux"}`,
    messages: [
      {
        role: "user",
        content: `Titre de départ : "${title}" de ${artist}

Faits sourcés disponibles :
${facts}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const clean = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  return JSON.parse(clean);
}
