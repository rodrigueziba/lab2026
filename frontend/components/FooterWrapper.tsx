'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Footer from './Footer';

/**
 * - En la landing ("/") y solo en móvil: no se muestra el Footer.
 * - En /login y solo en escritorio: no se muestra el Footer.
 * En el resto de casos el Footer se muestra.
 */
export default function FooterWrapper() {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const [loginImmersive, setLoginImmersive] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const h = (e: Event) => {
      const ce = e as CustomEvent<{ active?: boolean }>;
      if (pathname !== '/login') return;
      setLoginImmersive(!!ce.detail?.active);
    };
    window.addEventListener('login-immersive', h as EventListener);
    return () => window.removeEventListener('login-immersive', h as EventListener);
  }, [pathname]);
  useEffect(() => {
    if (pathname !== '/login') setLoginImmersive(false);
  }, [pathname]);

  const isLanding = pathname === '/';
  const isLogin = pathname === '/login';
  if (isLanding && isMobile) return null;
  if (isLogin && !isMobile) return null;
  if (isLogin && loginImmersive) return null;

  return <Footer />;
}
