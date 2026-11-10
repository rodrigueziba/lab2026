// Z24: posición inicial del usuario y ancla FIJA del telón.
// - El usuario arranca INICIO_RETROCESO_M más atrás que la base histórica (−10, 1.6, −7), en el eje
//   opuesto al telón (el telón queda hacia −Z desde la base), con la misma altura y orientación.
// - El telón deja de ubicarse relativo a la cámara: se ancla a la base + curtainDistM sobre el
//   forward inicial. Así no se mueve si cambia la posición inicial, y los iconos del piso (Z23)
//   se ubican respecto del telón. Objetos de módulo, sin allocations por frame.

import { DBG_INICIO, DBG_SILLAS } from "@/lib/debugConfig";

/** Posición inicial histórica (Z23 y antes): referencia fija del ancla del telón. */
export const INICIO_BASE = { x: -10, y: 1.6, z: -7 } as const;

/** Posición inicial del usuario (con el retroceso). El telón está hacia −Z → atrás = +Z. */
export function posicionInicial(): [number, number, number] {
  return [INICIO_BASE.x, INICIO_BASE.y, INICIO_BASE.z + Math.max(0, DBG_INICIO.INICIO_RETROCESO_M)];
}

export const ANCLA_TELON = { cx: 0, cz: 0, fx: 0, fz: -1, listo: false };

/** Fija (una sola vez) el centro del telón: base + forward horizontal inicial × curtainDistM. */
export function anclarTelon(fx: number, fz: number): typeof ANCLA_TELON {
  if (ANCLA_TELON.listo) return ANCLA_TELON;
  const l = Math.hypot(fx, fz);
  const ux = l > 1e-5 ? fx / l : 0, uz = l > 1e-5 ? fz / l : -1;
  ANCLA_TELON.fx = ux; ANCLA_TELON.fz = uz;
  ANCLA_TELON.cx = INICIO_BASE.x + ux * DBG_SILLAS.curtainDistM;
  ANCLA_TELON.cz = INICIO_BASE.z + uz * DBG_SILLAS.curtainDistM;
  ANCLA_TELON.listo = true;
  return ANCLA_TELON;
}
