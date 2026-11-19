// Z101: SINTETIZADOR SY-40. (a) frecuencia; (b) asignación de voces y robo (también con el motor real sobre un
// AudioContext simulado: nunca crea nodos por nota); (c) arpegiador con reloj simulado (orden, tiempos, octavas, pasos,
// silencio, caja parada); (d) eco desde el BPM; (e) sonidos de fábrica; (f) teclado de la computadora; (g) setParamSinte
// con "manual" y una cara simulada; (h) layout, legibilidad y pose (poseInstrumento(−1)); (i) sin allocations; (j)
// limpieza. Uso: node scripts/sinte-test.mjs
import fs from 'node:fs';
import { register } from 'node:module';
const RAIZ = new URL('../', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`const R = ${JSON.stringify(RAIZ)};
export async function resolve(s, c, n) {
  if (s.startsWith('@/')) s = R + s.slice(2);
  if ((/^\\.\\.?\\//.test(s) || s.startsWith('file:')) && !/\\.[a-z]+$/.test(s)) { try { return await n(s + '.ts', c); } catch {} }
  return n(s, c);
}`));

// ── AudioContext simulado: cuenta nodos creados, conexiones, stops y desconexiones ──
const CUENTA = { osc: 0, gain: 0, biquad: 0, delay: 0, analyser: 0, source: 0, shaper: 0, stop: 0, disconnect: 0, start: 0 };
class Param { constructor(v = 0) { this.value = v; this.eventos = 0; }
  setTargetAtTime() { this.eventos++; return this; } setValueAtTime() { this.eventos++; return this; } linearRampToValueAtTime() { this.eventos++; return this; }
  exponentialRampToValueAtTime() { this.eventos++; return this; } cancelScheduledValues() { return this; } cancelAndHoldAtTime() { return this; } }
class Nodo { constructor(tipo) { this.tipo = tipo; this.conexiones = 0; } connect(x) { this.conexiones++; return x; } disconnect() { CUENTA.disconnect++; } }
class Fuente extends Nodo { start() { CUENTA.start++; } stop() { CUENTA.stop++; } }
class Ctx {
  constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 48000; this.destination = new Nodo('dest'); }
  resume() { return Promise.resolve(); }
  createOscillator() { CUENTA.osc++; const o = new Fuente('osc'); o.type = 'sine'; o.frequency = new Param(440); o.detune = new Param(0); return o; }
  createGain() { CUENTA.gain++; const g = new Nodo('gain'); g.gain = new Param(1); return g; }
  createBiquadFilter() { CUENTA.biquad++; const f = new Nodo('biquad'); f.type = 'lowpass'; f.frequency = new Param(350); f.Q = new Param(1); f.detune = new Param(0); return f; }
  createDelay() { CUENTA.delay++; const d = new Nodo('delay'); d.delayTime = new Param(0); return d; }
  createAnalyser() { CUENTA.analyser++; const a = new Nodo('analyser'); a.fftSize = 2048; return a; }
  createWaveShaper() { CUENTA.shaper++; const w = new Nodo('shaper'); w.curve = null; w.oversample = 'none'; return w; }
  createBuffer(_c, len) { const d = new Float32Array(len); return { getChannelData: () => d }; }
  createBufferSource() { CUENTA.source++; const s = new Fuente('source'); s.buffer = null; s.loop = false; return s; }
}
globalThis.AudioContext = Ctx;
globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };

const L = await import('../lib/sinte.ts');
const R = await import('../lib/audio/reloj.ts');
const Y = await import('../lib/atrilSinte.ts');
const S = await import('../lib/atrilSonido.ts');
const POSE = await import('../lib/instrumentosPose.ts');
const N = await import('../lib/audio/nucleo.ts');
const RM = await import('../lib/ritmosMotor.ts');
const M = await import('../lib/audio/sinte.ts');
const { DBG_SINTE: CS, DBG_ATRIL_SINTE: CA, DBG_RITMOS } = await import('../lib/debugConfig.ts');

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const sinCom = t => t.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const PURO = leer('../lib/sinte.ts'), MOTOR = leer('../lib/audio/sinte.ts'), COMP = leer('../components/AtrilSinteNuevo.tsx');
const LS = leer('../components/LecternSystem.tsx'), TS = leer('../components/ThreeScene.tsx'), CFG = leer('../lib/debugConfig.ts');
const POSE_SRC = leer('../lib/instrumentosPose.ts'), CKA = leer('../lib/checkpointsAcciones.ts'), CK = leer('../lib/checkpoints.ts'), CONS = leer('../lib/consentTarimaAcciones.ts');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const cerca = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const f = (v, n = 3) => Number(v).toFixed(n).replace('.', ',');
const cuerpo = (src, n) => { const i = src.search(new RegExp(`(function ${n}\\(|const ${n} = )`)); return i < 0 ? '' : src.slice(i, src.indexOf('\n}', i) + 2); };
const cuerpoFlecha = (src, n) => { const i = src.search(new RegExp(`const ${n} = \\(`)); return i < 0 ? '' : src.slice(i, src.indexOf('\n};', i) + 3); };

console.log('\nconstantes y estructura');
check(!/^import /m.test(PURO), 'lib/sinte.ts sin imports (lógica pura)');
for (const k of ['SINTE_VOCES', 'SINTE_MIDI', 'LOOKAHEAD_S', 'CORTE_MIN', 'CORTE_MAX', 'RES_MAX', 'ENV_OCTAVAS', 'ECO_REALIM_MAX', 'ARP_SEMILLA', 'CORTE', 'RESONANCIA', 'ATAQUE', 'RELEASE', 'F_ATAQUE', 'LFO_VELOCIDAD', 'ECO_MEZCLA', 'VOLUMEN'])
  check(new RegExp(`export const DBG_SINTE = \\{[\\s\\S]*?\\n  ${k}:`).test(CFG), `DBG_SINTE.${k} = ${JSON.stringify(CS[k])}`);
for (const k of ['ETIQUETA_ESCALA', 'ETIQUETA_AUTO_ASPECTO', 'DISPLAY_VALOR_S', 'VU_HZ', 'ROTULOS_FILA', 'ROTULOS_MODO'])
  check(new RegExp(`export const DBG_ATRIL_SINTE = \\{[\\s\\S]*?\\n  ${k}:`).test(CFG), `DBG_ATRIL_SINTE.${k} = ${JSON.stringify(CA[k])}`);
