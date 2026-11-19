// Z103: atril "SAMPLER SM-40" (quinto atril de la tarima, índice +2 del arco de instrumentos): layout como DATOS, textos,
// huellas, legibilidad y pose. Mismo panel que SN-40, IM-40, BA-40 y SY-40 (1,40 × 0,65 m; marco de 0,85 m: no se
// agranda), mismas reglas:
//  - de lejos a cerca y de izquierda a derecha: display (pad, estado, BPM; a la derecha la forma de onda del pad con
//    INICIO y FIN) → 1 PADS · 2 GRABAR (fila lejana) → 3 EDITAR PAD · 4 SALIDA (fila cercana);
//  - los textos más lejanos (display y títulos de la fila lejana) ≥ 2,5 % del alto de pantalla con la cámara del atril.
// Lógica pura (importa solo lib/atrilSonido.ts y lib/sampler.ts, también puras). Prueba: scripts/sampler-test.mjs.
import {
  ANCHO_CHAR, BANDA_TITULO, ON_DX, RADIO_FALDA, RADIO_MARCAS_OUT, HUELLA, ESCALA_FADER, PANEL_U, PANEL_V, MARGEN, GAP,
  DISPLAY_PAD, DISPLAY_INTERLINEA, LEGIBLE_MIN, BUSQUEDA_SONIDO, ALTO_TEXTO, NUM_PERILLA_R, NUM_PERILLA_ALTO,
  camaraAtril, fraccionAltura, buscarPose, escalaEfectiva,
  type Rect, type Texto, type GeoAtril, type CamaraPura, type FormaCtrl,
} from "./atrilSonido";
import { N_PADS, LETRAS_PADS, QUANTS } from "./sampler";

export type FilaM = "display" | "medio" | "abajo";
export interface ModuloM { id: string; titulo: string; etiqueta: string; fila: FilaM; rect: Rect; on: string | null }
export interface PosCtrlM {
  id: string; u: number; v: number; forma: FormaCtrl; tipo: "button" | "toggle" | "slider" | "knob";
  etiqueta: string; nombreLargo: string; modulo: string; escala: number; grupo: string; colW: number;
}

const IZQ = -PANEL_U + MARGEN, DER = PANEL_U - MARGEN;
const V_MAX = PANEL_V - MARGEN, V_MIN = -PANEL_V + MARGEN;
export const FILAS_M: Record<FilaM, { v0: number; v1: number }> = {
  display: { v0: 0.226, v1: V_MAX },
  medio:   { v0: -0.040, v1: 0.211 },
  abajo:   { v0: V_MIN, v1: -0.055 },
};
export const DISPLAY_TEXTO_U1 = 0.28;                       // el texto ocupa hasta acá; a la derecha, la forma de onda
export const ONDA_M = { u0: 0.30, u1: DER - 0.012, v0: FILAS_M.display.v0 + 0.008, v1: FILAS_M.display.v1 - 0.008 };
export const ANCHOS_M = { pads: 0.70, editar: 0.62 };
const u1Pads = IZQ + ANCHOS_M.pads, u1Edit = IZQ + ANCHOS_M.editar;
export const MODULOS_M: ModuloM[] = [
  { id: "display", titulo: "", etiqueta: "", fila: "display", rect: { u0: IZQ, u1: DER, ...FILAS_M.display }, on: null },
  { id: "pads",    titulo: "1 PADS", etiqueta: "TOCÁ ACÁ", fila: "medio", rect: { u0: IZQ, u1: u1Pads, ...FILAS_M.medio }, on: null },
  { id: "grabar",  titulo: "2 GRABAR", etiqueta: "MIC O MEZCLA", fila: "medio", rect: { u0: u1Pads + GAP, u1: DER, ...FILAS_M.medio }, on: null },
  { id: "editar",  titulo: "3 EDITAR PAD", etiqueta: "EL ELEGIDO", fila: "abajo", rect: { u0: IZQ, u1: u1Edit, ...FILAS_M.abajo }, on: null },
  { id: "salida",  titulo: "4 SALIDA", etiqueta: "CUÁNTO SUENA", fila: "abajo", rect: { u0: u1Edit + GAP, u1: DER, ...FILAS_M.abajo }, on: "m_on" },
];
export function moduloM(id: string): ModuloM { const m = MODULOS_M.find(x => x.id === id); if (!m) throw new Error(`módulo ${id}`); return m; }
export function posOnM(m: ModuloM): { u: number; v: number } { return { u: m.rect.u1 - ON_DX, v: m.rect.v1 - BANDA_TITULO / 2 }; }

