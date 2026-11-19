// Z99: atril "BAJO ÁCIDO BA-40" (tercer atril de la tarima): layout como DATOS, textos, huellas, legibilidad y pose.
// Mismo panel que SONIDO SN-40 e IMAGEN IM-40 (1,40 × 0,65 m: no hizo falta más profundidad), mismas reglas:
//  - de lejos a cerca y de izquierda a derecha: display (con la curva del filtro) → 1 SECUENCIA (qué suena) →
//    PATRÓN · 2 VOZ (cómo suena) · 3 SALIDA (cuánto suena);
//  - SECUENCIA: 4 filas × 16 columnas alineadas (NOTA mini perillas, ACENTO, DESLIZ, PASO con luz y marca del paso
//    que suena);
//  - el texto más lejano (display y título de SECUENCIA) ≥ 2,5 % del alto de pantalla con la cámara del modo atril.
// Lógica pura (importa solo lib/atrilSonido.ts, también pura). Prueba: scripts/bajo-acido-test.mjs.
import {
  ANCHO_CHAR, BANDA_TITULO, ON_DX, RADIO_FALDA, RADIO_MARCAS_OUT, HUELLA, ESCALA_FADER, PANEL_U, PANEL_V, MARGEN, GAP,
  DISPLAY_PAD, DISPLAY_INTERLINEA, LEGIBLE_MIN, BUSQUEDA_SONIDO, ALTO_TEXTO, NUM_PERILLA_R, NUM_PERILLA_ALTO,
  camaraAtril, fraccionAltura, buscarPose, escalaEfectiva,
  type Rect, type Texto, type GeoAtril, type CamaraPura, type FormaCtrl,
} from "./atrilSonido";

export type FilaB = "display" | "secuencia" | "abajo";
export interface ModuloB { id: string; titulo: string; etiqueta: string; fila: FilaB; rect: Rect; on: string | null }
export interface PosCtrlB {
  id: string; u: number; v: number; forma: FormaCtrl; tipo: "button" | "toggle" | "slider" | "knob";
  etiqueta: string; nombreLargo: string; modulo: string; escala: number; paso: number;   // paso: 0…15 en SECUENCIA, −1 fuera
}

const IZQ = -PANEL_U + MARGEN, DER = PANEL_U - MARGEN;
const V_MAX = PANEL_V - MARGEN, V_MIN = -PANEL_V + MARGEN;
export const FILAS_B: Record<FilaB, { v0: number; v1: number }> = {
  display:   { v0: 0.226, v1: V_MAX },
  secuencia: { v0: -0.040, v1: 0.211 },
  abajo:     { v0: V_MIN, v1: -0.055 },
};
export const DISPLAY_TEXTO_U1 = 0.28;                     // el texto ocupa hasta acá; a la derecha, la curva del filtro
export const CURVA_B = { u0: 0.30, u1: DER - 0.012, v0: FILAS_B.display.v0 + 0.008, v1: FILAS_B.display.v1 - 0.008 };
// Z100: la fila de abajo suma el módulo 4 CARA (a la derecha). Para que entre sin agrandar el panel (el marco ya mide
// 0,85 m de fondo, el límite) se angostan PATRÓN (pads × 0,75), VOZ (perillas × 0,70, ONDA × 0,85) y SALIDA (mismos
// controles). Con conCara false (DBG_ATRIL_BAJO.MODULO_CARA) vuelve el layout de Z99.
const ANCHOS_Z99 = { patron: 0.40, voz: 0.65 }, ANCHOS_Z100 = { patron: 0.255, voz: 0.49, salida: 0.27 };
export const LAYOUT_B = { conCara: true };
export const MODULOS_B: ModuloB[] = [];
function armarModulos(conCara: boolean): void {
  const A = conCara ? ANCHOS_Z100 : ANCHOS_Z99;
  const u1Pat = IZQ + A.patron, u1Voz = u1Pat + GAP + A.voz;
  const u1Sal = conCara ? u1Voz + GAP + ANCHOS_Z100.salida : DER;
  MODULOS_B.length = 0;
  MODULOS_B.push(
    { id: "display",   titulo: "", etiqueta: "", fila: "display", rect: { u0: IZQ, u1: DER, ...FILAS_B.display }, on: null },
    { id: "secuencia", titulo: "1 SECUENCIA", etiqueta: "QUÉ SUENA", fila: "secuencia", rect: { u0: IZQ, u1: DER, ...FILAS_B.secuencia }, on: null },
    { id: "patron",    titulo: "PATRÓN", etiqueta: "DE FÁBRICA", fila: "abajo", rect: { u0: IZQ, u1: u1Pat, ...FILAS_B.abajo }, on: null },
    { id: "voz",       titulo: "2 VOZ", etiqueta: "CÓMO SUENA", fila: "abajo", rect: { u0: u1Pat + GAP, u1: u1Voz, ...FILAS_B.abajo }, on: null },
    { id: "salida",    titulo: "3 SALIDA", etiqueta: "CUÁNTO SUENA", fila: "abajo", rect: { u0: u1Voz + GAP, u1: u1Sal, ...FILAS_B.abajo }, on: "b_on" },
  );
  if (conCara) MODULOS_B.push({ id: "cara", titulo: "4 CARA", etiqueta: "TU GESTO", fila: "abajo", rect: { u0: u1Sal + GAP, u1: DER, ...FILAS_B.abajo }, on: "b_cara_on" });
}
armarModulos(true);
export function moduloB(id: string): ModuloB { const m = MODULOS_B.find(x => x.id === id); if (!m) throw new Error(`módulo ${id}`); return m; }
export function posOnB(m: ModuloB): { u: number; v: number } { return { u: m.rect.u1 - ON_DX, v: m.rect.v1 - BANDA_TITULO / 2 }; }

