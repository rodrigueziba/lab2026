"use client";
// Z70: pestaña "Camino TARIMA (atriles)" del menú de debug. Cada sección es el código movido tal cual desde DebugMenu.tsx;
// toma del contexto (useDbg) solo el estado que usa. Registro y orden: lib/debugSecciones.ts.
import { useEffect, useState } from "react";
import { DBG_DOME, DBG_LECTERNS, DBG_CAM_IMAGE, DBG_CAM_SOUND, DBG_RETRO, DBG_FACE, DBG_AUDIO_NUCLEO, DBG_PLAY, DBG_RITMOS, DBG_ONDAS_TARIMA, DBG_CONSENT, DBG_LIVEKIT, DBG_ATRIL_SONIDO, DBG_ATRIL_VIDEO, DBG_BAJO, DBG_ATRIL_BAJO, DBG_INSTRUMENTOS, DBG_CARA, DBG_SINTE, DBG_ATRIL_SINTE, DBG_SAMPLER, DBG_ATRIL_SAMPLER } from "@/lib/debugConfig";
import { mostrarTexto1Ahora, mostrarEleccionAhora, cortarTransmision, reiniciarConsentimiento, textoEstadoConsent, modoActual } from "@/lib/consentTarimaAcciones";   // Z91
import { publicarLiveKit, detenerLiveKit, textoEstadoLiveKit, alternarPanelCuadro, panelCuadroVisible } from "@/lib/vivo/publicarLiveKit";   // Z92 · Z94b
import { sesionIdNavegador } from "@/lib/vivo/vivoAcciones";   // Z92
import { reintentarCamara, textoEstadoFuente } from "@/lib/fuenteVideoTarima";   // Z87
import { setLecternRetro, syncRetroUniforms } from "@/lib/retro/lecternMaterials";
import { STORE, storeNotify } from "@/lib/alightStore";
import { LUZ_ESCENA } from "@/lib/lucesEscena";                       // Z97b
import { textoCronoVis } from "@/lib/visualizadorTarimaDibujo";        // Z98
import { BAJO, PARAMS as PARAMS_BAJO_EST, cargarPatron, patronLimpio, setParamBajo, aplicarParamsBajo, silenciarYReiniciarBajo, bpmBajo } from "@/lib/audio/bajoAcido";   // Z99
import { PARAMS_BAJO, NOMBRES_PATRON, nombreNota, indiceParam } from "@/lib/bajoAcido";   // Z99
import { restaurarLucesEscena } from "@/lib/lucesEscenaAcciones";    // Z97b
import { radioCaja, radioArco, pasoArcoActual, indiceMaxArco, poseInstrumento, enArco } from "@/lib/instrumentosPose";   // Z99b
import { ORDEN_SLOTS, INDICE_MAX } from "@/lib/instrumentosDisposicion";                   // Z99b
import { irAInstrumento } from "@/lib/checkpointsAcciones";                                // Z99b
import { CARA, EST as EST_CARA, encenderCara, apagarCara, calibrarCara, olvidarCalibracion } from "@/lib/caraBajo";   // Z100
import { NOMBRES_GESTO } from "@/lib/cara";                                                  // Z100
import { SINTE, PARAMS_SY, VOCES, MANTENIDAS, ARP, cargarSonidoSinte, setParamSinte, aplicarOpcionesSinte, silenciarYReiniciarSinte, notaAbajo, notaArriba, bpmSinte } from "@/lib/audio/sinte";   // Z101
import { SAMPLER, EST as EST_SAMPLER, RANURAS, silenciarYReiniciarSampler, padAbajo, padArriba, seleccionarPad, setParamSampler, aplicarOpcionesSampler, grabar, pararGrabacion, borrarPad } from "@/lib/audio/sampler";   // Z103
import { MUESTREO, DIAG_MIC, probarMicrofono, actualizarDiagMic, estadoAudioYGrabador, textoGrabacion } from "@/lib/audio/sampler";   // Z106
import { MENSAJES_MUESTREO } from "@/lib/muestreoGrabacion";   // Z106
import { PARAMS_SAMPLER, QUANTS, FUENTES_GRAB, N_PADS, manualIdx as manualIdxSampler } from "@/lib/sampler";   // Z103
import { PARAMS_SINTE, NOMBRES_SONIDO, PATRONES_ARP, VELOCIDADES_ARP, nombreSonido, nombreNota as nombreNotaSinte, indiceParam as indiceParamSinte } from "@/lib/sinte";   // Z101
import { LABEL, ROW, INPUT, NOTE, NumField, EFFECT_NAMES } from "../comun";
import { useDbg } from "../contexto";
import { RITMOS, playRitmos, pausaRitmos, borrarRitmos, cargarEjemploHouse, setBpmRitmos, setSwingRitmos, setPasosRitmos, probarVoz, guardarRitmos } from "@/lib/ritmosMotor"; // Z80
import { pistasValidas, NOMBRE_VOZ, PASOS_VALIDOS, VOCES_IDS, type VozId } from "@/lib/ritmos";   // Z80
import { PLAY_TARIMA } from "@/lib/playTarima";                                             // Z79
import { EJE_TARIMA, UBIC_SLOTS } from "@/components/PlayTarima";                             // Z88
import { ATRIL_RITMOS } from "@/lib/ritmos";                                                 // Z88
import { playTarima, pausaTarima, estadoContextoTarima } from "@/lib/playTarimaAcciones";      // Z79
import { aplicarConfigNucleo, iniciarReloj, detenerReloj, setMetronomo, setRuidoPrueba, setOverlayNivel, actualizarEstadoNucleo } from "@/lib/audio/nucleo"; // Z78

// sección: stars
export function SecStars() {
  const { stars, setStarTwinkle } = useDbg();
  return (
    <>
          <span style={LABEL}>Stars <span style={NOTE}>(twinkleSpeed is live)</span></span>
          <NumField
            label="twinkleSpeed"
            value={stars.twinkleSpeed}
            step={0.05}
            min={0}
            max={5}
            onChange={setStarTwinkle}
          />
          <NumField label="fadeDurMs"     value={stars.fadeDurMs}     note="reload" />
          <NumField label="count"         value={stars.count}         note="reload" />
          <NumField label="sizeMin"       value={stars.sizeMin}       note="reload" step={0.01} />
          <NumField label="sizeMax"       value={stars.sizeMax}       note="reload" step={0.01} />
          <NumField label="brightnessMin" value={stars.brightnessMin} note="reload" step={0.01} />
          <NumField label="brightnessMax" value={stars.brightnessMax} note="reload" step={0.01} />
    </>
  );
}

// sección: dome
export function SecDome() {
  const { dome, setDome } = useDbg();
  return (
    <>
          <span style={LABEL}>Dome <span style={NOTE}>(sector effects live)</span></span>
          <NumField label="delayMs"          value={dome.delayMs}          note="next activation" step={500} onChange={v => { DBG_DOME.delayMs = v;          setDome(d => ({ ...d, delayMs:          v })); }} />
          <NumField label="glitchIntervalMs" value={dome.glitchIntervalMs} note="next activation" step={500} onChange={v => { DBG_DOME.glitchIntervalMs = v; setDome(d => ({ ...d, glitchIntervalMs: v })); }} />
    </>
  );
}

// sección: sector-effects
export function SecSectorEffects() {
  const { setSector } = useDbg();
  return (
    <>
          <span style={LABEL}>Sector effects <span style={NOTE}>(live)</span></span>
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={ROW}>
              <span>S{i}</span>
              <select
                style={{ ...INPUT, width: 110 }}
                defaultValue={i}
                onChange={e => setSector(i, Number(e.target.value))}
              >
                {EFFECT_NAMES.map((name, idx) => (
                  <option key={idx} value={idx}>{name}</option>
                ))}
              </select>
            </div>
          ))}
    </>
  );
}

// sección: lecterns
export function SecLecterns() {
  const { lectern, setLectern, camImg, setCamImg, camSnd, setCamSnd } = useDbg();
  return (
    <>
          <span style={LABEL}>Lecterns <span style={NOTE}>(T7)</span></span>
          <NumField
            label="delayMs (after dome)"
            value={lectern.delayMs}
            step={500}
            note="reload to apply"
            onChange={v => { DBG_LECTERNS.delayMs = v; setLectern(l => ({ ...l, delayMs: v })); }}
          />
          <NumField
            label="lightIntensity"
            value={lectern.lightIntensity}
            step={5} min={0} max={800}
            note="live"
            onChange={v => { DBG_LECTERNS.lightIntensity = v; setLectern(l => ({ ...l, lightIntensity: v })); }}
          />
          <NumField
            label="emissiveBrightness"
            value={lectern.emissiveBrightness}
            step={0.05} min={0} max={2}
            note="live"
            onChange={v => { DBG_LECTERNS.emissiveBrightness = v; setLectern(l => ({ ...l, emissiveBrightness: v })); }}
          />
          <NumField label="panelW (m)"    value={lectern.panelW}      note="reload" step={0.01} />
          <NumField label="panelD (m)"    value={lectern.panelD}      note="reload" step={0.01} />
          <NumField label="yawOffsetDeg"  value={lectern.yawOffsetDeg} note="reload" step={1} min={0} max={45} />
          {/* K1: IMAGEN lectern camera override */}
          <div style={{ ...ROW, marginTop: 4 }}>
            <span style={LABEL}>IMG cam override</span>
            <input type="checkbox" checked={camImg.override}
              onChange={e => { DBG_CAM_IMAGE.override = e.target.checked; setCamImg(s => ({ ...s, override: e.target.checked })); }} />
          </div>
          <NumField label="IMG fov (°)"    value={camImg.fov}    note="re-enter" step={1} min={30} max={120}
            onChange={v => { DBG_CAM_IMAGE.fov = v;    setCamImg(s => ({ ...s, fov: v })); }} />
          <NumField label="IMG height (m)" value={camImg.height} note="re-enter" step={0.05} min={0.3} max={2}
            onChange={v => { DBG_CAM_IMAGE.height = v; setCamImg(s => ({ ...s, height: v })); }} />
          <NumField label="IMG dist (m)"   value={camImg.dist}   note="re-enter" step={0.05} min={0.2} max={2}
            onChange={v => { DBG_CAM_IMAGE.dist = v;   setCamImg(s => ({ ...s, dist: v })); }} />
          <NumField label="IMG pitch (°)"  value={camImg.pitch}  note="re-enter" step={1} min={-60} max={0}
            onChange={v => { DBG_CAM_IMAGE.pitch = v;  setCamImg(s => ({ ...s, pitch: v })); }} />
          {/* K1: SONIDO lectern camera override */}
          <div style={{ ...ROW, marginTop: 4 }}>
            <span style={LABEL}>SND cam override</span>
            <input type="checkbox" checked={camSnd.override}
              onChange={e => { DBG_CAM_SOUND.override = e.target.checked; setCamSnd(s => ({ ...s, override: e.target.checked })); }} />
          </div>
          <NumField label="SND fov (°)"    value={camSnd.fov}    note="re-enter" step={1} min={30} max={120}
            onChange={v => { DBG_CAM_SOUND.fov = v;    setCamSnd(s => ({ ...s, fov: v })); }} />
          <NumField label="SND height (m)" value={camSnd.height} note="re-enter" step={0.05} min={0.3} max={2}
            onChange={v => { DBG_CAM_SOUND.height = v; setCamSnd(s => ({ ...s, height: v })); }} />
          <NumField label="SND dist (m)"   value={camSnd.dist}   note="re-enter" step={0.05} min={0.2} max={2}
            onChange={v => { DBG_CAM_SOUND.dist = v;   setCamSnd(s => ({ ...s, dist: v })); }} />
          <NumField label="SND pitch (°)"  value={camSnd.pitch}  note="re-enter" step={1} min={-70} max={0}
            onChange={v => { DBG_CAM_SOUND.pitch = v;  setCamSnd(s => ({ ...s, pitch: v })); }} />
          <NumField label="knobSens"           value={lectern.knobSens}       note="live" step={0.1} min={0.1} max={10}
            onChange={v => { DBG_LECTERNS.knobSens = v;         setLectern(l => ({ ...l, knobSens: v })); }} />
          <div style={ROW}>
            <span style={LABEL}>Gizmo flecha +Z</span>
            <input type="checkbox" checked={lectern.showGizmo}
              onChange={e => { DBG_LECTERNS.showGizmo = e.target.checked; setLectern(l => ({ ...l, showGizmo: e.target.checked })); }} />
          </div>
          <div style={ROW}>
            <span style={LABEL}>Overlays de atriles <span style={NOTE}>(mode/lock/hover)</span></span>
            <input type="checkbox" checked={lectern.debugOverlays}
              onChange={e => { DBG_LECTERNS.debugOverlays = e.target.checked; setLectern(l => ({ ...l, debugOverlays: e.target.checked })); }} />
          </div>
          <div style={ROW}>
            <span>Orientación atriles <span style={NOTE}>(I1 — giro 180°)</span></span>
          </div>
          <div style={ROW}>
            <button
              style={{ ...INPUT, width: "auto", padding: "2px 8px", cursor: "pointer" }}
              onClick={() => window.dispatchEvent(new CustomEvent("alight:flip-lectern", { detail: { side: "left" } }))}
            >Invertir 180° Izq</button>
            <button
              style={{ ...INPUT, width: "auto", padding: "2px 8px", cursor: "pointer", marginLeft: 6 }}
              onClick={() => window.dispatchEvent(new CustomEvent("alight:flip-lectern", { detail: { side: "right" } }))}
            >Invertir 180° Der</button>
          </div>
          <div style={ROW}>
            <span>Keyboard shortcuts</span>
            <button
              style={{ ...INPUT, width: "auto", padding: "2px 8px", cursor: "pointer" }}
              onClick={() => window.dispatchEvent(new CustomEvent("alight:reshuffle-keys"))}
            >Re-sortear Z–M</button>
          </div>
    </>
  );
}

