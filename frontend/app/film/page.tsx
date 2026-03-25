'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, Html, Environment, Sparkles, ScrollControls, useScroll, PresentationControls } from '@react-three/drei';
import * as THREE from 'three';
import { X, MapPin, Film, Clapperboard, Calendar } from 'lucide-react';

// --- CONFIGURACIÓN DE ESTILOS Y DATOS MOCK ---
const COLORS = {
  bg: '#020617', // slate-950
  film: '#111111', // Casi negro
  sprocket: '#000000', // Negro puro para los huecos
  text: '#f1f5f9', // slate-100
  accent: '#f97316', // orange-500
  accent2: '#ef4444', // red-500
  glass: 'rgba(15, 23, 42, 0.6)', // slate-900/60
  border: 'rgba(255, 255, 255, 0.08)'
};

const MOCK_PROYECTOS = [
  { id: 1, titulo: 'Ecos del Beagle', tipo: 'Largometraje', ciudad: 'Ushuaia', año: 2024, descripcion: 'Thriller ambientado en el canal. Una desaparición misteriosa une a un pescador local y a una bióloga marina en una búsqueda desesperada.' },
  { id: 2, titulo: 'La Bahía Silenciosa', tipo: 'Cortometraje', ciudad: 'Ushuaia', año: 2023, descripcion: 'Drama poético sobre la soledad y la conexión en los paisajes helados del Fin del Mundo. Ganador del festival TDF Cine.' },
  { id: 3, titulo: 'Oro Fueguino', tipo: 'Documental', ciudad: 'Río Grande', año: 2024, descripcion: 'La historia no contada de los buscadores de oro en el norte de la isla y el impacto ambiental y social que dejaron.' },
  { id: 4, titulo: 'Viento Sur', tipo: 'Serie TV', ciudad: 'Tolhuin', año: 2025, descripcion: 'Una serie antológica sobre misterios y leyendas locales en el corazón de la isla de Tierra del Fuego. Estreno en plataformas.' },
  { id: 5, titulo: 'Glaciar Vinciguerra', tipo: 'Corto Estudiantil', ciudad: 'Ushuaia', año: 2023, descripcion: 'Un viaje visual y sonoro hacia las cuevas de hielo, explorando el cambio climático desde la perspectiva de jóvenes fueguinos.' },
  { id: 6, titulo: 'Horizonte de Fuego', tipo: 'Publicidad', ciudad: 'Río Grande', año: 2024, descripcion: 'Campaña de turismo internacional destacando la belleza cruda y la infraestructura industrial del norte de la provincia.' },
  { id: 7, titulo: 'Memorias de Tolhuin', tipo: 'Documental', ciudad: 'Tolhuin', año: 2022, descripcion: 'Relatos de los primeros pobladores de la localidad, fusionando material de archivo con entrevistas actuales.' },
];

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE: FOTOGRAMA DE PELÍCULA (Procedimental)
   Renderiza un marco de celuloide con orificios geométricos.
