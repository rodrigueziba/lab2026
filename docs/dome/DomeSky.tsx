"use client";
// DomeSky.tsx — domo 360 con portal de atardecer, tunel de anillos y cordillera.
// Cargar con dynamic(() => import("./DomeSky"), { ssr: false }) o dentro de un <Canvas> ya en cliente.
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { domeVert, domeFrag } from "./domeShaders";

export type Bands = { bass: number; lowMid: number; highMid: number; treble: number }; // 0..1

type Props = {
  /** Devuelve las 4 bandas ya normalizadas (0..1). Se llama una vez por frame, sin crear estado de React. */
  getBands: () => Bands;
  /** Giro horizontal del portal en radianes (0 = frente a -Z). */
  portalAzimuth?: number;
  /** Elevacion del centro del portal sobre el horizonte, en radianes. */
  portalElevation?: number;
  /** Semi-angulo horizontal de la imagen del portal, en grados (tan() se pasa al shader). */
  portalHalfFovDeg?: number;
  radius?: number;
  warp?: number;       // intensidad base del domain warp
  ringFlow?: number;   // velocidad de flujo de los anillos
  ringScale?: number;  // multiplicador del periodo de anillos
  ringFade?: [number, number];
  starCut?: number;    // 0.93..0.995, mas alto = menos estrellas
  lowQuality?: boolean;
};

// Suavizado con ataque rapido y caida lenta (se siente mejor que seguir la señal cruda).
function smooth(prev: number, target: number, dt: number) {
  const rate = target > prev ? 18 : 5;
  return prev + (target - prev) * (1 - Math.exp(-rate * dt));
}

export default function DomeSky({
  getBands,
  portalAzimuth = 0,
  portalElevation = 0.58,
  portalHalfFovDeg = 42,
  radius = 100,
  warp = 1,
  ringFlow = 0.03,
  ringScale = 1,
  ringFade = [1.0, 1.6],
  starCut = 0.965,
  lowQuality = false,
}: Props) {
  const [masks, color] = useTexture(["/portal/portal-masks.png", "/portal/portal-color.png"]);
  masks.colorSpace = THREE.NoColorSpace; // son datos / colores ya en sRGB: el shader no hace conversion
  color.colorSpace = THREE.NoColorSpace;
  masks.anisotropy = color.anisotropy = 4;

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: domeVert,
        fragmentShader: domeFrag,
        side: THREE.BackSide,
        depthWrite: false,
        defines: lowQuality ? { LOW_QUALITY: "" } : {},
        uniforms: {
          uTime: { value: 0 },
          uBands: { value: new THREE.Vector4() },
          uMasks: { value: masks },
          uColor: { value: color },
          uPortalF: { value: new THREE.Vector3() },
          uPortalR: { value: new THREE.Vector3() },
          uPortalU: { value: new THREE.Vector3() },
          uPortalTan: { value: 1 },
          uWarp: { value: warp },
          uRingFlow: { value: ringFlow },
          uRingScale: { value: ringScale },
          uRingFade: { value: new THREE.Vector2(...ringFade) },
          uStarCut: { value: starCut },
        },
      }),
    // los uniformes sueltos se actualizan en useFrame; el material solo se recrea si cambia la calidad
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [masks, color, lowQuality]
  );

  const tmp = useMemo(() => ({ F: new THREE.Vector3(), R: new THREE.Vector3(), U: new THREE.Vector3(), b: [0, 0, 0, 0] }), []);

  useFrame((state, dt) => {
    const u = material.uniforms;
    const raw = getBands();
    const b = tmp.b;
    b[0] = smooth(b[0], raw.bass, dt);
    b[1] = smooth(b[1], raw.lowMid, dt);
    b[2] = smooth(b[2], raw.highMid, dt);
    b[3] = smooth(b[3], raw.treble, dt);
    u.uBands.value.set(b[0], b[1], b[2], b[3]);
    u.uTime.value = state.clock.elapsedTime;

    const { F, R, U } = tmp;
    const ce = Math.cos(portalElevation), se = Math.sin(portalElevation);
    F.set(Math.sin(portalAzimuth) * ce, se, -Math.cos(portalAzimuth) * ce);
    R.set(Math.cos(portalAzimuth), 0, Math.sin(portalAzimuth));
    U.crossVectors(R, F);
    u.uPortalF.value.copy(F);
    u.uPortalR.value.copy(R);
    u.uPortalU.value.copy(U);
    u.uPortalTan.value = Math.tan((portalHalfFovDeg * Math.PI) / 180);
    u.uWarp.value = warp;
    u.uRingFlow.value = ringFlow;
    u.uRingScale.value = ringScale;
    u.uRingFade.value.set(ringFade[0], ringFade[1]);
    u.uStarCut.value = starCut;
  });

  // La esfera debe estar centrada en el espectador (la camara queda en el origen).
  return (
    <mesh material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[radius, 64, 32]} />
    </mesh>
  );
}
