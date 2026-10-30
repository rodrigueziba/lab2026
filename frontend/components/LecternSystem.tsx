"use client";

// T3/T5/T6: Two chrome lecterns ±LECTERN_X from centre.
// Prompt B: full geometry/material/layout redesign.
// All onActivate callbacks preserved from original.

import { useEffect, useRef, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  STORE, INTERACT_STATE, storeNotify, requestLecterns,
} from "@/lib/alightStore";
import type { OscType } from "@/lib/alightStore";
import {
  setVolume, setLP, setHP, setDistortion, setDelay, setReverb, setLFO,
  setPhaser, setPitch, setSamplerLoop,
  nextTrack, prevTrack, togglePlayPause, initAudio, loadPlaylist, playTrack,
  playUIClick,
} from "@/lib/audioEngine";
import { DBG_LECTERNS, DBG_RETRO, DBG_CAM_IMAGE, DBG_CAM_SOUND, LECTERNS_AFTER_PEOPLE_MS, LECTERN_OUTWARD_OFFSET_M } from "@/lib/debugConfig";
import { DBG_DOME_MAT } from "./FaceDome";
import { registerLecternMats, lecternPalette } from "@/lib/retro/lecternMaterials";
import { createCrtScreenMaterial, setScreenMap, RETRO_CRT } from "@/lib/retro/crtScreen";
import { LecternRearStrip, LecternApron } from "./retro/LecternRetroDressing";

// ── Geometry constants ────────────────────────────────────────────────────────
export const LECTERN_X        = 1.3;       // base ±m from tarima centre
export const LECTERN_PLACE_X  = LECTERN_X + LECTERN_OUTWARD_OFFSET_M; // actual placement ±m
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

// Yaw: atan2(toCenter.x, toCenter.z) + optional fine-tune offset (default 0)
const LECTERN_YAW_OFFSET_DEG = 0;
const LECTERN_YAW_OFFSET_RAD = LECTERN_YAW_OFFSET_DEG * (Math.PI / 180);

// Dark control panel inset: 0.05 chrome frame on each side → 0.10 total per axis
const CPANEL_W  = PANEL_W - 0.10;   // 1.20
const CPANEL_D  = PANEL_D - 0.10;   // 0.65
const CPANEL_T  = 0.003;
const OUTER_W        = PANEL_W + 0.10;    // 1.60 — nogal frame outer width
const OUTER_D        = PANEL_D + 0.10;    // 0.85 — nogal frame outer depth
const REAR_BAR_D     = 0.08;              // nogal rear bar depth along panel
const REAR_BAR_EXTRA = 0.04;              // rear bar extra height above plate surface
const SIDE_STRIP_W   = 0.008;             // silver side strip width

// Slider rail
const SLIDER_RAIL = 0.44;
const SLIDER_STEP = 0.044; // mark spacing (10 intervals)

// ── J3 grid constants ─────────────────────────────────────────────────────────
// Usable zone: u ∈ [-0.72, +0.72], v ∈ [-0.34, +0.34]  (u=right, v=toward user)
// Band A (back):  v ∈ [-0.34, -0.02]
// Band B (front): v ∈ [+0.02, +0.34]
const BAND_A_V_BACK  = -0.34;
const BAND_B_V_BACK  =  0.02;
const BAND_B_V_FRONT =  0.34;
const ROW1_V_A = BAND_A_V_BACK + 0.070;   // -0.270
const ROW2_V_A = BAND_A_V_BACK + 0.185;   // -0.155
const ROW1_V_B = BAND_B_V_BACK + 0.070;   // +0.090
const ROW2_V_B = BAND_B_V_BACK + 0.185;   // +0.205
const J3_COL_STEP   = 0.12;
const J3_SEC_MARGIN = 0.01;  // padding inside section on each side
const J3_SEC_GAP    = 0.03;  // gap between adjacent sections

// column-center u for column `col` within section starting at `secLeft`
const j3ColU = (secLeft: number, col: number) =>
  secLeft + J3_SEC_MARGIN + J3_COL_STEP * (col + 0.5);

interface SecDef {
  label:    string;
  subtitle?: string;
  band:     "A" | "B" | "AB";
  cols:     number;
  u_left:   number;
  u_right:  number;
}

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
  metalness: 1.0, roughness: 0.08, color: "#d0d0d8", envMapIntensity: 1.2,
});
// J2 — nogal frame (walnut)
const NOGAL_MAT = new THREE.MeshStandardMaterial({
  color: "#5b3a24", roughness: 0.55, metalness: 0.1,
});
// J2 — inner black carbon panel
const PANEL_BLACK_MAT = new THREE.MeshStandardMaterial({
  color: "#1a1a1a", roughness: 0.90, metalness: 0,
});
const CPANEL_MAT = new THREE.MeshStandardMaterial({
  color: "#0a0a10", roughness: 0.90, metalness: 0.05,
});
const TRACK_MAT = new THREE.MeshStandardMaterial({
  color: "#1a1a1a", roughness: 0.95, metalness: 0,
});
// J2 — slider thumb: black satin
const THUMB_MAT = new THREE.MeshStandardMaterial({
  color: "#0f0f0f", roughness: 0.55, metalness: 0.3,
});
// J2 — knob body: negro satinado
const KNOB_BODY_MAT = new THREE.MeshStandardMaterial({
  color: "#0f0f0f", roughness: 0.50, metalness: 0.3,
});
// J2 — silver side strips
const SILVER_STRIP_MAT = new THREE.MeshStandardMaterial({
  color: "#d9d9d9", roughness: 0.40, metalness: 0.7,
});
// J2 — knob mostaza (sound effects)
const KNOB_MUSTARD_MAT = new THREE.MeshStandardMaterial({
  color: "#e0b52a", roughness: 0.40, metalness: 0.1,
});
// J2 — pushbutton crema
const PUSHBTN_MAT = new THREE.MeshStandardMaterial({
  color: "#e8e2cf", roughness: 0.60, metalness: 0,
});
// J2 — rocker switch colours
const ROCKER_NARANJA_MAT  = new THREE.MeshStandardMaterial({ color: "#f26a1b", roughness: 0.5, metalness: 0.1 });
const ROCKER_TURQUESA_MAT = new THREE.MeshStandardMaterial({ color: "#27b3a8", roughness: 0.5, metalness: 0.1 });
const ROCKER_BASE_DARK_MAT = new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.80, metalness: 0 });
// J5 — shared silkscreen (scale marks, section frames, thumb line)
const SILK_MAT = new THREE.MeshStandardMaterial({ color: "#f1efe6", emissive: "#f1efe6", emissiveIntensity: 0.3 });
// J5 — retro skin: mutates the materials above in place (toggle in DebugMenu)
registerLecternMats({
  legs: CHROME_MAT, frame: NOGAL_MAT, panel: PANEL_BLACK_MAT, cpanel: CPANEL_MAT, strip: SILVER_STRIP_MAT,
  track: TRACK_MAT, thumb: THUMB_MAT, knob: KNOB_BODY_MAT, knobAccent: KNOB_MUSTARD_MAT, pushbtn: PUSHBTN_MAT,
  rockerA: ROCKER_NARANJA_MAT, rockerB: ROCKER_TURQUESA_MAT, rockerBase: ROCKER_BASE_DARK_MAT, silk: SILK_MAT,
});

// L3: 'silkscreen' = single canvas texture replaces individual label/frame meshes
const LABEL_MODE: "mesh" | "silkscreen" = "silkscreen";

// ── Canvas label texture ──────────────────────────────────────────────────────
const _labelCache = new Map<string, THREE.CanvasTexture>();
function labelTex(text: string): THREE.CanvasTexture {
  if (_labelCache.has(text)) return _labelCache.get(text)!;
  const cv = document.createElement("canvas");
  cv.width = 128; cv.height = 40;
  const ctx = cv.getContext("2d")!;
  ctx.clearRect(0, 0, 128, 40);
  const pal = lecternPalette();  // J5: retro ink + tracking (reload to apply)
  ctx.fillStyle = pal.label;
  ctx.letterSpacing = `${pal.tracking}px`;
  ctx.font = "bold 20px monospace";
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
  const pal = lecternPalette();
  ctx.fillStyle = pal.keyBg;  // crema (was #dde0f8 — caused blue object bug); J5: beige retro
  ctx.beginPath();
  ctx.roundRect(4, 4, 56, 56, 7);  // K3: square rect, center=(32,32)
  ctx.fill();
  ctx.fillStyle = pal.keyInk;
  ctx.font = "bold 34px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter.toUpperCase(), 32, 32);  // K3: centered
  const tex = new THREE.CanvasTexture(cv);
  _keycapCache.set(letter, tex);
  return tex;
}

// ── Icon textures (J3) ────────────────────────────────────────────────────────
const _iconCache = new Map<string, THREE.CanvasTexture>();
let _isPlaying = false;  // track playback for PLAY/PAUSA icon alternation

// J4: LFO cycling state
let _lfoWfIdx = 0;
let _lfoTgIdx = 0;
const LFO_WAVES: OscType[] = ["sine", "triangle", "square", "sawtooth"];
const LFO_TARGETS: string[]         = ["volume", "cutoff", "pitch"];

// J4: Lights constants
const LIGHT_STEP      = 0.1;
const MAX_EXTRA_LIGHTS = 12;

function _drawSunRays(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath(); ctx.arc(12, 12, 3.5, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(12 + Math.cos(a) * 5.5, 12 + Math.sin(a) * 5.5);
    ctx.lineTo(12 + Math.cos(a) * 7.5, 12 + Math.sin(a) * 7.5);
    ctx.stroke();
  }
}

