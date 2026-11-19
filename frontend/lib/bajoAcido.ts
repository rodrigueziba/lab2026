// Z99: BAJO ÁCIDO (atril BA-40): lógica PURA y SIN imports (prueba: scripts/bajo-acido-test.mjs). El motor de audio está
// en lib/audio/bajoAcido.ts; el atril en lib/atrilBajo.ts y components/AtrilBajoNuevo.tsx.
// Contiene: frecuencia de cada nota, nombres, patrones (5 de fábrica, originales), qué pasa en cada paso (nota, ligada,
// silencio), qué pasos del bajo caen en cada paso del reloj del núcleo (sincronía con la caja de ritmos con cualquier
// cantidad de pasos), curva del filtro para el display, nivel y apertura del acento, y la API de parámetros con fuentes
// ("manual" hoy; "cara" preparada para Z100).

// ── notas ──
/**
 * Frecuencia de una nota MIDI. La4 (MIDI 69) = 440 Hz y cada semitono multiplica por 2^(1/12): 12 semitonos (una octava)
 * duplican la frecuencia. Por eso: frecuencia = 440 × 2^((nota − 69) / 12).
 */
export function midiAFrecuencia(nota: number): number {
  const n = Number.isFinite(nota) ? nota : 69;
  return 440 * Math.pow(2, (n - 69) / 12);
}
export const NOMBRES_NOTA = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
/** "D#2" (MIDI 36 = C2, como en la mayoría de los secuenciadores: C4 = 60). */
export function nombreNota(midi: number): string {
  const m = Math.round(Number.isFinite(midi) ? midi : 36);
  return NOMBRES_NOTA[((m % 12) + 12) % 12] + String(Math.floor(m / 12) - 1);
}

// ── patrones ──
export const N_PASOS = 16;
export const NOTA_MAX = 24;   // semitonos sobre la RAÍZ (dos octavas)
export interface PatronBajo { activo: Uint8Array; nota: Uint8Array; acento: Uint8Array; desliz: Uint8Array }
export function crearPatronBajo(): PatronBajo {
  return { activo: new Uint8Array(N_PASOS), nota: new Uint8Array(N_PASOS), acento: new Uint8Array(N_PASOS), desliz: new Uint8Array(N_PASOS) };
}
export function limpiarPatron(p: PatronBajo): void { p.activo.fill(0); p.nota.fill(0); p.acento.fill(0); p.desliz.fill(0); }
export function copiarPatron(de: PatronBajo, a: PatronBajo): void { a.activo.set(de.activo); a.nota.set(de.nota); a.acento.set(de.acento); a.desliz.set(de.desliz); }
export function patronesIguales(x: PatronBajo, y: PatronBajo): boolean {
  for (let i = 0; i < N_PASOS; i++) {
    if (x.activo[i] !== y.activo[i] || x.acento[i] !== y.acento[i] || x.desliz[i] !== y.desliz[i]) return false;
    if (x.activo[i] && x.nota[i] !== y.nota[i]) return false;
  }
  return true;
}
export function activos(p: PatronBajo): number { let n = 0; for (let i = 0; i < N_PASOS; i++) n += p.activo[i] ? 1 : 0; return n; }
export const acotarNota = (n: number): number => Math.max(0, Math.min(NOTA_MAX, Math.round(Number.isFinite(n) ? n : 0)));

/**
 * Patrones de fábrica (líneas originales de este proyecto). Cada paso: "-" silencio, o semitonos sobre la RAÍZ con
 * sufijos "a" (acento) y "s" (desliz hacia el paso siguiente).
 */
