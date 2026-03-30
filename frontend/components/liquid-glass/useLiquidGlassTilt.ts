'use client';

import { useRef, useCallback, useEffect } from 'react';

export function useLiquidGlassTilt(disable3D?: boolean) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
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
    stateRef.current.active = false;
    startAnim();
  }, [startAnim]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  return { cardRef, innerRef, onMove, onLeave };
}
