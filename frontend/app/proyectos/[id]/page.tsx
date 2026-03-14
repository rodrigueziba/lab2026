'use client';
import { useState, useEffect, use, useRef, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { 
  Calendar, MapPin, Clock, DollarSign, GraduationCap, 
  Users, ChevronLeft, Mail, Star, CheckCircle, Film, 
  Image as ImageIcon, ExternalLink, BookOpen, X, Settings2, Play, Pause, Maximize2
} from 'lucide-react';
import DepthAwareImage from '@/components/DepthAwareImage';
import { useLanguage } from '@/contexts/LanguageContext';
import OpalBackground, { type OpalBackgroundParams } from '@/components/OpalBackground';
import TdfFilmLoader from '@/components/TdfFilmLoader';
import { isProfileHealth100 } from '@/lib/profileHealth';

const DepthGallery = dynamic(() => import('@/components/Depthgallery'), { ssr: false });

const DEFAULT_OPAL_PARAMS: Required<OpalBackgroundParams> = {
  speed: 0.1,
  flowX: 0.75,
  flowY: 0.95,
  colorSpeed: 0.1,
  paletteBase: '#1a6b9e',
  maxRipples: 6,
  brightness: 0.35,
};

const DEFAULT_TV_OPACITY = 0.92;

const ECHOES_FIRST_RIPPLE_KEY = 'tdffilm_echoes_first_ripple_played';

const getYoutubeId = (url: string) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export default function DetalleProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params); 
  const id = resolvedParams.id;
  const { t } = useLanguage();
  const [proyecto, setProyecto] = useState<any>(null);
  const [candidatos, setCandidatos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const [misPostulaciones, setMisPostulaciones] = useState<number[]>([]);
  const [misPerfiles, setMisPerfiles] = useState<Array<{ id: number; nombre: string; rubro: string }>>([]);
  const [perfilElegidoId, setPerfilElegidoId] = useState<number | null>(null);

  const [showDebugButton, setShowDebugButton] = useState(false);
  const [debugMenuOpen, setDebugMenuOpen] = useState(false);
  const [opalParams, setOpalParams] = useState<Required<OpalBackgroundParams>>(DEFAULT_OPAL_PARAMS);
  const [tvFilterOpacity, setTvFilterOpacity] = useState(DEFAULT_TV_OPACITY);
  const [showOpalBackground, setShowOpalBackground] = useState(false);
  const [hideCards, setHideCards] = useState(false);
  const [galleryFullscreen, setGalleryFullscreen] = useState(false);
  const [echoesPlaying, setEchoesPlaying] = useState(false);
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
                const misApps = apps
                  .filter((a: any) => a.postulanteId === user.id)
                  .map((a: any) => a.puestoId);
                setMisPostulaciones(misApps);
             }
             const resPerfiles = await fetch(`${apiUrl}/prestador/mis-perfiles`, {
                headers: { 'Authorization': `Bearer ${token}` }
             });
             if (resPerfiles.ok) {
                const perfiles = await resPerfiles.json();
                const list = Array.isArray(perfiles) ? perfiles : [];
                setMisPerfiles(list);
                setShowOpalBackground(isProfileHealth100(list));
                if (list.length > 0 && !perfilElegidoId) {
                  setPerfilElegidoId(list[0].id);
                }
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
      if(confirm("Debes iniciar sesión. ¿Ir al login?")) window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
      return;
    }

    if (!confirm(`¿Confirmás tu postulación para: ${puestoNombre}?`)) return;

    const body: { proyectoId: number; puestoId: number; mensaje: string; prestadorId?: number } = {
      proyectoId: parseInt(id),
      puestoId: puestoId,
      mensaje: "¡Hola! Quiero sumarme al equipo."
    };
    if (perfilElegidoId) body.prestadorId = perfilElegidoId;

    try {
      const res = await fetch(`${apiUrl}/postulacion`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(body)
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

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><TdfFilmLoader /></div>;
  if (!proyecto) return <div className="text-white text-center py-20">{t('proyectos.proyecto_no_encontrado')}</div>;

  const videoRef = proyecto.referencias?.find((r: string) => r && (r.includes('youtu') || r.includes('vimeo')));
  const youtubeId = videoRef ? getYoutubeId(videoRef) : null;
  const formatDate = (d: string | Date | null) => d ? new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  const galeria = Array.isArray(proyecto.galeria) ? proyecto.galeria : [];
  const referencias = Array.isArray(proyecto.referencias) ? proyecto.referencias : [];

  const bodyContent = (
    <div className="relative z-10 max-w-6xl mx-auto px-6 py-12 flex flex-col gap-8 pointer-events-none">
        {galeria.length > 0 && (
          <div className="w-full bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl overflow-hidden shadow-xl transition-all hover:border-orange-500/30 duration-300 pointer-events-auto">
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-800">
              <h3 className="text-cyan-400 font-black uppercase tracking-widest text-lg flex items-center gap-2">
                <ImageIcon size={20}/> {t('proyectos.galeria')}
              </h3>
              <button
                type="button"
                onClick={() => setGalleryFullscreen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition text-sm font-bold"
                aria-label="Pantalla completa"
              >
                <Maximize2 size={18}/> Pantalla completa
              </button>
            </div>
            <div className="relative w-full h-[320px] sm:h-[380px] md:h-[420px]">
              <DepthGallery
                items={galeria.map((src: string) => ({ src }))}
                title={proyecto.titulo}
                subtitle={proyecto.tipo}
                height="100%"
              />
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start pointer-events-auto">
        <div className="flex flex-col gap-8">
          <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl p-8 shadow-xl transition-all hover:border-orange-500/30 hover:shadow-[0_0_30px_rgba(234,88,12,0.15)] hover:-translate-y-1 duration-300 pointer-events-auto">
            <h3 className="text-orange-500 font-black uppercase tracking-widest text-lg mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
              <BookOpen size={20}/> {t('proyectos.la_historia')}
            </h3>
            <p className="text-slate-300 text-lg leading-relaxed whitespace-pre-line text-justify">{proyecto.descripcion}</p>
          </div>
          <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl p-8 shadow-xl transition-all hover:border-orange-500/30 hover:shadow-[0_0_30px_rgba(234,88,12,0.15)] hover:-translate-y-1 duration-300 pointer-events-auto">
            <h3 className="text-cyan-400 font-black uppercase tracking-widest text-lg mb-6 border-b border-slate-800 pb-2 flex items-center gap-2">
              <Film size={20}/> {t('proyectos.ficha')}
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><dt className="text-slate-500 font-bold uppercase tracking-wider mb-1">Tipo</dt><dd className="text-white font-medium">{proyecto.tipo}</dd></div>
              <div><dt className="text-slate-500 font-bold uppercase tracking-wider mb-1">Estado</dt><dd className="text-white font-medium">{proyecto.estado}</dd></div>
              <div><dt className="text-slate-500 font-bold uppercase tracking-wider mb-1">Ciudad</dt><dd className="text-white font-medium flex items-center gap-1"><MapPin size={14} className="text-orange-500"/>{proyecto.ciudad}</dd></div>
              {proyecto.fechaInicio && <div><dt className="text-slate-500 font-bold uppercase tracking-wider mb-1">Fecha inicio</dt><dd className="text-white font-medium flex items-center gap-1"><Calendar size={14} className="text-orange-500"/>{formatDate(proyecto.fechaInicio)}</dd></div>}
              {proyecto.fechaFin && <div><dt className="text-slate-500 font-bold uppercase tracking-wider mb-1">Fecha fin</dt><dd className="text-white font-medium flex items-center gap-1"><Calendar size={14} className="text-orange-500"/>{formatDate(proyecto.fechaFin)}</dd></div>}
              <div><dt className="text-slate-500 font-bold uppercase tracking-wider mb-1">Remunerado</dt><dd className="text-white font-medium">{proyecto.esRemunerado ? 'Sí' : 'No'}</dd></div>
              <div><dt className="text-slate-500 font-bold uppercase tracking-wider mb-1">Estudiante / Tesis</dt><dd className="text-white font-medium">{proyecto.esEstudiante ? 'Sí' : 'No'}</dd></div>
            </dl>
          </div>
          {youtubeId && (
            <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl p-6 shadow-xl transition-all hover:border-orange-500/30 hover:shadow-[0_0_30px_rgba(234,88,12,0.15)] hover:-translate-y-1 duration-300 pointer-events-auto">
              <h3 className="text-cyan-400 font-black uppercase tracking-widest text-lg mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
                <ImageIcon size={20}/> {t('proyectos.video_reel')}
              </h3>
              <a
                href={videoRef || `https://www.youtube.com/watch?v=${youtubeId}`}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl overflow-hidden border border-slate-700 hover:border-orange-500/50 transition-all group/reel"
              >
                <img
                  src={`https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`}
                  alt="Preview del video del proyecto"
                  className="w-full aspect-video object-cover group-hover/reel:opacity-90 transition-opacity"
                  onError={(e) => { const t = e.currentTarget; t.src = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`; }}
                />
                <div className="bg-slate-800/80 py-2 px-3 flex items-center justify-center gap-2 text-orange-400 text-sm font-bold group-hover/reel:text-orange-300">
                  <ExternalLink size={16}/> {t('proyectos.ver_youtube')}
                </div>
              </a>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-8 lg:sticky lg:top-24">
          <div id="vacantes-section" className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl p-8 shadow-xl transition-all hover:border-orange-500/30 hover:shadow-[0_0_30px_rgba(234,88,12,0.15)] hover:-translate-y-1 duration-300 pointer-events-auto">
            <h3 className="text-orange-500 font-black uppercase tracking-widest text-lg mb-6 border-b border-slate-800 pb-2 flex items-center gap-2">
              <Users className="text-orange-600"/> {t('proyectos.vacantes')} ({proyecto.puestos?.length || 0})
            </h3>
            {misPerfiles.length > 1 && (
              <div className="mb-4 pb-4 border-b border-slate-800">
                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Postularme con mi perfil</label>
                <select
                  value={perfilElegidoId ?? ''}
                  onChange={(e) => setPerfilElegidoId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-orange-500"
                >
                  {misPerfiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre} · {p.rubro}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-4">
              {(proyecto.puestos || []).map((puesto: any) => {
                const yaPostulado = misPostulaciones.includes(puesto.id);
                return (
                  <div key={puesto.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 hover:border-slate-600 transition">
                    <div className="flex justify-between mb-2">
                      <h4 className="font-bold text-white">{puesto.nombre}</h4>
                      {yaPostulado && <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-1 rounded font-bold border border-emerald-500/30">{t('proyectos.aplicado')}</span>}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-4">{puesto.descripcion || 'Sin descripción'}</p>
                    <div className="pt-3 border-t border-slate-900 flex justify-end">
                      {yaPostulado ? (
                        <button disabled className="text-xs font-bold text-emerald-500 flex items-center gap-1 cursor-default">
                          <CheckCircle size={14}/> {t('proyectos.ya_postulaste')}
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePostular(puesto.id, puesto.nombre)}
                          className="text-xs font-bold text-orange-400 hover:text-orange-300 transition flex items-center gap-1"
                        >
                          {t('proyectos.aplicar_rol')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {referencias.length > 1 && (
            <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl p-6 shadow-xl transition-all hover:border-orange-500/30 duration-300 pointer-events-auto">
              <h3 className="text-slate-400 font-black uppercase tracking-widest text-lg mb-4 border-b border-slate-800 pb-2">{t('proyectos.otras_refs')}</h3>
              <ul className="space-y-2">
                {referencias.filter((r: string) => r !== videoRef).map((url: string, i: number) => (
                  <li key={i}>
                    <a href={url} target="_blank" rel="noreferrer" className="text-orange-400 hover:text-orange-300 font-medium text-sm flex items-center gap-2">
                      <ExternalLink size={14}/> {url.length > 50 ? url.slice(0, 50) + '…' : url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        </div>
        {candidatos.length > 0 && (
          <div className="w-full bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl p-8 shadow-xl transition-all hover:border-orange-500/30 duration-300 pointer-events-auto">
            <div className="flex items-center gap-3 mb-6">
              <Star size={24} className="text-orange-500"/>
              <h3 className="text-xl font-bold text-white">Smart Match ({candidatos.length})</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {candidatos.map((cand: any) => (
                <div key={cand.id} className="flex items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-500">{cand.nombre?.[0] || '?'}</div>
                  <div>
                    <h4 className="font-bold text-white">{cand.nombre}</h4>
                    <p className="text-xs text-slate-400">{cand.rubro}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-20">
      <audio
        ref={echoesRef}
        src="/echoes.mp3"
        className="hidden"
        onPlay={() => setEchoesPlaying(true)}
        onPause={() => setEchoesPlaying(false)}
      />
      
      {/* HERO */}
      <div className="relative h-[60vh] md:h-[70vh] w-full overflow-hidden bg-black">
        <div className="absolute inset-0 z-0">
          {youtubeId ? (
             <iframe 
               src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtubeId}`}
               className="w-full h-full object-cover opacity-60 pointer-events-none scale-125"
               allow="autoplay"
             />
          ) : (
             <DepthAwareImage imageUrl={proyecto.foto || galeria[0] || '/placeholder-dark.jpg'} depthUrl={proyecto.fotoProfundidad} alt={proyecto.titulo} className="w-full h-full object-cover opacity-50" containerClassName="w-full h-full overflow-hidden" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent"></div>
        </div>

        <div className="absolute bottom-0 left-0 w-full z-10 px-6 pb-8 md:pb-12">
          <div className="max-w-6xl mx-auto">
             <Link href="/proyectos" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition font-bold text-sm uppercase tracking-widest">
                <ChevronLeft size={16}/> {t('proyectos.volver')}
             </Link>
             <div className="flex flex-wrap gap-3 mb-4">
                {proyecto.esRemunerado && <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-lg"><DollarSign size={12}/> {t('proyectos.remunerado')}</span>}
                {proyecto.esEstudiante && <span className="bg-cyan-500/90 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"><GraduationCap size={12}/> {t('proyectos.estudiante')}</span>}
                <span className="bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase">{proyecto.tipo}</span>
                <span className="bg-slate-700 text-slate-200 text-xs font-bold px-3 py-1 rounded-full">{proyecto.estado}</span>
             </div>
             <h1 className="text-3xl md:text-6xl font-black mb-3 leading-tight tracking-tighter">{proyecto.titulo}</h1>
             <div className="flex flex-wrap gap-4 text-sm font-bold text-slate-300">
                <span className="flex items-center gap-2"><MapPin size={16} className="text-orange-500"/> {proyecto.ciudad}</span>
                {formatDate(proyecto.fechaInicio) && <span className="flex items-center gap-2"><Calendar size={16} className="text-orange-500"/> {formatDate(proyecto.fechaInicio)}{proyecto.fechaFin ? ` – ${formatDate(proyecto.fechaFin)}` : ''}</span>}
             </div>
             <button 
               onClick={() => document.getElementById('vacantes-section')?.scrollIntoView({ behavior: 'smooth' })}
               className="mt-6 bg-white text-black hover:bg-slate-200 px-6 py-3 rounded-full font-black flex items-center gap-2 shadow-xl transition transform hover:scale-105 text-sm"
             >
               <Mail size={18}/> {t('proyectos.ver_vacantes')}
             </button>
          </div>
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
        <div className={hideCards ? 'pointer-events-none invisible' : ''} aria-hidden={hideCards}>
          {bodyContent}
        </div>
      </OpalBackground>
      ) : (
      <div className="relative min-h-[50vh] bg-slate-950">
        {bodyContent}
      </div>
      )}

      {/* Galería en pantalla completa */}
      {galleryFullscreen && proyecto && galeria.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/95 shrink-0">
            <h3 className="text-cyan-400 font-bold text-lg">{t('proyectos.galeria')} — {proyecto.titulo}</h3>
            <button
              type="button"
              onClick={() => setGalleryFullscreen(false)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition text-sm font-bold"
              aria-label="Cerrar pantalla completa"
            >
              <X size={20}/> Cerrar
            </button>
          </div>
          <div className="flex-1 min-h-0 w-full">
            <DepthGallery
              items={galeria.map((src: string) => ({ src }))}
              title={proyecto.titulo}
              subtitle={proyecto.tipo}
              height="100%"
            />
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
                  <span className="text-xs font-bold text-slate-400">Ocultar tarjetas</span>
                  <button
                    type="button"
                    onClick={() => setHideCards((v) => !v)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-slate-300 hover:text-white transition-colors text-xs font-bold ${hideCards ? 'bg-orange-500/20 border-orange-500/40 text-orange-400' : 'bg-slate-800 hover:bg-slate-700'}`}
                  >
                    {hideCards ? 'Mostrar' : 'Ocultar'}
                  </button>
                </div>
                <div>
                  <label className="flex justify-between items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-400">Brillo del fondo</span>
                    <span className="text-xs font-mono text-orange-400 tabular-nums">{(opalParams.brightness ?? 0.35).toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    step={5}
                    value={((opalParams.brightness ?? 0.35) * 100)}
                    onChange={(e) => setOpalParams((p) => ({ ...p, brightness: Number(e.target.value) / 100 }))}
                    className="w-full h-2 rounded-full bg-slate-800 accent-orange-500 mb-4"
                  />
                </div>
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
                  onClick={() => { setOpalParams(DEFAULT_OPAL_PARAMS); setTvFilterOpacity(DEFAULT_TV_OPACITY); setHideCards(false); }}
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