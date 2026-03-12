'use client';
import { useState, useEffect, use, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2'; // 👈 Importamos SweetAlert
import { 
  MapPin, Mail, Phone, Globe, User, Briefcase, 
  Image as ImageIcon, CheckCircle, Loader2, Lock, Clock, XCircle,
  GraduationCap, Film, ExternalLink, Settings2, X, Play, Pause
} from 'lucide-react';
import DepthAwareImage from '@/components/DepthAwareImage';
import OpalBackground, { type OpalBackgroundParams } from '@/components/OpalBackground';
import { isProfileHealth100 } from '@/lib/profileHealth';

const DEFAULT_PRESTADOR_OPAL_PARAMS: Required<OpalBackgroundParams> = {
  speed: 0.1,
  flowX: -1.35,
  flowY: -1.35,
  colorSpeed: 0.1,
  paletteBase: '#1a6b9e',
  maxRipples: 2,
};

const DEFAULT_PRESTADOR_TV_OPACITY = 0.92;
const ECHOES_FIRST_RIPPLE_KEY = 'tdffilm_echoes_first_ripple_played';

export default function DetallePrestadorPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [prestador, setPrestador] = useState<any>(null);
  const [accessStatus, setAccessStatus] = useState<'Ninguna' | 'Pendiente' | 'Aprobada' | 'Rechazada'>('Ninguna');
  const [loading, setLoading] = useState(true);
  const [solicitando, setSolicitando] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showOpalBackground, setShowOpalBackground] = useState(false);
  const [showDebugButton, setShowDebugButton] = useState(false);
  const [debugMenuOpen, setDebugMenuOpen] = useState(false);
  const [echoesPlaying, setEchoesPlaying] = useState(false);
  const [opalParams, setOpalParams] = useState<Required<OpalBackgroundParams>>(DEFAULT_PRESTADOR_OPAL_PARAMS);
  const [tvFilterOpacity, setTvFilterOpacity] = useState(DEFAULT_PRESTADOR_TV_OPACITY);
  const echoesRef = useRef<HTMLAudioElement>(null);

  const handleOpalRipple = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(ECHOES_FIRST_RIPPLE_KEY) === '1') return;
    try {
      echoesRef.current?.play();
      localStorage.setItem(ECHOES_FIRST_RIPPLE_KEY, '1');
    } catch (_) {}
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'ShiftLeft' && e.code !== 'ShiftRight') return;
      if (typeof window !== 'undefined' && window.innerWidth < 768) return;
      setShowDebugButton((v) => !v);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
        const resPerfiles = await fetch(`${apiUrl}/prestador/mis-perfiles`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resPerfiles.ok) {
          const perfiles = await resPerfiles.json();
          setShowOpalBackground(isProfileHealth100(Array.isArray(perfiles) ? perfiles : []));
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

  const SocialIconSvg = ({ type, className }: { type: string; className?: string }) => {
    const c = className || 'w-5 h-5';
    switch (type) {
      case 'instagram': return (<svg className={c} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>);
      case 'facebook': return (<svg className={c} viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>);
      case 'twitter': return (<svg className={c} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>);
      case 'linkedin': return (<svg className={c} viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>);
      case 'tiktok': return (<svg className={c} viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>);
      default: return null;
    }
  };

  const redes = [
    { key: 'instagram', url: prestador?.instagram, label: 'Instagram', color: 'text-pink-400 hover:text-pink-300', bg: 'bg-pink-500/10' },
    { key: 'facebook', url: prestador?.facebook, label: 'Facebook', color: 'text-blue-400 hover:text-blue-300', bg: 'bg-blue-500/10' },
    { key: 'twitter', url: prestador?.twitter, label: 'X', color: 'text-sky-300 hover:text-sky-200', bg: 'bg-slate-500/10' },
    { key: 'linkedin', url: prestador?.linkedin, label: 'LinkedIn', color: 'text-blue-500 hover:text-blue-400', bg: 'bg-blue-600/10' },
    { key: 'tiktok', url: prestador?.tiktok, label: 'TikTok', color: 'text-slate-200 hover:text-white', bg: 'bg-slate-600/10' },
  ].filter(r => r.url && String(r.url).trim());

  const normalizeSocialUrl = (key: string, value: string) => {
    const v = String(value).trim();
    if (/^https?:\/\//i.test(v)) return v;
    const user = v.replace(/^@/, '');
    const urls: Record<string, string> = {
      instagram: `https://instagram.com/${user}`,
      facebook: v.includes('/') ? `https://facebook.com/${user}` : `https://facebook.com/${user}`,
      twitter: `https://x.com/${user}`,
      linkedin: `https://linkedin.com/in/${user}`,
      tiktok: `https://tiktok.com/@${user}`,
    };
    return urls[key] || v;
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Cargando...</div>;
  if (!prestador) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-400">Error cargando perfil.</div>;

  const videoId = getYoutubeId(prestador.videoReel);
  const esEmpresa = ['Productora', 'Empresa'].includes(prestador.tipoPerfil);

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans overflow-x-hidden">
      <audio
        ref={echoesRef}
        src="/echoes.mp3"
        className="hidden"
        onPlay={() => setEchoesPlaying(true)}
        onPause={() => setEchoesPlaying(false)}
      />
      
      {/* CABECERA */}
      <div className="relative h-[60vh] w-full bg-black overflow-hidden group">
        {videoId ? (
           <div className="absolute inset-0 w-full h-full"><iframe className="w-full h-full scale-125 pointer-events-none opacity-60" src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&showinfo=0&modestbranding=1`}></iframe></div>
        ) : (
           prestador.foto ? (
             <DepthAwareImage imageUrl={prestador.foto} depthUrl={prestador.fotoProfundidad} alt={prestador.nombre} className="w-full h-full object-cover opacity-50 blur-sm animate-pulse duration-[5000ms]" containerClassName="w-full h-full overflow-hidden" />
           ) : <div className="w-full h-full bg-slate-900 flex items-center justify-center opacity-30"><Briefcase size={100}/></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent"></div>
        <div className="absolute inset-0 z-10" style={tvScanline}></div>
        
        <div className="absolute bottom-0 left-0 w-full p-8 md:p-16 z-20 flex flex-col items-center text-center animate-in slide-in-from-bottom duration-1000">
            <div className="relative group-hover:scale-105 transition-transform duration-500">
                <div className="w-32 h-32 md:w-48 md:h-48 rounded-2xl overflow-hidden border-4 border-white/10 shadow-2xl bg-slate-800 mx-auto">
                    {prestador.foto ? (
                      <DepthAwareImage imageUrl={prestador.foto} depthUrl={prestador.fotoProfundidad} alt={prestador.nombre} className="w-full h-full object-cover" containerClassName="w-full h-full rounded-2xl overflow-hidden" />
                    ) : <div className="w-full h-full flex items-center justify-center text-slate-500"><User size={48}/></div>}
                </div>
                <div className="absolute -bottom-3 -right-3 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">{prestador.tipoPerfil}</div>
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white drop-shadow-2xl mt-4">{prestador.nombre}</h1>
            <p className="text-xl md:text-2xl text-orange-500 font-bold mt-2 flex items-center justify-center gap-2 flex-wrap">{prestador.rubro} {prestador.ciudad && <span className="text-slate-400 text-sm font-normal flex items-center gap-1"><MapPin size={14}/> {prestador.ciudad}</span>}</p>
        </div>
      </div>

      {/* BODY: fondo Opal + filtro TV solo si usuario logueado tiene 100% salud de perfil */}
      {showOpalBackground ? (
      <OpalBackground className="relative min-h-[50vh]" params={opalParams} onRipple={handleOpalRipple}>
        <div
          className="absolute inset-0 pointer-events-none z-[1]"
          style={{
            opacity: tvFilterOpacity,
            background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.94) 2px, rgba(0,0,0,0.94) 4px)',
          }}
          aria-hidden
        />
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch pointer-events-none">
          
          {/* COLUMNA IZQUIERDA: tarjetas con hover tipo proyectos */}
          <div className="flex flex-col gap-8 pointer-events-auto">
              <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl p-8 shadow-xl flex-1 transition-all hover:border-orange-500/30 hover:shadow-[0_0_30px_rgba(234,88,12,0.15)] hover:-translate-y-1 duration-300">
                  <h3 className="text-orange-500 font-black uppercase tracking-widest text-lg mb-4 border-b border-slate-800 pb-2">{esEmpresa ? 'Sobre la Empresa' : 'Sobre el Profesional'}</h3>
                  <p className="text-slate-300 text-lg leading-relaxed whitespace-pre-line text-justify">{prestador.descripcion || "Sin descripción."}</p>

                  {prestador.formacion && (
                    <div className="mt-6 pt-6 border-t border-slate-800">
                      <h4 className="text-cyan-400 font-bold uppercase tracking-wider text-sm mb-2 flex items-center gap-2"><GraduationCap size={18}/> Formación</h4>
                      <p className="text-slate-300 leading-relaxed">{prestador.formacion}</p>
                    </div>
                  )}

                  {prestador.experiencias && prestador.experiencias.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-800">
                      <h4 className="text-amber-400 font-bold uppercase tracking-wider text-sm mb-3 flex items-center gap-2"><Film size={18}/> Filmografía / Experiencia</h4>
                      <ul className="space-y-2">
                        {prestador.experiencias.map((exp: { proyecto?: string; anio?: string; rol?: string }, idx: number) => (
                          <li key={idx} className="flex flex-wrap items-baseline gap-2 text-slate-300">
                            <span className="font-medium text-white">{exp.proyecto}</span>
                            {exp.anio && <span className="text-slate-500 text-sm">({exp.anio})</span>}
                            {exp.rol && <span className="text-slate-400 text-sm">— {exp.rol}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
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
          <div className="flex flex-col pointer-events-auto">
              <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl p-8 shadow-xl sticky top-24 flex-1 min-h-0 transition-all hover:border-orange-500/30 hover:shadow-[0_0_30px_rgba(234,88,12,0.15)] hover:-translate-y-1 duration-300">
                  <h3 className="text-white font-bold text-xl mb-6">Información de Contacto</h3>

                  {/* Redes sociales — arriba de email/teléfono/web */}
                  {redes.length > 0 && (
                      <div className="mb-6 pb-6 border-b border-slate-800">
                          <div className="flex items-center gap-3 text-slate-400 mb-3"><span className="text-xs font-bold uppercase">Redes sociales</span></div>
                          <div className="flex flex-wrap gap-3">
                              {redes.map((r) => {
                                const href = normalizeSocialUrl(r.key, r.url!);
                                const handle = String(r.url).replace(/^@/, '').replace(/^https?:\/\/[^/]+\//i, '').replace(/\/$/, '') || r.url;
                                return (
                                  <div key={r.key} className="relative group/red">
                                      <a href={href} target="_blank" rel="noreferrer" className={`inline-flex items-center justify-center w-11 h-11 rounded-xl border border-slate-700 ${r.bg} ${r.color} transition-all hover:scale-110 hover:border-current`} title={r.label}>
                                          <SocialIconSvg type={r.key} className="w-5 h-5" />
                                      </a>
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover/red:opacity-100 group-hover/red:visible transition-all z-20 min-w-[180px]">
                                          <p className="text-white font-bold text-sm whitespace-nowrap">{r.label}</p>
                                          <p className="text-slate-400 text-xs truncate max-w-[200px]" title={handle}>{handle}</p>
                                          <a href={href} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-orange-400 text-xs font-bold hover:text-orange-300">
                                              <ExternalLink size={12}/> Abrir perfil
                                          </a>
                                      </div>
                                  </div>
                                );
                              })}
                          </div>
                      </div>
                  )}

                  {/* Reel de YouTube — preview sin autoplay */}
                  {videoId && (
                      <div className="mb-6 pb-6 border-b border-slate-800">
                          <div className="flex items-center gap-3 text-slate-400 mb-3"><span className="text-xs font-bold uppercase">Reel / Video</span></div>
                          <a
                              href={prestador.videoReel || `https://www.youtube.com/watch?v=${videoId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="block rounded-xl overflow-hidden border border-slate-700 hover:border-orange-500/50 transition-all group/reel"
                          >
                              <img
                                  src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                                  alt="Preview del reel"
                                  className="w-full aspect-video object-cover group-hover/reel:opacity-90 transition-opacity"
                                  onError={(e) => {
                                      const target = e.currentTarget;
                                      target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                                  }}
                              />
                              <div className="bg-slate-800/80 py-2 px-3 flex items-center justify-center gap-2 text-orange-400 text-sm font-bold group-hover/reel:text-orange-300">
                                  Ver en YouTube
                              </div>
                          </a>
                      </div>
                  )}
                  
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
      </OpalBackground>
      ) : (
      <div className="relative min-h-[50vh] bg-slate-950">
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* COLUMNA IZQUIERDA */}
          <div className="flex flex-col gap-8">
              <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl p-8 shadow-xl flex-1 transition-all hover:border-orange-500/30 hover:shadow-[0_0_30px_rgba(234,88,12,0.15)] hover:-translate-y-1 duration-300">
                  <h3 className="text-orange-500 font-black uppercase tracking-widest text-lg mb-4 border-b border-slate-800 pb-2">{esEmpresa ? 'Sobre la Empresa' : 'Sobre el Profesional'}</h3>
                  <p className="text-slate-300 text-lg leading-relaxed whitespace-pre-line text-justify">{prestador.descripcion || "Sin descripción."}</p>
                  {prestador.formacion && (
                    <div className="mt-6 pt-6 border-t border-slate-800">
                      <h4 className="text-cyan-400 font-bold uppercase tracking-wider text-sm mb-2 flex items-center gap-2"><GraduationCap size={18}/> Formación</h4>
                      <p className="text-slate-300 leading-relaxed">{prestador.formacion}</p>
                    </div>
                  )}
                  {prestador.experiencias && prestador.experiencias.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-800">
                      <h4 className="text-amber-400 font-bold uppercase tracking-wider text-sm mb-3 flex items-center gap-2"><Film size={18}/> Filmografía / Experiencia</h4>
                      <ul className="space-y-2">
                        {prestador.experiencias.map((exp: { proyecto?: string; anio?: string; rol?: string }, idx: number) => (
                          <li key={idx} className="flex flex-wrap items-baseline gap-2 text-slate-300">
                            <span className="font-medium text-white">{exp.proyecto}</span>
                            {exp.anio && <span className="text-slate-500 text-sm">({exp.anio})</span>}
                            {exp.rol && <span className="text-slate-400 text-sm">— {exp.rol}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
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
          <div className="flex flex-col">
              <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl p-8 shadow-xl sticky top-24 flex-1 min-h-0 transition-all hover:border-orange-500/30 hover:shadow-[0_0_30px_rgba(234,88,12,0.15)] hover:-translate-y-1 duration-300">
                  <h3 className="text-white font-bold text-xl mb-6">Información de Contacto</h3>
                  {redes.length > 0 && (
                      <div className="mb-6 pb-6 border-b border-slate-800">
                          <div className="flex items-center gap-3 text-slate-400 mb-3"><span className="text-xs font-bold uppercase">Redes sociales</span></div>
                          <div className="flex flex-wrap gap-3">
                              {redes.map((r) => {
                                const href = normalizeSocialUrl(r.key, r.url!);
                                const handle = String(r.url).replace(/^@/, '').replace(/^https?:\/\/[^/]+\//i, '').replace(/\/$/, '') || r.url;
                                return (
                                  <div key={r.key} className="relative group/red">
                                      <a href={href} target="_blank" rel="noreferrer" className={`inline-flex items-center justify-center w-11 h-11 rounded-xl border border-slate-700 ${r.bg} ${r.color} transition-all hover:scale-110 hover:border-current`} title={r.label}>
                                          <SocialIconSvg type={r.key} className="w-5 h-5" />
                                      </a>
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover/red:opacity-100 group-hover/red:visible transition-all z-20 min-w-[180px]">
                                          <p className="text-white font-bold text-sm whitespace-nowrap">{r.label}</p>
                                          <p className="text-slate-400 text-xs truncate max-w-[200px]" title={handle}>{handle}</p>
                                          <a href={href} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-orange-400 text-xs font-bold hover:text-orange-300">
                                              <ExternalLink size={12}/> Abrir perfil
                                          </a>
                                      </div>
                                  </div>
                                );
                              })}
                          </div>
                      </div>
                  )}
                  {videoId && (
                      <div className="mb-6 pb-6 border-b border-slate-800">
                          <div className="flex items-center gap-3 text-slate-400 mb-3"><span className="text-xs font-bold uppercase">Reel / Video</span></div>
                          <a
                              href={prestador.videoReel || `https://www.youtube.com/watch?v=${videoId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="block rounded-xl overflow-hidden border border-slate-700 hover:border-orange-500/50 transition-all group/reel"
                          >
                              <img
                                  src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                                  alt="Preview del reel"
                                  className="w-full aspect-video object-cover group-hover/reel:opacity-90 transition-opacity"
                                  onError={(e) => {
                                      const target = e.currentTarget;
                                      target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                                  }}
                              />
                              <div className="bg-slate-800/80 py-2 px-3 flex items-center justify-center gap-2 text-orange-400 text-sm font-bold group-hover/reel:text-orange-300">
                                  Ver en YouTube
                              </div>
                          </a>
                      </div>
                  )}
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
      )}

      {/* Debug: activado con Shift en escritorio, solo si hay fondo Opal */}
      {showOpalBackground && showDebugButton && (
        <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDebugMenuOpen((v) => !v)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950/90 backdrop-blur-xl border border-white/10 text-slate-300 hover:text-white hover:border-orange-500/40 hover:shadow-[0_0_20px_rgba(249,115,22,0.15)] transition-all font-bold text-sm"
          >
            <Settings2 size={18} />
            Debug
          </button>
          {debugMenuOpen && (
            <div className="fixed left-24 top-1/2 -translate-y-1/2 w-72 rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-2xl overflow-hidden z-[61]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-gradient-to-r from-slate-900/90 to-transparent">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">OpalBackground</span>
                <button type="button" onClick={() => setDebugMenuOpen(false)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors" aria-label="Cerrar">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
                  <span className="text-xs font-bold text-slate-400">Echoes (mp3)</span>
                  <button
                    type="button"
                    onClick={() => {
                      const el = echoesRef.current;
                      if (!el) return;
                      if (el.paused) el.play();
                      else el.pause();
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 hover:text-white transition-colors text-xs font-bold"
                  >
                    {echoesPlaying ? <Pause size={16} /> : <Play size={16} />}
                    {echoesPlaying ? 'Pausar' : 'Reproducir'}
                  </button>
                </div>
                <div>
                  <label className="flex justify-between items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-400">Opacidad filtro TV</span>
                    <span className="text-xs font-mono text-orange-400 tabular-nums">{(tvFilterOpacity * 100).toFixed(0)}%</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={tvFilterOpacity * 100}
                    onChange={(e) => setTvFilterOpacity(Number(e.target.value) / 100)}
                    className="w-full h-2 rounded-full bg-slate-800 accent-orange-500 mb-4"
                  />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 block mb-2">Color base paleta (4 complementarios)</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={opalParams.paletteBase}
                      onChange={(e) => setOpalParams((p) => ({ ...p, paletteBase: e.target.value }))}
                      className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent"
                    />
                    <span className="text-xs font-mono text-slate-500">{opalParams.paletteBase}</span>
                  </div>
                </div>
                {[
                  { key: 'speed', label: 'Velocidad', min: 0.2, max: 3, step: 0.1 },
                  { key: 'flowX', label: 'Dirección X', min: -1.5, max: 1.5, step: 0.05 },
                  { key: 'flowY', label: 'Dirección Y', min: -1.5, max: 1.5, step: 0.05 },
                  { key: 'colorSpeed', label: 'Velocidad cambio color', min: 0.1, max: 3, step: 0.1 },
                  { key: 'maxRipples', label: 'Cantidad ripples (click)', min: 1, max: 6, step: 1 },
                ].map(({ key, label, min, max, step }) => (
                  <div key={key}>
                    <label className="flex justify-between items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-400">{label}</span>
                      <span className="text-xs font-mono text-orange-400 tabular-nums">
                        {key === 'maxRipples' ? opalParams[key] : (opalParams[key as keyof typeof opalParams] as number).toFixed(2)}
                      </span>
                    </label>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={opalParams[key as keyof typeof opalParams] as number}
                      onChange={(e) =>
                        setOpalParams((p) => ({
                          ...p,
                          [key]: key === 'maxRipples' ? parseInt(e.target.value, 10) : parseFloat(e.target.value),
                        }))
                      }
                      className="w-full h-2 rounded-full bg-slate-800 accent-orange-500"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => { setOpalParams(DEFAULT_PRESTADOR_OPAL_PARAMS); setTvFilterOpacity(DEFAULT_PRESTADOR_TV_OPACITY); }}
                  className="w-full py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white border border-white/10 hover:border-orange-500/30 transition-colors"
                >
                  Restaurar valores
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}