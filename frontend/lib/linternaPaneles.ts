// Z2: linterna del usuario sobre los paneles SILLAS.
// Sin luces nuevas (cambiar la cantidad de luces recompila materiales): la "luz" es un
// test de cono entre el forward de la cámara y la dirección a cada panel, y se aplica
// en el shader del panel con el uniform uLit.
// Registro de paneles + máquina de selección. Objetos de módulo mutables, sin
// allocations por frame (vectores reutilizados).

import * as THREE from "three";
import { DBG_LINTERNA, DBG_ORBITAS, DBG_ACERC, DBG_SUBPANELES, DBG_PRIORIDAD, DBG_LOG_PANEL, DBG_AISLAR_UI } from "@/lib/debugConfig";
import { calcularLayoutBloque, calcularLayoutConcavo, calcularLayoutDomo, calcularLayoutEsferico, type LayoutBloque } from "@/lib/subpanelLayout";
import { CRT_UNIFORMS } from "@/lib/retro/retroCRT";
import { RETRO_FLAGS } from "@/lib/retro/retroFlags";
import { CAPA_UI, CAPA_UI_ESTADO } from "@/lib/retro/capaUI";

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
  // Z10: prioridad del proyecto abierto
  uAtenua?: { value: number };       // multiplicador de brillo del shader del panel (1 = normal)
  oculta?: number;                   // factor de escala 0–1 (lo aplica PanelMesh sobre el fade de P1)
  escalaAcerc?: number;              // Z16: escala extra del panel acercado al domo cercano (1 = normal)
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
  habilitada: false,  // Z13: selección habilitada (movimiento liberado) — debug
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
// Z12: "cerca" = llegó y aparecen los subpaneles; "abierto" = bloque completo, recién ahí puede cerrarse
export type AcercFase = "orbita" | "acercando" | "cerca" | "abierto" | "volviendo";
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
  layout:   { k: 1, d: 6, up: 0, alejado: false, entra: true, medioAncho: 2.7, medioAlto: 1.8 } as LayoutBloque,
  renderOrderPrevio: 0,                                              // Z10
  // Z12: latch + cierre en pantalla
  tLlegada: 0,                                                       // llegada al destino
  tAbierto: 0,                                                       // bloque completo (subpaneles listos)
  tFuera:   0,                                                       // desde cuándo la mira está fuera de la caja (0 = dentro)
  bloqueListo: false,                                                // lo pone SubpanelesProyecto al terminar su salida
  conSubpaneles: true,                                               // false = prestador (sin subpaneles)
  miraDentro: true,                                                  // debug
  aspect:   0,                                                       // último aspecto usado (detecta resize)
  // Z16: marco RÍGIDO capturado (pitch limitado): forward, up, right y su orientación
  fF: new THREE.Vector3(0, 0, -1), uF: new THREE.Vector3(0, 1, 0), rF: new THREE.Vector3(1, 0, 0),
  qF: new THREE.Quaternion(), qPanelW: new THREE.Quaternion(),
  escalaDesde: 1, escalaHasta: 1,
  layoutVersion: 0,                                                  // Z18
  depthTestPrevio: true,
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
  if (DBG_SUBPANELES.SUB_AJUSTE_BLOQUE && ACERC.conSubpaneles) { // Z12: prestadores sin bloque
    const curva = RETRO_FLAGS.enabled ? (CRT_UNIFORMS.uCurve.value as number) : 0;
    if (DBG_SUBPANELES.SUB_CONCAVO && DBG_SUBPANELES.SUB_DOMO_CERCANO && DBG_SUBPANELES.SUB_DOMO_ESFERICO) { // Z18
      calcularLayoutEsferico(ACERC.ancho, ACERC.alto, fov, aspect, curva, ACERC.layout);
    } else if (DBG_SUBPANELES.SUB_CONCAVO && DBG_SUBPANELES.SUB_DOMO_CERCANO) { // Z16: domo cercano
      ACERC.layout.esferico = false;
      calcularLayoutDomo(ACERC.ancho, ACERC.alto, fov, aspect, curva, ACERC.layout);
    }
    else if (DBG_SUBPANELES.SUB_CONCAVO)  // Z14: conjunto cóncavo alrededor del ojo
      calcularLayoutConcavo(ACERC.ancho, ACERC.alto, fov, aspect, curva, Math.asin(THREE.MathUtils.clamp(ACERC.fwd0.y, -1, 1)), ACERC.layout);
    else
      calcularLayoutBloque(ACERC.ancho, ACERC.alto, fov, aspect, curva, ACERC.layout);
  } else {
    // Z8: panel centrado en la mira, sin desplazamiento (el ajuste lo hace Z4)
    ACERC.layout.d = distanciaAcercamiento(camera, ACERC.ancho, ACERC.alto);
    ACERC.layout.up = 0; ACERC.layout.k = 1; ACERC.layout.alejado = false; ACERC.layout.entra = true;
    ACERC.layout.concavo = false; ACERC.layout.domo = false; ACERC.layout.esferico = false; // Z14 / Z16 / Z18
    // Z10: sin el cálculo de bloque se toma todo el viewport como zona del conjunto
    const t = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    ACERC.layout.medioAlto = ACERC.layout.d * t; ACERC.layout.medioAncho = ACERC.layout.medioAlto * aspect;
  }
  ACERC.distancia = ACERC.layout.d;
  ACERC.layoutVersion++; // Z18: los parches se reconstruyen si cambia (resize)
  parent.updateWorldMatrix(true, false);
  if (ACERC.layout.domo) {
    // Z16: panel a DOMO_RADIO_M sobre el marco rígido, subido `elevPanel` (giro sobre RIGHT del marco),
    // mirando al ojo; escala para conservar su tamaño angular de Z8
    const ep = ACERC.layout.elevPanel ?? 0;
    _aQ.setFromAxisAngle(ACERC.rF, ep);
    _aW.copy(ACERC.fF).applyQuaternion(_aQ).multiplyScalar(ACERC.layout.d).add(ACERC.camPos0);
    // vertical en el marco (Z16); Z18: perpendicular a su dirección (tangente a la esfera en el centro)
    if (ACERC.layout.esferico) ACERC.qPanelW.copy(_aQ).multiply(ACERC.qF);
    else ACERC.qPanelW.copy(ACERC.qF);
    parent.getWorldQuaternion(_aPQ);
    ACERC.toQuat.copy(_aPQ).invert().multiply(ACERC.qPanelW);
    ACERC.escalaHasta = ACERC.layout.panelEscala ?? 1;
  } else {
    _aW.copy(ACERC.camPos0).addScaledVector(ACERC.fwd0, ACERC.layout.d).addScaledVector(ACERC.up0, ACERC.layout.up);
    ACERC.escalaHasta = 1;
  }
  ACERC.toPos.copy(_aW); parent.worldToLocal(ACERC.toPos);
}

