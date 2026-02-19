'use client';
import { useState, useEffect, use } from 'react'; // 'use' es necesario en Next 14/15 para params
import { useRouter } from 'next/navigation';
import { User, Briefcase, Mail, Phone, Globe, MapPin, Camera, Save, Loader2, ArrowLeft, Palette } from 'lucide-react';

export default function EditarPerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  
  // Estado para desempaquetar params (Next.js 15 requirement)
  const [profileId, setProfileId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    nombre: '',
    tipoPerfil: 'Profesional',
    rubro: '',
    descripcion: '',
    email: '',
    telefono: '',
    web: '',
    foto: '',
    ciudad: 'Ushuaia',
    colorTema: '#ea580c'
  });

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
        // Usamos la ruta PRIVADA que creamos hoy para obtener datos reales
        const res = await fetch(`http://localhost:3000/prestador/mis-perfiles/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            // Rellenamos el formulario con los datos recibidos
            setFormData({
                nombre: data.nombre || '',
                tipoPerfil: data.tipoPerfil || 'Profesional',
                rubro: data.rubro || '',
                descripcion: data.descripcion || '',
                email: data.email || '',
                telefono: data.telefono || '',
                web: data.web || '',
                foto: data.foto || '',
                ciudad: data.ciudad || 'Ushuaia',
                colorTema: data.colorTema || '#ea580c'
            });
        } else {
            setError('No se pudo cargar el perfil o no tienes permisos.');
        }
    } catch (err) {
        setError('Error de conexión.');
    } finally {
        setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!profileId) return;

    setSaving(true);
    setError('');

    const token = localStorage.getItem('token');
    
    try {
      const res = await fetch(`http://localhost:3000/prestador/${profileId}`, {
        method: 'PATCH', // Usamos PATCH para actualizar
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        router.push('/mi-perfil');
        router.refresh();
      } else {
        const errData = await res.json();
        setError(errData.message || 'Error al actualizar');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><Loader2 className="animate-spin"/></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pt-28 pb-12 px-6">
      <div className="max-w-3xl mx-auto">
        
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white flex items-center gap-2 mb-6 transition">
            <ArrowLeft size={18}/> Cancelar
        </button>

        <h1 className="text-3xl font-black mb-8 flex items-center gap-3">
            <Briefcase className="text-orange-500" size={32}/> Editar Perfil
        </h1>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl space-y-8">
            
            {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl text-sm">
                    {error}
                </div>
            )}

            {/* SECCIÓN 1: IDENTIDAD */}
            <div className="space-y-6">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">Identidad Profesional</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Nombre del Perfil *</label>
                        <div className="relative">
                            <User className="absolute left-4 top-3.5 text-slate-500" size={18}/>
                            <input required name="nombre" type="text" value={formData.nombre} onChange={handleChange}
                                className="w-full bg-slate-950 border border-slate-800 p-3 pl-12 rounded-xl focus:border-orange-500 outline-none transition"/>
                        </div>
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
                        <input required name="rubro" type="text" value={formData.rubro} onChange={handleChange}
                            className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl focus:border-orange-500 outline-none transition"/>
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

                <div>
                    <label className="block text-sm text-slate-400 mb-2">Biografía / Descripción</label>
                    <textarea name="descripcion" rows={4} value={formData.descripcion} onChange={handleChange}
                        className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl focus:border-orange-500 outline-none transition resize-none"/>
                </div>
            </div>

            {/* SECCIÓN 2: CONTACTO */}
            <div className="space-y-6 pt-6">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">Información de Contacto Pública</h3>

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

             {/* SECCIÓN 3: MEDIA */}
             <div className="space-y-6 pt-6">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">Imagen de Perfil</h3>
                <div className="relative">
                    <Camera className="absolute left-4 top-3.5 text-slate-500" size={18}/>
                    <input name="foto" type="url" value={formData.foto} onChange={handleChange}
                        className="w-full bg-slate-950 border border-slate-800 p-3 pl-12 rounded-xl focus:border-orange-500 outline-none transition"/>
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