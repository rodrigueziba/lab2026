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
  // Z75: modo de la pose ("linea_sillas" | "desplazamiento" | "manual"; sin MODO = "desplazamiento", como Z65)
  MODO?: string; MARGEN_LINEA_SILLAS_M?: number; DIST_MIN_OBJETOS_M?: number;
}
/** Rectángulo en XZ (x0 < x1, z0 < z1). */
export interface RectXZ { x0: number; z0: number; x1: number; z1: number }
export interface PoseEntrada { x: number; z: number; yawDeg: number; pitchDeg: number; ajustada: boolean; modo: string; desplazM: number; lateralBordeM: number }
export function crearPoseEntrada(): PoseEntrada { return { x: 0, z: 0, yawDeg: 0, pitchDeg: 0, ajustada: false, modo: "desplazamiento", desplazM: 0, lateralBordeM: 0 }; }
/** Última pose calculada (la lee el menú debug). */
export const POSE_ENTRADA = crearPoseEntrada();

/** Escribe en out la pose final. salaMedia: medio lado caminable de la sala; tarima: centro hacia donde mirar. */
export function poseEntrada(c: CfgPoseEntrada, salaMedia: number, obstaculos: readonly RectXZ[],
  tarima: { x: number; z: number }, out: PoseEntrada, sillas: readonly RectXZ[] = [], zonas: readonly ZonaXZ[] = []): PoseEntrada {
  const yaw = (fin(c.YAW_DEG, 0) * Math.PI) / 180, modo = modoEntrada(c.MODO);
  let d = modo === "desplazamiento" ? fin(c.DESPLAZ_IZQ_M ?? 0, 0) : 0, borde = 0;
  if (modo === "linea_sillas" && sillas.length) {   // Z75: lateral = borde exterior de la fila + margen
    borde = bordeLateralSillas(sillas, c.YAW_DEG);
    d = borde + Math.max(0, fin(c.MARGEN_LINEA_SILLAS_M ?? 1, 1)) - lateralDe(fin(c.POS_X, 0), fin(c.POS_Z, 0), c.YAW_DEG);
  }
  let x = fin(c.POS_X, 0) - Math.cos(yaw) * d, z = fin(c.POS_Z, 0) + Math.sin(yaw) * d;
  let ajustada = false;
  // Z75: zonas que disparan algo (ZONA_SILLAS, ZONA_TARIMA): si la pose cae adentro, se la saca radialmente (el mínimo)
  for (const q of zonas) {
    const dx = x - q.x, dz = z - q.z, r = Math.hypot(dx, dz), R = Math.max(0, q.radio);
    if (r >= R) continue;
    ajustada = true;
    if (r < 1e-6) { x = q.x + R + 0.01; } else { x = q.x + (dx / r) * (R + 0.01); z = q.z + (dz / r) * (R + 0.01); }
  }
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
  if (c.MIRAR_TARIMA && modo !== "manual") {   // Z75: en manual el yaw va tal cual
    const dx = tarima.x - x, dz = tarima.z - z;
    if (dx * dx + dz * dz > 1e-6) yawDeg = (Math.atan2(-dx, -dz) * 180) / Math.PI;   // mirada (−sin, −cos) = dirección a la tarima
  }
  out.x = x; out.z = z; out.yawDeg = yawDeg; out.pitchDeg = fin(c.PITCH_DEG, 0); out.ajustada = ajustada;
  out.modo = modo; out.desplazM = d; out.lateralBordeM = borde;
  return out;
}

// ── Z75: modos de la pose y regla "linea_sillas" ──
// Coordenada lateral de un punto = su proyección sobre la izquierda de la mirada (−cos yaw, sin yaw). Borde exterior de
// la fila = la mayor lateral de las esquinas de las sillas (el punto de la fila más a la izquierda de la mirada).
// linea_sillas: desde (POS_X, POS_Z) se corre sobre la izquierda hasta lateral = borde + MARGEN_LINEA_SILLAS_M; se
// conserva la coordenada sobre la mirada (la "profundidad"), el yaw y el pitch. Mismo mecanismo que Z65 (DESPLAZ_IZQ_M),
// pero con el desplazamiento calculado desde la geometría de las sillas (acompaña a DBG_LAYOUT).
export type ModoEntrada = "linea_sillas" | "desplazamiento" | "manual";
/** Círculo en XZ (zona que dispara algo al entrar). */
export interface ZonaXZ { x: number; z: number; radio: number }
export function modoEntrada(v: string | undefined): ModoEntrada {
  return v === "linea_sillas" || v === "manual" ? v : "desplazamiento";
}
/** Coordenada lateral (m) del punto (x, z) hacia la izquierda de la mirada con ese yaw (grados). */
export function lateralDe(x: number, z: number, yawDeg: number): number {
  const y = (fin(yawDeg, 0) * Math.PI) / 180;
  return -Math.cos(y) * x + Math.sin(y) * z;
}
/** Borde exterior de la fila: la mayor coordenada lateral de las esquinas de las sillas (huellas en el piso). */
export function bordeLateralSillas(sillas: readonly RectXZ[], yawDeg: number): number {
  let b = -Infinity;
  for (const r of sillas) {
    b = Math.max(b, lateralDe(r.x0, r.z0, yawDeg), lateralDe(r.x1, r.z0, yawDeg), lateralDe(r.x0, r.z1, yawDeg), lateralDe(r.x1, r.z1, yawDeg));
  }
  return Number.isFinite(b) ? b : 0;
}
/** Distancia (XZ) del punto al rectángulo (0 adentro). */
export function distARect(x: number, z: number, r: RectXZ): number {
  return Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
}
