// Z79: PLAY del atril de sonido, unido al motor de los atriles (audioEngine), al núcleo de audio (Z78) y a la pausa
// central. La lógica de decisión es pura (lib/playTarima.ts).
// - prepararSinAutoplay(): lo llama LecternSystem cuando aparecen los atriles y DBG_PLAY.AUTOPLAY es false. El motor y
//   la lista de pistas quedan listos (los controles del atril ya afectan la cadena), el <audio> sin pista y
//   STORE.audio.paused = true (así la pausa central no lo toca).
// - alternarPlay(): botón grande y PLAY/PAUSA chico. Se llama dentro del gesto (pointerdown o tecla): reanuda el
//   AudioContext ahí mismo (política de autoplay; Safari exige reanudar en el gesto) y después reproduce o pausa.
// - El estado "sonando" sale de los eventos del <audio> (play, playing, pause, ended): también lo cambian ANT./SIG.,
//   la pausa central y los checkpoints. Al cambiar se emite window "alight:play-estado" { sonando, iniciado }.
// Los listeners del <audio> quedan puestos mientras viva la página: el motor de los atriles también (no se destruye).

import { DBG_AUDIO_NUCLEO } from "@/lib/debugConfig";
import { STORE, storeNotify } from "@/lib/alightStore";
import { getAudioElement, getAudioContext, playTrack, togglePlayPause } from "@/lib/audioEngine";
import { reanudarContexto } from "@/lib/audio/nucleo";
import { PAUSA } from "@/lib/pausaExperiencia";
import { PLAY_TARIMA, accionAlternar, accionPlay, accionPausa, actualizarPlay, type AccionPlay, type EntradaPlay } from "@/lib/playTarima";

const ENTRADA: EntradaPlay = { motorListo: false, hayPistas: false, cargado: false, sonando: false, pausaCentral: false };

function leerEntrada(): EntradaPlay {
  const el = getAudioElement();
  ENTRADA.motorListo = !!el && !!getAudioContext();
  ENTRADA.hayPistas = STORE.audio.tracks.length > 0;
  ENTRADA.cargado = !!el && !!el.getAttribute("src");
  ENTRADA.sonando = !!el && !el.paused && !el.ended;
  ENTRADA.pausaCentral = PAUSA.activa;
  return ENTRADA;
}

function emitir(): void {
  const el = getAudioElement();
  const sonando = !!el && !el.paused && !el.ended;
  const iniciado = !!el && !!el.getAttribute("src");
  if (actualizarPlay(PLAY_TARIMA, sonando, iniciado) && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("alight:play-estado", { detail: { sonando, iniciado } }));
  }
}

let _escuchando: HTMLAudioElement | null = null;
/** Engancha el estado a los eventos del <audio> del motor (una vez). */
export function instalarEstadoPlay(): void {
  const el = getAudioElement();
  if (!el || _escuchando === el) return;
  for (const ev of ["play", "playing", "pause", "ended", "emptied"]) el.addEventListener(ev, emitir);
  _escuchando = el;
  emitir();
}

/** Sin autoplay: motor listo, nada sonando. */
export function prepararSinAutoplay(): void {
  instalarEstadoPlay();
  const el = getAudioElement();
  if (el && !el.paused) el.pause();   // un remontaje (checkpoint) no deja sonando la pista anterior
  STORE.audio.paused = true;
  storeNotify();
  emitir();
}

function reanudarCtxEnGesto(): void {
  if (DBG_AUDIO_NUCLEO.ACTIVO) { void reanudarContexto(); return; }
  const ctx = getAudioContext();
  if (ctx && ctx.state !== "running") ctx.resume().catch(() => {});
}

function ejecutar(a: AccionPlay): AccionPlay {
  const el = getAudioElement();
  if (a === "ignorar" || !el) return "ignorar";
  if (a !== "pausar") reanudarCtxEnGesto();
  if (a === "iniciar") {
    void playTrack(STORE.audio.trackIndex);
  } else if (a === "reanudar") {
    if (STORE.audio.paused) togglePlayPause();
    else el.play().catch(() => {});
  } else {
    if (!STORE.audio.paused) togglePlayPause();
    else el.pause();
  }
  return a;
}

/** Botón grande / PLAY/PAUSA del atril: alterna. Devuelve la acción tomada. */
export function alternarPlay(): AccionPlay { return ejecutar(accionAlternar(leerEntrada())); }
/** "Play" del menú u otros sistemas (no pausa si ya suena). */
export function playTarima(): AccionPlay { return ejecutar(accionPlay(leerEntrada())); }
/** "Pausa" del menú u otros sistemas. */
export function pausaTarima(): AccionPlay { return ejecutar(accionPausa(leerEntrada())); }

/** Estado del contexto de audio de la tarima, para la línea de estado del menú. */
export function estadoContextoTarima(): string {
  return getAudioContext()?.state ?? "sin crear";
}
