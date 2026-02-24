'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Menu, X, ChevronDown, LogOut, Film, User, 
  Briefcase, MapPin, Users, Clapperboard, Bell, Shield, Inbox, Atom
} from 'lucide-react';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  
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

      if (!token || !userStr) {
        setUser(null);
        setNotificaciones([]);
        setUnreadCount(0);
        return;
      }

      try {
        setUser(JSON.parse(userStr));
        // Solo cargar notificaciones si hay usuario logueado
        const res = await fetch(`${apiUrl}/notificacion`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setNotificaciones(Array.isArray(data) ? data : []);
          setUnreadCount((Array.isArray(data) ? data : []).filter((n: any) => !n.leida).length);
        } else {
          setNotificaciones([]);
        }
      } catch (error) {
        setNotificaciones([]);
        setUnreadCount(0);
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
        await fetch(`${apiUrl}/notificacion/${notif.id}/leer`, {
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

  const MobileNavLink = ({ href, pathname: p, onClick, icon: Icon, label }: { href: string; pathname: string; onClick: () => void; icon: any; label: string }) => {
    const isActive = p === href || (href !== '/' && p.startsWith(href));
    return (
      <Link
        href={href}
        onClick={onClick}
        className={`flex items-center gap-3 text-xl font-bold transition-colors ${isActive ? 'text-orange-500' : 'text-slate-300 hover:text-white'}`}
      >
        <Icon size={22} className={isActive ? 'text-orange-500' : ''} />
        {label}
      </Link>
    );
  };

  // En móvil la barra mantiene siempre la misma altura; en escritorio no se retrae ni anima al hacer scroll
  const navPadding = 'py-4 md:py-6';
  const navBg = isScrolled ? 'bg-slate-950/95 md:bg-slate-950/80 backdrop-blur-xl border-b border-white/5 shadow-2xl' : 'bg-transparent';
  const navHeight = 'min-h-[64px] md:min-h-0';

  return (
    <nav className={`fixed top-0 left-0 w-full z-50 ${navHeight} ${navPadding} ${navBg}`}>
      <div className="max-w-7xl mx-auto px-6 flex justify-between items-center h-full min-h-[64px] md:min-h-0">
        
        <div className="flex items-center gap-2">
          <Link href="/" className="text-2xl font-black tracking-tighter text-white group">
            TDF<span className="text-orange-600 group-hover:text-orange-500 transition-colors duration-300 drop-shadow-[0_0_10px_rgba(234,88,12,0.5)]">FILM</span>
          </Link>
          {/* Easter egg: icono átomo casi invisible, enlace a /nodos (solo escritorio) */}
          <Link
            href="/nodos"
            className="hidden md:flex items-center justify-center opacity-[0.12] hover:opacity-30 transition-opacity duration-300 text-white rounded-full p-1 hover:ring-1 hover:ring-white/20"
            title="Nodos 3D"
            aria-label="Nodos 3D"
          >
            <Atom size={20} strokeWidth={1.5} />
          </Link>
        </div>

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
                    {user.nombre?.split(' ')[0] ?? 'Usuario'}
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

                        {user.role === 'admin' && (
                          <>
                            <div className="h-px bg-slate-800 my-2 mx-4"></div>
                            <p className="px-4 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Admin</p>
                            <Link href="/admin/panel" onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition">
                              <Shield size={18} className="text-amber-500"/> Panel Admin
                            </Link>
                            <Link href="/admin/dashboard" onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition">
                              <MapPin size={18} className="text-cyan-500"/> Nodos 3D
                            </Link>
                          </>
                        )}
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
      
      {/* MENÚ MÓVIL: overlay completo bajo la barra, z-index alto para no superponerse con login/contenido */}
      {isMobileMenuOpen && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[45]" onClick={() => setIsMobileMenuOpen(false)} aria-hidden />
          <div className="md:hidden fixed top-16 left-0 right-0 bottom-0 z-[48] bg-slate-950 overflow-y-auto flex flex-col animate-in slide-in-from-right duration-300">
            {/* Botón cerrar menú bien visible arriba */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 shrink-0">
              <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Menú</span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-sm font-bold text-slate-400 uppercase tracking-widest hover:text-slate-200 transition-colors"
                aria-label="Cerrar menú"
              >
                Cerrar
              </button>
            </div>
            <div className="p-6 flex flex-col gap-6">
            {/* Enlaces principales: mismo criterio de activo que en desktop */}
            <MobileNavLink href="/locaciones" pathname={pathname} onClick={() => setIsMobileMenuOpen(false)} icon={MapPin} label="Locaciones" />
            <MobileNavLink href="/guia" pathname={pathname} onClick={() => setIsMobileMenuOpen(false)} icon={Users} label="Prestadores" />
            <MobileNavLink href="/proyectos" pathname={pathname} onClick={() => setIsMobileMenuOpen(false)} icon={Clapperboard} label="Proyectos" />

            {user?.role === 'admin' && (
              <>
                <div className="h-px bg-slate-700 my-2" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Admin</p>
                <MobileNavLink href="/admin/panel" pathname={pathname} onClick={() => setIsMobileMenuOpen(false)} icon={Shield} label="Panel Admin" />
                {/* Nodos 3D solo en escritorio; en móvil no se muestra */}
              </>
            )}

            <div className="h-px bg-slate-800 my-2"></div>

            {user ? (
              <>
                <div className="flex items-center gap-3 mb-4 bg-slate-900 p-4 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center text-white font-bold">{user.nombre?.[0] ?? 'U'}</div>
                  <div><p className="font-bold text-white">{user.nombre}</p><p className="text-xs text-slate-500">{user.email}</p></div>
                </div>
                <MobileNavLink href="/mis-proyectos" pathname={pathname} onClick={() => setIsMobileMenuOpen(false)} icon={Film} label="Mis Proyectos" />
                <MobileNavLink href="/mis-postulaciones" pathname={pathname} onClick={() => setIsMobileMenuOpen(false)} icon={Briefcase} label="Mis Postulaciones" />
                <MobileNavLink href="/mis-perfiles/solicitudes" pathname={pathname} onClick={() => setIsMobileMenuOpen(false)} icon={Inbox} label="Solicitudes Recibidas" />
                <MobileNavLink href="/mi-perfil" pathname={pathname} onClick={() => setIsMobileMenuOpen(false)} icon={User} label="Mi Perfil" />
                <MobileNavLink href="/mi-cuenta" pathname={pathname} onClick={() => setIsMobileMenuOpen(false)} icon={Shield} label="Mi Cuenta" />
                <button onClick={handleLogout} className="text-lg text-red-500 font-bold mt-4 flex items-center gap-2"><LogOut size={18}/> Cerrar Sesión</button>
              </>
            ) : (
              <div className="flex flex-col gap-4">
                <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="text-center w-full py-4 rounded-xl border border-slate-700 text-white font-bold">Ingresar</Link>
                <Link href="/registro" onClick={() => setIsMobileMenuOpen(false)} className="text-center w-full py-4 rounded-xl bg-orange-600 text-white font-bold">Registrarse</Link>
              </div>
            )}
            </div>
          </div>
        </>
      )}
    </nav>
  );
}