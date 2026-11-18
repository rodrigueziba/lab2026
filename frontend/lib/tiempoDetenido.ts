// Z84: efecto de tiempo detenido simulado del camino SILLAS. Lógica PURA, sin imports, con el tiempo inyectado
// (prueba: scripts/tiempo-detenido-test.mjs). La une con el audio, el posproceso y el menú lib/tiempoDetenidoAcciones.ts.
//
// DISEÑO PEDIDO POR EL USUARIO:
//  - El efecto se percibe al ALEJARSE de un monolito (de cualquiera de los dos), como consecuencia de haberse acercado;
//    no mientras se acerca.
//  - Solo se aplica si NO hay sesión en la tarima (MONO_VIVO.haySesion false). Una caída de la conexión cuenta como "no
//    hay sesión", así que también lo dispara.
//  - Se aplica al audio original del visualizador (caída de velocidad y de tono, como una cinta que se frena, y vuelta
//    progresiva a lo normal) y a la cámara propia del usuario (un shader tipo CRT que el usuario pasará después).
//  - NUNCA se aplica a lo que llega por streaming desde la tarima.
//
// Envolvente k (0…1):
//  - Disparo: un monolito pasa a "alejándose tras haber estado cerca" (Z82) y no hay sesión → k = pico, con
//    pico = peso máximo alcanzado al acercarse (sale de Z82; si llegó a "cerca" es 1). Con DISPARO_PARCIAL también se
//    dispara al alejarse sin haber llegado a "cerca" (peso que baja ≥ 0,05 desde un máximo ≥ 0,2): ahí el pico es menor.
//  - Bajada: lineal a 0 en DURACION_S; si aparece una sesión mientras dura, en CORTE_S.
//  - Volver a acercarse al monolito que lo disparó (llegar otra vez a "cerca") lo corta (en CORTE_S): es de salida.
//  - kSuave = k con subida limitada (ATAQUE_S): la cinta se frena en ATAQUE_S en vez de saltar de tono (sin clics).
//  - dt = reloj de la experiencia: 0 en la pausa central → todo quieto.

export interface CfgTiempo {
  ACTIVO: boolean; DURACION_S: number; CORTE_S: number; ATAQUE_S: number; RATE_MIN: number;
  INTENSIDAD_AUDIO: number; INTENSIDAD_VISUAL: number; DISPARO_PARCIAL: boolean;
}
export type FuenteTiempo = "" | "sonido" | "video" | "manual";
export interface MonoLeido { estado: string; peso: number; alejandoseTrasCerca: boolean }
export interface EstadoTiempo {
  k: number; kSuave: number; fuente: FuenteTiempo; corte: boolean;
  previo: { sonido: boolean; video: boolean }; pesoMax: { sonido: number; video: number }; disparos: number;
}

export function crearTiempo(): EstadoTiempo {
  return { k: 0, kSuave: 0, fuente: "", corte: false, previo: { sonido: false, video: false }, pesoMax: { sonido: 0, video: 0 }, disparos: 0 };
}
const fin = (x: number, d: number): number => (Number.isFinite(x) ? x : d);
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

function disparar(st: EstadoTiempo, pico: number, fuente: FuenteTiempo): void {
  if (pico <= 0) return;
  st.k = Math.max(st.k, clamp01(pico)); st.fuente = fuente; st.corte = false; st.disparos++;
}

/** Un paso. Devuelve true si se disparó en este paso. */
export function tickTiempo(st: EstadoTiempo, sonido: MonoLeido, video: MonoLeido, haySesion: boolean, dt: number, c: CfgTiempo): boolean {
  const h = Math.max(0, fin(dt, 0));
  if (!c.ACTIVO) { st.k = 0; st.kSuave = 0; st.fuente = ""; st.previo.sonido = sonido.alejandoseTrasCerca; st.previo.video = video.alejandoseTrasCerca; return false; }
  let disparo = false;
  for (const [nombre, m] of [["sonido", sonido], ["video", video]] as const) {
    const previo = st.previo[nombre];
    // máximo acercamiento desde la última vez que estuvo lejos (antes de alejarse tras cerca)
    if (m.estado === "lejos") st.pesoMax[nombre] = 0;
    else if (!m.alejandoseTrasCerca) {
      const max = st.pesoMax[nombre];
      if (c.DISPARO_PARCIAL && st.k === 0 && m.estado === "acercandose" && max >= 0.2 && m.peso <= max - 0.05 && !haySesion) {
        disparar(st, max, nombre); disparo = true; st.pesoMax[nombre] = m.peso;   // nuevo máximo desde acá
      } else st.pesoMax[nombre] = Math.max(max, fin(m.peso, 0));
    }
    if (m.alejandoseTrasCerca && !previo && !haySesion) { disparar(st, Math.max(st.pesoMax[nombre], 1e-3), nombre); disparo = true; st.pesoMax[nombre] = 0; }
    st.previo[nombre] = m.alejandoseTrasCerca;
    // volver a acercarse al monolito que lo disparó lo corta
    // (solo "cerca": al retornar, Z82 puede pasar a "acercandose" mientras el usuario todavía se aleja dentro del radio)
    if (st.fuente === nombre && st.k > 0 && !disparo && m.estado === "cerca") st.corte = true;
  }
  if (haySesion && st.k > 0) st.corte = true;   // apareció una sesión mientras dura
  if (!disparo && st.k > 0) {
    const dur = st.corte ? Math.max(0.05, fin(c.CORTE_S, 1)) : Math.max(0.05, fin(c.DURACION_S, 6));
    st.k = Math.max(0, st.k - h / dur);
    if (st.k === 0) { st.fuente = ""; st.corte = false; }
  }
  // subida limitada (la bajada sigue a k)
  const ataque = Math.max(0.001, fin(c.ATAQUE_S, 0.35));
  st.kSuave = st.k > st.kSuave ? Math.min(st.k, st.kSuave + h / ataque) : st.k;
  return disparo;
}

/** "Disparar ahora" (debug): k = 1 sin condiciones. */
export function dispararManual(st: EstadoTiempo): void { disparar(st, 1, "manual"); }
export function pararTiempo(st: EstadoTiempo): void { st.k = 0; st.kSuave = 0; st.fuente = ""; st.corte = false; }

/** Velocidad del mp3 propio: 1 − k · INTENSIDAD_AUDIO · (1 − RATE_MIN). */
export function tasaAudio(k: number, c: CfgTiempo): number {
  const rmin = Math.min(1, Math.max(0.05, fin(c.RATE_MIN, 0.5)));
  return 1 - clamp01(k * Math.max(0, fin(c.INTENSIDAD_AUDIO, 1))) * (1 - rmin);
}
/** k del shader (uTiempoK). */
export function kVisual(k: number, c: CfgTiempo): number { return Math.max(0, k * Math.max(0, fin(c.INTENSIDAD_VISUAL, 1))); }
