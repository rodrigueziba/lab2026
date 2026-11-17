// Z76: la luz del camino LUZ "huye" cuando el usuario vuelve. Lógica PURA (sin imports), testeable en Node
// (scripts/luz-huida-test.mjs). La usan lib/luzMovimiento.ts (estado de la sesión) y components/LuzHuida.tsx (tick).
//
// Visitas: una por cada apertura de la terminal al llegar bajo la luz (LuzLejana, fase girando → dialogo).
// En la visita k (k ≥ 2) la luz se mueve k − 1 veces: movimientosRestantes = visitas − movsVisita.
// Cada vez que el usuario (armado) se acerca a menos de DIST_HUIDA_M, la luz se mueve una celda (anticipo de temblor
// ANTICIPO_S → deslizamiento MOVER_S → espera ESPERA_S). Agotados los movimientos, se queda y se puede llegar.
// Mientras queden movimientos (con el usuario armado) o la luz se esté moviendo, no se abre la terminal.
// Armado: después de una visita hay que alejarse más de REARME_M (si no, huiría en cuanto el usuario se va).
//
// Tablero: celdas de tam m (TAM_CELDA_M "auto" = diámetro total del haz) centradas en el origen de la luz. Ejes
// fijados en la PRIMERA huida de la sesión: F = del usuario hacia la luz ("delante"), R = su derecha en three
// ((−F.z, F.x), como la derecha de la cámara con yaw). Columna = sobre R, fila = sobre F.
// Secuencia: 1.º izquierda (col − 1) · 2.º atrás, alejándose del usuario (fila + 1) · 3.º derecha (col + 1) · después
// al azar entre las vecinas (ortogonales y, con DIAGONALES, diagonales) dentro de RADIO_CELDAS (distancia de tablero:
// max(|col|, |fila|)), sin la celda del usuario, válidas para la sala, y evitando volver a la inmediata anterior si hay
// otra. Si un paso de la secuencia no es posible, se usa el azar. Si no hay ninguna celda posible, ese movimiento se
// consume (la luz se queda). Posición acumulativa en la sesión; RESET_POR_VISITA vuelve al origen al rearmar.
// Azar: mulberry32 con semilla por sesión (SEMILLA "auto" = aleatoria, o un número). Sin allocations por frame.

export type FaseHuida = "quieta" | "anticipo" | "mueve" | "espera";
export interface CfgHuida {
  ACTIVO: boolean; DIST_HUIDA_M: number; MOVER_S: number; ANTICIPO_S: number; ESPERA_S: number;
  RADIO_CELDAS: number; DIAGONALES: boolean; RESET_POR_VISITA: boolean; REARME_M: number;
}
export interface EstadoHuida {
  visitas: number; movsVisita: number; movsTotal: number;
  col: number; fila: number; colPrev: number; filaPrev: number; hayPrev: boolean;
  ejes: boolean; fx: number; fz: number;
  semilla: number; rng: number;
  armada: boolean; resetPend: boolean;
  fase: FaseHuida; t: number;
  pc: number; pf: number; c0: number; f0: number; c1: number; f1: number;   // posición animada (en celdas)
}
const fin = (x: number, d: number): number => (Number.isFinite(x) ? x : d);

export function crearEstadoHuida(semilla = 1): EstadoHuida {
  return {
    visitas: 0, movsVisita: 0, movsTotal: 0, col: 0, fila: 0, colPrev: 0, filaPrev: 0, hayPrev: false,
    ejes: false, fx: 0, fz: 1, semilla: semilla | 0, rng: semilla | 0, armada: true, resetPend: false,
    fase: "quieta", t: 0, pc: 0, pf: 0, c0: 0, f0: 0, c1: 0, f1: 0,
  };
}

/** Semilla: "auto" (o inválida) = aleatoria (aleatorio en [0, 1)); un número = ese número. */
export function semillaDe(v: string | number, aleatorio: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (v === "auto" || v === "" || !Number.isFinite(n)) return Math.floor(fin(aleatorio, 0.5) * 2147483647) | 0;
  return Math.floor(n) | 0;
}
/** Azar reproducible (mulberry32) sobre s.rng. */
export function azar(s: EstadoHuida): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Diámetro total del haz en el suelo: el mayor entre el charco (radio 1,5 × CONO_RADIO_M, LuzLejana), el cono
 *  (radio CONO_RADIO_M) y el halo (LUZ_HALO_M). Hoy 2 × 1,5 × 2,4 = 7,2 m. */
