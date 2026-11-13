// Z40: acciones concretas de los checkpoints (lib/checkpoints.ts tiene el registro y el ejecutor).
// Las instala CheckpointsHost. Reutilizan los flujos existentes: zonas del Player (chose-chairs /
// chose-light), atajo del telón (debug-skip-curtain), activateVisualizerOnce, dawn-skip, el efecto de
// tarima vacía (Z29) y el reloj de la experiencia (Z39) adelantado para que la secuencia SILLAS real
// ocurra en pocos frames y emita cada evento UNA vez.
//
// BASE LIMPIA (limpiezaBase) — estado de módulo; lo de cada componente lo limpia el remontaje de <Scene/>:
//  terminal cerrada · alarma detenida y luces al 100 % · efectos (sinPublico, bloqueo de zona) · pausa Z28
//  liberada · esperas del reloj, tope y mínimo de dome-revealed · amanecer único y los dos viejos · música del
//  visualizador detenida · audio de los atriles en pausa · bloqueos de movimiento, modo e interacción ·
//  paneles SILLAS · visualizador (flag) · haces · uniforms del prisma · linterna y foco · estado del camino LUZ ·
//  FOV y luz global de los atriles.

import * as THREE from "three";
import type { Accion } from "@/lib/checkpoints";
import { DBG_SECUENCIA, DBG_CHECKPOINTS, DBG_LAYOUT, DBG_DIA } from "@/lib/debugConfig";
import { DIA, posicionarDia } from "@/lib/cicloDia"; // Z48
import { aplicarSpawn, EJE_TELON } from "@/lib/inicioEscena";
import { cerrarDialogo, DIALOGO_STATE } from "@/lib/dialogo/dialogoEstado";
import { EFECTOS_STATE, guardarPremio } from "@/lib/dialogo/efectosEstado";
import { irTarimaSinPublicoAhora } from "@/lib/dialogo/efectosDialogo";
import { reanudarExperiencia } from "@/lib/pausaExperiencia";
import { limpiarEsperas, adelantarReloj, RELOJ } from "@/lib/relojExperiencia";
import { SECUENCIA, cancelarSecuencia } from "@/lib/secuenciaSillas";
import { resetAmanecer, skipAmanecer, AMANECER } from "@/lib/amanecer";
import {
  INTERACT_STATE, PANELES_SILLAS, STORE, resetPanelesSillas, resetVizActivated, activateVisualizerOnce,
  resetDawn, resetDomeDawnState,
} from "@/lib/alightStore";
import { resetHaz } from "@/lib/haz";
import { stopVizAudio, prepareVizAudio, duracionTemaViz, idTemaViz } from "@/lib/vizAudio";
import { togglePlayPause } from "@/lib/audioEngine";
import { resetLinterna } from "@/lib/linternaPaneles";
import { resetFoco } from "@/lib/focoSubpanel";
import { LUZ_STATE, actualizarPosLuz } from "@/lib/caminoLuz";
import { PRISM_POS_UNIFORM, PRISM_RAINBOW_UNIFORM, PRISM_ROT_UNIFORM } from "@/lib/prismUniforms";
import { ZONA_TARIMA, zonaSillasEn, centroSillasEn } from "@/lib/layoutSala"; // Z41

/** Montajes del anfitrión (CheckpointsHost): el paso "remontar" espera uno nuevo. */
export const HOST = { montajes: 0, frames: 0 };

let _camara: THREE.Camera | null = null;
export function setCamaraCheckpoints(c: THREE.Camera): void { _camara = c; }

// ── espera de un evento (uno a la vez; la base lo suelta) ──
const _esperado = { nombre: "", visto: false };
const _alVer = () => { _esperado.visto = true; };
function escuchar(nombre: string): void {
  soltarEscucha();
  _esperado.nombre = nombre;
  _esperado.visto = false;
  window.addEventListener(nombre, _alVer);
}
function soltarEscucha(): void {
  if (_esperado.nombre) window.removeEventListener(_esperado.nombre, _alVer);
  _esperado.nombre = "";
  _esperado.visto = false;
}

