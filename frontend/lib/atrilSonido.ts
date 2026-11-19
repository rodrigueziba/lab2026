// Z96: atril de SONIDO rediseñado ("SONIDO SN-40", misma familia que la CR-80). Layout como DATOS, lógica PURA y SIN
// imports (prueba: scripts/atril-sonido-test.mjs). Lo dibuja components/LecternSystem.tsx con DBG_ATRIL_SONIDO.DISENO_NUEVO.
//
// Coordenadas del panel de controles (las mismas de CtrlDef en LecternSystem): u = derecha (m), v = hacia el FONDO (m;
// en la malla z = −v), origen en el centro del panel oscuro (CPANEL 1,40 × 0,65 m, el mismo tamaño que hoy: el mueble no
// cambia). De lo más lejano a lo más cercano: display · EFECTOS DE MOVIMIENTO · TONO · TRANSPORTE y LOOP A-B; columna
// SALIDA a la derecha en toda la profundidad.
// Cada módulo reserva una BANDA DE TÍTULO del lado lejano (título a la izquierda, ON en pastilla a la derecha); los
// controles van debajo y sus etiquetas debajo de cada control (hacia el jugador). Nada cruza el marco.
// Legibilidad: textos más lejanos más grandes (escala por fila × ETIQUETA_ESCALA); la cámara del modo atril
// (fitLecternCamera) exige que el texto más lejano mida ≥ LEGIBLE_MIN de la altura de la pantalla (proyección real sobre la
// placa inclinada, no solo distancia).

export type TipoCtrl = "button" | "toggle" | "slider" | "knob";
export type FormaCtrl = "normal" | "grande" | "pastilla" | "play" | "pad" | "indicador";   // Z97: pad (atril de imagen) e indicador
export interface PosCtrl { id: string; u: number; v: number; forma: FormaCtrl; etiqueta: string; nombreLargo: string; modulo: string }
export interface Rect { u0: number; u1: number; v0: number; v1: number }   // v1 = borde lejano
export interface Modulo { id: string; titulo: string; fila: Fila; rect: Rect; on: string | null }
export type Fila = "display" | "efectos" | "tono" | "transporte" | "salida";

// ── medidas del panel (iguales a las de hoy) ──
export const PANEL_U = 0.70, PANEL_V = 0.325;            // medio ancho / media profundidad del panel oscuro
export const MARGEN = 0.015;                             // margen al marco
export const BANDA_TITULO = 0.045;                       // banda de título de cada módulo (lado lejano)
export const BANDA_TITULO_TRANSPORTE = 0.038;
export const GAP = 0.015;

const IZQ = -PANEL_U + MARGEN, DER_AREA = 0.505;        // zona de módulos (sin la columna SALIDA)
const SALIDA_U0 = 0.525, SALIDA_U1 = PANEL_U - MARGEN;
const V_MAX = PANEL_V - MARGEN, V_MIN = -PANEL_V + MARGEN;

// filas (v0 cercano, v1 lejano)
export const FILAS: Record<Exclude<Fila, "salida">, { v0: number; v1: number }> = {
  display:    { v0: 0.226, v1: V_MAX },                  // 0,084 de profundidad
  efectos:    { v0: 0.030, v1: 0.211 },
  tono:       { v0: -0.170, v1: 0.015 },
  transporte: { v0: V_MIN, v1: -0.185 },
};

// módulos: anchos repartidos en la zona izquierda (1,19 m)
function fila(f: Exclude<Fila, "salida">, partes: [string, string, number, string | null][]): Modulo[] {
  const total = DER_AREA - IZQ - GAP * (partes.length - 1);
  const suma = partes.reduce((a, p) => a + p[2], 0);
  let u = IZQ;
  return partes.map(([id, titulo, peso, on]) => {
    const w = (total * peso) / suma;
    const m: Modulo = { id, titulo, fila: f, rect: { u0: u, u1: u + w, v0: FILAS[f].v0, v1: FILAS[f].v1 }, on };
    u += w + GAP;
    return m;
  });
}
export const MODULOS: Modulo[] = [
  { id: "display", titulo: "", fila: "display", rect: { u0: IZQ, u1: DER_AREA, v0: FILAS.display.v0, v1: FILAS.display.v1 }, on: null },
  ...fila("efectos", [["lfo", "LFO", 4, null], ["phaser", "PHASER", 3, "s_phs_on"], ["pitch", "PITCH", 2, "s_pit_on"], ["espacio", "ESPACIO", 2, null]]),
  ...fila("tono", [["pasabajos", "FILTRO PASA-BAJOS", 1, "s_lp_on"], ["pasaaltos", "FILTRO PASA-ALTOS", 1, "s_hp_on"], ["distorsion", "DISTORSIÓN", 1.05, "s_dist_on"]]),
  ...fila("transporte", [["transporte", "TRANSPORTE", 1.06, null], ["loop", "LOOP A-B", 1, null]]),
  { id: "salida", titulo: "SALIDA", fila: "salida", rect: { u0: SALIDA_U0, u1: SALIDA_U1, v0: V_MIN, v1: V_MAX }, on: null },
];
export function modulo(id: string): Modulo { const m = MODULOS.find(x => x.id === id); if (!m) throw new Error(`módulo ${id}`); return m; }

/** Centro de la zona de controles de un módulo (debajo de la banda de título). */
function vControles(m: Modulo): number {
  const banda = m.fila === "transporte" ? BANDA_TITULO_TRANSPORTE : BANDA_TITULO;
  return (m.rect.v0 + (m.rect.v1 - banda)) / 2 + 0.012;   // un poco hacia el fondo: la etiqueta va abajo
}
/** u de la columna i de n en el módulo (repartidas). */
function uCol(m: Modulo, i: number, n: number): number {
  const w = m.rect.u1 - m.rect.u0;
  return m.rect.u0 + (w * (i + 0.5)) / n;
}
/** Posición del ON (pastilla) de un módulo: arriba a la derecha, centrada en la banda de título. */
export const ON_DX = 0.040;   // desde el borde derecho del módulo al centro de la pastilla
export function posOn(m: Modulo): { u: number; v: number } {
  return { u: m.rect.u1 - ON_DX, v: m.rect.v1 - BANDA_TITULO / 2 };
}

