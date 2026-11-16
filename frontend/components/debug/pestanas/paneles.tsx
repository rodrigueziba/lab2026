"use client";
// Z70: pestaña "Paneles y proyectos" del menú de debug. Cada sección es el código movido tal cual desde DebugMenu.tsx;
// toma del contexto (useDbg) solo el estado que usa. Registro y orden: lib/debugSecciones.ts.
import { DBG_PANELES, DBG_ORBITAS, DBG_LINTERNA, DBG_ACERC, DBG_SUBPANELES, DBG_AISLAR_UI, DBG_LOG_PANEL, DBG_PRIORIDAD, DBG_VIDEO, DBG_FOCO } from "@/lib/debugConfig";
import { PANELES_SILLAS } from "@/lib/alightStore";
import { LABEL, NOTE, ROW, INPUT, NumField, ColorField } from "../comun";
import { useDbg } from "../contexto";

// sección: paneles-sillas-p1
export function SecPanelesSillasP1() {
  const { paneles, setPaneles, panelesFase } = useDbg();
  return (
    <>
          <span style={LABEL}>Paneles SILLAS P1 <span style={NOTE}>(live)</span></span>
          <div style={ROW}>
            <span>PANELES_AUTO <span style={NOTE}>off = siempre visibles</span></span>
            <button style={INPUT} onClick={() => {
              const v = !paneles.PANELES_AUTO;
              DBG_PANELES.PANELES_AUTO = v;
              setPaneles(p => ({ ...p, PANELES_AUTO: v }));
            }}>{paneles.PANELES_AUTO ? "ON" : "off"}</button>
          </div>
          <NumField label="PANELES_FADE_IN_MS" value={paneles.PANELES_FADE_IN_MS} step={50} min={0} max={5000} note="live"
            onChange={v => { DBG_PANELES.PANELES_FADE_IN_MS = v; setPaneles(p => ({ ...p, PANELES_FADE_IN_MS: v })); }} />
          <NumField label="PANELES_FADE_OUT_MS" value={paneles.PANELES_FADE_OUT_MS} step={50} min={0} max={5000} note="live"
            onChange={v => { DBG_PANELES.PANELES_FADE_OUT_MS = v; setPaneles(p => ({ ...p, PANELES_FADE_OUT_MS: v })); }} />
          {/* Z1: marco y placeholder de los paneles de proyecto */}
          <NumField label="PANEL_MARGEN" value={paneles.PANEL_MARGEN} step={0.005} min={0} max={0.15} note="Z1 × ancho"
            onChange={v => { DBG_PANELES.PANEL_MARGEN = v; setPaneles(p => ({ ...p, PANEL_MARGEN: v })); }} />
          <NumField label="PANEL_REGLA" value={paneles.PANEL_REGLA} step={0.005} min={0} max={0.2} note="Z1 × ancho"
            onChange={v => { DBG_PANELES.PANEL_REGLA = v; setPaneles(p => ({ ...p, PANEL_REGLA: v })); }} />
          <NumField label="PANEL_OSCURO" value={paneles.PANEL_OSCURO} step={0.005} min={0} max={1} note="Z1 fuera de haz"
            onChange={v => { DBG_PANELES.PANEL_OSCURO = v; setPaneles(p => ({ ...p, PANEL_OSCURO: v })); }} />
          {/* Z6: reposo a oscuras, iluminado por haces y linterna */}
          <div style={ROW}>
            <span>PANEL_DISENO_VIEJO <span style={NOTE}>Z6 marco beige + regla</span></span>
            <button style={INPUT} onClick={() => {
              const v = !paneles.PANEL_DISENO_VIEJO;
              DBG_PANELES.PANEL_DISENO_VIEJO = v;
              setPaneles(p => ({ ...p, PANEL_DISENO_VIEJO: v }));
            }}>{paneles.PANEL_DISENO_VIEJO ? "ON" : "off"}</button>
          </div>
          <NumField label="PANEL_BRILLO_BASE" value={paneles.PANEL_BRILLO_BASE} step={0.001} min={0} max={0.2} note="Z6 ambiente"
            onChange={v => { DBG_PANELES.PANEL_BRILLO_BASE = v; setPaneles(p => ({ ...p, PANEL_BRILLO_BASE: v })); }} />
          <NumField label="PANEL_HAZ_INTENSIDAD" value={paneles.PANEL_HAZ_INTENSIDAD} step={0.1} min={0} max={6} note="Z6 haces"
            onChange={v => { DBG_PANELES.PANEL_HAZ_INTENSIDAD = v; setPaneles(p => ({ ...p, PANEL_HAZ_INTENSIDAD: v })); }} />
          <NumField label="PANEL_HAZ_COS" value={paneles.PANEL_HAZ_COS} step={0.001} min={0.9} max={0.9999} note="Z6 cono"
            onChange={v => { DBG_PANELES.PANEL_HAZ_COS = v; setPaneles(p => ({ ...p, PANEL_HAZ_COS: v })); }} />
          <NumField label="PANEL_HAZ_SUAVE" value={paneles.PANEL_HAZ_SUAVE} step={0.001} min={0.0005} max={0.05} note="Z6 borde cono"
            onChange={v => { DBG_PANELES.PANEL_HAZ_SUAVE = v; setPaneles(p => ({ ...p, PANEL_HAZ_SUAVE: v })); }} />
          <NumField label="PANEL_BORDE" value={paneles.PANEL_BORDE} step={0.001} min={0} max={0.05} note="Z6 borde carbón"
            onChange={v => { DBG_PANELES.PANEL_BORDE = v; setPaneles(p => ({ ...p, PANEL_BORDE: v })); }} />
          <NumField label="PANEL_BORDE_INT" value={paneles.PANEL_BORDE_INT} step={0.05} min={0} max={2} note="Z6"
            onChange={v => { DBG_PANELES.PANEL_BORDE_INT = v; setPaneles(p => ({ ...p, PANEL_BORDE_INT: v })); }} />
          <div style={ROW}>
            <span>PANEL_PLACEHOLDER <span style={NOTE}>Z1 sin foto / error</span></span>
            <button style={INPUT} onClick={() => {
              const v = !paneles.PANEL_PLACEHOLDER;
              DBG_PANELES.PANEL_PLACEHOLDER = v;
              setPaneles(p => ({ ...p, PANEL_PLACEHOLDER: v }));
            }}>{paneles.PANEL_PLACEHOLDER ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>PANEL_PLACEHOLDER_FORZAR <span style={NOTE}>Z1 todos</span></span>
            <button style={INPUT} onClick={() => {
              const v = !paneles.PANEL_PLACEHOLDER_FORZAR;
              DBG_PANELES.PANEL_PLACEHOLDER_FORZAR = v;
              setPaneles(p => ({ ...p, PANEL_PLACEHOLDER_FORZAR: v }));
            }}>{paneles.PANEL_PLACEHOLDER_FORZAR ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>estado <span style={NOTE}>{panelesFase}</span></span>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer" }}
              onClick={() => {
                const v = !PANELES_SILLAS.forzado;
                PANELES_SILLAS.forzado = v;
                setPaneles(p => ({ ...p, forzado: v }));
              }}>
              {paneles.forzado ? "Soltar paneles SILLAS" : "Forzar paneles SILLAS"}
            </button>
          </div>
    </>
  );
}
// sección: orbitas-z7-paneles-sillas
export function SecOrbitasZ7PanelesSillas() {
  const { orb, setOrb, orbInfo } = useDbg();
  return (
    <>
          <span style={LABEL}>Órbitas Z7 — paneles SILLAS <span style={NOTE}>(aplicar con Regenerar)</span></span>
          <div style={ROW}>
            <span>ORB_ORDENADAS <span style={NOTE}>off = anillos G5</span></span>
            <button style={INPUT} onClick={() => {
              const v = !orb.ORB_ORDENADAS;
              DBG_ORBITAS.ORB_ORDENADAS = v;
              setOrb(o => ({ ...o, ORB_ORDENADAS: v }));
            }}>{orb.ORB_ORDENADAS ? "ON" : "off"}</button>
          </div>
          <NumField label="PANELES_MAX" value={orb.PANELES_MAX} step={1} min={1} max={120} note="más recientes"
            onChange={v => { DBG_ORBITAS.PANELES_MAX = v; setOrb(o => ({ ...o, PANELES_MAX: v })); }} />
          <NumField label="ORB_ANILLOS" value={orb.ORB_ANILLOS} step={1} min={1} max={8} note="anillos"
            onChange={v => { DBG_ORBITAS.ORB_ANILLOS = v; setOrb(o => ({ ...o, ORB_ANILLOS: v })); }} />
          <NumField label="ORB_RADIO_MIN_M" value={orb.ORB_RADIO_MIN_M} step={0.5} min={8} max={27} note="m"
            onChange={v => { DBG_ORBITAS.ORB_RADIO_MIN_M = v; setOrb(o => ({ ...o, ORB_RADIO_MIN_M: v })); }} />
          <NumField label="ORB_RADIO_MAX_M" value={orb.ORB_RADIO_MAX_M} step={0.5} min={8} max={27} note="m"
            onChange={v => { DBG_ORBITAS.ORB_RADIO_MAX_M = v; setOrb(o => ({ ...o, ORB_RADIO_MAX_M: v })); }} />
          <NumField label="ORB_ALTURA_ALTERNA" value={orb.ORB_ALTURA_ALTERNA} step={0.05} min={0} max={1} note="abajo/arriba"
            onChange={v => { DBG_ORBITAS.ORB_ALTURA_ALTERNA = v; setOrb(o => ({ ...o, ORB_ALTURA_ALTERNA: v })); }} />
          <NumField label="ORB_VAR_M" value={orb.ORB_VAR_M} step={0.05} min={0} max={2} note="± m"
            onChange={v => { DBG_ORBITAS.ORB_VAR_M = v; setOrb(o => ({ ...o, ORB_VAR_M: v })); }} />
          <NumField label="ORB_VAR_FREQ" value={orb.ORB_VAR_FREQ} step={0.5} min={0} max={8} note="por vuelta"
            onChange={v => { DBG_ORBITAS.ORB_VAR_FREQ = v; setOrb(o => ({ ...o, ORB_VAR_FREQ: v })); }} />
          <NumField label="ORB_VEL_BASE" value={orb.ORB_VEL_BASE} step={1e-05} min={0} max={0.002} note="rad/frame"
            onChange={v => { DBG_ORBITAS.ORB_VEL_BASE = v; setOrb(o => ({ ...o, ORB_VEL_BASE: v })); }} />
          <NumField label="ORB_VEL_PASO" value={orb.ORB_VEL_PASO} step={0.05} min={0} max={3} note="× por anillo"
            onChange={v => { DBG_ORBITAS.ORB_VEL_PASO = v; setOrb(o => ({ ...o, ORB_VEL_PASO: v })); }} />
          <NumField label="ORB_SEP_MIN" value={orb.ORB_SEP_MIN} step={0.05} min={1} max={3} note="× ancho angular"
            onChange={v => { DBG_ORBITAS.ORB_SEP_MIN = v; setOrb(o => ({ ...o, ORB_SEP_MIN: v })); }} />
          <NumField label="ORB_LUZ_MIN" value={orb.ORB_LUZ_MIN} step={0.05} min={0} max={1} note="banda del haz"
            onChange={v => { DBG_ORBITAS.ORB_LUZ_MIN = v; setOrb(o => ({ ...o, ORB_LUZ_MIN: v })); }} />
          <NumField label="PANEL_ESCALA" value={orb.PANEL_ESCALA} step={0.05} min={0.5} max={3} note="× 3,6×2,4 m"
            onChange={v => { DBG_ORBITAS.PANEL_ESCALA = v; setOrb(o => ({ ...o, PANEL_ESCALA: v })); }} />
          <div style={ROW}>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer" }}
              onClick={() => window.dispatchEvent(new CustomEvent("alight:debug-regenerar-orbitas"))}>
              Regenerar órbitas
            </button>
          </div>
          <pre style={{ ...NOTE, whiteSpace: "pre-wrap", margin: "4px 0" }}>{orbInfo}</pre>
    </>
  );
}
// sección: linterna-z2-paneles-sillas
export function SecLinternaZ2PanelesSillas() {
  const { linterna, setLinterna, linternaLive } = useDbg();
  return (
    <>
          <span style={LABEL}>Linterna Z2 — paneles SILLAS <span style={NOTE}>(live)</span></span>
          <div style={ROW}>
            <span>LINTERNA_ACTIVA</span>
            <button style={INPUT} onClick={() => {
              const v = !linterna.LINTERNA_ACTIVA;
              DBG_LINTERNA.LINTERNA_ACTIVA = v;
              setLinterna(l => ({ ...l, LINTERNA_ACTIVA: v }));
            }}>{linterna.LINTERNA_ACTIVA ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>PANEL_SELECCION_REQUIERE_LIBERACION <span style={NOTE}>Z13 off = desde que se ven</span></span>
            <button style={INPUT} onClick={() => {
              const v = !linterna.PANEL_SELECCION_REQUIERE_LIBERACION;
              DBG_LINTERNA.PANEL_SELECCION_REQUIERE_LIBERACION = v;
              setLinterna(l => ({ ...l, PANEL_SELECCION_REQUIERE_LIBERACION: v }));
            }}>{linterna.PANEL_SELECCION_REQUIERE_LIBERACION ? "ON" : "off"}</button>
          </div>
          <NumField label="CONO_DEG" value={linterna.CONO_DEG} step={0.5} min={1} max={45} note="° luz"
            onChange={v => { DBG_LINTERNA.CONO_DEG = v; setLinterna(l => ({ ...l, CONO_DEG: v })); }} />
          <NumField label="ENTRA_DEG" value={linterna.ENTRA_DEG} step={0.5} min={0.5} max={30} note="° selección"
            onChange={v => { DBG_LINTERNA.ENTRA_DEG = v; setLinterna(l => ({ ...l, ENTRA_DEG: v })); }} />
          <NumField label="SALE_DEG" value={linterna.SALE_DEG} step={0.5} min={0.5} max={40} note="° suelta"
            onChange={v => { DBG_LINTERNA.SALE_DEG = v; setLinterna(l => ({ ...l, SALE_DEG: v })); }} />
          <NumField label="ABRIR_MS" value={linterna.ABRIR_MS} step={100} min={200} max={10000} note="→ abierto"
            onChange={v => { DBG_LINTERNA.ABRIR_MS = v; setLinterna(l => ({ ...l, ABRIR_MS: v })); }} />
          <NumField label="LUZ_INTENSIDAD" value={linterna.LUZ_INTENSIDAD} step={0.05} min={0} max={2} note="uLit"
            onChange={v => { DBG_LINTERNA.LUZ_INTENSIDAD = v; setLinterna(l => ({ ...l, LUZ_INTENSIDAD: v })); }} />
          <NumField label="LUZ_FADE_S" value={linterna.LUZ_FADE_S} step={0.5} min={0.5} max={40} note="1/s"
            onChange={v => { DBG_LINTERNA.LUZ_FADE_S = v; setLinterna(l => ({ ...l, LUZ_FADE_S: v })); }} />
          <NumField label="SEL_FADE_S" value={linterna.SEL_FADE_S} step={0.5} min={0.5} max={40} note="1/s marco"
            onChange={v => { DBG_LINTERNA.SEL_FADE_S = v; setLinterna(l => ({ ...l, SEL_FADE_S: v })); }} />
          <NumField label="ORBITA_VEL_MULT" value={linterna.ORBITA_VEL_MULT} step={0.1} min={0} max={5} note="× órbita"
            onChange={v => { DBG_LINTERNA.ORBITA_VEL_MULT = v; setLinterna(l => ({ ...l, ORBITA_VEL_MULT: v })); }} />
          <NumField label="MARCO_PAD_M" value={linterna.MARCO_PAD_M} step={0.05} min={0} max={1.5} note="m esquinas"
            onChange={v => { DBG_LINTERNA.MARCO_PAD_M = v; setLinterna(l => ({ ...l, MARCO_PAD_M: v })); }} />
          <div style={ROW}>
            <span>estado <span style={NOTE}>{linternaLive}</span></span>
          </div>
    </>
  );
}
// sección: acercamiento-z8
export function SecAcercamientoZ8() {
  const { acerc, setAcerc, subp, setSubp, aislar, setAislar, logPanelOn, setLogPanelOn, acercLive } = useDbg();
  return (
    <>
          <span style={LABEL}>Acercamiento Z8 <span style={NOTE}>(live)</span></span>
          <div style={ROW}>
            <span>ACERC_ACTIVO <span style={NOTE}>off = abre en órbita</span></span>
            <button style={INPUT} onClick={() => {
              const v = !acerc.ACERC_ACTIVO;
              DBG_ACERC.ACERC_ACTIVO = v;
              setAcerc(o => ({ ...o, ACERC_ACTIVO: v }));
            }}>{acerc.ACERC_ACTIVO ? "ON" : "off"}</button>
          </div>
          <NumField label="ACERC_PANTALLA" value={acerc.ACERC_PANTALLA} step={0.01} min={0.05} max={1} note="fracción ancho/alto"
            onChange={v => { DBG_ACERC.ACERC_PANTALLA = v; setAcerc(o => ({ ...o, ACERC_PANTALLA: v })); }} />
          <NumField label="ACERC_MS" value={acerc.ACERC_MS} step={50} min={100} max={5000} note="ms ida"
            onChange={v => { DBG_ACERC.ACERC_MS = v; setAcerc(o => ({ ...o, ACERC_MS: v })); }} />
          <NumField label="ACERC_VUELTA_MS" value={acerc.ACERC_VUELTA_MS} step={50} min={100} max={5000} note="ms vuelta"
            onChange={v => { DBG_ACERC.ACERC_VUELTA_MS = v; setAcerc(o => ({ ...o, ACERC_VUELTA_MS: v })); }} />
          <div style={ROW}>
            <span>ACERC_EASING <span style={NOTE}>sin rebote</span></span>
            <select style={{ ...INPUT, width: 90 }} value={acerc.ACERC_EASING} onChange={e => {
              const v = e.target.value as typeof DBG_ACERC.ACERC_EASING;
              DBG_ACERC.ACERC_EASING = v;
              setAcerc(o => ({ ...o, ACERC_EASING: v }));
            }}>
              <option value="seno">seno</option>
              <option value="suave">suave</option>
              <option value="cubica">cúbica</option>
            </select>
          </div>
          <div style={ROW}>
            <span>ACERC_ESPERA_CIERRE <span style={NOTE}>vuelve tras cerrar Z4</span></span>
            <button style={INPUT} onClick={() => {
              const v = !acerc.ACERC_ESPERA_CIERRE;
              DBG_ACERC.ACERC_ESPERA_CIERRE = v;
              setAcerc(o => ({ ...o, ACERC_ESPERA_CIERRE: v }));
            }}>{acerc.ACERC_ESPERA_CIERRE ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>SUB_AJUSTE_PANTALLA <span style={NOTE}>Z8 escala a pantalla</span></span>
            <button style={INPUT} onClick={() => {
              const v = !subp.SUB_AJUSTE_PANTALLA;
              DBG_SUBPANELES.SUB_AJUSTE_PANTALLA = v;
              setSubp(x => ({ ...x, SUB_AJUSTE_PANTALLA: v }));
            }}>{subp.SUB_AJUSTE_PANTALLA ? "ON" : "off"}</button>
          </div>
          <NumField label="SUB_MARGEN_PANTALLA" value={subp.SUB_MARGEN_PANTALLA} step={0.01} min={0} max={0.3} note="Z8 bordes"
            onChange={v => { DBG_SUBPANELES.SUB_MARGEN_PANTALLA = v; setSubp(x => ({ ...x, SUB_MARGEN_PANTALLA: v })); }} />
          <div style={ROW}>
            <span>SUB_AJUSTE_BLOQUE <span style={NOTE}>Z9 bloque centrado</span></span>
            <button style={INPUT} onClick={() => {
              const v = !subp.SUB_AJUSTE_BLOQUE;
              DBG_SUBPANELES.SUB_AJUSTE_BLOQUE = v;
              setSubp(x => ({ ...x, SUB_AJUSTE_BLOQUE: v }));
            }}>{subp.SUB_AJUSTE_BLOQUE ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>SUB_CONCAVO <span style={NOTE}>Z14 arco alrededor del ojo</span></span>
            <button style={INPUT} onClick={() => {
              const v = !subp.SUB_CONCAVO;
              DBG_SUBPANELES.SUB_CONCAVO = v;
              setSubp(x => ({ ...x, SUB_CONCAVO: v }));
            }}>{subp.SUB_CONCAVO ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>SUB_DOMO_CERCANO <span style={NOTE}>Z16 off = cóncavo Z14</span></span>
            <button style={INPUT} onClick={() => {
              const v = !subp.SUB_DOMO_CERCANO;
              DBG_SUBPANELES.SUB_DOMO_CERCANO = v;
              setSubp(x => ({ ...x, SUB_DOMO_CERCANO: v }));
            }}>{subp.SUB_DOMO_CERCANO ? "ON" : "off"}</button>
          </div>
          <NumField label="DOMO_RADIO_M" value={subp.DOMO_RADIO_M} step={0.1} min={1} max={10} note="Z16 m"
            onChange={v => { DBG_SUBPANELES.DOMO_RADIO_M = v; setSubp(x => ({ ...x, DOMO_RADIO_M: v })); }} />
          <NumField label="DOMO_LAT_DEG" value={subp.DOMO_LAT_DEG} step={1} min={10} max={60} note="Z16 ancho lateral"
            onChange={v => { DBG_SUBPANELES.DOMO_LAT_DEG = v; setSubp(x => ({ ...x, DOMO_LAT_DEG: v })); }} />
          <NumField label="DOMO_LAT_MIN_DEG" value={subp.DOMO_LAT_MIN_DEG} step={1} min={5} max={40} note="Z16 mínimo"
            onChange={v => { DBG_SUBPANELES.DOMO_LAT_MIN_DEG = v; setSubp(x => ({ ...x, DOMO_LAT_MIN_DEG: v })); }} />
          <NumField label="DOMO_FICHA_DEG" value={subp.DOMO_FICHA_DEG} step={1} min={10} max={70} note="Z16 ancho FICHA"
            onChange={v => { DBG_SUBPANELES.DOMO_FICHA_DEG = v; setSubp(x => ({ ...x, DOMO_FICHA_DEG: v })); }} />
          <NumField label="DOMO_SEP_DEG" value={subp.DOMO_SEP_DEG} step={0.5} min={0} max={15} note="Z16 separación"
            onChange={v => { DBG_SUBPANELES.DOMO_SEP_DEG = v; setSubp(x => ({ ...x, DOMO_SEP_DEG: v })); }} />
          <NumField label="DOMO_YAW_MAX_DEG" value={subp.DOMO_YAW_MAX_DEG} step={1} min={20} max={80} note="Z16 borde exterior"
            onChange={v => { DBG_SUBPANELES.DOMO_YAW_MAX_DEG = v; setSubp(x => ({ ...x, DOMO_YAW_MAX_DEG: v })); }} />
          <NumField label="DOMO_PITCH_MAX_DEG" value={subp.DOMO_PITCH_MAX_DEG} step={1} min={0} max={60} note="Z16 pitch del marco"
            onChange={v => { DBG_SUBPANELES.DOMO_PITCH_MAX_DEG = v; setSubp(x => ({ ...x, DOMO_PITCH_MAX_DEG: v })); }} />
          <div style={ROW}>
            <span>DOMO_CAPA_UI <span style={NOTE}>Z16 depthTest off</span></span>
            <button style={INPUT} onClick={() => {
              const v = !subp.DOMO_CAPA_UI;
              DBG_SUBPANELES.DOMO_CAPA_UI = v;
              setSubp(x => ({ ...x, DOMO_CAPA_UI: v }));
            }}>{subp.DOMO_CAPA_UI ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>SUB_DOMO_ESFERICO <span style={NOTE}>Z18 off = planos Z16</span></span>
            <button style={INPUT} onClick={() => {
              const v = !subp.SUB_DOMO_ESFERICO;
              DBG_SUBPANELES.SUB_DOMO_ESFERICO = v;
              setSubp(x => ({ ...x, SUB_DOMO_ESFERICO: v }));
            }}>{subp.SUB_DOMO_ESFERICO ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>ESF_PANEL_CONSERVAR_Z8 <span style={NOTE}>Z18 tamaño en pantalla de Z8</span></span>
            <button style={INPUT} onClick={() => {
              const v = !subp.ESF_PANEL_CONSERVAR_Z8;
              DBG_SUBPANELES.ESF_PANEL_CONSERVAR_Z8 = v;
              setSubp(x => ({ ...x, ESF_PANEL_CONSERVAR_Z8: v }));
            }}>{subp.ESF_PANEL_CONSERVAR_Z8 ? "ON" : "off"}</button>
          </div>
          <NumField label="ESF_PANEL_ANCHO_DEG" value={subp.ESF_PANEL_ANCHO_DEG} step={1} min={10} max={90} note="Z18 si no conserva"
            onChange={v => { DBG_SUBPANELES.ESF_PANEL_ANCHO_DEG = v; setSubp(x => ({ ...x, ESF_PANEL_ANCHO_DEG: v })); }} />
          <NumField label="ESF_PANEL_ALTO_DEG" value={subp.ESF_PANEL_ALTO_DEG} step={1} min={10} max={70} note="Z18 si no conserva"
            onChange={v => { DBG_SUBPANELES.ESF_PANEL_ALTO_DEG = v; setSubp(x => ({ ...x, ESF_PANEL_ALTO_DEG: v })); }} />
          <NumField label="ESF_PANEL_PITCH_DEG" value={subp.ESF_PANEL_PITCH_DEG} step={0.5} min={-30} max={30} note="Z18 panel y laterales"
            onChange={v => { DBG_SUBPANELES.ESF_PANEL_PITCH_DEG = v; setSubp(x => ({ ...x, ESF_PANEL_PITCH_DEG: v })); }} />
          <NumField label="ESF_LAT_ANCHO_DEG" value={subp.ESF_LAT_ANCHO_DEG} step={1} min={10} max={60} note="Z18 HISTORIA/GALERÍA"
            onChange={v => { DBG_SUBPANELES.ESF_LAT_ANCHO_DEG = v; setSubp(x => ({ ...x, ESF_LAT_ANCHO_DEG: v })); }} />
          <NumField label="ESF_LAT_ALTO_DEG" value={subp.ESF_LAT_ALTO_DEG} step={1} min={10} max={70} note="Z18"
            onChange={v => { DBG_SUBPANELES.ESF_LAT_ALTO_DEG = v; setSubp(x => ({ ...x, ESF_LAT_ALTO_DEG: v })); }} />
          <NumField label="ESF_LAT_YAW_DEG" value={subp.ESF_LAT_YAW_DEG} step={1} min={10} max={80} note="Z18 mínimo"
            onChange={v => { DBG_SUBPANELES.ESF_LAT_YAW_DEG = v; setSubp(x => ({ ...x, ESF_LAT_YAW_DEG: v })); }} />
          <NumField label="ESF_FICHA_ANCHO_DEG" value={subp.ESF_FICHA_ANCHO_DEG} step={1} min={10} max={90} note="Z18"
            onChange={v => { DBG_SUBPANELES.ESF_FICHA_ANCHO_DEG = v; setSubp(x => ({ ...x, ESF_FICHA_ANCHO_DEG: v })); }} />
          <NumField label="ESF_FICHA_ALTO_DEG" value={subp.ESF_FICHA_ALTO_DEG} step={1} min={5} max={60} note="Z18"
            onChange={v => { DBG_SUBPANELES.ESF_FICHA_ALTO_DEG = v; setSubp(x => ({ ...x, ESF_FICHA_ALTO_DEG: v })); }} />
          <NumField label="ESF_SEP_DEG" value={subp.ESF_SEP_DEG} step={0.5} min={0} max={15} note="Z18 entre bordes"
            onChange={v => { DBG_SUBPANELES.ESF_SEP_DEG = v; setSubp(x => ({ ...x, ESF_SEP_DEG: v })); }} />
          <NumField label="ESF_YAW_MAX_DEG" value={subp.ESF_YAW_MAX_DEG} step={1} min={20} max={90} note="Z18 borde exterior"
            onChange={v => { DBG_SUBPANELES.ESF_YAW_MAX_DEG = v; setSubp(x => ({ ...x, ESF_YAW_MAX_DEG: v })); }} />
          <NumField label="ESF_SEG_U" value={subp.ESF_SEG_U} step={1} min={2} max={96} note="Z18 recargar"
            onChange={v => { DBG_SUBPANELES.ESF_SEG_U = v; setSubp(x => ({ ...x, ESF_SEG_U: v })); }} />
          <NumField label="ESF_SEG_V" value={subp.ESF_SEG_V} step={1} min={2} max={96} note="Z18 recargar"
            onChange={v => { DBG_SUBPANELES.ESF_SEG_V = v; setSubp(x => ({ ...x, ESF_SEG_V: v })); }} />
          <NumField label="ESF_LINEA_GROSOR_DEG" value={subp.ESF_LINEA_GROSOR_DEG} step={0.1} min={0.1} max={5} note="Z18 líneas"
            onChange={v => { DBG_SUBPANELES.ESF_LINEA_GROSOR_DEG = v; setSubp(x => ({ ...x, ESF_LINEA_GROSOR_DEG: v })); }} />
          <div style={ROW}>
            <span>DOMO_CAPA_DEPTHTEST_VIEJO <span style={NOTE}>Z17 modo Z16 (con cortes), comparar</span></span>
            <button style={INPUT} onClick={() => {
              const v = !subp.DOMO_CAPA_DEPTHTEST_VIEJO;
              DBG_SUBPANELES.DOMO_CAPA_DEPTHTEST_VIEJO = v;
              setSubp(x => ({ ...x, DOMO_CAPA_DEPTHTEST_VIEJO: v }));
            }}>{subp.DOMO_CAPA_DEPTHTEST_VIEJO ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>DBG_AISLAR_UI <span style={NOTE}>Z17 ver cada elemento solo</span></span>
            <select style={{ ...INPUT, width: 120 }} value={aislar} onChange={e => {
              const v = e.target.value as typeof DBG_AISLAR_UI.MODO;
              DBG_AISLAR_UI.MODO = v;
              setAislar(v);
            }}>
              <option value="todo">todo</option>
              <option value="panel">solo panel</option>
              <option value="historia">solo HISTORIA</option>
              <option value="galeria">solo GALERÍA</option>
              <option value="ficha">solo FICHA</option>
              <option value="sin_marco">sin marco SEL ni líneas</option>
              <option value="sin_orbita">sin paneles en órbita</option>
            </select>
          </div>
          <NumField label="SUB_YAW_DEG" value={subp.SUB_YAW_DEG} step={1} min={10} max={80} note="Z14 laterales (mín.)"
            onChange={v => { DBG_SUBPANELES.SUB_YAW_DEG = v; setSubp(x => ({ ...x, SUB_YAW_DEG: v })); }} />
          <NumField label="SUB_YAW_MAX_DEG" value={subp.SUB_YAW_MAX_DEG} step={1} min={20} max={90} note="Z14 borde exterior"
            onChange={v => { DBG_SUBPANELES.SUB_YAW_MAX_DEG = v; setSubp(x => ({ ...x, SUB_YAW_MAX_DEG: v })); }} />
          <NumField label="SUB_PITCH_FICHA_DEG" value={subp.SUB_PITCH_FICHA_DEG} step={1} min={-80} max={-5} note="Z14 FICHA (mín.)"
            onChange={v => { DBG_SUBPANELES.SUB_PITCH_FICHA_DEG = v; setSubp(x => ({ ...x, SUB_PITCH_FICHA_DEG: v })); }} />
          <NumField label="SUB_DIST_FACTOR" value={subp.SUB_DIST_FACTOR} step={0.05} min={0.5} max={2} note="Z14 × distancia del panel"
            onChange={v => { DBG_SUBPANELES.SUB_DIST_FACTOR = v; setSubp(x => ({ ...x, SUB_DIST_FACTOR: v })); }} />
          <NumField label="CIERRE_MARGEN_DEG" value={acerc.CIERRE_MARGEN_DEG} step={1} min={0} max={45} note="Z14 región de cierre"
            onChange={v => { DBG_ACERC.CIERRE_MARGEN_DEG = v; setAcerc(o => ({ ...o, CIERRE_MARGEN_DEG: v })); }} />
          <NumField label="SUB_MARGEN_SEGURIDAD" value={subp.SUB_MARGEN_SEGURIDAD} step={0.01} min={0} max={0.3} note="Z9 por lado"
            onChange={v => { DBG_SUBPANELES.SUB_MARGEN_SEGURIDAD = v; setSubp(x => ({ ...x, SUB_MARGEN_SEGURIDAD: v })); }} />
          <NumField label="SUB_ESCALA_MIN" value={subp.SUB_ESCALA_MIN} step={0.05} min={0.1} max={1} note="Z9 legibilidad"
            onChange={v => { DBG_SUBPANELES.SUB_ESCALA_MIN = v; setSubp(x => ({ ...x, SUB_ESCALA_MIN: v })); }} />
          <NumField label="ACERC_AJUSTE_S" value={acerc.ACERC_AJUSTE_S} step={0.5} min={0.5} max={30} note="Z9 resize 1/s"
            onChange={v => { DBG_ACERC.ACERC_AJUSTE_S = v; setAcerc(o => ({ ...o, ACERC_AJUSTE_S: v })); }} />
          <NumField label="CIERRE_MARGEN" value={acerc.CIERRE_MARGEN} step={0.01} min={0} max={0.5} note="Z12 caja de cierre"
            onChange={v => { DBG_ACERC.CIERRE_MARGEN = v; setAcerc(o => ({ ...o, CIERRE_MARGEN: v })); }} />
          <NumField label="CIERRE_GRACIA_MS" value={acerc.CIERRE_GRACIA_MS} step={100} min={0} max={10000} note="Z12 desde abierto"
            onChange={v => { DBG_ACERC.CIERRE_GRACIA_MS = v; setAcerc(o => ({ ...o, CIERRE_GRACIA_MS: v })); }} />
          <NumField label="ESPERA_DATOS_MS" value={acerc.ESPERA_DATOS_MS} step={500} min={500} max={30000} note="Z12 tope sin datos"
            onChange={v => { DBG_ACERC.ESPERA_DATOS_MS = v; setAcerc(o => ({ ...o, ESPERA_DATOS_MS: v })); }} />
          <div style={ROW}>
            <span>DBG_LOG_PANEL <span style={NOTE}>Z12 log de transiciones en consola</span></span>
            <button style={INPUT} onClick={() => {
              const v = !logPanelOn;
              DBG_LOG_PANEL.LOG_ACTIVO = v;
              setLogPanelOn(v);
            }}>{logPanelOn ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>estado <span style={NOTE}>{acercLive}</span></span>
          </div>
    </>
  );
}
// sección: prioridad-z10-proyecto-abierto-sobre-las
export function SecPrioridadZ10ProyectoAbiertoSobreLas() {
  const { prio, setPrio } = useDbg();
  return (
    <>
          <span style={LABEL}>Prioridad Z10 — proyecto abierto sobre las órbitas <span style={NOTE}>(live)</span></span>
          <div style={ROW}>
            <span>PRIORIDAD_ACTIVA <span style={NOTE}>off = como Z9</span></span>
            <button style={INPUT} onClick={() => {
              const v = !prio.PRIORIDAD_ACTIVA;
              DBG_PRIORIDAD.PRIORIDAD_ACTIVA = v;
              setPrio(o => ({ ...o, PRIORIDAD_ACTIVA: v }));
            }}>{prio.PRIORIDAD_ACTIVA ? "ON" : "off"}</button>
          </div>
          <NumField label="ATENUAR_BRILLO" value={prio.ATENUAR_BRILLO} step={0.05} min={0} max={1} note="brillo de los demás"
            onChange={v => { DBG_PRIORIDAD.ATENUAR_BRILLO = v; setPrio(o => ({ ...o, ATENUAR_BRILLO: v })); }} />
          <NumField label="ATENUAR_MS" value={prio.ATENUAR_MS} step={50} min={0} max={5000} note="ms fundido"
            onChange={v => { DBG_PRIORIDAD.ATENUAR_MS = v; setPrio(o => ({ ...o, ATENUAR_MS: v })); }} />
          <div style={ROW}>
            <span>OCULTAR_SOLAPADOS <span style={NOTE}>esconde los que se cruzan</span></span>
            <button style={INPUT} onClick={() => {
              const v = !prio.OCULTAR_SOLAPADOS;
              DBG_PRIORIDAD.OCULTAR_SOLAPADOS = v;
              setPrio(o => ({ ...o, OCULTAR_SOLAPADOS: v }));
            }}>{prio.OCULTAR_SOLAPADOS ? "ON" : "off"}</button>
          </div>
          <NumField label="OCULTAR_MARGEN" value={prio.OCULTAR_MARGEN} step={0.01} min={0} max={0.5} note="zona extra"
            onChange={v => { DBG_PRIORIDAD.OCULTAR_MARGEN = v; setPrio(o => ({ ...o, OCULTAR_MARGEN: v })); }} />
          <NumField label="OCULTAR_PROF_M" value={prio.OCULTAR_PROF_M} step={0.5} min={0} max={30} note="m detrás del panel"
            onChange={v => { DBG_PRIORIDAD.OCULTAR_PROF_M = v; setPrio(o => ({ ...o, OCULTAR_PROF_M: v })); }} />
          <NumField label="RENDER_ORDER_BLOQUE" value={prio.RENDER_ORDER_BLOQUE} step={1} min={1} max={100} note="al montar"
            onChange={v => { DBG_PRIORIDAD.RENDER_ORDER_BLOQUE = v; setPrio(o => ({ ...o, RENDER_ORDER_BLOQUE: v })); }} />
    </>
  );
}
// sección: video-etapa-1
export function SecVideoEtapa1() {
  const { video, setVideo } = useDbg();
  return (
    <>
          <span style={LABEL}>Video — etapa 1 (reproductor aparte) <span style={NOTE}>(live)</span></span>
          <div style={ROW}>
            <span>YT_MODAL <span style={NOTE}>botón ▶ VER en FICHA</span></span>
            <button style={INPUT} onClick={() => {
              const v = !video.YT_MODAL;
              DBG_VIDEO.YT_MODAL = v;
              setVideo(o => ({ ...o, YT_MODAL: v }));
            }}>{video.YT_MODAL ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>YT_CLIC_PANEL <span style={NOTE}>clic en el panel abre el video</span></span>
            <button style={INPUT} onClick={() => {
              const v = !video.YT_CLIC_PANEL;
              DBG_VIDEO.YT_CLIC_PANEL = v;
              setVideo(o => ({ ...o, YT_CLIC_PANEL: v }));
            }}>{video.YT_CLIC_PANEL ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>YT_NOCOOKIE <span style={NOTE}>youtube-nocookie.com</span></span>
            <button style={INPUT} onClick={() => {
              const v = !video.YT_NOCOOKIE;
              DBG_VIDEO.YT_NOCOOKIE = v;
              setVideo(o => ({ ...o, YT_NOCOOKIE: v }));
            }}>{video.YT_NOCOOKIE ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>YT_RELOCK <span style={NOTE}>recapturar mouse al cerrar</span></span>
            <button style={INPUT} onClick={() => {
              const v = !video.YT_RELOCK;
              DBG_VIDEO.YT_RELOCK = v;
              setVideo(o => ({ ...o, YT_RELOCK: v }));
            }}>{video.YT_RELOCK ? "ON" : "off"}</button>
          </div>
    </>
  );
}
// sección: foco-z19-subpanel-agrandado
export function SecFocoZ19SubpanelAgrandado() {
  const { foco, setFoco, focoLive } = useDbg();
  return (
    <>
          <span style={LABEL}>Foco Z19 — subpanel agrandado <span style={NOTE}>(live)</span></span>
          <div style={ROW}>
            <span>SUB_FOCO</span>
            <button style={INPUT} onClick={() => {
              const v = !foco.SUB_FOCO;
              DBG_FOCO.SUB_FOCO = v;
              setFoco(o => ({ ...o, SUB_FOCO: v }));
            }}>{foco.SUB_FOCO ? "ON" : "off"}</button>
          </div>
          <NumField label="FOCO_DWELL_S" value={foco.FOCO_DWELL_S} step={0.1} min={0} max={5} note="s (0 = inmediato)"
            onChange={v => { DBG_FOCO.FOCO_DWELL_S = v; setFoco(o => ({ ...o, FOCO_DWELL_S: v })); }} />
          <NumField label="FOCO_MS" value={foco.FOCO_MS} step={25} min={50} max={3000} note="ms entrada/salida"
            onChange={v => { DBG_FOCO.FOCO_MS = v; setFoco(o => ({ ...o, FOCO_MS: v })); }} />
          <NumField label="FOCO_RADIO_M" value={foco.FOCO_RADIO_M} step={0.1} min={0.3} max={5} note="m"
            onChange={v => { DBG_FOCO.FOCO_RADIO_M = v; setFoco(o => ({ ...o, FOCO_RADIO_M: v })); }} />
          <NumField label="FOCO_PANTALLA" value={foco.FOCO_PANTALLA} step={0.01} min={0.2} max={1} note="fracción del viewport"
            onChange={v => { DBG_FOCO.FOCO_PANTALLA = v; setFoco(o => ({ ...o, FOCO_PANTALLA: v })); }} />
          <NumField label="FOCO_ANG_MAX_DEG" value={foco.FOCO_ANG_MAX_DEG} step={1} min={10} max={150} note="° tope"
            onChange={v => { DBG_FOCO.FOCO_ANG_MAX_DEG = v; setFoco(o => ({ ...o, FOCO_ANG_MAX_DEG: v })); }} />
          <NumField label="FOCO_SEGUIR_MIRADA" value={foco.FOCO_SEGUIR_MIRADA} step={0.05} min={0} max={1} note="fracción"
            onChange={v => { DBG_FOCO.FOCO_SEGUIR_MIRADA = v; setFoco(o => ({ ...o, FOCO_SEGUIR_MIRADA: v })); }} />
          <NumField label="FOCO_DESPL_MAX_DEG" value={foco.FOCO_DESPL_MAX_DEG} step={1} min={0} max={60} note="° tope corrimiento"
            onChange={v => { DBG_FOCO.FOCO_DESPL_MAX_DEG = v; setFoco(o => ({ ...o, FOCO_DESPL_MAX_DEG: v })); }} />
          <NumField label="FOCO_OTROS_OPACIDAD" value={foco.FOCO_OTROS_OPACIDAD} step={0.05} min={0} max={1} note="brillo del resto"
            onChange={v => { DBG_FOCO.FOCO_OTROS_OPACIDAD = v; setFoco(o => ({ ...o, FOCO_OTROS_OPACIDAD: v })); }} />
          <NumField label="FOCO_SALIDA_MARGEN_DEG" value={foco.FOCO_SALIDA_MARGEN_DEG} step={0.5} min={0} max={30} note="° histéresis"
            onChange={v => { DBG_FOCO.FOCO_SALIDA_MARGEN_DEG = v; setFoco(o => ({ ...o, FOCO_SALIDA_MARGEN_DEG: v })); }} />
          <NumField label="FOCO_GRACIA_S" value={foco.FOCO_GRACIA_S} step={0.05} min={0} max={5} note="s fuera"
            onChange={v => { DBG_FOCO.FOCO_GRACIA_S = v; setFoco(o => ({ ...o, FOCO_GRACIA_S: v })); }} />
          <NumField label="FOCO_COOLDOWN_S" value={foco.FOCO_COOLDOWN_S} step={0.05} min={0} max={5} note="s entre transiciones"
            onChange={v => { DBG_FOCO.FOCO_COOLDOWN_S = v; setFoco(o => ({ ...o, FOCO_COOLDOWN_S: v })); }} />
          <NumField label="FOCO_PLANO" value={foco.FOCO_PLANO} step={0.05} min={0} max={1} note="Z21 1 = plano, 0 = esfera"
            onChange={v => { DBG_FOCO.FOCO_PLANO = v; setFoco(o => ({ ...o, FOCO_PLANO: v })); }} />
          <div style={ROW}>
            <span>FOCO_SIN_ROLL <span style={NOTE}>Z21 arriba = cámara</span></span>
            <button style={INPUT} onClick={() => {
              const v = !foco.FOCO_SIN_ROLL;
              DBG_FOCO.FOCO_SIN_ROLL = v;
              setFoco(o => ({ ...o, FOCO_SIN_ROLL: v }));
            }}>{foco.FOCO_SIN_ROLL ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>FOCO_MODO_Z19 <span style={NOTE}>Z21 foco viejo (abanico)</span></span>
            <button style={INPUT} onClick={() => {
              const v = !foco.FOCO_MODO_Z19;
              DBG_FOCO.FOCO_MODO_Z19 = v;
              setFoco(o => ({ ...o, FOCO_MODO_Z19: v }));
            }}>{foco.FOCO_MODO_Z19 ? "ON" : "off"}</button>
          </div>
          <NumField label="FOCO_ENTRADA_MARGEN_DEG" value={foco.FOCO_ENTRADA_MARGEN_DEG} step={0.5} min={0} max={15} note="Z20 ° región de entrada"
            onChange={v => { DBG_FOCO.FOCO_ENTRADA_MARGEN_DEG = v; setFoco(o => ({ ...o, FOCO_ENTRADA_MARGEN_DEG: v })); }} />
          <NumField label="FOCO_PARPADEO_S" value={foco.FOCO_PARPADEO_S} step={0.01} min={0} max={1} note="Z20 s tolerados sin hit"
            onChange={v => { DBG_FOCO.FOCO_PARPADEO_S = v; setFoco(o => ({ ...o, FOCO_PARPADEO_S: v })); }} />
          <NumField label="FOCO_ESCALA_MIN" value={foco.FOCO_ESCALA_MIN} step={0.01} min={0.5} max={1} note="Z20 aparición mínima"
            onChange={v => { DBG_FOCO.FOCO_ESCALA_MIN = v; setFoco(o => ({ ...o, FOCO_ESCALA_MIN: v })); }} />
          <div style={ROW}>
            <span>FOCO_ANILLO <span style={NOTE}>Z20 progreso del dwell</span></span>
            <button style={INPUT} onClick={() => {
              const v = !foco.FOCO_ANILLO;
              DBG_FOCO.FOCO_ANILLO = v;
              setFoco(o => ({ ...o, FOCO_ANILLO: v }));
            }}>{foco.FOCO_ANILLO ? "ON" : "off"}</button>
          </div>
          <ColorField label="FOCO_ANILLO_COLOR" value={foco.FOCO_ANILLO_COLOR} note="Z20"
            onChange={v => { DBG_FOCO.FOCO_ANILLO_COLOR = v; setFoco(o => ({ ...o, FOCO_ANILLO_COLOR: v })); }} />
          <NumField label="FOCO_ANILLO_RADIO" value={foco.FOCO_ANILLO_RADIO} step={0.05} min={1} max={4} note="Z20 × retícula"
            onChange={v => { DBG_FOCO.FOCO_ANILLO_RADIO = v; setFoco(o => ({ ...o, FOCO_ANILLO_RADIO: v })); }} />
          <div style={ROW}>
            <span>FOCO_BORDE <span style={NOTE}>Z20 brillo de borde</span></span>
            <button style={INPUT} onClick={() => {
              const v = !foco.FOCO_BORDE;
              DBG_FOCO.FOCO_BORDE = v;
              setFoco(o => ({ ...o, FOCO_BORDE: v }));
            }}>{foco.FOCO_BORDE ? "ON" : "off"}</button>
          </div>
          <ColorField label="FOCO_BORDE_COLOR" value={foco.FOCO_BORDE_COLOR} note="Z20"
            onChange={v => { DBG_FOCO.FOCO_BORDE_COLOR = v; setFoco(o => ({ ...o, FOCO_BORDE_COLOR: v })); }} />
          <NumField label="FOCO_BORDE_ALFA" value={foco.FOCO_BORDE_ALFA} step={0.05} min={0} max={1} note="Z20"
            onChange={v => { DBG_FOCO.FOCO_BORDE_ALFA = v; setFoco(o => ({ ...o, FOCO_BORDE_ALFA: v })); }} />
          <NumField label="FOCO_BORDE_ANCHO" value={foco.FOCO_BORDE_ANCHO} step={0.005} min={0.002} max={0.2} note="Z20 fracción"
            onChange={v => { DBG_FOCO.FOCO_BORDE_ANCHO = v; setFoco(o => ({ ...o, FOCO_BORDE_ANCHO: v })); }} />
          <div style={ROW}>
            <span>estado <span style={NOTE}>{focoLive}</span></span>
          </div>
    </>
  );
}
// sección: subpaneles-z4-historia-galeria-ficha
export function SecSubpanelesZ4HistoriaGaleriaFicha() {
  const { subp, setSubp } = useDbg();
  return (
    <>
          <span style={LABEL}>Subpaneles Z4 — HISTORIA / GALERÍA / FICHA <span style={NOTE}>(live)</span></span>
          <div style={ROW}>
            <span>SUB_ACTIVO <span style={NOTE}>al abrir</span></span>
            <button style={INPUT} onClick={() => {
              const v = !subp.SUB_ACTIVO;
              DBG_SUBPANELES.SUB_ACTIVO = v;
              setSubp(x => ({ ...x, SUB_ACTIVO: v }));
            }}>{subp.SUB_ACTIVO ? "ON" : "off"}</button>
          </div>
          <NumField label="SUB_M_POR_PX" value={subp.SUB_M_POR_PX} step={0.0005} min={0.004} max={0.04} note="tamaño"
            onChange={v => { DBG_SUBPANELES.SUB_M_POR_PX = v; setSubp(x => ({ ...x, SUB_M_POR_PX: v })); }} />
          <NumField label="SUB_GAP_LATERAL_M" value={subp.SUB_GAP_LATERAL_M} step={0.1} min={0} max={6} note="m lados"
            onChange={v => { DBG_SUBPANELES.SUB_GAP_LATERAL_M = v; setSubp(x => ({ ...x, SUB_GAP_LATERAL_M: v })); }} />
          <NumField label="SUB_GAP_ABAJO_M" value={subp.SUB_GAP_ABAJO_M} step={0.1} min={0} max={6} note="m abajo"
            onChange={v => { DBG_SUBPANELES.SUB_GAP_ABAJO_M = v; setSubp(x => ({ ...x, SUB_GAP_ABAJO_M: v })); }} />
          <NumField label="SUB_ANIM_MS" value={subp.SUB_ANIM_MS} step={50} min={50} max={3000} note="ms salida"
            onChange={v => { DBG_SUBPANELES.SUB_ANIM_MS = v; setSubp(x => ({ ...x, SUB_ANIM_MS: v })); }} />
          <NumField label="SUB_ADELANTE_M" value={subp.SUB_ADELANTE_M} step={0.05} min={0} max={3} note="m hacia cámara"
            onChange={v => { DBG_SUBPANELES.SUB_ADELANTE_M = v; setSubp(x => ({ ...x, SUB_ADELANTE_M: v })); }} />
          <NumField label="SUB_RETENER_PAD_M" value={subp.SUB_RETENER_PAD_M} step={0.05} min={0} max={6} note="Z5 m margen"
            onChange={v => { DBG_SUBPANELES.SUB_RETENER_PAD_M = v; setSubp(x => ({ ...x, SUB_RETENER_PAD_M: v })); }} />
          <div style={ROW}>
            <span>SUB_LINEAS <span style={NOTE}>guías</span></span>
            <button style={INPUT} onClick={() => {
              const v = !subp.SUB_LINEAS;
              DBG_SUBPANELES.SUB_LINEAS = v;
              setSubp(x => ({ ...x, SUB_LINEAS: v }));
            }}>{subp.SUB_LINEAS ? "ON" : "off"}</button>
          </div>
          <div style={ROW}>
            <span>SUB_PUNTERO <span style={NOTE}>aro</span></span>
            <button style={INPUT} onClick={() => {
              const v = !subp.SUB_PUNTERO;
              DBG_SUBPANELES.SUB_PUNTERO = v;
              setSubp(x => ({ ...x, SUB_PUNTERO: v }));
            }}>{subp.SUB_PUNTERO ? "ON" : "off"}</button>
          </div>
          <NumField label="PUNTERO_RADIO_M" value={subp.PUNTERO_RADIO_M} step={0.01} min={0.05} max={1} note="Z5 retícula"
            onChange={v => { DBG_SUBPANELES.PUNTERO_RADIO_M = v; setSubp(x => ({ ...x, PUNTERO_RADIO_M: v })); }} />
          <NumField label="PUNTERO_GRACIA_MS" value={subp.PUNTERO_GRACIA_MS} step={100} min={0} max={5000} note="Z5 antes de cerrar"
            onChange={v => { DBG_SUBPANELES.PUNTERO_GRACIA_MS = v; setSubp(x => ({ ...x, PUNTERO_GRACIA_MS: v })); }} />
          <NumField label="PUNTERO_HISTERESIS" value={subp.PUNTERO_HISTERESIS} step={0.01} min={0} max={0.5} note="Z11 salida"
            onChange={v => { DBG_SUBPANELES.PUNTERO_HISTERESIS = v; setSubp(x => ({ ...x, PUNTERO_HISTERESIS: v })); }} />
          <NumField label="PUNTERO_PULSO_MS" value={subp.PUNTERO_PULSO_MS} step={10} min={0} max={1000} note="Z11 pulso clic"
            onChange={v => { DBG_SUBPANELES.PUNTERO_PULSO_MS = v; setSubp(x => ({ ...x, PUNTERO_PULSO_MS: v })); }} />
          <NumField label="PUNTERO_COOLDOWN_MS" value={subp.PUNTERO_COOLDOWN_MS} step={10} min={0} max={2000} note="Z11 entre clics"
            onChange={v => { DBG_SUBPANELES.PUNTERO_COOLDOWN_MS = v; setSubp(x => ({ ...x, PUNTERO_COOLDOWN_MS: v })); }} />
          <NumField label="PUNTERO_ESCALA_HOVER" value={subp.PUNTERO_ESCALA_HOVER} step={0.05} min={0.5} max={3} note="Z11 × radio"
            onChange={v => { DBG_SUBPANELES.PUNTERO_ESCALA_HOVER = v; setSubp(x => ({ ...x, PUNTERO_ESCALA_HOVER: v })); }} />
          <NumField label="PUNTERO_ESCALA_CLIC" value={subp.PUNTERO_ESCALA_CLIC} step={0.05} min={0.2} max={3} note="Z11 × radio"
            onChange={v => { DBG_SUBPANELES.PUNTERO_ESCALA_CLIC = v; setSubp(x => ({ ...x, PUNTERO_ESCALA_CLIC: v })); }} />
          <NumField label="PUNTERO_SUAVIZADO_S" value={subp.PUNTERO_SUAVIZADO_S} step={1} min={1} max={60} note="Z11 1/s"
            onChange={v => { DBG_SUBPANELES.PUNTERO_SUAVIZADO_S = v; setSubp(x => ({ ...x, PUNTERO_SUAVIZADO_S: v })); }} />
          <div style={ROW}>
            <span>PANEL_BLOQUEA_MOVIMIENTO <span style={NOTE}>Z5 sin WASD</span></span>
            <button style={INPUT} onClick={() => {
              const v = !subp.PANEL_BLOQUEA_MOVIMIENTO;
              DBG_SUBPANELES.PANEL_BLOQUEA_MOVIMIENTO = v;
              setSubp(x => ({ ...x, PANEL_BLOQUEA_MOVIMIENTO: v }));
            }}>{subp.PANEL_BLOQUEA_MOVIMIENTO ? "ON" : "off"}</button>
          </div>
          <NumField label="HISTORIA_RENGLONES" value={subp.HISTORIA_RENGLONES} step={1} min={3} max={20} note="al abrir"
            onChange={v => { DBG_SUBPANELES.HISTORIA_RENGLONES = v; setSubp(x => ({ ...x, HISTORIA_RENGLONES: v })); }} />
          <NumField label="GALERIA_AMBAR" value={subp.GALERIA_AMBAR} step={0.05} min={0} max={1} note="monocromo"
            onChange={v => { DBG_SUBPANELES.GALERIA_AMBAR = v; setSubp(x => ({ ...x, GALERIA_AMBAR: v })); }} />
          <NumField label="GALERIA_SCAN" value={subp.GALERIA_SCAN} step={0.02} min={0} max={1} note="scanlines"
            onChange={v => { DBG_SUBPANELES.GALERIA_SCAN = v; setSubp(x => ({ ...x, GALERIA_SCAN: v })); }} />
          <NumField label="GALERIA_CURVA" value={subp.GALERIA_CURVA} step={0.01} min={0} max={0.4} note="curvatura"
            onChange={v => { DBG_SUBPANELES.GALERIA_CURVA = v; setSubp(x => ({ ...x, GALERIA_CURVA: v })); }} />
    </>
  );
}