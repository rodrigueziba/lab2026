"use client";

import { useEffect, useRef } from "react";

/**
 * TopologyBackground — Ocean edition
 * ─────────────────────────────────────
 * Deep-sea blues + orange gradient background.
 * Concentric contour lines that ripple like ocean swells.
 * Every user interaction (scroll, click, mousemove, keydown, touch)
 * injects a "wave pulse" that temporarily amplifies the distortion.
 * Desktop-only: on mobile/tablet the canvas is simply not rendered.
 */
export default function TopologyBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    // ── Desktop-only guard ───────────────────────────────────────────────────
    if (window.innerWidth < 1024) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let W, H, raf;

    // ── Smooth scroll state ──────────────────────────────────────────────────
    let scrollSmooth  = 0;
    let scrollTarget  = 0;

    // ── Interaction pulse system ─────────────────────────────────────────────
    // Each interaction injects a pulse with amplitude [0..1] that decays.
    // Multiple pulses stack so rapid interactions feel more intense.
    let pulses = [];          // [{ amp, decay }]
    const MAX_PULSE_AMP = 1;

    const addPulse = (strength = 0.55) => {
      pulses.push({ amp: Math.min(strength, MAX_PULSE_AMP), decay: 0.018 });
    };

    // Clamp the total pulse energy driving distortion
    const getPulseEnergy = () =>
      pulses.reduce((s, p) => s + p.amp, 0);

    // ── Event listeners ──────────────────────────────────────────────────────
    const onScroll    = ()  => { scrollTarget = window.scrollY; addPulse(0.45); };
    const onClick     = ()  => addPulse(0.9);
    const onKey       = ()  => addPulse(0.35);
    const onTouch     = ()  => addPulse(0.5);
    // Mouse move: small nudge, throttled to ~30 fps
    let lastMove = 0;
    const onMouseMove = () => {
      const now = performance.now();
      if (now - lastMove < 32) return;
      lastMove = now;
      addPulse(0.08);
    };

    window.addEventListener("scroll",    onScroll,    { passive: true });
    window.addEventListener("click",     onClick);
    window.addEventListener("keydown",   onKey);
    window.addEventListener("touchstart",onTouch,     { passive: true });
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    // ── Resize ───────────────────────────────────────────────────────────────
    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Colour helpers ───────────────────────────────────────────────────────
    // Ocean palette: deep navy → teal → electric blue, accent orange
    // hue range 190–230 = cyan-blues; orange stays ~28
    const oceanHue = (norm, pulse) => {
      // innermost rings lean teal (185), outermost lean deep navy (225)
      // pulse shifts hue slightly warmer (toward orange) when active
      const base = 225 - norm * 40 + pulse * 12;
      return base;
    };

    // ── Contour path builder ─────────────────────────────────────────────────
    const STEPS  = 300;
    const LEVELS = 28;

    const buildPoints = (level, time, chromaShift, pulseE) => {
      const pts = [];
      // Ocean swell: slow primary frequency + choppy secondary
      // pulseE amplifies distortion amplitude — the "wave hit" effect
      const distScale = 1 + pulseE * 2.2;

      for (let i = 0; i <= STEPS; i++) {
        const u     = i / STEPS;
        const angle = u * Math.PI * 2;

        // Calm, long-period base swell (like deep ocean)
        const swell =
          Math.sin(angle * 2  + time * 0.22  + level * 0.35) * 26 * distScale +
          Math.sin(angle * 3  - time * 0.15  + level * 0.55) * 18 * distScale +
          Math.cos(angle * 1.5+ time * 0.18  - level * 0.25) * 22 * distScale;

        // Chop on top — faster, smaller ripples (surface detail)
        const chop =
          Math.sin(angle * 6  + time * 0.55  + level * 0.8 ) *  9 * distScale +
          Math.cos(angle * 5  - time * 0.42  + level * 1.1 ) *  6 * distScale +
          Math.sin(angle * 8  + time * 0.7   - level * 0.6 ) *  4 * distScale;

        const baseR = level * 38 + chromaShift * 0.3;
        const r     = baseR + swell + chop;

        // Centre: slightly off-centre (upper-centre, feels like horizon)
        const cx = W * 0.50 + chromaShift;
        const cy = H * 0.32;

        // Flatten vertically for underwater-horizon perspective
        pts.push({
          x: cx + Math.cos(angle) * r * 1.6,
          y: cy + Math.sin(angle) * r * 0.65,
        });
      }
      return pts;
    };

    const tracePath = (pts) => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 2; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      ctx.closePath();
    };

    // ── Render loop ──────────────────────────────────────────────────────────
    const draw = () => {
      raf = requestAnimationFrame(draw);

      // Decay pulses
      pulses = pulses
        .map((p) => ({ ...p, amp: p.amp - p.decay }))
        .filter((p) => p.amp > 0);

      const pulseE = Math.min(getPulseEnergy(), 2.5); // cap total energy

      // Smooth scroll
      scrollSmooth += (scrollTarget - scrollSmooth) * 0.04;
      const scrollPhase = scrollSmooth * 0.0014;

      const t    = performance.now() / 1000;
      const time = t * 0.28 + scrollPhase;   // slow, oceanic auto-speed

      // ── Background: deep ocean gradient ──────────────────────────────────
      // Base dark navy
      ctx.fillStyle = "#03060f";
      ctx.fillRect(0, 0, W, H);

      // Deep linear gradient: midnight navy → abyssal blue-black → dark orange glow at bottom
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0,    "#030a1a");   // surface — dark midnight
      bgGrad.addColorStop(0.45, "#040e20");   // mid depth
      bgGrad.addColorStop(0.78, "#071428");   // deeper
      bgGrad.addColorStop(1,    "#1a0c04");   // abyssal — dark amber-black glow
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Soft orange radial glow near bottom-centre (bioluminescent / lava vent)
      const orangeGlow = ctx.createRadialGradient(W * 0.5, H * 1.05, 0, W * 0.5, H * 1.05, H * 0.65);
      orangeGlow.addColorStop(0,   `rgba(255,110,20,${0.12 + pulseE * 0.06})`);
      orangeGlow.addColorStop(0.5, `rgba(200,60,5,${0.07 + pulseE * 0.03})`);
      orangeGlow.addColorStop(1,    "rgba(0,0,0,0)");
      ctx.fillStyle = orangeGlow;
      ctx.fillRect(0, 0, W, H);

      // Teal sub-surface glow at centre-top
      const tealGlow = ctx.createRadialGradient(W * 0.5, H * 0.15, 0, W * 0.5, H * 0.15, W * 0.55);
      tealGlow.addColorStop(0,   `rgba(0,180,220,${0.07 + pulseE * 0.04})`);
      tealGlow.addColorStop(1,    "rgba(0,0,0,0)");
      ctx.fillStyle = tealGlow;
      ctx.fillRect(0, 0, W, H);

      // ── Contour rings ─────────────────────────────────────────────────────
      for (let lvl = LEVELS; lvl >= 1; lvl--) {
        const norm      = lvl / LEVELS;         // 1 = outermost, 0 = innermost
        const chromaAmt = (1 - norm) * 4.5 * (1 + pulseE * 0.4);

        // ── Fill: dark, layered depth ──
        const fillH = oceanHue(norm, pulseE);
        const fillS = 60 + norm * 20;
        const fillL = 3  + norm * 6;
        const fillA = 0.6 + norm * 0.25;
        ctx.save();
        tracePath(buildPoints(lvl, time, 0, pulseE));
        ctx.fillStyle = `hsla(${fillH},${fillS}%,${fillL}%,${fillA})`;
        ctx.fill();
        ctx.restore();

        // ── Stroke: 3-channel chromatic "caustic" lines ──
        // Ocean caustics shift between cyan, electric blue, and warm aqua
        // with a faint orange tint on the innermost rings (heat vent glow)
        const baseHue  = 195 + norm * 25;       // cyan → deep blue outward
        const orangeMix = Math.max(0, (1 - norm * 2.5)) * (0.4 + pulseE * 0.3);

        const channels = [
          // Channel A — cold teal/cyan
          { shift: -chromaAmt, h: baseHue + 10, s: 90, l: 68, a: 0.50 + pulseE * 0.08 },
          // Channel B — electric blue (centre)
          { shift:  0,         h: baseHue - 5,  s: 95, l: 72, a: 0.62 + pulseE * 0.10 },
          // Channel C — warm aqua / hint of orange near core
          { shift:  chromaAmt, h: baseHue - 25 + orangeMix * 160, s: 88, l: 65, a: 0.45 + pulseE * 0.08 },
        ];

        channels.forEach(({ shift, h, s, l, a }) => {
          const pts = buildPoints(lvl, time, shift, pulseE);
          ctx.save();
          tracePath(pts);
          ctx.lineWidth   = 0.7 + (1 - norm) * 1.8 + pulseE * 0.4;
          ctx.strokeStyle = `hsla(${h % 360},${s}%,${l}%,${a})`;
          ctx.stroke();
          ctx.restore();
        });
      }

      // ── Vignette ─────────────────────────────────────────────────────────
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.9);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.78)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize",     resize);
      window.removeEventListener("scroll",     onScroll);
      window.removeEventListener("click",      onClick);
      window.removeEventListener("keydown",    onKey);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("mousemove",  onMouseMove);
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
        // Hidden on mobile via CSS — the useEffect guard above also skips JS
        display:       "none",
      }}
      // Reveal only on lg+ screens via a className hook
      className="lg:!block"
    />
  );
}