// ── medidas ──
export const PAD_B = { w: 0.100, d: 0.056 };               // el pad de IM-40 (las teclas de la secuencia lo escalan)
export const ESC = { nota: 0.45, acento: 0.45, desliz: 0.45, paso: 0.6, perilla: 0.75 };
/** Z100: escalas de la fila de abajo con el módulo CARA (sin él, las de Z99). */
export const ESC_CARA = { patron: 0.75, onda: 0.85, perilla: 0.70, anchoOnda: 0.10 };
/** Z100: módulo CARA: tecla CALIBRAR y luz CARA DETECTADA (columna izquierda) y 6 medidores (filas, a la derecha). */
export const CARA_B = { columnaW: 0.090, nombreW: 0.112, segmentos: 10 };
export const DESTINOS_CARA = ["CORTE", "RESONANCIA", "DECAY", "DISTORSIÓN", "ACENTO", "PATRÓN"] as const;
export const NOMBRES_MEDIDOR = ["BOCA", "O", "SONRISA", "CEJAS", "CABECEO", "GUIÑO"] as const;
export const textoMedidor = (i: number): string => `${NOMBRES_MEDIDOR[i]}→${DESTINOS_CARA[i]}`;
export const SEQ = { etiquetaW: 0.085, numeros: 0.156, nota: 0.122, acento: 0.078, desliz: 0.040, paso: -0.003 };
export const FADER_B = { rail: 0.12, v: -0.20 };
export const VU_B = { segmentos: 14, u: 0, v0: -0.29, v1: -0.115, ancho: 0.024 };   // u se fija en construir()
export const PATRONES_B = ["CHICAGO", "RAGA", "DEEP", "TECHNO", "MINIMAL"] as const;
export const ONDAS_B = [["b_onda_sierra", "sierra", "SIERRA"], ["b_onda_cuadrada", "cuadrada", "CUADRADA"]] as const;
export const PERILLAS_B = [
  ["afinacion", "AFINACIÓN"], ["corte", "CORTE"], ["resonancia", "RESONANCIA"], ["modEnv", "MOD. ENV."],
  ["decay", "DECAY"], ["acento", "ACENTO"], ["desliz", "DESLIZ"], ["distorsion", "DISTORSIÓN"],
] as const;
export const FILAS_SEQ = [["nota", "NOTA"], ["acento", "ACENTO"], ["desliz", "DESLIZ"], ["paso", "PASO"]] as const;

