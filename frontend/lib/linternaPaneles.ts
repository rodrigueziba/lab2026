// Z2: linterna del usuario sobre los paneles SILLAS.
// Sin luces nuevas (cambiar la cantidad de luces recompila materiales): la "luz" es un
// test de cono entre el forward de la cámara y la dirección a cada panel, y se aplica
// en el shader del panel con el uniform uLit.
// Registro de paneles + máquina de selección. Objetos de módulo mutables, sin
// allocations por frame (vectores reutilizados).

import * as THREE from "three";
import { DBG_LINTERNA } from "@/lib/debugConfig";

export interface PanelLinterna {
  pivot:    THREE.Object3D | null;   // grupo que gira con la fase propia del panel
  mesh:     THREE.Object3D | null;   // plano del panel (para su centro en mundo)
  uLit:     { value: number };       // uniform del shader del panel
  fase:     number;                  // ángulo de órbita propio (rad), se congela con la luz
  velocidad: number;                 // rad por frame a 60 fps (misma escala que antes)
  azimut:   number;                  // ángulo base del anillo
  indice:   number;
  titulo:   string;
  url:      string | null;
  angulo:   number;                  // último ángulo al centro del cono (grados)
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
};

export const PANELES_LINTERNA: PanelLinterna[] = [];

export function registrarPanelLinterna(p: PanelLinterna): () => void {
  PANELES_LINTERNA.push(p);
  return () => {
    const i = PANELES_LINTERNA.indexOf(p);
    if (i >= 0) PANELES_LINTERNA.splice(i, 1);
    if (LINTERNA_STATE.sel === p) soltar();
    if (LINTERNA_STATE.marco === p) LINTERNA_STATE.marco = null;
  };
}

// ── eventos para Z4 (subpaneles) ──────────────────────────────────────────────
// alight:panel-abierto  { indice, titulo, url }  → tras ABRIR_MS de luz sostenida
// alight:panel-cerrado  { indice }               → la luz deja el panel abierto o se apaga
function emitir(nombre: string, detail: object) {
  window.dispatchEvent(new CustomEvent(nombre, { detail }));
}

function soltar() {
  const s = LINTERNA_STATE;
  if (s.abiertoIdx >= 0) emitir("alight:panel-cerrado", { indice: s.abiertoIdx });
  s.sel = null; s.progreso = 0; s.abiertoIdx = -1;
  s.fase = s.apagada ? "inactiva" : "buscando";
}

/** Z2: apaga y limpia todo (alight:visualizer-activate). */
export function apagarLinterna(): void {
  LINTERNA_STATE.apagada = true;
  soltar();
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

const _fwd = new THREE.Vector3();
const _cam = new THREE.Vector3();
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
      if (orbitan) p.fase += p.velocidad * D.ORBITA_VEL_MULT * pasos;
      if (p.pivot) p.pivot.rotation.y = p.azimut + p.fase;
      p.uLit.value += (0 - p.uLit.value) * kLit;
    }
    s.selAlpha += (0 - s.selAlpha) * kSel;
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
  if (actual && actual.angulo > D.SALE_DEG) soltar();
  if (!s.sel && mejor) {
    s.sel = mejor; s.marco = mejor; s.tSel = now; s.progreso = 0; s.fase = "seleccionado";
  }
  if (!s.sel) s.fase = "buscando";

  // temporizador de apertura
  if (s.sel) {
    s.progreso = Math.min(1, (now - s.tSel) / Math.max(1, D.ABRIR_MS));
    if (s.progreso >= 1 && s.abiertoIdx < 0) {
      s.abiertoIdx = s.sel.indice;
      s.fase = "abierto";
      emitir("alight:panel-abierto", { indice: s.sel.indice, titulo: s.sel.titulo, url: s.sel.url });
    }
  }
  s.selAlpha += ((s.sel ? 1 : 0) - s.selAlpha) * kSel;

  // fase de órbita propia: el seleccionado no avanza; los demás siguen desde donde quedaron
  for (const p of PANELES_LINTERNA) {
    if (p !== s.sel) p.fase += p.velocidad * D.ORBITA_VEL_MULT * pasos;
    if (p.pivot) p.pivot.rotation.y = p.azimut + p.fase;
  }
}
