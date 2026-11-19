// Z101: SINTETIZADOR SY-40: lógica PURA y SIN imports (prueba: scripts/sinte-test.mjs). El motor de audio está en
// lib/audio/sinte.ts; el atril en lib/atrilSinte.ts y components/AtrilSinteNuevo.tsx.
// Contiene: frecuencia de cada nota, parámetros con fuentes ("manual" y "cara", la regla de Z99), sonidos de fábrica,
// asignación de voces con robo, notas mantenidas, arpegiador (orden y tiempos sobre el reloj del núcleo), tiempo del
// eco desde el BPM, teclado de la computadora (piano) y lo que dibuja el display (forma de onda y curva del filtro).
// Todo escribe en estructuras preasignadas: nada de esto crea objetos en el bucle del reloj ni por cuadro.

// ── notas ──
/**
 * Frecuencia de una nota MIDI. La4 (MIDI 69) = 440 Hz y cada semitono multiplica por 2^(1/12): 12 semitonos (una octava)
 * duplican la frecuencia. Por eso: frecuencia = 440 × 2^((nota − 69) / 12).
 */
export function midiAFrecuencia(nota: number): number {
  const n = Number.isFinite(nota) ? nota : 69;
  return 440 * Math.pow(2, (n - 69) / 12);
}
export const NOMBRES_NOTA = ["DO", "DO#", "RE", "RE#", "MI", "FA", "FA#", "SOL", "SOL#", "LA", "LA#", "SI"] as const;
/** "DO4" (MIDI 60 = DO4, como C4 en la mayoría de los instrumentos). */
export function nombreNota(midi: number): string {
  const m = Math.round(Number.isFinite(midi) ? midi : 60);
  return NOMBRES_NOTA[((m % 12) + 12) % 12] + String(Math.floor(m / 12) - 1);
}
/** MIDI de la tecla DO de la octava `oct` (DO4 = 60). */
export const notaBase = (oct: number): number => 12 * (Math.round(Number.isFinite(oct) ? oct : 4) + 1);

// ── selectores ──
export const FORMAS = ["SENO", "TRIÁNGULO", "SIERRA", "CUADRADA"] as const;
export const FORMAS_CORTAS = ["SENO", "TRI", "SIERRA", "CUAD"] as const;
export const TIPOS_OSC = ["sine", "triangle", "sawtooth", "square"] as const;
export const SUB_ONDAS = ["CUADRADA", "SENO"] as const;
export const DESTINOS_LFO = ["AFINACIÓN", "CORTE", "VOLUMEN"] as const;
export const DESTINOS_LFO_CORTOS = ["AFIN", "CORTE", "VOL"] as const;
export const TIEMPOS_ECO = ["1/8", "1/4", "1/4."] as const;
export const NOMBRES_TIEMPO_ECO = ["1/8", "1/4", "1/4 CON PUNTILLO"] as const;
export const PULSOS_ECO = [0.5, 1, 1.5] as const;          // negras por repetición
export const PATRONES_ARP = ["ARRIBA", "ABAJO", "IDA Y VUELTA", "AZAR"] as const;
export const PATRONES_ARP_CORTOS = ["ARRIBA", "ABAJO", "IDA-V", "AZAR"] as const;
export const ARP_ARRIBA = 0, ARP_ABAJO = 1, ARP_IDA_VUELTA = 2, ARP_AZAR = 3;
export const VELOCIDADES_ARP = ["1/16", "1/8", "1/4"] as const;
export const SEMICORCHEAS_ARP = [1, 2, 4] as const;        // semicorcheas por paso del arpegiador
export const SEMICORCHEAS_COMPAS = 16;

// ── parámetros con fuentes ──
export type FuenteParam = "manual" | "cara";
export interface DefParamSinte {
  id: string; nombre: string; min: number; max: number; curva: "lin" | "exp" | "paso"; defecto: number; modulable: boolean; unidad: string;
  clave: string;   // clave del valor por defecto en DBG_SINTE
}
/**
 * Parámetros del SY-40. "paso" = selector entero (formas, destino, tiempo del eco). Modulables (la cara, cuando se
 * enchufe): CORTE, RESONANCIA, MOD. ENV., DESAFINE, MEZCLA, LFO PROFUNDIDAD, ECO MEZCLA y VOLUMEN.
 */
