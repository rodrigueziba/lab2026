// Z43: progresión del fractal del prisma por distancia y música. Puro y sin imports (se prueba en Node:
// scripts/fractal-test.mjs). Prism.tsx lo llama una vez por frame con DBG_FRACTAL y escribe en un estado
// reutilizado (sin allocations).
//
//   prox     = smoothstep(DIST_INICIO_M → DIST_MAX_M) de la distancia ojo → centro del prisma (0 lejos, 1 pegado),
//              con inercia (INERCIA_60 por frame a 60 fps, independiente de los fps). PROX_FORZADA ≥ 0 la fija.
//   tFractal += dt · velocidad(prox), velocidad = VEL_MIN + (VEL_MAX − VEL_MIN) · prox; congelado en pausa.
//   música   = factor de entrada (0…1, suavizado) × bandas suavizadas, solo con el visualizador activo y
//              prox > PROX_MIN_MUSICA: graves → zoom, medios → (X, Y), agudos → brillo.

export interface CfgFractalProg {
  DIST_INICIO_M: number; DIST_MAX_M: number; INERCIA_60: number; PROX_FORZADA: number;
  VEL_MIN: number; VEL_MAX: number;
  PROX_MIN_MUSICA: number; MUSICA_GRAVES: number; MUSICA_MEDIOS: number; MUSICA_AGUDOS: number;
  MUSICA_SUAVE_S: number; MUSICA_ENTRADA_S: number;
}

export interface EstadoFractal {
  prox: number;        // 0…1 con inercia (va al uniform uProx)
  t: number;           // tiempo propio del fractal (uniform uT)
  musica: number;      // factor de entrada de la reacción a la música 0…1
  graves: number; medios: number; agudos: number;   // bandas suavizadas 0…1
  // salidas para los uniforms
  musZoom: number;     // × zoom (1 = sin efecto)
  musCx: number; musCy: number;   // + (X, Y)
  musBrillo: number;   // × brillo (1 = sin efecto)
}

/** Escalas internas de la reacción (ganancia 1 = este efecto máximo con la banda al 100 %). */
export const MUS_ZOOM_MAX = 0.25;   // los graves acercan hasta un 25 %
export const MUS_C_MAX = 0.05;      // los medios corren (X, Y) hasta 0,05 (el conjunto cambia de forma sin romperse)
export const MUS_BRILLO_MAX = 1.0;  // los agudos suben el brillo hasta ×2
export const DT_MAX = 0.1;          // un frame largo (pestaña oculta) no hace saltar la animación

export function crearEstadoFractal(): EstadoFractal {
  return { prox: 0, t: 0, musica: 0, graves: 0, medios: 0, agudos: 0, musZoom: 1, musCx: 0, musCy: 0, musBrillo: 1 };
}

const sat = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const fin = (x: number, d = 0): number => (Number.isFinite(x) ? x : d);

/** 0 en DIST_INICIO_M o más lejos, 1 en DIST_MAX_M o más cerca, smoothstep en el medio. */
export function proxObjetivo(dist: number, inicioM: number, maxM: number): number {
  const den = inicioM - maxM;
  if (!(Math.abs(den) > 1e-6)) return dist <= maxM ? 1 : 0;
  const x = sat((inicioM - fin(dist, 1e9)) / den);
  return x * x * (3 - 2 * x);
}

/** Factor de suavizado para dt equivalente a aplicar k60 por frame a 60 fps. */
export function kPorFrame60(k60: number, dt: number): number {
  return 1 - Math.pow(1 - sat(k60), Math.max(0, dt) * 60);
}
/** Factor de suavizado exponencial con constante de tiempo tau (s). */
export function kTau(tau: number, dt: number): number {
  return tau <= 1e-4 ? 1 : 1 - Math.exp(-Math.max(0, dt) / tau);
}

export function velocidad(prox: number, vMin: number, vMax: number): number {
  return vMin + (vMax - vMin) * sat(prox);
}

/**
 * Avanza el estado un frame. dist: ojo → centro del prisma (m). habilitado: el prisma aterrizó (como el S2).
 * pausado: PAUSA.activa (congela tiempo, prox y música). vizActivo: alight:visualizer-activate ya ocurrió.
 * graves/medios/agudos: energía 0…1 de las bandas existentes (BAND_STATE.normEnergy).
 */
export function avanzarFractal(
  e: EstadoFractal, c: CfgFractalProg, dtBruto: number, dist: number, habilitado: boolean,
  pausado: boolean, vizActivo: boolean, graves: number, medios: number, agudos: number,
): EstadoFractal {
  const dt = Math.min(DT_MAX, Math.max(0, fin(dtBruto)));
  if (pausado) return e;   // todo congelado

  // cercanía
  const forzada = fin(c.PROX_FORZADA, -1);
  if (forzada >= 0) e.prox = sat(forzada);
  else {
    const obj = habilitado ? proxObjetivo(dist, c.DIST_INICIO_M, c.DIST_MAX_M) : 0;
    e.prox += (obj - e.prox) * kPorFrame60(c.INERCIA_60, dt);
  }

  // tiempo propio (acumulado: cambiar la velocidad no hace saltar la animación)
  e.t += dt * velocidad(e.prox, c.VEL_MIN, c.VEL_MAX);

  // música: entra y sale suavizada
  const quiere = vizActivo && e.prox > c.PROX_MIN_MUSICA ? 1 : 0;
  e.musica += (quiere - e.musica) * kTau(c.MUSICA_ENTRADA_S, dt);
  const kb = kTau(c.MUSICA_SUAVE_S, dt);
  e.graves += (sat(fin(graves)) - e.graves) * kb;
  e.medios += (sat(fin(medios)) - e.medios) * kb;
  e.agudos += (sat(fin(agudos)) - e.agudos) * kb;

  const m = e.musica;
  e.musZoom = Math.max(0.2, 1 - MUS_ZOOM_MAX * Math.max(0, c.MUSICA_GRAVES) * e.graves * m);
  e.musCx = MUS_C_MAX * Math.max(0, c.MUSICA_MEDIOS) * e.medios * m;
  e.musCy = -0.6 * e.musCx;
  e.musBrillo = 1 + MUS_BRILLO_MAX * Math.max(0, c.MUSICA_AGUDOS) * e.agudos * m;
  return e;
}
