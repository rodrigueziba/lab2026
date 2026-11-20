// Z108: MANOS — base del seguimiento de manos (MediaPipe Hand Landmarker). Lógica PURA y sin imports (se prueba en Node:
// scripts/manos-test.mjs con landmarks sintéticos de 21 puntos).
//
// Entra, por cuadro, el buffer que devuelve el worker (lib/manosWorker.ts) o la simulación del menú:
//   [aspecto (ancho/alto del cuadro), n manos, y por cada mano (hasta 2): presente, etiqueta (1 = "Right" de MediaPipe),
//    confianza, 21 × (x, y, z)]  — x, y normalizadas 0…1 sobre la imagen (y hacia abajo), como las da MediaPipe.
// Sale, en estructuras preasignadas (sin allocations por cuadro): la mano elegida (MANO), sus rasgos (tamaño, centro,
// altura, apertura, ángulo, pellizco), la postura con histéresis y tolerancia de pérdida, y la altura filtrada (1 euro).
//
// Unidades: todo en "altos de imagen" (x se multiplica por el aspecto), así una distancia horizontal y una vertical valen
// lo mismo. La ALTURA va hacia arriba (1 − y): subir la mano sube la altura.
// Nada de esto sale de la máquina: el video no se sube ni se guarda, y los landmarks no se transmiten.

// ── índices de MediaPipe (21 puntos) ──
export const L_MUNECA = 0;
export const L_PULGAR_PUNTA = 4;
export const L_INDICE_BASE = 5, L_INDICE_PUNTA = 8;
export const L_MEDIO_BASE = 9, L_MEDIO_PUNTA = 12;
export const L_ANULAR_BASE = 13, L_ANULAR_PUNTA = 16;
export const L_MENIQUE_BASE = 17, L_MENIQUE_PUNTA = 20;
export const N_PUNTOS = 21;
/** Bases y puntas de los cuatro dedos (índice, medio, anular, meñique). */
export const DEDOS = [[L_INDICE_BASE, L_INDICE_PUNTA], [L_MEDIO_BASE, L_MEDIO_PUNTA], [L_ANULAR_BASE, L_ANULAR_PUNTA], [L_MENIQUE_BASE, L_MENIQUE_PUNTA]] as const;
/** Puntos que promedia el centro de la palma. */
export const PALMA = [L_MUNECA, L_INDICE_BASE, L_MEDIO_BASE, L_ANULAR_BASE, L_MENIQUE_BASE] as const;

// ── buffer del worker ──
export const MAX_MANOS = 2;
export const B_ASPECTO = 0, B_N = 1, B_CABECERA = 2;
export const M_PRESENTE = 0, M_ETIQUETA_DER = 1, M_CONFIANZA = 2, M_PUNTOS = 3;
export const STRIDE_MANO = M_PUNTOS + N_PUNTOS * 3;              // 66
export const N_BUF_MANOS = B_CABECERA + MAX_MANOS * STRIDE_MANO;  // 134

const fin = (x: number, d = 0): number => (Number.isFinite(x) ? x : d);
const acotar01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

// ── filtro "1 euro" (Casiez, Roussel y Vogel, 2012) ──
// Copia del de lib/cara.ts (mismo algoritmo y mismos nombres): este módulo es puro y sin imports a propósito.
export interface UnEuro { x: number; dx: number; t: number; listo: boolean }
export function crearUnEuro(): UnEuro { return { x: 0, dx: 0, t: 0, listo: false }; }
export function reiniciarUnEuro(f: UnEuro): void { f.listo = false; f.x = 0; f.dx = 0; f.t = 0; }
function alfa(corteHz: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * Math.max(1e-6, corteHz));
  return 1 / (1 + tau / Math.max(1e-6, dt));
}
export function filtrarUnEuro(f: UnEuro, x: number, tS: number, minCutoff: number, beta: number, dCutoff: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(tS)) return f.listo ? f.x : 0;
  if (!f.listo) { f.x = x; f.dx = 0; f.t = tS; f.listo = true; return x; }
  let dt = tS - f.t;
  if (!(dt > 0)) dt = 1 / 60;
  f.t = tS;
  const dxCrudo = (x - f.x) / dt;
  f.dx += alfa(Math.max(1e-3, fin(dCutoff, 1)), dt) * (dxCrudo - f.dx);
  const corte = Math.max(1e-3, fin(minCutoff, 1)) + Math.max(0, fin(beta, 0)) * Math.abs(f.dx);
  f.x += alfa(corte, dt) * (x - f.x);
  return f.x;
}

