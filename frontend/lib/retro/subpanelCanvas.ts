// Z4: dibujo en canvas de los subpaneles del panel abierto (HISTORIA / GALERÍA / FICHA).
// Medidas = mockup docs/mockups/mockup-paneles-proyecto.png × 2 (2 px de canvas por px).
// Se redibuja solo cuando cambia algo (página, imagen, hover de botón), nunca por frame.
// Marca ficticia AUSTRAL ELECTRIC / KX-07M; sin marcas reales.

import type { ProyectoDetalle } from "@/lib/proyectoDetalle";

export interface Rect { x: number; y: number; w: number; h: number }

export const C = {
  beige:   "#E8DCC4",
  beigeOsc: "#DCCFB4",
  oxido:   "#C0552F",
  carbon:  "#3A3B3C",
  negro:   "#12101A",
  ambar:   "#FF9A1F",
  ambarFondo: "#2A1400",
  renglon: "#CBBFA6",
  etiqueta: "#6B6457",
  serigrafia: "#8A8478",
  naranja: "#F0742A",
};
export const FRANJAS = ["#E5322B", "#F0742A", "#F4B62E", "#2E9E5B", "#1F7FB8"];

const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

// tamaños de canvas (mockup × 2)
export const HISTORIA_SIZE = { w: 870, h: 820 };
export const GALERIA_SIZE  = { w: 870, h: 820 };
export const FICHA_SIZE    = { w: 1120, h: 524 };
// pantalla CRT dentro de GALERÍA (lo cubre un plano con shader propio)
export const GALERIA_PANTALLA: Rect = { x: 44, y: 152, w: 782, h: 490 };

function espaciado(ctx: CanvasRenderingContext2D, px: number) {
  // letterSpacing existe en Chrome/Edge/Safari recientes; si no, se ignora
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
}

function encabezado(ctx: CanvasRenderingContext2D, x: number, titulo: string, codigo: string, sub: string, ancho: number, yTitulo = 72) {
  ctx.fillStyle = C.beige;
  ctx.font = `bold 50px ${MONO}`;
  espaciado(ctx, 9);
  ctx.textBaseline = "alphabetic";
  ctx.fillText(titulo, x, yTitulo);
  espaciado(ctx, 2);
  ctx.textAlign = "right";
  ctx.fillStyle = C.naranja;
  ctx.font = `22px ${MONO}`;
  ctx.fillText(codigo, ancho - 30, yTitulo - 30);
  ctx.fillStyle = C.beige;
  ctx.fillText(sub, ancho - 30, yTitulo + 2);
  ctx.textAlign = "left";
  espaciado(ctx, 0);
}

function franjaHorizontal(ctx: CanvasRenderingContext2D, y: number, ancho: number) {
  FRANJAS.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, y + i * 3, ancho, 3); });
}

