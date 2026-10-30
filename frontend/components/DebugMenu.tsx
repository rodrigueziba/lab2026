"use client";

// C9: Debug overlay — toggle with Shift key.
// SILLAS tab: spotlight + prism parameters.
// TARIMA tab: star + dome parameters with live shader updates.

import { useEffect, useRef, useState } from "react";
import {
  DEBUG_ENABLED,
  DBG_SPOTLIGHT,
  DBG_PRISM,
  DBG_STARS,
  DBG_DOME,
  DBG_FACE,
  DBG_LECTERNS,
  DBG_RETRO,
  DBG_SILLAS,
  DBG_FLOOR,
  DBG_EFFECTS,
  DBG_CAM_IMAGE,
  DBG_CAM_SOUND,
} from "@/lib/debugConfig";
import { setVizVolume, restartVizAudio } from "@/lib/vizAudio";
import { DBG_STAR_MAT, DBG_DOME_MAT } from "./FaceDome";
import { STORE, storeSubscribe } from "@/lib/alightStore";
import { setLecternRetro, syncRetroUniforms } from "@/lib/retro/lecternMaterials";

type Tab = "SILLAS" | "TARIMA";

const PANEL: React.CSSProperties = {
  position:        "fixed",
  top:             12,
  right:           12,
  zIndex:          9999,
  background:      "rgba(10,10,15,0.92)",
  color:           "#d0d8e8",
  fontFamily:      "monospace",
  fontSize:        11,
  padding:         "10px 14px",
  borderRadius:    6,
  border:          "1px solid rgba(100,120,180,0.35)",
  minWidth:        240,
  maxHeight:       "80vh",
  overflowY:       "auto",
  backdropFilter:  "blur(6px)",
  userSelect:      "none",
};

const LABEL: React.CSSProperties = {
  display:       "block",
  marginBottom:  5,
  color:         "#8899bb",
};

const ROW: React.CSSProperties = {
  display:        "flex",
  justifyContent: "space-between",
  alignItems:     "center",
  gap:            8,
  marginBottom:   6,
};

const INPUT: React.CSSProperties = {
  background:   "rgba(255,255,255,0.07)",
  border:       "1px solid rgba(100,120,180,0.3)",
  borderRadius: 3,
  color:        "#d0d8e8",
  fontFamily:   "monospace",
  fontSize:     11,
  width:        72,
  padding:      "2px 4px",
};

const TAB_BTN = (active: boolean): React.CSSProperties => ({
  background:   active ? "rgba(80,120,200,0.35)" : "transparent",
  border:       "1px solid rgba(100,120,180,0.3)",
  borderRadius: 3,
  color:        active ? "#c0d0f0" : "#6070a0",
  fontFamily:   "monospace",
  fontSize:     11,
  padding:      "3px 10px",
  cursor:       "pointer",
  marginRight:  4,
});

const NOTE: React.CSSProperties = {
  fontSize:   9,
  color:      "#556080",
  fontStyle:  "italic",
  marginLeft: 4,
};

const DIVIDER: React.CSSProperties = {
  borderBottom: "1px solid rgba(100,120,180,0.15)",
  margin:       "8px 0",
};

function NumField({
  label,
  value,
  note,
  onChange,
  min,
  max,
  step = 0.01,
}: {
  label: string;
  value: number;
  note?: string;
  onChange?: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div style={ROW}>
      <span>
        {label}
        {note && <span style={NOTE}>{note}</span>}
      </span>
      <input
        type="number"
        style={INPUT}
        value={value}
        min={min}
        max={max}
        step={step}
        readOnly={!onChange}
        onChange={e => onChange?.(Number(e.target.value))}
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  note,
  onChange,
}: {
  label: string;
  value: string;
  note?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <div style={ROW}>
      <span>
        {label}
        {note && <span style={NOTE}>{note}</span>}
      </span>
      <input
        type="color"
        style={{ ...INPUT, width: 40, padding: 2, cursor: onChange ? "pointer" : "default" }}
        value={value}
        readOnly={!onChange}
        onChange={e => onChange?.(e.target.value)}
      />
    </div>
  );
}

