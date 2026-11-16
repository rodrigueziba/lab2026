// Z66: rendimiento. Lógica PURA (sin three, sin imports), testeable en Node (scripts/rendimiento-test.mjs):
//  · estadísticas de tiempo de frame (anillo de los últimos 5 s; media, p95, p99 sin allocations por frame)
//  · resolución adaptativa (escalones de DPR con histéresis y veda anti-rebote; quieta en estados bloqueados)
//  · secuenciador del benchmark (línea base, cada sistema apagado, DPR 1 / 0,75 / 0,5) y su reporte de texto
// Lo usan components/RendimientoHost.tsx (dentro del Canvas) y components/RendimientoPanel.tsx (menú debug).

const fin = (x: number, d = 0): number => (Number.isFinite(x) ? x : d);

// ── estadísticas de frame ──
export const MAX_MUESTRAS = 2048;   // 5 s a 400 fps
export interface EstadFrame {
  ms: Float64Array; t: Float64Array; n: number; i: number;   // anillo: duración del frame y momento (s)
  orden: Float64Array;                                         // copia para ordenar (preasignada)
}
export function crearEstadFrame(): EstadFrame {
  return { ms: new Float64Array(MAX_MUESTRAS), t: new Float64Array(MAX_MUESTRAS), n: 0, i: 0, orden: new Float64Array(MAX_MUESTRAS) };
}
export function agregarFrame(e: EstadFrame, ms: number, ahoraS: number): void {
  e.ms[e.i] = Math.max(0, fin(ms)); e.t[e.i] = fin(ahoraS);
  e.i = (e.i + 1) % MAX_MUESTRAS; if (e.n < MAX_MUESTRAS) e.n++;
}
export function vaciarEstad(e: EstadFrame): void { e.n = 0; e.i = 0; }
/** Percentil por rango más cercano sobre los primeros n valores de a (ya ordenados ascendente). */
export function percentilOrdenado(a: ArrayLike<number>, n: number, p: number): number {
  if (n <= 0) return 0;
  const k = Math.min(n - 1, Math.max(0, Math.ceil((Math.min(100, Math.max(0, p)) / 100) * n) - 1));
  return a[k];
}
export interface Resumen { media: number; p95: number; p99: number; fps: number; fps1s: number; n: number }
export function crearResumen(): Resumen { return { media: 0, p95: 0, p99: 0, fps: 0, fps1s: 0, n: 0 }; }
/** Resume las muestras de los últimos ventanaS segundos (y el FPS del último segundo). Escribe en out. */
export function resumir(e: EstadFrame, ahoraS: number, ventanaS: number, out: Resumen): Resumen {
  let n = 0, suma = 0, n1 = 0, s1 = 0;
  for (let k = 0; k < e.n; k++) {
    const j = (e.i - 1 - k + MAX_MUESTRAS) % MAX_MUESTRAS;
    const edad = ahoraS - e.t[j];
    if (edad > ventanaS) break;
    e.orden[n++] = e.ms[j]; suma += e.ms[j];
    if (edad <= 1) { n1++; s1 += e.ms[j]; }
  }
  const sub = e.orden.subarray(0, n);   // vista (no copia); se llama cada 0,5 s, no por frame
  sub.sort();
  out.n = n; out.media = n ? suma / n : 0;
  out.p95 = percentilOrdenado(sub, n, 95); out.p99 = percentilOrdenado(sub, n, 99);
  out.fps = out.media > 0 ? 1000 / out.media : 0;
  out.fps1s = s1 > 0 ? (1000 * n1) / s1 : 0;
  return out;
}

// ── resolución adaptativa ──
/** DPR aplicado ahora (lo escribe RendimientoHost cada vez que llama a setDpr). El <Canvas> lo pasa como prop: R3F
 *  reaplica su prop dpr en cada render del Canvas si difiere del actual, y con un valor fijo pisaría el adaptativo. */
