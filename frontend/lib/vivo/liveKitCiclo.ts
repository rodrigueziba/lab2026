// Z92: ciclo de vida del publicador de LiveKit de la tarima. Lógica PURA y SIN imports: el SDK (livekit-client, cargado
// de forma dinámica), el token, las pistas y el reloj se inyectan (lib/vivo/publicarLiveKit.ts), así que se prueba en
// Node con un cliente simulado (scripts/livekit-test.mjs).
// Estados: inactivo → pidiendo (token) → conectando → publicando ⇄ reconectando (el SDK reintenta solo)
//          → sin_conexion (token rechazado, sin variables, sin red, o el SDK se rindió) · detenido (corte).
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
      else if (e === "desconectado") this.falla("conexión perdida");
    });
    await sala.conectar(r.url, r.token);
    if (g !== this.gen) { this.liberar(); return; }
    const v = this.deps.video(p.modo, this.cfg);
    this.video = v;
    if (v) { await sala.publicarVideo(v, this.cfg); if (g !== this.gen) return; this.pistas.video = true; }
    const a = this.deps.audio();
    this.audio = a;
    if (a) { await sala.publicarAudio(a, this.cfg); if (g !== this.gen) return; this.pistas.audio = true; }
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

  pausar(p: boolean): void { try { this.sala?.pausar(p); } catch { /* ok */ } }
  kbps(): number { try { return this.sala ? this.sala.kbps() : 0; } catch { return 0; } }
  /** ¿Queda algo vivo? (para la prueba: cortar libera todo) */
  get recursosVivos(): number { return (this.sala ? 1 : 0) + (this.video ? 1 : 0) + (this.audio ? 1 : 0); }
}
