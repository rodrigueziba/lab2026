// Z89: presencia de la sesión en vivo de la tarima (paso 4 de docs/EVALUACION_CONEXION_VIVO.md). SIN medios: solo
// "hay alguien transmitiendo". Lógica PURA y SIN imports: el canal (Supabase Realtime Presence, lib/vivo/canalSupabase.ts),
// el reloj y los temporizadores se inyectan, así que se prueba en Node con un canal simulado
// (scripts/presencia-vivo-test.mjs). La une con la escena lib/vivo/vivoAcciones.ts.
//
// PUBLICADOR (TARIMA): track de { sesionId, inicioMs, modo, latido } en el canal; latido = contador entero que sube cada
// LATIDO_S. Solo con consentimiento: publicar() exige consentimiento === true y rechaza (sin excepción) lo demás.
// Uno solo por pestaña: publicar() de nuevo actualiza el modo, no crea otra presencia.
// OYENTE (SILLAS): lee el estado de presencia del canal y calcula "la sesión más reciente" = la de mayor inicioMs entre
// las VIGENTES. Vigencia con el reloj LOCAL (no se comparan relojes entre navegadores): se anota cuándo cambió por
// última vez el latido de cada sesión; sin cambio durante TIMEOUT_S deja de contar. Una sesión que se va (untrack o
// cierre) desaparece del estado del canal y deja de contar en ese momento.
//
// PRIVACIDAD Y RIESGOS: el canal es PÚBLICO y se abre con la clave anónima (pública por diseño: va en el bundle). La
// presencia no lleva nada identificable (sesionId aleatorio, hora de inicio, modo y un contador) y no hay mensajes con
// contenido. Riesgo: cualquiera con la clave puede entrar al canal y publicar presencias falsas (una "sesión" que no
// existe, o una con inicioMs enorme para quedar como la más reciente). Mitigación: validarPresencia() acepta solo el
// formato exacto (claves conocidas, tipos, largos, rangos, inicioMs no más de MAX_FUTURO_MS adelante del reloj local) e
// ignora el resto; lo peor que puede pasar hoy es que SILLAS muestre la sesión de PRUEBA (patrones locales) sin que
// haya nadie en la tarima. Cuando viajen medios (paso 6) hará falta un token firmado en el servidor.
//
// Errores (sin variables, sin red, canal caído, proyecto pausado): estado "error" o "idle" → para el resto de la
// experiencia es "no hay sesión". Nunca lanza; reintenta con espera creciente (REINTENTO_S × 2^n, tope REINTENTO_MAX_S).
// Z95: cada reintento abre un canal NUEVO (fabrica(nombre, rol, true): instancia propia del rol, ver canalSupabase.ts),
// hasta MAX_REINTENTOS seguidos; después queda "agotado" hasta reintentar() (botón "Reintentar presencia"). El motivo
// guarda el estado exacto de Supabase (SUBSCRIBED / CHANNEL_ERROR / TIMED_OUT / CLOSED) y su mensaje, sin datos sensibles.

export interface CfgVivo {
  CANAL: string; LATIDO_S: number; TIMEOUT_S: number; REINTENTO_S: number; REINTENTO_MAX_S: number; CIERRE_SIN_USO_S: number;
  MAX_REINTENTOS?: number;   // Z95 (sin el campo: 8)
}
/** Z95: rol de quien abre el canal; cada rol tiene su propia instancia (un rol nunca cierra el canal del otro). */
export type RolPresencia = "publicar" | "escuchar";
export type ModoPresencia = "cara" | "privado";
export interface Presencia { sesionId: string; inicioMs: number; modo: ModoPresencia; latido: number }
/** Mismos valores que RemoteSessionStatus (lib/remoteSession.ts): idle · connecting (conectando) · active (activa) · error. */
export type EstadoConexion = "idle" | "connecting" | "active" | "error";
/** Estados que informa el canal (los de supabase-js: REALTIME_SUBSCRIBE_STATES). */
export type EstadoCanal = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR";

