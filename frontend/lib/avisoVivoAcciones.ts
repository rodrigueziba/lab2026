// Z85: une el aviso de la sesión en vivo (lib/avisoVivo.ts) con la terminal de diálogo (misma interfaz que la narrativa,
// fuente docs/dialogos/aviso-vivo.ink), los monolitos de Z82 (MONO_VIVO, aceptarTransmision, REQUIERE_ACEPTACION),
// el bloqueo de movimiento (INTERACT_STATE.movementLocked, como la terminal del camino LUZ) y la sesión del navegador.
// NO cuenta como visita de la luz (Z76): las visitas solo las registra LuzLejana al abrir SU terminal (registrarVisitaLuz);
// acá no se llama y sus listeners de fin/cierre solo actúan con la luz en fase "dialogo".
// Lo maneja components/AvisoVivoHost.tsx (tick por cuadro, dentro del Canvas).

import { DBG_AVISO_VIVO, DBG_MONO_VIVO, DEBUG_ENABLED } from "@/lib/debugConfig";
import { INTERACT_STATE } from "@/lib/alightStore";
import { MONO_VIVO, aceptarTransmision } from "@/lib/monolitosVivoAcciones";
import { abrirDialogo, cerrarDialogo, DIALOGO_STATE } from "@/lib/dialogo/dialogoEstado";
import { RUTA_AVISO_VIVO } from "@/lib/dialogo/dialogoInk";
import { stopVizAudio } from "@/lib/vizAudio";
import { getAudioElement } from "@/lib/audioEngine";
import {
  crearAviso, debeAbrir, marcarAbierto, aplicarDecision, reiniciarAviso, requiereAceptacion, dentroDelRadio,
  serializarAviso, restaurarAviso, type DecisionAviso,
} from "@/lib/avisoVivo";

export const CLAVE_AVISO = "alight:aviso-vivo";
export const AVISO = crearAviso();
const _ent = { haySesion: false, dentro: false, terminalOcupada: false };
let _cargado = false;
let _final: HTMLDivElement | null = null;
let _cierre: ReturnType<typeof setTimeout> | null = null;

function almacen(): Storage | null {
  if (typeof window === "undefined") return null;
  try { return window.sessionStorage; } catch { return null; }
}
function guardar(): void { const st = almacen(); if (st) { try { st.setItem(CLAVE_AVISO, serializarAviso(AVISO)); } catch { /* memoria */ } } }
function cargar(): void {
  if (_cargado || typeof window === "undefined") return;
  _cargado = true;
  const st = almacen();
  if (st) { try { restaurarAviso(AVISO, st.getItem(CLAVE_AVISO)); } catch { /* sin almacenamiento */ } }
  if (AVISO.decision === "si") aceptarTransmision(true);
}

const liberarMovimiento = () => { INTERACT_STATE.movementLocked = INTERACT_STATE.experienceState === "sillas_secuencia"; };

/** Un cuadro (AvisoVivoHost). */
export function tickAviso(): void {
  cargar();
  _ent.haySesion = MONO_VIVO.haySesion;
  _ent.dentro = dentroDelRadio(MONO_VIVO.sonido.estado, MONO_VIVO.video.estado);
  _ent.terminalOcupada = DIALOGO_STATE.activo && DIALOGO_STATE.fuente !== RUTA_AVISO_VIVO;
  // mientras falta decidir, la mezcla remota exige aceptación (Z82)
  if (requiereAceptacion(AVISO, DBG_AVISO_VIVO, _ent.haySesion) && !DBG_MONO_VIVO.REQUIERE_ACEPTACION) DBG_MONO_VIVO.REQUIERE_ACEPTACION = true;
  if (AVISO.abierto) { INTERACT_STATE.movementLocked = true; return; }
  if (debeAbrir(AVISO, DBG_AVISO_VIVO, _ent)) mostrarAvisoAhora();
}

/** Abre la terminal con el aviso (también el botón del menú). */
export function mostrarAvisoAhora(): void {
  cargar();
  marcarAbierto(AVISO);
  guardar();
  INTERACT_STATE.movementLocked = true;
  abrirDialogo(undefined, RUTA_AVISO_VIVO);
}

function decidir(d: DecisionAviso): void {
  aplicarDecision(AVISO, d);
  guardar();
  liberarMovimiento();   // como la luz al terminar su diálogo (la terminal se cierra sola en CIERRE_MS)
  if (d === "si") aceptarTransmision(true);
  else if (d === "no") aceptarTransmision(false);
  else if (d === "salir") { aceptarTransmision(false); salir(); }
}

