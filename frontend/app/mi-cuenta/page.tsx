'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Shield, Mail, Lock, Save, AlertTriangle, 
  CheckCircle, Loader2, LogOut 
} from 'lucide-react';

export default function MiCuentaPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Estado para Email
  const [email, setEmail] = useState('');
  
  // Estado para Password
  const [passData, setPassData] = useState({ newPass: '', confirmPass: '' });

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return router.push('/login');
    const userData = JSON.parse(userStr);
    setUser(userData);
    setEmail(userData.email);
  }, [router]);

  // --- FUNCIÓN: CAMBIAR EMAIL ---
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm("⚠️ Al cambiar tu email, se cerrará la sesión y tendrás que ingresar con el nuevo correo. ¿Continuar?")) return;

    setLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      // Usamos el ID del usuario para la ruta PATCH
      const res = await fetch(`http://localhost:3000/user/${user.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email })
      });

      if (res.ok) {
        alert("✅ Email actualizado. Por favor inicia sesión de nuevo.");
        handleLogout();
      } else {
        const error = await res.json();
        alert(error.message || "Error al actualizar email.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  // --- FUNCIÓN: CAMBIAR PASSWORD ---
  const handleUpdatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passData.newPass !== passData.confirmPass) return alert("❌ Las contraseñas no coinciden.");
    if (passData.newPass.length < 6) return alert("❌ La contraseña debe tener al menos 6 caracteres.");

    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`http://localhost:3000/user/${user.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: passData.newPass })
      });

      if (res.ok) {
        alert("¡Contraseña actualizada con éxito! 🔒");
        setPassData({ newPass: '', confirmPass: '' }); // Limpiar campos
      } else {
        const error = await res.json();
        alert(error.message || "Error al actualizar contraseña.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pt-28 pb-12 px-6">
      <div className="max-w-4xl mx-auto">
        
        <div className="mb-10">
            <h1 className="text-3xl font-black mb-2 flex items-center gap-3">
                <Shield className="text-orange-500" size={32}/> Configuración de Cuenta
            </h1>
            <p className="text-slate-400 text-lg">Administra tus credenciales de acceso y seguridad.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* 1. TARJETA EMAIL */}
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl h-fit">
                <div className="flex items-center gap-3 mb-6 text-blue-400 font-bold uppercase tracking-widest text-xs border-b border-slate-800 pb-4">
                    <Mail size={16}/> Email de Acceso
                </div>
                
                <form onSubmit={handleUpdateEmail} className="space-y-6">
                    <div>
                        <label className="text-sm text-slate-400 block mb-2 font-bold">Email Actual</label>
                        <input 
                            type="email" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white focus:border-blue-500 outline-none transition"
                        />
                    </div>
                    
                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex gap-3 items-start">
                        <AlertTriangle className="text-blue-400 shrink-0 mt-0.5" size={16}/>
                        <p className="text-xs text-blue-200 leading-relaxed">
                            <strong>Importante:</strong> Si cambias tu email, se cerrará la sesión automáticamente y deberás ingresar con el nuevo correo.
                        </p>
                    </div>

                    <button 
                        disabled={loading || email === user.email} 
                        className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Actualizar Email
                    </button>
                </form>
            </div>

            {/* 2. TARJETA PASSWORD */}
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl h-fit">
                <div className="flex items-center gap-3 mb-6 text-emerald-400 font-bold uppercase tracking-widest text-xs border-b border-slate-800 pb-4">
                    <Lock size={16}/> Cambiar Contraseña
                </div>
                
                <form onSubmit={handleUpdatePass} className="space-y-6">
                    <div>
                        <label className="text-sm text-slate-400 block mb-2 font-bold">Nueva Contraseña</label>
                        <input 
                            type="password" 
                            value={passData.newPass} 
                            onChange={(e) => setPassData({...passData, newPass: e.target.value})}
                            className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white focus:border-emerald-500 outline-none transition"
                            placeholder="******"
                        />
                    </div>

                    <div>
                        <label className="text-sm text-slate-400 block mb-2 font-bold">Confirmar Contraseña</label>
                        <input 
                            type="password" 
                            value={passData.confirmPass} 
                            onChange={(e) => setPassData({...passData, confirmPass: e.target.value})}
                            className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white focus:border-emerald-500 outline-none transition"
                            placeholder="******"
                        />
                    </div>

                    <button 
                        disabled={loading || !passData.newPass} 
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/20"
                    >
                        {loading ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18}/>} Guardar Nueva Contraseña
                    </button>
                </form>
            </div>

        </div>

        {/* Botón de Cerrar Sesión General */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex justify-end">
            <button onClick={handleLogout} className="text-red-500 hover:text-red-400 font-bold flex items-center gap-2 text-sm px-6 py-3 hover:bg-red-500/10 rounded-xl transition border border-transparent hover:border-red-500/20">
                <LogOut size={18}/> Cerrar Sesión en este dispositivo
            </button>
        </div>

      </div>
    </div>
  );
}