"use client";
// Z70: pestaña "Sol y ondas" del menú de debug. Cada sección es el código movido tal cual desde DebugMenu.tsx;
// toma del contexto (useDbg) solo el estado que usa. Registro y orden: lib/debugSecciones.ts.
import { DBG_SILLAS, DBG_ONDAS, DBG_SOL } from "@/lib/debugConfig";
import { crearEspera } from "@/lib/relojExperiencia";
import { LABEL, ROW, INPUT, NOTE, NumField } from "../comun";
import { useDbg } from "../contexto";

// sección: sol-n3
export function SecSolN3() {
  const { sillas, setSillas } = useDbg();
  return (
    <>
          <span style={LABEL}>Sol de la sala (N3) <span style={NOTE}>(live)</span></span>
          <NumField label="sunIntensity" value={sillas.sunIntensity} step={0.05} min={0} max={3} note="live"
            onChange={v => { DBG_SILLAS.sunIntensity = v; setSillas(s => ({ ...s, sunIntensity: v })); }} />
          <NumField label="sunAngularDeg" value={sillas.sunAngularDeg} step={0.5} min={0.5} max={20} note="live"
            onChange={v => { DBG_SILLAS.sunAngularDeg = v; setSillas(s => ({ ...s, sunAngularDeg: v })); }} />
          <div style={ROW}>
            <span>sunDriftEnabled <span style={NOTE}>debug drift</span></span>
            <button style={INPUT} onClick={() => {
              const v = !sillas.sunDriftEnabled;
              DBG_SILLAS.sunDriftEnabled = v;
              setSillas(s => ({ ...s, sunDriftEnabled: v }));
            }}>{sillas.sunDriftEnabled ? "ON" : "off"}</button>
          </div>
    </>
  );
}

// sección: ondas-por-kick-z52
export function SecOndasPorKickZ52() {
  const { tocarDia } = useDbg();
  return (
    <>
          {/* Z52: ondas expansivas por kick de cada luz/banda */}
          <span style={LABEL}>Ondas por kick Z52 <span style={NOTE}>(desde el portal hacia el domo · live)</span></span>
          <div style={ROW}>
            <span>ACTIVO</span>
            <button style={INPUT} onClick={() => { DBG_ONDAS.ACTIVO = !DBG_ONDAS.ACTIVO; tocarDia(); }}>{DBG_ONDAS.ACTIVO ? "ON" : "off"}</button>
          </div>
          {([
            ["MAX", 1, 8, 1, ""], ["VELOCIDAD_DEG_S", 5, 90, 1, "°/s"], ["ANCHO_DEG", 1, 30, 0.5, "°"], ["DURACION_S", 0.5, 8, 0.1, "s"],
            ["AMPLITUD", 0, 2, 0.05, "períodos"], ["BRILLO", 0, 1.5, 0.05, ""], ["BRILLO_NOCHE", 0, 2, 0.05, ""], ["TINTE_BANDA", 0, 1, 0.01, ""],
            ["REVELAR", 0, 1, 0.01, ""], ["UMBRAL", 1, 3, 0.05, "× media"], ["COOLDOWN_MS", 50, 1000, 10, "ms"], ["MEDIA_S", 0.1, 3, 0.05, "s"],
            ["MIN_ENERGIA", 0, 0.6, 0.01, ""], ["CONTRASTE", 0, 1, 0.01, "Z58"], ["ENGROSAR", 0, 1, 0.01, "Z58"], ["EVIDENCIA", 0, 2, 0.01, "Z58 0 = Z52 · 2 = doble"],
          ] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{DBG_ONDAS[k].toFixed(st < 0.01 ? 3 : 2)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={DBG_ONDAS[k]}
                onChange={e => { DBG_ONDAS[k] = parseFloat(e.target.value); tocarDia(); }} />
            </div>
          ))}
          {[0, 1, 2, 3].map(b => (
            <div key={b} style={ROW}>
              <span>GANANCIA_BANDA[{b}] <span style={NOTE}>{DBG_ONDAS.GANANCIA_BANDA[b].toFixed(2)} {["< 80 Hz", "80–250 Hz", "250 Hz–4 kHz", "> 4 kHz"][b]}</span></span>
              <input type="range" min={0} max={3} step={0.05} style={{ flex: 1 }} value={DBG_ONDAS.GANANCIA_BANDA[b]}
                onChange={e => { DBG_ONDAS.GANANCIA_BANDA[b] = parseFloat(e.target.value); tocarDia(); }} />
            </div>
          ))}
          <div style={ROW}>
            <span>Lanzar onda de prueba</span>
            {[0, 1, 2, 3].map(l => (
              <button key={l} style={INPUT} onClick={() => window.dispatchEvent(new CustomEvent("alight:onda-prueba", { detail: { luz: l } }))}>luz {l}</button>
            ))}
          </div>
          <div style={ROW}>
            <span>Prueba Z58 <span style={NOTE}>sin música</span></span>
            {/* una por banda, 0,4 s de diferencia (reloj de la experiencia: se congela con la pausa) */}
            <button style={INPUT} onClick={() => { for (let l = 0; l < 4; l++) crearEspera(400 * l, () => window.dispatchEvent(new CustomEvent("alight:onda-prueba", { detail: { luz: l } }))); }}>Lanzar 4 ondas escalonadas</button>
            {/* fuerza 3 = el máximo que puede dar el detector (energía normalizada 1 × GANANCIA_BANDA máx. 3) */}
            <button style={INPUT} onClick={() => window.dispatchEvent(new CustomEvent("alight:onda-prueba", { detail: { luz: 0, fuerza: 3 } }))}>Lanzar onda fuerte</button>
          </div>
    </>
  );
}

