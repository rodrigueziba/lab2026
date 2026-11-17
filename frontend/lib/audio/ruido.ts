// Z78: fuente de ruido procedural (blanco o rosa), sin archivos. Sin imports: los generadores son puros y se prueban en
// Node (scripts/audio-nucleo-test.mjs). crearRuido(ctx) sirve para CUALQUIER AudioContext que se le pase: hoy el núcleo
// de la tarima (prueba del menú); después SILLAS (vizAudio) para la estática cuando no haya sesión en la tarima.
// Un AudioBuffer mono de DURACION_S en bucle (se genera una vez al crear; nada por frame). Ganancia propia, en 0 por
// defecto (apagado). Rosa: filtro de Paul Kellet ("refined", 3 dB/octava), normalizado a pico 0,9.
// El salto del bucle no se oye: el ruido no tiene periodicidad perceptible en 4 s.

export type TipoRuido = "blanco" | "rosa";

/** Azar determinista (mulberry32) para poder probar. */
export function rngRuido(semilla: number): () => number {
  let a = (semilla >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizarPico(out: Float32Array, pico: number): void {
  let m = 0;
  for (let i = 0; i < out.length; i++) m = Math.max(m, Math.abs(out[i]));
  if (m <= 0) return;
  const k = pico / m;
  for (let i = 0; i < out.length; i++) out[i] *= k;
}

export function llenarBlanco(out: Float32Array, rnd: () => number): void {
  for (let i = 0; i < out.length; i++) out[i] = rnd() * 2 - 1;
  normalizarPico(out, 0.9);
}

export function llenarRosa(out: Float32Array, rnd: () => number): void {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < out.length; i++) {
    const w = rnd() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    out[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
  }
  normalizarPico(out, 0.9);
}

export interface FuenteRuido {
  readonly tipo: TipoRuido;
  /** Salida (ganancia propia): conectala adonde haga falta. */
  readonly salida: GainNode;
  setGanancia(v: number, tau?: number): void;
  liberar(): void;
}
export interface OpcionesRuido { tipo?: TipoRuido; duracionS?: number; ganancia?: number; semilla?: number }

/** Crea la fuente (bucle sonando con ganancia `ganancia`, 0 por defecto). Llamar liberar() al terminar. */
export function crearRuido(ctx: BaseAudioContext, o: OpcionesRuido = {}): FuenteRuido {
  const tipo: TipoRuido = o.tipo === "blanco" ? "blanco" : "rosa";
  const len = Math.max(1, Math.floor(ctx.sampleRate * Math.max(0.5, o.duracionS ?? 4)));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const datos = buf.getChannelData(0);
  const rnd = rngRuido(o.semilla ?? 0x5EED);
  if (tipo === "blanco") llenarBlanco(datos, rnd); else llenarRosa(datos, rnd);
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const salida = ctx.createGain();
  salida.gain.value = Math.max(0, o.ganancia ?? 0);
  src.connect(salida);
  src.start();
  let vivo = true;
  return {
    tipo, salida,
    setGanancia(v: number, tau = 0.05) {
      if (!vivo) return;
      salida.gain.setTargetAtTime(Math.max(0, Number.isFinite(v) ? v : 0), ctx.currentTime, Math.max(0.001, tau));
    },
    liberar() {
      if (!vivo) return;
      vivo = false;
      try { src.stop(); } catch { /* ya detenido */ }
      src.disconnect(); salida.disconnect();
    },
  };
}
