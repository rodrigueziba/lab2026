// Z78: parámetros nombrados de 1 a 10 para los instrumentos. Lógica PURA, sin imports (prueba: scripts/audio-nucleo-test.mjs).
// Cada parámetro tiene un valor de usuario 1…10 (lo que mueven el menú, una perilla del atril, el atril de cables o
// MediaPipe) y un valor real (Hz, s, ganancia…) con mapeo lineal o exponencial. Al cambiar, el valor real se aplica a
// los destinos vinculados (AudioParam u otro objeto con setTargetAtTime) con suavizado, sin saltos.
// Exponencial: min · (max / min)^t; requiere min > 0 y max > 0 (si no, cae a lineal).
// Registro central: PARAMETROS (crearRegistro), listado por nombre con listar(). Sin instrumentos todavía: vacío.

export type CurvaParametro = "lin" | "exp";
export interface DefParametro {
  id: string;            // "bajo.corte"
  nombre: string;        // "CORTE"
  min: number;           // valor real con 1
  max: number;           // valor real con 10
  curva: CurvaParametro;
  defecto: number;       // 1…10
  unidad?: string;       // "Hz", "s"…
  tauS?: number;         // constante de tiempo del suavizado (s)
}
/** Lo que necesita un destino: AudioParam lo cumple. */
export interface DestinoParam { setTargetAtTime(valor: number, tiempo: number, tau: number): unknown }
export interface Parametro { def: DefParametro; valor: number; real: number; destinos: DestinoParam[] }
export interface RegistroParametros { porId: Map<string, Parametro>; lista: Parametro[] }

export const VALOR_MIN = 1;
export const VALOR_MAX = 10;
export const TAU_DEFECTO_S = 0.05;

const fin = (x: number, d: number): number => (Number.isFinite(x) ? x : d);

export function acotarValor(v: number): number {
  return Math.min(VALOR_MAX, Math.max(VALOR_MIN, fin(v, VALOR_MIN)));
}
/** 1…10 → 0…1 */
export function normalizar(v: number): number {
  return (acotarValor(v) - VALOR_MIN) / (VALOR_MAX - VALOR_MIN);
}
function usaExp(def: DefParametro): boolean {
  return def.curva === "exp" && def.min > 0 && def.max > 0;
}
/** Valor de usuario (1…10) → valor real. */
export function aReal(v: number, def: DefParametro): number {
  const t = normalizar(v);
  if (usaExp(def)) return def.min * Math.pow(def.max / def.min, t);
  return def.min + t * (def.max - def.min);
}
/** Valor real → valor de usuario (1…10), acotado. */
export function deReal(real: number, def: DefParametro): number {
  let t: number;
  if (usaExp(def)) t = Math.log(Math.max(1e-12, real) / def.min) / Math.log(def.max / def.min);
  else t = def.max === def.min ? 0 : (real - def.min) / (def.max - def.min);
  return acotarValor(VALOR_MIN + fin(t, 0) * (VALOR_MAX - VALOR_MIN));
}

export function crearRegistro(): RegistroParametros {
  return { porId: new Map(), lista: [] };
}

/** Registra un parámetro (si el id ya existe, devuelve el existente sin cambiarlo). */
export function registrar(reg: RegistroParametros, def: DefParametro): Parametro {
  const ya = reg.porId.get(def.id);
  if (ya) return ya;
  const valor = acotarValor(def.defecto);
  const p: Parametro = { def, valor, real: aReal(valor, def), destinos: [] };
  reg.porId.set(def.id, p);
  reg.lista.push(p);
  return p;
}
export function obtener(reg: RegistroParametros, id: string): Parametro | null {
  return reg.porId.get(id) ?? null;
}
/** Lista de solo lectura, en orden de registro. */
export function listar(reg: RegistroParametros): readonly Parametro[] {
  return reg.lista;
}
export function quitar(reg: RegistroParametros, id: string): void {
  const p = reg.porId.get(id);
  if (!p) return;
  reg.porId.delete(id);
  reg.lista.splice(reg.lista.indexOf(p), 1);
  p.destinos.length = 0;
}

/** Fija el valor 1…10 y lo aplica con suavizado a los destinos (ahora = tiempo de audio). Devuelve el valor real. */
export function fijar(reg: RegistroParametros, id: string, v: number, ahora: number): number | null {
  const p = reg.porId.get(id);
  if (!p) return null;
  p.valor = acotarValor(v);
  p.real = aReal(p.valor, p.def);
  const tau = Math.max(0.001, fin(p.def.tauS ?? TAU_DEFECTO_S, TAU_DEFECTO_S));
  for (let i = 0; i < p.destinos.length; i++) p.destinos[i].setTargetAtTime(p.real, ahora, tau);
  return p.real;
}

/** Vincula un destino (AudioParam): recibe el valor actual enseguida. Devuelve la función para desvincularlo. */
export function vincular(reg: RegistroParametros, id: string, destino: DestinoParam, ahora: number): () => void {
  const p = reg.porId.get(id);
  if (!p) return () => {};
  if (!p.destinos.includes(destino)) p.destinos.push(destino);
  destino.setTargetAtTime(p.real, ahora, 0.005);
  return () => {
    const i = p.destinos.indexOf(destino);
    if (i >= 0) p.destinos.splice(i, 1);
  };
}

/** Registro central de la aplicación (vacío hasta que haya instrumentos). */
export const PARAMETROS: RegistroParametros = crearRegistro();