// sección: retro-atriles
export function SecRetroAtriles() {
  const { retro, setRetro } = useDbg();
  return (
    <>
          <span style={LABEL}>Retro atriles <span style={NOTE}>(J5)</span></span>
          <div style={ROW}>
            <span>Skin retro <span style={NOTE}>(live; rótulos/CRT: reload)</span></span>
            <input type="checkbox" checked={retro.lecterns}
              onChange={e => { setLecternRetro(e.target.checked); setRetro(r => ({ ...r, lecterns: e.target.checked })); }} />
          </div>
          {(["wear", "wearScale", "grime", "crtCurve", "crtScan"] as const).map(k => (
            <NumField key={k} label={k} value={retro[k]} note="live"
              step={k === "wearScale" ? 0.5 : 0.01} min={0} max={k === "wearScale" ? 30 : 1}
              onChange={v => { DBG_RETRO[k] = v; syncRetroUniforms(); setRetro(r => ({ ...r, [k]: v })); }} />
          ))}
    </>
  );
}

// sección: face-capture
export function SecFaceCapture() {
  const { face, setFace } = useDbg();
  return (
    <>
          <span style={LABEL}>Face capture <span style={NOTE}>(T7 — reload to apply)</span></span>
          <NumField
            label="captureMs"
            value={face.captureMs}
            step={500}
            onChange={v => { DBG_FACE.captureMs = v; setFace(f => ({ ...f, captureMs: v })); }}
          />
          <NumField
            label="qualityThreshold"
            value={face.qualityThreshold}
            step={0.01} min={0} max={1}
            onChange={v => { DBG_FACE.qualityThreshold = v; setFace(f => ({ ...f, qualityThreshold: v })); }}
          />
    </>
  );
}

// sección: audio
export function SecAudio() {
  const { audioVol } = useDbg();
  return (
    <>
          <span style={LABEL}>Audio (T7 — read-only live)</span>
          <NumField label="volume"     value={audioVol}                 step={0.01} />
          <NumField label="trackIndex" value={STORE.audio.trackIndex}   step={1} />
          <NumField label="distortion" value={STORE.audio.distortion}   step={0.01} />
          <NumField label="reverb"     value={STORE.audio.reverb}       step={0.01} />
          <NumField label="delay.amount"   value={STORE.audio.delay.amount}   step={0.01} />
          <NumField label="delay.feedback" value={STORE.audio.delay.feedback} step={0.01} />
    </>
  );
}

// sección: extra-lights
export function SecExtraLights() {
  return (
    <>
          <span style={LABEL}>Extra lights <span style={NOTE}>(added by T5 panel)</span></span>
          <NumField label="count" value={STORE.lights.extras.length} step={1} />
          <NumField label="globalIntensity" value={STORE.lights.globalIntensity} step={0.1} />
    </>
  );
}

// sección: audio-nucleo-z78
export function SecAudioNucleoZ78() {
  // Z78: núcleo de audio de la tarima (lib/audio/nucleo.ts). Estado refrescado 4 veces por segundo.
  const N = DBG_AUDIO_NUCLEO;
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => (t + 1) % 1e6), 250); return () => clearInterval(id); }, []);
  const toca = () => setTick(t => (t + 1) % 1e6);
  const e = actualizarEstadoNucleo();
  return (
    <>
          <span style={LABEL}>Núcleo de audio Z78 <span style={NOTE}>(contexto único de la tarima · live salvo ACTIVO)</span></span>
          <div style={{ ...ROW, ...NOTE }}>
            <span>contexto {e.contexto}{e.sampleRate ? ` · ${e.sampleRate} Hz` : ""} · lat. base {e.latenciaBaseMs.toFixed(1)} ms · lat. salida {e.latenciaSalidaMs.toFixed(1)} ms · reloj {e.reloj} (compás {e.compas}, paso {e.paso}) · cortes {e.cortes}{e.atrilesEnBus ? " · atriles en el bus" : ""}{e.transmisible ? " · salida transmisible" : ""}</span>
          </div>
          <div style={ROW}>
            <span>ACTIVO <span style={NOTE}>vale si los atriles aún no arrancaron su audio (si no, se pierde al recargar: cambiar en debugConfig) · off = contexto propio como antes</span></span>
            <button style={INPUT} onClick={() => { N.ACTIVO = !N.ACTIVO; toca(); }}>{N.ACTIVO ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>SILLAS_EN_NUCLEO <span style={NOTE}>pendiente: sin efecto</span></span>
            <button style={{ ...INPUT, opacity: 0.5 }} disabled>{N.SILLAS_EN_NUCLEO ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>LIMITADOR <span style={NOTE}>suave, identidad bajo el umbral</span></span>
            <button style={INPUT} onClick={() => { N.LIMITADOR = !N.LIMITADOR; aplicarConfigNucleo(); toca(); }}>{N.LIMITADOR ? "ON" : "off"}</button>
          </div>
          {([["GANANCIA_MAESTRA", 0, 2, 0.01, "1 = como antes"], ["LIMITADOR_UMBRAL", 0.5, 0.99, 0.01, "escala completa"], ["BPM", 20, 300, 1, "bpm"], ["ANTICIPO_S", 0.03, 0.3, 0.01, "s"]] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{N[k].toFixed(st < 1 ? 2 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={N[k]}
                onChange={ev => { N[k] = parseFloat(ev.target.value); aplicarConfigNucleo(); toca(); }} />
            </div>
          ))}
          <div style={ROW}>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); iniciarReloj(); toca(); }}>Iniciar reloj</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); detenerReloj(); toca(); }}>Detener reloj</button>
          </div>
          <div style={ROW}>
            <span>METRÓNOMO <span style={NOTE}>clic en cada paso (fuerte en el 1)</span></span>
            <button style={INPUT} onClick={() => { setMetronomo(!N.METRONOMO); toca(); }}>{N.METRONOMO ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>METRONOMO_VOL <span style={NOTE}>{N.METRONOMO_VOL.toFixed(2)}</span></span>
            <input type="range" min={0} max={1} step={0.01} style={{ flex: 1 }} value={N.METRONOMO_VOL}
              onChange={ev => { N.METRONOMO_VOL = parseFloat(ev.target.value); toca(); }} />
          </div>
          <div style={ROW}>
            <span>Probar ruido</span>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); setRuidoPrueba(!N.RUIDO); toca(); }}>{N.RUIDO ? "ON" : "off"}</button>
            {(["rosa", "blanco"] as const).map(v => (
              <button key={v} style={{ ...INPUT, opacity: N.RUIDO_TIPO === v ? 1 : 0.5 }} onClick={() => { N.RUIDO_TIPO = v; if (N.RUIDO) setRuidoPrueba(true); toca(); }}>{v}</button>
            ))}
          </div>
          <div style={ROW}>
            <span>RUIDO_GANANCIA <span style={NOTE}>{N.RUIDO_GANANCIA.toFixed(2)}</span></span>
            <input type="range" min={0} max={1} step={0.01} style={{ flex: 1 }} value={N.RUIDO_GANANCIA}
              onChange={ev => { N.RUIDO_GANANCIA = parseFloat(ev.target.value); if (N.RUIDO) setRuidoPrueba(true); toca(); }} />
          </div>
          <div style={ROW}>
            <span>OVERLAY_NIVEL <span style={NOTE}>medidor del analizador maestro</span></span>
            <button style={INPUT} onClick={() => { setOverlayNivel(!N.OVERLAY_NIVEL); toca(); }}>{N.OVERLAY_NIVEL ? "ON" : "off"}</button>
          </div>
    </>
  );
}

