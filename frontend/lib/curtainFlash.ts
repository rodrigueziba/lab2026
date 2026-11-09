// F1: Destello enceguecedor al atravesar el telón — máquina de estados compartida.
// Escriben: CurtainFlash (tick + overlay), Curtain (luz/visibilidad del telón).
// Leen: RetroPostFX (boost de bloom/exposición), DebugMenu (estado en vivo).
// Objeto de módulo mutable, igual que debugConfig: sin allocations por frame.

import { DBG_FLASH } from "@/lib/debugConfig";

export type FlashFase = "inactivo" | "subida" | "sostenido" | "bajada" | "glare"; // G1: + glare residual

export const FLASH_STATE = {
  fase:          "inactivo" as FlashFase,
  valor:         0,      // envolvente 0–1 (1 = blanco total)
  opacidad:      0,      // valor × pico efectivo (lo que pinta el overlay)
  t0:            0,      // performance.now() del disparo
  tBajada:       0,      // performance.now() en que empezó la bajada
  pico:          1,      // pico efectivo (reduced-motion aplicado)
  subidaMs:      150,    // subida efectiva (reduced-motion aplicado)
  bajadaMs:      450,    // G1: bajada efectiva (reduced-motion aplicado)
  // G1: glare residual + boost de postproceso desacoplado de la opacidad
  glare:         0,      // uGlare actual (0–1)
  glareInicio:   0.35,   // uGlare al terminar la bajada (reduced-motion aplicado)
  tGlare:        0,      // performance.now() en que empezó el glare
  boost:         0,      // factor 0–1 (× pico) para bloom/exposición
  disparado:     false,  // ya se disparó por la cortina en esta sesión
  esperaTelon:   false,  // true = la bajada espera a que el telón esté apagado y oculto
  // Reportado por Curtain cada frame (y en su cleanup)
  luzTelon:      0,      // intensidad actual de la spotLight del telón
  telonVisible:  false,  // mesh del telón visible
  telonMontado:  false,  // <Curtain /> montado (su spotLight sigue en la escena)
  avisoTope:     false,
};

/** F1: dispara el destello. origen 'cortina' se acepta una sola vez por sesión;
 *  'debug' siempre (no espera al telón). Devuelve true si arrancó. */
export function triggerCurtainFlash(origen: "cortina" | "debug"): boolean {
  if (!DBG_FLASH.FLASH_ACTIVO) return false;
  if (origen === "cortina") {
    if (FLASH_STATE.disparado) return false;
    FLASH_STATE.disparado = true;
  }
  let reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* sin matchMedia */ }
  FLASH_STATE.pico     = Math.max(0, Math.min(1, DBG_FLASH.FLASH_PICO)) * (reduce ? DBG_FLASH.FLASH_RM_PICO_MULT : 1);
  FLASH_STATE.subidaMs = reduce ? Math.max(DBG_FLASH.FLASH_SUBIDA_MS, DBG_FLASH.FLASH_RM_SUBIDA_MS) : DBG_FLASH.FLASH_SUBIDA_MS;
  // G1: reduced-motion → caída más lenta y glare a la mitad
  FLASH_STATE.bajadaMs    = reduce ? Math.max(DBG_FLASH.FLASH_BAJADA_MS, DBG_FLASH.FLASH_RM_BAJADA_MS) : DBG_FLASH.FLASH_BAJADA_MS;
  FLASH_STATE.glareInicio = Math.max(0, Math.min(1, DBG_FLASH.FLASH_GLARE_INICIO)) * (reduce ? DBG_FLASH.FLASH_RM_GLARE_MULT : 1);
  FLASH_STATE.glare       = 0;
  FLASH_STATE.tGlare      = 0;
  FLASH_STATE.t0          = performance.now();
  FLASH_STATE.tBajada     = 0;
  FLASH_STATE.esperaTelon = origen === "cortina";
  FLASH_STATE.avisoTope   = false;
  FLASH_STATE.fase        = "subida";
  return true;
}

/** F1: true mientras el destello controla la luz/visibilidad del telón. */
export function flashDrivesCurtain(): boolean {
  return FLASH_STATE.esperaTelon && FLASH_STATE.fase !== "inactivo";
}

/** F1: el telón está apagado del todo: luz exactamente 0, mesh oculto y <Curtain />
 *  ya desmontado (su desmontaje cambia la cantidad de luces → recompilación de
 *  materiales; así ese tirón ocurre siempre detrás del blanco total). */
