"use client";
// Z70: pestaña "Pasto y monolitos" del menú de debug. Cada sección es el código movido tal cual desde DebugMenu.tsx;
// toma del contexto (useDbg) solo el estado que usa. Registro y orden: lib/debugSecciones.ts.
import { DBG_SILLAS, DBG_PASTO } from "@/lib/debugConfig";
import { MONO_PASTO } from "@/lib/monolitosPasto";
import { LABEL, NOTE, NumField, N5ProximityOverlay, ROW, INPUT } from "../comun";
import { useDbg } from "../contexto";

// sección: monolitos-n5-v1-v2-v3
export function SecMonolitosN5V1V2V3() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
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
    </>
  );
}
// sección: pasto-z64
export function SecPastoZ64() {
  const { pastoLive, tocarDia } = useDbg();
  return (
    <>
          {/* Z64: pasto bajo las luces */}
          <span style={LABEL}>Pasto Z64 <span style={NOTE}>(bajo las 4 luces · live)</span></span>
          <div style={ROW}><span style={NOTE}>p {pastoLive}</span></div>
          {(["ACTIVO", "MONOLITOS_ACTIVO", "OVERLAY"] as const).map(k => (
            <div key={k} style={ROW}>
              <span>{k}</span>
              <button style={INPUT} onClick={() => { DBG_PASTO[k] = !DBG_PASTO[k]; tocarDia(); }}>{DBG_PASTO[k] ? "ON" : "off"}</button>
            </div>
          ))}
          {([
            ["MARGEN_M", 0, 8, 0.1, "m"], ["RADIO_LUZ_M", 0.3, 4, 0.05, "m"], ["CRECE_S", 1, 60, 0.5, "s"], ["DECAE_S", 1, 60, 0.5, "s"],
            ["IRREGULARIDAD", 0, 1, 0.01, ""], ["ESCALA_MANCHA_M", 0.2, 6, 0.05, "m"], ["FRENTE_ANCHO", 0.02, 0.6, 0.01, ""], ["CAPAS", 8, 40, 1, ""],
            ["ALTURA_M", 0.05, 1.2, 0.01, "m"], ["DENSIDAD", 20, 300, 1, "texels/m"], ["VIENTO_AMP", 0, 3, 0.05, ""], ["VIENTO_VEL", 0, 2, 0.01, ""],
            ["DARKNESS", 0, 1, 0.01, ""], ["PUNTAS_TINTE", 0, 1, 0.01, ""], ["BRILLO", 0, 3, 0.05, ""], ["TINTE_LUZ", 0, 1, 0.01, ""],
            ["CAIDA_LUZ_M", 0.5, 30, 0.5, "m"], ["DIST_MAX_M", 5, 80, 1, "m"],
            ["MONOLITO_SEP_M", 0, 6, 0.05, "m libres (Z65)"], ["MONOLITOS_APARICION_S", 0.1, 10, 0.1, "s subida (Z65)"], ["MONOLITOS_BAJADA_S", 0, 10, 0.1, "s · 0 = con el pasto (Z65)"],
          ] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{DBG_PASTO[k].toFixed(st < 0.1 ? 2 : 1)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={DBG_PASTO[k]}
                onChange={e => { DBG_PASTO[k] = parseFloat(e.target.value); tocarDia(); }} />
            </div>
          ))}
          <div style={ROW}>
            {[0, 1, 2, 3].map(i => (
              <button key={i} style={INPUT} onClick={() => window.dispatchEvent(new CustomEvent("alight:pasto-crecer", { detail: { cuarto: i } }))}>Crecer cuarto {i + 1}</button>
            ))}
          </div>
          <div style={ROW}>
            <button style={INPUT} onClick={() => window.dispatchEvent(new CustomEvent("alight:pasto-completar"))}>Completar todo</button>
            <button style={INPUT} onClick={() => window.dispatchEvent(new CustomEvent("alight:pasto-reiniciar"))}>Reiniciar pasto</button>
          </div>
          {/* Z65: monolitos que aparecen al completar los 4 cuartos */}
          <div style={ROW}>
            <span>MONOLITOS_MODO <span style={NOTE}>x ±{Math.abs(MONO_PASTO.xR).toFixed(2)} · z {MONO_PASTO.z.toFixed(2)} · aparición {MONO_PASTO.k.toFixed(2)}</span></span>
            {(["pasto", "siempre", "nunca"] as const).map(m => (
              <button key={m} style={{ ...INPUT, width: "auto", padding: "0 4px", opacity: DBG_PASTO.MONOLITOS_MODO === m ? 1 : 0.45 }}
                onClick={() => { DBG_PASTO.MONOLITOS_MODO = m; tocarDia(); }}>{m}</button>
            ))}
          </div>
          <div style={ROW}>
            <span>Simular presencia</span>
            {[-1, 0, 1, 2, 3].map(i => (
              <button key={i} style={{ ...INPUT, opacity: DBG_PASTO.SIMULAR === i ? 1 : 0.45 }} onClick={() => { DBG_PASTO.SIMULAR = i; tocarDia(); }}>{i < 0 ? "no" : `luz ${i + 1}`}</button>
            ))}
          </div>
    </>
  );
}