check(CS.SINTE_VOCES === 6 && CS.SINTE_MIDI === false && CS.ECO_REALIM_MAX === 0.85, 'por defecto: 6 voces, MIDI apagado (no pide permisos), realimentación del eco ≤ 0,85');
check(L.PARAMS_SINTE.every(d => typeof CS[d.clave] === 'number' && CS[d.clave] >= d.min && CS[d.clave] <= d.max), 'cada parámetro tiene su valor por defecto en DBG_SINTE, dentro de su rango');

console.log('\n(a) frecuencia de las notas');
check(L.midiAFrecuencia(69) === 440, 'La4 (69) = 440 Hz');
check(cerca(L.midiAFrecuencia(81), 880) && cerca(L.midiAFrecuencia(57), 220) && cerca(L.midiAFrecuencia(93), 1760), 'la octava duplica: 81 → 880 Hz, 57 → 220 Hz, 93 → 1760 Hz');
check(cerca(L.midiAFrecuencia(60), 261.6255653, 1e-6) && L.nombreNota(60) === 'DO4' && L.nombreNota(61) === 'DO#4' && L.notaBase(4) === 60, 'DO4 (60) = 261,63 Hz; nombres en español ("DO4", "DO#4"); la tecla DO de la octava 4 es MIDI 60');
check(/frecuencia = 440 × 2\^\(\(nota − 69\) \/ 12\)/.test(PURO), 'la fórmula está comentada en el código');

console.log('\n(b) asignación de voces');
{ const v = L.crearVoces(6); let t = 0, malo = '';
  const asignadas = [];
  for (let n = 60; n < 66; n++) { asignadas.push(L.asignarVoz(v, n, t)); t += 0.1; }
  check(new Set(asignadas).size === 6 && v.robos === 0 && L.vocesActivas(v, t) === 6, '6 notas → 6 voces distintas, sin robo');
  const r7 = L.asignarVoz(v, 66, t);
  check(r7 === asignadas[0] && v.robada && v.robos === 1, 'la 7.ª nota (todas sonando) roba la MÁS ANTIGUA (la de DO4)');
  L.liberarNota(v, 63, t + 0.05, 0.5);
  const r8 = L.asignarVoz(v, 67, t + 0.1);
  check(r8 === asignadas[3] && !v.robada, 'con una voz en liberación, la nota nueva toma ESA (no roba una que suena)');
  const dup = L.asignarVoz(v, 64, t + 0.2);
  check(dup === asignadas[4] && Array.from(v.nota).filter(x => x === 64).length === 1, 'la misma tecla otra vez re-dispara su voz: nunca dos voces con la misma nota');
  check(L.liberarNota(v, 64, t + 0.3, 0.2) === asignadas[4] && v.estado[asignadas[4]] === L.V_LIBERANDO && L.liberarNota(v, 64, t + 0.3, 0.2) === -1, 'al soltar, la voz pasa a liberación (y soltar dos veces no hace nada)');
  check(L.vocesActivas(v, t + 0.3) === 6 && L.vocesActivas(v, t + 0.6) === 5, 'la voz en liberación cuenta hasta que termina su release y después queda libre');
  // muchas notas seguidas: el índice siempre está en 0…5
  for (let i = 0; i < 500; i++) { const k = L.asignarVoz(v, 30 + (i % 50), 10 + i * 0.01); if (k < 0 || k > 5) malo = 'índice ' + k; if (i % 3) L.liberarNota(v, 30 + (i % 50), 10 + i * 0.01 + 0.005, 0.05); }
  check(!malo, '500 notas con más notas que voces: siempre una de las 6 voces fijas'); }
// motor real sobre el AudioContext simulado
{ M.silenciarYReiniciarSinte();
  RM.RITMOS.sonando = false; CS.ARP_ON = false;
  const limpiar = M.instalarSinte();
  const antes = { ...CUENTA };
  M.notaAbajo(60);   // primer gesto: nace el grafo
  const g = { osc: CUENTA.osc - antes.osc, gain: CUENTA.gain - antes.gain, biquad: CUENTA.biquad - antes.biquad, delay: CUENTA.delay - antes.delay };
  check(M.SINTE.listo && g.osc === 3 * CS.SINTE_VOCES + 1 && g.delay === 1 && g.biquad === CS.SINTE_VOCES + 1,
    `el grafo nace con la primera nota: ${g.osc} osciladores (3 por voz × ${CS.SINTE_VOCES} + 1 LFO compartido), ${g.biquad} filtros (uno por voz + el del lazo del eco), 1 retardo compartido`);
  const n0 = { ...CUENTA };
  for (let i = 0; i < 40; i++) { M.notaAbajo(48 + i); if (i % 2) M.notaArriba(48 + i - 1); }
  M.soltarTodasSinte();
  check(CUENTA.osc === n0.osc && CUENTA.gain === n0.gain && CUENTA.biquad === n0.biquad && CUENTA.source === n0.source && CUENTA.delay === n0.delay,
    '40 notas más (con robos): ningún nodo nuevo (voces preasignadas)');
  check(M.SINTE.robos > 0 && M.MANTENIDAS.n === 0, `hubo robos de voz (${M.SINTE.robos}) y al soltar todo no queda ninguna tecla mantenida`);
  limpiar(); }

