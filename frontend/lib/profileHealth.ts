/**
 * Misma lógica que ProfileHealth: calcula si el usuario tiene 100% de salud de perfil.
 * Usado para decidir si mostrar OpalBackground en detalle de proyecto y detalle de prestador.
 * Acepta objetos con camelCase o snake_case por si la API serializa distinto.
 */
export interface PerfilParaSalud {
  nombre?: string;
  rubro?: string;
  descripcion?: string;
  foto?: string | null;
  videoReel?: string | null;
  web?: string | null;
}

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function pick(obj: Record<string, unknown>, ...keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (obj[k] !== undefined) out[k] = obj[k];
    else {
      const snake = toSnakeCase(k);
      if (obj[snake] !== undefined) out[k] = obj[snake];
    }
  }
  return out;
}

/** Normaliza un ítem de la API a PerfilParaSalud (camelCase o snake_case). */
export function normalizePerfilParaSalud(raw: Record<string, unknown>): PerfilParaSalud {
  const o = pick(raw, 'nombre', 'rubro', 'descripcion', 'foto', 'videoReel', 'web');
  return {
    nombre: typeof o.nombre === 'string' ? o.nombre : undefined,
    rubro: typeof o.rubro === 'string' ? o.rubro : undefined,
    descripcion: typeof o.descripcion === 'string' ? o.descripcion : undefined,
    foto: typeof o.foto === 'string' ? o.foto : o.foto === null ? null : undefined,
    videoReel: typeof o.videoReel === 'string' ? o.videoReel : o.videoReel === null ? null : undefined,
    web: typeof o.web === 'string' ? o.web : o.web === null ? null : undefined,
  };
}

export function isProfileHealth100(perfiles: PerfilParaSalud[] | Record<string, unknown>[]): boolean {
  const list = Array.isArray(perfiles) ? perfiles : [];
  if (list.length === 0) return false;
  const normalized = list.map((p) =>
    p && typeof p === 'object'
      ? normalizePerfilParaSalud(p as Record<string, unknown>)
      : ({} as PerfilParaSalud)
  );
  const tieneCuenta = true;
  const tieneDatosProfesionales = normalized.some(
    (p) =>
      p.nombre?.trim() &&
      p.rubro?.trim() &&
      (p.descripcion?.trim()?.length ?? 0) >= 20
  );
  const tieneFoto = normalized.some((p) => (p.foto != null && String(p.foto).trim() !== ''));
  const tieneReelOPortfolio = normalized.some(
    (p) => (p.videoReel != null && String(p.videoReel).trim() !== '') || (p.web != null && String(p.web).trim() !== '')
  );
  return tieneCuenta && tieneDatosProfesionales && tieneFoto && tieneReelOPortfolio;
}
