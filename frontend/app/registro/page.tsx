'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import Swal from 'sweetalert2';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'Productor' // Valor por defecto
  });

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('http://localhost:3000/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        // ✅ ÉXITO VISUAL
        await Swal.fire({
            title: '¡Bienvenido!',
            text: 'Tu cuenta ha sido creada exitosamente.',
            icon: 'success',
            confirmButtonColor: '#ea580c',
            confirmButtonText: 'Iniciar Sesión'
        });
        
        router.push('/login'); // Redirigir al login
    } else {
        // ❌ ERROR VISUAL
        Swal.fire({
            title: 'Error',
            text: data.message || 'No se pudo crear la cuenta.',
            icon: 'error',
            confirmButtonColor: '#334155'
        });
    }
    } catch (err) {
      console.error(err);
      alert('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decoración de fondo */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-orange-600/20 blur-[120px] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
      
      <div className="bg-slate-900 p-8 md:p-10 rounded-3xl border border-slate-800 shadow-2xl w-full max-w-md relative z-10">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white tracking-tighter mb-2">
            Crear Cuenta
          </h1>
          <p className="text-slate-400 text-sm">
            Únete a la comunidad audiovisual de TDF.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Nombre */}
          <div className="group">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 pl-1 group-focus-within:text-orange-500 transition-colors">
              Nombre Completo
            </label>
            <div className="relative">
               <User size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-orange-500 transition-colors" />
               <input 
                 type="text" name="nombre" required placeholder="Ej: Juan Pérez"
                 className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl pl-12 pr-4 py-4 text-white outline-none focus:border-orange-500 focus:bg-slate-950/50 transition-all placeholder:text-slate-700"
                 onChange={handleChange}
               />
            </div>
          </div>

          {/* Email */}
          <div className="group">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 pl-1 group-focus-within:text-orange-500 transition-colors">
              Correo Electrónico
            </label>
            <div className="relative">
               <Mail size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-orange-500 transition-colors" />
               <input 
                 type="email" name="email" required placeholder="ejemplo@correo.com"
                 className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl pl-12 pr-4 py-4 text-white outline-none focus:border-orange-500 focus:bg-slate-950/50 transition-all placeholder:text-slate-700"
                 onChange={handleChange}
               />
            </div>
          </div>

          {/* Password */}
          <div className="group">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 pl-1 group-focus-within:text-orange-500 transition-colors">
              Contraseña
            </label>
            <div className="relative">
               <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-orange-500 transition-colors" />
               <input 
                 type="password" name="password" required placeholder="••••••••"
                 className="w-full bg-slate-950 border-b-2 border-slate-800 rounded-t-xl pl-12 pr-4 py-4 text-white outline-none focus:border-orange-500 focus:bg-slate-950/50 transition-all placeholder:text-slate-700"
                 onChange={handleChange}
               />
            </div>
          </div>

          {/* Selector de Rol (Opcional por ahora, defaulted a Productor) */}
          {/* Puedes descomentarlo si quieres que elijan entre Productor/Prestador aquí */}
          {/* <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 pl-1">Perfil Principal</label>
            <select name="rol" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500" onChange={handleChange}>
              <option value="Productor">Productor (Quiero crear proyectos)</option>
              <option value="Prestador">Prestador (Quiero ofrecer servicios)</option>
            </select>
          </div>
          */}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-900/30 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-8"
          >
            {loading ? <Loader2 className="animate-spin" /> : <>Registrarme <ArrowRight size={20}/></>}
          </button>

        </form>

        <div className="text-center mt-8 text-slate-500 text-sm">
          ¿Ya tienes una cuenta?{' '}
          <Link href="/login" className="text-orange-500 font-bold hover:underline">
            Ingresar aquí
          </Link>
        </div>

      </div>
    </div>
  );
}