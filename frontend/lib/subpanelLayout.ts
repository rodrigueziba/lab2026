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
  // Z16: domo cercano (marco rígido de la cámara capturada; ángulos en ese marco)
  domo?: boolean;
  elevPanel?: number;   // elevación del panel en el marco (rad); los laterales van a la misma
  panelEscala?: number; // escala del panel para conservar su tamaño angular a DOMO_RADIO_M
  latW?: number; latH?: number;     // tamaño de HISTORIA / GALERÍA (m)
  fichaW?: number; fichaH?: number; // tamaño de FICHA (m)
  latDeg?: number;      // ancho angular efectivo de los laterales (°)
  lateralesEntran?: boolean;        // false = ni con DOMO_LAT_MIN_DEG entran (no se achica el panel)
  // Z18: domo esférico (todo en rad, en el marco capturado)
  esferico?: boolean;
  pYaw?: number; pPitch?: number; pAncho?: number; pAlto?: number;      // panel
  lYaw?: number; lPitch?: number; lAncho?: number; lAlto?: number;      // HISTORIA (−lYaw) / GALERÍA (+lYaw)
  fYaw?: number; fPitch?: number; fAncho?: number; fAlto?: number;      // FICHA
  sep?: number;
}

// tamaño de cada subpanel en px del mockup (canvas = × 2)
const HW = HISTORIA_SIZE.w / 2, HH = HISTORIA_SIZE.h / 2;
const GW = GALERIA_SIZE.w / 2,  GH = GALERIA_SIZE.h / 2;
const FW = FICHA_SIZE.w / 2,    FH = FICHA_SIZE.h / 2;

/** Punto de contenido (coordenadas normalizadas −1..1 por eje) → ¿visible tras el barrel?
 *  El CRT muestra en c_pantalla el contenido de c·(1 + curva·|c|²); se invierte por Newton. */
export function visible(xn: number, yn: number, curva: number, lim: number): boolean { // Z19: exportada
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
  out.concavo = false; out.esferico = false; // Z14 / Z18
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
  out.concavo = true; out.esferico = false; out.dLat = R; out.yaw = yaw; out.pitch = pitch;
  out.yawExt = yaw + aLH; out.angTop = topAll; out.angBot = bot;
  return out;
}

// ── Z16: domo cercano ─────────────────────────────────────────────────────────
/** Proyección de un punto (a, b) del plano de un elemento ubicado a yaw ψ (sobre el UP del
 *  marco) y pitch θ (sobre el RIGHT del marco) a radio R, mirando al ojo. Devuelve coords
 *  normalizadas de pantalla (−1..1) con la cámara alineada al marco. Sin allocations. */
const _pj = { x: 0, y: 0, ok: false };
function proyectar(psi: number, theta: number, a: number, b: number, R: number, t: number, aspect: number, panelYawOnly: boolean) {
  // punto en el marco del elemento: (a, b, −R); rotación: pitch θ (eje x) y luego yaw ψ (eje y)
  const x = a;
  let y = b, z = -R;
  if (!panelYawOnly) {                           // pitch sobre x: y' = y cosθ − z sinθ ; z' = y sinθ + z cosθ
    const c = Math.cos(theta), s = Math.sin(theta);
    const y2 = y * c - z * s, z2 = y * s + z * c; y = y2; z = z2;
  } else {                                       // laterales: solo se traslada en elevación (arriba = UP del marco)
    y += R * Math.tan(theta);                    // centro a la elevación θ, plano vertical en el marco
  }
  const c2 = Math.cos(psi), s2 = Math.sin(psi);  // yaw sobre y: x' = x cosψ + z sinψ ; z' = −x sinψ + z cosψ
  const x2 = x * c2 + z * s2, z3 = -x * s2 + z * c2;
  _pj.ok = z3 < -1e-3;
  _pj.x = _pj.ok ? (x2 / -z3) / (t * aspect) : 9;
  _pj.y = _pj.ok ? (y / -z3) / t : 9;
  return _pj;
}

