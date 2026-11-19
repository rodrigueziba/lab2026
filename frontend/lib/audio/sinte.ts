// Z101: motor del SINTETIZADOR SY-40 (atril SY-40). Lógica pura en lib/sinte.ts.
//
// Grafo armado UNA vez (al primer gesto que toca una nota) y reutilizado: nunca se crean nodos por nota.
//   SINTE_VOCES voces fijas, cada una:
//     OSC1 ─ g1 ─┐
//     OSC2 ─ g2 ─┤                     (OSC1/OSC2: seno, triángulo, sierra o cuadrada; DESAFINE ± en centésimas)
//     SUB  ─ gS ─┼─► FILTRO (biquad pasa-bajos, Q = RESONANCIA) ─► VCA ─┐   (SUB: una octava abajo, cuadrada o seno)
//     RUIDO ─ gR ┘   (un solo ruido blanco compartido, lib/audio/ruido.ts)│
//   todas las voces ─► MEZCLA ─► TRÉMOLO ─► seco ─────────────────────────┼─► VOLUMEN ─► ON ─► bus maestro (entradaBus)
//                                   └─► envío ─► RETARDO ◄─ realim. ◄─ filtro del lazo ─► mojado ┘         └─► VU
//   LFO: UN oscilador compartido → ganancia → detune de los osciladores (AFINACIÓN: vibrato), detune del filtro (CORTE:
//   barrido) o la ganancia del trémolo (VOLUMEN). La profundidad del destino elegido es la ganancia; las otras, 0.
// Por qué así: todo es nativo de Web Audio (sin AudioWorklet, como el bajo), los osciladores corren siempre (silenciados
// por el VCA) y las envolventes son automatización de AudioParam con cancelarYMantener + rampas: sin clics.
// La salida entra al MISMO bus maestro que el bajo y la caja: se oye en la sala, la ve el visualizador y viaja a SILLAS
// por obtenerSalidaTransmisible() sin tocar el camino de la transmisión. Sin autoplay: el grafo nace en el primer gesto.
//
// Arpegiador: oyente del reloj del núcleo (anticipación de Z78): en cada paso del reloj se programan los pasos del
// arpegiador que caen en esa ventana (pasosArpEnVentana), con su tiempo exacto. Solo con la caja sonando
// (RITMOS.sonando); con la caja parada las teclas suenan normales y se sostienen. Sin allocations en el oyente.
import { DBG_SINTE, DBG_RITMOS } from "@/lib/debugConfig";
import { contextoNucleo, obtenerContexto, reanudarContexto, entradaBus, suscribirPasos, RELOJ } from "@/lib/audio/nucleo";
import { RITMOS } from "@/lib/ritmosMotor";
import { crearRuido, type FuenteRuido } from "@/lib/audio/ruido";
import {
  PARAMS_SINTE, N_PARAMS, P, TIPOS_OSC, SEMICORCHEAS_ARP, SEMICORCHEAS_COMPAS, NOMBRES_SONIDO, V_SONANDO,
  midiAFrecuencia, notaBase, crearParams, setParam, valorIdx, activarCara, liberarParamCara, cargarSonido, sonidoEditado,
  crearVoces, asignarVoz, liberarNota, vocesActivas, reiniciarVoces, crearMantenidas, pulsar, soltarMantenida,
  crearArp, reiniciarArp, secuenciaArp, siguienteNotaArp, pasosArpEnVentana, tiempoEcoS, realimAcotada,
  qDeResonancia, corteConTecla, corteEnvolvente, llenarRespuestaImpulso, type FuenteParam, type NombreSonido, type Voces,
} from "@/lib/sinte";

