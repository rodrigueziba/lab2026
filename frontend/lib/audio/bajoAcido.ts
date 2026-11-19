// Z99: motor del BAJO ÁCIDO (atril BA-40). Lógica pura en lib/bajoAcido.ts.
//
// Voz monofónica UNA sola, armada una vez y reutilizada (nada de nodos por nota):
//   oscilador (sierra / cuadrada, detune = AFINACIÓN)
//   → filtro 1 (biquad pasa-bajos, Q 0,707) → filtro 2 (biquad pasa-bajos, Q = RESONANCIA)   [4 polos en total]
//   → VCA (envolvente de amplitud)
//   → seco + (excitador → waveshaper con curva precalculada una vez) mojado = DISTORSIÓN
//   → VOLUMEN → ON del módulo → bus maestro del núcleo (entradaBus): lo escucha la sala, lo analiza el visualizador
//     y viaja por obtenerSalidaTransmisible() a SILLAS sin tocar el camino de la transmisión.
//   VU: un analizador en derivación después del ON.
// Por qué dos biquads y no un AudioWorklet: el núcleo no usa worklets; los BiquadFilterNode son nativos, estables en todos
// los navegadores y se automatizan con AudioParam. La primera etapa sin resonancia y la segunda resonante dan la pendiente
// de 24 dB/oct con un solo pico (dos etapas resonantes multiplicarían el pico y podrían saturar).
//
// Secuenciador: oyente del reloj del núcleo (técnica de anticipación de Z78: los pasos llegan con su tiempo exacto de
// AudioContext antes de sonar). En cada paso del reloj se programan los pasos del bajo que caen en esa ventana
// (pasosEnVentana): sincronía con la caja de ritmos con 8, 12, 16 o 32 pasos. Con TEMPO_HEREDADO false usa un reloj
// propio (mismo módulo reloj.ts) con LOOKAHEAD_S e INTERVALO_S. Sin allocations en el oyente (arreglos preasignados).
// Transporte: suena solo si la caja de ritmos suena (RITMOS.sonando). Sin autoplay. ON apagado = silencio sin parar.
// Envolventes: setTargetAtTime desde el valor actual tras cancelarYMantener (cancelAndHoldAtTime o, si el navegador no lo
// tiene, cancelScheduledValues): sin clics. Las notas se sueltan con una rampa corta (tau 6 ms).
import { DBG_BAJO, DBG_RITMOS } from "@/lib/debugConfig";
import { contextoNucleo, entradaBus, suscribirPasos, RELOJ } from "@/lib/audio/nucleo";
import { crearReloj, iniciar, detener, programar, suscribir, setBpm, type Reloj } from "@/lib/audio/reloj";
import { RITMOS } from "@/lib/ritmosMotor";
import {
  N_PASOS, crearPatronBajo, cargarFabrica, limpiarPatron, copiarPatron, patronesIguales, eventoPaso, pasosEnVentana, pasoSonando,
  midiAFrecuencia, nivelNota, aperturaNota, corteConEnvolvente, qDeResonancia, crearParams, setParam, valorParam, restaurarParams,
  PARAMS_BAJO, EV_SILENCIO, EV_LIGADA, NOMBRES_PATRON, type NombrePatron, type EventoPaso, type FuenteParam,
} from "@/lib/bajoAcido";

/** Estado leído por el atril, el display y el menú. version sube con cada cambio del patrón o de un parámetro. */
export const BAJO = {
  version: 0, patron: "" as string, editado: false, sonando: false, pasoSonando: -1, ultimaNota: -1,
  notas: 0, vozLista: false,
};
export const PATRON_BAJO = crearPatronBajo();
const _fabrica = crearPatronBajo();
export const PARAMS = crearParams();

/** Valores por defecto: los de DBG_BAJO (ids de PARAMS_BAJO → claves de DBG_BAJO). */
const CLAVE_DBG: Record<string, keyof typeof DBG_BAJO> = {
  afinacion: "AFINACION", corte: "CORTE", resonancia: "RESONANCIA", modEnv: "MOD_ENV", decay: "DECAY",
  acento: "ACENTO", desliz: "DESLIZ", distorsion: "DISTORSION", volumen: "VOLUMEN",
};
function defectosDesdeDbg(): void {
  restaurarParams(PARAMS);
  for (const d of PARAMS_BAJO) { const v = DBG_BAJO[CLAVE_DBG[d.id]]; if (typeof v === "number") setParam(PARAMS, d.id, v, "manual"); }
}
defectosDesdeDbg();
cargarPatron((NOMBRES_PATRON as string[]).includes(DBG_BAJO.PATRON_INICIAL) ? DBG_BAJO.PATRON_INICIAL as NombrePatron : "CHICAGO");

