// Z64: prueba de lib/pasto.ts (crecimiento por cuartos, umbral irregular, orden inverso, histéresis, pausa).
// Uso: node scripts/pasto-test.mjs
import fs from 'node:fs';
import { crearEstadoPasto, avanzarPasto, cuartoDe, rectPasto, distMaxCuarto, umbralPasto, manchaPasto, alturaPasto, HISTERESIS_M } from '../lib/pasto.ts';
const src = fs.readFileSync(new URL('../lib/debugConfig.ts', import.meta.url), 'utf8');
const C = Function(`return (${/export const DBG_PASTO = (\{[\s\S]*?\n\});/.exec(src)[1].replace(/ as string \| number/g, "").replace(/ as string/g, "")});`)();
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const f = (n, d = 3) => n.toFixed(d);
// luces como hoy: radio 15 m, diagonales (−45°, 45°, 135°, −135°)
const R = 15, ang = [-Math.PI / 4, Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4];
const LX = ang.map(a => R * Math.cos(a)), LZ = ang.map(a => R * Math.sin(a)), ON = [true, true, true, true];
const dt = 1 / 60;
const correr = (s, seg, x, z, on = ON, cfg = C) => { const ev = []; for (let i = 0; i < Math.round(seg / dt); i++) { avanzarPasto(s, cfg, dt, x, z, LX, LZ, on); s.ev.forEach((e, k) => e && ev.push([k, e])); } return ev; };

console.log('\ncuartos y área');
const rect = rectPasto(LX, LZ, C.MARGEN_M, [0, 0, 0, 0]);
const area = (rect[2] - rect[0]) * (rect[3] - rect[1]);
console.log(`    luces: ${LX.map((x, i) => `(${f(x, 2)}, ${f(LZ[i], 2)})`).join(' ')} · rectángulo x ${f(rect[0], 2)}…${f(rect[2], 2)}, z ${f(rect[1], 2)}…${f(rect[3], 2)} · ${f(area, 0)} m² (${f(area / 4, 0)} m² por cuarto)`);
check(cuartoDe(LX[2], LZ[2], LX, LZ) === 2 && cuartoDe(1, 1, LX, LZ) === 1, 'cada cuarto es la celda de Voronoi de su luz');
const dm = [0, 1, 2, 3].map(i => distMaxCuarto(i, LX, LZ, rect));
check(dm.every(d => Math.abs(d - dm[0]) < 0.3), `distancia máxima de cada luz a su cuarto ≈ ${f(dm[0], 2)} m (simétrica)`);

console.log('\ncrecimiento');
{ const s = crearEstadoPasto(); const ev = correr(s, 7, LX[0], LZ[0]);
  check(Math.abs(s.p[0] - 7 / C.CRECE_S) < 0.01 && s.p[1] === 0, `bajo la luz 1 durante 7 s: p = ${f(s.p[0])} (= 7/${C.CRECE_S}); los otros cuartos en 0`);
  check(ev.length === 1 && ev[0][0] === 0 && ev[0][1] === 1, 'evento "crece" una vez al empezar');
  const p0 = s.p[0]; const ev2 = correr(s, 2, 0, 0);
  check(Math.abs(s.p[0] - (p0 - 2 / C.DECAE_S)) < 0.01 && ev2.length === 1 && ev2[0][1] === 2, `al salir decae a 1/${C.DECAE_S} por s (p = ${f(s.p[0])}) y emite "decae"`);
  const p1 = s.p[0]; correr(s, 1, LX[0], LZ[0]);
  check(Math.abs(s.p[0] - (p1 + 1 / C.CRECE_S)) < 0.01, 'al volver continúa desde donde estaba');
  const ev3 = correr(s, 20, LX[0], LZ[0]);
  check(s.p[0] === 1 && s.completo[0] && ev3.filter(e => e[1] === 3).length === 1, 'llega a 1: completo, evento "completo" una sola vez');
  correr(s, 30, 0, 0); check(s.p[0] === 1, 'completo: no decae más al salir'); }
// Z74: por defecto alcanza con estar bajo la luz (antes "luz apagada: no crece"); con REQUIERE_LUZ_ENCENDIDA, como Z64
{ const s = crearEstadoPasto(); correr(s, 5, LX[1], LZ[1], [true, false, true, true]); check(s.p[1] > 0, 'luz apagada: igual crece (Z74)'); }
{ const s = crearEstadoPasto(); correr(s, 5, LX[1], LZ[1], [true, false, true, true], { ...C, REQUIERE_LUZ_ENCENDIDA: true }); check(s.p[1] === 0, 'con REQUIERE_LUZ_ENCENDIDA (como Z64): luz apagada no crece'); }
{ const s = crearEstadoPasto(); correr(s, 5, 0, 0, ON, { ...C, SIMULAR: 2 }); check(s.p[2] > 0.3 && s.p[0] === 0, 'SIMULAR 2: crece el cuarto 3 sin caminar'); }

