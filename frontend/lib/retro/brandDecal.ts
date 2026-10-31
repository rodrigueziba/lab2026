import * as THREE from "three";

// J5: fictional brand decals (TS port of decalAtlas.js / brand.config.js).
// Never real brands — only their grammar: stripes + wordmark + model code.

export interface Brand {
  brandName: string;
  modelCode: string;
  descriptor: string;
  secondary: string;
  unitId: string;
  owner: string;
  spec: string;
  checks: string[];
  stripes: string[];
  paper: string;
  ink: string;
  inkLight: string;
}

const BASE: Omit<Brand, "modelCode" | "descriptor" | "spec" | "checks"> = {
  brandName: "KESTREL ELECTRIC",
  secondary: "高品質制御卓",
  unitId:    "UNIT-07",
  owner:     "PROPERTY OF TARIMA-BASE",
  stripes:   ["#E5322B", "#F0742A", "#F4B62E", "#2E9E5B", "#1F7FB8"],
  paper:     "#E8DCC4",
  ink:       "#1A1614",
  inkLight:  "#F2EBDD",
};

// R5: AUSTRAL ELECTRIC — fictional brand for physical set equipment
const AUSTRAL_BASE: Omit<Brand, "modelCode" | "descriptor" | "spec" | "checks" | "unitId"> = {
  brandName: "AUSTRAL ELECTRIC",
  secondary: "INSTALACIÓN INTERACTIVA",
  owner:     "PROPERTY OF ECHO-BASE",
  stripes:   ["#E5322B", "#F0742A", "#F4B62E", "#2E9E5B", "#1F7FB8"],
  paper:     "#E8DCC4",
  ink:       "#1A1614",
  inkLight:  "#F2EBDD",
};

export const EQUIPMENT_BRANDS: Record<"tarima" | "chair" | "monolith" | "luminaria", Brand> = {
  tarima:    { ...AUSTRAL_BASE, unitId: "UNIT-01", modelCode: "KX-45V", descriptor: "PRISM STAGE",       spec: "LOAD: 400 KG · SZ: 3.2×3.2",    checks: ["STRUCT", "LEVEL", "SAFE", "OK"] },
  chair:     { ...AUSTRAL_BASE, unitId: "UNIT-02", modelCode: "KX-12C", descriptor: "AUDIENCE SEATING",  spec: "FIRE RETARDANT · CLASS B",       checks: ["SAFE",   "LOCK",  "OK",   "—"] },
  monolith:  { ...AUSTRAL_BASE, unitId: "UNIT-07", modelCode: "KX-07M", descriptor: "SIGNAL COLUMN",     spec: "INPUT: 10–440 V / OUTPUT: CRT",  checks: ["SIG",    "POWER", "GND",  "OK"] },
  luminaria: { ...AUSTRAL_BASE, unitId: "UNIT-03", modelCode: "KX-33L", descriptor: "STAGE LUMINAIRE",   spec: "BEAM: 2400W · SPOT · SCAN",      checks: ["LAMP",   "FOCUS", "DMX",  "GO"] },
};

export const LECTERN_BRANDS: Record<"left" | "right", Brand> = {
  left:  { ...BASE, modelCode: "KX-45V", descriptor: "VISUAL CONTROL DECK", spec: "DOME FX · 7 CH · RGB",  checks: ["COLOR", "PSYCHO", "REACT", "CAM"] },
  right: { ...BASE, modelCode: "KX-45A", descriptor: "AUDIO CONTROL DECK",  spec: "FREQ RANGE: 20-20K HZ", checks: ["STEREO", "LO-FI", "LOOP", "N.R."] },
};

const SANS = '"Jost","Futura","Helvetica Neue",Helvetica,Arial,sans-serif';
const JP   = '"Hiragino Sans","Yu Gothic","Noto Sans JP",sans-serif';
const MONO = 'ui-monospace,Menlo,Consolas,monospace';

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function stripeBand(ctx: CanvasRenderingContext2D, b: Brand, x: number, y: number, rot: number, bw: number, len: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  b.stripes.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * bw, -len / 2, bw, len); });
  ctx.restore();
}