/** Lo mínimo de un canal de presencia (el adaptador de Supabase o el simulado de la prueba). */
export interface CanalPresencia {
  alSincronizar(cb: () => void): void;
  estado(): Record<string, unknown[]>;
  suscribir(cb: (s: EstadoCanal, motivo?: string) => void): void;   // Z95: motivo = mensaje de Supabase (si lo hay)
  track(p: Presencia): unknown;
  untrack(): unknown;
  cerrar(): void;
}
/** Abre el canal del rol; null = no hay configuración (faltan las variables de entorno). nuevo = después de una falla:
 *  instancia fresca (nunca la que se estaba cerrando). */
export type FabricaCanal = (nombre: string, rol?: RolPresencia, nuevo?: boolean) => CanalPresencia | null;

/** Z95: texto del motivo: estado exacto del canal + mensaje breve (una línea, sin nada con forma de token). */
export function motivoCanal(s: string, motivo?: string): string {
  const m = (motivo ?? "").split("\n")[0].replace(/eyJ[\w-]*\.[\w-]*\.[\w-]*/g, "[token]").replace(/(apikey|access_token|token)=[^&\s]+/gi, "$1=[token]").trim();
  const corto = m.length > 80 ? m.slice(0, 79) + "…" : m;
  return corto ? `${s}: ${corto}` : s;
}
/** Z95: tope de reintentos seguidos (cfg o 8). */
export function maxReintentos(c: CfgVivo): number {
  const n = c.MAX_REINTENTOS;
  return Math.max(0, Math.floor(typeof n === "number" && Number.isFinite(n) ? n : 8));
}
export interface DepsVivo {
  fabrica: FabricaCanal;
  ahora(): number;                                   // reloj local (ms)
  despues(ms: number, fn: () => void): unknown;      // setTimeout
  cancelar(h: unknown): void;                        // clearTimeout
  enLinea(): boolean;                                // navigator.onLine
}

// ── validación (mitigación contra presencias falsas o con contenido) ──
export const CLAVES_PRESENCIA = ["sesionId", "inicioMs", "modo", "latido", "presence_ref"] as const;
export const MAX_FUTURO_MS = 10 * 60 * 1000;   // tolerancia de reloj: inicioMs hasta 10 min adelante del reloj local
const RE_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Devuelve la presencia si tiene EXACTAMENTE el formato esperado; si no, null (se ignora). */
export function validarPresencia(x: unknown, ahoraLocal: number): Presencia | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  for (const k in o) if (!(CLAVES_PRESENCIA as readonly string[]).includes(k)) return null;   // nada extra
  if (o.presence_ref !== undefined && (typeof o.presence_ref !== "string" || o.presence_ref.length > 64)) return null;
  const { sesionId, inicioMs, modo, latido } = o;
  if (typeof sesionId !== "string" || !RE_ID.test(sesionId)) return null;
  if (typeof inicioMs !== "number" || !Number.isFinite(inicioMs) || inicioMs < 1.5e12 || inicioMs > ahoraLocal + MAX_FUTURO_MS) return null;
  if (modo !== "cara" && modo !== "privado") return null;
  if (typeof latido !== "number" || !Number.isInteger(latido) || latido < 0 || latido > 1e9) return null;
  return o as unknown as Presencia;
}

// ── registro del oyente ──
export interface RegistroSesion { sesionId: string; inicioMs: number; modo: ModoPresencia; latido: number; cambioLocalMs: number; marca: number }

/**
 * Vuelca el estado de presencia del canal en el registro (se llama en cada "sync", no por frame). Sesión nueva o con
 * latido distinto → cambioLocalMs = ahora (reloj local). Las que ya no están en el canal se quitan. Devuelve cuántas
 * presencias inválidas se ignoraron.
 */
export function actualizarRegistro(reg: RegistroSesion[], estado: Record<string, unknown[]>, ahora: number): number {
  let invalidas = 0;
  const marca = ++_marca;
  for (const k in estado) {
    const metas = estado[k];
    if (!Array.isArray(metas)) { invalidas++; continue; }
    for (const m of metas) {
      const p = validarPresencia(m, ahora);
      if (!p) { invalidas++; continue; }
      let r: RegistroSesion | undefined;
      for (const q of reg) if (q.sesionId === p.sesionId) { r = q; break; }
      if (!r) { reg.push({ sesionId: p.sesionId, inicioMs: p.inicioMs, modo: p.modo, latido: p.latido, cambioLocalMs: ahora, marca }); continue; }
      if (r.latido !== p.latido) { r.latido = p.latido; r.cambioLocalMs = ahora; }
      r.modo = p.modo; r.marca = marca;
    }
  }
  for (let i = reg.length - 1; i >= 0; i--) if (reg[i].marca !== marca) reg.splice(i, 1);   // ya no están en el canal
  return invalidas;
}
let _marca = 0;

