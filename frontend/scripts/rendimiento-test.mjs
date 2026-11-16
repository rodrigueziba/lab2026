// Z66: prueba de lib/rendimiento.ts: percentiles, resumen de frames, resolución adaptativa (escalones, histéresis,
// sin oscilación, quieta en estados bloqueados) y secuenciador del benchmark. Uso: node scripts/rendimiento-test.mjs
import fs from 'node:fs';
import { crearEstadFrame, agregarFrame, resumir, crearResumen, percentilOrdenado, escalonesPara, crearEstadoDpr, dprActual, tickDpr,
  reescalonar, crearEstadoBench, pasosBench, iniciarBench, tickBench, cancelarBench, reporteBench, SISTEMAS, duracionBenchS } from '../lib/rendimiento.ts';
const src = fs.readFileSync(new URL('../lib/debugConfig.ts', import.meta.url), 'utf8');
const C = Function(`return (${/export const DBG_RENDIMIENTO = (\{[\s\S]*?\n\});/.exec(src)[1].replace(/ as Record<string, boolean>/g, '')});`)();
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const f = (n, d = 2) => n.toFixed(d);

console.log('\npercentiles y resumen');
{ const a = Float64Array.from({ length: 100 }, (_, i) => i + 1);
  check(percentilOrdenado(a, 100, 95) === 95 && percentilOrdenado(a, 100, 99) === 99 && percentilOrdenado(a, 100, 50) === 50, 'p50/p95/p99 de 1…100 = 50/95/99 (rango más cercano)');
  check(percentilOrdenado(a, 0, 95) === 0 && percentilOrdenado(a, 1, 99) === 1, 'sin muestras → 0; una sola → esa'); }
{ const e = crearEstadFrame(), r = crearResumen(); let t = 0;
  for (let i = 0; i < 600; i++) { const ms = i % 10 === 0 ? 50 : 10; t += ms / 1000; agregarFrame(e, ms, t); }
  resumir(e, t, 5, r);
  console.log(`    10 ms con un tirón de 50 ms cada 10 cuadros (5 s): media ${f(r.media)} · p95 ${f(r.p95)} · p99 ${f(r.p99)} · FPS ${f(r.fps, 1)}`);
  check(Math.abs(r.media - 14) < 0.3 && r.p95 === 50 && r.p99 === 50 && r.n < 600, 'ventana de 5 s, media 14 ms, los tirones aparecen en p95/p99');
  const r2 = resumir(e, t + 10, 5, crearResumen()); check(r2.n === 0 && r2.media === 0, 'sin cuadros recientes: vacío');
  for (let i = 0; i < 5000; i++) agregarFrame(e, 5, t + i * 0.005); check(e.n === 2048, 'anillo acotado (2048 muestras, sin crecer)'); }

console.log('\nescalones');
check(JSON.stringify(escalonesPara(C, 2)) === '[1.5,1.25,1,0.85,0.7,0.5]', `Retina (DPR 2), DPR_MAX ${C.DPR_MAX}: ${escalonesPara(C, 2).join(' · ')}`);
check(JSON.stringify(escalonesPara(C, 1)) === '[1,0.85,0.7,0.5]', 'pantalla DPR 1: arranca en 1 (no sube por encima del dispositivo)');
check(escalonesPara(C, 1.1)[0] === 1.1, 'DPR 1,1: el tope del dispositivo es el primer escalón');
check(C.DPR_MAX === 1.5 && C.DPR_MIN === 0.5 && C.DPR_AUTO === true && C.OBJETIVO_FPS === 50, 'defaults: DPR_MAX 1,5 · DPR_MIN 0,5 · DPR_AUTO · OBJETIVO_FPS 50');

