// Z69: tiempo de GPU por pase (DBG_RENDIMIENTO.GPU_POR_PASE). Sin imports (se prueba en Node con un gl simulado:
// scripts/rendimiento-z69-test.mjs).
//
// WebGL2 + EXT_disjoint_timer_query_webgl2 no permite consultas anidadas (una sola TIME_ELAPSED abierta a la vez). Por
// eso las mediciones son secuenciales: medirIni(e) cierra la consulta abierta (si hay), abre una nueva para e, y
// medirFin() la cierra y reabre la anterior. Así la textura del fractal (que se dibuja en medio de la escena, desde
// onBeforeRender) se mide aparte y la escena suma sus dos tramos. Las consultas van en una cola FIFO preasignada y se
// recogen sin bloquear (los resultados llegan unos cuadros después). Sin allocations por frame.
//
// Con el temporizador por cuadro (Z66) no se pueden medir pases a la vez: el host usa uno u otro.

export const ETIQUETAS_GPU = ["escena", "fractal", "bloom", "aa", "crt", "salida", "final", "destello"] as const;
export const E_GPU = { escena: 0, fractal: 1, bloom: 2, aa: 3, crt: 4, salida: 5, final: 6, destello: 7 } as const;
const NE = ETIQUETAS_GPU.length;
const POOL = 128;

export interface Gl2Min {
  createQuery(): unknown; deleteQuery(q: unknown): void;
  beginQuery(target: number, q: unknown): void; endQuery(target: number): void;
  getQueryParameter(q: unknown, pname: number): unknown; getParameter(pname: number): unknown;
  readonly QUERY_RESULT_AVAILABLE: number; readonly QUERY_RESULT: number;
}
export interface ExtTimer { readonly TIME_ELAPSED_EXT: number; readonly GPU_DISJOINT_EXT: number }

/** Resultados para el panel y el reporte (ms por cuadro de cada pase; los actualiza resumirGpu cada 0,5 s). */
export const GPU_PASES = {
  disponible: false,
  activo: false,                       // lo fija el host según DBG_RENDIMIENTO.GPU_POR_PASE
  ms: new Float64Array(NE),            // ms por cuadro de cada pase (última ventana)
  total: 0,                            // suma de los pases (ms por cuadro)
  fractalPorActualizacion: 0,          // ms de GPU por actualización (o franja) de la textura del fractal
  perdidas: 0, disjuntos: 0,           // consultas sin lugar en la cola / ventanas descartadas por disjoint
};

const S = {
  gl: null as Gl2Min | null, ext: null as ExtTimer | null,
  q: [] as unknown[], etq: new Int8Array(POOL), cab: 0, cola: 0, n: 0,
  abierta: -1, pila: new Int8Array(16), np: 0,
  suma: new Float64Array(NE), cuadros: 0, fractalN: 0,
};

export function iniciarGpuPases(gl: Gl2Min, ext: ExtTimer): void {
  liberarGpuPases();
  S.gl = gl; S.ext = ext;
  for (let i = 0; i < POOL; i++) S.q.push(gl.createQuery());
  GPU_PASES.disponible = true;
}
export function liberarGpuPases(): void {
  if (S.gl) {
    if (S.abierta >= 0 && S.ext) S.gl.endQuery(S.ext.TIME_ELAPSED_EXT);
    for (const q of S.q) if (q) S.gl.deleteQuery(q);
  }
  S.q.length = 0; S.gl = null; S.ext = null; S.cab = 0; S.cola = 0; S.n = 0; S.abierta = -1; S.np = 0;
  S.suma.fill(0); S.cuadros = 0; S.fractalN = 0;
  GPU_PASES.disponible = false; GPU_PASES.activo = false;
}

function abrir(e: number): void {
  const gl = S.gl!, ext = S.ext!;
  if (S.n >= POOL) { GPU_PASES.perdidas++; S.abierta = -2; return; }   // -2: "abierta" sin consulta (cola llena)
  gl.beginQuery(ext.TIME_ELAPSED_EXT, S.q[S.cola]);
  S.etq[S.cola] = e; S.cola = (S.cola + 1) % POOL; S.n++;
  S.abierta = e;
}
function cerrar(): void {
  if (S.abierta >= 0) S.gl!.endQuery(S.ext!.TIME_ELAPSED_EXT);
  S.abierta = -1;
}
/** Empieza a medir el pase e (índice de ETIQUETAS_GPU). Si había otro abierto, se pausa hasta medirFin(). */
export function medirIni(e: number): void {
  if (!GPU_PASES.activo || !S.gl) return;
  if (S.abierta !== -1) {
    if (S.np >= S.pila.length) return;
    S.pila[S.np++] = S.abierta >= 0 ? S.abierta : -1;
    cerrar();
  }
  abrir(e);
}
/** Termina el pase abierto y reanuda el anterior (si lo había). */
export function medirFin(): void {
  if (!GPU_PASES.activo || !S.gl || S.abierta === -1) return;
  cerrar();
  if (S.np > 0) { const e = S.pila[--S.np]; if (e >= 0) abrir(e); }
}
/** Cuenta una actualización de la textura del fractal (para ms por actualización). */
export function contarFractal(): void { if (GPU_PASES.activo) S.fractalN++; }
/** Recoge los resultados disponibles (en orden) y cuenta el cuadro. Llamar una vez por cuadro, después de dibujar. */
export function finCuadroGpu(): void {
  if (!S.gl || !S.ext) return;
  if (S.abierta !== -1) { cerrar(); S.np = 0; }   // nada queda abierto entre cuadros
  const gl = S.gl, disj = !!gl.getParameter(S.ext.GPU_DISJOINT_EXT);
  if (disj) GPU_PASES.disjuntos++;
  while (S.n > 0) {
    const q = S.q[S.cab];
    if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
    const ns = Number(gl.getQueryParameter(q, gl.QUERY_RESULT));
    if (!disj && Number.isFinite(ns)) S.suma[S.etq[S.cab]] += ns / 1e6;
    S.cab = (S.cab + 1) % POOL; S.n--;
  }
  if (GPU_PASES.activo) S.cuadros++;
}
/** Promedios de la ventana (ms por cuadro) y reinicio. Llamar cada ~0,5 s. */
export function resumirGpu(): void {
  const c = Math.max(1, S.cuadros);
  let t = 0;
  for (let i = 0; i < NE; i++) { GPU_PASES.ms[i] = S.suma[i] / c; t += GPU_PASES.ms[i]; }
  GPU_PASES.total = t;
  GPU_PASES.fractalPorActualizacion = S.fractalN > 0 ? S.suma[E_GPU.fractal] / S.fractalN : 0;
  S.suma.fill(0); S.cuadros = 0; S.fractalN = 0;
}
/** Texto "escena 3,1 · fractal 0,4 · …" (solo los pases con tiempo). Se arma cada 0,5 s, no por frame. */
export function textoGpuPases(): string {
  const p: string[] = [];
  for (let i = 0; i < NE; i++) if (GPU_PASES.ms[i] > 0.005) p.push(`${ETIQUETAS_GPU[i]} ${GPU_PASES.ms[i].toFixed(2)}`);
  return p.length ? `${p.join(" · ")} · suma ${GPU_PASES.total.toFixed(2)} ms` : "sin datos todavía";
}