export const PARAMS_SINTE: readonly DefParamSinte[] = [
  { id: "onda1",       nombre: "OSC 1",          min: 0,     max: 3,     curva: "paso", defecto: 2,    modulable: false, unidad: "",   clave: "ONDA1" },
  { id: "onda2",       nombre: "OSC 2",          min: 0,     max: 3,     curva: "paso", defecto: 2,    modulable: false, unidad: "",   clave: "ONDA2" },
  { id: "desafine",    nombre: "DESAFINE",       min: 0,     max: 50,    curva: "lin",  defecto: 8,    modulable: true,  unidad: "c",  clave: "DESAFINE" },
  { id: "mezcla",      nombre: "MEZCLA",         min: 0,     max: 1,     curva: "lin",  defecto: 0.5,  modulable: true,  unidad: "",   clave: "MEZCLA" },
  { id: "sub",         nombre: "SUB",            min: 0,     max: 1,     curva: "lin",  defecto: 0.3,  modulable: false, unidad: "",   clave: "SUB" },
  { id: "subOnda",     nombre: "SUB ONDA",       min: 0,     max: 1,     curva: "paso", defecto: 0,    modulable: false, unidad: "",   clave: "SUB_ONDA" },
  { id: "ruido",       nombre: "RUIDO",          min: 0,     max: 1,     curva: "lin",  defecto: 0,    modulable: false, unidad: "",   clave: "RUIDO" },
  { id: "corte",       nombre: "CORTE",          min: 40,    max: 12000, curva: "exp",  defecto: 2400, modulable: true,  unidad: "Hz", clave: "CORTE" },
  { id: "resonancia",  nombre: "RESONANCIA",     min: 0,     max: 1,     curva: "lin",  defecto: 0.25, modulable: true,  unidad: "",   clave: "RESONANCIA" },
  { id: "modEnv",      nombre: "MOD. ENV.",      min: 0,     max: 1,     curva: "lin",  defecto: 0.35, modulable: true,  unidad: "",   clave: "MOD_ENV" },
  { id: "seguimiento", nombre: "SEGUIMIENTO",    min: 0,     max: 1,     curva: "lin",  defecto: 0.5,  modulable: false, unidad: "",   clave: "SEGUIMIENTO" },
  { id: "ataque",      nombre: "ATAQUE",         min: 0.002, max: 4,     curva: "exp",  defecto: 0.01, modulable: false, unidad: "s",  clave: "ATAQUE" },
  { id: "decay",       nombre: "DECAY",          min: 0.02,  max: 4,     curva: "exp",  defecto: 0.3,  modulable: false, unidad: "s",  clave: "DECAY" },
  { id: "sostenido",   nombre: "SOSTENIDO",      min: 0,     max: 1,     curva: "lin",  defecto: 0.7,  modulable: false, unidad: "",   clave: "SOSTENIDO" },
  { id: "release",     nombre: "RELEASE",        min: 0.01,  max: 6,     curva: "exp",  defecto: 0.4,  modulable: false, unidad: "s",  clave: "RELEASE" },
  { id: "fAtaque",     nombre: "ATAQUE FILTRO",  min: 0.002, max: 4,     curva: "exp",  defecto: 0.01, modulable: false, unidad: "s",  clave: "F_ATAQUE" },
  { id: "fDecay",      nombre: "DECAY FILTRO",   min: 0.02,  max: 4,     curva: "exp",  defecto: 0.4,  modulable: false, unidad: "s",  clave: "F_DECAY" },
  { id: "fSostenido",  nombre: "SOSTENIDO FILTRO", min: 0,   max: 1,     curva: "lin",  defecto: 0.3,  modulable: false, unidad: "",   clave: "F_SOSTENIDO" },
  { id: "fRelease",    nombre: "RELEASE FILTRO", min: 0.01,  max: 6,     curva: "exp",  defecto: 0.4,  modulable: false, unidad: "s",  clave: "F_RELEASE" },
  { id: "lfoVel",      nombre: "LFO VELOCIDAD",  min: 0.1,   max: 20,    curva: "exp",  defecto: 5,    modulable: false, unidad: "Hz", clave: "LFO_VELOCIDAD" },
  { id: "lfoProf",     nombre: "LFO PROFUNDIDAD", min: 0,    max: 1,     curva: "lin",  defecto: 0,    modulable: true,  unidad: "",   clave: "LFO_PROFUNDIDAD" },
  { id: "lfoDestino",  nombre: "LFO DESTINO",    min: 0,     max: 2,     curva: "paso", defecto: 0,    modulable: false, unidad: "",   clave: "LFO_DESTINO" },
  { id: "ecoTiempo",   nombre: "ECO TIEMPO",     min: 0,     max: 2,     curva: "paso", defecto: 1,    modulable: false, unidad: "",   clave: "ECO_TIEMPO" },
  { id: "ecoRealim",   nombre: "ECO REALIM.",    min: 0,     max: 0.85,  curva: "lin",  defecto: 0.35, modulable: false, unidad: "",   clave: "ECO_REALIM" },
  { id: "ecoMezcla",   nombre: "ECO MEZCLA",     min: 0,     max: 1,     curva: "lin",  defecto: 0,    modulable: true,  unidad: "",   clave: "ECO_MEZCLA" },
  { id: "espacio",     nombre: "ESPACIO",        min: 0,     max: 1,     curva: "lin",  defecto: 0,    modulable: true,  unidad: "",   clave: "ESPACIO" },   // Z102: reverberación
  { id: "volumen",     nombre: "VOLUMEN",        min: 0,     max: 1,     curva: "lin",  defecto: 0.7,  modulable: true,  unidad: "",   clave: "VOLUMEN" },
];
export const N_PARAMS = PARAMS_SINTE.length;
export function indiceParam(id: string): number { for (let i = 0; i < N_PARAMS; i++) if (PARAMS_SINTE[i].id === id) return i; return -1; }
/** Índices fijos (los usa el motor en su bucle sin buscar por nombre). */
export const P = {
  onda1: indiceParam("onda1"), onda2: indiceParam("onda2"), desafine: indiceParam("desafine"), mezcla: indiceParam("mezcla"),
  sub: indiceParam("sub"), subOnda: indiceParam("subOnda"), ruido: indiceParam("ruido"), corte: indiceParam("corte"),
  resonancia: indiceParam("resonancia"), modEnv: indiceParam("modEnv"), seguimiento: indiceParam("seguimiento"),
  ataque: indiceParam("ataque"), decay: indiceParam("decay"), sostenido: indiceParam("sostenido"), release: indiceParam("release"),
  fAtaque: indiceParam("fAtaque"), fDecay: indiceParam("fDecay"), fSostenido: indiceParam("fSostenido"), fRelease: indiceParam("fRelease"),
  lfoVel: indiceParam("lfoVel"), lfoProf: indiceParam("lfoProf"), lfoDestino: indiceParam("lfoDestino"),
  ecoTiempo: indiceParam("ecoTiempo"), ecoRealim: indiceParam("ecoRealim"), ecoMezcla: indiceParam("ecoMezcla"), volumen: indiceParam("volumen"),
  espacio: indiceParam("espacio"),   // Z102
} as const;
/** Acota un valor real a su rango (los selectores, a un entero). */
export function acotar(d: DefParamSinte, v: number): number {
  const x = Math.max(d.min, Math.min(d.max, Number.isFinite(v) ? v : d.defecto));
  return d.curva === "paso" ? Math.round(x) : x;
}
/** Real → 0…1 (exponencial: proporción en octavas). */
export function aNormal(d: DefParamSinte, real: number): number {
  const v = acotar(d, real);
  const t = d.curva === "exp" && d.min > 0 ? Math.log(v / d.min) / Math.log(d.max / d.min) : (v - d.min) / (d.max - d.min || 1);
  return Math.max(0, Math.min(1, t));
}
/** 0…1 → real. */
export function deNormal(d: DefParamSinte, t01: number): number {
  const t = Math.max(0, Math.min(1, Number.isFinite(t01) ? t01 : 0));
  const v = d.curva === "exp" && d.min > 0 ? d.min * Math.pow(d.max / d.min, t) : d.min + t * (d.max - d.min);
  return d.curva === "paso" ? Math.round(v) : v;
}
export interface EstadoParams { manual: Float64Array; cara: Float64Array; caraActiva: boolean; version: number }
export function crearParams(): EstadoParams {
  const manual = new Float64Array(N_PARAMS), cara = new Float64Array(N_PARAMS).fill(NaN);
  for (let i = 0; i < N_PARAMS; i++) manual[i] = PARAMS_SINTE[i].defecto;
  return { manual, cara, caraActiva: false, version: 0 };
}
/**
 * Fija un parámetro (la regla de Z99, igual que el bajo). fuente "manual": valor REAL acotado a su rango (perillas, pads
 * y menú). fuente "cara": valor NORMALIZADO 0…1, solo para los modulables y solo con la cara activa; nunca pisa el
 * manual (al apagar la cara, vuelve el manual). Devuelve true si cambió algo.
 */
