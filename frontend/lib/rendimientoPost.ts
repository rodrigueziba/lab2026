// Z69: post-proceso y perfiles de calidad. Lógica PURA (sin three, sin imports), testeable en Node
// (scripts/rendimiento-z69-test.mjs). La usan lib/retro/bloomLigero.ts, components/RetroPostFX.tsx,
// components/RendimientoHost.tsx y components/RendimientoPanel.tsx.
//
// Bloom: el UnrealBloomPass de three (como estaba) arma 5 niveles; el nivel k se dibuja a 1/2^(k+1) de la resolución y
// se desenfoca con un kernel separable de radio K_k = [6, 10, 14, 18, 22] texels (σ = K/3). Cada nivel parte del
// anterior, así que su σ en píxeles de pantalla es acumulativo: S_k = √Σ_{j≤k} (σ_j · 2^(j+1))² ≈ 4, 14, 40, 104, 255 px.
// La composición suma los 5 con peso mix(f, 1,2 − f, radio) (radio 0,5 → 0,6 cada uno).
// El bloom liviano reparte ese mismo perfil en N niveles (posiciones 0…4 en el índice viejo, σ interpolado en
// logaritmo), arranca a ESCALA/2 de la resolución y reparte los pesos viejos entre los niveles nuevos vecinos (la suma
// de pesos, o sea la energía total del halo, se conserva). Con ESCALA 1 y 5 niveles da exactamente los kernels de three.

const fin = (x: number, d = 0): number => (Number.isFinite(x) ? x : d);
const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);

export const KERNELS_UNREAL = [6, 10, 14, 18, 22] as const;
export const FACTORES_UNREAL = [1.0, 0.8, 0.6, 0.4, 0.2] as const;
export const KERNEL_MAX = 24;
/** σ en texels a partir del cual un nivel se dibuja a la mitad de resolución (con 8, ESCALA 1 · 5 niveles = three). */
export const SIGMA_TEXEL_MAX = 8;

/** σ acumulado en píxeles de pantalla de cada nivel del UnrealBloomPass. */
export function sigmasUnreal(): number[] {
  const r: number[] = [];
  let v = 0;
  for (let k = 0; k < 5; k++) { const s = (KERNELS_UNREAL[k] / 3) * Math.pow(2, k + 1); v += s * s; r.push(Math.sqrt(v)); }
  return r;
}
/** Pesos de la composición del UnrealBloomPass para un radio (0,5 → 0,6 los cinco). */
export function pesosUnreal(radio: number): number[] {
  const R = clamp(fin(radio, 0.5), 0, 1);
  return FACTORES_UNREAL.map(f => f + (1.2 - f - f) * R);
}

export interface NivelBloom {
  divisor: number;   // resolución del nivel = canvas / divisor
  kernel: number;    // radio del kernel (texels del nivel; σ = kernel / 3, igual que three)
  peso: number;      // peso en la composición (× 3 × intensidad, igual que three)
  sigmaPx: number;   // σ acumulado buscado (píxeles de pantalla)
  pos: number;       // posición en el índice de niveles viejo (0…4)
}
/** Plan de niveles del bloom liviano. Se calcula al cambiar la configuración (no por frame). */
export function planBloom(escala: number, niveles: number, radio: number): NivelBloom[] {
  const N = clamp(Math.round(fin(niveles, 3)), 1, 5);
  const E = clamp(fin(escala, 0.5), 0.1, 1);
  const S = sigmasUnreal(), W = pesosUnreal(radio);
  const pos: number[] = [];
  for (let i = 0; i < N; i++) pos.push(N === 1 ? 2 : (i * 4) / (N - 1));
  const sigmaEn = (p: number): number => {
    const k = Math.min(3, Math.floor(p)), t = p - k;
    return Math.exp(Math.log(S[k]) * (1 - t) + Math.log(S[k + 1]) * t);
  };
  const r: NivelBloom[] = [];
  let dPrev = 0, sPrev = 0;
  for (let i = 0; i < N; i++) {
    const p = pos[i], s = sigmaEn(p);
    const dUnreal = Math.pow(2, Math.floor(p) + 1);
    const dMin = Math.max(2 / E, dUnreal, dPrev);
    const dMax = i === 0 ? dMin : Math.max(dMin, 2 * dPrev, 2 * sPrev);   // sin saltear más que el desenfoque previo
    let D = dMin;
    // varianza propia: la que falta para llegar a S, menos el desenfoque extra de bajar y subir de resolución
    const varPropia = (dd: number) => Math.max(0, s * s - sPrev * sPrev - Math.max(0, (dd * dd - dUnreal * dUnreal) / 4));
    while (Math.sqrt(varPropia(D)) / D > SIGMA_TEXEL_MAX && D * 2 <= dMax) D *= 2;
    const sigTex = Math.sqrt(varPropia(D)) / D;
    r.push({ divisor: D, kernel: clamp(Math.round(3 * sigTex), 2, KERNEL_MAX), peso: 0, sigmaPx: s, pos: p });
    dPrev = D; sPrev = s;
  }
  // pesos: cada nivel viejo reparte el suyo entre los dos niveles nuevos que lo rodean
  for (let k = 0; k < 5; k++) {
    if (N === 1) { r[0].peso += W[k]; continue; }
    const j = Math.min(N - 2, Math.floor((k * (N - 1)) / 4));
    const t = clamp((k - pos[j]) / (pos[j + 1] - pos[j]), 0, 1);
    r[j].peso += W[k] * (1 - t); r[j + 1].peso += W[k] * t;
  }
  return r;
}

