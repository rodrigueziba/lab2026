'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, CheckCircle, XCircle, Clock, User, Mail, ShieldCheck, ExternalLink
} from 'lucide-react';

export default function GestionSolicitudesPage() {
  const router = useRouter();
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSolicitudes();
  }, []);

  const fetchSolicitudes = async () => {
    const token = localStorage.getItem('token');
    if (!token) return router.push('/login');

    try {
      const res = await fetch('http://localhost:3000/solicitud/recibidas', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSolicitudes(data);
      }
    } catch (error) {
      console.error("Error al cargar solicitudes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: number, nuevoEstado: 'Aprobada' | 'Rechazada') => {
    const token = localStorage.getItem('token');
    try {
      // Optimista
      setSolicitudes(prev => prev.map(sol => 
        sol.id === id ? { ...sol, estado: nuevoEstado } : sol
      ));

      await fetch(`http://localhost:3000/solicitud/${id}`, {
        method: 'PATCH',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ estado: nuevoEstado })
      });

    } catch (error) {
      alert("Error al actualizar.");
      fetchSolicitudes();
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Cargando...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white pt-28 pb-12 px-6 font-sans">
      <div className="max-w-4xl mx-auto">
        
        <button onClick={() => router.back()} className="text-slate-500 hover:text-white flex items-center gap-2 mb-6 transition">
          <ArrowLeft size={16}/> Volver
        </button>

        <div className="mb-10 border-b border-slate-800 pb-6">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500 mb-2">
                Solicitudes Recibidas
            </h1>
            <p className="text-slate-400">Usuarios interesados en tus perfiles.</p>
        </div>

        <div className="space-y-4">
            {solicitudes.length === 0 ? (
                <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed text-slate-500">
                    No hay solicitudes pendientes.
                </div>
            ) : (
                solicitudes.map((sol) => {
                    // Detectar si el solicitante tiene perfil para linkear
                    const perfilSolicitante = sol.solicitante.prestadores?.[0];

                    return (
                        <div key={sol.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6">
                            
                            {/* Estado Icono */}
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 
                                ${sol.estado === 'Pendiente' ? 'bg-yellow-500/10 text-yellow-500' : 
                                  sol.estado === 'Aprobada' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                {sol.estado === 'Pendiente' ? <Clock size={24}/> : (sol.estado === 'Aprobada' ? <CheckCircle size={24}/> : <XCircle size={24}/>)}
                            </div>

                            {/* Info */}
                            <div className="flex-1 text-center md:text-left">
                                <div className="flex items-center justify-center md:justify-start gap-2">
                                    <h3 className="font-bold text-lg text-white">{sol.solicitante.nombre}</h3>
                                    
                                    {/* LINK AL PERFIL DEL SOLICITANTE */}
                                    {perfilSolicitante && (
                                        <Link href={`/prestador/${perfilSolicitante.id}`} target="_blank" className="text-blue-400 hover:text-blue-300">
                                            <ExternalLink size={16}/>
                                        </Link>
                                    )}
                                </div>

                                <p className="text-slate-400 text-sm flex items-center justify-center md:justify-start gap-2">
                                    <Mail size={14}/> {sol.solicitante.email}
                                </p>
                                <p className="text-xs text-slate-500 mt-2">
                                    Interesado en tu perfil: <span className="text-white font-bold">{sol.prestador.nombre}</span>
                                </p>
                            </div>

                            {/* Botones */}
                            <div className="flex gap-3">
                                {sol.estado === 'Pendiente' ? (
                                    <>
                                        <button onClick={() => handleStatusChange(sol.id, 'Rechazada')} className="px-4 py-2 border border-slate-700 hover:bg-red-500/10 text-red-400 rounded-lg text-sm font-bold">Rechazar</button>
                                        <button onClick={() => handleStatusChange(sol.id, 'Aprobada')} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-900/20">Aprobar</button>
                                    </>
                                ) : (
                                    <span className="text-slate-500 text-sm font-medium px-4 py-2 bg-slate-950 rounded-lg border border-slate-800">
                                        {sol.estado}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
      </div>
    </div>
  );
}