export const DPR_VIVO = { v: 0 };
/** DPR para el prop del Canvas: el vivo si ya hay uno; si no, el del dispositivo con tope DPR_MAX. */
export function dprCanvas(dprMax: number, dprDispositivo: number): number {
  return DPR_VIVO.v > 0 ? DPR_VIVO.v : Math.min(fin(dprDispositivo, 1) || 1, fin(dprMax, 1.5));
}
export const ESCALONES_DPR = [1.5, 1.25, 1.0, 0.85, 0.7, 0.5] as const;
export interface CfgDpr {
  DPR_MAX: number; DPR_MIN: number; DPR_AUTO: boolean; OBJETIVO_FPS: number; SUBIR_FPS: number;
  EVAL_S: number; SUBIR_S: number; ENTRE_CAMBIOS_S: number; REBOTE_S: number; REBOTE_VEDA_S: number;
}
export interface EstadoDpr {
  escalones: number[]; idx: number;              // escalón actual (0 = el más alto)
  vSuma: number; vN: number; vT0: number;         // ventana de evaluación en curso
  sobreS: number;                                 // tiempo sostenido por encima de SUBIR_FPS
  tCambio: number; tSubida: number;               // último cambio y última subida (s)
  vedaIdx: number; vedaHasta: number;             // no subir por encima de vedaIdx hasta vedaHasta (anti-rebote)
  rebotes: number;                                // rebotes seguidos: la veda se duplica con cada uno (tope 600 s)
  cambios: number; ultimoFps: number; forzado: number;   // forzado > 0: DPR fijo por botón
}
/** Escalones posibles: los de la lista entre DPR_MIN y min(DPR_MAX, DPR del dispositivo). Si el tope no está en la
 *  lista (p. ej. dispositivo con DPR 1,1), se agrega como primer escalón. */
export function escalonesPara(c: Pick<CfgDpr, "DPR_MAX" | "DPR_MIN">, dprDispositivo: number): number[] {
  const tope = Math.max(0.25, Math.min(fin(c.DPR_MAX, 1.5), fin(dprDispositivo, 1) || 1));
  const piso = Math.max(0.25, Math.min(tope, fin(c.DPR_MIN, 0.5)));
  const r: number[] = [];
  for (const v of ESCALONES_DPR) if (v <= tope + 1e-6 && v >= piso - 1e-6) r.push(v);
  if (!r.length || r[0] < tope - 1e-6) r.unshift(tope);
  return r;
}
export function crearEstadoDpr(escalones: number[]): EstadoDpr {
  return { escalones, idx: 0, vSuma: 0, vN: 0, vT0: -1, sobreS: 0, tCambio: -1e9, tSubida: -1e9, vedaIdx: -1, vedaHasta: -1e9, rebotes: 0, cambios: 0, ultimoFps: 0, forzado: 0 };
}
export function dprActual(e: EstadoDpr): number { return e.forzado > 0 ? e.forzado : e.escalones[Math.min(e.idx, e.escalones.length - 1)]; }
/** Rehace la lista de escalones (cambió DPR_MAX/MIN) conservando el DPR más cercano al actual. */
export function reescalonar(e: EstadoDpr, escalones: number[]): void {
  const actual = dprActual(e);
  let mejor = 0;
  for (let k = 0; k < escalones.length; k++) if (Math.abs(escalones[k] - actual) < Math.abs(escalones[mejor] - actual)) mejor = k;
  e.escalones = escalones; e.idx = mejor;
}
/** Un frame. dtS: duración del frame (s); ahoraS: reloj real (s); bloqueado: destello, entrada, pausa, checkpoint o
 *  benchmark → no cambia y descarta la ventana. Devuelve true si cambió el escalón en este frame. */
