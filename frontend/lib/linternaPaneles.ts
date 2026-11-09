// Z2: linterna del usuario sobre los paneles SILLAS.
// Sin luces nuevas (cambiar la cantidad de luces recompila materiales): la "luz" es un
// test de cono entre el forward de la cámara y la dirección a cada panel, y se aplica
// en el shader del panel con el uniform uLit.
// Registro de paneles + máquina de selección. Objetos de módulo mutables, sin
// allocations por frame (vectores reutilizados).

import * as THREE from "three";
import { DBG_LINTERNA, DBG_ORBITAS, DBG_ACERC, DBG_SUBPANELES } from "@/lib/debugConfig";
import { calcularLayoutBloque, type LayoutBloque } from "@/lib/subpanelLayout";
import { CRT_UNIFORMS } from "@/lib/retro/retroCRT";
import { RETRO_FLAGS } from "@/lib/retro/retroFlags";

export interface PanelLinterna {
  pivot:    THREE.Object3D | null;   // grupo que gira con la fase propia del panel
  mesh:     THREE.Object3D | null;   // plano del panel (para su centro en mundo)
  uLit:     { value: number };       // uniform del shader del panel
  fase:     number;                  // ángulo de órbita propio (rad), se congela con la luz
  velocidad: number;                 // rad por frame a 60 fps (misma escala que antes)
  azimut:   number;                  // ángulo base del anillo
  bobAmp:   number;                  // Z7: variación vertical suave (± m), 0 = sin variación
  bobSemilla: number;                // Z7: fase propia de la variación
  indice:   number;
  titulo:   string;
  url:      string | null;
  proyectoId: number | null;         // Z3: para useProyectoDetalle (null = prestador)
  angulo:   number;                  // último ángulo al centro del cono (grados)
  acercado?: boolean;                // Z8: el mesh está fuera de su pose orbital (fase congelada)
}

export type LinternaFase = "inactiva" | "buscando" | "seleccionado" | "abierto";

export const LINTERNA_STATE = {
  fase:       "inactiva" as LinternaFase,
  sel:        null as PanelLinterna | null,  // panel seleccionado (único)
  tSel:       0,      // performance.now() en que empezó la luz sostenida sobre `sel`
  progreso:   0,      // 0–1 hacia ABRIR_MS
  selAlpha:   0,      // fundido del marco SEL
  marco:      null as PanelLinterna | null,  // panel donde se dibuja el marco (sigue durante el fade-out)
  apagada:    false,  // true tras alight:visualizer-activate (hasta reset)
  abiertoIdx: -1,     // índice del panel abierto (−1 = ninguno)
  retener:    false,  // Z4: la mirada está sobre el conjunto abierto (panel + subpaneles) → no soltar
};

export const PANELES_LINTERNA: PanelLinterna[] = [];

// Z7: último layout de órbitas calculado por ExperienceDome (para el menú de debug)
export interface AnilloInfo {
  radio: number; altura: number; yMin: number; yMax: number;
  vel: number; cantidad: number; capacidad: number; entra: boolean;
}
export const ORBITAS_INFO: { anillos: AnilloInfo[]; total: number; pedidos: number; yHaz: number; version: number } =
  { anillos: [], total: 0, pedidos: 0, yHaz: 0, version: 0 };

export function registrarPanelLinterna(p: PanelLinterna): () => void {
  PANELES_LINTERNA.push(p);
  return () => {
    const i = PANELES_LINTERNA.indexOf(p);
    if (i >= 0) PANELES_LINTERNA.splice(i, 1);
    if (LINTERNA_STATE.sel === p) soltar();
    if (LINTERNA_STATE.marco === p) LINTERNA_STATE.marco = null;
    if (ACERC.panel === p) { ACERC.panel = null; ACERC.fase = "orbita"; }
  };
}

