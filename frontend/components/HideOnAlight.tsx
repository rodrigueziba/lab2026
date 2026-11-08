'use client';

import { usePathname } from 'next/navigation';

/**
 * No renderiza sus hijos en /alight ni en sus subrutas (experiencia inmersiva).
 * Los hijos ni se montan: sus efectos (p. ej. el flag de "ya visitó" del
 * WelcomeTour en localStorage) no corren en esa ruta.
 */
export default function HideOnAlight({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/alight' || pathname?.startsWith('/alight/')) return null;
  return <>{children}</>;
}
