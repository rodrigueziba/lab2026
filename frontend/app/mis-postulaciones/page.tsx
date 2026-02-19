'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Loader2, Briefcase, Calendar, CheckCircle, XCircle, Clock, ArrowRight 
} from 'lucide-react';

export default function MisPostulacionesPage() {
  const router = useRouter();
  const [postulaciones, setPostulaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      if (!token) return router.push('/login');

      try {
        const res = await fetch('http://localhost:3000/postulacion/mis-postulaciones', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setPostulaciones(data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [router]);

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-orange-500"/></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 pt-28 font-sans">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex justify-between items-end mb-8 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-black mb-2">Mis Postulaciones</h1>
            <p className="text-slate-400">Sigue el estado de tus aplicaciones a proyectos.</p>
          </div>
        </div>

        {postulaciones.length === 0 ? (
          <div className="text-center py-24 bg-slate-900/30 rounded-3xl border border-dashed border-slate-800">
            <Briefcase size={48} className="text-slate-700 mx-auto mb-4"/>
            <h3 className="text-xl font-bold text-white mb-2">Aún no te has postulado</h3>
            <p className="text-slate-400 mb-8">Explora la cartelera y únete a nuevos proyectos.</p>
            <Link href="/proyectos" className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-full font-bold transition">
              Ver Proyectos
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {postulaciones.map((post) => (
              <div key={post.id} className="bg-slate-900 p-6 rounded-2xl border border-slate-800 hover:border-slate-600 transition group flex flex-col md:flex-row gap-6 items-start md:items-center">
                
                {/* Imagen del Proyecto */}
                <div className="w-full md:w-24 h-24 md:h-24 bg-slate-950 rounded-xl overflow-hidden shrink-0 border border-slate-800 relative">
                  {post.proyecto.foto ? (
                    <img src={post.proyecto.foto} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-600 font-bold bg-slate-950">
                        {post.proyecto.titulo[0]}
                    </div>
                  )}
                  {/* Badge Tipo Proyecto */}
                  <div className="absolute bottom-0 left-0 w-full bg-black/60 backdrop-blur-sm text-[10px] text-center py-1 font-bold uppercase text-slate-300">
                    {post.proyecto.tipo}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1 group-hover:text-blue-400 transition">
                    {post.proyecto.titulo}
                  </h3>
                  <div className="flex flex-wrap gap-4 text-sm text-slate-400 mb-3">
                     <span className="flex items-center gap-1"><Briefcase size={14}/> {post.puesto.nombre}</span>
                     <span className="flex items-center gap-1"><Calendar size={14}/> {new Date(post.createdAt).toLocaleDateString()}</span>
                  </div>
                  
                  {/* Mensaje enviado (cortito) */}
                  {post.mensaje && (
                    <p className="text-xs text-slate-500 italic line-clamp-1">"{post.mensaje}"</p>
                  )}
                </div>

                {/* Estado y Acción */}
                <div className="flex flex-col items-end gap-3 min-w-[140px]">
                   {/* BADGES DE ESTADO */}
                   {post.estado === 'Pendiente' && (
                     <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-bold border border-yellow-500/20">
                        <Clock size={14}/> En Revisión
                     </span>
                   )}
                   {post.estado === 'Aceptada' && (
                     <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                        <CheckCircle size={14}/> ¡Seleccionado!
                     </span>
                   )}
                   {post.estado === 'Rechazada' && (
                     <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20">
                        <XCircle size={14}/> No seleccionado
                     </span>
                   )}

                   {/* Link al proyecto */}
                   <Link href={`/proyectos/${post.proyecto.id}`} className="text-xs font-bold text-slate-500 hover:text-white flex items-center gap-1 transition">
                      Ver Proyecto <ArrowRight size={12}/>
                   </Link>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}