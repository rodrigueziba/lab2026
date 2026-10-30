"use client";
// N5: Two black matte monoliths flanking the tarima path.
// Appear on alight:visualizer-activate. Left = image channel, Right = sound channel.
// Proximity to each monolith drives left → uRemoteMix/uStaticMix (dome), right → audio crossfade.
// Sizes and distances in DBG_SILLAS (N5 block).

import { useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_SILLAS } from "@/lib/debugConfig";
import { setMonolithProximity } from "@/lib/vizAudio";

// ── Geometry constants ────────────────────────────────────────────────────────
const W = 0.9;   // width  (m)
const H = 3.2;   // height (m)
const D = 0.35;  // depth  (m)

// ── TV-static screen shader ───────────────────────────────────────────────────
const SCREEN_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// CRT static: animated noise with scanlines + amber phosphor tint
const SCREEN_FRAG = /* glsl */`
  uniform float uTime;
  uniform float uReveal;
  uniform float uAudio;   // 0–1 audio energy (right monolith only)
  uniform float uMode;    // 0 = static (left), 1 = audio bars (right)
  varying vec2 vUv;

  float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    float t = floor(uTime * 14.0);

    if (uMode < 0.5) {
      // ── Left screen: TV static with scanlines ────────────────────────────
      float n  = hash21(vUv + vec2(t * 0.0127, t * 0.0073));
      float n2 = hash21(vUv * 1.7 + vec2(t * 0.031, -t * 0.019));
      float nn = n * 0.65 + n2 * 0.35;
      // horizontal scanlines
      float scan = 0.78 + 0.22 * sin(vUv.y * 260.0);
      // faint vertical roll
      float roll = smoothstep(0.0, 0.04, fract(vUv.y - uTime * 0.07));
      vec3  col  = vec3(nn * 0.85 + 0.05) * scan * (0.85 + roll * 0.15);
      // amber CRT phosphor tint
      col = col * vec3(1.10, 0.88, 0.52);
      // slight vignette
      float vig = 1.0 - 0.35 * length(vUv * 2.0 - 1.0);
      col *= vig;
      gl_FragColor = vec4(col, uReveal * 0.92);

    } else {
      // ── Right screen: audio-reactive amber glow ───────────────────────────
      vec2 uv = vUv * 2.0 - 1.0;
      // vertical bars
      float bars = floor(vUv.x * 8.0);
      float barH = hash21(vec2(bars, 0.5)) * 0.4 + 0.3 + uAudio * 0.5;
      float inBar = step(vUv.y, barH);
      // amber base
      vec3 col = vec3(1.0, 0.58, 0.06) * inBar * (0.5 + uAudio * 0.5);
      // scanlines
      float scan = 0.75 + 0.25 * sin(vUv.y * 260.0);
      col *= scan;
      // glow center
      float glow = exp(-length(uv) * 2.0) * uAudio * 0.4;
      col += vec3(1.0, 0.72, 0.18) * glow;
      float vig = 1.0 - 0.30 * length(uv);
      col *= vig;
      gl_FragColor = vec4(col, uReveal * 0.88);
    }
  }
`;

// (no per-frame allocations in useFrame — proximity via inline math)

export default function Monoliths() {
  const { camera } = useThree();

  const leftBodyRef    = useRef<THREE.Mesh>(null);
  const rightBodyRef   = useRef<THREE.Mesh>(null);
  const leftScreenRef  = useRef<THREE.Mesh>(null);
  const rightScreenRef = useRef<THREE.Mesh>(null);

  const activeRef  = useRef(false);
  const opacityRef = useRef(0);

  // useMemo uniforms — same pattern as SymbolSystem / DomeVisualizer loginUniforms
  const leftUniforms  = useMemo(() => ({ uTime: { value: 0 }, uReveal: { value: 0 }, uAudio: { value: 0 }, uMode: { value: 0 } }), []);
  const rightUniforms = useMemo(() => ({ uTime: { value: 0 }, uReveal: { value: 0 }, uAudio: { value: 0 }, uMode: { value: 1 } }), []);

  // Listen for visualizer-activate / deactivate
  useEffect(() => {
    const onOn  = () => { activeRef.current = true; };
    const onOff = () => { activeRef.current = false; };
    window.addEventListener("alight:visualizer-activate",   onOn);
    window.addEventListener("alight:visualizer-deactivate", onOff);
    return () => {
      window.removeEventListener("alight:visualizer-activate",   onOn);
      window.removeEventListener("alight:visualizer-deactivate", onOff);
      setMonolithProximity(0, 0);
    };
  }, []);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;

    // Fade opacity in/out
    const target = activeRef.current ? 1 : 0;
    const speed  = 1000 / DBG_SILLAS.monolithFadeMs;
    opacityRef.current = THREE.MathUtils.clamp(
      opacityRef.current + (target - opacityRef.current) * Math.min(1, dt * speed),
      0, 1,
    );
    const op = opacityRef.current;

    // Body opacity
    const setOp = (mesh: THREE.Mesh | null, o: number) => {
      if (!mesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = o;
      mat.transparent = o < 0.999;
    };
    setOp(leftBodyRef.current,  op);
    setOp(rightBodyRef.current, op);

    leftUniforms.uTime.value   = t;
    leftUniforms.uReveal.value = op;
    rightUniforms.uTime.value   = t;
    rightUniforms.uReveal.value = op;

    if (!activeRef.current && op < 0.001) {
      setMonolithProximity(0, 0);
      return;
    }

    // Proximity calculation — no allocations
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

  const dist = DBG_SILLAS.monolithDistM;
  const cy   = H / 2;

  return (
    <>
      {/* Left monolith — image channel */}
      <mesh ref={leftBodyRef} position={[-dist, cy, 0]}>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color="#050505" roughness={0.95} metalness={0.05} />
      </mesh>
      {/* Left screen — TV static facing −Z (toward chairs) */}
      <mesh ref={leftScreenRef} position={[-dist, cy, -(D / 2) - 0.002]} rotation={[0, 0, 0]}>
        <planeGeometry args={[W * 0.84, H * 0.72]} />
        <shaderMaterial
          uniforms={leftUniforms}
          vertexShader={SCREEN_VERT}
          fragmentShader={SCREEN_FRAG}
          transparent
          depthWrite={false}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Right monolith — sound channel */}
      <mesh ref={rightBodyRef} position={[dist, cy, 0]}>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color="#050505" roughness={0.95} metalness={0.05} />
      </mesh>
      {/* Right screen — audio-reactive glow */}
      <mesh ref={rightScreenRef} position={[dist, cy, -(D / 2) - 0.002]} rotation={[0, 0, 0]}>
        <planeGeometry args={[W * 0.84, H * 0.72]} />
        <shaderMaterial
          uniforms={rightUniforms}
          vertexShader={SCREEN_VERT}
          fragmentShader={SCREEN_FRAG}
          transparent
          depthWrite={false}
          side={THREE.FrontSide}
        />
      </mesh>
    </>
  );
}
