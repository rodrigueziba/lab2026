// Z19: estado de FOCO de un subpanel del domo esférico (HISTORIA / GALERÍA / FICHA).
// Lo maneja SubpanelesProyecto (dwell, salida, animación); lo leen linternaPaneles (cierre
// suspendido mientras hay foco) y PanelSelMarco (atenuación). Objeto de módulo, sin allocations.
//
// Geometría: todos los parches son esferas CENTRADAS EN EL OJO y la cámara está en el ojo,
// así que el radio no cambia el tamaño en pantalla (solo la profundidad: con FOCO_RADIO_M el
// parche en foco queda delante del resto en el pase de interfaz). El agrandado es angular.

import * as THREE from "three";
import { DBG_FOCO, DBG_SUBPANELES } from "@/lib/debugConfig";
import { visible } from "@/lib/subpanelLayout";

export type FocoId = "historia" | "galeria" | "ficha";
export type FocoFase = "nada" | "entrando" | "foco" | "saliendo";

export const FOCO = {
  id: null as FocoId | null,
  fase: "nada" as FocoFase,
  f: 0,                 // progreso 0–1 (lineal en el tiempo)
  fEase: 0,             // progreso con easing (lo que se aplica)
  t0: 0,                // inicio de la animación en curso
  tUltima: -1e9,        // última transición (cooldown)
  candidato: null as FocoId | null, tCand: 0,   // dwell
  tFuera: 0,            // salida con gracia
  atenua: 1,            // brillo del resto del conjunto (1 = normal)
  // objetivo en el marco capturado (rad / m)
  yaw: 0, pitch: 0, ancho: 0, alto: 0, R: 1.6,
  pct: 0,               // fracción de pantalla alcanzada (debug)
};

export function resetFoco(): void {
  FOCO.id = null; FOCO.fase = "nada"; FOCO.f = 0; FOCO.fEase = 0; FOCO.candidato = null; FOCO.tFuera = 0;
}

export function easingFoco(k: number): number { return -(Math.cos(Math.PI * k) - 1) / 2; } // in-out seno, sin rebote

// ── objetivo del foco ──────────────────────────────────────────────────────────
const _cR = new THREE.Vector3(), _cU = new THREE.Vector3(), _cF = new THREE.Vector3();
const _qc = new THREE.Quaternion();
/** Proyecta la dirección (yaw, pitch) del marco con la cámara actual (base en el marco). */
function proy(yaw: number, pitch: number, t: number, aspect: number, out: { x: number; y: number; ok: boolean }) {
  const cp = Math.cos(pitch);
  const dx = cp * Math.sin(yaw), dy = Math.sin(pitch), dz = -cp * Math.cos(yaw);
  const z = dx * _cF.x + dy * _cF.y + dz * _cF.z;
  out.ok = z > 1e-3;
  if (!out.ok) return;
  out.x = ((dx * _cR.x + dy * _cR.y + dz * _cR.z) / z) / (t * aspect);
  out.y = ((dx * _cU.x + dy * _cU.y + dz * _cU.z) / z) / t;
}
const _pr = { x: 0, y: 0, ok: false };
/** ¿El parche (centro, tamaño angular) entra con extensión ≤ frac y visible con margen + curvatura? */
function entra(yc: number, pc: number, w: number, h: number, t: number, aspect: number, curva: number, lim: number, frac: number): boolean {
  for (let i = 0; i <= 6; i++) {
    const fu = i / 6 - 0.5;
    for (let s = 0; s < 4; s++) {
      const yy = s < 2 ? yc + fu * w : yc + (s === 2 ? -0.5 : 0.5) * w;
      const pp = s < 2 ? pc + (s === 0 ? 0.5 : -0.5) * h : pc + fu * h;
      proy(yy, pp, t, aspect, _pr);
      if (!_pr.ok || Math.abs(_pr.x) > frac || Math.abs(_pr.y) > frac || !visible(_pr.x, _pr.y, curva, lim)) return false;
    }
  }
  return true;
}

