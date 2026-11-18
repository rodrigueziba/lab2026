// Z92: publica el video y el audio de la tarima en LiveKit Cloud (opción A de docs/EVALUACION_CONEXION_VIVO.md, decisión
// del usuario), solo después de "Compartir mi sesión." (Z91). Ciclo de vida puro en lib/vivo/liveKitCiclo.ts.
//  - livekit-client se carga con import() dinámico al publicar: no pesa en el resto de la experiencia.
//  - Token: POST /api/livekit/token { rol: "publicar", sesionId } (app/api/livekit/token/route.ts). 503/429/red → "sin
//    conexión" sin errores ruidosos. Identidad = el mismo sesionId de la presencia (Z89); sala fija del servidor.
//  - Video: "cara" = CLON de la pista de la webcam (cortar no apaga la cámara local), máx. 640×360 a VIDEO_FPS;
//    "privado" (o sin webcam) = canvas de ondas de Z87 con captureStream(VIDEO_FPS). Bitrate máx. VIDEO_KBPS, sin simulcast.
//  - Audio: obtenerSalidaTransmisible() del núcleo (bus maestro: mp3, efectos, caja de ritmos). Sin micrófono. Estéreo,
//    AUDIO_KBPS. Al cortar se libera el MediaStreamAudioDestinationNode (sin transmisión no existe ni cuesta).
//  - Nada de esto cambia cómo suena ni cómo se ve la tarima localmente (son ramas y clones).
//  - Se detiene con el corte de Z91 (botón, X, límite, salir de la tarima) y en pagehide.
//  - Benchmark (Z66): DBG_RENDIMIENTO.SIS.transmisionTarima = false pausa la subida (pauseUpstream) sin desconectar.
import { DBG_LIVEKIT, DBG_RENDIMIENTO, DEBUG_ENABLED } from "@/lib/debugConfig";
import { obtenerSalidaTransmisible, liberarSalidaTransmisible } from "@/lib/audio/nucleo";
import { LIVE_TEX_REF } from "@/lib/faceShared";
import { FUENTE_TARIMA, texturaTarima } from "@/lib/fuenteVideoTarima";
import { TransmisionProcesada, RespaldoVideo, elegirFuenteVideo, normalizarFuenteVideo, type FabricaLienzo } from "./videoProcesado";   // Z94 · Z94c
import { PublicadorLiveKit, MOTIVO_TOKEN, motivoPorEstado, leerRespuestaToken, type DepsLK, type SalaLK, type PistaLK, type CfgLK, type ModoLK, type RespuestaToken, type ResultadoLK } from "./liveKitCiclo";

// Z92b: el cliente NO lee ninguna variable: pide el token primero y conecta con la url que devuelve el servidor.
// Motivos de falla para el diagnóstico (sin datos sensibles): MOTIVO_TOKEN en liveKitCiclo.ts.
async function pedirToken(sesionId: string): Promise<RespuestaToken> {
  let r: Response;
  try {
    r = await fetch("/api/livekit/token", {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      body: JSON.stringify({ rol: "publicar", sesionId }),
    });
  } catch { return { ok: false, motivo: MOTIVO_TOKEN.sinRed }; }
  if (!r.ok) return { ok: false, motivo: motivoPorEstado(r.status) };
  try { return leerRespuestaToken(await r.json()); } catch { return { ok: false, motivo: MOTIVO_TOKEN.invalida }; }
}

