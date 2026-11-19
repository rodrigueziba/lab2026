// Z97b: acciones de las luces de ESCENA que tocan el STORE (restaurar y configuración actual). La lógica pura está en
// lib/lucesEscena.ts.
import { STORE, storeNotify } from "@/lib/alightStore";
import { DBG_ATRIL_VIDEO } from "@/lib/debugConfig";
import { LUZ_ESCENA, aporteExtrasViejas, type ConfigLuz } from "@/lib/lucesEscena";

/** Las constantes vivas de DBG_ATRIL_VIDEO (el objeto mismo: sin copias por frame). */
export function configLuz(): ConfigLuz { return DBG_ATRIL_VIDEO; }

/** Suma de las luces extra del diseño anterior (STORE.lights.extras) en unidades de nivel. Sin allocations. */
export function aporteViejasActual(): number {
  let cd = 0;
  for (let i = 0; i < STORE.lights.extras.length; i++) cd += STORE.lights.extras[i].intensity;
  return aporteExtrasViejas(cd, DBG_ATRIL_VIDEO);
}

/**
 * Todas las luces de la escena a su defecto: nivel LUZ_DEFECTO, EXTRA apagada y sin luces extra del diseño anterior.
 * El atril sincroniza su perilla INTENS. y la tecla EXTRA con el evento "alight:luces-restauradas".
 */
export function restaurarLucesEscena(): void {
  STORE.lights.globalIntensity = DBG_ATRIL_VIDEO.LUZ_DEFECTO;
  LUZ_ESCENA.extra = false;
  LUZ_ESCENA.version++;
  if (STORE.lights.extras.length) STORE.lights.extras.length = 0;   // quitar luces cambia su cantidad (recompila una vez)
  storeNotify();
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("alight:luces-restauradas"));
}