// ── lado de la mano ──
export type LadoMano = "derecha" | "izquierda";
export type ManoElegida = "derecha" | "izquierda" | "cualquiera";
/**
 * Lado del USUARIO a partir de la etiqueta de MediaPipe. MediaPipe etiqueta suponiendo una imagen espejada (selfie): con
 * la cámara web cruda (sin espejar, como llega del getUserMedia) la mano derecha del usuario sale etiquetada "Left".
 * ESPEJO = true invierte la etiqueta (es el caso de este proyecto: el cuadro va crudo al worker).
 */
export function ladoUsuario(etiquetaDerecha: boolean, espejo: boolean): LadoMano {
  const der = espejo ? !etiquetaDerecha : etiquetaDerecha;
  return der ? "derecha" : "izquierda";
}
/**
 * Hacia dónde queda la IZQUIERDA del usuario en la x de la imagen: con la imagen cruda (ESPEJO = true) la izquierda del
 * usuario es la derecha de la cámara (+x); con una imagen ya espejada, −x.
 */
export function signoIzquierdaUsuario(espejo: boolean): number { return espejo ? 1 : -1; }

// ── rasgos de una mano ──
export interface RasgosMano {
  tamano: number;          // muñeca → base del dedo medio (altos de imagen)
  cx: number; cy: number;  // centro de la palma (x en altos de imagen, y hacia abajo)
  altura: number;          // 1 − cy (hacia arriba)
  apertura: number;        // 0…1, promedio de los cuatro dedos (1 = estirados)
  aperturas: Float64Array; // por dedo
  angulo: number;          // grados de la dirección muñeca→dedo medio respecto de la horizontal hacia la izquierda del
                           // usuario (0 = apunta a su izquierda, ±90 = vertical, ±180 = a su derecha); + = hacia arriba
  pellizco: number;        // distancia pulgar–índice ÷ tamaño
}
export function crearRasgos(): RasgosMano { return { tamano: 0, cx: 0, cy: 0, altura: 0, apertura: 0, aperturas: new Float64Array(4), angulo: 0, pellizco: 0 }; }

/** Apertura de un dedo: cuánto más lejos de la muñeca está la punta que la base (curvado ≈ 1,0; estirado ≈ 1,8+). */
export const APERTURA_CERRADO = 1.1, APERTURA_ABIERTO = 1.65;

/**
 * Rasgos de la mano que empieza en buf[base] (los 21 puntos x, y, z). aspecto = ancho/alto del cuadro.
 * signoIzq = signoIzquierdaUsuario(ESPEJO) (para el ángulo, la mano izquierda usa el signo opuesto: ver anguloPostura).
 */