function telonApagado(): boolean {
  return FLASH_STATE.luzTelon === 0 && !FLASH_STATE.telonVisible && !FLASH_STATE.telonMontado;
}

/** F1: avanza la máquina de estados. Llamado por CurtainFlash en su rAF. */
export function tickCurtainFlash(now: number): void {
  const s = FLASH_STATE;
  if (s.fase === "inactivo") return;
  const t = now - s.t0;

  if (s.fase === "subida") {
    const k = s.subidaMs > 0 ? Math.min(1, t / s.subidaMs) : 1;
    s.valor = k;
    if (k >= 1) s.fase = "sostenido";
  }

  if (s.fase === "sostenido") {
    s.valor = 1;
    const tHold = t - s.subidaMs;
    const minOk = tHold >= DBG_FLASH.FLASH_SOSTENIDO_MS;
    const telonOk = !s.esperaTelon || telonApagado();
    const tope = tHold >= DBG_FLASH.FLASH_TOPE_MS;
    if (minOk && (telonOk || tope)) {
      if (!telonOk && !s.avisoTope) {
        s.avisoTope = true;
        console.warn(`[CurtainFlash] tope de sostenido (${DBG_FLASH.FLASH_TOPE_MS} ms) alcanzado: luzTelon=${s.luzTelon}, telonVisible=${s.telonVisible}`);
      }
      s.fase = "bajada";
      s.tBajada = now;
    }
  }

  if (s.fase === "bajada") {
    const d = s.bajadaMs;
    const k = d > 0 ? Math.min(1, (now - s.tBajada) / d) : 1;
    // G1: exponencial normalizada — cae fuerte al principio, se asienta rápido, 0 exacto en k=1
    s.valor = expDecay(k, DBG_FLASH.FLASH_BAJADA_EXP_K);
    // G1: el glare entra mientras cae el blanco (sin escalón al terminar la bajada)
    s.glare = s.glareInicio * (1 - s.valor);
    if (k >= 1) {
      s.valor  = 0;
      s.glare  = s.glareInicio;
      s.fase   = s.glareInicio > 0 && DBG_FLASH.FLASH_GLARE_MS > 0 ? "glare" : "inactivo";
      s.tGlare = now;
      if (s.fase === "inactivo") { s.glare = 0; s.esperaTelon = false; }
    }
  }

  if (s.fase === "glare") {
    const d = DBG_FLASH.FLASH_GLARE_MS;
    const k = d > 0 ? Math.min(1, (now - s.tGlare) / d) : 1;
    s.glare = s.glareInicio * expDecay(k, DBG_FLASH.FLASH_GLARE_EXP_K);
    if (k >= 1) {
      s.glare = 0;
      s.fase = "inactivo";
      s.esperaTelon = false;
    }
  }

  s.opacidad = s.valor * s.pico;

  // G1: boost de bloom/exposición: pico plano en subida/sostenido, baja hasta
  // FLASH_GLARE_BLOOM durante la caída y de ahí a 0 con el mismo decaimiento del glare.
  const gb = DBG_FLASH.FLASH_GLARE_BLOOM;
  if (s.fase === "subida" || s.fase === "sostenido") s.boost = s.valor * s.pico;
  else if (s.fase === "bajada") {
    // sin glare (inicio 0 o duración 0) → baja directo a 0, sin salto al terminar
    const conGlare = s.glareInicio > 0 && DBG_FLASH.FLASH_GLARE_MS > 0;
    s.boost = s.pico * (conGlare ? gb + (1 - gb) * s.valor : s.valor);
  }
  else if (s.fase === "glare")  s.boost = s.pico * gb * (s.glareInicio > 0 ? s.glare / s.glareInicio : 0);
  else                          s.boost = 0;
  if (s.fase === "inactivo") { s.opacidad = 0; s.glare = 0; }
}

/** G1: decaimiento exponencial normalizado: 1 en t=0, 0 exacto en t=1. */
function expDecay(t: number, k: number): number {
  if (k <= 0.0001) return 1 - t;
  const e = Math.exp(-k);
  return (Math.exp(-k * t) - e) / (1 - e);
}

