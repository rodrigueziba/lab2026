// Z80: prueba de la caja de ritmos (lib/ritmos.ts) con el reloj de Z78 (lib/audio/reloj.ts) y tiempo simulado:
// punto → anillo y paso, pasos por compás, programador a 60/120/180 BPM con y sin swing, posición y salto, corte del
// hat abierto, persistencia y ejemplo house. Uso: node scripts/ritmos-test.mjs
import fs from 'node:fs';
import {
  pasosValidos, pasosPorPulso, pistasValidas, anguloDe, puntoACelda, centroCelda, crearPatron, alternarCelda, borrarPatron,
  cantidadActivas, remapearPasos, ejemploHouse, retrasoSwing, posicionActual, textoPosicion, pasosDesde, escalaSalto,
  cortaAbierto, serializarRitmos, restaurarRitmos, VOCES_IDS,
} from '../lib/ritmos.ts';
import { crearReloj, iniciar, pausar, reanudar, suscribir, programar, setBpm } from '../lib/audio/reloj.ts';

const src = fs.readFileSync(new URL('../lib/debugConfig.ts', import.meta.url), 'utf8');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string\[\]/g, '').replace(/ as Record<[^>]+>/g, '').replace(/ as string/g, '')});`)();
const R = obj('DBG_RITMOS');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const cerca = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const GEO = { R0: 0.11, ANCHO: 0.05 };

console.log('\nconfiguración DBG_RITMOS');
check(R.PASOS === 16 && R.BPM === 120 && R.SWING === 0, 'por defecto 16 pasos, 120 BPM, swing 0');
check(R.PISTAS.join(',') === 'kick,clap,hatC,hatA,shaker,perc', 'anillos de adentro hacia afuera: kick, clap, hat cerrado, hat abierto, shaker, perc');
check(R.MOSTRAR_BARRA === true && R.OVERLAY_CELDA === false, 'barra visible y overlay de depuración oculto por defecto');
check(VOCES_IDS.every(id => R.VOZ[id] && R.VOZ[id].TONO > 0 && R.VOZ[id].DECAY > 0), 'cada voz tiene TONO, DECAY y VOL');

console.log('\npasos por compás');
check([8, 12, 16, 32].every(n => pasosValidos(n) === n), 'acepta 8, 12, 16 y 32');
check(pasosValidos(15) === 16 && pasosValidos(7) === 8 && pasosValidos(100) === 32 && pasosValidos(NaN) === 16, 'otros valores van al aceptado más cercano');
check(pasosPorPulso(8) === 2 && pasosPorPulso(12) === 3 && pasosPorPulso(16) === 4 && pasosPorPulso(32) === 8, 'una vuelta = un compás de 4/4: pasos/4 por pulso');
check(pistasValidas(['hatC', 'kick', 'x', 'kick']).join(',') === 'hatC,kick' && pistasValidas([]).length === 6, 'pistas: ids conocidos, sin repetir; vacía → todas');

console.log('\npunto del disco → anillo y paso (polares)');
{
  const c = { anillo: 0, paso: 0, r: 0, ang: 0 };
  check(cerca(anguloDe(0, -1), 0) && cerca(anguloDe(1, 0), Math.PI / 2) && cerca(anguloDe(0, 1), Math.PI) && cerca(anguloDe(-1, 0), 1.5 * Math.PI), 'ángulo 0 a las 12 (−z), horario hacia +x');
  let bien = 0, total = 0;
  for (const pasos of [8, 12, 16, 32]) for (let a = 0; a < 6; a++) for (let p = 0; p < pasos; p++) {
    const o = centroCelda(a, p, GEO, pasos, { x: 0, z: 0 });
    total++;
    const r = puntoACelda(o.x, o.z, GEO, 6, pasos, c);
    if (r && r.anillo === a && r.paso === p) bien++;
  }
  check(bien === total, `el centro de cada celda vuelve a su celda (${bien}/${total}, con 8, 12, 16 y 32 pasos)`);
  // bordes: a medio paso de distancia angular cambia de celda; cerca del borde del anillo sigue en el anillo
  const d = (2 * Math.PI) / 16, r = GEO.R0 + 1.5 * GEO.ANCHO;
  const p1 = puntoACelda(r * Math.sin(3 * d + d * 0.49), -r * Math.cos(3 * d + d * 0.49), GEO, 6, 16, c)?.paso;
  const p2 = puntoACelda(r * Math.sin(3 * d + d * 0.51), -r * Math.cos(3 * d + d * 0.51), GEO, 6, 16, c)?.paso;
  check(p1 === 3 && p2 === 4, 'el límite entre pasos está a medio paso (0,49 → paso 3, 0,51 → paso 4)');
  const p15 = puntoACelda(r * Math.sin(-d * 0.3), -r * Math.cos(-d * 0.3), GEO, 6, 16, c)?.paso;
  check(p15 === 0, 'justo antes de las 12 sigue siendo el paso 0 (vuelta)');
  check(puntoACelda(0, -0.05, GEO, 6, 16, c) === null, 'el vinilo del centro no es celda');
  check(puntoACelda(0, -(GEO.R0 + 6 * GEO.ANCHO + 0.001), GEO, 6, 16, c) === null, 'fuera del último anillo no es celda');
  check(puntoACelda(0, -(GEO.R0 + 4.5 * GEO.ANCHO), GEO, 4, 16, c) === null, 'con 4 pistas, el anillo 4 no existe');
  check(puntoACelda(0, -(GEO.R0 + 0.001), GEO, 6, 16, c)?.anillo === 0 && puntoACelda(0, -(GEO.R0 + GEO.ANCHO - 0.001), GEO, 6, 16, c)?.anillo === 0, 'bordes del anillo 0');
}

console.log('\npatrón');
{
  const p = crearPatron();
  check(alternarCelda(p, 'kick', 4) === true && alternarCelda(p, 'kick', 4) === false, 'click pone y vuelve a sacar el cubito');
  ejemploHouse(p, 16);
  const fila = id => Array.from(p[id].slice(0, 16)).map(v => v ? 'x' : '.').join('');
  check(fila('kick') === 'x...x...x...x...', `house: bombo en los 4 tiempos (${fila('kick')})`);
  check(fila('hatC') === '..x...x...x...x.', `house: hat cerrado en los contratiempos (${fila('hatC')})`);
  check(fila('clap') === '....x.......x...', `house: palmas en 2 y 4 (${fila('clap')})`);
  check(cantidadActivas(p, VOCES_IDS, 16) === 10, '10 golpes por compás');
  remapearPasos(p, 16, 32);
  check(p.kick[0] && p.kick[8] && p.kick[16] && p.kick[24] && cantidadActivas(p, VOCES_IDS, 32) === 10, '16 → 32 pasos: los golpes quedan en el mismo lugar del compás');
  remapearPasos(p, 32, 8);
  check(p.kick[0] && p.kick[2] && p.kick[4] && p.kick[6] && p.hatC[1] && p.clap[2], '32 → 8: también');
  borrarPatron(p);
  check(cantidadActivas(p, VOCES_IDS, 32) === 0, 'borrar todo');
  const q = crearPatron(); ejemploHouse(q, 12);
  check(q.kick[0] && q.kick[3] && q.kick[6] && q.kick[9] && q.clap[3] && q.clap[9], 'ejemplo house con 12 pasos (tresillos)');
}

console.log('\nprogramador con el reloj de Z78 (tiempo simulado)');
function simular(bpm, swing, pasos, seg, patron = (() => { const p = crearPatron(); ejemploHouse(p, pasos); p.shaker.fill(1, 0, pasos); return p; })()) {
  const rl = crearReloj(bpm, pasos, pasosValidos(pasos) / 4);
  const golpes = [];
  const swingVoz = { hatC: true, hatA: true, shaker: true };
  suscribir(rl, (paso, t, _c, dur) => {
    for (const id of R.PISTAS) if (patron[id][paso]) golpes.push({ id, paso, t: t + (swingVoz[id] ? retrasoSwing(paso, pasos, swing, dur) : 0), grid: t });
  });
  iniciar(rl, 0, 0);
  for (let x = 0; x < seg; x += 0.025) programar(rl, x, 0.1);
  return { golpes, rl };
}
for (const bpm of [60, 120, 180]) {
  const { golpes } = simular(bpm, 0, 16, 8);
  const kicks = golpes.filter(g => g.id === 'kick').map(g => g.t);
  const negra = 60 / bpm;
  const err = kicks.reduce((m, t, i) => Math.max(m, Math.abs(t - i * negra)), 0);
  check(kicks.length >= Math.floor(8 / negra) && err < 1e-9, `${bpm} BPM: bombo cada ${(negra * 1000).toFixed(0)} ms exactos (${kicks.length} golpes, error ${err.toExponential(1)} s)`);
}
{
  const bpm = 120, dur = 60 / bpm / 4;
  const a = simular(bpm, 0, 16, 4).golpes.filter(g => g.id === 'shaker');
  const b = simular(bpm, 50, 16, 4).golpes.filter(g => g.id === 'shaker');
  const pares = b.filter(g => g.paso % 2 === 0).every(g => cerca(g.t, g.grid));
  const impares = b.filter(g => g.paso % 2 === 1).every(g => cerca(g.t - g.grid, 0.5 * 0.5 * dur));
  check(a.every(g => cerca(g.t, g.grid)), 'swing 0: todo en la grilla');
  check(pares && impares, `swing 50 %: los pasos impares se atrasan ${(0.25 * dur * 1000).toFixed(1)} ms (½ · 50 % de un paso), los pares no`);
  const kick = simular(bpm, 60, 16, 4).golpes.filter(g => g.id === 'kick').every(g => cerca(g.t, g.grid));
  check(kick, 'el swing no mueve las voces sin SWING (bombo)');
  check(retrasoSwing(1, 12, 60, 0.1) === 0, 'con 12 pasos (tresillos) el swing no se aplica');
  check(cerca(retrasoSwing(1, 16, 99, 0.1), 0.03) && retrasoSwing(1, 16, -5, 0.1) === 0, 'swing acotado a 0…60 %');
}
{
  // cambio de BPM en vivo: vale desde el próximo paso, sin golpes repetidos ni perdidos
  const p = crearPatron(); p.kick.fill(1, 0, 16);
  const rl = crearReloj(120, 16, 4); const t = [];
  suscribir(rl, (paso, tt) => { if (p.kick[paso]) t.push(tt); });
  iniciar(rl, 0, 0);
  for (let x = 0; x < 1; x += 0.025) programar(rl, x, 0.1);
  setBpm(rl, 180);
  for (let x = 1; x < 2; x += 0.025) programar(rl, x, 0.1);
  const difs = t.slice(1).map((v, i) => v - t[i]);
  check(difs.every(d => cerca(d, 0.125) || cerca(d, 60 / 180 / 4)) && rl.cortes === 0, 'cambio 120 → 180 BPM en vivo: pasos de 125 ms y luego 83,3 ms, sin cortes');
}

console.log('\nposición que suena, línea radial y salto');
{
  const rl = crearReloj(120, 16, 4); iniciar(rl, 0, 0);
  const pos = { pasos: 0, compas: 0, paso: 0, frac: 0 };
  let maxErr = 0;
  for (let x = 0; x < 6; x += 0.025) {
    programar(rl, x, 0.1);
    const ahora = x + 0.0125;
    posicionActual(rl, ahora, pos);
    const esperado = (ahora / 0.125) % 16;
    maxErr = Math.max(maxErr, Math.abs(pos.pasos - esperado));
  }
  check(maxErr < 1e-6, `la línea radial sigue al tiempo de audio aunque el reloj programe 100 ms adelante (error ${maxErr.toExponential(1)} pasos)`);
  posicionActual(rl, 2.0 + 0.0625 * 5, pos);
  check(pos.compas === 1 && textoPosicion(pos, 16) === `02.${Math.floor(pos.paso / 4) + 1}.${(pos.paso % 4) + 1}`, `texto de posición: ${textoPosicion(pos, 16)} (compás.pulso.subdivisión)`);
  check(textoPosicion({ pasos: 6, compas: 0, paso: 6, frac: 0 }, 16) === '01.2.3', '01.2.3 = compás 1, pulso 2, semicorchea 3');
  pausar(rl, 6.0); const enPausa = posicionActual(rl, 9, { pasos: 0, compas: 0, paso: 0, frac: 0 }).pasos;
  const antes = posicionActual({ ...rl, estado: 'corriendo' }, 6.0, { pasos: 0, compas: 0, paso: 0, frac: 0 }).pasos;
  check(cerca(enPausa, antes, 1e-9), 'en pausa la línea queda quieta donde estaba');
  reanudar(rl, 9);
  check(posicionActual(crearReloj(), 5, pos).pasos === 0, 'detenido: en 0');
  check(cerca(pasosDesde(0.5, 15, 16), 1.5) && cerca(pasosDesde(3.2, 3, 16), 0.2), 'pasos desde que la línea pasó por el cubito (con vuelta)');
  const amp = R.SALTO_AMP, tau = R.SALTO_TAU_S;
  check(escalaSalto(-0.1, amp, tau) === 1 && cerca(escalaSalto(0.02, amp, tau), 1 + amp) && escalaSalto(0.2, amp, tau) < 1 + amp * 0.2 && escalaSalto(2, amp, tau) === 1, `salto: sube a ${1 + amp} al pasar la línea y vuelve a 1`);
}

console.log('\nhat abierto cortado por el cerrado');
check(cortaAbierto(1.0, 1.4, 1.2), 'un cerrado a 1,2 s corta un abierto que suena de 1,0 a 1,4 s');
check(!cortaAbierto(1.0, 1.4, 1.5) && !cortaAbierto(1.0, 1.4, 0.9), 'antes o después del abierto no corta');
check(cortaAbierto(1.0, 1.4, 1.0), 'en el mismo instante también corta');

console.log('\npersistencia');
{
  const p = crearPatron(); ejemploHouse(p, 16); p.perc[7] = 1;
  const txt = serializarRitmos(p, 16, 133, 25);
  const q = crearPatron(); q.kick.fill(1);
  const r = restaurarRitmos(txt, q);
  check(r && r.pasos === 16 && r.bpm === 133 && r.swing === 25, 'restaura pasos, BPM y swing');
  check(VOCES_IDS.every(id => Array.from(p[id]).join('') === Array.from(q[id]).join('')), 'restaura el patrón exacto (y borra lo que había)');
  check(restaurarRitmos(null, q) === null && restaurarRitmos('{roto', q) === null && restaurarRitmos('{"v":2}', q) === null, 'texto vacío, roto o de otra versión: null');
  const fuera = restaurarRitmos(JSON.stringify({ v: 1, pasos: 16, bpm: 999, swing: -4, filas: {} }), q);
  check(fuera.bpm === 180 && fuera.swing === 0, 'BPM y swing guardados fuera de rango se acotan');
  const r32 = restaurarRitmos(serializarRitmos(p, 32, 120, 0), crearPatron());
  check(r32.pasos === 32, '32 pasos se guardan y restauran');
}

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