/** Z16: captura el marco rígido de la cámara (sin roll) con el pitch limitado a ±DOMO_PITCH_MAX_DEG. */
function capturarMarco(): void {
  const f = ACERC.fwd0;
  const lim = Math.abs(DBG_SUBPANELES.DOMO_PITCH_MAX_DEG) * Math.PI / 180;
  const el = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(f.y, -1, 1)), -lim, lim);
  const hx = f.x, hz = f.z, hl = Math.hypot(hx, hz) || 1;
  ACERC.fF.set((hx / hl) * Math.cos(el), Math.sin(el), (hz / hl) * Math.cos(el));
  ACERC.rF.crossVectors(ACERC.fF, _Yw).normalize();     // derecha horizontal (la cámara no tiene roll)
  ACERC.uF.crossVectors(ACERC.rF, ACERC.fF).normalize();
  _aM.makeBasis(ACERC.rF, ACERC.uF, _aW.copy(ACERC.fF).negate());
  ACERC.qF.setFromRotationMatrix(_aM);                   // orientación "de cámara" del marco
}
const _aW = new THREE.Vector3();
const _aQ = new THREE.Quaternion();
const _aPQ = new THREE.Quaternion();
const _aM = new THREE.Matrix4();          // Z16
const _Yw = new THREE.Vector3(0, 1, 0);   // Z16

