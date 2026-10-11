"use client";

// T1: Face capture con MediaPipe best-frame scoring.
// Mantiene la cámara activa para FaceDome (VideoTexture en LIVE_TEX_REF).
// Captura el mejor frame estático como CanvasTexture para las cabezas.
// La detección corre en un loop RAF interno — NUNCA en useFrame de React.
//
// Despacha:
//   alight:camera-started  — VideoTexture lista en LIVE_TEX_REF
//   alight:face-captured   — CanvasTexture lista (o fallback centro-crop)

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { LIVE_TEX_REF, FACE_TEX_REF } from "@/lib/faceShared";
import { DBG_FACE } from "@/lib/debugConfig";

export type FaceStatus = "idle" | "requesting" | "denied" | "capturing" | "captured" | "error";

const FACE_DETECT_HZ = 12;    // máximo de llamadas detectForVideo por segundo
const FACE_SCORE_OK  = 0.72;  // cortar antes si el puntaje supera este umbral
const CANVAS_SIZE    = 512;   // textura cuadrada de 512 × 512 px
const ANALYSIS_SIZE  = 32;    // canvas interno para cálculo de nitidez y exposición

const MP_WASM  = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
const MP_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

type LM = Array<{ x: number; y: number; z: number }>;
type BS = Array<{ categoryName: string; score: number }>;

