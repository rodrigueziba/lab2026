import * as THREE from "three";

// J5: tiny amber CRT for lectern screens (lights indicator).
// Shared uniforms (module singletons) so the DebugMenu tunes every screen at once.
export const RETRO_CRT = {
  uTime:  { value: 0 },
  uCurve: { value: 0.08 },
  uScan:  { value: 0.30 },
};

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uTime, uCurve, uScan;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec2 barrel(vec2 uv, float k) {
  vec2 c = uv * 2.0 - 1.0;
  c *= 1.0 + k * dot(c, c);
  return c * 0.5 + 0.5;
}

void main() {
  vec2 uv = barrel(vUv, uCurve);
  // thick bezel: outside the curved glass is dark housing
  vec2 b = min(uv, 1.0 - uv);
  float glass = smoothstep(0.0, 0.03, min(b.x, b.y));
  if (glass <= 0.0) { gl_FragColor = vec4(0.07, 0.063, 0.10, 1.0); return; }

  // slight horizontal jitter per band
  float band = floor(uv.y * 24.0);
  uv.x += (hash(vec2(band, floor(uTime * 6.0))) - 0.5) * 0.004;

  // chromatic aberration (radial)
  vec2 d = uv - 0.5;
  vec3 col;
  col.r = texture2D(uMap, uv + d * 0.012).r;
  col.g = texture2D(uMap, uv).g;
  col.b = texture2D(uMap, uv - d * 0.012).b;

  // phosphor glow: cheap 4-tap halo
  float o = 0.035;
  vec3 halo = texture2D(uMap, uv + vec2(o, 0.0)).rgb + texture2D(uMap, uv - vec2(o, 0.0)).rgb
            + texture2D(uMap, uv + vec2(0.0, o)).rgb + texture2D(uMap, uv - vec2(0.0, o)).rgb;
  col += halo * 0.12;

  // scanlines + flicker + vignette
  col *= 1.0 - uScan * (0.5 - 0.5 * cos(uv.y * 64.0 * 6.28318));
  col *= 0.96 + 0.04 * sin(uTime * 50.0);
  col *= 1.0 - 0.45 * smoothstep(0.3, 1.2, dot(d * 2.0, d * 2.0));
  col = col * glass + vec3(0.02, 0.012, 0.0);   // lifted blacks

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** J5: CRT screen material; set `.uniforms.uMap.value` to the canvas texture. */
export function createCrtScreenMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap:   { value: null },
      uTime:  RETRO_CRT.uTime,
      uCurve: RETRO_CRT.uCurve,
      uScan:  RETRO_CRT.uScan,
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
}

/** J5: point a lectern screen (CRT shader or plain basic material) at its canvas texture. */
export function setScreenMap(mat: THREE.ShaderMaterial | THREE.MeshBasicMaterial, tex: THREE.Texture): void {
  if (mat instanceof THREE.ShaderMaterial) { mat.uniforms.uMap.value = tex; return; }
  mat.map = tex;
  mat.needsUpdate = true;
}
