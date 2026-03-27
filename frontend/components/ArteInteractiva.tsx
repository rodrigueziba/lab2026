"use client";

import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls, Edges, Environment, Stars,SpotLight } from "@react-three/drei";
import * as THREE from "three";

const RayosArcoiris = () => {
    const colores = ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#00ffea", "#8b00ff"];
    
    // Guardamos referencias a las MALLAS para cambiar su escala
    const meshRefs = useRef<Array<THREE.Mesh | null>>([]);
    const materialsRef = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
    const activo = useRef(false);
  
    useEffect(() => {
      // --- LÓGICA DE SINCRONIZACIÓN PERFECTA ---
      // Escuchamos el evento de llegada del Prisma
      const handlePrismaArrived = () => {
        activo.current = true;
      };
      
      // Escuchamos 'prisma-llego-abajo', NO 'activar-prisma'
      window.addEventListener("prisma-llego-abajo", handlePrismaArrived);
      return () => window.removeEventListener("prisma-llego-abajo", handlePrismaArrived);
    }, []);
  
    useFrame((state) => {
      if (!activo.current) return;
  
      // --- EFECTOS DINÁMICOS DE LUZ ---
      const time = state.clock.getElapsedTime();
      const speed = 0.015; // Velocidad del escalado (Fade-in)
  
      meshRefs.current.forEach((mesh, i) => {
        if (mesh) {
          // 1. Efecto "Shooting": El rayo crece hacia adelante
          // Escalamos en el eje Z de 0 a 1 suavemente
          const currentScaleZ = mesh.scale.z;
          mesh.scale.z = THREE.MathUtils.lerp(currentScaleZ, 1, speed);
  
          // 2. Efecto Flicker (Pulsación): Variamos levemente la intensidad
          // Usamos una función Seno rápida
          const mat = materialsRef.current[i];
          if (mat) {
            const flicker = Math.sin(time * 30 + i * 5) * 0.1; // Pulsación sutil
            mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0.6 + flicker, speed);
          }
        }
      });
    });
  
    return (
      // Posición exacta del Prisma abajo
      <group position={[0, 1.6, 0]} rotation={[0, Math.PI / 2, 0]}>
       {colores.map((color, i) => (
        // Aumenté el multiplicador de 0.06 a 0.15 para que se abran mucho más en la pared
        <group key={color} rotation={[0, (i - 2.5) * 0.15, 0]}>
          <mesh 
            ref={(el) => (meshRefs.current[i] = el)} 
            position={[0, 0, -10]} 
            rotation={[Math.PI / 2, 0, 0]} 
            scale={[1, 1, 0]} 
          >
            {/* Los hice un pelín más gruesos (0.015) */}
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
    const targetY = useRef(50); // Altura inicial en el techo
    const hasArrived = useRef(false); // Bandera para no disparar el evento mil veces
  
    useEffect(() => {
      // Escucha el evento del Player para empezar a bajar
      const handleActivate = () => {
        targetY.current = 1.6; // Altura de los ojos
      };
      window.addEventListener("activar-prisma", handleActivate);
      return () => window.removeEventListener("activar-prisma", handleActivate);
    }, []);
  
    useFrame((state) => {
      if (groupRef.current) {
        // Rotación suave (Mantenemos la visión original)
        groupRef.current.rotation.y += 0.005;
  
        // Movimiento vertical suave (LERP)
        const currentY = groupRef.current.position.y;
        const newY = THREE.MathUtils.lerp(currentY, targetY.current, 0.015); // Suavizamos más la bajada
        groupRef.current.position.y = newY;
  
        // --- TRUCO DE SINCRONIZACIÓN ---
        // Si la posición actual es MUY cercana al objetivo (targetY) y no hemos avisado...
        if (!hasArrived.current && Math.abs(currentY - 1.6) < 0.05) {
          hasArrived.current = true; // Marcamos como llegado
          
          // Avisamos globalmente que el Prisma llegó abajo
          window.dispatchEvent(new CustomEvent("prisma-llego-abajo"));
          // Opcional: Sonido de llegada
        }
      }
    });
  
    return (
      <group ref={groupRef} position={[0, 50, 0]}>
        {/* Geometría de Pirámide Perfecta */}
        <mesh rotation={[0, 0, 0]} castShadow>
          <coneGeometry args={[1.5, 2, 3]} />
          
          {/* Usamos meshPhysicalMaterial, que es más avanzado */}
          <meshPhysicalMaterial
            transparent
            transmission={0.98} // 98% de transmisión de luz
            roughness={0.01} // Superficie casi líquida
            thickness={3} // Grosor exagerado para la refracción
            ior={1.6} // Índice de refracción alto (Cristal óptico)
            clearcoat={1} // Capa de barniz tipo espejo
            clearcoatRoughness={0}
            envMapIntensity={1} // Vital para los reflejos
            color="#d0edff" // Tinte sutil azul de cristal grueso
          />
          
          {/* Mantenemos el contorno pero muy sutil y azulado */}
          <Edges scale={1.001} threshold={1} color="#5daaff" transparent opacity={0.15} />
        </mesh>
      </group>
    );
  };

const sillasPos = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5];



const Escenario = () => {
  return (
    <group>
      {/* Luz volumétrica cinematográfica */}
      <SpotLight
        position={[8, 15, 8]} // Bien arriba y en diagonal
        color="#ffffff"
        intensity={2000} // Mucha fuerza para vencer la oscuridad del espacio
        distance={40}
        angle={0.4}
        penumbra={0.8}
        attenuation={5}
        anglePower={4} // Esto crea el efecto de "polvo flotando" en el haz
        castShadow
      />

      {/* Las 6 sillas (Placeholders) */}
      {sillasPos.map((x, index) => (
        <mesh key={index} position={[x, 0.25, -2]} castShadow>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.9} />
        </mesh>
      ))}
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
    // 1. Estado de las teclas
    const keys = useRef<Keys>({ w: false, a: false, s: false, d: false });
  
    // 2. Estado de los Triggers (Zonas)
    const hasTriggered = useRef(false);
    const zonaLuz = new THREE.Vector3(0, 1.6, 0);    // Coordenada del haz de luz
    const zonaSillas = new THREE.Vector3(0, 1.6, -5); // Coordenada de las sillas
  
    // 3. Setup de la cámara (Posición inicial)
    const { camera } = useThree();
    useEffect(() => {
      camera.position.set(-10, 1.6, -7); // Empezamos 5 metros hacia atrás para ver todo
    }, [camera]);
  
    // 4. Listeners del teclado
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
  
    // 5. Bucle de animación (Frames)
    useFrame((state) => {
        const speed = 0.15;
        const cam = state.camera;
    
        // 1. Obtener hacia dónde mira la cámara en el mundo real
        const frontVector = new THREE.Vector3();
        cam.getWorldDirection(frontVector);
        frontVector.y = 0; // Anulamos la Y para no volar cuando miramos arriba/abajo
        frontVector.normalize();
    
        // 2. Calcular el vector lateral cruzando el frente con el eje "Arriba" (Y)
        const sideVector = new THREE.Vector3();
        sideVector.crossVectors(cam.up, frontVector).normalize();
    
        // 3. Crear el vector de dirección sumando/restando según qué tecla se aprieta
        const direction = new THREE.Vector3();
        if (keys.current.w) direction.add(frontVector);
        if (keys.current.s) direction.sub(frontVector);
        if (keys.current.d) direction.sub(sideVector);
        if (keys.current.a) direction.add(sideVector);
    
        // 4. Si hay movimiento, normalizamos para que caminar en diagonal no sea el doble de rápido
        if (direction.lengthSq() > 0) {
          direction.normalize().multiplyScalar(speed);
          cam.position.add(direction);
        }
        
        // Mantiene la cabeza clavada a 1.6m del suelo
        cam.position.y = 1.6; 
    
        // --- LÓGICA DE TRIGGERS ---
        if (!hasTriggered.current) {
            const distanceToZonaLuz = cam.position.distanceTo(zonaLuz);
            const distanceToZonaSillas = cam.position.distanceTo(zonaSillas);
    
            if (distanceToZonaLuz < 2) { // Aumenté un poco el radio a 2 metros para que sea más fácil activarlo
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

{/* EL ENTORNO DE ESPACIO PARA LOS REFLEJOS (No se ve directamente, solo lo ve el cristal) */}
<Environment background={false} resolution={512}>
  {/* Fondo negro para el espacio */}
  <mesh scale={100}>
    <sphereGeometry args={[1, 64, 64]} />
    <meshBasicMaterial side={THREE.BackSide} color="#000000" />
  </mesh>
  {/* Las estrellas que se reflejarán en las caras del prisma */}
  <Stars radius={10} depth={50} count={3000} factor={4} saturation={1} fade speed={2} />
        
        {/* Truco: Esferas de luz de colores flotando en la nada para simular el brillo de nebulosas en el cristal */}
        <mesh position={[20, 20, -20]}>
          <sphereGeometry args={[10, 32, 32]} />
          <meshBasicMaterial color="#4400ff" /> {/* Nebulosa azul/violeta */}
        </mesh>
        <mesh position={[-20, -20, -20]}>
          <sphereGeometry args={[10, 32, 32]} />
          <meshBasicMaterial color="#ff0044" /> {/* Nebulosa magenta */}
        </mesh>
      </Environment>
      {/* <Stars radius={50} depth={50} count={5000} factor={4} saturation={0} fade speed={1} /> */}

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
