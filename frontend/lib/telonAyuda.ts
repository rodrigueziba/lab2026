// Z104: ayuda de movimiento sobre el telón rojo del inicio. Lógica PURA y SIN imports (prueba: scripts/telon-ayuda-test.mjs).
// La dibuja components/TelonAyuda.tsx con el mismo gobo del texto del telón (Z46).
//
//   espera (cuenta el tiempo QUIETO, solo con el telón presente y sin pausa ni diálogo)
//     → a los ESPERA_S: mostrando (W ↑, S ↓, A ←, D → cada INTERVALO_S, PASADAS veces) → terminada (no vuelve)
//   Si el usuario se mueve (W A S D o cambia su posición; mirar solo cuenta con CUENTA_MIRAR) en cualquier momento:
//     la indicación visible se apaga con su fundido y no se imprime nada más (cancelada). Con REARMAR, después de otros
//     ESPERA_S quieto vuelve a empezar; sin REARMAR queda cancelada para toda la visita.
// Avanza con dt (s) que el componente pasa por cuadro; sin allocations (escribe en el estado).

export const LETRAS_AYUDA = ["W", "S", "A", "D"] as const;
export const DIRECCIONES_AYUDA = ["arriba", "abajo", "izquierda", "derecha"] as const;
/** Instrucción para lectores de pantalla (se anuncia una sola vez, al empezar la ayuda). */
export const TEXTO_ACCESIBLE_AYUDA = "Usá la tecla W para avanzar, S para retroceder, A para ir a la izquierda y D a la derecha";

export type FaseAyuda = "espera" | "mostrando" | "saliendo" | "terminada" | "cancelada";
export interface CfgAyuda {
  ESPERA_S: number; INTERVALO_S: number; PASADAS: number; MODO: string; REARMAR: boolean; CUENTA_MIRAR: boolean;
  ENTRADA_S: number; SALIDA_S: number; FLICKER_S: number; FLICKER_N: number; FLICKER_PICO: number;
}
export interface EstadoAyuda {
  fase: FaseAyuda;
  quietoS: number;       // tiempo quieto acumulado (espera)
  t: number;             // tiempo desde que empezó a mostrar
  tSalida: number;       // tiempo desde que empezó a salir (cancelada por movimiento)
  alfaSalida: number;    // opacidad que tenía al empezar a salir
  indicacion: number;    // 0 W, 1 S, 2 A, 3 D; −1 ninguna
  celdas: number;        // cuántas se ven (1 en "uno"; 1…4 en "acumulado")
  pasada: number;        // 0…PASADAS−1
  alfa: number;          // opacidad de la indicación nueva (la que entra)
  alfaResto: number;     // opacidad de las anteriores (solo "acumulado")
  movido: boolean;       // se canceló por movimiento en esta visita
  anunciado: boolean;    // el texto accesible ya se anunció (una sola vez por visita)
  anunciar: boolean;     // este cuadro hay que anunciar
}
export function crearEstadoAyuda(): EstadoAyuda {
  return { fase: "espera", quietoS: 0, t: 0, tSalida: 0, alfaSalida: 0, indicacion: -1, celdas: 0, pasada: 0, alfa: 0, alfaResto: 0, movido: false, anunciado: false, anunciar: false };
}
export function reiniciarAyuda(e: EstadoAyuda): void {
  e.fase = "espera"; e.quietoS = 0; e.t = 0; e.tSalida = 0; e.alfaSalida = 0; e.indicacion = -1; e.celdas = 0; e.pasada = 0;
  e.alfa = 0; e.alfaResto = 0; e.movido = false; e.anunciado = false; e.anunciar = false;
}
/** "Probar ayuda ahora": empieza ya, sin esperar. */
export function dispararAyuda(e: EstadoAyuda): void { reiniciarAyuda(e); e.fase = "mostrando"; e.quietoS = 0; }

