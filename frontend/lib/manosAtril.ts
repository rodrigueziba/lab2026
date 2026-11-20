// Z108: MANOS en los atriles. Une la cámara, el worker de MediaPipe Hand Landmarker (lib/manosWorker.ts), la lógica pura
// (lib/manos.ts: rasgos, postura, pellizco; lib/manoControl.ts: embrague, fórmula, prioridad) y los controles de los
// atriles (puente con components/LecternSystem.tsx: control bajo el cursor, su valor y setCtrl).
//
// PRIVACIDAD: todo local. Cada cuadro se reduce a ANCHO×ALTO con createImageBitmap y se transfiere a un Web Worker de esta
// misma página; vuelve un Float32Array de 134 números (21 puntos por mano). No se sube ni se guarda video, no se transmiten
// los landmarks. El consentimiento y la transmisión de la tarima no cambian (a SILLAS viaja lo mismo que antes).
// Permiso: la cámara se pide SOLO al activar MANOS (botón del atril o menú), nunca al montar.
//
// Cámara: una sola fuente si se puede compartir sin riesgo: (1) la webcam de la tarima (useFaceTracking,
// LIVE_TEX_REF.value.image) si está andando; (2) la de la cara del BA-40 si está encendida; (3) si no, una propia chica
// (640×480 ideal) que se cierra al apagar MANOS o al salir del atril. Las compartidas nunca se cierran desde acá; si su
// dueño las cierra, MANOS lo nota en el cuadro siguiente y busca otra fuente.
// Corre solo con MANOS activado + un atril enfocado + la pestaña visible. Al salir del atril se apaga (worker, cuadros y
// stream propio liberados). Hilo principal por cuadro: createImageBitmap + postMessage (ida) y la lógica pura (vuelta),
// sin allocations propias (mensaje, transferencia y buffer reutilizados; el buffer va y vuelve por transferencia).
import { DBG_MANOS, DBG_RENDIMIENTO } from "@/lib/debugConfig";
import { LIVE_TEX_REF } from "@/lib/faceShared";
import { videoCaraCompartible } from "@/lib/caraBajo";
import { CONSENT } from "@/lib/consentTarimaAcciones";
import {
  crearEstadoManos, reiniciarManos, procesarManos, escribirManoSintetica, vaciarBufManos, N_BUF_MANOS,
} from "@/lib/manos";
import {
  crearAgarre, iniciarAgarre, soltarAgarre, pasoAgarre, esContinuo, embragueActivo, crearCalMano, crearEstadoCalMano,
  iniciarCalMano, cancelarCalMano, pasoCalMano, restanteCalMano, textoLineaManos, errorDeCamara,
  ANUNCIO_ACTIVADO, ANUNCIO_DESACTIVADO, type EstadoManosLinea, type ErrorManos,
} from "@/lib/manoControl";

/** Lo mínimo de un control de atril que necesita MANOS (CtrlDef de LecternSystem lo cumple). */
export interface CtrlManos { id: string; type: string; label: string; min: number; max: number; nombreLargo?: string; paramIdx?: number }

/**
 * Puente con LecternSystem (lo llena ese módulo al cargarse; acá no se importa three ni el atril):
 *  hover / hoverObj: control (y su malla de impacto) bajo el cursor, que actualiza el hover del mouse que ya existe;
 *  leer(def): valor actual del control (el que se ve); aplicar(def, v): la misma vía que el mouse (setCtrl);
 *  mostrar(modo, texto): línea de estado del atril enfocado; boton(v): luz de las pastillas MANOS.
 */
export const PUENTE_MANOS = {
  hover: null as CtrlManos | null,
  hoverObj: null as unknown,
  leer: null as null | ((d: CtrlManos) => number),
  aplicar: null as null | ((d: CtrlManos, v: number) => void),
  mostrar: null as null | ((modo: string, texto: string) => void),
  boton: null as null | ((v: number) => void),
  aria: null as HTMLElement | null,
};