export function rasgosMano(buf: ArrayLike<number>, base: number, aspecto: number, signoIzq: number, out: RasgosMano): RasgosMano {
  const a = Math.max(0.1, fin(aspecto, 4 / 3));
  out.tamano = distP(buf, base, a, L_MUNECA, L_MEDIO_BASE);
  let sx = 0, sy = 0;
  for (let k = 0; k < PALMA.length; k++) { sx += pX(buf, base, a, PALMA[k]); sy += pY(buf, base, PALMA[k]); }
  out.cx = sx / PALMA.length; out.cy = sy / PALMA.length;
  out.altura = 1 - out.cy;
  let s = 0;
  for (let k = 0; k < 4; k++) {
    const db = distP(buf, base, a, L_MUNECA, DEDOS[k][0]);
    const r = db > 1e-6 ? distP(buf, base, a, L_MUNECA, DEDOS[k][1]) / db : 0;
    const ap = acotar01((r - APERTURA_CERRADO) / (APERTURA_ABIERTO - APERTURA_CERRADO));
    out.aperturas[k] = ap; s += ap;
  }
  out.apertura = s / 4;
  const dx = (pX(buf, base, a, L_MEDIO_BASE) - pX(buf, base, a, L_MUNECA)) * signoIzq;
  const dyArriba = pY(buf, base, L_MUNECA) - pY(buf, base, L_MEDIO_BASE);
  out.angulo = (Math.atan2(dyArriba, dx) * 180) / Math.PI;
  out.pellizco = out.tamano > 1e-6 ? distP(buf, base, a, L_PULGAR_PUNTA, L_INDICE_PUNTA) / out.tamano : 99;
  return out;
}
// helpers de módulo (sin clausuras: nada se crea por cuadro)
function pX(buf: ArrayLike<number>, base: number, a: number, i: number): number { return fin(buf[base + i * 3]) * a; }
function pY(buf: ArrayLike<number>, base: number, i: number): number { return fin(buf[base + i * 3 + 1]); }
function distP(buf: ArrayLike<number>, base: number, a: number, i: number, j: number): number {
  return Math.hypot(pX(buf, base, a, i) - pX(buf, base, a, j), pY(buf, base, i) - pY(buf, base, j));
}

// ── configuración (la escribe DBG_MANOS; acá solo los nombres que usa la lógica pura) ──
export interface CfgManos {
  MANO: ManoElegida;
  ESPEJO: boolean;
  POSTURA: "plana" | "abierta";
  POSTURA_TOL_GRADOS: number;
  POSTURA_HIST_GRADOS: number;      // histéresis del ángulo: para perder la postura hay que pasar TOL + HIST
  ABIERTA_ENTRAR: number;           // apertura para considerarla abierta…
  ABIERTA_SALIR: number;            // …y para dejar de considerarla (histéresis)
  UMBRAL_PELLIZCO: number;          // pulgar–índice ÷ tamaño por debajo de esto = pellizco…
  UMBRAL_PELLIZCO_SALIDA: number;   // …y por encima de esto se suelta (histéresis)
  TOLERANCIA_PERDIDA_MS: number;    // la mano (o la postura) puede faltar esto antes de soltar
  DEADBAND: number;                 // altura filtrada: cambios menores que esto no se mueven (altos de imagen)
  MINCUTOFF: number; BETA: number; DCUTOFF: number;   // filtro 1 euro de la altura
}

/** Ángulo respecto de la dirección "plana" de esa mano: la derecha apunta a la izquierda del usuario; la izquierda, a su
 * derecha (en espejo). Devuelve |desvío| en grados (0 = perfectamente plana). */
export function desvioPlana(anguloIzq: number, lado: LadoMano): number {
  const a = lado === "derecha" ? anguloIzq : (anguloIzq >= 0 ? 180 - anguloIzq : -180 - anguloIzq);
  return Math.abs(a);
}

