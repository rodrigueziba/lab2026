"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createWornPaintTex, createStripeBandTex } from "@/lib/retro/decals";

export const CHAIR_Z = -3; // G2: 1 m más lejos de la tarima (era -2)

const POSITIONS_X = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5];
const LEGS: [number, number][] = [[-0.2, -0.2], [-0.2, 0.2], [0.2, -0.2], [0.2, 0.2]];

// R5: flag to toggle retro styling; legacy colors preserved below
const R5_CHAIRS_RETRO = true;

// ── Shared materials (module-level, created once) ────────────────────────────
let _chairBodyMat:  THREE.MeshStandardMaterial | null = null;
let _chairLegMat:   THREE.MeshStandardMaterial | null = null;
let _chairBodyTex:  THREE.CanvasTexture | null = null;
let _chairStripeMat: THREE.MeshBasicMaterial | null = null;
let _chairStripeTex: THREE.CanvasTexture | null = null;

function getChairMats() {
  if (!_chairBodyTex) {
    _chairBodyTex = createWornPaintTex("#CFC8BA", []);
    _chairBodyMat = new THREE.MeshStandardMaterial({
      map: _chairBodyTex, roughness: 0.90, metalness: 0.0,
    });
    _chairLegMat = new THREE.MeshStandardMaterial({
      color: "#9A9590", roughness: 0.75, metalness: 0.20,
    });
    _chairStripeTex = createStripeBandTex(undefined, 256, 24);
    _chairStripeMat = new THREE.MeshBasicMaterial({
      map: _chairStripeTex, transparent: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
  }
  return { body: _chairBodyMat!, leg: _chairLegMat!, stripe: _chairStripeMat! };
}

// Unit-number canvas texture (one per chair; cached by index)
const _unitTexCache: Map<number, THREE.CanvasTexture> = new Map();
function getUnitTex(idx: number): THREE.CanvasTexture {
  if (!_unitTexCache.has(idx)) {
    const cv = document.createElement("canvas");
    cv.width = 64; cv.height = 64;
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = "#CFC8BA";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#3A3B3C";
    ctx.font = 'bold 22px ui-monospace,Menlo,Consolas,monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 0.65;
    ctx.fillText(`${(idx + 1).toString().padStart(2, "0")}`, 32, 32);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    _unitTexCache.set(idx, tex);
  }
  return _unitTexCache.get(idx)!;
}

function ChairRetro({ x, idx }: { x: number; idx: number }) {
  const { scene } = useThree();
  const addedRef = useRef(false);

  useEffect(() => {
    if (addedRef.current) return;
    addedRef.current = true;

    const { stripe } = getChairMats();

    // Thin stripe band on front face of backrest (facing −Z)
    const sPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.44, 0.018),
      stripe,
    );
    // backrest front face at z = -0.21 − 0.02 = -0.23 (just in front)
    sPlane.position.set(x, 1.02, CHAIR_Z - 0.23 - 0.001);
    scene.add(sPlane);

    return () => {
      scene.remove(sPlane);
      (sPlane.geometry as THREE.PlaneGeometry).dispose();
    };
  }, [scene, x]);

  const { body, leg } = getChairMats();
  const unitTex = getUnitTex(idx);
  const unitMat = new THREE.MeshStandardMaterial({ map: unitTex, roughness: 0.9, metalness: 0 });

  return (
    <group position={[x, 0, CHAIR_Z]}>
      {/* seat — unit number on top */}
      <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.48, 0.05, 0.46]} />
        <primitive object={unitMat} attach="material" />
      </mesh>
      {/* back rest */}
      <mesh position={[0, 0.82, -0.21]} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.72, 0.04]} />
        <primitive object={body} attach="material" />
      </mesh>
      {/* top rail */}
      <mesh position={[0, 1.16, -0.21]} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.05, 0.05]} />
        <primitive object={body} attach="material" />
      </mesh>
      {/* mid rail */}
      <mesh position={[0, 0.67, -0.21]} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.03, 0.04]} />
        <primitive object={body} attach="material" />
      </mesh>
      {/* legs */}
      {LEGS.map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.22, lz]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, 0.44, 8]} />
          <primitive object={leg} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

// ── Legacy chair (pre-R5, dark wood look) ────────────────────────────────────
function ChairLegacy({ x }: { x: number }) {
  return (
    <group position={[x, 0, CHAIR_Z]}>
      <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.48, 0.05, 0.46]} />
        <meshStandardMaterial color="#1a0f07" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.82, -0.21]} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.72, 0.04]} />
        <meshStandardMaterial color="#1a0f07" roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.16, -0.21]} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.05, 0.05]} />
        <meshStandardMaterial color="#1a0f07" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.67, -0.21]} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.03, 0.04]} />
        <meshStandardMaterial color="#1a0f07" roughness={0.95} />
      </mesh>
      {LEGS.map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.22, lz]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, 0.44, 8]} />
          <meshStandardMaterial color="#1a0f07" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

export default function Chairs() {
  return (
    <group>
      {POSITIONS_X.map((x, idx) =>
        R5_CHAIRS_RETRO
          ? <ChairRetro key={x} x={x} idx={idx} />
          : <ChairLegacy key={x} x={x} />,
      )}
    </group>
  );
}