/** Estado leído por el atril, el resalte y el menú. */
export const MANOS = {
  on: false,
  estado: "apagado" as EstadoManosLinea,
  error: "" as ErrorManos,
  errorNombre: "",
  linea: "",
  version: 0,
  fuente: "" as "" | "tarima" | "cara" | "propia" | "simulada",
  rutas: "" as "" | "local" | "cdn",
  modeloCargado: false,
  enviados: 0, recibidos: 0, descartados: 0,
  hzReal: 0,
  msHilo: 0,          // ms del hilo principal por cuadro (envío + lógica + aplicar), media móvil
  msIdaVuelta: 0,     // ms desde que sale el cuadro hasta que vuelve (incluye la inferencia): latencia del worker
  embrague: false,
  tecla: false,
  agarradoId: "",
  agarradoNombre: "",
  agarradoDef: null as CtrlManos | null,
  agarradoObj: null as unknown,
  valor: 0,           // 0…1 del control agarrado
};
export const EST_MANOS = crearEstadoManos();
export const AGARRE = crearAgarre();
export const CAL_MANO = crearCalMano();
const CALM = crearEstadoCalMano();

// URLs: locales (scripts/mediapipe-local.mjs) o el CDN oficial como respaldo (mismo wasm que la cara).
export const RUTA_LOCAL_MANOS = { wasm: "/alight/mediapipe/wasm", modelo: "/alight/mediapipe/hand_landmarker.task" };
export const RUTA_CDN_MANOS = {
  wasm: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm",
  modelo: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
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
let _generacion = 0;
let _buscando = false;
const _opcBitmap: ImageBitmapOptions = { resizeWidth: 320, resizeHeight: 240, resizeQuality: "low" };
const _msg: { tipo: string; img: ImageBitmap | null; t: number; buf: Float32Array | null } = { tipo: "cuadro", img: null, t: 0, buf: null };
const _transfer: Transferable[] = [];
const _bufSim = new Float32Array(N_BUF_MANOS);
const _sim = { lado: "derecha" as "derecha" | "izquierda", espejo: true, cx: 0.5, cy: 0.5, t: 0.2, angulo: 0, abierta: true, pellizco: false, aspecto: 4 / 3 };
let _nuevo = false, _tUltRes = 0, _dtRes = 1 / 30;
let _fpsN = 0, _fpsT0 = 0, _ultimoSim = -1e9;
let _mouseY01 = 0.5;

const ema = (prev: number, x: number): number => (prev === 0 ? x : prev * 0.9 + x * 0.1);
const ahoraMs = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());
function compartiendo(): boolean { return CONSENT.estado === "compartiendo"; }

function anunciar(texto: string): void { const el = PUENTE_MANOS.aria; if (el) el.textContent = texto; }

/** Rearma la línea solo si cambió algo (sin texto nuevo por cuadro mientras nada cambia). */
const _prev = { e: "", err: "", id: "", pct: -1, tx: false, paso: -1, seg: -1 };
function actualizarLinea(e: EstadoManosLinea, modo: string, pasoCal = 0, seg = 0): void {
  const pct = e === "agarrando" ? Math.round(MANOS.valor * 100) : -1;
  const tx = compartiendo();
  if (e === _prev.e && MANOS.error === _prev.err && MANOS.agarradoId === _prev.id && pct === _prev.pct && tx === _prev.tx && pasoCal === _prev.paso && seg === _prev.seg) return;
  _prev.e = e; _prev.err = MANOS.error; _prev.id = MANOS.agarradoId; _prev.pct = pct; _prev.tx = tx; _prev.paso = pasoCal; _prev.seg = seg;
  MANOS.estado = e;
  MANOS.linea = textoLineaManos(e, MANOS.error, MANOS.agarradoNombre, pct, tx, pasoCal, seg);
  MANOS.version++;
  if (MANOS.linea && modo !== "none") PUENTE_MANOS.mostrar?.(modo, MANOS.linea);
}

/** Botón MANOS (pastilla de cada atril) o menú: activa o desactiva. */
export function alternarManos(on: boolean, modo = "none"): void { if (on) encenderManos(modo); else apagarManos(); }