// ── controles: MISMOS ids que hoy (mismo parámetro o acción) ──
function ctl(id: string, mod: string, u: number, v: number, forma: FormaCtrl, etiqueta: string, nombreLargo: string): PosCtrl {
  return { id, u, v, forma, etiqueta, nombreLargo, modulo: mod };
}
function construir(): PosCtrl[] {
  const L: PosCtrl[] = [];
  const lfo = modulo("lfo"), phs = modulo("phaser"), pit = modulo("pitch"), esp = modulo("espacio");
  const lp = modulo("pasabajos"), hp = modulo("pasaaltos"), dis = modulo("distorsion");
  const tr = modulo("transporte"), lo = modulo("loop"), sa = modulo("salida");
  // EFECTOS DE MOVIMIENTO
  const vE = vControles(lfo);
  L.push(ctl("s_lfo_wf", "lfo", uCol(lfo, 0, 4), vE, "normal", "ONDA", "LFO ONDA"));
  L.push(ctl("s_lfo_tg", "lfo", uCol(lfo, 1, 4), vE, "normal", "DESTINO", "LFO DESTINO"));
  L.push(ctl("s_lfo_sp", "lfo", uCol(lfo, 2, 4), vE, "normal", "FREC.", "LFO FRECUENCIA"));
  L.push(ctl("s_lfo_dp", "lfo", uCol(lfo, 3, 4), vE, "normal", "PROF.", "LFO PROFUNDIDAD"));
  L.push(ctl("s_phs_on", "phaser", posOn(phs).u, posOn(phs).v, "pastilla", "ON", "PHASER"));
  L.push(ctl("s_phs_sp", "phaser", uCol(phs, 0, 3), vE, "normal", "FREC.", "PHASER FRECUENCIA"));
  L.push(ctl("s_phs_dp", "phaser", uCol(phs, 1, 3), vE, "normal", "PROF.", "PHASER PROFUNDIDAD"));
  L.push(ctl("s_phs_fb", "phaser", uCol(phs, 2, 3), vE, "normal", "FEEDBACK", "PHASER FEEDBACK"));
  L.push(ctl("s_pit_on", "pitch", posOn(pit).u, posOn(pit).v, "pastilla", "ON", "PITCH"));
  L.push(ctl("s_pit_st", "pitch", uCol(pit, 0, 2), vE, "normal", "SEMIT.", "PITCH SEMITONOS"));
  L.push(ctl("s_pit_mx", "pitch", uCol(pit, 1, 2), vE, "normal", "MEZCLA", "PITCH MEZCLA"));
  L.push(ctl("s_dlyA", "espacio", uCol(esp, 0, 2), vE, "normal", "ECO", "ECO"));
  L.push(ctl("s_rev", "espacio", uCol(esp, 1, 2), vE, "normal", "REVERB", "REVERB"));
  // TONO
  const vT = vControles(lp);
  L.push(ctl("s_lp_on", "pasabajos", posOn(lp).u, posOn(lp).v, "pastilla", "ON", "FILTRO PASA-BAJOS"));
  L.push(ctl("s_lp_fr", "pasabajos", uCol(lp, 0, 1), vT, "grande", "CORTE", "CORTE PASA-BAJOS"));
  L.push(ctl("s_hp_on", "pasaaltos", posOn(hp).u, posOn(hp).v, "pastilla", "ON", "FILTRO PASA-ALTOS"));
  L.push(ctl("s_hp_fr", "pasaaltos", uCol(hp, 0, 1), vT, "grande", "CORTE", "CORTE PASA-ALTOS"));
  L.push(ctl("s_dist_on", "distorsion", posOn(dis).u, posOn(dis).v, "pastilla", "ON", "DISTORSIÓN"));
  L.push(ctl("s_drive", "distorsion", uCol(dis, 0, 2), vT, "normal", "DRIVE", "DISTORSIÓN DRIVE"));
  L.push(ctl("s_dist_mx", "distorsion", uCol(dis, 1, 2), vT, "normal", "MEZCLA", "DISTORSIÓN MEZCLA"));
  // TRANSPORTE (PLAY grande a la izquierda, ANT. y SIG. a su derecha) y LOOP A-B
  const vR = vControles(tr);
  const pw = PLAY_W;
  L.push(ctl("s_play", "transporte", tr.rect.u0 + 0.012 + pw / 2, vR - 0.006, "play", "PLAY/PAUSA", "PLAY / PAUSA"));
  const uResto0 = tr.rect.u0 + 0.012 + pw + 0.01;
  const wResto = tr.rect.u1 - uResto0;
  L.push(ctl("s_prev", "transporte", uResto0 + wResto * 0.25, vR, "normal", "ANT.", "PISTA ANTERIOR"));
  L.push(ctl("s_next", "transporte", uResto0 + wResto * 0.75, vR, "normal", "SIG.", "PISTA SIGUIENTE"));
  L.push(ctl("s_sam_in", "loop", uCol(lo, 0, 4), vR, "normal", "INICIO", "LOOP INICIO"));
  L.push(ctl("s_sam_out", "loop", uCol(lo, 1, 4), vR, "normal", "FIN", "LOOP FIN"));
  L.push(ctl("s_sam_lp", "loop", uCol(lo, 2, 4), vR, "normal", "LOOP", "LOOP A-B"));
  L.push(ctl("s_sam_cl", "loop", uCol(lo, 3, 4), vR, "normal", "BORRAR", "LOOP BORRAR"));
  // SALIDA: fader vertical + VU al lado
  L.push(ctl("s_vol", "salida", sa.rect.u0 + FADER_DU, FADER_V, "normal", "VOLUMEN", "VOLUMEN"));   // Z96b: lugar para la escala 0…10
  return L;
}

