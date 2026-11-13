// Z45: ruido celular precalculado para el fractal del prisma (DBG_FRACTAL.RUIDO_TEXTURA).
// Mismo algoritmo que cellular() del shader ("Cellular noise (Worley noise) in 2D in GLSL", Stefan Gustavson,
// MIT; ver el encabezado de fractalJungla.glsl.ts y CREDITOS.md): ventana 3×3, F1 y F2, jitter 1. La única
// diferencia es que el índice de celda se toma módulo `celdas` (en vez de 289) para que la textura se repita
// sin costura; dentro de una repetición los puntos salen del mismo hash.
// Puro y sin imports (se prueba en Node). La DataTexture se arma en Prism.tsx una sola vez.

const K = 0.142857142857, KO = 0.428571428571, JITTER = 1.0;
const mod = (x: number, m: number): number => x - m * Math.floor(x / m);
const permute = (x: number): number => mod((34 * x + 1) * x, 289);
const fract = (x: number): number => x - Math.floor(x);

/** F1 y F2 (como el shader) en el punto P, con período `celdas` en x e y. */
export function celularPeriodico(px: number, py: number, celdas: number, out: [number, number]): [number, number] {
  const ix = Math.floor(px), iy = Math.floor(py);
  const fx = px - ix, fy = py - iy;
  let f1 = Infinity, f2 = Infinity;
  for (let i = -1; i <= 1; i++) {
    const hx = permute(mod(ix + i, celdas));
    for (let j = -1; j <= 1; j++) {
      const p = permute(hx + mod(iy + j, celdas));
      const ox = fract(p * K) - KO;
      const oy = mod(Math.floor(p * K), 7) * K - KO;
      const dx = fx - (i + 0.5) + JITTER * ox;   // = Pf.x + 0.5 + jitter·ox con oi = −1, etc.
      const dy = fy - (j + 0.5) + JITTER * oy;
      const d = dx * dx + dy * dy;
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
  }
  out[0] = Math.sqrt(f1); out[1] = Math.sqrt(f2);
  return out;
}

/** Datos RGBA (R = F1, G = F2) de tam × tam texels; el texel (x, y) muestrea P = (x + 0,5) · celdas / tam. */
export function generarRuidoCelular(tam: number, celdas: number): Float32Array {
  const datos = new Float32Array(tam * tam * 4);
  const f: [number, number] = [0, 0];
  for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
    celularPeriodico(((x + 0.5) * celdas) / tam, ((y + 0.5) * celdas) / tam, celdas, f);
    const i = (y * tam + x) * 4;
    datos[i] = f[0]; datos[i + 1] = f[1]; datos[i + 2] = 0; datos[i + 3] = 1;
  }
  return datos;
}