/** Activa MANOS: pide la cámara (o comparte una que ya esté andando) y carga el modelo en el worker. */
export function encenderManos(modo = "none"): void {
  if (MANOS.on) return;
  if (!DBG_MANOS.ACTIVO) { PUENTE_MANOS.boton?.(0); return; }
  MANOS.on = true; _generacion++;
  MANOS.error = ""; MANOS.errorNombre = "";
  MANOS.enviados = MANOS.recibidos = MANOS.descartados = 0; MANOS.msHilo = MANOS.msIdaVuelta = 0; MANOS.hzReal = 0;
  reiniciarManos(EST_MANOS); soltarAgarre(AGARRE); limpiarAgarre();
  PUENTE_MANOS.boton?.(1);
  anunciar(ANUNCIO_ACTIVADO);
  if (DBG_MANOS.SIMULAR) { MANOS.fuente = "simulada"; MANOS.modeloCargado = false; actualizarLinea("sin_mano", modo); return; }
  actualizarLinea("pidiendo", modo);
  void arrancar(_generacion, modo);
}

/** Apaga MANOS: suelta el agarre (el control queda donde está), libera worker, cuadros y el stream si era propio. */
export function apagarManos(estadoFinal: EstadoManosLinea = "apagado", modo = "none"): void {
  const estaba = MANOS.on;
  MANOS.on = false; _generacion++;
  soltarAgarre(AGARRE); limpiarAgarre();
  cancelarCalMano(CALM);
  detenerWorker();
  soltarCamara();
  reiniciarManos(EST_MANOS);
  MANOS.fuente = ""; MANOS.modeloCargado = false; MANOS.tecla = false; MANOS.embrague = false;
  PUENTE_MANOS.boton?.(0);
  if (estaba && estadoFinal === "apagado") anunciar(ANUNCIO_DESACTIVADO);
  actualizarLinea(estadoFinal, modo);
}

/** Error de cámara o del motor: queda apagado con el motivo en la línea de estado. */
function fallar(err: ErrorManos, nombre: string, modo: string): void {
  console.warn(`[MANOS] ${err === "sin_motor" ? "no arrancó el motor de manos" : "no se pudo usar la cámara"}: ${nombre}`);
  apagarManos("error", modo);
  MANOS.error = err; MANOS.errorNombre = nombre;
  _prev.e = ""; actualizarLinea("error", modo);
  anunciar(`Control con manos desactivado: ${MANOS.linea.replace("MANOS: ", "").toLowerCase()}`);
}

/** Calibración rápida (solo modo absoluto): abajo y arriba, CAL_PASO_S cada una. En memoria. */
export function calibrarManos(): void { if (!MANOS.on) return; iniciarCalMano(CALM, ahoraMs() / 1000); }
export function calibrandoManos(): boolean { return CALM.activo; }
/** Reiniciar (menú): seguimiento, agarre y calibración a cero, sin apagar. */
export function reiniciarManosTodo(): void {
  reiniciarManos(EST_MANOS); soltarAgarre(AGARRE); limpiarAgarre(); cancelarCalMano(CALM);
  CAL_MANO.min = 0.2; CAL_MANO.max = 0.8; CAL_MANO.calibrada = false;
  MANOS.enviados = MANOS.recibidos = MANOS.descartados = 0;
}
/** La tecla de embrague (la escribe components/ManosTarima.tsx). */
export function setTeclaEmbrague(abajo: boolean): void { MANOS.tecla = abajo; }
/** Y del mouse en 0…1 (hacia arriba) para "Simular manos" con el mouse. */
export function setMouseSimManos(y01: number): void { _mouseY01 = y01; }
/** ¿La mano tiene agarrado este control? (el mouse no lo mueve mientras tanto). */
export function manoAgarra(id: string): boolean { return MANOS.embrague && AGARRE.agarrado && AGARRE.id === id; }
/** paramIdx (BA-40) del control agarrado por la mano, o −1 (para la prioridad sobre la cara). */
export function paramIdxAgarrado(): number { const d = MANOS.agarradoDef; return AGARRE.agarrado && d && d.paramIdx !== undefined ? d.paramIdx : -1; }

function limpiarAgarre(): void { MANOS.agarradoId = ""; MANOS.agarradoNombre = ""; MANOS.agarradoDef = null; MANOS.agarradoObj = null; }

