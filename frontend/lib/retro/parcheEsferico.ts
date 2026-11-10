import * as THREE from "three";

// Z18: parche de ESFERA de radio R centrado en el ojo (marco capturado de Z16).
// Un punto (u, v) ∈ [0,1]² (u izq→der, v arriba→abajo) tiene
//   yaw   = yawC   + (u − 0.5)·anchoAng
//   pitch = pitchC + (0.5 − v)·altoAng
//   pos   = R·(cos p·sin y, sin p, −cos p·cos y)        (marco: x derecha, y arriba, −z adelante)
// UV lineales: uv = (u, 1 − v) (la textura del canvas tiene flipY → v=0 arriba).
// Winding hacia el ojo (se ve desde adentro); igual se usa DoubleSide.
// Las posiciones se reescriben en el mismo Float32Array: sin allocations por frame.

export interface ParamsParche {
  yaw: number; pitch: number;   // centro (rad)
  ancho: number; alto: number;  // tamaño angular (rad)
  R: number;                    // radio (m)
  curva: number;                // 1 = esfera; 0 = plano tangente en el centro (morph del panel)
  vertical: boolean;            // true = u recorre el pitch (líneas guía verticales)
}

export function crearParche(segU: number, segV: number): THREE.BufferGeometry {
  const nu = Math.max(1, Math.floor(segU)), nv = Math.max(1, Math.floor(segV));
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3);
  const uv = new Float32Array((nu + 1) * (nv + 1) * 2);
  const idx: number[] = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const k = j * (nu + 1) + i;
    uv[k * 2] = i / nu; uv[k * 2 + 1] = 1 - j / nv;
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + (nu + 1), d = c + 1;
    idx.push(a, c, b, b, c, d);                    // CCW visto desde el ojo
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.userData.nu = nu; g.userData.nv = nv;
  return g;
}

/** Reescribe las posiciones del parche (sin allocations). */
export function actualizarParche(g: THREE.BufferGeometry, P: ParamsParche): void {
  const nu = g.userData.nu as number, nv = g.userData.nv as number;
  const attr = g.getAttribute("position") as THREE.BufferAttribute;
  const a = attr.array as Float32Array;
  const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw), cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
  // base tangente en el centro (para el morph plano → esfera)
  const dX = cp * sy, dY = sp, dZ = -cp * cy;      // dirección del centro
  const rX = cy, rZ = sy;                            // derecha tangente (rY = 0)
  const uX = -sp * sy, uY = cp, uZ = sp * cy;        // arriba tangente
  const k = P.curva;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu, v = j / nv;
    let dy: number, dp: number;
    if (P.vertical) { dp = (u - 0.5) * P.alto; dy = (0.5 - v) * P.ancho; }   // u a lo largo del pitch
    else            { dy = (u - 0.5) * P.ancho; dp = (0.5 - v) * P.alto; }
    const y = P.yaw + dy, p = P.pitch + dp;
    const cpp = Math.cos(p);
    let x = P.R * cpp * Math.sin(y), yy = P.R * Math.sin(p), z = -P.R * cpp * Math.cos(y);
    if (k < 1) {                                     // plano tangente con la misma extensión angular
      const tx = Math.tan(dy), ty = Math.tan(dp);
      const fx = P.R * (dX + tx * rX + ty * uX), fy = P.R * (dY + ty * uY), fz = P.R * (dZ + tx * rZ + ty * uZ);
      x = fx + (x - fx) * k; yy = fy + (yy - fy) * k; z = fz + (z - fz) * k;
    }
    const o = (j * (nu + 1) + i) * 3;
    a[o] = x; a[o + 1] = yy; a[o + 2] = z;
  }
  attr.needsUpdate = true;
}

/** Inversa del mapeo: dirección (yaw, pitch) → (u, v) del parche; true si cae adentro (± margen en u/v). */
export const UV_PARCHE = { u: 0, v: 0 };
export function uvDeParche(yaw: number, pitch: number, P: { yaw: number; pitch: number; ancho: number; alto: number }, margen = 0): boolean {
  UV_PARCHE.u = (yaw - P.yaw) / P.ancho + 0.5;
  UV_PARCHE.v = 0.5 - (pitch - P.pitch) / P.alto;
  return UV_PARCHE.u >= -margen && UV_PARCHE.u <= 1 + margen && UV_PARCHE.v >= -margen && UV_PARCHE.v <= 1 + margen;
}