// ── estado del seguimiento ──
export interface EstadoManos {
  rasgos: RasgosMano;
  vista: boolean;           // hay una mano del lado elegido en este cuadro
  lado: LadoMano | "";
  indice: number;           // cuál de las manos del buffer se eligió (−1 = ninguna)
  abierta: boolean;         // con histéresis
  anguloOk: boolean;        // con histéresis
  posturaCuadro: boolean;   // la postura se cumple en este cuadro (con histéresis)
  postura: boolean;         // la postura vale (con la tolerancia de pérdida)
  pellizco: boolean;        // con histéresis
  pellizcoValido: boolean;  // pellizco con la tolerancia de pérdida
  valida: boolean;          // mano vista y con postura (o dentro de la tolerancia): la altura se puede usar
  ultimoOkMs: number;       // último cuadro con mano y postura
  ultimoPellizcoMs: number;
  perdidaLarga: boolean;    // pasó la tolerancia: al volver se reinicia el filtro
  filtro: UnEuro;
  alturaFiltrada: number;
  alturaSalida: number;     // con deadband
  tamano: number;           // tamaño de la mano elegida (último válido)
  puntos: Float32Array;     // los 21 (x, y) de la mano elegida (para el esqueleto del menú)
}
export function crearEstadoManos(): EstadoManos {
  return {
    rasgos: crearRasgos(), vista: false, lado: "", indice: -1, abierta: false, anguloOk: false, posturaCuadro: false,
    postura: false, pellizco: false, pellizcoValido: false, valida: false, ultimoOkMs: -1e12, ultimoPellizcoMs: -1e12,
    perdidaLarga: true, filtro: crearUnEuro(), alturaFiltrada: 0, alturaSalida: 0, tamano: 0, puntos: new Float32Array(N_PUNTOS * 2),
  };
}
export function reiniciarManos(e: EstadoManos): void {
  e.vista = false; e.lado = ""; e.indice = -1; e.abierta = false; e.anguloOk = false; e.posturaCuadro = false;
  e.postura = false; e.pellizco = false; e.pellizcoValido = false; e.valida = false; e.ultimoOkMs = -1e12; e.ultimoPellizcoMs = -1e12;
  e.perdidaLarga = true; reiniciarUnEuro(e.filtro); e.alturaFiltrada = 0; e.alturaSalida = 0; e.tamano = 0;
}

const _r = crearRasgos();   // rasgos de prueba al elegir entre dos manos (preasignado)

/** ¿Esta mano del buffer sirve para MANO? (lado del usuario según ESPEJO). */
export function manoAdmitida(etiquetaDerecha: boolean, c: Pick<CfgManos, "MANO" | "ESPEJO">): boolean {
  if (c.MANO === "cualquiera") return true;
  return ladoUsuario(etiquetaDerecha, c.ESPEJO) === c.MANO;
}

/**
 * Un cuadro: elige la mano, calcula rasgos, postura y pellizco (con histéresis), aplica la tolerancia de pérdida y filtra
 * la altura. Sin allocations. Devuelve e.valida.
 */
