"use client";
// Z70: pestaña "Narrativa y checkpoints" del menú de debug. Cada sección es el código movido tal cual desde DebugMenu.tsx;
// toma del contexto (useDbg) solo el estado que usa. Registro y orden: lib/debugSecciones.ts.
import { CK_STATE, CHECKPOINTS, irACheckpoint } from "@/lib/checkpoints";
import { DBG_CHECKPOINTS, DBG_EFECTOS, DBG_LUZ, DBG_DIALOGO, DBG_LUZ_MOV } from "@/lib/debugConfig";
import { HUIDA, tamCeldaLuz } from "@/lib/luzMovimiento"; // Z76
import { movimientosRestantes } from "@/lib/luzHuida"; // Z76
import { EFECTOS_STATE, probarEfecto, borrarPremio } from "@/lib/dialogo/efectosEstado";
import { LUZ_STATE } from "@/lib/caminoLuz";
import { PAUSA } from "@/lib/pausaExperiencia";
import { abrirDialogo, cerrarDialogo } from "@/lib/dialogo/dialogoEstado";
import { LABEL, ROW, INPUT, NOTE, DIVIDER, NumField, ColorField } from "../comun";
import { useDbg } from "../contexto";

// sección: checkpoints-z40
export function SecCheckpointsZ40() {
  const { ckf, setCkf } = useDbg();
  return (
    <>
          {/* Z40: checkpoints — un botón por punto; el actual (o el que se está aplicando) resaltado */}
          <span style={LABEL}>Checkpoints Z40 <span style={NOTE}>(salto limpio desde cualquier estado)</span></span>
          <div style={{ ...ROW, ...NOTE }}>
            <span>{CK_STATE.fase === "aplicando" ? `aplicando ${CK_STATE.objetivo} · paso ${CK_STATE.paso + 1} (${CK_STATE.pasoNombre})`
              : CK_STATE.fase === "error" ? `error en ${CK_STATE.objetivo}: ${CK_STATE.error}`
              : `actual: ${CK_STATE.actual || "—"}`} · saltos={CK_STATE.saltos}</span>
          </div>
          <div style={ROW}>
            <span>HABILITADOS</span>
            <button style={INPUT} onClick={() => {
              const v = !ckf.HABILITADOS;
              DBG_CHECKPOINTS.HABILITADOS = v;
              setCkf(o => ({ ...o, HABILITADOS: v }));
            }}>{ckf.HABILITADOS ? "ON" : "off"}</button>
          </div>
          <div style={{ ...ROW, flexWrap: "wrap", gap: 4, justifyContent: "flex-start" }}>
            {CHECKPOINTS.map(c => {
              const marcado = CK_STATE.fase === "aplicando" ? CK_STATE.objetivo === c.id : CK_STATE.actual === c.id;
              return (
                <button key={c.id} title={c.descripcion} disabled={!ckf.HABILITADOS}
                  style={{ ...INPUT, width: "auto", padding: "3px 7px", cursor: ckf.HABILITADOS ? "pointer" : "not-allowed",
                    opacity: ckf.HABILITADOS ? 1 : 0.4,
                    background: marcado ? "#FF9A1F" : (INPUT as React.CSSProperties).background,
                    color: marcado ? "#2A1400" : (INPUT as React.CSSProperties).color }}
                  onClick={e => { e.currentTarget.blur(); if (DBG_CHECKPOINTS.HABILITADOS) irACheckpoint(c.id); }}>
                  {c.nombre}
                </button>
              );
            })}
          </div>
          <NumField label="ADELANTO_S" value={ckf.ADELANTO_S} step={0.25} min={0.05} max={5} note="s de reloj por frame (sala_activa)"
            onChange={v => { DBG_CHECKPOINTS.ADELANTO_S = v; setCkf(o => ({ ...o, ADELANTO_S: v })); }} />
    </>
  );
}

