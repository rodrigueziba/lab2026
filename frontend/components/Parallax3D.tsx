'use client';

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// --- SHADERS (El mismo código de tarjeta de video) ---
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
  uniform vec2 uTarget;
  varying vec2 vUv;

  void main() {
    float depth = texture2D(uDepth, vUv).r; 
    // Mismo multiplicador 0.04 para mantener la suavidad
    vec2 displacement = uTarget * depth * 0.04; 
    
    vec2 finalUv = vUv - displacement;
    finalUv = clamp(finalUv, 0.0, 1.0); 
    
    gl_FragColor = texture2D(uImage, finalUv);
  }
`;

function Scene({ imageUrl, depthUrl, gyroData }: { imageUrl: string, depthUrl: string, gyroData: React.MutableRefObject<THREE.Vector2 | null> }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { viewport } = useThree();
  
  const [imageTexture, depthTexture] = useLoader(THREE.TextureLoader, [imageUrl, depthUrl]);

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
    uTarget: { value: new THREE.Vector2(0, 0) }, // Cambiamos uMouse por uTarget
  }), [imageTexture, depthTexture]);

  useFrame((state) => {
    if (materialRef.current) {
      let targetX = state.pointer.x;
      let targetY = state.pointer.y;

      // Si tenemos datos del giroscopio (celular), sobrescribimos el mouse
      if (gyroData.current) {
        targetX = gyroData.current.x;
        targetY = gyroData.current.y;
      }

      // Animación fluida hacia el objetivo (mouse o giroscopio)
      materialRef.current.uniforms.uTarget.value.lerp(
        new THREE.Vector2(targetX, targetY),
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
  const gyroData = useRef<THREE.Vector2 | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detectamos de forma básica si es un dispositivo táctil/móvil
    const checkMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setIsMobile(checkMobile);

    // Revisamos si el navegador requiere permisos explícitos (iOS 13+)
    if (checkMobile && typeof window !== 'undefined' && typeof (window as any).DeviceOrientationEvent !== 'undefined') {
      if (typeof (window as any).DeviceOrientationEvent.requestPermission === 'function') {
        setNeedsPermission(true);
      } else {
        // En Android u otros navegadores que no bloquean, lo activamos directo
        startGyro();
      }
    }
    
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  const handleOrientation = (event: DeviceOrientationEvent) => {
    if (event.gamma === null || event.beta === null) return;

    // gamma = inclinación izquierda/derecha (-90 a 90)
    // beta = inclinación adelante/atrás (-180 a 180)
    // Dividimos por 30 para reducir la sensibilidad y que no maree
    let x = event.gamma / 30; 
    let y = (event.beta - 45) / 30; // Restamos 45 asumiendo que miras el celu un poco inclinado

    // Limitamos los valores entre -1 y 1 (igual que el comportamiento del mouse)
    x = Math.max(-1, Math.min(1, x));
    y = Math.max(-1, Math.min(1, y));

    if (!gyroData.current) gyroData.current = new THREE.Vector2();
    // Invertimos el eje Y para que se sienta como asomarse por una ventana
    gyroData.current.set(x, -y);
  };

  const startGyro = () => {
    window.addEventListener('deviceorientation', handleOrientation);
    setNeedsPermission(false);
  };

  const requestAccess = async () => {
    try {
      const permission = await (window as any).DeviceOrientationEvent.requestPermission();
      if (permission === 'granted') {
        startGyro();
      } else {
        alert('Se requiere acceso al sensor de movimiento para el efecto 3D.');
      }
    } catch (error) {
      console.error("Error pidiendo permisos del giroscopio:", error);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <Canvas camera={{ position: [0, 0, 1] }}>
        <React.Suspense fallback={null}>
          <Scene imageUrl={imageUrl} depthUrl={depthUrl} gyroData={gyroData} />
        </React.Suspense>
      </Canvas>

      {/* Botón superpuesto para pedir permisos en iOS */}
      {isMobile && needsPermission && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
          <button 
            onClick={requestAccess}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-full shadow-lg transform transition active:scale-95"
          >
            Activar Movimiento 3D 📱
          </button>
        </div>
      )}
    </div>
  );
}