console.log('\n(c) arpegiador');
{ const m = L.crearMantenidas(); for (const n of [67, 60, 64]) L.pulsar(m, n);
  const out = new Int16Array(64), tmp = new Int16Array(16);
  const sec = (oct, pat) => Array.from(out.slice(0, L.secuenciaArp(m, oct, pat, out, tmp)));
  check(sec(1, 0).join() === '60,64,67', 'ARRIBA: grave → agudo (DO MI SOL), sin importar el orden en que se apretaron');
  check(sec(1, 1).join() === '67,64,60', 'ABAJO: agudo → grave');
  check(sec(1, 2).join() === '60,64,67,64', 'IDA Y VUELTA: sube y baja sin repetir los extremos');
  check(sec(2, 0).join() === '60,64,67,72,76,79' && sec(3, 0).length === 9 && sec(3, 0)[8] === 91 && sec(2, 2).join() === '60,64,67,72,76,79,76,72,67,64',
    'OCTAVAS 1…3: el acorde se repite una y dos octavas arriba (ARRIBA ×2: DO4…SOL5; ×3: 9 notas hasta SOL6)');
  const a1 = L.crearArp(0xA21), a2 = L.crearArp(0xA21), a3 = L.crearArp(7), s9 = sec(2, 3);
  const z1 = [], z2 = [], z3 = [];
  for (let i = 0; i < 64; i++) { z1.push(L.siguienteNotaArp(a1, 3, out, s9.length)); z2.push(L.siguienteNotaArp(a2, 3, out, s9.length)); z3.push(L.siguienteNotaArp(a3, 3, out, s9.length)); }
  check(z1.join() === z2.join() && z1.join() !== z3.join() && z1.every(n => s9.includes(n)) && new Set(z1).size === s9.length,
    `AZAR determinista: la misma semilla da la misma secuencia (${z1.slice(0, 8).join(' ')}…), otra semilla otra; usa todas las notas del acorde`);
  L.reiniciarArp(a1); const r1 = []; for (let i = 0; i < 8; i++) r1.push(L.siguienteNotaArp(a1, 3, out, s9.length));
  check(r1.join() === z1.slice(0, 8).join(), 'al soltar todo (reiniciarArp) AZAR vuelve a empezar desde la semilla');
  const ar = L.crearArp(1), seq = []; const n4 = L.secuenciaArp(m, 1, 0, out, tmp);
  for (let i = 0; i < 7; i++) seq.push(L.siguienteNotaArp(ar, 0, out, n4));
  check(seq.join() === '60,64,67,60,64,67,60', 'ARRIBA en bucle: DO MI SOL DO MI SOL DO');
  const vacia = L.crearMantenidas();
  check(L.secuenciaArp(vacia, 2, 0, out, tmp) === 0 && L.siguienteNotaArp(ar, 0, out, 0) === -1, 'sin teclas: secuencia vacía y ninguna nota (silencio)');
  check(L.pulsar(m, 64) === false && L.soltarMantenida(m, 64) && L.soltarMantenida(m, 60) && L.soltarMantenida(m, 67) && m.n === 0, 'notas mantenidas: sin duplicados; al soltar todas queda vacío');
  // tiempos con el reloj simulado: 8, 12, 16 y 32 pasos de la caja, BPM 60…180, 1/16, 1/8 y 1/4
  let todoOk = true, detalle = '', casos = 0;
  for (const nR of [8, 12, 16, 32]) for (const bpm of [60, 90, 124, 150, 180]) for (const [iv, sc] of [[0, 1], [1, 2], [2, 4]]) {
    const r = R.crearReloj(bpm, nR, nR / 4), tt = new Float64Array(8), ev = [];
    R.suscribir(r, (paso, t, _c, d) => { const c = L.pasosArpEnVentana(paso, nR, t, d, sc, tt); for (let i = 0; i < c; i++) ev.push(tt[i]); });
    R.iniciar(r, 0, 0.05);
    let ahora = 0, k = 0;
    while (ahora < 8.2 * 60 / bpm) { R.programar(r, ahora, 0.1); ahora += 0.016 + ((k++ * 7919) % 25) / 1000; }
    const dur = 60 / bpm / 4 * sc, esperados = Math.floor((ev[ev.length - 1] - 0.05) / dur + 1e-6) + 1;
    let bien = ev.length === esperados && cerca(ev[0], 0.05, 1e-9);
    for (let i = 1; i < ev.length && bien; i++) if (!cerca(ev[i] - ev[i - 1], dur, 1e-9)) bien = false;
    bien = bien && cerca(L.durPasoArp(bpm, sc), dur, 1e-12);
    casos++;
    if (!bien) { todoOk = false; detalle = `${nR} pasos, ${bpm} BPM, ${L.VELOCIDADES_ARP[iv]}: ${ev.length} vs ${esperados}`; }
  }
  check(todoOk, `tiempos exactos en ${casos} casos (caja de 8/12/16/32 pasos × 60…180 BPM × 1/16, 1/8, 1/4; despertares irregulares): un paso cada 60/BPM/4 × semicorcheas, ninguno perdido ni repetido${detalle ? ' — ' + detalle : ''}`);
  const tt = new Float64Array(8);
  check(L.pasosArpEnVentana(0, 16, 1, 0.125, 4, tt) === 1 && L.pasosArpEnVentana(1, 16, 1, 0.125, 4, tt) === 0 && L.pasosArpEnVentana(4, 16, 1, 0.125, 4, tt) === 1 && L.pasosArpEnVentana(0, 8, 2, 0.25, 1, tt) === 2 && cerca(tt[1], 2.125),
    'alineado al compás: 1/4 cae en las semicorcheas 0, 4, 8, 12; con una caja de 8 pasos, 1/16 da dos pasos por paso del reloj'); }
// motor real: arpegio solo con la caja sonando; silencio al soltar
{ M.silenciarYReiniciarSinte();
  const limpiar = M.instalarSinte();
  const ctx = N.obtenerContexto();
  CS.ARP_ON = true; CS.ARP_VELOCIDAD = 0; CS.ARP_PATRON = 0; CS.ARP_OCTAVAS = 1; DBG_RITMOS.BPM = 120;
  RM.RITMOS.sonando = false; M.tickSinte();
  let n0 = M.SINTE.notas;
  for (const n of [60, 64, 67]) M.notaAbajo(n);
  check(M.SINTE.notas - n0 === 3 && !M.SINTE.arpActivo, 'arpegiador ON con la caja PARADA: las 3 teclas suenan normales (y se sostienen)');
  RM.RITMOS.sonando = true; M.tickSinte();
  check(M.SINTE.arpActivo && M.VOCES.estado.every(e => e !== 1), 'play en la caja: el arpegiador toma las teclas (las voces sostenidas pasan a liberación)');
  R.iniciar(N.RELOJ, ctx.currentTime, 0.05);
  n0 = M.SINTE.notas;
  const bar = 60 / 120 * 4;
  for (let t = 0; t < bar - 0.02; t += 0.02) { ctx.currentTime = t; R.programar(N.RELOJ, t, 0.1); }
  const enUnCompas = M.SINTE.notas - n0;
  check(enUnCompas === 16 || enUnCompas === 17, `un compás a 120 BPM en 1/16: ${enUnCompas} notas del arpegio (16 por compás; la anticipación puede adelantar la primera del siguiente)`);
  M.soltarTodasSinte();
  const n1 = M.SINTE.notas;
  for (let t = bar; t < 2 * bar; t += 0.02) { ctx.currentTime = t; R.programar(N.RELOJ, t, 0.1); }
  check(M.SINTE.notas === n1 && M.ARP.pos === 0, 'al soltar todas las teclas el arpegio se calla y vuelve a su primer paso');
  M.notaAbajo(62); RM.RITMOS.sonando = false; M.tickSinte();
  const n2 = M.SINTE.notas;
  for (let t = 2 * bar; t < 3 * bar; t += 0.02) { ctx.currentTime = t; R.programar(N.RELOJ, t, 0.1); }
  check(!M.SINTE.arpActivo && M.SINTE.notas === n2, 'la caja para: nada de arpegio (la tecla mantenida pasa a sonar sostenida)');
  M.soltarTodasSinte(); R.detener(N.RELOJ); CS.ARP_ON = false; limpiar(); }

