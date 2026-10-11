"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useFaceTracking } from "@/hooks/useFaceTracking";
import { CHAIR_Z } from "./Chairs";

// ── Layout ────────────────────────────────────────────────────────────────────
const CHAIR_X  = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5] as const;
const START_Z  = -20;
const HIP_Y    = 0.78;
const SIT_ROOT = 0.465 + 0.06 - HIP_Y;  // ≈ -0.255

const FIGURE_PARAMS = [
  { stagger: 0.0, walkDur: 4.6, sitDur: 1.3, headSpeed: 0.42, headPhase: 0.0  },
  { stagger: 1.5, walkDur: 3.9, sitDur: 1.5, headSpeed: 0.61, headPhase: 1.7  },
  { stagger: 0.7, walkDur: 5.2, sitDur: 1.2, headSpeed: 0.36, headPhase: 3.1  },
  { stagger: 2.3, walkDur: 4.1, sitDur: 1.6, headSpeed: 0.55, headPhase: 0.9  },
  { stagger: 1.1, walkDur: 4.8, sitDur: 1.4, headSpeed: 0.47, headPhase: 2.5  },
  { stagger: 1.9, walkDur: 3.6, sitDur: 1.1, headSpeed: 0.68, headPhase: 1.3  },
] as const;

const BODY_MAT = new THREE.MeshStandardMaterial({
  color: "#1d1b1a", roughness: 0.9, metalness: 0.05,
});

// ── T2: Brazos cruzados — construcción geométrica ─────────────────────────────
// Sistema local del torso (spec): x derecha, y arriba, z adelante (hacia tarima)
// En root-local: spec +z = root-local -z  (root.rotation.y = π invierte Z)
//
// Constantes físicas de la figura:
const ARM_R       = 0.022;            // radio del cilindro de brazo
const ARM_T       = ARM_R * 2;        // grosor = 0.044 m
const L1          = 0.26;             // largo del brazo superior (shoulder → elbow)
const SHOULDER_X  = 0.12;            // semi-ancho entre hombros
const SHOULDER_Y  = 1.03 + 0.18;     // y del punto de hombro en root-local = 1.21

// Computa todos los puntos de la pose en root-local una sola vez (fuera de render)
function buildCrossedArms() {
  const S_R  = new THREE.Vector3( SHOULDER_X, SHOULDER_Y, 0);
  const S_L  = new THREE.Vector3(-SHOULDER_X, SHOULDER_Y, 0);

  // u = normalize(0,-1,0.35) en spec → root-local (spec +z = root-local -z)
  const u = new THREE.Vector3(0, -1, -0.35).normalize();

  const E_R = S_R.clone().addScaledVector(u, L1);
  const E_L = S_L.clone().addScaledVector(u, L1);

  // Objetivo de cada mano: bíceps del brazo opuesto al 70 %, + t adelante (spec +z → -ARM_T)
  const H_R = new THREE.Vector3().lerpVectors(S_L, E_L, 0.7)
    .add(new THREE.Vector3(0, 0, -ARM_T));
  const H_L = new THREE.Vector3().lerpVectors(S_R, E_R, 0.7)
    .add(new THREE.Vector3(0, 0, -ARM_T));

  // Separación en profundidad: brazo derecho más adelante (spec +0.6t → root-local -dz)
  const DEPTH = 0.6 * ARM_T;
  const dR = new THREE.Vector3(0, 0, -DEPTH);
  const dL = new THREE.Vector3(0, 0, +DEPTH);

  return {
    rUpperA: S_R.clone().add(dR), rUpperB: E_R.clone().add(dR),
    lUpperA: S_L.clone().add(dL), lUpperB: E_L.clone().add(dL),
    rForeA:  E_R.clone().add(dR), rForeB:  H_R.clone().add(dR),
    lForeA:  E_L.clone().add(dL), lForeB:  H_L.clone().add(dL),
    rHand:   H_R.clone().add(dR),
    lHand:   H_L.clone().add(dL),
  };
}
const CROSSED_ARMS = buildCrossedArms(); // calculado una sola vez al cargar el módulo

