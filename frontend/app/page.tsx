'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';

// 1. Animación de Entrada (Más dramática)
const fadeInUp = {
  hidden: { opacity: 0, y: 60 }, // Empieza más abajo
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 1, ease: "easeOut" } 
  }
};

// 2. Animación de Cascada (Para las tarjetas)
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.3 } // Más tiempo entre cada tarjeta
  }
};

// 3. Animación de "Levitación" (Flotar suavemente) 🛸
const floating = {
  animate: {
    y: [0, -15, 0], // Sube 15px y baja
    transition: {
      duration: 4, // Tarda 4 segundos en el ciclo
      repeat: Infinity,
      ease: "easeInOut" // Movimiento suave, sin golpes
    }
  }
};

// 4. Animación de "Latido" (Para el botón principal) 💓
const heartbeat = {
  animate: {
    scale: [1, 1.05, 1],
    boxShadow: [
      "0px 0px 0px rgba(234, 88, 12, 0)",
      "0px 0px 20px rgba(234, 88, 12, 0.5)",
      "0px 0px 0px rgba(234, 88, 12, 0)"
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans overflow-x-hidden">
      
      {/* --- HERO SECTION --- */}
      <div className="relative h-[90vh] flex items-center justify-center overflow-hidden">
        
        {/* Fondo con "Respiración" Profunda */}
        <div className="absolute inset-0 z-0">
          <motion.img 
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ duration: 20, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
            src="https://images.unsplash.com/photo-1518182170546-0766ce6fec56?q=80&w=2600&auto=format&fit=crop" // Cambié a una foto más mística de nieve
            alt="Paisaje TDF" 
            className="w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-slate-950/50 to-slate-950"></div>
        </div>

        {/* Contenido Principal */}
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="relative z-10 text-center px-6 max-w-5xl mx-auto mt-10"
        >
          {/* Título Flotante */}
          <motion.div variants={floating} animate="animate">
            <motion.span variants={fadeInUp} className="text-orange-400 font-bold tracking-[0.4em] uppercase text-sm md:text-base block mb-4 glow-text">
              Film Commission Tierra del Fuego
            </motion.span>
            
            <motion.h1 variants={fadeInUp} className="text-6xl md:text-8xl lg:text-9xl font-black mb-8 tracking-tighter leading-none drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)]">
              FILMA EN EL <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-red-500 to-purple-600 animate-gradient-x">
                FIN DEL MUNDO
              </span>
            </motion.h1>
          </motion.div>
          
          <motion.p variants={fadeInUp} className="text-lg md:text-2xl text-slate-200 max-w-2xl mx-auto mb-12 font-light leading-relaxed drop-shadow-md">
            Conecta tu visión con los escenarios más australes del planeta.
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-col md:flex-row gap-6 justify-center items-center">
            
            {/* Botón con Latido */}
            <Link href="/locaciones" className="w-full md:w-auto">
              <motion.button 
                variants={heartbeat}
                animate="animate"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="px-10 py-5 bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold rounded-full w-full md:w-auto text-lg tracking-wide border border-orange-500/50"
              >
                Explorar Locaciones
              </motion.button>
            </Link>

            <Link href="/guia" className="w-full md:w-auto">
              <motion.button 
                whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.15)" }}
                whileTap={{ scale: 0.95 }}
                className="px-10 py-5 bg-white/5 backdrop-blur-md text-white border border-white/20 font-bold rounded-full w-full md:w-auto text-lg tracking-wide hover:border-white/50 transition-colors"
              >
                Buscar Talento
              </motion.button>
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* --- SECCIÓN DE SERVICIOS FLOTANTES --- */}
      <section className="py-24 px-6 max-w-7xl mx-auto relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">Todo para tu Rodaje</h2>
          <div className="h-1 w-20 bg-orange-500 mx-auto rounded-full"></div>
        </motion.div>

        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {[
            { icon: "🏔️", title: "Scouting", desc: "Glaciares, bosques y estepas a tu alcance.", delay: 0 },
            { icon: "🎥", title: "Talento Local", desc: "Técnicos y productoras de nivel internacional.", delay: 2 }, // Delay para desfasar la flotación
            { icon: "📋", title: "Gestión de proyectos", desc: "Gestión y busqueda de proyectos audiovisuales", delay: 4 }
          ].map((item, index) => (
            <motion.div 
              key={index}
              variants={fadeInUp}
              animate={{ 
                y: [0, -10, 0], // Flotación individual
                transition: { 
                  duration: 5, 
                  repeat: Infinity, 
                  ease: "easeInOut", 
                  delay: item.delay // Cada tarjeta flota a distinto ritmo
                }
              }}
              whileHover={{ y: -20, scale: 1.02, transition: { duration: 0.3 } }} // Sube más al pasar el mouse
              className="bg-slate-900/60 backdrop-blur-sm p-10 rounded-3xl border border-white/5 hover:border-orange-500/50 hover:bg-slate-900/80 transition-colors group cursor-default shadow-2xl"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 group-hover:rotate-6 transition duration-300 shadow-inner border border-white/5">
                {item.icon}
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white group-hover:text-orange-400 transition-colors">{item.title}</h3>
              <p className="text-slate-400 leading-relaxed font-light">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Footer minimalista */}
      <footer className="py-12 text-center text-slate-600 text-sm">
        <p>© 2026 TDF FILM COMMISSION</p>
      </footer>
    </div>
  );
}