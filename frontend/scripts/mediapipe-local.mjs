// Z100: deja MediaPipe local para el lector de cara del BA-40 (sin depender del CDN en tiempo de ejecución):
//   public/alight/mediapipe/wasm/  ← copia de node_modules/@mediapipe/tasks-vision/wasm (con SIMD y sin SIMD)
//   public/alight/mediapipe/face_landmarker.task ← modelo oficial (float16, versión 1) de storage.googleapis.com
//   public/alight/mediapipe/hand_landmarker.task ← Z108: modelo oficial de manos (float16, versión 1), mismo origen
// Si faltan, lib/caraBajo.ts usa el CDN (jsDelivr para el wasm, storage.googleapis.com para el modelo).
// Uso (en frontend/): node scripts/mediapipe-local.mjs
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = new URL('../', import.meta.url).pathname;
const ORIGEN = path.join(RAIZ, 'node_modules/@mediapipe/tasks-vision/wasm');
const DESTINO = path.join(RAIZ, 'public/alight/mediapipe');
const MODELO_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const ARCHIVOS = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm'];

fs.mkdirSync(path.join(DESTINO, 'wasm'), { recursive: true });
for (const a of ARCHIVOS) {
  fs.copyFileSync(path.join(ORIGEN, a), path.join(DESTINO, 'wasm', a));
  console.log('copiado wasm/' + a, (fs.statSync(path.join(DESTINO, 'wasm', a)).size / 1e6).toFixed(1), 'MB');
}
const modelo = path.join(DESTINO, 'face_landmarker.task');
if (fs.existsSync(modelo) && fs.statSync(modelo).size > 1e6) console.log('modelo ya presente', (fs.statSync(modelo).size / 1e6).toFixed(1), 'MB');
else {
  const r = await fetch(MODELO_URL);
  if (!r.ok) { console.error('no se pudo bajar el modelo:', r.status, MODELO_URL); process.exit(1); }
  fs.writeFileSync(modelo, Buffer.from(await r.arrayBuffer()));
  console.log('bajado face_landmarker.task', (fs.statSync(modelo).size / 1e6).toFixed(1), 'MB desde', MODELO_URL);
}
// Z108: modelo de manos (MANOS en los atriles; lib/manosAtril.ts usa el CDN si falta)
const MODELO_MANOS_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const manos = path.join(DESTINO, 'hand_landmarker.task');
if (fs.existsSync(manos) && fs.statSync(manos).size > 1e6) console.log('modelo de manos ya presente', (fs.statSync(manos).size / 1e6).toFixed(1), 'MB');
else {
  const r = await fetch(MODELO_MANOS_URL);
  if (!r.ok) { console.error('no se pudo bajar el modelo de manos:', r.status, MODELO_MANOS_URL); process.exit(1); }
  fs.writeFileSync(manos, Buffer.from(await r.arrayBuffer()));
  console.log('bajado hand_landmarker.task', (fs.statSync(manos).size / 1e6).toFixed(1), 'MB desde', MODELO_MANOS_URL);
}
