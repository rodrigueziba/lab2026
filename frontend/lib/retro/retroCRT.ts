import * as THREE from "three";

// CRT + VHS tape post-process shader for ShaderPass (three/addons).
// R4: R4 initial values are toned down from the brief defaults.

export const RetroCRTShader = {
  uniforms: {
    tDiffuse:   { value: null },
    uTime:      { value: 0 },
    uRes:       { value: new THREE.Vector2(1, 1) },
    uCurve:     { value: 0.06 },    // barrel distortion
    uScan:      { value: 0.18 },    // scanline intensity
    uScanCount: { value: 360.0 },   // scanline density
    uCA:        { value: 0.0012 },  // chromatic aberration
    uGrain:     { value: 0.045 },   // film grain
    uVig:       { value: 0.38 },    // vignette strength
    uWobble:    { value: 0.0006 },  // VHS horizontal jitter
    uTint:      { value: new THREE.Color(1.0, 0.96, 0.88) }, // creamy whites
    uLift:      { value: 0.015 },   // raised blacks
    uComfort:   { value: 0 },       // 1 = comfort mode (kill wobble + CA)
    // F2: destello de cortina diegético — se mezcla ANTES de scanlines/grano/viñeta
    uFlash:      { value: 0 },                             // 0–1 (escrito por RetroPostFX desde FLASH_STATE)
    uFlashColor: { value: new THREE.Color("#FFF3DC") },    // blanco cálido (lineal, ColorManagement)
    uFlashGlow:  { value: 0.35 },                          // resplandor extra en el centro
    // F3: límites del CRT escalados con uFlash (uFlash=0 → valores originales exactos)
    uFlashScanMax: { value: 0.06 },  // scanlines restan como máximo esto con uFlash=1
    uFlashVigAten: { value: 0.6 },   // atenuación de la viñeta con uFlash=1
    uFlashCapMax:  { value: 1.0 },   // tope de luminancia con uFlash=1 (normal 0.92)
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2  uRes;
    uniform float uTime, uCurve, uScan, uScanCount, uCA, uGrain, uVig, uWobble, uLift;
    uniform float uComfort;
    uniform vec3  uTint;
    uniform float uFlash, uFlashGlow;
    uniform float uFlashScanMax, uFlashVigAten, uFlashCapMax;
    uniform vec3  uFlashColor;
    varying vec2  vUv;

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

      // VHS tape wobble (comfort mode: disabled)
      float effWobble = uWobble * (1.0 - uComfort);
      float band = floor(uv.y * 48.0);
      float jit  = (hash(vec2(band, floor(uTime * 8.0))) - 0.5) * effWobble * 2.0;
      uv.x += jit + sin(uv.y * 30.0 + uTime * 2.0) * effWobble * 0.3;

      // Chromatic aberration (comfort mode: disabled)
      vec2  d   = uv - 0.5;
      float effCA = uCA * (1.0 - uComfort);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + d * effCA * 2.0).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - d * effCA * 2.0).b;

      // F2: destello de cortina — blanco cálido + núcleo radial, antes del resto del CRT.
      // uFlash = 0 → rama no tomada, imagen idéntica a la anterior.
      if (uFlash > 0.0) {
        float r = length(d);
        vec3 flashCol = uFlashColor * (1.0 + uFlashGlow * (1.0 - smoothstep(0.0, 0.7, r)));
        col = mix(col, flashCol, uFlash);
      }

      // Scanlines
      float s = 0.5 - 0.5 * cos(uv.y * uScanCount * 6.28318);
      // F3: con destello las scanlines restan como máximo uFlashScanMax
      float effScan = mix(uScan, min(uScan, uFlashScanMax), uFlash);
      col *= 1.0 - effScan * s;

      // Film grain
      col += (hash(uv * uRes + uTime) - 0.5) * uGrain;

      // Vignette (uses pre-barrel UV)
      vec2 vc = vUv * 2.0 - 1.0;
      // F3: viñeta atenuada durante el destello
      float effVig = uVig * (1.0 - uFlashVigAten * uFlash);
      col *= 1.0 - effVig * smoothstep(0.4, 1.4, dot(vc, vc));

      // Creamy whites + raised blacks — cap luminance at 0.92
      col = col * uTint + uLift;
      // F3: el tope sube hacia uFlashCapMax con el destello
      col = min(col, mix(0.92, uFlashCapMax, uFlash));

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

// Shared singleton uniforms — mutated by RetroPostFX each frame
export const CRT_UNIFORMS = RetroCRTShader.uniforms;
