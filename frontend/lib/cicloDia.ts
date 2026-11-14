// Z48: CICLO DE DÍA (amanecer, mediodía, atardecer, noche) atado a la duración del tema, con una introducción
// lenta de amanecer. Puro y sin imports (se prueba en Node: scripts/ciclo-dia-test.mjs). Lo avanza
// AmanecerReloj una vez por frame con el dt de la experiencia (se congela con la pausa); lo leen DomeSky
// (cielo, sol, estrellas, montañas), CicloDiaEscena (fondo, niebla, hemisférica, ambiente), RetroPostFX
// (exposición) y CieloEstrellado (estrellas de la sala). Sin allocations por frame (escribe en DIA).
//
// tDia: 0 noche cerrada · ALBA (0,12) primeras luces · SALIDA (0,20) sale el sol · MEDIODIA (0,50) ·
//       ATARDECER (0,80) se pone el sol · CREPUSCULO (0,92) · 1 noche (= 0, el ciclo es continuo).
// Reloj del día: t = s desde que empezó el día. Los primeros INTRO_S s son la introducción (tDia de 0 a
// INTRO_TDIA_FIN por tramos: montañas → primeras luces → sale el sol → resto); el resto del tema recorre
// INTRO_TDIA_FIN → 1 en línea recta. Duración del día = duración del tema (o DURACION_FALLBACK_S).
// La introducción reemplaza a la fase 1 de la máquina única (lib/amanecer.ts): la arranca el mismo disparo
// (AMANECER.pendiente, primer haz), y al terminarla la máquina pasa a "completo" y se emite dawn-complete.

export type Rgb = [number, number, number];
export type FaseDia = "espera" | "intro" | "dia" | "fin";
export type EtapaNombre = "noche" | "alba" | "amanecer" | "dia" | "atardecer" | "crepusculo";

export interface EtapaCfg {
  hor: string; med: string; cen: string; glow: string;          // cielo (sRGB, como el shader del domo)
  fondo: string; niebla: string; hemiCielo: string; hemiSuelo: string;
  luz: number; estrellas: number; brilloSol: number; hemiInt: number; ambInt: number; expo: number;
}

export interface CfgDia {
  NUEVO: boolean; INTRO_S: number; DURACION_FALLBACK_S: number; SINCRONIZAR_CON_TEMA: boolean; LOOP: boolean;
  T_MANUAL: number; VELOCIDAD: number; DIA_MIN_S: number; RESINCRO_MIN_S: number;
  KEYS: { ALBA: number; SALIDA: number; MEDIODIA: number; ATARDECER: number; CREPUSCULO: number };
  ETAPAS: { noche: EtapaCfg; alba: EtapaCfg; salida: EtapaCfg; mediodia: EtapaCfg; atardecer: EtapaCfg; crepusculo: EtapaCfg };
  SOL_AZ_SALIDA_DEG: number; SOL_ALT_MAX_DEG: number;
  // Z49: sol sobre el eje del portal
  SOL_ALINEAR_PORTAL: boolean; SOL_AZ_OFFSET_DEG: number; SOL_VERTICAL_FASE: number; SOL_UNICO: boolean;
  SOL_EJE_HASTA_ELEV_DEG: number;   // Z50: azimut EXACTO del centro del portal hasta esta altura (< 0 = modo Z49)
  SOL_RECORRIDO: string;            // Z51: "eje" (default) · "meridiano" · "arco" (Z48–Z50)
  INTRO_U_ALBA: number; INTRO_U_SOL: number; INTRO_TDIA_SOL: number; INTRO_TDIA_FIN: number;
  INTRO_MONT_FIN: number; INTRO_RESTO_INI: number; INTRO_RESTO_PASO: number; INTRO_RESTO_DUR: number;
  MUSICA_SOL: number; MUSICA_NUBES: number;
}

/** Lo que la máquina única del amanecer expone (lib/amanecer.ts → AMANECER), sin importarla. */
export interface AmanecerLike { fase: "inactivo" | "amanecer" | "completo"; pendiente: boolean; t: number; p1: number; tFin: number }
export const SKIP_TFIN = 9999;   // = SKIP_TFIN_S de lib/amanecer.ts (skipAmanecer)