export function setParam(st: EstadoParams, id: string, valor: number, fuente: FuenteParam): boolean {
  const i = indiceParam(id);
  if (i < 0 || !Number.isFinite(valor)) return false;
  const d = PARAMS_SINTE[i];
  if (fuente === "manual") { st.manual[i] = acotar(d, valor); st.version++; return true; }
  if (!d.modulable || !st.caraActiva) return false;
  st.cara[i] = Math.max(0, Math.min(1, valor)); st.version++;
  return true;
}
/** Valor real que usa el motor (por índice, sin buscar): el de la cara si está activa y tiene valor; si no, el manual. */
export function valorIdx(st: EstadoParams, i: number): number {
  const d = PARAMS_SINTE[i], c = st.cara[i];
  return st.caraActiva && d.modulable && Number.isFinite(c) ? deNormal(d, c) : st.manual[i];
}
export function valorParam(st: EstadoParams, id: string): number { const i = indiceParam(id); return i < 0 ? NaN : valorIdx(st, i); }
export function activarCara(st: EstadoParams, on: boolean): void { st.caraActiva = on; if (!on) st.cara.fill(NaN); st.version++; }
/** Suelta un parámetro de la cara (prioridad manual mientras se arrastra su perilla). */
export function liberarParamCara(st: EstadoParams, id: string): boolean {
  const i = indiceParam(id);
  if (i < 0 || !Number.isFinite(st.cara[i])) return false;
  st.cara[i] = NaN; st.version++;
  return true;
}

