'use client';

import dynamic from 'next/dynamic';

const Parallax3D = dynamic(() => import('@/components/Parallax3D'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-slate-800/50 animate-pulse" />,
});

type Props = {
  imageUrl: string;
  depthUrl?: string | null;
  alt: string;
  className?: string;
  /** Clase extra para el contenedor cuando se usa Parallax (ej. rounded-full overflow-hidden) */
  containerClassName?: string;
  /** Si true, siempre muestra la imagen 2D (útil en iPhone para evitar permisos que tapan la página) */
  force2D?: boolean;
};

/**
 * Muestra la imagen normal o el efecto Parallax 3D si existe mapa de profundidad.
 */
export default function DepthAwareImage({
  imageUrl,
  depthUrl,
  alt,
  className = '',
  containerClassName = 'w-full h-full overflow-hidden',
  force2D = false,
}: Props) {
  if (!imageUrl) return null;

  if (depthUrl && !force2D) {
    return (
      <div className={containerClassName || 'w-full h-full overflow-hidden'}>
        <Parallax3D imageUrl={imageUrl} depthUrl={depthUrl} />
      </div>
    );
  }

  return <img src={imageUrl} alt={alt} className={className} />;
}
