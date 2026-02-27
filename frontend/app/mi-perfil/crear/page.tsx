'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { 
  User, Briefcase, MapPin, Mail, Phone, Globe, 
  Image as ImageIcon, Loader2, Youtube, Plus, 
  Trash2, ArrowLeft, PlusCircle, Sparkles
} from 'lucide-react';

// --- CONFIGURACIÓN SUPABASE ---
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

export default function CrearPerfilPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generandoIA, setGenerandoIA] = useState(false);

  // Estados del Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    tipoPerfil: 'Profesional',
    rubro: '',
    descripcion: '',
    email: '',
    telefono: '',
    web: '',
    foto: '', 
    videoReel: '',
    ciudad: 'Ushuaia',
    colorTema: '#0ea5e9',
    galeria: [] as string[]
  });

  // Estados Nuevos (Datos Extra)
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [formacion, setFormacion] = useState('');
  const [experiencias, setExperiencias] = useState([{ proyecto: '', anio: '', rol: '' }]);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  // Estados de Archivos
  const [archivoPrincipal, setArchivoPrincipal] = useState<File | null>(null);
  const [previewPrincipal, setPreviewPrincipal] = useState<string | null>(null);
  
  const [archivosGaleria, setArchivosGaleria] = useState<File[]>([]);
  const [previewsGaleria, setPreviewsGaleria] = useState<string[]>([]);

  // 1. Verificar sesión
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // --- MANEJO DE EXPERIENCIAS DINÁMICAS ---
  const addExperiencia = () => {
    setExperiencias([...experiencias, { proyecto: '', anio: '', rol: '' }]);
  };

  const removeExperiencia = (index: number) => {
    const list = [...experiencias];
    list.splice(index, 1);
    setExperiencias(list);
  };

  const handleExperienciaChange = (index: number, field: string, value: string) => {
    const list = [...experiencias] as any;
    list[index][field] = value;
    setExperiencias(list);
  };

  // --- IA: GENERAR BIO (nombre, edad, formación, tipo de perfil, rubro, experiencia previa) ---
  const generarDescripcionIA = async () => {
    if (!formData.nombre || !formData.rubro) return alert("Completa al menos tu nombre y rubro primero.");
    setGenerandoIA(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/prestador/generar-bio-ia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          nombre: formData.nombre,
          fechaNacimiento,
          formacion,
          tipoPerfil: formData.tipoPerfil,
          rubro: formData.rubro,
          experiencias,
        }),
      });
      const data = await res.json();
      if (data.bio) {
        setFormData((prev) => ({ ...prev, descripcion: data.bio }));
      }
      if (data.error) {
        console.warn('IA devolvió error:', data.error);
      }
    } catch (e) {
      console.error(e);
      alert("Error conectando con la IA. Verificá que el backend esté en marcha y que DEEPSEEK_API_KEY esté en el .env del backend.");
    } finally {
      setGenerandoIA(false);
    }
  };

  // --- MANEJO DE ARCHIVOS ---
  const handleMainFileChange = (e: any) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setArchivoPrincipal(file);
      setPreviewPrincipal(URL.createObjectURL(file));
    }
  };

  const handleGalleryChange = (e: any) => {
    const files = Array.from(e.target.files as FileList);
    const totalFiles = archivosGaleria.length + files.length;
    if (totalFiles > 5) {
      alert("Solo puedes subir un máximo de 5 fotos en tu galería.");
      return;
    }
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setArchivosGaleria([...archivosGaleria, ...files]);
    setPreviewsGaleria([...previewsGaleria, ...newPreviews]);
  };

  const removeGalleryImage = (index: number) => {
    const newFiles = [...archivosGaleria];
    const newPreviews = [...previewsGaleria];
    newFiles.splice(index, 1);
    newPreviews.splice(index, 1);
    setArchivosGaleria(newFiles);
    setPreviewsGaleria(newPreviews);
  };

  const uploadImageToSupabase = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { error } = await supabase.storage.from('profesionales').upload(fileName, file);
    if (error) throw error;
    const { data } = supabase.storage.from('profesionales').getPublicUrl(fileName);
    return data.publicUrl;
  };

  // --- SUBMIT ---
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setUploading(true);

    try {
      let finalFotoPrincipal = formData.foto;
      let finalGaleria = [...formData.galeria];

      if (archivoPrincipal) {
        const url = await uploadImageToSupabase(archivoPrincipal);
        if (url) finalFotoPrincipal = url;
      }

      if (archivosGaleria.length > 0) {
        const uploadPromises = archivosGaleria.map(file => uploadImageToSupabase(file));
        const uploadedUrls = await Promise.all(uploadPromises);
        finalGaleria = [...finalGaleria, ...uploadedUrls];
      }

      // Filtramos experiencias vacías
      const experienciasFiltradas = experiencias.filter(e => e.proyecto && e.anio);

      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/prestador`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
            ...formData, 
            foto: finalFotoPrincipal,
            galeria: finalGaleria,
            fechaNacimiento,
            formacion,
            experiencias: experienciasFiltradas
        })
      });

      if (res.ok) {
        router.push('/mi-perfil');
        router.refresh();
      } else {
        const error = await res.json();
        alert(`Error: ${error.message}`);
      }

    } catch (error) {
      console.error(error);
      alert("Ocurrió un error al guardar el perfil.");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white pt-28 pb-12 px-6 font-sans flex items-center justify-center relative overflow-hidden">
      
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
      
      <div className="max-w-4xl w-full bg-slate-900 p-8 md:p-12 rounded-3xl border border-slate-800 shadow-2xl relative z-10">
        
        <button onClick={() => router.back()} className="text-slate-500 hover:text-white flex items-center gap-2 mb-8 transition text-sm font-bold uppercase tracking-wider">
            <ArrowLeft size={16}/> Cancelar y Volver
        </button>

        <div className="text-center mb-10 border-b border-slate-800/50 pb-8">
          <h1 className="text-4xl md:text-5xl font-black mb-3 tracking-tighter">
            Alta de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Profesional</span>
          </h1>
          <p className="text-slate-400 text-lg font-light">
            Crea tu tarjeta de presentación para la Guía de Industria.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          
          {/* SECCIÓN 1: DATOS PRINCIPALES */}
          <div className="space-y-6">
            <h3 className="text-blue-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                <User size={16}/> Identidad Profesional
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="group">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Nombre Público</label>
                    <input name="nombre" type="text" required placeholder="Ej: Juan Pérez o Cine TDF"
                        className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl px-4 py-4 text-white outline-none focus:border-blue-500 focus:bg-slate-950/50 transition-all placeholder:text-slate-700"
                        onChange={handleChange} />
                </div>

                <div className="group">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Tipo de Perfil</label>
                    <div className="relative">
                        <select name="tipoPerfil" className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl px-4 py-4 text-white outline-none focus:border-blue-500 appearance-none cursor-pointer" onChange={handleChange}>
                        <option value="Profesional">Profesional Independiente</option>
                        <option value="Productora">Productora Audiovisual</option>
                        <option value="Empresa">Empresa de Servicios</option>
                        <option value="Estudiante">Estudiante</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                    </div>
                </div>

                <div className="group">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Rubro Principal</label>
                    <div className="relative">
                        <select name="rubro" required className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl px-4 py-4 text-white outline-none focus:border-blue-500 appearance-none cursor-pointer" onChange={handleChange}>
                        <option value="">Selecciona tu especialidad...</option>
                        {RUBROS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                    </div>
                </div>

                <div className="group">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Ciudad Base</label>
                    <div className="relative">
                        <select name="ciudad" className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl px-4 py-4 text-white outline-none focus:border-blue-500 appearance-none cursor-pointer" onChange={handleChange}>
                        <option value="Ushuaia">Ushuaia</option>
                        <option value="Río Grande">Río Grande</option>
                        <option value="Tolhuin">Tolhuin</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                    </div>
                </div>

                {/* NUEVOS CAMPOS: FECHA Y FORMACIÓN */}
                <div className="group">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Fecha de Nacimiento</label>
                    <input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} 
                        className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl px-4 py-4 text-white outline-none focus:border-blue-500 placeholder:text-slate-700"/>
                </div>
                <div className="group">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Formación Académica</label>
                    <input type="text" placeholder="Ej: ENERC, FUC, Autodidacta..." value={formacion} onChange={(e) => setFormacion(e.target.value)} 
                        className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl px-4 py-4 text-white outline-none focus:border-blue-500 placeholder:text-slate-700"/>
                </div>
            </div>

            {/* SECCIÓN FILMOGRAFÍA */}
            <div className="space-y-4 pt-6 border-t border-slate-800/50">
                <h3 className="text-purple-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                    <Briefcase size={16}/> Filmografía / Experiencia
                </h3>
                
                <div className="space-y-3">
                    {experiencias.map((exp, index) => (
                        <div key={index} className="flex gap-3 animate-in slide-in-from-left duration-500">
                            <input type="text" placeholder="Año" className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-3 py-3 text-white text-sm focus:border-purple-500 outline-none"
                                value={exp.anio} onChange={(e) => handleExperienciaChange(index, 'anio', e.target.value)}/>
                            <input type="text" placeholder="Nombre del Proyecto" className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-3 text-white text-sm focus:border-purple-500 outline-none"
                                value={exp.proyecto} onChange={(e) => handleExperienciaChange(index, 'proyecto', e.target.value)}/>
                            <input type="text" placeholder="Rol" className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-3 text-white text-sm focus:border-purple-500 outline-none"
                                value={exp.rol} onChange={(e) => handleExperienciaChange(index, 'rol', e.target.value)}/>
                            
                            {experiencias.length > 1 && (
                                <button type="button" onClick={() => removeExperiencia(index)} className="text-red-500 hover:bg-red-500/10 p-3 rounded-lg"><Trash2 size={16}/></button>
                            )}
                        </div>
                    ))}
                </div>
                <button type="button" onClick={addExperiencia} className="text-xs font-bold text-purple-400 flex items-center gap-2 mt-2 hover:text-white transition bg-purple-500/10 px-4 py-2 rounded-full border border-purple-500/20 hover:bg-purple-500/20">
                    <PlusCircle size={14}/> AGREGAR OTRO PROYECTO
                </button>
            </div>
            
            {/* SECCIÓN BIO CON IA */}
            <div className="group relative pt-6">
                <div className="flex justify-between items-end mb-3">
                    <label className="block text-xs font-bold uppercase text-slate-500">Biografía / Servicios</label>
                    
                    <button type="button" onClick={generarDescripcionIA} disabled={generandoIA}
                        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-full transition shadow-lg shadow-purple-500/30">
                        {generandoIA ? <Loader2 className="animate-spin" size={12}/> : <Sparkles size={12}/>}
                        {generandoIA ? 'ESCRIBIENDO...' : 'GENERAR CON IA'}
                    </button>
                </div>
                <textarea name="descripcion" required rows={5} value={formData.descripcion} onChange={handleChange} placeholder="Descripción de tu perfil..."
                className="w-full bg-slate-950 border-l-4 border-slate-800 rounded-r-xl p-6 text-slate-300 outline-none focus:border-blue-500 transition-all resize-none placeholder:text-slate-700 leading-relaxed"
                ></textarea>
            </div>
          </div>

          {/* SECCIÓN 2: MEDIA Y PORTFOLIO */}
          <div className="space-y-6 pt-6 border-t border-slate-800/50">
            <h3 className="text-cyan-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                <ImageIcon size={16}/> Media & Portfolio
            </h3>

            {/* FOTO PRINCIPAL */}
            <div className="bg-slate-950/30 p-6 rounded-2xl border border-slate-800 border-dashed flex flex-col sm:flex-row items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                    {previewPrincipal ? <img src={previewPrincipal} className="w-full h-full object-cover"/> : <ImageIcon size={24} className="text-slate-700"/>}
                </div>
                <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-300 mb-1">Foto de Perfil *</label>
                    <input type="file" id="foto-upload" accept="image/*" onChange={handleMainFileChange} className="hidden" />
                    <label htmlFor="foto-upload" className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer font-bold underline">
                        {previewPrincipal ? 'Cambiar imagen' : 'Seleccionar imagen'}
                    </label>
                </div>
            </div>

            {/* VIDEO REEL */}
            <div className="group">
                <label className="block text-xs font-bold uppercase text-slate-500 mb-2 flex items-center gap-2">
                    <Youtube size={14}/> Video Reel (YouTube / Vimeo)
                </label>
                <input name="videoReel" type="url" placeholder="https://youtube.com/watch?v=..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500 transition-all placeholder:text-slate-700"
                    onChange={handleChange} />
            </div>

            {/* GALERÍA */}
            <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-4 flex items-center gap-2">
                    <ImageIcon size={14}/> Galería de Trabajos (Max 5)
                </label>
                
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    {previewsGaleria.map((src, idx) => (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-700 group">
                            <img src={src} className="w-full h-full object-cover"/>
                            <button type="button" onClick={() => removeGalleryImage(idx)} 
                                className="absolute top-1 right-1 bg-red-500/80 p-1 rounded-full text-white hover:bg-red-500 transition opacity-0 group-hover:opacity-100">
                                <Trash2 size={12}/>
                            </button>
                        </div>
                    ))}
                    
                    {previewsGaleria.length < 5 && (
                        <>
                            <input type="file" id="gallery-upload" accept="image/*" multiple onChange={handleGalleryChange} className="hidden" />
                            <label htmlFor="gallery-upload" className="aspect-square rounded-xl border-2 border-dashed border-slate-800 bg-slate-900/50 hover:bg-slate-800 hover:border-blue-500/50 transition cursor-pointer flex flex-col items-center justify-center text-slate-600 hover:text-blue-400">
                                <Plus size={24}/>
                                <span className="text-[10px] font-bold mt-2">Agregar</span>
                            </label>
                        </>
                    )}
                </div>
            </div>
          </div>

          {/* SECCIÓN 3: CONTACTO */}
          <div className="space-y-6 pt-6 border-t border-slate-800/50">
            <h3 className="text-emerald-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                <Mail size={16}/> Datos de Contacto
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="group">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Email Público</label>
                    <input name="email" type="email" required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-all" onChange={handleChange} />
                </div>
                <div className="group">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Teléfono</label>
                    <input name="telefono" type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-all" onChange={handleChange} />
                </div>
                <div className="group">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Web / Portfolio</label>
                    <input name="web" type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-all" onChange={handleChange} />
                </div>
            </div>
          </div>

          <div className="pt-6">
            <button 
              type="submit" 
              disabled={loading || uploading}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black py-5 rounded-full transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50 flex justify-center items-center gap-3 transform hover:-translate-y-1 hover:scale-[1.01]"
            >
              {uploading || loading ? <Loader2 className="animate-spin" size={24} /> : <Briefcase size={24} />}
              {uploading ? 'SUBIENDO ARCHIVOS...' : (loading ? 'GUARDANDO PERFIL...' : 'PUBLICAR MI PERFIL')}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}