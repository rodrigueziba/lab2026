// Z99: BAJO ÁCIDO BA-40. (a) frecuencia; (b) patrones de fábrica; (c) secuenciador con reloj simulado (tempos 60…180,
// 8/12/16/32 pasos de la caja, saltos de reloj); (d) desliz sin reiniciar la envolvente; (e) acento; (f) curva del filtro;
// (g) setParam con fuente manual y "cara"; (h) layout del atril; (i) sin allocations en el reloj ni en el dibujo del
// display; (j) limpieza. Uso: node scripts/bajo-acido-test.mjs
import fs from 'node:fs';
import { register } from 'node:module';
const RAIZ = new URL('../', import.meta.url).href;   // Z102: también "@/" (para probar el motor)
register('data:text/javascript,' + encodeURIComponent(`const R = ${JSON.stringify(RAIZ)};
export async function resolve(s, c, n) {
  if (s.startsWith('@/')) s = R + s.slice(2);
  if ((/^\\.\\.?\\//.test(s) || s.startsWith('file:')) && !/\\.[a-z]+$/.test(s)) { try { return await n(s + '.ts', c); } catch {} }
  return n(s, c);
}`));
const L = await import('../lib/bajoAcido.ts');
const R = await import('../lib/audio/reloj.ts');
const B = await import('../lib/atrilBajo.ts');
const S = await import('../lib/atrilSonido.ts');

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const MOTOR = leer('../lib/audio/bajoAcido.ts'), PURO = leer('../lib/bajoAcido.ts'), COMP = leer('../components/AtrilBajoNuevo.tsx');
const LS = leer('../components/LecternSystem.tsx'), CFG = leer('../lib/debugConfig.ts');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const cerca = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const cuerpo = (src, n) => { const i = src.search(new RegExp(`(function ${n}\\(|const ${n} = \\()`)); return i < 0 ? '' : src.slice(i, src.indexOf('\n}', i) + 2); };
const sinComentarios = t => t.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

console.log('\nconstantes y estructura');
check(!/^import /m.test(PURO), 'lib/bajoAcido.ts sin imports (lógica pura)');
for (const k of ['RAIZ_MIDI', 'TEMPO_HEREDADO', 'LOOKAHEAD_S', 'INTERVALO_S', 'FILTRO_FRECUENCIA_MIN', 'FILTRO_FRECUENCIA_MAX', 'RES_MAX'])
  check(new RegExp(`export const DBG_BAJO = \\{[\\s\\S]*?\\n  ${k}:`).test(CFG), `DBG_BAJO.${k}`);
for (const k of ['ETIQUETA_ESCALA', 'ETIQUETA_AUTO_ASPECTO', 'DISPLAY_VALOR_S', 'VU_HZ', 'ROTULOS_FILA', 'ROTULOS_MODO', 'ESCALA_PASOS'])
  check(new RegExp(`export const DBG_ATRIL_BAJO = \\{[\\s\\S]*?\\n  ${k}:`).test(CFG), `DBG_ATRIL_BAJO.${k}`);

console.log('\n(a) frecuencia de las notas');
check(L.midiAFrecuencia(69) === 440, 'La4 (69) = 440 Hz');
check(cerca(L.midiAFrecuencia(81), 880, 1e-9) && cerca(L.midiAFrecuencia(57), 220, 1e-9), 'una octava arriba duplica (81 → 880 Hz), una abajo la mitad (57 → 220 Hz)');
check(cerca(L.midiAFrecuencia(36), 65.40639, 1e-4) && L.nombreNota(36) === 'C2' && L.nombreNota(39) === 'D#2', 'C2 (36) = 65,41 Hz; nombres "C2", "D#2"');

