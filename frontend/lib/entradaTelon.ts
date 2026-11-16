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

// ── Z65: pose final de la entrada = pose de DBG_ENTRADA + DESPLAZ_IZQ_M hacia la izquierda de la mirada ──
// Convención de three (rotación YXZ, como PointerLockControls): mirada = (−sin yaw, −cos yaw) en XZ; derecha =
// (cos yaw, −sin yaw); izquierda = (−cos yaw, sin yaw). MIRAR_TARIMA: después del desplazamiento, el yaw apunta al
// centro de la tarima (el pitch se conserva). Límites: se recorta a la sala y, si cae dentro de un obstáculo
// (tarima, sillas), se lo empuja afuera por el lado más cercano (el mínimo); `ajustada` lo avisa.
export interface CfgPoseEntrada {
  POS_X: number; POS_Z: number; YAW_DEG: number; PITCH_DEG: number; DESPLAZ_IZQ_M?: number; MIRAR_TARIMA?: boolean;
}
/** Rectángulo en XZ (x0 < x1, z0 < z1). */
export interface RectXZ { x0: number; z0: number; x1: number; z1: number }
export interface PoseEntrada { x: number; z: number; yawDeg: number; pitchDeg: number; ajustada: boolean }
export function crearPoseEntrada(): PoseEntrada { return { x: 0, z: 0, yawDeg: 0, pitchDeg: 0, ajustada: false }; }
/** Última pose calculada (la lee el menú debug). */
export const POSE_ENTRADA = crearPoseEntrada();

/** Escribe en out la pose final. salaMedia: medio lado caminable de la sala; tarima: centro hacia donde mirar. */
export function poseEntrada(c: CfgPoseEntrada, salaMedia: number, obstaculos: readonly RectXZ[],
  tarima: { x: number; z: number }, out: PoseEntrada): PoseEntrada {
  const yaw = (fin(c.YAW_DEG, 0) * Math.PI) / 180, d = fin(c.DESPLAZ_IZQ_M ?? 0, 0);
  let x = fin(c.POS_X, 0) - Math.cos(yaw) * d, z = fin(c.POS_Z, 0) + Math.sin(yaw) * d;
  let ajustada = false;
  const m = Math.max(0, fin(salaMedia, 39.5));
  if (Math.abs(x) > m || Math.abs(z) > m) { x = Math.max(-m, Math.min(m, x)); z = Math.max(-m, Math.min(m, z)); ajustada = true; }
  for (let pasada = 0; pasada < 3; pasada++) {   // un obstáculo puede empujar dentro de otro: unas pocas pasadas
    let dentro = false;
    for (const r of obstaculos) {
      if (x <= r.x0 || x >= r.x1 || z <= r.z0 || z >= r.z1) continue;
      dentro = true; ajustada = true;
      const dx0 = x - r.x0, dx1 = r.x1 - x, dz0 = z - r.z0, dz1 = r.z1 - z, mn = Math.min(dx0, dx1, dz0, dz1);
      if (mn === dx0) x = r.x0 - 0.01; else if (mn === dx1) x = r.x1 + 0.01; else if (mn === dz0) z = r.z0 - 0.01; else z = r.z1 + 0.01;
    }
    if (!dentro) break;
  }
  let yawDeg = fin(c.YAW_DEG, 0);
  if (c.MIRAR_TARIMA) {
    const dx = tarima.x - x, dz = tarima.z - z;
    if (dx * dx + dz * dz > 1e-6) yawDeg = (Math.atan2(-dx, -dz) * 180) / Math.PI;   // mirada (−sin, −cos) = dirección a la tarima
  }
  out.x = x; out.z = z; out.yawDeg = yawDeg; out.pitchDeg = fin(c.PITCH_DEG, 0); out.ajustada = ajustada;
  return out;
}
