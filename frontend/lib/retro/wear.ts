import * as THREE from "three";

// J5: worn-paint injection for lit materials (keeps spotLight/PBR).
// Shared uniform objects — mutated by the DebugMenu / setLecternRetro, read by
// every injected shader via direct object reference (same pattern as prismUniforms.ts).
export const RETRO_WEAR = {
  uWearAmt:   { value: 0 },    // 0 = off (original look), else DBG_RETRO.wear
  uWearScale: { value: 6 },
  uGrime:     { value: 0.35 },
};

const GLSL_COMMON = /* glsl */ `
uniform float uWearAmt, uWearScale, uGrime, uGrimeScale, uFingerWear;
uniform vec3 uUnder;
varying vec3 vWearPos;
varying vec2 vWearUv;
float wHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float wNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(wHash(i), wHash(i + vec3(1,0,0)), f.x),
                 mix(wHash(i + vec3(0,1,0)), wHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(wHash(i + vec3(0,0,1)), wHash(i + vec3(1,0,1)), f.x),
                 mix(wHash(i + vec3(0,1,1)), wHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float wFbm(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * wNoise(p); p *= 2.03; a *= 0.5; }
  return s;
}
`;

const GLSL_WEAR = /* glsl */ `
float wearMask = 0.0;
if (uWearAmt > 0.0) {
  // Edge distance in metres: uv border distance × metres-per-uv (from derivatives),
  // so thin pieces (8 mm strips) don't wear entirely.
  vec2 e = min(vWearUv, 1.0 - vWearUv);
  vec3 dpx = dFdx(vWearPos), dpy = dFdy(vWearPos);
  vec2 dux = dFdx(vWearUv),  duy = dFdy(vWearUv);
  float mPerUv = (length(dpx) + length(dpy)) / max(length(dux) + length(duy), 1e-5);
  float edgeM = min(e.x, e.y) * mPerUv;
  float edge = 1.0 - smoothstep(0.0, 0.012, edgeM);

  float n = wFbm(vWearPos * uWearScale * 4.0);
  wearMask = smoothstep(1.0 - uWearAmt, 1.0, edge * 0.85 + n * 0.5);

  // fine directional scratches
  float sc = wFbm(vec3(vWearPos.x * 260.0, vWearPos.y * 4.0, vWearPos.z * 4.0));
  float scratch = smoothstep(0.80, 0.92, sc) * 0.5 * uWearAmt;

  // finger polish at the centre of keys/buttons
  vec2 c = vWearUv - 0.5;
  float finger = uFingerWear * (1.0 - smoothstep(0.05, 0.32, length(c))) * (0.6 + 0.4 * n);

  float dirt = smoothstep(0.55, 0.9, wFbm(vWearPos * uWearScale * 2.8 + 7.0)) * uGrime * uGrimeScale;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.165, 0.10, 0.07), dirt * (1.0 - edge));
  diffuseColor.rgb = mix(diffuseColor.rgb, uUnder, max(wearMask, scratch));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.12 + 0.03, finger);
  wearMask = max(wearMask, scratch);
}
`;

export interface WearOptions {
  under?: THREE.ColorRepresentation;   // what shows through chipped paint
  fingerWear?: number;                 // 0–1, polish at face centre (keys)
  grimeScale?: number;                 // K3: 0 = no grime spots (dark panels), 1 = full (default)
}

/** J5: inject edge wear / scratches / grime into a MeshStandardMaterial. Call once per material. */
export function injectWear(mat: THREE.MeshStandardMaterial, opts: WearOptions = {}): void {
  const uUnder      = { value: new THREE.Color(opts.under ?? "#6B6E70") };
  const uFingerWear = { value: opts.fingerWear ?? 0 };
  const uGrimeScale = { value: opts.grimeScale ?? 1.0 };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWearAmt    = RETRO_WEAR.uWearAmt;
    shader.uniforms.uWearScale  = RETRO_WEAR.uWearScale;
    shader.uniforms.uGrime      = RETRO_WEAR.uGrime;
    shader.uniforms.uGrimeScale = uGrimeScale;
    shader.uniforms.uUnder      = uUnder;
    shader.uniforms.uFingerWear = uFingerWear;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWearPos;\nvarying vec2 vWearUv;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvWearPos = position;\nvWearUv = uv;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + GLSL_COMMON)
      .replace("#include <color_fragment>", "#include <color_fragment>\n" + GLSL_WEAR)
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.55, wearMask);",
      );
  };
  mat.customProgramCacheKey = () => "retroWear";
  mat.needsUpdate = true;
}