/** ¿Vigente? (latido cambiado hace TIMEOUT_S o menos, con el reloj local) */
export function vigente(r: RegistroSesion, ahora: number, timeoutS: number): boolean {
  return ahora - r.cambioLocalMs <= Math.max(0, Number.isFinite(timeoutS) ? timeoutS : 15) * 1000;
}
/** La sesión más reciente entre las vigentes (mayor inicioMs; empate: sesionId mayor). out.vigentes = cuántas. Sin allocations. */
export function sesionMasReciente(reg: readonly RegistroSesion[], ahora: number, timeoutS: number, out: { vigentes: number }): RegistroSesion | null {
  let mejor: RegistroSesion | null = null;
  out.vigentes = 0;
  for (const r of reg) {
    if (!vigente(r, ahora, timeoutS)) continue;
    out.vigentes++;
    if (!mejor || r.inicioMs > mejor.inicioMs || (r.inicioMs === mejor.inicioMs && r.sesionId > mejor.sesionId)) mejor = r;
  }
  return mejor;
}

/** Espera del reintento n (0, 1, 2…): REINTENTO_S × 2^n, con tope REINTENTO_MAX_S. */
export function esperaReintentoMs(n: number, c: CfgVivo): number {
  const base = Math.max(0.5, Number.isFinite(c.REINTENTO_S) ? c.REINTENTO_S : 2);
  const tope = Math.max(base, Number.isFinite(c.REINTENTO_MAX_S) ? c.REINTENTO_MAX_S : 60);
  return Math.min(tope, base * Math.pow(2, Math.max(0, Math.min(20, n)))) * 1000;
}

const llamar = (fn: () => unknown): void => {   // track/untrack pueden devolver una promesa rechazada o lanzar: se ignora
  try { const r = fn() as { catch?: (f: () => void) => void } | undefined; if (r && typeof r.catch === "function") r.catch(() => {}); } catch { /* canal caído */ }
};

// ── oyente (SILLAS) ──
export class OyentePresencia {
  estado: EstadoConexion = "idle";
  sesionActual: string | null = null;
  modoActual: ModoPresencia | null = null;
  antiguedadLatidoMs = -1;       // de la sesión actual (reloj local)
  vigentes = 0;
  invalidas = 0;
  errores = 0;
  ultimoError = "";
  sinConfig = false;
  estadoCanal = "";              // Z95: último estado que informó Supabase (exacto)
  agotado = false;               // Z95: se agotaron los reintentos (hasta reintentar())
  get intento(): number { return this.intentos; }
  get reconectando(): boolean { return this.reintento !== null; }
  readonly registros: RegistroSesion[] = [];
  private canal: CanalPresencia | null = null;
  private suscripto = false;
  private intentos = 0;
  private reintento: unknown = null;
  private ultimoUso = -Infinity;
  private readonly _out = { vigentes: 0 };

  private readonly deps: DepsVivo;
  private readonly cfg: CfgVivo;
  constructor(deps: DepsVivo, cfg: CfgVivo) { this.deps = deps; this.cfg = cfg; }   // sin parameter properties (Node las rechaza al quitar tipos)

  /** Un frame. necesario = hace falta saber si hay sesión (p. ej. monolitos visibles). Sin allocations. */
  tick(necesario: boolean): void {
    const ahora = this.deps.ahora();
    if (necesario) {
      this.ultimoUso = ahora;
      if (!this.canal && this.reintento === null && !this.sinConfig && !this.agotado) this.conectar();
    } else if (this.canal && ahora - this.ultimoUso > Math.max(0, this.cfg.CIERRE_SIN_USO_S) * 1000) {
      this.cerrar();
      return;
    }
    if (!this.canal || !this.suscripto) { this.sesionActual = null; this.modoActual = null; this.vigentes = 0; this.antiguedadLatidoMs = -1; return; }
    const r = sesionMasReciente(this.registros, ahora, this.cfg.TIMEOUT_S, this._out);
    this.vigentes = this._out.vigentes;
    this.sesionActual = r ? r.sesionId : null;
    this.modoActual = r ? r.modo : null;
    this.antiguedadLatidoMs = r ? ahora - r.cambioLocalMs : -1;
    this.estado = r ? "active" : "idle";
  }