// ── F3: luminancia final estimada en el centro de la pantalla en el pico ──────
// G2: queda como dato SECUNDARIO (teórico); el panel muestra primero la medición real.
// Replica la fórmula del CRT (lib/retro/retroCRT.ts) en el centro (r=0: glow completo,
// viñeta 0, scanline media, grano medio 0) + OutputPass: ACESFilmic de three
// (exposure/0.6, RRT/ODT fit) → sRGB → luminancia Rec.709. Supone escena ≈ 0 detrás.
// Solo para el DebugMenu (poll 10 fps), no se usa por frame.
function rrtOdt(v: number): number {
  const a = v * (v + 0.0245786) - 0.000090537;
  const b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
function lin2srgb(c: number): number {
  const x = Math.max(0, Math.min(1, c));
  return x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}
export function estimarLuminanciaPico(
  flashColor: { r: number; g: number; b: number },
  tint: { r: number; g: number; b: number },
  uScan: number, uLift: number, toneExposure: number, uGrain = 0,
): number {
  let reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* ok */ }
  const pico = Math.max(0, Math.min(1, DBG_FLASH.FLASH_PICO)) * (reduce ? DBG_FLASH.FLASH_RM_PICO_MULT : 1);
  const I    = Math.max(0, Math.min(1, DBG_FLASH.FLASH_INTENSIDAD));  // G3: perilla maestra
  const f    = Math.min(pico, DBG_FLASH.FLASH_CRT_MAX) * I;          // uFlash en el pico (G3: × I)
  const hdr  = 1 + (Math.max(1, DBG_FLASH.FLASH_HDR) - 1) * I;       // G3
  const glow = (1 + DBG_FLASH.FLASH_GLOW) * hdr;                     // r = 0; G2: × HDR
  const effScan = uScan + (Math.min(uScan, DBG_FLASH.FLASH_SCAN_MAX) - uScan) * f;
  const scanK   = 1 - effScan;                                       // G1: valle de la scanline (peor caso)
  const cap     = 0.92 + (DBG_FLASH.FLASH_TOPE_LUM * hdr - 0.92) * f; // G2: tope × HDR
  // G1: peor caso también para el grano (−uGrain/2); G2: tinte neutralizado con uFlash
  const crt = (c: number, t: number) => Math.min((f * c * glow * scanK - uGrain * 0.5) * (t + (1 - t) * f) + uLift, cap);
  const k = toneExposure * (1 + (DBG_FLASH.FLASH_EXPOSICION_MULT - 1) * I * pico) / 0.6; // G3: × I
  const r = crt(flashColor.r, tint.r) * k, g = crt(flashColor.g, tint.g) * k, b = crt(flashColor.b, tint.b) * k;
  // ACESInputMat (columnas) · v
  const ir = 0.59719 * r + 0.35458 * g + 0.04823 * b;
  const ig = 0.07600 * r + 0.90834 * g + 0.01566 * b;
  const ib = 0.02840 * r + 0.13383 * g + 0.83777 * b;
  const fr = rrtOdt(ir), fg = rrtOdt(ig), fb = rrtOdt(ib);
  // ACESOutputMat (columnas) · v
  const or = 1.60475 * fr - 0.53108 * fg - 0.07367 * fb;
  const og = -0.10208 * fr + 1.10813 * fg - 0.00605 * fb;
  const ob = -0.00327 * fr - 0.07276 * fg + 1.07602 * fb;
  const L = 0.2126 * lin2srgb(or) + 0.7152 * lin2srgb(og) + 0.0722 * lin2srgb(ob);
  // G2: blow-out final (peor caso de su textura: valle de scanline + grano 1)
  const bo = f * DBG_FLASH.FLASH_BLOWOUT;
  return (L + (1 - L) * bo) * (1 - DBG_FLASH.FLASH_BLOWOUT_TEXTURA * bo);
}

// ── G2: medición REAL del pico — lee píxeles del canvas en el frame de render ──
// La pide el DebugMenu ("Medir pico del destello"); la ejecuta RetroPostFX justo
// después de composer.render() (mismo frame → no hace falta preserveDrawingBuffer).
// El buffer se reserva solo al medir (una vez), nunca por frame.
export const FLASH_MEDICION = {
  pedido:   false,
  tPedido:  0,
  estado:   "—" as string,  // — | esperando | listo | error: …
  centro:   0,              // luminancia media del 10 % × 10 % central
  esquina:  0,              // luminancia media del 5 % × 5 % superior izquierdo (incluye borde fuera del barrel)
  contraste: 0,             // G3: centro − esquina (contraste del CRT)
  intensidad: 0,            // G3: FLASH_INTENSIDAD con la que se midió
  oscuro5:  0,              // luminancia media del 5 % de píxeles más oscuros
  minRGB:   0,              // mínimo de todos los canales RGB de toda la pantalla
  ancho:    0,
  alto:     0,
};

