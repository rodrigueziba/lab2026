"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useFaceTracking } from "@/hooks/useFaceTracking";

// ── Layout ────────────────────────────────────────────────────────────────────
const CHAIR_X  = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5] as const;
const CHAIR_Z  = -2;
const START_Z  = -20;
const HIP_Y    = 0.78;
// Seat top surface from Chairs.tsx: center y=0.44, height 0.05 → top = 0.465.
// Add sitting offset so hips rest ON the seat, not through it.
const SIT_ROOT = 0.465 + 0.06 - HIP_Y;  // ≈ -0.255

// ── Per-figure personality: stagger, walk speed, head-shake rhythm ─────────────
// Fixed values that give natural-looking variation without runtime randomness.
const FIGURE_PARAMS = [
  { stagger: 0.0, walkDur: 4.6, sitDur: 1.3, headSpeed: 0.42, headPhase: 0.0  },
  { stagger: 1.5, walkDur: 3.9, sitDur: 1.5, headSpeed: 0.61, headPhase: 1.7  },
  { stagger: 0.7, walkDur: 5.2, sitDur: 1.2, headSpeed: 0.36, headPhase: 3.1  },
  { stagger: 2.3, walkDur: 4.1, sitDur: 1.6, headSpeed: 0.55, headPhase: 0.9  },
  { stagger: 1.1, walkDur: 4.8, sitDur: 1.4, headSpeed: 0.47, headPhase: 2.5  },
  { stagger: 1.9, walkDur: 3.6, sitDur: 1.1, headSpeed: 0.68, headPhase: 1.3  },
] as const;

// ── Shared body material ──────────────────────────────────────────────────────
const BODY_MAT = new THREE.MeshStandardMaterial({
  color: "#1d1b1a", roughness: 0.9, metalness: 0.05,
});

// ── Default face texture (shown when no webcam / no face detected) ────────────
// Place the image at frontend/public/default-face.jpg.
const DEFAULT_FACE_TEX = new THREE.TextureLoader().load(
  "/default-face.jpg",
  (t) => { t.colorSpace = THREE.SRGBColorSpace; },
  undefined,
  () => { /* file not found — shader falls back to skin color */ },
);

// ── Phase ─────────────────────────────────────────────────────────────────────
type Phase = "hidden" | "walking" | "sitting" | "disapproving";

interface FigureProps {
  index:        number;
  faceTex:      THREE.Texture | null;
  activatedRef: { current: number | null };
}

