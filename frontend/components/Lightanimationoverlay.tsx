'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const SPHERE_R = 62;
const FRICTION = 0.955;
const BOUNCE = 0.6;

// Spotlight position as fraction of container
const SPOT_X = 0.30;
const SPOT_Y = 0.70;
const SPOT_CONE_HALF_W = 0.09; // half-width of cone base (fraction of container width)

export default function LightAnimationOverlay({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState(0);
  // phase 0 = words entering
  // phase 1 = spotlight appears
  // phase 2 = full darkness
  // phase 3 = sphere enters
  // phase 4 = fully interactive

  const [spherePos, setSpherePos] = useState({ x: -200, y: 0 });
  const [underLight, setUnderLight] = useState(false);
  const [hue, setHue] = useState(195);
  const [showHint, setShowHint] = useState(false);

  const posRef = useRef({ x: -200, y: 0 });
  const velRef = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastPtr = useRef({ x: 0, y: 0, t: 0 });
  const ptrVel = useRef({ x: 0, y: 0 });
  const phaseRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const sphereInitialized = useRef(false);

  // Start word animations shortly after mount
  useEffect(() => {
    const t = setTimeout(() => setStarted(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Phase timeline (starts after words appear)
  useEffect(() => {
    if (!started) return;
    const set = (p: number) => { setPhase(p); phaseRef.current = p; };
    const timers = [
      setTimeout(() => set(1), 2600),   // spotlight
      setTimeout(() => set(2), 6200),   // darkness
      setTimeout(() => set(3), 7800),   // sphere enters
      setTimeout(() => set(4), 10200),  // interactive
      setTimeout(() => setShowHint(true), 11000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [started]);

  // Init sphere position when phase 3 starts
  useEffect(() => {
    if (phase !== 3 || sphereInitialized.current) return;
    sphereInitialized.current = true;
    if (!containerRef.current) return;
    const { height } = containerRef.current.getBoundingClientRect();
    posRef.current = { x: -SPHERE_R * 2, y: height * SPOT_Y };
    velRef.current = { x: 2.5, y: 0 };
  }, [phase]);

  // Hue cycling for sphere color
  useEffect(() => {
    const id = setInterval(() => setHue(h => (h + 0.5) % 360), 28);
    return () => clearInterval(id);
  }, []);

  // Physics loop
  useEffect(() => {
    if (phase < 3) return;
    const loop = () => {
      const el = containerRef.current;
      if (!el) { rafRef.current = requestAnimationFrame(loop); return; }
      const { width, height } = el.getBoundingClientRect();
      const spotX = width * SPOT_X;
      const spotY = height * SPOT_Y;
      const spotHW = width * SPOT_CONE_HALF_W; // half-width of light cone at sphere level

      if (!isDragging.current) {
        if (phaseRef.current === 3) {
          // Spring toward spotlight while entering
          const dx = spotX - posRef.current.x;
          const dy = spotY - posRef.current.y;
          velRef.current.x += dx * 0.012;
          velRef.current.y += dy * 0.012;
          velRef.current.x *= 0.91;
          velRef.current.y *= 0.91;
        } else {
          // Free physics
          velRef.current.x *= FRICTION;
          velRef.current.y *= FRICTION;
        }
        posRef.current.x += velRef.current.x;
        posRef.current.y += velRef.current.y;

        // Wall bouncing — restrict to lower 2/3 of screen so sphere doesn't cover title
        const minY = height * 0.33;
        const maxY = height * 0.93;
        if (posRef.current.x - SPHERE_R < 0) { posRef.current.x = SPHERE_R; velRef.current.x = Math.abs(velRef.current.x) * BOUNCE; }
        if (posRef.current.x + SPHERE_R > width) { posRef.current.x = width - SPHERE_R; velRef.current.x = -Math.abs(velRef.current.x) * BOUNCE; }
        if (posRef.current.y - SPHERE_R < minY) { posRef.current.y = minY + SPHERE_R; velRef.current.y = Math.abs(velRef.current.y) * BOUNCE; }
        if (posRef.current.y + SPHERE_R > maxY) { posRef.current.y = maxY - SPHERE_R; velRef.current.y = -Math.abs(velRef.current.y) * BOUNCE; }
      }

      // Is sphere within the spotlight cone?
      const dx = posRef.current.x - spotX;
      const dy = posRef.current.y - spotY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      setUnderLight(dist < spotHW + SPHERE_R * 0.55);
      setSpherePos({ x: posRef.current.x, y: posRef.current.y });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [phase]);

  // Pointer drag
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (phaseRef.current < 4) return;
    isDragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = containerRef.current!.getBoundingClientRect();
    lastPtr.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, t: Date.now() };
    ptrVel.current = { x: 0, y: 0 };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const rect = containerRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const dt = Date.now() - lastPtr.current.t;
    if (dt > 0) {
      ptrVel.current.x = (cx - lastPtr.current.x) / dt * 14;
      ptrVel.current.y = (cy - lastPtr.current.y) / dt * 14;
    }
    posRef.current = { x: cx, y: cy };
    lastPtr.current = { x: cx, y: cy, t: Date.now() };
  }, []);

  const onPointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    velRef.current.x = ptrVel.current.x;
    velRef.current.y = ptrVel.current.y;
  }, []);

  // Gyroscope — Android only
  useEffect(() => {
    if (phase < 4 || typeof window === 'undefined') return;
    if (!/Android/i.test(navigator.userAgent)) return;
    const handler = (e: DeviceOrientationEvent) => {
      if (isDragging.current) return;
      const gamma = e.gamma ?? 0;
      const beta = (e.beta ?? 45) - 45;
      velRef.current.x += gamma * 0.018;
      velRef.current.y += beta * 0.014;
    };
    window.addEventListener('deviceorientation', handler);
    return () => window.removeEventListener('deviceorientation', handler);
  }, [phase]);

  // Click to navigate (not while dragging)
  const handleClick = useCallback(() => {
    if (phaseRef.current >= 4 && !isDragging.current) {
      router.push('/alight');
    }
  }, [router]);

  const bgOpacity = phase >= 2 ? 0.96 : phase >= 1 ? 0.62 : 0.28;
  const c1 = `hsl(${hue}, 92%, 62%)`;
  const c2 = `hsl(${(hue + 120) % 360}, 92%, 62%)`;
  const c3 = `hsl(${(hue + 240) % 360}, 92%, 62%)`;

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        overflow: 'hidden',
        background: `rgba(0, 0, 4, ${bgOpacity})`,
        transition: 'background 3s ease',
        cursor: phase >= 4 ? 'pointer' : 'default',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,700;1,300&display=swap');
        @keyframes pulseHint { 0%,100%{opacity:.25} 50%{opacity:.65} }
        @keyframes glowPulse { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.3)} }
        @keyframes spotOn {
          from { opacity:0; clip-path: polygon(50% 0%,50% 0%,50% 100%,50% 100%); }
          to   { opacity:1; clip-path: polygon(20% 0%,80% 0%,100% 100%,0% 100%); }
        }
      `}</style>

      {/* ── Title ── */}
      <div style={{
        position: 'absolute', top: '13%', left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 'clamp(.3rem, 2vw, 1.4rem)',
        userSelect: 'none', pointerEvents: 'none',
        fontFamily: '"Cormorant Garamond", Georgia, serif',
      }}>
        {/* "A LIGHT" — slides from left */}
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: '.06em',
          fontSize: 'clamp(2.8rem, 8vw, 8rem)', fontWeight: 700,
          letterSpacing: '-0.03em', color: '#fff', lineHeight: 1,
          transform: started ? 'translateX(0)' : 'translateX(-110vw)',
          opacity: started ? 1 : 0,
          transition: 'transform 2s cubic-bezier(.16,1,.3,1), opacity 1s ease',
        }}>
          <span style={{ fontWeight: 300, fontStyle: 'italic', marginRight: '.08em' }}>A</span>
          <span style={{
            background: 'linear-gradient(170deg, #fff 55%, rgba(255,240,160,.85) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>LIGHT</span>
        </div>

        {/* "for" — rises from below */}
        <div style={{
          fontSize: 'clamp(1rem, 2.8vw, 2.8rem)', fontWeight: 300, fontStyle: 'italic',
          color: 'rgba(255,255,255,.6)',
          transform: started ? 'translateY(0)' : 'translateY(55px)',
          opacity: started ? .8 : 0,
          transition: 'transform 2s cubic-bezier(.16,1,.3,1) .35s, opacity 1.2s ease .35s',
        }}>for</div>

        {/* "ATTENTION" — drops from above, boxed */}
        <div style={{
          fontSize: 'clamp(2rem, 5.5vw, 5.5rem)', fontWeight: 700,
          letterSpacing: '-0.02em', color: '#fff',
          border: '1.5px solid rgba(255,255,255,.45)',
          padding: '.04em .18em .04em .2em', borderRadius: '5px',
          transform: started ? 'translateY(0)' : 'translateY(-75px)',
          opacity: started ? 1 : 0,
          transition: 'transform 2s cubic-bezier(.16,1,.3,1) .6s, opacity 1.2s ease .6s',
        }}>ATTENTION</div>
      </div>

      {/* ── Spotlight SVG cone ── */}
      <svg
        viewBox="0 0 100 300"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          left: `${(SPOT_X - 0.1) * 100}%`,
          top: '23%',
          width: '20%',
          height: '49%',
          opacity: phase >= 1 ? 1 : 0,
          transition: 'opacity 1.8s ease',
          pointerEvents: 'none',
          overflow: 'visible',
          animation: phase >= 1 ? 'glowPulse 4s ease-in-out infinite' : 'none',
        }}
      >
        <defs>
          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,245,170,.65)" />
            <stop offset="45%" stopColor="rgba(255,240,150,.2)" />
            <stop offset="100%" stopColor="rgba(255,235,130,0)" />
          </linearGradient>
          <linearGradient id="sgC" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,210,.35)" />
            <stop offset="100%" stopColor="rgba(255,255,200,0)" />
          </linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        {/* Outer cone */}
        <polygon points="50,0 5,300 95,300" fill="url(#sg)" />
        {/* Inner bright core */}
        <polygon points="50,0 30,300 70,300" fill="url(#sgC)" />
        {/* Source — tiny bright dot */}
        <ellipse cx="50" cy="2" rx="14" ry="4" fill="rgba(255,255,200,.9)" filter="url(#glow)" />
      </svg>

      {/* ── Spotlight floor glow ── */}
      {phase >= 1 && (
        <div style={{
          position: 'absolute',
          left: `${SPOT_X * 100}%`,
          top: `${SPOT_Y * 100}%`,
          transform: 'translate(-50%,-45%)',
          width: '24%', aspectRatio: '2/1',
          background: 'radial-gradient(ellipse, rgba(255,240,140,.18) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none',
          opacity: phase >= 1 ? 1 : 0,
          transition: 'opacity 2s ease',
        }} />
      )}

      {/* ── Glass Sphere ── */}
      {phase >= 3 && (
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            position: 'absolute',
            left: spherePos.x - SPHERE_R,
            top: spherePos.y - SPHERE_R,
            width: SPHERE_R * 2, height: SPHERE_R * 2,
            borderRadius: '50%',
            touchAction: 'none', userSelect: 'none',
            cursor: phase >= 4 ? 'grab' : 'default',
            // Glass gradients — the highlight at top-left is the "glass" look
            background: underLight
              ? `
                radial-gradient(circle at 28% 22%, rgba(255,255,255,.97) 0%, rgba(255,255,255,.0) 26%),
                radial-gradient(circle at 70% 16%, rgba(255,255,255,.55) 0%, transparent 17%),
                radial-gradient(circle at 52% 72%, ${c3}cc, ${c1}99 35%, ${c2}66 65%, transparent),
                radial-gradient(circle at 50% 50%, ${c2}22, ${c1}11)
              `
              : `
                radial-gradient(circle at 28% 22%, rgba(255,255,255,.95) 0%, rgba(255,255,255,.0) 26%),
                radial-gradient(circle at 70% 16%, rgba(255,255,255,.45) 0%, transparent 17%),
                radial-gradient(circle at 50% 78%, rgba(170,210,255,.2), transparent 60%),
                rgba(255,255,255,.04)
              `,
            backdropFilter: 'blur(22px) saturate(200%)',
            WebkitBackdropFilter: 'blur(22px) saturate(200%)',
            border: `1.5px solid ${underLight ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.3)'}`,
            boxShadow: underLight
              ? `
                inset 0 0 28px ${c1}66,
                inset -12px -12px 32px ${c2}44,
                0 0 55px ${c1}88,
                0 0 110px ${c2}55,
                0 18px 55px rgba(0,0,0,.55),
                0 0 0 .5px rgba(255,255,255,.5)
              `
              : `
                inset 0 0 18px rgba(255,255,255,.1),
                inset -8px -10px 22px rgba(0,10,50,.25),
                0 18px 55px rgba(0,0,0,.65),
                0 0 0 .5px rgba(255,255,255,.15)
              `,
            transition: 'box-shadow .65s ease, border-color .65s ease, background .65s ease',
          }}
        />
      )}

      {/* ── Hint ── */}
      <div style={{
        position: 'absolute', bottom: '4.5%', left: '50%',
        transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,.28)',
        fontSize: 'clamp(.6rem, 1.4vw, .78rem)',
        letterSpacing: '.28em', textTransform: 'uppercase',
        fontFamily: '"Cormorant Garamond", Georgia, serif',
        opacity: showHint ? 1 : 0, transition: 'opacity 1.5s ease',
        pointerEvents: 'none',
        animation: showHint ? 'pulseHint 3s ease-in-out infinite' : 'none',
      }}>
        toca para continuar
      </div>
    </div>
  );
}