"use client";
// Z70: pestaña "Flor, prisma y tarima" del menú de debug. Cada sección es el código movido tal cual desde DebugMenu.tsx;
// toma del contexto (useDbg) solo el estado que usa. Registro y orden: lib/debugSecciones.ts.
import { DBG_PRISM, DBG_FLOR, DBG_DIA, DBG_BASE_FLOR, DBG_CHECKPOINTS, DBG_FRACTAL } from "@/lib/debugConfig";
import { DIA, posicionarDia } from "@/lib/cicloDia";
import { AMANECER } from "@/lib/amanecer";
import { duracionTemaViz, idTemaViz } from "@/lib/vizAudio";
import { BASE } from "@/lib/baseFlor";
import { FLOR } from "@/lib/prismaFlor";
import { irACheckpoint } from "@/lib/checkpoints";
import { LABEL, NOTE, NumField, ROW, INPUT, ColorField } from "../comun";
import { useDbg } from "../contexto";

// sección: prism
export function SecPrism() {
  return (
    <>
          <span style={LABEL}>Prism <span style={NOTE}>(info)</span></span>
          <NumField label="landOffset (m)" value={DBG_PRISM.landOffset} note="reload to change" />
    </>
  );
}
// sección: prism-proximity
export function SecPrismProximity() {
  const { prism, setPrism } = useDbg();
  return (
    <>
          <span style={LABEL}>Prism proximity <span style={NOTE}>(N2 — live, absolute)</span></span>
          <NumField label="prismRangeScale" value={prism.prismRangeScale} note="legacy N1 — no longer applied" />
          <NumField label="spinDir" value={prism.spinDir} step={2} min={-1} max={1} note="live"
            onChange={v => { DBG_PRISM.spinDir = v; setPrism(p => ({ ...p, spinDir: v })); }} />
          <NumField label="nearM" value={prism.nearM} step={0.1} min={0} max={5} note="live"
            onChange={v => { DBG_PRISM.nearM = v; setPrism(p => ({ ...p, nearM: v })); }} />
          <NumField label="closeM" value={prism.closeM} step={0.1} min={0} max={3} note="live"
            onChange={v => { DBG_PRISM.closeM = v; setPrism(p => ({ ...p, closeM: v })); }} />
          <NumField label="maxEffectM" value={prism.maxEffectM} step={0.05} min={0} max={2} note="live"
            onChange={v => { DBG_PRISM.maxEffectM = v; setPrism(p => ({ ...p, maxEffectM: v })); }} />
          <NumField label="translucentMs" value={prism.translucentMs} step={500} min={100} note="live"
            onChange={v => { DBG_PRISM.translucentMs = v; setPrism(p => ({ ...p, translucentMs: v })); }} />
          <NumField label="translucentOpacity" value={prism.translucentOpacity} step={0.05} min={0} max={1} note="live"
            onChange={v => { DBG_PRISM.translucentOpacity = v; setPrism(p => ({ ...p, translucentOpacity: v })); }} />
          <NumField label="spinAccel" value={prism.spinAccel} step={1} min={0} max={20} note="live"
            onChange={v => { DBG_PRISM.spinAccel = v; setPrism(p => ({ ...p, spinAccel: v })); }} />
    </>
  );
}
// sección: prisma-y-flor-z54
export function SecPrismaYFlorZ54() {
  const { tocarDia } = useDbg();
  return (
    <>
          {/* Z54: prisma y flor dentro del ciclo de día */}
          <span style={LABEL}>Prisma y flor Z54 <span style={NOTE}>(ciclo de día · live)</span></span>
          {(["ACTIVO", "PROX_USA_BASE", "ROLL_CABEZA_ACTIVO", "PETALO_ROLL_ACTIVO", "PETALO_ROLL_CAPAS", "COLOR_TALLO_ACTIVO", "COLOR_LINEAL"] as const).map(k => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{k === "ACTIVO" ? "off = prisma apoyado, sin flor" : k === "PROX_USA_BASE" ? "fractal con la posición apoyada" : "Z60"}</span></span>
              <button style={INPUT} onClick={() => { DBG_FLOR[k] = !DBG_FLOR[k]; tocarDia(); }}>{DBG_FLOR[k] ? "ON" : "off"}</button>
            </div>
          ))}
          {([
            ["SUBE_INICIO", 0, 1, 0.005, "tDia"], ["SUBE_FIN", 0, 1, 0.005, ""], ["NACE_INICIO", 0, 1, 0.005, ""], ["NACE_FIN", 0, 1, 0.005, ""],
            ["ACHICA_INICIO", 0, 1, 0.005, ""], ["ACHICA_FIN", 0, 1, 0.005, ""], ["BAJA_INICIO", 0, 1, 0.005, ""], ["BAJA_FIN", 0, 1, 0.005, ""],
            ["ESCALA", 0.2, 3, 0.05, "cabeza"], ["ALTURA_M", 0.5, 8, 0.1, "m (Z57: 1,8)"], ["ALTURA_FACTOR", 0.3, 1.5, 0.01, "Z57 × ALTURA_M"], ["ESCALA_CABEZA", 0.5, 1.5, 0.01, "Z57 diámetro"], ["RESPIRACION_S", 1, 20, 0.5, "s"], ["RESPIRACION_AMP", 0, 0.6, 0.01, ""],
            ["BALANCEO_M", 0, 0.6, 0.01, "m"], ["BALANCEO_S", 1, 20, 0.5, "s"], ["GIRO_DEG_S", -40, 40, 1, "°/s"], ["INCLINACION_DEG", 0, 40, 1, "°"],
            ["COLOR_VEL", 0, 0.5, 0.01, ""], ["PALETA_PROYECTO", 0, 1, 0.01, "0 = video"], ["BRILLO", 0.2, 2, 0.05, ""], ["MUSICA_APERTURA", 0, 1, 0.01, "graves"],
            ["GROSOR_TALLO", 0.3, 1.5, 0.01, "Z60"], ["ROLL_CABEZA_PERIODO_S", 1, 20, 0.1, "Z60 s/vuelta"], ["ROLL_CABEZA_AMP_DEG", 0, 360, 5, "Z60 (360 = vuelta)"], ["ROLL_CABEZA_SENTIDO", -1, 1, 2, "Z60"],
            ["ROLL_CABEZA_EJE_DEG", -180, 180, 5, "Z60 0 = hacia las sillas"], ["PETALO_ROLL_PERIODO_S", 1, 20, 0.1, "Z62 s"], ["PETALO_ROLL_AMP_DEG", 0, 300, 5, "Z62 vaivén"], ["PETALO_ROLL_DESFASE", 0, 0.2, 0.005, "Z62 vueltas"], ["PETALO_ROLL_FRENTE_DEG", -180, 180, 5, "Z62 °"], ["PETALO_ROLL_SENTIDO", -1, 1, 2, "Z62"],
            ["PETALO_ROLL_BASE_DEG", 0, 120, 1, "Z62 °"], ["PETALO_ACORTAR", 0, 0.9, 0.01, "Z62"], ["PETALO_ANCHO", 0.05, 0.3, 0.005, "Z62"], ["PETALO_GROSOR", 0.04, 0.3, 0.005, "Z62"],
            ["PETALO_LARGO", 0.2, 1, 0.01, "Z62"], ["ANILLO_R", 0, 0.6, 0.01, "Z62"],
            ["COLOR_ACOPLE", 0, 2, 0.01, "Z60"], ["DORSO_AZUL", 0, 1, 0.01, "Z60"], ["COLOR_TALLO_VEL", 0, 1, 0.01, "Z60"], ["MUSICA_ROLL", 0, 3, 0.05, "Z60 graves"],
          ] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{DBG_FLOR[k].toFixed(st < 0.01 ? 3 : 2)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={DBG_FLOR[k]}
                onChange={e => { DBG_FLOR[k] = parseFloat(e.target.value); tocarDia(); }} />
            </div>
          ))}
          <div style={ROW}>
            <span>PETALO_ROLL_OLA <span style={NOTE}>Z62</span></span>
            {(["frente", "anillo"] as const).map(m => (
              <button key={m} style={{ ...INPUT, opacity: DBG_FLOR.PETALO_ROLL_OLA === m ? 1 : 0.45 }}
                onClick={() => { DBG_FLOR.PETALO_ROLL_OLA = m; tocarDia(); }}>{m}</button>
            ))}
          </div>
          <div style={ROW}>
            <span>PETALO_ROLL_MODO <span style={NOTE}>Z62</span></span>
            {(["completo", "vaiven"] as const).map(m => (
              <button key={m} style={{ ...INPUT, opacity: DBG_FLOR.PETALO_ROLL_MODO === m ? 1 : 0.45 }}
                onClick={() => { DBG_FLOR.PETALO_ROLL_MODO = m; tocarDia(); }}>{m}</button>
            ))}
          </div>
          <div style={ROW}>
            <span>Probar flor <span style={NOTE}>recorre el ciclo a VELOCIDAD 24 (con el visualizador activo)</span></span>
            <button style={INPUT} onClick={() => {
              DBG_DIA.T_MANUAL = -1; DBG_DIA.VELOCIDAD = 24;
              if (DIA.fase === "espera") posicionarDia(DIA, DBG_DIA, 0.2, AMANECER, duracionTemaViz(), idTemaViz());
              tocarDia();
            }}>Probar flor</button>
            <button style={INPUT} onClick={() => { DBG_DIA.VELOCIDAD = 1; tocarDia(); }}>velocidad 1</button>
          </div>
    </>
  );
}
// sección: base-de-la-flor-z67
export function SecBaseDeLaFlorZ67() {
  const { tocarDia } = useDbg();
  return (
    <>
          {/* Z67: base de la flor (hueco, grietas, astillas, pasto) */}
          <span style={LABEL}>Base de la flor Z67 <span style={NOTE}>(hueco {BASE.hueco.toFixed(2)} · grietas {BASE.grietas.toFixed(2)} · pasto {BASE.pasto.toFixed(2)} · {BASE.fase} · live)</span></span>
          {(["ACTIVO", "PASTO_ACTIVO", "OVERLAY"] as const).map(k => (
            <div key={k} style={ROW}>
              <span>{k}</span>
              <button style={INPUT} onClick={() => { DBG_BASE_FLOR[k] = !DBG_BASE_FLOR[k]; tocarDia(); }}>{DBG_BASE_FLOR[k] ? "ON" : "off"}</button>
            </div>
          ))}
          {([
            ["RADIO_HUECO_M", 0.05, 0.6, 0.01, "m"], ["PROFUNDIDAD_M", 0.02, 0.6, 0.01, "m"], ["BRILLO_BORDE", 0, 1.5, 0.01, ""],
            ["N_GRIETAS", 0, 24, 1, ""], ["RADIO_GRIETAS_M", 0.3, 3, 0.05, "m"], ["ANCHO_GRIETA", 0.004, 0.08, 0.001, "m"],
            ["IRREGULARIDAD", 0, 1, 0.01, ""], ["ASTILLAS", 0, 24, 1, ""], ["PASTO_RADIO_M", 0.2, 1.5, 0.01, "m"],
            ["PASTO_ALTURA_M", 0.05, 0.8, 0.01, "m"], ["PASTO_CAPAS", 2, 16, 1, ""], ["SEMILLA", 1, 99, 1, ""],
          ] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{DBG_BASE_FLOR[k].toFixed(st < 0.01 ? 3 : st < 1 ? 2 : 0)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={DBG_BASE_FLOR[k]}
                onChange={e => { DBG_BASE_FLOR[k] = parseFloat(e.target.value); tocarDia(); }} />
            </div>
          ))}
          <div style={ROW}>
            <button style={INPUT} onClick={() => {
              // flor fija en su pico (tDia 0,5); si el ciclo con la flor no está montado, salta al checkpoint "dia_flor"
              if (!FLOR.activo && DBG_CHECKPOINTS.HABILITADOS) irACheckpoint("dia_flor");
              DBG_DIA.T_MANUAL = 0.5; tocarDia();
            }}>Mostrar base con flor</button>
            <button style={INPUT} onClick={() => {
              DBG_DIA.T_MANUAL = -1; DBG_DIA.VELOCIDAD = 3;
              posicionarDia(DIA, DBG_DIA, Math.max(0, DBG_FLOR.NACE_INICIO - 0.01), AMANECER, duracionTemaViz(), idTemaViz());
              window.dispatchEvent(new CustomEvent("alight:base-flor-reiniciar"));
              tocarDia();
            }}>Animar nacimiento</button>
            <button style={INPUT} onClick={() => {
              DBG_DIA.T_MANUAL = -1; DBG_DIA.VELOCIDAD = 1;
              window.dispatchEvent(new CustomEvent("alight:base-flor-reiniciar"));
              tocarDia();
            }}>Reiniciar</button>
          </div>
    </>
  );
}
// sección: fractal-del-prisma-z43
export function SecFractalDelPrismaZ43() {
  const { frc, setFrc } = useDbg();
  return (
    <>
          {/* Z43: fractal de las caras del prisma (jungle fractal II) — todo en vivo */}
          <span style={LABEL}>Fractal del prisma Z43 <span style={NOTE}>(caras · live)</span></span>
          {(["DISENO_NUEVO", "PALETA_ORIGINAL", "CELULAR_ON", "CARAS_DISTINTAS", "USAR_TEXTURA", "TEX_RES_DINAMICA", "RUIDO_TEXTURA", "ADAPTATIVO"] as const).map(k => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{k === "DISENO_NUEVO" ? "off = fractal anterior" : k === "PALETA_ORIGINAL" ? "Z44 · off = dorado Z43" : k === "CELULAR_ON" ? "recompila el material" : k === "CARAS_DISTINTAS" ? "uSemilla por cara (fuerza por píxel)" : k === "USAR_TEXTURA" ? "Z45 · off = por píxel" : k === "RUIDO_TEXTURA" ? "Z45 · recompila" : "Z45"}</span></span>
              <button style={INPUT} onClick={() => {
                const v = !frc[k];
                DBG_FRACTAL[k] = v;
                setFrc(o => ({ ...o, [k]: v }));
              }}>{frc[k] ? "ON" : "off"}</button>
            </div>
          ))}
          {([
            ["PROX_FORZADA", -1, 1, 0.01, "−1 = off"],
            ["TINTE_PRISMA", 0, 1, 0.01, "Z44 → color de la cara"], ["OPACIDAD_ORIGINAL", 0, 1, 0.01, "Z44"],
            ["ASPECTO_ORIGINAL", 0.2, 1.5, 0.0025, "Z44 alto/ancho"], ["GRANO_RES", 0, 2560, 10, "Z44 0 = continuo"],
            ["ENCUADRE_Y_M", -1, 1.5, 0.01, "Z44 m"], ["COMPENSAR_SALIDA", 0, 2, 1, "Z44 2 ACES+sRGB · 1 sRGB · 0"], ["COMP_TOPE_LINEAL", 0.2, 10, 0.05, "Z44 bloom"],
            ["TEX_RES", 128, 2048, 64, "Z45 px"], ["TEX_FPS", 0, 60, 1, "Z45 0 = cada frame"], ["TEX_RES_CERCA", 128, 2048, 64, "Z45 px"],
            ["TEX_UMBRAL_CERCA", 0, 1, 0.01, "Z45 prox"], ["TEX_HISTERESIS", 0, 0.3, 0.01, "Z45"], ["MS_MAX", 8, 60, 1, "Z45 ms"],
            ["ADAPT_MARGEN", 0.3, 1, 0.05, "Z45"], ["ADAPT_BAJAR_S", 0.2, 5, 0.1, "Z45 s"], ["ADAPT_SUBIR_S", 0.5, 10, 0.1, "Z45 s"],
            ["DIST_INICIO_M", 1, 15, 0.1, "m"], ["DIST_MAX_M", 0, 5, 0.05, "m"],
            ["INERCIA_60", 0.005, 1, 0.005, "por frame a 60 fps"], ["VEL_MIN", 0, 3, 0.01, ""], ["VEL_MAX", 0, 5, 0.05, ""],
            ["OPACIDAD", 0, 1, 0.01, ""], ["ALFA_OSCURO", 0, 1, 0.01, ""], ["BRILLO", 0, 3, 0.05, ""], ["BRILLO_PROX", 0, 5, 0.05, ""],
            ["ITERACIONES", 1, 32, 1, ""], ["ZOOM", 0.2, 6, 0.05, ""], ["BAILOUT", 1, 40, 0.5, ""], ["X", -1.5, 1.5, 0.005, ""], ["Y", -1.5, 1.5, 0.005, ""],
            ["OFFSET_X", -2, 2, 0.01, ""], ["OFFSET_Y", -2, 2, 0.01, ""], ["DEPTH_CULL", 0, 1, 0.005, ""], ["GRANO", 0, 2, 0.05, ""],
            ["ESCALA", 0.1, 2, 0.01, "cara → coord."], ["CENTRO_X", -1, 2, 0.01, ""], ["CENTRO_Y", -1, 2, 0.01, ""],
            ["PROX_MIN_MUSICA", 0, 1, 0.01, ""], ["MUSICA_GRAVES", 0, 2, 0.05, "zoom"], ["MUSICA_MEDIOS", 0, 2, 0.05, "X, Y"],
            ["MUSICA_AGUDOS", 0, 2, 0.05, "brillo"], ["MUSICA_SUAVE_S", 0.01, 1, 0.01, "s"], ["MUSICA_ENTRADA_S", 0.05, 3, 0.05, "s"],
          ] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{frc[k].toFixed(st < 0.01 ? 3 : 2)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={frc[k]}
                onChange={e => { const v = parseFloat(e.target.value); DBG_FRACTAL[k] = v; setFrc(o => ({ ...o, [k]: v })); }} />
            </div>
          ))}
          {(["COLOR_OSCURO", "COLOR_MEDIO", "COLOR_CLARO"] as const).map(k => (
            <ColorField key={k} label={k} value={frc[k]} onChange={v => { DBG_FRACTAL[k] = v; setFrc(o => ({ ...o, [k]: v })); }} />
          ))}
    </>
  );
}