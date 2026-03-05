'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  UserPlus, 
  Search, 
  Briefcase, 
  Bell, 
  MapPin, 
  Sparkles, 
  ArrowRight, 
  Video,
  Clapperboard
} from 'lucide-react';

export default function ComoFuncionaPage() {
  // Variantes para animación en cascada (stagger)
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 pt-24 pb-20 relative overflow-hidden">
      
      {/* Elementos decorativos de fondo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-orange-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 md:px-12 relative z-10">
        
        {/* ENCABEZADO */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-orange-500 text-xs font-bold tracking-widest uppercase mb-6">
            <Sparkles size={14} />
            Guía de la Plataforma
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">
            Impulsa tu carrera en el <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500">
              Sector Audiovisual
            </span>
          </h1>
          <p className="text-lg text-slate-400">
            Descubre cómo la Film Commission TDF conecta tu talento con las mejores producciones de la provincia. Todo lo que necesitas saber si eres un prestador de servicios.
          </p>
        </motion.div>

        {/* RECORRIDO DEL PRESTADOR (TIMELINE) */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="mb-24"
        >
          <h2 className="text-2xl font-black text-white mb-10 text-center uppercase tracking-wider">
            El recorrido del Prestador
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Paso 1 */}
            <motion.div variants={itemVariants} className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-8 rounded-3xl hover:bg-slate-800/50 transition-colors group">
              <div className="w-14 h-14 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <UserPlus size={28} />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">1. Crea tu Perfil</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Regístrate y arma tu currículum digital. Puedes crear múltiples perfiles (ej. como Sonidista freelance y como Productora). Utiliza nuestra IA integrada para redactar tu biografía profesional.
              </p>
            </motion.div>

            {/* Paso 2 */}
            <motion.div variants={itemVariants} className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-8 rounded-3xl hover:bg-slate-800/50 transition-colors group relative mt-0 lg:mt-8">
              <div className="hidden lg:block absolute -left-6 top-14 w-6 border-t-2 border-dashed border-slate-700"></div>
              <div className="w-14 h-14 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Search size={28} />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">2. Hazte Visible</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Al activar tu perfil, aparecerás automáticamente en la <strong>Guía de Talento</strong> pública. Directores y productoras podrán filtrarte por ciudad y rubro para contratarte directamente.
              </p>
            </motion.div>

            {/* Paso 3 */}
            <motion.div variants={itemVariants} className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-8 rounded-3xl hover:bg-slate-800/50 transition-colors group relative mt-0 lg:mt-16">
              <div className="hidden lg:block absolute -left-6 top-14 w-6 border-t-2 border-dashed border-slate-700"></div>
              <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Briefcase size={28} />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">3. Encuentra Trabajo</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Revisa la <strong>Cartelera de Proyectos</strong>. Podrás ver los rodajes activos en la provincia y postularte con un solo clic a los puestos que las productoras están solicitando.
              </p>
            </motion.div>

            {/* Paso 4 */}
            <motion.div variants={itemVariants} className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-8 rounded-3xl hover:bg-slate-800/50 transition-colors group relative mt-0 lg:mt-24">
              <div className="hidden lg:block absolute -left-6 top-14 w-6 border-t-2 border-dashed border-slate-700"></div>
              <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Bell size={28} />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">4. Conecta</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Recibe notificaciones en tiempo real cuando un proyecto acepte tu postulación o cuando alguien solicite tus datos de contacto para una producción.
              </p>
            </motion.div>

          </div>
        </motion.div>

        {/* CARACTERÍSTICAS ADICIONALES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-10 overflow-hidden relative"
          >
            <MapPin size={120} className="absolute -bottom-10 -right-10 text-slate-800/50 rotate-12" />
            <h3 className="text-2xl font-black text-white mb-4 flex items-center gap-3">
              <span className="p-2 bg-slate-800 rounded-lg text-slate-300"><MapPin size={20}/></span>
              Catálogo de Locaciones
            </h3>
            <p className="text-slate-400 mb-6 relative z-10">
              ¿Conoces un lugar increíble para filmar? Como usuario registrado, puedes proponer escenarios naturales, urbanos o abandonados. Sube fotos, añade coordenadas y ayuda a enriquecer el mapa interactivo de Tierra del Fuego.
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
            viewport={{ once: true }}
            className="bg-gradient-to-bl from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-10 overflow-hidden relative"
          >
            <Clapperboard size={120} className="absolute -bottom-10 -right-10 text-slate-800/50 -rotate-12" />
            <h3 className="text-2xl font-black text-white mb-4 flex items-center gap-3">
              <span className="p-2 bg-slate-800 rounded-lg text-slate-300"><Video size={20}/></span>
              Si eres Productora
            </h3>
            <p className="text-slate-400 mb-6 relative z-10">
              Usa la plataforma para publicar tus propios proyectos. Define qué perfiles técnicos o artísticos necesitas, especifica si es un proyecto remunerado o colaborativo, y gestiona cómodamente a todos tus postulantes.
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
          viewport={{ once: true }}
          className="bg-gradient-to-r from-orange-600 to-red-600 rounded-[3rem] p-12 text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
          <h2 className="text-3xl md:text-5xl font-black text-white mb-6 tracking-tight relative z-10">
            ¿Listo para mostrar tu talento?
          </h2>
          <p className="text-orange-100 mb-10 max-w-2xl mx-auto relative z-10 text-lg">
            Únete a la comunidad audiovisual de Tierra del Fuego. Es completamente gratis y solo toma unos minutos.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 relative z-10">
            <Link href="/registro">
              <button className="px-8 py-4 bg-white text-orange-600 rounded-xl font-bold hover:bg-slate-100 transition-colors shadow-xl w-full sm:w-auto">
                Crear cuenta gratis
              </button>
            </Link>
            <Link href="/guia">
              <button className="px-8 py-4 bg-orange-700/50 text-white rounded-xl font-bold hover:bg-orange-700/70 border border-orange-500/30 transition-colors w-full sm:w-auto backdrop-blur-sm">
                Explorar Guía de Talento
              </button>
            </Link>
          </div>
        </motion.div>

      </div>
    </div>
  );
}