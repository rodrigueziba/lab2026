// Z100: tocar el BA-40 con la cara. Lógica PURA y sin imports (se prueba en Node: scripts/cara-test.mjs).
// Idea inspirada en "mouth-acid" (Electro-Dig, MIT: https://github.com/Electro-Dig/mouth-acid): el gesto de la cara mueve
// los parámetros de un bajo ácido. No se copió código: el filtro, la calibración, los detectores y el mapa son propios.
//
// Entra, por cuadro, un arreglo corto de "crudos" (lo que manda el worker de MediaPipe o la simulación del menú):
//   [presente, jawOpen, mouthPucker, mouthSmileLeft, mouthSmileRight, browInnerUp, eyeBlinkLeft, eyeBlinkRight, pitch]
// y sale: 6 gestos en 0…1 (para los medidores del atril), los valores 0…1 de cada entrada del mapa (van a
// setParamBajo con fuente "cara") y dos eventos (cabeceo → acento forzado; guiño → siguiente patrón).
// Todo escribe en estructuras preasignadas: sin allocations por cuadro.

// ── índices ──
export const C_PRESENTE = 0, C_JAW = 1, C_PUCKER = 2, C_SMILE_L = 3, C_SMILE_R = 4, C_BROW = 5, C_BLINK_L = 6, C_BLINK_R = 7, C_PITCH = 8;
export const N_CRUDOS = 9;
/** Nombres de MediaPipe de los crudos 1…7 (el worker los busca por nombre una sola vez). */
export const BLENDSHAPES = ["jawOpen", "mouthPucker", "mouthSmileLeft", "mouthSmileRight", "browInnerUp", "eyeBlinkLeft", "eyeBlinkRight"] as const;
export const G_BOCA = 0, G_O = 1, G_SONRISA = 2, G_CEJAS = 3, G_CABECEO = 4, G_GUINO = 5;
export const N_GESTOS = 6, N_CONTINUOS = 4;
export const NOMBRES_GESTO = ["BOCA", "O", "SONRISA", "CEJAS", "CABECEO", "GUIÑO"] as const;

const fin = (x: number, d = 0): number => (Number.isFinite(x) ? x : d);
const acotar01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

// ── filtro "1 euro" (Casiez, Roussel y Vogel, 2012) ──
// Un pasa-bajos cuya frecuencia de corte se adapta a la velocidad de la señal: como un amortiguador que se endurece con
// los golpes grandes. Con el gesto quieto, corte bajo (MINCUTOFF): suaviza mucho y se va el temblor. Cuando el gesto
// se mueve rápido, el corte sube (BETA × velocidad): sigue al gesto con poco retraso. DCUTOFF suaviza la medición de la
// velocidad misma (si no, el ruido haría saltar el corte).
export interface UnEuro { x: number; dx: number; t: number; listo: boolean }
export function crearUnEuro(): UnEuro { return { x: 0, dx: 0, t: 0, listo: false }; }
export function reiniciarUnEuro(f: UnEuro): void { f.listo = false; f.x = 0; f.dx = 0; f.t = 0; }
/** Fracción de avance de un pasa-bajos de primer orden con corte `corteHz` en un paso de dt segundos. */
export function alfa(corteHz: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * Math.max(1e-6, corteHz));
  return 1 / (1 + tau / Math.max(1e-6, dt));
}
/** Filtra la muestra x tomada en tS (segundos). Sin NaN: una entrada no finita devuelve el último valor. */
export function filtrarUnEuro(f: UnEuro, x: number, tS: number, minCutoff: number, beta: number, dCutoff: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(tS)) return f.listo ? f.x : 0;
  if (!f.listo) { f.x = x; f.dx = 0; f.t = tS; f.listo = true; return x; }
  let dt = tS - f.t;
  if (!(dt > 0)) dt = 1 / 60;   // mismo instante o reloj hacia atrás: un paso nominal
  f.t = tS;
  const dxCrudo = (x - f.x) / dt;
  f.dx += alfa(Math.max(1e-3, fin(dCutoff, 1)), dt) * (dxCrudo - f.dx);
  const corte = Math.max(1e-3, fin(minCutoff, 1)) + Math.max(0, fin(beta, 0)) * Math.abs(f.dx);
  f.x += alfa(corte, dt) * (x - f.x);
  return f.x;
}

