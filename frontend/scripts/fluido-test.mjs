// Z61: prueba del tiempo y la energía del fluir de color (lib/fluidoBloques.ts). Uso: node scripts/fluido-test.mjs
import fs from 'node:fs';
import { crearEstadoFluido, avanzarFluido, energiaSimulada } from '../lib/fluidoBloques.ts';
const src = fs.readFileSync(new URL('../lib/debugConfig.ts', import.meta.url), 'utf8');
const C = Function(`return (${/export const DBG_FLUIDO = (\{[\s\S]*?\n\});/.exec(src)[1].replace(/ as string\[\]/g, '')});`)();
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const f = (n, d = 3) => n.toFixed(d);
const dt = 1 / 60;
const correr = (seg, eA, eN, cfg = C, s = crearEstadoFluido()) => { for (let i = 0; i < Math.round(seg / dt); i++) avanzarFluido(s, cfg, dt, typeof eA === 'function' ? eA(i * dt) : eA, typeof eN === 'function' ? eN(i * dt) : eN); return s; };

const quieto = correr(10, 0, 0);
console.log(`\nsin música, 10 s: tA ${f(quieto.tA)} (= VEL_BASE ${C.VEL_BASE} × 10) · energías ${f(quieto.eA)} / ${f(quieto.eN)}`);
check(Math.abs(quieto.tA - C.VEL_BASE * 10) < 1e-6 && quieto.eA === 0, 'sin música: deriva lenta a VEL_BASE');
const conA = correr(10, 1, 0);
check(conA.tA > quieto.tA * (1 + C.ACELERA) * 0.95 && Math.abs(conA.tN - quieto.tN) < 1e-9, `con música solo en el grupo del bloque azul: acelera el azul (× ${f(conA.tA / quieto.tA, 2)}) y el naranja sigue igual`);
{ const s = correr(2, 0, 0); let maxPaso = 0, prev = s.tA; for (let i = 0; i < 240; i++) { avanzarFluido(s, C, dt, i < 120 ? 1 : 0, 0); maxPaso = Math.max(maxPaso, s.tA - prev); prev = s.tA; }
  check(maxPaso <= C.VEL_BASE * (1 + C.ACELERA) * dt * 1.0001, `energía de golpe (0 → 1 → 0): el tiempo no salta (paso máx. ${f(maxPaso, 5)} por frame)`); }
{ const s = correr(0.3, 1, 0); check(s.eA > 0.6 && s.eA < 0.7, `suavizado: a SUAVIZADO_S (${C.SUAVIZADO_S} s) la energía va por ${f(s.eA, 2)} (≈ 1 − 1/e)`); }
{ const s = correr(3, 1, 1); const a = { ...s }; for (let i = 0; i < 60; i++) avanzarFluido(s, C, 0, 1, 1); check(s.tA === a.tA && s.tN === a.tN && s.eA === a.eA, 'pausa (dt 0): todo quieto'); }
{ const s = correr(5, 1, 0); const t0 = s.tA; avanzarFluido(s, { ...C, VEL_BASE: 0.3 }, dt, 1, 0); check(s.tA - t0 < 0.3 * (1 + C.ACELERA) * dt * 1.0001, 'cambiar VEL_BASE no salta (tiempo acumulado)'); }
{ const s = correr(5, 1, 1, { ...C, MUSICA_AZUL: 0 }); check(s.eA === 0 && s.eN > 0.9, 'MUSICA_AZUL 0: el bloque azul no reacciona; el naranja sí'); }
{ const s = correr(5, 0, 0, { ...C, SIMULAR_AZUL: true }); let mn = 1, mx = 0; for (let t = 0; t < 4; t += 0.01) { const e = energiaSimulada(t); mn = Math.min(mn, e); mx = Math.max(mx, e); }
  check(s.eA > 0.1 && s.eN === 0 && mn >= 0 && mx <= 1, `música simulada: el azul se mueve sin audio (energía ${f(s.eA, 2)}), rango ${f(mn, 2)}…${f(mx, 2)}`); }
{ const s = crearEstadoFluido(); for (let i = 0; i < 100; i++) avanzarFluido(s, { ...C, VEL_BASE: NaN, ACELERA: NaN, SUAVIZADO_S: NaN, MUSICA_AZUL: NaN }, NaN, NaN, Infinity);
  check(Object.values(s).every(Number.isFinite), 'sin NaN con valores inválidos'); }
console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
