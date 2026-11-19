// Z100: tocar el BA-40 con la cara. (a) filtro 1 euro; (b) calibración y normalización; (c) cabeceo; (d) guiño;
// (e) mapa → setParamBajo con fuente "cara"; (f) CARA apagada y prioridad manual; (g) acento forzado y siguiente
// patrón; (h) camino completo con una cara simulada; (i) lectura de código (sin allocations, worker terminado,
// privacidad); (j) layout del módulo CARA y legibilidad. Uso: node scripts/cara-test.mjs
import fs from 'node:fs';
import { register } from 'node:module';
const RAIZ = new URL('../', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`const R = ${JSON.stringify(RAIZ)};
export async function resolve(s, c, n) {
  if (s.startsWith('@/')) s = R + s.slice(2);
  if ((/^\\.\\.?\\//.test(s) || s.startsWith('file:')) && !/\\.[a-z]+$/.test(s)) { try { return await n(s + '.ts', c); } catch {} }
  return n(s, c);
}`));
const K = await import('../lib/cara.ts');
const L = await import('../lib/bajoAcido.ts');
const M = await import('../lib/audio/bajoAcido.ts');
const CB = await import('../lib/caraBajo.ts');
const B = await import('../lib/atrilBajo.ts');
const S = await import('../lib/atrilSonido.ts');
const { DBG_CARA: C } = await import('../lib/debugConfig.ts');

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const sinCom = t => t.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const PURO = leer('../lib/cara.ts'), CTRL = leer('../lib/caraBajo.ts'), WK = leer('../lib/caraWorker.ts'), MOTOR = leer('../lib/audio/bajoAcido.ts');
const LS = leer('../components/LecternSystem.tsx'), AB = leer('../components/AtrilBajoNuevo.tsx');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const f = (v, n = 3) => Number(v).toFixed(n).replace('.', ',');
const cuerpo = (src, n) => { const i = src.search(new RegExp(`(function ${n}\\(|const ${n} = )`)); return i < 0 ? '' : src.slice(i, src.indexOf('\n}', i) + 2); };
const azar = (() => { let x = 12345; return () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; }; })();

console.log('\nestructura');
check(!/^import /m.test(PURO), 'lib/cara.ts sin imports (lógica pura)');
for (const k of ['FPS_CARA', 'ACTIVO_SOLO_EN_ATRIL', 'CARA_PRIORIDAD_MANUAL', 'CARA_MINCUTOFF', 'CARA_BETA', 'CARA_DCUTOFF', 'CARA_ACENTO_UMBRAL', 'CARA_ACENTO_REFRACTARIO_MS', 'SIMULAR'])
  check(k in C, `DBG_CARA.${k} = ${JSON.stringify(C[k])}`);
check(C.FPS_CARA === 20 && C.ACTIVO_SOLO_EN_ATRIL === true && C.CARA_PRIORIDAD_MANUAL === true && C.CARA_ACENTO_REFRACTARIO_MS === 300 && C.SIMULAR === false, 'valores por defecto pedidos (20 cuadros/s, solo en el atril, prioridad manual, refractario 300 ms, simulación apagada)');