// ── tamaños ──
export const PLAY_W = 0.32, PLAY_D = 0.082;                // 23 % del ancho del panel (PLAY_ESCALA 1)
export const PLAY_VIEJO = { w: 0.060, d: 0.060 };          // tecla s_play anterior (BTN_W)
export const PLAY_GRANDE_Z79 = { w: 0.16, d: 0.045 };      // botón grande de Z79 (PlayTarima.tsx, BOTON_ESCALA 1)
export const GRANDE_ESCALA = 1.25;                         // perillas CORTE (pasa-bajos y pasa-altos)
export const HUELLA_FADER_ABAJO = 0.020;                   // medio grosor del pomo del fader (THUMB_D / 2)
export const RADIO_FALDA = 0.044;                          // = KNOB_SKIRT_R de LecternSystem
export const RADIO_MARCAS_IN = 0.046, RADIO_MARCAS_OUT = 0.051;   // escala serigrafiada de las perillas (× GRANDE_ESCALA)
export const FADER_RAIL = 0.40, FADER_V = -0.035;           // fader VOLUMEN (de −0,235 a +0,165)
export const FADER_DU = 0.071;                              // Z96b: fader a 7,1 cm del borde izquierdo de SALIDA (antes 4,5): lugar para 0…10
export const ESCALA_FADER = { alto: 0.012, marcaLarga: 0.012, marcaCorta: 0.007 };   // Z96b: números 0, 5, 10 a la izquierda
export const VU = { segmentos: 14, u: 0, v0: -0.215, v1: 0.165, ancho: 0.026 };
VU.u = SALIDA_U1 - 0.035;

export const POSICIONES: PosCtrl[] = construir();
export function pos(id: string): PosCtrl | undefined { return POSICIONES.find(p => p.id === id); }

// ── textos (alto base en m, antes de ETIQUETA_ESCALA): más grandes cuanto más lejos ──
export const ALTO_TEXTO: Record<Exclude<Fila, "salida">, { titulo: number; etiqueta: number }> = {
  display:    { titulo: 0.0328, etiqueta: 0.0318 },          // línea 1 (pista y tiempo) / línea 2 (estado y loop)
  efectos:    { titulo: 0.0318, etiqueta: 0.019 },
  tono:       { titulo: 0.023, etiqueta: 0.017 },
  transporte: { titulo: 0.019, etiqueta: 0.015 },
};
export const ALTO_SALIDA = { titulo: 0.0318, etiqueta: 0.015 };   // Z96b: título como los de su fila (efectos)
export const DISPLAY_PAD = 0.006, DISPLAY_INTERLINEA = 0.005, DISPLAY_CHARS_1 = 50, DISPLAY_CHARS_2 = 44;
/** Alto de las dos líneas del display con la escala, acotado para que siempre entren (alto y ancho) en el display. */
export function altosDisplay(escala: number): [number, number] {
  const e = Math.max(0.5, Math.min(2, Number.isFinite(escala) ? escala : 1));
  const d = MODULOS.length ? modulo("display").rect : { u0: 0, u1: 1, v0: 0, v1: 1 };
  const b1 = ALTO_TEXTO.display.titulo, b2 = ALTO_TEXTO.display.etiqueta;
  const porAlto = (d.v1 - d.v0 - 2 * DISPLAY_PAD - DISPLAY_INTERLINEA) / (b1 + b2);
  const porAncho = (d.u1 - d.u0 - 0.024) / Math.max(DISPLAY_CHARS_1 * ANCHO_CHAR * b1, DISPLAY_CHARS_2 * ANCHO_CHAR * b2);
  const k = Math.min(e, porAlto, porAncho);
  return [b1 * k, b2 * k];
}
export const ANCHO_CHAR = 0.62;    // ancho de un carácter monoespaciado / alto