async function rutas(): Promise<{ wasm: string; modelo: string }> {
  const base = typeof location !== "undefined" ? location.origin : "";
  if (DBG_MANOS.MODELO_LOCAL) {
    try {
      const r = await fetch(RUTA_LOCAL_MANOS.modelo, { method: "HEAD" });
      const w = await fetch(RUTA_LOCAL_MANOS.wasm + "/vision_wasm_internal.wasm", { method: "HEAD" });
      if (r.ok && w.ok) { MANOS.rutas = "local"; return { wasm: base + RUTA_LOCAL_MANOS.wasm, modelo: base + RUTA_LOCAL_MANOS.modelo }; }
    } catch { /* sin archivos locales */ }
  }
  MANOS.rutas = "cdn";
  return RUTA_CDN_MANOS;
}

function videoActivo(v: HTMLVideoElement | null): boolean {
  if (!v) return false;
  const s = v.srcObject as MediaStream | null;
  return v.readyState >= 2 && !!s && s.active;
}
function videoTarima(): HTMLVideoElement | null {
  const tex = LIVE_TEX_REF.value as { image?: unknown } | null;
  const v = tex?.image;
  if (typeof HTMLVideoElement === "undefined" || !(v instanceof HTMLVideoElement)) return null;
  return videoActivo(v) ? v : null;
}

/** Busca una fuente: la de la tarima, la de la cara o una propia (solo esta pide permiso). */
async function conseguirCamara(gen: number, modo: string): Promise<boolean> {
  const vt = videoTarima();
  if (vt) { _video = vt; MANOS.fuente = "tarima"; return true; }
  const vc = videoCaraCompartible();
  if (vc) { _video = vc; MANOS.fuente = "cara"; return true; }
  try {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) throw new DOMException("sin getUserMedia", "NotFoundError");
    const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640, max: 640 }, height: { ideal: 480, max: 480 }, facingMode: "user" }, audio: false });
    if (gen !== _generacion) { s.getTracks().forEach(t => t.stop()); return false; }
    const el = document.createElement("video");
    el.playsInline = true; el.muted = true; el.autoplay = true;
    el.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1";
    document.body.appendChild(el);
    el.srcObject = s;
    await el.play().catch(() => {});
    _stream = s; _videoPropio = el; _video = el; MANOS.fuente = "propia";
    return true;
  } catch (e) {
    const nombre = (e as { name?: string })?.name ?? String(e);
    if (gen === _generacion) fallar(errorDeCamara(nombre), nombre, modo);
    return false;
  }
}

async function arrancar(gen: number, modo: string): Promise<void> {
  if (!(await conseguirCamara(gen, modo)) || gen !== _generacion) return;
  try {
    actualizarLinea("cargando", modo);
    const { wasm, modelo } = await rutas();
    if (gen !== _generacion) return;
    const w = new Worker(new URL("./manosWorker.ts", import.meta.url));
    _worker = w; _listo = false; _enVuelo = false; _buf = new Float32Array(N_BUF_MANOS);
    w.onmessage = alMensaje;
    w.onerror = alErrorWorker;
    w.postMessage({ tipo: "iniciar", wasm, modelo, numManos: 2 });
  } catch (e) {
    if (gen === _generacion) fallar("sin_motor", (e as { name?: string })?.name ?? "Error", modo);
  }
}

/** La fuente compartida dejó de andar (su dueño la cerró): se busca otra sin tocar el worker. */
async function recuperarCamara(gen: number, modo: string): Promise<void> {
  _buscando = true;
  try { await conseguirCamara(gen, modo); } finally { _buscando = false; }
}

function alErrorWorker(e?: ErrorEvent): void {
  if (MANOS.on && MANOS.fuente !== "simulada") fallar("sin_motor", e?.message || "ErrorDelWorker", _modoUlt);
}
let _modoUlt = "none";