console.log('\n(d) eco desde el BPM');
check(cerca(L.tiempoEcoS(120, 0), 0.25) && cerca(L.tiempoEcoS(120, 1), 0.5) && cerca(L.tiempoEcoS(120, 2), 0.75), '120 BPM: 1/8 = 0,25 s, 1/4 = 0,5 s, 1/4 con puntillo = 0,75 s');
check(cerca(L.tiempoEcoS(60, 2), 1.5) && cerca(L.tiempoEcoS(180, 0), 1 / 6) && cerca(L.tiempoEcoS(90, 1), 2 / 3), '60 BPM 1/4. = 1,5 s; 180 BPM 1/8 = 0,167 s; 90 BPM 1/4 = 0,667 s');
check(L.tiempoEcoS(20, 2, 2) === 2 && L.tiempoEcoS(NaN, 1) === 0.5, 'tope ECO_MAX_S (2 s) y BPM inválido → 120');
check(L.realimAcotada(2) === 0.85 && L.realimAcotada(-1) === 0 && L.realimAcotada(0.5, 0.3) === 0.3 && L.realimAcotada(0.9, 5) === 0.85 && L.realimAcotada(NaN) === 0,
  'realimentación acotada: nunca más de 0,85 (aunque se pida más), nunca negativa');
check(L.PARAMS_SINTE[L.P.ecoRealim].max === 0.85 && /realimAcotada\(v\(P\.ecoRealim\), DBG_SINTE\.ECO_REALIM_MAX\)/.test(MOTOR) && /g\.lazo\.frequency\.setTargetAtTime/.test(MOTOR),
  'el motor aplica la realimentación acotada y el filtro suave del lazo; la perilla REALIM. llega a 0,85');

console.log('\n(e) sonidos de fábrica');
check(L.NOMBRES_SONIDO.join() === 'PAD,LEAD,PLUCK,BRASS,ORGANO,CAMPANA', 'los 6: PAD, LEAD, PLUCK, BRASS, ÓRGANO, CAMPANA');
for (const nm of L.NOMBRES_SONIDO) {
  const s = L.SONIDOS[nm], malos = [];
  for (const d of L.PARAMS_SINTE) {
    if (d.id === 'volumen') { if (d.id in s) malos.push('volumen'); continue; }
    const v = s[d.id];
    if (typeof v !== 'number' || v < d.min || v > d.max || (d.curva === 'paso' && v !== Math.round(v))) malos.push(`${d.id}=${v}`);
  }
  for (const k of Object.keys(s)) if (L.indiceParam(k) < 0) malos.push('desconocido ' + k);
  check(malos.length === 0, `${L.nombreSonido(nm)}: los ${Object.keys(s).length} parámetros dentro de su rango${malos.length ? ': ' + malos.join(', ') : ''}`);
}
{ const S2 = L.SONIDOS;
  check(S2.PAD.ataque >= 0.5 && S2.PAD.release >= 1.5 && S2.PLUCK.ataque <= 0.005 && S2.PLUCK.decay <= 0.3 && S2.PLUCK.sostenido === 0 && S2.LEAD.onda1 === 2 && S2.LEAD.lfoDestino === 0 && S2.LEAD.lfoProf > 0
    && S2.BRASS.ataque >= 0.05 && S2.BRASS.ataque <= 0.2 && S2.BRASS.modEnv >= 0.5 && S2.ORGANO.onda1 === 0 && S2.ORGANO.onda2 === 0 && S2.ORGANO.sub > 0.3 && S2.ORGANO.sostenido === 1
    && S2.CAMPANA.onda1 === 1 && S2.CAMPANA.onda2 === 1 && S2.CAMPANA.desafine >= 20 && S2.CAMPANA.ecoMezcla > 0.3,
    'carácter pedido: PAD lento y largo, LEAD sierra con vibrato, PLUCK instantáneo y corto, BRASS ataque medio y barrido, ÓRGANO dos senos con sub y sostenido lleno, CAMPANA triángulos desafinados con eco'); }
{ const st = L.crearParams(); L.cargarSonido(st, 'BRASS');
  check(!L.sonidoEditado(st, 'BRASS'), 'recién cargado: no está EDITADO');
  L.setParam(st, 'corte', 900, 'manual');
  check(L.sonidoEditado(st, 'BRASS'), 'al tocar una perilla: EDITADO');
  L.setParam(st, 'corte', L.SONIDOS.BRASS.corte, 'manual'); L.setParam(st, 'volumen', 0.2, 'manual');
  check(!L.sonidoEditado(st, 'BRASS'), 'volver al valor del sonido (doble clic) le saca el EDITADO; VOLUMEN no cuenta como edición');
  check(/EDITADO/.test(L.lineaSinte1('PAD', true, true, 0, 124)) && L.lineaSinte1('ORGANO', false, false, 0, 100) === 'ÓRGANO · ARP OFF · 100 BPM' && L.lineaSinte1('CAMPANA', true, true, 2, 180).length <= Y.DISPLAY_CHARS_Y[0],
    `línea 1 del display: "${L.lineaSinte1('PAD', true, true, 0, 124)}" (la más larga entra en ${Y.DISPLAY_CHARS_Y[0]} caracteres)`);
  check(L.lineaSinte2Reposo(4, false).length <= Y.DISPLAY_CHARS_Y[1] && /PLAY/.test(L.lineaSinte2Reposo(4, true)), `línea 2 en reposo: "${L.lineaSinte2Reposo(4, false)}" (octava y teclas); con el arpegiador esperando, pide el play`); }