export function useFaceTracking() {
  const [status,   setStatus]   = useState<FaceStatus>("idle");
  const [snapshot, setSnapshot] = useState<THREE.CanvasTexture | null>(null);

  const videoRef        = useRef<HTMLVideoElement | null>(null);
  const canvasRef       = useRef<HTMLCanvasElement | null>(null);
  const analysisRef     = useRef<HTMLCanvasElement | null>(null);
  const snapTexRef      = useRef<THREE.CanvasTexture | null>(null);
  const liveTexRef      = useRef<THREE.VideoTexture | null>(null);
  const landmarkerRef   = useRef<any>(null);
  const captureTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafIdRef        = useRef<number>(0);
  const lastTime        = useRef(-1);
  const lastDetectMs    = useRef(0);
  const bestScore       = useRef(-1);
  const bestBox         = useRef(defaultBox());
  const bestPts         = useRef<LM | null>(null);    // landmarks del mejor frame
  const capturedRef     = useRef(false);
  const capturingRef    = useRef(false);

  // Mount: crear elementos DOM y silenciar el mensaje informativo de TF Lite
  useEffect(() => {
    // MediaPipe escribe "Created TensorFlow Lite XNNPACK delegate for CPU" via console.error.
    // No es un fallo; lo silenciamos mientras el tracker esté montado.
    const origError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].includes("Created TensorFlow Lite XNNPACK delegate")) return;
      origError(...args);
    };

    const video = document.createElement("video");
    video.playsInline = true;
    video.muted       = true;
    video.autoplay    = true;
    video.style.cssText =
      "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1";
    document.body.appendChild(video);
    videoRef.current = video;

    const canvas       = document.createElement("canvas");
    canvas.width       = CANVAS_SIZE;
    canvas.height      = CANVAS_SIZE;
    canvasRef.current  = canvas;

    const analysis     = document.createElement("canvas");
    analysis.width     = ANALYSIS_SIZE;
    analysis.height    = ANALYSIS_SIZE;
    analysisRef.current = analysis;

    const tex           = new THREE.CanvasTexture(canvas);
    tex.colorSpace      = THREE.SRGBColorSpace;
    tex.minFilter       = THREE.LinearFilter;
    tex.generateMipmaps = false;
    snapTexRef.current  = tex;

    return () => {
      console.error = origError;
      stopStream(video);
      document.body.removeChild(video);
      liveTexRef.current?.dispose();
      tex.dispose();
      LIVE_TEX_REF.value = null;
      FACE_TEX_REF.value = null;
      if (captureTimer.current) clearTimeout(captureTimer.current);
      if (rafIdRef.current)     cancelAnimationFrame(rafIdRef.current);
      landmarkerRef.current?.close().catch(() => {});
    };
  }, []);

  const takeBestFrame = useCallback(() => {
    if (capturedRef.current) return;
    capturedRef.current  = true;
    capturingRef.current = false;
    if (captureTimer.current) { clearTimeout(captureTimer.current); captureTimer.current = null; }
    if (rafIdRef.current)     { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = 0; }

    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const tex    = snapTexRef.current;

    if (video && canvas && tex && video.readyState >= 2) {
      const vw    = video.videoWidth  || 1280;
      const vh    = video.videoHeight || 720;
      const b     = bestBox.current;
      const pts   = bestPts.current;
      const ctx2d = canvas.getContext("2d");
      if (ctx2d) {
        // Centro de la cara en píxeles de video
        const cx = (b.x + b.w * 0.5) * vw;
        const cy = (b.y + b.h * 0.5) * vh;

        // Tamaño del recorte: span facial con margen ya incluido en extractFaceBox (15 %)
        const srcSize = Math.max(b.w * vw, b.h * vh);

        // Ángulo de rotación para nivelar los ojos
        let angle = 0;
        if (pts) {
          const lEye = pts[33];
          const rEye = pts[263];
          if (lEye && rEye) {
            // MediaPipe landmark 33 = outer corner left eye, 263 = outer corner right eye
            // En imagen sin espejo: left eye del sujeto aparece a la derecha (mayor x)
            angle = Math.atan2((rEye.y - lEye.y) * vh, (rEye.x - lEye.x) * vw);
          }
        }

        ctx2d.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx2d.save();
        ctx2d.translate(CANVAS_SIZE / 2, CANVAS_SIZE / 2);
        ctx2d.rotate(-angle);                        // nivelar ojos
        const scale = CANVAS_SIZE / srcSize;
        ctx2d.scale(scale, scale);
        // Dibujar SIN espejo: la cara queda como la ve otra persona
        ctx2d.drawImage(
          video,
          cx - srcSize / 2, cy - srcSize / 2, srcSize, srcSize,
          -srcSize / 2,     -srcSize / 2,      srcSize, srcSize,
        );
        ctx2d.restore();
        tex.needsUpdate = true;
      }
    }

    if (snapTexRef.current) {
      FACE_TEX_REF.value = snapTexRef.current;
      setSnapshot(snapTexRef.current);
    }
    setStatus("captured");
    window.dispatchEvent(new CustomEvent("alight:face-captured"));
  }, []);

  // Loop interno de detección — rate-limited a FACE_DETECT_HZ, no pasa por useFrame
  const startDetectionLoop = useCallback(() => {
    const detect = () => {
      if (capturedRef.current) return;

      const now   = performance.now();
      const video = videoRef.current;
      const lm    = landmarkerRef.current;
      const ac    = analysisRef.current;

      if (
        video && lm && ac &&
        video.readyState >= 2 &&
        video.currentTime !== lastTime.current &&
        now - lastDetectMs.current >= 1000 / FACE_DETECT_HZ
      ) {
        lastTime.current     = video.currentTime;
        lastDetectMs.current = now;
        try {
          const result = lm.detectForVideo(video, now);
          const pts    = result?.faceLandmarks?.[0]  as LM   | undefined;
          const bs     = result?.faceBlendshapes?.[0]?.categories as BS | undefined;

          if (pts && pts.length >= 100) {
            const box   = extractFaceBox(pts);
            const score = evaluateFrame(pts, bs, video, box, ac);
            if (score > bestScore.current) {
              bestScore.current = score;
              bestBox.current   = box;
              bestPts.current   = pts;
              if (score >= FACE_SCORE_OK) {
                takeBestFrame();
                return; // para el loop
              }
            }
          }
        } catch { /* sigue intentando */ }
      }

      rafIdRef.current = requestAnimationFrame(detect);
    };

    rafIdRef.current = requestAnimationFrame(detect);
  }, [takeBestFrame]);

  const start = useCallback(async () => {
    if (status !== "idle") return;
    setStatus("requesting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        // 1280×720 para obtener recortes de alta resolución
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch {
      setStatus("denied");
      window.dispatchEvent(new CustomEvent("alight:face-captured"));
      return;
    }

    const video = videoRef.current!;
    video.srcObject = stream;
    await video.play().catch(() => {});

    // VideoTexture viva para el domo — mantiene la cámara activa
    const liveTex           = new THREE.VideoTexture(video);
    liveTex.colorSpace      = THREE.SRGBColorSpace;
    liveTex.minFilter       = THREE.LinearFilter;
    liveTex.generateMipmaps = false;
    liveTex.wrapS           = THREE.RepeatWrapping;
    liveTex.repeat.x        = -1;
    liveTex.offset.x        = 1;
    liveTexRef.current      = liveTex;
    LIVE_TEX_REF.value      = liveTex;
    window.dispatchEvent(new CustomEvent("alight:camera-started"));

    setStatus("capturing");
    capturingRef.current = true;
    bestScore.current    = -1;
    bestBox.current      = defaultBox();
    bestPts.current      = null;

    // Timer de fallback: si no se supera FACE_SCORE_OK en FACE_CAPTURE_MS, usar lo mejor hasta ahora
    captureTimer.current = setTimeout(takeBestFrame, DBG_FACE.captureMs);

    try {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const resolver = await FilesetResolver.forVisionTasks(MP_WASM);
      landmarkerRef.current = await FaceLandmarker.createFromOptions(resolver, {
        baseOptions: { modelAssetPath: MP_MODEL, delegate: "CPU" },
        runningMode: "VIDEO",
        numFaces:    1,
        outputFaceBlendshapes:              true,   // para scoring de ojos/boca
        outputFacialTransformationMatrixes: false,
      });
      if (capturingRef.current) startDetectionLoop();
    } catch {
      // MediaPipe no disponible — captura por timeout ya programada
    }
  }, [status, takeBestFrame, startDetectionLoop]);

  return { snapshot, status, start };
}

// ── Helpers de scoring ────────────────────────────────────────────────────────

function defaultBox() {
  return { x: 0.20, y: 0.10, w: 0.60, h: 0.80 };
}

