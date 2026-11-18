// Z94: video de la transmisión de la tarima = la imagen PROCESADA del domo (efectos por sector, glitches, ajustes del atril
// de imagen), no la webcam cruda. Lógica PURA y SIN imports (prueba: scripts/video-procesado-test.mjs).
//
// Cómo se obtiene (Z94b; la ruta de Z94 con drawImage del framebuffer principal fallaba siempre: llamaba a
// WebGLRenderer.prototype.render, que no existe en three 0.183 porque render se define en el constructor):
// components/VideoTransmitidoTarima.tsx dibuja, con el renderer PRINCIPAL (render original, no el composer) y el MISMO
// shader del domo (FaceDome: DOME_FRAG con sus uniforms compartidos por referencia → el atril se refleja en vivo), un quad
// plano a un WebGLRenderTarget propio de 640×360; lo lee con readRenderTargetPixelsAsync (asíncrono: PBO + fence) en un
// Uint8Array único; putImageData en un canvas 2D único y requestFrame de su pista captureStream(0) = la pista que publica
// LiveKit (Z92). Una sola copia plana (las 7 franjas del domo desenrolladas): SILLAS la repite y la cubre (Z84).
// Respaldo: si no hay cuadros en PROCESADO_TIMEOUT_S, el publicador reemplaza la pista por la "cruda" sin reconectar.
// Solo con transmisión activa: sin ella no se crea nada (ni canvas, ni pista, ni material, ni quad).

export type FuenteVideoTx = "procesado" | "cruda" | "ondas";
export function normalizarFuenteVideo(v: string): FuenteVideoTx {
  return v === "cruda" || v === "ondas" ? v : "procesado";
}

/** Qué hay disponible al iniciar la transmisión. */
export interface DisponibleVideo { procesado: boolean; webcam: boolean; ondas: boolean }
export interface EleccionVideo { efectiva: FuenteVideoTx | null; respaldo: boolean; motivo: string }
const _el: EleccionVideo = { efectiva: null, respaldo: false, motivo: "" };
/**
 * Fuente efectiva (objeto de resultado reutilizado):
 *  - "procesado": el pase procesado si está disponible; si no, respaldo a "cruda".
 *  - "cruda" (Z92): modo "cara" con webcam → webcam; si no → ondas.
 *  - "ondas": el canvas de ondas de Z87.
 */
export function elegirFuenteVideo(pedida: string, modo: "cara" | "privado", d: DisponibleVideo): EleccionVideo {
  const p = normalizarFuenteVideo(pedida);
  _el.respaldo = false; _el.motivo = "";
  if (p === "procesado") {
    if (d.procesado) { _el.efectiva = "procesado"; return _el; }
    _el.respaldo = true; _el.motivo = "pase procesado no disponible";
  }
  if (p === "ondas") { _el.efectiva = d.ondas ? "ondas" : null; return _el; }
  _el.efectiva = modo === "cara" && d.webcam ? "cruda" : d.ondas ? "ondas" : null;
  return _el;
}

/** Cadencia a `fps` y fps real publicado (ventana de 1 s). Sin allocations. */
export class Cadencia {
  private ultimo = -Infinity;
  private ventana = 0;
  private cuenta = 0;
  fpsReal = 0;
  cuadros = 0;
  /** ¿Toca dibujar en este cuadro? (deja un margen del 10 % para no perder cuadros por el jitter del rAF) */
  toca(ahoraMs: number, fps: number): boolean {
    const intervalo = 1000 / Math.max(1, Math.min(60, fps));
    return ahoraMs - this.ultimo >= intervalo * 0.9;
  }
  /** Z94b: el turno se marca al EMPEZAR (la lectura asíncrona tarda): la cadencia no depende de cuánto tarda. */
  marcar(ahoraMs: number): void { this.ultimo = ahoraMs; }
  dibujado(ahoraMs: number): void { this.ultimo = ahoraMs; this.contar(ahoraMs); }
  /** Cuenta un cuadro publicado (fps real). */
  contar(ahoraMs: number): void {
    this.cuadros++;
    if (!this.ventana) { this.ventana = ahoraMs; return; }   // el cuadro que abre la ventana no se cuenta
    this.cuenta++;
    const dt = ahoraMs - this.ventana;
    if (dt >= 1000) { this.fpsReal = (this.cuenta * 1000) / dt; this.cuenta = 0; this.ventana = ahoraMs; }
  }
  reiniciar(): void { this.ultimo = -Infinity; this.ventana = 0; this.cuenta = 0; this.fpsReal = 0; this.cuadros = 0; }
}

