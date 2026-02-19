'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { 
  User, Briefcase, Mail, Phone, Globe, MapPin, 
  Camera, Save, Loader2, ArrowLeft, Palette, 
  Image as ImageIcon, Trash2, Plus, Youtube 
} from 'lucide-react';

// --- CONFIGURACIÓN SUPABASE ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const RUBROS = [
  "Dirección", "Producción", "Guion", "Fotografía / Cámara", "Sonido", 
  "Arte / Escenografía", "Vestuario / Maquillaje", "Montaje / Postproducción", 
  "Música", "Actuación / Casting", "Actor / Actriz", "Doblaje de Voz",
  "Alquiler de Equipos", "Catering", "Transporte / Logística", "Legales / Gestoría", 
  "VFX / Animación", "Drones"
];

export default function EditarPerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  
  // Estado para desempaquetar params
  const [profileId, setProfileId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Datos del formulario
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
    colorTema: '#ea580c',
    galeria: [] as string[]
  });

  // Estados para manejo de archivos nuevos
  const [newFoto, setNewFoto] = useState<File | null>(null);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);
  
  const [newGaleriaFiles, setNewGaleriaFiles] = useState<File[]>([]);
  const [previewNewGaleria, setPreviewNewGaleria] = useState<string[]>([]);

  // 1. Desempaquetar params y Cargar datos
  useEffect(() => {
    params.then((unwrap) => {
        setProfileId(unwrap.id);
        fetchPerfilData(unwrap.id);
    });
  }, [params]);

  const fetchPerfilData = async (id: string) => {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`http://localhost:3000/prestador/mis-perfiles/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            setFormData({
                nombre: data.nombre || '',
                tipoPerfil: data.tipoPerfil || 'Profesional',
                rubro: data.rubro || '',
                descripcion: data.descripcion || '',
                email: data.email || '',
                telefono: data.telefono || '',
                web: data.web || '',
                foto: data.foto || '',
                videoReel: data.videoReel || '',
                ciudad: data.ciudad || 'Ushuaia',
                colorTema: data.colorTema || '#ea580c',
                galeria: data.galeria || []
            });
            // Si ya tiene foto, la ponemos como preview inicial
            if (data.foto) setPreviewFoto(data.foto);
        } else {
            setError('No se pudo cargar el perfil o no tienes permisos.');
        }
    } catch (err) {
        setError('Error de conexión.');
    } finally {
        setLoading(false);
    }
  };

  // --- HANDLERS DE FORMULARIO ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // --- HANDLERS DE ARCHIVOS ---
  const handleFileChange = (e: any) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewFoto(file);
      setPreviewFoto(URL.createObjectURL(file));
    }
  };

  const handleGalleryChange = (e: any) => {
    const files = Array.from(e.target.files as FileList);
    const totalFiles = formData.galeria.length + newGaleriaFiles.length + files.length;
    
    if (totalFiles > 5) {
      alert("Solo puedes tener un máximo de 5 fotos en la galería.");
      return;
    }

    const newPreviews = files.map(file => URL.createObjectURL(file));
    setNewGaleriaFiles([...newGaleriaFiles, ...files]);
    setPreviewNewGaleria([...previewNewGaleria, ...newPreviews]);
  };

  // Eliminar foto de la galería existente (URLs ya guardadas)
  const removeExistingGalleryImage = (index: number) => {
    const newGaleria = [...formData.galeria];
    newGaleria.splice(index, 1);
    setFormData({ ...formData, galeria: newGaleria });
  };

  // Eliminar foto nueva que aun no se subió
  const removeNewGalleryImage = (index: number) => {
    const newFiles = [...newGaleriaFiles];
    const newPreviews = [...previewNewGaleria];
    newFiles.splice(index, 1);
    newPreviews.splice(index, 1);
    setNewGaleriaFiles(newFiles);
    setPreviewNewGaleria(newPreviews);
  };

  // Función auxiliar para subir a Supabase
  const uploadImageToSupabase = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { error } = await supabase.storage.from('profesionales').upload(fileName, file);
    if (error) throw error;
    const { data } = supabase.storage.from('profesionales').getPublicUrl(fileName);
    return data.publicUrl;
  };

  // --- SUBMIT ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!profileId) return;

    setSaving(true);
    setError('');

    const token = localStorage.getItem('token');
    
    try {
      let finalFoto = formData.foto;
      let finalGaleria = [...formData.galeria]; // Empezamos con las que ya existían

      // 1. Subir nueva foto de perfil si se seleccionó una
      if (newFoto) {
        finalFoto = await uploadImageToSupabase(newFoto);
      }

      // 2. Subir nuevas fotos de galería
      if (newGaleriaFiles.length > 0) {
        const uploadPromises = newGaleriaFiles.map(file => uploadImageToSupabase(file));
        const uploadedUrls = await Promise.all(uploadPromises);
        finalGaleria = [...finalGaleria, ...uploadedUrls];
      }

      // 3. Enviar al Backend
      const res = await fetch(`http://localhost:3000/prestador/${profileId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            ...formData,
            foto: finalFoto,
            galeria: finalGaleria
        })
      });

      if (res.ok) {
        router.push('/mi-perfil');
        router.refresh();
      } else {
        const errData = await res.json();
        setError(errData.message || 'Error al actualizar');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión o subida de archivos');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><Loader2 className="animate-spin"/></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pt-28 pb-12 px-6">
      <div className="max-w-4xl mx-auto">
        
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white flex items-center gap-2 mb-6 transition">
            <ArrowLeft size={18}/> Cancelar
        </button>

        <h1 className="text-3xl font-black mb-8 flex items-center gap-3">
            <Briefcase className="text-orange-500" size={32}/> Editar Perfil
        </h1>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl space-y-10">
            
            {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl text-sm">
                    {error}
                </div>
            )}

            {/* SECCIÓN 1: IDENTIDAD */}
            <div className="space-y-6">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">Identidad Profesional</h3>
                
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    
                    {/* FOTO DE PERFIL */}
                    <div className="shrink-0 flex flex-col items-center gap-3">
                        <div className="w-32 h-32 rounded-full bg-slate-950 border-2 border-slate-700 overflow-hidden flex items-center justify-center relative group">
                            {previewFoto ? (
                                <img src={previewFoto} className="w-full h-full object-cover"/>
                            ) : (
                                <User size={40} className="text-slate-600"/>
                            )}
                            <label htmlFor="foto-upload" className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                <Camera size={24} className="text-white"/>
                            </label>
                        </div>
                        <input type="file" id="foto-upload" accept="image/*" onChange={handleFileChange} className="hidden" />
                        <label htmlFor="foto-upload" className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer font-bold underline">Cambiar Foto</label>
                    </div>

                    {/* CAMPOS DE TEXTO */}
                    <div className="flex-1 space-y-4 w-full">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Nombre del Perfil *</label>
                                <input required name="nombre" type="text" value={formData.nombre} onChange={handleChange}
                                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl focus:border-orange-500 outline-none transition"/>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Tipo de Perfil</label>
                                <select name="tipoPerfil" value={formData.tipoPerfil} onChange={handleChange}
                                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl focus:border-orange-500 outline-none transition text-slate-300">
                                    <option value="Profesional">Profesional Independiente</option>
                                    <option value="Productora">Productora / Empresa</option>
                                    <option value="Estudiante">Estudiante</option>
                                    <option value="Proveedor">Proveedor de Servicios</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Rubro / Rol Principal *</label>
                                <select name="rubro" required value={formData.rubro} onChange={handleChange}
                                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl focus:border-orange-500 outline-none transition text-slate-300">
                                    <option value="">Selecciona...</option>
                                    {RUBROS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Color de Tarjeta</label>
                                <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 p-2 rounded-xl">
                                    <Palette size={18} className="text-slate-500 ml-2"/>
                                    <input type="color" name="colorTema" value={formData.colorTema} onChange={handleChange} 
                                        className="bg-transparent border-none w-full h-8 cursor-pointer rounded"/>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm text-slate-400 mb-2">Biografía / Descripción</label>
                    <textarea name="descripcion" rows={4} value={formData.descripcion} onChange={handleChange}
                        className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl focus:border-orange-500 outline-none transition resize-none"/>
                </div>
            </div>

            {/* SECCIÓN 2: MULTIMEDIA (GALERÍA Y VIDEO) */}
            <div className="space-y-6 pt-6 border-t border-slate-800/50">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center gap-2">
                    <ImageIcon size={16}/> Multimedia
                </h3>
                
                {/* VIDEO REEL */}
                <div className="group">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2 flex items-center gap-2">
                        <Youtube size={14}/> Video Reel (YouTube / Vimeo)
                    </label>
                    <input name="videoReel" type="url" value={formData.videoReel} placeholder="https://youtube.com/watch?v=..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500 transition-all placeholder:text-slate-700"
                        onChange={handleChange} />
                </div>

                {/* GALERÍA DE FOTOS */}
                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-4 flex items-center gap-2">
                        Galería de Trabajos (Max 5)
                    </label>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {/* 1. FOTOS YA EXISTENTES */}
                        {formData.galeria.map((src, idx) => (
                            <div key={`existing-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-slate-700 group">
                                <img src={src} className="w-full h-full object-cover"/>
                                <button type="button" onClick={() => removeExistingGalleryImage(idx)} 
                                    className="absolute top-1 right-1 bg-red-500/80 p-1 rounded-full text-white hover:bg-red-500 transition opacity-0 group-hover:opacity-100">
                                    <Trash2 size={12}/>
                                </button>
                                <span className="absolute bottom-1 left-1 bg-black/60 text-[10px] px-1 rounded text-white">Guardada</span>
                            </div>
                        ))}

                        {/* 2. FOTOS NUEVAS A SUBIR */}
                        {previewNewGaleria.map((src, idx) => (
                            <div key={`new-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-blue-500/50 group">
                                <img src={src} className="w-full h-full object-cover opacity-80"/>
                                <button type="button" onClick={() => removeNewGalleryImage(idx)} 
                                    className="absolute top-1 right-1 bg-red-500/80 p-1 rounded-full text-white hover:bg-red-500 transition">
                                    <Trash2 size={12}/>
                                </button>
                                <span className="absolute bottom-1 left-1 bg-blue-600 text-[10px] px-1 rounded text-white">Nueva</span>
                            </div>
                        ))}
                        
                        {/* BOTÓN AGREGAR */}
                        {(formData.galeria.length + newGaleriaFiles.length) < 5 && (
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
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">Contacto</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="relative">
                        <Mail className="absolute left-4 top-3.5 text-slate-500" size={18}/>
                        <input name="email" type="email" value={formData.email} onChange={handleChange}
                            className="w-full bg-slate-950 border border-slate-800 p-3 pl-12 rounded-xl focus:border-orange-500 outline-none transition"/>
                    </div>
                    <div className="relative">
                        <Phone className="absolute left-4 top-3.5 text-slate-500" size={18}/>
                        <input name="telefono" type="tel" value={formData.telefono} onChange={handleChange}
                            className="w-full bg-slate-950 border border-slate-800 p-3 pl-12 rounded-xl focus:border-orange-500 outline-none transition"/>
                    </div>
                    <div className="relative">
                        <Globe className="absolute left-4 top-3.5 text-slate-500" size={18}/>
                        <input name="web" type="url" value={formData.web} onChange={handleChange}
                            className="w-full bg-slate-950 border border-slate-800 p-3 pl-12 rounded-xl focus:border-orange-500 outline-none transition"/>
                    </div>
                    <div className="relative">
                        <MapPin className="absolute left-4 top-3.5 text-slate-500" size={18}/>
                        <select name="ciudad" value={formData.ciudad} onChange={handleChange}
                            className="w-full bg-slate-950 border border-slate-800 p-3 pl-12 rounded-xl focus:border-orange-500 outline-none transition text-slate-300">
                            <option value="Ushuaia">Ushuaia</option>
                            <option value="Río Grande">Río Grande</option>
                            <option value="Tolhuin">Tolhuin</option>
                            <option value="Antártida">Antártida</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="pt-8 border-t border-slate-800 flex justify-end gap-4">
                <button type="button" onClick={() => router.back()} className="px-6 py-3 text-slate-400 hover:text-white font-bold transition">Cancelar</button>
                <button disabled={saving} className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-8 rounded-xl transition flex items-center gap-2 shadow-lg shadow-orange-900/20 disabled:opacity-50">
                    {saving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Guardar Cambios
                </button>
            </div>

        </form>
      </div>
    </div>
  );
}