export function diametroHaz(conoRadioM: number, haloM: number): number {
  const r = Math.max(0, fin(conoRadioM, 2.4));
  return Math.max(2 * r * 1.5, 2 * r, Math.max(0, fin(haloM, 0)));
}
/** Tamaño de celda: "auto" = diámetro del haz, o el número dado (> 0). */
export function tamCelda(v: string | number, diametro: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return v === "auto" || !Number.isFinite(n) || n <= 0 ? diametro : n;
}

/** Movimientos que le quedan a esta visita (visita k = visitas + 1 → k − 1 movimientos). */
export function movimientosRestantes(s: EstadoHuida): number {
  return s.visitas >= 1 ? Math.max(0, s.visitas - s.movsVisita) : 0;
}
/** ¿La huida impide abrir la terminal ahora? (quedan movimientos con el usuario armado, o la luz se mueve). */
export function bloqueaActivacion(s: EstadoHuida): boolean {
  return s.fase === "anticipo" || s.fase === "mueve" || (s.armada && movimientosRestantes(s) > 0);
}

/** Apertura de la terminal bajo la luz = una visita. */
export function registrarVisita(s: EstadoHuida, c: Pick<CfgHuida, "RESET_POR_VISITA">): void {
  s.visitas++; s.movsVisita = 0; s.armada = false;
  s.resetPend = !!c.RESET_POR_VISITA;
}
/** Consume los movimientos pendientes de la visita actual (checkpoint luz_dialogo: que se abra la terminal). */
export function consumirVisita(s: EstadoHuida): void { s.movsVisita = Math.max(s.movsVisita, s.visitas); }
/** "Reiniciar visitas": contador, tablero, ejes y azar a cero; la luz vuelve al origen al instante. */
export function reiniciarHuida(s: EstadoHuida, semilla: number): void {
  const n = crearEstadoHuida(semilla);
  for (const k of Object.keys(n) as (keyof EstadoHuida)[]) (s as unknown as Record<string, unknown>)[k] = n[k];
}

/** Fija los ejes del tablero con la dirección usuario → luz (dx, dz). Solo la primera vez. */
export function fijarEjes(s: EstadoHuida, dx: number, dz: number): void {
  if (s.ejes) return;
  const l = Math.hypot(dx, dz);
  if (l < 1e-6) { s.fx = 0; s.fz = 1; } else { s.fx = dx / l; s.fz = dz / l; }
  s.ejes = true;
}
/** Desplazamiento (m) de la celda (col, fila) respecto del origen. */
export function offsetCelda(s: EstadoHuida, col: number, fila: number, tam: number, out: { x: number; z: number }): { x: number; z: number } {
  const a = col * tam, b = fila * tam;   // R = (−fz, fx), F = (fx, fz)
  out.x = -a * s.fz + b * s.fx; out.z = a * s.fx + b * s.fz;
  return out;
}
/** Celda (redondeada) del punto (vx, vz) relativo al origen. */
export function celdaDe(s: EstadoHuida, vx: number, vz: number, tam: number, out: { col: number; fila: number }): { col: number; fila: number } {
  const t = Math.max(1e-6, tam);
  out.col = Math.round((-vx * s.fz + vz * s.fx) / t); out.fila = Math.round((vx * s.fx + vz * s.fz) / t);
  return out;
}
/** Desplazamiento actual de la luz (m): posición animada + temblor en el anticipo. 0 sin ejes. */
export function desplazamientoEn(s: EstadoHuida, tam: number, temblorM: number, out: { x: number; z: number }): { x: number; z: number } {
  if (!s.ejes) { out.x = 0; out.z = 0; return out; }
  offsetCelda(s, s.pc, s.pf, tam, out);
  if (s.fase === "anticipo") {
    const a = Math.max(0, fin(temblorM, 0));
    out.x += a * Math.sin(s.t * 71); out.z += a * Math.cos(s.t * 53);
  }
  return out;
}

/** Celda de tablero válida para la sala (la usa celdaValida de luzMovimiento). La luz no se acerca a la sala más que
 *  su origen (bajo ella hay que seguir "fuera del área") y su disco caminable (EXTERIOR_RADIO_M) sigue tocando la sala
 *  con un corredor de al menos corredorM. salaM = medio lado caminable. */
export function posicionValidaSala(x: number, z: number, bordeOrigen: number, salaM: number, exteriorR: number, corredorM: number): boolean {
  const borde = Math.max(Math.abs(x), Math.abs(z));
  if (borde < bordeOrigen - 1e-6) return false;
  const dx = Math.max(Math.abs(x) - salaM, 0), dz = Math.max(Math.abs(z) - salaM, 0);
  return Math.hypot(dx, dz) <= Math.max(0, exteriorR - Math.max(0, corredorM));
}

