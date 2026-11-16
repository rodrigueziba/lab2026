"use client";
// Z70: pestaña "Luces y haces" del menú de debug. Cada sección es el código movido tal cual desde DebugMenu.tsx;
// toma del contexto (useDbg) solo el estado que usa. Registro y orden: lib/debugSecciones.ts.
import { DBG_SILLAS, DBG_LUCES } from "@/lib/debugConfig";
import { setHazBandOn } from "@/lib/haz";
import { LABEL, NOTE, ColorField, NumField, INPUT, ROW } from "../comun";
import { useDbg } from "../contexto";

// sección: diagonalspot
export function SecDiagonalspot() {
  const { spot, setSpotField } = useDbg();
  return (
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
    </>
  );
}
// sección: haces-n3-r2-v1
export function SecHacesN3R2V1() {
  const { sillas, setSillas, bandOnArr } = useDbg();
  return (
    <>
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
    </>
  );
}
// sección: luces-del-visualizador-z42
export function SecLucesDelVisualizadorZ42() {
  const { luc, setLuc } = useDbg();
  return (
    <>
          {/* Z42: diseño de las 4 luces del visualizador (LucesHaz, estilo luz de la narrativa) — todo en vivo */}
          <span style={LABEL}>Luces del visualizador Z42 <span style={NOTE}>(halo, cono y charco · live)</span></span>
          <div style={ROW}>
            <span>DISENO_NUEVO <span style={NOTE}>off = lámpara colgada anterior</span></span>
            <button style={INPUT} onClick={() => {
              const v = !luc.DISENO_NUEVO;
              DBG_LUCES.DISENO_NUEVO = v;
              setLuc(o => ({ ...o, DISENO_NUEVO: v }));
            }}>{luc.DISENO_NUEVO ? "ON" : "off"}</button>
          </div>
          {([
            ["HALO_M", 0.2, 6, 0.05, "m"], ["CONO_RADIO_M", 0.2, 4, 0.05, "m"], ["CONO_OPACIDAD", 0, 1, 0.01, ""],
            ["POZO_OPACIDAD", 0, 1.5, 0.01, ""], ["INT_ENCENDIDA", 0, 5, 0.05, ""], ["INT_APAGADA", 0, 2, 0.01, ""],
            ["APAGADA_CONO", 0, 1, 0.01, "× apagada"], ["REACT_INT", 0, 4, 0.05, "música"], ["REACT_HALO", 0, 2, 0.05, "música"],
            ["REACT_CONO", 0, 4, 0.05, "música"], ["REACT_RADIO", 0, 1, 0.01, "música"], ["ATAQUE_S", 0.01, 1, 0.01, "s"], ["CAIDA_S", 0.02, 2, 0.01, "s"],
          ] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{luc[k].toFixed(2)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={luc[k]}
                onChange={e => { const v = parseFloat(e.target.value); DBG_LUCES[k] = v; setLuc(o => ({ ...o, [k]: v })); }} />
            </div>
          ))}
          {[0, 1, 2, 3].map(i => (
            <div key={i}>
              <span style={NOTE}>luz {i} ({["SOL", "MONTAÑAS", "CIELO", "LÍNEAS"][i]}) · multiplicadores</span>
              {(["HALO_X", "RADIO_X", "CONO_X", "POZO_X"] as const).map(k => (
                <div key={k} style={ROW}>
                  <span>{k}[{i}] <span style={NOTE}>{luc[k][i].toFixed(2)}</span></span>
                  <input type="range" min={0} max={3} step={0.05} style={{ flex: 1 }} value={luc[k][i]}
                    onChange={e => { const v = parseFloat(e.target.value); DBG_LUCES[k][i] = v; setLuc(o => ({ ...o, [k]: [...DBG_LUCES[k]] })); }} />
                </div>
              ))}
            </div>
          ))}
    </>
  );
}
// sección: u6a-anillos-en-piso
export function SecU6aAnillosEnPiso() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
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
    </>
  );
}
// sección: u6b-destello-del-haz
export function SecU6bDestelloDelHaz() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
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
    </>
  );
}