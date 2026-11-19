// Z97: atril de IMAGEN rediseñado ("IMAGEN IM-40", familia SN-40 / CR-80). Layout como DATOS, lógica PURA (prueba:
// scripts/atril-imagen-test.mjs). Reutiliza de lib/atrilSonido.ts la geometría del atril, la proyección con la cámara real,
// las colisiones, la escala por proporción, la placa de la barra y el margen de rótulos (no se duplica nada).
// Mismas coordenadas: u = derecha, v = hacia el fondo, panel de controles 1,40 × 0,65 m (el mismo mueble).
// De lo más lejano a lo más cercano: display · EFECTOS DEL DOMO (7 pads + AUTO, VELOC., PSICO; "se transmite") ·
// IMAGEN (4 faders; "se transmite") y ESCENA (luces y FOV; "solo para vos", borde punteado).

import {
  ANCHO_CHAR, BANDA_TITULO, ON_DX, RADIO_FALDA, RADIO_MARCAS_OUT, NUM_PERILLA_R, NUM_PERILLA_ALTO, HUELLA, ESCALA_FADER,
  PANEL_U, PANEL_V, MARGEN, GAP, DISPLAY_PAD, DISPLAY_INTERLINEA, MARGEN_ROTULOS, LEGIBLE_MIN, BUSQUEDA_IMAGEN, BUSQUEDA_SONIDO,
  ALTO_TEXTO as ALTO_SONIDO, camaraAtril, fraccionAltura, fraccionAlturaVertical, buscarPose, escalaEfectiva,
  type Rect, type Texto, type GeoAtril, type CamaraPura, type FormaCtrl,
} from "./atrilSonido";

export type FilaI = "display" | "efectos" | "media";
export interface ModuloI { id: string; titulo: string; etiqueta: string; fila: FilaI; rect: Rect; on: string | null; punteado: boolean }
export interface PosCtrlI { id: string; u: number; v: number; forma: FormaCtrl | "pad" | "indicador"; tipo: "button" | "toggle" | "slider" | "knob" | "indicator"; etiqueta: string; nombreLargo: string; modulo: string }

const IZQ = -PANEL_U + MARGEN, DER = PANEL_U - MARGEN;
const V_MAX = PANEL_V - MARGEN, V_MIN = -PANEL_V + MARGEN;
export const FILAS_I: Record<FilaI, { v0: number; v1: number }> = {
  display: { v0: 0.226, v1: V_MAX },
  efectos: { v0: 0.030, v1: 0.211 },
  media:   { v0: V_MIN, v1: 0.015 },
};
const ANCHO_IMAGEN = 0.655;
export const MODULOS_I: ModuloI[] = [
  { id: "display", titulo: "", etiqueta: "", fila: "display", rect: { u0: IZQ, u1: DER, v0: FILAS_I.display.v0, v1: FILAS_I.display.v1 }, on: null, punteado: false },
  { id: "efectos", titulo: "EFECTOS DEL DOMO", etiqueta: "SE TRANSMITE", fila: "efectos", rect: { u0: IZQ, u1: DER, v0: FILAS_I.efectos.v0, v1: FILAS_I.efectos.v1 }, on: "dom_fx_on", punteado: false },
  { id: "imagen", titulo: "IMAGEN", etiqueta: "SE TRANSMITE", fila: "media", rect: { u0: IZQ, u1: IZQ + ANCHO_IMAGEN, v0: FILAS_I.media.v0, v1: FILAS_I.media.v1 }, on: "wcam_on", punteado: false },
  { id: "escena", titulo: "ESCENA", etiqueta: "SOLO PARA VOS", fila: "media", rect: { u0: IZQ + ANCHO_IMAGEN + GAP, u1: DER, v0: FILAS_I.media.v0, v1: FILAS_I.media.v1 }, on: null, punteado: true },
];
export function moduloI(id: string): ModuloI { const m = MODULOS_I.find(x => x.id === id); if (!m) throw new Error(`módulo ${id}`); return m; }
export function posOnI(m: ModuloI): { u: number; v: number } { return { u: m.rect.u1 - ON_DX, v: m.rect.v1 - BANDA_TITULO / 2 }; }

