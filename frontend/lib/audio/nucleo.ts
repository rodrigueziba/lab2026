// Z78: núcleo de audio de la TARIMA (docs/EVALUACION_INSTRUMENTOS.md, b). Un solo AudioContext, creado de forma
// perezosa (obtenerContexto) y reanudado en cualquier gesto del usuario; bus maestro; reloj compartido; ruido de prueba.
//
//   audioEngine (atriles: mp3 → efectos → master → analizador propio) ─┐
//   instrumentos (futuros) ─────────────────────────────────────────────┼─► ENTRADA ─► GANANCIA MAESTRA ─► LIMITADOR SUAVE
//   metrónomo / ruido de prueba (menú) ─────────────────────────────────┘     ─► ANALIZADOR MAESTRO ─► destination
//                                                                                        └─► salida transmisible (a pedido)
// Con GANANCIA_MAESTRA = 1 y señales bajo el umbral del limitador, la salida es igual a la de antes (el limitador es una
// curva identidad bajo el umbral, sin retardo: lib/audio/limitador.ts). El analizador maestro queda expuesto
// (analizadorMaestro) para el visualizador, sin conectarlo a ningún visual todavía.
// Salida transmisible: obtenerSalidaTransmisible() crea un MediaStreamAudioDestinationNode colgado del analizador (para
// la conexión en vivo, docs/EVALUACION_CONEXION_VIVO.md). Sin pedidos no existe y no cuesta nada.
// Pausa central (lib/pausaExperiencia.ts): pausarNucleo / reanudarNucleo pausan el reloj (los instrumentos dejan de
// recibir pasos). El contexto no se suspende: el mp3 de los atriles lo sigue manejando audioEngine como antes.
// Autoplay: el contexto puede nacer suspendido (fuera de un gesto). Se reanuda en el primer pointerdown, keydown o
// touchend (Safari exige reanudar dentro del gesto); los listeners quedan instalados para reanudar también si el
// sistema lo suspende o interrumpe (Safari/iOS: estado "interrupted").
//
// PUNTO DE ENGANCHE SILLAS (tarea aparte; DBG_AUDIO_NUCLEO.SILLAS_EN_NUCLEO, hoy sin efecto): vizAudio crearía su
// cadena con obtenerContexto() en lugar de `new AudioContext()` y conectaría su _masterGain a entradaBus() (o a una
// segunda entrada propia si SILLAS no debe transmitirse). La estática sin sesión saldría de crearRuido(ctx).

import { DBG_AUDIO_NUCLEO } from "@/lib/debugConfig";
import { curvaLimitador, N_CURVA } from "@/lib/audio/limitador";
import { crearReloj, iniciar, detener, pausar, reanudar, setBpm, suscribir, arrancarMotor, type MotorReloj, type OyentePaso } from "@/lib/audio/reloj";
import { crearRuido, type FuenteRuido, type TipoRuido } from "@/lib/audio/ruido";

interface Bus {
  ctx: AudioContext;
  entrada: GainNode;
  ganancia: GainNode;
  limitador: WaveShaperNode;
  analizador: AnalyserNode;
  curva: Float32Array<ArrayBuffer>;
}
let _bus: Bus | null = null;
let _salidaTx: MediaStreamAudioDestinationNode | null = null;
let _limitadorConectado = false;
let _umbralAplicado = -1;
let _gananciaAplicada = -1;
let _quitarGestos: (() => void) | null = null;

/** Reloj compartido de los instrumentos (lib/audio/reloj.ts). */
export const RELOJ = crearReloj(DBG_AUDIO_NUCLEO.BPM, DBG_AUDIO_NUCLEO.PASOS_POR_COMPAS, DBG_AUDIO_NUCLEO.PASOS_POR_PULSO);
let _motor: MotorReloj | null = null;
let _pausaCentral = false;

// ── contexto y bus ──
function instalarGestos(ctx: AudioContext): void {
  if (_quitarGestos || typeof window === "undefined") return;
  const reanudarSiHaceFalta = () => {
    if (ctx.state !== "running" && ctx.state !== "closed") ctx.resume().catch(() => {});
  };
  const op: AddEventListenerOptions = { capture: true, passive: true };
  window.addEventListener("pointerdown", reanudarSiHaceFalta, op);
  window.addEventListener("keydown", reanudarSiHaceFalta, op);
  window.addEventListener("touchend", reanudarSiHaceFalta, op);
  _quitarGestos = () => {
    window.removeEventListener("pointerdown", reanudarSiHaceFalta, op);
    window.removeEventListener("keydown", reanudarSiHaceFalta, op);
    window.removeEventListener("touchend", reanudarSiHaceFalta, op);
    _quitarGestos = null;
  };
}

