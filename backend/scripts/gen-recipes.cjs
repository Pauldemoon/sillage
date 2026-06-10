// Régénère lib/editorial/recipes.ts depuis angle-recipes.md (source humaine).
// Usage : node scripts/gen-recipes.cjs
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const md = fs.readFileSync(path.join(root, "lib/editorial/angle-recipes.md"), "utf8");

let family = "";
const recipes = [];
for (const line of md.split("\n")) {
  const fam = line.match(/^## \d+ — (.+)$/);
  if (fam) {
    family = fam[1].trim();
    continue;
  }
  const rec = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s*(?:—\s*(.+))?$/);
  if (rec) recipes.push({ family, title: rec[1].trim(), detail: (rec[2] || "").trim() });
}

const body = recipes
  .map(
    (r) =>
      `  { family: ${JSON.stringify(r.family)}, title: ${JSON.stringify(r.title)}, detail: ${JSON.stringify(r.detail)} },`,
  )
  .join("\n");

const ts = `// Banque de recettes d'angles — générée depuis angle-recipes.md (source
// humaine) par scripts/gen-recipes.cjs. Ne pas éditer à la main : modifier le
// .md puis régénérer. En module TS plutôt qu'en lecture de fichier au runtime :
// zéro dépendance au cwd en prod.
//
// Une recette est une LENTILLE éditoriale, pas un angle fini : l'agent angle
// l'incarne avec les faits réels de la graine. On n'injecte JAMAIS les 100
// dans un prompt : un tirage aléatoire (~12) par génération suffit et garde
// les angles frais d'une émission à l'autre.

export interface AngleRecipe {
  family: string;
  title: string;
  detail: string;
}

export const ANGLE_RECIPES: AngleRecipe[] = [
${body}
];

// Tirage aléatoire sans remise (Fisher-Yates) : la variété vient du tirage,
// la pertinence vient du choix laissé à l'agent parmi les tirées.
export function sampleRecipes(n = 12): AngleRecipe[] {
  const shuffled = [...ANGLE_RECIPES];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

export function formatRecipes(recipes: AngleRecipe[]): string {
  return recipes
    .map((r) => \`- \${r.title} (\${r.family}) : \${r.detail}\`)
    .join("\\n");
}
`;

fs.writeFileSync(path.join(root, "lib/editorial/recipes.ts"), ts);
console.log(`✅ ${recipes.length} recettes → lib/editorial/recipes.ts (${ts.length} car.)`);
