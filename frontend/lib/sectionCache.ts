/**
 * Cache en memoria para las secciones /guia, /locaciones, /proyectos.
 * TTL: 3 minutos. Si volvés a entrar antes, se usan los datos cacheados.
 */
const TTL_MS = 3 * 60 * 1000; // 3 minutos

type CacheEntry = { data: unknown; timestamp: number };

const cache = new Map<string, CacheEntry>();

function isExpired(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp > TTL_MS;
}

export function getSectionCache<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry | undefined;
  if (!entry || isExpired(entry)) return null;
  return entry.data as T;
}

export function setSectionCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export const SECTION_KEYS = {
  guia: '/guia',
  locaciones: '/locaciones',
  proyectos: '/proyectos',
} as const;
