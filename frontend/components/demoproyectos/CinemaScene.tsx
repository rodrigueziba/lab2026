'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Stars } from '@react-three/drei';
import type { Proyecto } from '@/types/proyecto';
import Screen from './Screen';

interface CinemaSceneProps {
  proyectos: Proyecto[];
}

function screenPosition(i: number): [number, number, number] {
  const row = Math.floor(i / 3);
  const col = i % 3;
  return [col * 4 - 4, -row * 3, -row * 2 - col * 0.35];
}

export default function CinemaScene({ proyectos }: CinemaSceneProps) {
  if (proyectos.length === 0) return null;

  return (
    <div className="w-full h-[min(80vh,720px)] min-h-[320px] rounded-2xl border border-slate-800 overflow-hidden bg-black">
      <Canvas
        camera={{ position: [0, 0.5, 10], fov: 55 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#020202']} />
        <ambientLight intensity={0.35} />
        <pointLight position={[0, 6, 6]} intensity={2.2} />
        <spotLight
          position={[0, 8, 4]}
          angle={0.45}
          penumbra={0.4}
          intensity={18}
          castShadow={false}
        />
        <Suspense fallback={null}>
          <Environment preset="city" />
        </Suspense>
        <Stars radius={120} depth={60} count={1800} factor={3} fade speed={0.4} />
        <Suspense fallback={null}>
          {proyectos.map((p, i) => (
            <Screen key={p.id} proyecto={p} position={screenPosition(i)} index={i} />
          ))}
        </Suspense>
        <OrbitControls
          enableZoom={true}
          enablePan={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.9}
          minDistance={5}
          maxDistance={22}
          target={[0, -2, -4]}
        />
      </Canvas>
    </div>
  );
}
