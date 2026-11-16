// Z54: prueba de la coreografía del prisma y la flor (lib/prismaFlor.ts) dentro del ciclo de día.
// Uso: node scripts/prisma-flor-test.mjs. DBG_FLOR se lee de lib/debugConfig.ts.
import fs from 'node:fs';
import { estadoPrismaFlor, crearEstadoFlor, crearEstadoRoll, avanzarRoll, anguloRoll, desfasePetalo, anguloPetalo } from '../lib/prismaFlor.ts';
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
console.log('\nZ60/Z62: giro de la cabeza, volteo de los pétalos y color');
{ const TAU = 2 * Math.PI, dt = 1 / 60;
  const correr = (seg, cfg = C, esc = 1, gr = 0, s = crearEstadoRoll()) => { for (let i = 0; i < Math.round(seg / dt); i++) avanzarRoll(s, cfg, dt, esc, gr); return s; };
  const dif = x => Math.abs(((x % TAU) + TAU + Math.PI) % TAU - Math.PI);
  const CR = { ...C, ROLL_CABEZA_ACTIVO: true };
  check(C.ROLL_CABEZA_ACTIVO === false && correr(5).fase === 0, 'Z62: la cabeza entera NO rota por defecto (ROLL_CABEZA_ACTIVO false)');
  check(dif(anguloRoll(correr(CR.ROLL_CABEZA_PERIODO_S, CR), CR)) < 0.01, 'el giro de la cabeza sigue disponible (vuelta en su período)');
  // volteo de los pétalos
  const P = C.PETALO_ROLL_PERIODO_S;
  const s1 = correr(P), sMedio = correr(P / 2);
  console.log(`    volteo: período ${P} s · fase tras un período ${f(dif(s1.ola), 4)} rad · a P/2 ${f(sMedio.ola, 3)} rad`);
  check(dif(s1.ola) < 0.01 && Math.abs(sMedio.ola - Math.PI) < 0.01, `cada pétalo da una vuelta en PETALO_ROLL_PERIODO_S (${P} s)`);
  { const s = correr(1.3); const a = s.ola; avanzarRoll(s, { ...C, PETALO_ROLL_PERIODO_S: 1.2 }, dt, 1, 0);
    check(dif(s.ola - a) < (TAU / 1.2) * dt * 1.01, `cambiar el período no salta (avanza ${f(dif(s.ola - a) * 180 / Math.PI, 2)}° en un frame)`); }
  { const s = correr(1); let mx = 0, prev = s.ola; const cm = { ...C, MUSICA_ROLL: 2 };
    for (let i = 0; i < 120; i++) { avanzarRoll(s, cm, dt, 1, i < 60 ? 1 : 0); mx = Math.max(mx, dif(s.ola - prev)); prev = s.ola; }
    check(mx > (TAU / P) * dt * 1.5 && mx < (TAU / P) * 3 * dt * 1.01, `MUSICA_ROLL acelera el volteo, suave (paso máx. ${f(mx * 180 / Math.PI, 2)}°/frame)`); }
  { const a1 = correr(1, C, 1).ola, a05 = correr(1, C, 0.5).ola; check(Math.abs(a05 - a1 / 2) < 1e-9 && correr(1, C, 0).ola === 0, 'se atenúa con la escala de la flor (nacer y desaparecer)'); }
  { const s = correr(1); const o = s.ola; for (let i = 0; i < 60; i++) avanzarRoll(s, C, 0, 1, 1); check(s.ola === o, 'pausa (dt 0): quieto'); }
  // ola alrededor del anillo
  console.log(`    OLA ${C.PETALO_ROLL_OLA} · desfase ${C.PETALO_ROLL_DESFASE} vueltas · en modo anillo con 0,35 serían ${Math.round(0.35 * 16)} olas alrededor del anillo`);
  { const A = { ...C, PETALO_ROLL_OLA: 'anillo', PETALO_ROLL_DESFASE: 0.0625 };
    check(dif(anguloPetalo(0.7, 16, 16, A) - anguloPetalo(0.7, 0, 16, A)) < 1e-9 && dif(anguloPetalo(1, 0, 16, A) - anguloPetalo(1, 1, 16, A) - desfasePetalo(0.0625, 16)) < 1e-9, 'OLA "anillo": cada vecino retrasado, una ola entera sin costura'); }
  { // OLA "frente" (default): el pétalo del frente adelanta; los dos lados se retrasan igual; el de atrás, 8 pétalos
    const frenteK = 12;   // az = 270° = −90°: el pétalo 12 de 16 mira al frente por defecto
    const r = k => dif(anguloPetalo(1, frenteK, 16, C) - anguloPetalo(1, k, 16, C));
    console.log(`    OLA frente: retraso del pétalo de al lado ${f(r(13) * 180 / Math.PI, 1)}° · del de atrás ${f(r(4) * 180 / Math.PI, 1)}°`);
    check(r(13) > 0 && Math.abs(r(13) - r(11)) < 1e-9 && Math.abs(r(4) - 8 * C.PETALO_ROLL_DESFASE * TAU) < 1e-6, 'OLA "frente": el frente adelanta, los dos lados igual, el de atrás retrasado DESFASE × 8 (sin costura)'); }
  { const A = { ...C, PETALO_ROLL_OLA: 'anillo' }; check(dif(anguloPetalo(1, 3, 12, A, true) - anguloPetalo(1, 3, 12, A, false) - Math.PI) < 1e-9, 'la capa interior en contrafase'); }
  { const V = { ...C, PETALO_ROLL_MODO: 'vaiven' }; let mx = 0; for (let x = 0; x < TAU; x += 0.01) mx = Math.max(mx, Math.abs(anguloPetalo(x, 0, 16, V)));
    check(Math.abs(mx * 180 / Math.PI - C.PETALO_ROLL_AMP_DEG / 2) < 0.5, `vaivén: oscila ±${C.PETALO_ROLL_AMP_DEG / 2}°`); }
  check(anguloPetalo(0.5, 2, 16, { ...C, PETALO_ROLL_SENTIDO: -1 }) === -anguloPetalo(0.5, 2, 16, C), 'SENTIDO −1 invierte el volteo');
  { const s = crearEstadoRoll(); const raro = { ...C, PETALO_ROLL_PERIODO_S: NaN, COLOR_VEL: NaN, MUSICA_ROLL: NaN }; for (let i = 0; i < 100; i++) avanzarRoll(s, raro, NaN, NaN, NaN);
    check(Object.values(s).every(Number.isFinite) && Number.isFinite(anguloPetalo(NaN, NaN, NaN, { ...C, PETALO_ROLL_DESFASE: NaN })), 'sin NaN con valores inválidos'); }
  { const s = correr(10); check(Math.abs(s.tallo - 10 * C.COLOR_TALLO_VEL) < 1e-6, 'el color sube por el tallo a COLOR_TALLO_VEL'); }
}
console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
