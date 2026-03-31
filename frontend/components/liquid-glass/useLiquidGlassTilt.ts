'use client';

import { useRef, useCallback, useEffect } from 'react';

type UseLiquidGlassTiltOptions = {
  enableGyroOnAndroidMobile?: boolean;
};

export function useLiquidGlassTilt(disable3D?: boolean, options?: UseLiquidGlassTiltOptions) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const isPointerActiveRef = useRef(false);
  const stateRef = useRef({
    rx: 0,
    ry: 0,
    sx: 50,
    sy: 50,
    sheenOpacity: 0,
    active: false,
    targetRx: 0,
    targetRy: 0,
  });

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const startAnim = useCallback(() => {
    if (rafRef.current != null) return;
    const animate = () => {
      const s = stateRef.current;
      const tTarget = s.active ? 0.12 : 0.06;
      s.rx = lerp(s.rx, s.active ? s.targetRx : 0, tTarget);
      s.ry = lerp(s.ry, s.active ? s.targetRy : 0, tTarget);
      s.sheenOpacity = lerp(s.sheenOpacity, s.active ? 1 : 0, 0.08);

      if (innerRef.current) {
        const tX = s.rx;
        const tY = s.ry;
        innerRef.current.style.transform = `perspective(1100px) rotateX(${tX}deg) rotateY(${tY}deg) translateZ(${s.active ? 6 : 0}px)`;
        const sheen = innerRef.current.querySelector('.lg-sheen');
        if (sheen instanceof HTMLElement) {
          sheen.style.opacity = String(s.sheenOpacity);
          sheen.style.background = `radial-gradient(ellipse 65% 55% at ${s.sx}% ${s.sy}%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.07) 40%, transparent 70%)`;
        }
      }

      const done =
        !s.active &&
        Math.abs(s.rx) < 0.05 &&
        Math.abs(s.ry) < 0.05 &&
        s.sheenOpacity < 0.01;
      if (done) {
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disable3D) return;
      isPointerActiveRef.current = true;
      const el = cardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      const s = stateRef.current;
      s.active = true;
      s.targetRx = ny * 13;
      s.targetRy = -nx * 13;
      s.sx = ((e.clientX - rect.left) / rect.width) * 100;
      s.sy = ((e.clientY - rect.top) / rect.height) * 100;
      startAnim();
    },
    [disable3D, startAnim]
  );

  const onLeave = useCallback(() => {
    isPointerActiveRef.current = false;
    stateRef.current.active = false;
    startAnim();
  }, [startAnim]);

  useEffect(() => {
    if (disable3D || !options?.enableGyroOnAndroidMobile || typeof window === 'undefined') return;

    const ua = window.navigator.userAgent.toLowerCase();
    const isAndroid = ua.includes('android');
    const isMobile = window.innerWidth < 768;
    const hasDeviceOrientation = typeof window.DeviceOrientationEvent !== 'undefined';
    if (!isAndroid || !isMobile || !hasDeviceOrientation) return;

    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const MAX_TILT_DEG = 11;

    const onOrientation = (e: DeviceOrientationEvent) => {
      if (isPointerActiveRef.current) return;
      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;

      const nx = clamp(gamma / 30, -1, 1);
      const ny = clamp(beta / 35, -1, 1);

      const s = stateRef.current;
      s.active = true;
      s.targetRx = ny * MAX_TILT_DEG;
      s.targetRy = -nx * MAX_TILT_DEG;
      s.sx = clamp(50 + nx * 30, 8, 92);
      s.sy = clamp(50 + ny * 30, 8, 92);
      startAnim();
    };

    window.addEventListener('deviceorientation', onOrientation, { passive: true });
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      isPointerActiveRef.current = false;
      stateRef.current.active = false;
      startAnim();
    };
  }, [disable3D, options?.enableGyroOnAndroidMobile, startAnim]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  return { cardRef, innerRef, onMove, onLeave };
}
