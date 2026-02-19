'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Menu, X, ChevronDown, LogOut, Film, User, 
  Briefcase, MapPin, Users, Clapperboard, Bell, Check, Shield, Inbox // <--- Agregado Inbox
} from 'lucide-react';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  
  // Estados
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  
  // Estados de Notificación 🔔
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notificaciones, setNotificaciones] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [user, setUser] = useState<any>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // 1. Cargar Usuario y Notificaciones
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);

    const checkUser = async () => {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      
      if (token && userStr) {
        setUser(JSON.parse(userStr));
        // Cargar Notificaciones
        try {
            const res = await fetch('http://localhost:3000/notificacion', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setNotificaciones(data);
                setUnreadCount(data.filter((n:any) => !n.leida).length);
            }
        } catch (error) {
            console.error("Error notificaciones:", error);
        }
      } else {
        setUser(null);
        setNotificaciones([]);
      }
    };
    
    checkUser();
    window.addEventListener('storage', checkUser); // Escuchar cambios en login

    // Polling: Actualizar notificaciones cada 30 segundos
    const interval = setInterval(checkUser, 30000);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('storage', checkUser);
      clearInterval(interval);
    };
  }, []);

  // Cerrar menús al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsUserMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setIsNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsUserMenuOpen(false);
    router.push('/login');
    router.refresh();
  };

  // Marcar como leída y navegar
  const handleNotificacionClick = async (notif: any) => {
    try {
        const token = localStorage.getItem('token');
        // Marcar en backend
        await fetch(`http://localhost:3000/notificacion/${notif.id}/leer`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // Actualizar localmente
        setNotificaciones(prev => prev.map(n => n.id === notif.id ? { ...n, leida: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
        setIsNotifOpen(false);

        // Navegar
        if (notif.link) router.push(notif.link);

    } catch (error) {
        console.error(error);
    }
  };

  const NavLink = ({ href, icon: Icon, label }: { href: string, icon: any, label: string }) => {
    const isActive = pathname === href;
    return (
      <Link 
        href={href} 
        className={`relative group flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ${isActive ? 'text-white bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.3)] border border-white/20' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'}`}
      >
        <Icon size={18} className={`transition-all duration-300 ${isActive ? 'text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]' : ''}`}/>
        <span className={`text-sm font-bold tracking-wide ${isActive ? 'drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]' : ''}`}>{label}</span>
        {isActive && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-orange-500 rounded-full shadow-[0_0_10px_4px_rgba(249,115,22,0.6)]"></span>}
      </Link>
    );
  };

  return (
    <nav className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${isScrolled ? 'bg-slate-950/80 backdrop-blur-xl border-b border-white/5 py-2 shadow-2xl' : 'bg-transparent py-6'}`}>
      <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
        
        <Link href="/" className="text-2xl font-black tracking-tighter text-white group">
          TDF<span className="text-orange-600 group-hover:text-orange-500 transition-colors duration-300 drop-shadow-[0_0_10px_rgba(234,88,12,0.5)]">FILM</span>
        </Link>

        <div className="hidden md:flex items-center gap-2 bg-black/20 backdrop-blur-sm p-1.5 rounded-full border border-white/5">
          <NavLink href="/locaciones" icon={MapPin} label="Locaciones" />
          <NavLink href="/guia" icon={Users} label="Prestadores" />
          <NavLink href="/proyectos" icon={Clapperboard} label="Proyectos" />
        </div>

        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
                
                {/* 🔔 CAMPANITA DE NOTIFICACIONES */}
                <div className="relative" ref={notifRef}>
                    <button 
                        onClick={() => setIsNotifOpen(!isNotifOpen)}
                        className="relative p-2 text-slate-400 hover:text-white transition rounded-full hover:bg-white/10"
                    >
                        <Bell size={20}/>
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-950 animate-pulse"></span>
                        )}
                    </button>

                    {isNotifOpen && (
                        <div className="absolute right-0 mt-4 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Notificaciones</span>
                                {unreadCount > 0 && <span className="text-xs bg-red-500 text-white px-1.5 rounded font-bold">{unreadCount}</span>}
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                {notificaciones.length === 0 ? (
                                    <div className="p-6 text-center text-slate-500 text-sm">No tienes notificaciones.</div>
                                ) : (
                                    notificaciones.map((n) => (
                                        <div 
                                            key={n.id} 
                                            onClick={() => handleNotificacionClick(n)}
                                            className={`p-4 border-b border-slate-800/50 cursor-pointer hover:bg-slate-800 transition flex gap-3 ${!n.leida ? 'bg-slate-800/30' : ''}`}
                                        >
                                            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${!n.leida ? 'bg-blue-500' : 'bg-transparent'}`}></div>
                                            <div>
                                                <h5 className={`text-sm ${!n.leida ? 'font-bold text-white' : 'font-medium text-slate-400'}`}>{n.titulo}</h5>
                                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{n.mensaje}</p>
                                                <p className="text-[10px] text-slate-600 mt-2">{new Date(n.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* MENU USUARIO */}
                <div className="relative" ref={dropdownRef}>
                <button 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className={`flex items-center gap-3 border py-1.5 pl-1.5 pr-4 rounded-full transition-all duration-300 group ${isUserMenuOpen ? 'bg-slate-800 border-slate-600' : 'bg-transparent border-slate-800 hover:border-slate-600'}`}
                >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-600 to-red-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                    {user.nombre ? user.nombre[0].toUpperCase() : 'U'}
                    </div>
                    <span className="text-sm font-bold text-slate-300 group-hover:text-white truncate max-w-[100px]">
                    {user.nombre.split(' ')[0]}
                    </span>
                    <ChevronDown size={14} className={`text-slate-500 transition-transform ${isUserMenuOpen ? 'rotate-180 text-white' : ''}`}/>
                </button>

                {isUserMenuOpen && (
                    <div className="absolute right-0 mt-4 w-72 bg-slate-900 border border-slate-800 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 ring-1 ring-white/10">
                    <div className="px-6 py-5 border-b border-slate-800 bg-slate-950/50">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Sesión activa</p>
                        <p className="text-base font-bold text-white truncate">{user.email}</p>
                    </div>

                    <div className="p-3 space-y-1">
                        <Link href="/mis-proyectos" onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition">
                        <Film size={18} className="text-orange-500"/> Gestionar Proyectos
                        </Link>
                        <Link href="/mis-postulaciones" onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition">
                        <Briefcase size={18} className="text-blue-500"/> Mis Postulaciones
                        </Link>
                        
                        {/* 👇 NUEVO LINK AGREGADO: GESTIÓN DE SOLICITUDES */}
                        <Link href="/mis-perfiles/solicitudes" onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition">
                        <Inbox size={18} className="text-yellow-500"/> Solicitudes Recibidas
                        </Link>

                        <Link href="/mi-perfil" onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition">
                        <User size={18} className="text-emerald-500"/> Perfil Profesional
                        </Link>

                        <div className="h-px bg-slate-800 my-2 mx-4"></div>

                        <Link href="/mi-cuenta" onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition">
                          <Shield size={18} className="text-purple-500"/> Configuración de Cuenta
                        </Link>
                    </div>

                    <div className="p-3 border-t border-slate-800 bg-black/20">
                        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition">
                        <LogOut size={18}/> Cerrar Sesión
                        </button>
                    </div>
                    </div>
                )}
                </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
               <Link href="/login" className="text-sm font-bold text-slate-300 hover:text-white transition hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">Ingresar</Link>
               <Link href="/registro" className="bg-white text-black hover:bg-slate-200 px-6 py-2.5 rounded-full text-sm font-black transition transform hover:scale-105 shadow-[0_0_15px_rgba(255,255,255,0.2)]">Registrarse</Link>
            </div>
          )}
        </div>

        <button className="md:hidden text-white" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={28}/> : <Menu size={28}/>}
        </button>

      </div>
      
      {/* MENÚ MÓVIL (También actualizado) */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[70px] bg-slate-950/95 backdrop-blur-xl z-40 p-6 flex flex-col gap-6 animate-in slide-in-from-right duration-300">
           <Link href="/locaciones" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 text-xl font-bold text-slate-300"><MapPin/> Locaciones</Link>
           <Link href="/guia" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 text-xl font-bold text-slate-300"><Users/> Prestadores</Link>
           <Link href="/proyectos" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 text-xl font-bold text-orange-500"><Clapperboard/> Proyectos</Link>
           
           <div className="h-px bg-slate-800 my-2"></div>
           
           {user ? (
             <>
                <div className="flex items-center gap-3 mb-4 bg-slate-900 p-4 rounded-xl">
                   <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center text-white font-bold">{user.nombre[0]}</div>
                   <div><p className="font-bold text-white">{user.nombre}</p><p className="text-xs text-slate-500">{user.email}</p></div>
                </div>
                <Link href="/mis-proyectos" onClick={() => setIsMobileMenuOpen(false)} className="text-lg text-slate-400 flex items-center gap-2"><Film size={18}/> Mis Proyectos</Link>
                <Link href="/mis-postulaciones" onClick={() => setIsMobileMenuOpen(false)} className="text-lg text-slate-400 flex items-center gap-2"><Briefcase size={18}/> Mis Postulaciones</Link>
                <Link href="/mis-perfiles/solicitudes" onClick={() => setIsMobileMenuOpen(false)} className="text-lg text-slate-400 flex items-center gap-2"><Inbox size={18}/> Solicitudes Recibidas</Link>
                <Link href="/mi-perfil" onClick={() => setIsMobileMenuOpen(false)} className="text-lg text-slate-400 flex items-center gap-2"><User size={18}/> Mi Perfil</Link>
                <Link href="/mi-cuenta" onClick={() => setIsMobileMenuOpen(false)} className="text-lg text-slate-400 flex items-center gap-2"><Shield size={18}/> Mi Cuenta</Link>
                <button onClick={handleLogout} className="text-lg text-red-500 font-bold mt-4 flex items-center gap-2"><LogOut size={18}/> Cerrar Sesión</button>
             </>
           ) : (
             <div className="flex flex-col gap-4">
                <Link href="/login" className="text-center w-full py-4 rounded-xl border border-slate-700 text-white font-bold">Ingresar</Link>
                <Link href="/registro" className="text-center w-full py-4 rounded-xl bg-orange-600 text-white font-bold">Registrarse</Link>
             </div>
           )}
        </div>
      )}
    </nav>
  );
}