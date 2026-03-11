'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import {
  User, Briefcase, MapPin, Mail, Phone, Globe,
  Image as ImageIcon, Loader2, Youtube, Plus,
  Trash2, ArrowLeft, PlusCircle, Sparkles, Palette, ChevronRight, ChevronLeft
} from 'lucide-react';

const BORRADOR_KEY = 'mi-perfil-crear-borrador';
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const RUBROS = [
  "Dirección", "Producción", "Guion", "Fotografía / Cámara",
  "Sonido", "Arte / Escenografía", "Vestuario / Maquillaje",
  "Montaje / Postproducción", "Música", "Actuación / Casting",
  "Alquiler de Equipos", "Catering", "Transporte / Logística", "Legales / Gestoría",
  "VFX / Animación", "Drones"
];

const RUBRO_SUGERENCIAS: Record<string, string[]> = {
  "Sonido": ["Foley", "Mezcla 5.1", "Microfonista", "Grabación en locación", "Postproducción de sonido"],
  "Fotografía / Cámara": ["Operador de cámara", "Director de fotografía", "Gaffer", "Iluminación", "Steadicam"],
  "Dirección": ["Dirección de actores", "Puesta en escena", "Guion", "Dirección de arte"],
  "Producción": ["Producción ejecutiva", "Locación", "Casting", "Presupuesto", "Rodaje"],
  "Montaje / Postproducción": ["Edición", "Colorización", "VFX", "DaVinci Resolve", "Premiere"],
  "Arte / Escenografía": ["Escenografía", "Diseño de producción", "Props", "Ambientación"],
  "Vestuario / Maquillaje": ["Vestuario", "Maquillaje", "Caracterización", "Efectos especiales"],
  "Música": ["Composición", "Música original", "Licencias", "Grabación"],
  "Actuación / Casting": ["Casting", "Dirección de actores", "Improvisación"],
  "VFX / Animación": ["After Effects", "Compositing", "3D", "Motion graphics"],
  "Drones": ["Operador de drone", "Aéreos", "Regulación"],
};

const initialForm = {
  nombre: '',
  tipoPerfil: 'Profesional',
  rubro: '',
  descripcion: '',
  email: '',
  telefono: '',
  web: '',
  instagram: '',
  facebook: '',
  twitter: '',
  linkedin: '',
  tiktok: '',
  foto: '',
  videoReel: '',
  ciudad: 'Ushuaia',
  colorTema: '#0ea5e9',
  galeria: [] as string[]
};

