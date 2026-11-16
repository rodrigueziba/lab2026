"use client";
// Z70: pestaña "Composición (portal y fluido)" del menú de debug. Cada sección es el código movido tal cual desde DebugMenu.tsx;
// toma del contexto (useDbg) solo el estado que usa. Registro y orden: lib/debugSecciones.ts.
import { DBG_SILLAS, DBG_FLUIDO, DBG_PORTAL, DBG_DIA, DBG_DOME_FORCE } from "@/lib/debugConfig";
import { setVizVolume, restartVizAudio } from "@/lib/vizAudio";
import { activateVisualizerOnce, resetVizActivated } from "@/lib/alightStore";
import { FLUIDO_DEFAULTS, LABEL, ROW, INPUT, NOTE, DIVIDER, NumField, ColorField } from "../comun";
import { useDbg } from "../contexto";

// sección: dome-visualizer
export function SecDomeVisualizer() {
  const { sillas, setSillas, setBigMeshList, setMeshHidden, bigMeshList, meshHidden } = useDbg();
  return (
    <>
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
    </>
  );
}

// sección: fluir-de-color-z61
export function SecFluirDeColorZ61() {
  const { tocarDia, fluLive } = useDbg();
  return (
    <>
          {/* Z61: fluir de color de los bloques de la composición */}
          <span style={LABEL}>Fluir de color Z61 <span style={NOTE}>(azul = cordilleras / MONTAÑAS · naranja = olas cálidas / LÍNEAS · live)</span></span>
          {(["ACTIVO", "SIMULAR_AZUL", "SIMULAR_NARANJA"] as const).map(k => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{k === "ACTIVO" ? "off = como antes" : "música simulada"}</span></span>
              <button style={INPUT} onClick={() => { DBG_FLUIDO[k] = !DBG_FLUIDO[k]; tocarDia(); }}>{DBG_FLUIDO[k] ? "ON" : "off"}</button>
            </div>
          ))}
          {([
            ["MEZCLA_AZUL", 0, 1, 0.01, ""], ["MEZCLA_NARANJA", 0, 1, 0.01, ""], ["ESCALA", 0.5, 10, 0.1, "manchas"], ["VEL_BASE", 0, 0.5, 0.005, "deriva"],
            ["ACELERA", 0, 8, 0.1, "× energía"], ["WARP", 0, 4, 0.05, ""], ["LUZ_FLUJO", 0, 1, 0.01, ""], ["PULSO_LUZ", 0, 1.5, 0.01, "música"],
            ["MUSICA_AZUL", 0, 3, 0.05, "ganancia"], ["MUSICA_NARANJA", 0, 3, 0.05, "ganancia"], ["SUAVIZADO_S", 0.02, 2, 0.02, "s"], ["CALIDAD", 2, 4, 1, "octavas"],
            ["ESCALA_Y", 0.5, 8, 0.1, "Z63"], ["RANGO_MIN", 0, 0.6, 0.01, "Z63 fbm"], ["RANGO_MAX", 0.4, 1, 0.01, "Z63 fbm"], ["DETALLE_MIN", 0, 1, 0.01, "Z63"],
            ["DETALLE_MAX", 1, 3, 0.05, "Z63"], ["TOPE", 0.3, 1, 0.01, "Z65 0,55 · bloom 0,92"], ["DIA_ATENUA", 0, 1, 0.01, "Z65 claros de día"], ["LUM_MEDIA_AZUL", 0.05, 0.6, 0.005, "Z63"], ["LUM_MEDIA_NARANJA", 0.05, 0.6, 0.005, "Z63"], ["MAX_S", 1, 30, 0.5, "Z63 s"], ["ATAQUE_S", 0.01, 0.5, 0.01, "Z63 s"], ["PISO", 0.001, 0.2, 0.001, "Z63"],
          ] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{DBG_FLUIDO[k].toFixed(st < 0.01 ? 3 : 2)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={DBG_FLUIDO[k]}
                onChange={e => { DBG_FLUIDO[k] = parseFloat(e.target.value); tocarDia(); }} />
            </div>
          ))}
          {/* Z65: modo del tope del color fluido */}
          <div style={ROW}>
            <span>TOPE_MODO <span style={NOTE}>tono = conserva el color · canal = Z63</span></span>
            {(["tono", "canal"] as const).map(m => (
              <button key={m} style={{ ...INPUT, width: "auto", padding: "0 4px", opacity: DBG_FLUIDO.TOPE_MODO === m ? 1 : 0.45 }}
                onClick={() => { DBG_FLUIDO.TOPE_MODO = m; tocarDia(); }}>{m}</button>
            ))}
          </div>
          {/* Z63: energía que llega a cada bloque (barra), banda de cada uno y prueba rápida */}
          {([["azul", fluLive.a, fluLive.ba, "BANDA_AZUL"], ["naranja", fluLive.n, fluLive.bn, "BANDA_NARANJA"]] as const).map(([nom, e, b, k]) => (
            <div key={nom} style={ROW}>
              <span>{nom} <span style={NOTE}>banda {b} · {e.toFixed(2)}</span></span>
              <div style={{ flex: 1, height: 8, background: "#333", position: "relative" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.round(e * 100)}%`, background: nom === "azul" ? "#2A9D9A" : "#F0742A" }} />
              </div>
              {(["auto", "grupo", "0", "1", "2", "3"] as const).map(m => (
                <button key={m} style={{ ...INPUT, width: "auto", padding: "0 4px", opacity: DBG_FLUIDO[k] === m ? 1 : 0.45 }}
                  onClick={() => { DBG_FLUIDO[k] = m; tocarDia(); }}>{m}</button>
              ))}
            </div>
          ))}
          <div style={ROW}>
            <button style={INPUT} onClick={() => { Object.assign(DBG_FLUIDO, { MEZCLA_AZUL: 1, MEZCLA_NARANJA: 1, WARP: 2.5, VEL_BASE: 0.3, PULSO_LUZ: 1 }); tocarDia(); }}>Exagerar efecto (probar)</button>
            <button style={INPUT} onClick={() => { Object.assign(DBG_FLUIDO, FLUIDO_DEFAULTS); tocarDia(); }}>Volver a defaults</button>
          </div>
          {(["PALETA_AZUL", "PALETA_NARANJA"] as const).map(k => (
            <div key={k} style={ROW}>
              <span>{k}</span>
              {DBG_FLUIDO[k].map((c, i) => (
                <input key={i} type="color" value={c} style={{ width: 28, height: 20, padding: 0, border: "none" }}
                  onChange={e => { DBG_FLUIDO[k][i] = e.target.value.toUpperCase(); tocarDia(); }} />
              ))}
            </div>
          ))}
    </>
  );
}

// sección: composicion-del-domo-z49
export function SecComposicionDelDomoZ49() {
  const { tocarDia, ejeLive } = useDbg();
  return (
    <>
          <span style={LABEL}>Composición del domo Z49 <span style={NOTE}>(escala y tinte del cielo · live)</span></span>
          <div style={ROW}>
            <span>ANILLOS_EN_EJE <span style={NOTE}>Z57 · círculo y anillos centrados en el pico (SUN_C.x)</span></span>
            <button style={INPUT} onClick={() => { DBG_PORTAL.ANILLOS_EN_EJE = !DBG_PORTAL.ANILLOS_EN_EJE; tocarDia(); }}>{DBG_PORTAL.ANILLOS_EN_EJE ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>OVERLAY_EJE <span style={NOTE}>Z50 · eje del sol en pantalla (con el menú abierto)</span></span>
            <button style={INPUT} onClick={() => { DBG_PORTAL.OVERLAY_EJE = !DBG_PORTAL.OVERLAY_EJE; tocarDia(); }}>{DBG_PORTAL.OVERLAY_EJE ? "ON" : "off"}</button>
          </div>
          {DBG_PORTAL.OVERLAY_EJE && (
            <div style={{ position: "fixed", left: "50%", bottom: 12, transform: "translateX(-50%)", zIndex: 9998, pointerEvents: "none",
              background: "rgba(0,0,0,0.72)", color: "#FF9A1F", font: "13px monospace", padding: "4px 10px", borderRadius: 4 }}>
              {ejeLive}
            </div>
          )}
          {([
            ["ESCALA", 0.6, 1.8, 0.01, "apoyada en el horizonte"], ["TINTE_BORDE", 0, 1, 0.01, "0 = color fijo"],
            ["TINTE_ANILLOS", 0, 1, 0.01, ""], ["TINTE_INTERIOR", 0, 1, 0.01, "velo"], ["BORDE_SUAVE", 0, 1, 0.01, "feather"],
            ["BORDE_ANCHO", 0.02, 0.6, 0.01, "Z50 × radio"], ["DEBUG_CAPAS", 0, 1, 1, "Z50 color falso"],
          ] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{DBG_PORTAL[k].toFixed(2)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={DBG_PORTAL[k]}
                onChange={e => { DBG_PORTAL[k] = parseFloat(e.target.value); tocarDia(); }} />
            </div>
          ))}
          {(["ALBA", "SALIDA", "MEDIODIA", "ATARDECER", "CREPUSCULO"] as const).map(k => (
            <div key={k} style={ROW}>
              <span>KEYS.{k} <span style={NOTE}>{DBG_DIA.KEYS[k].toFixed(3)}</span></span>
              <input type="range" min={0.01} max={0.99} step={0.005} style={{ flex: 1 }} value={DBG_DIA.KEYS[k]}
                onChange={e => { DBG_DIA.KEYS[k] = parseFloat(e.target.value); tocarDia(); }} />
            </div>
          ))}
          {(["noche", "alba", "salida", "mediodia", "atardecer", "crepusculo"] as const).map(et => (
            <div key={et}>
              <span style={NOTE}>{et}</span>
              {(["hor", "med", "cen", "glow"] as const).map(c => (
                <ColorField key={c} label={`${et}.${c}`} value={DBG_DIA.ETAPAS[et][c]}
                  onChange={v => { DBG_DIA.ETAPAS[et][c] = v; tocarDia(); }} />
              ))}
            </div>
          ))}
    </>
  );
}

// sección: shader-del-domo
export function SecShaderDelDomo() {
  return (
    <>
          {/* Z73: sección fusionada; cada parte es la sección anterior movida tal cual (subtítulo = su título) */}
          <span style={LABEL}>Shader del domo <span style={NOTE}>(Z73: W1, W2, W4, W5 y X2)</span></span>
          <SecW1DomoDeShader />
          <div style={DIVIDER} />
          <SecW2MultiplicadoresDeGrupo />
          <div style={DIVIDER} />
          <SecW4DomeskyAjusteDeShader />
          <div style={DIVIDER} />
          <SecW5SiluetasSuaves />
          <div style={DIVIDER} />
          <SecX2DomoDiagnostico />
    </>
  );
}

// subsección: w1-domo-de-shader
export function SecW1DomoDeShader() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
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
    </>
  );
}

// subsección: w2-multiplicadores-de-grupo
export function SecW2MultiplicadoresDeGrupo() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
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
    </>
  );
}

// subsección: w4-domesky-ajuste-de-shader
export function SecW4DomeskyAjusteDeShader() {
  const { sillas, setSillas, domeM } = useDbg();
  return (
    <>
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
    </>
  );
}

// subsección: w5-siluetas-suaves
export function SecW5SiluetasSuaves() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
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
    </>
  );
}

// subsección: x2-domo-diagnostico
export function SecX2DomoDiagnostico() {
  const { sillas, setSillas, domeForce, setDomeForce, domeX2 } = useDbg();
  return (
    <>
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
    </>
  );
}
