// Z84: prueba del tiempo detenido (lib/tiempoDetenido.ts) con los monolitos de Z82 (lib/monolitosVivo.ts) y tiempo
// simulado: disparo solo sin sesión, proporcional al acercamiento, duración, corte por sesión, cancelación al volver a
// "cerca", pausa, mapeo de la tasa; y que con k = 0 el pase final no cambie. Uso: node scripts/tiempo-detenido-test.mjs
import fs from 'node:fs';
import { crearTiempo, tickTiempo, dispararManual, pararTiempo, tasaAudio, kVisual } from '../lib/tiempoDetenido.ts';
import { crearMono, tickPar } from '../lib/monolitosVivo.ts';

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const src = leer('../lib/debugConfig.ts');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string \| number/g, '').replace(/ as string/g, '')});`)();
const T = obj('DBG_TIEMPO'), M = obj('DBG_MONO_VIVO');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const cerca = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const DT = 1 / 60;

// escena: monolitos en x = +6 (sonido) y −6 (video); el usuario camina
function escena(cfg = T) {
  const s = crearMono(), v = crearMono(), st = crearTiempo(), u = [0, 8];
  const e = { s, v, st, u, t: 0, sesion: false, disparos: [] };
  e.paso = (dt = DT) => {
    const dS = Math.hypot(u[0] - 6, u[1]), dV = Math.hypot(u[0] + 6, u[1]);
    tickPar(s, v, dS, dV, dt, M);
    if (tickTiempo(st, s, v, e.sesion, dt, cfg)) { e.disparos.push(e.t); e.kDisparo = st.k; }
    e.t += dt;
  };
  e.ir = (x, z, vel = 1.4) => { for (let k = 0; k < 60 * 60; k++) { const dx = x - u[0], dz = z - u[1], l = Math.hypot(dx, dz); if (l < 0.02) break; const p = Math.min(l, vel * DT); u[0] += dx / l * p; u[1] += dz / l * p; e.paso(); } };
  e.esperar = seg => { for (let k = 0; k < Math.round(seg / DT); k++) e.paso(); };
  e.paso();
  return e;
}

console.log('\nconfiguración');
check(T.ACTIVO && T.DURACION_S === 6 && T.CORTE_S === 1 && T.RATE_MIN === 0.5, 'ACTIVO, DURACION_S 6 (= RETORNO_S), CORTE_S 1, RATE_MIN 0,5');

console.log('\ndisparo solo al alejarse y solo sin sesión');
{
  const e = escena();
  e.ir(5.5, 0);
  check(e.st.k === 0 && e.disparos.length === 0, 'acercarse no lo dispara (k = 0)');
  e.ir(4, 3);
  check(e.disparos.length === 1 && e.st.fuente === 'sonido', 'al alejarse del monolito de sonido se dispara una vez');
  check(e.kDisparo === 1, `k sube de golpe al pico (${e.kDisparo}): llegó a "cerca", peso máximo 1`);
}
{
  const e = escena(); e.sesion = true;
  e.ir(5.5, 0); e.ir(4, 3);
  check(e.disparos.length === 0 && e.st.k === 0, 'con sesión no se dispara');
  e.sesion = false; e.ir(-5.5, 0); e.ir(-4, 3);
  check(e.disparos.length === 1 && e.st.fuente === 'video', 'sin sesión (o cuando la conexión cae) se dispara también con el de video');
}

console.log('\nduración, ataque y corte');
{
  const e = escena();
  e.ir(5.5, 0); e.ir(4.9, 0.6, 3);
  const t0 = e.disparos[0];
  const k0 = e.st.k;
  e.esperar(T.DURACION_S / 2 - (e.t - t0));
  check(cerca(e.st.k, k0 - 0.5 * (e.t - t0) / (T.DURACION_S / 2) * 0.5 * 2, 0.06), `baja lineal: a la mitad de DURACION_S k ≈ ${e.st.k.toFixed(2)}`);
  e.esperar(T.DURACION_S / 2 + 0.1);
  check(e.st.k === 0 && e.st.fuente === '', `a los ${T.DURACION_S} s vuelve a 0`);
}
{
  const st = crearTiempo(); const m = { estado: 'lejos', peso: 0, alejandoseTrasCerca: false };
  dispararManual(st);
  check(st.k === 1 && st.kSuave === 0, 'k salta a 1; el aplicado arranca en 0');
  for (let i = 0; i < Math.round(T.ATAQUE_S / DT) - 1; i++) tickTiempo(st, m, m, false, DT, T);
  check(st.kSuave > 0.85 && st.kSuave < 1, `la cinta se frena en ATAQUE_S (${T.ATAQUE_S} s), sin salto de tono (${st.kSuave.toFixed(2)})`);
  let maxSalto = 0, prev = tasaAudio(0, T);
  const st2 = crearTiempo(); dispararManual(st2);
  for (let i = 0; i < 60 * 8; i++) { tickTiempo(st2, m, m, false, DT, T); const r = tasaAudio(st2.kSuave, T); maxSalto = Math.max(maxSalto, Math.abs(r - prev)); prev = r; }
  check(maxSalto < 0.03, `velocidad sin saltos: cambio máximo por cuadro ${maxSalto.toFixed(4)} (sin clics)`);
}
{
  const e = escena();
  e.ir(5.5, 0); e.ir(4.9, 0.6, 3);
  e.esperar(1);
  e.sesion = true;
  const k1 = e.st.k; e.esperar(T.CORTE_S * k1 + 0.05);
  check(e.st.k === 0, `si aparece una sesión, se corta en CORTE_S × k (${(T.CORTE_S * k1).toFixed(2)} s)`);
}
{
  const e = escena();
  e.ir(5.5, 0); e.ir(4.9, 0.6, 3); e.esperar(0.5);
  check(e.st.k > 0.5, 'efecto en curso');
  e.ir(5.5, 0);
  const tC = e.t; e.esperar(T.CORTE_S + 0.05);
  check(e.st.k === 0, 'volver a "cerca" del monolito que lo disparó lo corta (es un efecto de salida)');
  e.ir(4, 3);
  check(e.disparos.length === 2 && e.kDisparo === 1, 'y al volver a alejarse se dispara de nuevo');
  void tC;
}

console.log('\nproporcional al acercamiento (DISPARO_PARCIAL)');
{
  const e = escena({ ...T, DISPARO_PARCIAL: true });
  e.ir(6 - 2.0, 0.0);              // acercamiento parcial: peso ≈ pesoDistancia(2) < 1
  const max = e.s.peso;
  e.ir(6 - 2.8, 0.0);              // se aleja sin llegar a cerca
  check(e.disparos.length === 1 && e.st.k > 0 && e.st.k <= max + 1e-9 && e.st.k < 1, `alejarse sin llegar a cerca: k = acercamiento máximo (${e.st.k.toFixed(2)} ≤ ${max.toFixed(2)})`);
  const e2 = escena();
  e2.ir(6 - 2.0, 0); e2.ir(6 - 2.8, 0);
  check(e2.disparos.length === 0, 'por defecto (DISPARO_PARCIAL off) solo dispara tras haber estado cerca');
}

console.log('\npausa central y manual');
{
  const st = crearTiempo(); const m = { estado: 'lejos', peso: 0, alejandoseTrasCerca: false };
  dispararManual(st); for (let i = 0; i < 30; i++) tickTiempo(st, m, m, false, DT, T);
  const k = st.k, ks = st.kSuave;
  for (let i = 0; i < 600; i++) tickTiempo(st, m, m, false, 0, T);
  check(st.k === k && st.kSuave === ks, 'con dt = 0 (pausa central) queda congelado');
  pararTiempo(st);
  check(st.k === 0 && st.kSuave === 0, '"Parar" lo apaga');
  const st3 = crearTiempo(); dispararManual(st3); tickTiempo(st3, m, m, false, DT, { ...T, ACTIVO: false });
  check(st3.k === 0, 'ACTIVO = false: sin efecto');
}

console.log('\nmapeo de la tasa y del shader');
check(tasaAudio(0, T) === 1, 'k = 0: velocidad 1 (el mp3 suena como siempre)');
check(cerca(tasaAudio(1, T), 0.5), 'k = 1: velocidad RATE_MIN (0,5): una octava abajo');
check(cerca(tasaAudio(0.5, T), 0.75), 'k = 0,5: 0,75');
check(cerca(tasaAudio(1, { ...T, INTENSIDAD_AUDIO: 0.5 }), 0.75) && tasaAudio(1, { ...T, INTENSIDAD_AUDIO: 0 }) === 1, 'INTENSIDAD_AUDIO escala el efecto');
check(kVisual(0.5, { ...T, INTENSIDAD_VISUAL: 2 }) === 1 && kVisual(0, T) === 0, 'INTENSIDAD_VISUAL multiplica k para el shader');

console.log('\nsolo el audio propio y la cámara propia; k = 0 sin cambios');
{
  const viz = leer('../lib/vizAudio.ts');
  const fn = viz.slice(viz.indexOf('export function setTasaTiempo'));
  check(/_vizAudioEl\.playbackRate/.test(fn) && !/_remotoGain|_estatica|_nodoRemoto/.test(fn.slice(0, fn.indexOf('export function tasaTiempoActual'))), 'setTasaTiempo solo toca el <audio> propio (no la sesión remota ni la estática de Z82)');
  check(/_vizAudioEl\.playbackRate = Math\.max\(0\.25, Math\.min\(4, _rateCur \* _rateTiempo\)\);/.test(viz), 'applyEffects multiplica por el factor del tiempo detenido (no lo pisa)');
  const pf = leer('../lib/retro/paseFinal.ts');
  check(/if \(uTiempoK > 0\.0( && uTiempoSlit < 0\.5)?\) c\.rgb = efectoTiempoDetenido\(vUv, c\.rgb, uTiempoK, uTiempoT\);/.test(pf), 'pase final: rama por uniform (sin pase extra); con k = 0 no se ejecuta y la imagen es idéntica');
  const glsl = leer('../lib/retro/tiempoDetenido.ts');
  check(/vec3 efectoTiempoDetenido\(vec2 uv, vec3 color, float k, float tiempo\)/.test(glsl) && /firma/.test(glsl), 'función de enganche con la firma documentada para el shader del usuario');
}

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