// ── Z8: acercamiento del panel seleccionado ───────────────────────────────────
// La animación se hace en el espacio LOCAL del padre del mesh (pivot de Z2): mientras el
// panel está acercado su fase no avanza, así que el padre queda quieto y la pose orbital
// de vuelta es exactamente la pose local de reposo guardada (fase congelada, sin saltos).
export type AcercFase = "orbita" | "acercando" | "cerca" | "volviendo";
export const ACERC = {
  fase:     "orbita" as AcercFase,
  panel:    null as PanelLinterna | null,
  t0:       0,
  restPos:  new THREE.Vector3(), restQuat: new THREE.Quaternion(),   // pose orbital (local)
  fromPos:  new THREE.Vector3(), fromQuat: new THREE.Quaternion(),
  toPos:    new THREE.Vector3(), toQuat:   new THREE.Quaternion(),   // frente a la cámara (local)
  distancia: 0,                                                      // m a la cámara (debug)
  escalaSub: 1,                                                      // escala de ajuste de Z4 (debug)
  // Z9: marco de la cámara en el disparo + layout del bloque (panel + subpaneles)
  camPos0:  new THREE.Vector3(), fwd0: new THREE.Vector3(), up0: new THREE.Vector3(),
  ancho: 5.4, alto: 3.6,
  layout:   { k: 1, d: 6, up: 0, alejado: false, entra: true } as LayoutBloque,
  aspect:   0,                                                       // último aspecto usado (detecta resize)
};

/** Z9: recalcula el layout del bloque y el destino LOCAL del panel (sin allocations). */
function calcularDestino(camera: THREE.Camera): void {
  const p = ACERC.panel;
  const parent = p?.mesh?.parent;
  if (!p || !parent) return;
  const pc = camera as THREE.PerspectiveCamera;
  const fov = pc.isPerspectiveCamera ? pc.fov : 60;
  const aspect = pc.isPerspectiveCamera ? pc.aspect : 16 / 9;
  ACERC.aspect = aspect;
  if (DBG_SUBPANELES.SUB_AJUSTE_BLOQUE) {
    const curva = RETRO_FLAGS.enabled ? (CRT_UNIFORMS.uCurve.value as number) : 0;
    calcularLayoutBloque(ACERC.ancho, ACERC.alto, fov, aspect, curva, ACERC.layout);
  } else {
    // Z8: panel centrado en la mira, sin desplazamiento (el ajuste lo hace Z4)
    ACERC.layout.d = distanciaAcercamiento(camera, ACERC.ancho, ACERC.alto);
    ACERC.layout.up = 0; ACERC.layout.k = 1; ACERC.layout.alejado = false; ACERC.layout.entra = true;
  }
  ACERC.distancia = ACERC.layout.d;
  _aW.copy(ACERC.camPos0).addScaledVector(ACERC.fwd0, ACERC.layout.d).addScaledVector(ACERC.up0, ACERC.layout.up);
  parent.updateWorldMatrix(true, false);
  ACERC.toPos.copy(_aW); parent.worldToLocal(ACERC.toPos);
}
const _aW = new THREE.Vector3();
const _aQ = new THREE.Quaternion();
const _aPQ = new THREE.Quaternion();

function easing(k: number): number {
  const e = DBG_ACERC.ACERC_EASING;
  if (e === "suave")  return k * k * k * (k * (k * 6 - 15) + 10);                       // smootherstep
  if (e === "cubica") return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; // in-out cúbica
  return -(Math.cos(Math.PI * k) - 1) / 2;                                               // in-out seno
}

/** Z8: distancia a la que el panel ocupa ≤ ACERC_PANTALLA del ancho y del alto del viewport. */
function distanciaAcercamiento(camera: THREE.Camera, w: number, h: number): number {
  const pc = camera as THREE.PerspectiveCamera;
  const fov = pc.isPerspectiveCamera ? pc.fov : 60;
  const aspect = pc.isPerspectiveCamera ? pc.aspect : 16 / 9;
  const t = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  const f = THREE.MathUtils.clamp(DBG_ACERC.ACERC_PANTALLA, 0.05, 1);
  // alto visible a distancia d = 2·d·tan(fov/2); ancho = alto × aspect
  return Math.max(h / (2 * f * t), w / (2 * f * t * aspect));
}