// ── medidas ──
export const PAD_M = { w: 0.100, d: 0.056 };
export const ESC_M = { pad: 1.0, selecc: 0.6, fuente: 0.6, grabar: 0.8, toggle: 0.6, perilla: 0.66, quant: 0.5 };
export const FILA_PADS = [0.126, 0.030] as const;   // las dos filas de 4 pads (y de la fila lejana en general)
export const COL_SELECC = 0.12;
export const ABAJO = { cabecera: FILAS_M.abajo.v1 - BANDA_TITULO - 0.0095, va: -0.160, vb: -0.245 };
export const FADER_M = { rail: 0.12, v: -0.20, u: 0.575 };
export const VU_M = { segmentos: 14, u: 0.650, v0: -0.29, v1: -0.115, ancho: 0.024 };
/** Contador de grabación (lectura ámbar) en GRABAR. */
export function contadorM(): Rect { const g = moduloM("grabar").rect; return { u0: g.u0 + 0.28, u1: g.u1 - 0.025, v0: 0.095, v1: 0.157 }; }
export const PERILLAS_EDITAR = [["afinacion", "AFINACIÓN"], ["inicio", "INICIO"], ["fin", "FIN"], ["volPad", "VOLUMEN"]] as const;
export const TECLAS_EDITAR = [["m_loop", "LOOP", "LOOP"], ["m_reversa", "REVERSA", "REVERSA"], ["m_modo", "MIENTRAS", "MODO MIENTRAS (OFF = DISPARO)"]] as const;

function colPad(i: number): number { const m = moduloM("pads").rect, w = (m.u1 - m.u0 - 0.024 - COL_SELECC) / 4; return m.u0 + 0.012 + w * (i + 0.5); }
export function anchoColPad(): number { const m = moduloM("pads").rect; return (m.u1 - m.u0 - 0.024 - COL_SELECC) / 4; }
function construir(): PosCtrlM[] {
  const L: PosCtrlM[] = [];
  const add = (id: string, u: number, v: number, forma: FormaCtrl, tipo: PosCtrlM["tipo"], etiqueta: string, nombreLargo: string, modulo: string, escala: number, grupo: string, colW: number) =>
    L.push({ id, u, v, forma, tipo, etiqueta, nombreLargo, modulo, escala, grupo, colW });
  // 1 PADS: 2 filas de 4 (tocar = disparar y seleccionar) + SELECC. (seleccionar sin disparar)
  const pa = moduloM("pads").rect, wc = anchoColPad();
  for (let i = 0; i < N_PADS; i++) add(`m_pad_${i}`, colPad(i % 4), FILA_PADS[i < 4 ? 0 : 1], "pad", "button", `${i + 1} · ${LETRAS_PADS[i]}`, `PAD ${i + 1}`, "pads", ESC_M.pad, "pads", wc);
  add("m_selecc", pa.u1 - 0.012 - COL_SELECC / 2, FILA_PADS[0], "pad", "toggle", "SELECC.", "SELECCIONAR SIN SONAR", "pads", ESC_M.selecc, "", COL_SELECC);
  // 2 GRABAR: fuente MIC / MEZCLA (radio), GRABAR/PARAR (luz) y BORRAR; a la derecha el contador
  const gr = moduloM("grabar").rect, c0 = gr.u0 + 0.012 + 0.06;
  add("m_fuente_0", c0, FILA_PADS[0], "pad", "toggle", "MIC", "FUENTE MIC", "grabar", ESC_M.fuente, "fuente", 0.12);
  add("m_fuente_1", c0 + 0.12, FILA_PADS[0], "pad", "toggle", "MEZCLA", "FUENTE MEZCLA", "grabar", ESC_M.fuente, "fuente", 0.12);
  add("m_grabar", c0, FILA_PADS[1], "pad", "toggle", "GRABAR", "GRABAR / PARAR", "grabar", ESC_M.grabar, "grab", 0.12);
  add("m_borrar", c0 + 0.12, FILA_PADS[1], "pad", "button", "BORRAR", "BORRAR (SONIDO DE FÁBRICA)", "grabar", ESC_M.grabar, "grab", 0.12);
  // 3 EDITAR PAD: 4 perillas y 3 teclas (del pad seleccionado)
  const ed = moduloM("editar").rect, wk = (ed.u1 - ed.u0 - 0.024) / 4, wt = (ed.u1 - ed.u0 - 0.024) / 3;
  PERILLAS_EDITAR.forEach(([pid, et], i) => add(`m_p_${pid}`, ed.u0 + 0.012 + wk * (i + 0.5), ABAJO.va, "normal", "knob", et, pid === "volPad" ? "VOLUMEN DEL PAD" : et, "editar", ESC_M.perilla, "", wk));
  TECLAS_EDITAR.forEach(([id, et, nl], i) => add(id, ed.u0 + 0.012 + wt * (i + 0.5), ABAJO.vb, "pad", "toggle", et, nl, "editar", ESC_M.toggle, "editar", wt));
  // 4 SALIDA: CORTE, RESONANCIA, QUANT (radio), VOLUMEN, VU, ON
  const sa = moduloM("salida").rect;
  add("m_p_corte", sa.u0 + 0.062, ABAJO.va, "normal", "knob", "CORTE", "CORTE", "salida", ESC_M.perilla, "", 0.1);
  add("m_p_resonancia", sa.u0 + 0.162, ABAJO.va, "normal", "knob", "RESONANCIA", "RESONANCIA", "salida", ESC_M.perilla, "", 0.1);
  QUANTS.forEach((q, i) => add(`m_q_${i}`, sa.u0 + 0.235 + 0.075 * (i + 0.5), ABAJO.va, "pad", "toggle", q, `QUANT ${q}`, "salida", ESC_M.quant, "quant", 0.075));
  add("m_vol", FADER_M.u, FADER_M.v, "normal", "slider", "VOLUMEN", "VOLUMEN", "salida", 1, "", 0.11);
  const on = posOnM(moduloM("salida"));
  add("m_on", on.u, on.v, "pastilla", "toggle", "ON", "SALIDA DEL SAMPLER", "salida", 1, "", 0);
  return L;
}
export const POSICIONES_M: PosCtrlM[] = construir();
export function posM(id: string): PosCtrlM | undefined { return POSICIONES_M.find(p => p.id === id); }
/** Marca del pad seleccionado: una barra ámbar sobre el pad (entre el pad y lo que tiene arriba). */
export function marcaSeleccion(pad: number): Rect {
  const p = posM(`m_pad_${Math.max(0, Math.min(N_PADS - 1, pad))}`)!, hw = (PAD_M.w / 2) * p.escala, top = p.v + (PAD_M.d / 2 + 0.006) * p.escala;
  return { u0: p.u - hw, u1: p.u + hw, v0: top + 0.0015, v1: top + 0.0045 };
}

