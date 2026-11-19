// Z79: botón de PLAY del atril de sonido (camino TARIMA). Lógica PURA, sin imports (prueba: scripts/play-tarima-test.mjs).
// La música del atril ya no arranca sola (DBG_PLAY.AUTOPLAY = false): el motor (audioEngine) se prepara igual que antes
// al aparecer los atriles (cadena de efectos, lista de pistas), pero no reproduce hasta que el usuario aprieta PLAY.
// Estado "sonando" para otros sistemas (instrumentos, atril de video): PLAY_TARIMA.sonando y el evento window
// "alight:play-estado" { sonando, iniciado } (lo emite lib/playTarimaAcciones.ts solo cuando cambia).
// Slots de los atriles futuros (instrumentos): detrás del atril de sonido, mirando al centro de la tarima como los atriles.

export interface CfgPlay { AUTOPLAY: boolean }
export type AccionPlay = "iniciar" | "reanudar" | "pausar" | "ignorar";
export interface EntradaPlay {
  motorListo: boolean;    // audioEngine inicializado (elemento <audio> y contexto)
  hayPistas: boolean;     // lista de /api/music cargada con al menos una pista
  cargado: boolean;       // el <audio> ya tiene una pista puesta (se apretó play alguna vez, o anterior/siguiente)
  sonando: boolean;       // el <audio> está reproduciendo
  pausaCentral: boolean;  // pausa central de la experiencia (camino LUZ): no se arranca nada
}

/** ¿El motor reproduce solo al cargarse (comportamiento anterior a Z79)? */
export function arrancaSolo(c: CfgPlay): boolean { return !!c.AUTOPLAY; }

/** Botón PLAY/PAUSA (alterna). */
export function accionAlternar(e: EntradaPlay): AccionPlay {
  if (!e.motorListo || !e.hayPistas) return "ignorar";
  if (e.sonando) return "pausar";
  if (e.pausaCentral) return "ignorar";
  return e.cargado ? "reanudar" : "iniciar";
}
/** "Play" explícito (menú, otros sistemas): nunca pausa. */
export function accionPlay(e: EntradaPlay): AccionPlay {
  const a = accionAlternar(e);
  return a === "pausar" ? "ignorar" : a;
}
/** "Pausa" explícita: solo si suena. */
export function accionPausa(e: EntradaPlay): AccionPlay {
  return e.motorListo && e.sonando ? "pausar" : "ignorar";
}

/** Estado compartido (lo escribe playTarimaAcciones con los eventos del <audio>). */
export const PLAY_TARIMA = { sonando: false, iniciado: false, cambios: 0 };
/** Actualiza el estado; devuelve true si cambió (para emitir el evento una sola vez por cambio). */
export function actualizarPlay(st: typeof PLAY_TARIMA, sonando: boolean, iniciado: boolean): boolean {
  if (st.sonando === sonando && st.iniciado === iniciado) return false;
  st.sonando = sonando; st.iniciado = iniciado; st.cambios++;
  return true;
}

// ── slots de los atriles de instrumentos ──
export interface CfgSlots { SLOTS_N: number; SLOTS_DIST_M: number; SLOTS_SEP_M: number; SLOTS_ARCO_GRADOS: number }
export interface Slot { x: number; y: number; z: number; yaw: number; sobreTarima: boolean }

/**
 * Slots detrás del atril de sonido (en el espacio de LecternSystem: centro de la tarima en x = z = 0).
 * atrilX = posición x del atril de sonido (+LECTERN_PLACE_X); su frente mira a −x (al centro).
 * "Detrás" = +x, a SLOTS_DIST_M; repartidos en z cada SLOTS_SEP_M, centrados; con SLOTS_ARCO_GRADOS > 0 se curvan en
 * arco alrededor del atril de sonido (los extremos se acercan al centro). Cada slot mira al centro de la tarima (yaw
 * como los atriles: atan2(dx, dz) hacia el centro). y = altura de la tarima si cae sobre ella, 0 (piso) si no.
 */
