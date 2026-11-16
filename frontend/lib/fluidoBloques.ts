// Z61: tiempo y energía del "fluir de color" de los dos bloques de la composición central del domo (bloque AZUL =
// cordilleras ilustradas del centro, grupo MONTAÑAS; bloque NARANJA = olas/estratos cálidos de abajo, grupo LÍNEAS).
// Puro y sin imports (se prueba en Node: scripts/fluido-test.mjs). Lo avanza DomeSky una vez por frame con el dt del
// reloj de la experiencia (0 en pausa → quieto); el shader recibe el tiempo ACUMULADO de cada bloque, así cambiar la
// velocidad (menú o música) nunca produce saltos. Sin allocations.

export interface CfgFluido {
  ACTIVO: boolean; VEL_BASE: number; MUSICA_AZUL: number; MUSICA_NARANJA: number;
  ACELERA: number; SUAVIZADO_S: number; SIMULAR_AZUL: boolean; SIMULAR_NARANJA: boolean;
}
export interface EstadoFluido { tA: number; tN: number; eA: number; eN: number; tSim: number }
export function crearEstadoFluido(): EstadoFluido { return { tA: 0, tN: 0, eA: 0, eN: 0, tSim: 0 }; }
/** Estado compartido (lo avanza DomeSky). */
export const FLUIDO = crearEstadoFluido();

const fin = (x: number, d = 0): number => (Number.isFinite(x) ? x : d);
const sat = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Música simulada para probar sin audio: pulsos tipo bombo (~2 por segundo) con un fondo que respira. */
export function energiaSimulada(t: number): number {
  const golpe = Math.pow(0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 2.0), 6);
  return sat(0.25 + 0.2 * Math.sin(t * 0.7) + 0.6 * golpe);
}

/** Avanza un frame. eA / eN: energía del grupo de cada bloque (0…1, ya con la luz encendida o no, como hoy). */
export function avanzarFluido(s: EstadoFluido, c: CfgFluido, dt: number, eA: number, eN: number): EstadoFluido {
  const d = Math.max(0, fin(dt));
  s.tSim += d;
  const simA = c.SIMULAR_AZUL ? energiaSimulada(s.tSim) : 0, simN = c.SIMULAR_NARANJA ? energiaSimulada(s.tSim + 0.37) : 0;
  const objA = sat(Math.max(sat(fin(eA)), simA) * Math.max(0, fin(c.MUSICA_AZUL, 1)));
  const objN = sat(Math.max(sat(fin(eN)), simN) * Math.max(0, fin(c.MUSICA_NARANJA, 1)));
  // lerp temporal (exponencial, independiente de los fps)
  const k = 1 - Math.exp(-d / Math.max(0.02, fin(c.SUAVIZADO_S, 0.3)));
  s.eA += (objA - s.eA) * k;
  s.eN += (objN - s.eN) * k;
  // tiempo propio por bloque: deriva lenta sin música; la energía acelera (× (1 + ACELERA·e))
  const v = Math.max(0, fin(c.VEL_BASE, 0.05)), a = Math.max(0, fin(c.ACELERA, 2.5));
  s.tA = (s.tA + v * (1 + a * s.eA) * d) % 1000;
  s.tN = (s.tN + v * (1 + a * s.eN) * d) % 1000;
  return s;
}
