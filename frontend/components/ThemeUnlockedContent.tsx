'use client';

import { useEffect } from 'react';
import { useThemeUnlocked } from '@/contexts/ThemeUnlockedContext';
import dynamic from 'next/dynamic';

const Anycolour = dynamic(() => import('@/components/anycolour'), { ssr: false });

const THEME_UNLOCKED_REQUEST_PLAY = 'theme-unlocked-request-play';

export default function ThemeUnlockedContent({ children }: { children: React.ReactNode }) {
  const ctx = useThemeUnlocked();
  const themeUnlocked = ctx?.themeUnlocked ?? false;

  // Al mostrar la vista Anycolour, pedir al Navbar que reproduzca (por si el primer play fue bloqueado por el navegador)
  useEffect(() => {
    if (!themeUnlocked) return;
    const fire = () => window.dispatchEvent(new CustomEvent(THEME_UNLOCKED_REQUEST_PLAY));
    fire();
    const t1 = setTimeout(fire, 150);
    const t2 = setTimeout(fire, 500);
    const t3 = setTimeout(fire, 1000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [themeUnlocked]);

  if (themeUnlocked) {
    return (
      <div className="fixed inset-0 z-[50] flex flex-col min-h-screen">
        <Anycolour />
      </div>
    );
  }
  return <>{children}</>;
}
