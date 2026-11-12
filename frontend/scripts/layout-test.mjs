// Z41: prueba del layout de la sala (lib/layoutSala.ts): sillas, ZONA_SILLAS, público y monolitos con
// offset 0 y 4, el flag POSICIONES_NUEVAS, que ninguna persona quede fuera de su asiento, límites de la sala
// y distancias a los 4 haces, al spawn y al telón. Uso: node scripts/layout-test.mjs
import {
  SILLAS_BASE, N_SILLAS, ASIENTO_MEDIO, ZONA_SILLAS_BASE, ZONA_TARIMA, TARIMA_CENTRO, PUBLICO_INICIO_Z_BASE, DIR_SILLAS,
  sillaEn, asientoPublicoEn, inicioPublicoEn, zonaSillasEn, desplazamientoSillasEn, centroSillasEn, monolitoEn,
} from '../lib/layoutSala.ts';

let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const EPS = 1e-9;
const f = n => n.toFixed(2);
const cfg = (nuevas, s, m) => ({ POSICIONES_NUEVAS: nuevas, SILLAS_OFFSET_M: s, MONOLITOS_OFFSET_M: m });
const P = () => ({ x: 0, z: 0 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// valores actuales de debugConfig (copiados acá: el test no importa debugConfig por el alias @/)
const MONOLITH_DIST_M = 3.75, HAZ_RADIO_M = 15, HAZ_ZONA_M = 1.0, BASE_MONOLITO_LADO = 0.58 * 2.3;
const SALA_LIMITE_M = 40 - 0.5;
const INICIO_BASE = { x: -10, z: -7 }, CURTAIN_DIST = 3, RETROCESO = 5;
const eL = Math.hypot(INICIO_BASE.x, INICIO_BASE.z), EJE = { x: -INICIO_BASE.x / eL, z: -INICIO_BASE.z / eL };
const TELON = { x: INICIO_BASE.x + EJE.x * CURTAIN_DIST, z: INICIO_BASE.z + EJE.z * CURTAIN_DIST };
const SPAWN = { x: TELON.x - EJE.x * (CURTAIN_DIST + RETROCESO), z: TELON.z - EJE.z * (CURTAIN_DIST + RETROCESO) };

console.log('\ndirección tarima → sillas');
check(Math.abs(DIR_SILLAS.x) < EPS && Math.abs(DIR_SILLAS.z + 1) < EPS, `DIR_SILLAS = (${f(DIR_SILLAS.x)}, ${f(DIR_SILLAS.z)})`);

for (const off of [0, 4]) {
  const c = cfg(true, off, off === 0 ? 0 : 3);
  console.log(`\nSILLAS_OFFSET_M = ${off} · MONOLITOS_OFFSET_M = ${c.MONOLITOS_OFFSET_M}`);
  const sillas = [...Array(N_SILLAS)].map((_, i) => sillaEn(i, c, P()));
  const desp = desplazamientoSillasEn(c, P());
  console.log(`    sillas: ${sillas.map(s => `(${f(s.x)}, ${f(s.z)})`).join(' ')}`);
  check(sillas.every((s, i) => Math.abs(s.x - (SILLAS_BASE.xs[i] + desp.x)) < EPS && Math.abs(s.z - (SILLAS_BASE.z + desp.z)) < EPS),
    'cada silla = base + desplazamiento del grupo de Chairs (lo que se dibuja)');
  check(sillas.every((s, i) => i === 0 || Math.abs(s.x - sillas[i - 1].x - 1) < EPS) && sillas.every(s => Math.abs(s.z - sillas[0].z) < EPS),
    'misma fila (z única) y mismo espaciado (1 m)');
  check(Math.abs(Math.abs(sillas[0].z - TARIMA_CENTRO.z) - (Math.abs(SILLAS_BASE.z) + off)) < EPS, `fila a ${f(Math.abs(sillas[0].z))} m de la tarima (+${off})`);
  const z = zonaSillasEn(c, P());
  const cs = centroSillasEn(c, P());
  check(Math.abs((z.z - cs.z) - (ZONA_SILLAS_BASE.z - SILLAS_BASE.z)) < EPS && Math.abs(z.x - cs.x) < EPS,
    `ZONA_SILLAS (${f(z.x)}, ${f(z.z)}) r ${ZONA_SILLAS_BASE.radio}: misma relación con las sillas (${f(z.z - cs.z)} m)`);
  check(dist(z, ZONA_TARIMA) > ZONA_SILLAS_BASE.radio + ZONA_TARIMA.radio, `no se superpone con ZONA_LUZ (${f(dist(z, ZONA_TARIMA))} m entre centros)`);
  // público: asiento = silla; nadie fuera del asiento
  let fuera = 0;
  for (let i = 0; i < N_SILLAS; i++) {
    const a = asientoPublicoEn(i, c, P());
    if (Math.abs(a.x - sillas[i].x) > ASIENTO_MEDIO.x || Math.abs(a.z - sillas[i].z) > ASIENTO_MEDIO.z) fuera++;
    if (Math.hypot(a.x - sillas[i].x, a.z - sillas[i].z) > EPS) fuera++;
  }
  check(fuera === 0, 'las 6 personas sentadas en el centro de su asiento (desvío 0 m)');
  const ini = [...Array(N_SILLAS)].map((_, i) => inicioPublicoEn(i, c, P()));
  check(ini.every((p, i) => Math.abs(dist(p, sillas[i]) - (SILLAS_BASE.z - PUBLICO_INICIO_Z_BASE)) < EPS),
    `entrada del público en z = ${f(ini[0].z)}: misma distancia caminada (${f(SILLAS_BASE.z - PUBLICO_INICIO_Z_BASE)} m)`);
  // monolitos
  const mL = monolitoEn(-1, MONOLITH_DIST_M, c, P()), mR = monolitoEn(1, MONOLITH_DIST_M, c, P());
  check(Math.abs(dist(mL, TARIMA_CENTRO) - (MONOLITH_DIST_M + c.MONOLITOS_OFFSET_M)) < EPS && Math.abs(mL.x + mR.x) < EPS && mL.z === 0,
    `monolitos en (${f(mL.x)}, ${f(mL.z)}) y (${f(mR.x)}, ${f(mR.z)}): radiales desde la tarima`);
  // haces (rotationDeg 0, y peor caso girando 0…360°)
  let minHaz = Infinity, minHazRot = Infinity;
  for (let k = 0; k < 4; k++) {
    const a = -Math.PI / 4 + k * Math.PI / 2;
    const h = { x: HAZ_RADIO_M * Math.cos(a), z: HAZ_RADIO_M * Math.sin(a) };
    minHaz = Math.min(minHaz, dist(h, mL), dist(h, mR));
  }
  for (let deg = 0; deg < 360; deg++) for (let k = 0; k < 4; k++) {
    const a = -Math.PI / 4 + k * Math.PI / 2 + deg * Math.PI / 180;
    const h = { x: HAZ_RADIO_M * Math.cos(a), z: HAZ_RADIO_M * Math.sin(a) };
    minHazRot = Math.min(minHazRot, dist(h, mL), dist(h, mR));
  }
  check(minHaz > HAZ_ZONA_M + BASE_MONOLITO_LADO, `haz más cercano a un monolito: ${f(minHaz)} m (rotationDeg 0) · peor caso girando: ${f(minHazRot)} m`);
  // límites de la sala y spawn / telón
  const todo = [...sillas, z, ...ini, mL, mR];
  check(todo.every(p => Math.abs(p.x) < SALA_LIMITE_M && Math.abs(p.z) < SALA_LIMITE_M), `todo dentro de ±${SALA_LIMITE_M} m (máx |z| = ${f(Math.max(...todo.map(p => Math.abs(p.z))))})`);
  const perp = Math.abs((z.x - TELON.x) * EJE.z - (z.z - TELON.z) * EJE.x);
  check(dist(z, SPAWN) > ZONA_SILLAS_BASE.radio && dist(z, TELON) > ZONA_SILLAS_BASE.radio,
    `zona a ${f(dist(z, SPAWN))} m del spawn, ${f(dist(z, TELON))} m del telón, ${f(perp)} m del eje telón → tarima`);
}

console.log('\nflag POSICIONES_NUEVAS = false');
const vieja = cfg(false, 4, 3), base = cfg(true, 0, 0);
const igual = (a, b) => Math.abs(a.x - b.x) < EPS && Math.abs(a.z - b.z) < EPS;
let todasIguales = true;
for (let i = 0; i < N_SILLAS; i++) {
  todasIguales &&= igual(sillaEn(i, vieja, P()), sillaEn(i, base, P())) && igual(inicioPublicoEn(i, vieja, P()), inicioPublicoEn(i, base, P()));
}
todasIguales &&= igual(zonaSillasEn(vieja, P()), { x: 0, z: -6 }) && igual(monolitoEn(1, MONOLITH_DIST_M, vieja, P()), { x: 3.75, z: 0 });
check(todasIguales, 'offsets ignorados: sillas z = −3, zona (0, −6), entrada z = −20, monolitos ±3,75 (exactamente lo anterior)');
check(igual(sillaEn(0, cfg(true, NaN, NaN), P()), sillaEn(0, base, P())), 'offset no numérico → 0 (no rompe)');

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
