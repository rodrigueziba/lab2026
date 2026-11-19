// Z93: recepción de la transmisión de la tarima en SILLAS (LiveKit, rol "escuchar"). Lógica PURA y SIN imports: la
// sala (livekit-client, cargado de forma dinámica), el token, el DOM y el AudioContext se inyectan
// (lib/vivo/recibirLiveKit.ts), así que se prueba en Node con un cliente simulado (scripts/livekit-recibir-test.mjs).
//
// Conecta SOLO con las tres condiciones: el espectador aceptó el aviso (Z85), la presencia dice que hay sesión viva (Z89)
// y la fuente es la real (DBG_VIVO.FUENTE "livekit" o "auto"), y además algún monolito pide medios (kSonido o kVideo > 0).
// Desconecta: sin alguna de las tres, o con kSonido = kVideo = 0 durante ESPERA_DESUSCRIBIR_S (los pesos llegan a 0 cuando
// terminan el sostén de 15 s y el retorno de Z82), o al desmontar (detener).
// Suscripción manual (autoSubscribe false): audio solo con kSonido > 0, video solo con kVideo > 0; se des-suscribe tras
// ESPERA_DESUSCRIBIR_S con el peso en 0 (sin oscilar).
// Señal débil: suscrito pero sin medios durante SENAL_DEBIL_S. Reconexión: el SDK reintenta solo ("reconectando"); si se
// rinde (desconectado) y la sesión sigue, reintentos propios con espera creciente (BASE·2^(n-1), tope MAX) hasta
// MAX_REINTENTOS → "error". 503 = el servidor no tiene las claves → "sin_servidor" (no se reintenta).

export type EstadoRx = "desconectado" | "esperando_aceptacion" | "pidiendo" | "conectando" | "conectado" | "reconectando"
  | "esperando_reintento" | "sin_servidor" | "error";
export type TipoPista = "audio" | "video";
export type EventoRx = "reconectando" | "reconectado" | "desconectado";
export interface CfgRx {
  ESPERA_DESUSCRIBIR_S: number; SENAL_DEBIL_S: number; REINTENTO_BASE_S: number; REINTENTO_MAX_S: number; MAX_REINTENTOS: number;
}
/** estado: código HTTP del pedido (0 = sin red). */
export type TokenRx = { ok: true; token: string; url: string } | { ok: false; estado: number; motivo: string };
export interface SalaRx {
  conectar(url: string, token: string): Promise<void>;
  alEvento(cb: (e: EventoRx) => void): void;
  /** El participante de la tarima tiene publicada una pista de ese tipo. */
  hayPista(t: TipoPista): boolean;
  suscribir(t: TipoPista, si: boolean): void;
  /** Llegan medios de esa pista (la pista remota dejó de estar "muted"). */
  llega(t: TipoPista): boolean;
  kbps(): number;
  desconectar(): void;
}
export interface DepsRx { pedirToken(): Promise<TokenRx>; crearSala(): Promise<SalaRx> }
export interface EntradaRx { aceptada: boolean; sesionViva: boolean; fuenteReal: boolean; kSonido: number; kVideo: number; ahora: number; pausarRecepcion: boolean }

const ms = (s: number, d: number): number => Math.max(0, Number.isFinite(s) ? s : d) * 1000;
/** Espera del intento n (1, 2, …): BASE·2^(n-1) con tope MAX (s). */
export function esperaReintentoS(n: number, c: CfgRx): number {
  const base = Math.max(0, c.REINTENTO_BASE_S), max = Math.max(base, c.REINTENTO_MAX_S);
  return Math.min(max, base * Math.pow(2, Math.max(0, n - 1)));
}
/** Motivo breve del SDK: una línea, sin nada con forma de JWT, máx. 60 caracteres. */
export function motivoCorto(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const l = m.split("\n")[0].replace(/eyJ[\w-]*\.[\w-]*\.[\w-]*/g, "[token]").replace(/(access_token|token)=[^&\s]+/gi, "$1=[token]").trim();
  return l.length > 60 ? l.slice(0, 59) + "…" : l;
}

