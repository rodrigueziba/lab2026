import * as THREE from "three";

// Worn-paint panel shader (2.3 of the visual brief).
// Use as a standalone ShaderMaterial on a plane, or bake to texture.

export interface WornPaintOptions {
  paint?: THREE.ColorRepresentation;
  base?:  THREE.ColorRepresentation;
  dirt?:  THREE.ColorRepresentation;
  wear?:  number;  // 0–1
  scale?: number;  // noise frequency (1/m equiv.)
  seed?:  number;
}

export function createWornPaintMaterial(opts: WornPaintOptions = {}): THREE.ShaderMaterial {
  const {
    paint = "#C0552F",
    base  = "#6B6E70",
    dirt  = "#2A1A12",
    wear  = 0.55,
    scale = 6.0,
    seed  = 1.0,
  } = opts;

  return new THREE.ShaderMaterial({
    uniforms: {
      uPaint: { value: new THREE.Color(paint) },
      uBase:  { value: new THREE.Color(base)  },
      uDirt:  { value: new THREE.Color(dirt)  },
      uWear:  { value: wear  },
      uScale: { value: scale },
      uSeed:  { value: seed  },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vUv;
      uniform vec3  uPaint, uBase, uDirt;
      uniform float uWear, uScale, uSeed;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7) + uSeed)) * 43758.5453);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i),         hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float a = 0.5, s = 0.0;
        for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
        return s;
      }

      void main() {
        vec2 uv = vUv;
        vec2 e  = min(uv, 1.0 - uv);
        float edge = 1.0 - smoothstep(0.0, 0.07, min(e.x, e.y));

        float n    = fbm(uv * uScale);
        float wear = smoothstep(1.0 - uWear, 1.0, edge * 0.8 + n * 0.55);

        float sc      = fbm(vec2(uv.x * 220.0, uv.y * 3.0));
        float scratch = smoothstep(0.78, 0.9, sc) * 0.6;

        float dirtN = smoothstep(0.55, 0.9, fbm(uv * uScale * 0.7 + 7.0)) * 0.35;

        vec3 col = uPaint;
        col = mix(col, uDirt, dirtN);
        col = mix(col, uBase, max(wear, scratch));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}
