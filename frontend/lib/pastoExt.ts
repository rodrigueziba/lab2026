// Z74: extensión del pasto desde el rectángulo de las luces hasta el borde del círculo del piso. Lógica PURA (sin
// imports), testeable en Node (scripts/pasto-ext-test.mjs). La usa components/PastoExtension.tsx.
//
// Cuándo: con los 4 cuartos completos y los monolitos ya aparecidos (k = 1), EXT_ARRANQUE_S después el frente avanza
// durante EXT_DURACION_S. Automática y permanente (no depende de la presencia). Reloj de la experiencia (pausa = quieta).
// "manual": solo con el botón. Si el pasto se reinicia (checkpoint, botón), reiniciarPasto pone la extensión en 0.
// Forma: cada punto fuera del rectángulo y dentro del círculo tiene un umbral u (misma técnica que los cuartos: mezcla
// de su distancia normalizada y del ruido de manchas, umbralPasto de lib/pasto.ts) y se ve cuando ext > u.
//   distancia normalizada dn = dR / (dR + dC): dR = distancia al rectángulo, dC = distancia al borde del círculo
//   → 0 en el borde del rectángulo y 1 en el borde del círculo, en TODAS las direcciones.
// Costo: bloques de ~CHUNK_M con capas solo cerca (DIST_MAX_M), en cuadro y con pasto; tope EXT_MAX_BLOQUES (los más
// cercanos). Más lejos, el suelo lejano barato. La selección usa arreglos preasignados (sin allocations por frame).

export const RADIO_PISO_M = 28;   // disco del piso del domo (ThreeScene: circleGeometry 28) = DOME_R de ExperienceDome
export type FaseExt = "espera" | "arranque" | "crece" | "completo";
export interface EstadoExt { ext: number; extFase: FaseExt; extT: number }
export interface CfgExt {
  EXT_ACTIVO: boolean; EXT_MODO: string; EXT_ARRANQUE_S: number; EXT_DURACION_S: number;
}
const fin = (x: number, d = 0): number => (Number.isFinite(x) ? x : d);

/** Radio de la extensión: "auto" = el del disco del piso, o el número dado. */
export function radioExt(v: string | number): number {
  const n = typeof v === "number" ? v : Number(v);
  return v === "auto" || !Number.isFinite(n) || n <= 0 ? RADIO_PISO_M : n;
}

/** Un frame. listo = 4 cuartos completos y monolitos aparecidos. Devuelve 1 si empezó a crecer, 2 si se completó (para
 *  alight:pasto-extendido), 0 si nada. */
export function avanzarExtension(s: EstadoExt, c: CfgExt, dt: number, listo: boolean): 0 | 1 | 2 {
  const d = Math.min(0.1, Math.max(0, fin(dt)));
  if (!c.EXT_ACTIVO) { s.ext = 0; s.extFase = "espera"; s.extT = 0; return 0; }
  if (s.extFase === "espera") {
    if (listo && c.EXT_MODO !== "manual") { s.extFase = "arranque"; s.extT = 0; }
    else return 0;
  }
  if (s.extFase === "arranque") {
    s.extT += d;
    if (s.extT < Math.max(0, fin(c.EXT_ARRANQUE_S, 2))) return 0;
    s.extFase = "crece"; s.extT = 0;
    return 1;
  }
  if (s.extFase === "crece") {
    s.ext = Math.min(1, s.ext + d / Math.max(0.1, fin(c.EXT_DURACION_S, 25)));
    if (s.ext >= 1) { s.ext = 1; s.extFase = "completo"; return 2; }
  }
  return 0;
}
/** Botón "Extender pasto ahora": empieza a crecer desde donde está (sin arranque). */
export function extenderAhora(s: EstadoExt): 0 | 1 {
  if (s.extFase === "crece" || s.extFase === "completo") return 0;
  s.extFase = "crece"; s.extT = 0;
  return 1;
}
export function reiniciarExtension(s: EstadoExt): void { s.ext = 0; s.extFase = "espera"; s.extT = 0; }

