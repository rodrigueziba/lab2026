'use client';

import type React from 'react';
import { ArrowRight } from 'lucide-react';
import { LIQUID_GLASS_RADIUS } from '@/components/liquid-glass/constants';
import { themeFromHex } from '@/components/liquid-glass/themeRgb';
import { useLiquidGlassTilt } from '@/components/liquid-glass/useLiquidGlassTilt';

export type LandingPromoLiquidCardProps = {
  title: string;
  subtitle: string;
  colorHex: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  ctaLabel?: string;
  disable3D?: boolean;
};

const R = LIQUID_GLASS_RADIUS;

export function LandingPromoLiquidCard({
  title,
  subtitle,
  colorHex,
  icon: Icon,
  ctaLabel = 'Ver más',
  disable3D,
}: LandingPromoLiquidCardProps) {
  const { cardRef, innerRef, onMove, onLeave } = useLiquidGlassTilt(disable3D);
  const meta = themeFromHex(colorHex);

  return (
    <div
      ref={cardRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="w-full"
      style={{ perspective: '1100px', cursor: 'pointer' }}
    >
      <div
        ref={innerRef}
        className="lg-card w-full"
        style={{
          position: 'relative',
          borderRadius: R,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          minHeight: 0,
          background: `linear-gradient(135deg, rgba(${meta.rgb},0.09) 0%, rgba(255,255,255,0.04) 60%, rgba(${meta.rgb},0.05) 100%)`,
          backdropFilter: 'blur(28px) saturate(190%) brightness(1.12)',
          WebkitBackdropFilter: 'blur(28px) saturate(190%) brightness(1.12)',
          border: `1px solid rgba(${meta.rgb},0.28)`,
          boxShadow: `
            0 0 0 1px rgba(255,255,255,0.06) inset,
            0 2px 0 0 rgba(255,255,255,0.18) inset,
            0 -1px 0 0 rgba(0,0,0,0.12) inset,
            0 24px 48px rgba(0,0,0,0.4),
            0 6px 18px rgba(0,0,0,0.3),
            0 0 32px rgba(${meta.rgb},0.06)
          `,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
          transition: 'box-shadow 0.4s ease',
        }}
      >
        <div
          className="lg-sheen"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 30,
            pointerEvents: 'none',
            borderRadius: R,
            opacity: 0,
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '8%',
            right: '8%',
            height: 1,
            background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.55), rgba(${meta.rgb},0.9), rgba(255,255,255,0.55), transparent)`,
            zIndex: 31,
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(90deg, ${meta.color}cc 0%, ${meta.color} 50%, rgba(${meta.rgb},0.3) 100%)`,
            zIndex: 32,
            borderRadius: `${R}px ${R}px 0 0`,
          }}
        />

        {/* Columna izquierda: icono */}
        <div
          className="relative z-[1] flex w-[min(28%,132px)] shrink-0 flex-col items-center justify-center sm:w-[min(26%,160px)]"
          style={{
            minHeight: 112,
            background: `radial-gradient(ellipse 90% 70% at 50% 45%, rgba(${meta.rgb},0.42) 0%, rgba(0,0,0,0.55) 100%)`,
            borderRight: `1px solid rgba(${meta.rgb},0.18)`,
          }}
        >
          <div
            className="card-icon-glow-pulse flex h-[56px] w-[56px] items-center justify-center rounded-xl border sm:h-[64px] sm:w-[64px] sm:rounded-2xl"
            style={{
              borderColor: `rgba(${meta.rgb},0.4)`,
              background: `rgba(${meta.rgb},0.1)`,
              color: meta.color,
              boxShadow: `0 6px 24px rgba(${meta.rgb},0.22)`,
            }}
          >
            <Icon size={28} className="sm:h-8 sm:w-8" strokeWidth={2} />
          </div>
        </div>

        {/* Columna derecha: título, texto, CTA compacto */}
        <div
          className="flex min-w-0 flex-1 flex-col justify-center py-3 pl-3 pr-3.5 sm:py-3.5 sm:pl-5 sm:pr-6"
          style={{
            background: `linear-gradient(180deg, rgba(${meta.rgb},0.03) 0%, rgba(0,0,0,0.06) 100%)`,
          }}
        >
          <h2
            className="text-lg font-black leading-tight tracking-tight text-white sm:text-xl md:text-2xl"
            style={{
              margin: '0 0 6px',
              textShadow: `0 0 20px rgba(${meta.rgb},0.3)`,
            }}
          >
            {title}
          </h2>

          <p
            className="text-[13px] leading-snug text-white/55 sm:text-sm"
            style={{
              margin: 0,
              marginBottom: 8,
              textAlign: 'left',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {subtitle}
          </p>

          <div className="flex justify-end pt-0.5">
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-all group-hover:gap-2 sm:text-[11px]"
              style={{ color: meta.color }}
            >
              {ctaLabel}
              <ArrowRight size={13} strokeWidth={2.5} className="shrink-0" />
            </span>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: '12%',
            right: '12%',
            height: 1,
            background: `linear-gradient(90deg, transparent, rgba(${meta.rgb},0.22), transparent)`,
            zIndex: 31,
          }}
        />
      </div>
    </div>
  );
}