/** Texto que se dibuja en la serigrafía: centro (u, v), alto y ancho en m. */
export interface Texto { id: string; texto: string; u: number; v: number; alto: number; ancho: number; alinear: "centro" | "izq"; fila: Fila }
export function textos(escala: number): Texto[] {
  const e = Math.max(0.5, Math.min(2, Number.isFinite(escala) ? escala : 1));
  const T: Texto[] = [];
  const add = (id: string, texto: string, u: number, v: number, alto: number, alinear: "centro" | "izq", f: Fila) =>
    T.push({ id, texto, u, v, alto, ancho: texto.length * ANCHO_CHAR * alto, alinear, fila: f });
  // display: dos líneas (las dibuja el display; acá están para la legibilidad y el encuadre). Ancho = máximo de caracteres.
  const d = modulo("display").rect;
  const [h1, h2] = altosDisplay(escala), pad = DISPLAY_PAD;
  add("d_linea1", "X".repeat(DISPLAY_CHARS_1), d.u0 + 0.012, d.v1 - pad - h1 / 2, h1, "izq", "display");
  add("d_linea2", "X".repeat(DISPLAY_CHARS_2), d.u0 + 0.012, d.v1 - pad - h1 - DISPLAY_INTERLINEA - h2 / 2, h2, "izq", "display");
  for (const m of MODULOS) {
    if (m.fila === "display") continue;
    const a = m.fila === "salida" ? ALTO_SALIDA : ALTO_TEXTO[m.fila];
    const banda = m.fila === "transporte" ? BANDA_TITULO_TRANSPORTE : BANDA_TITULO;
    // acotado a la banda (alto) y al ancho libre (menos la pastilla ON si la hay)
    const libre = m.rect.u1 - m.rect.u0 - 0.024 - (m.on ? ON_DX + 0.034 : 0);
    const alto = Math.min(a.titulo * e, banda - 0.012, libre / (m.titulo.length * ANCHO_CHAR));
    add(`t_${m.id}`, m.titulo, m.rect.u0 + 0.012, m.rect.v1 - banda / 2, alto, "izq", m.fila);
  }
  for (const p of POSICIONES) {
    if (p.forma === "pastilla" || p.forma === "play") continue;   // la pastilla y el PLAY llevan su texto encima
    const m = modulo(p.modulo);
    const a = m.fila === "salida" ? ALTO_SALIDA : ALTO_TEXTO[m.fila as Exclude<Fila, "salida">];
    const r = radioCtrl(p);
    // acotado: entra a lo ancho dentro del módulo y no baja del borde del módulo
    const anchoLibre = 2 * Math.min(p.u - m.rect.u0, m.rect.u1 - p.u) - 0.006;
    const altoLibre = p.id === "s_vol" ? 0.02 : p.v - r - 0.008 - (m.rect.v0 + 0.003);
    const alto = Math.min(a.etiqueta * e, anchoLibre / (p.etiqueta.length * ANCHO_CHAR), altoLibre);
    const v = p.id === "s_vol" ? FADER_V - FADER_RAIL / 2 - HUELLA_FADER_ABAJO - 0.003 - alto / 2 : p.v - r - 0.008 - alto / 2;   // Z96b: pegada al fader
    add(`e_${p.id}`, p.etiqueta, p.u, v, alto, "centro", m.fila);
  }
  return T;
}
/** Medio tamaño (en v) de cada control para ubicar su etiqueta debajo. */
export function radioCtrl(p: PosCtrl): number {
  if (p.forma === "grande") return RADIO_FALDA * GRANDE_ESCALA;
  if (p.forma === "play") return PLAY_D / 2;
  if (p.forma === "pastilla") return 0.012;
  return p.id.startsWith("s_lfo_wf") || p.id.startsWith("s_lfo_tg") || p.id === "s_prev" || p.id === "s_next" || p.id.startsWith("s_sam") ? 0.030 : 0.044;
}
/** Rectángulo que ocupa un texto. */
export function rectTexto(t: Texto): Rect {
  const u0 = t.alinear === "izq" ? t.u : t.u - t.ancho / 2;
  return { u0, u1: u0 + t.ancho, v0: t.v - t.alto / 2, v1: t.v + t.alto / 2 };
}
export function dentro(a: Rect, b: Rect, tol = 1e-9): boolean {
  return a.u0 >= b.u0 - tol && a.u1 <= b.u1 + tol && a.v0 >= b.v0 - tol && a.v1 <= b.v1 + tol;
}
export function seSuperponen(a: Rect, b: Rect): boolean {
  return a.u0 < b.u1 && a.u1 > b.u0 && a.v0 < b.v1 && a.v1 > b.v0;
}
export const PANEL: Rect = { u0: -PANEL_U, u1: PANEL_U, v0: -PANEL_V, v1: PANEL_V };

// ── cámara del modo atril (réplica pura de fitLecternCamera, rama de sonido) y proyección del texto ──
export interface GeoAtril { LEG_H: number; PANEL_W: number; PANEL_D: number; PANEL_T: number; CPANEL_T: number; TILT_RAD: number; LBL_H: number; ROW1_V_A: number }
export const GEO_DEFECTO: GeoAtril = { LEG_H: 0.95 - 0.267, PANEL_W: 1.5, PANEL_D: 0.75, PANEL_T: 0.06, CPANEL_T: 0.003, TILT_RAD: (20 * Math.PI) / 180, LBL_H: 0.014, ROW1_V_A: -0.27 };
type V3 = [number, number, number];
/** Punto del panel (u, alto sobre la superficie, v) → coordenadas locales del atril (+Z = hacia el jugador). */
export function aLocal(g: GeoAtril, u: number, y: number, v: number, out: V3 = [0, 0, 0]): V3 {
  // T(0, PANEL_T+CPANEL_T, −PANEL_D/2) → Rx(TILT) → T(0, LEG_H, PANEL_D/2); z del panel = −v
  const py = y + g.PANEL_T + g.CPANEL_T, pz = -v - g.PANEL_D / 2;
  const c = Math.cos(g.TILT_RAD), s = Math.sin(g.TILT_RAD);
  out[0] = u; out[1] = py * c - pz * s + g.LEG_H; out[2] = py * s + pz * c + g.PANEL_D / 2;
  return out;
}
export interface CamaraPura { pos: V3; f: V3; r: V3; up: V3; tanV: number; aspect: number }
const norm3 = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** Pose de _makePose: a dist hacia el jugador y height arriba del centro del panel, mirando con pitch. fov vertical. */
export function camaraAtril(g: GeoAtril, fovDeg: number, height: number, dist: number, pitchDeg: number, aspect: number): CamaraPura {
  const c = aLocal(g, 0, 0, 0);
  const pos: V3 = [c[0], c[1] + height, c[2] + dist];
  const look: V3 = [c[0], c[1] + height + dist * Math.tan((pitchDeg * Math.PI) / 180), c[2]];
  const f = norm3([look[0] - pos[0], look[1] - pos[1], look[2] - pos[2]]);
  const r = norm3(cross(f, [0, 1, 0]));
  const up = cross(r, f);
  return { pos, f, r, up, tanV: Math.tan((fovDeg * Math.PI) / 360), aspect };
}
/** NDC de un punto local (x, y) y profundidad (z > 0 = adelante). */
export function ndc(cam: CamaraPura, p: V3): { x: number; y: number; z: number } {
  const d: V3 = [p[0] - cam.pos[0], p[1] - cam.pos[1], p[2] - cam.pos[2]];
  const zc = d[0] * cam.f[0] + d[1] * cam.f[1] + d[2] * cam.f[2];
  const xc = d[0] * cam.r[0] + d[1] * cam.r[1] + d[2] * cam.r[2];
  const yc = d[0] * cam.up[0] + d[1] * cam.up[1] + d[2] * cam.up[2];
  return { x: xc / (zc * cam.tanV * cam.aspect), y: yc / (zc * cam.tanV), z: zc };
}
/** Fracción de la ALTURA de la pantalla que ocupa un texto plano sobre el panel (alto medido en v, hacia el fondo). */
export function fraccionAltura(g: GeoAtril, cam: CamaraPura, t: { u: number; v: number; alto: number }): number {
  const a = ndc(cam, aLocal(g, t.u, 0.001, t.v + t.alto / 2)), b = ndc(cam, aLocal(g, t.u, 0.001, t.v - t.alto / 2));
  if (a.z <= 0.01 || b.z <= 0.01) return 0;
  return Math.abs(a.y - b.y) / 2;
}
export const LEGIBLE_MIN = 0.025;
/** El texto más lejano (mayor v) del layout y su fracción de altura con esa cámara. */
export function textoMasLejano(escala: number): Texto {
  const T = textos(escala);
  return T.reduce((a, b) => (b.v + b.alto / 2 > a.v + a.alto / 2 ? b : a));
}
/**
 * Menor fracción de altura entre los textos MÁS LEJANOS: las dos líneas del display (lo más al fondo) y los títulos de la
 * fila de efectos (y el texto más lejano de todos, por las dudas). Las etiquetas de los controles de efectos son las más
 * grandes de su tipo, pero su ancho por perilla (~10 cm) no deja llegar a 2,5 %: se informan aparte (etiquetasEfectos).
 */