console.log('\n(b) patrones de fábrica');
{ const p = L.crearPatronBajo();
  check(L.NOMBRES_PATRON.join() === 'CHICAGO,RAGA,DEEP,TECHNO,MINIMAL,FUNK,DISCO', 'los 7 (Z102: + FUNK, DISCO): CHICAGO, RAGA, DEEP, TECHNO, MINIMAL, FUNK, DISCO');
  for (const nm of L.NOMBRES_PATRON) {
    L.cargarFabrica(nm, p);
    const notas = Array.from(p.nota).filter((_, i) => p.activo[i]);
    check(L.FABRICA[nm].length === 16 && notas.every(n => n >= 0 && n <= 24) && L.activos(p) >= 4,
      `${nm}: 16 pasos, ${L.activos(p)} activos, notas ${Math.min(...notas)}…${Math.max(...notas)}, ${p.acento.reduce((a, b) => a + b, 0)} acentos, ${p.desliz.reduce((a, b) => a + b, 0)} deslices`);
  }
  L.limpiarPatron(p);
  check(L.activos(p) === 0, 'PATRÓN LIMPIO: todos los pasos apagados');
  const q = L.crearPatronBajo(); L.cargarFabrica('TECHNO', p); L.cargarFabrica('TECHNO', q);
  check(L.patronesIguales(p, q), 'recién cargado = igual al de fábrica (no "EDITADO")');
  p.acento[3] = p.acento[3] ? 0 : 1;
  check(!L.patronesIguales(p, q), 'al editar un paso deja de ser igual (el display muestra "EDITADO")');
  check(/BAJO\.editado = !patronesIguales\(PATRON_BAJO, _fabrica\);/.test(MOTOR) && /" · EDITADO"/.test(PURO), 'el motor marca EDITADO y la línea 1 lo muestra'); }

console.log('\n(c) secuenciador con reloj simulado');
{ const casos = []; let todoOk = true, detalle = '';
  for (const n of [8, 12, 16, 32]) for (const bpm of [60, 90, 124, 150, 180]) {
    const r = R.crearReloj(bpm, n, n / 4), anticipo = 0.1;
    const kk = new Int32Array(8), tt = new Float64Array(8), ev = [];
    let ahora = 0;
    R.suscribir(r, (paso, t, _c, d) => { const c = L.pasosEnVentana(paso, n, t, d, kk, tt); for (let i = 0; i < c; i++) ev.push([kk[i], tt[i], ahora]); });
    R.iniciar(r, 0, 0.05);
    // despertares irregulares (16 a 40 ms) y saltos de 0,08 s (dentro de la anticipación)
    let i = 0;
    while (ahora < 8) { R.programar(r, ahora, anticipo); ahora += (i % 7 === 6) ? 0.08 : 0.016 + (i % 5) * 0.006; i++; }
    const d16 = 60 / bpm / 4;
    let bien = ev.length > 0;
    for (let j = 0; j < ev.length && bien; j++) {
      const [k, t, cuando] = ev[j];
      if (k !== j % 16) { bien = false; detalle = `n${n} bpm${bpm}: paso ${j} → k ${k}`; }
      if (!cerca(t, 0.05 + j * d16, 1e-6)) { bien = false; detalle = `n${n} bpm${bpm}: tiempo ${t} ≠ ${0.05 + j * d16}`; }
      // programado ANTES de sonar (nunca tarde) y a lo sumo un paso del reloj después de su ventana de anticipación
      if (!(t >= cuando - 0.02 - 1e-9 && t <= cuando + anticipo + 60 / bpm / (n / 4) + 1e-9)) { bien = false; detalle = `n${n} bpm${bpm}: fuera de la anticipación`; }
    }
    if (!bien) todoOk = false;
    casos.push(`${n}p/${bpm}`);
  }
  check(todoOk, `cada paso del bajo a su tiempo exacto (t0 + k × 60/bpm/4), en orden, sin perder ni repetir, programado dentro de la anticipación: ${casos.length} combinaciones (caja de 8, 12, 16 y 32 pasos × 60…180 BPM)${detalle ? ' · ' + detalle : ''}`);
  // salto de reloj grande (pestaña dormida): el reloj saltea pasos vencidos; el bajo no repite ni se corre de la grilla
  const r = R.crearReloj(120, 16, 4), kk = new Int32Array(8), tt = new Float64Array(8), ev = [];
  R.suscribir(r, (paso, t, _c, d) => { const c = L.pasosEnVentana(paso, 16, t, d, kk, tt); for (let i = 0; i < c; i++) ev.push([kk[i], tt[i]]); });
  R.iniciar(r, 0, 0.05);
  for (let a = 0; a < 2; a += 0.025) R.programar(r, a, 0.1);
  for (let a = 5; a < 7; a += 0.025) R.programar(r, a, 0.1);
  const ts = ev.map(e => e[1]), gridOk = ev.every(([k, t]) => { const i = Math.round((t - 0.05) / 0.125); return i % 16 === k && cerca(0.05 + i * 0.125, t, 1e-6); });
  check(new Set(ts).size === ts.length && ts.every((t, i) => i === 0 || t > ts[i - 1]) && gridOk && ts.every(t => t < 2.2 || t >= 5 - 0.02),
    `salto de reloj de 3 s: ningún paso repetido, ninguno tarde, todos en la grilla (${R.crearReloj ? 'cortes del reloj: ' + r.cortes : ''})`);
  check(/suscribirPasos\(oyenteNucleo\)/.test(MOTOR) && /alPasoReloj\(paso, t, compas, durS, RELOJ\.pasosPorCompas\)/.test(MOTOR) && /if \(!DBG_BAJO\.ACTIVO \|\| !RITMOS\.sonando\) return;/.test(MOTOR),
    'el bajo es un oyente del reloj del núcleo (el de la caja de ritmos) y solo suena si la caja suena (sin autoplay)');
  check(/_motorPropio = setInterval\(\(\) => \{ setBpm\(r, DBG_BAJO\.BPM\); programar\(r, ctx\.currentTime, DBG_BAJO\.LOOKAHEAD_S\); \}, Math\.max\(5, DBG_BAJO\.INTERVALO_S \* 1000\)\);/.test(MOTOR),
    'con TEMPO_HEREDADO false: reloj propio (mismo programador con anticipación) con LOOKAHEAD_S e INTERVALO_S'); }

