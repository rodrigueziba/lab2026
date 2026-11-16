// Z61/Z63: prueba del tiempo, la energía (ganancia automática y elección de banda) y la normalización del campo del
// fluir de color (lib/fluidoBloques.ts). Uso: node scripts/fluido-test.mjs
import fs from 'node:fs';
import { crearEstadoFluido, avanzarFluido, energiaSimulada, elegirBanda } from '../lib/fluidoBloques.ts';
const src = fs.readFileSync(new URL('../lib/debugConfig.ts', import.meta.url), 'utf8');
const C = Function(`return (${/export const DBG_FLUIDO = (\{[\s\S]*?\n\});/.exec(src)[1].replace(/ as string\[\]/g, '').replace(/ as string/g, '')});`)();
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const f = (n, d = 3) => n.toFixed(d);
const dt = 1 / 60;
// bandas: función t → [4 energías crudas]; luces del grupo MONTAÑAS (azul) y LÍNEAS (naranja)
const correr = (seg, bandas, cfg = C, onA = true, onN = true, s = crearEstadoFluido()) => {
  for (let i = 0; i < Math.round(seg / dt); i++) avanzarFluido(s, cfg, dt, bandas(i * dt), onA, onN, 1, 3); return s; };
const silencio = () => [0, 0, 0, 0];
const bombo = (amp) => t => [0.01, amp * (0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.sin(t * Math.PI * 4), 6)), 0.01, 0.005];

console.log('\ntiempo propio por bloque');
const q = correr(10, silencio);
check(Math.abs(q.tA - C.VEL_BASE * 10) < 1e-6 && q.eA === 0 && q.eN === 0, `sin música: deriva lenta a VEL_BASE (${C.VEL_BASE})`);
{ const s = correr(3, silencio); let mx = 0, prev = s.tA; for (let i = 0; i < 240; i++) { avanzarFluido(s, C, dt, i < 120 ? [0, 0.5, 0, 0] : [0, 0, 0, 0], true, true); mx = Math.max(mx, s.tA - prev); prev = s.tA; }
  check(mx <= C.VEL_BASE * (1 + C.ACELERA) * dt * 1.0001, `música de golpe: el tiempo acelera sin saltos (paso máx. ${f(mx, 5)})`); }
{ const s = correr(3, bombo(0.3)); const a = { tA: s.tA, eA: s.eA }; for (let i = 0; i < 60; i++) avanzarFluido(s, C, 0, [0, 1, 0, 0], true, true); check(s.tA === a.tA && s.eA === a.eA, 'pausa (dt 0): quieto'); }
{ const s = correr(5, bombo(0.3)); const t0 = s.tA; avanzarFluido(s, { ...C, VEL_BASE: 0.3 }, dt, [0, 0.3, 0, 0], true, true); check(s.tA - t0 < 0.3 * (1 + C.ACELERA) * dt * 1.0001, 'cambiar VEL_BASE no salta'); }

console.log('\nganancia automática y banda');
{ // el mismo tema a volumen 1 y a volumen 0,05: la energía normalizada recorre 0…1 igual
  const rango = amp => { const s = correr(6, bombo(amp)); let mn = 1, mx = 0; for (let i = 0; i < 240; i++) { avanzarFluido(s, C, dt, bombo(amp)(6 + i * dt), true, true); mn = Math.min(mn, s.eA); mx = Math.max(mx, s.eA); } return [mn, mx]; };
  const fuerte = rango(1), bajo = rango(0.05);
  console.log(`    energía del bloque azul: volumen 1 → ${f(fuerte[0], 2)}…${f(fuerte[1], 2)} · volumen 0,05 → ${f(bajo[0], 2)}…${f(bajo[1], 2)}`);
  check(fuerte[1] > 0.75 && fuerte[0] < 0.3 && Math.abs(bajo[1] - fuerte[1]) < 0.05 && Math.abs(bajo[0] - fuerte[0]) < 0.05, 'recorre la mayor parte de 0…1 (entre golpes no llega a 0 por la bajada de 0,3 s), igual a cualquier volumen'); }
{ const s = correr(6, () => [0.004 * Math.random(), 0.004 * Math.random(), 0.003, 0.002]); check(s.eA < 0.25 && s.eN < 0.25, `silencio con ruido: el PISO (${C.PISO}) no lo amplifica (energías ${f(s.eA, 2)} / ${f(s.eN, 2)})`); }
{ const s = correr(6, t => [0.02, 0.01, 0.3 * (0.5 + 0.5 * Math.sin(t * 9)), 0.1]);
  check(s.bandaA === 2 && s.bandaN === 3, `"auto": el azul toma la banda más activa (${s.bandaA}) y el naranja la siguiente, distinta (${s.bandaN})`); }
check(elegirBanda('grupo', [9, 9, 9, 9], 2) === 2 && elegirBanda('1', [9, 0, 0, 0], 0) === 1, '"grupo" usa la banda del grupo; "0"…"3" la fija');
{ const s = correr(6, bombo(0.5), C, false, true); check(s.eA === 0, 'la luz del grupo apagada: el bloque no reacciona (como hoy)'); }
{ const s = correr(5, silencio, { ...C, SIMULAR_AZUL: true }, false, false); check(s.eA > 0.1 && s.eN === 0, 'música simulada: se mueve sin audio ni luz'); }
{ const s = crearEstadoFluido(); for (let i = 0; i < 100; i++) avanzarFluido(s, { ...C, VEL_BASE: NaN, ACELERA: NaN, MAX_S: NaN, PISO: NaN }, NaN, [NaN, Infinity, -1, undefined], true, true);
  check(Object.values(s).flat().every(Number.isFinite), 'sin NaN con valores inválidos'); }
{ let mn = 1, mx = 0; for (let t = 0; t < 4; t += 0.01) { const e = energiaSimulada(t); mn = Math.min(mn, e); mx = Math.max(mx, e); } check(mn >= 0 && mx <= 1, 'energía simulada en 0…1'); }

console.log('\nnormalización del campo (réplica del shader)');
{ const ss = x => x * x * (3 - 2 * x); const norm = v => ss(Math.min(1, Math.max(0, (v - C.RANGO_MIN) / (C.RANGO_MAX - C.RANGO_MIN))));
  check(norm(C.RANGO_MIN) === 0 && norm(C.RANGO_MAX) === 1 && Math.abs(norm((C.RANGO_MIN + C.RANGO_MAX) / 2) - 0.5) < 1e-9, `el rango observado del fbm (${C.RANGO_MIN}–${C.RANGO_MAX}) se lleva a 0…1 (recorre toda la paleta)`); }
console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
