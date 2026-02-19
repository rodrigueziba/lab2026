'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Loader2, CheckCircle } from 'lucide-react';

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return alert("Las contraseñas no coinciden");
    
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      if (res.ok) {
         alert("¡Contraseña actualizada!");
         router.push('/login');
      } else {
         const err = await res.json();
         alert(err.message || "El enlace ha expirado o es inválido.");
      }
    } catch (error) {
       console.error(error);
    } finally {
       setLoading(false);
    }
  };

  if (!token) return <div className="text-white text-center">Enlace inválido.</div>;

  return (
    <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-md">
       <h1 className="text-3xl font-black text-white mb-2">Nueva Contraseña</h1>
       <p className="text-slate-400 mb-8">Crea una contraseña segura para tu cuenta.</p>

       <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
             <label className="text-xs font-bold text-slate-500 uppercase">Nueva Contraseña</label>
             <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white focus:border-blue-500 focus:outline-none"/>
          </div>
          <div className="space-y-2">
             <label className="text-xs font-bold text-slate-500 uppercase">Confirmar Contraseña</label>
             <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white focus:border-blue-500 focus:outline-none"/>
          </div>
          <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl text-white font-bold flex justify-center items-center gap-2">
             {loading ? <Loader2 className="animate-spin"/> : <CheckCircle/>} Guardar Nueva Contraseña
          </button>
       </form>
    </div>
  );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
            <Suspense fallback={<div className="text-white">Cargando...</div>}>
                <ResetForm />
            </Suspense>
        </div>
    )
}