/** Columna u del paso k (0…15) de la SECUENCIA. */
export function uPaso(k: number): number {
  const m = moduloB("secuencia").rect, x0 = m.u0 + 0.012 + SEQ.etiquetaW, w = (m.u1 - 0.012 - x0) / 16;
  return x0 + w * (k + 0.5);
}
export function anchoColumnaPaso(): number { const m = moduloB("secuencia").rect, x0 = m.u0 + 0.012 + SEQ.etiquetaW; return (m.u1 - 0.012 - x0) / 16; }

function construir(escalaPasos: number): PosCtrlB[] {
  const L: PosCtrlB[] = [];
  const ep = Math.max(0.8, Math.min(1.2, Number.isFinite(escalaPasos) ? escalaPasos : 1));
  for (let k = 0; k < 16; k++) {
    const u = uPaso(k), n = k + 1;
    L.push({ id: `b_nota${k}`, u, v: SEQ.nota, forma: "normal", tipo: "knob", etiqueta: "", nombreLargo: `PASO ${n} · NOTA`, modulo: "secuencia", escala: ESC.nota, paso: k });
    L.push({ id: `b_acento${k}`, u, v: SEQ.acento, forma: "pad", tipo: "toggle", etiqueta: "", nombreLargo: `PASO ${n} · ACENTO`, modulo: "secuencia", escala: ESC.acento, paso: k });
    L.push({ id: `b_desliz${k}`, u, v: SEQ.desliz, forma: "pad", tipo: "toggle", etiqueta: "", nombreLargo: `PASO ${n} · DESLIZ`, modulo: "secuencia", escala: ESC.desliz, paso: k });
    L.push({ id: `b_paso${k}`, u, v: SEQ.paso, forma: "pad", tipo: "toggle", etiqueta: "", nombreLargo: `PASO ${n}`, modulo: "secuencia", escala: ESC.paso * ep, paso: k });
  }
  // PATRÓN: 3 × 2 (los 5 de fábrica + PATRÓN LIMPIO)
  const cc = LAYOUT_B.conCara;
  const pa = moduloB("patron").rect, wp = (pa.u1 - pa.u0 - 0.024) / 3, up = (i: number) => pa.u0 + 0.012 + wp * (i + 0.5);
  const vf1 = pa.v1 - BANDA_TITULO - 0.040, vf2 = vf1 - 0.096;
  const escPat = cc ? ESC_CARA.patron : 1;
  PATRONES_B.forEach((nm, i) => L.push({ id: `b_pat_${nm}`, u: up(i % 3), v: i < 3 ? vf1 : vf2, forma: "pad", tipo: "toggle", etiqueta: nm, nombreLargo: `PATRÓN ${nm}`, modulo: "patron", escala: escPat, paso: -1 }));
  L.push({ id: "b_limpio", u: up(2), v: vf2, forma: "normal", tipo: "button", etiqueta: "LIMPIO", nombreLargo: "PATRÓN LIMPIO", modulo: "patron", escala: 1, paso: -1 });
  // VOZ: ONDA (2 pads apilados) + 8 perillas en 2 filas de 4
  const vz = moduloB("voz").rect, wo = cc ? ESC_CARA.anchoOnda : 0.125, wk = (vz.u1 - vz.u0 - 0.024 - wo) / 4;
  const escOnda = cc ? ESC_CARA.onda : 1, escPer = cc ? ESC_CARA.perilla : ESC.perilla;
  ONDAS_B.forEach(([id, , et], i) => L.push({ id, u: vz.u0 + 0.012 + wo / 2, v: i === 0 ? vf1 : vf2, forma: "pad", tipo: "toggle", etiqueta: et, nombreLargo: `ONDA ${et}`, modulo: "voz", escala: escOnda, paso: -1 }));
  const vk1 = vz.v1 - BANDA_TITULO - RADIO_MARCAS_OUT * escPer - 0.0045, vk2 = vk1 - 0.099;
  PERILLAS_B.forEach(([pid, et], i) => L.push({ id: `b_p_${pid}`, u: vz.u0 + 0.012 + wo + wk * ((i % 4) + 0.5), v: i < 4 ? vk1 : vk2, forma: "normal", tipo: "knob", etiqueta: et, nombreLargo: et, modulo: "voz", escala: escPer, paso: -1 }));
  // SALIDA: VOLUMEN, VU y ON
  const sa = moduloB("salida").rect;
  L.push({ id: "b_vol", u: sa.u0 + 0.090, v: FADER_B.v, forma: "normal", tipo: "slider", etiqueta: "VOLUMEN", nombreLargo: "VOLUMEN", modulo: "salida", escala: 1, paso: -1 });
  L.push({ id: "b_on", u: posOnB(moduloB("salida")).u, v: posOnB(moduloB("salida")).v, forma: "pastilla", tipo: "toggle", etiqueta: "ON", nombreLargo: "SALIDA DEL BAJO", modulo: "salida", escala: 1, paso: -1 });
  VU_B.u = sa.u0 + 0.190;
  // Z100: CARA: pastilla CARA ON (banda de título) y tecla CALIBRAR (columna izquierda; abajo, la luz CARA DETECTADA)
  if (cc) {
    const ca = moduloB("cara");
    L.push({ id: "b_cara_on", u: posOnB(ca).u, v: posOnB(ca).v, forma: "pastilla", tipo: "toggle", etiqueta: "ON", nombreLargo: "CARA", modulo: "cara", escala: 1, paso: -1 });
    L.push({ id: "b_cara_cal", u: luzCaraB().u, v: ca.rect.v1 - BANDA_TITULO - 0.046, forma: "normal", tipo: "button", etiqueta: "CALIBRAR", nombreLargo: "CALIBRAR CARA", modulo: "cara", escala: 1, paso: -1 });
  }
  return L;
}
/** Z100: luz CARA DETECTADA (centro). */
export function luzCaraB(): { u: number; v: number; r: number } {
  const ca = moduloB("cara").rect;
  return { u: ca.u0 + 0.012 + CARA_B.columnaW / 2, v: ca.v0 + 0.068, r: 0.011 };
}
/** Z100: área de los medidores y fila i (centro v, alto, u del inicio de la barra). */
export function medidoresCaraB(): { u0: number; u1: number; v0: number; v1: number; filaH: number; barraU0: number } {
  const ca = moduloB("cara").rect;
  const u0 = ca.u0 + 0.012 + CARA_B.columnaW + 0.006, u1 = ca.u1 - 0.012;
  const v1 = ca.v1 - BANDA_TITULO - 0.006, v0 = ca.v0 + 0.006;
  return { u0, u1, v0, v1, filaH: (v1 - v0) / 6, barraU0: u0 + CARA_B.nombreW + 0.004 };
}
/** Rectángulo de la barra de LEDs del medidor i (0…5). */
export function barraMedidorB(i: number): Rect {
  const m = medidoresCaraB(), vc = m.v1 - m.filaH * (i + 0.5), h = Math.min(0.016, m.filaH * 0.5);
  return { u0: m.barraU0, u1: m.u1, v0: vc - h / 2, v1: vc + h / 2 };
}
/** Z100: rehace módulos y posiciones con o sin el módulo CARA (LecternSystem lo llama al cargar con DBG_ATRIL_BAJO.MODULO_CARA). */
export function configurarLayoutB(conCara: boolean, escalaPasos = 1): void {
  if (LAYOUT_B.conCara === conCara) return;
  LAYOUT_B.conCara = conCara;
  armarModulos(conCara);
  POSICIONES_B = construir(escalaPasos);
}
export let POSICIONES_B: PosCtrlB[] = construir(1);
/** Rehace las posiciones con ESCALA_PASOS (al remontar el atril). */
export function reconstruirB(escalaPasos: number): PosCtrlB[] { POSICIONES_B = construir(escalaPasos); return POSICIONES_B; }
export function posB(id: string): PosCtrlB | undefined { return POSICIONES_B.find(p => p.id === id); }

