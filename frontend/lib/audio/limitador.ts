// Z78: curva del limitador suave del bus maestro (WaveShaperNode, oversample "none"). PURA, sin imports
// (prueba: scripts/audio-nucleo-test.mjs).
// Identidad exacta para |x| ≤ umbral: con la interpolación lineal del WaveShaper entre puntos de una recta, la salida es
// igual a la entrada (error de redondeo de float32). Por encima, rodilla suave con tanh hacia ±1:
//   y = umbral + (1 − umbral) · tanh((|x| − umbral) / (1 − umbral))
// Entradas fuera de ±1 quedan en el extremo de la curva (≈ 0,976 con umbral 0,9): antes la salida recortaba duro en ±1.
// Sin retardo ni ganancia de compensación (a diferencia de DynamicsCompressorNode, que agrega anticipo y, en Chrome,
// ganancia automática): con señales que no pasan el umbral, el bus suena idéntico al ruteo anterior.

export const N_CURVA = 4097;   // impar: el 0 cae justo en un punto

export function limitarMuestra(x: number, umbral: number): number {
  const u = Math.min(0.999, Math.max(0, umbral));
  const a = Math.abs(x);
  if (a <= u) return x;
  const y = u + (1 - u) * Math.tanh((a - u) / (1 - u));
  return x < 0 ? -y : y;
}

/** Curva para WaveShaperNode.curve (entrada −1…1 en N puntos equiespaciados). */
export function curvaLimitador(umbral: number, n = N_CURVA, out?: Float32Array): Float32Array {
  const c = out && out.length === n ? out : new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    c[i] = limitarMuestra(x, umbral);
  }
  return c;
}

/** Réplica de la interpolación del WaveShaperNode (especificación Web Audio) para probar en Node. */
export function aplicarCurva(curva: ArrayLike<number>, x: number): number {
  const n = curva.length;
  const v = ((n - 1) / 2) * (x + 1);
  if (v <= 0) return curva[0];
  if (v >= n - 1) return curva[n - 1];
  const k = Math.floor(v), f = v - k;
  return (1 - f) * curva[k] + f * curva[k + 1];
}
