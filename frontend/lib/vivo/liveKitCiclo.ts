// Z92: ciclo de vida del publicador de LiveKit de la tarima. Lógica PURA y SIN imports: el SDK (livekit-client, cargado
// de forma dinámica), el token, las pistas y el reloj se inyectan (lib/vivo/publicarLiveKit.ts), así que se prueba en
// Node con un cliente simulado (scripts/livekit-test.mjs).
// Estados: inactivo → pidiendo (token) → conectando → publicando ⇄ reconectando (el SDK reintenta solo)
//          → sin_conexion (token rechazado, sin variables, sin red, o el SDK se rindió) · detenido (corte).
// Z92b: `diagnostico` distingue servidor sin claves (503), pedido rechazado (400/429), sin red, token ok pero falló la
// conexión (con el motivo breve del SDK) y conectado.
// Solo arranca con consentimiento === true (lo da la elección "Compartir mi sesión." de Z91). Uno solo por pestaña.
// detener() es inmediato y libera TODO: pistas (clon de la webcam o captureStream del canvas), la salida transmisible
// del núcleo de audio y la conexión; si se llama a mitad de la conexión, lo que llegue después se suelta al llegar.

export type EstadoLK = "inactivo" | "pidiendo" | "conectando" | "publicando" | "reconectando" | "sin_conexion" | "detenido";
export type ModoLK = "cara" | "privado";
export interface CfgLK { VIDEO_FPS: number; VIDEO_KBPS: number; AUDIO_KBPS: number }
export type RespuestaToken = { ok: true; token: string; url: string } | { ok: false; motivo: string };
/** Pista local con su liberación (detener el clon o el captureStream, o soltar la salida del núcleo). */
export interface PistaLK { track: unknown; liberar(): void }
export type EventoSala = "conectado" | "reconectando" | "reconectado" | "desconectado";
export interface SalaLK {
  conectar(url: string, token: string): Promise<void>;
  publicarVideo(p: PistaLK, cfg: CfgLK): Promise<void>;
  publicarAudio(p: PistaLK, cfg: CfgLK): Promise<void>;
  /** Z94b (opcional): reemplaza la pista de video publicada en la misma sala (sin reconectar ni tocar el audio). */
  reemplazarVideo?(p: PistaLK): Promise<void>;
  alEvento(cb: (e: EventoSala) => void): void;
  pausar(pausa: boolean): void;            // benchmark: pausa la subida (pauseUpstream) sin cortar
  kbps(): number;                          // bitrate saliente (0 si el SDK no lo da)
  desconectar(): void;
}
export interface DepsLK {
  pedirToken(sesionId: string): Promise<RespuestaToken>;
  crearSala(): Promise<SalaLK>;
  video(modo: ModoLK, cfg: CfgLK): PistaLK | null;
  audio(): PistaLK | null;
}
export interface PedidoLK { consentimiento: boolean; modo: ModoLK; sesionId: string }
export type ResultadoLK = { ok: true } | { ok: false; motivo: string };
const RE_ID = /^[A-Za-z0-9_-]{8,64}$/;

