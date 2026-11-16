// Z66: optimización del pasto. Lógica PURA (testeable en Node: scripts/pasto-chunks-test.mjs). La usa components/Pasto.tsx.
//  · chunks: el rectángulo del pasto se divide en bloques de ~CHUNK_M; cada bloque se asigna a cada cuarto (celda de
//    Voronoi) que lo toca → una malla por (bloque, cuarto) con su bounding sphere, así el frustum culling funciona.
//  · culling por progreso: uMin = umbral mínimo de los puntos del bloque en su cuarto (muestreo + margen); el bloque no
//    se dibuja mientras p ≤ uMin. Se recalcula solo al reconstruir (cambian luces, margen o forma del umbral).
//  · LOD: capas por distancia del ojo al bloque, con banda de histéresis; 0 más allá de DIST_MAX_M.
//  · orden de capas: alturas reordenadas para que cualquier prefijo (instanceCount) cubra 0…1 de forma pareja.
// Sin imports (como lib/pasto.ts): la celda y el umbral llegan como funciones (cuartoDe / umbralPasto de lib/pasto.ts).
export type CuartoEn = (x: number, z: number) => number;
/** Umbral u del punto (x, z) del cuarto q, a distancia normalizada dn de su luz (= umbralPasto(dn, manchaPasto(x, z))). */
export type UmbralEn = (x: number, z: number, dn: number) => number;

export interface Chunk {
  cuarto: number; x0: number; z0: number; x1: number; z1: number; cx: number; cz: number; w: number; d: number;
  uMin: number; capas: number;   // capas: libre para quien lo use (Pasto.tsx guarda el LOD de cada bloque en un ref aparte)
}
/** Margen restado al umbral muestreado: entre muestras (cada ~0,26 m) el ruido de manchas puede bajar un poco. */
export const MARGEN_UMIN = 0.05;
/** Estado compartido para el panel de rendimiento. */
export const PASTO_RENDER = { montado: false, modo: "", chunks: 0, mallasVisibles: 0, enCuadro: 0, instancias: 0, lejanas: 0 };

const fin = (x: number, d = 0): number => (Number.isFinite(x) ? x : d);

/** Divide rect = [x0, z0, x1, z1] en bloques de ~chunkM y los asigna a los cuartos que tocan (muestreo 9 × 9). */
export function armarChunks(rect: ArrayLike<number>, cuartoEn: CuartoEn, chunkM: number): Chunk[] {
  const W = rect[2] - rect[0], D = rect[3] - rect[1], c = Math.max(0.5, fin(chunkM, 4));
  const nx = Math.max(1, Math.round(W / c)), nz = Math.max(1, Math.round(D / c));
  const out: Chunk[] = [];
  for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
    const x0 = rect[0] + (W * a) / nx, x1 = rect[0] + (W * (a + 1)) / nx, z0 = rect[1] + (D * b) / nz, z1 = rect[1] + (D * (b + 1)) / nz;
    const presentes = [false, false, false, false];
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
      // puntos apenas adentro del bloque (un borde compartido exacto no cuenta para el vecino)
      const x = x0 + (x1 - x0) * (0.001 + 0.998 * i / 8), z = z0 + (z1 - z0) * (0.001 + 0.998 * j / 8);
      presentes[cuartoEn(x, z)] = true;
    }
    for (let q = 0; q < 4; q++) if (presentes[q]) {
      out.push({ cuarto: q, x0, z0, x1, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, uMin: 0, capas: -1 });
    }
  }
  return out;
}

/** Umbral mínimo (menos MARGEN_UMIN) de los puntos del bloque que pertenecen a su cuarto. n × n muestras + el punto
 *  del bloque más cercano a la luz (donde dn es mínimo). dmax: distancia máxima de la luz a su cuarto. */