// sección: play-tarima-z79
export function SecPlayTarimaZ79() {
  // Z79: botón grande de PLAY del atril de sonido (sin autoplay) y slots de los atriles de instrumentos.
  const P = DBG_PLAY;
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => (t + 1) % 1e6), 250); return () => clearInterval(id); }, []);
  const toca = () => setTick(t => (t + 1) % 1e6);
  return (
    <>
          <span style={LABEL}>Play del atril de sonido Z79 <span style={NOTE}>(live)</span></span>
          <div style={{ ...ROW, ...NOTE }}>
            <span>{PLAY_TARIMA.sonando ? "SONANDO" : "en silencio"} · {PLAY_TARIMA.iniciado ? `pista ${STORE.audio.trackIndex + 1}/${STORE.audio.tracks.length}` : "sin pista puesta"} · contexto {estadoContextoTarima()} · cambios {PLAY_TARIMA.cambios}</span>
          </div>
          <div style={ROW}>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); playTarima(); toca(); }}>Play</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); pausaTarima(); toca(); }}>Pausa</button>
          </div>
          {([["AUTOPLAY", "arranque automático anterior · vale al aparecer los atriles"], ["MOSTRAR_SLOTS", "marcadores de los slots"], ["APARECER_TRAS_PLAY", "Z88: off = la caja sale con los atriles · ON = al apretar play (Z80)"],
            ["CLICK_UNICO", "Z81: botones una vez por pulsación (off = doble disparo anterior)"], ["SLOTS_PEDESTAL", "Z81: base bajo los atriles de instrumentos"]] as const).map(([k, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{nota}</span></span>
              <button style={INPUT} onClick={() => { P[k] = !P[k]; toca(); }}>{P[k] ? "ON" : "off"}</button>
            </div>
          ))}
          <div style={ROW}>
            <span>SLOTS_PEDESTAL_ALTURA_M <span style={NOTE}>{P.SLOTS_PEDESTAL_ALTURA_M === "auto" ? "auto = alto de la tarima" : `${Number(P.SLOTS_PEDESTAL_ALTURA_M).toFixed(3)} m`}</span></span>
            <button style={{ ...INPUT, opacity: P.SLOTS_PEDESTAL_ALTURA_M === "auto" ? 1 : 0.5 }} onClick={() => { P.SLOTS_PEDESTAL_ALTURA_M = P.SLOTS_PEDESTAL_ALTURA_M === "auto" ? 0.267 : "auto"; toca(); }}>auto</button>
            {P.SLOTS_PEDESTAL_ALTURA_M !== "auto" && <input type="range" min={0} max={1} step={0.005} style={{ flex: 1 }} value={Number(P.SLOTS_PEDESTAL_ALTURA_M)}
              onChange={ev => { P.SLOTS_PEDESTAL_ALTURA_M = parseFloat(ev.target.value); toca(); }} />}
          </div>
          {([
            ["BOTON_ESCALA", 0.4, 2.5, 0.05, "× (1 = 16 × 4,5 cm)"], ["BOTON_U", -0.6, 0.6, 0.005, "m (derecha)"], ["BOTON_V", -0.3, 0.3, 0.005, "m (0 = franja central)"],
            ["BOTON_ELEV", 0.002, 0.05, 0.001, "m (alto de la base)"],
            ["SLOTS_N", 0, 12, 1, "atriles"], ["SLOTS_DIST_M", 0.5, 4, 0.05, "m detrás"], ["SLOTS_SEP_M", 0.8, 3, 0.05, "m entre slots"], ["SLOTS_ARCO_GRADOS", 0, 180, 1, "° (0 = en línea)"],
          ] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{P[k].toFixed(st < 0.01 ? 3 : st < 1 ? 2 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={P[k]}
                onChange={ev => { P[k] = parseFloat(ev.target.value); toca(); }} />
            </div>
          ))}
    </>
  );
}

// sección: caja-ritmos-z80
export function SecCajaRitmosZ80() {
  // Z80: caja de ritmos circular (lib/ritmos.ts, lib/ritmosMotor.ts, components/CajaRitmos.tsx). Estado 4 veces por segundo.
  const R = DBG_RITMOS;
  const [, setTick] = useState(0);
  const [vozSel, setVozSel] = useState<VozId>("kick");
  useEffect(() => { const id = setInterval(() => setTick(t => (t + 1) % 1e6), 250); return () => clearInterval(id); }, []);
  const toca = () => setTick(t => (t + 1) % 1e6);
  const pistas = pistasValidas(R.PISTAS);
  const v = R.VOZ[vozSel];
  return (
    <>
          <span style={LABEL}>Caja de ritmos Z80 <span style={NOTE}>(live · anillos de adentro hacia afuera)</span></span>
          <div style={{ ...ROW, ...NOTE }}>
            <span>{RITMOS.sonando ? "SONANDO" : "detenida"} · {R.BPM} BPM · swing {R.SWING} % · {RITMOS.pasos} pasos · golpes {RITMOS.golpes}{RITMOS.cargado ? " · patrón restaurado de la sesión" : ""}</span>
          </div>
          <div style={ROW}>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); playRitmos(); toca(); }}>Play</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); pausaRitmos(); toca(); }}>Pausa</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); cargarEjemploHouse(); toca(); }}>Cargar ejemplo house</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); borrarRitmos(); toca(); }}>Borrar</button>
          </div>
          {([["ACTIVO", "off = no se monta ni suena"], ["SEGUIR_PLAY_ATRIL", "el play del atril de sonido la arranca"], ["MOSTRAR_BARRA", "barra de posición"], ["OVERLAY_CELDA", "celda bajo el mouse (modo atril)"], ["PERSISTENCIA", "sessionStorage"]] as const).map(([k, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{nota}</span></span>
              <button style={INPUT} onClick={() => { R[k] = !R[k]; toca(); }}>{R[k] ? "ON" : "off"}</button>
            </div>
          ))}
          <div style={ROW}>
            <span>MOSTRAR</span>
            {(["tras_play", "siempre"] as const).map(m => (
              <button key={m} style={{ ...INPUT, opacity: R.MOSTRAR === m ? 1 : 0.5 }} onClick={() => { R.MOSTRAR = m; toca(); }}>{m}</button>
            ))}
          </div>
          {/* Z88: ubicación de la caja y de los slots */}
          <div style={ROW}>
            <span>UBICACION <span style={NOTE}>Z88</span></span>
            {(["detras_tarima", "slot_atril"] as const).map(m => (
              <button key={m} style={{ ...INPUT, opacity: R.UBICACION === m ? 1 : 0.5 }} onClick={() => { R.UBICACION = m; toca(); }}>{m}</button>
            ))}
          </div>
          <div style={ROW}>
            <span>DIST_DETRAS_M <span style={NOTE}>{R.DIST_DETRAS_M.toFixed(2)} m del borde de la tarima (detras_tarima)</span></span>
            <input type="range" min={0} max={8} step={0.05} style={{ flex: 1 }} value={R.DIST_DETRAS_M} onChange={ev => { R.DIST_DETRAS_M = parseFloat(ev.target.value); toca(); }} />
          </div>
          <div style={{ ...ROW, ...NOTE }}>
            <span>caja: {ATRIL_RITMOS.visible ? `(${ATRIL_RITMOS.x.toFixed(2)}, ${ATRIL_RITMOS.z.toFixed(2)}) · a ${Math.hypot(ATRIL_RITMOS.x - UBIC_SLOTS.atrilX, ATRIL_RITMOS.z).toFixed(2)} m del atril de sonido` : "todavía no salió"} · eje (${EJE_TARIMA.ux.toFixed(2)}, ${EJE_TARIMA.uz.toFixed(2)})</span>
          </div>
          <div style={ROW}>
            <span>PASOS</span>
            {PASOS_VALIDOS.map(n => (
              <button key={n} style={{ ...INPUT, opacity: RITMOS.pasos === n ? 1 : 0.5 }} onClick={() => { setPasosRitmos(n); toca(); }}>{n}</button>
            ))}
          </div>
          <div style={ROW}>
            <span>BPM <span style={NOTE}>{R.BPM}</span></span>
            <input type="range" min={60} max={180} step={1} style={{ flex: 1 }} value={R.BPM} onChange={ev => { setBpmRitmos(parseFloat(ev.target.value)); toca(); }} />
          </div>
          <div style={ROW}>
            <span>SWING <span style={NOTE}>{R.SWING} %</span></span>
            <input type="range" min={0} max={60} step={1} style={{ flex: 1 }} value={R.SWING} onChange={ev => { setSwingRitmos(parseFloat(ev.target.value)); toca(); }} />
          </div>
          {([["VOLUMEN", 0, 1.5, 0.01, ""], ["LUZ", 0, 20, 0.1, "reflector"], ["SLOT", 0, 11, 1, "slot de Z79"], ["SALTO_AMP", 0, 2, 0.05, "×"], ["SALTO_TAU_S", 0.02, 0.4, 0.01, "s"]] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{R[k].toFixed(st < 1 ? 2 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={R[k]} onChange={ev => { R[k] = parseFloat(ev.target.value); toca(); }} />
            </div>
          ))}
          <span style={{ ...NOTE, display: "block", marginTop: 4 }}>PISTAS (orden de los anillos): {pistas.map(id => NOMBRE_VOZ[id]).join(" · ")}</span>
          <div style={ROW}>
            {VOCES_IDS.map(id => {
              const en = R.PISTAS.includes(id);
              return <button key={id} style={{ ...INPUT, opacity: en ? 1 : 0.4 }} title="quitar o agregar al final"
                onClick={() => { R.PISTAS = en ? R.PISTAS.filter(x => x !== id) : [...R.PISTAS, id]; if (!R.PISTAS.length) R.PISTAS = [id]; RITMOS.version++; toca(); }}>{id}</button>;
            })}
          </div>
          <div style={ROW}>
            <span>Voz</span>
            {VOCES_IDS.map(id => (
              <button key={id} style={{ ...INPUT, opacity: vozSel === id ? 1 : 0.5 }} onClick={() => setVozSel(id)}>{id}{R.VOZ[id].MUTE ? " (m)" : ""}</button>
            ))}
          </div>
          {v && (
            <>
              <div style={ROW}>
                <span>{NOMBRE_VOZ[vozSel]}</span>
                <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); probarVoz(vozSel); }}>Probar</button>
                <button style={INPUT} onClick={() => { v.MUTE = !v.MUTE; toca(); }}>{v.MUTE ? "MUTE" : "suena"}</button>
                <button style={INPUT} onClick={() => { v.SWING = !v.SWING; toca(); }}>swing {v.SWING ? "ON" : "off"}</button>
              </div>
              {([["TONO", 20, 12000, 1, "Hz"], ["DECAY", 0.01, 1.5, 0.01, "s"], ["VOL", 0, 1.5, 0.01, ""]] as const).map(([k, mn, mx, st, nota]) => (
                <div key={k} style={ROW}>
                  <span>{k} <span style={NOTE}>{v[k].toFixed(st < 1 ? 2 : 0)} {nota}</span></span>
                  <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={v[k]} onChange={ev => { v[k] = parseFloat(ev.target.value); toca(); }} />
                </div>
              ))}
            </>
          )}
          <div style={ROW}><button style={INPUT} onClick={() => { guardarRitmos(); toca(); }}>Guardar en la sesión</button></div>
    </>
  );
}

