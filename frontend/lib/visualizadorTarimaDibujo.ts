// Z98: dibujo del visualizador retro de la tarima sin cámara, sobre el canvas de 640×360 de lib/fuenteVideoTarima.ts
// (el mismo que proyecta el domo y que se transmite: lo que se elige acá se ve en SILLAS sin ningún canal nuevo).
// Corre solo cuando ya corría el canvas de ondas (tickFuenteTarima, a DBG_ONDAS_TARIMA.FPS).
//
// Sin allocations por cuadro:
//  - recursos armados UNA vez (asegurarRecursos): capa estática (retícula + scanlines + viñeta), capa auxiliar, tira de
//    la paleta IDENTIDAD como CanvasPattern (el único createLinearGradient, al armarla), tabla de colores y historial;
//    se rehacen solo si cambia LINEAS / COLUMNAS o el tamaño, y se liberan en liberarVisualizador();
//  - arreglos de módulo (_onda, _esp, _linea, _suave, _pts) y vistas cacheadas por longitud (no subarray por cuadro);
//  - colores como strings constantes o de la tabla; sin shadowBlur ni template strings en el bucle (el rótulo se arma
//    solo cuando cambia la elección); el desplazamiento de la tira usa setTransform con números.
// Cascada IDENTIDAD: las líneas se dibujan en blanco sobre la capa auxiliar (la oclusión borra con destination-out), se
// tiñen con la tira desplazada (source-in) y la capa se copia al canvas. XY IDENTIDAD: cada cuadro usa el color del
// tiempo actual; la persistencia de fósforo deja los anteriores en la estela (color por edad).
import { DBG_ONDAS_TARIMA } from "@/lib/debugConfig";
import { FRANJAS_PLACA } from "@/lib/marca";
import { analizadorMaestro, contextoNucleo } from "@/lib/audio/nucleo";
import { enSilencio } from "@/lib/ondasTarima";
import {
  FONDO_VIS, PALETA_FIJA, crearHistorial, escribirLinea, offsetLinea, vaciarHistorial, suavizar, espectroALinea,
  rmsSeguro, puntosXY, casiMono, indiceColor, offsetTira, tablaColores, estiloValido, paletaValida, textoRotulo,
  type Historial,
} from "@/lib/visualizadorTarima";

const MAX_COLS = 256, MAX_LINEAS = 64, MAX_PTS = 2048, N_TABLA = 64;
const BLANCO = "#ffffff", NEGRO = "#000000", FUENTE_ROT = "bold 13px monospace", FUENTE_SIN = "bold 30px monospace";
const SIN_SENAL = "SIN SEÑAL";

const _onda = new Float32Array(2048), _esp = new Uint8Array(1024);
const _linea = new Float32Array(MAX_COLS), _suave = new Float32Array(MAX_COLS), _pts = new Float32Array(2 * MAX_PTS);
// vistas cacheadas (getFloatTimeDomainData / getByteFrequencyData llenan hasta su longitud)
const _vistas = { nOnda: 0, onda: _onda as Float32Array<ArrayBuffer>, nEsp: 0, esp: _esp as Uint8Array<ArrayBuffer> };
function vistaOnda(n: number): Float32Array<ArrayBuffer> {
  if (_vistas.nOnda !== n) { _vistas.nOnda = n; _vistas.onda = _onda.subarray(0, n) as Float32Array<ArrayBuffer>; }
  return _vistas.onda;
}
function vistaEsp(n: number): Uint8Array<ArrayBuffer> {
  if (_vistas.nEsp !== n) { _vistas.nEsp = n; _vistas.esp = _esp.subarray(0, n) as Uint8Array<ArrayBuffer>; }
  return _vistas.esp;
}

interface XY { fuente: AnalyserNode; sp: ChannelSplitterNode; aL: AnalyserNode; aR: AnalyserNode; vL: Float32Array<ArrayBuffer>; vR: Float32Array<ArrayBuffer> }
interface Recursos {
  w: number; h: number;
  estatica: HTMLCanvasElement;
  capa: HTMLCanvasElement; cc: CanvasRenderingContext2D;
  tira: CanvasPattern | null; tiraCv: HTMLCanvasElement;
  tabla: string[];
  hist: Historial; vacio: boolean;
  xy: XY | null;
  rot: { estilo: string; paleta: string; texto: string };
}
let R: Recursos | null = null;

/** Cronómetro del dibujo por estilo (media móvil, ms por cuadro). Lo muestra Shift → Tarima → Ondas de la tarima. */
export const CRONO_VIS = { cascada: 0, xy: 0, nCascada: 0, nXy: 0, ultimoMs: 0 };

