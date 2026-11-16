// Z45: lógica pura del fractal en textura (sin imports; se prueba en Node: scripts/fractal-tex-test.mjs).
// Prism.tsx la llama una vez por frame sobre un estado reutilizado (sin allocations).
//
//   resolución = TEX_RES, o TEX_RES_CERCA cuando prox cruza TEX_UMBRAL_CERCA (con histéresis ± TEX_HISTERESIS),
//                limitada por el escalón de la calidad adaptativa. El render target se recrea solo si cambia.
//   ritmo      = se recalcula la textura cada 1/TEX_FPS s (0 = cada frame); en pausa no se recalcula.
//   adaptativo = si el tiempo de frame medio supera MS_MAX durante ADAPT_BAJAR_S, baja un escalón
//                (resolución 1024 → 512 → 384 → 256 y después iteraciones 16 → 12 → 10); si queda por debajo
//                de MS_MAX · ADAPT_MARGEN durante ADAPT_SUBIR_S, sube uno. Tras cada cambio espera de nuevo.

export interface CfgFractalTex {
  TEX_RES: number; TEX_RES_CERCA: number; TEX_RES_DINAMICA: boolean;
  TEX_UMBRAL_CERCA: number; TEX_HISTERESIS: number; TEX_FPS: number;
  ADAPTATIVO: boolean; MS_MAX: number; ADAPT_MARGEN: number; ADAPT_BAJAR_S: number; ADAPT_SUBIR_S: number;
  ITERACIONES: number;
}

export interface EstadoFractalTex {
  cerca: boolean;      // umbral de resolución cercana cruzado (con histéresis)
  acum: number;        // tiempo desde la última actualización de la textura (s)
  msMedio: number;     // tiempo de frame medio (ms, suavizado)
  tSobre: number;      // segundos seguidos por encima de MS_MAX
  tBajo: number;       // segundos seguidos por debajo de MS_MAX · ADAPT_MARGEN
  nivel: number;       // escalón adaptativo (0 = calidad completa)
  // salidas
  res: number;         // resolución pedida para el render target
  iter: number;        // iteraciones a usar
  cambioNivel: number; // −1 bajó, +1 subió, 0 igual (este frame)
}

/** Escalones adaptativos: tope de resolución y de iteraciones por nivel. */
export const NIVELES_ADAPT: ReadonlyArray<{ resMax: number; iterMax: number }> = [
  { resMax: Infinity, iterMax: Infinity },
  { resMax: 512, iterMax: Infinity },
  { resMax: 384, iterMax: Infinity },
  { resMax: 256, iterMax: Infinity },
  { resMax: 256, iterMax: 12 },
  { resMax: 256, iterMax: 10 },
];
export const RES_MIN = 64, RES_MAX = 2048;

export function crearEstadoFractalTex(): EstadoFractalTex {
  return { cerca: false, acum: Infinity, msMedio: 0, tSobre: 0, tBajo: 0, nivel: 0, res: 512, iter: 16, cambioNivel: 0 };
}

const fin = (x: number, d = 0): number => (Number.isFinite(x) ? x : d);
const resValida = (r: number): number => Math.max(RES_MIN, Math.min(RES_MAX, Math.round(fin(r, 512))));

/** Histéresis del umbral de resolución cercana. */
export function actualizarCerca(cerca: boolean, prox: number, umbral: number, hist: number): boolean {
  const h = Math.max(0, fin(hist));
  if (!cerca && prox > umbral + h) return true;
  if (cerca && prox < umbral - h) return false;
  return cerca;
}

/** ¿Toca recalcular la textura este frame? Consume el acumulador (sin deriva). */
export function tocaActualizar(e: EstadoFractalTex, dt: number, texFps: number, pausado: boolean): boolean {
  if (pausado) return false;
  e.acum += Math.max(0, fin(dt));
  const fps = fin(texFps);
  if (fps <= 0) { e.acum = 0; return true; }
  const periodo = 1 / fps;
  if (e.acum < periodo) return false;
  // un salto largo (pestaña oculta) no genera varias actualizaciones seguidas
  e.acum = e.acum - periodo < periodo ? e.acum - periodo : 0;
  return true;
}

/** Calidad adaptativa: suaviza el tiempo de frame y mueve el escalón con histéresis temporal. */
export function pasoAdaptativo(e: EstadoFractalTex, c: CfgFractalTex, dt: number): void {
  e.cambioNivel = 0;
  if (!c.ADAPTATIVO) { e.nivel = 0; e.tSobre = 0; e.tBajo = 0; return; }
  const d = Math.min(0.5, Math.max(0, fin(dt)));
  const ms = d * 1000;
  e.msMedio = e.msMedio <= 0 ? ms : e.msMedio + (ms - e.msMedio) * Math.min(1, d / 0.25);   // ~0,25 s
  if (e.msMedio > c.MS_MAX) { e.tSobre += d; e.tBajo = 0; }
  else if (e.msMedio < c.MS_MAX * c.ADAPT_MARGEN) { e.tBajo += d; e.tSobre = 0; }
  else { e.tSobre = 0; e.tBajo = 0; }
  if (e.tSobre >= c.ADAPT_BAJAR_S && e.nivel < NIVELES_ADAPT.length - 1) { e.nivel++; e.cambioNivel = -1; e.tSobre = 0; e.tBajo = 0; }
  else if (e.tBajo >= c.ADAPT_SUBIR_S && e.nivel > 0) { e.nivel--; e.cambioNivel = 1; e.tSobre = 0; e.tBajo = 0; }
}

/** Un frame: histéresis de cercanía, adaptativo, resolución e iteraciones resultantes. */
export function avanzarFractalTex(e: EstadoFractalTex, c: CfgFractalTex, dt: number, prox: number): EstadoFractalTex {
  e.cerca = c.TEX_RES_DINAMICA ? actualizarCerca(e.cerca, fin(prox), c.TEX_UMBRAL_CERCA, c.TEX_HISTERESIS) : false;
  pasoAdaptativo(e, c, dt);
  const n = NIVELES_ADAPT[e.nivel];
  const base = resValida(e.cerca ? c.TEX_RES_CERCA : c.TEX_RES);
  e.res = resValida(Math.min(base, n.resMax));
  e.iter = Math.max(1, Math.min(32, Math.round(Math.min(fin(c.ITERACIONES, 16), n.iterMax))));
  return e;
}

// Z69: reparto de cada actualización en franjas (una por cuadro), para no tener cuadros caros alternados. Las franjas
// caben en el período de actualización: a 120 Hz y TEX_FPS 30 → 4 cuadros por actualización → hasta 4 franjas; a 60 Hz
// → 2. Con 1 (o TEX_FPS 0 = cada frame) es como antes.
export function franjasFractal(texFps: number, dtMedio: number, max: number): number {
  const m = Math.max(1, Math.min(16, Math.round(fin(max, 1))));
  const f = fin(texFps), dt = fin(dtMedio);
  if (f <= 0 || dt <= 0) return 1;
  const cuadros = Math.floor(1 / f / dt + 0.1);
  return Math.max(1, Math.min(m, cuadros));
}
/** Primera fila de la franja i de n (la franja i va de filaFranja(i) a filaFranja(i + 1): cubren todas, sin huecos ni
 *  solapes). Devuelve un número (sin allocations). */
export function filaFranja(i: number, n: number, res: number): number {
  const nn = Math.max(1, Math.round(n)), r = Math.max(0, Math.round(res));
  return Math.floor((Math.max(0, Math.min(nn, i)) * r) / nn);
}
