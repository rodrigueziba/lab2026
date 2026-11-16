// Z65: métrica del "fluir de color" de los bloques AZUL y NARANJA del domo, replicando en Node la composición de
// dome.frag.glsl sobre las texturas reales (public/portal/portal-masks.png y portal-color.png) y la salida del
// compositor (exposición × ACES Filmic de three + sRGB). Sin GPU: es una simulación del shader, no una captura.
// Uso: node scripts/fluido-metrica.mjs [--antes]   (--antes = valores y composición de Z63/Z64)
import fs from 'node:fs';
import sharp from 'sharp';
import { crearEstadoFluido, avanzarFluido } from '../lib/fluidoBloques.ts';
import { crearEstadoDia, estadoCielo } from '../lib/cicloDia.ts';

const ANTES = process.argv.includes('--antes');
const src = fs.readFileSync(new URL('../lib/debugConfig.ts', import.meta.url), 'utf8');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string\[\]/g, '').replace(/ as string/g, '')});`)();
const C = obj('DBG_FLUIDO');
if (process.env.PAL_N) C.PALETA_NARANJA = process.env.PAL_N.split(',');
if (process.env.TOPE) C.TOPE = +process.env.TOPE;
if (process.env.MODO) C.TOPE_MODO = process.env.MODO;
if (ANTES) {   // Z63/Z64
  Object.assign(C, { TOPE: 0.7, TOPE_MODO: 'canal', DIA_ATENUA: 0,
    PALETA_NARANJA: ['#C8402A', '#F0742A', '#F4A23A', '#F4CE4A', '#F3E6C8'] });
}
const EXPO_BASE = 0.8;   // DBG_RETRO_FX.toneExposure
const N = 256;           // resolución de la simulación (textura 1024 → paso 4)

// ── texturas ──
const leer = async f => (await sharp(new URL(`../public/portal/${f}`, import.meta.url).pathname).resize(N, N, { kernel: 'nearest' }).raw().toBuffer());
const M = await leer('portal-masks.png'), T = await leer('portal-color.png');

// ── réplica de las funciones del shader ──
const fract = x => x - Math.floor(x), clamp = (x, a, b) => Math.min(b, Math.max(a, x)), mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function fluHash(x, y) {
  let qx = fract(x * 0.1149), qy = fract(y * 0.1371), qz = fract(x * 0.0973);
  const d = qx * (qy + 27.31) + qy * (qz + 27.31) + qz * (qx + 27.31);
  qx += d; qy += d; qz += d;
  return fract((qx + qy) * qz);
}
function fluRuido(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = fluHash(ix, iy), b = fluHash(ix + 1, iy), c = fluHash(ix, iy + 1), d = fluHash(ix + 1, iy + 1);
  return mix(mix(a, b, ux), mix(c, d, ux), uy);
}
function fluFbm(x, y, oct) {
  let s = 0, amp = 0.55, norm = 0;
  for (let i = 0; i < 4; i++) {
    if (i >= oct) break;
    s += amp * fluRuido(x, y); norm += amp;
    const nx = 0.8 * x - 0.6 * y, ny = 0.6 * x + 0.8 * y;   // mat2(0.8, 0.6, -0.6, 0.8) * p (columnas)
    x = nx * 2.07 + 3.1; y = ny * 2.07 + 1.7; amp *= 0.48;
  }
  return s / Math.max(norm, 1e-3);
}
function fluCampo(x, y, tt, w, oct, r0, r1) {
  const qx = fluFbm(x, y + 0.31 * tt, oct), qy = fluFbm(x + 4.7 - 0.27 * tt, y + 1.9 - 0.27 * tt, oct);
  const rx = fluFbm(x + w * qx + 2.3 + 0.19 * tt, y + w * qy + 7.1 + 0.19 * tt, oct);
  const ry = fluFbm(x + w * qx + 6.1 - 0.23 * tt, y + w * qy + 3.4 - 0.23 * tt, oct);
  const c = clamp((fluFbm(x + w * rx, y + w * ry, oct) - r0) / Math.max(r1 - r0, 1e-3), 0, 1);
  return c * c * (3 - 2 * c);
}
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
function pal5(f, P, out) {
  const x = clamp(f, 0, 1) * 4;
  for (let k = 0; k < 3; k++) {
    let c = mix(P[0][k], P[1][k], clamp(x, 0, 1));
    c = mix(c, P[2][k], clamp(x - 1, 0, 1)); c = mix(c, P[3][k], clamp(x - 2, 0, 1));
    out[k] = mix(c, P[4][k], clamp(x - 3, 0, 1));
  }
  return out;
}
const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
// Z65: atenuación de día (réplica de fluDia del shader): DESPUÉS del tope, los tonos claros (relativos a TOPE) bajan
// hacia los medios y recuperan saturación; los oscuros no se tocan. k = DIA_ATENUA × luz del día (de noche 0).
function fluDia(c, luzDia, at) {
  const k = clamp(at, 0, 1) * clamp(luzDia, 0, 1);
  if (k <= 0) return c;
  const l = lum(c), w = sstep(0.45 * C.TOPE, 0.9 * C.TOPE, l);
  const o = c.map(v => v * (1 - 0.5 * k * w)), lo = lum(o), sat = 1 + 0.8 * k * w;
  return o.map(v => Math.max(0, lo + (v - lo) * sat));
}
function tenir(base, pal, f, e, mezcla, lumMedia, luzDia, out) {
  const detalle = clamp(lum(base) / Math.max(lumMedia, 0.02), C.DETALLE_MIN, C.DETALLE_MAX);
  const luz = (1 + C.LUZ_FLUJO * (f - 0.5) * 2) * (1 + C.PULSO_LUZ * e);
  let v = pal.map(x => x * detalle * luz);
  if (C.TOPE_MODO === 'canal') v = v.map(x => Math.min(x, C.TOPE));
  else { const esc = Math.min(1, C.TOPE / Math.max(v[0], v[1], v[2], 1e-3)); v = v.map(x => x * esc); }   // Z65: tope que conserva el tono
  v = fluDia(v, luzDia, C.DIA_ATENUA ?? 0);
  for (let k = 0; k < 3; k++) out[k] = mix(base[k], v[k], clamp(mezcla, 0, 1));
  return out;
}
// ACES Filmic de three (r183) + sRGB
const acesIn = [[0.59719, 0.07600, 0.02840], [0.35458, 0.90834, 0.13383], [0.04823, 0.01566, 0.83777]];
const acesOut = [[1.60475, -0.10208, -0.00327], [-0.53108, 1.10813, -0.07276], [-0.07367, -0.00605, 1.07602]];
const mul = (m, v) => [0, 1, 2].map(r => m[0][r] * v[0] + m[1][r] * v[1] + m[2][r] * v[2]);
const srgb = x => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
function salida(c, expo) {
  let v = mul(acesIn, c.map(x => (x * expo) / 0.6));
  v = v.map(x => (x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.432951) + 0.238081));
  return mul(acesOut, v).map(x => srgb(clamp(x, 0, 1)));
}

// ── clasificación de píxeles (umbrales del shader, máscaras de 1k sin borde suave) ──
const pix = [];
const cuenta = { calida: 0, calidaBajoEstratos: 0, calidaBajoSiluetas: 0, fria: 0, estratos: 0 };
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const i = (y * N + x) * 3, m = [M[i] / 255, M[i + 1] / 255, M[i + 2] / 255], w = [T[i] / 255, T[i + 1] / 255, T[i + 2] / 255];
  if (m[1] < 0.01 && m[2] < 0.01) continue;
  const calido = sstep(0.02, 0.10, w[0] - w[2]) * (m[2] >= 0.01 ? 1 : 0);
  const uv = [(x + 0.5) / N, 1 - (y + 0.5) / N];
  // bloque visible: NARANJA = ola cálida que queda arriba; AZUL = estratos u ola fría visibles
  let bloque = -1;
  if (calido > 0.5 && m[2] > 0.5) { cuenta.calida++; if (m[1] > 0.5) cuenta.calidaBajoEstratos++; if (m[0] > 0.5) cuenta.calidaBajoSiluetas++; bloque = 1; }
  else if (m[2] > 0.5) { cuenta.fria++; bloque = 0; }
  if (m[1] > 0.5) { cuenta.estratos++; bloque = 0; }
  if (m[0] > 0.5) bloque = -1;   // la silueta negra tapa
  pix.push({ m, w, calido, uv, bloque });
}

function colorPixel(q, F, luzDia, out) {
  const { m, w, calido, uv } = q;
  const xl = [uv[0] * C.ESCALA, uv[1] * C.ESCALA * C.ESCALA_Y];
  const oct = Math.round(C.CALIDAD), PA = C.PALETA_AZUL.map(hex), PN = C.PALETA_NARANJA.map(hex);
  let strata = w.slice(), olaFria = w.slice(), olaCal = w.slice();
  const tmp = [0, 0, 0];
  if (m[1] > 0.01 || (m[2] > 0.01 && calido < 0.99)) {
    const fA = fluCampo(xl[0], xl[1], F.tA, C.WARP * (1 + 1.5 * F.eA), oct, C.RANGO_MIN, C.RANGO_MAX);
    pal5(fA, PA, tmp);
    strata = tenir(w, tmp, fA, F.eA, C.MEZCLA_AZUL, C.LUM_MEDIA_AZUL, luzDia, [0, 0, 0]);
    olaFria = tenir(w, tmp, fA, F.eA, C.MEZCLA_AZUL, C.LUM_MEDIA_AZUL, luzDia, [0, 0, 0]);
  }
  if (calido > 0.01) {
    const fN = fluCampo(xl[0] + 11.3, xl[1] + 5.7, F.tN, C.WARP * (1 + 1.5 * F.eN), oct, C.RANGO_MIN, C.RANGO_MAX);
    pal5(fN, PN, tmp);
    olaCal = tenir(w, tmp, fN, F.eN, C.MEZCLA_NARANJA, C.LUM_MEDIA_NARANJA, luzDia, [0, 0, 0]);
  }
  const wave = [0, 1, 2].map(k => mix(olaFria[k], olaCal[k], calido));
  // composición (igual que dome.frag.glsl): olas, estratos encima, siluetas encima
  let col = [0.5, 0.5, 0.5];
  col = col.map((c, k) => mix(c, wave[k], m[2]));
  col = col.map((c, k) => mix(c, strata[k], m[1]));
  col = col.map((c, k) => mix(c, [0.098, 0.102, 0.133][k], m[0]));
  for (let k = 0; k < 3; k++) out[k] = col[k];
  return out;
}

function medir(luzDia, expoDia, seg = 4, fps = 15) {
  const F = crearEstadoFluido();
  const cfg = { ...C, SIMULAR_AZUL: true, SIMULAR_NARANJA: true };
  for (let i = 0; i < 60 * 3; i++) avanzarFluido(F, cfg, 1 / 60, [0, 0, 0, 0], false, false);   // 3 s de calentamiento
  const series = [[], []], porPix = [new Map(), new Map()], blancos = [0, 0], totales = [0, 0];
  const sub = pix.filter((q, i) => q.bloque >= 0 && i % 2 === 0);
  const c = [0, 0, 0];
  for (let fr = 0; fr < seg * fps; fr++) {
    for (let i = 0; i < 60 / fps; i++) avanzarFluido(F, cfg, 1 / 60, [0, 0, 0, 0], false, false);
    const suma = [[0, 0, 0, 0], [0, 0, 0, 0]];
    sub.forEach((q, j) => {
      const o = salida(colorPixel(q, F, luzDia, c), EXPO_BASE * expoDia);
      const s = suma[q.bloque]; s[0] += o[0]; s[1] += o[1]; s[2] += o[2]; s[3]++;
      if (lum(o) > 0.7 && Math.max(...o) - Math.min(...o) < 0.15) blancos[q.bloque]++; totales[q.bloque]++;
      const mp = porPix[q.bloque]; const a = mp.get(j) ?? [0, 0]; const l = lum(o); a[0] += l; a[1] += l * l; mp.set(j, a);
    });
    for (let b = 0; b < 2; b++) series[b].push(suma[b].slice(0, 3).map(v => v / suma[b][3]));
  }
  const res = [];
  for (let b = 0; b < 2; b++) {
    const s = series[b], n = s.length;
    const media = [0, 1, 2].map(k => s.reduce((a, v) => a + v[k], 0) / n);
    const sd = Math.sqrt([0, 1, 2].reduce((a, k) => a + s.reduce((x, v) => x + (v[k] - media[k]) ** 2, 0) / n, 0));
    let sdp = 0; porPix[b].forEach(([a, a2]) => { const mu = a / n; sdp += Math.sqrt(Math.max(0, a2 / n - mu * mu)); }); sdp /= porPix[b].size;
    res.push({ media, sd, sdp, lumMedia: lum(media), blanco: blancos[b] / Math.max(1, totales[b]) });
  }
  return res;
}

console.log(`\n${ANTES ? 'ANTES (Z64)' : 'DESPUÉS (Z65)'} · ${pix.length} píxeles de bloque en ${N}×${N}`);
console.log(`  ola cálida visible: ${cuenta.calida} px · de ellos bajo estratos (m.g>0,5): ${cuenta.calidaBajoEstratos} (${(100 * cuenta.calidaBajoEstratos / Math.max(1, cuenta.calida)).toFixed(1)} %) · bajo siluetas (m.r>0,5): ${cuenta.calidaBajoSiluetas}`);
console.log(`  ola fría: ${cuenta.fria} px · estratos: ${cuenta.estratos} px`);
const f3 = v => v.map(x => x.toFixed(3)).join(', ');
const D = obj('DBG_DIA'), E = crearEstadoDia();
const fila = (n, b, a) => `    ${n}: sd color medio ${b.sd.toFixed(4)} · sd por píxel ${b.sdp.toFixed(4)} · color medio (${f3(b.media)}) lum ${b.lumMedia.toFixed(3)} · pálido (lum > 0,7 y croma < 0,15) ${(100 * b.blanco).toFixed(1)} %` + (a ? ` · razón N/A ${(b.sd / a.sd).toFixed(2)} (por píxel ${(b.sdp / a.sdp).toFixed(2)})` : '');
for (const t of [0.0, 0.5, 0.65, 0.97]) {
  estadoCielo(t, D, E);
  const [a, n] = medir(E.luz, E.expo);
  console.log(`  T_MANUAL ${t.toFixed(2)} (luz ${E.luz.toFixed(2)}, expo ${E.expo.toFixed(2)})`);
  console.log(fila('AZUL   ', a)); console.log(fila('NARANJA', n, a));
}