/**
 * Canvas transmisible (2D) con su pista de captureStream(0), creado UNA vez por transmisión. `buffer` (w·h·4) y la imagen
 * comparten memoria (ImageData sobre el mismo ArrayBuffer): la lectura asíncrona escribe en `buffer` y `pintar()` hace
 * putImageData + requestFrame (un cuadro publicado por actualización). Nace con un cuadro negro ya pedido.
 */
export interface Lienzo { canvas: unknown; ctx: unknown; pista: unknown; buffer: Uint8Array; pintar(): void; detenerPista(): void; quitar(): void }
export interface FabricaLienzo { crear(ancho: number, alto: number): Lienzo | null }
export type EstadoLectura = "esperando" | "ok" | "saltando" | "falló";
export type EstadoPase = "dibujando" | "pausado" | "no disponible";

/** Motivo breve de una excepción (una línea, máx. 70 caracteres). */
export function motivoBreveVP(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const l = (m.split("\n")[0] || "error sin mensaje").trim();
  return l.length > 70 ? l.slice(0, 69) + "…" : l;
}

/**
 * Z94b: estado del pase procesado. Ruta: el host dibuja el pase a un WebGLRenderTarget propio y lo lee con
 * readRenderTargetPixelsAsync (PBO + fence de three: sin bloquear la GPU) en `lienzo.buffer`; al completarse, alLeer →
 * pintar(). Nunca más de una lectura en vuelo (empezarLectura devuelve false → se saltea el cuadro). Al liberar, las
 * lecturas pendientes se ignoran (generación). vigilar(): sin lecturas en TIMEOUT_S desde el inicio, o sin cuadros nuevos
 * durante TIMEOUT_S seguidos → motivo (el publicador cambia a "cruda").
 */
export class TransmisionProcesada {
  lienzo: Lienzo | null = null;
  ancho = 640; alto = 360; fps = 15;
  readonly cadencia = new Cadencia();
  fallo = "";                    // motivo corto del último fallo (sin datos sensibles)
  creados = 0; liberados = 0;    // diagnóstico de fugas
  enVuelo = false;
  lecturas = 0; saltados = 0; ignoradas = 0; pintados = 0;
  // Z94c: estado del pase (lo escribe el host), turnos sin cuadro, lecturas colgadas y totales
  pase: EstadoPase = "no disponible";
  motivoPase = "";
  turnosSinCuadro = 0;           // turnos en los que el pase PODÍA dibujar y no salió un cuadro nuevo
  colgadas = 0;
  publicando = false;            // la pista de este lienzo es la publicada (no una prueba en segundo plano)
  publicadosTotal = 0;           // cuadros procesados publicados (acumulado de la página)
  private inicioLectura = 0;
  estadoLectura: EstadoLectura = "esperando";
  motivoLectura = "";
  inicioMs = 0; ultimaMs = 0;
  private gen = 0; private genVuelo = -1;
  private readonly fab: FabricaLienzo;
  private readonly reloj: () => number;
  constructor(fab: FabricaLienzo, reloj: () => number) { this.fab = fab; this.reloj = reloj; }

  get activa(): boolean { return this.lienzo !== null; }

  /** Crea el canvas, el buffer y la pista (con un primer cuadro negro). null si falla (y deja el motivo). */
  iniciar(ancho: number, alto: number, fps: number): { track: unknown } | null {
    if (this.lienzo) return { track: this.lienzo.pista };
    this.ancho = Math.max(16, Math.round(ancho)); this.alto = Math.max(16, Math.round(alto)); this.fps = Math.max(1, Math.min(30, fps));
    let l: Lienzo | null = null;
    try { l = this.fab.crear(this.ancho, this.alto); } catch (e) { this.fallo = `no se pudo crear el canvas: ${motivoBreveVP(e)}`; return null; }
    if (!l || !l.pista) { this.fallo = "no se pudo crear el canvas transmisible"; return null; }
    this.lienzo = l; this.fallo = ""; this.creados++;
    this.cadencia.reiniciar();
    this.enVuelo = false; this.lecturas = 0; this.saltados = 0; this.pintados = 0; this.turnosSinCuadro = 0; this.publicando = false;
    this.estadoLectura = "esperando"; this.motivoLectura = "";
    this.inicioMs = this.reloj(); this.ultimaMs = 0;
    return { track: l.pista };
  }

