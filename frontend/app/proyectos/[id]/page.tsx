'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { 
  Calendar, MapPin, Clock, DollarSign, GraduationCap, 
  Users, ChevronLeft, Mail, Star, CheckCircle 
} from 'lucide-react';

const getYoutubeId = (url: string) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export default function DetalleProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params); 
  const id = resolvedParams.id;

  const [proyecto, setProyecto] = useState<any>(null);
  const [candidatos, setCandidatos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  
  const [misPostulaciones, setMisPostulaciones] = useState<number[]>([]); 

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');

        const resProj = await fetch(`${apiUrl}/proyecto/${id}`);
        const dataProj = await resProj.json();
        setProyecto(dataProj);

        const resMatch = await fetch(`${apiUrl}/proyecto/${id}/matches`);
        if (resMatch.ok) {
           const dataMatch = await resMatch.json();
           setCandidatos(dataMatch);
        }

        if (token) {
           const userStr = localStorage.getItem('user');
           if (userStr) {
             const user = JSON.parse(userStr);
             const resMyApps = await fetch(`${apiUrl}/postulacion/proyecto/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
             });
             if (resMyApps.ok) {
                const apps = await resMyApps.json();
                // Filtramos cuáles son mías
                const misApps = apps
                  .filter((a: any) => a.postulanteId === user.id) // OJO: Asegúrate que user.id existe
                  .map((a: any) => a.puestoId);
                setMisPostulaciones(misApps);
             }
           }
        }
        
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handlePostular = async (puestoId: number, puestoNombre: string) => {
    const token = localStorage.getItem('token');
    if (!token) {
      if(confirm("Debes iniciar sesión. ¿Ir al login?")) window.location.href = '/login';
      return;
    }

    if (!confirm(`¿Confirmas tu postulación para: ${puestoNombre}?`)) return;

    try {
      const res = await fetch(`${apiUrl}/postulacion`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          proyectoId: parseInt(id),
          puestoId: puestoId,
          mensaje: "¡Hola! Quiero sumarme al equipo."
        })
      });

      if (res.ok) {
        alert(`¡Listo! Te postulaste a ${puestoNombre}.`);
        // Actualizamos visualmente el botón al instante
        setMisPostulaciones([...misPostulaciones, puestoId]);
      } else {
        const error = await res.json();
        alert("Aviso: " + (error.message || "Error al postular."));
      }
    } catch (err) {
      alert("Error de conexión.");
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Cargando...</div>;
  if (!proyecto) return <div className="text-white text-center py-20">Proyecto no encontrado</div>;

  const videoRef = proyecto.referencias?.find((r: string) => r.includes('youtu'));
  const youtubeId = videoRef ? getYoutubeId(videoRef) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-20">
      
      {/* HERO SECTION */}
      <div className="relative h-[70vh] w-full overflow-hidden bg-black">
        <div className="absolute inset-0 z-0">
          {youtubeId ? (
             <iframe 
               src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtubeId}`}
               className="w-full h-full object-cover opacity-60 pointer-events-none scale-125"
               allow="autoplay"
             />
          ) : (
             <img src={proyecto.foto || proyecto.galeria?.[0] || '/placeholder-dark.jpg'} alt={proyecto.titulo} className="w-full h-full object-cover opacity-50" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent"></div>
        </div>

        <div className="absolute bottom-0 left-0 w-full z-10 px-6 pb-12">
          <div className="max-w-7xl mx-auto">
             <Link href="/proyectos" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition font-bold text-sm uppercase tracking-widest">
                <ChevronLeft size={16}/> Volver a Cartelera
             </Link>
             
             <div className="flex flex-col md:flex-row gap-8 items-end">
                <div className="hidden md:block w-48 h-72 rounded-xl overflow-hidden shadow-2xl border-4 border-slate-800 shrink-0 bg-slate-900 flex items-center justify-center">
                   <img 
                     src={proyecto.foto || proyecto.galeria?.[0] || `https://placehold.co/300x450/0f172a/38bdf8?text=${encodeURIComponent(proyecto.titulo)}`} 
                     alt={proyecto.titulo}
                     className="w-full h-full object-cover" 
                   />
                </div>

                <div className="flex-1">
                   <div className="flex gap-3 mb-4">
                      {proyecto.esRemunerado && <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-lg"><DollarSign size={12}/> REMUNERADO</span>}
                      <span className="bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase">{proyecto.tipo}</span>
                   </div>
                   <h1 className="text-4xl md:text-7xl font-black mb-4 leading-none tracking-tighter">{proyecto.titulo}</h1>
                   <div className="flex gap-6 text-sm font-bold text-slate-300">
                      <span className="flex items-center gap-2"><MapPin size={16} className="text-orange-500"/> {proyecto.ciudad}</span>
                      <span className="flex items-center gap-2"><Clock size={16} className="text-orange-500"/> Estado: {proyecto.estado}</span>
                   </div>
                </div>

                {/* BOTÓN SCROLL */}
                <button 
                  onClick={() => document.getElementById('vacantes-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-white text-black hover:bg-slate-200 px-8 py-4 rounded-full font-black flex items-center gap-2 shadow-xl transition transform hover:scale-105"
                >
                   <Mail size={20}/> VER VACANTES
                </button>
             </div>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        {/* IZQUIERDA: SINOPSIS */}
        <div className="lg:col-span-2 space-y-12">
           <section>
              <h3 className="text-2xl font-black mb-6 flex items-center gap-2"><span className="w-1 h-8 bg-orange-600 rounded-full"></span> LA HISTORIA</h3>
              <p className="text-lg text-slate-300 leading-relaxed font-light whitespace-pre-line">{proyecto.descripcion}</p>
           </section>

           {/* SMART MATCH */}
           {candidatos.length > 0 && (
             <section className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800">
                <div className="flex items-center gap-3 mb-6">
                   <Star size={24} className="text-orange-500"/>
                   <h3 className="text-xl font-bold text-white">Smart Match ({candidatos.length})</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {candidatos.map((cand) => (
                      <div key={cand.id} className="flex items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                         <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-500">{cand.nombre[0]}</div>
                         <div>
                            <h4 className="font-bold text-white">{cand.nombre}</h4>
                            <p className="text-xs text-slate-400">{cand.rubro}</p>
                         </div>
                      </div>
                   ))}
                </div>
             </section>
           )}
        </div>

        {/* DERECHA: VACANTES (AQUÍ ESTÁ LA MAGIA) */}
        <div className="space-y-6" id="vacantes-section">
           <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sticky top-6">
              <h3 className="font-black text-xl mb-6 flex items-center gap-2"><Users className="text-orange-600"/> VACANTES ({proyecto.puestos.length})</h3>
              
              <div className="space-y-4">
                 {proyecto.puestos.map((puesto: any) => {
                    // Verificamos si YA ME POSTULÉ a este puesto
                    const yaPostulado = misPostulaciones.includes(puesto.id);

                    return (
                      <div key={puesto.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 hover:border-slate-600 transition">
                         <div className="flex justify-between mb-2">
                            <h4 className="font-bold text-white">{puesto.nombre}</h4>
                            {yaPostulado && <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-1 rounded font-bold border border-emerald-500/30">APLICADO</span>}
                         </div>
                         <p className="text-xs text-slate-500 line-clamp-2 mb-4">{puesto.descripcion || "Sin descripción"}</p>
                         
                         <div className="pt-3 border-t border-slate-900 flex justify-end">
                            {yaPostulado ? (
                              // ESTADO 1: YA POSTULADO (Botón Verde inhabilitado)
                              <button disabled className="text-xs font-bold text-emerald-500 flex items-center gap-1 cursor-default opacity-100">
                                <CheckCircle size={14}/> Ya te postulaste
                              </button>
                            ) : (
                              // ESTADO 2: DISPONIBLE (Botón Azul)
                              <button 
                                 onClick={() => handlePostular(puesto.id, puesto.nombre)}
                                 className="text-xs font-bold text-blue-500 hover:text-white transition flex items-center gap-1"
                              >
                                 Aplicar a este rol →
                              </button>
                            )}
                         </div>
                      </div>
                    );
                 })}
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}