const sat = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const fin = (x: number, d: number): number => (Number.isFinite(x) ? x : d);
function fundido(dt: number, dur: number): number {
  if (!(dur > 1e-4)) return dt >= 0 ? 1 : 0;
  const x = sat(dt / dur);
  return x * x * (3 - 2 * x);
}
/** Entrada como la del texto del telón: parpadeo de reflector (FLICKER_N destellos en FLICKER_S) y fundido. */
export function alfaEntradaAyuda(dt: number, c: CfgAyuda): number {
  const dur = Math.max(0, fin(c.FLICKER_S, 0)), n = Math.max(0, Math.round(fin(c.FLICKER_N, 0)));
  if (dt >= 0 && dt < dur && n > 0) {
    const tramo = dur / n, k = Math.min(n - 1, Math.floor(dt / tramo)), u = (dt - k * tramo) / tramo;
    return u < 0.35 + 0.1 * Math.sin(k * 2.3) ? sat(c.FLICKER_PICO) : 0.25 * fundido(dt, c.ENTRADA_S);
  }
  return fundido(dt, c.ENTRADA_S);
}

export interface EntradaAyuda {
  presente: boolean;   // el telón está y el usuario todavía no lo cruzó (ni se fue por el camino LUZ, ni checkpoint)
  pausado: boolean;    // pausa de la experiencia o diálogo abierto: el tiempo no corre
  movio: boolean;      // W A S D o cambio de posición este cuadro
  miro: boolean;       // giró la cámara este cuadro (solo cuenta con CUENTA_MIRAR)
}
/**
 * Un cuadro de dt segundos. Devuelve el estado (indicación, celdas, pasada, opacidades, fase). Sin telón: no muestra
 * nada y reinicia la espera (no gasta tiempo); en pausa: todo queda congelado.
 */
export function avanzarAyuda(e: EstadoAyuda, dt: number, c: CfgAyuda, en: EntradaAyuda): EstadoAyuda {
  e.anunciar = false;
  if (!en.presente) {
    if (e.fase === "espera" || e.fase === "mostrando" || e.fase === "saliendo") { e.quietoS = 0; if (e.fase !== "espera") { e.fase = e.movido && !c.REARMAR ? "cancelada" : "espera"; e.t = 0; } }
    e.indicacion = -1; e.celdas = 0; e.alfa = 0; e.alfaResto = 0;
    return e;
  }
  if (en.pausado) return e;
  const d = Math.max(0, Math.min(0.25, fin(dt, 0)));   // un tirón largo no salta indicaciones
  const se = en.movio || (c.CUENTA_MIRAR && en.miro);
  const intervalo = Math.max(0.2, fin(c.INTERVALO_S, 2)), pasadas = Math.max(1, Math.round(fin(c.PASADAS, 2)));
  const acumulado = c.MODO === "acumulado";

  if (se) {
    e.movido = true;
    if (e.fase === "mostrando") { e.fase = "saliendo"; e.tSalida = 0; e.alfaSalida = Math.max(e.alfa, e.alfaResto); }
    else if (e.fase === "espera") { e.quietoS = 0; if (!c.REARMAR) e.fase = "cancelada"; }
  }
  if (e.fase === "saliendo") {
    e.tSalida += d;
    const k = 1 - fundido(e.tSalida, c.SALIDA_S);
    e.alfa = e.alfaSalida * k; e.alfaResto = acumulado ? e.alfa : 0;
    if (k <= 0) { e.indicacion = -1; e.celdas = 0; e.alfa = 0; e.alfaResto = 0; e.fase = c.REARMAR ? "espera" : "cancelada"; e.quietoS = 0; e.t = 0; }
    return e;
  }
  if (e.fase === "espera") {
    e.indicacion = -1; e.celdas = 0; e.alfa = 0; e.alfaResto = 0;
    if (se) return e;
    e.quietoS += d;
    if (e.quietoS >= Math.max(0, fin(c.ESPERA_S, 5)) - 1e-9) { e.fase = "mostrando"; e.t = e.quietoS - Math.max(0, fin(c.ESPERA_S, 5)); }
    else return e;
  } else if (e.fase === "mostrando") e.t += d;
  if (e.fase !== "mostrando") { e.indicacion = -1; e.celdas = 0; e.alfa = 0; e.alfaResto = 0; return e; }
  if (!e.anunciado) { e.anunciado = true; e.anunciar = true; }

  const total = intervalo * 4 * pasadas;
  if (e.t >= total - 1e-9) { e.fase = "terminada"; e.indicacion = -1; e.celdas = 0; e.alfa = 0; e.alfaResto = 0; return e; }
  const k = Math.floor(e.t / intervalo + 1e-9), idx = k % 4, local = e.t - k * intervalo;
  e.indicacion = idx; e.pasada = Math.floor(k / 4);
  const entra = alfaEntradaAyuda(local, c);
  const sale = 1 - fundido(local - (intervalo - c.SALIDA_S), c.SALIDA_S);
  if (acumulado) {
    const ultimaDePasada = idx === 3;
    e.celdas = idx + 1;
    e.alfa = entra * (ultimaDePasada ? sale : 1);
    e.alfaResto = ultimaDePasada ? sale : 1;
  } else {
    e.celdas = 1;
    e.alfa = entra * sale;
    e.alfaResto = 0;
  }
  return e;
}
/** Texto del estado para el menú. */
export function textoEstadoAyuda(e: EstadoAyuda, c: CfgAyuda): string {
  if (e.fase === "espera") return `esperando (${e.quietoS.toFixed(1)} / ${c.ESPERA_S} s quieto)`;
  if (e.fase === "mostrando") return `mostrando ${LETRAS_AYUDA[Math.max(0, e.indicacion)]} · pasada ${e.pasada + 1} de ${c.PASADAS}`;
  if (e.fase === "saliendo") return "cancelada por movimiento (apagándose)";
  if (e.fase === "cancelada") return "cancelada por movimiento";
  return "terminada";
}

