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
  DBG_RETRO_FX,
  DBG_SILLAS,
  DBG_FLOOR,
  DBG_EFFECTS,
  DBG_CAM_IMAGE,
  DBG_CAM_SOUND,
  DOME_METERS,
  DBG_DOME_LIVE,
  DBG_DOME_FORCE,
  DBG_FLASH,
  DBG_PANELES,
  DBG_LINTERNA,
  DBG_SUBPANELES,
  DBG_ORBITAS,
  DBG_ACERC,
  DBG_PRIORIDAD,
  DBG_LOG_PANEL,
} from "@/lib/debugConfig";
import { FLASH_STATE, estimarLuminanciaPico, FLASH_MEDICION, pedirMedicionFlash } from "@/lib/curtainFlash";
import { LINTERNA_STATE, ORBITAS_INFO, ACERC } from "@/lib/linternaPaneles";
import { RETRO_FLAGS } from "@/lib/retro/retroFlags";
import { CRT_UNIFORMS } from "@/lib/retro/retroCRT";
import { setVizVolume, restartVizAudio, BAND_STATE, BAND_U2_DEBUG, reshuffleAssignment, N5_STATE } from "@/lib/vizAudio";
import { setHazBandOn } from "@/lib/haz";
import { DBG_STAR_MAT, DBG_DOME_MAT } from "./FaceDome";
import { STORE, storeSubscribe, activateVisualizerOnce, resetVizActivated, PANELES_SILLAS } from "@/lib/alightStore";
import { setLecternRetro, syncRetroUniforms } from "@/lib/retro/lecternMaterials";
import { BIG_MESH_DATA } from "@/lib/bigMeshData";

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