function colocar(x: number, z: number, mirarX: number, mirarZ: number): void {
  const c = _camara;
  if (!c) return;
  c.position.set(x, 1.6, z);
  c.lookAt(mirarX, 1.6, mirarZ);
}

const atrilSonando = (): boolean => !STORE.audio.paused;

function limpiezaBase(): void {
  soltarEscucha();
  cerrarDialogo();
  // efectos (Z29): alarma fuera y luces al 100 % ya (sin fundido)
  window.dispatchEvent(new CustomEvent("alight:debug-detener-alarma"));
  EFECTOS_STATE.alarmaActiva = false;
  EFECTOS_STATE.bloqueaZonaTarima = false;
  EFECTOS_STATE.sinPublico = false;
  EFECTOS_STATE.luces = 1;
  reanudarExperiencia();                          // pausa Z28 (reanuda audio solo si la pausa lo había pausado)
  // reloj de la experiencia (Z39): ninguna espera colgada
  limpiarEsperas();
  cancelarSecuencia();
  SECUENCIA.activadoExpMs = -1;
  SECUENCIA.domeRevealedEmitido = false;
  SECUENCIA.motivo = "";
  // amanecer (Z38) y las dos máquinas viejas
  resetAmanecer(); resetDawn(); resetDomeDawnState();
  // audio
  stopVizAudio();
  if (atrilSonando()) togglePlayPause();          // no-op si el motor de los atriles no arrancó
  // movimiento, interacción y estado de la experiencia
  INTERACT_STATE.movementLocked = false;
  INTERACT_STATE.panelBloqueo = false;
  INTERACT_STATE.mode = "none";
  INTERACT_STATE.camAnimActive = false;
  INTERACT_STATE.experienceState = "cortina";
  // SILLAS
  resetPanelesSillas();
  PANELES_SILLAS.forzado = false;
  PANELES_SILLAS.fase = "oculto";
  PANELES_SILLAS.alpha = 0;
  resetVizActivated();
  resetHaz();
  // uniforms de módulo del prisma: Prism no los actualiza hasta volver a activarse (arcoíris en el domo)
  PRISM_RAINBOW_UNIFORM.value = 0;
  PRISM_POS_UNIFORM.value.set(0, 22, 0);
  PRISM_ROT_UNIFORM.value = 0;
  resetLinterna();
  resetFoco();
  // camino LUZ
  LUZ_STATE.fase = "libre";
  LUZ_STATE.fuera = false;
  // atriles (TARIMA): FOV e intensidad global a sus valores de arranque
  STORE.cam.fov = 90;
  STORE.lights.globalIntensity = 1.0;
}

// Z41: zonas desde lib/layoutSala.ts (siguen a DBG_LAYOUT), salidas reutilizadas
const _zona = { x: 0, z: 0 };
const _sillas = { x: 0, z: 0 };
/** En el centro de ZONA_SILLAS mirando a la tarima (la zona del Player dispara chose-chairs). */
function irAZonaSillas(): void { zonaSillasEn(DBG_LAYOUT, _zona); colocar(_zona.x, _zona.z, ZONA_TARIMA.x, ZONA_TARIMA.z); }
/** Sobre la tarima (ZONA_LUZ) mirando a las sillas. */
function irAZonaTarima(): void { centroSillasEn(DBG_LAYOUT, _sillas); colocar(ZONA_TARIMA.x, ZONA_TARIMA.z, _sillas.x, _sillas.z); }

let _montajesAntes = 0;
let _amanecerEmitido = false;

