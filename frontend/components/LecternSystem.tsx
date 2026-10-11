"use client";

// T3/T5/T6: Two chrome lecterns ±LECTERN_X from centre.
// Prompt B: full geometry/material/layout redesign.
// All onActivate callbacks preserved from original.

import { useEffect, useRef, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  STORE, INTERACT_STATE, storeNotify,
} from "@/lib/alightStore";
import {
  setVolume, setLP, setHP, setDistortion, setDelay, setReverb, setLFO,
  setSamplerLoop, nextTrack, prevTrack, initAudio, loadPlaylist, playTrack,
} from "@/lib/audioEngine";
import { DBG_LECTERNS } from "@/lib/debugConfig";
import { DBG_DOME_MAT } from "./FaceDome";

// ── Geometry constants ────────────────────────────────────────────────────────
export const LECTERN_X        = 1.3;       // ±m from tarima centre
export const LECTERN_PROMPT_M = 1.5;       // proximity to show "Tocar E"
const INTERACT_RANGE           = 1.8;      // kept for E-entry guard
const LECTERN_CAM_MS           = 600;      // camera fly-in duration
const LECTERN_APPEAR_DUR_MS    = 2_000;
const POINTERLOCK_RETRY_MS     = 1300;
const TARIMA_H_REF             = 0.267;

// Top plate
const PANEL_W   = DBG_LECTERNS.panelW;   // 1.20 m
const PANEL_D   = DBG_LECTERNS.panelD;   // 0.70 m
const PANEL_T   = 0.06;                  // thickness
const BEVEL     = 0.012;                 // chrome edge strip width

// Legs
const LEG_W     = 0.06;
const LEG_SEP   = 0.90;                  // centre-to-centre

// Tilt: front edge at FRONT_EDGE_H, rear edge higher
const TILT_DEG  = 20;
const TILT_RAD  = TILT_DEG * (Math.PI / 180);
const FRONT_EDGE_H = 0.95;              // height of front (user-facing) edge of top plate
// Bottom face of plate at front = FRONT_EDGE_H - TARIMA_H_REF (in local group Y)
const PLATE_FRONT_Y = FRONT_EDGE_H - TARIMA_H_REF;
// Leg height = distance from floor to the bottom-front of the plate
const LEG_H = PLATE_FRONT_Y;

// Yaw offset: additional inward rotation so the panel faces the user, not just centre
const LECTERN_YAW_OFFSET_DEG = 15;  // exposed in DBG_LECTERNS; geometry reload to apply
const LECTERN_YAW_OFFSET_RAD = LECTERN_YAW_OFFSET_DEG * (Math.PI / 180);

// Dark control panel inset inside the top plate surface
const CPANEL_W  = PANEL_W - 0.08;
const CPANEL_D  = PANEL_D - 0.08;
const CPANEL_T  = 0.003;

// ── envMap (PMREMGenerator, created once when first rendered) ─────────────────
let _envMap: THREE.Texture | null = null;
function getEnvMap(renderer: THREE.WebGLRenderer): THREE.Texture {
  if (_envMap) return _envMap;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const env = new RoomEnvironment();
  _envMap = pmrem.fromScene(env).texture;
  pmrem.dispose();
  env.dispose();
  return _envMap;
}

// ── Shared materials (created once, envMap set on first render) ───────────────
const CHROME_MAT = new THREE.MeshPhysicalMaterial({
  metalness: 1.0,
  roughness: 0.08,
  color: "#d0d0d8",
  envMapIntensity: 1.2,
});
const PANEL_BG_MAT = new THREE.MeshStandardMaterial({
  color: "#111118",
  roughness: 0.85,
  metalness: 0.15,
});
const CPANEL_MAT = new THREE.MeshStandardMaterial({
  color: "#0a0a10",
  roughness: 0.90,
  metalness: 0.05,
});
const TRACK_MAT = new THREE.MeshStandardMaterial({
  color: "#1a1a24",
  roughness: 0.9,
});
const THUMB_MAT = new THREE.MeshPhysicalMaterial({
  color: "#b8b8cc",
  metalness: 0.92,
  roughness: 0.08,
  envMapIntensity: 0.8,
});
const KNOB_BODY_MAT = new THREE.MeshStandardMaterial({
  color: "#181820",
  roughness: 0.5,
  metalness: 0.85,
});

// Per-button material (cloned per instance so emissive can differ)
function makeBtnMat(color: "green" | "amber" | "chrome" | "blue"): THREE.MeshStandardMaterial {
  const cols: Record<string, [string, string]> = {
    green:  ["#003318", "#00ff55"],
    amber:  ["#2a1800", "#ff8c00"],
    chrome: ["#1a1a28", "#8080b0"],
    blue:   ["#001830", "#0088ff"],
  };
  const [off, on] = cols[color] ?? cols.chrome;
  return new THREE.MeshStandardMaterial({
    color: off,
    roughness: 0.55,
    emissive: new THREE.Color(on),
    emissiveIntensity: 0,
  });
}

// ── Canvas label texture ──────────────────────────────────────────────────────
const _labelCache = new Map<string, THREE.CanvasTexture>();
function labelTex(text: string): THREE.CanvasTexture {
  if (_labelCache.has(text)) return _labelCache.get(text)!;
  const cv = document.createElement("canvas");
  cv.width = 128; cv.height = 40;
  const ctx = cv.getContext("2d")!;
  ctx.clearRect(0, 0, 128, 40);
  ctx.fillStyle = "#aaaacc";
  ctx.font = "bold 22px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.toUpperCase(), 64, 22);
  const tex = new THREE.CanvasTexture(cv);
  _labelCache.set(text, tex);
  return tex;
}

// ── Keycap texture ────────────────────────────────────────────────────────────
const _keycapCache = new Map<string, THREE.CanvasTexture>();
function keycapTex(letter: string): THREE.CanvasTexture {
  if (_keycapCache.has(letter)) return _keycapCache.get(letter)!;
  const cv = document.createElement("canvas");
  cv.width = 64; cv.height = 64;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#dde0f8";
  ctx.beginPath();
  ctx.roundRect(4, 4, 56, 52, 7);
  ctx.fill();
  ctx.fillStyle = "#001028";
  ctx.font = "bold 34px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter.toUpperCase(), 32, 33);
  const tex = new THREE.CanvasTexture(cv);
  _keycapCache.set(letter, tex);
  return tex;
}

// ── Zone title texture ────────────────────────────────────────────────────────
function zoneTitleTex(text: string): THREE.CanvasTexture {
  const key = `zt:${text}`;
  if (_labelCache.has(key)) return _labelCache.get(key)!;
  const cv = document.createElement("canvas");
  cv.width = 192; cv.height = 32;
  const ctx = cv.getContext("2d")!;
  ctx.clearRect(0, 0, 192, 32);
  ctx.fillStyle = "rgba(170,170,200,0.55)";
  ctx.font = "bold 18px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.toUpperCase(), 96, 16);
  const tex = new THREE.CanvasTexture(cv);
  _labelCache.set(key, tex);
  return tex;
}

