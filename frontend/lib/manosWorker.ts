/// <reference lib="webworker" />
// Z108: worker de MANOS. MediaPipe Hand Landmarker (tasks-vision, modo VIDEO, hasta 2 manos), fuera del hilo principal.
// Mismo patrón que lib/caraWorker.ts: recibe un cuadro reducido (ImageBitmap transferido) y devuelve los landmarks en el
// mismo Float32Array que le prestaron (ida y vuelta por transferencia: sin copias). El video nunca sale de esta máquina:
// no hay red acá salvo la descarga del modelo y del wasm (locales en /alight/mediapipe/ o del CDN, según lib/manosAtril.ts).
// Worker propio (no el de la cara): la cara vive y muere con el BA-40, y las manos con cualquier atril; compartirlo ataría
// los dos ciclos de vida. El wasm es el mismo (se cachea), el modelo es otro (hand_landmarker.task).
// Mensajes: entra {tipo:"iniciar", wasm, modelo, numManos} | {tipo:"cuadro", img, t, buf} | {tipo:"cerrar"};
//           sale  {tipo:"listo"} | {tipo:"error", motivo} | {tipo:"resultado", buf}.
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { B_ASPECTO, B_N, B_CABECERA, STRIDE_MANO, M_PRESENTE, M_ETIQUETA_DER, M_CONFIANZA, M_PUNTOS, MAX_MANOS, N_BUF_MANOS, N_PUNTOS } from "./manos";

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let lm: HandLandmarker | null = null;
let ultimoT = -1;

async function iniciar(wasm: string, modelo: string, numManos: number): Promise<void> {
  try {
    const fs = await FilesetResolver.forVisionTasks(wasm);
    lm = await HandLandmarker.createFromOptions(fs, {
      baseOptions: { modelAssetPath: modelo, delegate: "CPU" },
      runningMode: "VIDEO",
      numHands: Math.max(1, Math.min(MAX_MANOS, numManos)),
    });
    ctx.postMessage({ tipo: "listo" });
  } catch (e) {
    ctx.postMessage({ tipo: "error", motivo: String((e as Error)?.message ?? e) });
  }
}

function detectar(img: ImageBitmap, t: number, buf: Float32Array): void {
  buf.fill(0);
  buf[B_ASPECTO] = img.height > 0 ? img.width / img.height : 4 / 3;
  try {
    if (lm) {
      const tt = t > ultimoT ? t : ultimoT + 1;   // detectForVideo exige tiempos crecientes
      ultimoT = tt;
      const r = lm.detectForVideo(img, tt);
      const n = Math.min(MAX_MANOS, r.landmarks?.length ?? 0);
      buf[B_N] = n;
      for (let h = 0; h < n; h++) {
        const b = B_CABECERA + h * STRIDE_MANO;
        const pts = r.landmarks[h];
        const cat = r.handedness?.[h]?.[0] ?? r.handednesses?.[h]?.[0];
        buf[b + M_PRESENTE] = pts && pts.length >= N_PUNTOS ? 1 : 0;
        buf[b + M_ETIQUETA_DER] = cat?.categoryName === "Right" ? 1 : 0;   // etiqueta de MediaPipe (imagen supuesta espejada)
        buf[b + M_CONFIANZA] = cat?.score ?? 0;
        if (!pts) continue;
        for (let i = 0; i < N_PUNTOS && i < pts.length; i++) {
          buf[b + M_PUNTOS + i * 3] = pts[i].x; buf[b + M_PUNTOS + i * 3 + 1] = pts[i].y; buf[b + M_PUNTOS + i * 3 + 2] = pts[i].z;
        }
      }
    }
  } catch { buf[B_N] = 0; }
  finally { img.close(); }
}

ctx.onmessage = (e: MessageEvent) => {
  const d = e.data as { tipo: string; wasm?: string; modelo?: string; numManos?: number; img?: ImageBitmap; t?: number; buf?: Float32Array };
  if (d.tipo === "iniciar" && d.wasm && d.modelo) { void iniciar(d.wasm, d.modelo, d.numManos ?? 2); return; }
  if (d.tipo === "cuadro" && d.img && d.buf) {
    const buf = d.buf.length >= N_BUF_MANOS ? d.buf : new Float32Array(N_BUF_MANOS);
    detectar(d.img, d.t ?? 0, buf);
    ctx.postMessage({ tipo: "resultado", buf }, [buf.buffer]);
    return;
  }
  if (d.tipo === "cerrar") { try { lm?.close(); } catch { /* ya cerrado */ } lm = null; ctx.close(); }
};