// ── medidas ──
export const PAD = { w: 0.100, d: 0.056, alto: 0.016 };
export const ANCHO_PADS = 1.04;                       // los 7 pads; a la derecha AUTO, VELOC. y PSICO
export const FADER_RAIL_I = 0.20, FADER_V_I = -0.155;
export const FILA_ESCENA = { botones: -0.080, perillas: -0.215 };
export const IND = { w: 0.070, d: 0.030 };             // lectura numérica de la luz (indicador CRT existente)

export const EFECTOS_CORTOS = ["RGB", "PIXEL", "ONDA", "LÍNEAS", "ESPEJO", "ESTIRAR", "POSTER"];
export const EFECTOS_LARGOS = ["SEPARACIÓN RGB", "PIXELADO", "ONDA", "LÍNEAS DE BARRIDO", "ESPEJO", "ESTIRAR", "POSTERIZAR"];

function construir(): PosCtrlI[] {
  const L: PosCtrlI[] = [];
  const ef = moduloI("efectos"), im = moduloI("imagen"), es = moduloI("escena");
  const vE = (ef.rect.v0 + (ef.rect.v1 - BANDA_TITULO)) / 2 + 0.012;
  const slot = ANCHO_PADS / 7;
  for (let i = 0; i < 7; i++) {
    L.push({ id: `dom_fx${i}`, u: ef.rect.u0 + slot * (i + 0.5), v: vE, forma: "pad", tipo: "toggle", etiqueta: EFECTOS_CORTOS[i], nombreLargo: `EFECTO ${EFECTOS_LARGOS[i]}`, modulo: "efectos" });
  }
  const resto0 = ef.rect.u0 + ANCHO_PADS, wr = (ef.rect.u1 - resto0) / 3;
  L.push({ id: "dom_auto", u: resto0 + wr * 0.5, v: vE, forma: "normal", tipo: "toggle", etiqueta: "AUTO", nombreLargo: "ROTACIÓN AUTOMÁTICA", modulo: "efectos" });
  L.push({ id: "dom_rot_s", u: resto0 + wr * 1.5, v: vE, forma: "normal", tipo: "knob", etiqueta: "VELOC.", nombreLargo: "VELOCIDAD DE ROTACIÓN", modulo: "efectos" });
  L.push({ id: "psych", u: resto0 + wr * 2.5, v: vE, forma: "normal", tipo: "toggle", etiqueta: "PSICO", nombreLargo: "PSICODÉLICO", modulo: "efectos" });
  L.push({ id: "dom_fx_on", u: posOnI(ef).u, v: posOnI(ef).v, forma: "pastilla", tipo: "toggle", etiqueta: "ON", nombreLargo: "EFECTOS DEL DOMO", modulo: "efectos" });
  // IMAGEN: 4 faders (mismos ids y rangos de STORE.webcam.*)
  const fad: [string, string, string][] = [["wcam_br", "BRILLO", "BRILLO"], ["wcam_ct", "CONTRASTE", "CONTRASTE"], ["wcam_sa", "SATURAC.", "SATURACIÓN"], ["wcam_zm", "ZOOM", "ZOOM"]];
  const wi = (im.rect.u1 - im.rect.u0) / 4;
  fad.forEach(([id, et, nl], i) => L.push({ id, u: im.rect.u0 + wi * (i + 0.5) + 0.018, v: FADER_V_I, forma: "normal", tipo: "slider", etiqueta: et, nombreLargo: `IMAGEN ${nl}`, modulo: "imagen" }));
  L.push({ id: "wcam_on", u: posOnI(im).u, v: posOnI(im).v, forma: "pastilla", tipo: "toggle", etiqueta: "ON", nombreLargo: "AJUSTES DE IMAGEN", modulo: "imagen" });
  // ESCENA: LUZ −, lectura, LUZ +, LUZ EXTRA; INTENS. y FOV
  const we = (es.rect.u1 - es.rect.u0) / 4;
  L.push({ id: "dom_minus", u: es.rect.u0 + we * 0.5, v: FILA_ESCENA.botones, forma: "normal", tipo: "button", etiqueta: "LUZ -", nombreLargo: "LUZ DE ESCENA −", modulo: "escena" });
  L.push({ id: "lights_ind", u: es.rect.u0 + we * 1.5, v: FILA_ESCENA.botones, forma: "indicador", tipo: "indicator", etiqueta: "NIVEL", nombreLargo: "NIVEL DE LUZ", modulo: "escena" });
  L.push({ id: "dom_plus", u: es.rect.u0 + we * 2.5, v: FILA_ESCENA.botones, forma: "normal", tipo: "button", etiqueta: "LUZ +", nombreLargo: "LUZ DE ESCENA +", modulo: "escena" });
  L.push({ id: "dom_star", u: es.rect.u0 + we * 3.5, v: FILA_ESCENA.botones, forma: "normal", tipo: "button", etiqueta: "EXTRA", nombreLargo: "LUZ EXTRA DE COLOR", modulo: "escena" });
  L.push({ id: "dom_int", u: es.rect.u0 + we * 1.0, v: FILA_ESCENA.perillas, forma: "normal", tipo: "knob", etiqueta: "INTENS.", nombreLargo: "INTENSIDAD DE LUCES", modulo: "escena" });
  L.push({ id: "cam_fov", u: es.rect.u0 + we * 3.0, v: FILA_ESCENA.perillas, forma: "normal", tipo: "knob", etiqueta: "FOV", nombreLargo: "CAMPO DE VISIÓN", modulo: "escena" });
  return L;
}
export const POSICIONES_I: PosCtrlI[] = construir();
export function posI(id: string): PosCtrlI | undefined { return POSICIONES_I.find(p => p.id === id); }

