"use client";
// Z70: estilos, campos y medidores del menú de debug (movidos tal cual desde DebugMenu.tsx).
import { useState, useEffect } from "react";
import { DBG_FLUIDO } from "@/lib/debugConfig";
import { BAND_STATE, BAND_U2_DEBUG, N5_STATE } from "@/lib/vizAudio";

export const FLUIDO_DEFAULTS = { MEZCLA_AZUL: DBG_FLUIDO.MEZCLA_AZUL, MEZCLA_NARANJA: DBG_FLUIDO.MEZCLA_NARANJA, WARP: DBG_FLUIDO.WARP, VEL_BASE: DBG_FLUIDO.VEL_BASE, PULSO_LUZ: DBG_FLUIDO.PULSO_LUZ };   // Z63: para "Volver a defaults"

export type Tab = "SILLAS" | "TARIMA";

export const PANEL: React.CSSProperties = {
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

export const LABEL: React.CSSProperties = {
  display:       "block",
  marginBottom:  5,
  color:         "#8899bb",
};

export const ROW: React.CSSProperties = {
  display:        "flex",
  justifyContent: "space-between",
  alignItems:     "center",
  gap:            8,
  marginBottom:   6,
};

export const INPUT: React.CSSProperties = {
  background:   "rgba(255,255,255,0.07)",
  border:       "1px solid rgba(100,120,180,0.3)",
  borderRadius: 3,
  color:        "#d0d8e8",
  fontFamily:   "monospace",
  fontSize:     11,
  width:        72,
  padding:      "2px 4px",
};

export const TAB_BTN = (active: boolean): React.CSSProperties => ({
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

export const NOTE: React.CSSProperties = {
  fontSize:   9,
  color:      "#556080",
  fontStyle:  "italic",
  marginLeft: 4,
};

export const DIVIDER: React.CSSProperties = {
  borderBottom: "1px solid rgba(100,120,180,0.15)",
  margin:       "8px 0",
};

export function NumField({
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

export function ColorField({
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

export const EFFECT_NAMES = [
  "0: RGB split",
  "1: Pixelate",
  "2: Wave",
  "3: Scanlines",
  "4: Mirror",
  "5: Stretch",
  "6: Posterize",
];

// N4: band energy + gate state overlay — polls BAND_STATE at 20 fps via setInterval
export function BandEnergyOverlay() {
  const [energies, setEnergies] = useState([0, 0, 0, 0]);
  const [gates,    setGates]    = useState([false, false, false, false]);
  useEffect(() => {
    const id = setInterval(() => {
      setEnergies([...BAND_STATE.energy]);
      setGates([...BAND_STATE.gateOpen]);
    }, 50);
    return () => clearInterval(id);
  }, []);
  const BAND_LABELS = ["0:bass", "1:kick", "2:mids", "3:treble"];
  return (
    <div style={{ marginTop: 6 }}>
      {[0,1,2,3].map(i => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:4, marginBottom:3 }}>
          <span style={{ fontSize:9, width:52, color: gates[i] ? "#ff9a1f" : "#556" }}>{BAND_LABELS[i]}</span>
          <div style={{ flex:1, background:"#1a1a2a", height:5, borderRadius:2 }}>
            <div style={{
              width:`${Math.min(1, energies[i]) * 100}%`, height:"100%",
              background: gates[i] ? "#ff9a1f" : "#3a5a8a", borderRadius:2, transition:"width 0.05s",
            }} />
          </div>
          <span style={{ fontSize:9, width:26, textAlign:"right", color:"#889" }}>
            {(energies[i] * 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// U2: AGC meters — per-band rawRMS, normEnergy bar, floor/ceil, kick, paused
export function AudioU2Meters() {
  const [d, setD] = useState({
    raw:   [0,0,0,0] as number[],
    norm:  [0,0,0,0] as number[],
    floor: [0,0,0,0] as number[],
    ceil:  [0.1,0.1,0.1,0.1] as number[],
    kick:  false,
    gate:  [false,false,false,false] as boolean[],
  });
  useEffect(() => {
    const id = setInterval(() => {
      setD({
        raw:   [...BAND_U2_DEBUG.rawEnergy],
        norm:  [...BAND_U2_DEBUG.normEnergy],
        floor: [...BAND_U2_DEBUG.agcFloor],
        ceil:  [...BAND_U2_DEBUG.agcCeil],
        kick:  BAND_STATE.kick,
        gate:  [...BAND_STATE.gateOpen],
      });
    }, 50);
    return () => clearInterval(id);
  }, []);
  const LABELS = ["B0:sol","B1:mt","B2:sky","B3:ln"];
  return (
    <div style={{ marginTop:6, fontSize:9, fontFamily:"monospace" }}>
      <div style={{ color:"#556080", marginBottom:3 }}>kick: <span style={{ color: d.kick ? "#ff9a1f" : "#556" }}>{d.kick ? "■" : "·"}</span></div>
      {[0,1,2,3].map(i => (
        <div key={i} style={{ marginBottom:4 }}>
          <div style={{ display:"flex", gap:4, alignItems:"center", marginBottom:1 }}>
            <span style={{ width:48, color: d.gate[i] ? "#ff9a1f" : "#667" }}>{LABELS[i]}</span>
            <span style={{ width:34, color:"#557" }}>raw:{(d.raw[i]*1000).toFixed(1)}</span>
            <span style={{ width:28, color:"#9cf" }}>N:{(d.norm[i]*100).toFixed(0)}%</span>
            <span style={{ color:"#556" }}>fl:{d.floor[i].toFixed(3)} ce:{d.ceil[i].toFixed(3)}</span>
          </div>
          <div style={{ background:"#1a1a2a", height:5, borderRadius:2 }}>
            <div style={{ width:`${d.norm[i]*100}%`, height:"100%",
              background: d.gate[i] ? "#ff9a1f" : "#3a7aaa", borderRadius:2, transition:"width 0.05s" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// N5: proximity display — polls N5_STATE at 10 fps
export function N5ProximityOverlay() {
  const [prox, setProx] = useState({ l: 0, r: 0 });
  useEffect(() => {
    const id = setInterval(() => setProx({ l: N5_STATE.leftProximity, r: N5_STATE.rightProximity }), 100);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ marginTop: 4 }}>
      {[{ label: "izq (img)", v: prox.l }, { label: "der (snd)", v: prox.r }].map(({ label, v }) => (
        <div key={label} style={{ display:"flex", alignItems:"center", gap:4, marginBottom:3 }}>
          <span style={{ fontSize:9, width:56 }}>{label}</span>
          <div style={{ flex:1, background:"#1a1a2a", height:5, borderRadius:2 }}>
            <div style={{ width:`${v * 100}%`, height:"100%", background:"#2e9e5b", borderRadius:2, transition:"width 0.1s" }} />
          </div>
          <span style={{ fontSize:9, width:26, textAlign:"right", color:"#889" }}>{(v * 100).toFixed(0)}%</span>
        </div>
      ))}
    </div>
  );
}