/** Resultado del worker (sin allocations: el buffer vuelve y se reutiliza). */
function alMensaje(e: MessageEvent): void {
  const d = e.data as { tipo: string; buf?: Float32Array; motivo?: string };
  if (d.tipo === "resultado" && d.buf) {
    const t0 = ahoraMs();
    _buf = d.buf; _enVuelo = false;
    MANOS.recibidos++;
    MANOS.msIdaVuelta = ema(MANOS.msIdaVuelta, t0 - _tDesde);
    if (MANOS.on && MANOS.fuente !== "simulada") {
      procesarManos(EST_MANOS, d.buf, _tEnvio, DBG_MANOS);
      _dtRes = Math.max(0.001, (_tEnvio - _tUltRes) / 1000); _tUltRes = _tEnvio; _nuevo = true;
      contarFps(t0);
    }
    MANOS.msHilo = ema(MANOS.msHilo, ahoraMs() - t0);
    return;
  }
  if (d.tipo === "listo") { _listo = true; MANOS.modeloCargado = true; return; }
  if (d.tipo === "error") { console.warn("[MANOS] el worker no pudo cargar el modelo:", d.motivo); fallar("sin_motor", "ModeloNoCargado", _modoUlt); }
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
  _video = null;   // las compartidas (tarima, cara) no se cierran desde acá
}

function contarFps(ahora: number): void {
  _fpsN++;
  if (ahora - _fpsT0 >= 1000) { MANOS.hzReal = (_fpsN * 1000) / (ahora - _fpsT0); _fpsN = 0; _fpsT0 = ahora; }
}

// ── por cuadro ──
/**
 * Lo llama components/ManosTarima.tsx en cada cuadro (useFrame). modo = INTERACT_STATE.mode ("none" = sin atril).
 * Manda un cuadro al worker a MANOS_HZ como máximo (uno en vuelo; si está ocupado se descarta, nunca hay cola) o, con
 * SIMULAR, arma una mano sintética; después embrague → agarre → aplicar por la vía del mouse. Sin allocations.
 */
export function tickManos(modo: string, oculta: boolean): void {
  if (!MANOS.on) return;
  _modoUlt = modo;
  if (modo === "none" && !DBG_MANOS.SIMULAR) { apagarManos("apagado", modo); return; }   // salió del atril: todo liberado
  if (oculta) { if (MANOS.tecla) MANOS.tecla = false; return; }                            // pestaña oculta: no corre
  const t0 = ahoraMs();
  const periodo = 1000 / Math.max(1, Math.min(60, DBG_MANOS.MANOS_HZ));
  const simulada = MANOS.fuente === "simulada" || DBG_MANOS.SIMULAR;
  if (simulada) {
    if (t0 - _ultimoSim >= periodo) {
      _ultimoSim = t0;
      llenarSimulacionManos(_bufSim);
      procesarManos(EST_MANOS, _bufSim, t0, DBG_MANOS);
      _dtRes = Math.max(0.001, (t0 - _tUltRes) / 1000); _tUltRes = t0; _nuevo = true;
      contarFps(t0);
    }
  } else if (_worker && _video) {
    if (!videoActivo(_video)) {
      // la fuente compartida se cerró (o la propia se cortó): buscar otra, sin cuadros mientras tanto
      if (!_buscando) { if (_videoPropio) soltarCamara(); _video = null; void recuperarCamara(_generacion, modo); }
    } else if (_listo && t0 - _ultimoEnvio >= periodo && DBG_RENDIMIENTO.SIS.manosTarima !== false) {
      if (_enVuelo || !_buf) {
        MANOS.descartados++;                                   // el worker está ocupado: este cuadro se descarta
        if (_enVuelo && t0 - _tDesde > 3000) { _enVuelo = false; _buf = new Float32Array(N_BUF_MANOS); }   // trabado (raro)
        _ultimoEnvio = t0;
      } else if (_video.videoWidth > 0) {
        _enVuelo = true; _ultimoEnvio = t0; _tEnvio = t0; _tDesde = t0;
        _opcBitmap.resizeWidth = Math.max(64, Math.round(DBG_MANOS.ANCHO_CUADRO));
        _opcBitmap.resizeHeight = Math.max(48, Math.round(DBG_MANOS.ALTO_CUADRO));
        createImageBitmap(_video, _opcBitmap).then(alBitmap, alFalloBitmap);
      }
    }
  } else if (!_worker && !_video && !_buscando && MANOS.estado !== "pidiendo" && MANOS.estado !== "cargando") {
    void recuperarCamara(_generacion, modo);
  }
  controlar(modo, t0);
  MANOS.msHilo = ema(MANOS.msHilo, ahoraMs() - t0);
}

