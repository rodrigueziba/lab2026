// Z80: motor de la caja de ritmos: patrón, reloj de Z78, voces, parámetros 1…10 (Z78) y persistencia.
// - Reloj: el reloj compartido del núcleo (lib/audio/nucleo.ts). La caja fija su BPM y sus pasos por compás y lo arranca
//   o detiene. Cada paso llega con su tiempo exacto de AudioContext (anticipo de Z78) y se programan ahí los golpes
//   (+ retraso del swing en las voces con SWING). Nada de setTimeout para el audio.
// - Play: botón propio del atril (y del menú) y, con SEGUIR_PLAY_ATRIL, el play/pausa del atril de sonido
//   (evento alight:play-estado). La pausa central la maneja el núcleo (pausa el reloj): acá se ignora el evento si
//   PAUSA.activa, para no detener ni reiniciar el compás.
// - Parámetros: "ritmos.bpm" (60…180) y "ritmos.swing" (0…60 %) en el registro central de Z78 (1…10, lineales), con
//   destinos que aplican el valor real: las perillas del atril (y luego cables o MediaPipe) mueven el valor 1…10.
// - Persistencia: sessionStorage "alight:ritmos" (try/catch). El mp3 del atril no se toca: sigue con su propio tiempo.

import { DBG_RITMOS, DBG_AUDIO_NUCLEO } from "@/lib/debugConfig";
import {
  obtenerContexto, contextoNucleo, entradaBus, iniciarReloj, detenerReloj, suscribirPasos, aplicarConfigNucleo, RELOJ, reanudarContexto,
} from "@/lib/audio/nucleo";
import { PARAMETROS, registrar, vincular, fijar, deReal, obtener, type DefParametro } from "@/lib/audio/parametros";
import { crearVoces, type Voces } from "@/lib/audio/ritmosVoces";
import { PAUSA } from "@/lib/pausaExperiencia";
import {
  crearPatron, borrarPatron, alternarCelda, ejemploHouse, remapearPasos, pasosValidos, pistasValidas, retrasoSwing,
  serializarRitmos, restaurarRitmos, type VozId,
} from "@/lib/ritmos";

export const CLAVE_RITMOS = "alight:ritmos";
export const PATRON = crearPatron();
/** Estado leído por el componente y el menú. version sube con cada cambio del patrón. */
export const RITMOS = { version: 0, sonando: false, pasos: 16, cargado: false, golpes: 0 };

const DEF_BPM: DefParametro = { id: "ritmos.bpm", nombre: "BPM", min: 60, max: 180, curva: "lin", defecto: 5.5, unidad: "bpm" };
const DEF_SWING: DefParametro = { id: "ritmos.swing", nombre: "SWING", min: 0, max: 60, curva: "lin", defecto: 1, unidad: "%" };

let _voces: Voces | null = null;
let _vocesCtx: BaseAudioContext | null = null;
let _salida: GainNode | null = null;
let _instalado = false;

function pistas(): VozId[] { return pistasValidas(DBG_RITMOS.PISTAS); }

function voces(): Voces | null {
  const ctx = contextoNucleo();
  if (!ctx) return null;
  if (!_voces || _vocesCtx !== ctx) {
    _voces?.liberar(); _salida?.disconnect();
    _salida = ctx.createGain();
    _salida.gain.value = DBG_RITMOS.VOLUMEN;
    _salida.connect(entradaBus());              // bus maestro de Z78: el analizador lo ve
    _voces = crearVoces(ctx, _salida);
    _vocesCtx = ctx;
  }
  if (_salida) _salida.gain.value = Math.max(0, DBG_RITMOS.VOLUMEN);
  return _voces;
}

// ── programador: un oyente del reloj (sin allocations por paso) ──
function alPaso(paso: number, t: number, _compas: number, durS: number): void {
  if (!DBG_RITMOS.ACTIVO || !RITMOS.sonando) return;
  const v = voces();
  if (!v) return;
  const ids = DBG_RITMOS.PISTAS;
  const n = RITMOS.pasos;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i] as VozId;
    const fila = PATRON[id];
    if (!fila || !fila[paso]) continue;
    const p = DBG_RITMOS.VOZ[id];
    if (!p || p.MUTE) continue;
    const tt = t + (p.SWING ? retrasoSwing(paso, n, DBG_RITMOS.SWING, durS) : 0);
    v.disparar(id, tt, p);
    RITMOS.golpes++;
  }
}

// ── persistencia ──
function almacen(): Storage | null {
  if (!DBG_RITMOS.PERSISTENCIA || typeof window === "undefined") return null;
  try { return window.sessionStorage; } catch { return null; }
}
export function guardarRitmos(): void {
  const st = almacen();
  if (!st) return;
  try { st.setItem(CLAVE_RITMOS, serializarRitmos(PATRON, RITMOS.pasos, DBG_RITMOS.BPM, DBG_RITMOS.SWING)); } catch { /* queda en memoria */ }
}

// ── parámetros ──
function aplicarBpm(real: number): void {
  DBG_RITMOS.BPM = Math.round(Math.min(180, Math.max(60, real)));
  DBG_AUDIO_NUCLEO.BPM = DBG_RITMOS.BPM;
  aplicarConfigNucleo();
}
function aplicarSwing(real: number): void {
  DBG_RITMOS.SWING = Math.round(Math.min(60, Math.max(0, real)));
}
const ahoraCtx = (): number => contextoNucleo()?.currentTime ?? 0;