export function tickDpr(e: EstadoDpr, c: CfgDpr, dtS: number, ahoraS: number, bloqueado: boolean): boolean {
  if (bloqueado || !c.DPR_AUTO || e.forzado > 0) { e.vN = 0; e.vSuma = 0; e.vT0 = -1; e.sobreS = 0; return false; }
  const dt = Math.max(0, fin(dtS));
  if (dt <= 0 || dt > 0.5) return false;          // pausa del navegador o pestaña oculta: no cuenta
  if (e.vT0 < 0) e.vT0 = ahoraS;
  e.vSuma += dt; e.vN++;
  const ventana = Math.max(0.25, fin(c.EVAL_S, 1.5));
  if (ahoraS - e.vT0 < ventana) return false;
  const fps = e.vN / Math.max(1e-6, e.vSuma);
  e.ultimoFps = fps; e.vN = 0; e.vSuma = 0; e.vT0 = ahoraS;
  const libre = ahoraS - e.tCambio >= Math.max(0, fin(c.ENTRE_CAMBIOS_S, 3));
  if (fps < fin(c.OBJETIVO_FPS, 50)) {
    e.sobreS = 0;
    if (!libre || e.idx >= e.escalones.length - 1) return false;
    // anti-rebote: si se acaba de subir y hay que volver a bajar, el escalón de arriba queda vedado; la veda se duplica
    // con cada rebote seguido (30, 60, 120… s) y se olvida cuando una subida se sostiene más de REBOTE_S
    if (ahoraS - e.tSubida < fin(c.REBOTE_S, 10)) {
      e.rebotes++;
      e.vedaIdx = e.idx + 1;
      e.vedaHasta = ahoraS + Math.min(600, fin(c.REBOTE_VEDA_S, 30) * Math.pow(2, e.rebotes - 1));
    } else e.rebotes = 0;
    e.idx++; e.tCambio = ahoraS; e.cambios++;
    return true;
  }
  if (fps >= fin(c.SUBIR_FPS, 58)) {
    e.sobreS += ventana;
    const vedado = ahoraS < e.vedaHasta && e.idx - 1 < e.vedaIdx;
    if (e.sobreS >= fin(c.SUBIR_S, 4) && libre && e.idx > 0 && !vedado) {
      e.idx--; e.tCambio = ahoraS; e.tSubida = ahoraS; e.sobreS = 0; e.cambios++;
      return true;
    }
    return false;
  }
  e.sobreS = 0;   // entre el objetivo y SUBIR_FPS: se queda
  return false;
}

// ── sistemas que se pueden apagar (DBG_RENDIMIENTO.SIS[id]) y qué se apaga en cada uno ──
export const SISTEMAS = [
  { id: "pasto",      etiqueta: "pasto",            como: "Pasto.tsx: mallas invisibles (la lógica de crecimiento sigue)" },
  { id: "fractal",    etiqueta: "fractal del prisma", como: "Prism.tsx: mallas del fractal invisibles → tampoco se recalcula su textura (onBeforeRender)" },
  { id: "domo",       etiqueta: "cúpula y cielo",   como: "ExperienceDome: malla domo-cielo (shader del portal entero) invisible" },
  { id: "anillos",    etiqueta: "anillos y ondas",  como: "dome.frag.glsl: rama por uniform (uPerfAnillos) que salta túnel de anillos y ondas" },
  { id: "flare",      etiqueta: "lens flare del sol", como: "SolFlare dentro de un grupo invisible" },
  { id: "bloom",      etiqueta: "bloom",            como: "RetroPostFX: el bloom (Z69: liviano, o el Unreal con BLOOM_OPTIMIZADO off) enabled = false" },
  { id: "crt",        etiqueta: "CRT",              como: "RetroPostFX: pase CRT enabled = false (Z69, pases fusionados: el pase final saltea el CRT por uniform; no ahorra un pase)" },
  { id: "salida",     etiqueta: "salida (ACES+sRGB)", como: "RetroPostFX: OutputPass enabled = false (Z69, fusionados: el pase final saltea ACES + sRGB). Los colores se ven mal: solo para medir" },
  { id: "luces",      etiqueta: "luces y haces",    como: "LucesHaz en grupo invisible + las 4 SpotLights de HazSystem invisibles (recompila). No aísla los anillos de HazRings (transitorios, van directo a la escena)" },
  { id: "flor",       etiqueta: "flor",             como: "FlorCiclo dentro de un grupo invisible" },
  { id: "monolitos",  etiqueta: "monolitos",        como: "MonolitosPasto dentro de un grupo invisible (con sus 8 luces: recompila)" },
  { id: "telonTexto", etiqueta: "texto del telón",  como: "TelonTexto dentro de un grupo invisible" },
  { id: "estrellas",  etiqueta: "estrellas",        como: "CieloEstrellado dentro de un grupo invisible" },
  // Z72: partes del shader del domo (uniforms uPerf* de dome.frag.glsl: ramas por uniform, como uPerfAnillos)
  { id: "domoFluido",    etiqueta: "domo: fluir de color",  como: "dome.frag.glsl: uPerfFluido salta el fluido de los bloques azul y naranja (Z61/Z63)" },
  { id: "domoSol",       etiqueta: "domo: sol",             como: "dome.frag.glsl: uPerfSol salta solMundo (núcleo, rayos y resplandor; también dentro del portal)" },
  { id: "domoOndas",     etiqueta: "domo: ondas por kick",  como: "dome.frag.glsl: uPerfOndas salta el bucle de ondas (los anillos base siguen)" },
  { id: "domoEstrellas", etiqueta: "domo: estrellas y cielo", como: "dome.frag.glsl: uPerfEstrellas salta las estrellas (mundo y portal) y la textura fbm del cielo del mundo" },
  { id: "domoPortal",    etiqueta: "domo: cielo del portal", como: "dome.frag.glsl: uPerfPortal salta el interior del portal (warp, sol ilustrado, nubes, destellos)" },
  { id: "domoSiluetas",  etiqueta: "domo: siluetas",        como: "dome.frag.glsl: uPerfSiluetas salta las montañas y olas ilustradas (máscaras y texturas; el fluido va adentro)" },
] as const;