/** Estado que leen el atril, el display y el menú. version sube con cada cambio de sonido, parámetro u opción. */
export const SINTE = {
  version: 0, versionCara: 0, sonido: "" as string, editado: false,
  listo: false, vocesActivas: 0, ultimaNota: -1, notas: 0, robos: 0,
  arpActivo: false,     // arpegiador encendido Y caja sonando
  reinicios: 0,         // sube con "Silenciar y reiniciar sinte" (el atril suelta sus teclas)
};
export const PARAMS_SY = crearParams();
export const MANTENIDAS = crearMantenidas();
export const ARP = crearArp(DBG_SINTE.ARP_SEMILLA);
export let VOCES: Voces = crearVoces(DBG_SINTE.SINTE_VOCES);

const CLAVES = DBG_SINTE as unknown as Record<string, number>;
function defectosDesdeDbg(): void {
  for (let i = 0; i < N_PARAMS; i++) { const v = CLAVES[PARAMS_SINTE[i].clave]; if (typeof v === "number") setParam(PARAMS_SY, PARAMS_SINTE[i].id, v, "manual"); }
}
function sonidoInicial(): NombreSonido {
  return (NOMBRES_SONIDO as string[]).includes(DBG_SINTE.SONIDO_INICIAL) ? DBG_SINTE.SONIDO_INICIAL as NombreSonido : "DRON";
}
interface VozNodos {
  o1: OscillatorNode; o2: OscillatorNode; sub: OscillatorNode; g1: GainNode; g2: GainNode; gS: GainNode; gR: GainNode;
  filtro: BiquadFilterNode; vca: GainNode; base: number; nota: number;
}
interface Grafo {
  ctx: AudioContext; ruido: FuenteRuido; lfo: OscillatorNode; lfoAfin: GainNode; lfoCorte: GainNode; lfoVol: GainNode;
  mezcla: GainNode; trem: GainNode; seco: GainNode; envio: GainNode; retardo: DelayNode; lazo: BiquadFilterNode; realim: GainNode;
  mojado: GainNode; vol: GainNode; on: GainNode; analizador: AnalyserNode; voces: VozNodos[];
  // Z102: ESPACIO (reverberación): envío → convolución (respuesta al impulso sintética, generada una vez) → mojado
  envEsp: GainNode; convolver: ConvolverNode; mojEsp: GainNode; espConectado: boolean;
}
/** Z102: cuántas respuestas al impulso se generaron (una por grafo; las pruebas lo cuentan). */
export const ESPACIO = { generadas: 0, conectado: false };
let _g: Grafo | null = null;
let _desuscribir: (() => void) | null = null;
let _bpmAplicado = -1;
let _arpPrev = false;
const _t = new Float64Array(8), _seq = new Int16Array(64), _tmp = new Int16Array(16);

function cancelarYMantener(p: AudioParam, t: number): void {
  const q = p as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam };
  if (typeof q.cancelAndHoldAtTime === "function") q.cancelAndHoldAtTime(t); else p.cancelScheduledValues(t);
}
const v = (i: number): number => valorIdx(PARAMS_SY, i);