export const FABRICA = {
  CHICAGO: ["0", "0a", "12", "0", "3s", "5", "0", "-", "0", "10a", "0s", "12", "7", "-", "0a", "5s"],
  RAGA:    ["0", "1s", "4", "5a", "7", "8s", "7", "5", "4a", "-", "1", "0s", "1", "4", "5a", "-"],
  DEEP:    ["0a", "-", "-", "0", "-", "7s", "5", "-", "0", "-", "3", "-", "0a", "-", "10s", "7"],
  TECHNO:  ["0", "12", "0", "12a", "0", "12", "3", "15a", "0", "12", "0", "12a", "5", "17", "3s", "15"],
  MINIMAL: ["0a", "-", "-", "-", "0", "-", "-", "12s", "12", "-", "-", "-", "7", "-", "5", "-"],
} as const;
export type NombrePatron = keyof typeof FABRICA;
export const NOMBRES_PATRON = Object.keys(FABRICA) as NombrePatron[];
/** Carga un patrón de fábrica en p (la memoria editable). */
export function cargarFabrica(nombre: NombrePatron, p: PatronBajo): void {
  limpiarPatron(p);
  const pasos = FABRICA[nombre];
  for (let i = 0; i < N_PASOS; i++) {
    const s = pasos[i] ?? "-";
    if (s === "-") continue;
    p.activo[i] = 1;
    p.nota[i] = acotarNota(parseInt(s, 10));
    p.acento[i] = s.includes("a") ? 1 : 0;
    p.desliz[i] = s.includes("s") ? 1 : 0;
  }
}

// ── qué pasa en cada paso ──
export const EV_SILENCIO = 0, EV_NOTA = 1, EV_LIGADA = 2;
export interface EventoPaso { tipo: number; nota: number; acento: boolean; mantener: boolean }
/**
 * Paso k del patrón: NOTA (dispara la envolvente), LIGADA (el paso anterior tenía DESLIZ y este está activo: la altura se
 * desliza y la envolvente NO se reinicia, como en el instrumento original) o SILENCIO. mantener = este paso tiene DESLIZ:
 * la nota no se suelta al final del paso (queda ligada al siguiente). Escribe en out (sin allocations).
 */
export function eventoPaso(p: PatronBajo, k: number, out: EventoPaso): EventoPaso {
  const i = ((Math.floor(k) % N_PASOS) + N_PASOS) % N_PASOS, prev = (i + N_PASOS - 1) % N_PASOS;
  if (!p.activo[i]) { out.tipo = EV_SILENCIO; out.nota = 0; out.acento = false; out.mantener = false; return out; }
  out.tipo = p.activo[prev] && p.desliz[prev] ? EV_LIGADA : EV_NOTA;
  out.nota = acotarNota(p.nota[i]);
  out.acento = !!p.acento[i];
  out.mantener = !!p.desliz[i];
  return out;
}

// ── sincronía con el reloj del núcleo ──
/**
 * Qué pasos del bajo (16 por compás) caen dentro del paso `pasoReloj` (0…nReloj−1) del reloj compartido, que empieza en
 * t y dura durReloj. Con nReloj = 16 es uno por paso; con 8, dos por paso; con 32, uno cada dos; con 12, uno o dos según caiga. Las
 * ventanas de pasos consecutivos se tocan sin solaparse: ningún paso se pierde ni se repite. Escribe k (0…15) y su
 * tiempo exacto en outK / outT; devuelve cuántos.
 */
export function pasosEnVentana(pasoReloj: number, nReloj: number, t: number, durReloj: number, outK: Int32Array, outT: Float64Array): number {
  const n = Math.max(1, Math.floor(Number.isFinite(nReloj) ? nReloj : 16));
  const dur = Math.max(1e-6, Number.isFinite(durReloj) ? durReloj : 0.125), t0 = Number.isFinite(t) ? t : 0;
  const pr = ((Math.floor(pasoReloj) % n) + n) % n;
  const escala = N_PASOS / n;                  // pasos del bajo por paso del reloj
  const d16 = dur / escala;                    // duración de un paso del bajo
  const a = pr * escala, b = a + escala;       // ventana en unidades de paso del bajo
  let c = 0;
  for (let k = Math.ceil(a - 1e-9); k < b - 1e-9 && c < outK.length; k++) {
    outK[c] = k % N_PASOS;
    outT[c] = t0 + (k - a) * d16;
    c++;
  }
  return c;
}
/** El paso que está sonando: el k con el tiempo programado más reciente que ya pasó (−1 si ninguno). Sin allocations. */
export function pasoSonando(tiempos: Float64Array, ahora: number, maxAtras = 1): number {
  let mejor = -1, tMejor = -Infinity;
  for (let k = 0; k < tiempos.length; k++) {
    const tk = tiempos[k];
    if (tk <= ahora && tk > tMejor && ahora - tk < maxAtras) { tMejor = tk; mejor = k; }
  }
  return mejor;
}