// ── sonidos de fábrica (valores originales de este proyecto) ──
// Z102: carácter oscuro, atmosférico y electrónico (dark wave, industrial, rock electrónico alternativo de los 80 y 90).
// Inspirados solo en el carácter general de un estilo; ningún valor sale de un instrumento o un sonido existente.
/** Cada sonido fija todos los parámetros salvo VOLUMEN (la salida no es parte del sonido). Nombres de hasta 8 letras. */
export const SONIDOS = {
  // sostenido, etéreo y oscuro: dos sierras + sub seno, corte bajo que respira con un LFO muy lento, eco y espacio largos
  DRON:    { onda1: 2, onda2: 2, desafine: 12, mezcla: 0.5, sub: 0.45, subOnda: 1, ruido: 0.02, corte: 950, resonancia: 0.12, modEnv: 0.15, seguimiento: 0.3,
             ataque: 1.1, decay: 2.0, sostenido: 1, release: 4.5, fAtaque: 1.6, fDecay: 2.5, fSostenido: 0.7, fRelease: 4.0,
             lfoVel: 0.12, lfoProf: 0.45, lfoDestino: 1, ecoTiempo: 2, ecoRealim: 0.62, ecoMezcla: 0.35, espacio: 0.55 },
  // ensamble de cuerdas sintético oscuro: sierras muy desafinadas, ataque y release lentos, vibrato apenas
  CUERDAS: { onda1: 2, onda2: 2, desafine: 26, mezcla: 0.5, sub: 0.2, subOnda: 1, ruido: 0.01, corte: 1700, resonancia: 0.1, modEnv: 0.22, seguimiento: 0.5,
             ataque: 0.55, decay: 1.2, sostenido: 0.85, release: 2.0, fAtaque: 0.7, fDecay: 1.4, fSostenido: 0.5, fRelease: 1.8,
             lfoVel: 5.2, lfoProf: 0.08, lfoDestino: 0, ecoTiempo: 1, ecoRealim: 0.35, ecoMezcla: 0.2, espacio: 0.5 },
  // bloque de metales ochentoso: barrido de filtro corto y fuerte, sostenido medio, release corto (acordes cortos)
  METALES: { onda1: 2, onda2: 2, desafine: 10, mezcla: 0.5, sub: 0.3, subOnda: 0, ruido: 0.02, corte: 520, resonancia: 0.25, modEnv: 0.75, seguimiento: 0.5,
             ataque: 0.06, decay: 0.45, sostenido: 0.6, release: 0.22, fAtaque: 0.04, fDecay: 0.35, fSostenido: 0.3, fRelease: 0.2,
             lfoVel: 5, lfoProf: 0.04, lfoDestino: 0, ecoTiempo: 1, ecoRealim: 0.2, ecoMezcla: 0.12, espacio: 0.25 },
  // secuencia oscura de synth pop: cuadrada + sierra, golpe corto, filtro que cae rápido, eco 1/8 (para el arpegiador)
  PULSO:   { onda1: 3, onda2: 2, desafine: 5, mezcla: 0.45, sub: 0.25, subOnda: 0, ruido: 0, corte: 600, resonancia: 0.4, modEnv: 0.65, seguimiento: 0.6,
             ataque: 0.002, decay: 0.18, sostenido: 0.12, release: 0.12, fAtaque: 0.002, fDecay: 0.12, fSostenido: 0.05, fRelease: 0.1,
             lfoVel: 1, lfoProf: 0, lfoDestino: 1, ecoTiempo: 0, ecoRealim: 0.45, ecoMezcla: 0.25, espacio: 0.05 },
  // textura industrial metálica: cuadrada y sierra muy desafinadas, mucho ruido, resonancia alta, golpe seco
  ACERO:   { onda1: 3, onda2: 2, desafine: 45, mezcla: 0.5, sub: 0, subOnda: 0, ruido: 0.4, corte: 2200, resonancia: 0.7, modEnv: 0.5, seguimiento: 0.7,
             ataque: 0.002, decay: 0.2, sostenido: 0.1, release: 0.15, fAtaque: 0.002, fDecay: 0.14, fSostenido: 0.1, fRelease: 0.12,
             lfoVel: 7, lfoProf: 0.1, lfoDestino: 1, ecoTiempo: 0, ecoRealim: 0.6, ecoMezcla: 0.3, espacio: 0 },
  // lead de rock electrónico alternativo: sierra + cuadrada, ataque rápido, sostenido alto, vibrato con LFO PROF.
  LEAD:    { onda1: 2, onda2: 3, desafine: 7, mezcla: 0.4, sub: 0.25, subOnda: 0, ruido: 0, corte: 2300, resonancia: 0.45, modEnv: 0.35, seguimiento: 0.6,
             ataque: 0.01, decay: 0.3, sostenido: 0.85, release: 0.25, fAtaque: 0.01, fDecay: 0.35, fSostenido: 0.5, fRelease: 0.25,
             lfoVel: 5.6, lfoProf: 0.2, lfoDestino: 0, ecoTiempo: 0, ecoRealim: 0.25, ecoMezcla: 0.15, espacio: 0.15 },
} as const;
export type NombreSonido = keyof typeof SONIDOS;
export const NOMBRES_SONIDO = Object.keys(SONIDOS) as NombreSonido[];
/** Nombre para mostrar (Z102: los nombres ya van tal cual; vacío = LIBRE). */
export const nombreSonido = (s: string): string => s || "LIBRE";
/** Carga un sonido en los valores manuales (VOLUMEN queda como está). */
export function cargarSonido(st: EstadoParams, nombre: NombreSonido): void {
  const s = SONIDOS[nombre] as Record<string, number>;
  for (let i = 0; i < N_PARAMS; i++) {
    const d = PARAMS_SINTE[i];
    if (d.id === "volumen") continue;
    st.manual[i] = acotar(d, s[d.id] ?? d.defecto);
  }
  st.version++;
}
/** ¿Los valores manuales difieren del sonido? (el display muestra "EDITADO"). VOLUMEN no cuenta. Sin allocations. */
export function sonidoEditado(st: EstadoParams, nombre: string): boolean {
  const s = (SONIDOS as Record<string, Record<string, number>>)[nombre];
  if (!s) return false;
  for (let i = 0; i < N_PARAMS; i++) {
    const d = PARAMS_SINTE[i];
    if (d.id === "volumen") continue;
    const ref = acotar(d, s[d.id] ?? d.defecto), v = st.manual[i];
    if (Math.abs(v - ref) > 1e-6 * Math.max(1, Math.abs(ref))) return true;
  }
  return false;
}

