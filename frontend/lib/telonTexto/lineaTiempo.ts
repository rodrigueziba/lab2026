// Z46: línea de tiempo del texto del telón. Pura y sin imports (se prueba en Node). Usa el tiempo de la
// experiencia (RELOJ.tExp, s): con la pausa el tiempo no avanza y todo queda congelado.
//
//   espera → (puede empezar) → entrando: parpadeo de reflector (FLICKER_N destellos en FLICKER_S) y fundido
//   de FADE_IN_S → visible → (DURACION_S desde el inicio, o lejos del telón, o la experiencia siguió) →
//   saliendo: fundido de FADE_OUT_S desde la opacidad que tenía → terminado (no vuelve; solo "Reproducir").

export type FaseTexto = "espera" | "activo" | "saliendo" | "terminado";

export interface CfgTiempoTexto {
  FADE_IN_S: number; FADE_OUT_S: number; DURACION_S: number;
  FLICKER_S: number; FLICKER_N: number; FLICKER_PICO: number;
}

export interface EstadoTexto {
  fase: FaseTexto;
  t0: number;          // s de experiencia en que empezó
  tSalida: number;     // s de experiencia en que empezó a salir
  alfaSalida: number;  // opacidad al empezar a salir
  alfa: number;        // salida: opacidad 0…1 de este frame
  motivo: "" | "duracion" | "distancia" | "experiencia";
}

export function crearEstadoTexto(): EstadoTexto {
  return { fase: "espera", t0: 0, tSalida: 0, alfaSalida: 0, alfa: 0, motivo: "" };
}

const sat = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const fin = (x: number, d = 0): number => (Number.isFinite(x) ? x : d);

/** Fundido suave 0…1 en dur segundos. */
export function fundido(dt: number, dur: number): number {
  if (!(dur > 1e-4)) return dt >= 0 ? 1 : 0;
  const x = sat(dt / dur);
  return x * x * (3 - 2 * x);
}

/**
 * Parpadeo de reflector que se enciende: en [0, FLICKER_S] hay FLICKER_N destellos (encendido en la primera
 * mitad de cada tramo, con duraciones algo desparejas). Devuelve -1 fuera del parpadeo.
 * Encendido = FLICKER_PICO; apagado = 0,25 × el fundido de ese momento (queda un resto de luz).
 */
export function parpadeo(dt: number, c: CfgTiempoTexto): number {
  const dur = Math.max(0, fin(c.FLICKER_S)), n = Math.max(0, Math.round(fin(c.FLICKER_N)));
  if (dt < 0 || dt >= dur || n === 0) return -1;
  const tramo = dur / n;
  const k = Math.min(n - 1, Math.floor(dt / tramo));
  const u = (dt - k * tramo) / tramo;
  const encendido = u < 0.35 + 0.1 * Math.sin(k * 2.3);   // primer tramo de cada destello, desparejo
  return encendido ? sat(c.FLICKER_PICO) : 0.25 * fundido(dt, c.FADE_IN_S);
}

/** Opacidad de la entrada a dt s del inicio (parpadeo y después fundido). */
export function alfaEntrada(dt: number, c: CfgTiempoTexto): number {
  const p = parpadeo(dt, c);
  return p >= 0 ? p : fundido(dt, c.FADE_IN_S);
}

/**
 * Un frame. t = tiempo de la experiencia (s). puedeEmpezar: telón a la vista, al inicio y sin checkpoint.
 * debeSalir: lejos del telón o la experiencia ya siguió (distancia/experiencia). pausado: todo congelado.
 */
export function avanzarTexto(
  e: EstadoTexto, c: CfgTiempoTexto, t: number, pausado: boolean,
  puedeEmpezar: boolean, lejos: boolean, experienciaSiguio: boolean,
): EstadoTexto {
  if (pausado) return e;
  const tt = fin(t, e.t0);
  if (e.fase === "espera") {
    if (puedeEmpezar && !experienciaSiguio) { e.fase = "activo"; e.t0 = tt; }
    else { e.alfa = 0; return e; }
  }
  if (e.fase === "activo") {
    const dt = tt - e.t0;
    e.alfa = alfaEntrada(dt, c);
    const motivo = experienciaSiguio ? "experiencia" : lejos ? "distancia" : dt >= Math.max(0, fin(c.DURACION_S, 25)) ? "duracion" : "";
    if (motivo) { e.fase = "saliendo"; e.tSalida = tt; e.alfaSalida = e.alfa; e.motivo = motivo; }
  }
  if (e.fase === "saliendo") {
    const k = 1 - fundido(tt - e.tSalida, c.FADE_OUT_S);
    e.alfa = e.alfaSalida * k;
    if (k <= 0) { e.fase = "terminado"; e.alfa = 0; }
  }
  if (e.fase === "terminado") e.alfa = 0;
  return e;
}

/** Reinicia (botón "Reproducir texto" del menú debug). */
export function reiniciarTexto(e: EstadoTexto): void {
  e.fase = "espera"; e.t0 = 0; e.tSalida = 0; e.alfaSalida = 0; e.alfa = 0; e.motivo = "";
}

/** Ancho (m) de la zona del telón iluminada por el reflector a media intensidad, en horizontal, en el punto
 *  apuntado. Spot de three: intensidad = smoothstep(cos(ángulo), cos(ángulo·(1−penumbra)), cos θ); la mitad
 *  cae en el punto medio de los cosenos. dist = reflector → punto apuntado. */
export function anchoZonaIluminada(dist: number, angulo: number, penumbra: number): number {
  const cosExt = Math.cos(angulo), cosInt = Math.cos(angulo * (1 - sat(penumbra)));
  const th = Math.acos(Math.min(1, (cosExt + cosInt) / 2));
  return 2 * Math.max(0, dist) * Math.tan(th);
}
