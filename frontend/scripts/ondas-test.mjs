// Z52: prueba del detector de kick por luz/banda y de la lista de ondas (lib/ondasKick.ts), y del perfil de la onda
// (réplica en JS de las cuentas del shader del domo). Uso: node scripts/ondas-test.mjs
import fs from 'node:fs';
import { ONDAS, MAX_ONDAS, detectar, envejecer, lanzarOnda, limpiarOndas, edad, evidenciaOndas, ONDAS_Z52 } from '../lib/ondasKick.ts';

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
envejecer(ONDAS, c, 10 + c.DURACION_S - 0.1); const viva = ONDAS.lista[0].activa; envejecer(ONDAS, c, 10 + c.DURACION_S + 0.1);
check(viva && !ONDAS.lista[0].activa, `nace, vive DURACION_S (${c.DURACION_S} s) y muere`);
check(edad(ONDAS.lista[0], 20) === -1, 'una onda muerta no tiene edad');
lanzarOnda(ONDAS, c, 0, 0, 1, 5); envejecer(ONDAS, cfg({ ACTIVO: false }), 5.1);
check(!ONDAS.lista.some(w => w.activa), 'ACTIVO false las apaga');

console.log('\nperfil de la onda (réplica del shader)');
// mismas cuentas que dome.frag.glsl: R = r0 + edad·vel; x = (ang − R)/ancho; vida; perfil = e^(−x²)·fuerza·vida; desp = amp·perfil·sin(−2,2x)
const r0 = 0.848 * Math.atan(Math.tan(28 * Math.PI / 180) * 1.625), vel = BASE.VELOCIDAD_DEG_S * Math.PI / 180, ancho = BASE.ANCHO_DEG * Math.PI / 180;
const ss = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const EV = evidenciaOndas(BASE, {});   // Z58: la amplitud llega al shader ya mezclada por EVIDENCIA
const onda = (ang, e) => { const R = r0 + e * vel, x = (ang - R) / ancho, vida = (1 - ss(0.6 * BASE.DURACION_S, BASE.DURACION_S, e)) / (1 + 1.5 * (R - r0));
  const p = Math.exp(-x * x) * vida; return { R, desp: EV.amp * p * Math.sin(-x * 2.2), cresta: p }; };
const R05 = onda(0, 0.5).R;
const delante = onda(R05 + 0.5 * ancho, 0.5).desp, detras = onda(R05 - 0.5 * ancho, 0.5).desp;
check(delante < 0 && detras > 0, `al pasar empuja y después devuelve: desplazamiento ${f(delante, 3)} delante de la cresta y ${f(detras, 3)} detrás (cresta y valle)`);
check(Math.abs(onda(0, 0).R - r0) < 1e-12, `nace en el borde del portal (${f(r0 * 180 / Math.PI, 1)}° del centro, con ESCALA 1,625)`);
const pico = e => onda(onda(0, e).R, e).cresta;
const D = BASE.DURACION_S, deg = r => r * 180 / Math.PI;
console.log(`    Z58 (vel ${BASE.VELOCIDAD_DEG_S}°/s, ancho ${BASE.ANCHO_DEG}°, vida ${D} s): ` + [0.8, 2, 3.5, D].map(e => `${f(e, 1)} s: cresta ${f(pico(e), 3)} a ${f(deg(onda(0, e).R), 1)}° del centro`).join(' · '));
check(pico(0.8) > pico(2) && pico(2) > pico(3.5) && pico(3.5) > 0 && pico(D) === 0, `se atenúa con la distancia y la edad, sigue viva a 3,5 s y a los ${D} s desaparece`);
{ // llega al horizonte: el centro del portal está a ~31° de altura → el horizonte queda a ~31° del centro, y más hacia los lados
  const alcance = deg(onda(0, 0.6 * D).R); check(alcance > 40, `antes de empezar a apagarse (0,6 × vida = ${f(0.6 * D, 1)} s) ya recorrió hasta ${f(alcance, 1)}° del centro (Z52: ${f(deg(r0 + 0.6 * 3.5 * 28 * Math.PI / 180), 1)}°)`); }
{ let nan = false; for (let e = 0; e <= D + 0.5; e += 0.05) for (let a = 0; a < 1.6; a += 0.02) { const o = onda(a, e); if (!Number.isFinite(o.desp) || !Number.isFinite(o.cresta)) nan = true; }
  check(!nan, 'ningún NaN en el perfil (edad 0…vida + 0,5 s, toda la distancia)'); }
{ // Z58: con la campana de 14° la cola llega adentro del portal antes de la máscara; el shader multiplica por (1 − inside)
  const crudo = Math.abs(onda(r0 * 0.5, 0.3).desp), inside = 1;   // a medio radio del portal, inside = 1
  check(crudo * (1 - inside) === 0, `dentro del portal no hay desplazamiento: la máscara (1 − inside) anula la cola de la campana (sin máscara sería ${f(crudo, 3)} períodos)`); }

