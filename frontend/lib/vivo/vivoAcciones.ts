// Z89: une la presencia de Supabase (lib/vivo/presencia.ts + lib/vivo/canalSupabase.ts) con la escena y el menú.
// DBG_VIVO.FUENTE = "mock" (default): nada cambia respecto de Z82–Z86 (SESSION = mock o la SesionPrueba de los botones).
// DBG_VIVO.FUENTE = "supabase": SESSION = SesionPresencia, cuyo status (y por lo tanto MONO_VIVO.haySesion, el domo, el
// aviso de Z85 y el tiempo detenido) sale de la presencia; mientras no haya medios reales, el audio y el video son los
// patrones de la SesionPrueba (la clase hereda de ella). Sin presencia vigente, o con error de red/configuración,
// status ≠ "active" → "no hay sesión" (ruido, estática y tiempo detenido, como pidió el usuario).
// El oyente solo se suscribe mientras hace falta (tickFuenteVivo(necesario): monolitos visibles; se cierra a los
// CIERRE_SIN_USO_S sin uso) y se cierra al desmontar los monolitos (soltarFuenteVivo).
// Publicador: publicarPresencia({ modo, consentimiento: true }) / detenerPresencia(); por ahora solo desde el menú de
// debug (la interfaz de consentimiento real es otra tarea). Se detiene solo en pagehide.
import { DBG_VIVO, DEBUG_ENABLED } from "@/lib/debugConfig";
import { SESSION, setSession, MockRemoteSession, type RemoteSession, type RemoteSessionStatus } from "@/lib/remoteSession";
import { SesionPrueba } from "@/lib/sesionPrueba";
import { OyentePresencia, PublicadorPresencia, type DepsVivo, type PedidoPublicar, type ResultadoPublicar } from "./presencia";
import { fabricaSupabase, hayConfigSupabase } from "./canalSupabase";

const DEPS: DepsVivo = {
  fabrica: fabricaSupabase,
  ahora: () => Date.now(),
  despues: (ms, fn) => setTimeout(fn, ms),
  cancelar: h => clearTimeout(h as ReturnType<typeof setTimeout>),
  enLinea: () => typeof navigator === "undefined" || navigator.onLine !== false,
};

/** RemoteSession cuya existencia viene de la presencia; medios = patrones de prueba (SesionPrueba) mientras tanto. */
export class SesionPresencia extends SesionPrueba implements RemoteSession {
  readonly oyente = new OyentePresencia(DEPS, DBG_VIVO);
  constructor() { super(); this.status = "idle"; }
  /** Un frame (sin allocations): avanza el oyente y copia su estado. */
  tick(necesario: boolean): void {
    this.oyente.tick(necesario);
    this.status = this.oyente.estado as RemoteSessionStatus;
  }
  /** Id de la sesión actual (la más reciente vigente) o null. */
  get sesionId(): string | null { return this.oyente.sesionActual; }
  dispose(): void { this.oyente.cerrar(); super.dispose(); }
}

/** Un frame, ANTES de leer SESSION.status (lo llama tickMonolitosVivo). necesario = monolitos visibles. */
export function tickFuenteVivo(necesario: boolean): void {
  if (DBG_VIVO.FUENTE === "supabase") {
    if (!(SESSION instanceof SesionPresencia)) setSession(new SesionPresencia());
    (SESSION as SesionPresencia).tick(necesario);
  } else if (SESSION instanceof SesionPresencia) {
    setSession(new MockRemoteSession());   // volver a "mock": como Z82–Z86 (sin sesión hasta "Simular sesión en vivo")
  }
}
/** Al desmontar los monolitos: cierra el canal del oyente (si la fuente es supabase). El mock no se toca. */
export function soltarFuenteVivo(): void {
  if (SESSION instanceof SesionPresencia) setSession(new MockRemoteSession());
}

// ── publicador (uno por pestaña) ──
function idSesionNavegador(): string {
  const K = "alight:vivo-sesion";
  try { const v = sessionStorage.getItem(K); if (v && /^[A-Za-z0-9_-]{8,64}$/.test(v)) return v; } catch { /* sin storage */ }
  let id = "";
  try { id = crypto.randomUUID(); } catch { id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); }
  try { sessionStorage.setItem(K, id); } catch { /* sin storage */ }
  return id;
}
/** Z92: el mismo sesionId de la presencia (sessionStorage de la pestaña) para la identidad de LiveKit. */
export function sesionIdNavegador(): string { return _pub ? _pub.presencia.sesionId : idSesionNavegador(); }
let _pub: PublicadorPresencia | null = null;
const _alSalir = () => detenerPresencia();

/** Publica la presencia de la tarima. EXIGE consentimiento: true (sin él, se rechaza y no se publica nada). */
export function publicarPresencia(p: PedidoPublicar): ResultadoPublicar {
  if (!p || p.consentimiento !== true) return { ok: false, motivo: "sin consentimiento" };
  if (typeof window === "undefined") return { ok: false, motivo: "sin navegador" };
  if (!_pub) _pub = new PublicadorPresencia(DEPS, DBG_VIVO, idSesionNavegador());
  const r = _pub.publicar(p);
  if (r.ok) window.addEventListener("pagehide", _alSalir);
  return r;
}
/** Z91: estado del publicador para el indicador EN VIVO (null = nunca se publicó en esta pestaña). Solo lectura. */
export function estadoPublicador(): { estado: string; publicando: boolean; ultimoError: string } | null {
  return _pub ? _pub : null;
}
/** Deja de publicar (untrack y cierre del canal). */
export function detenerPresencia(): void {
  if (typeof window !== "undefined") window.removeEventListener("pagehide", _alSalir);
  _pub?.detener();
}

// ── menú ──
const seg = (ms: number) => (ms < 0 ? "—" : `${(ms / 1000).toFixed(1)} s`);
export function textoEstadoVivo(): string {
  const cfg = hayConfigSupabase() ? "variables OK" : "SIN variables de Supabase";
  const o = SESSION instanceof SesionPresencia ? SESSION.oyente : null;
  const oy = o
    ? `oyente: ${o.estado} · sesión ${o.sesionActual ? o.sesionActual.slice(0, 8) + "…" + (o.modoActual ? ` (${o.modoActual})` : "") : "ninguna"} · último latido hace ${seg(o.antiguedadLatidoMs)} · vigentes ${o.vigentes} · inválidas ${o.invalidas} · errores ${o.errores}${o.ultimoError ? ` (${o.ultimoError})` : ""}`
    : `oyente: ${DBG_VIVO.FUENTE === "supabase" ? "sin montar (monolitos fuera)" : "fuente mock"}`;
  const pb = _pub
    ? `publicador: ${_pub.publicando ? _pub.estado : "detenido"} · latido ${_pub.presencia.latido} · errores ${_pub.errores}${_pub.ultimoError ? ` (${_pub.ultimoError})` : ""}`
    : "publicador: —";
  return `FUENTE ${DBG_VIVO.FUENTE} · ${cfg}\n${oy}\n${pb}`;
}

if (DEBUG_ENABLED && typeof window !== "undefined") {
  (window as unknown as { __vivo?: object }).__vivo = { DBG_VIVO, publicarPresencia, detenerPresencia, textoEstadoVivo, sesion: () => SESSION };
}
