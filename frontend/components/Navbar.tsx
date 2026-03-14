'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Menu, X, ChevronDown, LogOut, Film, User, 
  Briefcase, MapPin, Users, Clapperboard, Bell, Shield, Inbox, Atom, Info, Globe,
  Play, Pause, SkipForward
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useThemeUnlocked } from '@/contexts/ThemeUnlockedContext';
import { usePrestadorVisit } from '@/contexts/PrestadorVisitContext';

const RAINBOW_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

// Orden fijo del easter egg: anycolour → echoes → music
const NAVBAR_MP3_FILES = ['anycolour.mp3', 'echoes.mp3', 'music.mp3'];
const THEME_UNLOCK_HOVER_MS = 60000; // 1 minuto de hover para desbloquear tema + música
const WAVE_COLOR_INTERVAL_MS = 3200; // Cambio de color lento tipo olas (solo cuando themeUnlocked)

function getYoutubeVideoId(url: string | null): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();
  const patterns = [/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/, /[?&]v=([a-zA-Z0-9_-]{11})/];
  for (const re of patterns) {
    const m = u.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale, setLocale, t } = useLanguage();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notificaciones, setNotificaciones] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [user, setUser] = useState<any>(null);
  const [tienePerfilPrestador, setTienePerfilPrestador] = useState<boolean | null>(null);
  const [userBlockHover, setUserBlockHover] = useState(false);
  const [beamColorIndex, setBeamColorIndex] = useState(0);
  const [userGlowProgress, setUserGlowProgress] = useState(0); // 0 = recién hover, 1 = 60s
  const themeCtx = useThemeUnlocked();
  const themeUnlocked = themeCtx?.themeUnlocked ?? false;
  const setThemeUnlocked = themeCtx?.setThemeUnlocked ?? (() => {});
  const prestadorVisit = usePrestadorVisit();
  const musicaYoutubeUrl = prestadorVisit?.musicaYoutubeUrl ?? null;
  const isOnPrestadorPage = pathname?.startsWith('/prestador/') && pathname !== '/prestador';
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [prestadorMusicPlaying, setPrestadorMusicPlaying] = useState(false);
  const [playlistIndex, setPlaylistIndex] = useState(0);
  const [playlist] = useState(() => [...NAVBAR_MP3_FILES]);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const mobileMenuPanelRef = useRef<HTMLDivElement>(null);
  const userHoverStartRef = useRef<number>(0);
  const userLastColorAdvanceRef = useRef<number>(0);
  const themeWaveColorRef = useRef<number>(0);
  const [wavePhase, setWavePhase] = useState(0); // 0..1 para olas de gradiente cuando themeUnlocked
  const lastScrollYRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mobileNavVisible, setMobileNavVisible] = useState(true);

  // Al abrir el menú móvil, resetear scroll del panel para evitar hueco cuando la página estaba scrolleada
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const el = mobileMenuPanelRef.current;
    if (el) {
      el.scrollTop = 0;
      const t = requestAnimationFrame(() => { el.scrollTop = 0; });
      return () => cancelAnimationFrame(t);
    }
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setIsScrolled(y > 20);
      if (window.innerWidth < 768) {
        const delta = 8;
        if (y > lastScrollYRef.current + delta) setMobileNavVisible(false);
        else if (y < lastScrollYRef.current - delta || y < 30) setMobileNavVisible(true);
        lastScrollYRef.current = y;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    const checkUser = async () => {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');

      if (!token || !userStr) {
        setUser(null);
        setTienePerfilPrestador(null);
        setNotificaciones([]);
        setUnreadCount(0);
        return;
      }

      try {
        const res = await fetch(`${apiUrl}/notificacion`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
          setTienePerfilPrestador(null);
          setNotificaciones([]);
          setUnreadCount(0);
          return;
        }
        setUser(JSON.parse(userStr));
        if (res.ok) {
          const data = await res.json();
          setNotificaciones(Array.isArray(data) ? data : []);
          setUnreadCount((Array.isArray(data) ? data : []).filter((n: any) => !n.leida).length);
        } else {
          setNotificaciones([]);
        }
        const perfilesRes = await fetch(`${apiUrl}/prestador/mis-perfiles`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (perfilesRes.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
          setTienePerfilPrestador(null);
          setNotificaciones([]);
          setUnreadCount(0);
          return;
        }
        if (perfilesRes.ok) {
          const perfiles = await perfilesRes.json();
          setTienePerfilPrestador(Array.isArray(perfiles) && perfiles.length > 0);
        } else {
          setTienePerfilPrestador(false);
        }
      } catch (error) {
        setNotificaciones([]);
        setUnreadCount(0);
        setTienePerfilPrestador(null);
      }
    };
    
    checkUser();
    window.addEventListener('storage', checkUser);
    const interval = setInterval(checkUser, 30000);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('storage', checkUser);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileNavVisible(true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Con el menú hamburguesa abierto, mantener la barra visible para poder cerrar
  useEffect(() => {
    if (isMobileMenuOpen) setMobileNavVisible(true);
  }, [isMobileMenuOpen]);

  // En /locaciones el scroll es del contenedor interno, no de window: la página emite este evento para ocultar/mostrar la barra al bajar/subir
  useEffect(() => {
    const handler = (e: CustomEvent<{ visible: boolean }>) => {
      if (typeof e.detail?.visible === 'boolean') setMobileNavVisible(e.detail.visible);
    };
    window.addEventListener('tdffilm-mobile-nav-visibility', handler as EventListener);
    return () => window.removeEventListener('tdffilm-mobile-nav-visibility', handler as EventListener);
  }, []);

  // Al salir de /locaciones volver a mostrar la barra superior en móvil
  useEffect(() => {
    if (pathname !== '/locaciones' && typeof window !== 'undefined' && window.innerWidth < 768) setMobileNavVisible(true);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsUserMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setIsNotifOpen(false);
      if (langRef.current && !langRef.current.contains(event.target as Node)) setIsLangOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isMobileMenuOpen]);

  // Bloque usuario: brillo con transición suave; a más tiempo hover, más rápido el cambio de color y más brillo. A 1 min (solo escritorio) se desbloquea tema + música y pasan a ondas lentas.
  useEffect(() => {
    if (themeUnlocked) return;
    if (!userBlockHover) {
      setUserGlowProgress(0);
      return;
    }
    userHoverStartRef.current = Date.now();
    userLastColorAdvanceRef.current = Date.now();

    const tick = () => {
      const now = Date.now();
      const elapsed = now - userHoverStartRef.current;
      const progress = Math.min(elapsed / THEME_UNLOCK_HOVER_MS, 1);

      setUserGlowProgress(progress);

      if (progress >= 1 && typeof window !== 'undefined' && window.innerWidth >= 768) {
        setUserGlowProgress(1);
        setThemeUnlocked(true);
        return;
      }

      const intervalMs = 650 * (1 - progress * 0.82) + 120;
      if (now - userLastColorAdvanceRef.current >= intervalMs) {
        userLastColorAdvanceRef.current = now;
        setBeamColorIndex((i) => (i + 1) % RAINBOW_COLORS.length);
      }
    };

    tick();
    const t = setInterval(tick, 100);
    return () => clearInterval(t);
  }, [userBlockHover, themeUnlocked]);

  // Cuando themeUnlocked: cambio de color lento tipo olas + fase de onda para gradiente (solo escritorio)
  useEffect(() => {
    if (!themeUnlocked || typeof window === 'undefined' || window.innerWidth < 768) return;
    const colorInterval = setInterval(() => {
      themeWaveColorRef.current = (themeWaveColorRef.current + 1) % RAINBOW_COLORS.length;
      setBeamColorIndex(themeWaveColorRef.current);
    }, WAVE_COLOR_INTERVAL_MS);
    const waveInterval = setInterval(() => {
      setWavePhase((p) => (p + 0.02) % 1);
    }, 80);
    return () => {
      clearInterval(colorInterval);
      clearInterval(waveInterval);
    };
  }, [themeUnlocked]);

  // Audio: reproducir lista en orden fijo (anycolour → echoes → music); solo escritorio cuando themeUnlocked
  useEffect(() => {
    if (!themeUnlocked || typeof window === 'undefined' || window.innerWidth < 768) return;
    const audio = new Audio(`/${playlist[playlistIndex]}`);
    audioRef.current = audio;
    const play = () => {
      audio.play().then(() => setMusicPlaying(true)).catch(() => setMusicPlaying(false));
    };
    play();
    // Garantizar que empiece a reproducir al cambiar a la vista Anycolour (retry por si el primer play fue bloqueado)
    const t1 = setTimeout(play, 200);
    const t2 = setTimeout(play, 600);
    const onEnded = () => {
      const next = (playlistIndex + 1) % playlist.length;
      setPlaylistIndex(next);
    };
    const onPause = () => setMusicPlaying(false);
    const onPlay = () => setMusicPlaying(true);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      audio.pause();
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
      audioRef.current = null;
    };
  }, [themeUnlocked, playlistIndex, playlist]);

  // Al cambiar a la vista Anycolour se dispara este evento; forzar play() para garantizar reproducción
  useEffect(() => {
    const onRequestPlay = () => {
      if (audioRef.current) {
        audioRef.current.play().then(() => setMusicPlaying(true)).catch(() => setMusicPlaying(false));
      }
    };
    window.addEventListener('theme-unlocked-request-play', onRequestPlay);
    return () => window.removeEventListener('theme-unlocked-request-play', onRequestPlay);
  }, []);

  const handleMusicPlayPause = () => {
    const a = audioRef.current;
    if (!a) return;
    if (musicPlaying) a.pause();
    else a.play();
  };

  const handleNextTrack = () => {
    setPlaylistIndex((i) => (i + 1) % playlist.length);
  };

  const prestadorVideoId = getYoutubeVideoId(musicaYoutubeUrl);
  const showPrestadorMusic = isOnPrestadorPage && prestadorVideoId && typeof window !== 'undefined' && window.innerWidth >= 768;

  const handlePrestadorMusicPlayPause = () => {
    setPrestadorMusicPlaying((p) => !p);
  };

  // Auto-play música del prestador al visitar su perfil (solo escritorio)
  useEffect(() => {
    const onPrestadorWithMusic = isOnPrestadorPage && !!prestadorVideoId && typeof window !== 'undefined' && window.innerWidth >= 768;
    if (onPrestadorWithMusic) setPrestadorMusicPlaying(true);
    else setPrestadorMusicPlaying(false);
  }, [pathname, musicaYoutubeUrl]);

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
        className={`flex items-center gap-3 text-xl font-bold transition-colors min-h-[44px] py-3 touch-manipulation ${isActive ? 'text-orange-500' : 'text-slate-300 hover:text-white'}`}
      >
        <Icon size={22} className={isActive ? 'text-orange-500' : ''} />
        {label}
      </Link>
    );
  };

  const navPadding = 'py-2.5 md:py-6';
  const navHeight = 'min-h-[52px] md:min-h-0';
  // Móvil: siempre glass cuando visible; se oculta al bajar scroll y reaparece al subir
  const mobileGlass = 'bg-black/20 backdrop-blur-xl border-b border-white/5';
  const mobileHiddenVisual = !mobileNavVisible ? 'opacity-0 -translate-y-full' : '';
  const mobilePointer = mobileNavVisible ? 'pointer-events-auto' : 'pointer-events-none';
  const mdBg = isScrolled ? 'md:bg-slate-950/95 md:backdrop-blur-xl md:border-b md:border-white/5 md:shadow-2xl' : 'md:bg-transparent md:backdrop-blur-none md:shadow-none md:border-b-0';

  return (
    <>
    <nav
      className={`fixed top-0 left-0 w-full z-[9999] md:z-[100] ${navHeight} ${navPadding} transition-all duration-300 ${mobileGlass} ${mobileHiddenVisual} ${mobilePointer} md:opacity-100 md:pointer-events-auto md:translate-y-0 md:bg-transparent md:backdrop-blur-none md:border-b-0 ${mdBg}`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex justify-between items-center h-full min-h-[48px] md:min-h-0 relative z-[9993]">
        
        <div className="flex items-center gap-2">
          <Link href="/" className="text-2xl font-black tracking-tighter text-white group">
            TDF<span className="text-orange-600 group-hover:text-orange-500 transition-colors duration-300 drop-shadow-[0_0_10px_rgba(234,88,12,0.5)]">FILM</span>
          </Link>
          {/* Easter egg: icono átomo, enlace a /nodos — hover brilla violeta */}
          <Link
            href="/nodos"
            className="hidden md:flex items-center justify-center opacity-[0.12] hover:opacity-100 transition-opacity duration-300 text-white hover:text-violet-400 rounded-full p-1 hover:ring-1 hover:ring-violet-400/60 hover:drop-shadow-[0_0_10px_rgba(139,92,246,0.9)]"
            title="Nodos 3D"
            aria-label="Nodos 3D"
          >
            <Atom size={20} strokeWidth={1.5} />
          </Link>
          {/* Controles de música (solo escritorio, visibles tras 1 min hover en usuario) */}
          {themeUnlocked && (
            <div className="hidden md:flex items-center gap-1">
              <button
                type="button"
                onClick={handleMusicPlayPause}
                className="flex items-center justify-center opacity-[0.12] hover:opacity-100 transition-opacity duration-300 text-white hover:text-emerald-400 rounded-full p-1.5 hover:ring-1 hover:ring-emerald-400/60"
                title={musicPlaying ? 'Pausar' : 'Reproducir'}
                aria-label={musicPlaying ? 'Pausar' : 'Reproducir'}
              >
                {musicPlaying ? <Pause size={20} strokeWidth={2} /> : <Play size={20} strokeWidth={2} />}
              </button>
              <button
                type="button"
                onClick={handleNextTrack}
                className="flex items-center justify-center opacity-[0.12] hover:opacity-100 transition-opacity duration-300 text-white hover:text-amber-400 rounded-full p-1.5 hover:ring-1 hover:ring-amber-400/60"
                title="Siguiente tema"
                aria-label="Siguiente tema"
              >
                <SkipForward size={20} strokeWidth={2} />
              </button>
            </div>
          )}
          {/* Música del perfil del prestador (solo escritorio, cuando se visita /prestador/[id] y tiene link) */}
          {showPrestadorMusic && (
            <div className="hidden md:flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrestadorMusicPlayPause}
                className="flex items-center justify-center opacity-[0.12] hover:opacity-100 transition-opacity duration-300 text-white hover:text-emerald-400 rounded-full p-1.5 hover:ring-1 hover:ring-emerald-400/60"
                title={prestadorMusicPlaying ? 'Pausar música del perfil' : 'Reproducir música del perfil'}
                aria-label={prestadorMusicPlaying ? 'Pausar música del perfil' : 'Reproducir música del perfil'}
              >
                {prestadorMusicPlaying ? <Pause size={20} strokeWidth={2} /> : <Play size={20} strokeWidth={2} />}
              </button>
            </div>
          )}
          {prestadorVideoId && prestadorMusicPlaying && (
            <iframe
              title="Música del perfil"
              src={`https://www.youtube.com/embed/${prestadorVideoId}?autoplay=1&loop=1&playlist=${prestadorVideoId}`}
              className="fixed w-0 h-0 opacity-0 pointer-events-none"
              allow="autoplay"
              allowFullScreen
            />
          )}
        </div>

        {/* Centro: Locaciones, Prestadores, Proyectos — z-[101] para quedar por encima del overlay de glow (z-[99]) y ser clickeables */}
        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-2 bg-black/20 backdrop-blur-sm p-1.5 rounded-full border border-white/5 z-[101]">
          <div id="tour-locaciones"><NavLink href="/locaciones" icon={MapPin} label={t('nav.locaciones')} /></div>
          <div id="tour-guia"><NavLink href="/guia" icon={Users} label={t('nav.prestadores')} /></div>
          <div id="tour-proyectos"><NavLink href="/proyectos" icon={Clapperboard} label={t('nav.proyectos')} /></div>
        </div>

        <div className="hidden md:flex items-center gap-4">
          {/* Selector de idioma */}
          <div className="relative" ref={langRef}>
            <button
              type="button"
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="flex items-center justify-center opacity-[0.12] hover:opacity-100 transition-opacity duration-300 text-white hover:text-cyan-400 rounded-full p-1.5 hover:ring-1 hover:ring-cyan-400/50"
              title={t('nav.idioma')}
              aria-label={t('nav.idioma')}
              aria-expanded={isLangOpen}
            >
              <Globe size={20} strokeWidth={2} />
            </button>
            {isLangOpen && (
              <div className="absolute right-0 mt-2 w-40 py-1 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-[100] animate-in fade-in zoom-in-95 duration-200">
                <button onClick={() => { setLocale('es'); setIsLangOpen(false); }} className={`w-full text-left px-4 py-2 text-sm font-medium transition ${locale === 'es' ? 'text-orange-400 bg-orange-500/10' : 'text-slate-300 hover:bg-slate-800'}`}>{t('nav.espanol')}</button>
                <button onClick={() => { setLocale('en'); setIsLangOpen(false); }} className={`w-full text-left px-4 py-2 text-sm font-medium transition ${locale === 'en' ? 'text-orange-400 bg-orange-500/10' : 'text-slate-300 hover:bg-slate-800'}`}>{t('nav.ingles')}</button>
              </div>
            )}
          </div>
          {/* Icono info */}
          <Link
            href="/info"
            className="hidden md:flex items-center justify-center opacity-[0.12] hover:opacity-100 transition-opacity duration-300 text-white hover:text-blue-400 rounded-full p-1 hover:ring-1 hover:ring-blue-400/50 hover:drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]"
            title={t('nav.info')}
            aria-label={t('nav.info')}
          >
            <Info size={20} strokeWidth={2} />
          </Link>
          {user ? (
            <div className="flex items-center gap-4">
                
                {/* 🔔 CAMPANITA DE NOTIFICACIONES */}
                <div className="relative" ref={notifRef}>
                    <button 
                        onClick={() => setIsNotifOpen(!isNotifOpen)}
                        className="relative min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-slate-400 hover:text-yellow-400 transition rounded-full hover:bg-white/10 hover:drop-shadow-[0_0_12px_rgba(250,204,21,0.95)]"
                        aria-label={unreadCount > 0 ? t('nav.notifications_unread', { count: unreadCount }) : t('nav.notifications')}
                    >
                        <Bell size={20}/>
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-950 animate-pulse"></span>
                        )}
                    </button>

                    {isNotifOpen && (
                        <div className="absolute right-0 mt-4 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('nav.notifications')}</span>
                                {unreadCount > 0 && <span className="text-xs bg-red-500 text-white px-1.5 rounded font-bold">{unreadCount}</span>}
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                {notificaciones.length === 0 ? (
                                    <div className="p-6 text-center text-slate-500 text-sm">{t('nav.no_notifications')}</div>
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

                {/* MENU USUARIO — hover: brillo extendido; cambio de color suave; a más tiempo, más rápido y más luz (1 min = ilumina pantalla) */}
                <div className="relative" ref={dropdownRef}>
                {((userBlockHover && userGlowProgress > 0.12) || themeUnlocked) && (
                  <div
                    className="fixed inset-0 pointer-events-none z-[99] transition-opacity duration-500"
                    style={{
                      opacity: themeUnlocked
                        ? 0.5 + 0.25 * (0.5 + 0.5 * Math.sin(wavePhase * Math.PI * 2))
                        : Math.min(1, (userGlowProgress - 0.12) / 0.88) * (0.5 + 0.5 * userGlowProgress),
                      background: (() => {
                        const c = RAINBOW_COLORS[beamColorIndex];
                        const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
                        const progress = themeUnlocked ? 1 : userGlowProgress;
                        const radius = themeUnlocked
                          ? 120 + 280 * (0.5 + 0.5 * Math.sin(wavePhase * Math.PI * 2))
                          : 60 + 340 * progress;
                        return `radial-gradient(circle at 85% 50%, rgba(${r},${g},${b},${themeUnlocked ? 0.35 + 0.15 * Math.sin(wavePhase * Math.PI * 2) : 0.12 + 0.5 * progress}) 0%, transparent ${radius}%)`;
                      })(),
                    }}
                    aria-hidden
                  />
                )}
                <div
                  className="relative min-w-0"
                  onMouseEnter={() => setUserBlockHover(true)}
                  onMouseLeave={() => setUserBlockHover(false)}
                >
                  <button
                    id="tour-user-menu"
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className={`relative flex items-center gap-3 border py-1.5 pl-1.5 pr-4 rounded-full duration-300 group ${isUserMenuOpen ? 'bg-slate-800 border-slate-600' : 'bg-transparent border-slate-800 hover:border-slate-600'}`}
                    style={{
                      transition: themeUnlocked ? 'border-color 2s ease, box-shadow 2s ease' : 'border-color 0.7s ease, box-shadow 0.7s ease',
                      ...((userBlockHover || themeUnlocked) ? (() => {
                        const c = RAINBOW_COLORS[beamColorIndex];
                        const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
                        const p = themeUnlocked ? 1 : userGlowProgress;
                        const spread = themeUnlocked ? 1.8 + 0.5 * Math.sin(wavePhase * Math.PI * 2) : 1 + p * 2.5;
                        const op1 = themeUnlocked ? 0.5 : 0.75 + p * 0.25;
                        const op2 = themeUnlocked ? 0.4 : 0.6 + p * 0.35;
                        const op3 = themeUnlocked ? 0.25 : 0.4 + p * 0.5;
                        return {
                          borderColor: c,
                          boxShadow: `0 0 ${24 * spread}px ${c}, 0 0 ${48 * spread}px rgba(${r},${g},${b},${op1}), 0 0 ${90 * spread}px rgba(${r},${g},${b},${op2}), 0 0 ${140 * spread}px rgba(${r},${g},${b},${op3})`,
                        };
                      })() : {}),
                    }}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-600 to-red-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shrink-0">
                    {user.nombre ? user.nombre[0].toUpperCase() : 'U'}
                    </div>
                    <span className="text-sm font-bold text-slate-300 group-hover:text-white truncate max-w-[100px]">
                    {user.nombre?.split(' ')[0] ?? 'Usuario'}
                    </span>
                    <ChevronDown size={14} className={`text-slate-500 transition-transform shrink-0 ${isUserMenuOpen ? 'rotate-180 text-white' : ''}`}/>
                  </button>
                </div>

                {isUserMenuOpen && (
                    <div className="absolute right-0 mt-4 w-72 bg-slate-900 border border-slate-800 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 ring-1 ring-white/10">
                    <div className="px-6 py-5 border-b border-slate-800 bg-slate-950/50">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Sesión activa</p>
                        <p className="text-base font-bold text-white truncate">{user.email}</p>
                    </div>

                    <div className="p-3 space-y-1">
                        {tienePerfilPrestador === false && (
                          <Link href="/registro-prestador" onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-400 font-bold text-sm hover:bg-orange-500/30 transition mb-2">
                            ¡Aún no apareces en la Guía! Creá tu perfil de prestador ahora →
                          </Link>
                        )}
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
               <Link href={pathname ? `/login?redirect=${encodeURIComponent(pathname)}` : '/login'} className="text-sm font-bold text-slate-300 hover:text-white transition hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">Ingresar</Link>
               <Link href="/registro" className="bg-white text-black hover:bg-slate-200 px-6 py-2.5 rounded-full text-sm font-black transition transform hover:scale-105 shadow-[0_0_15px_rgba(255,255,255,0.2)]">Registrarse</Link>
            </div>
          )}
        </div>

        <button
          type="button"
          className="md:hidden relative z-[110] text-white min-w-[44px] min-h-[44px] flex items-center justify-center p-2 -m-2 touch-manipulation"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-expanded={isMobileMenuOpen}
          aria-label={isMobileMenuOpen ? t('nav.cerrar_menu') : t('nav.abrir_menu')}
        >
          {isMobileMenuOpen ? <X size={28}/> : <Menu size={28}/>}
        </button>

      </div>
      
      {/* MENÚ MÓVIL: dropdown bajo la barra (no full-screen); altura limitada para no tapar cabeceras */}
      {isMobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-[9990] bg-black/30"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden
          />
          <div
            ref={mobileMenuPanelRef}
            className="md:hidden absolute top-full left-0 right-0 z-[9992] max-h-[65vh] overflow-y-auto overflow-x-hidden border-b border-slate-700/80 bg-slate-900/98 backdrop-blur-xl shadow-2xl animate-in slide-in-from-top-2 duration-200"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="p-4 flex flex-col gap-1">
              {user?.role === 'admin' && (
                <>
                  <p className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Admin</p>
                  <MobileNavLink href="/admin/panel" pathname={pathname} onClick={() => setIsMobileMenuOpen(false)} icon={Shield} label={t('nav.panel_admin')} />
                  <div className="h-px bg-slate-700 my-1" />
                </>
              )}
              {user ? (
                <>
                  {tienePerfilPrestador === false && (
                    <Link href="/registro-prestador" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-400 font-bold text-sm min-h-[44px]">
                      {t('nav.crear_perfil_prestador')}
                    </Link>
                  )}
                  <div className="flex items-center gap-3 py-2 px-2 rounded-xl bg-slate-800/50">
                    <div className="w-9 h-9 rounded-full bg-orange-600 flex items-center justify-center text-white font-bold text-sm">{user.nombre?.[0] ?? 'U'}</div>
                    <div className="min-w-0"><p className="font-bold text-white truncate text-sm">{user.nombre}</p><p className="text-xs text-slate-500 truncate">{user.email}</p></div>
                  </div>
                  <MobileNavLink href="/mis-proyectos" pathname={pathname} onClick={() => setIsMobileMenuOpen(false)} icon={Film} label={t('nav.mis_proyectos')} />
                  <MobileNavLink href="/mis-postulaciones" pathname={pathname} onClick={() => setIsMobileMenuOpen(false)} icon={Briefcase} label={t('nav.mis_postulaciones')} />
                  <MobileNavLink href="/mis-perfiles/solicitudes" pathname={pathname} onClick={() => setIsMobileMenuOpen(false)} icon={Inbox} label={t('nav.solicitudes_recibidas')} />
                  <MobileNavLink href="/mi-perfil" pathname={pathname} onClick={() => setIsMobileMenuOpen(false)} icon={User} label={t('nav.mi_perfil')} />
                  <Link href="/notificaciones" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 text-xl font-bold transition-colors min-h-[44px] py-3 px-4 touch-manipulation text-slate-300 hover:text-white">
                    <Bell size={22} className={pathname === '/notificaciones' ? 'text-orange-500' : ''} />
                    {t('nav.notifications')}
                    {unreadCount > 0 && (
                      <span className="ml-auto w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Link>
                  <MobileNavLink href="/mi-cuenta" pathname={pathname} onClick={() => setIsMobileMenuOpen(false)} icon={Shield} label={t('nav.mi_cuenta')} />
                  <div className="h-px bg-slate-700 my-1" />
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('nav.idioma')}</span>
                    <span className="flex gap-1">
                      <button onClick={() => { setLocale('es'); }} className={`px-2 py-1 rounded text-xs font-bold ${locale === 'es' ? 'bg-orange-500/30 text-orange-400 border border-orange-500/50' : 'text-slate-500 hover:text-white border border-slate-700'}`}>ES</button>
                      <button onClick={() => { setLocale('en'); }} className={`px-2 py-1 rounded text-xs font-bold ${locale === 'en' ? 'bg-orange-500/30 text-orange-400 border border-orange-500/50' : 'text-slate-500 hover:text-white border border-slate-700'}`}>EN</button>
                    </span>
                  </div>
                  <div className="h-px bg-slate-700 my-1" />
                  <MobileNavLink href="/info" pathname={pathname} onClick={() => setIsMobileMenuOpen(false)} icon={Info} label={t('nav.info')} />
                  <MobileNavLink href="/nodos" pathname={pathname} onClick={() => setIsMobileMenuOpen(false)} icon={Atom} label={t('nav.nodos')} />
                  <button onClick={handleLogout} className="text-left text-red-400 font-bold py-3 px-4 flex items-center gap-2 text-sm mt-1"><LogOut size={18}/> {t('nav.cerrar_sesion')}</button>
                </>
              ) : (
                <>
                  <div className="h-px bg-slate-700 my-1" />
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('nav.idioma')}</span>
                    <span className="flex gap-1">
                      <button onClick={() => setLocale('es')} className={`px-2 py-1 rounded text-xs font-bold ${locale === 'es' ? 'bg-orange-500/30 text-orange-400 border border-orange-500/50' : 'text-slate-500 hover:text-white border border-slate-700'}`}>ES</button>
                      <button onClick={() => setLocale('en')} className={`px-2 py-1 rounded text-xs font-bold ${locale === 'en' ? 'bg-orange-500/30 text-orange-400 border border-orange-500/50' : 'text-slate-500 hover:text-white border border-slate-700'}`}>EN</button>
                    </span>
                  </div>
                  <div className="h-px bg-slate-700 my-1" />
                  <MobileNavLink href="/info" pathname={pathname} onClick={() => setIsMobileMenuOpen(false)} icon={Info} label={t('nav.info')} />
                  <MobileNavLink href="/nodos" pathname={pathname} onClick={() => setIsMobileMenuOpen(false)} icon={Atom} label={t('nav.nodos')} />
                  <div className="flex flex-col gap-2 pt-2">
                    <Link href={pathname ? `/login?redirect=${encodeURIComponent(pathname)}` : '/login'} onClick={() => setIsMobileMenuOpen(false)} className="text-center w-full py-3 rounded-xl border border-slate-600 text-white font-bold text-sm">{t('nav.ingresar')}</Link>
                    <Link href="/registro" onClick={() => setIsMobileMenuOpen(false)} className="text-center w-full py-3 rounded-xl bg-orange-600 text-white font-bold text-sm">{t('nav.registrarse')}</Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </nav>

    {/* Barra inferior móvil: Locaciones, Guía, Proyectos — siempre visible (en /locaciones el scroll es interno, no window, y no debe quedar oculta) */}
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-[9998] flex justify-center pb-6 px-4">
      <div className="flex items-center gap-2 bg-black/20 backdrop-blur-xl p-1.5 rounded-full border border-white/5 shadow-xl">
        <Link
          href="/locaciones"
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-all duration-300 touch-manipulation ${pathname === '/locaciones' ? 'text-white bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.2)] border border-white/20' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
          aria-label={t('nav.locaciones')}
        >
          <MapPin size={22} className={pathname === '/locaciones' ? 'text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]' : ''} />
        </Link>
        <Link
          href="/guia"
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-all duration-300 touch-manipulation ${pathname === '/guia' ? 'text-white bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.2)] border border-white/20' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
          aria-label={t('nav.prestadores')}
        >
          <Users size={22} className={pathname === '/guia' ? 'text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]' : ''} />
        </Link>
        <Link
          href="/proyectos"
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-all duration-300 touch-manipulation ${pathname === '/proyectos' ? 'text-white bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.2)] border border-white/20' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
          aria-label={t('nav.proyectos')}
        >
          <Clapperboard size={22} className={pathname === '/proyectos' ? 'text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]' : ''} />
        </Link>
      </div>
    </div>
    </>
  );
}