// candidatas preasignadas (8 vecinas × 2)
const _cand = new Int32Array(16);
const SECUENCIA = [[-1, 0], [0, 1], [1, 0]] as const;   // izquierda, atrás, derecha
const _ok = (s: EstadoHuida, R: number, col: number, fila: number, uc: number, uf: number, valida: (c: number, f: number) => boolean): boolean =>
  !(col === s.col && fila === s.fila) && Math.max(Math.abs(col), Math.abs(fila)) <= R && !(col === uc && fila === uf) && valida(col, fila);

/** Elige la próxima celda. Escribe out y devuelve true, o false si no hay ninguna posible. */
export function elegirCelda(s: EstadoHuida, c: Pick<CfgHuida, "RADIO_CELDAS" | "DIAGONALES">, uc: number, uf: number,
  valida: (col: number, fila: number) => boolean, out: { col: number; fila: number }): boolean {
  const R = Math.max(0, Math.floor(fin(c.RADIO_CELDAS, 3)));
  if (s.movsTotal < SECUENCIA.length) {
    const [dc, df] = SECUENCIA[s.movsTotal];
    if (_ok(s, R, s.col + dc, s.fila + df, uc, uf, valida)) { out.col = s.col + dc; out.fila = s.fila + df; return true; }
  }
  let n = 0, hayPrev = false;
  for (let dc = -1; dc <= 1; dc++) for (let df = -1; df <= 1; df++) {
    if (dc === 0 && df === 0) continue;
    if (!c.DIAGONALES && dc !== 0 && df !== 0) continue;
    const cc = s.col + dc, ff = s.fila + df;
    if (!_ok(s, R, cc, ff, uc, uf, valida)) continue;
    _cand[n * 2] = cc; _cand[n * 2 + 1] = ff; n++;
    if (s.hayPrev && cc === s.colPrev && ff === s.filaPrev) hayPrev = true;
  }
  if (n === 0) return false;
  // evitar la inmediata anterior si hay otra opción: se la saca de la lista
  if (hayPrev && n > 1) {
    for (let i = 0; i < n; i++) if (_cand[i * 2] === s.colPrev && _cand[i * 2 + 1] === s.filaPrev) {
      _cand[i * 2] = _cand[(n - 1) * 2]; _cand[i * 2 + 1] = _cand[(n - 1) * 2 + 1]; n--; break;
    }
  }
  const k = Math.min(n - 1, Math.floor(azar(s) * n));
  out.col = _cand[k * 2]; out.fila = _cand[k * 2 + 1];
  return true;
}

/** Arranca el movimiento hacia (col, fila). cuenta = es una huida (suma a la visita y a la secuencia). */
export function iniciarMovimiento(s: EstadoHuida, col: number, fila: number, cuenta: boolean, c: Pick<CfgHuida, "ANTICIPO_S">): void {
  s.colPrev = s.col; s.filaPrev = s.fila; s.hayPrev = true;
  s.col = col; s.fila = fila;
  s.c0 = s.pc; s.f0 = s.pf; s.c1 = col; s.f1 = fila;
  s.fase = Math.max(0, fin(c.ANTICIPO_S, 0.12)) > 0 ? "anticipo" : "mueve"; s.t = 0;
  if (cuenta) { s.movsVisita++; s.movsTotal++; }
}

export interface CtxHuida {
  vx: number; vz: number;   // usuario relativo al origen de la luz (m)
  dLuz: number;             // distancia horizontal usuario → luz actual (m)
  tam: number;              // tamaño de celda (m)
  libre: boolean;           // la luz está libre (no girando, ni en diálogo, ni aplicando un checkpoint)
  valida: (col: number, fila: number) => boolean;
}
const _uc = { col: 0, fila: 0 }, _dest = { col: 0, fila: 0 };

/** Un frame (dt real en s). Devuelve 1 si empezó una huida, 2 si terminó un movimiento, 3 si una huida no tuvo lugar
 *  (se consumió), 0 si nada. */
