'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { 
  Calendar, MapPin, Clock, DollarSign, GraduationCap, 
  Users, ChevronLeft, Mail, Star, CheckCircle, Film, 
  Image as ImageIcon, ExternalLink, BookOpen
} from 'lucide-react';
import DepthAwareImage from '@/components/DepthAwareImage';
import { useLanguage } from '@/contexts/LanguageContext';

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
                setMisPerfiles(Array.isArray(perfiles) ? perfiles : []);
                if (Array.isArray(perfiles) && perfiles.length > 0 && !perfilElegidoId) {
                  setPerfilElegidoId(perfiles[0].id);
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
      if(confirm("Debes iniciar sesión. ¿Ir al login?")) window.location.href = '/login';
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

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Cargando...</div>;
  if (!proyecto) return <div className="text-white text-center py-20">{t('proyectos.proyecto_no_encontrado')}</div>;

  const videoRef = proyecto.referencias?.find((r: string) => r && (r.includes('youtu') || r.includes('vimeo')));
  const youtubeId = videoRef ? getYoutubeId(videoRef) : null;
  const formatDate = (d: string | Date | null) => d ? new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  const galeria = Array.isArray(proyecto.galeria) ? proyecto.galeria : [];
  const referencias = Array.isArray(proyecto.referencias) ? proyecto.referencias : [];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-20">
      
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

      {/* BODY: galería arriba de todo (ancho completo); luego 2 columnas */}
      <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col gap-8">
        {/* GALERÍA: arriba de todo, ancho completo en PC */}
        {galeria.length > 0 && (
          <div className="w-full bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl p-6 shadow-xl transition-all hover:border-orange-500/30 duration-300">
            <h3 className="text-cyan-400 font-black uppercase tracking-widest text-lg mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
              <ImageIcon size={20}/> {t('proyectos.galeria')}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {galeria.map((img: string, idx: number) => (
                <a key={idx} href={img} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-slate-700 hover:border-orange-500/50 aspect-square object-cover">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* COLUMNA IZQUIERDA: La historia, Ficha, Video/Reel */}
        <div className="flex flex-col gap-8">
          <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl p-8 shadow-xl transition-all hover:border-orange-500/30 hover:shadow-[0_0_30px_rgba(234,88,12,0.15)] hover:-translate-y-1 duration-300">
            <h3 className="text-orange-500 font-black uppercase tracking-widest text-lg mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
              <BookOpen size={20}/> {t('proyectos.la_historia')}
            </h3>
            <p className="text-slate-300 text-lg leading-relaxed whitespace-pre-line text-justify">{proyecto.descripcion}</p>
          </div>

          <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl p-8 shadow-xl transition-all hover:border-orange-500/30 hover:shadow-[0_0_30px_rgba(234,88,12,0.15)] hover:-translate-y-1 duration-300">
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
            <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl p-6 shadow-xl transition-all hover:border-orange-500/30 hover:shadow-[0_0_30px_rgba(234,88,12,0.15)] hover:-translate-y-1 duration-300">
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

        {/* COLUMNA DERECHA: Vacantes arriba, luego Otras refs y Smart Match */}
        <div className="flex flex-col gap-8 lg:sticky lg:top-24">
          <div id="vacantes-section" className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl p-8 shadow-xl transition-all hover:border-orange-500/30 hover:shadow-[0_0_30px_rgba(234,88,12,0.15)] hover:-translate-y-1 duration-300">
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
            <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl p-6 shadow-xl transition-all hover:border-orange-500/30 duration-300">
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

          {candidatos.length > 0 && (
            <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl p-8 shadow-xl transition-all hover:border-orange-500/30 duration-300">
              <div className="flex items-center gap-3 mb-6">
                <Star size={24} className="text-orange-500"/>
                <h3 className="text-xl font-bold text-white">Smart Match ({candidatos.length})</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      </div>
      </div>
    </div>
  );
}