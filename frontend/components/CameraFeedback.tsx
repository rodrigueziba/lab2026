"use client";
// U11: Camera feedback on haz-toggle — shake + glare overlay.
// Shake: CSS rotateZ on gl.domElement. No PointerLockControls drift.
// Glare: full-screen canvas overlay drawn in useFrame each frame.
// Coupled to alight:haz-toggle (same event as U6 — no duplication).
// prefers-reduced-motion: shake reduced to ×0.5; glare unchanged.

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_SILLAS } from "@/lib/debugConfig";
import { getHazPositionsXZ } from "@/lib/haz";

interface GlareState {
  active: boolean;
  t:      number;    // elapsed time since trigger (s)
  r:      number;    // pre-parsed color channels
  g:      number;
  b:      number;
  on:     boolean;   // on-toggle = full glare + CA; off-toggle = dim only
  worldX: number;    // beam centre world X
  worldZ: number;    // beam centre world Z
}

export default function CameraFeedback() {
  const { gl } = useThree();
  // Stable DOM ref so useFrame doesn't mutate a hook return value directly
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  // ── Overlay canvas (imperative DOM — no portal/reconciler mix)
  const glareCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── Shake state (pre-allocated, no per-frame alloc)
  const shakeAmpRef  = useRef(0);
  const shakeTimeRef = useRef(0);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  // ── Glare state
  const glareRef = useRef<GlareState>({
    active: false, t: 0, r: 255, g: 255, b: 255,
    on: true, worldX: 0, worldZ: 0,
  });
  const wasGlareActiveRef = useRef(false);

  // ── Pre-allocated vectors
  const _beamNDC  = useRef(new THREE.Vector3());
  const _lookFwd  = useRef(new THREE.Vector3());

  // ── Pending event (set in handler, consumed in useFrame)
  const pendingRef = useRef<{ hazIdx: number; on: boolean } | null>(null);

  // Capture gl.domElement into a plain ref (linter: don't mutate hook returns directly)
  useEffect(() => { canvasElRef.current = gl.domElement as HTMLCanvasElement; }, [gl]);

  // ── Create/destroy overlay canvas
  useEffect(() => {
    const div = document.createElement("div");
    div.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9997;";
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:100%;height:100%;display:block;mix-blend-mode:screen;";
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    div.appendChild(canvas);
    document.body.appendChild(div);
    glareCanvasRef.current = canvas;

    const onResize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      document.body.removeChild(div);
      glareCanvasRef.current = null;
    };
  }, []);

  // ── Listen to haz-toggle events
  useEffect(() => {
    const onToggle = (e: Event) => {
      const d = (e as CustomEvent).detail as { index: number; on: boolean };
      pendingRef.current = { hazIdx: d.index, on: d.on };
    };
    window.addEventListener("alight:haz-toggle", onToggle);
    return () => window.removeEventListener("alight:haz-toggle", onToggle);
  }, []);

  // ── Per-frame: shake + glare
  useFrame(({ camera: cam }, dt) => {
    // 1. Consume pending toggle
    const pending = pendingRef.current;
    if (pending) {
      pendingRef.current = null;
      const { hazIdx, on } = pending;
      const hexColors = [
        DBG_SILLAS.hazColor0, DBG_SILLAS.hazColor1,
        DBG_SILLAS.hazColor2, DBG_SILLAS.hazColor3,
      ];
      const hex = hexColors[hazIdx] ?? "#ffffff";
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const positions = getHazPositionsXZ();
      const [wx, wz] = positions[hazIdx] ?? [0, 0];
      glareRef.current = { active: true, t: 0, r, g, b, on, worldX: wx, worldZ: wz };
      if (on) {
        const rmFactor = reducedMotion.current ? 0.5 : 1.0;
        shakeAmpRef.current  = DBG_SILLAS.u11ShakeAmpDeg * rmFactor;
        shakeTimeRef.current = 0;
      }
    }

    // 2. Shake → CSS transform on canvas element (no PointerLockControls interaction)
    if (shakeAmpRef.current > 0.003) {
      shakeAmpRef.current  *= Math.exp(-dt / DBG_SILLAS.u11ShakeTauS);
      shakeTimeRef.current += dt;
      const st    = shakeTimeRef.current;
      // Organic noise: three sine waves at coprime frequencies
      const noise = Math.sin(st * 87.3) * 0.40 +
                    Math.sin(st * 54.1) * 0.35 +
                    Math.sin(st * 31.7) * 0.25;
      const angle = shakeAmpRef.current * noise;
      if (canvasElRef.current) canvasElRef.current.style.transform = `rotateZ(${angle}deg) scale(1.04)`;
    } else if (shakeAmpRef.current > 0) {
      shakeAmpRef.current = 0;
      if (canvasElRef.current) canvasElRef.current.style.transform = "";
    }

    // 3. Glare → draw on overlay canvas
    const gs  = glareRef.current;
    const gc  = glareCanvasRef.current;
    if (!gc) return;
    const ctx = gc.getContext("2d");
    if (!ctx) return;
    const cw = gc.width;
    const ch = gc.height;

    if (!gs.active) {
      if (wasGlareActiveRef.current) {
        ctx.clearRect(0, 0, cw, ch);
        wasGlareActiveRef.current = false;
      }
      return;
    }
    wasGlareActiveRef.current = true;
    gs.t += dt;

    const atkS   = DBG_SILLAS.u11GlareAtkS;
    const tauS   = DBG_SILLAS.u11GlareTauS;
    const peakOp = gs.on ? DBG_SILLAS.u11GlarePeakOp : DBG_SILLAS.u11GlareDimOp;
    const intens = gs.t < atkS
      ? (gs.t / atkS) * peakOp
      : Math.exp(-(gs.t - atkS) / tauS) * peakOp;

    if (gs.t > atkS + tauS * 5) {
      gs.active = false;
      ctx.clearRect(0, 0, cw, ch);
      wasGlareActiveRef.current = false;
      return;
    }

    // Project beam centre to screen
    _beamNDC.current.set(gs.worldX, DBG_SILLAS.hazOriginHM, gs.worldZ).project(cam);
    let sx: number, sy: number;
    const inView = _beamNDC.current.z <= 1.0;
    if (inView) {
      sx = (1 + _beamNDC.current.x) * 0.5 * cw;
      sy = (1 - _beamNDC.current.y) * 0.5 * ch;
    } else {
      // Behind camera: use XZ angle relative to look direction for L/R edge position
      _lookFwd.current.set(0, 0, -1).applyQuaternion(cam.quaternion);
      const lookYaw  = Math.atan2(_lookFwd.current.x, _lookFwd.current.z);
      let   relYaw   = Math.atan2(gs.worldX - cam.position.x, gs.worldZ - cam.position.z) - lookYaw;
      if (relYaw >  Math.PI) relYaw -= 2 * Math.PI;
      if (relYaw < -Math.PI) relYaw += 2 * Math.PI;
      const pCam  = cam as THREE.PerspectiveCamera;
      const hfTan = Math.tan(pCam.fov * (Math.PI / 180) * 0.5);
      const ndcEst = Math.max(-0.95, Math.min(0.95, Math.tan(relYaw) / hfTan));
      sx = (1 + ndcEst) * 0.5 * cw;
      sy = ch * 0.5;
    }

    const cx = cw * 0.5;
    const cy = ch * 0.5;
    const R  = ch * DBG_SILLAS.u11GlareRadiusFr;
    const { r, g, b } = gs;
    // Inline RGBA helper (strings unavoidable for canvas2D API)
    const rgba = (a: number) => `rgba(${r},${g},${b},${Math.min(1, Math.max(0, a))})`;

    ctx.clearRect(0, 0, cw, ch);

    // Chromatic aberration (on-toggle only, first u11ChromaMs)
    if (gs.on) {
      const caF = Math.max(0, 1 - gs.t / (DBG_SILLAS.u11ChromaMs / 1000));
      if (caF > 0) {
        const ofs = caF * 20;
        const gR  = ctx.createRadialGradient(sx - ofs, sy, 0, sx - ofs, sy, R * 0.55);
        gR.addColorStop(0, `rgba(255,50,50,${intens * 0.45 * caF})`);
        gR.addColorStop(1, "rgba(255,50,50,0)");
        ctx.fillStyle = gR; ctx.fillRect(0, 0, cw, ch);
        const gB  = ctx.createRadialGradient(sx + ofs, sy, 0, sx + ofs, sy, R * 0.55);
        gB.addColorStop(0, `rgba(50,80,255,${intens * 0.45 * caF})`);
        gB.addColorStop(1, "rgba(50,80,255,0)");
        ctx.fillStyle = gB; ctx.fillRect(0, 0, cw, ch);
      }
    }

    // Main radial glow
    const gMain = ctx.createRadialGradient(sx, sy, 0, sx, sy, R);
    gMain.addColorStop(0,   rgba(intens));
    gMain.addColorStop(0.4, rgba(intens * 0.5));
    gMain.addColorStop(1,   rgba(0));
    ctx.fillStyle = gMain;
    ctx.fillRect(0, 0, cw, ch);

    // Anamorphic horizontal streak (on-toggle only)
    if (gs.on) {
      const sLen = cw * DBG_SILLAS.u11StreakLenFr;
      const sHalf = ch * DBG_SILLAS.u11StreakHFr;
      const gStreak = ctx.createLinearGradient(sx - sLen * 0.5, sy, sx + sLen * 0.5, sy);
      gStreak.addColorStop(0,    rgba(0));
      gStreak.addColorStop(0.35, rgba(intens * 0.55));
      gStreak.addColorStop(0.5,  rgba(intens * 0.80));
      gStreak.addColorStop(0.65, rgba(intens * 0.55));
      gStreak.addColorStop(1,    rgba(0));
      ctx.save();
      ctx.fillStyle = gStreak;
      ctx.beginPath();
      ctx.ellipse(sx, sy, sLen * 0.5, sHalf, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Lens flare circles (from beam toward screen center)
    const nFlare = Math.max(1, Math.min(4, Math.round(DBG_SILLAS.u11FlareCount)));
    for (let i = 0; i < nFlare; i++) {
      const frac = (i + 1) / (nFlare + 1);
      const fx   = sx + (cx - sx) * frac;
      const fy   = sy + (cy - sy) * frac;
      const fr   = R * (0.13 - i * 0.025);
      if (fr < 3) continue;
      const gFlare = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
      gFlare.addColorStop(0,   rgba(intens * (0.50 - i * 0.10)));
      gFlare.addColorStop(0.5, rgba(intens * 0.15));
      gFlare.addColorStop(1,   rgba(0));
      ctx.fillStyle = gFlare;
      ctx.beginPath();
      ctx.arc(fx, fy, fr, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  return null;
}