export interface EstadoDia {
  fase: FaseDia;
  t: number;            // s desde el inicio del día actual (tiempo de experiencia × VELOCIDAD)
  dur: number;          // duración del día (s)
  dia: number;          // tDia 0…1
  intro: number;        // progreso de la introducción 0…1 (1 después)
  introHecha: boolean;  // la introducción ya terminó alguna vez (los elementos quedan revelados)
  temaId: number;       // tema con el que empezó el día
  tReinicio: number;    // t en que se reinició por última vez (para no reiniciar dos veces por el mismo tema)
  ciclos: number;
  // revelado de la introducción (0…1)
  montCrece: number; revPortal: number; revOlas: number; revAnillos: number; revCielo: number;
  // estado del cielo
  hor: Rgb; med: Rgb; cen: Rgb; glow: Rgb; fondo: Rgb; niebla: Rgb; hemiCielo: Rgb; hemiSuelo: Rgb;
  luz: number; estrellas: number; brilloSol: number; hemiInt: number; ambInt: number; expo: number;
  solDir: Rgb; solAlt: number; solAz: number; etapa: EtapaNombre;
  azSalida: number;     // Z49: azimut de la salida del sol (rad, convención del domo) — centro del crecimiento de montañas
  solUnico: number;     // Z49: 0…1 atenuación del sol ilustrado del portal (SOL_UNICO)
  // ganchos de música (0 con ganancia 0)
  solPulso: number; nubesBrillo: number;
  // eventos de este frame (los emite quien llama)
  evDawn: boolean; evFin: boolean; evReinicio: boolean;
  escena: boolean;      // CicloDiaEscena montado (fondo, niebla y luces siguen el ciclo)
}

const rgb = (): Rgb => [0, 0, 0];
export function crearEstadoDia(): EstadoDia {
  return {
    fase: "espera", t: 0, dur: 180, dia: 0, intro: 0, introHecha: false, temaId: -1, tReinicio: 0, ciclos: 0,
    montCrece: 0, revPortal: 0, revOlas: 0, revAnillos: 0, revCielo: 0,
    hor: rgb(), med: rgb(), cen: rgb(), glow: rgb(), fondo: rgb(), niebla: rgb(), hemiCielo: rgb(), hemiSuelo: rgb(),
    luz: 0, estrellas: 1, brilloSol: 0, hemiInt: 0, ambInt: 0, expo: 1,
    solDir: [0, -1, 0], solAlt: 0, solAz: 0, etapa: "noche", azSalida: 0, solUnico: 0,
    solPulso: 0, nubesBrillo: 0, evDawn: false, evFin: false, evReinicio: false, escena: false,
  };
}

/** Z49: geometría del portal que escribe DomeSky. Z50: azRad = azimut del CENTRO DEL CÍRCULO (cDir del shader,
 *  lib/portalEscala.ts → centroPortal), no la dirección F (PORTAL_C lo corre ~2°); elevRad = su altura.
 *  NaN hasta que el domo se monta: entonces vale SOL_AZ_SALIDA_DEG. */
export const PORTAL_GEOM = { azRad: NaN, elevRad: NaN };

/** Azimut de la salida del sol (rad): el del portal + SOL_AZ_OFFSET_DEG, o SOL_AZ_SALIDA_DEG (Z48). */
export function azimutSalida(c: CfgDia): number {
  const portal = PORTAL_GEOM.azRad;
  if (c.SOL_ALINEAR_PORTAL && Number.isFinite(portal)) return portal + (fin(c.SOL_AZ_OFFSET_DEG) * Math.PI) / 180;
  return (fin(c.SOL_AZ_SALIDA_DEG, 120) * Math.PI) / 180;
}

/** Estado compartido (lo escribe AmanecerReloj y lo leen los consumidores). */
export const DIA: EstadoDia = crearEstadoDia();

const sat = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const fin = (x: number, d = 0): number => (Number.isFinite(x) ? x : d);
const suave = (x: number): number => { const u = sat(x); return u * u * (3 - 2 * u); };

// ── colores: "#RRGGBB" → [0…1] con caché por texto (se parsea solo cuando cambia) ──
const _cache = new Map<string, Rgb>();
export function hexARgb(hex: string): Rgb {
  let c = _cache.get(hex);
  if (!c) {
    const h = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    const n = h ? parseInt(h[1], 16) : 0;
    c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    _cache.set(hex, c);
  }
  return c;
}
function mezclaRgb(out: Rgb, a: string, b: string, f: number): void {
  const x = hexARgb(a), y = hexARgb(b);
  out[0] = x[0] + (y[0] - x[0]) * f; out[1] = x[1] + (y[1] - x[1]) * f; out[2] = x[2] + (y[2] - x[2]) * f;
}