function alBitmap(img: ImageBitmap): void {
  const w = _worker, b = _buf;
  if (!w || !b || !MANOS.on) { img.close(); _enVuelo = false; return; }
  _buf = null;
  _msg.img = img; _msg.t = _tEnvio; _msg.buf = b;
  _transfer.length = 0; _transfer.push(img, b.buffer);
  w.postMessage(_msg, _transfer);
  _msg.img = null; _msg.buf = null; _transfer.length = 0;
  MANOS.enviados++;
}
function alFalloBitmap(): void { _enVuelo = false; }

/** Simulación del menú: una mano derecha plana a SIM_ALTURA (o a la altura del mouse), o ninguna. */
export function llenarSimulacionManos(out: Float32Array): void {
  const S = DBG_MANOS;
  vaciarBufManos(out, 4 / 3);
  if (!S.SIM_MANO_VISTA) return;
  const alt = S.SIM_CON_MOUSE ? _mouseY01 : S.SIM_ALTURA;
  _sim.lado = S.MANO === "izquierda" ? "izquierda" : "derecha";
  _sim.espejo = S.ESPEJO; _sim.t = Math.max(0.02, S.SIM_TAMANO);
  _sim.cx = 0.5; _sim.cy = 1 - Math.max(0, Math.min(1, alt));   // la muñeca a esa altura (la palma queda un poco arriba)
  _sim.angulo = 0; _sim.abierta = true; _sim.pellizco = false; _sim.aspecto = 4 / 3;
  escribirManoSintetica(out, 0, _sim);
}

/** Embrague → agarre → valor → setCtrl por el puente; línea de estado y calibración. */
function controlar(modo: string, tMs: number): void {
  const E = EST_MANOS, D = DBG_MANOS;
  const emb = embragueActivo(MANOS.tecla, E.pellizcoValido, D.SIM_EMBRAGUE, D.EMBRAGUE_PELLIZCO) && modo !== "none";
  if (emb && !MANOS.embrague) {
    // flanco de subida: el control bajo el cursor, si es continuo
    const def = PUENTE_MANOS.hover;
    if (def && esContinuo(def.type) && PUENTE_MANOS.leer) {
      const rango = def.max - def.min;
      const v01 = rango > 0 ? (PUENTE_MANOS.leer(def) - def.min) / rango : 0;
      iniciarAgarre(AGARRE, def.id, v01);
      MANOS.agarradoId = def.id; MANOS.agarradoNombre = def.nombreLargo || def.label; MANOS.agarradoDef = def; MANOS.agarradoObj = PUENTE_MANOS.hoverObj;
      MANOS.valor = AGARRE.valor;
    }
  } else if (!emb && MANOS.embrague) {
    soltarAgarre(AGARRE); limpiarAgarre();   // al soltar: el control se queda donde está
  }
  MANOS.embrague = emb;
  if (_nuevo) {
    _nuevo = false;
    if (AGARRE.agarrado && emb && MANOS.agarradoDef) {
      const v = pasoAgarre(AGARRE, E.valida, E.alturaSalida, E.tamano, _dtRes, D, CAL_MANO);
      if (Number.isFinite(v) && Math.abs(v - MANOS.valor) > 1e-4) {
        MANOS.valor = v;
        const d = MANOS.agarradoDef;
        PUENTE_MANOS.aplicar?.(d, d.min + v * (d.max - d.min));
      }
    }
    if (CALM.activo) pasoCalMano(CALM, E.valida, E.alturaSalida, tMs / 1000, D.CAL_PASO_S, CAL_MANO);
  }
  if (MANOS.estado === "pidiendo" || MANOS.estado === "error") return;
  if (MANOS.estado === "cargando" && !_listo && MANOS.fuente !== "simulada") return;
  if (CALM.activo) actualizarLinea("calibrando", modo, CALM.paso, Math.ceil(restanteCalMano(CALM, tMs / 1000, D.CAL_PASO_S)));
  else if (AGARRE.agarrado) actualizarLinea("agarrando", modo);
  else actualizarLinea(E.postura ? "lista" : "sin_mano", modo);
}

/** Al desmontar los atriles: todo apagado y liberado. */
export function liberarManos(): void { apagarManos(); }