/** Controles del atril anterior que siguen (mismo id) y los que se retiran (su código sigue detrás del flag). */
export const RETIRADOS_I: Record<string, string> = {
  dom_onoff: "ON/OFF de sectores: STORE.dome.sectorEnabled no tiene consumidor en el shader (lo reemplaza el ON de EFECTOS)",
  reactive: "REACTIVO: STORE.dome.reactiveAudio no tiene consumidor (segunda etapa: que la imagen siga la música)",
  dom_nxt: "SIG.EFE.: lo reemplazan los 7 pads (además, la rotación de 5 s lo pisaba enseguida)",
  dom_speed: "VELOC. (0,2…4): STORE.dome.globalSpeed no tiene consumidor; la VELOC. nueva (dom_rot_s) es el intervalo de la rotación",
};
export const NUEVOS_I = ["dom_fx0", "dom_fx1", "dom_fx2", "dom_fx3", "dom_fx4", "dom_fx5", "dom_fx6", "dom_auto", "dom_rot_s", "dom_fx_on", "wcam_on"];

// ── textos ──
export const ALTO_I: Record<FilaI, { titulo: number; etiqueta: number }> = {
  display: ALTO_SONIDO.display,
  efectos: { titulo: 0.0318, etiqueta: 0.019 },
  media:   { titulo: 0.026, etiqueta: 0.017 },
};
export const ALTO_TAG = 0.016;   // "SE TRANSMITE" / "SOLO PARA VOS" junto al título
export const DISPLAY_CHARS_I = [50, 50];
/** Alto de las dos líneas del display, acotado para que entren. */
export function altosDisplayI(escala: number): [number, number] {
  const e = Math.max(0.5, Math.min(2, Number.isFinite(escala) ? escala : 1));
  const d = moduloI("display").rect, b1 = ALTO_I.display.titulo, b2 = ALTO_I.display.etiqueta;
  const porAlto = (d.v1 - d.v0 - 2 * DISPLAY_PAD - DISPLAY_INTERLINEA) / (b1 + b2);
  const porAncho = (d.u1 - d.u0 - 0.024) / (DISPLAY_CHARS_I[0] * ANCHO_CHAR * b1);
  const k = Math.min(e, porAlto, porAncho);
  return [b1 * k, b2 * k];
}
export function radioCtrlI(p: PosCtrlI): number {
  if (p.forma === "pad") return PAD.d / 2;
  if (p.forma === "pastilla") return 0.012;
  if (p.forma === "indicador") return IND.d / 2;
  if (p.tipo === "button") return 0.030;
  if (p.tipo === "toggle") return 0.0225;
  return RADIO_FALDA;
}
export function textosI(escala: number): Texto[] {
  const e = Math.max(0.5, Math.min(2, Number.isFinite(escala) ? escala : 1));
  const T: Texto[] = [];
  const add = (id: string, texto: string, u: number, v: number, alto: number, alinear: "centro" | "izq", fila: FilaI) =>
    T.push({ id, texto, u, v, alto, ancho: texto.length * ANCHO_CHAR * alto, alinear, fila: fila as Texto["fila"] });
  const d = moduloI("display").rect, [h1, h2] = altosDisplayI(e);
  add("d_linea1", "X".repeat(DISPLAY_CHARS_I[0]), d.u0 + 0.012, d.v1 - DISPLAY_PAD - h1 / 2, h1, "izq", "display");
  add("d_linea2", "X".repeat(DISPLAY_CHARS_I[1]), d.u0 + 0.012, d.v1 - DISPLAY_PAD - h1 - DISPLAY_INTERLINEA - h2 / 2, h2, "izq", "display");
  for (const m of MODULOS_I) {
    if (m.fila === "display") continue;
    const libre = m.rect.u1 - m.rect.u0 - 0.024 - (m.on ? ON_DX + 0.034 : 0);
    const tit = `${m.titulo}`, tag = `· ${m.etiqueta}`;
    const alto = Math.min(ALTO_I[m.fila].titulo * e, BANDA_TITULO - 0.012, (libre * 0.65) / (tit.length * ANCHO_CHAR));
    const vb = m.rect.v1 - BANDA_TITULO / 2;
    add(`t_${m.id}`, tit, m.rect.u0 + 0.012, vb, alto, "izq", m.fila);
    const u1 = m.rect.u0 + 0.012 + tit.length * ANCHO_CHAR * alto + 0.012;
    const altoTag = Math.min(ALTO_TAG * e, alto, (m.rect.u0 + 0.012 + libre - u1) / (tag.length * ANCHO_CHAR));
    add(`g_${m.id}`, tag, u1, vb - (alto - altoTag) / 2 + 0.0005, altoTag, "izq", m.fila);
  }
  for (const p of POSICIONES_I) {
    if (p.forma === "pastilla") continue;
    const m = moduloI(p.modulo), a = ALTO_I[m.fila];
    const r = radioCtrlI(p);
    const colW = p.forma === "pad" ? ANCHO_PADS / 7 : p.tipo === "slider" ? (m.rect.u1 - m.rect.u0) / 4 : 0.16;
    const anchoLibre = Math.min(2 * Math.min(p.u - m.rect.u0, m.rect.u1 - p.u) - 0.006, colW - 0.012);
    const altoLibre = p.tipo === "slider" ? 0.02 : p.v - r - 0.008 - (m.rect.v0 + 0.003);
    const alto = Math.min(a.etiqueta * e, anchoLibre / (p.etiqueta.length * ANCHO_CHAR), altoLibre);
    const v = p.tipo === "slider" ? FADER_V_I - FADER_RAIL_I / 2 - HUELLA.THUMB_D / 2 - 0.003 - alto / 2 : p.v - r - 0.008 - alto / 2;
    add(`e_${p.id}`, p.etiqueta, p.u, v, alto, "centro", m.fila);
  }
  return T;
}
/** Huella de cada control (cuerpo + escala impresa). */
export function huellaI(p: PosCtrlI): Rect {
  let hu: number, hv: number;
  if (p.forma === "pad") { hu = PAD.w / 2; hv = PAD.d / 2 + 0.006; }                 // + LED del lado lejano
  else if (p.forma === "pastilla") { hu = HUELLA.PASTILLA_U; hv = HUELLA.PASTILLA_V; }
  else if (p.forma === "indicador") { hu = IND.w / 2; hv = IND.d / 2; }
  else if (p.tipo === "slider") { hu = HUELLA.FADER_U; hv = FADER_RAIL_I / 2 + HUELLA.THUMB_D / 2; }
  else if (p.tipo === "button") { hu = HUELLA.BOTON; hv = HUELLA.BOTON; }
  else if (p.tipo === "toggle") { hu = HUELLA.ROCKER_U; hv = HUELLA.ROCKER_V + 0.008; }
  else { const r = RADIO_MARCAS_OUT; return { u0: p.u - r * 0.988, u1: p.u + r * 0.988, v0: p.v - Math.max(RADIO_FALDA, r * 0.7072), v1: p.v + r }; }
  return { u0: p.u - hu, u1: p.u + hu, v0: p.v - hv, v1: p.v + hv };
}
/** Números 0/10 de las perillas (FOV: MIN/MAX), dentro de la huella como en el atril de sonido. */
export function numerosPerillaI(p: PosCtrlI): Texto[] {
  const r = NUM_PERILLA_R, h = NUM_PERILLA_ALTO, s = Math.SQRT1_2;
  const [a, b] = p.id === "cam_fov" ? ["MIN", "MAX"] : ["0", "10"];
  const mk = (id: string, texto: string, u: number, v: number): Texto => ({ id, texto, u, v, alto: h, ancho: texto.length * ANCHO_CHAR * h, alinear: "centro", fila: moduloI(p.modulo).fila as Texto["fila"] });
  return [mk(`n0_${p.id}`, a, p.u - s * r, p.v - s * r), mk(`n1_${p.id}`, b, p.u + s * r, p.v - s * r)];
}
/** Escala 0, 5, 10 a la izquierda de cada fader de IMAGEN. */
export function numerosFaderI(p: PosCtrlI): Texto[] {
  const h = ESCALA_FADER.alto, uDer = p.u - HUELLA.FADER_U - 0.004 - ESCALA_FADER.marcaLarga - 0.003;
  return [0, 5, 10].map(n => { const t = String(n), ancho = t.length * ANCHO_CHAR * h;
    return { id: `nf${n}_${p.id}`, texto: t, u: uDer - ancho / 2, v: FADER_V_I - FADER_RAIL_I / 2 + (n / 10) * FADER_RAIL_I, alto: h, ancho, alinear: "centro" as const, fila: "media" as Texto["fila"] }; });
}
export function marcasFaderI(p: PosCtrlI): Rect {
  return { u0: p.u - HUELLA.FADER_U - 0.004 - ESCALA_FADER.marcaLarga, u1: p.u - HUELLA.FADER_U - 0.004, v0: FADER_V_I - FADER_RAIL_I / 2 - 0.002, v1: FADER_V_I + FADER_RAIL_I / 2 + 0.002 };
}

