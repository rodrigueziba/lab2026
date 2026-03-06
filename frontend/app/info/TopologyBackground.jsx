"use client";

import { useEffect, useRef } from "react";

export default function TopologyBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (window.innerWidth < 1024) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let W, H, raf;

    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Mouse position (screen coords) ───────────────────────────────────────
    const mouse = { x: -9999, y: -9999 };
    const onMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    window.addEventListener("mousemove", onMove, { passive: true });

    // ── Config ────────────────────────────────────────────────────────────────
    const LINES       = 18;
    const STEPS       = 140;
    const BASE_SPEED  = 1.055;   // constant serpentine speed — never stops
    const WAVE_AMP    = 60;      // base swell amplitude
    const MOUSE_RADIUS= 160;     // px around cursor that repels lines
    const MOUSE_FORCE = 38;      // max px displacement from mouse

    // ── Draw ──────────────────────────────────────────────────────────────────
    const draw = () => {
      raf = requestAnimationFrame(draw);

      // time drives the serpentine — completely independent of any input
      const t    = performance.now() / 1000;
      const time = t * BASE_SPEED;

      // ── Background ────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);

      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0,   "#03071a");
      bg.addColorStop(0.5, "#040e24");
      bg.addColorStop(1,   "#0b0f1f");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Subtle orange glow bottom-right
      const og = ctx.createRadialGradient(W * 0.85, H * 0.9, 0, W * 0.85, H * 0.9, W * 0.55);
      og.addColorStop(0,  "rgba(200,80,10,0.09)");
      og.addColorStop(1,  "rgba(0,0,0,0)");
      ctx.fillStyle = og;
      ctx.fillRect(0, 0, W, H);

      // ── Wave lines ────────────────────────────────────────────────────────
      // Lines run corner-to-corner along the top-left → bottom-right diagonal.
      // They're spaced perpendicular to that diagonal.
      // We extend them well past the screen edges so they always fill corner to corner.
      const diagLen = Math.sqrt(W * W + H * H);
      const spacing = diagLen / (LINES + 1);

      for (let li = 0; li < LINES; li++) {
        const offset  = (li + 1) * spacing - diagLen / 2;
        const normLi  = li / (LINES - 1);

        // Hue drifts slowly so the gradient breathes over time
        const hue   = 185 + normLi * 45 + Math.sin(time * 0.4 + li * 0.4) * 10;
        const sat   = 75  + normLi * 15;
        const lit   = 42  + (1 - normLi) * 28;
        const alpha = 0.22 + (1 - normLi) * 0.38;

        ctx.beginPath();

        // Extend the parametric range beyond [0,diagLen] so lines reach all 4 corners
        const overreach = diagLen * 0.55;
        const sStart    = -overreach;
        const sEnd      = diagLen + overreach;

        for (let si = 0; si <= STEPS; si++) {
          const s = sStart + (si / STEPS) * (sEnd - sStart);

          // Serpentine wave — two harmonics, always running
          const wave =
            Math.sin(s * 0.0055 + time           + li * 0.65) * WAVE_AMP +
            Math.sin(s * 0.0100 - time * 0.7     + li * 1.1 ) * WAVE_AMP * 0.38;

          const totalOff = offset + wave;

          // Diagonal → screen coords
          // Along-diagonal unit: (1,1)/√2   Perpendicular: (-1,1)/√2
          const sx = W / 2 + (s - totalOff) * 0.7071;
          const sy = H / 2 + (s + totalOff) * 0.7071;

          // ── Mouse repulsion ──────────────────────────────────────────────
          // Push the point away from the cursor if it's close enough
          const dx   = sx - mouse.x;
          const dy   = sy - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          let fx = sx, fy = sy;
          if (dist < MOUSE_RADIUS && dist > 0) {
            const strength = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE;
            fx += (dx / dist) * strength;
            fy += (dy / dist) * strength;
          }

          if (si === 0) ctx.moveTo(fx, fy);
          else          ctx.lineTo(fx, fy);
        }

        ctx.strokeStyle = `hsla(${hue},${sat}%,${lit}%,${alpha})`;
        ctx.lineWidth   = 0.7 + (1 - normLi) * 0.9;
        ctx.stroke();
      }

      // ── Vignette ─────────────────────────────────────────────────────────
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.85);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.75)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize",    resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      "fixed",
        inset:         0,
        width:         "100%",
        height:        "100%",
        pointerEvents: "none",
        zIndex:        0,
        display:       "none",
      }}
      className="lg:!block"
    />
  );
}