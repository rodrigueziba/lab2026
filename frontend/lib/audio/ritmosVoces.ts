// Z80: voces sintetizadas de la caja de ritmos (Web Audio nativo, sin archivos). Cada golpe se programa en un tiempo
// exacto del AudioContext (lo da el reloj de Z78) con nodos efímeros, la forma prevista de Web Audio. Un solo buffer de
// ruido blanco por contexto, reutilizado por todas las voces de ruido (cada golpe arranca en un punto al azar).
//   kick   seno con barrido de tono descendente (TONO·3 → TONO) y envolvente exponencial
//   clap   ruido por pasa-banda (TONO) con tres ráfagas cortas y una cola
//   hatC   ruido por pasa-altos (TONO), envolvente corta · corta al hat abierto que esté sonando
//   hatA   ruido por pasa-altos (TONO), envolvente larga · un abierto nuevo corta al anterior
//   shaker ruido por pasa-banda (TONO, Q alto) con ataque suave
//   perc   seno con caída de tono (TONO·1,6 → TONO), tipo tom
// Parámetros por voz (TONO Hz, DECAY s, VOL 0…1) en DBG_RITMOS.VOZ, leídos en cada golpe.

import { cortaAbierto, type VozId } from "@/lib/ritmos";

export interface ParamVoz { TONO: number; DECAY: number; VOL: number }

interface Abierto { g: GainNode | null; inicio: number; fin: number }

export interface Voces {
  disparar(id: VozId, t: number, p: ParamVoz): void;
  liberar(): void;
}

const MIN = 0.0001;

export function crearVoces(ctx: BaseAudioContext, salida: AudioNode): Voces {
  // ruido blanco de 1 s, generado una vez
  const len = ctx.sampleRate;
  const ruido = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = ruido.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const bus = ctx.createGain();
  bus.gain.value = 1;
  bus.connect(salida);
  const abierto: Abierto = { g: null, inicio: 0, fin: 0 };

  const fuenteRuido = (t: number, dur: number): AudioBufferSourceNode => {
    const s = ctx.createBufferSource();
    s.buffer = ruido;
    s.start(t, Math.random() * Math.max(0, 1 - Math.min(1, dur)));
    s.stop(t + dur + 0.05);
    return s;
  };
  const env = (t: number, vol: number, ataque: number, decay: number): GainNode => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(MIN, t);
    g.gain.linearRampToValueAtTime(Math.max(MIN, vol), t + ataque);
    g.gain.exponentialRampToValueAtTime(MIN, t + ataque + decay);
    return g;
  };
  const limpiar = (fuente: AudioScheduledSourceNode, ...nodos: AudioNode[]) => {
    fuente.onended = () => { fuente.disconnect(); for (const n of nodos) n.disconnect(); };
  };
  const cortarAbierto = (t: number) => {
    if (abierto.g && cortaAbierto(abierto.inicio, abierto.fin, t)) {
      abierto.g.gain.cancelScheduledValues(t);
      abierto.g.gain.setTargetAtTime(MIN, t, 0.006);
      abierto.fin = t;
    }
  };

  return {
    disparar(id, t, p) {
      const vol = Math.max(0, Math.min(1.5, p.VOL));
      const dec = Math.max(0.01, p.DECAY);
      const tono = Math.max(20, p.TONO);
      if (vol <= 0) return;
      switch (id) {
        case "kick": {
          const o = ctx.createOscillator();
          o.type = "sine";
          o.frequency.setValueAtTime(tono * 3, t);
          o.frequency.exponentialRampToValueAtTime(tono, t + 0.07);
          const g = env(t, vol, 0.002, dec);
          o.connect(g); g.connect(bus);
          o.start(t); o.stop(t + dec + 0.05); limpiar(o, g);
          break;
        }
        case "perc": {
          const o = ctx.createOscillator();
          o.type = "sine";
          o.frequency.setValueAtTime(tono * 1.6, t);
          o.frequency.exponentialRampToValueAtTime(tono, t + dec * 0.5);
          const g = env(t, vol, 0.003, dec);
          o.connect(g); g.connect(bus);
          o.start(t); o.stop(t + dec + 0.05); limpiar(o, g);
          break;
        }
        case "clap": {
          const s = fuenteRuido(t, dec + 0.04);
          const f = ctx.createBiquadFilter();
          f.type = "bandpass"; f.frequency.value = tono; f.Q.value = 0.9;
          const g = ctx.createGain();
          g.gain.setValueAtTime(MIN, t);
          for (let k = 0; k < 3; k++) {                       // ráfagas a 0, 11 y 22 ms
            const tk = t + k * 0.011;
            g.gain.setValueAtTime(vol, tk);
            g.gain.exponentialRampToValueAtTime(vol * 0.15, tk + 0.009);
          }
          g.gain.setValueAtTime(vol * 0.8, t + 0.033);
          g.gain.exponentialRampToValueAtTime(MIN, t + 0.033 + dec);
          s.connect(f); f.connect(g); g.connect(bus); limpiar(s, f, g);
          break;
        }
        case "hatC":
        case "hatA":
        case "shaker": {
          const abiertoNuevo = id === "hatA";
          if (id !== "shaker") cortarAbierto(t);              // el cerrado (o un abierto nuevo) corta al abierto
          const s = fuenteRuido(t, dec + 0.02);
          const f = ctx.createBiquadFilter();
          if (id === "shaker") { f.type = "bandpass"; f.frequency.value = tono; f.Q.value = 2.5; }
          else { f.type = "highpass"; f.frequency.value = tono; f.Q.value = 0.7; }
          const g = env(t, vol, id === "shaker" ? 0.012 : 0.001, dec);
          s.connect(f); f.connect(g); g.connect(bus); limpiar(s, f, g);
          if (abiertoNuevo) { abierto.g = g; abierto.inicio = t; abierto.fin = t + dec; }
          break;
        }
      }
    },
    liberar() { bus.disconnect(); abierto.g = null; },
  };
}
