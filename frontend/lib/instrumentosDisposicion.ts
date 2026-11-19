// Z99b: disposición de los instrumentos detrás de la tarima. Puro y sin imports (se prueba en Node:
// scripts/instrumentos-arco-test.mjs). Escribe en objetos de salida reutilizados (sin allocations por frame).
//
// "arco" (default): todos los instrumentos en un arco de circunferencia centrado en el centro de la tarima, del lado
// opuesto a las sillas, a la misma distancia (radio) del centro y mirando al centro. El índice 0 es el centro del arco
// (la caja de ritmos, sobre el eje sillas → tarima, exactamente donde la puso Z88); +1, +2, +3 hacia la derecha del eje
// visto desde las sillas (hoy +X, el lado del atril de sonido) y −1, −2, −3 hacia el otro lado.
// "linea": la línea de Z88 (perpendicular al eje, separados SLOTS_SEP_M, mirando al centro de la tarima).

/** Centro de la tarima (cx, cz) y dirección unitaria (ux, uz) tarima → lado opuesto a las sillas (= EjeTarima de playTarima). */
export interface EjeArco { cx: number; cz: number; ux: number; uz: number }
export interface PoseSlot { x: number; z: number; yaw: number }

export type Disposicion = "arco" | "linea";
export function disposicion(v: string | undefined): Disposicion { return v === "linea" ? "linea" : "arco"; }

/** Índices soportados: −INDICE_MAX…+INDICE_MAX (7 slots). */
export const INDICE_MAX = 3;
export const N_SLOTS_ARCO = 2 * INDICE_MAX + 1;

/** Orden por defecto de los slots (índice desde el centro del arco → instrumento). null = libre. */
export const ORDEN_SLOTS: Readonly<Record<number, { id: string; nombre: string; ocupado: boolean } | null>> = {
  [-3]: null,
  [-2]: null,
  [-1]: { id: "sintetizador", nombre: "SINTETIZADOR SY-40 (Z101, reservado)", ocupado: false },
  [0]:  { id: "ritmos",       nombre: "CAJA DE RITMOS", ocupado: true },
  [1]:  { id: "bajo",         nombre: "BAJO ÁCIDO BA-40", ocupado: true },
  [2]:  { id: "sampler",      nombre: "SAMPLER SM-40 (Z102, reservado)", ocupado: false },
  [3]:  null,
};

const fin = (v: number, d: number): number => (Number.isFinite(v) ? v : d);
/** Índice entero acotado a −INDICE_MAX…+INDICE_MAX. */
export function indiceValido(i: number): number {
  return Math.max(-INDICE_MAX, Math.min(INDICE_MAX, Math.round(fin(i, 0))));
}

/** Ángulo (rad) entre vecinos para que la cuerda (distancia en línea recta) sea `separacion`: 2·asin(sep / 2R). */
export function anguloVecinos(radio: number, separacion: number): number {
  const r = Math.max(1e-6, fin(radio, 1)), s = Math.max(0, fin(separacion, 0));
  return 2 * Math.asin(Math.min(1, s / (2 * r)));
}
/** Cuerda (m) que corresponde a un ángulo entre vecinos. */
export function cuerda(radio: number, angulo: number): number { return 2 * Math.max(0, radio) * Math.sin(angulo / 2); }

export interface PasoArco { angulo: number; separacion: number; reducida: boolean; arcoTotalGrados: number }
/**
 * Ángulo entre vecinos con el tope del arco: el arco total (de −indiceMax a +indiceMax, 2·indiceMax pasos) no supera
 * arcoMaxGrados; si lo supera, el ángulo (y con él la separación) se reduce proporcionalmente.
 */
export function pasoArco(radio: number, separacion: number, arcoMaxGrados: number, indiceMax: number, out: PasoArco): PasoArco {
  const n = Math.max(0, Math.min(INDICE_MAX, Math.round(fin(indiceMax, INDICE_MAX)))) * 2;
  const tope = Math.max(0, Math.min(360, fin(arcoMaxGrados, 150))) * Math.PI / 180;
  let a = anguloVecinos(radio, separacion);
  let reducida = false;
  if (n > 0 && a * n > tope + 1e-12) { a = tope / n; reducida = true; }
  out.angulo = a;
  out.separacion = cuerda(Math.max(1e-6, fin(radio, 1)), a);
  out.reducida = reducida;
  out.arcoTotalGrados = (a * n * 180) / Math.PI;
  return out;
}

export interface OpcionesArco {
  /** Tope del arco total (grados). Default 150. */
  arcoMaxGrados?: number;
  /** Índice más alto (en valor absoluto) que debe entrar bajo el tope. Default INDICE_MAX (7 slots). */
  indiceMax?: number;
  /** true (default): cada instrumento mira al centro; false: todos con el yaw de la caja (de frente a la tarima). */
  mirarAlCentro?: boolean;
}
const _paso: PasoArco = { angulo: 0, separacion: 0, reducida: false, arcoTotalGrados: 0 };

