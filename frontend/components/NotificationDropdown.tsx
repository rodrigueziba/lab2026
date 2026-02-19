'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, ExternalLink } from 'lucide-react';

export default function NotificationDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificaciones, setNotificaciones] = useState<any[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 1. Cargar datos iniciales
  useEffect(() => {
    fetchUnreadCount();
    // Opcional: Polling cada 60s para actualizar el numerito
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  // 2. Cerrar dropdown si hago clic afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- API CALLS ---

  const fetchUnreadCount = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/notificacion/badge`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const count = await res.json();
        setUnreadCount(count); // Asume que el backend devuelve un número directo o { count: 5 }
      }
    } catch (e) { console.error(e); }
  };

  const fetchNotifications = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/notificacion`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotificaciones(data);
      }
    } catch (e) { console.error(e); }
  };

  const handleToggle = () => {
    if (!isOpen) {
      fetchNotifications(); // Cargar lista al abrir
    }
    setIsOpen(!isOpen);
  };

  const handleNotificationClick = async (notif: any) => {
    const token = localStorage.getItem('token');
    
    // 1. Marcar como leída en backend
    if (!notif.leida) {
        try {
            await fetch(`${apiUrl}/notificacion/${notif.id}/leer`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            // Actualizar estado local
            setUnreadCount(prev => Math.max(0, prev - 1));
            setNotificaciones(prev => prev.map(n => n.id === notif.id ? { ...n, leida: true } : n));
        } catch (e) { console.error(e); }
    }

    // 2. Navegar al link
    setIsOpen(false);
    if (notif.link) {
        router.push(notif.link);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      
      {/* --- BOTÓN CAMPANITA --- */}
      <button 
        onClick={handleToggle}
        className="relative p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-slate-800"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full shadow-sm animate-pulse">
            {unreadCount > 9 ? '+9' : unreadCount}
          </span>
        )}
      </button>

      {/* --- DROPDOWN --- */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            
            <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
                <h3 className="font-bold text-sm text-white">Notificaciones</h3>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Recientes</span>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
                {notificaciones.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">
                        <Bell className="mx-auto mb-2 opacity-20" size={32}/>
                        No tienes notificaciones.
                    </div>
                ) : (
                    notificaciones.map((notif) => (
                        <div 
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-4 border-b border-slate-800 cursor-pointer transition hover:bg-slate-800/50 flex gap-3 ${!notif.leida ? 'bg-slate-800/20' : ''}`}
                        >
                            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${!notif.leida ? 'bg-blue-500' : 'bg-transparent'}`}></div>
                            
                            <div className="flex-1">
                                <h4 className={`text-sm ${!notif.leida ? 'text-white font-bold' : 'text-slate-400 font-medium'}`}>
                                    {notif.titulo}
                                </h4>
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                    {notif.mensaje}
                                </p>
                                <span className="text-[10px] text-slate-600 mt-2 block">
                                    {new Date(notif.createdAt).toLocaleDateString()}
                                </span>
                            </div>

                            {notif.link && <ExternalLink size={14} className="text-slate-600 self-start"/>}
                        </div>
                    ))
                )}
            </div>
            
            <div className="bg-slate-950 px-4 py-2 border-t border-slate-800 text-center">
                <button onClick={() => router.push('/mi-perfil')} className="text-xs text-blue-500 hover:text-blue-400 font-bold">
                    Ver todas
                </button>
            </div>
        </div>
      )}
    </div>
  );
}