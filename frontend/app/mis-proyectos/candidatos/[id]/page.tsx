'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, User, Mail, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function GestionCandidatosPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  const [candidatos, setCandidatos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [proyectoTitulo, setProyectoTitulo] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      if (!token) return router.push('/login');

      try {
        // 1. Obtener nombre del proyecto (opcional, para el título)
        const resProj = await fetch(`${apiUrl}/proyecto/${id}`);
        const dataProj = await resProj.json();
        setProyectoTitulo(dataProj.titulo);

        // 2. Obtener Postulaciones
        const resPost = await fetch(`${apiUrl}/postulacion/proyecto/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (resPost.ok) {
          const data = await resPost.json();
          setCandidatos(data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, router]);

  // --- FUNCIÓN PARA CAMBIAR ESTADO (NUEVA) ---
  const handleUpdateEstado = async (postulacionId: number, nuevoEstado: 'Aceptada' | 'Rechazada') => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${apiUrl}/postulacion/${postulacionId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ estado: nuevoEstado })
      });

      if (res.ok) {
        // Actualizamos la lista localmente para ver el cambio instantáneo
        setCandidatos(prev => prev.map(c => 
          c.id === postulacionId ? { ...c, estado: nuevoEstado } : c
        ));
        
        if(nuevoEstado === 'Aceptada') {
            alert("¡Postulación Aceptada! 🎉");
        }
      } else {
        alert("Error al actualizar el estado.");
      }
    } catch (error) {
      console.error(error);
      alert("Error de conexión.");
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-orange-500"/></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 pt-28 font-sans">
      <div className="max-w-5xl mx-auto">
        
        <Link href="/mis-proyectos" className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition">
          <ArrowLeft size={16}/> Volver a Mis Proyectos
        </Link>

        <div className="flex justify-between items-end mb-8 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-black mb-2">Gestión de Candidatos</h1>
            <p className="text-slate-400">Postulaciones para: <span className="text-orange-500 font-bold">{proyectoTitulo}</span></p>
          </div>
          <div className="bg-slate-900 px-4 py-2 rounded-lg border border-slate-800">
             <span className="font-bold text-xl">{candidatos.length}</span> <span className="text-xs text-slate-500 uppercase">Postulantes</span>
          </div>
        </div>

        {candidatos.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/50 rounded-3xl border border-dashed border-slate-800">
            <User size={48} className="text-slate-700 mx-auto mb-4"/>
            <p className="text-slate-400">Aún no hay postulaciones para este proyecto.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {candidatos.map((c) => (
              <div key={c.id} className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:border-orange-500/30 transition">
                
                {/* Info Candidato */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xl text-slate-500 shrink-0">
                    {c.postulante.nombre[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{c.postulante.nombre}</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                       <span className="bg-slate-800 px-2 py-0.5 rounded text-xs uppercase font-bold text-blue-400">{c.puesto.nombre}</span>
                       <span>• {new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Mensaje */}
                <div className="flex-1 md:px-8">
                   <p className="text-sm text-slate-300 italic">"{c.mensaje}"</p>
                </div>

                {/* Acciones */}
                <div className="flex gap-3 shrink-0 items-center">
                  
                  {/* Botón Contactar (Siempre visible o condicional, según prefieras) */}
                  <button title="Contactar por Email" className="p-3 bg-slate-800 hover:bg-blue-600 rounded-full transition text-slate-400 hover:text-white" onClick={() => window.open(`mailto:${c.postulante.email}`)}>
                    <Mail size={18}/>
                  </button>
                  
                  <div className="w-px h-8 bg-slate-800 mx-2"></div>

                  {/* Botón Aceptar (Solo si NO está aceptada ya) */}
                  {c.estado !== 'Aceptada' && (
                      <button 
                        onClick={() => handleUpdateEstado(c.id, 'Aceptada')}
                        title="Aceptar Postulación" 
                        className="p-3 bg-slate-800 hover:bg-emerald-600 text-emerald-500 hover:text-white rounded-full transition border border-slate-700"
                      >
                        <CheckCircle size={18}/>
                      </button>
                  )}

                  {/* Botón Rechazar (Solo si NO está rechazada ya) */}
                  {c.estado !== 'Rechazada' && (
                      <button 
                        onClick={() => handleUpdateEstado(c.id, 'Rechazada')}
                        title="Rechazar" 
                        className="p-3 bg-slate-800 hover:bg-red-600 text-red-500 hover:text-white rounded-full transition border border-slate-700"
                      >
                        <XCircle size={18}/>
                      </button>
                  )}

                  {/* Badges de Estado */}
                  {c.estado === 'Aceptada' && <span className="text-emerald-400 font-bold text-sm px-3 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 flex items-center gap-2"><CheckCircle size={14}/> Aceptado</span>}
                  {c.estado === 'Rechazada' && <span className="text-red-400 font-bold text-sm px-3 py-2 bg-red-500/10 rounded-lg border border-red-500/20 flex items-center gap-2"><XCircle size={14}/> Rechazado</span>}
                  
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}