export function umbralMinChunk(ch: Chunk, lx: ArrayLike<number>, lz: ArrayLike<number>, dmax: number,
  cuartoEn: CuartoEn, umbralEn: UmbralEn, n = 12): number {
  const q = ch.cuarto, dm = Math.max(0.01, fin(dmax, 1));
  let u = Infinity;
  const probar = (x: number, z: number) => {
    if (cuartoEn(x, z) !== q) return;
    const dn = Math.min(1, Math.hypot(x - lx[q], z - lz[q]) / dm);
    u = Math.min(u, umbralEn(x, z, dn));
  };
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) probar(ch.x0 + (ch.w * i) / n, ch.z0 + (ch.d * j) / n);
  probar(Math.min(ch.x1, Math.max(ch.x0, lx[q])), Math.min(ch.z1, Math.max(ch.z0, lz[q])));
  if (!Number.isFinite(u)) return 0;   // sin muestras propias (bloque casi fuera de la celda): no se descarta nunca
  return Math.max(0, u - MARGEN_UMIN);
}

/** ¿Se dibuja el bloque con el progreso p de su cuarto? (visible cuando p > u en algún punto) */
export function chunkConPasto(p: number, uMin: number): boolean { return fin(p) > 0 && fin(p) > fin(uMin); }

/** Distancia del ojo al punto más cercano de la caja del bloque (alto 0…altoM). */
export function distOjoChunk(ch: Chunk, ex: number, ey: number, ez: number, altoM: number): number {
  const dx = Math.max(ch.x0 - ex, 0, ex - ch.x1), dz = Math.max(ch.z0 - ez, 0, ez - ch.z1);
  const dy = Math.max(0 - ey, 0, ey - Math.max(0, altoM));
  return Math.hypot(dx, dy, dz);
}

export interface CfgLod { CAPAS: number; CAPAS_LEJOS: number; LOD_CERCA_M: number; LOD_LEJOS_M: number; DIST_MAX_M: number }
/** Capas para una distancia (sin histéresis). 0 desde DIST_MAX_M (ahí el shader ya descartaba todo). */
export function capasObjetivo(d: number, c: CfgLod): number {
  const capas = Math.max(1, Math.round(fin(c.CAPAS, 20))), lejos = Math.max(1, Math.min(capas, Math.round(fin(c.CAPAS_LEJOS, 6))));
  if (fin(d) >= fin(c.DIST_MAX_M, 28)) return 0;
  const a = fin(c.LOD_CERCA_M, 8), b = Math.max(a + 0.01, fin(c.LOD_LEJOS_M, 20));
  if (d <= a) return capas;
  if (d >= b) return lejos;
  return Math.round(capas + (lejos - capas) * ((d - a) / (b - a)));
}
/** Con histéresis: se conserva `actual` mientras esté entre lo que daría la distancia ± hist (capas decrece con d). */
export function capasLod(d: number, actual: number, c: CfgLod, hist: number): number {
  const h = Math.max(0, fin(hist, 0.75));
  const alto = capasObjetivo(d - h, c), bajo = capasObjetivo(d + h, c);
  if (actual >= bajo && actual <= alto) return actual;
  return capasObjetivo(d, c);
}

/** Inverso radical en base 2 (van der Corput). */
function vdc(i: number): number { let r = 0, f = 0.5; while (i > 0) { r += f * (i & 1); i >>= 1; f *= 0.5; } return r; }
/** Orden de las capas: el suelo (0) y la punta (n−1) primero; después en orden de van der Corput. Cualquier prefijo de
 *  k capas reparte las alturas en 0…1 de forma pareja (el LOD dibuja los k primeros). Escribe en out (alturas 0…1). */
export function ordenCapas(n: number, out: Float32Array): Float32Array {
  const N = Math.max(1, Math.min(out.length, Math.round(fin(n, 1))));
  if (N === 1) { out[0] = 0; return out; }
  const usado = new Array<boolean>(N).fill(false);
  let k = 0;
  const poner = (idx: number) => { usado[idx] = true; out[k++] = idx / (N - 1); };
  poner(0); poner(N - 1);
  for (let i = 1; k < N && i < 4096; i++) {
    let idx = Math.round(vdc(i) * (N - 1));
    if (usado[idx]) {   // el más cercano libre
      let s = 1;
      while (s < N && (idx - s < 0 || usado[idx - s]) && (idx + s >= N || usado[idx + s])) s++;
      if (s >= N) continue;
      idx = idx - s >= 0 && !usado[idx - s] ? idx - s : idx + s;
    }
    poner(idx);
  }
  for (let i = k; i < out.length; i++) out[i] = 1;
  return out;
}