// simulación: fpsDe(dpr, t) da los FPS que rinde la GPU a ese DPR; vsync 60
const simular = (fpsDe, seg, bloqueadoEn = () => false, dprIni = 2) => {
  const e = crearEstadoDpr(escalonesPara(C, dprIni)); let t = 0; const hist = [];
  while (t < seg) { const fps = Math.min(60, fpsDe(dprActual(e), t)); const dt = 1 / fps; t += dt;
    if (tickDpr(e, C, dt, t, bloqueadoEn(t))) hist.push([t, dprActual(e)]); }
  return { e, hist };
};
console.log('\nresolución adaptativa');
{ // GPU que rinde 40 FPS a 1,5 y escala con los píxeles (fps ∝ 1/dpr²)
  const { e, hist } = simular(d => 40 * (1.5 / d) ** 2, 60);
  console.log(`    40 FPS a DPR 1,5 (∝ 1/DPR²): cambios ${hist.map(([t, d]) => `${f(t, 1)} s → ${d}`).join(', ')} · final ${dprActual(e)}`);
  check(hist.length >= 1 && hist[0][1] === 1.25 && hist[0][0] >= 1.5 && hist[0][0] < 3.2, 'baja un escalón tras la primera ventana de 1,5 s');
  check(hist.every((h, i) => i === 0 || h[0] - hist[i - 1][0] >= C.ENTRE_CAMBIOS_S - 1e-6), `mínimo ${C.ENTRE_CAMBIOS_S} s entre cambios`);
  const finales = hist.filter(h => h[0] > 30); check(finales.length === 0, 'se estabiliza (sin cambios después de los 30 s)');
  check(Math.min(60, 40 * (1.5 / dprActual(e)) ** 2) >= C.OBJETIVO_FPS, `queda en un escalón que cumple el objetivo (${dprActual(e)})`); }
{ // GPU sobrada: arranca en el escalón 0 y no se mueve
  const { hist } = simular(() => 200, 30); check(hist.length === 0, 'con FPS de sobra (vsync 60) no cambia'); }
{ // caso borde de oscilación: a 1,25 rinde 47 FPS (baja), a 1,0 rinde 61 (sube): sin veda oscilaría cada ~7 s
  const fps = d => (d >= 1.5 ? 35 : d >= 1.25 ? 47 : 75);
  const { hist } = simular(fps, 120);
  console.log(`    caso borde (1,25 → 47 FPS, 1,0 → 75 FPS): ${hist.map(([t, d]) => `${f(t, 1)} s → ${d}`).join(', ')}`);
  const subidasT = hist.filter((h, i) => i > 0 && h[1] > hist[i - 1][1]).map(h => h[0]);
  const intervalos = subidasT.slice(1).map((t, i) => t - subidasT[i]);
  check(subidasT.length <= 3 && intervalos.every((d, i) => i === 0 || d > intervalos[i - 1] * 1.5), `sin oscilación: ${subidasT.length} subidas en 120 s, cada vez más espaciadas (${intervalos.map(d => f(d, 0)).join(', ')} s: la veda se duplica)`);
  let malo = 0; { const e = crearEstadoDpr(escalonesPara(C, 2)); let t = 0; while (t < 300) { const q = Math.min(60, fps(dprActual(e))); t += 1 / q; if (q < C.OBJETIVO_FPS) malo += 1 / q; tickDpr(e, C, 1 / q, t, false); } }
  check(malo / 300 < 0.08, `en 5 min, ${f(100 * malo / 300, 1)} % del tiempo por debajo del objetivo`); }
{ // bloqueado (destello, entrada, pausa, checkpoint): no cambia aunque rinda poco
  const { hist } = simular(() => 20, 20, t => t < 15);
  check(hist.length > 0 && hist[0][0] >= 15, `en estado bloqueado no cambia; al liberar sí (primer cambio a los ${hist.length ? f(hist[0][0], 1) : '-'} s)`); }
{ // subida: 4 s sostenidos por encima de 58
  const fps = (d, t) => (t < 6 ? 30 : 60);
  const { hist } = simular(fps, 20);
  const sub = hist.find((h, i) => i > 0 && h[1] > hist[i - 1][1]);
  check(!!sub && sub[0] >= 6 + C.SUBIR_S - 0.01, `vuelve a subir tras ${C.SUBIR_S} s sostenidos por encima de ${C.SUBIR_FPS} FPS (a los ${sub ? f(sub[0], 1) : '-'} s)`); }
{ const e = crearEstadoDpr(escalonesPara(C, 2)); e.forzado = 0.7; let cambio = false; for (let i = 0; i < 600; i++) cambio = tickDpr(e, C, 1 / 20, i / 20, false) || cambio;
  check(!cambio && dprActual(e) === 0.7, 'forzado: DPR fijo, sin cambios automáticos');
  const e2 = crearEstadoDpr(escalonesPara(C, 2)); for (let i = 0; i < 600; i++) tickDpr(e2, { ...C, DPR_AUTO: false }, 1 / 20, i / 20, false);
  check(dprActual(e2) === 1.5, 'DPR_AUTO false: fijo');
  const e3 = crearEstadoDpr(escalonesPara(C, 2)); e3.idx = 2; reescalonar(e3, escalonesPara({ ...C, DPR_MAX: 1 }, 2)); check(dprActual(e3) === 1, 'cambiar DPR_MAX conserva el escalón más cercano');
  const e4 = crearEstadoDpr(escalonesPara(C, 2)); for (let i = 0; i < 100; i++) tickDpr(e4, C, i % 2 ? 2 : NaN, i, false); check(dprActual(e4) === 1.5, 'cuadros de > 0,5 s (pestaña oculta) o NaN no cuentan'); }

