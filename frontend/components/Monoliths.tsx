"use client";
// N5: Two black matte monoliths flanking the tarima path.
// V2: Obsidian — conchoidal geometry, MeshPhysicalMaterial, PMREM envMap,
//     fresnel + golden veins + desaturation via onBeforeCompile.
// Left = image channel, Right = sound channel.
// Proximity drives left → uRemoteMix/uStaticMix (dome), right → audio crossfade.

import { useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_SILLAS } from "@/lib/debugConfig";
import { setMonolithProximity } from "@/lib/vizAudio";
import { createBasePlateTex } from "@/lib/retro/decals";

// ── V2: obsidian shader via onBeforeCompile ───────────────────────────────────
// Adds to MeshPhysicalMaterial:
//   • Purple-brown fresnel rim (#4A2A2F)  — replaces S1 cyan rim
//   • 60 % desaturation of outgoing light  — prevents haz colours tinting the stone
//   • Sparse golden veins (#FFB347)        — skip front face
function addObsidianShader(mat: THREE.MeshPhysicalMaterial) {
  mat.onBeforeCompile = (shader) => {
    // Pass object-space position + front-face flag to fragment
    shader.vertexShader =
      `varying vec3  vObsLocalPos;\nvarying float vObsIsFront;\n` +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vObsLocalPos = position;
vObsIsFront  = normal.z < -0.7 ? 1.0 : 0.0;`,
      );

    shader.uniforms.uObsVeinBright   = { value: DBG_SILLAS.monolithVeinBright };
    shader.uniforms.uObsRimIntensity = { value: DBG_SILLAS.monolithRimV2Intensity };
    shader.uniforms.uObsDesaturation = { value: DBG_SILLAS.monolithDesaturation };

    shader.fragmentShader =
      `varying vec3  vObsLocalPos;\nvarying float vObsIsFront;\n` +
      `uniform float uObsVeinBright;\nuniform float uObsRimIntensity;\nuniform float uObsDesaturation;\n` +
      shader.fragmentShader.replace(
        "#include <output_fragment>",
        `{
          // Fresnel rim — purple-brown #4A2A2F
          vec3  obsN   = normalize(vNormal);
          vec3  obsV   = normalize(vViewPosition);
          float obsRim = pow(max(0.0, 1.0 - dot(obsN, obsV)), 1.5);
          outgoingLight += vec3(0.290, 0.165, 0.184) * obsRim * uObsRimIntensity;

          // 60 % desaturation — prevents haz colours tinting the whole stone
          float obsLum = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
          outgoingLight = mix(outgoingLight, vec3(obsLum), uObsDesaturation);

          // Sparse golden veins — skip front face (panel area)
          float obsH  = fract(sin(dot(vObsLocalPos * 50.0,
                          vec3(127.1, 311.7, 74.7))) * 43758.5453);
          float obsH2 = fract(sin(dot(vObsLocalPos * 73.0 + 0.5,
                          vec3(269.5, 183.3, 124.1))) * 65435.1230);
          float obsVein = min(1.0, pow(obsH * 0.6 + obsH2 * 0.4, 70.0) * 8.0)
                          * (1.0 - vObsIsFront);
          outgoingLight += vec3(1.0, 0.70, 0.278) * obsVein * uObsVeinBright;
        }
        #include <output_fragment>`,
      );
    mat.userData.shader = shader;
  };
}

// ── V2: geometry constants ────────────────────────────────────────────────────
const W = 0.9;
const H = 3.2;
const D = 0.35;

const PLATE_W = W * 0.90;
const PLATE_H = 0.025;
const PLATE_D = D * 0.90;
const R5_MONOLITH_RETRO = true;

// ── V2: conchoidal fracture geometry (module-level cache — survives remounts) ─
const _geomCache = new Map<number, THREE.BufferGeometry>();