═══════════════════════════════════════════════════════════════ */
function FilmFrame({ proyecto, position, rotation, onSelect, active, index }) {
  const [hovered, setHover] = useState(false);
  
  // Geometría del marco principal (Proporción 3:2 tipo póster)
  const frameWidth = 3;
  const frameHeight = 4.5;
  const borderSize = 0.25;

  // Renderizar orificios procedimentales (Sprocket Holes)
  const sprocketHoles = useMemo(() => {
    const holes = [];
    const numHoles = 6; // Por lado
    const holeSize = 0.12;
    const holeYStart = frameHeight / 2 - borderSize / 2;
    const holeYStep = (frameHeight - borderSize) / (numHoles - 1);

    for (let side = 0; side < 2; side++) {
      const x = (side === 0 ? -1 : 1) * (frameWidth / 2 - borderSize / 2);
      for (let i = 0; i < numHoles; i++) {
        const y = holeYStart - i * holeYStep;
        holes.push(
          <mesh key={`hole-${side}-${i}`} position={[x, y, 0.01]}>
            <planeGeometry args={[holeSize, holeSize]} />
            <meshBasicMaterial color={COLORS.sprocket} transparent opacity={0.8} />
          </mesh>
        );
      }
    }
    return holes;
  }, []);

  return (
    <group 
      position={position} 
      rotation={rotation}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto'; }}
    >
      {/* 1. Base negra de la película */}
      <mesh receiveShadow castShadow>
        <planeGeometry args={[frameWidth, frameHeight]} />
        <meshStandardMaterial color={COLORS.film} roughness={0.8} metalness={0.2} />
      </mesh>

      {/* 2. Área del póster (Inner frame) */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[frameWidth - borderSize * 2, frameHeight - borderSize * 2]} />
        <meshStandardMaterial color={hovered || active ? COLORS.accent : '#222222'} roughness={0.5} />
      </mesh>
      
      {/* Icono si no hay foto */}
      {!proyecto.foto && (
         <mesh position={[0, 0, 0.02]} rotation={[0,0,Math.PI/2]}>
           <Text fontSize={0.8} color="#444444">FILM TDF</Text>
         </mesh>
      )}

      {/* 3. Orificios procedimentales */}
      {sprocketHoles}

      {/* 4. Título vertical en el borde */}
      <Text
        position={[-frameWidth / 2 + borderSize / 2, 0, 0.02]}
        rotation={[0, 0, Math.PI / 2]}
        fontSize={0.15}
        color={COLORS.text}
        anchorX="center"
    
      >
        {proyecto.titulo.toUpperCase()}
      </Text>
      
      {/* Índice en el borde */}
      <Text
        position={[frameWidth / 2 - borderSize / 2, -frameHeight / 2 + borderSize / 2, 0.02]}
        fontSize={0.12}
        color={COLORS.text}
        opacity={0.5}
      >
        TDF / {index + 1}
      </Text>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE: ESCENA DE LA CINTA DE CELULOIDE
   Maneja el layout curvo, el scroll y el zoom de cámara.
═══════════════════════════════════════════════════════════════ */
function FilmStripScene({ setStats, onSelectedNode }) {
  const scroll = useScroll();
  const { camera } = useThree();
  const [activeId, setActiveId] = useState<number | null>(null);

  // 1. Crear el camino curvo (Camino de la cámara/película)
  const curve = useMemo(() => {
    const points = MOCK_PROYECTOS.map((_, i) => {
      // Crear una espiral hacia abajo y hacia el fondo
      const angle = i * 0.8;
      const radius = 10;
      return new THREE.Vector3(
        Math.cos(angle) * radius,
        -i * 5, // Baja 5 unidades por proyecto
        Math.sin(angle) * radius
      );
    });
    // Puntos extra al inicio y final para suavizar
    const start = points[0].clone().add(new THREE.Vector3(0, 10, 5));
    const end = points[points.length-1].clone().add(new THREE.Vector3(5, -10, -5));
    return new THREE.CatmullRomCurve3([start, ...points, end]);
  }, []);

  // Calcular posiciones de fotogramas a lo largo de la curva
  const framePositions = useMemo(() => {
    return MOCK_PROYECTOS.map((_, i) => {
      // Obtenemos un punto en la curva ligeramente desplazado del índice para la cámara
      const t = (i + 1) / (MOCK_PROYECTOS.length + 1);
      const pos = curve.getPoint(t);
      // Calcular tangente para orientar el fotograma
      const tangent = curve.getTangent(t);
      const rotation = new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent)
      );
      return { pos, rotation };
    });
  }, [curve]);

  // Actualizar estadísticas al montar
  useEffect(() => {
    setStats({ total: MOCK_PROYECTOS.length, años: [...new Set(MOCK_PROYECTOS.map(p => p.año))].length });
  }, [setStats]);

  // Lógica de Scroll y Cámara (useFrame)
  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    
    // Si hay un nodo seleccionado, la cámara se congela frente a él
    if (activeId !== null) {
      const selectedIndex = MOCK_PROYECTOS.findIndex(p => p.id === activeId);
      const { pos, rotation } = framePositions[selectedIndex];
      
      // Posición objetivo de la cámara (Frente al fotograma)
      const camTargetPos = pos.clone().add(new THREE.Vector3(Math.sin(rotation.y)*6, 0, Math.cos(rotation.y)*6));
      camera.position.lerp(camTargetPos, delta * 5);
      
      // Suavizar rotación de cámara para mirar al centro del fotograma
      const lookAtQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), pos.clone().sub(camTargetPos).normalize());
      camera.quaternion.slerp(lookAtQuat, delta * 5);
      return;
    }

    // LÓGICA DE SCROLL NORMAL
    const scrollOffset = scroll.offset; // 0 a 1
    // La cámara viaja a lo largo de la curva basándose en el scroll
    const camT = scrollOffset * 0.9 + 0.05; // Mantenemos un margen al inicio/final
    const camPos = curve.getPoint(camT);
    
    // La cámara mira un poco más adelante en la curva para suavizar el viaje
    const lookT = Math.min(1, camT + 0.05);
    const lookAtPos = curve.getPoint(lookT);

    // Movimiento suave de cámara (lerp)
    camera.position.lerp(camPos, delta * 3);
    
    // Suavizar rotación de cámara
    const currentLookAt = new THREE.Vector3();
    camera.getWorldDirection(currentLookAt);
    currentLookAt.add(camera.position); // Punto actual que mira
    currentLookAt.lerp(lookAtPos, delta * 4); // Lerp hacia el nuevo punto
    camera.lookAt(currentLookAt);
    
    // Añadir sutil "bamboleo" para sensación de viaje
    camera.position.y += Math.sin(time * 0.5) * 0.05;
    camera.position.x += Math.cos(time * 0.3) * 0.05;
  });

  const handleSelect = (id) => {
    if (activeId === id) {
      setActiveId(null);
      onSelectedNode(null);
    } else {
      setActiveId(id);
      const proyecto = MOCK_PROYECTOS.find(p => p.id === id);
      onSelectedNode(proyecto || null);
    }
  };

  return (
    <group>
      {/* 1. Fotogramas de película dispuestos en la curva */}
      {MOCK_PROYECTOS.map((proyecto, i) => {
        const { pos, rotation } = framePositions[i];
        return (
          <FilmFrame
            key={proyecto.id}
            proyecto={proyecto}
            position={pos}
            // Rotar fotogramas para que "miren" hacia afuera de la espiral
            rotation={[rotation.x, rotation.y + Math.PI / 2, rotation.z]}
            onSelect={() => handleSelect(proyecto.id)}
            active={activeId === proyecto.id}
            index={i}
          />
        );
      })}

      {/* 2. Partículas flotantes para atmósfera */}
      <Sparkles count={200} scale={25} size={1} speed={0.2} color={COLORS.accent} opacity={0.3} />
      <Sparkles count={100} scale={30} size={1} speed={0.1} color={COLORS.accent2} opacity={0.2} />
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════
   UI PANELS (HTML/Tailwind)
   Glassmorphism overlay panels.
═══════════════════════════════════════════════════════════════ */
function GlassPanel({ children, className = '' }) {
  return (
    <div className={`backdrop-blur-xl rounded-3xl border border-white/5 shadow-2xl p-6 ${className}`} style={{ background: COLORS.glass }}>
      {children}
    </div>
  );
}

function NodeDetailsPanel({ node, onClose }) {
  if (!node) return null;
  return (
    <Html transform occlude>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-auto" style={{ opacity: 1 }}>
        <GlassPanel className="w-[450px] max-h-[90vh] flex flex-col relative border-orange-500/20 shadow-orange-950/20">
          
          <button onClick={onClose} className="absolute top-5 right-5 text-slate-500 hover:text-white transition-colors">
            <X size={24} />
          </button>

          <div className="mb-6">
             <div className="bg-slate-800 rounded-2xl w-full h-48 mb-5 flex items-center justify-center overflow-hidden border border-white/5">
                 {node.foto ? (
                   <img src={node.foto} alt="Portada" className="w-full h-full object-cover" />
                 ) : (
                   <Film size={64} className="text-slate-600" />
                 )}
              </div>
              <div className="flex items-center gap-3 mb-2">
                 <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold tracking-widest uppercase">
                    <Clapperboard size={12}/> {node.tipo}
                 </span>
                 <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-white/5 text-slate-400 text-xs font-mono">
                    <Calendar size={12}/> Año {node.año}
                 </span>
              </div>
              <h2 className="text-3xl font-black text-white mb-3 tracking-tighter leading-tight">{node.titulo}</h2>
              <p className="text-slate-400 text-sm leading-relaxed overflow-y-auto max-h-40 pr-2 scrollbar-thin">{node.descripcion || "Sin sinopsis disponible."}</p>
          </div>

          <div className="border-t border-white/5 pt-5 mt-auto flex items-center justify-between gap-4">
             <p className="text-sm text-slate-500 flex items-center gap-2 font-medium">
               <MapPin size={16} className="text-emerald-500"/> Tierra del Fuego · {node.ciudad}
             </p>
             <button className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-lg shadow-orange-950/30 text-sm">
               Ver Proyecto Completo
             </button>
          </div>
        </GlassPanel>
      </div>
    </Html>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL (EXPORT)
═══════════════════════════════════════════════════════════════ */
export default function ProyectosPeliculaPage() {
  const [loading, setLoading] = useState(true); // Simulamos carga
  const [stats, setStats] = useState({ total: 0, años: 0 });
  const [selectedNode, setSelectedNode] = useState<any>(null);

  useEffect(() => {
    // Simular carga para animación inicial
    setTimeout(() => setLoading(false), 1200);
  }, []);

  return (
    <div className="h-screen w-full relative overflow-hidden" style={{ background: COLORS.bg }}>
      
      {/* 1. HUD OVERLAY (Fixed HTML) */}
      <div className="absolute top-0 left-0 w-full p-8 z-30 pointer-events-none flex items-start justify-between select-none">
        <div>
           <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-orange-500 text-xs font-bold tracking-widest uppercase mb-4">
              <Film size={14} />
              CINTA CELULOIDE INFINITA
           </div >
           <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-none mb-1">
              CARTELERA TDF
           </h1>
           <p className="text-slate-500 text-sm">Viaja a través de las producciones audiovisual de Tierra del Fuego.</p>
        </div>
        
        {!loading && (
          <GlassPanel className="text-center p-4 flex gap-6 pointer-events-auto">
             <div>
                <p className="text-4xl font-black text-white tracking-tight">{stats.total}</p>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Proyectos</p>
             </div>
             <div className="border-l border-white/5"/>
             <div>
                <p className="text-4xl font-black text-orange-400 tracking-tight">{stats.años}</p>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Años Prod.</p>
             </div>
          </GlassPanel>
        )}
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 text-center select-none pointer-events-none opacity-60">
         <p className="text-slate-600 font-mono text-xs uppercase tracking-[0.4em]">Usa la rueda del ratón para viajar</p>
         <p className="text-slate-700 text-[10px] mt-1">Tierra del Fuego · Film Commission</p>
      </div>

      {/* 2. LOADING SCREEN */}
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: COLORS.bg }}>
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"/>
            <p className="text-slate-500 text-sm animate-pulse tracking-widest uppercase font-bold">Iniciando viaje...</p>
          </div>
        </div>
      )}

      {/* 3. CANVAS 3D */}
      <Canvas shadows camera={{ fov: 60, position: [0, 0, 10] }}>
        
        {/* Iluminación atmosférica dramática */}
        <ambientLight intensity={0.15} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color={COLORS.accent} castShadow />
        <spotLight position={[-10, 20, 0]} angle={0.2} penumbra={1} intensity={1} color={COLORS.accent2} castShadow />
        <pointLight position={[0, -20, 5]} intensity={0.8} color="#00ffff" />

        {/* Lógica de Scroll */}
        <ScrollControls pages={MOCK_PROYECTOS.length * 1.5} damping={0.2} infinite={false}>
          <FilmStripScene setStats={setStats} onSelectedNode={setSelectedNode} />
        </ScrollControls>
        
        {/* Panel de Detalles (Solo 1 activo a la vez) */}
        {selectedNode && (
          <PresentationControls enabled global rotation={[0, 0, 0]} polar={[-0.1, 0.1]} azimuth={[-0.2, 0.2]}>
            <group position={selectedNode.pos} rotation={[selectedNode.rotation.x, selectedNode.rotation.y + Math.PI / 2, selectedNode.rotation.z]}>
              <mesh position={[1, 0, 0]}> {/* Offset del fotograma */}
                <NodeDetailsPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
              </mesh>
            </group>
          </PresentationControls>
        )}

        {/* Niebla para profundidad */}
        <fog attach="fog" args={[COLORS.bg, 10, 40]} />
        <Environment preset="night" />
      </Canvas>
    </div>
  );
}