function crearGrafo(ctx: AudioContext): Grafo {
  const ruido = crearRuido(ctx, { tipo: "blanco", ganancia: 1, semilla: 0x5101 });
  const lfo = ctx.createOscillator(), lfoAfin = ctx.createGain(), lfoCorte = ctx.createGain(), lfoVol = ctx.createGain();
  const mezcla = ctx.createGain(), trem = ctx.createGain(), seco = ctx.createGain(), envio = ctx.createGain();
  const retardo = ctx.createDelay(Math.max(0.1, DBG_SINTE.ECO_MAX_S) + 0.1), lazo = ctx.createBiquadFilter(), realim = ctx.createGain();
  const mojado = ctx.createGain(), vol = ctx.createGain(), on = ctx.createGain(), analizador = ctx.createAnalyser();
  lfo.type = "sine"; lfoAfin.gain.value = 0; lfoCorte.gain.value = 0; lfoVol.gain.value = 0;
  lazo.type = "lowpass"; lazo.Q.value = 0.5; analizador.fftSize = 1024;
  lfo.connect(lfoAfin); lfo.connect(lfoCorte); lfo.connect(lfoVol); lfoVol.connect(trem.gain);
  mezcla.connect(trem); trem.connect(seco); trem.connect(envio); envio.connect(retardo);
  retardo.connect(lazo); lazo.connect(realim); realim.connect(retardo); lazo.connect(mojado);
  seco.connect(vol); mojado.connect(vol); vol.connect(on); on.connect(entradaBus()); on.connect(analizador);
  // Z102: ESPACIO. La respuesta al impulso se genera UNA vez, acá; el envío se conecta al convolver solo con mezcla > 0
  const envEsp = ctx.createGain(), convolver = ctx.createConvolver(), mojEsp = ctx.createGain();
  const largo = Math.max(1, Math.floor(ctx.sampleRate * Math.max(0.5, Math.min(6, DBG_SINTE.ESPACIO_DUR_S))));
  const ir = ctx.createBuffer(2, largo, ctx.sampleRate);
  llenarRespuestaImpulso(ir.getChannelData(0), ir.getChannelData(1), ctx.sampleRate, DBG_SINTE.ESPACIO_DUR_S);
  convolver.normalize = true; convolver.buffer = ir; ESPACIO.generadas++;
  envEsp.gain.value = 0; mojEsp.gain.value = 0;
  trem.connect(envEsp); convolver.connect(mojEsp); mojEsp.connect(vol);
  const voces: VozNodos[] = [];
  for (let i = 0; i < VOCES.n; i++) {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), sub = ctx.createOscillator();
    const g1 = ctx.createGain(), g2 = ctx.createGain(), gS = ctx.createGain(), gR = ctx.createGain();
    const filtro = ctx.createBiquadFilter(), vca = ctx.createGain();
    filtro.type = "lowpass"; vca.gain.value = 0;
    o1.connect(g1); o2.connect(g2); sub.connect(gS); ruido.salida.connect(gR);
    g1.connect(filtro); g2.connect(filtro); gS.connect(filtro); gR.connect(filtro); filtro.connect(vca); vca.connect(mezcla);
    lfoAfin.connect(o1.detune); lfoAfin.connect(o2.detune); lfoAfin.connect(sub.detune); lfoCorte.connect(filtro.detune);
    o1.start(); o2.start(); sub.start();
    voces.push({ o1, o2, sub, g1, g2, gS, gR, filtro, vca, base: 1000, nota: -1 });
  }
  lfo.start();
  const g: Grafo = { ctx, ruido, lfo, lfoAfin, lfoCorte, lfoVol, mezcla, trem, seco, envio, retardo, lazo, realim, mojado, vol, on, analizador, voces, envEsp, convolver, mojEsp, espConectado: false };
  _bpmAplicado = -1;
  aplicarParams(g, ctx.currentTime);
  return g;
}

/** Corte base de una nota (CORTE + SEGUIMIENTO DE TECLA) y su nivel de sostenido (envolvente del filtro). */
function corteBase(nota: number): number { return corteConTecla(v(P.corte), nota, v(P.seguimiento), DBG_SINTE.CORTE_MIN, DBG_SINTE.CORTE_MAX); }
function fMaxFiltro(g: Grafo): number { return Math.min(20000, g.ctx.sampleRate * 0.45); }

/** Qué toca en las notas sostenidas un cambio de parámetro: el corte (FILTRO) y/o el nivel de sostenido (VCA). */
const SOST_FILTRO = 1, SOST_VCA = 2;
function sostenidasDe(id: string): number {
  return id === "corte" || id === "modEnv" || id === "seguimiento" || id === "fSostenido" ? SOST_FILTRO : id === "sostenido" ? SOST_VCA : 0;
}
/**
 * Parámetros continuos, con suavizado corto. `sost` (SOST_FILTRO | SOST_VCA): además lleva las notas SOSTENIDAS al corte o
 * al nivel nuevos (las perillas de FILTRO y ENVOLVENTE se oyen mientras suena una nota); los demás cambios no tocan sus
 * envolventes.
 */