  /** El host va a leer: false si no hay lienzo o si ya hay una lectura en vuelo (se saltea el cuadro). */
  /** Z94c: el host informa el estado del pase (strings constantes: sin allocations). */
  marcarPase(estado: EstadoPase, motivo: string): void { this.pase = estado; this.motivoPase = motivo; }
  /** Z94c: un turno en el que el pase puede dibujar (solo estos cuentan para el vigía). */
  turno(): void { this.turnosSinCuadro++; }
  /** Z94c: libera una lectura que no termina en maxMs (la respuesta tardía se ignora). */
  vigilarLectura(ahoraMs: number, maxMs: number): void {
    if (!this.enVuelo || ahoraMs - this.inicioLectura < Math.max(100, maxMs)) return;
    this.enVuelo = false; this.genVuelo = -1; this.colgadas++;
    this.estadoLectura = "falló"; this.motivoLectura = "lectura colgada";
  }
  empezarLectura(ahoraMs: number): boolean {
    if (!this.lienzo) return false;
    if (this.enVuelo) { this.saltados++; if (this.estadoLectura !== "falló") this.estadoLectura = "saltando"; return false; }
    this.enVuelo = true; this.genVuelo = this.gen; this.inicioLectura = ahoraMs;
    this.cadencia.marcar(ahoraMs);
    return true;
  }
  /** Lectura completa (handler creado una vez: se pasa directo a .then). */
  readonly alLeer = (): void => {
    if (this.genVuelo !== this.gen || !this.lienzo) { this.ignoradas++; return; }   // cortada mientras leía
    this.enVuelo = false;
    try { this.lienzo.pintar(); } catch (e) { this.alFallar(e); return; }
    const t = this.reloj();
    this.cadencia.contar(t);
    this.lecturas++; this.pintados++; this.ultimaMs = t; this.turnosSinCuadro = 0;
    if (this.publicando) this.publicadosTotal++;
    this.estadoLectura = "ok"; this.motivoLectura = ""; this.fallo = "";
  };
  /** Lectura (o pase) fallida (handler creado una vez: se pasa directo a .catch / .then). */
  readonly alFallar = (e: unknown): void => {
    if (this.genVuelo !== this.gen || !this.lienzo) { this.ignoradas++; return; }
    this.enVuelo = false;
    this.estadoLectura = "falló"; this.motivoLectura = motivoBreveVP(e);
    this.fallo = `lectura: ${this.motivoLectura}`;
  };
  /** El host avisa que no puede dibujar (p. ej. el domo se fue): queda el último cuadro y el motivo. */
  marcarFallo(motivo: string): void { this.fallo = motivo; }

  /**
   * Vigía (cada ~0,5 s). "" = bien; si no, el motivo para cambiar a "cruda". pausado = benchmark (no cuenta).
   * Z94c: cuenta TURNOS en los que el pase podía dibujar (TIMEOUT_S · fps) además del tiempo: un cuadro largo del hilo
   * principal (recompilar materiales, entrar al atril) o el pase pausado/no disponible ya no lo disparan.
   */
  vigilar(ahora: number, timeoutS: number, pausado: boolean): string {
    if (!this.lienzo) return "";
    const lim = Math.max(0.5, Number.isFinite(timeoutS) ? timeoutS : 3) * 1000;
    if (pausado || this.pase !== "dibujando") { this.turnosSinCuadro = 0; if (this.ultimaMs) this.ultimaMs = ahora; else this.inicioMs = ahora; return ""; }
    const turnos = Math.max(2, Math.ceil((lim / 1000) * this.fps));
    if (this.turnosSinCuadro < turnos || ahora - (this.lecturas ? this.ultimaMs : this.inicioMs) < lim) return "";
    const que = this.lecturas ? "sin cuadros nuevos" : "ninguna lectura";
    const lect = this.estadoLectura === "saltando" ? `lectura en vuelo sin terminar, ${this.saltados} salteados`
      : this.estadoLectura === "falló" ? `lectura falló: ${this.motivoLectura}` : `lectura ${this.estadoLectura}`;
    return `${que} en ${(lim / 1000).toFixed(0)} s (${this.turnosSinCuadro} turnos; ${lect}${this.fallo && this.estadoLectura !== "falló" ? `; ${this.fallo}` : ""})`;
  }

