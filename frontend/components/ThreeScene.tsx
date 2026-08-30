"use client";

import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls, SpotLight } from "@react-three/drei";
import * as THREE from "three";
import Chairs from "./Chairs";
import ExperienceDome from "./ExperienceDome";
import Audience from "./Audience";
import Prism from "./Prism";

// Zone vectors — module-level, never re-created
const ZONA_LUZ    = new THREE.Vector3(0, 1.6, 0);
const ZONA_SILLAS = new THREE.Vector3(0, 1.6, -5);

// ── Room ──────────────────────────────────────────────────────────────────────
function Room() {
  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#0d0d0f" roughness={0.95} />
      </mesh>
      {/* back wall */}
      <mesh position={[0, 11, -40]}>
        <planeGeometry args={[80, 22]} />
        <meshStandardMaterial color="#080809" roughness={1} />
      </mesh>
      {/* front wall */}
      <mesh position={[0, 11, 40]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[80, 22]} />
        <meshStandardMaterial color="#080809" roughness={1} />
      </mesh>
      {/* left wall */}
      <mesh position={[-40, 11, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[80, 22]} />
        <meshStandardMaterial color="#080809" roughness={1} />
      </mesh>
      {/* right wall */}
      <mesh position={[40, 11, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[80, 22]} />
        <meshStandardMaterial color="#080809" roughness={1} />
      </mesh>
      {/* ceiling */}
      <mesh position={[0, 22, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#060606" roughness={1} />
      </mesh>
    </group>
  );
}

// ── Diagonal spotlight ────────────────────────────────────────────────────────
// Position [9, 18, 10] with default target [0,0,0] creates a diagonal beam
// that hits the floor at the center of the room — 18 units of vertical drop
// spreads the cone ~5.5u radius at floor level (angle 0.3 rad ≈ 17°)
function DiagonalSpot() {
  return (
    <SpotLight
      position={[9, 18, 10]}
      color="#fff5dc"
      intensity={3500}
      distance={55}
      angle={0.3}
      penumbra={0.4}
      attenuation={6}
      anglePower={5}
      castShadow
    />
  );
}

// ── Player movement ───────────────────────────────────────────────────────────
interface Keys { w: boolean; a: boolean; s: boolean; d: boolean }

const SEAT_CAM_Y = 1.0; // camera height when seated (from 1.6 → 1.0)

function Player() {
  const keys      = useRef<Keys>({ w: false, a: false, s: false, d: false });
  const triggered = useRef(false);
  const seated    = useRef(false);
  // Pre-allocated vectors — never new'd inside useFrame
  const front = useRef(new THREE.Vector3());
  const side  = useRef(new THREE.Vector3());
  const dir   = useRef(new THREE.Vector3());
  const { camera } = useThree();

  useEffect(() => { camera.position.set(-10, 1.6, -7); }, [camera]);

  useEffect(() => {
    const onSit = () => { seated.current = true; };
    window.addEventListener("alight:chose-chairs", onSit);
    return () => window.removeEventListener("alight:chose-chairs", onSit);
  }, []);

  // Re-enable WASD once the dome has fully revealed (fired by ExperienceDome)
  useEffect(() => {
    const onReveal = () => { seated.current = false; };
    window.addEventListener("alight:dome-revealed", onReveal);
    return () => window.removeEventListener("alight:dome-revealed", onReveal);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in keys.current) keys.current[k as keyof Keys] = true;
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in keys.current) keys.current[k as keyof Keys] = false;
    };
    document.addEventListener("keydown", down);
    document.addEventListener("keyup", up);
    return () => {
      document.removeEventListener("keydown", down);
      document.removeEventListener("keyup", up);
    };
  }, []);

  useFrame(({ camera: cam }) => {
    // When seated: freeze XZ, gently lower the camera and stop WASD
    if (seated.current) {
      cam.position.y = THREE.MathUtils.lerp(cam.position.y, SEAT_CAM_Y, 0.04);
      return;
    }

    cam.getWorldDirection(front.current);
    front.current.y = 0;
    front.current.normalize();
    side.current.crossVectors(cam.up, front.current).normalize();

    dir.current.set(0, 0, 0);
    if (keys.current.w) dir.current.add(front.current);
    if (keys.current.s) dir.current.sub(front.current);
    if (keys.current.a) dir.current.add(side.current);
    if (keys.current.d) dir.current.sub(side.current);

    if (dir.current.lengthSq() > 0) {
      dir.current.normalize().multiplyScalar(0.12);
      cam.position.add(dir.current);
    }
    cam.position.y = 1.6;

    if (!triggered.current) {
      if (cam.position.distanceTo(ZONA_LUZ) < 2.5) {
        triggered.current = true;
        window.dispatchEvent(new CustomEvent("alight:chose-light"));
      } else if (cam.position.distanceTo(ZONA_SILLAS) < 2.5) {
        triggered.current = true;
        window.dispatchEvent(new CustomEvent("alight:chose-chairs"));
        window.dispatchEvent(new CustomEvent("activar-prisma"));
      }
    }
  });

  return null;
}

// ── Scene content (inside Canvas context) ─────────────────────────────────────
function Scene() {
  return (
    <>
      <color attach="background" args={["#020202"]} />
      <fog attach="fog" args={["#020202", 25, 65]} />
      <ambientLight intensity={0.04} />
      <Room />
      <DiagonalSpot />
      <Chairs />
      <Audience />
      <Prism />
      <ExperienceDome />
      <Player />
      <PointerLockControls />
    </>
  );
}

// ── Canvas wrapper ─────────────────────────────────────────────────────────────
export default function ThreeScene() {
  return (
    <Canvas
      style={{ width: "100vw", height: "100vh" }}
      shadows
      camera={{ position: [-10, 1.6, -7], fov: 90 }}
      gl={{ antialias: true }}
    >
      <Scene />
    </Canvas>
  );
}
