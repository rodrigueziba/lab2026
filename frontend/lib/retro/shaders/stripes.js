import * as THREE from 'three';

/**
 * Banda de franjas paralelas: recta, curva o en chevron.
 * Coordenadas en espacio UV del plano donde se aplique (0..1).
 * Presets al final del archivo.
 */
export function createStripeMaterial({
  colors = ['#E5322B', '#F0742A', '#F4B62E', '#2E9E5B', '#1F7FB8'],
  angle = Math.PI * 0.2, // inclinación de la banda (radianes)
  width = 0.06, // ancho de cada franja
  gap = 0.0, // espacio entre franjas
  curve = 0.0, // curvatura (el signo cambia la dirección)
  zig = 0.0, // amplitud del chevron
  zigFreq = 1.5, // frecuencia del chevron
  soft = 0.0015, // suavidad de borde (0 = borde duro)
  emissive = 1.0, // > 1 para alimentar el bloom (versión neón)
} = {}) {
  const cols = colors.slice(0, 8).map((c) => new THREE.Color(c));
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uColors: { value: cols },
      uCount: { value: cols.length },
      uAngle: { value: angle },
      uWidth: { value: width },
      uGap: { value: gap },
      uCurve: { value: curve },
      uZig: { value: zig },
      uZigFreq: { value: zigFreq },
      uSoft: { value: soft },
      uEmissive: { value: emissive },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform vec3 uColors[8];
      uniform int uCount;
      uniform float uAngle, uWidth, uGap, uCurve, uZig, uZigFreq, uSoft, uEmissive;

      void main() {
        vec2 p = vUv - 0.5;
        vec2 dir = vec2(cos(uAngle), sin(uAngle));
        vec2 nrm = vec2(-dir.y, dir.x);

        float along  = dot(p, dir);
        float across = dot(p, nrm);

        // curva (parábola) y chevron (onda triangular)
        across += uCurve * along * along;
        across += uZig * (abs(fract(along * uZigFreq) - 0.5) * 2.0);

        float pitch = uWidth + uGap;
        float total = pitch * float(uCount);
        across += total * 0.5; // centrar el paquete de franjas

        float id = floor(across / pitch);
        float f  = across - id * pitch;

        if (id < 0.0 || id >= float(uCount)) discard;

        float inBand = smoothstep(0.0, uSoft, f) *
                       (1.0 - smoothstep(uWidth - uSoft, uWidth, f));
        if (inBand < 0.001) discard;

        vec3 col = uColors[int(id)] * uEmissive;
        gl_FragColor = vec4(col, inBand);

        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Presets listos para usar: createStripeMaterial(STRIPE_PRESETS.sakura) */
export const STRIPE_PRESETS = {
  sakura: {
    colors: ['#F27FA5', '#E5322B', '#F0742A', '#F4B62E', '#2E9E5B', '#1F7FB8'],
    angle: 0.62,
    width: 0.05,
    gap: 0,
    soft: 0.001,
  },
  neonCurvo: {
    colors: ['#7FEFE6', '#34F28A', '#FFD21A', '#FF1A1A'],
    angle: 1.1,
    width: 0.09,
    gap: 0.01,
    curve: -1.2,
    soft: 0.004,
    emissive: 2.0,
  },
  chevron: {
    colors: ['#F4D21A', '#F4A31A', '#F0742A', '#E5322B'],
    angle: 0.0,
    width: 0.11,
    gap: 0,
    zig: 0.12,
    zigFreq: 0.8,
    soft: 0.001,
  },
};
