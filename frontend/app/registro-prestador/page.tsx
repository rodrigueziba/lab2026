'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import {
  User, Briefcase, MapPin, Mail, Phone, Globe, 
  Image as ImageIcon, Loader2, CheckCircle, Tag, Palette, ChevronRight, ChevronLeft
} from 'lucide-react';

const BORRADOR_KEY = 'registro-prestador-borrador';
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const RUBROS = [
  "Dirección", "Producción", "Guion", "Fotografía / Cámara", 
  "Sonido", "Arte / Escenografía", "Vestuario / Maquillaje", 
  "Montaje / Postproducción", "Música", "Actuación / Casting",
  "Alquiler de Equipos", "Catering", "Transporte / Logística", "Legales / Gestoría"
];

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
  ciudad: 'Ushuaia',
  colorTema: '#ea580c',
};

export default function RegistroPrestadorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState(initialForm);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Debes iniciar sesión para registrar tu perfil.');
      router.push('/login');
    }
  }, [router]);

  // Cargar borrador desde localStorage al montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BORRADOR_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') {
          setFormData(prev => ({ ...initialForm, ...data }));
        }
      }
    } catch (_) {}
  }, []);

  // Auto-guardar borrador (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(BORRADOR_KEY, JSON.stringify(formData));
      } catch (_) {}
    }, 500);
    return () => clearTimeout(t);
  }, [formData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > MAX_FILE_BYTES) {
        toast.error('El archivo es muy pesado. Máximo 2MB.');
        e.target.value = '';
        return;
      }
      setArchivo(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
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
      toast.error('Error al subir la imagen. Verificá los permisos.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let fotoUrl = formData.foto;
    let fotoProfundidad: string | undefined;
    if (archivo) {
      const urlSubida = await uploadImage(archivo);
      if (urlSubida) fotoUrl = urlSubida;
      else {
        setLoading(false);
        return; // No limpiar formData: el usuario conserva lo que escribió
      }
      try {
        const objectUrl = URL.createObjectURL(archivo);
        const { generateDepthMap, dataURLtoFile } = await import('@/lib/depthAI');
        const depthBase64 = await generateDepthMap(objectUrl);
        URL.revokeObjectURL(objectUrl);
        const depthFile = dataURLtoFile(depthBase64, `depth_${archivo.name}`);
        const dUrl = await uploadImage(depthFile);
        if (dUrl) fotoProfundidad = dUrl;
      } catch (_) {}
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/prestador`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          ...formData,
          foto: fotoUrl,
          fotoProfundidad,
          instagram: formData.instagram || undefined,
          facebook: formData.facebook || undefined,
          twitter: formData.twitter || undefined,
          linkedin: formData.linkedin || undefined,
          tiktok: formData.tiktok || undefined,
          colorTema: formData.colorTema || undefined,
        })
      });

      if (res.ok) {
        try { localStorage.removeItem(BORRADOR_KEY); } catch (_) {}
        toast.success('¡Perfil creado con éxito! Bienvenid@ a la guía.');
        router.push('/mi-perfil');
      } else {
        const error = await res.json();
        toast.error(error.message || 'Error al crear el perfil.');
        // No resetear formData: preservar datos
      }
    } catch (error) {
      console.error(error);
      toast.error('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const canNextStep1 = formData.nombre.trim() && formData.rubro;
  const canNextStep2 = formData.descripcion.trim().length >= 20;
  const canSubmitStep3 = formData.email.trim() && formData.telefono.trim();

  return (
    <div className="min-h-screen bg-slate-950 text-white pt-28 pb-24 md:pb-12 px-6 font-sans flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3" aria-hidden />

      <div className="max-w-4xl w-full bg-slate-900 p-8 md:p-12 rounded-3xl border border-slate-800 shadow-2xl relative z-10">
        <div className="text-center mb-10 border-b border-slate-800/50 pb-8">
          <h1 className="text-4xl md:text-5xl font-black mb-3 tracking-tighter">
            Alta de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Profesional</span>
          </h1>
          <p className="text-slate-400 text-lg font-light">
            Creá tu tarjeta de presentación para que las productoras te contacten.
          </p>
          <div className="flex justify-center gap-2 mt-6" role="tablist" aria-label="Pasos del formulario">
            <span className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-blue-500' : 'bg-slate-700'}`} aria-current={step === 1 ? 'step' : undefined} />
            <span className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-blue-500' : 'bg-slate-700'}`} aria-current={step === 2 ? 'step' : undefined} />
            <span className={`w-3 h-3 rounded-full ${step >= 3 ? 'bg-blue-500' : 'bg-slate-700'}`} aria-current={step === 3 ? 'step' : undefined} />
          </div>
        </div>

        <form id="form-registro-prestador" onSubmit={handleSubmit} className="space-y-8">
          {/* PASO 1: Datos personales */}
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8" role="tabpanel" aria-labelledby="step1-title">
              <h2 id="step1-title" className="sr-only">Paso 1: Datos personales</h2>
              <div className="group">
                <label htmlFor="prestador-nombre" className="block text-xs font-bold uppercase text-slate-400 mb-2 pl-1 group-focus-within:text-blue-400 transition-colors flex items-center gap-2">
                  <User size={14}/> Nombre Público
                </label>
                <input id="prestador-nombre" name="nombre" type="text" required placeholder="Ej: Juan Pérez o Cine TDF"
                  className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl px-4 py-4 text-white outline-none focus:border-blue-500 focus:bg-slate-950/50 transition-all placeholder:text-slate-700"
                  value={formData.nombre} onChange={handleChange} />
              </div>

              <div className="group">
                <label htmlFor="prestador-tipo" className="block text-xs font-bold uppercase text-slate-400 mb-2 pl-1 group-focus-within:text-blue-400 transition-colors flex items-center gap-2">
                  <Briefcase size={14}/> Tipo de Perfil
                </label>
                <div className="relative">
                  <select id="prestador-tipo" name="tipoPerfil" 
                    className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl px-4 py-4 text-white outline-none focus:border-blue-500 appearance-none cursor-pointer"
                    value={formData.tipoPerfil} onChange={handleChange}>
                    <option value="Profesional">Profesional Independiente</option>
                    <option value="Productora">Productora Audiovisual</option>
                    <option value="Empresa">Empresa de Servicios (Catering, etc)</option>
                    <option value="Estudiante">Estudiante</option>
                  </select>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" aria-hidden>▼</span>
                </div>
              </div>

              <div className="group">
                <label htmlFor="prestador-rubro" className="block text-xs font-bold uppercase text-slate-400 mb-2 pl-1 group-focus-within:text-blue-400 transition-colors flex items-center gap-2">
                  <Tag size={14}/> Rubro Principal
                </label>
                <div className="relative">
                  <select id="prestador-rubro" name="rubro" required
                    className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl px-4 py-4 text-white outline-none focus:border-blue-500 appearance-none cursor-pointer"
                    value={formData.rubro} onChange={handleChange}>
                    <option value="">Seleccioná tu especialidad...</option>
                    {RUBROS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" aria-hidden>▼</span>
                </div>
              </div>

              <div className="group">
                <label htmlFor="prestador-ciudad" className="block text-xs font-bold uppercase text-slate-400 mb-2 pl-1 group-focus-within:text-blue-400 transition-colors flex items-center gap-2">
                  <MapPin size={14}/> Ciudad Base
                </label>
                <div className="relative">
                  <select id="prestador-ciudad" name="ciudad"
                    className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl px-4 py-4 text-white outline-none focus:border-blue-500 appearance-none cursor-pointer"
                    value={formData.ciudad} onChange={handleChange}>
                    <option value="Ushuaia">Ushuaia</option>
                    <option value="Río Grande">Río Grande</option>
                    <option value="Tolhuin">Tolhuin</option>
                  </select>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" aria-hidden>▼</span>
                </div>
              </div>

              <div className="group md:col-span-2">
                <label htmlFor="prestador-color" className="block text-xs font-bold uppercase text-slate-400 mb-2 pl-1 group-focus-within:text-blue-400 transition-colors flex items-center gap-2">
                  <Palette size={14}/> Color de tu tarjeta en la guía
                </label>
                <div className="flex items-center gap-4 bg-slate-950 border border-slate-800 p-3 rounded-xl max-w-xs">
                  <input type="color" id="prestador-color" name="colorTema" value={formData.colorTema} onChange={handleChange} className="w-12 h-10 rounded cursor-pointer border border-slate-700 bg-transparent p-0" />
                  <span className="text-slate-400 text-sm font-mono">{formData.colorTema}</span>
                </div>
              </div>
            </div>
          )}

          {/* PASO 2: Biografía */}
          {step === 2 && (
            <div className="group" role="tabpanel" aria-labelledby="step2-title">
              <h2 id="step2-title" className="sr-only">Paso 2: Biografía</h2>
              <label htmlFor="prestador-descripcion" className="block text-xs font-bold uppercase text-slate-400 mb-2 pl-1 group-focus-within:text-blue-400 transition-colors flex items-center gap-2">
                Biografía / Servicios Ofrecidos
              </label>
              <textarea id="prestador-descripcion" name="descripcion" required rows={5} placeholder="Contá brevemente tu experiencia, habilidades o qué equipos ofrecés (mínimo 20 caracteres)..."
                className="w-full bg-slate-950 border-l-4 border-slate-800 rounded-r-xl p-6 text-slate-300 outline-none focus:border-blue-500 transition-all resize-none placeholder:text-slate-700 leading-relaxed"
                value={formData.descripcion} onChange={handleChange} />
              {formData.descripcion.length > 0 && formData.descripcion.length < 20 && (
                <p className="text-amber-400 text-sm mt-1">Mínimo 20 caracteres para continuar.</p>
              )}
            </div>
          )}

          {/* PASO 3: Contacto, redes y foto */}
          {step === 3 && (
            <div className="space-y-8" role="tabpanel" aria-labelledby="step3-title">
              <h2 id="step3-title" className="sr-only">Paso 3: Contacto y foto</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="group">
                  <label htmlFor="prestador-email" className="block text-xs font-bold uppercase text-slate-400 mb-2 pl-1 group-focus-within:text-blue-400 transition-colors flex items-center gap-2">
                    <Mail size={14}/> Email Público
                  </label>
                  <input id="prestador-email" name="email" type="email" required placeholder="contacto@..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all text-sm"
                    value={formData.email} onChange={handleChange} />
                </div>
                <div className="group">
                  <label htmlFor="prestador-telefono" className="block text-xs font-bold uppercase text-slate-400 mb-2 pl-1 group-focus-within:text-blue-400 transition-colors flex items-center gap-2">
                    <Phone size={14}/> Teléfono
                  </label>
                  <input id="prestador-telefono" name="telefono" type="text" inputMode="tel" placeholder="+54 9 ..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all text-sm"
                    value={formData.telefono} onChange={handleChange} />
                </div>
                <div className="group">
                  <label htmlFor="prestador-web" className="block text-xs font-bold uppercase text-slate-400 mb-2 pl-1 group-focus-within:text-blue-400 transition-colors flex items-center gap-2">
                    <Globe size={14}/> Portfolio / Web
                  </label>
                  <input id="prestador-web" name="web" type="url" inputMode="url" placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all text-sm"
                    value={formData.web} onChange={handleChange} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-3 pl-1">Redes sociales (URL o @usuario)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <input id="prestador-instagram" name="instagram" type="text" inputMode="url" value={formData.instagram} placeholder="Instagram" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition-all text-sm placeholder:text-slate-600" onChange={handleChange} />
                  <input id="prestador-facebook" name="facebook" type="text" inputMode="url" value={formData.facebook} placeholder="Facebook" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all text-sm placeholder:text-slate-600" onChange={handleChange} />
                  <input id="prestador-twitter" name="twitter" type="text" inputMode="url" value={formData.twitter} placeholder="X / Twitter" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-sky-400 transition-all text-sm placeholder:text-slate-600" onChange={handleChange} />
                  <input id="prestador-linkedin" name="linkedin" type="text" inputMode="url" value={formData.linkedin} placeholder="LinkedIn" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-blue-600 transition-all text-sm placeholder:text-slate-600" onChange={handleChange} />
                  <input id="prestador-tiktok" name="tiktok" type="text" inputMode="url" value={formData.tiktok} placeholder="TikTok" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-slate-300 transition-all text-sm placeholder:text-slate-600" onChange={handleChange} />
                </div>
              </div>

              <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800 border-dashed hover:border-blue-500/50 transition-all flex flex-col sm:flex-row items-center gap-6">
                <div className="w-24 h-24 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                  {preview ? (
                    <img src={preview} alt="Vista previa de foto de perfil" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={32} className="text-slate-700" aria-hidden />
                  )}
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <label htmlFor="foto-upload" className="block text-sm font-bold text-slate-300 mb-2">Foto de Perfil o Logo</label>
                  <p className="text-xs text-slate-400 mb-4">Subí una imagen clara para que te reconozcan en la guía (máx. 2MB).</p>
                  <input 
                    type="file" 
                    id="foto-upload"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label 
                    htmlFor="foto-upload"
                    className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-full text-xs font-bold cursor-pointer transition-colors min-h-[44px] min-w-[44px] items-center justify-center"
                  >
                    <ImageIcon size={16} aria-hidden /> Seleccionar Imagen
                  </label>
                </div>
                {archivo && (
                  <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 px-4 py-2 rounded-full text-xs font-bold shrink-0">
                    <CheckCircle size={16} aria-hidden /> Lista
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navegación entre pasos (escritorio) */}
          <div className="hidden md:flex pt-6 justify-between items-center border-t border-slate-800">
            {step > 1 ? (
              <button type="button" onClick={() => setStep(s => s - 1)} className="flex items-center gap-2 text-slate-400 hover:text-white font-bold transition-colors">
                <ChevronLeft size={20} /> Anterior
              </button>
            ) : <div />}
            {step < 3 ? (
              <button type="button" onClick={() => setStep(s => s + 1)} disabled={step === 1 ? !canNextStep1 : !canNextStep2} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition">
                Siguiente <ChevronRight size={20} />
              </button>
            ) : (
              <button 
                type="submit" 
                disabled={loading || uploading}
                className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black py-5 px-8 rounded-full transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50 flex justify-center items-center gap-3"
              >
                {uploading || loading ? <Loader2 className="animate-spin" size={24} /> : <Briefcase size={24} />}
                {uploading ? 'SUBIENDO FOTO...' : (loading ? 'GUARDANDO PERFIL...' : 'PUBLICAR MI PERFIL')}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Botón sticky en móvil: siempre visible abajo */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-20 p-4 bg-slate-950/95 backdrop-blur border-t border-slate-800 safe-area-pb">
        {step < 3 ? (
          <div className="flex gap-3 max-w-4xl mx-auto">
            {step > 1 && (
              <button type="button" onClick={() => setStep(s => s - 1)} className="flex-1 min-h-[48px] flex items-center justify-center gap-2 text-slate-400 hover:text-white font-bold border border-slate-700 rounded-xl transition-colors">
                <ChevronLeft size={20} /> Anterior
              </button>
            )}
            <button 
              type="button" 
              onClick={() => setStep(s => s + 1)} 
              disabled={step === 1 ? !canNextStep1 : !canNextStep2}
              className="flex-1 min-h-[48px] flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition"
            >
              Siguiente <ChevronRight size={20} />
            </button>
          </div>
        ) : (
          <button 
            type="button"
            onClick={() => document.getElementById('form-registro-prestador')?.requestSubmit()}
            disabled={loading || uploading}
            className="w-full max-w-4xl mx-auto min-h-[48px] flex justify-center items-center gap-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black py-4 rounded-full transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50"
          >
            {uploading || loading ? <Loader2 className="animate-spin" size={24} /> : <Briefcase size={24} />}
            {uploading ? 'SUBIENDO FOTO...' : (loading ? 'GUARDANDO...' : 'PUBLICAR MI PERFIL')}
          </button>
        )}
      </div>
    </div>
  );
}
