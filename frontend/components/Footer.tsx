import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 py-12 mt-auto">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* COLUMNA 1: LOGO Y MISIÓN */}
        <div>
          <h4 className="text-xl font-black tracking-tighter text-white mb-4">
            TDF<span className="text-orange-600">FILM</span>
          </h4>
          <p className="text-slate-500 text-sm leading-relaxed">
            Impulsando la industria audiovisual en el Fin del Mundo. 
            Conectamos talento, locaciones y producciones en Tierra del Fuego.
          </p>
        </div>

        {/* COLUMNA 2: NAVEGACIÓN */}
        <div>
          <h5 className="font-bold text-white mb-4 uppercase text-xs tracking-wider">Explorar</h5>
          <ul className="space-y-2 text-sm text-slate-500">
            <li><Link href="/locaciones" className="hover:text-orange-500 transition">Locaciones</Link></li>
            <li><Link href="/guia" className="hover:text-orange-500 transition">Guía de Profesionales</Link></li>
            <li><Link href="/proyectos" className="hover:text-orange-500 transition">Cartelera de Proyectos</Link></li>
          </ul>
        </div>

        {/* COLUMNA 3: CONTACTO (Sin Comunidad por ahora) */}
        <div>
          <h5 className="font-bold text-white mb-4 uppercase text-xs tracking-wider">Contacto</h5>
          <p className="text-sm text-slate-500 mb-2">info@filmcommissiontdf.com.ar</p>
          <p className="text-sm text-slate-500">Ushuaia, Tierra del Fuego, Argentina</p>
        </div>
      </div>

      <div className="text-center mt-12 pt-8 border-t border-slate-900 text-xs text-slate-600">
        © 2026 Film Commission TDF. Todos los derechos reservados.
      </div>
    </footer>
  );
}