// ── calibración y normalización ──
export interface Calibracion { min: Float64Array; max: Float64Array; calibrada: boolean }
/** Límites "SIN CALIBRAR": razonables para una cara frente a una notebook (blendshapes de MediaPipe en reposo / gesto marcado). */
export const CAL_DEFECTO = { min: [0.02, 0.03, 0.05, 0.05], max: [0.55, 0.65, 0.70, 0.55] } as const;
export function crearCalibracion(): Calibracion {
  return { min: Float64Array.from(CAL_DEFECTO.min), max: Float64Array.from(CAL_DEFECTO.max), calibrada: false };
}
export function calibracionPorDefecto(c: Calibracion): void {
  for (let i = 0; i < N_CONTINUOS; i++) { c.min[i] = CAL_DEFECTO.min[i]; c.max[i] = CAL_DEFECTO.max[i]; }
  c.calibrada = false;
}
/**
 * x entre los límites a y b → 0…1. Rango invertido (b < a): se toman ordenados. Rango casi cero (< rangoMin): se abre
 * alrededor de su centro hasta rangoMin, para no dividir por casi cero (un gesto que no se movió al calibrar no explota).
 */
export function normalizar(x: number, a: number, b: number, rangoMin: number): number {
  if (!Number.isFinite(x)) return 0;
  let lo = Math.min(fin(a, 0), fin(b, 1)), hi = Math.max(fin(a, 0), fin(b, 1));
  const r = Math.max(1e-3, fin(rangoMin, 0.05));
  if (hi - lo < r) { const c = (lo + hi) / 2; lo = c - r / 2; hi = c + r / 2; }
  return acotar01((x - lo) / (hi - lo));
}

/** Pasos de la calibración (guía en el display ámbar). gesto −1 = cara relajada (fija los mínimos de todos). */
export const PASOS_CAL = [
  { texto: "CARA RELAJADA", gesto: -1 },
  { texto: "ABRÍ LA BOCA", gesto: G_BOCA },
  { texto: "LABIOS EN O", gesto: G_O },
  { texto: "SONREÍ", gesto: G_SONRISA },
  { texto: "CEJAS ARRIBA", gesto: G_CEJAS },
] as const;
export interface EstadoCal { activo: boolean; paso: number; t0: number; suma: Float64Array; n: number; maximo: Float64Array; terminada: boolean }
export function crearEstadoCal(): EstadoCal {
  return { activo: false, paso: 0, t0: 0, suma: new Float64Array(N_CONTINUOS), n: 0, maximo: new Float64Array(N_CONTINUOS), terminada: false };
}
export function iniciarCal(e: EstadoCal, tS: number): void {
  e.activo = true; e.paso = 0; e.t0 = tS; e.suma.fill(0); e.n = 0; e.maximo.fill(-Infinity); e.terminada = false;
}
export function cancelarCal(e: EstadoCal): void { e.activo = false; }
/** Segundos que le quedan al paso actual (para la cuenta regresiva). */
export function restanteCal(e: EstadoCal, tS: number, durS: number): number { return Math.max(0, durS - (tS - e.t0)); }
/**
 * Avanza la calibración con los gestos crudos filtrados de este cuadro (solo si hay rostro). Relajada: promedio → mínimos.
 * Cada gesto: su máximo observado → máximo de ese gesto. Al terminar el último paso escribe `cal` y devuelve true.
 */
