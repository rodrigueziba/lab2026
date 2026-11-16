"use client";
// Z73: pestaña "Obsoletos" del menú de debug: secciones sin efecto hoy o de código viejo detrás de flags. Se movieron
// tal cual desde sus pestañas (no se borra nada); van plegadas y con el flag que las apaga (lib/debugSecciones.ts).
import { DBG_SILLAS, DBG_FLOOR, DBG_EFFECTS, DBG_PRISM } from "@/lib/debugConfig";
import { activateVisualizerOnce, resetVizActivated } from "@/lib/alightStore";
import { LABEL, ROW, INPUT, NOTE, DIVIDER, NumField } from "../comun";
import { useDbg } from "../contexto";

// sección: panorama-svg
export function SecPanoramaSvg() {
  return (
    <>
          {/* Z73: sección fusionada; cada parte es la sección anterior movida tal cual (subtítulo = su título) */}
          <span style={LABEL}>Panorama SVG (apagado) <span style={NOTE}>(Z73: T2, U4 SOL / MONTAÑAS / CIELO / LÍNEAS, U5, U7, U10A y AA1)</span></span>
          <SecPanoramaT2CrecimientoDeGrupos />
          <div style={DIVIDER} />
          <SecU4Sol />
          <div style={DIVIDER} />
          <SecU4Montanas />
          <div style={DIVIDER} />
          <SecU4Cielo />
          <div style={DIVIDER} />
          <SecU4Lineas />
          <div style={DIVIDER} />
          <SecU5LineasLiquidas />
          <div style={DIVIDER} />
          <SecU7CapasVisibles />
          <div style={DIVIDER} />
          <SecU10aParallaxPorCapa />
          <div style={DIVIDER} />
          <SecAa1DomoOriginal />
    </>
  );
}

// subsección: panorama-t2-crecimiento-de-grupos
export function SecPanoramaT2CrecimientoDeGrupos() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
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
    </>
  );
}

// subsección: u4-sol
export function SecU4Sol() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
          <span style={LABEL}>U4 — SOL <span style={NOTE}>(anillos desfasados)</span></span>
          <NumField label="grp0AtkMs"     value={sillas.grp0AtkMs}     step={5}    min={5}   max={500}  note="live"
            onChange={v => { DBG_SILLAS.grp0AtkMs     = v; setSillas(s => ({ ...s, grp0AtkMs:     v })); }} />
          <NumField label="grp0RelMs"     value={sillas.grp0RelMs}     step={10}   min={10}  max={2000} note="live"
            onChange={v => { DBG_SILLAS.grp0RelMs     = v; setSillas(s => ({ ...s, grp0RelMs:     v })); }} />
          <NumField label="sunRingLagMs"  value={sillas.sunRingLagMs}  step={5}    min={0}   max={200}  note="live"
            onChange={v => { DBG_SILLAS.sunRingLagMs  = v; setSillas(s => ({ ...s, sunRingLagMs:  v })); }} />
          <NumField label="sunCoreKickBrt" value={sillas.sunCoreKickBrt} step={0.05} min={0}  max={3}   note="live"
            onChange={v => { DBG_SILLAS.sunCoreKickBrt = v; setSillas(s => ({ ...s, sunCoreKickBrt: v })); }} />
    </>
  );
}

// subsección: u4-montanas
export function SecU4Montanas() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
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
    </>
  );
}

// subsección: u4-cielo
export function SecU4Cielo() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
          <span style={LABEL}>U4 — CIELO <span style={NOTE}>(centelleo)</span></span>
          <NumField label="grp2AtkMs"      value={sillas.grp2AtkMs}      step={5}    min={5}  max={500}  note="live"
            onChange={v => { DBG_SILLAS.grp2AtkMs      = v; setSillas(s => ({ ...s, grp2AtkMs:      v })); }} />
          <NumField label="grp2RelMs"      value={sillas.grp2RelMs}      step={10}   min={10} max={2000} note="live"
            onChange={v => { DBG_SILLAS.grp2RelMs      = v; setSillas(s => ({ ...s, grp2RelMs:      v })); }} />
          <NumField label="starTwinkleAmp" value={sillas.starTwinkleAmp} step={0.05} min={0}  max={2}    note="live"
            onChange={v => { DBG_SILLAS.starTwinkleAmp = v; setSillas(s => ({ ...s, starTwinkleAmp: v })); }} />
          <NumField label="starTwinkleFq"  value={sillas.starTwinkleFq}  step={0.1}  min={0}  max={10}   note="rad/s"
            onChange={v => { DBG_SILLAS.starTwinkleFq  = v; setSillas(s => ({ ...s, starTwinkleFq:  v })); }} />
    </>
  );
}

