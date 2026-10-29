import * as THREE from 'three';
import { brand as defaultBrand } from './brand.config.js';

const SANS = '"Jost","Helvetica Neue",Helvetica,Arial,sans-serif';
const JP = '"Hiragino Sans","Yu Gothic","Noto Sans JP",sans-serif';

/**
 * Dibuja un decal de marca (franjas + wordmark + modelo + serigrafía) en un canvas 2D.
 * Solo se puede ejecutar en el navegador (usa document).
 */
export function drawDecal(ctx, w, h, b = defaultBrand) {
  ctx.clearRect(0, 0, w, h);

  // fondo de papel
  ctx.fillStyle = b.paper;
  ctx.fillRect(0, 0, w, h);

  // banda de franjas diagonal, recortada por el borde
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  ctx.translate(w * 0.62, h * 1.05);
  ctx.rotate(-0.62);
  const bw = h * 0.1;
  b.stripes.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * bw, -h * 2, bw, h * 4);
  });
  ctx.restore();

  // wordmark
  ctx.fillStyle = b.ink;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${h * 0.11}px ${SANS}`;
  ctx.fillText(b.brandName, w * 0.05, h * 0.16);

  // código de modelo
  ctx.font = `700 ${h * 0.3}px ${SANS}`;
  ctx.fillText(b.modelCode, w * 0.05, h * 0.5);

  // descriptor con tracking amplio
  ctx.font = `500 ${h * 0.065}px ${SANS}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${h * 0.012}px`;
  ctx.fillText(b.descriptor, w * 0.05, h * 0.62);
  ctx.fillText(b.freqRange, w * 0.05, h * 0.7);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  // línea secundaria en katakana
  ctx.font = `500 ${h * 0.075}px ${JP}`;
  ctx.fillText(b.secondary, w * 0.05, h * 0.8);

  // casillas de verificación
  ctx.font = `500 ${h * 0.045}px ${SANS}`;
  ctx.lineWidth = Math.max(2, h * 0.008);
  ctx.strokeStyle = b.ink;
  b.checks.forEach((label, i) => {
    const x = w * 0.7;
    const y = h * 0.12 + i * h * 0.075;
    ctx.fillText(label, x, y + h * 0.04);
    ctx.strokeRect(x + w * 0.14, y, h * 0.045, h * 0.045);
  });

  // sello circular con número
  const cx = w * 0.88;
  const cy = h * 0.84;
  const r = h * 0.09;
  ctx.fillStyle = b.ink;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = b.inkLight;
  ctx.font = `700 ${r * 0.9}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(b.modelCode.replace(/\D/g, '') || '70', cx, cy + r * 0.05);

  // stencil de propiedad
  ctx.fillStyle = b.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${h * 0.04}px ui-monospace,Menlo,Consolas,monospace`;
  ctx.fillText(`${b.unitId}  ·  ${b.owner}`, w * 0.05, h * 0.95);
}

export function createDecalTexture(b = defaultBrand, { width = 1024, height = 512 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  drawDecal(canvas.getContext('2d'), width, height, b);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
