// Z42: piezas visuales compartidas de "una luz" al estilo de la luz de la narrativa (Z28, LuzLejana):
// halo (sprite aditivo con scanlines tenues), cono suave (cilindro abierto con bordes por ángulo de vista
// y bandas de polvo) y charco de luz en el piso. Los shaders y el halo cálido son EXACTAMENTE los de
// LuzLejana (movidos acá sin cambios); los usan LuzLejana y las 4 luces del visualizador (LucesHaz).
// Uniforms de cono y charco: uColor (vec3) y uOpacidad (float). Sin luces reales.

import * as THREE from "three";

export const CONO_VERT = /* glsl */`
  varying vec2 vUv;
  varying float vBorde;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec3 n  = normalize(mat3(modelMatrix) * normal);
    vec3 v  = normalize(cameraPosition - wp.xyz);
    vBorde  = abs(dot(n, v));            // 1 de frente, 0 en el contorno → bordes suaves
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
export const CONO_FRAG = /* glsl */`
  uniform vec3  uColor;
  uniform float uOpacidad;
  varying vec2  vUv;
  varying float vBorde;
  void main() {
    float alto  = mix(0.35, 1.0, vUv.y);           // más denso arriba, junto a la fuente
    float borde = pow(vBorde, 1.6);
    // bandas horizontales tenues (polvo en suspensión, guiño a las scanlines)
    float banda = 0.85 + 0.15 * sin(vUv.y * 90.0);
    gl_FragColor = vec4(uColor, uOpacidad * alto * borde * banda);
  }
`;
export const POZO_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
export const POZO_FRAG = /* glsl */`
  uniform vec3  uColor;
  uniform float uOpacidad;
  varying vec2  vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = 1.0 - smoothstep(0.0, 1.0, d);
    gl_FragColor = vec4(uColor, uOpacidad * a * a);
  }
`;

/** Cono: cilindro abierto unitario (alto 1, radio de base 1, punta 0,06). Se escala (R, alto, R). */
export const CONO_GEO_ARGS = [0.06, 1, 1, 48, 1, true] as const;

// Paradas del gradiente del halo. "calida" = la de la luz de la narrativa (sin cambios);
// "neutra" = mismas alfas en blanco, para teñirla con el color del sprite (luces del visualizador).
const PARADAS_CALIDA: readonly [number, string][] = [
  [0.00, "rgba(255,250,236,1)"],
  [0.06, "rgba(255,238,200,0.95)"],
  [0.18, "rgba(255,226,168,0.45)"],
  [0.45, "rgba(255,200,130,0.12)"],
  [1.00, "rgba(255,180,110,0)"],
];
const PARADAS_NEUTRA: readonly [number, string][] = [
  [0.00, "rgba(255,255,255,1)"],
  [0.06, "rgba(255,255,255,0.95)"],
  [0.18, "rgba(255,255,255,0.45)"],
  [0.45, "rgba(255,255,255,0.12)"],
  [1.00, "rgba(255,255,255,0)"],
];

/** Halo de la luz: núcleo + halo + scanlines tenues (estilo CRT). Una sola textura por paleta. */
export function crearHalo(paleta: "calida" | "neutra" = "calida"): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  for (const [o, col] of paleta === "calida" ? PARADAS_CALIDA : PARADAS_NEUTRA) r.addColorStop(o, col);
  g.fillStyle = r;
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = "rgba(0,0,0,0.18)";
  for (let y = 0; y < S; y += 4) g.fillRect(0, y, S, 1);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