export function legibilidadMinima(g: GeoAtril, cam: CamaraPura, escala: number): { min: number; id: string } {
  const T = textos(escala).filter(t => t.fila === "display" || (t.fila === "efectos" && t.id.startsWith("t_")));
  let min = Infinity, id = "";
  for (const t of T) { const f = fraccionAltura(g, cam, t); if (f < min) { min = f; id = t.id; } }
  const lej = textoMasLejano(escala), fl = fraccionAltura(g, cam, lej);
  if (fl < min) { min = fl; id = lej.id; }
  return { min, id };
}

/** Z97: opciones de la búsqueda (las dos ramas de fitLecternCamera). */
export interface OpcionesBusqueda {
  fovs: number[]; hMin: number; pMin: number; pMax: number;
  anchoMinNdc: number | null;          // sonido: ancho mínimo del panel en NDC (null = sin la restricción: imagen)
  etiquetaK1: boolean;                 // sonido: la etiqueta de K1 ≥ 12 px
  legible: ((cam: CamaraPura) => number) | null;   // exigencia de legibilidad (null = sin exigir)
}
export const BUSQUEDA_SONIDO = { fovs: [60, 65, 70, 75, 80, 85, 90], hMin: 0.70, pMin: -60, pMax: -25 };
export const BUSQUEDA_IMAGEN = { fovs: [75, 80, 85, 90], hMin: 0.80, pMin: -35, pMax: -10 };
/** Réplica pura de la búsqueda de fitLecternCamera (mismas restricciones y orden). legible = fracción del texto lejano. */
export function buscarPose(g: GeoAtril, aspect: number, o: OpcionesBusqueda):
  { fov: number; height: number; dist: number; pitch: number; legible: number } | null {
  const hw = g.PANEL_W / 2, hd = g.PANEL_D / 2;
  const esq = [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]].map(([x, z]) => aLocal(g, x, 0, -z));
  const plateCtr = aLocal(g, 0, 0, 0);
  const lab = aLocal(g, 0, g.LBL_H / 2, -g.ROW1_V_A);   // farLabelWorld de K1: (0, LBL_H/2, ROW1_V_A) en el panel (z = ROW1_V_A)
  for (const fov of o.fovs) {
    let mejor: { fov: number; height: number; dist: number; pitch: number; legible: number } | null = null, mejorD = Infinity;
    for (let dist = 0.5; dist <= 1.2 + 1e-6; dist += 0.05) {
      for (let height = o.hMin; height <= 1.3 + 1e-6; height += 0.05) {
        for (let pitch = o.pMin; pitch <= o.pMax; pitch += 1) {
          const cam = camaraAtril(g, fov, height, dist, pitch, aspect);
          if (cam.pos[1] < plateCtr[1] + o.hMin) continue;
          const n = esq.map(p => ndc(cam, p));
          if (!n.every(q => q.z > 0.05 && Math.abs(q.x) <= 0.9 && Math.abs(q.y) <= 0.9)) continue;
          if (Math.min(n[2].y, n[3].y) < -0.84) continue;
          if (o.anchoMinNdc !== null) { const xs = n.map(q => q.x); if (Math.max(...xs) - Math.min(...xs) < o.anchoMinNdc) continue; }
          if (o.etiquetaK1) {
            const lDist = Math.hypot(lab[0] - cam.pos[0], lab[1] - cam.pos[1], lab[2] - cam.pos[2]);
            if ((g.LBL_H / (2 * lDist * cam.tanV)) * 1080 < 12) continue;
          }
          const leg = o.legible ? o.legible(cam) : 0;
          if (o.legible && leg < LEGIBLE_MIN) continue;
          if (dist < mejorD) { mejorD = dist; mejor = { fov, height, dist, pitch, legible: leg }; }
        }
      }
    }
    if (mejor) return mejor;
  }
  return null;
}
/**
 * Réplica pura de la búsqueda de fitLecternCamera (rama de sonido): las mismas restricciones y el mismo orden, más la
 * de Z96 (legibilidad ≥ LEGIBLE_MIN del texto más lejano) si exigirLegible. Devuelve la pose elegida o null.
 */
export function buscarPoseSonido(g: GeoAtril, aspect: number, exigirLegible: boolean, escala: number, anchoMinNdc = 1.7):
  { fov: number; height: number; dist: number; pitch: number; legible: number } | null {
  const r = buscarPose(g, aspect, { ...BUSQUEDA_SONIDO, anchoMinNdc, etiquetaK1: true,
    legible: exigirLegible ? (cam => legibilidadMinima(g, cam, escala).min) : null });
  if (r && !exigirLegible) { const cam = camaraAtril(g, r.fov, r.height, r.dist, r.pitch, aspect); r.legible = legibilidadMinima(g, cam, escala).min; }
  return r;
}

