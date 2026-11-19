// Z97b: luces de ESCENA del atril de imagen (LUZ -, LUZ +, EXTRA, INTENS., NIVEL). Lógica PURA y SIN imports
// (prueba: scripts/luces-escena-test.mjs). El nivel sigue viviendo en STORE.lights.globalIntensity (lo lee el DiagonalSpot);
// acá están las reglas: pasos acotados, EXTRA on/off sin acumular y el TOPE FINAL que ninguna combinación supera.
//
// Causa del error (Z97b): "LUZ *" / EXTRA agregaba en cada pulsación una luz puntual de 200 cd (hasta 12, sin forma de
// quitarlas) y LUZ - solo bajaba globalIntensity (otra variable): la escena quedaba blanca por el bloom y había que recargar.

/** Constantes (las reales viven en DBG_ATRIL_VIDEO; se pasan como parámetro para poder probar sin el proyecto). */
export interface ConfigLuz {
  LUZ_MIN: number; LUZ_MAX: number; LUZ_PASO: number; LUZ_DEFECTO: number;
  LUZ_TOPE_FINAL: number;       // tope del aporte total (nivel + EXTRA + luces extra viejas), en "veces la luz por defecto"
  EXTRA_APORTE: number;         // cuánto suma EXTRA encendida, en las mismas unidades que el nivel
  EXTRA_REF_CD: number;         // candelas de una luz puntual que equivalen a 1 de aporte
}
export const CONFIG_LUZ_DEFECTO: ConfigLuz = { LUZ_MIN: 0, LUZ_MAX: 3, LUZ_PASO: 0.2, LUZ_DEFECTO: 1, LUZ_TOPE_FINAL: 3, EXTRA_APORTE: 0.6, EXTRA_REF_CD: 100 };

export interface EstadoLuz { nivel: number; extra: boolean }
/** Estado de la tecla EXTRA (el nivel está en STORE.lights.globalIntensity). */
export const LUZ_ESCENA = { extra: false, version: 0 };

const fin = (v: number, d: number) => (Number.isFinite(v) ? v : d);
const r2 = (v: number) => Math.round(v * 100) / 100;

export function acotarNivel(v: number, c: ConfigLuz): number {
  return r2(Math.max(c.LUZ_MIN, Math.min(c.LUZ_MAX, fin(v, c.LUZ_DEFECTO))));
}
/** LUZ + / LUZ - : un paso por pulsación, detenido en los límites. */
export function pasoNivel(nivel: number, signo: 1 | -1, c: ConfigLuz): number {
  return acotarNivel(fin(nivel, c.LUZ_DEFECTO) + signo * Math.abs(c.LUZ_PASO), c);
}
/**
 * Aporte de las luces extra viejas (diseño anterior, STORE.lights.extras) en unidades de nivel: Σ cd / EXTRA_REF_CD.
 * Recibe la suma de candelas (sin arreglos nuevos).
 */
export function aporteExtrasViejas(sumaCd: number, c: ConfigLuz): number { return Math.max(0, fin(sumaCd, 0)) / Math.max(1e-6, c.EXTRA_REF_CD); }

/**
 * Factor k (0…1) que se aplica a TODAS las luces de la escena para que el aporte total no pase LUZ_TOPE_FINAL:
 * total = nivel + (EXTRA ? EXTRA_APORTE : 0) + extras viejas; k = min(1, tope / total).
 */
export function factorTope(nivel: number, extra: boolean, aporteViejas: number, c: ConfigLuz): number {
  const total = Math.max(0, fin(nivel, 0)) + (extra ? Math.max(0, c.EXTRA_APORTE) : 0) + Math.max(0, fin(aporteViejas, 0));
  const tope = Math.max(0, fin(c.LUZ_TOPE_FINAL, 3));
  return total <= tope || total <= 1e-9 ? 1 : tope / total;
}
/** Aporte final (lo que llega a las luces y, por ellas, al bloom): siempre ≤ LUZ_TOPE_FINAL. */
export function aporteFinal(nivel: number, extra: boolean, aporteViejas: number, c: ConfigLuz): number {
  const total = Math.max(0, fin(nivel, 0)) + (extra ? Math.max(0, c.EXTRA_APORTE) : 0) + Math.max(0, fin(aporteViejas, 0));
  return total * factorTope(nivel, extra, aporteViejas, c);
}
/** Multiplicador final del DiagonalSpot (antes: globalIntensity a secas). */
export function multSpot(nivel: number, extra: boolean, aporteViejas: number, c: ConfigLuz): number {
  return Math.max(0, fin(nivel, 0)) * factorTope(nivel, extra, aporteViejas, c);
}
/** Candelas finales de la luz EXTRA única (0 apagada). */
export function cdExtra(nivel: number, extra: boolean, aporteViejas: number, c: ConfigLuz): number {
  return extra ? Math.max(0, c.EXTRA_APORTE) * c.EXTRA_REF_CD * factorTope(nivel, extra, aporteViejas, c) : 0;
}
/** Texto de la lectura NIVEL: "1.0" o "1.0+EX" (el CRT es chico: 128×64). */
export function textoNivel(nivel: number, extra: boolean): string {
  return `${fin(nivel, 0).toFixed(1)}${extra ? "+EX" : ""}`;
}
