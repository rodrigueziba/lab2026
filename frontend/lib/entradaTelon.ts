// Z59: entrada fija después de cruzar el telón. Puro y sin imports (se prueba en Node: scripts/entrada-test.mjs).
// Lo usa components/EntradaTelon.tsx (tick por frame con la fase del destello, lib/curtainFlash.ts → FLASH_STATE.fase)
// y ThreeScene (movimiento WASD: movimientoBloqueado()).
//
// Línea de tiempo (DBG_ENTRADA):
//   cruce del telón (alight:curtain-passed)  → bloquea WASD con la razón "entrada"; espera el pico
//   destello en "sostenido" (blanco total)   → teletransporta UNA vez a la pose de entrada (no se ve el salto)
//   destello vuelve a "inactivo" (fin del glare) → espera BLOQUEO_EXTRA_S más
//   pasado el extra                          → libera SOLO la razón "entrada"
// Si el destello no llega a arrancar (apagado), teletransporta en el primer tick y sigue igual. Tope de seguridad
// TOPE_S: pase lo que pase, libera. Un checkpoint en curso cancela la entrada (manda el checkpoint).
//
// Bloqueo propio: un conjunto de razones. No toca INTERACT_STATE.movementLocked (secuencia SILLAS, terminal,
// camino LUZ, checkpoints), así que no libera bloqueos ajenos ni otros sistemas liberan este.

export interface CfgEntrada { ACTIVO: boolean; BLOQUEO_EXTRA_S: number; TOPE_S: number }
export type FaseEntrada = "inactiva" | "esperandoPico" | "esperandoFin" | "extra";
export type FaseDestello = "inactivo" | "subida" | "sostenido" | "bajada" | "glare";

export const RAZON_ENTRADA = "entrada";

/** Razones activas de bloqueo de WASD (además de movementLocked). */
export const BLOQUEO_MOV = { razones: new Set<string>() };
export function bloquearMovimiento(razon: string): void { BLOQUEO_MOV.razones.add(razon); }
export function liberarMovimiento(razon: string): void { BLOQUEO_MOV.razones.delete(razon); }
export function movimientoBloqueado(): boolean { return BLOQUEO_MOV.razones.size > 0; }

export interface EstadoEntrada { fase: FaseEntrada; t0: number; tFin: number; teletransportes: number; vioPico: boolean }
export function crearEstadoEntrada(): EstadoEntrada { return { fase: "inactiva", t0: 0, tFin: 0, teletransportes: 0, vioPico: false }; }
/** Estado compartido (lo avanza EntradaTelon). */
export const ENTRADA = crearEstadoEntrada();

const fin = (x: number, d: number): number => (Number.isFinite(x) ? x : d);

/** Cruce del telón (o "Probar entrada"). ahora en ms. Devuelve false si está desactivada. */
export function iniciarEntrada(e: EstadoEntrada, c: CfgEntrada, ahora: number): boolean {
  if (!c.ACTIVO) return false;
  e.fase = "esperandoPico"; e.t0 = ahora; e.tFin = 0; e.vioPico = false;
  bloquearMovimiento(RAZON_ENTRADA);
  return true;
}

/** Cancela (checkpoint, desmontaje): libera solo la razón propia. */
export function cancelarEntrada(e: EstadoEntrada): void {
  e.fase = "inactiva";
  liberarMovimiento(RAZON_ENTRADA);
}

/** Un frame. Devuelve true si en este frame hay que teletransportar. */
export function tickEntrada(e: EstadoEntrada, c: CfgEntrada, destello: FaseDestello, ahora: number, checkpointAplicando: boolean): boolean {
  if (e.fase === "inactiva") return false;
  if (checkpointAplicando) { cancelarEntrada(e); return false; }
  if ((ahora - e.t0) / 1000 >= Math.max(1, fin(c.TOPE_S, 12))) { cancelarEntrada(e); return false; }   // tope de seguridad
  let teleport = false;
  if (e.fase === "esperandoPico") {
    if (destello === "sostenido") { e.vioPico = true; teleport = true; e.fase = "esperandoFin"; }
    else if (destello === "inactivo" || destello === "bajada" || destello === "glare") { teleport = true; e.fase = "esperandoFin"; }   // sin pico que tape el salto
    // "subida": todavía no está en blanco total → esperar
  }
  if (e.fase === "esperandoFin" && destello === "inactivo") { e.fase = "extra"; e.tFin = ahora; }
  if (e.fase === "extra" && (ahora - e.tFin) / 1000 >= Math.max(0, fin(c.BLOQUEO_EXTRA_S, 0.3))) {
    e.fase = "inactiva";
    liberarMovimiento(RAZON_ENTRADA);
  }
  if (teleport) e.teletransportes++;
  return teleport;
}