// ── display: texto de estado (puro) ──
export function mmss(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "--:--";
  const t = Math.floor(s);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
export interface EstadoDisplay { pista: string; t: number; dur: number; sonando: boolean; loopIn: number; loopOut: number; loopOn: boolean }
/** Líneas del display en estado normal. */
export function lineasDisplay(e: EstadoDisplay): [string, string] {
  const nombre = (e.pista || "SIN PISTA").toUpperCase().replace(/\.[a-z0-9]{2,4}$/i, "").slice(0, 34);
  const l1 = `${nombre}  ${mmss(e.t)} / ${mmss(e.dur)}`;
  const a = e.loopIn > 0 ? mmss(e.loopIn) : "--:--", b = e.loopOut > 0 ? mmss(e.loopOut) : "--:--";
  const l2 = `${e.sonando ? "▶ PLAY" : "❚❚ PAUSA"}   LOOP A ${a}  B ${b}${e.loopOn ? "  [ON]" : ""}`;
  return [l1, l2];
}
/**
 * Z97b: la tecla PLAY / PAUSA (lienzo 1024 × 256): ícono ▶❚❚ + texto fijo. Antes el texto (112 px, desde x 270) medía
 * ~833 px y terminaba en ~1103 > 1024: se cortaba la "A". Ahora ícono, separación y fuente se escalan juntos para que
 * todo entre con MARGEN (6 %) a cada lado, centrado. anchoTextoPorPx = ancho del texto medido con una fuente de 1 px
 * (en el navegador, measureText / px; en Node, el modelo 0,62 × caracteres).
 */
export const TECLA_PLAY = { w: 1024, h: 256, margen: 0.06, pxBase: 112, iconoAncho: 174, iconoAlto: 116, gap: 36 };
export function layoutTeclaPlay(anchoTextoPorPx: number): { px: number; s: number; xIcono: number; xTexto: number; anchoTotal: number } {
  const T = TECLA_PLAY, disp = T.w * (1 - 2 * T.margen);
  const natural = T.iconoAncho + T.gap + T.pxBase * Math.max(0, anchoTextoPorPx);
  const s = Math.min(1, disp / natural, (T.h * (1 - 2 * T.margen)) / Math.max(T.iconoAlto, T.pxBase));
  const px = Math.floor(T.pxBase * s);
  const anchoTotal = (T.iconoAncho + T.gap) * s + px * anchoTextoPorPx;
  const xIcono = (T.w - anchoTotal) / 2;
  return { px, s, xIcono, xTexto: xIcono + (T.iconoAncho + T.gap) * s, anchoTotal };
}
/** Z97b: líneas del display con lugar fijo: si no entran, se recortan con "…" (en el navegador además se mide). */
export function recortarLinea(texto: string, maxChars: number): string {
  return texto.length <= maxChars ? texto : texto.slice(0, Math.max(0, maxChars - 1)) + "…";
}
/** Valor mostrado al tocar un control: escala 0…10 con un decimal (perillas y fader), ON/OFF (interruptores). */
export function textoValor(nombreLargo: string, tipo: TipoCtrl, v: number, min: number, max: number): string {
  if (tipo === "toggle") return `${nombreLargo} ${v > 0.5 ? "ON" : "OFF"}`;
  if (tipo === "button") return nombreLargo;
  const n = ((v - min) / Math.max(1e-9, max - min)) * 10;
  return `${nombreLargo} ${Math.max(0, Math.min(10, n)).toFixed(1)}`;
}

// ── VU (puro, sin allocations): RMS del bloque → nivel 0…1 con caída ──
export function rms(buf: Float32Array): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / Math.max(1, buf.length));
}
/** dBFS → 0…1 en un rango de −48…0 dB. */
export function nivelVu(rmsLin: number): number {
  const db = 20 * Math.log10(Math.max(1e-6, rmsLin));
  return Math.max(0, Math.min(1, (db + 48) / 48));
}
/** Balística: sube al instante, cae a CAIDA_POR_S. */
export function balistica(prev: number, nuevo: number, dt: number, caidaPorS = 1.6): number {
  return nuevo >= prev ? nuevo : Math.max(nuevo, prev - caidaPorS * Math.max(0, dt));
}
/** Cadencia ≤ hz: ¿toca actualizar? (último en ms) */
export function tocaActualizar(ahoraMs: number, ultimoMs: number, hz: number): boolean {
  return ahoraMs - ultimoMs >= 1000 / Math.max(1, hz) - 0.5;
}

// ── checkpoint: pose frente al atril de sonido (a distancia de interacción) ──
export const ATRIL_X_BASE = 1.3;   // = LECTERN_X de LecternSystem
/** Cámara a distM del atril de sonido (en x = placeX), del lado del centro de la tarima, mirando su panel. */
export function poseFrenteAtril(placeX: number, distM: number): { x: number; z: number; mirarX: number; mirarY: number; mirarZ: number } {
  return { x: placeX - Math.max(0.3, distM), z: 0, mirarX: placeX, mirarY: 1.1, mirarZ: 0 };
}

// ── doble clic / doble toque sobre perilla o fader: vuelve al valor por defecto ──
export const DOBLE_CLIC_MS = 350;
/** true si este clic completa un doble clic sobre el mismo control (y consume el estado). Sin allocations. */
export function esDobleClic(est: { id: string; t: number }, id: string, t: number, ventanaMs = DOBLE_CLIC_MS): boolean {
  if (est.id === id && t - est.t <= ventanaMs) { est.id = ""; est.t = -1e9; return true; }
  est.id = id; est.t = t;
  return false;
}

