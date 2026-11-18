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

async function crearSala(): Promise<SalaLK> {
  const lk = await import("livekit-client");   // dinámico: chunk aparte
  const room = new lk.Room({ adaptiveStream: false, dynacast: false, disconnectOnPageLeave: true });
  const locales: { pauseUpstream(): Promise<void>; resumeUpstream(): Promise<void>; currentBitrate: number }[] = [];
  return {
    conectar: (url, token) => room.connect(url, token, { autoSubscribe: false }),
    async publicarVideo(p, cfg) {
      const t = new lk.LocalVideoTrack(p.track as MediaStreamTrack, undefined, true);
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
  video: (modo: ModoLK, cfg: CfgLK) => (modo === "cara" ? pistaWebcam(cfg) ?? pistaOndas(cfg) : pistaOndas(cfg)),
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
}
/** Corta ya: pistas, salida del núcleo y conexión. */
export function detenerLiveKit(): void {
  if (typeof window !== "undefined") window.removeEventListener("pagehide", _alSalir);
  if (_sondeo) { clearInterval(_sondeo); _sondeo = null; }
  _pausado = false;
  PUB.detener();
}
/** Estado para el indicador de Z91 y el menú. */
export function estadoLiveKit(): PublicadorLiveKit { return PUB; }
export function textoEstadoLiveKit(): string {
  const p = PUB;
  return `Diagnóstico: ${p.diagnostico}\nLiveKit: ${p.estado}${p.modo ? ` · modo ${p.modo}` : ""} · pistas ${p.pistas.video ? "video" : "—"}/${p.pistas.audio ? "audio" : "—"}`
    + `${p.estado === "publicando" ? ` · ${p.kbps().toFixed(0)} kbps salientes` : ""} · reconexiones ${p.reconexiones} · errores ${p.errores}`
    + `${_pausado ? " · subida PAUSADA (benchmark)" : ""}`;
}

if (DEBUG_ENABLED && typeof window !== "undefined") {
  (window as unknown as { __livekit?: object }).__livekit = { PUB, DBG_LIVEKIT, publicarLiveKit, detenerLiveKit, textoEstadoLiveKit };
}