function pistaWebcam(cfg: CfgLK): PistaLK | null {
  const tex = LIVE_TEX_REF.value as { image?: HTMLVideoElement } | null;
  const ms = tex?.image?.srcObject as MediaStream | null | undefined;
  const orig = ms?.getVideoTracks?.()[0];
  if (!orig || orig.readyState !== "live") return null;
  const t = orig.clone();   // la cámara local sigue igual al cortar
  t.applyConstraints({ width: { max: 640 }, height: { max: 360 }, frameRate: { max: Math.max(1, cfg.VIDEO_FPS) } }).catch(() => {});
  return { track: t, liberar: () => t.stop() };
}
function pistaOndas(cfg: CfgLK): PistaLK | null {
  texturaTarima();   // asegura el canvas si la fuente son las ondas
  const cv = FUENTE_TARIMA.ondas?.cv;
  if (!cv || typeof cv.captureStream !== "function") return null;
  const st = cv.captureStream(Math.max(1, Math.min(30, cfg.VIDEO_FPS)));
  const t = st.getVideoTracks()[0];
  if (!t) return null;
  return { track: t, liberar: () => st.getTracks().forEach(x => x.stop()) };
}

// ── Z94/Z94b: video procesado (la imagen del domo de la tarima) ──
// Z94b: canvas 2D único + buffer único (compartido con un ImageData único) + captureStream(0) con requestFrame por
// actualización (Z94 usaba captureStream(fps) y la pista no emitía nada si el canvas nunca cambiaba). Nace con un cuadro
// negro ya pedido, así la pista nunca está vacía.
const FABRICA_LIENZO: FabricaLienzo = {
  crear(ancho, alto) {
    if (typeof document === "undefined") return null;
    const cv = document.createElement("canvas");
    cv.width = ancho; cv.height = alto;
    const ctx = cv.getContext("2d", { alpha: false });
    if (!ctx || typeof cv.captureStream !== "function") return null;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, ancho, alto);
    const buffer = new Uint8Array(ancho * alto * 4);
    const imagen = new ImageData(new Uint8ClampedArray(buffer.buffer), ancho, alto);   // misma memoria que buffer
    const st = cv.captureStream(0);
    const pista = st.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined;
    if (!pista || typeof pista.requestFrame !== "function") { st.getTracks().forEach(t => t.stop()); return null; }
    pista.requestFrame();   // primer cuadro (negro) antes de publicar
    return {
      canvas: cv, ctx, pista, buffer,
      pintar: () => { ctx.putImageData(imagen, 0, 0); pista.requestFrame(); },
      detenerPista: () => st.getTracks().forEach(t => t.stop()),
      quitar: () => { cv.remove(); cv.width = 0; cv.height = 0; },
    };
  },
};
/** Pase procesado: lo dibuja components/VideoTransmitidoTarima.tsx (useFrame) mientras `activa`. */
export const TX_PROC = new TransmisionProcesada(FABRICA_LIENZO, () => performance.now());
/** Lo escribe el host del Canvas cada cuadro: el domo de la tarima y su material están listos para el pase. */
export const PASE_HOST = { listo: false };
/** Fuente de video efectiva de la transmisión actual (menú). */
export const VIDEO_TX = { efectiva: "" as string, motivo: "", cambiando: false };
/** Z94c: respaldo reversible (procesado ⇄ cruda) con reintentos en segundo plano. */
export const RESPALDO = new RespaldoVideo(DBG_LIVEKIT);
const pistaDeTxProc = (track: unknown): PistaLK => ({ track, liberar: () => TX_PROC.liberar() });
function pistaProcesada(cfg: CfgLK): PistaLK | null {
  const r = TX_PROC.iniciar(DBG_LIVEKIT.PROCESADO_ANCHO, DBG_LIVEKIT.PROCESADO_ALTO, cfg.VIDEO_FPS);
  return r ? pistaDeTxProc(r.track) : null;
}
function webcamViva(): boolean {
  const ms = (LIVE_TEX_REF.value as { image?: HTMLVideoElement } | null)?.image?.srcObject as MediaStream | null | undefined;
  return ms?.getVideoTracks?.()[0]?.readyState === "live";
}
const _disp = { procesado: false, webcam: false, ondas: true };
function pistaVideo(modo: ModoLK, cfg: CfgLK): PistaLK | null {
  _disp.procesado = PASE_HOST.listo; _disp.webcam = webcamViva();
  const el = elegirFuenteVideo(DBG_LIVEKIT.FUENTE_VIDEO, modo, _disp);
  VIDEO_TX.motivo = el.motivo;
  RESPALDO.reiniciar(normalizarFuenteVideo(DBG_LIVEKIT.FUENTE_VIDEO) === "procesado" ? "procesado" : "inactivo");
  if (el.efectiva === "procesado") {
    const p = pistaProcesada(cfg);
    if (p) { VIDEO_TX.efectiva = "procesado"; TX_PROC.publicando = true; return p; }
    VIDEO_TX.motivo = TX_PROC.fallo || "falló el pase procesado";   // respaldo: como Z92
  }
  // Z94c: pedido "procesado" pero no disponible al iniciar (p. ej. el domo todavía no existe) → arranca en cruda y reintenta
  if (RESPALDO.estado === "procesado") RESPALDO.fallo(performance.now(), VIDEO_TX.motivo || "pase procesado no disponible");
  if (el.efectiva === "ondas") { VIDEO_TX.efectiva = "ondas"; return pistaOndas(cfg); }
  return pistaCruda(modo, cfg);
}
/** "cruda" de Z92: modo cara → clon de la webcam; si no (o sin webcam) → ondas. Escribe VIDEO_TX.efectiva. */
function pistaCruda(modo: ModoLK, cfg: CfgLK): PistaLK | null {
  const w = modo === "cara" ? pistaWebcam(cfg) : null;
  if (w) { VIDEO_TX.efectiva = "cruda"; return w; }
  VIDEO_TX.efectiva = "ondas";
  return pistaOndas(cfg);
}
/** Z94b/Z94c: respaldo en caliente: reemplaza la pista procesada por la cruda en el mismo publicador (audio y sesión
 *  siguen) y agenda el reintento (RespaldoVideo). */