function crearCanvas(w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h; return cv;
}
function asegurarRecursos(w: number, h: number): Recursos | null {
  const D = DBG_ONDAS_TARIMA;
  const L = Math.max(2, Math.min(MAX_LINEAS, Math.floor(D.LINEAS))), C = Math.max(8, Math.min(MAX_COLS, Math.floor(D.COLUMNAS)));
  if (R && R.w === w && R.h === h) {
    if (R.hist.lineas !== L || R.hist.bins !== C) { R.hist = crearHistorial(L, C); R.vacio = true; _suave.fill(0); }
    return R;
  }
  if (typeof document === "undefined") return null;
  liberarVisualizador();
  // capa estática: retícula fina, scanlines y viñeta (se arma una vez)
  const estatica = crearCanvas(w, h), e = estatica.getContext("2d");
  if (!e) return null;
  e.strokeStyle = "rgba(255,220,170,0.07)"; e.lineWidth = 1; e.beginPath();
  for (let x = 0; x <= w; x += w / 16) { e.moveTo(Math.round(x) + 0.5, 0); e.lineTo(Math.round(x) + 0.5, h); }
  for (let y = 0; y <= h; y += h / 9) { e.moveTo(0, Math.round(y) + 0.5); e.lineTo(w, Math.round(y) + 0.5); }
  e.stroke();
  e.fillStyle = "rgba(0,0,0,0.16)";
  for (let y = 0; y < h; y += 3) e.fillRect(0, y, w, 1);
  const vg = e.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.55)");
  e.fillStyle = vg; e.fillRect(0, 0, w, h);
  // capa auxiliar (IDENTIDAD) y tira de la paleta: un ciclo de las franjas por ancho, sin costura
  const capa = crearCanvas(w, h), cc = capa.getContext("2d");
  if (!cc) return null;
  const tiraCv = crearCanvas(w, 4), tc = tiraCv.getContext("2d");
  let tira: CanvasPattern | null = null;
  if (tc) {
    const g = tc.createLinearGradient(0, 0, w, 0), k = FRANJAS_PLACA.length;
    for (let i = 0; i <= k; i++) g.addColorStop(i / k, FRANJAS_PLACA[i % k]);
    tc.fillStyle = g; tc.fillRect(0, 0, w, 4);
    tira = cc.createPattern(tiraCv, "repeat");
  }
  R = { w, h, estatica, capa, cc, tira, tiraCv, tabla: tablaColores(FRANJAS_PLACA, N_TABLA), hist: crearHistorial(L, C), vacio: true,
    xy: null, rot: { estilo: "", paleta: "", texto: "" } };
  _suave.fill(0);
  return R;
}

// ── analizadores estéreo del XY: derivación desde el analizador maestro (no toca lo que se escucha) ──
function asegurarXY(r: Recursos): XY | null {
  if (r.xy) return r.xy;
  const ctx = contextoNucleo(), an = analizadorMaestro();
  if (!ctx || !an) return null;
  try {
    const sp = ctx.createChannelSplitter(2), aL = ctx.createAnalyser(), aR = ctx.createAnalyser();
    aL.fftSize = 2048; aR.fftSize = 2048;
    an.connect(sp); sp.connect(aL, 0); sp.connect(aR, 1);
    r.xy = { fuente: an, sp, aL, aR, vL: new Float32Array(2048), vR: new Float32Array(2048) };
  } catch { r.xy = null; }
  return r.xy;
}
function liberarXY(r: Recursos | null): void {
  const x = r?.xy;
  if (!x || !r) return;
  try { x.fuente.disconnect(x.sp); } catch { /* ya desconectado */ }
  try { x.sp.disconnect(); x.aL.disconnect(); x.aR.disconnect(); } catch { /* ok */ }
  r.xy = null;
}
/** Sin dibujar (cámara elegida o fuente de ondas detenida): suelta los analizadores extra del XY. */
export function soltarXYVisualizador(): void { liberarXY(R); }
/** Al desmontar la tarima: analizadores, capas, patrón e historial. */
export function liberarVisualizador(): void {
  if (!R) return;
  liberarXY(R);
  R.capa.width = 0; R.estatica.width = 0; R.tiraCv.width = 0;
  R.tira = null;
  R = null;
}

// ── dibujo ──
function trazar(c: CanvasRenderingContext2D, n: number): void {
  c.beginPath();
  c.moveTo(_pts[0], _pts[1]);
  for (let i = 1; i < n; i++) c.lineTo(_pts[2 * i], _pts[2 * i + 1]);
}
function sinSenal(c: CanvasRenderingContext2D, w: number, h: number, t: number, color: string): void {
  c.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(t * 1.6));   // parpadeo lento
  c.fillStyle = color; c.font = FUENTE_SIN; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText(SIN_SENAL, w / 2, h * 0.28);
  c.globalAlpha = 1;
}

