// Z81: una acción por pulsación en los botones de los atriles. Lógica PURA, sin imports (prueba: scripts/atriles-click-test.mjs).
// Causa raíz del doble disparo: LecternSystem.setCtrl(id, v, def) llama a def.onActivate(v) en CADA cambio de valor. Un
// botón se aprieta con setCtrl(id, 1) y, 120 ms después (o al soltar en el mantener apretado), vuelve a reposo con
// setCtrl(id, 0) para la animación: dos llamadas, y los botones cuya acción no mira v (ANT., SIG., ONDA, DESTINO,
// SIG.EFE., LUZ −, LUZ +, LUZ *) actuaban dos veces. Regla: en un "button" solo el flanco de subida (v > 0,5) ejecuta la
// acción; la vuelta a 0 solo actualiza el estado visual. Perillas, deslizadores, interruptores (toggle) y la superficie
// de la caja de ritmos no cambian: cada cambio de valor es una acción. Mantener apretado (LUZ ±) sigue repitiendo: cada
// repetición es una nueva subida. DBG_PLAY.CLICK_UNICO = false vuelve al comportamiento anterior.

/** ¿Este cambio de valor ejecuta la acción del control? */
export function activaAccion(tipo: string, valor: number, clickUnico: boolean): boolean {
  if (!clickUnico) return true;
  if (tipo === "button") return valor > 0.5;
  return true;
}