  private conectar(): void {
    if (!this.deps.enLinea()) { this.fallo("sin conexión"); return; }
    let c: CanalPresencia | null = null;
    try { c = this.deps.fabrica(this.cfg.CANAL, "escuchar", this.intentos > 0); } catch (e) { this.fallo(motivoCanal("error al abrir el canal", e instanceof Error ? e.message : "")); return; }
    if (!c) { this.sinConfig = true; this.estado = "error"; this.ultimoError = "sin configuración (faltan las variables de Supabase)"; return; }
    this.canal = c; this.suscripto = false; this.estado = "connecting"; this.estadoCanal = "abriendo";
    c.alSincronizar(() => { if (this.canal === c) this.sincronizar(); });
    c.suscribir((s, motivo) => {
      if (this.canal !== c) return;
      this.estadoCanal = s;
      if (s === "SUBSCRIBED") { this.suscripto = true; this.intentos = 0; this.agotado = false; this.estado = "idle"; this.sincronizar(); }
      else this.fallo(motivoCanal(s, motivo));
    });
  }

  private sincronizar(): void {
    if (!this.canal) return;
    let st: Record<string, unknown[]> = {};
    try { st = this.canal.estado() ?? {}; } catch { st = {}; }
    this.invalidas += actualizarRegistro(this.registros, st, this.deps.ahora());
  }

  private fallo(motivo: string): void {
    this.errores++; this.ultimoError = motivo;
    this.soltarCanal();
    this.estado = "error"; this.sesionActual = null; this.modoActual = null; this.vigentes = 0;
    if (this.reintento !== null) return;
    if (this.intentos >= maxReintentos(this.cfg)) { this.agotado = true; return; }   // Z95: hasta reintentar()
    const ms = esperaReintentoMs(this.intentos++, this.cfg);
    this.reintento = this.deps.despues(ms, () => { this.reintento = null; });   // el próximo tick (si hace falta) reconecta (canal nuevo)
  }

  /** Z95: botón "Reintentar presencia": vuelve a intentar desde cero (el próximo tick con necesario = true conecta). */
  reintentar(): void {
    if (this.reintento !== null) { this.deps.cancelar(this.reintento); this.reintento = null; }
    this.soltarCanal();
    this.agotado = false; this.sinConfig = false; this.intentos = 0;
    this.estado = "idle";
  }

  private soltarCanal(): void {
    const c = this.canal;
    this.canal = null; this.suscripto = false; this.registros.length = 0;
    if (c) { try { c.cerrar(); } catch { /* ya cerrado */ } }
  }

  /** Cierra el canal (desmontaje o sin uso). Vuelve a "idle"; el próximo tick con necesario = true reconecta. */
  cerrar(): void {
    if (this.reintento !== null) { this.deps.cancelar(this.reintento); this.reintento = null; }
    this.soltarCanal();
    this.estado = "idle"; this.sesionActual = null; this.modoActual = null; this.vigentes = 0; this.antiguedadLatidoMs = -1;
    this.intentos = 0; this.agotado = false;
  }
}

// ── publicador (TARIMA) ──
export interface PedidoPublicar { modo: ModoPresencia; consentimiento: boolean }
export type ResultadoPublicar = { ok: true; sesionId: string } | { ok: false; motivo: string };

export class PublicadorPresencia {
  estado: EstadoConexion = "idle";
  publicando = false;
  errores = 0;
  ultimoError = "";
  estadoCanal = "";              // Z95
  agotado = false;               // Z95
  get intento(): number { return this.intentos; }
  get reconectando(): boolean { return this.reintento !== null; }
  readonly presencia: Presencia;
  private canal: CanalPresencia | null = null;
  private intentos = 0;
  private latidoH: unknown = null;
  private reintento: unknown = null;

