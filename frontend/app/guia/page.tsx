'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { 
  MapPin, Search, Filter, Briefcase, Users, Clapperboard, GraduationCap, 
  ChevronLeft, ChevronRight, ArrowRight, LayoutGrid, Plus, Dice5 
} from 'lucide-react';

const getInitials = (name: string) => {
  return name ? name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() : 'NN';
};

const TIPOS_PERFIL = [
  { label: "Todos", value: "Todos", icon: LayoutGrid },
  { label: "Profesionales", value: "Profesional", icon: Users },
  { label: "Productoras", value: "Productora", icon: Clapperboard },
  { label: "Empresas", value: "Empresa", icon: Briefcase },
  { label: "Estudiantes", value: "Estudiante", icon: GraduationCap },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", bounce: 0.3, duration: 0.6 } },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
};

interface Prestador {
  id: string | number;
  nombre: string;
  rubro: string;
  tipoPerfil: string;
  descripcion?: string;
  foto?: string | null;
  ciudad?: string;
  colorTema?: string;
  [key: string]: unknown;
}

export default function GuiaPage() {
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [prestadoresMostrados, setPrestadoresMostrados] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [filtroTexto, setFiltroTexto] = useState('');
  const [tipoSeleccionado, setTipoSeleccionado] = useState("Todos");
  const [rubroSeleccionado, setRubroSeleccionado] = useState("Todos");

  const [isScrolled, setIsScrolled] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';     

  useEffect(() => {
    fetch(`${apiUrl}/prestador`)
      .then(res => res.json())
      .then(data => { 
          setPrestadores(data); 
          setPrestadoresMostrados(data); 
          setLoading(false); 
      })
      .catch(err => console.error(err));
  }, [apiUrl]);

  useEffect(() => {
    const filtrados = prestadores.filter(p => {
        const coincideTexto = p.nombre.toLowerCase().includes(filtroTexto.toLowerCase()) || 
                              p.rubro.toLowerCase().includes(filtroTexto.toLowerCase()) ||
                              (p.descripcion?.toLowerCase().includes(filtroTexto.toLowerCase()) ?? false);
        const coincideTipo = tipoSeleccionado === "Todos" || p.tipoPerfil === tipoSeleccionado;
        const coincideRubro = rubroSeleccionado === "Todos" || p.rubro === rubroSeleccionado;
        return coincideTexto && coincideTipo && coincideRubro;
    });
    setPrestadoresMostrados(filtrados);
  }, [filtroTexto, tipoSeleccionado, rubroSeleccionado, prestadores]);

  const handleRandomize = () => {
      const arrayMezclado = [...prestadoresMostrados];
      for (let i = arrayMezclado.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arrayMezclado[i], arrayMezclado[j]] = [arrayMezclado[j], arrayMezclado[i]];
      }
      setPrestadoresMostrados(arrayMezclado);
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const rubrosDisponibles = ["Todos", ...Array.from(new Set(prestadores
    .filter(p => tipoSeleccionado === "Todos" || p.tipoPerfil === tipoSeleccionado)
    .map(p => p.rubro)
  ))];

  const scrollFilters = (direction: 'left' | 'right') => {
    if (filtersRef.current) {
      const scrollAmount = 300;
      filtersRef.current.scrollBy({ left: direction === 'right' ? scrollAmount : -scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-orange-500/30 pt-64 md:pt-48 flex flex-col">
      
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>

      {/* --- HEADER FLUIDO --- */}
      <div 
        className={`fixed top-20 left-0 right-0 z-40 transition-all duration-500 w-full border-b border-white/5 backdrop-blur-xl bg-slate-950/95 ${
          isScrolled ? 'shadow-2xl' : ''
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-col gap-4">
          
          {/* FILA SUPERIOR (escritorio): título | buscador centrado (ocupa ancho que sobra) | filtros y botones */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-6">
              {/* Título (izquierda) */}
              <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
                  <div className="bg-orange-600/20 p-2 rounded-lg border border-orange-500/30">
                    <Users className="text-orange-500" size={24} />
                  </div>
                  <h1 className="font-black tracking-tighter text-2xl leading-none">
                    GUÍA DE <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">PRESTADORES</span>
                  </h1>
              </div>

              {/* Buscador centrado, ocupa todo el ancho que sobra (solo escritorio) */}
              <div className="relative group w-full md:flex-1 md:min-w-0 md:max-w-xl md:mx-4 flex justify-center">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-orange-500" size={16} />
                <input 
                  type="text" 
                  placeholder="Buscar..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none text-white focus:border-orange-500 transition-all"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFiltroTexto(e.target.value)}
                />
              </div>

              {/* Filtros y botones (derecha) */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end shrink-0">
                      
                      {/* Filtros Tipo: en móvil ocupan todo el ancho con más espacio entre iconos */}
                      <div className="flex flex-1 md:flex-none w-full md:max-w-[250px] min-w-0 gap-4 md:gap-2 bg-slate-900 p-2 md:p-1 rounded-xl border border-slate-800 overflow-x-auto scrollbar-hide justify-between md:justify-start">
                          {TIPOS_PERFIL.map((tipo) => {
                              const Icon = tipo.icon;
                              const isActive = tipoSeleccionado === tipo.value;
                              return (
                                  <button
                                      key={tipo.value}
                                      onClick={() => setTipoSeleccionado(tipo.value)}
                                      className={`flex-1 min-w-0 md:flex-none md:shrink-0 p-2 rounded-lg transition-all flex items-center justify-center ${
                                          isActive ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                      }`}
                                      title={tipo.label}
                                  >
                                      {Icon && <Icon size={18}/>}
                                  </button>
                              )
                          })}
                      </div>

                      {/* Separador */}
                      <div className="h-8 w-px bg-slate-800 mx-1 hidden md:block"></div>

                      {/* Botones Acción */}
                      <div className="flex gap-2 shrink-0">
                          <Link href="/mi-perfil/crear">
                            <button className="bg-cyan-600 hover:bg-cyan-500 text-white p-2.5 rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95 border border-cyan-500/30 flex items-center justify-center">
                                <Plus size={20} strokeWidth={3} />
                            </button>
                          </Link>

                          <button 
                            onClick={handleRandomize}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white p-2.5 rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95 group border border-emerald-500/30 flex items-center justify-center"
                          >
                              <Dice5 size={20} className="group-hover:rotate-180 transition-transform duration-500"/>
                          </button>
                      </div>
                  </div>
              </div>

          {/* FILA INFERIOR: selector de rubros centrado en escritorio */}
          <div className="relative group/filters w-full border-t border-slate-800/50 pt-2">
                <button onClick={() => scrollFilters('left')} className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-slate-900/80 p-1 rounded-full text-slate-400 border border-slate-700 hover:text-white"><ChevronLeft size={14}/></button>
                
                <div ref={filtersRef} className="flex gap-2 overflow-x-auto scrollbar-hide w-full snap-x scroll-smooth px-2 md:px-8 md:justify-center">
                    {rubrosDisponibles.map((rubro: string) => (
                      <button 
                        key={rubro}
                        onClick={() => setRubroSeleccionado(rubro)}
                        className={`whitespace-nowrap rounded-lg font-bold transition-all border snap-center shrink-0 flex items-center justify-center px-4 py-1.5 text-[10px] uppercase tracking-wide ${
                          rubroSeleccionado === rubro 
                            ? 'bg-orange-600/10 border-orange-500 text-orange-500' 
                            : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        {rubro}
                      </button>
                    ))}
                </div>

                <button onClick={() => scrollFilters('right')} className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-slate-900/80 p-1 rounded-full text-slate-400 border border-slate-700 hover:text-white"><ChevronRight size={14}/></button>
          </div>

        </div>
      </div>

      {/* --- LISTADO DE TARJETAS --- */}
      <div className="max-w-7xl mx-auto px-6 pb-20 flex-1 w-full">
        
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-slate-400">
            <Filter size={16}/>
            <span className="text-sm font-medium">{prestadoresMostrados.length} resultados</span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
            <p className="text-slate-500 text-sm animate-pulse">Cargando talento...</p>
          </div>
        ) : (
          <motion.div 
            layout 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-[800px]:gap-4 md:gap-6 lg:gap-8"
          >
            <AnimatePresence mode='popLayout'>
              {prestadoresMostrados.map((p) => {
                const tema = p.colorTema || '#ea580c';
                
                return (
                  <motion.div
                    layout
                    key={p.id}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    whileHover={{ y: -8, transition: { duration: 0.3 } }}
                    className="group h-full"
                  >
                    <Link href={`/prestador/${p.id}`} className="block h-full relative">
                      
                      {/* EFECTO GLOW */}
                      <div 
                        className="absolute -inset-0.5 rounded-3xl opacity-0 group-hover:opacity-40 transition-opacity duration-500 blur-xl"
                        style={{ backgroundColor: tema }}
                      ></div>

                      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl max-[800px]:rounded-xl md:rounded-3xl overflow-hidden h-full flex flex-col items-center transition-all duration-300 group-hover:border-[var(--border-color)] group-hover:shadow-2xl pt-5 max-[800px]:pt-4 pb-4 max-[800px]:pb-3 px-4 max-[800px]:px-3 md:pt-8 md:pb-6 md:px-6"
                           style={{ ['--border-color' as never]: tema }}>
                        
                        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: tema }}></div>

                        {/* FOTO */}
                        <div className="relative mb-3 max-[800px]:mb-2 md:mb-6">
                            <div 
                              className="w-24 h-24 max-[800px]:w-20 max-[800px]:h-20 md:w-28 md:h-28 lg:w-32 lg:h-32 rounded-full border-2 max-[800px]:border-2 md:border-4 p-1 bg-slate-950 flex items-center justify-center text-xl max-[800px]:text-lg md:text-2xl lg:text-3xl font-bold overflow-hidden shadow-2xl group-hover:scale-105 transition-transform duration-500"
                              style={{ borderColor: tema, color: tema }}
                            >
                              {p.foto ? (
                                <img src={p.foto} alt={p.nombre} className="w-full h-full rounded-full object-cover" />
                              ) : (
                                <span>{getInitials(p.nombre)}</span>
                              )}
                            </div>
                            <span className="absolute -bottom-2 max-[800px]:-bottom-1.5 left-1/2 -translate-x-1/2 text-[8px] max-[800px]:text-[8px] md:text-[9px] font-black uppercase tracking-widest px-2 max-[800px]:px-2 md:px-3 py-0.5 max-[800px]:py-0.5 md:py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 shadow-md whitespace-nowrap">
                                {p.tipoPerfil}
                            </span>
                        </div>

                        {/* INFO */}
                        <div className="text-center w-full flex-1 flex flex-col items-center mt-1 max-[800px]:mt-0 md:mt-2">
                            <h3 className="text-base max-[800px]:text-sm md:text-lg lg:text-xl font-bold text-white leading-tight mb-1 max-[800px]:mb-1 md:mb-2 group-hover:text-[var(--text-color)] transition-colors"
                                style={{ ['--text-color' as never]: tema }}>
                                {p.nombre}
                            </h3>

                            <div className="text-[9px] max-[800px]:text-[9px] md:text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-2 max-[800px]:mb-2 md:mb-4">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tema }}></div>
                                {p.rubro}
                            </div>

                            <p className="text-slate-400 text-xs max-[800px]:text-[11px] md:text-sm mb-3 max-[800px]:mb-3 md:mb-6 line-clamp-2 font-light leading-relaxed max-w-[220px] max-[800px]:max-w-[180px] md:max-w-[250px]">
                                {p.descripcion || "Sin descripción disponible."}
                            </p>

                            <div className="mt-auto w-full border-t border-slate-800/50 pt-2 max-[800px]:pt-2 md:pt-4 flex justify-between items-center text-[10px] max-[800px]:text-[10px] md:text-xs">
                                <div className="flex items-center gap-1 text-slate-500">
                                    <MapPin size={12} className="text-orange-500"/>
                                    <span>{p.ciudad || "TDF"}</span>
                                </div>
                                <span className="font-bold uppercase tracking-wider flex items-center gap-1 group-hover:gap-2 transition-all duration-300" style={{ color: tema }}>
                                    Ver Perfil <ArrowRight size={12}/>
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
        
        {!loading && prestadoresMostrados.length === 0 && (
            <div className="text-center py-20 opacity-50">
                <p className="text-xl text-slate-400 font-light">No se encontraron profesionales.</p>
                <button onClick={() => {setFiltroTexto(''); setRubroSeleccionado('Todos'); setTipoSeleccionado('Todos');}} className="mt-4 text-orange-500 underline hover:text-orange-400">
                    Limpiar filtros
                </button>
            </div>
        )}

      </div>
    </div>
  );
}