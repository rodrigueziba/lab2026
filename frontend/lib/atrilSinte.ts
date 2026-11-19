// Z101: atril "SINTETIZADOR SY-40" (cuarto atril de la tarima, índice −1 del arco de instrumentos): layout como DATOS,
// textos, huellas, legibilidad y pose. Mismo panel que SN-40, IM-40 y BA-40 (1,40 × 0,65 m; el marco ya mide 0,85 m de
// fondo: no se agranda), mismas reglas:
//  - del más simple al más fino, de izquierda a derecha y de lejos a cerca: display (sonido, arpegiador, BPM; a la derecha
//    la forma de onda de OSC1 y la curva del filtro) → 1 SONIDOS · 2 TIMBRE · 3 FILTRO Y ENVOLVENTE (fila lejana) →
//    4 MOVIMIENTO (LFO, ECO, ARPEGIADOR) · 5 TECLADO Y SALIDA (fila cercana);
//  - los textos más lejanos (display y títulos de la fila lejana) ≥ 2,5 % del alto de pantalla con la cámara del atril.
// Lógica pura (importa solo lib/atrilSonido.ts y lib/sinte.ts, también puras). Prueba: scripts/sinte-test.mjs.
import {
  ANCHO_CHAR, BANDA_TITULO, ON_DX, RADIO_FALDA, RADIO_MARCAS_OUT, HUELLA, ESCALA_FADER, PANEL_U, PANEL_V, MARGEN, GAP,
  DISPLAY_PAD, DISPLAY_INTERLINEA, LEGIBLE_MIN, BUSQUEDA_SONIDO, ALTO_TEXTO, NUM_PERILLA_R, NUM_PERILLA_ALTO,
  camaraAtril, fraccionAltura, buscarPose, escalaEfectiva,
  type Rect, type Texto, type GeoAtril, type CamaraPura, type FormaCtrl,
} from "./atrilSonido";
import {
  NOMBRES_SONIDO, FORMAS_CORTAS, DESTINOS_LFO_CORTOS, TIEMPOS_ECO, PATRONES_ARP_CORTOS, VELOCIDADES_ARP, NOMBRES_NOTA, AYUDA_PIANO,
  nombreSonido,
} from "./sinte";

export type FilaY = "display" | "medio" | "abajo";
export interface ModuloY { id: string; titulo: string; etiqueta: string; fila: FilaY; rect: Rect; on: string | null }
export interface PosCtrlY {
  id: string; u: number; v: number; forma: FormaCtrl; tipo: "button" | "toggle" | "slider" | "knob";
  etiqueta: string; nombreLargo: string; modulo: string; escala: number;
  grupo: string;   // grupo de pads (radio): sus etiquetas van todas del mismo alto
  colW: number;    // ancho de su columna (para la etiqueta)
}

