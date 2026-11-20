// Z108: pastilla MANOS de cada atril, como DATOS (lógica pura; importa solo los layouts puros de los atriles).
// Va en la BANDA DE TÍTULO de un módulo sin ON, arriba a la derecha (donde va la pastilla ON en los módulos que la tienen),
// con la misma forma de pastilla pero más ancha (dice MANOS). Elegida por la prueba de colisiones contra las huellas de
// los controles y los textos de cada layout (scripts/manos-test.mjs). El panel no se agranda (marco de 0,85 m).
import { BANDA_TITULO, modulo } from "./atrilSonido";
import { moduloI } from "./atrilImagen";
import { moduloB } from "./atrilBajo";
import { moduloY } from "./atrilSinte";
import { moduloM } from "./atrilSampler";

export type LadoManos = "sonido" | "imagen" | "bajo" | "sinte" | "sampler";
/** Pastilla MANOS: medio ancho y media profundidad (la del ON es 0,029 × 0,013; esta es más ancha por el texto). */
export const PASTILLA_MANOS = { hu: 0.040, hv: 0.013, ancho: 0.080, prof: 0.026, textoAncho: 0.068, textoAlto: 0.0125 } as const;
/** Desde el borde derecho del módulo al centro de la pastilla. */
export const MANOS_DX = 0.050;
/** Módulo (sin ON) que lleva la pastilla en cada atril e id del control. */
export const MODULO_MANOS: Record<LadoManos, string> = { sonido: "lfo", imagen: "escena", bajo: "secuencia", sinte: "timbre", sampler: "editar" };
export const ID_MANOS: Record<LadoManos, string> = { sonido: "manos_s", imagen: "manos_i", bajo: "manos_b", sinte: "manos_y", sampler: "manos_m" };
export const IDS_MANOS = Object.values(ID_MANOS);

function rect(lado: LadoManos): { u0: number; u1: number; v0: number; v1: number } {
  const id = MODULO_MANOS[lado];
  return lado === "sonido" ? modulo(id).rect : lado === "imagen" ? moduloI(id).rect : lado === "bajo" ? moduloB(id).rect : lado === "sinte" ? moduloY(id).rect : moduloM(id).rect;
}
/** Centro (u, v) de la pastilla MANOS en el panel de ese atril. */
export function posManos(lado: LadoManos): { u: number; v: number } {
  const r = rect(lado);
  return { u: r.u1 - MANOS_DX, v: r.v1 - BANDA_TITULO / 2 };
}
/** Huella (rectángulo) de la pastilla, para la prueba de colisiones. */
export function huellaManos(lado: LadoManos): { u0: number; u1: number; v0: number; v1: number } {
  const p = posManos(lado);
  return { u0: p.u - PASTILLA_MANOS.hu, u1: p.u + PASTILLA_MANOS.hu, v0: p.v - PASTILLA_MANOS.hv, v1: p.v + PASTILLA_MANOS.hv };
}