console.log('\nbenchmark');
{ const pasos = pasosBench(SISTEMAS), b = crearEstadoBench(); iniciarBench(b, pasos, 0);
  const acciones = []; let t = 0;
  while (b.activo && t < 300) { t += 1 / 60; const a = tickBench(b, 16.7 + (b.pasos[b.k]?.id === 'pasto' ? -5 : 0), 9, t); if (a !== 'nada') acciones.push([a, b.k]); }
  check(pasos.length === 1 + SISTEMAS.length + 3 && pasos[0].tipo === 'base' && pasos.at(-1).dpr === 0.5, `${pasos.length} pasos: línea base, ${SISTEMAS.length} sistemas, DPR 1 / 0,75 / 0,5`);
  console.log(`    duración: ${f(t, 1)} s (estimada ${duracionBenchS(pasos.length)} s)`);
  check(Math.abs(t - duracionBenchS(pasos.length)) < 1 && t < 120, 'dura ~1,5 min (1,5 s de calentamiento + 4 s de medición por paso)');
  check(acciones.filter(a => a[0] === 'restaurar').length === pasos.length - 1 && acciones.at(-1)[0] === 'fin', 'cada paso se restaura antes del siguiente; termina con "fin"');
  const rp = b.resultados.find(r => r.paso.id === 'pasto'), rb = b.resultados[0];
  check(Math.abs(rb.media - 16.7) < 0.01 && Math.abs(rp.media - 11.7) < 0.01 && rp.gpu === 9, 'mide solo durante la medición (sin calentamiento) y promedia el tiempo de GPU');
  const txt = reporteBench(b.resultados, { gpu: 'X', dpr: 1.5, px: '100×100', refrescoHz: 60, timerGpu: true, escena: 'prueba' });
  console.log(txt.split('\n').slice(0, 6).map(l => '    | ' + l).join('\n'));
  check(txt.includes('AVISO') && txt.includes('sin pasto') && txt.includes('+5.00'), 'reporte: tabla con ganancia y aviso de vsync si la base está pegada a 60 FPS');
  const b2 = crearEstadoBench(); iniciarBench(b2, pasos, 0); for (let i = 0; i < 200; i++) tickBench(b2, 16, 0, i / 60); cancelarBench(b2);
  check(!b2.activo && b2.cancelado && tickBench(b2, 16, 0, 10) === 'nada', 'cancelable'); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
