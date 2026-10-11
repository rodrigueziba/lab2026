"use client";

import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PRISM_POS_UNIFORM, PRISM_RAINBOW_UNIFORM, PRISM_ROT_UNIFORM } from "@/lib/prismUniforms";
import { TARIMA_H } from "./Tarima";
import { INTERACT_STATE } from "@/lib/alightStore";
import { DBG_PRISM } from "@/lib/debugConfig";

const PRISM_Y_START   = 22;
const PRISM_CONE_HALF = 0.9;
// C3: prism hovers 5% of cone height above tarima surface instead of touching it
const PRISM_LAND_OFFSET = PRISM_CONE_HALF * 0.05;  // 0.09 m hover gap
const PRISM_Y_END     = TARIMA_H + PRISM_CONE_HALF + PRISM_LAND_OFFSET;
const DESCEND_DUR     = 5.5;  // seconds, cubic ease-out
const ROTATE_SPEED    = 0.004; // rad / frame

// S3: export so ThreeScene can compute touch distance
export const PRISM_CENTER_Y = PRISM_Y_END;
export const PRISM_SURF_R   = PRISM_CONE_HALF; // bounding radius

const GLASS_MAT = new THREE.MeshPhysicalMaterial({
  color:             new THREE.Color("#cce4ff"),
  emissive:          new THREE.Color("#0a1a3a"),
  emissiveIntensity: 0.35,
  transmission:      0.92,
  roughness:         0.01,
  thickness:         2.5,
  ior:               1.60,
  metalness:         0,
  side:              THREE.DoubleSide,
  transparent:       true,
  opacity:           1.0,
});

const GLOW_MAT = new THREE.MeshBasicMaterial({
  color:       new THREE.Color("#4488cc"),
  transparent: true,
  opacity:     0.07,
  side:        THREE.BackSide,
  depthWrite:  false,
});

