'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { 
  Save, Trash2, Link as LinkIcon, Calendar, DollarSign, 
  GraduationCap, Film, Briefcase, X, Image as ImageIcon, Loader2, MapPin, ArrowLeft 
} from 'lucide-react';
import Link from 'next/link';

// Inicializar Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function EditarProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    tipo: 'Cortometraje',
    ciudad: 'Ushuaia',
    fechaInicio: '',
    fechaFin: '',
    esEstudiante: false,
    esRemunerado: false,
    foto: '', // Poster principal
  });

  const [referencias, setReferencias] = useState(['']);
  const [puestos, setPuestos] = useState([{ id: null, nombre: '', descripcion: '' }]);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  
  // Imágenes
  const [archivo, setArchivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // 1. CARGAR DATOS DEL PROYECTO
  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      if (!token) return router.push('/login');

      try {
        const res = await fetch(`${apiUrl}/proyecto/${id}`);
        if (!res.ok) throw new Error("Error al cargar proyecto");
        
        const data = await res.json();
        
        // Rellenar formulario
        setFormData({
          titulo: data.titulo,
          descripcion: data.descripcion,
          tipo: data.tipo,
          ciudad: data.ciudad || 'Ushuaia',
          fechaInicio: data.fechaInicio ? data.fechaInicio.split('T')[0] : '',
          fechaFin: data.fechaFin ? data.fechaFin.split('T')[0] : '',
          esEstudiante: data.esEstudiante,
          esRemunerado: data.esRemunerado,
          foto: data.foto || ''
        });

        // Rellenar listas
        if (data.referencias && data.referencias.length > 0) setReferencias(data.referencias);
        if (data.puestos && data.puestos.length > 0) setPuestos(data.puestos);
        if (data.foto) setPreview(data.foto);

        setLoading(false);
      } catch (err) {
        console.error(err);
        alert("No se pudo cargar el proyecto.");
        router.push('/mis-proyectos');
      }
    };
    fetchData();
  }, [id, router]);

  // --- HANDLERS ---
  const handleChange = (e: any) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleImageChange = (e: any) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setArchivo(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleArrayChange = (setter: any, list: any[], index: number, field: string | null, value: string) => {
    const newList = [...list];
    if (field) newList[index] = { ...newList[index], [field]: value };
    else newList[index] = value;
    setter(newList);
  };

  const addItem = (setter: any, list: any[], item: any) => setter([...list, item]);
  
  const removeItem = (setter: any, list: any[], index: number) => {
    // Nota: Si el puesto tiene ID, habría que marcarlo para borrar en backend, 
    // pero por simplicidad en este MVP solo lo quitamos de la lista visual.
    setter(list.filter((_, i) => i !== index));
  };

  // --- SUBMIT (UPDATE) ---
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      
      // 1. Subir Imagen Nueva si existe
      let fotoUrl = formData.foto;
      if (archivo) {
        const fileExt = archivo.name.split('.').pop();
        const fileName = `poster-${Date.now()}.${fileExt}`;
        const { error } = await supabase.storage.from('proyectos').upload(fileName, archivo);
        if (!error) {
          const { data } = supabase.storage.from('proyectos').getPublicUrl(fileName);
          fotoUrl = data.publicUrl;
        }
      }

      // 2. Payload
      const payload = {
        ...formData,
        foto: fotoUrl,
        referencias: referencias.filter(r => r.trim() !== ''),
        // Nota: La actualización de puestos anidados compleja se omite en este MVP simple,
        // Enviamos los datos básicos. Para puestos, lo ideal es una gestión separada o un backend avanzado.
        fechaInicio: formData.fechaInicio ? new Date(formData.fechaInicio).toISOString() : null,
        fechaFin: formData.fechaFin ? new Date(formData.fechaFin).toISOString() : null,
      };

      // 3. Request PATCH
      const res = await fetch(`${apiUrl}/proyecto/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('¡Proyecto actualizado! 🎬');
        router.push('/mis-proyectos');
      } else {
        const error = await res.json();
        alert(`Error: ${error.message}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-orange-500"/></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans flex justify-center pt-28">
      <div className="max-w-5xl w-full">
        
        <Link href="/mis-proyectos" className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition">
          <ArrowLeft size={16}/> Volver
        </Link>

        <h1 className="text-4xl font-black mb-8 flex items-center gap-3 tracking-tighter">
          <Film className="text-blue-500" size={40} />
          Editar Proyecto
        </h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* 1. INFORMACIÓN PRINCIPAL */}
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl">
            <h2 className="text-xs font-bold uppercase text-slate-500 mb-8 border-b border-slate-800 pb-2">Información General</h2>
            
            {/* FOTO POSTER */}
            <div className="mb-8 flex gap-6 items-start">
               <div className="w-32 h-48 bg-slate-950 border border-slate-800 rounded-lg overflow-hidden shrink-0">
                  {preview ? <img src={preview} className="w-full h-full object-cover"/> : <div className="flex h-full items-center justify-center text-xs text-slate-600">Sin Foto</div>}
               </div>
               <div>
                 <label className="block text-xs font-bold text-slate-400 mb-2">PORTADA / POSTER</label>
                 <input type="file" accept="image/*" onChange={handleImageChange} className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:bg-slate-800 file:text-white cursor-pointer"/>
                 <p className="text-xs text-slate-600 mt-2">Recomendado: Formato Vertical (2:3)</p>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              <div className="md:col-span-2 group">
                <label className="block text-xs font-bold text-slate-400 mb-2">TÍTULO</label>
                <input name="titulo" value={formData.titulo} required className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-lg px-4 py-4 text-lg font-medium outline-none focus:border-blue-500" onChange={handleChange} />
              </div>

              <div className="group">
                <label className="block text-xs font-bold text-slate-400 mb-2">CIUDAD</label>
                <select name="ciudad" value={formData.ciudad} className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-lg px-4 py-4 text-lg outline-none focus:border-blue-500" onChange={handleChange}>
                  <option value="Ushuaia">Ushuaia</option>
                  <option value="Río Grande">Río Grande</option>
                  <option value="Tolhuin">Tolhuin</option>
                </select>
              </div>
            </div>

            <div className="mb-8 group">
              <label className="block text-xs font-bold text-slate-400 mb-2">SINOPSIS</label>
              <textarea name="descripcion" value={formData.descripcion} required rows={5} className="w-full bg-slate-950 border-l-4 border-slate-800 rounded-r-lg p-6 text-base text-slate-300 outline-none focus:border-blue-500 resize-none" onChange={handleChange} />
            </div>
            
            {/* Fechas y Tipo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               <div className="group">
                 <label className="block text-xs font-bold text-slate-400 mb-2">TIPO</label>
                 <select name="tipo" value={formData.tipo} className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-lg px-4 py-4 text-lg outline-none focus:border-blue-500" onChange={handleChange}>
                    <option>Cortometraje</option>
                    <option>Largometraje</option>
                    <option>Documental</option>
                    <option>Videoclip</option>
                 </select>
               </div>
               <div className="group">
                 <label className="block text-xs font-bold text-slate-400 mb-2">INICIO RODAJE</label>
                 <input type="date" name="fechaInicio" value={formData.fechaInicio} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 outline-none focus:border-blue-500 text-slate-300" onChange={handleChange} />
               </div>
               <div className="group">
                 <label className="block text-xs font-bold text-slate-400 mb-2">FIN RODAJE</label>
                 <input type="date" name="fechaFin" value={formData.fechaFin} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 outline-none focus:border-blue-500 text-slate-300" onChange={handleChange} />
               </div>
            </div>
          </div>

          {/* BOTÓN FINAL */}
          <div className="flex justify-end pt-4 pb-12">
            <button 
              type="submit" 
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-500 text-white font-black py-4 px-12 rounded-full shadow-lg transform hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center gap-3 text-lg"
            >
              {saving ? <Loader2 className="animate-spin" /> : <Save size={24} />}
              {saving ? 'Guardando...' : 'GUARDAR CAMBIOS'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}