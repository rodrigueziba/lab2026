// Z100: CARA del BA-40. Une la cámara, el worker de MediaPipe (lib/caraWorker.ts), la lógica pura (lib/cara.ts) y el
// motor del bajo (setParamBajo con fuente "cara", activarCara de Z99, forzarAcentoProximaNota, siguientePatronBajo).
//
// PRIVACIDAD: el video de la cara no se sube ni se transmite. Cada cuadro se reduce a ANCHO×ALTO con createImageBitmap y
// se transfiere a un Web Worker de esta misma página; vuelve solo un Float32Array de 9 números. Lo que viaja a SILLAS
// sigue siendo el audio del bus maestro (donde suena el bajo) y la imagen procesada del domo (Z94), como antes de Z100.
//
// Cámara: reutiliza el MISMO stream de la tarima (el <video> de useFaceTracking, LIVE_TEX_REF.value.image) si está
// andando; si no, pide uno propio y lo cierra al apagar (el de la tarima nunca se cierra desde acá).
// Hilo principal por cuadro: solo createImageBitmap + postMessage (ida) y procesarCuadro + setParamBajo (vuelta), sin
// allocations propias (mensaje, lista de transferencia y buffer reutilizados; el buffer va y vuelve por transferencia).
import { DBG_CARA, DBG_RENDIMIENTO } from "@/lib/debugConfig";
import { LIVE_TEX_REF } from "@/lib/faceShared";
import {
  crearEstadoCara, procesarCuadro, reiniciarSeguimiento, crearEstadoCal, iniciarCal, cancelarCal, pasoCal, restanteCal,
  leerCal, serializarCal, calibracionPorDefecto, textoLineaCara, CLAVE_CAL, N_CRUDOS, EV_ACENTO, EV_GUINO, MAX_MAPA,
  C_PRESENTE, C_JAW, C_PUCKER, C_SMILE_L, C_SMILE_R, C_BROW, C_BLINK_L, C_BLINK_R, C_PITCH,
  type EstadoLector,
} from "@/lib/cara";
import { indiceParam } from "@/lib/bajoAcido";
import { setParamBajo, activarCaraBajo, liberarParamCaraBajo, forzarAcentoProximaNota, siguientePatronBajo } from "@/lib/audio/bajoAcido";

/** Estado leído por el atril (medidores, luz, pastilla, display) y el menú. */
export const CARA = {
  on: false,
  estado: "apagada" as EstadoLector,
  linea: "",                 // línea 2 del display ("CARA: ACTIVA"…); se rearma solo al cambiar
  version: 0,                // sube cuando cambia la línea o el estado
  arrastreIdx: -1,           // índice (PARAMS_BAJO) de la perilla que se está arrastrando (lo escribe LecternSystem)
  streamPropio: false,
  fuente: "" as "" | "tarima" | "propia" | "simulada",
  rutas: "" as "" | "local" | "cdn",
  enviados: 0, recibidos: 0, descartados: 0, acentos: 0, guinos: 0,
  msHilo: 0,                 // ms del hilo principal por cuadro (envío + lectura del resultado), media móvil
  msIdaVuelta: 0,            // ms desde que sale el cuadro hasta que vuelve el resultado (incluye la inferencia)
  fpsReal: 0,
};
/** Gestos (medidores 0…1), calibración y detectores. */
export const EST = crearEstadoCara();
const CAL = crearEstadoCal();
const _ultimo = new Float64Array(MAX_MAPA).fill(NaN);   // último valor mandado por entrada del mapa
const _crudoSim = new Float32Array(N_CRUDOS);

// URLs: locales (scripts/mediapipe-local.mjs las copia a public/alight/mediapipe/) o el CDN oficial como respaldo.
export const RUTA_LOCAL = { wasm: "/alight/mediapipe/wasm", modelo: "/alight/mediapipe/face_landmarker.task" };
export const RUTA_CDN = {
  wasm: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm",
  modelo: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
};

// ── worker y cámara ──
let _worker: Worker | null = null;
let _listo = false;
let _buf: Float32Array | null = null;
let _enVuelo = false;
let _ultimoEnvio = -1e9, _tEnvio = 0, _tDesde = 0;
let _video: HTMLVideoElement | null = null;
let _stream: MediaStream | null = null;
let _videoPropio: HTMLVideoElement | null = null;
let _generacion = 0;   // invalida promesas de un encendido anterior
const _opcBitmap: ImageBitmapOptions = { resizeWidth: 320, resizeHeight: 240, resizeQuality: "low" };
const _msg: { tipo: string; img: ImageBitmap | null; t: number; buf: Float32Array | null } = { tipo: "cuadro", img: null, t: 0, buf: null };
const _transfer: Transferable[] = [];
let _fpsN = 0, _fpsT0 = 0, _ultimoSim = -1e9;

