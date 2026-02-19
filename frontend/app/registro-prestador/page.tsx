'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { 
  User, Briefcase, MapPin, Mail, Phone, Globe, 
  Image as ImageIcon, Loader2, CheckCircle, Tag
} from 'lucide-react';

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

export default function RegistroPrestadorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    nombre: '',
    tipoPerfil: 'Profesional',
    rubro: '',
    descripcion: '',
    email: '',
    telefono: '',
    web: '',
    foto: '',
    ciudad: 'Ushuaia', // Valor por defecto
  });

  const [archivo, setArchivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // 1. Verificar si está logueado
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert("Debes iniciar sesión para registrar tu perfil.");
      router.push('/login');
    }
  }, [router]);

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: any) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setArchivo(file);
      setPreview(URL.createObjectURL(file)); // Para mostrar la foto antes de subirla
    }
  };

  // 2. Subir Foto a Supabase
  const uploadImage = async (file: File) => {
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-perfil.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('profesionales')
        .upload(fileName, file);

      if (error) throw error;

      const { data } = supabase.storage.from('profesionales').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (error) {
      console.error('Error subiendo imagen:', error);
      alert('Error al subir la imagen. Verifica los permisos de Supabase.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  // 3. Enviar Datos al Backend
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);

    let fotoUrl = formData.foto;

    if (archivo) {
      const urlSubida = await uploadImage(archivo);
      if (urlSubida) fotoUrl = urlSubida;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/prestador', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ ...formData, foto: fotoUrl })
      });

      if (res.ok) {
        alert('¡Perfil creado con éxito! Bienvenid@ a la guía. 🎉');
        router.push('/mi-perfil'); // Redirigimos al dashboard del perfil
      } else {
        const error = await res.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error(error);
      alert("Error de conexión con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white pt-28 pb-12 px-6 font-sans flex items-center justify-center relative overflow-hidden">
      
      {/* Decoración de fondo (Azul/Cyan para diferenciar de Proyectos) */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
      
      <div className="max-w-4xl w-full bg-slate-900 p-8 md:p-12 rounded-3xl border border-slate-800 shadow-2xl relative z-10">
        
        <div className="text-center mb-10 border-b border-slate-800/50 pb-8">
          <h1 className="text-4xl md:text-5xl font-black mb-3 tracking-tighter">
            Alta de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Profesional</span>
          </h1>
          <p className="text-slate-400 text-lg font-light">
            Crea tu tarjeta de presentación para que las productoras te contacten.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* SECCIÓN 1: DATOS PRINCIPALES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            <div className="group">
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2 pl-1 group-focus-within:text-blue-400 transition-colors flex items-center gap-2">
                <User size={14}/> Nombre Público
              </label>
              <input name="nombre" type="text" required placeholder="Ej: Juan Pérez o Cine TDF"
                className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl px-4 py-4 text-white outline-none focus:border-blue-500 focus:bg-slate-950/50 transition-all placeholder:text-slate-700"
                onChange={handleChange} />
            </div>

            <div className="group">
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2 pl-1 group-focus-within:text-blue-400 transition-colors flex items-center gap-2">
                <Briefcase size={14}/> Tipo de Perfil
              </label>
              <div className="relative">
                <select name="tipoPerfil" 
                  className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl px-4 py-4 text-white outline-none focus:border-blue-500 appearance-none cursor-pointer"
                  onChange={handleChange}>
                  <option value="Profesional">Profesional Independiente</option>
                  <option value="Productora">Productora Audiovisual</option>
                  <option value="Empresa">Empresa de Servicios (Catering, etc)</option>
                  <option value="Estudiante">Estudiante</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
              </div>
            </div>

            <div className="group">
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2 pl-1 group-focus-within:text-blue-400 transition-colors flex items-center gap-2">
                <Tag size={14}/> Rubro Principal
              </label>
              <div className="relative">
                <select name="rubro" required
                  className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl px-4 py-4 text-white outline-none focus:border-blue-500 appearance-none cursor-pointer"
                  onChange={handleChange}>
                  <option value="">Selecciona tu especialidad...</option>
                  {RUBROS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
              </div>
            </div>

            {/* --- LA CIUDAD AGREGADA --- */}
            <div className="group">
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2 pl-1 group-focus-within:text-blue-400 transition-colors flex items-center gap-2">
                <MapPin size={14}/> Ciudad Base
              </label>
              <div className="relative">
                <select name="ciudad" value={formData.ciudad}
                  className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl px-4 py-4 text-white outline-none focus:border-blue-500 appearance-none cursor-pointer"
                  onChange={handleChange}>
                  <option value="Ushuaia">Ushuaia</option>
                  <option value="Río Grande">Río Grande</option>
                  <option value="Tolhuin">Tolhuin</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
              </div>
            </div>
            {/* --------------------------- */}

          </div>

          {/* SECCIÓN 2: BIOGRAFÍA */}
          <div className="group">
            <label className="block text-xs font-bold uppercase text-slate-500 mb-2 pl-1 group-focus-within:text-blue-400 transition-colors flex items-center gap-2">
              Biografía / Servicios Ofrecidos
            </label>
            <textarea name="descripcion" required rows={4} placeholder="Cuenta brevemente tu experiencia, habilidades o qué equipos ofreces..."
              className="w-full bg-slate-950 border-l-4 border-slate-800 rounded-r-xl p-6 text-slate-300 outline-none focus:border-blue-500 transition-all resize-none placeholder:text-slate-700 leading-relaxed"
              onChange={handleChange}></textarea>
          </div>

          {/* SECCIÓN 3: CONTACTO Y REDES */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="group">
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2 pl-1 group-focus-within:text-blue-400 transition-colors flex items-center gap-2">
                <Mail size={14}/> Email Público
              </label>
              <input name="email" type="email" required placeholder="contacto@..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all text-sm"
                onChange={handleChange} />
            </div>
            
            <div className="group">
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2 pl-1 group-focus-within:text-blue-400 transition-colors flex items-center gap-2">
                <Phone size={14}/> Teléfono
              </label>
              <input name="telefono" type="text" placeholder="+54 9 ..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all text-sm"
                onChange={handleChange} />
            </div>
            
            <div className="group">
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2 pl-1 group-focus-within:text-blue-400 transition-colors flex items-center gap-2">
                <Globe size={14}/> Portfolio / Web
              </label>
              <input name="web" type="text" placeholder="https://..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all text-sm"
                onChange={handleChange} />
            </div>
          </div>

          {/* SECCIÓN 4: FOTO DE PERFIL */}
          <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800 border-dashed hover:border-blue-500/50 transition-all flex flex-col sm:flex-row items-center gap-6">
            
            <div className="w-24 h-24 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
              {preview ? (
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={32} className="text-slate-700" />
              )}
            </div>

            <div className="flex-1 text-center sm:text-left">
              <label className="block text-sm font-bold text-slate-300 mb-2">Foto de Perfil o Logo</label>
              <p className="text-xs text-slate-500 mb-4">Sube una imagen clara para que te reconozcan en la guía (Max 2MB).</p>
              
              <input 
                type="file" 
                id="foto-upload"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <label 
                htmlFor="foto-upload"
                className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-full text-xs font-bold cursor-pointer transition-colors"
              >
                <ImageIcon size={16} /> Seleccionar Imagen
              </label>
            </div>

            {archivo && (
              <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 px-4 py-2 rounded-full text-xs font-bold shrink-0">
                <CheckCircle size={16} /> Lista
              </div>
            )}
          </div>

          {/* BOTÓN SUBMIT */}
          <div className="pt-6">
            <button 
              type="submit" 
              disabled={loading || uploading}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black py-5 rounded-full transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50 flex justify-center items-center gap-3 transform hover:-translate-y-1 hover:scale-[1.01]"
            >
              {uploading || loading ? <Loader2 className="animate-spin" size={24} /> : <Briefcase size={24} />}
              {uploading ? 'SUBIENDO FOTO...' : (loading ? 'GUARDANDO PERFIL...' : 'PUBLICAR MI PERFIL')}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}