"use client";
// Z70: pestaña "Telón y entrada" del menú de debug. Cada sección es el código movido tal cual desde DebugMenu.tsx;
// toma del contexto (useDbg) solo el estado que usa. Registro y orden: lib/debugSecciones.ts.
import { DBG_SILLAS, DBG_INICIO, DBG_TELON_TEXTO, DBG_FLASH, DBG_ENTRADA } from "@/lib/debugConfig";
import { pedirMedicionFlash } from "@/lib/curtainFlash";
import { ENTRADA_POSE, calcularPoseEntrada } from "@/components/EntradaTelon";
import { ENTRADA } from "@/lib/entradaTelon";
import { LABEL, NOTE, NumField, ColorField, ROW, INPUT } from "../comun";
import { useDbg } from "../contexto";

// sección: telon-n6
export function SecTelonN6() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
          <span style={LABEL}>Telón N6 <span style={NOTE}>(live excepto distancia/tamaño/gather)</span></span>
          <NumField label="curtainWind"    value={sillas.curtainWind}    step={0.05} min={0}    max={5}     note="live"
            onChange={v => { DBG_SILLAS.curtainWind    = v; setSillas(s => ({ ...s, curtainWind:    v })); }} />
          <NumField label="curtainGravity" value={sillas.curtainGravity} step={0.1}  min={-20}  max={0}     note="live"
            onChange={v => { DBG_SILLAS.curtainGravity = v; setSillas(s => ({ ...s, curtainGravity: v })); }} />
          <NumField label="curtainDamping" value={sillas.curtainDamping} step={0.001} min={0.9} max={1}     note="live"
            onChange={v => { DBG_SILLAS.curtainDamping = v; setSillas(s => ({ ...s, curtainDamping: v })); }} />
          <NumField label="curtainLightIntensity" value={sillas.curtainLightIntensity} step={100} min={0} max={20000} note="live"
            onChange={v => { DBG_SILLAS.curtainLightIntensity = v; setSillas(s => ({ ...s, curtainLightIntensity: v })); }} />
          <ColorField label="curtainLightColor" value={sillas.curtainLightColor}
            onChange={v => { DBG_SILLAS.curtainLightColor = v; setSillas(s => ({ ...s, curtainLightColor: v })); }} />
          <div style={ROW}>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer" }}
              onClick={() => window.dispatchEvent(new CustomEvent("alight:debug-skip-curtain"))}>
              Saltar telón
            </button>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer" }}
              onClick={() => window.dispatchEvent(new CustomEvent("alight:debug-reset-curtain"))}>
              Reaparecer telón
            </button>
          </div>
    </>
  );
}
// sección: inicio-z24
export function SecInicioZ24() {
  const { inicio, setInicio } = useDbg();
  return (
    <>
          <span style={LABEL}>Inicio Z24 <span style={NOTE}>(recargar)</span></span>
          <NumField label="INICIO_RETROCESO_M" value={inicio.INICIO_RETROCESO_M} step={0.5} min={0} max={20} note="m lejos del telón"
            onChange={v => { DBG_INICIO.INICIO_RETROCESO_M = v; setInicio(o => ({ ...o, INICIO_RETROCESO_M: v })); }} />
          <NumField label="INICIO_PITCH_DEG" value={inicio.INICIO_PITCH_DEG} step={1} min={-20} max={20} note="Z25 ° mirada inicial"
            onChange={v => { DBG_INICIO.INICIO_PITCH_DEG = v; setInicio(o => ({ ...o, INICIO_PITCH_DEG: v })); }} />
    </>
  );
}
// sección: texto-del-telon-z46
export function SecTextoDelTelonZ46() {
  const { ttx, setTtx } = useDbg();
  return (
    <>
          {/* Z46: texto proyectado sobre el telón — en vivo (ACTIVO se aplica al remontar el telón) */}
          <span style={LABEL}>Texto del telón Z46 <span style={NOTE}>(recorte del reflector · live)</span></span>
          {(["ACTIVO", "INVERTIDO"] as const).map(k => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{k === "ACTIVO" ? "off = no se crea (al remontar el telón)" : "off = gobo (letras en sombra)"}</span></span>
              <button style={INPUT} onClick={() => { const v = !ttx[k]; DBG_TELON_TEXTO[k] = v; setTtx(o => ({ ...o, [k]: v })); }}>{ttx[k] ? "ON" : "off"}</button>
            </div>
          ))}
          {([
            ["TAMANO", 0.2, 1.2, 0.01, "× zona iluminada"], ["OFFSET_X_M", -4, 4, 0.05, "m"], ["OFFSET_Y_M", -3, 3, 0.05, "m"],
            ["OPACIDAD", 0, 1, 0.01, ""], ["BLUR_PX", 0, 30, 0.5, "recrea la textura"], ["PLIEGUE", 0, 1, 0.01, "0 = plano"],
            ["FADE_IN_S", 0, 8, 0.1, "s"], ["DURACION_S", 2, 120, 1, "s"], ["DIST_OCULTAR_M", 2, 40, 0.5, "m"],
            ["OSCURO_INV", 0, 1, 0.01, "invertido"], ["BRILLO_INV", 0, 3, 0.05, "invertido"],
          ] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{ttx[k].toFixed(2)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={ttx[k]}
                onChange={e => { const v = parseFloat(e.target.value); DBG_TELON_TEXTO[k] = v; setTtx(o => ({ ...o, [k]: v })); }} />
            </div>
          ))}
          <button style={INPUT} onClick={() => window.dispatchEvent(new CustomEvent("alight:telon-texto-reproducir"))}>Reproducir texto</button>
    </>
  );
}
// sección: destello-de-cortina-f1
export function SecDestelloDeCortinaF1() {
  const { flash, setFlash, flashLive, medicion } = useDbg();
  return (
    <>
          <span style={LABEL}>Destello de cortina F1 <span style={NOTE}>(live)</span></span>
          <div style={ROW}>
            <span>FLASH_ACTIVO</span>
            <button style={INPUT} onClick={() => {
              const v = !flash.FLASH_ACTIVO;
              DBG_FLASH.FLASH_ACTIVO = v;
              setFlash(f => ({ ...f, FLASH_ACTIVO: v }));
            }}>{flash.FLASH_ACTIVO ? "ON" : "off"}</button>
          </div>
          <NumField label="FLASH_SUBIDA_MS" value={flash.FLASH_SUBIDA_MS} step={10} min={0} max={2000} note="live"
            onChange={v => { DBG_FLASH.FLASH_SUBIDA_MS = v; setFlash(f => ({ ...f, FLASH_SUBIDA_MS: v })); }} />
          <NumField label="FLASH_SOSTENIDO_MS" value={flash.FLASH_SOSTENIDO_MS} step={50} min={0} max={4000} note="mín."
            onChange={v => { DBG_FLASH.FLASH_SOSTENIDO_MS = v; setFlash(f => ({ ...f, FLASH_SOSTENIDO_MS: v })); }} />
          <NumField label="FLASH_BAJADA_MS" value={flash.FLASH_BAJADA_MS} step={10} min={0} max={5000} note="exponencial"
            onChange={v => { DBG_FLASH.FLASH_BAJADA_MS = v; setFlash(f => ({ ...f, FLASH_BAJADA_MS: v })); }} />
          <NumField label="FLASH_PICO" value={flash.FLASH_PICO} step={0.05} min={0} max={1} note="opacidad"
            onChange={v => { DBG_FLASH.FLASH_PICO = v; setFlash(f => ({ ...f, FLASH_PICO: v })); }} />
          <NumField label="FLASH_BLOOM_MULT" value={flash.FLASH_BLOOM_MULT} step={0.1} min={1} max={12} note="× bloom"
            onChange={v => { DBG_FLASH.FLASH_BLOOM_MULT = v; setFlash(f => ({ ...f, FLASH_BLOOM_MULT: v })); }} />
          <NumField label="FLASH_EXPOSICION_MULT" value={flash.FLASH_EXPOSICION_MULT} step={0.1} min={1} max={12} note="× exposición"
            onChange={v => { DBG_FLASH.FLASH_EXPOSICION_MULT = v; setFlash(f => ({ ...f, FLASH_EXPOSICION_MULT: v })); }} />
          <NumField label="FLASH_LUZ_FADE_MS" value={flash.FLASH_LUZ_FADE_MS} step={50} min={0} max={4000} note="luz telón → 0"
            onChange={v => { DBG_FLASH.FLASH_LUZ_FADE_MS = v; setFlash(f => ({ ...f, FLASH_LUZ_FADE_MS: v })); }} />
          <NumField label="FLASH_TOPE_MS" value={flash.FLASH_TOPE_MS} step={100} min={500} max={10000} note="tope sostenido"
            onChange={v => { DBG_FLASH.FLASH_TOPE_MS = v; setFlash(f => ({ ...f, FLASH_TOPE_MS: v })); }} />
          <NumField label="FLASH_RM_PICO_MULT" value={flash.FLASH_RM_PICO_MULT} step={0.05} min={0} max={1} note="reduced-motion"
            onChange={v => { DBG_FLASH.FLASH_RM_PICO_MULT = v; setFlash(f => ({ ...f, FLASH_RM_PICO_MULT: v })); }} />
          <NumField label="FLASH_RM_SUBIDA_MS" value={flash.FLASH_RM_SUBIDA_MS} step={50} min={0} max={2000} note="reduced-motion"
            onChange={v => { DBG_FLASH.FLASH_RM_SUBIDA_MS = v; setFlash(f => ({ ...f, FLASH_RM_SUBIDA_MS: v })); }} />
          <div style={ROW}>
            <span>estado <span style={NOTE}>{flashLive.fase} · luz {flashLive.luz.toFixed(1)} · telón {flashLive.visible ? "visible" : "oculto"} · uFlash {flashLive.uFlash.toFixed(3)} · uGlare {flashLive.uGlare.toFixed(3)}</span></span>
          </div>
          <div style={ROW}>
            <span>FLASH_OVERLAY_DOM <span style={NOTE}>F2 on=overlay HTML sin CRT</span></span>
            <button style={INPUT} onClick={() => {
              const v = !flash.FLASH_OVERLAY_DOM;
              DBG_FLASH.FLASH_OVERLAY_DOM = v;
              setFlash(f => ({ ...f, FLASH_OVERLAY_DOM: v }));
            }}>{flash.FLASH_OVERLAY_DOM ? "ON" : "off"}</button>
          </div>
          <NumField label="FLASH_CRT_MAX" value={flash.FLASH_CRT_MAX} step={0.01} min={0} max={1} note="F2 tope uFlash"
            onChange={v => { DBG_FLASH.FLASH_CRT_MAX = v; setFlash(f => ({ ...f, FLASH_CRT_MAX: v })); }} />
          <NumField label="FLASH_GLOW" value={flash.FLASH_GLOW} step={0.05} min={0} max={2} note="F2 núcleo"
            onChange={v => { DBG_FLASH.FLASH_GLOW = v; setFlash(f => ({ ...f, FLASH_GLOW: v })); }} />
          <NumField label="FLASH_BAJADA_EXP_K" value={flash.FLASH_BAJADA_EXP_K} step={0.5} min={0} max={12} note="G1 curva caída"
            onChange={v => { DBG_FLASH.FLASH_BAJADA_EXP_K = v; setFlash(f => ({ ...f, FLASH_BAJADA_EXP_K: v })); }} />
          <NumField label="FLASH_GLARE_INICIO" value={flash.FLASH_GLARE_INICIO} step={0.05} min={0} max={1} note="G1"
            onChange={v => { DBG_FLASH.FLASH_GLARE_INICIO = v; setFlash(f => ({ ...f, FLASH_GLARE_INICIO: v })); }} />
          <NumField label="FLASH_GLARE_MS" value={flash.FLASH_GLARE_MS} step={100} min={0} max={10000} note="G1"
            onChange={v => { DBG_FLASH.FLASH_GLARE_MS = v; setFlash(f => ({ ...f, FLASH_GLARE_MS: v })); }} />
          <NumField label="FLASH_GLARE_EXP_K" value={flash.FLASH_GLARE_EXP_K} step={0.5} min={0} max={12} note="G1 curva glare"
            onChange={v => { DBG_FLASH.FLASH_GLARE_EXP_K = v; setFlash(f => ({ ...f, FLASH_GLARE_EXP_K: v })); }} />
          <NumField label="FLASH_GLARE_BLOOM" value={flash.FLASH_GLARE_BLOOM} step={0.05} min={0} max={1} note="G1 % del pico"
            onChange={v => { DBG_FLASH.FLASH_GLARE_BLOOM = v; setFlash(f => ({ ...f, FLASH_GLARE_BLOOM: v })); }} />
          <NumField label="FLASH_GLARE_ABERRACION" value={flash.FLASH_GLARE_ABERRACION} step={0.0005} min={0} max={0.02} note="G1 CA extra"
            onChange={v => { DBG_FLASH.FLASH_GLARE_ABERRACION = v; setFlash(f => ({ ...f, FLASH_GLARE_ABERRACION: v })); }} />
          <NumField label="FLASH_RM_BAJADA_MS" value={flash.FLASH_RM_BAJADA_MS} step={50} min={0} max={3000} note="reduced-motion"
            onChange={v => { DBG_FLASH.FLASH_RM_BAJADA_MS = v; setFlash(f => ({ ...f, FLASH_RM_BAJADA_MS: v })); }} />
          <NumField label="FLASH_RM_GLARE_MULT" value={flash.FLASH_RM_GLARE_MULT} step={0.05} min={0} max={1} note="reduced-motion"
            onChange={v => { DBG_FLASH.FLASH_RM_GLARE_MULT = v; setFlash(f => ({ ...f, FLASH_RM_GLARE_MULT: v })); }} />
          <NumField label="FLASH_SCAN_MAX" value={flash.FLASH_SCAN_MAX} step={0.01} min={0} max={0.5} note="F3 scan pico"
            onChange={v => { DBG_FLASH.FLASH_SCAN_MAX = v; setFlash(f => ({ ...f, FLASH_SCAN_MAX: v })); }} />
          <NumField label="FLASH_VIG_ATEN" value={flash.FLASH_VIG_ATEN} step={0.05} min={0} max={1} note="F3 viñeta"
            onChange={v => { DBG_FLASH.FLASH_VIG_ATEN = v; setFlash(f => ({ ...f, FLASH_VIG_ATEN: v })); }} />
          <NumField label="FLASH_TOPE_LUM" value={flash.FLASH_TOPE_LUM} step={0.01} min={0.92} max={1.5} note="F3 tope lum."
            onChange={v => { DBG_FLASH.FLASH_TOPE_LUM = v; setFlash(f => ({ ...f, FLASH_TOPE_LUM: v })); }} />
          {/* G3: perilla maestra (0 = sin destello visible, 1 = pico completo de G2) */}
          <div style={ROW}>
            <span>FLASH_INTENSIDAD <span style={NOTE}>G3 maestra</span></span>
            <input type="range" min={0} max={1} step={0.01} style={{ flex: 1 }}
              value={flash.FLASH_INTENSIDAD}
              onChange={e => {
                const v = parseFloat(e.target.value);
                DBG_FLASH.FLASH_INTENSIDAD = v;
                setFlash(f => ({ ...f, FLASH_INTENSIDAD: v }));
              }} />
            <span style={{ width: 34, textAlign: "right" }}>{flash.FLASH_INTENSIDAD.toFixed(2)}</span>
          </div>
          <NumField label="FLASH_BORDE" value={flash.FLASH_BORDE} step={0.05} min={0} max={1} note="G3 borde curvo"
            onChange={v => { DBG_FLASH.FLASH_BORDE = v; setFlash(f => ({ ...f, FLASH_BORDE: v })); }} />
          {/* G2: blanco enceguecedor */}
          <ColorField label="FLASH_COLOR" value={flash.FLASH_COLOR} note="G2 base"
            onChange={v => { DBG_FLASH.FLASH_COLOR = v; setFlash(f => ({ ...f, FLASH_COLOR: v })); }} />
          <ColorField label="FLASH_GLARE_COLOR" value={flash.FLASH_GLARE_COLOR} note="G2 borde glare"
            onChange={v => { DBG_FLASH.FLASH_GLARE_COLOR = v; setFlash(f => ({ ...f, FLASH_GLARE_COLOR: v })); }} />
          <NumField label="FLASH_HDR" value={flash.FLASH_HDR} step={0.5} min={1} max={16} note="G2 energía pre-CRT"
            onChange={v => { DBG_FLASH.FLASH_HDR = v; setFlash(f => ({ ...f, FLASH_HDR: v })); }} />
          <NumField label="FLASH_HDR_CLAMP" value={flash.FLASH_HDR_CLAMP} step={1} min={1} max={1000} note="G2 anti NaN"
            onChange={v => { DBG_FLASH.FLASH_HDR_CLAMP = v; setFlash(f => ({ ...f, FLASH_HDR_CLAMP: v })); }} />
          <NumField label="FLASH_BLOWOUT" value={flash.FLASH_BLOWOUT} step={0.01} min={0} max={1} note="G2 post-sRGB"
            onChange={v => { DBG_FLASH.FLASH_BLOWOUT = v; setFlash(f => ({ ...f, FLASH_BLOWOUT: v })); }} />
          <NumField label="FLASH_BLOWOUT_TEXTURA" value={flash.FLASH_BLOWOUT_TEXTURA} step={0.005} min={0} max={0.2} note="G2 scan+grano"
            onChange={v => { DBG_FLASH.FLASH_BLOWOUT_TEXTURA = v; setFlash(f => ({ ...f, FLASH_BLOWOUT_TEXTURA: v })); }} />
          <NumField label="FLASH_BLOOM_TOPE" value={flash.FLASH_BLOOM_TOPE} step={0.5} min={0} max={30} note="G2 clamp"
            onChange={v => { DBG_FLASH.FLASH_BLOOM_TOPE = v; setFlash(f => ({ ...f, FLASH_BLOOM_TOPE: v })); }} />
          <NumField label="FLASH_EXPOSICION_TOPE" value={flash.FLASH_EXPOSICION_TOPE} step={0.5} min={0.5} max={30} note="G2 clamp"
            onChange={v => { DBG_FLASH.FLASH_EXPOSICION_TOPE = v; setFlash(f => ({ ...f, FLASH_EXPOSICION_TOPE: v })); }} />
          <NumField label="FLASH_MEDIR_HOLD_MS" value={flash.FLASH_MEDIR_HOLD_MS} step={50} min={0} max={3000} note="G2 lectura"
            onChange={v => { DBG_FLASH.FLASH_MEDIR_HOLD_MS = v; setFlash(f => ({ ...f, FLASH_MEDIR_HOLD_MS: v })); }} />
          <div style={ROW}>
            <span>FLASH_AVISO_FOTOSENSIBILIDAD <span style={NOTE}>G2 aviso al inicio</span></span>
            <button style={INPUT} onClick={() => {
              const v = !flash.FLASH_AVISO_FOTOSENSIBILIDAD;
              DBG_FLASH.FLASH_AVISO_FOTOSENSIBILIDAD = v;
              setFlash(f => ({ ...f, FLASH_AVISO_FOTOSENSIBILIDAD: v }));
            }}>{flash.FLASH_AVISO_FOTOSENSIBILIDAD ? "ON" : "off"}</button>
          </div>
          {/* G2: medición REAL (píxeles leídos del canvas en el sostenido) */}
          <div style={ROW}>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer" }}
              onClick={() => pedirMedicionFlash()}>
              Medir pico del destello
            </button>
            <span style={NOTE}>{medicion.estado}{medicion.estado === "listo" ? ` · ${medicion.ancho}×${medicion.alto}` : ""}</span>
          </div>
          {medicion.estado === "listo" && (
            <div style={{ ...ROW, flexDirection: "column", alignItems: "flex-start" }}>
              <span>centro <span style={NOTE}>{medicion.centro.toFixed(4)} {medicion.centro >= 0.90 && medicion.centro <= 0.95 ? "✓ 0,90–0,95" : "fuera de 0,90–0,95"}</span></span>
              <span>intensidad <span style={NOTE}>{medicion.intensidad.toFixed(2)}</span></span>
              <span>esquina <span style={NOTE}>{medicion.esquina.toFixed(4)} {medicion.esquina >= 0.6 && medicion.esquina <= 0.75 ? "✓ 0,60–0,75" : "fuera de 0,60–0,75"}</span></span>
              <span>contraste CRT (centro − esquina) <span style={NOTE}>{medicion.contraste.toFixed(4)}</span></span>
              <span>5 % más oscuro <span style={NOTE}>{medicion.oscuro5.toFixed(4)}</span></span>
              <span>mín. RGB <span style={NOTE}>{medicion.minRGB.toFixed(4)}</span></span>
            </div>
          )}
          <div style={ROW}>
            <span>teórico (secundario) <span style={NOTE}>(valle scanline + grano) {flashLive.lum.toFixed(3)}</span></span>
          </div>
          <div style={ROW}>
            <button style={{ ...INPUT, width: "auto", padding: "3px 8px", cursor: "pointer" }}
              onClick={() => window.dispatchEvent(new CustomEvent("alight:debug-curtain-flash"))}>
              Disparar destello de cortina
            </button>
          </div>
    </>
  );
}
// sección: entrada-tras-el-telon-z59
export function SecEntradaTrasElTelonZ59() {
  const { tocarDia } = useDbg();
  return (
    <>
          {/* Z59: pose de entrada fija tras el telón */}
          <span style={LABEL}>Entrada tras el telón Z59 <span style={NOTE}>(teletransporte en el pico del destello · live)</span></span>
          <div style={ROW}>
            <span>ACTIVO <span style={NOTE}>off = queda donde cruzó</span></span>
            <button style={INPUT} onClick={() => { DBG_ENTRADA.ACTIVO = !DBG_ENTRADA.ACTIVO; tocarDia(); }}>{DBG_ENTRADA.ACTIVO ? "ON" : "off"}</button>
          </div>
          {([
            ["POS_X", -39, 39, 0.1, "m"], ["POS_Z", -39, 39, 0.1, "m"], ["YAW_DEG", -180, 180, 0.5, "°"], ["PITCH_DEG", -45, 45, 0.5, "°"],
            ["BLOQUEO_EXTRA_S", 0, 3, 0.05, "s tras el destello"], ["TOPE_S", 2, 30, 0.5, "s seguridad"], ["DESPLAZ_IZQ_M", -10, 10, 0.1, "m a la izq. (Z65)"],
          ] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{DBG_ENTRADA[k].toFixed(st < 0.1 ? 2 : 1)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={DBG_ENTRADA[k]}
                onChange={e => { DBG_ENTRADA[k] = parseFloat(e.target.value); tocarDia(); }} />
            </div>
          ))}
          <div style={ROW}>
            <button style={INPUT} onClick={() => { window.dispatchEvent(new CustomEvent("alight:entrada-guardar")); tocarDia(); }}>Guardar pose actual como entrada</button>
            <button style={INPUT} onClick={() => { window.dispatchEvent(new CustomEvent("alight:entrada-probar")); tocarDia(); }}>Probar entrada</button>
          </div>
          {ENTRADA_POSE.texto && <div style={ROW}><span style={NOTE}>{ENTRADA_POSE.texto}</span></div>}
          {/* Z65: mirar a la tarima tras el desplazamiento y pose final calculada */}
          <div style={ROW}>
            <span>MIRAR_TARIMA <span style={NOTE}>off = mismo yaw y pitch</span></span>
            <button style={INPUT} onClick={() => { DBG_ENTRADA.MIRAR_TARIMA = !DBG_ENTRADA.MIRAR_TARIMA; tocarDia(); }}>{DBG_ENTRADA.MIRAR_TARIMA ? "ON" : "off"}</button>
          </div>
          {(() => { const P = calcularPoseEntrada(); return (
            <div style={ROW}><span style={NOTE}>pose final: x {P.x.toFixed(2)} · z {P.z.toFixed(2)} · yaw {P.yawDeg.toFixed(1)}° · pitch {P.pitchDeg.toFixed(1)}°{P.ajustada ? " · AJUSTADA (caía en un obstáculo o fuera de la sala)" : ""}</span></div>
          ); })()}
          <div style={ROW}><span style={NOTE}>entrada: {ENTRADA.fase} · saltos {ENTRADA.teletransportes}</span></div>
    </>
  );
}