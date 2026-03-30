'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { 
  DollarSign, GraduationCap, Calendar, 
  X, MapPin, Search, Clapperboard, 
  ChevronLeft, ChevronRight, Plus, Dice5, Filter 
} from 'lucide-react';
import TdfFilmLoader from '@/components/TdfFilmLoader';
import { LiquidBlobs } from '@/components/liquid-glass/LiquidBlobs';
import { ProyectoLiquidCard } from '@/components/liquid-glass/ProyectoLiquidCard';
import { getSectionCache, setSectionCache, SECTION_KEYS } from '@/lib/sectionCache';
import { useLanguage } from '@/contexts/LanguageContext';

const AnycolourBackground = dynamic(() => import('@/components/anycolour'), { ssr: false });

const getYoutubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url?.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const TIPOS = ['Todos', 'Cortometraje', 'Largometraje', 'Documental', 'Videoclip', 'Publicidad'];

const CIUDADES_OPCIONES = [
    { id: 'Todas', label: 'TODAS', short: 'TODOS' },
    { id: 'Ushuaia', label: 'USHUAIA', short: 'USH' },
    { id: 'Río Grande', label: 'RIO GRANDE', short: 'RIO' },
    { id: 'Tolhuin', label: 'TOLHUIN', short: 'TOL' },
];

const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8, y: 50 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      delay: i * 0.05,
      type: "spring",
      stiffness: 100 + Math.random() * 50,
      damping: 10 + Math.random() * 10
    }
  }),
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
};

interface Puesto {
  id: number | string;
  nombre: string;
}

interface ProyectoUser {
  nombre?: string;
}

interface Proyecto {
  id: number;
  titulo: string;
  descripcion: string;
  tipo: string;
  ciudad: string;
  esEstudiante: boolean;
  esRemunerado: boolean;
  fechaInicio?: string;
  foto?: string;
  fotoProfundidad?: string | null;
  galeria?: string[];
  referencias?: string[];
  puestos?: Puesto[];
  user?: ProyectoUser;
  [key: string]: unknown;
}