async function pasarACruda(motivo: string): Promise<void> {
  if (VIDEO_TX.cambiando || RESPALDO.estado !== "procesado") return;
  VIDEO_TX.cambiando = true;
  const antes = VIDEO_TX.efectiva;
  const p = pistaCruda(PUB.modo ?? "privado", DBG_LIVEKIT);
  const ok = p ? await PUB.cambiarVideo(p) : false;
  if (ok) { RESPALDO.fallo(performance.now(), motivo); VIDEO_TX.motivo = `procesado falló: ${motivo} → ${VIDEO_TX.efectiva}`; }
  else { VIDEO_TX.efectiva = antes; VIDEO_TX.motivo = `procesado falló: ${motivo} (no se pudo reemplazar la pista)`; }
  VIDEO_TX.cambiando = false;
}
/** Z94c: en cruda, prueba el procesado EN SEGUNDO PLANO (sin publicarlo) y, si da cuadros CONFIRMAR_S, lo vuelve a poner. */
async function tickRespaldo(ahora: number): Promise<void> {
  if (VIDEO_TX.cambiando || !PUB.pistas.video || (PUB.estado !== "publicando" && PUB.estado !== "reconectando")) return;
  const pausa = DBG_RENDIMIENTO.SIS.videoTransmitidoTarima === false;
  if (RESPALDO.debeProbar(ahora, PASE_HOST.listo && !pausa)) {
    if (!TX_PROC.iniciar(DBG_LIVEKIT.PROCESADO_ANCHO, DBG_LIVEKIT.PROCESADO_ALTO, DBG_LIVEKIT.VIDEO_FPS)) RESPALDO.pruebaFallida(ahora, TX_PROC.fallo || "no se pudo crear el canvas");
    return;
  }
  if (RESPALDO.estado !== "probando") return;
  const r = RESPALDO.evaluar(ahora, TX_PROC.pintados, TX_PROC.fps, TX_PROC.vigilar(ahora, DBG_LIVEKIT.PROCESADO_TIMEOUT_S, pausa));
  if (r === "seguir") return;
  const pista = TX_PROC.lienzo?.pista;
  if (r === "fallar" || !pista) {
    const m = TX_PROC.fallo || (TX_PROC.pintados ? "cuadros insuficientes" : "sin cuadros en la prueba");
    TX_PROC.liberar(); RESPALDO.pruebaFallida(ahora, m);
    return;
  }
  VIDEO_TX.cambiando = true;
  const ok = await PUB.cambiarVideo(pistaDeTxProc(pista));   // libera la cruda; sin reconectar ni tocar el audio
  if (ok) { RESPALDO.confirmado(); VIDEO_TX.efectiva = "procesado"; VIDEO_TX.motivo = ""; TX_PROC.publicando = true; }
  else { RESPALDO.pruebaFallida(performance.now(), "no se pudo reemplazar la pista"); }   // cambiarVideo ya liberó el lienzo
  VIDEO_TX.cambiando = false;
}

