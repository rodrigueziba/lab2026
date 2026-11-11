// Z29: estado de los efectos del diálogo y persistencia del premio. SIN three ni React: lo leen el
// menú de debug, Audience (público apagado) y el Player de ThreeScene (bloqueo de la zona de la tarima).
// La lógica que toca la escena vive en lib/dialogo/efectosDialogo.ts.
//
// Premio: localStorage "alight:premio" = { valor: true, ts, vence } (ms epoch). Se lee al iniciar; si
// venció se borra y vale false. Duración: DBG_EFECTOS.PREMIO_DURACION_S (default 3600 s).

import { DBG_EFECTOS } from "@/lib/debugConfig";

export const EFECTOS_STATE = {
  alarmaActiva: false,       // juego_alarma en curso: luces apagadas, alarma sonando, esperando tocar la tarima
  bloqueaZonaTarima: false,  // la zona de elección TARIMA (ZONA_LUZ) no dispara mientras sea true
  sinPublico: false,         // ir_tarima_sin_publico: Audience no activa las figuras
  premio: false,             // premio vigente (leído de localStorage)
  premioVence: 0,            // ms epoch
  luces: 1,                  // multiplicador actual de intensidad de las luces (0..1)
  alarmaSonando: false,      // el PositionalAudio está reproduciendo (debug)
  audioCtx: "",              // estado del AudioContext de la alarma (debug)
};

const CLAVE = "alight:premio";

interface PremioGuardado { valor: boolean; ts: number; vence: number }

/** Lee el premio de localStorage. Si venció (o no hay), lo borra y devuelve false. */
export function leerPremio(): boolean {
  let ok = false, vence = 0;
  try {
    const raw = window.localStorage.getItem(CLAVE);
    if (raw) {
      const p = JSON.parse(raw) as Partial<PremioGuardado>;
      if (p.valor === true && typeof p.vence === "number" && Date.now() < p.vence) { ok = true; vence = p.vence; }
      else window.localStorage.removeItem(CLAVE);
    }
  } catch { /* sin storage (modo privado, bloqueado): premio solo en memoria */ }
  if (!ok && EFECTOS_STATE.premio && Date.now() < EFECTOS_STATE.premioVence) return true;   // fallback en memoria
  EFECTOS_STATE.premio = ok;
  EFECTOS_STATE.premioVence = vence;
  return ok;
}

/** Guarda premio=true con timestamp y vencimiento (DBG_EFECTOS.PREMIO_DURACION_S). */
export function guardarPremio(): void {
  const ts = Date.now();
  const vence = ts + Math.max(1, DBG_EFECTOS.PREMIO_DURACION_S) * 1000;
  EFECTOS_STATE.premio = true;
  EFECTOS_STATE.premioVence = vence;
  try {
    const p: PremioGuardado = { valor: true, ts, vence };
    window.localStorage.setItem(CLAVE, JSON.stringify(p));
  } catch { /* queda solo en memoria */ }
}

export function borrarPremio(): void {
  EFECTOS_STATE.premio = false;
  EFECTOS_STATE.premioVence = 0;
  try { window.localStorage.removeItem(CLAVE); } catch { /* nada */ }
  window.dispatchEvent(new CustomEvent("alight:premio-cambio"));
}

/** Botón de debug: ejecuta un efecto sin pasar por el diálogo (mismo camino que el tag de ink). */
export function probarEfecto(efecto: string): void {
  window.dispatchEvent(new CustomEvent("alight:dialogo-efecto", { detail: { efecto, id: "debug" } }));
}