function aplicarParams(g: Grafo, ahora: number, sost = 0): void {
  const tipo1 = TIPOS_OSC[Math.round(v(P.onda1))] ?? "sawtooth", tipo2 = TIPOS_OSC[Math.round(v(P.onda2))] ?? "sawtooth";
  const tipoSub = Math.round(v(P.subOnda)) === 1 ? "sine" : "square";
  const des = v(P.desafine) / 2, mz = v(P.mezcla), sub = v(P.sub) * 0.8, ruido = v(P.ruido) * DBG_SINTE.RUIDO_MAX;
  const q = qDeResonancia(v(P.resonancia), DBG_SINTE.RES_MAX), S = v(P.sostenido), fS = v(P.fSostenido);
  const pico = DBG_SINTE.NIVEL_VOZ, fMax = fMaxFiltro(g);
  for (let i = 0; i < g.voces.length; i++) {
    const n = g.voces[i];
    if (n.o1.type !== tipo1) n.o1.type = tipo1;
    if (n.o2.type !== tipo2) n.o2.type = tipo2;
    if (n.sub.type !== tipoSub) n.sub.type = tipoSub;
    n.o1.detune.setTargetAtTime(-des, ahora, 0.02); n.o2.detune.setTargetAtTime(des, ahora, 0.02);
    n.g1.gain.setTargetAtTime(1 - mz, ahora, 0.02); n.g2.gain.setTargetAtTime(mz, ahora, 0.02);
    n.gS.gain.setTargetAtTime(sub, ahora, 0.02); n.gR.gain.setTargetAtTime(ruido, ahora, 0.02);
    n.filtro.Q.setTargetAtTime(q, ahora, 0.02);
    // nota sostenida: el corte y el nivel de sostenido siguen a las perillas (FILTRO y ENVOLVENTE) mientras suena
    if (sost && i < VOCES.n && VOCES.estado[i] === V_SONANDO && n.nota >= 0) {
      if (sost & SOST_FILTRO) {
        n.base = corteBase(n.nota);
        cancelarYMantener(n.filtro.frequency, ahora);
        n.filtro.frequency.setTargetAtTime(corteEnvolvente(n.base, v(P.modEnv), DBG_SINTE.ENV_OCTAVAS, fS, fMax), ahora, 0.03);
      }
      if (sost & SOST_VCA) { cancelarYMantener(n.vca.gain, ahora); n.vca.gain.setTargetAtTime(pico * S, ahora, 0.03); }
    }
  }
  // LFO: velocidad y profundidad en el destino elegido (los otros dos en 0)
  const dest = Math.round(v(P.lfoDestino)), prof = v(P.lfoProf);
  g.lfo.frequency.setTargetAtTime(v(P.lfoVel), ahora, 0.02);
  g.lfoAfin.gain.setTargetAtTime(dest === 0 ? prof * DBG_SINTE.LFO_AFIN_CENTS : 0, ahora, 0.02);
  g.lfoCorte.gain.setTargetAtTime(dest === 1 ? prof * DBG_SINTE.LFO_CORTE_CENTS : 0, ahora, 0.02);
  const trem = dest === 2 ? prof * Math.max(0, Math.min(1, DBG_SINTE.LFO_VOL_MAX)) : 0;
  g.lfoVol.gain.setTargetAtTime(trem / 2, ahora, 0.02); g.trem.gain.setTargetAtTime(1 - trem / 2, ahora, 0.02);
  aplicarEco(g, ahora);
  // salida
  g.vol.gain.setTargetAtTime(Math.max(0, v(P.volumen)), ahora, 0.02);
  g.on.gain.setTargetAtTime(DBG_SINTE.ON ? 1 : 0, ahora, 0.01);
}
/** ECO: tiempo desde el BPM de la caja (1/8, 1/4, 1/4 con puntillo), realimentación acotada y mezcla. */
function aplicarEco(g: Grafo, ahora: number): void {
  const bpm = DBG_RITMOS.BPM, mz = v(P.ecoMezcla);
  _bpmAplicado = bpm;
  g.retardo.delayTime.setTargetAtTime(tiempoEcoS(bpm, v(P.ecoTiempo), DBG_SINTE.ECO_MAX_S), ahora, 0.05);
  g.realim.gain.setTargetAtTime(realimAcotada(v(P.ecoRealim), DBG_SINTE.ECO_REALIM_MAX), ahora, 0.02);
  g.lazo.frequency.setTargetAtTime(Math.max(200, DBG_SINTE.ECO_FILTRO_HZ), ahora, 0.02);
  g.envio.gain.setTargetAtTime(mz > 0 ? 1 : 0, ahora, 0.02);
  g.mojado.gain.setTargetAtTime(mz, ahora, 0.02);
  // Z102: el seco baja un poco con el ESPACIO (la mezcla total no crece de golpe)
  const esp = v(P.espacio);
  g.seco.gain.setTargetAtTime((1 - 0.4 * mz) * (1 - Math.max(0, Math.min(1, DBG_SINTE.ESPACIO_SECO)) * esp), ahora, 0.02);
  aplicarEspacio(g, ahora, esp);
}
/** Z102: ESPACIO. Con mezcla 0 el envío se DESCONECTA del convolver: sin entrada, la convolución no procesa nada. */
function aplicarEspacio(g: Grafo, ahora: number, esp: number): void {
  const on = esp > 0.001;
  if (on && !g.espConectado) { g.envEsp.connect(g.convolver); g.espConectado = true; }
  else if (!on && g.espConectado) { try { g.envEsp.disconnect(g.convolver); } catch { /* ya desconectado */ } g.espConectado = false; }
  ESPACIO.conectado = g.espConectado;
  g.envEsp.gain.setTargetAtTime(on ? 1 : 0, ahora, 0.02);
  g.mojEsp.gain.setTargetAtTime(on ? esp * 0.8 : 0, ahora, 0.05);
}