/** Coeficientes del kernel (fórmula de three: gaussiana sin normalizar, σ = K/3) agrupados de a dos para que cada
 *  lectura bilineal cubra dos texels: devuelve pesos y desplazamientos (en texels) del lado positivo; el centro va
 *  aparte en w0. Lecturas por píxel = 1 + 2 · pares (en vez de 2K − 1). */
export function paresKernel(K: number): { w0: number; pesos: number[]; offs: number[] } {
  const k = clamp(Math.round(fin(K, 6)), 2, KERNEL_MAX), sigma = k / 3;
  const c: number[] = [];
  for (let i = 0; i < k; i++) c.push((0.39894 * Math.exp((-0.5 * i * i) / (sigma * sigma))) / sigma);
  const pesos: number[] = [], offs: number[] = [];
  for (let i = 1; i < k; i += 2) {
    if (i + 1 < k) { const w = c[i] + c[i + 1]; pesos.push(w); offs.push((i * c[i] + (i + 1) * c[i + 1]) / w); }
    else { pesos.push(c[i]); offs.push(i); }
  }
  return { w0: c[0], pesos, offs };
}

export type CalidadBloom = "alta" | "media" | "baja";
export const PRESETS_BLOOM: Record<CalidadBloom, { escala: number; niveles: number }> = {
  alta:  { escala: 1.0,  niveles: 5 },   // = UnrealBloomPass
  media: { escala: 0.5,  niveles: 4 },   // Z69: 4 y no 3: con 3 el halo del sol se ve como un disco (prueba en Chrome)
  baja:  { escala: 0.35, niveles: 3 },
};
/** Fija BLOOM_ESCALA y BLOOM_NIVELES según BLOOM_CALIDAD. Devuelve false si el nombre no existe. */
export function aplicarCalidadBloom(cfg: { BLOOM_CALIDAD: string; BLOOM_ESCALA: number; BLOOM_NIVELES: number }, calidad: string): boolean {
  const p = (PRESETS_BLOOM as Record<string, { escala: number; niveles: number }>)[calidad];
  if (!p) return false;
  cfg.BLOOM_CALIDAD = calidad; cfg.BLOOM_ESCALA = p.escala; cfg.BLOOM_NIVELES = p.niveles;
  return true;
}

/** Costo estimado del bloom en lecturas de textura y fragmentos por píxel del canvas (para el reporte).
 *  original: highpass (1/4) + 5 niveles H+V con 2K−1 lecturas + composición de 5 + mezcla a pantalla completa.
 *  liviano: highpass de 4 lecturas + niveles con lecturas por pares + composición de N + (mezcla, o 3 lecturas en el
 *  pase final si está fusionado). */
