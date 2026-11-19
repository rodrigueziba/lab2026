// Z103: SAMPLER SM-40: lógica PURA y SIN imports (prueba: scripts/sampler-test.mjs). El motor de audio está en
// lib/audio/sampler.ts; el atril en lib/atrilSampler.ts y components/AtrilSamplerNuevo.tsx.
// Contiene: afinación (playbackRate), recorte INICIO/FIN y REVERSA, los 8 sonidos de fábrica generados por cálculo
// (originales, sin archivos ni red), parámetros con fuentes ("manual" y "cara", la regla de Z99), voces con tope y robo,
// cuantización a la grilla del reloj, teclas de los pads, forma de onda del display y textos.
// Todo escribe en estructuras preasignadas: nada de esto crea objetos en el bucle del reloj ni por cuadro.

export const N_PADS = 8;

// ── afinación ──
/** playbackRate de una afinación en semitonos: 2^(semitonos / 12). +12 duplica (una octava arriba), −12 la mitad. */
export function velocidadDeAfinacion(semitonos: number): number {
  const s = Math.max(-12, Math.min(12, Number.isFinite(semitonos) ? semitonos : 0));
  return Math.pow(2, s / 12);
}

// ── recorte y reversa ──
/** Largo mínimo del recorte (fracción del sonido): INICIO y FIN nunca se cruzan ni se pegan. */
export const RECORTE_MIN = 0.01;
/** Fija INICIO sin pasar FIN − RECORTE_MIN; devuelve el valor acotado a [0, 1 − RECORTE_MIN]. */
export function acotarInicio(v: number, fin: number): number {
  const f = Math.max(RECORTE_MIN, Math.min(1, Number.isFinite(fin) ? fin : 1));
  return Math.max(0, Math.min(f - RECORTE_MIN, Number.isFinite(v) ? v : 0));
}
/** Fija FIN sin bajar de INICIO + RECORTE_MIN; devuelve el valor acotado a [RECORTE_MIN, 1]. */
export function acotarFin(v: number, inicio: number): number {
  const i = Math.max(0, Math.min(1 - RECORTE_MIN, Number.isFinite(inicio) ? inicio : 0));
  return Math.min(1, Math.max(i + RECORTE_MIN, Number.isFinite(v) ? v : 1));
}
export interface Rango { offset: number; dur: number }
/**
 * Qué parte del buffer suena (s): con REVERSA el buffer es el invertido, así que el tramo [inicio, fin] del original
 * empieza en (1 − fin) del invertido. Escribe en out.
 */
export function rangoReproduccion(inicio: number, fin: number, durS: number, reversa: boolean, out: Rango): Rango {
  const i = acotarInicio(inicio, fin), f = acotarFin(fin, i), d = Math.max(0, Number.isFinite(durS) ? durS : 0);
  out.offset = (reversa ? 1 - f : i) * d;
  out.dur = Math.max(0, (f - i) * d);
  return out;
}
/** Índice de la muestra i en el buffer invertido (largo n). */
export const indiceReverso = (i: number, n: number): number => n - 1 - i;
/** Copia src invertido en dst (mismo largo). */
export function invertir(src: Float32Array, dst: Float32Array): Float32Array {
  const n = Math.min(src.length, dst.length);
  for (let i = 0; i < n; i++) dst[i] = src[n - 1 - i];
  return dst;
}

// ── sonidos de fábrica (cálculo directo en Float32Array; valores originales de este proyecto) ──
export const FABRICA_SAMPLER = [
  { nombre: "GOLPE",  dur: 0.6, loop: false },   // sub grave que cae de 120 a 40 Hz, con click
  { nombre: "METAL",  dur: 1.4, loop: false },   // golpe metálico: parciales inarmónicos con decaimientos distintos
  { nombre: "RUIDO",  dur: 2.0, loop: false },   // barrido de ruido ascendente (filtro que abre de 200 a 6000 Hz)
  { nombre: "CAÍDA",  dur: 1.8, loop: false },   // tono rico que se frena como una cinta (220 → 20 Hz)
  { nombre: "GLITCH", dur: 0.9, loop: false },   // ráfagas cortas de ruido y cuadrada con ritmo entrecortado
  { nombre: "VOZ",    dur: 2.5, loop: false },   // formante sintético "aaa" (pulso de 110 Hz por tres resonadores)
  { nombre: "CLICK",  dur: 0.12, loop: false },  // percusión seca y aguda
  { nombre: "DRON",   dur: 4.0, loop: true },    // textura sostenida, cíclica exacta en 4 s (loopeable sin salto)
] as const;
export const NOMBRES_FABRICA = FABRICA_SAMPLER.map(f => f.nombre);
/** Muestras de un sonido de fábrica a sampleRate sr. */
export const largoFabrica = (i: number, sr: number): number => Math.max(1, Math.round(FABRICA_SAMPLER[i].dur * sr));