console.log('\n(a) filtro 1 euro');
{ const fq = K.crearUnEuro(); let maxTemblorIn = 0, maxTemblorOut = 0, prevIn = 0.4, prevOut = NaN, nan = false;
  for (let i = 0; i < 200; i++) {
    const x = 0.4 + (azar() - 0.5) * 0.04, y = K.filtrarUnEuro(fq, x, i / 30, C.CARA_MINCUTOFF, C.CARA_BETA, C.CARA_DCUTOFF);
    if (!Number.isFinite(y)) nan = true;
    if (i > 30) { maxTemblorIn = Math.max(maxTemblorIn, Math.abs(x - prevIn)); if (Number.isFinite(prevOut)) maxTemblorOut = Math.max(maxTemblorOut, Math.abs(y - prevOut)); }
    prevIn = x; prevOut = y;
  }
  check(!nan && maxTemblorOut < maxTemblorIn * 0.35, `señal quieta con ruido ±0,02: temblor de salida ${f(maxTemblorOut, 4)} vs entrada ${f(maxTemblorIn, 4)} (menos del 35 %)`);
  const fr = K.crearUnEuro(); let llegada = -1;
  for (let i = 0; i < 60; i++) { const t = i / 30, x = i < 10 ? 0 : 1, y = K.filtrarUnEuro(fr, x, t, C.CARA_MINCUTOFF, C.CARA_BETA, C.CARA_DCUTOFF); if (llegada < 0 && i >= 10 && y > 0.9) llegada = i - 10; }
  check(llegada >= 0 && llegada <= 4, `escalón rápido 0 → 1: llega al 90 % en ${llegada} cuadros (≤ 4 a 30 cuadros/s, poco retraso)`);
  const fl = K.crearUnEuro(); let errMax = 0;
  for (let i = 0; i < 90; i++) { const t = i / 30, x = t / 3, y = K.filtrarUnEuro(fl, x, t, C.CARA_MINCUTOFF, C.CARA_BETA, C.CARA_DCUTOFF); if (i > 15) errMax = Math.max(errMax, Math.abs(x - y)); }
  check(errMax < 0.06, `rampa lenta: la sigue con error ≤ ${f(errMax, 3)} (< 0,06)`);
  const fn = K.crearUnEuro(); K.filtrarUnEuro(fn, 0.5, 0, 1, 0.5, 1);
  check(K.filtrarUnEuro(fn, NaN, 0.1, 1, 0.5, 1) === 0.5 && K.filtrarUnEuro(fn, Infinity, 0.2, 1, 0.5, 1) === 0.5 && Number.isFinite(K.filtrarUnEuro(fn, 0.6, 0.2, 1, 0.5, 1)) && Number.isFinite(K.filtrarUnEuro(fn, 0.7, 0.1, 1, 0.5, 1)),
    'NaN, infinito, mismo instante y reloj hacia atrás: nunca NaN');
  check(!/new |`|[=(,]\s*\[\s*\]|=\s*\{/.test(sinCom(cuerpo(PURO, 'filtrarUnEuro'))), 'filtrarUnEuro sin allocations (estado preasignado)'); }

console.log('\n(b) calibración y normalización');
{ let todo = true;
  for (const [a, b] of [[0.1, 0.6], [0.6, 0.1], [0.3, 0.3], [0.3, 0.3001], [NaN, 0.5], [0, Infinity], [-1, 2]]) for (const x of [-5, -0.1, 0, 0.1, 0.3, 0.5, 0.9, 5, NaN, Infinity]) {
    const v = K.normalizar(x, a, b, 0.08); if (!(v >= 0 && v <= 1)) { todo = false; console.log('    fuera:', a, b, x, v); }
  }
  check(todo, 'mínimo, máximo, invertido, casi cero, NaN e infinito: siempre en [0, 1]');
  check(K.normalizar(0.1, 0.1, 0.6, 0.08) === 0 && K.normalizar(0.6, 0.1, 0.6, 0.08) === 1 && Math.abs(K.normalizar(0.35, 0.1, 0.6, 0.08) - 0.5) < 1e-12, 'mínimo → 0, máximo → 1, medio → 0,5');
  check(K.normalizar(0.6, 0.6, 0.1, 0.08) === 1, 'rango invertido: se toma ordenado');
  check(Math.abs(K.normalizar(0.3, 0.3, 0.3, 0.08) - 0.5) < 1e-12 && K.normalizar(0.34, 0.3, 0.3, 0.08) === 1, 'rango casi cero: se abre a ±0,04 alrededor del centro (no divide por casi cero)');
  // guía de 5 pasos con crudos sintéticos
  const e = K.crearEstadoCal(), cal = K.crearCalibracion(); K.iniciarCal(e, 0);
  let t = 0, fin = false; const crudos = new Float64Array(4);
  while (!fin && t < 20) {
    const p = K.PASOS_CAL[e.paso]; crudos.fill(0.05); if (p && p.gesto >= 0) crudos[p.gesto] = 0.05 + 0.6 * Math.min(1, (t - e.t0) / 1);
    fin = K.pasoCal(e, crudos, true, t, 2, cal); t += 1 / 20;
  }
  check(fin && cal.calibrada && [0, 1, 2, 3].every(i => Math.abs(cal.min[i] - 0.05) < 1e-9 && Math.abs(cal.max[i] - 0.65) < 1e-9) && Math.abs(t - 10) < 0.3,
    `5 pasos de 2 s (${f(t, 1)} s): mínimos = relajada 0,05, máximos = gesto 0,65`);
  check(K.PASOS_CAL.map(p => p.texto).join(' · ') === 'CARA RELAJADA · ABRÍ LA BOCA · LABIOS EN O · SONREÍ · CEJAS ARRIBA', 'textos de la guía');
  const s = K.serializarCal(cal), c2 = K.crearCalibracion();
  check(K.leerCal(s, c2) && c2.max[0] === cal.max[0] && K.CLAVE_CAL === 'alight:cara-calibracion-v1', 'persistencia: ida y vuelta, clave con versión');
  check(!K.leerCal('{', c2) && !K.leerCal('{"v":2,"min":[0,0,0,0],"max":[1,1,1,1]}', c2) && !K.leerCal('{"v":1,"min":[0,0],"max":[1,1]}', c2) && !K.leerCal(null, c2) && !K.leerCal('{"v":1,"min":[0,0,0,"x"],"max":[1,1,1,1]}', c2),
    'lectura inválida (JSON roto, otra versión, largo o tipos malos, vacío): false, sin tirar');
  check(/try \{ if \(typeof localStorage !== "undefined"\) localStorage\.setItem\(CLAVE_CAL/.test(CTRL) && /try \{ if \(typeof localStorage !== "undefined"\) leerCal\(localStorage\.getItem\(CLAVE_CAL\)/.test(CTRL), 'localStorage dentro de try/catch');
  const e3 = K.crearEstadoCara(); e3.usarCal = false;
  const cr = new Float32Array(9); cr[0] = 1; cr[1] = 0.55;
  K.procesarCuadro(e3, cr, 0, C, C.MAPA);
  check(e3.gestos[0] === 1, 'SIN CALIBRAR: límites por defecto (BOCA 0,55 → 1) y funciona de inmediato'); }

console.log('\n(c) cabeceo');
{ const d = K.crearDetCabeceo(), U = C.CARA_ACENTO_UMBRAL, R = C.CARA_ACENTO_REFRACTARIO_MS;
  let disparos = []; let t = 0;
  const serie = []; for (let i = 0; i < 20; i++) serie.push(0);              // quieto
  for (let i = 1; i <= 4; i++) serie.push(-0.07 * i);                          // golpe: 0,28 rad en 4 cuadros de 50 ms (1,4 rad/s… 1,4) → más rápido abajo
  serie.length = 20; for (let i = 1; i <= 3; i++) serie.push(-0.12 * i);       // 0,36 rad en 150 ms: 2,4 rad/s
  for (let i = 2; i >= 0; i--) serie.push(-0.12 * i);                          // rebote dentro del refractario
  for (let i = 0; i < 20; i++) serie.push(0);
  for (const p of serie) { if (K.detectarCabeceo(d, p, t, U, R)) disparos.push(t); t += 50; }
  check(disparos.length === 1, `golpe de 2,4 rad/s con rebote: dispara una vez (t ${disparos.join(', ')} ms)`);
  const d2 = K.crearDetCabeceo(); let n2 = 0; t = 0;
  for (let i = 0; i < 120; i++) { if (K.detectarCabeceo(d2, -0.5 * Math.sin(i / 120 * Math.PI), t, U, R)) n2++; t += 50; }
  check(n2 === 0, 'movimiento lento (0,5 rad en 6 s): no dispara');
  const d3 = K.crearDetCabeceo(); const dis = []; t = 0;
  for (let i = 0; i < 60; i++) { const p = (i % 4 < 2) ? 0 : -0.2; if (K.detectarCabeceo(d3, p, t, U, R)) dis.push(t); t += 50; }
  const minSep = Math.min(...dis.slice(1).map((x, i) => x - dis[i]));
  check(dis.length > 1 && minSep >= R, `golpes seguidos cada 100 ms: respeta el refractario (${dis.length} disparos, separación mínima ${minSep} ms ≥ ${R})`);
  check(!K.detectarCabeceo(d3, NaN, t, U, R), 'pitch NaN: no dispara'); }

console.log('\n(d) guiño');
{ const G = { CARA_GUINO_CERRADO: 0.6, CARA_GUINO_ABIERTO: 0.3, CARA_GUINO_MIN_MS: 120, CARA_GUINO_REFRACTARIO_MS: 800 };
  const corre = (pasos) => { const d = K.crearDetGuino(); let t = 0, n = 0; for (const [l, r, ms] of pasos) for (let k = 0; k < ms; k += 20) { if (K.detectarGuino(d, l, r, t, G)) n++; t += 20; } return n; };
  check(corre([[0.1, 0.1, 400], [0.85, 0.1, 300], [0.1, 0.1, 400]]) === 1, 'ojo izquierdo cerrado 300 ms: un disparo');
  check(corre([[0.1, 0.1, 400], [0.1, 0.9, 300], [0.1, 0.1, 400]]) === 1, 'ojo derecho cerrado 300 ms: un disparo');
  check(corre([[0.1, 0.1, 400], [0.9, 0.9, 300], [0.1, 0.1, 400]]) === 0, 'parpadeo de los dos ojos: no dispara');
  check(corre([[0.1, 0.1, 400], [0.85, 0.1, 80], [0.1, 0.1, 400]]) === 0, 'guiño de 80 ms (< 120): no dispara');
  check(corre([[0.85, 0.1, 2000]]) === 1, 'ojo cerrado sostenido 2 s: un solo disparo (hay que abrirlo para repetir)');
  check(corre([[0.85, 0.1, 200], [0.1, 0.1, 200], [0.85, 0.1, 200], [0.1, 0.1, 600], [0.85, 0.1, 200]]) === 2, 'dos guiños a 400 ms: el segundo cae en el refractario (800 ms); el tercero, a 1,2 s, sí'); }

console.log('\n(e) mapa → setParamBajo con fuente "cara"');
{ const mapa = K.mapaPorDefecto();
  check(mapa.map(m => `${K.NOMBRES_GESTO[m.gesto]}→${m.param}`).join(' ') === 'BOCA→corte O→resonancia SONRISA→decay CEJAS→distorsion', 'por defecto: BOCA→CORTE, O→RESONANCIA, SONRISA→DECAY, CEJAS→DISTORSIÓN');
  check(JSON.stringify(C.MAPA) === JSON.stringify(mapa), 'DBG_CARA.MAPA (editable en el menú) = el mapa por defecto de lib/cara.ts');
  check(C.MAPA.every(m => L.PARAMS_BAJO[L.indiceParam(m.param)]?.modulable), 'todos los destinos son modulables (Z99)');
  const llamadas = []; const st = L.crearParams(); L.activarCara(st, true);
  const e = K.crearEstadoCara(), cr = new Float32Array(9); cr[0] = 1;
  let malRango = 0;
  for (let i = 0; i < 40; i++) {
    cr[1] = azar(); cr[2] = azar(); cr[3] = cr[4] = azar(); cr[5] = azar();
    K.procesarCuadro(e, cr, i * 50, C, C.MAPA);
    C.MAPA.forEach((m, j) => { const v = e.salida[j]; if (!(v >= Math.min(m.salMin, m.salMax) - 1e-12 && v <= Math.max(m.salMin, m.salMax) + 1e-12)) malRango++; llamadas.push([m.param, v]); L.setParam(st, m.param, v, 'cara'); });
  }
  check(malRango === 0, 'cada salida en [salMin, salMax] ⊂ [0, 1]');
  const d = L.PARAMS_BAJO[L.indiceParam('corte')];
  check(L.valorParam(st, 'corte') >= d.min && L.valorParam(st, 'corte') <= d.max && st.manual[L.indiceParam('corte')] === d.defecto, 'CORTE en su rango real (60…6000 Hz) y el manual intacto');
  check(/setParamBajo\(id, v, "cara"\)/.test(CTRL), 'caraBajo usa setParamBajo(id, valor, "cara") tal cual'); }

console.log('\n(f) CARA apagada, vuelta al manual y prioridad manual');
{ C.SIMULAR = true; C.ACTIVO_SOLO_EN_ATRIL = true;
  M.setParamBajo('corte', 500, 'manual');
  const antes = Array.from(M.PARAMS.manual);
  const cr = new Float32Array(9); cr[0] = 1; cr[1] = 0.6;
  CB.procesarCrudos(cr, 0);   // con CARA apagada la fuente "cara" está inactiva: setParam la rechaza
  check(Array.from(M.PARAMS.manual).join() === antes.join() && L.valorParam(M.PARAMS, 'corte') === 500, 'CARA apagada: ningún valor manual cambia y suena el manual (500 Hz)');
  CB.encenderCara();
  check(CB.CARA.on && M.PARAMS.caraActiva && CB.CARA.fuente === 'simulada', 'encender con SIMULAR: activa la fuente "cara" sin cámara ni worker');
  for (let i = 0; i < 10; i++) CB.procesarCrudos(cr, 1000 + i * 50);
  const conCara = L.valorParam(M.PARAMS, 'corte');
  check(conCara > 3000 && M.PARAMS.manual[L.indiceParam('corte')] === 500, `boca abierta: CORTE ${Math.round(conCara)} Hz con la cara, el manual sigue en 500`);
  CB.CARA.arrastreIdx = L.indiceParam('corte');
  CB.procesarCrudos(cr, 1600);
  check(L.valorParam(M.PARAMS, 'corte') === 500, 'arrastrando la perilla CORTE: manda el manual (500 Hz)');
  CB.CARA.arrastreIdx = -1;
  CB.procesarCrudos(cr, 1650);
  check(Math.abs(L.valorParam(M.PARAMS, 'corte') - conCara) < 1, 'al soltar: la cara retoma');
  C.CARA_PRIORIDAD_MANUAL = false; CB.CARA.arrastreIdx = L.indiceParam('corte'); CB.procesarCrudos(cr, 1700);
  check(Math.abs(L.valorParam(M.PARAMS, 'corte') - conCara) < 1, 'con CARA_PRIORIDAD_MANUAL false, la cara manda aunque se arrastre');
  C.CARA_PRIORIDAD_MANUAL = true; CB.CARA.arrastreIdx = -1;
  CB.apagarCara();
  check(!M.PARAMS.caraActiva && L.valorParam(M.PARAMS, 'corte') === 500 && !CB.CARA.on, 'al apagar CARA vuelve el manual (500 Hz)');
  CB.encenderCara(); CB.tickCara(false);
  check(CB.CARA.on, 'SIMULAR: no se apaga fuera del modo atril (para probar desde el menú)');
  C.SIMULAR = false; CB.apagarCara(); M.setParamBajo('corte', L.PARAMS_BAJO[L.indiceParam('corte')].defecto, 'manual'); }

console.log('\n(g) acento forzado y siguiente patrón');
{ const a = L.crearAcentoForzado(), ev = { tipo: L.EV_NOTA, nota: 0, acento: false, mantener: false };
  check(!L.aplicarAcentoForzado(ev, a) && !ev.acento, 'sin pendiente: no acentúa');
  a.pendiente = true;
  const sil = { tipo: L.EV_SILENCIO, nota: 0, acento: false, mantener: false }, lig = { tipo: L.EV_LIGADA, nota: 0, acento: false, mantener: false };
  check(!L.aplicarAcentoForzado(sil, a) && !L.aplicarAcentoForzado(lig, a) && a.pendiente, 'silencio y nota ligada no lo consumen');
  check(L.aplicarAcentoForzado(ev, a) && ev.acento && !a.pendiente, 'la próxima NOTA sale acentuada y lo consume');
  const ev2 = { tipo: L.EV_NOTA, nota: 0, acento: false, mantener: false };
  check(!L.aplicarAcentoForzado(ev2, a) && !ev2.acento, 'la nota siguiente ya no');
  M.cargarPatron('CHICAGO'); const antes = L.crearPatronBajo(); M.copiarPatronBajo(antes);
  M.forzarAcentoProximaNota();
  check(M.ACENTO_FORZADO.pendiente, 'forzarAcentoProximaNota deja el acento pendiente para el oyente del reloj');
  const evp = { tipo: 0, nota: 0, acento: false, mantener: false };
  for (let k = 0; k < 16; k++) { L.eventoPaso(M.PATRON_BAJO, k, evp); L.aplicarAcentoForzado(evp, M.ACENTO_FORZADO); }
  const desp = L.crearPatronBajo(); M.copiarPatronBajo(desp);
  check(L.patronesIguales(antes, desp) && !M.BAJO.editado, 'el patrón guardado no cambia (ni pasa a EDITADO)');
  check(/eventoPaso\(PATRON_BAJO, k, _ev\);[\s\S]{0,140}aplicarAcentoForzado\(_ev, ACENTO_FORZADO\)/.test(MOTOR), 'el oyente del reloj lo aplica a la copia de trabajo del evento');
  M.patronLimpio(); M.editarPaso('activo', 3, 1);
  const vistos = []; for (let i = 0; i < 6; i++) vistos.push(M.siguientePatronBajo());
  check(vistos.join(',') === 'CHICAGO,RAGA,DEEP,TECHNO,MINIMAL,CHICAGO' && !M.BAJO.editado, `siguientePatronBajo: ${vistos.join(' → ')} (no editado)`);
  check(/cargarPatron\(nm\);/.test(cuerpo(MOTOR, 'siguientePatronBajo')) && /BAJO\.version !== ver\.current\) \{ ver\.current = BAJO\.version; sincronizarBajo\(\); \}/.test(LS), 'sincroniza los pads del atril (version → sincronizarBajo)');
  M.cargarPatron('CHICAGO'); }

console.log('\n(h) camino completo con una cara simulada');
{ C.SIMULAR = true; M.setParamBajo('corte', 420, 'manual'); CB.encenderCara();
  const cr = new Float32Array(9); const D = L.PARAMS_BAJO;
  const correr = (jaw, puck, smile, brow, ms = 1500, t0 = 0) => { for (let t = 0; t <= ms; t += 50) { cr[0] = 1; cr[1] = jaw; cr[2] = puck; cr[3] = cr[4] = smile; cr[5] = brow; cr[6] = cr[7] = 0.05; cr[8] = 0; CB.procesarCrudos(cr, t0 + t); } };
  correr(0.02, 0.03, 0.05, 0.05, 1500, 10000);
  const rep = { corte: L.valorParam(M.PARAMS, 'corte'), res: L.valorParam(M.PARAMS, 'resonancia'), dec: L.valorParam(M.PARAMS, 'decay'), dis: L.valorParam(M.PARAMS, 'distorsion') };
  const esp = n => L.deNormal(D[L.indiceParam(C.MAPA[n].param)], C.MAPA[n].salMin);
  check(Math.abs(rep.corte - esp(0)) < 1 && Math.abs(rep.res - esp(1)) < 1e-3 && Math.abs(rep.dec - esp(2)) < 1e-3 && Math.abs(rep.dis - esp(3)) < 1e-3,
    `cara relajada → mínimos del mapa: CORTE ${Math.round(rep.corte)} Hz, RESONANCIA ${f(rep.res, 2)}, DECAY ${f(rep.dec, 2)} s, DISTORSIÓN ${f(rep.dis, 2)}`);
  correr(0.9, 0.9, 0.9, 0.9, 1500, 20000);   // por encima de los máximos por defecto: satura en 1
  const tope = { corte: L.valorParam(M.PARAMS, 'corte'), res: L.valorParam(M.PARAMS, 'resonancia'), dec: L.valorParam(M.PARAMS, 'decay'), dis: L.valorParam(M.PARAMS, 'distorsion') };
  const espM = n => L.deNormal(D[L.indiceParam(C.MAPA[n].param)], C.MAPA[n].salMax);
  check(Math.abs(tope.corte - espM(0)) < 5 && Math.abs(tope.res - espM(1)) < 2e-3 && Math.abs(tope.dec - espM(2)) < 2e-3 && Math.abs(tope.dis - espM(3)) < 2e-3,
    `gestos al máximo → máximos del mapa: CORTE ${Math.round(tope.corte)} Hz, RESONANCIA ${f(tope.res, 2)}, DECAY ${f(tope.dec, 2)} s, DISTORSIÓN ${f(tope.dis, 2)}`);
  correr(0.285, 0.03, 0.05, 0.05, 1500, 30000);
  const medio = L.valorParam(M.PARAMS, 'corte'), espMedio = L.deNormal(D[L.indiceParam('corte')], 0.15 + 0.5 * 0.85);
  check(Math.abs(medio - espMedio) / espMedio < 0.02, `boca a media apertura → CORTE ${Math.round(medio)} Hz (esperado ${Math.round(espMedio)}, curva exponencial)`);
  check(CB.CARA.estado === 'activa' && CB.CARA.linea === 'CARA: ACTIVA', 'display: "CARA: ACTIVA"');
  cr[0] = 0; CB.procesarCrudos(cr, 32000);
  check(CB.CARA.linea === 'CARA: ESPERANDO ROSTRO' && Math.abs(L.valorParam(M.PARAMS, 'corte') - medio) < 1e-6, 'sin rostro: "CARA: ESPERANDO ROSTRO" y el bajo retiene el último valor');
  // cabeceo y guiño por el camino completo
  M.cargarPatron('CHICAGO'); const ac0 = CB.CARA.acentos, gu0 = CB.CARA.guinos;
  cr[0] = 1; cr[8] = 0; for (let t = 0; t < 400; t += 50) CB.procesarCrudos(cr, 40000 + t);
  cr[8] = -0.3; CB.procesarCrudos(cr, 40450); cr[8] = 0; CB.procesarCrudos(cr, 40500);
  check(CB.CARA.acentos === ac0 + 1 && M.ACENTO_FORZADO.pendiente, 'cabeceo brusco → un acento forzado pendiente');
  M.ACENTO_FORZADO.pendiente = false;
  for (let t = 0; t <= 300; t += 20) { cr[6] = 0.85; cr[7] = 0.05; CB.procesarCrudos(cr, 41000 + t); }
  cr[6] = 0.05; CB.procesarCrudos(cr, 41400);
  check(CB.CARA.guinos === gu0 + 1 && M.BAJO.patron === 'RAGA', `guiño → siguiente patrón (${M.BAJO.patron})`);
  // calibración por el camino completo y su texto en el display
  CB.calibrarCara();
  check(CB.calibrando(), 'CALIBRAR arranca la guía');
  cr[6] = cr[7] = 0.05;
  for (let t = 0; t < 200; t += 50) CB.procesarCrudos(cr, performance.now() + t);
  check(/^CARA: CALIBRANDO 1\/5 · CARA RELAJADA… \d$/.test(CB.CARA.linea), `display: "${CB.CARA.linea}"`);
  CB.apagarCara(); C.SIMULAR = false; M.setParamBajo('corte', L.PARAMS_BAJO[L.indiceParam('corte')].defecto, 'manual');
  check(!CB.calibrando() && CB.CARA.linea === '', 'apagar cancela la calibración y limpia la línea'); }

console.log('\n(i) lectura de código');
{ const sc = sinCom(CTRL);
  const porCuadro = ['procesarCrudos', 'alMensaje', 'tickCara', 'alBitmap', 'llenarSimulacion', 'contarFps'].map(n => sinCom(cuerpo(CTRL, n)));
  const malos = porCuadro.map((c, i) => [['procesarCrudos', 'alMensaje', 'tickCara', 'alBitmap', 'llenarSimulacion', 'contarFps'][i], /new |`|\[\s*\]|= \{/.test(c)]).filter(x => x[1]).map(x => x[0]);
  check(porCuadro.every(c => c.length > 20) && malos.length === 0, `manejadores por cuadro sin new, sin template strings, sin arreglos ni objetos nuevos${malos.length ? ': ' + malos.join(', ') : ''}`);
  check(!/new |`|[=(,]\s*\[\s*\]|=\s*\{/.test(sinCom(cuerpo(PURO, 'procesarCuadro'))), 'procesarCuadro (puro) sin allocations');
  const uf = AB.slice(AB.indexOf('export function CaraBajo')); const ufb = uf.slice(uf.indexOf('useFrame('), uf.indexOf('\n  });', uf.indexOf('useFrame(')));
  check(!/new |`|\[\s*\]/.test(ufb), 'medidores del atril: useFrame sin allocations (redibujan solo al cambiar un segmento)');
  check(/function detenerWorker[\s\S]{0,400}w\.terminate\(\)/.test(CTRL) && /return \(\) => \{ liberarCara\(\); limpiar\(\);/.test(LS) && /export function liberarCara\(\): void \{ apagarCara\(\); \}/.test(CTRL) && /function apagarCara[\s\S]{0,200}detenerWorker\(\);[\s\S]{0,40}soltarCamara\(\);/.test(CTRL),
    'al desmontar el atril: liberarCara → apagarCara → worker.terminate() y soltar la cámara');
  check(/function soltarCamara[\s\S]{0,160}if \(_stream\) \{ for \(const t of _stream\.getTracks\(\)\) t\.stop\(\)/.test(CTRL) && !/LIVE_TEX_REF[\s\S]{0,200}getTracks/.test(sc), 'cierra solo el stream propio; el de la tarima nunca');
  check(/new Worker\(new URL\("\.\/caraWorker\.ts", import\.meta\.url\)\)/.test(CTRL) && /detectForVideo/.test(WK) && !/detectForVideo/.test(sc), 'la inferencia corre en el worker (new Worker(new URL(…), import.meta.url)); el hilo principal no llama a MediaPipe');
  check(/_enVuelo \|\| !_buf\) \{\s*CARA\.descartados\+\+/.test(CTRL) && /img\.close\(\)/.test(WK) && /_transfer\.push\(img, b\.buffer\)/.test(CTRL) && /postMessage\(\{ tipo: "resultado", buf \}, \[buf\.buffer\]\)/.test(WK),
    'un cuadro en vuelo (si no, se descarta); ImageBitmap y buffer transferidos (ida y vuelta); el worker cierra cada bitmap');
  check(!/fetch\([^)]*(img|bitmap|buf)/i.test(WK) && !/livekit|supabase|publicar/i.test(CTRL + WK) && /el video de la cara no se sube ni se transmite/i.test(CTRL), 'privacidad: ni el worker ni el controlador mandan la imagen a ningún lado (comentario explícito)');
  check(/SIS\.caraBajo === false/.test(CTRL) && /caraBajo:\s+true/.test(leer('../lib/debugConfig.ts')) && /id: "caraBajo"/.test(leer('../lib/rendimiento.ts')), 'fila caraBajo en el benchmark (SIS.caraBajo) y cronómetro msHilo / msIdaVuelta'); }

console.log('\n(j) layout del módulo CARA y legibilidad');
{ const ca = B.moduloB('cara'), mal = [];
  check(B.LAYOUT_B.conCara && ca.titulo === '4 CARA' && ca.on === 'b_cara_on' && B.MODULOS_B.filter(m => m.fila === 'abajo').map(m => m.id).join() === 'patron,voz,salida,cara', 'fila de abajo: PATRÓN · 2 VOZ · 3 SALIDA · 4 CARA');
  const P = B.POSICIONES_B, T1 = B.textosB(1);
  for (const id of ['b_cara_on', 'b_cara_cal']) { const p = B.posB(id); if (!p || !S.dentro(B.huellaB(p), ca.rect)) mal.push('fuera ' + id); }
  const luz = B.luzCaraB(), rl = { u0: luz.u - luz.r - 0.004, u1: luz.u + luz.r + 0.004, v0: luz.v - luz.r - 0.004, v1: luz.v + luz.r + 0.004 };
  const barras = [0, 1, 2, 3, 4, 5].map(i => B.barraMedidorB(i));
  for (const r of [rl, ...barras]) { if (!S.dentro(r, ca.rect)) mal.push('luz/barra fuera'); for (const p of P) if (S.seSuperponen(r, B.huellaB(p))) mal.push('↔' + p.id); }
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) if (S.seSuperponen(barras[i], barras[j])) mal.push(`barra${i}↔${j}`);
  for (const esc of [0.7, 1, 1.15]) for (const t of B.textosB(esc)) { const r = S.rectTexto(t); for (const b of [rl, ...barras]) if (S.seSuperponen(r, b)) mal.push(`${t.id}↔luz/barra @${esc}`); }
  check(mal.length === 0, `CARA ON, CALIBRAR, luz DETECTADA y 6 medidores dentro del módulo, sin colisiones con controles ni textos (0,7 / 1,0 / 1,15)${mal.length ? ': ' + mal.slice(0, 6).join(', ') : ''}`);
  const nombres = T1.filter(t => t.id.startsWith('m_cara')).map(t => t.texto);
  check(nombres.join(' · ') === 'BOCA→CORTE · O→RESONANCIA · SONRISA→DECAY · CEJAS→DISTORSIÓN · CABECEO→ACENTO · GUIÑO→PATRÓN', 'nombres serigrafiados: ' + nombres.join(' · '));
  const alto = id => T1.find(t => t.id === id)?.alto ?? 0;
  console.log(`  · alturas (mm, escala 1): medidores ${f(alto('m_cara0') * 1000, 1)} · CALIBRAR ${f(alto('e_b_cara_cal') * 1000, 1)} · DETECTADA ${f(alto('e_cara_det') * 1000, 1)} · título 4 CARA ${f(alto('t_cara') * 1000, 1)} · RESONANCIA ${f(alto('e_b_p_resonancia') * 1000, 1)} · MINIMAL ${f(alto('e_b_pat_MINIMAL') * 1000, 1)} · título 3 SALIDA ${f(alto('t_salida') * 1000, 1)} · tag SALIDA ${f(alto('g_salida') * 1000, 1)}`);
  check(alto('m_cara0') >= 0.010 && alto('e_b_cara_cal') >= 0.012 && alto('t_cara') >= 0.02, 'medidores ≥ 10 mm, CALIBRAR ≥ 12 mm, título ≥ 20 mm');
  const g = S.GEO_DEFECTO;
  for (const [nom, a] of [['16:10', 1.6], ['16:9', 16 / 9]]) {
    const p = B.buscarPoseBajo(g, a, S.escalaEfectiva(1, true, a));
    check(!!p && p.legible >= S.LEGIBLE_MIN, `${nom}: legibilidad ${f(100 * p.legible, 2)} % (≥ 2,5 %)`);
  }
  const lineas = [0, 1, 2, 3, 4].map(k => K.textoLineaCara('calibrando', k, 2)).concat(['iniciando', 'esperando', 'activa', 'sin_camara', 'sin_motor'].map(e => K.textoLineaCara(e, 0, 0)));
  check(lineas.every(l => l.length <= B.DISPLAY_CHARS_B[1]), `líneas de CARA en el display: ≤ ${B.DISPLAY_CHARS_B[1]} caracteres (la más larga ${Math.max(...lineas.map(l => l.length))})`);
  check(K.textoLineaCara('calibrando', 1, 2) === 'CARA: CALIBRANDO 2/5 · ABRÍ LA BOCA… 2' && K.textoLineaCara('esperando', 0, 0) === 'CARA: ESPERANDO ROSTRO' && K.textoLineaCara('sin_camara', 0, 0) === 'CARA: SIN CÁMARA', 'textos: "CARA: ESPERANDO ROSTRO", "CARA: CALIBRANDO 2/5 · ABRÍ LA BOCA… 2", "CARA: SIN CÁMARA"');
  B.configurarLayoutB(false);
  const viejo = B.MODULOS_B.map(m => `${m.id}:${(m.rect.u1 - m.rect.u0).toFixed(3)}`).join(' ');
  check(!B.MODULOS_B.some(m => m.id === 'cara') && B.POSICIONES_B.length === 82 && /patron:0\.400 voz:0\.650 salida:0\.290/.test(viejo), 'MODULO_CARA false: vuelve el layout de Z99 (82 controles, PATRÓN 0,40 · VOZ 0,65 · SALIDA 0,29)');
  B.configurarLayoutB(true); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
