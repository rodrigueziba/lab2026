// Z105: modo de espera (cámara cenital con esfera). Lógica PURA y SIN imports (prueba: scripts/espera-camara-test.mjs).
// La integra components/EsperaCamara.tsx; camaraLibre() (qué sistemas la bloquean) está en lib/esperaCamaraLibre.ts.
//
//   contando (IDLE_S sin entrada) → subiendo → arriba → (cualquier entrada) → bajando → contando
//   inactivo: camaraLibre() da un motivo (la cuenta vuelve a 0). En pausa todo queda congelado.
//
// Un solo parámetro de avance p (0 = control normal, 1 = arriba) con velocidad suavizada (constante de tiempo
// SUAVIZADO_S): al invertir de subida a bajada la velocidad pasa por 0 sin tirones. La pose es función de p:
//   altura y(p) = y0 + (yFinal − y0) · S(p)                    (S = smoothstep: arranca y frena suave)
//   inclinación: de la del despegue a −90° con S(u), u = (y − y0) / (ALTURA_CENITAL_M − y0): llega a −90° JUSTO a los 9 m
//   deslizamiento al centro (CENTRAR): S(w), w = (y − ALTURA_CENITAL_M) / (yFinal − ALTURA_CENITAL_M), solo en el tramo cenital
// Como la pose depende solo de p (y de dónde está la esfera), la bajada recorre exactamente la misma trayectoria al revés.
// Sin allocations: todo escribe en objetos que se pasan.

export const TEXTO_ESPERA_ENTRA = "Modo de espera: mové el mouse o apretá una tecla para volver";
export const TEXTO_ESPERA_SALE = "Volviste al control";

export type FaseEspera = "inactivo" | "contando" | "subiendo" | "arriba" | "bajando";
export interface CfgEspera {
  IDLE_S: number; SUBIDA_S: number; BAJADA_S: number; SUAVIZADO_S: number; APARECE_S: number;
}
export interface EstadoEspera {
  fase: FaseEspera;
  quietoS: number;        // segundos sin entrada (contando)
  p: number;              // avance 0…1
  v: number;              // velocidad de p (1/s), suavizada
  alfaEsfera: number;     // aparición de la esfera 0…1
  despego: boolean;       // este cuadro empezó (el componente guarda la pose del despegue)
  aterrizo: boolean;      // este cuadro terminó (el control vuelve)
  anunciarEntrada: boolean;
  anunciarSalida: boolean;
  modo: boolean;          // la cámara está tomada (subiendo, arriba o bajando)
}
export function crearEstadoEspera(): EstadoEspera {
  return { fase: "contando", quietoS: 0, p: 0, v: 0, alfaEsfera: 0, despego: false, aterrizo: false, anunciarEntrada: false, anunciarSalida: false, modo: false };
}
export function reiniciarEspera(e: EstadoEspera): void {
  e.fase = "contando"; e.quietoS = 0; e.p = 0; e.v = 0; e.alfaEsfera = 0;
  e.despego = false; e.aterrizo = false; e.anunciarEntrada = false; e.anunciarSalida = false; e.modo = false;
}
export interface EntradasEspera {
  entrada: boolean;    // mouse (sobre el umbral), clic, rueda, tecla o toque este cuadro
  bloqueado: boolean;  // camaraLibre() dio un motivo (no se activa; la cuenta vuelve a 0)
  pausado: boolean;    // pausa de la experiencia: nada avanza
  oculto: boolean;     // pestaña oculta o sin foco: no cuenta (y al volver empieza de 0)
  reducir: boolean;    // prefers-reduced-motion con RESPETAR_REDUCIR_MOVIMIENTO: no se activa
  forzar: boolean;     // menú: "Forzar modo de espera ahora"
  salir: boolean;      // menú: "Salir del modo de espera" (baja como con una entrada)
  abortar: boolean;    // algo tomó la cámara a mitad del modo (checkpoint, atril, diálogo…): vuelve al instante
}
const sat = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const fin = (x: number, d: number): number => (Number.isFinite(x) ? x : d);
export function suave(x: number): number { const t = sat(x); return t * t * (3 - 2 * t); }