const IZQ = -PANEL_U + MARGEN, DER = PANEL_U - MARGEN;
const V_MAX = PANEL_V - MARGEN, V_MIN = -PANEL_V + MARGEN;
export const FILAS_Y: Record<FilaY, { v0: number; v1: number }> = {
  display: { v0: 0.226, v1: V_MAX },
  medio:   { v0: -0.040, v1: 0.211 },
  abajo:   { v0: V_MIN, v1: -0.055 },
};
export const DISPLAY_TEXTO_U1 = 0.28;                       // el texto ocupa hasta acá; a la derecha, onda y filtro
export const ONDA_Y = { u0: 0.30, u1: 0.475, v0: FILAS_Y.display.v0 + 0.008, v1: FILAS_Y.display.v1 - 0.008 };
export const CURVA_Y = { u0: 0.49, u1: DER - 0.012, v0: FILAS_Y.display.v0 + 0.008, v1: FILAS_Y.display.v1 - 0.008 };
/** Anchos de los módulos (m). Fila lejana: SONIDOS + TIMBRE + FILTRO = 1,37 con dos GAP. Fila cercana: MOVIMIENTO + TECLADO. */
export const ANCHOS_Y = { sonidos: 0.315, timbre: 0.505, movimiento: 0.758 };
const u1Son = IZQ + ANCHOS_Y.sonidos, u1Tim = u1Son + GAP + ANCHOS_Y.timbre, u1Mov = IZQ + ANCHOS_Y.movimiento;
export const MODULOS_Y: ModuloY[] = [
  { id: "display",    titulo: "", etiqueta: "", fila: "display", rect: { u0: IZQ, u1: DER, ...FILAS_Y.display }, on: null },
  { id: "sonidos",    titulo: "1 SONIDOS", etiqueta: "UN CLIC", fila: "medio", rect: { u0: IZQ, u1: u1Son, ...FILAS_Y.medio }, on: null },
  { id: "timbre",     titulo: "2 TIMBRE", etiqueta: "DE QUÉ ESTÁ HECHO", fila: "medio", rect: { u0: u1Son + GAP, u1: u1Tim, ...FILAS_Y.medio }, on: null },
  { id: "filtro",     titulo: "3 FILTRO Y ENVOLVENTE", etiqueta: "", fila: "medio", rect: { u0: u1Tim + GAP, u1: DER, ...FILAS_Y.medio }, on: null },
  { id: "movimiento", titulo: "4 MOVIMIENTO", etiqueta: "CÓMO SE MUEVE", fila: "abajo", rect: { u0: IZQ, u1: u1Mov, ...FILAS_Y.abajo }, on: null },
  { id: "teclado",    titulo: "5 TECLADO Y SALIDA", etiqueta: "TOCÁ ACÁ", fila: "abajo", rect: { u0: u1Mov + GAP, u1: DER, ...FILAS_Y.abajo }, on: "y_on" },
];
export function moduloY(id: string): ModuloY { const m = MODULOS_Y.find(x => x.id === id); if (!m) throw new Error(`módulo ${id}`); return m; }
export function posOnY(m: ModuloY): { u: number; v: number } { return { u: m.rect.u1 - ON_DX, v: m.rect.v1 - BANDA_TITULO / 2 }; }

// ── medidas ──
export const PAD_Y = { w: 0.100, d: 0.056 };                // el pad de IM-40 y BA-40 (se escala)
export const ESC_Y = { sonido: 0.8, forma: 0.55, perilla: 0.70, perillaMov: 0.66, sel: 0.5, arpB: 0.45, tecla: 0.36 };
/** Filas de perillas de la fila lejana (alineadas en TIMBRE y FILTRO) y de la cercana. */
export const VK1 = FILAS_Y.medio.v1 - BANDA_TITULO - RADIO_MARCAS_OUT * ESC_Y.perilla - 0.0045, VK2 = VK1 - 0.099;
export const MOV = { cabecera: FILAS_Y.abajo.v1 - BANDA_TITULO - 0.0095, va: -0.160, vb: -0.240, lfo: 0.19, eco: 0.19, arp: 0.33, sep: 0.012 };
export const TEC = { blancas: -0.200, negras: -0.150, ayuda: -0.252, x0: 0.012, x1: 0.425, oct: 0.462, octMas: -0.140, octMenos: -0.228 };
export const FADER_Y = { rail: 0.12, v: -0.20, u: 0.575 };
export const VU_Y = { segmentos: 14, u: 0.650, v0: -0.29, v1: -0.115, ancho: 0.024 };
export const COL_ROTULO_TIMBRE = 0.055, COL_FORMA = 0.0625, COL_SELECTOR = 0.12;
/** Teclado del atril: 13 teclas (una octava, DO a DO). Blancas: semitono e índice de columna; negras: entre dos columnas. */
export const BLANCAS = [0, 2, 4, 5, 7, 9, 11, 12] as const;
export const NEGRAS = [[1, 0], [3, 1], [6, 3], [8, 4], [10, 5]] as const;   // [semitono, columna blanca de la izquierda]
export const PERILLAS_TIMBRE = [["desafine", "DESAFINE"], ["mezcla", "MEZCLA"], ["sub", "SUB"], ["ruido", "RUIDO"]] as const;
export const PERILLAS_FILTRO = [["corte", "CORTE"], ["resonancia", "RESONANCIA"], ["modEnv", "MOD. ENV."], ["seguimiento", "SEGUIM."]] as const;
export const PERILLAS_ENV = ["ATAQUE", "DECAY", "SOSTENIDO", "RELEASE"] as const;
/** La envolvente que editan las 4 perillas de ENVOLVENTE (selector VOL / FILTRO). */
export const PARAMS_ENV = { vol: ["ataque", "decay", "sostenido", "release"], filtro: ["fAtaque", "fDecay", "fSostenido", "fRelease"] } as const;

