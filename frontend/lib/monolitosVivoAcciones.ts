// Z82: une la máquina de estados de los monolitos (lib/monolitosVivo.ts) con la escena, el audio de SILLAS (vizAudio),
// la sesión en vivo (lib/remoteSession.ts: SESSION, hoy el mock o la SesionPrueba local) y el menú de debug.
// Lo llama components/Monoliths.tsx en su useFrame (con DBG_MONO_VIVO.ACTIVO; si no, sigue N5 como estaba).
// Reloj: dt de la experiencia (RELOJ.dtExp: 0 en la pausa central → los contadores quedan quietos).
// Monolito de SONIDO = derecho (posR) → mezcla del audio; monolito de VIDEO = izquierdo (posL) → solo estado y evento
// (N5_STATE.leftProximity sigue alimentando la interferencia del DomeVisualizer viejo, como en N5).
// Evento window "alight:mono-estado" { monolito: "sonido" | "video", estado, peso, haySesion } solo al cambiar el estado
// (o la sesión). Ganchos para tareas futuras: MONO_VIVO.sonido / .video (alejandoseTrasCerca, peso, estado) y
// MONO_VIVO.haySesion; aceptarTransmision() para DBG_MONO_VIVO.REQUIERE_ACEPTACION.

import { DBG_MONO_VIVO, DEBUG_ENABLED, DBG_SILLAS, DBG_PASTO } from "@/lib/debugConfig";
import { RELOJ as RELOJ_EXP } from "@/lib/relojExperiencia";
import { SESSION, setSession, MockRemoteSession } from "@/lib/remoteSession";
import { SesionPrueba } from "@/lib/sesionPrueba";
import { N5_STATE, contextoViz, setMezclaRemota, leerMezclaRemota } from "@/lib/vizAudio";
import { crearMono, reiniciarMono, tickPar, mezclaEqualPower, pesoEfectivo, type Mono } from "@/lib/monolitosVivo";

export const MONO_VIVO = {
  sonido: crearMono() as Mono,
  video: crearMono() as Mono,
  haySesion: false,
  aceptada: false,
  pesoRemotoSonido: 0,     // peso efectivo (con la aceptación aplicada)
  forzar: "" as "" | "sonido" | "video",
};
const _mez = { orig: 1, rem: 0 };
const _ultimo = { sonido: "", video: "", sesion: false };
let _ov: HTMLDivElement | null = null, _ovT = 0;

function emitir(monolito: "sonido" | "video", m: Mono): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("alight:mono-estado", { detail: { monolito, estado: m.estado, peso: m.peso, haySesion: MONO_VIVO.haySesion } }));
}

/**
 * Un cuadro: distancias de la cámara a cada monolito (m), opacidad de los monolitos (0…1, como N5) y si están activos.
 * Escribe la mezcla en vizAudio y N5_STATE. dtFrame = dt real del cuadro (para el overlay).
 */
export function tickMonolitosVivo(dSonido: number, dVideo: number, op: number, dtFrame: number): void {
  const M = MONO_VIVO;
  _activo = true;
  const dt = RELOJ_EXP.dtExp;   // 0 en pausa
  // forzar cerca (debug): un cuadro a distancia 0
  if (M.forzar === "sonido") dSonido = 0;
  else if (M.forzar === "video") dVideo = 0;
  M.forzar = "";
  M.haySesion = SESSION.status === "active";
  tickPar(M.sonido, M.video, dSonido, dVideo, dt, DBG_MONO_VIVO);

  // mezcla de audio (monolito de sonido), escalada por la opacidad de los monolitos como en N5
  const peso = pesoEfectivo(M.sonido.peso, M.haySesion, DBG_MONO_VIVO.REQUIERE_ACEPTACION, M.aceptada) * Math.max(0, Math.min(1, op));
  M.pesoRemotoSonido = peso;
  mezclaEqualPower(peso, _mez);
  const ctx = contextoViz();
  const nodo = M.haySesion && ctx ? SESSION.getAudio(ctx) : null;
  setMezclaRemota(_mez.orig, _mez.rem, nodo, M.haySesion ? DBG_MONO_VIVO.SESION_GANANCIA : DBG_MONO_VIVO.RUIDO_GANANCIA,
    DBG_MONO_VIVO.RUIDO_TIPO === "rosa" ? "rosa" : "blanco");
  N5_STATE.rightProximity = peso;
  N5_STATE.leftProximity = M.video.peso * Math.max(0, Math.min(1, op));

  // eventos solo al cambiar
  const cambioSesion = M.haySesion !== _ultimo.sesion;
  if (M.sonido.estado !== _ultimo.sonido || cambioSesion) { _ultimo.sonido = M.sonido.estado; emitir("sonido", M.sonido); }
  if (M.video.estado !== _ultimo.video || cambioSesion) { _ultimo.video = M.video.estado; emitir("video", M.video); }
  _ultimo.sesion = M.haySesion;

  actualizarOverlay(dtFrame);
}

