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
import { PASTO, reiniciarPasto } from "@/lib/pasto"; // Z64
import { stopVizAudio, prepareVizAudio, duracionTemaViz, idTemaViz } from "@/lib/vizAudio";
import { togglePlayPause } from "@/lib/audioEngine";
import { resetLinterna } from "@/lib/linternaPaneles";
import { resetFoco } from "@/lib/focoSubpanel";
import { LUZ_STATE, actualizarPosLuz } from "@/lib/caminoLuz";
import { consumirHuidaVisita } from "@/lib/luzMovimiento"; // Z76
import { PRISM_POS_UNIFORM, PRISM_RAINBOW_UNIFORM, PRISM_ROT_UNIFORM } from "@/lib/prismUniforms";
import { ZONA_TARIMA, zonaSillasEn, centroSillasEn, monolitoEn } from "@/lib/layoutSala"; // Z41
// Z95: checkpoints de la transmisión en vivo
import { DBG_SILLAS } from "@/lib/debugConfig";
import { posicionRecibir } from "@/lib/checkpoints";
import { completarCuarto } from "@/lib/pasto";
import { MONO_PASTO } from "@/lib/monolitosPasto";
import { reiniciarDecisionAviso } from "@/lib/avisoVivoAcciones";
import { reiniciarMonolitosVivo } from "@/lib/monolitosVivoAcciones";
import { mostrarEleccionAhora, atajoSinCompartir } from "@/lib/consentTarimaAcciones";
import { LECTERN_OUTWARD_OFFSET_M } from "@/lib/debugConfig";
import { ATRIL_X_BASE, poseFrenteAtril } from "@/lib/atrilSonido";   // Z96
import { poseFrenteAtrilImagen } from "@/lib/atrilImagen";            // Z97
import { restaurarLucesEscena } from "@/lib/lucesEscenaAcciones";    // Z97b
import { poseFrenteAtrilBajo } from "@/lib/atrilBajo";               // Z99
import { poseAtrilBajo, poseInstrumento } from "@/lib/instrumentosPose";   // Z99b: posición única (arco / línea)
import { poseAtrilSinte } from "@/lib/instrumentosPose";                    // Z101: SY-40 (poseInstrumento(−1))
import { poseFrenteAtrilSinte } from "@/lib/atrilSinte";                     // Z101
import { poseAtrilSampler } from "@/lib/instrumentosPose";                  // Z103: SM-40 (poseInstrumento(2))
import { poseFrenteAtrilSampler } from "@/lib/atrilSampler";                 // Z103
import { detenerPresencia } from "@/lib/vivo/vivoAcciones";
import { detenerLiveKit } from "@/lib/vivo/publicarLiveKit";

/** Montajes del anfitrión (CheckpointsHost): el paso "remontar" espera uno nuevo. */
export const HOST = { montajes: 0, frames: 0 };

let _camara: THREE.Camera | null = null;
const _poseBajo = { x: 0, z: 0, yaw: 0 };   // Z99b
const _poseSinte = { x: 0, z: 0, yaw: 0 };  // Z101
const _poseSampler = { x: 0, z: 0, yaw: 0 };   // Z103
/** Z99b: pone la cámara a 1 m del instrumento del índice k del arco (0 = caja), mirándolo. Para el menú de debug. */
export function irAInstrumento(k: number): boolean {
  if (!_camara || !poseInstrumento(k, _poseBajo)) return false;
  const p = poseFrenteAtrilBajo(_poseBajo.x, _poseBajo.z, _poseBajo.yaw, 1.0);
  _camara.position.set(p.x, 1.6, p.z);
  _camara.lookAt(p.mirarX, p.mirarY, p.mirarZ);
  return true;
}
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
  // Z95: sin transmisión ni presencia colgadas del checkpoint anterior (el remontaje suelta el resto: consentimiento,
  // oyente y recepción de LiveKit al desmontarse sus hosts)
  detenerLiveKit();
  detenerPresencia();
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
  reiniciarPasto(PASTO);   // Z64: todo checkpoint arranca sin pasto (ninguno lo restaura todavía)
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
  restaurarLucesEscena();   // Z97b: nivel por defecto, EXTRA apagada y sin luces extra acumuladas
}

// Z41: zonas desde lib/layoutSala.ts (siguen a DBG_LAYOUT), salidas reutilizadas
const _zona = { x: 0, z: 0 };
const _sillas = { x: 0, z: 0 };
/** En el centro de ZONA_SILLAS mirando a la tarima (la zona del Player dispara chose-chairs). */
function irAZonaSillas(): void { zonaSillasEn(DBG_LAYOUT, _zona); colocar(_zona.x, _zona.z, ZONA_TARIMA.x, ZONA_TARIMA.z); }
/** Sobre la tarima (ZONA_LUZ) mirando a las sillas. */
function irAZonaTarima(): void { centroSillasEn(DBG_LAYOUT, _sillas); colocar(ZONA_TARIMA.x, ZONA_TARIMA.z, _sillas.x, _sillas.z); }