export class ReceptorLiveKit {
  estado: EstadoRx = "desconectado";
  motivo = "";
  reconexiones = 0;      // del SDK y propias
  errores = 0;
  intento = 0;           // reintentos propios seguidos
  conexiones = 0;        // conexiones exitosas
  readonly sus = { audio: false, video: false };
  readonly senal = { audio: false, video: false, debil: false };
  private sala: SalaRx | null = null;
  private gen = 0;
  private ultimo = 0; private tUso = 0; private tA = 0; private tV = 0; private tSinMedios = 0; private tReintento = 0;
  private readonly deps: DepsRx;
  private readonly cfg: CfgRx;
  constructor(deps: DepsRx, cfg: CfgRx) { this.deps = deps; this.cfg = cfg; }

  get abierta(): boolean { return this.sala !== null; }
  get ocupado(): boolean { return this.estado === "pidiendo" || this.estado === "conectando"; }
  kbps(): number { try { return this.sala ? this.sala.kbps() : 0; } catch { return 0; } }

  /** Un paso (por cuadro). Sin allocations. */
  tick(e: EntradaRx): void {
    this.ultimo = e.ahora;
    const quiere = e.aceptada && e.sesionViva && e.fuenteReal;
    if (!quiere) {
      if (this.sala || this.ocupado) this.cortar();
      this.intento = 0; this.limpiarSenal();
      // "sin servidor" se mantiene mientras dure la sesión (no se reintenta); se olvida cuando termina
      if (this.estado === "sin_servidor" && e.sesionViva && e.fuenteReal) return;
      this.motivo = "";
      this.estado = e.fuenteReal && e.sesionViva && !e.aceptada ? "esperando_aceptacion" : "desconectado";
      return;
    }
    const kS = e.pausarRecepcion ? 0 : e.kSonido, kV = e.pausarRecepcion ? 0 : e.kVideo;
    const uso = e.kSonido > 0 || e.kVideo > 0;   // la pausa del benchmark no desconecta
    if (uso) this.tUso = e.ahora;
    switch (this.estado) {
      case "sin_servidor": case "error": case "pidiendo": case "conectando": return;
      case "desconectado": case "esperando_aceptacion":
        if (uso) this.conectar();
        return;
      case "esperando_reintento":
        if (e.ahora >= this.tReintento) this.conectar();
        return;
      default: break;   // conectado / reconectando
    }
    const s = this.sala;
    if (!s) return;
    if (!uso && e.ahora - this.tUso >= ms(this.cfg.ESPERA_DESUSCRIBIR_S, 2)) { this.cortar(); this.estado = "desconectado"; this.limpiarSenal(); return; }
    this.suscripcion(s, "audio", kS, e.ahora);
    this.suscripcion(s, "video", kV, e.ahora);
    // señal
    this.senal.audio = this.sus.audio && s.llega("audio");
    this.senal.video = this.sus.video && s.llega("video");
    if ((this.sus.audio || this.sus.video) && !this.senal.audio && !this.senal.video) {
      if (!this.tSinMedios) this.tSinMedios = e.ahora;
      this.senal.debil = e.ahora - this.tSinMedios >= ms(this.cfg.SENAL_DEBIL_S, 5);
    } else { this.tSinMedios = 0; this.senal.debil = false; }
  }

  private suscripcion(s: SalaRx, t: TipoPista, k: number, ahora: number): void {
    const quiere = k > 0, hay = s.hayPista(t);
    if (quiere) { if (t === "audio") this.tA = ahora; else this.tV = ahora; }
    if (!hay) { this.sus[t] = false; return; }   // el participante se fue o no publica ese tipo
    if (quiere && !this.sus[t]) { this.sus[t] = true; s.suscribir(t, true); return; }
    const desde = t === "audio" ? this.tA : this.tV;
    if (!quiere && this.sus[t] && ahora - desde >= ms(this.cfg.ESPERA_DESUSCRIBIR_S, 2)) { this.sus[t] = false; s.suscribir(t, false); }
  }