console.log('\n(d) desliz');
{ const p = L.crearPatronBajo(), e = { tipo: 0, nota: 0, acento: false, mantener: false };
  p.activo.set([1, 1, 1, 0]); p.nota.set([0, 7, 12, 0]); p.desliz[0] = 1;
  L.eventoPaso(p, 0, e); const t0 = e.tipo, m0 = e.mantener;
  L.eventoPaso(p, 1, e); const t1 = e.tipo, m1 = e.mantener;
  L.eventoPaso(p, 2, e); const t2 = e.tipo;
  L.eventoPaso(p, 3, e); const t3 = e.tipo;
  check(t0 === L.EV_NOTA && m0 && t1 === L.EV_LIGADA && !m1 && t2 === L.EV_NOTA && t3 === L.EV_SILENCIO,
    'paso con DESLIZ: se mantiene y el siguiente es LIGADA (no dispara); después vuelve a disparar; el apagado es silencio');
  p.activo.fill(0); p.activo[15] = 1; p.desliz[15] = 1; p.activo[0] = 1;
  L.eventoPaso(p, 0, e);
  check(e.tipo === L.EV_LIGADA, 'el desliz del paso 16 liga con el paso 1 de la vuelta siguiente');
  const lig = MOTOR.slice(MOTOR.indexOf('if (ev.tipo === EV_LIGADA && v.sostenida) {'), MOTOR.indexOf('} else {', MOTOR.indexOf('if (ev.tipo === EV_LIGADA && v.sostenida) {')));
  check(lig.length > 50 && !/vca|envFiltro|f1\.|f2\./.test(lig) && /osc\.frequency\.setTargetAtTime/.test(lig), 'en el motor, la nota ligada solo desliza la altura: no toca la envolvente de amplitud ni la del filtro'); }

console.log('\n(e) acento');
{ const a = 0.6;
  check(L.nivelNota(true, a) > L.nivelNota(false, a) && L.nivelNota(true, a) <= 1, `nivel: acentuada ${L.nivelNota(true, a).toFixed(2)} > normal ${L.nivelNota(false, a).toFixed(2)}`);
  const an = L.aperturaNota(0.5, false, a), ac = L.aperturaNota(0.5, true, a);
  check(ac > an && L.corteConEnvolvente(400, ac, 4, 20000) > L.corteConEnvolvente(400, an, 4, 20000), `apertura del filtro: acentuada ${ac.toFixed(2)} > normal ${an.toFixed(2)} (pico ${Math.round(L.corteConEnvolvente(400, ac, 4, 20000))} Hz vs ${Math.round(L.corteConEnvolvente(400, an, 4, 20000))} Hz)`);
  check(L.nivelNota(true, 0) === L.nivelNota(false, 0), 'con ACENTO en 0, acentuada = normal'); }