// ── voces (asignación con robo) ──
export const V_LIBRE = 0, V_SONANDO = 1, V_LIBERANDO = 2;
export interface Voces {
  n: number;
  nota: Int16Array;      // nota MIDI de cada voz (−1 = ninguna)
  estado: Uint8Array;    // V_LIBRE · V_SONANDO (tecla abajo) · V_LIBERANDO (release en curso)
  tOn: Float64Array;     // inicio de la nota (s de audio)
  tOff: Float64Array;    // inicio del release
  tFin: Float64Array;    // fin del release (desde ahí la voz está libre)
  robada: boolean;       // la última asignación robó una voz que sonaba (el motor hace una rampa corta antes)
  robos: number;
}
export function crearVoces(n: number): Voces {
  const k = Math.max(1, Math.min(32, Math.floor(Number.isFinite(n) ? n : 6)));
  return { n: k, nota: new Int16Array(k).fill(-1), estado: new Uint8Array(k), tOn: new Float64Array(k), tOff: new Float64Array(k).fill(-Infinity), tFin: new Float64Array(k).fill(-Infinity), robada: false, robos: 0 };
}
/**
 * Voz para una nota nueva en t. Orden: (1) la voz que ya toca esa nota (se re-dispara: nunca dos voces con la misma tecla
 * abajo); (2) una libre (o con el release terminado), la que lleva más tiempo libre; (3) la que está en liberación desde
 * hace más tiempo; (4) robo: la que suena desde hace más tiempo. Siempre devuelve un índice 0…n−1 (las voces son fijas:
 * el motor nunca crea nodos por nota).
 */
export function asignarVoz(v: Voces, nota: number, t: number): number {
  v.robada = false;
  for (let i = 0; i < v.n; i++) if (v.estado[i] === V_SONANDO && v.nota[i] === nota) return ocupar(v, i, nota, t);
  let mejor = -1, clave = Infinity;
  for (let i = 0; i < v.n; i++) {
    const libre = v.estado[i] === V_LIBRE || (v.estado[i] === V_LIBERANDO && v.tFin[i] <= t);
    if (libre && v.tFin[i] < clave) { clave = v.tFin[i]; mejor = i; }
  }
  if (mejor < 0) for (let i = 0; i < v.n; i++) if (v.estado[i] === V_LIBERANDO && v.tOff[i] < clave) { clave = v.tOff[i]; mejor = i; }
  if (mejor < 0) { for (let i = 0; i < v.n; i++) if (v.tOn[i] < clave) { clave = v.tOn[i]; mejor = i; } v.robada = true; v.robos++; }
  return ocupar(v, mejor, nota, t);
}
function ocupar(v: Voces, i: number, nota: number, t: number): number {
  v.nota[i] = nota; v.estado[i] = V_SONANDO; v.tOn[i] = t; v.tOff[i] = Infinity; v.tFin[i] = Infinity;
  return i;
}
/** Suelta la voz que toca `nota` (tecla arriba) en t; el release dura releaseS. Devuelve su índice o −1. */
export function liberarNota(v: Voces, nota: number, t: number, releaseS: number): number {
  for (let i = 0; i < v.n; i++) {
    if (v.estado[i] !== V_SONANDO || v.nota[i] !== nota) continue;
    v.estado[i] = V_LIBERANDO; v.tOff[i] = t; v.tFin[i] = t + Math.max(0, Number.isFinite(releaseS) ? releaseS : 0);
    return i;
  }
  return -1;
}
/** Voces sonando o en liberación en t. */
export function vocesActivas(v: Voces, t: number): number {
  let c = 0;
  for (let i = 0; i < v.n; i++) if (v.estado[i] === V_SONANDO || (v.estado[i] === V_LIBERANDO && v.tFin[i] > t)) c++;
  return c;
}
export function reiniciarVoces(v: Voces): void { v.nota.fill(-1); v.estado.fill(V_LIBRE); v.tOn.fill(0); v.tOff.fill(-Infinity); v.tFin.fill(-Infinity); v.robada = false; }

// ── notas mantenidas (teclas abajo: forman el acorde del arpegiador) ──
export interface Mantenidas { notas: Int16Array; n: number }
export const MAX_MANTENIDAS = 16;
export function crearMantenidas(): Mantenidas { return { notas: new Int16Array(MAX_MANTENIDAS), n: 0 }; }
/** Agrega una nota (false si ya estaba o no hay lugar). */
export function pulsar(m: Mantenidas, nota: number): boolean {
  for (let i = 0; i < m.n; i++) if (m.notas[i] === nota) return false;
  if (m.n >= m.notas.length) return false;
  m.notas[m.n++] = nota;
  return true;
}
/** Quita una nota (false si no estaba). Conserva el orden de las demás. */
export function soltarMantenida(m: Mantenidas, nota: number): boolean {
  for (let i = 0; i < m.n; i++) {
    if (m.notas[i] !== nota) continue;
    for (let j = i; j < m.n - 1; j++) m.notas[j] = m.notas[j + 1];
    m.n--;
    return true;
  }
  return false;
}

