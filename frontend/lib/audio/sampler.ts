// Z103: motor del SAMPLER SM-40. Lógica pura en lib/sampler.ts.
//
//   fuente (AudioBufferSourceNode, una por disparo) ─► ranura (ganancia preasignada) ─► VOLUMEN DEL PAD (8, preasignadas)
//     ─► FILTRO de salida (biquad pasa-bajos suave: CORTE, RESONANCIA baja) ─► VOLUMEN ─► ON ─► bus maestro (entradaBus)
//                                                                                              └─► VU (analizador)
// Fuentes: el navegador define AudioBufferSourceNode como de UN solo uso (no se puede reiniciar), así que se crea una por
// disparo. Lo demás (ranuras, volúmenes, filtro, salida) se crea UNA vez con el grafo. Nunca hay más de
// SAMPLER_MAX_SIMULTANEAS fuentes vivas: la nueva roba la más antigua con una caída de ROBO_S (~8 ms) para que no haga clic.
// Sonidos de fábrica: generados por cálculo (lib/sampler.ts) al nacer el grafo, en memoria; sin archivos ni red.
// Cuantización: con QUANT ≠ OFF y la caja sonando, el disparo va al próximo punto de la grilla del reloj del núcleo
// (proximaGrilla). Si ese punto ya está dentro de lo que el reloj programó, se agenda al instante con su tiempo exacto; si
// no, queda pendiente y lo agenda el oyente del reloj cuando su ventana lo alcanza (anticipación de Z78, sin allocations).
//
// GRABAR (MediaRecorder; el núcleo no usa AudioWorklet): MIC pide el micrófono solo al apretar GRABAR con MIC, sin
// cancelación de eco, supresión de ruido ni control de ganancia, y cierra sus pistas al terminar o al desmontar. MEZCLA
// cuelga un MediaStreamAudioDestinationNode del analizador maestro del núcleo (en derivación: no cambia lo que suena) solo
// mientras graba. Al terminar, decodeAudioData → AudioBuffer en el pad. Un solo grabador a la vez; corte en SAMPLER_MAX_S.
// PRIVACIDAD: todo queda SOLO en memoria. No hay fetch, WebSocket ni almacenamiento: nada se sube ni se guarda. Al salir
// de la tarima o recargar, los pads vuelven a los sonidos de fábrica. Lo grabado del micrófono suena por el bus maestro
// como todo lo demás, así que llega a SILLAS ÚNICAMENTE si el usuario está compartiendo su sesión (el display lo avisa la
// primera vez que se graba con MIC).
import { DBG_SAMPLER, DBG_RITMOS } from "@/lib/debugConfig";
import { contextoNucleo, obtenerContexto, reanudarContexto, entradaBus, analizadorMaestro, suscribirPasos, RELOJ } from "@/lib/audio/nucleo";
import { duracionPasoS } from "@/lib/audio/reloj";
import { RITMOS } from "@/lib/ritmosMotor";
import { INTERACT_STATE } from "@/lib/alightStore";   // Z106: el pointer lock se recupera solo fuera del modo atril
import { crearEstadoMuestreo, crearGrabacion, textoMuestreo, codigoDeError, elegirMime, gananciaNormalizar, MENSAJES_MUESTREO, type GrabadorLike } from "@/lib/muestreoGrabacion";   // Z106
import {
  N_PADS, N_PARAMS, PARAMS_SAMPLER, PS, FABRICA_SAMPLER, SEMICORCHEAS_QUANT, MODO_MIENTRAS,
  velocidadDeAfinacion, rangoReproduccion, invertir, generarFabrica, crearEstado, setParam, valorIdx, activarCara,
  liberarParamCara, restaurarPad, crearRanuras, asignarRanura, cortarPad, padSonando, vivas, liberarRanura,
  proximaGrilla, inicioCompas, tiempoGrab, lineaSampler1, type FuenteParam, type EstadoGrab, type Ranuras, type Rango,
} from "@/lib/sampler";

/** Estado que leen el atril, el display y el menú. */
export const SAMPLER = {
  version: 0, versionCara: 0, versionAudio: 0, listo: false,
  estadoGrab: "libre" as EstadoGrab, grabS: 0, grabPad: -1,
  sonando: new Uint8Array(N_PADS), vivas: 0, robos: 0, disparos: 0,
  nombres: FABRICA_SAMPLER.map(f => f.nombre as string), grabado: new Uint8Array(N_PADS),
  mensaje: "", mensajeVer: 0, avisoMic: false, memoriaBytes: 0, selecc: false, reinicios: 0,
};
export const EST = crearEstado();
export let RANURAS: Ranuras = crearRanuras(Math.max(DBG_SAMPLER.SAMPLER_VOCES, DBG_SAMPLER.SAMPLER_MAX_SIMULTANEAS));
/** Grabador y micrófono vivos (las pruebas los inspeccionan). */
export const GRAB = { rec: null as MediaRecorder | null, stream: null as MediaStream | null, tap: null as MediaStreamAudioDestinationNode | null, timer: null as ReturnType<typeof setTimeout> | null, t0: 0, cancelado: false };

