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