interface Voz {
  ctx: BaseAudioContext; osc: OscillatorNode; f1: BiquadFilterNode; f2: BiquadFilterNode; vca: GainNode;
  seco: GainNode; exc: GainNode; shaper: WaveShaperNode; mojado: GainNode; vol: GainNode; on: GainNode; analizador: AnalyserNode;
  sostenida: boolean; ultimaFrecuencia: number;
}
let _voz: Voz | null = null;
let _desuscribir: (() => void) | null = null;
let _relojPropio: Reloj | null = null;
let _motorPropio: ReturnType<typeof setInterval> | null = null;
const _k = new Int32Array(8), _t = new Float64Array(8), _tiempos = new Float64Array(N_PASOS).fill(-1e9), _ev: EventoPaso = { tipo: 0, nota: 0, acento: false, mantener: false };

/** Curva de saturación suave (tanh), calculada UNA vez. */
function curvaSaturacion(n = 2048): Float32Array<ArrayBuffer> {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(2.2 * x) / Math.tanh(2.2); }
  return c;
}
function crearVoz(ctx: BaseAudioContext): Voz {
  const osc = ctx.createOscillator(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), vca = ctx.createGain();
  const seco = ctx.createGain(), exc = ctx.createGain(), shaper = ctx.createWaveShaper(), mojado = ctx.createGain();
  const vol = ctx.createGain(), on = ctx.createGain(), analizador = ctx.createAnalyser();
  f1.type = "lowpass"; f2.type = "lowpass"; f1.Q.value = 0.707;
  shaper.curve = curvaSaturacion(); shaper.oversample = "2x";
  vca.gain.value = 0; analizador.fftSize = 1024;
  osc.connect(f1); f1.connect(f2); f2.connect(vca);
  vca.connect(seco); vca.connect(exc); exc.connect(shaper); shaper.connect(mojado);
  seco.connect(vol); mojado.connect(vol); vol.connect(on); on.connect(entradaBus()); on.connect(analizador);
  osc.start();
  const v: Voz = { ctx, osc, f1, f2, vca, seco, exc, shaper, mojado, vol, on, analizador, sostenida: false, ultimaFrecuencia: 0 };
  aplicarParams(v, ctx.currentTime);
  return v;
}
function cancelarYMantener(p: AudioParam, t: number): void {
  const q = p as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam };
  if (typeof q.cancelAndHoldAtTime === "function") q.cancelAndHoldAtTime(t); else p.cancelScheduledValues(t);
}
function corteBase(): number {
  return Math.max(DBG_BAJO.FILTRO_FRECUENCIA_MIN, Math.min(DBG_BAJO.FILTRO_FRECUENCIA_MAX, valorParam(PARAMS, "corte")));
}
/** Aplica los parámetros continuos (con suavizado corto): el barrido de CORTE y RESONANCIA se oye mientras suena. */
function aplicarParams(v: Voz, ahora: number): void {
  const d = valorParam(PARAMS, "distorsion");
  v.osc.type = DBG_BAJO.ONDA === "cuadrada" ? "square" : "sawtooth";
  v.osc.detune.setTargetAtTime(valorParam(PARAMS, "afinacion") * 100, ahora, 0.02);
  cancelarYMantener(v.f1.frequency, ahora); cancelarYMantener(v.f2.frequency, ahora);
  v.f1.frequency.setTargetAtTime(corteBase(), ahora, 0.02); v.f2.frequency.setTargetAtTime(corteBase(), ahora, 0.02);
  v.f2.Q.setTargetAtTime(qDeResonancia(valorParam(PARAMS, "resonancia"), DBG_BAJO.RES_MAX), ahora, 0.02);
  v.seco.gain.setTargetAtTime(1 - 0.6 * d, ahora, 0.02);
  v.mojado.gain.setTargetAtTime(0.9 * d, ahora, 0.02);
  v.exc.gain.setTargetAtTime(1 + 7 * d, ahora, 0.02);
  v.vol.gain.setTargetAtTime(Math.max(0, valorParam(PARAMS, "volumen")), ahora, 0.02);
  v.on.gain.setTargetAtTime(DBG_BAJO.ON ? 1 : 0, ahora, 0.01);
}