// ── tiempo → tDia ──
/** Introducción: tDia por tramos lineales (0,0) → (U_ALBA, ALBA) → (U_SOL, TDIA_SOL) → (1, TDIA_FIN). */
export function tDiaIntro(u: number, c: CfgDia): number {
  const x = sat(u);
  const ua = sat(c.INTRO_U_ALBA), us = Math.max(ua + 1e-3, Math.min(1 - 1e-3, c.INTRO_U_SOL));
  if (x <= ua) return ua > 0 ? (x / ua) * c.KEYS.ALBA : c.KEYS.ALBA;
  if (x <= us) return c.KEYS.ALBA + ((x - ua) / (us - ua)) * (c.INTRO_TDIA_SOL - c.KEYS.ALBA);
  return c.INTRO_TDIA_SOL + ((x - us) / (1 - us)) * (c.INTRO_TDIA_FIN - c.INTRO_TDIA_SOL);
}
/** Duración del tramo posterior a la introducción. */
export function restoS(dur: number, c: CfgDia): number {
  return Math.max(Math.max(1, c.DIA_MIN_S), dur - Math.max(0, c.INTRO_S));
}
/** Largo total del día (s). */
export function largoDia(dur: number, c: CfgDia): number { return Math.max(0, c.INTRO_S) + restoS(dur, c); }
export function tDiaDesdeT(t: number, dur: number, c: CfgDia): number {
  const I = Math.max(0, c.INTRO_S);
  if (t < I) return tDiaIntro(t / Math.max(1e-3, I), c);
  return Math.min(1, c.INTRO_TDIA_FIN + ((t - I) / restoS(dur, c)) * (1 - c.INTRO_TDIA_FIN));
}
/** Inversa (checkpoints): t en el que se alcanza tDia = x (después de la introducción si x ≥ INTRO_TDIA_FIN). */
export function tDesdeTDia(x: number, dur: number, c: CfgDia): number {
  const I = Math.max(0, c.INTRO_S);
  const v = sat(x);
  if (v >= c.INTRO_TDIA_FIN) return I + ((v - c.INTRO_TDIA_FIN) / Math.max(1e-6, 1 - c.INTRO_TDIA_FIN)) * restoS(dur, c);
  // dentro de la introducción: búsqueda por bisección sobre la función monótona
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (tDiaIntro(m, c) < v) lo = m; else hi = m; }
  return hi * I;
}

// ── estado del cielo a partir de tDia ──
const _ETAPAS: (keyof CfgDia["ETAPAS"])[] = ["noche", "alba", "salida", "mediodia", "atardecer", "crepusculo", "noche"];
const _pts = [0, 0, 0, 0, 0, 0, 1];

export function nombreEtapa(dia: number, c: CfgDia): EtapaNombre {
  const K = c.KEYS;
  if (dia < K.ALBA * 0.5 || dia >= 1 - (1 - K.CREPUSCULO) * 0.5) return "noche";
  if (dia < K.SALIDA) return "alba";
  if (dia < (K.SALIDA + K.MEDIODIA) / 2) return "amanecer";
  if (dia < (K.MEDIODIA + K.ATARDECER) / 2) return "dia";
  if (dia < K.CREPUSCULO) return "atardecer";
  return "crepusculo";
}