const _mono = { x: 0, z: 0 };                                    // Z95
const _pos = { x: 0, z: 0, mirarX: 0, mirarZ: 0 };              // Z95
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
    consumirHuidaVisita();   // Z76: decide el checkpoint: va a donde esté la luz y la terminal se abre sin huida pendiente
    actualizarPosLuz();
    const x = LUZ_STATE.x + EJE_TELON.fx * 1.0, z = LUZ_STATE.z + EJE_TELON.fz * 1.0;
    _camara.position.set(x, 1.6, z);
    _camara.lookAt(LUZ_STATE.x, 1.6, LUZ_STATE.z);
    return true;
  },
  esperarDialogo: () => DIALOGO_STATE.activo,

  // estado final de juego_alarma (Z29): premio guardado, luces encendidas, sobre la tarima con la zona
  // TARIMA bloqueada hasta alejarse (como después del premio)
  // ── Z95 ──
  // los 4 cuartos del pasto completos y los monolitos ya arriba (sin la subida)
  pastoCompleto: () => { for (let i = 0; i < 4; i++) completarCuarto(PASTO, i); MONO_PASTO.k = 1; return true; },
  // Pasto calcula la posición de los monolitos en su useFrame: se espera a que estén arriba y ubicados
  esperarMonolitos: () => MONO_PASTO.k >= 0.99 && MONO_PASTO.xR !== MONO_PASTO.xL,
  // a RECIBIR_DIST_M del monolito de SONIDO (derecho), del lado de las sillas, mirándolo
  frenteMonolitos: () => {
    if (!_camara) return false;
    const usaPasto = MONO_PASTO.k > 0 && MONO_PASTO.xR !== MONO_PASTO.xL;
    if (usaPasto) { _mono.x = MONO_PASTO.xR; _mono.z = MONO_PASTO.z; } else monolitoEn(1, DBG_SILLAS.monolithDistM, DBG_LAYOUT, _mono);
    posicionRecibir(_mono, DBG_CHECKPOINTS.RECIBIR_DIST_M, _pos);
    colocar(_pos.x, _pos.z, _pos.mirarX, _pos.mirarZ);
    return true;
  },
  // el aviso al espectador vuelve a preguntar (no se saltea la aceptación) y los monolitos arrancan de cero
  avisoListo: () => { reiniciarDecisionAviso(); reiniciarMonolitosVivo(); return true; },
  // el domo de la tarima aparece ya (FaceDome escucha el evento)
  forzarDomo: () => { window.dispatchEvent(new CustomEvent("alight:debug-mostrar-domo")); return true; },
  // lo mismo que el botón "Mostrar elección ahora": texto 2 con Compartir / No compartir (hay que elegir igual)
  mostrarEleccion: () => { mostrarEleccionAhora(); return true; },
  // ── Z96 ──
  // "No compartir" en silencio (sin terminal ni transmisión) y espera a que salgan los atriles
  atrilesSinConsentimiento: (_p, ctx) => {
    if (ctx.primera) { escuchar("alight:lecterns-visible"); atajoSinCompartir(); }
    if (_esperado.visto) { soltarEscucha(); return true; }
    return false;
  },
  // frente al atril de sonido, a 1 m (dentro de INTERACT_RANGE 1,8 m; el de imagen queda a más de 2 m), mirando su panel
  frenteAtrilSonido: () => {
    if (!_camara) return false;
    const p = poseFrenteAtril(ATRIL_X_BASE + LECTERN_OUTWARD_OFFSET_M, 1.0);
    _camara.position.set(p.x, 1.6, p.z);
    _camara.lookAt(p.mirarX, p.mirarY, p.mirarZ);
    return true;
  },

  // Z97: a 1 m del atril de imagen (izquierda), mirándolo; el de sonido queda a ~2,2 m (fuera del rango de E)
  frenteAtrilImagen: () => {
    if (!_camara) return false;
    const p = poseFrenteAtrilImagen(ATRIL_X_BASE + LECTERN_OUTWARD_OFFSET_M, 1.0);
    _camara.position.set(p.x, 1.6, p.z);
    _camara.lookAt(p.mirarX, p.mirarY, p.mirarZ);
    return true;
  },

  // Z99: a 1 m del BA-40, mirándolo · Z99b: su pose sale de la función única (arco o línea), no de ATRIL_BAJO
  frenteAtrilBajo: () => {
    if (!_camara) return false;
    const b = poseAtrilBajo(_poseBajo);
    const p = poseFrenteAtrilBajo(b.x, b.z, b.yaw, 1.0);
    _camara.position.set(p.x, 1.6, p.z);
    _camara.lookAt(p.mirarX, p.mirarY, p.mirarZ);
    return true;
  },

  // Z101: a 1 m del SY-40, mirándolo; su pose sale de la función única (poseInstrumento(−1)), no de ATRIL_SINTE
  frenteAtrilSinte: () => {
    if (!_camara) return false;
    const y = poseAtrilSinte(_poseSinte);
    const p = poseFrenteAtrilSinte(y.x, y.z, y.yaw, 1.0);
    _camara.position.set(p.x, 1.6, p.z);
    _camara.lookAt(p.mirarX, p.mirarY, p.mirarZ);
    return true;
  },

  // Z103: a 1 m del SM-40, mirándolo; su pose sale de la función única (poseInstrumento(2)), no de ATRIL_SAMPLER
  frenteAtrilSampler: () => {
    if (!_camara) return false;
    const m = poseAtrilSampler(_poseSampler);
    const p = poseFrenteAtrilSampler(m.x, m.z, m.yaw, 1.0);
    _camara.position.set(p.x, 1.6, p.z);
    _camara.lookAt(p.mirarX, p.mirarY, p.mirarZ);
    return true;
  },

  premio: () => {
    guardarPremio();
    EFECTOS_STATE.bloqueaZonaTarima = true;
    irAZonaTarima();
    window.dispatchEvent(new CustomEvent("alight:premio-otorgado"));
    return true;
  },
};