console.log('\nhistéresis, pausa, NaN');
{ const s = crearEstadoPasto(); const r = C.RADIO_LUZ_M;
  avanzarPasto(s, C, dt, LX[0] + r - 0.01, LZ[0], LX, LZ, ON); const a = s.dentro[0];
  avanzarPasto(s, C, dt, LX[0] + r + HISTERESIS_M * 0.5, LZ[0], LX, LZ, ON); const b = s.dentro[0];
  avanzarPasto(s, C, dt, LX[0] + r + HISTERESIS_M + 0.01, LZ[0], LX, LZ, ON); const c = s.dentro[0];
  const s2 = crearEstadoPasto(); avanzarPasto(s2, C, dt, LX[0] + r + 0.1, LZ[0], LX, LZ, ON);
  check(a && b && !c && !s2.dentro[0], `entra a < ${r} m, sigue adentro hasta ${r + HISTERESIS_M} m, no entra desde ${r + 0.1} m (sin parpadeo en el borde)`); }
{ const s = crearEstadoPasto(); correr(s, 3, LX[0], LZ[0]); const p = s.p[0]; for (let i = 0; i < 60; i++) avanzarPasto(s, C, 0, 0, 0, LX, LZ, ON); check(s.p[0] === p, 'pausa (dt 0): quieto'); }
{ const s = crearEstadoPasto(); avanzarPasto(s, C, 5, LX[0], LZ[0], LX, LZ, ON); check(Math.abs(s.p[0] - 0.1 / C.CRECE_S) < 1e-9, 'dt acotado a 0,1 s (sin saltos tras un tirón)'); }
{ const s = crearEstadoPasto(); for (let i = 0; i < 50; i++) avanzarPasto(s, { ...C, CRECE_S: NaN, DECAE_S: NaN, RADIO_LUZ_M: NaN }, NaN, NaN, NaN, LX, LZ, ON);
  check(s.p.every(Number.isFinite), 'sin NaN con valores inválidos'); }

console.log('\nforma: umbral irregular y orden inverso');
{ // malla del cuarto 1 con el mismo umbral que el shader
  const pts = []; for (let x = rect[0]; x <= rect[2]; x += 0.25) for (let z = rect[1]; z <= rect[3]; z += 0.25) {
    if (cuartoDe(x, z, LX, LZ) !== 0) continue; const dn = Math.min(1, Math.hypot(x - LX[0], z - LZ[0]) / dm[0]);
    pts.push({ dn, u: umbralPasto(dn, manchaPasto(x, z, C.ESCALA_MANCHA_M), C) }); }
  const vis = p => pts.filter(q => p > q.u);
  const cerca = pts.filter(q => q.dn < 0.1), lejos = pts.filter(q => q.dn > 0.8);
  check(vis(0.05).length > 0 && vis(0.05).every(q => q.dn < 0.35), `arranca bajo la luz (con p = 0,05 todo lo visible está a dn < 0,35)`);
  check(cerca.every(q => q.u < lejos.reduce((m, r) => Math.min(m, r.u), 1)), 'avanza de la luz hacia afuera');
  // irregular: a igual distancia, umbrales distintos
  const anillo = pts.filter(q => Math.abs(q.dn - 0.6) < 0.03), du = Math.max(...anillo.map(q => q.u)) - Math.min(...anillo.map(q => q.u));
  check(du > 0.15, `irregular: en el anillo dn ≈ 0,6 el umbral varía ${f(du, 2)} (manchones, no un círculo)`);
  check(vis(1).length === pts.length && pts.every(q => alturaPasto(1, q.u, C.FRENTE_ANCHO) === 1), 'con p = 1 todo el cuarto cubierto y a altura completa');
  // orden inverso exacto: el conjunto visible depende solo de p → al bajar se apaga en el orden inverso al que apareció
  const orden = [...pts].sort((a, b) => a.u - b.u); let inverso = true;
  for (const p of [0.9, 0.6, 0.3, 0.1]) { const v = vis(p).length; if (orden.slice(0, v).some(q => !(p > q.u))) inverso = false; }
  check(inverso, 'al decaer se retira en el orden exactamente inverso (mismo umbral: el último en aparecer es el primero en irse)');
  check(alturaPasto(0.3, 0.3, C.FRENTE_ANCHO) === 0 && alturaPasto(0.3 + C.FRENTE_ANCHO / 2, 0.3, C.FRENTE_ANCHO) === 0.5, 'las briznas nacen desde el suelo y crecen en la franja del frente'); }
console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