interface Grafo {
  ctx: AudioContext; padGain: GainNode[]; filtro: BiquadFilterNode; vol: GainNode; on: GainNode; analizador: AnalyserNode;
  ranGain: GainNode[]; ranPad: Int8Array; fuentes: (AudioBufferSourceNode | null)[];
  buffers: AudioBuffer[]; invertidos: (AudioBuffer | null)[];
}
let _g: Grafo | null = null;
let _desuscribir: (() => void) | null = null;
const _pend = new Float64Array(N_PADS).fill(-1);   // disparo cuantizado pendiente (tiempo de la grilla) por pad
const _idx = new Int32Array(64), _rango: Rango = { offset: 0, dur: 0 };
const CLAVES = DBG_SAMPLER as unknown as Record<string, number>;

function defectosDesdeDbg(): void {
  for (let i = 0; i < N_PARAMS; i++) {
    const d = PARAMS_SAMPLER[i], v = CLAVES[d.clave];
    if (typeof v !== "number") continue;
    if (d.porPad) for (let p = 0; p < N_PADS; p++) setParam(EST, d.id, v, "manual", p); else setParam(EST, d.id, v, "manual");
  }
  for (let p = 0; p < N_PADS; p++) if (FABRICA_SAMPLER[p].loop) setParam(EST, "loop", 1, "manual", p);   // el DRON en bucle
}
function cancelarYMantener(p: AudioParam, t: number): void {
  const q = p as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam };
  if (typeof q.cancelAndHoldAtTime === "function") q.cancelAndHoldAtTime(t); else p.cancelScheduledValues(t);
}
const v = (i: number, pad?: number): number => valorIdx(EST, i, pad);

function bufferFabrica(ctx: BaseAudioContext, i: number): AudioBuffer {
  const datos = generarFabrica(i, ctx.sampleRate), b = ctx.createBuffer(1, datos.length, ctx.sampleRate);
  b.getChannelData(0).set(datos);
  return b;
}
function crearGrafo(ctx: AudioContext): Grafo {
  const filtro = ctx.createBiquadFilter(), vol = ctx.createGain(), on = ctx.createGain(), analizador = ctx.createAnalyser();
  filtro.type = "lowpass"; analizador.fftSize = 1024;
  filtro.connect(vol); vol.connect(on); on.connect(entradaBus()); on.connect(analizador);
  const padGain: GainNode[] = [], buffers: AudioBuffer[] = [], invertidos: (AudioBuffer | null)[] = [];
  for (let p = 0; p < N_PADS; p++) {
    const g = ctx.createGain(); g.connect(filtro); padGain.push(g);
    buffers.push(bufferFabrica(ctx, p)); invertidos.push(null);
  }
  const ranGain: GainNode[] = [], fuentes: (AudioBufferSourceNode | null)[] = [];
  for (let i = 0; i < RANURAS.n; i++) { const g = ctx.createGain(); g.gain.value = 0; g.connect(padGain[0]); ranGain.push(g); fuentes.push(null); }
  const ranPad = new Int8Array(RANURAS.n);
  const gr: Grafo = { ctx, padGain, filtro, vol, on, analizador, ranGain, ranPad, fuentes, buffers, invertidos };
  aplicarParams(gr, ctx.currentTime);
  return gr;
}
function grafo(): Grafo | null {
  if (!DBG_SAMPLER.ACTIVO || typeof window === "undefined") return null;
  const ctx = obtenerContexto();
  if (ctx.state !== "running") void reanudarContexto();
  if (!_g || _g.ctx !== ctx) {
    liberarGrafo(); _g = crearGrafo(ctx); SAMPLER.listo = true;
    for (let p = 0; p < N_PADS; p++) { SAMPLER.nombres[p] = FABRICA_SAMPLER[p].nombre; SAMPLER.grabado[p] = 0; }
    SAMPLER.versionAudio++; calcularMemoria();
  }
  return _g;
}
function calcularMemoria(): void {
  const g = _g;
  let b = 0;
  if (g) for (let p = 0; p < N_PADS; p++) { b += g.buffers[p].length * g.buffers[p].numberOfChannels * 4; const r = g.invertidos[p]; if (r) b += r.length * r.numberOfChannels * 4; }
  SAMPLER.memoriaBytes = b;
}

