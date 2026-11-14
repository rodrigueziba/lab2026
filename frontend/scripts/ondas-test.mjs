// Z52: prueba del detector de kick por luz/banda y de la lista de ondas (lib/ondasKick.ts), y del perfil de la onda
// (réplica en JS de las cuentas del shader del domo). Uso: node scripts/ondas-test.mjs
import fs from 'node:fs';
import { ONDAS, MAX_ONDAS, detectar, envejecer, lanzarOnda, limpiarOndas, edad } from '../lib/ondasKick.ts';

const src = fs.readFileSync(new URL('../lib/debugConfig.ts', import.meta.url), 'utf8');
const BASE = Function(`return (${/export const DBG_ONDAS = (\{[\s\S]*?\n\});/.exec(src)[1].replace(/ as number\[\]/g, '')});`)();
const cfg = (o = {}) => ({ ...structuredClone(BASE), ...o });
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const f = (n, d = 2) => n.toFixed(d);

// corre una señal de energía e(t) a 60 fps sobre la luz 0 (banda 1) y devuelve los tiempos de disparo
const correr = (senal, seg, o = {}) => { limpiarOndas(ONDAS); const c = cfg(o.cfg); const disp = []; const dt = 1 / 60;
  for (let k = 0; k < seg * 60; k++) { const t = k * dt; if (detectar(ONDAS, c, 0, 1, senal(t), o.hab ?? true, t, dt)) disp.push(t); envejecer(ONDAS, c, t); }
  return disp; };

console.log('\ndetector por luz/banda');
// kicks: base 0,15 con golpes de 70 ms a 0,8 cada 0,5 s (después de 1 s de calentamiento de la media)
const kicks = t => (t > 1 && (t % 0.5) < 0.07 ? 0.8 : 0.15);
const d1 = correr(kicks, 5);
console.log(`    disparos: ${d1.map(x => f(x)).join(' ')}`);
check(d1.length === 8 && d1.every((x, i) => Math.abs(x - (1.0 + i * 0.5)) < 0.05), 'dispara en cada ataque (8 golpes en 4 s, ninguno en el arranque)');
const d2 = correr(t => (t > 1 ? 0.8 : 0.15), 4);
check(d2.length === 1, `meseta (sube a 0,8 y se queda): un solo disparo (${d2.length})`);
const d3 = correr(t => (t > 1 && ((t > 1.0 && t < 1.05) || (t > 1.10 && t < 1.15)) ? 0.8 : 0.15), 2);
check(d3.length === 1, `dos golpes a 100 ms: el enfriamiento de 180 ms deja uno (${d3.length})`);
const d3b = correr(t => (t > 1 && ((t > 1.0 && t < 1.05) || (t > 1.25 && t < 1.30)) ? 0.8 : 0.15), 2);
check(d3b.length === 2, `dos golpes a 250 ms: dos ondas (${d3b.length})`);
check(correr(kicks, 5, { hab: false }).length === 0, 'luz apagada o compuerta cerrada (gateOpen): no dispara');
check(correr(kicks, 5, { cfg: { ACTIVO: false } }).length === 0, 'ACTIVO false: no dispara');
check(correr(t => (t > 1 && (t % 0.5) < 0.07 ? 0.06 : 0.01), 5).length === 0, 'energía bajo MIN_ENERGIA (silencio con ruido): no dispara');
check(correr(t => 0.4 + 0.05 * Math.sin(t * 30), 5).length === 0, 'oscilación suave (sin ataques): no dispara');
{ correr(kicks, 1.6, { cfg: { GANANCIA_BANDA: [1, 2, 1, 1] } }); const w = ONDAS.lista.find(x => x.activa);
  check(w && Math.abs(w.fuerza - 1.6) < 1e-9 && w.banda === 1 && w.luz === 0, `fuerza = energía × GANANCIA_BANDA[banda] (0,8 × 2 = ${w && f(w.fuerza)})`); }