// ── Lights-indicator canvas draw ──────────────────────────────────────────────
function drawLightsIndicator(cv: HTMLCanvasElement, count: number): void {
  const ctx = cv.getContext("2d")!;
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = "#001530";
  ctx.beginPath();
  ctx.roundRect(2, 2, 60, 60, 8);
  ctx.fill();
  ctx.fillStyle = "#00ccff";
  ctx.font = "bold 34px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(count), 32, 32);
}

// ── E3: drag / hover module-level state ───────────────────────────────────────
const _drag = {
  type:      "none"  as "none" | "slider_h" | "slider_v" | "knob" | "btn",
  def:       null    as CtrlDef | null,
  plane:     new THREE.Plane(),
  railDir:   new THREE.Vector3(),
  railOrigin:new THREE.Vector3(),
  railLen:   0.28,
  kNorm0:    0,
  kx0:       0,
  ky0:       0,
  pointerId: -1,
  holdTimer: null    as ReturnType<typeof setInterval> | null,
};
let _hoveredId: string | null = null;
const HOVER_EMISSIVE_BONUS = 0.22;

function getCursorStyle(
  type: CtrlDef["type"] | "press" | "slide_h" | "slide_v" | "rotate",
): string {
  const P = "/cursors/";
  if (type === "button" || type === "toggle")
    return `url('${P}cursor-hand.svg') 8 2, pointer`;
  if (type === "slider")
    return `url('${P}cursor-hand-slider.svg') 8 2, pointer`;
  if (type === "knob")
    return `url('${P}cursor-hand-knob.svg') 8 2, pointer`;
  if (type === "press")
    return `url('${P}cursor-hand-press.svg') 8 4, pointer`;
  if (type === "slide_h")
    return `url('${P}cursor-slide-h.svg') 16 16, ew-resize`;
  if (type === "slide_v")
    return `url('${P}cursor-slide-v.svg') 16 16, ns-resize`;
  if (type === "rotate")
    return `url('${P}cursor-rotate.svg') 16 16, grab`;
  return "";
}

// ── Camera target computation ─────────────────────────────────────────────────
function computeLecternCamTarget(
  side: "left" | "right",
  _fovDeg: number,
  _aspect: number,
): { pos: [number,number,number]; quat: [number,number,number,number] } {
  const sign = side === "left" ? -1 : 1;
  const yaw  = sign * (Math.PI / 2 + LECTERN_YAW_OFFSET_RAD);

  // Lectern world matrix
  const lecternM = new THREE.Matrix4()
    .makeTranslation(sign * LECTERN_X, TARIMA_H_REF, 0)
    .multiply(new THREE.Matrix4().makeRotationY(yaw));

  // Plate surface centre (controls container origin)
  const plateM = lecternM.clone()
    .multiply(new THREE.Matrix4().makeTranslation(0, LEG_H, -PANEL_D / 2))
    .multiply(new THREE.Matrix4().makeRotationX(TILT_RAD))
    .multiply(new THREE.Matrix4().makeTranslation(0, PANEL_T + CPANEL_T, PANEL_D / 2));

  const plateCtr = new THREE.Vector3().applyMatrix4(plateM);

  // "User direction" = local -Z of lectern (toward user)
  const userDir = new THREE.Vector3(0, 0, -1).transformDirection(lecternM).normalize();

  // Horizontal distance to fit PANEL_W in 84% of horizontal FOV (8% margin each side)
  const fovR = DBG_LECTERNS.camFov * (Math.PI / 180);
  const D = (PANEL_W / 2) / (Math.tan(fovR / 2) * 0.84);

  // Camera position
  const H = DBG_LECTERNS.camHeight;
  const camPos = plateCtr.clone()
    .addScaledVector(userDir, D)
    .add(new THREE.Vector3(0, H, 0));

  // Look target: slightly above plate centre so dome fills top portion
  const lookAt = plateCtr.clone().add(new THREE.Vector3(0, DBG_LECTERNS.camLookUpM, 0));

  const lookM = new THREE.Matrix4().lookAt(camPos, lookAt, new THREE.Vector3(0, 1, 0));
  const q = new THREE.Quaternion().setFromRotationMatrix(lookM);

  return {
    pos:  [camPos.x, camPos.y, camPos.z],
    quat: [q.x, q.y, q.z, q.w],
  };
}

// ── Keyboard shortcut map (Z–M ↔ 7 random buttons per side) ──────────────────
const KEY_LETTERS = ["z","x","c","v","b","n","m"] as const;
type KeyLetter = typeof KEY_LETTERS[number];
let _keyMap    = new Map<KeyLetter, string>();  // letter → controlId
let _keyMapSide: "left" | "right" | null = null;
let _keySeed   = Math.floor(Math.random() * 0xffff);

function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 0x100000000; };
}

export function reshuffleKeys() {
  _keySeed = Math.floor(Math.random() * 0xffff);
}

function buildKeyMap(side: "left" | "right") {
  if (_keyMapSide === side) return;  // already built for this side
  _keyMapSide = side;
  const controls = side === "left" ? IMAGE_CONTROLS : SOUND_CONTROLS;
  const btns = controls.filter(c => c.type === "button" || c.type === "toggle");
  const rng  = seededRand(_keySeed + (side === "left" ? 0 : 1000));
  const idxs = btns.map((_, i) => i).sort(() => rng() - 0.5).slice(0, KEY_LETTERS.length);
  _keyMap.clear();
  KEY_LETTERS.forEach((letter, i) => {
    if (idxs[i] !== undefined) _keyMap.set(letter, btns[idxs[i]].id);
  });
}

// ── Control state ─────────────────────────────────────────────────────────────
interface CtrlDef {
  id: string;
  type: "button" | "toggle" | "slider" | "knob" | "indicator";
  label: string;
  // surface coords (m): u = right, v = toward user, origin at plate centre
  px: number;  // u
  py: number;  // v
  railLen?: number;
  orientation?: "h" | "v";  // slider axis; "h" default (along u), "v" along v
  color?: "green" | "amber" | "chrome" | "blue";
  min: number;
  max: number;
  initial: number;
  onActivate: (v: number) => void;
}

const ctrlState: Record<string, number> = {};
function ctrlVal(id: string, def: number): number { return ctrlState[id] ?? def; }
function setCtrl(id: string, v: number, def: CtrlDef) {
  ctrlState[id] = Math.max(def.min, Math.min(def.max, v));
  def.onActivate(ctrlState[id]);
  storeNotify();
}

// ── Single control mesh constants (must precede validateLayout + controls arrays) ─
const BTN_R     = 0.030;
const BTN_H     = 0.015;
const KNOB_R    = 0.035;
const KNOB_H    = 0.030;
const NOTCH_R   = 0.007;
const THUMB_W   = 0.070;
const THUMB_D   = 0.040;
const THUMB_H   = 0.030;
const HIT_PAD   = 1.30;
const LBL_AHEAD = 0.055;
const LBL_H     = 0.016;
const LBL_W     = 0.100;

