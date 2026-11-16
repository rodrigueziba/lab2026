// Z73: acciones del control del día del menú de debug, en un solo lugar. Las usan la sección "Control del día" y los
// atajos de "Prisma y flor" y "Base de la flor" (components/debug/pestanas/*): misma lógica que tenían esos botones
// (Z54, Z67), movida acá sin cambios para no duplicarla.
import { DBG_DIA, DBG_FLOR, DBG_CHECKPOINTS } from "@/lib/debugConfig";
import { DIA, posicionarDia } from "@/lib/cicloDia";
import { AMANECER } from "@/lib/amanecer";
import { duracionTemaViz, idTemaViz } from "@/lib/vizAudio";
import { FLOR } from "@/lib/prismaFlor";
import { CHECKPOINTS, irACheckpoint } from "@/lib/checkpoints";

/** Etapas del día para "ir a tDia" (DBG_DIA.KEYS). */
export const ETAPAS_DIA: readonly (readonly [string, number])[] = [
  ["alba", DBG_DIA.KEYS.ALBA], ["salida", DBG_DIA.KEYS.SALIDA], ["mediodía", DBG_DIA.KEYS.MEDIODIA],
  ["atardecer", DBG_DIA.KEYS.ATARDECER], ["crepúsculo", DBG_DIA.KEYS.CREPUSCULO],
];
/** Checkpoints del día (Z48, Z54): los de id "dia_…". */
export const CHECKPOINTS_DIA = CHECKPOINTS.filter(c => c.id.startsWith("dia_"));

/** tDia fijo (0…1) o −1 = sigue el reloj. */
export function fijarTDia(t: number): void { DBG_DIA.T_MANUAL = t; }
export function velocidadDia(v: number): void { DBG_DIA.VELOCIDAD = v; }
/** Vuelve al reloj (T_MANUAL −1) y, si se indica, con otra velocidad. */
export function usarReloj(velocidad?: number): void { DBG_DIA.T_MANUAL = -1; if (velocidad !== undefined) DBG_DIA.VELOCIDAD = velocidad; }
/** Salta a tDia t y sigue con el reloj desde ahí. */
export function irATDia(t: number): void {
  DBG_DIA.T_MANUAL = -1;
  posicionarDia(DIA, DBG_DIA, t, AMANECER, duracionTemaViz(), idTemaViz());
}
/** Salta a un checkpoint del día (solo con los checkpoints habilitados). */
export function irCheckpointDia(id: string): void { if (DBG_CHECKPOINTS.HABILITADOS) irACheckpoint(id); }

// ── acciones de los atajos (Z54 "Probar flor", Z67 base de la flor) ──
/** Z54: recorre el ciclo a velocidad 24 (con el visualizador activo). */
export function probarFlor(): void {
  DBG_DIA.T_MANUAL = -1; DBG_DIA.VELOCIDAD = 24;
  if (DIA.fase === "espera") posicionarDia(DIA, DBG_DIA, 0.2, AMANECER, duracionTemaViz(), idTemaViz());
}
/** Z67: flor fija en su pico (tDia 0,5); si el ciclo con la flor no está montado, salta al checkpoint "dia_flor". */
export function mostrarBaseConFlor(): void {
  if (!FLOR.activo && DBG_CHECKPOINTS.HABILITADOS) irACheckpoint("dia_flor");
  DBG_DIA.T_MANUAL = 0.5;
}
/** Z67: el nacimiento de la flor a velocidad 3, con la base reiniciada. */
export function animarNacimiento(): void {
  DBG_DIA.T_MANUAL = -1; DBG_DIA.VELOCIDAD = 3;
  posicionarDia(DIA, DBG_DIA, Math.max(0, DBG_FLOR.NACE_INICIO - 0.01), AMANECER, duracionTemaViz(), idTemaViz());
  window.dispatchEvent(new CustomEvent("alight:base-flor-reiniciar"));
}
/** Z67: reloj a velocidad 1 y base reiniciada. */
export function reiniciarBaseFlor(): void {
  DBG_DIA.T_MANUAL = -1; DBG_DIA.VELOCIDAD = 1;
  window.dispatchEvent(new CustomEvent("alight:base-flor-reiniciar"));
}