export function costoBloom(plan: NivelBloom[] | null, escala: number, fusionado: boolean): { lecturas: number; fragmentos: number; pases: number } {
  if (!plan) {
    let lect = 0.25, frag = 0.25, pases = 1;
    for (let k = 0; k < 5; k++) { const P = 1 / Math.pow(4, k + 1); lect += P * 2 * (2 * KERNELS_UNREAL[k] - 1); frag += 2 * P; pases += 2; }
    lect += 0.25 * 5 + 1; frag += 0.25 + 1; pases += 2;
    return { lecturas: lect, fragmentos: frag, pases };
  }
  const D0 = plan[0].divisor, P0 = 1 / (D0 * D0);
  let lect = P0 * 4, frag = P0, pases = 1;
  for (const n of plan) {
    const P = 1 / (n.divisor * n.divisor), pares = paresKernel(n.kernel).pesos.length;
    lect += P * 2 * (1 + 2 * pares); frag += 2 * P; pases += 2;
  }
  lect += P0 * plan.length; frag += P0; pases += 1;
  if (fusionado) lect += 3; else { lect += 1; frag += 1; pases += 1; }
  void escala;
  return { lecturas: lect, fragmentos: frag, pases };
}

/** Pases finales a pantalla completa y bytes por píxel (targets HalfFloat RGBA = 8 B/px, pantalla RGBA8 = 4 B/px).
 *  separados: mezcla del bloom (lee y escribe HF), CRT (lee HF, escribe HF), salida (lee HF, escribe pantalla).
 *  fusionado: un pase que lee HF y escribe la pantalla (el bloom se lee de su textura chica). */
export function pasesFinales(fusionado: boolean, w: number, h: number): { pases: number; bytesPx: number; mbCuadro: number } {
  const px = Math.max(0, fin(w)) * Math.max(0, fin(h));
  const bytesPx = fusionado ? 8 + 4 : (8 + 8) + (8 + 8) + (8 + 4);
  return { pases: fusionado ? 1 : 3, bytesPx, mbCuadro: (px * bytesPx) / 1e6 };
}

// ── perfiles de calidad (Z69, panel de rendimiento) ──
export type NombrePerfil = "alta" | "media" | "baja";
export interface Perfil { DPR_MAX: number; CAPAS: number; BLOOM_CALIDAD: CalidadBloom; TEX_FPS: number; ANTIALIAS_MODO: string; DOME_ESCALA: number }
export const PERFILES: Record<NombrePerfil, Perfil> = {
  alta:  { DPR_MAX: 1.5,  CAPAS: 20, BLOOM_CALIDAD: "alta",  TEX_FPS: 30, ANTIALIAS_MODO: "fxaa",    DOME_ESCALA: 1 },
  media: { DPR_MAX: 1.25, CAPAS: 14, BLOOM_CALIDAD: "media", TEX_FPS: 20, ANTIALIAS_MODO: "fxaa",    DOME_ESCALA: 0.75 },   // Z72
  baja:  { DPR_MAX: 1.0,  CAPAS: 10, BLOOM_CALIDAD: "baja",  TEX_FPS: 15, ANTIALIAS_MODO: "ninguno", DOME_ESCALA: 0.5 },
};
export const CLAVE_PERFIL = "alight:perfil-calidad";
export const esPerfil = (v: unknown): v is NombrePerfil => v === "alta" || v === "media" || v === "baja";
/** Aplica un perfil sobre los objetos de configuración (DBG_RENDIMIENTO, DBG_PASTO, DBG_FRACTAL). */
export function aplicarPerfil(
  nombre: string,
  rend: { DPR_MAX: number; BLOOM_CALIDAD: string; BLOOM_ESCALA: number; BLOOM_NIVELES: number; ANTIALIAS_MODO: string; DOME_ESCALA?: number },
  pasto: { CAPAS: number }, fractal: { TEX_FPS: number },
): boolean {
  if (!esPerfil(nombre)) return false;
  const p = PERFILES[nombre];
  rend.DPR_MAX = p.DPR_MAX; pasto.CAPAS = p.CAPAS; fractal.TEX_FPS = p.TEX_FPS; rend.ANTIALIAS_MODO = p.ANTIALIAS_MODO;
  rend.DOME_ESCALA = p.DOME_ESCALA;   // Z72
  aplicarCalidadBloom(rend, p.BLOOM_CALIDAD);
  return true;
}
type Almacen = { getItem(k: string): string | null; setItem(k: string, v: string): void } | null | undefined;
/** Perfil guardado o null (sin guardar, valor inválido o almacenamiento bloqueado). */
export function leerPerfil(s: Almacen): NombrePerfil | null {
  try { const v = s ? s.getItem(CLAVE_PERFIL) : null; return esPerfil(v) ? v : null; } catch { return null; }
}
export function guardarPerfil(s: Almacen, nombre: NombrePerfil): boolean {
  try { if (!s) return false; s.setItem(CLAVE_PERFIL, nombre); return true; } catch { return false; }
}