export const ACCIONES_CHECKPOINT: Record<string, Accion> = {
  base: () => { limpiezaBase(); return true; },

  // remonta <Scene/> (ThreeScene escucha el evento) y espera que el anfitrión nuevo lleve 3 frames montado
  remontar: (_p, ctx) => {
    if (ctx.primera) {
      _montajesAntes = HOST.montajes;
      RELOJ.congelado = true;   // la escena vieja no avanza bajada, revelado ni esperas hasta desmontarse
      window.dispatchEvent(new CustomEvent("alight:checkpoint-remontar"));
    }
    const listo = HOST.montajes > _montajesAntes && HOST.frames >= 3;
    if (listo) RELOJ.congelado = false;
    return listo;
  },

  esperarFrames: (p, ctx) => ctx.frames >= Number(p[1] ?? 1),

  spawn: () => { if (_camara) aplicarSpawn(_camara); return _camara !== null; },

  // mismo atajo que el botón del telón: exploración, telón oculto, sin destello
  cruzarTelon: () => { window.dispatchEvent(new CustomEvent("alight:debug-skip-curtain")); return true; },

  // la zona ZONA_SILLAS del Player dispara chose-chairs + activar-prisma (flujo real)
  irASillas: () => { irAZonaSillas(); return true; },
  // la zona ZONA_LUZ del Player dispara chose-light
  irATarima: () => { irAZonaTarima(); return true; },

  esperarEvento: (p, ctx) => {
    const nombre = String(p[1]);
    if (ctx.primera && _esperado.nombre !== nombre) escuchar(nombre);
    return _esperado.visto;
  },

  // adelanta el reloj de la experiencia hasta el evento: la bajada, el revelado, dome-revealed y la espera de
  // liberación reales ocurren en pocos frames. Con RELOJ_UNIFICADO=false solo espera (tiempos reales).
  adelantarHasta: (p, ctx) => {
    const nombre = String(p[1]);
    if (ctx.primera) escuchar(nombre);
    if (_esperado.visto) { soltarEscucha(); return true; }
    if (DBG_SECUENCIA.RELOJ_UNIFICADO) adelantarReloj(Math.max(0.05, DBG_CHECKPOINTS.ADELANTO_S));
    return false;
  },

  // mismo camino que tocar el prisma en sala_activa (ThreeScene): prepara el audio y activa una vez
  visualizador: () => { void prepareVizAudio(); activateVisualizerOnce(); return true; },

  // el par único de Z38 (lo escuchan VizPanorama y DomeVisualizer) + la máquina única; fase 2 completa.
  // dawn-complete se emite una vez para que los monolitos capturen el reflejo, como en un amanecer real.
  amanecerFinal: (_p, ctx) => {
    if (ctx.primera) { _amanecerEmitido = false; window.dispatchEvent(new CustomEvent("alight:dawn-skip")); skipAmanecer(); return false; }
    if (!_amanecerEmitido && AMANECER.fase === "completo") {
      _amanecerEmitido = true;
      window.dispatchEvent(new CustomEvent("alight:dawn-complete"));
      window.dispatchEvent(new CustomEvent("alight:dome-dawn-complete"));
    }
    return true;
  },

  // Z48: ubica el ciclo de día en tDia = p[1] (introducción terminada). Sin el ciclo nuevo no hace nada.
  diaEn: (p) => {
    if (DBG_DIA.NUEVO) posicionarDia(DIA, DBG_DIA, Number(p[1]), AMANECER, duracionTemaViz(), idTemaViz());
    return true;
  },

  // efecto ir_tarima_sin_publico de Z29, tal cual
  tarimaVacia: () => irTarimaSinPublicoAhora(),

  // a 1 m de la luz, del lado del spawn, mirándola: LuzLejana dispara giro + diálogo (n_1)
  irALuz: () => {
    if (!_camara) return false;
    actualizarPosLuz();
    const x = LUZ_STATE.x + EJE_TELON.fx * 1.0, z = LUZ_STATE.z + EJE_TELON.fz * 1.0;
    _camara.position.set(x, 1.6, z);
    _camara.lookAt(LUZ_STATE.x, 1.6, LUZ_STATE.z);
    return true;
  },
  esperarDialogo: () => DIALOGO_STATE.activo,

  // estado final de juego_alarma (Z29): premio guardado, luces encendidas, sobre la tarima con la zona
  // TARIMA bloqueada hasta alejarse (como después del premio)
  premio: () => {
    guardarPremio();
    EFECTOS_STATE.bloqueaZonaTarima = true;
    irAZonaTarima();
    window.dispatchEvent(new CustomEvent("alight:premio-otorgado"));
    return true;
  },
};