// sección: ondas-tarima-z87
export function SecOndasTarimaZ87() {
  // Z87: fuente de video de la tarima (webcam u ondas del analizador maestro) para las proyecciones del domo de caras.
  const O = DBG_ONDAS_TARIMA;
  const avisarVis = () => window.dispatchEvent(new CustomEvent("alight:visualizador-cambio"));   // Z98: los pads del atril siguen al menú
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => (t + 1) % 1e6), 250); return () => clearInterval(id); }, []);
  const toca = () => setTick(t => (t + 1) % 1e6);
  return (
    <>
          <span style={LABEL}>Ondas de la tarima Z87 <span style={NOTE}>(live · reemplazo de la webcam en el domo · Z98: visualizador cascada / XY, paletas ámbar / fósforo / identidad)</span></span>
          <div style={{ ...ROW, ...NOTE }}><span>{textoEstadoFuente()}</span></div>
          <div style={ROW}>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); O.MODO = "ondas"; toca(); }}>Forzar ondas</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); O.MODO = "webcam"; toca(); }}>Forzar webcam</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); O.MODO = "auto"; toca(); }}>Auto</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); reintentarCamara(); toca(); }}>Reintentar permiso</button>
          </div>
          {/* Z98: cascada / xy y ámbar / fósforo / identidad (visualizador nuevo); los de Z87 siguen */}
          {([["MODO", ["auto", "webcam", "ondas"]], ["ESTILO", ["cascada", "xy", "onda", "espectro", "ambos"]], ["PALETA", ["ambar", "fosforo", "identidad", "verde", "cian"]],
            ["XY_MODO", ["auto", "estereo", "retardo"]]] as const).map(([k, ops]) => (
            <div key={k} style={ROW}>
              <span>{k}</span>
              {ops.map(v => <button key={v} style={{ ...INPUT, opacity: O[k] === v ? 1 : 0.5 }} onClick={() => { O[k] = v; avisarVis(); toca(); }}>{v}</button>)}
            </div>
          ))}
          <div style={{ ...ROW, ...NOTE }}><span>Z98 cronómetro del dibujo: {textoCronoVis()}</span></div>
          {([["VISUALIZADOR_NUEVO", "off = dibujo de Z87 tal cual"], ["ROTULO", "rótulo de esquina CASCADA · ÁMBAR"]] as const).map(([k, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{nota}</span></span>
              <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); O[k] = !O[k]; toca(); }}>{O[k] ? "ON" : "off"}</button>
            </div>
          ))}
          {([["LINEAS", 4, 64, 1, "líneas de la cascada"], ["COLUMNAS", 16, 256, 8, "frecuencias por línea"], ["SUBIDA", 0.05, 1, 0.05, "suavizado: subida"],
            ["BAJADA", 0.01, 1, 0.01, "suavizado: bajada"], ["FREC_MIN", 0.001, 0.05, 0.001, "inicio del eje"], ["FREC_SUAVE", 0, 1, 0.05, "0 lineal · 1 log"],
            ["XY_RETARDO", 1, 32, 1, "muestras (mono)"], ["XY_PUNTOS", 64, 2048, 32, "puntos"], ["XY_PERSISTENCIA", 0, 0.97, 0.01, "estela XY"],
            ["COLOR_VELOC", 0, 0.6, 0.01, "ciclos/s (IDENTIDAD)"]] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{O[k].toFixed(st < 0.01 ? 3 : st < 1 ? 2 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={O[k]} onChange={ev => { O[k] = parseFloat(ev.target.value); avisarVis(); toca(); }} />
            </div>
          ))}
          {([["FPS", 5, 60, 1, "cuadros/s"], ["GROSOR", 1, 10, 0.5, "px"], ["PERSISTENCIA", 0, 0.97, 0.01, "estela"], ["SENSIBILIDAD", 0.2, 10, 0.1, "×"], ["PUNTOS", 32, 1024, 16, ""], ["BARRAS", 8, 128, 4, ""]] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{O[k].toFixed(st < 1 ? 2 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={O[k]} onChange={ev => { O[k] = parseFloat(ev.target.value); toca(); }} />
            </div>
          ))}
    </>
  );
}

// sección: consent-tarima-z91
export function SecConsentTarimaZ91() {
  // Z91: consentimiento para exponerse y transmitir al elegir la tarima, indicador EN VIVO y corte. Estado 4 veces por segundo.
  const C = DBG_CONSENT;
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => (t + 1) % 1e6), 250); return () => clearInterval(id); }, []);
  const toca = () => setTick(t => (t + 1) % 1e6);
  return (
    <>
          <span style={LABEL}>Consentimiento de la tarima Z91 <span style={NOTE}>(live · docs/dialogos/tarima-exponerse.ink)</span></span>
          <div style={{ ...ROW, ...NOTE, whiteSpace: "pre-line" }}><span>{textoEstadoConsent()}</span></div>
          {([["ACTIVO", "off = atriles a los 10 s sin preguntas ni publicar (como antes)"], ["RECORDAR_EN_SESION", "Z93a: off por defecto · ON = sessionStorage de la pestaña (al recargar no repregunta y los atriles salen sin textos)"],
            ["RECORDAR_TRANSMISION", "Z92: off = al recargar una transmisión no se reanuda (vuelve a preguntar)"],
            ["ATRILES_TRAS_CONSENTIMIENTO", "Z93a: atriles y caja de ritmos solo tras la elección · off = como antes (10 s después de las figuras)"]] as const).map(([k, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{nota}</span></span>
              <button style={INPUT} onClick={() => { C[k] = !C[k]; toca(); }}>{C[k] ? "ON" : "off"}</button>
            </div>
          ))}
          {([["ESPERA_INICIAL_S", 0, 30, 0.5, "s figuras → texto 1"], ["ESPERA_ENTRE_S", 0, 30, 0.5, "s fin del texto 1 → elección"], ["CIERRE_TEXTO_S", 0, 10, 0.5, "s el texto 1 queda en pantalla"],
            ["DURACION_MAX_S", 10, 1800, 5, "s límite (reloj real)"], ["AVISO_FIN_S", 0, 120, 1, "s de aviso antes del límite"],
            ["ESPERA_FIGURAS_MAX_S", 5, 120, 1, "s Z93a: sin figuras (permiso sin responder), arranca igual tras elegir la tarima"],
            ["SALIDA_EXTRA_M", 0, 3, 0.1, "m Z93a: bajar de la tarima = radio de la zona + esto (cancela antes de elegir)"]] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{C[k].toFixed(st < 1 ? 1 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={C[k]} onChange={ev => { C[k] = parseFloat(ev.target.value); toca(); }} />
            </div>
          ))}
          <div style={ROW}>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); mostrarTexto1Ahora(); toca(); }}>Mostrar texto 1 ahora</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); mostrarEleccionAhora(); toca(); }}>Mostrar elección ahora</button>
          </div>
          <div style={ROW}>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); cortarTransmision("boton"); toca(); }}>Cortar transmisión</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); reiniciarConsentimiento(); toca(); }}>Reiniciar consentimiento</button>
          </div>
    </>
  );
}

// sección: livekit-z92
export function SecLiveKitZ92() {
  // Z92: video y audio de la tarima por LiveKit Cloud (solo tras "Compartir mi sesión."). Estado 4 veces por segundo.
  const L = DBG_LIVEKIT;
  const [, setTick] = useState(0);
  const [res, setRes] = useState("");
  useEffect(() => { const id = setInterval(() => setTick(t => (t + 1) % 1e6), 250); return () => clearInterval(id); }, []);
  const toca = () => setTick(t => (t + 1) % 1e6);
  return (
    <>
          <span style={LABEL}>Transmisión LiveKit Z92 <span style={NOTE}>(video y audio de la tarima · token firmado en /api/livekit/token)</span></span>
          <div style={{ ...ROW, ...NOTE, whiteSpace: "pre-line" }}><span>{textoEstadoLiveKit()}</span></div>
          <div style={{ ...ROW, ...NOTE }}><span>Z92b: la URL de LiveKit la da el servidor en cada pedido (LIVEKIT_URL o NEXT_PUBLIC_LIVEKIT_URL); el navegador no lee variables</span></div>
          <div style={ROW}>
            <span>FUENTE_VIDEO <span style={NOTE}>Z94: procesado = imagen del domo con efectos y atril · cruda = Z92 · ondas = prueba (vale al publicar)</span></span>
            {(["procesado", "cruda", "ondas"] as const).map(m => (
              <button key={m} style={{ ...INPUT, opacity: L.FUENTE_VIDEO === m ? 1 : 0.5 }} onClick={() => { L.FUENTE_VIDEO = m; toca(); }}>{m}</button>
            ))}
          </div>
          {([["PROCESADO_ESPEJO", "Z94: espeja la copia plana"], ["PROCESADO_SRGB", "Z94: codifica a sRGB (como el OutputPass de la pantalla)"]] as const).map(([k, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{nota}</span></span>
              <button style={INPUT} onClick={() => { L[k] = !L[k]; toca(); }}>{L[k] ? "ON" : "off"}</button>
            </div>
          ))}
          <div style={ROW}>
            <span>PROCESADO_TIMEOUT_S <span style={NOTE}>{L.PROCESADO_TIMEOUT_S.toFixed(1)} s Z94b: sin cuadros procesados → video crudo en caliente</span></span>
            <input type="range" min={1} max={15} step={0.5} style={{ flex: 1 }} value={L.PROCESADO_TIMEOUT_S} onChange={ev => { L.PROCESADO_TIMEOUT_S = parseFloat(ev.target.value); toca(); }} />
          </div>
          {([["PROCESADO_REINTENTO_S", 2, 60, 1, "s Z94c: en cruda, cada esto prueba volver a procesado"], ["PROCESADO_MAX_REINTENTOS", 0, 20, 1, "Z94c: pruebas por transmisión"],
            ["PROCESADO_CONFIRMAR_S", 0.5, 10, 0.5, "s Z94c: cuadros seguidos para volver a procesado"], ["PROCESADO_LECTURA_MAX_MS", 200, 5000, 100, "ms Z94c: lectura colgada"]] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{L[k].toFixed(st < 1 ? 1 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={L[k]} onChange={ev => { L[k] = parseFloat(ev.target.value); toca(); }} />
            </div>
          ))}
          <div style={ROW}>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); alternarPanelCuadro(); toca(); }}>{panelCuadroVisible() ? "Ocultar el cuadro procesado" : "Ver el cuadro procesado"}</button>
            <span style={NOTE}>Z94b: el canvas 640×360 que se transmite (panel abajo a la derecha)</span>
          </div>
          <div style={ROW}>
            <span>ACTIVO <span style={NOTE}>off = como Z91 (solo presencia)</span></span>
            <button style={INPUT} onClick={() => { L.ACTIVO = !L.ACTIVO; toca(); }}>{L.ACTIVO ? "ON" : "off"}</button>
          </div>
          <div style={{ ...ROW, ...NOTE }}><span>SALA {L.SALA} (informativa: la fija el servidor)</span></div>
          {([["VIDEO_FPS", 1, 30, 1, "fps (vale al publicar)"], ["VIDEO_KBPS", 100, 2000, 50, "kbps video"], ["AUDIO_KBPS", 16, 256, 8, "kbps audio estéreo"]] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{L[k]} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={L[k]} onChange={ev => { L[k] = parseFloat(ev.target.value); toca(); }} />
            </div>
          ))}
          <div style={ROW}>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); const r = publicarLiveKit({ consentimiento: true, modo: modoActual(), sesionId: sesionIdNavegador() }); setRes(r.ok ? "publicando (prueba)" : `rechazada: ${r.motivo}`); toca(); }}>Publicar de prueba (SIMULA el consentimiento)</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); detenerLiveKit(); setRes("detenida"); toca(); }}>Detener</button>
          </div>
          {res && <div style={{ ...ROW, ...NOTE }}><span>{res}</span></div>}
    </>
  );
}