// ── Dev-only layout validation ─────────────────────────────────────────────────
function validateLayout(controls: CtrlDef[]) {
  if (process.env.NODE_ENV !== "development") return;
  const U_MAX = 0.60; const V_MAX = 0.32;
  const BTN_PAD = BTN_R * HIT_PAD; const KNOB_PAD = KNOB_R * HIT_PAD;
  for (const c of controls) {
    if (c.type === "indicator") continue;
    const uHalf = c.type === "slider" && c.orientation !== "v" ? (c.railLen ?? 0.28) / 2
                : c.type === "knob" ? KNOB_PAD : BTN_PAD;
    const vHalf = c.type === "slider" && c.orientation === "v" ? (c.railLen ?? 0.28) / 2
                : c.type === "knob" ? KNOB_PAD : BTN_PAD;
    if (Math.abs(c.px) + uHalf > U_MAX) console.warn(`[lectern] u-bounds: "${c.id}"`);
    if (Math.abs(c.py) + vHalf > V_MAX) console.warn(`[lectern] v-bounds: "${c.id}"`);
  }
  for (let i = 0; i < controls.length; i++) {
    for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i]; const b = controls[j];
      if (a.type === "indicator" || b.type === "indicator") continue;
      if (Math.abs(a.px - b.px) < 0.060 && Math.abs(a.py - b.py) < 0.060)
        console.warn(`[lectern] overlap: "${a.id}" ↔ "${b.id}"`);
    }
  }
}

// ── IMAGE (left) controls  ────────────────────────────────────────────────────
// Zones: FILTROS (u -0.60…-0.30) | CÁMARA (u -0.26…+0.26) | LUCES (u +0.30…+0.60)

let _domeEffIdx = 0;
const N_EFF = 7;

const IMAGE_CONTROLS: CtrlDef[] = [
  // ── FILTROS ─────────────────────────────────────────────────────────────────
  { id: "dom_onoff", type: "toggle", label: "ON/OFF",     color: "green", px: -0.54, py: -0.22,
    min: 0, max: 1, initial: 1,
    onActivate: (v) => { STORE.dome.sectorEnabled = STORE.dome.sectorEnabled.map(() => v > 0.5); storeNotify(); } },
  { id: "psych",     type: "toggle", label: "PSICO",      color: "amber", px: -0.44, py: -0.22,
    min: 0, max: 1, initial: 0, onActivate: (v) => { STORE.dome.psychedelic   = v > 0.5; } },
  { id: "reactive",  type: "toggle", label: "REACTIVO",   color: "amber", px: -0.34, py: -0.22,
    min: 0, max: 1, initial: 0, onActivate: (v) => { STORE.dome.reactiveAudio = v > 0.5; } },
  { id: "dom_int",   type: "knob",   label: "INTENS.",    px: -0.50, py: -0.02,
    min: 0, max: 3, initial: 1, onActivate: (v) => { STORE.lights.globalIntensity = v; storeNotify(); } },
  { id: "dom_speed", type: "knob",   label: "VELOC.",     px: -0.38, py: -0.02,
    min: 0.2, max: 4, initial: 1, onActivate: (v) => { STORE.dome.globalSpeed = v; } },
  { id: "dom_nxt",   type: "button", label: "SIG.EFECTO", color: "blue", px: -0.44, py: 0.20,
    min: 0, max: 1, initial: 0,
    onActivate: () => {
      _domeEffIdx = (_domeEffIdx + 1) % N_EFF;
      for (let i = 0; i < N_EFF; i++) {
        if (DBG_DOME_MAT.value) DBG_DOME_MAT.value.uniforms[`uE${i}`].value = _domeEffIdx;
      }
    } },
  // ── CÁMARA ──────────────────────────────────────────────────────────────────
  { id: "cam_fov",  type: "slider", label: "FOV",    orientation: "v", railLen: 0.28, px: -0.19, py: -0.02,
    min: 50, max: 120, initial: 90, onActivate: (v) => { STORE.cam.fov = v; } },
  { id: "wcam_br",  type: "slider", label: "BRILLO", orientation: "v", railLen: 0.28, px: -0.095, py: -0.02,
    min: 0, max: 2, initial: 1, onActivate: (v) => { STORE.webcam.brightness = v; } },
  { id: "wcam_ct",  type: "slider", label: "CONTR.", orientation: "v", railLen: 0.28, px:  0,     py: -0.02,
    min: 0, max: 2, initial: 1, onActivate: (v) => { STORE.webcam.contrast   = v; } },
  { id: "wcam_sa",  type: "slider", label: "SATUR.", orientation: "v", railLen: 0.28, px:  0.095, py: -0.02,
    min: 0, max: 2, initial: 1, onActivate: (v) => { STORE.webcam.saturation = v; } },
  { id: "wcam_zm",  type: "slider", label: "ZOOM",   orientation: "v", railLen: 0.28, px:  0.19,  py: -0.02,
    min: 1, max: 3, initial: 1, onActivate: (v) => { STORE.webcam.zoom = v; } },
  // ── LUCES ────────────────────────────────────────────────────────────────────
  { id: "dom_minus", type: "button", label: "-",          color: "green", px:  0.34, py: -0.22,
    min: 0, max: 1, initial: 0, onActivate: () => { STORE.dome.globalSpeed = Math.max(0.2, STORE.dome.globalSpeed - 0.5); } },
  { id: "dom_plus",  type: "button", label: "+",          color: "green", px:  0.44, py: -0.22,
    min: 0, max: 1, initial: 0, onActivate: () => { STORE.dome.globalSpeed = Math.min(4, STORE.dome.globalSpeed + 0.5); } },
  { id: "dom_star",  type: "button", label: "*",          color: "blue",  px:  0.54, py: -0.22,
    min: 0, max: 1, initial: 0,
    onActivate: () => {
      const anyOff = STORE.dome.sectorEnabled.some(e => !e);
      STORE.dome.sectorEnabled = STORE.dome.sectorEnabled.map(() => anyOff);
      storeNotify();
    } },
  { id: "lights_ind", type: "indicator", label: "LUCES", px: 0.44, py: -0.02,
    min: 0, max: 12, initial: 0, onActivate: () => {} },
] as CtrlDef[];

// ── SOUND (right) controls  ───────────────────────────────────────────────────
// Zones: FILTROS (u -0.60…-0.30) | EFECTOS (u -0.26…+0.26) | SAMPLER (u +0.30…+0.60)

