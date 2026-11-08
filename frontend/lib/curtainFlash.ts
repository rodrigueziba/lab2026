// F1: Destello enceguecedor al atravesar el telón — máquina de estados compartida.
// Escriben: CurtainFlash (tick + overlay), Curtain (luz/visibilidad del telón).
// Leen: RetroPostFX (boost de bloom/exposición), DebugMenu (estado en vivo).
// Objeto de módulo mutable, igual que debugConfig: sin allocations por frame.

import { DBG_FLASH } from "@/lib/debugConfig";

export type FlashFase = "inactivo" | "subida" | "sostenido" | "bajada";

export const FLASH_STATE = {
  fase:          "inactivo" as FlashFase,
  valor:         0,      // envolvente 0–1 (1 = blanco total)
  opacidad:      0,      // valor × pico efectivo (lo que pinta el overlay)
  t0:            0,      // performance.now() del disparo
  tBajada:       0,      // performance.now() en que empezó la bajada
  pico:          1,      // pico efectivo (reduced-motion aplicado)
  subidaMs:      150,    // subida efectiva (reduced-motion aplicado)
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
    const d = DBG_FLASH.FLASH_BAJADA_MS;
    const k = d > 0 ? Math.min(1, (now - s.tBajada) / d) : 1;
    // ease-out cúbica: cae rápido al principio y se asienta suave
    s.valor = Math.pow(1 - k, 3);
    if (k >= 1) {
      s.valor = 0;
      s.fase = "inactivo";
      s.esperaTelon = false;
    }
  }

  s.opacidad = s.valor * s.pico;
}

// ── F3: luminancia final estimada en el centro de la pantalla en el pico ──────
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
  uScan: number, uLift: number, toneExposure: number,
): number {
  let reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* ok */ }
  const pico = Math.max(0, Math.min(1, DBG_FLASH.FLASH_PICO)) * (reduce ? DBG_FLASH.FLASH_RM_PICO_MULT : 1);
  const f    = Math.min(pico, DBG_FLASH.FLASH_CRT_MAX);              // uFlash en el pico
  const glow = 1 + DBG_FLASH.FLASH_GLOW;                             // r = 0
  const effScan = uScan + (Math.min(uScan, DBG_FLASH.FLASH_SCAN_MAX) - uScan) * f;
  const scanK   = 1 - effScan * 0.5;                                 // scanline media
  const cap     = 0.92 + (DBG_FLASH.FLASH_TOPE_LUM - 0.92) * f;
  const crt = (c: number, t: number) => Math.min((f * c * glow * scanK) * t + uLift, cap);
  const k = toneExposure * (1 + (DBG_FLASH.FLASH_EXPOSICION_MULT - 1) * pico) / 0.6;
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
  return 0.2126 * lin2srgb(or) + 0.7152 * lin2srgb(og) + 0.0722 * lin2srgb(ob);
}

/** F1: factor 0–1 para el boost de postproceso (proporcional al pico efectivo). */
export function flashBoost(): number {
  return FLASH_STATE.fase === "inactivo" ? 0 : FLASH_STATE.opacidad;
}