/** Full brand block: diagonal stripe guard, wordmark, model code, silkscreen, checkboxes, stencil. */
export function createDecalTexture(b: Brand, w = 1024, h = 256): THREE.CanvasTexture {
  return canvasTex(w, h, ctx => {
    ctx.fillStyle = b.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    stripeBand(ctx, b, w * 0.50, h * 0.5, -0.62, h * 0.12, h * 4);
    ctx.restore();

    ctx.fillStyle = b.ink;
    ctx.textBaseline = "alphabetic";
    ctx.font = `700 ${h * 0.13}px ${SANS}`;
    ctx.letterSpacing = `${h * 0.02}px`;
    ctx.fillText(b.brandName, w * 0.03, h * 0.2);
    ctx.font = `700 ${h * 0.42}px ${SANS}`;
    ctx.letterSpacing = "0px";
    ctx.fillText(b.modelCode, w * 0.03, h * 0.64);
    ctx.font = `500 ${h * 0.075}px ${SANS}`;
    ctx.letterSpacing = `${h * 0.015}px`;
    ctx.fillText(b.descriptor, w * 0.03, h * 0.78);
    ctx.fillText(b.spec, w * 0.03, h * 0.88);
    ctx.letterSpacing = "0px";
    ctx.font = `500 ${h * 0.09}px ${JP}`;
    ctx.fillText(b.secondary, w * 0.30, h * 0.2);

    // checkboxes (right block)
    ctx.font = `600 ${h * 0.065}px ${SANS}`;
    ctx.lineWidth = Math.max(2, h * 0.012);
    ctx.strokeStyle = b.ink;
    b.checks.forEach((label, i) => {
      const x = w * 0.72, y = h * 0.1 + i * h * 0.15;
      ctx.fillText(label, x, y + h * 0.07);
      ctx.strokeRect(x + w * 0.12, y, h * 0.08, h * 0.08);
    });

    // round badge + property stencil
    const r = h * 0.14, cx = w * 0.95, cy = h * 0.78;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = b.inkLight;
    ctx.font = `700 ${r * 0.9}px ${SANS}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(b.modelCode.replace(/\D/g, "") || "45", cx, cy + r * 0.05);
    ctx.fillStyle = b.ink;
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.font = `700 ${h * 0.06}px ${MONO}`;
    ctx.fillText(`${b.unitId}  ·  ${b.owner}`, w * 0.03, h * 0.97);
  });
}

/**
 * Small monolith/equipment base plate: dark background, bone text.
 * w × h in pixels (default 512 × 64).
 */
export function createBasePlateTex(
  label: string,
  unitId = "UNIT-01",
  w = 512,
  h = 64,
): THREE.CanvasTexture {
  return canvasTex(w, h, ctx => {
    ctx.fillStyle = "#12101A";
    ctx.fillRect(0, 0, w, h);
    // thin stripes on left
    const bw = h * 0.09;
    ["#E5322B", "#F0742A", "#F4B62E", "#2E9E5B", "#1F7FB8"].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(w * 0.01 + i * bw, h * 0.22, bw * 0.9, h * 0.56);
    });
    ctx.fillStyle = "#F2EBDD";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${h * 0.34}px ${SANS}`;
    ctx.letterSpacing = `${h * 0.03}px`;
    ctx.fillText(label, w * 0.18, h * 0.42);
    ctx.font = `400 ${h * 0.26}px ${MONO}`;
    ctx.letterSpacing = "0px";
    ctx.fillStyle = "#A89880";
    ctx.fillText(unitId, w * 0.18, h * 0.74);
  });
}

