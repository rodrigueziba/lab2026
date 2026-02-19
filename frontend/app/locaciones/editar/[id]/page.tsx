'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Swal from 'sweetalert2';
import { 
  MapPin, Image as ImageIcon, FileText, Save, Loader2, 
  ArrowLeft, Navigation, UploadCloud, Plus, Trash2, Camera
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'; 

const CATEGORIAS_TDF = {
  "Paisaje Natural": ["Montañas", "Bosques", "Costas", "Lagos y lagunas", "Glaciares", "Turberas"],
  "Urbano y Arquitectura": ["Calles céntricas", "Puerto", "Edificios gubernamentales", "Casas antiguas", "Fábricas"],
  "Cultura y Esparcimiento": ["Museos", "Centros culturales", "Teatros", "Bares y restaurantes", "Hoteles"],
  "Infraestructura y Transporte": ["Rutas y caminos", "Aeropuerto", "Puentes", "Muelles"],
  "Sitios Abandonados": ["Estancias", "Buques encallados", "Estructuras oxidadas"],
  "Deporte": ["Centros invernales", "Pistas de patinaje", "Canchas", "Senderos de trekking"]
};

export default function NuevaLocacionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    nombre: '', ciudad: 'Ushuaia', categoria: '', subcategoria: '',
    descripcion: '', direccion: '', accesibilidad: '',
    lat: '', lng: '', foto: ''
  });

  // Estado para archivos
  const [archivoPrincipal, setArchivoPrincipal] = useState<File | null>(null);
  const [previewPrincipal, setPreviewPrincipal] = useState<string | null>(null);
  
  const [archivosGaleria, setArchivosGaleria] = useState<File[]>([]);
  const [previewsGaleria, setPreviewsGaleria] = useState<string[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    if (!token || user?.role !== 'admin') {
      router.push('/locaciones');
    }
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // --- MANEJO DE FOTOS ---

  const handleMainPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setArchivoPrincipal(file);
      setPreviewPrincipal(URL.createObjectURL(file));
    }
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const total = archivosGaleria.length + files.length;
    
    if (total > 8) {
        return Swal.fire('Límite alcanzado', 'Máximo 8 fotos en la galería', 'warning');
    }

    const newPreviews = files.map(f => URL.createObjectURL(f));
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

  // Subir a Supabase (Reutilizable)
  const uploadToSupabase = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `loc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const { error } = await supabase.storage.from('locaciones').upload(fileName, file);
    if (error) throw error;
    const { data } = supabase.storage.from('locaciones').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setFormData(prev => ({
          ...prev,
          lat: pos.coords.latitude.toString(),
          lng: pos.coords.longitude.toString()
        }));
        Swal.fire({ toast: true, icon: 'success', title: 'Ubicación obtenida', showConfirmButton: false, timer: 1000, position: 'top-end' });
      });
    } else {
      Swal.fire('Error', 'Geolocalización no disponible', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setUploading(true);

    try {
      // 1. Subir Foto Principal
      let finalFotoUrl = '';
      if (archivoPrincipal) {
        finalFotoUrl = await uploadToSupabase(archivoPrincipal);
      }

      // 2. Subir Galería (en paralelo)
      let galeriaUrls: string[] = [];
      if (archivosGaleria.length > 0) {
        const uploadPromises = archivosGaleria.map(file => uploadToSupabase(file));
        galeriaUrls = await Promise.all(uploadPromises);
      }

      // 3. Guardar en BD
      const payload = {
        ...formData,
        foto: finalFotoUrl,
        galeria: galeriaUrls, // Array de strings
        lat: formData.lat ? parseFloat(formData.lat) : null,
        lng: formData.lng ? parseFloat(formData.lng) : null
      };

      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/locacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        Swal.fire('¡Creada!', 'Locación agregada al catálogo.', 'success').then(() => router.push('/locaciones'));
      } else {
        throw new Error('Error al guardar en la base de datos');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      Swal.fire('Error', errorMessage, 'error');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pt-28 pb-12 px-6 selection:bg-orange-500/30">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white flex items-center gap-2 mb-8 transition font-medium group">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform"/> Cancelar
        </button>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 pb-6 border-b border-slate-800">
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-600 to-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-900/30 rotate-3">
                    <MapPin size={28} className="text-white"/>
                </div>
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Nueva Locación</h1>
                    <p className="text-slate-400 mt-1">Registra un nuevo escenario para producciones.</p>
                </div>
            </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* COLUMNA IZQUIERDA: DATOS (2/3 de ancho) */}
            <div className="lg:col-span-2 flex flex-col gap-6 animate-in slide-in-from-left duration-500">
                
                {/* TARJETA 1: DATOS GENERALES */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-colors flex-1 flex flex-col">
                    <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                        <FileText size={120}/>
                    </div>
                    
                    <h3 className="text-sm font-bold text-orange-500 uppercase tracking-widest mb-6 flex items-center gap-2 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-orange-500"></span> Información General
                    </h3>
                    
                    {/* Contenedor flexible para inputs */}
                    <div className="space-y-6 relative z-10 flex-1 flex flex-col">
                        <div className="shrink-0">
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Nombre de la Locación *</label>
                            <input required name="nombre" type="text" onChange={handleChange} placeholder="Ej: Laguna Esmeralda"
                                className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl focus:border-orange-500 outline-none transition text-white placeholder:text-slate-600"/>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 shrink-0">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Ciudad / Zona</label>
                                <div className="relative">
                                    <select name="ciudad" onChange={handleChange}
                                        className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl focus:border-orange-500 outline-none transition text-slate-300 appearance-none cursor-pointer">
                                        <option value="Ushuaia">Ushuaia</option>
                                        <option value="Tolhuin">Tolhuin</option>
                                        <option value="Río Grande">Río Grande</option>
                                        <option value="Antártida">Antártida</option>
                                        <option value="Zona Rural">Zona Rural / Ruta</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Dirección / Acceso</label>
                                <input name="direccion" type="text" onChange={handleChange} placeholder="Ej: Ruta 3 Km 3040"
                                    className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl focus:border-orange-500 outline-none transition text-white placeholder:text-slate-600"/>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col">
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Descripción Técnica *</label>
                            <textarea required name="descripcion" onChange={handleChange} placeholder="Detalles visuales, logística, permisos necesarios..."
                                className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl focus:border-orange-500 outline-none transition text-white resize-none placeholder:text-slate-600 leading-relaxed flex-1 h-full min-h-[150px]"/>
                        </div>
                    </div>
                </div>

                {/* TARJETA 2: UBICACIÓN (Tamaño fijo, no flexible) */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl shrink-0">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-bold text-orange-500 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-500"></span> Geolocalización
                        </h3>
                        <button type="button" onClick={handleGetLocation} 
                            className="text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white px-4 py-2 rounded-lg transition font-bold flex items-center gap-2 border border-blue-500/20">
                            <MapPin size={14}/> Detectar Ubicación
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2">Latitud</label>
                            <input name="lat" type="number" step="any" value={formData.lat} onChange={handleChange} placeholder="-54.8000"
                                className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl focus:border-blue-500 outline-none font-mono text-sm text-blue-300 placeholder:text-slate-600"/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2">Longitud</label>
                            <input name="lng" type="number" step="any" value={formData.lng} onChange={handleChange} placeholder="-68.3000"
                                className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl focus:border-blue-500 outline-none font-mono text-sm text-blue-300 placeholder:text-slate-600"/>
                        </div>
                    </div>
                </div>

            </div>

            {/* COLUMNA DERECHA: MULTIMEDIA Y CATEGORÍA (1/3 ancho) */}
            <div className="space-y-8 animate-in slide-in-from-right duration-500 delay-100 h-full">
                
                {/* TARJETA 3: FOTO PRINCIPAL */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <ImageIcon size={16}/> Foto de Portada
                    </h3>
                    
                    <div className="relative aspect-video w-full rounded-2xl bg-slate-950 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center overflow-hidden group hover:border-orange-500/50 hover:bg-slate-900 transition-all cursor-pointer">
                        {previewPrincipal ? (
                            <>
                                <img src={previewPrincipal} className="w-full h-full object-cover"/>
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-xs font-bold text-white flex items-center gap-2"><Camera size={16}/> Cambiar</span>
                                </div>
                            </>
                        ) : (
                            <div className="text-center p-4">
                                <UploadCloud size={32} className="mx-auto text-slate-500 mb-2 group-hover:text-orange-500 group-hover:scale-110 transition-all"/>
                                <p className="text-xs text-slate-500 font-medium">Click para subir imagen</p>
                            </div>
                        )}
                        <input type="file" accept="image/*" onChange={handleMainPhotoChange} className="absolute inset-0 opacity-0 cursor-pointer"/>
                    </div>
                </div>

                {/* TARJETA 4: GALERÍA */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                    <div className="flex justify-between items-end mb-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <ImageIcon size={16}/> Galería
                        </h3>
                        <span className="text-[10px] text-slate-500">{archivosGaleria.length}/8</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                        {previewsGaleria.map((src, idx) => (
                            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group border border-slate-700">
                                <img src={src} className="w-full h-full object-cover"/>
                                <button type="button" onClick={() => removeGalleryImage(idx)} 
                                    className="absolute inset-0 bg-red-500/80 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                        ))}
                        
                        {archivosGaleria.length < 8 && (
                            <div className="relative aspect-square rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center hover:border-blue-500/50 hover:bg-slate-950 transition cursor-pointer group">
                                <Plus size={20} className="text-slate-600 group-hover:text-blue-500 transition-colors"/>
                                <input type="file" multiple accept="image/*" onChange={handleGalleryChange} className="absolute inset-0 opacity-0 cursor-pointer"/>
                            </div>
                        )}
                    </div>
                </div>

                {/* TARJETA 5: CLASIFICACIÓN */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Categorización</h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Categoría</label>
                            <div className="relative">
                                <select required name="categoria" onChange={handleChange}
                                    className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl focus:border-orange-500 outline-none transition text-white text-sm appearance-none cursor-pointer">
                                    <option value="">Seleccionar...</option>
                                    {Object.keys(CATEGORIAS_TDF).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs">▼</div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Subcategoría</label>
                            <div className="relative">
                                <select name="subcategoria" onChange={handleChange}
                                    className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl focus:border-orange-500 outline-none transition text-white text-sm appearance-none cursor-pointer disabled:opacity-50"
                                    disabled={!formData.categoria}>
                                    <option value="">Seleccionar...</option>
                                    {formData.categoria && (CATEGORIAS_TDF as Record<string, string[]>)[formData.categoria]?.map((sub: string) => (
                                        <option key={sub} value={sub}>{sub}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs">▼</div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Accesibilidad</label>
                            <div className="relative">
                                <select name="accesibilidad" onChange={handleChange}
                                    className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl focus:border-orange-500 outline-none transition text-white text-sm appearance-none cursor-pointer">
                                    <option value="">Seleccionar...</option>
                                    <option value="Fácil (Vehículo)">Fácil (Vehículo)</option>
                                    <option value="Media (Caminata corta)">Media (Caminata corta)</option>
                                    <option value="Difícil (Trekking/4x4)">Difícil (Trekking/4x4)</option>
                                    <option value="Solo helicóptero/barco">Solo helicóptero/barco</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs">▼</div>
                            </div>
                        </div>
                    </div>
                </div>

                <button 
                    type="submit" 
                    disabled={uploading || loading}
                    className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-black py-4 rounded-xl shadow-lg shadow-orange-900/30 transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                >
                    {uploading ? <Loader2 className="animate-spin"/> : <Save size={20}/>}
                    {uploading ? 'Subiendo Archivos...' : 'PUBLICAR LOCACIÓN'}
                </button>

            </div>

        </form>
      </div>
    </div>
  );
}