// sección: atril-sonido-z96
export function SecAtrilSonidoZ96() {
  // Z96: atril de sonido rediseñado ("SONIDO SN-40"). Diseño y escala de etiquetas avisan a LecternSystem (evento).
  const A = DBG_ATRIL_SONIDO;
  const [, setTick] = useState(0);
  const toca = () => setTick(t => (t + 1) % 1e6);
  const avisar = (remontar: boolean) => window.dispatchEvent(new CustomEvent("alight:atril-sonido-cambio", { detail: { remontar } }));
  return (
    <>
          <span style={LABEL}>Atril de sonido Z96 <span style={NOTE}>(SONIDO SN-40 · probar con el checkpoint «Atril de sonido» o ?cp=atril_sonido)</span></span>
          <div style={ROW}>
            <span>DISENO_NUEVO <span style={NOTE}>off = layout anterior (J3) tal cual</span></span>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); A.DISENO_NUEVO = !A.DISENO_NUEVO; avisar(true); toca(); }}>{A.DISENO_NUEVO ? "ON" : "off"}</button>
          </div>
          {([["PLAY_ESCALA", 0.5, 1.5, 0.05, "PLAY/PAUSA (1 = 32 × 8,2 cm)", false], ["ETIQUETA_ESCALA", 0.7, 1.4, 0.05, "títulos y etiquetas (rehace la serigrafía)", true],
            ["DISPLAY_VALOR_S", 0.5, 8, 0.5, "s que el display muestra el control tocado", false], ["VU_HZ", 5, 60, 1, "tope de actualización del VU y del display", false]] as const).map(([k, mn, mx, st, nota, rehacer]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{A[k].toFixed(st < 1 ? 2 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={A[k]}
                onChange={ev => { A[k] = parseFloat(ev.target.value); toca(); }}
                onPointerUp={() => { if (rehacer) avisar(false); }} onKeyUp={() => { if (rehacer) avisar(false); }} />
            </div>
          ))}
          {/* Z96b */}
          {([["ROTULOS_FILA", "rótulos de fila (EFECTOS · TONO · TRANSPORTE)"], ["ETIQUETA_AUTO_ASPECTO", "proporción < 1,6: etiquetas hasta × 1,15"]] as const).map(([k, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{nota}</span></span>
              <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); A[k] = !A[k]; avisar(false); toca(); }}>{A[k] ? "ON" : "off"}</button>
            </div>
          ))}
          <div style={ROW}>
            <span>ROTULOS_MODO <span style={NOTE}>barra = leyenda numerada en la placa + 1·2·3 en el margen · margen = verticales</span></span>
            {(["barra", "margen"] as const).map(m => (
              <button key={m} style={{ ...INPUT, opacity: A.ROTULOS_MODO === m ? 1 : 0.5 }} onClick={ev => { ev.currentTarget.blur(); A.ROTULOS_MODO = m; avisar(false); toca(); }}>{m}</button>
            ))}
          </div>
          {([["VU_SEG_AMBAR_DESDE", 1, 14, 1, "segmento desde el que el VU es ámbar"], ["VU_SEG_ROJO_DESDE", 1, 14, 1, "segmento desde el que el VU es rojo"],
            ["VU_PICO_RETENCION_MS", 0, 3000, 50, "ms que el pico queda arriba"]] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{A[k]} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={A[k]} onChange={ev => { A[k] = parseFloat(ev.target.value); toca(); }} />
            </div>
          ))}
          <div style={{ ...ROW, ...NOTE }}><span>doble clic sobre una perilla o el fader: vuelve a su valor por defecto · el display muestra el control tocado</span></div>
    </>
  );
}

// sección: atril-imagen-z97
export function SecAtrilImagenZ97() {
  // Z97: atril de imagen rediseñado ("IMAGEN IM-40"). Diseño y escala de etiquetas avisan a LecternSystem (evento).
  const A = DBG_ATRIL_VIDEO;
  const [, setTick] = useState(0);
  const toca = () => setTick(t => (t + 1) % 1e6);
  const avisar = (remontar: boolean) => window.dispatchEvent(new CustomEvent("alight:atril-imagen-cambio", { detail: { remontar } }));
  return (
    <>
          <span style={LABEL}>Atril de imagen Z97 <span style={NOTE}>(IMAGEN IM-40 · probar con el checkpoint «Atril de imagen» o ?cp=atril_imagen)</span></span>
          <div style={ROW}>
            <span>DISENO_NUEVO <span style={NOTE}>off = layout anterior (ON/OFF, REACTIVO, SIG.EFE.) y la rotación de 5 s de siempre</span></span>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); A.DISENO_NUEVO = !A.DISENO_NUEVO; avisar(true); toca(); }}>{A.DISENO_NUEVO ? "ON" : "off"}</button>
          </div>
          {([["ETIQUETA_ESCALA", 0.7, 1.4, 0.05, "títulos y etiquetas (rehace la serigrafía)", true],
            ["DISPLAY_VALOR_S", 0.5, 8, 0.5, "s que el display muestra el control tocado", false],
            ["VELOC_MIN_S", 0.5, 5, 0.5, "mínimo de VELOC. (s entre pasos de AUTO)", false],
            ["VELOC_MAX_S", 5, 30, 1, "máximo de VELOC.", false]] as const).map(([k, mn, mx, st, nota, rehacer]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{A[k].toFixed(st < 1 ? 2 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={A[k]}
                onChange={ev => { A[k] = parseFloat(ev.target.value); toca(); }}
                onPointerUp={() => { if (rehacer) avisar(false); }} onKeyUp={() => { if (rehacer) avisar(false); }} />
            </div>
          ))}
          {([["ROTULOS_FILA", "rótulos de fila (DOMO · IMAGEN)"], ["ETIQUETA_AUTO_ASPECTO", "proporción < 1,6: etiquetas hasta × 1,15"]] as const).map(([k, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{nota}</span></span>
              <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); A[k] = !A[k]; avisar(false); toca(); }}>{A[k] ? "ON" : "off"}</button>
            </div>
          ))}
          <div style={ROW}>
            <span>ROTULOS_MODO <span style={NOTE}>margen = verticales DOMO · IMAGEN · barra = leyenda numerada en la placa + 1·2</span></span>
            {(["margen", "barra"] as const).map(m => (
              <button key={m} style={{ ...INPUT, opacity: A.ROTULOS_MODO === m ? 1 : 0.5 }} onClick={ev => { ev.currentTarget.blur(); A.ROTULOS_MODO = m; avisar(false); toca(); }}>{m}</button>
            ))}
          </div>
          <div style={ROW}>
            <span>CAMARA <span style={NOTE}>panel = mira el panel (texto legible, domo casi fuera de cuadro) · domo = la de antes (domo arriba, texto chico). Vale al volver a apretar E</span></span>
            {(["panel", "domo"] as const).map(m => (
              <button key={m} style={{ ...INPUT, opacity: A.CAMARA === m ? 1 : 0.5 }} onClick={ev => { ev.currentTarget.blur(); A.CAMARA = m; toca(); }}>{m}</button>
            ))}
          </div>
          {/* Z97b: luces de ESCENA acotadas */}
          <div style={ROW}>
            <span>Luces de ESCENA <span style={NOTE}>nivel {STORE.lights.globalIntensity.toFixed(2)} · EXTRA {LUZ_ESCENA.extra ? "on" : "off"} · luces extra viejas {STORE.lights.extras.length}</span></span>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); restaurarLucesEscena(); toca(); }}>Restaurar luces del domo</button>
          </div>
          {([["LUZ_MIN", 0, 1, 0.1, "nivel mínimo"], ["LUZ_MAX", 1, 5, 0.1, "nivel máximo"], ["LUZ_PASO", 0.05, 0.5, 0.05, "paso de LUZ - / LUZ +"],
            ["LUZ_DEFECTO", 0, 3, 0.1, "nivel por defecto (doble clic, checkpoints, restaurar)"], ["LUZ_TOPE_FINAL", 1, 5, 0.1, "tope del aporte total: ninguna combinación lo pasa"],
            ["EXTRA_APORTE", 0, 1.5, 0.05, "aporte de EXTRA encendida"], ["EXTRA_REF_CD", 20, 300, 10, "cd por 1 de aporte"]] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{A[k].toFixed(2)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={A[k]} onChange={ev => { A[k] = parseFloat(ev.target.value); storeNotify(); toca(); }} />
            </div>
          ))}
          <div style={ROW}>
            <span>LUZ_REPETIR_AL_MANTENER <span style={NOTE}>LUZ ± repiten mientras se mantienen (como antes)</span></span>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); A.LUZ_REPETIR_AL_MANTENER = !A.LUZ_REPETIR_AL_MANTENER; toca(); }}>{A.LUZ_REPETIR_AL_MANTENER ? "ON" : "off"}</button>
          </div>
          <div style={{ ...ROW, ...NOTE }}><span>PADS_INICIO 0x{A.PADS_INICIO.toString(16)} (pads encendidos al cargar) · doble clic sobre una perilla o un fader: vuelve a su valor por defecto</span></div>
    </>
  );
}