  liberar(): void {
    const l = this.lienzo;
    this.gen++;                                   // lecturas pendientes: se ignoran al llegar
    this.enVuelo = false;
    if (!l) return;
    this.lienzo = null; this.liberados++; this.publicando = false; this.turnosSinCuadro = 0;
    try { l.detenerPista(); } catch { /* ya detenida */ }
    try { l.quitar(); } catch { /* ok */ }
    this.cadencia.reiniciar();
  }
}

// ── Z94c: respaldo REVERSIBLE (procesado ⇄ cruda) ──
export type EstadoRespaldo = "inactivo" | "procesado" | "cruda" | "probando" | "cruda_final";
export interface CfgRespaldo { PROCESADO_REINTENTO_S: number; PROCESADO_MAX_REINTENTOS: number; PROCESADO_CONFIRMAR_S: number; PROCESADO_TIMEOUT_S: number }
export type ResultadoPrueba = "seguir" | "confirmar" | "fallar";
/**
 * procesado --(vigía: falla)--> cruda --(cada REINTENTO_S, con condiciones)--> probando (el pase vuelve a dibujar EN
 * SEGUNDO PLANO, sin publicarse; la cruda sigue al aire) --(cuadros durante CONFIRMAR_S)--> procesado (replaceTrack)
 *                                                        \--(vigía o sin cuadros)--> cruda (otro intervalo)
 * Tope: MAX_REINTENTOS por transmisión → cruda_final. Pura (reloj inyectado por parámetro).
 */
export class RespaldoVideo {
  estado: EstadoRespaldo = "inactivo";
  reintentos = 0; aCruda = 0; aProcesado = 0;
  ultimoMotivo = "";
  proximoMs = 0; inicioPruebaMs = 0;
  private readonly cfg: CfgRespaldo;
  constructor(cfg: CfgRespaldo) { this.cfg = cfg; }
  private max(): number { return Math.max(0, Math.floor(this.cfg.PROCESADO_MAX_REINTENTOS)); }
  private espera(): number { return Math.max(1, this.cfg.PROCESADO_REINTENTO_S) * 1000; }

  /** Nueva transmisión: "procesado" si arrancó procesado; "inactivo" si la fuente pedida no es procesado. */
  reiniciar(estado: "inactivo" | "procesado"): void {
    this.estado = estado; this.reintentos = 0; this.ultimoMotivo = ""; this.proximoMs = 0; this.inicioPruebaMs = 0;
  }
  /** El procesado falló (vigía, o no estaba disponible al iniciar): pasa a cruda y agenda el reintento. */
  fallo(ahora: number, motivo: string): void {
    this.ultimoMotivo = motivo; this.aCruda++;
    this.estado = this.reintentos >= this.max() ? "cruda_final" : "cruda";
    this.proximoMs = ahora + this.espera();
  }
  /** ¿Toca probar el procesado ahora? (en cruda, con condiciones del pase, tras el intervalo y bajo el tope) */
  debeProbar(ahora: number, condiciones: boolean): boolean {
    if (this.estado !== "cruda" || !condiciones || ahora < this.proximoMs) return false;
    if (this.reintentos >= this.max()) { this.estado = "cruda_final"; return false; }
    this.reintentos++; this.estado = "probando"; this.inicioPruebaMs = ahora;
    return true;
  }
  /** Evalúa la prueba: cuadros pintados desde que empezó y el motivo del vigía ("" = bien). */
  evaluar(ahora: number, cuadros: number, fps: number, motivoVigia: string): ResultadoPrueba {
    if (this.estado !== "probando") return "seguir";
    if (motivoVigia) return "fallar";
    const conf = Math.max(0.5, this.cfg.PROCESADO_CONFIRMAR_S) * 1000;
    const t = ahora - this.inicioPruebaMs;
    if (t >= conf && cuadros >= Math.max(1, Math.floor((conf / 1000) * fps * 0.5))) return "confirmar";
    if (t >= conf + Math.max(0.5, this.cfg.PROCESADO_TIMEOUT_S) * 1000) return "fallar";
    return "seguir";
  }
  confirmado(): void { this.estado = "procesado"; this.aProcesado++; this.proximoMs = 0; }
  pruebaFallida(ahora: number, motivo: string): void {
    this.ultimoMotivo = motivo;
    this.estado = this.reintentos >= this.max() ? "cruda_final" : "cruda";
    this.proximoMs = ahora + this.espera();
  }
  /** Segundos hasta el próximo reintento (−1 = no hay). */
  faltaS(ahora: number): number { return this.estado === "cruda" ? Math.max(0, (this.proximoMs - ahora) / 1000) : -1; }
}
