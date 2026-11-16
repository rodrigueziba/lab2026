"use client";
// Z70: pestaña "Rendimiento" del menú de debug. Cada sección es el código movido tal cual desde DebugMenu.tsx;
// toma del contexto (useDbg) solo el estado que usa. Registro y orden: lib/debugSecciones.ts.
import RendimientoPanel from "@/components/RendimientoPanel";
import { DBG_RETRO_FX } from "@/lib/debugConfig";
import { RETRO_FLAGS } from "@/lib/retro/retroFlags";
import { CRT_UNIFORMS } from "@/lib/retro/retroCRT";
import { LABEL, ROW, INPUT, NOTE, NumField } from "../comun";
import { useDbg } from "../contexto";

// sección: rendimiento-z66
export function SecRendimientoZ66() {
  return (
    <>
          {/* Z66: rendimiento (medición, sistemas, DPR adaptativo, optimización del pasto, benchmark) */}
          <RendimientoPanel />
    </>
  );
}

// sección: post-proceso-r4
export function SecPostProcesoR4() {
  const { retroFx, setRetroFx } = useDbg();
  return (
    <>
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
  );
}
