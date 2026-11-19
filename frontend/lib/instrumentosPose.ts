// Z99b: posición y yaw ÚNICOS de los instrumentos detrás de la tarima (arco o línea). Todos los consumidores (atril
// BA-40 y su pedestal, aviso "E", tecla E, cámara del modo atril, checkpoints, guía de debug) leen de acá, así que
// cambiar de disposición en vivo no deja nada desfasado. Sin allocations: escribe en objetos de salida reutilizados.
import { DBG_INSTRUMENTOS, DBG_ATRIL_BAJO, DBG_PLAY, DBG_RITMOS, DBG_LAYOUT } from "@/lib/debugConfig";
import { TARIMA_CENTRO, centroSillasEn } from "@/lib/layoutSala";
import { ejeDetrasTarima, bordeTarimaSobreEje, slotsSegunUbicacion, ubicacionRitmos, type Slot, type EjeTarima } from "@/lib/playTarima";
import {
  posicionSlot, pasoArco, radioEfectivo, disposicion, indiceValido, ORDEN_SLOTS, INDICE_MAX,
  type PoseSlot, type PasoArco,
} from "@/lib/instrumentosDisposicion";
import { ATRIL_BAJO } from "@/lib/atrilBajo";

/** Geometría de la tarima y del atril de sonido (la registra LecternSystem al cargar; estos son los valores de hoy). */
export const GEO_INSTRUMENTOS = { atrilX: 1.6, tarimaMedia: 3.192 / 2, tarimaH: 0.267 };

/** Eje centro de la tarima → lado opuesto a las sillas (en vivo con DBG_LAYOUT). */
export const EJE_INSTRUMENTOS: EjeTarima = { cx: 0, cz: 0, ux: 0, uz: 1 };
const _sillas = { x: 0, z: 0 };
function actualizarEje(): EjeTarima {
  centroSillasEn(DBG_LAYOUT, _sillas);
  return ejeDetrasTarima(TARIMA_CENTRO.x, TARIMA_CENTRO.z, _sillas.x, _sillas.z, EJE_INSTRUMENTOS);
}

/** ¿Vale el arco? Solo con la caja detrás de la tarima (Z88) y DISPOSICION "arco". */
export function enArco(): boolean {
  return disposicion(DBG_INSTRUMENTOS.DISPOSICION) === "arco" && ubicacionRitmos(DBG_RITMOS.UBICACION) === "detras_tarima";
}
/** Distancia de la caja de ritmos al centro de la tarima (Z88: borde sobre el eje + DIST_DETRAS_M). */
export function radioCaja(): number {
  actualizarEje();
  return bordeTarimaSobreEje(EJE_INSTRUMENTOS.ux, EJE_INSTRUMENTOS.uz, GEO_INSTRUMENTOS.tarimaMedia) + Math.max(0, DBG_RITMOS.DIST_DETRAS_M);
}
/** Radio del arco: RADIO_M o, con 0, el de la caja. */
export function radioArco(): number { return radioEfectivo(DBG_INSTRUMENTOS.RADIO_M, radioCaja()); }
/** Índice más alto que debe entrar en el tope del arco: INDICE_MAX o, con 0, el mayor ocupado o reservado (y el del BA-40). */
export function indiceMaxArco(): number {
  const v = Math.round(DBG_INSTRUMENTOS.INDICE_MAX);
  if (v >= 1) return Math.min(INDICE_MAX, v);
  let m = Math.abs(indiceValido(DBG_ATRIL_BAJO.INDICE_ARCO));
  for (let k = -INDICE_MAX; k <= INDICE_MAX; k++) if (ORDEN_SLOTS[k] && Math.abs(k) > m) m = Math.abs(k);
  return Math.max(1, m);
}
/** Paso actual del arco (ángulo, separación efectiva, si se redujo, arco total). Para el menú y el reporte. */
export const PASO_ARCO: PasoArco = { angulo: 0, separacion: 0, reducida: false, arcoTotalGrados: 0 };
export function pasoArcoActual(): PasoArco {
  return pasoArco(radioArco(), DBG_INSTRUMENTOS.SEPARACION_M, DBG_INSTRUMENTOS.ARCO_MAX_GRADOS, indiceMaxArco(), PASO_ARCO);
}

