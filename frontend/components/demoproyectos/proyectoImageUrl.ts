import type { Proyecto } from '@/types/proyecto';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/** URL absoluta para textura WebGL (CORS según el backend). */
export function proyectoImageUrl(p: Proyecto): string {
  const raw = p.foto || p.galeria?.[0];
  if (!raw) return '/file.svg';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return raw.startsWith('/') ? `${apiUrl}${raw}` : `${apiUrl}/${raw}`;
}
