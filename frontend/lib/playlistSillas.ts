// Z104: orden de las canciones del visualizador de las SILLAS. Puro y SIN imports (prueba: scripts/playlist-sillas-test.mjs).
// La lista de /public la descubre /api/music-list como siempre; esto solo decide el ORDEN: primero los de ORDEN_INICIAL
// (music.mp3, anycolour.mp3, breathe.mp3; sin distinguir mayúsculas, por nombre exacto; si falta uno se omite; con
// duplicados por mayúsculas se usa el primero) y después una permutación al azar (con semilla) de todo el resto, sin
// repetir esos tres. Después de esta lista, vizAudio sigue como siempre (al azar, sin repetir los dos últimos), sin
// volver a fijar los tres primeros.

export interface ListaSillas { lista: string[]; fijos: string[]; resto: string[]; faltantes: string[] }

/** Generador congruencial (determinista con la semilla): 0 ≤ x < 1. */
function azar(semilla: number): () => number {
  let x = (Math.floor(Number.isFinite(semilla) ? semilla : 1) >>> 0) || 1;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
}
/**
 * Lista final a partir de los nombres encontrados (como los devuelve /api/music-list). Con activo false: el
 * comportamiento anterior (solo music.mp3 primero; el resto lo elige vizAudio al azar, así que `resto` queda vacío).
 */
export function armarListaSillas(nombres: readonly string[], ordenInicial: readonly string[], semilla: number, activo = true): ListaSillas {
  // nombres únicos sin distinguir mayúsculas (el primero gana)
  const vistos = new Set<string>(), unicos: string[] = [];
  for (const n of nombres) { if (typeof n !== "string" || !n) continue; const k = n.toLowerCase(); if (!vistos.has(k)) { vistos.add(k); unicos.push(n); } }
  const porClave = new Map(unicos.map(n => [n.toLowerCase(), n]));
  const inicial = activo ? ordenInicial : ordenInicial.slice(0, 1);
  const fijos: string[] = [], faltantes: string[] = [], usados = new Set<string>();
  for (const o of inicial) {
    const k = String(o).toLowerCase();
    if (usados.has(k)) continue;
    const real = porClave.get(k);
    if (real) { fijos.push(real); usados.add(k); } else faltantes.push(String(o));
  }
  if (!activo) return { lista: fijos, fijos, resto: [], faltantes };
  const resto = unicos.filter(n => !usados.has(n.toLowerCase()));
  const r = azar(semilla);
  for (let i = resto.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = resto[i]; resto[i] = resto[j]; resto[j] = t; }
  return { lista: [...fijos, ...resto], fijos, resto, faltantes };
}
