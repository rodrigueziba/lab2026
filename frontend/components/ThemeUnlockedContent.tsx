'use client';

import { useEffect, useState, useRef } from 'react';
import { useThemeUnlocked } from '@/contexts/ThemeUnlockedContext';
import dynamic from 'next/dynamic';

const Anycolour = dynamic(() => import('@/components/anycolour'), { ssr: false });

const THEME_UNLOCKED_REQUEST_PLAY = 'theme-unlocked-request-play';
const RGB_SHIFT_MIN = 0;
const RGB_SHIFT_MAX = 12;
const RGB_SHIFT_SCROLL_SENSITIVITY = 0.15;

export default function ThemeUnlockedContent({ children }: { children: React.ReactNode }) {
  const ctx = useThemeUnlocked();
  const themeUnlocked = ctx?.themeUnlocked ?? false;
  const [rgbShift, setRgbShift] = useState(0);
  const scrollYRef = useRef(0);

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

  // RGB shift según scroll: scroll arriba aumenta, scroll abajo disminuye (solo en vista easter egg)
  useEffect(() => {
    if (!themeUnlocked) return;
    const handleScroll = () => {
      const y = window.scrollY;
      const delta = y - scrollYRef.current;
      scrollYRef.current = y;
      setRgbShift((prev) => {
        const next = prev - delta * RGB_SHIFT_SCROLL_SENSITIVITY;
        return Math.max(RGB_SHIFT_MIN, Math.min(RGB_SHIFT_MAX, next));
      });
    };
    scrollYRef.current = window.scrollY;
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [themeUnlocked]);

  if (themeUnlocked) {
    const amount = Math.max(0, rgbShift);
    return (
      <div className="fixed inset-0 z-[50] flex flex-col min-h-screen">
        <svg className="absolute w-0 h-0" aria-hidden>
          <defs>
            <filter id="theme-rgb-shift" colorInterpolationFilters="sRGB">
              <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
              <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
              <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
              <feOffset in="r" dx={amount} dy="0" result="ro" />
              <feOffset in="b" dx={-amount} dy="0" result="bo" />
              <feBlend in="ro" in2="g" mode="normal" result="rg" />
              <feBlend in="rg" in2="bo" mode="normal" />
            </filter>
          </defs>
        </svg>
        <div
          className="w-full h-full"
          style={{ filter: amount > 0.5 ? `url(#theme-rgb-shift)` : 'none' }}
        >
          <Anycolour />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