console.log('\nlista de ondas');
limpiarOndas(ONDAS); const c = cfg();
for (let i = 0; i < 10; i++) lanzarOnda(ONDAS, c, i % 4, i % 4, 1, i * 0.1);
const activas = ONDAS.lista.filter(w => w.activa);
check(activas.length === MAX_ONDAS && Math.min(...activas.map(w => w.t0)) === 0.2, `10 lanzadas con MAX 8: quedan 8 y se reemplazaron las 2 más viejas (la más vieja ahora t0 = ${Math.min(...activas.map(w => w.t0))})`);
limpiarOndas(ONDAS); const c3 = cfg({ MAX: 3 });
for (let i = 0; i < 5; i++) lanzarOnda(ONDAS, c3, 0, 0, 1, i);
check(ONDAS.lista.filter(w => w.activa).length === 3, 'MAX 3: nunca más de 3');
limpiarOndas(ONDAS); lanzarOnda(ONDAS, c, 2, 2, 1, 10);
envejecer(ONDAS, c, 10 + 3.4); const viva = ONDAS.lista[0].activa; envejecer(ONDAS, c, 10 + 3.6);
check(viva && !ONDAS.lista[0].activa, 'nace, vive DURACION_S (3,5 s) y muere');
check(edad(ONDAS.lista[0], 20) === -1, 'una onda muerta no tiene edad');
lanzarOnda(ONDAS, c, 0, 0, 1, 5); envejecer(ONDAS, cfg({ ACTIVO: false }), 5.1);
check(!ONDAS.lista.some(w => w.activa), 'ACTIVO false las apaga');

console.log('\nperfil de la onda (réplica del shader)');
// mismas cuentas que dome.frag.glsl: R = r0 + edad·vel; x = (ang − R)/ancho; vida; perfil = e^(−x²)·fuerza·vida; desp = amp·perfil·sin(−2,2x)
const r0 = 0.848 * Math.atan(Math.tan(28 * Math.PI / 180) * 1.625), vel = BASE.VELOCIDAD_DEG_S * Math.PI / 180, ancho = BASE.ANCHO_DEG * Math.PI / 180;
const ss = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const onda = (ang, e) => { const R = r0 + e * vel, x = (ang - R) / ancho, vida = (1 - ss(0.6 * BASE.DURACION_S, BASE.DURACION_S, e)) / (1 + 1.5 * (R - r0));
  const p = Math.exp(-x * x) * vida; return { R, desp: BASE.AMPLITUD * p * Math.sin(-x * 2.2), cresta: p }; };
const R05 = onda(0, 0.5).R;
const delante = onda(R05 + 0.5 * ancho, 0.5).desp, detras = onda(R05 - 0.5 * ancho, 0.5).desp;
check(delante < 0 && detras > 0, `al pasar empuja y después devuelve: desplazamiento ${f(delante, 3)} delante de la cresta y ${f(detras, 3)} detrás (cresta y valle)`);
check(Math.abs(onda(0, 0).R - r0) < 1e-12, `nace en el borde del portal (${f(r0 * 180 / Math.PI, 1)}° del centro, con ESCALA 1,625)`);
const pico = e => onda(onda(0, e).R, e).cresta;
console.log(`    cresta a 0,5 s: ${f(pico(0.5), 3)} (radio ${f(onda(0, 0.5).R * 180 / Math.PI, 1)}°) · 1,5 s: ${f(pico(1.5), 3)} (${f(onda(0, 1.5).R * 180 / Math.PI, 1)}°) · 2,5 s: ${f(pico(2.5), 3)} (${f(onda(0, 2.5).R * 180 / Math.PI, 1)}°) · 3,5 s: ${f(pico(3.5), 3)}`);
check(pico(0.5) > pico(1.5) && pico(1.5) > pico(2.5) && pico(3.5) === 0, 'se atenúa con la distancia y la edad, y a los 3,5 s desaparece');
check(Math.abs(onda(r0 * 0.5, 0.3).desp) < 1e-3, 'dentro del portal casi no hay desplazamiento (y el shader además lo multiplica por 1 − inside)');

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