// ── huella de cada control en el panel (para la prueba de colisiones) ──
export const HUELLA = { BOTON: 0.030, ROCKER_U: 0.035, ROCKER_V: 0.0225, PASTILLA_U: 0.029, PASTILLA_V: 0.013, FADER_U: 0.035, THUMB_D: 0.040 };
/** Rectángulo que ocupa un control (cuerpo + escala serigrafiada), con PLAY_ESCALA para el PLAY. */
export function huella(p: PosCtrl, playEscala = 1): Rect {
  let hu: number, hv: number;
  if (p.forma === "play") { hu = (PLAY_W / 2) * playEscala; hv = (PLAY_D / 2) * playEscala; }
  else if (p.forma === "pastilla") { hu = HUELLA.PASTILLA_U; hv = HUELLA.PASTILLA_V; }
  else if (p.id === "s_vol") { hu = HUELLA.FADER_U; hv = FADER_RAIL / 2 + HUELLA.THUMB_D / 2; }
  else if (p.id === "s_sam_lp") { hu = HUELLA.ROCKER_U; hv = HUELLA.ROCKER_V + 0.008; }   // + LED del lado lejano
  else if (radioCtrl(p) <= 0.031) { hu = HUELLA.BOTON; hv = HUELLA.BOTON; }
  else {
    // perilla: falda + escala de 270° (la marca de arriba llega a RADIO_MARCAS_OUT; abajo, solo la falda: las marcas de
    // los extremos están a ±135°, a 0,707·r del centro)
    const k = p.forma === "grande" ? GRANDE_ESCALA : 1, r = RADIO_MARCAS_OUT * k, falda = RADIO_FALDA * k;
    return { u0: p.u - r * 0.988, u1: p.u + r * 0.988, v0: p.v - Math.max(falda, r * 0.7072), v1: p.v + r };
  }
  return { u0: p.u - hu, u1: p.u + hu, v0: p.v - hv, v1: p.v + hv };
}

// ════════════════════════════ Z96b ════════════════════════════
// ── escala de la perilla: números de mínimo y máximo en los extremos (±135°), dentro de la huella de Z96 ──
export const NUM_PERILLA_ALTO = 0.0085, NUM_PERILLA_R = RADIO_MARCAS_OUT + 0.004;
const PERILLAS_HZ = new Set(["s_lp_fr", "s_hp_fr"]);
/** Los dos números de la escala de una perilla ("0"/"10", o "MIN"/"MAX" en las de Hz). Centro (u, v) y alto. */
export function numerosPerilla(p: PosCtrl): Texto[] {
  const k = p.forma === "grande" ? GRANDE_ESCALA : 1, r = NUM_PERILLA_R * k, h = NUM_PERILLA_ALTO * k;
  const [a, b] = PERILLAS_HZ.has(p.id) ? ["MIN", "MAX"] : ["0", "10"];
  const s = Math.SQRT1_2;
  const mk = (id: string, texto: string, u: number, v: number): Texto => ({ id, texto, u, v, alto: h, ancho: texto.length * ANCHO_CHAR * h, alinear: "centro", fila: modulo(p.modulo).fila });
  return [mk(`n0_${p.id}`, a, p.u - s * r, p.v - s * r), mk(`n1_${p.id}`, b, p.u + s * r, p.v - s * r)];
}
export function esPerilla(p: PosCtrl): boolean {
  return (p.forma === "normal" || p.forma === "grande") && radioCtrl(p) > 0.031 && p.id !== "s_vol";
}
/** Escala del fader: números 0, 5 y 10 a la izquierda del recorrido (dentro de SALIDA, sin tocar el pomo). */
export function numerosFader(): Texto[] {
  const p = POSICIONES.find(x => x.id === "s_vol")!;
  const h = ESCALA_FADER.alto;
  const u = p.u - HUELLA.FADER_U - 0.004 - ESCALA_FADER.marcaLarga - 0.003;   // borde derecho del número
  return [0, 5, 10].map(n => {
    const t = String(n), ancho = t.length * ANCHO_CHAR * h;
    return { id: `nf_${n}`, texto: t, u: u - ancho / 2, v: FADER_V - FADER_RAIL / 2 + (n / 10) * FADER_RAIL, alto: h, ancho, alinear: "centro" as const, fila: "salida" as Fila };
  });
}

// ── VU retro: verdes, ámbar desde VU_SEG_AMBAR_DESDE, rojos desde VU_SEG_ROJO_DESDE; pico con retención ──
export type ColorVu = 0 | 1 | 2;   // verde, ámbar, rojo
export function colorSegmento(i: number, ambarDesde: number, rojoDesde: number): ColorVu {
  return i >= rojoDesde ? 2 : i >= ambarDesde ? 1 : 0;
}
export interface PicoVu { idx: number; t: number }
/**
 * Pico: sube al segmento más alto encendido; se queda RETENCION_MS y después baja de a un segmento por tick (nunca por
 * debajo del último encendido). idx −1 = sin pico. Sin allocations.
 */
export function tickPico(p: PicoVu, encendidos: number, ahoraMs: number, retencionMs: number): void {
  const top = encendidos - 1;
  if (top >= p.idx) { p.idx = top; p.t = ahoraMs; return; }
  if (ahoraMs - p.t >= Math.max(0, retencionMs)) p.idx = Math.max(top, p.idx - 1);
}

// ── escala de etiquetas por proporción de pantalla ──
export const AUTO_ASPECTO = { DESDE: 1.6, HASTA: 1.5, MAX: 1.15 };
/** ETIQUETA_ESCALA efectiva: con auto, sube linealmente de 1 (proporción ≥ 1,6) a MAX (≤ 1,5). */
export function escalaEfectiva(base: number, auto: boolean, aspect: number): number {
  const b = Number.isFinite(base) ? base : 1;
  if (!auto || !Number.isFinite(aspect) || aspect >= AUTO_ASPECTO.DESDE) return b;
  const t = Math.min(1, (AUTO_ASPECTO.DESDE - aspect) / (AUTO_ASPECTO.DESDE - AUTO_ASPECTO.HASTA));
  return b * (1 + t * (AUTO_ASPECTO.MAX - 1));
}

