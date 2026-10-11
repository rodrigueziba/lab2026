"use client";

import * as THREE from "three";

const CAM_Y = 1.6;
// Height = camera Y / 6. Exported so Prism.tsx can calculate landing Y.
export const TARIMA_H = CAM_Y / 6;          // ≈ 0.267 m

// C2: reduce W and D by 20% while keeping height unchanged.
// G1: reduce by additional 5% over previous 0.8 value
const TARIMA_SCALE_XZ = 0.8 * 0.95;         // 0.76
const TARIMA_W = 4.2 * TARIMA_SCALE_XZ;     // 3.192 m
const TARIMA_D = 4.2 * TARIMA_SCALE_XZ;     // 3.192 m

const TARIMA_MAT = new THREE.MeshStandardMaterial({
  color: "#100b07", roughness: 0.88, metalness: 0.0,
});

export default function Tarima() {
  return (
    <mesh position={[0, TARIMA_H / 2, 0]} receiveShadow castShadow>
      <boxGeometry args={[TARIMA_W, TARIMA_H, TARIMA_D]} />
      <primitive object={TARIMA_MAT} attach="material" />
    </mesh>
  );
}
