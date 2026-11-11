// Z28: camino LUZ — posición de la luz lejana, límites de movimiento (sala ∪ exterior) y estado.
// Objetos de módulo, sin allocations por frame.
//
// Sala: cuadrado de ±SALA_MEDIA_M (las paredes del Room de ThreeScene). Antes de Z28 no había
// ningún límite de movimiento: las paredes y el domo negro eran solo visuales.
// Exterior: disco de EXTERIOR_RADIO_M alrededor de la luz, que queda detrás del inicio (sentido
// opuesto al telón) y fuera de la sala. Caminable = sala ∪ exterior: se sale solo por el lado de
// la luz (paredes oeste y sur, cerca de la esquina); por el lado del telón y los demás, no.

import { DBG_LUZ } from "@/lib/debugConfig";
import { posicionInicialEn, EJE_TELON } from "@/lib/inicioEscena";

const _spawn = { x: 0, y: 0, z: 0 };

export type FaseLuz = "libre" | "girando" | "dialogo" | "rearmar";

export const LUZ_STATE = {
  x: 0, z: 0, y: 4.5,      // posición actual de la luz (recalculada cada frame desde DBG_LUZ)
  dLuz: 999,               // distancia horizontal cámara → luz (m)
  dSpawn: 40,              // Z31: distancia horizontal spawn → luz (m), recalculada con la posición
  cercania: 0,             // 0 lejos … 1 debajo (curva aplicada)
  fuera: false,            // el usuario está fuera del área (con histéresis) → experiencia en pausa
  fase: "libre" as FaseLuz,
};

/** Z30: estado del cielo estrellado (lo escribe CieloEstrellado, lo lee el menú de debug). */
export const CIELO_STATE = { reveal: 0, aten: 1, objetivo: 0 };

/** Recalcula la posición de la luz desde las constantes (barato, sin allocations). */
export function actualizarPosLuz(): void {
  LUZ_STATE.y = DBG_LUZ.LUZ_ALTURA_M;
  posicionInicialEn(_spawn);
  if (DBG_LUZ.LUZ_POS_MANUAL) { LUZ_STATE.x = DBG_LUZ.LUZ_POS_X; LUZ_STATE.z = DBG_LUZ.LUZ_POS_Z; }
  else {
    LUZ_STATE.x = _spawn.x - EJE_TELON.fx * DBG_LUZ.LUZ_DISTANCIA_M;
    LUZ_STATE.z = _spawn.z - EJE_TELON.fz * DBG_LUZ.LUZ_DISTANCIA_M;
  }
  LUZ_STATE.dSpawn = Math.hypot(LUZ_STATE.x - _spawn.x, LUZ_STATE.z - _spawn.z);   // Z31
}

/** Z31: reveal objetivo del cielo (0..max) en función de la distancia d a la luz. Pura, sin estado:
 *  0 a dSpawn − margen o más lejos; 1·max a dPleno o más cerca; entre medio smoothstep^curva. */
export function revealPorDistancia(d: number, dSpawn: number, margen: number, dPleno: number, curva: number, max: number): number {
  const ini = dSpawn - margen;
  const t = Math.min(1, Math.max(0, (ini - d) / Math.max(1e-3, ini - dPleno)));
  return Math.pow(t * t * (3 - 2 * t), Math.max(0.05, curva)) * max;
}

/** ¿El punto (x,z) es caminable? */
export function caminable(x: number, z: number): boolean {
  if (!DBG_LUZ.CAMINO_LUZ || !DBG_LUZ.LIMITES) return true;
  const m = DBG_LUZ.SALA_MEDIA_M - DBG_LUZ.SALA_MARGEN_M;
  if (Math.abs(x) <= m && Math.abs(z) <= m) return true;
  const dx = x - LUZ_STATE.x, dz = z - LUZ_STATE.z, r = DBG_LUZ.EXTERIOR_RADIO_M;
  return dx * dx + dz * dz <= r * r;
}

/** Aplica el paso horizontal (d.x, d.z) respetando los límites, deslizando por eje si choca.
 *  Si el usuario ya está fuera de lo caminable (teleport, límites recién activados) no se lo traba. */
export function moverConLimites(p: { x: number; z: number }, d: { x: number; z: number }): void {
  const nx = p.x + d.x, nz = p.z + d.z;
  if (!caminable(p.x, p.z) || caminable(nx, nz)) { p.x = nx; p.z = nz; return; }
  if (caminable(nx, p.z)) { p.x = nx; return; }
  if (caminable(p.x, nz)) { p.z = nz; }
}

/** ¿Fuera del área de la experiencia? Con histéresis respecto del estado anterior. */
export function fueraDelArea(x: number, z: number, antes: boolean): boolean {
  const borde = Math.max(Math.abs(x), Math.abs(z));
  const h = DBG_LUZ.AREA_HIST_M;
  return antes ? borde > DBG_LUZ.SALA_MEDIA_M - h : borde > DBG_LUZ.SALA_MEDIA_M + h;
}

/** Curva de cercanía 0..1 entre dLejos y dCerca, con exponente. */
export function curvaCercania(d: number, dLejos: number, dCerca: number, exp: number): number {
  const span = Math.max(1e-3, dLejos - dCerca);
  const t = Math.min(1, Math.max(0, (dLejos - d) / span));
  return Math.pow(t, Math.max(0.05, exp));
}
