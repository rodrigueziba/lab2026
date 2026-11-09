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

  let k = 1, up = 0, entra = false, alejado = false;
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
  return out;
}