export function tickHuida(s: EstadoHuida, c: CfgHuida, dt: number, ctx: CtxHuida): 0 | 1 | 2 | 3 {
  if (!c.ACTIVO) return 0;
  const d = Math.min(0.1, Math.max(0, fin(dt, 0)));
  const dh = Math.max(0, fin(c.DIST_HUIDA_M, 5));
  // rearme: alejarse más de REARME_M (al menos DIST_HUIDA_M + 1) después de una visita
  if (!s.armada && ctx.dLuz > Math.max(fin(c.REARME_M, 8), dh + 1)) {
    s.armada = true;
    if (s.resetPend) {
      s.resetPend = false;
      if ((s.col !== 0 || s.fila !== 0) && s.fase === "quieta") { iniciarMovimiento(s, 0, 0, false, c); s.hayPrev = false; }
    }
  }
  if (s.fase === "anticipo") {
    s.t += d;
    if (s.t >= Math.max(0, fin(c.ANTICIPO_S, 0.12))) { s.fase = "mueve"; s.t = 0; }
    return 0;
  }
  if (s.fase === "mueve") {
    s.t += d;
    const u = Math.min(1, s.t / Math.max(0.01, fin(c.MOVER_S, 0.4)));
    const e = 1 - (1 - u) * (1 - u) * (1 - u);   // rápido al principio, frena al llegar
    s.pc = s.c0 + (s.c1 - s.c0) * e; s.pf = s.f0 + (s.f1 - s.f0) * e;
    if (u >= 1) { s.pc = s.c1; s.pf = s.f1; s.fase = "espera"; s.t = 0; return 2; }
    return 0;
  }
  if (s.fase === "espera") {
    s.t += d;
    if (s.t >= Math.max(0, fin(c.ESPERA_S, 0.8))) { s.fase = "quieta"; s.t = 0; }
    return 0;
  }
  // quieta: ¿huir?
  if (!ctx.libre || !s.armada || movimientosRestantes(s) <= 0 || ctx.dLuz >= dh) return 0;
  if (!s.ejes) fijarEjes(s, -ctx.vx, -ctx.vz);   // primera huida: la luz está en el origen → usuario → origen
  celdaDe(s, ctx.vx, ctx.vz, ctx.tam, _uc);
  if (!elegirCelda(s, c, _uc.col, _uc.fila, ctx.valida, _dest)) { s.movsVisita++; s.movsTotal++; return 3; }
  iniciarMovimiento(s, _dest.col, _dest.fila, true, c);
  return 1;
}

/** "Mover luz ahora" (debug): una huida fuera de la regla (no consume la visita; sí avanza la secuencia). */
export function moverAhora(s: EstadoHuida, c: CfgHuida, ctx: CtxHuida): boolean {
  if (s.fase === "anticipo" || s.fase === "mueve") return false;
  if (!s.ejes) fijarEjes(s, -ctx.vx, -ctx.vz);
  celdaDe(s, ctx.vx, ctx.vz, ctx.tam, _uc);
  if (!elegirCelda(s, c, _uc.col, _uc.fila, ctx.valida, _dest)) return false;
  iniciarMovimiento(s, _dest.col, _dest.fila, false, c);
  s.movsTotal++;
  return true;
}
/** "Volver al origen" (debug): se desliza a (0, 0) sin contar. */
export function volverAlOrigen(s: EstadoHuida, c: Pick<CfgHuida, "ANTICIPO_S">): void {
  if (s.col === 0 && s.fila === 0 && s.pc === 0 && s.pf === 0) return;
  iniciarMovimiento(s, 0, 0, false, c); s.hayPrev = false;
}

// ── persistencia (sessionStorage, en luzMovimiento) ──
const CAMPOS = ["visitas", "movsVisita", "movsTotal", "col", "fila", "colPrev", "filaPrev", "hayPrev", "ejes", "fx", "fz", "semilla", "rng", "resetPend"] as const;
export function serializarHuida(s: EstadoHuida): string {
  const o: Record<string, number | boolean> = {};
  for (const k of CAMPOS) o[k] = s[k];
  return JSON.stringify(o);
}
/** Restaura lo guardado (la luz queda quieta en su celda, armada). false si el texto no sirve. */
export function restaurarHuida(s: EstadoHuida, txt: string | null): boolean {
  if (!txt) return false;
  let o: Record<string, unknown>;
  try { o = JSON.parse(txt) as Record<string, unknown>; } catch { return false; }
  if (!o || typeof o !== "object" || typeof o.visitas !== "number" || !Number.isFinite(o.visitas)) return false;
  const r = s as unknown as Record<string, unknown>;
  for (const k of CAMPOS) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) r[k] = v;
    else if (typeof v === "boolean") r[k] = v;
  }
  s.pc = s.col; s.pf = s.fila; s.fase = "quieta"; s.t = 0; s.armada = true;
  return true;
}