function iniciarAcercamiento(p: PanelLinterna, camera: THREE.Camera, now: number): boolean {
  const mesh = p.mesh as THREE.Mesh | null;
  const parent = mesh?.parent;
  if (!mesh || !parent) return false;
  const geo = mesh.geometry as THREE.PlaneGeometry;
  ACERC.ancho = geo.parameters?.width ?? 5.4; ACERC.alto = geo.parameters?.height ?? 3.6;
  ACERC.restPos.copy(mesh.position); ACERC.restQuat.copy(mesh.quaternion);
  ACERC.fromPos.copy(mesh.position); ACERC.fromQuat.copy(mesh.quaternion);
  // Z9: marco de la cámara en el disparo (el bloque queda fijo en el mundo respecto de él)
  camera.getWorldPosition(ACERC.camPos0);
  camera.getWorldDirection(ACERC.fwd0);
  camera.getWorldQuaternion(_aQ);
  ACERC.up0.set(0, 1, 0).applyQuaternion(_aQ);
  // orientación: la de la cámara (el panel queda de frente); a local del padre, que está quieto
  parent.updateWorldMatrix(true, false);
  parent.getWorldQuaternion(_aPQ);
  ACERC.toQuat.copy(_aPQ).invert().multiply(_aQ);
  ACERC.panel = p; ACERC.fase = "acercando"; ACERC.t0 = now;
  // Z9: destino = bloque centrado en pantalla (el panel viaja directo a su lugar final)
  calcularDestino(camera);
  p.acercado = true;
  return true;
}

/** Z8: empieza la vuelta a la órbita desde donde esté (también si se corta a mitad del acercamiento). */
function iniciarVuelta(now: number): void {
  const p = ACERC.panel;
  if (!p?.mesh || ACERC.fase === "orbita" || ACERC.fase === "volviendo") return;
  const espera = ACERC.fase === "cerca" && DBG_ACERC.ACERC_ESPERA_CIERRE ? DBG_SUBPANELES.SUB_ANIM_MS : 0;
  ACERC.fromPos.copy(p.mesh.position); ACERC.fromQuat.copy(p.mesh.quaternion);
  ACERC.fase = "volviendo"; ACERC.t0 = now + espera;
}

/** Z8: cancela todo y deja el panel en su pose orbital al instante (visualizer-activate). */
function cancelarAcercamiento(): void {
  const p = ACERC.panel;
  if (p?.mesh) { p.mesh.position.copy(ACERC.restPos); p.mesh.quaternion.copy(ACERC.restQuat); }
  if (p) p.acercado = false;
  ACERC.panel = null; ACERC.fase = "orbita";
}

function tickAcercamiento(now: number, dt: number, camera: THREE.Camera): void {
  const p = ACERC.panel;
  if (!p || !p.mesh || ACERC.fase === "orbita") return;
  const m = p.mesh;
  // Z9: si cambió el aspecto (resize) o el FOV, se recalcula el layout del bloque
  if (ACERC.fase === "acercando" || ACERC.fase === "cerca") {
    const pc = camera as THREE.PerspectiveCamera;
    if (pc.isPerspectiveCamera && pc.aspect !== ACERC.aspect) calcularDestino(camera);
  }
  if (ACERC.fase === "cerca") {
    // sigue el destino suavemente (solo se mueve si cambió por un resize)
    const a = 1 - Math.exp(-Math.max(0.1, DBG_ACERC.ACERC_AJUSTE_S) * dt);
    m.position.lerp(ACERC.toPos, a);
    return;
  }
  if (ACERC.fase === "acercando") {
    const k = Math.min(1, (now - ACERC.t0) / Math.max(1, DBG_ACERC.ACERC_MS));
    const e = easing(k);
    m.position.lerpVectors(ACERC.fromPos, ACERC.toPos, e);
    m.quaternion.slerpQuaternions(ACERC.fromQuat, ACERC.toQuat, e);
    if (k >= 1) {
      ACERC.fase = "cerca";
      // recién al llegar aparecen los subpaneles (Z4)
      if (LINTERNA_STATE.sel === p)
        emitir("alight:panel-abierto", { indice: p.indice, titulo: p.titulo, url: p.url, proyectoId: p.proyectoId });
    }
  } else if (ACERC.fase === "volviendo") {
    if (now < ACERC.t0) return;                                    // esperando el cierre de Z4
    const k = Math.min(1, (now - ACERC.t0) / Math.max(1, DBG_ACERC.ACERC_VUELTA_MS));
    const e = easing(k);
    m.position.lerpVectors(ACERC.fromPos, ACERC.restPos, e);
    m.quaternion.slerpQuaternions(ACERC.fromQuat, ACERC.restQuat, e);
    if (k >= 1) {
      m.position.copy(ACERC.restPos); m.quaternion.copy(ACERC.restQuat);
      p.acercado = false;                                          // retoma la órbita desde su fase
      ACERC.panel = null; ACERC.fase = "orbita";
    }
  }
}

