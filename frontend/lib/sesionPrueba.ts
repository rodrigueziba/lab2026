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

export class SesionPrueba implements RemoteSession {
  status: RemoteSessionStatus = "active";
  readonly inicioMs = Date.now();     // "la más reciente": hay una sola SESSION a la vez (setSession reemplaza)
  private ctx: AudioContext | null = null;
  private src: AudioBufferSourceNode | null = null;
  private salida: GainNode | null = null;
  private cbs = new Set<(n: number) => void>();

  getImage() { return null; }
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
  dispose() { this.status = "idle"; this.soltar(); this.cbs.clear(); }
}
