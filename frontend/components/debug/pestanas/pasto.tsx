"use client";
// Z70: pestaña "Pasto y monolitos" del menú de debug. Cada sección es el código movido tal cual desde DebugMenu.tsx;
// toma del contexto (useDbg) solo el estado que usa. Registro y orden: lib/debugSecciones.ts.
import { useEffect, useState } from "react";
import { DBG_SILLAS, DBG_PASTO, DBG_MONO_VIVO, DBG_AVISO_VIVO, DBG_VIVO, DBG_LIVEKIT_RECIBIR } from "@/lib/debugConfig";
import { publicarPresencia, detenerPresencia, textoEstadoVivo, textoEstadoRecepcion, reintentarLiveKit, reintentarPresencia } from "@/lib/vivo/vivoAcciones";   // Z89 · Z93 · Z95
import { mostrarAvisoAhora, reiniciarDecisionAviso, textoEstadoAviso } from "@/lib/avisoVivoAcciones";   // Z85
import { simularSesionEnVivo, quitarSesion, forzarCerca, reiniciarMonolitosVivo, aceptarTransmision, textoEstadoMonolitos, MONO_VIVO } from "@/lib/monolitosVivoAcciones";   // Z82
import { MONO_PASTO } from "@/lib/monolitosPasto";
import { LABEL, ROW, INPUT, NOTE, NumField, N5ProximityOverlay } from "../comun";
import { useDbg } from "../contexto";
import { PASTO } from "@/lib/pasto";   // Z74
import { PASTO_EXT_RENDER } from "@/components/PastoExtension";   // Z74

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
          {(["ACTIVO", "MONOLITOS_ACTIVO", "OVERLAY", "REQUIERE_LUZ_ENCENDIDA"] as const).map(k => (
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

// sección: pasto-extension-z74
export function SecPastoExtensionZ74() {
  const { tocarDia } = useDbg();
  const E = PASTO_EXT_RENDER;
  return (
    <>
          {/* Z74: extensión del pasto hasta el borde del círculo del piso (lib/pastoExt.ts, components/PastoExtension.tsx) */}
          <span style={LABEL}>Extensión del pasto Z74 <span style={NOTE}>(hasta el borde del círculo · tras los monolitos · live)</span></span>
          <div style={ROW}><span style={NOTE}>extensión {PASTO.ext.toFixed(2)} · {PASTO.extFase} · radio {E.radio.toFixed(1)} m · bloques {E.dibujados}/{E.elegibles}/{E.bloques} (dibujados/elegibles/total) · capas {E.instancias}{E.lejano ? " · suelo lejano" : ""}</span></div>
          {(["EXT_ACTIVO", "EXT_OVERLAY"] as const).map(k => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{k === "EXT_ACTIVO" ? "off = sin extensión" : "radio, borde y bloques"}</span></span>
              <button style={INPUT} onClick={() => { DBG_PASTO[k] = !DBG_PASTO[k]; tocarDia(); }}>{DBG_PASTO[k] ? "ON" : "off"}</button>
            </div>
          ))}
          <div style={ROW}>
            <span>EXT_MODO <span style={NOTE}>auto = tras los monolitos · manual = solo con el botón</span></span>
            {(["auto", "manual"] as const).map(m => (
              <button key={m} style={{ ...INPUT, width: "auto", padding: "0 4px", opacity: DBG_PASTO.EXT_MODO === m ? 1 : 0.45 }}
                onClick={() => { DBG_PASTO.EXT_MODO = m; tocarDia(); }}>{m}</button>
            ))}
          </div>
          <div style={ROW}>
            <span>EXT_RADIO_M <span style={NOTE}>{String(DBG_PASTO.EXT_RADIO_M)} (auto = disco del piso, 28 m)</span></span>
            <button style={{ ...INPUT, width: "auto", padding: "0 4px", opacity: DBG_PASTO.EXT_RADIO_M === "auto" ? 1 : 0.45 }}
              onClick={() => { DBG_PASTO.EXT_RADIO_M = "auto"; tocarDia(); }}>auto</button>
            <input type="range" min={14} max={28} step={0.5} style={{ flex: 1 }} value={typeof DBG_PASTO.EXT_RADIO_M === "number" ? DBG_PASTO.EXT_RADIO_M : 28}
              onChange={e => { DBG_PASTO.EXT_RADIO_M = parseFloat(e.target.value); tocarDia(); }} />
          </div>
          {([
            ["EXT_ARRANQUE_S", 0, 20, 0.5, "s tras los monolitos"], ["EXT_DURACION_S", 2, 120, 1, "s"], ["EXT_IRREGULARIDAD", 0, 1, 0.01, ""],
            ["EXT_BRILLO_MIN", 0, 1.5, 0.01, "× luz del día"], ["EXT_MAX_BLOQUES", 4, 200, 1, "bloques con capas"],
          ] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{DBG_PASTO[k].toFixed(st < 0.1 ? 2 : st < 1 ? 1 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={DBG_PASTO[k]}
                onChange={e => { DBG_PASTO[k] = parseFloat(e.target.value); tocarDia(); }} />
            </div>
          ))}
          <div style={ROW}>
            <button style={INPUT} onClick={() => window.dispatchEvent(new CustomEvent("alight:pasto-extender"))}>Extender pasto ahora</button>
            <button style={INPUT} onClick={() => window.dispatchEvent(new CustomEvent("alight:pasto-ext-reiniciar"))}>Reiniciar extensión</button>
            <button style={INPUT} onClick={() => window.dispatchEvent(new CustomEvent("alight:pasto-completar-extender"))}>Completar todo y extender</button>
          </div>
    </>
  );
}

// sección: monolitos-vivo-z82
export function SecMonolitosVivoZ82() {
  // Z82: monolitos frente a la sesión en vivo de la tarima, solo local (lib/monolitosVivo.ts). Estado 4 veces por segundo.
  const M = DBG_MONO_VIVO;
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => (t + 1) % 1e6), 250); return () => clearInterval(id); }, []);
  const toca = () => setTick(t => (t + 1) % 1e6);
  const boton = (txt: string, fn: () => void) => <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); fn(); toca(); }}>{txt}</button>;
  return (
    <>
          <span style={LABEL}>Monolitos y sesión en vivo Z82 <span style={NOTE}>(live · solo local · sonido = derecho, video = izquierdo)</span></span>
          <div style={{ ...ROW, ...NOTE }}><span>{textoEstadoMonolitos()}</span></div>
          <div style={ROW}>{boton("Simular sesión en vivo", simularSesionEnVivo)}{boton("Quitar sesión", quitarSesion)}</div>
          <div style={ROW}>{boton("Forzar cerca de sonido", () => forzarCerca("sonido"))}{boton("Forzar cerca de video", () => forzarCerca("video"))}{boton("Reiniciar", reiniciarMonolitosVivo)}</div>
          {([["ACTIVO", "off = prototipo N5 como estaba"], ["REQUIERE_ACEPTACION", "sin mezcla remota hasta aceptar"], ["OVERLAY", "estados y pesos en pantalla"]] as const).map(([k, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{nota}</span></span>
              <button style={INPUT} onClick={() => { M[k] = !M[k]; toca(); }}>{M[k] ? "ON" : "off"}</button>
            </div>
          ))}
          {M.REQUIERE_ACEPTACION && <div style={ROW}>{boton(MONO_VIVO.aceptada ? "Retirar aceptación" : "Aceptar transmisión", () => aceptarTransmision(!MONO_VIVO.aceptada))}</div>}
          <div style={ROW}>
            <span>RUIDO_TIPO</span>
            {(["blanco", "rosa"] as const).map(v => (
              <button key={v} style={{ ...INPUT, opacity: M.RUIDO_TIPO === v ? 1 : 0.5 }} onClick={() => { M.RUIDO_TIPO = v; toca(); }}>{v}</button>
            ))}
          </div>
          {([
            ["RADIO_INICIO_M", 0.5, 8, 0.05, "m"], ["RADIO_TOTAL_M", 0.1, 4, 0.05, "m"], ["SOSTENER_S", 0, 60, 0.5, "s"], ["RETORNO_S", 0.1, 20, 0.1, "s"],
            ["CANCELAR_S", 0.05, 3, 0.05, "s"], ["UMBRAL_VEL_MS", 0, 1, 0.01, "m/s"], ["RUIDO_GANANCIA", 0, 1.5, 0.01, ""], ["SESION_GANANCIA", 0, 2, 0.01, ""],
          ] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{M[k].toFixed(st < 0.1 ? 2 : 1)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={M[k]} onChange={ev => { M[k] = parseFloat(ev.target.value); toca(); }} />
            </div>
          ))}
    </>
  );
}