/** Escribe en out el estado del cielo para tDia (interpolación suave entre etapas; sin allocations). */
export function estadoCielo(dia: number, c: CfgDia, out: EstadoDia): EstadoDia {
  const d = sat(fin(dia));
  const K = c.KEYS;
  _pts[1] = K.ALBA; _pts[2] = K.SALIDA; _pts[3] = K.MEDIODIA; _pts[4] = K.ATARDECER; _pts[5] = K.CREPUSCULO;
  let i = 0;
  while (i < 5 && d >= _pts[i + 1]) i++;
  const a0 = _pts[i], a1 = _pts[i + 1];
  const f = suave(a1 > a0 ? (d - a0) / (a1 - a0) : 1);
  const A = c.ETAPAS[_ETAPAS[i]], B = c.ETAPAS[_ETAPAS[i + 1]];
  mezclaRgb(out.hor, A.hor, B.hor, f); mezclaRgb(out.med, A.med, B.med, f); mezclaRgb(out.cen, A.cen, B.cen, f);
  mezclaRgb(out.glow, A.glow, B.glow, f); mezclaRgb(out.fondo, A.fondo, B.fondo, f); mezclaRgb(out.niebla, A.niebla, B.niebla, f);
  mezclaRgb(out.hemiCielo, A.hemiCielo, B.hemiCielo, f); mezclaRgb(out.hemiSuelo, A.hemiSuelo, B.hemiSuelo, f);
  out.luz = A.luz + (B.luz - A.luz) * f;
  out.estrellas = A.estrellas + (B.estrellas - A.estrellas) * f;
  out.brilloSol = A.brilloSol + (B.brilloSol - A.brilloSol) * f;
  out.hemiInt = A.hemiInt + (B.hemiInt - A.hemiInt) * f;
  out.ambInt = A.ambInt + (B.ambInt - A.ambInt) * f;
  out.expo = A.expo + (B.expo - A.expo) * f;
  // sol: arco de SALIDA a ATARDECER (altura 0 en los dos), por debajo del horizonte el resto; continuo en 1 → 0
  const span = Math.max(1e-3, K.ATARDECER - K.SALIDA);
  const fase = ((d - K.SALIDA) / span) * Math.PI;
  const altMax = (Math.max(1, Math.min(89, c.SOL_ALT_MAX_DEG)) * Math.PI) / 180;
  const alt = Math.asin(Math.sin(altMax) * Math.sin(fase));
  // azimut: media vuelta durante el día y la otra media durante la noche (continuo al cerrar el ciclo 1 → 0)
  const az0 = azimutSalida(c);
  const enDia = d >= K.SALIDA && d <= K.ATARDECER;
  const noche = (((d - K.ATARDECER) % 1) + 1) % 1 / Math.max(1e-3, 1 - span);
  let az: number;
  const ejeElev = fin(c.SOL_EJE_HASTA_ELEV_DEG, 35);
  if (c.SOL_ALINEAR_PORTAL && ejeElev >= 0) {
    // Z50: azimut EXACTO del centro del portal desde la medianoche (tDia 0) hasta que el sol pasa
    // SOL_EJE_HASTA_ELEV_DEG: sube en vertical por el eje, detrás de las montañas y cruzando la composición.
    // Después se abre con g(u) = u²(3 − 2u) (derivada 0 al empezar: sin quiebre) hasta la puesta (az0 + 180°).
    // De noche completa la otra media vuelta en la primera mitad de la noche (hasta tDia 0) y queda en az0.
    const sinE = Math.sin((Math.min(89, ejeElev) * Math.PI) / 180) / Math.max(1e-6, Math.sin(altMax));
    const faseEje = sinE >= 1 ? Math.PI / 2 : Math.asin(Math.max(0, sinE));
    if (enDia) {
      const u = fase <= faseEje ? 0 : (fase - faseEje) / Math.max(1e-6, Math.PI - faseEje);
      az = u <= 0 ? az0 : az0 + Math.PI * suave(u);
    } else {
      const giro = suave(Math.min(1, noche) / 0.5);   // 0 al ponerse → 1 en la mitad de la noche (tDia 0)
      az = giro >= 1 ? az0 : az0 + Math.PI + Math.PI * giro;
    }
  } else {
    // Z49 (SOL_EJE_HASTA_ELEV_DEG < 0): casi vertical con w = smoothstep(0, SOL_VERTICAL_FASE, fase)²; o Z48 sin alinear
    const fv = Math.max(1e-3, fin(c.SOL_VERTICAL_FASE, 1.0));
    const w = c.SOL_ALINEAR_PORTAL ? suave(fase / fv) ** 2 : 1;
    az = enDia ? az0 + fase * w : az0 + Math.PI + Math.PI * Math.min(1, noche);
  }
  // Z51: SOL_RECORRIDO. "eje": el azimut es SIEMPRE el del centro del portal (+ SOL_AZ_OFFSET_DEG) y solo cambia
  // la altura (misma curva asin(sin(ALT_MAX)·sin(fase)) del arco: 0 en SALIDA y ATARDECER, máximo al mediodía,
  // bajo el horizonte de noche y continua al cerrar el ciclo); sale y se pone detrás de la composición.
  // "meridiano": gran círculo vertical por el azimut del portal: sale por el portal, pasa por el cénit al mediodía
  // y se pone del lado opuesto (de noche completa la vuelta por debajo del horizonte). "arco": Z48–Z50.
  const modo = c.SOL_RECORRIDO === "meridiano" ? 1 : c.SOL_RECORRIDO === "arco" ? 2 : 0;
  if (modo !== 2) {
    const portal = PORTAL_GEOM.azRad;
    const azEje = Number.isFinite(portal) ? portal + (fin(c.SOL_AZ_OFFSET_DEG) * Math.PI) / 180 : az0;
    out.azSalida = azEje;
    if (modo === 0) {
      const ceE = Math.cos(alt);
      out.solDir[0] = Math.sin(azEje) * ceE; out.solDir[1] = Math.sin(alt); out.solDir[2] = -Math.cos(azEje) * ceE;
      out.solAlt = alt; out.solAz = azEje;
    } else {
      const th = enDia ? fase : Math.PI + Math.PI * Math.min(1, noche);   // ángulo sobre el gran círculo
      const hx = Math.sin(azEje), hz = -Math.cos(azEje), ct = Math.cos(th), st = Math.sin(th);
      out.solDir[0] = hx * ct; out.solDir[1] = st; out.solDir[2] = hz * ct;
      out.solAlt = Math.asin(Math.max(-1, Math.min(1, st)));
      out.solAz = ct >= 0 ? azEje : azEje + Math.PI;
    }
  }
  if (modo === 2) out.azSalida = az0;
  // Z49: SOL_UNICO — el sol ilustrado se funde a medida que sale el del mundo y queda atenuado hasta el crepúsculo
  out.solUnico = c.SOL_UNICO ? suave((d - (K.SALIDA - 0.01)) / 0.03) * (1 - suave((d - K.CREPUSCULO) / Math.max(1e-3, (1 - K.CREPUSCULO) * 0.6))) : 0;
  if (modo === 2) {
    const ce = Math.cos(alt);
    // convención del shader del domo: az = atan(d.x, −d.z)
    out.solDir[0] = Math.sin(az) * ce; out.solDir[1] = Math.sin(alt); out.solDir[2] = -Math.cos(az) * ce;
    out.solAlt = alt; out.solAz = az;
  }
  out.etapa = nombreEtapa(d, c);
  out.dia = d;
  return out;
}