function construir(): PosCtrlY[] {
  const L: PosCtrlY[] = [];
  const add = (id: string, u: number, v: number, forma: FormaCtrl, tipo: PosCtrlY["tipo"], etiqueta: string, nombreLargo: string, modulo: string, escala: number, grupo: string, colW: number) =>
    L.push({ id, u, v, forma, tipo, etiqueta, nombreLargo, modulo, escala, grupo, colW });
  // 1 SONIDOS: 3 × 2 pads (radio)
  const so = moduloY("sonidos").rect, ws = (so.u1 - so.u0 - 0.024) / 3, vf1 = so.v1 - BANDA_TITULO - 0.040, vf2 = vf1 - 0.096;
  NOMBRES_SONIDO.forEach((nm, i) => add(`y_son_${nm}`, so.u0 + 0.012 + ws * ((i % 3) + 0.5), i < 3 ? vf1 : vf2, "pad", "toggle", nombreSonido(nm), `SONIDO ${nombreSonido(nm)}`, "sonidos", ESC_Y.sonido, "sonidos", ws));
  // 2 TIMBRE: rótulos OSC 1 / OSC 2, 4 pads de forma por oscilador (radio) y 4 perillas en 2 × 2
  const ti = moduloY("timbre").rect, xf = ti.u0 + 0.012 + COL_ROTULO_TIMBRE;
  for (const [o, vv] of [[1, VK1], [2, VK2]] as const)
    FORMAS_CORTAS.forEach((f, i) => add(`y_o${o}_${i}`, xf + COL_FORMA * (i + 0.5), vv, "pad", "toggle", f, `OSC ${o} ${["SENO", "TRIÁNGULO", "SIERRA", "CUADRADA"][i]}`, "timbre", ESC_Y.forma, "formas", COL_FORMA));
  const xk = xf + 4 * COL_FORMA, wkt = (ti.u1 - 0.012 - xk) / 2;
  PERILLAS_TIMBRE.forEach(([pid, et], i) => add(`y_p_${pid}`, xk + wkt * ((i % 2) + 0.5), i < 2 ? VK1 : VK2, "normal", "knob", et, et, "timbre", ESC_Y.perilla, "", wkt));
  // 3 FILTRO Y ENVOLVENTE: fila 1 FILTRO (4 perillas), fila 2 ENVOLVENTE (4 perillas) + selector VOL / FILTRO
  const fi = moduloY("filtro").rect, wkf = (fi.u1 - fi.u0 - 0.024 - COL_SELECTOR) / 4;
  PERILLAS_FILTRO.forEach(([pid, et], i) => add(`y_p_${pid}`, fi.u0 + 0.012 + wkf * (i + 0.5), VK1, "normal", "knob", et, pid === "seguimiento" ? "SEGUIMIENTO DE TECLA" : pid === "modEnv" ? "MOD. ENV." : et, "filtro", ESC_Y.perilla, "", wkf));
  PERILLAS_ENV.forEach((et, i) => add(`y_env_${i}`, fi.u0 + 0.012 + wkf * (i + 0.5), VK2, "normal", "knob", et, et, "filtro", ESC_Y.perilla, "", wkf));
  const us = fi.u1 - 0.012 - COL_SELECTOR / 2;
  add("y_envsel_vol", us - 0.029, VK2, "pad", "toggle", "VOL", "ENVOLVENTE DE VOLUMEN", "filtro", ESC_Y.sel, "envsel", 0.058);
  add("y_envsel_filtro", us + 0.029, VK2, "pad", "toggle", "FILTRO", "ENVOLVENTE DEL FILTRO", "filtro", ESC_Y.sel, "envsel", 0.058);
  // 4 MOVIMIENTO: LFO | ECO | ARPEGIADOR
  const mo = moduloY("movimiento").rect, gLfo = mo.u0 + 0.012, gEco = gLfo + MOV.lfo + MOV.sep, gArp = gEco + MOV.eco + MOV.sep;
  const dosK = (g: number, w: number, i: number) => g + (w / 2) * (i + 0.5), tres = (g: number, w: number, i: number) => g + (w / 3) * (i + 0.5);
  add("y_p_lfoVel", dosK(gLfo, MOV.lfo, 0), MOV.va, "normal", "knob", "VELOC.", "LFO VELOCIDAD", "movimiento", ESC_Y.perillaMov, "", MOV.lfo / 2);
  add("y_p_lfoProf", dosK(gLfo, MOV.lfo, 1), MOV.va, "normal", "knob", "PROF.", "LFO PROFUNDIDAD", "movimiento", ESC_Y.perillaMov, "", MOV.lfo / 2);
  DESTINOS_LFO_CORTOS.forEach((d, i) => add(`y_lfo_${i}`, tres(gLfo, MOV.lfo, i), MOV.vb, "pad", "toggle", d, `LFO DESTINO ${["AFINACIÓN", "CORTE", "VOLUMEN"][i]}`, "movimiento", ESC_Y.sel, "lfo", MOV.lfo / 3));
  add("y_p_ecoRealim", dosK(gEco, MOV.eco, 0), MOV.va, "normal", "knob", "REALIM.", "ECO REALIMENTACIÓN", "movimiento", ESC_Y.perillaMov, "", MOV.eco / 2);
  add("y_p_ecoMezcla", dosK(gEco, MOV.eco, 1), MOV.va, "normal", "knob", "MEZCLA", "ECO MEZCLA", "movimiento", ESC_Y.perillaMov, "", MOV.eco / 2);
  TIEMPOS_ECO.forEach((d, i) => add(`y_eco_${i}`, tres(gEco, MOV.eco, i), MOV.vb, "pad", "toggle", d, `ECO TIEMPO ${["1/8", "1/4", "1/4 CON PUNTILLO"][i]}`, "movimiento", ESC_Y.sel, "eco", MOV.eco / 3));
  const wa = MOV.arp / 5, wb = MOV.arp / 6;
  add("y_arp_on", gArp + wa * 0.5, MOV.va, "pad", "toggle", "ON", "ARPEGIADOR", "movimiento", ESC_Y.sel, "arpA", wa);
  PATRONES_ARP_CORTOS.forEach((d, i) => add(`y_arp_pat_${i}`, gArp + wa * (i + 1.5), MOV.va, "pad", "toggle", d, `ARPEGIO ${["ARRIBA", "ABAJO", "IDA Y VUELTA", "AZAR"][i]}`, "movimiento", ESC_Y.sel, "arpA", wa));
  VELOCIDADES_ARP.forEach((d, i) => add(`y_arp_vel_${i}`, gArp + wb * (i + 0.5), MOV.vb, "pad", "toggle", d, `ARPEGIO VELOCIDAD ${d}`, "movimiento", ESC_Y.arpB, "arpB", wb));
  [1, 2, 3].forEach((n, i) => add(`y_arp_oct_${n}`, gArp + wb * (i + 3.5), MOV.vb, "pad", "toggle", `${n} OCT`, `ARPEGIO ${n} OCTAVA${n > 1 ? "S" : ""}`, "movimiento", ESC_Y.arpB, "arpB", wb));
  // 5 TECLADO Y SALIDA: 13 teclas (8 blancas abajo, 5 negras arriba), OCT + / OCT −, VOLUMEN, VU y ON
  const te = moduloY("teclado").rect, kx0 = te.u0 + TEC.x0, colK = (TEC.x1 - kx0) / BLANCAS.length;
  BLANCAS.forEach((s, i) => add(`y_tecla_${s}`, kx0 + colK * (i + 0.5), TEC.blancas, "pad", "button", NOMBRES_NOTA[s % 12], `TECLA ${NOMBRES_NOTA[s % 12]}`, "teclado", ESC_Y.tecla, "blancas", colK));
  NEGRAS.forEach(([s, c]) => add(`y_tecla_${s}`, kx0 + colK * (c + 1), TEC.negras, "pad", "button", "", `TECLA ${NOMBRES_NOTA[s]}`, "teclado", ESC_Y.tecla, "negras", colK));
  add("y_oct_mas", TEC.oct, TEC.octMas, "normal", "button", "OCT +", "OCTAVA +", "teclado", 1, "", 0.075);
  add("y_oct_menos", TEC.oct, TEC.octMenos, "normal", "button", "OCT −", "OCTAVA −", "teclado", 1, "", 0.075);
  add("y_vol", FADER_Y.u, FADER_Y.v, "normal", "slider", "VOLUMEN", "VOLUMEN", "teclado", 1, "", 0.11);
  const on = posOnY(moduloY("teclado"));
  add("y_on", on.u, on.v, "pastilla", "toggle", "ON", "SALIDA DEL SINTE", "teclado", 1, "", 0);
  return L;
}
export const POSICIONES_Y: PosCtrlY[] = construir();
export function posY(id: string): PosCtrlY | undefined { return POSICIONES_Y.find(p => p.id === id); }
/** Columna u de las teclas (para los textos de ayuda). */
export function teclado(): { x0: number; x1: number } { const te = moduloY("teclado").rect; return { x0: te.u0 + TEC.x0, x1: TEC.x1 }; }

