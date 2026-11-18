"use client";
// Z70: pestaña "Visualizador y música" del menú de debug. Cada sección es el código movido tal cual desde DebugMenu.tsx;
// toma del contexto (useDbg) solo el estado que usa. Registro y orden: lib/debugSecciones.ts.
import { useEffect, useState } from "react";
import { DBG_SILLAS, DBG_DOMO_VIVO, DBG_RENDIMIENTO } from "@/lib/debugConfig";
import { textoEstadoDomoVivo } from "@/lib/domoVivoAcciones";   // Z83
import { simularSesionEnVivo, quitarSesion } from "@/lib/monolitosVivoAcciones";   // Z82
import { BAND_STATE, reshuffleAssignment } from "@/lib/vizAudio";
import { LABEL, ROW, INPUT, NOTE, NumField, BandEnergyOverlay, AudioU2Meters } from "../comun";
import { useDbg } from "../contexto";

// sección: simbolos-n3
export function SecSimbolosN3() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
          <span style={LABEL}>Símbolos N3 <span style={NOTE}>(live)</span></span>
          <NumField label="symbolRadiusM" value={sillas.symbolRadiusM} step={0.1} min={0.1} max={5} note="live"
            onChange={v => { DBG_SILLAS.symbolRadiusM = v; setSillas(s => ({ ...s, symbolRadiusM: v })); }} />
          <NumField label="symbolPeriodS" value={sillas.symbolPeriodS} step={0.1} min={0.5} max={10} note="live"
            onChange={v => { DBG_SILLAS.symbolPeriodS = v; setSillas(s => ({ ...s, symbolPeriodS: v })); }} />
          <NumField label="symbolLineWidthM" value={sillas.symbolLineWidthM} step={0.005} min={0.005} max={0.3} note="live"
            onChange={v => { DBG_SILLAS.symbolLineWidthM = v; setSillas(s => ({ ...s, symbolLineWidthM: v })); }} />
    </>
  );
}

// sección: audio-bandas-n4
export function SecAudioBandasN4() {
  const { sillas, setSillas, bandRev, setBandRev } = useDbg();
  return (
    <>
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
    </>
  );
}

// sección: reaccion-t3-audio
export function SecReaccionT3Audio() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
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
    </>
  );
}

// sección: u10b-reaccion-al-sonido
export function SecU10bReaccionAlSonido() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
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
    </>
  );
}

// sección: u11-camera-feedback
export function SecU11CameraFeedback() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
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
    </>
  );
}

// sección: u2-agc-amplitudes
export function SecU2AgcAmplitudes() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
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
    </>
  );
}

// sección: domo-vivo-z83
export function SecDomoVivoZ83() {
  // Z83: el domo muestra la sesión en vivo de la tarima (o estática) según el peso del monolito de video (Z82).
  const D = DBG_DOMO_VIVO;
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => (t + 1) % 1e6), 250); return () => clearInterval(id); }, []);
  const toca = () => setTick(t => (t + 1) % 1e6);
  const forzar = (m: string) => { D.FORZAR = m; toca(); };
  return (
    <>
          <span style={LABEL}>Domo con la sesión en vivo Z83 <span style={NOTE}>(live · mezcla = peso del monolito de video)</span></span>
          <div style={{ ...ROW, ...NOTE }}><span>{textoEstadoDomoVivo()}</span></div>
          <div style={ROW}>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); forzar("video"); }}>Forzar video 100 %</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); forzar("estatica"); }}>Forzar estática 100 %</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); forzar("apagar"); }}>Apagar</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); forzar("ninguno"); }}>Normal (monolito)</button>
          </div>
          <div style={ROW}>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); simularSesionEnVivo(); toca(); }}>Simular sesión en vivo</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); quitarSesion(); toca(); }}>Quitar sesión</button>
          </div>
          <div style={ROW}>
            <span>ACTIVO <span style={NOTE}>off = domo como estaba</span></span>
            <button style={INPUT} onClick={() => { D.ACTIVO = !D.ACTIVO; toca(); }}>{D.ACTIVO ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>videoDomo (benchmark) <span style={NOTE}>off = mezcla 0</span></span>
            <button style={INPUT} onClick={() => { DBG_RENDIMIENTO.SIS.videoDomo = DBG_RENDIMIENTO.SIS.videoDomo === false; toca(); }}>{DBG_RENDIMIENTO.SIS.videoDomo !== false ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>COBERTURA</span>
            {(["banda", "sector"] as const).map(v => (
              <button key={v} style={{ ...INPUT, opacity: D.COBERTURA === v ? 1 : 0.5 }} onClick={() => { D.COBERTURA = v; toca(); }}>{v}</button>
            ))}
          </div>
          {([
            ["REPETICIONES", 1, 12, 1, "imágenes (banda)"], ["SECTOR_ANCHO_DEG", 10, 180, 1, "° (sector)"], ["SECTOR_DESPLAZ_DEG", -180, 180, 1, "°"],
            ["ELEV_CENTRO_DEG", 0, 60, 0.5, "°"], ["ASPECTO", 1, 2.4, 0.01, "(16:9 = 1,78)"], ["BORDE", 0, 0.3, 0.005, ""], ["FONDO", 0, 1, 0.01, "visualizador apagado alrededor"],
            ["FPS", 1, 30, 1, "video de prueba"], ["ESTATICA_INTENSIDAD", 0, 1.5, 0.01, ""], ["ESTATICA_GRANO", 16, 400, 1, "filas"], ["ESTATICA_VELOCIDAD", 1, 60, 1, "cuadros/s"],
          ] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{D[k].toFixed(st < 0.1 ? 2 : st < 1 ? 1 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={D[k]} onChange={ev => { D[k] = parseFloat(ev.target.value); toca(); }} />
            </div>
          ))}
    </>
  );
}
