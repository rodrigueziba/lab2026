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
