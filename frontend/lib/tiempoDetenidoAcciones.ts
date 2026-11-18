// Z84: une la envolvente del tiempo detenido (lib/tiempoDetenido.ts) con los monolitos de Z82 (MONO_VIVO), el mp3 propio
// del visualizador (vizAudio.setTasaTiempo) y el pase final (TIEMPO_VISUAL → uTiempoK). Lo llama RetroPostFX en su
// useFrame (siempre montado), con el reloj de la experiencia: en la pausa central todo queda quieto.

import { DBG_TIEMPO, DEBUG_ENABLED, DBG_RENDIMIENTO } from "@/lib/debugConfig";
import { RELOJ as RELOJ_EXP } from "@/lib/relojExperiencia";
import { MONO_VIVO } from "@/lib/monolitosVivoAcciones";
import { setTasaTiempo, tasaTiempoActual } from "@/lib/vizAudio";
import { TIEMPO_VISUAL, TIEMPO_UNIFORMS } from "@/lib/retro/tiempoDetenido";
import { HIST_PLAN, HISTORIAL } from "@/lib/retro/historialTiempo";   // Z86
import { crearAnillo, vaciarAnillo, tickCaptura, tickArmado, crearArmado, tamAnillo, decaimientoEstela } from "@/lib/tiempoHistorial";   // Z86
import { crearTiempo, tickTiempo, dispararManual, pararTiempo, tasaAudio, kVisual } from "@/lib/tiempoDetenido";

export const TIEMPO = crearTiempo();

// Z86: historial del slit-scan (anillo y armado; la GPU la maneja lib/retro/historialTiempo.ts desde el pase final)
export const ANILLO = crearAnillo(2);
export const ARMADO = crearArmado();
let _vaciado = -1, _tinte = "";

export function tickTiempoDetenido(): void {
  const dt = RELOJ_EXP.dtExp;
  tickTiempo(TIEMPO, MONO_VIVO.sonido, MONO_VIVO.video, MONO_VIVO.haySesion, dt, DBG_TIEMPO);
  setTasaTiempo(tasaAudio(TIEMPO.kSuave, DBG_TIEMPO));
  const benchOn = DBG_RENDIMIENTO.SIS.tiempoDetenido !== false;
  TIEMPO_VISUAL.k = benchOn ? kVisual(TIEMPO.kSuave, DBG_TIEMPO) : 0;
  TIEMPO_VISUAL.t += dt;
  const slit = DBG_TIEMPO.ESTILO !== "provisorio";
  TIEMPO_VISUAL.slit = slit ? 1 : 0;

  // ── Z86: armado (pre-roll al entrar al radio de un monolito sin sesión, o con k > 0) ──
  const cerca = MONO_VIVO.sonido.peso > 0 || MONO_VIVO.video.peso > 0;
  tickArmado(ARMADO, cerca, MONO_VIVO.haySesion, TIEMPO.k, dt, DBG_TIEMPO);
  const armado = slit && benchOn && DBG_TIEMPO.ACTIVO && ARMADO.armado;
  if (!armado) {
    if (HIST_PLAN.armado) { HIST_PLAN.armado = false; vaciarAnillo(ANILLO); if (DBG_TIEMPO.LIBERAR_AL_DESARMAR) HIST_PLAN.liberar = true; }
    return;
  }
  HIST_PLAN.armado = true;
  const n = tamAnillo(DBG_TIEMPO);
  if (n !== ANILLO.n) { ANILLO.n = n; vaciarAnillo(ANILLO); }
  if (HIST_PLAN.vaciado !== _vaciado) { _vaciado = HIST_PLAN.vaciado; vaciarAnillo(ANILLO); }
  HIST_PLAN.n = n; HIST_PLAN.escala = DBG_TIEMPO.HIST_ESCALA; HIST_PLAN.maxAncho = DBG_TIEMPO.HIST_MAX_ANCHO;
  const capa = tickCaptura(ANILLO, dt, DBG_TIEMPO.HIST_HZ);
  if (capa >= 0) HIST_PLAN.capa = capa;
  HIST_PLAN.nueva = Math.max(0, ANILLO.nueva); HIST_PLAN.disponibles = ANILLO.disponibles; HIST_PLAN.edad = ANILLO.edad;
  HIST_PLAN.estela = DBG_TIEMPO.ESTELA && dt > 0;          // en pausa la estela queda congelada
  HIST_PLAN.decaimiento = decaimientoEstela(dt, DBG_TIEMPO.PERSISTENCIA_S);
  HIST_PLAN.umbral = DBG_TIEMPO.ESTELA_UMBRAL;

  // uniforms de cada efecto (los mismos objetos que usa el pase final); sin allocations
  const U = TIEMPO_UNIFORMS;
  const r = U.uRetro.value as number[];
  r[0] = DBG_TIEMPO.RETRASO ? DBG_TIEMPO.RETRASO_MAX_S : 0; r[1] = DBG_TIEMPO.DIRECCION === "arriba_mas_viejo" ? 1 : 0;
  r[2] = DBG_TIEMPO.CURVA === "suave" ? 1 : 0; r[3] = DBG_TIEMPO.EXPONENTE;
  const o = U.uOnda.value as number[];
  o[0] = DBG_TIEMPO.ONDA_AMP; o[1] = DBG_TIEMPO.ONDA_VEL; o[2] = DBG_TIEMPO.HIST_HZ; o[3] = DBG_TIEMPO.DESFASE ? DBG_TIEMPO.DESFASE_RGB_S : 0;
  const b = U.uBanda.value as number[];
  b[0] = DBG_TIEMPO.BANDA ? DBG_TIEMPO.BANDA_ALTO : 0; b[1] = DBG_TIEMPO.BANDA_VEL; b[2] = DBG_TIEMPO.BANDA_SALTO_S; b[3] = DBG_TIEMPO.BANDA_TEMBLOR;
  const e = U.uEstela.value as number[];
  if (_tinte !== DBG_TIEMPO.ESTELA_TINTE) {
    _tinte = DBG_TIEMPO.ESTELA_TINTE;
    const h = parseInt(_tinte.replace("#", ""), 16) || 0xffffff;
    e[0] = ((h >> 16) & 255) / 255; e[1] = ((h >> 8) & 255) / 255; e[2] = (h & 255) / 255;
  }
  e[3] = DBG_TIEMPO.ESTELA ? DBG_TIEMPO.ESTELA_MEZCLA : 0;
  U.uEstelaTinte.value = DBG_TIEMPO.ESTELA_TINTE_MEZCLA;
}

