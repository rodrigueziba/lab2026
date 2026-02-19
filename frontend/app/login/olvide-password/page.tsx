'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, Loader2 } from 'lucide-react';

export default function OlvidePasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) setSent(true);
      else alert("No se pudo enviar el correo. Verifica el email.");
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (sent) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
       <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
             <Mail size={32}/>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">¡Correo Enviado!</h2>
          <p className="text-slate-400 mb-6">Revisa tu bandeja de entrada. Hemos enviado un enlace para restablecer tu contraseña.</p>
          <Link href="/login" className="text-blue-400 font-bold hover:text-blue-300">Volver al Login</Link>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
         <Link href="/login" className="flex items-center gap-2 text-slate-400 mb-8 font-bold text-sm"><ArrowLeft size={16}/> Volver</Link>
         
         <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl">
            <h1 className="text-3xl font-black text-white mb-2">Recuperar Cuenta</h1>
            <p className="text-slate-400 mb-8">Ingresa tu email y te enviaremos las instrucciones.</p>

            <form onSubmit={handleSubmit} className="space-y-6">
               <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Tu Email</label>
                  <input 
                    type="email" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white focus:border-orange-500 focus:outline-none"
                    placeholder="ejemplo@email.com"
                  />
               </div>
               <button disabled={loading} className="w-full bg-orange-600 hover:bg-orange-500 py-4 rounded-xl text-white font-bold flex justify-center items-center gap-2">
                  {loading && <Loader2 className="animate-spin"/>} Enviar Instrucciones
               </button>
            </form>
         </div>
      </div>
    </div>
  );
}