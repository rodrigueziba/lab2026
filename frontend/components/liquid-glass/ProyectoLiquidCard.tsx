'use client';

import { motion } from 'framer-motion';
import { Film, DollarSign, GraduationCap, Calendar, MapPin, Eye } from 'lucide-react';
import DepthAwareImage from '@/components/DepthAwareImage';
import { LIQUID_GLASS_MEDIA_HEIGHT, LIQUID_GLASS_RADIUS } from '@/components/liquid-glass/constants';
import { useLiquidGlassTilt } from '@/components/liquid-glass/useLiquidGlassTilt';

const TIPO_META: Record<string, { color: string; rgb: string }> = {
  Documental: { color: '#06b6d4', rgb: '6,182,212' },
  Cortometraje: { color: '#f97316', rgb: '249,115,22' },
  Largometraje: { color: '#8b5cf6', rgb: '139,92,246' },
  Videoclip: { color: '#ec4899', rgb: '236,72,153' },
  Publicidad: { color: '#10b981', rgb: '16,185,129' },
};

interface Puesto {
  id: number | string;
  nombre: string;
}

interface ProyectoUser {
  nombre?: string;
}

export interface ProyectoLiquidCardModel {
  titulo: string;
  descripcion: string;
  tipo: string;
  ciudad: string;
  esEstudiante: boolean;
  esRemunerado: boolean;
  fechaInicio?: string;
  foto?: string;
  fotoProfundidad?: string | null;
  galeria?: string[];
  referencias?: string[];
  puestos?: Puesto[];
  user?: ProyectoUser;
}

export type ProyectoLiquidCardProps = {
  p: ProyectoLiquidCardModel;
  disable3D?: boolean;
  youtubeId?: string | null;
  isHovered?: boolean;
};

const H = LIQUID_GLASS_MEDIA_HEIGHT;
const R = LIQUID_GLASS_RADIUS;

export function ProyectoLiquidCard({ p, disable3D, youtubeId, isHovered }: ProyectoLiquidCardProps) {
  const { cardRef, innerRef, onMove, onLeave } = useLiquidGlassTilt(disable3D, {
    enableGyroOnAndroidMobile: true,
  });
  const meta = TIPO_META[p.tipo] || { color: '#f97316', rgb: '249,115,22' };
  const videoRef = p.referencias?.find((r) => r.includes('youtu'));

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

        {/* Bloque media: alto fijo; recorte interno para que DepthAwareImage / Parallax no desborden */}
        <div
          style={{
            height: H,
            minHeight: H,
            maxHeight: H,
            flexShrink: 0,
            position: 'relative',
            overflow: 'hidden',
            background: `radial-gradient(ellipse at 35% 40%, rgba(${meta.rgb},0.35) 0%, rgba(0,0,0,0.6) 100%)`,
          }}
        >
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 1 }}>
            {isHovered && youtubeId ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-20 bg-black">
                <iframe
                  title={`Preview ${p.titulo}`}
                  src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=${youtubeId}`}
                  className="h-full w-full object-cover pointer-events-none scale-125"
                  allow="autoplay"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-80" />
              </motion.div>
            ) : p.foto || p.galeria?.[0] ? (
              <DepthAwareImage
                imageUrl={p.foto || p.galeria![0]}
                depthUrl={p.fotoProfundidad}
                alt={p.titulo}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                containerClassName="h-full w-full overflow-hidden"
                force2D={disable3D}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Film size={44} style={{ opacity: 0.18, color: meta.color }} />
              </div>
            )}
          </div>

          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 5,
              pointerEvents: 'none',
              background: 'linear-gradient(to top, rgba(4,4,20,0.9) 0%, rgba(4,4,20,0.25) 60%, transparent 100%)',
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
              boxShadow: `0 4px 14px rgba(${meta.rgb},0.5)`,
            }}
          >
            {p.tipo}
          </div>

          <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {p.esRemunerado && (
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.5)',
                }}
              >
                <DollarSign size={13} color="white" strokeWidth={3} />
              </div>
            )}
            {p.esEstudiante && (
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(59,130,246,0.5)',
                }}
              >
                <GraduationCap size={13} color="white" />
              </div>
            )}
          </div>

          {videoRef && (
            <div
              style={{
                position: 'absolute',
                bottom: 14,
                right: 14,
                zIndex: 10,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8,
                padding: '3px 8px',
                fontSize: 9,
                color: 'rgba(255,255,255,0.7)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              ▶ video
            </div>
          )}
        </div>

        <div
          style={{
            padding: '22px 24px 20px',
            background: `linear-gradient(180deg, rgba(${meta.rgb},0.04) 0%, rgba(0,0,0,0.08) 100%)`,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <h3
            style={{
              margin: '0 0 8px',
              textAlign: 'center',
              fontSize: 17,
              fontWeight: 900,
              color: 'white',
              letterSpacing: '-0.025em',
              lineHeight: 1.2,
              textShadow: `0 0 30px rgba(${meta.rgb},0.4)`,
            }}
          >
            {p.titulo}
          </h3>

          <div
            style={{
              display: 'flex',
              gap: 14,
              justifyContent: 'center',
              marginBottom: 12,
              fontSize: 10,
              color: 'rgba(255,255,255,0.45)',
              fontWeight: 500,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={11} color={meta.color} />
              {p.ciudad}
            </span>
            {p.fechaInicio && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={11} />
                {new Date(p.fechaInicio).toLocaleDateString()}
              </span>
            )}
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
            {p.descripcion}
          </p>

          <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 14 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 13 }}>
              {p.puestos?.slice(0, 3).map((pu) => (
                <span
                  key={pu.id}
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    background: `rgba(${meta.rgb},0.12)`,
                    color: meta.color,
                    padding: '3px 9px',
                    borderRadius: 6,
                    border: `1px solid rgba(${meta.rgb},0.22)`,
                  }}
                >
                  {pu.nombre}
                </span>
              ))}
              {p.puestos && p.puestos.length > 3 && (
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', padding: '3px 4px' }}>+{p.puestos.length - 3}</span>
              )}
              {(!p.puestos || p.puestos.length === 0) && (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>Equipo completo</span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: `rgba(${meta.rgb},0.2)`,
                    border: `1px solid rgba(${meta.rgb},0.4)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 900,
                    color: meta.color,
                  }}
                >
                  {(p.user?.nombre || 'U')[0]}
                </div>
                <span
                  style={{
                    fontSize: 9,
                    color: 'rgba(255,255,255,0.38)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    maxWidth: 72,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.user?.nombre || 'Productor'}
                </span>
              </div>

              <span
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: meta.color,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Ver Ficha <Eye size={11} />
              </span>
            </div>
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
