"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createWornPaintTex, createStripeBandTex } from "@/lib/retro/decals";

const CAM_Y = 1.6;
// Height = camera Y / 6. Exported so Prism.tsx can calculate landing Y.
export const TARIMA_H = CAM_Y / 6;          // ≈ 0.267 m

// C2: reduce W and D by 20% while keeping height unchanged.
// G1: reduce by additional 5% over previous 0.8 value
const TARIMA_SCALE_XZ = 0.8 * 0.95;         // 0.76
export const TARIMA_W = 4.2 * TARIMA_SCALE_XZ;     // 3.192 m (Z29: exportado para "tocar la tarima")
export const TARIMA_D = 4.2 * TARIMA_SCALE_XZ;     // 3.192 m

// R5: flag to disable retro styling (set false to revert to TARIMA_MAT_LEGACY)
const R5_TARIMA_RETRO = true;

// ── R5: legacy fallback material (kept for rollback) ─────────────────────────
const TARIMA_MAT_LEGACY = new THREE.MeshStandardMaterial({
  color: "#100b07", roughness: 0.88, metalness: 0.0,
});

// ── R5: module-level shared resources (created once on first render) ──────────
let _tarimaTex: THREE.CanvasTexture | null = null;
let _stripeTex:  THREE.CanvasTexture | null = null;
let _tarimaMat:  THREE.MeshStandardMaterial | null = null;
let _stripeMat:  THREE.MeshBasicMaterial   | null = null;

function getSharedTex() {
  if (!_tarimaTex) {
    _tarimaTex = createWornPaintTex("#C0552F", ["PRISM STAGE", "UNIT-01"]);
    _tarimaMat = new THREE.MeshStandardMaterial({
      map: _tarimaTex, roughness: 0.88, metalness: 0.0,
    });
  }
  if (!_stripeTex) {
    _stripeTex = createStripeBandTex(undefined, 512, 64);
    _stripeMat = new THREE.MeshBasicMaterial({
      map: _stripeTex, transparent: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
  }
  return { mat: _tarimaMat!, stripe: _stripeMat! };
}

// ── R5: hex screw geometry (shared) ──────────────────────────────────────────
let _screwGeo: THREE.CylinderGeometry | null = null;
let _screwMat: THREE.MeshStandardMaterial | null = null;
function getScrewGeo() {
  if (!_screwGeo) {
    _screwGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.012, 6);
    _screwMat = new THREE.MeshStandardMaterial({ color: "#555450", roughness: 0.6, metalness: 0.55 });
  }
  return { geo: _screwGeo!, mat: _screwMat! };
}

export default function Tarima() {
  const { scene } = useThree();
  const addedRef = useRef(false);

  useEffect(() => {
    if (!R5_TARIMA_RETRO || addedRef.current) return;
    addedRef.current = true;

    const { stripe } = getSharedTex();
    const { geo: screwGeo, mat: screwMat } = getScrewGeo();

    // Diagonal stripe band on front face (−Z side)
    const stripeW  = TARIMA_W;
    const stripeH  = 0.040;   // 4 cm tall band
    const stripePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(stripeW, stripeH),
      stripe,
    );
    // Position just in front of tarima front face, at half-height of band from floor
    stripePlane.position.set(0, stripeH / 2 + 0.001, -(TARIMA_D / 2) - 0.001);
    scene.add(stripePlane);

    // 4 hex screws at top-face corners
    const screwPositions: [number, number][] = [
      [-(TARIMA_W / 2 - 0.07),  -(TARIMA_D / 2 - 0.07)],
      [ (TARIMA_W / 2 - 0.07),  -(TARIMA_D / 2 - 0.07)],
      [-(TARIMA_W / 2 - 0.07),   (TARIMA_D / 2 - 0.07)],
      [ (TARIMA_W / 2 - 0.07),   (TARIMA_D / 2 - 0.07)],
    ];
    const screwMeshes: THREE.Mesh[] = [];
    for (const [sx, sz] of screwPositions) {
      const screw = new THREE.Mesh(screwGeo, screwMat);
      screw.rotation.x = Math.PI / 2; // hex flat on top
      screw.position.set(sx, TARIMA_H + 0.007, sz);
      scene.add(screw);
      screwMeshes.push(screw);
    }

    return () => {
      scene.remove(stripePlane);
      (stripePlane.geometry as THREE.PlaneGeometry).dispose();
      screwMeshes.forEach(m => scene.remove(m));
    };
  }, [scene]);

  if (!R5_TARIMA_RETRO) {
    return (
      <mesh position={[0, TARIMA_H / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[TARIMA_W, TARIMA_H, TARIMA_D]} />
        <primitive object={TARIMA_MAT_LEGACY} attach="material" />
      </mesh>
    );
  }

  const { mat } = getSharedTex();
  return (
    <mesh position={[0, TARIMA_H / 2, 0]} receiveShadow castShadow>
      <boxGeometry args={[TARIMA_W, TARIMA_H, TARIMA_D]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}
