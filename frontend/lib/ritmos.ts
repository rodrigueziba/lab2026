// Z80: caja de ritmos circular (primer instrumento propio de la TARIMA). Lógica PURA, sin imports
// (prueba: scripts/ritmos-test.mjs). La usan lib/ritmosMotor.ts (sonido, reloj, persistencia) y components/CajaRitmos.tsx.
//
// Geometría del disco (coordenadas locales del disco, en metros; y = arriba del plano):
//   centro = vinilo (radio R_VINILO); anillo k (k = 0 adentro) entre R0 + k·ANCHO y R0 + (k + 1)·ANCHO.
//   Ángulo = tiempo: el paso 0 está a las 12 (hacia −z, el fondo del atril) y avanza en sentido horario visto desde
//   arriba (hacia +x). El paso s ocupa [s − ½, s + ½) · 2π/PASOS: los cubitos y la línea radial caen en s · 2π/PASOS.
// Una vuelta = un compás de 4/4: PASOS / 4 pasos por pulso (8 → corcheas, 12 → tresillos, 16 → semicorcheas, 32 → fusas).
// Swing: retrasa los pasos impares (cuando hay una cantidad par de pasos por pulso) SWING% · ½ paso; 60 % ≈ tresillo.

export const PASOS_VALIDOS = [8, 12, 16, 32] as const;
export const PASOS_MAX = 32;
export const VOCES_IDS = ["kick", "clap", "hatC", "hatA", "shaker", "perc"] as const;
export type VozId = (typeof VOCES_IDS)[number];
export const NOMBRE_VOZ: Record<VozId, string> = {
  kick: "BOMBO", clap: "PALMAS", hatC: "HAT CERRADO", hatA: "HAT ABIERTO", shaker: "SHAKER", perc: "TOM",
};

const fin = (x: number, d: number): number => (Number.isFinite(x) ? x : d);

/** PASOS aceptado más cercano (8, 12, 16 o 32). */
export function pasosValidos(n: number): number {
  const v = fin(n, 16);
  let mejor = 16, d = Infinity;
  for (const p of PASOS_VALIDOS) { const e = Math.abs(p - v); if (e < d) { d = e; mejor = p; } }
  return mejor;
}
export function pasosPorPulso(pasos: number): number { return pasosValidos(pasos) / 4; }

/** Lista de pistas válida (ids conocidos, sin repetir, en el orden dado; vacía → todas). */
export function pistasValidas(ids: readonly string[]): VozId[] {
  const out: VozId[] = [];
  for (const id of ids) if ((VOCES_IDS as readonly string[]).includes(id) && !out.includes(id as VozId)) out.push(id as VozId);
  return out.length ? out : [...VOCES_IDS];
}

// ── geometría ──
export interface GeoDisco { R0: number; ANCHO: number }
export interface Celda { anillo: number; paso: number; r: number; ang: number }
const DOS_PI = Math.PI * 2;

/** Ángulo (0…2π) del punto (x, z) del plano del disco: 0 a las 12 (−z), horario hacia +x. */
export function anguloDe(x: number, z: number): number {
  const a = Math.atan2(x, -z);
  return a < 0 ? a + DOS_PI : a;
}
/** Punto del plano del disco → celda (anillo y paso), o null fuera de los anillos. Escribe en out. */
export function puntoACelda(x: number, z: number, g: GeoDisco, nPistas: number, pasos: number, out: Celda): Celda | null {
  const r = Math.hypot(x, z);
  const k = Math.floor((r - g.R0) / g.ANCHO);
  if (!(k >= 0 && k < nPistas)) return null;
  const ang = anguloDe(x, z);
  const p = pasosValidos(pasos);
  out.anillo = k;
  out.paso = Math.round(ang / (DOS_PI / p)) % p;
  out.r = r; out.ang = ang;
  return out;
}
/** Centro de la celda (anillo, paso) en el plano del disco. */
export function centroCelda(anillo: number, paso: number, g: GeoDisco, pasos: number, out: { x: number; z: number }): { x: number; z: number } {
  const r = g.R0 + (anillo + 0.5) * g.ANCHO;
  const a = (paso / pasosValidos(pasos)) * DOS_PI;
  out.x = r * Math.sin(a); out.z = -r * Math.cos(a);
  return out;
}