/** Instala una vez: parámetros, oyente del reloj, evento del play del atril y patrón guardado. */
export function instalarRitmos(): void {
  if (_instalado || typeof window === "undefined") return;
  _instalado = true;
  registrar(PARAMETROS, DEF_BPM);
  registrar(PARAMETROS, DEF_SWING);
  // destinos: aplican el valor real (no son AudioParam: el suavizado no aplica al tempo)
  vincular(PARAMETROS, DEF_BPM.id, { setTargetAtTime: (v: number) => aplicarBpm(v) }, 0);
  vincular(PARAMETROS, DEF_SWING.id, { setTargetAtTime: (v: number) => aplicarSwing(v) }, 0);
  suscribirPasos(alPaso);
  window.addEventListener("alight:play-estado", onPlayAtril);
  // patrón guardado (o vacío)
  RITMOS.pasos = pasosValidos(DBG_RITMOS.PASOS);
  const st = almacen();
  let r: ReturnType<typeof restaurarRitmos> = null;
  if (st) { try { r = restaurarRitmos(st.getItem(CLAVE_RITMOS), PATRON); } catch { r = null; } }
  if (r) { RITMOS.pasos = r.pasos; DBG_RITMOS.PASOS = r.pasos; setBpmRitmos(r.bpm, false); setSwingRitmos(r.swing, false); }
  else { setBpmRitmos(DBG_RITMOS.BPM, false); setSwingRitmos(DBG_RITMOS.SWING, false); }
  RITMOS.cargado = !!r;
  RITMOS.version++;
}

/** BPM real (60…180): pasa por el parámetro 1…10 (así las perillas y los cables ven el mismo valor). */
export function setBpmRitmos(bpm: number, guardar = true): void {
  fijar(PARAMETROS, DEF_BPM.id, deReal(Math.min(180, Math.max(60, bpm)), DEF_BPM), ahoraCtx());
  if (guardar) guardarRitmos();
}
export function setSwingRitmos(sw: number, guardar = true): void {
  fijar(PARAMETROS, DEF_SWING.id, deReal(Math.min(60, Math.max(0, sw)), DEF_SWING), ahoraCtx());
  if (guardar) guardarRitmos();
}
/** Valor 1…10 de una perilla (atril). */
export function setPerillaRitmos(id: "ritmos.bpm" | "ritmos.swing", v: number): void {
  fijar(PARAMETROS, id, v, ahoraCtx());
  guardarRitmos();
}
export function valorPerilla(id: "ritmos.bpm" | "ritmos.swing"): number { return obtener(PARAMETROS, id)?.valor ?? 1; }

// ── play / pausa ──
function aplicarPasosAlReloj(): void {
  const n = RITMOS.pasos;
  DBG_AUDIO_NUCLEO.PASOS_POR_COMPAS = n;
  DBG_AUDIO_NUCLEO.PASOS_POR_PULSO = n / 4;
  DBG_AUDIO_NUCLEO.BPM = DBG_RITMOS.BPM;
}
export function playRitmos(): void {
  if (!DBG_RITMOS.ACTIVO) return;
  instalarRitmos();
  obtenerContexto();
  void reanudarContexto();
  aplicarPasosAlReloj();
  RITMOS.sonando = true;
  iniciarReloj();                       // si la pausa central está activa, el núcleo lo deja pausado
}
export function pausaRitmos(): void {
  RITMOS.sonando = false;
  detenerReloj();
}
export function alternarRitmos(): void { if (RITMOS.sonando) pausaRitmos(); else playRitmos(); }

function onPlayAtril(e: Event): void {
  if (!DBG_RITMOS.SEGUIR_PLAY_ATRIL || PAUSA.activa) return;   // la pausa central ya pausa el reloj del núcleo
  const sonando = !!(e as CustomEvent<{ sonando: boolean }>).detail?.sonando;
  if (sonando && !RITMOS.sonando) playRitmos();
  else if (!sonando && RITMOS.sonando) pausaRitmos();
}

// ── edición ──
/** Click en una celda: pone o saca el cubito. Si lo pone, suena una vista previa de la voz. */
export function tocarCelda(anillo: number, paso: number): boolean {
  const id = pistas()[anillo];
  if (!id) return false;
  const puesto = alternarCelda(PATRON, id, paso);
  RITMOS.version++;
  guardarRitmos();
  if (puesto) {
    obtenerContexto();
    void reanudarContexto();
    const v = voces(), ctx = contextoNucleo();
    if (v && ctx) v.disparar(id, ctx.currentTime + 0.01, DBG_RITMOS.VOZ[id]);
  }
  return puesto;
}
export function borrarRitmos(): void { borrarPatron(PATRON); RITMOS.version++; guardarRitmos(); }
export function cargarEjemploHouse(): void { ejemploHouse(PATRON, RITMOS.pasos); RITMOS.version++; guardarRitmos(); }
/** Cambia los pasos por vuelta (8, 12, 16, 32): remapea el patrón y reinicia el reloj si suena. */
export function setPasosRitmos(n: number): void {
  const nuevo = pasosValidos(n);
  DBG_RITMOS.PASOS = nuevo;
  if (nuevo === RITMOS.pasos) return;
  remapearPasos(PATRON, RITMOS.pasos, nuevo);
  RITMOS.pasos = nuevo;
  RITMOS.version++;
  guardarRitmos();
  if (RITMOS.sonando) { detenerReloj(); playRitmos(); }
}
/** Vista previa de una voz (menú). */
export function probarVoz(id: VozId): void {
  obtenerContexto(); void reanudarContexto();
  const v = voces(), ctx = contextoNucleo();
  if (v && ctx) v.disparar(id, ctx.currentTime + 0.01, DBG_RITMOS.VOZ[id]);
}
export { RELOJ };
