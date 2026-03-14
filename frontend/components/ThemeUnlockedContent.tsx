'use client';

import { useEffect, useState, useRef } from 'react';
import { useThemeUnlocked } from '@/contexts/ThemeUnlockedContext';
import dynamic from 'next/dynamic';

const Anycolour = dynamic(() => import('@/components/anycolour'), { ssr: false });

const THEME_UNLOCKED_REQUEST_PLAY = 'theme-unlocked-request-play';

// Scroll: arriba = más velocidad, paleta hacia arriba (índice +1), más RGB shift. Abajo = menos velocidad, paleta hacia abajo, menos shift.
const SPEED_STEP = 0.04;
const SPEED_MIN = 0.35;
const SPEED_MAX = 2.2;
const PALETTE_SIZE = 7;
const RGB_SHIFT_STEP = 0.25;
const RGB_SHIFT_MIN = 0;
const RGB_SHIFT_MAX = 5;

export default function ThemeUnlockedContent({ children }: { children: React.ReactNode }) {
  const ctx = useThemeUnlocked();
  const themeUnlocked = ctx?.themeUnlocked ?? false;
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [rgbShiftAmount, setRgbShiftAmount] = useState(0);

  // Al mostrar la vista Anycolour, pedir al Navbar que reproduzca
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

  // Rueda del mouse / trackpad: la vista es fixed y no hace scroll, así que usamos wheel
  useEffect(() => {
    if (!themeUnlocked) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) {
        setSpeedMultiplier((prev) => Math.min(SPEED_MAX, prev + SPEED_STEP));
        setPaletteIndex((prev) => (prev + 1) % PALETTE_SIZE);
        setRgbShiftAmount((prev) => Math.min(RGB_SHIFT_MAX, prev + RGB_SHIFT_STEP));
      } else if (e.deltaY > 0) {
        setSpeedMultiplier((prev) => Math.max(SPEED_MIN, prev - SPEED_STEP));
        setPaletteIndex((prev) => (prev - 1 + PALETTE_SIZE) % PALETTE_SIZE);
        setRgbShiftAmount((prev) => Math.max(RGB_SHIFT_MIN, prev - RGB_SHIFT_STEP));
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [themeUnlocked]);

  if (themeUnlocked) {
    return (
      <div className="fixed inset-0 z-[50] flex flex-col min-h-screen">
        <Anycolour
          backgroundOnly={false}
          speedMultiplier={speedMultiplier}
          easterEggPaletteIndex={paletteIndex}
          easterEggRgbShift={rgbShiftAmount}
        />
      </div>
    );
  }
  return <>{children}</>;
}