/** Filtro, volumen general, ON y volumen de cada pad (suavizado corto). */
function aplicarParams(g: Grafo, ahora: number): void {
  const fc = Math.max(DBG_SAMPLER.CORTE_MIN, Math.min(DBG_SAMPLER.CORTE_MAX, v(PS.corte)));
  const q = 0.5 + Math.max(0, Math.min(1, v(PS.resonancia))) * (Math.max(0.6, DBG_SAMPLER.RES_MAX) - 0.5);
  g.filtro.frequency.setTargetAtTime(Math.min(fc, g.ctx.sampleRate * 0.45), ahora, 0.02);
  g.filtro.Q.setTargetAtTime(q, ahora, 0.02);
  g.vol.gain.setTargetAtTime(Math.max(0, v(PS.volumen)), ahora, 0.02);
  g.on.gain.setTargetAtTime(DBG_SAMPLER.ON ? 1 : 0, ahora, 0.01);
  for (let p = 0; p < N_PADS; p++) g.padGain[p].gain.setTargetAtTime(Math.max(0, v(PS.volPad, p)), ahora, 0.02);
}

/** Buffer del pad (con REVERSA, el invertido: se calcula una vez por sonido, al pedirlo). */
function bufferDe(g: Grafo, pad: number): AudioBuffer {
  if (Math.round(v(PS.reversa, pad)) !== 1) return g.buffers[pad];
  let r = g.invertidos[pad];
  if (!r) {
    const b = g.buffers[pad];
    r = g.ctx.createBuffer(b.numberOfChannels, b.length, b.sampleRate);
    for (let c = 0; c < b.numberOfChannels; c++) invertir(b.getChannelData(c), r.getChannelData(c));
    g.invertidos[pad] = r; calcularMemoria();
  }
  return r;
}
/** Caída corta de una ranura y fin de su fuente (robo o MIENTRAS al soltar). */
function apagarRanura(g: Grafo, i: number, t: number): void {
  const gn = g.ranGain[i], src = g.fuentes[i], r = Math.max(0.002, DBG_SAMPLER.ROBO_S);
  cancelarYMantener(gn.gain, t); gn.gain.setTargetAtTime(0, t, r / 4);
  if (src) { try { src.stop(t + r + 0.002); } catch { /* ya parada */ } }
}
/** Un disparo del pad en t (tiempo de audio exacto). Sin crear nada salvo la fuente (de un solo uso). */
function iniciarFuente(g: Grafo, pad: number, t0: number): void {
  const buf = bufferDe(g, pad), rate = velocidadDeAfinacion(v(PS.afinacion, pad));
  const rev = Math.round(v(PS.reversa, pad)) === 1, loop = Math.round(v(PS.loop, pad)) === 1;
  rangoReproduccion(v(PS.inicio, pad), v(PS.fin, pad), buf.duration, rev, _rango);
  const durReal = loop ? Infinity : _rango.dur / rate;
  const i = asignarRanura(RANURAS, pad, t0, durReal, DBG_SAMPLER.SAMPLER_MAX_SIMULTANEAS);
  let t = t0;
  if (RANURAS.robada) { apagarRanura(g, i, t); t += Math.max(0.002, DBG_SAMPLER.ROBO_S) + 0.003; SAMPLER.robos = RANURAS.robos; RANURAS.tOn[i] = t; }
  const gn = g.ranGain[i];
  if (g.ranPad[i] !== pad) { gn.disconnect(); gn.connect(g.padGain[pad]); g.ranPad[i] = pad; }
  const src = g.ctx.createBufferSource();
  src.buffer = buf; src.playbackRate.value = rate;
  if (loop) { src.loop = true; src.loopStart = _rango.offset; src.loopEnd = _rango.offset + _rango.dur; }
  cancelarYMantener(gn.gain, t); gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(1, t + 0.002);
  src.connect(gn);
  if (loop) src.start(t, _rango.offset); else src.start(t, _rango.offset, _rango.dur);
  g.fuentes[i] = src;
  src.onended = () => { if (g.fuentes[i] === src) { g.fuentes[i] = null; liberarRanura(RANURAS, i); } try { src.disconnect(); } catch { /* ok */ } };
  SAMPLER.disparos++;
}
function cortar(g: Grafo, pad: number, t: number): void {
  const n = cortarPad(RANURAS, pad, t, _idx);
  for (let k = 0; k < n; k++) apagarRanura(g, _idx[k], t);
}
function quantActivo(): number {
  const q = SEMICORCHEAS_QUANT[Math.max(0, Math.min(3, Math.round(DBG_SAMPLER.QUANT)))];
  return q > 0 && RITMOS.sonando && RELOJ.estado === "corriendo" ? q : 0;
}
/** Tiempo de la grilla para un disparo pedido ahora (o −1 si no cuantiza). */
export function tiempoCuantizado(ahora: number): number {
  const q = quantActivo();
  if (!q) return -1;
  const d = duracionPasoS(RELOJ);
  return proximaGrilla(ahora, inicioCompas(RELOJ.siguienteT, RELOJ.paso, d), d * RELOJ.pasosPorCompas, q);
}