// ── huellas ──
export function huellaB(p: PosCtrlB): Rect {
  const s = p.escala;
  let hu: number, hv: number;
  if (p.forma === "pad") { hu = (PAD_B.w / 2) * s; hv = (PAD_B.d / 2 + 0.006) * s; }
  else if (p.forma === "pastilla") { hu = HUELLA.PASTILLA_U; hv = HUELLA.PASTILLA_V; }
  else if (p.tipo === "slider") { hu = HUELLA.FADER_U; hv = FADER_B.rail / 2 + HUELLA.THUMB_D / 2; }
  else if (p.tipo === "button") { hu = HUELLA.BOTON; hv = HUELLA.BOTON; }
  else if (p.tipo === "toggle") { hu = HUELLA.ROCKER_U; hv = HUELLA.ROCKER_V; }
  else if (s < 0.6) { const r = RADIO_FALDA * s + 0.002; return { u0: p.u - r, u1: p.u + r, v0: p.v - r, v1: p.v + r }; }   // mini perilla: sin escala
  else { const r = RADIO_MARCAS_OUT * s; return { u0: p.u - r * 0.988, u1: p.u + r * 0.988, v0: p.v - Math.max(RADIO_FALDA * s, r * 0.7072), v1: p.v + r }; }
  return { u0: p.u - hu, u1: p.u + hu, v0: p.v - hv, v1: p.v + hv };
}
function radioB(p: PosCtrlB): number {
  if (p.forma === "pad") return (PAD_B.d / 2) * p.escala;
  if (p.tipo === "button") return 0.030;
  if (p.tipo === "knob") return RADIO_FALDA * p.escala;
  return 0.02;
}

