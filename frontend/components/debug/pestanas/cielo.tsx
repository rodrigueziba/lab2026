"use client";
// Z70: pestaña "Cielo y ciclo del día" del menú de debug. Cada sección es el código movido tal cual desde DebugMenu.tsx;
// toma del contexto (useDbg) solo el estado que usa. Registro y orden: lib/debugSecciones.ts.
import { DBG_DIA, DBG_LUZ, DBG_SILLAS, DBG_AMANECER } from "@/lib/debugConfig";
import { CIELO_STATE, LUZ_STATE } from "@/lib/caminoLuz";
import { AMANECER } from "@/lib/amanecer";
import { LABEL, NOTE, ROW, INPUT, NumField, ColorField, DIVIDER } from "../comun";
import { useDbg } from "../contexto";

// sección: ciclo-de-dia-z48
export function SecCicloDeDiaZ48() {
  const { diaLive, tocarDia } = useDbg();
  return (
    <>
          {/* Z48: ciclo de día (lib/cicloDia.ts) — todo en vivo */}
          <span style={LABEL}>Ciclo de día Z48 <span style={NOTE}>(cielo, sol, estrellas, escena · live)</span></span>
          <div style={{ ...ROW, ...NOTE }}><span>{diaLive}</span></div>
          {(["NUEVO", "SINCRONIZAR_CON_TEMA", "LOOP", "OCULTAR_INVISIBLES", "SOL_ALINEAR_PORTAL", "SOL_UNICO"] as const).map(k => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{k === "NUEVO" ? "off = amanecer de 10 s (Z38)" : k === "OCULTAR_INVISIBLES" ? "esfera de panorama y caparazón con alfa 0" : k === "SOL_ALINEAR_PORTAL" ? "Z49 · off = azimut Z48" : k === "SOL_UNICO" ? "Z49 · atenúa el sol ilustrado" : ""}</span></span>
              <button style={INPUT} onClick={() => { DBG_DIA[k] = !DBG_DIA[k]; tocarDia(); }}>{DBG_DIA[k] ? "ON" : "off"}</button>
            </div>
          ))}
          {([
            ["T_MANUAL", -1, 1, 0.005, "−1 = reloj; 0…1 fija tDia"], ["VELOCIDAD", 0.25, 16, 0.25, "× tiempo"],
            ["INTRO_S", 40, 90, 1, "s"], ["DURACION_FALLBACK_S", 30, 600, 5, "s"],
            ["SOL_AZ_SALIDA_DEG", 0, 360, 1, "° (180 = portal)"], ["SOL_ALT_MAX_DEG", 10, 85, 1, "°"], ["SOL_RADIO", 0.01, 0.2, 0.005, "rad"],
            ["MONT_SILUETA", 0, 1, 0.01, ""], ["MONT_ANCHO", 0.02, 0.5, 0.01, "vueltas"], ["PORTAL_NOCHE", 0, 1, 0.01, ""],
            ["MUSICA_SOL", 0, 2, 0.05, "gancho"], ["MUSICA_NUBES", 0, 2, 0.05, "gancho"],
            ["SOL_AZ_OFFSET_DEG", -30, 30, 0.5, "Z49 °"], ["SOL_EJE_HASTA_ELEV_DEG", -1, 60, 1, "Z50 ° (−1 = Z49)"], ["SOL_VERTICAL_FASE", 0.05, 1.5, 0.05, "Z49 rad"], ["SOL_HALO_TOPE", 0.5, 1.2, 0.01, "Z49 bloom 0,92"],
          ] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{DBG_DIA[k].toFixed(st < 0.01 ? 3 : 2)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={DBG_DIA[k]}
                onChange={e => { DBG_DIA[k] = parseFloat(e.target.value); tocarDia(); }} />
            </div>
          ))}
          {/* Z51: recorrido del sol y sol nuevo */}
          <div style={ROW}>
            <span>SOL_RECORRIDO <span style={NOTE}>Z51</span></span>
            {(["eje", "meridiano", "arco"] as const).map(m => (
              <button key={m} style={{ ...INPUT, opacity: DBG_DIA.SOL_RECORRIDO === m ? 1 : 0.45 }}
                onClick={() => { DBG_DIA.SOL_RECORRIDO = m; tocarDia(); }}>{m}</button>
            ))}
          </div>
          <div style={ROW}>
            <span>SOL_EJE_IMAGEN <span style={NOTE}>Z55 · en modo eje, sobre la recta de la composición (off = azimut constante, Z51)</span></span>
            <button style={INPUT} onClick={() => { DBG_DIA.SOL_EJE_IMAGEN = !DBG_DIA.SOL_EJE_IMAGEN; tocarDia(); }}>{DBG_DIA.SOL_EJE_IMAGEN ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>SOL_EJE_CENTRO <span style={NOTE}>Z55 · composicion = pico y discos (SUN_C) · portal = círculo exterior y anillos (PORTAL_C)</span></span>
            {(["composicion", "portal"] as const).map(m => (
              <button key={m} style={{ ...INPUT, opacity: DBG_DIA.SOL_EJE_CENTRO === m ? 1 : 0.45 }}
                onClick={() => { DBG_DIA.SOL_EJE_CENTRO = m; tocarDia(); }}>{m}</button>
            ))}
          </div>
    </>
  );
}
// sección: cielo-estrellado-z30
export function SecCieloEstrelladoZ30() {
  const { luz, setLuz } = useDbg();
  return (
    <>
          <span style={LABEL}>Cielo estrellado Z30 <span style={NOTE}>(live)</span></span>
          <div style={{ ...ROW, ...NOTE }}>
            <span>reveal={CIELO_STATE.reveal.toFixed(2)} · obj={CIELO_STATE.objetivo.toFixed(2)} · aten={CIELO_STATE.aten.toFixed(2)} · dSpawn={LUZ_STATE.dSpawn.toFixed(1)} m</span>
          </div>
          <div style={ROW}>
            <span>ESTRELLAS_COBERTURA</span>
            <button style={INPUT} onClick={() => {
              const v = !luz.ESTRELLAS_COBERTURA;
              DBG_LUZ.ESTRELLAS_COBERTURA = v;
              setLuz(o => ({ ...o, ESTRELLAS_COBERTURA: v }));
            }}>{luz.ESTRELLAS_COBERTURA ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>ESTRELLAS_COB_MODO_Z32</span>
            <button style={INPUT} onClick={() => {
              const v = !luz.ESTRELLAS_COB_MODO_Z32;
              DBG_LUZ.ESTRELLAS_COB_MODO_Z32 = v;
              setLuz(o => ({ ...o, ESTRELLAS_COB_MODO_Z32: v }));
            }}>{luz.ESTRELLAS_COB_MODO_Z32 ? "ON" : "off"}</button>
          </div>
          <NumField label="ESTRELLAS_COBERTURA_RAPIDA" value={luz.ESTRELLAS_COBERTURA_RAPIDA} step={0.01} min={0.001} max={1} note="reveal con cobertura 1"
            onChange={v => { DBG_LUZ.ESTRELLAS_COBERTURA_RAPIDA = v; setLuz(o => ({ ...o, ESTRELLAS_COBERTURA_RAPIDA: v })); }} />
          <ColorField label="ESTRELLAS_FONDO_COLOR" value={luz.ESTRELLAS_FONDO_COLOR}
            onChange={v => { DBG_LUZ.ESTRELLAS_FONDO_COLOR = v; setLuz(o => ({ ...o, ESTRELLAS_FONDO_COLOR: v })); }} />
          <div style={ROW}>
            <span>ESTRELLAS_MODO_Z30</span>
            <button style={INPUT} onClick={() => {
              const v = !luz.ESTRELLAS_MODO_Z30;
              DBG_LUZ.ESTRELLAS_MODO_Z30 = v;
              setLuz(o => ({ ...o, ESTRELLAS_MODO_Z30: v }));
            }}>{luz.ESTRELLAS_MODO_Z30 ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>ESTRELLAS_SALA_SIN_PROFUNDIDAD</span>
            <button style={INPUT} onClick={() => {
              const v = !luz.ESTRELLAS_SALA_SIN_PROFUNDIDAD;
              DBG_LUZ.ESTRELLAS_SALA_SIN_PROFUNDIDAD = v;
              setLuz(o => ({ ...o, ESTRELLAS_SALA_SIN_PROFUNDIDAD: v }));
            }}>{luz.ESTRELLAS_SALA_SIN_PROFUNDIDAD ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>ESTRELLAS_MODO_VIEJO</span>
            <button style={INPUT} onClick={() => {
              const v = !luz.ESTRELLAS_MODO_VIEJO;
              DBG_LUZ.ESTRELLAS_MODO_VIEJO = v;
              setLuz(o => ({ ...o, ESTRELLAS_MODO_VIEJO: v }));
            }}>{luz.ESTRELLAS_MODO_VIEJO ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>ESTRELLAS_SOLO_FUERA</span>
            <button style={INPUT} onClick={() => {
              const v = !luz.ESTRELLAS_SOLO_FUERA;
              DBG_LUZ.ESTRELLAS_SOLO_FUERA = v;
              setLuz(o => ({ ...o, ESTRELLAS_SOLO_FUERA: v }));
            }}>{luz.ESTRELLAS_SOLO_FUERA ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>ESTRELLAS_DEPTH_TEST</span>
            <button style={INPUT} onClick={() => {
              const v = !luz.ESTRELLAS_DEPTH_TEST;
              DBG_LUZ.ESTRELLAS_DEPTH_TEST = v;
              setLuz(o => ({ ...o, ESTRELLAS_DEPTH_TEST: v }));
            }}>{luz.ESTRELLAS_DEPTH_TEST ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>ESTRELLAS_SOBRE_TECHO</span>
            <button style={INPUT} onClick={() => {
              const v = !luz.ESTRELLAS_SOBRE_TECHO;
              DBG_LUZ.ESTRELLAS_SOBRE_TECHO = v;
              setLuz(o => ({ ...o, ESTRELLAS_SOBRE_TECHO: v }));
            }}>{luz.ESTRELLAS_SOBRE_TECHO ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>ESTRELLAS_CONGELAR_EN_PAUSA</span>
            <button style={INPUT} onClick={() => {
              const v = !luz.ESTRELLAS_CONGELAR_EN_PAUSA;
              DBG_LUZ.ESTRELLAS_CONGELAR_EN_PAUSA = v;
              setLuz(o => ({ ...o, ESTRELLAS_CONGELAR_EN_PAUSA: v }));
            }}>{luz.ESTRELLAS_CONGELAR_EN_PAUSA ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>forzar reveal <span style={NOTE}>{luz.ESTRELLAS_FORZAR_REVEAL < 0 ? "auto" : luz.ESTRELLAS_FORZAR_REVEAL.toFixed(2)}</span></span>
            <input type="range" min={-0.05} max={1} step={0.01} style={{ flex: 1 }}
              value={luz.ESTRELLAS_FORZAR_REVEAL}
              onChange={e => {
                const raw = parseFloat(e.target.value);
                const v = raw < 0 ? -1 : raw;   // tope izquierdo = automático
                DBG_LUZ.ESTRELLAS_FORZAR_REVEAL = v;
                setLuz(o => ({ ...o, ESTRELLAS_FORZAR_REVEAL: v }));
              }} />
          </div>
          <NumField label="ESTRELLAS_MARGEN_INICIO_M" value={luz.ESTRELLAS_MARGEN_INICIO_M} step={0.1} min={0} max={20} note="m antes del spawn"
            onChange={v => { DBG_LUZ.ESTRELLAS_MARGEN_INICIO_M = v; setLuz(o => ({ ...o, ESTRELLAS_MARGEN_INICIO_M: v })); }} />
          <NumField label="ESTRELLAS_DIST_INICIO_M" value={luz.ESTRELLAS_DIST_INICIO_M} step={1} min={1} max={300} note="m (solo MODO_Z30)"
            onChange={v => { DBG_LUZ.ESTRELLAS_DIST_INICIO_M = v; setLuz(o => ({ ...o, ESTRELLAS_DIST_INICIO_M: v })); }} />
          <NumField label="ESTRELLAS_DIST_PLENO_M" value={luz.ESTRELLAS_DIST_PLENO_M} step={0.5} min={0} max={100} note="m"
            onChange={v => { DBG_LUZ.ESTRELLAS_DIST_PLENO_M = v; setLuz(o => ({ ...o, ESTRELLAS_DIST_PLENO_M: v })); }} />
          <NumField label="ESTRELLAS_CURVA" value={luz.ESTRELLAS_CURVA} step={0.1} min={0.1} max={8} note="exponente"
            onChange={v => { DBG_LUZ.ESTRELLAS_CURVA = v; setLuz(o => ({ ...o, ESTRELLAS_CURVA: v })); }} />
          <NumField label="ESTRELLAS_REVEAL_MAX" value={luz.ESTRELLAS_REVEAL_MAX} step={0.05} min={0} max={2} note=""
            onChange={v => { DBG_LUZ.ESTRELLAS_REVEAL_MAX = v; setLuz(o => ({ ...o, ESTRELLAS_REVEAL_MAX: v })); }} />
          <NumField label="ESTRELLAS_INERCIA_S" value={luz.ESTRELLAS_INERCIA_S} step={0.05} min={0} max={5} note="s"
            onChange={v => { DBG_LUZ.ESTRELLAS_INERCIA_S = v; setLuz(o => ({ ...o, ESTRELLAS_INERCIA_S: v })); }} />
          <NumField label="ESTRELLAS_ATENUAR_EN_VISUALIZADOR" value={luz.ESTRELLAS_ATENUAR_EN_VISUALIZADOR} step={0.01} min={0} max={1} note="factor"
            onChange={v => { DBG_LUZ.ESTRELLAS_ATENUAR_EN_VISUALIZADOR = v; setLuz(o => ({ ...o, ESTRELLAS_ATENUAR_EN_VISUALIZADOR: v })); }} />
          <NumField label="ESTRELLAS_ATEN_TRANS_S" value={luz.ESTRELLAS_ATEN_TRANS_S} step={0.1} min={0} max={10} note="s"
            onChange={v => { DBG_LUZ.ESTRELLAS_ATEN_TRANS_S = v; setLuz(o => ({ ...o, ESTRELLAS_ATEN_TRANS_S: v })); }} />
          <NumField label="ESTRELLAS_CALIDAD" value={luz.ESTRELLAS_CALIDAD} step={1} min={1} max={3} note="capas 3/2/1"
            onChange={v => { DBG_LUZ.ESTRELLAS_CALIDAD = v; setLuz(o => ({ ...o, ESTRELLAS_CALIDAD: v })); }} />
          <NumField label="ESTRELLAS_TOPE" value={luz.ESTRELLAS_TOPE} step={0.05} min={0.1} max={10} note="por canal"
            onChange={v => { DBG_LUZ.ESTRELLAS_TOPE = v; setLuz(o => ({ ...o, ESTRELLAS_TOPE: v })); }} />
          <NumField label="ESTRELLAS_U_BRILLO" value={luz.ESTRELLAS_U_BRILLO} step={0.05} min={0} max={10} note="uBrillo"
            onChange={v => { DBG_LUZ.ESTRELLAS_U_BRILLO = v; setLuz(o => ({ ...o, ESTRELLAS_U_BRILLO: v })); }} />
          <NumField label="ESTRELLAS_U_DENSIDAD" value={luz.ESTRELLAS_U_DENSIDAD} step={0.01} min={0} max={1} note="uDensidad"
            onChange={v => { DBG_LUZ.ESTRELLAS_U_DENSIDAD = v; setLuz(o => ({ ...o, ESTRELLAS_U_DENSIDAD: v })); }} />
          <NumField label="ESTRELLAS_U_TWINKLE" value={luz.ESTRELLAS_U_TWINKLE} step={0.05} min={0} max={2} note="uTwinkle"
            onChange={v => { DBG_LUZ.ESTRELLAS_U_TWINKLE = v; setLuz(o => ({ ...o, ESTRELLAS_U_TWINKLE: v })); }} />
          <NumField label="ESTRELLAS_U_PAN" value={luz.ESTRELLAS_U_PAN} step={0.005} min={-0.5} max={0.5} note="uPan rad/s"
            onChange={v => { DBG_LUZ.ESTRELLAS_U_PAN = v; setLuz(o => ({ ...o, ESTRELLAS_U_PAN: v })); }} />
          <ColorField label="ESTRELLAS_TINTE_HORIZONTE" value={luz.ESTRELLAS_TINTE_HORIZONTE}
            onChange={v => { DBG_LUZ.ESTRELLAS_TINTE_HORIZONTE = v; setLuz(o => ({ ...o, ESTRELLAS_TINTE_HORIZONTE: v })); }} />
          <div style={DIVIDER} />
          <NumField label="EXTERIOR_RADIO_M" value={luz.EXTERIOR_RADIO_M} step={1} min={5} max={100} note="m caminable"
            onChange={v => { DBG_LUZ.EXTERIOR_RADIO_M = v; setLuz(o => ({ ...o, EXTERIOR_RADIO_M: v })); }} />
          <NumField label="AREA_HIST_M" value={luz.AREA_HIST_M} step={0.25} min={0} max={5} note="m"
            onChange={v => { DBG_LUZ.AREA_HIST_M = v; setLuz(o => ({ ...o, AREA_HIST_M: v })); }} />
          <NumField label="ACTIVACION_M" value={luz.ACTIVACION_M} step={0.25} min={0.5} max={10} note="m"
            onChange={v => { DBG_LUZ.ACTIVACION_M = v; setLuz(o => ({ ...o, ACTIVACION_M: v })); }} />
          <NumField label="ACTIVACION_SALIDA_M" value={luz.ACTIVACION_SALIDA_M} step={0.25} min={0.5} max={15} note="m"
            onChange={v => { DBG_LUZ.ACTIVACION_SALIDA_M = v; setLuz(o => ({ ...o, ACTIVACION_SALIDA_M: v })); }} />
          <NumField label="GIRO_MS" value={luz.GIRO_MS} step={50} min={0} max={5000} note="ms"
            onChange={v => { DBG_LUZ.GIRO_MS = v; setLuz(o => ({ ...o, GIRO_MS: v })); }} />
          <NumField label="PITCH_MAX_DEG" value={luz.PITCH_MAX_DEG} step={1} min={0} max={89} note="°"
            onChange={v => { DBG_LUZ.PITCH_MAX_DEG = v; setLuz(o => ({ ...o, PITCH_MAX_DEG: v })); }} />
          <NumField label="CIERRE_DIALOGO_MS" value={luz.CIERRE_DIALOGO_MS} step={100} min={0} max={10000} note="ms"
            onChange={v => { DBG_LUZ.CIERRE_DIALOGO_MS = v; setLuz(o => ({ ...o, CIERRE_DIALOGO_MS: v })); }} />
          <NumField label="TELEPORT_DIST_M" value={luz.TELEPORT_DIST_M} step={0.5} min={1} max={30} note="m"
            onChange={v => { DBG_LUZ.TELEPORT_DIST_M = v; setLuz(o => ({ ...o, TELEPORT_DIST_M: v })); }} />
          <ColorField label="LUZ_COLOR" value={luz.LUZ_COLOR}
            onChange={v => { DBG_LUZ.LUZ_COLOR = v; setLuz(o => ({ ...o, LUZ_COLOR: v })); }} />
    </>
  );
}
// sección: u9-secuencia-amanecer
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
// sección: amanecer-z38
export function SecAmanecerZ38() {
  const { amn, setAmn } = useDbg();
  return (
    <>
          {/* Z38: máquina única del amanecer — único par de botones (antes había uno para U9 y otro para W3) */}
          <span style={LABEL}>Amanecer Z38 <span style={NOTE}>(máquina única)</span></span>
          <div style={{ ...ROW, ...NOTE }}>
            <span>fase={AMANECER.fase} · p1={AMANECER.p1.toFixed(2)} · tFin={AMANECER.tFin > 9000 ? "skip" : AMANECER.tFin.toFixed(1)} s · sector={AMANECER.sectorDeg}° · eventos={AMANECER.emitidos}</span>
          </div>
          <div style={ROW}>
            <span>UNIFICADO</span>
            <button style={INPUT} onClick={() => {
              const v = !amn.UNIFICADO;
              DBG_AMANECER.UNIFICADO = v;
              setAmn(o => ({ ...o, UNIFICADO: v }));
            }}>{amn.UNIFICADO ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>MONOLITOS_CAPTURA</span>
            <button style={INPUT} onClick={() => {
              const v = !amn.MONOLITOS_CAPTURA;
              DBG_AMANECER.MONOLITOS_CAPTURA = v;
              setAmn(o => ({ ...o, MONOLITOS_CAPTURA: v }));
            }}>{amn.MONOLITOS_CAPTURA ? "ON" : "off"}</button>
          </div>
          <NumField label="AMANECER_DUR_S" value={amn.AMANECER_DUR_S} step={0.5} min={0.5} max={60} note="fase 1 (s), única"
            onChange={v => { DBG_AMANECER.AMANECER_DUR_S = v; setAmn(o => ({ ...o, AMANECER_DUR_S: v })); }} />
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
    </>
  );
}
// sección: w3-amanecer-domesky
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