// ── S2: proximity fractal overlay shader ─────────────────────────────────────
const PROX_VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv       = uv;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PROX_FRAG = /* glsl */`
  uniform float uProximity;
  uniform float uTime;
  varying vec2  vUv;

  vec3 hsl2rgb(float h, float s, float l) {
    vec3 p = abs(fract(h + vec3(1.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
    return l + s * (clamp(p - 1.0, 0.0, 1.0) - 0.5) * (1.0 - abs(2.0*l - 1.0));
  }

  void main() {
    float p = uProximity;
    if (p < 0.001) { gl_FragColor = vec4(0.0); return; }

    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= 1.4;

    float speed = 0.3 + p * 2.0;
    vec2 c = vec2(
      -0.7269 + sin(uTime * speed * 0.13) * 0.28 * p,
       0.1889 + cos(uTime * speed * 0.09) * 0.20 * p
    );
    vec2 z = uv;
    float trap = 1e5;
    for (int i = 0; i < 48; i++) {
      z     = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
      trap  = min(trap, length(z));
      if (length(z) > 4.0) break;
    }

    float hue    = fract(1.0 - exp(-trap * 2.0) + uTime * speed * 0.04);
    vec3  col    = hsl2rgb(hue, 0.85, 0.55);
    float bright = (1.0 - exp(-trap * 1.5)) * (1.0 + p * 2.5);
    col *= bright;

    float alpha  = p * 0.80 * clamp(bright * 0.5, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

export default function Prism() {
  const groupRef    = useRef<THREE.Group>(null!);
  const proxRef     = useRef<THREE.ShaderMaterial>(null!);
  const active      = useRef(false);
  const needStart   = useRef(false);
  const startClock  = useRef(0);
  const landedRef   = useRef(false);
  // S2: time-tracking for translucency ramp-up
  const nearSince   = useRef<number | null>(null);

  const proxUniforms = useMemo(() => ({
    uProximity: { value: 0.0 },
    uTime:      { value: 0.0 },
  }), []);

  useEffect(() => {
    const handler = () => {
      active.current    = true;
      needStart.current = true;
      landedRef.current = false;
      nearSince.current = null;
    };
    window.addEventListener("activar-prisma", handler);
    return () => window.removeEventListener("activar-prisma", handler);
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current || !active.current) return;

    if (needStart.current) {
      startClock.current = clock.elapsedTime;
      needStart.current  = false;
    }

    const elapsed = clock.elapsedTime - startClock.current;
    const prog    = Math.min(1, elapsed / DESCEND_DUR);
    const ease    = 1 - Math.pow(1 - prog, 3);

    const y = THREE.MathUtils.lerp(PRISM_Y_START, PRISM_Y_END, ease);
    groupRef.current.position.y = y;

    // ── S1: inverted spin ────────────────────────────────────────────────────
    const pp       = INTERACT_STATE.playerPos;
    const px       = pp.x - groupRef.current.position.x;
    const pz       = pp.z - groupRef.current.position.z;
    const py       = pp.y - groupRef.current.position.y;
    const dist     = Math.sqrt(px*px + py*py + pz*pz);

    // S2: proximity (0=far, 1=at maxEffectM)
    const nearM  = DBG_PRISM.nearM;
    const maxEfM = DBG_PRISM.maxEffectM;
    const proximity = landedRef.current
      ? Math.max(0, Math.min(1, (nearM - Math.max(maxEfM, dist)) / (nearM - maxEfM)))
      : 0;

    const spinMult = 1 + proximity * proximity * DBG_PRISM.spinAccel;
    groupRef.current.rotation.y += ROTATE_SPEED * DBG_PRISM.spinDir * spinMult;

    PRISM_POS_UNIFORM.value.set(0, y, 0);
    PRISM_ROT_UNIFORM.value = groupRef.current.rotation.y;

    // C6: dispatch prism-landed once, exactly when descent completes
    if (prog >= 1 && !landedRef.current) {
      landedRef.current = true;
      window.dispatchEvent(new CustomEvent("alight:prism-landed"));
    }

    // C6: rainbow beams only activate after the prism has fully landed
    const rainbowTarget = landedRef.current ? 1 : 0;
    PRISM_RAINBOW_UNIFORM.value = THREE.MathUtils.lerp(
      PRISM_RAINBOW_UNIFORM.value,
      rainbowTarget,
      0.015,
    );

    // ── S2: proximity effects ────────────────────────────────────────────────
    if (proxRef.current) {
      proxRef.current.uniforms.uProximity.value = THREE.MathUtils.lerp(
        proxRef.current.uniforms.uProximity.value,
        proximity,
        0.04,
      );
      proxRef.current.uniforms.uTime.value = clock.elapsedTime;
    }

    // Glass translucency ramp (PRISM_TRANSLUCENT_MS)
    if (dist < nearM && landedRef.current) {
      if (nearSince.current === null) nearSince.current = performance.now();
      const frac   = Math.min(1, (performance.now() - nearSince.current) / DBG_PRISM.translucentMs);
      GLASS_MAT.opacity = 1.0 - frac * (1.0 - DBG_PRISM.translucentOpacity);
    } else {
      nearSince.current = null;
      GLASS_MAT.opacity = THREE.MathUtils.lerp(GLASS_MAT.opacity, 1.0, 0.02);
    }

    // Glow brightens at CLOSE distance
    if (dist < DBG_PRISM.closeM && landedRef.current) {
      const gp = Math.min(1, (DBG_PRISM.closeM - dist) / DBG_PRISM.closeM);
      GLOW_MAT.opacity = THREE.MathUtils.lerp(GLOW_MAT.opacity, 0.07 + gp * 0.35, 0.05);
    } else {
      GLOW_MAT.opacity = THREE.MathUtils.lerp(GLOW_MAT.opacity, 0.07, 0.03);
    }
  });

  return (
    <group ref={groupRef} position={[0, PRISM_Y_START, 0]}>
      <mesh castShadow receiveShadow>
        <coneGeometry args={[1.0, 1.8, 3, 1]} />
        <primitive object={GLASS_MAT} attach="material" />
      </mesh>
      {/* S2: fractal proximity overlay */}
      <mesh>
        <coneGeometry args={[1.01, 1.81, 3, 1]} />
        <shaderMaterial
          ref={proxRef}
          vertexShader={PROX_VERT}
          fragmentShader={PROX_FRAG}
          uniforms={proxUniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh>
        <coneGeometry args={[1.18, 1.88, 3, 1]} />
        <primitive object={GLOW_MAT} attach="material" />
      </mesh>
    </group>
  );
}
