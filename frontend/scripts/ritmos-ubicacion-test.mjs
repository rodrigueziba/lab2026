// Z88: ubicación de la caja de ritmos y de los slots de los atriles de instrumentos (lib/playTarima.ts) detrás de la
// tarima, sobre el eje sillas → tarima; pedestal; slots en línea; alcance con la tecla E (misma regla que LecternSystem:
// distancia XZ a la caja < 1,8 m y menor que a los dos atriles); cuándo sale. Uso: node scripts/ritmos-ubicacion-test.mjs
import fs from 'node:fs';
import { slotsSegunUbicacion, slotsInstrumentos, slotsDetrasTarima, ejeDetrasTarima, bordeTarimaSobreEje, desplazamientoSlot,
  alturaPedestal, cajaSaleConAtriles, ubicacionRitmos } from '../lib/playTarima.ts';
import { TARIMA_CENTRO, centroSillasEn, sillaEn, N_SILLAS } from '../lib/layoutSala.ts';

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const src = leer('../lib/debugConfig.ts');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string \| number/g, '').replace(/ as string\[\]/g, '').replace(/ as Record<[^>]*>/g, '').replace(/ as string/g, '')});`)();
const P = obj('DBG_PLAY'), R = obj('DBG_RITMOS'), LAY = obj('DBG_LAYOUT'), LUZ = obj('DBG_LUZ');
const OUT = Number(/LECTERN_OUTWARD_OFFSET_M = ([\d.]+)/.exec(src)[1]);
const LS = leer('../components/LecternSystem.tsx');
const LECTERN_X = Number(/LECTERN_X\s+= ([\d.]+)/.exec(LS)[1]), ATRIL_X = LECTERN_X + OUT;
const TARIMA_H = Number(/TARIMA_H_REF\s+= ([\d.]+)/.exec(LS)[1]);
const RANGO_E = Number(/INTERACT_RANGE\s+= ([\d.]+)/.exec(LS)[1]);
const PROMPT = Number(/LECTERN_PROMPT_M = ([\d.]+)/.exec(LS)[1]);
const TW = 4.2 * 0.76, MEDIA = TW / 2;
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const cerca = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const f = (n, d = 2) => n.toFixed(d);

// eje (= slotsActuales de components/PlayTarima.tsx)
const ejeDe = lay => { const s = { x: 0, z: 0 }; centroSillasEn(lay, s); return { s, eje: ejeDetrasTarima(TARIMA_CENTRO.x, TARIMA_CENTRO.z, s.x, s.z, { cx: 0, cz: 0, ux: 0, uz: 0 }) }; };
const slots = (p = P, r = R, lay = LAY) => slotsSegunUbicacion(p, r, ATRIL_X, ejeDe(lay).eje, MEDIA, TARIMA_H, []);

console.log('\ngeometría relevada');
const { s: SC, eje: EJE } = ejeDe(LAY);
const s0 = { x: 0, z: 0 }, sN = { x: 0, z: 0 }; sillaEn(0, LAY, s0); sillaEn(N_SILLAS - 1, LAY, sN);
console.log(`    tarima: centro (${TARIMA_CENTRO.x}, ${TARIMA_CENTRO.z}) · ${f(TW, 3)} × ${f(TW, 3)} m · alto ${TARIMA_H} m · bordes x ±${f(MEDIA, 3)}, z ±${f(MEDIA, 3)}`);
console.log(`    sillas: ${N_SILLAS} en z = ${f(s0.z)} (SILLAS_OFFSET_M ${LAY.SILLAS_OFFSET_M}), x ${f(s0.x)}…${f(sN.x)} · centro de la fila (${f(SC.x)}, ${f(SC.z)})`);
console.log(`    eje sillas → tarima: (${f(EJE.ux)}, ${f(EJE.uz)}) · borde opuesto a las sillas a ${f(bordeTarimaSobreEje(EJE.ux, EJE.uz, MEDIA), 3)} m del centro`);
console.log(`    atriles: imagen (−${f(ATRIL_X)}, 0) · sonido (${f(ATRIL_X)}, 0), sobre la tarima · sala caminable ±${LUZ.SALA_MEDIA_M - LUZ.SALA_MARGEN_M} m`);
check(cerca(EJE.ux, 0) && cerca(EJE.uz, 1), 'eje = +Z (las sillas están en −Z)');

console.log('\ncaja de ritmos (detras_tarima)');
check(R.UBICACION === 'detras_tarima' && ubicacionRitmos(R.UBICACION) === 'detras_tarima' && R.DIST_DETRAS_M === 2, 'defaults: UBICACION detras_tarima, DIST_DETRAS_M 2,0');
const S = slots(), C = S[R.SLOT];
const fx = Math.sin(C.yaw), fz = Math.cos(C.yaw), aC = [EJE.cx - C.x, EJE.cz - C.z], nC = Math.hypot(...aC);
const ped = alturaPedestal(P, C.y, TARIMA_H);
console.log(`    caja: (${f(C.x, 3)}, ${f(C.z, 3)}) · y ${C.y} · pedestal ${f(ped, 3)} m · yaw ${f(C.yaw * 180 / Math.PI, 1)}° · frente (${f(fx)}, ${f(fz)})`);
check(cerca(C.x, 0) && cerca(C.z, MEDIA + R.DIST_DETRAS_M), `sobre el eje, a DIST_DETRAS_M (${R.DIST_DETRAS_M} m) del borde de la tarima opuesto a las sillas (z = ${f(MEDIA + R.DIST_DETRAS_M, 3)})`);
check(cerca((fx * aC[0] + fz * aC[1]) / nC, 1), 'mira al centro de la tarima');
check(!C.sobreTarima && C.y === 0 && cerca(ped, TARIMA_H), `sobre el piso, con el pedestal de alturaPedestal() (${f(ped, 3)} m = alto de la tarima)`);
check(Math.sign(C.z - EJE.cz) !== Math.sign(SC.z - EJE.cz), 'del lado opuesto a las sillas');
const C3 = slots(P, { ...R, DIST_DETRAS_M: 3.5 })[R.SLOT];
check(cerca(C3.z, MEDIA + 3.5), 'DIST_DETRAS_M 3,5 → 3,5 m del borde');
for (const off of [0, 6]) {   // acompaña a DBG_LAYOUT
  const L2 = { ...LAY, SILLAS_OFFSET_M: off }, C2 = slots(P, R, L2)[R.SLOT];
  check(cerca(C2.x, 0) && cerca(C2.z, MEDIA + R.DIST_DETRAS_M), `con SILLAS_OFFSET_M ${off} sigue sobre el eje`);
}
// eje genérico (diagonal): la caja queda sobre la recta del eje y fuera de la tarima
{ const e = ejeDetrasTarima(0, 0, -3, -4, { cx: 0, cz: 0, ux: 0, uz: 0 }), q = slotsDetrasTarima(P, e, 2, 0, MEDIA, TARIMA_H, [])[0];
  check(cerca(q.x * e.uz - q.z * e.ux, 0) && q.x * e.ux + q.z * e.uz > MEDIA && !q.sobreTarima, `eje diagonal (sillas en (−3, −4)): sobre la recta del eje, fuera de la tarima (${f(q.x)}, ${f(q.z)})`); }

console.log('\nslots de los atriles de instrumentos (en línea, la caja en el centro)');
console.log('    ' + S.map((s, i) => `#${i}${i === R.SLOT ? '(caja)' : ''} (${f(s.x)}, ${f(s.z)})`).join(' · '));
check(S.length === P.SLOTS_N, `SLOTS_N = ${P.SLOTS_N}`);
check(S.every(s => cerca(s.z, C.z)), 'todos sobre la misma recta perpendicular al eje (misma distancia detrás de la tarima)');
const xs = S.map(s => s.x).sort((a, b) => a - b);
check(xs.every((x, i) => i === 0 || cerca(x - xs[i - 1], P.SLOTS_SEP_M, 1e-9)), `separados SLOTS_SEP_M (${P.SLOTS_SEP_M} m)`);
check(cerca(C.x, 0), 'el slot de la caja (DBG_RITMOS.SLOT) en el centro, sobre el eje');
check([0, 1, 2, 3, 4].map(i => desplazamientoSlot(i, 1)).join() === '1,0,-1,2,-2', 'orden alrededor del centro: +1, −1, +2, −2…');
check(S.every(s => !s.sobreTarima && Math.min(Math.hypot(s.x - ATRIL_X, s.z), Math.hypot(s.x + ATRIL_X, s.z)) > 2.5), 'ningún slot cae sobre la tarima ni junto a los atriles');
check(S.every(s => { const a = [-s.x, -s.z], n = Math.hypot(...a); return cerca((Math.sin(s.yaw) * a[0] + Math.cos(s.yaw) * a[1]) / n, 1); }), 'cada slot mira al centro de la tarima');