// sección: efectos-del-dialogo-z29
export function SecEfectosDelDialogoZ29() {
  const { premio, efx, setEfx } = useDbg();
  return (
    <>
          <span style={LABEL}>Efectos del diálogo Z29 <span style={NOTE}>(live)</span></span>
          <div style={{ ...ROW, ...NOTE }}>
            <span>{EFECTOS_STATE.alarmaActiva ? "ALARMA · " : ""}{EFECTOS_STATE.alarmaSonando ? "SONANDO · " : ""}{EFECTOS_STATE.audioCtx ? `ctx=${EFECTOS_STATE.audioCtx} · ` : ""}luces={EFECTOS_STATE.luces.toFixed(2)}{EFECTOS_STATE.sinPublico ? " · sin público" : ""} · premio={premio ? `sí (vence ${new Date(EFECTOS_STATE.premioVence).toLocaleTimeString()})` : "no"}</span>
          </div>
          <div style={ROW}>
            <span>EFECTOS_DIALOGO</span>
            <button style={INPUT} onClick={() => {
              const v = !efx.EFECTOS_DIALOGO;
              DBG_EFECTOS.EFECTOS_DIALOGO = v;
              setEfx(o => ({ ...o, EFECTOS_DIALOGO: v }));
            }}>{efx.EFECTOS_DIALOGO ? "ON" : "off"}</button>
          </div>
          <div style={{ ...ROW, flexWrap: "wrap", gap: 4 }}>
            <button style={INPUT} onClick={e => { e.currentTarget.blur(); probarEfecto("juego_alarma"); }}>Probar efecto: juego_alarma</button>
            <button style={INPUT} onClick={e => { e.currentTarget.blur(); probarEfecto("ir_tarima_sin_publico"); }}>Probar efecto: ir_tarima_sin_publico</button>
            <button style={INPUT} onClick={e => { e.currentTarget.blur(); probarEfecto("ir_checkpoint:sala_activa"); }}>Probar efecto: ir_checkpoint:sala_activa</button>
            <button style={INPUT} onClick={e => { e.currentTarget.blur(); window.dispatchEvent(new CustomEvent("alight:debug-tocar-tarima")); }}>Probar efecto: premio (tocar tarima)</button>
            <button style={INPUT} onClick={e => { e.currentTarget.blur(); window.dispatchEvent(new CustomEvent("alight:debug-detener-alarma")); }}>Detener alarma</button>
            <button style={INPUT} onClick={e => { e.currentTarget.blur(); borrarPremio(); }}>Borrar premio</button>
          </div>
          <NumField label="ALARMA_VOLUMEN" value={efx.ALARMA_VOLUMEN} step={0.05} min={0} max={4} note=""
            onChange={v => { DBG_EFECTOS.ALARMA_VOLUMEN = v; setEfx(o => ({ ...o, ALARMA_VOLUMEN: v })); }} />
          <NumField label="ALARMA_REF_M" value={efx.ALARMA_REF_M} step={0.5} min={0.1} max={50} note="m"
            onChange={v => { DBG_EFECTOS.ALARMA_REF_M = v; setEfx(o => ({ ...o, ALARMA_REF_M: v })); }} />
          <NumField label="ALARMA_MAX_M" value={efx.ALARMA_MAX_M} step={5} min={1} max={500} note="m"
            onChange={v => { DBG_EFECTOS.ALARMA_MAX_M = v; setEfx(o => ({ ...o, ALARMA_MAX_M: v })); }} />
          <NumField label="ALARMA_ROLLOFF" value={efx.ALARMA_ROLLOFF} step={0.1} min={0} max={10} note=""
            onChange={v => { DBG_EFECTOS.ALARMA_ROLLOFF = v; setEfx(o => ({ ...o, ALARMA_ROLLOFF: v })); }} />
          <NumField label="ALARMA_ALTURA_M" value={efx.ALARMA_ALTURA_M} step={0.1} min={0} max={10} note="m"
            onChange={v => { DBG_EFECTOS.ALARMA_ALTURA_M = v; setEfx(o => ({ ...o, ALARMA_ALTURA_M: v })); }} />
          <NumField label="FUNDIDO_APAGAR_MS" value={efx.FUNDIDO_APAGAR_MS} step={100} min={0} max={10000} note="ms"
            onChange={v => { DBG_EFECTOS.FUNDIDO_APAGAR_MS = v; setEfx(o => ({ ...o, FUNDIDO_APAGAR_MS: v })); }} />
          <NumField label="FUNDIDO_ENCENDER_MS" value={efx.FUNDIDO_ENCENDER_MS} step={100} min={0} max={10000} note="ms"
            onChange={v => { DBG_EFECTOS.FUNDIDO_ENCENDER_MS = v; setEfx(o => ({ ...o, FUNDIDO_ENCENDER_MS: v })); }} />
          <NumField label="LUCES_MIN" value={efx.LUCES_MIN} step={0.05} min={0} max={1} note="mult."
            onChange={v => { DBG_EFECTOS.LUCES_MIN = v; setEfx(o => ({ ...o, LUCES_MIN: v })); }} />
          <NumField label="TOQUE_MARGEN_M" value={efx.TOQUE_MARGEN_M} step={0.05} min={0} max={3} note="m"
            onChange={v => { DBG_EFECTOS.TOQUE_MARGEN_M = v; setEfx(o => ({ ...o, TOQUE_MARGEN_M: v })); }} />
          <NumField label="ZONA_REARME_M" value={efx.ZONA_REARME_M} step={0.25} min={0} max={20} note="m"
            onChange={v => { DBG_EFECTOS.ZONA_REARME_M = v; setEfx(o => ({ ...o, ZONA_REARME_M: v })); }} />
          <NumField label="CIERRE_PREMIO_MS" value={efx.CIERRE_PREMIO_MS} step={250} min={0} max={30000} note="ms"
            onChange={v => { DBG_EFECTOS.CIERRE_PREMIO_MS = v; setEfx(o => ({ ...o, CIERRE_PREMIO_MS: v })); }} />
          <NumField label="PREMIO_DURACION_S" value={efx.PREMIO_DURACION_S} step={60} min={1} max={86400} note="s"
            onChange={v => { DBG_EFECTOS.PREMIO_DURACION_S = v; setEfx(o => ({ ...o, PREMIO_DURACION_S: v })); }} />
          <NumField label="ATRILES_DELAY_MS" value={efx.ATRILES_DELAY_MS} step={100} min={0} max={10000} note="ms"
            onChange={v => { DBG_EFECTOS.ATRILES_DELAY_MS = v; setEfx(o => ({ ...o, ATRILES_DELAY_MS: v })); }} />
    </>
  );
}

