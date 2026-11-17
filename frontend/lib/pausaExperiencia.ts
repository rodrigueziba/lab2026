// Z28: pausa y reanudación CENTRAL de la experiencia en curso cuando el usuario sale del área
// (camino LUZ) y vuelve. Se dispara por evento:
//   'alight:salir-del-area'  → pausar   ·   'alight:volver-al-area' → reanudar
// Única fuente de verdad: PAUSA.activa. Quien quiera pausar algo propio lee PAUSA.activa o escucha
// los mismos eventos; no se duplica estado.
//
// Qué pausa:
//  - Música del visualizador (vizAudio): pausa el elemento y suspende el AudioContext.
//  - Z78: reloj de los instrumentos (lib/audio/nucleo.ts): pausarNucleo/reanudarNucleo (el contexto no se suspende).
//  - Audio de los atriles (audioEngine): con su propio togglePlayPause (STORE.audio.paused),
//    solo si estaba sonando; al volver se reanuda solo si lo pausó esta pausa.
//  - Amaneceres U9 (HazSystem/VizPanorama) y W3 (domo): congelados con congelarAmaneceres(dt) en el modo
//    viejo (DBG_AMANECER.UNIFICADO=false). Z38: la máquina única (lib/amanecer.ts) no avanza con PAUSA.activa.
//  - Z39: reloj de la experiencia (lib/relojExperiencia.ts, DBG_SECUENCIA.RELOJ_UNIFICADO): no avanza con
//    PAUSA.activa, así que quedan congelados la bajada del prisma, el revelado escalonado de los paneles, la
//    espera de liberación (releaseDelayMs), el mínimo y el tope de dome-revealed, los fundidos de los paneles
//    y la linterna (con su acercamiento), y la translucidez del prisma por cercanía.
// Qué sigue corriendo (sin estado narrativo, costo bajo): animaciones en bucle de shaders (uTime),
// órbitas de paneles, giro del prisma, público, cámara web, tela del telón, envolventes de audio del
// visualizador (dt), y con RELOJ_UNIFICADO=false los relojes viejos de Z37 (clock, setTimeout, Date.now).

import { pausarVizAudio, reanudarVizAudio } from "@/lib/vizAudio";
import { togglePlayPause } from "@/lib/audioEngine";
import { STORE, congelarAmaneceres } from "@/lib/alightStore";
import { pausarNucleo, reanudarNucleo } from "@/lib/audio/nucleo";   // Z78: el reloj de los instrumentos se pausa

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
  pausarNucleo();   // Z78
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
  reanudarNucleo();   // Z78
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
