// Z72: prueba de la ronda 3 de rendimiento. Uso (en frontend/): node scripts/rendimiento-z72-test.mjs
//  · estimador de refresco por meseta (60, 120 con jitter de rAF, 120 con escena pesada, 144, 165) y cuantización
//  · reporte: orden por ganancia de rAF, GPU secundaria y "GPU no fiable" (datos reales del benchmark de Z72)
//  · objetivo adaptativo según el refresco y simulación del DPR con cuadros cuantizados (120 y 60 Hz: sin oscilar)
//  · escalón recordado (localStorage), ACES rápido (no cumple ≤ 2/255), domo escalado y contrato de uniforms del domo
import fs from 'node:fs';
import { estimarRefrescoIntervalos, cuantizacion, reporteBench, ordenarPorGanancia, gpuNoFiable, objetivosDpr,
  leerEscalon, guardarEscalon, indiceEscalon, CLAVE_ESCALON, crearEstadoDpr, tickDpr, dprActual, escalonesPara,
  SISTEMAS } from '../lib/rendimiento.ts';
import { tamanoEscalado } from '../lib/domoEscala.ts';
import { PERFILES } from '../lib/rendimientoPost.ts';

let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const f = (n, d = 2) => Number(n).toFixed(d);
const CFG = await import('../lib/debugConfig.ts');
const R = { ...CFG.DBG_RENDIMIENTO };
let sem = 9; const rnd = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);

console.log('\nrefresco');
{
  const tmp = new Float64Array(4096);
  const serie = (n, fn) => Float64Array.from({ length: n }, fn);
  const est = ms => estimarRefrescoIntervalos(ms, ms.length, tmp);
  const P120 = 1000 / 120, P144 = 1000 / 144, P60 = 1000 / 60, P165 = 1000 / 165;
  // 120 Hz a ritmo completo con el jitter de rAF que engañaba al estimador de Z69: pares de 7,0 y 9,67 ms
  const jitter = serie(600, (_, i) => (i % 2 ? 9.67 : 7.0) + (rnd() - 0.5) * 0.3);
  const e1 = est(jitter);
  check(e1.hz === 120, `120 Hz con pares de 7,0 / 9,67 ms (jitter de rAF): ${e1.hz} Hz (meseta ${e1.meseta} · ${f(e1.fpsMeseta, 1)} FPS; mínimos ${e1.minimos}, que antes decidía)`);
  // el benchmark de Z72: base a 53,8 FPS (cuadros de 16,7 y 25 ms) + DPR 0,75 a 120,0 + DPR 0,5 a 119,1
  const base = serie(400, () => (rnd() < 0.45 ? 25 : P60) + (rnd() - 0.5) * 0.6);
  const dpr075 = serie(400, () => P120 + (rnd() - 0.5) * 2.5);
  const mezcla = Float64Array.from([...base, ...dpr075]);
  const e2 = est(mezcla);
  check(e2.hz === 120 && e2.meseta === 120, `benchmark de Z72 (53,8 FPS y luego 120,0 FPS a DPR 0,75): ${e2.hz} Hz (antes 144)`);
  const e3 = est(base);
  check(e3.hz === 120, `solo la escena pesada (cuadros de 16,7 y 25 ms): ${e3.hz} Hz por la grilla (${e3.grilla})`);
  const e4 = est(serie(600, () => (rnd() < 0.9 ? P60 : 2 * P60) + (rnd() - 0.5) * 0.8));
  check(e4.hz === 60, `60 Hz: ${e4.hz}`);
  const e5 = est(serie(600, () => P144 + (rnd() - 0.5) * 0.6));
  check(e5.hz === 144, `144 Hz: ${e5.hz}`);
  const e6 = est(serie(600, () => P165 + (rnd() - 0.5) * 0.5));
  check(e6.hz === 165, `165 Hz: ${e6.hz}`);
  const e7 = est(serie(600, () => 1000 / 105 + (rnd() - 0.5) * 3));   // app limitada a ~105 FPS (no está pegada al refresco)
  check(e7.meseta === 0, `una escena a 105 FPS de promedio no inventa un refresco por meseta (meseta ${e7.meseta}, hz ${e7.hz})`);
  // anillo: el orden cronológico se respeta con "inicio"
  const anillo = new Float64Array(800); for (let i = 0; i < 800; i++) anillo[(i + 300) % 800] = mezcla[i];
  check(estimarRefrescoIntervalos(anillo, 800, tmp, undefined, 300).hz === 120, 'con el anillo del host (inicio ≠ 0) da lo mismo');
  check(cuantizacion(120).join() === '120,60,40,30', 'cuantización a 120 Hz: 120, 60, 40, 30 FPS (el aviso decía 144, 72, 48, 36)');
}