/** Distancia (XZ) al rectángulo rect = [x0, z0, x1, z1] (0 adentro). */
export function distRect(x: number, z: number, rect: ArrayLike<number>): number {
  const dx = Math.max(rect[0] - x, 0, x - rect[2]), dz = Math.max(rect[1] - z, 0, z - rect[3]);
  return Math.hypot(dx, dz);
}
/** Distancia normalizada de la extensión: 0 en el borde del rectángulo, 1 en el borde del círculo (−1 = fuera de la zona). */
export function dnExt(x: number, z: number, rect: ArrayLike<number>, R: number): number {
  const dR = distRect(x, z, rect), r = Math.hypot(x, z);
  if (dR <= 0 || r > R) return -1;
  const dC = R - r;
  return dR / Math.max(1e-6, dR + dC);
}

// ── bloques ──
export interface BloqueExt { x0: number; z0: number; x1: number; z1: number; cx: number; cz: number; w: number; d: number; uMin: number }
/** Bloques de ~chunkM que tocan la zona de la extensión (fuera del rectángulo, dentro del círculo). Muestreo 9 × 9. */
export function armarBloquesExt(rect: ArrayLike<number>, R: number, chunkM: number): BloqueExt[] {
  const c = Math.max(0.5, fin(chunkM, 4)), n = Math.max(1, Math.round((2 * R) / c)), lado = (2 * R) / n;
  const out: BloqueExt[] = [];
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    const x0 = -R + a * lado, z0 = -R + b * lado, x1 = x0 + lado, z1 = z0 + lado;
    let toca = false;
    for (let i = 0; i <= 8 && !toca; i++) for (let j = 0; j <= 8 && !toca; j++) {
      const x = x0 + lado * (0.001 + 0.998 * i / 8), z = z0 + lado * (0.001 + 0.998 * j / 8);
      if (dnExt(x, z, rect, R) >= 0) toca = true;
    }
    if (toca) out.push({ x0, z0, x1, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: lado, d: lado, uMin: 0 });
  }
  return out;
}
/** Umbral mínimo (− margen) de los puntos del bloque en la zona. umbralEn(x, z, dn) = umbralPasto(dn, mancha(x, z)). */
export function umbralMinBloqueExt(b: BloqueExt, rect: ArrayLike<number>, R: number, umbralEn: (x: number, z: number, dn: number) => number, n = 12): number {
  let u = Infinity;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    const x = b.x0 + (b.w * i) / n, z = b.z0 + (b.d * j) / n, dn = dnExt(x, z, rect, R);
    if (dn >= 0) u = Math.min(u, umbralEn(x, z, dn));
  }
  return Number.isFinite(u) ? Math.max(0, u - 0.05) : 0;
}

/** Elige hasta max bloques elegibles, los de menor distancia. elegible[k] = 1 si se puede dibujar (en cuadro, con pasto,
 *  cerca); dist[k] = distancia del ojo. Escribe los índices en out (ordenados de cerca a lejos) y devuelve cuántos.
 *  Sin allocations: inserción en el arreglo de salida (n bloques × max). */
export function seleccionarBloques(dist: ArrayLike<number>, elegible: ArrayLike<number>, n: number, max: number, out: Int32Array, outDist: Float32Array): number {
  const tope = Math.max(0, Math.min(Math.floor(fin(max, 60)), out.length, outDist.length));
  let k = 0;
  for (let i = 0; i < n; i++) {
    if (!elegible[i]) continue;
    const d = dist[i];
    if (k === tope && (tope === 0 || d >= outDist[k - 1])) continue;
    let j = k < tope ? k++ : tope - 1;
    while (j > 0 && outDist[j - 1] > d) { out[j] = out[j - 1]; outDist[j] = outDist[j - 1]; j--; }
    out[j] = i; outDist[j] = d;
  }
  return k;
}

/** Recortes: el pasto no atraviesa la base de los monolitos (cuadrada, anchoM) más un margen. Radio del círculo libre. */
export function radioRecorteMonolito(anchoM: number, margenM = 0.3): number {
  return (Math.max(0, fin(anchoM, 1.334)) / 2) * Math.SQRT2 + Math.max(0, fin(margenM, 0.3));
}