// ── textos ──
export const ALTO_B = { titulo: ALTO_TEXTO.efectos.titulo, tituloAbajo: 0.023, etiqueta: 0.017, tag: 0.016, fila: 0.013, numero: 0.011 };
export const DISPLAY_CHARS_B = [44, 44];
export function altosDisplayB(escala: number): [number, number] {
  const e = Math.max(0.5, Math.min(2, Number.isFinite(escala) ? escala : 1));
  const d = moduloB("display").rect, b1 = ALTO_TEXTO.display.titulo, b2 = ALTO_TEXTO.display.etiqueta;
  const porAlto = (d.v1 - d.v0 - 2 * DISPLAY_PAD - DISPLAY_INTERLINEA) / (b1 + b2);
  const porAncho = (DISPLAY_TEXTO_U1 - d.u0 - 0.024) / (DISPLAY_CHARS_B[0] * ANCHO_CHAR * b1);
  const k = Math.min(e, porAlto, porAncho);
  return [b1 * k, b2 * k];
}
type F = Texto["fila"];
const FILA_TXT: Record<FilaB, F> = { display: "display", secuencia: "efectos", abajo: "tono" };
export function textosB(escala: number, numerados = true): Texto[] {
  const e = Math.max(0.5, Math.min(2, Number.isFinite(escala) ? escala : 1));
  const T: Texto[] = [];
  const add = (id: string, texto: string, u: number, v: number, alto: number, alinear: "centro" | "izq", fila: FilaB) =>
    T.push({ id, texto, u, v, alto, ancho: texto.length * ANCHO_CHAR * alto, alinear, fila: FILA_TXT[fila] });
  const d = moduloB("display").rect, [h1, h2] = altosDisplayB(e);
  add("d_linea1", "X".repeat(DISPLAY_CHARS_B[0]), d.u0 + 0.012, d.v1 - DISPLAY_PAD - h1 / 2, h1, "izq", "display");
  add("d_linea2", "X".repeat(DISPLAY_CHARS_B[1]), d.u0 + 0.012, d.v1 - DISPLAY_PAD - h1 - DISPLAY_INTERLINEA - h2 / 2, h2, "izq", "display");
  for (const m of MODULOS_B) {
    if (m.fila === "display") continue;
    const tit = numerados ? m.titulo : m.titulo.replace(/^\d /, ""), tag = `· ${m.etiqueta}`;
    const libre = m.rect.u1 - m.rect.u0 - 0.024 - (m.on ? ON_DX + 0.034 : 0);
    const base = m.fila === "secuencia" ? ALTO_B.titulo : ALTO_B.tituloAbajo;
    const alto = Math.min(base * e, BANDA_TITULO - 0.012, (libre * 0.62) / (tit.length * ANCHO_CHAR));
    const vb = m.rect.v1 - BANDA_TITULO / 2;
    add(`t_${m.id}`, tit, m.rect.u0 + 0.012, vb, alto, "izq", m.fila);
    const u1 = m.rect.u0 + 0.012 + tit.length * ANCHO_CHAR * alto + 0.012;
    const altoTag = Math.min(ALTO_B.tag * e, alto, (m.rect.u0 + 0.012 + libre - u1) / (tag.length * ANCHO_CHAR));
    add(`g_${m.id}`, tag, u1, vb - (alto - altoTag) / 2 + 0.0005, altoTag, "izq", m.fila);
  }
  // filas de la SECUENCIA (izquierda) y números de paso (arriba de cada columna)
  const sq = moduloB("secuencia").rect, wcol = anchoColumnaPaso();
  for (const [f, et] of FILAS_SEQ) {
    const alto = Math.min(ALTO_B.fila * e, (SEQ.etiquetaW - 0.006) / (et.length * ANCHO_CHAR));
    add(`f_${f}`, et, sq.u0 + 0.012, SEQ[f], alto, "izq", "secuencia");
  }
  for (let k = 0; k < 16; k++) {
    const t = String(k + 1), alto = Math.min(ALTO_B.numero * e, (wcol - 0.01) / (t.length * ANCHO_CHAR), 0.014);
    add(`n_${k}`, t, uPaso(k), SEQ.numeros, alto, "centro", "secuencia");
  }
  // etiquetas (debajo de cada control) fuera de la secuencia
  for (const p of POSICIONES_B) {
    if (!p.etiqueta || p.forma === "pastilla") continue;
    const m = moduloB(p.modulo);
    const wo = LAYOUT_B.conCara ? ESC_CARA.anchoOnda : 0.125;
    const colW = p.modulo === "voz" && p.tipo === "knob" ? (m.rect.u1 - m.rect.u0 - 0.024 - wo) / 4 : p.modulo === "salida" ? 0.16 : p.modulo === "cara" ? CARA_B.columnaW : (m.rect.u1 - m.rect.u0 - 0.024) / 3;
    const r = radioB(p);
    const anchoLibre = Math.min(2 * Math.min(p.u - m.rect.u0, m.rect.u1 - p.u) - 0.006, colW - 0.012);
    const altoLibre = p.tipo === "slider" ? 0.02 : p.v - r - 0.008 - (m.rect.v0 + 0.003);
    const alto = Math.min(ALTO_B.etiqueta * e, anchoLibre / (p.etiqueta.length * ANCHO_CHAR), altoLibre);
    const v = p.tipo === "slider" ? FADER_B.v - FADER_B.rail / 2 - HUELLA.THUMB_D / 2 - 0.003 - alto / 2 : p.v - r - 0.008 - alto / 2;
    add(`e_${p.id}`, p.etiqueta, p.u, v, alto, "centro", m.fila);
  }
  // Z100: CARA: "DETECTADA" bajo la luz y los nombres de los medidores ("BOCA→CORTE"…), a la izquierda de cada barra
  if (LAYOUT_B.conCara) {
    const ca = moduloB("cara").rect, luz = luzCaraB(), md = medidoresCaraB();
    const et = "DETECTADA", altoL = Math.min(ALTO_B.etiqueta * e, (CARA_B.columnaW - 0.012) / (et.length * ANCHO_CHAR), luz.v - luz.r - 0.006 - (ca.v0 + 0.003));
    add("e_cara_det", et, luz.u, luz.v - luz.r - 0.006 - altoL / 2, altoL, "centro", "abajo");
    let maxLen = 0; for (let i = 0; i < 6; i++) maxLen = Math.max(maxLen, textoMedidor(i).length);
    const altoM = Math.min(ALTO_B.fila * e, (CARA_B.nombreW - 0.002) / (maxLen * ANCHO_CHAR), md.filaH * 0.62);
    for (let i = 0; i < 6; i++) add(`m_cara${i}`, textoMedidor(i), md.u0, md.v1 - md.filaH * (i + 0.5), altoM, "izq", "abajo");
  }
  return T;
}
/** Números 0/10 de las perillas de VOZ (AFINACIÓN: −12/+12), dentro de su huella. */
export function numerosPerillaB(p: PosCtrlB): Texto[] {
  if (p.tipo !== "knob" || p.escala < 0.6) return [];
  const r = NUM_PERILLA_R * p.escala, h = NUM_PERILLA_ALTO, s = Math.SQRT1_2;
  const [a, b] = p.id === "b_p_afinacion" ? ["-12", "+12"] : ["0", "10"];
  const mk = (id: string, texto: string, u: number, v: number): Texto => ({ id, texto, u, v, alto: h, ancho: texto.length * ANCHO_CHAR * h, alinear: "centro", fila: "tono" });
  return [mk(`n0_${p.id}`, a, p.u - s * r, p.v - s * r), mk(`n1_${p.id}`, b, p.u + s * r, p.v - s * r)];
}
/** Escala 0 / 5 / 10 a la izquierda del fader VOLUMEN. */
export function numerosFaderB(p: PosCtrlB): Texto[] {
  const h = ESCALA_FADER.alto, uDer = p.u - HUELLA.FADER_U - 0.004 - ESCALA_FADER.marcaLarga - 0.003;
  return [0, 5, 10].map(n => { const t = String(n), ancho = t.length * ANCHO_CHAR * h;
    return { id: `nf${n}`, texto: t, u: uDer - ancho / 2, v: FADER_B.v - FADER_B.rail / 2 + (n / 10) * FADER_B.rail, alto: h, ancho, alinear: "centro" as const, fila: "tono" as F }; });
}
export function rectVuB(): Rect { return { u0: VU_B.u - VU_B.ancho / 2 - 0.004, u1: VU_B.u + VU_B.ancho / 2 + 0.004, v0: VU_B.v0 - 0.006, v1: VU_B.v1 + 0.006 }; }