function terminar(e: EstadoEspera): void {
  e.fase = "contando"; e.p = 0; e.v = 0; e.quietoS = 0; e.modo = false; e.aterrizo = true; e.anunciarSalida = true;
}
/** Un cuadro de dt segundos (reloj del cuadro; en pausa no avanza nada). */
export function avanzarEspera(e: EstadoEspera, dt: number, en: EntradasEspera, c: CfgEspera): EstadoEspera {
  e.despego = false; e.aterrizo = false; e.anunciarEntrada = false; e.anunciarSalida = false;
  const d = Math.max(0, Math.min(0.1, fin(dt, 0)));   // un tirón largo no salta la trayectoria
  // aparición / retiro de la esfera (sigue aunque el modo ya haya terminado)
  const ap = Math.max(1e-3, fin(c.APARECE_S, 0.6));
  if (en.pausado) return e;
  e.alfaEsfera = sat(e.alfaEsfera + (e.modo ? d : -d) / ap);

  if (e.modo) {
    if (en.abortar) { terminar(e); e.alfaEsfera = 0; return e; }
    if ((en.entrada || en.salir) && e.fase !== "bajando") e.fase = "bajando";
    const vObj = e.fase === "subiendo" ? 1 / Math.max(0.5, fin(c.SUBIDA_S, 16)) : e.fase === "bajando" ? -1 / Math.max(0.5, fin(c.BAJADA_S, 20)) : 0;
    const tau = Math.max(1e-3, fin(c.SUAVIZADO_S, 0.4));
    e.v += (vObj - e.v) * (1 - Math.exp(-d / tau));
    e.p += e.v * d;
    if (e.p >= 1) { e.p = 1; if (e.v > 0) e.v = 0; if (e.fase === "subiendo") e.fase = "arriba"; }
    if (e.p <= 0) {
      e.p = 0;
      if (e.fase === "bajando") terminar(e);
      else if (e.v < 0) e.v = 0;
    }
    return e;
  }
  // contando / inactivo
  if (en.bloqueado || (en.oculto && !en.forzar) || en.reducir) { e.fase = "inactivo"; e.quietoS = 0; return e; }   // "Forzar" (menú) no espera el foco
  e.fase = "contando";
  if (en.forzar) e.quietoS = Math.max(e.quietoS, fin(c.IDLE_S, 60));
  else if (en.entrada) { e.quietoS = 0; return e; }
  else e.quietoS += d;
  if (e.quietoS >= Math.max(0, fin(c.IDLE_S, 60)) - 1e-9) {
    e.fase = "subiendo"; e.modo = true; e.p = 0; e.v = 0; e.despego = true; e.anunciarEntrada = true;
  }
  return e;
}

/** Altura (m sobre el piso) a la que un círculo de radio r (en el piso, centrado bajo la cámara) entra en el encuadre
 *  con el margen, mirando recto hacia abajo. Usa el más chico de los dos campos de visión. Con tope. */
export function alturaDeEncuadre(radio: number, fovVerticalRad: number, aspecto: number, margen: number, tope: number): number {
  const v = Math.max(1e-3, Math.min(Math.PI - 1e-3, fin(fovVerticalRad, Math.PI / 2)));
  const tv = Math.tan(v / 2), th = tv * Math.max(1e-3, fin(aspecto, 1));   // tan del semiángulo horizontal
  const t = Math.min(tv, th);
  const h = (Math.max(0, fin(radio, 0)) * Math.max(1, fin(margen, 1.15))) / t;
  return Math.min(Math.max(0, fin(tope, 120)), h);
}

export interface Pose { x: number; y: number; z: number; yaw: number; pitch: number }
export function crearPose(): Pose { return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }; }
export interface CfgPose { ALTURA_CENITAL_M: number; CENTRAR: boolean }
export const CENITAL = -Math.PI / 2;
/** Altura final efectiva: nunca por debajo de la altura cenital (si el escenario entra antes, se detiene a los 9 m). */
export function alturaFinalEfectiva(alturaFinal: number, y0: number, c: CfgPose): number {
  return Math.max(fin(alturaFinal, 0), fin(c.ALTURA_CENITAL_M, 9), y0 + 0.01);
}
/**
 * Pose de la cámara para el avance p. pose0: la del despegue (altura de los ojos, yaw e inclinación); posUsuario: la
 * esfera (adonde baja); centro: centro del escenario (deslizamiento con CENTRAR). El yaw se conserva siempre.
 */