export function pasoCal(e: EstadoCal, crudos: ArrayLike<number>, presente: boolean, tS: number, durS: number, cal: Calibracion): boolean {
  if (!e.activo) return false;
  const p = PASOS_CAL[e.paso];
  if (presente) {
    if (p.gesto < 0) { for (let i = 0; i < N_CONTINUOS; i++) e.suma[i] += fin(crudos[i]); e.n++; }
    else { const v = fin(crudos[p.gesto], -Infinity); if (v > e.maximo[p.gesto]) e.maximo[p.gesto] = v; }
  }
  if (tS - e.t0 < Math.max(0.2, durS)) return false;
  e.paso++; e.t0 = tS;
  if (e.paso < PASOS_CAL.length) return false;
  for (let i = 0; i < N_CONTINUOS; i++) {
    if (e.n > 0) cal.min[i] = e.suma[i] / e.n;
    if (Number.isFinite(e.maximo[i])) cal.max[i] = e.maximo[i];
  }
  cal.calibrada = true; e.activo = false; e.terminada = true;
  return true;
}
/** Persistencia (la clave lleva versión; la lectura valida todo y nunca tira). */
export const CLAVE_CAL = "alight:cara-calibracion-v1";
export function serializarCal(c: Calibracion): string {
  return JSON.stringify({ v: 1, min: Array.from(c.min), max: Array.from(c.max) });
}
export function leerCal(s: string | null | undefined, out: Calibracion): boolean {
  if (!s) return false;
  try {
    const o = JSON.parse(s) as { v?: number; min?: unknown; max?: unknown };
    if (o?.v !== 1 || !Array.isArray(o.min) || !Array.isArray(o.max) || o.min.length !== N_CONTINUOS || o.max.length !== N_CONTINUOS) return false;
    if (![...o.min, ...o.max].every(x => typeof x === "number" && Number.isFinite(x))) return false;
    for (let i = 0; i < N_CONTINUOS; i++) { out.min[i] = o.min[i] as number; out.max[i] = o.max[i] as number; }
    out.calibrada = true;
    return true;
  } catch { return false; }
}

// ── cabeceo (velocidad de la inclinación de la cabeza) ──
export interface DetCabeceo { prev: number; prevT: number; vel: number; ultimo: number; listo: boolean }
export function crearDetCabeceo(): DetCabeceo { return { prev: 0, prevT: 0, vel: 0, ultimo: -1e12, listo: false }; }
/**
 * Dispara si la velocidad angular del pitch (rad/s) supera `umbral` y pasó el período refractario desde el último disparo.
 * Un movimiento lento no llega al umbral; el refractario evita que un mismo golpe (bajada y rebote) dispare dos veces.
 */
export function detectarCabeceo(d: DetCabeceo, pitch: number, tMs: number, umbral: number, refractarioMs: number): boolean {
  if (!Number.isFinite(pitch) || !Number.isFinite(tMs)) return false;
  if (!d.listo) { d.prev = pitch; d.prevT = tMs; d.vel = 0; d.listo = true; return false; }
  const dt = (tMs - d.prevT) / 1000;
  if (!(dt > 0)) return false;
  d.vel = Math.abs(pitch - d.prev) / dt;
  d.prev = pitch; d.prevT = tMs;
  if (d.vel >= Math.max(1e-6, umbral) && tMs - d.ultimo >= Math.max(0, refractarioMs)) { d.ultimo = tMs; return true; }
  return false;
}

// ── guiño (un ojo cerrado y el otro abierto, sostenido) ──
export interface DetGuino { desde: number; ultimo: number; disparado: boolean }
export function crearDetGuino(): DetGuino { return { desde: -1, ultimo: -1e12, disparado: false }; }
export interface CfgGuino { CARA_GUINO_CERRADO: number; CARA_GUINO_ABIERTO: number; CARA_GUINO_MIN_MS: number; CARA_GUINO_REFRACTARIO_MS: number }
/**
 * Dispara una vez cuando un ojo está cerrado (> CERRADO) y el otro abierto (< ABIERTO) durante MIN_MS seguidos, con
 * período refractario. Un parpadeo (los dos ojos) no cumple la condición; uno muy corto no llega a MIN_MS. Para volver a
 * disparar hay que abrir el ojo (la condición se corta) y esperar el refractario.
 */