// ── benchmark ──
export const DPR_BENCH = [1, 0.75, 0.5] as const;
export interface PasoBench { tipo: "base" | "sistema" | "dpr"; id: string; etiqueta: string; dpr: number; vuelta?: boolean }
export interface ResultadoBench {
  paso: PasoBench; media: number; p95: number; fps: number; gpu: number; n: number;
  dif?: number; difGpu?: number; vueltas?: number;   // Z69: |ida − vuelta| (ms) y cuántas mediciones se promediaron
}
export interface EstadoBench {
  activo: boolean; pasos: PasoBench[]; k: number; fase: "calentando" | "midiendo"; t0: number;
  suma: number; n: number; muestras: Float64Array; gpuSuma: number; gpuN: number;
  resultados: ResultadoBench[]; cancelado: boolean; reporte: string;
}
export function crearEstadoBench(): EstadoBench {
  return { activo: false, pasos: [], k: 0, fase: "calentando", t0: 0, suma: 0, n: 0, muestras: new Float64Array(MAX_MUESTRAS), gpuSuma: 0, gpuN: 0, resultados: [], cancelado: false, reporte: "" };
}
export function pasosBench(sistemas: readonly { id: string; etiqueta: string }[]): PasoBench[] {
  const p: PasoBench[] = [{ tipo: "base", id: "base", etiqueta: "línea base", dpr: 0 }];
  for (const s of sistemas) p.push({ tipo: "sistema", id: s.id, etiqueta: `sin ${s.etiqueta}`, dpr: 0 });
  for (const d of DPR_BENCH) p.push({ tipo: "dpr", id: `dpr${d}`, etiqueta: `DPR ${d}`, dpr: d });
  return p;
}
/** Z69: cada condición se mide dos veces, a la ida y a la vuelta (orden inverso), para estimar el ruido. */
export function pasosBenchIdaVuelta(sistemas: readonly { id: string; etiqueta: string }[]): PasoBench[] {
  const ida = pasosBench(sistemas);
  const vuelta: PasoBench[] = [];
  for (let i = ida.length - 1; i >= 0; i--) vuelta.push({ ...ida[i], vuelta: true });
  return ida.concat(vuelta);
}
/** Z69: promedia las mediciones de la misma condición (ida y vuelta) y guarda su diferencia. */
export function combinarIdaVuelta(res: ResultadoBench[]): ResultadoBench[] {
  const orden: string[] = [], grupos: Record<string, ResultadoBench[]> = {};
  for (const r of res) { if (!grupos[r.paso.id]) { grupos[r.paso.id] = []; orden.push(r.paso.id); } grupos[r.paso.id].push(r); }
  return orden.map(id => {
    const g = grupos[id], n = g.length;
    const media = g.reduce((a, r) => a + r.media, 0) / n, p95 = g.reduce((a, r) => a + r.p95, 0) / n;
    const conGpu = g.filter(r => r.gpu > 0), gpu = conGpu.length ? conGpu.reduce((a, r) => a + r.gpu, 0) / conGpu.length : 0;
    const dif = n > 1 ? Math.max(...g.map(r => r.media)) - Math.min(...g.map(r => r.media)) : undefined;
    const difGpu = conGpu.length > 1 ? Math.max(...conGpu.map(r => r.gpu)) - Math.min(...conGpu.map(r => r.gpu)) : undefined;
    return { paso: { ...g[0].paso, vuelta: false }, media, p95, fps: media > 0 ? 1000 / media : 0, gpu, n: g.reduce((a, r) => a + r.n, 0), dif, difGpu, vueltas: n };
  });
}
/** Z69: diferencias menores que esto (ms) se marcan "ruido" en el reporte (ruido medido ≈ 0,3 ms). */
export const UMBRAL_RUIDO_MS = 0.4;
export function esRuido(difMs: number, umbral = UMBRAL_RUIDO_MS): boolean { return Math.abs(fin(difMs)) < umbral; }

