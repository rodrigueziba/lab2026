"use client";
// Z70: pestaña "Sala y movimiento" del menú de debug. Cada sección es el código movido tal cual desde DebugMenu.tsx;
// toma del contexto (useDbg) solo el estado que usa. Registro y orden: lib/debugSecciones.ts.
import { DBG_SILLAS, DBG_PISO_ICONOS, DBG_LAYOUT, DBG_SECUENCIA, DBG_MOV, DBG_ESPERA } from "@/lib/debugConfig";
import { useEffect, useState } from "react";                                   // Z105
import { ESPERA, ESPERA_DIAG } from "@/components/EsperaCamara";            // Z105
import { textoFaseEspera } from "@/lib/esperaCamara";                         // Z105
import { RELOJ, esperasPendientes } from "@/lib/relojExperiencia";
import { SECUENCIA } from "@/lib/secuenciaSillas";
import { LABEL, ROW, INPUT, NOTE, NumField } from "../comun";
import { useDbg } from "../contexto";

// sección: secuencia-sillas
export function SecSecuenciaSillas() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
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
    </>
  );
}

// sección: iconos-del-piso-z23
export function SecIconosDelPisoZ23() {
  const { piso, setPiso } = useDbg();
  return (
    <>
          <span style={LABEL}>Iconos del piso Z23 <span style={NOTE}>(live)</span></span>
          <div style={ROW}>
            <span>PISO_ICONOS <span style={NOTE}>visible</span></span>
            <button style={INPUT} onClick={() => {
              const v = !piso.PISO_ICONOS;
              DBG_PISO_ICONOS.PISO_ICONOS = v;
              setPiso(o => ({ ...o, PISO_ICONOS: v }));
            }}>{piso.PISO_ICONOS ? "ON" : "off"}</button>
          </div>
          <NumField label="DIST_TELON_M" value={piso.DIST_TELON_M} step={0.1} min={0} max={15} note="Z24 m antes del telón"
            onChange={v => { DBG_PISO_ICONOS.DIST_TELON_M = v; setPiso(o => ({ ...o, DIST_TELON_M: v })); }} />
          <NumField label="ICONOS_ACERCAR_M" value={piso.ICONOS_ACERCAR_M} step={0.1} min={-5} max={15} note="Z24 m hacia el usuario"
            onChange={v => { DBG_PISO_ICONOS.ICONOS_ACERCAR_M = v; setPiso(o => ({ ...o, ICONOS_ACERCAR_M: v })); }} />
          <NumField label="SEP_M" value={piso.SEP_M} step={0.1} min={0.5} max={10} note="m entre iconos"
            onChange={v => { DBG_PISO_ICONOS.SEP_M = v; setPiso(o => ({ ...o, SEP_M: v })); }} />
          <NumField label="ICONOS_TAMANO_M" value={piso.ICONOS_TAMANO_M} step={0.05} min={0.2} max={6} note="Z24 m"
            onChange={v => { DBG_PISO_ICONOS.ICONOS_TAMANO_M = v; setPiso(o => ({ ...o, ICONOS_TAMANO_M: v })); }} />
          <NumField label="BRILLO_MAX" value={piso.BRILLO_MAX} step={0.02} min={0} max={2} note="reflejo"
            onChange={v => { DBG_PISO_ICONOS.BRILLO_MAX = v; setPiso(o => ({ ...o, BRILLO_MAX: v })); }} />
          <NumField label="ENTRA_DEG" value={piso.ENTRA_DEG} step={0.5} min={1} max={60} note="° cono"
            onChange={v => { DBG_PISO_ICONOS.ENTRA_DEG = v; setPiso(o => ({ ...o, ENTRA_DEG: v })); }} />
          <NumField label="SALE_DEG" value={piso.SALE_DEG} step={0.5} min={1} max={90} note="° cono"
            onChange={v => { DBG_PISO_ICONOS.SALE_DEG = v; setPiso(o => ({ ...o, SALE_DEG: v })); }} />
          <NumField label="SURCO" value={piso.SURCO} step={0.02} min={0} max={1} note="oscurecimiento"
            onChange={v => { DBG_PISO_ICONOS.SURCO = v; setPiso(o => ({ ...o, SURCO: v })); }} />
          <NumField label="BISEL" value={piso.BISEL} step={0.01} min={0} max={1} note="borde"
            onChange={v => { DBG_PISO_ICONOS.BISEL = v; setPiso(o => ({ ...o, BISEL: v })); }} />
          <NumField label="SUAV_S" value={piso.SUAV_S} step={0.05} min={0.01} max={3} note="s"
            onChange={v => { DBG_PISO_ICONOS.SUAV_S = v; setPiso(o => ({ ...o, SUAV_S: v })); }} />
          <NumField label="FADE_MS" value={piso.FADE_MS} step={50} min={0} max={5000} note="ms"
            onChange={v => { DBG_PISO_ICONOS.FADE_MS = v; setPiso(o => ({ ...o, FADE_MS: v })); }} />
    </>
  );
}