const _slots: Slot[] = [];
const _opc = { arcoMaxGrados: 150, indiceMax: INDICE_MAX, mirarAlCentro: true };
/**
 * LA función de posición: pose del instrumento en el índice k desde el centro (0 = caja). Con "arco", el arco; con
 * "linea" (o con la caja en "slot_atril"), el slot de la línea de Z88 que corresponde a k. El índice 0 es siempre la
 * caja, exactamente donde la pone Z88 (no se mueve con RADIO_M). Devuelve false si con "linea" el índice no existe.
 */
export function poseInstrumento(k: number, out: PoseSlot): boolean {
  const g = GEO_INSTRUMENTOS;
  const kk = indiceValido(k);
  if (enArco() && kk !== 0) {
    _opc.arcoMaxGrados = DBG_INSTRUMENTOS.ARCO_MAX_GRADOS;
    _opc.indiceMax = indiceMaxArco();
    _opc.mirarAlCentro = DBG_INSTRUMENTOS.MIRAR_AL_CENTRO;
    actualizarEje();
    posicionSlot(kk, EJE_INSTRUMENTOS, radioArco(), DBG_INSTRUMENTOS.SEPARACION_M, _opc, out);
    return true;
  }
  actualizarEje();
  const s = slotsSegunUbicacion(DBG_PLAY, DBG_RITMOS, g.atrilX, EJE_INSTRUMENTOS, g.tarimaMedia, g.tarimaH, _slots);
  const centro = Math.max(0, Math.min(s.length - 1, Math.floor(DBG_RITMOS.SLOT)));
  const i = kk === 0 ? centro : slotDeIndice(kk, centro, s.length);
  const sl = i >= 0 ? s[i] : undefined;
  if (!sl) return false;
  out.x = sl.x; out.z = sl.z; out.yaw = sl.yaw;
  return true;
}
function slotDeIndice(k: number, centro: number, n: number): number {
  for (let i = 0; i < n; i++) {
    if (i === centro) continue;
    const r = i < centro ? i + 1 : i;
    if ((r % 2 === 1 ? (r + 1) / 2 : -r / 2) === k) return i;
  }
  return -1;
}

/**
 * Pose del BA-40: con "arco", el índice DBG_ATRIL_BAJO.INDICE_ARCO; con "linea", el slot DBG_ATRIL_BAJO.SLOT de Z88
 * (como en Z99). Escribe también ATRIL_BAJO (la posición viva que leen el aviso "E" y la tecla E).
 */
export function poseAtrilBajo(out: PoseSlot): PoseSlot {
  let ok = false;
  if (enArco()) ok = poseInstrumento(DBG_ATRIL_BAJO.INDICE_ARCO, out);
  else {
    const g = GEO_INSTRUMENTOS;
    actualizarEje();
    const s = slotsSegunUbicacion(DBG_PLAY, DBG_RITMOS, g.atrilX, EJE_INSTRUMENTOS, g.tarimaMedia, g.tarimaH, _slots);
    const sl = s[Math.max(0, Math.floor(DBG_ATRIL_BAJO.SLOT))];
    if (sl) { out.x = sl.x; out.z = sl.z; out.yaw = sl.yaw; ok = true; }
  }
  if (ok) { ATRIL_BAJO.x = out.x; ATRIL_BAJO.z = out.z; ATRIL_BAJO.yaw = out.yaw; }
  else { out.x = ATRIL_BAJO.x; out.z = ATRIL_BAJO.z; out.yaw = ATRIL_BAJO.yaw; }
  return out;
}