// ── patrón ──
export type Patron = Record<VozId, Uint8Array>;
export function crearPatron(): Patron {
  const p = {} as Patron;
  for (const id of VOCES_IDS) p[id] = new Uint8Array(PASOS_MAX);
  return p;
}
export function borrarPatron(p: Patron): void { for (const id of VOCES_IDS) p[id].fill(0); }
export function alternarCelda(p: Patron, id: VozId, paso: number): boolean {
  const f = p[id];
  if (!f || paso < 0 || paso >= PASOS_MAX) return false;
  f[paso] = f[paso] ? 0 : 1;
  return f[paso] === 1;
}
export function cantidadActivas(p: Patron, pistas: readonly VozId[], pasos: number): number {
  let n = 0;
  for (const id of pistas) for (let s = 0; s < pasos; s++) if (p[id][s]) n++;
  return n;
}
/** Cambia la cantidad de pasos conservando la posición en el compás (redondea al paso nuevo más cercano). */
export function remapearPasos(p: Patron, de: number, a: number): void {
  const d = pasosValidos(de), n = pasosValidos(a);
  if (d === n) return;
  const tmp = new Uint8Array(PASOS_MAX);
  for (const id of VOCES_IDS) {
    tmp.fill(0);
    for (let s = 0; s < d; s++) if (p[id][s]) tmp[Math.round((s * n) / d) % n] = 1;
    p[id].set(tmp);
  }
}
/** Ejemplo house: bombo en los 4 tiempos, hat cerrado en los contratiempos, palmas en 2 y 4. */
export function ejemploHouse(p: Patron, pasos: number): void {
  borrarPatron(p);
  const n = pasosValidos(pasos), q = n / 4;
  for (let b = 0; b < 4; b++) {
    p.kick[Math.round(b * q)] = 1;
    p.hatC[Math.round(b * q + q / 2) % n] = 1;
  }
  p.clap[Math.round(q)] = 1;
  p.clap[Math.round(3 * q)] = 1;
}

// ── tiempo ──
/** Retraso del swing (s) para el paso `paso`: solo pasos impares y con pasos por pulso par. */
export function retrasoSwing(paso: number, pasos: number, swingPct: number, durPasoS: number): number {
  const ppp = pasosPorPulso(pasos);
  if (ppp % 2 !== 0 || paso % 2 === 0) return 0;
  const s = Math.min(60, Math.max(0, fin(swingPct, 0))) / 100;
  return s * 0.5 * durPasoS;
}

/** Lo que necesita del reloj de Z78 (estructural: no importa el módulo). */
export interface RelojLeido { estado: string; paso: number; siguienteT: number; restoPausaS: number; bpm: number; pasosPorPulso: number; pasosPorCompas: number; compas: number }
export interface Posicion { pasos: number; compas: number; paso: number; frac: number }
/**
 * Posición que SUENA ahora (en pasos, fraccionaria, 0…PASOS) a partir del reloj: el reloj ya programó hasta
 * siguienteT (adelantado por el anticipo), así que la posición actual es paso − (siguienteT − ahora) / duración.
 * Pausado: queda quieta donde estaba; detenido: en 0. Escribe en out.
 */