export function procesarManos(e: EstadoManos, buf: ArrayLike<number>, tMs: number, c: CfgManos): boolean {
  const aspecto = fin(buf[B_ASPECTO], 4 / 3), n = Math.max(0, Math.min(MAX_MANOS, Math.round(fin(buf[B_N]))));
  const sIzq = signoIzquierdaUsuario(c.ESPEJO);
  // elegir: entre las admitidas, la más confiable; con "cualquiera", la que cumple la postura y si no la más grande
  let elegida = -1, mejor = -Infinity;
  for (let h = 0; h < n; h++) {
    const b = B_CABECERA + h * STRIDE_MANO;
    if (!(fin(buf[b + M_PRESENTE]) > 0.5)) continue;
    const etDer = fin(buf[b + M_ETIQUETA_DER]) > 0.5;
    if (!manoAdmitida(etDer, c)) continue;
    let puntaje = fin(buf[b + M_CONFIANZA]);
    if (c.MANO === "cualquiera") {
      rasgosMano(buf, b + M_PUNTOS, aspecto, sIzq, _r);
      const lado = ladoUsuario(etDer, c.ESPEJO);
      const ok = _r.apertura >= c.ABIERTA_ENTRAR && (c.POSTURA === "abierta" || desvioPlana(_r.angulo, lado) <= c.POSTURA_TOL_GRADOS);
      puntaje = (ok ? 10 : 0) + _r.tamano;
    }
    if (puntaje > mejor) { mejor = puntaje; elegida = h; }
  }
  const tS = tMs / 1000;
  if (elegida < 0) {
    e.vista = false; e.indice = -1; e.posturaCuadro = false; e.abierta = false; e.anguloOk = false; e.pellizco = false;
  } else {
    const b = B_CABECERA + elegida * STRIDE_MANO;
    const lado = ladoUsuario(fin(buf[b + M_ETIQUETA_DER]) > 0.5, c.ESPEJO);
    if (e.lado !== lado) { e.abierta = false; e.anguloOk = false; e.pellizco = false; }   // otra mano: sin histéresis heredada
    e.vista = true; e.indice = elegida; e.lado = lado;
    rasgosMano(buf, b + M_PUNTOS, aspecto, sIzq, e.rasgos);
    for (let i = 0; i < N_PUNTOS; i++) { e.puntos[i * 2] = fin(buf[b + M_PUNTOS + i * 3]); e.puntos[i * 2 + 1] = fin(buf[b + M_PUNTOS + i * 3 + 1]); }
    const r = e.rasgos;
    e.abierta = e.abierta ? r.apertura >= c.ABIERTA_SALIR : r.apertura >= c.ABIERTA_ENTRAR;
    const desv = desvioPlana(r.angulo, lado);
    e.anguloOk = c.POSTURA === "abierta" ? true : e.anguloOk ? desv <= c.POSTURA_TOL_GRADOS + c.POSTURA_HIST_GRADOS : desv <= c.POSTURA_TOL_GRADOS;
    e.posturaCuadro = e.abierta && e.anguloOk;
    e.pellizco = e.pellizco ? r.pellizco < c.UMBRAL_PELLIZCO_SALIDA : r.pellizco < c.UMBRAL_PELLIZCO;
    if (e.pellizco) e.ultimoPellizcoMs = tMs;
  }
  const tol = Math.max(0, c.TOLERANCIA_PERDIDA_MS);
  if (e.vista && e.posturaCuadro) {
    if (e.perdidaLarga) { reiniciarUnEuro(e.filtro); e.perdidaLarga = false; }   // volvió después de la tolerancia: sin arrastre del filtro
    e.ultimoOkMs = tMs;
    e.tamano = e.rasgos.tamano;
    e.alturaFiltrada = filtrarUnEuro(e.filtro, e.rasgos.altura, tS, c.MINCUTOFF, c.BETA, c.DCUTOFF);
    if (!e.filtro.listo || Math.abs(e.alturaFiltrada - e.alturaSalida) >= Math.max(0, c.DEADBAND) || e.alturaSalida === 0) e.alturaSalida = e.alturaFiltrada;
  }
  const dentro = tMs - e.ultimoOkMs <= tol;
  e.postura = (e.vista && e.posturaCuadro) || dentro;
  if (!dentro && !(e.vista && e.posturaCuadro)) e.perdidaLarga = true;
  // valida: la altura de ESTE cuadro es de la mano con postura (dentro de la tolerancia la altura se congela: no valida)
  e.valida = e.vista && e.posturaCuadro;
  e.pellizcoValido = e.pellizco || tMs - e.ultimoPellizcoMs <= tol;
  return e.valida;
}

// ── buffers sintéticos (simulación del menú y pruebas) ──
/**
 * Escribe en buf una mano "plana" sintética: muñeca en (cx, cy) de la imagen, tamaño t (altos de imagen), apuntando con
 * angulo (grados, 0 = izquierda del usuario, + arriba) para ese lado; dedos estirados (abierta) o curvados; pulgar
 * pegado al índice si pellizco. ESPEJO define hacia dónde es la izquierda del usuario en la imagen.
 */