async function crearSala(): Promise<SalaLK> {
  const lk = await import("livekit-client");   // dinámico: chunk aparte
  const room = new lk.Room({ adaptiveStream: false, dynacast: false, disconnectOnPageLeave: true });
  const locales: { pauseUpstream(): Promise<void>; resumeUpstream(): Promise<void>; currentBitrate: number }[] = [];
  let videoLocal: import("livekit-client").LocalVideoTrack | null = null;
  return {
    // Z94b: mismo LocalVideoTrack y misma publicación; solo cambia el MediaStreamTrack (sin reconectar)
    async reemplazarVideo(p) {
      if (!videoLocal) throw new Error("sin video publicado");
      await videoLocal.replaceTrack(p.track as MediaStreamTrack, true);
    },
    conectar: (url, token) => room.connect(url, token, { autoSubscribe: false }),
    async publicarVideo(p, cfg) {
      const t = new lk.LocalVideoTrack(p.track as MediaStreamTrack, undefined, true);
      videoLocal = t;
      await room.localParticipant.publishTrack(t, {
        source: lk.Track.Source.Camera, simulcast: false, name: "tarima-video",
        videoEncoding: { maxBitrate: Math.max(50, cfg.VIDEO_KBPS) * 1000, maxFramerate: Math.max(1, cfg.VIDEO_FPS) },
      });
      locales.push(t);
    },
    async publicarAudio(p, cfg) {
      const t = new lk.LocalAudioTrack(p.track as MediaStreamTrack, undefined, true);
      await room.localParticipant.publishTrack(t, {
        source: lk.Track.Source.Microphone, name: "tarima-audio", forceStereo: true, dtx: false, red: false,
        audioPreset: { maxBitrate: Math.max(16, cfg.AUDIO_KBPS) * 1000 },
      });
      locales.push(t);
    },
    alEvento(cb) {
      room.on(lk.RoomEvent.Reconnecting, () => cb("reconectando"));
      room.on(lk.RoomEvent.Reconnected, () => cb("reconectado"));
      room.on(lk.RoomEvent.Disconnected, () => cb("desconectado"));
    },
    pausar(p) { for (const t of locales) (p ? t.pauseUpstream() : t.resumeUpstream()).catch(() => {}); },
    kbps() { let s = 0; for (const t of locales) s += t.currentBitrate || 0; return s / 1000; },
    desconectar() { room.removeAllListeners(); void room.disconnect(true).catch(() => {}); },
  };
}

const DEPS: DepsLK = {
  pedirToken,
  crearSala,
  video: (modo: ModoLK, cfg: CfgLK) => pistaVideo(modo, cfg),   // Z94: procesado / cruda (Z92) / ondas
  audio: () => {
    try {
      const n = obtenerSalidaTransmisible();
      const t = n.stream.getAudioTracks()[0];
      return t ? { track: t, liberar: liberarSalidaTransmisible } : (liberarSalidaTransmisible(), null);
    } catch { return null; }
  },
};