export function detectarGuino(d: DetGuino, izq: number, der: number, tMs: number, c: CfgGuino): boolean {
  const ce = c.CARA_GUINO_CERRADO, ab = c.CARA_GUINO_ABIERTO;
  const cond = Number.isFinite(izq) && Number.isFinite(der) && ((izq > ce && der < ab) || (der > ce && izq < ab));
  if (!cond) { d.desde = -1; d.disparado = false; return false; }
  if (d.desde < 0) d.desde = tMs;
  if (!d.disparado && tMs - d.desde >= c.CARA_GUINO_MIN_MS && tMs - d.ultimo >= c.CARA_GUINO_REFRACTARIO_MS) {
    d.disparado = true; d.ultimo = tMs;
    return true;
  }
  return false;
}

// ── mapa de gestos → parámetros del bajo (tabla de datos; se edita en el menú) ──
export interface EntradaMapa { gesto: number; param: string; salMin: number; salMax: number; activo: boolean }
/** Gestos continuos → parámetros modulables (valor 0…1 del parámetro, como lo espera setParamBajo con fuente "cara"). */
export function mapaPorDefecto(): EntradaMapa[] {
  return [
    { gesto: G_BOCA, param: "corte", salMin: 0.15, salMax: 1, activo: true },          // boca abierta → abre el filtro
    { gesto: G_O, param: "resonancia", salMin: 0.2, salMax: 0.95, activo: true },     // labios en O → resonancia
    { gesto: G_SONRISA, param: "decay", salMin: 0.1, salMax: 0.9, activo: true },      // sonrisa → envolvente (DECAY)
    { gesto: G_CEJAS, param: "distorsion", salMin: 0, salMax: 0.8, activo: true },     // cejas arriba → DISTORSIÓN
  ];
}
export const EV_ACENTO = 1, EV_GUINO = 2;

export interface CfgCara extends CfgGuino {
  CARA_MINCUTOFF: number; CARA_BETA: number; CARA_DCUTOFF: number; CARA_RANGO_MIN: number;
  CARA_ACENTO_UMBRAL: number; CARA_ACENTO_REFRACTARIO_MS: number; CARA_MEDIDOR_CAIDA: number;
}
export interface EstadoCara {
  filtros: UnEuro[]; cal: Calibracion; usarCal: boolean;
  crudos: Float64Array;      // 4 continuos filtrados, sin normalizar (los usa la calibración)
  gestos: Float64Array;      // 6 gestos 0…1 (medidores)
  salida: Float64Array;      // valor 0…1 por entrada del mapa (NaN = entrada apagada)
  cab: DetCabeceo; guino: DetGuino; detectada: boolean; cuadros: number;
}
export const MAX_MAPA = 8;
export function crearEstadoCara(): EstadoCara {
  return {
    filtros: [crearUnEuro(), crearUnEuro(), crearUnEuro(), crearUnEuro()], cal: crearCalibracion(), usarCal: true,
    crudos: new Float64Array(N_CONTINUOS), gestos: new Float64Array(N_GESTOS), salida: new Float64Array(MAX_MAPA).fill(NaN),
    cab: crearDetCabeceo(), guino: crearDetGuino(), detectada: false, cuadros: 0,
  };
}
/** Sin rostro o al encender: filtros y detectores desde cero (un rostro que reaparece no produce un golpe falso). */
export function reiniciarSeguimiento(e: EstadoCara): void {
  for (const f of e.filtros) reiniciarUnEuro(f);
  e.cab.listo = false; e.guino.desde = -1; e.guino.disparado = false;
  e.detectada = false; e.gestos.fill(0);
}
/** Valor 0…1 de una entrada del mapa para el gesto g (0…1). */
export function salidaMapa(m: EntradaMapa, g: number): number {
  return acotar01(fin(m.salMin, 0) + acotar01(g) * (fin(m.salMax, 1) - fin(m.salMin, 0)));
}

/**
 * Un cuadro: crudos → gestos 0…1 → salida del mapa, y eventos (bits EV_ACENTO | EV_GUINO). Sin rostro: retiene la última
 * salida (el bajo no salta), apaga los medidores y reinicia filtros y detectores. tMs: reloj del cuadro (ms).
 */
