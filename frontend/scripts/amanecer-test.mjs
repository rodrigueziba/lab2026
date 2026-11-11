// Z38: prueba de la máquina única del amanecer (lib/amanecer.ts). Uso: node scripts/amanecer-test.mjs
import { AMANECER, dispararAmanecer, tickAmanecer, resetAmanecer, skipAmanecer, easeOut3 } from '../lib/amanecer.ts';

let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const ev = [];
globalThis.window = new EventTarget();
window.addEventListener('alight:dawn-complete', () => ev.push('dawn-complete'));
window.addEventListener('alight:dome-dawn-complete', () => ev.push('dome-dawn-complete'));
const DUR = 10, DT = 1 / 60;
const correr = (seg, pausado = false) => { for (let i = 0; i < Math.round(seg / DT); i++) tickAmanecer(DT, pausado, DUR); };
const est = () => `fase=${AMANECER.fase} t=${AMANECER.t.toFixed(2)} p1=${AMANECER.p1.toFixed(3)} easeOut3=${easeOut3(AMANECER.p1).toFixed(3)} tFin=${AMANECER.tFin.toFixed(2)}`;

console.log('\nprogreso (60 fps, AMANECER_DUR_S = 10)');
correr(1);
check(AMANECER.fase === 'inactivo', 'sin disparo no arranca');
dispararAmanecer(); dispararAmanecer();      // dos haces: un solo disparo
tickAmanecer(0, false, DUR);
console.log('  t=0    ' + est());
check(AMANECER.fase === 'amanecer' && AMANECER.p1 === 0, 't = 0: amanecer, p1 = 0');
correr(2.5); console.log('  t=2,5  ' + est());
check(Math.abs(AMANECER.p1 - 0.25) < 0.002, 't = 2,5 s: p1 = 0,25');
correr(2.5); console.log('  t=5    ' + est());
check(Math.abs(AMANECER.p1 - 0.5) < 0.002, 't = 5 s: p1 = 0,5');

console.log('\npausa a los 5 s (3 s pausado)');
correr(3, true); console.log('  pausa  ' + est());
check(Math.abs(AMANECER.p1 - 0.5) < 0.002, 'la pausa congela p1 en 0,5');
correr(2.5); console.log('  +2,5   ' + est());
check(Math.abs(AMANECER.p1 - 0.75) < 0.002, 'la reanudación continúa desde 0,5 (0,75 tras 2,5 s)');
correr(2.5 - DT * 2);
check(AMANECER.fase === 'amanecer' && ev.length === 0, 'antes de los 10 s acumulados: sin evento');
correr(DT * 3); console.log('  t=10   ' + est());
check(AMANECER.fase === 'completo' && AMANECER.p1 === 1, 'a los 10 s (sin contar la pausa): completo');
check(ev.join(',') === 'dawn-complete,dome-dawn-complete', 'evento dawn-complete + alias, una vez');
correr(4); console.log('  +4     ' + est());
check(Math.abs(AMANECER.tFin - 4) < 0.05 && ev.length === 2 && AMANECER.emitidos === 1, 'fase 2: tFin = 4 s, el evento no se repite');
correr(2, true);
check(Math.abs(AMANECER.tFin - 4) < 0.05, 'la pausa también congela tFin');
dispararAmanecer(); correr(1);
check(AMANECER.fase === 'completo' && AMANECER.emitidos === 1, 'otro haz con el amanecer completo: no lo reinicia');

console.log('\nreset y skip');
resetAmanecer(); console.log('  reset  ' + est());
check(AMANECER.fase === 'inactivo' && AMANECER.p1 === 0 && AMANECER.tFin === 0, 'reset → inactivo, todo en 0');
dispararAmanecer(); correr(3);
check(AMANECER.fase === 'amanecer' && Math.abs(AMANECER.p1 - 0.3) < 0.01, 'tras reset, un haz lo vuelve a arrancar');
skipAmanecer(); tickAmanecer(DT, false, DUR); console.log('  skip   ' + est());
check(AMANECER.fase === 'completo' && AMANECER.p1 === 1 && AMANECER.tFin > 9000 && AMANECER.emitidos === 1, 'skip → completo, fase 2 terminada, sin emitir (igual que skipDawnToFinal)');
check(Math.abs(easeOut3(0.5) - 0.875) < 1e-9 && easeOut3(0) === 0 && easeOut3(1) === 1, 'easeOut3(0 / 0,5 / 1) = 0 / 0,875 / 1');

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
