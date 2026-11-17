// Z64: pasto que crece bajo las cuatro luces del escenario (secuencia SILLAS). Lógica PURA (sin three, sin imports),
// testeable en Node (scripts/pasto-test.mjs). La avanza components/Pasto.tsx una vez por frame con el dt del reloj
// de la experiencia (0 en pausa → quieto) y la posición XZ de la cámara.
//
// Cuartos: el área es el rectángulo que contiene las 4 luces con un margen (MARGEN_M); cada cuarto es la celda de
// Voronoi de su luz (los puntos más cerca de esa luz que de las otras), recortada al rectángulo.
// Progreso p (0…1) por cuarto:
//   bajo la luz (distancia < RADIO_LUZ_M para entrar, < RADIO_LUZ_M + 0,3 para seguir adentro: histéresis)
//   → p sube 1/CRECE_S por segundo; si no y p < 1 → baja 1/DECAE_S; en 1 queda COMPLETO.
//   Z74: ya no exige la luz encendida (REQUIERE_LUZ_ENCENDIDA = true vuelve a Z64).
// Forma: cada punto del suelo tiene un umbral u (umbralPasto) y se ve cuando p > u; al decaer usa el MISMO umbral,
// así se retira en el orden exactamente inverso. La réplica en GLSL está en components/Pasto.tsx.
// Eventos (para el gancho alight:pasto-cuarto): ev[i] = 0 nada · 1 "crece" · 2 "decae" · 3 "completo" (este frame).

export interface CfgPasto {
  ACTIVO: boolean; RADIO_LUZ_M: number; CRECE_S: number; DECAE_S: number;
  IRREGULARIDAD: number; ESCALA_MANCHA_M: number; FRENTE_ANCHO: number; SIMULAR: number;   // SIMULAR: −1 o 0…3
  REQUIERE_LUZ_ENCENDIDA?: boolean;   // Z74: false (default) = basta con estar bajo la luz; true = como Z64
}
export type EvPasto = 0 | 1 | 2 | 3;
export interface EstadoPasto {
  p: number[]; dentro: boolean[]; completo: boolean[]; tendencia: number[];   // tendencia: 1 crece, −1 decae, 0 quieto
  ev: EvPasto[];
  todoEmitido: boolean;   // Z65: alight:pasto-completo ya salió (una vez hasta el próximo reinicio)
  // Z74: extensión hasta el borde del círculo del piso (lib/pastoExt.ts). ext = progreso 0…1
  ext: number; extFase: "espera" | "arranque" | "crece" | "completo"; extT: number;
}
export function crearEstadoPasto(): EstadoPasto {
  return { p: [0, 0, 0, 0], dentro: [false, false, false, false], completo: [false, false, false, false], tendencia: [0, 0, 0, 0], ev: [0, 0, 0, 0], todoEmitido: false,
    ext: 0, extFase: "espera", extT: 0 };
}
/** Estado compartido (lo avanza Pasto.tsx; lo lee el menú debug y cualquier sistema que quiera el progreso). */
export const PASTO = crearEstadoPasto();
export const NOMBRES_EV = ["", "crece", "decae", "completo"] as const;
export const HISTERESIS_M = 0.3;
export const DT_MAX = 0.1;

const fin = (x: number, d = 0): number => (Number.isFinite(x) ? x : d);
const sat = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Reinicia (checkpoints, "Reiniciar pasto"). */
export function reiniciarPasto(s: EstadoPasto): void {
  for (let i = 0; i < 4; i++) { s.p[i] = 0; s.dentro[i] = false; s.completo[i] = false; s.tendencia[i] = 0; s.ev[i] = 0; }
  s.todoEmitido = false;
  s.ext = 0; s.extFase = "espera"; s.extT = 0;   // Z74: la extensión vuelve a 0 con el pasto (checkpoints, botón)
}
/** Z65: true UNA sola vez cuando los 4 cuartos quedan completos (para alight:pasto-completo); se rearma al reiniciar. */
export function chequearTodoCompleto(s: EstadoPasto): boolean {
  if (s.todoEmitido) return false;
  for (let i = 0; i < 4; i++) if (!s.completo[i]) return false;
  s.todoEmitido = true;
  return true;
}
/** Lleva el cuarto i a completo (botones de debug). */
export function completarCuarto(s: EstadoPasto, i: number): void {
  if (i < 0 || i > 3) return;
  s.p[i] = 1;
  if (!s.completo[i]) { s.completo[i] = true; s.ev[i] = 3; }
  s.tendencia[i] = 0;
}

