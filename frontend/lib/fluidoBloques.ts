// Z61: tiempo y energía del "fluir de color" de los dos bloques de la composición central del domo (bloque AZUL =
// cordilleras ilustradas del centro, grupo MONTAÑAS; bloque NARANJA = olas/estratos cálidos de abajo, grupo LÍNEAS).
// Puro y sin imports (se prueba en Node: scripts/fluido-test.mjs). Lo avanza DomeSky una vez por frame con el dt del
// reloj de la experiencia (0 en pausa → quieto); el shader recibe el tiempo ACUMULADO de cada bloque, así cambiar la
// velocidad (menú o música) nunca produce saltos. Sin allocations.

export interface CfgFluido {
  ACTIVO: boolean; VEL_BASE: number; MUSICA_AZUL: number; MUSICA_NARANJA: number;
  ACELERA: number; SUAVIZADO_S: number; SIMULAR_AZUL: boolean; SIMULAR_NARANJA: boolean;
  // Z63: banda de cada bloque ("auto" = la más activa, distinta para cada bloque · "grupo" = la de su grupo como Z61 ·
  // "0"…"3") y ganancia automática (máximo y mínimo móviles lentos, con piso para el silencio)
  BANDA_AZUL?: string; BANDA_NARANJA?: string; MAX_S?: number; PISO?: number; ATAQUE_S?: number;
}
export interface EstadoFluido {
  tA: number; tN: number; eA: number; eN: number; tSim: number;
  max: number[]; min: number[]; media: number[]; bandaA: number; bandaN: number;   // Z63
}
export function crearEstadoFluido(): EstadoFluido {
  return { tA: 0, tN: 0, eA: 0, eN: 0, tSim: 0, max: [0, 0, 0, 0], min: [0, 0, 0, 0], media: [0, 0, 0, 0], bandaA: 1, bandaN: 3 };
}
/** Estado compartido (lo avanza DomeSky). */
export const FLUIDO = crearEstadoFluido();

const fin = (x: number, d = 0): number => (Number.isFinite(x) ? x : d);
const sat = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Música simulada para probar sin audio: pulsos tipo bombo (~2 por segundo) con un fondo que respira. */
export function energiaSimulada(t: number): number {
  const golpe = Math.pow(0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 2.0), 6);
  return sat(0.25 + 0.2 * Math.sin(t * 0.7) + 0.6 * golpe);
}

/** Z63: elige la banda de un bloque. "auto": la de mayor media lenta (salvo `excluir`); "grupo": la de su grupo. */
export function elegirBanda(modo: string | undefined, media: ArrayLike<number>, grupo: number, excluir = -1): number {
  const m = modo ?? "auto";
  if (m === "grupo") return Math.max(0, Math.min(3, Math.round(fin(grupo))));
  if (m !== "auto") { const n = Math.round(Number(m)); return Number.isFinite(n) ? Math.max(0, Math.min(3, n)) : 0; }
  let mejor = -1, v = -1;
  for (let b = 0; b < 4; b++) { if (b === excluir) continue; const x = fin(media[b]); if (x > v + 1e-9) { v = x; mejor = b; } }
  return mejor < 0 ? 0 : mejor;
}

/** Avanza un frame. bandas: energía cruda de las 4 bandas (BAND_STATE.energy); onA / onN: luz del grupo encendida
 *  (MONTAÑAS → azul, LÍNEAS → naranja, como hoy); grupoA / grupoN: banda asignada a cada grupo (BAND_STATE.assignment). */
export function avanzarFluido(s: EstadoFluido, c: CfgFluido, dt: number, bandas: ArrayLike<number>, onA: boolean, onN: boolean,
  grupoA = 1, grupoN = 3): EstadoFluido {
  const d = Math.max(0, fin(dt));
  s.tSim += d;
  // ganancia automática: máximo móvil (sube al instante, baja lento) y media lenta para "auto"
  const kMax = 1 - Math.exp(-d / Math.max(0.5, fin(c.MAX_S ?? 8, 8))), kMed = 1 - Math.exp(-d / 2);
  for (let b = 0; b < 4; b++) {
    const x = Math.max(0, fin(bandas[b] ?? 0));
    s.max[b] = x > s.max[b] ? x : s.max[b] + (x - s.max[b]) * kMax;
    s.min[b] = x < s.min[b] ? x : s.min[b] + (x - s.min[b]) * kMax;   // piso móvil: baja al instante, sube lento
    s.media[b] += (x - s.media[b]) * kMed;
  }
  const piso = Math.max(1e-4, fin(c.PISO ?? 0.02, 0.02));
  // (x − mínimo) / (máximo − mínimo): recorre 0…1 sin importar el volumen ni el nivel de fondo del tema
  const norm = (b: number): number => sat((Math.max(0, fin(bandas[b] ?? 0)) - s.min[b]) / Math.max(s.max[b] - s.min[b], piso));
  s.bandaA = elegirBanda(c.BANDA_AZUL, s.media, grupoA);
  s.bandaN = elegirBanda(c.BANDA_NARANJA, s.media, grupoN, (c.BANDA_AZUL ?? "auto") === "auto" && (c.BANDA_NARANJA ?? "auto") === "auto" ? s.bandaA : -1);
  const simA = c.SIMULAR_AZUL ? energiaSimulada(s.tSim) : 0, simN = c.SIMULAR_NARANJA ? energiaSimulada(s.tSim + 0.37) : 0;
  const objA = sat(Math.max(onA ? norm(s.bandaA) : 0, simA) * Math.max(0, fin(c.MUSICA_AZUL, 1)));
  const objN = sat(Math.max(onN ? norm(s.bandaN) : 0, simN) * Math.max(0, fin(c.MUSICA_NARANJA, 1)));
  // lerp temporal (exponencial, independiente de los fps). Z63: subida rápida (ATAQUE_S) y bajada SUAVIZADO_S, como una
  // envolvente: un golpe de 0,1 s llega arriba (con 0,3 s simétrico no pasaba de ~0,4)
  const kB = 1 - Math.exp(-d / Math.max(0.02, fin(c.SUAVIZADO_S, 0.3)));
  const kS = 1 - Math.exp(-d / Math.max(0.005, fin(c.ATAQUE_S ?? 0.05, 0.05)));
  s.eA += (objA - s.eA) * (objA > s.eA ? kS : kB);
  s.eN += (objN - s.eN) * (objN > s.eN ? kS : kB);
  // tiempo propio por bloque: deriva lenta sin música; la energía acelera (× (1 + ACELERA·e))
  const v = Math.max(0, fin(c.VEL_BASE, 0.05)), a = Math.max(0, fin(c.ACELERA, 2.5));
  s.tA = (s.tA + v * (1 + a * s.eA) * d) % 1000;
  s.tN = (s.tN + v * (1 + a * s.eN) * d) % 1000;
  return s;
}
