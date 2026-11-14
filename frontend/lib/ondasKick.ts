// Z52: ondas expansivas por kick de cada luz/banda. Puro y sin imports (se prueba en Node: scripts/ondas-test.mjs).
// Lo llama DomeSkyAnchor (DomeVisualizer.tsx) una vez por frame con lo que ya expone lib/vizAudio.ts
// (BAND_STATE.normEnergy, gateOpen, assignment), sin analizador nuevo, y con el reloj de la experiencia (s,
// congelado con la pausa). DomeSky lee ONDAS y llena el uniform array uOndas del shader del domo.
//
// Detector por luz i (0…3), que escucha su banda b = assignment[i]:
//   dispara si: ACTIVO, visualizador activo, luz encendida (getHazBandOn(i)) y compuerta abierta (gateOpen[b]),
//   e ≥ MIN_ENERGIA, e > UMBRAL · media (flanco: el frame anterior estaba por debajo), y pasó COOLDOWN_MS.
//   media = media móvil exponencial de e (MEDIA_S). En una meseta la media alcanza a la energía → no vuelve a disparar.
// Ondas: arreglo fijo de MAX_ONDAS slots { activa, t0, fuerza, luz, banda }; una nueva ocupa un slot libre o
// reemplaza a la más vieja; muere al pasar DURACION_S. Sin allocations por frame.

export const MAX_ONDAS = 8;   // tamaño del uniform array del shader (DBG_ONDAS.MAX limita cuántas se usan)

export interface CfgOndas {
  ACTIVO: boolean; MAX: number; DURACION_S: number;
  UMBRAL: number; COOLDOWN_MS: number; MEDIA_S: number; MIN_ENERGIA: number;
  GANANCIA_BANDA: number[];
}

export interface Onda { activa: boolean; t0: number; fuerza: number; luz: number; banda: number; edadFija: number }   // edadFija ≥ 0: solo diagnóstico (capturas)
export interface Detector { media: number; arriba: boolean; ultimo: number; disparos: number; listo: boolean }

export const ONDAS = {
  lista: Array.from({ length: MAX_ONDAS }, (): Onda => ({ activa: false, t0: 0, fuerza: 0, luz: 0, banda: 0, edadFija: -1 })),
  det: Array.from({ length: 4 }, (): Detector => ({ media: 0, arriba: false, ultimo: -1e9, disparos: 0, listo: false })),
  lanzadas: 0,
};

const fin = (x: number, d = 0): number => (Number.isFinite(x) ? x : d);

/** Registra una onda (slot libre o reemplaza la más vieja entre las primeras MAX). */
export function lanzarOnda(o: typeof ONDAS, c: CfgOndas, luz: number, banda: number, fuerza: number, t: number): Onda {
  const n = Math.max(1, Math.min(MAX_ONDAS, Math.round(fin(c.MAX, MAX_ONDAS))));
  let slot = -1, vieja = 0;
  for (let i = 0; i < n; i++) {
    const w = o.lista[i];
    if (!w.activa) { slot = i; break; }
    if (w.t0 < o.lista[vieja].t0) vieja = i;
  }
  const w = o.lista[slot >= 0 ? slot : vieja];
  w.activa = true; w.t0 = t; w.fuerza = Math.max(0, fin(fuerza)); w.luz = luz; w.banda = banda; w.edadFija = -1;
  o.lanzadas++;
  return w;
}

/** Un frame del detector de una luz. Devuelve true si disparó (y registró la onda). t en s, dt en s. */
export function detectar(
  o: typeof ONDAS, c: CfgOndas, luz: number, banda: number, e: number, habilitada: boolean, t: number, dt: number,
): boolean {
  const d = o.det[luz];
  const x = Math.max(0, fin(e));
  // calentamiento: el primer frame solo inicializa la media (si no, el primer sonido después del arranque sería
  // un "ataque" contra una media en 0 y lanzaría una onda espuria)
  if (!d.listo) { d.media = x; d.arriba = true; d.listo = true; return false; }
  const sobre = x >= Math.max(0, fin(c.MIN_ENERGIA)) && x > Math.max(1, fin(c.UMBRAL, 1.35)) * d.media;
  let disparo = false;
  if (c.ACTIVO && habilitada && sobre && !d.arriba && (t - d.ultimo) * 1000 >= Math.max(0, fin(c.COOLDOWN_MS))) {
    const g = fin(c.GANANCIA_BANDA?.[banda], 1);
    lanzarOnda(o, c, luz, banda, x * g, t);
    d.ultimo = t; d.disparos++;
    disparo = true;
  }
  d.arriba = sobre;
  const k = 1 - Math.exp(-Math.max(0, fin(dt)) / Math.max(0.01, fin(c.MEDIA_S, 0.6)));
  d.media += (x - d.media) * k;
  return disparo;
}

/** Mata las ondas que pasaron DURACION_S (o todas si el sistema está apagado). */
export function envejecer(o: typeof ONDAS, c: CfgOndas, t: number): void {
  const dur = Math.max(0.05, fin(c.DURACION_S, 3.5));
  for (const w of o.lista) if (w.activa && w.edadFija < 0 && (!c.ACTIVO || t - w.t0 >= dur || t < w.t0)) w.activa = false;
}

/** Edad (s) de una onda activa, o −1. (edadFija ≥ 0: edad fijada para diagnóstico) */
export function edad(w: Onda, t: number): number { return w.activa ? (w.edadFija >= 0 ? w.edadFija : t - w.t0) : -1; }

/** Limpia todo (al desmontar el visualizador o al reiniciar). */
export function limpiarOndas(o: typeof ONDAS): void {
  for (const w of o.lista) { w.activa = false; w.edadFija = -1; }
  for (const d of o.det) { d.media = 0; d.arriba = false; d.ultimo = -1e9; d.disparos = 0; d.listo = false; }
}
