'use client';

import { MapPin, ArrowRight } from 'lucide-react';
import DepthAwareImage from '@/components/DepthAwareImage';
import { LIQUID_GLASS_MEDIA_HEIGHT, LIQUID_GLASS_RADIUS } from '@/components/liquid-glass/constants';
import { themeFromHex } from '@/components/liquid-glass/themeRgb';
import { useLiquidGlassTilt } from '@/components/liquid-glass/useLiquidGlassTilt';

function getInitials(name: string) {
  return name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'NN';
}

export interface GuiaLiquidCardPrestador {
  nombre: string;
  rubro: string;
  tipoPerfil: string;
  descripcion?: string;
  foto?: string | null;
  fotoProfundidad?: string | null;
  ciudad?: string;
  colorTema?: string;
}

export type GuiaLiquidCardProps = {
  p: GuiaLiquidCardPrestador;
  disable3D?: boolean;
  verPerfilLabel: string;
};

const H = LIQUID_GLASS_MEDIA_HEIGHT;
const R = LIQUID_GLASS_RADIUS;

export function GuiaLiquidCard({ p, disable3D, verPerfilLabel }: GuiaLiquidCardProps) {
  const { cardRef, innerRef, onMove, onLeave } = useLiquidGlassTilt(disable3D);
  const meta = themeFromHex(p.colorTema);
  const desc = p.descripcion?.trim() || 'Sin descripción disponible.';

  return (
    <div
      ref={cardRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="h-full min-h-0"
      style={{ perspective: '1100px', cursor: 'pointer' }}
    >
      <div
        ref={innerRef}
        className="lg-card h-full min-h-0"
        style={{
          position: 'relative',
          borderRadius: R,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          background: `linear-gradient(135deg, rgba(${meta.rgb},0.09) 0%, rgba(255,255,255,0.04) 60%, rgba(${meta.rgb},0.05) 100%)`,
          backdropFilter: 'blur(28px) saturate(190%) brightness(1.12)',
          WebkitBackdropFilter: 'blur(28px) saturate(190%) brightness(1.12)',
          border: `1px solid rgba(${meta.rgb},0.28)`,
          boxShadow: `
            0 0 0 1px rgba(255,255,255,0.06) inset,
            0 2px 0 0 rgba(255,255,255,0.18) inset,
            0 -1px 0 0 rgba(0,0,0,0.12) inset,
            0 40px 80px rgba(0,0,0,0.45),
            0 8px 24px rgba(0,0,0,0.35),
            0 0 40px rgba(${meta.rgb},0.06)
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

        <div
          style={{
            height: H,
            minHeight: H,
            maxHeight: H,
            flexShrink: 0,
            position: 'relative',
            overflow: 'hidden',
            background: `radial-gradient(ellipse at 50% 35%, rgba(${meta.rgb},0.4) 0%, rgba(0,0,0,0.65) 100%)`,
          }}
        >
          <div className="absolute inset-0 z-[1] flex items-center justify-center overflow-hidden">
            <div
              className="flex items-center justify-center overflow-hidden rounded-full border-2 shadow-2xl transition-transform duration-500 group-hover:scale-105 md:border-[3px]"
              style={{
                width: 112,
                height: 112,
                borderColor: meta.color,
                color: meta.color,
                background: 'rgba(4,6,18,0.85)',
              }}
            >
              {p.foto ? (
                <DepthAwareImage
                  imageUrl={p.foto}
                  depthUrl={p.fotoProfundidad}
                  alt={p.nombre}
                  className="h-full w-full rounded-full object-cover"
                  containerClassName="h-full w-full overflow-hidden rounded-full"
                  force2D={disable3D}
                />
              ) : (
                <span className="text-xl font-bold md:text-2xl">{getInitials(p.nombre)}</span>
              )}
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 5,
              pointerEvents: 'none',
              background: 'linear-gradient(to top, rgba(4,4,20,0.88) 0%, rgba(4,4,20,0.2) 55%, transparent 100%)',
            }}
          />

          <div
            style={{
              position: 'absolute',
              top: 14,
              left: 14,
              zIndex: 10,
              background: meta.color,
              color: 'white',
              fontSize: 9,
              fontWeight: 900,
              padding: '4px 12px',
              borderRadius: 100,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              boxShadow: `0 4px 14px rgba(${meta.rgb},0.45)`,
              maxWidth: 'calc(100% - 28px)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {p.tipoPerfil}
          </div>
        </div>

        <div
          style={{
            padding: '20px 22px 18px',
            background: `linear-gradient(180deg, rgba(${meta.rgb},0.04) 0%, rgba(0,0,0,0.08) 100%)`,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            textAlign: 'center',
          }}
        >
          <h3
            style={{
              margin: '0 0 6px',
              fontSize: 17,
              fontWeight: 900,
              color: 'white',
              letterSpacing: '-0.025em',
              lineHeight: 1.2,
              textShadow: `0 0 28px rgba(${meta.rgb},0.35)`,
            }}
          >
            {p.nombre}
          </h3>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginBottom: 10,
              fontSize: 10,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase',
            }}
          >
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
            <span className="truncate">{p.rubro}</span>
          </div>

          <p
            style={{
              margin: 0,
              marginBottom: 12,
              fontSize: 11.5,
              color: 'rgba(255,255,255,0.48)',
              lineHeight: 1.65,
              textAlign: 'justify',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              flex: 1,
              minHeight: 0,
            }}
          >
            {desc}
          </p>

          <div
            style={{
              marginTop: 'auto',
              borderTop: '1px solid rgba(255,255,255,0.07)',
              paddingTop: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 10,
            }}
          >
            <span className="flex items-center gap-1.5 text-slate-400">
              <MapPin size={12} style={{ color: meta.color }} />
              <span className="truncate">{p.ciudad || 'TDF'}</span>
            </span>
            <span
              className="flex items-center gap-1 font-bold uppercase tracking-wider transition-all group-hover:gap-2"
              style={{ color: meta.color }}
            >
              {verPerfilLabel} <ArrowRight size={12} />
            </span>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: '15%',
            right: '15%',
            height: 1,
            background: `linear-gradient(90deg, transparent, rgba(${meta.rgb},0.25), transparent)`,
            zIndex: 31,
          }}
        />
      </div>
    </div>
  );
}