// ── Z69: refresco del monitor (Z72: meseta de cuadros estables + valores típicos) ──
/** Z72: refrescos típicos (75, 100 y 240 Hz fuera: en Z69 el estimador de mínimos daba 144 en un monitor de 120 Hz). */
export const HZ_CANDIDATOS = [60, 90, 120, 144, 165] as const;
/** FPS posibles con vsync a hz (un cuadro tarda 1, 2, 3… períodos): 120 → 120, 60, 40, 30. */
export function cuantizacion(hz: number, n = 4): number[] {
  const r: number[] = [];
  for (let k = 1; k <= n; k++) r.push(fin(hz, 60) / k);
  return r;
}
export interface EstimacionRefresco { hz: number; grilla: number; minimos: number; n: number; meseta?: number; fpsMeseta?: number }
export const VENTANA_MESETA = 30;   // cuadros por ventana
export const TOL_MESETA = 0.025;    // la meseta tiene que caer a ±2,5 % de un refresco típico
/** Refresco a partir de los intervalos de rAF (ms). Se toma el mayor de dos estimadores (o 60 si ninguno decide):
 *   · meseta (Z72): FPS medio de ventanas de VENTANA_MESETA cuadros consecutivos; la meseta es la mediana de las 3
 *     mejores ventanas. Si cae a ±2,5 % de un refresco típico, el sistema está pegado al refresco: es ese. El promedio
 *     de la ventana absorbe el jitter de rAF (pares de 7 y 9,7 ms a 120 Hz, que antes pasaban por 144 Hz)
 *   · grilla (Z69): el menor refresco típico cuya grilla (múltiplos del período) explica ≥ 85 % de los intervalos
 *     (a 120 Hz con cuadros de 16,7 y 25 ms, 60 Hz no explica los de 25 ms y 120 sí)
 *  inicio: índice del intervalo más viejo en ms (anillo; 0 si ms ya está en orden). tmp: buffer preasignado (≥ n). */
export function estimarRefrescoIntervalos(ms: ArrayLike<number>, n: number, tmp: Float64Array, out?: EstimacionRefresco, inicio = 0): EstimacionRefresco {
  const o = out ?? { hz: 60, grilla: 0, minimos: 0, n: 0, meseta: 0, fpsMeseta: 0 };
  const L = ms.length;
  let m = 0;
  const N = Math.min(n, L, tmp.length);
  for (let k = 0; k < N; k++) { const x = ms[(inicio + k) % L]; if (x >= 2 && x <= 100) tmp[m++] = x; }
  o.n = m; o.grilla = 0; o.minimos = 0; o.meseta = 0; o.fpsMeseta = 0; o.hz = 60;
  if (m < 30) return o;
  // meseta: las 3 mejores ventanas (sin ordenar el buffer: se guardan los tres máximos)
  let b1 = 0, b2 = 0, b3 = 0;
  for (let a = 0; a + VENTANA_MESETA <= m; a += VENTANA_MESETA) {
    let s = 0;
    for (let k = a; k < a + VENTANA_MESETA; k++) s += tmp[k];
    const f = (1000 * VENTANA_MESETA) / s;
    if (f > b1) { b3 = b2; b2 = b1; b1 = f; } else if (f > b2) { b3 = b2; b2 = f; } else if (f > b3) b3 = f;
  }
  const fm = b3 > 0 ? b2 : b2 > 0 ? (b1 + b2) / 2 : b1;   // mediana de las 3 mejores (o lo que haya)
  o.fpsMeseta = fm;
  for (const hz of HZ_CANDIDATOS) if (Math.abs(fm - hz) <= TOL_MESETA * hz) { o.meseta = hz; break; }
  // grilla
  for (const hz of HZ_CANDIDATOS) {
    const P = 1000 / hz, tol = Math.max(0.6, 0.07 * P);
    let ok = 0;
    for (let i = 0; i < m; i++) { const k = Math.round(tmp[i] / P); if (k >= 1 && Math.abs(tmp[i] - k * P) <= tol) ok++; }
    if (ok >= 0.85 * m) { o.grilla = hz; break; }
  }
  // informativo (Z69): mediana del 10 % de intervalos más cortos. Ya no decide: el jitter lo inflaba
  const sub = tmp.subarray(0, m); sub.sort();
  const nb = Math.max(1, Math.floor(m * 0.1));
  o.minimos = Math.round(1000 / sub[Math.floor(nb / 2)]);
  o.hz = Math.max(o.grilla, o.meseta, 60);
  return o;
}