const ema = (prev: number, x: number): number => (prev === 0 ? x : prev * 0.9 + x * 0.1);

const _prev = { e: "" as string, paso: -1, seg: -1, on: false };
function setEstado(e: EstadoLector, pasoCalib = 0, seg = 0): void {
  if (e === _prev.e && pasoCalib === _prev.paso && seg === _prev.seg && CARA.on === _prev.on) return;   // sin cambios: sin texto nuevo
  _prev.e = e; _prev.paso = pasoCalib; _prev.seg = seg; _prev.on = CARA.on;
  CARA.estado = e;
  CARA.linea = CARA.on || e === "sin_camara" || e === "sin_motor" ? textoLineaCara(e, pasoCalib, seg) : "";
  CARA.version++;
}

/** Enciende la cara (pastilla CARA ON). Sin cámara o sin MediaPipe queda apagada con el aviso en el display. */
export function encenderCara(): void {
  if (CARA.on) return;
  CARA.on = true; _generacion++;
  CARA.enviados = CARA.recibidos = CARA.descartados = 0; CARA.msHilo = CARA.msIdaVuelta = 0;
  reiniciarSeguimiento(EST);
  cargarCalibracion();
  activarCaraBajo(true);
  _ultimo.fill(NaN);
  if (DBG_CARA.SIMULAR) { CARA.fuente = "simulada"; setEstado("esperando"); return; }
  setEstado("iniciando");
  void arrancar(_generacion);
}

/** Apaga la cara: el bajo vuelve a los valores manuales; libera worker, cuadros y (si era propio) el stream. */
export function apagarCara(estadoFinal: EstadoLector = "apagada"): void {
  const estaba = CARA.on;
  CARA.on = false; _generacion++;
  cancelarCal(CAL);
  detenerWorker();
  soltarCamara();
  if (estaba) activarCaraBajo(false);
  _ultimo.fill(NaN);
  EST.gestos.fill(0); EST.detectada = false;
  CARA.fuente = "";
  setEstado(estadoFinal);
}

/** Tecla CALIBRAR: enciende la cara si hacía falta y arranca la guía (CAL_PASO_S por paso). */
export function calibrarCara(): void {
  if (!CARA.on) encenderCara();
  if (!CARA.on) return;
  iniciarCal(CAL, ahoraMs() / 1000);
}
export function calibrando(): boolean { return CAL.activo; }
export function pasoCalibracion(): number { return CAL.paso; }
/** Borra la calibración guardada (vuelve a los límites por defecto). */
export function olvidarCalibracion(): void {
  calibracionPorDefecto(EST.cal);
  try { if (typeof localStorage !== "undefined") localStorage.removeItem(CLAVE_CAL); } catch { /* almacenamiento bloqueado */ }
}
function cargarCalibracion(): void {
  calibracionPorDefecto(EST.cal);
  try { if (typeof localStorage !== "undefined") leerCal(localStorage.getItem(CLAVE_CAL), EST.cal); } catch { /* sin almacenamiento */ }
}
function guardarCalibracion(): void {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(CLAVE_CAL, serializarCal(EST.cal)); } catch { /* sin almacenamiento */ }
}
const ahoraMs = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

async function rutas(): Promise<{ wasm: string; modelo: string }> {
  const base = typeof location !== "undefined" ? location.origin : "";
  if (DBG_CARA.MODELO_LOCAL) {
    try {
      const r = await fetch(RUTA_LOCAL.modelo, { method: "HEAD" });
      const w = await fetch(RUTA_LOCAL.wasm + "/vision_wasm_internal.wasm", { method: "HEAD" });
      if (r.ok && w.ok) { CARA.rutas = "local"; return { wasm: base + RUTA_LOCAL.wasm, modelo: base + RUTA_LOCAL.modelo }; }
    } catch { /* sin archivos locales */ }
  }
  CARA.rutas = "cdn";
  return RUTA_CDN;
}