// ── oyente del reloj: disparos cuantizados pendientes (sin allocations) ──
const oyenteReloj = (_paso: number, t: number, _compas: number, durS: number): void => {
  const g = _g;
  if (!g) return;
  for (let p = 0; p < N_PADS; p++) {
    const tp = _pend[p];
    if (tp < 0 || tp >= t + durS - 1e-9) continue;
    _pend[p] = -1;
    iniciarFuente(g, p, tp);
  }
};

// ── acciones del usuario (atril, teclado, menú) ──
/** Tocar un pad (tecla abajo o clic). Lo selecciona; con SELECC. encendido solo lo selecciona. */
export function padAbajo(pad: number): void {
  const p = Math.max(0, Math.min(N_PADS - 1, Math.round(pad)));
  if (EST.sel !== p) { EST.sel = p; SAMPLER.version++; }
  if (SAMPLER.selecc) return;
  const g = grafo();
  if (!g) return;
  const ahora = g.ctx.currentTime + Math.max(0, Math.min(0.1, DBG_SAMPLER.LOOKAHEAD_S));
  // DISPARO con LOOP: el segundo toque corta el bucle
  if (Math.round(v(PS.modo, p)) !== MODO_MIENTRAS && Math.round(v(PS.loop, p)) === 1 && padSonando(RANURAS, p, ahora)) { cortar(g, p, ahora); return; }
  const tq = tiempoCuantizado(g.ctx.currentTime);
  if (tq < 0) { iniciarFuente(g, p, ahora); return; }
  if (tq < RELOJ.siguienteT) iniciarFuente(g, p, Math.max(tq, ahora)); else _pend[p] = tq;
}
/** Soltar un pad: en MIENTRAS corta (o cancela el disparo pendiente); en DISPARO no hace nada. */
export function padArriba(pad: number): void {
  const p = Math.max(0, Math.min(N_PADS - 1, Math.round(pad)));
  if (Math.round(v(PS.modo, p)) !== MODO_MIENTRAS) return;
  _pend[p] = -1;
  const g = _g;
  if (g) cortar(g, p, g.ctx.currentTime + 0.002);
}
export function seleccionarPad(pad: number): void { EST.sel = Math.max(0, Math.min(N_PADS - 1, Math.round(pad))); SAMPLER.version++; }
/** Corta todo lo que suena (sin desmontar). */
export function cortarTodo(): void {
  _pend.fill(-1);
  const g = _g;
  if (!g) return;
  const t = g.ctx.currentTime;
  for (let p = 0; p < N_PADS; p++) cortar(g, p, t);
}

// ── parámetros (atril, menú; la cara después) ──
/** setParam con fuente ("manual" atril y menú; "cara" preparada, regla de Z99). Los por pad, sobre el seleccionado. */
export function setParamSampler(id: string, valor: number, fuente: FuenteParam = "manual", pad = EST.sel): boolean {
  const ok = setParam(EST, id, valor, fuente, pad);
  if (!ok) return false;
  if (fuente === "cara") SAMPLER.versionCara++; else SAMPLER.version++;
  const ctx = contextoNucleo(); if (_g && ctx) aplicarParams(_g, ctx.currentTime);
  return true;
}
/** Gancho para después (hoy no lo llama nadie): enciende o apaga la fuente "cara"; al apagar vuelve el manual. */
export function activarCaraSampler(on: boolean): void {
  activarCara(EST, on); SAMPLER.versionCara++;
  const ctx = contextoNucleo(); if (_g && ctx) aplicarParams(_g, ctx.currentTime);
}
export function liberarParamCaraSampler(id: string): void {
  if (!liberarParamCara(EST, id)) return;
  SAMPLER.versionCara++;
  const ctx = contextoNucleo(); if (_g && ctx) aplicarParams(_g, ctx.currentTime);
}
export function aplicarOpcionesSampler(): void { const ctx = contextoNucleo(); if (_g && ctx) aplicarParams(_g, ctx.currentTime); SAMPLER.version++; }
function mensaje(t: string): void { SAMPLER.mensaje = t; SAMPLER.mensajeVer++; }

// ── grabación ──
/** BORRAR: el pad seleccionado vuelve a su sonido de fábrica (y a sus parámetros por defecto). */
export function borrarPad(pad = EST.sel): void {
  const p = Math.max(0, Math.min(N_PADS - 1, Math.round(pad)));
  const g = _g;
  if (g) { cortar(g, p, g.ctx.currentTime); g.buffers[p] = bufferFabrica(g.ctx, p); g.invertidos[p] = null; }
  restaurarPad(EST, p, FABRICA_SAMPLER[p].loop);
  SAMPLER.nombres[p] = FABRICA_SAMPLER[p].nombre; SAMPLER.grabado[p] = 0;
  SAMPLER.versionAudio++; SAMPLER.version++; calcularMemoria();
  mensaje(`PAD ${p + 1}: VUELVE ${FABRICA_SAMPLER[p].nombre} DE FÁBRICA`);
}
/** Cierra el micrófono y la derivación de la mezcla (al terminar, al cancelar o al desmontar). Z106: red de seguridad; el
 *  orquestador (lib/muestreoGrabacion.ts) ya detiene las pistas y desconecta la derivación en cada final. */
