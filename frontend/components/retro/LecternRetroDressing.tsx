"use client";

// J5: retro dressing for the TARIMA lecterns — fictional brand guard on the rear
// bar (seen from the lectern camera) and a branded front apron between the legs.
// Visibility follows DBG_RETRO.lecterns live (checked in useFrame).

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_RETRO } from "@/lib/debugConfig";
import { injectWear } from "@/lib/retro/wear";
import { LECTERN_BRANDS, createDecalTexture, createStripeStripTexture } from "@/lib/retro/brandDecal";

const STRIP_W = 0.90;
const APRON_W = 0.84;
const APRON_H = 0.24;
const APRON_T = 0.02;

function useWornMat(color: string, map?: THREE.Texture) {
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color, map: map ?? null, roughness: 0.8, metalness: 0 });
    injectWear(m, { under: "#6B6E70" });
    return m;
  }, [color, map]);
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

function useRetroVisible() {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => { if (ref.current) ref.current.visible = DBG_RETRO.lecterns; });
  return ref;
}

/** Mount inside the tilted plate group (origin = plate centre, y = plate mid-thickness). */
export function LecternRearStrip({
  side, faceZ, plateTopY, height,
}: { side: "left" | "right"; faceZ: number; plateTopY: number; height: number }) {
  const ref = useRetroVisible();
  const tex = useMemo(() => createStripeStripTexture(LECTERN_BRANDS[side], 1800, 64), [side]);
  useEffect(() => () => tex.dispose(), [tex]);
  const mat = useWornMat("#ffffff", tex);
  const h = height * 0.8;
  return (
    <group ref={ref}>
      <mesh position={[0, plateTopY + height / 2, faceZ + 0.0008]} material={mat}>
        <planeGeometry args={[STRIP_W, h]} />
      </mesh>
    </group>
  );
}

/** Mount at the lectern body root (legs at x = ±legSep/2, z = 0). */
export function LecternApron({ side, topY }: { side: "left" | "right"; topY: number }) {
  const ref = useRetroVisible();
  const tex = useMemo(() => createDecalTexture(LECTERN_BRANDS[side]), [side]);
  useEffect(() => () => tex.dispose(), [tex]);
  const bodyMat  = useWornMat("#E8DCC4");
  const decalMat = useWornMat("#ffffff", tex);
  const y = topY - APRON_H / 2;
  return (
    <group ref={ref}>
      <mesh position={[0, y, 0]} material={bodyMat} castShadow>
        <boxGeometry args={[APRON_W, APRON_H, APRON_T]} />
      </mesh>
      <mesh position={[0, y, APRON_T / 2 + 0.0008]} material={decalMat}>
        <planeGeometry args={[APRON_W * 0.94, APRON_W * 0.94 / 4]} />
      </mesh>
    </group>
  );
}
