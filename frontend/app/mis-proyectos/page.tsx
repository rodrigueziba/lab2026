'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Edit, Trash2, Plus, Film, Users, Eye, MapPin, Calendar } from 'lucide-react';

export default function MisProyectosPage() {
  const router = useRouter();
  const [proyectos, setProyectos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // 1. Verificar Sesión
    const userStr = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!token || !userStr) {
      router.push('/login');
      return;
    }
    
    const userData = JSON.parse(userStr);
    setUser(userData);

    // 2. Traer Proyectos del Usuario
    fetch('http://localhost:3000/proyecto')
      .then(res => res.json())
      .then(data => {
        // Filtramos por ID de usuario
        const misProyectos = data.filter((p: any) => p.userId === userData.id);
        setProyectos(misProyectos);
        setLoading(false);
      })
      .catch(err => console.error(err));
  }, [router]);

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este proyecto? Esta acción es irreversible.')) return;

    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:3000/proyecto/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setProyectos(proyectos.filter(p => p.id !== id));
    } catch (error) {
      alert("Error al eliminar");
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
    </div>
  );

  return (
    // PT-24: Corrección clave para evitar superposición con el Navbar
    <div className="min-h-screen bg-slate-950 text-white font-sans pt-28 pb-12 px-6">
      
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER DASHBOARD */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6 border-b border-slate-800/50 pb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-2">
              GESTIÓN DE <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">PROYECTOS</span>
            </h1>
            <p className="text-slate-400 font-light text-lg">
              Hola <span className="text-white font-bold">{user?.nombre}</span>, aquí tienes el control de tus rodajes.
            </p>
          </div>
          
          <Link 
            href="/mis-proyectos/crear" 
            className="bg-white text-slate-950 hover:bg-slate-200 px-6 py-3 rounded-full font-bold text-sm flex items-center gap-2 shadow-lg hover:-translate-y-1 transition-all"
          >
            <Plus size={18} /> Crear Nuevo Proyecto
          </Link>
        </div>

        {/* LISTA DE PROYECTOS */}
        {proyectos.length === 0 ? (
          <div className="text-center py-24 bg-slate-900/30 rounded-3xl border border-dashed border-slate-800 flex flex-col items-center">
            <div className="bg-slate-900 p-4 rounded-full mb-4">
               <Film size={32} className="text-slate-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-300 mb-2">Tu portafolio está vacío</h3>
            <p className="text-slate-500 mb-6 max-w-md">
              Aún no has publicado ningún casting o rodaje. ¡Es hora de empezar a buscar talento!
            </p>
            <Link href="/mis-proyectos/crear" className="text-orange-500 font-bold hover:text-orange-400 hover:underline">
              + Crear mi primer proyecto
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {proyectos.map((p) => (
              <div key={p.id} className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-orange-500/30 transition-all flex flex-col md:flex-row shadow-lg">
                
                {/* 1. IMAGEN (Izquierda) */}
                <div className="w-full md:w-48 h-48 md:h-auto relative overflow-hidden bg-slate-950 shrink-0">
                   {p.foto ? (
                     <img src={p.foto} className="w-full h-full object-cover group-hover:scale-105 transition duration-700 opacity-80 group-hover:opacity-100" />
                   ) : (
                     <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 bg-slate-950/50">
                        <Film size={24} className="mb-2 opacity-50"/>
                        <span className="text-[10px] font-bold uppercase tracking-widest">Sin Poster</span>
                     </div>
                   )}
                   {/* Badge Tipo sobre imagen */}
                   <div className="absolute top-3 left-3">
                      <span className="bg-black/60 backdrop-blur text-white text-[10px] font-bold uppercase px-2 py-1 rounded border border-white/10">
                        {p.tipo}
                      </span>
                   </div>
                </div>

                {/* 2. INFO (Centro) */}
                <div className="flex-1 p-6 md:p-8 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-bold text-white group-hover:text-orange-500 transition">
                      {p.titulo}
                    </h3>
                    {p.estado === 'Abierto' && (
                      <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Activo
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-slate-400 font-medium mb-4">
                    <span className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                       <MapPin size={12}/> {p.ciudad || 'Ushuaia'}
                    </span>
                    <span className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                       <Users size={12}/> {p.puestos.length} Vacantes
                    </span>
                    <span className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                       <Calendar size={12}/> {p.fechaInicio ? new Date(p.fechaInicio).toLocaleDateString() : 'Sin fecha'}
                    </span>
                  </div>

                  {/* Acciones Rápidas */}
                  <div className="flex gap-3 mt-auto pt-4 border-t border-slate-800/50">
                     <Link 
                       href={`/proyectos/${p.id}`} 
                       className="text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1 transition"
                     >
                       <Eye size={14}/> Ver como Visitante
                     </Link>
                  </div>
                </div>

                {/* 3. BOTONES ACCIÓN (Derecha) */}
                <div className="p-6 md:border-l border-slate-800 flex md:flex-col justify-center gap-3 bg-slate-900/50">
                 <Link 
                href={`/mis-proyectos/editar/${p.id}`}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white px-4 py-2 rounded-lg transition text-xs font-bold"
                    >
                    <Edit size={16} /> Editar
                </Link>
                <Link 
  href={`/mis-proyectos/candidatos/${p.id}`}
  className="flex items-center gap-2 bg-slate-800 hover:bg-orange-600 text-slate-300 hover:text-white px-4 py-2 rounded-lg transition text-xs font-bold"
>
  <Users size={16} /> Ver Candidatos
</Link>
                  <button 
                    onClick={() => handleDelete(p.id)} 
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white px-4 py-2 rounded-lg transition text-xs font-bold"
                  >
                    <Trash2 size={16} /> Borrar
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}