// ── notas (tiempos de audio exactos; sin allocations) ──
function notaOn(g: Grafo, i: number, nota: number, t0: number): void {
  const n = g.voces[i];
  let t = t0;
  if (VOCES.robada) {   // robo de una voz que sonaba: baja en ~8 ms antes de la nota nueva (sin clic)
    cancelarYMantener(n.vca.gain, t); n.vca.gain.setTargetAtTime(0, t, 0.002); t += 0.008;
    SINTE.robos = VOCES.robos;
  }
  const f = midiAFrecuencia(nota);
  cancelarYMantener(n.o1.frequency, t); n.o1.frequency.setValueAtTime(f, t);
  cancelarYMantener(n.o2.frequency, t); n.o2.frequency.setValueAtTime(f, t);
  cancelarYMantener(n.sub.frequency, t); n.sub.frequency.setValueAtTime(f / 2, t);   // SUB: una octava abajo
  // envolvente de amplitud: ATAQUE (rampa lineal desde el valor actual) → DECAY hacia SOSTENIDO
  const A = Math.max(0.002, v(P.ataque)), D = Math.max(0.005, v(P.decay)), pico = DBG_SINTE.NIVEL_VOZ;
  cancelarYMantener(n.vca.gain, t);
  n.vca.gain.linearRampToValueAtTime(pico, t + A);
  n.vca.gain.setTargetAtTime(pico * v(P.sostenido), t + A, D / 3);
  // envolvente del filtro: abre MOD. ENV. × ENV_OCTAVAS sobre el corte de la nota y cae a su sostenido
  const fA = Math.max(0.002, v(P.fAtaque)), fD = Math.max(0.005, v(P.fDecay)), fMax = fMaxFiltro(g);
  n.base = corteBase(nota); n.nota = nota;
  const fp = corteEnvolvente(n.base, v(P.modEnv), DBG_SINTE.ENV_OCTAVAS, 1, fMax);
  const fs = corteEnvolvente(n.base, v(P.modEnv), DBG_SINTE.ENV_OCTAVAS, v(P.fSostenido), fMax);
  cancelarYMantener(n.filtro.frequency, t);
  n.filtro.frequency.linearRampToValueAtTime(fp, t + fA);
  n.filtro.frequency.setTargetAtTime(fs, t + fA, fD / 3);
  SINTE.ultimaNota = nota; SINTE.notas++;
}
/** RELEASE: desde el valor actual hacia 0 (amplitud) y hacia el corte base (filtro). τ = release / 4 (≈ 2 % al final). */
function notaOff(g: Grafo, i: number, t: number): void {
  const n = g.voces[i];
  cancelarYMantener(n.vca.gain, t); n.vca.gain.setTargetAtTime(0, t, Math.max(0.003, v(P.release) / 4));
  cancelarYMantener(n.filtro.frequency, t); n.filtro.frequency.setTargetAtTime(n.base, t, Math.max(0.003, v(P.fRelease) / 4));
}
function tocar(g: Grafo, nota: number, t: number): void {
  const i = asignarVoz(VOCES, nota, t);
  notaOn(g, i, nota, t);
}
function soltar(g: Grafo, nota: number, t: number): void {
  const i = liberarNota(VOCES, nota, t, v(P.release));
  if (i >= 0) notaOff(g, i, t);
}
/** Suelta todas las voces con tecla abajo (al pasar de tocar directo a arpegiar, o al reiniciar). */
function soltarSonando(g: Grafo, t: number): void {
  for (let i = 0; i < VOCES.n; i++) if (VOCES.estado[i] === V_SONANDO) { liberarNota(VOCES, VOCES.nota[i], t, v(P.release)); notaOff(g, i, t); }
}