// sección: bajo-acido-z99
export function SecBajoZ99() {
  // Z99: BAJO ÁCIDO BA-40 (motor lib/audio/bajoAcido.ts). Estado 4 veces por segundo.
  const B = DBG_BAJO, A = DBG_ATRIL_BAJO;
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => (t + 1) % 1e6), 250); return () => clearInterval(id); }, []);
  const toca = () => setTick(t => (t + 1) % 1e6);
  const avisar = (remontar: boolean) => window.dispatchEvent(new CustomEvent("alight:atril-bajo-cambio", { detail: { remontar } }));
  return (
    <>
          <span style={LABEL}>Bajo ácido Z99 <span style={NOTE}>(BA-40 · probar con el checkpoint «Atril del bajo» o ?cp=atril_bajo · suena con el play de la caja de ritmos)</span></span>
          <div style={{ ...ROW, ...NOTE }}><span>{BAJO.sonando ? "sonando" : "parado"} · paso {BAJO.pasoSonando >= 0 ? BAJO.pasoSonando + 1 : "-"} · patrón {BAJO.patron}{BAJO.editado ? " (editado)" : ""} · nota {BAJO.ultimaNota >= 0 ? nombreNota(BAJO.ultimaNota) : "-"} · {Math.round(bpmBajo())} BPM · notas {BAJO.notas} · voz {BAJO.vozLista ? "lista" : "sin crear"}</span></div>
          <div style={ROW}>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); silenciarYReiniciarBajo(); toca(); }}>Silenciar y reiniciar bajo</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); patronLimpio(); toca(); }}>Patrón limpio</button>
          </div>
          <div style={ROW}>
            <span>PATRÓN</span>
            {NOMBRES_PATRON.map(nm => <button key={nm} style={{ ...INPUT, opacity: BAJO.patron === nm ? 1 : 0.5 }} onClick={() => { cargarPatron(nm); toca(); }}>{nm}</button>)}
          </div>
          {([["ONDA", ["sierra", "cuadrada"]]] as const).map(([k, ops]) => (
            <div key={k} style={ROW}>
              <span>{k}</span>
              {ops.map(v => <button key={v} style={{ ...INPUT, opacity: B[k] === v ? 1 : 0.5 }} onClick={() => { B[k] = v; aplicarParamsBajo(); toca(); }}>{v}</button>)}
            </div>
          ))}
          {([["ACTIVO", "off = sin bajo (vale al remontar)"], ["ON", "ON del módulo SALIDA (silencia sin parar el reloj)"], ["TEMPO_HEREDADO", "reloj y tempo de la caja · off = reloj propio con BPM"], ["PATRON_APLICA_VOZ", "Z102: FUNK y DISCO aplican su seteo de voz al cargarse"]] as const).map(([k, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{nota}</span></span>
              <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); B[k] = !B[k]; aplicarParamsBajo(); if (k === "ACTIVO") avisar(true); toca(); }}>{B[k] ? "ON" : "off"}</button>
            </div>
          ))}
          {/* parámetros del motor: van por setParamBajo(id, valor, "manual") (los mismos que mueve el atril) */}
          {PARAMS_BAJO.map(d => (
            <div key={d.id} style={ROW}>
              <span>{d.nombre} <span style={NOTE}>{PARAMS_BAJO_EST.manual[indiceParam(d.id)].toFixed(d.max > 50 ? 0 : 2)} {d.unidad}</span></span>
              <input type="range" min={d.min} max={d.max} step={(d.max - d.min) / 200} style={{ flex: 1 }} value={PARAMS_BAJO_EST.manual[indiceParam(d.id)]}
                onChange={ev => { setParamBajo(d.id, parseFloat(ev.target.value), "manual"); toca(); }} />
            </div>
          ))}
          {([["RAIZ_MIDI", 24, 48, 1, "nota 0 de los pasos"], ["BPM", 60, 180, 1, "solo con TEMPO_HEREDADO off"], ["LOOKAHEAD_S", 0.03, 0.3, 0.01, "reloj propio: anticipo"],
            ["INTERVALO_S", 0.01, 0.1, 0.005, "reloj propio (vale al arrancar)"], ["FILTRO_FRECUENCIA_MIN", 20, 300, 5, "Hz"], ["FILTRO_FRECUENCIA_MAX", 1000, 12000, 100, "Hz"],
            ["RES_MAX", 2, 30, 0.5, "Q máximo"], ["ENV_OCTAVAS", 0, 6, 0.1, "octavas de MOD. ENV."], ["GATE", 0.1, 0.95, 0.05, "duración de una nota sin desliz"]] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{B[k].toFixed(st < 1 ? 3 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={B[k]} onChange={ev => { B[k] = parseFloat(ev.target.value); aplicarParamsBajo(); toca(); }} />
            </div>
          ))}
          <span style={LABEL}>Atril BA-40</span>
          {([["ETIQUETA_ESCALA", 0.7, 1.4, 0.05, "títulos y etiquetas (rehace la serigrafía)", false], ["DISPLAY_VALOR_S", 0.5, 8, 0.5, "s del control tocado en el display", false],
            ["VU_HZ", 5, 60, 1, "tope del VU y del display", false], ["ESCALA_PASOS", 0.8, 1.2, 0.05, "teclas PASO (vale al remontar)", true], ["INDICE_ARCO", -3, 3, 1, "Z99b: índice en el arco (0 = caja; vale con «arco»)", false], ["SLOT", 0, 3, 1, "slot de la línea de Z88 (1 = el de la caja; vale con «linea»)", false]] as const).map(([k, mn, mx, st, nota, remontar]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{A[k].toFixed(st < 1 ? 2 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={A[k]}
                onChange={ev => { A[k] = parseFloat(ev.target.value); toca(); }} onPointerUp={() => avisar(remontar)} onKeyUp={() => avisar(remontar)} />
            </div>
          ))}
          {([["ROTULOS_FILA", "leyenda 1 SECUENCIA · 2 VOZ · 3 SALIDA y números en los títulos"], ["ETIQUETA_AUTO_ASPECTO", "proporción < 1,6: etiquetas hasta × 1,15"]] as const).map(([k, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{nota}</span></span>
              <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); A[k] = !A[k]; avisar(false); toca(); }}>{A[k] ? "ON" : "off"}</button>
            </div>
          ))}
          <div style={{ ...ROW, ...NOTE }}><span>ROTULOS_MODO {A.ROTULOS_MODO} (leyenda en la placa de la barra) · doble clic en perillas y fader: valor por defecto · E entra · Q sale</span></div>
    </>
  );
}

// sección: instrumentos-arco-z99b
export function SecInstrumentosArcoZ99b() {
  // Z99b: disposición de los instrumentos detrás de la tarima (lib/instrumentosPose.ts). Estado 4 veces por segundo.
  const I = DBG_INSTRUMENTOS;
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => (t + 1) % 1e6), 250); return () => clearInterval(id); }, []);
  const toca = () => setTick(t => (t + 1) % 1e6);
  const paso = pasoArcoActual();
  const p = { x: 0, z: 0, yaw: 0 };
  const ocupados: number[] = [];
  for (let k = -INDICE_MAX; k <= INDICE_MAX; k++) if (ORDEN_SLOTS[k]?.ocupado || (k !== 0 && k === Math.round(DBG_ATRIL_BAJO.INDICE_ARCO))) ocupados.push(k);
  const nombre = (k: number) => k === Math.round(DBG_ATRIL_BAJO.INDICE_ARCO) && k !== 0 ? "BAJO ÁCIDO BA-40" : ORDEN_SLOTS[k]?.nombre ?? "LIBRE";
  return (
    <>
          <span style={LABEL}>Instrumentos en arco Z99b <span style={NOTE}>(la caja de ritmos queda en el centro del arco, donde la puso Z88; los demás a su misma distancia del centro de la tarima, mirando al centro)</span></span>
          <div style={ROW}>
            <span>DISPOSICION</span>
            {(["arco", "linea"] as const).map(v => <button key={v} style={{ ...INPUT, opacity: I.DISPOSICION === v ? 1 : 0.5 }} onClick={ev => { ev.currentTarget.blur(); I.DISPOSICION = v; toca(); }}>{v}</button>)}
          </div>
          <div style={{ ...ROW, ...NOTE }}><span>{enArco() ? "arco" : "línea (Z88)"} · radio caja {radioCaja().toFixed(3)} m · radio arco {radioArco().toFixed(3)} m · ángulo entre vecinos {(paso.angulo * 180 / Math.PI).toFixed(1)}° · separación {paso.separacion.toFixed(2)} m{paso.reducida ? " (REDUCIDA por el tope)" : ""} · arco total ±{indiceMaxArco()} = {paso.arcoTotalGrados.toFixed(1)}°</span></div>
          {([["RADIO_M", 0, 8, 0.05, "0 = automático (el de la caja; la caja no se mueve)"], ["SEPARACION_M", 1, 4, 0.05, "distancia en línea recta entre vecinos (> 1,8 m: rango de E)"],
            ["ARCO_MAX_GRADOS", 30, 180, 1, "tope del arco total"], ["INDICE_MAX", 0, 3, 1, "0 = auto (mayor índice ocupado o reservado)"]] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{I[k].toFixed(st < 1 ? 2 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={I[k]} onChange={ev => { I[k] = parseFloat(ev.target.value); toca(); }} />
            </div>
          ))}
          <div style={ROW}>
            <span>MIRAR_AL_CENTRO <span style={NOTE}>off = todos con el yaw de la caja</span></span>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); I.MIRAR_AL_CENTRO = !I.MIRAR_AL_CENTRO; toca(); }}>{I.MIRAR_AL_CENTRO ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); I.GUIA = !I.GUIA; toca(); }}>{I.GUIA ? "Ocultar guía del arco" : "Dibujar guía del arco"}</button>
          </div>
          {ocupados.map(k => {
            const ok = poseInstrumento(k, p);
            return (
              <div key={k} style={ROW}>
                <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); irAInstrumento(k); }}>Ir al instrumento {k > 0 ? `+${k}` : k}</button>
                <span style={NOTE}>{nombre(k)} · {ok ? `x ${p.x.toFixed(2)} · z ${p.z.toFixed(2)} · yaw ${(p.yaw * 180 / Math.PI).toFixed(1)}°` : "sin slot en la línea"}</span>
              </div>
            );
          })}
    </>
  );
}

/** Z100: edita una entrada del mapa gesto → parámetro (DBG_CARA.MAPA, objeto de módulo que lee la cara en vivo). */
function editarMapaCara(j: number, campo: "activo" | "param" | "salMin" | "salMax", v: boolean | string | number): void {
  const m = DBG_CARA.MAPA[j] as Record<string, unknown> | undefined;
  if (m) m[campo] = v;
}