console.log('\n(f) teclado de la computadora');
{ const codes = L.TECLAS_PIANO.map(t => t[0]), semis = L.TECLAS_PIANO.map(t => t[1]);
  check(new Set(codes).size === codes.length && semis.every((s, i) => s === i), `${codes.length} teclas sin repetidos, semitonos 0…${semis.length - 1} en orden (DO a RE de la octava siguiente)`);
  const prohibidas = ['KeyE', 'KeyQ', 'KeyX', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Digit1', 'Digit2', 'Digit3', 'Digit4'];
  check(prohibidas.every(k => !codes.includes(k)) && L.TECLAS_RESERVADAS.every(k => !codes.includes(k)), 'ningún choque: ni E, Q, X, WASD, los atajos Z…M ni 1…4 (terminal)');
  const negras = [1, 3, 6, 8, 10, 13];
  check(L.TECLAS_PIANO.filter(([, s]) => negras.includes(s)).every(([c]) => c.startsWith('Digit') || c === 'Equal') && L.TECLAS_PIANO.filter(([, s]) => !negras.includes(s)).every(([c]) => c.startsWith('Key') || c.startsWith('Bracket')),
    'dos filas como un piano: blancas en R T Y U I O P [ ], negras en 5 6 8 9 0 =');
  const k = L.crearTecladoPc();
  check(L.teclaAbajo(k, 'KeyR', false) === 0 && L.teclaAbajo(k, 'KeyR', true) === -1 && L.teclaAbajo(k, 'KeyR', false) === -1 && L.teclaArriba(k, 'KeyR') === 0 && L.teclaArriba(k, 'KeyR') === -1 && L.teclaAbajo(k, 'KeyR', false) === 0,
    'sin autorepetición: mantener R da UNA nota (repeat o tecla ya abajo → nada); soltarla la libera; se puede volver a tocar');
  check(L.teclaAbajo(k, 'KeyE', false) === -1 && L.teclaAbajo(k, 'KeyQ', false) === -1 && L.teclaAbajo(k, 'KeyX', false) === -1, 'E, Q y X no son notas');
  check(/const KEY_LETTERS = \["z","x","c","v","b","n","m"\] as const;/.test(LS) && /if \(INTERACT_STATE\.mode === "synth"\) return;   \/\/ Z101/.test(LS)
    && /INTERACT_STATE\.mode === "image" \|\| INTERACT_STATE\.mode === "sound" \|\| INTERACT_STATE\.mode === "bass"\) return;/.test(CONS),
    'en el modo del SY-40 se desactivan solo los atajos Z…M (el teclado es el piano); X sigue cortando la transmisión (el consentimiento no cambió)');
  check(/if \(INTERACT_STATE\.mode !== "synth" \|\| e\.altKey \|\| e\.ctrlKey \|\| e\.metaKey\) return;/.test(COMP) && /teclaAbajo\(k, e\.code, e\.repeat\)/.test(COMP) && /window\.addEventListener\("blur", soltarTodo\)/.test(COMP),
    'el piano solo suena en el modo atril del SY-40, usa e.code (posición física) y suelta todo al perder el foco');
  const mm = { nota: 0, on: false };
  check(L.leerMidi(0x90, 60, 100, mm) === 60 && mm.on && L.leerMidi(0x80, 60, 0, mm) === 60 && !mm.on && L.leerMidi(0x93, 62, 0, mm) === 62 && !mm.on && L.leerMidi(0xB0, 1, 64, mm) === -1,
    'MIDI: note-on, note-off, note-on con velocidad 0 = off, cualquier canal; los controles se ignoran'); }

console.log('\n(g) setParamSinte: manual y cara simulada');
{ const st = L.crearParams();
  check(L.setParam(st, 'corte', 99999, 'manual') && L.valorParam(st, 'corte') === 12000 && L.setParam(st, 'corte', 1, 'manual') && L.valorParam(st, 'corte') === 40, 'manual: acota al rango (CORTE 40…12000 Hz)');
  check(L.setParam(st, 'onda1', 2.6, 'manual') && L.valorParam(st, 'onda1') === 3 && !L.setParam(st, 'nada', 1, 'manual') && !L.setParam(st, 'corte', NaN, 'manual'), 'selectores enteros; id desconocido o NaN: no hace nada');
  L.setParam(st, 'corte', 800, 'manual');
  check(!L.setParam(st, 'corte', 1, 'cara') && L.valorParam(st, 'corte') === 800, 'con la cara apagada, la fuente "cara" no hace nada');
  L.activarCara(st, true);
  check(L.setParam(st, 'corte', 1, 'cara') && L.valorParam(st, 'corte') === 12000 && st.manual[L.P.corte] === 800, 'cara activa: 0…1 normalizado → 12000 Hz, sin pisar el manual (800)');
  L.setParam(st, 'corte', 0.5, 'cara');
  check(cerca(L.valorParam(st, 'corte'), Math.sqrt(40 * 12000), 1e-6), 'CORTE con curva exponencial: 0,5 → media geométrica (693 Hz)');
  check(!L.setParam(st, 'ataque', 0.5, 'cara') && !L.setParam(st, 'onda1', 1, 'cara') && L.setParam(st, 'ecoMezcla', 7, 'cara') && L.valorParam(st, 'ecoMezcla') === 1, 'solo los modulables; acota a [0, 1]');
  const mods = L.PARAMS_SINTE.filter(d => d.modulable).map(d => d.id);
  check(['corte', 'resonancia', 'modEnv', 'lfoProf', 'ecoMezcla', 'volumen'].every(id => mods.includes(id)), `modulables: ${mods.join(', ')}`);
  L.liberarParamCara(st, 'ecoMezcla');
  check(L.valorParam(st, 'ecoMezcla') === st.manual[L.P.ecoMezcla], 'prioridad manual: soltar un parámetro de la cara vuelve al manual');
  L.activarCara(st, false);
  check(L.valorParam(st, 'corte') === 800, 'al apagar la cara vuelve el valor manual');
  check(L.PARAMS_SINTE.every(d => Math.abs(L.aNormal(d, L.deNormal(d, 0.3)) - 0.3) < 1e-9 || d.curva === 'paso'), 'aNormal / deNormal inversas'); }
{ M.silenciarYReiniciarSinte();
  const v0 = M.SINTE.version, vc0 = M.SINTE.versionCara;
  check(M.setParamSinte('corte', 900, 'manual') && M.SINTE.editado && M.SINTE.version > v0, 'motor: setParamSinte("corte", 900, "manual") → EDITADO');
  check(!M.setParamSinte('corte', 0.9, 'cara'), 'motor: la cara apagada no mueve nada');
  M.activarCaraSinte(true);
  check(M.setParamSinte('corte', 0.9, 'cara') && M.SINTE.versionCara > vc0 && M.PARAMS_SY.manual[L.P.corte] === 900 && L.valorIdx(M.PARAMS_SY, L.P.corte) > 900, 'motor: con la cara activa manda la cara, el manual queda en 900 y sube versionCara (no version)');
  M.activarCaraSinte(false);
  check(L.valorIdx(M.PARAMS_SY, L.P.corte) === 900, 'motor: al apagar la cara vuelve el manual');
  check(/export function setParamSinte\(id: string, valor: number, fuente: FuenteParam = "manual"\): boolean/.test(MOTOR) && /setParamSinte\(pid, deNormalY\(d, v\), "manual"\)/.test(LS),
    'gancho listo: setParamSinte(id, valor, fuente); las perillas usan la fuente "manual" (la cara no se implementa en Z101)'); }