const _fwd = new THREE.Vector3();
const _cam = new THREE.Vector3();

// ── eventos para Z4 (subpaneles) ──────────────────────────────────────────────
// alight:panel-abierto  { indice, titulo, url, proyectoId }  → tras ABRIR_MS de luz sostenida
// alight:panel-cerrado  { indice }               → la luz deja el panel abierto o se apaga
function emitir(nombre: string, detail: object) {
  window.dispatchEvent(new CustomEvent(nombre, { detail }));
}

function soltar() {
  const s = LINTERNA_STATE;
  if (s.abiertoIdx >= 0) emitir("alight:panel-cerrado", { indice: s.abiertoIdx });
  if (ACERC.panel && ACERC.panel === s.sel) iniciarVuelta(performance.now()); // Z8
  s.sel = null; s.progreso = 0; s.abiertoIdx = -1; s.retener = false;
  s.fase = s.apagada ? "inactiva" : "buscando";
}

/** Z2: apaga y limpia todo (alight:visualizer-activate). */
export function apagarLinterna(): void {
  LINTERNA_STATE.apagada = true;
  soltar();
  cancelarAcercamiento(); // Z8
  for (const p of PANELES_LINTERNA) p.uLit.value = 0;
  LINTERNA_STATE.selAlpha = 0;
  LINTERNA_STATE.marco = null;
  LINTERNA_STATE.fase = "inactiva";
}

/** Z2: vuelve a habilitarla (debug reset del camino SILLAS). */
export function resetLinterna(): void {
  LINTERNA_STATE.apagada = false;
  soltar();
}

/** Z7: variación vertical suave ligada a la fase de órbita (se congela con el panel). */
function moverVertical(p: PanelLinterna): void {
  if (!p.mesh || p.bobAmp === 0 || p.acercado) return; // Z8: el acercamiento maneja la pose
  p.mesh.position.y = p.bobAmp * Math.sin(p.fase * DBG_ORBITAS.ORB_VAR_FREQ + p.bobSemilla);
}


const _pos = new THREE.Vector3();
const RAD = Math.PI / 180;

/**
 * Z2: un paso de la linterna. `activa` = panelesSillasVisibles(); `orbitan` = los paneles
 * se están dibujando (fase P1 ≠ oculto: las órbitas avanzan, como antes en OrbitRing).
 * Avanza la fase de cada panel salvo la del seleccionado, calcula uLit por cono,
 * elige un único seleccionado con histéresis y corre el temporizador de apertura.
 */
