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

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const isLanding = pathname === '/';
  const isLogin = pathname === '/login';
  if (isLanding && isMobile) return null;
  if (isLogin && !isMobile) return null;

  return <Footer />;
}
