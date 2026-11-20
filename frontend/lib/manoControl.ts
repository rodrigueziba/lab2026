// Z108: MANOS — control de perillas y deslizadores por la ALTURA de la mano, con embrague. Lógica PURA y sin imports
// (se prueba en Node: scripts/manos-test.mjs).
//
// Embrague relativo (MODO_MANO "relativo", por defecto): como levantar el mouse de la mesa. Mientras el embrague está
// apretado (tecla mantenida o pellizco), el control que estaba bajo el cursor al apretarlo sigue a la mano:
//   valor = valor inicial + (altura actual − altura inicial) ÷ (R × tamaño de la mano)        (altura hacia arriba)
// que es la fórmula del pedido escrita con la altura hacia arriba (con y de imagen hacia abajo sería
// "altura inicial − altura actual"). Subir la mano sube el valor; R = RECORRIDO_MANOS (3,5): el recorrido completo 0…1
// son 3,5 tamaños de mano, así la sensibilidad no depende de la distancia a la cámara. Al soltar, el control queda donde
// está. Si la mano se pierde con el embrague apretado, el control se queda quieto; al volver se re-referencia (valor
// inicial = el de ese momento, altura inicial = la de ese momento): retoma sin salto.
// Modo "absoluto": la altura calibrada (o 0,2…0,8 del alto de la imagen sin calibrar) se mapea directo a 0…1, con un
// suavizado exponencial para que al agarrar no salte.
// Todo escribe en estructuras preasignadas: sin allocations por cuadro.

const fin = (x: number, d = 0): number => (Number.isFinite(x) ? x : d);
const acotar01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

export type ModoMano = "relativo" | "absoluto";
export interface CfgControlMano {
  MODO_MANO: ModoMano;
  RECORRIDO_MANOS: number;    // R: tamaños de mano para el recorrido completo
  SUAVIZADO_ABS_S: number;    // constante de tiempo del modo absoluto (s)
}

// ── qué controles se pueden agarrar ──
/** Solo los continuos: perillas y deslizadores. Pads, botones, palancas, indicadores y el disco de ritmos, nunca. */
export function esContinuo(tipo: string): boolean { return tipo === "knob" || tipo === "slider"; }

// ── embrague ──
/** Tecla mantenida, pellizco sostenido (si EMBRAGUE_PELLIZCO) o el forzador del menú. */
export function embragueActivo(tecla: boolean, pellizco: boolean, forzado: boolean, usarPellizco: boolean): boolean {
  return tecla || forzado || (usarPellizco && pellizco);
}

// ── calibración (solo modo absoluto; en memoria, no persiste) ──
export interface CalMano { min: number; max: number; calibrada: boolean }
export const CAL_MANO_DEFECTO = { min: 0.2, max: 0.8 } as const;
export function crearCalMano(): CalMano { return { min: CAL_MANO_DEFECTO.min, max: CAL_MANO_DEFECTO.max, calibrada: false }; }
export interface EstadoCalMano { activo: boolean; paso: number; t0: number; suma: number; n: number; abajo: number; terminada: boolean }
export function crearEstadoCalMano(): EstadoCalMano { return { activo: false, paso: 0, t0: 0, suma: 0, n: 0, abajo: 0, terminada: false }; }
export const PASOS_CAL_MANO = ["PONÉ LA MANO LO MÁS ABAJO CÓMODO", "PONÉ LA MANO LO MÁS ARRIBA CÓMODO"] as const;
export function iniciarCalMano(e: EstadoCalMano, tS: number): void { e.activo = true; e.paso = 0; e.t0 = tS; e.suma = 0; e.n = 0; e.abajo = 0; e.terminada = false; }
export function cancelarCalMano(e: EstadoCalMano): void { e.activo = false; }
export function restanteCalMano(e: EstadoCalMano, tS: number, durS: number): number { return Math.max(0, durS - (tS - e.t0)); }
/**
 * Un cuadro de la calibración: promedia la altura de la mano válida durante durS por paso (abajo, después arriba).
 * Devuelve true al terminar (con cal escrita si el rango es razonable, ≥ 0,05 altos de imagen).
 */
export function pasoCalMano(e: EstadoCalMano, valida: boolean, altura: number, tS: number, durS: number, cal: CalMano): boolean {
  if (!e.activo) return false;
  if (valida && Number.isFinite(altura)) { e.suma += altura; e.n++; }
  if (tS - e.t0 < durS) return false;
  const media = e.n > 0 ? e.suma / e.n : NaN;
  if (e.paso === 0) { e.abajo = media; e.paso = 1; e.t0 = tS; e.suma = 0; e.n = 0; return false; }
  e.activo = false; e.terminada = true;
  if (Number.isFinite(e.abajo) && Number.isFinite(media) && media - e.abajo >= 0.05) { cal.min = e.abajo; cal.max = media; cal.calibrada = true; }
  return true;
}

// ── agarre ──
export interface EstadoAgarre {
  agarrado: boolean;
  id: string;               // control agarrado
  valor: number;            // valor actual 0…1
  v0: number;               // valor inicial (al agarrar o al re-referenciar)
  h0: number;               // altura inicial
  t0: number;               // tamaño de la mano en la referencia
  referenciado: boolean;    // false = esperando la mano (al agarrar o después de perderla)
  pasos: number;            // cuadros aplicados (menú)
}
export function crearAgarre(): EstadoAgarre { return { agarrado: false, id: "", valor: 0, v0: 0, h0: 0, t0: 0, referenciado: false, pasos: 0 }; }