export function tickLinterna(camera: THREE.Camera, dt: number, now: number, activa: boolean, orbitan: boolean): void {
  const s = LINTERNA_STATE;
  const D = DBG_LINTERNA;
  const on = activa && D.LINTERNA_ACTIVA && !s.apagada;
  const kLit = 1 - Math.exp(-D.LUZ_FADE_S * dt);
  const kSel = 1 - Math.exp(-D.SEL_FADE_S * dt);
  const pasos = dt * 60; // la velocidad original era por frame a 60 fps

  if (!on) {
    if (s.sel) soltar();
    if (!s.apagada) s.fase = "inactiva";
    for (const p of PANELES_LINTERNA) {
      // las órbitas siguen avanzando igual que antes (solo si los paneles se ven)
      if (orbitan && !p.acercado) p.fase += p.velocidad * D.ORBITA_VEL_MULT * pasos; // Z8: congelada
      if (p.pivot) p.pivot.rotation.y = p.azimut + p.fase;
      moverVertical(p);
      p.uLit.value += (0 - p.uLit.value) * kLit;
    }
    s.selAlpha += (0 - s.selAlpha) * kSel;
    tickAcercamiento(now, dt, camera); // Z8: la vuelta sigue aunque la linterna esté inactiva
    return;
  }

  camera.getWorldDirection(_fwd);
  camera.getWorldPosition(_cam);
  const cono = Math.max(0.1, D.CONO_DEG);
  const entra = Math.min(D.ENTRA_DEG, D.SALE_DEG);
  let mejor: PanelLinterna | null = null;
  let mejorAng = 1e9;

  for (const p of PANELES_LINTERNA) {
    if (p.mesh) {
      p.mesh.getWorldPosition(_pos);
      _pos.sub(_cam);
      const len = _pos.length();
      const c = len > 1e-4 ? THREE.MathUtils.clamp(_fwd.dot(_pos) / len, -1, 1) : -1;
      p.angulo = Math.acos(c) / RAD;
    } else {
      p.angulo = 180;
    }
    // luz del cono: 1 en el centro → 0 en CONO_DEG (smoothstep)
    const t = THREE.MathUtils.clamp(1 - p.angulo / cono, 0, 1);
    const lit = t * t * (3 - 2 * t) * D.LUZ_INTENSIDAD;
    p.uLit.value += (lit - p.uLit.value) * kLit;
    if (p.angulo < entra && p.angulo < mejorAng) { mejor = p; mejorAng = p.angulo; }
  }

  // histéresis: el seleccionado se mantiene hasta pasar SALE_DEG
  const actual = s.sel;
  // Z4: con el panel abierto, la luz pasa a ser puntero: no se suelta mientras la mirada
  // siga sobre el conjunto (lo calcula SubpanelesProyecto en LINTERNA_STATE.retener)
  // Z8: durante el acercamiento (≈0,9 s) no se suelta: el panel viaja hacia el centro de la mirada
  const viajando = ACERC.fase === "acercando" && ACERC.panel === actual;
  if (actual && actual.angulo > D.SALE_DEG && !(s.abiertoIdx >= 0 && s.retener) && !viajando) soltar();
  // Z8: mientras un panel vuelve a su órbita no se puede seleccionar otro
  if (!s.sel && mejor && ACERC.fase === "orbita") {
    s.sel = mejor; s.marco = mejor; s.tSel = now; s.progreso = 0; s.fase = "seleccionado";
  }
  if (!s.sel) s.fase = "buscando";

  // temporizador de apertura
  if (s.sel) {
    s.progreso = Math.min(1, (now - s.tSel) / Math.max(1, D.ABRIR_MS));
    if (s.progreso >= 1 && s.abiertoIdx < 0) {
      s.abiertoIdx = s.sel.indice;
      s.fase = "abierto";
      // Z8: primero se acerca; el evento 'abierto' (subpaneles) sale al llegar
      if (!(DBG_ACERC.ACERC_ACTIVO && iniciarAcercamiento(s.sel, camera, now)))
        emitir("alight:panel-abierto", { indice: s.sel.indice, titulo: s.sel.titulo, url: s.sel.url, proyectoId: s.sel.proyectoId });
    }
  }
  s.selAlpha += ((s.sel ? 1 : 0) - s.selAlpha) * kSel;

  // fase de órbita propia: el seleccionado no avanza; los demás siguen desde donde quedaron
  for (const p of PANELES_LINTERNA) {
    if (p !== s.sel && !p.acercado) p.fase += p.velocidad * D.ORBITA_VEL_MULT * pasos; // Z8
    if (p.pivot) p.pivot.rotation.y = p.azimut + p.fase;
    moverVertical(p);
  }
  tickAcercamiento(now, dt, camera); // Z8
}