// ── acento ──
/** Nivel (0…1) de una nota: con acento suena más fuerte según ACENTO (0…1). */
export function nivelNota(acento: boolean, acento01: number): number {
  const a = Math.max(0, Math.min(1, Number.isFinite(acento01) ? acento01 : 0));
  return Math.min(1, 0.62 * (acento ? 1 + 0.6 * a : 1));
}
/** Cuánto abre la envolvente el filtro (0…1): el acento lo abre más. */
export function aperturaNota(modEnv01: number, acento: boolean, acento01: number): number {
  const m = Math.max(0, Math.min(1, Number.isFinite(modEnv01) ? modEnv01 : 0)), a = Math.max(0, Math.min(1, Number.isFinite(acento01) ? acento01 : 0));
  return Math.min(1, m * (acento ? 1 + 0.8 * a : 1) + (acento ? 0.15 * a : 0));
}
/** Corte (Hz) en el pico de la envolvente: sube hasta `octavas` × apertura, sin pasar fMax. */
export function corteConEnvolvente(corteHz: number, apertura01: number, octavas: number, fMax: number): number {
  const c = Math.max(1, Number.isFinite(corteHz) ? corteHz : 500), ap = Math.max(0, Math.min(1, Number.isFinite(apertura01) ? apertura01 : 0));
  return Math.min(Math.max(c, fMax), c * Math.pow(2, Math.max(0, octavas) * ap));
}

// ── filtro: resonancia y curva para el display ──
/** RESONANCIA 0…1 → Q de la etapa resonante (0,707 = sin pico … resMax). */
export function qDeResonancia(res01: number, resMax: number): number {
  const r = Math.max(0, Math.min(1, Number.isFinite(res01) ? res01 : 0)), m = Math.max(0.8, Number.isFinite(resMax) ? resMax : 18);
  return 0.707 * Math.pow(m / 0.707, r * r);   // curva suave: el pico aparece hacia el final del recorrido
}
/**
 * Respuesta en magnitud del pasa-bajos de 4 polos del motor (dos etapas de 2 polos: una sin resonancia, Q 0,707, y otra con
 * la resonancia): |H| = H2(Q 0,707) · H2(Q). H2 = 1 / √((1 − x²)² + (x/Q)²), x = f / fc.
 */
export function magnitudFiltro(fHz: number, fcHz: number, q: number): number {
  const x = Math.max(0, fHz) / Math.max(1e-6, fcHz), qq = Math.max(0.1, q), x2 = x * x;
  const h1 = 1 / Math.sqrt((1 - x2) * (1 - x2) + (x / 0.707) * (x / 0.707));
  const h2 = 1 / Math.sqrt((1 - x2) * (1 - x2) + (x / qq) * (x / qq));
  return h1 * h2;
}
export const DB_MIN = -48, DB_MAX = 24;
/**
 * Curva para el display: n puntos de fMin a fMax (escala logarítmica), en dB llevados a [0, 1] (−48 dB → 0, +24 → 1).
 * Nunca NaN ni fuera de [0, 1]. Escribe en out.
 */
export function curvaFiltro(fcHz: number, q: number, fMin: number, fMax: number, out: Float32Array, n: number): Float32Array {
  const m = Math.max(2, Math.min(out.length, Math.floor(n)));
  const a = Math.max(1, Number.isFinite(fMin) ? fMin : 20), b = Math.max(a * 1.01, Number.isFinite(fMax) ? fMax : 20000);
  const fc = Number.isFinite(fcHz) ? fcHz : 500, qq = Number.isFinite(q) ? q : 0.707;
  for (let i = 0; i < m; i++) {
    const f = a * Math.pow(b / a, i / (m - 1));
    const db = 20 * Math.log10(Math.max(1e-9, magnitudFiltro(f, fc, qq)));
    const v = (db - DB_MIN) / (DB_MAX - DB_MIN);
    out[i] = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
  }
  return out;
}