/** Un frame. ux, uz: posición del usuario; lucesX/Z: centro de cada luz; on[i]: luz encendida. */
export function avanzarPasto(s: EstadoPasto, c: CfgPasto, dt: number, ux: number, uz: number,
  lucesX: ArrayLike<number>, lucesZ: ArrayLike<number>, on: ArrayLike<boolean>): EstadoPasto {
  const d = Math.min(DT_MAX, Math.max(0, fin(dt)));
  const R = Math.max(0.05, fin(c.RADIO_LUZ_M, 1.2));
  const vC = 1 / Math.max(0.1, fin(c.CRECE_S, 14)), vD = 1 / Math.max(0.1, fin(c.DECAE_S, 7));
  const sim = Math.round(fin(c.SIMULAR, -1));
  for (let i = 0; i < 4; i++) {
    s.ev[i] = 0;
    const dist = Math.hypot(fin(ux) - fin(lucesX[i]), fin(uz) - fin(lucesZ[i]));
    s.dentro[i] = s.dentro[i] ? dist < R + HISTERESIS_M : dist < R;
    if (!c.ACTIVO || s.completo[i]) { s.tendencia[i] = 0; continue; }
    // Z74: la presencia alcanza (on[i] solo cuenta con REQUIERE_LUZ_ENCENDIDA, como en Z64)
    const presente = sim === i || (s.dentro[i] && (!c.REQUIERE_LUZ_ENCENDIDA || !!on[i]));
    let tend = 0;
    if (presente) { s.p[i] = sat(s.p[i] + vC * d); tend = d > 0 ? 1 : s.tendencia[i]; }
    else if (s.p[i] > 0) { s.p[i] = sat(s.p[i] - vD * d); tend = d > 0 ? -1 : s.tendencia[i]; }
    if (s.p[i] >= 1) { s.p[i] = 1; s.completo[i] = true; s.ev[i] = 3; s.tendencia[i] = 0; continue; }
    if (tend !== s.tendencia[i] && tend !== 0) s.ev[i] = tend > 0 ? 1 : 2;
    if (s.p[i] <= 0 && !presente) tend = 0;
    s.tendencia[i] = tend;
  }
  return s;
}

/** Celda de Voronoi (índice de la luz más cercana). */
export function cuartoDe(x: number, z: number, lucesX: ArrayLike<number>, lucesZ: ArrayLike<number>): number {
  let mejor = 0, dm = Infinity;
  for (let i = 0; i < 4; i++) { const d = (x - lucesX[i]) ** 2 + (z - lucesZ[i]) ** 2; if (d < dm) { dm = d; mejor = i; } }
  return mejor;
}

/** Rectángulo del área (min/max X y Z): las 4 luces + margen. Escribe en out. */
export function rectPasto(lucesX: ArrayLike<number>, lucesZ: ArrayLike<number>, margen: number, out: number[]): number[] {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < 4; i++) { x0 = Math.min(x0, lucesX[i]); x1 = Math.max(x1, lucesX[i]); z0 = Math.min(z0, lucesZ[i]); z1 = Math.max(z1, lucesZ[i]); }
  const m = Math.max(0, fin(margen));
  out[0] = x0 - m; out[1] = z0 - m; out[2] = x1 + m; out[3] = z1 + m;
  return out;
}

/** Distancia máxima de la luz i a un punto de su cuarto (muestreo de la celda recortada al rectángulo). */
export function distMaxCuarto(i: number, lucesX: ArrayLike<number>, lucesZ: ArrayLike<number>, rect: ArrayLike<number>, n = 48): number {
  let dm = 0.01;
  for (let a = 0; a <= n; a++) for (let b = 0; b <= n; b++) {
    const x = rect[0] + ((rect[2] - rect[0]) * a) / n, z = rect[1] + ((rect[3] - rect[1]) * b) / n;
    // un punto del borde compartido cuenta para todas las celdas que lo comparten (sin desempate por índice)
    let dmin = Infinity; for (let k = 0; k < 4; k++) dmin = Math.min(dmin, (x - lucesX[k]) ** 2 + (z - lucesZ[k]) ** 2);
    const di = (x - lucesX[i]) ** 2 + (z - lucesZ[i]) ** 2;
    if (di > dmin + 1e-6) continue;
    dm = Math.max(dm, Math.sqrt(di));
  }
  return dm;
}

// ── ruido de valor 2D propio (réplica exacta del GLSL de Pasto.tsx) ──
const fract = (x: number): number => x - Math.floor(x);
export function hashPasto(x: number, y: number): number {
  const a = fract(x * 0.1271 + y * 0.3113), b = fract(y * 0.2177 + x * 0.0719);
  return fract((a + b + a * b * 61.7) * 43.13 + a * 17.9);
}
export function ruidoPasto(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hashPasto(ix, iy), b = hashPasto(ix + 1, iy), c = hashPasto(ix, iy + 1), d = hashPasto(ix + 1, iy + 1);
  return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy;
}
/** Manchones: dos octavas del ruido (0…1). */
export function manchaPasto(x: number, z: number, escalaM: number): number {
  const e = Math.max(0.05, fin(escalaM, 1.2));
  return 0.65 * ruidoPasto(x / e, z / e) + 0.35 * ruidoPasto(x / (e * 0.45) + 7.3, z / (e * 0.45) + 2.1);
}
/** Umbral u del punto (0…1 − FRENTE): visible cuando p > u. dn = distancia a su luz / distancia máxima del cuarto.
 *  Cerca de la luz manda la distancia (el pasto arranca justo bajo la luz); más afuera pesan los manchones. */
export function umbralPasto(dn: number, mancha: number, c: Pick<CfgPasto, "IRREGULARIDAD" | "FRENTE_ANCHO">): number {
  const d = sat(fin(dn)), irr = sat(fin(c.IRREGULARIDAD, 0.6)) * Math.min(1, d / 0.25);
  const u = d + (sat(fin(mancha)) - d) * irr;
  return u * (1 - sat(fin(c.FRENTE_ANCHO, 0.25)));
}
/** Altura relativa de las briznas (0…1) en un punto con umbral u y progreso p: crece suave en la franja del frente. */
export function alturaPasto(p: number, u: number, frente: number): number {
  const g = (fin(p) - fin(u)) / Math.max(1e-3, fin(frente, 0.25));
  const x = sat(g);
  return x * x * (3 - 2 * x);
}
