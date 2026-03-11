'use client';

import { CheckCircle, Circle, Link2, Image as ImageIcon, User, Briefcase } from 'lucide-react';

interface ProfileHealthProps {
  perfiles: Array<{
    nombre?: string;
    rubro?: string;
    descripcion?: string;
    foto?: string | null;
    videoReel?: string | null;
    web?: string | null;
  }>;
  className?: string;
}

export default function ProfileHealth({ perfiles, className = '' }: ProfileHealthProps) {
  const tieneCuenta = true;
  const tieneDatosProfesionales = perfiles.some(
    (p) => p.nombre?.trim() && p.rubro?.trim() && (p.descripcion?.trim()?.length ?? 0) >= 20
  );
  const tieneFoto = perfiles.some((p) => p.foto?.trim());
  const tieneReelOPortfolio = perfiles.some((p) => (p.videoReel?.trim() || p.web?.trim()) ?? false);

  const pasos = [
    { label: 'Cuenta creada', listo: tieneCuenta, icon: User },
    { label: 'Completar datos profesionales', listo: tieneDatosProfesionales, icon: Briefcase },
    { label: 'Subir foto o logo', listo: tieneFoto, icon: ImageIcon },
    { label: 'Añadir enlaces al reel o portafolio', listo: tieneReelOPortfolio, icon: Link2 },
  ];
  const completados = pasos.filter((s) => s.listo).length;
  const porcentaje = Math.round((completados / pasos.length) * 100);

  return (
    <div className={`bg-slate-900/60 border border-slate-800 rounded-2xl p-6 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
          Salud de tu perfil
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
              key={paso.label}
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
              <span>{paso.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