// ── huellas ──
export function huellaM(p: PosCtrlM): Rect {
  const s = p.escala;
  let hu: number, hv: number;
  if (p.forma === "pad") { hu = (PAD_M.w / 2) * s; hv = (PAD_M.d / 2 + 0.006) * s; }
  else if (p.forma === "pastilla") { hu = HUELLA.PASTILLA_U; hv = HUELLA.PASTILLA_V; }
  else if (p.tipo === "slider") { hu = HUELLA.FADER_U; hv = FADER_M.rail / 2 + HUELLA.THUMB_D / 2; }
  else if (p.tipo === "button") { hu = HUELLA.BOTON; hv = HUELLA.BOTON; }
  else { const r = RADIO_MARCAS_OUT * s; return { u0: p.u - r * 0.988, u1: p.u + r * 0.988, v0: p.v - Math.max(RADIO_FALDA * s, r * 0.7072), v1: p.v + r }; }
  return { u0: p.u - hu, u1: p.u + hu, v0: p.v - hv, v1: p.v + hv };
}
function radioM(p: PosCtrlM): number {
  if (p.forma === "pad") return (PAD_M.d / 2) * p.escala;
  if (p.tipo === "button") return 0.030;
  if (p.tipo === "knob") return RADIO_FALDA * p.escala;
  return 0.02;
}