function revelados(e: EstadoDia, c: CfgDia, u: number): void {
  const x = e.introHecha ? 1 : sat(u);
  e.montCrece = suave(x / Math.max(1e-3, c.INTRO_MONT_FIN));
  const ini = c.INTRO_RESTO_INI, paso = c.INTRO_RESTO_PASO, dur = Math.max(1e-3, c.INTRO_RESTO_DUR);
  e.revPortal = sat((x - ini) / dur);
  e.revOlas = sat((x - ini - paso) / dur);
  e.revAnillos = sat((x - ini - 2 * paso) / dur);
  e.revCielo = sat((x - ini - 3 * paso) / dur);
  if (x >= 1) { e.revPortal = e.revOlas = e.revAnillos = e.revCielo = 1; e.montCrece = 1; }
}

/** Duración del día según el tema (s), o el respaldo. */
export function duracionDia(durTema: number, c: CfgDia): number {
  const ok = c.SINCRONIZAR_CON_TEMA && Number.isFinite(durTema) && durTema > 1;
  return ok ? durTema : Math.max(1, fin(c.DURACION_FALLBACK_S, 180));
}

function terminarIntro(e: EstadoDia, am: AmanecerLike): void {
  e.introHecha = true;
  if (e.fase === "intro") e.fase = "dia";
  am.fase = "completo"; am.pendiente = false; am.p1 = 1; am.t = 0;
}

/**
 * Un frame. dt: tiempo de la experiencia (s). am: AMANECER (disparo, reset y skip de siempre).
 * durTema: duración del tema que suena (NaN si no se sabe); temaId: cambia cuando el tema cambia o se repite.
 */