// ── arpegiador ──
export interface Arp { pos: number; semilla: number; azar: number; pasos: number }
export function crearArp(semilla: number): Arp { const s = (Math.floor(Number.isFinite(semilla) ? semilla : 1) >>> 0) || 1; return { pos: 0, semilla: s, azar: s, pasos: 0 }; }
/** Vuelve al primer paso (al soltar todas las teclas): el próximo acorde arranca desde su primera nota (y AZAR, desde la semilla). */
export function reiniciarArp(a: Arp): void { a.pos = 0; a.azar = a.semilla; a.pasos = 0; }
/**
 * Secuencia del arpegio en `out`: las notas mantenidas de grave a agudo, repetidas en `octavas` octavas (1…3), en el
 * orden del patrón. ARRIBA: grave → agudo. ABAJO: agudo → grave. IDA Y VUELTA: sube y baja sin repetir los extremos
 * (do mi sol do' sol mi). AZAR: la lista de ARRIBA (la nota la elige siguienteNotaArp). `tmp` = espacio de trabajo.
 * Devuelve el largo. Sin allocations.
 */
export function secuenciaArp(m: Mantenidas, octavas: number, patron: number, out: Int16Array, tmp: Int16Array): number {
  const n = Math.min(m.n, tmp.length);
  for (let i = 0; i < n; i++) {   // orden por inserción (pocas notas)
    const x = m.notas[i]; let j = i - 1;
    while (j >= 0 && tmp[j] > x) { tmp[j + 1] = tmp[j]; j--; }
    tmp[j + 1] = x;
  }
  const oct = Math.max(1, Math.min(3, Math.round(Number.isFinite(octavas) ? octavas : 1)));
  let L = 0;
  for (let o = 0; o < oct; o++) for (let i = 0; i < n && L < out.length; i++) out[L++] = tmp[i] + 12 * o;
  if (patron === ARP_ABAJO) { for (let i = 0, j = L - 1; i < j; i++, j--) { const x = out[i]; out[i] = out[j]; out[j] = x; } }
  else if (patron === ARP_IDA_VUELTA && L > 2) { for (let i = L - 2; i >= 1 && L < out.length; i--) out[L++] = out[i]; }
  return L;
}
/** Generador congruencial (determinista con la semilla): 0 ≤ x < 1. */
export function azarArp(a: Arp): number { a.azar = (Math.imul(a.azar, 1664525) + 1013904223) >>> 0; return a.azar / 4294967296; }
/** Próxima nota del arpegio (−1 si no hay acorde). Avanza la posición. */
export function siguienteNotaArp(a: Arp, patron: number, seq: Int16Array, len: number): number {
  if (len <= 0) return -1;
  const i = patron === ARP_AZAR ? Math.min(len - 1, Math.floor(azarArp(a) * len)) : a.pos % len;
  a.pos++; a.pasos++;
  return seq[i];
}
/**
 * Qué pasos del arpegiador caen dentro del paso `pasoReloj` (0…nReloj−1) del reloj compartido, que empieza en t y dura
 * durReloj. El arpegiador va en semicorcheas alineadas al compás (16 por compás) y toca uno cada `semicorcheas` (1 = 1/16,
 * 2 = 1/8, 4 = 1/4). Las ventanas de pasos consecutivos se tocan sin solaparse: ningún paso se pierde ni se repite, con
 * 8, 12, 16 o 32 pasos de la caja. Escribe el tiempo exacto en outT; devuelve cuántos.
 */
export function pasosArpEnVentana(pasoReloj: number, nReloj: number, t: number, durReloj: number, semicorcheas: number, outT: Float64Array): number {
  const n = Math.max(1, Math.floor(Number.isFinite(nReloj) ? nReloj : 16));
  const dur = Math.max(1e-6, Number.isFinite(durReloj) ? durReloj : 0.125), t0 = Number.isFinite(t) ? t : 0;
  const div = Math.max(1, Math.floor(Number.isFinite(semicorcheas) ? semicorcheas : 1));
  const pr = ((Math.floor(pasoReloj) % n) + n) % n;
  const escala = SEMICORCHEAS_COMPAS / n, d16 = dur / escala;
  const a = pr * escala, b = a + escala;
  let c = 0;
  for (let k = Math.ceil(a - 1e-9); k < b - 1e-9 && c < outT.length; k++) {
    if ((k % SEMICORCHEAS_COMPAS) % div !== 0) continue;
    outT[c++] = t0 + (k - a) * d16;
  }
  return c;
}
/** Duración (s) de un paso del arpegiador con el BPM de la caja. */
export function durPasoArp(bpm: number, semicorcheas: number): number {
  const b = Math.max(20, Math.min(300, Number.isFinite(bpm) ? bpm : 120));
  return (60 / b / 4) * Math.max(1, semicorcheas);
}

