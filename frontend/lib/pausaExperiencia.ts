// Z28: pausa y reanudación CENTRAL de la experiencia en curso cuando el usuario sale del área
// (camino LUZ) y vuelve. Se dispara por evento:
//   'alight:salir-del-area'  → pausar   ·   'alight:volver-al-area' → reanudar
// Única fuente de verdad: PAUSA.activa. Quien quiera pausar algo propio lee PAUSA.activa o escucha
// los mismos eventos; no se duplica estado.
//
// Qué pausa:
//  - Música del visualizador (vizAudio): pausa el elemento y suspende el AudioContext.
//  - Audio de los atriles (audioEngine): con su propio togglePlayPause (STORE.audio.paused),
//    solo si estaba sonando; al volver se reanuda solo si lo pausó esta pausa.
//  - Amaneceres U9 (HazSystem/VizPanorama) y W3 (domo): congelados con congelarAmaneceres(dt).
// Qué sigue corriendo (sin estado narrativo, costo bajo): animaciones en bucle de shaders (uTime),
// órbitas de paneles, giro del prisma, público, cámara web, tela del telón.

import { pausarVizAudio, reanudarVizAudio } from "@/lib/vizAudio";
import { togglePlayPause } from "@/lib/audioEngine";
import { STORE, congelarAmaneceres } from "@/lib/alightStore";

export const PAUSA = {
  activa: false,
  desdeMs: 0,               // performance.now() del inicio de la pausa actual
  audioAtrilPausado: false, // esta pausa detuvo el audio de los atriles
};

const atrilPausado = (): boolean => STORE.audio.paused;

export function pausarExperiencia(): void {
  if (PAUSA.activa) return;
  PAUSA.activa = true;
  PAUSA.desdeMs = performance.now();
  pausarVizAudio();
  PAUSA.audioAtrilPausado = false;
  if (!atrilPausado()) {
    // togglePlayPause no hace nada si el motor no se inicializó: solo cuenta si cambió el estado
    togglePlayPause();
    PAUSA.audioAtrilPausado = atrilPausado();
  }
}

export function reanudarExperiencia(): void {
  if (!PAUSA.activa) return;
  PAUSA.activa = false;
  reanudarVizAudio();
  if (PAUSA.audioAtrilPausado && atrilPausado()) togglePlayPause();
  PAUSA.audioAtrilPausado = false;
}

/** Llamar una vez por frame (dt en segundos de clock). */
export function tickPausa(dt: number): void {
  if (PAUSA.activa) congelarAmaneceres(dt);
}

/** Instala los listeners de los eventos de área. Devuelve la limpieza (reanuda si quedó en pausa). */
export function instalarPausa(): () => void {
  const onSalir = () => pausarExperiencia();
  const onVolver = () => reanudarExperiencia();
  window.addEventListener("alight:salir-del-area", onSalir);
  window.addEventListener("alight:volver-al-area", onVolver);
  return () => {
    window.removeEventListener("alight:salir-del-area", onSalir);
    window.removeEventListener("alight:volver-al-area", onVolver);
    reanudarExperiencia();
  };
}
