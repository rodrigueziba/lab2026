// Z98: visualizador retro de la tarima sin cámara (reemplaza el dibujo de ondas de Z87 en el canvas de 640×360 que se
// proyecta en el domo y se transmite). Lógica PURA y SIN imports (prueba: scripts/visualizador-tarima-test.mjs):
// paletas, color según posición y tiempo, historial circular de la cascada, suavizado, mapeo logarítmico de frecuencia,
// puntos XY (estéreo o por retardo) y radios de ESTILO / PALETA. El dibujo está en lib/visualizadorTarimaDibujo.ts.

export const ESTILOS_VIS = ["cascada", "xy"] as const;
export const PALETAS_VIS = ["ambar", "fosforo", "identidad"] as const;
export type EstiloVis = typeof ESTILOS_VIS[number];
export type PaletaVis = typeof PALETAS_VIS[number];
export const NOMBRE_ESTILO: Record<EstiloVis, string> = { cascada: "CASCADA", xy: "XY" };
export const NOMBRE_PALETA: Record<PaletaVis, string> = { ambar: "ÁMBAR", fosforo: "FÓSFORO", identidad: "IDENTIDAD" };
export function estiloValido(s: string): EstiloVis { return s === "xy" ? "xy" : "cascada"; }
export function paletaValida(p: string): PaletaVis { return p === "fosforo" || p === "identidad" ? p : "ambar"; }

// ── paletas ──
export const FONDO_VIS = "#0b0703";
/** Paletas fijas: trazo (pasada ancha, tenue) y brillo (pasada fina). ÁMBAR = rgba(255,154,31) de siempre. */
export const PALETA_FIJA: Record<"ambar" | "fosforo", { trazo: string; brillo: string }> = {
  ambar:   { trazo: "#FF9A1F", brillo: "#FFD08A" },
  fosforo: { trazo: "#33FF66", brillo: "#C8FFD2" },
};
/**
 * Índice de color (0…n) para IDENTIDAD: la posición a lo largo del recorrido (0…1) más el tiempo × velocidad (ciclos/s),
 * envuelto. Periódico: idx(pos, t) = idx(pos, t + 1/veloc). Devuelve un real (la parte fraccionaria es la mezcla).
 */
