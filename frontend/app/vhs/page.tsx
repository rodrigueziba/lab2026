'use client';

import { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Html, Environment, ContactShadows, PresentationControls } from '@react-three/drei';
import * as THREE from 'three';
import { X, PlayCircle, MapPin } from 'lucide-react';

interface VhsProyecto {
  id: number;
  titulo: string;
  tipo?: string;
  descripcion?: string;
  ciudad?: string;
  foto?: string;
}

interface VHSTapeProps {
  proyecto: VhsProyecto;
  position: [number, number, number];
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

// --- COMPONENTE CINTA VHS ---
function VHSTape({ proyecto, position, isActive, onSelect, onClose }: VHSTapeProps) {
  const meshRef = useRef<THREE.Group>(null);
  const [hovered, setHover] = useState(false);

  // Animación frame a frame
  useFrame((state, delta) => {
    if (!meshRef.current) return;

    // Posición y rotación objetivo
    let targetPos = new THREE.Vector3(...position);
    let targetRot = new THREE.Euler(0, 0, 0);

    if (isActive) {
      // Si está activo, lo traemos frente a la cámara y rotamos para ver la portada
      targetPos.set(0, 0, 4);
      targetRot.set(0, Math.PI / 2, 0); // Rotamos 90 grados
    } else if (hovered) {
      // Si hay hover, sale un poco del estante
      targetPos.z += 0.8;
    }

    // Suavizado del movimiento (Lerp)
    meshRef.current.position.lerp(targetPos, delta * 6);
    meshRef.current.quaternion.slerp(new THREE.Quaternion().setFromEuler(targetRot), delta * 6);
  });

  // Material de la caja VHS
  const vhsColor = hovered || isActive ? "#f97316" : "#1e293b"; // Naranja si lo tocamos, sino gris oscuro

  return (
    <group
      ref={meshRef}
      position={position}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto'; }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {/* Geometría de la caja (Lomo hacia el frente: Ancho 0.4, Alto 2.2, Profundidad 1.5) */}
      <mesh castShadow>
        <boxGeometry args={[0.4, 2.2, 1.5]} />
        <meshStandardMaterial color={vhsColor} roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Título en el lomo (visible cuando está en el estante) */}
      <Text 
        position={[0, 0, 0.76]} 
        rotation={[0, 0, Math.PI / 2]} // Texto vertical
        fontSize={0.2} 
        color="white" 
        maxWidth={2}
        textAlign="center"
      >
        {proyecto.titulo}
      </Text>

      {/* Detalles HTML superpuestos en la Portada (visible solo cuando está activo) */}
      {isActive && (
        <Html
          position={[0.21, 0, 0]} // Ubicado en la cara lateral (ahora frontal por la rotación)
          transform 
          rotation-y={Math.PI / 2} // Alinear con la cara del 3D
          occlude
        >
          <div className="bg-slate-900 border-2 border-orange-500 rounded-xl p-6 w-[350px] h-[500px] text-white shadow-2xl flex flex-col justify-between" style={{ opacity: 1 }}>
            
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X size={24} />
            </button>

            <div>
              <div className="bg-slate-800 rounded-lg w-full h-40 mb-4 flex items-center justify-center overflow-hidden">
                 {proyecto.foto ? (
                   <img src={proyecto.foto} alt="Portada" className="w-full h-full object-cover opacity-60" />
                 ) : (
                   <PlayCircle size={48} className="text-slate-600" />
                 )}
              </div>
              <p className="text-orange-500 text-xs font-bold tracking-widest uppercase mb-2">{proyecto.tipo}</p>
              <h2 className="text-2xl font-black mb-2 leading-tight">{proyecto.titulo}</h2>
              <p className="text-slate-400 text-sm line-clamp-4">{proyecto.descripcion || "Sin sinopsis disponible."}</p>
            </div>

            <div className="border-t border-slate-700 pt-4 mt-4">
              <p className="text-xs text-slate-400 flex items-center gap-2"><MapPin size={14} className="text-emerald-500"/> {proyecto.ciudad || "Tierra del Fuego"}</p>
              <button className="mt-4 w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-lg transition-colors">
                Ver Proyecto Completo
              </button>
            </div>

          </div>
        </Html>
      )}
    </group>
  );
}

// --- COMPONENTE ESTANTERÍA ---
function Shelf() {
  return (
    <mesh position={[0, -1.2, 0]} receiveShadow>
      <boxGeometry args={[15, 0.1, 2]} />
      <meshStandardMaterial color="#0f172a" roughness={0.9} />
    </mesh>
  );
}

// --- ESCENA PRINCIPAL ---
export default function Proyectos3DPage() {
  const [proyectos, setProyectos] = useState<VhsProyecto[]>([]);
  const [activeProject, setActiveProject] = useState<number | null>(null);

  // Cargar proyectos (Simulado aquí, debes reemplazar con tu fetch real)
  useEffect(() => {
    const fetchProyectos = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/proyecto`);
        const data = await res.json();
        setProyectos(Array.isArray(data) ? (data as VhsProyecto[]) : []);
      } catch (error) {
        console.error("Error cargando proyectos:", error);
      }
    };
    fetchProyectos();
  }, []);

  return (
    <div className="w-full h-screen bg-black relative">
      
      {/* UI Overlay normal (Fuera del Canvas 3D) */}
      <div className="absolute top-0 left-0 w-full p-8 z-10 pointer-events-none">
        <h1 className="text-4xl font-black text-white tracking-tighter">
          VIDEOCLUB <span className="text-orange-500">TDF</span>
        </h1>
        <p className="text-slate-400 text-sm mt-2">Pasa el ratón sobre las cintas. Haz clic para explorar.</p>
      </div>

      {activeProject !== null && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[5] pointer-events-none transition-all duration-500" />
      )}

      {/* CANVAS 3D */}
      <Canvas shadows camera={{ position: [0, 0, 8], fov: 50 }}>
        
        {/* Iluminación tipo cine oscuro */}
        <ambientLight intensity={0.4} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="blue" />

        {/* Permite mover la cámara un poco con el ratón cuando no hay proyecto abierto */}
        <PresentationControls
          enabled={activeProject === null}
          global
          rotation={[0, 0, 0]}
          polar={[-0.1, 0.1]}
          azimuth={[-0.5, 0.5]}
        >
          <group position={[0, 0, -2]}>
            <Shelf />
            {/* Generación de Cintas en la estantería */}
            {proyectos.map((proyecto, index) => {
              // Calcular posición en el estante (espaciado horizontal)
              const startX = -((proyectos.length - 1) * 0.6) / 2; 
              const xPos = startX + (index * 0.6);
              
              return (
                <VHSTape 
                  key={proyecto.id}
                  proyecto={proyecto}
                  position={[xPos, 0, 0]}
                  isActive={activeProject === proyecto.id}
                  onSelect={() => setActiveProject(proyecto.id)}
                  onClose={() => setActiveProject(null)}
                />
              );
            })}
          </group>
        </PresentationControls>

        {/* Sombras y reflejos ambientales */}
        <ContactShadows position={[0, -1.5, 0]} opacity={0.4} scale={20} blur={2} far={4} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}