// Z65: los monolitos vuelven cuando el pasto está completo en los 4 cuartos. Puro y sin imports (se prueba en Node:
// scripts/monolitos-pasto-test.mjs). Lo usa components/Pasto.tsx (MonolitosPasto), que avanza la aparición con el dt
// del reloj de la experiencia (0 en pausa → quieto) y deja el resultado en MONO_PASTO; components/Monoliths.tsx lo
// lee en su useFrame (posición en la línea de la tarima y subida desde el suelo).
//
// Condición (MONOLITOS_MODO): "pasto" = los 4 cuartos con completo = true · "siempre" · "nunca". MONOLITOS_ACTIVO es
// el interruptor maestro (false = nunca, sin montar, como Z64).
// Posición: misma Z que el centro de la tarima; X = borde del pasto (rectángulo de las luces + MARGEN_M) ± (MONOLITO_SEP_M
// libre + medio ancho del monolito), uno a cada lado. Se recalcula cada frame (cambia con MARGEN_M o las luces).

export type ModoMonolitos = "pasto" | "siempre" | "nunca";
export interface CfgMonolitosPasto {
  MONOLITOS_ACTIVO: boolean; MONOLITOS_MODO: string; MONOLITO_SEP_M: number;
  MONOLITOS_APARICION_S: number; MONOLITOS_BAJADA_S: number;
}
/** Estado compartido: lo escribe MonolitosPasto, lo lee Monoliths. usar = false → Monoliths como antes (Z41). */
export const MONO_PASTO = { usar: false, xL: 0, xR: 0, z: 0, k: 0, objetivo: false };

const fin = (x: number, d = 0): number => (Number.isFinite(x) ? x : d);

export function todosCompletos(completo: ArrayLike<boolean>): boolean {
  for (let i = 0; i < 4; i++) if (!completo[i]) return false;
  return true;
}

/** ¿Se montan los monolitos? (interruptor maestro y modo distinto de "nunca") */
export function monolitosMontados(c: CfgMonolitosPasto): boolean {
  return !!c.MONOLITOS_ACTIVO && c.MONOLITOS_MODO !== "nunca";
}

/** ¿Deben estar a la vista? */
export function monolitosObjetivo(c: CfgMonolitosPasto, completo: ArrayLike<boolean>): boolean {
  if (!monolitosMontados(c)) return false;
  if (c.MONOLITOS_MODO === "siempre") return true;
  return todosCompletos(completo);
}

/** Centro de cada monolito. rect = [xmin, zmin, xmax, zmax] del pasto; anchoM = ancho total del monolito (base). */
export function posMonolitosPasto(rect: ArrayLike<number>, sepM: number, anchoM: number, tarimaZ: number,
  out: { xL: number; xR: number; z: number }): { xL: number; xR: number; z: number } {
  const d = Math.max(0, fin(sepM, 1)) + Math.max(0, fin(anchoM, 1.334)) / 2;
  out.xL = fin(rect[0]) - d;
  out.xR = fin(rect[2]) + d;
  out.z = fin(tarimaZ);
  return out;
}

/** Aparición 0…1: sube en APARICION_S; baja en BAJADA_S (0 = al instante, junto con el pasto). dt del reloj de la
 *  experiencia (acotado a 0,1 s). */
export function avanzarAparicion(k: number, objetivo: boolean, dt: number, c: CfgMonolitosPasto): number {
  const d = Math.min(0.1, Math.max(0, fin(dt)));
  const kk = Math.min(1, Math.max(0, fin(k)));
  if (objetivo) return Math.min(1, kk + d / Math.max(0.01, fin(c.MONOLITOS_APARICION_S, 3)));
  const b = fin(c.MONOLITOS_BAJADA_S, 0);
  if (b <= 0) return 0;
  return Math.max(0, kk - d / b);
}

/** Curva de la subida (suave al arrancar y al llegar). */
export function suaveAparicion(k: number): number {
  const x = Math.min(1, Math.max(0, fin(k)));
  return x * x * (3 - 2 * x);
}

/** Hundimiento (m) del monolito bajo el suelo para una aparición k: alto completo + 5 cm en 0, nada en 1. */
export function hundimientoM(k: number, altoM: number): number {
  return -(1 - suaveAparicion(k)) * (Math.max(0, fin(altoM, 3.2)) + 0.05);
}
