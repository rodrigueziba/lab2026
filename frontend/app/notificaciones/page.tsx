'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, ArrowLeft } from 'lucide-react';
import TdfFilmLoader from '@/components/TdfFilmLoader';
import { useLanguage } from '@/contexts/LanguageContext';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function NotificacionesPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [notificaciones, setNotificaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login?redirect=' + encodeURIComponent('/notificaciones'));
      return;
    }
    const fetchNotif = async () => {
      try {
        const res = await fetch(`${apiUrl}/notificacion`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 401) {
          router.push('/login?redirect=' + encodeURIComponent('/notificaciones'));
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setNotificaciones(Array.isArray(data) ? data : []);
        }
      } catch (_) {
        setNotificaciones([]);
      } finally {
        setLoading(false);
      }
    };
    fetchNotif();
  }, [router]);

  const handleClick = async (notif: any) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      await fetch(`${apiUrl}/notificacion/${notif.id}/leer`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotificaciones((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, leida: true } : n))
      );
      if (notif.link) router.push(notif.link);
    } catch (_) {}
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <TdfFilmLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pt-24 pb-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition"
        >
          <ArrowLeft size={18} /> Volver
        </Link>
        <h1 className="text-2xl font-black flex items-center gap-3 mb-6">
          <Bell className="text-orange-500" size={28} />
          {t('nav.notifications')}
        </h1>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {notificaciones.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              {t('nav.no_notifications')}
            </div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {notificaciones.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className={`w-full text-left p-4 hover:bg-slate-800/50 transition flex gap-3 ${!n.leida ? 'bg-slate-800/30' : ''}`}
                  >
                    <div
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${!n.leida ? 'bg-orange-500' : 'bg-transparent'}`}
                    />
                    <div className="min-w-0 flex-1">
                      <h2
                        className={`text-sm font-bold ${!n.leida ? 'text-white' : 'text-slate-400'}`}
                      >
                        {n.titulo}
                      </h2>
                      <p className="text-slate-500 text-sm mt-1 line-clamp-2">
                        {n.mensaje}
                      </p>
                      <p className="text-slate-600 text-xs mt-2">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