export function slotsInstrumentos(c: CfgSlots, atrilX: number, tarimaMedia: number, tarimaH: number, out: Slot[] = []): Slot[] {
  const n = Math.max(0, Math.min(12, Math.floor(Number.isFinite(c.SLOTS_N) ? c.SLOTS_N : 0)));
  const dist = Math.max(0, Number.isFinite(c.SLOTS_DIST_M) ? c.SLOTS_DIST_M : 1.4);
  const sep = Math.max(0, Number.isFinite(c.SLOTS_SEP_M) ? c.SLOTS_SEP_M : 1.7);
  const arco = (Number.isFinite(c.SLOTS_ARCO_GRADOS) ? c.SLOTS_ARCO_GRADOS : 0) * Math.PI / 180;
  out.length = n;
  for (let i = 0; i < n; i++) {
    const k = i - (n - 1) / 2;                 // −… 0 … +
    let x = atrilX + dist, z = k * sep;
    if (arco > 0 && n > 1) {
      // arco de radio dist alrededor del atril de sonido, ángulo total = arco
      const a = (n === 1 ? 0 : (k / ((n - 1) / 2)) * (arco / 2));
      const r = Math.max(dist, (sep * (n - 1)) / Math.max(1e-6, arco));
      x = atrilX + r * Math.cos(a) - (r - dist);
      z = r * Math.sin(a);
    }
    const sobre = Math.abs(x) <= tarimaMedia && Math.abs(z) <= tarimaMedia;
    const s = out[i] ?? (out[i] = { x: 0, y: 0, z: 0, yaw: 0, sobreTarima: false });
    s.x = x; s.z = z; s.sobreTarima = sobre;
    s.y = sobre ? tarimaH : 0;
    s.yaw = Math.atan2(-x, -z);                // local +Z mira al centro (0, 0)
  }
  return out;
}

// ── Z81: pedestal de los atriles de instrumentos ──
export interface CfgPedestal { SLOTS_PEDESTAL: boolean; SLOTS_PEDESTAL_ALTURA_M: string | number }
/**
 * Altura (m) de la base bajo un atril de instrumentos para que quede a la misma altura de uso que el atril de sonido
 * (que está sobre la tarima): "auto" = tarimaH − slotY (0 si el slot ya está sobre la tarima). La cámara del jugador
 * va siempre a la misma altura, esté o no sobre la tarima, así que un atril en el piso queda tarimaH más bajo a la vista.
 */
export function alturaPedestal(c: CfgPedestal, slotY: number, tarimaH: number): number {
  if (!c.SLOTS_PEDESTAL) return 0;
  const v = c.SLOTS_PEDESTAL_ALTURA_M;
  if (v === "auto" || typeof v !== "number" || !Number.isFinite(v)) return Math.max(0, (Number.isFinite(tarimaH) ? tarimaH : 0) - (Number.isFinite(slotY) ? slotY : 0));
  return Math.max(0, Math.min(1.5, v));
}

// ── Z88: ubicación de la caja de ritmos y de los slots: "detras_tarima" (default) | "slot_atril" (Z79/Z80) ──
// Eje = centro de la fila de sillas → centro de la tarima, prolongado: la caja va más allá del borde de la tarima
// opuesto a las sillas, a DIST_DETRAS_M del borde, sobre el eje, mirando al centro de la tarima. Los slots, en línea
// perpendicular al eje, separados SLOTS_SEP_M, con el slot de la caja (SLOT) en el centro (sobre el eje) y los demás
// alternados: +1 hacia la derecha del eje visto desde las sillas (hoy +X, el lado del atril de sonido), −1, +2, −2…
// SLOTS_ARCO_GRADOS y SLOTS_DIST_M solo valen en "slot_atril".
export type UbicacionRitmos = "detras_tarima" | "slot_atril";
export function ubicacionRitmos(v: string | undefined): UbicacionRitmos { return v === "slot_atril" ? "slot_atril" : "detras_tarima"; }
export interface CfgUbicacion { UBICACION: string; DIST_DETRAS_M: number; SLOT: number }
/** Centro de la tarima (cx, cz) y dirección unitaria (ux, uz) tarima → lado opuesto a las sillas. */
export interface EjeTarima { cx: number; cz: number; ux: number; uz: number }