export function posicionActual(r: RelojLeido, ahora: number, out: Posicion): Posicion {
  const n = Math.max(1, r.pasosPorCompas);
  const dur = 60 / Math.max(1, r.bpm) / Math.max(1, r.pasosPorPulso);
  let faltan: number;
  if (r.estado === "corriendo") faltan = Math.max(0, r.siguienteT - ahora);
  else if (r.estado === "pausado") faltan = r.restoPausaS;
  else { out.pasos = 0; out.compas = 0; out.paso = 0; out.frac = 0; return out; }
  let p = r.paso + r.compas * n - faltan / dur;   // pasos absolutos desde el inicio
  if (p < 0) p = 0;
  const compas = Math.floor(p / n);
  const enCompas = p - compas * n;
  out.pasos = enCompas; out.compas = compas; out.paso = Math.floor(enCompas); out.frac = enCompas - out.paso;
  return out;
}
/** "compás.pulso.subdivisión" como en la referencia: 01.3.2 (compás de 2 cifras, desde 1). */
export function textoPosicion(pos: Posicion, pasos: number): string {
  const ppp = pasosPorPulso(pasos);
  const c = (pos.compas % 99) + 1;
  return `${c < 10 ? "0" : ""}${c}.${Math.floor(pos.paso / ppp) + 1}.${(pos.paso % ppp) + 1}`;
}
/** Pasos (≥ 0) desde que la línea pasó por el paso s, con vuelta. */
export function pasosDesde(posPasos: number, s: number, pasos: number): number {
  const d = posPasos - s;
  return d >= 0 ? d : d + pasos;
}
/** Salto del cubito: 1 en reposo, sube a 1 + amp al pasar la línea y vuelve (t en s desde el golpe). */
export function escalaSalto(t: number, amp: number, tau: number): number {
  if (!(t >= 0) || t > tau * 6) return 1;
  const ataque = 0.02;
  if (t < ataque) return 1 + amp * (t / ataque);
  return 1 + amp * Math.exp(-(t - ataque) / Math.max(0.01, tau));
}

/** Hat abierto: un hat cerrado (o abierto nuevo) en [inicio, fin) del abierto lo corta. */
export function cortaAbierto(inicioAbierto: number, finAbierto: number, tGolpe: number): boolean {
  return tGolpe >= inicioAbierto && tGolpe < finAbierto;
}

// ── persistencia ──
export interface GuardadoRitmos { v: 1; pasos: number; bpm: number; swing: number; filas: Partial<Record<VozId, string>> }
export function serializarRitmos(p: Patron, pasos: number, bpm: number, swing: number): string {
  const n = pasosValidos(pasos);
  const filas: Partial<Record<VozId, string>> = {};
  for (const id of VOCES_IDS) {
    let s = "";
    for (let i = 0; i < n; i++) s += p[id][i] ? "x" : ".";
    filas[id] = s;
  }
  return JSON.stringify({ v: 1, pasos: n, bpm, swing, filas } satisfies GuardadoRitmos);
}
/** Restaura en p; devuelve { pasos, bpm, swing } o null si el texto no sirve. */
export function restaurarRitmos(texto: string | null, p: Patron): { pasos: number; bpm: number; swing: number } | null {
  if (!texto) return null;
  let g: GuardadoRitmos;
  try { g = JSON.parse(texto) as GuardadoRitmos; } catch { return null; }
  if (!g || g.v !== 1 || typeof g.filas !== "object" || g.filas === null) return null;
  const n = pasosValidos(g.pasos);
  borrarPatron(p);
  for (const id of VOCES_IDS) {
    const f = g.filas[id];
    if (typeof f !== "string") continue;
    for (let i = 0; i < Math.min(n, f.length); i++) if (f[i] === "x") p[id][i] = 1;
  }
  return { pasos: n, bpm: Math.min(180, Math.max(60, fin(g.bpm, 120))), swing: Math.min(60, Math.max(0, fin(g.swing, 0))) };
}

/** Estado del atril de la caja de ritmos para LecternSystem (tecla E): lo escribe CajaRitmos. */
export const ATRIL_RITMOS = {
  visible: false,                                   // salió del piso del todo
  x: 0, z: 0,                                       // posición (espacio de LecternSystem)
  camPos: [0, 0, 0] as [number, number, number],    // pose de la cámara al entrar (E)
  camQuat: [0, 0, 0, 1] as [number, number, number, number],
  fov: 55,
};