function evaluateFrame(
  pts: LM,
  bs: BS | undefined,
  video: HTMLVideoElement,
  box: ReturnType<typeof extractFaceBox>,
  analysisCanvas: HTMLCanvasElement,
): number {
  // Cara debe ocupar al menos 25 % de la altura del frame
  if (box.h < 0.25) return 0;

  // Bounding box en coordenadas normalizadas
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
  }
  const fW = x1 - x0;
  const fH = y1 - y0;
  if (fW < 0.01 || fH < 0.01) return 0;

  const faceSizeScore = Math.min(1, fW * fH * 4);

  // Frontalidad: nariz centrada entre los ojos
  const nose   = pts[4]  ?? pts[0];
  const noseDev = Math.abs(nose.x - (x0 + fW / 2));
  const frontality = 1.0 - Math.min(1, (noseDev / fW) * 4);

  // Completitud: todos los puntos dentro del frame
  const complete = pts.every(p => p.x > 0.02 && p.x < 0.98 && p.y > 0.02 && p.y < 0.98) ? 1 : 0.5;

  // Horizontalidad de los ojos
  const lEye = pts[33]  ?? pts[0];
  const rEye = pts[263] ?? pts[0];
  const levelness = 1.0 - Math.min(1, Math.abs(lEye.y - rEye.y) * 8);

  // Blendshapes: ojos abiertos y boca cerrada
  let blendScore = 1.0;
  if (bs?.length) {
    const blink_L  = bs.find(c => c.categoryName === "eyeBlinkLeft")?.score  ?? 0;
    const blink_R  = bs.find(c => c.categoryName === "eyeBlinkRight")?.score ?? 0;
    const jaw_open = bs.find(c => c.categoryName === "jawOpen")?.score        ?? 0;
    if (blink_L > 0.3 || blink_R > 0.3 || jaw_open > 0.3) blendScore = 0;
  }
  if (blendScore === 0) return 0; // no tiene sentido calcular más

  // Nitidez y exposición (necesita acceso a píxeles del video)
  const { sharpness, exposure } = computePixelScores(video, box, analysisCanvas);

  return faceSizeScore * frontality * complete * levelness * blendScore
       * (0.4 + 0.6 * sharpness)
       * (0.4 + 0.6 * exposure);
}

function computePixelScores(
  video: HTMLVideoElement,
  box:   { x: number; y: number; w: number; h: number },
  ac:    HTMLCanvasElement,
): { sharpness: number; exposure: number } {
  const ctx = ac.getContext("2d");
  if (!ctx || video.readyState < 2) return { sharpness: 0.5, exposure: 0.5 };
  const S  = ac.width; // ANALYSIS_SIZE = 32
  const vw = video.videoWidth  || 1280;
  const vh = video.videoHeight || 720;
  try {
    ctx.drawImage(video, box.x * vw, box.y * vh, box.w * vw, box.h * vh, 0, 0, S, S);
  } catch {
    return { sharpness: 0.5, exposure: 0.5 };
  }
  const px = ctx.getImageData(0, 0, S, S).data;

  const gray = new Float32Array(S * S);
  let totalLum = 0;
  for (let i = 0; i < S * S; i++) {
    const lum = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    gray[i]   = lum;
    totalLum += lum;
  }
  const meanLum = totalLum / (S * S);

  // Varianza del laplaciano como proxy de nitidez
  let lapSum = 0, lapSum2 = 0, n = 0;
  for (let y = 1; y < S - 1; y++) {
    for (let x = 1; x < S - 1; x++) {
      const lap = gray[(y - 1) * S + x] + gray[(y + 1) * S + x]
                + gray[y * S + x - 1]   + gray[y * S + x + 1]
                - 4 * gray[y * S + x];
      lapSum += lap; lapSum2 += lap * lap; n++;
    }
  }
  const lapMean = lapSum / n;
  const lapVar  = lapSum2 / n - lapMean * lapMean;
  const sharpness = Math.min(1, lapVar / 350);

  // Exposición: luminancia media entre 80 y 180, sin zonas quemadas
  let exposure: number;
  if (meanLum >= 80 && meanLum <= 180) {
    exposure = 1.0;
  } else if (meanLum < 80) {
    exposure = Math.max(0, meanLum / 80);
  } else {
    exposure = Math.max(0, 1 - (meanLum - 180) / 75);
  }

  return { sharpness, exposure };
}

function extractFaceBox(pts: LM) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
  }
  // Margen del 15 %
  const pw = (x1 - x0) * 0.15;
  const ph = (y1 - y0) * 0.15;
  return {
    x: Math.max(0, x0 - pw),
    y: Math.max(0, y0 - ph),
    w: Math.min(1, x1 + pw) - Math.max(0, x0 - pw),
    h: Math.min(1, y1 + ph) - Math.max(0, y0 - ph),
  };
}

function stopStream(video: HTMLVideoElement) {
  (video.srcObject as MediaStream | null)?.getTracks().forEach(t => t.stop());
  video.srcObject = null;
}
