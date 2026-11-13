// Z45: prueba de la lógica del fractal en textura (lib/prisma/fractalTextura.ts) y del ruido celular
// precalculado (lib/prisma/ruidoCelular.ts). Uso: node scripts/fractal-tex-test.mjs
import {
  crearEstadoFractalTex, avanzarFractalTex, actualizarCerca, tocaActualizar, NIVELES_ADAPT,
} from '../lib/prisma/fractalTextura.ts';
import { celularPeriodico, generarRuidoCelular } from '../lib/prisma/ruidoCelular.ts';

let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
// valores de DBG_FRACTAL (copiados: el test no importa debugConfig por el alias @/)
const CFG = {
  TEX_RES: 512, TEX_RES_CERCA: 1024, TEX_RES_DINAMICA: true, TEX_UMBRAL_CERCA: 0.7, TEX_HISTERESIS: 0.05, TEX_FPS: 30,
  ADAPTATIVO: false, MS_MAX: 20, ADAPT_MARGEN: 0.7, ADAPT_BAJAR_S: 1.0, ADAPT_SUBIR_S: 3.0, ITERACIONES: 16,
};

console.log('\numbral de resolución cercana (histéresis)');
check(!actualizarCerca(false, 0.74, 0.7, 0.05) && actualizarCerca(false, 0.76, 0.7, 0.05), 'sube recién con prox > 0,75');
check(actualizarCerca(true, 0.66, 0.7, 0.05) && !actualizarCerca(true, 0.64, 0.7, 0.05), 'baja recién con prox < 0,65');
// prox oscilando alrededor del umbral: sin cambios de resolución
{
  const e = crearEstadoFractalTex(); let cambios = 0, prev = -1;
  for (let i = 0; i < 600; i++) { avanzarFractalTex(e, CFG, 1 / 60, 0.7 + 0.04 * Math.sin(i * 0.3)); if (prev !== -1 && e.res !== prev) cambios++; prev = e.res; }
  check(cambios === 0 && e.res === 512, `prox oscilando 0,66–0,74 durante 10 s: ${cambios} cambios de resolución`);
}
{
  const e = crearEstadoFractalTex(); const res = []; let cambios = 0, prev = -1;
  for (let i = 0; i <= 200; i++) { const p = i < 100 ? i / 100 : (200 - i) / 100; avanzarFractalTex(e, CFG, 1 / 60, p); if (prev !== -1 && e.res !== prev) { cambios++; res.push(`${prev}→${e.res} en prox ${p.toFixed(2)}`); } prev = e.res; }
  check(cambios === 2, `acercarse y alejarse: 2 recreaciones (${res.join(', ')})`);
}
check(avanzarFractalTex(crearEstadoFractalTex(), { ...CFG, TEX_RES_DINAMICA: false }, 1 / 60, 1).res === 512, 'sin resolución dinámica: TEX_RES aunque prox = 1');
check(avanzarFractalTex(crearEstadoFractalTex(), { ...CFG, TEX_RES: 99999 }, 1 / 60, 0).res === 2048 && avanzarFractalTex(crearEstadoFractalTex(), { ...CFG, TEX_RES: NaN }, 1 / 60, 0).res === 512, 'resolución acotada (64…2048) y NaN → 512');

console.log('\nritmo de actualización (TEX_FPS)');
{
  const cuenta = (fps, frameFps, seg, pausa = false) => { const e = crearEstadoFractalTex(); let n = 0; for (let i = 0; i < seg * frameFps; i++) if (tocaActualizar(e, 1 / frameFps, fps, pausa)) n++; return n; };
  const a = cuenta(30, 60, 10), b = cuenta(30, 144, 10), c = cuenta(0, 60, 10), d = cuenta(30, 20, 10);
  console.log(`    10 s: TEX_FPS 30 a 60 fps → ${a}, a 144 fps → ${b}, a 20 fps → ${d}; TEX_FPS 0 a 60 fps → ${c}`);
  check(Math.abs(a - 300) <= 1 && Math.abs(b - 300) <= 2, 'TEX_FPS 30: ~300 actualizaciones en 10 s (a 60 y 144 fps)');
  check(c === 600, 'TEX_FPS 0: cada frame');
  check(d === 200, 'con el juego más lento que TEX_FPS: una por frame (no se acumulan)');
  check(cuenta(30, 60, 10, true) === 0, 'en pausa: no se recalcula');
  const e = crearEstadoFractalTex(); tocaActualizar(e, 1 / 60, 30, false);
  let seguidas = 0; for (let i = 0; i < 2; i++) if (tocaActualizar(e, i === 0 ? 5 : 1 / 60, 30, false)) seguidas++;
  check(seguidas === 1, `frame de 5 s (pestaña oculta): 1 actualización, no una ráfaga (${seguidas})`);
}