// sección: luz-huida-z76
export function SecLuzHuidaZ76() {
  const { tocarDia } = useDbg();
  const M = DBG_LUZ_MOV;
  const emitir = (n: string) => { window.dispatchEvent(new CustomEvent(n)); tocarDia(); };
  const tamAuto = M.TAM_CELDA_M === "auto";
  return (
    <>
          {/* Z76: la luz del camino LUZ huye cuando el usuario vuelve */}
          <span style={LABEL}>Huida de la luz Z76 <span style={NOTE}>(visita k → k − 1 huidas · live)</span></span>
          <div style={{ ...ROW, ...NOTE }}>
            <span>visitas {HUIDA.visitas} · pendientes {movimientosRestantes(HUIDA)} · celda ({HUIDA.col}, {HUIDA.fila}) · total {HUIDA.movsTotal} · {HUIDA.fase}{HUIDA.armada ? "" : " · sin armar"} · celda {tamCeldaLuz().toFixed(2)} m · d={LUZ_STATE.dLuz.toFixed(1)} m</span>
          </div>
          {([["ACTIVO", "off = como antes"], ["DIAGONALES", "azar en diagonal"], ["RESET_POR_VISITA", "vuelve al origen cada visita"], ["OVERLAY", "grilla + contadores"]] as const).map(([k, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{nota}</span></span>
              <button style={INPUT} onClick={() => { M[k] = !M[k]; tocarDia(); }}>{M[k] ? "ON" : "off"}</button>
            </div>
          ))}
          <div style={ROW}>
            <span>PERSISTENCIA</span>
            {(["sesion", "memoria"] as const).map(v => (
              <button key={v} style={{ ...INPUT, opacity: M.PERSISTENCIA === v ? 1 : 0.5 }} onClick={() => { M.PERSISTENCIA = v; tocarDia(); }}>{v}</button>
            ))}
          </div>
          <div style={ROW}>
            <span>TAM_CELDA_M <span style={NOTE}>{tamAuto ? "auto = diámetro del haz" : "m"}</span></span>
            <button style={{ ...INPUT, opacity: tamAuto ? 1 : 0.5 }} onClick={() => { M.TAM_CELDA_M = tamAuto ? +tamCeldaLuz().toFixed(1) : "auto"; tocarDia(); }}>auto</button>
            {!tamAuto && <input type="range" min={2} max={15} step={0.1} style={{ flex: 1 }} value={Number(M.TAM_CELDA_M)}
              onChange={e => { M.TAM_CELDA_M = parseFloat(e.target.value); tocarDia(); }} />}
          </div>
          {([
            ["DIST_HUIDA_M", 1, 20, 0.25, "m"], ["MOVER_S", 0.05, 3, 0.05, "s"], ["ANTICIPO_S", 0, 1, 0.01, "s (0 = sin)"], ["TEMBLOR_M", 0, 1, 0.01, "m"],
            ["ESPERA_S", 0, 5, 0.05, "s"], ["RADIO_CELDAS", 0, 6, 1, "celdas"], ["REARME_M", 2, 40, 0.5, "m"], ["CORREDOR_M", 0, 20, 0.5, "m"],
          ] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{M[k].toFixed(st < 0.1 ? 2 : st < 1 ? 1 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={M[k]}
                onChange={e => { M[k] = parseFloat(e.target.value); tocarDia(); }} />
            </div>
          ))}
          <NumField label="SEMILLA" value={M.SEMILLA === "auto" ? -1 : Number(M.SEMILLA)} step={1} min={-1} max={999999} note="−1 = auto · aplica al reiniciar visitas"
            onChange={v => { M.SEMILLA = v < 0 ? "auto" : Math.floor(v); tocarDia(); }} />
          <div style={ROW}>
            <button style={INPUT} onClick={e => { e.currentTarget.blur(); emitir("alight:luz-simular-visita"); }}>Simular visita +1</button>
            <button style={INPUT} onClick={e => { e.currentTarget.blur(); emitir("alight:luz-reiniciar-visitas"); }}>Reiniciar visitas</button>
          </div>
          <div style={ROW}>
            <button style={INPUT} onClick={e => { e.currentTarget.blur(); emitir("alight:luz-mover-ahora"); }}>Mover luz ahora</button>
            <button style={INPUT} onClick={e => { e.currentTarget.blur(); emitir("alight:luz-volver-origen"); }}>Volver al origen</button>
          </div>
    </>
  );
}

// sección: camino-luz-z28
export function SecCaminoLuzZ28() {
  const { luz, setLuz } = useDbg();
  return (
    <>
          <span style={LABEL}>Camino LUZ Z28 <span style={NOTE}>(live)</span></span>
          <div style={ROW}>
            <button style={INPUT} onClick={e => { e.currentTarget.blur(); window.dispatchEvent(new CustomEvent("alight:debug-teleport-luz")); }}>Teletransportar a la luz</button>
          </div>
          <div style={{ ...ROW, ...NOTE }}>
            <span>d={LUZ_STATE.dLuz.toFixed(1)} m · k={LUZ_STATE.cercania.toFixed(2)} · {LUZ_STATE.fase}{LUZ_STATE.fuera ? " · FUERA" : ""}{PAUSA.activa ? " · PAUSA" : ""}</span>
          </div>
          <div style={ROW}>
            <span>CAMINO_LUZ</span>
            <button style={INPUT} onClick={() => {
              const v = !luz.CAMINO_LUZ;
              DBG_LUZ.CAMINO_LUZ = v;
              setLuz(o => ({ ...o, CAMINO_LUZ: v }));
            }}>{luz.CAMINO_LUZ ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>LUZ_POS_MANUAL</span>
            <button style={INPUT} onClick={() => {
              const v = !luz.LUZ_POS_MANUAL;
              DBG_LUZ.LUZ_POS_MANUAL = v;
              setLuz(o => ({ ...o, LUZ_POS_MANUAL: v }));
            }}>{luz.LUZ_POS_MANUAL ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>PAREDES_ABIERTAS</span>
            <button style={INPUT} onClick={() => {
              const v = !luz.PAREDES_ABIERTAS;
              DBG_LUZ.PAREDES_ABIERTAS = v;
              setLuz(o => ({ ...o, PAREDES_ABIERTAS: v }));
            }}>{luz.PAREDES_ABIERTAS ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>LIMITES</span>
            <button style={INPUT} onClick={() => {
              const v = !luz.LIMITES;
              DBG_LUZ.LIMITES = v;
              setLuz(o => ({ ...o, LIMITES: v }));
            }}>{luz.LIMITES ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>PAUSA</span>
            <button style={INPUT} onClick={() => {
              const v = !luz.PAUSA;
              DBG_LUZ.PAUSA = v;
              setLuz(o => ({ ...o, PAUSA: v }));
            }}>{luz.PAUSA ? "ON" : "off"}</button>
          </div>
          <NumField label="LUZ_DISTANCIA_M" value={luz.LUZ_DISTANCIA_M} step={1} min={0} max={200} note="m desde el inicio"
            onChange={v => { DBG_LUZ.LUZ_DISTANCIA_M = v; setLuz(o => ({ ...o, LUZ_DISTANCIA_M: v })); }} />
          <NumField label="LUZ_POS_X" value={luz.LUZ_POS_X} step={0.5} min={-300} max={300} note="m (manual)"
            onChange={v => { DBG_LUZ.LUZ_POS_X = v; setLuz(o => ({ ...o, LUZ_POS_X: v })); }} />
          <NumField label="LUZ_POS_Z" value={luz.LUZ_POS_Z} step={0.5} min={-300} max={300} note="m (manual)"
            onChange={v => { DBG_LUZ.LUZ_POS_Z = v; setLuz(o => ({ ...o, LUZ_POS_Z: v })); }} />
          <NumField label="LUZ_ALTURA_M" value={luz.LUZ_ALTURA_M} step={0.1} min={1} max={20} note="m"
            onChange={v => { DBG_LUZ.LUZ_ALTURA_M = v; setLuz(o => ({ ...o, LUZ_ALTURA_M: v })); }} />
          <NumField label="LUZ_HALO_M" value={luz.LUZ_HALO_M} step={0.1} min={0.2} max={20} note="m"
            onChange={v => { DBG_LUZ.LUZ_HALO_M = v; setLuz(o => ({ ...o, LUZ_HALO_M: v })); }} />
          <NumField label="LUZ_INT_LEJOS" value={luz.LUZ_INT_LEJOS} step={0.05} min={0} max={10} note="lejos"
            onChange={v => { DBG_LUZ.LUZ_INT_LEJOS = v; setLuz(o => ({ ...o, LUZ_INT_LEJOS: v })); }} />
          <NumField label="LUZ_INT_CERCA" value={luz.LUZ_INT_CERCA} step={0.05} min={0} max={10} note="debajo"
            onChange={v => { DBG_LUZ.LUZ_INT_CERCA = v; setLuz(o => ({ ...o, LUZ_INT_CERCA: v })); }} />
          <NumField label="LUZ_D_LEJOS_M" value={luz.LUZ_D_LEJOS_M} step={1} min={1} max={200} note="m"
            onChange={v => { DBG_LUZ.LUZ_D_LEJOS_M = v; setLuz(o => ({ ...o, LUZ_D_LEJOS_M: v })); }} />
          <NumField label="LUZ_D_CERCA_M" value={luz.LUZ_D_CERCA_M} step={0.5} min={0} max={50} note="m"
            onChange={v => { DBG_LUZ.LUZ_D_CERCA_M = v; setLuz(o => ({ ...o, LUZ_D_CERCA_M: v })); }} />
          <NumField label="LUZ_CURVA" value={luz.LUZ_CURVA} step={0.1} min={0.1} max={8} note="exponente"
            onChange={v => { DBG_LUZ.LUZ_CURVA = v; setLuz(o => ({ ...o, LUZ_CURVA: v })); }} />
          <NumField label="CONO_RADIO_M" value={luz.CONO_RADIO_M} step={0.1} min={0.2} max={10} note="m"
            onChange={v => { DBG_LUZ.CONO_RADIO_M = v; setLuz(o => ({ ...o, CONO_RADIO_M: v })); }} />
          <NumField label="CONO_OPACIDAD" value={luz.CONO_OPACIDAD} step={0.01} min={0} max={1} note=""
            onChange={v => { DBG_LUZ.CONO_OPACIDAD = v; setLuz(o => ({ ...o, CONO_OPACIDAD: v })); }} />
          <NumField label="CONO_D_INICIO_M" value={luz.CONO_D_INICIO_M} step={1} min={1} max={100} note="m"
            onChange={v => { DBG_LUZ.CONO_D_INICIO_M = v; setLuz(o => ({ ...o, CONO_D_INICIO_M: v })); }} />
          <NumField label="POZO_OPACIDAD" value={luz.POZO_OPACIDAD} step={0.01} min={0} max={1} note=""
            onChange={v => { DBG_LUZ.POZO_OPACIDAD = v; setLuz(o => ({ ...o, POZO_OPACIDAD: v })); }} />
          <NumField label="ESTRELLAS_MAX" value={luz.ESTRELLAS_MAX} step={0.05} min={0} max={2} note="opacidad"
            onChange={v => { DBG_LUZ.ESTRELLAS_MAX = v; setLuz(o => ({ ...o, ESTRELLAS_MAX: v })); }} />
          <NumField label="ESTRELLAS_D_LEJOS_M" value={luz.ESTRELLAS_D_LEJOS_M} step={1} min={1} max={200} note="m"
            onChange={v => { DBG_LUZ.ESTRELLAS_D_LEJOS_M = v; setLuz(o => ({ ...o, ESTRELLAS_D_LEJOS_M: v })); }} />
          <NumField label="ESTRELLAS_D_CERCA_M" value={luz.ESTRELLAS_D_CERCA_M} step={0.5} min={0} max={50} note="m"
            onChange={v => { DBG_LUZ.ESTRELLAS_D_CERCA_M = v; setLuz(o => ({ ...o, ESTRELLAS_D_CERCA_M: v })); }} />
          <NumField label="ESTRELLAS_TAM_PX" value={luz.ESTRELLAS_TAM_PX} step={0.1} min={0.5} max={10} note="px"
            onChange={v => { DBG_LUZ.ESTRELLAS_TAM_PX = v; setLuz(o => ({ ...o, ESTRELLAS_TAM_PX: v })); }} />
          {/* Z73: movidos desde "Cielo estrellado Z30" (exterior, activación, giro, teletransporte y color de la luz) */}
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

// sección: dialogo-z27
export function SecDialogoZ27() {
  const { dlg, setDlg } = useDbg();
  return (
    <>
          <span style={LABEL}>Diálogo Z27 (terminal) <span style={NOTE}>(live)</span></span>
          <div style={ROW}>
            <button style={INPUT} onClick={e => { e.currentTarget.blur(); abrirDialogo(); }}>Probar diálogo</button>
            <button style={INPUT} onClick={() => cerrarDialogo()}>Cerrar</button>
          </div>
          <div style={ROW}>
            <span>MARCAR_PENDIENTES <span style={NOTE}>[LÍNEA PENDIENTE id]</span></span>
            <button style={INPUT} onClick={() => {
              const v = !dlg.MARCAR_PENDIENTES;
              DBG_DIALOGO.MARCAR_PENDIENTES = v;
              setDlg(o => ({ ...o, MARCAR_PENDIENTES: v }));
            }}>{dlg.MARCAR_PENDIENTES ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>POSICION</span>
            <button style={INPUT} onClick={() => {
              const orden = ["abajo", "izquierda", "derecha"] as const;
              const v = orden[(orden.indexOf(dlg.POSICION) + 1) % orden.length];
              DBG_DIALOGO.POSICION = v;
              setDlg(o => ({ ...o, POSICION: v }));
              window.dispatchEvent(new CustomEvent("alight:dialogo-config"));
            }}>{dlg.POSICION}</button>
          </div>
          <NumField label="VEL_CPS" value={dlg.VEL_CPS} step={2} min={0} max={200} note="letras/s (0 = instantáneo)"
            onChange={v => { DBG_DIALOGO.VEL_CPS = v; setDlg(o => ({ ...o, VEL_CPS: v })); }} />
          <NumField label="PAUSA_MS" value={dlg.PAUSA_MS} step={50} min={0} max={3000} note="entre líneas"
            onChange={v => { DBG_DIALOGO.PAUSA_MS = v; setDlg(o => ({ ...o, PAUSA_MS: v })); }} />
          <NumField label="ANCHO_VW" value={dlg.ANCHO_VW} step={1} min={20} max={60} note="% viewport"
            onChange={v => { DBG_DIALOGO.ANCHO_VW = v; setDlg(o => ({ ...o, ANCHO_VW: v })); window.dispatchEvent(new CustomEvent("alight:dialogo-config")); }} />
          <NumField label="ALTO_VH" value={dlg.ALTO_VH} step={1} min={10} max={60} note="% viewport, máx."
            onChange={v => { DBG_DIALOGO.ALTO_VH = v; setDlg(o => ({ ...o, ALTO_VH: v })); window.dispatchEvent(new CustomEvent("alight:dialogo-config")); }} />
          <NumField label="MARGEN_PX" value={dlg.MARGEN_PX} step={2} min={0} max={200} note="px al borde"
            onChange={v => { DBG_DIALOGO.MARGEN_PX = v; setDlg(o => ({ ...o, MARGEN_PX: v })); window.dispatchEvent(new CustomEvent("alight:dialogo-config")); }} />
          <NumField label="FUENTE_PX" value={dlg.FUENTE_PX} step={1} min={10} max={32} note="px"
            onChange={v => { DBG_DIALOGO.FUENTE_PX = v; setDlg(o => ({ ...o, FUENTE_PX: v })); window.dispatchEvent(new CustomEvent("alight:dialogo-config")); }} />
          <NumField label="HISTORIAL" value={dlg.HISTORIAL} step={1} min={1} max={20} note="líneas"
            onChange={v => { DBG_DIALOGO.HISTORIAL = v; setDlg(o => ({ ...o, HISTORIAL: v })); }} />
          <NumField label="CURSOR_PARPADEO_S" value={dlg.CURSOR_PARPADEO_S} step={0.1} min={0.1} max={5} note="Z35 cursor >"
            onChange={v => { DBG_DIALOGO.CURSOR_PARPADEO_S = v; setDlg(o => ({ ...o, CURSOR_PARPADEO_S: v })); window.dispatchEvent(new CustomEvent("alight:dialogo-config")); }} />
          <div style={ROW}>
            <span>RESALTADO_INVERTIDO <span style={NOTE}>Z35</span></span>
            <button style={INPUT} onClick={() => {
              const v = !dlg.RESALTADO_INVERTIDO;
              DBG_DIALOGO.RESALTADO_INVERTIDO = v;
              setDlg(o => ({ ...o, RESALTADO_INVERTIDO: v }));
              window.dispatchEvent(new CustomEvent("alight:dialogo-config"));
            }}>{dlg.RESALTADO_INVERTIDO ? "ON" : "off"}</button>
          </div>
    </>
  );
}
