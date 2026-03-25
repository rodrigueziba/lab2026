'use client';

import { Suspense, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useRouter } from 'next/navigation';
import type { Proyecto } from '@/types/proyecto';
import { proyectoImageUrl } from './proyectoImageUrl';

type Vec3 = [number, number, number];

export interface ScreenProps {
  proyecto: Proyecto;
  position: Vec3;
  index: number;
}

function ScreenFallback({ proyecto, position, index }: ScreenProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { clock } = useThree();

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.position.y = Math.sin(clock.elapsedTime * 0.85 + index * 0.7) * 0.09;
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <planeGeometry args={[3, 1.7]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <Text
        position={[0, -1.15, 0.02]}
        fontSize={0.18}
        maxWidth={2.8}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {proyecto.titulo}
      </Text>
    </group>
  );
}

function ScreenInner({ proyecto, position, index, imageUrl }: ScreenProps & { imageUrl: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const texture = useTexture(imageUrl, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
  });

  const { clock } = useThree();

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    mesh.position.y = Math.sin(t * 0.85 + index * 0.7) * 0.09;
    mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, hovered ? 0.12 : 0, 0.08);
    const s = THREE.MathUtils.lerp(mesh.scale.x, hovered ? 1.08 : 1, 0.08);
    mesh.scale.setScalar(s);
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
        onClick={(e) => {
          e.stopPropagation();
          router.push(`/proyectos/${proyecto.id}`);
        }}
      >
        <planeGeometry args={[3, 1.7]} />
        <meshStandardMaterial
          map={texture}
          emissive={hovered ? new THREE.Color('#ff5500') : new THREE.Color('#000000')}
          emissiveIntensity={hovered ? 0.45 : 0}
          metalness={0.15}
          roughness={0.55}
        />
      </mesh>
      <Text
        position={[0, -1.15, 0.02]}
        fontSize={0.18}
        maxWidth={2.8}
        color="#f8fafc"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {proyecto.titulo}
      </Text>
    </group>
  );
}

/** Pantalla 3D: textura del proyecto + título; hover y click a ficha. */
export default function Screen(props: ScreenProps) {
  const imageUrl = proyectoImageUrl(props.proyecto);
  return (
    <Suspense fallback={<ScreenFallback {...props} />}>
      <ScreenInner {...props} imageUrl={imageUrl} />
    </Suspense>
  );
}
