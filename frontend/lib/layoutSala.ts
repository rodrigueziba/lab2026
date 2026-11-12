// Z41: layout ÚNICO de las sillas, la zona SILLAS, el público sentado (TARIMA) y los monolitos.
// Puro y sin imports (se prueba en Node: scripts/layout-test.mjs). Los componentes le pasan DBG_LAYOUT y
// lo leen en useFrame (en vivo), escribiendo en objetos de salida reutilizados (sin allocations).
//
// Base (posiciones anteriores a Z41, = offset 0 o POSICIONES_NUEVAS=false):
//   tarima / ZONA_LUZ en (0, 0) · 6 sillas en una fila, x = −2,5…2,5 cada 1 m, z = −3, mirando a +Z (a la tarima)
//   ZONA_SILLAS (0, −6) radio 2,5 · público: entra desde z = −20 y se sienta en el asiento de cada silla
//   monolitos en (±monolithDistM, 0) (DBG_SILLAS, 3,75 m)
// Z41: sillas, zona y entrada del público se corren SILLAS_OFFSET_M en la dirección tarima → sillas;
// los monolitos se alejan MONOLITOS_OFFSET_M en la dirección radial desde el centro de la tarima.

export interface CfgLayout { POSICIONES_NUEVAS: boolean; SILLAS_OFFSET_M: number; MONOLITOS_OFFSET_M: number }
export interface XZ { x: number; z: number }

export const TARIMA_CENTRO = { x: 0, z: 0 } as const;
/** ZONA_LUZ de ThreeScene (elige TARIMA). No se mueve. */
export const ZONA_TARIMA = { x: 0, z: 0, radio: 2.5 } as const;
/** Fila de sillas (base). El asiento está en el origen de cada silla; el respaldo hacia −Z. */
export const SILLAS_BASE = { z: -3, xs: [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5] as readonly number[] } as const;
export const N_SILLAS = SILLAS_BASE.xs.length;
/** Medio ancho / media profundidad del asiento (box 0,48 × 0,46 de Chairs.tsx). */
export const ASIENTO_MEDIO = { x: 0.24, z: 0.23 } as const;
/** ZONA_SILLAS de ThreeScene (base): 3 m detrás de la fila de sillas, radio 2,5. */
export const ZONA_SILLAS_BASE = { x: 0, z: -6, radio: 2.5 } as const;
/** z desde el que entra caminando el público (Audience.tsx, base). */
export const PUBLICO_INICIO_Z_BASE = -20;

const _cx = SILLAS_BASE.xs.reduce((a, b) => a + b, 0) / N_SILLAS;
const _dx = _cx - TARIMA_CENTRO.x, _dz = SILLAS_BASE.z - TARIMA_CENTRO.z, _dl = Math.hypot(_dx, _dz) || 1;
/** Dirección (unitaria) que separa las sillas de la tarima: centro de la tarima → centro de la fila. Hoy (0, −1). */
export const DIR_SILLAS: XZ = { x: _dx / _dl, z: _dz / _dl };

const finito = (v: number): number => (Number.isFinite(v) ? v : 0);

/** Metros que se corren sillas, zona y público (0 con POSICIONES_NUEVAS=false). */
export function offsetSillasM(c: CfgLayout): number { return c.POSICIONES_NUEVAS ? finito(c.SILLAS_OFFSET_M) : 0; }
/** Metros extra de los monolitos (0 con POSICIONES_NUEVAS=false). */
export function offsetMonolitosM(c: CfgLayout): number { return c.POSICIONES_NUEVAS ? finito(c.MONOLITOS_OFFSET_M) : 0; }

/** Vector de desplazamiento de todo el bloque de sillas (lo usa el grupo de Chairs). */
export function desplazamientoSillasEn(c: CfgLayout, out: XZ): XZ {
  const o = offsetSillasM(c);
  out.x = DIR_SILLAS.x * o; out.z = DIR_SILLAS.z * o;
  return out;
}

/** Centro del asiento de la silla i (= donde se sienta la persona i del público). */
export function sillaEn(i: number, c: CfgLayout, out: XZ): XZ {
  const o = offsetSillasM(c);
  out.x = SILLAS_BASE.xs[i] + DIR_SILLAS.x * o;
  out.z = SILLAS_BASE.z + DIR_SILLAS.z * o;
  return out;
}
/** Asiento de la persona i del público: el mismo de la silla i (misma fuente, sin números duplicados). */
export const asientoPublicoEn = sillaEn;

/** Punto de entrada caminando de la persona i (mismo desplazamiento: misma distancia recorrida que antes). */
export function inicioPublicoEn(i: number, c: CfgLayout, out: XZ): XZ {
  const o = offsetSillasM(c);
  out.x = SILLAS_BASE.xs[i] + DIR_SILLAS.x * o;
  out.z = PUBLICO_INICIO_Z_BASE + DIR_SILLAS.z * o;
  return out;
}

/** Centro de la fila de sillas. */
export function centroSillasEn(c: CfgLayout, out: XZ): XZ {
  const o = offsetSillasM(c);
  out.x = _cx + DIR_SILLAS.x * o; out.z = SILLAS_BASE.z + DIR_SILLAS.z * o;
  return out;
}

/** Centro de ZONA_SILLAS: el mismo vector que las sillas (conserva la relación zona ↔ sillas). */
export function zonaSillasEn(c: CfgLayout, out: XZ): XZ {
  const o = offsetSillasM(c);
  out.x = ZONA_SILLAS_BASE.x + DIR_SILLAS.x * o;
  out.z = ZONA_SILLAS_BASE.z + DIR_SILLAS.z * o;
  return out;
}

/** Distancia de cada monolito al centro de la tarima (radial): la base (DBG_SILLAS.monolithDistM) + offset. */
export function monolitoDistM(baseM: number, c: CfgLayout): number { return baseM + offsetMonolitosM(c); }

/** Posición del monolito (lado −1 izquierdo / imagen, +1 derecho / sonido): radial desde el centro de la tarima. */
export function monolitoEn(lado: -1 | 1, baseM: number, c: CfgLayout, out: XZ): XZ {
  const d = monolitoDistM(baseM, c);
  out.x = TARIMA_CENTRO.x + lado * d; out.z = TARIMA_CENTRO.z;
  return out;
}