// ── proyección con altura sobre el panel (placa de la barra) y de texto vertical (rótulos de fila) ──
/** Como fraccionAltura pero con el texto a una altura y sobre la superficie del panel. */
export function fraccionAlturaY(g: GeoAtril, cam: CamaraPura, t: { u: number; v: number; alto: number }, y: number): number {
  const a = ndc(cam, aLocal(g, t.u, y, t.v + t.alto / 2)), b = ndc(cam, aLocal(g, t.u, y, t.v - t.alto / 2));
  if (a.z <= 0.01 || b.z <= 0.01) return 0;
  return Math.abs(a.y - b.y) / 2;
}
/** Texto rotado 90° (se lee de abajo hacia arriba): el alto de la letra va en u. Fracción de la ALTURA de la pantalla. */
export function fraccionAlturaVertical(g: GeoAtril, cam: CamaraPura, t: { u: number; v: number; alto: number }, y = 0.001): number {
  const a = ndc(cam, aLocal(g, t.u - t.alto / 2, y, t.v)), b = ndc(cam, aLocal(g, t.u + t.alto / 2, y, t.v));
  if (a.z <= 0.01 || b.z <= 0.01) return 0;
  return (Math.abs(a.x - b.x) * cam.aspect) / 2;   // ancho en pantalla expresado en alturas de pantalla
}

// ── placa del equipo sobre la barra trasera del marco (cara de arriba, vista por la cámara del atril) ──
export const TEXTO_PLACA = (marca: string) => `SONIDO SN-40 · ${marca} · PROCESADOR DE SONIDO · 10 MÓDULOS`;
/** Barra trasera: cara de arriba a y = 0,037 m sobre el panel, v 0,345…0,425 (REAR_BAR_D 0,08), 1,60 de ancho. */
export const BARRA = { y: 0.037, v0: 0.345, v1: 0.425, ancho: 1.60 };
export const PLACA_BARRA = { ancho: 1.54, prof: 0.074, franjas: 0.016, margen: 0.004 };
/** Alto del texto de la placa: el máximo que entra a lo ancho y en la profundidad libre (sobre las franjas). */
export function altoTextoPlaca(nChars: number): number {
  const porAncho = (PLACA_BARRA.ancho - 0.04) / (nChars * ANCHO_CHAR);
  const porProf = PLACA_BARRA.prof - PLACA_BARRA.franjas - 3 * PLACA_BARRA.margen;
  return Math.min(porAncho, porProf);
}
/** Texto de la placa (centro en la barra; las franjas van del lado del jugador). */
export function textoPlaca(nChars: number): { u: number; v: number; alto: number } {
  const h = altoTextoPlaca(nChars), vc = (BARRA.v0 + BARRA.v1) / 2;
  const vTop = vc + PLACA_BARRA.prof / 2 - PLACA_BARRA.margen;
  return { u: 0, v: vTop - h / 2, alto: h };
}

// ── rótulos de fila en el margen izquierdo (franja negra entre el panel de controles y el borde de la placa) ──
export const MARGEN_ROTULOS = { u0: -0.748, u1: -0.703 };   // 4,5 cm (PANEL_W/2 = 0,75 · panel de controles 0,70)
export const ROTULOS = [
  { id: "r_efectos", texto: "EFECTOS", fila: "efectos" as const },
  { id: "r_tono", texto: "TONO", fila: "tono" as const },
  { id: "r_transporte", texto: "TRANSPORTE", fila: "transporte" as const },
];
export interface Rotulo { id: string; texto: string; u: number; v: number; alto: number; largo: number; v0: number; v1: number }
/** Rótulos verticales: centrados en su fila; alto de letra = lo que entra a lo ancho del margen y a lo largo de la fila. */
export function rotulosFila(): Rotulo[] {
  const w = MARGEN_ROTULOS.u1 - MARGEN_ROTULOS.u0, u = (MARGEN_ROTULOS.u0 + MARGEN_ROTULOS.u1) / 2;
  return ROTULOS.map(r => {
    const f = FILAS[r.fila], largoMax = f.v1 - f.v0 - 0.012;
    const alto = Math.min(w - 0.008, largoMax / (r.texto.length * ANCHO_CHAR));
    const largo = r.texto.length * ANCHO_CHAR * alto, v = (f.v0 + f.v1) / 2;
    return { id: r.id, texto: r.texto, u, v, alto, largo, v0: v - largo / 2, v1: v + largo / 2 };
  });
}
export const ROTULO_MIN = 0.020;

// ── alternativa de rótulos (ROTULOS_MODO "barra"): leyenda numerada en la barra + números grandes en el margen ──
export const LEYENDA_FILAS = "1 EFECTOS · 2 TONO · 3 TRANSPORTE";
/** La placa de la barra en dos líneas: placa (lejos) y leyenda (cerca); franjas finas del lado del jugador. */
export const BARRA_2L = { placa: 0.0325, leyenda: 0.0215, franjas: 0.008, gap: 0.003, margen: 0.003 };
export function lineasBarra(nCharsPlaca: number, conLeyenda: boolean, nCharsLeyenda = LEYENDA_FILAS.length): { placa: { u: number; v: number; alto: number }; leyenda: { u: number; v: number; alto: number } | null } {
  if (!conLeyenda) return { placa: textoPlaca(nCharsPlaca), leyenda: null };
  const vc = (BARRA.v0 + BARRA.v1) / 2, top = vc + PLACA_BARRA.prof / 2 - BARRA_2L.margen;
  const hp = Math.min(BARRA_2L.placa, (PLACA_BARRA.ancho - 0.04) / (nCharsPlaca * ANCHO_CHAR));
  const hl = Math.min(BARRA_2L.leyenda, (PLACA_BARRA.ancho - 0.04) / (nCharsLeyenda * ANCHO_CHAR));
  return { placa: { u: 0, v: top - hp / 2, alto: hp }, leyenda: { u: 0, v: top - hp - BARRA_2L.gap - hl / 2, alto: hl } };
}
/** Números de fila grandes en el margen (uno por fila, derechos). */
export function numerosFilaMargen(): { id: string; texto: string; u: number; v: number; alto: number }[] {
  const w = MARGEN_ROTULOS.u1 - MARGEN_ROTULOS.u0, u = (MARGEN_ROTULOS.u0 + MARGEN_ROTULOS.u1) / 2, h = w - 0.008;
  return ROTULOS.map((r, i) => ({ id: `nfila_${i + 1}`, texto: String(i + 1), u, v: (FILAS[r.fila].v0 + FILAS[r.fila].v1) / 2, alto: h }));
}
