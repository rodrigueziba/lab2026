"use client";
// N3: Animated floor symbols — one disc per sector diagonal.
// Invisible until the player first steps under each beam (getHazEnteredOnce).
// Shapes: S0=two rings, S1=triangle outline, S2=7×7 dot grid, S3=three wavy rings.
// Plane geometry is 2×2 units; mesh.scale = symbolRadiusM so world radius = symbolRadiusM.
// uv in shader: vUv (0→1); centered uv = vUv*2−1 ranges [−1,1] = ±symbolRadiusM world.

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_SILLAS } from "@/lib/debugConfig";
import { getHazEnteredOnce, getHazPositionsXZ } from "@/lib/haz";
import { BAND_STATE } from "@/lib/vizAudio";

const SYMBOL_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SYMBOL_FRAG = /* glsl */`
  uniform float uType;
  uniform float uTime;
  uniform float uReveal;
  uniform float uLineWidth;
  uniform float uEnergy;
  uniform float uPeriodS;
  uniform vec3  uColor;
  varying vec2  vUv;

  void main() {
    vec2  uv    = vUv * 2.0 - 1.0;
    float t     = fract(uTime / uPeriodS);
    float pulse = pow(max(0.0, 1.0 - t), 1.5);
    float lw    = uLineWidth + uEnergy * 0.02;
    float alpha = 0.0;

    if (uType < 0.5) {
      // S0: two concentric rings
      float r  = length(uv);
      float d1 = abs(r - 0.50);
      float d2 = abs(r - 0.85);
      alpha = max(smoothstep(lw, 0.0, d1), smoothstep(lw, 0.0, d2));

    } else if (uType < 1.5) {
      // S1: equilateral triangle outline (Inigo Quilez SDF)
      const float k = 1.7320508; // sqrt(3)
      vec2 p = uv;
      p.x = abs(p.x) - 0.70;
      p.y = p.y + 0.70 / k;
      if (p.x + k * p.y > 0.0) p = vec2(p.x - k*p.y, -k*p.x - p.y) * 0.5;
      p.x -= clamp(p.x, -1.40, 0.0);
      float d = abs(length(p) * sign(p.y));
      alpha = smoothstep(lw * 2.0, 0.0, d);

    } else if (uType < 2.5) {
      // S2: 7×7 dot grid clipped to circle
      vec2  cell = fract(vUv * 7.0) - 0.5;
      float disc = step(length(uv), 0.92);
      alpha = smoothstep(0.25, 0.08, length(cell)) * disc;

    } else {
      // S3: three wavy rings
      float ang  = atan(uv.y, uv.x);
      float wave = sin(ang * 6.0 + uTime * 1.5) * 0.07;
      float r    = length(uv);
      float d1   = abs(r - (0.35 + wave));
      float d2   = abs(r - (0.60 + wave * 0.70));
      float d3   = abs(r - (0.85 + wave * 0.40));
      alpha = max(max(smoothstep(lw, 0.0, d1),
                      smoothstep(lw, 0.0, d2)),
                      smoothstep(lw, 0.0, d3));
    }

    alpha *= pulse * uReveal;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

const COLOR_KEYS = [
  "hazColor0", "hazColor1", "hazColor2", "hazColor3",
] as const;

export default function SymbolSystem() {
  // Four explicit refs — no hooks in loops
  const mesh0 = useRef<THREE.Mesh>(null);
  const mesh1 = useRef<THREE.Mesh>(null);
  const mesh2 = useRef<THREE.Mesh>(null);
  const mesh3 = useRef<THREE.Mesh>(null);
  const meshRefs = [mesh0, mesh1, mesh2, mesh3];

  const revealArr = useRef([0, 0, 0, 0]);
  // Pre-allocated Color objects — reused each frame
  const colorObjs = useRef([0, 1, 2, 3].map(i => new THREE.Color(DBG_SILLAS[COLOR_KEYS[i]])));

  // useMemo uniforms — mutated per-frame in useFrame (same pattern as loginUniforms in DomeVisualizer)
  const allUniforms = useMemo(() =>
    [0, 1, 2, 3].map(i => ({
      uType:      { value: i },
      uTime:      { value: 0 },
      uReveal:    { value: 0 },
      uLineWidth: { value: DBG_SILLAS.symbolLineWidthM },
      uEnergy:    { value: 0 },
      uPeriodS:   { value: DBG_SILLAS.symbolPeriodS },
      uColor:     { value: new THREE.Color(DBG_SILLAS[COLOR_KEYS[i]]) },
    }))
  , []);

  useFrame(({ clock }) => {
    const t         = clock.elapsedTime;
    const positions = getHazPositionsXZ();

    for (let i = 0; i < 4; i++) {
      const u = allUniforms[i];
      u.uTime.value      = t;
      u.uPeriodS.value   = DBG_SILLAS.symbolPeriodS;
      u.uLineWidth.value = DBG_SILLAS.symbolLineWidthM;
      // N4: energy from the band assigned to this symbol (pre-gate, always active)
      u.uEnergy.value    = BAND_STATE.energy[BAND_STATE.assignment[i]] ?? 0;

      colorObjs.current[i].set(DBG_SILLAS[COLOR_KEYS[i]]);
      u.uColor.value.copy(colorObjs.current[i]);

      if (getHazEnteredOnce(i) && revealArr.current[i] < 1) {
        revealArr.current[i] = Math.min(1, revealArr.current[i] + 0.02);
        u.uReveal.value      = revealArr.current[i];
      }

      const mesh = meshRefs[i].current;
      if (mesh) {
        const [bx, bz] = positions[i];
        mesh.position.set(bx, 0.02, bz);
        mesh.scale.setScalar(DBG_SILLAS.symbolRadiusM);
      }
    }
  });

  return (
    <>
      {[0, 1, 2, 3].map(i => (
        <mesh
          key={i}
          ref={meshRefs[i]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={1}
        >
          <planeGeometry args={[2, 2]} />
          <shaderMaterial
            uniforms={allUniforms[i]}
            vertexShader={SYMBOL_VERT}
            fragmentShader={SYMBOL_FRAG}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </>
  );
}
