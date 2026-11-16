// Z65: prueba de los monolitos que vuelven con el pasto completo (lib/monolitosPasto.ts + chequearTodoCompleto de
// lib/pasto.ts): condición "los 4 completos", modos, posición (línea de la tarima, simetría, 1 m libre al borde del
// pasto, recálculo con MARGEN_M), aparición suave con el reloj de la experiencia y evento único.
// Uso: node scripts/monolitos-pasto-test.mjs
import fs from 'node:fs';
import { crearEstadoPasto, avanzarPasto, completarCuarto, reiniciarPasto, rectPasto, chequearTodoCompleto } from '../lib/pasto.ts';
import { todosCompletos, monolitosMontados, monolitosObjetivo, posMonolitosPasto, avanzarAparicion, suaveAparicion, hundimientoM } from '../lib/monolitosPasto.ts';
const src = fs.readFileSync(new URL('../lib/debugConfig.ts', import.meta.url), 'utf8');
const C = Function(`return (${/export const DBG_PASTO = (\{[\s\S]*?\n\});/.exec(src)[1].replace(/ as string/g, '')});`)();
const S = Function(`return (${/export const DBG_SILLAS = (\{[\s\S]*?\n\});/.exec(src)[1].replace(/ as [A-Za-z\[\]"|' ]+(?=,)/g, '')});`)();
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const f = (n, d = 3) => n.toFixed(d);
// medidas reales (components/Monoliths.tsx): COL_SIDE 0,58 · BASE_SIDE = 0,58 × 2,3 · H 3,2; tarima centrada en (0, 0)
const ANCHO = 0.58 * 2.3, ALTO = 3.2, TARIMA_Z = 0;
// luces como hoy: radio hazRadiusM, diagonales (−45°, 45°, 135°, −135°) + rotationDeg 0
const R = S.hazRadiusM, ang = [-Math.PI / 4, Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4];
const LX = ang.map(a => R * Math.cos(a)), LZ = ang.map(a => R * Math.sin(a)), ON = [true, true, true, true];
const dt = 1 / 60;

console.log('\ncondición');
check(C.MONOLITOS_ACTIVO === true && C.MONOLITOS_MODO === 'pasto' && C.MONOLITOS_APARICION_S === 3 && C.MONOLITO_SEP_M === 1, 'defaults: ACTIVO true, MODO "pasto", APARICION_S 3, SEP_M 1');
{ const s = crearEstadoPasto(); let ev = 0;
  for (let i = 0; i < 3; i++) completarCuarto(s, i);
  if (chequearTodoCompleto(s)) ev++;
  check(!todosCompletos(s.completo) && !monolitosObjetivo(C, s.completo) && ev === 0, '3 cuartos completos: no aparecen ni sale el evento');
  s.p[3] = 0.999; check(!monolitosObjetivo(C, s.completo), 'el cuarto 4 en 0,999 (no completo): todavía no');
  completarCuarto(s, 3); if (chequearTodoCompleto(s)) ev++;
  check(monolitosObjetivo(C, s.completo) && ev === 1, 'los 4 completos: aparecen y sale alight:pasto-completo');
  for (let i = 0; i < 100; i++) if (chequearTodoCompleto(s)) ev++;
  check(ev === 1, 'el evento sale una sola vez');
  for (let i = 0; i < 600; i++) avanzarPasto(s, C, dt, 0, 0, LX, LZ, ON);
  check(monolitosObjetivo(C, s.completo), 'el pasto completo no decae: quedan permanentes');
  reiniciarPasto(s);
  check(!monolitosObjetivo(C, s.completo), 'checkpoint (reiniciarPasto): desaparecen');
  for (let i = 0; i < 4; i++) completarCuarto(s, i); if (chequearTodoCompleto(s)) ev++;
  check(ev === 2, 'tras el reinicio, completar otra vez vuelve a emitir (una vez)'); }
{ const s = crearEstadoPasto(); // camino real: el usuario se queda bajo cada luz CRECE_S
  let primero = -1;
  for (let i = 0; i < 4; i++) for (let k = 0; k < Math.ceil((C.CRECE_S + 0.5) / dt); k++) {
    avanzarPasto(s, C, dt, LX[i], LZ[i], LX, LZ, ON);
    if (primero < 0 && monolitosObjetivo(C, s.completo)) primero = i;
  }
  check(primero === 3, `caminando: recién al completar el 4.º cuarto (≈ ${f(4 * C.CRECE_S, 0)} s bajo las luces)`); }
{ const todo = [true, true, true, true], nada = [false, false, false, false];
  check(monolitosObjetivo({ ...C, MONOLITOS_MODO: 'siempre' }, nada) && !monolitosObjetivo({ ...C, MONOLITOS_MODO: 'nunca' }, todo), 'modo "siempre" / "nunca"');
  check(!monolitosMontados({ ...C, MONOLITOS_ACTIVO: false }) && !monolitosObjetivo({ ...C, MONOLITOS_ACTIVO: false, MONOLITOS_MODO: 'siempre' }, todo), 'MONOLITOS_ACTIVO false: nunca (ni se montan, como Z64)');
  check(!monolitosMontados({ ...C, MONOLITOS_MODO: 'nunca' }) && monolitosMontados(C), '"nunca" no monta; "pasto" monta (ocultos hasta completar)'); }

