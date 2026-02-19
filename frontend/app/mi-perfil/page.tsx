'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Briefcase, Plus, Edit, Trash2, Loader2, MapPin } from 'lucide-react';

export default function MisPerfilesPage() {
  const router = useRouter();
  const [perfiles, setPerfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (!userStr || !token) return router.push('/login');
    setUser(JSON.parse(userStr));

    fetchPerfiles(token);
  }, [router]);

  const fetchPerfiles = async (token: string) => {
    try {
      // Ojo: Usamos el endpoint nuevo 'mis-perfiles' que devuelve un array
      const res = await fetch('http://localhost:3000/prestador/mis-perfiles', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPerfiles(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if(!confirm("¿Seguro que quieres eliminar este perfil profesional?")) return;
    const token = localStorage.getItem('token');
    
    try {
        await fetch(`http://localhost:3000/prestador/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        // Recargar lista
        fetchPerfiles(token!);
    } catch (error) {
        console.error(error);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><Loader2 className="animate-spin"/></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pt-28 pb-12 px-6">
      <div className="max-w-5xl mx-auto">
        
        {/* ENCABEZADO */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12 border-b border-slate-800 pb-8">
            <div>
                <h1 className="text-3xl font-black mb-2 flex items-center gap-3">
                    <Briefcase className="text-orange-500" size={32}/> Mis Perfiles Profesionales
                </h1>
                <p className="text-slate-400 text-lg">
                    Gestiona tus identidades en la plataforma. Puedes tener un perfil personal y otros empresariales.
                </p>
            </div>
            
            <Link 
                href="/mi-perfil/crear" 
                className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-6 rounded-xl transition flex items-center gap-2 shadow-lg shadow-orange-900/20"
            >
                <Plus size={20}/> Nuevo Perfil
            </Link>
        </div>

        {/* LISTA DE PERFILES */}
        {perfiles.length === 0 ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center">
                <div className="bg-slate-800 p-6 rounded-full mb-6">
                    <User size={48} className="text-slate-500"/>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Aún no tienes perfiles activos</h3>
                <p className="text-slate-400 mb-8 max-w-md">
                    Crea tu primer perfil para aparecer en la Guía de Profesionales y aplicar a proyectos.
                </p>
                <Link href="/mi-perfil/crear" className="text-orange-500 font-bold hover:text-orange-400 border border-orange-500/30 hover:bg-orange-500/10 px-6 py-3 rounded-xl transition">
                    Crear mi primer perfil
                </Link>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {perfiles.map((perfil) => (
                    <div key={perfil.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-600 transition group">
                        {/* Cabecera Color */}
                        <div className="h-24 w-full relative" style={{ backgroundColor: perfil.colorTema || '#ea580c' }}>
                            {perfil.foto && (
                                <img src={perfil.foto} alt={perfil.nombre} className="absolute -bottom-8 left-6 w-16 h-16 rounded-xl border-4 border-slate-900 object-cover shadow-lg"/>
                            )}
                        </div>
                        
                        <div className="pt-10 px-6 pb-6">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <span className="text-[10px] font-bold bg-white/10 text-slate-300 px-2 py-1 rounded-md uppercase tracking-wide">
                                        {perfil.tipoPerfil}
                                    </span>
                                    <h3 className="text-xl font-bold text-white mt-3 truncate">{perfil.nombre}</h3>
                                    <p className="text-orange-500 font-medium text-sm">{perfil.rubro}</p>
                                </div>
                            </div>

                            <p className="text-slate-400 text-sm mb-6 line-clamp-2 min-h-[40px]">
                                {perfil.descripcion || "Sin descripción"}
                            </p>
                            
                            {perfil.ciudad && (
                                <div className="flex items-center gap-1 text-xs text-slate-500 mb-6">
                                    <MapPin size={12}/> {perfil.ciudad}
                                </div>
                            )}

                            <div className="flex gap-3 pt-4 border-t border-slate-800">
                                <Link 
                                    href={`/mi-perfil/editar/${perfil.id}`}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold py-2.5 rounded-lg flex justify-center items-center gap-2 transition"
                                >
                                    <Edit size={14}/> Editar
                                </Link>
                                <button 
                                    onClick={() => handleDelete(perfil.id)}
                                    className="px-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition"
                                >
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}

      </div>
    </div>
  );
}