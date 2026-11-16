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

// ── Z60: giro de la cabeza (rueda hacia adelante), ola de pétalos y fases de color. Puro, sin allocations. ──
// Fases acumuladas (rad o vueltas) con dt del reloj de la experiencia (0 en pausa → todo quieto). Como se acumula la
// FASE y no se calcula fase = t · velocidad, cambiar la velocidad (menú, música) nunca produce saltos.
// Todo se atenúa con la escala de la flor (al nacer y al desaparecer gira y ondula más lento y con menos amplitud).
export interface CfgRoll {
  ROLL_CABEZA_ACTIVO: boolean; ROLL_CABEZA_PERIODO_S: number; ROLL_CABEZA_AMP_DEG: number; ROLL_CABEZA_SENTIDO: number;
  PETALO_OLA_ACTIVO: boolean; PETALO_OLA_PERIODO_S: number;
  COLOR_VEL: number; COLOR_TALLO_VEL: number; COLOR_TALLO_ACTIVO: boolean; MUSICA_ROLL: number;
}
export interface EstadoRoll { fase: number; ola: number; color: number; tallo: number; graves: number }
export function crearEstadoRoll(): EstadoRoll { return { fase: 0, ola: 0, color: 0, tallo: 0, graves: 0 }; }
const TAU = Math.PI * 2;
const envolver = (x: number): number => { const r = x % TAU; return r < 0 ? r + TAU : r; };

/** Avanza las fases. dt (s, reloj de la experiencia), escala de la flor (0…1), graves 0…1 (música). */
export function avanzarRoll(s: EstadoRoll, c: CfgRoll, dt: number, escala: number, graves: number): EstadoRoll {
  const d = Math.max(0, fin(dt));
  const e = sat(fin(escala));
  // graves suavizados (lerp temporal, ~0,25 s): la música acelera sin tirones
  s.graves += (sat(fin(graves)) - s.graves) * (1 - Math.exp(-d / 0.25));
  const vRoll = c.ROLL_CABEZA_ACTIVO ? (TAU / Math.max(0.5, fin(c.ROLL_CABEZA_PERIODO_S, 4.2))) * (1 + Math.max(0, fin(c.MUSICA_ROLL)) * s.graves) : 0;
  s.fase = envolver(s.fase + vRoll * e * d);
  const vOla = c.PETALO_OLA_ACTIVO ? TAU / Math.max(0.5, fin(c.PETALO_OLA_PERIODO_S, 4.2)) : 0;
  s.ola = envolver(s.ola + vOla * e * d);
  s.color = (s.color + fin(c.COLOR_VEL) * d) % 1000;                                  // vueltas del degradado
  s.tallo = (s.tallo + (c.COLOR_TALLO_ACTIVO ? fin(c.COLOR_TALLO_VEL) : 0) * e * d) % 1000;
  return s;
}

/** Ángulo de giro de la cabeza (rad, con signo). AMP ≥ 360: vuelta completa; menos: se mece ±AMP/2. */
export function anguloRoll(s: EstadoRoll, c: CfgRoll): number {
  const amp = Math.max(0, fin(c.ROLL_CABEZA_AMP_DEG, 360));
  const sg = fin(c.ROLL_CABEZA_SENTIDO, 1) < 0 ? -1 : 1;
  return sg * (amp >= 359.9 ? s.fase : ((amp * Math.PI) / 360) * Math.sin(s.fase));
}

/** Retraso (rad) de la ola de un pétalo: DESFASE por cada pétalo de distancia al frente del giro (az = π), por los
 *  dos lados del anillo (sin costura). azK = azimut del pétalo en el marco del giro (rad), n = pétalos del anillo.
 *  Réplica exacta de las cuentas del vertex shader de FlorCiclo. */
export function retrasoPetalo(azK: number, n: number, desfase: number): number {
  const d = Math.abs((((fin(azK) % TAU) + TAU) % TAU) - Math.PI);
  return Math.max(0, fin(desfase)) * d * Math.max(1, fin(n, 1)) / TAU;
}
/** Apertura extra (−1…1) de un pétalo: cos(ángulo de giro − retraso). 1 = abierto (cara arriba), −1 = copa. */
export function olaPetalo(anguloGiro: number, azK: number, n: number, desfase: number, capaInterior = false, contrafase = true): number {
  return Math.cos(fin(anguloGiro) - retrasoPetalo(azK, n, desfase) + (capaInterior && contrafase ? Math.PI : 0));
}