// ── Z21: foco como plano CASI frontal ─────────────────────────────────────────
// Objetivo: plano frente al ojo en la dirección c (unitaria, marco), con base derecha r / arriba u
// (u = arriba de la cámara al entrar → sin roll), distancia D y tamaño W × H. Con curvatura
// residual: T = lerp(Qs, Q, plano), donde Q es el punto del plano y Qs su proyección a la esfera
// de radio D (misma dirección → la extensión proyectada es idéntica).
export interface PlanoFoco {
  cx: number; cy: number; cz: number;
  rx: number; ry: number; rz: number;
  ux: number; uy: number; uz: number;
  D: number; W: number; H: number; plano: number;
}

/**
 * Mezcla in situ las posiciones ACTUALES del parche (ya escritas en su pose esférica de reposo)
 * hacia el plano objetivo con factor `k` (0 = esfera, 1 = objetivo). (u0..u1, v0..v1) = sub-rango
 * de UV del plano (p. ej. la pantalla CRT dentro de GALERÍA); `escalaD` acerca el resultado al ojo.
 */
export function morphAPlano(g: THREE.BufferGeometry, P: PlanoFoco, k: number, u0 = 0, u1 = 1, v0 = 0, v1 = 1, escalaD = 1): void {
  if (k <= 0) return;
  const nu = g.userData.nu as number, nv = g.userData.nv as number;
  const attr = g.getAttribute("position") as THREE.BufferAttribute;
  const a = attr.array as Float32Array;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = u0 + (u1 - u0) * (i / nu), v = v0 + (v1 - v0) * (j / nv);
    const x = (u - 0.5) * P.W, y = (0.5 - v) * P.H;
    const qx = P.D * P.cx + P.rx * x + P.ux * y;
    const qy = P.D * P.cy + P.ry * x + P.uy * y;
    const qz = P.D * P.cz + P.rz * x + P.uz * y;
    const s = P.D / Math.max(1e-6, Math.hypot(qx, qy, qz));          // a la esfera de radio D
    const tx = (qx * s + (qx - qx * s) * P.plano) * escalaD;
    const ty = (qy * s + (qy - qy * s) * P.plano) * escalaD;
    const tz = (qz * s + (qz - qz * s) * P.plano) * escalaD;
    const o = (j * (nu + 1) + i) * 3;
    a[o] += (tx - a[o]) * k; a[o + 1] += (ty - a[o + 1]) * k; a[o + 2] += (tz - a[o + 2]) * k;
  }
  attr.needsUpdate = true;
}

/** Raycast contra los TRIÁNGULOS reales del parche (Möller–Trumbore), en coordenadas del marco.
 *  Devuelve en RAY_MALLA la UV interpolada (u, v con v hacia arriba, como el atributo) y t. */
export const RAY_MALLA = { ok: false, u: 0, v: 0, t: 0 };
export function raycastMalla(g: THREE.BufferGeometry, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): boolean {
  const pos = (g.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
  const uv = (g.getAttribute("uv") as THREE.BufferAttribute).array as Float32Array;
  const idx = g.getIndex()!.array;
  let mejor = 1e9;
  RAY_MALLA.ok = false;
  for (let k = 0; k < idx.length; k += 3) {
    const ia = idx[k] * 3, ib = idx[k + 1] * 3, ic = idx[k + 2] * 3;
    const e1x = pos[ib] - pos[ia], e1y = pos[ib + 1] - pos[ia + 1], e1z = pos[ib + 2] - pos[ia + 2];
    const e2x = pos[ic] - pos[ia], e2y = pos[ic + 1] - pos[ia + 1], e2z = pos[ic + 2] - pos[ia + 2];
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-9) continue;
    const inv = 1 / det;
    const sx = ox - pos[ia], sy = oy - pos[ia + 1], sz = oz - pos[ia + 2];
    const b1 = (sx * px + sy * py + sz * pz) * inv;
    if (b1 < 0 || b1 > 1) continue;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
    const b2 = (dx * qx + dy * qy + dz * qz) * inv;
    if (b2 < 0 || b1 + b2 > 1) continue;
    const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (t <= 0 || t >= mejor) continue;
    mejor = t;
    const b0 = 1 - b1 - b2, ua = idx[k] * 2, ub = idx[k + 1] * 2, uc = idx[k + 2] * 2;
    RAY_MALLA.u = b0 * uv[ua] + b1 * uv[ub] + b2 * uv[uc];
    RAY_MALLA.v = b0 * uv[ua + 1] + b1 * uv[ub + 1] + b2 * uv[uc + 1];
    RAY_MALLA.t = t; RAY_MALLA.ok = true;
  }
  return RAY_MALLA.ok;
}