/** MB reservados por el historial y la estela (menú). */
export function mbHistorial(): number { return HISTORIAL.mb(); }

export function dispararTiempoAhora(): void { dispararManual(TIEMPO); }
export function pararTiempoAhora(): void { pararTiempo(TIEMPO); }

export function textoEstadoTiempo(): string {
  return `k ${TIEMPO.k.toFixed(2)} (aplicado ${TIEMPO.kSuave.toFixed(2)}) · ${MONO_VIVO.haySesion ? "con sesión (no se dispara)" : "sin sesión"} · ${TIEMPO.fuente ? `disparó: ${TIEMPO.fuente}` : "en reposo"}${TIEMPO.corte ? " · cortando" : ""} · velocidad del mp3 ${tasaTiempoActual().toFixed(2)} · disparos ${TIEMPO.disparos}`
    + ` · ${DBG_TIEMPO.ESTILO} · ${HIST_PLAN.armado ? `ARMADO (historial ${ANILLO.disponibles}/${ANILLO.n} a ${DBG_TIEMPO.HIST_HZ} Hz, ${HISTORIAL.w}×${HISTORIAL.h}, ${HISTORIAL.mb().toFixed(1)} MB)` : `desarmado${HISTORIAL.mb() > 0 ? ` (${HISTORIAL.mb().toFixed(1)} MB reservados)` : ""}`}`;
}

if (DEBUG_ENABLED && typeof window !== "undefined") {
  (window as unknown as { __tiempo?: object }).__tiempo = { TIEMPO, TIEMPO_VISUAL, DBG_TIEMPO, dispararTiempoAhora, pararTiempoAhora, textoEstadoTiempo, ANILLO, ARMADO, HIST_PLAN, HISTORIAL, DBG_RENDIMIENTO };
}
