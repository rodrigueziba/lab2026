'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
// Importamos 'Variants' de framer-motion para tipar correctamente las animaciones
import { motion, AnimatePresence, Variants } from 'framer-motion';
import dynamic from 'next/dynamic';
import { ChevronLeft, ChevronRight, Search, MapPin, Mountain, ArrowRight, Filter } from 'lucide-react';

// Cargamos el mapa solo en el cliente
const MapaTDF = dynamic(() => import('../../components/MapaTDF'), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-900 animate-pulse flex items-center justify-center text-slate-500">Cargando Mapa...</div>
});

const CATEGORIAS_BASE = [
  "Todas", "Paisaje Natural", "Urbano y Arquitectura", "Cultura y Esparcimiento",
  "Infraestructura y Transporte", "Sitios Abandonados", "Deporte"
];

const COORDS_BASE: { [key: string]: [number, number] } = {
  "Ushuaia": [-54.8019, -68.3030],
  "Río Grande": [-53.7763, -67.7164],
  "Tolhuin": [-54.5108, -67.1925],
  "Default": [-54.5, -67.5]
};

// 1. SOLUCIÓN AL ERROR DE VARIANTS: Tipamos explícitamente los objetos de animación
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
};

// Interfaz para reemplazar el uso de 'any' en las locaciones
interface Locacion {
  id: string | number;
  nombre: string;
  ciudad: string;
  categoria: string;
  descripcion: string;
  foto: string | null;
  lat: number | string;
  lng: number | string;
  [key: string]: unknown; // Permite otras propiedades adicionales de forma segura
}