// sección: cara-bajo-z100
export function SecCaraBajoZ100() {
  // Z100: tocar el BA-40 con la cara (lib/caraBajo.ts). Estado 4 veces por segundo.
  const C = DBG_CARA;
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => (t + 1) % 1e6), 250); return () => clearInterval(id); }, []);
  const toca = () => setTick(t => (t + 1) % 1e6);
  const modulables = PARAMS_BAJO.filter(d => d.modulable).map(d => d.id);
  return (
    <>
          <span style={LABEL}>Cara del BA-40 Z100 <span style={NOTE}>(MediaPipe en un worker; el video de la cara no sale de la máquina: a SILLAS solo viaja el audio y la imagen procesada del domo)</span></span>
          <div style={{ ...ROW, ...NOTE }}><span>{CARA.on ? "ON" : "off"} · {CARA.estado}{CARA.linea ? ` · «${CARA.linea}»` : ""} · fuente {CARA.fuente || "-"} · modelo {CARA.rutas || "-"} · rostro {EST_CARA.detectada ? "sí" : "no"}</span></div>
          <div style={{ ...ROW, ...NOTE }}><span>caraBajo: hilo principal {CARA.msHilo.toFixed(3)} ms/cuadro · ida y vuelta {CARA.msIdaVuelta.toFixed(1)} ms · {CARA.fpsReal.toFixed(1)} cuadros/s · enviados {CARA.enviados} · recibidos {CARA.recibidos} · descartados {CARA.descartados} · acentos {CARA.acentos} · guiños {CARA.guinos}</span></div>
          <div style={{ ...ROW, ...NOTE }}><span>{NOMBRES_GESTO.map((n, i) => `${n} ${EST_CARA.gestos[i].toFixed(2)}`).join(" · ")}</span></div>
          <div style={ROW}>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); if (CARA.on) apagarCara(); else encenderCara(); toca(); }}>{CARA.on ? "Apagar CARA" : "Encender CARA"}</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); calibrarCara(); toca(); }}>Calibrar</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); olvidarCalibracion(); toca(); }}>Olvidar calibración</button>
          </div>
          {([["SIN_CALIBRAR", "límites por defecto aunque haya calibración guardada"], ["ACTIVO_SOLO_EN_ATRIL", "se apaga al salir del modo atril del BA-40"], ["CARA_PRIORIDAD_MANUAL", "arrastrar una perilla tomada manda mientras se arrastra"],
            ["CABECEO_ACENTO", "cabeceo → acento forzado"], ["GUINO_PATRON", "guiño → siguiente patrón"], ["MODELO_LOCAL", "/alight/mediapipe/ primero (vale al encender)"]] as const).map(([k, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{nota}</span></span>
              <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); C[k] = !C[k]; toca(); }}>{C[k] ? "ON" : "off"}</button>
            </div>
          ))}
          {([["FPS_CARA", 5, 30, 1, "cuadros/s al worker"], ["CARA_MINCUTOFF", 0.1, 5, 0.1, "1 euro: corte en reposo (Hz)"], ["CARA_BETA", 0, 3, 0.05, "1 euro: corte × velocidad"],
            ["CARA_DCUTOFF", 0.1, 5, 0.1, "1 euro: corte de la velocidad"], ["CARA_RANGO_MIN", 0.01, 0.3, 0.01, "rango mínimo calibrado"], ["CARA_ACENTO_UMBRAL", 0.3, 5, 0.1, "cabeceo: rad/s"],
            ["CARA_ACENTO_REFRACTARIO_MS", 100, 1500, 50, "cabeceo: ms"], ["CARA_GUINO_CERRADO", 0.3, 0.95, 0.05, "guiño: ojo cerrado >"], ["CARA_GUINO_ABIERTO", 0.05, 0.6, 0.05, "guiño: el otro <"],
            ["CARA_GUINO_MIN_MS", 40, 600, 10, "guiño: sostenido ms"], ["CARA_GUINO_REFRACTARIO_MS", 200, 3000, 50, "guiño: ms"], ["CAL_PASO_S", 1, 5, 0.5, "s por paso de calibración"],
            ["ANCHO_CUADRO", 160, 640, 16, "px del cuadro al worker"], ["ALTO_CUADRO", 120, 480, 12, "px"]] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{C[k].toFixed(st < 1 ? 2 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={C[k]} onChange={ev => { C[k] = parseFloat(ev.target.value); toca(); }} />
            </div>
          ))}
          <span style={LABEL}>Mapa gesto → parámetro <span style={NOTE}>(salida 0…1 del parámetro; CORTE con su curva exponencial)</span></span>
          {C.MAPA.map((m, j) => (
            <div key={j} style={ROW}>
              <button style={{ ...INPUT, opacity: m.activo ? 1 : 0.5 }} onClick={ev => { ev.currentTarget.blur(); editarMapaCara(j, "activo", !m.activo); toca(); }}>{NOMBRES_GESTO[m.gesto]}</button>
              <select style={INPUT} value={m.param} onChange={ev => { editarMapaCara(j, "param", ev.target.value); toca(); }}>{modulables.map(id => <option key={id} value={id}>{id}</option>)}</select>
              <span style={NOTE}>{m.salMin.toFixed(2)}</span>
              <input type="range" min={0} max={1} step={0.05} style={{ flex: 1 }} value={m.salMin} onChange={ev => { editarMapaCara(j, "salMin", parseFloat(ev.target.value)); toca(); }} />
              <span style={NOTE}>{m.salMax.toFixed(2)}</span>
              <input type="range" min={0} max={1} step={0.05} style={{ flex: 1 }} value={m.salMax} onChange={ev => { editarMapaCara(j, "salMax", parseFloat(ev.target.value)); toca(); }} />
            </div>
          ))}
          <span style={LABEL}>Simular cara <span style={NOTE}>(sin cámara ni worker: los sliders entran por el mismo camino que los blendshapes; mové CABECEO rápido para el acento, GUIÑO arriba para cambiar de patrón)</span></span>
          <div style={ROW}>
            <span>SIMULAR</span>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); C.SIMULAR = !C.SIMULAR; if (C.SIMULAR) { if (CARA.on) apagarCara(); encenderCara(); } else apagarCara(); toca(); }}>{C.SIMULAR ? "ON" : "off"}</button>
          </div>
          {(["SIM_BOCA", "SIM_O", "SIM_SONRISA", "SIM_CEJAS", "SIM_CABECEO", "SIM_GUINO"] as const).map(k => (
            <div key={k} style={ROW}>
              <span>{k.slice(4)} <span style={NOTE}>{C[k].toFixed(2)}</span></span>
              <input type="range" min={0} max={1} step={0.01} style={{ flex: 1 }} value={C[k]} onChange={ev => { C[k] = parseFloat(ev.target.value); toca(); }} />
            </div>
          ))}
    </>
  );
}

// sección: sinte-z101
export function SecSinteZ101() {
  // Z101: SINTETIZADOR SY-40 (motor lib/audio/sinte.ts). Estado 4 veces por segundo.
  const S = DBG_SINTE, A = DBG_ATRIL_SINTE;
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => (t + 1) % 1e6), 250); return () => clearInterval(id); }, []);
  const toca = () => setTick(t => (t + 1) % 1e6);
  const avisar = (remontar: boolean) => window.dispatchEvent(new CustomEvent("alight:atril-sinte-cambio", { detail: { remontar } }));
  const probarNota = () => { const n = 12 * (S.OCTAVA + 1); notaAbajo(n); setTimeout(() => notaArriba(n), 600); };
  const mant: string[] = []; for (let i = 0; i < MANTENIDAS.n; i++) mant.push(nombreNotaSinte(MANTENIDAS.notas[i]));
  return (
    <>
          <span style={LABEL}>Sintetizador Z101 <span style={NOTE}>(SY-40 · probar con el checkpoint «Atril del sintetizador» o ?cp=atril_sinte · E entra, Q sale · piano: R 5 T 6 Y U 8 I 9 O 0 P [ = ] · el arpegiador suena con el play de la caja)</span></span>
          <div style={{ ...ROW, ...NOTE }}><span>voces activas {SINTE.vocesActivas}/{VOCES.n} · sonido {nombreSonido(SINTE.sonido)}{SINTE.editado ? " (editado)" : ""} · nota {SINTE.ultimaNota >= 0 ? nombreNotaSinte(SINTE.ultimaNota) : "-"} · teclas {mant.length ? mant.join(" ") : "-"} · arpegiador {S.ARP_ON ? (SINTE.arpActivo ? `ARPEGIANDO ${PATRONES_ARP[S.ARP_PATRON]} ${VELOCIDADES_ARP[S.ARP_VELOCIDAD]} ×${S.ARP_OCTAVAS} (paso ${ARP.pasos})` : "esperando el play de la caja") : "off"} · {Math.round(bpmSinte())} BPM · octava {S.OCTAVA} · notas {SINTE.notas} · robos {SINTE.robos} · grafo {SINTE.listo ? "listo" : "sin crear (nace con la primera nota)"}</span></div>
          <div style={ROW}>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); silenciarYReiniciarSinte(); toca(); }}>Silenciar y reiniciar sinte</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); probarNota(); toca(); }}>Probar nota DO{S.OCTAVA}</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); irAInstrumento(-1); }}>Ir al SY-40</button>
          </div>
          <div style={ROW}>
            <span>SONIDO</span>
            {NOMBRES_SONIDO.map(nm => <button key={nm} style={{ ...INPUT, opacity: SINTE.sonido === nm ? 1 : 0.5 }} onClick={() => { cargarSonidoSinte(nm); toca(); }}>{nombreSonido(nm)}</button>)}
          </div>
          {([["ACTIVO", "off = sin sinte (vale al remontar)"], ["ON", "ON del módulo TECLADO Y SALIDA"], ["ARP_ON", "arpegiador (suena con el play de la caja)"], ["SINTE_MIDI", "Web MIDI: pide permiso (vale al remontar el atril)"]] as const).map(([k, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{nota}</span></span>
              <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); S[k] = !S[k]; aplicarOpcionesSinte(); if (k === "ACTIVO" || k === "SINTE_MIDI") avisar(true); toca(); }}>{S[k] ? "ON" : "off"}</button>
            </div>
          ))}
          <div style={ROW}>
            <span>ARP_PATRON</span>
            {PATRONES_ARP.map((nm, i) => <button key={nm} style={{ ...INPUT, opacity: S.ARP_PATRON === i ? 1 : 0.5 }} onClick={() => { S.ARP_PATRON = i; aplicarOpcionesSinte(); toca(); }}>{nm}</button>)}
          </div>
          <div style={ROW}>
            <span>ARP_VELOCIDAD</span>
            {VELOCIDADES_ARP.map((nm, i) => <button key={nm} style={{ ...INPUT, opacity: S.ARP_VELOCIDAD === i ? 1 : 0.5 }} onClick={() => { S.ARP_VELOCIDAD = i; aplicarOpcionesSinte(); toca(); }}>{nm}</button>)}
            <span>OCT.</span>
            {[1, 2, 3].map(n => <button key={n} style={{ ...INPUT, opacity: S.ARP_OCTAVAS === n ? 1 : 0.5 }} onClick={() => { S.ARP_OCTAVAS = n; aplicarOpcionesSinte(); toca(); }}>{n}</button>)}
          </div>
          {([["SINTE_VOCES", 1, 12, 1, "polifonía (vale al «Silenciar y reiniciar»)"], ["OCTAVA", 1, 7, 1, "octava de la tecla DO"], ["LOOKAHEAD_S", 0, 0.1, 0.005, "margen de las notas en vivo (s)"],
            ["CORTE_MIN", 20, 300, 5, "Hz"], ["CORTE_MAX", 2000, 18000, 100, "Hz"], ["RES_MAX", 2, 30, 0.5, "Q máximo"], ["ENV_OCTAVAS", 0, 8, 0.1, "octavas de MOD. ENV."],
            ["RUIDO_MAX", 0, 1, 0.05, "nivel del ruido con RUIDO 10"], ["LFO_AFIN_CENTS", 0, 200, 5, "vibrato (centésimas)"], ["LFO_CORTE_CENTS", 0, 4800, 100, "barrido del corte (centésimas)"],
            ["LFO_VOL_MAX", 0, 1, 0.05, "trémolo"], ["ECO_REALIM_MAX", 0, 0.85, 0.01, "tope de la realimentación"], ["ECO_FILTRO_HZ", 500, 8000, 100, "filtro del lazo del eco"],
            ["ECO_MAX_S", 0.5, 3, 0.1, "tiempo máximo del eco (s)"], ["NIVEL_VOZ", 0.05, 0.5, 0.01, "pico de cada voz"], ["ARP_GATE", 0.1, 0.98, 0.02, "fracción del paso que suena"],
            ["ESPACIO_DUR_S", 0.5, 6, 0.1, "Z102: largo de la reverberación (vale al «Silenciar y reiniciar»)"], ["ESPACIO_SECO", 0, 0.8, 0.05, "Z102: cuánto baja el seco con ESPACIO al máximo"]] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{S[k].toFixed(st < 1 ? 3 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={S[k]} onChange={ev => { S[k] = parseFloat(ev.target.value); aplicarOpcionesSinte(); toca(); }} />
            </div>
          ))}
          {/* parámetros del motor: van por setParamSinte(id, valor, "manual") (los mismos que mueve el atril) */}
          {PARAMS_SINTE.map(d => (
            <div key={d.id} style={ROW}>
              <span>{d.nombre} <span style={NOTE}>{PARAMS_SY.manual[indiceParamSinte(d.id)].toFixed(d.max > 50 ? 0 : d.curva === "paso" ? 0 : 3)} {d.unidad}</span></span>
              <input type="range" min={d.min} max={d.max} step={d.curva === "paso" ? 1 : (d.max - d.min) / 400} style={{ flex: 1 }} value={PARAMS_SY.manual[indiceParamSinte(d.id)]}
                onChange={ev => { setParamSinte(d.id, parseFloat(ev.target.value), "manual"); toca(); }} />
            </div>
          ))}
          <span style={LABEL}>Atril SY-40</span>
          {([["ETIQUETA_ESCALA", 0.7, 1.4, 0.05, "títulos y etiquetas (rehace la serigrafía)"], ["DISPLAY_VALOR_S", 0.5, 8, 0.5, "s del control tocado en el display"], ["VU_HZ", 5, 60, 1, "tope del VU y del display"]] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{A[k].toFixed(st < 1 ? 2 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={A[k]}
                onChange={ev => { A[k] = parseFloat(ev.target.value); toca(); }} onPointerUp={() => avisar(false)} onKeyUp={() => avisar(false)} />
            </div>
          ))}
          {([["ROTULOS_FILA", "leyenda 1 SONIDOS · 2 TIMBRE · … y números en los títulos"], ["ETIQUETA_AUTO_ASPECTO", "proporción < 1,6: etiquetas hasta × 1,15"]] as const).map(([k, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{nota}</span></span>
              <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); A[k] = !A[k]; avisar(false); toca(); }}>{A[k] ? "ON" : "off"}</button>
            </div>
          ))}
          <div style={{ ...ROW, ...NOTE }}><span>ROTULOS_MODO {A.ROTULOS_MODO} (leyenda en la placa de la barra) · doble clic en perillas y fader: el valor del sonido cargado · en el modo del SY-40 no hay atajos Z–M (el teclado es el piano)</span></div>
    </>
  );
}

