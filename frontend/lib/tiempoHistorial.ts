// Z86: tiempo detenido con retraso por filas (slit-scan) y estela de luces. Lógica PURA, sin imports, con el tiempo
// inyectado (prueba: scripts/tiempo-historial-test.mjs). La parte de GPU está en lib/retro/historialTiempo.ts y el GLSL
// en lib/retro/tiempoDetenido.ts (la geometría de este archivo es réplica exacta de la del shader).
//
// DISEÑO PEDIDO POR EL USUARIO: una distorsión del tiempo visualmente evidente, con el retraso en la reproducción de la
// imagen por líneas de arriba a abajo, y un ghosteo como el de las cámaras hogareñas antiguas sobre las luces que vea el
// usuario. Sin baja definición ni pixelado.
// Inspiración: Shadertoy de desplazamiento temporal (autor pendiente): cada fila lee un cuadro distinto del pasado.
// Implementación propia: historial nítido en una textura de capas (no miniaturas), interpolado entre cuadros vecinos.
//
// Historial: anillo de N cuadros capturados a HIST_HZ. La capa más nueva tiene una edad (s desde su captura). Para un
// retraso d (s), x = (d − edad) · HZ cuadros hacia atrás: se mezclan las capas floor(x) y floor(x)+1 (lineal). Si
// d < edad, se mezcla el cuadro en vivo con la capa más nueva (sin escalón arriba). Si falta historial, se usa la capa
// más vieja disponible.

export interface CfgHistorial {
  RETRASO_MAX_S: number; HIST_HZ: number; HIST_N: number | string; DIRECCION: string; CURVA: string; EXPONENTE: number;
  ONDA_AMP: number; ONDA_VEL: number; PRE_ROLL: string; DESARMAR_S: number;
}
const fin = (x: number, d: number): number => (Number.isFinite(x) ? x : d);
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Tamaño del anillo: HIST_N o "auto" = ceil(RETRASO_MAX_S · HIST_HZ) + 2 (2…120). */
export function tamAnillo(c: CfgHistorial): number {
  const n = typeof c.HIST_N === "number" && Number.isFinite(c.HIST_N) ? c.HIST_N
    : Math.ceil(Math.max(0, fin(c.RETRASO_MAX_S, 1.2)) * Math.max(1, fin(c.HIST_HZ, 20))) + 2;
  return Math.max(2, Math.min(120, Math.round(n)));
}

/**
 * Fracción de retraso de una fila (0…1) antes de multiplicar por RETRASO_MAX_S · k.
 * yUv: 0 abajo, 1 arriba (coordenadas de textura). "abajo_mas_viejo": arriba 0 (lo más reciente), abajo 1.
 * CURVA "lineal" o "suave" (smoothstep), luego ^EXPONENTE.
 */
export function fraccionFila(yUv: number, c: CfgHistorial): number {
  let f = c.DIRECCION === "arriba_mas_viejo" ? clamp01(yUv) : 1 - clamp01(yUv);
  if (c.CURVA === "suave") f = f * f * (3 - 2 * f);
  return Math.pow(f, Math.max(0.05, fin(c.EXPONENTE, 1)));
}
/** Retraso (s) de la fila con la envolvente k y la ondulación lenta (nunca negativo). */
export function retrasoFila(yUv: number, k: number, t: number, c: CfgHistorial): number {
  const f = fraccionFila(yUv, c);
  const onda = fin(c.ONDA_AMP, 0) * Math.sin(f * 6.2831853 + t * fin(c.ONDA_VEL, 0));
  return Math.max(0, clamp01(k) * Math.max(0, fin(c.RETRASO_MAX_S, 1.2)) * (f + onda * f));
}

/** Estado del anillo (lo mantiene lib/tiempoDetenidoAcciones.ts; las capturas las hace la GPU). */
export interface Anillo { n: number; nueva: number; disponibles: number; edad: number; acc: number }
export function crearAnillo(n: number): Anillo { return { n: Math.max(2, n), nueva: -1, disponibles: 0, edad: 0, acc: Infinity }; }
export function vaciarAnillo(a: Anillo): void { a.nueva = -1; a.disponibles = 0; a.edad = 0; a.acc = Infinity; }