const SOUND_CONTROLS: CtrlDef[] = [
  // ── FILTROS ─────────────────────────────────────────────────────────────────
  { id: "s_lp_on",  type: "toggle", label: "P.BAJOS",   color: "green", px: -0.50, py: -0.22,
    min: 0, max: 1, initial: 0, onActivate: (v) => setLP(v > 0.5, ctrlVal("s_lp_fr", 8000)) },
  { id: "s_hp_on",  type: "toggle", label: "P.ALTOS",   color: "green", px: -0.38, py: -0.22,
    min: 0, max: 1, initial: 0, onActivate: (v) => setHP(v > 0.5, ctrlVal("s_hp_fr", 200)) },
  { id: "s_lp_fr",  type: "knob",   label: "CORTE LP",  px: -0.50, py: -0.02,
    min: 200, max: 20000, initial: 8000, onActivate: (v) => setLP(ctrlVal("s_lp_on", 0) > 0.5, v) },
  { id: "s_hp_fr",  type: "knob",   label: "CORTE HP",  px: -0.38, py: -0.02,
    min: 20, max: 4000, initial: 200,   onActivate: (v) => setHP(ctrlVal("s_hp_on", 0) > 0.5, v) },
  // ── EFECTOS ─────────────────────────────────────────────────────────────────
  { id: "s_dist",   type: "knob",   label: "DISTORS.",  px: -0.18, py: -0.20,
    min: 0, max: 1, initial: 0, onActivate: setDistortion },
  { id: "s_dlyA",   type: "knob",   label: "ECO",       px:  0.00, py: -0.20,
    min: 0, max: 1, initial: 0, onActivate: (v) => setDelay(v, 0.3) },
  { id: "s_rev",    type: "knob",   label: "REVERB",    px:  0.18, py: -0.20,
    min: 0, max: 1, initial: 0, onActivate: setReverb },
  { id: "s_lfo_wf", type: "toggle", label: "ONDA",      color: "amber", px: -0.23, py: 0.02,
    min: 0, max: 1, initial: 0, onActivate: () => {} },
  { id: "s_lfo_sp", type: "knob",   label: "LFO VEL.",  px: -0.09, py: 0.02,
    min: 0.1, max: 20, initial: 2,
    onActivate: (v) => setLFO(v, ctrlVal("s_lfo_dp", 0), ctrlVal("s_lfo_wf", 0) < 0.5 ? "sine" : "square", ctrlVal("s_lfo_tg", 0) < 0.5 ? "volume" : "cutoff") },
  { id: "s_lfo_dp", type: "knob",   label: "LFO PROF.", px:  0.09, py: 0.02,
    min: 0, max: 0.5, initial: 0,
    onActivate: (v) => setLFO(ctrlVal("s_lfo_sp", 2), v, ctrlVal("s_lfo_wf", 0) < 0.5 ? "sine" : "square", ctrlVal("s_lfo_tg", 0) < 0.5 ? "volume" : "cutoff") },
  { id: "s_lfo_tg", type: "toggle", label: "DESTINO",   color: "amber", px:  0.23, py: 0.02,
    min: 0, max: 1, initial: 0, onActivate: () => {} },
  // ── SAMPLER ─────────────────────────────────────────────────────────────────
  { id: "s_sam_in",  type: "button", label: "INICIO", color: "green",  px:  0.34, py: -0.22,
    min: 0, max: 1, initial: 0,
    onActivate: () => {
      const el = document.querySelector("audio");
      if (el) { ctrlState["s_sam_in_v"] = el.currentTime; setSamplerLoop(el.currentTime, ctrlVal("s_sam_out_v", -1), ctrlVal("s_sam_lp", 0) > 0.5); }
    } },
  { id: "s_sam_out", type: "button", label: "FIN",    color: "green",  px:  0.44, py: -0.22,
    min: 0, max: 1, initial: 0,
    onActivate: () => {
      const el = document.querySelector("audio");
      if (el) { ctrlState["s_sam_out_v"] = el.currentTime; setSamplerLoop(ctrlVal("s_sam_in_v", 0), el.currentTime, ctrlVal("s_sam_lp", 0) > 0.5); }
    } },
  { id: "s_sam_lp",  type: "toggle", label: "LOOP",   color: "amber", px:  0.54, py: -0.22,
    min: 0, max: 1, initial: 0,
    onActivate: (v) => setSamplerLoop(ctrlVal("s_sam_in_v", 0), ctrlVal("s_sam_out_v", -1), v > 0.5) },
  { id: "s_sam_cl",  type: "button", label: "BORRAR", color: "amber", px:  0.34, py: -0.04,
    min: 0, max: 1, initial: 0, onActivate: () => setSamplerLoop(0, -1, false) },
  { id: "s_prev",    type: "button", label: "ANT.",   color: "chrome", px:  0.44, py: -0.04,
    min: 0, max: 1, initial: 0, onActivate: () => prevTrack() },
  { id: "s_next",    type: "button", label: "SIG.",   color: "chrome", px:  0.54, py: -0.04,
    min: 0, max: 1, initial: 0, onActivate: () => nextTrack() },
  { id: "s_vol",     type: "slider", label: "VOLUMEN", orientation: "h", railLen: 0.48, px: 0, py: 0.24,
    min: 0, max: 1, initial: 0.8, onActivate: setVolume },
] as CtrlDef[];

// Validate on module load (dev only)
validateLayout(IMAGE_CONTROLS);
validateLayout(SOUND_CONTROLS);

// Initialise defaults
[...IMAGE_CONTROLS, ...SOUND_CONTROLS].forEach(c => { ctrlState[c.id] = c.initial; });