// ── StickFigure ───────────────────────────────────────────────────────────────
function StickFigure({ index, faceTex, activatedRef }: FigureProps) {
  const p = FIGURE_PARAMS[index];

  const root      = useRef<THREE.Group>(null);
  const headG     = useRef<THREE.Group>(null);
  const lHip      = useRef<THREE.Group>(null);
  const rHip      = useRef<THREE.Group>(null);
  const lKnee     = useRef<THREE.Group>(null);
  const rKnee     = useRef<THREE.Group>(null);
  const lShoulder = useRef<THREE.Group>(null);
  const rShoulder = useRef<THREE.Group>(null);
  const lElbow    = useRef<THREE.Group>(null);
  const rElbow    = useRef<THREE.Group>(null);

  const phase      = useRef<Phase>("hidden");
  const phaseStart = useRef(0);

  useFrame(({ clock }) => {
    if (!root.current || activatedRef.current === null) return;

    const elapsed = (Date.now() - activatedRef.current) / 1000 - p.stagger;
    if (elapsed < 0) return;

    const t  = clock.getElapsedTime();
    const pe = elapsed - phaseStart.current;

    if (phase.current === "hidden") {
      phase.current      = "walking";
      phaseStart.current = elapsed;
      root.current.visible = true;
    }

    // ── WALKING ───────────────────────────────────────────────────────────────
    if (phase.current === "walking") {
      const prog = Math.min(1, pe / p.walkDur);
      const ease = 1 - Math.pow(1 - prog, 3);

      root.current.position.z = THREE.MathUtils.lerp(START_Z, CHAIR_Z, ease);
      root.current.position.y = prog < 0.92
        ? Math.abs(Math.sin(t * 5.5 + index * 1.1)) * 0.032
        : 0;

      const sw = Math.sin(t * 5.5 + index * 1.1);
      if (lHip.current)      lHip.current.rotation.x      =  sw * 0.38;
      if (rHip.current)      rHip.current.rotation.x      = -sw * 0.38;
      if (lKnee.current)     lKnee.current.rotation.x     =  Math.max(0,  sw) * 0.44;
      if (rKnee.current)     rKnee.current.rotation.x     =  Math.max(0, -sw) * 0.44;
      if (lShoulder.current) lShoulder.current.rotation.x = -sw * 0.30;
      if (rShoulder.current) rShoulder.current.rotation.x =  sw * 0.30;

      if (prog >= 1) { phase.current = "sitting"; phaseStart.current = elapsed; }
    }

    // ── SITTING ───────────────────────────────────────────────────────────────
    if (phase.current === "sitting") {
      const prog = Math.min(1, pe / p.sitDur);
      const ease = 1 - Math.pow(1 - prog, 2);

      root.current.position.z = CHAIR_Z;
      root.current.position.y = THREE.MathUtils.lerp(0, SIT_ROOT, ease);

      // Legs fold — root.rotation.y=π inverts local-X so positive values fold forward
      if (lHip.current)  lHip.current.rotation.x  = THREE.MathUtils.lerp(0,  1.46, ease);
      if (rHip.current)  rHip.current.rotation.x  = THREE.MathUtils.lerp(0,  1.46, ease);
      if (lKnee.current) lKnee.current.rotation.x = THREE.MathUtils.lerp(0, -1.46, ease);
      if (rKnee.current) rKnee.current.rotation.x = THREE.MathUtils.lerp(0, -1.46, ease);

      // Arms cross in front of chest (like reference image)
      // With root.rotation.y=π: positive z = world -z (figure's front).
      // rotation.z positive on lShoulder swings arm toward local+x = world-x (crosses right).
      // rotation.z negative on rShoulder swings arm toward local-x = world+x (crosses left).
      if (lShoulder.current) {
        lShoulder.current.rotation.x = THREE.MathUtils.lerp(0,  0.55, ease);
        lShoulder.current.rotation.z = THREE.MathUtils.lerp(0,  1.15, ease);
      }
      if (rShoulder.current) {
        rShoulder.current.rotation.x = THREE.MathUtils.lerp(0,  0.55, ease);
        rShoulder.current.rotation.z = THREE.MathUtils.lerp(0, -1.15, ease);
      }
      if (lElbow.current) {
        lElbow.current.rotation.x = THREE.MathUtils.lerp(0,  1.1, ease);
        lElbow.current.rotation.z = THREE.MathUtils.lerp(0,  0.4, ease);
      }
      if (rElbow.current) {
        rElbow.current.rotation.x = THREE.MathUtils.lerp(0,  1.1, ease);
        rElbow.current.rotation.z = THREE.MathUtils.lerp(0, -0.4, ease);
      }

      if (prog >= 1) { phase.current = "disapproving"; phaseStart.current = elapsed; }
    }

    // ── DISAPPROVING ──────────────────────────────────────────────────────────
    if (phase.current === "disapproving") {
      if (headG.current) {
        // Slow head shake "no": sinusoidal, max 30° (0.52 rad), each figure at
        // a different speed and phase so they don't move in sync.
        headG.current.rotation.y =
          Math.sin(pe * p.headSpeed + p.headPhase) * 0.52;
        // Slight downward gaze
        headG.current.rotation.x = THREE.MathUtils.lerp(
          headG.current.rotation.x, -0.14, 0.018,
        );
      }
      // Subtle breathing in crossed arms
      if (lShoulder.current && rShoulder.current) {
        const br = Math.sin(pe * 1.1 + index * 0.9) * 0.011;
        lShoulder.current.rotation.z =  1.15 + br;
        rShoulder.current.rotation.z = -(1.15 + br);
      }
    }
  });

  return (
    <group
      ref={root}
      position={[CHAIR_X[index], 0, START_Z]}
      rotation={[0, Math.PI, 0]}
      visible={false}
    >
      {/* ── Head ──────────────────────────────────────────────────────────── */}
      <group ref={headG} position={[0, 1.48, 0]}>
        {/* rotation.y=π on the mesh counters the root rotation so the face
            texture (UV center = sphere local+z) points toward world+z (player). */}
        <mesh castShadow rotation={[0, Math.PI, 0]}>
          <sphereGeometry args={[0.13, 14, 10]} />
          <meshStandardMaterial
            map={faceTex ?? DEFAULT_FACE_TEX}
            color={faceTex || DEFAULT_FACE_TEX ? "#ffffff" : "#c9997c"}
            roughness={0.75}
          />
        </mesh>
      </group>

      {/* Neck */}
      <mesh position={[0, 1.32, 0]} castShadow>
        <cylinderGeometry args={[0.028, 0.028, 0.12, 7]} />
        <primitive object={BODY_MAT} attach="material" />
      </mesh>

      {/* ── Torso ─────────────────────────────────────────────────────────── */}
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
  const { snapshot, tick, start } = useFaceTracking();
  const activatedRef  = useRef<number | null>(null);
  const startedCamera = useRef(false);

  useEffect(() => {
    const handle = () => {
      if (activatedRef.current === null) activatedRef.current = Date.now();
      if (!startedCamera.current) {
        startedCamera.current = true;
        start();
      }
    };
    window.addEventListener("alight:chose-light", handle);
    return () => window.removeEventListener("alight:chose-light", handle);
  }, [start]);

  // tick() is a no-op after the snapshot is captured — safe to call every frame
  useFrame(() => { tick(); });

  return (
    <group>
      {CHAIR_X.map((_, i) => (
        <StickFigure
          key={i}
          index={i}
          faceTex={snapshot}
          activatedRef={activatedRef}
        />
      ))}
    </group>
  );
}