export function indiceColor(pos01: number, tS: number, veloc: number, n: number): number {
  if (!(n > 0)) return 0;
  const p = Number.isFinite(pos01) ? pos01 : 0, t = Number.isFinite(tS) ? tS : 0, v = Number.isFinite(veloc) ? veloc : 0;
  let f = (p + t * v) % 1;
  if (f < 0) f += 1;
  return f * n;
}
/** Desplazamiento en px de la tira de paleta (cascada IDENTIDAD): un ciclo por ancho, viajando con el tiempo. */
export function offsetTira(tS: number, veloc: number, ancho: number): number {
  return (indiceColor(0, tS, veloc, 1)) * ancho;
}
/** "#RRGGBB" → [r, g, b] (para construir la tabla de colores UNA vez). */
export function hexARgb(h: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  const v = m ? parseInt(m[1], 16) : 0;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
/** Tabla cíclica de n colores interpolados entre las franjas (se construye al montar; en el dibujo solo se indexa). */
export function tablaColores(franjas: readonly string[], n: number): string[] {
  const k = franjas.length, rgb = franjas.map(hexARgb), out: string[] = [];
  for (let i = 0; i < n; i++) {
    const f = (i / n) * k, a = Math.floor(f) % k, b = (a + 1) % k, m = f - Math.floor(f);
    const c = [0, 1, 2].map(j => Math.round(rgb[a][j] + (rgb[b][j] - rgb[a][j]) * m));
    out.push(`rgb(${c[0]},${c[1]},${c[2]})`);
  }
  return out;
}

// ── historial circular de la cascada ──
export interface Historial { lineas: number; bins: number; data: Float32Array; cabeza: number; cuenta: number }
export function crearHistorial(lineas: number, bins: number): Historial {
  const l = Math.max(1, Math.floor(lineas)), b = Math.max(2, Math.floor(bins));
  return { lineas: l, bins: b, data: new Float32Array(l * b), cabeza: 0, cuenta: 0 };
}
/** Copia src[0..bins) como la línea más nueva (pisa la más vieja). Sin allocations. */
export function escribirLinea(h: Historial, src: ArrayLike<number>): void {
  h.cabeza = (h.cabeza + 1) % h.lineas;
  const o = h.cabeza * h.bins;
  for (let i = 0; i < h.bins; i++) h.data[o + i] = seguro01(src[i]);
  if (h.cuenta < h.lineas) h.cuenta++;
}
/** Desplazamiento en data de la línea de edad e (0 = la más nueva). */
export function offsetLinea(h: Historial, edad: number): number {
  const e = Math.max(0, Math.min(h.lineas - 1, Math.floor(edad)));
  return (((h.cabeza - e) % h.lineas + h.lineas) % h.lineas) * h.bins;
}
export function vaciarHistorial(h: Historial): void { h.data.fill(0); h.cabeza = 0; h.cuenta = 0; }

// ── valores seguros y suavizado ──
export function seguro01(v: number): number { return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0; }
/** Subida rápida y bajada lenta (coeficientes 0…1 por cuadro); siempre en [0, 1]. */
export function suavizar(prev: number, nuevo: number, subida: number, bajada: number): number {
  const p = seguro01(prev), n = seguro01(nuevo);
  const k = n > p ? seguro01(subida) : seguro01(bajada);
  return seguro01(p + (n - p) * k);
}

// ── frecuencia en escala logarítmica suave ──
/**
 * Columna x (0…1) → fracción de frecuencia (0…1) entre minFrac y 1: mezcla de lineal y logarítmica (suave = 0 lineal,
 * 1 logarítmica). Monótona creciente y dentro de [0, 1].
 */
export function frecLog(x01: number, minFrac: number, suave: number): number {
  const x = seguro01(x01), m = Math.max(1e-4, Math.min(0.5, Number.isFinite(minFrac) ? minFrac : 0.01)), s = seguro01(suave);
  const lin = m + (1 - m) * x, log = Math.pow(m, 1 - x);
  return seguro01((1 - s) * lin + s * log);
}
/** Espectro en bytes (0…255) → `cols` valores 0…1 por columna (máximo del tramo de bins de cada columna). Sin allocations. */
export function espectroALinea(bytes: ArrayLike<number>, nBins: number, cols: number, ganancia: number, minFrac: number, suave: number, out: Float32Array): number {
  const nb = Math.max(1, Math.min(bytes.length, Math.floor(nBins))), c = Math.max(2, Math.min(out.length, Math.floor(cols)));
  const g = Number.isFinite(ganancia) ? ganancia : 1;
  let suma = 0;
  for (let j = 0; j < c; j++) {
    const a = Math.floor(frecLog(j / c, minFrac, suave) * (nb - 1)), b = Math.max(a, Math.floor(frecLog((j + 1) / c, minFrac, suave) * (nb - 1)));
    let mx = 0;
    for (let i = a; i <= b && i < nb; i++) { const v = bytes[i]; if (v > mx) mx = v; }
    const v = seguro01(((Number.isFinite(mx) ? mx : 0) / 255) * g);
    out[j] = v; suma += v;
  }
  return suma / c;
}

// ── osciloscopio XY ──
export function rmsSeguro(buf: ArrayLike<number>, n: number): number {
  const m = Math.max(0, Math.min(buf.length, Math.floor(n)));
  let s = 0;
  for (let i = 0; i < m; i++) { const v = buf[i]; if (Number.isFinite(v)) s += v * v; }
  return m ? Math.sqrt(s / m) : 0;
}
/** Retardo efectivo: acotado a [1, len − 2] para que siempre haya puntos y nunca se lea fuera de rango. */
export function retardoSeguro(len: number, retardo: number): number {
  return Math.max(1, Math.min(Math.max(1, len - 2), Math.floor(Number.isFinite(retardo) ? retardo : 10)));
}
/**
 * Puntos XY en px (out = [x0, y0, x1, y1, …]). Con `der` (estéreo): X = izquierdo, Y = derecho. Sin `der` (mono): X = muestra
 * i, Y = muestra i + retardo. Devuelve la cantidad de puntos escritos. Nunca lee fuera de rango; NaN → 0.
 */
export function puntosXY(izq: ArrayLike<number>, der: ArrayLike<number> | null, len: number, nMax: number, retardo: number,
  cx: number, cy: number, radio: number, ganancia: number, out: Float32Array): number {
  const L = Math.max(0, Math.min(izq.length, der ? der.length : izq.length, Math.floor(len)));
  const d = der ? 0 : retardoSeguro(L, retardo);
  const disp = Math.max(0, L - d), n = Math.max(0, Math.min(Math.floor(nMax), disp, out.length >> 1));
  const paso = n > 0 ? disp / n : 1, g = Number.isFinite(ganancia) ? ganancia : 1;
  for (let k = 0; k < n; k++) {
    const i = Math.min(L - 1 - d, Math.floor(k * paso));
    const xv = izq[i], yv = der ? der[i] : izq[i + d];
    const x = Number.isFinite(xv) ? Math.max(-1, Math.min(1, xv * g)) : 0, y = Number.isFinite(yv) ? Math.max(-1, Math.min(1, yv * g)) : 0;
    out[2 * k] = cx + x * radio; out[2 * k + 1] = cy - y * radio;
  }
  return n;
}
/** true si izquierdo y derecho son casi iguales (contenido mono): el XY estéreo sería una diagonal → usar retardo. */
export function casiMono(izq: ArrayLike<number>, der: ArrayLike<number>, n: number, umbral = 0.02): boolean {
  const m = Math.max(0, Math.min(izq.length, der.length, Math.floor(n)));
  let dif = 0, mag = 0;
  for (let i = 0; i < m; i++) {
    const a = Number.isFinite(izq[i]) ? izq[i] : 0, b = Number.isFinite(der[i]) ? der[i] : 0;
    dif += Math.abs(a - b); mag += Math.abs(a) + Math.abs(b);
  }
  return mag < 1e-9 || dif / mag < umbral;
}

// ── radios del atril (un solo pad encendido por grupo) ──
/** Estados 0/1 de un grupo de pads para la opción elegida (out[i] = 1 solo en la elegida; inválida → la primera). */
export function radio(opciones: readonly string[], elegida: string, out: number[]): number[] {
  let k = opciones.indexOf(elegida);
  if (k < 0) k = 0;
  for (let i = 0; i < opciones.length; i++) out[i] = i === k ? 1 : 0;
  return out;
}
/** Texto del rótulo de esquina y de la línea 2 del display (se arma solo cuando cambia la elección, no por cuadro). */
export function textoRotulo(estilo: string, paleta: string): string {
  return `${NOMBRE_ESTILO[estiloValido(estilo)]} · ${NOMBRE_PALETA[paletaValida(paleta)]}`;
}