/**
 * Calcula el objetivo del foco para un parche base (yc, pc, w, h en el marco), con la cámara
 * actual expresada en el marco (qCamEnMarco). Corre el centro hacia la mirada (fracción + tope)
 * y busca la mayor escala angular que entra en FOCO_PANTALLA (y en el encuadre con margen y
 * curvatura). Si a escala 1 no entrara, sigue más la mirada hasta que entre.
 */
export function calcularFocoObjetivo(
  yc: number, pc: number, w: number, h: number,
  qCamEnMarco: THREE.Quaternion, fovDeg: number, aspect: number, curva: number,
): void {
  const F = DBG_FOCO;
  const D2R = Math.PI / 180;
  const t = Math.tan(fovDeg * D2R / 2);
  _qc.copy(qCamEnMarco);
  _cR.set(1, 0, 0).applyQuaternion(_qc); _cU.set(0, 1, 0).applyQuaternion(_qc); _cF.set(0, 0, -1).applyQuaternion(_qc);
  const gy = Math.atan2(_cF.x, -_cF.z), gp = Math.asin(THREE.MathUtils.clamp(_cF.y, -1, 1));
  const lim = 1 - 2 * Math.min(0.3, Math.max(0, DBG_SUBPANELES.SUB_MARGEN_SEGURIDAD));
  const frac = THREE.MathUtils.clamp(F.FOCO_PANTALLA, 0.1, 1);
  const maxD = Math.max(0, F.FOCO_DESPL_MAX_DEG) * D2R;
  const angMax = Math.max(5, F.FOCO_ANG_MAX_DEG) * D2R;
  let seguir = THREE.MathUtils.clamp(F.FOCO_SEGUIR_MIRADA, 0, 1);
  let y = yc, p = pc, sMejor = 1;
  for (let intento = 0; intento < 8; intento++) {
    y = yc + THREE.MathUtils.clamp((gy - yc) * seguir, -maxD, maxD);
    p = pc + THREE.MathUtils.clamp((gp - pc) * seguir, -maxD, maxD);
    if (intento >= 4) { y = yc + (gy - yc) * seguir; p = pc + (gp - pc) * seguir; } // último recurso: sin tope
    const sMax = Math.max(1, angMax / Math.max(w, h));
    if (!entra(y, p, w, h, t, aspect, curva, lim, 1)) { seguir = Math.min(1, seguir + 0.25); continue; }
    // bisección de la escala angular
    let lo = 1, hi = sMax;
    if (entra(y, p, w * hi, h * hi, t, aspect, curva, lim, frac)) lo = hi;
    else for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (entra(y, p, w * mid, h * mid, t, aspect, curva, lim, frac)) lo = mid; else hi = mid;
    }
    sMejor = lo;
    break;
  }
  FOCO.yaw = y; FOCO.pitch = p; FOCO.ancho = w * sMejor; FOCO.alto = h * sMejor;
  FOCO.R = Math.max(0.3, F.FOCO_RADIO_M);
  // fracción de pantalla alcanzada (máx. de ancho y alto)
  let mx = 0, my = 0;
  for (let i = 0; i <= 6; i++) {
    const fu = i / 6 - 0.5;
    proy(y + fu * FOCO.ancho, p + 0.5 * FOCO.alto, t, aspect, _pr); if (_pr.ok) { mx = Math.max(mx, Math.abs(_pr.x)); my = Math.max(my, Math.abs(_pr.y)); }
    proy(y + fu * FOCO.ancho, p - 0.5 * FOCO.alto, t, aspect, _pr); if (_pr.ok) { mx = Math.max(mx, Math.abs(_pr.x)); my = Math.max(my, Math.abs(_pr.y)); }
    proy(y - 0.5 * FOCO.ancho, p + fu * FOCO.alto, t, aspect, _pr); if (_pr.ok) { mx = Math.max(mx, Math.abs(_pr.x)); my = Math.max(my, Math.abs(_pr.y)); }
    proy(y + 0.5 * FOCO.ancho, p + fu * FOCO.alto, t, aspect, _pr); if (_pr.ok) { mx = Math.max(mx, Math.abs(_pr.x)); my = Math.max(my, Math.abs(_pr.y)); }
  }
  FOCO.pct = Math.max(mx, my);
}