console.log('\ncalidad adaptativa');
{
  const cfg = { ...CFG, ADAPTATIVO: true };
  const e = crearEstadoFractalTex(); const log = [];
  const correr = (ms, seg, prox = 1) => { for (let i = 0; i < seg * (1000 / ms); i++) { avanzarFractalTex(e, cfg, ms / 1000, prox); if (e.cambioNivel) log.push(`${e.cambioNivel < 0 ? '↓' : '↑'}${e.nivel}(${e.res}/${e.iter})`); } };
  correr(16, 3);
  check(e.nivel === 0 && e.res === 1024 && e.iter === 16, 'con margen (16 ms): calidad completa, 1024 px y 16 it');
  correr(30, 0.9);
  check(e.nivel === 0, 'frame lento menos de 1 s: no baja');
  correr(30, 0.3);
  check(e.nivel === 1 && e.res === 512, `más de 1 s seguido a 30 ms: baja un escalón → ${e.res} px`);
  correr(30, 20);
  check(e.nivel === NIVELES_ADAPT.length - 1 && e.res === 256 && e.iter === 10, `sigue lento: baja hasta 256 px y 10 it (${log.join(' ')})`);
  log.length = 0; correr(18, 2);
  check(e.nivel === NIVELES_ADAPT.length - 1, '18 ms (entre 14 y 20): no sube ni baja (histéresis)');
  correr(10, 3.5);
  check(e.nivel === NIVELES_ADAPT.length - 2, `3 s con margen (10 ms): sube un escalón (${log.join(' ')})`);
  // sin parpadeo: alternar lento/rápido cada 0,5 s no cambia nada
  const e2 = crearEstadoFractalTex(); let cambios = 0;
  for (let k = 0; k < 20; k++) { const ms = k % 2 ? 30 : 10; for (let i = 0; i < 500 / ms; i++) { avanzarFractalTex(e2, cfg, ms / 1000, 1); if (e2.cambioNivel) cambios++; } }
  check(cambios === 0, `alternar 30 ms / 10 ms cada 0,5 s durante 10 s: ${cambios} cambios`);
  const e3 = crearEstadoFractalTex(); for (let i = 0; i < 200; i++) avanzarFractalTex(e3, { ...cfg, ADAPTATIVO: false }, 0.05, 1);
  check(e3.nivel === 0 && e3.res === 1024, 'ADAPTATIVO off: nunca baja');
}

console.log('\nruido celular precalculado');
{
  // réplica literal del cellular() del shader (Gustavson, mod 289) para comparar
  const K = 0.142857142857, Ko = 0.428571428571, mod = (x, m) => x - m * Math.floor(x / m), perm = x => mod((34 * x + 1) * x, 289), fr = x => x - Math.floor(x);
  const gus = (Px, Py) => { const ix = mod(Math.floor(Px), 289), iy = mod(Math.floor(Py), 289), fx = fr(Px), fy = fr(Py); let f1 = 1e9, f2 = 1e9;
    for (let i = -1; i <= 1; i++) { const hx = perm(ix + i); for (let j = -1; j <= 1; j++) { const p = perm(hx + iy + j); const ox = fr(p * K) - Ko, oy = mod(Math.floor(p * K), 7) * K - Ko;
      const dx = fx - (i + 0.5) + ox, dy = fy - (j + 0.5) + oy, d = dx * dx + dy * dy; if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d; } } return [Math.sqrt(f1), Math.sqrt(f2)]; };
  const out = [0, 0]; let maxD = 0;
  for (let k = 0; k < 2000; k++) { const x = 1 + Math.random() * 29, y = 1 + Math.random() * 29; celularPeriodico(x, y, 32, out); const g = gus(x, y); maxD = Math.max(maxD, Math.abs(out[0] - g[0]), Math.abs(out[1] - g[1])); }
  check(maxD < 1e-9, `dentro de la repetición (celdas 1…30) es idéntico al cellular() del shader (máx. dif. ${maxD.toExponential(1)})`);
  let maxT = 0; for (let k = 0; k < 500; k++) { const x = Math.random() * 32, y = Math.random() * 32; const a = celularPeriodico(x, y, 32, [0, 0]), b = celularPeriodico(x + 32, y - 64, 32, [0, 0]); maxT = Math.max(maxT, Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])); }
  check(maxT < 1e-9, 'se repite cada 32 celdas sin costura');
  const t0 = performance.now(); const datos = generarRuidoCelular(256, 32); const ms = performance.now() - t0;
  check(datos.length === 256 * 256 * 4 && datos.every(Number.isFinite), `textura 256 × 256 generada en ${ms.toFixed(0)} ms, valores finitos`);
}

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