/** Al apretar el embrague sobre un control continuo: guarda su valor (0…1) y espera la mano para la referencia. */
export function iniciarAgarre(e: EstadoAgarre, id: string, valorInicial01: number): void {
  e.agarrado = true; e.id = id; e.valor = acotar01(fin(valorInicial01)); e.v0 = e.valor; e.referenciado = false; e.pasos = 0;
}
/** Al soltar el embrague: el control queda donde está (no se toca más). */
export function soltarAgarre(e: EstadoAgarre): void { e.agarrado = false; e.id = ""; e.referenciado = false; }

/**
 * Un cuadro con el embrague apretado. valida = hay mano con postura en este cuadro; altura y tamano son los filtrados.
 * Devuelve el valor nuevo (0…1) o NaN si este cuadro no mueve el control (sin mano: queda quieto).
 */
export function pasoAgarre(e: EstadoAgarre, valida: boolean, altura: number, tamano: number, dtS: number, c: CfgControlMano, cal: CalMano): number {
  if (!e.agarrado) return NaN;
  if (!valida || !Number.isFinite(altura) || !(tamano > 1e-4)) { e.referenciado = false; return NaN; }   // se perdió: quieto
  if (c.MODO_MANO === "absoluto") {
    const rango = Math.max(0.05, cal.max - cal.min);
    const objetivo = acotar01((altura - cal.min) / rango);
    const tau = Math.max(0.01, fin(c.SUAVIZADO_ABS_S, 0.25));
    const k = 1 - Math.exp(-Math.max(0, fin(dtS, 1 / 30)) / tau);
    e.valor = acotar01(e.valor + (objetivo - e.valor) * k);
    e.referenciado = true; e.pasos++;
    return e.valor;
  }
  if (!e.referenciado) { e.v0 = e.valor; e.h0 = altura; e.t0 = tamano; e.referenciado = true; e.pasos++; return e.valor; }
  const R = Math.max(0.1, fin(c.RECORRIDO_MANOS, 3.5));
  e.valor = acotar01(e.v0 + (altura - e.h0) / (R * e.t0));
  e.pasos++;
  return e.valor;
}

// ── prioridad entre fuentes ──
export type FuenteCtrl = "mano" | "mouse" | "cara" | "manual";
/**
 * Quién manda sobre el control `id` en este cuadro. Con el embrague apretado sobre ese control, la MANO manda sobre la
 * cara y sobre el mouse; si no, el mouse que lo arrastra; si no, la cara (si lo tiene tomado); si no, queda "manual".
 */
export function quienManda(id: string, agarradoId: string, embrague: boolean, mouseArrastraId: string, caraLoToma: boolean): FuenteCtrl {
  if (embrague && agarradoId !== "" && agarradoId === id) return "mano";
  if (mouseArrastraId !== "" && mouseArrastraId === id) return "mouse";
  if (caraLoToma) return "cara";
  return "manual";
}

// ── textos (línea de estado del atril, español y corto) ──
export type EstadoManosLinea = "apagado" | "pidiendo" | "cargando" | "sin_mano" | "lista" | "agarrando" | "calibrando" | "error";
export type ErrorManos = "" | "denegado" | "sin_camara" | "en_uso" | "sin_motor";
const ERRORES: Record<Exclude<ErrorManos, "">, string> = {
  denegado: "MANOS: CÁMARA DENEGADA", sin_camara: "MANOS: SIN CÁMARA", en_uso: "MANOS: CÁMARA EN USO", sin_motor: "MANOS: SIN MOTOR DE MANOS",
};
export const AVISO_TRANSMISION = "MANOS: USA LA CÁMARA, NO SE TRANSMITE";
/** Nombre de DOMException de getUserMedia → motivo corto. */
export function errorDeCamara(nombre: string): ErrorManos {
  if (nombre === "NotAllowedError" || nombre === "SecurityError" || nombre === "PermissionDeniedError") return "denegado";
  if (nombre === "NotReadableError" || nombre === "TrackStartError" || nombre === "AbortError") return "en_uso";
  return "sin_camara";
}
/** Línea de estado. pct = 0…100 del control agarrado; compartiendo = la tarima está transmitiendo en vivo. */
export function textoLineaManos(estado: EstadoManosLinea, error: ErrorManos, nombre: string, pct: number, compartiendo: boolean, pasoCal = 0, seg = 0): string {
  if (estado === "apagado") return "";
  if (estado === "error") return error ? ERRORES[error] : ERRORES.sin_camara;
  if (estado === "pidiendo") return "MANOS: PIDIENDO CÁMARA";
  if (estado === "cargando") return "MANOS: CARGANDO";
  if (estado === "calibrando") return `MANOS: ${PASOS_CAL_MANO[pasoCal] ?? ""} ${seg} S`;
  if (estado === "agarrando") return `MANOS: AGARRANDO ${nombre} ${Math.round(acotar01(pct / 100) * 100)} %`;
  if (compartiendo) return AVISO_TRANSMISION;
  return estado === "sin_mano" ? "MANOS: NO SE VE LA MANO" : "MANOS: LISTA";
}
export const ANUNCIO_ACTIVADO = "Control con manos activado. Poné el cursor sobre una perilla, mantené el embrague y subí o bajá la mano";
export const ANUNCIO_DESACTIVADO = "Control con manos desactivado";