const EFFECT_NAMES = [
  "0: RGB split",
  "1: Pixelate",
  "2: Wave",
  "3: Scanlines",
  "4: Mirror",
  "5: Stretch",
  "6: Posterize",
];

export default function DebugMenu() {
  const [visible, setVisible] = useState(false);
  const [tab, setTab]         = useState<Tab>("SILLAS");
  const [spot,     setSpot]     = useState({ ...DBG_SPOTLIGHT });
  const [stars,    setStars]    = useState({ ...DBG_STARS });
  const [dome,     setDome]     = useState({ ...DBG_DOME });
  const [face,     setFace]     = useState({ ...DBG_FACE });
  const [lectern,  setLectern]  = useState({ ...DBG_LECTERNS });
  const [retro,    setRetro]    = useState({ ...DBG_RETRO });
  const [sillas,   setSillas]   = useState({ ...DBG_SILLAS });
  const [legacyOpen, setLegacyOpen] = useState(false); // N2: Legado section collapsed by default
  const [prism,    setPrism]    = useState({ ...DBG_PRISM });
  const [floor,    setFloor]    = useState({ ...DBG_FLOOR });
  const [fx,       setFx]       = useState({ ...DBG_EFFECTS });
  const [camImg,   setCamImg]   = useState({ ...DBG_CAM_IMAGE });
  const [camSnd,   setCamSnd]   = useState({ ...DBG_CAM_SOUND });
  const [audioVol, setAudioVol] = useState(STORE.audio.volume);
  const focusRef                = useRef(false);

  // Sync audio volume from STORE changes
  useEffect(() => storeSubscribe(() => setAudioVol(STORE.audio.volume)), []);

  // Shift toggles the panel; ignore when focus is in a text/number input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Shift" && !focusRef.current) setVisible(v => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Spotlight handlers (changes apply on next scene load) ─────────────────
  const setSpotField = (key: keyof typeof DBG_SPOTLIGHT, val: number | string) => {
    (DBG_SPOTLIGHT as Record<string, number | string>)[key] = val;
    setSpot(s => ({ ...s, [key]: val }));
  };

  // ── Star handlers (twinkle speed is LIVE via shader uniform) ──────────────
  const setStarTwinkle = (v: number) => {
    DBG_STARS.twinkleSpeed = v;
    if (DBG_STAR_MAT.value) {
      DBG_STAR_MAT.value.uniforms.uTwinkleSpeed.value = v;
    }
    setStars(s => ({ ...s, twinkleSpeed: v }));
  };

  // ── Dome sector handler (LIVE via shader uniforms) ─────────────────────────
  const setSector = (sectorIdx: number, effectIdx: number) => {
    const keys = ["uE0","uE1","uE2","uE3","uE4","uE5","uE6"] as const;
    if (DBG_DOME_MAT.value) {
      DBG_DOME_MAT.value.uniforms[keys[sectorIdx]].value = effectIdx;
    }
  };

  if (!DEBUG_ENABLED || !visible) return null;

  return (
    <div
      style={PANEL}
      onFocus={() => { focusRef.current = true; }}
      onBlur={() =>  { focusRef.current = false; }}
    >
      <div style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#aabbd0", fontWeight: "bold", fontSize: 12 }}>⬛ Debug [Shift]</span>
        <span
          style={{ cursor: "pointer", color: "#556080", fontSize: 13, lineHeight: 1 }}
          onClick={() => setVisible(false)}
        >✕</span>
      </div>

      <div style={{ marginBottom: 10 }}>
        {(["SILLAS", "TARIMA"] as Tab[]).map(t => (
          <button key={t} style={TAB_BTN(tab === t)} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === "SILLAS" && (
        <>
          <span style={LABEL}>DiagonalSpot <span style={NOTE}>(reload to apply)</span></span>
          <ColorField
            label="color"
            value={spot.color}
            onChange={v => setSpotField("color", v)}
          />
          <NumField
            label="intensity"
            value={spot.intensity}
            step={100}
            onChange={v => setSpotField("intensity", v)}
          />
          <NumField label="distance"    value={spot.distance}    step={1}    onChange={v => setSpotField("distance",    v)} />
          <NumField label="angle"       value={spot.angle}       step={0.01} min={0} max={1.5} onChange={v => setSpotField("angle",   v)} />
          <NumField label="penumbra"    value={spot.penumbra}    step={0.01} min={0} max={1}   onChange={v => setSpotField("penumbra", v)} />
          <NumField label="attenuation" value={spot.attenuation} step={0.1}  onChange={v => setSpotField("attenuation", v)} />
          <NumField label="anglePower"  value={spot.anglePower}  step={0.1}  onChange={v => setSpotField("anglePower",  v)} />

          <div style={DIVIDER} />

          <span style={LABEL}>Prism <span style={NOTE}>(info)</span></span>
          <NumField label="landOffset (m)" value={DBG_PRISM.landOffset} note="reload to change" />

          <div style={DIVIDER} />
          <span style={LABEL}>Prism proximity <span style={NOTE}>(N2 — live, absolute)</span></span>
          <NumField label="prismRangeScale" value={prism.prismRangeScale} note="legacy N1 — no longer applied" />
          <NumField label="spinDir" value={prism.spinDir} step={2} min={-1} max={1} note="live"
            onChange={v => { DBG_PRISM.spinDir = v; setPrism(p => ({ ...p, spinDir: v })); }} />
          <NumField label="nearM" value={prism.nearM} step={0.1} min={0} max={5} note="live"
            onChange={v => { DBG_PRISM.nearM = v; setPrism(p => ({ ...p, nearM: v })); }} />
          <NumField label="closeM" value={prism.closeM} step={0.1} min={0} max={3} note="live"
            onChange={v => { DBG_PRISM.closeM = v; setPrism(p => ({ ...p, closeM: v })); }} />
          <NumField label="maxEffectM" value={prism.maxEffectM} step={0.05} min={0} max={2} note="live"
            onChange={v => { DBG_PRISM.maxEffectM = v; setPrism(p => ({ ...p, maxEffectM: v })); }} />
          <NumField label="translucentMs" value={prism.translucentMs} step={500} min={100} note="live"
            onChange={v => { DBG_PRISM.translucentMs = v; setPrism(p => ({ ...p, translucentMs: v })); }} />
          <NumField label="translucentOpacity" value={prism.translucentOpacity} step={0.05} min={0} max={1} note="live"
            onChange={v => { DBG_PRISM.translucentOpacity = v; setPrism(p => ({ ...p, translucentOpacity: v })); }} />
          <NumField label="spinAccel" value={prism.spinAccel} step={1} min={0} max={20} note="live"
            onChange={v => { DBG_PRISM.spinAccel = v; setPrism(p => ({ ...p, spinAccel: v })); }} />

          <div style={DIVIDER} />
          <span style={LABEL}>Dome visualizer <span style={NOTE}>(F2 — live unless noted)</span></span>
          <NumField label="vizSphereScale" value={sillas.vizSphereScale} step={0.05} min={1} max={2}
            note="live" onChange={v => { DBG_SILLAS.vizSphereScale = v; setSillas(s => ({ ...s, vizSphereScale: v })); }} />
          <NumField label="vizThetaMax (°)" value={sillas.vizThetaMax} step={5} min={60} max={180}
            note="live" onChange={v => { DBG_SILLAS.vizThetaMax = v; setSillas(s => ({ ...s, vizThetaMax: v })); }} />
          <NumField label="vizFadeMs" value={sillas.vizFadeMs} step={100} min={100} max={5000}
            note="live" onChange={v => { DBG_SILLAS.vizFadeMs = v; setSillas(s => ({ ...s, vizFadeMs: v })); }} />
          <NumField label="vizAngle" value={sillas.vizAngle} step={0.05} min={-0.5} max={0.5}
            note="G1-live" onChange={v => { DBG_SILLAS.vizAngle = v; setSillas(s => ({ ...s, vizAngle: v })); }} />
          <NumField label="vizTexSize" value={sillas.vizTexSize} step={512} min={512} max={4096}
            note="reload" />
          <NumField label="domeShellOpacity" value={sillas.domeShellOpacity} step={0.05} min={0} max={1}
            note="live" onChange={v => { DBG_SILLAS.domeShellOpacity = v; setSillas(s => ({ ...s, domeShellOpacity: v })); }} />
          <div style={ROW}>
            <span>vizTestPattern <span style={NOTE}>G1 debug</span></span>
            <button
              style={{ ...INPUT, width: 56, textAlign: "center", cursor: "pointer",
                background: sillas.vizTestPattern ? "rgba(0,120,60,0.5)" : "rgba(40,40,60,0.5)" }}
              onClick={() => {
                const v = !DBG_SILLAS.vizTestPattern;
                DBG_SILLAS.vizTestPattern = v;
                setSillas(s => ({ ...s, vizTestPattern: v }));
              }}
            >{sillas.vizTestPattern ? "ON" : "OFF"}</button>
          </div>
          <div style={ROW}>
            <span>vizHideShell <span style={NOTE}>G1 debug</span></span>
            <button
              style={{ ...INPUT, width: 56, textAlign: "center", cursor: "pointer",
                background: sillas.vizHideShell ? "rgba(0,120,60,0.5)" : "rgba(40,40,60,0.5)" }}
              onClick={() => {
                const v = !DBG_SILLAS.vizHideShell;
                DBG_SILLAS.vizHideShell = v;
                setSillas(s => ({ ...s, vizHideShell: v }));
              }}
            >{sillas.vizHideShell ? "ON" : "OFF"}</button>
          </div>
          <div style={ROW}>
            <span>vizSolidTest <span style={NOTE}>H1 Prueba A</span></span>
            <button
              style={{ ...INPUT, width: 56, textAlign: "center", cursor: "pointer",
                background: sillas.vizSolidTest ? "rgba(120,0,80,0.5)" : "rgba(40,40,60,0.5)" }}
              onClick={() => {
                const v = !DBG_SILLAS.vizSolidTest;
                DBG_SILLAS.vizSolidTest = v;
                setSillas(s => ({ ...s, vizSolidTest: v }));
              }}
            >{sillas.vizSolidTest ? "ON" : "OFF"}</button>
          </div>
          <NumField label="vizIntensity" value={sillas.vizIntensity} step={0.1} min={0} max={5}
            note="live" onChange={v => { DBG_SILLAS.vizIntensity = v; setSillas(s => ({ ...s, vizIntensity: v })); }} />
          <NumField label="vizGhost" value={sillas.vizGhost} step={0.1} min={0} max={3}
            note="live" onChange={v => { DBG_SILLAS.vizGhost = v; setSillas(s => ({ ...s, vizGhost: v })); }} />
          <NumField label="vizMatrix" value={sillas.vizMatrix} step={0.05} min={0} max={2}
            note="live" onChange={v => { DBG_SILLAS.vizMatrix = v; setSillas(s => ({ ...s, vizMatrix: v })); }} />
          <NumField label="vizRings" value={sillas.vizRings} step={0.1} min={0} max={2}
            note="live" onChange={v => { DBG_SILLAS.vizRings = v; setSillas(s => ({ ...s, vizRings: v })); }} />
          <NumField label="vizSpeed" value={sillas.vizSpeed} step={0.05} min={0} max={3}
            note="live" onChange={v => { DBG_SILLAS.vizSpeed = v; setSillas(s => ({ ...s, vizSpeed: v })); }} />
          <NumField label="vizAudioReact" value={sillas.vizAudioReact} step={0.1} min={0} max={3}
            note="live" onChange={v => { DBG_SILLAS.vizAudioReact = v; setSillas(s => ({ ...s, vizAudioReact: v })); }} />
          <ColorField label="vizTopColor" value={sillas.vizTopColor}
            onChange={v => { DBG_SILLAS.vizTopColor = v; setSillas(s => ({ ...s, vizTopColor: v })); }} />
          <ColorField label="vizBottomColor" value={sillas.vizBottomColor}
            onChange={v => { DBG_SILLAS.vizBottomColor = v; setSillas(s => ({ ...s, vizBottomColor: v })); }} />
          <NumField label="touchEpsM" value={sillas.touchEpsM} step={0.01} min={0} max={0.5}
            note="reload" />
          <NumField
            label="vizVolume"
            value={sillas.vizVolume}
            step={0.05} min={0} max={1}
            note="live"
            onChange={v => {
              DBG_SILLAS.vizVolume = v;
              setSillas(s => ({ ...s, vizVolume: v }));
              setVizVolume(v);
            }}
          />
          <div style={ROW}>
            <span>vizTrackUrl</span>
            <input
              type="text"
              style={{ ...INPUT, width: 110 }}
              defaultValue={DBG_SILLAS.vizTrackUrl}
              onBlur={e => { DBG_SILLAS.vizTrackUrl = e.target.value; }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button
              style={{ flex: 1, padding: "4px 0", cursor: "pointer", fontFamily: "monospace", fontSize: 11,
                background: "rgba(20,80,40,0.7)", color: "#7fff9f", border: "1px solid rgba(80,180,100,0.4)", borderRadius: 3 }}
              onClick={() => window.dispatchEvent(new CustomEvent("alight:visualizer-activate"))}
            >Activar visualizador</button>
            <button
              style={{ flex: 1, padding: "4px 0", cursor: "pointer", fontFamily: "monospace", fontSize: 11,
                background: "rgba(80,20,20,0.7)", color: "#ff9f9f", border: "1px solid rgba(180,80,80,0.4)", borderRadius: 3 }}
              onClick={() => window.dispatchEvent(new CustomEvent("alight:visualizer-deactivate"))}
            >Desactivar visualizador</button>
          </div>
          <button
            style={{ width: "100%", marginTop: 4, padding: "4px 0", cursor: "pointer", fontFamily: "monospace", fontSize: 11,
              background: "rgba(20,40,80,0.7)", color: "#9fbfff", border: "1px solid rgba(80,120,200,0.4)", borderRadius: 3 }}
            onClick={() => restartVizAudio()}
          >↺ Reiniciar música</button>

          <div style={DIVIDER} />
          {/* N2: Legado — FloorVisualizer + SectorAudioFX (disabled, kept for reference) */}
          <div style={{ ...ROW, marginBottom: 4 }}>
            <span style={{ ...LABEL, marginBottom: 0 }}>Legado <span style={NOTE}>(N2 — desactivado)</span></span>
            <button style={{ ...INPUT, width: "auto", padding: "1px 6px", cursor: "pointer" }}
              onClick={() => setLegacyOpen(o => !o)}>{legacyOpen ? "▲" : "▼"}</button>
          </div>
          {legacyOpen && <>
          <span style={LABEL}>Floor visualizer <span style={NOTE}>(H2 — live)</span></span>
          <NumField label="innerR (m)"   value={floor.innerR}   step={0.1} min={0} max={10}
            onChange={v => { DBG_FLOOR.innerR = v;   setFloor(f => ({ ...f, innerR: v })); }} />
          <NumField label="outerR (m)"   value={floor.outerR}   step={0.5} min={5} max={30}
            onChange={v => { DBG_FLOOR.outerR = v;   setFloor(f => ({ ...f, outerR: v })); }} />
          <NumField label="rotationDeg"  value={floor.rotationDeg} step={5} min={-180} max={180}
            onChange={v => { DBG_FLOOR.rotationDeg = v; setFloor(f => ({ ...f, rotationDeg: v })); }} />
          <NumField label="opacity"      value={floor.opacity}  step={0.05} min={0} max={1}
            onChange={v => { DBG_FLOOR.opacity = v;  setFloor(f => ({ ...f, opacity: v })); }} />
          <NumField label="baseSpeed"    value={floor.baseSpeed} step={0.1} min={0} max={5}
            onChange={v => { DBG_FLOOR.baseSpeed = v; setFloor(f => ({ ...f, baseSpeed: v })); }} />
          <NumField label="speedGain"    value={floor.speedGain} step={0.5} min={0} max={20}
            onChange={v => { DBG_FLOOR.speedGain = v; setFloor(f => ({ ...f, speedGain: v })); }} />
          <NumField label="speedExp"     value={floor.speedExp}  step={0.1} min={0.1} max={4}
            onChange={v => { DBG_FLOOR.speedExp = v; setFloor(f => ({ ...f, speedExp: v })); }} />
          <NumField label="typeMinS"     value={floor.typeMinS}  step={1} min={1}
            onChange={v => { DBG_FLOOR.typeMinS = v; setFloor(f => ({ ...f, typeMinS: v })); }} />
          <NumField label="typeMaxS"     value={floor.typeMaxS}  step={1} min={2}
            onChange={v => { DBG_FLOOR.typeMaxS = v; setFloor(f => ({ ...f, typeMaxS: v })); }} />
          <div style={ROW}>
            <span>speedMode</span>
            <button
              style={{ ...INPUT, width: 72, textAlign: "center", cursor: "pointer",
                background: floor.speedMode === "user" ? "rgba(60,100,20,0.5)" : "rgba(20,60,100,0.5)" }}
              onClick={() => {
                const v = floor.speedMode === "spatial" ? "user" : "spatial";
                DBG_FLOOR.speedMode = v as "spatial" | "user";
                setFloor(f => ({ ...f, speedMode: v as "spatial" | "user" }));
              }}
            >{floor.speedMode}</button>
          </div>
          <span style={LABEL}>Sector type override <span style={NOTE}>(-1 = auto, 0-3 = forced)</span></span>
          {([0,1,2,3] as const).map(i => {
            const key = `s${i}Type` as "s0Type"|"s1Type"|"s2Type"|"s3Type";
            return (
              <NumField key={i} label={`S${i} type`} value={floor[key]} step={1} min={-1} max={3}
                onChange={v => { DBG_FLOOR[key] = v; setFloor(f => ({ ...f, [key]: v })); }} />
            );
          })}

          <div style={DIVIDER} />
          <span style={LABEL}>Audio FX <span style={NOTE}>(H3, sector 0=LP 1=HP 2=rate 3=echo+rev)</span></span>
          <NumField label="lpEnd (Hz)"    value={fx.lpEnd}       step={50}  min={20}   max={20000}
            onChange={v => { DBG_EFFECTS.lpEnd = v;        setFx(f => ({ ...f, lpEnd: v })); }} />
          <NumField label="hpEnd (Hz)"    value={fx.hpEnd}       step={100} min={20}   max={20000}
            onChange={v => { DBG_EFFECTS.hpEnd = v;        setFx(f => ({ ...f, hpEnd: v })); }} />
          <NumField label="rateEnd"       value={fx.rateEnd}     step={0.05} min={0.25} max={4}
            onChange={v => { DBG_EFFECTS.rateEnd = v;      setFx(f => ({ ...f, rateEnd: v })); }} />
          <NumField label="echoFbEnd"     value={fx.echoFbEnd}   step={0.05} min={0}    max={0.95}
            onChange={v => { DBG_EFFECTS.echoFbEnd = v;    setFx(f => ({ ...f, echoFbEnd: v })); }} />
          <NumField label="echoMixEnd"    value={fx.echoMixEnd}  step={0.05} min={0}    max={1}
            onChange={v => { DBG_EFFECTS.echoMixEnd = v;   setFx(f => ({ ...f, echoMixEnd: v })); }} />
          <NumField label="reverbMixEnd"  value={fx.reverbMixEnd} step={0.05} min={0}   max={1}
            onChange={v => { DBG_EFFECTS.reverbMixEnd = v; setFx(f => ({ ...f, reverbMixEnd: v })); }} />
          <div style={ROW}>
            <span>Simulate pos</span>
            <button style={INPUT} onClick={() => {
              const v = !fx.simEnabled;
              DBG_EFFECTS.simEnabled = v;
              setFx(f => ({ ...f, simEnabled: v }));
            }}>{fx.simEnabled ? "ON" : "off"}</button>
          </div>
          {fx.simEnabled && <>
            <NumField label="simSector" value={fx.simSector} step={1} min={-1} max={3}
              onChange={v => { DBG_EFFECTS.simSector = v; setFx(f => ({ ...f, simSector: v })); }} />
            <NumField label="simT (0-1)" value={fx.simT} step={0.05} min={0} max={1}
              onChange={v => { DBG_EFFECTS.simT = v; setFx(f => ({ ...f, simT: v })); }} />
          </>}
          </>} {/* end Legado */}

          <div style={DIVIDER} />
          <span style={LABEL}>Secuencia sillas <span style={NOTE}>(N1)</span></span>
          <NumField label="releaseDelayMs" value={sillas.releaseDelayMs} step={500} min={0} max={30000} note="ms post dome-revealed → sala_activa"
            onChange={v => { DBG_SILLAS.releaseDelayMs = v; setSillas(s => ({ ...s, releaseDelayMs: v })); }} />
          <div style={ROW}>
            <span>lockLook <span style={NOTE}>(lock mouse-look)</span></span>
            <button style={INPUT} onClick={() => {
              const v = !sillas.lockLook;
              DBG_SILLAS.lockLook = v;
              setSillas(s => ({ ...s, lockLook: v }));
            }}>{sillas.lockLook ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer" }}
              onClick={() => window.dispatchEvent(new CustomEvent("alight:debug-skip-sillas"))}>
              Saltar → sala activa
            </button>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer" }}
              onClick={() => window.dispatchEvent(new CustomEvent("alight:debug-reset-sillas"))}>
              Reiniciar secuencia
            </button>
          </div>
        </>
      )}

      {tab === "TARIMA" && (
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

          <div style={DIVIDER} />

          <span style={LABEL}>Dome <span style={NOTE}>(sector effects live)</span></span>
          <NumField label="delayMs"          value={dome.delayMs}          note="next activation" step={500} onChange={v => { DBG_DOME.delayMs = v;          setDome(d => ({ ...d, delayMs:          v })); }} />
          <NumField label="glitchIntervalMs" value={dome.glitchIntervalMs} note="next activation" step={500} onChange={v => { DBG_DOME.glitchIntervalMs = v; setDome(d => ({ ...d, glitchIntervalMs: v })); }} />

          <div style={DIVIDER} />
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

          <div style={DIVIDER} />
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

          <div style={DIVIDER} />
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

          <div style={DIVIDER} />
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

          <div style={DIVIDER} />
          <span style={LABEL}>Audio (T7 — read-only live)</span>
          <NumField label="volume"     value={audioVol}                 step={0.01} />
          <NumField label="trackIndex" value={STORE.audio.trackIndex}   step={1} />
          <NumField label="distortion" value={STORE.audio.distortion}   step={0.01} />
          <NumField label="reverb"     value={STORE.audio.reverb}       step={0.01} />
          <NumField label="delay.amount"   value={STORE.audio.delay.amount}   step={0.01} />
          <NumField label="delay.feedback" value={STORE.audio.delay.feedback} step={0.01} />

          <div style={DIVIDER} />
          <span style={LABEL}>Extra lights <span style={NOTE}>(added by T5 panel)</span></span>
          <NumField label="count" value={STORE.lights.extras.length} step={1} />
          <NumField label="globalIntensity" value={STORE.lights.globalIntensity} step={0.1} />
        </>
      )}
    </div>
  );
}