function linea(n: string, m: Mono): string {
  return `${n}: ${m.estado} · peso ${m.peso.toFixed(2)}${m.estado === "sosteniendo" ? ` · ${Math.max(0, m.sostenRestanteS).toFixed(1)} s${m.congelado ? " (congelado: va al otro)" : ""}` : ""}${m.alejandoAmbosS > 0 ? ` · alejándose ${m.alejandoAmbosS.toFixed(2)} s` : ""}${m.alejandoseTrasCerca ? " · ALEJÁNDOSE TRAS CERCA" : ""}`;
}
/** Línea de estado (menú y overlay). */
export function textoEstadoMonolitos(): string {
  const M = MONO_VIVO;
  return `${M.haySesion ? "SESIÓN EN VIVO" : "sin sesión (estática)"}${DBG_MONO_VIVO.REQUIERE_ACEPTACION ? (M.aceptada ? " · aceptada" : " · sin aceptar") : ""} · ${linea("sonido", M.sonido)} · ${linea("video", M.video)} · mezcla remota ${M.pesoRemotoSonido.toFixed(2)}`;
}
function actualizarOverlay(dt: number): void {
  if (typeof document === "undefined") return;
  if (!DBG_MONO_VIVO.OVERLAY) { if (_ov) { _ov.remove(); _ov = null; } return; }
  if (!_ov) {
    _ov = document.createElement("div");
    _ov.setAttribute("data-debug-panel", "");
    _ov.style.cssText = "position:fixed;left:12px;bottom:64px;z-index:60;max-width:60vw;font:12px monospace;color:#FF9A1F;background:#2A1400cc;padding:4px 8px;pointer-events:none;white-space:pre-line";
    document.body.appendChild(_ov); _ovT = 1;
  }
  if ((_ovT += dt) < 0.25) return;
  _ovT = 0;
  _ov.textContent = "MONOLITOS Z82\n" + textoEstadoMonolitos().split(" · sonido").join("\nsonido").split(" · video").join("\nvideo");
}

// ── botones del menú ──
export function simularSesionEnVivo(): void { setSession(new SesionPrueba()); }
export function quitarSesion(): void { setSession(new MockRemoteSession()); }
export function forzarCerca(m: "sonido" | "video"): void { MONO_VIVO.forzar = m; }
export function reiniciarMonolitosVivo(): void {
  reiniciarMono(MONO_VIVO.sonido); reiniciarMono(MONO_VIVO.video);
  _ultimo.sonido = ""; _ultimo.video = "";
}
/** Para REQUIERE_ACEPTACION: lo llamará el aviso al espectador (otra tarea). */
export function aceptarTransmision(v = true): void { MONO_VIVO.aceptada = v; }

let _activo = false;
/** Modo N5 (DBG_MONO_VIVO.ACTIVO = false): si este modo estaba activo, suelta la mezcla remota una vez. */
export function modoN5(): void { if (_activo) { _activo = false; soltarMonolitosVivo(); } }

/** Al desmontar los monolitos o volver a N5: audio propio entero y overlay fuera. */
export function soltarMonolitosVivo(): void {
  setMezclaRemota(1, 0, null, 0);
  if (_ov) { _ov.remove(); _ov = null; }
}

if (DEBUG_ENABLED && typeof window !== "undefined") {
  (window as unknown as { __monoVivo?: object }).__monoVivo = { MONO_VIVO, DBG_MONO_VIVO, simularSesionEnVivo, quitarSesion, forzarCerca, reiniciarMonolitosVivo, aceptarTransmision, textoEstadoMonolitos, leerMezclaRemota, DBG_SILLAS, DBG_PASTO };
}