// sección: aviso-vivo-z85
export function SecAvisoVivoZ85() {
  // Z85: aviso al espectador antes de recibir la transmisión en vivo (docs/dialogos/aviso-vivo.ink).
  const A = DBG_AVISO_VIVO;
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => (t + 1) % 1e6), 250); return () => clearInterval(id); }, []);
  const toca = () => setTick(t => (t + 1) % 1e6);
  return (
    <>
          <span style={LABEL}>Aviso de la sesión en vivo Z85 <span style={NOTE}>(live · usa la terminal de la narrativa)</span></span>
          <div style={{ ...ROW, ...NOTE }}><span>{textoEstadoAviso()}</span></div>
          <div style={ROW}>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); mostrarAvisoAhora(); toca(); }}>Mostrar aviso ahora</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); reiniciarDecisionAviso(); toca(); }}>Reiniciar decisión</button>
          </div>
          {([["ACTIVO", "off = como antes, sin aviso"], ["SOLO_UNA_VEZ", "una vez por sesión del navegador"]] as const).map(([k, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{nota}</span></span>
              <button style={INPUT} onClick={() => { A[k] = !A[k]; toca(); }}>{A[k] ? "ON" : "off"}</button>
            </div>
          ))}
          {([["CIERRE_MS", 0, 3000, 50], ["ESPERA_CIERRE_MS", 0, 2000, 50]] as const).map(([k, mn, mx, st]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{A[k]} ms</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={A[k]} onChange={ev => { A[k] = parseFloat(ev.target.value); toca(); }} />
            </div>
          ))}
    </>
  );
}

