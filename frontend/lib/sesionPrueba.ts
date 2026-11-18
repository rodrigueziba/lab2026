// Z82: sesión en vivo de PRUEBA (local, sin red) que implementa RemoteSession (lib/remoteSession.ts). Su audio es un
// patrón generado: un compás de 2 s en bucle con un bajo en negras, un arpegio de onda cuadrada suave en corcheas y un
// clic en los tiempos, para distinguirlo fácil del audio propio y de la estática. Se crea una vez por AudioContext; sin
// archivos y sin timers. Imagen: ninguna todavía (el video en el domo va en otra tarea).

import type { RemoteSession, RemoteSessionStatus } from "@/lib/remoteSession";

/** Llena un buffer (mono) con el patrón de prueba de 2 s. Puro: se puede probar en Node. */
export function llenarPatronPrueba(d: Float32Array, sr: number): void {
  const notas = [220, 277.18, 329.63, 440, 329.63, 277.18, 246.94, 329.63];   // arpegio en corcheas (La mayor)
  const bajo = [55, 55, 73.42, 65.41];                                          // negras
  const n = d.length, corchea = Math.floor(sr * 0.25), negra = Math.floor(sr * 0.5);
  let fa = 0, fb = 0;
  for (let i = 0; i < n; i++) {
    const kA = Math.floor(i / corchea) % notas.length, tA = (i % corchea) / sr;
    const kB = Math.floor(i / negra) % bajo.length, tB = (i % negra) / sr;
    fa += notas[kA] / sr; fb += bajo[kB] / sr;
    const arp = (fa % 1 < 0.5 ? 1 : -1) * 0.12 * Math.exp(-tA * 9);
    const bas = Math.sin(2 * Math.PI * fb) * 0.35 * Math.exp(-tB * 4);
    const clic = tB < 0.004 ? (1 - tB / 0.004) * 0.25 * (((i * 2654435761) >>> 0) / 4294967296 * 2 - 1) : 0;
    d[i] = arp + bas + clic;
  }
}

/**
 * Z83: patrón de video de prueba (canvas 2D): barras de color, un reloj que gira, un disco que va y viene y el texto
 * "SESION EN VIVO (PRUEBA)". Solo la ventana de tiempo cambia de un cuadro a otro (nada de red ni archivos).
 */
export function dibujarPatronVideo(cv: HTMLCanvasElement, t: number): void {
  const c = cv.getContext("2d");
  if (!c) return;
  const w = cv.width, h = cv.height;
  const barras = ["#F2EBDD", "#F4B62E", "#2E9E5B", "#1F7FB8", "#E5322B", "#F27FA5", "#3A3B3C"];
  const bw = w / barras.length;
  for (let i = 0; i < barras.length; i++) { c.fillStyle = barras[i]; c.fillRect(i * bw, 0, bw + 1, h * 0.62); }
  c.fillStyle = "#12101A"; c.fillRect(0, h * 0.62, w, h * 0.38);
  // disco en movimiento
  const x = w * (0.5 + 0.38 * Math.sin(t * 1.3));
  c.fillStyle = "#FF9A1F"; c.beginPath(); c.arc(x, h * 0.31, h * 0.09, 0, Math.PI * 2); c.fill();
  // reloj
  const cx = w * 0.12, cy = h * 0.81, r = h * 0.13, a = t * 1.0;
  c.strokeStyle = "#F2EBDD"; c.lineWidth = 4; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.sin(a) * r * 0.85, cy - Math.cos(a) * r * 0.85); c.stroke();
  c.fillStyle = "#FF9A1F"; c.font = "bold 34px monospace"; c.textBaseline = "middle";
  c.fillText("SESION EN VIVO (PRUEBA)", w * 0.25, h * 0.76);
  c.font = "22px monospace"; c.fillStyle = "#F2EBDD";
  const s = Math.floor(t);
  c.fillText(`${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}  ·  TARIMA → SILLAS  ·  640×360`, w * 0.25, h * 0.88);
}

export class SesionPrueba implements RemoteSession {
  status: RemoteSessionStatus = "active";
  readonly inicioMs = Date.now();     // "la más reciente": hay una sola SESSION a la vez (setSession reemplaza)
  private ctx: AudioContext | null = null;
  private src: AudioBufferSourceNode | null = null;
  private salida: GainNode | null = null;
  private cbs = new Set<(n: number) => void>();

  private lienzo: HTMLCanvasElement | null = null;
  /** Z83: video de prueba = canvas 640×360 (lo dibuja dibujarVideo; el domo lo sube a la GPU solo si se ve). */
  getImage(): HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | null {   // Z93: tipo de la interfaz (SesionLiveKit da un <video>)
    if (this.status !== "active" || typeof document === "undefined") return null;
    if (!this.lienzo) { this.lienzo = document.createElement("canvas"); this.lienzo.width = 640; this.lienzo.height = 360; dibujarPatronVideo(this.lienzo, 0); }
    return this.lienzo;
  }
  /** Z83: dibuja el cuadro del tiempo t (s). */
  dibujarVideo(t: number): void { if (this.lienzo) dibujarPatronVideo(this.lienzo, t); }
  getAudio(ctx: AudioContext): AudioNode | null {
    if (this.status !== "active") return null;
    if (this.ctx !== ctx || !this.salida) {
      this.soltar();
      const sr = ctx.sampleRate;
      const buf = ctx.createBuffer(1, sr * 2, sr);
      llenarPatronPrueba(buf.getChannelData(0), sr);
      this.src = ctx.createBufferSource(); this.src.buffer = buf; this.src.loop = true;
      this.salida = ctx.createGain(); this.salida.gain.value = 1;
      this.src.connect(this.salida); this.src.start();
      this.ctx = ctx;
    }
    return this.salida;
  }
  setWatching() { /* local: nadie mira */ }
  onWatchers(cb: (n: number) => void) { this.cbs.add(cb); return () => { this.cbs.delete(cb); }; }
  private soltar() {
    try { this.src?.stop(); } catch { /* ya detenido */ }
    this.src?.disconnect(); this.salida?.disconnect();
    this.src = null; this.salida = null; this.ctx = null;
  }
  dispose() { this.status = "idle"; this.soltar(); this.cbs.clear(); this.lienzo = null; }
}
