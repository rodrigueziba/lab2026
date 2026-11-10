// Z24: posición inicial del usuario y ancla FIJA del telón.
// - El usuario arranca INICIO_RETROCESO_M más atrás que la base histórica (−10, 1.6, −7), en el eje
//   opuesto al telón (el telón queda hacia −Z desde la base), con la misma altura y orientación.
// - El telón deja de ubicarse relativo a la cámara: se ancla a la base + curtainDistM sobre el
//   forward inicial. Así no se mueve si cambia la posición inicial, y los iconos del piso (Z23)
//   se ubican respecto del telón. Objetos de módulo, sin allocations por frame.

import { DBG_INICIO, DBG_SILLAS } from "@/lib/debugConfig";

/** Posición inicial histórica (Z23 y antes): referencia fija del ancla del telón. */
export const INICIO_BASE = { x: -10, y: 1.6, z: -7 } as const;

// Z25: EJE de la escena. R3F hace camera.lookAt(0,0,0) al crear la cámara si no recibe rotation:
// la mirada inicial histórica fue SIEMPRE desde la base hacia el origen (la tarima), no −Z. El telón
// se armaba sobre ese eje a curtainDistM. Ese es el eje de simetría: base → origen (horizontal).
const _ejeL = Math.hypot(INICIO_BASE.x, INICIO_BASE.z) || 1;
export const EJE_TELON = { fx: -INICIO_BASE.x / _ejeL, fz: -INICIO_BASE.z / _ejeL } as const; // ≈ (0.819, 0.573)

export const ANCLA_TELON = { cx: 0, cz: 0, fx: 0, fz: -1, listo: false };

/** Centro del telón FIJO en el mundo: base + EJE × curtainDistM (los argumentos se ignoran desde Z25:
 *  ya no depende de hacia dónde mire la cámara al montarse). */
export function anclarTelon(): typeof ANCLA_TELON {
  if (ANCLA_TELON.listo) return ANCLA_TELON;
  ANCLA_TELON.fx = EJE_TELON.fx; ANCLA_TELON.fz = EJE_TELON.fz;
  ANCLA_TELON.cx = INICIO_BASE.x + EJE_TELON.fx * DBG_SILLAS.curtainDistM;
  ANCLA_TELON.cz = INICIO_BASE.z + EJE_TELON.fz * DBG_SILLAS.curtainDistM;
  ANCLA_TELON.listo = true;
  return ANCLA_TELON;
}

/** Z25: ÚNICO punto de verdad del spawn. Telón − EJE × (curtainDistM + INICIO_RETROCESO_M), altura de ojos. */
export function posicionInicial(): [number, number, number] {
  const A = anclarTelon();
  const d = DBG_SILLAS.curtainDistM + Math.max(0, DBG_INICIO.INICIO_RETROCESO_M);
  return [A.cx - A.fx * d, INICIO_BASE.y, A.cz - A.fz * d];
}

/** Z25: yaw que mira exactamente al centro del telón (sobre el eje) y pitch de debug. */
export function rotacionInicial(): { pitch: number; yaw: number } {
  const A = anclarTelon();
  return { pitch: (DBG_INICIO.INICIO_PITCH_DEG * Math.PI) / 180, yaw: Math.atan2(-A.fx, -A.fz) };
}

/** Z25: coloca la cámara en el spawn (posición + yaw/pitch, orden YXZ como PointerLockControls). */
export function aplicarSpawn(camera: { position: { set(x: number, y: number, z: number): unknown }; rotation: { order: string; set(x: number, y: number, z: number): unknown } }): void {
  const [x, y, z] = posicionInicial();
  const r = rotacionInicial();
  camera.position.set(x, y, z);
  camera.rotation.order = "YXZ";
  camera.rotation.set(r.pitch, r.yaw, 0);
}