console.log('\nreporte');
{
  // datos del benchmark de Z72 (ms de rAF y GPU por fila)
  const fila = (id, tipo, media, gpu) => ({ paso: { tipo, id, etiqueta: id === 'base' ? 'línea base' : id.startsWith('dpr') ? `DPR ${id.slice(3)}` : `sin ${id}`, dpr: 0 }, media, p95: media + 2, fps: 1000 / media, gpu, n: 400, dif: 0.1, vueltas: 2 });
  const res = [fila('base', 'base', 18.58, 30.1), fila('bloom', 'sistema', 17.85, 16.6), fila('domo', 'sistema', 14.29, 26.0), fila('pasto', 'sistema', 16.44, 28.2),
    fila('flare', 'sistema', 18.5, 30.0), fila('dpr1', 'dpr', 10.51, 18.0), fila('anillos', 'sistema', 16.65, 28.6)];
  const orden = ordenarPorGanancia(res).map(r => r.paso.id);
  check(orden.join() === 'base,dpr1,domo,pasto,anillos,bloom,flare', `orden por ganancia de rAF: ${orden.join(' > ')}`);
  check(gpuNoFiable(0.73, 13.5) && !gpuNoFiable(4.29, 4.1) && !gpuNoFiable(0.1, 0.2), 'GPU no fiable: bloom (0,73 ms de rAF y 13,5 de GPU) sí; cúpula (4,29 / 4,1) no; ruido no');
  const txt = reporteBench(res, { gpu: 'Apple M3', dpr: 1.5, px: '2268×1291', refrescoHz: 120, timerGpu: true, escena: 'estrés', canvasW: 2268, canvasH: 1291, pose: 'cerca del prisma (3 m)' });
  console.log(txt.split('\n').map(l => '    | ' + l).join('\n'));
  const L = txt.split('\n');
  const iT = L.findIndex(l => l.startsWith('sistema'));
  check(L[iT].indexOf('ganancia') < L[iT].indexOf('GPU ms'), 'la columna GPU va después de la ganancia en ms (secundaria)');
  check(L.find(l => l.startsWith('sin bloom')).includes('GPU no fiable') && !L.find(l => l.startsWith('sin cúpula') || l.startsWith('sin domo')).includes('no fiable'), 'el bloom marca "GPU no fiable"; la cúpula no');
  check(txt.includes('GPU no fiable = la ganancia de GPU difiere más de 3 veces') && txt.includes('pose de medición: cerca del prisma'), 'nota al pie y pose de medición');
  check(txt.includes('120, 60, 40, 30') && !txt.includes('144, 72'), 'aviso de cuantización a 120 Hz');
}

console.log('\nobjetivo adaptativo');
{
  const o = { objetivo: 0, subir: 0 };
  objetivosDpr(120, R, o); check(o.objetivo === 57 && o.subir === 90, `120 Hz: objetivo ${o.objetivo} FPS, subir con ${o.subir}`);
  objetivosDpr(144, R, o); check(o.objetivo === 69 && o.subir === 108, `144 Hz: objetivo ${o.objetivo}, subir ${o.subir}`);
  objetivosDpr(60, R, o); check(o.objetivo === R.OBJETIVO_FPS && o.subir === R.SUBIR_FPS, `60 Hz: los de siempre (${o.objetivo} / ${o.subir})`);
  objetivosDpr(120, { ...R, OBJETIVO_POR_REFRESCO: false }, o); check(o.objetivo === R.OBJETIVO_FPS, 'con OBJETIVO_POR_REFRESCO off: como antes');
  // simulación: costo por cuadro ∝ píxeles (18,58 ms a DPR 1,5 en la escena del benchmark), cuantizado al refresco
  const simular = (hz, segundos) => {
    const P = 1000 / hz, cfg = { ...R };
    const obj = { objetivo: 0, subir: 0 }; objetivosDpr(hz, R, obj); cfg.OBJETIVO_FPS = obj.objetivo; cfg.SUBIR_FPS = obj.subir;
    const D = crearEstadoDpr(escalonesPara(R, 2));
    let t = 0; const hist = [];
    while (t < segundos) {
      const d = dprActual(D), costo = 5.5 + 13.08 * (d / 1.5) ** 2 + (rnd() - 0.5) * 3;
      const ms = Math.ceil(costo / P - 0.02) * P;
      t += ms / 1000;
      if (tickDpr(D, cfg, ms / 1000, t, false)) hist.push([f(t, 1), dprActual(D)]);
    }
    return { D, hist };
  };
  const s120 = simular(120, 300);
  console.log(`    120 Hz: cambios ${s120.hist.map(h => `${h[0]} s → ${h[1]}`).join(', ')}`);
  check(dprActual(s120.D) === 1.25 && s120.hist.length <= 3, `120 Hz cuantizado: baja a 1,25 y se queda (${s120.hist.length} cambio(s) en 300 s, sin oscilar)`);
  const s60 = simular(60, 300);
  console.log(`    60 Hz: cambios ${s60.hist.map(h => `${h[0]} s → ${h[1]}`).join(', ')}`);
  // con 60 Hz no cambia nada (Z66): 1,25 da 60 FPS (≥ SUBIR_FPS 58), prueba 1,5 (30 FPS) y vuelve; cada rebote veda el
  // escalón el doble de tiempo (30, 60, 120 s…), así que los intentos se espacian
  const subidas = s60.hist.filter(h => h[1] === 1.5).map(h => Number(h[0]));
  const esperas = subidas.slice(1).map((t, i) => t - subidas[i]);
  check(dprActual(s60.D) <= 1.25 && esperas.every((e, i) => i === 0 || e > esperas[i - 1]), `60 Hz (como en Z66): los intentos de subir se espacian (${esperas.map(e => f(e, 0)).join(', ')} s) y termina en ${dprActual(s60.D)}`);
}