function salir(): void {
  try { window.close(); } catch { /* el navegador no lo permite */ }
  setTimeout(() => { if (!window.closed) pantallaFinal(); }, Math.max(0, DBG_AVISO_VIVO.ESPERA_CIERRE_MS));
}

/** Pantalla final sobria: detiene el audio y el render pesado (evento para el host del Canvas). */
export function pantallaFinal(): void {
  if (typeof document === "undefined" || _final) return;
  try { stopVizAudio(); } catch { /* ya detenido */ }
  try { getAudioElement()?.pause(); } catch { /* sin motor */ }
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch { /* ok */ }
  window.dispatchEvent(new CustomEvent("alight:detener-render"));
  const d = document.createElement("div");
  d.setAttribute("role", "status");
  d.style.cssText = "position:fixed;inset:0;z-index:10000;background:#12101A;display:flex;align-items:center;justify-content:center;"
    + "font:600 20px ui-monospace,'SF Mono',Menlo,Consolas,monospace;letter-spacing:0.12em;color:#FF9A1F;"
    + "text-shadow:0 0 6px rgba(255,154,31,0.45)";
  d.textContent = "Podés cerrar esta pestaña.";
  document.body.appendChild(d);
  _final = d;
}

/** Listeners (los instala AvisoVivoHost). Devuelve la limpieza. */
export function instalarAviso(): () => void {
  const onDecision = (e: Event) => {
    const d = (e as CustomEvent<{ decision?: DecisionAviso }>).detail?.decision;
    if (d === "si" || d === "no" || d === "salir") decidir(d);
  };
  const onFin = () => {
    if (DIALOGO_STATE.fuente !== RUTA_AVISO_VIVO) return;
    if (_cierre) clearTimeout(_cierre);
    _cierre = setTimeout(() => { _cierre = null; if (DIALOGO_STATE.fuente === RUTA_AVISO_VIVO) cerrarDialogo(); }, Math.max(0, DBG_AVISO_VIVO.CIERRE_MS));
  };
  const onCerrado = () => {
    if (!AVISO.abierto) return;                       // otra terminal (camino LUZ) o el aviso ya decidido
    aplicarDecision(AVISO, "no"); aceptarTransmision(false); guardar();   // cerrar sin elegir = "no"
    liberarMovimiento();
  };
  window.addEventListener("alight:aviso-vivo-decision", onDecision);
  window.addEventListener("alight:dialogo-fin", onFin);
  window.addEventListener("alight:dialogo-cerrado", onCerrado);
  return () => {
    window.removeEventListener("alight:aviso-vivo-decision", onDecision);
    window.removeEventListener("alight:dialogo-fin", onFin);
    window.removeEventListener("alight:dialogo-cerrado", onCerrado);
    if (_cierre) { clearTimeout(_cierre); _cierre = null; }
    if (AVISO.abierto) { AVISO.abierto = false; liberarMovimiento(); }
  };
}

/** "Reiniciar decisión" (menú): vuelve a preguntar; quita la pantalla final si estaba. */
export function reiniciarDecisionAviso(): void {
  reiniciarAviso(AVISO);
  aceptarTransmision(false);
  const st = almacen(); if (st) { try { st.removeItem(CLAVE_AVISO); } catch { /* ok */ } }
  if (_final) { _final.remove(); _final = null; window.dispatchEvent(new CustomEvent("alight:reanudar-render")); }
}

export function textoEstadoAviso(): string {
  const d = AVISO.decision;
  return `decisión: ${d === "ninguna" ? "ninguna" : d === "si" ? "sí" : d === "no" ? "no" : "salir"}${AVISO.abierto ? " · AVISO ABIERTO" : ""}${AVISO.mostrado ? " · ya se mostró en esta sesión" : ""} · ${MONO_VIVO.haySesion ? "hay sesión" : "sin sesión"} · REQUIERE_ACEPTACION ${DBG_MONO_VIVO.REQUIERE_ACEPTACION ? "sí" : "no"} · aceptada ${MONO_VIVO.aceptada ? "sí" : "no"}`;
}

if (DEBUG_ENABLED && typeof window !== "undefined") {
  (window as unknown as { __aviso?: object }).__aviso = { AVISO, DBG_AVISO_VIVO, mostrarAvisoAhora, reiniciarDecisionAviso, textoEstadoAviso, pantallaFinal };
}