// ── Z72: objetivo de la resolución adaptativa según el refresco ──
export interface CfgObjetivo { OBJETIVO_FPS: number; SUBIR_FPS: number; OBJETIVO_POR_REFRESCO: boolean; MARGEN_ALTO_HZ: number; SUBIR_FRACCION_ALTO: number }
/** Con refresco ≥ 100 Hz los cuadros se cuantizan a refresco, refresco/2, refresco/3…: el objetivo es casi la mitad del
 *  refresco (120 Hz → 57 FPS) y para subir de escalón hay que sostener refresco × SUBIR_FRACCION_ALTO (90 FPS). Con
 *  menos de 100 Hz (60), los valores de siempre (OBJETIVO_FPS, SUBIR_FPS). */
export function objetivosDpr(hz: number, c: CfgObjetivo, out: { objetivo: number; subir: number }): { objetivo: number; subir: number } {
  const h = fin(hz, 60);
  if (c.OBJETIVO_POR_REFRESCO && h >= 100) {
    out.objetivo = h / 2 - Math.max(0, fin(c.MARGEN_ALTO_HZ, 3));
    out.subir = Math.max(out.objetivo + 5, h * fin(c.SUBIR_FRACCION_ALTO, 0.75));
  } else { out.objetivo = fin(c.OBJETIVO_FPS, 50); out.subir = fin(c.SUBIR_FPS, 58); }
  return out;
}
/** Z72: último escalón estable (localStorage). */
export const CLAVE_ESCALON = "alight:dpr-escalon";
type AlmacenR = { getItem(k: string): string | null; setItem(k: string, v: string): void } | null | undefined;
export function leerEscalon(s: AlmacenR): number | null {
  try { const v = s ? Number(s.getItem(CLAVE_ESCALON)) : NaN; return Number.isFinite(v) && v > 0 && v <= 4 ? v : null; } catch { return null; }
}
export function guardarEscalon(s: AlmacenR, dpr: number): boolean {
  try { if (!s || !(dpr > 0)) return false; s.setItem(CLAVE_ESCALON, String(dpr)); return true; } catch { return false; }
}
/** Índice del escalón más cercano a un DPR guardado (para arrancar ahí). */
export function indiceEscalon(escalones: readonly number[], dpr: number): number {
  let mejor = 0;
  for (let k = 0; k < escalones.length; k++) if (Math.abs(escalones[k] - dpr) < Math.abs(escalones[mejor] - dpr)) mejor = k;
  return mejor;
}

export const CALIENTA_S = 1.5, MIDE_S = 4;
export function duracionBenchS(nPasos: number): number { return nPasos * (CALIENTA_S + MIDE_S); }
export function iniciarBench(b: EstadoBench, pasos: PasoBench[], ahoraS: number): void {
  b.activo = true; b.pasos = pasos; b.k = 0; b.fase = "calentando"; b.t0 = ahoraS; b.suma = 0; b.n = 0;
  b.gpuSuma = 0; b.gpuN = 0; b.resultados = []; b.cancelado = false; b.reporte = "";
}
export type AccionBench = "nada" | "aplicar" | "restaurar" | "fin";
/** Un frame. Devuelve "aplicar" al empezar un paso (apagar su sistema o fijar su DPR), "restaurar" al terminarlo (el
 *  host restaura y en el mismo frame aplica el siguiente si lo hay: ver bench.k), "fin" al terminar todo. */
