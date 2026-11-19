// Z93: recepción real de la tarima en SILLAS (LiveKit, rol "escuchar"). Ciclo de vida puro en lib/vivo/recibirCiclo.ts.
//  - livekit-client se carga con import() dinámico SOLO al conectar: el espectador que nunca recibe no lo descarga.
//  - Token: POST /api/livekit/token { rol: "escuchar", sesionId } (TTL 10 min). 503 → "sin servidor" sin errores en consola.
//  - autoSubscribe false: el ciclo suscribe audio/video según kSonido/kVideo (RemoteTrackPublication.setSubscribed).
//  - Audio: la pista remota → MediaStreamAudioSourceNode → nodo estable que SesionLiveKit.getAudio(ctx) entrega a
//    vizAudio.setMezclaRemota (ganancia remota: equal-power; el tiempo detenido solo toca el <audio> propio). Contorno de
//    Chrome (CONTORNO_ELEMENTO_AUDIO): la misma pista en un <audio> SILENCIADO fuera de pantalla. Nada suena dos veces.
//  - Video: la pista remota → <video> oculto (muted, playsInline, autoplay) → crearFuenteVideo del domo (Z83/Z84).
import { DBG_LIVEKIT_RECIBIR } from "@/lib/debugConfig";
import { leerRespuestaToken } from "./liveKitCiclo";
import {
  ReceptorLiveKit, MediosRemotos, textoRx,
  type SalaRx, type TokenRx, type TipoPista, type EventoRx, type EntornoMedios, type ElementoMedio, type EntradaRx,
} from "./recibirCiclo";

async function pedirToken(sesionId: string): Promise<TokenRx> {
  let r: Response;
  try {
    r = await fetch("/api/livekit/token", {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      body: JSON.stringify({ rol: "escuchar", sesionId }),
    });
  } catch { return { ok: false, estado: 0, motivo: "sin red al pedir el token" }; }
  if (!r.ok) return { ok: false, estado: r.status, motivo: r.status === 503 ? "servidor sin claves (503)" : `pedido de token rechazado (${r.status})` };
  try {
    const t = leerRespuestaToken(await r.json());
    return t.ok ? t : { ok: false, estado: 500, motivo: "respuesta del token inválida" };
  } catch { return { ok: false, estado: 500, motivo: "respuesta del token inválida" }; }
}

const ENTORNO: EntornoMedios = {
  crear(tag) {
    const el = document.createElement(tag);
    el.muted = true; el.autoplay = true;
    el.setAttribute("playsinline", ""); el.setAttribute("aria-hidden", "true");
    if (tag === "video") (el as HTMLVideoElement).playsInline = true;
    // fuera de pantalla (no display:none: algunos navegadores dejan de decodificar)
    el.style.cssText = "position:fixed;left:-10000px;top:0;width:2px;height:2px;opacity:0;pointer-events:none";
    document.body.appendChild(el);
    return el as unknown as ElementoMedio;
  },
  stream: pista => new MediaStream([pista as MediaStreamTrack]),
};

type LK = typeof import("livekit-client");
type Pub = import("livekit-client").RemoteTrackPublication;

