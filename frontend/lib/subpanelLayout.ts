// Z9: layout del panel acercado (Z8) + HISTORIA / GALERÍA / FICHA (Z4) como UN bloque.
// Calcula escala de los subpaneles, distancia del panel y desplazamiento vertical para que
// el bloque quede centrado en pantalla y completo dentro del viewport, contando:
//   - FOV vertical y aspecto reales de la cámara,
//   - margen de seguridad por lado,
//   - la curvatura (barrel) del pase CRT, que recorta los bordes de la imagen.
// Matemática pura sobre un objeto de salida reutilizado: sin allocations.

import { DBG_ACERC, DBG_SUBPANELES } from "@/lib/debugConfig";
import { HISTORIA_SIZE, GALERIA_SIZE, FICHA_SIZE } from "@/lib/retro/subpanelCanvas";

export interface LayoutBloque {
  k: number;        // escala de subpaneles y separaciones (1 = mockup)
  d: number;        // distancia cámara → panel (m)
  up: number;       // desplazamiento del panel sobre el "arriba" de la cámara (m), centra el bloque
  alejado: boolean; // true si con la escala mínima no entraba y se alejó el bloque
  entra: boolean;   // true si el resultado entra completo
  medioAncho: number; // Z10: semiancho del bloque en el plano del panel (m)
  medioAlto: number;  // Z10: semialto del bloque (centrado en pantalla) (m)
  // Z14: disposición cóncava (solo si concavo = true)
  concavo?: boolean;
  dLat?: number;      // distancia ojo → subpaneles (m)
  yaw?: number;       // yaw del centro de HISTORIA (+) / GALERÍA (−) respecto del panel (rad)
  pitch?: number;     // pitch del centro de FICHA respecto del panel (rad, negativo = abajo)
  yawExt?: number;    // yaw del borde exterior de los laterales (rad)
  angTop?: number;    // elevación del borde superior del conjunto respecto de la mira del disparo (rad)
  angBot?: number;    // ídem borde inferior (rad, negativo)
}

// tamaño de cada subpanel en px del mockup (canvas = × 2)
const HW = HISTORIA_SIZE.w / 2, HH = HISTORIA_SIZE.h / 2;
const GW = GALERIA_SIZE.w / 2,  GH = GALERIA_SIZE.h / 2;
const FW = FICHA_SIZE.w / 2,    FH = FICHA_SIZE.h / 2;

/** Punto de contenido (coordenadas normalizadas −1..1 por eje) → ¿visible tras el barrel?
 *  El CRT muestra en c_pantalla el contenido de c·(1 + curva·|c|²); se invierte por Newton. */
function visible(xn: number, yn: number, curva: number, lim: number): boolean {
  const r = Math.hypot(xn, yn);
  let s = 1;
  if (curva > 0 && r > 1e-6) {
    let rs = r;
    for (let i = 0; i < 6; i++) rs -= (rs + curva * rs * rs * rs - r) / (1 + 3 * curva * rs * rs);
    s = rs / r;
  }
  return Math.abs(xn * s) <= lim && Math.abs(yn * s) <= lim;
}

/**
 * Z9: resuelve el bloque. `w`,`h` = panel (m); fov vertical en grados; aspect = ancho/alto;
 * `curva` = uCurve del CRT (0 si el post-proceso está apagado). Escribe en `out`.
 */
export function calcularLayoutBloque(
  w: number, h: number, fovDeg: number, aspect: number, curva: number, out: LayoutBloque,
): LayoutBloque {
  const S = DBG_SUBPANELES;
  const t = Math.tan((fovDeg * Math.PI) / 180 / 2);
  const f = Math.min(1, Math.max(0.05, DBG_ACERC.ACERC_PANTALLA));
  // distancia base de Z8: el panel ocupa ≤ ACERC_PANTALLA del ancho y del alto
  let d = Math.max(h / (2 * f * t), w / (2 * f * t * aspect));
  const rel = w / 5.4;                                 // medidas de Z4 calibradas para 5,4 m
  const m0 = S.SUB_M_POR_PX * rel;
  const gL0 = S.SUB_GAP_LATERAL_M * rel, gA0 = S.SUB_GAP_ABAJO_M * rel;
  const adel = S.SUB_ADELANTE_M;
  const lim = 1 - 2 * Math.min(0.3, Math.max(0, S.SUB_MARGEN_SEGURIDAD)); // margen por lado
  const kMin = Math.min(1, Math.max(0.1, S.SUB_ESCALA_MIN));
  const px = w / 2, py = h / 2;

  let k = 1, up = 0, entra = false, alejado = false, medioAncho = px, medioAlto = py;
  for (let iter = 0; iter < 80; iter++) {
    const hw = HW * m0 * k, hh = HH * m0 * k, gw = GW * m0 * k, gh = GH * m0 * k;
    const fw = FW * m0 * k, fh = FH * m0 * k, gL = gL0 * k, gA = gA0 * k;
    const top = Math.max(py, hh / 2, gh / 2);
    const bottom = py + gA + fh;
    up = (bottom - top) / 2;                            // centra el bloque verticalmente
    // semiextensiones del viewport en cada plano (panel a d, subpaneles a d − adelante)
    const yP = d * t, xP = yP * aspect;
    const dS = Math.max(0.1, d - adel);
    const yS = dS * t, xS = yS * aspect;
    const xL = px + gL + Math.max(hw, gw);              // borde exterior de HISTORIA / GALERÍA
    medioAncho = Math.max(xL, fw / 2); medioAlto = (top + bottom) / 2;
    entra =
      visible(px / xP, (up + py) / yP, curva, lim) &&
      visible(px / xP, (up - py) / yP, curva, lim) &&
      visible(xL / xS, (up + Math.max(hh, gh) / 2) / yS, curva, lim) &&
      visible(xL / xS, (up - Math.max(hh, gh) / 2) / yS, curva, lim) &&
      visible((fw / 2) / xS, (up - bottom) / yS, curva, lim);
    if (entra) break;
    if (k > kMin) k = Math.max(kMin, k * 0.97);         // primero se achican los subpaneles
    else { d *= 1.04; alejado = true; }                 // con la escala mínima: se aleja el bloque
  }
  out.k = k; out.d = d; out.up = up; out.alejado = alejado; out.entra = entra;
  out.medioAncho = medioAncho; out.medioAlto = medioAlto;
  out.concavo = false; // Z14
  return out;
}

