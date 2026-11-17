// Z82: monolitos del camino SILLAS frente a una sesión en vivo de la TARIMA (solo local: sin red). Lógica PURA, sin
// imports (prueba: scripts/monolitos-vivo-test.mjs). La une con el audio y la escena lib/monolitosVivoAcciones.ts.
// Referencia: docs/EVALUACION_CONEXION_VIVO.md, secciones d (máquina de estados, mezcla por distancia) y f.
//
// DISEÑO PEDIDO POR EL USUARIO (copiado tal cual):
//  - Monolito de sonido: al acercarse, el audio propio del visualizador se reemplaza de a poco, según la distancia, por el
//    audio de la sesión de la tarima; si no hay sesión, por ruido (estática). Si está lo bastante cerca, el reemplazo es
//    total y se sostiene 15 s después de alejarse; luego el audio original vuelve de forma progresiva. En esos 15 s, si va
//    al monolito de video, el audio de la tarima se mantiene; si va a cualquier otro lado, el audio original vuelve de
//    inmediato (de forma progresiva). Al volver a acercarse, el contador de 15 s se reinicia.
//  - Monolito de video: igual, pero con la proyección del domo (en esta tarea solo la máquina de estados y el evento; el
//    video en el domo va en otra tarea).
//  - Regla cruzada (Z77b, pregunta 3): "ir al otro monolito" = la distancia a él baja o entra en su radio; alejarse de los
//    dos durante 0,6 s = cancelar.
//  - Una sola sesión en vivo a la vez (la más reciente).
//
// Estados por monolito: lejos → acercandose (peso = curva de la distancia) → cerca (peso 1, contador = SOSTENER_S) →
// sosteniendo (peso 1, el contador baja; se congela mientras va hacia el otro monolito o está en su radio) → retornando
// (el peso baja a 0 en RETORNO_S; si se acerca de nuevo, el peso nunca queda por debajo de la curva de la distancia).
// Cancelar: en sosteniendo, si la distancia a los DOS monolitos crece durante CANCELAR_S → retornando enseguida.
// "Se mueve hacia / se aleja de" = la distancia cambia más rápido que UMBRAL_VEL_MS (m/s): quieto no cuenta como ninguno.
// alejandoseTrasCerca: true en sosteniendo y retornando cuando se llegó desde cerca (para el efecto de tiempo detenido,
// que se dispara al alejarse y solo sin sesión: lo decide la tarea que lo implemente).

export type EstadoMono = "lejos" | "acercandose" | "cerca" | "sosteniendo" | "retornando";
export const ESTADOS_MONO: readonly EstadoMono[] = ["lejos", "acercandose", "cerca", "sosteniendo", "retornando"];

export interface CfgMonoVivo {
  RADIO_INICIO_M: number;   // empieza el reemplazo
  RADIO_TOTAL_M: number;    // reemplazo total
  SOSTENER_S: number;       // ventana de sostén al alejarse
  RETORNO_S: number;        // vuelta progresiva al original
  CANCELAR_S: number;       // alejarse de los dos durante esto cancela el sostén
  UMBRAL_VEL_MS: number;    // velocidad mínima (m/s) para "acercarse" o "alejarse"
}

export interface Mono {
  estado: EstadoMono;
  peso: number;             // 0 = audio/video propio · 1 = remoto
  sostenRestanteS: number;
  alejandoAmbosS: number;   // tiempo seguido alejándose de los dos
  dPrev: number;            // distancia del cuadro anterior (NaN = sin dato)
  vinoDeCerca: boolean;
  alejandoseTrasCerca: boolean;
  congelado: boolean;       // el contador está detenido porque va hacia el otro monolito (o está en su radio)
}