// sección: diag-mic-z106
export function SecDiagMicZ106() {
  // Z106: diagnóstico de la grabación del SM-40 (permiso, entradas, formato, AudioContext, MediaRecorder, último error).
  const S = DBG_SAMPLER;
  const [, setTick] = useState(0);
  useEffect(() => {
    void actualizarDiagMic().then(() => setTick(t => (t + 1) % 1e6));   // solo consulta: no pide el permiso
    const id = setInterval(() => setTick(t => (t + 1) % 1e6), 250);
    return () => clearInterval(id);
  }, []);
  const toca = () => setTick(t => (t + 1) % 1e6);
  const M = MUESTREO;
  return (
    <>
          <span style={LABEL}>Diagnóstico de micrófono Z106 <span style={NOTE}>(grabación del SM-40; el permiso se pide solo al apretar GRABAR con MIC o «Probar micrófono ahora»; la prueba no graba en ningún pad ni se transmite)</span></span>
          <div style={{ ...ROW, ...NOTE }}><span>permiso de micrófono: {DIAG_MIC.permiso} · entradas: {DIAG_MIC.entradas.length}{DIAG_MIC.entradas.length ? ` (${DIAG_MIC.entradas.join(" · ")})` : ""}</span></div>
          <div style={{ ...ROW, ...NOTE }}><span>{estadoAudioYGrabador()} · formato elegido: {M.mime || (M.fase === "inactivo" ? "—" : "el del navegador")}{M.mimeReal ? ` (grabado: ${M.mimeReal})` : ""}</span></div>
          <div style={{ ...ROW, ...NOTE }}><span>estado: {M.fase}{textoGrabacion() ? ` · ${textoGrabacion()}` : ""} · pico de la última grabación {M.pico.toFixed(3)}</span></div>
          <div style={{ ...ROW, ...NOTE }}><span>último error: {M.nombreError ? `${M.nombreError} · ${MENSAJES_MUESTREO[M.codigo]}${M.detalle ? ` · ${M.detalle}` : ""}` : "ninguno"}</span></div>
          <div style={ROW}>
            <button style={INPUT} disabled={DIAG_MIC.probando} onClick={ev => { ev.currentTarget.blur(); void probarMicrofono().then(() => actualizarDiagMic()).then(toca); toca(); }}>Probar micrófono ahora</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); void actualizarDiagMic().then(toca); }}>Actualizar permisos y entradas</button>
          </div>
          {DIAG_MIC.prueba && <div style={{ ...ROW, ...NOTE }}><span>prueba: {DIAG_MIC.prueba}</span></div>}
          {([["GRAB_ECO", "cancelación de eco"], ["GRAB_RUIDO", "supresión de ruido"], ["GRAB_AGC", "control automático de ganancia"], ["GRAB_NORMALIZAR", "lleva lo grabado a GRAB_PICO"], ["GRAB_LIBERAR_PUNTERO", "libera el pointer lock para el aviso de permiso"]] as const).map(([k, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{nota}</span></span>
              <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); S[k] = !S[k]; toca(); }}>{S[k] ? "ON" : "off"}</button>
            </div>
          ))}
          {([["GRAB_PICO", 0.1, 1, 0.01, "pico tras normalizar"], ["GRAB_GANANCIA_MAX", 1, 100, 1, "tope de la normalización (×)"], ["GRAB_LISTO_S", 1, 20, 0.5, "s de «LISTO, PAD n»"]] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{S[k].toFixed(st < 1 ? 2 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={S[k]} onChange={ev => { S[k] = parseFloat(ev.target.value); toca(); }} />
            </div>
          ))}
    </>
  );
}

// sección: sampler-z103
export function SecSamplerZ103() {
  // Z103: SAMPLER SM-40 (motor lib/audio/sampler.ts). Estado 4 veces por segundo.
  const S = DBG_SAMPLER, A = DBG_ATRIL_SAMPLER;
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => (t + 1) % 1e6), 250); return () => clearInterval(id); }, []);
  const toca = () => setTick(t => (t + 1) % 1e6);
  const avisar = (remontar: boolean) => window.dispatchEvent(new CustomEvent("alight:atril-sampler-cambio", { detail: { remontar } }));
  const sel = EST_SAMPLER.sel;
  const probar = () => { const p = sel; padAbajo(p); setTimeout(() => padArriba(p), 700); };
  return (
    <>
          <span style={LABEL}>Sampler Z103 <span style={NOTE}>(SM-40 · probar con el checkpoint «Atril del sampler» o ?cp=atril_sampler · E entra, Q sale · pads: F G H J / V B N M · todo queda solo en memoria: nada se sube ni se guarda)</span></span>
          <div style={{ ...ROW, ...NOTE }}><span>pad {sel + 1} {SAMPLER.nombres[sel]}{SAMPLER.grabado[sel] ? " (grabado)" : ""} · voces vivas {SAMPLER.vivas}/{S.SAMPLER_MAX_SIMULTANEAS} (ranuras {RANURAS.n}) · grabación {SAMPLER.estadoGrab}{SAMPLER.estadoGrab === "grabando" ? ` ${SAMPLER.grabS.toFixed(1)} s` : ""} · memoria de muestras {(SAMPLER.memoriaBytes / 1048576).toFixed(2)} MB · disparos {SAMPLER.disparos} · robos {SAMPLER.robos} · grafo {SAMPLER.listo ? "listo" : "sin crear (nace con la primera acción)"}</span></div>
          <div style={ROW}>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); silenciarYReiniciarSampler(); toca(); }}>Silenciar y reiniciar sampler</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); irAInstrumento(2); }}>Ir al SM-40</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); probar(); toca(); }}>Probar pad {sel + 1}</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); if (SAMPLER.estadoGrab === "libre") grabar(); else pararGrabacion(); toca(); }}>{SAMPLER.estadoGrab === "libre" ? "Grabar" : "Parar"}</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); borrarPad(); toca(); }}>Borrar pad {sel + 1}</button>
          </div>
          <div style={ROW}>
            <span>PAD</span>
            {Array.from({ length: N_PADS }, (_, i) => <button key={i} style={{ ...INPUT, opacity: sel === i ? 1 : 0.5 }} onClick={() => { seleccionarPad(i); toca(); }}>{i + 1} {SAMPLER.nombres[i]}</button>)}
          </div>
          <div style={ROW}>
            <span>QUANT</span>
            {QUANTS.map((q, i) => <button key={q} style={{ ...INPUT, opacity: S.QUANT === i ? 1 : 0.5 }} onClick={() => { S.QUANT = i; aplicarOpcionesSampler(); toca(); }}>{q}</button>)}
            <span>FUENTE</span>
            {FUENTES_GRAB.map((q, i) => <button key={q} style={{ ...INPUT, opacity: S.FUENTE_GRAB === i ? 1 : 0.5 }} onClick={() => { S.FUENTE_GRAB = i; aplicarOpcionesSampler(); toca(); }}>{q}</button>)}
          </div>
          {([["ACTIVO", "off = sin sampler (vale al remontar)"], ["ON", "ON del módulo SALIDA"]] as const).map(([k, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{nota}</span></span>
              <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); S[k] = !S[k]; aplicarOpcionesSampler(); if (k === "ACTIVO") avisar(true); toca(); }}>{S[k] ? "ON" : "off"}</button>
            </div>
          ))}
          {([["SAMPLER_VOCES", 1, 16, 1, "ranuras base (vale al «Silenciar y reiniciar»)"], ["SAMPLER_MAX_SIMULTANEAS", 1, 32, 1, "tope de fuentes vivas"], ["SAMPLER_MAX_S", 1, 20, 0.5, "duración máxima de una grabación (s)"],
            ["CORTE_MIN", 50, 1000, 10, "Hz"], ["CORTE_MAX", 2000, 20000, 100, "Hz"], ["RES_MAX", 0.6, 12, 0.1, "Q máximo del filtro de salida"], ["ROBO_S", 0.002, 0.05, 0.001, "caída de una fuente robada o soltada (s)"],
            ["LOOKAHEAD_S", 0, 0.1, 0.005, "margen de los disparos inmediatos (s)"]] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{S[k].toFixed(st < 1 ? 3 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={S[k]} onChange={ev => { S[k] = parseFloat(ev.target.value); aplicarOpcionesSampler(); toca(); }} />
            </div>
          ))}
          {/* parámetros (globales y del pad seleccionado): van por setParamSampler(id, valor, "manual"), los mismos que mueve el atril */}
          {PARAMS_SAMPLER.map((d, i) => (
            <div key={d.id} style={ROW}>
              <span>{d.porPad ? `PAD ${sel + 1} ` : ""}{d.nombre} <span style={NOTE}>{manualIdxSampler(EST_SAMPLER, i, sel).toFixed(d.max > 50 ? 0 : 2)}</span></span>
              <input type="range" min={d.min} max={d.max} step={d.curva === "paso" ? 1 : (d.max - d.min) / 400} style={{ flex: 1 }} value={manualIdxSampler(EST_SAMPLER, i, sel)}
                onChange={ev => { setParamSampler(d.id, parseFloat(ev.target.value), "manual"); toca(); }} />
            </div>
          ))}
          <span style={LABEL}>Atril SM-40</span>
          {([["ETIQUETA_ESCALA", 0.7, 1.4, 0.05, "títulos y etiquetas (rehace la serigrafía)"], ["DISPLAY_VALOR_S", 0.5, 8, 0.5, "s del control tocado en el display"], ["VU_HZ", 5, 60, 1, "tope del VU, el display y las luces"]] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{A[k].toFixed(st < 1 ? 2 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={A[k]}
                onChange={ev => { A[k] = parseFloat(ev.target.value); toca(); }} onPointerUp={() => avisar(false)} onKeyUp={() => avisar(false)} />
            </div>
          ))}
          {([["ROTULOS_FILA", "leyenda 1 PADS · 2 GRABAR · 3 EDITAR PAD · 4 SALIDA y números en los títulos"], ["ETIQUETA_AUTO_ASPECTO", "proporción < 1,6: etiquetas hasta × 1,15"]] as const).map(([k, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{nota}</span></span>
              <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); A[k] = !A[k]; avisar(false); toca(); }}>{A[k] ? "ON" : "off"}</button>
            </div>
          ))}
          <div style={{ ...ROW, ...NOTE }}><span>ROTULOS_MODO {A.ROTULOS_MODO} · en el modo del SM-40 no hay atajos Z–M (V B N M son pads; X sigue cortando la transmisión)</span></div>
    </>
  );
}
