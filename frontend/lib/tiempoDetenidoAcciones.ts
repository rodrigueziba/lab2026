// Z84: une la envolvente del tiempo detenido (lib/tiempoDetenido.ts) con los monolitos de Z82 (MONO_VIVO), el mp3 propio
// del visualizador (vizAudio.setTasaTiempo) y el pase final (TIEMPO_VISUAL → uTiempoK). Lo llama RetroPostFX en su
// useFrame (siempre montado), con el reloj de la experiencia: en la pausa central todo queda quieto.

import { DBG_TIEMPO, DEBUG_ENABLED } from "@/lib/debugConfig";
import { RELOJ as RELOJ_EXP } from "@/lib/relojExperiencia";
import { MONO_VIVO } from "@/lib/monolitosVivoAcciones";
import { setTasaTiempo, tasaTiempoActual } from "@/lib/vizAudio";
import { TIEMPO_VISUAL } from "@/lib/retro/tiempoDetenido";
import { crearTiempo, tickTiempo, dispararManual, pararTiempo, tasaAudio, kVisual } from "@/lib/tiempoDetenido";

export const TIEMPO = crearTiempo();

export function tickTiempoDetenido(): void {
  const dt = RELOJ_EXP.dtExp;
  tickTiempo(TIEMPO, MONO_VIVO.sonido, MONO_VIVO.video, MONO_VIVO.haySesion, dt, DBG_TIEMPO);
  setTasaTiempo(tasaAudio(TIEMPO.kSuave, DBG_TIEMPO));
  TIEMPO_VISUAL.k = kVisual(TIEMPO.kSuave, DBG_TIEMPO);
  TIEMPO_VISUAL.t += dt;
}

export function dispararTiempoAhora(): void { dispararManual(TIEMPO); }
export function pararTiempoAhora(): void { pararTiempo(TIEMPO); }

export function textoEstadoTiempo(): string {
  return `k ${TIEMPO.k.toFixed(2)} (aplicado ${TIEMPO.kSuave.toFixed(2)}) · ${MONO_VIVO.haySesion ? "con sesión (no se dispara)" : "sin sesión"} · ${TIEMPO.fuente ? `disparó: ${TIEMPO.fuente}` : "en reposo"}${TIEMPO.corte ? " · cortando" : ""} · velocidad del mp3 ${tasaTiempoActual().toFixed(2)} · disparos ${TIEMPO.disparos}`;
}

if (DEBUG_ENABLED && typeof window !== "undefined") {
  (window as unknown as { __tiempo?: object }).__tiempo = { TIEMPO, TIEMPO_VISUAL, DBG_TIEMPO, dispararTiempoAhora, pararTiempoAhora, textoEstadoTiempo };
}