/** Worn-paint canvas texture: base color + edge wear + scratches (2D approximation). */
export function createWornPaintTex(
  paintHex: string,
  stencilLines: string[],
  w = 1024,
  h = 1024,
): THREE.CanvasTexture {
  return canvasTex(w, h, ctx => {
    ctx.fillStyle = paintHex;
    ctx.fillRect(0, 0, w, h);

    // Edge wear gradient (darken at edges)
    const gEdge = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.min(w, h) * 0.72);
    gEdge.addColorStop(0,   "rgba(0,0,0,0)");
    gEdge.addColorStop(0.7, "rgba(0,0,0,0)");
    gEdge.addColorStop(1,   "rgba(0,0,0,0.52)");
    ctx.fillStyle = gEdge;
    ctx.fillRect(0, 0, w, h);

    // Random scratches
    ctx.strokeStyle = "rgba(0,0,0,0.30)";
    for (let s = 0; s < 14; s++) {
      const x0 = Math.random() * w, y0 = Math.random() * h;
      const len = 30 + Math.random() * 200;
      const ang = Math.random() * Math.PI;
      ctx.lineWidth = 0.8 + Math.random() * 1.2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len);
      ctx.stroke();
    }
    // Light scratches
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    for (let s = 0; s < 8; s++) {
      const x0 = Math.random() * w, y0 = Math.random() * h;
      const len = 20 + Math.random() * 120;
      const ang = Math.random() * Math.PI;
      ctx.lineWidth = 0.5 + Math.random() * 0.8;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len);
      ctx.stroke();
    }

    // Stencil text lines
    if (stencilLines.length) {
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = "#F2EBDD";
      const fontSize = h * 0.065;
      ctx.font = `700 ${fontSize}px ${MONO}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const lineH = fontSize * 1.4;
      const startY = h * 0.5 - (stencilLines.length - 1) * lineH / 2;
      stencilLines.forEach((line, i) => ctx.fillText(line, w * 0.5, startY + i * lineH));
      ctx.restore();
    }
  });
}

/** Diagonal stripe band canvas (5 hard-edge stripes at ~35°). */
export function createStripeBandTex(stripes = ["#E5322B", "#F0742A", "#F4B62E", "#2E9E5B", "#1F7FB8"], w = 512, h = 64): THREE.CanvasTexture {
  return canvasTex(w, h, ctx => {
    ctx.fillStyle = "#3A3B3C";
    ctx.fillRect(0, 0, w, h);
    const sw = w / stripes.length;
    const slant = h * 1.1; // diagonal offset
    stripes.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(i * sw - slant, 0);
      ctx.lineTo((i + 1) * sw - slant, 0);
      ctx.lineTo((i + 1) * sw + slant, h);
      ctx.lineTo(i * sw + slant, h);
      ctx.closePath();
      ctx.fill();
    });
  });
}

/** Thin strip: horizontal 5-stripe guard + small wordmark/model (for narrow faces). */
export function createStripeStripTexture(b: Brand, w = 1024, h = 64): THREE.CanvasTexture {
  return canvasTex(w, h, ctx => {
    ctx.fillStyle = b.paper;
    ctx.fillRect(0, 0, w, h);
    const bh = h * 0.14;
    const y0 = (h - bh * b.stripes.length) / 2;
    b.stripes.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(w * 0.42, y0 + i * bh, w * 0.58, bh); });
    // chevron cut where the guard starts
    ctx.fillStyle = b.paper;
    ctx.beginPath();
    ctx.moveTo(w * 0.42, 0); ctx.lineTo(w * 0.42 + h * 0.6, h / 2); ctx.lineTo(w * 0.42, h);
    ctx.fill();
    ctx.fillStyle = b.ink;
    ctx.textBaseline = "middle";
    ctx.font = `700 ${h * 0.5}px ${SANS}`;
    ctx.letterSpacing = `${h * 0.06}px`;
    ctx.fillText(`${b.brandName}  ${b.modelCode}`, w * 0.02, h * 0.54);
    ctx.letterSpacing = "0px";
  });
}