/** Dibuja un cuadro del visualizador en c (w×h). t = segundos del reloj de la experiencia. */
export function dibujarVisualizador(c: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  const r = asegurarRecursos(w, h);
  if (!r) return;
  const D = DBG_ONDAS_TARIMA, est = estiloValido(D.ESTILO), pal = paletaValida(D.PALETA);
  if (est === "xy" && D.XY_MODO !== "retardo") asegurarXY(r); else liberarXY(r);
  c.globalCompositeOperation = "source-over"; c.globalAlpha = 1;
  c.lineJoin = "round"; c.lineCap = "round";
  if (est === "cascada") cascada(c, r, w, h, t, pal); else osciloscopio(c, r, w, h, t, pal);
  // capa estática encima (en el XY con la misma estela, para que no se acumule)
  c.globalAlpha = est === "xy" ? Math.max(0.05, 1 - Math.max(0, Math.min(0.97, D.XY_PERSISTENCIA))) : 1;
  c.drawImage(r.estatica, 0, 0);
  c.globalAlpha = 1;
  if (D.ROTULO) {
    if (r.rot.estilo !== D.ESTILO || r.rot.paleta !== D.PALETA) { r.rot.estilo = D.ESTILO; r.rot.paleta = D.PALETA; r.rot.texto = textoRotulo(D.ESTILO, D.PALETA); }
    c.globalAlpha = 0.55; c.fillStyle = pal === "fosforo" ? PALETA_FIJA.fosforo.trazo : PALETA_FIJA.ambar.trazo;
    c.font = FUENTE_ROT; c.textAlign = "right"; c.textBaseline = "bottom";
    c.fillText(r.rot.texto, w - 10, h - 8);
    c.globalAlpha = 1;
  }
  if (t0) {
    const ms = performance.now() - t0;
    CRONO_VIS.ultimoMs = ms;
    if (est === "cascada") { CRONO_VIS.cascada = CRONO_VIS.nCascada ? CRONO_VIS.cascada * 0.95 + ms * 0.05 : ms; CRONO_VIS.nCascada++; }
    else { CRONO_VIS.xy = CRONO_VIS.nXy ? CRONO_VIS.xy * 0.95 + ms * 0.05 : ms; CRONO_VIS.nXy++; }
  }
}

function cascada(c: CanvasRenderingContext2D, r: Recursos, w: number, h: number, t: number, pal: string): void {
  const D = DBG_ONDAS_TARIMA, an = analizadorMaestro(), hist = r.hist, C = hist.bins, L = hist.lineas;
  let rms = 0;
  if (an) {
    const n = Math.min(an.fftSize, _onda.length);
    const vo = vistaOnda(n);
    an.getFloatTimeDomainData(vo);
    rms = rmsSeguro(vo, n);
  }
  const silencio = !an || enSilencio(rms);
  if (!silencio && an) {
    const nb = Math.min(an.frequencyBinCount, _esp.length);
    an.getByteFrequencyData(vistaEsp(nb));
    espectroALinea(_esp, nb, C, D.SENSIBILIDAD * 0.45, D.FREC_MIN, D.FREC_SUAVE, _linea);
    for (let j = 0; j < C; j++) _suave[j] = suavizar(_suave[j], _linea[j], D.SUBIDA, D.BAJADA);
    escribirLinea(hist, _suave);
    r.vacio = false;
  } else if (!r.vacio) { vaciarHistorial(hist); _suave.fill(0); r.vacio = true; }

  const ident = pal === "identidad" && !!r.tira;
  const fija = pal === "fosforo" ? PALETA_FIJA.fosforo : PALETA_FIJA.ambar;
  c.fillStyle = FONDO_VIS; c.fillRect(0, 0, w, h);
  const g = ident ? r.cc : c;
  if (ident) r.cc.clearRect(0, 0, w, h);
  const grosor = Math.max(1, D.GROSOR);
  const cuantas = silencio ? 1 : Math.max(1, hist.cuenta);
  for (let e = cuantas - 1; e >= 0; e--) {
    const d = L > 1 ? e / (L - 1) : 0;                 // 0 = al frente (abajo), 1 = la más vieja (arriba, atrás)
    const base = h * 0.88 - d * h * 0.6, esc = 1 - d * 0.3, amp = h * 0.36 * (1 - d * 0.35);
    const x0 = w / 2 - w * 0.43 * esc, dx = (w * 0.86 * esc) / (C - 1);
    const off = offsetLinea(hist, e);
    for (let j = 0; j < C; j++) {
      _pts[2 * j] = x0 + j * dx;
      _pts[2 * j + 1] = base - (silencio ? 0 : hist.data[off + j]) * amp;
    }
    // oclusión: relleno oscuro bajo la línea (tapa las de atrás)
    trazar(g, C);
    g.lineTo(_pts[2 * (C - 1)], base + 3); g.lineTo(_pts[0], base + 3); g.closePath();
    if (ident) { g.globalCompositeOperation = "destination-out"; g.fillStyle = NEGRO; g.fill(); g.globalCompositeOperation = "source-over"; }
    else { g.fillStyle = FONDO_VIS; g.fill(); }
    // fósforo: pasada ancha tenue + pasada fina brillante
    const vida = 1 - d * 0.6;
    trazar(g, C);
    g.strokeStyle = ident ? BLANCO : fija.trazo; g.globalAlpha = 0.22 * vida; g.lineWidth = grosor * 2.6; g.stroke();
    g.strokeStyle = ident ? BLANCO : fija.brillo; g.globalAlpha = 0.95 * vida; g.lineWidth = Math.max(1, grosor * 0.55); g.stroke();
    g.globalAlpha = 1;
  }
  if (ident) {
    // teñir con la tira desplazada (los colores viajan sobre las ondas) y copiar la capa
    const off = offsetTira(t, D.COLOR_VELOC, w);
    r.cc.globalCompositeOperation = "source-in";
    r.cc.setTransform(1, 0, 0, 1, off, 0);
    r.cc.fillStyle = r.tira!; r.cc.fillRect(-off, 0, w, h);
    r.cc.setTransform(1, 0, 0, 1, 0, 0);
    r.cc.globalCompositeOperation = "source-over";
    c.drawImage(r.capa, 0, 0);
  }
  if (silencio) sinSenal(c, w, h, t, ident ? r.tabla[Math.floor(indiceColor(0, t, D.COLOR_VELOC, N_TABLA)) % N_TABLA] : fija.trazo);
}