export function crearMono(): Mono {
  return { estado: "lejos", peso: 0, sostenRestanteS: 0, alejandoAmbosS: 0, dPrev: NaN, vinoDeCerca: false, alejandoseTrasCerca: false, congelado: false };
}
export function reiniciarMono(m: Mono): void {
  m.estado = "lejos"; m.peso = 0; m.sostenRestanteS = 0; m.alejandoAmbosS = 0; m.dPrev = NaN;
  m.vinoDeCerca = false; m.alejandoseTrasCerca = false; m.congelado = false;
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const fin = (x: number, d: number): number => (Number.isFinite(x) ? x : d);

/** Peso por distancia (0 fuera de RADIO_INICIO, 1 dentro de RADIO_TOTAL), suave (smoothstep). */
export function pesoDistancia(d: number, c: CfgMonoVivo): number {
  const ini = Math.max(c.RADIO_INICIO_M, c.RADIO_TOTAL_M + 1e-6);
  const t = clamp01((ini - fin(d, Infinity)) / (ini - c.RADIO_TOTAL_M));
  return t * t * (3 - 2 * t);
}

/** Mezcla de potencia constante: original = cos(p·π/2), remoto = sin(p·π/2) (orig² + rem² = 1). */
export function mezclaEqualPower(peso: number, out: { orig: number; rem: number }): { orig: number; rem: number } {
  const p = clamp01(fin(peso, 0)) * Math.PI / 2;
  out.orig = Math.cos(p); out.rem = Math.sin(p);
  return out;
}

/**
 * Un paso de la máquina de un monolito.
 * d = distancia a este monolito; dOtro = distancia al otro; otroRadioInicio = su radio de inicio; dt en s (0 = en pausa).
 * Devuelve true si cambió el estado.
 */
export function tickMono(m: Mono, d: number, dOtro: number, dOtroPrev: number, dt: number, c: CfgMonoVivo): boolean {
  const antes = m.estado;
  const h = Math.max(0, fin(dt, 0));
  const prox = pesoDistancia(d, c);
  const vel = h > 0 && Number.isFinite(m.dPrev) ? (d - m.dPrev) / h : 0;              // > 0 = se aleja
  const velOtro = h > 0 && Number.isFinite(dOtroPrev) ? (dOtro - dOtroPrev) / h : 0;
  const u = Math.max(0, c.UMBRAL_VEL_MS);

  if (fin(d, Infinity) <= c.RADIO_TOTAL_M) {
    m.estado = "cerca"; m.peso = 1; m.sostenRestanteS = c.SOSTENER_S;   // al volver a acercarse, el contador se reinicia
    m.vinoDeCerca = true; m.alejandoAmbosS = 0; m.congelado = false;
  } else if (m.estado === "cerca" || m.estado === "sosteniendo") {
    m.estado = "sosteniendo"; m.peso = 1;
    const haciaOtro = velOtro < -u || fin(dOtro, Infinity) <= c.RADIO_INICIO_M;
    m.congelado = haciaOtro;
    if (vel > u && velOtro > u) m.alejandoAmbosS += h; else m.alejandoAmbosS = 0;
    if (!haciaOtro) m.sostenRestanteS -= h;
    if (m.alejandoAmbosS >= c.CANCELAR_S || m.sostenRestanteS <= 0) {
      m.estado = "retornando"; m.alejandoAmbosS = 0; m.congelado = false;
    }
  } else if (m.estado === "retornando") {
    m.peso = Math.max(prox, m.peso - h / Math.max(0.01, c.RETORNO_S));
    if (m.peso <= prox) { m.estado = prox > 0 ? "acercandose" : "lejos"; m.vinoDeCerca = false; }
  } else {
    m.peso = prox;
    m.estado = prox > 0 ? "acercandose" : "lejos";
    m.vinoDeCerca = false;
  }
  m.alejandoseTrasCerca = m.vinoDeCerca && (m.estado === "sosteniendo" || m.estado === "retornando");
  m.dPrev = d;
  return m.estado !== antes;
}

/** Los dos monolitos (sonido = derecho, video = izquierdo) en un paso. Las distancias previas salen de cada máquina. */
export function tickPar(sonido: Mono, video: Mono, dSonido: number, dVideo: number, dt: number, c: CfgMonoVivo): number {
  const prevS = sonido.dPrev, prevV = video.dPrev;
  let cambios = 0;
  if (tickMono(sonido, dSonido, dVideo, prevV, dt, c)) cambios |= 1;
  if (tickMono(video, dVideo, dSonido, prevS, dt, c)) cambios |= 2;
  return cambios;
}

/**
 * Peso efectivo de la mezcla remota. Con sesión y REQUIERE_ACEPTACION sin aceptar, no hay mezcla remota (queda el
 * propio). Sin sesión, el remoto es el ruido (estática).
 */
export function pesoEfectivo(peso: number, haySesion: boolean, requiereAceptacion: boolean, aceptada: boolean): number {
  if (haySesion && requiereAceptacion && !aceptada) return 0;
  return clamp01(peso);
}
