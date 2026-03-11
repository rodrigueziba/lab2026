'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const SECTIONS = ['/locaciones', '/guia', '/proyectos'];
const DESKTOP_BREAKPOINT = 768;

export default function PageTransitionWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Prefetch de las otras secciones al estar en una de ellas (solo desktop), para que el cache + navegación sean rápidos
  useEffect(() => {
    if (!isDesktop) return;
    const current = SECTIONS.find((s) => pathname === s || pathname.startsWith(s + '/'));
    if (!current) return;
    SECTIONS.forEach((route) => {
      if (route !== current) router.prefetch(route);
    });
  }, [pathname, isDesktop, router]);

  return <>{children}</>;
}