console.log('\nescalón recordado y perfiles');
{
  const mem = {}; const st = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
  check(leerEscalon(st) === null && guardarEscalon(st, 1.25) && leerEscalon(st) === 1.25 && mem[CLAVE_ESCALON] === '1.25', 'guarda y lee el último escalón estable');
  const roto = { getItem() { throw 0; }, setItem() { throw 0; } };
  check(leerEscalon(roto) === null && !guardarEscalon(roto, 1) && leerEscalon(null) === null, 'almacenamiento bloqueado o ausente: sin errores');
  mem[CLAVE_ESCALON] = 'x'; check(leerEscalon(st) === null, 'valor inválido: se ignora');
  check(indiceEscalon([1.5, 1.25, 1, 0.85], 1.25) === 1 && indiceEscalon([1.5, 1.25, 1], 1.2) === 1, 'arranca en el escalón más cercano al guardado');
  check(PERFILES.alta.DOME_ESCALA === 1 && PERFILES.media.DOME_ESCALA === 0.75 && PERFILES.baja.DOME_ESCALA === 0.5, 'perfiles: domo a 1 / 0,75 / 0,5');
  check(R.DOME_ESCALA === 1, 'DOME_ESCALA por defecto 1 (como estaba)');
  const [w, h] = tamanoEscalado(2268, 1291, 0.75), [w2, h2] = tamanoEscalado(2268, 1291, 0.5);
  check(w === 1701 && h === 968 && w2 === 1134 && h2 === 646, `domo escalado: 2268×1291 → ${w}×${h} (0,75; ${f(100 * w * h / 2268 / 1291, 0)} % de los píxeles) y ${w2}×${h2} (0,5)`);
}

console.log('\nACES rápido (Narkowicz) contra el de three');
{
  const mul = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
  const IN = [0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777];
  const OUT = [1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602];
  const rrt = v => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081);
  const sat = x => Math.min(1, Math.max(0, x));
  const three = c => mul(OUT, mul(IN, c.map(x => x / 0.6)).map(rrt)).map(sat);
  const nark = c => c.map(x => { const a = x * 0.82; return sat((a * (2.51 * a + 0.03)) / (a * (2.43 * a + 0.59) + 0.14)); });
  const srgb = x => (x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
  let maxG = 0, maxC = 0;
  for (let i = 0; i <= 200; i++) { const g = i / 100; maxG = Math.max(maxG, Math.abs(srgb(three([g, g, g])[0]) - srgb(nark([g, g, g])[0])) * 255); }
  for (let i = 0; i < 20000; i++) { const m = rnd() * rnd() * 3, c = [rnd() * m, rnd() * m, rnd() * m]; const a = three(c), b = nark(c); for (let j = 0; j < 3; j++) maxC = Math.max(maxC, Math.abs(srgb(a[j]) - srgb(b[j])) * 255); }
  console.log(`    diferencia máxima (sRGB, 8 bits): grises ${f(maxG, 1)}/255 · colores ${f(maxC, 0)}/255`);
  check(maxC > 2 && R.ACES_RAPIDO === false, 'no cumple ≤ 2/255 en colores (sin las matrices de color de ACES): ACES_RAPIDO queda apagado');
}

console.log('\nshader del domo');
{
  const frag = fs.readFileSync(new URL('../app/alight/dome/dome.frag.glsl', import.meta.url), 'utf8');
  const ts = fs.readFileSync(new URL('../app/alight/dome/domeShaders.ts', import.meta.url), 'utf8');
  const enTs = ts.slice(ts.indexOf('export const domeFrag = `') + 'export const domeFrag = `'.length, ts.lastIndexOf('`;'));
  check(enTs === frag, 'domeShaders.ts tiene el mismo fragment que dome.frag.glsl');
  const sky = fs.readFileSync(new URL('../app/alight/dome/DomeSky.tsx', import.meta.url), 'utf8');
  const spec = fs.readFileSync(new URL('../../docs/dome/SPEC.md', import.meta.url), 'utf8');
  const nuevos = ['uOndasN', 'uPortalCDir', 'uPortalAtan', 'uPerfFluido', 'uPerfSol', 'uPerfOndas', 'uPerfEstrellas', 'uPerfPortal', 'uPerfSiluetas'];
  check(nuevos.every(u => new RegExp(`uniform \\w+\\s+${u};`).test(frag) && sky.includes(`${u}:`) && spec.includes(u)), `uniforms nuevos en el shader, en DomeSky y en SPEC.md (${nuevos.length})`);
  const ids = ['domoFluido', 'domoSol', 'domoOndas', 'domoEstrellas', 'domoPortal', 'domoSiluetas'];
  check(ids.every(id => SISTEMAS.some(s => s.id === id) && R.SIS[id] === true), 'filas del benchmark para cada parte del domo');
}

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
