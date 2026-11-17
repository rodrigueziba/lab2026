// Z78: reloj compartido de los instrumentos. Lógica PURA, sin imports (se prueba en Node: scripts/audio-nucleo-test.mjs).
// Patrón "A Tale of Two Clocks" (Chris Wilson, 2013): un temporizador del navegador solo DESPIERTA al programador cada
// ~25 ms; los tiempos de los pasos salen siempre del reloj de audio (AudioContext.currentTime) y se programan con
// anticipo (lookahead, ~100 ms). Así el tempo no depende del FPS ni de la precisión del temporizador.
//
// Pasos: pasosPorPulso pasos por negra (4 = semicorcheas) y pasosPorCompas pasos por compás (16 = 4/4).
// Oyentes: (paso, tiempo, compas, durS). Se llaman por cada paso con el tiempo EXACTO en el que debe sonar; el reloj
// no asigna memoria por paso (estado mutable, un arreglo de oyentes que solo cambia al suscribir o desuscribir).
// Pausa: pausar() guarda cuánto faltaba para el próximo paso; reanudar() lo retoma desde ahí (sin saltar ni repetir).
// Cortes: si el programador se atrasa (pestaña en segundo plano, tirón largo) los pasos vencidos NO se emiten tarde:
// se saltean manteniendo la grilla y se cuentan en `cortes`.

export type EstadoReloj = "detenido" | "corriendo" | "pausado";
export type OyentePaso = (paso: number, tiempo: number, compas: number, durS: number) => void;

export interface Reloj {
  estado: EstadoReloj;
  bpm: number;
  pasosPorPulso: number;
  pasosPorCompas: number;
  paso: number;          // próximo paso a emitir (0 … pasosPorCompas − 1)
  compas: number;        // compás del próximo paso
  siguienteT: number;    // tiempo de audio (s) del próximo paso
  restoPausaS: number;   // al pausar: cuánto faltaba para el próximo paso
  oyentes: OyentePaso[];
  pasosEmitidos: number;
  cortes: number;        // pasos salteados por atraso
}

export const BPM_MIN = 20;
export const BPM_MAX = 300;

const fin = (x: number, d: number): number => (Number.isFinite(x) ? x : d);

export function acotarBpm(bpm: number): number {
  return Math.min(BPM_MAX, Math.max(BPM_MIN, fin(bpm, 120)));
}

export function crearReloj(bpm = 120, pasosPorCompas = 16, pasosPorPulso = 4): Reloj {
  return {
    estado: "detenido", bpm: acotarBpm(bpm),
    pasosPorPulso: Math.max(1, Math.floor(fin(pasosPorPulso, 4))),
    pasosPorCompas: Math.max(1, Math.floor(fin(pasosPorCompas, 16))),
    paso: 0, compas: 0, siguienteT: 0, restoPausaS: 0, oyentes: [], pasosEmitidos: 0, cortes: 0,
  };
}

/** Duración de un paso (s) con el BPM actual. */
export function duracionPasoS(r: Reloj): number {
  return 60 / r.bpm / r.pasosPorPulso;
}

/** Cambia el tempo: vale desde el próximo paso (el que ya está programado no se mueve). */
export function setBpm(r: Reloj, bpm: number): void {
  r.bpm = acotarBpm(bpm);
}

/** Arranca desde el paso 0, `arranqueS` después de `ahora` (margen para programar el primero). */
export function iniciar(r: Reloj, ahora: number, arranqueS = 0.05): void {
  r.estado = "corriendo";
  r.paso = 0; r.compas = 0;
  r.siguienteT = fin(ahora, 0) + Math.max(0, fin(arranqueS, 0.05));
  r.restoPausaS = 0;
}

export function detener(r: Reloj): void {
  r.estado = "detenido";
  r.paso = 0; r.compas = 0; r.restoPausaS = 0;
}

export function pausar(r: Reloj, ahora: number): void {
  if (r.estado !== "corriendo") return;
  r.restoPausaS = Math.max(0, r.siguienteT - fin(ahora, 0));
  r.estado = "pausado";
}

export function reanudar(r: Reloj, ahora: number): void {
  if (r.estado !== "pausado") return;
  r.siguienteT = fin(ahora, 0) + r.restoPausaS;
  r.restoPausaS = 0;
  r.estado = "corriendo";
}

/** Suscribe un oyente de pasos. Devuelve la función para desuscribirlo. */
export function suscribir(r: Reloj, fn: OyentePaso): () => void {
  if (!r.oyentes.includes(fn)) r.oyentes.push(fn);
  return () => {
    const i = r.oyentes.indexOf(fn);
    if (i >= 0) r.oyentes.splice(i, 1);
  };
}

function avanzar(r: Reloj, d: number): void {
  r.siguienteT += d;
  r.paso++;
  if (r.paso >= r.pasosPorCompas) { r.paso = 0; r.compas++; }
}

/**
 * Programa los pasos que caen antes de `ahora + anticipoS`. Devuelve cuántos emitió.
 * Pasos vencidos (siguienteT < ahora − toleranciaS) se saltean y suman a `cortes`.
 * Sin allocations: recorre los oyentes de atrás para adelante (un oyente puede desuscribirse a sí mismo).
 */
export function programar(r: Reloj, ahora: number, anticipoS: number, toleranciaS = 0.02, maxPorTick = 64): number {
  if (r.estado !== "corriendo") return 0;
  const t0 = fin(ahora, 0);
  let d = duracionPasoS(r);
  let saltos = 0;
  while (r.siguienteT < t0 - toleranciaS && saltos < 100000) { avanzar(r, d); r.cortes++; saltos++; }
  const limite = t0 + Math.max(0, fin(anticipoS, 0.1));
  let n = 0;
  while (r.siguienteT < limite && n < maxPorTick) {
    for (let i = r.oyentes.length - 1; i >= 0; i--) {
      const o = r.oyentes[i];
      if (o) o(r.paso, r.siguienteT, r.compas, d);
    }
    r.pasosEmitidos++; n++;
    d = duracionPasoS(r);   // un oyente pudo cambiar el BPM
    avanzar(r, d);
  }
  return n;
}

/** Temporizador que despierta al programador. `ahora` = reloj de audio (s). Solo usa globalThis (sin DOM). */
export interface MotorReloj { tick(): number; parar(): void }
export function arrancarMotor(r: Reloj, ahora: () => number, anticipoS: () => number, intervaloMs = 25): MotorReloj {
  const tick = (): number => programar(r, ahora(), anticipoS());
  const id = globalThis.setInterval(tick, Math.max(5, intervaloMs));
  tick();
  return { tick, parar: () => globalThis.clearInterval(id) };
}
