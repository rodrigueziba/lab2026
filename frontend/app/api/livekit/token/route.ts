// Z92: firma tokens de LiveKit para la transmisión de la tarima (sin tocar el backend de NestJS).
// POST { rol: "publicar" | "escuchar", sesionId } → { token, url }. Reglas y RIESGOS: lib/vivo/tokenLiveKit.ts.
// Variables del servidor: LIVEKIT_API_KEY, LIVEKIT_API_SECRET (nunca llegan al navegador) y NEXT_PUBLIC_LIVEKIT_URL
// (pública). Opcional: LIVEKIT_SALA (si no, "alight-tarima-v1"). Sin variables → 503 genérico (el cliente lo trata como
// "sin conexión"). Errores sin información interna.
import { AccessToken, TrackSource } from "livekit-server-sdk";
import {
  validarSolicitud, permisosPorRol, ttlPorRol, salaServidor, ipDe, LimitePorIp,
} from "@/lib/vivo/tokenLiveKit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMITE = new LimitePorIp();   // en memoria de esta instancia
const SIN_CACHE = { "Cache-Control": "no-store" };
const error = (estado: number, mensaje: string) => Response.json({ error: mensaje }, { status: estado, headers: SIN_CACHE });

export async function POST(req: Request): Promise<Response> {
  const ip = ipDe(req.headers.get("x-forwarded-for"), req.headers.get("x-real-ip"));
  if (!LIMITE.permitir(ip, Date.now())) return error(429, "demasiados pedidos");

  const clave = process.env.LIVEKIT_API_KEY, secreto = process.env.LIVEKIT_API_SECRET, url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!clave || !secreto || !url) return error(503, "no disponible");

  const largo = Number(req.headers.get("content-length") ?? "0");
  if (largo > 512) return error(400, "solicitud inválida");
  let cuerpo: unknown = null;
  try { cuerpo = JSON.parse((await req.text()).slice(0, 512)); } catch { return error(400, "solicitud inválida"); }
  const s = validarSolicitud(cuerpo);
  if (!s.ok) return error(400, "solicitud inválida");

  try {
    const p = permisosPorRol(s.rol, salaServidor(process.env.LIVEKIT_SALA));
    const at = new AccessToken(clave, secreto, { identity: s.sesionId, ttl: ttlPorRol(s.rol) });
    at.addGrant({
      room: p.room, roomJoin: p.roomJoin, canPublish: p.canPublish, canSubscribe: p.canSubscribe, canPublishData: p.canPublishData,
      canPublishSources: p.fuentes.map(f => (f === "camera" ? TrackSource.CAMERA : TrackSource.MICROPHONE)),
    });
    return Response.json({ token: await at.toJwt(), url }, { headers: SIN_CACHE });
  } catch {
    return error(500, "no disponible");
  }
}