function rngSampler(semilla: number): () => number {
  let x = (semilla >>> 0) || 1;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 2147483648 - 1; };
}
/** Resonador de dos polos (pasa-banda) aplicado en el lugar. */
function resonar(x: Float32Array, sr: number, f: number, q: number, out: Float32Array, suma: boolean): void {
  const w = 2 * Math.PI * f / sr, r = Math.exp(-w / (2 * q)), a1 = 2 * r * Math.cos(w), a2 = -r * r, g = 1 - r;
  let y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const y = g * x[i] + a1 * y1 + a2 * y2; y2 = y1; y1 = y; out[i] = suma ? out[i] + y : y; }
}
/** Quita la componente continua y normaliza a pico `pico` (silencio queda en silencio). */
export function normalizar(x: Float32Array, pico = 0.9, quitarDC = true): Float32Array {
  if (quitarDC) { let m = 0; for (let i = 0; i < x.length; i++) m += x[i]; m /= Math.max(1, x.length); for (let i = 0; i < x.length; i++) x[i] -= m; }
  let p = 0; for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i]));
  if (p > 0) { const k = pico / p; for (let i = 0; i < x.length; i++) x[i] *= k; }
  return x;
}
/**
 * Genera el sonido de fábrica i a sampleRate sr (Float32Array mono, pico 0,9, sin componente continua). Determinista.
 * Se llama UNA vez por pad al nacer el grafo (o al BORRAR una grabación).
 */