/** Avanza el tiempo; devuelve la capa donde capturar en este cuadro, o −1. Una captura como máximo por cuadro. */
export function tickCaptura(a: Anillo, dt: number, hz: number): number {
  const h = Math.max(0, fin(dt, 0));
  a.edad += h;
  a.acc += h;
  if (a.acc < 1 / Math.max(1, hz)) return -1;
  if (a.nueva >= 0 && h === 0) return -1;    // pausa: no se captura (el historial queda congelado)
  a.acc = 0;
  a.nueva = (a.nueva + 1) % a.n;
  a.disponibles = Math.min(a.n, a.disponibles + 1);
  a.edad = 0;
  return a.nueva;
}

/** Resultado de leer el historial: capas a y b, mezcla f (0 = a), y cuánto del cuadro en vivo (vivo 1 = solo vivo). */
export interface Lectura { a: number; b: number; f: number; vivo: number }
export function leerHistorial(d: number, a: Anillo, hz: number, out: Lectura): Lectura {
  out.a = Math.max(0, a.nueva); out.b = out.a; out.f = 0; out.vivo = 1;
  if (a.disponibles <= 0 || d <= 0) return out;
  if (d < a.edad) { out.vivo = 1 - d / Math.max(1e-6, a.edad); return out; }   // entre el vivo y la más nueva
  out.vivo = 0;
  const x = Math.min((d - a.edad) * Math.max(1, hz), a.disponibles - 1);       // cuadros hacia atrás (acotado)
  const i = Math.floor(x);
  out.f = i >= a.disponibles - 1 ? 0 : x - i;
  out.a = (((a.nueva - i) % a.n) + a.n) % a.n;
  out.b = (((a.nueva - i - 1) % a.n) + a.n) % a.n;
  return out;
}

/** Armado: captura y estela solo cuando hace falta. */
export interface Armado { armado: boolean; desarmeS: number }
export function crearArmado(): Armado { return { armado: false, desarmeS: 0 }; }
/**
 * cerca = algún monolito con peso > 0 (dentro de RADIO_INICIO_M); haySesion; k actual; dt de la experiencia.
 * PRE_ROLL "al_acercarse": se arma al entrar al radio sin sesión (el historial ya tiene pasado al disparar);
 * "al_disparar": solo con k > 0. Se desarma DESARMAR_S después de que la condición deja de cumplirse.
 * Devuelve true si cambió.
 */
export function tickArmado(st: Armado, cerca: boolean, haySesion: boolean, k: number, dt: number, c: CfgHistorial): boolean {
  const antes = st.armado;
  const quiere = k > 0 || (c.PRE_ROLL !== "al_disparar" && cerca && !haySesion);
  if (quiere) { st.armado = true; st.desarmeS = 0; }
  else if (st.armado) {
    st.desarmeS += Math.max(0, fin(dt, 0));
    if (st.desarmeS >= Math.max(0, fin(c.DESARMAR_S, 2))) { st.armado = false; st.desarmeS = 0; }
  }
  return st.armado !== antes;
}

/** Decaimiento de la estela por cuadro: exp(−dt / PERSISTENCIA_S) (1 en pausa: queda congelada). */
export function decaimientoEstela(dt: number, persistenciaS: number): number {
  const h = Math.max(0, fin(dt, 0));
  if (h === 0) return 1;
  return Math.exp(-h / Math.max(0.01, fin(persistenciaS, 0.35)));
}
/** MB de una textura RGBA8 de w×h×capas. */
export function megabytes(w: number, h: number, capas: number): number { return (w * h * 4 * capas) / (1024 * 1024); }
/** Tamaño del historial: escala de la resolución, con tope de ancho (mantiene la proporción). */
export function tamHistorial(w: number, h: number, escala: number, maxAncho: number): { w: number; h: number } {
  let hw = Math.max(16, Math.round(w * Math.max(0.1, Math.min(1, fin(escala, 0.5)))));
  let hh = Math.max(16, Math.round(h * Math.max(0.1, Math.min(1, fin(escala, 0.5)))));
  const tope = Math.max(64, fin(maxAncho, 1280));
  if (hw > tope) { hh = Math.round(hh * tope / hw); hw = tope; }
  return { w: hw, h: hh };
}
