// Z54: prueba de la coreografía del prisma y la flor (lib/prismaFlor.ts) dentro del ciclo de día.
// Uso: node scripts/prisma-flor-test.mjs. DBG_FLOR se lee de lib/debugConfig.ts.
import fs from 'node:fs';
import { estadoPrismaFlor, crearEstadoFlor, crearEstadoRoll, avanzarRoll, anguloRoll, retrasoPetalo, olaPetalo } from '../lib/prismaFlor.ts';
import { crearEstadoDia, avanzarDia } from '../lib/cicloDia.ts';

const src = fs.readFileSync(new URL('../lib/debugConfig.ts', import.meta.url), 'utf8');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string/g, '').replace(/ as number\[\]/g, '')});`)();
const C = obj('DBG_FLOR'), DIA_CFG = obj('DBG_DIA');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const f = (n, d = 3) => n.toFixed(d);
const E = crearEstadoFlor();
const en = (x, c = C, activo = true) => ({ ...estadoPrismaFlor(x, c, activo, E) });

console.log('\nvalores en los puntos pedidos');
for (const x of [0, 0.25, 0.29, 0.31, 0.37, 0.42, 0.5, 0.66, 0.7, 0.75, 0.8, 0.9, 1.0]) {
  const e = en(x); console.log(`    tDia ${f(x, 2)}: prisma ${f(e.altura)} · flor ${f(e.escala)} · apertura ${f(e.apertura)} · tallo ${f(e.tallo)} · cabeza ${f(e.cabeza)}`);
}
check(en(0).altura === 0 && en(0.25).altura === 0 && en(0.2).escala === 0, 'primer cuarto: prisma apoyado, sin flor');
check(en(0.37).altura === 1 && en(0.5).altura === 1 && en(0.75).altura === 1, 'arriba entre SUBE_FIN (0,37) y BAJA_INICIO (0,75)');
check(en(0.29).escala === 0 && en(0.42).escala === 1 && en(0.42).apertura === 1 && en(0.66).escala === 1, 'la flor nace en 0,29, completa y abierta en 0,42, igual hasta 0,66');
check(en(0.75).escala === 0 && en(0.76).escala === 0 && en(0.74).escala > 0, 'desaparece justo en 0,75 (fin del tercer cuarto)');
check(en(0.29).altura > 0.05, `cuando nace la flor el prisma ya se despegó (altura ${f(en(0.29).altura)})`);
check(en(0.8).altura < 1 && en(0.9).altura < en(0.8).altura && en(1).altura === 0, 'baja durante todo el último cuarto y termina apoyado en 1');
{ const a = en(0), b = en(1); check(a.altura === b.altura && a.escala === b.escala && a.apertura === b.apertura, 'tDia 0 y 1 coinciden (con LOOP el día nuevo empieza con el prisma apoyado)'); }

console.log('\nmonotonía y continuidad');
let subeOk = true, bajaOk = true, naceOk = true, achicaOk = true, maxPaso = 0, prev = en(0);
for (let x = 1e-4; x <= 1; x += 1e-4) {
  const e = en(x);
  if (x >= C.SUBE_INICIO && x <= C.SUBE_FIN && e.altura < prev.altura - 1e-12) subeOk = false;
  if (x >= C.BAJA_INICIO && x <= C.BAJA_FIN && e.altura > prev.altura + 1e-12) bajaOk = false;
  if (x >= C.NACE_INICIO && x <= C.NACE_FIN && e.escala < prev.escala - 1e-12) naceOk = false;
  if (x >= C.ACHICA_INICIO && x <= C.ACHICA_FIN && e.escala > prev.escala + 1e-12) achicaOk = false;
  maxPaso = Math.max(maxPaso, Math.abs(e.altura - prev.altura), Math.abs(e.escala - prev.escala), Math.abs(e.apertura - prev.apertura));
  prev = e;
}
check(subeOk && bajaOk && naceOk && achicaOk, 'sube y crece sin retroceder; baja y se achica sin rebotar');
check(maxPaso < 0.02, `continua: el paso máximo por 1e-4 de tDia es ${f(maxPaso, 4)} (sin saltos)`);
check(en(0.33).tallo > en(0.33).cabeza && en(0.42).apertura > en(0.36).apertura, 'primero el tallo, después la cabeza que se abre');
check(en(0.69).apertura < 0.5 && en(0.69).escala > 0.9 && en(0.72).escala < en(0.69).escala, `al desaparecer: primero se cierra (apertura ${f(en(0.69).apertura)} con flor ${f(en(0.69).escala)}), después se achica`);

console.log('\nflags y ciclo');
check(Object.values(en(0.5, C, false)).every(v => v === false || v === 0), 'ciclo inactivo (DBG_DIA.NUEVO false o sin arrancar): prisma apoyado, sin flor');
check(en(0.5, { ...C, ACTIVO: false }).altura === 0 && en(0.5, { ...C, ACTIVO: false }).escala === 0, 'DBG_FLOR.ACTIVO false: prisma como hoy');
{ // pausa: el ciclo no avanza, el estado queda igual
  const d = crearEstadoDia(), am = { fase: 'inactivo', pendiente: true, t: 0, p1: 0, tFin: 0 }, cfg = { ...structuredClone(DIA_CFG) };
  for (let i = 0; i < 60 * 120; i++) avanzarDia(d, cfg, 1 / 60, false, am, 180, 1);
  const a = { ...estadoPrismaFlor(d.dia, C, true, E) };
  for (let i = 0; i < 60 * 30; i++) avanzarDia(d, cfg, 1 / 60, true, am, 180, 1);
  const b = { ...estadoPrismaFlor(d.dia, C, true, E) };
  check(a.altura === b.altura && a.escala === b.escala && a.apertura === b.apertura, `con la pausa queda congelado (tDia ${f(d.dia)}: prisma ${f(a.altura)}, flor ${f(a.escala)})`);
}
console.log('\nZ57: altura de la flor');
{ const H = C.ALTURA_M * C.ALTURA_FACTOR, alto15 = C.ALTURA_M * 1.5;
  console.log(`    ALTURA_M ${C.ALTURA_M} × ALTURA_FACTOR ${C.ALTURA_FACTOR} = ${f(H, 2)} m (Z54: 2,7 m; con ALTURA_FACTOR 1,5: ${f(alto15, 2)} m) · ESCALA_CABEZA ${C.ESCALA_CABEZA}`);
  check(Math.abs(H / 2.7 - 0.6667) < 0.001, `33 % más baja: ${f(H, 2)} / 2,7 = ${f(H / 2.7, 3)}`);
  check(Math.abs(alto15 - 2.7) < 1e-9 && Math.abs(C.ESCALA_CABEZA - 0.67) < 1e-9, 'ALTURA_FACTOR 1,5 = la altura de Z54; la cabeza un tercio menor desde Z60 (ESCALA_CABEZA 0,67)'); }
console.log('\nZ60: giro de la cabeza, ola y color');
{ const TAU = 2 * Math.PI, P = C.ROLL_CABEZA_PERIODO_S, dt = 1 / 60;
  const correr = (seg, cfg = C, esc = 1, gr = 0, s = crearEstadoRoll()) => { for (let i = 0; i < Math.round(seg / dt); i++) avanzarRoll(s, cfg, dt, esc, gr); return s; };
  const a0 = anguloRoll(crearEstadoRoll(), C), sP = correr(P), aP = anguloRoll(sP, C);   // (signo según SENTIDO)
  const dif = x => Math.abs(((x % TAU) + TAU + Math.PI) % TAU - Math.PI);
  console.log(`    período ${P} s: ángulo tras un período ${f(aP, 4)} rad (≡ ${f(dif(aP - a0), 5)} de la vuelta) · a P/4: ${f(anguloRoll(correr(P / 4), C) * 180 / Math.PI, 1)}°`);
  check(dif(aP - a0) < 0.01 && Math.abs(Math.abs(anguloRoll(correr(P / 2), C)) - Math.PI) < 0.01, `vuelta completa en ROLL_CABEZA_PERIODO_S (${P} s); media vuelta a ${f(P / 2, 1)} s`);
  // sin saltos al cambiar la velocidad a mitad de camino (fase acumulada)
  { const s = correr(1.3); const antes = anguloRoll(s, C); avanzarRoll(s, { ...C, ROLL_CABEZA_PERIODO_S: 1.5 }, dt, 1, 0); const despues = anguloRoll(s, C);
    check(dif(despues - antes) < (TAU / 1.5) * dt * 1.01, `cambiar el período de ${P} a 1,5 s no salta: avanza ${f(dif(despues - antes) * 180 / Math.PI, 2)}° en un frame`); }
  // música: acelera suave (graves suavizados), sin saltos
  { const s = correr(1); let maxPaso = 0, prev = anguloRoll(s, C); const cm = { ...C, MUSICA_ROLL: 2 };
    for (let i = 0; i < 120; i++) { avanzarRoll(s, cm, dt, 1, i < 60 ? 1 : 0); const a = anguloRoll(s, cm); maxPaso = Math.max(maxPaso, dif(a - prev)); prev = a; }
    check(maxPaso < (TAU / P) * 3 * dt * 1.01 && s.graves < 0.2, `MUSICA_ROLL 2 con graves de golpe: acelera suave (paso máx. ${f(maxPaso * 180 / Math.PI, 2)}°/frame ≤ 3× la velocidad base) y vuelve`); }
  // atenuación con la escala y pausa
  { const a1 = correr(1, C, 1).fase, a05 = correr(1, C, 0.5).fase, a0e = correr(1, C, 0).fase;
    check(Math.abs(a05 - a1 / 2) < 1e-9 && a0e === 0, 'se atenúa con la escala de la flor (escala 0,5 → mitad de velocidad; 0 → quieta)'); }
  { const s = correr(1); const f0 = { ...s }; for (let i = 0; i < 60; i++) avanzarRoll(s, C, 0, 1, 1); check(s.fase === f0.fase && s.ola === f0.ola && s.color === f0.color && s.tallo === f0.tallo, 'con dt 0 (pausa del reloj de la experiencia) todo queda quieto'); }
  // mecerse con AMP < 360, sentido, y sin NaN
  { const cm = { ...C, ROLL_CABEZA_AMP_DEG: 90 }; let mx = 0; const s = crearEstadoRoll(); for (let i = 0; i < 600; i++) { avanzarRoll(s, cm, dt, 1, 0); mx = Math.max(mx, Math.abs(anguloRoll(s, cm))); }
    check(Math.abs(mx * 180 / Math.PI - 45) < 0.5, `AMP 90: se mece ±45° (máx. ${f(mx * 180 / Math.PI, 1)}°)`); }
  { const s = correr(1); check(anguloRoll(s, { ...C, ROLL_CABEZA_SENTIDO: -1 }) === -anguloRoll(s, { ...C, ROLL_CABEZA_SENTIDO: 1 }), `SENTIDO −1 invierte el giro (default ${C.ROLL_CABEZA_SENTIDO})`); }
  { const s = crearEstadoRoll(); const raro = { ...C, ROLL_CABEZA_PERIODO_S: NaN, COLOR_VEL: NaN, MUSICA_ROLL: NaN }; for (let i = 0; i < 100; i++) avanzarRoll(s, raro, NaN, NaN, NaN);
    check(Object.values(s).every(Number.isFinite) && Number.isFinite(anguloRoll(s, { ...raro, ROLL_CABEZA_AMP_DEG: NaN })), 'sin NaN con valores inválidos'); }
  // ola atada al giro: abierta con la cara arriba, copa con la cara abajo; retraso por distancia al frente, sin costura
  { const D = C.PETALO_OLA_DESFASE, az = k => (k / 16) * TAU, prom = a => { let m = 0; for (let k = 0; k < 16; k++) m += olaPetalo(a, az(k), 16, D); return m / 16; };
    const arriba = prom(0), abajo = prom(Math.PI);
    console.log(`    apertura media del anillo: cara arriba ${f(arriba, 2)} · cara abajo ${f(abajo, 2)} · retraso del pétalo de atrás ${f(retrasoPetalo(0, 16, D), 2)} rad`);
    for (const d of [0.1, 0.15, 0.2, 0.35]) { const pm = a => { let m = 0; for (let k = 0; k < 16; k++) m += olaPetalo(a, az(k), 16, d); return m / 16; }; console.log(`      DESFASE ${d}: apertura media cara arriba ${f(pm(0), 2)} / cara abajo ${f(pm(Math.PI), 2)}`); }
    check(arriba > abajo && olaPetalo(0, Math.PI, 16, D) === 1 && olaPetalo(Math.PI, Math.PI, 16, D) === -1, 'el pétalo del frente: abierto con la cara arriba, en copa con la cara abajo (la ola sigue al giro)');
    let maxSalto = 0; for (let k = 0; k < 16; k++) maxSalto = Math.max(maxSalto, Math.abs(retrasoPetalo(az(k + 1), 16, D) - retrasoPetalo(az(k), 16, D)));
    check(Math.abs(maxSalto - D) < 1e-9 && retrasoPetalo(Math.PI, 16, D) === 0, `cada pétalo se retrasa ${D} rad respecto del vecino más cercano al frente, sin costura (salto máx. ${f(maxSalto, 3)})`);
    check(Math.abs(olaPetalo(0.3, az(3), 12, D, true) + olaPetalo(0.3, az(3), 12, D, false)) < 1e-9, 'la capa interior en contrafase'); }
  { const s = correr(10); check(Math.abs(s.tallo - 10 * C.COLOR_TALLO_VEL) < 1e-6 && s.tallo > 0, `el color sube por el tallo a COLOR_TALLO_VEL (${C.COLOR_TALLO_VEL} vueltas/s)`); }
}
console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