export function generarFabrica(i: number, sr: number): Float32Array {
  const n = largoFabrica(i, sr), x = new Float32Array(n), rnd = rngSampler(0x5103 + i * 977);
  const T = (k: number) => k / sr;
  switch (i) {
    case 0: { // GOLPE
      let fase = 0;
      for (let k = 0; k < n; k++) {
        const t = T(k), f = 40 + 80 * Math.exp(-t / 0.05);
        fase += 2 * Math.PI * f / sr;
        const click = t < 0.003 ? rnd() * (1 - t / 0.003) * 0.6 + Math.sin(2 * Math.PI * 3000 * t) * 0.4 : 0;
        x[k] = Math.sin(fase) * Math.exp(-t / 0.18) * Math.min(1, t / 0.001) + click;
      }
      break;
    }
    case 1: { // METAL
      const parc = [412, 587, 913, 1342, 1876, 2533], dec = [0.9, 0.6, 0.45, 0.32, 0.22, 0.15];
      for (let k = 0; k < n; k++) {
        const t = T(k);
        let s = 0;
        for (let j = 0; j < parc.length; j++) s += Math.sin(2 * Math.PI * parc[j] * t + j) * Math.exp(-t / dec[j]) / (1 + j * 0.3);
        x[k] = s * Math.min(1, t / 0.0005) + (t < 0.01 ? rnd() * (1 - t / 0.01) * 0.8 : 0);
      }
      break;
    }
    case 2: { // RUIDO: ruido por un pasa-bajos de un polo que abre de 200 a 6000 Hz
      let y = 0;
      for (let k = 0; k < n; k++) {
        const t = T(k), u = t / FABRICA_SAMPLER[2].dur, fc = 200 * Math.pow(30, u), a = 1 - Math.exp(-2 * Math.PI * fc / sr);
        y += a * (rnd() - y);
        x[k] = y * Math.min(1, u * 1.4) * (u > 0.92 ? (1 - u) / 0.08 : 1);
      }
      break;
    }
    case 3: { // CAÍDA: sierra suavizada cuya frecuencia se frena de 220 a 20 Hz
      let fase = 0, y = 0;
      for (let k = 0; k < n; k++) {
        const t = T(k), u = t / FABRICA_SAMPLER[3].dur, f = 20 + 200 * Math.pow(1 - u, 2.2);
        fase = (fase + f / sr) % 1;
        y += 0.25 * ((2 * fase - 1) - y);
        x[k] = y * Math.min(1, t / 0.01) * (u > 0.85 ? (1 - u) / 0.15 : 1);
      }
      break;
    }
    case 4: { // GLITCH: 16 tajadas encendidas o apagadas (patrón fijo), ruido y cuadradas de altura cambiante
      const on = [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1], alt = [880, 0, 660, 1320, 0, 440, 0, 0, 990, 1760, 550, 0, 1480, 0, 330, 2200];
      const tajada = Math.max(1, Math.floor(n / 16));
      for (let k = 0; k < n; k++) {
        const s = Math.min(15, Math.floor(k / tajada)), p = (k % tajada) / tajada;
        if (!on[s]) { x[k] = 0; continue; }
        const env = Math.min(1, p * 40) * Math.min(1, (1 - p) * 20);
        const cuad = Math.sin(2 * Math.PI * alt[s] * T(k)) >= 0 ? 1 : -1;
        x[k] = env * (s % 2 ? 0.7 * rnd() + 0.3 * cuad : 0.4 * rnd() + 0.6 * cuad);
      }
      break;
    }
    case 5: { // VOZ: tren de pulsos de 110 Hz (vibrato leve) por resonadores de formante de "a" (700, 1220, 2600 Hz)
      const fuente = new Float32Array(n);
      let fase = 0;
      for (let k = 0; k < n; k++) {
        const t = T(k), f = 110 * (1 + 0.012 * Math.sin(2 * Math.PI * 5 * t));
        fase += f / sr;
        if (fase >= 1) { fase -= 1; fuente[k] = 1; }
        fuente[k] += 0.02 * rnd();
      }
      resonar(fuente, sr, 700, 8, x, false); resonar(fuente, sr, 1220, 10, x, true); resonar(fuente, sr, 2600, 12, x, true);
      for (let k = 0; k < n; k++) { const t = T(k); x[k] *= Math.min(1, t / 0.2) * Math.min(1, (FABRICA_SAMPLER[5].dur - t) / 0.4); }
      break;
    }
    case 6: { // CLICK
      let prev = 0;
      for (let k = 0; k < n; k++) {
        const t = T(k), r = t < 0.005 ? rnd() : 0, hp = r - prev; prev = r;
        x[k] = hp * 0.7 + Math.sin(2 * Math.PI * 6000 * t) * Math.exp(-t / 0.008);
      }
      break;
    }
    default: { // DRON: frecuencias con un número entero de ciclos en 4 s (55, 55,25, 82,5 Hz) y AM de 0,5 Hz: el bucle no salta
      let y = 0;
      const ondas = [55, 55.25, 82.5, 110.5];
      // dos vueltas: la primera solo calienta el filtro (así el final empalma con el principio), la segunda escribe
      for (let vuelta = 0; vuelta < 2; vuelta++) {
        for (let k = 0; k < n; k++) {
          const t = T(k);
          let s = 0;
          for (let j = 0; j < ondas.length; j++) s += (2 * ((ondas[j] * t + 0.23 * (j + 1)) % 1) - 1) / (1 + j * 0.5);   // fases distintas: no se reinician juntas
          y += 0.08 * (s - y);
          if (vuelta === 1) x[k] = y * (0.75 + 0.25 * Math.sin(2 * Math.PI * 0.5 * t));
        }
      }
      break;
    }
  }
  return normalizar(x, 0.9);
}