// ── huellas ──
export function huellaY(p: PosCtrlY): Rect {
  const s = p.escala;
  let hu: number, hv: number;
  if (p.forma === "pad") { hu = (PAD_Y.w / 2) * s; hv = (PAD_Y.d / 2 + 0.006) * s; }
  else if (p.forma === "pastilla") { hu = HUELLA.PASTILLA_U; hv = HUELLA.PASTILLA_V; }
  else if (p.tipo === "slider") { hu = HUELLA.FADER_U; hv = FADER_Y.rail / 2 + HUELLA.THUMB_D / 2; }
  else if (p.tipo === "button") { hu = HUELLA.BOTON; hv = HUELLA.BOTON; }
  else { const r = RADIO_MARCAS_OUT * s; return { u0: p.u - r * 0.988, u1: p.u + r * 0.988, v0: p.v - Math.max(RADIO_FALDA * s, r * 0.7072), v1: p.v + r }; }
  return { u0: p.u - hu, u1: p.u + hu, v0: p.v - hv, v1: p.v + hv };
}
function radioY(p: PosCtrlY): number {
  if (p.forma === "pad") return (PAD_Y.d / 2) * p.escala;
  if (p.tipo === "button") return 0.030;
  if (p.tipo === "knob") return RADIO_FALDA * p.escala;
  return 0.02;
}