/**
 * Posición y yaw del slot `indiceDesdeCentro` del arco (0 = caja). yaw: local +Z = frente (mismo convenio que los
 * atriles y la caja: yaw = atan2(dx, dz) hacia donde mira).
 */
export function posicionSlot(indiceDesdeCentro: number, centro: EjeArco, radio: number, separacion: number,
  opciones: OpcionesArco = {}, out: PoseSlot = { x: 0, z: 0, yaw: 0 }): PoseSlot {
  const k = indiceValido(indiceDesdeCentro);
  const r = Math.max(1e-6, fin(radio, 1));
  pasoArco(r, separacion, opciones.arcoMaxGrados ?? 150, opciones.indiceMax ?? INDICE_MAX, _paso);
  const phi = k * _paso.angulo;
  // dirección radial: u rotada hacia p = (uz, −ux) (derecha del eje mirando desde las sillas)
  const c = Math.cos(phi), s = Math.sin(phi);
  const dx = centro.ux * c + centro.uz * s, dz = centro.uz * c - centro.ux * s;
  out.x = centro.cx + dx * r;
  out.z = centro.cz + dz * r;
  out.yaw = (opciones.mirarAlCentro ?? true) ? Math.atan2(-dx, -dz) : Math.atan2(-centro.ux, -centro.uz);
  return out;
}

/** Copia pura de desplazamientoSlot (playTarima, Z88): slot i de la línea → índice desde el centro (1, −1, 2, −2…). */
export function indiceDesdeSlotLinea(i: number, centro: number): number {
  if (i === centro) return 0;
  const r = i < centro ? i + 1 : i;
  return r % 2 === 1 ? (r + 1) / 2 : -r / 2;
}
/** Inversa: índice desde el centro → slot de la línea (−1 si no existe con n slots). */
export function slotLineaDeIndice(k: number, centro: number, n: number): number {
  for (let i = 0; i < n; i++) if (indiceDesdeSlotLinea(i, centro) === k) return i;
  return -1;
}

/** Posición en la línea de Z88: índice k desde el centro, radio = distancia de la caja al centro (sobre el eje). */
export function posicionLinea(indiceDesdeCentro: number, centro: EjeArco, radio: number, separacion: number,
  mirarAlCentro = true, out: PoseSlot = { x: 0, z: 0, yaw: 0 }): PoseSlot {
  const k = Math.round(fin(indiceDesdeCentro, 0)) * Math.max(0, fin(separacion, 0));
  const r = Math.max(0, fin(radio, 0));
  out.x = centro.cx + centro.ux * r + centro.uz * k;
  out.z = centro.cz + centro.uz * r - centro.ux * k;
  out.yaw = mirarAlCentro ? Math.atan2(centro.cx - out.x, centro.cz - out.z) : Math.atan2(-centro.ux, -centro.uz);
  return out;
}

/** Radio efectivo: radioM > 0 lo fija; 0 (o inválido) = automático, la distancia de la caja al centro. */
export function radioEfectivo(radioM: number, radioCaja: number): number {
  const r = fin(radioM, 0);
  return r > 0 ? r : Math.max(1e-6, fin(radioCaja, 1));
}

/** Chequeo de un slot: dentro de la tarima (cuadrada, medio lado `media` + margen), del lado de las sillas, fuera de la sala. */
export interface ChequeoSlot { dentroTarima: boolean; ladoSillas: boolean; fueraSala: boolean }
export function chequearSlot(p: PoseSlot, centro: EjeArco, tarimaMedia: number, margen: number, salaMedia: number,
  out: ChequeoSlot): ChequeoSlot {
  const m = Math.max(0, tarimaMedia) + Math.max(0, margen);
  out.dentroTarima = Math.abs(p.x - centro.cx) <= m && Math.abs(p.z - centro.cz) <= m;
  out.ladoSillas = (p.x - centro.cx) * centro.ux + (p.z - centro.cz) * centro.uz < 0;
  out.fueraSala = Math.abs(p.x) > salaMedia || Math.abs(p.z) > salaMedia;
  return out;
}

/** Radio mínimo para que 2·indiceMax vecinos a `separacion` entren en arcoMaxGrados: sep / (2·sin(tope / (4·indiceMax))). */
export function radioMinimoPara(separacion: number, arcoMaxGrados: number, indiceMax: number): number {
  const n = Math.max(1, Math.round(indiceMax)) * 2;
  const a = (Math.max(1e-6, arcoMaxGrados) * Math.PI / 180) / n;
  return separacion / (2 * Math.sin(a / 2));
}