/**
 * Z16: domo CERCANO a DOMO_RADIO_M del ojo, todo dimensionado por tamaño angular.
 * Panel: conserva el tamaño en pantalla de Z8 (ACERC_PANTALLA) → escala R/d. FICHA debajo,
 * laterales a ±yaw = media del panel + separación + media del lateral; si el borde exterior
 * pasa de DOMO_YAW_MAX_DEG o no se ve (margen + curvatura CRT), se achican los laterales hasta
 * DOMO_LAT_MIN_DEG; el panel NO se achica (lateralesEntran = false avisa).
 */
export function calcularLayoutDomo(
  w: number, h: number, fovDeg: number, aspect: number, curva: number, out: LayoutBloque,
): LayoutBloque {
  const S = DBG_SUBPANELES;
  const D2R = Math.PI / 180;
  const t = Math.tan((fovDeg * D2R) / 2);
  const f = Math.min(1, Math.max(0.05, DBG_ACERC.ACERC_PANTALLA));
  const dZ8 = Math.max(h / (2 * f * t), w / (2 * f * t * aspect));   // distancia de Z8
  const R = Math.max(0.5, S.DOMO_RADIO_M);
  const esc = R / dZ8;                                                // conserva el tamaño angular
  const pw = w * esc, ph = h * esc;
  const aPH = Math.atan(pw / 2 / R), aPV = Math.atan(ph / 2 / R);
  const sep = Math.max(0, S.DOMO_SEP_DEG) * D2R;
  const lim = 1 - 2 * Math.min(0.3, Math.max(0, S.SUB_MARGEN_SEGURIDAD));
  const yawMax = Math.abs(S.DOMO_YAW_MAX_DEG) * D2R;

  // FICHA (ancho angular → metros) y encuadre vertical panel + FICHA centrado
  let fichaDeg = Math.max(5, S.DOMO_FICHA_DEG);
  let fw = 0, fh = 0, aFV = 0, ep = 0, pitchF = 0, top = 0, bot = 0, vertOk = false;
  for (let i = 0; i < 40; i++) {
    fw = 2 * R * Math.tan(fichaDeg * D2R / 2);
    fh = fw * (FH / FW);
    aFV = Math.atan(fh / 2 / R);
    ep = aFV + sep / 2;                              // centra el bloque vertical (panel arriba, FICHA abajo)
    pitchF = ep - aPV - sep - aFV;
    top = ep + aPV; bot = pitchF - aFV;
    vertOk = true;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      // vertical en el marco (arriba = UP): sin keystone; centro a la elevación ep / pitchF a radio R
      const p = proyectar(0, ep, sx * pw / 2, sy * ph / 2, R * Math.cos(ep), t, aspect, true);
      if (!p.ok || !visible(p.x, p.y, curva, lim)) vertOk = false;
      const q = proyectar(0, pitchF, sx * fw / 2, sy * fh / 2, R * Math.cos(pitchF), t, aspect, true);
      if (!q.ok || !visible(q.x, q.y, curva, lim)) vertOk = false;
    }
    if (vertOk || fichaDeg <= 20) break;
    fichaDeg -= 1;                                   // primero se achica FICHA (el panel no)
  }

  // laterales: a la elevación del panel, verticales en el marco (arriba = UP), mirando al ojo en yaw
  const latMin = Math.max(5, S.DOMO_LAT_MIN_DEG);
  let latDeg = Math.max(latMin, S.DOMO_LAT_DEG);
  let lw = 0, lh = 0, yaw = 0, ok = false;
  for (let i = 0; i < 80; i++) {
    lw = 2 * R * Math.tan(latDeg * D2R / 2);
    lh = lw * (HH / HW);
    const aL = latDeg * D2R / 2;
    yaw = aPH + sep + aL;
    ok = yaw + aL <= yawMax;
    if (ok) for (const sg of [-1, 1]) for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      // plano rotado solo en yaw: su punto (a, b) en el marco; elevación del centro = ep
      const p = proyectar(sg * yaw, ep, sx * lw / 2, sy * lh / 2, R * Math.cos(ep), t, aspect, true);
      if (!p.ok || !visible(p.x, p.y, curva, lim)) ok = false;
    }
    if (ok || latDeg <= latMin) break;
    latDeg = Math.max(latMin, latDeg - 0.5);
  }
  const aLV = Math.atan(lh / 2 / R);
  out.domo = true; out.concavo = true; out.esferico = false;
  out.k = latDeg / Math.max(1e-3, S.DOMO_LAT_DEG);   // escala relativa (solo debug)
  out.d = R; out.dLat = R; out.up = 0; out.alejado = false;
  out.entra = vertOk && ok; out.lateralesEntran = ok;
  out.medioAncho = pw / 2; out.medioAlto = ph / 2;
  out.elevPanel = ep; out.panelEscala = esc;
  out.latW = lw; out.latH = lh; out.fichaW = fw; out.fichaH = fh; out.latDeg = latDeg;
  out.yaw = yaw; out.pitch = pitchF;
  out.yawExt = yaw + latDeg * D2R / 2;
  out.angTop = Math.max(top, ep + aLV); out.angBot = Math.min(bot, ep - aLV);
  return out;
}