// ── oyente del reloj: arpegiador (sin allocations) ──
const oyenteReloj = (paso: number, t: number, _compas: number, durS: number): void => {
  if (!DBG_SINTE.ACTIVO || !DBG_SINTE.ARP_ON || !RITMOS.sonando) return;
  const g = _g;
  if (!g) return;
  const sc = SEMICORCHEAS_ARP[Math.max(0, Math.min(2, Math.round(DBG_SINTE.ARP_VELOCIDAD)))];
  const c = pasosArpEnVentana(paso, RELOJ.pasosPorCompas, t, durS, sc, _t);
  if (c === 0) return;
  const len = secuenciaArp(MANTENIDAS, DBG_SINTE.ARP_OCTAVAS, Math.round(DBG_SINTE.ARP_PATRON), _seq, _tmp);
  const durArp = (durS * RELOJ.pasosPorCompas / SEMICORCHEAS_COMPAS) * sc;
  for (let k = 0; k < c; k++) {
    const nota = siguienteNotaArp(ARP, Math.round(DBG_SINTE.ARP_PATRON), _seq, len);
    if (nota < 0) continue;   // sin teclas: silencio (las notas ya programadas terminan en su paso)
    const tk = _t[k], tOff = tk + durArp * Math.max(0.1, Math.min(0.98, DBG_SINTE.ARP_GATE));
    tocar(g, nota, tk);
    soltar(g, nota, tOff);
  }
};