// ── parámetros con fuentes (Z100: la cara moverá los "modulables" sin tocar los controles) ──
export type FuenteParam = "manual" | "cara";
export interface DefParamBajo { id: string; nombre: string; min: number; max: number; curva: "lin" | "exp"; defecto: number; modulable: boolean; unidad: string }
export const PARAMS_BAJO: readonly DefParamBajo[] = [
  { id: "afinacion",  nombre: "AFINACIÓN",  min: -12,  max: 12,   curva: "lin", defecto: 0,    modulable: false, unidad: "st" },
  { id: "corte",      nombre: "CORTE",      min: 60,   max: 6000, curva: "exp", defecto: 420,  modulable: true,  unidad: "Hz" },
  { id: "resonancia", nombre: "RESONANCIA", min: 0,    max: 1,    curva: "lin", defecto: 0.6,  modulable: true,  unidad: "" },
  { id: "modEnv",     nombre: "MOD. ENV.",  min: 0,    max: 1,    curva: "lin", defecto: 0.6,  modulable: true,  unidad: "" },
  { id: "decay",      nombre: "DECAY",      min: 0.05, max: 1.5,  curva: "exp", defecto: 0.3,  modulable: true,  unidad: "s" },
  { id: "acento",     nombre: "ACENTO",     min: 0,    max: 1,    curva: "lin", defecto: 0.6,  modulable: true,  unidad: "" },
  { id: "desliz",     nombre: "DESLIZ",     min: 0.02, max: 0.3,  curva: "exp", defecto: 0.06, modulable: false, unidad: "s" },
  { id: "distorsion", nombre: "DISTORSIÓN", min: 0,    max: 1,    curva: "lin", defecto: 0.15, modulable: true,  unidad: "" },
  { id: "volumen",    nombre: "VOLUMEN",    min: 0,    max: 1,    curva: "lin", defecto: 0.7,  modulable: false, unidad: "" },
];
export function indiceParam(id: string): number { for (let i = 0; i < PARAMS_BAJO.length; i++) if (PARAMS_BAJO[i].id === id) return i; return -1; }
/** Real → 0…1 (exponencial: proporción en octavas). */
export function aNormal(d: DefParamBajo, real: number): number {
  const v = Math.max(d.min, Math.min(d.max, Number.isFinite(real) ? real : d.defecto));
  const t = d.curva === "exp" && d.min > 0 ? Math.log(v / d.min) / Math.log(d.max / d.min) : (v - d.min) / (d.max - d.min || 1);
  return Math.max(0, Math.min(1, t));
}
/** 0…1 → real. */
export function deNormal(d: DefParamBajo, t01: number): number {
  const t = Math.max(0, Math.min(1, Number.isFinite(t01) ? t01 : 0));
  return d.curva === "exp" && d.min > 0 ? d.min * Math.pow(d.max / d.min, t) : d.min + t * (d.max - d.min);
}
export interface EstadoParams { manual: Float64Array; cara: Float64Array; caraActiva: boolean; version: number }
/** Valores manuales en su defecto; la cara sin valor (NaN) e inactiva. */
export function crearParams(): EstadoParams {
  const manual = new Float64Array(PARAMS_BAJO.length), cara = new Float64Array(PARAMS_BAJO.length).fill(NaN);
  for (let i = 0; i < PARAMS_BAJO.length; i++) manual[i] = PARAMS_BAJO[i].defecto;
  return { manual, cara, caraActiva: false, version: 0 };
}
/**
 * Fija un parámetro. fuente "manual": valor REAL (acotado al rango); lo mueven las perillas y el menú. fuente "cara":
 * valor NORMALIZADO 0…1, solo para parámetros modulables y solo si la cara está activa; nunca pisa el valor manual
 * (al desactivar la cara, vuelve el manual). Devuelve true si cambió algo.
 */