console.log('\n(h) layout del atril SY-40');
{ const MO = Y.MODULOS_Y, P = Y.POSICIONES_Y, mal = [];
  for (const m of MO) if (!S.dentro(m.rect, S.PANEL)) mal.push('módulo fuera ' + m.id);
  for (let i = 0; i < MO.length; i++) for (let j = i + 1; j < MO.length; j++) if (S.seSuperponen(MO[i].rect, MO[j].rect)) mal.push(MO[i].id + '↔' + MO[j].id);
  for (const p of P) if (!S.dentro(Y.huellaY(p), Y.moduloY(p.modulo).rect)) mal.push('fuera ' + p.id);
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (S.seSuperponen(Y.huellaY(P[i]), Y.huellaY(P[j]))) mal.push(P[i].id + '↔' + P[j].id);
  const vu = Y.rectVuY(); if (!S.dentro(vu, Y.moduloY('teclado').rect)) mal.push('VU fuera'); for (const p of P) if (S.seSuperponen(vu, Y.huellaY(p))) mal.push('VU↔' + p.id);
  const cuenta = m => P.filter(p => p.modulo === m).length;
  check(P.length === 66 && cuenta('sonidos') === 6 && cuenta('teclado') === 17 && P.filter(p => p.id.startsWith('y_tecla_')).length === 13 && mal.length === 0,
    `${P.length} controles (6 SONIDOS, ${cuenta('timbre')} TIMBRE, ${cuenta('filtro')} FILTRO Y ENVOLVENTE, ${cuenta('movimiento')} MOVIMIENTO, 17 TECLADO Y SALIDA: 13 teclas, OCT ±, VOLUMEN, ON) y el VU: dentro del panel, sin colisiones${mal.length ? ': ' + mal.slice(0, 6).join(', ') : ''}`);
  check(MO.map(m => m.titulo).filter(Boolean).join(' | ') === '1 SONIDOS | 2 TIMBRE | 3 FILTRO Y ENVOLVENTE | 4 MOVIMIENTO | 5 TECLADO Y SALIDA'
    && MO.filter(m => m.fila === 'medio').every(m => m.rect.v0 > Y.FILAS_Y.abajo.v1) && Y.moduloY('sonidos').rect.u0 < Y.moduloY('timbre').rect.u0 && Y.moduloY('timbre').rect.u0 < Y.moduloY('filtro').rect.u0,
    '5 módulos del más simple al más fino: 1 · 2 · 3 en la fila lejana (izquierda → derecha), 4 · 5 en la cercana');
  check(Math.abs(S.PANEL.u1 - S.PANEL.u0 - 1.40) < 1e-9 && /<boxGeometry args=\{\[OUTER_W, PANEL_T, OUTER_D\]\} \/>/.test(LS) && /const OUTER_D        = PANEL_D \+ 0\.10;/.test(LS), 'mismo panel de 1,40 m y el mismo marco que los otros atriles (0,85 m de fondo: no se agrandó)');
  const colsPad = ['y_tecla_0', 'y_tecla_2', 'y_tecla_4'].map(id => Y.posY(id).v);
  check(colsPad.every(v => v === colsPad[0]) && Y.posY('y_tecla_1').v > colsPad[0] && Y.posY('y_tecla_1').u > Y.posY('y_tecla_0').u && Y.posY('y_tecla_1').u < Y.posY('y_tecla_2').u,
    'teclado: 8 blancas en una fila y las 5 negras en la fila de atrás, entre sus blancas');
  for (const esc of [0.7, 1, 1.15]) {
    const T = Y.textosY(esc), m2 = [];
    const de = { r_osc1: 'timbre', r_osc2: 'timbre', c_lfo: 'movimiento', c_eco: 'movimiento', c_arp: 'movimiento', c_envsel: 'filtro', c_piano: 'teclado' };
    for (const t of T) {
      const r = S.rectTexto(t);
      const m = t.fila === 'display' ? Y.moduloY('display') : MO.find(mm => t.id === `t_${mm.id}` || t.id === `g_${mm.id}`) ?? Y.moduloY(de[t.id] ?? Y.posY(t.id.slice(2))?.modulo ?? 'teclado');
      if (!S.dentro(r, m.rect)) m2.push(t.id + ' fuera de ' + m.id);
      if (t.fila === 'display' && r.u1 > Y.DISPLAY_TEXTO_U1) m2.push(t.id + ' sobre la onda');
      for (const p of P) if (S.seSuperponen(r, Y.huellaY(p))) m2.push(t.id + '↔' + p.id);
      if (S.seSuperponen(r, vu)) m2.push(t.id + '↔VU');
    }
    for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) if (S.seSuperponen(S.rectTexto(T[i]), S.rectTexto(T[j]))) m2.push(T[i].id + '↔' + T[j].id);
    check(m2.length === 0, `ETIQUETA_ESCALA ${esc}: ${T.length} textos, ninguno cortado, fuera de su módulo o encimado${m2.length ? ': ' + m2.slice(0, 5).join(', ') : ''}`);
  }
  const g = S.GEO_DEFECTO;
  for (const [nom, a] of [['16:10', 1.6], ['16:9', 16 / 9]]) {
    const p = Y.buscarPoseSinte(g, a, S.escalaEfectiva(1, true, a));
    check(!!p && p.pasada < 3 && p.legible >= S.LEGIBLE_MIN, `${nom}: cámara del modo atril fov ${p?.fov}° h ${p?.height.toFixed(2)} d ${p?.dist.toFixed(2)} pitch ${p?.pitch}° → texto más lejano ${(100 * (p?.legible ?? 0)).toFixed(2)} % (≥ 2,5 %)`);
  }
  check(/legibilidadMinimaY\(geoAtril\(\), cp, escalaEfectiva\(DBG_ATRIL_SINTE\.ETIQUETA_ESCALA/.test(LS) && /const conPasadas = nuevoSonido \|\| imagenPanel \|\| esBajo \|\| esSinte;/.test(LS),
    'fitLecternCamera: el SY-40 busca como el de sonido y exige legibilidadMinimaY');
  check(Y.TEXTO_PLACA_Y("IN-GO'S WAN INC.") === "SINTETIZADOR SY-40 · IN-GO'S WAN INC. · SINTETIZADOR POLIFÓNICO · 5 MÓDULOS" && /TEXTO_PLACA_Y\(NOMBRE_EMPRESA_MAYUS\)/.test(LS)
    && /<PlacaBarraSonido texto=\{TEXTO_PLACA_SINTE\} leyenda=\{LEYENDA_FILAS_Y\}/.test(LS) && /esSinte && <PlacaFrenteSonido [^\n]*nombre=\{NOMBRE_EQUIPO_Y\}/.test(LS),
    'placa: "SINTETIZADOR SY-40 · IN-GO\'S WAN INC. · SINTETIZADOR POLIFÓNICO · 5 MÓDULOS" en la barra (con la leyenda de filas) y en el frente del pedestal');
  check(/FRANJAS_PLACA/.test(COMP) && /from "@\/lib\/marca"/.test(COMP), 'franjas de la marca (FRANJAS_PLACA de lib/marca.ts) bajo el display');
  // pose: poseInstrumento(−1) como única fuente
  const a = { x: 0, z: 0, yaw: 0 }, b = { x: 0, z: 0, yaw: 0 }, c = { x: 0, z: 0, yaw: 0 };
  POSE.poseInstrumento(-1, a); POSE.poseAtrilSinte(b); POSE.poseInstrumento(1, c);
  const { ATRIL_SINTE } = Y;
  check(a.x === b.x && a.z === b.z && a.yaw === b.yaw && ATRIL_SINTE.x === b.x && ATRIL_SINTE.z === b.z && ATRIL_SINTE.yaw === b.yaw,
    `poseAtrilSinte = poseInstrumento(−1) (${f(b.x)}, ${f(b.z)}, yaw ${f(b.yaw * 180 / Math.PI, 1)}°) y escribe ATRIL_SINTE`);
  const cx = POSE.EJE_INSTRUMENTOS.cx, cz = POSE.EJE_INSTRUMENTOS.cz;
  check(cerca(Math.hypot(b.x - cx, b.z - cz), Math.hypot(c.x - cx, c.z - cz), 1e-9) && cerca(Math.hypot(b.x - cx, b.z - cz), POSE.radioCaja(), 1e-9) && b.x * c.x < 0,
    `misma distancia al centro que la caja de ritmos y el BA-40 (${f(POSE.radioCaja())} m), del lado opuesto al BA-40`);
  check(/export const INDICE_SINTE = -1;/.test(POSE_SRC) && /poseInstrumento\(INDICE_SINTE, out\)/.test(cuerpo(POSE_SRC, 'poseAtrilSinte'))
    && /if \(side === "sinte"\) return poseAtrilSinte\(_poseLado\);/.test(LS) && /side === "sinte" && poseRef\.current\)[\s\S]{0,80}poseLado\("sinte"\)/.test(LS)
    && /frenteAtrilSinte:[\s\S]{0,160}poseAtrilSinte\(_poseSinte\)/.test(CKA) && !/ATRIL_SINTE\./.test(cuerpo(CKA, 'frenteAtrilSinte'))
    && /ATRIL_SINTE\.visible && Math\.hypot\(cam\.position\.x - ATRIL_SINTE\.x/.test(TS) && /dSinte\s*=\s*ATRIL_SINTE\.visible \? Math\.hypot\(camera\.position\.x - ATRIL_SINTE\.x/.test(LS),
    'pose y yaw de UNA fuente: pedestal y atril (poseLado → poseAtrilSinte), cámara del modo atril (fitLecternCamera usa poseLado), checkpoint (poseAtrilSinte); aviso "E" y tecla E leen ATRIL_SINTE, que solo escribe poseAtrilSinte');
  const escritores = ['lib', 'components'].flatMap(d => fs.readdirSync(new URL(`../${d}/`, import.meta.url), { recursive: true }).filter(n => /\.tsx?$/.test(n)).map(n => `../${d}/${n}`))
    .filter(p => /ATRIL_SINTE\.(x|z|yaw) =/.test(leer(p)));
  check(escritores.length === 1 && escritores[0].endsWith('instrumentosPose.ts'), `solo lib/instrumentosPose.ts escribe la posición viva del SY-40 (${escritores.join(', ')})`);
  check(/\{ id: "atril_sinte", nombre: "Atril del sintetizador"/.test(CK) && /\["atrilesSinConsentimiento"\], \["esperarFrames", 3\], \["frenteAtrilSinte"\]/.test(CK), 'checkpoint "atril_sinte": atriles afuera y frente al SY-40'); }

console.log('\n(i) sin allocations en el reloj y en el dibujo; sin nodos por nota');
{ const prohibido = /new |`|\[\s*\]|\[\s*[\w.]+\s*,|\.map\(|\.slice\(|\.filter\(|\.concat\(|\{\s*\.\.\./;
  const reloj = [cuerpoFlecha(MOTOR, 'oyenteReloj'), ...['notaOn', 'notaOff', 'tocar', 'soltar', 'cancelarYMantener', 'soltarSonando', 'corteBase'].map(n => cuerpo(MOTOR, n))].join('\n');
  const puros = ['asignarVoz', 'ocupar', 'liberarNota', 'secuenciaArp', 'siguienteNotaArp', 'azarArp', 'pasosArpEnVentana', 'corteConTecla', 'corteEnvolvente', 'midiAFrecuencia', 'valorIdx', 'deNormal'].map(n => cuerpo(PURO, n)).join('\n');
  const dib = ['dibujarDisplaySinte', 'trazar', 'calcularCurvas'].map(n => cuerpo(COMP, n)).join('\n');
  check(reloj.length > 1500 && !prohibido.test(sinCom(reloj)), 'oyente del reloj, notas, envolventes y robo: sin new, template strings ni arreglos u objetos nuevos');
  check(puros.length > 1500 && !prohibido.test(sinCom(puros)), 'funciones puras del bucle (voces, arpegio, ventana, filtro): sin allocations');
  check(dib.length > 900 && !prohibido.test(sinCom(dib)), 'dibujo del display (texto, onda y curva del filtro): sin allocations');
  check(/const _t = new Float64Array\(8\), _seq = new Int16Array\(64\), _tmp = new Int16Array\(16\);/.test(MOTOR) && /const _curva = new Float32Array\(N_CURVA\), _curvaPico = new Float32Array\(N_CURVA\), _onda = new Float32Array\(N_ONDA\);/.test(COMP),
    'arreglos preasignados a nivel de módulo (tiempos, secuencia del arpegio, curvas y onda)');
  check(!/create(Oscillator|Gain|BiquadFilter|Delay|Analyser|BufferSource)/.test(reloj) && /o1\.start\(\); o2\.start\(\); sub\.start\(\);/.test(cuerpo(MOTOR, 'crearGrafo')) && (MOTOR.match(/createOscillator\(/g) || []).length === 4,
    'los nodos se crean solo en crearGrafo (voces preasignadas, osciladores siempre corriendo); nunca por nota');
  check(/if \(u\.ver !== SINTE\.version \|\| u\.vc !== SINTE\.versionCara\) calcularCurvas\(\);/.test(COMP) && /if \(!tocaActualizar\(ahora, u\.ms, DBG_ATRIL_SINTE\.VU_HZ\)\) return;[\s\S]*?if \(!enPantalla\(g, camera\)\) return;/.test(COMP),
    'el display se redibuja solo si algo cambió, ≤ VU_HZ y con el atril en pantalla; onda y curva solo cuando cambian los parámetros');
  check(/cancelarYMantener\(n\.vca\.gain, t\);\s*n\.vca\.gain\.linearRampToValueAtTime\(pico, t \+ A\);/.test(MOTOR) && /setTargetAtTime\(0, t, Math\.max\(0\.003, v\(P\.release\) \/ 4\)\)/.test(MOTOR) && /cancelAndHoldAtTime/.test(MOTOR),
    'envolventes sin clics: cancelAndHoldAtTime (o cancelScheduledValues) + rampa desde el valor actual; release con setTargetAtTime');
  check(/lfoAfin\.connect\(o1\.detune\); lfoAfin\.connect\(o2\.detune\); lfoAfin\.connect\(sub\.detune\); lfoCorte\.connect\(filtro\.detune\);/.test(MOTOR) && /lfoVol\.connect\(trem\.gain\)/.test(MOTOR),
    'LFO único compartido: vibrato (detune), barrido (detune del filtro) y trémolo (ganancia), con ganancia por destino');
  check(/on\.connect\(entradaBus\(\)\)/.test(MOTOR) && /on\.connect\(analizador\)/.test(MOTOR) && !/vizAudio|obtenerSalidaTransmisible|livekit/i.test(sinCom(MOTOR)),
    'la salida entra al MISMO bus maestro (viaja a SILLAS por el camino de siempre) con un analizador en derivación para el VU; la transmisión no se toca'); }

console.log('\n(j) limpieza');
{ M.silenciarYReiniciarSinte();
  const limpiar = M.instalarSinte();
  M.notaAbajo(60); M.notaAbajo(64);
  const oyentes = N.RELOJ.oyentes.length, osc = 3 * M.VOCES.n + 1, src = 1;
  const s0 = CUENTA.stop, d0 = CUENTA.disconnect;
  limpiar();
  check(N.RELOJ.oyentes.length === oyentes - 1 && !M.SINTE.listo && M.MANTENIDAS.n === 0 && M.ARP.pos === 0, 'al desmontar: se desuscribe del reloj, se sueltan las teclas y el arpegio vuelve al principio');
  check(CUENTA.stop - s0 === osc + src && CUENTA.disconnect - d0 >= osc + 9 * M.VOCES.n - 3 * M.VOCES.n, `se detienen los ${osc} osciladores (LFO incluido) y el ruido, y se desconectan los nodos (${CUENTA.disconnect - d0} desconexiones)`);
  const lib = cuerpo(MOTOR, 'liberarGrafo');
  check(/g\.lfo\.stop\(\)/.test(lib) && /g\.ruido\.liberar\(\)/.test(lib) && /x\.disconnect\(\)/.test(lib) && /g\.analizador/.test(lib), 'liberarGrafo: LFO detenido, ruido liberado, todos los nodos desconectados (incluido el analizador del VU)');
  check(/const limpiar = instalarSinte\(\);[\s\S]{0,80}return \(\) => \{ _teclaPad\.fill\(-1\); limpiar\(\); ATRIL_SINTE\.visible = false; \};/.test(LS), 'el atril instala el motor al montar y lo libera al desmontar');
  const td = COMP.slice(COMP.indexOf('export function TecladoSinte'));
  check(/window\.removeEventListener\("keydown", down\);/.test(td) && /window\.removeEventListener\("keyup", up\);/.test(td) && /window\.removeEventListener\("blur", soltarTodo\);/.test(td)
    && /acceso\.onstatechange = null; acceso\.inputs\.forEach\(i => \{ i\.onmidimessage = null; \}\);/.test(td) && /soltarTodo\(\);\s*\};\s*\}, \[\]\);/.test(td),
    'teclado y MIDI: se quitan los oyentes de teclas, foco y visibilidad, se cierra MIDI y se sueltan todas las teclas');
  check(/useEffect\(\(\) => \(\) => \{ r\.tex\.dispose\(\); r\.mat\.dispose\(\); r\.geo\.dispose\(\); r\.marcoGeo\.dispose\(\); r\.marcoMat\.dispose\(\); \}, \[r\]\);/.test(COMP), 'el display libera textura, material y geometrías');
  check(/_drag\.def\?\.onSoltar\?\.\(\);   \/\/ Z101: tecla del SY-40 → suelta la nota/.test(LS) && /_drag\.def\?\.onSoltar\?\.\(\);   \/\/ Z101\n/.test(LS), 'las teclas del atril se sueltan también si el puntero se cancela o se pierde la captura'); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
