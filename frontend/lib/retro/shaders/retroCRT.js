import * as THREE from 'three';

/**
 * Post-proceso "CRT + cinta VHS" para usar con ShaderPass.
 * Orden recomendado: RenderPass -> UnrealBloomPass -> ShaderPass(RetroCRTShader) -> OutputPass
 */
export const RetroCRTShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uCurve: { value: 0.1 }, // barrel distortion (0 = plano)
    uScan: { value: 0.22 }, // intensidad de scanlines
    uScanCount: { value: 360.0 },
    uCA: { value: 0.0016 }, // aberración cromática
    uGrain: { value: 0.05 },
    uVig: { value: 0.3 },
    uWobble: { value: 0.0012 }, // jitter horizontal de cinta
    uTint: { value: new THREE.Color(1.0, 0.96, 0.88) }, // blancos cremosos
    uLift: { value: 0.02 }, // negros levantados
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uTime, uCurve, uScan, uScanCount, uCA, uGrain, uVig, uWobble, uLift;
    uniform vec3 uTint;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }
    vec2 barrel(vec2 uv, float k) {
      vec2 c = uv * 2.0 - 1.0;
      c *= 1.0 + k * dot(c, c);
      return c * 0.5 + 0.5;
    }

    void main() {
      vec2 uv = barrel(vUv, uCurve);
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      // wobble de cinta (jitter horizontal por bandas, a saltos)
      float band = floor(uv.y * 48.0);
      float jit = (hash(vec2(band, floor(uTime * 8.0))) - 0.5) * uWobble * 2.0;
      uv.x += jit + sin(uv.y * 30.0 + uTime * 2.0) * uWobble * 0.3;

      // aberración cromática radial
      vec2 d = (uv - 0.5);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + d * uCA * 2.0).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - d * uCA * 2.0).b;

      // scanlines
      float s = 0.5 - 0.5 * cos(uv.y * uScanCount * 6.28318);
      col *= 1.0 - uScan * s;

      // grano
      col += (hash(uv * uRes + uTime) - 0.5) * uGrain;

      // viñeta
      vec2 c = vUv * 2.0 - 1.0;
      col *= 1.0 - uVig * smoothstep(0.4, 1.4, dot(c, c));

      // blancos cremosos / negros levantados
      col = col * uTint + uLift;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