export function poseDeCamara(p: number, pose0: Pose, posUsuario: { x: number; z: number }, centro: { x: number; z: number },
  alturaFinal: number, c: CfgPose, out: Pose): Pose {
  const y0 = pose0.y, hc = Math.max(y0 + 0.01, fin(c.ALTURA_CENITAL_M, 9));
  const yF = alturaFinalEfectiva(alturaFinal, y0, c);
  const y = y0 + (yF - y0) * suave(p);
  const u = (y - y0) / (hc - y0);
  out.pitch = pose0.pitch + (CENITAL - pose0.pitch) * suave(u);
  out.yaw = pose0.yaw;
  out.y = y;
  const w = yF - hc > 1e-6 ? suave((y - hc) / (yF - hc)) : (y >= hc - 1e-9 ? 1 : 0);
  const k = c.CENTRAR ? w : 0;
  out.x = posUsuario.x + (centro.x - posUsuario.x) * k;
  out.z = posUsuario.z + (centro.z - posUsuario.z) * k;
  return out;
}

/** Radio a encuadrar: con CENTRAR, el del círculo del escenario; sin CENTRAR, la distancia de la esfera al borde más lejano. */
export function radioAEncuadrar(radio: number, centro: { x: number; z: number }, pos: { x: number; z: number }, centrar: boolean): number {
  return centrar ? radio : radio + Math.hypot(pos.x - centro.x, pos.z - centro.z);
}

/** Círculo que abarca n puntos (centro de la caja que los contiene y la distancia al más lejano) más un margen. */
export function circuloEscenario(xs: ArrayLike<number>, zs: ArrayLike<number>, n: number, extra: number, out: { cx: number; cz: number; r: number }): { cx: number; cz: number; r: number } {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) { const x = xs[i], z = zs[i]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  if (!(n > 0)) { out.cx = 0; out.cz = 0; out.r = Math.max(0, extra); return out; }
  out.cx = (x0 + x1) / 2; out.cz = (z0 + z1) / 2;
  let r = 0;
  for (let i = 0; i < n; i++) { const dd = Math.hypot(xs[i] - out.cx, zs[i] - out.cz); if (dd > r) r = dd; }
  out.r = r + Math.max(0, fin(extra, 0));
  return out;
}

export interface EstadoEsfera { x: number; z: number; recorrido: number; dx: number; dz: number }
export function crearEsfera(): EstadoEsfera { return { x: 0, z: 0, recorrido: 0, dx: 0, dz: 0 }; }
export interface TeclasEsfera { w: boolean; a: boolean; s: boolean; d: boolean }
/**
 * La esfera como personaje: W A S D en la dirección del yaw del despegue (W hacia donde miraba el usuario), con el
 * mismo paso que la caminata (paso = m de este cuadro) y la MISMA función de movimiento y colisión (mover).
 * Devuelve la distancia realmente recorrida (después de los límites) y la deja en dx, dz (para el giro).
 */
export function avanzarEsfera(e: EstadoEsfera, t: TeclasEsfera, yaw: number, paso: number,
  mover: (p: { x: number; z: number }, d: { x: number; z: number }) => void, tmp: { x: number; z: number }): number {
  e.dx = 0; e.dz = 0;
  // frente de la cámara con yaw (orden YXZ, mira a −Z con yaw 0) y costado = arriba × frente (como Player)
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), sx = fz, sz = -fx;
  let dx = 0, dz = 0;
  if (t.w) { dx += fx; dz += fz; }
  if (t.s) { dx -= fx; dz -= fz; }
  if (t.a) { dx += sx; dz += sz; }
  if (t.d) { dx -= sx; dz -= sz; }
  const l = Math.hypot(dx, dz);
  if (!(l > 1e-9) || !(paso > 0)) return 0;
  tmp.x = (dx / l) * paso; tmp.z = (dz / l) * paso;
  const x0 = e.x, z0 = e.z;
  mover(e, tmp);
  e.dx = e.x - x0; e.dz = e.z - z0;
  const r = Math.hypot(e.dx, e.dz);
  e.recorrido += r;
  return r;
}
/** Escala de la esfera según la altura de la cámara (para distinguirla desde arriba), con tope. */
export function escalaEsfera(alturaCam: number, coef: number, tope: number): number {
  return Math.min(Math.max(1, fin(tope, 1)), Math.max(1, fin(alturaCam, 0) * Math.max(0, fin(coef, 0))));
}
/** Texto del estado para el menú. */
export function textoFaseEspera(e: EstadoEspera, c: CfgEspera): string {
  if (e.fase === "inactivo") return "inactivo (bloqueado)";
  if (e.fase === "contando") return `contando (${e.quietoS.toFixed(1)} / ${c.IDLE_S} s quieto)`;
  return `${e.fase} · p ${e.p.toFixed(3)}`;
}