/** Sala de livekit-client adaptada a SalaRx. Las publicaciones se cachean al llegar eventos (nada se recorre por cuadro). */
async function crearSala(medios: MediosRemotos): Promise<SalaRx> {
  const lk: LK = await import("livekit-client");
  const room = new lk.Room({ adaptiveStream: false, dynacast: false, disconnectOnPageLeave: true });
  const pubs: Record<TipoPista, Pub | null> = { audio: null, video: null };
  const refrescar = () => {
    pubs.audio = null; pubs.video = null;
    for (const p of room.remoteParticipants.values()) {          // solo en eventos (no por cuadro)
      for (const pub of p.trackPublications.values()) {
        if (pub.kind === lk.Track.Kind.Audio) pubs.audio = pub;   // una sola tarima: la última publicación gana
        else if (pub.kind === lk.Track.Kind.Video) pubs.video = pub;
      }
    }
    if (!pubs.audio?.track) medios.ponerAudio(null, false);
    if (!pubs.video?.track) medios.ponerVideo(null);
  };
  const alSuscrita = (track: import("livekit-client").RemoteTrack) => {
    if (track.kind === lk.Track.Kind.Audio) medios.ponerAudio(track.mediaStreamTrack, DBG_LIVEKIT_RECIBIR.CONTORNO_ELEMENTO_AUDIO);
    else if (track.kind === lk.Track.Kind.Video) medios.ponerVideo(track.mediaStreamTrack);
  };
  const alDesuscrita = (track: import("livekit-client").RemoteTrack) => {
    if (track.kind === lk.Track.Kind.Audio) medios.ponerAudio(null, false);
    else if (track.kind === lk.Track.Kind.Video) medios.ponerVideo(null);
  };
  room.on(lk.RoomEvent.TrackSubscribed, alSuscrita);
  room.on(lk.RoomEvent.TrackUnsubscribed, alDesuscrita);
  room.on(lk.RoomEvent.TrackPublished, refrescar);
  room.on(lk.RoomEvent.TrackUnpublished, refrescar);
  room.on(lk.RoomEvent.ParticipantConnected, refrescar);
  room.on(lk.RoomEvent.ParticipantDisconnected, refrescar);   // la tarima se fue → sin pistas → estática
  const llega = (t: TipoPista): boolean => {
    const m = pubs[t]?.track?.mediaStreamTrack;
    return !!m && m.readyState === "live" && !m.muted;
  };
  return {
    conectar: async (url, token) => { await room.connect(url, token, { autoSubscribe: false }); refrescar(); },
    alEvento(cb: (e: EventoRx) => void) {
      room.on(lk.RoomEvent.Reconnecting, () => cb("reconectando"));
      room.on(lk.RoomEvent.Reconnected, () => cb("reconectado"));
      room.on(lk.RoomEvent.Disconnected, () => cb("desconectado"));
    },
    hayPista: t => pubs[t] !== null,
    suscribir: (t, si) => { try { pubs[t]?.setSubscribed(si); } catch { /* publicación ya no está */ } },
    llega,
    kbps() { return ((pubs.audio?.track?.currentBitrate ?? 0) + (pubs.video?.track?.currentBitrate ?? 0)) / 1000; },
    desconectar() {
      room.removeAllListeners();
      void room.disconnect(true).catch(() => {});
      medios.ponerAudio(null, false); medios.ponerVideo(null);
    },
  };
}

/** Recepción de una sesión: receptor + medios. Una por SesionLiveKit; liberar() al desecharla. */
export interface Recepcion {
  readonly receptor: ReceptorLiveKit;
  readonly medios: MediosRemotos;
  tick(e: EntradaRx): void;
  liberar(): void;
}
export function crearRecepcion(idOyente: () => string): Recepcion {
  const medios = new MediosRemotos(typeof document === "undefined"
    ? { crear: () => { throw new Error("sin DOM"); }, stream: () => null }
    : ENTORNO);
  const receptor = new ReceptorLiveKit({ pedirToken: () => pedirToken(idOyente()), crearSala: () => crearSala(medios) }, DBG_LIVEKIT_RECIBIR);
  return {
    receptor, medios,
    tick: e => receptor.tick(e),
    liberar() { receptor.detener(); medios.liberar(); },
  };
}

/** Línea del menú (sin datos sensibles). */
export function textoRecepcion(r: Recepcion | null, fuente: string): string {
  if (!r) return `recepción: ${fuente === "mock" ? "fuente mock (sin LiveKit)" : fuente === "supabase" ? "fuente supabase (patrones de prueba)" : "sin sesión LiveKit"}`;
  const x = r.receptor;
  return `recepción: ${textoRx(x)} · pistas suscritas ${x.sus.audio ? "audio" : "—"}/${x.sus.video ? "video" : "—"} · ${x.kbps().toFixed(0)} kbps · reconexiones ${x.reconexiones} · errores ${x.errores}${x.motivo && x.estado !== "error" ? ` (${x.motivo})` : ""} · medios vivos ${r.medios.vivos}`;
}
