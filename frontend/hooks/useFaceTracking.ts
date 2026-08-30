"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

export type FaceStatus =
  | "idle"
  | "requesting"
  | "loading"
  | "detecting"   // camera running, waiting for face
  | "captured"    // face found → snapshot taken → camera released
  | "fallback"    // no MediaPipe, used center-crop snapshot
  | "denied"
  | "error";

const CANVAS_SIZE         = 256;
const CAPTURE_TIMEOUT_MS  = 6000;  // give up waiting for face after 6s → use center crop
const MP_WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm";
const MP_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

interface LandmarkPoint { x: number; y: number; z: number }
interface Landmarker {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): { faceLandmarks?: LandmarkPoint[][] };
  close(): void;
}

const DEFAULT_BOX = { x: 0.18, y: 0.05, w: 0.64, h: 0.90 };

export function useFaceTracking() {
  const [status,   setStatus]   = useState<FaceStatus>("idle");
  // snapshot: stable texture created once on capture; null until then
  const [snapshot, setSnapshot] = useState<THREE.CanvasTexture | null>(null);

  const videoRef      = useRef<HTMLVideoElement | null>(null);
  const canvasRef     = useRef<HTMLCanvasElement | null>(null);
  const textureRef    = useRef<THREE.CanvasTexture | null>(null);
  const landmarkerRef = useRef<Landmarker | null>(null);
  const lastTimeRef   = useRef(-1);
  const faceBoxRef    = useRef({ ...DEFAULT_BOX });
  const capturedRef   = useRef(false);
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const video = document.createElement("video");
    video.playsInline = true;
    video.muted       = true;
    video.style.cssText =
      "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1";
    document.body.appendChild(video);
    videoRef.current = video;

    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = CANVAS_SIZE;
    canvasRef.current = canvas;

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace      = THREE.SRGBColorSpace;
    tex.minFilter       = THREE.LinearFilter;
    tex.generateMipmaps = false;
    textureRef.current  = tex;

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      stopStream(video);
      document.body.removeChild(video);
      tex.dispose();
      landmarkerRef.current?.close();
    };
  }, []);

  // ── doCapture: draw current frame, stop camera, publish texture ─────────────
  const doCapture = useCallback((statusAfter: FaceStatus) => {
    if (capturedRef.current) return;
    capturedRef.current = true;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }

    const video   = videoRef.current;
    const canvas  = canvasRef.current;
    const texture = textureRef.current;
    if (video && canvas && texture && video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const b  = faceBoxRef.current;
        ctx.save();
        ctx.translate(CANVAS_SIZE, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, b.x * vw, b.y * vh, b.w * vw, b.h * vh, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.restore();
        texture.needsUpdate = true;
      }
      setSnapshot(texture);
    }

    // Release the camera
    if (video) stopStream(video);
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    setStatus(statusAfter);
  }, []);

  // ── start: request camera + load MediaPipe, then begin detecting ────────────
  const start = useCallback(async () => {
    if (status !== "idle") return;
    setStatus("requesting");

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

    try {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const resolver = await FilesetResolver.forVisionTasks(MP_WASM);
      landmarkerRef.current = await FaceLandmarker.createFromOptions(resolver, {
        baseOptions: { modelAssetPath: MP_MODEL, delegate: "CPU" },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
      setStatus("detecting");
    } catch (err) {
      console.warn("[useFaceTracking] MediaPipe unavailable — using center-crop.", err);
      // Wait briefly for video to stabilise, then snap
      setTimeout(() => doCapture("fallback"), 800);
      return;
    }

    // Timeout: if no face detected after CAPTURE_TIMEOUT_MS, snap anyway
    timerRef.current = setTimeout(() => {
      if (!capturedRef.current) doCapture("fallback");
    }, CAPTURE_TIMEOUT_MS);
  }, [status, doCapture]);

  // ── tick: called every frame from useFrame — no-op after capture ────────────
  const tick = useCallback(() => {
    if (capturedRef.current) return;

    const video   = videoRef.current;
    const lm      = landmarkerRef.current;
    if (!video || !lm) return;
    if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) return;
    if (video.currentTime === lastTimeRef.current) return;
    lastTimeRef.current = video.currentTime;

    try {
      const result = lm.detectForVideo(video, performance.now());
      const pts    = result.faceLandmarks?.[0];
      if (pts && pts.length > 0) {
        // Compute tight bounding box from landmarks
        let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
        for (const p of pts) {
          if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
          if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
        }
        [x0, x1] = [1 - x1, 1 - x0];  // mirror
        const pw = (x1 - x0) * 0.32;
        const ph = (y1 - y0) * 0.32;
        faceBoxRef.current = {
          x: Math.max(0, x0 - pw),
          y: Math.max(0, y0 - ph),
          w: Math.min(1, x1 + pw) - Math.max(0, x0 - pw),
          h: Math.min(1, y1 + ph) - Math.max(0, y0 - ph),
        };
        // Face clearly detected — capture immediately
        doCapture("captured");
      }
    } catch { /* keep trying */ }
  }, [doCapture]);

  return { snapshot, status, tick, start };
}

function stopStream(video: HTMLVideoElement) {
  const stream = video.srcObject as MediaStream | null;
  stream?.getTracks().forEach(t => t.stop());
  video.srcObject = null;
}
