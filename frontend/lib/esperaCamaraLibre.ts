// Z105: ¿la cámara está en manos del usuario en control libre? Función ÚNICA para el modo de espera
// (components/EsperaCamara.tsx). Devuelve "" si está libre o el motivo del bloqueo (se muestra en el menú).
// Con un motivo, el modo de espera no se activa y su cuenta vuelve a 0; si ya estaba activo, devuelve la cámara al
// instante (salvo la pausa, que solo congela). No hay un sistema de "desenlace" en el proyecto (se buscó: no existe).
import { PAUSA } from "@/lib/pausaExperiencia";
import { DIALOGO_STATE } from "@/lib/dialogo/dialogoEstado";
import { INTERACT_STATE } from "@/lib/alightStore";
import { LUZ_STATE } from "@/lib/caminoLuz";
import { CK_STATE } from "@/lib/checkpoints";
import { RELOJ } from "@/lib/relojExperiencia";
import { movimientoBloqueado, ENTRADA } from "@/lib/entradaTelon";
import { FLASH_STATE } from "@/lib/curtainFlash";

export type MotivoBloqueo = "" | "pausa" | "dialogo" | "atril" | "animacion de camara" | "camino LUZ" | "fuera del area"
  | "secuencia SILLAS" | "entrada tras el telon" | "panel abierto" | "checkpoint" | "telon" | "destello" | "benchmark";

/** enTelon: DBG_ESPERA.EN_TELON (con false, frente al telón del inicio no se activa). benchmark: hay un benchmark corriendo. */
export function camaraLibre(enTelon: boolean, benchmark: boolean): MotivoBloqueo {
  if (PAUSA.activa) return "pausa";
  if (CK_STATE.fase === "aplicando" || CK_STATE.pendiente !== "" || RELOJ.congelado) return "checkpoint";
  if (benchmark) return "benchmark";
  if (DIALOGO_STATE.activo) return "dialogo";
  if (INTERACT_STATE.mode !== "none") return "atril";
  if (INTERACT_STATE.camAnimActive) return "animacion de camara";
  if (LUZ_STATE.fase === "girando" || LUZ_STATE.fase === "dialogo") return "camino LUZ";
  if (LUZ_STATE.fuera) return "fuera del area";
  if (INTERACT_STATE.movementLocked) return "secuencia SILLAS";
  if (movimientoBloqueado() || ENTRADA.fase !== "inactiva") return "entrada tras el telon";
  if (INTERACT_STATE.panelBloqueo) return "panel abierto";
  if (FLASH_STATE.fase !== "inactivo") return "destello";
  if (!enTelon && INTERACT_STATE.experienceState === "cortina") return "telon";
  return "";
}