function cerrarEntradas(): void {
  if (GRAB.timer) { clearTimeout(GRAB.timer); GRAB.timer = null; }
  if (GRAB.stream) { GRAB.stream.getTracks().forEach(t => t.stop()); GRAB.stream = null; }
  if (GRAB.tap) { const an = analizadorMaestro(); try { an?.disconnect(GRAB.tap); } catch { /* ya desconectado */ } GRAB.tap = null; }
}

// ── Z106: grabación con estado visible (lib/muestreoGrabacion.ts) ──
/** Estado de la grabación (fase, código y mensaje del último error, formato, pico): lo muestran el atril y el menú. */
export const MUESTREO = crearEstadoMuestreo();
/** Diagnóstico de micrófono (menú «Diagnóstico de micrófono Z106»). */
export const DIAG_MIC = { permiso: "?", entradas: [] as string[], prueba: "", probando: false };
/** Decodifica con la versión de promesa y, si el navegador es viejo, con la de callbacks. */
function decodificarAudio(ctx: BaseAudioContext, ab: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise<AudioBuffer>((ok, mal) => {
    try {
      const pr = ctx.decodeAudioData(ab, ok, e => mal(e ?? new DOMException("no se pudo decodificar", "EncodingError")));
      if (pr && typeof pr.then === "function") pr.then(ok, mal);
    } catch (e) { mal(e); }
  });
}
function restriccionesMic(): MediaStreamConstraints {
  return { audio: { echoCancellation: DBG_SAMPLER.GRAB_ECO, noiseSuppression: DBG_SAMPLER.GRAB_RUIDO, autoGainControl: DBG_SAMPLER.GRAB_AGC }, video: false };
}
const PUNTERO = {
  bloqueado: () => DBG_SAMPLER.GRAB_LIBERAR_PUNTERO && typeof document !== "undefined" && !!document.pointerLockElement,
  liberar: () => { try { document.exitPointerLock(); } catch { /* sin pointer lock */ } },
  // se recupera solo fuera del modo atril (en el atril el cursor tiene que quedar libre para los controles)
  recuperar: () => {
    if (INTERACT_STATE.mode !== "none") return;
    try { const c = document.querySelector("canvas") as (HTMLCanvasElement & { requestPointerLock(): unknown }) | null; const r = c?.requestPointerLock() as Promise<void> | undefined; r?.catch?.(() => {}); } catch { /* sin gesto: el usuario vuelve a hacer clic */ }
  },
};
const GRABACION = crearGrabacion<AudioBuffer>(MUESTREO, {
  pedirMic: () => navigator.mediaDevices.getUserMedia(restriccionesMic()),
  crearGrabador: (st, mime) => new MediaRecorder(st as MediaStream, mime ? { mimeType: mime } : undefined) as unknown as GrabadorLike,
  get soporta() { return typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function" ? (m: string) => MediaRecorder.isTypeSupported(m) : null; },
  aArrayBuffer: (partes, mime) => new Blob(partes as BlobPart[], { type: mime }).arrayBuffer(),
  decodificar: ab => (_g ? decodificarAudio(_g.ctx, ab) : Promise.reject(new DOMException("el sampler no tiene grafo", "InvalidStateError"))),
  ahora: () => performance.now() / 1000,
  puntero: PUNTERO,
  alListo: (buf, pad, fuente) => colocarGrabacion(pad, buf, fuente),
  alCambio: e => {
    GRAB.rec = GRABACION ? (GRABACION.grabador() as unknown as MediaRecorder | null) : null;
    GRAB.stream = GRABACION ? (GRABACION.stream() as MediaStream | null) : null;
    SAMPLER.estadoGrab = e.fase === "pidiendo" || e.fase === "grabando" || e.fase === "procesando" ? e.fase : "libre";
    if (e.fase === "grabando") {
      GRAB.t0 = performance.now();
      // corte de seguridad aunque no haya cuadros (pestaña en segundo plano); tickSampler corta también por cuadro
      if (GRAB.timer) clearTimeout(GRAB.timer);
      GRAB.timer = setTimeout(() => { GRAB.timer = null; if (MUESTREO.fase === "grabando") { mensaje(`CORTE: MÁXIMO ${DBG_SAMPLER.SAMPLER_MAX_S} S`); GRABACION.parar(); } }, Math.max(0.5, e.maxS) * 1000);
      if (e.fuente === "MIC" && !SAMPLER.avisoMic) { SAMPLER.avisoMic = true; mensaje("MIC: SI COMPARTÍS, SE TRANSMITE"); }
    } else if (e.fase !== "pidiendo") {
      cerrarEntradas();
      if (e.fase === "error") mensaje(textoMuestreo(e));
      if (e.fase === "inactivo") { SAMPLER.grabPad = -1; SAMPLER.grabS = 0; }
    }
    SAMPLER.version++;
  },
  avisar: (nombre, msj) => { console.warn(`[SM-40] ${nombre}: ${msj}`); },
});
/** GRABAR en el pad seleccionado desde MIC o MEZCLA (DBG_SAMPLER.FUENTE_GRAB). Un solo grabador: false si ya hay uno. */
export function grabar(): boolean {
  if (SAMPLER.estadoGrab !== "libre") {
    if (SAMPLER.estadoGrab === "pidiendo") mensaje("MIC: ACEPTÁ EL PERMISO EN EL NAVEGADOR (ARRIBA A LA IZQUIERDA)");
    return false;
  }
  const g = grafo();
  const pad = EST.sel, mic = Math.round(DBG_SAMPLER.FUENTE_GRAB) === 0, fuente = mic ? "MIC" : "MEZCLA";
  if (!g || typeof MediaRecorder === "undefined" || (mic && !navigator.mediaDevices?.getUserMedia)) {
    MUESTREO.fuente = fuente; MUESTREO.codigo = "navegador"; MUESTREO.nombreError = "NotSupportedError";
    MUESTREO.detalle = !g ? "sin sampler" : typeof MediaRecorder === "undefined" ? "sin MediaRecorder" : "sin getUserMedia (¿página sin HTTPS?)";
    MUESTREO.fase = "error"; MUESTREO.version++;
    console.warn(`[SM-40] ${MUESTREO.nombreError}: ${MUESTREO.detalle}`);
    mensaje(textoMuestreo(MUESTREO)); SAMPLER.version++;
    return false;
  }
  SAMPLER.grabPad = pad; SAMPLER.grabS = 0; GRAB.cancelado = false;
  let mezcla: { stream: MediaStream; cerrar(): void } | null = null;
  if (!mic) {
    const an = analizadorMaestro();
    if (an) {
      // derivación del analizador maestro (todo lo que suena en la tarima pasa por él): lo que suena no cambia
      const tap = g.ctx.createMediaStreamDestination();
      an.connect(tap);
      GRAB.tap = tap;
      mezcla = { stream: tap.stream, cerrar: () => { try { an.disconnect(tap); } catch { /* ya desconectado */ } if (GRAB.tap === tap) GRAB.tap = null; } };
    }
  }
  return GRABACION.iniciar(fuente, pad, DBG_SAMPLER.SAMPLER_MAX_S, mezcla);
}
/** Pone lo grabado en el pad (recortado a SAMPLER_MAX_S, normalizado con GRAB_NORMALIZAR) con sus parámetros por defecto.
 *  Devuelve el pico original (0…1). */
function colocarGrabacion(pad: number, buf: AudioBuffer, nombre: string): number {
  const g = _g;
  if (!g) return 0;
  const max = Math.floor(Math.max(0.5, DBG_SAMPLER.SAMPLER_MAX_S) * buf.sampleRate);
  let b = buf;
  if (buf.length > max) {
    b = g.ctx.createBuffer(buf.numberOfChannels, max, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) b.getChannelData(c).set(buf.getChannelData(c).subarray(0, max));
  }
  let pico = 0;
  for (let c = 0; c < b.numberOfChannels; c++) { const x = b.getChannelData(c); for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > pico) pico = v; } }
  // Z106: sin control automático de ganancia, el micrófono de una notebook graba muy bajo frente a los sonidos de fábrica
  if (DBG_SAMPLER.GRAB_NORMALIZAR) {
    const k = gananciaNormalizar(pico, DBG_SAMPLER.GRAB_PICO, DBG_SAMPLER.GRAB_GANANCIA_MAX);
    if (k !== 1) for (let c = 0; c < b.numberOfChannels; c++) { const x = b.getChannelData(c); for (let i = 0; i < x.length; i++) x[i] *= k; }
  }
  cortar(g, pad, g.ctx.currentTime);
  g.buffers[pad] = b; g.invertidos[pad] = null;
  restaurarPad(EST, pad, false);   // INICIO y FIN vuelven a 0 y 1
  SAMPLER.nombres[pad] = nombre; SAMPLER.grabado[pad] = 1;
  SAMPLER.versionAudio++; SAMPLER.version++; calcularMemoria();
  mensaje(`PAD ${pad + 1}: ${nombre} ${b.duration.toFixed(1)} S GRABADO`);
  return pico;
}
/** PARAR: termina la grabación (se decodifica y va al pad). Z106: durante el pedido de permiso no cancela (antes un
 *  segundo clic descartaba en silencio el micrófono que el navegador concedía después). */
