'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react';

// Componente interno para manejar los params de la URL (Requerido por Next.js)
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  // 1. DETECTOR DE GOOGLE 🕵️‍♂️
  // Si la URL tiene ?token=... es porque volvemos de Google
  useEffect(() => {
    const token = searchParams.get('token');
    const userStr = searchParams.get('user');

    if (token && userStr) {
      // Guardamos en el navegador
      localStorage.setItem('token', token);
      localStorage.setItem('user', decodeURIComponent(userStr));
      
      // Forzamos un evento para que el Navbar se entere que nos logueamos
      window.dispatchEvent(new Event('storage'));
      
      // Redirigimos al home
      router.push('/'); 
    }
  }, [searchParams, router]);

  // Login Normal (Email/Pass)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.dispatchEvent(new Event('storage'));
        router.push('/');
      } else {
        setError('Credenciales inválidas');
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  // Función para iniciar el viaje a Google
  const handleGoogleLogin = () => {
    window.location.href = `${apiUrl}/auth/login`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-white mb-2">Bienvenido</h1>
        <p className="text-slate-400">Ingresa a tu cuenta para continuar</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl mb-6 flex items-center gap-2 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* --- BOTÓN DE GOOGLE --- */}
      <button 
        onClick={handleGoogleLogin}
        className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3.5 rounded-xl transition flex justify-center items-center gap-3 mb-6 relative group overflow-hidden"
      >
        {/* Logo de Google SVG */}
        <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        <span>Continuar con Google</span>
      </button>

      <div className="relative flex py-2 items-center mb-6">
        <div className="flex-grow border-t border-slate-700"></div>
        <span className="flex-shrink mx-4 text-slate-500 text-xs font-bold uppercase">O ingresa con email</span>
        <div className="flex-grow border-t border-slate-700"></div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="email"
            placeholder="Correo electrónico"
            className="w-full bg-slate-950 border border-slate-800 p-4 pl-12 rounded-xl text-white focus:border-orange-500 focus:outline-none placeholder:text-slate-600"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="password"
            placeholder="Contraseña"
            className="w-full bg-slate-950 border border-slate-800 p-4 pl-12 rounded-xl text-white focus:border-orange-500 focus:outline-none placeholder:text-slate-600"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />
        </div>

        <div className="flex justify-end">
          <Link href="/login/olvide-password" className="text-sm text-orange-500 hover:text-orange-400 font-bold">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <button
          disabled={loading}
          className="w-full bg-orange-600 hover:bg-orange-500 py-4 rounded-xl text-white font-bold flex justify-center items-center gap-2 transition"
        >
          {loading ? <Loader2 className="animate-spin" /> : 'Ingresar'}
        </button>
      </form>

      <div className="mt-8 text-center">
        <p className="text-slate-400 text-sm">
          ¿No tienes cuenta?{' '}
          <Link href="/registro" className="text-orange-500 font-bold hover:text-orange-400">
            Regístrate aquí
          </Link>
        </p>
      </div>
    </div>
  );
}

// Página principal que envuelve el formulario en Suspense (Obligatorio en Next.js App Router para usar searchParams)
export default function LoginPage() {
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
            <Suspense fallback={<div className="text-white">Cargando login...</div>}>
                <LoginForm />
            </Suspense>
        </div>
    );
}