function conectarLimitador(b: Bus, on: boolean): void {
  if (on === _limitadorConectado) return;
  b.ganancia.disconnect();
  if (on) { b.ganancia.connect(b.limitador); b.limitador.connect(b.analizador); }
  else { b.limitador.disconnect(); b.ganancia.connect(b.analizador); }
  _limitadorConectado = on;
}

function crearBus(): Bus {
  const ctx = new AudioContext();
  const entrada = ctx.createGain();
  const ganancia = ctx.createGain();
  const limitador = ctx.createWaveShaper();
  const analizador = ctx.createAnalyser();
  analizador.fftSize = 2048;
  const curva = new Float32Array(N_CURVA) as Float32Array<ArrayBuffer>;
  limitador.oversample = "none";
  entrada.connect(ganancia);
  ganancia.connect(analizador);           // sin limitador hasta aplicarConfig
  analizador.connect(ctx.destination);
  const b: Bus = { ctx, entrada, ganancia, limitador, analizador, curva };
  _limitadorConectado = false; _umbralAplicado = -1; _gananciaAplicada = -1;
  return b;
}

/** Aplica GANANCIA_MAESTRA, LIMITADOR, LIMITADOR_UMBRAL y BPM (los llama el menú; no hace nada si no cambiaron). */
export function aplicarConfigNucleo(): void {
  setBpm(RELOJ, DBG_AUDIO_NUCLEO.BPM);
  const b = _bus;
  if (!b) return;
  const g = Math.max(0, Math.min(2, Number(DBG_AUDIO_NUCLEO.GANANCIA_MAESTRA) || 0));
  if (g !== _gananciaAplicada) {
    if (_gananciaAplicada < 0) b.ganancia.gain.value = g;
    else b.ganancia.gain.setTargetAtTime(g, b.ctx.currentTime, 0.05);
    _gananciaAplicada = g;
  }
  const u = Math.max(0.5, Math.min(0.99, Number(DBG_AUDIO_NUCLEO.LIMITADOR_UMBRAL) || 0.9));
  if (u !== _umbralAplicado) {
    curvaLimitador(u, N_CURVA, b.curva);
    b.limitador.curve = b.curva;            // asignar copia la curva (solo al cambiar el umbral)
    _umbralAplicado = u;
  }
  conectarLimitador(b, !!DBG_AUDIO_NUCLEO.LIMITADOR);
}

/** El AudioContext de la tarima (lo crea la primera vez). Solo en el cliente. */
export function obtenerContexto(): AudioContext {
  if (!_bus || _bus.ctx.state === "closed") {
    _bus = crearBus();
    instalarGestos(_bus.ctx);
    aplicarConfigNucleo();
  }
  return _bus.ctx;
}
/** El contexto si ya existe (no lo crea). */
export function contextoNucleo(): AudioContext | null { return _bus?.ctx ?? null; }
/** Nodo al que se conecta todo lo que suena en la tarima. */
export function entradaBus(): AudioNode { obtenerContexto(); return _bus!.entrada; }
/** Analizador del bus maestro (null si el núcleo no arrancó). Para el visualizador, más adelante. */
export function analizadorMaestro(): AnalyserNode | null { return _bus?.analizador ?? null; }
/** Reanuda el contexto (llamar dentro de un gesto si se puede). */
export function reanudarContexto(): Promise<void> {
  const ctx = obtenerContexto();
  return ctx.state === "running" ? Promise.resolve() : ctx.resume().catch(() => {});
}

/** Salida para transmitir (MediaStream en .stream). Se crea al primer pedido. */
export function obtenerSalidaTransmisible(): MediaStreamAudioDestinationNode {
  obtenerContexto();
  if (!_salidaTx) {
    _salidaTx = _bus!.ctx.createMediaStreamDestination();
    _bus!.analizador.connect(_salidaTx);
  }
  return _salidaTx;
}
export function liberarSalidaTransmisible(): void {
  if (!_salidaTx || !_bus) return;
  try { _bus.analizador.disconnect(_salidaTx); } catch { /* ya desconectado */ }
  _salidaTx.stream.getTracks().forEach(t => t.stop());
  _salidaTx = null;
}

