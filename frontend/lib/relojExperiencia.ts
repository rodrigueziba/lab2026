// Z39: reloj ÚNICO de la experiencia. Avanza con dt una vez por frame (lo llama AmanecerReloj, siempre
// montado) y NO avanza con la pausa de Z28 (pausado = PAUSA.activa). Sin imports: se prueba en Node
// (scripts/reloj-test.mjs).
//
//  - RELOJ.tExp: segundos de experiencia acumulados · RELOJ.dtExp: dt de experiencia del último tick
//    (0 en pausa): para animaciones que avanzaban "por frame".
//  - ahoraExp(): ms de experiencia, el equivalente congelable de performance.now() / Date.now().
//  - crearEspera(ms, cb): temporizador que cuenta solo con este reloj (se congela con la pausa);
//    devuelve { cancel(), activa }. Las esperas vencidas se disparan dentro del tick.
//  - limpiarEsperas(): al desmontar el anfitrión.
// Sin allocations por tick (las esperas se crean al pedirlas, no por frame).

export const RELOJ = {
  tExp: 0,    // s acumulados (sin pausas)
  dtExp: 0,   // dt del último tick (0 si estaba en pausa)
  congelado: false,   // Z40: un checkpoint está remontando la escena: la escena vieja no avanza nada
};

export interface Espera {
  cancel(): void;
  readonly activa: boolean;
}

interface EsperaInt extends Espera {
  fin: number;          // ms de experiencia en que vence
  cb: () => void;
  viva: boolean;
}

const _esperas: EsperaInt[] = [];

export function ahoraExp(): number {
  return RELOJ.tExp * 1000;
}

export function crearEspera(ms: number, cb: () => void): Espera {
  const e: EsperaInt = {
    fin: RELOJ.tExp * 1000 + Math.max(0, ms),
    cb,
    viva: true,
    get activa() { return this.viva; },
    cancel() { this.viva = false; },
  };
  _esperas.push(e);
  return e;
}

function quitar(i: number): void {
  for (let j = i; j < _esperas.length - 1; j++) _esperas[j] = _esperas[j + 1];
  _esperas.length--;
}

/** Una vez por frame. dt en s; con pausado el reloj no avanza ni se dispara ninguna espera. */
export function tickReloj(dt: number, pausado: boolean): void {
  RELOJ.dtExp = 0;
  if (pausado || RELOJ.congelado || !(dt > 0)) return;
  RELOJ.tExp += dt;
  RELOJ.dtExp = dt;
  procesarEsperas();
}

/** Z40: adelanta el reloj (checkpoints): suma seg a tExp y a dtExp del frame y dispara lo vencido.
 *  No crea nada; se llama a lo sumo una vez por frame. */
export function adelantarReloj(seg: number): void {
  if (!(seg > 0)) return;
  RELOJ.tExp += seg;
  RELOJ.dtExp += seg;
  procesarEsperas();
}

function procesarEsperas(): void {
  const ahora = RELOJ.tExp * 1000;
  let i = 0;
  while (i < _esperas.length) {
    const e = _esperas[i];
    if (!e.viva) { quitar(i); continue; }
    if (ahora >= e.fin) {
      quitar(i);
      e.viva = false;
      e.cb();           // puede crear esperas nuevas: se agregan al final y se evalúan en este mismo paso
      continue;
    }
    i++;
  }
}

/** Cancela y descarta todas las esperas (al desmontar el anfitrión). */
export function limpiarEsperas(): void {
  for (const e of _esperas) e.viva = false;
  _esperas.length = 0;
}

/** Esperas vivas pendientes (debug / tests). */
export function esperasPendientes(): number {
  let n = 0;
  for (const e of _esperas) if (e.viva) n++;
  return n;
}