const PUB = new PublicadorLiveKit(DEPS, DBG_LIVEKIT);
let _pausado = false;
let _sondeo: ReturnType<typeof setInterval> | null = null;
const _alSalir = () => detenerLiveKit();

/** Publica (solo con consentimiento explícito). */
export function publicarLiveKit(p: { consentimiento: boolean; modo: ModoLK; sesionId: string }): ResultadoLK {
  if (typeof window === "undefined") return { ok: false, motivo: "sin navegador" };
  const r = PUB.iniciar(p);
  if (r.ok) {
    window.addEventListener("pagehide", _alSalir);
    if (!_sondeo) _sondeo = setInterval(sondear, 500);   // benchmark: pausa/reanuda la subida según SIS.transmisionTarima
  }
  return r;
}
function sondear(): void {
  const pausa = DBG_RENDIMIENTO.SIS.transmisionTarima === false;
  if (pausa !== _pausado) { _pausado = pausa; PUB.pausar(pausa); }
  // Z94b: vigía del video procesado → respaldo "cruda" en caliente
  const ahora = performance.now();
  if (RESPALDO.estado === "procesado" && VIDEO_TX.efectiva === "procesado" && TX_PROC.activa && PUB.pistas.video) {
    const m = TX_PROC.vigilar(ahora, DBG_LIVEKIT.PROCESADO_TIMEOUT_S, DBG_RENDIMIENTO.SIS.videoTransmitidoTarima === false);
    if (m) void pasarACruda(m);
  } else if (RESPALDO.estado === "cruda" || RESPALDO.estado === "probando") void tickRespaldo(ahora);   // Z94c
  // Z94c: la publicación se cayó sola (sin conexión): una prueba en segundo plano no queda viva
  if (RESPALDO.estado === "probando" && !PUB.activo && !VIDEO_TX.cambiando) { TX_PROC.liberar(); RESPALDO.reiniciar("inactivo"); }
  actualizarPanelCuadro();
}
/** Corta ya: pistas, salida del núcleo y conexión. */
export function detenerLiveKit(): void {
  if (typeof window !== "undefined") window.removeEventListener("pagehide", _alSalir);
  if (_sondeo) { clearInterval(_sondeo); _sondeo = null; }
  _pausado = false;
  PUB.detener();
  TX_PROC.liberar();                 // Z94c: una prueba en segundo plano (no publicada) también se suelta
  RESPALDO.reiniciar("inactivo");    // Z94c: sin reintentos pendientes
  VIDEO_TX.cambiando = false;
  actualizarPanelCuadro();
}