console.log('\n(f) curva del filtro');
{ const out = new Float32Array(96), q = L.qDeResonancia(0, 18);
  const energiaAlta = fc => { L.curvaFiltro(fc, q, 30, 12000, out, 96); let s = 0; for (let i = 0; i < 96; i++) s += out[i] * (i / 95); return s; };   // ponderada hacia los agudos
  let mono = true, prev = -1; for (const fc of [80, 150, 300, 600, 1200, 2400, 4800]) { const e = energiaAlta(fc); if (!(e > prev)) mono = false; prev = e; }
  check(mono, 'más CORTE, más energía en las frecuencias altas (monótona)');
  const plana = L.curvaFiltro(800, L.qDeResonancia(0, 18), 30, 12000, new Float32Array(96), 96), pico = L.curvaFiltro(800, L.qDeResonancia(1, 18), 30, 12000, new Float32Array(96), 96);
  const maxP = Math.max(...pico), dc = pico[0];
  check(maxP > dc + 0.15 && Math.max(...plana) <= plana[0] + 1e-6, `la RESONANCIA crea un pico (${(maxP - dc).toFixed(2)} sobre el nivel bajo); sin resonancia no hay pico`);
  let okR = true;
  for (const [fc, qq] of [[NaN, NaN], [0, 0], [1e9, 1e9], [-5, 3], [500, Infinity]]) { const o = L.curvaFiltro(fc, qq, NaN, NaN, new Float32Array(32), 32); if (!o.every(v => Number.isFinite(v) && v >= 0 && v <= 1)) okR = false; }
  check(okR, 'nunca NaN ni fuera de [0, 1] (corte y Q inválidos o extremos)');
  check(L.qDeResonancia(0, 18) === 0.707 && cerca(L.qDeResonancia(1, 18), 18, 1e-9) && L.qDeResonancia(0.5, 18) < 3, 'RESONANCIA 0…1 → Q 0,707…RES_MAX con curva suave'); }

console.log('\n(g) setParam: fuentes manual y cara');
{ const st = L.crearParams();
  check(L.setParam(st, 'corte', 99999, 'manual') && L.valorParam(st, 'corte') === 6000 && L.setParam(st, 'corte', -5, 'manual') && L.valorParam(st, 'corte') === 60, 'manual: respeta el rango (60…6000 Hz)');
  L.setParam(st, 'corte', 800, 'manual');
  check(!L.setParam(st, 'corte', 0.9, 'cara') && L.valorParam(st, 'corte') === 800, 'cara inactiva: no toca nada (vale el manual)');
  L.activarCara(st, true);
  check(L.setParam(st, 'corte', 1, 'cara') && L.valorParam(st, 'corte') === 6000 && st.manual[L.indiceParam('corte')] === 800, 'cara activa: 0…1 normalizado → 6000 Hz, sin pisar el valor manual (800)');
  L.setParam(st, 'corte', 0.5, 'cara');
  check(cerca(L.valorParam(st, 'corte'), Math.sqrt(60 * 6000), 1e-6), 'normalización exponencial: 0,5 → media geométrica (600 Hz)');
  check(!L.setParam(st, 'volumen', 0.1, 'cara') && !L.setParam(st, 'afinacion', 1, 'cara'), 'la cara solo mueve los parámetros modulables (no VOLUMEN ni AFINACIÓN)');
  check(L.setParam(st, 'resonancia', 7, 'cara') && L.valorParam(st, 'resonancia') === 1 && !L.setParam(st, 'resonancia', NaN, 'cara'), 'cara: acota a [0, 1] e ignora NaN');
  L.activarCara(st, false);
  check(L.valorParam(st, 'corte') === 800, 'al desactivar la cara vuelve el valor manual');
  check(L.PARAMS_BAJO.every(d => L.aNormal(d, L.deNormal(d, 0.3)) - 0.3 < 1e-9) && L.PARAMS_BAJO.filter(d => d.modulable).length >= 5, 'aNormal / deNormal inversas; 6 parámetros modulables');
  check(/export function setParamBajo\(id: string, valor: number, fuente: FuenteParam = "manual"\): boolean/.test(MOTOR) && /setParamBajo\(pid, deNormal\(d, v\), "manual"\)/.test(LS),
    'el motor expone setParamBajo(id, valor, fuente); las perillas del atril usan la fuente "manual"'); }