// sección: layout-z41
export function SecLayoutZ41() {
  const { lay, setLay } = useDbg();
  return (
    <>
          {/* Z41: layout de sillas / zona SILLAS / público y monolitos (lib/layoutSala.ts) — todo en vivo */}
          <span style={LABEL}>Layout Z41 <span style={NOTE}>(sillas, zona SILLAS, público, monolitos · live)</span></span>
          <div style={ROW}>
            <span>POSICIONES_NUEVAS <span style={NOTE}>off = posiciones anteriores</span></span>
            <button style={INPUT} onClick={() => {
              const v = !lay.POSICIONES_NUEVAS;
              DBG_LAYOUT.POSICIONES_NUEVAS = v;
              setLay(o => ({ ...o, POSICIONES_NUEVAS: v }));
            }}>{lay.POSICIONES_NUEVAS ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>SILLAS_OFFSET_M <span style={NOTE}>{lay.SILLAS_OFFSET_M.toFixed(2)} m</span></span>
            <input type="range" min={0} max={12} step={0.05} style={{ flex: 1 }} value={lay.SILLAS_OFFSET_M}
              onChange={e => { const v = parseFloat(e.target.value); DBG_LAYOUT.SILLAS_OFFSET_M = v; setLay(o => ({ ...o, SILLAS_OFFSET_M: v })); }} />
          </div>
          <div style={ROW}>
            <span>MONOLITOS_OFFSET_M <span style={NOTE}>{lay.MONOLITOS_OFFSET_M.toFixed(2)} m</span></span>
            <input type="range" min={0} max={10} step={0.05} style={{ flex: 1 }} value={lay.MONOLITOS_OFFSET_M}
              onChange={e => { const v = parseFloat(e.target.value); DBG_LAYOUT.MONOLITOS_OFFSET_M = v; setLay(o => ({ ...o, MONOLITOS_OFFSET_M: v })); }} />
          </div>
    </>
  );
}

// sección: reloj-de-la-experiencia-z39
export function SecRelojDeLaExperienciaZ39() {
  const { sec, setSec } = useDbg();
  return (
    <>
          <span style={LABEL}>Reloj de la experiencia Z39 <span style={NOTE}>(live)</span></span>
          <div style={{ ...ROW, ...NOTE }}>
            <span>tExp={RELOJ.tExp.toFixed(1)} s · esperas={esperasPendientes()} · revelado={SECUENCIA.activadoExpMs < 0 ? "—" : ((RELOJ.tExp * 1000 - SECUENCIA.activadoExpMs) / 1000).toFixed(1) + " s"} · dome-revealed={SECUENCIA.domeRevealedEmitido ? SECUENCIA.motivo : "no"}</span>
          </div>
          <div style={ROW}>
            <span>RELOJ_UNIFICADO</span>
            <button style={INPUT} onClick={() => {
              const v = !sec.RELOJ_UNIFICADO;
              DBG_SECUENCIA.RELOJ_UNIFICADO = v;
              setSec(o => ({ ...o, RELOJ_UNIFICADO: v }));
            }}>{sec.RELOJ_UNIFICADO ? "ON" : "off"}</button>
          </div>
          <NumField label="TOPE_REVELADO_S" value={sec.TOPE_REVELADO_S} step={0.5} min={1} max={60} note="s tope de seguridad"
            onChange={v => { DBG_SECUENCIA.TOPE_REVELADO_S = v; setSec(o => ({ ...o, TOPE_REVELADO_S: v })); }} />
          <NumField label="REVELADO_MIN_S" value={sec.REVELADO_MIN_S} step={0.1} min={0} max={30} note="s mínimo (antes 9,8 fijo)"
            onChange={v => { DBG_SECUENCIA.REVELADO_MIN_S = v; setSec(o => ({ ...o, REVELADO_MIN_S: v })); }} />
          <NumField label="REVELADO_POR_S" value={sec.REVELADO_POR_S} step={0.01} min={0.01} max={5} note="uReveal/s (0,42 = 0,007/frame)"
            onChange={v => { DBG_SECUENCIA.REVELADO_POR_S = v; setSec(o => ({ ...o, REVELADO_POR_S: v })); }} />
    </>
  );
}

// sección: movimiento-z34
export function SecMovimientoZ34() {
  const { mov, setMov } = useDbg();
  return (
    <>
          <span style={LABEL}>Movimiento Z34 <span style={NOTE}>(live)</span></span>
          <NumField label="VELOCIDAD_FACTOR" value={mov.VELOCIDAD_FACTOR} step={0.05} min={0} max={3} note="× WASD (1 = anterior)"
            onChange={v => { DBG_MOV.VELOCIDAD_FACTOR = v; setMov(o => ({ ...o, VELOCIDAD_FACTOR: v })); }} />
          <div style={ROW}>
            <span>POR_DELTA</span>
            <button style={INPUT} onClick={() => {
              const v = !mov.POR_DELTA;
              DBG_MOV.POR_DELTA = v;
              setMov(o => ({ ...o, POR_DELTA: v }));
            }}>{mov.POR_DELTA ? "ON" : "off"}</button>
          </div>
          <NumField label="VELOCIDAD_BASE_MS" value={mov.VELOCIDAD_BASE_MS} step={0.1} min={0.1} max={30} note="m/s con factor 1"
            onChange={v => { DBG_MOV.VELOCIDAD_BASE_MS = v; setMov(o => ({ ...o, VELOCIDAD_BASE_MS: v })); }} />
          <NumField label="PASO_POR_FRAME_M" value={mov.PASO_POR_FRAME_M} step={0.01} min={0.01} max={1} note="m/frame (POR_DELTA off)"
            onChange={v => { DBG_MOV.PASO_POR_FRAME_M = v; setMov(o => ({ ...o, PASO_POR_FRAME_M: v })); }} />
          <NumField label="DT_MAX_S" value={mov.DT_MAX_S} step={0.01} min={0.01} max={1} note="s"
            onChange={v => { DBG_MOV.DT_MAX_S = v; setMov(o => ({ ...o, DT_MAX_S: v })); }} />
    </>
  );
}

// sección: modo-espera-z105
export function SecModoEsperaZ105() {
  // Z105: modo de espera (cámara cenital con esfera). Estado 4 veces por segundo.
  const E = DBG_ESPERA;
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => (t + 1) % 1e6), 250); return () => clearInterval(id); }, []);
  const toca = () => setTick(t => (t + 1) % 1e6);
  const d = ESPERA_DIAG;
  return (
    <>
          <span style={LABEL}>Modo de espera Z105 <span style={NOTE}>(tras IDLE_S sin entrada la cámara sube a plano cenital y aparece la esfera; cualquier entrada la baja; W A S D mueven la esfera)</span></span>
          <div style={{ ...ROW, ...NOTE }}><span>{textoFaseEspera(ESPERA, E)}{d.motivo ? ` · bloqueado: ${d.motivo}` : " · cámara libre"}{d.reducir ? " · reducir movimiento" : ""}{d.oculto ? " · pestaña oculta o sin foco" : ""}</span></div>
          <div style={{ ...ROW, ...NOTE }}><span>altura {d.altura.toFixed(2)} m · inclinación {d.pitchDeg.toFixed(1)}° · encuadre {d.alturaEncuadre.toFixed(1)} m (círculo r {d.radio.toFixed(1)} m en {d.cx.toFixed(1)}, {d.cz.toFixed(1)}) · esfera {d.esferaX.toFixed(2)}, {d.esferaZ.toFixed(2)} ({d.recorrido.toFixed(1)} m, escala {d.escala.toFixed(2)}) · {d.msCuadro.toFixed(3)} ms/cuadro</span></div>
          <div style={ROW}>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); window.dispatchEvent(new CustomEvent("alight:espera-forzar")); toca(); }}>Forzar modo de espera ahora</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); window.dispatchEvent(new CustomEvent("alight:espera-salir")); toca(); }}>Salir del modo de espera</button>
            <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); window.dispatchEvent(new CustomEvent("alight:espera-entrada")); toca(); }}>Simular entrada</button>
          </div>
          <div style={{ ...ROW, ...NOTE }}><span>Tras «Forzar», el mouse no cuenta durante 1,5 s (para volver del menú sin cortarlo).</span></div>
          {([["ACTIVO", "off = no se activa nunca"], ["CENTRAR", "en el tramo cenital se desliza al centro del escenario"], ["EN_TELON", "también frente al telón del inicio"],
            ["ESCUCHA_EN_ESFERA", "el oyente de audio queda en la esfera"], ["RESPETAR_REDUCIR_MOVIMIENTO", "con reducir movimiento no se activa"],
            ["NIEBLA_COMPENSAR", "menos niebla con la cámara arriba (solo al dibujar)"], ["GUIA", "círculo de encuadre en el piso (debug)"]] as const).map(([k, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{nota}</span></span>
              <button style={INPUT} onClick={ev => { ev.currentTarget.blur(); E[k] = !E[k]; toca(); }}>{E[k] ? "ON" : "off"}</button>
            </div>
          ))}
          {([["IDLE_S", 5, 300, 1, "s sin entrada"], ["SUBIDA_S", 2, 60, 0.5, "s de subida"], ["BAJADA_S", 2, 60, 0.5, "s de bajada"], ["SUAVIZADO_S", 0.05, 2, 0.05, "s (velocidad suavizada)"],
            ["ALTURA_CENITAL_M", 3, 30, 0.5, "m: llega a −90°"], ["MARGEN", 1, 2, 0.01, "del encuadre"], ["ALTURA_MAX_M", 10, 200, 1, "m (tope)"], ["RADIO_EXTRA_M", 0, 10, 0.1, "m sumados al círculo"],
            ["UMBRAL_MOUSE_PX", 0, 40, 1, "px por cuadro"], ["RADIO_M", 0.1, 1.5, 0.01, "m"], ["ESCALA_ALTURA", 0, 0.3, 0.005, "× altura"], ["ESCALA_MAX", 1, 10, 0.1, "tope"],
            ["APARECE_S", 0.05, 3, 0.05, "s"], ["FRACTAL", 0, 1, 0.01, "intensidad"], ["NIEBLA_REF_M", 5, 120, 1, "m"]] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{E[k].toFixed(st < 1 ? (st < 0.01 ? 3 : 2) : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={E[k]} onChange={ev => { E[k] = parseFloat(ev.target.value); toca(); }} />
            </div>
          ))}
    </>
  );
}