// ── Z94b: panel de debug "Ver el cuadro procesado" (oculto por defecto): muestra el canvas que se transmite ──
let _panel: HTMLDivElement | null = null, _panelTxt: HTMLDivElement | null = null, _panelCv: unknown = null;
export function panelCuadroVisible(): boolean { return _panel !== null; }
export function alternarPanelCuadro(): void {
  if (typeof document === "undefined") return;
  if (_panel) { _panel.remove(); _panel = null; _panelTxt = null; _panelCv = null; return; }
  const d = document.createElement("div");
  d.setAttribute("data-debug-panel", "");
  d.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:9400;background:#2A1400;border:2px solid #FF9A1F;padding:6px;"
    + "font:12px ui-monospace,Menlo,monospace;color:#FF9A1F;display:flex;flex-direction:column;gap:4px;pointer-events:none";
  const t = document.createElement("div");
  d.append(t);
  document.body.appendChild(d);
  _panel = d; _panelTxt = t; _panelCv = null;
  actualizarPanelCuadro();
}
function actualizarPanelCuadro(): void {
  if (!_panel || !_panelTxt) return;
  const cv = TX_PROC.lienzo?.canvas as HTMLCanvasElement | undefined;
  if (cv !== _panelCv) {
    if (_panelCv) (_panelCv as HTMLCanvasElement).remove();
    if (cv) { cv.style.cssText = "width:320px;height:180px;display:block;background:#000"; _panel.append(cv); }
    _panelCv = cv ?? null;
  }
  _panelTxt.textContent = cv ? `CUADRO PROCESADO (lo que viaja) · ${TX_PROC.cadencia.fpsReal.toFixed(1)} fps · lectura ${TX_PROC.estadoLectura}`
    : `sin video procesado ahora (${VIDEO_TX.efectiva ? `fuente ${VIDEO_TX.efectiva}` : "sin transmisión"})`;
}
/** Estado para el indicador de Z91 y el menú. */
export function estadoLiveKit(): PublicadorLiveKit { return PUB; }
export function textoEstadoLiveKit(): string {
  const p = PUB;
  return `Diagnóstico: ${p.diagnostico}\nLiveKit: ${p.estado}${p.modo ? ` · modo ${p.modo}` : ""} · pistas ${p.pistas.video ? "video" : "—"}/${p.pistas.audio ? "audio" : "—"}`
    + `${p.estado === "publicando" ? ` · ${p.kbps().toFixed(0)} kbps salientes` : ""} · reconexiones ${p.reconexiones} · errores ${p.errores}`
    + `${_pausado ? " · subida PAUSADA (benchmark)" : ""}`
    + (p.pistas.video ? `\nVideo: ${VIDEO_TX.efectiva || "—"}${TX_PROC.activa ? ` · pase ${textoPase()} · ${TX_PROC.cadencia.fpsReal.toFixed(1)} fps${TX_PROC.publicando ? " publicados" : " (prueba en segundo plano)"} · ${TX_PROC.ancho}×${TX_PROC.alto} · lectura ${textoLectura()}` : ""}`
      + `${VIDEO_TX.motivo ? ` · ${VIDEO_TX.motivo.startsWith("procesado falló") ? "" : "respaldo: "}${VIDEO_TX.motivo}` : ""}`
      + `\nProcesados publicados ${TX_PROC.publicadosTotal} · a cruda ${RESPALDO.aCruda} · de vuelta a procesado ${RESPALDO.aProcesado}${textoRespaldo()}` : "");
}
function textoPase(): string {
  const T = TX_PROC;
  return T.pase === "dibujando" ? "dibujando" : `${T.pase}${T.motivoPase ? ` (${T.motivoPase})` : ""}`;
}
function textoRespaldo(): string {
  const R = RESPALDO, ahora = performance.now();
  if (R.estado === "inactivo" || (R.estado === "procesado" && !R.aCruda)) return "";
  const falta = R.faltaS(ahora);
  return ` · respaldo ${R.estado === "cruda_final" ? "en cruda (sin más reintentos)" : R.estado === "probando" ? "probando el procesado" : R.estado}`
    + ` · reintentos ${R.reintentos}/${Math.floor(DBG_LIVEKIT.PROCESADO_MAX_REINTENTOS)}${falta >= 0 ? ` · próximo en ${falta.toFixed(0)} s` : ""}`
    + `${R.ultimoMotivo ? ` · último fallo: ${R.ultimoMotivo}` : ""}`;
}
function textoLectura(): string {
  const T = TX_PROC;
  if (T.estadoLectura === "falló") return `falló: ${T.motivoLectura}`;
  if (T.estadoLectura === "saltando") return `saltando cuadros (${T.saltados})`;
  if (T.estadoLectura === "ok") return `ok (${T.lecturas})${T.colgadas ? ` · colgadas ${T.colgadas}` : ""}`;
  return T.fallo ? `esperando · ${T.fallo}` : "esperando";
}

if (DEBUG_ENABLED && typeof window !== "undefined") {
  (window as unknown as { __livekit?: object }).__livekit = { PUB, DBG_LIVEKIT, publicarLiveKit, detenerLiveKit, textoEstadoLiveKit };
}