/** Escribe el eje desde el centro de la tarima y el de la fila de sillas. Si coinciden, (0, 1) (hoy: sillas en −Z). */
export function ejeDetrasTarima(tx: number, tz: number, sx: number, sz: number, out: EjeTarima): EjeTarima {
  const dx = tx - sx, dz = tz - sz, l = Math.hypot(dx, dz);
  out.cx = tx; out.cz = tz;
  if (!(l > 1e-6)) { out.ux = 0; out.uz = 1; } else { out.ux = dx / l; out.uz = dz / l; }
  return out;
}
/** Distancia del centro al borde de la tarima (cuadrada, alineada a los ejes, medio lado `media`) sobre la dirección u. */
export function bordeTarimaSobreEje(ux: number, uz: number, media: number): number {
  return Math.max(0, media) / Math.max(1e-6, Math.abs(ux), Math.abs(uz));
}
/** Múltiplo de SLOTS_SEP_M del slot i (el slot `centro` = 0; los demás 1, −1, 2, −2… en orden de índice). */
export function desplazamientoSlot(i: number, centro: number): number {
  if (i === centro) return 0;
  const r = i < centro ? i + 1 : i;            // rango 1, 2, 3… saltando el centro
  return r % 2 === 1 ? (r + 1) / 2 : -r / 2;
}

/** Slots detrás de la tarima (ver arriba). slotCentro = DBG_RITMOS.SLOT (se recorta a 0…n−1). */
export function slotsDetrasTarima(c: CfgSlots, eje: EjeTarima, distDetras: number, slotCentro: number,
  tarimaMedia: number, tarimaH: number, out: Slot[] = []): Slot[] {
  const n = Math.max(0, Math.min(12, Math.floor(Number.isFinite(c.SLOTS_N) ? c.SLOTS_N : 0)));
  const sep = Math.max(0, Number.isFinite(c.SLOTS_SEP_M) ? c.SLOTS_SEP_M : 1.7);
  const dist = Math.max(0, Number.isFinite(distDetras) ? distDetras : 2);
  const centro = Math.max(0, Math.min(n - 1, Math.floor(Number.isFinite(slotCentro) ? slotCentro : 0)));
  const r0 = bordeTarimaSobreEje(eje.ux, eje.uz, tarimaMedia) + dist;
  const bx = eje.cx + eje.ux * r0, bz = eje.cz + eje.uz * r0;
  const px = eje.uz, pz = -eje.ux;             // perpendicular: derecha del eje mirando desde las sillas hacia la tarima
  out.length = n;
  for (let i = 0; i < n; i++) {
    const k = desplazamientoSlot(i, centro) * sep;
    const x = bx + px * k, z = bz + pz * k;
    const sobre = Math.abs(x - eje.cx) <= tarimaMedia && Math.abs(z - eje.cz) <= tarimaMedia;
    const s = out[i] ?? (out[i] = { x: 0, y: 0, z: 0, yaw: 0, sobreTarima: false });
    s.x = x; s.z = z; s.sobreTarima = sobre;
    s.y = sobre ? tarimaH : 0;
    s.yaw = Math.atan2(eje.cx - x, eje.cz - z);  // local +Z mira al centro de la tarima
  }
  return out;
}

/** Slots según DBG_RITMOS.UBICACION: "detras_tarima" (Z88) o "slot_atril" (slotsInstrumentos de Z79, intacto). */
export function slotsSegunUbicacion(c: CfgSlots, u: CfgUbicacion, atrilX: number, eje: EjeTarima,
  tarimaMedia: number, tarimaH: number, out: Slot[] = []): Slot[] {
  if (ubicacionRitmos(u.UBICACION) === "slot_atril") return slotsInstrumentos(c, atrilX, tarimaMedia, tarimaH, out);
  return slotsDetrasTarima(c, eje, u.DIST_DETRAS_M, u.SLOT, tarimaMedia, tarimaH, out);
}

// ── Z88: ¿cuándo sale la caja? ──
/** true = la caja sale con los atriles (su animación arranca con la de ellos); false = al apretar play (Z80). */
export function cajaSaleConAtriles(aparecerTrasPlay: boolean, mostrar: string): boolean {
  return mostrar === "siempre" || !aparecerTrasPlay;
}