// ── textos ──
export const ALTO_Y = { titulo: ALTO_TEXTO.efectos.titulo, tituloAbajo: 0.023, etiqueta: 0.017, tag: 0.016, fila: 0.013, numero: 0.011 };
export const DISPLAY_CHARS_Y = [44, 44];
export function altosDisplayY(escala: number): [number, number] {
  const e = Math.max(0.5, Math.min(2, Number.isFinite(escala) ? escala : 1));
  const d = moduloY("display").rect, b1 = ALTO_TEXTO.display.titulo, b2 = ALTO_TEXTO.display.etiqueta;
  const porAlto = (d.v1 - d.v0 - 2 * DISPLAY_PAD - DISPLAY_INTERLINEA) / (b1 + b2);
  const porAncho = (DISPLAY_TEXTO_U1 - d.u0 - 0.024) / (DISPLAY_CHARS_Y[0] * ANCHO_CHAR * b1);
  const k = Math.min(e, porAlto, porAncho);
  return [b1 * k, b2 * k];
}
type F = Texto["fila"];
const FILA_TXT: Record<FilaY, F> = { display: "display", medio: "efectos", abajo: "tono" };
/** Texto de ayuda del teclado: las teclas de la computadora que tocan el piano. */
export const TEXTO_AYUDA_PIANO = `PIANO: ${AYUDA_PIANO}`;
export function textosY(escala: number, numerados = true): Texto[] {
  const e = Math.max(0.5, Math.min(2, Number.isFinite(escala) ? escala : 1));
  const T: Texto[] = [];
  const add = (id: string, texto: string, u: number, v: number, alto: number, alinear: "centro" | "izq", fila: FilaY) =>
    T.push({ id, texto, u, v, alto, ancho: texto.length * ANCHO_CHAR * alto, alinear, fila: FILA_TXT[fila] });
  const d = moduloY("display").rect, [h1, h2] = altosDisplayY(e);
  add("d_linea1", "X".repeat(DISPLAY_CHARS_Y[0]), d.u0 + 0.012, d.v1 - DISPLAY_PAD - h1 / 2, h1, "izq", "display");
  add("d_linea2", "X".repeat(DISPLAY_CHARS_Y[1]), d.u0 + 0.012, d.v1 - DISPLAY_PAD - h1 - DISPLAY_INTERLINEA - h2 / 2, h2, "izq", "display");
  for (const m of MODULOS_Y) {
    if (m.fila === "display") continue;
    const tit = numerados ? m.titulo : m.titulo.replace(/^\d /, "");
    const libre = m.rect.u1 - m.rect.u0 - 0.024 - (m.on ? ON_DX + 0.034 : 0);
    const base = m.fila === "medio" ? ALTO_Y.titulo : ALTO_Y.tituloAbajo;
    const parte = m.etiqueta ? 0.62 : 1;   // sin etiqueta, el título puede usar todo el ancho libre
    const alto = Math.min(base * e, BANDA_TITULO - 0.012, (libre * parte) / (tit.length * ANCHO_CHAR));
    const vb = m.rect.v1 - BANDA_TITULO / 2;
    add(`t_${m.id}`, tit, m.rect.u0 + 0.012, vb, alto, "izq", m.fila);
    if (!m.etiqueta) continue;
    const tag = `· ${m.etiqueta}`, u1 = m.rect.u0 + 0.012 + tit.length * ANCHO_CHAR * alto + 0.012;
    const altoTag = Math.min(ALTO_Y.tag * e, alto, (m.rect.u0 + 0.012 + libre - u1) / (tag.length * ANCHO_CHAR));
    add(`g_${m.id}`, tag, u1, vb - (alto - altoTag) / 2 + 0.0005, altoTag, "izq", m.fila);
  }
  // rótulos de fila (OSC 1 / OSC 2), cabeceras de MOVIMIENTO, "ENV. DE" del selector y la ayuda del piano
  const ti = moduloY("timbre").rect;
  for (const [id, et, vv] of [["r_osc1", "OSC 1", VK1], ["r_osc2", "OSC 2", VK2]] as const)
    add(id, et, ti.u0 + 0.012, vv, Math.min(ALTO_Y.fila * e, (COL_ROTULO_TIMBRE - 0.006) / (et.length * ANCHO_CHAR)), "izq", "medio");
  const mo = moduloY("movimiento").rect, gLfo = mo.u0 + 0.012, gEco = gLfo + MOV.lfo + MOV.sep, gArp = gEco + MOV.eco + MOV.sep;
  for (const [id, et, g, w] of [["c_lfo", "LFO", gLfo, MOV.lfo], ["c_eco", "ECO", gEco, MOV.eco], ["c_arp", "ARPEGIADOR", gArp, MOV.arp]] as const)
    add(id, et, g, MOV.cabecera, Math.min(ALTO_Y.fila * e, w / (et.length * ANCHO_CHAR)), "izq", "abajo");
  const fi = moduloY("filtro").rect, us = fi.u1 - 0.012 - COL_SELECTOR / 2, etSel = "ENV. DE";
  add("c_envsel", etSel, us, VK2 + 0.036, Math.min(ALTO_Y.fila * e, (COL_SELECTOR - 0.012) / (etSel.length * ANCHO_CHAR)), "centro", "medio");
  const k = teclado();
  add("c_piano", TEXTO_AYUDA_PIANO, k.x0, TEC.ayuda, Math.min(ALTO_Y.fila * e, (k.x1 - k.x0) / (TEXTO_AYUDA_PIANO.length * ANCHO_CHAR)), "izq", "abajo");
  // etiquetas (debajo de cada control); en un grupo de pads, todas del alto de la más larga
  const largoGrupo = new Map<string, number>();
  for (const p of POSICIONES_Y) if (p.grupo) largoGrupo.set(p.grupo, Math.max(largoGrupo.get(p.grupo) ?? 0, p.etiqueta.length));
  for (const p of POSICIONES_Y) {
    if (!p.etiqueta || p.forma === "pastilla") continue;
    const m = moduloY(p.modulo), r = radioY(p), largo = p.grupo ? largoGrupo.get(p.grupo)! : p.etiqueta.length;
    const anchoLibre = Math.min(2 * Math.min(p.u - m.rect.u0, m.rect.u1 - p.u) - 0.006, p.colW - 0.012);
    const altoLibre = p.tipo === "slider" ? 0.02 : p.v - r - 0.008 - (m.rect.v0 + 0.003);
    const alto = Math.min(ALTO_Y.etiqueta * e, anchoLibre / (largo * ANCHO_CHAR), altoLibre);
    const v = p.tipo === "slider" ? FADER_Y.v - FADER_Y.rail / 2 - HUELLA.THUMB_D / 2 - 0.003 - alto / 2 : p.v - r - 0.008 - alto / 2;
    add(`e_${p.id}`, p.etiqueta, p.u, v, alto, "centro", m.fila);
  }
  return T;
}
/** Números 0/10 de las perillas, dentro de su huella. */
export function numerosPerillaY(p: PosCtrlY): Texto[] {
  if (p.tipo !== "knob") return [];
  const r = NUM_PERILLA_R * p.escala, h = NUM_PERILLA_ALTO, s = Math.SQRT1_2;
  const mk = (id: string, texto: string, u: number, v: number): Texto => ({ id, texto, u, v, alto: h, ancho: texto.length * ANCHO_CHAR * h, alinear: "centro", fila: "tono" });
  return [mk(`n0_${p.id}`, "0", p.u - s * r, p.v - s * r), mk(`n1_${p.id}`, "10", p.u + s * r, p.v - s * r)];
}
/** Escala 0 / 5 / 10 a la izquierda del fader VOLUMEN. */
export function numerosFaderY(p: PosCtrlY): Texto[] {
  const h = ESCALA_FADER.alto, uDer = p.u - HUELLA.FADER_U - 0.004 - ESCALA_FADER.marcaLarga - 0.003;
  return [0, 5, 10].map(n => { const t = String(n), ancho = t.length * ANCHO_CHAR * h;
    return { id: `nf${n}`, texto: t, u: uDer - ancho / 2, v: FADER_Y.v - FADER_Y.rail / 2 + (n / 10) * FADER_Y.rail, alto: h, ancho, alinear: "centro" as const, fila: "tono" as F }; });
}
export function rectVuY(): Rect { return { u0: VU_Y.u - VU_Y.ancho / 2 - 0.004, u1: VU_Y.u + VU_Y.ancho / 2 + 0.004, v0: VU_Y.v0 - 0.006, v1: VU_Y.v1 + 0.006 }; }