console.log('\n(Z102) patrones FUNK y DISCO');
{ const M = await import('../lib/audio/bajoAcido.ts');
  const { DBG_BAJO: DB, DBG_RITMOS: DR } = await import('../lib/debugConfig.ts');
  const pat = nm => { const p = L.crearPatronBajo(); L.cargarFabrica(nm, p); return p; };
  const notas = p => new Set(Array.from(p.nota).filter((_, i) => p.activo[i]));
  check(L.NOMBRES_PATRON.length === 7 && L.NOMBRES_PATRON.every(nm => nm.length <= 7) && L.NOMBRES_PATRON.every(nm => { const p = pat(nm); return L.FABRICA[nm].length === 16 && L.activos(p) >= 4 && Array.from(p.nota).every(n => n >= 0 && n <= 24); }),
    '7 patrones de fábrica: 16 pasos, notas 0…24, al menos 4 pasos activos, nombres de hasta 7 letras');
  let peor = 0, detalle = '';
  for (const nuevo of ['FUNK', 'DISCO']) for (const otro of L.NOMBRES_PATRON) {
    if (otro === nuevo) continue;
    const n = L.pasosIguales(pat(nuevo), pat(otro));
    if (n > peor) { peor = n; detalle = `${nuevo}↔${otro}`; }
  }
  check(peor <= 8, `FUNK y DISCO no comparten más de 8 de 16 pasos idénticos (activo/nota) con ningún otro: el máximo es ${peor} (${detalle})`);
  const f = pat('FUNK'), d = pat('DISCO'), vf = L.VOZ_PATRON.FUNK, vd = L.VOZ_PATRON.DISCO;
  check(notas(f).size <= 3 && 16 - L.activos(f) >= 6 && f.acento.reduce((a, b) => a + b, 0) >= 2 && [1, 2].includes(f.desliz.reduce((a, b) => a + b, 0)),
    `FUNK: ${notas(f).size} notas distintas, ${16 - L.activos(f)} silencios, ${f.acento.reduce((a, b) => a + b, 0)} acentos, ${f.desliz.reduce((a, b) => a + b, 0)} desliz`);
  check(vf.onda === 'sierra' && vf.params.distorsion >= 0.6 && vf.params.modEnv >= 0.7 && vf.params.resonancia >= 0.6 && vf.params.corte <= 300 && vf.bpm === 110,
    'FUNK: SIERRA, CORTE bajo, MOD. ENV. alto, RESONANCIA media-alta, DISTORSIÓN ≥ 0,6; BPM sugerido 110');
  check(notas(d).size >= 5 && notas(d).size <= 7 && d.desliz.reduce((a, b) => a + b, 0) >= 3 && 16 - L.activos(d) <= 3 && notas(d).has(0) && notas(d).has(12),
    `DISCO: ${notas(d).size} notas distintas, ${d.desliz.reduce((a, b) => a + b, 0)} pasos con desliz, ${16 - L.activos(d)} silencios, salto de octava (0 y 12)`);
  check(vd.onda === 'cuadrada' && vd.params.distorsion <= 0.25 && vd.params.resonancia <= 0.5 && vd.params.decay >= 0.3 && vd.bpm >= 115 && vd.bpm <= 120,
    'DISCO: CUADRADA, CORTE medio, RESONANCIA baja-media, DISTORSIÓN baja, DECAY medio; BPM sugerido 115…120');
  const fuera = [];
  for (const nm of ['FUNK', 'DISCO']) for (const [id, v] of Object.entries(L.VOZ_PATRON[nm].params)) { const dd = L.PARAMS_BAJO[L.indiceParam(id)]; if (!dd || v < dd.min || v > dd.max) fuera.push(`${nm}.${id}=${v}`); }
  check(fuera.length === 0 && Object.keys(vf.params).length === 8 && Object.keys(L.VOZ_PATRON).join() === 'FUNK,DISCO',
    `seteo de voz dentro de rango (AFINACIÓN, CORTE, RESONANCIA, MOD. ENV., DECAY, ACENTO, DESLIZ, DISTORSIÓN + onda); solo FUNK y DISCO lo tienen${fuera.length ? ': ' + fuera.join(', ') : ''}`);
  const ciclo = []; let nm = 'MINIMAL'; for (let i = 0; i < 8; i++) { nm = L.siguienteNombrePatron(nm); ciclo.push(nm); }
  check(ciclo.join() === 'FUNK,DISCO,CHICAGO,RAGA,DEEP,TECHNO,MINIMAL,FUNK', `siguiente patrón (guiño): recorre los 7 y vuelve al primero (${ciclo.join(' → ')})`);
  check(L.textoPatron('FUNK') === 'PATRÓN FUNK · BPM SUGERIDO 110' && L.textoPatron('DISCO') === 'PATRÓN DISCO · BPM SUGERIDO 118' && L.textoPatron('RAGA') === 'PATRÓN RAGA'
    && /if \(id\.startsWith\("b_pat_"\)\) return textoPatron\(id\.slice\(6\)\);/.test(LS), 'display: "PATRÓN FUNK · BPM SUGERIDO 110" al apretar el pad (solo informativo)');
  // motor: aplica (o no) la voz con valores MANUALES; la cara manda encima y al apagarla quedan los del patrón
  M.silenciarYReiniciarBajo();
  const bpm0 = DR.BPM, man = id => M.PARAMS.manual[L.indiceParam(id)];
  DB.PATRON_APLICA_VOZ = false; M.cargarPatron('FUNK');
  check(DB.ONDA === 'sierra' && man('corte') === DB.CORTE && man('distorsion') === DB.DISTORSION && M.BAJO.patron === 'FUNK', 'PATRON_APLICA_VOZ false: el pad carga el patrón y NO toca la voz');
  DB.PATRON_APLICA_VOZ = true; M.cargarPatron('DISCO');
  check(DB.ONDA === 'cuadrada' && man('corte') === 650 && man('distorsion') === 0.12 && man('desliz') === 0.12 && DR.BPM === bpm0, 'PATRON_APLICA_VOZ true: DISCO escribe su onda y sus valores manuales; el tempo de la caja no cambia');
  M.cargarPatron('CHICAGO');
  check(DB.ONDA === 'cuadrada' && man('corte') === 650, 'los cinco originales no tocan la voz (CHICAGO deja la de DISCO)');
  L.activarCara(M.PARAMS, true); L.setParam(M.PARAMS, 'corte', 1, 'cara');
  M.cargarPatron('FUNK');
  check(man('corte') === 180 && M.PARAMS.cara[L.indiceParam('corte')] === 1 && L.valorParam(M.PARAMS, 'corte') === 6000, 'con la cara activa: el patrón escribe el MANUAL (180 Hz) y la cara sigue mandando (6000 Hz)');
  L.activarCara(M.PARAMS, false);
  check(L.valorParam(M.PARAMS, 'corte') === 180, 'al apagar la cara queda el valor del patrón (regla de Z99/Z100)');
  M.cargarPatron('MINIMAL'); M.siguientePatronBajo();
  check(M.BAJO.patron === 'FUNK' && DB.ONDA === 'sierra' && man('distorsion') === 0.75, 'el guiño (siguientePatronBajo) pasa a FUNK y también aplica su voz');
  M.silenciarYReiniciarBajo();
  check(/aplicarVozPatron\(nombre\);/.test(cuerpo(MOTOR, 'cargarPatron')) && /setParam\(PARAMS, id, vz\.params\[id\], "manual"\)/.test(MOTOR) && !/aplicarVozPatron|VOZ_PATRON/.test(cuerpo(MOTOR, 'alPasoReloj')),
    'la voz se aplica al cargar el patrón (gesto), nunca en el bucle del reloj'); }