/**
 * Z14: layout CÓNCAVO alrededor del ojo. Panel al frente a d (Z8/Z9); HISTORIA / GALERÍA a
 * ±yaw (giro sobre la vertical del mundo, como gira la cámara) a dLat = d × factor; FICHA a
 * `pitch` debajo, mirando al ojo. Panel + FICHA se encuadran verticalmente (centrados, con
 * margen y curvatura CRT como Z9); los laterales deben verse completos al girar y su borde
 * exterior no pasar de SUB_YAW_MAX_DEG. yaw/pitch se agrandan lo mínimo para no superponerse;
 * si no entra, se reduce la escala de subpaneles (hasta SUB_ESCALA_MIN) y luego se aleja.
 * `elevMira` = elevación de la mira del disparo en el mundo (rad).
 */
export function calcularLayoutConcavo(
  w: number, h: number, fovDeg: number, aspect: number, curva: number, elevMira: number, out: LayoutBloque,
): LayoutBloque {
  const S = DBG_SUBPANELES;
  const R2D = Math.PI / 180;
  const t = Math.tan((fovDeg * R2D) / 2);
  const f = Math.min(1, Math.max(0.05, DBG_ACERC.ACERC_PANTALLA));
  let d = Math.max(h / (2 * f * t), w / (2 * f * t * aspect));
  const rel = w / 5.4;
  const m0 = S.SUB_M_POR_PX * rel;
  const gL0 = S.SUB_GAP_LATERAL_M * rel, gA0 = S.SUB_GAP_ABAJO_M * rel;
  const lim = 1 - 2 * Math.min(0.3, Math.max(0, S.SUB_MARGEN_SEGURIDAD));
  const kMin = Math.min(1, Math.max(0.1, S.SUB_ESCALA_MIN));
  const fac = Math.max(0.3, S.SUB_DIST_FACTOR);
  const yawCfg = Math.abs(S.SUB_YAW_DEG) * R2D, yawMax = Math.abs(S.SUB_YAW_MAX_DEG) * R2D;
  const pitchCfg = Math.abs(S.SUB_PITCH_FICHA_DEG) * R2D;
  const px = w / 2, py = h / 2;

  let k = 1, entra = false, alejado = false;
  let yaw = yawCfg, pitch = -pitchCfg, ep = 0, aLH = 0, topAll = 0, bot = 0, R = d;
  for (let iter = 0; iter < 120; iter++) {
    const m = m0 * k;
    const hw = 435 * m, hh = 410 * m, fw = 560 * m, fh = 262 * m;   // mockup px (canvas / 2)
    const gL = gL0 * k, gA = gA0 * k;
    R = d * fac;
    // vertical: panel ± aPV, FICHA a `pitch` con ± aFV; sin superposición
    const aPV = Math.atan(py / d), aFV = Math.atan(fh / 2 / R);
    pitch = -Math.max(pitchCfg, aPV + Math.atan(gA / d) + aFV);
    ep = (aFV - aPV - pitch) / 2;                    // elevación del panel que centra panel+FICHA
    const top = ep + aPV; bot = ep + pitch - aFV;
    // horizontal: el giro es sobre la vertical del mundo → radio horizontal = R·cos(elevación)
    const cosE = Math.max(0.2, Math.cos(elevMira + ep));
    const aPH = Math.atan(px / (d * cosE));
    aLH = Math.atan(hw / 2 / (R * cosE));
    const gH = Math.atan(gL / (d * cosE));
    yaw = Math.max(yawCfg, aPH + gH + aLH);
    const aLV = Math.atan(hh / 2 / R);
    topAll = Math.max(top, ep + aLV);
    const botAll = Math.min(bot, ep - aLV);
    entra =
      yaw + aLH <= yawMax &&
      visible((px / d) / (t * aspect), Math.tan(top) / t, curva, lim) &&            // esquinas sup. del panel
      visible((fw / 2 / R) / (t * aspect), Math.tan(bot) / t, curva, lim) &&        // esquinas inf. de FICHA
      // laterales al girar hasta ellos: centrados en x, misma elevación que el panel
      visible((hw / 2 / R) / (t * aspect), Math.tan(ep + aLV) / t, curva, lim) &&
      visible((hw / 2 / R) / (t * aspect), Math.tan(ep - aLV) / t, curva, lim);
    if (entra) { bot = botAll; break; }
    if (k > kMin) k = Math.max(kMin, k * 0.97);
    else { d *= 1.04; alejado = true; }
  }
  out.k = k; out.d = d; out.up = d * Math.tan(ep); out.alejado = alejado; out.entra = entra;
  out.medioAncho = px; out.medioAlto = py;
  out.concavo = true; out.dLat = R; out.yaw = yaw; out.pitch = pitch;
  out.yawExt = yaw + aLH; out.angTop = topAll; out.angBot = bot;
  return out;
}