  private conectar(): void {
    const g = ++this.gen;
    this.estado = "pidiendo";
    void this.correr(g).catch(err => { if (g === this.gen) this.falla(motivoCorto(err) || "error al conectar"); });
  }

  private async correr(g: number): Promise<void> {
    let r: TokenRx;
    try { r = await this.deps.pedirToken(); } catch { r = { ok: false, estado: 0, motivo: "sin red al pedir el token" }; }
    if (g !== this.gen) return;
    if (!r.ok) {
      if (r.estado === 503) { this.estado = "sin_servidor"; this.motivo = "servidor sin claves (503)"; this.errores++; return; }
      if (r.estado === 400) { this.estado = "error"; this.motivo = r.motivo || "pedido rechazado (400)"; this.errores++; return; }
      this.falla(r.motivo || `token (${r.estado})`);   // 429 o sin red: reintento con espera
      return;
    }
    this.estado = "conectando";
    const sala = await this.deps.crearSala();
    if (g !== this.gen) { try { sala.desconectar(); } catch { /* nada */ } return; }
    this.sala = sala;
    sala.alEvento(ev => {
      if (g !== this.gen) return;
      if (ev === "reconectando") { this.estado = "reconectando"; this.reconexiones++; }
      else if (ev === "reconectado") { if (this.estado === "reconectando") this.estado = "conectado"; }
      else if (ev === "desconectado" && this.estado !== "conectando") this.falla("se perdió la conexión");
    });
    try { await sala.conectar(r.url, r.token); }
    catch (err) { if (g === this.gen) this.falla(`falló la conexión: ${motivoCorto(err) || "sin motivo"}`); return; }
    if (g !== this.gen) { this.cortar(); return; }
    this.estado = "conectado"; this.motivo = ""; this.intento = 0; this.conexiones++;
  }

  private falla(motivo: string): void {
    this.errores++; this.motivo = motivo;
    this.cortar();
    this.limpiarSenal();
    this.intento++;
    if (this.intento > Math.max(0, Math.floor(this.cfg.MAX_REINTENTOS))) { this.estado = "error"; return; }
    this.reconexiones++;
    this.estado = "esperando_reintento";
    this.tReintento = this.ultimo + esperaReintentoS(this.intento, this.cfg) * 1000;   // desde el último cuadro visto
  }

  /** Suelta la sala (sin tocar el estado). */
  private cortar(): void {
    this.gen++;
    const s = this.sala; this.sala = null;
    this.sus.audio = false; this.sus.video = false;
    if (s) { try { s.desconectar(); } catch { /* ya desconectada */ } }
  }
  private limpiarSenal(): void { this.senal.audio = false; this.senal.video = false; this.senal.debil = false; this.tSinMedios = 0; }

  /** Desmontaje: corta y deja todo en cero. */
  detener(): void { this.cortar(); this.limpiarSenal(); this.estado = "desconectado"; this.intento = 0; this.motivo = ""; }
}

/** Línea de estado (sin datos sensibles). */
export function textoRx(r: ReceptorLiveKit): string {
  switch (r.estado) {
    case "desconectado": return "desconectado";
    case "esperando_aceptacion": return "esperando aceptación";
    case "pidiendo": case "conectando": return "conectando";
    case "reconectando": return "reconectando";
    case "esperando_reintento": return `reconectando (intento ${r.intento})`;
    case "sin_servidor": return "sin servidor (503)";
    case "error": return `error: ${r.motivo || "sin motivo"}`;
    default:
      if (r.senal.audio && r.senal.video) return "recibiendo ambos";
      if (r.senal.audio) return "recibiendo audio";
      if (r.senal.video) return "recibiendo video";
      if (r.senal.debil) return "señal débil";
      return "conectado sin medios";
  }
}

// ── medios remotos (elementos y nodos; entorno inyectado para probar la limpieza en Node) ──
export interface ElementoMedio {
  srcObject: unknown; muted: boolean; autoplay: boolean;
  play(): Promise<void> | void; remove(): void;
}
export interface NodoAudio { connect(d: unknown): unknown; disconnect(): void }
export interface CtxAudio { createGain(): NodoAudio; createMediaStreamSource(s: unknown): NodoAudio }
export interface EntornoMedios {
  /** <video> o <audio> oculto (muted, autoplay, playsInline), fuera de pantalla. */
  crear(tag: "video" | "audio"): ElementoMedio;
  stream(pista: unknown): unknown;   // new MediaStream([pista])
}