// ── legibilidad y cámara ──
/** Menor fracción de altura entre los textos más lejanos: las dos líneas del display y el título de SECUENCIA. */
export function legibilidadMinimaB(g: GeoAtril, cam: CamaraPura, escala: number): { min: number; id: string } {
  let min = Infinity, id = "";
  for (const t of textosB(escala)) {
    if (!(t.fila === "display" || t.id === "t_secuencia")) continue;
    const f = fraccionAltura(g, cam, t);
    if (f < min) { min = f; id = t.id; }
  }
  return { min, id };
}
/** Réplica pura de fitLecternCamera para el BA-40: la búsqueda del atril de sonido + legibilidad (3 pasadas). */
export function buscarPoseBajo(g: GeoAtril, aspect: number, escala: number) {
  const leg = (cam: CamaraPura) => legibilidadMinimaB(g, cam, escala).min;
  for (const [pasada, ancho, exigir] of [[1, 1.7, true], [2, 1.3, true], [3, 1.7, false]] as const) {
    const r = buscarPose(g, aspect, { ...BUSQUEDA_SONIDO, anchoMinNdc: ancho, etiquetaK1: true, legible: exigir ? leg : null });
    if (r) { if (!exigir) r.legible = leg(camaraAtril(g, r.fov, r.height, r.dist, r.pitch, aspect)); return { ...r, pasada }; }
  }
  return null;
}
export { LEGIBLE_MIN, escalaEfectiva };

