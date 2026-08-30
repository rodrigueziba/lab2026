"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useFaceTracking } from "@/hooks/useFaceTracking";

// ── Layout ────────────────────────────────────────────────────────────────────
const CHAIR_X  = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5] as const;
const CHAIR_Z  = -2;
const START_Z  = -20;   // figures start in darkness behind the chairs
const HIP_Y    = 0.78;  // hip pivot world-height when root.y = 0
const SEAT_Y   = 0.44;  // chair seat from Chairs.tsx
const SIT_ROOT = SEAT_Y - HIP_Y; // root.y target when fully seated ≈ -0.34

// ── Shared body material (same across all figures) ────────────────────────────
const BODY_MAT = new THREE.MeshStandardMaterial({
  color:     "#1d1b1a",
  roughness: 0.9,
  metalness: 0.05,
});

// ── Phase state ───────────────────────────────────────────────────────────────
type Phase = "hidden" | "walking" | "sitting" | "disapproving";

interface FigureProps {
  index:        number;
  faceTexture:  THREE.CanvasTexture | null;
  activatedRef: { current: number | null };
}

// ── StickFigure ───────────────────────────────────────────────────────────────
function StickFigure({ index, faceTexture, activatedRef }: FigureProps) {
  // Pivot refs — imperative animation, no React state in the hot path
  const root       = useRef<THREE.Group>(null);
  const headG      = useRef<THREE.Group>(null);
  const lHip       = useRef<THREE.Group>(null);
  const rHip       = useRef<THREE.Group>(null);
  const lKnee      = useRef<THREE.Group>(null);
  const rKnee      = useRef<THREE.Group>(null);
  const lShoulder  = useRef<THREE.Group>(null);
  const rShoulder  = useRef<THREE.Group>(null);
  const lElbow     = useRef<THREE.Group>(null);
  const rElbow     = useRef<THREE.Group>(null);

  const phase      = useRef<Phase>("hidden");
  const phaseStart = useRef(0);
  const STAGGER    = index * 0.45;
  const WALK_DUR   = 3.5;
  const SIT_DUR    = 1.2;

  useFrame(({ clock }) => {
    if (!root.current || activatedRef.current === null) return;

    const elapsed = (Date.now() - activatedRef.current) / 1000 - STAGGER;
    if (elapsed < 0) return;

    const t  = clock.getElapsedTime();
    const pe = elapsed - phaseStart.current;

    // hidden → walking
    if (phase.current === "hidden") {
      phase.current         = "walking";
      phaseStart.current    = elapsed;
      root.current.visible  = true;
    }

    // ── WALKING ───────────────────────────────────────────────────────────────
    if (phase.current === "walking") {
      const prog = Math.min(1, pe / WALK_DUR);
      const ease = 1 - Math.pow(1 - prog, 3);

      root.current.position.z = THREE.MathUtils.lerp(START_Z, CHAIR_Z, ease);
      root.current.position.y = prog < 0.92
        ? Math.abs(Math.sin(t * 5.5 + index * 1.1)) * 0.032
        : 0;

      // Leg and arm swing
      const sw = Math.sin(t * 5.5 + index * 1.1);
      if (lHip.current)     lHip.current.rotation.x      =  sw * 0.38;
      if (rHip.current)     rHip.current.rotation.x      = -sw * 0.38;
      if (lKnee.current)    lKnee.current.rotation.x     =  Math.max(0,  sw) * 0.44;
      if (rKnee.current)    rKnee.current.rotation.x     =  Math.max(0, -sw) * 0.44;
      if (lShoulder.current) lShoulder.current.rotation.x = -sw * 0.30;
      if (rShoulder.current) rShoulder.current.rotation.x =  sw * 0.30;

      if (prog >= 1) { phase.current = "sitting"; phaseStart.current = elapsed; }
    }

    // ── SITTING ───────────────────────────────────────────────────────────────
    if (phase.current === "sitting") {
      const prog = Math.min(1, pe / SIT_DUR);
      const ease = 1 - Math.pow(1 - prog, 2);

      root.current.position.z = CHAIR_Z;
      root.current.position.y = THREE.MathUtils.lerp(0, SIT_ROOT, ease);

      // Fold legs — signs are positive because root.rotation.y = π inverts local X axis
      if (lHip.current)  lHip.current.rotation.x  = THREE.MathUtils.lerp(0,  1.46, ease);
      if (rHip.current)  rHip.current.rotation.x  = THREE.MathUtils.lerp(0,  1.46, ease);
      if (lKnee.current) lKnee.current.rotation.x = THREE.MathUtils.lerp(0, -1.46, ease);
      if (rKnee.current) rKnee.current.rotation.x = THREE.MathUtils.lerp(0, -1.46, ease);

      // Cross arms
      if (lShoulder.current) {
        lShoulder.current.rotation.x = THREE.MathUtils.lerp(0,  1.55, ease);
        lShoulder.current.rotation.z = THREE.MathUtils.lerp(0,  0.45, ease);
      }
      if (rShoulder.current) {
        rShoulder.current.rotation.x = THREE.MathUtils.lerp(0,  1.55, ease);
        rShoulder.current.rotation.z = THREE.MathUtils.lerp(0, -0.45, ease);
      }
      if (lElbow.current) lElbow.current.rotation.x = THREE.MathUtils.lerp(0,  1.4, ease);
      if (rElbow.current) rElbow.current.rotation.x = THREE.MathUtils.lerp(0,  1.4, ease);

      if (prog >= 1) { phase.current = "disapproving"; phaseStart.current = elapsed; }
    }

    // ── DISAPPROVING ──────────────────────────────────────────────────────────
    if (phase.current === "disapproving") {
      if (headG.current) {
        // Head shake: amplitude decays slowly, settling into a downward gaze
        const shake = Math.sin(pe * 4.5 + index * 0.7) * Math.max(0, 0.32 - pe * 0.016);
        headG.current.rotation.y = shake;
        // Ease to looking-down (negative x = nod forward)
        headG.current.rotation.x = THREE.MathUtils.lerp(headG.current.rotation.x, -0.30, 0.025);
      }
      // Subtle breathing shift so the arms feel alive
      if (lShoulder.current && rShoulder.current) {
        const br = Math.sin(pe * 1.2 + index * 0.9) * 0.012;
        lShoulder.current.rotation.z =  0.45 + br;
        rShoulder.current.rotation.z = -(0.45 + br);
      }
    }
  });

  return (
    <group
      ref={root}
      position={[CHAIR_X[index], 0, START_Z]}
      rotation={[0, Math.PI, 0]}  // faces the player / light (+z direction)
      visible={false}
    >
      {/* ── Head ──────────────────────────────────────────────────────────── */}
      <group ref={headG} position={[0, 1.48, 0]}>
        {/* rotation.y = π aligns sphere's +z UV seam with world +z (toward player),
            counteracting the root's rotation.y = π so the face texture faces forward. */}
        <mesh castShadow rotation={[0, Math.PI, 0]}>
          <sphereGeometry args={[0.13, 14, 10]} />
          <meshStandardMaterial
            map={faceTexture ?? undefined}
            color={faceTexture ? "#ffffff" : "#c9997c"}
            roughness={0.75}
          />
        </mesh>
      </group>

      {/* Neck */}
      <mesh position={[0, 1.32, 0]} castShadow>
        <cylinderGeometry args={[0.028, 0.028, 0.12, 7]} />
        <primitive object={BODY_MAT} attach="material" />
      </mesh>

      {/* ── Torso (shoulders are children) ───────────────────────────────── */}
      <group position={[0, 1.03, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.16, 0.42, 0.09]} />
          <primitive object={BODY_MAT} attach="material" />
        </mesh>

        {/* Left shoulder → upper arm → elbow → forearm */}
        <group ref={lShoulder} position={[-0.12, 0.18, 0]}>
          <mesh position={[0, -0.13, 0]} castShadow>
            <cylinderGeometry args={[0.022, 0.022, 0.26, 7]} />
            <primitive object={BODY_MAT} attach="material" />
          </mesh>
          <group ref={lElbow} position={[0, -0.26, 0]}>
            <mesh position={[0, -0.115, 0]} castShadow>
              <cylinderGeometry args={[0.019, 0.019, 0.23, 7]} />
              <primitive object={BODY_MAT} attach="material" />
            </mesh>
          </group>
        </group>

        {/* Right shoulder → upper arm → elbow → forearm */}
        <group ref={rShoulder} position={[0.12, 0.18, 0]}>
          <mesh position={[0, -0.13, 0]} castShadow>
            <cylinderGeometry args={[0.022, 0.022, 0.26, 7]} />
            <primitive object={BODY_MAT} attach="material" />
          </mesh>
          <group ref={rElbow} position={[0, -0.26, 0]}>
            <mesh position={[0, -0.115, 0]} castShadow>
              <cylinderGeometry args={[0.019, 0.019, 0.23, 7]} />
              <primitive object={BODY_MAT} attach="material" />
            </mesh>
          </group>
        </group>
      </group>

      {/* ── Left leg ─────────────────────────────────────────────────────── */}
      <group ref={lHip} position={[-0.058, HIP_Y, 0]}>
        <mesh position={[0, -0.18, 0]} castShadow>
          <cylinderGeometry args={[0.028, 0.028, 0.36, 7]} />
          <primitive object={BODY_MAT} attach="material" />
        </mesh>
        <group ref={lKnee} position={[0, -0.36, 0]}>
          <mesh position={[0, -0.155, 0]} castShadow>
            <cylinderGeometry args={[0.023, 0.023, 0.31, 7]} />
            <primitive object={BODY_MAT} attach="material" />
          </mesh>
        </group>
      </group>

      {/* ── Right leg ────────────────────────────────────────────────────── */}
      <group ref={rHip} position={[0.058, HIP_Y, 0]}>
        <mesh position={[0, -0.18, 0]} castShadow>
          <cylinderGeometry args={[0.028, 0.028, 0.36, 7]} />
          <primitive object={BODY_MAT} attach="material" />
        </mesh>
        <group ref={rKnee} position={[0, -0.36, 0]}>
          <mesh position={[0, -0.155, 0]} castShadow>
            <cylinderGeometry args={[0.023, 0.023, 0.31, 7]} />
            <primitive object={BODY_MAT} attach="material" />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// ── Audience ───────────────────────────────────────────────────────────────────
export default function Audience() {
  const { faceTexture, tick, start } = useFaceTracking();
  const activatedRef  = useRef<number | null>(null);
  const startedCamera = useRef(false);

  useEffect(() => {
    const handle = () => {
      if (activatedRef.current === null) activatedRef.current = Date.now();
      if (!startedCamera.current) {
        startedCamera.current = true;
        start(); // request webcam + load MediaPipe
      }
    };
    window.addEventListener("alight:chose-light", handle);
    return () => window.removeEventListener("alight:chose-light", handle);
  }, [start]);

  // Keep CanvasTexture in sync with webcam every render frame
  useFrame(() => { tick(); });

  return (
    <group>
      {CHAIR_X.map((_, i) => (
        <StickFigure
          key={i}
          index={i}
          faceTexture={faceTexture}
          activatedRef={activatedRef}
        />
      ))}
    </group>
  );
}