// ── eco ──
/** Tiempo del eco (s) desde el BPM: 1/8 = media negra, 1/4 = una negra, 1/4 con puntillo = una negra y media. */
export function tiempoEcoS(bpm: number, idx: number, maxS = 2): number {
  const b = Math.max(20, Math.min(300, Number.isFinite(bpm) ? bpm : 120));
  const k = Math.max(0, Math.min(PULSOS_ECO.length - 1, Math.round(Number.isFinite(idx) ? idx : 1)));
  return Math.min(Math.max(0.01, maxS), (60 / b) * PULSOS_ECO[k]);
}
/** Realimentación acotada: nunca más de 0,85 (ni del tope pedido), así el eco siempre se apaga solo. */
export function realimAcotada(v: number, tope = 0.85): number {
  const t = Math.max(0, Math.min(0.85, Number.isFinite(tope) ? tope : 0.85));
  return Math.max(0, Math.min(t, Number.isFinite(v) ? v : 0));
}

// ── Z102: ESPACIO (reverberación) ──
/**
 * Respuesta al impulso sintética: ruido estéreo (dos canales distintos) que decae de forma exponencial hasta ~−60 dB en
 * durS, con un ataque de 4 ms para que no haga clic. Determinista (semilla). Se genera UNA vez (motor) y se escribe en
 * izq/der (largo = sampleRate × durS).
 */
export function llenarRespuestaImpulso(izq: Float32Array, der: Float32Array, sampleRate: number, durS: number, semilla = 0x5102): void {
  const n = Math.min(izq.length, der.length), sr = Math.max(1, sampleRate), d = Math.max(0.05, Number.isFinite(durS) ? durS : 2.8);
  let x = (semilla >>> 0) || 1;
  const rnd = (): number => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 2147483648 - 1; };
  for (let i = 0; i < n; i++) {
    const t = i / sr, env = Math.exp(-6.9 * t / d) * Math.min(1, t / 0.004);
    izq[i] = rnd() * env; der[i] = rnd() * env;
  }
}

// ── filtro y envolventes (valores que usa el motor y el display) ──
/** RESONANCIA 0…1 → Q del filtro (0,707 = sin pico … resMax). */
export function qDeResonancia(res01: number, resMax: number): number {
  const r = Math.max(0, Math.min(1, Number.isFinite(res01) ? res01 : 0)), m = Math.max(0.8, Number.isFinite(resMax) ? resMax : 14);
  return 0.707 * Math.pow(m / 0.707, r * r);
}
/** Corte con SEGUIMIENTO DE TECLA: con 1, el corte sube una octava por cada octava sobre DO4 (60); con 0, fijo. */
export function corteConTecla(corteHz: number, nota: number, seguimiento01: number, fMin: number, fMax: number): number {
  const s = Math.max(0, Math.min(1, Number.isFinite(seguimiento01) ? seguimiento01 : 0));
  const f = corteHz * Math.pow(2, ((Number.isFinite(nota) ? nota : 60) - 60) / 12 * s);
  return Math.max(fMin, Math.min(fMax, f));
}
/** Corte en el pico de la envolvente del filtro: base × 2^(MOD. ENV. × octavas × nivel), sin pasar fMax. */
export function corteEnvolvente(base: number, modEnv01: number, octavas: number, nivel01: number, fMax: number): number {
  const m = Math.max(0, Math.min(1, Number.isFinite(modEnv01) ? modEnv01 : 0)), n = Math.max(0, Math.min(1, Number.isFinite(nivel01) ? nivel01 : 0));
  return Math.min(Math.max(base, fMax), base * Math.pow(2, Math.max(0, octavas) * m * n));
}
/** Respuesta en magnitud del pasa-bajos del motor (un biquad de 2 polos): 1 / √((1 − x²)² + (x/Q)²), x = f / fc. */
export function magnitudFiltro(fHz: number, fcHz: number, q: number): number {
  const x = Math.max(0, fHz) / Math.max(1e-6, fcHz), qq = Math.max(0.1, q), x2 = x * x;
  return 1 / Math.sqrt((1 - x2) * (1 - x2) + (x / qq) * (x / qq));
}
export const DB_MIN = -36, DB_MAX = 24;
/** Curva del filtro para el display: n puntos de fMin a fMax (log), dB llevados a [0, 1]. Nunca NaN. Escribe en out. */
export function curvaFiltro(fcHz: number, q: number, fMin: number, fMax: number, out: Float32Array, n: number): Float32Array {
  const m = Math.max(2, Math.min(out.length, Math.floor(n)));
  const a = Math.max(1, Number.isFinite(fMin) ? fMin : 20), b = Math.max(a * 1.01, Number.isFinite(fMax) ? fMax : 20000);
  const fc = Number.isFinite(fcHz) ? fcHz : 1000, qq = Number.isFinite(q) ? q : 0.707;
  for (let i = 0; i < m; i++) {
    const f = a * Math.pow(b / a, i / (m - 1));
    const db = 20 * Math.log10(Math.max(1e-9, magnitudFiltro(f, fc, qq)));
    const v = (db - DB_MIN) / (DB_MAX - DB_MIN);
    out[i] = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
  }
  return out;
}
/** Un ciclo de la forma de onda (0 SENO, 1 TRIÁNGULO, 2 SIERRA, 3 CUADRADA) en n puntos de −1 a 1. Escribe en out. */
export function formaOnda(forma: number, out: Float32Array, n: number): Float32Array {
  const m = Math.max(2, Math.min(out.length, Math.floor(n))), f = Math.round(Number.isFinite(forma) ? forma : 0);
  for (let i = 0; i < m; i++) {
    const x = i / (m - 1);
    out[i] = f === 1 ? 1 - 4 * Math.abs(((x + 0.25) % 1) - 0.5) : f === 2 ? 2 * ((x + 0.5) % 1) - 1 : f === 3 ? (x < 0.5 ? 1 : -1) : Math.sin(2 * Math.PI * x);
  }
  return out;
}