// ── reloj ──
export function iniciarReloj(): void {
  const ctx = obtenerContexto();
  if (ctx.state !== "running") ctx.resume().catch(() => {});
  aplicarConfigNucleo();
  RELOJ.pasosPorCompas = Math.max(1, Math.floor(DBG_AUDIO_NUCLEO.PASOS_POR_COMPAS));
  RELOJ.pasosPorPulso = Math.max(1, Math.floor(DBG_AUDIO_NUCLEO.PASOS_POR_PULSO));
  iniciar(RELOJ, ctx.currentTime, 0.05);
  if (_pausaCentral) pausar(RELOJ, ctx.currentTime);
  if (!_motor) _motor = arrancarMotor(RELOJ, () => ctx.currentTime, () => DBG_AUDIO_NUCLEO.ANTICIPO_S, DBG_AUDIO_NUCLEO.INTERVALO_MS);
}
export function detenerReloj(): void {
  detener(RELOJ);
  _motor?.parar(); _motor = null;
}
export function suscribirPasos(fn: OyentePaso): () => void { return suscribir(RELOJ, fn); }

/** Pausa central de la experiencia (lib/pausaExperiencia.ts). */
export function pausarNucleo(): void {
  _pausaCentral = true;
  if (_bus) pausar(RELOJ, _bus.ctx.currentTime);
}
export function reanudarNucleo(): void {
  _pausaCentral = false;
  if (_bus) reanudar(RELOJ, _bus.ctx.currentTime);
}

// ── metrónomo de prueba (un oscilador corto por paso: los nodos efímeros de Web Audio son la forma prevista) ──
const metronomo: OyentePaso = (paso, t, _compas, durS) => {
  const b = _bus;
  if (!b) return;
  const tiempoFuerte = paso === 0;
  const pulso = paso % RELOJ.pasosPorPulso === 0;
  const vol = Math.max(0, DBG_AUDIO_NUCLEO.METRONOMO_VOL) * (tiempoFuerte ? 1 : pulso ? 0.6 : 0.25);
  const osc = b.ctx.createOscillator();
  const env = b.ctx.createGain();
  osc.type = "square";
  osc.frequency.value = tiempoFuerte ? 1760 : pulso ? 1320 : 880;
  const dur = Math.min(0.03, durS * 0.5);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(vol, t + 0.001);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env); env.connect(b.entrada);
  osc.start(t); osc.stop(t + dur + 0.005);
  osc.onended = () => { osc.disconnect(); env.disconnect(); };
};
let _quitarMetronomo: (() => void) | null = null;
export function setMetronomo(on: boolean): void {
  DBG_AUDIO_NUCLEO.METRONOMO = on;
  if (on && !_quitarMetronomo) _quitarMetronomo = suscribir(RELOJ, metronomo);
  else if (!on && _quitarMetronomo) { _quitarMetronomo(); _quitarMetronomo = null; }
}

// ── ruido de prueba ──
let _ruido: FuenteRuido | null = null;
export function setRuidoPrueba(on: boolean): void {
  DBG_AUDIO_NUCLEO.RUIDO = on;
  const tipo: TipoRuido = DBG_AUDIO_NUCLEO.RUIDO_TIPO === "blanco" ? "blanco" : "rosa";
  if (_ruido && (!on || _ruido.tipo !== tipo)) { _ruido.liberar(); _ruido = null; }
  if (!on) return;
  const ctx = obtenerContexto();
  if (ctx.state !== "running") ctx.resume().catch(() => {});
  if (!_ruido) {
    _ruido = crearRuido(ctx, { tipo, ganancia: 0 });
    _ruido.salida.connect(_bus!.entrada);
  }
  _ruido.setGanancia(DBG_AUDIO_NUCLEO.RUIDO_GANANCIA);
}

// ── estado (objeto reutilizado) y medidor ──
export const ESTADO_NUCLEO = {
  contexto: "sin crear" as string, sampleRate: 0, latenciaBaseMs: 0, latenciaSalidaMs: 0,
  reloj: "detenido" as string, paso: 0, compas: 0, cortes: 0, transmisible: false, atrilesEnBus: false,
};
let _atrilesEnBus = false;
/** audioEngine avisa que su cadena entra por el bus. */
export function marcarAtrilesEnBus(): void { _atrilesEnBus = true; }