export function avanzarDia(
  e: EstadoDia, c: CfgDia, dtBruto: number, pausado: boolean, am: AmanecerLike, durTema: number, temaId: number,
): EstadoDia {
  e.evDawn = false; e.evFin = false; e.evReinicio = false;
  if (!pausado) {
    // reset de la máquina (botón "Reiniciar amanecer", checkpoints) → espera
    if (e.fase !== "espera" && am.fase === "inactivo" && !am.pendiente) {
      e.fase = "espera"; e.t = 0; e.intro = 0; e.introHecha = false; e.ciclos = 0;
    }
    // disparo (primer haz)
    if (e.fase === "espera" && am.pendiente && am.fase === "inactivo") {
      am.pendiente = false; am.fase = "amanecer"; am.t = 0; am.p1 = 0; am.tFin = 0;
      e.fase = "intro"; e.t = 0; e.temaId = temaId; e.tReinicio = 0; e.dur = duracionDia(durTema, c);
    }
    // skip ("Saltar al final", checkpoint amanecer_completo): al final de la introducción, sin evento
    if (am.fase === "completo" && am.tFin >= SKIP_TFIN && (e.fase === "espera" || e.fase === "intro")) {
      if (e.fase === "espera") { e.temaId = temaId; e.dur = duracionDia(durTema, c); }
      e.fase = "intro"; e.t = Math.max(0, c.INTRO_S);
      terminarIntro(e, am); am.tFin = 0;
    }
    const dt = Math.min(0.25, Math.max(0, fin(dtBruto))) * Math.max(0, fin(c.VELOCIDAD, 1));
    if (e.fase === "intro" || e.fase === "dia") {
      if (e.fase === "intro") e.dur = duracionDia(durTema, c);   // la duración puede llegar tarde (metadata)
      e.t += dt;
      // cambio de tema (o repetición): reinicia el día con LOOP, salvo que recién se haya reiniciado
      if (temaId !== e.temaId) {
        const reciente = e.t - e.tReinicio < Math.max(0, c.RESINCRO_MIN_S) && e.ciclos > 0;
        e.temaId = temaId;
        if (c.LOOP && e.introHecha && !reciente) {
          e.t = 0; e.tReinicio = 0; e.ciclos++; e.evReinicio = true; e.dur = duracionDia(durTema, c);
        }
      }
      if (e.fase === "intro" && e.t >= c.INTRO_S) { terminarIntro(e, am); e.evDawn = true; }
      const L = largoDia(e.dur, c);
      if (e.t >= L) {
        e.evFin = true;
        if (c.LOOP) { e.t -= L; e.tReinicio = e.t; e.ciclos++; e.evReinicio = true; e.dur = duracionDia(durTema, c); }
        else { e.t = L; e.fase = "fin"; }
      }
      if (e.fase === "intro") am.p1 = Math.min(1, e.t / Math.max(1e-3, c.INTRO_S));
      else am.tFin = Math.max(0, e.t - c.INTRO_S);
    }
  }
  // salidas
  const manual = fin(c.T_MANUAL, -1);
  const dia = manual >= 0 ? Math.min(1, manual)
    : e.fase === "espera" ? 0
    : e.fase === "fin" ? 1
    : tDiaDesdeT(e.t, e.dur, c);
  e.intro = e.fase === "intro" ? Math.min(1, e.t / Math.max(1e-3, c.INTRO_S)) : e.fase === "espera" ? 0 : 1;
  revelados(e, c, manual >= 0 ? 1 : e.intro);
  estadoCielo(dia, c, e);
  return e;
}

/** Checkpoints dia_*: ubica el día en tDia = x (con la introducción terminada). */
export function posicionarDia(e: EstadoDia, c: CfgDia, x: number, am: AmanecerLike, durTema: number, temaId: number): void {
  if (e.fase === "espera") { e.temaId = temaId; e.dur = duracionDia(durTema, c); }
  e.fase = "dia";
  e.introHecha = true;
  e.t = tDesdeTDia(x, e.dur, c);
  e.tReinicio = e.t;
  am.fase = "completo"; am.pendiente = false; am.p1 = 1; am.tFin = Math.max(0, e.t - c.INTRO_S);
}

/** Ganchos de música para el visualizador futuro (ganancia 0 = sin efecto). */
export function ganchosMusica(e: EstadoDia, c: CfgDia, graves: number, medios: number): void {
  e.solPulso = Math.max(0, fin(c.MUSICA_SOL)) * sat(fin(graves));
  e.nubesBrillo = Math.max(0, fin(c.MUSICA_NUBES)) * sat(fin(medios));
}