// ── Single control mesh ───────────────────────────────────────────────────────
function CtrlMesh({
  def, meshesRef, keyLetter,
}: {
  def: CtrlDef;
  meshesRef: React.MutableRefObject<THREE.Mesh[]>;
  keyLetter?: string;
}) {
  const mat          = useMemo(() => makeBtnMat(def.color ?? "chrome"), [def.color]);
  const indMat       = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }), []);
  const ctrlRef      = useRef<THREE.Mesh>(null);
  const hitRef       = useRef<THREE.Mesh>(null);
  const dotRef       = useRef<THREE.Mesh>(null);
  const indCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const indTexRef    = useRef<THREE.CanvasTexture | null>(null);
  const indLastVal   = useRef(-99);

  const register = (mesh: THREE.Mesh | null) => {
    if (!mesh || meshesRef.current.includes(mesh)) return;
    mesh.userData.controlId   = def.id;
    mesh.userData.controlType = def.type;
    mesh.userData.controlDef  = def;
    meshesRef.current.push(mesh);
  };

  useEffect(() => {
    if (def.type !== "indicator") return;
    const cv = document.createElement("canvas");
    cv.width = 64; cv.height = 64;
    const tex = new THREE.CanvasTexture(cv);
    indCanvasRef.current = cv;
    indTexRef.current = tex;
    drawLightsIndicator(cv, 0);
    indMat.map = tex;
    indMat.needsUpdate = true;
    return () => { tex.dispose(); };
  }, [def.type, indMat]);

  const emi = DBG_LECTERNS.emissiveBrightness;

  useFrame(() => {
    if (def.type === "indicator") {
      const count = STORE.lights.extras.length;
      if (count !== indLastVal.current && indCanvasRef.current && indTexRef.current) {
        indLastVal.current = count;
        drawLightsIndicator(indCanvasRef.current, count);
        indTexRef.current.needsUpdate = true;
      }
      return;
    }
    if (!ctrlRef.current) return;
    const v    = ctrlVal(def.id, def.initial);
    const norm = (v - def.min) / Math.max(0.001, def.max - def.min);

    if (def.type === "toggle" || def.type === "button") {
      const on = v > 0.5;
      const m  = ctrlRef.current.material as THREE.MeshStandardMaterial;
      const cols: Record<string, [string, string]> = {
        green:  ["#003318", "#00ff55"],
        amber:  ["#2a1800", "#ff8c00"],
        chrome: ["#1a1a28", "#8080b0"],
        blue:   ["#001830", "#0088ff"],
      };
      const [off, on_c] = cols[def.color ?? "chrome"];
      m.color.set(on ? on_c : off);
      const hovered = _hoveredId === def.id;
      m.emissiveIntensity = (on ? emi : 0) + (hovered && !on ? HOVER_EMISSIVE_BONUS : 0);
      m.emissive.set(on_c);
      ctrlRef.current.position.y = (def.type === "button" && on) ? BTN_H * 0.3 : BTN_H;
    } else if (def.type === "slider") {
      const rail = def.railLen ?? 0.28;
      if (def.orientation === "v") {
        // z = +rail/2 → norm 0 (back/low-v), z = -rail/2 → norm 1 (front/high-v)
        ctrlRef.current.position.z = rail / 2 - norm * rail;
      } else {
        ctrlRef.current.position.x = -rail / 2 + norm * rail;
      }
    } else if (def.type === "knob") {
      if (dotRef.current) {
        const angle = norm * Math.PI * 2.6 - Math.PI * 1.3;
        dotRef.current.position.x = Math.sin(angle) * (KNOB_R - NOTCH_R * 0.5);
        dotRef.current.position.z = Math.cos(angle) * (KNOB_R - NOTCH_R * 0.5);
      }
    }
  });

  const surfY = CPANEL_T + 0.001;
  // Labels lie flat on plate (rotation [π/2,0,0]) and face user.
  // All controls: label 0.055 toward user (-z). Horizontal slider: label behind (+z).
  const lblZ = (def.type === "slider" && def.orientation !== "v") ? LBL_AHEAD : -LBL_AHEAD;
  const LBL_ROT = [Math.PI / 2, 0, 0] as [number, number, number];

  // ── Indicator ──────────────────────────────────────────────────────────────
  if (def.type === "indicator") {
    return (
      <group position={[def.px, surfY, -def.py]}>
        <mesh>
          <planeGeometry args={[0.055, 0.055]} />
          <primitive object={indMat} attach="material" />
        </mesh>
        <mesh position={[0, 0.001, lblZ]} rotation={LBL_ROT}>
          <planeGeometry args={[LBL_W, LBL_H]} />
          <meshBasicMaterial map={labelTex(def.label)} transparent alphaTest={0.05} depthWrite={false} />
        </mesh>
      </group>
    );
  }

  // ── Vertical slider ────────────────────────────────────────────────────────
  if (def.type === "slider" && def.orientation === "v") {
    const rail = def.railLen ?? 0.28;
    return (
      <group position={[def.px, surfY, -def.py]}>
        <mesh>
          <boxGeometry args={[0.007, 0.007, rail]} />
          <primitive object={TRACK_MAT} attach="material" />
        </mesh>
        <mesh ref={m => { ctrlRef.current = m!; register(m); }} position={[0, 0.008, 0]}>
          <boxGeometry args={[THUMB_D, THUMB_H, THUMB_W]} />
          <primitive object={THUMB_MAT} attach="material" />
        </mesh>
        <mesh ref={m => { hitRef.current = m!; register(m); }} position={[0, 0.008, 0]} visible={false}>
          <boxGeometry args={[THUMB_D * HIT_PAD, THUMB_H * HIT_PAD, THUMB_W * HIT_PAD]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
        <mesh position={[0, 0.001, lblZ]} rotation={LBL_ROT}>
          <planeGeometry args={[LBL_W, LBL_H]} />
          <meshBasicMaterial map={labelTex(def.label)} transparent alphaTest={0.05} depthWrite={false} />
        </mesh>
      </group>
    );
  }

  // ── Horizontal slider ──────────────────────────────────────────────────────
  if (def.type === "slider") {
    const rail = def.railLen ?? 0.28;
    return (
      <group position={[def.px, surfY, -def.py]}>
        <mesh>
          <boxGeometry args={[rail, 0.007, 0.018]} />
          <primitive object={TRACK_MAT} attach="material" />
        </mesh>
        <mesh ref={m => { ctrlRef.current = m!; register(m); }} position={[0, 0.008, 0]}>
          <boxGeometry args={[THUMB_W, THUMB_H, THUMB_D]} />
          <primitive object={THUMB_MAT} attach="material" />
        </mesh>
        <mesh ref={m => { hitRef.current = m!; register(m); }} position={[0, 0.008, 0]} visible={false}>
          <boxGeometry args={[THUMB_W * HIT_PAD, THUMB_H * HIT_PAD, THUMB_D * HIT_PAD]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
        <mesh position={[0, 0.001, lblZ]} rotation={LBL_ROT}>
          <planeGeometry args={[LBL_W, LBL_H]} />
          <meshBasicMaterial map={labelTex(def.label)} transparent alphaTest={0.05} depthWrite={false} />
        </mesh>
      </group>
    );
  }

  // ── Knob ───────────────────────────────────────────────────────────────────
  if (def.type === "knob") {
    return (
      <group position={[def.px, surfY, -def.py]}>
        <mesh>
          <cylinderGeometry args={[KNOB_R, KNOB_R * 1.08, KNOB_H, 24]} />
          <primitive object={KNOB_BODY_MAT} attach="material" />
        </mesh>
        <mesh position={[0, KNOB_H * 0.28, 0]}>
          <torusGeometry args={[KNOB_R + 0.002, 0.0045, 4, 26]} />
          <primitive object={CHROME_MAT} attach="material" />
        </mesh>
        <mesh ref={dotRef} position={[0, KNOB_H * 0.5 + NOTCH_R * 0.5, KNOB_R * 0.72]}>
          <sphereGeometry args={[NOTCH_R, 6, 6]} />
          <meshStandardMaterial color="#ffcc44" emissive="#ffcc44" emissiveIntensity={0.9} />
        </mesh>
        <mesh ref={m => { hitRef.current = m!; register(m); }} visible={false}>
          <cylinderGeometry args={[KNOB_R * HIT_PAD, KNOB_R * HIT_PAD, KNOB_H * HIT_PAD, 12]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
        <mesh position={[0, 0.001, lblZ]} rotation={LBL_ROT}>
          <planeGeometry args={[LBL_W, LBL_H]} />
          <meshBasicMaterial map={labelTex(def.label)} transparent alphaTest={0.05} depthWrite={false} />
        </mesh>
      </group>
    );
  }

  // ── Button / Toggle ────────────────────────────────────────────────────────
  return (
    <group position={[def.px, surfY, -def.py]}>
      <mesh ref={m => { ctrlRef.current = m!; register(m); }} position={[0, BTN_H, 0]}>
        <cylinderGeometry args={[BTN_R, BTN_R * 1.1, BTN_H * 2, 16]} />
        <primitive object={mat} attach="material" />
      </mesh>
      {/* single emissive ring — only for toggles (persistent state indicator) */}
      {def.type === "toggle" && (
        <mesh position={[0, 0.001, 0]}>
          <torusGeometry args={[BTN_R + 0.004, 0.003, 6, 24]} />
          <primitive object={mat} attach="material" />
        </mesh>
      )}
      <mesh ref={m => { hitRef.current = m!; register(m); }} position={[0, BTN_H, 0]} visible={false}>
        <cylinderGeometry args={[BTN_R * HIT_PAD, BTN_R * HIT_PAD, BTN_H * 2 * HIT_PAD, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      {/* label flat on plate, toward user */}
      <mesh position={[0, 0.001, lblZ]} rotation={LBL_ROT}>
        <planeGeometry args={[LBL_W, LBL_H]} />
        <meshBasicMaterial map={labelTex(def.label)} transparent alphaTest={0.05} depthWrite={false} />
      </mesh>
      {/* keycap: 0.025×0.025 flat, top-right corner of button */}
      {keyLetter && (
        <mesh position={[BTN_R + 0.0125, 0.001, -(BTN_R + 0.0125)]} rotation={LBL_ROT}>
          <planeGeometry args={[0.025, 0.025]} />
          <meshBasicMaterial map={keycapTex(keyLetter)} transparent alphaTest={0.05} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

// ── Lectern geometry ──────────────────────────────────────────────────────────
function LecternBody({ side }: { side: "left" | "right" }) {
  const { gl } = useThree();
  const sign   = side === "left" ? -1 : 1;

  useEffect(() => {
    const env = getEnvMap(gl);
    CHROME_MAT.envMap = env;
    CHROME_MAT.needsUpdate = true;
    THUMB_MAT.envMap = env;
    THUMB_MAT.needsUpdate = true;
  }, [gl]);

  return (
    <group>
      {/* ── Left leg ── */}
      <mesh position={[-LEG_SEP / 2, LEG_H / 2, 0]} castShadow>
        <boxGeometry args={[LEG_W, LEG_H, LEG_W]} />
        <primitive object={CHROME_MAT} attach="material" />
      </mesh>
      {/* ── Right leg ── */}
      <mesh position={[LEG_SEP / 2, LEG_H / 2, 0]} castShadow>
        <boxGeometry args={[LEG_W, LEG_H, LEG_W]} />
        <primitive object={CHROME_MAT} attach="material" />
      </mesh>

      {/* ── Top plate group: tilted, front (lower) edge toward user ──────── */}
      {/* Pivot at local -Z = front edge (user side); back (+Z) rises */}
      <group position={[0, LEG_H, -PANEL_D / 2]} rotation={[TILT_RAD, 0, 0]}>
        <group position={[0, PANEL_T / 2, PANEL_D / 2]}>
          {/* plate body */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[PANEL_W, PANEL_T, PANEL_D]} />
            <primitive object={PANEL_BG_MAT} attach="material" />
          </mesh>
          {/* chrome bevel: top perimeter strip */}
          <mesh position={[0, PANEL_T / 2 + BEVEL / 2, 0]}>
            <boxGeometry args={[PANEL_W + BEVEL * 2, BEVEL, PANEL_D + BEVEL * 2]} />
            <primitive object={CHROME_MAT} attach="material" />
          </mesh>
          {/* inset dark satin control panel */}
          <mesh position={[0, PANEL_T / 2 + CPANEL_T / 2 + 0.001, 0]}>
            <boxGeometry args={[CPANEL_W, CPANEL_T, CPANEL_D]} />
            <primitive object={CPANEL_MAT} attach="material" />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// ── Full lectern ──────────────────────────────────────────────────────────────
function Lectern({
  side, controls, appearProgress, keyVersion,
}: {
  side: "left" | "right";
  controls: CtrlDef[];
  appearProgress: React.MutableRefObject<number>;
  keyVersion: number;
}) {
  const groupRef  = useRef<THREE.Group>(null);
  const meshesRef = useRef<THREE.Mesh[]>([]);
  const sign      = side === "left" ? -1 : 1;
  const yaw       = sign * (Math.PI / 2 + LECTERN_YAW_OFFSET_RAD);

  useEffect(() => {
    const existing = (window as any).__lecternMeshes as THREE.Mesh[] | undefined;
    if (!existing) {
      (window as any).__lecternMeshes = meshesRef.current;
    } else {
      meshesRef.current.forEach(m => { if (!existing.includes(m)) existing.push(m); });
    }
  });

  useFrame(() => {
    if (!groupRef.current) return;
    const ease = 1 - Math.pow(1 - appearProgress.current, 3);
    groupRef.current.position.y = THREE.MathUtils.lerp(-1.6, 0, ease);
  });

  // Reverse lookup: controlId → keyLetter (only when this side is active)
  const idToKey = useMemo(() => {
    const m = new Map<string, string>();
    if (_keyMapSide === side) _keyMap.forEach((id, letter) => m.set(id, letter));
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, keyVersion]);

  return (
    <group ref={groupRef}>
      <group position={[sign * LECTERN_X, TARIMA_H_REF, 0]} rotation={[0, yaw, 0]}>
        <LecternBody side={side} />

        {/* SpotLight: above and slightly toward user (local -Z), aimed at plate centre */}
        <spotLight
          position={[0, 1.4, -0.5]}
          target-position={[0, 0.6, 0.1]}
          color="#f0f0ff"
          intensity={DBG_LECTERNS.lightIntensity}
          angle={0.28}
          penumbra={0.85}
          distance={2.2}
          castShadow={false}
        />

        {/* Controls + zone decorations — same tilt hierarchy as the plate */}
        <group position={[0, LEG_H, -PANEL_D / 2]} rotation={[TILT_RAD, 0, 0]}>
          <group position={[0, PANEL_T + CPANEL_T, PANEL_D / 2]}>
            {/* zone divider lines at u = ±0.28 */}
            {([-0.28, 0.28] as number[]).map(x => (
              <mesh key={x} position={[x, 0.001, 0]}>
                <boxGeometry args={[0.0015, 0.001, 0.64]} />
                <primitive object={CHROME_MAT} attach="material" />
              </mesh>
            ))}
            {/* zone titles at v = -0.30 (z = +0.30), low opacity */}
            {(side === "left"
              ? [[-0.45, "FILTROS"], [0, "CAMARA"], [0.45, "LUCES"]]
              : [[-0.45, "FILTROS"], [0, "EFECTOS"], [0.45, "SAMPLER"]]
            ).map(([u, title]) => (
              <mesh key={title as string} position={[u as number, 0.001, 0.30]}
                    rotation={[Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.12, 0.012]} />
                <meshBasicMaterial map={zoneTitleTex(title as string)} transparent alphaTest={0.05} depthWrite={false} />
              </mesh>
            ))}
            {controls.map(def => (
              <CtrlMesh
                key={def.id}
                def={def}
                meshesRef={meshesRef}
                keyLetter={idToKey.get(def.id)}
              />
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}

// ── InteractionHandler ────────────────────────────────────────────────────────
function InteractionHandler() {
  const { camera, gl } = useThree();
  const ndcRef  = useRef(new THREE.Vector2());
  const rafRef  = useRef(0);
  const lastPt  = useRef({ x: 0, y: 0 });
  const localRc = useRef(new THREE.Raycaster());

  // Preload cursor images to avoid flash on first hover
  useEffect(() => {
    ["cursor-hand","cursor-hand-slider","cursor-hand-knob",
     "cursor-hand-press","cursor-slide-h","cursor-slide-v","cursor-rotate",
    ].forEach(n => { const img = new Image(); img.src = `/cursors/${n}.svg`; });
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;

    function setNDC(clientX: number, clientY: number): THREE.Vector2 {
      const r = canvas.getBoundingClientRect();
      ndcRef.current.set(
        (clientX - r.left) / r.width  *  2 - 1,
        -((clientY - r.top)  / r.height) * 2 + 1,
      );
      INTERACT_STATE.mouseNDC.x = ndcRef.current.x;
      INTERACT_STATE.mouseNDC.y = ndcRef.current.y;
      return ndcRef.current;
    }

    function rayHit(ndc: THREE.Vector2): { mesh: THREE.Mesh; def: CtrlDef; point: THREE.Vector3 } | null {
      localRc.current.setFromCamera(ndc, camera);
      const meshes = (window as any).__lecternMeshes as THREE.Mesh[] | undefined;
      if (!meshes) return null;
      const hits = localRc.current.intersectObjects(meshes, false);
      if (!hits.length) return null;
      const def = hits[0].object.userData.controlDef as CtrlDef | undefined;
      if (!def || def.type === "indicator") return null;
      return { mesh: hits[0].object as THREE.Mesh, def, point: hits[0].point };
    }

    function doHover(clientX: number, clientY: number) {
      if (INTERACT_STATE.mode === "none") {
        if (_hoveredId !== null) { _hoveredId = null; canvas.style.cursor = ""; }
        return;
      }
      const ndc = setNDC(clientX, clientY);
      const hit = rayHit(ndc);
      const newId = hit?.def.id ?? null;
      if (newId !== _hoveredId) {
        _hoveredId = newId;
        canvas.style.cursor = hit ? getCursorStyle(hit.def.type) : "";
      }
    }

    function applySlider(def: CtrlDef, worldPt: THREE.Vector3) {
      const delta = worldPt.clone().sub(_drag.railOrigin);
      let proj = delta.dot(_drag.railDir);
      const half = _drag.railLen / 2;
      proj = Math.max(-half, Math.min(half, proj));
      setCtrl(def.id, def.min + (0.5 + proj / _drag.railLen) * (def.max - def.min), def);
    }

    const onPointerMove = (e: PointerEvent) => {
      lastPt.current = { x: e.clientX, y: e.clientY };

      if (_drag.type !== "none" && _drag.def && e.pointerId === _drag.pointerId) {
        const ndc = setNDC(e.clientX, e.clientY);
        if (_drag.type === "slider_h" || _drag.type === "slider_v") {
          localRc.current.setFromCamera(ndc, camera);
          const tgt = new THREE.Vector3();
          if (localRc.current.ray.intersectPlane(_drag.plane, tgt)) applySlider(_drag.def, tgt);
        } else if (_drag.type === "knob") {
          const dx = e.clientX - _drag.kx0;
          const dy = e.clientY - _drag.ky0;
          const diag = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);
          const delta = (dx - dy) / diag * DBG_LECTERNS.knobSens;
          const norm = Math.max(0, Math.min(1, _drag.kNorm0 + delta));
          setCtrl(_drag.def.id, _drag.def.min + norm * (_drag.def.max - _drag.def.min), _drag.def);
        }
        return;
      }

      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        doHover(lastPt.current.x, lastPt.current.y);
      });
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || INTERACT_STATE.mode === "none") return;
      const ndc = setNDC(e.clientX, e.clientY);
      const hit = rayHit(ndc);
      if (!hit) return;
      const { mesh, def, point } = hit;

      canvas.setPointerCapture(e.pointerId);
      _drag.pointerId = e.pointerId;
      _drag.def = def;

      if (def.type === "button" || def.type === "toggle") {
        _drag.type = "btn";
        if (def.type === "toggle") {
          setCtrl(def.id, ctrlVal(def.id, def.initial) > 0.5 ? 0 : 1, def);
        } else {
          setCtrl(def.id, 1, def);
          setTimeout(() => setCtrl(def.id, 0, def), 120);
          // Hold-repeat for ±-step buttons
          if (def.id === "dom_minus" || def.id === "dom_plus") {
            _drag.holdTimer = setInterval(() => {
              setCtrl(def.id, 1, def);
              setTimeout(() => setCtrl(def.id, 0, def), 60);
            }, 120);
          }
        }
        canvas.style.cursor = getCursorStyle("press");

      } else if (def.type === "slider") {
        const isV = def.orientation === "v";
        _drag.type = isV ? "slider_v" : "slider_h";
        // Plate plane from controls-container world matrix (mesh.parent.parent)
        const planeNorm = new THREE.Vector3(0, 1, 0)
          .transformDirection(mesh.parent!.parent!.matrixWorld).normalize();
        _drag.plane.setFromNormalAndCoplanarPoint(planeNorm, point);
        // Rail axis and origin
        if (isV) {
          _drag.railDir.set(0, 0, -1).transformDirection(mesh.parent!.matrixWorld).normalize();
        } else {
          _drag.railDir.set(1, 0, 0).transformDirection(mesh.parent!.matrixWorld).normalize();
        }
        _drag.railOrigin.setFromMatrixPosition(mesh.parent!.matrixWorld);
        _drag.railLen = def.railLen ?? 0.28;
        canvas.style.cursor = getCursorStyle(isV ? "slide_v" : "slide_h");
        applySlider(def, point);  // jump thumb to click position

      } else if (def.type === "knob") {
        _drag.type = "knob";
        const cur = ctrlVal(def.id, def.initial);
        _drag.kNorm0 = (cur - def.min) / Math.max(0.001, def.max - def.min);
        _drag.kx0 = e.clientX;
        _drag.ky0 = e.clientY;
        canvas.style.cursor = getCursorStyle("rotate");
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== _drag.pointerId) return;
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
      if (_drag.holdTimer) { clearInterval(_drag.holdTimer); _drag.holdTimer = null; }
      _drag.type = "none";
      _drag.def = null;
      _drag.pointerId = -1;
      doHover(e.clientX, e.clientY);
    };

    const onPointerLeave = () => {
      if (_drag.type === "none") { _hoveredId = null; canvas.style.cursor = ""; }
    };

    canvas.addEventListener("pointermove",  onPointerMove);
    canvas.addEventListener("pointerdown",  onPointerDown);
    canvas.addEventListener("pointerup",    onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    return () => {
      canvas.removeEventListener("pointermove",  onPointerMove);
      canvas.removeEventListener("pointerdown",  onPointerDown);
      canvas.removeEventListener("pointerup",    onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      if (_drag.holdTimer) { clearInterval(_drag.holdTimer); _drag.holdTimer = null; }
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [camera, gl]);

  return null;
}

// ── Pointer lock helper ────────────────────────────────────────────────────────
async function requestPointerLockSafe(
  canvas: HTMLElement,
  lockPendingRef: React.MutableRefObject<boolean>,
): Promise<void> {
  if (document.pointerLockElement === canvas || lockPendingRef.current) return;
  lockPendingRef.current = true;

  const attempt = (): Promise<boolean> =>
    new Promise(resolve => {
      try {
        const result = canvas.requestPointerLock();
        if (result instanceof Promise) {
          result.then(() => resolve(true)).catch(() => resolve(false));
        } else {
          const onOk  = () => { cleanup(); resolve(true);  };
          const onErr = () => { cleanup(); resolve(false); };
          const cleanup = () => {
            document.removeEventListener("pointerlockchange", onOk);
            document.removeEventListener("pointerlockerror",  onErr);
          };
          document.addEventListener("pointerlockchange", onOk,  { once: true });
          document.addEventListener("pointerlockerror",  onErr, { once: true });
          setTimeout(() => { cleanup(); resolve(document.pointerLockElement === canvas); }, 500);
        }
      } catch { resolve(false); }
    });

  const ok1 = await attempt();
  if (ok1) { lockPendingRef.current = false; return; }

  setTimeout(async () => {
    const ok2 = await attempt();
    lockPendingRef.current = false;
    if (!ok2) window.dispatchEvent(new CustomEvent("alight:pointerlock-failed"));
  }, POINTERLOCK_RETRY_MS);
}

// ── LecternSystem ─────────────────────────────────────────────────────────────
export default function LecternSystem() {
  const [visible, setVisible]       = useState(false);
  const [keyVersion, setKeyVersion] = useState(0);
  const appearProgress               = useRef(0);
  const appearStart                  = useRef(0);
  const audioStarted                 = useRef(false);
  const lockPendingRef               = useRef(false);
  const { camera }                   = useThree();

  useEffect(() => {
    const onDome = () => {
      setTimeout(() => {
        setVisible(true);
        appearStart.current = Date.now();
      }, DBG_LECTERNS.delayMs);
    };
    window.addEventListener("alight:dome-visible", onDome);
    return () => window.removeEventListener("alight:dome-visible", onDome);
  }, []);

  useEffect(() => {
    if (!visible || audioStarted.current) return;
    audioStarted.current = true;
    (async () => {
      await initAudio();
      try {
        const res  = await fetch("/api/music");
        const data = await res.json() as { tracks: string[] };
        loadPlaylist(data.tracks);
        if (data.tracks.length) await playTrack(0);
      } catch { /* audio optional */ }
    })();
  }, [visible]);

  useEffect(() => {
    const onErr = () => { lockPendingRef.current = false; };
    document.addEventListener("pointerlockerror", onErr);
    return () => document.removeEventListener("pointerlockerror", onErr);
  }, []);

  // Re-shuffle exposed to DebugMenu
  useEffect(() => {
    const onReshuffle = () => {
      reshuffleKeys();
      _keyMapSide = null; // force rebuild next buildKeyMap call
      setKeyVersion(v => v + 1);
    };
    window.addEventListener("alight:reshuffle-keys", onReshuffle);
    return () => window.removeEventListener("alight:reshuffle-keys", onReshuffle);
  }, []);

  useEffect(() => {
    const canvas = document.querySelector("canvas") as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const key = e.key.toLowerCase();

      // ── Enter lectern (E) ─────────────────────────────────────────────────
      if (key === "e" && INTERACT_STATE.mode === "none") {
        const leftPos  = new THREE.Vector3(-LECTERN_X, camera.position.y, 0);
        const rightPos = new THREE.Vector3( LECTERN_X, camera.position.y, 0);
        const dLeft    = camera.position.distanceTo(leftPos);
        const dRight   = camera.position.distanceTo(rightPos);
        let side: "left" | "right" | null = null;
        if (dLeft  < INTERACT_RANGE) side = "left";
        else if (dRight < INTERACT_RANGE) side = "right";
        if (!side) return;

        INTERACT_STATE.mode = side === "left" ? "image" : "sound";

        // Save camera
        const cam = camera as THREE.PerspectiveCamera;
        INTERACT_STATE.camSaved = {
          pos:  [cam.position.x, cam.position.y, cam.position.z],
          quat: [cam.quaternion.x, cam.quaternion.y, cam.quaternion.z, cam.quaternion.w],
        };
        // Compute target
        const aspect = window.innerWidth / window.innerHeight;
        const fov    = cam.isPerspectiveCamera ? cam.fov : STORE.cam.fov;
        INTERACT_STATE.camTarget      = computeLecternCamTarget(side, fov, aspect);
        INTERACT_STATE.camAnimStart   = Date.now();
        INTERACT_STATE.camAnimDur     = LECTERN_CAM_MS;
        INTERACT_STATE.camAnimReverse = false;
        INTERACT_STATE.camAnimActive  = true;

        // Build key map for this side
        buildKeyMap(side);
        setKeyVersion(v => v + 1);

        document.exitPointerLock();
        window.dispatchEvent(new CustomEvent("alight:lectern-mode", { detail: { mode: INTERACT_STATE.mode } }));
        return;
      }

      // ── Exit lectern (Q) ──────────────────────────────────────────────────
      if (key === "q" && INTERACT_STATE.mode !== "none") {
        INTERACT_STATE.mode           = "none";
        INTERACT_STATE.camAnimStart   = Date.now();
        INTERACT_STATE.camAnimDur     = LECTERN_CAM_MS;
        INTERACT_STATE.camAnimReverse = true;
        INTERACT_STATE.camAnimActive  = true;

        if (canvas) requestPointerLockSafe(canvas, lockPendingRef);
        window.dispatchEvent(new CustomEvent("alight:lectern-mode", { detail: { mode: "none" } }));
        return;
      }

      // ── Keyboard shortcuts Z–M (only inside lectern mode) ─────────────────
      if (INTERACT_STATE.mode === "none") return;
      if (!KEY_LETTERS.includes(key as KeyLetter)) return;
      const id = _keyMap.get(key as KeyLetter);
      if (!id) return;
      const allCtrl = [...IMAGE_CONTROLS, ...SOUND_CONTROLS];
      const def = allCtrl.find(c => c.id === id);
      if (!def) return;
      const cur = ctrlVal(id, def.initial);
      if (def.type === "button") {
        setCtrl(id, 1, def);
        setTimeout(() => setCtrl(id, 0, def), 120);
      } else if (def.type === "toggle") {
        setCtrl(id, cur > 0.5 ? 0 : 1, def);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [camera]);

  useFrame(() => {
    if (!visible || appearProgress.current >= 1) return;
    const elapsed = Date.now() - appearStart.current;
    appearProgress.current = Math.min(1, elapsed / LECTERN_APPEAR_DUR_MS);
  });

  if (!visible) return null;

  return (
    <>
      <Lectern side="left"  controls={IMAGE_CONTROLS} appearProgress={appearProgress} keyVersion={keyVersion} />
      <Lectern side="right" controls={SOUND_CONTROLS}  appearProgress={appearProgress} keyVersion={keyVersion} />
      <InteractionHandler />
    </>
  );
}