// ── teclado de la computadora (piano) ──
/**
 * Piano en dos filas (posición física, KeyboardEvent.code: no depende del idioma del teclado). Blancas en la fila de
 * arriba R T Y U I O P [ ] y negras en la de los números 5 6 8 9 0 =, como en un piano: DO = R. Son 15 notas (DO a RE
 * de la octava siguiente). Libres a propósito: E (entra), Q (sale), X (corta la transmisión), W A S D (moverse),
 * Z C V B N M (atajos de los otros atriles), 1 a 4 (terminal), Shift (menú), espacio y Enter.
 */
export const TECLAS_PIANO: readonly (readonly [string, number])[] = [
  ["KeyR", 0], ["Digit5", 1], ["KeyT", 2], ["Digit6", 3], ["KeyY", 4], ["KeyU", 5], ["Digit8", 6], ["KeyI", 7],
  ["Digit9", 8], ["KeyO", 9], ["Digit0", 10], ["KeyP", 11], ["BracketLeft", 12], ["Equal", 13], ["BracketRight", 14],
];
export const TECLAS_RESERVADAS = [
  "KeyE", "KeyQ", "KeyX", "KeyW", "KeyA", "KeyS", "KeyD", "KeyZ", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM",
  "Digit1", "Digit2", "Digit3", "Digit4", "ShiftLeft", "ShiftRight", "Space", "Enter", "Escape",
] as const;
/** Lo que se lee en la serigrafía y en el display (la letra de cada tecla, en el orden del piano). */
export const AYUDA_PIANO = "R 5 T 6 Y U 8 I 9 O 0 P [ = ]";
/** Semitono (0…14) sobre el DO de la octava, o −1 si la tecla no es del piano. */
export function semitonoDeTecla(code: string): number {
  for (let i = 0; i < TECLAS_PIANO.length; i++) if (TECLAS_PIANO[i][0] === code) return TECLAS_PIANO[i][1];
  return -1;
}
/** Teclas abajo (para que la autorepetición del sistema no repita notas y para soltar todo al salir). */
export interface TecladoPc { abajo: Uint8Array }
export function crearTecladoPc(): TecladoPc { return { abajo: new Uint8Array(TECLAS_PIANO.length) }; }
/** keydown: semitono si es una pulsación NUEVA (ni autorepetición ni tecla ya abajo); si no, −1. */
export function teclaAbajo(k: TecladoPc, code: string, repeticion: boolean): number {
  const s = semitonoDeTecla(code);
  if (s < 0 || repeticion || k.abajo[s]) return -1;
  k.abajo[s] = 1;
  return s;
}
/** keyup: semitono si esa tecla estaba abajo; si no, −1. */
export function teclaArriba(k: TecladoPc, code: string): number {
  const s = semitonoDeTecla(code);
  if (s < 0 || !k.abajo[s]) return -1;
  k.abajo[s] = 0;
  return s;
}

// ── Web MIDI ──
/** Mensaje MIDI → nota (≥ 0) con on (true) u off; −1 si no es una nota. Note-on con velocidad 0 = note-off. */
export function leerMidi(d0: number, d1: number, d2: number, out: { nota: number; on: boolean }): number {
  const tipo = d0 & 0xf0;
  if (tipo !== 0x90 && tipo !== 0x80) return -1;
  out.nota = d1 & 0x7f; out.on = tipo === 0x90 && (d2 & 0x7f) > 0;
  return out.nota;
}

// ── radios del atril (uno encendido por grupo) ──
export function radioSinte(n: number, elegida: number, out: number[]): number[] {
  for (let i = 0; i < n; i++) out[i] = i === elegida ? 1 : 0;
  return out;
}

// ── display ──
/** Línea 1: "PAD · EDITADO · ARP ARRIBA · 124 BPM" (se arma solo cuando cambia algo, no por cuadro). */
export function lineaSinte1(sonido: string, editado: boolean, arpOn: boolean, patronArp: number, bpm: number): string {
  const arp = arpOn ? PATRONES_ARP_CORTOS[Math.max(0, Math.min(3, Math.round(patronArp)))] : "OFF";
  return `${nombreSonido(sonido)}${editado ? " · EDITADO" : ""} · ARP ${arp} · ${Math.round(Number.isFinite(bpm) ? bpm : 0)} BPM`;
}
/** Línea 2 en reposo: la octava y las teclas del piano (o que el arpegiador espera el play de la caja). */
export function lineaSinte2Reposo(oct: number, arpEsperando: boolean): string {
  return arpEsperando ? `OCT ${oct} · ARP: TOCÁ PLAY EN LA CAJA` : `OCT ${oct} · PIANO: ${AYUDA_PIANO}`;
}
