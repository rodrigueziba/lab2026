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