async function arrancar(gen: number): Promise<void> {
  // 1) cámara: la de la tarima si está andando; si no, una propia
  const v = videoTarima();
  if (v) { _video = v; CARA.fuente = "tarima"; CARA.streamPropio = false; }
  else {
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) throw new Error("sin getUserMedia");
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false });
      if (gen !== _generacion) { s.getTracks().forEach(t => t.stop()); return; }
      const el = document.createElement("video");
      el.playsInline = true; el.muted = true; el.autoplay = true;
      el.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1";
      document.body.appendChild(el);
      el.srcObject = s;
      await el.play().catch(() => {});
      _stream = s; _videoPropio = el; _video = el; CARA.fuente = "propia"; CARA.streamPropio = true;
    } catch {
      if (gen === _generacion) apagarCara("sin_camara");
      return;
    }
  }
  if (gen !== _generacion) return;
  // 2) worker (la inferencia nunca corre en el hilo principal)
  try {
    const { wasm, modelo } = await rutas();
    if (gen !== _generacion) return;
    const w = new Worker(new URL("./caraWorker.ts", import.meta.url));
    _worker = w; _listo = false; _enVuelo = false; _buf = new Float32Array(N_CRUDOS);
    w.onmessage = alMensaje;
    w.onerror = alErrorWorker;
    w.postMessage({ tipo: "iniciar", wasm, modelo });
    setEstado("esperando");
  } catch {
    if (gen === _generacion) apagarCara("sin_motor");
  }
}

function videoTarima(): HTMLVideoElement | null {
  const tex = LIVE_TEX_REF.value as { image?: unknown } | null;
  const v = tex?.image;
  if (typeof HTMLVideoElement === "undefined" || !(v instanceof HTMLVideoElement)) return null;
  const s = v.srcObject as MediaStream | null;
  return v.readyState >= 2 && !!s && s.active ? v : null;
}

function alErrorWorker(): void { if (CARA.on && CARA.fuente !== "simulada") apagarCara("sin_motor"); }

/** Resultado del worker (sin allocations: el buffer vuelve y se reutiliza). */
function alMensaje(e: MessageEvent): void {
  const d = e.data as { tipo: string; buf?: Float32Array };
  if (d.tipo === "resultado" && d.buf) {
    const t0 = ahoraMs();
    _buf = d.buf; _enVuelo = false;
    CARA.recibidos++;
    CARA.msIdaVuelta = ema(CARA.msIdaVuelta, t0 - _tDesde);
    if (CARA.on && CARA.fuente !== "simulada") procesarCrudos(d.buf, _tEnvio);
    CARA.msHilo = ema(CARA.msHilo, ahoraMs() - t0);
    return;
  }
  if (d.tipo === "listo") { _listo = true; return; }
  if (d.tipo === "error") apagarCara("sin_motor");
}

function detenerWorker(): void {
  const w = _worker;
  _worker = null; _listo = false; _enVuelo = false; _buf = null;
  _msg.img = null; _msg.buf = null; _transfer.length = 0;
  if (!w) return;
  w.onmessage = null; w.onerror = null;
  try { w.postMessage({ tipo: "cerrar" }); } catch { /* ya cerrado */ }
  w.terminate();
}

function soltarCamara(): void {
  if (_stream) { for (const t of _stream.getTracks()) t.stop(); _stream = null; }   // solo el stream propio
  if (_videoPropio) { _videoPropio.srcObject = null; _videoPropio.remove(); _videoPropio = null; }
  _video = null; CARA.streamPropio = false;
}

// ── por cuadro ──
/**
 * Lo llama el atril en cada cuadro (useFrame). modoAtril = el usuario está en el modo atril del BA-40.
 * Manda un cuadro al worker a FPS_CARA (uno en vuelo; si el worker se atrasa, el cuadro se descarta) o, con SIMULAR,
 * alimenta el mismo camino desde los sliders del menú.
 */