  private readonly deps: DepsVivo;
  private readonly cfg: CfgVivo;
  constructor(deps: DepsVivo, cfg: CfgVivo, sesionId: string) {
    this.deps = deps; this.cfg = cfg;
    this.presencia = { sesionId, inicioMs: 0, modo: "privado", latido: 0 };
  }

  /** Publica (o actualiza el modo). Exige consentimiento === true. Nunca lanza. */
  publicar(p: PedidoPublicar): ResultadoPublicar {
    if (!p || p.consentimiento !== true) return { ok: false, motivo: "sin consentimiento" };
    if (p.modo !== "cara" && p.modo !== "privado") return { ok: false, motivo: "modo inválido" };
    if (!RE_ID.test(this.presencia.sesionId)) return { ok: false, motivo: "sesionId inválido" };
    this.presencia.modo = p.modo;
    if (this.publicando) { if (this.estado === "active" && this.canal) llamar(() => this.canal?.track(this.presencia)); return { ok: true, sesionId: this.presencia.sesionId }; }
    this.publicando = true;
    this.presencia.inicioMs = this.deps.ahora(); this.presencia.latido = 0;
    this.conectar();
    return { ok: true, sesionId: this.presencia.sesionId };
  }

  private conectar(): void {
    if (!this.publicando) return;
    if (!this.deps.enLinea()) { this.fallo("sin conexión"); return; }
    let c: CanalPresencia | null = null;
    try { c = this.deps.fabrica(this.cfg.CANAL, "publicar", this.intentos > 0); } catch (e) { this.fallo(motivoCanal("error al abrir el canal", e instanceof Error ? e.message : "")); return; }
    if (!c) { this.estado = "error"; this.ultimoError = "sin configuración (faltan las variables de Supabase)"; this.publicando = false; return; }
    this.canal = c; this.estado = "connecting"; this.estadoCanal = "abriendo";
    c.suscribir((s, motivo) => {
      if (this.canal !== c) return;
      this.estadoCanal = s;
      if (s === "SUBSCRIBED") {
        this.intentos = 0; this.agotado = false; this.estado = "active";
        llamar(() => c.track(this.presencia));
        this.programarLatido();
      } else this.fallo(motivoCanal(s, motivo));
    });
  }

  private programarLatido(): void {
    if (this.latidoH !== null) this.deps.cancelar(this.latidoH);
    const ms = Math.max(0.5, Number.isFinite(this.cfg.LATIDO_S) ? this.cfg.LATIDO_S : 5) * 1000;
    this.latidoH = this.deps.despues(ms, () => {
      this.latidoH = null;
      if (!this.publicando || !this.canal || this.estado !== "active") return;
      this.presencia.latido++;
      llamar(() => this.canal?.track(this.presencia));
      this.programarLatido();
    });
  }

  private fallo(motivo: string): void {
    this.errores++; this.ultimoError = motivo;
    this.soltar(false);
    this.estado = "error";
    if (!this.publicando || this.reintento !== null) return;
    if (this.intentos >= maxReintentos(this.cfg)) { this.agotado = true; return; }   // Z95: hasta reintentar()
    const ms = esperaReintentoMs(this.intentos++, this.cfg);
    this.reintento = this.deps.despues(ms, () => { this.reintento = null; this.conectar(); });   // canal nuevo
  }

  /** Z95: botón "Reintentar presencia" (solo si sigue publicando). */
  reintentar(): void {
    if (!this.publicando) return;
    if (this.reintento !== null) { this.deps.cancelar(this.reintento); this.reintento = null; }
    this.soltar(false);
    this.agotado = false; this.intentos = 0;
    this.conectar();
  }

  private soltar(untrack: boolean): void {
    if (this.latidoH !== null) { this.deps.cancelar(this.latidoH); this.latidoH = null; }
    const c = this.canal;
    this.canal = null;
    if (c) { if (untrack) llamar(() => c.untrack()); try { c.cerrar(); } catch { /* ya cerrado */ } }
  }

  /** Deja de publicar: untrack y cierre del canal. */
  detener(): void {
    this.publicando = false;
    if (this.reintento !== null) { this.deps.cancelar(this.reintento); this.reintento = null; }
    this.soltar(true);
    this.estado = "idle"; this.intentos = 0; this.agotado = false;
  }
}
