// Z78: prueba de la lógica pura del núcleo de audio: reloj (programador con tiempo simulado, suscripciones, pausa,
// cortes), parámetros 1…10 (lineal, exponencial, inversa, suavizado), limitador (identidad bajo el umbral con la
// interpolación del WaveShaper) y ruido (blanco y rosa). Uso: node scripts/audio-nucleo-test.mjs
import fs from 'node:fs';
import v8 from 'node:v8';
import vm from 'node:vm';
import {
  crearReloj, setBpm, iniciar, detener, pausar, reanudar, suscribir, programar, acotarBpm, BPM_MIN, BPM_MAX,
} from '../lib/audio/reloj.ts';
import { aReal, deReal, normalizar, crearRegistro, registrar, obtener, listar, fijar, vincular, quitar, PARAMETROS } from '../lib/audio/parametros.ts';
import { curvaLimitador, aplicarCurva, limitarMuestra, N_CURVA } from '../lib/audio/limitador.ts';
import { rngRuido, llenarBlanco, llenarRosa } from '../lib/audio/ruido.ts';

const src = fs.readFileSync(new URL('../lib/debugConfig.ts', import.meta.url), 'utf8');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string/g, '')});`)();
const N = obj('DBG_AUDIO_NUCLEO');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const cerca = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

// ── simulación: el temporizador despierta cada `int` s (con jitter) y el reloj de audio avanza en tiempo real ──
function simular(r, segundos, { int = 0.025, jitter = 0, anticipo = N.ANTICIPO_S, t0 = 0, alTick } = {}) {
  let t = t0, k = 0;
  while (t < t0 + segundos) {
    programar(r, t, anticipo);
    alTick?.(t, k++);
    t += int + (jitter ? (Math.sin(k * 12.9898) * 0.5 + 0.5) * jitter : 0);
  }
  return t;
}

console.log('\nconfiguración DBG_AUDIO_NUCLEO');
check(N.ACTIVO === true && N.SILLAS_EN_NUCLEO === false, 'ACTIVO true por defecto, SILLAS_EN_NUCLEO false (sin implementar)');
check(N.GANANCIA_MAESTRA === 1, 'GANANCIA_MAESTRA 1 = misma salida que antes');
check(N.METRONOMO === false && N.RUIDO === false && N.OVERLAY_NIVEL === false, 'metrónomo, ruido y overlay apagados por defecto');

console.log('\nreloj: tiempos exactos a 60, 120 y 180 BPM');
for (const bpm of [60, 120, 180]) {
  const r = crearReloj(bpm, 16, 4);
  const tiempos = [], pasos = [];
  suscribir(r, (p, t) => { tiempos.push(t); pasos.push(p); });
  iniciar(r, 0, 0.05);
  simular(r, 10, { jitter: 0.02 });
  const d = 60 / bpm / 4;
  let maxErr = 0;
  for (let i = 0; i < tiempos.length; i++) maxErr = Math.max(maxErr, Math.abs(tiempos[i] - (0.05 + i * d)));
  const esperados = Math.floor((10 + N.ANTICIPO_S - 0.05) / d);
  check(maxErr < 1e-9, `${bpm} BPM: ${tiempos.length} pasos, error máx ${maxErr.toExponential(1)} s respecto de la grilla (jitter del temporizador 0…20 ms)`);
  check(Math.abs(tiempos.length - esperados) <= 1, `${bpm} BPM: cantidad de pasos ≈ ${esperados}`);
  check(pasos[16] === 0 && pasos[15] === 15 && r.cortes === 0, `${bpm} BPM: 16 pasos por compás, sin cortes`);
}

console.log('\nreloj: anticipo (nunca programa en el pasado ni más allá del lookahead)');
{
  let tickT = 0, mal = 0;
  const r = crearReloj(120);
  suscribir(r, (_p, t) => { if (t < tickT - 0.02 - 1e-9 || t >= tickT + N.ANTICIPO_S) mal++; });
  iniciar(r, 0);
  for (let t = 0; t < 5; t += 0.025) { tickT = t; programar(r, t, N.ANTICIPO_S); }
  check(mal === 0 && r.pasosEmitidos >= 40, `cada paso cae en [ahora, ahora + ${N.ANTICIPO_S} s) del tick que lo programa`);
}

console.log('\nreloj: setBpm, detener y límites');
{
  const r = crearReloj(120); const t = [];
  suscribir(r, (_p, tt) => t.push(tt));
  iniciar(r, 0, 0);
  for (let x = 0; x < 1; x += 0.025) programar(r, x, 0.1);
  const n1 = t.length; setBpm(r, 60);
  for (let x = 1; x < 2; x += 0.025) programar(r, x, 0.1);
  const dAntes = t[n1 - 1] - t[n1 - 2], dDespues = t[t.length - 1] - t[t.length - 2];
  check(cerca(dAntes, 0.125) && cerca(dDespues, 0.25), `setBpm 120 → 60: paso 125 ms → 250 ms (vale desde el próximo paso)`);
  detener(r); const n2 = t.length;
  check(programar(r, 3, 0.1) === 0 && t.length === n2 && r.estado === 'detenido', 'detenido: no emite');
  check(acotarBpm(5) === BPM_MIN && acotarBpm(999) === BPM_MAX && acotarBpm(NaN) === 120, `BPM acotado a ${BPM_MIN}…${BPM_MAX}`);
}

console.log('\nreloj: suscripciones');
{
  const r = crearReloj(120); let a = 0, b = 0;
  const qa = suscribir(r, () => a++);
  const qb = suscribir(r, () => b++);
  suscribir(r, () => a > 0 && 0);
  iniciar(r, 0, 0);
  programar(r, 0, 0.3);
  check(a === b && a === 3, `dos oyentes reciben los mismos pasos (${a}, ${b})`);
  qa(); programar(r, 0.3, 0.3);
  check(a === 3 && b > 3, 'desuscribir corta los pasos a ese oyente');
  qb(); qb();
  check(r.oyentes.length === 1, 'desuscribir dos veces no rompe');
  // un oyente que se desuscribe a sí mismo durante el paso
  const r2 = crearReloj(120); let c = 0, d = 0;
  const q = suscribir(r2, () => { c++; q(); });
  suscribir(r2, () => d++);
  iniciar(r2, 0, 0); programar(r2, 0, 0.5);
  check(c === 1 && d === 4, 'un oyente puede desuscribirse a sí mismo dentro del paso');
  check(suscribir(r2, () => {}) && r2.oyentes.length === 2, 'suscribir devuelve la función de baja');
}

console.log('\nreloj: pausa central');
{
  const r = crearReloj(120); const t = [];
  suscribir(r, (_p, tt) => t.push(tt));
  iniciar(r, 0, 0);
  for (let x = 0; x < 1.01; x += 0.025) programar(r, x, 0.1);
  const n1 = t.length, sig = r.siguienteT;
  pausar(r, 1.01);
  for (let x = 1.01; x < 6; x += 0.025) programar(r, x, 0.1);
  check(t.length === n1 && r.estado === 'pausado', `en pausa (1,01 s → 6 s) no emite ningún paso (${n1} antes)`);
  const resto = sig - 1.01;
  reanudar(r, 6);
  for (let x = 6; x < 7; x += 0.025) programar(r, x, 0.1);
  check(cerca(t[n1] - 6, resto, 1e-9), `al reanudar, el próximo paso cae a ${(resto * 1000).toFixed(0)} ms (lo que faltaba al pausar)`);
  check(cerca(t[n1 + 1] - t[n1], 0.125) && r.cortes === 0, 'retoma la grilla sin saltear ni repetir pasos, sin cortes');
  pausar(r, 7); pausar(r, 7.5); reanudar(r, 8); reanudar(r, 9);
  check(r.estado === 'corriendo', 'pausar o reanudar dos veces es inocuo');
  const r3 = crearReloj(120); reanudar(r3, 1);
  check(r3.estado === 'detenido', 'reanudar un reloj detenido no lo arranca');
}

console.log('\nreloj: cortes (pestaña en segundo plano: el temporizador despierta 1 vez por segundo)');
{
  const r = crearReloj(120); const t = [];
  suscribir(r, (_p, tt) => t.push(tt));
  iniciar(r, 0, 0);
  for (let x = 0; x < 1; x += 0.025) programar(r, x, 0.1);
  programar(r, 2.5, 0.1);
  const tarde = t.filter(v => v < 2.5 - 0.02).length;
  check(r.cortes > 0, `los pasos vencidos se cuentan como cortes (${r.cortes})`);
  check(t.every((v, i) => i === 0 || v > t[i - 1]) && t[t.length - 1] >= 2.48, 'no se emiten pasos tarde: la grilla sigue desde el presente');
  check(tarde === t.filter(v => v < 1.1).length, 'ningún paso emitido después de vencido');
}

console.log('\nreloj: sin memoria retenida por paso');
{
  v8.setFlagsFromString('--expose-gc');
  const gc = vm.runInNewContext('gc');
  const r = crearReloj(180); const cuenta = { n: 0 };
  suscribir(r, () => { cuenta.n++; });
  iniciar(r, 0, 0);
  for (let x = 0; x < 600; x += 0.025) programar(r, x, 0.1);    // calentamiento (JIT)
  gc(); gc(); const antes = process.memoryUsage().heapUsed, n0 = r.pasosEmitidos;
  for (let x = 600; x < 6600; x += 0.025) programar(r, x, 0.1); // 100 min a 180 BPM = 72000 pasos
  gc(); gc(); const dif = process.memoryUsage().heapUsed - antes;
  check(r.pasosEmitidos - n0 > 71000 && dif < 256 * 1024 && cuenta.n === r.pasosEmitidos, `${r.pasosEmitidos - n0} pasos (con 8 bytes por paso serían 560 KB): heap retenido ${(dif / 1024).toFixed(1)} KB (el reloj no guarda nada por paso)`);
}

console.log('\nparámetros 1…10');
{
  const lin = { id: 'x.lin', nombre: 'LIN', min: 0, max: 100, curva: 'lin', defecto: 5.5 };
  const exp = { id: 'x.exp', nombre: 'CORTE', min: 40, max: 12000, curva: 'exp', defecto: 1 };
  check(aReal(1, lin) === 0 && aReal(10, lin) === 100 && cerca(aReal(5.5, lin), 50), 'lineal: 1 → min, 10 → max, 5,5 → medio');
  check(cerca(aReal(1, exp), 40) && cerca(aReal(10, exp), 12000, 1e-6), 'exponencial: 1 → 40 Hz, 10 → 12 kHz');
  check(cerca(aReal(5.5, exp), Math.sqrt(40 * 12000), 1e-6), `exponencial: 5,5 → media geométrica (${aReal(5.5, exp).toFixed(1)} Hz)`);
  check(cerca(aReal(2, exp) / aReal(1, exp), aReal(10, exp) / aReal(9, exp), 1e-9), 'exponencial: cada paso multiplica por lo mismo');
  check(aReal(0, lin) === 0 && aReal(15, lin) === 100 && aReal(NaN, lin) === 0 && normalizar(-3) === 0, 'fuera de rango y NaN se acotan');
  let inv = 0;
  for (let v = 1; v <= 10; v += 0.37) inv = Math.max(inv, Math.abs(deReal(aReal(v, exp), exp) - v), Math.abs(deReal(aReal(v, lin), lin) - v));
  check(inv < 1e-9, 'deReal es la inversa de aReal (lineal y exponencial)');
  const expMal = { ...exp, min: 0 };
  check(aReal(10, expMal) === 12000 && cerca(aReal(5.5, expMal), 6000), 'exponencial con min ≤ 0 cae a lineal');

  const reg = crearRegistro();
  const p = registrar(reg, exp); registrar(reg, lin);
  check(p.valor === 1 && cerca(p.real, 40), 'registrar usa el defecto');
  check(registrar(reg, { ...exp, defecto: 9 }) === p && listar(reg).length === 2, 'registrar el mismo id devuelve el existente');
  check(listar(reg).map(q => q.def.nombre).join(',') === 'CORTE,LIN' && obtener(reg, 'x.lin')?.def.nombre === 'LIN', 'listar en orden y obtener por id');
  const llamadas = [];
  const destino = { setTargetAtTime: (v, t, tau) => llamadas.push([v, t, tau]) };
  const des = vincular(reg, 'x.exp', destino, 0);
  check(llamadas.length === 1 && cerca(llamadas[0][0], 40), 'vincular aplica el valor actual enseguida');
  const real = fijar(reg, 'x.exp', 10, 1.5);
  check(cerca(real, 12000, 1e-6) && cerca(llamadas[1][0], 12000, 1e-6) && llamadas[1][1] === 1.5 && llamadas[1][2] === 0.05, 'fijar aplica con setTargetAtTime (tiempo de audio, τ 0,05 s por defecto)');
  registrar(reg, { id: 'x.lento', nombre: 'L', min: 0, max: 1, curva: 'lin', defecto: 1, tauS: 0.3 });
  vincular(reg, 'x.lento', destino, 0); fijar(reg, 'x.lento', 10, 2);
  check(llamadas[llamadas.length - 1][2] === 0.3, 'tauS propio del parámetro');
  des(); fijar(reg, 'x.exp', 5, 3);
  check(!llamadas.some(c => c[1] === 3), 'desvincular corta las actualizaciones');
  check(fijar(reg, 'no.existe', 5, 0) === null, 'id inexistente: null');
  quitar(reg, 'x.lin');
  check(listar(reg).length === 2 && obtener(reg, 'x.lin') === null, 'quitar');
  check(listar(PARAMETROS).length === 0, 'el registro central arranca vacío (sin instrumentos todavía)');
}

console.log('\nlimitador suave (curva del WaveShaper)');
{
  const c = curvaLimitador(N.LIMITADOR_UMBRAL);
  check(c.length === N_CURVA && N_CURVA % 2 === 1, `curva de ${N_CURVA} puntos (impar: el 0 cae en un punto)`);
  let err = 0;
  for (let i = 0; i <= 200000; i++) { const x = -N.LIMITADOR_UMBRAL + (2 * N.LIMITADOR_UMBRAL * i) / 200000; err = Math.max(err, Math.abs(aplicarCurva(c, Math.fround(x)) - Math.fround(x))); }
  check(err < 1e-6, `identidad bajo el umbral ${N.LIMITADOR_UMBRAL}: error máx ${err.toExponential(1)} (float32) → la tarima suena igual`);
  check(aplicarCurva(c, 0) === 0, 'el silencio sigue en 0 exacto');
  const techo = aplicarCurva(c, 1);
  check(techo < 1 && techo > 0.97 && aplicarCurva(c, 3) === techo && aplicarCurva(c, -3) === -techo, `por encima del umbral satura suave hasta ±${techo.toFixed(3)} (antes: recorte duro en ±1)`);
  let mono = true;
  for (let i = 1; i < c.length; i++) if (c[i] < c[i - 1]) mono = false;
  check(mono, 'curva monótona (sin inversiones)');
  check(limitarMuestra(0.95, 0.9) < 0.95 && limitarMuestra(0.95, 0.9) > 0.9, 'rodilla: 0,95 → entre 0,9 y 0,95');
}

console.log('\nruido procedural');
{
  const n = 48000 * 2, b = new Float32Array(n), p = new Float32Array(n);
  llenarBlanco(b, rngRuido(1)); llenarRosa(p, rngRuido(1));
  const pico = a => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  const media = a => a.reduce((s, v) => s + v, 0) / a.length;
  const potDif = a => { let s = 0, q = 0; for (let i = 1; i < a.length; i++) { const d = a[i] - a[i - 1]; s += d * d; q += a[i] * a[i]; } return s / q; };
  check(cerca(pico(b), 0.9, 1e-6) && cerca(pico(p), 0.9, 1e-6), 'blanco y rosa normalizados a pico 0,9');
  check(Math.abs(media(b)) < 0.01 && Math.abs(media(p)) < 0.05, 'sin componente continua');
  const rb = potDif(b), rp = potDif(p);
  check(rb > 1.8 && rb < 2.2, `blanco: energía de la diferencia / energía ≈ 2 (${rb.toFixed(2)}): espectro plano`);
  check(rp < 0.5, `rosa: ${rp.toFixed(3)} (mucho menos agudos que el blanco)`);
  const b2 = new Float32Array(n); llenarBlanco(b2, rngRuido(1));
  check(b2.every((v, i) => v === b[i]), 'misma semilla, mismo ruido (determinista)');
}

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