function iconTex(name: IconName): THREE.CanvasTexture {
  if (_iconCache.has(name)) return _iconCache.get(name)!;
  const cv = document.createElement("canvas");
  cv.width = 256; cv.height = 256;
  const ctx = cv.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 256);
  const s = 256 / 24;
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = "#0a0a0a";
  ctx.strokeStyle = "#0a0a0a";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (name) {
    case "play":
      ctx.fill(new Path2D("M8 5 V19 L19 12 Z"));
      break;
    case "pause":
      ctx.fill(new Path2D("M7 5 H11 V19 H7 Z M13 5 H17 V19 H13 Z"));
      break;
    case "next":
      ctx.fill(new Path2D("M6 5 L15 12 L6 19 Z M16 5 H18.5 V19 H16 Z"));
      break;
    case "prev":
      ctx.fill(new Path2D("M18 5 L9 12 L18 19 Z M5.5 5 H8 V19 H5.5 Z"));
      break;
    case "start_mark":
      ctx.fill(new Path2D("M7 4 H11 V6 H9 V18 H11 V20 H7 Z"));
      break;
    case "end_mark":
      ctx.fill(new Path2D("M17 4 H13 V6 H15 V18 H13 V20 H17 Z"));
      break;
    case "loop": {
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(12, 12, 7.5, 0.4, Math.PI * 2 - 0.4, false);
      ctx.stroke();
      const ae = Math.PI * 2 - 0.4;
      const ax = 12 + 7.5 * Math.cos(ae); const ay = 12 + 7.5 * Math.sin(ae);
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(ae + Math.PI / 2);
      ctx.fill(new Path2D("M0 0 L-2 -3.5 L2 -3.5 Z"));
      ctx.restore();
      const as0 = 0.4;
      const ax0 = 12 + 7.5 * Math.cos(as0); const ay0 = 12 + 7.5 * Math.sin(as0);
      ctx.save(); ctx.translate(ax0, ay0); ctx.rotate(as0 - Math.PI / 2);
      ctx.fill(new Path2D("M0 0 L-2 3.5 L2 3.5 Z"));
      ctx.restore();
      break;
    }
    case "delete":
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(6, 6); ctx.lineTo(18, 18);
      ctx.moveTo(18, 6); ctx.lineTo(6, 18);
      ctx.stroke();
      break;
    case "volume":
      ctx.fill(new Path2D("M4 9 H8 L13 5 V19 L8 15 H4 Z"));
      ctx.lineWidth = 1.6;
      ctx.stroke(new Path2D("M15.9 9 A4 4 0 0 1 15.5 15"));
      ctx.stroke(new Path2D("M18 7 A7 7 0 0 1 18 17"));
      break;
    case "mute":
      ctx.fill(new Path2D("M4 9 H8 L13 5 V19 L8 15 H4 Z"));
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(16, 8); ctx.lineTo(21, 16);
      ctx.moveTo(21, 8); ctx.lineTo(16, 16);
      ctx.stroke();
      break;
    case "power":
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(12, 12, 8, Math.PI * 0.25, Math.PI * 1.75, false);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12, 4); ctx.lineTo(12, 13); ctx.stroke();
      break;
    case "spiral": {
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const turns = 2.2, totalA = turns * Math.PI * 2;
      for (let i = 0; i <= 200; i++) {
        const a = (i / 200) * totalA;
        const r = 1 + (a / totalA) * 8.5;
        const sx = 12 + r * Math.cos(a - Math.PI / 2);
        const sy = 12 + r * Math.sin(a - Math.PI / 2);
        if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.stroke(); break;
    }
    case "bars4":
      ctx.lineWidth = 2.2;
      [[4.5, 14], [9, 8], [13.5, 11], [18, 5]].forEach(([x, top]) => {
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, 19); ctx.stroke();
      }); break;
    case "dbl_chevron":
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(4, 6); ctx.lineTo(10, 12); ctx.lineTo(4, 18);
      ctx.moveTo(11, 6); ctx.lineTo(17, 12); ctx.lineTo(11, 18);
      ctx.stroke(); break;
    case "sun_plain":
      ctx.lineWidth = 2.2; _drawSunRays(ctx); break;
    case "sun_minus":
      ctx.lineWidth = 2.2; _drawSunRays(ctx);
      ctx.beginPath(); ctx.moveTo(9.5, 12); ctx.lineTo(14.5, 12); ctx.stroke(); break;
    case "sun_plus":
      ctx.lineWidth = 2.2; _drawSunRays(ctx);
      ctx.beginPath();
      ctx.moveTo(9.5, 12); ctx.lineTo(14.5, 12);
      ctx.moveTo(12, 9.5); ctx.lineTo(12, 14.5);
      ctx.stroke(); break;
    case "sun_star":
      ctx.lineWidth = 2.2; _drawSunRays(ctx);
      ctx.beginPath();
      ctx.moveTo(9.5, 12); ctx.lineTo(14.5, 12);
      ctx.moveTo(12, 9.5); ctx.lineTo(12, 14.5);
      ctx.moveTo(10, 10); ctx.lineTo(14, 14);
      ctx.moveTo(14, 10); ctx.lineTo(10, 14);
      ctx.stroke(); break;
    case "lp_curve":
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(3, 8); ctx.lineTo(12, 8);
      ctx.bezierCurveTo(16, 8, 17, 14, 21, 16);
      ctx.stroke(); break;
    case "hp_curve":
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(3, 16); ctx.bezierCurveTo(7, 16, 8, 8, 12, 8);
      ctx.lineTo(21, 8);
      ctx.stroke(); break;
    case "distort":
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(2, 12); ctx.lineTo(6, 7.5); ctx.lineTo(10, 7.5);
      ctx.lineTo(14, 16.5); ctx.lineTo(18, 16.5); ctx.lineTo(22, 12);
      ctx.stroke(); break;
    case "phaser_icon":
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let x = 2; x <= 22; x++) {
        const y = 12 - 4 * Math.sin((x - 2) / 20 * Math.PI * 2);
        if (x === 2) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.beginPath();
      for (let x = 2; x <= 22; x++) {
        const y = 12 - 3 * Math.sin((x - 2) / 20 * Math.PI * 2 + Math.PI * 0.75);
        if (x === 2) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke(); break;
    case "pitch_arrows":
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(8, 18); ctx.lineTo(8, 6);
      ctx.moveTo(5, 9); ctx.lineTo(8, 6); ctx.lineTo(11, 9);
      ctx.moveTo(16, 6); ctx.lineTo(16, 18);
      ctx.moveTo(13, 15); ctx.lineTo(16, 18); ctx.lineTo(19, 15);
      ctx.stroke(); break;
    case "wave_sine":
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let x = 2; x <= 22; x++) {
        const y = 12 - 6 * Math.sin((x - 2) / 20 * Math.PI * 2);
        if (x === 2) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke(); break;
    case "wave_tri":
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(2, 12); ctx.lineTo(7, 5); ctx.lineTo(12, 19); ctx.lineTo(17, 5); ctx.lineTo(22, 12);
      ctx.stroke(); break;
    case "wave_sqr":
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(2, 12); ctx.lineTo(2, 5); ctx.lineTo(12, 5);
      ctx.lineTo(12, 19); ctx.lineTo(22, 19); ctx.lineTo(22, 12);
      ctx.stroke(); break;
    case "wave_saw":
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(2, 18); ctx.lineTo(12, 5); ctx.lineTo(12, 18); ctx.lineTo(22, 5);
      ctx.stroke(); break;
    case "target_icon":
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(12, 12, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(12, 12, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(12, 3); ctx.lineTo(12, 7);
      ctx.moveTo(12, 17); ctx.lineTo(12, 21);
      ctx.moveTo(3, 12); ctx.lineTo(7, 12);
      ctx.moveTo(17, 12); ctx.lineTo(21, 12);
      ctx.stroke(); break;
    case "cone":
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(4, 18); ctx.lineTo(20, 6);
      ctx.moveTo(4, 18); ctx.lineTo(20, 18);
      ctx.stroke(); break;
    case "half_circle":
      ctx.fill(new Path2D("M12 4 A8 8 0 0 1 12 20 Z")); break;
    case "drop":
      ctx.fill(new Path2D("M12 3 C12 3 5 11 5 15 A7 7 0 0 0 19 15 C19 11 12 3 12 3 Z")); break;
    case "magnifier":
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(10, 10, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(14.5, 14.5); ctx.lineTo(20, 20); ctx.stroke(); break;
  }
  ctx.restore();
  const tex = new THREE.CanvasTexture(cv);
  tex.generateMipmaps = true;
  _iconCache.set(name, tex);
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
  const pal = lecternPalette();
  ctx.fillStyle = pal.zoneTitle;
  ctx.letterSpacing = `${pal.tracking}px`;
  ctx.font = "bold 18px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.toUpperCase(), 96, 16);
  const tex = new THREE.CanvasTexture(cv);
  _labelCache.set(key, tex);
  return tex;
}

// ── Lights-indicator canvas draw — K3: shows globalIntensity ──────────────────
function drawLightsIndicator(cv: HTMLCanvasElement, intensity: number): void {
  const ctx = cv.getContext("2d")!;
  const w = cv.width, h = cv.height;
  ctx.clearRect(0, 0, w, h);
  const pal = lecternPalette();  // J5: amber phosphor on retro CRT
  ctx.fillStyle = pal.indBg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = pal.indFg;
  ctx.font = `bold ${Math.floor(h * 0.62)}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(intensity.toFixed(1), w / 2, h / 2);
}

// ── E3: drag / hover module-level state ───────────────────────────────────────
export const LECTERN_DBG = {
  hoveredId:    null as string | null,
  dragType:     "none" as string,
  knobTooltip:  null as { x: number; y: number; val: number } | null,
  // K3: value HUD
  hudLabel:     null as string | null,
  hudExpiry:    0,
};

// K3: per-control press/toggle animation timestamps (performance.now())
const _pressAt:  Record<string, number> = {};
const _toggleAt: Record<string, number> = {};

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

// ── K1: fit-based camera target computation ────────────────────────────────────
const K1_LABEL_MIN_PX = 12;  // minimum label pixel height at 1080 px viewport
const K1_DOME_R = 27.5;      // FaceDome sphere radius (DOME_R - 0.5)

// Build pose from fixed fov/height/dist/pitch (used for debug overrides)
function _makePose(
  side: "left" | "right",
  fovDeg: number,
  height: number,
  dist: number,
  pitchDeg: number,
): { pos: [number,number,number]; quat: [number,number,number,number]; fovDeg: number } {
  const sign = side === "left" ? -1 : 1;
  const flip = (side === "left" ? DBG_LECTERNS.yawFlipLeft : DBG_LECTERNS.yawFlipRight) ? Math.PI : 0;
  const yaw  = Math.atan2(-sign * LECTERN_PLACE_X, 0) + LECTERN_YAW_OFFSET_RAD + flip;
  const lecternM = new THREE.Matrix4()
    .makeTranslation(sign * LECTERN_PLACE_X, TARIMA_H_REF, 0)
    .multiply(new THREE.Matrix4().makeRotationY(yaw));
  const plateM = lecternM.clone()
    .multiply(new THREE.Matrix4().makeTranslation(0, LEG_H, PANEL_D / 2))
    .multiply(new THREE.Matrix4().makeRotationX(TILT_RAD))
    .multiply(new THREE.Matrix4().makeTranslation(0, PANEL_T + CPANEL_T, -PANEL_D / 2));
  const plateCtr = new THREE.Vector3().applyMatrix4(plateM);
  const userDir  = new THREE.Vector3(0, 0, 1).transformDirection(lecternM).normalize();
  const camPos   = plateCtr.clone().addScaledVector(userDir, dist).add(new THREE.Vector3(0, height, 0));
  const lookAt   = plateCtr.clone().add(new THREE.Vector3(0, height + dist * Math.tan(pitchDeg * Math.PI / 180), 0));
  const lookM    = new THREE.Matrix4().lookAt(camPos, lookAt, new THREE.Vector3(0, 1, 0));
  const q        = new THREE.Quaternion().setFromRotationMatrix(lookM);
  return { pos: [camPos.x, camPos.y, camPos.z], quat: [q.x, q.y, q.z, q.w], fovDeg };
}

function fitLecternCamera(
  side: "left" | "right",
  aspect: number,
): { pos: [number,number,number]; quat: [number,number,number,number]; fovDeg: number } {
  const isImage = side === "left";
  const dbgCfg  = isImage ? DBG_CAM_IMAGE : DBG_CAM_SOUND;

  // Debug override: bypass search
  if (dbgCfg.override) {
    return _makePose(side, dbgCfg.fov, dbgCfg.height, dbgCfg.dist, dbgCfg.pitch);
  }

  // ── Geometry setup ──────────────────────────────────────────────────────────
  const sign = side === "left" ? -1 : 1;
  const flip = (side === "left" ? DBG_LECTERNS.yawFlipLeft : DBG_LECTERNS.yawFlipRight) ? Math.PI : 0;
  const yaw  = Math.atan2(-sign * LECTERN_PLACE_X, 0) + LECTERN_YAW_OFFSET_RAD + flip;
  const lecternM = new THREE.Matrix4()
    .makeTranslation(sign * LECTERN_PLACE_X, TARIMA_H_REF, 0)
    .multiply(new THREE.Matrix4().makeRotationY(yaw));
  const plateM = lecternM.clone()
    .multiply(new THREE.Matrix4().makeTranslation(0, LEG_H, PANEL_D / 2))
    .multiply(new THREE.Matrix4().makeRotationX(TILT_RAD))
    .multiply(new THREE.Matrix4().makeTranslation(0, PANEL_T + CPANEL_T, -PANEL_D / 2));
  const plateCtr = new THREE.Vector3().applyMatrix4(plateM);
  const userDir  = new THREE.Vector3(0, 0, 1).transformDirection(lecternM).normalize();

  // Plate corners in world space: (±hw, 0, ±hd) in plate-local → world
  const hw = PANEL_W / 2, hd = PANEL_D / 2;
  const corners = (
    [[-hw,-hd],[hw,-hd],[-hw,hd],[hw,hd]] as [number,number][]
  ).map(([x,z]) => new THREE.Vector3(x, 0, z).applyMatrix4(plateM));
  // corners[2] and [3] are the front edge (hd = toward user)

  // Farthest label world position (back row, for sound constraint)
  const farLabelWorld = new THREE.Vector3(0, LBL_H / 2, ROW1_V_A).applyMatrix4(plateM);

  // ── Search parameters ───────────────────────────────────────────────────────
  const fovsToTry = isImage
    ? [75, 80, 85, 90]
    : [60, 65, 70, 75, 80, 85, 90];

  const heightStep = 0.05;
  const distStep   = 0.05;
  const pitchStep  = 1;
  const hMin = isImage ? 0.80 : 0.70;
  const hMax = 1.30;
  const dMin = 0.50;
  const dMax = 1.20;
  const pMin = isImage ? -35 : -60;
  const pMax = isImage ? -10 : -25;

  const testCam = new THREE.PerspectiveCamera(75, aspect, 0.05, 200);

  for (const fovDeg of fovsToTry) {
    testCam.fov    = fovDeg;
    testCam.aspect = aspect;
    testCam.updateProjectionMatrix();
    const fovRad = fovDeg * (Math.PI / 180);

    let bestDist = Infinity;
    let bestPose: ReturnType<typeof _makePose> | null = null;

    for (let dist = dMin; dist <= dMax + 1e-6; dist += distStep) {
      for (let height = hMin; height <= hMax + 1e-6; height += heightStep) {
        for (let pitchDeg = pMin; pitchDeg <= pMax; pitchDeg += pitchStep) {
          // ── Build camera ─────────────────────────────────────────────────────
          const camPos = plateCtr.clone()
            .addScaledVector(userDir, dist)
            .add(new THREE.Vector3(0, height, 0));
          const lookAt = plateCtr.clone()
            .add(new THREE.Vector3(0, height + dist * Math.tan(pitchDeg * Math.PI / 180), 0));

          testCam.position.copy(camPos);
          testCam.lookAt(lookAt);
          testCam.updateMatrixWorld();

          // ── Constraint: minimum height ────────────────────────────────────
          if (camPos.y < plateCtr.y + hMin) continue;

          // Project all corners
          const ndcs = corners.map(c => c.clone().project(testCam));

          // ── Constraint 1: all 4 corners in frame, 5% margin ───────────────
          const MARGIN = 0.90;
          if (!ndcs.every(n => n.z < 1.1 && Math.abs(n.x) <= MARGIN && Math.abs(n.y) <= MARGIN)) continue;

          // ── Constraint: front edge ≥ 8% above bottom (NDC y ≥ -0.84) ─────
          if (Math.min(ndcs[2].y, ndcs[3].y) < -0.84) continue;

          if (!isImage) {
            // ── Sound: plate ≥ 85% of frame width ────────────────────────────
            const ndcXs = ndcs.map(n => n.x);
            if (Math.max(...ndcXs) - Math.min(...ndcXs) < 1.70) continue;

            // ── Sound: label pixel height ≥ K1_LABEL_MIN_PX ──────────────────
            const lDist = farLabelWorld.distanceTo(camPos);
            const px = (LBL_H / (2 * lDist * Math.tan(fovRad / 2))) * 1080;
            if (px < K1_LABEL_MIN_PX) continue;
          } else {
            // ── Image: dome visibility (6×3 grid, top 30% of screen, ≥70%) ──
            const GRID_X = [-5/6, -3/6, -1/6, 1/6, 3/6, 5/6];
            const GRID_Y = [0.47, 0.67, 0.87];
            let hits = 0;
            for (const nx of GRID_X) {
              for (const ny of GRID_Y) {
                const dir = new THREE.Vector3(nx, ny, 0.5).unproject(testCam).sub(camPos).normalize();
                const pd  = camPos.dot(dir);
                // ray inside sphere → always intersects (K1_DOME_R^2 - |cam|^2 > 0)
                if (pd * pd - (camPos.lengthSq() - K1_DOME_R * K1_DOME_R) >= 0) hits++;
              }
            }
            if (hits / 18 < 0.70) continue;
          }

          if (dist < bestDist) {
            bestDist = dist;
            bestPose = _makePose(side, fovDeg, height, dist, pitchDeg);
            if (process.env.NODE_ENV !== "production") {
              console.log(`[K1 fit] side=${side} fov=${fovDeg}° h=${height.toFixed(2)} d=${dist.toFixed(2)} p=${pitchDeg}°`);
            }
          }
        }
      }
    }

    if (bestPose) return bestPose;
    if (fovDeg >= 90) console.warn(`[K1 fit] No pose found for side=${side} at fov=90°`);
  }

  // Final fallback: use initial values from spec
  return _makePose(side, isImage ? 75 : 60, isImage ? 0.9 : 0.8, isImage ? 0.75 : 0.8, isImage ? -22 : -45);
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
type IconName = "play" | "pause" | "next" | "prev" | "start_mark" | "end_mark"
              | "loop" | "delete" | "volume" | "mute"
              | "power" | "spiral" | "bars4" | "dbl_chevron"
              | "sun_plain" | "sun_minus" | "sun_plus" | "sun_star"
              | "lp_curve" | "hp_curve" | "distort" | "phaser_icon" | "pitch_arrows"
              | "wave_sine" | "wave_tri" | "wave_sqr" | "wave_saw" | "target_icon"
              | "cone" | "half_circle" | "drop" | "magnifier";

interface CtrlDef {
  id: string;
  type: "button" | "toggle" | "slider" | "knob" | "indicator";
  label: string;
  // surface coords (m): u = right, v = toward user, origin at plate centre
  px: number;  // u
  py: number;  // v
  railLen?: number;
  orientation?: "h" | "v";  // slider axis; "h" default (along u), "v" along v
  color?: "green" | "amber" | "chrome" | "blue" | "mustard";
  icon?: IconName;           // J3: drawn on button/toggle top face; "volume" on slider marks ends
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
  // K3: update value HUD for knobs/sliders
  if (def.type === "knob" || def.type === "slider") {
    const val = ctrlState[id];
    const dec = (def.max - def.min) > 10 ? 0 : (def.max - def.min) > 2 ? 1 : 2;
    LECTERN_DBG.hudLabel  = `${def.label}: ${val.toFixed(dec)}`;
    LECTERN_DBG.hudExpiry = performance.now() + 1200;
  }
  storeNotify();
}

// ── Single control mesh constants (must precede validateLayout + controls arrays) ─
const BTN_R     = 0.030;   // half-size for hit zone
const BTN_W     = 0.060;   // pushbutton square side
const BTN_H     = 0.020;   // pushbutton height
const KNOB_R    = 0.033;   // knob top radius (0.066/2)
const KNOB_BOT_R = 0.037;  // knob bottom radius (0.074/2)
const KNOB_H    = 0.040;
const KNOB_SKIRT_R = 0.044; // skirt outer radius (0.088/2)
const KNOB_SKIRT_H = 0.006;
const ROCKER_BASE_W = 0.070; const ROCKER_BASE_D = 0.045; const ROCKER_BASE_H = 0.012;
const ROCKER_W  = 0.060;   const ROCKER_D = 0.034;        const ROCKER_H = 0.020;
const ROCKER_TILT = 20 * Math.PI / 180;
const THUMB_W   = 0.070;
const THUMB_D   = 0.040;
const THUMB_H   = 0.025;
const HIT_PAD   = 1.30;
const LBL_AHEAD = 0.055;
const LBL_H     = 0.014;
const LBL_W     = 0.100;

// ── Dev-only layout validation ─────────────────────────────────────────────────
function validateLayout(controls: CtrlDef[], sections: SecDef[]) {
  if (process.env.NODE_ENV !== "development") return;
  const U_MAX = 0.72; const V_MAX = 0.34;
  const KNOB_PAD = KNOB_SKIRT_R * HIT_PAD;
  const BTN_PAD  = BTN_W / 2 * HIT_PAD;
  const ROC_PAD  = ROCKER_BASE_W / 2 * HIT_PAD;

  for (const c of controls) {
    if (c.type === "indicator") continue;
    if (c.type === "slider" && c.orientation !== "v")
      console.error(`[lectern] slider "${c.id}" must be vertical — no horizontal sliders`);
    const uH = c.type === "slider" ? THUMB_W / 2 : c.type === "knob" ? KNOB_PAD : c.type === "toggle" ? ROC_PAD : BTN_PAD;
    const vH = c.type === "slider" ? (c.railLen ?? SLIDER_RAIL) / 2 : c.type === "knob" ? KNOB_PAD : c.type === "toggle" ? ROCKER_BASE_D / 2 * HIT_PAD : BTN_PAD;
    if (c.px - uH < -U_MAX || c.px + uH > U_MAX) console.warn(`[lectern] u-bounds: "${c.id}"`);
    if (c.py - vH < -V_MAX || c.py + vH > V_MAX) console.warn(`[lectern] v-bounds: "${c.id}"`);
  }
  for (let i = 0; i < controls.length; i++) {
    for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i]; const b = controls[j];
      if (a.type === "indicator" || b.type === "indicator") continue;
      const duMin = 0.055;
      if (Math.abs(a.px - b.px) < duMin && Math.abs(a.py - b.py) < duMin)
        console.warn(`[lectern] overlap: "${a.id}" ↔ "${b.id}"`);
    }
  }
  // Check section overlaps (same band only)
  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      const a = sections[i]; const b = sections[j];
      if (a.band !== b.band && a.band !== "AB" && b.band !== "AB") continue;
      if (a.u_left < b.u_right && a.u_right > b.u_left)
        console.warn(`[lectern] section overlap: "${a.label}" ↔ "${b.label}"`);
    }
  }
}

// ── J3 section definitions ────────────────────────────────────────────────────
// IMAGE lectern: FILTROS+LUCES share u=[-0.515,-0.135]; CÁMARA u=[-0.105,+0.515]
const IMAGE_SECTIONS: SecDef[] = [
  { label: "FILTROS", subtitle: "EFECTOS DEL DOMO",  band: "A",  cols: 3, u_left: -0.515, u_right: -0.135 },
  { label: "LUCES",   subtitle: "ILUMINACIÓN",        band: "B",  cols: 3, u_left: -0.515, u_right: -0.135 },
  { label: "CÁMARA",  subtitle: "IMAGEN Y VISTA",     band: "AB", cols: 5, u_left: -0.105, u_right:  0.515 },
];

// SOUND lectern: all sections laid out per-band (band A: REPRO/FILTROS/DISTOR; band B: LFO/PHASER/PITCH/ESPACIO) + SALIDA
const SOUND_SECTIONS: SecDef[] = [
  { label: "REPRODUCCIÓN", subtitle: "CANCIÓN Y LOOP",    band: "A",  cols: 4, u_left: -0.625, u_right: -0.125 },
  { label: "FILTROS",      subtitle: "PASA BAJOS Y ALTOS",band: "A",  cols: 2, u_left: -0.095, u_right:  0.165 },
  { label: "DISTORSIÓN",   subtitle: "SATURACIÓN",        band: "A",  cols: 2, u_left:  0.195, u_right:  0.455 },
  { label: "LFO",          subtitle: "MODULACIÓN",        band: "B",  cols: 2, u_left: -0.710, u_right: -0.450 },
  { label: "PHASER",       subtitle: "BARRIDO DE FASE",   band: "B",  cols: 3, u_left: -0.420, u_right: -0.040 },
  { label: "PITCH",        subtitle: "CAMBIO DE TONO",    band: "B",  cols: 2, u_left: -0.010, u_right:  0.250 },
  { label: "ESPACIO",      subtitle: "ECO Y REVERB",      band: "B",  cols: 2, u_left:  0.280, u_right:  0.540 },
  { label: "SALIDA",       subtitle: "VOLUMEN",           band: "AB", cols: 1, u_left:  0.570, u_right:  0.710 },
];

// ── IMAGE (left) controls — J3 grid layout ────────────────────────────────────
// FILTROS  (band A, 3×2):  row1 v=-0.270, row2 v=-0.155  cols: -0.445,-0.325,-0.205
// LUCES    (band B, 3×2):  row1 v=+0.090, row2 v=+0.205  cols: -0.445,-0.325,-0.205
// CÁMARA   (both,  5 sl):  center v=-0.040, rail -0.28→+0.20  cols: -0.035,+0.085,+0.205,+0.325,+0.445

let _domeEffIdx = 0;
const N_EFF = 7;

const IMAGE_CONTROLS: CtrlDef[] = [
  // ── FILTROS (band A, 3×2) ─────────────────────────────────────────────────
  { id: "dom_onoff", type: "toggle", label: "ON/OFF",   color: "green", icon: "power",      px: -0.445, py: ROW1_V_A,
    min: 0, max: 1, initial: 1,
    onActivate: (v) => { STORE.dome.sectorEnabled = STORE.dome.sectorEnabled.map(() => v > 0.5); storeNotify(); } },
  { id: "psych",     type: "toggle", label: "PSICO",    color: "green", icon: "spiral",     px: -0.325, py: ROW1_V_A,
    min: 0, max: 1, initial: 0, onActivate: (v) => { STORE.dome.psychedelic   = v > 0.5; } },
  { id: "reactive",  type: "toggle", label: "REACTIVO", color: "green", icon: "bars4",      px: -0.205, py: ROW1_V_A,
    min: 0, max: 1, initial: 0, onActivate: (v) => { STORE.dome.reactiveAudio = v > 0.5; } },
  { id: "dom_int",   type: "knob",   label: "INTENS.",  px: -0.445, py: ROW2_V_A,
    min: 0, max: 3, initial: 1, onActivate: (v) => { STORE.lights.globalIntensity = v; storeNotify(); } },
  { id: "dom_speed", type: "knob",   label: "VELOC.",   px: -0.325, py: ROW2_V_A,
    min: 0.2, max: 4, initial: 1, onActivate: (v) => { STORE.dome.globalSpeed = v; } },
  { id: "dom_nxt",   type: "button", label: "SIG.EFE.", icon: "dbl_chevron", px: -0.205, py: ROW2_V_A,
    min: 0, max: 1, initial: 0,
    onActivate: () => {
      _domeEffIdx = (_domeEffIdx + 1) % N_EFF;
      for (let i = 0; i < N_EFF; i++) {
        if (DBG_DOME_MAT.value) DBG_DOME_MAT.value.uniforms[`uE${i}`].value = _domeEffIdx;
      }
    } },
  // ── LUCES (band B, 3×2) ──────────────────────────────────────────────────
  { id: "dom_minus",  type: "button", label: "LUZ -",   icon: "sun_minus", px: -0.445, py: ROW1_V_B,
    min: 0, max: 1, initial: 0, onActivate: () => { STORE.lights.globalIntensity = Math.round(Math.max(0.2, STORE.lights.globalIntensity - LIGHT_STEP) * 100) / 100; storeNotify(); } },
  { id: "dom_star",   type: "button", label: "LUZ *",   icon: "sun_star",  px: -0.325, py: ROW1_V_B,
    min: 0, max: 1, initial: 0,
    onActivate: () => {
      if (STORE.lights.extras.length >= MAX_EXTRA_LIGHTS) return;
      const hue = Math.floor(Math.random() * 360);
      const angle = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 2;
      STORE.lights.extras.push({ color: `hsl(${hue},100%,60%)`, intensity: 200,
        position: [Math.cos(angle) * r, 3, Math.sin(angle) * r] });
      storeNotify();
    } },
  { id: "dom_plus",   type: "button", label: "LUZ +",   icon: "sun_plus",  px: -0.205, py: ROW1_V_B,
    min: 0, max: 1, initial: 0, onActivate: () => { STORE.lights.globalIntensity = Math.round(Math.min(3.0, STORE.lights.globalIntensity + LIGHT_STEP) * 100) / 100; storeNotify(); } },
  { id: "lights_ind", type: "indicator", label: "NIVEL", px: -0.325, py: 0.030,
    min: 0, max: 3, initial: 1, onActivate: () => {} },
  // ── CÁMARA (both bands, 5 vertical sliders, rail v=-0.28→+0.20) ──────────
  { id: "cam_fov",  type: "slider", label: "FOV",    icon: "cone",        orientation: "v", railLen: 0.48, px: -0.035, py: -0.040,
    min: 40, max: 100, initial: 90, onActivate: (v) => { STORE.cam.fov = v; } },
  { id: "wcam_br",  type: "slider", label: "BRILLO", icon: "sun_plain",   orientation: "v", railLen: 0.48, px: +0.085, py: -0.040,
    min: -0.5, max: 0.5, initial: 0, onActivate: (v) => { STORE.webcam.brightness = 1 + v; } },
  { id: "wcam_ct",  type: "slider", label: "CONTR.", icon: "half_circle", orientation: "v", railLen: 0.48, px: +0.205, py: -0.040,
    min: 0.5, max: 2, initial: 1, onActivate: (v) => { STORE.webcam.contrast   = v; } },
  { id: "wcam_sa",  type: "slider", label: "SATUR.", icon: "drop",        orientation: "v", railLen: 0.48, px: +0.325, py: -0.040,
    min: 0, max: 2, initial: 1, onActivate: (v) => { STORE.webcam.saturation = v; } },
  { id: "wcam_zm",  type: "slider", label: "ZOOM",   icon: "magnifier",   orientation: "v", railLen: 0.48, px: +0.445, py: -0.040,
    min: 1, max: 3, initial: 1, onActivate: (v) => { STORE.webcam.zoom = v; } },
] as CtrlDef[];

// ── SOUND (right) controls — J3 grid layout ──────────────────────────────────
// REPRODUCCIÓN (band A, 4×2): row1 v=-0.270, row2 v=-0.155  cols: -0.555,-0.435,-0.315,-0.195
// FILTROS_S    (band A, 2×2): cols -0.025,+0.095
// DISTORSIÓN   (band A, 2×2): cols +0.265,+0.385
// LFO          (band B, 2×2): cols -0.640,-0.520
// PHASER       (band B, 3×2): cols -0.350,-0.230,-0.110
// PITCH        (band B, 2×2): cols +0.060,+0.180
// ESPACIO      (band B, 2×2): cols +0.350,+0.470
// SALIDA       (both,  1 sl): col  +0.640   rail v=-0.28→+0.24

const SOUND_CONTROLS: CtrlDef[] = [
  // ── REPRODUCCIÓN (band A, 4×2) ───────────────────────────────────────────
  { id: "s_prev",    type: "button", label: "ANT.",       icon: "prev",
    px: -0.555, py: ROW1_V_A, min: 0, max: 1, initial: 0, onActivate: () => prevTrack() },
  { id: "s_play",    type: "button", label: "PLAY/PAUSA", icon: "play",
    px: -0.435, py: ROW1_V_A, min: 0, max: 1, initial: 0,
    onActivate: () => { _isPlaying = !_isPlaying; togglePlayPause(); } },
  { id: "s_next",    type: "button", label: "SIG.",       icon: "next",
    px: -0.315, py: ROW1_V_A, min: 0, max: 1, initial: 0, onActivate: () => nextTrack() },
  // col 3 (u=-0.195 row1) = empty
  { id: "s_sam_in",  type: "button", label: "INICIO",     icon: "start_mark",
    px: -0.555, py: ROW2_V_A, min: 0, max: 1, initial: 0,
    onActivate: () => { const el = document.querySelector("audio"); if (el) { ctrlState["s_sam_in_v"] = el.currentTime; setSamplerLoop(el.currentTime, ctrlVal("s_sam_out_v", -1), ctrlVal("s_sam_lp", 0) > 0.5); } } },
  { id: "s_sam_out", type: "button", label: "FIN",        icon: "end_mark",
    px: -0.435, py: ROW2_V_A, min: 0, max: 1, initial: 0,
    onActivate: () => { const el = document.querySelector("audio"); if (el) { ctrlState["s_sam_out_v"] = el.currentTime; setSamplerLoop(ctrlVal("s_sam_in_v", 0), el.currentTime, ctrlVal("s_sam_lp", 0) > 0.5); } } },
  { id: "s_sam_lp",  type: "toggle", label: "LOOP",       icon: "loop", color: "green",
    px: -0.315, py: ROW2_V_A, min: 0, max: 1, initial: 0,
    onActivate: (v) => setSamplerLoop(ctrlVal("s_sam_in_v", 0), ctrlVal("s_sam_out_v", -1), v > 0.5) },
  { id: "s_sam_cl",  type: "button", label: "BORRAR",     icon: "delete",
    px: -0.195, py: ROW2_V_A, min: 0, max: 1, initial: 0, onActivate: () => setSamplerLoop(0, -1, false) },
  // ── FILTROS (band A, 2×2) ─────────────────────────────────────────────────
  { id: "s_lp_on",  type: "toggle", label: "P.BAJOS",  color: "green", icon: "lp_curve", px: -0.025, py: ROW1_V_A,
    min: 0, max: 1, initial: 0, onActivate: (v) => setLP(v > 0.5, ctrlVal("s_lp_fr", 8000)) },
  { id: "s_hp_on",  type: "toggle", label: "P.ALTOS",  color: "green", icon: "hp_curve", px: +0.095, py: ROW1_V_A,
    min: 0, max: 1, initial: 0, onActivate: (v) => setHP(v > 0.5, ctrlVal("s_hp_fr", 200)) },
  { id: "s_lp_fr",  type: "knob",   label: "CORTE LP", px: -0.025, py: ROW2_V_A,
    min: 200, max: 20000, initial: 20000, onActivate: (v) => setLP(ctrlVal("s_lp_on", 0) > 0.5, v) },
  { id: "s_hp_fr",  type: "knob",   label: "CORTE HP", px: +0.095, py: ROW2_V_A,
    min: 20, max: 4000, initial: 20,     onActivate: (v) => setHP(ctrlVal("s_hp_on", 0) > 0.5, v) },
  // ── DISTORSIÓN (band A, 2×2) ──────────────────────────────────────────────
  { id: "s_dist_on", type: "toggle", label: "ON",       color: "green", icon: "distort", px: +0.265, py: ROW1_V_A,
    min: 0, max: 1, initial: 0, onActivate: (v) => setDistortion(v > 0.5, ctrlVal("s_drive", 10), ctrlVal("s_dist_mx", 0.5)) },
  // col 1 row1 = empty
  { id: "s_drive",   type: "knob",   label: "DRIVE",    color: "mustard", px: +0.265, py: ROW2_V_A,
    min: 1, max: 50, initial: 10, onActivate: (v) => setDistortion(ctrlVal("s_dist_on", 0) > 0.5, v, ctrlVal("s_dist_mx", 0.5)) },
  { id: "s_dist_mx", type: "knob",   label: "MEZCLA",   color: "mustard", px: +0.385, py: ROW2_V_A,
    min: 0, max: 1, initial: 0,   onActivate: (v) => setDistortion(ctrlVal("s_dist_on", 0) > 0.5, ctrlVal("s_drive", 10), v) },
  // ── LFO (band B, 2×2) ────────────────────────────────────────────────────
  { id: "s_lfo_wf", type: "button", label: "ONDA",     icon: "wave_sine",   px: -0.640, py: ROW1_V_B,
    min: 0, max: 1, initial: 0, onActivate: () => { _lfoWfIdx = (_lfoWfIdx + 1) % 4; setLFO(ctrlVal("s_lfo_sp", 2), ctrlVal("s_lfo_dp", 0), LFO_WAVES[_lfoWfIdx], LFO_TARGETS[_lfoTgIdx]); } },
  { id: "s_lfo_tg", type: "button", label: "DESTINO",  icon: "target_icon", px: -0.520, py: ROW1_V_B,
    min: 0, max: 1, initial: 0, onActivate: () => { _lfoTgIdx = (_lfoTgIdx + 1) % 3; setLFO(ctrlVal("s_lfo_sp", 2), ctrlVal("s_lfo_dp", 0), LFO_WAVES[_lfoWfIdx], LFO_TARGETS[_lfoTgIdx]); } },
  { id: "s_lfo_sp", type: "knob",   label: "VELOC.",   color: "mustard", px: -0.640, py: ROW2_V_B,
    min: 0.05, max: 8, initial: 2,
    onActivate: (v) => setLFO(v, ctrlVal("s_lfo_dp", 0), LFO_WAVES[_lfoWfIdx], LFO_TARGETS[_lfoTgIdx]) },
  { id: "s_lfo_dp", type: "knob",   label: "PROF.",    color: "mustard", px: -0.520, py: ROW2_V_B,
    min: 0, max: 0.5, initial: 0,
    onActivate: (v) => setLFO(ctrlVal("s_lfo_sp", 2), v, LFO_WAVES[_lfoWfIdx], LFO_TARGETS[_lfoTgIdx]) },
  // ── PHASER (band B, 3×2) ─────────────────────────────────────────────────
  { id: "s_phs_on", type: "toggle", label: "ON",       color: "green", icon: "phaser_icon",  px: -0.350, py: ROW1_V_B,
    min: 0, max: 1, initial: 0, onActivate: (v) => setPhaser(v > 0.5, ctrlVal("s_phs_sp", 1), ctrlVal("s_phs_dp", 0.5), ctrlVal("s_phs_fb", 0.5)) },
  // cols 1,2 row1 = empty
  { id: "s_phs_sp", type: "knob",   label: "VELOC.",   color: "mustard", px: -0.350, py: ROW2_V_B,
    min: 0.05, max: 8, initial: 1, onActivate: (v) => { if (ctrlVal("s_phs_on", 0) > 0.5) setPhaser(true, v, ctrlVal("s_phs_dp", 0.5), ctrlVal("s_phs_fb", 0.5)); } },
  { id: "s_phs_dp", type: "knob",   label: "PROF.",    color: "mustard", px: -0.230, py: ROW2_V_B,
    min: 0, max: 1, initial: 0.5, onActivate: (v) => { if (ctrlVal("s_phs_on", 0) > 0.5) setPhaser(true, ctrlVal("s_phs_sp", 1), v, ctrlVal("s_phs_fb", 0.5)); } },
  { id: "s_phs_fb", type: "knob",   label: "FEEDBACK", color: "mustard", px: -0.110, py: ROW2_V_B,
    min: 0, max: 1, initial: 0.5, onActivate: (v) => { if (ctrlVal("s_phs_on", 0) > 0.5) setPhaser(true, ctrlVal("s_phs_sp", 1), ctrlVal("s_phs_dp", 0.5), v); } },
  // ── PITCH (band B, 2×2) ──────────────────────────────────────────────────
  { id: "s_pit_on", type: "toggle", label: "ON",       color: "green", icon: "pitch_arrows", px: +0.060, py: ROW1_V_B,
    min: 0, max: 1, initial: 0, onActivate: (v) => setPitch(v > 0.5, Math.round(ctrlVal("s_pit_st", 0)), ctrlVal("s_pit_mx", 0.5)) },
  // col 1 row1 = empty
  { id: "s_pit_st", type: "knob",   label: "SEMITONOS", color: "mustard", px: +0.060, py: ROW2_V_B,
    min: -12, max: 12, initial: 0, onActivate: (v) => { const st = Math.round(v); setPitch(ctrlVal("s_pit_on", 0) > 0.5, st, ctrlVal("s_pit_mx", 0.5)); } },
  { id: "s_pit_mx", type: "knob",   label: "MEZCLA",   color: "mustard", px: +0.180, py: ROW2_V_B,
    min: 0, max: 1, initial: 0,   onActivate: (v) => { if (ctrlVal("s_pit_on", 0) > 0.5) setPitch(true, Math.round(ctrlVal("s_pit_st", 0)), v); } },
  // ── ESPACIO (band B, 2×2) ────────────────────────────────────────────────
  // rows 1 = empty, empty
  { id: "s_dlyA",   type: "knob",   label: "ECO",      color: "mustard", px: +0.350, py: ROW2_V_B,
    min: 0, max: 1, initial: 0, onActivate: (v) => setDelay(v, 0.3) },
  { id: "s_rev",    type: "knob",   label: "REVERB",   color: "mustard", px: +0.470, py: ROW2_V_B,
    min: 0, max: 1, initial: 0, onActivate: setReverb },
  // ── SALIDA (both bands, 1 vertical slider, rail v=-0.28→+0.24) ───────────
  { id: "s_vol",    type: "slider", label: "VOLUMEN", orientation: "v", railLen: 0.52,
    icon: "volume", px: +0.640, py: -0.020,
    min: 0, max: 1, initial: 0.8, onActivate: setVolume },
] as CtrlDef[];

// Validate on module load (dev only)
validateLayout(IMAGE_CONTROLS, IMAGE_SECTIONS);
validateLayout(SOUND_CONTROLS, SOUND_SECTIONS);

// Initialise defaults
[...IMAGE_CONTROLS, ...SOUND_CONTROLS].forEach(c => { ctrlState[c.id] = c.initial; });

// K2: dev direction tests — run from console: window.__lecternTests()
export function runControlDirectionTests(): void {
  if (typeof window === "undefined") return;
  console.group("[K2] Control direction tests");

  // 1. Slider drag: railDir = (0,0,-1) → dragging toward back (−Z) gives positive proj → value increases
  const railDirTest = new THREE.Vector3(0, 0, -1);
  const deltaBack   = new THREE.Vector3(0, 0, -0.05);  // moving toward −Z (back/high)
  const projTest    = deltaBack.dot(railDirTest);
  const sliderPass  = projTest > 0;
  console.log(`Slider drag −Z (toward back): proj=${projTest.toFixed(3)} → ${sliderPass ? "✅ PASS" : "❌ FAIL"}`);

  // 1b. Slider thumb at max: z = rail/2 - norm*rail → at norm=1, z = −rail/2 < 0 (screen top)
  const RAIL = 0.28;
  const thumbAtMax = RAIL / 2 - RAIL;
  console.log(`Slider thumb at max (z<0 = screen top): z=${thumbAtMax.toFixed(3)} → ${thumbAtMax < 0 ? "✅ PASS" : "❌ FAIL"}`);

  // 2. Knob drag: (dx=+10, dy=0) → delta=(dx-dy)/diag > 0 → value increases
  const knobDelta = (10 - 0) / 1000 * DBG_LECTERNS.knobSens;
  console.log(`Knob drag right: delta=${knobDelta.toFixed(4)} → ${knobDelta > 0 ? "✅ PASS" : "❌ FAIL"}`);

  // 3. Knob visual min (7:30 = lower-left): angle=π*1.75 (norm=0) → x<0, z>0
  const angleMin = Math.PI * 1.75;
  const xMin = Math.sin(angleMin), zMin = Math.cos(angleMin);
  const kMinPass = xMin < 0 && zMin > 0;
  console.log(`Knob min pos (7:30, x<0 z>0): x=${xMin.toFixed(3)}, z=${zMin.toFixed(3)} → ${kMinPass ? "✅ PASS" : "❌ FAIL"}`);

  // 3b. Knob visual mid (12:00 = top): angle=π (norm=0.5) → x≈0, z<0 (toward back = screen up)
  const angleMid = Math.PI;
  const xMid = Math.sin(angleMid), zMid = Math.cos(angleMid);
  const kMidPass = Math.abs(xMid) < 0.01 && zMid < 0;
  console.log(`Knob mid pos (12:00, x≈0 z<0): x=${xMid.toFixed(3)}, z=${zMid.toFixed(3)} → ${kMidPass ? "✅ PASS" : "❌ FAIL"}`);

  // 4. Knob visual max (4:30 = lower-right): angle=π*0.25 (norm=1) → x>0, z>0
  const angleMax = Math.PI * 0.25;
  const xMax = Math.sin(angleMax), zMax = Math.cos(angleMax);
  const kMaxPass = xMax > 0 && zMax > 0;
  console.log(`Knob max pos (4:30, x>0 z>0): x=${xMax.toFixed(3)}, z=${zMax.toFixed(3)} → ${kMaxPass ? "✅ PASS" : "❌ FAIL"}`);

  // 5. Initial values
  const initTests: Array<[string, number]> = [
    ["s_lp_fr",  20000],
    ["s_hp_fr",  20],
    ["s_dist_mx", 0],
    ["s_pit_mx",  0],
    ["s_vol",    0.8],
  ];
  for (const [id, expected] of initTests) {
    const actual = ctrlState[id];
    const p = actual === expected;
    console.log(`Initial ${id}: ${actual} (expected ${expected}) → ${p ? "✅ PASS" : "❌ FAIL"}`);
  }

  console.groupEnd();
}
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__lecternTests = runControlDirectionTests;
}

// ── Single control mesh ───────────────────────────────────────────────────────
function CtrlMesh({
  def, meshesRef, keyLetter,
}: {
  def: CtrlDef;
  meshesRef: React.MutableRefObject<THREE.Mesh[]>;
  keyLetter?: string;
}) {
  // J5: retro → mini amber CRT shader; else flat basic material (reload to apply)
  const indMat         = useMemo(() => DBG_RETRO.lecterns
    ? createCrtScreenMaterial() : new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }), []);
  const ctrlRef        = useRef<THREE.Mesh>(null);
  const hitRef         = useRef<THREE.Mesh>(null);
  const knobRotRef     = useRef<THREE.Group>(null);
  const ledMatRef      = useRef<THREE.MeshStandardMaterial>(null);
  const playIconMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const waveIconMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const destLabelMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const indCanvasRef   = useRef<HTMLCanvasElement | null>(null);
  const indTexRef      = useRef<THREE.CanvasTexture | null>(null);
  const indLastVal     = useRef(-99);
  // K3: animation refs
  const ringMeshRef    = useRef<THREE.Mesh | null>(null);
  const ringMatRef     = useRef<THREE.MeshBasicMaterial | null>(null);
  const overlayMatRef  = useRef<THREE.MeshBasicMaterial | null>(null);
  const haloMatRef     = useRef<THREE.MeshBasicMaterial | null>(null);
  const keycapMatRef   = useRef<THREE.MeshStandardMaterial | null>(null);

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
    cv.width = 128; cv.height = 64;  // K3: wider for float display
    const tex = new THREE.CanvasTexture(cv);
    indCanvasRef.current = cv;
    indTexRef.current = tex;
    drawLightsIndicator(cv, STORE.lights.globalIntensity);
    setScreenMap(indMat, tex);
    return () => { tex.dispose(); };
  }, [def.type, indMat]);

  useFrame(({ clock }) => {
    if (def.type === "indicator") {
      RETRO_CRT.uTime.value = clock.elapsedTime;
      // K3: show globalIntensity instead of extras count
      const intensity = STORE.lights.globalIntensity;
      if (Math.abs(intensity - indLastVal.current) > 0.001 && indCanvasRef.current && indTexRef.current) {
        indLastVal.current = intensity;
        drawLightsIndicator(indCanvasRef.current, intensity);
        indTexRef.current.needsUpdate = true;
      }
      return;
    }
    const v    = ctrlVal(def.id, def.initial);
    const norm = (v - def.min) / Math.max(0.001, def.max - def.min);

    // J2 fix: rotate the whole body+indicator group around Y
    // L2: rotation.y = π − θ where θ = −135° + 270°×norm (CW from 12:00 = back/up)
    // min(0)→7:30 (lower-left), mid(0.5)→12:00 (top), max(1)→4:30 (lower-right)
    if (def.type === "knob") {
      if (knobRotRef.current) {
        const angle = Math.PI * 1.75 - norm * Math.PI * 1.5;
        knobRotRef.current.rotation.y = angle;
      }
      return;
    }

    if (!ctrlRef.current) return;

    if (def.type === "toggle") {
      const on = v > 0.5;
      // K3: spring-bounce rocker tilt (90ms)
      const toggleMs = performance.now() - (_toggleAt[def.id] ?? 0);
      const targetTilt = on ? -ROCKER_TILT : ROCKER_TILT;
      if (toggleMs < 150) {
        const prevTilt = on ? ROCKER_TILT : -ROCKER_TILT;
        const t = toggleMs / 150;
        const spring = 1 - Math.exp(-7 * t) * Math.cos(Math.PI * 2.5 * t);
        ctrlRef.current.rotation.x = prevTilt + (targetTilt - prevTilt) * Math.min(1, spring);
      } else {
        ctrlRef.current.rotation.x = targetTilt;
      }
      if (ledMatRef.current) ledMatRef.current.emissiveIntensity = on ? 2.5 : 0;
      // K3: brightness overlay (35% when OFF)
      if (overlayMatRef.current) {
        (overlayMatRef.current as THREE.MeshBasicMaterial).opacity = on ? 0 : 0.65;
      }
      if (haloMatRef.current) {
        (haloMatRef.current as THREE.MeshBasicMaterial).opacity = on ? 0.8 : 0;
      }
    } else if (def.type === "button") {
      const on = v > 0.5;
      // K3: press animation — sink 18mm then spring back in 180ms
      const pressMs = performance.now() - (_pressAt[def.id] ?? 0);
      if (pressMs < 200) {
        const t = pressMs / 200;
        let sinkAmt: number;
        if (t < 0.15) {
          sinkAmt = 0.018 * (t / 0.15);
        } else {
          const t2 = (t - 0.15) / 0.85;
          sinkAmt = 0.018 * Math.max(0, Math.exp(-7 * t2) * Math.cos(Math.PI * 2 * t2));
        }
        ctrlRef.current.position.y = BTN_H / 2 - sinkAmt;
      } else {
        ctrlRef.current.position.y = on ? BTN_H * 0.25 : BTN_H / 2;
      }
      // K3: emissive flash then state-based LED
      if (ledMatRef.current) {
        if (pressMs < 200) {
          ledMatRef.current.emissiveIntensity = 0.9 * (1 - pressMs / 200);
        } else if (def.id === "s_play") {
          ledMatRef.current.emissiveIntensity = _isPlaying ? 2.5 : 0;
        } else {
          ledMatRef.current.emissiveIntensity = on ? 2.5 : 0;
        }
      }
      // J3: alternate PLAY/PAUSA icon
      if (def.id === "s_play" && playIconMatRef.current) {
        const tex = _isPlaying ? iconTex("pause") : iconTex("play");
        if (playIconMatRef.current.map !== tex) { playIconMatRef.current.map = tex; playIconMatRef.current.needsUpdate = true; }
      }
      // L1: cycle ONDA waveform icon
      if (def.id === "s_lfo_wf" && waveIconMatRef.current) {
        const waves: IconName[] = ["wave_sine", "wave_tri", "wave_sqr", "wave_saw"];
        const tex = iconTex(waves[_lfoWfIdx % 4]);
        if (waveIconMatRef.current.map !== tex) { waveIconMatRef.current.map = tex; waveIconMatRef.current.needsUpdate = true; }
      }
      // L1: update DESTINO sub-label
      if (def.id === "s_lfo_tg" && destLabelMatRef.current) {
        const names = ["VOLUMEN", "FILTRO", "PITCH"];
        const tex = labelTex(names[_lfoTgIdx % 3]);
        if (destLabelMatRef.current.map !== tex) { destLabelMatRef.current.map = tex; destLabelMatRef.current.needsUpdate = true; }
      }
      // L4: keycap illumination flash on press
      if (keycapMatRef.current) {
        keycapMatRef.current.emissiveIntensity = pressMs < 120 ? (1 - pressMs / 120) * 2.0 : 0;
      }
      // K3: ring expansion
      if (ringMeshRef.current && ringMatRef.current) {
        if (pressMs < 260) {
          const rt = pressMs / 260;
          ringMeshRef.current.scale.setScalar(1 + rt * 1.4);
          (ringMatRef.current as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - rt);
        } else {
          (ringMatRef.current as THREE.MeshBasicMaterial).opacity = 0;
        }
      }
    } else if (def.type === "slider") {
      const rail = def.railLen ?? SLIDER_RAIL;
      // L2: back (-Z) = high value = screen top; front (+Z) = low value = screen bottom
      ctrlRef.current.position.z = rail / 2 - norm * rail;
      if (fillRef.current) {
        const thumbZ = ctrlRef.current.position.z;
        const botZ = rail / 2;        // bottom (front, low-value end)
        const fillLen = Math.max(0.001, botZ - thumbZ);
        fillRef.current.scale.z = fillLen;
        fillRef.current.position.z = thumbZ + fillLen / 2;
      }
    }
  });

  const fillRef = useRef<THREE.Mesh>(null);

  const surfY = CPANEL_T + 0.001;
  // Slider labels at v=+0.29 (toward user) = z=-0.29 in code. Btn/knob at z=-LBL_AHEAD.
  const lblZ = def.type === "slider" ? -0.29 : -LBL_AHEAD;
  const LBL_ROT = [Math.PI / 2, 0, 0] as [number, number, number];

  // ── Indicator — K3: raised 3D frame with screen ────────────────────────────
  if (def.type === "indicator") {
    const DW = 0.070, DH = 0.008, DD = 0.030;  // frame size
    return (
      <group position={[def.px, surfY, -def.py]}>
        {/* Frame body */}
        <mesh position={[0, DH / 2, 0]}>
          <boxGeometry args={[DW, DH, DD]} />
          <primitive object={CPANEL_MAT} attach="material" />
        </mesh>
        {/* Screen plane on top, 2:1 aspect (128×64 canvas) */}
        <mesh position={[0, DH + 0.0005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[DW - 0.012, DD - 0.010]} />
          <primitive object={indMat} attach="material" />
        </mesh>
        {LABEL_MODE === "mesh" && (
          <mesh position={[0, 0.001, lblZ]} rotation={LBL_ROT}>
            <planeGeometry args={[LBL_W, LBL_H]} />
            <meshBasicMaterial map={labelTex(def.label)} transparent alphaTest={0.05} depthWrite={false}
              polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
          </mesh>
        )}
      </group>
    );
  }

  // ── Vertical slider ────────────────────────────────────────────────────────
  if (def.type === "slider") {
    const rail = def.railLen ?? SLIDER_RAIL;
    const nMarks = 11; // marks every 10%
    const TRACK_W = 0.010;
    const BORDER_T = 0.001;
    return (
      <group position={[def.px, surfY, -def.py]}>
        {/* Track groove */}
        <mesh position={[0, -0.002, 0]}>
          <boxGeometry args={[TRACK_W, 0.006, rail]} />
          <primitive object={TRACK_MAT} attach="material" />
        </mesh>
        {/* White border around track (J2) */}
        {LABEL_MODE === "mesh" && (
          <mesh position={[0, BORDER_T, 0]}>
            <boxGeometry args={[TRACK_W + 0.003, BORDER_T, rail + 0.003]} />
            <primitive object={SILK_MAT} attach="material" />
          </mesh>
        )}
        {/* Scale on left side: 11 marks — hidden in silkscreen mode */}
        {LABEL_MODE === "mesh" && Array.from({ length: nMarks }, (_, i) => {
          const z = -rail / 2 + (i / (nMarks - 1)) * rail;
          const isMajor = i === 0 || i === 5 || i === 10;
          return (
            <mesh key={i} position={[-(TRACK_W / 2 + 0.008), 0.001, z]}>
              <boxGeometry args={[isMajor ? 0.008 : 0.005, 0.001, 0.002]} />
              <primitive object={SILK_MAT} attach="material" />
            </mesh>
          );
        })}
        {/* Thumb: black block with white transversal line + striations */}
        <mesh ref={m => { ctrlRef.current = m!; register(m); }} position={[0, THUMB_H / 2, -rail / 2]}>
          <boxGeometry args={[THUMB_W, THUMB_H, THUMB_D]} />
          <primitive object={THUMB_MAT} attach="material" />
        </mesh>
        {/* White line across thumb center */}
        <mesh ref={fillRef} position={[0, THUMB_H + 0.001, rail / 2]}>
          <boxGeometry args={[THUMB_W * 0.75, 0.002, 0.003]} />
          <primitive object={SILK_MAT} attach="material" />
        </mesh>
        {/* Hit zone */}
        <mesh ref={m => { hitRef.current = m!; register(m); }} position={[0, THUMB_H / 2, -rail / 2]} visible={false}>
          <boxGeometry args={[THUMB_W * HIT_PAD, THUMB_H * HIT_PAD, rail]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
        {LABEL_MODE === "mesh" && (
          <>
            <mesh position={[0, 0.001, lblZ]} rotation={LBL_ROT}>
              <planeGeometry args={[LBL_W, LBL_H]} />
              <meshBasicMaterial map={labelTex(def.label)} transparent alphaTest={0.05} depthWrite={false}
                polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
            </mesh>
            {/* J3: volume/mute icons at rail ends for VOLUMEN slider */}
            {def.icon === "volume" && (
              <>
                <mesh position={[0, 0.001, -(rail / 2 + 0.025)]} rotation={LBL_ROT}>
                  <planeGeometry args={[BTN_W * 0.70, BTN_W * 0.70]} />
                  <meshBasicMaterial map={iconTex("volume")} transparent alphaTest={0.05} depthWrite={false}
                    polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
                </mesh>
                <mesh position={[0, 0.001, rail / 2 + 0.025]} rotation={LBL_ROT}>
                  <planeGeometry args={[BTN_W * 0.70, BTN_W * 0.70]} />
                  <meshBasicMaterial map={iconTex("mute")} transparent alphaTest={0.05} depthWrite={false}
                    polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
                </mesh>
              </>
            )}
            {/* L1: icon at top of rail for camera sliders */}
            {def.icon && def.icon !== "volume" && (
              <mesh position={[0, 0.001, -(rail / 2 + 0.025)]} rotation={LBL_ROT}>
                <planeGeometry args={[BTN_W * 0.70, BTN_W * 0.70]} />
                <meshBasicMaterial map={iconTex(def.icon)} transparent alphaTest={0.05} depthWrite={false}
                  polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
              </mesh>
            )}
          </>
        )}
      </group>
    );
  }

  // ── Knob ───────────────────────────────────────────────────────────────────
  if (def.type === "knob") {
    const knobMat = def.color === "mustard" ? KNOB_MUSTARD_MAT : KNOB_BODY_MAT;
    // Indicator line: from 20% of top radius to edge, center at 60%
    const indLen = KNOB_R * 0.80;
    const indCtrZ = KNOB_R * 0.20 + indLen / 2;
    // Fixed scale marks: 11 marks, 270° arc (K2: ±135° = ±PI*0.75), radius 0.054
    const arcMarks = Array.from({ length: 11 }, (_, i) => {
      // L2: θ = −135° + 270°×(i/10); position = (sin θ, −cos θ) → gap at bottom (6:00)
      const angle = (i / 10) * Math.PI * 1.5 - Math.PI * 0.75;
      const r = KNOB_SKIRT_R + 0.006;
      const isEnd = i === 0 || i === 10;
      return { x: Math.sin(angle) * r, z: -Math.cos(angle) * r, isEnd };
    });
    return (
      <group position={[def.px, surfY, -def.py]}>
        {/* Skirt: flat disk below body */}
        <mesh position={[0, KNOB_SKIRT_H / 2 - 0.001, 0]}>
          <cylinderGeometry args={[KNOB_SKIRT_R, KNOB_SKIRT_R, KNOB_SKIRT_H, 32]} />
          <primitive object={knobMat} attach="material" />
        </mesh>
        {/* Rotating group: body (frustum) + indicator line */}
        <group ref={knobRotRef} position={[0, KNOB_SKIRT_H, 0]}>
          {/* Frustum body */}
          <mesh>
            <cylinderGeometry args={[KNOB_R, KNOB_BOT_R, KNOB_H, 32]} />
            <primitive object={knobMat} attach="material" />
          </mesh>
          {/* Indicator line on top face */}
          <mesh position={[0, KNOB_H / 2 + 0.001, indCtrZ]}>
            <boxGeometry args={[0.004, 0.002, indLen]} />
            <primitive object={SILK_MAT} attach="material" />
          </mesh>
        </group>
        {/* Fixed scale marks — hidden in silkscreen mode */}
        {LABEL_MODE === "mesh" && arcMarks.map((p, i) => (
          <mesh key={i} position={[p.x, KNOB_SKIRT_H + 0.001, p.z]}>
            <boxGeometry args={[0.002, 0.001, p.isEnd ? 0.010 : 0.006]} />
            <primitive object={SILK_MAT} attach="material" />
          </mesh>
        ))}
        {/* Hit zone */}
        <mesh ref={m => { hitRef.current = m!; register(m); }} visible={false}
              position={[0, KNOB_H / 2 + KNOB_SKIRT_H, 0]}>
          <cylinderGeometry args={[KNOB_SKIRT_R * HIT_PAD, KNOB_SKIRT_R * HIT_PAD,
            (KNOB_H + KNOB_SKIRT_H) * HIT_PAD, 12]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
        {LABEL_MODE === "mesh" && (
          <mesh position={[0, 0.001, lblZ]} rotation={LBL_ROT}>
            <planeGeometry args={[LBL_W, LBL_H]} />
            <meshBasicMaterial map={labelTex(def.label)} transparent alphaTest={0.05} depthWrite={false}
              polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
          </mesh>
        )}
      </group>
    );
  }

  // ── Toggle → Rocker switch ─────────────────────────────────────────────────
  if (def.type === "toggle") {
    const rockerMat = def.color === "amber" ? ROCKER_TURQUESA_MAT : ROCKER_NARANJA_MAT;
    return (
      <group position={[def.px, surfY, -def.py]}>
        {/* Base */}
        <mesh>
          <boxGeometry args={[ROCKER_BASE_W, ROCKER_BASE_H, ROCKER_BASE_D]} />
          <primitive object={ROCKER_BASE_DARK_MAT} attach="material" />
        </mesh>
        {/* Lever (tilts on x = u axis): ctrlRef so useFrame can tilt it */}
        <mesh ref={m => { ctrlRef.current = m!; register(m); }}
              position={[0, ROCKER_BASE_H / 2 + ROCKER_H / 2, 0]}>
          <boxGeometry args={[ROCKER_W, ROCKER_H, ROCKER_D]} />
          <primitive object={rockerMat} attach="material" />
          {/* L4: icon child — tilts with rocker lever */}
          {def.icon && (
            <mesh position={[0, ROCKER_H / 2 + 0.0008, 0]} rotation={LBL_ROT}>
              <planeGeometry args={[0.022, 0.022]} />
              <meshBasicMaterial map={iconTex(def.icon)} transparent alphaTest={0.05} depthWrite={false}
                polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
            </mesh>
          )}
        </mesh>
        {/* LED: small square above rocker (toward user = -z) */}
        <mesh position={[0, ROCKER_BASE_H + 0.004, -ROCKER_BASE_D / 2 - 0.005]}>
          <boxGeometry args={[0.008, 0.004, 0.003]} />
          <meshStandardMaterial ref={ledMatRef}
            color="#1a0800" emissive={lecternPalette().ledToggle} emissiveIntensity={0} />
        </mesh>
        {/* Hit zone */}
        <mesh ref={m => { hitRef.current = m!; register(m); }} visible={false}
              position={[0, ROCKER_BASE_H / 2, 0]}>
          <boxGeometry args={[ROCKER_BASE_W * HIT_PAD, (ROCKER_BASE_H + ROCKER_H) * HIT_PAD,
            ROCKER_BASE_D * HIT_PAD]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
        {LABEL_MODE === "mesh" && (
          <mesh position={[0, 0.001, lblZ]} rotation={LBL_ROT}>
            <planeGeometry args={[LBL_W, LBL_H]} />
            <meshBasicMaterial map={labelTex(def.label)} transparent alphaTest={0.05} depthWrite={false}
              polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
          </mesh>
        )}
        {/* K3: brightness overlay — 65% dark when OFF, hidden when ON */}
        <mesh position={[0, ROCKER_BASE_H / 2 + ROCKER_H / 2, 0]}>
          <boxGeometry args={[ROCKER_W + 0.001, ROCKER_H + 0.002, ROCKER_D + 0.001]} />
          <meshBasicMaterial ref={m => { overlayMatRef.current = m; }}
            color="#000000" transparent opacity={0.65} depthWrite={false} />
        </mesh>
        {/* K3: LED halo — additive ring glow when ON */}
        <mesh position={[0, ROCKER_BASE_H + 0.005, -ROCKER_BASE_D / 2 - 0.005]}
          rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.005, 0.016, 24]} />
          <meshBasicMaterial ref={m => { haloMatRef.current = m; }}
            color={lecternPalette().ledToggle} transparent opacity={0}
            depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      </group>
    );
  }

  // ── Button → Pushbutton crema ───────────────────────────────────────────────
  return (
    <group position={[def.px, surfY, -def.py]}>
      {/* L4: flat plate 60×20×60mm — center at BTN_H/2 so top face = BTN_H */}
      <mesh ref={m => { ctrlRef.current = m!; register(m); }} position={[0, BTN_H / 2, 0]}>
        <boxGeometry args={[BTN_W, BTN_H, BTN_W]} />
        <primitive object={PUSHBTN_MAT} attach="material" />
        {/* L4: icon child — sinks with button press */}
        {def.icon && (
          <mesh position={[0, BTN_H / 2 + 0.0008, 0]} rotation={LBL_ROT}>
            <planeGeometry args={[BTN_W * 0.55, BTN_W * 0.55]} />
            {def.id === "s_play"
              ? <meshBasicMaterial ref={playIconMatRef} map={iconTex("play")} transparent alphaTest={0.05} depthWrite={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
              : def.id === "s_lfo_wf"
              ? <meshBasicMaterial ref={waveIconMatRef} map={iconTex("wave_sine")} transparent alphaTest={0.05} depthWrite={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
              : <meshBasicMaterial map={iconTex(def.icon)} transparent alphaTest={0.05} depthWrite={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
            }
          </mesh>
        )}
      </mesh>
      {/* LED: tiny corner flash */}
      <mesh position={[BTN_W * 0.38, BTN_H + 0.003, BTN_W * 0.38]}>
        <boxGeometry args={[0.004, 0.003, 0.004]} />
        <meshStandardMaterial ref={ledMatRef}
          color="#1a0000" emissive={lecternPalette().ledButton} emissiveIntensity={0} />
      </mesh>
      {/* Hit zone */}
      <mesh ref={m => { hitRef.current = m!; register(m); }} position={[0, BTN_H / 2, 0]} visible={false}>
        <boxGeometry args={[BTN_W * HIT_PAD, BTN_H * HIT_PAD, BTN_W * HIT_PAD]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      {LABEL_MODE === "mesh" && (
        <mesh position={[0, 0.001, lblZ]} rotation={LBL_ROT}>
          <planeGeometry args={[LBL_W, LBL_H]} />
          <meshBasicMaterial map={labelTex(def.label)} transparent alphaTest={0.05} depthWrite={false}
            polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
        </mesh>
      )}
      {/* L4: keycap — rests on panel beside button, does NOT sink with press */}
      {keyLetter && (
        <mesh position={[0.050, -0.001, 0.026]}>
          <boxGeometry args={[0.030, 0.004, 0.030]} />
          <meshStandardMaterial ref={m => { keycapMatRef.current = m; }}
            map={keycapTex(keyLetter)} roughness={1} metalness={0}
            emissive="#ffeedd" emissiveIntensity={0} />
        </mesh>
      )}
      {/* L1: DESTINO sub-label showing current LFO target */}
      {def.id === "s_lfo_tg" && (
        <mesh position={[0, 0.001, lblZ - LBL_H - 0.004]} rotation={LBL_ROT}>
          <planeGeometry args={[LBL_W * 0.85, LBL_H * 0.85]} />
          <meshBasicMaterial ref={m => { destLabelMatRef.current = m; }} map={labelTex("VOLUMEN")}
            transparent alphaTest={0.05} depthWrite={false}
            polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
        </mesh>
      )}
      {/* K3: press ring — expands and fades over 260ms */}
      <mesh ref={m => { ringMeshRef.current = m; }} position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.030, 0.040, 32]} />
        <meshBasicMaterial ref={m => { ringMatRef.current = m; }}
          color={lecternPalette().indFg} transparent opacity={0}
          depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

// ── L3: silkscreen canvas texture ────────────────────────────────────────────
// Canvas 4096×2048: u axis → canvas x; z-axis of controls group → canvas y.
// toY(py) = (CPANEL_D/2 − py) / CPANEL_D * H  (Band A at bottom, Band B at top)
// High value ends (sliders) appear at top (smaller canvas_y).

const _silkCanvases: Partial<Record<"left" | "right", HTMLCanvasElement>> = {};

async function buildSilkscreen(side: "left" | "right"): Promise<THREE.CanvasTexture> {
  await document.fonts.ready;
  const W = 4096, H = 2048;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  _silkCanvases[side] = cv;

  const CW = CPANEL_W, CD = CPANEL_D;
  // Map control surface coords → canvas pixels
  const toX  = (u: number)     => (u + CW / 2) / CW * W;
  const toY  = (py: number)    => (CD / 2 - py) / CD * H;
  // Map absolute z in controls group → canvas y
  const toYz = (z: number)     => (CD / 2 + z)  / CD * H;
  const ppmX = W / CW;   // pixels per metre (horizontal)
  const ppmY = H / CD;   // pixels per metre (vertical)

  // Background
  ctx.fillStyle = "#0d0d11";
  ctx.fillRect(0, 0, W, H);

  const sections = side === "left" ? IMAGE_SECTIONS : SOUND_SECTIONS;
  const controls = side === "left" ? IMAGE_CONTROLS : SOUND_CONTROLS;

  // ── Section frames ──────────────────────────────────────────────────────
  for (const sec of sections) {
    const vB = sec.band === "B" ? BAND_B_V_BACK  : BAND_A_V_BACK;
    const vF = sec.band === "A" ? -0.02 : BAND_B_V_FRONT;
    // For AB bands, use full extent
    const vBack  = sec.band === "AB" ? BAND_A_V_BACK  : vB;
    const vFront = sec.band === "AB" ? BAND_B_V_FRONT : vF;

    const x0 = toX(sec.u_left);
    const x1 = toX(sec.u_right);
    // toY: Band A (negative py) → higher canvas_y (bottom). vBack > vFront in canvas.
    const yTop = Math.min(toY(vBack), toY(vFront));
    const yBot = Math.max(toY(vBack), toY(vFront));

    ctx.strokeStyle = "rgba(241,239,230,0.6)";
    ctx.lineWidth = 3;
    ctx.strokeRect(x0 + 1.5, yTop + 1.5, x1 - x0 - 3, yBot - yTop - 3);

    // Title + subtitle at same z as 3D zLbl
    const zLbl = sec.band === "A" ? -(BAND_A_V_BACK + 0.295) : -(BAND_B_V_BACK + 0.295);
    const lyT = toYz(zLbl);
    const xCtr = (x0 + x1) / 2;

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(241,239,230,0.95)";
    ctx.font = "bold 55px monospace";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(sec.label.toUpperCase(), xCtr, lyT - 10);

    if (sec.subtitle) {
      ctx.fillStyle = "rgba(241,239,230,0.60)";
      ctx.font = "30px monospace";
      ctx.fillText(sec.subtitle.toUpperCase(), xCtr, lyT + 28);
    }
  }

  // ── Control labels ──────────────────────────────────────────────────────
  for (const def of controls) {
    if (def.type === "indicator") continue;
    const cx = toX(def.px);
    // 3D places label at z = -(def.py) + lblZ_local where lblZ_local = −LBL_AHEAD or −0.29
    const lblZlocal = def.type === "slider" ? -0.29 : -LBL_AHEAD;
    const zAbs = -def.py + lblZlocal;  // absolute z in controls group
    const ly = toYz(zAbs);

    ctx.fillStyle = "rgba(241,239,230,0.90)";
    ctx.font = "bold 38px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(def.label.toUpperCase(), cx, ly);
  }

  // ── Slider scale marks + numbers ────────────────────────────────────────
  for (const def of controls) {
    if (def.type !== "slider") continue;
    const rail = def.railLen ?? SLIDER_RAIL;
    const cx = toX(def.px);
    const xLeft = cx - (THUMB_W / 2 + 0.013) * ppmX;

    for (let i = 0; i <= 10; i++) {
      // z_mark in ctrl local (relative to slider group center)
      // i=0 → z = −rail/2 (high-value end = back = screen top = small canvas_y)
      const zMark  = -rail / 2 + (i / 10) * rail;
      const zAbs   = -def.py + zMark;
      const my = toYz(zAbs);
      const isMajor = (i === 0 || i === 5 || i === 10);
      const mLen = isMajor ? 20 : 12;

      ctx.fillStyle = isMajor ? "rgba(241,239,230,0.85)" : "rgba(241,239,230,0.55)";
      ctx.fillRect(xLeft - mLen, my - 1, mLen, 2);

      if (isMajor) {
        // i=0 = "10" (high value, top of canvas)
        const numStr = i === 0 ? "10" : i === 5 ? "5" : "0";
        ctx.fillStyle = "rgba(241,239,230,0.70)";
        ctx.font = "26px monospace";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(numStr, xLeft - mLen - 5, my);
      }
    }
  }

  // ── Knob arc marks + numbers ────────────────────────────────────────────
  for (const def of controls) {
    if (def.type !== "knob") continue;
    const cx = toX(def.px);
    const cy = toY(def.py);
    const rInner = KNOB_SKIRT_R + 0.006;

    for (let i = 0; i <= 10; i++) {
      const angle  = (i / 10) * Math.PI * 1.5 - Math.PI * 0.75;
      // Same as 3D: x=sin(angle)*r, z=−cos(angle)*r
      const xMark  = Math.sin(angle) * rInner;
      const zMark  = -Math.cos(angle) * rInner;
      const isEnd  = (i === 0 || i === 10);
      const rOuter = rInner + (isEnd ? 0.011 : 0.007);

      const mxI = cx + xMark * ppmX;
      const myI = cy + zMark * ppmY;
      const mxO = cx + Math.sin(angle) * rOuter * ppmX;
      const myO = cy + (-Math.cos(angle) * rOuter) * ppmY;

      ctx.strokeStyle = isEnd ? "rgba(241,239,230,0.85)" : "rgba(241,239,230,0.55)";
      ctx.lineWidth = isEnd ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(mxI, myI);
      ctx.lineTo(mxO, myO);
      ctx.stroke();

      if (i === 0 || i === 5 || i === 10) {
        const rNum  = rOuter + 0.015;
        const nxAbs = def.px + Math.sin(angle) * rNum;
        const nzAbs = -def.py + (-Math.cos(angle) * rNum);
        const nx = toX(nxAbs);
        const ny = toYz(nzAbs);
        // i=0 → angle=−135° (lower-left) → value 0; i=10 → +135° → value 10
        const numStr = i === 0 ? "0" : i === 5 ? "5" : "10";
        ctx.fillStyle = "rgba(241,239,230,0.65)";
        ctx.font = "26px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(numStr, nx, ny);
      }
    }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// Expose dump helper for browser console debugging
if (typeof window !== "undefined") {
  (window as any).__dumpSilkscreen = (side: "left" | "right" = "left") => {
    const cv = _silkCanvases[side];
    if (!cv) { console.warn(`[silkscreen] ${side} not built yet`); return; }
    const a = document.createElement("a");
    a.href = cv.toDataURL("image/png");
    a.download = `silkscreen_${side}.png`;
    a.click();
  };
}

// ── Lectern geometry ──────────────────────────────────────────────────────────
function LecternBody({ side }: { side: "left" | "right" }) {
  const { gl } = useThree();
  const sign   = side === "left" ? -1 : 1;
  const silkMatRef = useRef<THREE.MeshBasicMaterial | null>(null);

  useEffect(() => {
    const env = getEnvMap(gl);
    CHROME_MAT.envMap = env;
    CHROME_MAT.needsUpdate = true;
  }, [gl]);

  // L3: build silkscreen canvas texture and apply to the plane
  useEffect(() => {
    if (LABEL_MODE !== "silkscreen") return;
    let cancelled = false;
    buildSilkscreen(side).then(tex => {
      if (cancelled) { tex.dispose(); return; }
      if (silkMatRef.current) {
        silkMatRef.current.map = tex;
        silkMatRef.current.needsUpdate = true;
      }
    });
    return () => { cancelled = true; };
  }, [side]);

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
      {/* J5: retro branded apron between the legs (front / user side) */}
      <LecternApron side={side} topY={LEG_H - 0.03} />

      {/* ── Top plate group: tilted, front (+Z) lower, back (-Z) higher ───── */}
      {/* Pivot at local +Z = front edge; rotation.x = +TILT_RAD lowers +Z */}
      <group position={[0, LEG_H, PANEL_D / 2]} rotation={[TILT_RAD, 0, 0]}>
        <group position={[0, PANEL_T / 2, -PANEL_D / 2]}>
          {/* J2: Outer nogal frame (1.60 × 0.85) */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[OUTER_W, PANEL_T, OUTER_D]} />
            <primitive object={NOGAL_MAT} attach="material" />
          </mesh>
          {/* J2: Inner black carbon panel (1.50 × 0.75), raised 1mm */}
          <mesh position={[0, PANEL_T / 2 + 0.001, 0]}>
            <boxGeometry args={[PANEL_W, 0.002, PANEL_D]} />
            <primitive object={PANEL_BLACK_MAT} attach="material" />
          </mesh>
          {/* J2: Silver side strips on left and right of black panel */}
          <mesh position={[-(PANEL_W / 2 + SIDE_STRIP_W / 2), PANEL_T / 2 + 0.001, 0]}>
            <boxGeometry args={[SIDE_STRIP_W, 0.002, PANEL_D]} />
            <primitive object={SILVER_STRIP_MAT} attach="material" />
          </mesh>
          <mesh position={[ (PANEL_W / 2 + SIDE_STRIP_W / 2), PANEL_T / 2 + 0.001, 0]}>
            <boxGeometry args={[SIDE_STRIP_W, 0.002, PANEL_D]} />
            <primitive object={SILVER_STRIP_MAT} attach="material" />
          </mesh>
          {/* J2: Rear bar — nogal, along back edge, REAR_BAR_EXTRA taller */}
          <mesh castShadow position={[0, REAR_BAR_EXTRA / 2, -(OUTER_D / 2 - REAR_BAR_D / 2)]}>
            <boxGeometry args={[OUTER_W, PANEL_T + REAR_BAR_EXTRA, REAR_BAR_D]} />
            <primitive object={NOGAL_MAT} attach="material" />
          </mesh>
          {/* inset dark satin control panel */}
          <mesh position={[0, PANEL_T / 2 + CPANEL_T / 2 + 0.001, 0]}>
            <boxGeometry args={[CPANEL_W, CPANEL_T, CPANEL_D]} />
            <primitive object={CPANEL_MAT} attach="material" />
          </mesh>
          {/* L3: silkscreen plane — 1mm above cpanel top, covers full cpanel area */}
          {LABEL_MODE === "silkscreen" && (
            <mesh position={[0, PANEL_T / 2 + CPANEL_T + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[CPANEL_W, CPANEL_D]} />
              <meshBasicMaterial ref={m => { silkMatRef.current = m; }}
                transparent depthWrite={false}
                polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
            </mesh>
          )}
          {/* J5: retro brand guard on the rear bar's user-facing side */}
          <LecternRearStrip side={side} faceZ={-(OUTER_D / 2 - REAR_BAR_D)} plateTopY={PANEL_T / 2} height={REAR_BAR_EXTRA} />
        </group>
      </group>
    </group>
  );
}

// ── Full lectern ──────────────────────────────────────────────────────────────
function Lectern({
  side, controls, appearProgress, keyVersion, flipVersion,
}: {
  side: "left" | "right";
  controls: CtrlDef[];
  appearProgress: React.MutableRefObject<number>;
  keyVersion: number;
  flipVersion: number;
}) {
  const groupRef  = useRef<THREE.Group>(null);
  const meshesRef = useRef<THREE.Mesh[]>([]);
  const sign      = side === "left" ? -1 : 1;
  // I1: local +Z faces center; yaw = atan2(toCenter.x, toCenter.z)
  const flip = (side === "left" ? DBG_LECTERNS.yawFlipLeft : DBG_LECTERNS.yawFlipRight) ? Math.PI : 0;
  const yaw  = Math.atan2(-sign * LECTERN_PLACE_X, 0) + LECTERN_YAW_OFFSET_RAD + flip;

  // Dev: verify front dot-product with toCenter > 0.99
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const frontWorld = new THREE.Vector2(Math.sin(yaw), Math.cos(yaw)); // local +Z in XZ
    const toCenter2D = new THREE.Vector2(-sign, 0);                     // unit vec toward center
    const dot = frontWorld.dot(toCenter2D);
    if (dot < 0.99) {
      console.warn(`[lectern ${side}] front NOT facing center: dot=${dot.toFixed(4)} (expected >0.99)`);
    } else {
      console.log(`[lectern ${side}] ✓ front facing center: dot=${dot.toFixed(4)}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipVersion]);

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
      <group position={[sign * LECTERN_PLACE_X, TARIMA_H_REF, 0]} rotation={[0, yaw, 0]}>
        <LecternBody side={side} />

        {/* SpotLight: above and slightly toward user (local +Z), aimed at plate centre */}
        <spotLight
          position={[0, 1.4, 0.5]}
          target-position={[0, 0.6, -0.1]}
          color="#ffe3b0"
          intensity={DBG_LECTERNS.lightIntensity}
          angle={0.28}
          penumbra={0.85}
          distance={2.2}
          castShadow={false}
        />

        {/* Controls + zone decorations — pivot at +Z (front) edge, matches plate hierarchy */}
        <group position={[0, LEG_H, PANEL_D / 2]} rotation={[TILT_RAD, 0, 0]}>
          <group position={[0, PANEL_T + CPANEL_T, -PANEL_D / 2]}>
            {/* J3: section frames + labels — skipped in silkscreen mode */}
            {LABEL_MODE === "mesh" && (side === "left" ? IMAGE_SECTIONS : SOUND_SECTIONS).map(sec => {
              const vBack  = sec.band === "B" ? BAND_B_V_BACK  : BAND_A_V_BACK;
              const vFront = sec.band === "A" ? -0.02 : BAND_B_V_FRONT;
              const zBack  = -vBack;
              const zFront = -vFront;
              const zCtr   = (zBack + zFront) / 2;
              const zH     = Math.abs(zBack - zFront);
              const uCtr   = (sec.u_left + sec.u_right) / 2;
              const uW     = sec.u_right - sec.u_left;
              const BT     = 0.0025;
              const zLbl   = sec.band === "A" ? -(BAND_A_V_BACK + 0.295) : -(BAND_B_V_BACK + 0.295);
              const lblW   = Math.min(uW - 0.02, 0.20);
              return (
                <group key={sec.label}>
                  <mesh position={[uCtr, 0.002, zFront]}>
                    <boxGeometry args={[uW + BT * 2, 0.001, BT]} />
                    <primitive object={SILK_MAT} attach="material" />
                  </mesh>
                  <mesh position={[uCtr, 0.002, zBack]}>
                    <boxGeometry args={[uW + BT * 2, 0.001, BT]} />
                    <primitive object={SILK_MAT} attach="material" />
                  </mesh>
                  <mesh position={[sec.u_left, 0.002, zCtr]}>
                    <boxGeometry args={[BT, 0.001, zH + BT * 2]} />
                    <primitive object={SILK_MAT} attach="material" />
                  </mesh>
                  <mesh position={[sec.u_right, 0.002, zCtr]}>
                    <boxGeometry args={[BT, 0.001, zH + BT * 2]} />
                    <primitive object={SILK_MAT} attach="material" />
                  </mesh>
                  <mesh position={[uCtr, 0.003, zLbl]} rotation={[Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[lblW, 0.012]} />
                    <meshBasicMaterial map={zoneTitleTex(sec.label)} transparent alphaTest={0.05} depthWrite={false}
                      polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
                  </mesh>
                  {sec.subtitle && (
                    <mesh position={[uCtr, 0.003, zLbl + 0.013]} rotation={[Math.PI / 2, 0, 0]}>
                      <planeGeometry args={[lblW, 0.009]} />
                      <meshBasicMaterial map={zoneTitleTex(`·${sec.subtitle}·`)} transparent alphaTest={0.05}
                        depthWrite={false} opacity={0.65}
                        polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
                    </mesh>
                  )}
                </group>
              );
            })}
            {/* J3 debug: cell grid overlay */}
            {process.env.NODE_ENV === "development" && DBG_LECTERNS.showSections &&
              (side === "left" ? IMAGE_SECTIONS : SOUND_SECTIONS).flatMap(sec =>
                (sec.band === "AB" ? [] :
                  [sec.band === "A" ? ROW1_V_A : ROW1_V_B, sec.band === "A" ? ROW2_V_A : ROW2_V_B]
                ).flatMap(v =>
                  Array.from({ length: sec.cols }, (_, col) => {
                    const u = j3ColU(sec.u_left, col);
                    return (
                      <mesh key={`dbg_${sec.label}_${col}_${v}`} position={[u, 0.004, -v]}>
                        <boxGeometry args={[0.006, 0.001, 0.006]} />
                        <meshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={2} />
                      </mesh>
                    );
                  })
                )
              )
            }
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
        {/* I1 debug gizmo: green arrow pointing local +Z (front / user side) */}
        {process.env.NODE_ENV === "development" && DBG_LECTERNS.showGizmo && (
          <group>
            {/* shaft */}
            <mesh position={[0, LEG_H + 0.05, 0.35]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.60, 6]} />
              <meshBasicMaterial color="#00ff44" />
            </mesh>
            {/* arrowhead */}
            <mesh position={[0, LEG_H + 0.05, 0.70]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.030, 0.10, 6]} />
              <meshBasicMaterial color="#00ff44" />
            </mesh>
          </group>
        )}
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
        LECTERN_DBG.hoveredId = newId;
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
          LECTERN_DBG.knobTooltip = { x: e.clientX, y: e.clientY, val: norm * 10 };
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
      if (INTERACT_STATE.mode !== "none") {
        // Always stop propagation in lectern mode to prevent drei's lock handler
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
      if (e.button !== 0 || INTERACT_STATE.mode === "none") return;
      const ndc = setNDC(e.clientX, e.clientY);
      const hit = rayHit(ndc);
      if (!hit) return;
      const { mesh, def, point } = hit;

      canvas.setPointerCapture(e.pointerId);
      _drag.pointerId = e.pointerId;
      _drag.def = def;

      if (def.type === "button" || def.type === "toggle") {
        _drag.type = "btn"; LECTERN_DBG.dragType = "btn";
        if (def.type === "toggle") {
          _toggleAt[def.id] = performance.now();
          setCtrl(def.id, ctrlVal(def.id, def.initial) > 0.5 ? 0 : 1, def);
          playUIClick(700, 0.10);
        } else {
          _pressAt[def.id] = performance.now();
          setCtrl(def.id, 1, def);
          playUIClick(1200, 0.12);
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
        _drag.type = isV ? "slider_v" : "slider_h"; LECTERN_DBG.dragType = _drag.type;
        // Plate plane from controls-container world matrix (mesh.parent.parent)
        const planeNorm = new THREE.Vector3(0, 1, 0)
          .transformDirection(mesh.parent!.parent!.matrixWorld).normalize();
        _drag.plane.setFromNormalAndCoplanarPoint(planeNorm, point);
        // Rail axis and origin
        if (isV) {
          // L2: −Z is toward back (higher in world); dragging toward back increases value
          _drag.railDir.set(0, 0, -1).transformDirection(mesh.parent!.matrixWorld).normalize();
        } else {
          _drag.railDir.set(1, 0, 0).transformDirection(mesh.parent!.matrixWorld).normalize();
        }
        _drag.railOrigin.setFromMatrixPosition(mesh.parent!.matrixWorld);
        _drag.railLen = def.railLen ?? 0.28;
        canvas.style.cursor = getCursorStyle(isV ? "slide_v" : "slide_h");
        applySlider(def, point);  // jump thumb to click position

      } else if (def.type === "knob") {
        _drag.type = "knob"; LECTERN_DBG.dragType = "knob";
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
      LECTERN_DBG.dragType = "none";
      LECTERN_DBG.knobTooltip = null;
      _drag.def = null;
      _drag.pointerId = -1;
      doHover(e.clientX, e.clientY);
    };

    const onPointerLeave = () => {
      if (_drag.type === "none") { _hoveredId = null; LECTERN_DBG.hoveredId = null; canvas.style.cursor = ""; }
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (e.pointerId !== _drag.pointerId) return;
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
      if (_drag.holdTimer) { clearInterval(_drag.holdTimer); _drag.holdTimer = null; }
      _drag.type = "none"; LECTERN_DBG.dragType = "none";
      _drag.def = null; _drag.pointerId = -1;
      canvas.style.cursor = _hoveredId ? getCursorStyle(
        ([...IMAGE_CONTROLS, ...SOUND_CONTROLS].find(c => c.id === _hoveredId)?.type ?? "button")
      ) : "";
    };

    canvas.addEventListener("pointermove",   onPointerMove);
    canvas.addEventListener("pointerdown",   onPointerDown);
    canvas.addEventListener("pointerup",     onPointerUp);
    canvas.addEventListener("pointerleave",  onPointerLeave);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("lostpointercapture", onPointerCancel);
    return () => {
      canvas.removeEventListener("pointermove",   onPointerMove);
      canvas.removeEventListener("pointerdown",   onPointerDown);
      canvas.removeEventListener("pointerup",     onPointerUp);
      canvas.removeEventListener("pointerleave",  onPointerLeave);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("lostpointercapture", onPointerCancel);
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
  const [visible, setVisible]         = useState(false);
  const [keyVersion, setKeyVersion]   = useState(0);
  const [flipVersion, setFlipVersion] = useState(0);
  const appearProgress               = useRef(0);
  const appearStart                  = useRef(0);
  const audioStarted                 = useRef(false);
  const lockPendingRef               = useRef(false);
  const { camera }                   = useThree();

  // J1: people-visible → wait LECTERNS_AFTER_PEOPLE_MS → requestLecterns()
  useEffect(() => {
    const onPeople = () => {
      setTimeout(() => requestLecterns(), LECTERNS_AFTER_PEOPLE_MS);
    };
    window.addEventListener("alight:people-visible", onPeople);
    return () => window.removeEventListener("alight:people-visible", onPeople);
  }, []);

  // J1: listen to request-lecterns (today fired by timer, future: ink.js dialog)
  useEffect(() => {
    const onRequest = () => {
      setVisible(true);
      appearStart.current = Date.now();
      window.dispatchEvent(new CustomEvent("alight:lecterns-visible"));
    };
    window.addEventListener("alight:request-lecterns", onRequest);
    return () => window.removeEventListener("alight:request-lecterns", onRequest);
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

  // I1: flip lectern orientation (debug)
  useEffect(() => {
    const onFlip = (e: Event) => {
      const side = (e as CustomEvent).detail?.side as "left" | "right" | undefined;
      if (side === "left") {
        DBG_LECTERNS.yawFlipLeft = !DBG_LECTERNS.yawFlipLeft;
      } else if (side === "right") {
        DBG_LECTERNS.yawFlipRight = !DBG_LECTERNS.yawFlipRight;
      }
      setFlipVersion(v => v + 1);
    };
    window.addEventListener("alight:flip-lectern", onFlip);
    return () => window.removeEventListener("alight:flip-lectern", onFlip);
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

  // K1: recompute camera pose on window resize while in lectern mode
  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (INTERACT_STATE.mode === "none") return;
        const side   = INTERACT_STATE.mode === "image" ? "left" : "right";
        const aspect = window.innerWidth / window.innerHeight;
        const result = fitLecternCamera(side, aspect);
        const cam    = camera as THREE.PerspectiveCamera;
        INTERACT_STATE.camTarget = { pos: result.pos, quat: result.quat };
        STORE.cam.fov = result.fovDeg;
        // Snap immediately (no animation for resize)
        cam.position.set(...result.pos);
        cam.quaternion.set(...result.quat);
        cam.fov = result.fovDeg;
        cam.updateProjectionMatrix();
      }, 200);
    };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); if (resizeTimer) clearTimeout(resizeTimer); };
  }, [camera]);

  useEffect(() => {
    const canvas = document.querySelector("canvas") as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const key = e.key.toLowerCase();

      // ── Enter lectern (E) ─────────────────────────────────────────────────
      if (key === "e" && INTERACT_STATE.mode === "none") {
        const leftPos  = new THREE.Vector3(-LECTERN_PLACE_X, camera.position.y, 0);
        const rightPos = new THREE.Vector3( LECTERN_PLACE_X, camera.position.y, 0);
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
        INTERACT_STATE.camFovSaved = cam.fov; // K1: save player FOV for restore on Q
        // K1: compute best-fit camera pose
        const aspect = window.innerWidth / window.innerHeight;
        const fitResult = fitLecternCamera(side, aspect);
        STORE.cam.fov = fitResult.fovDeg;     // K1: apply lectern FOV (ThreeScene reads this)
        INTERACT_STATE.camTarget      = { pos: fitResult.pos, quat: fitResult.quat };
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
        STORE.cam.fov = INTERACT_STATE.camFovSaved; // K1: restore player FOV
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
      <Lectern side="left"  controls={IMAGE_CONTROLS} appearProgress={appearProgress} keyVersion={keyVersion} flipVersion={flipVersion} />
      <Lectern side="right" controls={SOUND_CONTROLS}  appearProgress={appearProgress} keyVersion={keyVersion} flipVersion={flipVersion} />
      <InteractionHandler />
    </>
  );
}
