// Z39: estado de la secuencia SILLAS medido con el reloj de la experiencia (lib/relojExperiencia.ts).
// Solo se usa con DBG_SECUENCIA.RELOJ_UNIFICADO; con false todo sigue como antes (setTimeout 9_800 y
// Date.now en ExperienceDome, setTimeout(releaseDelayMs) en ThreeScene).
//
//  - iniciarRevelado(): con 'alight:prism-landed'. Guarda el inicio del revelado escalonado de los paneles
//    y arma el TOPE DE SEGURIDAD (DBG_SECUENCIA.TOPE_REVELADO_S): si el revelado nunca termina (panel sin
//    material, ExperienceDome desmontado, etc.) 'alight:dome-revealed' se emite igual. El tope vive en el
//    reloj, no en ExperienceDome, así que sobrevive a su desmontaje.
//  - revelarFinal(): lo llama el ÚLTIMO panel (mayor staggerSec) cuando su uReveal llega a 1. Emite
//    'alight:dome-revealed' respetando un mínimo (REVELADO_MIN_S, default 9,8 s = el setTimeout de antes),
//    para que los tiempos percibidos no cambien aunque haya menos paneles.
//  - Se emite UNA sola vez por secuencia (detail.motivo: "revelado" | "minimo" | "tope").

import { ahoraExp, crearEspera, type Espera } from "@/lib/relojExperiencia";

export const SECUENCIA = {
  activadoExpMs: -1,        // ahoraExp() de prism-landed (−1 = sin revelado en curso)
  maxStagger: 0,            // staggerSec del último panel (lo escribe ExperienceDome al armar las órbitas)
  domeRevealedEmitido: false,
  motivo: "",
  tope: null as Espera | null,
  minimo: null as Espera | null,
};

function emitir(motivo: string): void {
  if (SECUENCIA.domeRevealedEmitido) return;
  SECUENCIA.domeRevealedEmitido = true;
  SECUENCIA.motivo = motivo;
  SECUENCIA.tope?.cancel(); SECUENCIA.tope = null;
  SECUENCIA.minimo?.cancel(); SECUENCIA.minimo = null;
  window.dispatchEvent(new CustomEvent("alight:dome-revealed", { detail: { motivo } }));
}

export function iniciarRevelado(topeS: number): void {
  cancelarSecuencia();
  SECUENCIA.activadoExpMs = ahoraExp();
  SECUENCIA.domeRevealedEmitido = false;
  SECUENCIA.motivo = "";
  SECUENCIA.tope = crearEspera(Math.max(0, topeS) * 1000, () => { SECUENCIA.tope = null; emitir("tope"); });
}

/** El último panel terminó su revelado. minS: mínimo desde prism-landed (REVELADO_MIN_S). */
export function revelarFinal(minS: number): void {
  if (SECUENCIA.domeRevealedEmitido || SECUENCIA.activadoExpMs < 0 || SECUENCIA.minimo) return;
  const resta = Math.max(0, minS) * 1000 - (ahoraExp() - SECUENCIA.activadoExpMs);
  if (resta <= 0) { emitir("revelado"); return; }
  SECUENCIA.minimo = crearEspera(resta, () => { SECUENCIA.minimo = null; emitir("minimo"); });
}

/** Debug skip/reset sillas o desmontaje: cancela tope y mínimo pendientes. */
export function cancelarSecuencia(): void {
  SECUENCIA.tope?.cancel(); SECUENCIA.tope = null;
  SECUENCIA.minimo?.cancel(); SECUENCIA.minimo = null;
}