// Helper: orientar un cilindro entre dos puntos (posición, quaternion, largo)
function segProps(a: THREE.Vector3, b: THREE.Vector3) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const pos = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const q   = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0), dir.normalize(),
  );
  return { pos: pos.toArray() as [number, number, number], q, len };
}

// Geometría de brazos cruzados — se computa una vez con useMemo y se instancia por figura
const CrossedArms = React.forwardRef<THREE.Group>(function CrossedArms(_, ref) {
  const segs = useMemo(() => ({
    rU: segProps(CROSSED_ARMS.rUpperA, CROSSED_ARMS.rUpperB),
    lU: segProps(CROSSED_ARMS.lUpperA, CROSSED_ARMS.lUpperB),
    rF: segProps(CROSSED_ARMS.rForeA,  CROSSED_ARMS.rForeB),
    lF: segProps(CROSSED_ARMS.lForeA,  CROSSED_ARMS.lForeB),
    rH: CROSSED_ARMS.rHand.toArray() as [number, number, number],
    lH: CROSSED_ARMS.lHand.toArray() as [number, number, number],
  }), []);

  return (
    <group ref={ref} visible={false}>
      <mesh position={segs.rU.pos} quaternion={segs.rU.q} castShadow>
        <cylinderGeometry args={[ARM_R, ARM_R, segs.rU.len, 7]} />
        <primitive object={BODY_MAT} attach="material" />
      </mesh>
      <mesh position={segs.lU.pos} quaternion={segs.lU.q} castShadow>
        <cylinderGeometry args={[ARM_R, ARM_R, segs.lU.len, 7]} />
        <primitive object={BODY_MAT} attach="material" />
      </mesh>
      <mesh position={segs.rF.pos} quaternion={segs.rF.q} castShadow>
        <cylinderGeometry args={[ARM_R * 0.88, ARM_R * 0.88, segs.rF.len, 7]} />
        <primitive object={BODY_MAT} attach="material" />
      </mesh>
      <mesh position={segs.lF.pos} quaternion={segs.lF.q} castShadow>
        <cylinderGeometry args={[ARM_R * 0.88, ARM_R * 0.88, segs.lF.len, 7]} />
        <primitive object={BODY_MAT} attach="material" />
      </mesh>
      <mesh position={segs.rH} castShadow>
        <sphereGeometry args={[ARM_R * 1.3, 8, 6]} />
        <primitive object={BODY_MAT} attach="material" />
      </mesh>
      <mesh position={segs.lH} castShadow>
        <sphereGeometry args={[ARM_R * 1.3, 8, 6]} />
        <primitive object={BODY_MAT} attach="material" />
      </mesh>
    </group>
  );
});

// ── Head face shader — proyección plana desde el frente ───────────────────────
// Sistema de coordenadas:
//   root.rotation.y = π  AND  mesh.rotation.y = π  → rotación total = 2π = identidad
//   Por lo tanto mesh-local +Z = world +Z = hacia la tarima/intérprete (hemisferio frontal)
//   mesh-local +X = world +X = derecha del espectador = mejilla izquierda del sujeto
//
// Proyección:
//   u = 0.5 + x/(2·R·FACE_COVER)   → u=0 = mejilla der. del sujeto (izquierda del espectador)
//   v = 0.5 + y/(2·R·FACE_COVER)   → v=1 = frente, v=0 = mentón (Three.js flipY=true en CanvasTexture)
//
// Emissive: la cara suma +0.6 de la textura para verse en la oscuridad.

const HEAD_VERT = /* glsl */`
  varying vec3 vLocalPos;
  void main() {
    vLocalPos   = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const HEAD_FRAG = /* glsl */`
  precision mediump float;
  uniform sampler2D uFaceTex;
  uniform float     uHasFace;
  varying vec3      vLocalPos;

  const float R          = 0.13;
  const float FACE_COVER = 0.95;

  void main() {
    // Solo hemisferio frontal (mesh-local +Z mira hacia la tarima)
    float front = step(0.0, vLocalPos.z);

    // Proyección plana según spec
    float fu = 0.5 + vLocalPos.x / (2.0 * R * FACE_COVER);
    float fv = 0.5 + vLocalPos.y / (2.0 * R * FACE_COVER);

    // Degradado circular suave en el borde (sin parche duro)
    float du = fu * 2.0 - 1.0;
    float dv = fv * 2.0 - 1.0;
    float r  = sqrt(du * du + dv * dv);
    float alpha = front * (1.0 - smoothstep(0.78, 1.0, r)) * uHasFace;

    vec2  uv      = clamp(vec2(fu, fv), 0.001, 0.999);
    vec4  faceCol = texture2D(uFaceTex, uv);
    vec3  skin    = vec3(0.788, 0.600, 0.486); // #c9997c

    vec3 color = mix(skin, faceCol.rgb, alpha);
    // Emissive: visible aunque la escena esté oscura
    color += faceCol.rgb * alpha * 0.6;

    gl_FragColor = vec4(min(color, vec3(1.0)), 1.0);
  }
