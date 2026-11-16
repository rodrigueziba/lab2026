"use client";
// Z70: pestaña "Camino TARIMA (atriles)" del menú de debug. Cada sección es el código movido tal cual desde DebugMenu.tsx;
// toma del contexto (useDbg) solo el estado que usa. Registro y orden: lib/debugSecciones.ts.
import { DBG_DOME, DBG_LECTERNS, DBG_CAM_IMAGE, DBG_CAM_SOUND, DBG_RETRO, DBG_FACE } from "@/lib/debugConfig";
import { setLecternRetro, syncRetroUniforms } from "@/lib/retro/lecternMaterials";
import { STORE } from "@/lib/alightStore";
import { LABEL, NOTE, NumField, ROW, INPUT, EFFECT_NAMES } from "../comun";
import { useDbg } from "../contexto";

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
            <span style={LABEL}>Debug overlays (mode/lock/hover)</span>
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