/**
 * Pistas remotas → <video> oculto (lo usa crearFuenteVideo del domo) y nodo de audio en el contexto de vizAudio.
 * Contorno de Chrome: la misma pista de audio en un <audio> silenciado (para que fluya por Web Audio); lo único audible
 * sale por el nodo (que va a la ganancia remota de vizAudio).
 */
export class MediosRemotos {
  video: ElementoMedio | null = null;
  audioEl: ElementoMedio | null = null;
  private pistaAudio: unknown = null;
  private pistaVideo: unknown = null;
  private ctx: CtxAudio | null = null;
  private salida: NodoAudio | null = null;
  private fuente: NodoAudio | null = null;
  private readonly ent: EntornoMedios;
  constructor(ent: EntornoMedios) { this.ent = ent; }

  /** <video> estable para el domo (se crea una vez; sin pista queda vacío y el domo muestra estática). */
  elementoVideo(): ElementoMedio {
    if (!this.video) this.video = this.ent.crear("video");
    return this.video;
  }
  ponerVideo(pista: unknown): void {
    if (pista === this.pistaVideo) return;
    this.pistaVideo = pista;
    const v = this.elementoVideo();
    v.srcObject = pista ? this.ent.stream(pista) : null;
    if (pista) { try { void Promise.resolve(v.play()).catch(() => {}); } catch { /* autoplay */ } }
  }
  ponerAudio(pista: unknown, contorno: boolean): void {
    if (pista === this.pistaAudio && (!!this.audioEl === (contorno && !!pista))) return;
    if (pista !== this.pistaAudio) { this.soltarFuente(); this.pistaAudio = pista; }
    if (pista && contorno) {
      if (!this.audioEl) this.audioEl = this.ent.crear("audio");
      this.audioEl.muted = true;   // nunca audible: solo hace fluir la pista
      this.audioEl.srcObject = this.ent.stream(pista);
      try { void Promise.resolve(this.audioEl.play()).catch(() => {}); } catch { /* autoplay */ }
    } else if (this.audioEl) { this.audioEl.srcObject = null; this.audioEl.remove(); this.audioEl = null; }
    if (pista && this.ctx && this.salida) this.conectarFuente();
  }
  /** Nodo estable del contexto de vizAudio (va a la ganancia remota). Conecta la pista cuando la hay. */
  nodoAudio(ctx: CtxAudio): NodoAudio {
    if (this.ctx !== ctx || !this.salida) { this.soltarFuente(); try { this.salida?.disconnect(); } catch { /* ok */ } this.ctx = ctx; this.salida = ctx.createGain(); }
    if (this.pistaAudio && !this.fuente) this.conectarFuente();
    return this.salida;
  }
  private conectarFuente(): void {
    if (!this.ctx || !this.salida || this.fuente || !this.pistaAudio) return;
    try { this.fuente = this.ctx.createMediaStreamSource(this.ent.stream(this.pistaAudio)); this.fuente.connect(this.salida); }
    catch { this.fuente = null; }
  }
  private soltarFuente(): void { if (this.fuente) { try { this.fuente.disconnect(); } catch { /* ok */ } this.fuente = null; } }
  /** Cuántos recursos quedan vivos (elementos y nodos): 0 tras liberar. */
  get vivos(): number { return (this.video ? 1 : 0) + (this.audioEl ? 1 : 0) + (this.salida ? 1 : 0) + (this.fuente ? 1 : 0); }
  liberar(): void {
    this.soltarFuente();
    if (this.salida) { try { this.salida.disconnect(); } catch { /* ok */ } this.salida = null; }
    this.ctx = null;
    for (const el of [this.video, this.audioEl]) if (el) { el.srcObject = null; el.remove(); }
    this.video = null; this.audioEl = null; this.pistaAudio = null; this.pistaVideo = null;
  }
}
