// Z71: crédito "An IN-GO'S WAN INC. Simulation" debajo del bloque del telón. Lógica PURA (sin imports), testeable
// en Node (scripts/telon-credito-test.mjs): posición a partir del bloque y línea de tiempo del efecto de foco.
//
// Foco: como una cámara que busca el foco. p = posición del foco (0 = enfocado, 1 = desenfoque máximo; negativo =
// pasado de foco hacia el otro lado). Nivel de desenfoque = |p|. Fases:
//   enfocado (MIN…MAX s al azar con semilla) → saliendo (SALIDA_S, smoothstep 0 → 1) → retenido (RETENCION_S)
//   → entrando (ENTRADA_S, 1 → −SOBREIMPULSO → 0) → enfocado …
// El avance de cada fase se integra con dt / duración (no con t − t0): cambiar una duración cambia el ritmo, no la
// posición (sin saltos). Usa el reloj de la experiencia (RELOJ.tExp): en pausa no avanza. Sin allocations.

export type FaseEnfoque = "enfocado" | "saliendo" | "retenido" | "entrando";
export interface CfgEnfoque {
  ENFOQUE_ACTIVO: boolean; ENFOQUE_INTERVALO_MIN_S: number; ENFOQUE_INTERVALO_MAX_S: number;
  ENFOQUE_SALIDA_S: number; ENFOQUE_RETENCION_S: number; ENFOQUE_ENTRADA_S: number; ENFOQUE_SOBREIMPULSO: number;
  SEMILLA: number;
}
export interface EstadoEnfoque {
  fase: FaseEnfoque; prog: number; durEnfocado: number;
  p: number; nivel: number; tUlt: number; azar: number; semilla: number;
  ciclos: number; cSobre: number; sobreCache: number;
}

const fin = (x: number, d = 0): number => (Number.isFinite(x) ? x : d);
const sat = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const suave = (x: number): number => { const u = sat(x); return u * u * (3 - 2 * u); };

/** mulberry32 sobre el estado (sin cierres ni allocations). Devuelve [0, 1). */
function azar(e: EstadoEnfoque): number {
  e.azar = (e.azar + 0x6d2b79f5) >>> 0;
  let t = e.azar;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function sortearEnfocado(e: EstadoEnfoque, c: CfgEnfoque): void {
  const a = Math.max(0.1, fin(c.ENFOQUE_INTERVALO_MIN_S, 3)), b = Math.max(a, fin(c.ENFOQUE_INTERVALO_MAX_S, 8));
  e.durEnfocado = a + (b - a) * azar(e);
}
export function crearEstadoEnfoque(semilla: number): EstadoEnfoque {
  const e: EstadoEnfoque = { fase: "enfocado", prog: 0, durEnfocado: 5, p: 0, nivel: 0, tUlt: -1, azar: 0, semilla: NaN, ciclos: 0, cSobre: -1, sobreCache: 0 };
  sembrar(e, semilla);
  return e;
}
export function sembrar(e: EstadoEnfoque, semilla: number): void {
  e.semilla = fin(semilla, 71);
  e.azar = (Math.round(e.semilla) * 2654435761) >>> 0;
}

/** Curva de vuelta al foco con sobreimpulso: f(x) = 1 + (c+1)(x−1)³ + c(x−1)² (easeOutBack generalizada); su máximo es
 *  1 + 4c³ / (27 (c+1)²). c se busca para que el máximo pase 1 en `sobre`. */
export function cSobreimpulso(sobre: number): number {
  const o = Math.max(0, Math.min(1, fin(sobre)));
  if (o <= 0) return 0;
  let a = 0, b = 60;
  for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if ((4 * m * m * m) / (27 * (m + 1) * (m + 1)) < o) a = m; else b = m; }
  return (a + b) / 2;
}
/** p durante la vuelta: 1 → −sobre → 0 (x de 0 a 1). La x pasa antes por un smoothstep: arranca con pendiente 0 (sin
 *  quiebre al salir de la retención) y conserva el mínimo exacto (−sobre). */
export function curvaEntrada(x: number, c: number): number {
  const u = suave(x) - 1;
  return 1 - (1 + (c + 1) * u * u * u + c * u * u);
}

