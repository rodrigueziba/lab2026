// Z92: firma tokens de LiveKit para la transmisión de la tarima (sin tocar el backend de NestJS).
// POST { rol: "publicar" | "escuchar", sesionId } → { token, url }. Reglas y RIESGOS: lib/vivo/tokenLiveKit.ts.
// Variables del SERVIDOR, leídas en cada pedido (Z92b: no se graban en el build, sirve en Docker):
//   LIVEKIT_API_KEY, LIVEKIT_API_SECRET (nunca llegan al navegador) y la URL: LIVEKIT_URL o, si falta,
//   NEXT_PUBLIC_LIVEKIT_URL (debe empezar con wss:// o ws://). Opcional: LIVEKIT_SALA (si no, "alight-tarima-v1").
// Sin variables o URL inválida → 503 genérico. Errores sin información interna.
import { AccessToken, TrackSource } from "livekit-server-sdk";
import { atenderToken, ipDe, LimitePorIp, type FirmarToken, type EnvToken } from "@/lib/vivo/tokenLiveKit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";   // nunca se evalúa en el build

const LIMITE = new LimitePorIp();   // en memoria de esta instancia
const SIN_CACHE = { "Cache-Control": "no-store" };

const firmar: FirmarToken = async (clave, secreto, identidad, ttl, p) => {
  const at = new AccessToken(clave, secreto, { identity: identidad, ttl });
  at.addGrant({
    room: p.room, roomJoin: p.roomJoin, canPublish: p.canPublish, canSubscribe: p.canSubscribe, canPublishData: p.canPublishData,
    canPublishSources: p.fuentes.map(f => (f === "camera" ? TrackSource.CAMERA : TrackSource.MICROPHONE)),
  });
  return at.toJwt();
};

// Z92b: lectura con clave dinámica. Next reemplaza `process.env.NEXT_PUBLIC_…` por su valor AL COMPILAR (también en el
// servidor), así que en una imagen de Docker quedaría el valor (vacío) del build. Con process.env[k] se lee al pedir.
const VARS = ["LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "LIVEKIT_URL", "NEXT_PUBLIC_LIVEKIT_URL", "LIVEKIT_SALA"] as const;
function leerEnv(): EnvToken {
  const e: EnvToken = {};
  for (const k of VARS) e[k] = process.env[k];
  return e;
}

export async function POST(req: Request): Promise<Response> {
  const env = leerEnv();
  const r = await atenderToken(env, {
    ip: ipDe(req.headers.get("x-forwarded-for"), req.headers.get("x-real-ip")),
    ahora: Date.now(),
    largo: Number(req.headers.get("content-length") ?? "0"),
    texto: () => req.text(),
  }, LIMITE, firmar);
  return Response.json(r.cuerpo, { status: r.estado, headers: SIN_CACHE });
}