// ── notas (todas con tiempos de audio exactos) ──
function nota(v: Voz, ev: EventoPaso, t: number, durPaso: number): void {
  const midi = DBG_BAJO.RAIZ_MIDI + ev.nota, f = midiAFrecuencia(midi);
  const acento01 = valorParam(PARAMS, "acento");
  if (ev.tipo === EV_LIGADA && v.sostenida) {
    // DESLIZ: la altura se desliza desde la nota anterior; la envolvente NO se reinicia
    cancelarYMantener(v.osc.frequency, t);
    v.osc.frequency.setTargetAtTime(f, t, Math.max(0.005, valorParam(PARAMS, "desliz") / 3));
  } else {
    cancelarYMantener(v.osc.frequency, t); v.osc.frequency.setValueAtTime(f, t);
    const fc = corteBase(), ap = aperturaNota(valorParam(PARAMS, "modEnv"), ev.acento, acento01);
    const pico = corteConEnvolvente(fc, ap, DBG_BAJO.ENV_OCTAVAS, Math.max(fc, DBG_BAJO.FILTRO_FRECUENCIA_MAX * 2));
    const dec = Math.max(0.02, valorParam(PARAMS, "decay")) * (ev.acento ? 0.7 : 1);   // el acento cae más rápido (más "punch")
    envFiltro(v.f1.frequency, t, pico, fc, dec); envFiltro(v.f2.frequency, t, pico, fc, dec);
    const nivel = nivelNota(ev.acento, acento01);
    cancelarYMantener(v.vca.gain, t);
    v.vca.gain.setTargetAtTime(nivel, t, 0.0015);
    v.vca.gain.setTargetAtTime(nivel * 0.55, t + 0.006, Math.max(0.03, dec * 0.9));
  }
  v.ultimaFrecuencia = f;
  v.sostenida = true;
  BAJO.ultimaNota = midi; BAJO.notas++;
  if (!ev.mantener) {   // sin DESLIZ: se suelta antes del paso siguiente
    const tOff = t + durPaso * Math.max(0.1, Math.min(0.95, DBG_BAJO.GATE));
    v.vca.gain.setTargetAtTime(0, tOff, 0.006);
    v.sostenida = false;
  }
}
/** Envolvente del filtro: sube al pico (2 ms) y cae al corte con DECAY. */
function envFiltro(p: AudioParam, t: number, pico: number, fc: number, dec: number): void {
  cancelarYMantener(p, t); p.setTargetAtTime(pico, t, 0.002); p.setTargetAtTime(fc, t + 0.004, dec / 3);
}
function soltar(v: Voz, t: number): void {
  cancelarYMantener(v.vca.gain, t);
  v.vca.gain.setTargetAtTime(0, t, 0.006);
  v.sostenida = false;
}

// ── oyente del reloj (sin allocations) ──
function alPasoReloj(pasoReloj: number, t: number, _compas: number, durS: number, nReloj: number): void {
  if (!DBG_BAJO.ACTIVO || !RITMOS.sonando) return;
  const v = voz();
  if (!v) return;
  const c = pasosEnVentana(pasoReloj, nReloj, t, durS, _k, _t);
  const d16 = durS * nReloj / N_PASOS;
  for (let i = 0; i < c; i++) {
    const k = _k[i], tk = _t[i];
    _tiempos[k] = tk;
    if (!DBG_BAJO.ON) continue;
    eventoPaso(PATRON_BAJO, k, _ev);
    if (_ev.tipo === EV_SILENCIO) { if (v.sostenida) soltar(v, tk); continue; }
    nota(v, _ev, tk, d16);
  }
}
const oyenteNucleo = (paso: number, t: number, compas: number, durS: number): void => {
  if (!DBG_BAJO.TEMPO_HEREDADO) return;
  alPasoReloj(paso, t, compas, durS, RELOJ.pasosPorCompas);
};
const oyentePropio = (paso: number, t: number, compas: number, durS: number): void => {
  if (DBG_BAJO.TEMPO_HEREDADO) return;
  alPasoReloj(paso, t, compas, durS, N_PASOS);
};

function voz(): Voz | null {
  const ctx = contextoNucleo();
  if (!ctx) return null;
  if (!_voz || _voz.ctx !== ctx) { liberarVoz(); _voz = crearVoz(ctx); BAJO.vozLista = true; }
  return _voz;
}
function liberarVoz(): void {
  const v = _voz;
  if (!v) return;
  try { v.osc.stop(); } catch { /* ya parado */ }
  for (const n of [v.osc, v.f1, v.f2, v.vca, v.seco, v.exc, v.shaper, v.mojado, v.vol, v.on, v.analizador]) { try { n.disconnect(); } catch { /* ok */ } }
  _voz = null; BAJO.vozLista = false;
}

/** Instala el bajo (lo monta el atril): se suscribe al reloj del núcleo. Devuelve la limpieza. */
export function instalarBajo(): () => void {
  if (!DBG_BAJO.ACTIVO) return () => {};
  if (!_desuscribir) _desuscribir = suscribirPasos(oyenteNucleo);
  return liberarBajo;
}
/** Al desmontar: timers, suscripciones, nodos y voz. */
export function liberarBajo(): void {
  _desuscribir?.(); _desuscribir = null;
  pararRelojPropio();
  liberarVoz();
  _tiempos.fill(-1e9); BAJO.pasoSonando = -1; BAJO.sonando = false;
}