// sección: sesion-vivo-z89
export function SecSesionVivoZ89() {
  // Z89: presencia de la sesión en vivo con Supabase Realtime (sin medios). Estado 4 veces por segundo.
  const V = DBG_VIVO;
  const [, setTick] = useState(0);
  const [res, setRes] = useState("");
  useEffect(() => { const id = setInterval(() => setTick(t => (t + 1) % 1e6), 250); return () => clearInterval(id); }, []);
  const toca = () => setTick(t => (t + 1) % 1e6);
  return (
    <>
          <span style={LABEL}>Sesión en vivo (presencia) Z89 <span style={NOTE}>(live · Supabase Realtime, sin medios · canal público)</span></span>
          <div style={{ ...ROW, ...NOTE }}><span style={{ whiteSpace: "pre-line" }}>{textoEstadoVivo()}</span></div>
          <div style={ROW}>
            <span>FUENTE <span style={NOTE}>mock = Z82–Z86 · supabase = presencia con patrones de prueba · livekit = presencia + medios reales (Z93) · auto = livekit si hay variables</span></span>
            {(["auto", "livekit", "supabase", "mock"] as const).map(m => (
              <button key={m} style={{ ...INPUT, opacity: V.FUENTE === m ? 1 : 0.5 }} onClick={() => { V.FUENTE = m; toca(); }}>{m}</button>
            ))}
          </div>
          <div style={ROW}>
            <span>CANAL <span style={NOTE}>vale al conectar</span></span>
            <input style={{ ...INPUT, flex: 1 }} value={V.CANAL} maxLength={64}
              onKeyDown={ev => ev.nativeEvent.stopPropagation()} onKeyUp={ev => ev.nativeEvent.stopPropagation()}   // escribir no mueve la cámara ni dispara la E
              onChange={ev => { V.CANAL = ev.target.value.replace(/[^A-Za-z0-9_:-]/g, ""); toca(); }} />
          </div>
          {([["LATIDO_S", 1, 30, 0.5, "s entre latidos"], ["TIMEOUT_S", 3, 60, 1, "s sin latido → sin sesión"], ["REINTENTO_S", 0.5, 30, 0.5, "s (se duplica)"],
            ["REINTENTO_MAX_S", 1, 300, 1, "s tope"], ["MAX_REINTENTOS", 0, 30, 1, "Z95: seguidos, cada uno con un canal nuevo"], ["CIERRE_SIN_USO_S", 0, 120, 1, "s sin monolitos → cierra el canal"]] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{V[k].toFixed(st < 1 ? 1 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={V[k]} onChange={ev => { V[k] = parseFloat(ev.target.value); toca(); }} />
            </div>
          ))}
          <div style={ROW}>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); const r = publicarPresencia({ modo: "privado", consentimiento: true }); setRes(r.ok ? `publicando ${r.sesionId.slice(0, 8)}…` : `rechazada: ${r.motivo}`); toca(); }}>Publicar presencia de prueba (consentimiento de prueba)</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); detenerPresencia(); setRes("detenida"); toca(); }}>Detener presencia</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); reintentarPresencia(); setRes("reintentando con canales nuevos"); toca(); }}>Reintentar presencia</button>
          </div>
          {res && <div style={{ ...ROW, ...NOTE }}><span>{res}</span></div>}
    </>
  );
}