// ── parámetros con fuentes ──
export type FuenteParam = "manual" | "cara";
export interface DefParamSampler {
  id: string; nombre: string; min: number; max: number; curva: "lin" | "exp" | "paso"; defecto: number; modulable: boolean;
  porPad: boolean;   // true: un valor por pad (se edita el del pad seleccionado)
  clave: string;     // clave del valor por defecto en DBG_SAMPLER
}
/** Globales: CORTE, RESONANCIA, VOLUMEN. Por pad: AFINACIÓN, INICIO, FIN, VOLUMEN DEL PAD, LOOP, REVERSA, MODO. */
export const PARAMS_SAMPLER: readonly DefParamSampler[] = [
  { id: "corte",      nombre: "CORTE",       min: 200, max: 16000, curva: "exp",  defecto: 7000, modulable: true,  porPad: false, clave: "CORTE" },
  { id: "resonancia", nombre: "RESONANCIA",  min: 0,   max: 1,     curva: "lin",  defecto: 0.15, modulable: true,  porPad: false, clave: "RESONANCIA" },
  { id: "volumen",    nombre: "VOLUMEN",     min: 0,   max: 1,     curva: "lin",  defecto: 0.75, modulable: true,  porPad: false, clave: "VOLUMEN" },
  { id: "afinacion",  nombre: "AFINACIÓN",   min: -12, max: 12,    curva: "lin",  defecto: 0,    modulable: true,  porPad: true,  clave: "AFINACION" },
  { id: "inicio",     nombre: "INICIO",      min: 0,   max: 1,     curva: "lin",  defecto: 0,    modulable: false, porPad: true,  clave: "INICIO" },
  { id: "fin",        nombre: "FIN",         min: 0,   max: 1,     curva: "lin",  defecto: 1,    modulable: false, porPad: true,  clave: "FIN" },
  { id: "volPad",     nombre: "VOLUMEN PAD", min: 0,   max: 1,     curva: "lin",  defecto: 0.8,  modulable: false, porPad: true,  clave: "VOL_PAD" },
  { id: "loop",       nombre: "LOOP",        min: 0,   max: 1,     curva: "paso", defecto: 0,    modulable: false, porPad: true,  clave: "LOOP" },
  { id: "reversa",    nombre: "REVERSA",     min: 0,   max: 1,     curva: "paso", defecto: 0,    modulable: false, porPad: true,  clave: "REVERSA" },
  { id: "modo",       nombre: "MODO",        min: 0,   max: 1,     curva: "paso", defecto: 0,    modulable: false, porPad: true,  clave: "MODO" },   // 0 DISPARO · 1 MIENTRAS
];
export const N_PARAMS = PARAMS_SAMPLER.length;
export function indiceParam(id: string): number { for (let i = 0; i < N_PARAMS; i++) if (PARAMS_SAMPLER[i].id === id) return i; return -1; }
export const PS = {
  corte: indiceParam("corte"), resonancia: indiceParam("resonancia"), volumen: indiceParam("volumen"), afinacion: indiceParam("afinacion"),
  inicio: indiceParam("inicio"), fin: indiceParam("fin"), volPad: indiceParam("volPad"), loop: indiceParam("loop"), reversa: indiceParam("reversa"), modo: indiceParam("modo"),
} as const;
export const MODO_DISPARO = 0, MODO_MIENTRAS = 1;
export function acotar(d: DefParamSampler, v: number): number {
  const x = Math.max(d.min, Math.min(d.max, Number.isFinite(v) ? v : d.defecto));
  return d.curva === "paso" ? Math.round(x) : x;
}
export function aNormal(d: DefParamSampler, real: number): number {
  const v = acotar(d, real);
  const t = d.curva === "exp" && d.min > 0 ? Math.log(v / d.min) / Math.log(d.max / d.min) : (v - d.min) / (d.max - d.min || 1);
  return Math.max(0, Math.min(1, t));
}
export function deNormal(d: DefParamSampler, t01: number): number {
  const t = Math.max(0, Math.min(1, Number.isFinite(t01) ? t01 : 0));
  const v = d.curva === "exp" && d.min > 0 ? d.min * Math.pow(d.max / d.min, t) : d.min + t * (d.max - d.min);
  return d.curva === "paso" ? Math.round(v) : v;
}
export interface EstadoSampler {
  global: Float64Array;   // valores manuales de los globales (índice de PARAMS_SAMPLER)
  pads: Float64Array;     // valores manuales por pad: pads[pad * N_PARAMS + i]
  cara: Float64Array;     // 0…1 de la cara (NaN = sin valor)
  caraActiva: boolean;
  sel: number;            // pad seleccionado (0…7)
  version: number;
}
export function crearEstado(): EstadoSampler {
  const global = new Float64Array(N_PARAMS), pads = new Float64Array(N_PARAMS * N_PADS), cara = new Float64Array(N_PARAMS).fill(NaN);
  for (let i = 0; i < N_PARAMS; i++) { global[i] = PARAMS_SAMPLER[i].defecto; for (let p = 0; p < N_PADS; p++) pads[p * N_PARAMS + i] = PARAMS_SAMPLER[i].defecto; }
  return { global, pads, cara, caraActiva: false, sel: 0, version: 0 };
}
const padValido = (p: number): number => Math.max(0, Math.min(N_PADS - 1, Math.round(Number.isFinite(p) ? p : 0)));
/** Valor manual (por índice; los porPad, del pad pedido). */
export function manualIdx(st: EstadoSampler, i: number, pad: number): number {
  return PARAMS_SAMPLER[i].porPad ? st.pads[padValido(pad) * N_PARAMS + i] : st.global[i];
}
/**
 * Fija un parámetro (regla de Z99, igual que el bajo y el sinte). "manual": valor REAL acotado; los por pad van al pad
 * pedido (por defecto el seleccionado) y INICIO/FIN se mantienen ordenados. "cara": valor 0…1, solo modulables, solo con
 * la cara activa; nunca pisa el manual (la AFINACIÓN de la cara vale para el pad seleccionado). Devuelve true si cambió.
 */