// subsección: u4-lineas
export function SecU4Lineas() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
          <span style={LABEL}>U4 — LÍNEAS <span style={NOTE}>(envelope)</span></span>
          <NumField label="grp3AtkMs" value={sillas.grp3AtkMs} step={5}  min={5}  max={500}  note="live"
            onChange={v => { DBG_SILLAS.grp3AtkMs = v; setSillas(s => ({ ...s, grp3AtkMs: v })); }} />
          <NumField label="grp3RelMs" value={sillas.grp3RelMs} step={10} min={10} max={2000} note="live"
            onChange={v => { DBG_SILLAS.grp3RelMs = v; setSillas(s => ({ ...s, grp3RelMs: v })); }} />
    </>
  );
}

// subsección: u5-lineas-liquidas
export function SecU5LineasLiquidas() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
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
    </>
  );
}

// subsección: u7-capas-visibles
export function SecU7CapasVisibles() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
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
    </>
  );
}

// subsección: u10a-parallax-por-capa
export function SecU10aParallaxPorCapa() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
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
    </>
  );
}

// subsección: aa1-domo-original
export function SecAa1DomoOriginal() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
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
    </>
  );
}

// sección: amanecer-viejo
export function SecAmanecerViejo() {
  return (
    <>
          {/* Z73: sección fusionada; cada parte es la sección anterior movida tal cual (subtítulo = su título) */}
          <span style={LABEL}>Amanecer viejo <span style={NOTE}>(Z73: U9 y W3 · con el amanecer unificado de Z38 solo conservan su fase 2 y paleta)</span></span>
          <SecU9SecuenciaAmanecer />
          <div style={DIVIDER} />
          <SecW3AmanecerDomesky />
    </>
  );
}

// subsección: u9-secuencia-amanecer
export function SecU9SecuenciaAmanecer() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
          <span style={LABEL}>U9 — Secuencia amanecer <span style={NOTE}>(debug)</span></span>
          <NumField label="amanecerDurS"       value={sillas.amanecerDurS}       step={1}    min={1}   max={60}   note="fase 1 (s) — solo modo viejo (Z38)"
            onChange={v => { DBG_SILLAS.amanecerDurS       = v; setSillas(s => ({ ...s, amanecerDurS:       v })); }} />
          <NumField label="amanecerSectorDeg"  value={sillas.amanecerSectorDeg}  step={10}   min={10}  max={360}  note="ancho sector (°)"
            onChange={v => { DBG_SILLAS.amanecerSectorDeg  = v; setSillas(s => ({ ...s, amanecerSectorDeg:  v })); }} />
          <NumField label="amanecerEdgeDeg"    value={sillas.amanecerEdgeDeg}    step={1}    min={0}   max={30}   note="borde suave (°)"
            onChange={v => { DBG_SILLAS.amanecerEdgeDeg    = v; setSillas(s => ({ ...s, amanecerEdgeDeg:    v })); }} />
          <NumField label="amanecerP2StaggerS" value={sillas.amanecerP2StaggerS} step={0.5}  min={0}   max={5}    note="retraso entre capas fase 2 (s)"
            onChange={v => { DBG_SILLAS.amanecerP2StaggerS = v; setSillas(s => ({ ...s, amanecerP2StaggerS: v })); }} />
          <NumField label="amanecerP2GrowS"    value={sillas.amanecerP2GrowS}    step={0.5}  min={0.5} max={10}   note="duración crecimiento fase 2 (s)"
            onChange={v => { DBG_SILLAS.amanecerP2GrowS    = v; setSillas(s => ({ ...s, amanecerP2GrowS:    v })); }} />
    </>
  );
}

// subsección: w3-amanecer-domesky
export function SecW3AmanecerDomesky() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
          <span style={LABEL}>W3 — Amanecer DomeSky <span style={NOTE}>(debug)</span></span>
          <NumField label="domeAmanecerDurS"    value={sillas.domeAmanecerDurS}    step={1}   min={1}   max={60}  note="fase 1 (s) — solo modo viejo (Z38)"
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
    </>
  );
}

// sección: legado
export function SecLegado() {
  const { setLegacyOpen, legacyOpen, floor, setFloor, fx, setFx } = useDbg();
  return (
    <>
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
    </>
  );
}

// sección: prism
export function SecPrism() {
  return (
    <>
          <span style={LABEL}>Prism <span style={NOTE}>(info)</span></span>
          <NumField label="landOffset (m)" value={DBG_PRISM.landOffset} note="reload to change" />
    </>
  );
}

// sección: controles-sin-efecto
export function SecControlesSinEfecto() {
  const { prism } = useDbg();
  return (
    <>
          {/* Z73: controles que ya no tienen efecto, movidos tal cual desde su sección */}
          <span style={LABEL}>Controles sin efecto <span style={NOTE}>(movidos desde su sección · no hacen nada hoy)</span></span>
          {/* desde "Prism proximity" (N2): legacy N1, ya no se aplica */}
          <NumField label="prismRangeScale" value={prism.prismRangeScale} note="legacy N1 — no longer applied" />
    </>
  );
}