export function setParam(st: EstadoParams, id: string, valor: number, fuente: FuenteParam): boolean {
  const i = indiceParam(id);
  if (i < 0 || !Number.isFinite(valor)) return false;
  const d = PARAMS_BAJO[i];
  if (fuente === "manual") { st.manual[i] = Math.max(d.min, Math.min(d.max, valor)); st.version++; return true; }
  if (!d.modulable || !st.caraActiva) return false;
  st.cara[i] = Math.max(0, Math.min(1, valor)); st.version++;
  return true;
}
/** Valor real que usa el motor: el de la cara si está activa y tiene valor para ese parámetro; si no, el manual. */
export function valorParam(st: EstadoParams, id: string): number {
  const i = indiceParam(id);
  if (i < 0) return NaN;
  const d = PARAMS_BAJO[i], c = st.cara[i];
  return st.caraActiva && d.modulable && Number.isFinite(c) ? deNormal(d, c) : st.manual[i];
}
export function activarCara(st: EstadoParams, on: boolean): void { st.caraActiva = on; if (!on) st.cara.fill(NaN); st.version++; }
export function restaurarParams(st: EstadoParams): void { for (let i = 0; i < PARAMS_BAJO.length; i++) st.manual[i] = PARAMS_BAJO[i].defecto; st.cara.fill(NaN); st.version++; }
/** Z100: suelta un parámetro de la cara (prioridad manual mientras se arrastra su perilla): vuelve a sonar el manual. */
export function liberarParamCara(st: EstadoParams, id: string): boolean {
  const i = indiceParam(id);
  if (i < 0 || !Number.isFinite(st.cara[i])) return false;
  st.cara[i] = NaN; st.version++;
  return true;
}

// ── Z100: gestos de la cara que actúan sobre la secuencia ──
/** Siguiente patrón de fábrica en orden (después del último vuelve al primero; desde LIMPIO o uno desconocido, el primero). */
export function siguienteNombrePatron(actual: string): NombrePatron {
  const i = (NOMBRES_PATRON as string[]).indexOf(actual);
  return NOMBRES_PATRON[(i + 1) % NOMBRES_PATRON.length];
}
/** Acento forzado pendiente (lo arma el cabeceo). */
export interface AcentoForzado { pendiente: boolean; aplicados: number }
export function crearAcentoForzado(): AcentoForzado { return { pendiente: false, aplicados: 0 }; }
/**
 * Si hay un acento forzado pendiente y este paso dispara una NOTA, la acentúa y lo consume (solo esa nota). No toca el
 * patrón: modifica el evento (copia de trabajo), nunca PATRON_BAJO. Silencios y notas ligadas no lo consumen.
 */
export function aplicarAcentoForzado(ev: EventoPaso, a: AcentoForzado): boolean {
  if (!a.pendiente || ev.tipo !== EV_NOTA) return false;
  ev.acento = true; a.pendiente = false; a.aplicados++;
  return true;
}

// ── radios del atril (uno encendido por grupo) ──
export function radioBajo(opciones: readonly string[], elegida: string, out: number[]): number[] {
  const k = Math.max(0, opciones.indexOf(elegida));
  for (let i = 0; i < opciones.length; i++) out[i] = i === k ? 1 : 0;
  return out;
}

// ── display ──
/** Línea 1: "CHICAGO · EDITADO · 124 BPM · SONANDO" (se arma solo cuando cambia algo, no por cuadro). */
export function lineaBajo1(patron: string, editado: boolean, bpm: number, estado: "sonando" | "parado" | "silencio"): string {
  const est = estado === "sonando" ? "SONANDO" : estado === "silencio" ? "MUDO" : "PARADO";
  return `${patron || "LIBRE"}${editado ? " · EDITADO" : ""} · ${Math.round(Number.isFinite(bpm) ? bpm : 0)} BPM · ${est}`;
}
