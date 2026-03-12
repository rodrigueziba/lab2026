'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/contexts/LanguageContext';

const STORAGE_KEY_COMPLETED = 'tdffilm_tour_completed';
const STORAGE_KEY_GUEST_DATE = 'tdffilm_tour_guest_date';
const DESKTOP_BREAKPOINT = 768;
const DELAY_BEFORE_START_MS = 1500;

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

type Step = {
  target: string;
  placement: 'center' | 'bottom' | 'bottom-end';
  title: string;
  content: string;
};

function buildSteps(t: (k: string) => string): { guest: Step[]; logged: Step[] } {
  const welcome: Step = { target: 'body', placement: 'center', title: t('tour.welcome_title'), content: t('tour.welcome_content') };
  const userMenu: Step = { target: '#tour-user-menu', placement: 'bottom-end', title: t('tour.centro_mando'), content: t('tour.centro_content') };
  const proyectos: Step = { target: '#tour-proyectos', placement: 'bottom', title: t('tour.cartelera'), content: t('tour.cartelera_content') };
  const guia: Step = { target: '#tour-guia', placement: 'bottom', title: t('tour.guia_talento'), content: t('tour.guia_content') };
  const locaciones: Step = { target: '#tour-locaciones', placement: 'bottom', title: t('tour.locaciones'), content: t('tour.locaciones_content') };
  return {
    guest: [welcome, proyectos, guia, locaciones],
    logged: [welcome, userMenu, proyectos, guia, locaciones],
  };
}

export default function WelcomeTour() {
  const router = useRouter();
  const { t } = useLanguage();
  const [run, setRun] = useState(false);
  const [isGuest, setIsGuest] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const stepRef = useRef(0);
  const isGuestRef = useRef(true);
  const { guest: stepsGuest, logged: stepsLogged } = useMemo(() => buildSteps(t), [t]);
  const steps = isGuest ? stepsGuest : stepsLogged;

  const updateTargetRect = useCallback(() => {
    if (typeof document === 'undefined') return;
    const stepsList = isGuestRef.current ? stepsGuest : stepsLogged;
    const step = stepsList[stepRef.current];
    if (step.target === 'body') {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(step.target);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [stepsGuest, stepsLogged]);

  useEffect(() => {
    if (!run) return;
    stepRef.current = stepIndex;
    updateTargetRect();
    const onScrollOrResize = () => updateTargetRect();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    const t = requestAnimationFrame(updateTargetRect);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      cancelAnimationFrame(t);
    };
  }, [run, stepIndex, updateTargetRect]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    const isDesktop = window.innerWidth >= DESKTOP_BREAKPOINT;
    if (!isDesktop) return;

    const shouldRun = token
      ? !localStorage.getItem(STORAGE_KEY_COMPLETED) // Logueado: solo la primera vez
      : (() => {
          const lastDate = localStorage.getItem(STORAGE_KEY_GUEST_DATE);
          return lastDate !== getToday(); // Invitado: primera visita del día
        })();

    if (shouldRun) {
      const guest = !token;
      setIsGuest(guest);
      isGuestRef.current = guest;
      const t = setTimeout(() => setRun(true), DELAY_BEFORE_START_MS);
      return () => clearTimeout(t);
    }
  }, []);

  const handleClose = useCallback(
    (finished: boolean) => {
      setRun(false);
      if (isGuestRef.current) {
        localStorage.setItem(STORAGE_KEY_GUEST_DATE, getToday());
      } else {
        localStorage.setItem(STORAGE_KEY_COMPLETED, 'true');
        if (finished) router.push('/mi-perfil');
      }
    },
    [router]
  );

  const handleNext = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      handleClose(true);
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [stepIndex, steps.length, handleClose]);

  const handleBack = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  if (!run || typeof document === 'undefined') return null;

  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const isCenter = step.placement === 'center';

  const overlay = (
    <div
      className="fixed inset-0 z-[10000]"
      style={{ pointerEvents: 'auto' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      aria-describedby="tour-content"
    >
      {/* Overlay: en paso centro es capa oscura; en el resto es spotlight (sombra con “agujero” en el target) */}
      {isCenter ? (
        <div
          className="absolute inset-0 bg-black/70"
          style={{ backdropFilter: 'blur(2px)' }}
          aria-hidden
        />
      ) : targetRect ? (
        <div
          className="absolute rounded-xl pointer-events-none border-2 border-orange-500"
          style={{
            left: targetRect.left - 8,
            top: targetRect.top - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.75)',
          }}
          aria-hidden
        />
      ) : (
        <div className="absolute inset-0 bg-black/70" aria-hidden />
      )}

      {/* Tooltip */}
      <div
        id="tour-tooltip"
        className="absolute z-[10001] w-[min(90vw,400px)] max-w-full rounded-3xl border border-slate-700 bg-slate-900 p-6 text-left shadow-2xl"
        style={
          isCenter
            ? {
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
              }
            : targetRect
              ? step.placement === 'bottom-end'
                ? {
                    left: Math.min(targetRect.right - 16, window.innerWidth - 400),
                    top: targetRect.bottom + 16,
                  }
                : {
                    left: Math.max(16, Math.min(targetRect.left, window.innerWidth - 400 - 16)),
                    top: targetRect.bottom + 16,
                  }
              : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
        }
      >
        <h2 id="tour-title" className="text-xl font-black text-white mb-2">
          {step.title}
        </h2>
        <p id="tour-content" className="text-slate-300 text-sm leading-relaxed mb-6">
          {step.content}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBack}
              disabled={isFirst}
              className="text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold transition-colors"
            >
              {t('tour.atras')}
            </button>
            <button
              type="button"
              onClick={() => handleClose(false)}
              className="text-slate-500 hover:text-slate-300 text-sm font-bold ml-2 transition-colors"
            >
              {t('tour.omitir')}
            </button>
          </div>
          <button
            type="button"
            onClick={handleNext}
            className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-5 py-2.5 rounded-full text-sm transition-colors shadow-lg"
          >
            {isLast ? t('tour.empezar') : t('tour.siguiente')}
          </button>
        </div>
        <div className="mt-4 text-[10px] text-slate-500 font-medium">
          {stepIndex + 1} de {steps.length}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