// ── Z18: domo ESFÉRICO ────────────────────────────────────────────────────────
/** ¿Se ve (con margen y curvatura CRT) la dirección (yaw, pitch) del marco con la cámara alineada? */
function dirVisible(yaw: number, pitch: number, t: number, aspect: number, curva: number, lim: number): boolean {
  const cp = Math.cos(pitch);
  const x = cp * Math.sin(yaw), y = Math.sin(pitch), z = -cp * Math.cos(yaw);
  if (z > -1e-3) return false;
  return visible((x / -z) / (t * aspect), (y / -z) / t, curva, lim);
}
/** Borde de un parche (esquinas + puntos medios de cada lado) visible. Sin allocations. */
function parcheVisible(yc: number, pc: number, w: number, h: number, t: number, aspect: number, curva: number, lim: number): boolean {
  for (let i = 0; i <= 4; i++) {
    const fu = i / 4 - 0.5;
    if (!dirVisible(yc + fu * w, pc + h / 2, t, aspect, curva, lim)) return false;
    if (!dirVisible(yc + fu * w, pc - h / 2, t, aspect, curva, lim)) return false;
    if (!dirVisible(yc - w / 2, pc + fu * h, t, aspect, curva, lim)) return false;
    if (!dirVisible(yc + w / 2, pc + fu * h, t, aspect, curva, lim)) return false;
  }
  return true;
}

/**
 * Z18: layout del domo esférico (parches de esfera de radio DOMO_RADIO_M alrededor del ojo).
 * Panel: por defecto conserva el tamaño angular de Z8 (ACERC_PANTALLA). Laterales a yaw
 * ±max(ESF_LAT_YAW, panel/2 + sep + lateral/2); si el borde exterior pasa de ESF_YAW_MAX o no
 * se ve, se angostan hasta DOMO_LAT_MIN_DEG. FICHA debajo del panel a sep; si no entra en el
 * encuadre (margen + curvatura CRT), se sube el conjunto (pitch del panel) de a 0,5°.
 */
