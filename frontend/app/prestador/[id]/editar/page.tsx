'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import DepthAwareImage from '@/components/DepthAwareImage';

// Inicializamos Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const RUBROS = [
  "Dirección", "Producción", "Guion", "Fotografía / Cámara", 
  "Sonido", "Arte / Escenografía", "Vestuario / Maquillaje", 
  "Montaje / Postproducción", "Música", "Actuación / Casting",
  "Alquiler de Equipos", "Catering", "Transporte / Logística", "Legales / Gestoría"
];

export default function EditarPrestadorPage() {
  const router = useRouter();
  const { id } = useParams(); // ID del perfil a editar
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    nombre: '',
    tipoPerfil: '',
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
    fotoProfundidad: '',
    colorTema: '#ea580c',
    videoReel: '',
  });

  const [nuevoArchivo, setNuevoArchivo] = useState<File | null>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');

    if (id) {
      fetch(`${apiUrl}/prestador/${id}`)
        .then(res => res.json())
        .then(data => {
          setFormData({
            nombre: data.nombre || '',
            tipoPerfil: data.tipoPerfil || 'Profesional',
            rubro: data.rubro || '',
            descripcion: data.descripcion || '',
            email: data.email || '',
            telefono: data.telefono || '',
            web: data.web || '',
            instagram: data.instagram || '',
            facebook: data.facebook || '',
            twitter: data.twitter || '',
            linkedin: data.linkedin || '',
            tiktok: data.tiktok || '',
            foto: data.foto || '',
            fotoProfundidad: data.fotoProfundidad || '',
            colorTema: data.colorTema || '#ea580c',
            videoReel: data.videoReel || ''
          });
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          alert("Error cargando el perfil");
          router.push('/mis-perfiles');
        });
    }
  }, [id, router]);

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const uploadImage = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-edit-perfil.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('profesionales')
        .upload(fileName, file);

      if (error) throw error;
      const { data } = supabase.storage.from('profesionales').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setSaving(true);

    let fotoFinal = formData.foto;
    let fotoProfundidad: string | undefined = formData.fotoProfundidad || undefined;
    if (nuevoArchivo) {
      const urlNueva = await uploadImage(nuevoArchivo);
      if (urlNueva) fotoFinal = urlNueva;
      try {
        const objectUrl = URL.createObjectURL(nuevoArchivo);
        const { generateDepthMap, dataURLtoFile } = await import('@/lib/depthAI');
        const depthBase64 = await generateDepthMap(objectUrl);
        URL.revokeObjectURL(objectUrl);
        const depthFile = dataURLtoFile(depthBase64, `depth_${nuevoArchivo.name}`);
        const dUrl = await uploadImage(depthFile);
        if (dUrl) fotoProfundidad = dUrl;
      } catch (_) {}
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/prestador/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ ...formData, foto: fotoFinal, fotoProfundidad })
      });

      if (res.ok) {
        alert('¡Perfil actualizado correctamente! ✅');
        router.push('/mis-perfiles'); // Volvemos al panel
      } else {
        alert("Error al actualizar. Verifica tu sesión.");
      }
    } catch (error) {
      console.error(error);
      alert("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 text-white p-10 text-center">Cargando datos...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 font-sans flex justify-center">
      <div className="max-w-3xl w-full">
        
        <h1 className="text-3xl font-bold mb-8 text-orange-500">Editar Perfil</h1>

        <form onSubmit={handleSubmit} className="space-y-6 bg-slate-900 p-8 rounded-xl border border-slate-800">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Nombre Público</label>
              <input name="nombre" type="text" value={formData.nombre} required 
                className="w-full bg-slate-950 border border-slate-700 rounded p-3 focus:border-orange-500 outline-none"
                onChange={handleChange} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Tipo de Perfil</label>
              <select name="tipoPerfil" value={formData.tipoPerfil}
                className="w-full bg-slate-950 border border-slate-700 rounded p-3 focus:border-orange-500 outline-none"
                onChange={handleChange}>
                <option value="Profesional">Profesional Independiente</option>
                <option value="Productora">Productora Audiovisual</option>
                <option value="Empresa">Empresa de Servicios</option>
                <option value="Estudiante">Estudiante</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Rubro</label>
            <select name="rubro" value={formData.rubro} required
              className="w-full bg-slate-950 border border-slate-700 rounded p-3 focus:border-orange-500 outline-none"
              onChange={handleChange}>
              {RUBROS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Biografía / Servicios</label>
            <textarea name="descripcion" value={formData.descripcion} required rows={4}
              className="w-full bg-slate-950 border border-slate-700 rounded p-3 focus:border-orange-500 outline-none"
              onChange={handleChange}></textarea>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Email</label>
              <input name="email" type="email" value={formData.email} required 
                className="w-full bg-slate-950 border border-slate-700 rounded p-3 focus:border-orange-500 outline-none"
                onChange={handleChange} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Teléfono</label>
              <input name="telefono" type="text" value={formData.telefono} 
                className="w-full bg-slate-950 border border-slate-700 rounded p-3 focus:border-orange-500 outline-none"
                onChange={handleChange} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Web</label>
              <input name="web" type="text" value={formData.web} 
                className="w-full bg-slate-950 border border-slate-700 rounded p-3 focus:border-orange-500 outline-none"
                onChange={handleChange} />
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-xs font-bold uppercase text-slate-500 mb-3">Redes sociales (URL o @usuario)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <input name="instagram" type="text" value={formData.instagram} placeholder="Instagram" onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded p-3 focus:border-pink-500 outline-none placeholder:text-slate-600" />
              <input name="facebook" type="text" value={formData.facebook} placeholder="Facebook" onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded p-3 focus:border-blue-500 outline-none placeholder:text-slate-600" />
              <input name="twitter" type="text" value={formData.twitter} placeholder="X / Twitter" onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded p-3 focus:border-sky-400 outline-none placeholder:text-slate-600" />
              <input name="linkedin" type="text" value={formData.linkedin} placeholder="LinkedIn" onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded p-3 focus:border-blue-600 outline-none placeholder:text-slate-600" />
              <input name="tiktok" type="text" value={formData.tiktok} placeholder="TikTok" onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded p-3 focus:border-slate-300 outline-none placeholder:text-slate-600" />
            </div>
          </div>

          {/* --- PERSONALIZACIÓN --- */}
          <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              🎨 Personalización del Perfil
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Color Picker */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Color de tu Marca</label>
                <div className="flex gap-4 items-center bg-slate-900 p-2 rounded border border-slate-700">
                  <input 
                    type="color" 
                    name="colorTema"
                    value={formData.colorTema}
                    onChange={handleChange}
                    className="w-10 h-10 rounded cursor-pointer border-none bg-transparent p-0"
                  />
                  <div className="text-xs">
                    <span className="block text-white font-bold">Selecciona un color</span>
                    <span className="text-slate-500">{formData.colorTema}</span>
                  </div>
                </div>
              </div>

              {/* Video Reel */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Video Reel (YouTube/Vimeo)</label>
                <input 
                  name="videoReel" 
                  type="text" 
                  value={formData.videoReel}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-slate-900 border border-slate-700 rounded p-3 focus:border-orange-500 outline-none text-sm"
                  onChange={handleChange} 
                />
                <p className="text-[10px] text-slate-500 mt-2">
                  ℹ️ Este video se reproducirá de fondo en tu perfil público.
                </p>
              </div>
            </div>
          </div>

          {/* FOTO ACTUAL + SUBIDA */}
          <div className="bg-slate-950 p-6 rounded border border-slate-800">
            <label className="block text-xs font-bold uppercase text-slate-500 mb-4">Foto de Perfil</label>
            
            <div className="flex items-center gap-6 mb-4">
               {formData.foto && (
                 <div className="w-20 h-20 relative rounded-full overflow-hidden border-2 border-slate-700">
                    <DepthAwareImage imageUrl={formData.foto} depthUrl={formData.fotoProfundidad} alt="Actual" className="object-cover w-full h-full" containerClassName="w-full h-full rounded-full overflow-hidden" />
                 </div>
               )}
               <div className="text-sm text-slate-400">
                 <p>{formData.foto ? "Foto actual cargada." : "Sin foto actual."}</p>
                 <p>Sube otra solo si quieres cambiarla.</p>
               </div>
            </div>

            <input 
              type="file" 
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) setNuevoArchivo(e.target.files[0]);
              }}
              className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:bg-slate-800 file:text-white cursor-pointer"
            />
          </div>

          <div className="flex gap-4 pt-4">
             <button type="button" onClick={() => router.back()} className="flex-1 bg-slate-800 text-white font-bold py-4 rounded hover:bg-slate-700 transition border border-slate-700">
               Cancelar
             </button>
             <button type="submit" disabled={saving} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded transition shadow-lg disabled:opacity-50">
               {saving ? 'Guardando...' : 'Guardar Cambios'}
             </button>
          </div>

        </form>
      </div>
    </div>
  );
}