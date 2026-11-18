// Z94: video de la transmisión de la tarima = la imagen PROCESADA del domo (efectos por sector, glitches, ajustes del atril
// de imagen), no la webcam cruda. Lógica PURA y SIN imports (prueba: scripts/video-procesado-test.mjs).
//
// Cómo se obtiene (opción elegida, ver reportes/Z94.md): components/VideoTransmitidoTarima.tsx dibuja, con el renderer
// PRINCIPAL y el MISMO shader del domo (FaceDome: DOME_FRAG con sus uniforms compartidos por referencia → el atril se
// refleja en vivo), un quad plano en una región de 640×360 del framebuffer por defecto ANTES del render de la escena;
// copia esa región con drawImage a un canvas 2D (copia GPU→GPU en Chrome, sin readPixels) y el render normal del cuadro la
// pisa. captureStream(fps) del canvas 2D = la pista que publica LiveKit (Z92). Una sola copia plana (las 7 franjas del
// domo desenrolladas): SILLAS la repite y la cubre con su propia configuración (Z84).
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
  dibujado(ahoraMs: number): void {
    this.ultimo = ahoraMs; this.cuadros++;
    if (!this.ventana) { this.ventana = ahoraMs; return; }   // el cuadro que abre la ventana no se cuenta
    this.cuenta++;
    const dt = ahoraMs - this.ventana;
    if (dt >= 1000) { this.fpsReal = (this.cuenta * 1000) / dt; this.cuenta = 0; this.ventana = ahoraMs; }
  }
  reiniciar(): void { this.ultimo = -Infinity; this.ventana = 0; this.cuenta = 0; this.fpsReal = 0; this.cuadros = 0; }
}

/** Canvas transmisible (2D) con su pista de captureStream. */
export interface Lienzo { canvas: unknown; ctx: unknown; pista: unknown; detenerPista(): void; quitar(): void }
export interface FabricaLienzo { crear(ancho: number, alto: number, fps: number): Lienzo | null }

/** Estado del pase procesado (lo lee el host del Canvas en su useFrame y el menú). */
export class TransmisionProcesada {
  lienzo: Lienzo | null = null;
  ancho = 640; alto = 360; fps = 15;
  readonly cadencia = new Cadencia();
  fallo = "";                    // motivo corto del último fallo (sin datos sensibles)
  creados = 0; liberados = 0;    // diagnóstico de fugas
  private readonly fab: FabricaLienzo;
  constructor(fab: FabricaLienzo) { this.fab = fab; }

  get activa(): boolean { return this.lienzo !== null; }

  /** Crea el canvas y la pista. null si falla (y deja el motivo). */
  iniciar(ancho: number, alto: number, fps: number): { track: unknown } | null {
    if (this.lienzo) return { track: this.lienzo.pista };
    this.ancho = Math.max(16, Math.round(ancho)); this.alto = Math.max(16, Math.round(alto)); this.fps = Math.max(1, Math.min(30, fps));
    let l: Lienzo | null = null;
    try { l = this.fab.crear(this.ancho, this.alto, this.fps); } catch { l = null; }
    if (!l || !l.pista) { this.fallo = "no se pudo crear el canvas transmisible"; return null; }
    this.lienzo = l; this.fallo = ""; this.creados++;
    this.cadencia.reiniciar();
    return { track: l.pista };
  }
  /** El host avisa que no puede dibujar (p. ej. el domo se fue): queda el último cuadro y el motivo. */
  marcarFallo(motivo: string): void { this.fallo = motivo; }
  liberar(): void {
    const l = this.lienzo;
    if (!l) return;
    this.lienzo = null; this.liberados++;
    try { l.detenerPista(); } catch { /* ya detenida */ }
    try { l.quitar(); } catch { /* ok */ }
    this.cadencia.reiniciar();
  }
}