// sección: recepcion-livekit-z93
export function SecRecepcionLiveKitZ93() {
  // Z93: recepción real de la tarima en SILLAS (LiveKit, rol "escuchar"). Estado 4 veces por segundo, sin datos sensibles.
  const R = DBG_LIVEKIT_RECIBIR;
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => (t + 1) % 1e6), 250); return () => clearInterval(id); }, []);
  const toca = () => setTick(t => (t + 1) % 1e6);
  return (
    <>
          <span style={LABEL}>Recepción LiveKit Z93 <span style={NOTE}>(live · SILLAS recibe audio y video de la tarima tras aceptar el aviso · DBG_VIVO.FUENTE auto/livekit)</span></span>
          <div style={{ ...ROW, ...NOTE }}><span>{textoEstadoRecepcion()}</span></div>
          <div style={ROW}>
            <span>CONTORNO_ELEMENTO_AUDIO <span style={NOTE}>Chrome: la pista también en un audio silenciado (vale al suscribir)</span></span>
            <button style={INPUT} onClick={() => { R.CONTORNO_ELEMENTO_AUDIO = !R.CONTORNO_ELEMENTO_AUDIO; toca(); }}>{R.CONTORNO_ELEMENTO_AUDIO ? "ON" : "off"}</button>
          </div>
          {([["ESPERA_DESUSCRIBIR_S", 0, 10, 0.5, "s con peso 0 → des-suscribe (sin ninguna: desconecta)"], ["SENAL_DEBIL_S", 1, 20, 0.5, "s suscrito sin medios → señal débil"],
            ["DEBIL_MEZCLA", 0, 1, 0.05, "estática en señal débil (sin cortar lo propio)"], ["REINTENTO_BASE_S", 0.5, 10, 0.5, "s (se duplica)"],
            ["REINTENTO_MAX_S", 1, 60, 1, "s tope"], ["MAX_REINTENTOS", 0, 20, 1, "después: error"]] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{R[k].toFixed(st < 1 ? 2 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={R[k]} onChange={ev => { R[k] = parseFloat(ev.target.value); toca(); }} />
            </div>
          ))}
          <div style={ROW}>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); reintentarLiveKit(); toca(); }}>Volver a probar LiveKit (olvida el 503 de auto)</button>
          </div>
    </>
  );
}
