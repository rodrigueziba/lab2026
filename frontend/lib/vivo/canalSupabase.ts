// Z89: adaptador de Supabase Realtime Presence para lib/vivo/presencia.ts (interfaz CanalPresencia).
// Configuración: la MISMA que usan las páginas del sitio (app/mis-proyectos/crear/page.tsx y otras): createClient con
// NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY. No se agregan variables. Sin ellas → fabrica() = null y la
// sesión queda en "error" (= no hay sesión), sin excepciones.
// Cliente propio y perezoso (se crea al primer uso, solo en el navegador) con la sesión de auth desactivada: no lee ni
// escribe localStorage ni toca la sesión de usuario del sitio; solo usa Realtime.
// Canal PÚBLICO (private: false) con la clave anónima: ver la nota de privacidad y riesgos en lib/vivo/presencia.ts.
// supabase-js devuelve el MISMO canal si se pide dos veces el mismo tema (RealtimeClient.channel), así que el publicador
// y el oyente de una misma pestaña lo comparten: un canal por tema, con referencias; se quita al soltar la última.
import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { CanalPresencia, EstadoCanal, FabricaCanal, Presencia } from "./presencia";

let _cliente: SupabaseClient | null | undefined;
function cliente(): SupabaseClient | null {
  if (_cliente !== undefined) return _cliente;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (typeof window === "undefined" || !url || !clave) return (_cliente = null);
  try {
    _cliente = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  } catch { _cliente = null; }
  return _cliente;
}
/** ¿Están las variables? (para el menú; no dice si el proyecto responde). */
export function hayConfigSupabase(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

interface Compartido { canal: RealtimeChannel; refs: number; sync: Set<() => void>; est: Set<(s: EstadoCanal) => void>; ultimo: EstadoCanal | null }
const _canales = new Map<string, Compartido>();

function claveAleatoria(): string {
  try { if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID(); } catch { /* sin crypto */ }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const fabricaSupabase: FabricaCanal = (nombre: string): CanalPresencia | null => {
  const c = cliente();
  if (!c) return null;
  let e = _canales.get(nombre);
  if (!e) {
    const canal = c.channel(nombre, { config: { presence: { key: claveAleatoria() }, private: false } });
    const nuevo: Compartido = { canal, refs: 0, sync: new Set(), est: new Set(), ultimo: null };
    // la escucha de presencia va ANTES de subscribe (si no, el servidor no habilita la presencia en el canal)
    canal.on("presence", { event: "sync" }, () => { for (const f of Array.from(nuevo.sync)) f(); });
    canal.subscribe(s => { nuevo.ultimo = s as EstadoCanal; for (const f of Array.from(nuevo.est)) f(s as EstadoCanal); });
    _canales.set(nombre, nuevo);
    e = nuevo;
  }
  const comp = e;
  comp.refs++;
  let cerrado = false;
  const misSync = new Set<() => void>(), misEst = new Set<(s: EstadoCanal) => void>();
  return {
    alSincronizar(cb) { if (cerrado) return; misSync.add(cb); comp.sync.add(cb); },
    estado() { return comp.canal.presenceState() as unknown as Record<string, unknown[]>; },
    suscribir(cb) {
      if (cerrado) return;
      misEst.add(cb); comp.est.add(cb);
      if (comp.ultimo === "SUBSCRIBED") queueMicrotask(() => { if (!cerrado) cb("SUBSCRIBED"); });   // ya estaba suscripto
    },
    track(p: Presencia) { return comp.canal.track({ sesionId: p.sesionId, inicioMs: p.inicioMs, modo: p.modo, latido: p.latido }); },
    untrack() { return comp.canal.untrack(); },
    cerrar() {
      if (cerrado) return;
      cerrado = true;
      for (const f of misSync) comp.sync.delete(f);
      for (const f of misEst) comp.est.delete(f);
      if (--comp.refs <= 0 && _canales.get(nombre) === comp) {
        _canales.delete(nombre);
        c.removeChannel(comp.canal).catch(() => { /* ya caído */ });
      }
    },
  };
};
