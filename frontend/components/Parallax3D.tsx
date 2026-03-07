'use client';

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// --- SHADERS (El código que corre en la tarjeta de video) ---
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uImage;
  uniform sampler2D uDepth;
  uniform vec2 uMouse;
  varying vec2 vUv;

  void main() {
    // Leemos qué tan cerca (blanco) o lejos (negro) está esa zona de la foto
    float depth = texture2D(uDepth, vUv).r; 
    
    // Movemos los píxeles basados en el mouse y la profundidad. 
    // El 0.04 define la fuerza del efecto 3D (puedes cambiarlo a tu gusto)
    vec2 displacement = uMouse * depth * 0.04;
    
    vec2 finalUv = vUv - displacement;
    finalUv = clamp(finalUv, 0.0, 1.0); // Evita que la imagen se repita en los bordes
    
    gl_FragColor = texture2D(uImage, finalUv);
  }
`;

function Scene({ imageUrl, depthUrl }: { imageUrl: string, depthUrl: string }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { viewport } = useThree();
  
  const [imageTexture, depthTexture] = useLoader(THREE.TextureLoader, [imageUrl, depthUrl]);

  // Configuramos la escena para que la imagen cubra todo sin deformarse (como object-fit: cover)
  const scaleX = viewport.width;
  const scaleY = viewport.height;
  const imageAspect = imageTexture.image.width / imageTexture.image.height;
  const viewportAspect = viewport.width / viewport.height;
  
  const scale = [
    imageAspect > viewportAspect ? scaleY * imageAspect : scaleX,
    imageAspect > viewportAspect ? scaleY : scaleX / imageAspect,
    1
  ] as [number, number, number];

  const uniforms = useMemo(() => ({
    uImage: { value: imageTexture },
    uDepth: { value: depthTexture },
    uMouse: { value: new THREE.Vector2(0, 0) },
  }), [imageTexture, depthTexture]);

  useFrame((state) => {
    if (materialRef.current) {
      // Movimiento suave del mouse (interpolación lerp)
      materialRef.current.uniforms.uMouse.value.lerp(
        new THREE.Vector2(state.pointer.x, state.pointer.y),
        0.1
      );
    }
  });

  return (
    <mesh scale={scale}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

export default function Parallax3D({ imageUrl, depthUrl }: { imageUrl: string, depthUrl: string }) {
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <Canvas camera={{ position: [0, 0, 1] }}>
        <React.Suspense fallback={null}>
          <Scene imageUrl={imageUrl} depthUrl={depthUrl} />
        </React.Suspense>
      </Canvas>
    </div>
  );
}