function osciloscopio(c: CanvasRenderingContext2D, r: Recursos, w: number, h: number, t: number, pal: string): void {
  const D = DBG_ONDAS_TARIMA, an = analizadorMaestro();
  // persistencia de fósforo: el cuadro anterior se desvanece hacia el fondo
  c.globalAlpha = 1 - Math.max(0, Math.min(0.97, D.XY_PERSISTENCIA));
  c.fillStyle = FONDO_VIS; c.fillRect(0, 0, w, h);
  c.globalAlpha = 1;
  const cx = w / 2, cy = h / 2, rad = h * 0.42, nMax = Math.max(16, Math.min(MAX_PTS, Math.floor(D.XY_PUNTOS)));
  let n = 0, rms = 0;
  const x = r.xy;
  if (x && D.XY_MODO !== "retardo") {
    x.aL.getFloatTimeDomainData(x.vL); x.aR.getFloatTimeDomainData(x.vR);
    rms = Math.max(rmsSeguro(x.vL, 2048), rmsSeguro(x.vR, 2048));
    const mono = D.XY_MODO === "auto" && casiMono(x.vL, x.vR, 2048);
    n = puntosXY(x.vL, mono ? null : x.vR, 2048, nMax, D.XY_RETARDO, cx, cy, rad, D.SENSIBILIDAD, _pts);
  } else if (an) {
    const len = Math.min(an.fftSize, _onda.length), vo = vistaOnda(len);
    an.getFloatTimeDomainData(vo);
    rms = rmsSeguro(vo, len);
    n = puntosXY(vo, null, len, nMax, D.XY_RETARDO, cx, cy, rad, D.SENSIBILIDAD, _pts);
  }
  const silencio = !an || enSilencio(rms);
  const ident = pal === "identidad";
  const fija = pal === "fosforo" ? PALETA_FIJA.fosforo : PALETA_FIJA.ambar;
  const col = ident ? r.tabla[Math.floor(indiceColor(0, t, D.COLOR_VELOC, N_TABLA)) % N_TABLA] : fija.trazo;
  if (silencio || n < 2) {
    // línea plana (reposo)
    _pts[0] = cx - rad; _pts[1] = cy; _pts[2] = cx + rad; _pts[3] = cy; n = 2;
  }
  const grosor = Math.max(1, D.GROSOR);
  trazar(c, n);
  c.strokeStyle = col; c.globalAlpha = 0.25; c.lineWidth = grosor * 2.6; c.stroke();
  c.strokeStyle = ident ? col : fija.brillo; c.globalAlpha = 0.95; c.lineWidth = Math.max(1, grosor * 0.55); c.stroke();
  c.globalAlpha = 1;
  if (silencio) sinSenal(c, w, h, t, col);
}

/** Texto del cronómetro para el menú (se arma en el menú, no en el dibujo). */
export function textoCronoVis(): string {
  const f = (v: number, n: number) => (n ? `${v.toFixed(2)} ms (${n} cuadros)` : "sin medir");
  return `cascada ${f(CRONO_VIS.cascada, CRONO_VIS.nCascada)} · XY ${f(CRONO_VIS.xy, CRONO_VIS.nXy)} · XY estéreo ${R?.xy ? "conectado" : "no"}`;
}
