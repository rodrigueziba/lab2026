// Z92: reglas del token de LiveKit (app/api/livekit/token/route.ts). Lógica PURA y SIN imports: se prueba en Node
// (scripts/livekit-test.mjs). La ruta solo agrega la firma (livekit-server-sdk) y las variables del servidor.
//
// RIESGOS DEL TOKEN (y qué se hace en esta etapa):
//  - Cualquiera puede pedir un token de PUBLICACIÓN: la ruta es pública porque la experiencia no tiene usuarios. Con él
//    se puede mandar audio y video a la sala, que verán las personas del camino SILLAS.
//    Mitigaciones: sala fija del servidor (el cliente no la elige); permisos mínimos (publicar = solo cámara y audio, sin
//    datos, sin suscribirse: no puede ver ni escuchar a nadie; escuchar = sin publicar); TTL corto (publicar:
//    DURACION_MAX_S + 60 s); límite de pedidos por IP (20 por minuto); validación estricta de la solicitud; respuestas
//    de error genéricas. El oyente (otra tarea) puede además exigir la presencia de Z89 con el mismo sesionId.
//  - Qué NO se puede evitar ahora: que alguien con un script pida tokens válidos desde varias IP o publique contenido
//    inapropiado durante el TTL; el límite por IP vive en la memoria de cada instancia del servidor (en Vercel cada
//    instancia tiene el suyo y se reinicia en frío). Hace falta moderación (interruptor remoto, docs g) o identidad.
//  - Identidad = sesionId: como el sesionId viaja en la presencia pública (Z89), alguien podría pedir un token con el
//    sesionId de otra persona; LiveKit desconecta al participante anterior con la misma identidad. Se acota con el TTL y
//    el límite, y la tarima lo ve como "SIN CONEXIÓN" (no se rompe).
//  - El secreto (LIVEKIT_API_SECRET) y la clave nunca salen del servidor; solo la URL es pública (NEXT_PUBLIC_LIVEKIT_URL).

export const SALA_POR_DEFECTO = "alight-tarima-v1";
export const DURACION_MAX_SERVIDOR_S = 300;          // = DBG_CONSENT.DURACION_MAX_S por defecto (Z91)
export const TTL_PUBLICAR_S = DURACION_MAX_SERVIDOR_S + 60;
export const TTL_ESCUCHAR_S = 10 * 60;
export const LIMITE_POR_MINUTO = 20;
export type RolToken = "publicar" | "escuchar";
const RE_ID = /^[A-Za-z0-9_-]{8,64}$/;
const RE_SALA = /^[A-Za-z0-9_-]{1,64}$/;

export type Solicitud = { ok: true; rol: RolToken; sesionId: string } | { ok: false };
/** Exactamente { rol, sesionId }: tipos, largo y caracteres permitidos; cualquier otra clave se rechaza. */
export function validarSolicitud(x: unknown): Solicitud {
  if (!x || typeof x !== "object" || Array.isArray(x)) return { ok: false };
  const o = x as Record<string, unknown>;
  const claves = Object.keys(o);
  if (claves.length !== 2 || !claves.includes("rol") || !claves.includes("sesionId")) return { ok: false };
  if (o.rol !== "publicar" && o.rol !== "escuchar") return { ok: false };
  if (typeof o.sesionId !== "string" || !RE_ID.test(o.sesionId)) return { ok: false };
  return { ok: true, rol: o.rol, sesionId: o.sesionId };
}

/** Sala del servidor (variable opcional LIVEKIT_SALA validada; si no, la fija). El cliente nunca la elige. */
export function salaServidor(v: string | undefined): string {
  return v && RE_SALA.test(v) ? v : SALA_POR_DEFECTO;
}

export interface Permisos {
  room: string; roomJoin: true; canPublish: boolean; canSubscribe: boolean; canPublishData: false;
  fuentes: ("camera" | "microphone")[];   // la ruta las pasa a TrackSource.CAMERA / MICROPHONE
}
export function permisosPorRol(rol: RolToken, sala: string): Permisos {
  return rol === "publicar"
    ? { room: sala, roomJoin: true, canPublish: true, canSubscribe: false, canPublishData: false, fuentes: ["camera", "microphone"] }
    : { room: sala, roomJoin: true, canPublish: false, canSubscribe: true, canPublishData: false, fuentes: [] };
}
export function ttlPorRol(rol: RolToken): number { return rol === "publicar" ? TTL_PUBLICAR_S : TTL_ESCUCHAR_S; }

/** IP del pedido (primer valor de x-forwarded-for, o x-real-ip). Sin IP: un balde común "sin-ip". */
export function ipDe(xff: string | null, real: string | null): string {
  const a = (xff ?? "").split(",")[0].trim();
  const ip = a || (real ?? "").trim();
  return ip && ip.length <= 64 ? ip : "sin-ip";
}

/** Límite por IP en ventana fija de 60 s (en memoria). Purga las ventanas viejas para no crecer sin fin. */
export class LimitePorIp {
  private readonly mapa = new Map<string, { t0: number; n: number }>();
  private readonly max: number;
  private readonly ventanaMs: number;
  private ultimaPurga = 0;
  constructor(max = LIMITE_POR_MINUTO, ventanaMs = 60_000) { this.max = max; this.ventanaMs = ventanaMs; }
  /** true = permitido (y lo cuenta). */
  permitir(ip: string, ahora: number): boolean {
    if (ahora - this.ultimaPurga > this.ventanaMs) {
      for (const [k, v] of this.mapa) if (ahora - v.t0 >= this.ventanaMs) this.mapa.delete(k);
      this.ultimaPurga = ahora;
    }
    const e = this.mapa.get(ip);
    if (!e || ahora - e.t0 >= this.ventanaMs) { this.mapa.set(ip, { t0: ahora, n: 1 }); return true; }
    if (e.n >= this.max) return false;
    e.n++;
    return true;
  }
  get tamano(): number { return this.mapa.size; }
}
