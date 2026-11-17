// Z76: estado de la huida de la luz para la sesión (contador de visitas, celda, ejes, azar) y su persistencia.
// La lógica es pura (lib/luzHuida.ts); acá se une con DBG_LUZ_MOV, DBG_LUZ y sessionStorage.
// Lo usan LuzLejana (registrar la visita, no abrir la terminal mientras huye), components/LuzHuida.tsx (tick y
// overlay), el checkpoint luz_dialogo (consume la huida pendiente) y el menú de debug.
// Persistencia: DBG_LUZ_MOV.PERSISTENCIA "sesion" = sessionStorage (clave alight:luz-visitas, con try/catch; en el
// servidor no hay window y no se lee nada) · "memoria" = solo este objeto de módulo (se pierde al recargar).

import { DBG_LUZ, DBG_LUZ_MOV } from "@/lib/debugConfig";
import { LUZ_STATE } from "@/lib/caminoLuz";
import {
  crearEstadoHuida, restaurarHuida, serializarHuida, semillaDe, registrarVisita, consumirVisita, reiniciarHuida,
  bloqueaActivacion, diametroHaz, tamCelda, offsetCelda, posicionValidaSala, moverAhora, volverAlOrigen, type CtxHuida,
} from "@/lib/luzHuida";

export const CLAVE_VISITAS = "alight:luz-visitas";
export const HUIDA = crearEstadoHuida(1);

function almacen(): Storage | null {
  if (DBG_LUZ_MOV.PERSISTENCIA !== "sesion" || typeof window === "undefined") return null;
  try { return window.sessionStorage; } catch { return null; }
}
let _cargado = false;
/** Carga una vez (en el cliente) lo guardado en la sesión; si no hay, siembra el azar. */
export function cargarHuida(): void {
  if (_cargado || typeof window === "undefined") return;
  _cargado = true;
  let ok = false;
  const st = almacen();
  if (st) { try { ok = restaurarHuida(HUIDA, st.getItem(CLAVE_VISITAS)); } catch { ok = false; } }
  if (!ok) { HUIDA.semilla = semillaDe(DBG_LUZ_MOV.SEMILLA, Math.random()); HUIDA.rng = HUIDA.semilla; }
}
export function guardarHuida(): void {
  const st = almacen();
  if (!st) return;
  try { st.setItem(CLAVE_VISITAS, serializarHuida(HUIDA)); } catch { /* sin almacenamiento: queda en memoria */ }
}

/** Apertura de la terminal bajo la luz (LuzLejana, girando → dialogo): una visita más. */
export function registrarVisitaLuz(): void {
  cargarHuida();
  registrarVisita(HUIDA, DBG_LUZ_MOV);
  guardarHuida();
}
/** Con movimientos pendientes (y el usuario armado) o con la luz moviéndose no se abre la terminal. */
export function huidaBloqueaActivacion(): boolean {
  return DBG_LUZ_MOV.ACTIVO && bloqueaActivacion(HUIDA);
}
/** Checkpoint luz_dialogo: decide el checkpoint (va a donde esté la luz y abre la terminal sin huida pendiente). */
export function consumirHuidaVisita(): void { cargarHuida(); consumirVisita(HUIDA); guardarHuida(); }

/** Tamaño de celda en vivo (m). */
export function tamCeldaLuz(): number {
  return tamCelda(DBG_LUZ_MOV.TAM_CELDA_M, diametroHaz(DBG_LUZ.CONO_RADIO_M, DBG_LUZ.LUZ_HALO_M));
}

// celda válida para la sala (usa el origen de LUZ_STATE, recalculado por actualizarPosLuz)
const _o = { x: 0, z: 0 };
let _tam = 7.2;
export function celdaValidaLuz(col: number, fila: number): boolean {
  if (col === 0 && fila === 0) return true;   // el origen siempre vale
  offsetCelda(HUIDA, col, fila, _tam, _o);
  const salaM = DBG_LUZ.SALA_MEDIA_M - DBG_LUZ.SALA_MARGEN_M;
  const bordeOrigen = Math.max(Math.abs(LUZ_STATE.xBase), Math.abs(LUZ_STATE.zBase));
  return posicionValidaSala(LUZ_STATE.xBase + _o.x, LUZ_STATE.zBase + _o.z, bordeOrigen, salaM, DBG_LUZ.EXTERIOR_RADIO_M, DBG_LUZ_MOV.CORREDOR_M);
}

/** Contexto del frame (objeto reutilizado). */
export const CTX_HUIDA: CtxHuida = { vx: 0, vz: 0, dLuz: 999, tam: 7.2, libre: false, valida: celdaValidaLuz };
/** Escribe el contexto con la posición del usuario (cx, cz). Llamar después de actualizarPosLuz(). */
export function prepararCtxHuida(cx: number, cz: number, libre: boolean): CtxHuida {
  _tam = CTX_HUIDA.tam = tamCeldaLuz();
  CTX_HUIDA.vx = cx - LUZ_STATE.xBase; CTX_HUIDA.vz = cz - LUZ_STATE.zBase;
  CTX_HUIDA.dLuz = Math.hypot(cx - LUZ_STATE.x, cz - LUZ_STATE.z);
  CTX_HUIDA.libre = libre;
  return CTX_HUIDA;
}

// ── botones de debug ──
export function simularVisitaLuz(): void { registrarVisitaLuz(); }
export function reiniciarVisitasLuz(): void {
  reiniciarHuida(HUIDA, semillaDe(DBG_LUZ_MOV.SEMILLA, Math.random()));
  const st = almacen();
  if (st) { try { st.removeItem(CLAVE_VISITAS); } catch { /* ok */ } }
}
export function moverLuzAhora(): boolean { cargarHuida(); const ok = moverAhora(HUIDA, DBG_LUZ_MOV, CTX_HUIDA); guardarHuida(); return ok; }
export function volverLuzAlOrigen(): void { volverAlOrigen(HUIDA, DBG_LUZ_MOV); guardarHuida(); }