// ── textos ──
export const ALTO_M = { titulo: ALTO_TEXTO.efectos.titulo, tituloAbajo: 0.023, etiqueta: 0.017, tag: 0.016, fila: 0.013 };
export const DISPLAY_CHARS_M = [44, 44];
export function altosDisplayM(escala: number): [number, number] {
  const e = Math.max(0.5, Math.min(2, Number.isFinite(escala) ? escala : 1));
  const d = moduloM("display").rect, b1 = ALTO_TEXTO.display.titulo, b2 = ALTO_TEXTO.display.etiqueta;
  const porAlto = (d.v1 - d.v0 - 2 * DISPLAY_PAD - DISPLAY_INTERLINEA) / (b1 + b2);
  const porAncho = (DISPLAY_TEXTO_U1 - d.u0 - 0.024) / (DISPLAY_CHARS_M[0] * ANCHO_CHAR * b1);
  const k = Math.min(e, porAlto, porAncho);
  return [b1 * k, b2 * k];
}
type F = Texto["fila"];
const FILA_TXT: Record<FilaM, F> = { display: "display", medio: "efectos", abajo: "tono" };
export const AYUDA_GRABAR = "SE GRABA EN EL PAD ELEGIDO";
export function textosM(escala: number, numerados = true): Texto[] {
  const e = Math.max(0.5, Math.min(2, Number.isFinite(escala) ? escala : 1));
  const T: Texto[] = [];
  const add = (id: string, texto: string, u: number, v: number, alto: number, alinear: "centro" | "izq", fila: FilaM) =>
    T.push({ id, texto, u, v, alto, ancho: texto.length * ANCHO_CHAR * alto, alinear, fila: FILA_TXT[fila] });
  const d = moduloM("display").rect, [h1, h2] = altosDisplayM(e);
  add("d_linea1", "X".repeat(DISPLAY_CHARS_M[0]), d.u0 + 0.012, d.v1 - DISPLAY_PAD - h1 / 2, h1, "izq", "display");
  add("d_linea2", "X".repeat(DISPLAY_CHARS_M[1]), d.u0 + 0.012, d.v1 - DISPLAY_PAD - h1 - DISPLAY_INTERLINEA - h2 / 2, h2, "izq", "display");
  for (const m of MODULOS_M) {
    if (m.fila === "display") continue;
    const tit = numerados ? m.titulo : m.titulo.replace(/^\d /, "");
    const libre = m.rect.u1 - m.rect.u0 - 0.024 - (m.on ? ON_DX + 0.034 : 0);
    const base = m.fila === "medio" ? ALTO_M.titulo : ALTO_M.tituloAbajo;
    const alto = Math.min(base * e, BANDA_TITULO - 0.012, (libre * 0.62) / (tit.length * ANCHO_CHAR));
    const vb = m.rect.v1 - BANDA_TITULO / 2;
    add(`t_${m.id}`, tit, m.rect.u0 + 0.012, vb, alto, "izq", m.fila);
    const tag = `· ${m.etiqueta}`, u1 = m.rect.u0 + 0.012 + tit.length * ANCHO_CHAR * alto + 0.012;
    const altoTag = Math.min(ALTO_M.tag * e, alto, (m.rect.u0 + 0.012 + libre - u1) / (tag.length * ANCHO_CHAR));
    add(`g_${m.id}`, tag, u1, vb - (alto - altoTag) / 2 + 0.0005, altoTag, "izq", m.fila);
  }
  // ayuda de GRABAR (debajo del contador) y cabecera QUANT
  const ct = contadorM();
  add("c_grabar", AYUDA_GRABAR, ct.u0, FILA_PADS[1], Math.min(ALTO_M.fila * e, (ct.u1 - ct.u0) / (AYUDA_GRABAR.length * ANCHO_CHAR)), "izq", "medio");
  const sa = moduloM("salida").rect;
  add("c_quant", "QUANT", sa.u0 + 0.235, ABAJO.cabecera, Math.min(ALTO_M.fila * e, 0.3 / (5 * ANCHO_CHAR)), "izq", "abajo");
  // etiquetas (debajo de cada control); en un grupo de pads, todas del alto de la más larga
  const largoGrupo = new Map<string, number>();
  for (const p of POSICIONES_M) if (p.grupo) largoGrupo.set(p.grupo, Math.max(largoGrupo.get(p.grupo) ?? 0, p.etiqueta.length));
  for (const p of POSICIONES_M) {
    if (!p.etiqueta || p.forma === "pastilla") continue;
    const m = moduloM(p.modulo), r = radioM(p), largo = p.grupo ? largoGrupo.get(p.grupo)! : p.etiqueta.length;
    const anchoLibre = Math.min(2 * Math.min(p.u - m.rect.u0, m.rect.u1 - p.u) - 0.006, p.colW - 0.012);
    const altoLibre = p.tipo === "slider" ? 0.02 : p.v - r - 0.008 - (m.rect.v0 + 0.003);
    const alto = Math.min(ALTO_M.etiqueta * e, anchoLibre / (largo * ANCHO_CHAR), altoLibre);
    const v = p.tipo === "slider" ? FADER_M.v - FADER_M.rail / 2 - HUELLA.THUMB_D / 2 - 0.003 - alto / 2 : p.v - r - 0.008 - alto / 2;
    add(`e_${p.id}`, p.etiqueta, p.u, v, alto, "centro", m.fila);
  }
  return T;
}
export function numerosPerillaM(p: PosCtrlM): Texto[] {
  if (p.tipo !== "knob") return [];
  const r = NUM_PERILLA_R * p.escala, h = NUM_PERILLA_ALTO, s = Math.SQRT1_2;
  const [a, b] = p.id === "m_p_afinacion" ? ["-12", "+12"] : ["0", "10"];
  const mk = (id: string, texto: string, u: number, v: number): Texto => ({ id, texto, u, v, alto: h, ancho: texto.length * ANCHO_CHAR * h, alinear: "centro", fila: "tono" });
  return [mk(`n0_${p.id}`, a, p.u - s * r, p.v - s * r), mk(`n1_${p.id}`, b, p.u + s * r, p.v - s * r)];
}
export function numerosFaderM(p: PosCtrlM): Texto[] {
  const h = ESCALA_FADER.alto, uDer = p.u - HUELLA.FADER_U - 0.004 - ESCALA_FADER.marcaLarga - 0.003;
  return [0, 5, 10].map(n => { const t = String(n), ancho = t.length * ANCHO_CHAR * h;
    return { id: `nf${n}`, texto: t, u: uDer - ancho / 2, v: FADER_M.v - FADER_M.rail / 2 + (n / 10) * FADER_M.rail, alto: h, ancho, alinear: "centro" as const, fila: "tono" as F }; });
}
export function rectVuM(): Rect { return { u0: VU_M.u - VU_M.ancho / 2 - 0.004, u1: VU_M.u + VU_M.ancho / 2 + 0.004, v0: VU_M.v0 - 0.006, v1: VU_M.v1 + 0.006 }; }