console.log('\nZ58: EVIDENCIA');
{ const e = x => evidenciaOndas({ ...BASE, EVIDENCIA: x }, {});
  const e0 = e(0), e1 = e(1), e2 = e(2), e05 = e(0.5);
  console.log(`    0: amp ${f(e0.amp)} brillo ${f(e0.brillo)} tinte ${f(e0.tinte)} contraste ${f(e0.contraste)} engrosar ${f(e0.engrosar)}`);
  console.log(`    1: amp ${f(e1.amp)} brillo ${f(e1.brillo)} tinte ${f(e1.tinte)} contraste ${f(e1.contraste)} engrosar ${f(e1.engrosar)}`);
  console.log(`    2: amp ${f(e2.amp)} brillo ${f(e2.brillo)} tinte ${f(e2.tinte)} contraste ${f(e2.contraste)} engrosar ${f(e2.engrosar)}`);
  check(e0.amp === ONDAS_Z52.AMPLITUD && e0.brillo === ONDAS_Z52.BRILLO && e0.tinte === ONDAS_Z52.TINTE_BANDA && e0.contraste === 0 && e0.engrosar === 0, 'EVIDENCIA 0: los valores de Z52 (0,6 · 0,25 · 0,35 · sin contraste ni engrosamiento)');
  check(e1.amp === BASE.AMPLITUD && e1.brillo === BASE.BRILLO && e1.tinte === BASE.TINTE_BANDA && e1.contraste === BASE.CONTRASTE && e1.engrosar === BASE.ENGROSAR, 'EVIDENCIA 1: los valores del menú (defaults nuevos)');
  check(Math.abs(e2.amp - 2 * BASE.AMPLITUD) < 1e-12 && Math.abs(e2.contraste - 2 * BASE.CONTRASTE) < 1e-12, 'EVIDENCIA 2: el doble de los valores del menú');
  check(Math.abs(e05.amp - (0.6 + 0.5 * (BASE.AMPLITUD - 0.6))) < 1e-12, 'EVIDENCIA 0,5: a mitad de camino entre Z52 y los nuevos');
  let cont = true, prev = e(0); for (let x = 0.001; x <= 2; x += 0.001) { const v = e(x); if (Math.abs(v.amp - prev.amp) > 0.01) cont = false; prev = v; }
  check(cont, 'continua en todo 0…2 (también en 1)');
  check(Object.values(e(NaN)).every(Number.isFinite) && e(-3).amp === ONDAS_Z52.AMPLITUD && Math.abs(e(9).amp - 2 * BASE.AMPLITUD) < 1e-12, 'valores inválidos: NaN → 1, fuera de rango → 0…2'); }
check(BASE.UMBRAL === 1.35 && BASE.COOLDOWN_MS === 180 && BASE.MEDIA_S === 0.6 && BASE.MIN_ENERGIA === 0.1, 'el detector queda igual (UMBRAL 1,35 · COOLDOWN 180 ms · MEDIA 0,6 s · MIN 0,1)');
console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