`;

const HEAD_UNIFORMS = {
  uFaceTex: { value: new THREE.Texture() },
  uHasFace: { value: 0.0 },
};

const HEAD_MAT = new THREE.ShaderMaterial({
  vertexShader:   HEAD_VERT,
  fragmentShader: HEAD_FRAG,
  uniforms:       HEAD_UNIFORMS,
});

// ── Types ────────────────────────────────────────────────────────────────────
type Phase = "hidden" | "walking" | "sitting" | "disapproving";

interface FigureProps {
  index:        number;
  activatedRef: { current: number | null };
}

// ── StickFigure ───────────────────────────────────────────────────────────────
function StickFigure({ index, activatedRef }: FigureProps) {
  const p = FIGURE_PARAMS[index];

  const root        = useRef<THREE.Group>(null);
  const headG       = useRef<THREE.Group>(null);
  const lHip        = useRef<THREE.Group>(null);
  const rHip        = useRef<THREE.Group>(null);
  const lKnee       = useRef<THREE.Group>(null);
  const rKnee       = useRef<THREE.Group>(null);
  const lShoulder   = useRef<THREE.Group>(null);
  const rShoulder   = useRef<THREE.Group>(null);
  const armGroupRef = useRef<THREE.Group>(null);  // brazos de animación de caminar
  const crossedRef  = useRef<THREE.Group>(null);  // brazos cruzados geométricos

  const phase      = useRef<Phase>("hidden");
  const phaseStart = useRef(0);

  useFrame(({ clock }) => {
    if (!root.current || activatedRef.current === null) return;

    const elapsed = (Date.now() - activatedRef.current) / 1000 - p.stagger;
    if (elapsed < 0) return;

    const t  = clock.getElapsedTime();
    const pe = elapsed - phaseStart.current;

    if (phase.current === "hidden") {
      phase.current        = "walking";
      phaseStart.current   = elapsed;
      root.current.visible = true;
    }

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

    if (phase.current === "sitting") {
      const prog = Math.min(1, pe / p.sitDur);
      const ease = 1 - Math.pow(1 - prog, 2);

      root.current.position.z = CHAIR_Z;
      root.current.position.y = THREE.MathUtils.lerp(0, SIT_ROOT, ease);

      if (lHip.current)  lHip.current.rotation.x  = THREE.MathUtils.lerp(0,  1.46, ease);
      if (rHip.current)  rHip.current.rotation.x  = THREE.MathUtils.lerp(0,  1.46, ease);
      if (lKnee.current) lKnee.current.rotation.x = THREE.MathUtils.lerp(0, -1.46, ease);
      if (rKnee.current) rKnee.current.rotation.x = THREE.MathUtils.lerp(0, -1.46, ease);

      // Al sentarse: los brazos colgantes desaparecen, aparecen los cruzados
      if (armGroupRef.current) armGroupRef.current.visible = false;
      if (crossedRef.current)  crossedRef.current.visible  = true;

      if (prog >= 1) { phase.current = "disapproving"; phaseStart.current = elapsed; }
    }

    if (phase.current === "disapproving") {
      // Solo cabeza: movimiento de desaprobación sutil. Brazos quietos (CrossedArms es estático).
      if (headG.current) {
        headG.current.rotation.y = Math.sin(pe * p.headSpeed + p.headPhase) * 0.52;
        headG.current.rotation.x = THREE.MathUtils.lerp(headG.current.rotation.x, -0.14, 0.018);
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
      {/* Cabeza con proyección plana de la cara */}
      <group ref={headG} position={[0, 1.48, 0]}>
        <mesh castShadow rotation={[0, Math.PI, 0]}>
          <sphereGeometry args={[0.13, 14, 10]} />
          <primitive object={HEAD_MAT} attach="material" />
        </mesh>
      </group>

      {/* Cuello */}
      <mesh position={[0, 1.32, 0]} castShadow>
        <cylinderGeometry args={[0.028, 0.028, 0.12, 7]} />
        <primitive object={BODY_MAT} attach="material" />
      </mesh>

      {/* Torso + brazos de caminar (se ocultan al sentarse) */}
      <group position={[0, 1.03, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.16, 0.42, 0.09]} />
          <primitive object={BODY_MAT} attach="material" />
        </mesh>

        {/* Brazos de animación de caminar (visible solo en fase walking) */}
        <group ref={armGroupRef}>
          <group ref={lShoulder} position={[-0.12, 0.18, 0]}>
            <mesh position={[0, -0.13, 0]} castShadow>
              <cylinderGeometry args={[0.022, 0.022, 0.26, 7]} />
              <primitive object={BODY_MAT} attach="material" />
            </mesh>
            <group position={[0, -0.26, 0]}>
              <mesh position={[0, -0.115, 0]} castShadow>
                <cylinderGeometry args={[0.019, 0.019, 0.23, 7]} />
                <primitive object={BODY_MAT} attach="material" />
              </mesh>
            </group>
          </group>

          <group ref={rShoulder} position={[0.12, 0.18, 0]}>
            <mesh position={[0, -0.13, 0]} castShadow>
              <cylinderGeometry args={[0.022, 0.022, 0.26, 7]} />
              <primitive object={BODY_MAT} attach="material" />
            </mesh>
            <group position={[0, -0.26, 0]}>
              <mesh position={[0, -0.115, 0]} castShadow>
                <cylinderGeometry args={[0.019, 0.019, 0.23, 7]} />
                <primitive object={BODY_MAT} attach="material" />
              </mesh>
            </group>
          </group>
        </group>
      </group>

      {/* Brazos cruzados geométricos (invisible hasta fase sitting) */}
      <CrossedArms ref={crossedRef} />

      {/* Piernas */}
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
  const { start, status, snapshot } = useFaceTracking();
  const activatedRef  = useRef<number | null>(null);
  const startedCamera = useRef(false);
  const starsReady    = useRef(false);
  const faceReady     = useRef(false);

  // Start camera on chose-light
  useEffect(() => {
    const onLight = () => {
      if (!startedCamera.current) { startedCamera.current = true; start(); }
    };
    window.addEventListener("alight:chose-light", onLight);
    return () => window.removeEventListener("alight:chose-light", onLight);
  }, [start]);

  // T1: figures appear when BOTH stars-visible AND face-captured have fired
  useEffect(() => {
    const check = () => {
      if (starsReady.current && faceReady.current && activatedRef.current === null) {
        activatedRef.current = Date.now();
      }
    };
    const onStars = () => { starsReady.current = true; check(); };
    const onFace  = () => { faceReady.current  = true; check(); };
    window.addEventListener("alight:stars-visible",  onStars);
    window.addEventListener("alight:face-captured",  onFace);
    return () => {
      window.removeEventListener("alight:stars-visible", onStars);
      window.removeEventListener("alight:face-captured", onFace);
    };
  }, []);

  // T1: update head shader when snapshot is ready
  useEffect(() => {
    if (!snapshot) return;
    HEAD_UNIFORMS.uFaceTex.value = snapshot;
    HEAD_UNIFORMS.uHasFace.value = 1.0;
  }, [snapshot]);

  // Also handle camera-denied: update uHasFace to 0 (show skin tone only)
  useEffect(() => {
    if (status === "denied") HEAD_UNIFORMS.uHasFace.value = 0.0;
  }, [status]);

  return (
    <group>
      {CHAIR_X.map((_, i) => (
        <StickFigure
          key={i}
          index={i}
          activatedRef={activatedRef}
        />
      ))}
    </group>
  );
}
