// Z83: el domo de SILLAS proyecta la sesión en vivo de la tarima (o estática de televisión sin señal) según el peso del
// monolito de video (Z82). Lógica PURA, sin imports (prueba: scripts/domo-vivo-test.mjs): geometría de la franja (réplica
// exacta de la rama de dome.frag.glsl) y pesos. La une con DomeSky lib/domoVivoAcciones.ts.
//
// DISEÑO PEDIDO POR EL USUARIO:
//  - Cerca del monolito de video, el domo proyecta lo que se proyecta en la tarima, en TODA la franja de 360° si es
//    posible (el visualizador queda reemplazado debajo); si fuera muy costoso, que se apague el visualizador y la
//    proyección ocupe solo un sector.
//  - La imagen se repite 6 veces alrededor de la franja (coincide con las 6 proyecciones que ve el usuario de la tarima).
//  - Si no hay sesión en la tarima, en lugar del video se ve estática de televisión sin señal (procedural, sin red).
//  - Efecto de tiempo detenido: NO va en esta tarea.
//
// Franja: proyección cilíndrica alrededor del espectador. Horizontal = azimut (vueltas); vertical = tan(elevación), así
// una imagen de ancho W rad tiene alto W / ASPECTO en unidades de tangente y no se deforma vista desde el centro.
//   banda : REPETICIONES imágenes en los 360°, una centrada en el azimut del portal (+ desplazamiento)
//   sector: una sola imagen de SECTOR_ANCHO_DEG, centrada igual; fuera del sector el visualizador se apaga (FONDO)
// Borde suave entre repeticiones: BORDE (fracción del ancho de la imagen; en vertical, la misma medida física).

export const TAU = Math.PI * 2;

export interface CfgDomoVivo {
  REPETICIONES: number; COBERTURA: string; SECTOR_ANCHO_DEG: number; SECTOR_DESPLAZ_DEG: number;
  ASPECTO: number; ELEV_CENTRO_DEG: number; BORDE: number;
}
/** Valores de los uniforms de geometría (uVivoGeo, uVivoCob, uVivoBorde). */
export interface GeoFranja {
  rep: number;        // repeticiones (1 en sector)
  anchoV: number;     // ancho de cada imagen (vueltas)
  alto: number;       // alto (unidades de tan(elevación))
  centro: number;     // centro vertical (tan)
  sector: number;     // 0 banda · 1 sector
  az0: number;        // azimut del centro (vueltas)
  medioSector: number;// medio ancho del sector (vueltas)
  borde: number;
  aspecto: number;
}

const fin = (x: number, d: number): number => (Number.isFinite(x) ? x : d);

export function geometriaFranja(c: CfgDomoVivo, azPortalV: number, out: GeoFranja): GeoFranja {
  const sector = c.COBERTURA === "sector" ? 1 : 0;
  const asp = Math.max(0.2, fin(c.ASPECTO, 16 / 9));
  const rep = sector ? 1 : Math.max(1, Math.min(24, Math.round(fin(c.REPETICIONES, 6))));
  const anchoSector = Math.max(5, Math.min(360, fin(c.SECTOR_ANCHO_DEG, 70))) / 360;
  out.sector = sector; out.rep = rep; out.aspecto = asp;
  out.anchoV = sector ? anchoSector : 1 / rep;
  out.medioSector = anchoSector / 2;
  out.alto = (out.anchoV * TAU) / asp;
  out.centro = Math.tan((Math.max(-10, Math.min(80, fin(c.ELEV_CENTRO_DEG, 18))) * Math.PI) / 180);
  out.az0 = azPortalV + fin(c.SECTOR_DESPLAZ_DEG, 0) / 360;
  out.borde = Math.max(0, Math.min(0.5, fin(c.BORDE, 0.04)));
  return out;
}

const fract = (x: number): number => x - Math.floor(x);
const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Réplica de la rama del shader: dirección (x, y, z) → coordenadas de la imagen y máscara. */
export function mapearFranja(dx: number, dy: number, dz: number, g: GeoFranja, out: { u: number; v: number; dentro: number; mascara: number }) {
  const azV = Math.atan2(dx, -dz) / TAU;
  const rel = fract(azV - g.az0 + 0.5) - 0.5;
  const u = g.sector < 0.5 ? fract(rel / g.anchoV + 0.5) : rel / (2 * g.medioSector) + 0.5;
  const te = dy / Math.max(Math.hypot(dx, dz), 1e-4);
  const v = (te - (g.centro - 0.5 * g.alto)) / g.alto;
  const dentro = u >= 0 && u <= 1 && v >= 0 && v <= 1 ? 1 : 0;
  const bu = Math.max(g.borde, 1e-4), bv = bu * g.aspecto;   // misma medida física que el borde horizontal
  const mascara = dentro * smooth(0, bu, u) * smooth(0, bu, 1 - u) * smooth(0, bv, v) * smooth(0, bv, 1 - v);
  out.u = u; out.v = v; out.dentro = dentro; out.mascara = mascara;
  return out;
}

export type ForzarDomo = "ninguno" | "video" | "estatica" | "apagar";
export interface EntradaPesos { activo: boolean; benchOn: boolean; forzar: string; pesoVideo: number; haySesion: boolean }
export interface PesosDomo { mix: number; staticMix: number; remoteOn: number; necesitaVideo: boolean }
/**
 * uRemoteMix = peso del monolito de video (0…1; sostener y retornar los decide Z82); sin sesión → estática (uStaticMix 1,
 * uRemoteOn 0). Forzados del menú: video 100 %, estática 100 %, apagar. activo/benchOn false → 0 (como antes).
 */
export function pesosDomo(e: EntradaPesos, out: PesosDomo): PesosDomo {
  out.mix = 0; out.staticMix = 1; out.remoteOn = 0; out.necesitaVideo = false;
  if (!e.activo || !e.benchOn || e.forzar === "apagar") return out;
  if (e.forzar === "video") { out.mix = 1; out.staticMix = 0; out.remoteOn = 1; out.necesitaVideo = true; return out; }
  if (e.forzar === "estatica") { out.mix = 1; return out; }
  out.mix = Math.min(1, Math.max(0, fin(e.pesoVideo, 0)));
  if (e.haySesion) { out.staticMix = 0; out.remoteOn = 1; out.necesitaVideo = out.mix > 0; }
  return out;
}