// N4: band energy + gate state overlay — polls BAND_STATE at 20 fps via setInterval
function BandEnergyOverlay() {
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
function AudioU2Meters() {
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
function N5ProximityOverlay() {
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

export default function DebugMenu() {
  const [visible, setVisible] = useState(false);
  const [tab, setTab]         = useState<Tab>("SILLAS");
  const [spot,     setSpot]     = useState({ ...DBG_SPOTLIGHT });
  const [stars,    setStars]    = useState({ ...DBG_STARS });
  const [dome,     setDome]     = useState({ ...DBG_DOME });
  const [face,     setFace]     = useState({ ...DBG_FACE });
  const [lectern,  setLectern]  = useState({ ...DBG_LECTERNS });
  const [retro,    setRetro]    = useState({ ...DBG_RETRO });
  const [retroFx,  setRetroFx]  = useState({ ...DBG_RETRO_FX });
  const [sillas,   setSillas]   = useState({ ...DBG_SILLAS });
  const [legacyOpen, setLegacyOpen] = useState(false); // N2: Legado section collapsed by default
  const [bandRev,    setBandRev]    = useState(0);     // N4: bumped on reshuffle to re-render assignment
  const [bandOnArr,  setBandOnArr]  = useState([false, false, false, false]); // R3: toggle state per beam
  const [prism,    setPrism]    = useState({ ...DBG_PRISM });
  const [floor,    setFloor]    = useState({ ...DBG_FLOOR });
  const [fx,       setFx]       = useState({ ...DBG_EFFECTS });
  const [camImg,   setCamImg]   = useState({ ...DBG_CAM_IMAGE });
  const [camSnd,   setCamSnd]   = useState({ ...DBG_CAM_SOUND });
  const [audioVol, setAudioVol] = useState(STORE.audio.volume);
  const focusRef                = useRef(false);
  // W4: medidores del domo — se pollea a 10fps solo cuando showDomeMeters está activo
  const [domeM, setDomeM] = useState({ sol: 0, mont: 0, cielo: 0, lin: 0, kick: 0, dawn: 0, phase: 'inactivo' });
  useEffect(() => {
    if (!sillas.showDomeMeters) return;
    const id = setInterval(() => setDomeM({ ...DOME_METERS }), 100);
    return () => clearInterval(id);
  }, [sillas.showDomeMeters]);
  // X2: diagnóstico domo — se pollea a 10fps solo cuando showDomeX2 está activo
  const [domeX2, setDomeX2] = useState({ ...DBG_DOME_LIVE });
  const [domeForce, setDomeForce] = useState({ visible: false, masks: false });
  useEffect(() => {
    if (!sillas.showDomeX2) return;
    const id = setInterval(() => setDomeX2({ ...DBG_DOME_LIVE }), 100);
    return () => clearInterval(id);
  }, [sillas.showDomeX2]);

  // F1: destello del telón — constantes + estado en vivo (poll 10fps solo con el menú abierto)
  const [flash, setFlash] = useState({ ...DBG_FLASH });
  const [flashLive, setFlashLive] = useState({ fase: FLASH_STATE.fase as string, luz: 0, visible: false, uFlash: 0, uGlare: 0, lum: 0 });
  const [medicion, setMedicion] = useState({ ...FLASH_MEDICION }); // G2: medición real del pico
  // Z2: linterna — constantes + estado en vivo (mismo poll de 10 fps)
  const [linterna, setLinterna] = useState({ ...DBG_LINTERNA });
  const [linternaLive, setLinternaLive] = useState("inactiva");
  const [subp, setSubp] = useState({ ...DBG_SUBPANELES }); // Z4
  const [orb, setOrb] = useState({ ...DBG_ORBITAS });       // Z7
  const [acerc, setAcerc] = useState({ ...DBG_ACERC });     // Z8
  const [prio, setPrio] = useState({ ...DBG_PRIORIDAD });   // Z10
  const [logPanelOn, setLogPanelOn] = useState(DBG_LOG_PANEL.LOG_ACTIVO); // Z12
  const [acercLive, setAcercLive] = useState("orbita");     // Z8
  const [orbInfo, setOrbInfo] = useState("");               // Z7: tabla de anillos
  // P1: paneles SILLAS — constantes + estado en vivo (mismo poll)
  const [paneles, setPaneles] = useState({ ...DBG_PANELES, forzado: false });
  const [panelesFase, setPanelesFase] = useState(PANELES_SILLAS.fase as string);
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setFlashLive({
      fase: FLASH_STATE.fase, luz: FLASH_STATE.luzTelon,
      visible: FLASH_STATE.telonMontado && FLASH_STATE.telonVisible,
      uFlash: CRT_UNIFORMS.uFlash.value, // F2
      uGlare: CRT_UNIFORMS.uGlare.value, // G1
      // F3: luminancia final estimada en el centro en el pico (fórmula CRT + ACES + sRGB)
      lum: estimarLuminanciaPico(CRT_UNIFORMS.uFlashColor.value, CRT_UNIFORMS.uTint.value,
        CRT_UNIFORMS.uScan.value, CRT_UNIFORMS.uLift.value, DBG_RETRO_FX.toneExposure, CRT_UNIFORMS.uGrain.value),
    }), 100);
    const idP = setInterval(() => {
      setPanelesFase(PANELES_SILLAS.fase); // P1
      { // Z2
        const L = LINTERNA_STATE;
        const txt = `${L.habilitada ? "habilitada" : "NO habilitada (movimiento bloqueado)"} · ${L.fase}${L.sel ? ` · panel ${L.sel.indice} · ${L.sel.angulo.toFixed(1)}° · ${Math.round(L.progreso * 100)}%` : ""}${L.apagada ? " · apagada" : ""}`;
        setLinternaLive(prev => (prev === txt ? prev : txt));
      }
      { // Z8
        const L = ACERC.layout;
        const txt = `${ACERC.fase}${ACERC.fase === "abierto" ? (ACERC.miraDentro ? " · mira dentro" : ` · fuera ${ACERC.tFuera ? Math.round(performance.now() - ACERC.tFuera) : 0} ms`) : ""}${ACERC.panel ? ` · panel ${ACERC.panel.indice} · d ${ACERC.distancia.toFixed(2)} m · sube ${L.up.toFixed(2)} m${L.alejado ? " · alejado" : ""}${L.entra ? "" : " · ✗ no entra"}` : ""} · subpaneles ${(ACERC.escalaSub * 100).toFixed(0)} %`;
        setAcercLive(prev => (prev === txt ? prev : txt));
      }
      { // Z7
        const I = ORBITAS_INFO;
        const txt = I.anillos.map((a, i) => `A${i}: r ${a.radio.toFixed(1)} · y ${a.altura.toFixed(2)} [${a.yMin.toFixed(1)}–${a.yMax.toFixed(1)}] · v ${(a.vel * 60).toFixed(4)} rad/s · ${a.cantidad}/${a.capacidad}${a.entra ? "" : " ✗ no entra"}`).join("\n")
          + `\nTOTAL ${I.total} de ${I.pedidos} · origen haces y ${I.yHaz.toFixed(2)} · regeneración ${I.version}`;
        setOrbInfo(prev => (prev === txt ? prev : txt));
      }
      setMedicion(m => (m.estado === FLASH_MEDICION.estado && m.centro === FLASH_MEDICION.centro ? m : { ...FLASH_MEDICION })); // G2
    }, 100);
    return () => { clearInterval(id); clearInterval(idP); };
  }, [visible]);

  // Z2: Meshes grandes — se pollea a 2fps solo cuando showBigMeshes está activo
  const [bigMeshList, setBigMeshList] = useState<typeof BIG_MESH_DATA>([]);
  const [meshHidden, setMeshHidden] = useState<Record<number, boolean>>({});
  useEffect(() => {
    if (!sillas.showBigMeshes) return;
    const id = setInterval(() => { if (BIG_MESH_DATA.length) setBigMeshList([...BIG_MESH_DATA]); }, 500);
    return () => clearInterval(id);
  }, [sillas.showBigMeshes]);

  // Sync audio volume from STORE changes
  useEffect(() => storeSubscribe(() => setAudioVol(STORE.audio.volume)), []);

  // R3: keep bandOnArr in sync — fires from both walking and debug buttons
  useEffect(() => {
    const onToggle = (e: Event) => {
      const { index, on } = (e as CustomEvent).detail as { index: number; on: boolean };
      setBandOnArr(arr => { const next = [...arr]; next[index] = on; return next; });
    };
    window.addEventListener("alight:haz-toggle", onToggle);
    return () => window.removeEventListener("alight:haz-toggle", onToggle);
  }, []);

  // Shift toggles the panel; ignore when focus is in a text/number input.
  // U8: release pointer lock when opening so the user doesn't need ESC first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Shift" && !focusRef.current) {
        setVisible(v => {
          if (!v && document.pointerLockElement) document.exitPointerLock();
          return !v;
        });
      }
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

  // U8: stop all pointer/mouse/click/wheel events from bubbling out of the panel.
  // React SyntheticEvent.stopPropagation() also calls nativeEvent.stopPropagation(),
  // which prevents events from reaching document — where drei's PointerLockControls
  // listener lives (it adds `document.addEventListener('click', () => controls.lock())`
  // when no `selector` prop is given).
  const stopBubble = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      data-debug-panel="1"
      style={PANEL}
      onFocus={() => { focusRef.current = true; }}
      onBlur={() =>  { focusRef.current = false; }}
      onPointerDown={stopBubble}
      onMouseDown={stopBubble}
      onMouseUp={stopBubble}
      onClick={stopBubble}
      onWheel={stopBubble}
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
          {/* Z2: Meshes grandes — lista meshes con bbox >20m para diagnóstico de formas negras */}
          <div style={ROW}>
            <span style={LABEL}>Z2 Meshes grandes <span style={NOTE}>(bbox &gt; 20m)</span></span>
            <button style={{ ...INPUT, width: 56, textAlign: "center", cursor: "pointer",
              background: sillas.showBigMeshes ? "rgba(160,80,0,0.7)" : "rgba(40,40,60,0.5)" }}
              onClick={() => {
                const v = !DBG_SILLAS.showBigMeshes;
                DBG_SILLAS.showBigMeshes = v;
                setBigMeshList([]);
                setMeshHidden({});
                setSillas(s => ({ ...s, showBigMeshes: v }));
              }}>{sillas.showBigMeshes ? "ON" : "off"}</button>
          </div>
          {sillas.showBigMeshes && bigMeshList.map((e, i) => (
            <div key={i} style={{ ...ROW, flexDirection: "column", alignItems: "flex-start", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                <span style={{ fontSize: 10, color: meshHidden[i] ? "#888" : "#ffcc88", fontFamily: "monospace" }}>{e.name}</span>
                <button style={{ ...INPUT, width: 40, fontSize: 9, cursor: "pointer",
                  background: meshHidden[i] ? "rgba(120,30,30,0.7)" : "rgba(30,80,30,0.7)" }}
                  onClick={() => {
                    e.obj.visible = meshHidden[i] ? true : false;
                    setMeshHidden(h => ({ ...h, [i]: !h[i] }));
                  }}>{meshHidden[i] ? "show" : "hide"}</button>
              </div>
              <span style={{ fontSize: 9, color: "#aaa", fontFamily: "monospace" }}>
                {e.geoType} {e.sX.toFixed(0)}×{e.sY.toFixed(0)}×{e.sZ.toFixed(0)}m
                @ ({e.pX.toFixed(1)},{e.pY.toFixed(1)},{e.pZ.toFixed(1)})
                side={e.side} ro={e.renderOrder} dw={e.depthWrite ? "T" : "F"} transp={e.transparent ? "T" : "F"} {e.colorHex}
              </span>
            </div>
          ))}
          {sillas.showBigMeshes && bigMeshList.length === 0 && (
            <div style={{ ...ROW, color: "#888", fontSize: 10 }}>esperando escaneo...</div>
          )}

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
              onClick={() => activateVisualizerOnce()}
            >Activar visualizador</button>
            <button
              style={{ flex: 1, padding: "4px 0", cursor: "pointer", fontFamily: "monospace", fontSize: 11,
                background: "rgba(80,20,20,0.7)", color: "#ff9f9f", border: "1px solid rgba(180,80,80,0.4)", borderRadius: 3 }}
              onClick={() => { resetVizActivated(); window.dispatchEvent(new CustomEvent("alight:visualizer-deactivate")); }}
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

          <div style={DIVIDER} />
          <span style={LABEL}>Haces N3 R2 V1 <span style={NOTE}>(live salvo origen/radio del cono: reload)</span></span>
          <NumField label="hazDistFactor" value={sillas.hazDistFactor} step={0.05} min={0.5} max={3} note="V1: base 12m × factor → hazRadiusM"
            onChange={v => { DBG_SILLAS.hazDistFactor = v; DBG_SILLAS.hazRadiusM = 12 * v; setSillas(s => ({ ...s, hazDistFactor: v, hazRadiusM: 12 * v })); }} />
          <NumField label="hazRadiusM" value={sillas.hazRadiusM} step={0.5} min={4} max={30} note="live"
            onChange={v => { DBG_SILLAS.hazRadiusM = v; setSillas(s => ({ ...s, hazRadiusM: v })); }} />
          <NumField label="hazZoneRadiusM" value={sillas.hazZoneRadiusM} step={0.1} min={0.1} max={5} note="live"
            onChange={v => { DBG_SILLAS.hazZoneRadiusM = v; setSillas(s => ({ ...s, hazZoneRadiusM: v })); }} />
          <NumField label="hazOriginHM" value={sillas.hazOriginHM} step={0.1} min={1} max={6} note="reload"
            onChange={v => { DBG_SILLAS.hazOriginHM = v; setSillas(s => ({ ...s, hazOriginHM: v })); }} />
          <NumField label="hazConeFloorRM" value={sillas.hazConeFloorRM} step={0.05} min={0.2} max={3} note="reload"
            onChange={v => { DBG_SILLAS.hazConeFloorRM = v; setSillas(s => ({ ...s, hazConeFloorRM: v })); }} />
          <NumField label="hazSpotIntensity" value={sillas.hazSpotIntensity} step={5} min={0} max={200} note="live (× globalLightScale)"
            onChange={v => { DBG_SILLAS.hazSpotIntensity = v; setSillas(s => ({ ...s, hazSpotIntensity: v })); }} />
          <NumField label="globalLightScale" value={sillas.globalLightScale} step={0.05} min={0} max={2} note="live — all SILLAS lights"
            onChange={v => { DBG_SILLAS.globalLightScale = v; setSillas(s => ({ ...s, globalLightScale: v })); }} />
          <NumField label="hazConeOpacity" value={sillas.hazConeOpacity} step={0.01} min={0} max={1} note="live"
            onChange={v => { DBG_SILLAS.hazConeOpacity = v; setSillas(s => ({ ...s, hazConeOpacity: v })); }} />
          <ColorField label="hazColor0 (S0)" value={sillas.hazColor0}
            onChange={v => { DBG_SILLAS.hazColor0 = v; setSillas(s => ({ ...s, hazColor0: v })); }} />
          <ColorField label="hazColor1 (S1)" value={sillas.hazColor1}
            onChange={v => { DBG_SILLAS.hazColor1 = v; setSillas(s => ({ ...s, hazColor1: v })); }} />
          <ColorField label="hazColor2 (S2)" value={sillas.hazColor2}
            onChange={v => { DBG_SILLAS.hazColor2 = v; setSillas(s => ({ ...s, hazColor2: v })); }} />
          <ColorField label="hazColor3 (S3)" value={sillas.hazColor3}
            onChange={v => { DBG_SILLAS.hazColor3 = v; setSillas(s => ({ ...s, hazColor3: v })); }} />
          <NumField label="hazToggleCooldownMs" value={sillas.hazToggleCooldownMs} step={50} min={0} max={5000} note="R3-live"
            onChange={v => { DBG_SILLAS.hazToggleCooldownMs = v; setSillas(s => ({ ...s, hazToggleCooldownMs: v })); }} />
          <NumField label="hazOnBoost" value={sillas.hazOnBoost} step={0.05} min={1} max={3} note="R3-live (cono + símbolo)"
            onChange={v => { DBG_SILLAS.hazOnBoost = v; setSillas(s => ({ ...s, hazOnBoost: v })); }} />
          <span style={{ ...LABEL, marginTop: 4 }}>Band on/off <span style={NOTE}>(R3 — toggle manual)</span></span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
            {[0, 1, 2, 3].map(i => (
              <button
                key={i}
                style={{ ...INPUT, width: 44, textAlign: "center", cursor: "pointer",
                  background: bandOnArr[i] ? "rgba(0,120,60,0.6)" : "rgba(40,40,60,0.5)" }}
                onClick={() => setHazBandOn(i, !bandOnArr[i])}
              >S{i} {bandOnArr[i] ? "ON" : "off"}</button>
            ))}
          </div>
          <button
            style={{ width: "100%", marginBottom: 6, padding: "4px 0", cursor: "pointer",
              fontFamily: "monospace", fontSize: 11,
              background: "rgba(80,20,20,0.7)", color: "#ff9f9f",
              border: "1px solid rgba(180,80,80,0.4)", borderRadius: 3 }}
            onClick={() => { [0,1,2,3].forEach(i => setHazBandOn(i, false)); }}
          >Apagar todas</button>

          <div style={DIVIDER} />
          <span style={LABEL}>Sol N3 <span style={NOTE}>(live)</span></span>
          <NumField label="sunIntensity" value={sillas.sunIntensity} step={0.05} min={0} max={3} note="live"
            onChange={v => { DBG_SILLAS.sunIntensity = v; setSillas(s => ({ ...s, sunIntensity: v })); }} />
          <NumField label="sunAngularDeg" value={sillas.sunAngularDeg} step={0.5} min={0.5} max={20} note="live"
            onChange={v => { DBG_SILLAS.sunAngularDeg = v; setSillas(s => ({ ...s, sunAngularDeg: v })); }} />
          <div style={ROW}>
            <span>sunDriftEnabled <span style={NOTE}>debug drift</span></span>
            <button style={INPUT} onClick={() => {
              const v = !sillas.sunDriftEnabled;
              DBG_SILLAS.sunDriftEnabled = v;
              setSillas(s => ({ ...s, sunDriftEnabled: v }));
            }}>{sillas.sunDriftEnabled ? "ON" : "off"}</button>
          </div>

          <div style={DIVIDER} />
          <span style={LABEL}>Símbolos N3 <span style={NOTE}>(live)</span></span>
          <NumField label="symbolRadiusM" value={sillas.symbolRadiusM} step={0.1} min={0.1} max={5} note="live"
            onChange={v => { DBG_SILLAS.symbolRadiusM = v; setSillas(s => ({ ...s, symbolRadiusM: v })); }} />
          <NumField label="symbolPeriodS" value={sillas.symbolPeriodS} step={0.1} min={0.5} max={10} note="live"
            onChange={v => { DBG_SILLAS.symbolPeriodS = v; setSillas(s => ({ ...s, symbolPeriodS: v })); }} />
          <NumField label="symbolLineWidthM" value={sillas.symbolLineWidthM} step={0.005} min={0.005} max={0.3} note="live"
            onChange={v => { DBG_SILLAS.symbolLineWidthM = v; setSillas(s => ({ ...s, symbolLineWidthM: v })); }} />

          <div style={DIVIDER} />
          <span style={LABEL}>Audio bandas N4 <span style={NOTE}>(live)</span></span>
          <NumField label="gateAttackMs" value={sillas.gateAttackMs} step={10} min={10} max={2000} note="live"
            onChange={v => { DBG_SILLAS.gateAttackMs = v; setSillas(s => ({ ...s, gateAttackMs: v })); }} />
          <NumField label="gateReleaseMs" value={sillas.gateReleaseMs} step={10} min={10} max={3000} note="live"
            onChange={v => { DBG_SILLAS.gateReleaseMs = v; setSillas(s => ({ ...s, gateReleaseMs: v })); }} />
          <div style={ROW}>
            <span>Asignación <span style={NOTE}>(s→banda)</span></span>
            <span style={{ ...INPUT, padding:"2px 4px", fontSize:9, lineHeight:"1.6" }}>
              {bandRev >= 0 && BAND_STATE.assignment.map((b, i) => `S${i}→B${b}`).join(" ")}
            </span>
          </div>
          <div style={ROW}>
            <button style={{ ...INPUT, cursor:"pointer", width:"auto", padding:"3px 8px" }}
              onClick={() => { reshuffleAssignment(); setBandRev(r => r + 1); }}>
              Resortear bandas
            </button>
          </div>
          <div style={ROW}>
            <span>showBandOverlay</span>
            <button style={INPUT} onClick={() => {
              const v = !sillas.showBandOverlay;
              DBG_SILLAS.showBandOverlay = v;
              setSillas(s => ({ ...s, showBandOverlay: v }));
            }}>{sillas.showBandOverlay ? "ON" : "off"}</button>
          </div>
          {sillas.showBandOverlay && <BandEnergyOverlay />}

          <div style={DIVIDER} />
          <span style={LABEL}>Monolitos N5 V1/V2/V3 <span style={NOTE}>(live; geometry: reload)</span></span>
          <NumField label="monolitoDistFactor" value={sillas.monolitoDistFactor}  step={0.05} min={0.5} max={3}   note="V1: base 3.0m × factor → monolithDistM"
            onChange={v => { DBG_SILLAS.monolitoDistFactor = v; DBG_SILLAS.monolithDistM = 3 * v; setSillas(s => ({ ...s, monolitoDistFactor: v, monolithDistM: 3 * v })); }} />
          <NumField label="monolithDistM"      value={sillas.monolithDistM}       step={0.1} min={0.5} max={10}   note="live"
            onChange={v => { DBG_SILLAS.monolithDistM      = v; setSillas(s => ({ ...s, monolithDistM:      v })); }} />
          <NumField label="monolithFadeMs"     value={sillas.monolithFadeMs}      step={50}  min={100} max={5000} note="live"
            onChange={v => { DBG_SILLAS.monolithFadeMs     = v; setSillas(s => ({ ...s, monolithFadeMs:     v })); }} />
          <NumField label="monolithProxStartM" value={sillas.monolithProxStartM}  step={0.1} min={0.5} max={10}   note="live"
            onChange={v => { DBG_SILLAS.monolithProxStartM = v; setSillas(s => ({ ...s, monolithProxStartM: v })); }} />
          <NumField label="monolithProxFullM"  value={sillas.monolithProxFullM}   step={0.05} min={0.1} max={3}   note="live"
            onChange={v => { DBG_SILLAS.monolithProxFullM  = v; setSillas(s => ({ ...s, monolithProxFullM:  v })); }} />
          <NumField label="noiseGain"          value={sillas.noiseGain}           step={0.05} min={0}  max={1}    note="live"
            onChange={v => { DBG_SILLAS.noiseGain          = v; setSillas(s => ({ ...s, noiseGain:          v })); }} />
          <NumField label="staticMixMax"       value={sillas.staticMixMax}        step={0.05} min={0}  max={1}    note="live"
            onChange={v => { DBG_SILLAS.staticMixMax       = v; setSillas(s => ({ ...s, staticMixMax:       v })); }} />
          <N5ProximityOverlay />
          <div style={ROW}>
            <span>watcherEyeEnabled</span>
            <button style={INPUT} onClick={() => {
              const v = !sillas.watcherEyeEnabled;
              DBG_SILLAS.watcherEyeEnabled = v;
              setSillas(s => ({ ...s, watcherEyeEnabled: v }));
            }}>{sillas.watcherEyeEnabled ? "ON" : "off"}</button>
          </div>
          {/* S1: monolith visibility controls */}
          <div style={ROW}>
            <span>monolithForceShow</span>
            <button style={INPUT} onClick={() => {
              const v = !sillas.monolithForceShow;
              DBG_SILLAS.monolithForceShow = v;
              setSillas(s => ({ ...s, monolithForceShow: v }));
            }}>{sillas.monolithForceShow ? "ON" : "off"}</button>
          </div>
          <NumField label="monolithLightIntensity" value={sillas.monolithLightIntensity} step={10} min={0} max={600} note="live"
            onChange={v => { DBG_SILLAS.monolithLightIntensity = v; setSillas(s => ({ ...s, monolithLightIntensity: v })); }} />
          <NumField label="monolithRimIntensity"   value={sillas.monolithRimIntensity}   step={0.05} min={0} max={2} note="live"
            onChange={v => { DBG_SILLAS.monolithRimIntensity   = v; setSillas(s => ({ ...s, monolithRimIntensity:   v })); }} />
          <NumField label="monolithRimPow"         value={sillas.monolithRimPow}         step={0.5}  min={1} max={10} note="live"
            onChange={v => { DBG_SILLAS.monolithRimPow         = v; setSillas(s => ({ ...s, monolithRimPow:         v })); }} />
          <NumField label="monolithGlowOpacity"    value={sillas.monolithGlowOpacity}    step={0.01} min={0} max={0.5} note="live"
            onChange={v => { DBG_SILLAS.monolithGlowOpacity    = v; setSillas(s => ({ ...s, monolithGlowOpacity:    v })); }} />
          {/* V2: obsidian material */}
          <NumField label="monolithEnvIntensity"   value={sillas.monolithEnvIntensity}   step={0.1}  min={0} max={5}   note="V2 PMREM intensity"
            onChange={v => { DBG_SILLAS.monolithEnvIntensity   = v; setSillas(s => ({ ...s, monolithEnvIntensity:   v })); }} />
          <NumField label="monolithWarmLightI"     value={sillas.monolithWarmLightI}     step={5}    min={0} max={300} note="V2 warm point light"
            onChange={v => { DBG_SILLAS.monolithWarmLightI     = v; setSillas(s => ({ ...s, monolithWarmLightI:     v })); }} />
          <NumField label="monolithColdLightI"     value={sillas.monolithColdLightI}     step={5}    min={0} max={150} note="V2 cold point light"
            onChange={v => { DBG_SILLAS.monolithColdLightI     = v; setSillas(s => ({ ...s, monolithColdLightI:     v })); }} />
          <NumField label="monolithVeinBright"     value={sillas.monolithVeinBright}     step={0.05} min={0} max={2}   note="V2 golden veins"
            onChange={v => { DBG_SILLAS.monolithVeinBright     = v; setSillas(s => ({ ...s, monolithVeinBright:     v })); }} />
          <NumField label="monolithRimV2Intensity" value={sillas.monolithRimV2Intensity} step={0.05} min={0} max={3}   note="V2 purple-brown rim"
            onChange={v => { DBG_SILLAS.monolithRimV2Intensity = v; setSillas(s => ({ ...s, monolithRimV2Intensity: v })); }} />
          <NumField label="monolithDesaturation"   value={sillas.monolithDesaturation}   step={0.05} min={0} max={1}   note="V2 light desaturation"
            onChange={v => { DBG_SILLAS.monolithDesaturation   = v; setSillas(s => ({ ...s, monolithDesaturation:   v })); }} />
          {/* V3: twisted obelisk */}
          <NumField label="monolithTwistDeg"    value={sillas.monolithTwistDeg}    step={5}    min={0}   max={180} note="V3 reload"
            onChange={v => { DBG_SILLAS.monolithTwistDeg    = v; setSillas(s => ({ ...s, monolithTwistDeg:    v })); }} />
          <NumField label="monolithTwistInicio" value={sillas.monolithTwistInicio} step={0.05} min={0}   max={1}   note="V3 reload"
            onChange={v => { DBG_SILLAS.monolithTwistInicio = v; setSillas(s => ({ ...s, monolithTwistInicio: v })); }} />
          <NumField label="monolithTaper"       value={sillas.monolithTaper}       step={0.01} min={0.5} max={1}   note="V3 reload"
            onChange={v => { DBG_SILLAS.monolithTaper       = v; setSillas(s => ({ ...s, monolithTaper:       v })); }} />
          <NumField label="monolithTopTilt"     value={sillas.monolithTopTilt}     step={0.01} min={0}   max={0.5} note="V3 reload"
            onChange={v => { DBG_SILLAS.monolithTopTilt     = v; setSillas(s => ({ ...s, monolithTopTilt:     v })); }} />
          <div style={ROW}>
            <span>monolithLucesPropias <span style={NOTE}>V3 off=bloom fix</span></span>
            <button style={INPUT} onClick={() => {
              const v = !sillas.monolithLucesPropias;
              DBG_SILLAS.monolithLucesPropias = v;
              setSillas(s => ({ ...s, monolithLucesPropias: v }));
            }}>{sillas.monolithLucesPropias ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>monolithUseConchoidal <span style={NOTE}>V3 flag → V2 geom</span></span>
            <button style={INPUT} onClick={() => {
              const v = !sillas.monolithUseConchoidal;
              DBG_SILLAS.monolithUseConchoidal = v;
              setSillas(s => ({ ...s, monolithUseConchoidal: v }));
            }}>{sillas.monolithUseConchoidal ? "ON" : "off"}</button>
          </div>

          <div style={DIVIDER} />
          <span style={LABEL}>Telón N6 <span style={NOTE}>(live excepto distancia/tamaño/gather)</span></span>
          <NumField label="curtainWind"    value={sillas.curtainWind}    step={0.05} min={0}    max={5}     note="live"
            onChange={v => { DBG_SILLAS.curtainWind    = v; setSillas(s => ({ ...s, curtainWind:    v })); }} />
          <NumField label="curtainGravity" value={sillas.curtainGravity} step={0.1}  min={-20}  max={0}     note="live"
            onChange={v => { DBG_SILLAS.curtainGravity = v; setSillas(s => ({ ...s, curtainGravity: v })); }} />
          <NumField label="curtainDamping" value={sillas.curtainDamping} step={0.001} min={0.9} max={1}     note="live"
            onChange={v => { DBG_SILLAS.curtainDamping = v; setSillas(s => ({ ...s, curtainDamping: v })); }} />
          <NumField label="curtainLightIntensity" value={sillas.curtainLightIntensity} step={100} min={0} max={20000} note="live"
            onChange={v => { DBG_SILLAS.curtainLightIntensity = v; setSillas(s => ({ ...s, curtainLightIntensity: v })); }} />
          <ColorField label="curtainLightColor" value={sillas.curtainLightColor}
            onChange={v => { DBG_SILLAS.curtainLightColor = v; setSillas(s => ({ ...s, curtainLightColor: v })); }} />
          <div style={ROW}>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer" }}
              onClick={() => window.dispatchEvent(new CustomEvent("alight:debug-skip-curtain"))}>
              Saltar telón
            </button>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer" }}
              onClick={() => window.dispatchEvent(new CustomEvent("alight:debug-reset-curtain"))}>
              Reaparecer telón
            </button>
          </div>

          <div style={DIVIDER} />
          <span style={LABEL}>Paneles SILLAS P1 <span style={NOTE}>(live)</span></span>
          <div style={ROW}>
            <span>PANELES_AUTO <span style={NOTE}>off = siempre visibles</span></span>
            <button style={INPUT} onClick={() => {
              const v = !paneles.PANELES_AUTO;
              DBG_PANELES.PANELES_AUTO = v;
              setPaneles(p => ({ ...p, PANELES_AUTO: v }));
            }}>{paneles.PANELES_AUTO ? "ON" : "off"}</button>
          </div>
          <NumField label="PANELES_FADE_IN_MS" value={paneles.PANELES_FADE_IN_MS} step={50} min={0} max={5000} note="live"
            onChange={v => { DBG_PANELES.PANELES_FADE_IN_MS = v; setPaneles(p => ({ ...p, PANELES_FADE_IN_MS: v })); }} />
          <NumField label="PANELES_FADE_OUT_MS" value={paneles.PANELES_FADE_OUT_MS} step={50} min={0} max={5000} note="live"
            onChange={v => { DBG_PANELES.PANELES_FADE_OUT_MS = v; setPaneles(p => ({ ...p, PANELES_FADE_OUT_MS: v })); }} />
          {/* Z1: marco y placeholder de los paneles de proyecto */}
          <NumField label="PANEL_MARGEN" value={paneles.PANEL_MARGEN} step={0.005} min={0} max={0.15} note="Z1 × ancho"
            onChange={v => { DBG_PANELES.PANEL_MARGEN = v; setPaneles(p => ({ ...p, PANEL_MARGEN: v })); }} />
          <NumField label="PANEL_REGLA" value={paneles.PANEL_REGLA} step={0.005} min={0} max={0.2} note="Z1 × ancho"
            onChange={v => { DBG_PANELES.PANEL_REGLA = v; setPaneles(p => ({ ...p, PANEL_REGLA: v })); }} />
          <NumField label="PANEL_OSCURO" value={paneles.PANEL_OSCURO} step={0.005} min={0} max={1} note="Z1 fuera de haz"
            onChange={v => { DBG_PANELES.PANEL_OSCURO = v; setPaneles(p => ({ ...p, PANEL_OSCURO: v })); }} />
          {/* Z6: reposo a oscuras, iluminado por haces y linterna */}
          <div style={ROW}>
            <span>PANEL_DISENO_VIEJO <span style={NOTE}>Z6 marco beige + regla</span></span>
            <button style={INPUT} onClick={() => {
              const v = !paneles.PANEL_DISENO_VIEJO;
              DBG_PANELES.PANEL_DISENO_VIEJO = v;
              setPaneles(p => ({ ...p, PANEL_DISENO_VIEJO: v }));
            }}>{paneles.PANEL_DISENO_VIEJO ? "ON" : "off"}</button>
          </div>
          <NumField label="PANEL_BRILLO_BASE" value={paneles.PANEL_BRILLO_BASE} step={0.001} min={0} max={0.2} note="Z6 ambiente"
            onChange={v => { DBG_PANELES.PANEL_BRILLO_BASE = v; setPaneles(p => ({ ...p, PANEL_BRILLO_BASE: v })); }} />
          <NumField label="PANEL_HAZ_INTENSIDAD" value={paneles.PANEL_HAZ_INTENSIDAD} step={0.1} min={0} max={6} note="Z6 haces"
            onChange={v => { DBG_PANELES.PANEL_HAZ_INTENSIDAD = v; setPaneles(p => ({ ...p, PANEL_HAZ_INTENSIDAD: v })); }} />
          <NumField label="PANEL_HAZ_COS" value={paneles.PANEL_HAZ_COS} step={0.001} min={0.9} max={0.9999} note="Z6 cono"
            onChange={v => { DBG_PANELES.PANEL_HAZ_COS = v; setPaneles(p => ({ ...p, PANEL_HAZ_COS: v })); }} />
          <NumField label="PANEL_HAZ_SUAVE" value={paneles.PANEL_HAZ_SUAVE} step={0.001} min={0.0005} max={0.05} note="Z6 borde cono"
            onChange={v => { DBG_PANELES.PANEL_HAZ_SUAVE = v; setPaneles(p => ({ ...p, PANEL_HAZ_SUAVE: v })); }} />
          <NumField label="PANEL_BORDE" value={paneles.PANEL_BORDE} step={0.001} min={0} max={0.05} note="Z6 borde carbón"
            onChange={v => { DBG_PANELES.PANEL_BORDE = v; setPaneles(p => ({ ...p, PANEL_BORDE: v })); }} />
          <NumField label="PANEL_BORDE_INT" value={paneles.PANEL_BORDE_INT} step={0.05} min={0} max={2} note="Z6"
            onChange={v => { DBG_PANELES.PANEL_BORDE_INT = v; setPaneles(p => ({ ...p, PANEL_BORDE_INT: v })); }} />
          <div style={ROW}>
            <span>PANEL_PLACEHOLDER <span style={NOTE}>Z1 sin foto / error</span></span>
            <button style={INPUT} onClick={() => {
              const v = !paneles.PANEL_PLACEHOLDER;
              DBG_PANELES.PANEL_PLACEHOLDER = v;
              setPaneles(p => ({ ...p, PANEL_PLACEHOLDER: v }));
            }}>{paneles.PANEL_PLACEHOLDER ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>PANEL_PLACEHOLDER_FORZAR <span style={NOTE}>Z1 todos</span></span>
            <button style={INPUT} onClick={() => {
              const v = !paneles.PANEL_PLACEHOLDER_FORZAR;
              DBG_PANELES.PANEL_PLACEHOLDER_FORZAR = v;
              setPaneles(p => ({ ...p, PANEL_PLACEHOLDER_FORZAR: v }));
            }}>{paneles.PANEL_PLACEHOLDER_FORZAR ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>estado <span style={NOTE}>{panelesFase}</span></span>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer" }}
              onClick={() => {
                const v = !PANELES_SILLAS.forzado;
                PANELES_SILLAS.forzado = v;
                setPaneles(p => ({ ...p, forzado: v }));
              }}>
              {paneles.forzado ? "Soltar paneles SILLAS" : "Forzar paneles SILLAS"}
            </button>
          </div>

          <div style={DIVIDER} />
          <span style={LABEL}>Órbitas Z7 — paneles SILLAS <span style={NOTE}>(aplicar con Regenerar)</span></span>
          <div style={ROW}>
            <span>ORB_ORDENADAS <span style={NOTE}>off = anillos G5</span></span>
            <button style={INPUT} onClick={() => {
              const v = !orb.ORB_ORDENADAS;
              DBG_ORBITAS.ORB_ORDENADAS = v;
              setOrb(o => ({ ...o, ORB_ORDENADAS: v }));
            }}>{orb.ORB_ORDENADAS ? "ON" : "off"}</button>
          </div>
          <NumField label="PANELES_MAX" value={orb.PANELES_MAX} step={1} min={1} max={120} note="más recientes"
            onChange={v => { DBG_ORBITAS.PANELES_MAX = v; setOrb(o => ({ ...o, PANELES_MAX: v })); }} />
          <NumField label="ORB_ANILLOS" value={orb.ORB_ANILLOS} step={1} min={1} max={8} note="anillos"
            onChange={v => { DBG_ORBITAS.ORB_ANILLOS = v; setOrb(o => ({ ...o, ORB_ANILLOS: v })); }} />
          <NumField label="ORB_RADIO_MIN_M" value={orb.ORB_RADIO_MIN_M} step={0.5} min={8} max={27} note="m"
            onChange={v => { DBG_ORBITAS.ORB_RADIO_MIN_M = v; setOrb(o => ({ ...o, ORB_RADIO_MIN_M: v })); }} />
          <NumField label="ORB_RADIO_MAX_M" value={orb.ORB_RADIO_MAX_M} step={0.5} min={8} max={27} note="m"
            onChange={v => { DBG_ORBITAS.ORB_RADIO_MAX_M = v; setOrb(o => ({ ...o, ORB_RADIO_MAX_M: v })); }} />
          <NumField label="ORB_ALTURA_ALTERNA" value={orb.ORB_ALTURA_ALTERNA} step={0.05} min={0} max={1} note="abajo/arriba"
            onChange={v => { DBG_ORBITAS.ORB_ALTURA_ALTERNA = v; setOrb(o => ({ ...o, ORB_ALTURA_ALTERNA: v })); }} />
          <NumField label="ORB_VAR_M" value={orb.ORB_VAR_M} step={0.05} min={0} max={2} note="± m"
            onChange={v => { DBG_ORBITAS.ORB_VAR_M = v; setOrb(o => ({ ...o, ORB_VAR_M: v })); }} />
          <NumField label="ORB_VAR_FREQ" value={orb.ORB_VAR_FREQ} step={0.5} min={0} max={8} note="por vuelta"
            onChange={v => { DBG_ORBITAS.ORB_VAR_FREQ = v; setOrb(o => ({ ...o, ORB_VAR_FREQ: v })); }} />
          <NumField label="ORB_VEL_BASE" value={orb.ORB_VEL_BASE} step={1e-05} min={0} max={0.002} note="rad/frame"
            onChange={v => { DBG_ORBITAS.ORB_VEL_BASE = v; setOrb(o => ({ ...o, ORB_VEL_BASE: v })); }} />
          <NumField label="ORB_VEL_PASO" value={orb.ORB_VEL_PASO} step={0.05} min={0} max={3} note="× por anillo"
            onChange={v => { DBG_ORBITAS.ORB_VEL_PASO = v; setOrb(o => ({ ...o, ORB_VEL_PASO: v })); }} />
          <NumField label="ORB_SEP_MIN" value={orb.ORB_SEP_MIN} step={0.05} min={1} max={3} note="× ancho angular"
            onChange={v => { DBG_ORBITAS.ORB_SEP_MIN = v; setOrb(o => ({ ...o, ORB_SEP_MIN: v })); }} />
          <NumField label="ORB_LUZ_MIN" value={orb.ORB_LUZ_MIN} step={0.05} min={0} max={1} note="banda del haz"
            onChange={v => { DBG_ORBITAS.ORB_LUZ_MIN = v; setOrb(o => ({ ...o, ORB_LUZ_MIN: v })); }} />
          <NumField label="PANEL_ESCALA" value={orb.PANEL_ESCALA} step={0.05} min={0.5} max={3} note="× 3,6×2,4 m"
            onChange={v => { DBG_ORBITAS.PANEL_ESCALA = v; setOrb(o => ({ ...o, PANEL_ESCALA: v })); }} />
          <div style={ROW}>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer" }}
              onClick={() => window.dispatchEvent(new CustomEvent("alight:debug-regenerar-orbitas"))}>
              Regenerar órbitas
            </button>
          </div>
          <pre style={{ ...NOTE, whiteSpace: "pre-wrap", margin: "4px 0" }}>{orbInfo}</pre>

          <div style={DIVIDER} />
          <span style={LABEL}>Linterna Z2 — paneles SILLAS <span style={NOTE}>(live)</span></span>
          <div style={ROW}>
            <span>LINTERNA_ACTIVA</span>
            <button style={INPUT} onClick={() => {
              const v = !linterna.LINTERNA_ACTIVA;
              DBG_LINTERNA.LINTERNA_ACTIVA = v;
              setLinterna(l => ({ ...l, LINTERNA_ACTIVA: v }));
            }}>{linterna.LINTERNA_ACTIVA ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>PANEL_SELECCION_REQUIERE_LIBERACION <span style={NOTE}>Z13 off = desde que se ven</span></span>
            <button style={INPUT} onClick={() => {
              const v = !linterna.PANEL_SELECCION_REQUIERE_LIBERACION;
              DBG_LINTERNA.PANEL_SELECCION_REQUIERE_LIBERACION = v;
              setLinterna(l => ({ ...l, PANEL_SELECCION_REQUIERE_LIBERACION: v }));
            }}>{linterna.PANEL_SELECCION_REQUIERE_LIBERACION ? "ON" : "off"}</button>
          </div>
          <NumField label="CONO_DEG" value={linterna.CONO_DEG} step={0.5} min={1} max={45} note="° luz"
            onChange={v => { DBG_LINTERNA.CONO_DEG = v; setLinterna(l => ({ ...l, CONO_DEG: v })); }} />
          <NumField label="ENTRA_DEG" value={linterna.ENTRA_DEG} step={0.5} min={0.5} max={30} note="° selección"
            onChange={v => { DBG_LINTERNA.ENTRA_DEG = v; setLinterna(l => ({ ...l, ENTRA_DEG: v })); }} />
          <NumField label="SALE_DEG" value={linterna.SALE_DEG} step={0.5} min={0.5} max={40} note="° suelta"
            onChange={v => { DBG_LINTERNA.SALE_DEG = v; setLinterna(l => ({ ...l, SALE_DEG: v })); }} />
          <NumField label="ABRIR_MS" value={linterna.ABRIR_MS} step={100} min={200} max={10000} note="→ abierto"
            onChange={v => { DBG_LINTERNA.ABRIR_MS = v; setLinterna(l => ({ ...l, ABRIR_MS: v })); }} />
          <NumField label="LUZ_INTENSIDAD" value={linterna.LUZ_INTENSIDAD} step={0.05} min={0} max={2} note="uLit"
            onChange={v => { DBG_LINTERNA.LUZ_INTENSIDAD = v; setLinterna(l => ({ ...l, LUZ_INTENSIDAD: v })); }} />
          <NumField label="LUZ_FADE_S" value={linterna.LUZ_FADE_S} step={0.5} min={0.5} max={40} note="1/s"
            onChange={v => { DBG_LINTERNA.LUZ_FADE_S = v; setLinterna(l => ({ ...l, LUZ_FADE_S: v })); }} />
          <NumField label="SEL_FADE_S" value={linterna.SEL_FADE_S} step={0.5} min={0.5} max={40} note="1/s marco"
            onChange={v => { DBG_LINTERNA.SEL_FADE_S = v; setLinterna(l => ({ ...l, SEL_FADE_S: v })); }} />
          <NumField label="ORBITA_VEL_MULT" value={linterna.ORBITA_VEL_MULT} step={0.1} min={0} max={5} note="× órbita"
            onChange={v => { DBG_LINTERNA.ORBITA_VEL_MULT = v; setLinterna(l => ({ ...l, ORBITA_VEL_MULT: v })); }} />
          <NumField label="MARCO_PAD_M" value={linterna.MARCO_PAD_M} step={0.05} min={0} max={1.5} note="m esquinas"
            onChange={v => { DBG_LINTERNA.MARCO_PAD_M = v; setLinterna(l => ({ ...l, MARCO_PAD_M: v })); }} />
          <div style={ROW}>
            <span>estado <span style={NOTE}>{linternaLive}</span></span>
          </div>

          <div style={DIVIDER} />
          <span style={LABEL}>Acercamiento Z8 <span style={NOTE}>(live)</span></span>
          <div style={ROW}>
            <span>ACERC_ACTIVO <span style={NOTE}>off = abre en órbita</span></span>
            <button style={INPUT} onClick={() => {
              const v = !acerc.ACERC_ACTIVO;
              DBG_ACERC.ACERC_ACTIVO = v;
              setAcerc(o => ({ ...o, ACERC_ACTIVO: v }));
            }}>{acerc.ACERC_ACTIVO ? "ON" : "off"}</button>
          </div>
          <NumField label="ACERC_PANTALLA" value={acerc.ACERC_PANTALLA} step={0.01} min={0.05} max={1} note="fracción ancho/alto"
            onChange={v => { DBG_ACERC.ACERC_PANTALLA = v; setAcerc(o => ({ ...o, ACERC_PANTALLA: v })); }} />
          <NumField label="ACERC_MS" value={acerc.ACERC_MS} step={50} min={100} max={5000} note="ms ida"
            onChange={v => { DBG_ACERC.ACERC_MS = v; setAcerc(o => ({ ...o, ACERC_MS: v })); }} />
          <NumField label="ACERC_VUELTA_MS" value={acerc.ACERC_VUELTA_MS} step={50} min={100} max={5000} note="ms vuelta"
            onChange={v => { DBG_ACERC.ACERC_VUELTA_MS = v; setAcerc(o => ({ ...o, ACERC_VUELTA_MS: v })); }} />
          <div style={ROW}>
            <span>ACERC_EASING <span style={NOTE}>sin rebote</span></span>
            <select style={{ ...INPUT, width: 90 }} value={acerc.ACERC_EASING} onChange={e => {
              const v = e.target.value as typeof DBG_ACERC.ACERC_EASING;
              DBG_ACERC.ACERC_EASING = v;
              setAcerc(o => ({ ...o, ACERC_EASING: v }));
            }}>
              <option value="seno">seno</option>
              <option value="suave">suave</option>
              <option value="cubica">cúbica</option>
            </select>
          </div>
          <div style={ROW}>
            <span>ACERC_ESPERA_CIERRE <span style={NOTE}>vuelve tras cerrar Z4</span></span>
            <button style={INPUT} onClick={() => {
              const v = !acerc.ACERC_ESPERA_CIERRE;
              DBG_ACERC.ACERC_ESPERA_CIERRE = v;
              setAcerc(o => ({ ...o, ACERC_ESPERA_CIERRE: v }));
            }}>{acerc.ACERC_ESPERA_CIERRE ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>SUB_AJUSTE_PANTALLA <span style={NOTE}>Z8 escala a pantalla</span></span>
            <button style={INPUT} onClick={() => {
              const v = !subp.SUB_AJUSTE_PANTALLA;
              DBG_SUBPANELES.SUB_AJUSTE_PANTALLA = v;
              setSubp(x => ({ ...x, SUB_AJUSTE_PANTALLA: v }));
            }}>{subp.SUB_AJUSTE_PANTALLA ? "ON" : "off"}</button>
          </div>
          <NumField label="SUB_MARGEN_PANTALLA" value={subp.SUB_MARGEN_PANTALLA} step={0.01} min={0} max={0.3} note="Z8 bordes"
            onChange={v => { DBG_SUBPANELES.SUB_MARGEN_PANTALLA = v; setSubp(x => ({ ...x, SUB_MARGEN_PANTALLA: v })); }} />
          <div style={ROW}>
            <span>SUB_AJUSTE_BLOQUE <span style={NOTE}>Z9 bloque centrado</span></span>
            <button style={INPUT} onClick={() => {
              const v = !subp.SUB_AJUSTE_BLOQUE;
              DBG_SUBPANELES.SUB_AJUSTE_BLOQUE = v;
              setSubp(x => ({ ...x, SUB_AJUSTE_BLOQUE: v }));
            }}>{subp.SUB_AJUSTE_BLOQUE ? "ON" : "off"}</button>
          </div>
          <NumField label="SUB_MARGEN_SEGURIDAD" value={subp.SUB_MARGEN_SEGURIDAD} step={0.01} min={0} max={0.3} note="Z9 por lado"
            onChange={v => { DBG_SUBPANELES.SUB_MARGEN_SEGURIDAD = v; setSubp(x => ({ ...x, SUB_MARGEN_SEGURIDAD: v })); }} />
          <NumField label="SUB_ESCALA_MIN" value={subp.SUB_ESCALA_MIN} step={0.05} min={0.1} max={1} note="Z9 legibilidad"
            onChange={v => { DBG_SUBPANELES.SUB_ESCALA_MIN = v; setSubp(x => ({ ...x, SUB_ESCALA_MIN: v })); }} />
          <NumField label="ACERC_AJUSTE_S" value={acerc.ACERC_AJUSTE_S} step={0.5} min={0.5} max={30} note="Z9 resize 1/s"
            onChange={v => { DBG_ACERC.ACERC_AJUSTE_S = v; setAcerc(o => ({ ...o, ACERC_AJUSTE_S: v })); }} />
          <NumField label="CIERRE_MARGEN" value={acerc.CIERRE_MARGEN} step={0.01} min={0} max={0.5} note="Z12 caja de cierre"
            onChange={v => { DBG_ACERC.CIERRE_MARGEN = v; setAcerc(o => ({ ...o, CIERRE_MARGEN: v })); }} />
          <NumField label="CIERRE_GRACIA_MS" value={acerc.CIERRE_GRACIA_MS} step={100} min={0} max={10000} note="Z12 desde abierto"
            onChange={v => { DBG_ACERC.CIERRE_GRACIA_MS = v; setAcerc(o => ({ ...o, CIERRE_GRACIA_MS: v })); }} />
          <NumField label="ESPERA_DATOS_MS" value={acerc.ESPERA_DATOS_MS} step={500} min={500} max={30000} note="Z12 tope sin datos"
            onChange={v => { DBG_ACERC.ESPERA_DATOS_MS = v; setAcerc(o => ({ ...o, ESPERA_DATOS_MS: v })); }} />
          <div style={ROW}>
            <span>DBG_LOG_PANEL <span style={NOTE}>Z12 log de transiciones en consola</span></span>
            <button style={INPUT} onClick={() => {
              const v = !logPanelOn;
              DBG_LOG_PANEL.LOG_ACTIVO = v;
              setLogPanelOn(v);
            }}>{logPanelOn ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>estado <span style={NOTE}>{acercLive}</span></span>
          </div>

          <div style={DIVIDER} />
          <span style={LABEL}>Prioridad Z10 — proyecto abierto sobre las órbitas <span style={NOTE}>(live)</span></span>
          <div style={ROW}>
            <span>PRIORIDAD_ACTIVA <span style={NOTE}>off = como Z9</span></span>
            <button style={INPUT} onClick={() => {
              const v = !prio.PRIORIDAD_ACTIVA;
              DBG_PRIORIDAD.PRIORIDAD_ACTIVA = v;
              setPrio(o => ({ ...o, PRIORIDAD_ACTIVA: v }));
            }}>{prio.PRIORIDAD_ACTIVA ? "ON" : "off"}</button>
          </div>
          <NumField label="ATENUAR_BRILLO" value={prio.ATENUAR_BRILLO} step={0.05} min={0} max={1} note="brillo de los demás"
            onChange={v => { DBG_PRIORIDAD.ATENUAR_BRILLO = v; setPrio(o => ({ ...o, ATENUAR_BRILLO: v })); }} />
          <NumField label="ATENUAR_MS" value={prio.ATENUAR_MS} step={50} min={0} max={5000} note="ms fundido"
            onChange={v => { DBG_PRIORIDAD.ATENUAR_MS = v; setPrio(o => ({ ...o, ATENUAR_MS: v })); }} />
          <div style={ROW}>
            <span>OCULTAR_SOLAPADOS <span style={NOTE}>esconde los que se cruzan</span></span>
            <button style={INPUT} onClick={() => {
              const v = !prio.OCULTAR_SOLAPADOS;
              DBG_PRIORIDAD.OCULTAR_SOLAPADOS = v;
              setPrio(o => ({ ...o, OCULTAR_SOLAPADOS: v }));
            }}>{prio.OCULTAR_SOLAPADOS ? "ON" : "off"}</button>
          </div>
          <NumField label="OCULTAR_MARGEN" value={prio.OCULTAR_MARGEN} step={0.01} min={0} max={0.5} note="zona extra"
            onChange={v => { DBG_PRIORIDAD.OCULTAR_MARGEN = v; setPrio(o => ({ ...o, OCULTAR_MARGEN: v })); }} />
          <NumField label="OCULTAR_PROF_M" value={prio.OCULTAR_PROF_M} step={0.5} min={0} max={30} note="m detrás del panel"
            onChange={v => { DBG_PRIORIDAD.OCULTAR_PROF_M = v; setPrio(o => ({ ...o, OCULTAR_PROF_M: v })); }} />
          <NumField label="RENDER_ORDER_BLOQUE" value={prio.RENDER_ORDER_BLOQUE} step={1} min={1} max={100} note="al montar"
            onChange={v => { DBG_PRIORIDAD.RENDER_ORDER_BLOQUE = v; setPrio(o => ({ ...o, RENDER_ORDER_BLOQUE: v })); }} />

          <div style={DIVIDER} />
          <span style={LABEL}>Subpaneles Z4 — HISTORIA / GALERÍA / FICHA <span style={NOTE}>(live)</span></span>
          <div style={ROW}>
            <span>SUB_ACTIVO <span style={NOTE}>al abrir</span></span>
            <button style={INPUT} onClick={() => {
              const v = !subp.SUB_ACTIVO;
              DBG_SUBPANELES.SUB_ACTIVO = v;
              setSubp(x => ({ ...x, SUB_ACTIVO: v }));
            }}>{subp.SUB_ACTIVO ? "ON" : "off"}</button>
          </div>
          <NumField label="SUB_M_POR_PX" value={subp.SUB_M_POR_PX} step={0.0005} min={0.004} max={0.04} note="tamaño"
            onChange={v => { DBG_SUBPANELES.SUB_M_POR_PX = v; setSubp(x => ({ ...x, SUB_M_POR_PX: v })); }} />
          <NumField label="SUB_GAP_LATERAL_M" value={subp.SUB_GAP_LATERAL_M} step={0.1} min={0} max={6} note="m lados"
            onChange={v => { DBG_SUBPANELES.SUB_GAP_LATERAL_M = v; setSubp(x => ({ ...x, SUB_GAP_LATERAL_M: v })); }} />
          <NumField label="SUB_GAP_ABAJO_M" value={subp.SUB_GAP_ABAJO_M} step={0.1} min={0} max={6} note="m abajo"
            onChange={v => { DBG_SUBPANELES.SUB_GAP_ABAJO_M = v; setSubp(x => ({ ...x, SUB_GAP_ABAJO_M: v })); }} />
          <NumField label="SUB_ANIM_MS" value={subp.SUB_ANIM_MS} step={50} min={50} max={3000} note="ms salida"
            onChange={v => { DBG_SUBPANELES.SUB_ANIM_MS = v; setSubp(x => ({ ...x, SUB_ANIM_MS: v })); }} />
          <NumField label="SUB_ADELANTE_M" value={subp.SUB_ADELANTE_M} step={0.05} min={0} max={3} note="m hacia cámara"
            onChange={v => { DBG_SUBPANELES.SUB_ADELANTE_M = v; setSubp(x => ({ ...x, SUB_ADELANTE_M: v })); }} />
          <NumField label="SUB_RETENER_PAD_M" value={subp.SUB_RETENER_PAD_M} step={0.05} min={0} max={6} note="Z5 m margen"
            onChange={v => { DBG_SUBPANELES.SUB_RETENER_PAD_M = v; setSubp(x => ({ ...x, SUB_RETENER_PAD_M: v })); }} />
          <div style={ROW}>
            <span>SUB_LINEAS <span style={NOTE}>guías</span></span>
            <button style={INPUT} onClick={() => {
              const v = !subp.SUB_LINEAS;
              DBG_SUBPANELES.SUB_LINEAS = v;
              setSubp(x => ({ ...x, SUB_LINEAS: v }));
            }}>{subp.SUB_LINEAS ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>SUB_PUNTERO <span style={NOTE}>aro</span></span>
            <button style={INPUT} onClick={() => {
              const v = !subp.SUB_PUNTERO;
              DBG_SUBPANELES.SUB_PUNTERO = v;
              setSubp(x => ({ ...x, SUB_PUNTERO: v }));
            }}>{subp.SUB_PUNTERO ? "ON" : "off"}</button>
          </div>
          <NumField label="PUNTERO_RADIO_M" value={subp.PUNTERO_RADIO_M} step={0.01} min={0.05} max={1} note="Z5 retícula"
            onChange={v => { DBG_SUBPANELES.PUNTERO_RADIO_M = v; setSubp(x => ({ ...x, PUNTERO_RADIO_M: v })); }} />
          <NumField label="PUNTERO_GRACIA_MS" value={subp.PUNTERO_GRACIA_MS} step={100} min={0} max={5000} note="Z5 antes de cerrar"
            onChange={v => { DBG_SUBPANELES.PUNTERO_GRACIA_MS = v; setSubp(x => ({ ...x, PUNTERO_GRACIA_MS: v })); }} />
          <NumField label="PUNTERO_HISTERESIS" value={subp.PUNTERO_HISTERESIS} step={0.01} min={0} max={0.5} note="Z11 salida"
            onChange={v => { DBG_SUBPANELES.PUNTERO_HISTERESIS = v; setSubp(x => ({ ...x, PUNTERO_HISTERESIS: v })); }} />
          <NumField label="PUNTERO_PULSO_MS" value={subp.PUNTERO_PULSO_MS} step={10} min={0} max={1000} note="Z11 pulso clic"
            onChange={v => { DBG_SUBPANELES.PUNTERO_PULSO_MS = v; setSubp(x => ({ ...x, PUNTERO_PULSO_MS: v })); }} />
          <NumField label="PUNTERO_COOLDOWN_MS" value={subp.PUNTERO_COOLDOWN_MS} step={10} min={0} max={2000} note="Z11 entre clics"
            onChange={v => { DBG_SUBPANELES.PUNTERO_COOLDOWN_MS = v; setSubp(x => ({ ...x, PUNTERO_COOLDOWN_MS: v })); }} />
          <NumField label="PUNTERO_ESCALA_HOVER" value={subp.PUNTERO_ESCALA_HOVER} step={0.05} min={0.5} max={3} note="Z11 × radio"
            onChange={v => { DBG_SUBPANELES.PUNTERO_ESCALA_HOVER = v; setSubp(x => ({ ...x, PUNTERO_ESCALA_HOVER: v })); }} />
          <NumField label="PUNTERO_ESCALA_CLIC" value={subp.PUNTERO_ESCALA_CLIC} step={0.05} min={0.2} max={3} note="Z11 × radio"
            onChange={v => { DBG_SUBPANELES.PUNTERO_ESCALA_CLIC = v; setSubp(x => ({ ...x, PUNTERO_ESCALA_CLIC: v })); }} />
          <NumField label="PUNTERO_SUAVIZADO_S" value={subp.PUNTERO_SUAVIZADO_S} step={1} min={1} max={60} note="Z11 1/s"
            onChange={v => { DBG_SUBPANELES.PUNTERO_SUAVIZADO_S = v; setSubp(x => ({ ...x, PUNTERO_SUAVIZADO_S: v })); }} />
          <div style={ROW}>
            <span>PANEL_BLOQUEA_MOVIMIENTO <span style={NOTE}>Z5 sin WASD</span></span>
            <button style={INPUT} onClick={() => {
              const v = !subp.PANEL_BLOQUEA_MOVIMIENTO;
              DBG_SUBPANELES.PANEL_BLOQUEA_MOVIMIENTO = v;
              setSubp(x => ({ ...x, PANEL_BLOQUEA_MOVIMIENTO: v }));
            }}>{subp.PANEL_BLOQUEA_MOVIMIENTO ? "ON" : "off"}</button>
          </div>
          <NumField label="HISTORIA_RENGLONES" value={subp.HISTORIA_RENGLONES} step={1} min={3} max={20} note="al abrir"
            onChange={v => { DBG_SUBPANELES.HISTORIA_RENGLONES = v; setSubp(x => ({ ...x, HISTORIA_RENGLONES: v })); }} />
          <NumField label="GALERIA_AMBAR" value={subp.GALERIA_AMBAR} step={0.05} min={0} max={1} note="monocromo"
            onChange={v => { DBG_SUBPANELES.GALERIA_AMBAR = v; setSubp(x => ({ ...x, GALERIA_AMBAR: v })); }} />
          <NumField label="GALERIA_SCAN" value={subp.GALERIA_SCAN} step={0.02} min={0} max={1} note="scanlines"
            onChange={v => { DBG_SUBPANELES.GALERIA_SCAN = v; setSubp(x => ({ ...x, GALERIA_SCAN: v })); }} />
          <NumField label="GALERIA_CURVA" value={subp.GALERIA_CURVA} step={0.01} min={0} max={0.4} note="curvatura"
            onChange={v => { DBG_SUBPANELES.GALERIA_CURVA = v; setSubp(x => ({ ...x, GALERIA_CURVA: v })); }} />

          <div style={DIVIDER} />
          <span style={LABEL}>Destello de cortina F1 <span style={NOTE}>(live)</span></span>
          <div style={ROW}>
            <span>FLASH_ACTIVO</span>
            <button style={INPUT} onClick={() => {
              const v = !flash.FLASH_ACTIVO;
              DBG_FLASH.FLASH_ACTIVO = v;
              setFlash(f => ({ ...f, FLASH_ACTIVO: v }));
            }}>{flash.FLASH_ACTIVO ? "ON" : "off"}</button>
          </div>
          <NumField label="FLASH_SUBIDA_MS" value={flash.FLASH_SUBIDA_MS} step={10} min={0} max={2000} note="live"
            onChange={v => { DBG_FLASH.FLASH_SUBIDA_MS = v; setFlash(f => ({ ...f, FLASH_SUBIDA_MS: v })); }} />
          <NumField label="FLASH_SOSTENIDO_MS" value={flash.FLASH_SOSTENIDO_MS} step={50} min={0} max={4000} note="mín."
            onChange={v => { DBG_FLASH.FLASH_SOSTENIDO_MS = v; setFlash(f => ({ ...f, FLASH_SOSTENIDO_MS: v })); }} />
          <NumField label="FLASH_BAJADA_MS" value={flash.FLASH_BAJADA_MS} step={10} min={0} max={5000} note="exponencial"
            onChange={v => { DBG_FLASH.FLASH_BAJADA_MS = v; setFlash(f => ({ ...f, FLASH_BAJADA_MS: v })); }} />
          <NumField label="FLASH_PICO" value={flash.FLASH_PICO} step={0.05} min={0} max={1} note="opacidad"
            onChange={v => { DBG_FLASH.FLASH_PICO = v; setFlash(f => ({ ...f, FLASH_PICO: v })); }} />
          <NumField label="FLASH_BLOOM_MULT" value={flash.FLASH_BLOOM_MULT} step={0.1} min={1} max={12} note="× bloom"
            onChange={v => { DBG_FLASH.FLASH_BLOOM_MULT = v; setFlash(f => ({ ...f, FLASH_BLOOM_MULT: v })); }} />
          <NumField label="FLASH_EXPOSICION_MULT" value={flash.FLASH_EXPOSICION_MULT} step={0.1} min={1} max={12} note="× exposición"
            onChange={v => { DBG_FLASH.FLASH_EXPOSICION_MULT = v; setFlash(f => ({ ...f, FLASH_EXPOSICION_MULT: v })); }} />
          <NumField label="FLASH_LUZ_FADE_MS" value={flash.FLASH_LUZ_FADE_MS} step={50} min={0} max={4000} note="luz telón → 0"
            onChange={v => { DBG_FLASH.FLASH_LUZ_FADE_MS = v; setFlash(f => ({ ...f, FLASH_LUZ_FADE_MS: v })); }} />
          <NumField label="FLASH_TOPE_MS" value={flash.FLASH_TOPE_MS} step={100} min={500} max={10000} note="tope sostenido"
            onChange={v => { DBG_FLASH.FLASH_TOPE_MS = v; setFlash(f => ({ ...f, FLASH_TOPE_MS: v })); }} />
          <NumField label="FLASH_RM_PICO_MULT" value={flash.FLASH_RM_PICO_MULT} step={0.05} min={0} max={1} note="reduced-motion"
            onChange={v => { DBG_FLASH.FLASH_RM_PICO_MULT = v; setFlash(f => ({ ...f, FLASH_RM_PICO_MULT: v })); }} />
          <NumField label="FLASH_RM_SUBIDA_MS" value={flash.FLASH_RM_SUBIDA_MS} step={50} min={0} max={2000} note="reduced-motion"
            onChange={v => { DBG_FLASH.FLASH_RM_SUBIDA_MS = v; setFlash(f => ({ ...f, FLASH_RM_SUBIDA_MS: v })); }} />
          <div style={ROW}>
            <span>estado <span style={NOTE}>{flashLive.fase} · luz {flashLive.luz.toFixed(1)} · telón {flashLive.visible ? "visible" : "oculto"} · uFlash {flashLive.uFlash.toFixed(3)} · uGlare {flashLive.uGlare.toFixed(3)}</span></span>
          </div>
          <div style={ROW}>
            <span>FLASH_OVERLAY_DOM <span style={NOTE}>F2 on=overlay HTML sin CRT</span></span>
            <button style={INPUT} onClick={() => {
              const v = !flash.FLASH_OVERLAY_DOM;
              DBG_FLASH.FLASH_OVERLAY_DOM = v;
              setFlash(f => ({ ...f, FLASH_OVERLAY_DOM: v }));
            }}>{flash.FLASH_OVERLAY_DOM ? "ON" : "off"}</button>
          </div>
          <NumField label="FLASH_CRT_MAX" value={flash.FLASH_CRT_MAX} step={0.01} min={0} max={1} note="F2 tope uFlash"
            onChange={v => { DBG_FLASH.FLASH_CRT_MAX = v; setFlash(f => ({ ...f, FLASH_CRT_MAX: v })); }} />
          <NumField label="FLASH_GLOW" value={flash.FLASH_GLOW} step={0.05} min={0} max={2} note="F2 núcleo"
            onChange={v => { DBG_FLASH.FLASH_GLOW = v; setFlash(f => ({ ...f, FLASH_GLOW: v })); }} />
          <NumField label="FLASH_BAJADA_EXP_K" value={flash.FLASH_BAJADA_EXP_K} step={0.5} min={0} max={12} note="G1 curva caída"
            onChange={v => { DBG_FLASH.FLASH_BAJADA_EXP_K = v; setFlash(f => ({ ...f, FLASH_BAJADA_EXP_K: v })); }} />
          <NumField label="FLASH_GLARE_INICIO" value={flash.FLASH_GLARE_INICIO} step={0.05} min={0} max={1} note="G1"
            onChange={v => { DBG_FLASH.FLASH_GLARE_INICIO = v; setFlash(f => ({ ...f, FLASH_GLARE_INICIO: v })); }} />
          <NumField label="FLASH_GLARE_MS" value={flash.FLASH_GLARE_MS} step={100} min={0} max={10000} note="G1"
            onChange={v => { DBG_FLASH.FLASH_GLARE_MS = v; setFlash(f => ({ ...f, FLASH_GLARE_MS: v })); }} />
          <NumField label="FLASH_GLARE_EXP_K" value={flash.FLASH_GLARE_EXP_K} step={0.5} min={0} max={12} note="G1 curva glare"
            onChange={v => { DBG_FLASH.FLASH_GLARE_EXP_K = v; setFlash(f => ({ ...f, FLASH_GLARE_EXP_K: v })); }} />
          <NumField label="FLASH_GLARE_BLOOM" value={flash.FLASH_GLARE_BLOOM} step={0.05} min={0} max={1} note="G1 % del pico"
            onChange={v => { DBG_FLASH.FLASH_GLARE_BLOOM = v; setFlash(f => ({ ...f, FLASH_GLARE_BLOOM: v })); }} />
          <NumField label="FLASH_GLARE_ABERRACION" value={flash.FLASH_GLARE_ABERRACION} step={0.0005} min={0} max={0.02} note="G1 CA extra"
            onChange={v => { DBG_FLASH.FLASH_GLARE_ABERRACION = v; setFlash(f => ({ ...f, FLASH_GLARE_ABERRACION: v })); }} />
          <NumField label="FLASH_RM_BAJADA_MS" value={flash.FLASH_RM_BAJADA_MS} step={50} min={0} max={3000} note="reduced-motion"
            onChange={v => { DBG_FLASH.FLASH_RM_BAJADA_MS = v; setFlash(f => ({ ...f, FLASH_RM_BAJADA_MS: v })); }} />
          <NumField label="FLASH_RM_GLARE_MULT" value={flash.FLASH_RM_GLARE_MULT} step={0.05} min={0} max={1} note="reduced-motion"
            onChange={v => { DBG_FLASH.FLASH_RM_GLARE_MULT = v; setFlash(f => ({ ...f, FLASH_RM_GLARE_MULT: v })); }} />
          <NumField label="FLASH_SCAN_MAX" value={flash.FLASH_SCAN_MAX} step={0.01} min={0} max={0.5} note="F3 scan pico"
            onChange={v => { DBG_FLASH.FLASH_SCAN_MAX = v; setFlash(f => ({ ...f, FLASH_SCAN_MAX: v })); }} />
          <NumField label="FLASH_VIG_ATEN" value={flash.FLASH_VIG_ATEN} step={0.05} min={0} max={1} note="F3 viñeta"
            onChange={v => { DBG_FLASH.FLASH_VIG_ATEN = v; setFlash(f => ({ ...f, FLASH_VIG_ATEN: v })); }} />
          <NumField label="FLASH_TOPE_LUM" value={flash.FLASH_TOPE_LUM} step={0.01} min={0.92} max={1.5} note="F3 tope lum."
            onChange={v => { DBG_FLASH.FLASH_TOPE_LUM = v; setFlash(f => ({ ...f, FLASH_TOPE_LUM: v })); }} />
          {/* G3: perilla maestra (0 = sin destello visible, 1 = pico completo de G2) */}
          <div style={ROW}>
            <span>FLASH_INTENSIDAD <span style={NOTE}>G3 maestra</span></span>
            <input type="range" min={0} max={1} step={0.01} style={{ flex: 1 }}
              value={flash.FLASH_INTENSIDAD}
              onChange={e => {
                const v = parseFloat(e.target.value);
                DBG_FLASH.FLASH_INTENSIDAD = v;
                setFlash(f => ({ ...f, FLASH_INTENSIDAD: v }));
              }} />
            <span style={{ width: 34, textAlign: "right" }}>{flash.FLASH_INTENSIDAD.toFixed(2)}</span>
          </div>
          <NumField label="FLASH_BORDE" value={flash.FLASH_BORDE} step={0.05} min={0} max={1} note="G3 borde curvo"
            onChange={v => { DBG_FLASH.FLASH_BORDE = v; setFlash(f => ({ ...f, FLASH_BORDE: v })); }} />
          {/* G2: blanco enceguecedor */}
          <ColorField label="FLASH_COLOR" value={flash.FLASH_COLOR} note="G2 base"
            onChange={v => { DBG_FLASH.FLASH_COLOR = v; setFlash(f => ({ ...f, FLASH_COLOR: v })); }} />
          <ColorField label="FLASH_GLARE_COLOR" value={flash.FLASH_GLARE_COLOR} note="G2 borde glare"
            onChange={v => { DBG_FLASH.FLASH_GLARE_COLOR = v; setFlash(f => ({ ...f, FLASH_GLARE_COLOR: v })); }} />
          <NumField label="FLASH_HDR" value={flash.FLASH_HDR} step={0.5} min={1} max={16} note="G2 energía pre-CRT"
            onChange={v => { DBG_FLASH.FLASH_HDR = v; setFlash(f => ({ ...f, FLASH_HDR: v })); }} />
          <NumField label="FLASH_HDR_CLAMP" value={flash.FLASH_HDR_CLAMP} step={1} min={1} max={1000} note="G2 anti NaN"
            onChange={v => { DBG_FLASH.FLASH_HDR_CLAMP = v; setFlash(f => ({ ...f, FLASH_HDR_CLAMP: v })); }} />
          <NumField label="FLASH_BLOWOUT" value={flash.FLASH_BLOWOUT} step={0.01} min={0} max={1} note="G2 post-sRGB"
            onChange={v => { DBG_FLASH.FLASH_BLOWOUT = v; setFlash(f => ({ ...f, FLASH_BLOWOUT: v })); }} />
          <NumField label="FLASH_BLOWOUT_TEXTURA" value={flash.FLASH_BLOWOUT_TEXTURA} step={0.005} min={0} max={0.2} note="G2 scan+grano"
            onChange={v => { DBG_FLASH.FLASH_BLOWOUT_TEXTURA = v; setFlash(f => ({ ...f, FLASH_BLOWOUT_TEXTURA: v })); }} />
          <NumField label="FLASH_BLOOM_TOPE" value={flash.FLASH_BLOOM_TOPE} step={0.5} min={0} max={30} note="G2 clamp"
            onChange={v => { DBG_FLASH.FLASH_BLOOM_TOPE = v; setFlash(f => ({ ...f, FLASH_BLOOM_TOPE: v })); }} />
          <NumField label="FLASH_EXPOSICION_TOPE" value={flash.FLASH_EXPOSICION_TOPE} step={0.5} min={0.5} max={30} note="G2 clamp"
            onChange={v => { DBG_FLASH.FLASH_EXPOSICION_TOPE = v; setFlash(f => ({ ...f, FLASH_EXPOSICION_TOPE: v })); }} />
          <NumField label="FLASH_MEDIR_HOLD_MS" value={flash.FLASH_MEDIR_HOLD_MS} step={50} min={0} max={3000} note="G2 lectura"
            onChange={v => { DBG_FLASH.FLASH_MEDIR_HOLD_MS = v; setFlash(f => ({ ...f, FLASH_MEDIR_HOLD_MS: v })); }} />
          <div style={ROW}>
            <span>FLASH_AVISO_FOTOSENSIBILIDAD <span style={NOTE}>G2 aviso al inicio</span></span>
            <button style={INPUT} onClick={() => {
              const v = !flash.FLASH_AVISO_FOTOSENSIBILIDAD;
              DBG_FLASH.FLASH_AVISO_FOTOSENSIBILIDAD = v;
              setFlash(f => ({ ...f, FLASH_AVISO_FOTOSENSIBILIDAD: v }));
            }}>{flash.FLASH_AVISO_FOTOSENSIBILIDAD ? "ON" : "off"}</button>
          </div>
          {/* G2: medición REAL (píxeles leídos del canvas en el sostenido) */}
          <div style={ROW}>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer" }}
              onClick={() => pedirMedicionFlash()}>
              Medir pico del destello
            </button>
            <span style={NOTE}>{medicion.estado}{medicion.estado === "listo" ? ` · ${medicion.ancho}×${medicion.alto}` : ""}</span>
          </div>
          {medicion.estado === "listo" && (
            <div style={{ ...ROW, flexDirection: "column", alignItems: "flex-start" }}>
              <span>centro <span style={NOTE}>{medicion.centro.toFixed(4)} {medicion.centro >= 0.90 && medicion.centro <= 0.95 ? "✓ 0,90–0,95" : "fuera de 0,90–0,95"}</span></span>
              <span>intensidad <span style={NOTE}>{medicion.intensidad.toFixed(2)}</span></span>
              <span>esquina <span style={NOTE}>{medicion.esquina.toFixed(4)} {medicion.esquina >= 0.6 && medicion.esquina <= 0.75 ? "✓ 0,60–0,75" : "fuera de 0,60–0,75"}</span></span>
              <span>contraste CRT (centro − esquina) <span style={NOTE}>{medicion.contraste.toFixed(4)}</span></span>
              <span>5 % más oscuro <span style={NOTE}>{medicion.oscuro5.toFixed(4)}</span></span>
              <span>mín. RGB <span style={NOTE}>{medicion.minRGB.toFixed(4)}</span></span>
            </div>
          )}
          <div style={ROW}>
            <span>teórico (secundario) <span style={NOTE}>(valle scanline + grano) {flashLive.lum.toFixed(3)}</span></span>
          </div>
          <div style={ROW}>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer" }}
              onClick={() => window.dispatchEvent(new CustomEvent("alight:debug-curtain-flash"))}>
              Disparar destello de cortina
            </button>
          </div>

          <div style={DIVIDER} />
          <span style={LABEL}>Panorama T2 — crecimiento de grupos <span style={NOTE}>(live)</span></span>
          <NumField label="vizGrowS" value={sillas.vizGrowS} step={0.5} min={0.5} max={15} note="live"
            onChange={v => { DBG_SILLAS.vizGrowS = v; setSillas(s => ({ ...s, vizGrowS: v })); }} />
          {([0,1,2,3] as const).map(i => {
            const key = `vizGrowForce${i}` as "vizGrowForce0"|"vizGrowForce1"|"vizGrowForce2"|"vizGrowForce3";
            const labels = ["SOL","MONTAÑAS","CIELO","LÍNEAS"] as const;
            return (
              <div key={i} style={ROW}>
                <span>force{i} {labels[i]}</span>
                <input type="range" min={-1} max={1} step={0.01} style={{ flex: 1 }}
                  value={sillas[key]}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    DBG_SILLAS[key] = v;
                    setSillas(s => ({ ...s, [key]: v }));
                  }} />
                <span style={{ width: 34, textAlign: "right" }}>{(sillas[key] as number).toFixed(2)}</span>
              </div>
            );
          })}
          {/* U3: forzar todos los grupos al máximo — activa visualizador + fuerza grow=1 */}
          <div style={ROW}>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer" }}
              onClick={() => {
                (["vizGrowForce0","vizGrowForce1","vizGrowForce2","vizGrowForce3"] as const).forEach(k => {
                  DBG_SILLAS[k] = 1;
                });
                setSillas(s => ({ ...s, vizGrowForce0: 1, vizGrowForce1: 1, vizGrowForce2: 1, vizGrowForce3: 1 }));
                activateVisualizerOnce();
              }}>
              Todos grow=1 (U3)
            </button>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer" }}
              onClick={() => {
                (["vizGrowForce0","vizGrowForce1","vizGrowForce2","vizGrowForce3"] as const).forEach(k => {
                  DBG_SILLAS[k] = -1;
                });
                setSillas(s => ({ ...s, vizGrowForce0: -1, vizGrowForce1: -1, vizGrowForce2: -1, vizGrowForce3: -1 }));
                resetVizActivated();
              }}>
              Reset (U3)
            </button>
          </div>

          <div style={DIVIDER} />
          <span style={LABEL}>Reacción T3 — audio <span style={NOTE}>(live)</span></span>
          <NumField label="pulseAttackMs"  value={sillas.pulseAttackMs}  step={50}  min={50}  max={2000} note="live"
            onChange={v => { DBG_SILLAS.pulseAttackMs  = v; setSillas(s => ({ ...s, pulseAttackMs:  v })); }} />
          <NumField label="pulseDecayMs"   value={sillas.pulseDecayMs}   step={50}  min={50}  max={3000} note="live"
            onChange={v => { DBG_SILLAS.pulseDecayMs   = v; setSillas(s => ({ ...s, pulseDecayMs:   v })); }} />
          {([0,1,2,3] as const).map(i => {
            const key = `simPulse${i}` as "simPulse0"|"simPulse1"|"simPulse2"|"simPulse3";
            const labels = ["SOL","MONTAÑAS","CIELO","LÍNEAS"] as const;
            return (
              <div key={i} style={ROW}>
                <span>sim{i} {labels[i]}</span>
                <input type="range" min={0} max={1} step={0.01} style={{ flex: 1 }}
                  value={sillas[key]}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    DBG_SILLAS[key] = v;
                    setSillas(s => ({ ...s, [key]: v }));
                  }} />
                <span style={{ width: 34, textAlign: "right" }}>{(sillas[key] as number).toFixed(2)}</span>
              </div>
            );
          })}
          <NumField label="mtHeightBoost"  value={sillas.mtHeightBoost}  step={0.01} min={0} max={1} note="live"
            onChange={v => { DBG_SILLAS.mtHeightBoost  = v; setSillas(s => ({ ...s, mtHeightBoost:  v })); }} />
          <NumField label="mtBrightBoost"  value={sillas.mtBrightBoost}  step={0.05} min={0} max={2} note="live"
            onChange={v => { DBG_SILLAS.mtBrightBoost  = v; setSillas(s => ({ ...s, mtBrightBoost:  v })); }} />
          <NumField label="skyBrightBoost" value={sillas.skyBrightBoost} step={0.05} min={0} max={2} note="live"
            onChange={v => { DBG_SILLAS.skyBrightBoost = v; setSillas(s => ({ ...s, skyBrightBoost: v })); }} />
          <NumField label="sunBrightBoost" value={sillas.sunBrightBoost} step={0.05} min={0} max={2} note="live"
            onChange={v => { DBG_SILLAS.sunBrightBoost = v; setSillas(s => ({ ...s, sunBrightBoost: v })); }} />
          <NumField label="lineAmpBoost"   value={sillas.lineAmpBoost}   step={0.1}  min={0} max={5} note="live"
            onChange={v => { DBG_SILLAS.lineAmpBoost   = v; setSillas(s => ({ ...s, lineAmpBoost:   v })); }} />
          <NumField label="lineSpeedBoost" value={sillas.lineSpeedBoost} step={0.5}  min={0} max={10} note="live"
            onChange={v => { DBG_SILLAS.lineSpeedBoost = v; setSillas(s => ({ ...s, lineSpeedBoost: v })); }} />
          <div style={ROW}>
            <span>showReactionOverlay</span>
            <button style={INPUT} onClick={() => {
              const v = !sillas.showReactionOverlay;
              DBG_SILLAS.showReactionOverlay = v;
              setSillas(s => ({ ...s, showReactionOverlay: v }));
            }}>{sillas.showReactionOverlay ? "ON" : "off"}</button>
          </div>
          {sillas.showReactionOverlay && (
            <div style={{ fontSize: 10, color: "#9cf", padding: "4px 0" }}>
              {[0,1,2,3].map(i => {
                const bIdx = BAND_STATE.assignment[i];
                const labels = ["SOL","MONTAÑAS","CIELO","LÍNEAS"];
                return <div key={i}>haz{i}={labels[i]} → band{bIdx} | E={BAND_STATE.energy[bIdx]?.toFixed(3) ?? "?"}</div>;
              })}
            </div>
          )}

          <div style={DIVIDER} />
          <span style={LABEL}>U4 — SOL <span style={NOTE}>(anillos desfasados)</span></span>
          <NumField label="grp0AtkMs"     value={sillas.grp0AtkMs}     step={5}    min={5}   max={500}  note="live"
            onChange={v => { DBG_SILLAS.grp0AtkMs     = v; setSillas(s => ({ ...s, grp0AtkMs:     v })); }} />
          <NumField label="grp0RelMs"     value={sillas.grp0RelMs}     step={10}   min={10}  max={2000} note="live"
            onChange={v => { DBG_SILLAS.grp0RelMs     = v; setSillas(s => ({ ...s, grp0RelMs:     v })); }} />
          <NumField label="sunRingLagMs"  value={sillas.sunRingLagMs}  step={5}    min={0}   max={200}  note="live"
            onChange={v => { DBG_SILLAS.sunRingLagMs  = v; setSillas(s => ({ ...s, sunRingLagMs:  v })); }} />
          <NumField label="sunCoreKickBrt" value={sillas.sunCoreKickBrt} step={0.05} min={0}  max={3}   note="live"
            onChange={v => { DBG_SILLAS.sunCoreKickBrt = v; setSillas(s => ({ ...s, sunCoreKickBrt: v })); }} />

          <div style={DIVIDER} />
          <span style={LABEL}>U4 — MONTAÑAS <span style={NOTE}>(respiración lenta)</span></span>
          <NumField label="grp1AtkMs"    value={sillas.grp1AtkMs}    step={10}   min={10}  max={2000} note="live"
            onChange={v => { DBG_SILLAS.grp1AtkMs    = v; setSillas(s => ({ ...s, grp1AtkMs:    v })); }} />
          <NumField label="grp1RelMs"    value={sillas.grp1RelMs}    step={50}   min={50}  max={5000} note="live"
            onChange={v => { DBG_SILLAS.grp1RelMs    = v; setSillas(s => ({ ...s, grp1RelMs:    v })); }} />
          <NumField label="mt0AmpBoost"  value={sillas.mt0AmpBoost}  step={0.01} min={0}   max={0.5}  note="fondo"
            onChange={v => { DBG_SILLAS.mt0AmpBoost  = v; setSillas(s => ({ ...s, mt0AmpBoost:  v })); }} />
          <NumField label="mt1AmpBoost"  value={sillas.mt1AmpBoost}  step={0.01} min={0}   max={0.5}  note="medias"
            onChange={v => { DBG_SILLAS.mt1AmpBoost  = v; setSillas(s => ({ ...s, mt1AmpBoost:  v })); }} />
          <NumField label="mt2AmpBoost"  value={sillas.mt2AmpBoost}  step={0.01} min={0}   max={0.5}  note="frente"
            onChange={v => { DBG_SILLAS.mt2AmpBoost  = v; setSillas(s => ({ ...s, mt2AmpBoost:  v })); }} />
          <NumField label="mtPhaseSpd"   value={sillas.mtPhaseSpd}   step={0.1}  min={0}   max={5}    note="rad/s"
            onChange={v => { DBG_SILLAS.mtPhaseSpd   = v; setSillas(s => ({ ...s, mtPhaseSpd:   v })); }} />
          <NumField label="mtAzParallax" value={sillas.mtAzParallax} step={0.1}  min={0}   max={5}    note="grados"
            onChange={v => { DBG_SILLAS.mtAzParallax = v; setSillas(s => ({ ...s, mtAzParallax: v })); }} />

          <div style={DIVIDER} />
          <span style={LABEL}>U4 — CIELO <span style={NOTE}>(centelleo)</span></span>
          <NumField label="grp2AtkMs"      value={sillas.grp2AtkMs}      step={5}    min={5}  max={500}  note="live"
            onChange={v => { DBG_SILLAS.grp2AtkMs      = v; setSillas(s => ({ ...s, grp2AtkMs:      v })); }} />
          <NumField label="grp2RelMs"      value={sillas.grp2RelMs}      step={10}   min={10} max={2000} note="live"
            onChange={v => { DBG_SILLAS.grp2RelMs      = v; setSillas(s => ({ ...s, grp2RelMs:      v })); }} />
          <NumField label="starTwinkleAmp" value={sillas.starTwinkleAmp} step={0.05} min={0}  max={2}    note="live"
            onChange={v => { DBG_SILLAS.starTwinkleAmp = v; setSillas(s => ({ ...s, starTwinkleAmp: v })); }} />
          <NumField label="starTwinkleFq"  value={sillas.starTwinkleFq}  step={0.1}  min={0}  max={10}   note="rad/s"
            onChange={v => { DBG_SILLAS.starTwinkleFq  = v; setSillas(s => ({ ...s, starTwinkleFq:  v })); }} />

          <div style={DIVIDER} />
          <span style={LABEL}>U4 — LÍNEAS <span style={NOTE}>(envelope)</span></span>
          <NumField label="grp3AtkMs" value={sillas.grp3AtkMs} step={5}  min={5}  max={500}  note="live"
            onChange={v => { DBG_SILLAS.grp3AtkMs = v; setSillas(s => ({ ...s, grp3AtkMs: v })); }} />
          <NumField label="grp3RelMs" value={sillas.grp3RelMs} step={10} min={10} max={2000} note="live"
            onChange={v => { DBG_SILLAS.grp3RelMs = v; setSillas(s => ({ ...s, grp3RelMs: v })); }} />

          <div style={DIVIDER} />
          <span style={LABEL}>U5 — LÍNEAS líquidas <span style={NOTE}>(psico shader)</span></span>
          <div style={ROW}>
            <span>u5PsyMode</span>
            <button style={INPUT} onClick={() => {
              const v = !sillas.u5PsyMode;
              DBG_SILLAS.u5PsyMode = v; setSillas(s => ({ ...s, u5PsyMode: v }));
            }}>{sillas.u5PsyMode ? "ON" : "off"}</button>
          </div>
          <NumField label="u5PsyMixMin" value={sillas.u5PsyMixMin} step={0.05} min={0} max={1} note="live"
            onChange={v => { DBG_SILLAS.u5PsyMixMin = v; setSillas(s => ({ ...s, u5PsyMixMin: v })); }} />
          <NumField label="u5PsyMixMax" value={sillas.u5PsyMixMax} step={0.05} min={0} max={1} note="live"
            onChange={v => { DBG_SILLAS.u5PsyMixMax = v; setSillas(s => ({ ...s, u5PsyMixMax: v })); }} />
          <NumField label="u5WaveAmp"   value={sillas.u5WaveAmp}   step={0.01} min={0} max={0.6} note="live"
            onChange={v => { DBG_SILLAS.u5WaveAmp   = v; setSillas(s => ({ ...s, u5WaveAmp:   v })); }} />
          <NumField label="u5WaveFreq"  value={sillas.u5WaveFreq}  step={0.5}  min={0} max={20}  note="live"
            onChange={v => { DBG_SILLAS.u5WaveFreq  = v; setSillas(s => ({ ...s, u5WaveFreq:  v })); }} />
          <NumField label="u5WaveSpd"   value={sillas.u5WaveSpd}   step={0.1}  min={0} max={10}  note="live"
            onChange={v => { DBG_SILLAS.u5WaveSpd   = v; setSillas(s => ({ ...s, u5WaveSpd:   v })); }} />
          <NumField label="u5FbmSpd"    value={sillas.u5FbmSpd}    step={0.01} min={0} max={0.5} note="live"
            onChange={v => { DBG_SILLAS.u5FbmSpd    = v; setSillas(s => ({ ...s, u5FbmSpd:    v })); }} />

          <div style={DIVIDER} />
          <span style={LABEL}>U6A — Anillos en piso <span style={NOTE}>(al entrar al haz)</span></span>
          <NumField label="u6RingCount" value={sillas.u6RingCount} step={1}    min={2}   max={7}    note="live"
            onChange={v => { DBG_SILLAS.u6RingCount = v; setSillas(s => ({ ...s, u6RingCount: v })); }} />
          <NumField label="u6Duration"  value={sillas.u6Duration}  step={0.1}  min={0.5} max={10}   note="live (s)"
            onChange={v => { DBG_SILLAS.u6Duration  = v; setSillas(s => ({ ...s, u6Duration:  v })); }} />
          <NumField label="u6SeqDelay"  value={sillas.u6SeqDelay}  step={0.05} min={0}   max={1}    note="live (s)"
            onChange={v => { DBG_SILLAS.u6SeqDelay  = v; setSillas(s => ({ ...s, u6SeqDelay:  v })); }} />
          <NumField label="u6MinRadius" value={sillas.u6MinRadius} step={0.05} min={0.1} max={2}    note="live (m)"
            onChange={v => { DBG_SILLAS.u6MinRadius = v; setSillas(s => ({ ...s, u6MinRadius: v })); }} />
          <NumField label="u6MaxRadius" value={sillas.u6MaxRadius} step={0.1}  min={0.5} max={5}    note="live (m)"
            onChange={v => { DBG_SILLAS.u6MaxRadius = v; setSillas(s => ({ ...s, u6MaxRadius: v })); }} />
          <NumField label="u6TwinkleFq" value={sillas.u6TwinkleFq} step={0.5}  min={1}   max={30}   note="live (rad/s)"
            onChange={v => { DBG_SILLAS.u6TwinkleFq = v; setSillas(s => ({ ...s, u6TwinkleFq: v })); }} />
          <NumField label="u6Opacity"   value={sillas.u6Opacity}   step={0.05} min={0}   max={2}    note="live"
            onChange={v => { DBG_SILLAS.u6Opacity   = v; setSillas(s => ({ ...s, u6Opacity:   v })); }} />

          <div style={DIVIDER} />
          <span style={LABEL}>U6B — Destello del haz <span style={NOTE}>(al activar/desactivar)</span></span>
          <NumField label="u6FlashPeak"  value={sillas.u6FlashPeak}  step={0.1}  min={1}   max={10}   note="live (×)"
            onChange={v => { DBG_SILLAS.u6FlashPeak  = v; setSillas(s => ({ ...s, u6FlashPeak:  v })); }} />
          <NumField label="u6FlashAtkS"  value={sillas.u6FlashAtkS}  step={0.01} min={0.01} max={1}   note="live (s)"
            onChange={v => { DBG_SILLAS.u6FlashAtkS  = v; setSillas(s => ({ ...s, u6FlashAtkS:  v })); }} />
          <NumField label="u6FlashDecS"  value={sillas.u6FlashDecS}  step={0.5}  min={0.5} max={20}   note="live (s)"
            onChange={v => { DBG_SILLAS.u6FlashDecS  = v; setSillas(s => ({ ...s, u6FlashDecS:  v })); }} />
          <NumField label="u6DimFactor"  value={sillas.u6DimFactor}  step={0.05} min={0}   max={1}    note="live"
            onChange={v => { DBG_SILLAS.u6DimFactor  = v; setSillas(s => ({ ...s, u6DimFactor:  v })); }} />
          <NumField label="u6DimDecS"    value={sillas.u6DimDecS}    step={0.1}  min={0.1} max={10}   note="live (s)"
            onChange={v => { DBG_SILLAS.u6DimDecS    = v; setSillas(s => ({ ...s, u6DimDecS:    v })); }} />

          <div style={DIVIDER} />
          <span style={LABEL}>U7 — Capas visibles <span style={NOTE}>(debug)</span></span>
          {([
            ["u7VisStars",    "estrellas"],
            ["u7VisClouds",   "nubes"],
            ["u7VisSun",      "sol"],
            ["u7VisSky",      "cielo"],
            ["u7VisMtFondo",  "mt-fondo"],
            ["u7VisMtMedias", "mt-medias"],
            ["u7VisMtFrente", "mt-frente"],
            ["u7VisLines",    "líneas"],
          ] as [keyof typeof DBG_SILLAS, string][]).map(([key, label]) => (
            <div key={key} style={ROW}>
              <span>{label}</span>
              <button style={INPUT} onClick={() => {
                const v = !sillas[key];
                (DBG_SILLAS as Record<string, unknown>)[key] = v;
                setSillas(s => ({ ...s, [key]: v }));
              }}>{sillas[key] ? "ON" : "off"}</button>
            </div>
          ))}
          <NumField label="u7MagentaIdx" value={sillas.u7MagentaIdx} step={1} min={0} max={8}
            note="0=off 1=stars 2=clouds 3=sun 4=sky 5=mt-fondo 6=mt-medias 7=mt-frente 8=lines"
            onChange={v => { DBG_SILLAS.u7MagentaIdx = v; setSillas(s => ({ ...s, u7MagentaIdx: v })); }} />

          <div style={DIVIDER} />
          <span style={LABEL}>U9 — Secuencia amanecer <span style={NOTE}>(debug)</span></span>
          <NumField label="amanecerDurS"       value={sillas.amanecerDurS}       step={1}    min={1}   max={60}   note="duración fase 1 (s)"
            onChange={v => { DBG_SILLAS.amanecerDurS       = v; setSillas(s => ({ ...s, amanecerDurS:       v })); }} />
          <NumField label="amanecerSectorDeg"  value={sillas.amanecerSectorDeg}  step={10}   min={10}  max={360}  note="ancho sector (°)"
            onChange={v => { DBG_SILLAS.amanecerSectorDeg  = v; setSillas(s => ({ ...s, amanecerSectorDeg:  v })); }} />
          <NumField label="amanecerEdgeDeg"    value={sillas.amanecerEdgeDeg}    step={1}    min={0}   max={30}   note="borde suave (°)"
            onChange={v => { DBG_SILLAS.amanecerEdgeDeg    = v; setSillas(s => ({ ...s, amanecerEdgeDeg:    v })); }} />
          <NumField label="amanecerP2StaggerS" value={sillas.amanecerP2StaggerS} step={0.5}  min={0}   max={5}    note="retraso entre capas fase 2 (s)"
            onChange={v => { DBG_SILLAS.amanecerP2StaggerS = v; setSillas(s => ({ ...s, amanecerP2StaggerS: v })); }} />
          <NumField label="amanecerP2GrowS"    value={sillas.amanecerP2GrowS}    step={0.5}  min={0.5} max={10}   note="duración crecimiento fase 2 (s)"
            onChange={v => { DBG_SILLAS.amanecerP2GrowS    = v; setSillas(s => ({ ...s, amanecerP2GrowS:    v })); }} />
          <div style={ROW}>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer" }}
              onClick={() => window.dispatchEvent(new CustomEvent('alight:dawn-reset'))}>
              Reiniciar amanecer
            </button>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer", marginLeft: 6 }}
              onClick={() => window.dispatchEvent(new CustomEvent('alight:dawn-skip'))}>
              Saltar al final
            </button>
          </div>

          <div style={DIVIDER} />
          <span style={LABEL}>U10A — Parallax por capa <span style={NOTE}>(live)</span></span>
          <NumField label="parFrenteFact"  value={sillas.parFrenteFact}  step={0.01} min={0.5} max={1.0}  note="frente position factor (0.93)"
            onChange={v => { DBG_SILLAS.parFrenteFact  = v; setSillas(s => ({ ...s, parFrenteFact:  v })); }} />
          <NumField label="parMediasFact"  value={sillas.parMediasFact}  step={0.01} min={0.5} max={1.0}  note="medias position factor (0.97)"
            onChange={v => { DBG_SILLAS.parMediasFact  = v; setSillas(s => ({ ...s, parMediasFact:  v })); }} />
          <NumField label="parPitchFre"    value={sillas.parPitchFre}    step={0.01} min={0}   max={0.2}  note="V shift/rad pitch (frente)"
            onChange={v => { DBG_SILLAS.parPitchFre    = v; setSillas(s => ({ ...s, parPitchFre:    v })); }} />
          <NumField label="parPitchMed"    value={sillas.parPitchMed}    step={0.01} min={0}   max={0.2}  note="V shift/rad pitch (medias)"
            onChange={v => { DBG_SILLAS.parPitchMed    = v; setSillas(s => ({ ...s, parPitchMed:    v })); }} />
          <NumField label="parYawTau"      value={sillas.parYawTau}      step={0.05} min={0.1} max={2}    note="yaw-lag decay τ (s)"
            onChange={v => { DBG_SILLAS.parYawTau      = v; setSillas(s => ({ ...s, parYawTau:      v })); }} />
          <NumField label="parYawScale"    value={sillas.parYawScale}    step={0.05} min={0}   max={2}    note="yaw delta → UV offset scale"
            onChange={v => { DBG_SILLAS.parYawScale    = v; setSillas(s => ({ ...s, parYawScale:    v })); }} />

          <div style={DIVIDER} />
          <span style={LABEL}>U10B — Reacción al sonido <span style={NOTE}>(live)</span></span>
          <NumField label="mtWaveAmp"       value={sillas.mtWaveAmp}       step={0.05} min={0}   max={0.5}  note="onda viajera amplitud (UV ±)"
            onChange={v => { DBG_SILLAS.mtWaveAmp       = v; setSillas(s => ({ ...s, mtWaveAmp:       v })); }} />
          <NumField label="mtWaveFreq"      value={sillas.mtWaveFreq}      step={0.5}  min={0.5} max={8}    note="ciclos por azimut"
            onChange={v => { DBG_SILLAS.mtWaveFreq      = v; setSillas(s => ({ ...s, mtWaveFreq:      v })); }} />
          <NumField label="mtWaveSpd"       value={sillas.mtWaveSpd}       step={0.25} min={0}   max={5}    note="velocidad onda (ciclos/s a energía=1)"
            onChange={v => { DBG_SILLAS.mtWaveSpd       = v; setSillas(s => ({ ...s, mtWaveSpd:       v })); }} />
          <NumField label="mtKickShkFreDeg" value={sillas.mtKickShkFreDeg} step={0.5}  min={0}   max={5}    note="sacudida kick frente (°)"
            onChange={v => { DBG_SILLAS.mtKickShkFreDeg = v; setSillas(s => ({ ...s, mtKickShkFreDeg: v })); }} />
          <NumField label="mtKickShkMedDeg" value={sillas.mtKickShkMedDeg} step={0.5}  min={0}   max={5}    note="sacudida kick medias (°)"
            onChange={v => { DBG_SILLAS.mtKickShkMedDeg = v; setSillas(s => ({ ...s, mtKickShkMedDeg: v })); }} />
          <NumField label="mtKickShkFonDeg" value={sillas.mtKickShkFonDeg} step={0.5}  min={0}   max={5}    note="sacudida kick fondo (°)"
            onChange={v => { DBG_SILLAS.mtKickShkFonDeg = v; setSillas(s => ({ ...s, mtKickShkFonDeg: v })); }} />
          <NumField label="mtKickSpringK"   value={sillas.mtKickSpringK}   step={10}   min={10}  max={400}  note="rigidez del resorte (1/s²)"
            onChange={v => { DBG_SILLAS.mtKickSpringK   = v; setSillas(s => ({ ...s, mtKickSpringK:   v })); }} />
          <NumField label="mtKickSpringD"   value={sillas.mtKickSpringD}   step={2}    min={1}   max={60}   note="amortiguación del resorte (1/s)"
            onChange={v => { DBG_SILLAS.mtKickSpringD   = v; setSillas(s => ({ ...s, mtKickSpringD:   v })); }} />
          <NumField label="mtEdgeGlow"      value={sillas.mtEdgeGlow}      step={0.25} min={0}   max={5}    note="intensidad brillo contorno"
            onChange={v => { DBG_SILLAS.mtEdgeGlow      = v; setSillas(s => ({ ...s, mtEdgeGlow:      v })); }} />
          <NumField label="mtSepAzDeg"      value={sillas.mtSepAzDeg}      step={0.5}  min={0}   max={10}   note="separación máx capas (°)"
            onChange={v => { DBG_SILLAS.mtSepAzDeg      = v; setSillas(s => ({ ...s, mtSepAzDeg:      v })); }} />
          <NumField label="mtTintMaxMix"    value={sillas.mtTintMaxMix}    step={0.05} min={0}   max={1}    note="tinte máx (0–1)"
            onChange={v => { DBG_SILLAS.mtTintMaxMix    = v; setSillas(s => ({ ...s, mtTintMaxMix:    v })); }} />
          <NumField label="mtFogFondo"      value={sillas.mtFogFondo}      step={0.05} min={0}   max={0.5}  note="niebla atmosférica fondo"
            onChange={v => { DBG_SILLAS.mtFogFondo      = v; setSillas(s => ({ ...s, mtFogFondo:      v })); }} />
          <NumField label="mtFogMedias"     value={sillas.mtFogMedias}     step={0.05} min={0}   max={0.5}  note="niebla atmosférica medias"
            onChange={v => { DBG_SILLAS.mtFogMedias     = v; setSillas(s => ({ ...s, mtFogMedias:     v })); }} />

          <div style={DIVIDER} />
          <span style={LABEL}>U11 — Camera feedback (haz-toggle) <span style={NOTE}>(live)</span></span>
          <NumField label="u11ShakeAmpDeg"   value={sillas.u11ShakeAmpDeg}   step={0.1}  min={0}    max={3}     note="sacudida amplitud (°)"
            onChange={v => { DBG_SILLAS.u11ShakeAmpDeg   = v; setSillas(s => ({ ...s, u11ShakeAmpDeg:   v })); }} />
          <NumField label="u11ShakeTauS"     value={sillas.u11ShakeTauS}     step={0.01} min={0.02} max={0.5}   note="decaimiento τ (s)"
            onChange={v => { DBG_SILLAS.u11ShakeTauS     = v; setSillas(s => ({ ...s, u11ShakeTauS:     v })); }} />
          <NumField label="u11GlarePeakOp"   value={sillas.u11GlarePeakOp}   step={0.05} min={0}    max={1}     note="glare on-toggle opacidad pico"
            onChange={v => { DBG_SILLAS.u11GlarePeakOp   = v; setSillas(s => ({ ...s, u11GlarePeakOp:   v })); }} />
          <NumField label="u11GlareAtkS"     value={sillas.u11GlareAtkS}     step={0.01} min={0.01} max={0.3}   note="glare attack time (s)"
            onChange={v => { DBG_SILLAS.u11GlareAtkS     = v; setSillas(s => ({ ...s, u11GlareAtkS:     v })); }} />
          <NumField label="u11GlareTauS"     value={sillas.u11GlareTauS}     step={0.01} min={0.05} max={1}     note="glare decaimiento τ (s)"
            onChange={v => { DBG_SILLAS.u11GlareTauS     = v; setSillas(s => ({ ...s, u11GlareTauS:     v })); }} />
          <NumField label="u11GlareDimOp"    value={sillas.u11GlareDimOp}    step={0.05} min={0}    max={1}     note="glare off-toggle opacidad pico"
            onChange={v => { DBG_SILLAS.u11GlareDimOp    = v; setSillas(s => ({ ...s, u11GlareDimOp:    v })); }} />
          <NumField label="u11FlareCount"    value={sillas.u11FlareCount}    step={1}    min={1}    max={4}     note="círculos de lens flare (1–4)"
            onChange={v => { DBG_SILLAS.u11FlareCount    = v; setSillas(s => ({ ...s, u11FlareCount:    v })); }} />
          <NumField label="u11ChromaMs"      value={sillas.u11ChromaMs}      step={10}   min={0}    max={400}   note="aberración cromática duración (ms)"
            onChange={v => { DBG_SILLAS.u11ChromaMs      = v; setSillas(s => ({ ...s, u11ChromaMs:      v })); }} />
          <NumField label="u11GlareRadiusFr" value={sillas.u11GlareRadiusFr} step={0.05} min={0.1}  max={1}     note="radio del glow radial (× altura)"
            onChange={v => { DBG_SILLAS.u11GlareRadiusFr = v; setSillas(s => ({ ...s, u11GlareRadiusFr: v })); }} />
          <NumField label="u11StreakLenFr"   value={sillas.u11StreakLenFr}   step={0.1}  min={0.2}  max={2}     note="largo del streak (× ancho)"
            onChange={v => { DBG_SILLAS.u11StreakLenFr   = v; setSillas(s => ({ ...s, u11StreakLenFr:   v })); }} />
          <NumField label="u11StreakHFr"     value={sillas.u11StreakHFr}     step={0.002} min={0.002} max={0.05} note="alto del streak (× altura)"
            onChange={v => { DBG_SILLAS.u11StreakHFr     = v; setSillas(s => ({ ...s, u11StreakHFr:     v })); }} />

          <div style={DIVIDER} />
          <span style={LABEL}>AA1 — Domo original <span style={NOTE}>(pre-W1: VizPanorama + esfera panorama)</span></span>
          <div style={ROW}>
            <span>domoOriginal</span>
            <button style={INPUT} onClick={() => {
              const v = !sillas.domoOriginal;
              DBG_SILLAS.domoOriginal = v;
              setSillas(s => ({ ...s, domoOriginal: v }));
            }}>{sillas.domoOriginal ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>domoShaderEnMalla</span>
            <button style={INPUT} onClick={() => {
              const v = !sillas.domoShaderEnMalla;
              DBG_SILLAS.domoShaderEnMalla = v;
              setSillas(s => ({ ...s, domoShaderEnMalla: v }));
            }}>{sillas.domoShaderEnMalla ? "ON" : "off"}</button>
          </div>
          <div style={DIVIDER} />
          <span style={LABEL}>W1 — Domo de shader <span style={NOTE}>(reemplaza VizPanorama)</span></span>
          <div style={ROW}>
            <span>usarDomoShader</span>
            <button style={INPUT} onClick={() => {
              const v = !sillas.usarDomoShader;
              DBG_SILLAS.usarDomoShader = v;
              setSillas(s => ({ ...s, usarDomoShader: v }));
            }}>{sillas.usarDomoShader ? "ON" : "off"}</button>
          </div>
          <NumField label="domePortalAzimuth"    value={sillas.domePortalAzimuth}    step={0.1}  min={0}    max={6.28} note="azimut del portal (rad)"
            onChange={v => { DBG_SILLAS.domePortalAzimuth    = v; setSillas(s => ({ ...s, domePortalAzimuth:    v })); }} />
          <NumField label="domePortalElevation"  value={sillas.domePortalElevation}  step={0.05} min={0}    max={1.5}  note="elevación del portal (rad)"
            onChange={v => { DBG_SILLAS.domePortalElevation  = v; setSillas(s => ({ ...s, domePortalElevation:  v })); }} />
          <NumField label="domePortalHalfFovDeg" value={sillas.domePortalHalfFovDeg} step={1}    min={5}    max={90}   note="semi-FOV del portal (°)"
            onChange={v => { DBG_SILLAS.domePortalHalfFovDeg = v; setSillas(s => ({ ...s, domePortalHalfFovDeg: v })); }} />
          {/* Z1: radio de esfera DomeSky — W1 usó 100 (muy grande); correcto es DOME_R=28. Requiere reload. */}
          <NumField label="domeSkySphereR" value={sillas.domeSkySphereR} step={1} min={10} max={150} note="Z1: radio esfera DomeSky (W1=100 → correcto=28) — reload"
            onChange={v => { DBG_SILLAS.domeSkySphereR = v; setSillas(s => ({ ...s, domeSkySphereR: v })); }} />

          <div style={DIVIDER} />
          <span style={LABEL}>W2 — Multiplicadores de grupo <span style={NOTE}>(uniforms DomeSky)</span></span>
          <NumField label="domeSolAmt"   value={sillas.domeSolAmt}   step={0.1} min={0} max={5} note="SOL: sol + anillos (default 1.5)"
            onChange={v => { DBG_SILLAS.domeSolAmt   = v; setSillas(s => ({ ...s, domeSolAmt:   v })); }} />
          <NumField label="domeMontAmt"  value={sillas.domeMontAmt}  step={0.1} min={0} max={5} note="MONTAÑAS: máscaras R+G (default 1.5)"
            onChange={v => { DBG_SILLAS.domeMontAmt  = v; setSillas(s => ({ ...s, domeMontAmt:  v })); }} />
          <NumField label="domeCieloAmt" value={sillas.domeCieloAmt} step={0.1} min={0} max={5} note="CIELO: warp+nubes+estrellas (default 1.5)"
            onChange={v => { DBG_SILLAS.domeCieloAmt = v; setSillas(s => ({ ...s, domeCieloAmt: v })); }} />
          <NumField label="domeLinAmt"   value={sillas.domeLinAmt}   step={0.1} min={0} max={5} note="LÍNEAS: máscara B / olas (default 1.5)"
            onChange={v => { DBG_SILLAS.domeLinAmt   = v; setSillas(s => ({ ...s, domeLinAmt:   v })); }} />
          <NumField label="domeKickAmt"  value={sillas.domeKickAmt}  step={0.1} min={0} max={3} note="KICK: destello de rebote (default 1.0)"
            onChange={v => { DBG_SILLAS.domeKickAmt  = v; setSillas(s => ({ ...s, domeKickAmt:  v })); }} />

          <div style={DIVIDER} />
          <span style={LABEL}>W3 — Amanecer DomeSky <span style={NOTE}>(debug)</span></span>
          <NumField label="domeAmanecerDurS"    value={sillas.domeAmanecerDurS}    step={1}   min={1}   max={60}  note="duración fase 1 (s)"
            onChange={v => { DBG_SILLAS.domeAmanecerDurS    = v; setSillas(s => ({ ...s, domeAmanecerDurS:    v })); }} />
          <NumField label="domeRevDelayMontS"   value={sillas.domeRevDelayMontS}   step={0.5} min={0}   max={20}  note="delay MONTAÑAS strata (s)"
            onChange={v => { DBG_SILLAS.domeRevDelayMontS   = v; setSillas(s => ({ ...s, domeRevDelayMontS:   v })); }} />
          <NumField label="domeRevDelayLinS"    value={sillas.domeRevDelayLinS}    step={0.5} min={0}   max={20}  note="delay LÍNEAS waves (s)"
            onChange={v => { DBG_SILLAS.domeRevDelayLinS    = v; setSillas(s => ({ ...s, domeRevDelayLinS:    v })); }} />
          <NumField label="domeRevDelaySolS"    value={sillas.domeRevDelaySolS}    step={0.5} min={0}   max={20}  note="delay SOL rings (s)"
            onChange={v => { DBG_SILLAS.domeRevDelaySolS    = v; setSillas(s => ({ ...s, domeRevDelaySolS:    v })); }} />
          <NumField label="domeRevDelayCieloS"  value={sillas.domeRevDelayCieloS}  step={0.5} min={0}   max={20}  note="delay CIELO stars+warp (s)"
            onChange={v => { DBG_SILLAS.domeRevDelayCieloS  = v; setSillas(s => ({ ...s, domeRevDelayCieloS:  v })); }} />
          <NumField label="domeRevDurS"         value={sillas.domeRevDurS}         step={0.5} min={0.5} max={20}  note="duración de cada reveal (s)"
            onChange={v => { DBG_SILLAS.domeRevDurS         = v; setSillas(s => ({ ...s, domeRevDurS:         v })); }} />
          <div style={ROW}>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer" }}
              onClick={() => window.dispatchEvent(new CustomEvent('alight:dome-dawn-reset'))}>
              Reiniciar amanecer
            </button>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer", marginLeft: 6 }}
              onClick={() => window.dispatchEvent(new CustomEvent('alight:dome-dawn-skip'))}>
              Saltar al final
            </button>
          </div>

          <div style={DIVIDER} />
          <span style={LABEL}>W4 — DomeSky ajuste de shader <span style={NOTE}>(live sin recrear material)</span></span>
          <NumField label="domeWarp"      value={sillas.domeWarp}      step={0.1}  min={0}     max={2}     note="warp intensidad (0–2)"
            onChange={v => { DBG_SILLAS.domeWarp      = v; setSillas(s => ({ ...s, domeWarp:      v })); }} />
          <NumField label="domeRingFlow"  value={sillas.domeRingFlow}  step={0.005} min={0}    max={0.5}   note="velocidad flujo anillos"
            onChange={v => { DBG_SILLAS.domeRingFlow  = v; setSillas(s => ({ ...s, domeRingFlow:  v })); }} />
          <NumField label="domeRingScale" value={sillas.domeRingScale} step={0.1}  min={0.1}   max={5}     note="periodo de anillos"
            onChange={v => { DBG_SILLAS.domeRingScale = v; setSillas(s => ({ ...s, domeRingScale: v })); }} />
          <NumField label="domeRingFade0" value={sillas.domeRingFade0} step={0.1}  min={0}     max={3}     note="ringFade inicio (unidades p)"
            onChange={v => { DBG_SILLAS.domeRingFade0 = v; setSillas(s => ({ ...s, domeRingFade0: v })); }} />
          <NumField label="domeRingFade1" value={sillas.domeRingFade1} step={0.1}  min={0}     max={3}     note="ringFade fin"
            onChange={v => { DBG_SILLAS.domeRingFade1 = v; setSillas(s => ({ ...s, domeRingFade1: v })); }} />
          <NumField label="domeStarCut"   value={sillas.domeStarCut}   step={0.002} min={0.9}  max={0.999} note="umbral estrellas (más alto = menos)"
            onChange={v => { DBG_SILLAS.domeStarCut   = v; setSillas(s => ({ ...s, domeStarCut:   v })); }} />
          <div style={ROW}>
            <span>domeLowQuality</span>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer", marginLeft: "auto" }}
              onClick={() => {
                DBG_SILLAS.domeLowQuality = !sillas.domeLowQuality;
                setSillas(s => ({ ...s, domeLowQuality: DBG_SILLAS.domeLowQuality }));
                window.dispatchEvent(new CustomEvent('alight:dome-lq-change'));
              }}>
              {sillas.domeLowQuality ? "ON" : "off"} <span style={NOTE}>(remonta material)</span>
            </button>
          </div>
          <div style={ROW}>
            <span>showDomeMeters</span>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer", marginLeft: "auto" }}
              onClick={() => { DBG_SILLAS.showDomeMeters = !sillas.showDomeMeters; setSillas(s => ({ ...s, showDomeMeters: DBG_SILLAS.showDomeMeters })); }}>
              {sillas.showDomeMeters ? "ON" : "off"}
            </button>
          </div>
          {sillas.showDomeMeters && (
            <div style={{ paddingTop: 6, paddingBottom: 4 }}>
              {([
                ['SOL',   domeM.sol,   '#f3b230'],
                ['MONT',  domeM.mont,  '#2E9E5B'],
                ['CIELO', domeM.cielo, '#1F7FB8'],
                ['LIN',   domeM.lin,   '#E5322B'],
                ['KICK',  domeM.kick,  '#FF9A1F'],
                ['DAWN',  domeM.dawn,  '#e0d0b0'],
              ] as [string, number, string][]).map(([label, val, color]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ ...NOTE, width: 40, textAlign: 'right', flexShrink: 0 }}>{label}</span>
                  <div style={{ flex: 1, background: '#2a2a2a', height: 8, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(val * 100, 100).toFixed(1)}%`, height: '100%', background: color, transition: 'width 0.1s' }} />
                  </div>
                  <span style={{ ...NOTE, width: 32 }}>{val.toFixed(2)}</span>
                </div>
              ))}
              <div style={{ ...NOTE, marginTop: 4 }}>estado: <b>{domeM.phase}</b></div>
            </div>
          )}

          <div style={DIVIDER} />
          <span style={LABEL}>W5 — Siluetas suaves <span style={NOTE}>(portal-masks-2k + blur σ=2.5)</span></span>
          <div style={ROW}>
            <span>domeSiluetasSuaves</span>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer", marginLeft: "auto" }}
              onClick={() => { DBG_SILLAS.domeSiluetasSuaves = !sillas.domeSiluetasSuaves; setSillas(s => ({ ...s, domeSiluetasSuaves: DBG_SILLAS.domeSiluetasSuaves })); }}>
              {sillas.domeSiluetasSuaves ? "ON" : "off"}
            </button>
          </div>
          <NumField label="domeSoftEdge"   value={sillas.domeSoftEdge}   step={0.05} min={0}    max={1}     note="0=duro 1=suave"
            onChange={v => { DBG_SILLAS.domeSoftEdge   = v; setSillas(s => ({ ...s, domeSoftEdge:   v })); }} />

          <div style={DIVIDER} />
          {/* X2: diagnóstico domo — oculto por defecto */}
          <div style={ROW}>
            <span style={{ ...LABEL, marginBottom: 0 }}>X2 Domo diagnóstico <span style={NOTE}>(oculto por defecto)</span></span>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer", marginLeft: "auto" }}
              onClick={() => { DBG_SILLAS.showDomeX2 = !sillas.showDomeX2; setSillas(s => ({ ...s, showDomeX2: DBG_SILLAS.showDomeX2 })); }}>
              {sillas.showDomeX2 ? "ON" : "off"}
            </button>
          </div>
          {sillas.showDomeX2 && (
            <div style={{ paddingTop: 6 }}>
              {/* Botones de acción */}
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button style={{ flex: 1, padding: "4px 0", cursor: "pointer", fontFamily: "monospace", fontSize: 10,
                  background: domeForce.visible ? "rgba(0,120,60,0.7)" : "rgba(40,40,60,0.7)",
                  color: domeForce.visible ? "#7fff9f" : "#9fbfff",
                  border: "1px solid rgba(80,180,100,0.4)", borderRadius: 3 }}
                  onClick={() => {
                    const v = !DBG_DOME_FORCE.visible;
                    DBG_DOME_FORCE.visible = v;
                    setDomeForce(f => ({ ...f, visible: v }));
                  }}>
                  {domeForce.visible ? "✓ forzar visible" : "forzar todo visible"}
                </button>
                <button style={{ flex: 1, padding: "4px 0", cursor: "pointer", fontFamily: "monospace", fontSize: 10,
                  background: domeForce.masks ? "rgba(80,0,120,0.7)" : "rgba(40,40,60,0.7)",
                  color: domeForce.masks ? "#df9fff" : "#9fbfff",
                  border: "1px solid rgba(140,80,200,0.4)", borderRadius: 3 }}
                  onClick={() => {
                    const v = !DBG_DOME_FORCE.masks;
                    DBG_DOME_FORCE.masks = v;
                    setDomeForce(f => ({ ...f, masks: v }));
                  }}>
                  {domeForce.masks ? "✓ ver máscaras" : "ver máscaras"}
                </button>
              </div>
              {/* Valores live */}
              {([
                ['fase',     domeX2.phase,                     '#e0d0b0', true],
                ['uDawn',    domeX2.uDawn,                     '#e0d0b0', false],
                ['rev.X mt', domeX2.revX,                      '#2E9E5B', false],
                ['rev.Y ln', domeX2.revY,                      '#E5322B', false],
                ['rev.Z sol',domeX2.revZ,                      '#f3b230', false],
                ['rev.W sky',domeX2.revW,                      '#1F7FB8', false],
                ['ge.X sol', domeX2.geX,                       '#f3b230', false],
                ['ge.Y mt',  domeX2.geY,                       '#2E9E5B', false],
                ['ge.Z sky', domeX2.geZ,                       '#1F7FB8', false],
                ['ge.W ln',  domeX2.geW,                       '#E5322B', false],
                ['kick',     domeX2.kick,                      '#FF9A1F', false],
                ['portalTan',domeX2.portalTan,                 '#889',    false],
              ] as [string, number|string, string, boolean][]).map(([label, val, color, isStr]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ ...NOTE, width: 58, textAlign: 'right', flexShrink: 0 }}>{label}</span>
                  {isStr
                    ? <span style={{ color, fontSize: 10, fontFamily: 'monospace' }}>{val as string}</span>
                    : <>
                        <div style={{ flex: 1, background: '#2a2a2a', height: 6, borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min((val as number) * 100, 100).toFixed(1)}%`, height: '100%', background: color as string, transition: 'width 0.1s' }} />
                        </div>
                        <span style={{ ...NOTE, width: 32 }}>{(val as number).toFixed(3)}</span>
                      </>
                  }
                </div>
              ))}
              {/* Vectores del portal */}
              <div style={{ ...NOTE, marginTop: 6, marginBottom: 2 }}>portal F/R/U (deben ser ortonormales, sin NaN):</div>
              {([
                ['F', domeX2.pFX, domeX2.pFY, domeX2.pFZ],
                ['R', domeX2.pRX, domeX2.pRY, domeX2.pRZ],
                ['U', domeX2.pUX, domeX2.pUY, domeX2.pUZ],
              ] as [string, number, number, number][]).map(([n, x, y, z]) => (
                <div key={n} style={{ display: 'flex', gap: 4, marginBottom: 2, alignItems: 'center' }}>
                  <span style={{ ...NOTE, width: 10 }}>{n}:</span>
                  {[x, y, z].map((v, i) => (
                    <span key={i} style={{ ...NOTE, width: 46, color: !isFinite(v) ? '#f33' : '#889' }}>
                      {!isFinite(v) ? 'NaN' : v.toFixed(3)}
                    </span>
                  ))}
                  <span style={{ ...NOTE, color: Math.abs(Math.sqrt(x*x+y*y+z*z) - 1) < 0.01 ? '#4c4' : '#f33' }}>
                    |v|={Math.sqrt(x*x+y*y+z*z).toFixed(3)}
                  </span>
                </div>
              ))}
              {/* Texturas */}
              <div style={{ ...NOTE, marginTop: 6, marginBottom: 2 }}>texturas cargadas:</div>
              <div style={{ ...NOTE, color: domeX2.masksW > 0 ? '#4c4' : '#f33' }}>
                masks: {domeX2.masksW}×{domeX2.masksH} cs={domeX2.masksCS || '—'}
              </div>
              <div style={{ ...NOTE, color: domeX2.colorW > 0 ? '#4c4' : '#f33' }}>
                color: {domeX2.colorW}×{domeX2.colorH} cs={domeX2.colorCS || '—'}
              </div>
            </div>
          )}

          <div style={DIVIDER} />
          <span style={LABEL}>U2 — AGC + amplitudes <span style={NOTE}>(live)</span></span>
          <NumField label="agcFloorRise"   value={sillas.agcFloorRise}   step={0.1}  min={0}    max={5}     note="live"
            onChange={v => { DBG_SILLAS.agcFloorRise   = v; setSillas(s => ({ ...s, agcFloorRise:   v })); }} />
          <NumField label="agcCeilDecayS"  value={sillas.agcCeilDecayS}  step={0.5}  min={0.5}  max={20}    note="live"
            onChange={v => { DBG_SILLAS.agcCeilDecayS  = v; setSillas(s => ({ ...s, agcCeilDecayS:  v })); }} />
          <NumField label="agcPow"         value={sillas.agcPow}         step={0.05} min={0.1}  max={2}     note="live"
            onChange={v => { DBG_SILLAS.agcPow         = v; setSillas(s => ({ ...s, agcPow:         v })); }} />
          <NumField label="agcEpsilon"     value={sillas.agcEpsilon}     step={0.001} min={0.001} max={0.1}  note="live"
            onChange={v => { DBG_SILLAS.agcEpsilon     = v; setSillas(s => ({ ...s, agcEpsilon:     v })); }} />
          <NumField label="agcAttackMs"    value={sillas.agcAttackMs}    step={5}    min={5}    max={500}   note="live"
            onChange={v => { DBG_SILLAS.agcAttackMs    = v; setSillas(s => ({ ...s, agcAttackMs:    v })); }} />
          <NumField label="agcReleaseMs"   value={sillas.agcReleaseMs}   step={10}   min={10}   max={2000}  note="live"
            onChange={v => { DBG_SILLAS.agcReleaseMs   = v; setSillas(s => ({ ...s, agcReleaseMs:   v })); }} />
          <NumField label="u2SunRingBoost" value={sillas.u2SunRingBoost} step={0.02} min={0}    max={1}     note="live"
            onChange={v => { DBG_SILLAS.u2SunRingBoost = v; setSillas(s => ({ ...s, u2SunRingBoost: v })); }} />
          <NumField label="u2SunDiscBoost" value={sillas.u2SunDiscBoost} step={0.02} min={0}    max={1}     note="live"
            onChange={v => { DBG_SILLAS.u2SunDiscBoost = v; setSillas(s => ({ ...s, u2SunDiscBoost: v })); }} />
          <NumField label="u2SunCoreBoost" value={sillas.u2SunCoreBoost} step={0.02} min={0}    max={1}     note="live"
            onChange={v => { DBG_SILLAS.u2SunCoreBoost = v; setSillas(s => ({ ...s, u2SunCoreBoost: v })); }} />
          <NumField label="u2StarScaleBoost" value={sillas.u2StarScaleBoost} step={0.05} min={0} max={3}    note="live"
            onChange={v => { DBG_SILLAS.u2StarScaleBoost = v; setSillas(s => ({ ...s, u2StarScaleBoost: v })); }} />
          <NumField label="u2KickScale"    value={sillas.u2KickScale}    step={0.01} min={0}    max={0.5}   note="live"
            onChange={v => { DBG_SILLAS.u2KickScale    = v; setSillas(s => ({ ...s, u2KickScale:    v })); }} />
          <div style={ROW}>
            <span>showU2Meters</span>
            <button style={INPUT} onClick={() => {
              const v = !sillas.showU2Meters;
              DBG_SILLAS.showU2Meters = v;
              setSillas(s => ({ ...s, showU2Meters: v }));
            }}>{sillas.showU2Meters ? "ON" : "off"}</button>
          </div>
          {sillas.showU2Meters && <AudioU2Meters />}

          <div style={DIVIDER} />
          <span style={LABEL}>Debug overlays <span style={NOTE}>(R1 — prism / audio / fx)</span></span>
          <div style={ROW}>
            <span>debugOverlays</span>
            <button style={INPUT} onClick={() => {
              const v = !sillas.debugOverlays;
              DBG_SILLAS.debugOverlays = v;
              setSillas(s => ({ ...s, debugOverlays: v }));
            }}>{sillas.debugOverlays ? "ON" : "off"}</button>
          </div>

          <div style={DIVIDER} />
          <span style={LABEL}>Post-proceso R4 <span style={NOTE}>(CRT + bloom — live)</span></span>
          <div style={ROW}>
            <span>enabled</span>
            <button style={INPUT} onClick={() => {
              const v = !retroFx.enabled;
              DBG_RETRO_FX.enabled = v;
              RETRO_FLAGS.enabled  = v;
              setRetroFx(r => ({ ...r, enabled: v }));
            }}>{retroFx.enabled ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>comfortMode</span>
            <button style={INPUT} onClick={() => {
              const v = !retroFx.comfortMode;
              DBG_RETRO_FX.comfortMode  = v;
              RETRO_FLAGS.comfortMode   = v;
              setRetroFx(r => ({ ...r, comfortMode: v }));
            }}>{retroFx.comfortMode ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>crtUniformsVivos <span style={NOTE}>G2 todos los uniforms del CRT · recargar</span></span>
            <button style={INPUT} onClick={() => {
              const v = !retroFx.crtUniformsVivos;
              DBG_RETRO_FX.crtUniformsVivos = v;
              setRetroFx(r => ({ ...r, crtUniformsVivos: v }));
            }}>{retroFx.crtUniformsVivos ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>quality</span>
            <select style={{ ...INPUT, width: 90 }} value={retroFx.quality} onChange={e => {
              const v = e.target.value as "low" | "medium" | "high";
              DBG_RETRO_FX.quality = v;
              RETRO_FLAGS.quality  = v;
              setRetroFx(r => ({ ...r, quality: v }));
            }}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </div>
          <NumField label="crtCurveFX"   value={retroFx.crtCurveFX}   step={0.005} min={0}    max={0.3}  note="live"
            onChange={v => { DBG_RETRO_FX.crtCurveFX  = v; CRT_UNIFORMS.uCurve.value     = v; setRetroFx(r => ({ ...r, crtCurveFX:   v })); }} />
          <NumField label="crtScanFX"    value={retroFx.crtScanFX}    step={0.01}  min={0}    max={1}    note="live"
            onChange={v => { DBG_RETRO_FX.crtScanFX   = v; CRT_UNIFORMS.uScan.value      = v; setRetroFx(r => ({ ...r, crtScanFX:    v })); }} />
          <NumField label="crtScanCount" value={retroFx.crtScanCount} step={10}    min={60}   max={1080} note="live"
            onChange={v => { DBG_RETRO_FX.crtScanCount = v; CRT_UNIFORMS.uScanCount.value = v; setRetroFx(r => ({ ...r, crtScanCount: v })); }} />
          <NumField label="crtCA"        value={retroFx.crtCA}        step={0.0001} min={0}   max={0.01} note="live"
            onChange={v => { DBG_RETRO_FX.crtCA        = v; CRT_UNIFORMS.uCA.value        = v; setRetroFx(r => ({ ...r, crtCA:        v })); }} />
          <NumField label="crtGrain"     value={retroFx.crtGrain}     step={0.005} min={0}    max={0.3}  note="live"
            onChange={v => { DBG_RETRO_FX.crtGrain     = v; CRT_UNIFORMS.uGrain.value     = v; setRetroFx(r => ({ ...r, crtGrain:     v })); }} />
          <NumField label="crtVig"       value={retroFx.crtVig}       step={0.01}  min={0}    max={1}    note="live"
            onChange={v => { DBG_RETRO_FX.crtVig       = v; CRT_UNIFORMS.uVig.value       = v; setRetroFx(r => ({ ...r, crtVig:       v })); }} />
          <NumField label="crtWobble"    value={retroFx.crtWobble}    step={0.0001} min={0}   max={0.005} note="live"
            onChange={v => { DBG_RETRO_FX.crtWobble    = v; CRT_UNIFORMS.uWobble.value    = v; setRetroFx(r => ({ ...r, crtWobble:    v })); }} />
          <NumField label="toneExposure" value={retroFx.toneExposure} step={0.05}  min={0.2}  max={2}    note="live"
            onChange={v => { DBG_RETRO_FX.toneExposure = v; setRetroFx(r => ({ ...r, toneExposure: v })); }} />
          <NumField label="hazStripeM"     value={retroFx.hazStripeM}     step={0.005} min={0.01} max={0.5}  note="live"
            onChange={v => { DBG_RETRO_FX.hazStripeM     = v; setRetroFx(r => ({ ...r, hazStripeM:     v })); }} />
          <NumField label="hazStripeWidth" value={retroFx.hazStripeWidth} step={0.01}  min={0}    max={1}    note="live"
            onChange={v => { DBG_RETRO_FX.hazStripeWidth = v; setRetroFx(r => ({ ...r, hazStripeWidth: v })); }} />
          <NumField label="hazStripeSpeed" value={retroFx.hazStripeSpeed} step={0.01}  min={0}    max={1}    note="live"
            onChange={v => { DBG_RETRO_FX.hazStripeSpeed = v; setRetroFx(r => ({ ...r, hazStripeSpeed: v })); }} />
          <NumField label="hazStripeBoost" value={retroFx.hazStripeBoost} step={0.1}   min={0}    max={10}   note="live"
            onChange={v => { DBG_RETRO_FX.hazStripeBoost = v; setRetroFx(r => ({ ...r, hazStripeBoost: v })); }} />
          <NumField label="bloomThreshold" value={retroFx.bloomThreshold} step={0.01} min={0}    max={1}    note="live"
            onChange={v => { DBG_RETRO_FX.bloomThreshold = v; setRetroFx(r => ({ ...r, bloomThreshold: v })); }} />
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