// ── entrada: teclas (computadora, pads del atril, MIDI) ──
function arpActivo(): boolean { return DBG_SINTE.ACTIVO && DBG_SINTE.ARP_ON && RITMOS.sonando; }
/** El grafo (lo crea en el primer gesto: el AudioContext se reanuda dentro del gesto). null si el sinte está apagado. */
function grafo(): Grafo | null {
  if (!DBG_SINTE.ACTIVO || typeof window === "undefined") return null;
  const ctx = obtenerContexto();
  if (ctx.state !== "running") void reanudarContexto();
  if (!_g || _g.ctx !== ctx) { liberarGrafo(); _g = crearGrafo(ctx); SINTE.listo = true; }
  return _g;
}
function ahoraNotas(g: Grafo): number { return g.ctx.currentTime + Math.max(0, Math.min(0.1, DBG_SINTE.LOOKAHEAD_S)); }
/** Tecla abajo (nota MIDI absoluta). Con la caja parada o el arpegiador apagado suena y se sostiene; si no, entra al acorde. */
export function notaAbajo(nota: number): void {
  const g = grafo();
  if (!g || !Number.isFinite(nota)) return;
  const n = Math.max(0, Math.min(127, Math.round(nota)));
  if (!pulsar(MANTENIDAS, n)) return;
  if (!arpActivo()) tocar(g, n, ahoraNotas(g));
  SINTE.ultimaNota = n;
}
/** Tecla arriba. Al soltar todas, el arpegiador se calla y vuelve a su primer paso. */
export function notaArriba(nota: number): void {
  const n = Math.max(0, Math.min(127, Math.round(nota)));
  if (!soltarMantenida(MANTENIDAS, n)) return;
  const g = _g;
  if (g && !arpActivo()) soltar(g, n, ahoraNotas(g));
  if (MANTENIDAS.n === 0) reiniciarArp(ARP);
}
/** Suelta todas las teclas mantenidas (blur de la ventana, salir del atril, desmontar). */
export function soltarTodasSinte(): void {
  while (MANTENIDAS.n > 0) notaArriba(MANTENIDAS.notas[MANTENIDAS.n - 1]);
}
/** MIDI de la tecla `semitono` del teclado con la octava actual. */
export function notaDeSemitono(semitono: number): number { return notaBase(DBG_SINTE.OCTAVA) + semitono; }

/** Instala el sinte (lo monta el atril): se suscribe al reloj del núcleo. Devuelve la limpieza. */
export function instalarSinte(): () => void {
  if (!DBG_SINTE.ACTIVO) return () => {};
  if (!_desuscribir) _desuscribir = suscribirPasos(oyenteReloj);
  return liberarSinte;
}
function liberarGrafo(): void {
  const g = _g;
  if (!g) return;
  for (const n of g.voces) {
    for (const o of [n.o1, n.o2, n.sub]) { try { o.stop(); } catch { /* ya parado */ } }
    for (const x of [n.o1, n.o2, n.sub, n.g1, n.g2, n.gS, n.gR, n.filtro, n.vca]) { try { x.disconnect(); } catch { /* ok */ } }
  }
  try { g.lfo.stop(); } catch { /* ya parado */ }
  g.ruido.liberar();
  g.convolver.buffer = null;   // Z102: suelta la respuesta al impulso
  g.espConectado = false; ESPACIO.conectado = false;
  for (const x of [g.lfo, g.lfoAfin, g.lfoCorte, g.lfoVol, g.mezcla, g.trem, g.seco, g.envio, g.retardo, g.lazo, g.realim, g.mojado, g.vol, g.on, g.analizador, g.envEsp, g.convolver, g.mojEsp]) {
    try { x.disconnect(); } catch { /* ok */ }
  }
  _g = null; SINTE.listo = false;
  reiniciarVoces(VOCES);
}
/** Al desmontar: suscripción, teclas, nodos (osciladores y LFO detenidos) y estado. */
export function liberarSinte(): void {
  _desuscribir?.(); _desuscribir = null;
  MANTENIDAS.n = 0;
  reiniciarArp(ARP);
  liberarGrafo();
  _arpPrev = false; SINTE.arpActivo = false; SINTE.vocesActivas = 0;
}

/**
 * Un cuadro (lo llama el atril en su useFrame; sin allocations): sigue el transporte de la caja (arpegiar ↔ tocar
 * directo), el BPM para el eco y cuenta las voces activas.
 */
export function tickSinte(): void {
  const g = _g, act = arpActivo();
  if (g && act !== _arpPrev) {
    const t = g.ctx.currentTime;
    if (act) { soltarSonando(g, t); reiniciarArp(ARP); }                       // empieza a arpegiar: suelta lo sostenido
    else for (let i = 0; i < MANTENIDAS.n; i++) tocar(g, MANTENIDAS.notas[i], t + 0.005);   // la caja paró: las teclas suenan normales
  }
  _arpPrev = act;
  if (SINTE.arpActivo !== act) { SINTE.arpActivo = act; SINTE.version++; }
  if (g && DBG_RITMOS.BPM !== _bpmAplicado) aplicarEco(g, g.ctx.currentTime);
  SINTE.vocesActivas = g ? vocesActivas(VOCES, g.ctx.currentTime) : 0;
}