function boton(ctx: CanvasRenderingContext2D, r: Rect, txt: string, hover: boolean, oscuro = false) {
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(r.x + 4, r.y + 6, r.w, r.h);            // sombra de tecla
  ctx.fillStyle = oscuro ? C.ambarFondo : C.beige;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.lineWidth = hover ? 6 : 3;
  ctx.strokeStyle = hover ? C.ambar : C.carbon;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = oscuro ? C.ambar : C.carbon;
  ctx.font = `bold 34px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(txt, r.x + r.w / 2, r.y + r.h / 2 + 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function recortar(ctx: CanvasRenderingContext2D, txt: string, max: number): string {
  if (ctx.measureText(txt).width <= max) return txt;
  let t = txt;
  while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}

// ── HISTORIA ──────────────────────────────────────────────────────────────────
export const HISTORIA_TEXTO_X = 104;
export const HISTORIA_TEXTO_W = 726;
export const HISTORIA_BOTONES = {
  arriba: { x: 650, y: 748, w: 64, h: 56 } as Rect,
  abajo:  { x: 730, y: 748, w: 64, h: 56 } as Rect,
};

/** Parte la sinopsis en renglones (con renglón vacío entre párrafos) y en páginas. */
export function paginarSinopsis(ctx: CanvasRenderingContext2D, texto: string, porPagina: number): string[][] {
  ctx.font = `30px ${MONO}`;
  espaciado(ctx, 1);
  const renglones: string[] = [];
  const parrafos = (texto || "SIN SINOPSIS.").split(/\n+/).map(p => p.trim()).filter(Boolean);
  parrafos.forEach((par, pi) => {
    if (pi > 0) renglones.push("");
    let actual = "";
    for (const palabra of par.split(/\s+/)) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (ctx.measureText(prueba).width <= HISTORIA_TEXTO_W || !actual) actual = prueba;
      else { renglones.push(actual); actual = palabra; }
    }
    if (actual) renglones.push(actual);
  });
  espaciado(ctx, 0);
  const n = Math.max(1, Math.floor(porPagina));
  const paginas: string[][] = [];
  for (let i = 0; i < renglones.length; i += n) paginas.push(renglones.slice(i, i + n));
  return paginas.length ? paginas : [[""]];
}

export function dibujarHistoria(ctx: CanvasRenderingContext2D, paginas: string[][], pagina: number, porPagina: number, hover: string | null) {
  const { w, h } = HISTORIA_SIZE;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = C.negro;
  ctx.fillRect(0, 0, w, h);
  // guarda vertical de franjas a la izquierda (mockup)
  FRANJAS.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * 13.6, 0, 13.6, h); });
  encabezado(ctx, 100, "HISTORIA", "H-01", "SINOPSIS", w);
  // cuerpo beige
  ctx.fillStyle = C.beige;
  ctx.fillRect(68, 108, w - 68, h - 108);
  // renglones
  const lh = Math.min(56, (732 - 140) / Math.max(1, porPagina));
  const lineas = paginas[pagina] ?? [];
  ctx.font = `30px ${MONO}`;
  espaciado(ctx, 1);
  for (let i = 0; i < Math.max(1, Math.floor(porPagina)); i++) {
    const y = 140 + lh * (i + 1) - 14;
    ctx.fillStyle = C.renglon;
    ctx.fillRect(HISTORIA_TEXTO_X - 6, y + 12, HISTORIA_TEXTO_W + 12, 2);
    if (lineas[i]) { ctx.fillStyle = C.carbon; ctx.fillText(lineas[i], HISTORIA_TEXTO_X, y); }
  }
  espaciado(ctx, 0);
  // pie: contador y botones
  ctx.fillStyle = C.beigeOsc;
  ctx.fillRect(68, 732, w - 68, h - 732);
  ctx.fillStyle = C.carbon;
  ctx.font = `24px ${MONO}`;
  espaciado(ctx, 2);
  ctx.fillText(`PÁG ${pagina + 1}/${paginas.length}`, 100, 786);
  espaciado(ctx, 0);
  boton(ctx, HISTORIA_BOTONES.arriba, "▲", hover === "arriba");
  boton(ctx, HISTORIA_BOTONES.abajo,  "▼", hover === "abajo");
}

// ── GALERÍA ───────────────────────────────────────────────────────────────────
export const GALERIA_BOTONES = {
  ant: { x: 120, y: 690, w: 180, h: 80 } as Rect,
  sig: { x: 570, y: 690, w: 180, h: 80 } as Rect,
};
const GALERIA_CONTADOR: Rect = { x: 330, y: 690, w: 210, h: 80 };

export function dibujarGaleria(ctx: CanvasRenderingContext2D, indice: number, total: number, hover: string | null) {
  const { w, h } = GALERIA_SIZE;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = C.negro;
  ctx.fillRect(0, 0, w, h);
  encabezado(ctx, 32, "GALERÍA", "G-02", "MOODBOARD", w);
  franjaHorizontal(ctx, 106, w);
  ctx.fillStyle = C.carbon;
  ctx.fillRect(0, 121, w, h - 121);
  // bisel de la pantalla CRT
  ctx.fillStyle = "#1C1C1F";
  ctx.beginPath();
  ctx.roundRect(28, 136, w - 56, 522, 26);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.beginPath();
  const p = GALERIA_PANTALLA;
  ctx.roundRect(p.x, p.y, p.w, p.h, 18);
  ctx.fill();
  // botones + contador
  boton(ctx, GALERIA_BOTONES.ant, "◀ ANT", hover === "ant");
  boton(ctx, GALERIA_CONTADOR, `${String(indice + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, false, true);
  boton(ctx, GALERIA_BOTONES.sig, "SIG ▶", hover === "sig");
  // serigrafía de marca
  ctx.fillStyle = C.serigrafia;
  ctx.font = `16px ${MONO}`;
  espaciado(ctx, 3);
  ctx.textAlign = "right";
  ctx.fillText("AUSTRAL ELECTRIC · KX-07M · VIDEO MONITOR", w - 30, h - 14);
  ctx.textAlign = "left";
  espaciado(ctx, 0);
}

/** Texto de la pantalla (canvas transparente del tamaño de GALERIA_PANTALLA). */
export function dibujarGaleriaPantalla(ctx: CanvasRenderingContext2D, indice: number, ciudad: string) {
  const { w, h } = GALERIA_PANTALLA;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold 24px ${MONO}`;
  espaciado(ctx, 2);
  ctx.fillText("● PLAY ▶", 22, 42);
  ctx.textAlign = "right";
  ctx.fillText(`T-${String(indice + 1).padStart(2, "0")}`, w - 22, 42);
  ctx.textAlign = "left";
  ctx.font = `22px ${MONO}`;
  ctx.fillText(recortar(ctx, `LOCACIÓN · ${(ciudad || "SIN DATO").toUpperCase()}`, w - 44), 22, h - 24);
  espaciado(ctx, 0);
}

// ── FICHA ─────────────────────────────────────────────────────────────────────
function sinAcentos(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
function hostCorto(h: string): string {
  const base = h.replace(/^www\./, "").split(".")[0] ?? h;
  return base === "youtu" ? "YOUTUBE" : base.toUpperCase();
}
function casilla(ctx: CanvasRenderingContext2D, x: number, y: number, marcada: boolean, txt: string, bold: boolean) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.carbon;
  ctx.strokeRect(x, y - 24, 28, 28);
  if (marcada) { ctx.fillStyle = C.oxido; ctx.fillRect(x + 7, y - 17, 14, 14); }
  ctx.fillStyle = C.carbon;
  ctx.font = `${bold ? "bold " : ""}22px ${MONO}`;
  ctx.fillText(txt, x + 40, y);
}

// Etapa 1 video: botón "▶ VER" a la derecha de REFERENCIAS (debajo del numeral, sin pisar filas)
export const FICHA_BOTONES = {
  ver: { x: 856, y: 282, w: 224, h: 40 } as Rect,
};

export function dibujarFicha(ctx: CanvasRenderingContext2D, d: ProyectoDetalle, verVideo = false, hover: string | null = null) {
  const { w, h } = FICHA_SIZE;
  const f = d.ficha;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = C.negro;
  ctx.fillRect(0, 0, w, h);
  encabezado(ctx, 36, "FICHA DEL PROYECTO", "F-03", "KX-07M", w, 58);
  franjaHorizontal(ctx, 78, w);
  ctx.fillStyle = C.beige;
  ctx.fillRect(0, 93, w, h - 93);

  // numeral grande con el id
  ctx.fillStyle = C.oxido;
  ctx.font = `bold 150px ${MONO}`;
  ctx.textAlign = "right";
  ctx.fillText(String(d.id).padStart(2, "0"), w - 36, 268);
  ctx.textAlign = "left";

  const hosts = [...new Set(f.referencias.hosts.map(hostCorto))];
  const filas: [string, string, number][] = [
    ["TIPO",        f.tipo.toUpperCase() || "—", 700],
    ["CIUDAD",      f.ciudad.toUpperCase() || "—", 700],
    ["RODAJE",      (f.fechas ?? "SIN FECHA").toUpperCase(), 820],
    ["REFERENCIAS", f.referencias.cantidad ? `${f.referencias.cantidad}${hosts.length ? ` (${hosts.join(" · ")})` : ""}` : "—", 820],
    ["VACANTES",    `${f.puestos.vacantes} ${f.puestos.vacantes === 1 ? "PUESTO" : "PUESTOS"}${f.puestos.cantidad !== f.puestos.vacantes ? ` DE ${f.puestos.cantidad}` : ""}`, 1080],
  ];
  filas.forEach(([et, val, fin], i) => {
    const y = 148 + i * 52;
    ctx.fillStyle = C.etiqueta;
    ctx.font = `22px ${MONO}`;
    espaciado(ctx, 2);
    ctx.fillText(et, 40, y);
    espaciado(ctx, 1);
    ctx.fillStyle = C.carbon;
    ctx.font = `bold 26px ${MONO}`;
    ctx.fillText(recortar(ctx, val, fin - 250), 240, y);
    ctx.fillStyle = C.renglon;
    ctx.fillRect(236, y + 10, fin - 236, 2);
  });
  espaciado(ctx, 0);

  // ESTADO
  const est = sinAcentos(f.estado);
  ctx.fillStyle = C.etiqueta;
  ctx.font = `22px ${MONO}`;
  ctx.fillText("ESTADO", 40, 428);
  casilla(ctx, 200, 428, est === "abierto", "ABIERTO", est === "abierto");
  casilla(ctx, 470, 428, est === "en produccion", "EN PRODUCCIÓN", est === "en produccion");
  casilla(ctx, 800, 428, est === "finalizado", "FINALIZADO", est === "finalizado");
  // ESTUDIANTE / REMUNERADO
  ctx.fillStyle = C.etiqueta;
  ctx.font = `22px ${MONO}`;
  ctx.fillText("ESTUDIANTE", 40, 484);
  // Z13: SÍ / NO (antes ON / OFF)
  casilla(ctx, 236, 484, f.esEstudiante, "SÍ", f.esEstudiante);
  casilla(ctx, 350, 484, !f.esEstudiante, "NO", !f.esEstudiante);
  ctx.fillStyle = C.etiqueta;
  ctx.font = `22px ${MONO}`;
  ctx.fillText("REMUNERADO", 580, 484);
  casilla(ctx, 776, 484, f.esRemunerado, "SÍ", f.esRemunerado);
  casilla(ctx, 890, 484, !f.esRemunerado, "NO", !f.esRemunerado);
  // serigrafía de marca
  ctx.fillStyle = C.serigrafia;
  ctx.font = `14px ${MONO}`;
  espaciado(ctx, 3);
  ctx.textAlign = "right";
  ctx.fillText("UNIT-07 · PROPERTY OF AUSTRAL ELECTRIC", w - 30, h - 10);
  ctx.textAlign = "left";
  // Etapa 1 video: botón para abrir el video del proyecto en el reproductor aparte
  if (verVideo) {
    const r = FICHA_BOTONES.ver;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(r.x + 4, r.y + 5, r.w, r.h);
    ctx.fillStyle = C.ambarFondo;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.lineWidth = hover === "ver" ? 6 : 3;
    ctx.strokeStyle = hover === "ver" ? C.ambar : C.oxido;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = C.ambar;
    ctx.font = `bold 26px ${MONO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("▶ VER VIDEO", r.x + r.w / 2, r.y + r.h / 2 + 2);
    ctx.textBaseline = "alphabetic";
  }
  ctx.textAlign = "left";
  espaciado(ctx, 0);
}

/** Z11: como dentro(), con el rectángulo agrandado `m` (fracción de su tamaño) por lado: histéresis de salida. */
export function dentroAmpliado(r: Rect, x: number, y: number, m: number): boolean {
  const ex = r.w * m, ey = r.h * m;
  return x >= r.x - ex && x <= r.x + r.w + ex && y >= r.y - ey && y <= r.y + r.h + ey;
}

/** true si el punto (px de canvas) está dentro del rectángulo. */
export function dentro(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