// ── Z12: log de diagnóstico (DBG_LOG_PANEL.LOG_ACTIVO) ──
export function logPanel(transicion: string, motivo: string, p: PanelLinterna | null): void {
  if (!DBG_LOG_PANEL.LOG_ACTIVO) return;
  const ang = p ? p.angulo.toFixed(1) : "—";
  console.info(`[panel] ${(performance.now() / 1000).toFixed(3)} s · ${transicion} · motivo: ${motivo} · panel ${p?.indice ?? "—"} · ángulo al centro ${ang}°`);
}

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
  capturarMarco(); // Z16
  // orientación: la de la cámara (el panel queda de frente); a local del padre, que está quieto
  parent.updateWorldMatrix(true, false);
  parent.getWorldQuaternion(_aPQ);
  ACERC.toQuat.copy(_aPQ).invert().multiply(_aQ);
  ACERC.panel = p; ACERC.fase = "acercando"; ACERC.t0 = now;
  // Z12: estado del latch
  ACERC.conSubpaneles = p.proyectoId !== null && DBG_SUBPANELES.SUB_ACTIVO;
  ACERC.bloqueListo = false; ACERC.tLlegada = 0; ACERC.tAbierto = 0; ACERC.tFuera = 0; ACERC.miraDentro = true;
  logPanel("apuntando → viajando", "luz sostenida ABRIR_MS", p);
  // Z10: el panel elegido se dibuja después de los que orbitan
  ACERC.renderOrderPrevio = mesh.renderOrder;
  mesh.renderOrder = DBG_PRIORIDAD.RENDER_ORDER_BLOQUE;
  // Z9: destino = bloque centrado en pantalla (el panel viaja directo a su lugar final)
  calcularDestino(camera);
  // Z16: escala animada y capa de interfaz (depthTest off) solo para el conjunto del domo cercano
  ACERC.escalaDesde = p.escalaAcerc ?? 1;
  const mat = mesh.material as THREE.Material;
  ACERC.depthTestPrevio = mat.depthTest;
  // Z17: el conjunto del domo va a la capa de interfaz (pase propio en RetroPostFX, depth limpio).
  // Sin post-proceso no hay pase → queda en la escena normal. El modo viejo de Z16 (depthTest off,
  // con el bug de los cortes) queda detrás de DOMO_CAPA_DEPTHTEST_VIEJO solo para comparar.
  if (ACERC.layout.domo && DBG_SUBPANELES.DOMO_CAPA_UI && RETRO_FLAGS.enabled) {
    mesh.layers.set(CAPA_UI); CAPA_UI_ESTADO.activa = true;
  } else if (ACERC.layout.domo && DBG_SUBPANELES.DOMO_CAPA_DEPTHTEST_VIEJO) mat.depthTest = false;
  p.acercado = true;
  return true;
}

/** Z8: empieza la vuelta a la órbita desde donde esté (también si se corta a mitad del acercamiento). */
let motivoVuelta = "—"; // Z12: lo fija quien suelta (para el log)
function iniciarVuelta(now: number): void {
  const p = ACERC.panel;
  if (!p?.mesh || ACERC.fase === "orbita" || ACERC.fase === "volviendo") return;
  const espera = (ACERC.fase === "cerca" || ACERC.fase === "abierto") && DBG_ACERC.ACERC_ESPERA_CIERRE ? DBG_SUBPANELES.SUB_ANIM_MS : 0;
  logPanel(`${ACERC.fase} → retornando`, motivoVuelta, p);
  ACERC.fromPos.copy(p.mesh.position); ACERC.fromQuat.copy(p.mesh.quaternion);
  ACERC.escalaDesde = p.escalaAcerc ?? 1; ACERC.escalaHasta = 1; // Z16
  ACERC.fase = "volviendo"; ACERC.t0 = now + espera;
}

