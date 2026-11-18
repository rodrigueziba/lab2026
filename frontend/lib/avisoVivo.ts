// Z85: aviso al espectador antes de recibir una transmisión en vivo de la tarima. Lógica PURA, sin imports
// (prueba: scripts/aviso-vivo-test.mjs). La une con la terminal de diálogo y Z82 lib/avisoVivoAcciones.ts.
// Texto y opciones: docs/dialogos/aviso-vivo.ink (compilado por npm run ink:build a public/alight/dialogo/aviso-vivo.json).
//
// - Aparece la primera vez que el usuario ENTRA al radio de efecto de cualquiera de los dos monolitos
//   (estado "acercandose" o "cerca" de Z82, o sea dentro de DBG_MONO_VIVO.RADIO_INICIO_M) mientras hay sesión.
//   Sin sesión no aparece (la estática no es una transmisión).
// - SOLO_UNA_VEZ (default): una sola vez por sesión del navegador (sessionStorage). Con false, pregunta en cada
//   entrada al radio mientras no se haya aceptado.
// - Decisiones: "si" (acepta: mezcla remota habilitada), "no" (sin transmisión: audio y visual propios),
//   "salir" (intenta cerrar la pestaña; si no se puede, pantalla final). Cerrar la terminal sin elegir = "no".
// - Mientras falta decidir y hay sesión, la mezcla remota exige aceptación (REQUIERE_ACEPTACION de Z82).

export type DecisionAviso = "ninguna" | "si" | "no" | "salir";
export interface CfgAviso { ACTIVO: boolean; SOLO_UNA_VEZ: boolean }
export interface EstadoAviso { decision: DecisionAviso; mostrado: boolean; abierto: boolean; dentroPrev: boolean }
export interface EntradaAviso { haySesion: boolean; dentro: boolean; terminalOcupada: boolean }

export function crearAviso(): EstadoAviso { return { decision: "ninguna", mostrado: false, abierto: false, dentroPrev: false }; }

/** Estados de Z82 que cuentan como "dentro del radio de efecto" (entrando, no alejándose). */
export function dentroDelRadio(estadoSonido: string, estadoVideo: string): boolean {
  const d = (e: string) => e === "acercandose" || e === "cerca";
  return d(estadoSonido) || d(estadoVideo);
}

/** ¿Hay que abrir el aviso en este cuadro? (detecta la ENTRADA al radio). Actualiza dentroPrev. */
export function debeAbrir(st: EstadoAviso, c: CfgAviso, e: EntradaAviso): boolean {
  const entra = e.dentro && !st.dentroPrev;
  st.dentroPrev = e.dentro;
  if (!c.ACTIVO || !e.haySesion || st.abierto || e.terminalOcupada) return false;
  if (st.decision === "si" || st.decision === "salir") return false;
  if (c.SOLO_UNA_VEZ) return e.dentro && !st.mostrado && st.decision === "ninguna";
  return entra;
}

export function marcarAbierto(st: EstadoAviso): void { st.abierto = true; st.mostrado = true; }
/** Elección del usuario (o cierre sin elegir = "no"). */
export function aplicarDecision(st: EstadoAviso, d: DecisionAviso): void { st.decision = d; st.abierto = false; }
export function reiniciarAviso(st: EstadoAviso): void { st.decision = "ninguna"; st.mostrado = false; st.abierto = false; st.dentroPrev = false; }

/** ¿La mezcla remota exige aceptación? (hay sesión, el aviso está activo y no se aceptó) */
export function requiereAceptacion(st: EstadoAviso, c: CfgAviso, haySesion: boolean): boolean {
  return c.ACTIVO && haySesion && st.decision !== "si";
}

/** Persistencia de la sesión del navegador (decisión y si ya se mostró). */
export function serializarAviso(st: EstadoAviso): string { return JSON.stringify({ v: 1, decision: st.decision, mostrado: st.mostrado }); }
export function restaurarAviso(st: EstadoAviso, txt: string | null): boolean {
  if (!txt) return false;
  try {
    const o = JSON.parse(txt) as { v?: number; decision?: string; mostrado?: boolean };
    if (o.v !== 1) return false;
    const d = o.decision;
    st.decision = d === "si" || d === "no" || d === "salir" ? d : "ninguna";
    st.mostrado = !!o.mostrado;
    return true;
  } catch { return false; }
}

/** Efectos del .ink → decisión. */
export const EFECTO_A_DECISION: Record<string, DecisionAviso> = {
  aviso_vivo_si: "si", aviso_vivo_no: "no", aviso_vivo_salir: "salir",
};