// ── legibilidad y cámara (rama de imagen de fitLecternCamera) ──
export function legibilidadMinimaI(g: GeoAtril, cam: CamaraPura, escala: number): { min: number; id: string } {
  let min = Infinity, id = "";
  for (const t of textosI(escala)) {
    if (!(t.fila === "display" || (t.fila === "efectos" && t.id.startsWith("t_")))) continue;
    const f = fraccionAltura(g, cam, t);
    if (f < min) { min = f; id = t.id; }
  }
  return { min, id };
}
/** Réplica pura de la rama de imagen de fitLecternCamera (+ la exigencia de legibilidad si exigir). */
export function buscarPoseImagen(g: GeoAtril, aspect: number, exigir: boolean, escala: number) {
  const r = buscarPose(g, aspect, { ...BUSQUEDA_IMAGEN, anchoMinNdc: null, etiquetaK1: false,
    legible: exigir ? (cam => legibilidadMinimaI(g, cam, escala).min) : null });
  if (r && !exigir) r.legible = legibilidadMinimaI(g, camaraAtril(g, r.fov, r.height, r.dist, r.pitch, aspect), escala).min;
  return r;
}
/**
 * Réplica pura de fitLecternCamera con CAMARA "panel" (default de Z97): la búsqueda del atril de sonido (fovs 60–90,
 * altura ≥ 0,70, pitch −60…−25, ancho del panel ≥ 85 % y etiqueta K1) exigiendo legibilidadMinimaI ≥ LEGIBLE_MIN;
 * pasada 2 relaja el ancho a 65 %; pasada 3 sin exigir. Devuelve la pose y la pasada que la dio.
 */
