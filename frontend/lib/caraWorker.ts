/// <reference lib="webworker" />
// Z100: worker del lector de cara del BA-40. MediaPipe Face Landmarker (tasks-vision) con blendshapes, fuera del hilo
// principal. Recibe un cuadro reducido (ImageBitmap transferido) y devuelve 9 números en el mismo Float32Array que le
// prestaron (ida y vuelta por transferencia: sin copias). El video de la cara nunca sale de esta máquina: no hay red acá
// salvo la descarga del modelo y del wasm (locales en /alight/mediapipe/ o del CDN, según lib/caraBajo.ts).
// Mensajes: entra {tipo:"iniciar", wasm, modelo} | {tipo:"cuadro", img, t, buf} | {tipo:"cerrar"};
//           sale  {tipo:"listo"} | {tipo:"error", motivo} | {tipo:"resultado", buf}.
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { BLENDSHAPES, C_PRESENTE, C_PITCH, N_CRUDOS } from "./cara";

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let lm: FaceLandmarker | null = null;
let ultimoT = -1;
const indices = new Int32Array(BLENDSHAPES.length).fill(-1);   // posición de cada blendshape en la salida (se busca una vez)
let indicesListos = false;

async function iniciar(wasm: string, modelo: string): Promise<void> {
  try {
    const fs = await FilesetResolver.forVisionTasks(wasm);
    lm = await FaceLandmarker.createFromOptions(fs, {
      baseOptions: { modelAssetPath: modelo, delegate: "CPU" },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,   // para la inclinación de la cabeza (cabeceo)
    });
    ctx.postMessage({ tipo: "listo" });
  } catch (e) {
    ctx.postMessage({ tipo: "error", motivo: String((e as Error)?.message ?? e) });
  }
}

function detectar(img: ImageBitmap, t: number, buf: Float32Array): void {
  buf.fill(0);
  try {
    if (lm) {
      const tt = t > ultimoT ? t : ultimoT + 1;   // detectForVideo exige tiempos crecientes
      ultimoT = tt;
      const r = lm.detectForVideo(img, tt);
      const bs = r.faceBlendshapes?.[0]?.categories;
      if (bs && bs.length) {
        if (!indicesListos) {
          for (let i = 0; i < BLENDSHAPES.length; i++) indices[i] = bs.findIndex(c => c.categoryName === BLENDSHAPES[i]);
          indicesListos = true;
        }
        buf[C_PRESENTE] = 1;
        for (let i = 0; i < BLENDSHAPES.length; i++) { const k = indices[i]; buf[1 + i] = k >= 0 && bs[k] ? bs[k].score : 0; }
        // pitch: rotación alrededor de X de la matriz de transformación (column-major): atan2(R21, R22)
        const m = r.facialTransformationMatrixes?.[0]?.data;
        buf[C_PITCH] = m && m.length >= 16 ? Math.atan2(m[6], m[10]) : 0;
      }
    }
  } catch { buf[C_PRESENTE] = 0; }
  finally { img.close(); }
}

ctx.onmessage = (e: MessageEvent) => {
  const d = e.data as { tipo: string; wasm?: string; modelo?: string; img?: ImageBitmap; t?: number; buf?: Float32Array };
  if (d.tipo === "iniciar" && d.wasm && d.modelo) { void iniciar(d.wasm, d.modelo); return; }
  if (d.tipo === "cuadro" && d.img && d.buf) {
    const buf = d.buf.length >= N_CRUDOS ? d.buf : new Float32Array(N_CRUDOS);
    detectar(d.img, d.t ?? 0, buf);
    ctx.postMessage({ tipo: "resultado", buf }, [buf.buffer]);
    return;
  }
  if (d.tipo === "cerrar") { try { lm?.close(); } catch { /* ya cerrado */ } lm = null; ctx.close(); }
};
