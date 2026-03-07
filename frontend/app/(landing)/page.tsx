"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { 
  UserPlus, 
  Search, 
  Briefcase, 
  Bell, 
  MapPin, 
  Sparkles, 
  ArrowRight, 
  Video,
  Clapperboard,
  Info
} from "lucide-react";

// Importamos el componente 3D dinámicamente
const SplatScrollLanding = dynamic(
  () => import("../../components/landing/SplatScrollLanding"),
  { ssr: false }
);

// --- SECCIÓN: CÓMO FUNCIONA ---
function ComoFuncionaSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.95 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: "spring" as const, stiffness: 80, damping: 15 }
    }
  };

  return (
    // Quitamos el background sólido de aquí para controlarlo en el wrapper principal
    <div className="text-slate-300 relative overflow-hidden pb-10">
      
      {/* Elementos decorativos de fondo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-orange-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 md:px-12 relative z-10 pt-4">
        
        {/* ENCABEZADO */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/50 text-orange-500 text-xs font-bold tracking-widest uppercase mb-6 shadow-lg">
            <Sparkles size={14} />
            Guía de la Plataforma
          </div>
          <h2 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">
            Impulsá tu carrera en el <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500">
              Sector Audiovisual
            </span>
          </h2>
          <p className="text-lg text-slate-400">
            Descubrí cómo la Film Commission TDF conecta tu talento con las mejores producciones de la provincia. Todo lo que necesitás saber si sos un prestador de servicios.
          </p>
        </motion.div>

        {/* BOTÓN DE MÁS INFORMACIÓN */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="flex justify-center mb-20"
        >
          <Link href="/info">
            <button className="group relative px-8 py-4 bg-blue-900 border border-blue-700 rounded-2xl font-bold text-white flex items-center gap-3 overflow-hidden transition-all duration-300 hover:bg-blue-600 hover:shadow-[0_0_40px_rgba(59,130,246,0.5)] hover:border-blue-400 hover:-translate-y-1">
              {/* Efecto de barrido de luz */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/20 to-blue-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <Info size={22} className="relative z-10" />
              <span className="relative z-10 text-lg">Más Información</span>
            </button>
          </Link>
        </motion.div>

        {/* RECORRIDO DEL PRESTADOR (TIMELINE) */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
          className="mb-24"
        >
          <h3 className="text-2xl font-black text-white mb-10 text-center uppercase tracking-wider">
            El recorrido del Prestador
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Paso 1 */}
            <motion.div variants={itemVariants} className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 p-8 rounded-3xl transition-all duration-500 group relative overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.1),_0_10px_30px_rgba(0,0,0,0.3)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),_0_0_40px_rgba(59,130,246,0.15)] hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <div className="relative z-10 w-14 h-14 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <UserPlus size={28} />
              </div>
              <h4 className="relative z-10 text-xl font-bold text-white mb-3">1. Creá tu Perfil</h4>
              <p className="relative z-10 text-sm text-slate-400 leading-relaxed text-justify">
                Registrate y armá tu currículum digital. Podés crear múltiples perfiles (ej. como Sonidista freelance y como Productora). Utilizá nuestra IA integrada para redactar tu biografía profesional.
              </p>
            </motion.div>

            {/* Paso 2 */}
            <motion.div variants={itemVariants} className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 p-8 rounded-3xl transition-all duration-500 group relative overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.1),_0_10px_30px_rgba(0,0,0,0.3)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),_0_0_40px_rgba(249,115,22,0.15)] hover:-translate-y-2 mt-0 lg:mt-8">
              <div className="hidden lg:block absolute -left-6 top-14 w-6 border-t-2 border-dashed border-slate-700"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <div className="relative z-10 w-14 h-14 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-orange-500/20 transition-all shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                <Search size={28} />
              </div>
              <h4 className="relative z-10 text-xl font-bold text-white mb-3">2. Hacete Visible</h4>
              <p className="relative z-10 text-sm text-slate-400 leading-relaxed text-justify">
                Al activar tu perfil, vas a aparecer automáticamente en la <strong>Guía de Talento</strong> pública. Directores y productoras van a poder filtrarte por ciudad y rubro para contratarte directamente.
              </p>
            </motion.div>

            {/* Paso 3 */}
            <motion.div variants={itemVariants} className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 p-8 rounded-3xl transition-all duration-500 group relative overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.1),_0_10px_30px_rgba(0,0,0,0.3)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),_0_0_40px_rgba(239,68,68,0.15)] hover:-translate-y-2 mt-0 lg:mt-16">
              <div className="hidden lg:block absolute -left-6 top-14 w-6 border-t-2 border-dashed border-slate-700"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <div className="relative z-10 w-14 h-14 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-red-500/20 transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                <Briefcase size={28} />
              </div>
              <h4 className="relative z-10 text-xl font-bold text-white mb-3">3. Encontrá Trabajo</h4>
              <p className="relative z-10 text-sm text-slate-400 leading-relaxed text-justify">
                Revisá la <strong>Cartelera de Proyectos</strong>. Vas a poder ver los rodajes activos en la provincia y postularte con un solo clic a los puestos que las productoras están solicitando.
              </p>
            </motion.div>

            {/* Paso 4 */}
            <motion.div variants={itemVariants} className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 p-8 rounded-3xl transition-all duration-500 group relative overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.1),_0_10px_30px_rgba(0,0,0,0.3)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),_0_0_40px_rgba(16,185,129,0.15)] hover:-translate-y-2 mt-0 lg:mt-24">
              <div className="hidden lg:block absolute -left-6 top-14 w-6 border-t-2 border-dashed border-slate-700"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <div className="relative z-10 w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <Bell size={28} />
              </div>
              <h4 className="relative z-10 text-xl font-bold text-white mb-3">4. Conectá</h4>
              <p className="relative z-10 text-sm text-slate-400 leading-relaxed text-justify">
                Recibí notificaciones en tiempo real cuando un proyecto acepte tu postulación o cuando alguien solicite tus datos de contacto para una producción.
              </p>
            </motion.div>

          </div>
        </motion.div>

        {/* CARACTERÍSTICAS ADICIONALES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            className="bg-gradient-to-br from-slate-900/60 to-slate-950/60 backdrop-blur-md border border-slate-700/50 rounded-3xl p-10 overflow-hidden relative shadow-[inset_0_1px_0_rgba(255,255,255,0.1),_0_10px_30px_rgba(0,0,0,0.3)] transition-transform hover:-translate-y-1"
          >
            <MapPin size={120} className="absolute -bottom-10 -right-10 text-slate-800/50 rotate-12" />
            <h4 className="text-2xl font-black text-white mb-4 flex items-center gap-3">
              <span className="p-2 bg-slate-800 rounded-lg text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"><MapPin size={20}/></span>
              Catálogo de Locaciones
            </h4>
            <p className="text-slate-400 mb-6 relative z-10 leading-relaxed text-justify">
              ¿Conocés un lugar increíble para filmar? Como usuario registrado, podés proponer escenarios naturales, urbanos o abandonados. Subí fotos, sumá coordenadas y ayudá a enriquecer el mapa interactivo de Tierra del Fuego.
            </p>
            <Link href="/locaciones">
              <button className="text-sm font-bold text-orange-500 hover:text-orange-400 flex items-center gap-2 transition-colors relative z-10">
                Explorar Locaciones <ArrowRight size={16} />
              </button>
            </Link>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            className="bg-gradient-to-bl from-slate-900/60 to-slate-950/60 backdrop-blur-md border border-slate-700/50 rounded-3xl p-10 overflow-hidden relative shadow-[inset_0_1px_0_rgba(255,255,255,0.1),_0_10px_30px_rgba(0,0,0,0.3)] transition-transform hover:-translate-y-1"
          >
            <Clapperboard size={120} className="absolute -bottom-10 -right-10 text-slate-800/50 -rotate-12" />
            <h4 className="text-2xl font-black text-white mb-4 flex items-center gap-3">
              <span className="p-2 bg-slate-800 rounded-lg text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"><Video size={20}/></span>
              Si sos Productora
            </h4>
            <p className="text-slate-400 mb-6 relative z-10 leading-relaxed text-justify">
              Usá la plataforma para publicar tus propios proyectos. Definí qué perfiles técnicos o artísticos necesitás, especificá si es un proyecto remunerado o colaborativo, y gestioná cómodamente a todos tus postulantes.
            </p>
            <Link href="/proyectos">
              <button className="text-sm font-bold text-blue-500 hover:text-blue-400 flex items-center gap-2 transition-colors relative z-10">
                Ver Cartelera <ArrowRight size={16} />
              </button>
            </Link>
          </motion.div>
        </div>

        {/* CALL TO ACTION */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-50px" }}
          className="bg-gradient-to-r from-orange-600/90 to-red-600/90 backdrop-blur-md rounded-[3rem] p-12 text-center relative overflow-hidden shadow-[0_20px_40px_rgba(234,88,12,0.3)] border border-orange-500/50"
        >
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
          <h3 className="text-3xl md:text-5xl font-black text-white mb-6 tracking-tight relative z-10">
            ¿Listo para mostrar tu talento?
          </h3>
          <p className="text-orange-100 mb-10 max-w-2xl mx-auto relative z-10 text-lg">
            Sumate a la comunidad audiovisual de Tierra del Fuego. Es completamente gratis y solo lleva unos minutos.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 relative z-10">
            <Link href="/registro">
              <button className="px-8 py-4 bg-white text-orange-600 rounded-xl font-bold hover:bg-slate-100 hover:scale-105 transition-all shadow-xl w-full sm:w-auto">
                Crear cuenta gratis
              </button>
            </Link>
            <Link href="/guia">
              <button className="px-8 py-4 bg-orange-700/50 text-white rounded-xl font-bold hover:bg-orange-700/70 border border-orange-400/50 hover:scale-105 transition-all w-full sm:w-auto backdrop-blur-sm">
                Explorar Guía de Talento
              </button>
            </Link>
          </div>
        </motion.div>

      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function Page() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      const user = raw ? (JSON.parse(raw) as { role?: string }) : null;
      setIsAdmin(user?.role === "admin");
    } catch {
      setIsAdmin(false);
    }
  }, []);

  return (
    <main className="relative min-h-[100dvh] bg-slate-950">
      {/* 1. Componente 3D principal */}
      <SplatScrollLanding isAdmin={isAdmin} />

      {/* 2. Sección "Cómo Funciona" con z-index para deslizarse por encima */}
      <section className="relative z-30 pointer-events-none">
        
        {/* Espaciador crucial: Da tiempo para que en móvil (y desktop) se termine de leer 
            el último bloque del 3D antes de que el fondo sólido empiece a subir. */}
        <div className="h-[300vh] md:h-[280vh] w-full" />

        {/* CONTENEDOR INTERACTIVO */}
        <div className="pointer-events-auto">
          {/* Degradado superior: fundido suave de transparente al color oscuro */}
          <div className="h-40 w-full bg-gradient-to-b from-transparent to-slate-950/90" />
          
          {/* Contenido con fondo al 80% + difuminado para que se trasluzca el 3D */}
          <div className="bg-slate-950/80 backdrop-blur-md">
            <ComoFuncionaSection />
          </div>

          {/* Degradado inferior: fundido suave hacia abajo volviendo a transparente para mostrar el 3D */}
          <div className="h-200 w-full bg-gradient-to-b from-slate-950/60 to-transparent" />
        </div>

      </section>
    </main>
  );
}