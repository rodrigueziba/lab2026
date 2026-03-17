'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const IDLE_ACTIVATE_MS = 65 * 1000;   // 65 segundos → activar screensaver
const IDLE_INDICATOR_MS = 15 * 1000;  // 15 segundos → mostrar círculo en navbar
const TICK_MS = 200;                  // Actualizar progreso cada 200ms

type ScreensaverContextValue = {
  /** Solo escritorio (viewport >= 768) */
  isDesktop: boolean;
  /** Segundos sin interacción (desde último reset) */
  idleSeconds: number;
  /** 0 hasta 15s, luego 0..1 entre 15s y 65s (para llenar el círculo) */
  indicatorProgress: number;
  /** Screensaver a pantalla completa activo */
  isScreensaverActive: boolean;
  /** Activar manualmente el screensaver */
  activateScreensaver: () => void;
  /** Cerrar el screensaver y resetear idle */
  closeScreensaver: () => void;
  /** Resetear temporizador de inactividad (se llama en cada interacción) */
  resetIdle: () => void;
};

const ScreensaverContext = createContext<ScreensaverContextValue | null>(null);

const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'touchmove', 'wheel'] as const;

export function ScreensaverProvider({ children }: { children: React.ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [idleSeconds, setIdleSeconds] = useState(0);
  const [isScreensaverActive, setIsScreensaverActive] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetIdle = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (!isScreensaverActive) setIdleSeconds(0);
  }, [isScreensaverActive]);

  const closeScreensaver = useCallback(() => {
    setIsScreensaverActive(false);
    lastActivityRef.current = Date.now();
    setIdleSeconds(0);
  }, []);

  const activateScreensaver = useCallback(() => {
    if (isDesktop) setIsScreensaverActive(true);
  }, [isDesktop]);

  // Progreso para el círculo: 0 hasta 15s, luego lineal de 0 a 1 entre 15s y 65s
  const indicatorProgress = idleSeconds < 15 ? 0 : Math.min(1, (idleSeconds - 15) / (65 - 15));

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(typeof window !== 'undefined' && window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    const handler = () => {
      if (!isScreensaverActive) resetIdle();
    };
    events.forEach((ev) => window.addEventListener(ev, handler, { passive: true }));
    return () => events.forEach((ev) => window.removeEventListener(ev, handler));
  }, [isDesktop, isScreensaverActive, resetIdle]);

  useEffect(() => {
    if (!isDesktop || isScreensaverActive) return;
    tickRef.current = setInterval(() => {
      const elapsed = (Date.now() - lastActivityRef.current) / 1000;
      setIdleSeconds(elapsed);
      if (elapsed >= 65) {
        setIsScreensaverActive(true);
        if (tickRef.current) {
          clearInterval(tickRef.current);
          tickRef.current = null;
        }
      }
    }, TICK_MS);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [isDesktop, isScreensaverActive]);

  const value: ScreensaverContextValue = {
    isDesktop,
    idleSeconds,
    indicatorProgress,
    isScreensaverActive,
    activateScreensaver,
    closeScreensaver,
    resetIdle,
  };

  return (
    <ScreensaverContext.Provider value={value}>
      {children}
    </ScreensaverContext.Provider>
  );
}

export function useScreensaver() {
  const ctx = useContext(ScreensaverContext);
  return ctx;
}