export function escribirManoSintetica(buf: Float32Array | number[], h: number, o: {
  lado: LadoMano; espejo: boolean; cx: number; cy: number; t: number; angulo: number; abierta: boolean; pellizco: boolean; aspecto: number; confianza?: number;
}): void {
  const b = B_CABECERA + h * STRIDE_MANO;
  buf[B_ASPECTO] = o.aspecto;
  buf[B_N] = Math.max(fin(buf[B_N]), h + 1);
  buf[b + M_PRESENTE] = 1;
  // etiqueta de MediaPipe que corresponde a ese lado del usuario con ese ESPEJO
  buf[b + M_ETIQUETA_DER] = (o.espejo ? o.lado === "izquierda" : o.lado === "derecha") ? 1 : 0;
  buf[b + M_CONFIANZA] = o.confianza ?? 0.95;
  const sIzq = signoIzquierdaUsuario(o.espejo);
  // dirección de la mano en "altos de imagen" (x hacia la izquierda del usuario, y hacia arriba)
  const angLado = o.lado === "derecha" ? o.angulo : 180 - o.angulo;   // la izquierda apunta a la derecha del usuario
  const rad = (angLado * Math.PI) / 180;
  const ux = Math.cos(rad), uy = Math.sin(rad);          // a lo largo de la mano
  const px = -uy, py = ux;                                // a lo ancho (perpendicular)
  // (cx, cy) = muñeca en coordenadas normalizadas de la imagen; los desplazamientos van en altos de imagen hacia la
  // izquierda del usuario y hacia arriba, y se pasan a la imagen (con sIzq = +1 la izquierda del usuario es +x)
  _sint.b = b; _sint.cx = o.cx; _sint.cy = o.cy; _sint.t = o.t; _sint.asp = o.aspecto; _sint.s = sIzq;
  _sint.ux = ux; _sint.uy = uy; _sint.px = px; _sint.py = py;
  ponerPunto(buf, L_MUNECA, 0, 0);
  const anchos = ANCHOS_SINT, largos = LARGOS_SINT;
  for (let k = 0; k < 4; k++) {
    const bi = DEDOS[k][0], pi = DEDOS[k][1];
    ponerPunto(buf, bi, largos[k], anchos[k]);
    ponerPunto(buf, bi + 1, largos[k] + 0.35, anchos[k]);
    ponerPunto(buf, bi + 2, largos[k] + (o.abierta ? 0.6 : 0.25), anchos[k]);
    ponerPunto(buf, pi, o.abierta ? largos[k] + 0.85 : largos[k] * 0.55, anchos[k]);   // curvado: la punta vuelve hacia la palma
  }
  // pulgar: del lado del índice; con pellizco, la punta sobre la del índice
  ponerPunto(buf, 1, 0.25, 0.30); ponerPunto(buf, 2, 0.45, 0.45); ponerPunto(buf, 3, 0.6, 0.55);
  if (o.pellizco) { ponerPunto(buf, L_PULGAR_PUNTA, (o.abierta ? largos[0] + 0.85 : largos[0] * 0.55) - 0.05, anchos[0] + 0.03); }
  else ponerPunto(buf, L_PULGAR_PUNTA, 0.75, 0.75);
}
const ANCHOS_SINT = [0.22, 0, -0.18, -0.34] as const;      // índice, medio, anular, meñique (a lo ancho de la palma)
const LARGOS_SINT = [0.95, 1.0, 0.95, 0.85] as const;      // base de cada dedo (muñeca → base del medio = 1 tamaño)
const _sint = { b: 0, cx: 0, cy: 0, t: 0, asp: 1, s: 1, ux: 1, uy: 0, px: 0, py: 1 };
function ponerPunto(buf: Float32Array | number[], i: number, along: number, across: number): void {
  const S = _sint;
  buf[S.b + M_PUNTOS + i * 3] = S.cx + (S.s * (along * S.ux + across * S.px) * S.t) / S.asp;
  buf[S.b + M_PUNTOS + i * 3 + 1] = S.cy - (along * S.uy + across * S.py) * S.t;   // y de imagen hacia abajo
  buf[S.b + M_PUNTOS + i * 3 + 2] = 0;
}
/** Vacía el buffer (sin manos). */
export function vaciarBufManos(buf: Float32Array | number[], aspecto = 4 / 3): void {
  for (let i = 0; i < buf.length; i++) buf[i] = 0;
  buf[B_ASPECTO] = aspecto;
}
