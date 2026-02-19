'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Film, DollarSign, GraduationCap, Users, Calendar, 
  PlayCircle, X, MapPin, Search, Clapperboard, 
  ChevronLeft, ChevronRight, Plus, Dice5, Eye, Filter 
} from 'lucide-react';

const getYoutubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url?.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// --- CONFIGURACIÓN ---
const TIPOS = ['Todos', 'Cortometraje', 'Largometraje', 'Documental', 'Videoclip', 'Publicidad'];

const CIUDADES_OPCIONES = [
    { id: 'Todas', label: 'TODAS', short: 'TODOS' },
    { id: 'Ushuaia', label: 'USHUAIA', short: 'USH' },
    { id: 'Río Grande', label: 'RIO GRANDE', short: 'RIO' },
    { id: 'Tolhuin', label: 'TOLHUIN', short: 'TOL' },
];

// Animación aleatoria "Pop"
const cardVariants = {
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

export default function CarteleraProyectosPage() {
  const [proyectos, setProyectos] = useState<any[]>([]);
  const [proyectosMostrados, setProyectosMostrados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- FILTROS ---
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('Todos');
  const [filtroCiudad, setFiltroCiudad] = useState('Todas');
  const [filtroEstudiante, setFiltroEstudiante] = useState(false);
  const [filtroRemunerado, setFiltroRemunerado] = useState(false);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // UI
  const [isScrolled, setIsScrolled] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null); 
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. CARGA INICIAL
  useEffect(() => {
    fetch('http://localhost:3000/proyecto')
      .then(res => res.json())
      .then(data => { 
          setProyectos(data); 
          setProyectosMostrados(data); 
          setLoading(false); 
      })
      .catch(err => console.error(err));
  }, []);

  // 2. LÓGICA DE FILTRADO
  useEffect(() => {
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

  // 3. ALEATORIEDAD
  const handleRandomize = () => {
      const shuffled = [...proyectosMostrados];
      for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      setProyectosMostrados(shuffled);
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
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
    // FIX DE ALTURA: pt-80 (320px) en móvil asegura espacio para las 3 filas + navbar
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-orange-500/30 pt-80 md:pt-64 flex flex-col overscroll-y-none">
      
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        ::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.5; cursor: pointer; }
      `}</style>

      {/* --- HEADER FLUIDO --- */}
      <div 
        className={`fixed top-20 left-0 right-0 z-40 transition-all duration-500 w-full border-b border-white/5 backdrop-blur-xl bg-slate-950/95 pb-3 ${
          isScrolled ? 'shadow-2xl' : ''
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col gap-3 py-3">
          
          {/* ================= FILA 1: TÍTULO, BUSCADOR Y ACCIONES ================= */}
          <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
              
              {/* TÍTULO */}
              <div className="flex items-center gap-3 shrink-0">
                  <div className="bg-red-600/20 p-1.5 rounded-lg border border-red-500/30">
                    <Clapperboard className="text-red-500" size={20} />
                  </div>
                  <h1 className="font-black tracking-tighter text-xl md:text-2xl leading-none">
                    CARTELERA <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">TDF</span>
                  </h1>
              </div>

              {/* GRUPO DERECHA: Buscador + Botones */}
              <div className="flex flex-row gap-3 w-full lg:w-auto items-center justify-end">
                  
                  {/* Buscador */}
                  <div className="relative group w-full lg:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-orange-500" size={14} />
                    <input 
                      type="text" 
                      placeholder="Buscar proyecto..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs outline-none text-white focus:border-orange-500 transition-all"
                      onChange={(e) => setBusqueda(e.target.value)}
                    />
                  </div>

                  {/* SEPARADOR VERTICAL */}
                  <div className="h-6 w-px bg-slate-800 hidden md:block mx-1"></div>

                  {/* BOTONES DE ACCIÓN */}
                  <div className="flex gap-2 shrink-0">
                      <Link href="/mis-proyectos/crear">
                        <button className="bg-cyan-600 hover:bg-cyan-500 text-white p-1.5 rounded-lg shadow-lg shadow-cyan-900/20 transition-all hover:scale-105 active:scale-95 border border-cyan-500/30 w-8 h-8 flex items-center justify-center" title="Publicar Proyecto">
                            <Plus size={18} strokeWidth={3} />
                        </button>
                      </Link>

                      <button 
                        onClick={handleRandomize}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded-lg shadow-lg shadow-emerald-900/20 transition-all hover:scale-105 active:scale-95 group border border-emerald-500/30 w-8 h-8 flex items-center justify-center"
                        title="Aleatorio"
                      >
                          <Dice5 size={18} className="group-hover:rotate-180 transition-transform duration-500"/>
                      </button>
                  </div>

              </div>
          </div>

          {/* ================= FILA 2: FILTROS ESTADO + FECHAS + CIUDADES (Centrado) ================= */}
          <div className="flex flex-wrap justify-center items-center gap-3 border-t border-slate-800/50 pt-3 pb-1">
              
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

          {/* ================= FILA 3: CATEGORÍAS (Centradas) ================= */}
          <div className="relative group/filters overflow-hidden pt-1 w-full max-w-4xl mx-auto border-t border-slate-800/30 mt-1">
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
      <div className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full">
        
        <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-slate-400">
            <Filter size={16}/>
            <span className="text-sm font-medium">{proyectosMostrados.length} resultados</span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
            <p className="text-slate-500 text-sm animate-pulse">Cargando cartelera...</p>
          </div>
        ) : (
          <motion.div 
            layout 
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20"
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
                    className="group relative bg-slate-900 rounded-[2rem] border border-slate-800 hover:border-orange-500/30 transition-all hover:shadow-[0_0_30px_rgba(234,88,12,0.15)] h-full flex flex-col overflow-hidden hover:-translate-y-1 duration-300"
                  >
                    <Link href={`/proyectos/${p.id}`} className="flex flex-col h-full">
                      
                      {/* MEDIA AREA */}
                      <div className="relative h-64 bg-black overflow-hidden">
                        
                        {/* Video Overlay on Hover */}
                        {isHovered && youtubeId ? (
                            <motion.div 
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: 1 }} 
                                className="absolute inset-0 z-20 bg-black"
                            >
                                <iframe 
                                    src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=${youtubeId}`}
                                    className="w-full h-full object-cover pointer-events-none scale-125"
                                    allow="autoplay"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-80 pointer-events-none"></div>
                            </motion.div>
                        ) : (
                            <>
                                {p.foto ? (
                                    <img src={p.foto} className="w-full h-full object-cover opacity-70 group-hover:scale-110 transition-transform duration-700 grayscale-[30%] group-hover:grayscale-0" />
                                ) : (
                                    <div className="w-full h-full bg-slate-800 flex items-center justify-center opacity-50"><Film size={40}/></div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-90"></div>
                            </>
                        )}

                        {/* TIPO + CIUDAD (Badge Flotante) */}
                        <div className="absolute top-4 left-4 z-30">
                            <span className="text-[9px] font-black uppercase text-white bg-orange-600 px-3 py-1 rounded-full shadow-lg">
                                {p.tipo}
                            </span>
                        </div>

                        {/* BADGES ESTADO (Top Right) */}
                        <div className="absolute top-4 right-4 z-30 flex flex-col gap-2 items-end">
                            {p.esRemunerado && (
                                <span className="bg-emerald-500 text-white text-[9px] font-bold p-1.5 rounded-full shadow-lg" title="Remunerado">
                                    <DollarSign size={12} strokeWidth={3}/>
                                </span>
                            )}
                            {p.esEstudiante && (
                                <span className="bg-blue-600 text-white text-[9px] font-bold p-1.5 rounded-full shadow-lg" title="Estudiantil">
                                    <GraduationCap size={12}/>
                                </span>
                            )}
                        </div>

                      </div>

                      {/* CONTENIDO */}
                      <div className="p-7 flex-1 flex flex-col bg-slate-900 relative z-10 -mt-12 rounded-t-[2rem]">
                        
                        {/* Título Grande */}
                        <h3 className="text-3xl font-black text-white mb-3 leading-none group-hover:text-orange-500 transition-colors tracking-tight">
                            {p.titulo}
                        </h3>

                        {/* Ubicación e Inicio */}
                        <div className="flex items-center gap-4 text-xs text-slate-400 mb-4 font-medium">
                            <span className="flex items-center gap-1"><MapPin size={12} className="text-orange-500"/> {p.ciudad}</span>
                            {p.fechaInicio && <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(p.fechaInicio).toLocaleDateString()}</span>}
                        </div>

                        <p className="text-slate-400 text-sm line-clamp-3 mb-6 font-light leading-relaxed">
                            {p.descripcion}
                        </p>

                        {/* Roles */}
                        <div className="mt-auto pt-4 border-t border-slate-800">
                            <div className="flex flex-wrap gap-1.5 mb-4">
                                {p.puestos && p.puestos.length > 0 ? (
                                    p.puestos.slice(0, 3).map((puesto: any) => (
                                        <span key={puesto.id} className="text-[10px] font-bold uppercase bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">
                                            {puesto.nombre}
                                        </span>
                                    ))
                                ) : <span className="text-xs text-slate-600 italic">Equipo completo</span>}
                                {p.puestos?.length > 3 && <span className="text-[10px] text-slate-500 px-1">+{p.puestos.length - 3}</span>}
                            </div>

                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 border border-slate-700">
                                        {p.user?.nombre?.[0] || 'U'}
                                    </div>
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest truncate max-w-[80px]">
                                        {p.user?.nombre || 'Productor'}
                                    </span>
                                </div>
                                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-orange-500 group-hover:gap-2 transition-all">
                                    Ver Ficha <Eye size={12}/>
                                </span>
                            </div>
                        </div>

                      </div>
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
  );
}