// Z87: fuente de video de la TARIMA y visualizador de ondas cuando no hay webcam. Lógica PURA, sin imports
// (prueba: scripts/ondas-tarima-test.mjs). La parte de navegador (canvas, analizador del núcleo, permisos) está en
// lib/fuenteVideoTarima.ts.
//
// Selección (DBG_ONDAS_TARIMA.MODO):
//   "auto"   → webcam si está disponible; si no (esperando permiso, sin dispositivo, denegada, sin soporte) → ondas
//   "webcam" → webcam forzada (si no hay, el domo queda como hoy: sin imagen)
//   "ondas"  → ondas forzadas
// Motivo del degradado: "esperando" | "sin_dispositivo" | "denegado" | "sin_soporte" | "forzado" | "" (webcam).

export type TipoFuente = "webcam" | "ondas";
export type MotivoCamara = "" | "esperando" | "sin_dispositivo" | "denegado" | "sin_soporte" | "error";
export type MotivoFuente = MotivoCamara | "forzado";
export interface EstadoCamara { disponible: boolean; motivo: MotivoCamara }
export interface Eleccion { tipo: TipoFuente; motivo: MotivoFuente }

export function elegirFuente(modo: string, cam: EstadoCamara, out: Eleccion): Eleccion {
  if (modo === "ondas") { out.tipo = "ondas"; out.motivo = "forzado"; return out; }
  if (modo === "webcam") { out.tipo = "webcam"; out.motivo = cam.disponible ? "" : "forzado"; return out; }
  if (cam.disponible) { out.tipo = "webcam"; out.motivo = ""; return out; }
  out.tipo = "ondas"; out.motivo = cam.motivo || "esperando";
  return out;
}

/** Error de getUserMedia → motivo (nombres estándar de DOMException). */
export function motivoDeError(nombre: string, soporta: boolean): MotivoCamara {
  if (!soporta) return "sin_soporte";
  if (nombre === "NotAllowedError" || nombre === "SecurityError" || nombre === "PermissionDeniedError") return "denegado";
  if (nombre === "NotFoundError" || nombre === "DevicesNotFoundError" || nombre === "OverconstrainedError" || nombre === "NotReadableError") return "sin_dispositivo";
  if (nombre === "TypeError") return "sin_soporte";
  return "error";
}

/** ¿Vale la pena reintentar solo cuando cambia el permiso o se conecta un dispositivo? */
export function reintentoAutomatico(modo: string, motivo: MotivoCamara, evento: "permiso_concedido" | "dispositivo"): boolean {
  if (modo === "ondas") return false;
  if (evento === "permiso_concedido") return motivo === "denegado";
  return motivo === "sin_dispositivo" || motivo === "error";
}

const fin = (x: number, d: number): number => (Number.isFinite(x) ? x : d);

/**
 * Forma de onda (−1…1) → N puntos (x, y) en un canvas de w × h, en `out` (Float32Array de 2·N). Toma muestras
 * equiespaciadas; y = centro − v · ganancia · alto/2, acotado al canvas. Devuelve el RMS de las muestras usadas
 * (para detectar silencio).
 */
export function ondaAPuntos(datos: ArrayLike<number>, n: number, w: number, h: number, ganancia: number, margen: number, out: Float32Array): number {
  const N = Math.max(2, Math.min(n, out.length >> 1));
  const L = datos.length;
  const g = Math.max(0, fin(ganancia, 1));
  const medio = h / 2, amp = (h / 2 - margen);
  let s = 0;
  for (let i = 0; i < N; i++) {
    const j = L > 1 ? Math.min(L - 1, Math.round((i * (L - 1)) / (N - 1))) : 0;
    const v = L ? fin(datos[j], 0) : 0;
    s += v * v;
    const y = medio - Math.max(-1, Math.min(1, v * g)) * amp;
    out[2 * i] = (i * w) / (N - 1);
    out[2 * i + 1] = y;
  }
  return Math.sqrt(s / N);
}

/** Espectro (bytes 0…255) → nBarras alturas 0…1 (promedio por grupo, escala logarítmica en frecuencia). */
export function espectroABarras(bytes: ArrayLike<number>, nBarras: number, ganancia: number, out: Float32Array): void {
  const L = bytes.length, n = Math.min(nBarras, out.length);
  const g = Math.max(0, fin(ganancia, 1));
  for (let b = 0; b < n; b++) {
    const a = Math.floor(Math.pow(L, b / n)), z = Math.max(a + 1, Math.floor(Math.pow(L, (b + 1) / n)));
    let s = 0, c = 0;
    for (let i = a; i < Math.min(L, z); i++) { s += fin(bytes[i], 0); c++; }
    out[b] = Math.min(1, c ? (s / c / 255) * g : 0);
  }
}

/** Umbral de silencio (RMS). Con silencio se dibuja la línea plana con ruido leve y parpadeo. */
export const RMS_SILENCIO = 0.003;
export function enSilencio(rms: number): boolean { return !(rms > RMS_SILENCIO); }

/** Paletas (fósforo sobre fondo). */
export const PALETAS: Record<string, { trazo: string; brillo: string; fondo: string }> = {
  ambar: { trazo: "#FF9A1F", brillo: "#FFD08A", fondo: "#2A1400" },
  verde: { trazo: "#34F28A", brillo: "#C8FFD9", fondo: "#04170C" },
  cian:  { trazo: "#7FEFE6", brillo: "#E0FFFB", fondo: "#04161A" },
  // Z98: nombres del visualizador nuevo, por si se usan con el dibujo de Z87 (IDENTIDAD cae en ámbar)
  fosforo:   { trazo: "#33FF66", brillo: "#C8FFD2", fondo: "#04170C" },
  identidad: { trazo: "#FF9A1F", brillo: "#FFD08A", fondo: "#2A1400" },
};