console.log('\nposición');
{ const rect = rectPasto(LX, LZ, C.MARGEN_M, [0, 0, 0, 0]);
  const o = posMonolitosPasto(rect, C.MONOLITO_SEP_M, ANCHO, TARIMA_Z, { xL: 0, xR: 0, z: 0 });
  console.log(`    luces en (±${f(LX[0], 2)}, ±${f(LZ[1], 2)}) · borde del pasto x ${f(rect[0], 2)} … ${f(rect[2], 2)} · ancho del monolito ${f(ANCHO, 3)} m (base) → centros x ${f(o.xL, 3)} / ${f(o.xR, 3)}, z ${f(o.z, 2)}`);
  check(o.z === TARIMA_Z, 'misma Z que el centro de la tarima');
  check(Math.abs(o.xL + o.xR) < 1e-9, 'simétricos respecto de la tarima (x = 0)');
  check(Math.abs((rect[0] - (o.xL + ANCHO / 2)) - 1) < 1e-9 && Math.abs(((o.xR - ANCHO / 2) - rect[2]) - 1) < 1e-9, '1 m libre entre el borde del pasto y la cara más cercana de cada monolito');
  const r2 = rectPasto(LX, LZ, 3.5, [0, 0, 0, 0]), o2 = posMonolitosPasto(r2, C.MONOLITO_SEP_M, ANCHO, TARIMA_Z, { xL: 0, xR: 0, z: 0 });
  check(Math.abs(o2.xR - o.xR - 1.5) < 1e-9 && Math.abs(((o2.xR - ANCHO / 2) - r2[2]) - 1) < 1e-9, `MARGEN_M 3,5: se recalculan (x ±${f(o2.xR, 3)}), siguen a 1 m`);
  const R2 = 18, LX2 = ang.map(a => R2 * Math.cos(a)), r3 = rectPasto(LX2, LZ, C.MARGEN_M, [0, 0, 0, 0]), o3 = posMonolitosPasto(r3, 1, ANCHO, 0, { xL: 0, xR: 0, z: 0 });
  check(Math.abs(((o3.xR - ANCHO / 2) - r3[2]) - 1) < 1e-9, 'si se mueven las luces, también');
  check(Math.abs(o.xR) + ANCHO / 2 < 39.5, 'dentro de la sala'); }

console.log('\naparición suave (reloj de la experiencia)');
{ let k = 0, t = 0; const marcas = [];
  while (k < 1 && t < 10) { k = avanzarAparicion(k, true, dt, C); t += dt; if (Math.abs(t - 1.5) < dt / 2) marcas.push(k); }
  check(Math.abs(t - C.MONOLITOS_APARICION_S) < 2 * dt, `llega a 1 en ${f(t, 2)} s (APARICION_S ${C.MONOLITOS_APARICION_S})`);
  check(Math.abs(marcas[0] - 0.5) < 0.02 && Math.abs(suaveAparicion(marcas[0]) - 0.5) < 0.03, 'a mitad de camino, mitad de la subida');
  check(hundimientoM(0, ALTO) <= -ALTO && hundimientoM(1, ALTO) === 0 && suaveAparicion(0) === 0, `oculto: ${f(hundimientoM(0, ALTO), 2)} m bajo el suelo y opacidad 0; aparecido: al ras`);
  let k2 = 0.4; for (let i = 0; i < 120; i++) k2 = avanzarAparicion(k2, true, 0, C);
  check(k2 === 0.4, 'pausa (dt 0): quieto');
  check(avanzarAparicion(0, true, 5, C) <= 0.1 / C.MONOLITOS_APARICION_S + 1e-9, 'dt acotado (sin saltos tras un tirón)');
  check(avanzarAparicion(1, false, dt, C) === 0, 'BAJADA_S 0: desaparecen junto con el pasto');
  check(Math.abs(avanzarAparicion(1, false, dt, { ...C, MONOLITOS_BAJADA_S: 2 }) - (1 - dt / 2)) < 1e-9, 'BAJADA_S 2: se hunden en 2 s');
  check(Number.isFinite(avanzarAparicion(NaN, true, NaN, { ...C, MONOLITOS_APARICION_S: NaN })), 'sin NaN'); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
