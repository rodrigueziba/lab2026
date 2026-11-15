// Z54: coreografía del prisma y la flor dentro del ciclo de día (lib/cicloDia.ts, tDia 0…1). Puro y sin imports
// (se prueba en Node: scripts/prisma-flor-test.mjs). Lo calcula AmanecerReloj una vez por frame (después de
// avanzar el ciclo) y lo leen Prism.tsx (altura) y FlorCiclo.tsx (escala, apertura). Sin allocations.
//
//   altura  0 = apoyado (como hoy) … 1 = altura inicial de la secuencia SILLAS (de donde bajó)
//           sube entre SUBE_INICIO y SUBE_FIN, queda arriba, baja entre BAJA_INICIO y BAJA_FIN (lento)
//   escala  0 … 1: la flor nace entre NACE_INICIO y NACE_FIN y se achica entre ACHICA_INICIO y ACHICA_FIN
//   apertura 0 … 1: se abre en la segunda mitad del nacimiento y se cierra en la primera mitad del achique
// Curvas ease in-out (smoothstep). En tDia 0 y 1 el estado es el mismo (prisma apoyado, sin flor).

export interface CfgFlor {
  ACTIVO: boolean;
  SUBE_INICIO: number; SUBE_FIN: number; NACE_INICIO: number; NACE_FIN: number;
  ACHICA_INICIO: number; ACHICA_FIN: number; BAJA_INICIO: number; BAJA_FIN: number;
}

export interface EstadoFlor { activo: boolean; altura: number; escala: number; apertura: number; tallo: number; cabeza: number }

export function crearEstadoFlor(): EstadoFlor { return { activo: false, altura: 0, escala: 0, apertura: 0, tallo: 0, cabeza: 0 }; }

/** Estado compartido (lo escribe AmanecerReloj). */
export const FLOR = crearEstadoFlor();

const sat = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const fin = (x: number, d = 0): number => (Number.isFinite(x) ? x : d);
/** ease in-out (smoothstep) de x entre a y b (0 antes de a, 1 después de b). */
export function tramo(x: number, a: number, b: number): number {
  if (!(b > a)) return x >= b ? 1 : 0;
  const u = sat((x - a) / (b - a));
  return u * u * (3 - 2 * u);
}

/** Escribe en out el estado para tDia. activo = ciclo nuevo en marcha y la coreografía encendida. */
export function estadoPrismaFlor(dia: number, c: CfgFlor, activo: boolean, out: EstadoFlor): EstadoFlor {
  out.activo = activo && c.ACTIVO;
  if (!out.activo) { out.altura = 0; out.escala = 0; out.apertura = 0; out.tallo = 0; out.cabeza = 0; return out; }
  const d = sat(fin(dia));
  // prisma: sube, queda arriba, baja (en 0 y 1 apoyado)
  out.altura = tramo(d, c.SUBE_INICIO, c.SUBE_FIN) * (1 - tramo(d, c.BAJA_INICIO, c.BAJA_FIN));
  // flor: nace (primero el tallo, después la cabeza que se abre) y desaparece en el recorrido inverso
  const nace = sat((d - c.NACE_INICIO) / Math.max(1e-6, c.NACE_FIN - c.NACE_INICIO));
  const achica = sat((d - c.ACHICA_INICIO) / Math.max(1e-6, c.ACHICA_FIN - c.ACHICA_INICIO));
  const vivo = d >= c.NACE_INICIO && d <= c.ACHICA_FIN;
  out.escala = vivo ? tramo(nace, 0, 1) * (1 - tramo(achica, 0.3, 1)) : 0;
  out.apertura = vivo ? tramo(nace, 0.45, 1) * (1 - tramo(achica, 0, 0.5)) : 0;
  out.tallo = vivo ? tramo(nace, 0, 0.6) * (1 - tramo(achica, 0.3, 1)) : 0;
  out.cabeza = vivo ? tramo(nace, 0.35, 0.85) * (1 - tramo(achica, 0.3, 1)) : 0;
  return out;
}