export function procesarCuadro(e: EstadoCara, crudo: ArrayLike<number>, tMs: number, c: CfgCara, mapa: readonly EntradaMapa[]): number {
  const presente = fin(crudo[C_PRESENTE]) > 0.5;
  if (!presente) { if (e.detectada || e.cuadros === 0) reiniciarSeguimiento(e); e.cuadros++; return 0; }
  e.detectada = true; e.cuadros++;
  const tS = tMs / 1000;
  e.crudos[G_BOCA] = filtrarUnEuro(e.filtros[0], fin(crudo[C_JAW]), tS, c.CARA_MINCUTOFF, c.CARA_BETA, c.CARA_DCUTOFF);
  e.crudos[G_O] = filtrarUnEuro(e.filtros[1], fin(crudo[C_PUCKER]), tS, c.CARA_MINCUTOFF, c.CARA_BETA, c.CARA_DCUTOFF);
  e.crudos[G_SONRISA] = filtrarUnEuro(e.filtros[2], (fin(crudo[C_SMILE_L]) + fin(crudo[C_SMILE_R])) / 2, tS, c.CARA_MINCUTOFF, c.CARA_BETA, c.CARA_DCUTOFF);
  e.crudos[G_CEJAS] = filtrarUnEuro(e.filtros[3], fin(crudo[C_BROW]), tS, c.CARA_MINCUTOFF, c.CARA_BETA, c.CARA_DCUTOFF);
  for (let i = 0; i < N_CONTINUOS; i++) {
    e.gestos[i] = e.usarCal ? normalizar(e.crudos[i], e.cal.min[i], e.cal.max[i], c.CARA_RANGO_MIN)
      : normalizar(e.crudos[i], CAL_DEFECTO.min[i], CAL_DEFECTO.max[i], c.CARA_RANGO_MIN);
  }
  let ev = 0;
  if (detectarCabeceo(e.cab, fin(crudo[C_PITCH], NaN), tMs, c.CARA_ACENTO_UMBRAL, c.CARA_ACENTO_REFRACTARIO_MS)) ev |= EV_ACENTO;
  const caida = acotar01(fin(c.CARA_MEDIDOR_CAIDA, 0.85));
  e.gestos[G_CABECEO] = Math.max(acotar01(e.cab.vel / Math.max(1e-6, c.CARA_ACENTO_UMBRAL)), e.gestos[G_CABECEO] * caida);
  const bl = fin(crudo[C_BLINK_L]), br = fin(crudo[C_BLINK_R]);
  if (detectarGuino(e.guino, bl, br, tMs, c)) ev |= EV_GUINO;
  e.gestos[G_GUINO] = acotar01(Math.abs(bl - br));
  const n = Math.min(MAX_MAPA, mapa.length);
  for (let j = 0; j < n; j++) {
    const m = mapa[j];
    e.salida[j] = m.activo && m.gesto >= 0 && m.gesto < N_GESTOS ? salidaMapa(m, e.gestos[m.gesto]) : NaN;
  }
  return ev;
}

// ── display (línea 2) ──
export type EstadoLector = "apagada" | "iniciando" | "esperando" | "activa" | "calibrando" | "sin_camara" | "sin_motor";
/** Línea 2 del display con CARA encendida (se arma solo cuando cambia el estado o la cuenta, no por cuadro). */
export function textoLineaCara(estado: EstadoLector, pasoCal: number, segundos: number): string {
  switch (estado) {
    case "iniciando": return "CARA: INICIANDO CÁMARA…";
    case "esperando": return "CARA: ESPERANDO ROSTRO";
    case "activa": return "CARA: ACTIVA";
    case "calibrando": {
      const p = PASOS_CAL[Math.max(0, Math.min(PASOS_CAL.length - 1, pasoCal))];
      return `CARA: CALIBRANDO ${pasoCal + 1}/${PASOS_CAL.length} · ${p.texto}… ${Math.ceil(Math.max(0, segundos))}`;
    }
    case "sin_camara": return "CARA: SIN CÁMARA";
    case "sin_motor": return "CARA: SIN DETECTOR (MEDIAPIPE)";
    default: return "";
  }
}