// ── Z104b: ubicación y tamaño (puro). La TINTA de la ayuda queda BAJAR × alto del bloque debajo de la TINTA del crédito,
// sea cual sea TAMANO (el plano se corre según dónde empieza la tinta dentro de la celda). Después se limita el tamaño:
// (1) la tinta no baja de max(piso + MARGEN_ABAJO_M, borde inferior de la zona iluminada); (2) la fila (4 celdas en
// "acumulado", 1 en "uno") no supera ANCHO_MAX_FILA × el ancho iluminado a la altura de la tinta (el más angosto entre
// arriba y abajo). Lo que se reduce se informa en factorAlto, factorAncho y factor (1 = sin reducir).
export interface ReflectorAyuda { atrasM: number; altoM: number; objetivoY: number; angulo: number; penumbra: number }
export interface CfgLayoutAyuda { TAMANO: number; BAJAR: number; MODO: string; ANCHO_MAX_FILA: number; MARGEN_ABAJO_M: number }
export interface EntradaLayoutAyuda {
  centroY: number;          // y del centro del bloque del título (m)
  offsetX: number;          // corrimiento horizontal del bloque respecto del eje del reflector (m)
  altoBloque: number;       // alto del bloque del título (m)
  creditoAbajoRel: number;  // borde inferior de la tinta del crédito, bajo el centro del bloque / alto del bloque (0,5 sin crédito)
  tintaArriba: number;      // dónde empieza la tinta en la celda, desde arriba (fracción del alto de la celda)
  tintaAbajo: number;       // dónde termina la tinta, desde arriba
  aspectoCelda: number;     // ancho / alto de una celda
  pisoM: number;            // y del borde inferior del telón (m)
  reflector: ReflectorAyuda;
}
export interface LayoutAyuda {
  y: number; hCelda: number; wCelda: number;                 // centro del plano y tamaño de una celda (m)
  creditoAbajoY: number; tintaArribaY: number; tintaAbajoY: number; limiteAbajoY: number;
  anchoFila: number; anchoUtil: number;                       // ancho de la fila completa del modo y ancho permitido (m)
  factorAlto: number; factorAncho: number; factor: number;
}
export function crearLayoutAyuda(): LayoutAyuda {
  return { y: 0, hCelda: 0, wCelda: 0, creditoAbajoY: 0, tintaArribaY: 0, tintaAbajoY: 0, limiteAbajoY: 0, anchoFila: 0, anchoUtil: 0, factorAlto: 1, factorAncho: 1, factor: 1 };
}
/** Semiángulo del haz a media intensidad (el mismo criterio que anchoZonaIluminada del texto del telón). */
function semiangulo(r: ReflectorAyuda): number {
  const cosExt = Math.cos(r.angulo), cosInt = Math.cos(r.angulo * (1 - sat(r.penumbra)));
  return Math.acos(Math.min(1, (cosExt + cosInt) / 2));
}
/** Ancho (m) de la zona iluminada sobre el telón a la altura y (0 si el haz no llega). En y = objetivoY coincide con
 *  anchoZonaIluminada. El haz es un cono desde (0, altoM, atrasM) hacia (0, objetivoY, 0); el telón es el plano z = 0. */
