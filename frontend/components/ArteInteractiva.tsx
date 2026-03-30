"use client";

import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls, Edges, Environment, Stars, SpotLight } from "@react-three/drei";
import * as THREE from "three";

const RayosArcoiris = () => {
  const colores = ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#00ffea", "#8b00ff"];
  
  const meshRefs = useRef<Array<THREE.Mesh | null>>([]);
  const materialsRef = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
  const activo = useRef(false);

  useEffect(() => {
    const handlePrismaArrived = () => {
      activo.current = true;
    };
    window.addEventListener("prisma-llego-abajo", handlePrismaArrived);
    return () => window.removeEventListener("prisma-llego-abajo", handlePrismaArrived);
  }, []);

  useFrame((state) => {
    if (!activo.current) return;
    const time = state.clock.getElapsedTime();
    const speed = 0.015; 

    meshRefs.current.forEach((mesh, i) => {
      if (mesh) {
        const currentScaleZ = mesh.scale.z;
        mesh.scale.z = THREE.MathUtils.lerp(currentScaleZ, 1, speed);

        const mat = materialsRef.current[i];
        if (mat) {
          const flicker = Math.sin(time * 30 + i * 5) * 0.1;
          mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0.6 + flicker, speed);
        }
      }
    });
  });

  return (
    <group position={[0, 1.6, 0]} rotation={[0, Math.PI / 2, 0]}>
      {colores.map((color, i) => (
        <group key={color} rotation={[0, (i - 2.5) * 0.15, 0]}>
          <mesh 
            ref={(el) => (meshRefs.current[i] = el)} 
            position={[0, 0, -10]} 
            rotation={[Math.PI / 2, 0, 0]} 
            scale={[1, 1, 0]} 
          >
            <cylinderGeometry args={[0.015, 0.2, 20, 12]} />
            <meshBasicMaterial 
              ref={(el) => (materialsRef.current[i] = el)}
              color={color} 
              transparent={true}
              opacity={0} 
              depthWrite={false} 
              blending={THREE.AdditiveBlending} 
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const Prisma = () => {
  const groupRef = useRef<THREE.Group>(null);
  const targetY = useRef(50);
  const hasArrived = useRef(false);

  useEffect(() => {
    const handleActivate = () => {
      targetY.current = 1.6;
    };
    window.addEventListener("activar-prisma", handleActivate);
    return () => window.removeEventListener("activar-prisma", handleActivate);
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.005;

      const currentY = groupRef.current.position.y;
      const newY = THREE.MathUtils.lerp(currentY, targetY.current, 0.015);
      groupRef.current.position.y = newY;

      if (!hasArrived.current && Math.abs(currentY - 1.6) < 0.05) {
        hasArrived.current = true;
        window.dispatchEvent(new CustomEvent("prisma-llego-abajo"));
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, 50, 0]}>
      <mesh rotation={[0, 0, 0]} castShadow>
        <coneGeometry args={[1.5, 2, 3]} />
        
        {/* EL CRISTAL LÍQUIDO / ÓPTICO */}
        <meshPhysicalMaterial
          transparent={true}
          transmission={1}          // 100% de transmisión (es cristal puro)
          opacity={1}               // Debe estar en 1 para que el transmission funcione
          roughness={0.2}          // Casi pulido perfecto, con un micro-desgaste
          ior={1.50}                // Índice de refracción muy alto (Cristal de Zafiro / Líquido denso)
          thickness={4}             // Grosor masivo para que distorsione fuertemente el fondo
          clearcoat={1}             // Barniz exterior (como si estuviera mojado)
          clearcoatRoughness={0}    // El barniz es un espejo perfecto
          attenuationColor="#ffffff"// El color que toma la luz al viajar por dentro
          attenuationDistance={2}   // Hace que el centro se vea más oscuro y denso
          color="#000000"           // Base oscura para contrastar con los láseres
          envMapIntensity={2}       // Multiplica x2 la fuerza con la que refleja las estrellas
        />
        
        {/* El delineado láser blanco de las aristas */}
        <Edges scale={1.002} threshold={1} color="#ffffff" transparent opacity={0.8} />
      </mesh>
    </group>
  );
};
const sillasPos = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5];

const Escenario = () => {
  return (
    <group>
      {/* Luz ajustada para golpear el piso */}
      <SpotLight
        position={[8, 15, 8]}
        color="#ffffff"
        intensity={3000}
        distance={50}
        angle={0.5}
        penumbra={0.5}
        attenuation={5}
        anglePower={4}
        castShadow
      />

      {sillasPos.map((x, index) => (
        <mesh key={index} position={[x, 0.25, -2]} castShadow>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.9} />
        </mesh>
      ))}

      {/* Piso recuperado */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#111111" roughness={0.8} />
      </mesh>
    </group>
  );
};

interface Keys {
  w: boolean;
  a: boolean;
  s: boolean;
  d: boolean;
}

const Player = () => {
  const keys = useRef<Keys>({ w: false, a: false, s: false, d: false });
  const hasTriggered = useRef(false);
  const zonaLuz = new THREE.Vector3(0, 1.6, 0);
  const zonaSillas = new THREE.Vector3(0, 1.6, -5);
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(-10, 1.6, -7);
  }, [camera]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key in keys.current) {
        keys.current[key as keyof Keys] = true;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key in keys.current) {
        keys.current[key as keyof Keys] = false;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useFrame((state) => {
    const speed = 0.15;
    const cam = state.camera;

    const frontVector = new THREE.Vector3();
    cam.getWorldDirection(frontVector);
    frontVector.y = 0;
    frontVector.normalize();

    const sideVector = new THREE.Vector3();
    sideVector.crossVectors(cam.up, frontVector).normalize();

    const direction = new THREE.Vector3();
    if (keys.current.w) direction.add(frontVector);
    if (keys.current.s) direction.sub(frontVector);
    if (keys.current.d) direction.sub(sideVector);
    if (keys.current.a) direction.add(sideVector);

    if (direction.lengthSq() > 0) {
      direction.normalize().multiplyScalar(speed);
      cam.position.add(direction);
    }
    
    cam.position.y = 1.6;

    if (!hasTriggered.current) {
      const distanceToZonaLuz = cam.position.distanceTo(zonaLuz);
      const distanceToZonaSillas = cam.position.distanceTo(zonaSillas);

      if (distanceToZonaLuz < 2) {
        hasTriggered.current = true;
        console.log("🔥 EVENTO: Usuario eligió la LUZ. Aquí saldrán las 6 personas.");
      } else if (distanceToZonaSillas < 2) {
        hasTriggered.current = true;
        console.log("💿 EVENTO: Usuario eligió las SILLAS. Aquí bajará el Prisma y se conectará la BD.");
        window.dispatchEvent(new CustomEvent('activar-prisma'));
      }
    }
  });

  return null;
};

const ArteInteractiva = () => {
  return (
    <Canvas style={{ width: "100vw", height: "100vh" }} shadows camera={{ position: [-10, 1.6, -7], fov: 110 }}>
      <color attach="background" args={['#020202']} />

      {/* ENTORNO LIMPIO: Solo estrellas nítidas para el reflejo */}
      <Environment background={false} resolution={512}>
        <mesh scale={100}>
          <sphereGeometry args={[1, 64, 64]} />
          <meshBasicMaterial side={THREE.BackSide} color="#000000" />
        </mesh>
        <Stars radius={10} depth={50} count={3000} factor={4} saturation={0} fade speed={2} />
      </Environment>

      <ambientLight intensity={0.2} />

      <Escenario />
      <Prisma />
      <RayosArcoiris />
      <Player />
      <PointerLockControls />
    </Canvas>
  );
};

export default ArteInteractiva;