/** Un frame. tExp: reloj de la experiencia (s). activo false → enfocado y quieto. */
export function avanzarEnfoque(e: EstadoEnfoque, c: CfgEnfoque, tExp: number, activo: boolean): EstadoEnfoque {
  if (fin(c.SEMILLA, 71) !== e.semilla) sembrar(e, c.SEMILLA);
  const t = fin(tExp);
  const dt = e.tUlt < 0 ? 0 : Math.max(0, Math.min(0.25, t - e.tUlt));   // en pausa tExp no avanza → dt 0
  e.tUlt = t;
  if (!activo || !c.ENFOQUE_ACTIVO) { e.fase = "enfocado"; e.prog = 0; e.p = 0; e.nivel = 0; return e; }
  if (e.cSobre !== c.ENFOQUE_SOBREIMPULSO) { e.cSobre = c.ENFOQUE_SOBREIMPULSO; e.sobreCache = cSobreimpulso(c.ENFOQUE_SOBREIMPULSO); }
  const dur = (x: number) => Math.max(0.02, fin(x, 0.5));
  let resto = dt;
  // varias fases pueden terminar en un mismo frame largo: se consume el tiempo sobrante (máx. 4 cambios)
  for (let k = 0; k < 4 && resto >= 0; k++) {
    const d = e.fase === "enfocado" ? e.durEnfocado : e.fase === "saliendo" ? dur(c.ENFOQUE_SALIDA_S)
      : e.fase === "retenido" ? dur(c.ENFOQUE_RETENCION_S) : dur(c.ENFOQUE_ENTRADA_S);
    const falta = (1 - e.prog) * d;
    if (resto < falta) { e.prog += resto / d; resto = -1; break; }
    resto -= falta;
    e.prog = 0;
    if (e.fase === "enfocado") e.fase = "saliendo";
    else if (e.fase === "saliendo") e.fase = "retenido";
    else if (e.fase === "retenido") e.fase = "entrando";
    else { e.fase = "enfocado"; e.ciclos++; sortearEnfocado(e, c); }
  }
  e.p = e.fase === "enfocado" ? 0 : e.fase === "saliendo" ? suave(e.prog) : e.fase === "retenido" ? 1 : curvaEntrada(e.prog, e.sobreCache);
  e.nivel = Math.abs(e.p);
  return e;
}
/** Botón "Forzar desenfoque ahora": empieza a desenfocarse desde donde está (sin salto si ya estaba saliendo). */
export function forzarDesenfoque(e: EstadoEnfoque): void {
  if (e.fase === "enfocado") { e.fase = "saliendo"; e.prog = 0; }
}
export function reiniciarEnfoque(e: EstadoEnfoque, c: CfgEnfoque): void {
  sembrar(e, c.SEMILLA); e.fase = "enfocado"; e.prog = 0; e.p = 0; e.nivel = 0; e.ciclos = 0; sortearEnfocado(e, c);
}

// ── posición ──
/** Medidas de la textura del crédito (px): tamaño, borde derecho de tinta, borde superior de tinta (y hacia abajo) y
 *  altura de mayúscula (la que define CREDITO_TAMANO). */
export interface MedidasCredito { texW: number; texH: number; inkDer: number; inkArriba: number; inkAbajo: number; capPx: number }
export interface PosCredito { cx: number; cy: number; ancho: number; alto: number; inkDerX: number; inkArribaY: number; inkAbajoY: number; inkAltoM: number }
/** Plano del crédito en coordenadas del bloque (m; origen en el centro del bloque, x a la derecha, y hacia arriba).
 *  El borde derecho de tinta queda en el borde derecho del bloque y el borde superior de tinta, MARGEN × alto del
 *  bloque por debajo de su borde inferior. Todo sale del bloque: si cambia, el crédito lo acompaña. */
export function posicionCredito(anchoBloque: number, altoBloque: number, m: MedidasCredito, tamano: number, margen: number, out?: PosCredito): PosCredito {
  const o = out ?? { cx: 0, cy: 0, ancho: 0, alto: 0, inkDerX: 0, inkArribaY: 0, inkAbajoY: 0, inkAltoM: 0 };
  const hB = Math.max(1e-6, fin(altoBloque)), wB = Math.max(0, fin(anchoBloque));
  const s = (Math.max(0, fin(tamano)) * hB) / Math.max(1e-6, m.capPx);   // m por px de la textura
  o.ancho = m.texW * s; o.alto = m.texH * s;
  o.inkDerX = wB / 2;
  o.inkArribaY = -hB / 2 - Math.max(0, fin(margen)) * hB;
  o.cx = o.inkDerX + (m.texW / 2 - m.inkDer) * s;
  o.cy = o.inkArribaY - (m.texH / 2 - m.inkArriba) * s;
  o.inkAbajoY = o.inkArribaY - (m.inkAbajo - m.inkArriba) * s;
  o.inkAltoM = (m.inkAbajo - m.inkArriba) * s;
  return o;
}
/** ¿La tinta del crédito queda dentro del telón? centroY: altura del centro del bloque sobre el piso (m). */
export function creditoDentroDelTelon(p: PosCredito, centroY: number, offsetX: number, anchoTelon: number, altoTelon: number, anchoTinta: number): boolean {
  const izq = offsetX + p.inkDerX - anchoTinta, der = offsetX + p.inkDerX;
  return izq >= -anchoTelon / 2 && der <= anchoTelon / 2 && centroY + p.inkAbajoY >= 0 && centroY + p.inkArribaY <= altoTelon;
}
/** Altura aparente en píxeles de un objeto de alto h (m) a distancia d (m) con fov vertical (grados) y alto de
 *  pantalla (px). */
export function alturaAparentePx(h: number, d: number, fovGrados: number, altoPantalla: number): number {
  return (fin(h) / (2 * Math.max(1e-6, fin(d)) * Math.tan((fin(fovGrados, 90) * Math.PI) / 360))) * fin(altoPantalla);
}