// ── equipo ──
export const NOMBRE_EQUIPO_B = "BAJO ÁCIDO BA-40";
export const DESCRIPCION_EQUIPO_B = "SINTETIZADOR DE BAJO · 4 MÓDULOS";   // Z100: + CARA (era "3 MÓDULOS")
export const TEXTO_PLACA_B = (marca: string) => `${NOMBRE_EQUIPO_B} · ${marca} · ${DESCRIPCION_EQUIPO_B}`;
export const LEYENDA_FILAS_B = "1 SECUENCIA · 2 VOZ · 3 SALIDA · 4 CARA";   // Z100: + 4 CARA
/** Pose frente al atril (para el checkpoint): a distM del atril, del lado de su frente (local +Z). */
export function poseFrenteAtrilBajo(x: number, z: number, yaw: number, distM: number) {
  const d = Math.max(0.3, distM);
  return { x: x + Math.sin(yaw) * d, z: z + Math.cos(yaw) * d, mirarX: x, mirarY: 1.1, mirarZ: z };
}
/**
 * Posición viva del BA-40 (la escribe LecternSystem desde el slot de instrumentos; la leen el aviso "E" de ThreeScene y
 * el checkpoint). Valores iniciales = slot 0 con el layout de hoy: junto a la caja de ritmos, del lado del atril de sonido.
 */
export const ATRIL_BAJO = { x: 1.7, z: 3.6, yaw: Math.atan2(-1.7, -3.6), visible: false };