export function pararGrabacion(): void {
  if (SAMPLER.estadoGrab === "pidiendo") { mensaje("MIC: ACEPTÁ EL PERMISO EN EL NAVEGADOR (ARRIBA A LA IZQUIERDA)"); return; }
  if (GRAB.timer) { clearTimeout(GRAB.timer); GRAB.timer = null; }
  GRABACION.parar();
}
/** Cancela sin guardar (desmontar, reiniciar): corta el grabador y cierra micrófono y derivación. */
export function cancelarGrabacion(): void {
  GRAB.cancelado = true;
  GRABACION.cancelar();
  GRAB.rec = null;
  cerrarEntradas();
  SAMPLER.estadoGrab = "libre"; SAMPLER.grabPad = -1; SAMPLER.grabS = 0;
}
/** Línea de estado de la grabación para el atril ("" = nada que mostrar). */
export function textoGrabacion(): string { return textoMuestreo(MUESTREO, performance.now() / 1000, DBG_SAMPLER.GRAB_LISTO_S); }

/** Menú «Probar micrófono ahora»: pide el permiso, mide el pico durante 1 s y libera todo. No graba en ningún pad ni
 *  pasa por el bus (no se transmite). */
export async function probarMicrofono(): Promise<string> {
  if (DIAG_MIC.probando) return DIAG_MIC.prueba;
  DIAG_MIC.probando = true; DIAG_MIC.prueba = "pidiendo permiso…";
  let st: MediaStream | null = null, src: MediaStreamAudioSourceNode | null = null, an: AnalyserNode | null = null;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("sin getUserMedia", "NotSupportedError");
    const soltado = PUNTERO.bloqueado(); if (soltado) PUNTERO.liberar();
    try { st = await navigator.mediaDevices.getUserMedia(restriccionesMic()); } finally { if (soltado) PUNTERO.recuperar(); }
    const ctx = obtenerContexto(); if (ctx.state !== "running") await reanudarContexto();
    src = ctx.createMediaStreamSource(st); an = ctx.createAnalyser(); an.fftSize = 2048; src.connect(an);   // sin salida: no suena ni se transmite
    const datos = new Float32Array(an.fftSize);
    let pico = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 1000) {
      an.getFloatTimeDomainData(datos);
      for (let i = 0; i < datos.length; i++) { const v = Math.abs(datos[i]); if (v > pico) pico = v; }
      await new Promise(r => setTimeout(r, 40));
    }
    const pista = st.getAudioTracks()[0];
    const db = pico > 0 ? 20 * Math.log10(pico) : -Infinity;
    DIAG_MIC.prueba = `OK · pico ${pico.toFixed(3)} (${Number.isFinite(db) ? db.toFixed(1) : "−∞"} dBFS) · ${pista?.label || "micrófono"} · ${elegirMime(typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported ? (m: string) => MediaRecorder.isTypeSupported(m) : null).mime || "formato del navegador"}`;
  } catch (e) {
    const x = e as { name?: string; message?: string };
    const c = codigoDeError(x?.name || "");
    DIAG_MIC.prueba = `FALLÓ · ${x?.name || "Error"}: ${MENSAJES_MUESTREO[c]}${x?.message ? " · " + x.message : ""}`;
    console.warn(`[SM-40] prueba de micrófono · ${x?.name || "Error"}: ${x?.message || ""}`);
  } finally {
    try { src?.disconnect(); } catch { /* ok */ }
    try { an?.disconnect(); } catch { /* ok */ }
    st?.getTracks().forEach(t => t.stop());
    DIAG_MIC.probando = false;
  }
  return DIAG_MIC.prueba;
}
/** Menú: permisos y dispositivos de entrada (solo etiquetas y cantidad). */
export async function actualizarDiagMic(): Promise<void> {
  try {
    const q = await (navigator.permissions?.query?.({ name: "microphone" as PermissionName }));
    DIAG_MIC.permiso = q ? q.state : "sin navigator.permissions";
  } catch (e) { DIAG_MIC.permiso = `no se puede consultar (${(e as Error)?.name || "Error"})`; }
  try {
    const ds = await navigator.mediaDevices?.enumerateDevices?.();
    DIAG_MIC.entradas = (ds ?? []).filter(d => d.kind === "audioinput").map((d, i) => d.label || `entrada ${i + 1} (sin etiqueta hasta dar permiso)`);
  } catch { DIAG_MIC.entradas = []; }
}
/** Menú: estado del AudioContext y del MediaRecorder. */
export function estadoAudioYGrabador(): string {
  const ctx = contextoNucleo();
  return `AudioContext ${ctx ? ctx.state : "sin crear"} · MediaRecorder ${typeof MediaRecorder === "undefined" ? "no existe" : GRAB.rec ? GRAB.rec.state : "sin grabador"}`;
}

