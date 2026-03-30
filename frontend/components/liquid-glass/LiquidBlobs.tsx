'use client';

import { useEffect, useRef } from 'react';

const BLOB_PALETTE: [number, number, number][] = [
  [99, 102, 241],
  [6, 182, 212],
  [139, 92, 246],
  [20, 184, 166],
  [236, 72, 153],
  [16, 185, 129],
  [79, 70, 229],
  [6, 182, 212],
  [99, 102, 241],
];

interface BlobState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  col: [number, number, number];
  alpha: number;
  phase: number;
  pSpeed: number;
  isChild: boolean;
  life: number;
}

function mkBlob(W: number, H: number, i: number): BlobState {
  return {
    id: Math.random().toString(36).slice(2),
    x: 80 + Math.random() * (W - 160),
    y: 80 + Math.random() * (H - 160),
    vx: (Math.random() - 0.5) * 0.55,
    vy: (Math.random() - 0.5) * 0.55,
    r: 110 + Math.random() * 130,
    col: BLOB_PALETTE[i % BLOB_PALETTE.length],
    alpha: 0.22 + Math.random() * 0.18,
    phase: Math.random() * Math.PI * 2,
    pSpeed: 0.007 + Math.random() * 0.007,
    isChild: false,
    life: 1,
  };
}

export function LiquidBlobs() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const blobsRef = useRef<BlobState[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const splitSet = useRef(new Set<string>());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    blobsRef.current = BLOB_PALETTE.map((_, i) => mkBlob(canvas.width, canvas.height, i));

    const REPEL_R = 210;
    const SPLIT_R = 105;
    const REPEL_F = 2.8;

    const tick = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const toAdd: BlobState[] = [];

      blobsRef.current = blobsRef.current.filter((b) => b.life > 0.04);

      for (const b of blobsRef.current) {
        b.phase += b.pSpeed;

        if (b.x - b.r < 0 && b.vx < 0) b.vx *= -0.85;
        if (b.x + b.r > W && b.vx > 0) b.vx *= -0.85;
        if (b.y - b.r < 0 && b.vy < 0) b.vy *= -0.85;
        if (b.y + b.r > H && b.vy > 0) b.vy *= -0.85;

        const dx = b.x - mx;
        const dy = b.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (dist < REPEL_R) {
          const f = Math.pow((REPEL_R - dist) / REPEL_R, 1.6) * REPEL_F;
          b.vx += (dx / dist) * f;
          b.vy += (dy / dist) * f;

          if (dist < SPLIT_R && !b.isChild && !splitSet.current.has(b.id)) {
            splitSet.current.add(b.id);
            setTimeout(() => splitSet.current.delete(b.id), 4500);

            for (let k = 0; k < 2; k++) {
              const ang = Math.random() * Math.PI * 2;
              toAdd.push({
                id: Math.random().toString(36).slice(2),
                x: b.x + Math.cos(ang) * b.r * 0.28,
                y: b.y + Math.sin(ang) * b.r * 0.28,
                vx: b.vx * 0.4 + (Math.random() - 0.5) * 3.5,
                vy: b.vy * 0.4 + (Math.random() - 0.5) * 3.5,
                r: b.r * (0.38 + Math.random() * 0.22),
                col: b.col,
                alpha: b.alpha * 0.85,
                phase: Math.random() * Math.PI * 2,
                pSpeed: b.pSpeed * 1.4,
                isChild: true,
                life: 1,
              });
            }
            b.life = 0.03;
          }
        }

        b.vx *= 0.972;
        b.vy *= 0.972;
        b.x += b.vx;
        b.y += b.vy;
        if (b.isChild) b.life -= 0.0018;

        const wobble = 1 + 0.065 * Math.sin(b.phase);
        const radius = Math.max(0, b.r * wobble * b.life);
        const [cr, cg, cb] = b.col;
        const a = b.alpha * b.life;
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, radius);
        g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`);
        g.addColorStop(0.45, `rgba(${cr},${cg},${cb},${a * 0.55})`);
        g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.beginPath();
        ctx.arc(b.x, b.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }

      blobsRef.current.push(...toAdd);
      rafRef.current = requestAnimationFrame(tick);
    };

    const onMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', onMouse);

    tick();
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
      }}
    />
  );
}