// ── Z92b: diagnóstico (sin datos sensibles: nunca el token, la clave ni el secreto) ──
export const MOTIVO_TOKEN = {
  sinClaves: "servidor sin claves (503)",
  sinRed: "sin red al pedir el token",
  invalida: "respuesta del token inválida",
} as const;
export const PREFIJO_RECHAZO = "pedido de token rechazado";
export const PREFIJO_CONEXION = "token ok, falló la conexión a LiveKit";
export const PREFIJO_PUBLICAR = "conectado, falló publicar las pistas";
/** Estado HTTP de /api/livekit/token → motivo. 503 = el servidor no tiene las variables (o la URL no es ws/wss). */
export function motivoPorEstado(estado: number): string {
  return estado === 503 ? MOTIVO_TOKEN.sinClaves : `${PREFIJO_RECHAZO} (${estado})`;
}
const RE_URL = /^wss?:\/\/[^\s"'<>]{1,240}$/i;
/** Cuerpo 200 de la ruta → token + url (la url la da el SERVIDOR; debe ser ws:// o wss://). */
export function leerRespuestaToken(j: unknown): RespuestaToken {
  const o = (j && typeof j === "object" ? j : {}) as { token?: unknown; url?: unknown };
  if (typeof o.token !== "string" || !o.token || typeof o.url !== "string" || !RE_URL.test(o.url)) return { ok: false, motivo: MOTIVO_TOKEN.invalida };
  return { ok: true, token: o.token, url: o.url };
}
/** Motivo breve del SDK: primera línea, sin nada con forma de JWT, máx. 80 caracteres. */
export function motivoBreve(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const limpio = m.split("\n")[0].replace(/eyJ[\w-]*\.[\w-]*\.[\w-]*/g, "[token]").replace(/(access_token|token)=[^&\s]+/gi, "$1=[token]").trim();
  return limpio.length > 80 ? limpio.slice(0, 79) + "…" : limpio;
}

export class PublicadorLiveKit {
  estado: EstadoLK = "inactivo";
  ultimoError = "";
  errores = 0;
  reconexiones = 0;
  pistas = { video: false, audio: false };
  modo: ModoLK | null = null;
  private sala: SalaLK | null = null;
  private video: PistaLK | null = null;
  private audio: PistaLK | null = null;
  private gen = 0;
  private readonly deps: DepsLK;
  private readonly cfg: CfgLK;
  constructor(deps: DepsLK, cfg: CfgLK) { this.deps = deps; this.cfg = cfg; }

  get activo(): boolean { return this.estado === "pidiendo" || this.estado === "conectando" || this.estado === "publicando" || this.estado === "reconectando"; }

  /** Arranca la publicación. Rechaza sin consentimiento explícito. Nunca lanza. */
  iniciar(p: PedidoLK): ResultadoLK {
    if (!p || p.consentimiento !== true) return { ok: false, motivo: "sin consentimiento" };
    if (p.modo !== "cara" && p.modo !== "privado") return { ok: false, motivo: "modo inválido" };
    if (typeof p.sesionId !== "string" || !RE_ID.test(p.sesionId)) return { ok: false, motivo: "sesionId inválido" };
    if (this.activo) return { ok: true };   // uno solo
    const g = ++this.gen;
    this.modo = p.modo; this.estado = "pidiendo"; this.ultimoError = "";
    void this.correr(g, p).catch(() => { if (g === this.gen) this.falla("error al publicar"); });
    return { ok: true };
  }

  private async correr(g: number, p: PedidoLK): Promise<void> {
    let r: RespuestaToken;
    try { r = await this.deps.pedirToken(p.sesionId); } catch { r = { ok: false, motivo: "sin red" }; }
    if (g !== this.gen) return;
    if (!r.ok) { this.falla(r.motivo); return; }
    this.estado = "conectando";
    const sala = await this.deps.crearSala();
    if (g !== this.gen) { try { sala.desconectar(); } catch { /* nada */ } return; }
    this.sala = sala;
    sala.alEvento(e => {
      if (g !== this.gen) return;
      if (e === "reconectando") { this.estado = "reconectando"; this.reconexiones++; }
      else if (e === "reconectado" || e === "conectado") { if (this.estado === "reconectando") this.estado = "publicando"; }
      else if (e === "desconectado" && this.estado !== "conectando") this.falla("se perdió la conexión con LiveKit");   // Z92b: al conectar manda el rechazo de connect (trae el motivo)
    });
    try { await sala.conectar(r.url, r.token); }
    catch (e) { if (g === this.gen) { const m = motivoBreve(e); this.falla(m ? `${PREFIJO_CONEXION}: ${m}` : PREFIJO_CONEXION); } return; }
    if (g !== this.gen) { this.liberar(); return; }
    const v = this.deps.video(p.modo, this.cfg);
    this.video = v;
    try {
      if (v) { await sala.publicarVideo(v, this.cfg); if (g !== this.gen) return; this.pistas.video = true; }
      const a = this.deps.audio();
      this.audio = a;
      if (a) { await sala.publicarAudio(a, this.cfg); if (g !== this.gen) return; this.pistas.audio = true; }
    } catch (e) { if (g === this.gen) { const m = motivoBreve(e); this.falla(m ? `${PREFIJO_PUBLICAR}: ${m}` : PREFIJO_PUBLICAR); } return; }
    this.estado = "publicando";
  }

  private falla(motivo: string): void {
    this.errores++; this.ultimoError = motivo;
    this.gen++;
    this.liberar();
    this.estado = "sin_conexion";
  }

  private liberar(): void {
    const v = this.video, a = this.audio, s = this.sala;
    this.video = null; this.audio = null; this.sala = null;
    this.pistas.video = false; this.pistas.audio = false;
    if (s) { try { s.desconectar(); } catch { /* ya desconectada */ } }
    if (v) { try { v.liberar(); } catch { /* ok */ } }
    if (a) { try { a.liberar(); } catch { /* ok */ } }
  }

  /** Corte (botón, X, límite, salida, pagehide): inmediato. */
  detener(): void {
    this.gen++;
    this.liberar();
    if (this.estado !== "inactivo") this.estado = "detenido";
  }

  /** Z92b: diagnóstico para el menú (sin datos sensibles). */
  get diagnostico(): string {
    switch (this.estado) {
      case "inactivo": return "sin pedir";
      case "pidiendo": return "pidiendo token…";
      case "conectando": return "token ok, conectando a LiveKit…";
      case "publicando": return "conectado";
      case "reconectando": return "conectado · el SDK está reconectando";
      case "detenido": return "detenido (corte)";
      default: return this.ultimoError || "sin conexión";
    }
  }

  /**
   * Z94b: cambia la pista de video en caliente (respaldo del video procesado). La nueva reemplaza a la publicada en el
   * mismo publicador; la vieja se libera. Si no se puede (sin sala, sin video publicado o el SDK falla), libera la nueva
   * y devuelve false (la transmisión sigue como estaba). Nunca lanza.
   */
  async cambiarVideo(nueva: PistaLK): Promise<boolean> {
    const s = this.sala, g = this.gen;
    if (!s || !s.reemplazarVideo || !this.pistas.video || (this.estado !== "publicando" && this.estado !== "reconectando")) {
      try { nueva.liberar(); } catch { /* ok */ }
      return false;
    }
    try { await s.reemplazarVideo(nueva); }
    catch { try { nueva.liberar(); } catch { /* ok */ } return false; }
    if (g !== this.gen) { try { nueva.liberar(); } catch { /* ok */ } return false; }   // cortada mientras tanto
    const vieja = this.video;
    this.video = nueva;
    if (vieja) { try { vieja.liberar(); } catch { /* ok */ } }
    return true;
  }

  pausar(p: boolean): void { try { this.sala?.pausar(p); } catch { /* ok */ } }
  kbps(): number { try { return this.sala ? this.sala.kbps() : 0; } catch { return 0; } }
  /** ¿Queda algo vivo? (para la prueba: cortar libera todo) */
  get recursosVivos(): number { return (this.sala ? 1 : 0) + (this.video ? 1 : 0) + (this.audio ? 1 : 0); }
}