export function buscarPoseImagenPanel(g: GeoAtril, aspect: number, escala: number) {
  const leg = (cam: CamaraPura) => legibilidadMinimaI(g, cam, escala).min;
  for (const [pasada, ancho, exigir] of [[1, 1.7, true], [2, 1.3, true], [3, 1.7, false]] as const) {
    const r = buscarPose(g, aspect, { ...BUSQUEDA_SONIDO, anchoMinNdc: ancho, etiquetaK1: true, legible: exigir ? leg : null });
    if (r) { if (!exigir) r.legible = leg(camaraAtril(g, r.fov, r.height, r.dist, r.pitch, aspect)); return { ...r, pasada }; }
  }
  return null;
}
export { LEGIBLE_MIN, escalaEfectiva };

// ── rótulos de fila: "DOMO" (lejana) e "IMAGEN" (media), verticales en el margen izquierdo ──
export const ROTULOS_I = [{ id: "r_domo", texto: "DOMO", fila: "efectos" as const }, { id: "r_imagen", texto: "IMAGEN", fila: "media" as const }];
export function rotulosFilaI(): { id: string; texto: string; u: number; v: number; alto: number; largo: number; v0: number; v1: number }[] {
  const w = MARGEN_ROTULOS.u1 - MARGEN_ROTULOS.u0, u = (MARGEN_ROTULOS.u0 + MARGEN_ROTULOS.u1) / 2;
  return ROTULOS_I.map(r => {
    const f = FILAS_I[r.fila], alto = Math.min(w - 0.008, (f.v1 - f.v0 - 0.012) / (r.texto.length * ANCHO_CHAR));
    const largo = r.texto.length * ANCHO_CHAR * alto, v = (f.v0 + f.v1) / 2;
    return { id: r.id, texto: r.texto, u, v, alto, largo, v0: v - largo / 2, v1: v + largo / 2 };
  });
}
export function fraccionRotuloI(g: GeoAtril, cam: CamaraPura, r: { u: number; v: number; alto: number }): number { return fraccionAlturaVertical(g, cam, r); }
export const LEYENDA_FILAS_I = "1 DOMO · 2 IMAGEN";
export function numerosFilaMargenI() {
  const w = MARGEN_ROTULOS.u1 - MARGEN_ROTULOS.u0, u = (MARGEN_ROTULOS.u0 + MARGEN_ROTULOS.u1) / 2, h = w - 0.008;
  return ROTULOS_I.map((r, i) => ({ id: `nfila_${i + 1}`, texto: String(i + 1), u, v: (FILAS_I[r.fila].v0 + FILAS_I[r.fila].v1) / 2, alto: h }));
}

// ── equipo ──
export const NOMBRE_EQUIPO_I = "IMAGEN IM-40";
export const DESCRIPCION_EQUIPO_I = "PROCESADOR DE IMAGEN · 3 MÓDULOS";
export const TEXTO_PLACA_I = (marca: string) => `${NOMBRE_EQUIPO_I} · ${marca} · ${DESCRIPCION_EQUIPO_I}`;
/** Pose frente al atril de imagen (en x = −placeX): a distM, del lado del centro de la tarima. */
export function poseFrenteAtrilImagen(placeX: number, distM: number) {
  const x = -Math.abs(placeX) + Math.max(0.3, distM);
  return { x, z: 0, mirarX: -Math.abs(placeX), mirarY: 1.1, mirarZ: 0 };
}