// ── legibilidad y cámara ──
/** Menor fracción de altura entre los textos más lejanos: las dos líneas del display y los títulos de la fila lejana. */
export function legibilidadMinimaY(g: GeoAtril, cam: CamaraPura, escala: number): { min: number; id: string } {
  let min = Infinity, id = "";
  for (const t of textosY(escala)) {
    if (!(t.fila === "display" || t.id === "t_sonidos" || t.id === "t_timbre" || t.id === "t_filtro")) continue;
    const f = fraccionAltura(g, cam, t);
    if (f < min) { min = f; id = t.id; }
  }
  return { min, id };
}
/** Réplica pura de fitLecternCamera para el SY-40: la búsqueda del atril de sonido + legibilidad (3 pasadas). */
export function buscarPoseSinte(g: GeoAtril, aspect: number, escala: number) {
  const leg = (cam: CamaraPura) => legibilidadMinimaY(g, cam, escala).min;
  for (const [pasada, ancho, exigir] of [[1, 1.7, true], [2, 1.3, true], [3, 1.7, false]] as const) {
    const r = buscarPose(g, aspect, { ...BUSQUEDA_SONIDO, anchoMinNdc: ancho, etiquetaK1: true, legible: exigir ? leg : null });
    if (r) { if (!exigir) r.legible = leg(camaraAtril(g, r.fov, r.height, r.dist, r.pitch, aspect)); return { ...r, pasada }; }
  }
  return null;
}
export { LEGIBLE_MIN, escalaEfectiva };