export function tickBench(b: EstadoBench, frameMs: number, gpuMs: number, ahoraS: number): AccionBench {
  if (!b.activo) return "nada";
  if (b.fase === "calentando") {
    if (ahoraS - b.t0 >= CALIENTA_S) { b.fase = "midiendo"; b.t0 = ahoraS; b.suma = 0; b.n = 0; b.gpuSuma = 0; b.gpuN = 0; }
    return "nada";
  }
  const ms = fin(frameMs);
  if (ms > 0 && ms < 500 && b.n < MAX_MUESTRAS) { b.muestras[b.n++] = ms; b.suma += ms; }
  if (gpuMs > 0) { b.gpuSuma += gpuMs; b.gpuN++; }
  if (ahoraS - b.t0 < MIDE_S) return "nada";
  const sub = b.muestras.subarray(0, b.n); sub.sort();
  const media = b.n ? b.suma / b.n : 0;
  b.resultados.push({ paso: b.pasos[b.k], media, p95: percentilOrdenado(sub, b.n, 95), fps: media > 0 ? 1000 / media : 0, gpu: b.gpuN ? b.gpuSuma / b.gpuN : 0, n: b.n });
  b.k++; b.fase = "calentando"; b.t0 = ahoraS;
  if (b.k >= b.pasos.length) { b.activo = false; return "fin"; }
  return "restaurar";
}
export function cancelarBench(b: EstadoBench): void { b.activo = false; b.cancelado = true; }

export interface InfoBench {
  gpu: string; dpr: number; px: string; refrescoHz: number; timerGpu: boolean; escena: string;
  // Z69 (opcionales)
  canvasW?: number; canvasH?: number; metodoRefresco?: string; gpuPases?: string; config?: string;
  pose?: string;   // Z72: dónde se midió (aquí, cerca del prisma, en la luz 1) y la pose de la cámara
}
/** Z72: la ganancia de GPU no es fiable si difiere más de FACTOR_GPU veces de la de rAF (o tiene otro signo y no es
 *  ruido). Pasa con el temporizador de ANGLE/Metal: el bloom marcaba 13,5 ms de GPU con 0,73 ms reales. */
