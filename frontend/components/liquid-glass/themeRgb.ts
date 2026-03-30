const DEFAULT_RGB = '234,88,12';

/**
 * Convierte un color hex del perfil (#rrggbb o #rgb) a cadena "r,g,b" para rgba() en estilos inline.
 */
export function hexToRgbString(hex: string): string {
  const raw = hex.replace('#', '').trim();
  if (!raw) return DEFAULT_RGB;
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  if (full.length !== 6 || !/^[0-9a-fA-F]+$/.test(full)) return DEFAULT_RGB;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return DEFAULT_RGB;
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

export function themeFromHex(hex: string | undefined): { color: string; rgb: string } {
  const color = hex?.trim() && hex.startsWith('#') ? hex : '#ea580c';
  return { color, rgb: hexToRgbString(color) };
}