export function anchoIluminadoEn(y: number, r: ReflectorAyuda): number {
  const ay = r.objetivoY - r.altoM, az = -r.atrasM, n = Math.hypot(ay, az) || 1;
  const vy = y - r.altoM, vz = -r.atrasM, dot = (vy * ay + vz * az) / n;
  if (!(dot > 0)) return 0;
  const c = Math.cos(semiangulo(r));
  const x2 = (dot * dot) / (c * c) - vy * vy - vz * vz;
  return x2 > 0 ? 2 * Math.sqrt(x2) : 0;
}
/** y (m) del borde inferior de la zona iluminada (−Infinity si el haz no tiene borde inferior sobre el telón). */
export function bordeInferiorIluminado(r: ReflectorAyuda): number {
  const a = Math.atan2(r.altoM - r.objetivoY, r.atrasM) + semiangulo(r);
  return a >= Math.PI / 2 - 1e-6 ? -Infinity : r.altoM - r.atrasM * Math.tan(a);
}
export function layoutAyuda(c: CfgLayoutAyuda, en: EntradaLayoutAyuda, out: LayoutAyuda): LayoutAyuda {
  const hB = Math.max(1e-4, fin(en.altoBloque, 1)), asp = Math.max(0.1, fin(en.aspectoCelda, 2));
  const arriba = sat(fin(en.tintaArriba, 0.19)), abajo = Math.max(arriba + 0.01, Math.min(1, fin(en.tintaAbajo, 0.81))), rango = abajo - arriba;
  out.creditoAbajoY = en.centroY - hB * Math.max(0, fin(en.creditoAbajoRel, 0.5));
  out.tintaArribaY = out.creditoAbajoY - hB * Math.max(0, fin(c.BAJAR, 0.41));
  out.limiteAbajoY = Math.max(fin(en.pisoM, 0) + Math.max(0, fin(c.MARGEN_ABAJO_M, 0.3)), bordeInferiorIluminado(en.reflector));
  const h0 = Math.max(0.05, fin(c.TAMANO, 0.72)) * hB;
  let h = h0;
  const hMax = (out.tintaArribaY - out.limiteAbajoY) / rango;
  out.factorAlto = h > hMax ? Math.max(0, hMax) / h : 1;
  h *= out.factorAlto;
  const celdas = c.MODO === "acumulado" ? 4 : 1, tope = Math.max(0.1, Math.min(1, fin(c.ANCHO_MAX_FILA, 0.9)));
  out.factorAncho = 1;
  for (let i = 0; i < 2; i++) {   // el ancho útil depende de la altura de la tinta, que depende del tamaño: dos vueltas alcanzan
    const yAbajo = out.tintaArribaY - rango * h;
    const util = tope * Math.min(anchoIluminadoEn(out.tintaArribaY, en.reflector), anchoIluminadoEn(yAbajo, en.reflector)) - 2 * Math.abs(fin(en.offsetX, 0));
    out.anchoUtil = Math.max(0, util);
    const w = celdas * asp * h;
    if (w > out.anchoUtil) { const f = w > 0 ? out.anchoUtil / w : 1; h *= f; out.factorAncho *= f; }
  }
  out.hCelda = h; out.wCelda = h * asp; out.anchoFila = celdas * out.wCelda;
  out.tintaAbajoY = out.tintaArribaY - rango * h;
  out.factor = h0 > 0 ? h / h0 : 1;
  out.y = out.tintaArribaY + arriba * h - h / 2;   // centro del plano: su borde superior queda arriba × h sobre la tinta
  return out;
}
