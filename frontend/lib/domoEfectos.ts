// Z97: efectos del domo de la tarima (FaceDome, DOME_FRAG) controlados por el atril de imagen rediseñado ("IMAGEN IM-40").
// Lógica PURA y SIN imports (prueba: scripts/atril-imagen-test.mjs). FaceDome la avanza en su useFrame (sin timers) y
// escribe uE0..uE6 SOLO cuando cambian. Esos uniforms los comparte por referencia el pase de transmisión (Z94), así que
// lo que ve SILLAS refleja los pads, AUTO, VELOC., el ON de efectos, PSICO y los faders.
//
// Semántica de los pads (opción A del prompt Z97): los 7 pads son el CONJUNTO de efectos permitidos.
//  - AUTO encendido: cada VELOC. segundos los 7 sectores rotan un paso entre los efectos permitidos
//    (sector i → permitidos[(i + paso) % n]). Con los 7 pads encendidos es EXACTAMENTE la rotación de hoy
//    ((SECTOR_INIT[i] + offset) % 7 cada 5 s).
//  - AUTO apagado: sin rotación; sector i → permitidos[i % n]. Un solo pad encendido = ese efecto en todos los sectores
//    al instante; varios = combinados (repartidos).
//  - Ningún pad encendido, o el ON de efectos apagado: EFECTO_NINGUNO (7) en todos los sectores = imagen sin efectos
//    (rama del shader sin lecturas de textura extra).

/** Los 7 efectos reales del shader (DOME_FRAG.applyEffect), por índice. */
export const EFECTOS = ["RGB", "PIXEL", "ONDA", "LÍNEAS", "ESPEJO", "ESTIRAR", "POSTER"] as const;
export const EFECTOS_LARGO = ["SEPARACIÓN RGB", "PIXELADO", "ONDA", "LÍNEAS DE BARRIDO", "ESPEJO", "ESTIRAR", "POSTERIZAR"] as const;
export const N_EFECTOS = 7;
export const N_SECTORES = 7;
export const EFECTO_NINGUNO = 7;

export interface EstadoEfectos {
  mascara: number;      // bit i = pad i encendido (0x7f = los 7)
  on: boolean;          // ON del módulo de efectos
  auto: boolean;        // rotación automática
  rotS: number;         // segundos entre pasos (VELOC.)
  paso: number;         // desplazamiento de la rotación
  acum: number;         // s acumulados desde el último paso
  version: number;      // sube cuando algo cambia lo que hay que escribir en los uniforms
  imagenOn: boolean;    // ON del módulo IMAGEN: apagado = brillo, contraste, saturación y zoom neutros (1)
}
export function crearEstadoEfectos(): EstadoEfectos {
  return { mascara: 0x7f, on: true, auto: true, rotS: 5, paso: 0, acum: 0, version: 0, imagenOn: true };
}
export const DOMO_EFECTOS: EstadoEfectos = crearEstadoEfectos();

export function padEncendido(st: EstadoEfectos, i: number): boolean { return ((st.mascara >> i) & 1) === 1; }
export function fijarPad(st: EstadoEfectos, i: number, on: boolean): void {
  if (i < 0 || i >= N_EFECTOS) return;
  const m = on ? st.mascara | (1 << i) : st.mascara & ~(1 << i);
  if (m !== st.mascara) { st.mascara = m; st.version++; }
}
export function cantidadPermitidos(st: EstadoEfectos): number {
  let n = 0;
  for (let i = 0; i < N_EFECTOS; i++) if (padEncendido(st, i)) n++;
  return n;
}
/** k-ésimo efecto permitido (0…n−1) sin crear arreglos. */
function kesimo(st: EstadoEfectos, k: number): number {
  for (let i = 0; i < N_EFECTOS; i++) if (padEncendido(st, i) && k-- === 0) return i;
  return EFECTO_NINGUNO;
}

/** Avanza la rotación con dt (s). rotS se lee en cada llamada: cambiar VELOC. no crea ni reprograma timers. */
export function tickRotacion(st: EstadoEfectos, dt: number, minS = 1, maxS = 10): boolean {
  if (!st.auto || !st.on || cantidadPermitidos(st) <= 1) { st.acum = 0; return false; }
  const intervalo = Math.max(minS, Math.min(maxS, Number.isFinite(st.rotS) ? st.rotS : 5));
  st.acum += Math.max(0, Math.min(1, dt));
  if (st.acum < intervalo) return false;
  st.acum -= intervalo;
  if (st.acum > intervalo) st.acum = 0;   // tras una pausa larga, un solo paso
  st.paso = (st.paso + 1) % 5040;          // múltiplo de 1…7: el ciclo nunca salta
  st.version++;
  return true;
}

/** Efecto de cada sector (escribe en out[0..6]; sin allocations). */
export function asignarSectores(st: EstadoEfectos, out: number[]): number[] {
  const n = st.on ? cantidadPermitidos(st) : 0;
  for (let s = 0; s < N_SECTORES; s++) {
    out[s] = n === 0 ? EFECTO_NINGUNO : kesimo(st, (st.auto ? s + st.paso : s) % n);
  }
  return out;
}

/** Línea 1 del display: "AUTO · 5 s · 7/7", "EFECTO ONDA 3/7", "2 EFECTOS: RGB+ONDA" o "SIN EFECTOS". */
export function textoEfectos(st: EstadoEfectos): string {
  const n = st.on ? cantidadPermitidos(st) : 0;
  if (n === 0) return st.on ? "SIN EFECTOS (NINGÚN PAD)" : "EFECTOS APAGADOS";
  if (st.auto && n > 1) return `AUTO · CADA ${Math.round(st.rotS)} s · ${n}/7 EFECTOS`;
  if (n === 1) { const i = kesimo(st, 0); return `EFECTO ${EFECTOS[i]} ${i + 1}/7`; }
  if (n === N_EFECTOS) return "LOS 7 EFECTOS · FIJOS (AUTO APAGADO)";   // la lista entera no entra en el display
  let s = `${n} EFECTOS: `;
  for (let i = 0, k = 0; i < N_EFECTOS; i++) if (padEncendido(st, i)) s += (k++ ? "+" : "") + EFECTOS[i];
  return s;
}