console.log('\nslot_atril (Z79/Z80, código viejo intacto)');
{ const viejo = slotsInstrumentos(P, ATRIL_X, MEDIA, TARIMA_H, []), nuevo = slots(P, { ...R, UBICACION: 'slot_atril' });
  check(JSON.stringify(viejo) === JSON.stringify(nuevo), 'UBICACION slot_atril = slotsInstrumentos de Z79 tal cual');
  const cv = nuevo[R.SLOT];
  console.log(`    caja en slot_atril: (${f(cv.x)}, ${f(cv.z)}) (Z80: ${P.SLOTS_DIST_M} m detrás del atril de sonido)`); }

console.log('\nalcance con la tecla E');
const dAtril = Math.hypot(C.x - ATRIL_X, C.z), dImg = Math.hypot(C.x + ATRIL_X, C.z);
console.log(`    caja ↔ atril de sonido: ${f(dAtril, 3)} m · caja ↔ atril de imagen: ${f(dImg, 3)} m · radio E ${RANGO_E} m · aviso "Tocar E" ${PROMPT} m`);
const eligeE = (x, z) => {   // réplica de LecternSystem onKey "e"
  const dL = Math.hypot(x + ATRIL_X, z), dR = Math.hypot(x - ATRIL_X, z), dC = Math.hypot(x - C.x, z - C.z);
  if (dC < RANGO_E && dC < Math.min(dL, dR)) return 'ritmos';
  if (dL < RANGO_E) return 'image'; if (dR < RANGO_E) return 'sound'; return null;
};
let total = 0, caja = 0, fuera = 0;
for (let r = 0.05; r < RANGO_E; r += 0.05) for (let a = 0; a < 360; a += 5) {
  const x = C.x + r * Math.cos(a * Math.PI / 180), z = C.z + r * Math.sin(a * Math.PI / 180);
  total++; if (eligeE(x, z) === 'ritmos') caja++;
  const m = LUZ.SALA_MEDIA_M - LUZ.SALA_MARGEN_M; if (Math.abs(x) > m || Math.abs(z) > m) fuera++;
}
check(caja === total, `dentro de ${RANGO_E} m de la caja la E siempre elige la caja (${caja}/${total} puntos), nunca el atril de sonido`);
check(fuera === 0, 'todo el círculo de la E queda dentro de la sala caminable (sin colisiones con tarima ni atriles: el movimiento solo tiene los límites de la sala)');
const frente = [C.x + fx * 1.0, C.z + fz * 1.0];   // parado 1 m frente a la caja, del lado de la tarima
check(eligeE(...frente) === 'ritmos' && frente[1] > MEDIA, `parado 1 m frente a la caja (${f(frente[0])}, ${f(frente[1])}, fuera de la tarima): E → caja`);
check(eligeE(ATRIL_X - 0.8, 0) === 'sound', 'frente al atril de sonido la E sigue eligiendo el atril de sonido');
const desde = [ATRIL_X - 0.8, 0];
console.log(`    recorrido: del frente del atril de sonido (${f(desde[0])}, 0) al frente de la caja: ${f(Math.hypot(frente[0] - desde[0], frente[1] - desde[1]))} m en línea recta (cruza la tarima, que se pisa) · desde la fila de sillas (${f(SC.x)}, ${f(SC.z)}): ${f(Math.hypot(frente[0] - SC.x, frente[1] - SC.z))} m`);
check(Math.hypot(frente[0] - desde[0], frente[1] - desde[1]) < 5, 'recorrido corto (< 5 m) desde el atril de sonido');

console.log('\ncuándo sale');
check(P.APARECER_TRAS_PLAY === false && R.MOSTRAR === 'tras_play' && cajaSaleConAtriles(P.APARECER_TRAS_PLAY, R.MOSTRAR), 'por defecto sale con los atriles (APARECER_TRAS_PLAY false)');
check(!cajaSaleConAtriles(true, 'tras_play') && cajaSaleConAtriles(true, 'siempre'), 'APARECER_TRAS_PLAY true = al apretar play (Z80); MOSTRAR siempre = con los atriles');
const CR = leer('../components/CajaRitmos.tsx');
check(/inicioRef\.current/.test(CR) && /inicioRef=\{appearStart\}/.test(LS), 'la animación arranca en appearStart de los atriles (misma duración 2 s y curva ease-out cúbica)');
check(/APARICION_MS = 2000/.test(CR) && /LECTERN_APPEAR_DUR_MS\s+= 2_000/.test(LS), 'misma duración que los atriles (2 s)');

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