const _SPHERE_DEFS = [
  { ax: -1.0, ay:  0.30, az:  0.00, r: 3.0, cut: 0.082 },
  { ax: -1.0, ay: -0.45, az:  0.00, r: 2.7, cut: 0.065 },
  { ax:  1.0, ay:  0.15, az:  0.00, r: 3.2, cut: 0.090 },
  { ax:  1.0, ay:  0.55, az:  0.00, r: 2.8, cut: 0.070 },
  { ax:  0.0, ay:  1.00, az:  0.00, r: 2.5, cut: 0.100 },
  { ax:  0.0, ay:  0.20, az:  1.00, r: 3.5, cut: 0.085 },
  { ax: -0.7, ay:  0.50, az:  0.70, r: 3.0, cut: 0.060 },
  { ax:  0.8, ay: -0.30, az:  0.60, r: 2.9, cut: 0.068 },
  { ax:  0.0, ay: -1.00, az:  0.00, r: 2.3, cut: 0.045 },
] as const;

function _smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function _h3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

// 40×100×24 segs → 29 440 triangles (< 40 k budget).
function buildObsidianGeom(seed: number): THREE.BufferGeometry {
  if (_geomCache.has(seed)) return _geomCache.get(seed)!;

  const geo = new THREE.BoxGeometry(W, H, D, 40, 100, 24);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nor = geo.attributes.normal   as THREE.BufferAttribute;
  const cnt = pos.count;

  const sx: number[] = [], sy: number[] = [], sz: number[] = [], sr: number[] = [];
  for (const d of _SPHERE_DEFS) {
    const len = Math.sqrt(d.ax * d.ax + d.ay * d.ay + d.az * d.az);
    const dx = d.ax / len, dy = d.ay / len, dz = d.az / len;
    let tSurf = Infinity;
    if (Math.abs(dx) > 1e-6) tSurf = Math.min(tSurf, (W / 2) / Math.abs(dx));
    if (Math.abs(dy) > 1e-6) tSurf = Math.min(tSurf, (H / 2) / Math.abs(dy));
    if (Math.abs(dz) > 1e-6) tSurf = Math.min(tSurf, (D / 2) / Math.abs(dz));
    const jitter = 1.0 + (_h3(seed, sx.length, 7) - 0.5) * 0.15;
    const t = tSurf + (d.r - d.cut) * jitter;
    sx.push(dx * t); sy.push(dy * t); sz.push(dz * t);
    sr.push(d.r * jitter);
  }
  const nSph = sx.length;

  const tiltX = 0.14 + _h3(seed, 99, 1) * 0.08;
  const tiltZ = 0.07 + _h3(seed, 99, 2) * 0.05;
  const colors = new Float32Array(cnt * 3);

  for (let vi = 0; vi < cnt; vi++) {
    const x = pos.getX(vi), y = pos.getY(vi), z = pos.getZ(vi);
    const nx = nor.getX(vi), ny = nor.getY(vi), nz = nor.getZ(vi);

    if (nz < -0.85) {
      const inPanel =
        Math.abs(x) < W * 0.44 &&
        y > -H / 2 + H * 0.04 &&
        y < H / 2 - H * 0.18;
      const ofs = inPanel ? 0.008 : 0;
      pos.setXYZ(vi, x, y, z - ofs);
      colors[vi * 3] = 1; colors[vi * 3 + 1] = 1; colors[vi * 3 + 2] = 1;
      continue;
    }

    let disp = 0;
    for (let s = 0; s < nSph; s++) {
      const ddx = x - sx[s], ddy = y - sy[s], ddz = z - sz[s];
      const dist = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
      const pen  = Math.max(0, sr[s] - dist);
      if (pen > 0) disp = disp === 0 ? pen : -_smin(-disp, -pen, 0.02);
    }
    disp = Math.min(disp, 0.11);

    const noiseAmp = W * 0.016;
    const noise =
      Math.sin(x * 24.8 + seed * 0.7) *
      Math.sin(y * 18.4 + seed * 1.3) *
      Math.sin(z * 37.6 + seed * 2.1) * noiseAmp;

    let extra = 0;
    if (ny > 0.7) {
      const above = (y + tiltX * x + tiltZ * z) - (H / 2 - 0.08);
      if (above > 0) extra = above * 1.8 + _h3(x * 10 + seed, y * 10, z * 10) * 0.05;
      extra += (_h3(x * 5 + seed, y * 5, z * 5) - 0.5) * 0.035;
    }
    if (ny < -0.7) extra += (_h3(x * 4 + seed, y * 4, z * 4) - 0.5) * 0.012;

    const d2 = -(disp + noise + extra);
    pos.setXYZ(vi, x + nx * d2, y + ny * d2, z + nz * d2);

    const ao = Math.max(0, 1 - disp / 0.09);
    colors[vi * 3] = ao; colors[vi * 3 + 1] = ao; colors[vi * 3 + 2] = ao;
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  pos.needsUpdate = true;

  _geomCache.set(seed, geo);
  return geo;
}

// ── V2: procedural pre-dawn envMap ────────────────────────────────────────────
function buildProceduralEnv(gl: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const EW = 64, EH = 32;
  const data = new Float32Array(EW * EH * 4);
  for (let y = 0; y < EH; y++) {
    for (let x = 0; x < EW; x++) {
      const t = y / (EH - 1);
      let r = 0.008 + t * 0.012, g = 0.004 + t * 0.006, b = 0.018 + t * 0.008;
      const d1 = (t - 0.72) * 18, d2 = (t - 0.62) * 24, d3 = (t - 0.82) * 20;
      const w1 = Math.exp(-(d1 * d1)) * 0.55;
      const w2 = Math.exp(-(d2 * d2)) * 0.28;
      const c1 = Math.exp(-(d3 * d3)) * 0.22;
      r += w1 * 0.65 + w2 * 0.38;
      g += w1 * 0.18 + w2 * 0.10;
      b += c1 * 0.48;
      const i = (y * EW + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 1;
    }
  }
  const eqTex = new THREE.DataTexture(data, EW, EH, THREE.RGBAFormat, THREE.FloatType);
  eqTex.mapping = THREE.EquirectangularReflectionMapping;
  eqTex.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(gl);
  pmrem.compileEquirectangularShader();
  const rt = pmrem.fromEquirectangular(eqTex);
  pmrem.dispose();
  eqTex.dispose();
  return rt;
}

// ── TV-static screen shader (unchanged from N5) ───────────────────────────────
const SCREEN_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SCREEN_FRAG = /* glsl */`
  uniform float uTime;
  uniform float uReveal;
  uniform float uAudio;
  uniform float uMode;
  varying vec2 vUv;

  float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    float t = floor(uTime * 14.0);
    if (uMode < 0.5) {
      float n  = hash21(vUv + vec2(t * 0.0127, t * 0.0073));
      float n2 = hash21(vUv * 1.7 + vec2(t * 0.031, -t * 0.019));
      float nn = n * 0.65 + n2 * 0.35;
      float scan = 0.78 + 0.22 * sin(vUv.y * 260.0);
      float roll = smoothstep(0.0, 0.04, fract(vUv.y - uTime * 0.07));
      vec3  col  = vec3(nn * 0.85 + 0.05) * scan * (0.85 + roll * 0.15);
      col = col * vec3(1.10, 0.88, 0.52);
      float vig = 1.0 - 0.35 * length(vUv * 2.0 - 1.0);
      col *= vig;
      gl_FragColor = vec4(col, uReveal * 0.92);
    } else {
      vec2 uv = vUv * 2.0 - 1.0;
      float bars = floor(vUv.x * 8.0);
      float barH = hash21(vec2(bars, 0.5)) * 0.4 + 0.3 + uAudio * 0.5;
      float inBar = step(vUv.y, barH);
      vec3 col = vec3(1.0, 0.58, 0.06) * inBar * (0.5 + uAudio * 0.5);
      float scan = 0.75 + 0.25 * sin(vUv.y * 260.0);
      col *= scan;
      float glow = exp(-length(uv) * 2.0) * uAudio * 0.4;
      col += vec3(1.0, 0.72, 0.18) * glow;
      float vig = 1.0 - 0.30 * length(uv);
      col *= vig;
      gl_FragColor = vec4(col, uReveal * 0.88);
    }
  }
`;

export default function Monoliths() {
  const { camera, gl, scene } = useThree();

  const leftBodyRef    = useRef<THREE.Mesh>(null);
  const rightBodyRef   = useRef<THREE.Mesh>(null);
  const leftScreenRef  = useRef<THREE.Mesh>(null);
  const rightScreenRef = useRef<THREE.Mesh>(null);
  const leftLightRef   = useRef<THREE.SpotLight>(null);
  const rightLightRef  = useRef<THREE.SpotLight>(null);
  const leftGlowRef    = useRef<THREE.Mesh>(null);
  const rightGlowRef   = useRef<THREE.Mesh>(null);

  // V2: warm/cold point light refs
  const lWA1 = useRef<THREE.PointLight>(null);
  const lWA2 = useRef<THREE.PointLight>(null);
  const lWC  = useRef<THREE.PointLight>(null);
  const rWA1 = useRef<THREE.PointLight>(null);
  const rWA2 = useRef<THREE.PointLight>(null);
  const rWC  = useRef<THREE.PointLight>(null);

  const activeRef  = useRef(true);
  const opacityRef = useRef(0);

  // V2: envMap lifecycle
  const envRtRef      = useRef<THREE.WebGLRenderTarget | null>(null);
  const captureEnvRef = useRef(false);

  const leftBodyGeom  = useMemo(() => buildObsidianGeom(7),  []);
  const rightBodyGeom = useMemo(() => buildObsidianGeom(13), []);

  // V2: MeshPhysicalMaterial
  const leftBodyMat = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: "#050407", metalness: 0, roughness: 0.08, clearcoat: 1.0,
      clearcoatRoughness: 0.04, ior: 1.5, specularIntensity: 1.0,
      envMapIntensity: DBG_SILLAS.monolithEnvIntensity, vertexColors: true, fog: false,
    });
    addObsidianShader(mat);
    return mat;
  }, []);

  const rightBodyMat = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: "#050407", metalness: 0, roughness: 0.08, clearcoat: 1.0,
      clearcoatRoughness: 0.04, ior: 1.5, specularIntensity: 1.0,
      envMapIntensity: DBG_SILLAS.monolithEnvIntensity, vertexColors: true, fog: false,
    });
    addObsidianShader(mat);
    return mat;
  }, []);

  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0x7FEFE6, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }), []);

  const leftTarget  = useMemo(() => new THREE.Object3D(), []);
  const rightTarget = useMemo(() => new THREE.Object3D(), []);

  // Screen uniforms — stable object refs for R3F shaderMaterial; .value mutated in useFrame.
  const leftUniforms  = useMemo(() => ({ uTime: { value: 0 }, uReveal: { value: 0 }, uAudio: { value: 0 }, uMode: { value: 0 } }), []);
  const rightUniforms = useMemo(() => ({ uTime: { value: 0 }, uReveal: { value: 0 }, uAudio: { value: 0 }, uMode: { value: 1 } }), []);

  useEffect(() => {
    const dist = DBG_SILLAS.monolithDistM;
    leftTarget.position.set(-dist, 0, 0);
    rightTarget.position.set(dist, 0, 0);
    leftTarget.updateMatrixWorld();
    rightTarget.updateMatrixWorld();
  }, [leftTarget, rightTarget]);

  useEffect(() => {
    const onOff = () => { activeRef.current = false; };
    window.addEventListener("alight:visualizer-deactivate", onOff);
    return () => {
      window.removeEventListener("alight:visualizer-deactivate", onOff);
      setMonolithProximity(0, 0);
    };
  }, []);

  // V2: build pre-dawn envMap once on mount and attach to materials.
  useEffect(() => {
    const rt = buildProceduralEnv(gl);
    envRtRef.current = rt;
    leftBodyMat.envMap = rt.texture;
    leftBodyMat.needsUpdate = true;
    rightBodyMat.envMap = rt.texture;
    rightBodyMat.needsUpdate = true;
    return () => {
      envRtRef.current?.dispose();
      envRtRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]); // leftBodyMat/rightBodyMat are stable useMemo — not in deps to avoid immutability rule

  useEffect(() => {
    const onDawn = () => { captureEnvRef.current = true; };
    window.addEventListener("alight:dawn-complete", onDawn);
    return () => window.removeEventListener("alight:dawn-complete", onDawn);
  }, []);

  useFrame(({ clock }, dt) => {
    // V2: dawn envMap capture (fires once after alight:dawn-complete)
    if (captureEnvRef.current) {
      captureEnvRef.current = false;
      const cubeRT  = new THREE.WebGLCubeRenderTarget(128);
      const cubeCam = new THREE.CubeCamera(0.1, 200, cubeRT);
      cubeCam.position.set(0, H / 2, 0);
      scene.add(cubeCam);
      cubeCam.update(gl, scene);
      scene.remove(cubeCam);
      const pmrem = new THREE.PMREMGenerator(gl);
      const newRT = pmrem.fromCubemap(cubeRT.texture);
      pmrem.dispose();
      cubeRT.dispose();
      const prev = envRtRef.current;
      envRtRef.current = newRT;
      leftBodyMat.envMap = newRT.texture;
      leftBodyMat.needsUpdate = true;
      rightBodyMat.envMap = newRT.texture;
      rightBodyMat.needsUpdate = true;
      if (prev) prev.dispose();
    }

    const t = clock.elapsedTime;

    const target = (activeRef.current || DBG_SILLAS.monolithForceShow) ? 1 : 0;
    const speed  = 1000 / DBG_SILLAS.monolithFadeMs;
    opacityRef.current = THREE.MathUtils.clamp(
      opacityRef.current + (target - opacityRef.current) * Math.min(1, dt * speed),
      0, 1,
    );
    const op = opacityRef.current;

    const setOp = (mesh: THREE.Mesh | null, mat: THREE.Material, o: number) => {
      if (!mesh) return;
      (mat as THREE.MeshPhysicalMaterial).opacity = o;
      mat.transparent = o < 0.999;
    };
    setOp(leftBodyRef.current,  leftBodyMat,  op);
    setOp(rightBodyRef.current, rightBodyMat, op);

    // V2: update obsidian shader uniforms (live debug)
    const updateObs = (mat: THREE.MeshPhysicalMaterial) => {
      const s = mat.userData.shader;
      if (!s) return;
      s.uniforms.uObsVeinBright.value    = DBG_SILLAS.monolithVeinBright;
      s.uniforms.uObsRimIntensity.value  = DBG_SILLAS.monolithRimV2Intensity;
      s.uniforms.uObsDesaturation.value  = DBG_SILLAS.monolithDesaturation;
      mat.envMapIntensity                = DBG_SILLAS.monolithEnvIntensity;
    };
    updateObs(leftBodyMat);
    updateObs(rightBodyMat);

    if (leftLightRef.current)  leftLightRef.current.intensity  = op * DBG_SILLAS.monolithLightIntensity;
    if (rightLightRef.current) rightLightRef.current.intensity = op * DBG_SILLAS.monolithLightIntensity;

    const wI = op * DBG_SILLAS.monolithWarmLightI;
    const cI = op * DBG_SILLAS.monolithColdLightI;
    if (lWA1.current) lWA1.current.intensity = wI;
    if (lWA2.current) lWA2.current.intensity = wI * 0.6;
    if (lWC.current)  lWC.current.intensity  = cI;
    if (rWA1.current) rWA1.current.intensity = wI;
    if (rWA2.current) rWA2.current.intensity = wI * 0.6;
    if (rWC.current)  rWC.current.intensity  = cI;

    const gop = op * DBG_SILLAS.monolithGlowOpacity;
    if (leftGlowRef.current)  (leftGlowRef.current.material as THREE.MeshBasicMaterial).opacity  = gop;
    if (rightGlowRef.current) (rightGlowRef.current.material as THREE.MeshBasicMaterial).opacity = gop;

    leftUniforms.uTime.value   = t;
    leftUniforms.uReveal.value = op;
    rightUniforms.uTime.value   = t;
    rightUniforms.uReveal.value = op;

    if (!activeRef.current && !DBG_SILLAS.monolithForceShow && op < 0.001) {
      setMonolithProximity(0, 0);
      return;
    }

    const dist = DBG_SILLAS.monolithDistM;
    const cx   = camera.position.x;
    const cz   = camera.position.z;
    const dL   = Math.sqrt((cx + dist) ** 2 + cz * cz);
    const dR   = Math.sqrt((cx - dist) ** 2 + cz * cz);

    const start = DBG_SILLAS.monolithProxStartM;
    const full  = DBG_SILLAS.monolithProxFullM;
    const proxL = THREE.MathUtils.clamp((start - dL) / (start - full), 0, 1);
    const proxR = THREE.MathUtils.clamp((start - dR) / (start - full), 0, 1);

    setMonolithProximity(proxL * op, proxR * op);
    rightUniforms.uAudio.value = proxR * 0.6;
  });

  const dist   = DBG_SILLAS.monolithDistM;
  const cy     = H / 2;
  const lightY = H + 2;

  const plateTex = useMemo(() => {
    if (!R5_MONOLITH_RETRO) return null;
    try { return createBasePlateTex("AUSTRAL ELECTRIC / KX-07M", "UNIT-07", 512, 64); }
    catch { return null; }
  }, []);

  const plateMat = useMemo(() => {
    if (!plateTex) return null;
    return new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.8, metalness: 0.05 });
  }, [plateTex]);

  return (
    <>
      <primitive object={leftTarget} />
      <primitive object={rightTarget} />

      {/* S1: dedicated SpotLights */}
      <spotLight ref={leftLightRef}  position={[-dist, lightY, 0]} target={leftTarget}  intensity={0} color="#9fe6ff" angle={0.32} penumbra={0.6} castShadow={false} />
      <spotLight ref={rightLightRef} position={[ dist, lightY, 0]} target={rightTarget} intensity={0} color="#9fe6ff" angle={0.32} penumbra={0.6} castShadow={false} />

      {/* V2: warm + cold point lights per monolith */}
      <pointLight ref={lWA1} position={[-dist + 1.1, 2.4, -0.4]} color="#FF9A1F" intensity={0} distance={7} decay={2} castShadow={false} />
      <pointLight ref={lWA2} position={[-dist + 1.0, 0.7, -0.3]} color="#FF9A1F" intensity={0} distance={5} decay={2} castShadow={false} />
      <pointLight ref={lWC}  position={[-dist - 0.4, 1.8,  0.5]} color="#4A90E2" intensity={0} distance={6} decay={2} castShadow={false} />
      <pointLight ref={rWA1} position={[ dist - 1.1, 2.4, -0.4]} color="#FF9A1F" intensity={0} distance={7} decay={2} castShadow={false} />
      <pointLight ref={rWA2} position={[ dist - 1.0, 0.7, -0.3]} color="#FF9A1F" intensity={0} distance={5} decay={2} castShadow={false} />
      <pointLight ref={rWC}  position={[ dist + 0.4, 1.8,  0.5]} color="#4A90E2" intensity={0} distance={6} decay={2} castShadow={false} />

      {/* Left monolith — image channel */}
      <mesh ref={leftBodyRef} position={[-dist, cy, 0]}>
        <primitive object={leftBodyGeom} attach="geometry" />
        <primitive object={leftBodyMat}  attach="material" />
      </mesh>
      {R5_MONOLITH_RETRO && plateMat && (
        <mesh position={[-dist, PLATE_H / 2, -(D / 2) + 0.001]}>
          <boxGeometry args={[PLATE_W, PLATE_H, PLATE_D]} />
          <primitive object={plateMat} attach="material" />
        </mesh>
      )}
      <mesh ref={leftScreenRef} position={[-dist, cy, -(D / 2) - 0.002]}>
        <planeGeometry args={[W * 0.84, H * 0.72]} />
        <shaderMaterial uniforms={leftUniforms} vertexShader={SCREEN_VERT} fragmentShader={SCREEN_FRAG} transparent depthWrite={false} side={THREE.FrontSide} />
      </mesh>
      <mesh ref={leftGlowRef} position={[-dist, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.2, 32]} />
        <primitive object={glowMat} attach="material" />
      </mesh>

      {/* Right monolith — sound channel */}
      <mesh ref={rightBodyRef} position={[dist, cy, 0]}>
        <primitive object={rightBodyGeom} attach="geometry" />
        <primitive object={rightBodyMat}  attach="material" />
      </mesh>
      {R5_MONOLITH_RETRO && plateMat && (
        <mesh position={[dist, PLATE_H / 2, -(D / 2) + 0.001]}>
          <boxGeometry args={[PLATE_W, PLATE_H, PLATE_D]} />
          <primitive object={plateMat} attach="material" />
        </mesh>
      )}
      <mesh ref={rightScreenRef} position={[dist, cy, -(D / 2) - 0.002]}>
        <planeGeometry args={[W * 0.84, H * 0.72]} />
        <shaderMaterial uniforms={rightUniforms} vertexShader={SCREEN_VERT} fragmentShader={SCREEN_FRAG} transparent depthWrite={false} side={THREE.FrontSide} />
      </mesh>
      <mesh ref={rightGlowRef} position={[dist, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.2, 32]} />
        <primitive object={glowMat} attach="material" />
      </mesh>
    </>
  );
}