// ── sonidos y parámetros (atril, menú; la cara después) ──
function marcarEditado(): void { SINTE.editado = SINTE.sonido !== "" && sonidoEditado(PARAMS_SY, SINTE.sonido); }
export function cargarSonidoSinte(nombre: NombreSonido): void {
  cargarSonido(PARAMS_SY, nombre);
  SINTE.sonido = nombre; SINTE.editado = false; SINTE.version++;
  const ctx = contextoNucleo(); if (_g && ctx) aplicarParams(_g, ctx.currentTime, SOST_FILTRO | SOST_VCA);
}
/**
 * setParam con fuente ("manual" desde el atril y el menú; "cara" preparada para cuando se enchufe la cara, con la regla
 * de Z99: no pisa el manual y al apagarla vuelve el manual). Aplica al instante si el grafo existe.
 */
export function setParamSinte(id: string, valor: number, fuente: FuenteParam = "manual"): boolean {
  const ok = setParam(PARAMS_SY, id, valor, fuente);
  if (!ok) return false;
  if (fuente === "cara") SINTE.versionCara++; else { marcarEditado(); SINTE.version++; }
  const ctx = contextoNucleo(); if (_g && ctx) aplicarParams(_g, ctx.currentTime, sostenidasDe(id));
  return true;
}
/** Enciende o apaga la fuente "cara" (al apagar vuelve el valor manual). Gancho para después: hoy no lo llama nadie. */
export function activarCaraSinte(on: boolean): void {
  activarCara(PARAMS_SY, on); SINTE.versionCara++;
  const ctx = contextoNucleo(); if (_g && ctx) aplicarParams(_g, ctx.currentTime);
}
export function liberarParamCaraSinte(id: string): void {
  if (!liberarParamCara(PARAMS_SY, id)) return;
  SINTE.versionCara++;
  const ctx = contextoNucleo(); if (_g && ctx) aplicarParams(_g, ctx.currentTime);
}
/** Opciones que no son del sonido (ON, arpegiador, octava): DBG_SINTE ya cambiado; esto aplica y avisa. */
export function aplicarOpcionesSinte(): void {
  DBG_SINTE.OCTAVA = Math.max(DBG_SINTE.OCTAVA_MIN, Math.min(DBG_SINTE.OCTAVA_MAX, Math.round(DBG_SINTE.OCTAVA)));
  DBG_SINTE.ARP_OCTAVAS = Math.max(1, Math.min(3, Math.round(DBG_SINTE.ARP_OCTAVAS)));
  const ctx = contextoNucleo(); if (_g && ctx) aplicarParams(_g, ctx.currentTime);
  SINTE.version++;
}
/** Analizador del VU del atril (null hasta la primera nota). */
export function analizadorSinte(): AnalyserNode | null { return _g?.analizador ?? null; }
/** Menú: suelta todo, libera las voces (se rehacen con SINTE_VOCES en la próxima nota) y vuelve al sonido inicial. */
export function silenciarYReiniciarSinte(): void {
  MANTENIDAS.n = 0;
  reiniciarArp(ARP);
  liberarGrafo();
  VOCES = crearVoces(DBG_SINTE.SINTE_VOCES);
  defectosDesdeDbg();
  cargarSonidoSinte(sonidoInicial());
  _arpPrev = false; SINTE.vocesActivas = 0; SINTE.reinicios++;
}
export function bpmSinte(): number { return DBG_RITMOS.BPM; }

// valores iniciales (al final del módulo: todo lo de arriba ya está definido)
defectosDesdeDbg();
cargarSonidoSinte(sonidoInicial());