export default function CarteleraProyectosPage() {
  const { t } = useLanguage();
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [proyectosMostrados, setProyectosMostrados] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('Todos');
  const [filtroCiudad, setFiltroCiudad] = useState('Todas');
  const [filtroEstudiante, setFiltroEstudiante] = useState(false);
  const [filtroRemunerado, setFiltroRemunerado] = useState(false);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // UI
  const [isScrolled, setIsScrolled] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [particleSpeedMultiplier, setParticleSpeedMultiplier] = useState(0.2);
  const lastScrollY = useRef(0);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null); 
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dataLoadedRef = useRef(false);
  const [disable3D, setDisable3D] = useState(false);

  useEffect(() => {
    setDisable3D(typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (dataLoadedRef.current) return;
    const cached = getSectionCache<Proyecto[]>(SECTION_KEYS.proyectos);
    if (cached != null) {
      dataLoadedRef.current = true;
      setProyectos(cached);
      setProyectosMostrados(cached);
      setLoading(false);
      return;
    }
    fetch(`${apiUrl}/proyecto`)
      .then(res => res.json())
      .then(data => {
          if (dataLoadedRef.current) return;
          dataLoadedRef.current = true;
          setProyectos(data);
          setProyectosMostrados(data);
          setSectionCache(SECTION_KEYS.proyectos, data);
          setLoading(false);
      })
      .catch(err => console.error(err));
  }, [apiUrl]);

  useEffect(() => {
    if (!dataLoadedRef.current && proyectos.length === 0) return;
    const filtrados = proyectos.filter(p => {
      const coincideTexto = p.titulo.toLowerCase().includes(busqueda.toLowerCase()) || 
                            p.descripcion.toLowerCase().includes(busqueda.toLowerCase());
      const coincideTipo = filtroTipo === 'Todos' || p.tipo === filtroTipo;
      const coincideCiudad = filtroCiudad === 'Todas' || p.ciudad === filtroCiudad;
      const coincideEstudiante = !filtroEstudiante || p.esEstudiante;
      const coincideRemunerado = !filtroRemunerado || p.esRemunerado;
      
      let coincideFecha = true;
      const fechaProyecto = p.fechaInicio ? new Date(p.fechaInicio).getTime() : 0;
      if (fechaDesde) {
        const desde = new Date(fechaDesde).getTime();
        if (!fechaProyecto || fechaProyecto < desde) coincideFecha = false;
      }
      if (fechaHasta) {
        const hasta = new Date(fechaHasta).getTime();
        if (!fechaProyecto || fechaProyecto > hasta) coincideFecha = false;
      }

      return coincideTexto && coincideTipo && coincideCiudad && coincideEstudiante && coincideRemunerado && coincideFecha;
    });
    setProyectosMostrados(filtrados);
  }, [busqueda, filtroTipo, filtroCiudad, filtroEstudiante, filtroRemunerado, fechaDesde, fechaHasta, proyectos]);

  const handleRandomize = () => {
      const shuffled = [...proyectosMostrados];
      for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      setProyectosMostrados(shuffled);
  };

  // Móvil no-iPhone: agitar el dispositivo reordena las tarjetas (mismo efecto que el botón)
  const lastShakeRef = useRef(0);
  useEffect(() => {
    if (typeof window === 'undefined' || disable3D || window.innerWidth >= 768) return;
    const SHAKE_THRESHOLD = 18;
    const COOLDOWN_MS = 1200;
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const total = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
      if (total > SHAKE_THRESHOLD && Date.now() - lastShakeRef.current > COOLDOWN_MS) {
        lastShakeRef.current = Date.now();
        setProyectosMostrados(prev => {
          const arr = [...prev];
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          return arr;
        });
      }
    };
    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [disable3D]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Escritorio: velocidad del fondo Anycolour según scroll (inicio muy bajo; scroll abajo = más rápido, efecto notable)
  useEffect(() => {
    const update = () => {
      const y = window.scrollY;
      const mult = Math.max(0.2, Math.min(4, 0.2 + y / 250));
      setParticleSpeedMultiplier(mult);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  // Cabecera se disuelve al bajar y reaparece al subir (solo en escritorio, ≥768px)
  // Cabecera se disuelve al bajar y reaparece al subir (escritorio y móvil)
  useEffect(() => {
    const SCROLL_THRESHOLD = 60;
    const DELTA = 8;
    const handleScrollDirection = () => {
      const y = window.scrollY;
      if (y <= SCROLL_THRESHOLD) {
        setHeaderVisible(true);
      } else if (y > lastScrollY.current + DELTA) {
        setHeaderVisible(false);
      } else if (y < lastScrollY.current - DELTA) {
        setHeaderVisible(true);
      }
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', handleScrollDirection, { passive: true });
    window.addEventListener('resize', handleScrollDirection);
    return () => {
      window.removeEventListener('scroll', handleScrollDirection);
      window.removeEventListener('resize', handleScrollDirection);
    };
  }, []);

  const handleMouseEnter = (id: number) => {
    hoverTimerRef.current = setTimeout(() => setHoveredId(id), 600);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredId(null);
  };

  const scrollFilters = (direction: 'left' | 'right') => {
    if (filtersRef.current) {
      const scrollAmount = 300;
      filtersRef.current.scrollBy({ left: direction === 'right' ? scrollAmount : -scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative min-h-screen">
      {/* Fondo Anycolour solo escritorio: misma lógica que /guia; velocidad según scroll; clics para puntos de gravedad */}
      <div className="fixed inset-0 z-0">
        <AnycolourBackground backgroundOnly speedMultiplier={particleSpeedMultiplier} particleCount={1688} />
        <LiquidBlobs />
      </div>

      {/* Contenido encima (z-10); opacidad baja para ver fondo animado; pointer-events-none para clics en el fondo */}
      <div className={`relative z-10 min-h-screen bg-slate-950/55 text-white font-sans selection:bg-orange-500/30 flex flex-col overscroll-y-none pt-52 md:pt-64 pointer-events-none ${mobileFiltersOpen ? 'max-md:pt-80' : ''}`}>
      
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        ::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.5; cursor: pointer; }
        .proyectos-page-header[data-header-hidden="true"] {
          opacity: 0;
          pointer-events: none;
        }
      `}</style>

      {/* --- HEADER FLUIDO --- (se disuelve al bajar scroll y reaparece al subir; fondo transparente para ver Anycolour) */}
      <div 
        data-header-hidden={!headerVisible}
        className={`proyectos-page-header fixed top-16 md:top-20 left-0 right-0 z-40 w-full border-b border-white/5 backdrop-blur-xl pb-3 transition-[opacity,box-shadow,background-color] duration-300 ease-out pointer-events-auto ${
          isScrolled ? 'bg-slate-950/60 shadow-2xl' : 'bg-slate-950/50'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col gap-4 py-4">
          
          {/* ================= FILA 1: mismo alto que guía (py-4, icono 24, text-2xl, input py-2.5) ================= */}
          <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
              
              {/* TÍTULO */}
              <div className="flex items-center gap-3 shrink-0">
                  <div className="bg-red-600/20 p-2 rounded-lg border border-red-500/30">
                    <Clapperboard className="text-red-500" size={24} />
                  </div>
                  <h1 className="font-black tracking-tighter text-2xl leading-none">
                    CARTELERA <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">TDF</span>
                  </h1>
              </div>

              {/* GRUPO DERECHA: Buscador + Botones */}
              <div className="flex flex-row gap-3 w-full lg:w-auto items-center justify-end">
                  
                  {/* Buscador (mismo estilo que guía: rounded-xl, py-2.5, text-sm) */}
                  <div className="relative group w-full lg:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-orange-500" size={16} />
                    <input 
                      type="text" 
                      placeholder="Buscar proyecto..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none text-white focus:border-orange-500 transition-all"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBusqueda(e.target.value)}
                    />
                  </div>

                  {/* SEPARADOR VERTICAL */}
                  <div className="h-6 w-px bg-slate-800 hidden md:block mx-1"></div>

                  {/* BOTONES DE ACCIÓN (mismo tamaño que guía: p-2.5, rounded-xl, icon 20) */}
                  <div className="flex gap-2 shrink-0">
                      <Link href="/mis-proyectos/crear">
                        <button className="bg-cyan-600 hover:bg-cyan-500 text-white p-2.5 rounded-xl shadow-lg shadow-cyan-900/20 transition-all hover:scale-105 active:scale-95 border border-cyan-500/30 flex items-center justify-center" title="Publicar Proyecto">
                            <Plus size={20} strokeWidth={3} />
                        </button>
                      </Link>

                      <button 
                        onClick={handleRandomize}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white p-2.5 rounded-xl shadow-lg shadow-emerald-900/20 transition-all hover:scale-105 active:scale-95 group border border-emerald-500/30 flex items-center justify-center"
                        title="Aleatorio"
                      >
                          <Dice5 size={20} className="group-hover:rotate-180 transition-transform duration-500"/>
                      </button>
                  </div>

              </div>
          </div>

          {/* Solo móvil: botón Filtros que expande/colapsa las filas de filtros */}
          <div className="md:hidden border-t border-slate-800/50 pt-2 pb-1">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-all font-bold text-sm"
            >
              <Filter size={18} />
              {mobileFiltersOpen ? 'Ocultar filtros' : 'Filtros'}
              <ChevronRight size={18} className={`transition-transform ${mobileFiltersOpen ? 'rotate-90' : ''}`} />
            </button>
          </div>

          {/* ================= FILA 2: FILTROS ESTADO + FECHAS + CIUDADES (Centrado). En móvil solo visibles si Filtros expandido ================= */}
          <div className={`flex flex-wrap justify-center items-center gap-3 border-t border-slate-800/50 pt-3 pb-1 ${mobileFiltersOpen ? 'flex' : 'hidden md:flex'}`}>
              
              <button 
                onClick={() => setFiltroEstudiante(!filtroEstudiante)} 
                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all border flex items-center gap-1.5 ${
                  filtroEstudiante 
                    ? 'bg-blue-600 text-white border-blue-500' 
                    : 'bg-slate-900 text-slate-500 border-slate-700 hover:text-blue-400'
                }`}
              >
                <GraduationCap size={12} /> ESTUDIANTIL
              </button>

              <button 
                onClick={() => setFiltroRemunerado(!filtroRemunerado)} 
                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all border flex items-center gap-1.5 ${
                  filtroRemunerado 
                    ? 'bg-emerald-600 text-white border-emerald-500' 
                    : 'bg-slate-900 text-slate-500 border-slate-700 hover:text-emerald-400'
                }`}
              >
                <DollarSign size={12} /> REMUNERADO
              </button>

              {/* Fechas */}
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1">
                  <Calendar size={12} className="text-slate-500"/>
                  <input type="date" className="bg-transparent text-[10px] text-white w-20 outline-none" onChange={(e) => setFechaDesde(e.target.value)} value={fechaDesde}/>
                  <span className="text-slate-600 text-[10px]">-</span>
                  <input type="date" className="bg-transparent text-[10px] text-white w-20 outline-none" onChange={(e) => setFechaHasta(e.target.value)} value={fechaHasta}/>
                  {(fechaDesde || fechaHasta) && <button onClick={() => {setFechaDesde(''); setFechaHasta('')}} className="text-slate-500 hover:text-white"><X size={12}/></button>}
              </div>

              {/* Selector de Ciudades */}
              <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 gap-1 overflow-x-auto max-w-full scrollbar-hide ml-2">
                  {CIUDADES_OPCIONES.map((c) => (
                      <button
                          key={c.id}
                          onClick={() => setFiltroCiudad(c.id)}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 shrink-0 ${
                              filtroCiudad === c.id 
                              ? 'bg-orange-600 text-white shadow' 
                              : 'text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                          title={c.label}
                      >
                          {c.id !== 'Todas' && <MapPin size={10} />}
                          {c.short}
                      </button>
                  ))}
              </div>
          </div>

          {/* ================= FILA 3: CATEGORÍAS (Centradas). En móvil solo visibles si Filtros expandido ================= */}
          <div className={`relative group/filters overflow-hidden pt-1 w-full max-w-4xl mx-auto border-t border-slate-800/30 mt-1 ${mobileFiltersOpen ? 'block' : 'hidden md:block'}`}>
              <button onClick={() => scrollFilters('left')} className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-slate-900/80 p-1 rounded-full text-slate-400 border border-slate-700"><ChevronLeft size={12}/></button>
              
              <div ref={filtersRef} className="flex gap-2 overflow-x-auto scrollbar-hide w-full snap-x scroll-smooth px-4 justify-start md:justify-center">
                  {TIPOS.map((tipo) => (
                    <button 
                      key={tipo}
                      onClick={() => setFiltroTipo(tipo)}
                      className={`whitespace-nowrap rounded-lg font-bold transition-all border snap-center shrink-0 flex items-center justify-center px-4 py-1.5 text-[10px] uppercase tracking-wide ${
                        filtroTipo === tipo 
                          ? 'bg-red-600/10 border-red-500 text-red-500' 
                          : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      {tipo}
                    </button>
                  ))}
              </div>

              <button onClick={() => scrollFilters('right')} className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-slate-900/80 p-1 rounded-full text-slate-400 border border-slate-700"><ChevronRight size={12}/></button>
          </div>

        </div>
      </div>

      {/* --- GRILLA DE CONTENIDO --- */}
      <div className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full pointer-events-auto">
        
        <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-slate-400">
            <Filter size={16}/>
            <span className="text-sm font-medium">{proyectosMostrados.length} {t('common.results')}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <TdfFilmLoader />
          </div>
        ) : (
          <motion.div 
            layout 
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 items-stretch gap-4 max-[800px]:gap-4 pb-20 max-[800px]:pb-12"
          >
            <AnimatePresence mode='popLayout'>
              {proyectosMostrados.map((p, index) => {
                const videoRef = p.referencias?.find((r: string) => r.includes('youtu'));
                const youtubeId = videoRef ? getYoutubeId(videoRef) : null;
                const isHovered = hoveredId === p.id;

                return (
                  <motion.div
                    layout
                    custom={index}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    key={p.id}
                    onMouseEnter={() => handleMouseEnter(p.id)}
                    onMouseLeave={handleMouseLeave}
                    className="group relative h-full flex flex-col overflow-visible transition-transform duration-300 hover:-translate-y-1"
                  >
                    <Link href={`/proyectos/${p.id}`} className="block h-full">
                      <ProyectoLiquidCard
                        p={p}
                        disable3D={disable3D}
                        youtubeId={youtubeId}
                        isHovered={isHovered}
                      />
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
        
        {!loading && proyectosMostrados.length === 0 && (
            <div className="text-center py-20 opacity-50">
                <p className="text-xl text-slate-400 font-light">No se encontraron proyectos.</p>
                <button onClick={() => {setBusqueda(''); setFiltroTipo('Todos'); setFiltroCiudad('Todas');}} className="mt-4 text-orange-500 underline hover:text-orange-400">
                    Resetear Filtros
                </button>
            </div>
        )}

      </div>
      </div>
    </div>
  );
}