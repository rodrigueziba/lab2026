'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Search, Filter, Briefcase, Users, Clapperboard, GraduationCap, 
  ChevronLeft, ChevronRight, ArrowRight, LayoutGrid, Plus, Dice5 
} from 'lucide-react';

const getInitials = (name: string) => {
  return name ? name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() : 'NN';
};

// --- CONFIGURACIÓN DE FILTROS ---
const TIPOS_PERFIL = [
  { label: "Todos", value: "Todos", icon: LayoutGrid },
  { label: "Profesionales", value: "Profesional", icon: Users },
  { label: "Productoras", value: "Productora", icon: Clapperboard },
  { label: "Empresas", value: "Empresa", icon: Briefcase },
  { label: "Estudiantes", value: "Estudiante", icon: GraduationCap },
];

// --- ANIMACIONES ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", bounce: 0.3, duration: 0.6 } },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
};

export default function GuiaPage() {
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [prestadoresMostrados, setPrestadoresMostrados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [filtroTexto, setFiltroTexto] = useState('');
  const [tipoSeleccionado, setTipoSeleccionado] = useState("Todos");
  const [rubroSeleccionado, setRubroSeleccionado] = useState("Todos");

  const [isScrolled, setIsScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);      
  const filtersRef = useRef<HTMLDivElement>(null);     

  useEffect(() => {
    fetch('http://localhost:3000/prestador')
      .then(res => res.json())
      .then(data => { 
          setPrestadores(data); 
          setPrestadoresMostrados(data); 
          setLoading(false); 
      })
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    const filtrados = prestadores.filter(p => {
        const coincideTexto = p.nombre.toLowerCase().includes(filtroTexto.toLowerCase()) || 
                              p.rubro.toLowerCase().includes(filtroTexto.toLowerCase()) ||
                              p.descripcion?.toLowerCase().includes(filtroTexto.toLowerCase());
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
    .map((p: any) => p.rubro)
  ))];

  const scrollFilters = (direction: 'left' | 'right') => {
    if (filtersRef.current) {
      const scrollAmount = 300;
      filtersRef.current.scrollBy({ left: direction === 'right' ? scrollAmount : -scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    // FIX OVERLAP: Aumentamos padding top para empujar el contenido inicial hacia abajo
    // pt-64 en mobile asegura que la cabecera alta no tape la primera tarjeta
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
          
          {/* FILA SUPERIOR: TÍTULO Y BUSCADOR */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              {/* Título */}
              <div className="flex items-center gap-3 shrink-0">
                  <div className="bg-orange-600/20 p-2 rounded-lg border border-orange-500/30">
                    <Users className="text-orange-500" size={24} />
                  </div>
                  <h1 className="font-black tracking-tighter text-2xl leading-none">
                    GUÍA DE <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">TALENTO</span>
                  </h1>
              </div>

              {/* Contenedor Derecho: Buscador + Filtros + Botones */}
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-center">
                  
                  {/* Buscador */}
                  <div className="relative group w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-orange-500" size={16} />
                    <input 
                      type="text" 
                      placeholder="Buscar..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none text-white focus:border-orange-500 transition-all"
                      onChange={(e) => setFiltroTexto(e.target.value)}
                    />
                  </div>

                  {/* BLOQUE DE FILTROS Y BOTONES (En línea) */}
                  <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
                      
                      {/* Filtros Tipo (Scrollable) */}
                      {/* FIX OVERLAP: Usamos flex-1 y min-w-0 para que el scroll funcione sin empujar layout */}
                      <div className="flex gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto scrollbar-hide flex-1 md:flex-none md:max-w-[250px] min-w-0">
                          {TIPOS_PERFIL.map((tipo) => {
                              const Icon = tipo.icon;
                              const isActive = tipoSeleccionado === tipo.value;
                              return (
                                  <button
                                      key={tipo.value}
                                      onClick={() => setTipoSeleccionado(tipo.value)}
                                      className={`p-2 rounded-lg transition-all flex items-center justify-center shrink-0 ${
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
          </div>

          {/* FILA INFERIOR: RUBROS (Scroll) */}
          <div className="relative group/filters w-full border-t border-slate-800/50 pt-2">
                <button onClick={() => scrollFilters('left')} className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-slate-900/80 p-1 rounded-full text-slate-400 border border-slate-700 hover:text-white"><ChevronLeft size={14}/></button>
                
                <div ref={filtersRef} className="flex gap-2 overflow-x-auto scrollbar-hide w-full snap-x scroll-smooth px-2 md:px-8">
                    {rubrosDisponibles.map((rubro: any) => (
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
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
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

                      <div className="relative bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden h-full flex flex-col items-center transition-all duration-300 group-hover:border-[var(--border-color)] group-hover:shadow-2xl pt-8 pb-6 px-6"
                           style={{ ['--border-color' as any]: tema }}>
                        
                        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: tema }}></div>

                        {/* FOTO */}
                        <div className="relative mb-6">
                            <div 
                              className="w-32 h-32 rounded-full border-4 p-1 bg-slate-950 flex items-center justify-center text-3xl font-bold overflow-hidden shadow-2xl group-hover:scale-105 transition-transform duration-500"
                              style={{ borderColor: tema, color: tema }}
                            >
                              {p.foto ? (
                                <img src={p.foto} alt={p.nombre} className="w-full h-full rounded-full object-cover" />
                              ) : (
                                <span>{getInitials(p.nombre)}</span>
                              )}
                            </div>
                            <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 shadow-md whitespace-nowrap">
                                {p.tipoPerfil}
                            </span>
                        </div>

                        {/* INFO */}
                        <div className="text-center w-full flex-1 flex flex-col items-center mt-2">
                            <h3 className="text-xl font-bold text-white leading-tight mb-2 group-hover:text-[var(--text-color)] transition-colors"
                                style={{ ['--text-color' as any]: tema }}>
                                {p.nombre}
                            </h3>

                            <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-4">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tema }}></div>
                                {p.rubro}
                            </div>

                            <p className="text-slate-400 text-sm mb-6 line-clamp-2 font-light leading-relaxed max-w-[250px]">
                                {p.descripcion || "Sin descripción disponible."}
                            </p>

                            <div className="mt-auto w-full border-t border-slate-800/50 pt-4 flex justify-between items-center text-xs">
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