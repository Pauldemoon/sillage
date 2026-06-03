// Petit journal de debug affiché à l'écran (overlay dans le player) pour
// diagnostiquer à distance : chaque étape Spotify/audio/flux y écrit une ligne
// horodatée, et l'écran s'y abonne. Activé tant qu'on règle la lecture.

type Listener = (lines: string[]) => void;

const lines: string[] = [];
const listeners = new Set<Listener>();
let startMs = 0;

function stamp(): string {
  if (startMs === 0) startMs = Date.now();
  return ((Date.now() - startMs) / 1000).toFixed(1).padStart(5, " ");
}

export function logDebug(msg: string): void {
  lines.push(`${stamp()}s  ${msg}`);
  if (lines.length > 60) lines.shift();
  const snapshot = [...lines];
  listeners.forEach((l) => l(snapshot));
}

export function subscribeDebug(l: Listener): () => void {
  listeners.add(l);
  l([...lines]);
  return () => {
    listeners.delete(l);
  };
}

// Raccourci pour logger une erreur avec son message complet (utile pour les
// erreurs natives Spotify, qui empilent plusieurs phrases).
export function logError(where: string, e: unknown): void {
  const msg =
    e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
  logDebug(`❌ ${where}: ${String(msg).replace(/\s+/g, " ").slice(0, 200)}`);
}