export default function CatalogoLocacionesPage() {
  const [locaciones, setLocaciones] = useState<Locacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");
  
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);      
  const filtersRef = useRef<HTMLDivElement>(null);     
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';     

  useEffect(() => {
    fetch(`${apiUrl}/locacion`)
      .then(res => res.json())
      .then(data => {
        // 2. SOLUCIÓN AL ANY: Tipamos el mapeo de los datos recibidos
        const dataConCoords = data.map((loc: Locacion) => {
          const base = COORDS_BASE[loc.ciudad] || COORDS_BASE["Default"];
          let lat = typeof loc.lat === 'string' ? parseFloat(loc.lat) : Number(loc.lat);
          let lng = typeof loc.lng === 'string' ? parseFloat(loc.lng) : Number(loc.lng);

          if (isNaN(lat)) lat = base[0] + (Math.random() - 0.5) * 0.05;
          if (isNaN(lng)) lng = base[1] + (Math.random() - 0.5) * 0.05;

          return { ...loc, lat, lng };
        });
        setLocaciones(dataConCoords);
        setLoading(false);
      })
      .catch(err => console.error(err));
  }, [apiUrl]); // 3. SOLUCIÓN AL EXHAUSTIVE DEPS: Añadimos apiUrl a las dependencias

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => setIsScrolled(el.scrollTop > 20);
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const categoriasOrdenadas = useMemo(() => {
    if (locaciones.length === 0) return CATEGORIAS_BASE;
    const counts: {[key: string]: number} = {};
    locaciones.forEach(loc => {
      counts[loc.categoria] = (counts[loc.categoria] || 0) + 1;
    });
    const cats = [...CATEGORIAS_BASE].filter(c => c !== "Todas");
    cats.sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
    return ["Todas", ...cats];
  }, [locaciones]);

  const locacionesFiltradas = useMemo(() => {
    return locaciones.filter(loc => {
      const coincideCategoria = filtroCategoria === "Todas" || loc.categoria === filtroCategoria;
      const coincideTexto = loc.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
                            loc.ciudad.toLowerCase().includes(busqueda.toLowerCase());
      return coincideCategoria && coincideTexto;
    });
  }, [locaciones, filtroCategoria, busqueda]);

  const scrollFilters = (direction: 'left' | 'right') => {
    if (filtersRef.current) {
      const scrollAmount = 300;
      filtersRef.current.scrollBy({
        left: direction === 'right' ? scrollAmount : -scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-white font-sans overflow-hidden flex flex-col pt-24 selection:bg-orange-500/30">
      
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0f172a; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #475569; }
      `}</style>

      {/* --- HEADER --- */}
      <div className={`bg-slate-900/90 backdrop-blur-xl border-b border-slate-800 z-30 shrink-0 transition-all duration-500 w-full ${isScrolled ? 'py-4 shadow-2xl' : 'py-6 md:py-8'}`}>
        <div className="w-full px-6 max-w-[1920px] mx-auto flex flex-wrap gap-y-4 gap-x-8 items-center justify-between">
          
          <div className="shrink-0 transition-all duration-500 min-w-fit">
            <h1 className={`font-black tracking-tighter transition-all duration-500 leading-none flex items-center gap-3 ${isScrolled ? 'text-2xl' : 'text-3xl md:text-4xl'}`}>
              <div className="bg-orange-600/20 p-2 rounded-lg border border-orange-500/30">
                <Mountain className="text-orange-500" size={isScrolled ? 20 : 28} />
              </div>
              <span>CATÁLOGO <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">TDF</span></span>
            </h1>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-center flex-1 justify-end min-w-[300px]">
              <div className="relative group w-full md:max-w-xs transition-all">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-orange-500">
                  <Search size={18} />
                </div>
                <input 
                  type="text" 
                  placeholder="Buscar ciudad, nombre..." 
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all shadow-inner placeholder:text-slate-600" 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBusqueda(e.target.value)} // Tipado añadido aquí
                />
              </div>

              <div className="relative flex items-center w-full md:w-auto md:max-w-md group/filters h-10 overflow-hidden border-l border-slate-800 pl-4 md:pl-6 ml-2">
                <button onClick={() => scrollFilters('left')} className="hidden md:flex absolute left-4 z-20 w-8 h-full bg-gradient-to-r from-slate-900 to-transparent items-center justify-start text-slate-400 hover:text-white"><ChevronLeft size={18} /></button>
                <div ref={filtersRef} className="flex gap-2 overflow-x-auto scrollbar-hide px-2 w-full snap-x scroll-smooth items-center h-full">
                  {categoriasOrdenadas.map((cat) => (
                    <button key={cat} onClick={() => setFiltroCategoria(cat)} className={`whitespace-nowrap rounded-lg font-bold transition-all border snap-center shrink-0 flex items-center justify-center px-4 py-1.5 text-[11px] uppercase tracking-wide ${filtroCategoria === cat ? 'bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-900/50' : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'}`}>
                      {cat}
                    </button>
                  ))}
                </div>
                <button onClick={() => scrollFilters('right')} className="hidden md:flex absolute right-0 z-20 w-8 h-full bg-gradient-to-l from-slate-900 to-transparent items-center justify-end text-slate-400 hover:text-white"><ChevronRight size={18} /></button>
              </div>
          </div>
        </div>
      </div>

      {/* --- CONTENIDO --- */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
        
        <div ref={scrollRef} className="custom-scrollbar w-full md:w-[45%] lg:w-[40%] xl:w-[35%] h-full overflow-y-auto bg-slate-950 z-10 shadow-[5px_0_30px_rgba(0,0,0,0.5)] flex flex-col relative">
          
          <div className="sticky top-0 bg-slate-950/95 backdrop-blur z-20 px-6 py-4 border-b border-slate-800 flex justify-between items-center">
             
             <div className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
               {locacionesFiltradas.length} resultados
             </div>

             <Link href="/locaciones/nueva" className="text-[10px] bg-slate-900 hover:bg-orange-600 hover:text-white border border-slate-700 hover:border-orange-500 text-slate-300 px-4 py-2 rounded-lg transition-all font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg">
               + Sugerir
             </Link>
          </div>

          {loading ? (
            <div className="flex flex-col gap-4 p-6">
               {[1,2,3].map(i => <div key={i} className="h-32 bg-slate-900/50 rounded-2xl animate-pulse border border-slate-800"></div>)}
            </div>
          ) : (
            <div className="flex-1 p-6">
              <motion.div layout variants={containerVariants} initial="hidden" animate="visible" className="flex flex-col gap-6 pb-24">
                <AnimatePresence mode='popLayout'>
                  {locacionesFiltradas.map((loc) => (
                    <motion.div layout key={loc.id} variants={cardVariants} initial="hidden" animate="visible" exit="exit" whileHover={{ scale: 1.02, x: 4 }} className="group">
                      <Link href={`/locaciones/${loc.id}`} className="block relative">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-600/50 to-red-600/50 rounded-2xl opacity-0 group-hover:opacity-100 blur transition duration-500"></div>
                        <div className="relative flex bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-orange-500/30 transition-all shadow-xl h-40 md:h-48 group-hover:bg-slate-900/90">
                          <div className="w-2/5 relative overflow-hidden">
                            <img src={loc.foto || 'https://via.placeholder.com/400x400'} alt={loc.nombre} className="w-full h-full object-cover group-hover:scale-110 transition duration-700 brightness-90 group-hover:brightness-110"/>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-slate-900 mix-blend-multiply opacity-50"></div>
                          </div>
                          <div className="w-3/5 p-6 flex flex-col justify-center relative z-10">
                             <div className="flex justify-between items-start mb-3">
                                <span className="text-[9px] font-black uppercase text-orange-400 tracking-wider bg-orange-500/10 px-2 py-1 rounded border border-orange-500/20 truncate max-w-[70%]">{loc.categoria}</span>
                                <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium bg-black/30 px-2 py-1 rounded-full"><MapPin size={10} className="text-orange-500"/> {loc.ciudad}</span>
                             </div>
                             <div className="mb-2">
                                <h3 className="text-lg font-bold text-white leading-tight group-hover:text-orange-400 transition-colors line-clamp-1 mb-2">{loc.nombre}</h3>
                                <p className="text-slate-400 text-xs line-clamp-2 font-light leading-relaxed group-hover:text-slate-300">{loc.descripcion}</p>
                             </div>
                             <div className="mt-2 pt-3 border-t border-slate-800/50 flex justify-end">
                               <span className="text-[10px] font-bold text-slate-500 group-hover:text-white flex items-center gap-1 transition-colors uppercase tracking-wider">Ver Ficha <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform text-orange-500"/></span>
                             </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
              {!loading && locacionesFiltradas.length === 0 && (
                 <div className="text-center py-20 text-slate-500 bg-slate-900/30 rounded-2xl border border-dashed border-slate-800 mx-4">
                   <Mountain className="mx-auto mb-2 opacity-20" size={32}/>
                   <p className="text-sm">No hay locaciones con esos filtros.</p>
                   <button onClick={() => {setBusqueda(''); setFiltroCategoria('Todas');}} className="text-orange-500 text-xs mt-2 hover:underline">Resetear</button>
                 </div>
              )}
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: MAPA */}
        <div className="hidden md:block w-[55%] lg:w-[60%] xl:w-[65%] h-full bg-slate-900 relative shadow-inner">
          <MapaTDF locaciones={locacionesFiltradas} />
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-slate-950 to-transparent pointer-events-none z-10"></div>
        </div>

      </div>
    </div>
  );
}