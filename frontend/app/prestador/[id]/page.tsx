'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2'; // 👈 Importamos SweetAlert
import { 
  MapPin, Mail, Phone, Globe, User, Briefcase, 
  Image as ImageIcon, CheckCircle, Loader2, Lock, Clock, XCircle 
} from 'lucide-react';

export default function DetallePrestadorPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [prestador, setPrestador] = useState<any>(null);
  const [accessStatus, setAccessStatus] = useState<'Ninguna' | 'Pendiente' | 'Aprobada' | 'Rechazada'>('Ninguna');
  const [loading, setLoading] = useState(true);
  const [solicitando, setSolicitando] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const tvScanline = { 
    backgroundImage: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))", 
    backgroundSize: "100% 2px, 3px 100%", 
    pointerEvents: "none" as const 
  };
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  useEffect(() => {
    params.then(unwrap => {
      fetchData(unwrap.id);
    });
  }, [params]);

  const fetchData = async (id: string) => {
    try {
      const res = await fetch(`${apiUrl}/prestador/detalle/${id}`);
      if (!res.ok) throw new Error("No se encontró el perfil");
      const data = await res.json();
      setPrestador(data);

      const token = localStorage.getItem('token');
      if (token) {
        const resAccess = await fetch(`${apiUrl}/solicitud/check/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resAccess.ok) {
            const accessData = await resAccess.json();
            setAccessStatus(accessData.status);
            
            if (accessData.status === 'Aprobada' && accessData.datos) {
                setPrestador((prev: any) => ({
                    ...prev,
                    email: accessData.datos.email,
                    telefono: accessData.datos.telefono
                }));
            }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!prestador?.galeria || prestador.galeria.length <= 1) return;
    const interval = setInterval(() => setCurrentSlide(prev => (prev + 1) % prestador.galeria.length), 4000);
    return () => clearInterval(interval);
  }, [prestador]);

  // Lógica de Solicitar Contacto (MEJORADA CON ERRORES)
  const handleSolicitarContacto = async () => {
    const token = localStorage.getItem('token');
    if (!token) return router.push('/login');

    setSolicitando(true);
    try {
        const res = await fetch(`${apiUrl}/solicitud`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ prestadorId: prestador.id })
        });

        // Siempre leemos la respuesta, sea éxito o error
        const data = await res.json();

        if (res.ok) {
            setAccessStatus('Pendiente');
            Swal.fire({
                title: '¡Solicitud Enviada!',
                text: 'El profesional ha sido notificado.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            Swal.fire({
                title: 'Atención',
                text: data.message || "No se pudo realizar la solicitud.",
                icon: 'warning',
                confirmButtonColor: '#ea580c'
            });
        }
    } catch (e) { 
        console.error(e);
        Swal.fire('Error', 'Error de conexión con el servidor', 'error');
    } finally { 
        setSolicitando(false); 
    }
  };

  const getYoutubeId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Cargando...</div>;
  if (!prestador) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-400">Error cargando perfil.</div>;

  const videoId = getYoutubeId(prestador.videoReel);
  const esEmpresa = ['Productora', 'Empresa'].includes(prestador.tipoPerfil);

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans overflow-x-hidden">
      
      {/* CABECERA */}
      <div className="relative h-[60vh] w-full bg-black overflow-hidden group">
        {videoId ? (
           <div className="absolute inset-0 w-full h-full"><iframe className="w-full h-full scale-125 pointer-events-none opacity-60" src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&showinfo=0&modestbranding=1`}></iframe></div>
        ) : (
           prestador.foto ? <img src={prestador.foto} className="w-full h-full object-cover opacity-50 blur-sm animate-pulse duration-[5000ms]" /> : <div className="w-full h-full bg-slate-900 flex items-center justify-center opacity-30"><Briefcase size={100}/></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent"></div>
        <div className="absolute inset-0 z-10" style={tvScanline}></div>
        
        <div className="absolute bottom-0 left-0 w-full p-8 md:p-16 z-20 flex flex-col items-center text-center animate-in slide-in-from-bottom duration-1000">
            <div className="relative group-hover:scale-105 transition-transform duration-500">
                <div className="w-32 h-32 md:w-48 md:h-48 rounded-2xl overflow-hidden border-4 border-white/10 shadow-2xl bg-slate-800 mx-auto">
                    {prestador.foto ? <img src={prestador.foto} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-500"><User size={48}/></div>}
                </div>
                <div className="absolute -bottom-3 -right-3 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">{prestador.tipoPerfil}</div>
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white drop-shadow-2xl mt-4">{prestador.nombre}</h1>
            <p className="text-xl md:text-2xl text-orange-500 font-bold mt-2 flex items-center justify-center gap-2 flex-wrap">{prestador.rubro} {prestador.ciudad && <span className="text-slate-400 text-sm font-normal flex items-center gap-1"><MapPin size={14}/> {prestador.ciudad}</span>}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          
          {/* COLUMNA IZQUIERDA: tarjetas con hover tipo proyectos */}
          <div className="flex flex-col gap-8">
              <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl p-8 shadow-xl flex-1 transition-all hover:border-orange-500/30 hover:shadow-[0_0_30px_rgba(234,88,12,0.15)] hover:-translate-y-1 duration-300">
                  <h3 className="text-orange-500 font-black uppercase tracking-widest text-lg mb-4 border-b border-slate-800 pb-2">{esEmpresa ? 'Sobre la Empresa' : 'Sobre el Profesional'}</h3>
                  <p className="text-slate-300 text-lg leading-relaxed whitespace-pre-line">{prestador.descripcion || "Sin descripción."}</p>
              </div>
              
              {prestador.galeria && prestador.galeria.length > 0 && (
                  <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl p-6 shadow-xl transition-all hover:border-orange-500/30 hover:shadow-[0_0_30px_rgba(234,88,12,0.15)] hover:-translate-y-1 duration-300">
                      <h3 className="text-cyan-400 font-black uppercase tracking-widest text-lg mb-6 flex items-center gap-2 border-b border-slate-800 pb-2">
                          <ImageIcon size={20}/> Portfolio
                      </h3>
                      <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-slate-800 bg-black group">
                          {prestador.galeria.map((img: string, idx: number) => (
                              <div key={idx} className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === currentSlide ? 'opacity-100' : 'opacity-0'}`}>
                                  <img src={img} className="w-full h-full object-contain bg-black/90"/>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>

          {/* COLUMNA DERECHA (Contacto) — misma altura y estilo */}
          <div className="flex flex-col">
              <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl p-8 shadow-xl sticky top-24 flex-1 min-h-0 transition-all hover:border-orange-500/30 hover:shadow-[0_0_30px_rgba(234,88,12,0.15)] hover:-translate-y-1 duration-300">
                  <h3 className="text-white font-bold text-xl mb-6">Información de Contacto</h3>
                  
                  <div className="space-y-6">
                      <div className="group">
                          <div className="flex items-center gap-3 text-slate-400 mb-1 group-hover:text-orange-500 transition"><Mail size={18}/> <span className="text-xs font-bold uppercase">Email</span></div>
                          <p className="text-white font-medium break-all">
                              {accessStatus === 'Aprobada' ? (
                                <span className="text-emerald-400 font-bold">{prestador.email}</span>
                              ) : (
                                <span className="text-slate-500 italic flex items-center gap-2"><Lock size={14}/> 🔒 Solicitar contacto</span>
                              )}
                          </p>
                      </div>

                      <div className="group">
                          <div className="flex items-center gap-3 text-slate-400 mb-1 group-hover:text-orange-500 transition"><Phone size={18}/> <span className="text-xs font-bold uppercase">Teléfono</span></div>
                          <p className="text-white font-medium">
                              {accessStatus === 'Aprobada' ? (
                                <span className="text-emerald-400 font-bold">{prestador.telefono || "No especificado"}</span>
                              ) : (
                                <span className="text-slate-500 italic flex items-center gap-2"><Lock size={14}/> 🔒 Solicitar contacto</span>
                              )}
                          </p>
                      </div>

                      {prestador.web && (
                          <div className="group">
                              <div className="flex items-center gap-3 text-slate-400 mb-1 group-hover:text-orange-500 transition"><Globe size={18}/> <span className="text-xs font-bold uppercase">Web</span></div>
                              <a href={prestador.web} target="_blank" rel="noreferrer" className="text-blue-400 underline">Visitar Sitio</a>
                          </div>
                      )}
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-800">
                      
                      {accessStatus === 'Ninguna' && (
                          <button 
                            onClick={handleSolicitarContacto}
                            disabled={solicitando}
                            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-orange-900/20 disabled:opacity-50 flex justify-center items-center gap-2"
                          >
                              {solicitando ? <Loader2 className="animate-spin" /> : 'Solicitar Datos de Contacto'}
                          </button>
                      )}

                      {accessStatus === 'Pendiente' && (
                          <div className="w-full bg-yellow-500/10 text-yellow-500 font-bold py-3 rounded-xl border border-yellow-500/30 flex justify-center items-center gap-2">
                              <Clock size={18}/> Solicitud Enviada
                          </div>
                      )}

                      {accessStatus === 'Aprobada' && (
                          <div className="w-full bg-emerald-500/10 text-emerald-400 font-bold py-3 rounded-xl border border-emerald-500/30 flex justify-center items-center gap-2">
                              <CheckCircle size={18}/> Acceso Concedido
                          </div>
                      )}

                       {accessStatus === 'Rechazada' && (
                          <div className="w-full bg-red-500/10 text-red-500 font-bold py-3 rounded-xl border border-red-500/30 flex justify-center items-center gap-2">
                              <XCircle size={18}/> Solicitud Rechazada
                          </div>
                      )}
                  </div>

              </div>
          </div>
      </div>
    </div>
  );
}