export function actualizarEstadoNucleo(): typeof ESTADO_NUCLEO {
  const e = ESTADO_NUCLEO, ctx = _bus?.ctx ?? null;
  e.contexto = ctx ? ctx.state : "sin crear";
  e.sampleRate = ctx?.sampleRate ?? 0;
  e.latenciaBaseMs = ctx ? (ctx.baseLatency || 0) * 1000 : 0;
  e.latenciaSalidaMs = ctx && typeof ctx.outputLatency === "number" ? ctx.outputLatency * 1000 : 0;
  e.reloj = RELOJ.estado; e.paso = RELOJ.paso; e.compas = RELOJ.compas; e.cortes = RELOJ.cortes;
  e.transmisible = !!_salidaTx; e.atrilesEnBus = _atrilesEnBus;
  return e;
}

/** Nivel del analizador maestro: { rmsDb, picoDb } (buffer reutilizado). */
let _buf: Float32Array<ArrayBuffer> | null = null;
export const NIVEL_MAESTRO = { rmsDb: -Infinity, picoDb: -Infinity };
export function medirNivelMaestro(): typeof NIVEL_MAESTRO {
  const a = _bus?.analizador;
  if (!a) { NIVEL_MAESTRO.rmsDb = -Infinity; NIVEL_MAESTRO.picoDb = -Infinity; return NIVEL_MAESTRO; }
  if (!_buf || _buf.length !== a.fftSize) _buf = new Float32Array(a.fftSize) as Float32Array<ArrayBuffer>;
  a.getFloatTimeDomainData(_buf);
  let s = 0, p = 0;
  for (let i = 0; i < _buf.length; i++) { const v = _buf[i]; s += v * v; const m = Math.abs(v); if (m > p) p = m; }
  NIVEL_MAESTRO.rmsDb = 20 * Math.log10(Math.sqrt(s / _buf.length) || 1e-9);
  NIVEL_MAESTRO.picoDb = 20 * Math.log10(p || 1e-9);
  return NIVEL_MAESTRO;
}

// overlay (DOM, data-debug-panel, oculto por defecto; un rAF solo mientras está prendido)
let _ov: { div: HTMLDivElement; barra: HTMLDivElement; texto: HTMLSpanElement; raf: number; t: number } | null = null;
export function setOverlayNivel(on: boolean): void {
  DBG_AUDIO_NUCLEO.OVERLAY_NIVEL = on;
  if (typeof document === "undefined") return;
  if (!on) { if (_ov) { cancelAnimationFrame(_ov.raf); _ov.div.remove(); _ov = null; } return; }
  if (_ov) return;
  const div = document.createElement("div");
  div.setAttribute("data-debug-panel", "");
  div.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:60;width:220px;font:11px monospace;color:#FF9A1F;background:#2A1400dd;padding:4px 6px;pointer-events:none";
  const texto = document.createElement("span");
  const fondo = document.createElement("div");
  fondo.style.cssText = "height:6px;background:#12101A;margin-top:3px";
  const barra = document.createElement("div");
  barra.style.cssText = "height:100%;width:0%;background:#FF9A1F";
  fondo.appendChild(barra); div.appendChild(texto); div.appendChild(fondo);
  document.body.appendChild(div);
  const ov = { div, barra, texto, raf: 0, t: 0 };
  const loop = (ms: number) => {
    ov.raf = requestAnimationFrame(loop);
    if (ms - ov.t < 66) return;          // ~15 Hz
    ov.t = ms;
    const n = medirNivelMaestro();
    const pct = Math.max(0, Math.min(100, ((n.rmsDb + 60) / 60) * 100));
    barra.style.width = pct.toFixed(0) + "%";
    texto.textContent = `NÚCLEO Z78 · rms ${Number.isFinite(n.rmsDb) ? n.rmsDb.toFixed(1) : "−∞"} dB · pico ${Number.isFinite(n.picoDb) ? n.picoDb.toFixed(1) : "−∞"} dB`;
  };
  ov.raf = requestAnimationFrame(loop);
  _ov = ov;
}

/** Cierra todo (no se usa en el flujo normal: el núcleo vive lo que la página, como audioEngine). */
export function cerrarNucleo(): void {
  detenerReloj(); setMetronomo(false); setRuidoPrueba(false); setOverlayNivel(false); liberarSalidaTransmisible();
  _quitarGestos?.();
  _bus?.ctx.close().catch(() => {});
  _bus = null; _atrilesEnBus = false;
}
