// Z89: adaptador de Supabase Realtime Presence para lib/vivo/presencia.ts (interfaz CanalPresencia).
// Configuración: la MISMA que usan las páginas del sitio (app/mis-proyectos/crear/page.tsx y otras): createClient con
// NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY. No se agregan variables. Sin ellas → fabrica() = null y la
// sesión queda en "error" (= no hay sesión), sin excepciones.
// Cliente propio y perezoso (se crea al primer uso, solo en el navegador) con la sesión de auth desactivada: no lee ni
// escribe localStorage ni toca la sesión de usuario del sitio; solo usa Realtime.
// Canal PÚBLICO (private: false) con la clave anónima: ver la nota de privacidad y riesgos en lib/vivo/presencia.ts.
//
// Z95: UN CLIENTE (y por lo tanto un canal) POR ROL. Antes el publicador y el oyente de una misma pestaña compartían
// el mismo RealtimeChannel (supabase-js devuelve el canal existente si se pide el mismo tema): un error de ese canal
// tumbaba a los dos roles a la vez, y al reintentar, `channel(tema)` podía devolver la instancia que se estaba quitando
// (removeChannel solo la saca de la lista si el unsubscribe responde "ok"), cuyo subscribe() no registra el callback
// (solo lo hace en estado "closed"): el rol quedaba sin estado. Ahora:
//  - cada rol ("publicar" / "escuchar") tiene su cliente; cerrar uno nunca toca el canal del otro;
//  - después de una falla (nuevo = true), o si el cliente todavía tiene un canal con ese tema, se crea un cliente NUEVO
//    (y se desconecta el viejo): la instancia es siempre fresca;
//  - el callback de subscribe pasa el estado exacto y el mensaje del error de Supabase (presencia.ts lo muestra).
import { createClient } from "@supabase/supabase-js";
import type { CanalPresencia, EstadoCanal, FabricaCanal, Presencia, RolPresencia } from "./presencia";

/** Lo mínimo de un RealtimeChannel de supabase-js (permite probar con un cliente simulado). */
export interface CanalRT {
  topic: string;
  on(tipo: "presence", filtro: { event: "sync" }, cb: () => void): unknown;
  subscribe(cb: (s: string, err?: Error) => void): unknown;
  presenceState(): unknown;
  track(p: Record<string, unknown>): unknown;
  untrack(): unknown;
}
/** Lo mínimo del cliente de supabase-js. */
export interface ClienteRT {
  channel(nombre: string, opts: unknown): CanalRT;
  removeChannel(c: CanalRT): Promise<unknown>;
  getChannels(): CanalRT[];
  realtime?: { disconnect(): void };
}

function claveAleatoria(): string {
  try { if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID(); } catch { /* sin crypto */ }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Fábrica con un creador de clientes inyectado (null = sin configuración). */
export function fabricaCon(crearCliente: (rol: RolPresencia) => ClienteRT | null): FabricaCanal & { clientes: Record<RolPresencia, ClienteRT | null> } {
  const clientes: Record<RolPresencia, ClienteRT | null> = { publicar: null, escuchar: null };
  const descartar = (rol: RolPresencia) => {
    const viejo = clientes[rol];
    clientes[rol] = null;
    if (viejo) { try { viejo.realtime?.disconnect(); } catch { /* ya desconectado */ } }
  };
  const fab = ((nombre: string, rol: RolPresencia = "escuchar", nuevo = false): CanalPresencia | null => {
    let cl = clientes[rol];
    const tema = `realtime:${nombre}`;
    if (cl && (nuevo || cl.getChannels().some(c => c.topic === tema))) { descartar(rol); cl = null; }
    if (!cl) {
      try { cl = crearCliente(rol); } catch { cl = null; }
      if (!cl) return null;
      clientes[rol] = cl;
    }
    const cliente = cl;
    const canal = cliente.channel(nombre, { config: { presence: { key: claveAleatoria() }, private: false } });
    let cerrado = false;
    const sync = new Set<() => void>(), est = new Set<(s: EstadoCanal, motivo?: string) => void>();
    let ultimo: EstadoCanal | null = null, ultimoMotivo = "";
    // la escucha de presencia va ANTES de subscribe (si no, el servidor no habilita la presencia en el canal)
    canal.on("presence", { event: "sync" }, () => { if (!cerrado) for (const f of Array.from(sync)) f(); });
    canal.subscribe((s, err) => {
      if (cerrado) return;
      ultimo = s as EstadoCanal; ultimoMotivo = err?.message ?? "";
      for (const f of Array.from(est)) f(ultimo, ultimoMotivo);
    });
    return {
      alSincronizar(cb) { if (!cerrado) sync.add(cb); },
      estado() { return canal.presenceState() as Record<string, unknown[]>; },
      suscribir(cb) {
        if (cerrado) return;
        est.add(cb);
        if (ultimo) { const s = ultimo, m = ultimoMotivo; queueMicrotask(() => { if (!cerrado && est.has(cb)) cb(s, m); }); }   // ya informó
      },
      track(p: Presencia) { return canal.track({ sesionId: p.sesionId, inicioMs: p.inicioMs, modo: p.modo, latido: p.latido }); },
      untrack() { return canal.untrack(); },
      cerrar() {
        if (cerrado) return;
        cerrado = true; sync.clear(); est.clear();   // un CLOSED posterior (el propio cierre) no llega a nadie
        cliente.removeChannel(canal).catch(() => { /* ya caído */ });
      },
    };
  }) as FabricaCanal & { clientes: Record<RolPresencia, ClienteRT | null> };
  fab.clientes = clientes;
  return fab;
}

/** ¿Están las variables? (para el menú; no dice si el proyecto responde). */
export function hayConfigSupabase(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export const fabricaSupabase: FabricaCanal = fabricaCon(rol => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (typeof window === "undefined" || !url || !clave) return null;
  // storageKey propio por rol: varios clientes en la pestaña sin el aviso de "Multiple GoTrueClient instances"
  return createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `alight-vivo-${rol}` },
  }) as unknown as ClienteRT;
});