export function setParam(st: EstadoSampler, id: string, valor: number, fuente: FuenteParam, pad = st.sel): boolean {
  const i = indiceParam(id);
  if (i < 0 || !Number.isFinite(valor)) return false;
  const d = PARAMS_SAMPLER[i];
  if (fuente === "cara") {
    if (!d.modulable || !st.caraActiva) return false;
    st.cara[i] = Math.max(0, Math.min(1, valor)); st.version++;
    return true;
  }
  let v = acotar(d, valor);
  if (d.porPad) {
    const b = padValido(pad) * N_PARAMS;
    if (i === PS.inicio) v = acotarInicio(v, st.pads[b + PS.fin]);
    if (i === PS.fin) v = acotarFin(v, st.pads[b + PS.inicio]);
    st.pads[b + i] = v;
  } else st.global[i] = v;
  st.version++;
  return true;
}
/** Valor que usa el motor: el de la cara (si está activa, tiene valor y, si es por pad, es el seleccionado) o el manual. */
export function valorIdx(st: EstadoSampler, i: number, pad = st.sel): number {
  const d = PARAMS_SAMPLER[i], c = st.cara[i];
  if (st.caraActiva && d.modulable && Number.isFinite(c) && (!d.porPad || padValido(pad) === st.sel)) return deNormal(d, c);
  return manualIdx(st, i, pad);
}
export function valorParam(st: EstadoSampler, id: string, pad = st.sel): number { const i = indiceParam(id); return i < 0 ? NaN : valorIdx(st, i, pad); }
export function activarCara(st: EstadoSampler, on: boolean): void { st.caraActiva = on; if (!on) st.cara.fill(NaN); st.version++; }
export function liberarParamCara(st: EstadoSampler, id: string): boolean {
  const i = indiceParam(id);
  if (i < 0 || !Number.isFinite(st.cara[i])) return false;
  st.cara[i] = NaN; st.version++;
  return true;
}
/** Restaura los parámetros de un pad a sus valores por defecto (el DRON de fábrica vuelve con LOOP). */
export function restaurarPad(st: EstadoSampler, pad: number, loopFabrica: boolean): void {
  const b = padValido(pad) * N_PARAMS;
  for (let i = 0; i < N_PARAMS; i++) if (PARAMS_SAMPLER[i].porPad) st.pads[b + i] = PARAMS_SAMPLER[i].defecto;
  st.pads[b + PS.loop] = loopFabrica ? 1 : 0;
  st.version++;
}