/** Z8: cancela todo y deja el panel en su pose orbital al instante (visualizer-activate). */
function cancelarAcercamiento(): void {
  const p = ACERC.panel;
  if (p) logPanel(`${ACERC.fase} → orbita`, "cancelado (visualizer-activate)", p);
  if (p?.mesh) {
    p.mesh.position.copy(ACERC.restPos); p.mesh.quaternion.copy(ACERC.restQuat); p.mesh.renderOrder = ACERC.renderOrderPrevio;
    ((p.mesh as THREE.Mesh).material as THREE.Material).depthTest = ACERC.depthTestPrevio; // Z16
    p.mesh.layers.set(0); p.mesh.visible = true; CAPA_UI_ESTADO.activa = false;             // Z17
  }
  if (p) p.escalaAcerc = 1; // Z16
  // Z10: los demás vuelven al instante (los paneles se ocultan igual con el visualizador)
  for (const q of PANELES_LINTERNA) { q.oculta = 1; if (q.uAtenua) q.uAtenua.value = 1; }
  if (p) p.acercado = false;
  ACERC.panel = null; ACERC.fase = "orbita";
}

function tickAcercamiento(now: number, dt: number, camera: THREE.Camera): void {
  const p = ACERC.panel;
  if (!p || !p.mesh || ACERC.fase === "orbita") return;
  const m = p.mesh;
  // Z9: si cambió el aspecto (resize) o el FOV, se recalcula el layout del bloque
  if (ACERC.fase === "acercando" || ACERC.fase === "cerca" || ACERC.fase === "abierto") {
    // Z9: resize → solo se recalcula el destino; Z12: nunca cambia la fase por esto
    const pc = camera as THREE.PerspectiveCamera;
    if (pc.isPerspectiveCamera && pc.aspect !== ACERC.aspect) calcularDestino(camera);
  }
  if (ACERC.fase === "cerca" || ACERC.fase === "abierto") {
    // sigue el destino suavemente (solo se mueve si cambió por un resize)
    const a = 1 - Math.exp(-Math.max(0.1, DBG_ACERC.ACERC_AJUSTE_S) * dt);
    m.position.lerp(ACERC.toPos, a);
    m.quaternion.slerp(ACERC.toQuat, a);                                   // Z16: el destino puede rotar (resize)
    p.escalaAcerc = (p.escalaAcerc ?? 1) + (ACERC.escalaHasta - (p.escalaAcerc ?? 1)) * a;
    // Z12: cerca → abierto cuando el bloque está completo (o sin subpaneles / datos que no llegan)
    if (ACERC.fase === "cerca") {
      const sinBloque = !ACERC.conSubpaneles;
      const tarde = now - ACERC.tLlegada > DBG_ACERC.ESPERA_DATOS_MS;
      if (ACERC.bloqueListo || sinBloque || tarde) {
        ACERC.fase = "abierto"; ACERC.tAbierto = now; ACERC.tFuera = 0;
        logPanel("cerca → abierto", ACERC.bloqueListo ? "subpaneles completos" : sinBloque ? "sin subpaneles (prestador)" : "datos no llegaron (ESPERA_DATOS_MS)", p);
      }
    }
    return;
  }
  if (ACERC.fase === "acercando") {
    const k = Math.min(1, (now - ACERC.t0) / Math.max(1, DBG_ACERC.ACERC_MS));
    const e = easing(k);
    m.position.lerpVectors(ACERC.fromPos, ACERC.toPos, e);
    m.quaternion.slerpQuaternions(ACERC.fromQuat, ACERC.toQuat, e);
    p.escalaAcerc = ACERC.escalaDesde + (ACERC.escalaHasta - ACERC.escalaDesde) * e; // Z16
    if (k >= 1) {
      ACERC.fase = "cerca";
      ACERC.tLlegada = now;
      logPanel("viajando → cerca", "llegó al destino", p);
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
    p.escalaAcerc = ACERC.escalaDesde + (1 - ACERC.escalaDesde) * e;   // Z16
    if (k >= 1) {
      m.position.copy(ACERC.restPos); m.quaternion.copy(ACERC.restQuat);
      m.renderOrder = ACERC.renderOrderPrevio;                     // Z10
      ((m as THREE.Mesh).material as THREE.Material).depthTest = ACERC.depthTestPrevio; // Z16
      m.layers.set(0); m.visible = true; CAPA_UI_ESTADO.activa = false;                 // Z17
      p.escalaAcerc = 1;
      p.acercado = false;                                          // retoma la órbita desde su fase
      logPanel("retornando → orbita", "llegó a su fase congelada", p);
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
  motivoVuelta = "visualizer-activate";
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
export function tickLinterna(camera: THREE.Camera, dt: number, now: number, activa: boolean, orbitan: boolean, habilitada = true): void {
  const s = LINTERNA_STATE;
  const D = DBG_LINTERNA;
  // Z13: antes de liberarse el movimiento no hay luz ni selección; si ya hay una en curso
  // (selección, viaje o panel abierto) no se interrumpe.
  const enCurso = s.sel !== null || ACERC.fase !== "orbita";
  LINTERNA_STATE.habilitada = habilitada;
  const on = activa && D.LINTERNA_ACTIVA && !s.apagada && (habilitada || enCurso);
  const kLit = 1 - Math.exp(-D.LUZ_FADE_S * dt);
  const kSel = 1 - Math.exp(-D.SEL_FADE_S * dt);
  const pasos = dt * 60; // la velocidad original era por frame a 60 fps

  if (!on) {
    if (s.sel) { motivoVuelta = "linterna inactiva"; soltar(); }
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
    tickPrioridad(dt, camera);         // Z10
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
  // Z12: con el acercamiento disparado la selección queda LATCHEADA: el cono no cuenta.
  // Durante el viaje y la aparición de los subpaneles no se suelta por nada (salvo
  // visualizer-activate); en 'abierto' el cierre se decide en pantalla (caja del bloque).
  const latcheado = ACERC.panel !== null && ACERC.panel === actual
    && (ACERC.fase === "acercando" || ACERC.fase === "cerca" || ACERC.fase === "abierto");
  if (latcheado) {
    if (ACERC.fase === "abierto" && cierrePorPantalla(camera, now)) {
      motivoVuelta = `mira fuera del bloque ${DBG_ACERC.CIERRE_GRACIA_MS} ms`;
      soltar();
    }
  } else if (actual && actual.angulo > D.SALE_DEG && !(s.abiertoIdx >= 0 && s.retener)) {
    motivoVuelta = "cono (luz retirada)";
    logPanel(s.abiertoIdx >= 0 ? "abierto → orbita" : "apuntando → orbita", "cono (luz retirada)", actual);
    soltar();
  }
  // Z8: mientras un panel vuelve a su órbita no se puede seleccionar otro
  if (!s.sel && mejor && ACERC.fase === "orbita") {
    s.sel = mejor; s.marco = mejor; s.tSel = now; s.progreso = 0; s.fase = "seleccionado";
    logPanel("orbita → apuntando", `entró al cono (< ${D.ENTRA_DEG}°)`, mejor);
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
  tickPrioridad(dt, camera);         // Z10
}

// ── Z12: cierre decidido en pantalla ──────────────────────────────────────────
// La mira (rayo central de la cámara) se intersecta con el plano del bloque (a ACERC.layout.d
// sobre la dirección del disparo) y se compara con la caja envolvente del bloque completo
// (panel + HISTORIA + GALERÍA + FICHA, centrada) más CIERRE_MARGEN. La gracia cuenta desde
// 'abierto'. Mirar el panel (que quedó arriba del centro) nunca cierra.
const _cc = new THREE.Vector3();
const _cf = new THREE.Vector3();
const _cr = new THREE.Vector3();
function cierrePorPantalla(camera: THREE.Camera, now: number): boolean {
  const L = ACERC.layout;
  camera.getWorldPosition(_cam);
  camera.getWorldDirection(_cf);
  // Z14: conjunto cóncavo → región ANGULAR en el mundo (yaw sobre la vertical, elevación),
  // así girar hacia HISTORIA / GALERÍA o bajar a FICHA nunca cierra.
  if (L.concavo) {
    const dentroAng = enRegionConcava(_cf, 0, DBG_ACERC.CIERRE_MARGEN_DEG * Math.PI / 180);
    ACERC.miraDentro = dentroAng;
    if (dentroAng) { ACERC.tFuera = 0; return false; }
    if (ACERC.tFuera === 0) ACERC.tFuera = now;
    return now - ACERC.tFuera >= DBG_ACERC.CIERRE_GRACIA_MS;
  }
  _cc.copy(ACERC.camPos0).addScaledVector(ACERC.fwd0, L.d);       // centro del bloque
  const den = _cf.dot(ACERC.fwd0);
  let dentro = false;
  if (den > 1e-4) {
    const t = _pos.copy(_cc).sub(_cam).dot(ACERC.fwd0) / den;
    if (t > 0) {
      _pos.copy(_cam).addScaledVector(_cf, t).sub(_cc);              // impacto relativo al centro
      _cr.crossVectors(ACERC.fwd0, ACERC.up0).normalize();
      const pc = camera as THREE.PerspectiveCamera;
      const tanH = Math.tan(THREE.MathUtils.degToRad(pc.isPerspectiveCamera ? pc.fov : 60) / 2);
      const aspect = pc.isPerspectiveCamera ? pc.aspect : 16 / 9;
      const mY = DBG_ACERC.CIERRE_MARGEN * L.d * tanH, mX = mY * aspect;
      // caja: el bloque centrado; sin subpaneles, solo el panel (que está en el centro)
      const hx = (ACERC.conSubpaneles ? L.medioAncho : ACERC.ancho / 2) + mX;
      const hy = (ACERC.conSubpaneles ? L.medioAlto : ACERC.alto / 2) + mY;
      const yc = ACERC.conSubpaneles ? 0 : L.up;                      // sin bloque: el panel puede estar desplazado
      dentro = Math.abs(_pos.dot(_cr)) <= hx && Math.abs(_pos.dot(ACERC.up0) - yc) <= hy;
    }
  }
  ACERC.miraDentro = dentro;
  if (dentro) { ACERC.tFuera = 0; return false; }
  if (ACERC.tFuera === 0) ACERC.tFuera = now;
  return now - ACERC.tFuera >= DBG_ACERC.CIERRE_GRACIA_MS;
}

/** Z14: ¿la dirección `dir` (unitaria, mundo) cae en la región angular del conjunto cóncavo?
 *  yaw relativo a la mira del disparo sobre la vertical; elevación relativa a la de la mira.
 *  `extra` agranda la región (p. ej. el semiángulo de otro panel). */
function enRegionConcava(dir: THREE.Vector3, extra: number, margen: number): boolean {
  const L = ACERC.layout, f = ACERC.fwd0;
  if (L.domo) {
    // Z16: en el marco rígido capturado: yaw sobre su UP, elevación sobre su RIGHT
    const x = dir.dot(ACERC.rF), y = dir.dot(ACERC.uF), z = dir.dot(ACERC.fF);
    const yawF = Math.atan2(x, z), elevF = Math.atan2(y, Math.hypot(x, z));
    const extD = (L.yawExt ?? 0) + margen + extra;
    return z > 0 && Math.abs(yawF) <= extD
      && elevF <= (L.angTop ?? 0) + margen + extra
      && elevF >= (L.angBot ?? 0) - margen - extra;
  }
  const yawRel = Math.atan2(f.x * dir.z - f.z * dir.x, f.x * dir.x + f.z * dir.z);
  const elevRel = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) - Math.asin(THREE.MathUtils.clamp(f.y, -1, 1));
  const ext = (L.yawExt ?? 0) + margen + extra;
  return Math.abs(yawRel) <= ext
    && elevRel <= (L.angTop ?? 0) + margen + extra
    && elevRel >= (L.angBot ?? 0) - margen - extra;
}

// ── Z10: prioridad visual del conjunto abierto ────────────────────────────────
// Causa: con el panel acercado (~6 m de la cámara) el conjunto mide ~19 × 11 m y sus
// extremos llegan a 15–16 m del eje del domo, a la altura del anillo interior (r = 15 m):
// los paneles de ese anillo atraviesan físicamente HISTORIA / GALERÍA (intersección de
// geometría, no z-fight). Mientras haya un proyecto acercándose/abierto, los demás se
// atenúan y los que se proyectan sobre el conjunto (en el encuadre del disparo) se
// esconden por escala, con fundido; al volver, todo regresa con el mismo fundido.
const _pv = new THREE.Vector3();
const _right = new THREE.Vector3();

function tickPrioridad(dt: number, camera: THREE.Camera): void {
  const P = DBG_PRIORIDAD;
  const activo = P.PRIORIDAD_ACTIVA && ACERC.panel !== null && (ACERC.fase === "acercando" || ACERC.fase === "cerca" || ACERC.fase === "abierto"); // Z12: + abierto
  const k = 1 - Math.exp(-dt * 1000 / Math.max(1, P.ATENUAR_MS) * 3); // ~95 % en ATENUAR_MS
  const pc = camera as THREE.PerspectiveCamera;
  const t = Math.tan(THREE.MathUtils.degToRad(pc.isPerspectiveCamera ? pc.fov : 60) / 2);
  const aspect = pc.isPerspectiveCamera ? pc.aspect : 16 / 9;
  if (activo) _right.crossVectors(ACERC.fwd0, ACERC.up0).normalize();
  const L = ACERC.layout;
  // zona del conjunto en coordenadas normalizadas del encuadre del disparo (centrada)
  const bx = L.medioAncho / (L.d * t * aspect), by = L.medioAlto / (L.d * t);
  for (const p of PANELES_LINTERNA) {
    if (p.oculta === undefined) p.oculta = 1;
    let atenua = 1, oculta = 1;
    if (activo && p !== ACERC.panel) {
      atenua = THREE.MathUtils.clamp(P.ATENUAR_BRILLO, 0, 1);
      if (DBG_AISLAR_UI.MODO !== "todo") oculta = 0;   // Z17: aislar la interfaz (debug)
      if (P.OCULTAR_SOLAPADOS && p.mesh && L.concavo) {
        // Z14: región angular del conjunto cóncavo (incluye los laterales a ±yaw)
        p.mesh.getWorldPosition(_pv).sub(ACERC.camPos0);
        const dist = _pv.length();
        if (dist > 0.1 && dist < Math.max(L.d, L.dLat ?? L.d) + P.OCULTAR_PROF_M) {
          _pv.multiplyScalar(1 / dist);
          const semi = Math.atan((ACERC.ancho / 2) / dist);           // semiángulo del otro panel
          if (enRegionConcava(_pv, semi, P.OCULTAR_MARGEN)) oculta = 0;
        }
      } else if (P.OCULTAR_SOLAPADOS && p.mesh) {
        p.mesh.getWorldPosition(_pv).sub(ACERC.camPos0);
        const z = _pv.dot(ACERC.fwd0);
        // solo los que están a la profundidad del conjunto o delante (los de atrás quedan tapados y dan espacio)
        if (z > 0.1 && z < L.d + P.OCULTAR_PROF_M) {
          const xn = _pv.dot(_right) / (z * t * aspect);
          const yn = _pv.dot(ACERC.up0) / (z * t);
          // semitamaño del otro panel en pantalla (aprox. con su ancho/alto a esa distancia)
          const pw = (ACERC.ancho / 2) / (z * t * aspect), ph = (ACERC.alto / 2) / (z * t);
          if (Math.abs(xn) < bx + pw + P.OCULTAR_MARGEN && Math.abs(yn) < by + ph + P.OCULTAR_MARGEN) oculta = 0;
        }
      }
    }
    p.oculta += (oculta - p.oculta) * k;
    if (Math.abs(p.oculta - oculta) < 0.002) p.oculta = oculta;
    if (p.uAtenua) {
      p.uAtenua.value += (atenua - p.uAtenua.value) * k;
      if (Math.abs(p.uAtenua.value - atenua) < 0.002) p.uAtenua.value = atenua;
    }
  }
}
