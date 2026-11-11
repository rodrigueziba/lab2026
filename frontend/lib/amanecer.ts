// Z38: máquina ÚNICA del amanecer (reemplaza a U9 —alightStore getDawnState— y W3 —getDomeDawnState—
// cuando DBG_AMANECER.UNIFICADO; las dos viejas siguen intactas para el modo viejo).
// Lógica PURA, sin imports (se prueba en Node: scripts/amanecer-test.mjs).
//
//  - Disparo único: dispararAmanecer() (lo llama HazSystem con el primer 'alight:haz-toggle' on) deja
//    el arranque pendiente; el próximo tick lo arranca.
//  - Un solo reloj: tickAmanecer(dt, pausado, durS) — UN lugar, una vez por frame (AmanecerReloj).
//    Avanza con dt y NO avanza con la pausa de Z28 (pausado = PAUSA.activa): no hace falta correr startT.
//  - Fase 1: p1 lineal 0..1 en durS segundos (los consumidores aplican easeOut3 o no, como antes).
//  - Al terminar la fase 1: 'alight:dawn-complete' y su alias 'alight:dome-dawn-complete', UNA vez.
//  - Fase 2: tFin = segundos desde el fin de la fase 1 (cada consumidor arma su revelado escalonado).
//  - reset → inactivo; skip → completo con tFin grande (como skipDawnToFinal: no emite el evento).
//  - sectorDeg: sector aleatorio estable por sesión (lo usa solo el panorama U9; el domo no tiene sector).
// Sin allocations por tick.

export type FaseAmanecer = "inactivo" | "amanecer" | "completo";

export const AMANECER = {
  fase: "inactivo" as FaseAmanecer,
  pendiente: false,   // disparado, arranca en el próximo tick
  t: 0,               // s acumulados de la fase 1 (sin contar pausas)
  p1: 0,              // progreso lineal de la fase 1 (0..1)
  tFin: 0,            // s desde el fin de la fase 1 (sin contar pausas)
  sectorDeg: Math.floor(Math.random() * 360),
  emitidos: 0,        // veces que se emitió 'alight:dawn-complete' (debug/tests)
};

export const SKIP_TFIN_S = 9999;   // = el "clockT − 9999" de los skip viejos

/** Ease-out cúbico compartido (U9 eo3 y W3 _easeOut3Dawn eran la misma curva). */
export function easeOut3(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

/** Disparo único: solo tiene efecto con el amanecer inactivo. */
export function dispararAmanecer(): void {
  if (AMANECER.fase === "inactivo") AMANECER.pendiente = true;
}

function emitirFin(): void {
  AMANECER.emitidos++;
  const w = (globalThis as { window?: { dispatchEvent(e: Event): boolean } }).window;
  if (!w || typeof CustomEvent === "undefined") return;
  w.dispatchEvent(new CustomEvent("alight:dawn-complete"));
  w.dispatchEvent(new CustomEvent("alight:dome-dawn-complete"));   // alias de compatibilidad (W3)
}

/** Único reloj del amanecer. dt en s; con pausado no avanza nada. */
export function tickAmanecer(dt: number, pausado: boolean, durS: number): void {
  if (AMANECER.pendiente && AMANECER.fase === "inactivo") {
    AMANECER.pendiente = false;
    AMANECER.fase = "amanecer";
    AMANECER.t = 0; AMANECER.p1 = 0; AMANECER.tFin = 0;
  }
  if (pausado || !(dt > 0)) return;
  if (AMANECER.fase === "amanecer") {
    AMANECER.t += dt;
    AMANECER.p1 = Math.min(1, AMANECER.t / Math.max(1e-3, durS));
    if (AMANECER.p1 >= 1) {
      AMANECER.fase = "completo";
      AMANECER.tFin = 0;
      emitirFin();
    }
  } else if (AMANECER.fase === "completo") {
    AMANECER.tFin += dt;
  }
}

export function resetAmanecer(): void {
  AMANECER.fase = "inactivo";
  AMANECER.pendiente = false;
  AMANECER.t = 0; AMANECER.p1 = 0; AMANECER.tFin = 0;
}

export function skipAmanecer(): void {
  AMANECER.fase = "completo";
  AMANECER.pendiente = false;
  AMANECER.p1 = 1;
  AMANECER.tFin = SKIP_TFIN_S;
}

// ── Adaptador para los consumidores existentes (U9 VizPanorama, W3 DomeSkyAnchor, cielo U9 del panorama) ──
// Escribe el estado único en el formato viejo { phase, startT, completeT, sectorDeg } relativo al clock
// del consumidor: (clockT − startT) / durS = p1  y  clockT − completeT = tFin. Así cada uno conserva su
// fase 2, sus curvas y su paleta sin cambios; solo cambia de dónde lee. Sin allocations (escribe en out).
export interface EstadoCompat { phase: FaseAmanecer; startT: number; completeT: number; sectorDeg: number }

export function estadoCompat(clockT: number, durS: number, out: EstadoCompat): EstadoCompat {
  out.phase = AMANECER.fase;
  out.sectorDeg = AMANECER.sectorDeg;
  out.startT = clockT - AMANECER.p1 * durS;
  out.completeT = clockT - AMANECER.tFin;
  return out;
}