export function tickCara(modoAtril: boolean): void {
  if (!CARA.on) return;
  if (DBG_CARA.ACTIVO_SOLO_EN_ATRIL && !modoAtril && !DBG_CARA.SIMULAR) { apagarCara(); return; }   // la simulación del menú no depende del modo atril
  const ahora = ahoraMs();
  const periodo = 1000 / Math.max(1, Math.min(60, DBG_CARA.FPS_CARA));
  if (CARA.fuente === "simulada" || DBG_CARA.SIMULAR) {
    if (ahora - _ultimoSim < periodo) return;
    _ultimoSim = ahora;
    llenarSimulacion(_crudoSim);
    procesarCrudos(_crudoSim, ahora);
    contarFps(ahora);
    return;
  }
  if (!_worker || !_listo || !_video) return;
  if (ahora - _ultimoEnvio < periodo) return;
  if (DBG_RENDIMIENTO.SIS.caraBajo === false) return;
  if (_enVuelo || !_buf) {
    CARA.descartados++;
    if (_enVuelo && ahora - _tDesde > 3000) rescatarBuffer();   // worker trabado (raro)
    _ultimoEnvio = ahora;
    return;
  }
  const v = _video;
  if (v.readyState < 2 || v.videoWidth === 0) return;
  const t0 = ahoraMs();
  _enVuelo = true; _ultimoEnvio = ahora; _tEnvio = ahora; _tDesde = ahora;
  _opcBitmap.resizeWidth = Math.max(64, Math.round(DBG_CARA.ANCHO_CUADRO));
  _opcBitmap.resizeHeight = Math.max(48, Math.round(DBG_CARA.ALTO_CUADRO));
  createImageBitmap(v, _opcBitmap).then(alBitmap, alFalloBitmap);
  CARA.msHilo = ema(CARA.msHilo, ahoraMs() - t0);
  contarFps(ahora);
}
/** El worker no devolvió el buffer en 3 s: se da por perdido y se arma uno nuevo (fuera del camino normal). */
function rescatarBuffer(): void { _enVuelo = false; _buf = new Float32Array(N_CRUDOS); }
function alBitmap(img: ImageBitmap): void {
  const w = _worker, b = _buf;
  if (!w || !b || !CARA.on) { img.close(); _enVuelo = false; return; }
  _buf = null;
  _msg.img = img; _msg.t = _tEnvio; _msg.buf = b;
  _transfer.length = 0; _transfer.push(img, b.buffer);
  w.postMessage(_msg, _transfer);
  _msg.img = null; _msg.buf = null; _transfer.length = 0;
  CARA.enviados++;
}
function alFalloBitmap(): void { _enVuelo = false; }
function contarFps(ahora: number): void {
  _fpsN++;
  if (ahora - _fpsT0 >= 1000) { CARA.fpsReal = (_fpsN * 1000) / (ahora - _fpsT0); _fpsN = 0; _fpsT0 = ahora; }
}

/** Sliders del menú → crudos (los mismos nombres que manda el worker). */
export function llenarSimulacion(out: Float32Array): void {
  const S = DBG_CARA;
  out[C_PRESENTE] = 1;
  out[C_JAW] = S.SIM_BOCA; out[C_PUCKER] = S.SIM_O; out[C_SMILE_L] = S.SIM_SONRISA; out[C_SMILE_R] = S.SIM_SONRISA;
  out[C_BROW] = S.SIM_CEJAS; out[C_BLINK_L] = S.SIM_GUINO; out[C_BLINK_R] = 0; out[C_PITCH] = S.SIM_CABECEO * 0.6;
}

/**
 * El camino común (cámara real o simulada): gestos → mapa → setParamBajo(…, "cara"), eventos y calibración.
 * Sin allocations (todo preasignado; la línea del display se rearma solo cuando cambia).
 */
export function procesarCrudos(crudo: ArrayLike<number>, tMs: number): void {
  EST.usarCal = !DBG_CARA.SIN_CALIBRAR;
  const ev = procesarCuadro(EST, crudo, tMs, DBG_CARA, DBG_CARA.MAPA);
  if (CAL.activo) {
    if (pasoCal(CAL, EST.crudos, EST.detectada, tMs / 1000, DBG_CARA.CAL_PASO_S, EST.cal)) guardarCalibracion();
  }
  const mapa = DBG_CARA.MAPA, n = Math.min(MAX_MAPA, mapa.length);
  for (let j = 0; j < n; j++) {
    const id = mapa[j].param, v = EST.salida[j];
    if (!Number.isFinite(v)) { if (!Number.isNaN(_ultimo[j]) || mapa[j].activo === false) { liberarParamCaraBajo(id); _ultimo[j] = NaN; } continue; }
    if (DBG_CARA.CARA_PRIORIDAD_MANUAL && CARA.arrastreIdx >= 0 && indiceParam(id) === CARA.arrastreIdx) {
      liberarParamCaraBajo(id); _ultimo[j] = NaN;   // manda la mano mientras arrastra; al soltar, la cara retoma
      continue;
    }
    if (Number.isNaN(_ultimo[j]) || Math.abs(v - _ultimo[j]) > 1e-3) { setParamBajo(id, v, "cara"); _ultimo[j] = v; }
  }
  if (ev & EV_ACENTO && DBG_CARA.CABECEO_ACENTO) { forzarAcentoProximaNota(); CARA.acentos++; }
  if (ev & EV_GUINO && DBG_CARA.GUINO_PATRON) { siguientePatronBajo(); CARA.guinos++; }
  if (CAL.activo) setEstado("calibrando", CAL.paso, Math.ceil(restanteCal(CAL, tMs / 1000, DBG_CARA.CAL_PASO_S)));
  else setEstado(EST.detectada ? "activa" : "esperando");
}

/** Al desmontar el atril: todo apagado y liberado. */
export function liberarCara(): void { apagarCara(); }