// ── ciclo de vida ──
export function instalarSampler(): () => void {
  if (!DBG_SAMPLER.ACTIVO) return () => {};
  if (!_desuscribir) _desuscribir = suscribirPasos(oyenteReloj);
  return liberarSampler;
}
function liberarGrafo(): void {
  const g = _g;
  if (!g) return;
  const t = g.ctx.currentTime;
  for (let i = 0; i < g.fuentes.length; i++) {
    const s = g.fuentes[i];
    if (s) { s.onended = null; try { s.stop(t); } catch { /* ya parada */ } try { s.disconnect(); } catch { /* ok */ } g.fuentes[i] = null; }
  }
  for (const n of [...g.ranGain, ...g.padGain, g.filtro, g.vol, g.on, g.analizador]) { try { n.disconnect(); } catch { /* ok */ } }
  _g = null; SAMPLER.listo = false;
  RANURAS = crearRanuras(Math.max(DBG_SAMPLER.SAMPLER_VOCES, DBG_SAMPLER.SAMPLER_MAX_SIMULTANEAS));
  SAMPLER.sonando.fill(0); SAMPLER.vivas = 0; SAMPLER.memoriaBytes = 0;
}
let _listoVisto = false;   // Z106
function avisarCorte(): void { mensaje(`CORTE: MÁXIMO ${DBG_SAMPLER.SAMPLER_MAX_S} S`); }   // Z106: fuera del cuadro (solo al cortar)
/** Al desmontar: suscripción, grabación (y micrófono), fuentes y nodos. Las grabaciones se pierden (solo en memoria). */
export function liberarSampler(): void {
  _desuscribir?.(); _desuscribir = null;
  _pend.fill(-1);
  cancelarGrabacion();
  liberarGrafo();
}
/**
 * Un cuadro (lo llama el atril en su useFrame; sin allocations): dispara los pendientes si la caja paró, cuenta el tiempo
 * de grabación y actualiza las luces de los pads que suenan y las voces vivas.
 */