export const FACTOR_GPU = 3;
export function gpuNoFiable(gananciaMs: number, gananciaGpu: number): boolean {
  const g = fin(gananciaMs), gg = fin(gananciaGpu);
  if (!gg || esRuido(gg)) return false;
  const ref = Math.max(Math.abs(g), UMBRAL_RUIDO_MS);
  return Math.abs(gg) > FACTOR_GPU * ref || (Math.sign(gg) !== Math.sign(g) && !esRuido(g));
}
/** Z72: filas ordenadas para el reporte: la línea base primero y después por ganancia en ms de rAF, de mayor a menor. */
export function ordenarPorGanancia(res: ResultadoBench[]): ResultadoBench[] {
  const base = res.find(r => r.paso.tipo === "base");
  const resto = res.filter(r => r !== base).sort((a, b) => a.media - b.media);   // menos ms = más ganancia
  return base ? [base, ...resto] : resto;
}
/** Z69: aviso si el canvas medido es chico (< 1 Mpx): los tiempos no representan el uso real. "" si está bien. */
export function avisoCanvas(w: number, h: number): string {
  const px = fin(w) * fin(h);
  if (!(px > 0) || px >= 1e6) return "";
  return `AVISO: el canvas medido es de ${Math.round(w)}×${Math.round(h)} = ${(px / 1e6).toFixed(2)} Mpx (menos de 1 Mpx): medí con la ventana al tamaño real de uso.`;
}
/** Tabla de texto del benchmark (para copiar y pegar). */
export function reporteBench(res: ResultadoBench[], info: InfoBench): string {
  const base = res.find(r => r.paso.tipo === "base");
  const L: string[] = [];
  L.push(`alight Z66 · benchmark · ${new Date().toISOString()}`);
  L.push(`GPU: ${info.gpu} · DPR ${info.dpr} · canvas ${info.px} · refresco estimado ${info.refrescoHz.toFixed(0)} Hz · temporizador de GPU: ${info.timerGpu ? "sí" : "no disponible"}`);
  L.push(`escena: ${info.escena}`);
  if (info.config) L.push(`configuración: ${info.config}`);
  if (info.pose) L.push(`pose de medición: ${info.pose}`);
  // Z69: refresco, cuantización, tamaño del canvas, límites del temporizador y lista por pase
  L.push(`refresco: ${info.refrescoHz.toFixed(0)} Hz${info.metodoRefresco ? ` (${info.metodoRefresco})` : ""}; con vsync los FPS se cuantizan a ${cuantizacion(info.refrescoHz).map(v => v.toFixed(v % 1 ? 1 : 0)).join(", ")}…`);
  const av = info.canvasW !== undefined && info.canvasH !== undefined ? avisoCanvas(info.canvasW, info.canvasH) : "";
  if (av) L.push(av);
  if (info.timerGpu) L.push("GPU ms: en ANGLE/Metal el temporizador por cuadro mide el intervalo de reloj entre el comienzo y el fin del trabajo del cuadro (incluye esperas y solapes con otros procesos, como el compositor): puede superar el tiempo de cuadro. Usar las diferencias entre filas, no el valor absoluto; la lista por pase (GPU_POR_PASE) es secuencial y no se solapa.");
  if (info.gpuPases) L.push(`GPU por pase (línea base): ${info.gpuPases}`);
  if (base && base.fps >= 0.93 * info.refrescoHz) {
    L.push(`AVISO: la línea base (${base.fps.toFixed(1)} FPS) está pegada al refresco del monitor (vsync): los ms por frame (rAF) no distinguen mejoras; ${info.timerGpu ? "mirar la columna GPU ms" : "no hay temporizador de GPU: probar con la escena de estrés o con DPR más alto"}.`);
  }
  const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length));
  const padI = (s: string, n: number) => (s.length >= n ? s : " ".repeat(n - s.length) + s);
  const conDif = res.some(r => r.dif !== undefined);
  // Z72: ordenada por ganancia en ms de rAF (la medida fiable); la GPU va al final, como dato secundario
  let hayNoFiable = false;
  L.push(`${pad("sistema", 26)}${padI("ms", 8)}${padI("p95", 8)}${padI("FPS", 7)}${padI("ganancia", 10)}${padI("(%)", 7)}${conDif ? padI("dif i/v", 9) : ""}${padI("| GPU ms", 10)}${padI("GPU gan.", 10)}`);
  for (const r of ordenarPorGanancia(res)) {
    const g = base && r !== base ? base.media - r.media : 0, gg = base && r !== base && base.gpu > 0 && r.gpu > 0 ? base.gpu - r.gpu : 0;
    const pct = base && base.media > 0 && r !== base ? `${((100 * g) / base.media).toFixed(0)}%` : "";
    // Z69: diferencias menores que UMBRAL_RUIDO_MS se marcan como ruido · Z72: GPU no fiable si difiere > 3× de rAF
    const noFiable = r !== base && gpuNoFiable(g, gg);
    if (noFiable) hayNoFiable = true;
    const ruido = r !== base && esRuido(g) ? " ruido" : "";
    const notaGpu = noFiable ? " · GPU no fiable" : "";
    const dif = conDif ? padI(r.dif !== undefined ? r.dif.toFixed(2) : "-", 9) : "";
    L.push(`${pad(r.paso.etiqueta, 26)}${padI(r.media.toFixed(2), 8)}${padI(r.p95.toFixed(2), 8)}${padI(r.fps.toFixed(1), 7)}${padI(r !== base ? (g >= 0 ? "+" : "") + g.toFixed(2) : "", 10)}${padI(pct, 7)}${dif}${padI("| " + (r.gpu > 0 ? r.gpu.toFixed(2) : "-"), 10)}${padI(r !== base && gg ? (gg >= 0 ? "+" : "") + gg.toFixed(2) : "", 10)}${ruido}${notaGpu}`);
  }
  L.push("ganancia = ms de rAF ahorrados por cuadro respecto de la línea base (positivo = más rápido sin ese sistema); la tabla va de mayor a menor ganancia");
  L.push(`ruido = ganancia menor que ${UMBRAL_RUIDO_MS} ms: no se distingue de la variación entre mediciones${conDif ? "; dif i/v = diferencia entre la ida y la vuelta de la misma condición" : ""}`);
  if (hayNoFiable) L.push(`GPU no fiable = la ganancia de GPU difiere más de ${FACTOR_GPU} veces de la de rAF (o tiene otro signo). El temporizador de ANGLE/Metal mide el intervalo de reloj del trabajo en la GPU, que incluye esperas y trabajo de otros procesos; cuando no coincide con rAF, vale rAF.`);
  return L.join("\n");
}