export default function CrearPerfilPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generandoIA, setGenerandoIA] = useState(false);
  const [depthStatus, setDepthStatus] = useState('');
  const [depthFailed, setDepthFailed] = useState(false);
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState(initialForm);
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [formacion, setFormacion] = useState('');
  const [experiencias, setExperiencias] = useState([{ proyecto: '', anio: '', rol: '' }]);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  const [archivoPrincipal, setArchivoPrincipal] = useState<File | null>(null);
  const [previewPrincipal, setPreviewPrincipal] = useState<string | null>(null);
  const [archivosGaleria, setArchivosGaleria] = useState<File[]>([]);
  const [previewsGaleria, setPreviewsGaleria] = useState<string[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Debés iniciar sesión para crear un perfil.');
      router.push('/login');
    }
  }, [router]);

  // Cargar borrador desde localStorage (solo datos serializables)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BORRADOR_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data?.formData) setFormData(prev => ({ ...initialForm, ...data.formData }));
        if (data?.fechaNacimiento != null) setFechaNacimiento(data.fechaNacimiento);
        if (data?.formacion != null) setFormacion(data.formacion);
        if (Array.isArray(data?.experiencias) && data.experiencias.length > 0) setExperiencias(data.experiencias);
      }
    } catch (_) {}
  }, []);

  // Auto-guardar borrador
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(BORRADOR_KEY, JSON.stringify({
          formData,
          fechaNacimiento,
          formacion,
          experiencias,
        }));
      } catch (_) {}
    }, 500);
    return () => clearTimeout(t);
  }, [formData, fechaNacimiento, formacion, experiencias]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const addExperiencia = () => setExperiencias([...experiencias, { proyecto: '', anio: '', rol: '' }]);
  const removeExperiencia = (index: number) => {
    const list = [...experiencias];
    list.splice(index, 1);
    setExperiencias(list);
  };
  const handleExperienciaChange = (index: number, field: string, value: string) => {
    const list = [...experiencias];
    (list[index] as Record<string, string>)[field] = value;
    setExperiencias(list);
  };

  const generarDescripcionIA = async () => {
    if (!formData.nombre || !formData.rubro) {
      toast.error('Completá al menos tu nombre y rubro primero.');
      return;
    }
    setGenerandoIA(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/prestador/generar-bio-ia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ nombre: formData.nombre, fechaNacimiento, formacion, tipoPerfil: formData.tipoPerfil, rubro: formData.rubro, experiencias }),
      });
      const data = await res.json();
      if (data.bio) setFormData(prev => ({ ...prev, descripcion: data.bio }));
      if (data.error) console.warn('IA devolvió error:', data.error);
    } catch (e) {
      console.error(e);
      toast.error('Error conectando con la IA. Verificá que el backend esté en marcha.');
    } finally {
      setGenerandoIA(false);
    }
  };

  const handleMainFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > MAX_FILE_BYTES) {
        toast.error('El archivo es muy pesado. Máximo 2MB.');
        e.target.value = '';
        return;
      }
      setArchivoPrincipal(file);
      setPreviewPrincipal(URL.createObjectURL(file));
    }
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(f => {
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`"${f.name}" supera 2MB. No se agregó.`);
        return false;
      }
      return true;
    });
    const totalFiles = archivosGaleria.length + validFiles.length;
    if (totalFiles > 5) {
      toast.error('Máximo 5 fotos en la galería.');
      e.target.value = '';
      return;
    }
    setArchivosGaleria(prev => [...prev, ...validFiles]);
    setPreviewsGaleria(prev => [...prev, ...validFiles.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const removeGalleryImage = (index: number) => {
    URL.revokeObjectURL(previewsGaleria[index]);
    setArchivosGaleria(prev => prev.filter((_, i) => i !== index));
    setPreviewsGaleria(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImageToSupabase = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error } = await supabase.storage.from('profesionales').upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage.from('profesionales').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (err) {
      console.error(err);
      toast.error('Error al subir la imagen.');
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setUploading(true);
    setDepthFailed(false);

    try {
      let finalFotoPrincipal = formData.foto;
      let finalFotoProfundidad: string | undefined;

      if (archivoPrincipal) {
        const url = await uploadImageToSupabase(archivoPrincipal);
        if (!url) {
          setLoading(false);
          setUploading(false);
          return;
        }
        finalFotoPrincipal = url;
        try {
          setDepthStatus('Generando mapa de profundidad (efecto 3D)...');
          setDepthFailed(false);
          const objectUrl = URL.createObjectURL(archivoPrincipal);
          const { generateDepthMap, dataURLtoFile } = await import('@/lib/depthAI');
          const depthBase64 = await generateDepthMap(objectUrl, (info: { status?: string; progress?: number }) => {
            if (info?.status === 'progress') setDepthStatus(`Procesando... ${Math.round(info.progress ?? 0)}%`);
          });
          URL.revokeObjectURL(objectUrl);
          const depthFile = dataURLtoFile(depthBase64, `depth_${archivoPrincipal.name}`);
          const depthUrl = await uploadImageToSupabase(depthFile);
          if (depthUrl) finalFotoProfundidad = depthUrl;
        } catch (_) {
          setDepthFailed(true);
        }
        setDepthStatus('');
      }

      let finalGaleria = [...formData.galeria];
      if (archivosGaleria.length > 0) {
        const uploadPromises = archivosGaleria.map(file => uploadImageToSupabase(file));
        const uploadedUrls = await Promise.all(uploadPromises);
        finalGaleria = [...finalGaleria, ...uploadedUrls.filter(Boolean) as string[]];
      }

      const experienciasFiltradas = experiencias.filter(e => e.proyecto && e.anio);
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/prestador`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          ...formData,
          foto: finalFotoPrincipal,
          fotoProfundidad: finalFotoProfundidad ?? undefined,
          galeria: finalGaleria,
          fechaNacimiento,
          formacion,
          experiencias: experienciasFiltradas,
          instagram: formData.instagram || undefined,
          facebook: formData.facebook || undefined,
          twitter: formData.twitter || undefined,
          linkedin: formData.linkedin || undefined,
          tiktok: formData.tiktok || undefined,
          colorTema: formData.colorTema || undefined,
        }),
      });

      if (res.ok) {
        try { localStorage.removeItem(BORRADOR_KEY); } catch (_) {}
        if (depthFailed) toast.info('Perfil guardado. No se pudo generar el efecto 3D; podés editar el perfil y cambiar la foto para intentar de nuevo.');
        else toast.success('Perfil creado correctamente.');
        router.push('/mi-perfil');
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.message || 'Error al guardar el perfil.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Ocurrió un error al guardar el perfil.');
    } finally {
      setDepthStatus('');
      setLoading(false);
      setUploading(false);
    }
  };

  const canNextStep1 = formData.nombre.trim() && formData.rubro;
  const canNextStep2 = formData.descripcion.trim().length >= 20;

  return (
    <div className="min-h-screen bg-slate-950 text-white pt-28 pb-24 md:pb-12 px-6 font-sans flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3" aria-hidden />

      <div className="max-w-4xl w-full bg-slate-900 p-8 md:p-12 rounded-3xl border border-slate-800 shadow-2xl relative z-10">
        <button type="button" onClick={() => router.back()} className="text-slate-400 hover:text-white flex items-center gap-2 mb-8 transition text-sm font-bold uppercase tracking-wider min-h-[44px] items-center">
          <ArrowLeft size={16} aria-hidden /> Cancelar y Volver
        </button>

        <div className="text-center mb-10 border-b border-slate-800/50 pb-8">
          <h1 className="text-4xl md:text-5xl font-black mb-3 tracking-tighter">
            Alta de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Profesional</span>
          </h1>
          <p className="text-slate-400 text-lg font-light">
            Creá tu tarjeta de presentación para la Guía de Industria.
          </p>
          <div className="flex justify-center gap-2 mt-6" role="tablist" aria-label="Pasos del formulario">
            <span className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-blue-500' : 'bg-slate-700'}`} aria-current={step === 1 ? 'step' : undefined} />
            <span className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-blue-500' : 'bg-slate-700'}`} aria-current={step === 2 ? 'step' : undefined} />
            <span className={`w-3 h-3 rounded-full ${step >= 3 ? 'bg-blue-500' : 'bg-slate-700'}`} aria-current={step === 3 ? 'step' : undefined} />
          </div>
        </div>

        <form id="form-crear-perfil" onSubmit={handleSubmit} className="space-y-10">
          {/* PASO 1: Identidad, filmografía y biografía */}
          {step === 1 && (
            <div className="space-y-6" role="tabpanel" aria-labelledby="crear-step1-title">
              <h2 id="crear-step1-title" className="sr-only">Paso 1: Identidad y biografía</h2>
              <h3 className="text-blue-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                <User size={16} aria-hidden /> Identidad Profesional
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="group">
                  <label htmlFor="crear-nombre" className="block text-xs font-bold uppercase text-slate-400 mb-2">Nombre Público</label>
                  <input id="crear-nombre" name="nombre" type="text" required placeholder="Ej: Juan Pérez o Cine TDF"
                    className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl px-4 py-4 text-white outline-none focus:border-blue-500 focus:bg-slate-950/50 transition-all placeholder:text-slate-700"
                    value={formData.nombre} onChange={handleChange} />
                </div>
                <div className="group">
                  <label htmlFor="crear-tipo" className="block text-xs font-bold uppercase text-slate-400 mb-2">Tipo de Perfil</label>
                  <div className="relative">
                    <select id="crear-tipo" name="tipoPerfil" className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl px-4 py-4 text-white outline-none focus:border-blue-500 appearance-none cursor-pointer" value={formData.tipoPerfil} onChange={handleChange}>
                      <option value="Profesional">Profesional Independiente</option>
                      <option value="Productora">Productora Audiovisual</option>
                      <option value="Empresa">Empresa de Servicios</option>
                      <option value="Estudiante">Estudiante</option>
                    </select>
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" aria-hidden>▼</span>
                  </div>
                </div>
                <div className="group">
                  <label htmlFor="crear-rubro" className="block text-xs font-bold uppercase text-slate-400 mb-2">Rubro Principal</label>
                  <div className="relative">
                    <select id="crear-rubro" name="rubro" required className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl px-4 py-4 text-white outline-none focus:border-blue-500 appearance-none cursor-pointer" value={formData.rubro} onChange={handleChange}>
                      <option value="">Seleccioná tu especialidad...</option>
                      {RUBROS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" aria-hidden>▼</span>
                  </div>
                </div>
                {formData.rubro && RUBRO_SUGERENCIAS[formData.rubro] && (
                  <div className="md:col-span-2">
                    <p className="text-xs font-bold uppercase text-slate-500 mb-2">Sugerencias para tu perfil (clic para agregar a la bio)</p>
                    <div className="flex flex-wrap gap-2">
                      {RUBRO_SUGERENCIAS[formData.rubro].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            descripcion: prev.descripcion ? `${prev.descripcion.trim()}, ${tag}` : tag,
                          }))}
                          className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-800 hover:bg-orange-600/80 text-slate-300 hover:text-white border border-slate-700 hover:border-orange-500/50 transition"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="group">
                  <label htmlFor="crear-ciudad" className="block text-xs font-bold uppercase text-slate-400 mb-2">Ciudad Base</label>
                  <div className="relative">
                    <select id="crear-ciudad" name="ciudad" className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl px-4 py-4 text-white outline-none focus:border-blue-500 appearance-none cursor-pointer" value={formData.ciudad} onChange={handleChange}>
                      <option value="Ushuaia">Ushuaia</option>
                      <option value="Río Grande">Río Grande</option>
                      <option value="Tolhuin">Tolhuin</option>
                    </select>
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" aria-hidden>▼</span>
                  </div>
                </div>
                <div className="group">
                  <label htmlFor="crear-fecha" className="block text-xs font-bold uppercase text-slate-400 mb-2">Fecha de Nacimiento</label>
                  <input id="crear-fecha" type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)}
                    className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl px-4 py-4 text-white outline-none focus:border-blue-500 placeholder:text-slate-700" />
                </div>
                <div className="group">
                  <label htmlFor="crear-formacion" className="block text-xs font-bold uppercase text-slate-400 mb-2">Formación Académica</label>
                  <input id="crear-formacion" type="text" placeholder="Ej: ENERC, FUC, Autodidacta..." value={formacion} onChange={(e) => setFormacion(e.target.value)}
                    className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl px-4 py-4 text-white outline-none focus:border-blue-500 placeholder:text-slate-700" />
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-slate-800/50">
                <h3 className="text-purple-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                  <Briefcase size={16} aria-hidden /> Filmografía / Experiencia
                </h3>
                <div className="space-y-3">
                  {experiencias.map((exp, index) => (
                    <div key={index} className="flex flex-wrap gap-3 items-center">
                      <input type="text" placeholder="Año" aria-label={`Año experiencia ${index + 1}`} className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-3 py-3 text-white text-sm focus:border-purple-500 outline-none"
                        value={exp.anio} onChange={(e) => handleExperienciaChange(index, 'anio', e.target.value)} />
                      <input type="text" placeholder="Nombre del Proyecto" aria-label={`Proyecto ${index + 1}`} className="flex-1 min-w-[120px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-3 text-white text-sm focus:border-purple-500 outline-none"
                        value={exp.proyecto} onChange={(e) => handleExperienciaChange(index, 'proyecto', e.target.value)} />
                      <input type="text" placeholder="Rol" aria-label={`Rol ${index + 1}`} className="flex-1 min-w-[100px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-3 text-white text-sm focus:border-purple-500 outline-none"
                        value={exp.rol} onChange={(e) => handleExperienciaChange(index, 'rol', e.target.value)} />
                      {experiencias.length > 1 && (
                        <button type="button" onClick={() => removeExperiencia(index)} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-500 hover:bg-red-500/10 rounded-lg" aria-label="Quitar experiencia">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addExperiencia} className="text-xs font-bold text-purple-400 flex items-center gap-2 min-h-[44px] px-4 hover:text-white transition bg-purple-500/10 rounded-full border border-purple-500/20 hover:bg-purple-500/20">
                  <PlusCircle size={14} aria-hidden /> AGREGAR OTRO PROYECTO
                </button>
              </div>

              <div className="group relative pt-6">
                <div className="flex flex-wrap justify-between items-end gap-3 mb-3">
                  <label htmlFor="crear-descripcion" className="block text-xs font-bold uppercase text-slate-400">Biografía / Servicios</label>
                  <button type="button" onClick={generarDescripcionIA} disabled={generandoIA}
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-full transition shadow-lg shadow-purple-500/30 min-h-[44px]">
                    {generandoIA ? <Loader2 className="animate-spin" size={12} aria-hidden /> : <Sparkles size={12} aria-hidden />}
                    {generandoIA ? 'ESCRIBIENDO...' : 'GENERAR CON IA'}
                  </button>
                </div>
                <textarea id="crear-descripcion" name="descripcion" required rows={5} value={formData.descripcion} onChange={handleChange} placeholder="Descripción de tu perfil (mínimo 20 caracteres)..."
                  className="w-full bg-slate-950 border-l-4 border-slate-800 rounded-r-xl p-6 text-slate-300 outline-none focus:border-blue-500 transition-all resize-none placeholder:text-slate-700 leading-relaxed" />
                {formData.descripcion.length > 0 && formData.descripcion.length < 20 && (
                  <p className="text-amber-400 text-sm mt-1">Mínimo 20 caracteres para continuar.</p>
                )}
              </div>
            </div>
          )}

          {/* PASO 2: Media y portfolio */}
          {step === 2 && (
            <div className="space-y-6 pt-6 border-t border-slate-800/50" role="tabpanel" aria-labelledby="crear-step2-title">
              <h2 id="crear-step2-title" className="sr-only">Paso 2: Media y portfolio</h2>
              <h3 className="text-cyan-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                <ImageIcon size={16} aria-hidden /> Media & Portfolio
              </h3>
              <div className="bg-slate-950/30 p-6 rounded-2xl border border-slate-800 border-dashed flex flex-col sm:flex-row items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                  {previewPrincipal ? <img src={previewPrincipal} alt="Vista previa foto de perfil" className="w-full h-full object-cover" /> : <ImageIcon size={24} className="text-slate-700" aria-hidden />}
                </div>
                <div className="flex-1">
                  <label htmlFor="crear-foto-upload" className="block text-sm font-bold text-slate-300 mb-1">Foto de Perfil (máx. 2MB)</label>
                  <input type="file" id="crear-foto-upload" accept="image/*" onChange={handleMainFileChange} className="hidden" />
                  <label htmlFor="crear-foto-upload" className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer font-bold underline inline-flex items-center min-h-[44px]">
                    {previewPrincipal ? 'Cambiar imagen' : 'Seleccionar imagen'}
                  </label>
                </div>
              </div>
              <div className="group">
                <label htmlFor="crear-videoReel" className="block text-xs font-bold uppercase text-slate-400 mb-2 flex items-center gap-2">
                  <Youtube size={14} aria-hidden /> Video Reel (YouTube / Vimeo)
                </label>
                <input id="crear-videoReel" name="videoReel" type="url" inputMode="url" placeholder="https://youtube.com/watch?v=..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500 transition-all placeholder:text-slate-700"
                  value={formData.videoReel} onChange={handleChange} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-4 flex items-center gap-2">
                  <ImageIcon size={14} aria-hidden /> Galería de Trabajos (máx. 5, 2MB c/u)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  {previewsGaleria.map((src, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-700 group">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeGalleryImage(idx)} className="absolute top-1 right-1 min-w-[44px] min-h-[44px] flex items-center justify-center bg-red-500/80 rounded-full text-white hover:bg-red-500 transition opacity-0 group-hover:opacity-100" aria-label="Quitar imagen de galería">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {previewsGaleria.length < 5 && (
                    <>
                      <input type="file" id="crear-gallery-upload" accept="image/*" multiple onChange={handleGalleryChange} className="hidden" />
                      <label htmlFor="crear-gallery-upload" className="aspect-square rounded-xl border-2 border-dashed border-slate-800 bg-slate-900/50 hover:bg-slate-800 hover:border-blue-500/50 transition cursor-pointer flex flex-col items-center justify-center text-slate-600 hover:text-blue-400 min-h-[80px]">
                        <Plus size={24} aria-hidden />
                        <span className="text-[10px] font-bold mt-2">Agregar</span>
                      </label>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PASO 3: Contacto y redes */}
          {step === 3 && (
            <div className="space-y-6 pt-6 border-t border-slate-800/50" role="tabpanel" aria-labelledby="crear-step3-title">
              <h2 id="crear-step3-title" className="sr-only">Paso 3: Contacto y redes</h2>
              <h3 className="text-emerald-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                <Mail size={16} aria-hidden /> Datos de Contacto
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="group">
                  <label htmlFor="crear-email" className="block text-xs font-bold uppercase text-slate-400 mb-2">Email Público</label>
                  <input id="crear-email" name="email" type="email" required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-all" value={formData.email} onChange={handleChange} />
                </div>
                <div className="group">
                  <label htmlFor="crear-telefono" className="block text-xs font-bold uppercase text-slate-400 mb-2">Teléfono</label>
                  <input id="crear-telefono" name="telefono" type="text" inputMode="tel" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-all" value={formData.telefono} onChange={handleChange} />
                </div>
                <div className="group">
                  <label htmlFor="crear-web" className="block text-xs font-bold uppercase text-slate-400 mb-2">Web / Portfolio</label>
                  <input id="crear-web" name="web" type="url" inputMode="url" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-all placeholder:text-slate-600" value={formData.web} onChange={handleChange} placeholder="https://..." />
                </div>
              </div>
              <div>
                <label htmlFor="crear-colorTema" className="block text-xs font-bold uppercase text-slate-400 mb-2 flex items-center gap-2"><Palette size={14} aria-hidden /> Color de tu tarjeta en la guía</label>
                <div className="flex items-center gap-4 bg-slate-950 border border-slate-800 p-3 rounded-xl max-w-xs">
                  <input type="color" id="crear-colorTema" name="colorTema" value={formData.colorTema} onChange={handleChange} className="w-12 h-10 rounded cursor-pointer border border-slate-700 bg-transparent p-0" />
                  <span className="text-slate-400 text-sm font-mono">{formData.colorTema}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-3">Redes sociales (URL o @usuario)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <input id="crear-instagram" name="instagram" type="text" inputMode="url" value={formData.instagram} placeholder="Instagram" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition-all placeholder:text-slate-600" onChange={handleChange} />
                  <input id="crear-facebook" name="facebook" type="text" inputMode="url" value={formData.facebook} placeholder="Facebook" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all placeholder:text-slate-600" onChange={handleChange} />
                  <input id="crear-twitter" name="twitter" type="text" inputMode="url" value={formData.twitter} placeholder="X / Twitter" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-sky-400 transition-all placeholder:text-slate-600" onChange={handleChange} />
                  <input id="crear-linkedin" name="linkedin" type="text" inputMode="url" value={formData.linkedin} placeholder="LinkedIn" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-blue-600 transition-all placeholder:text-slate-600" onChange={handleChange} />
                  <input id="crear-tiktok" name="tiktok" type="text" inputMode="url" value={formData.tiktok} placeholder="TikTok" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-slate-300 transition-all placeholder:text-slate-600" onChange={handleChange} />
                </div>
              </div>
            </div>
          )}

          {depthStatus && <p className="text-cyan-400 text-sm font-medium">{depthStatus}</p>}

          {/* Navegación escritorio */}
          <div className="hidden md:flex pt-6 justify-between items-center border-t border-slate-800">
            {step > 1 ? (
              <button type="button" onClick={() => setStep(s => s - 1)} className="flex items-center gap-2 text-slate-400 hover:text-white font-bold transition-colors">
                <ChevronLeft size={20} aria-hidden /> Anterior
              </button>
            ) : <div />}
            {step < 3 ? (
              <button type="button" onClick={() => setStep(s => s + 1)} disabled={step === 1 ? !canNextStep1 : !canNextStep2} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition">
                Siguiente <ChevronRight size={20} aria-hidden />
              </button>
            ) : (
              <button type="submit" disabled={loading || uploading} className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black py-5 px-8 rounded-full transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50 flex justify-center items-center gap-3">
                {uploading || loading ? <Loader2 className="animate-spin" size={24} aria-hidden /> : <Briefcase size={24} aria-hidden />}
                {uploading ? 'SUBIENDO ARCHIVOS...' : (loading ? 'GUARDANDO PERFIL...' : 'PUBLICAR MI PERFIL')}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Botón sticky en móvil */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-20 p-4 bg-slate-950/95 backdrop-blur border-t border-slate-800 safe-area-pb">
        {step < 3 ? (
          <div className="flex gap-3 max-w-4xl mx-auto">
            {step > 1 && (
              <button type="button" onClick={() => setStep(s => s - 1)} className="flex-1 min-h-[48px] flex items-center justify-center gap-2 text-slate-400 hover:text-white font-bold border border-slate-700 rounded-xl transition-colors">
                <ChevronLeft size={20} aria-hidden /> Anterior
              </button>
            )}
            <button type="button" onClick={() => setStep(s => s + 1)} disabled={step === 1 ? !canNextStep1 : !canNextStep2} className="flex-1 min-h-[48px] flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition">
              Siguiente <ChevronRight size={20} aria-hidden />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => (document.getElementById('form-crear-perfil') as HTMLFormElement | null)?.requestSubmit()} disabled={loading || uploading} className="w-full max-w-4xl mx-auto min-h-[48px] flex justify-center items-center gap-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black py-4 rounded-full transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50">
            {uploading || loading ? <Loader2 className="animate-spin" size={24} aria-hidden /> : <Briefcase size={24} aria-hidden />}
            {uploading ? 'SUBIENDO...' : (loading ? 'GUARDANDO...' : 'PUBLICAR MI PERFIL')}
          </button>
        )}
      </div>
    </div>
  );
}