// ── voces: tope de fuentes vivas con robo ──
/**
 * Un AudioBufferSourceNode es de un solo uso (así lo define el navegador): el motor crea uno por disparo. Lo que se
 * preasigna son las RANURAS (cada una con su ganancia, para la caída corta del robo y del MIENTRAS). Nunca hay más de
 * `maxVivas` fuentes vivas: la nueva roba la más antigua.
 */
export interface Ranuras { n: number; pad: Int8Array; viva: Uint8Array; tOn: Float64Array; tFin: Float64Array; robada: boolean; robos: number }
export function crearRanuras(n: number): Ranuras {
  const k = Math.max(1, Math.min(64, Math.floor(Number.isFinite(n) ? n : 12)));
  return { n: k, pad: new Int8Array(k).fill(-1), viva: new Uint8Array(k), tOn: new Float64Array(k), tFin: new Float64Array(k), robada: false, robos: 0 };
}
/** Vivas en t (las que no llegaron a su fin; Infinity = en bucle o mantenida). */
export function vivas(r: Ranuras, t: number): number { let c = 0; for (let i = 0; i < r.n; i++) if (r.viva[i] && r.tFin[i] > t) c++; return c; }
/**
 * Ranura para un disparo del pad en t que dura durS (Infinity si queda en bucle o mantenida). Si ya hay `maxVivas`
 * vivas (o no hay ranura libre), roba la más antigua (r.robada = true: el motor hace una caída de ~8 ms).
 */
export function asignarRanura(r: Ranuras, pad: number, t: number, durS: number, maxVivas: number): number {
  r.robada = false;
  for (let i = 0; i < r.n; i++) if (r.viva[i] && r.tFin[i] <= t) r.viva[i] = 0;   // las que terminaron
  let elegida = -1;
  if (vivas(r, t) < Math.max(1, maxVivas)) {
    let mejor = Infinity;
    for (let i = 0; i < r.n; i++) if (!r.viva[i] && r.tFin[i] < mejor) { mejor = r.tFin[i]; elegida = i; }
  }
  if (elegida < 0) {
    let mejor = Infinity;
    for (let i = 0; i < r.n; i++) if (r.viva[i] && r.tOn[i] < mejor) { mejor = r.tOn[i]; elegida = i; }
    r.robada = true; r.robos++;
  }
  r.pad[elegida] = pad; r.viva[elegida] = 1; r.tOn[elegida] = t; r.tFin[elegida] = t + Math.max(0, durS);
  return elegida;
}
/** Corta en t las fuentes vivas del pad (MIENTRAS al soltar, o un bucle). Devuelve cuántas; escribe sus índices en out. */
export function cortarPad(r: Ranuras, pad: number, t: number, out: Int32Array): number {
  let c = 0;
  for (let i = 0; i < r.n; i++) {
    if (!r.viva[i] || r.pad[i] !== pad || r.tFin[i] <= t) continue;
    r.tFin[i] = t; r.viva[i] = 0;
    if (c < out.length) out[c++] = i;
  }
  return c;
}
/** ¿El pad tiene alguna fuente viva en t? (luz "sonando"). */
export function padSonando(r: Ranuras, pad: number, t: number): boolean { for (let i = 0; i < r.n; i++) if (r.viva[i] && r.pad[i] === pad && r.tFin[i] > t) return true; return false; }
export function liberarRanura(r: Ranuras, i: number): void { if (i >= 0 && i < r.n) { r.viva[i] = 0; r.tFin[i] = 0; } }

// ── cuantización ──
export const QUANTS = ["OFF", "1/16", "1/4", "COMPÁS"] as const;
export const SEMICORCHEAS_QUANT = [0, 1, 4, 16] as const;
/**
 * Próximo punto de la grilla (s) desde `ahora`: la grilla son múltiplos de `semicorcheas` semicorcheas contados desde el
 * inicio del compás (tCompas) de un compás que dura durCompas. Nunca antes de ahora; si ahora cae justo sobre un punto, es
 * ese punto.
 */
