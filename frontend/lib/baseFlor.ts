// Z67: base de la flor sobre la tarima. Lógica PURA (sin three, sin imports), testeable en Node
// (scripts/base-flor-test.mjs). La usan components/BaseFlor.tsx (hueco, grietas, astillas, pasto) y Tarima.tsx (el
// hueco real en la cara superior: los fragmentos de adentro se descartan).
//
// Todo sigue a la escala de la flor (FLOR.escala, lib/prismaFlor.ts) según la fase:
//   nace   (la escala sube):  hueco primero, grietas con un leve retraso, pasto con más retraso
//   achica (la escala baja):  el pasto se va primero (adelanto), las grietas se cierran, el hueco al final
// La fase se detecta por el signo del cambio de la escala (quieta → se conserva: pausa, flor fija en el pico).

export type FaseBase = "nace" | "achica";
export interface EstadoBase { fase: FaseBase; prev: number; hueco: number; grietas: number; pasto: number; escala: number }
export function crearEstadoBase(): EstadoBase { return { fase: "nace", prev: 0, hueco: 0, grietas: 0, pasto: 0, escala: 0 }; }
/** Estado compartido (lo avanza BaseFlor; lo leen Tarima y el menú). */
export const BASE = crearEstadoBase();

/** Uniforms del hueco compartidos con el material de la tarima ({ value } planos: sin three). */
export const HUECO_U = { uHuecoR: { value: 0 }, uHuecoIrr: { value: 0.6 }, uHuecoSemilla: { value: 7 } };

const fin = (x: number, d = 0): number => (Number.isFinite(x) ? x : d);
const sat = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
/** smoothstep de x entre a y b. */
export function tramoB(x: number, a: number, b: number): number {
  if (!(b > a)) return x >= b ? 1 : 0;
  const u = sat((x - a) / (b - a));
  return u * u * (3 - 2 * u);
}

// tramos de escala de cada parte según la fase [desde, hasta]
export const TRAMOS = {
  nace:   { hueco: [0, 0.2], grietas: [0.05, 0.7], pasto: [0.15, 0.85] },
  achica: { hueco: [0, 0.15], grietas: [0, 0.5], pasto: [0.35, 1.0] },
} as const;

/** Progreso de cada parte para una escala y una fase (función pura, monótona en la escala dentro de cada fase). */
export function progresoBase(escala: number, fase: FaseBase, out: { hueco: number; grietas: number; pasto: number }) {
  const e = sat(fin(escala)), T = TRAMOS[fase === "achica" ? "achica" : "nace"];
  out.hueco = tramoB(e, T.hueco[0], T.hueco[1]);
  out.grietas = tramoB(e, T.grietas[0], T.grietas[1]);
  out.pasto = tramoB(e, T.pasto[0], T.pasto[1]);
  return out;
}

/** Un frame: detecta la fase y actualiza los progresos. Al cambiar de fase a mitad de camino (raro: el ciclo va de 0 a 1
 *  y de 1 a 0), cada progreso se mueve como mucho VEL_MAX por segundo hacia el nuevo valor (sin saltos). Sin allocations. */
export const VEL_MAX = 1.5;
const _obj = { hueco: 0, grietas: 0, pasto: 0 };
function mover(a: number, b: number, paso: number, extremo: boolean): number {
  return Math.abs(b - a) <= paso || extremo ? b : a + Math.sign(b - a) * paso;
}
export function avanzarBase(s: EstadoBase, escala: number, dt: number): EstadoBase {
  const e = sat(fin(escala)), d = Math.max(0, fin(dt));
  if (e > s.prev + 1e-6) s.fase = "nace";
  else if (e < s.prev - 1e-6) s.fase = "achica";
  if (e <= 0) s.fase = "nace";   // sin flor: la próxima vez arranca naciendo
  s.prev = e; s.escala = e;
  progresoBase(e, s.fase, _obj);
  const paso = VEL_MAX * d, ext = e <= 0 || e >= 1;
  s.hueco = mover(s.hueco, _obj.hueco, paso, ext);
  s.grietas = mover(s.grietas, _obj.grietas, paso, ext);
  s.pasto = mover(s.pasto, _obj.pasto, paso, ext);
  return s;
}
export function reiniciarBase(s: EstadoBase): void { s.fase = "nace"; s.prev = 0; s.hueco = 0; s.grietas = 0; s.pasto = 0; s.escala = 0; }

/** Radio del borde irregular del hueco en el ángulo a (m). Réplica exacta de RADIO_HUECO_GLSL. */
export function radioHueco(a: number, R: number, irr: number, semilla: number): number {
  const s = fin(semilla, 7), k = sat(fin(irr, 0.6));
  const n = 0.12 * Math.sin(3 * a + s) + 0.08 * Math.sin(7 * a + 2.1 * s) + 0.05 * Math.sin(13 * a + 0.7 * s);
  return Math.max(0, fin(R)) * (1 + k * n);
}
export const RADIO_HUECO_GLSL = /* glsl */`
  float radioHueco(float a, float R, float irr, float s) {
    float n = 0.12 * sin(3.0 * a + s) + 0.08 * sin(7.0 * a + 2.1 * s) + 0.05 * sin(13.0 * a + 0.7 * s);
    return R * (1.0 + clamp(irr, 0.0, 1.0) * n);
  }
`;

/** Degradado térmico de la flor (réplica de termico() de FlorCiclo, en sRGB) para m 0…1 y paleta 0…1. Sin allocations. */
// colores [r, g, b] original y del proyecto: azul marino, rojo, naranja, lima (FlorCiclo.tsx); o = casi negro
const _TA = [0.07, 0.07, 0.42, 0.122, 0.498, 0.722], _TB = [0.95, 0.07, 0.03, 0.753, 0.333, 0.184];
const _TC = [1.0, 0.4, 0.08, 0.941, 0.455, 0.165], _TD = [0.62, 0.86, 0.12, 0.957, 0.714, 0.18], _TO = [0.04, 0.015, 0.03];
export function colorTermico(m: number, paleta: number, out: number[]): number[] {
  const P = sat(fin(paleta)), mm = sat(fin(m));
  const k1 = tramoB(mm, 0, 0.2), k2 = tramoB(mm, 0.18, 0.38), k3 = tramoB(mm, 0.38, 0.65), k4 = tramoB(mm, 0.65, 1);
  for (let i = 0; i < 3; i++) {
    const a = _TA[i] + (_TA[i + 3] - _TA[i]) * P, b = _TB[i] + (_TB[i + 3] - _TB[i]) * P;
    const c = _TC[i] + (_TC[i + 3] - _TC[i]) * P, d = _TD[i] + (_TD[i + 3] - _TD[i]) * P;
    let v = a + (_TO[i] - a) * k1;
    v += (b - v) * k2; v += (c - v) * k3; v += (d - v) * k4;
    out[i] = v;
  }
  return out;
}
/** m del degradado en la base del tallo (vU = 0 en el shader de la flor) para su fase de color. */
export function mBaseTallo(fase: number): number {
  const x = ((-fin(fase)) % 1 + 1) % 1;
  return 1 - Math.abs(2 * x - 1);
}

/** Generador pseudoaleatorio con semilla (mulberry32): astillas siempre iguales. */
export function aleatorio(semilla: number): () => number {
  let a = (Math.round(fin(semilla, 7)) * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
