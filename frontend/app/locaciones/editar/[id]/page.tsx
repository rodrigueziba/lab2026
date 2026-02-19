'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Swal from 'sweetalert2';
import { 
  MapPin, Image as ImageIcon, FileText, Save, Loader2, 
  ArrowLeft, Navigation, UploadCloud, Trash2, Edit, Plus, Camera 
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CATEGORIAS_TDF = {
  "Paisaje Natural": ["Montañas", "Bosques", "Costas", "Lagos y lagunas", "Glaciares", "Turberas"],
  "Urbano y Arquitectura": ["Calles céntricas", "Puerto", "Edificios gubernamentales", "Casas antiguas", "Fábricas"],
  "Cultura y Esparcimiento": ["Museos", "Centros culturales", "Teatros", "Bares y restaurantes", "Hoteles"],
  "Infraestructura y Transporte": ["Rutas y caminos", "Aeropuerto", "Puentes", "Muelles"],
  "Sitios Abandonados": ["Estancias", "Buques encallados", "Estructuras oxidadas"],
  "Deporte": ["Centros invernales", "Pistas de patinaje", "Canchas", "Senderos de trekking"]
};

export default function EditarLocacionPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locacionId, setLocacionId] = useState<string | null>(null);

  // Datos del formulario
  const [formData, setFormData] = useState({
    nombre: '', ciudad: 'Ushuaia', categoria: '', subcategoria: '',
    descripcion: '', direccion: '', accesibilidad: '',
    lat: '', lng: '', foto: '',
    galeria: [] as string[] // Aquí guardamos las URLs que YA existen en la BD
  });

  // Estados para archivos NUEVOS (que se subirán al guardar)
  const [newMainFile, setNewMainFile] = useState<File | null>(null);
  const [previewNewMain, setPreviewNewMain] = useState<string | null>(null);

  const [newGalleryFiles, setNewGalleryFiles] = useState<File[]>([]);
  const [previewNewGallery, setPreviewNewGallery] = useState<string[]>([]);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'; 

  // 1. Autenticación y Carga de Datos
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    if (!token || user?.role !== 'admin') {
        router.push('/locaciones');
        return;
    }

    params.then(unwrap => {
        setLocacionId(unwrap.id);
        fetch(`${apiUrl}/locacion/${unwrap.id}`)
            .then(res => res.json())
            .then(data => {
                setFormData({
                    nombre: data.nombre || '',
                    ciudad: data.ciudad || 'Ushuaia',
                    categoria: data.categoria || '',
                    subcategoria: data.subcategoria || '',
                    descripcion: data.descripcion || '',
                    direccion: data.direccion || '',
                    accesibilidad: data.accesibilidad || '',
                    lat: data.lat ? String(data.lat) : '',
                    lng: data.lng ? String(data.lng) : '',
                    foto: data.foto || '',
                    galeria: data.galeria || []
                });
                setLoading(false);
            })
            .catch(() => router.push('/locaciones'));
    });
  }, [params, router]);

  // --- HANDLERS ---
  const handleChange = (e: any) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // Cambiar Foto Principal
  const handleMainFileChange = (e: any) => {
    if (e.target.files?.[0]) {
      setNewMainFile(e.target.files[0]);
      setPreviewNewMain(URL.createObjectURL(e.target.files[0]));
    }
  };

  // Galería: Agregar Nuevas
  const handleNewGalleryFiles = (e: any) => {
    const files = Array.from(e.target.files as FileList);
    const total = formData.galeria.length + newGalleryFiles.length + files.length;
    
    if (total > 8) {
        return Swal.fire('Límite alcanzado', 'Máximo 8 fotos en total.', 'warning');
    }

    const newPreviews = files.map(f => URL.createObjectURL(f));
    setNewGalleryFiles([...newGalleryFiles, ...files]);
    setPreviewNewGallery([...previewNewGallery, ...newPreviews]);
  };

  // Galería: Borrar Existente (BD)
  const removeExistingImage = (idx: number) => {
    const updated = [...formData.galeria];
    updated.splice(idx, 1);
    setFormData({ ...formData, galeria: updated });
  };

  // Galería: Borrar Nueva (Local)
  const removeNewImage = (idx: number) => {
    const files = [...newGalleryFiles];
    const previews = [...previewNewGallery];
    files.splice(idx, 1);
    previews.splice(idx, 1);
    setNewGalleryFiles(files);
    setPreviewNewGallery(previews);
  };

  // Subir a Supabase
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
        setFormData(prev => ({ ...prev, lat: pos.coords.latitude.toString(), lng: pos.coords.longitude.toString() }));
        Swal.fire({ toast: true, icon: 'success', title: 'Ubicación actualizada', position: 'top-end', showConfirmButton: false, timer: 1000 });
      });
    } else {
        Swal.fire('Error', 'Geolocalización no soportada', 'error');
    }
  };

  // Submit Final
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!locacionId) return;
    setSaving(true);

    try {
        let finalFotoUrl = formData.foto;
        let finalGaleria = [...formData.galeria]; // Arrancamos con las que NO se borraron

        // 1. Subir nueva foto principal si existe
        if (newMainFile) {
            finalFotoUrl = await uploadToSupabase(newMainFile);
        }

        // 2. Subir nuevas fotos de galería
        if (newGalleryFiles.length > 0) {
            const uploadPromises = newGalleryFiles.map(f => uploadToSupabase(f));
            const newUrls = await Promise.all(uploadPromises);
            finalGaleria = [...finalGaleria, ...newUrls]; // Concatenamos
        }

        const payload = {
            ...formData,
            foto: finalFotoUrl,
            galeria: finalGaleria,
            lat: formData.lat ? parseFloat(formData.lat) : null,
            lng: formData.lng ? parseFloat(formData.lng) : null
        };

        const token = localStorage.getItem('token');
        const res = await fetch(`${apiUrl}/locacion/${locacionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            Swal.fire({
                title: '¡Guardado!',
                text: 'Locación actualizada correctamente.',
                icon: 'success',
                confirmButtonColor: '#ea580c'
            }).then(() => router.push(`/locaciones/${locacionId}`));
        } else {
            throw new Error("Error al guardar");
        }

    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'No se pudo guardar los cambios', 'error');
    } finally {
        setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><Loader2 className="animate-spin"/></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pt-28 pb-12 px-6 selection:bg-orange-500/30">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white flex items-center gap-2 mb-8 transition font-medium group">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform"/> Cancelar Edición
        </button>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 pb-6 border-b border-slate-800">
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/30 rotate-3">
                    <Edit size={28} className="text-white"/>
                </div>
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Editar Locación</h1>
                    <p className="text-slate-400 mt-1">Modificando: <span className="text-white font-bold">{formData.nombre}</span></p>
                </div>
            </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* COLUMNA IZQUIERDA: DATOS (2/3) - Lógica Flex para estiramiento simétrico */}
            <div className="lg:col-span-2 flex flex-col gap-6 animate-in slide-in-from-left duration-500">
                
                {/* TARJETA 1: DATOS GENERALES (Flexible) */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-colors flex-1 flex flex-col">
                    <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                        <FileText size={120}/>
                    </div>
                    
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span> Información General
                    </h3>
                    
                    <div className="space-y-6 relative z-10 flex-1 flex flex-col">
                        <div className="shrink-0">
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Nombre *</label>
                            <input required name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Nombre"
                                className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl focus:border-blue-500 outline-none transition text-white placeholder:text-slate-600"/>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 shrink-0">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Ciudad</label>
                                <div className="relative">
                                    <select name="ciudad" value={formData.ciudad} onChange={handleChange}
                                        className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl focus:border-blue-500 outline-none transition text-slate-300 appearance-none cursor-pointer">
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
                                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Dirección</label>
                                <input name="direccion" value={formData.direccion} onChange={handleChange} placeholder="Dirección"
                                    className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl focus:border-blue-500 outline-none transition text-white placeholder:text-slate-600"/>
                            </div>
                        </div>

                        {/* TEXTAREA FLEXIBLE (Ocupa todo el alto) */}
                        <div className="flex-1 flex flex-col">
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Descripción *</label>
                            <textarea required name="descripcion" value={formData.descripcion} onChange={handleChange} rows={5}
                                className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl focus:border-blue-500 outline-none transition text-white resize-none placeholder:text-slate-600 leading-relaxed flex-1 h-full min-h-[150px]"/>
                        </div>
                    </div>
                </div>

                {/* TARJETA 2: GEOLOCALIZACIÓN (Fija) */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl shrink-0">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span> Geolocalización
                        </h3>
                        <button type="button" onClick={handleGetLocation} 
                            className="text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white px-4 py-2 rounded-lg transition font-bold flex items-center gap-2 border border-blue-500/20">
                            <MapPin size={14}/> Actualizar
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2">Latitud</label>
                            <input name="lat" value={formData.lat} onChange={handleChange} placeholder="Lat"
                                className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl focus:border-blue-500 outline-none font-mono text-sm text-blue-300 placeholder:text-slate-600"/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2">Longitud</label>
                            <input name="lng" value={formData.lng} onChange={handleChange} placeholder="Lng"
                                className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl focus:border-blue-500 outline-none font-mono text-sm text-blue-300 placeholder:text-slate-600"/>
                        </div>
                    </div>
                </div>

            </div>

            {/* COLUMNA DERECHA: MULTIMEDIA (1/3) */}
            <div className="space-y-8 animate-in slide-in-from-right duration-500 delay-100 h-full">
                
                {/* TARJETA 3: FOTO PRINCIPAL */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <ImageIcon size={16}/> Foto de Portada
                    </h3>
                    <div className="relative aspect-video w-full rounded-2xl bg-slate-950 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center overflow-hidden group hover:border-blue-500/50 hover:bg-slate-900 transition-all cursor-pointer">
                        {previewNewMain ? (
                            <img src={previewNewMain} className="w-full h-full object-cover"/>
                        ) : (formData.foto ? (
                            <>
                                <img src={formData.foto} className="w-full h-full object-cover"/>
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-xs font-bold text-white flex items-center gap-2"><Camera size={16}/> Cambiar</span>
                                </div>
                            </>
                        ) : (
                            <div className="text-center p-4">
                                <UploadCloud size={32} className="mx-auto text-slate-500 mb-2 group-hover:text-blue-500 group-hover:scale-110 transition-all"/>
                                <p className="text-xs text-slate-500 font-medium">Subir portada</p>
                            </div>
                        ))}
                        <input type="file" accept="image/*" onChange={handleMainFileChange} className="absolute inset-0 opacity-0 cursor-pointer"/>
                    </div>
                </div>

                {/* TARJETA 4: GALERÍA */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                    <div className="flex justify-between items-end mb-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <ImageIcon size={16}/> Galería
                        </h3>
                        <span className="text-[10px] text-slate-500">{formData.galeria.length + newGalleryFiles.length}/8</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                        {/* Existentes (BD) */}
                        {formData.galeria.map((src, idx) => (
                            <div key={`old-${idx}`} className="relative aspect-square rounded-xl overflow-hidden group border border-slate-700">
                                <img src={src} className="w-full h-full object-cover"/>
                                <button type="button" onClick={() => removeExistingImage(idx)} 
                                    className="absolute inset-0 bg-red-500/80 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                        ))}
                        
                        {/* Nuevas (Local) */}
                        {previewNewGallery.map((src, idx) => (
                            <div key={`new-${idx}`} className="relative aspect-square rounded-xl overflow-hidden group border border-blue-500/50">
                                <img src={src} className="w-full h-full object-cover opacity-80"/>
                                <button type="button" onClick={() => removeNewImage(idx)} 
                                    className="absolute inset-0 bg-red-500/80 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                                    <Trash2 size={16}/>
                                </button>
                                <span className="absolute bottom-1 left-1 bg-blue-600 text-[9px] px-1.5 rounded text-white font-bold">NUEVA</span>
                            </div>
                        ))}

                        {/* Botón Agregar */}
                        {(formData.galeria.length + newGalleryFiles.length) < 8 && (
                            <div className="relative aspect-square rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center hover:border-blue-500/50 hover:bg-slate-950 transition cursor-pointer group">
                                <Plus size={20} className="text-slate-600 group-hover:text-blue-500 transition-colors"/>
                                <input type="file" multiple accept="image/*" onChange={handleNewGalleryFiles} className="absolute inset-0 opacity-0 cursor-pointer"/>
                            </div>
                        )}
                    </div>
                </div>

                {/* TARJETA 5: CLASIFICACIÓN */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Clasificación</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Categoría</label>
                            <div className="relative">
                                <select required name="categoria" value={formData.categoria} onChange={handleChange}
                                    className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none transition text-white text-sm appearance-none cursor-pointer">
                                    <option value="">Seleccionar...</option>
                                    {Object.keys(CATEGORIAS_TDF).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs">▼</div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Subcategoría</label>
                            <div className="relative">
                                <select name="subcategoria" value={formData.subcategoria} onChange={handleChange}
                                    className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none transition text-white text-sm appearance-none cursor-pointer disabled:opacity-50"
                                    disabled={!formData.categoria}>
                                    <option value="">Seleccionar...</option>
                                    {formData.categoria && (CATEGORIAS_TDF as any)[formData.categoria]?.map((sub: string) => (
                                        <option key={sub} value={sub}>{sub}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs">▼</div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Accesibilidad</label>
                            <div className="relative">
                                <select name="accesibilidad" value={formData.accesibilidad} onChange={handleChange}
                                    className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none transition text-white text-sm appearance-none cursor-pointer">
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
                    disabled={saving}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-black py-4 rounded-xl shadow-lg shadow-blue-900/30 transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                >
                    {saving ? <Loader2 className="animate-spin"/> : <Save size={20}/>}
                    {saving ? 'Guardando...' : 'GUARDAR CAMBIOS'}
                </button>

            </div>

        </form>
      </div>
    </div>
  );
}