// ── legibilidad y cámara ──
export function legibilidadMinimaM(g: GeoAtril, cam: CamaraPura, escala: number): { min: number; id: string } {
  let min = Infinity, id = "";
  for (const t of textosM(escala)) {
    if (!(t.fila === "display" || t.id === "t_pads" || t.id === "t_grabar")) continue;
    const f = fraccionAltura(g, cam, t);
    if (f < min) { min = f; id = t.id; }
  }
  return { min, id };
}
export function buscarPoseSampler(g: GeoAtril, aspect: number, escala: number) {
  const leg = (cam: CamaraPura) => legibilidadMinimaM(g, cam, escala).min;
  for (const [pasada, ancho, exigir] of [[1, 1.7, true], [2, 1.3, true], [3, 1.7, false]] as const) {
    const r = buscarPose(g, aspect, { ...BUSQUEDA_SONIDO, anchoMinNdc: ancho, etiquetaK1: true, legible: exigir ? leg : null });
    if (r) { if (!exigir) r.legible = leg(camaraAtril(g, r.fov, r.height, r.dist, r.pitch, aspect)); return { ...r, pasada }; }
  }
  return null;
}
export { LEGIBLE_MIN, escalaEfectiva };

// ── equipo ──
export const NOMBRE_EQUIPO_M = "SAMPLER SM-40";
export const DESCRIPCION_EQUIPO_M = "SAMPLER DE 8 PADS · 4 MÓDULOS";
export const TEXTO_PLACA_M = (marca: string) => `${NOMBRE_EQUIPO_M} · ${marca} · ${DESCRIPCION_EQUIPO_M}`;
export const LEYENDA_FILAS_M = "1 PADS · 2 GRABAR · 3 EDITAR PAD · 4 SALIDA";
export function poseFrenteAtrilSampler(x: number, z: number, yaw: number, distM: number) {
  const d = Math.max(0.3, distM);
  return { x: x + Math.sin(yaw) * d, z: z + Math.cos(yaw) * d, mirarX: x, mirarY: 1.1, mirarZ: z };
}
/** Posición viva del SM-40 (la escribe poseAtrilSampler en lib/instrumentosPose.ts con poseInstrumento(2)). */
export const ATRIL_SAMPLER = { x: 3.5, z: 1.5, yaw: 0, visible: false };
