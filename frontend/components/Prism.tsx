"use client";

import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PRISM_POS_UNIFORM, PRISM_RAINBOW_UNIFORM, PRISM_ROT_UNIFORM } from "@/lib/prismUniforms";

const PRISM_Y_START = 22;
const PRISM_Y_END   =  2.5;
const DESCEND_DUR   =  5.5;  // seconds, cubic ease-out
const ROTATE_SPEED  =  0.004; // rad / frame

// Module-level glass material — created once, shared across re-renders
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
});

// Subtle inner glow halo (additive, BackSide, very faint)
const GLOW_MAT = new THREE.MeshBasicMaterial({
  color:       new THREE.Color("#4488cc"),
  transparent: true,
  opacity:     0.07,
  side:        THREE.BackSide,
  depthWrite:  false,
});

export default function Prism() {
  const groupRef   = useRef<THREE.Group>(null!);
  const active     = useRef(false);
  const needStart  = useRef(false);
  const startClock = useRef(0);

  useEffect(() => {
    const handler = () => { active.current = true; needStart.current = true; };
    window.addEventListener("activar-prisma", handler);
    return () => window.removeEventListener("activar-prisma", handler);
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current || !active.current) return;

    // Record the clock time on the first frame after activation
    if (needStart.current) {
      startClock.current = clock.elapsedTime;
      needStart.current  = false;
    }

    const elapsed = clock.elapsedTime - startClock.current;
    const prog    = Math.min(1, elapsed / DESCEND_DUR);
    const ease    = 1 - Math.pow(1 - prog, 3); // cubic ease-out

    const y = THREE.MathUtils.lerp(PRISM_Y_START, PRISM_Y_END, ease);
    groupRef.current.position.y = y;
    groupRef.current.rotation.y += ROTATE_SPEED;

    // Update shared uniforms — ExperienceDome reads these every render
    PRISM_POS_UNIFORM.value.set(0, y, 0);
    PRISM_ROT_UNIFORM.value  = groupRef.current.rotation.y;
    PRISM_RAINBOW_UNIFORM.value = THREE.MathUtils.lerp(
      PRISM_RAINBOW_UNIFORM.value,
      ease,
      0.025,
    );
  });

  return (
    <group ref={groupRef} position={[0, PRISM_Y_START, 0]}>
      {/* Pyramid body — ConeGeometry with 3 sides = triangular pyramid.
          No rotation: apex points upward, base on the floor side, like the
          Pink Floyd prism reference. Proportions kept roughly 1:1 (wide base,
          moderate height) so it doesn't look like a spike. */}
      <mesh castShadow receiveShadow>
        <coneGeometry args={[1.0, 1.8, 3, 1]} />
        <primitive object={GLASS_MAT} attach="material" />
      </mesh>

      {/* Slightly oversized glow shell */}
      <mesh>
        <coneGeometry args={[1.18, 1.88, 3, 1]} />
        <primitive object={GLOW_MAT} attach="material" />
      </mesh>
    </group>
  );
}