export function proximaGrilla(ahora: number, tCompas: number, durCompas: number, semicorcheas: number): number {
  const g = Math.max(1e-6, (durCompas / 16) * Math.max(1, semicorcheas));
  const k = Math.ceil((ahora - tCompas) / g - 1e-9);
  return tCompas + k * g;
}
/** Inicio del compás del próximo paso que va a emitir el reloj (paso = su índice dentro del compás, d = duración). */
export function inicioCompas(siguienteT: number, paso: number, durPaso: number): number { return siguienteT - paso * durPaso; }

// ── teclas de los pads (computadora) ──
/**
 * Dos filas como los pads del atril (posición física, KeyboardEvent.code): F G H J arriba (pads 1 a 4) y V B N M abajo
 * (pads 5 a 8). V B N M son atajos Z–M de los otros atriles: en el modo del SM-40 esos atajos se desactivan (como en el
 * SY-40). Libres a propósito: E, Q, X (corta la transmisión), W A S D, Z C (atajos), 1 a 4 (terminal) y el piano del SY-40.
 */
export const TECLAS_PADS: readonly (readonly [string, number])[] = [
  ["KeyF", 0], ["KeyG", 1], ["KeyH", 2], ["KeyJ", 3], ["KeyV", 4], ["KeyB", 5], ["KeyN", 6], ["KeyM", 7],
];
export const LETRAS_PADS = ["F", "G", "H", "J", "V", "B", "N", "M"] as const;
export const TECLAS_PROHIBIDAS = ["KeyE", "KeyQ", "KeyX", "KeyW", "KeyA", "KeyS", "KeyD", "Digit1", "Digit2", "Digit3", "Digit4", "ShiftLeft", "ShiftRight", "Space", "Enter"] as const;
export function padDeTecla(code: string): number { for (let i = 0; i < TECLAS_PADS.length; i++) if (TECLAS_PADS[i][0] === code) return TECLAS_PADS[i][1]; return -1; }
export interface TeclasPads { abajo: Uint8Array }
export function crearTeclasPads(): TeclasPads { return { abajo: new Uint8Array(N_PADS) }; }
/** keydown: pad si es una pulsación NUEVA (ni autorepetición ni tecla ya abajo); si no, −1. */
export function teclaPadAbajo(k: TeclasPads, code: string, repeticion: boolean): number {
  const p = padDeTecla(code);
  if (p < 0 || repeticion || k.abajo[p]) return -1;
  k.abajo[p] = 1;
  return p;
}
/** keyup: pad si estaba abajo; si no, −1. */
export function teclaPadArriba(k: TeclasPads, code: string): number {
  const p = padDeTecla(code);
  if (p < 0 || !k.abajo[p]) return -1;
  k.abajo[p] = 0;
  return p;
}

// ── forma de onda del display ──
/** Mínimo y máximo de cada una de n columnas del sonido (para dibujarlo). Escribe en outMin / outMax. Sin allocations. */
export function picosOnda(x: Float32Array, n: number, outMin: Float32Array, outMax: Float32Array): number {
  const m = Math.max(1, Math.min(outMin.length, outMax.length, Math.floor(n)));
  const L = x.length;
  for (let c = 0; c < m; c++) {
    const a = Math.floor((c / m) * L), b = Math.max(a + 1, Math.floor(((c + 1) / m) * L));
    let lo = 0, hi = 0;
    for (let i = a; i < b && i < L; i++) { const v = x[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    outMin[c] = Number.isFinite(lo) ? Math.max(-1, lo) : 0; outMax[c] = Number.isFinite(hi) ? Math.min(1, hi) : 0;
  }
  return m;
}

// ── grabación ──
export const FUENTES_GRAB = ["MIC", "MEZCLA"] as const;
export type EstadoGrab = "libre" | "pidiendo" | "grabando" | "procesando";
/** Segundos grabados acotados al máximo (el motor corta solo al llegar). */
export const tiempoGrab = (t0: number, ahora: number, maxS: number): number => Math.max(0, Math.min(Math.max(0.5, maxS), ahora - t0));

// ── display ──
export function lineaSampler1(pad: number, nombre: string, estado: string, bpm: number): string {
  return `PAD ${pad + 1} ${nombre} · ${estado} · ${Math.round(Number.isFinite(bpm) ? bpm : 0)} BPM`;
}
export const TEXTO_REPOSO_SAMPLER = "TECLAS F G H J · V B N M · Q SALE";