console.log('\n(h) layout del atril BA-40');
{ const M = B.MODULOS_B, P = B.POSICIONES_B, mal = [];
  for (const m of M) if (!S.dentro(m.rect, S.PANEL)) mal.push('módulo fuera ' + m.id);
  for (let i = 0; i < M.length; i++) for (let j = i + 1; j < M.length; j++) if (S.seSuperponen(M[i].rect, M[j].rect)) mal.push(M[i].id + '↔' + M[j].id);
  for (const p of P) if (!S.dentro(B.huellaB(p), B.moduloB(p.modulo).rect)) mal.push('fuera ' + p.id);
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (S.seSuperponen(B.huellaB(P[i]), B.huellaB(P[j]))) mal.push(P[i].id + '↔' + P[j].id);
  const vu = B.rectVuB(); if (!S.dentro(vu, B.moduloB('salida').rect)) mal.push('VU fuera'); for (const p of P) if (S.seSuperponen(vu, B.huellaB(p))) mal.push('VU↔' + p.id);
  // Z100: + 2 de CARA (CARA ON y CALIBRAR); los medidores y la luz se prueban en scripts/cara-test.mjs
  check(P.length === 16 * 4 + 8 + 2 + 8 + 2 + 2 && mal.length === 0, `${P.length} controles (64 de SECUENCIA, 8 de PATRÓN (Z102: 7 + LIMPIO), 10 de VOZ, 2 de SALIDA, 2 de CARA) y el VU: dentro del panel, sin colisiones${mal.length ? ': ' + mal.slice(0, 6).join(', ') : ''}`);
  const cols = [0, 1, 2, 3].map(f => P.filter(p => p.modulo === 'secuencia').slice(f).filter((_, i) => i % 4 === 0).map(p => p.u.toFixed(4)).join());
  check(cols.every(c => c === cols[0]), 'las 4 filas de la SECUENCIA (NOTA, ACENTO, DESLIZ, PASO) alineadas en las mismas 16 columnas');
  for (const esc of [0.7, 1, 1.15]) {
    const T = B.textosB(esc), m2 = [];
    for (const t of T) {
      const r = S.rectTexto(t);
      const m = t.fila === 'display' ? B.moduloB('display') : M.find(mm => t.id === `t_${mm.id}` || t.id === `g_${mm.id}`) ?? (/^[fn]_/.test(t.id) ? B.moduloB('secuencia') : /^(m_cara|e_cara_det)/.test(t.id) ? B.moduloB('cara') : B.moduloB(B.posB(t.id.slice(2))?.modulo ?? 'salida'));   // Z100: textos de CARA
      if (!S.dentro(r, m.rect)) m2.push(t.id + ' fuera de ' + m.id);
      if (t.fila === 'display' && r.u1 > B.DISPLAY_TEXTO_U1) m2.push(t.id + ' sobre la curva');
      for (const p of P) if (S.seSuperponen(r, B.huellaB(p))) m2.push(t.id + '↔' + p.id);
      if (S.seSuperponen(r, vu)) m2.push(t.id + '↔VU');
    }
    for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) if (S.seSuperponen(S.rectTexto(T[i]), S.rectTexto(T[j]))) m2.push(T[i].id + '↔' + T[j].id);
    check(m2.length === 0, `ETIQUETA_ESCALA ${esc}: ningún texto cortado, fuera de su módulo o encimado${m2.length ? ': ' + m2.slice(0, 5).join(', ') : ''}`);
  }
  const g = S.GEO_DEFECTO;
  for (const [nom, a] of [['16:10', 1.6], ['16:9', 16 / 9]]) {
    const p = B.buscarPoseBajo(g, a, S.escalaEfectiva(1, true, a));
    check(!!p && p.pasada < 3 && p.legible >= S.LEGIBLE_MIN, `${nom}: cámara del modo atril fov ${p?.fov}° h ${p?.height.toFixed(2)} d ${p?.dist.toFixed(2)} pitch ${p?.pitch}° → texto más lejano ${(100 * (p?.legible ?? 0)).toFixed(2)} %`);
  }
  check(/legibilidadMinimaB\(geoAtril\(\), cp, escalaEfectiva\(DBG_ATRIL_BAJO\.ETIQUETA_ESCALA/.test(LS) && /const conPasadas = nuevoSonido \|\| imagenPanel \|\| esBajo( \|\| esSinte)?( \|\| esSampler)?;/   /* Z101: + SY-40 */.test(LS),
    'fitLecternCamera: el BA-40 busca como el de sonido y exige legibilidadMinimaB');
  check(B.TEXTO_PLACA_B("IN-GO'S WAN INC.") === "BAJO ÁCIDO BA-40 · IN-GO'S WAN INC. · SINTETIZADOR DE BAJO · 4 MÓDULOS" && B.LEYENDA_FILAS_B === '1 SECUENCIA · 2 VOZ · 3 SALIDA · 4 CARA', 'placa y leyenda (Z100: 4 módulos, + 4 CARA)'); }

console.log('\n(i) sin allocations en el reloj y en el dibujo del display');
{ const reloj = ['alPasoReloj', 'oyenteNucleo', 'nota', 'soltar', 'envFiltro', 'cancelarYMantener'].map(n => cuerpo(MOTOR, n)).join('\n');
  const puros = ['pasosEnVentana', 'eventoPaso', 'pasoSonando', 'nivelNota', 'aperturaNota', 'corteConEnvolvente'].map(n => cuerpo(PURO, n)).join('\n');
  const dib = ['dibujarDisplayBajo', 'trazarCurva', 'calcularCurvas'].map(n => cuerpo(COMP, n)).join('\n');
  const prohibido = /new |`|\[\s*\]|\[\s*[\w.]+\s*,|\.map\(|\.slice\(|\.filter\(|\.concat\(|\{\s*\.\.\./;
  check(reloj.length > 800 && !prohibido.test(sinComentarios(reloj)), 'bucle del reloj (oyente, notas, envolventes): sin new, template strings ni arreglos u objetos nuevos');
  check(puros.length > 800 && !prohibido.test(sinComentarios(puros)), 'funciones puras del bucle (ventana, evento, paso que suena, acento): sin allocations');
  check(dib.length > 600 && !prohibido.test(sinComentarios(dib)), 'dibujo del display (texto y curva del filtro): sin new, template strings ni arreglos nuevos');
  check(/const _k = new Int32Array\(8\), _t = new Float64Array\(8\), _tiempos = new Float64Array\(N_PASOS\)/.test(MOTOR) && /const _curva = new Float32Array\(N_CURVA\), _curvaPico = new Float32Array\(N_CURVA\);/.test(COMP),
    'arreglos preasignados a nivel de módulo (pasos, tiempos y curvas)');
  check(/if \(u\.ver !== BAJO\.version( \|\| u\.vc !== BAJO\.versionCara)?\) calcularCurvas\(\);/.test(COMP)   /* Z100: también con la cara */ && /if \(!tocaActualizar\(ahora, u\.ms, DBG_ATRIL_BAJO\.VU_HZ\)\) return;[\s\S]*?if \(!enPantalla\(g, camera\)\) return;/.test(COMP),
    'el display se redibuja solo si algo cambió, ≤ VU_HZ y con el atril en pantalla; la curva solo cuando cambian los parámetros');
  check(/const curvaSaturacion|function curvaSaturacion/.test(MOTOR) && /shaper\.curve = curvaSaturacion\(\);/.test(cuerpo(MOTOR, 'crearVoz')), 'la curva de distorsión se calcula una vez, al crear la voz');
  check(/osc\.start\(\);/.test(cuerpo(MOTOR, 'crearVoz')) && !/createOscillator|createGain|createBiquadFilter/.test(reloj), 'una sola voz: los nodos se crean al armarla, nunca por nota'); }

console.log('\n(j) limpieza');
{ const lib = cuerpo(MOTOR, 'liberarBajo'), voz = cuerpo(MOTOR, 'liberarVoz'), prop = cuerpo(MOTOR, 'pararRelojPropio');
  check(/_desuscribir\?\.\(\); _desuscribir = null;/.test(lib) && /pararRelojPropio\(\);/.test(lib) && /liberarVoz\(\);/.test(lib), 'liberarBajo: se desuscribe del reloj, para el reloj propio y libera la voz');
  check(/clearInterval\(_motorPropio\)/.test(prop) && /detener\(_relojPropio\)/.test(prop), 'el temporizador del reloj propio se cancela');
  check(/v\.osc\.stop\(\)/.test(voz) && /n\.disconnect\(\)/.test(voz) && /v\.analizador/.test(voz), 'la voz: el oscilador se detiene y se desconectan todos los nodos (incluido el analizador del VU)');
  check(/const limpiar = instalarBajo\(\);[\s\S]{0,80}return \(\) => \{ (liberarCara\(\); )?limpiar\(\); ATRIL_BAJO\.visible = false; \};/.test(LS)   /* Z100: antes libera la cara */, 'el atril instala el motor al montar y lo libera al desmontar');
  check(/useEffect\(\(\) => \(\) => \{ r\.tex\.dispose\(\); r\.mat\.dispose\(\); r\.geo\.dispose\(\); r\.marcoGeo\.dispose\(\); r\.marcoMat\.dispose\(\); \}, \[r\]\);/.test(COMP), 'el display libera textura, material y geometrías');
  check(/on\.connect\(entradaBus\(\)\)/.test(MOTOR) && !/vizAudio/.test(sinComentarios(MOTOR)) && !/obtenerSalidaTransmisible/.test(sinComentarios(MOTOR)), 'la salida entra al bus maestro (se escucha, la analiza el visualizador y viaja a SILLAS); SILLAS y la transmisión no se tocan'); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
