'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { 
  Plus, Trash2, Link as LinkIcon, Calendar, DollarSign, 
  GraduationCap, Film, Briefcase, X, Image as ImageIcon, Loader2, MapPin, ArrowLeft 
} from 'lucide-react';

// Inicializar Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
export default function CrearProyectoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    tipo: 'Cortometraje',
    ciudad: 'Ushuaia', // <--- NUEVO CAMPO POR DEFECTO
    fechaInicio: '',
    fechaFin: '',
    esEstudiante: false,
    esRemunerado: false,
  });

  // Estados Dinámicos
  const [referencias, setReferencias] = useState(['']);
  const [puestos, setPuestos] = useState([{ nombre: '', descripcion: '' }]);
  
  // Estado para Imágenes (Moodboard)
  const [imagenes, setImagenes] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  // Fecha mínima: hoy (solo fechas a futuro)
  const todayStr = () => new Date().toISOString().split('T')[0];

  // --- HANDLERS ---
  const handleChange = (e: any) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    const next = { ...formData, [e.target.name]: value };
    // Si se cambia fecha inicio y queda después de fecha fin, ajustar fecha fin
    if (e.target.name === 'fechaInicio' && next.fechaFin && next.fechaInicio > next.fechaFin) next.fechaFin = next.fechaInicio;
    setFormData(next);
  };

  // Manejo de Imágenes
  const handleImageChange = (e: any) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      setImagenes([...imagenes, ...files]);
      
      // Crear URLs para previsualización
      const newPreviews = files.map(file => URL.createObjectURL(file));
      setPreviews([...previews, ...newPreviews]);
    }
  };

  const removeImage = (index: number) => {
    const newImages = imagenes.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    setImagenes(newImages);
    setPreviews(newPreviews);
  };

  // Manejo de Arrays (Links y Puestos)
  const handleArrayChange = (setter: any, list: any[], index: number, field: string | null, value: string) => {
    const newList = [...list];
    if (field) newList[index] = { ...newList[index], [field]: value }; // Para objetos (Puestos)
    else newList[index] = value; // Para strings (Links)
    setter(newList);
  };

  const addItem = (setter: any, list: any[], item: any) => setter([...list, item]);
  const removeItem = (setter: any, list: any[], index: number) => setter(list.filter((_, i) => i !== index));

  // --- SUBMIT ---
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const today = todayStr();
    if (formData.fechaInicio && formData.fechaInicio < today) {
      alert('La fecha de inicio de rodaje debe ser hoy o una fecha futura.');
      return;
    }
    if (formData.fechaFin && formData.fechaFin < today) {
      alert('La fecha de fin de rodaje debe ser hoy o una fecha futura.');
      return;
    }
    if (formData.fechaInicio && formData.fechaFin && formData.fechaInicio > formData.fechaFin) {
      alert('La fecha de inicio debe ser anterior o igual a la fecha de fin.');
      return;
    }
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) return router.push('/login');

      // 1. Subir Imágenes a Supabase (si hay)
      const galeriaUrls: string[] = [];
      for (const file of imagenes) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
        const { error } = await supabase.storage.from('proyectos').upload(fileName, file);
        
        if (!error) {
          const { data } = supabase.storage.from('proyectos').getPublicUrl(fileName);
          galeriaUrls.push(data.publicUrl);
        }
      }

      // 2. Preparar Payload (la primera imagen de la galería se usa como foto/portada)
      const payload = {
        ...formData,
        referencias: referencias.filter(r => r.trim() !== ''),
        puestos: puestos.filter(p => p.nombre.trim() !== ''),
        galeria: galeriaUrls,
        foto: galeriaUrls[0] ?? undefined,
        fechaInicio: formData.fechaInicio ? new Date(formData.fechaInicio).toISOString() : null,
        fechaFin: formData.fechaFin ? new Date(formData.fechaFin).toISOString() : null,
      };

      // 3. Enviar al Backend
      const res = await fetch(`${apiUrl}/proyecto`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('¡Proyecto publicado! 🎬');
        router.push('/mis-proyectos');
      } else {
        const error = await res.json();
        alert(`Error: ${error.message}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white pt-28 pb-12 px-6 font-sans flex justify-center">
      
      {/* Estilos para forzar el calendario oscuro */}
      <style jsx global>{`
        ::-webkit-calendar-picker-indicator {
            filter: invert(1);
            opacity: 0.5;
            cursor: pointer;
        }
      `}</style>

      <div className="max-w-5xl w-full bg-slate-900 p-8 md:p-12 rounded-3xl border border-slate-800 shadow-2xl">
        
        <button type="button" onClick={() => router.back()} className="text-slate-500 hover:text-white flex items-center gap-2 mb-8 transition text-sm font-bold uppercase tracking-wider">
          <ArrowLeft size={16}/> Cancelar y Volver
        </button>

        <div className="text-center mb-10 border-b border-slate-800/50 pb-8">
          <h1 className="text-4xl md:text-5xl font-black mb-3 tracking-tighter">
            Nuevo <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">Proyecto</span>
          </h1>
          <p className="text-slate-400 text-lg font-light">
            Publicá tu producción en la Cartelera TDF.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* 1. INFORMACIÓN PRINCIPAL */}
          <div>
            <h2 className="text-xs font-bold uppercase text-slate-500 mb-8 tracking-widest border-b border-slate-800 pb-2">
              Información General
            </h2>
            
            {/* TÍTULO Y CIUDAD */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              <div className="md:col-span-2 group">
                <label className="block text-xs font-bold text-slate-400 mb-2 group-focus-within:text-orange-500 transition-colors">
                  TÍTULO DEL PROYECTO
                </label>
                <input 
                  name="titulo" required 
                  placeholder="Ej: El Silencio de la Nieve"
                  className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-lg px-4 py-4 text-lg font-medium outline-none focus:border-orange-500 focus:bg-slate-950/50 transition-all placeholder:text-slate-700"
                  onChange={handleChange}
                />
              </div>

              {/* SELECTOR CIUDAD */}
              <div className="group">
                <label className="block text-xs font-bold text-slate-400 mb-2 group-focus-within:text-orange-500 transition-colors flex items-center gap-1">
                  <MapPin size={12}/> UBICACIÓN PRINCIPAL
                </label>
                <div className="relative">
                  <select 
                    name="ciudad" 
                    className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-lg px-4 py-4 text-lg outline-none focus:border-orange-500 appearance-none cursor-pointer text-slate-300"
                    onChange={handleChange}
                    value={formData.ciudad}
                  >
                    <option value="Ushuaia">Ushuaia</option>
                    <option value="Río Grande">Río Grande</option>
                    <option value="Tolhuin">Tolhuin</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    ▼
                  </div>
                </div>
              </div>
            </div>

            {/* TIPO Y FECHAS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
               <div className="group">
                <label className="block text-xs font-bold text-slate-400 mb-2 group-focus-within:text-orange-500 transition-colors">
                  TIPO DE PRODUCCIÓN
                </label>
                <div className="relative">
                  <select 
                    name="tipo" 
                    className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-lg px-4 py-4 text-lg outline-none focus:border-orange-500 appearance-none cursor-pointer"
                    onChange={handleChange}
                  >
                    <option>Cortometraje</option>
                    <option>Largometraje</option>
                    <option>Documental</option>
                    <option>Videoclip</option>
                    <option>Publicidad</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                </div>
              </div>

              <div className="group">
                <label className="block text-xs font-bold text-slate-400 mb-2 flex items-center gap-2 group-focus-within:text-blue-400">
                  <Calendar size={14}/> INICIO DE RODAJE
                </label>
                <input 
                  type="date" name="fechaInicio" 
                  min={todayStr()}
                  value={formData.fechaInicio}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 outline-none focus:border-blue-500 text-slate-300 transition-all"
                  onChange={handleChange} 
                />
              </div>
              <div className="group">
                <label className="block text-xs font-bold text-slate-400 mb-2 flex items-center gap-2 group-focus-within:text-blue-400">
                  <Calendar size={14}/> FIN DE RODAJE
                </label>
                <input 
                  type="date" name="fechaFin" 
                  min={formData.fechaInicio || todayStr()}
                  value={formData.fechaFin}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 outline-none focus:border-blue-500 text-slate-300 transition-all"
                  onChange={handleChange} 
                />
              </div>
            </div>

            {/* Sinopsis Full Width */}
            <div className="mb-8 group">
              <label className="block text-xs font-bold text-slate-400 mb-2 group-focus-within:text-orange-500 transition-colors">
                SINOPSIS / LOGLINE
              </label>
              <textarea 
                name="descripcion" required rows={5}
                placeholder="Escribe aquí la historia..."
                className="w-full bg-slate-950 border-l-4 border-slate-800 rounded-r-lg p-6 text-base text-slate-300 outline-none focus:border-orange-500 transition-all resize-none placeholder:text-slate-700 leading-relaxed"
                onChange={handleChange}
              />
            </div>
          </div>

          {/* 2. CARACTERÍSTICAS (Cards Selección) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <label className={`relative p-6 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-5 group hover:shadow-xl ${formData.esEstudiante ? 'bg-blue-950/30 border-blue-500 shadow-blue-900/20' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}>
              <div className={`p-4 rounded-xl transition-colors ${formData.esEstudiante ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500 group-hover:text-slate-300'}`}>
                <GraduationCap size={28} />
              </div>
              <div>
                <h3 className={`font-bold text-lg ${formData.esEstudiante ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>Proyecto Estudiantil</h3>
                <p className="text-xs text-slate-500">Práctica académica o tesis.</p>
              </div>
              <input type="checkbox" name="esEstudiante" className="absolute opacity-0 w-full h-full cursor-pointer" onChange={handleChange} />
              <div className={`absolute top-6 right-6 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${formData.esEstudiante ? 'border-blue-500 bg-blue-500' : 'border-slate-700'}`}>
                {formData.esEstudiante && <div className="w-2 h-2 bg-white rounded-full"></div>}
              </div>
            </label>

            <label className={`relative p-6 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-5 group hover:shadow-xl ${formData.esRemunerado ? 'bg-emerald-950/30 border-emerald-500 shadow-emerald-900/20' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}>
              <div className={`p-4 rounded-xl transition-colors ${formData.esRemunerado ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500 group-hover:text-slate-300'}`}>
                <DollarSign size={28} />
              </div>
              <div>
                <h3 className={`font-bold text-lg ${formData.esRemunerado ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>Proyecto Remunerado</h3>
                <p className="text-xs text-slate-500">Roles con compensación económica.</p>
              </div>
              <input type="checkbox" name="esRemunerado" className="absolute opacity-0 w-full h-full cursor-pointer" onChange={handleChange} />
              <div className={`absolute top-6 right-6 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${formData.esRemunerado ? 'border-emerald-500 bg-emerald-500' : 'border-slate-700'}`}>
                {formData.esRemunerado && <div className="w-2 h-2 bg-white rounded-full"></div>}
              </div>
            </label>
          </div>

          {/* 3. REFERENCIAS VISUALES (Moodboard + Links) */}
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800">
            <h2 className="text-xs font-bold uppercase text-slate-500 mb-6 tracking-widest border-b border-slate-800 pb-2">
              Referencias Visuales
            </h2>

            {/* A. Galería de Imágenes (Carrete) */}
            <div className="mb-8">
              <label className="block text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                <ImageIcon size={18} className="text-purple-500" /> Moodboard (Imágenes)
              </label>
              
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {/* Botón Subir */}
                <label className="w-32 h-32 shrink-0 rounded-xl border-2 border-dashed border-slate-700 hover:border-purple-500 hover:bg-purple-500/10 cursor-pointer flex flex-col items-center justify-center transition-all group">
                   <div className="bg-slate-800 p-2 rounded-full mb-2 group-hover:bg-purple-600 transition-colors">
                     <Plus size={20} className="text-slate-400 group-hover:text-white" />
                   </div>
                   <span className="text-xs font-bold text-slate-500 group-hover:text-purple-400">Subir Fotos</span>
                   <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>

                {/* Previews */}
                {previews.map((src, idx) => (
                  <div key={idx} className="w-32 h-32 shrink-0 rounded-xl overflow-hidden relative group border border-slate-700">
                    <img src={src} className="w-full h-full object-cover" alt="Preview" />
                    <button 
                      type="button" 
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* B. Links */}
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                <LinkIcon size={18} className="text-blue-500" /> Links de Referencia
              </label>
              <div className="space-y-3">
                {referencias.map((ref, index) => (
                  <div key={index} className="flex gap-3">
                    <input 
                      placeholder="https://youtube.com/..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 outline-none focus:border-blue-500 text-sm transition-all"
                      value={ref}
                      onChange={(e) => handleArrayChange(setReferencias, referencias, index, null, e.target.value)}
                    />
                    {referencias.length > 1 && (
                      <button type="button" onClick={() => removeItem(setReferencias, referencias, index)} className="text-slate-600 hover:text-red-500 px-2 transition">
                        <Trash2 size={18}/>
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addItem(setReferencias, referencias, '')} className="text-xs font-bold text-blue-500 hover:text-white mt-2 flex items-center gap-1 transition">
                  <Plus size={14}/> Agregar otro Link
                </button>
              </div>
            </div>
          </div>

          {/* 4. VACANTES (PUESTOS) */}
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 relative overflow-hidden">
             {/* Decoración de fondo */}
             <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-orange-600/10 to-transparent rounded-bl-full pointer-events-none"></div>

            <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-2 relative z-10">
              <h2 className="text-xs font-bold uppercase text-slate-500 tracking-widest">
                Vacantes del Equipo
              </h2>
              <button 
                type="button" 
                onClick={() => addItem(setPuestos, puestos, { nombre: '', descripcion: '' })} 
                className="text-xs font-bold bg-slate-800 hover:bg-orange-600 text-slate-300 hover:text-white px-4 py-2 rounded-full flex items-center gap-2 transition-all"
              >
                <Plus size={14} /> Agregar Puesto
              </button>
            </div>

            <div className="space-y-4 relative z-10">
              {puestos.map((puesto, index) => (
                <div key={index} className="flex gap-4 items-start bg-slate-950 p-4 rounded-xl border border-slate-800 hover:border-orange-500/30 transition-all group shadow-sm">
                  <div className="pt-3">
                     <Briefcase size={20} className="text-slate-600 group-hover:text-orange-500 transition-colors" />
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase mb-1 block">Rol</label>
                        <input 
                          placeholder="Ej: Sonidista"
                          className="w-full bg-transparent border-b border-slate-800 focus:border-orange-500 outline-none pb-2 text-white font-medium placeholder:text-slate-700 transition-colors"
                          value={puesto.nombre}
                          onChange={(e) => handleArrayChange(setPuestos, puestos, index, 'nombre', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase mb-1 block">Requisitos</label>
                        <input 
                          placeholder="Ej: Equipo propio..."
                          className="w-full bg-transparent border-b border-slate-800 focus:border-orange-500 outline-none pb-2 text-slate-400 text-sm placeholder:text-slate-700 transition-colors"
                          value={puesto.descripcion}
                          onChange={(e) => handleArrayChange(setPuestos, puestos, index, 'descripcion', e.target.value)}
                        />
                    </div>
                  </div>
                  {puestos.length > 1 && (
                    <button type="button" onClick={() => removeItem(setPuestos, puestos, index)} className="text-slate-700 hover:text-red-500 p-2 transition opacity-50 group-hover:opacity-100">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* BOTÓN FINAL */}
          <div className="flex justify-end pt-8 pb-12">
            <button 
              type="submit" 
              disabled={loading}
              className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-black py-5 px-16 rounded-full shadow-[0_10px_30px_rgba(234,88,12,0.3)] transform hover:-translate-y-1 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 text-lg"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Film size={24} />}
              {loading ? 'Publicando...' : 'PUBLICAR CASTING'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}