export function tickSampler(): void {
  const g = _g;
  if (g && !RITMOS.sonando) for (let p = 0; p < N_PADS; p++) if (_pend[p] >= 0) { _pend[p] = -1; iniciarFuente(g, p, g.ctx.currentTime + 0.005); }
  if (SAMPLER.estadoGrab === "grabando") {
    SAMPLER.grabS = tiempoGrab(GRAB.t0 / 1000, performance.now() / 1000, DBG_SAMPLER.SAMPLER_MAX_S);
    if (GRABACION.tick()) avisarCorte();   // Z106: corte por cuadro (el temporizador queda de respaldo)
  }
  // Z106: el «LISTO, PAD n» se apaga solo después de GRAB_LISTO_S
  if (MUESTREO.fase === "listo" && performance.now() / 1000 - MUESTREO.tFin > DBG_SAMPLER.GRAB_LISTO_S && !_listoVisto) { _listoVisto = true; SAMPLER.version++; }
  else if (MUESTREO.fase !== "listo") _listoVisto = false;
  const t = g ? g.ctx.currentTime : 0;
  for (let p = 0; p < N_PADS; p++) SAMPLER.sonando[p] = g && padSonando(RANURAS, p, t) ? 1 : 0;
  SAMPLER.vivas = g ? vivas(RANURAS, t) : 0;
}
/** Menú: corta todo, cancela la grabación y vuelve a los 8 sonidos de fábrica con sus valores por defecto. */
export function silenciarYReiniciarSampler(): void {
  _pend.fill(-1);
  cancelarGrabacion();
  liberarGrafo();
  for (let p = 0; p < N_PADS; p++) restaurarPad(EST, p, FABRICA_SAMPLER[p].loop);
  defectosDesdeDbg();
  EST.sel = 0; SAMPLER.selecc = false;
  for (let p = 0; p < N_PADS; p++) { SAMPLER.nombres[p] = FABRICA_SAMPLER[p].nombre; SAMPLER.grabado[p] = 0; }
  SAMPLER.version++; SAMPLER.versionAudio++; SAMPLER.reinicios++;
}
/** Línea 1 del display (se arma solo cuando cambia algo). */
export function lineaEstadoSampler(): string {
  const p = EST.sel, e = SAMPLER.estadoGrab;
  const est = e === "grabando" && SAMPLER.grabPad === p ? `GRABANDO ${SAMPLER.grabS.toFixed(1)} S` : e === "pidiendo" ? "PIDIENDO MIC" : e === "procesando" ? "PROCESANDO"
    : SAMPLER.sonando[p] ? "SONANDO" : "ESPERANDO";
  return lineaSampler1(p, SAMPLER.nombres[p], est, DBG_RITMOS.BPM);
}
/** Datos (canal 0) del sonido del pad para la forma de onda del display (null hasta que nace el grafo). */
export function datosPad(pad: number): Float32Array | null { return _g ? _g.buffers[pad].getChannelData(0) : null; }
export function analizadorSampler(): AnalyserNode | null { return _g?.analizador ?? null; }

// valores iniciales (al final: todo lo de arriba ya está definido)
defectosDesdeDbg();