// ── equipo ──
export const NOMBRE_EQUIPO_Y = "SINTETIZADOR SY-40";
export const DESCRIPCION_EQUIPO_Y = "SINTETIZADOR POLIFÓNICO · 5 MÓDULOS";
export const TEXTO_PLACA_Y = (marca: string) => `${NOMBRE_EQUIPO_Y} · ${marca} · ${DESCRIPCION_EQUIPO_Y}`;
export const LEYENDA_FILAS_Y = "1 SONIDOS · 2 TIMBRE · 3 FILTRO Y ENVOLVENTE · 4 MOVIMIENTO · 5 TECLADO Y SALIDA";
/** Pose frente al atril (checkpoint): a distM del atril, del lado de su frente (local +Z). */
export function poseFrenteAtrilSinte(x: number, z: number, yaw: number, distM: number) {
  const d = Math.max(0.3, distM);
  return { x: x + Math.sin(yaw) * d, z: z + Math.cos(yaw) * d, mirarX: x, mirarY: 1.1, mirarZ: z };
}
/**
 * Posición viva del SY-40 (la escribe poseAtrilSinte en lib/instrumentosPose.ts, que solo usa poseInstrumento(−1); la
 * leen el aviso "E" de ThreeScene y la tecla E). Valores iniciales: el lado opuesto al BA-40.
 */
export const ATRIL_SINTE = { x: -1.7, z: 3.6, yaw: Math.atan2(1.7, -3.6), visible: false };