function pararRelojPropio(): void {
  if (_motorPropio) { clearInterval(_motorPropio); _motorPropio = null; }
  if (_relojPropio) { detener(_relojPropio); _relojPropio.oyentes.length = 0; _relojPropio = null; }
}
/**
 * Un cuadro (lo llama el atril en su useFrame; sin allocations): sigue el transporte de la caja (si para, suelta la nota),
 * maneja el reloj propio cuando TEMPO_HEREDADO es false y calcula el paso que está sonando para las luces y el display.
 */
export function tickBajo(): void {
  const ctx = contextoNucleo();
  const suena = DBG_BAJO.ACTIVO && RITMOS.sonando;
  if (!suena && BAJO.sonando) { if (_voz && ctx) soltar(_voz, ctx.currentTime); _tiempos.fill(-1e9); BAJO.pasoSonando = -1; }
  BAJO.sonando = suena;
  if (!DBG_BAJO.TEMPO_HEREDADO && suena && ctx) {
    if (!_relojPropio) {
      _relojPropio = crearReloj(DBG_BAJO.BPM, N_PASOS, 4);
      suscribir(_relojPropio, oyentePropio);
      iniciar(_relojPropio, ctx.currentTime, 0.05);
      const r = _relojPropio;
      _motorPropio = setInterval(() => { setBpm(r, DBG_BAJO.BPM); programar(r, ctx.currentTime, DBG_BAJO.LOOKAHEAD_S); }, Math.max(5, DBG_BAJO.INTERVALO_S * 1000));
    }
  } else if (_relojPropio) pararRelojPropio();
  BAJO.pasoSonando = suena && ctx ? pasoSonando(_tiempos, ctx.currentTime, 1) : -1;
}

// ── edición y parámetros (atril, menú; Z100: la cara) ──
export function cargarPatron(nombre: NombrePatron): void {
  cargarFabrica(nombre, PATRON_BAJO); cargarFabrica(nombre, _fabrica);
  BAJO.patron = nombre; BAJO.editado = false; BAJO.version++;
}
export function patronLimpio(): void {
  limpiarPatron(PATRON_BAJO); limpiarPatron(_fabrica);
  BAJO.patron = "LIMPIO"; BAJO.editado = false; BAJO.version++;
}
/** Edición de un paso (el display pasa a "EDITADO" si difiere del patrón cargado). */
export function editarPaso(campo: "activo" | "nota" | "acento" | "desliz", k: number, valor: number): void {
  const i = Math.max(0, Math.min(N_PASOS - 1, Math.floor(k)));
  PATRON_BAJO[campo][i] = campo === "nota" ? Math.max(0, Math.min(24, Math.round(valor))) : valor > 0.5 ? 1 : 0;
  BAJO.editado = !patronesIguales(PATRON_BAJO, _fabrica);
  BAJO.version++;
}
/** setParam con fuente ("manual" desde el atril y el menú; "cara" en Z100). Aplica al instante si la voz existe. */
export function setParamBajo(id: string, valor: number, fuente: FuenteParam = "manual"): boolean {
  const ok = setParam(PARAMS, id, valor, fuente);
  if (ok) { BAJO.version++; const ctx = contextoNucleo(); if (_voz && ctx) aplicarParams(_voz, ctx.currentTime); }
  return ok;
}
export function aplicarParamsBajo(): void { const ctx = contextoNucleo(); if (_voz && ctx) aplicarParams(_voz, ctx.currentTime); BAJO.version++; }
/** Analizador del VU del atril (null hasta que suene la primera vez). */
export function analizadorBajo(): AnalyserNode | null { return _voz?.analizador ?? null; }
/** Menú: silencia y reinicia (parámetros por defecto, patrón inicial, voz nueva al próximo paso). */
export function silenciarYReiniciarBajo(): void {
  const ctx = contextoNucleo();
  if (_voz && ctx) soltar(_voz, ctx.currentTime);
  liberarVoz();
  defectosDesdeDbg();
  cargarPatron((NOMBRES_PATRON as string[]).includes(DBG_BAJO.PATRON_INICIAL) ? DBG_BAJO.PATRON_INICIAL as NombrePatron : "CHICAGO");
  _tiempos.fill(-1e9);
}
/** Copia la memoria editable (pruebas y menú). */
export function copiarPatronBajo(a: typeof PATRON_BAJO): void { copiarPatron(PATRON_BAJO, a); }
export function bpmBajo(): number { return DBG_BAJO.TEMPO_HEREDADO ? DBG_RITMOS.BPM : DBG_BAJO.BPM; }