/** G2: pide la medición y dispara el destello (origen debug, no espera al telón). */
export function pedirMedicionFlash(): void {
  FLASH_MEDICION.pedido  = true;
  FLASH_MEDICION.tPedido = performance.now();
  FLASH_MEDICION.estado  = "esperando";
  window.dispatchEvent(new CustomEvent("alight:debug-curtain-flash"));
}

/** G2: true cuando toca leer (sostenido, ya pasado FLASH_MEDIR_HOLD_MS). Marca error si no arrancó. */
export function medicionFlashLista(now: number): boolean {
  const m = FLASH_MEDICION;
  if (!m.pedido) return false;
  const s = FLASH_STATE;
  if (s.fase === "inactivo" && now - m.tPedido > 1000) {
    m.pedido = false;
    m.estado = DBG_FLASH.FLASH_ACTIVO ? "error: el destello no arrancó" : "error: FLASH_ACTIVO off";
    return false;
  }
  return s.fase === "sostenido" && now - s.t0 - s.subidaMs >= DBG_FLASH.FLASH_MEDIR_HOLD_MS;
}

/** G2: lee el framebuffer por defecto (lo que se ve) y calcula las métricas. */
export function medirPicoFlash(ctx: WebGLRenderingContext | WebGL2RenderingContext): void {
  const m = FLASH_MEDICION;
  m.pedido = false;
  const w = ctx.drawingBufferWidth, h = ctx.drawingBufferHeight;
  if (w <= 0 || h <= 0) { m.estado = "error: canvas vacío"; return; }
  const px = new Uint8Array(w * h * 4);
  try {
    ctx.bindFramebuffer(ctx.FRAMEBUFFER, null);
    ctx.readPixels(0, 0, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
  } catch (e) {
    m.estado = `error: readPixels (${String(e)})`;
    return;
  }
  const BINS = 1024;
  const hist = new Float64Array(BINS), histN = new Uint32Array(BINS);
  const cx0 = Math.floor(w * 0.45), cx1 = Math.ceil(w * 0.55);
  const cy0 = Math.floor(h * 0.45), cy1 = Math.ceil(h * 0.55);
  const ex1 = Math.ceil(w * 0.05),  ey0 = Math.floor(h * 0.95); // readPixels: y=0 abajo → arriba = y alto
  let cS = 0, cN = 0, eS = 0, eN = 0, minC = 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      if (r < minC) minC = r;
      if (g < minC) minC = g;
      if (b < minC) minC = b;
      const k = Math.min(BINS - 1, Math.floor(L * BINS));
      hist[k] += L; histN[k]++;
      if (x >= cx0 && x < cx1 && y >= cy0 && y < cy1) { cS += L; cN++; }
      if (x < ex1 && y >= ey0) { eS += L; eN++; }
    }
  }
  // 5 % más oscuro: se acumula desde el bin más bajo
  const objetivo = Math.max(1, Math.floor(w * h * 0.05));
  let acc = 0, accS = 0;
  for (let k = 0; k < BINS && acc < objetivo; k++) {
    const n = histN[k];
    if (!n) continue;
    const toma = Math.min(n, objetivo - acc);
    accS += (hist[k] / n) * toma;
    acc  += toma;
  }
  m.centro  = cN ? cS / cN : 0;
  m.esquina = eN ? eS / eN : 0;
  m.oscuro5 = acc ? accS / acc : 0;
  m.minRGB  = minC / 255;
  m.contraste  = m.centro - m.esquina;        // G3
  m.intensidad = DBG_FLASH.FLASH_INTENSIDAD;  // G3
  m.ancho = w; m.alto = h;
  m.estado = "listo";
  console.info(`[CurtainFlash] medición pico ${w}×${h}: centro ${m.centro.toFixed(4)} · esquina ${m.esquina.toFixed(4)} · contraste ${m.contraste.toFixed(4)} · I ${m.intensidad.toFixed(2)} · 5% oscuro ${m.oscuro5.toFixed(4)} · minRGB ${m.minRGB.toFixed(4)}`);
}

/** F1/G1: factor 0–1 para el boost de postproceso (proporcional al pico efectivo). */
export function flashBoost(): number {
  return FLASH_STATE.fase === "inactivo" ? 0 : FLASH_STATE.boost;
}