// sección: sol-nuevo-z51
export function SecSolNuevoZ51() {
  const { tocarDia } = useDbg();
  return (
    <>
          <span style={LABEL}>Sol del cielo (Z51) <span style={NOTE}>(núcleo, rayos y destello de lente · live)</span></span>
          {(["DISENO_NUEVO", "FLARE"] as const).map(k => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{k === "DISENO_NUEVO" ? "off = disco anterior" : "destello de lente"}</span></span>
              <button style={INPUT} onClick={() => { DBG_SOL[k] = !DBG_SOL[k]; tocarDia(); }}>{DBG_SOL[k] ? "ON" : "off"}</button>
            </div>
          ))}
          {([
            ["TAMANO", 0.05, 0.6, 0.01, "rad/unidad"], ["INTENSIDAD", 0, 3, 0.05, ""], ["NUCLEO", 0.01, 0.3, 0.005, "unidades"],
            ["HALO", 0, 3, 0.05, ""], ["RAYOS_N1", 1, 12, 1, "3 ref."], ["RAYOS_N2", 1, 24, 1, "9 ref."], ["RAYOS_ANCHO", 0.2, 6, 0.1, "exponente"],
            ["RAYOS_INT", 0, 3, 0.05, ""], ["PARPADEO", 0, 3, 0.05, ""], ["ROTACION_RAYOS_DEG_S", -30, 30, 0.5, "°/s"], ["ALCANCE", 0.1, 2, 0.05, "rad"],
            ["PALETA_PROYECTO", 0, 1, 0.01, "0 = referencia"], ["TINTE_ETAPA", 0, 1, 0.01, ""], ["TOPE", 0.5, 1, 0.01, "bloom 0,92"], ["TOPE_BRILLO", 0.3, 1, 0.01, "Z57 todo el sol (1 = sin tope)"], ["FLARE_CENTRO", 0, 0.6, 0.01, "fundido al centro"],
            ["FLARE_INTENSIDAD", 0, 2, 0.05, ""], ["FLARE_CANTIDAD", 1, 10, 1, ""], ["FLARE_TAMANO", 0.2, 3, 0.05, ""], ["FLARE_ALT_MIN_DEG", -5, 40, 1, "°"],
          ] as const).map(([k, mn, mx, st, nota]) => (
            <div key={k} style={ROW}>
              <span>{k} <span style={NOTE}>{DBG_SOL[k].toFixed(st < 0.01 ? 3 : 2)} {nota}</span></span>
              <input type="range" min={mn} max={mx} step={st} style={{ flex: 1 }} value={DBG_SOL[k]}
                onChange={e => { DBG_SOL[k] = parseFloat(e.target.value); tocarDia(); }} />
            </div>
          ))}
    </>
  );
}
