#!/usr/bin/env node
// gen-masks-2k.js — genera portal-masks-2k.png (2048×2048) desde portal-layers.svg
// Suaviza los polígonos con subdivisión de Chaikin antes de rasterizar.
// Convención de canales: R = montañas negras, G = estratos, B = olas (sin alpha)
// Uso: cd frontend && node ../scripts/gen-masks-2k.js

const fs   = require('fs');
const path = require('path');
// sharp está en frontend/node_modules — resolver desde ahí
const sharp = require(require.resolve('sharp', { paths: [path.join(__dirname, '../frontend/node_modules')] }));

const W = 2048, H = 2048;
const SRC_W = 607, SRC_H = 608;
const CHAIKIN_ITERS = 4; // 4 iteraciones = 16x puntos, bordes muy suaves
const BLUR_SIGMA    = 2.5; // Gaussian sigma (px) para suavizar bordes del rasterizado

// --- Parser de paths SVG (solo M/L/Z con coordenadas flotantes) ---
function parsePath(d) {
  // Devuelve array de polígonos (cada uno es array de [x, y])
  const polys = [];
  let cur = null;
  // Inserta espacio antes de comandos para tokenizar limpio
  const tokens = d.replace(/([MLZ])/g, ' $1 ').trim().split(/\s+/);
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === 'M') {
      if (cur && cur.length >= 3) polys.push(cur);
      cur = [[parseFloat(tokens[i + 1]), parseFloat(tokens[i + 2])]];
      i += 3;
    } else if (t === 'L') {
      if (cur) cur.push([parseFloat(tokens[i + 1]), parseFloat(tokens[i + 2])]);
      i += 3;
    } else if (t === 'Z') {
      if (cur && cur.length >= 3) polys.push(cur);
      cur = null;
      i += 1;
    } else {
      i += 1;
    }
  }
  if (cur && cur.length >= 3) polys.push(cur);
  return polys;
}

// --- Subdivisión de Chaikin (corner-cutting) ---
// Cada borde se reemplaza por dos puntos a 1/4 y 3/4 del borde.
function chaikin(pts, iters) {
  let p = pts;
  for (let n = 0; n < iters; n++) {
    const next = [];
    const len = p.length;
    for (let i = 0; i < len; i++) {
      const a = p[i];
      const b = p[(i + 1) % len];
      next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
      next.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    p = next;
  }
  return p;
}

// --- Rasterización scanline con regla even-odd ---
// Todos los polígonos del grupo se evalúan juntos (para que fill-rule="evenodd" funcione bien).
function rasterize(polys, buf, channel) {
  const stride = W * 3;
  const sx = W / SRC_W;
  const sy = H / SRC_H;

  // Pre-escalar todos los polígonos
  const scaled = polys.map(poly => poly.map(([x, y]) => [x * sx, y * sy]));

  // Bounding box global para saltear scanlines vacíos
  let yMin = Infinity, yMax = -Infinity;
  for (const pts of scaled) {
    for (const [, y] of pts) {
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }
  }
  yMin = Math.max(0, Math.floor(yMin));
  yMax = Math.min(H - 1, Math.ceil(yMax));

  for (let y = yMin; y <= yMax; y++) {
    const yc = y + 0.5; // centro del píxel
    const xs = [];

    for (const pts of scaled) {
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % n];
        if ((y0 < yc && y1 >= yc) || (y1 < yc && y0 >= yc)) {
          const t = (yc - y0) / (y1 - y0);
          xs.push(x0 + t * (x1 - x0));
        }
      }
    }

    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);

    // Even-odd: rellenar entre pares 0-1, 2-3, ...
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xStart = Math.max(0, Math.ceil(xs[k]));
      const xEnd   = Math.min(W - 1, Math.floor(xs[k + 1]));
      for (let x = xStart; x <= xEnd; x++) {
        buf[y * stride + x * 3 + channel] = 255;
      }
    }
  }
}

async function main() {
  const root   = path.resolve(__dirname, '..');
  const svgIn  = path.join(root, 'frontend/public/portal/portal-layers.svg');
  const pngOut = path.join(root, 'frontend/public/portal/portal-masks-2k.png');

  const svg = fs.readFileSync(svgIn, 'utf8');

  // { grupo: { canal, regex para extraer d="..." } }
  const groups = [
    { id: 'black_mountains', ch: 0 },
    { id: 'strata_mountain', ch: 1 },
    { id: 'wave_zone',       ch: 2 },
  ];

  const buf = Buffer.alloc(W * H * 3, 0); // RGB, todo negro

  for (const { id, ch } of groups) {
    // Extrae el atributo d del primer <path> dentro del grupo
    const re = new RegExp(`id="${id}"[\\s\\S]*?<path[^>]+d="([^"]+)"`);
    const m  = svg.match(re);
    if (!m) throw new Error(`Grupo no encontrado: ${id}`);

    const polys   = parsePath(m[1]);
    const smooth  = polys.map(p => chaikin(p, CHAIKIN_ITERS));
    const ptTotal = smooth.reduce((s, p) => s + p.length, 0);
    console.log(`${id}: ${polys.length} subpolígonos, ${ptTotal} puntos post-Chaikin, canal ${['R','G','B'][ch]}`);

    rasterize(smooth, buf, ch);
  }

  // Blur independiente por canal para evitar bleeding entre R/G/B
  const ch = [Buffer.alloc(W * H), Buffer.alloc(W * H), Buffer.alloc(W * H)];
  for (let i = 0; i < W * H; i++) {
    ch[0][i] = buf[i * 3]; ch[1][i] = buf[i * 3 + 1]; ch[2][i] = buf[i * 3 + 2];
  }
  const blurred = await Promise.all(ch.map(c =>
    sharp(c, { raw: { width: W, height: H, channels: 1 } }).blur(BLUR_SIGMA).raw().toBuffer()
  ));
  const out = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    out[i * 3] = blurred[0][i]; out[i * 3 + 1] = blurred[1][i]; out[i * 3 + 2] = blurred[2][i];
  }

  await sharp(out, { raw: { width: W, height: H, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(pngOut);

  console.log(`\nGuardado: ${pngOut}`);
  console.log(`Tamaño: ${W}×${H}, 3 canales, sin alpha, blur σ=${BLUR_SIGMA}`);
}

main().catch(err => { console.error(err); process.exit(1); });
