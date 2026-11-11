// Z27: lógica PURA de la terminal de diálogo (sin React ni DOM, se testea en scripts/ink-test.mjs).
// Convierte un PasoDialogo de dialogoInk.ts en las líneas que la terminal escribe, el efecto a
// emitir y si el diálogo termina. Reglas:
//  - texto de la entidad → línea "entidad" (se tipea letra por letra);
//  - estado: pendiente → es un final: "[LÍNEA PENDIENTE <id>]" si marcarPendientes, si no
//    "[ fin de la transmisión ]"; si el nodo pendiente trae texto (1.b.d), primero se escribe;
//  - terminado (sin opciones) → "[ fin de la transmisión ]";
//  - como máximo 4 opciones (teclas 1–4).

import type { OpcionDialogo, PasoDialogo, Segmento } from "./dialogoInk";

export type TipoLinea = "entidad" | "eco" | "fin" | "pendiente";
export interface Linea { tipo: TipoLinea; segmentos: Segmento[] }

export const TEXTO_FIN = "[ fin de la transmisión ]";
export const MAX_OPCIONES = 4;

export interface PlanPaso {
  lineas: Linea[];          // en orden de escritura
  efecto: string | null;    // tag "efecto" (lo ejecuta el juego, no la terminal)
  id: string;               // tag "id" del nodo
  fin: boolean;             // emitir alight:dialogo-fin al terminar de escribir
  opciones: OpcionDialogo[]; // vacías si fin
}

const lineaSistema = (tipo: TipoLinea, texto: string): Linea => ({ tipo, segmentos: [{ texto, estilo: "normal" }] });

export function planDePaso(paso: PasoDialogo, marcarPendientes: boolean): PlanPaso {
  const id = paso.tags.id ?? "";
  const lineas: Linea[] = [];
  if (paso.segmentos.length) lineas.push({ tipo: "entidad", segmentos: paso.segmentos });
  const pendiente = paso.tags.estado === "pendiente";
  const fin = pendiente || paso.terminado || paso.opciones.length === 0;
  if (pendiente && marcarPendientes) lineas.push(lineaSistema("pendiente", `[LÍNEA PENDIENTE ${id}]`));
  else if (fin) lineas.push(lineaSistema("fin", TEXTO_FIN));
  return {
    lineas,
    efecto: paso.tags.efecto ? paso.tags.efecto : null,
    id,
    fin,
    opciones: fin ? [] : paso.opciones.slice(0, MAX_OPCIONES),
  };
}

/** Eco de la elección del usuario: "> " + texto de la opción (conserva cursiva/negrita). */
export function lineaEco(op: OpcionDialogo): Linea {
  return { tipo: "eco", segmentos: [{ texto: "> ", estilo: "normal" }, ...op.segmentos] };
}

export function largoSegmentos(segs: readonly Segmento[]): number {
  let n = 0;
  for (const s of segs) n += s.texto.length;
  return n;
}

// ── Z35: teclado de la terminal (lógica PURA; la usa DialogoTerminal y la testea scripts/ink-test.mjs) ──
// ↑ ↓ / W S: mover el resaltado entre opciones, con vuelta al otro extremo.
// Enter: si la línea se está escribiendo, la completa; con las opciones visibles, elige la resaltada.
// 1–4: elige directo. Espacio: sale del diálogo (reemplaza a Escape). Escape: no se intercepta
// (con pointer lock el navegador libera el mouse igual). Teclas repetidas (e.repeat): se consumen sin
// efecto. "consumir" = preventDefault + stopPropagation (solo para las teclas propias de la terminal).
export type FaseTerminal = "cerrado" | "cargando" | "escribiendo" | "opciones" | "fin" | "error";
export interface TeclaTerminal { code: string; key: string; repeat: boolean }
export type AccionTecla =
  | { tipo: "nada"; consumir: boolean }
  | { tipo: "mover"; sel: number; consumir: true }
  | { tipo: "elegir"; indice: number; consumir: true }
  | { tipo: "completar"; consumir: true }
  | { tipo: "salir"; consumir: true };

const NADA_PROPIA: AccionTecla = { tipo: "nada", consumir: true };
const NADA_AJENA: AccionTecla = { tipo: "nada", consumir: false };

/** Índice con vuelta al otro extremo (n > 0). */
export function moverSel(sel: number, delta: number, n: number): number {
  if (n <= 0) return 0;
  return (((sel + delta) % n) + n) % n;
}

export function accionTecla(t: TeclaTerminal, fase: FaseTerminal, nOpciones: number, sel: number): AccionTecla {
  const c = t.code, k = t.key;
  if (c === "Space" || k === " ") return t.repeat ? NADA_PROPIA : { tipo: "salir", consumir: true };
  if (c === "Enter" || c === "NumpadEnter" || k === "Enter") {
    if (t.repeat) return NADA_PROPIA;
    if (fase === "escribiendo") return { tipo: "completar", consumir: true };
    if (fase === "opciones" && nOpciones > 0) return { tipo: "elegir", indice: Math.min(Math.max(0, sel), nOpciones - 1), consumir: true };
    return NADA_PROPIA;
  }
  const arriba = c === "ArrowUp" || c === "KeyW";
  const abajo = c === "ArrowDown" || c === "KeyS";
  if (arriba || abajo) {
    if (t.repeat || fase !== "opciones" || nOpciones <= 0) return NADA_PROPIA;
    return { tipo: "mover", sel: moverSel(sel, arriba ? -1 : 1, nOpciones), consumir: true };
  }
  const m = /^(?:Digit|Numpad)([1-4])$/.exec(c);
  const num = m ? Number(m[1]) : (k.length === 1 && k >= "1" && k <= "4" ? Number(k) : 0);
  if (num) {
    if (t.repeat || fase !== "opciones" || num > nOpciones) return NADA_PROPIA;
    return { tipo: "elegir", indice: num - 1, consumir: true };
  }
  return NADA_AJENA;   // Escape, Shift y todo lo demás: no se tocan
}
