"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

// ── Status ────────────────────────────────────────────────────────────────────
export type FaceStatus =
  | "idle"       // not started
  | "requesting" // asking for camera permission
  | "loading"    // camera granted; loading MediaPipe WASM + model
  | "active"     // MediaPipe running, landmarks detected
  | "fallback"   // MediaPipe failed; using center-crop of webcam
  | "denied"     // camera permission rejected
  | "error";     // unrecoverable

// ── Constants ─────────────────────────────────────────────────────────────────
const CANVAS_SIZE = 256; // output texture resolution (square)

// MediaPipe WASM served from CDN — fetched at runtime, not bundled by webpack.
// Documented path from mediapipe.dev/solutions/tasks/vision.
const MP_WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm";
const MP_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// ── Minimal type for the landmarker instance ──────────────────────────────────
// Avoids tight coupling to @mediapipe/tasks-vision TypeScript types.
interface LandmarkPoint { x: number; y: number; z: number }
interface Landmarker {
  detectForVideo(
    video: HTMLVideoElement,
    timestampMs: number,
  ): { faceLandmarks?: LandmarkPoint[][] };
  close(): void;
}

// ── Default crop box — used before first landmark detection ──────────────────
const DEFAULT_BOX = { x: 0.18, y: 0.05, w: 0.64, h: 0.90 };

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useFaceTracking() {
  const [status, setStatus]         = useState<FaceStatus>("idle");
  const [faceTexture, setFaceTexture] = useState<THREE.CanvasTexture | null>(null);

  // All mutable state lives in refs — no re-renders during the hot path
  const videoRef      = useRef<HTMLVideoElement | null>(null);
  const canvasRef     = useRef<HTMLCanvasElement | null>(null);
  const textureRef    = useRef<THREE.CanvasTexture | null>(null);
  const landmarkerRef = useRef<Landmarker | null>(null);
  const lastTimeRef   = useRef(-1);
  const faceBoxRef    = useRef({ ...DEFAULT_BOX });

  // ── Bootstrap hidden video + canvas + CanvasTexture ──────────────────────
  useEffect(() => {
    // Hidden video element — opacity:0.01 (not 0) avoids browser paint-skip
    const video = document.createElement("video");
    video.playsInline = true;
    video.muted       = true;
    video.style.cssText =
      "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1";
    document.body.appendChild(video);
    videoRef.current = video;

    // Output canvas — CPU-side face crop (drives the texture)
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = CANVAS_SIZE;
    canvasRef.current = canvas;

    // CanvasTexture — Three.js polls canvas pixels when needsUpdate = true
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace   = THREE.SRGBColorSpace;
    tex.minFilter    = THREE.LinearFilter; // no mipmap generation for live canvas
    tex.generateMipmaps = false;
    textureRef.current = tex;
    setFaceTexture(tex);

    return () => {
      stopStream(video);
      document.body.removeChild(video);
      tex.dispose();
      landmarkerRef.current?.close();
    };
  }, []);

  // ── start() — call once to request camera + load MediaPipe ───────────────
  const start = useCallback(async () => {
    if (status !== "idle") return;
    setStatus("requesting");

    // 1. Camera permission
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch {
      setStatus("denied");
      return;
    }

    const video = videoRef.current!;
    video.srcObject = stream;
    await video.play().catch(() => {});
    setStatus("loading");

    // 2. MediaPipe FaceLandmarker — dynamic import avoids SSR bundling
    try {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const resolver = await FilesetResolver.forVisionTasks(MP_WASM);
      landmarkerRef.current = await FaceLandmarker.createFromOptions(resolver, {
        baseOptions: {
          modelAssetPath: MP_MODEL,
          delegate: "CPU", // GPU delegate requires additional COOP/COEP headers
        },
        runningMode:           "VIDEO",
        numFaces:              1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
      setStatus("active");
    } catch (err) {
      console.warn("[useFaceTracking] MediaPipe unavailable — falling back to center-crop.", err);
      setStatus("fallback");
    }
  }, [status]);

  // ── tick() — call every frame from useFrame to keep texture current ────────
  // All logic is ref-based: never triggers React re-renders.
  const tick = useCallback(() => {
    const video   = videoRef.current;
    const canvas  = canvasRef.current;
    const texture = textureRef.current;
    if (!video || !canvas || !texture) return;
    if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    // ── Landmark detection (only when a new video frame is available) ──────
    const lm = landmarkerRef.current;
    if (lm && video.currentTime !== lastTimeRef.current) {
      lastTimeRef.current = video.currentTime;
      try {
        const result = lm.detectForVideo(video, performance.now());
        const pts    = result.faceLandmarks?.[0];
        if (pts && pts.length > 0) {
          // Bounding box in normalized [0, 1] coords
          let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
          for (const p of pts) {
            if (p.x < x0) x0 = p.x;
            if (p.x > x1) x1 = p.x;
            if (p.y < y0) y0 = p.y;
            if (p.y > y1) y1 = p.y;
          }
          // Mirror x-axis: webcam coords are horizontally flipped vs canvas
          [x0, x1] = [1 - x1, 1 - x0];
          // Expand 30% to include hair, chin, ears
          const pw = (x1 - x0) * 0.30;
          const ph = (y1 - y0) * 0.30;
          faceBoxRef.current = {
            x: Math.max(0,    x0 - pw),
            y: Math.max(0,    y0 - ph),
            w: Math.min(1, x1 + pw) - Math.max(0, x0 - pw),
            h: Math.min(1, y1 + ph) - Math.max(0, y0 - ph),
          };
        }
      } catch {
        // Detection error — keep the last known crop box
      }
    }

    // ── Draw cropped face into the output canvas ────────────────────────────
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const b   = faceBoxRef.current;
    const sx  = b.x * vw;
    const sy  = b.y * vh;
    const sw  = b.w * vw;
    const sh  = b.h * vh;

    ctx.save();
    // Flip horizontally so the face reads as "natural" (left eye on the left
    // from the viewer's perspective) when applied to a forward-facing 3D mesh.
    ctx.translate(CANVAS_SIZE, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.restore();

    // Mark dirty — Three.js will re-upload on next render
    texture.needsUpdate = true;
  }, []); // all reads are from stable refs — no dep array needed

  // ── stop() — release camera and reset ────────────────────────────────────
  const stop = useCallback(() => {
    const video = videoRef.current;
    if (video) stopStream(video);
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    lastTimeRef.current   = -1;
    faceBoxRef.current    = { ...DEFAULT_BOX };
    setStatus("idle");
  }, []);

  return { faceTexture, tick, status, start, stop };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function stopStream(video: HTMLVideoElement) {
  const stream = video.srcObject as MediaStream | null;
  stream?.getTracks().forEach(t => t.stop());
  video.srcObject = null;
}