export function calcularLayoutEsferico(
  w: number, h: number, fovDeg: number, aspect: number, curva: number, out: LayoutBloque,
): LayoutBloque {
  const S = DBG_SUBPANELES;
  const D2R = Math.PI / 180;
  const t = Math.tan((fovDeg * D2R) / 2);
  const f = Math.min(1, Math.max(0.05, DBG_ACERC.ACERC_PANTALLA));
  const dZ8 = Math.max(h / (2 * f * t), w / (2 * f * t * aspect));
  const R = Math.max(0.5, S.DOMO_RADIO_M);
  const lim = 1 - 2 * Math.min(0.3, Math.max(0, S.SUB_MARGEN_SEGURIDAD));
  const pA = S.ESF_PANEL_CONSERVAR_Z8 ? 2 * Math.atan(w / 2 / dZ8) : S.ESF_PANEL_ANCHO_DEG * D2R;
  const pH = S.ESF_PANEL_CONSERVAR_Z8 ? 2 * Math.atan(h / 2 / dZ8) : S.ESF_PANEL_ALTO_DEG * D2R;
  const sep = Math.max(0, S.ESF_SEP_DEG) * D2R;
  const fA = S.ESF_FICHA_ANCHO_DEG * D2R, fH = S.ESF_FICHA_ALTO_DEG * D2R;
  const lH = S.ESF_LAT_ALTO_DEG * D2R;
  const yawMax = Math.abs(S.ESF_YAW_MAX_DEG) * D2R;
  const lMin = Math.max(5, S.DOMO_LAT_MIN_DEG) * D2R;

  // vertical: panel a ESF_PANEL_PITCH; FICHA debajo; si no entra, se sube (luego se baja si sobra arriba)
  let pP = S.ESF_PANEL_PITCH_DEG * D2R, pF = 0, vertOk = false;
  for (let i = 0; i < 120; i++) {
    pF = pP - (pH / 2 + sep + fH / 2);
    const okP = parcheVisible(0, pP, pA, pH, t, aspect, curva, lim);
    const okF = parcheVisible(0, pF, fA, fH, t, aspect, curva, lim);
    vertOk = okP && okF;
    if (vertOk) break;
    pP += okF ? -0.5 * D2R : 0.5 * D2R;            // FICHA cortada → subir; panel cortado → bajar
  }
  // laterales
  let lA = Math.max(lMin, S.ESF_LAT_ANCHO_DEG * D2R), lY = 0, latOk = false;
  for (let i = 0; i < 200; i++) {
    lY = Math.max(S.ESF_LAT_YAW_DEG * D2R, pA / 2 + sep + lA / 2);
    latOk = lY + lA / 2 <= yawMax
      && parcheVisible(lY, pP, lA, lH, t, aspect, curva, lim)
      && parcheVisible(-lY, pP, lA, lH, t, aspect, curva, lim);
    if (latOk || lA <= lMin) break;
    lA = Math.max(lMin, lA - 0.25 * D2R);
  }
  out.esferico = true; out.domo = true; out.concavo = true;
  out.pYaw = 0; out.pPitch = pP; out.pAncho = pA; out.pAlto = pH;
  out.lYaw = lY; out.lPitch = pP; out.lAncho = lA; out.lAlto = lH;
  out.fYaw = 0; out.fPitch = pF; out.fAncho = fA; out.fAlto = fH;
  out.sep = sep;
  // campos que usan linterna / cierre / Z10 / debug
  out.d = R; out.dLat = R; out.up = 0; out.alejado = false; out.k = lA / (S.ESF_LAT_ANCHO_DEG * D2R);
  out.entra = vertOk && latOk; out.lateralesEntran = latOk;
  out.elevPanel = pP; out.panelEscala = S.ESF_PANEL_CONSERVAR_Z8 ? R / dZ8 : (R * Math.tan(pA / 2)) / (w / 2);
  out.medioAncho = R * Math.tan(pA / 2); out.medioAlto = R * Math.tan(pH / 2);
  out.yaw = lY; out.pitch = pF; out.latDeg = lA / D2R;
  out.yawExt = lY + lA / 2;
  out.angTop = Math.max(pP + pH / 2, pP + lH / 2);
  out.angBot = Math.min(pF - fH / 2, pP - lH / 2);
  return out;
}
