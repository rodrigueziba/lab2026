"use client";
// Z70: pestaña "Camino TARIMA (atriles)" del menú de debug. Cada sección es el código movido tal cual desde DebugMenu.tsx;
// toma del contexto (useDbg) solo el estado que usa. Registro y orden: lib/debugSecciones.ts.
import { useEffect, useState } from "react";
import { DBG_DOME, DBG_LECTERNS, DBG_CAM_IMAGE, DBG_CAM_SOUND, DBG_RETRO, DBG_FACE, DBG_AUDIO_NUCLEO, DBG_PLAY, DBG_RITMOS, DBG_ONDAS_TARIMA, DBG_CONSENT, DBG_LIVEKIT } from "@/lib/debugConfig";
import { mostrarTexto1Ahora, mostrarEleccionAhora, cortarTransmision, reiniciarConsentimiento, textoEstadoConsent, modoActual } from "@/lib/consentTarimaAcciones";   // Z91
import { publicarLiveKit, detenerLiveKit, textoEstadoLiveKit } from "@/lib/vivo/publicarLiveKit";   // Z92
import { sesionIdNavegador } from "@/lib/vivo/vivoAcciones";   // Z92
import { reintentarCamara, textoEstadoFuente } from "@/lib/fuenteVideoTarima";   // Z87
import { setLecternRetro, syncRetroUniforms } from "@/lib/retro/lecternMaterials";
import { STORE } from "@/lib/alightStore";
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
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => (t + 1) % 1e6), 250); return () => clearInterval(id); }, []);
  const toca = () => setTick(t => (t + 1) % 1e6);
  return (
    <>
          <span style={LABEL}>Ondas de la tarima Z87 <span style={NOTE}>(live · reemplazo de la webcam en el domo)</span></span>
          <div style={{ ...ROW, ...NOTE }}><span>{textoEstadoFuente()}</span></div>
          <div style={ROW}>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); O.MODO = "ondas"; toca(); }}>Forzar ondas</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); O.MODO = "webcam"; toca(); }}>Forzar webcam</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); O.MODO = "auto"; toca(); }}>Auto</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); reintentarCamara(); toca(); }}>Reintentar permiso</button>
          </div>
          {([["MODO", ["auto", "webcam", "ondas"]], ["ESTILO", ["onda", "espectro", "ambos"]], ["PALETA", ["ambar", "verde", "cian"]]] as const).map(([k, ops]) => (
            <div key={k} style={ROW}>
              <span>{k}</span>
              {ops.map(v => <button key={v} style={{ ...INPUT, opacity: O[k] === v ? 1 : 0.5 }} onClick={() => { O[k] = v; toca(); }}>{v}</button>)}
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
