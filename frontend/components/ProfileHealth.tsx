'use client';

import React from 'react';
import { CheckCircle, Circle, Link2, Image as ImageIcon, User, Briefcase, Sparkles, Settings, MousePointerClick, Egg, Music, Palette, LayoutGrid, Images, MousePointer } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-slate-600 bg-slate-800/80 text-slate-300 font-mono text-xs font-semibold shadow-sm">
      {children}
    </kbd>
  );
}

function renderTipWithKeys(text: string, shiftLabel: string, spaceLabel: string) {
  const parts = text.split('__SHIFT__');
  if (parts.length === 2) {
    return (
      <>
        {parts[0]}
        <Kbd>{shiftLabel}</Kbd>
        {parts[1]}
      </>
    );
  }
  const partsSpace = text.split('__SPACE__');
  if (partsSpace.length === 2) {
    return (
      <>
        {partsSpace[0]}
        <Kbd>{spaceLabel}</Kbd>
        {partsSpace[1]}
      </>
    );
  }
  return text;
}

interface ProfileHealthProps {
  perfiles: Array<{
    nombre?: string;
    rubro?: string;
    descripcion?: string;
    foto?: string | null;
    videoReel?: string | null;
    web?: string | null;
  }>;
  aplicoAProyecto?: boolean;
  className?: string;
}

const BENEFICIOS_APLICAR = [
  { labelKey: 'profile_health.beneficio_easter_egg', icon: Egg },
  { labelKey: 'profile_health.beneficio_musica_youtube', icon: Music },
  { labelKey: 'profile_health.beneficio_fondos_animados', icon: Palette },
  { labelKey: 'profile_health.beneficio_reorganizar_tarjetas', icon: LayoutGrid },
  { labelKey: 'profile_health.beneficio_galeria_interactiva', icon: Images },
] as const;

const LOGRASTE_ITEMS = [
  { labelKey: 'profile_health.lograste_hover_nombre', icon: MousePointer },
  { labelKey: 'profile_health.lograste_editar_musica', icon: Music },
  { labelKey: 'profile_health.lograste_editar_color', icon: Palette },
  { labelKey: 'profile_health.lograste_editar_galeria', icon: Images },
] as const;

export default function ProfileHealth({ perfiles, aplicoAProyecto = false, className = '' }: ProfileHealthProps) {
  const { t } = useLanguage();
  const tieneCuenta = true;
  const tieneDatosProfesionales = perfiles.some(
    (p) => p.nombre?.trim() && p.rubro?.trim() && (p.descripcion?.trim()?.length ?? 0) >= 20
  );
  const tieneFoto = perfiles.some((p) => p.foto?.trim());
  const tieneReelOPortfolio = perfiles.some((p) => (p.videoReel?.trim() || p.web?.trim()) ?? false);

  const pasos = [
    { labelKey: 'profile_health.cuenta_creada', listo: tieneCuenta, icon: User },
    { labelKey: 'profile_health.datos_profesionales', listo: tieneDatosProfesionales, icon: Briefcase },
    { labelKey: 'profile_health.foto_logo', listo: tieneFoto, icon: ImageIcon },
    { labelKey: 'profile_health.reel_portfolio', listo: tieneReelOPortfolio, icon: Link2 },
  ];
  const completados = pasos.filter((s) => s.listo).length;
  const porcentaje = Math.round((completados / pasos.length) * 100);

  const tips100 = [
    { labelKey: 'profile_health.tip_fondos', icon: Sparkles, useKeys: false },
    { labelKey: 'profile_health.tip_shift', icon: Settings, useKeys: true },
    { labelKey: 'profile_health.tip_espaciadora', icon: MousePointerClick, useKeys: true },
  ];

  return (
    <div className={`bg-slate-900/60 border border-slate-800 rounded-2xl p-6 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
          {t('profile_health.titulo')}
        </h3>
        <div className="flex items-center gap-2">
          <div className="w-28 h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-emerald-500 transition-all duration-500 rounded-full"
              style={{ width: `${porcentaje}%` }}
            />
          </div>
          <span className="text-sm font-black text-white tabular-nums">{porcentaje}%</span>
        </div>
      </div>
      <ul className="space-y-2">
        {pasos.map((paso) => {
          const Icon = paso.icon;
          return (
            <li
              key={paso.labelKey}
              className={`flex items-center gap-3 text-sm ${
                paso.listo ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {paso.listo ? (
                <CheckCircle size={18} className="text-emerald-500 shrink-0" aria-hidden />
              ) : (
                <Circle size={18} className="text-slate-600 shrink-0" aria-hidden />
              )}
              <Icon size={16} className="text-slate-500 shrink-0" aria-hidden />
              <span>{t(paso.labelKey)}</span>
            </li>
          );
        })}
      </ul>

      {porcentaje === 100 && (
        <>
          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              {t('profile_health.beneficios_titulo')}
            </p>
            <ul className="space-y-3">
              {tips100.map((tip) => {
                const Icon = tip.icon;
                const text = t(tip.labelKey);
                const content = tip.useKeys
                  ? renderTipWithKeys(text, t('profile_health.kbd_shift'), t('profile_health.kbd_space'))
                  : text;
                return (
                  <li key={tip.labelKey} className="flex items-start gap-3 text-sm text-slate-300">
                    <Icon size={18} className="text-orange-500 shrink-0 mt-0.5" aria-hidden />
                    <span>{content}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              {t('profile_health.beneficios_aplicar_titulo')}
            </p>
            <ul className="space-y-3">
              {BENEFICIOS_APLICAR.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.labelKey} className="flex items-start gap-3 text-sm text-slate-400">
                    <Icon size={18} className="text-slate-500 shrink-0 mt-0.5" aria-hidden />
                    <span>{t(item.labelKey)}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {aplicoAProyecto && (
            <div className="mt-6 pt-6 border-t border-slate-800">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-3">
                {t('profile_health.lograste_objetivo_titulo')}
              </p>
              <ul className="space-y-3">
                {LOGRASTE_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.labelKey} className="flex items-start gap-3 text-sm text-slate-300">
                      <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" aria-hidden />
                      <Icon size={16} className="text-orange-500 shrink-0 mt-0.5" aria-hidden />
                      <span>{t(item.labelKey)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
