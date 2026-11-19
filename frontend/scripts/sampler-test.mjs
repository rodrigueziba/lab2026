// Z103: SAMPLER SM-40. (a) afinación → playbackRate; (b) recorte y reversa; (c) sonidos de fábrica; (d) tope de voces y
// robo, MIENTRAS / DISPARO (también con el motor real sobre un AudioContext simulado); (e) cuantización con reloj simulado;
// (f) grabación (MediaRecorder y micrófono simulados); (g) setParamSampler manual y cara; (h) teclas; (i) layout,
// legibilidad y pose (poseInstrumento(2)); (j) sin allocations; (k) limpieza. Uso: node scripts/sampler-test.mjs
import fs from 'node:fs';
import { register } from 'node:module';
const RAIZ = new URL('../', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`const R = ${JSON.stringify(RAIZ)};
export async function resolve(s, c, n) {
  if (s.startsWith('@/')) s = R + s.slice(2);
  if ((/^\\.\\.?\\//.test(s) || s.startsWith('file:')) && !/\\.[a-z]+$/.test(s)) { try { return await n(s + '.ts', c); } catch {} }
  return n(s, c);
}`));

// ── navegador simulado: AudioContext, MediaRecorder y micrófono ──
const CUENTA = { source: 0, stop: 0, disconnect: 0, gain: 0, tap: 0, pistasCerradas: 0, recorders: 0 };
const FUENTES = [];
class Param { constructor(v = 0) { this.value = v; } setTargetAtTime() { return this; } setValueAtTime() { return this; } linearRampToValueAtTime() { return this; } cancelScheduledValues() { return this; } cancelAndHoldAtTime() { return this; } }
class Nodo { connect(x) { return x; } disconnect() { CUENTA.disconnect++; } }
class Buf { constructor(nc, len, sr) { this.numberOfChannels = nc; this.length = len; this.sampleRate = sr; this.duration = len / sr; this._c = Array.from({ length: nc }, () => new Float32Array(len)); } getChannelData(i) { return this._c[i]; } }
class Fuente extends Nodo {
  constructor() { super(); this.buffer = null; this.loop = false; this.loopStart = 0; this.loopEnd = 0; this.playbackRate = new Param(1); this.inicio = null; this.parada = null; this.onended = null; }
  start(t, off, dur) { this.inicio = { t, off, dur }; } stop(t) { CUENTA.stop++; this.parada = t; }
}
class Ctx {
  constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 48000; this.destination = new Nodo(); }
  resume() { return Promise.resolve(); }
  createGain() { CUENTA.gain++; const g = new Nodo(); g.gain = new Param(1); return g; }
  createBiquadFilter() { const f = new Nodo(); f.frequency = new Param(350); f.Q = new Param(1); return f; }
  createAnalyser() { const a = new Nodo(); a.fftSize = 2048; return a; }
  createWaveShaper() { const w = new Nodo(); w.curve = null; return w; }
  createOscillator() { const o = new Fuente(); o.frequency = new Param(440); o.detune = new Param(0); return o; }
  createBuffer(nc, len, sr) { return new Buf(nc, len, sr); }
  createBufferSource() { CUENTA.source++; const s = new Fuente(); FUENTES.push(s); return s; }
  createMediaStreamDestination() { CUENTA.tap++; const d = new Nodo(); d.stream = { getTracks: () => [] }; return d; }
  decodeAudioData() { return Promise.resolve(new Buf(1, Math.round(DECODIFICAR_S * 48000), 48000)); }
}
let DECODIFICAR_S = 1;
class Grabador {
  constructor(stream) { CUENTA.recorders++; this.stream = stream; this.state = 'inactive'; this.mimeType = 'audio/webm'; this.ondataavailable = null; this.onstop = null; }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob([new Uint8Array(16)]) }); this.onstop?.(); }
}
const pista = () => ({ stop() { CUENTA.pistasCerradas++; } });
let PEDIDOS_MIC = 0, OPCIONES_MIC = null;
globalThis.AudioContext = Ctx;
globalThis.MediaRecorder = Grabador;
globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: { getUserMedia: o => { PEDIDOS_MIC++; OPCIONES_MIC = o; return Promise.resolve({ getTracks: () => [pista(), pista()] }); } } }, configurable: true });

const L = await import('../lib/sampler.ts');
const R = await import('../lib/audio/reloj.ts');
const Y = await import('../lib/atrilSampler.ts');
const S = await import('../lib/atrilSonido.ts');
const POSE = await import('../lib/instrumentosPose.ts');
const N = await import('../lib/audio/nucleo.ts');
const RM = await import('../lib/ritmosMotor.ts');
const M = await import('../lib/audio/sampler.ts');
const { DBG_SAMPLER: CS, DBG_ATRIL_SAMPLER: CA } = await import('../lib/debugConfig.ts');

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const sinCom = t => t.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const PURO = leer('../lib/sampler.ts'), MOTOR = leer('../lib/audio/sampler.ts'), COMP = leer('../components/AtrilSamplerNuevo.tsx');
const LS = leer('../components/LecternSystem.tsx'), TS = leer('../components/ThreeScene.tsx'), CFG = leer('../lib/debugConfig.ts');
const POSE_SRC = leer('../lib/instrumentosPose.ts'), CKA = leer('../lib/checkpointsAcciones.ts'), CK = leer('../lib/checkpoints.ts');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const cerca = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const f = (v, n = 3) => Number(v).toFixed(n).replace('.', ',');
const cuerpo = (src, n) => {   // el cuerpo de la función (las de una sola línea, solo esa línea)
  const i = src.search(new RegExp(`(function ${n}\\(|const ${n} = )`));
  if (i < 0) return '';
  const linea = src.slice(i, src.indexOf('\n', i));
  return /\}\s*$/.test(linea) && !/\{\s*$/.test(linea) ? linea : src.slice(i, src.indexOf('\n}', i) + 2);
};
const cuerpoFlecha = (src, n) => { const i = src.search(new RegExp(`const ${n} = \\(`)); return i < 0 ? '' : src.slice(i, src.indexOf('\n};', i) + 3); };
const espera = ms => new Promise(r => setTimeout(r, ms));

console.log('\nconstantes y estructura');
check(!/^import /m.test(PURO), 'lib/sampler.ts sin imports (lógica pura)');
for (const k of ['SAMPLER_VOCES', 'SAMPLER_MAX_SIMULTANEAS', 'SAMPLER_MAX_S', 'QUANT', 'ON', 'CORTE_MIN', 'CORTE_MAX', 'RES_MAX', 'CORTE', 'AFINACION', 'INICIO', 'FIN', 'VOL_PAD', 'LOOP', 'REVERSA', 'MODO'])
  check(new RegExp(`export const DBG_SAMPLER = \\{[\\s\\S]*?\\n  ${k}:`).test(CFG), `DBG_SAMPLER.${k} = ${JSON.stringify(CS[k])}`);
for (const k of ['ETIQUETA_ESCALA', 'ETIQUETA_AUTO_ASPECTO', 'DISPLAY_VALOR_S', 'VU_HZ', 'ROTULOS_FILA', 'ROTULOS_MODO'])
  check(new RegExp(`export const DBG_ATRIL_SAMPLER = \\{[\\s\\S]*?\\n  ${k}:`).test(CFG), `DBG_ATRIL_SAMPLER.${k} = ${JSON.stringify(CA[k])}`);
check(CS.SAMPLER_VOCES === 8 && CS.SAMPLER_MAX_SIMULTANEAS === 12 && CS.SAMPLER_MAX_S === 8 && CS.QUANT === 0, 'por defecto: 8 voces, 12 simultáneas, 8 s de grabación, QUANT OFF');

console.log('\n(a) afinación → playbackRate');
check(L.velocidadDeAfinacion(12) === 2 && L.velocidadDeAfinacion(-12) === 0.5 && L.velocidadDeAfinacion(0) === 1, '+12 duplica, −12 divide a la mitad, 0 deja igual');
check(cerca(L.velocidadDeAfinacion(7), Math.pow(2, 7 / 12)) && L.velocidadDeAfinacion(40) === 2 && L.velocidadDeAfinacion(NaN) === 1, '2^(semitonos/12); acotada a ±12; NaN → 0');

console.log('\n(b) recorte y reversa');
{ const st = L.crearEstado(); let malo = '';
  const rnd = (() => { let x = 7; return () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; }; })();
  for (let k = 0; k < 2000; k++) {
    L.setParam(st, rnd() < 0.5 ? 'inicio' : 'fin', rnd() * 1.4 - 0.2, 'manual');
    const i = L.manualIdx(st, L.PS.inicio, 0), fi = L.manualIdx(st, L.PS.fin, 0);
    if (!(i >= 0 && fi <= 1 && fi - i >= L.RECORTE_MIN - 1e-12)) { malo = `${i} ${fi}`; break; }
  }
  check(!malo, `2000 movimientos al azar de INICIO y FIN: siempre ordenados, dentro de [0, 1] y con al menos ${L.RECORTE_MIN} de largo${malo ? ' — ' + malo : ''}`);
  const r = { offset: 0, dur: 0 };
  L.rangoReproduccion(0.2, 0.7, 2, false, r); const a = [r.offset, r.dur];
  L.rangoReproduccion(0.2, 0.7, 2, true, r);
  check(cerca(a[0], 0.4) && cerca(a[1], 1) && cerca(r.offset, 0.6) && cerca(r.dur, 1), 'recorte 0,2…0,7 de 2 s: suena de 0,4 s durante 1 s; con REVERSA, desde 0,6 s del invertido (el mismo tramo, al revés)');
  const x = Float32Array.from([1, 2, 3, 4, 5]), y = L.invertir(x, new Float32Array(5));
  check(y.join() === '5,4,3,2,1' && L.indiceReverso(0, 5) === 4 && L.indiceReverso(4, 5) === 0 && y[L.indiceReverso(1, 5)] === x[1], 'REVERSA: copia invertida e índices correctos'); }

console.log('\n(c) sonidos de fábrica');
{ check(L.NOMBRES_FABRICA.join() === 'GOLPE,METAL,RUIDO,CAÍDA,GLITCH,VOZ,CLICK,DRON' && L.FABRICA_SAMPLER[7].loop && L.FABRICA_SAMPLER.filter(s => s.loop).length === 1, 'los 8: GOLPE, METAL, RUIDO, CAÍDA, GLITCH, VOZ, CLICK y DRON (el único con LOOP)');
  for (let i = 0; i < 8; i++) {
    const x = L.generarFabrica(i, 48000);
    let pico = 0, suma = 0, cuad = 0, nan = false;
    for (const v of x) { if (!Number.isFinite(v)) nan = true; pico = Math.max(pico, Math.abs(v)); suma += v; cuad += v * v; }
    const dur = x.length / 48000, dc = suma / x.length, rms = Math.sqrt(cuad / x.length);
    check(dur <= 4 + 1e-9 && (i === 7 || dur < 3) && !nan && pico <= 1 && Math.abs(dc) < 0.01 && rms > 0.01,
      `${L.NOMBRES_FABRICA[i]}: ${f(dur, 2)} s, pico ${f(pico, 2)}, DC ${f(dc, 4)}, RMS ${f(rms, 3)} (sin NaN, no es silencio)`);
  }
  const d = L.generarFabrica(7, 48000), e = L.generarFabrica(0, 48000);
  let paso = 0; for (let k = 1; k < d.length; k++) paso = Math.max(paso, Math.abs(d[k] - d[k - 1]));
  const empalme = Math.abs(d[0] - d[d.length - 1]);
  check(empalme <= paso * 1.05, `DRON: el empalme del bucle (${f(empalme, 3)}) no es mayor que el salto más grande entre dos muestras seguidas del propio sonido (${f(paso, 3)}): no se oye el corte`);
  check(L.generarFabrica(0, 48000).every((v, k) => v === e[k]), 'deterministas (la misma muestra cada vez)');
  check(/bufferFabrica\(ctx, p\)/.test(cuerpo(MOTOR, 'crearGrafo')) && !/fetch|\.wav|\.mp3|\.ogg/.test(sinCom(MOTOR + PURO)), 'se generan por cálculo al nacer el grafo; sin archivos ni red'); }

console.log('\n(d) voces: tope, robo, MIENTRAS y DISPARO');
{ const r = L.crearRanuras(12); let peor = 0;
  for (let k = 0; k < 30; k++) { L.asignarRanura(r, k % 8, k * 0.01, 5, 12); peor = Math.max(peor, L.vivas(r, k * 0.01)); }
  check(peor === 12 && r.robos === 18, `30 disparos largos con tope 12: nunca más de 12 vivas, 18 robos`);
  const r2 = L.crearRanuras(4); for (let k = 0; k < 4; k++) L.asignarRanura(r2, k, k, 100, 4);
  const robada = L.asignarRanura(r2, 7, 10, 100, 4);
  check(r2.robada && r2.tOn[robada] === 10 && r2.pad[robada] === 7 && !Array.from(r2.pad).includes(0), 'roba la MÁS ANTIGUA (la del pad 1, t = 0)');
  const r3 = L.crearRanuras(12); L.asignarRanura(r3, 2, 0, 0.5, 12);
  check(L.vivas(r3, 0.4) === 1 && L.vivas(r3, 0.6) === 0 && L.asignarRanura(r3, 3, 0.6, 1, 12) >= 0 && !r3.robada, 'una fuente que terminó libera su ranura (sin robo)');
  const idx = new Int32Array(8); L.asignarRanura(r3, 5, 1, Infinity, 12);
  check(L.cortarPad(r3, 5, 2, idx) === 1 && !L.padSonando(r3, 5, 2.1), 'cortarPad corta las fuentes vivas de ese pad'); }
{ M.silenciarYReiniciarSampler(); RM.RITMOS.sonando = false;
  const limpiar = M.instalarSampler(), ctx = N.obtenerContexto(), g0 = CUENTA.gain;
  M.padAbajo(0);
  const gGrafo = CUENTA.gain - g0;
  check(M.SAMPLER.listo && gGrafo === 8 + 2 + Math.max(CS.SAMPLER_VOCES, CS.SAMPLER_MAX_SIMULTANEAS), `el grafo nace con la primera acción: ${gGrafo} ganancias (8 de pad, volumen, ON y ${Math.max(CS.SAMPLER_VOCES, CS.SAMPLER_MAX_SIMULTANEAS)} ranuras)`);
  const f0 = FUENTES.length, gN = CUENTA.gain;
  for (let k = 0; k < 30; k++) { ctx.currentTime = 0.01 * k; M.padAbajo(k % 7); }   // pads 1…7 (sin el DRON en bucle)
  M.tickSampler();
  check(FUENTES.length - f0 === 30 && CUENTA.gain === gN && M.SAMPLER.vivas <= CS.SAMPLER_MAX_SIMULTANEAS && M.SAMPLER.robos > 0,
    `30 disparos rápidos: una fuente por disparo (de un solo uso), ninguna ganancia nueva, ${M.SAMPLER.vivas} vivas (≤ ${CS.SAMPLER_MAX_SIMULTANEAS}), ${M.SAMPLER.robos} robos`);
  const robadas = FUENTES.slice(f0).filter(s => s.parada !== null);
  check(robadas.length >= 30 - CS.SAMPLER_MAX_SIMULTANEAS - 7 && robadas.every(s => s.parada > 0), `las robadas se detienen tras la caída corta (${robadas.length})`);
  M.cortarTodo(); ctx.currentTime = 1;
  M.setParamSampler('modo', 1, 'manual', 3); M.seleccionarPad(3);
  M.padAbajo(3); const fm = FUENTES[FUENTES.length - 1];
  check(fm.parada === null, 'MIENTRAS: suena mientras se mantiene');
  M.padArriba(3);
  check(fm.parada !== null && fm.parada <= 1.02, `MIENTRAS: al soltar se corta (stop a ${f(fm.parada)} s, con ~${CS.ROBO_S * 1000} ms de caída)`);
  M.setParamSampler('modo', 0, 'manual', 4); ctx.currentTime = 2;
  M.padAbajo(4); const fd = FUENTES[FUENTES.length - 1]; M.padArriba(4);
  check(fd.parada === null && fd.inicio.dur > 0, 'DISPARO: soltar no corta (suena completo)');
  M.setParamSampler('loop', 1, 'manual', 4); ctx.currentTime = 3;
  M.padAbajo(4); const fl = FUENTES[FUENTES.length - 1];
  check(fl.loop && fl.inicio.dur === undefined && fl.loopEnd > fl.loopStart, 'LOOP: la fuente queda en bucle entre INICIO y FIN');
  M.padAbajo(4);
  check(fl.parada !== null, 'DISPARO con LOOP: el segundo toque corta el bucle');
  M.setParamSampler('afinacion', 12, 'manual', 5); M.setParamSampler('reversa', 1, 'manual', 5); ctx.currentTime = 4;
  M.padAbajo(5); const fr = FUENTES[FUENTES.length - 1];
  check(fr.playbackRate.value === 2 && fr.buffer.getChannelData(0)[0] === L.generarFabrica(5, 48000).at(-1), 'AFINACIÓN +12 → playbackRate 2; REVERSA → el buffer invertido');
  M.SAMPLER.selecc = true; const fs0 = FUENTES.length; M.padAbajo(6);
  check(FUENTES.length === fs0 && M.EST.sel === 6, 'SELECC. encendido: tocar un pad lo elige sin sonar');
  M.SAMPLER.selecc = false;
  limpiar(); }

console.log('\n(e) cuantización');
{ let todo = true, detalle = '', casos = 0;
  for (const n of [8, 12, 16, 32]) for (const bpm of [60, 90, 124, 150, 180]) for (const q of [1, 4, 16]) {
    const r = R.crearReloj(bpm, n, n / 4); R.iniciar(r, 0, 0.05);
    const d = R.duracionPasoS(r), g = (d * n / 16) * q;
    for (let k = 0; k < 40; k++) {
      const ahora = 0.05 + k * 0.137 + (k % 7) * 0.011;
      R.programar(r, ahora, 0.1);
      const t = L.proximaGrilla(ahora, L.inicioCompas(r.siguienteT, r.paso, d), d * n, q);
      const pos = (t - 0.05) / g;
      if (!(t >= ahora - 1e-9 && t - ahora < g + 1e-9 && Math.abs(pos - Math.round(pos)) < 1e-6)) { todo = false; detalle = `${n} pasos ${bpm} BPM q${q}: ahora ${ahora} → ${t}`; }
      casos++;
    }
  }
  check(todo, `${casos} disparos con la caja sonando (8/12/16/32 pasos × 60…180 BPM × 1/16, 1/4, COMPÁS): cada uno cae en el PRÓXIMO punto de la grilla, nunca antes${detalle ? ' — ' + detalle : ''}`); }
{ M.silenciarYReiniciarSampler();
  const limpiar = M.instalarSampler(), ctx = N.obtenerContexto();
  ctx.currentTime = 10; RM.RITMOS.sonando = true; CS.QUANT = 3;
  R.iniciar(N.RELOJ, 10, 0.05); R.programar(N.RELOJ, 10, 0.1);
  const d = R.duracionPasoS(N.RELOJ), compas = d * N.RELOJ.pasosPorCompas;
  ctx.currentTime = 10.3; R.programar(N.RELOJ, 10.3, 0.1);
  const f0 = FUENTES.length; M.padAbajo(0);
  check(FUENTES.length === f0, 'QUANT COMPÁS con la caja sonando: el disparo queda pendiente');
  for (let t = 10.3; t < 10.05 + compas + 0.2; t += 0.02) { ctx.currentTime = t; R.programar(N.RELOJ, t, 0.1); }
  const fq = FUENTES[FUENTES.length - 1];
  check(FUENTES.length === f0 + 1 && cerca(fq.inicio.t, 10.05 + compas, 1e-9), `el oyente del reloj lo agenda en el compás siguiente (${f(fq.inicio.t, 4)} s = 10,05 + ${f(compas, 3)})`);
  CS.QUANT = 1; ctx.currentTime += 0.01; R.programar(N.RELOJ, ctx.currentTime, 0.1);
  const f1 = FUENTES.length; M.padAbajo(1);
  const g16 = compas / 16, fp = FUENTES[FUENTES.length - 1];
  check(FUENTES.length === f1 + 1 && fp.inicio.t >= ctx.currentTime && Math.abs((fp.inicio.t - 10.05) / g16 - Math.round((fp.inicio.t - 10.05) / g16)) < 1e-6,
    'QUANT 1/16: si el punto ya está dentro de lo que programó el reloj, se agenda al instante en ese punto exacto');
  RM.RITMOS.sonando = false; R.detener(N.RELOJ); ctx.currentTime = 20;
  const f2 = FUENTES.length; M.padAbajo(2);
  check(FUENTES.length === f2 + 1 && cerca(FUENTES.at(-1).inicio.t, 20 + CS.LOOKAHEAD_S, 1e-9), 'con la caja parada el disparo es inmediato');
  CS.QUANT = 0; limpiar(); }

console.log('\n(f) grabación');
{ M.silenciarYReiniciarSampler(); RM.RITMOS.sonando = false;
  const limpiar = M.instalarSampler(); M.padAbajo(0); M.cortarTodo();
  CS.FUENTE_GRAB = 0; CS.SAMPLER_MAX_S = 0.5; M.seleccionarPad(2); DECODIFICAR_S = 2;
  const p0 = PEDIDOS_MIC;
  check(p0 === 0, 'el micrófono no se pide antes de apretar GRABAR con MIC');
  check(M.grabar() && M.SAMPLER.estadoGrab === 'pidiendo' && !M.grabar(), 'GRABAR con MIC pide el micrófono; un segundo GRABAR no arranca otro (un solo grabador)');
  await espera(5);
  check(PEDIDOS_MIC === 1 && OPCIONES_MIC.audio.echoCancellation === false && OPCIONES_MIC.audio.noiseSuppression === false && OPCIONES_MIC.audio.autoGainControl === false && OPCIONES_MIC.video === false,
    'getUserMedia de audio sin cancelación de eco, supresión de ruido ni control de ganancia');
  check(M.SAMPLER.estadoGrab === 'grabando' && M.SAMPLER.avisoMic && /SI COMPARTÍS, SE TRANSMITE/.test(M.SAMPLER.mensaje), 'grabando; la primera vez con MIC el display avisa "MIC: SI COMPARTÍS, SE TRANSMITE"');
  const cerr0 = CUENTA.pistasCerradas;
  await espera(650);
  await espera(5);
  check(M.SAMPLER.estadoGrab === 'libre' && CUENTA.pistasCerradas - cerr0 === 2 && M.GRAB.stream === null, `corte automático a los SAMPLER_MAX_S (${CS.SAMPLER_MAX_S} s): las pistas del micrófono se cierran`);
  check(M.SAMPLER.nombres[2] === 'MIC' && M.SAMPLER.grabado[2] === 1 && M.datosPad(2).length === Math.floor(CS.SAMPLER_MAX_S * 48000), `lo grabado va al pad elegido, recortado a ${CS.SAMPLER_MAX_S} s aunque llegue más largo`);
  M.borrarPad(2);
  check(M.SAMPLER.nombres[2] === 'RUIDO' && M.SAMPLER.grabado[2] === 0 && M.datosPad(2).length === L.largoFabrica(2, 48000), 'BORRAR: vuelve el sonido de fábrica');
  // MEZCLA: derivación del analizador maestro, solo mientras graba
  CS.FUENTE_GRAB = 1; CS.SAMPLER_MAX_S = 8; M.seleccionarPad(4); DECODIFICAR_S = 1;
  const t0 = CUENTA.tap, pm = PEDIDOS_MIC;
  check(M.grabar() && CUENTA.tap === t0 + 1 && PEDIDOS_MIC === pm && M.GRAB.tap !== null, 'MEZCLA: un MediaStreamDestination en derivación del analizador maestro (sin pedir el micrófono)');
  M.pararGrabacion(); await espera(5);
  check(M.GRAB.tap === null && M.SAMPLER.nombres[4] === 'MEZCLA' && M.SAMPLER.estadoGrab === 'libre', 'PARAR: se desconecta la derivación y lo grabado va al pad');
  // desmontar en medio de una grabación con MIC
  CS.FUENTE_GRAB = 0; M.grabar(); await espera(5);
  const c1 = CUENTA.pistasCerradas; limpiar();
  check(CUENTA.pistasCerradas - c1 === 2 && M.SAMPLER.estadoGrab === 'libre' && M.GRAB.rec === null, 'al desmontar durante una grabación: se cancela y se cierran las pistas del micrófono');
  const camino = sinCom(MOTOR + PURO + COMP);
  check(!/fetch\(|WebSocket|XMLHttpRequest|localStorage|indexedDB|sendBeacon|livekit|supabase/i.test(camino) && /PRIVACIDAD: todo queda SOLO en memoria/.test(MOTOR) && /únicamente si el usuario está compartiendo|ÚNICAMENTE si el usuario está compartiendo/.test(MOTOR),
    'la grabación nunca se sube ni se guarda: sin fetch, WebSocket, XHR ni almacenamiento en el camino (y está escrito)');
  CS.FUENTE_GRAB = 0; }

console.log('\n(g) setParamSampler: manual y cara simulada');
{ const st = L.crearEstado();
  check(L.setParam(st, 'corte', 99999, 'manual') && L.valorParam(st, 'corte') === 16000 && L.setParam(st, 'afinacion', 30, 'manual', 2) && L.manualIdx(st, L.PS.afinacion, 2) === 12, 'manual: acota (CORTE ≤ 16000 Hz, AFINACIÓN ≤ +12)');
  check(!L.setParam(st, 'corte', 0.3, 'cara'), 'con la cara apagada, "cara" no hace nada');
  L.activarCara(st, true); st.sel = 2;
  check(L.setParam(st, 'afinacion', 0, 'cara') && L.valorParam(st, 'afinacion', 2) === -12 && L.manualIdx(st, L.PS.afinacion, 2) === 12 && L.valorParam(st, 'afinacion', 3) === 0,
    'cara: AFINACIÓN del pad seleccionado (−12) sin pisar su manual (+12); los otros pads no cambian');
  check(!L.setParam(st, 'inicio', 0.5, 'cara') && L.setParam(st, 'volumen', 2, 'cara') && L.valorParam(st, 'volumen') === 1, 'solo los modulables (CORTE, RESONANCIA, VOLUMEN, AFINACIÓN); acota a [0, 1]');
  L.liberarParamCara(st, 'volumen');
  check(L.valorParam(st, 'volumen') === L.manualIdx(st, L.PS.volumen, 0), 'soltar un parámetro de la cara vuelve al manual');
  L.activarCara(st, false);
  check(L.valorParam(st, 'afinacion', 2) === 12, 'al apagar la cara vuelve el manual');
  check(L.PARAMS_SAMPLER.filter(d => d.modulable).map(d => d.id).join() === 'corte,resonancia,volumen,afinacion', 'modulables: CORTE, RESONANCIA, VOLUMEN, AFINACIÓN');
  M.silenciarYReiniciarSampler(); const vc = M.SAMPLER.versionCara;
  M.activarCaraSampler(true);
  check(M.setParamSampler('corte', 0, 'cara') && M.SAMPLER.versionCara > vc && L.valorParam(M.EST, 'corte') === 200 && M.EST.global[L.PS.corte] === CS.CORTE, 'motor: setParamSampler con "cara" (sube versionCara) sin pisar el manual');
  M.activarCaraSampler(false);
  check(L.valorParam(M.EST, 'corte') === CS.CORTE && /export function setParamSampler\(id: string, valor: number, fuente: FuenteParam = "manual"/.test(MOTOR), 'motor: al apagar la cara vuelve el manual; el gancho existe (la cara no se implementa en Z103)'); }

console.log('\n(h) teclas de los pads');
{ const codes = L.TECLAS_PADS.map(t => t[0]);
  check(codes.length === 8 && new Set(codes).size === 8 && L.TECLAS_PADS.every(([, p], i) => p === i), `8 teclas sin repetidos: ${L.LETRAS_PADS.join(' ')}`);
  const piano = ['KeyR', 'Digit5', 'KeyT', 'Digit6', 'KeyY', 'KeyU', 'Digit8', 'KeyI', 'Digit9', 'KeyO', 'Digit0', 'KeyP', 'BracketLeft', 'Equal', 'BracketRight'];
  check(L.TECLAS_PROHIBIDAS.every(k => !codes.includes(k)) && piano.every(k => !codes.includes(k)) && !codes.includes('KeyZ') && !codes.includes('KeyC'),
    'sin choques con E, Q, X, WASD, 1 a 4, Shift, Espacio, Enter ni el piano del SY-40');
  check(/if \(INTERACT_STATE\.mode === "sampler"\) return;   \/\/ Z103/.test(LS) && /if \(side === "sinte" \|\| side === "sampler"\) \{ _keyMap\.clear\(\); return; \}/.test(LS),
    'V B N M son atajos Z–M de otros atriles: en el modo del SM-40 esos atajos se desactivan (y no se muestran letras)');
  const k = L.crearTeclasPads();
  check(L.teclaPadAbajo(k, 'KeyF', false) === 0 && L.teclaPadAbajo(k, 'KeyF', true) === -1 && L.teclaPadAbajo(k, 'KeyF', false) === -1 && L.teclaPadArriba(k, 'KeyF') === 0 && L.teclaPadAbajo(k, 'KeyF', false) === 0 && L.teclaPadAbajo(k, 'KeyX', false) === -1,
    'sin autorepetición: mantener F da un solo disparo; al soltar se puede volver a tocar; X no es un pad');
  check(/if \(INTERACT_STATE\.mode !== "sampler" \|\| e\.altKey/.test(COMP) && /teclaPadAbajo\(k, e\.code, e\.repeat\)/.test(COMP), 'los pads de la computadora solo tocan en el modo atril del SM-40 (posición física)'); }

console.log('\n(i) layout del atril SM-40 y pose');
{ const MO = Y.MODULOS_M, P = Y.POSICIONES_M, mal = [];
  const extra = [['contador', Y.contadorM(), 'grabar'], ['VU', Y.rectVuM(), 'salida'], ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => ['marca' + i, Y.marcaSeleccion(i), 'pads'])];
  for (const m of MO) if (!S.dentro(m.rect, S.PANEL)) mal.push('módulo fuera ' + m.id);
  for (let i = 0; i < MO.length; i++) for (let j = i + 1; j < MO.length; j++) if (S.seSuperponen(MO[i].rect, MO[j].rect)) mal.push(MO[i].id + '↔' + MO[j].id);
  for (const p of P) if (!S.dentro(Y.huellaM(p), Y.moduloM(p.modulo).rect)) mal.push('fuera ' + p.id);
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (S.seSuperponen(Y.huellaM(P[i]), Y.huellaM(P[j]))) mal.push(P[i].id + '↔' + P[j].id);
  for (const [n, r, m] of extra) { if (!S.dentro(r, Y.moduloM(m).rect)) mal.push(n + ' fuera'); for (const p of P) if (S.seSuperponen(r, Y.huellaM(p))) mal.push(n + '↔' + p.id); }
  check(P.length === 28 && P.filter(p => p.id.startsWith('m_pad_')).length === 8 && mal.length === 0,
    `${P.length} controles (8 pads + SELECC., 4 de GRABAR, 7 de EDITAR PAD, 8 de SALIDA), contador, VU y marca de selección: dentro del panel, sin colisiones${mal.length ? ': ' + mal.slice(0, 6).join(', ') : ''}`);
  check(MO.map(m => m.titulo).filter(Boolean).join(' | ') === '1 PADS | 2 GRABAR | 3 EDITAR PAD | 4 SALIDA', '4 módulos: 1 PADS · 2 GRABAR (lejos) · 3 EDITAR PAD · 4 SALIDA (cerca)');
  const filas = [0, 1, 2, 3].map(i => Y.posM(`m_pad_${i}`).v), filas2 = [4, 5, 6, 7].map(i => Y.posM(`m_pad_${i}`).v);
  check(filas.every(v => v === filas[0]) && filas2.every(v => v === filas2[0]) && filas[0] > filas2[0] && Y.posM('m_pad_0').escala === 1, 'pads grandes en 2 filas de 4 (1 a 4 arriba, 5 a 8 abajo)');
  for (const esc of [0.7, 1, 1.15]) {
    const T = Y.textosM(esc), m2 = [], de = { c_grabar: 'grabar', c_quant: 'salida' };
    for (const t of T) {
      const r = S.rectTexto(t);
      const m = t.fila === 'display' ? Y.moduloM('display') : MO.find(mm => t.id === `t_${mm.id}` || t.id === `g_${mm.id}`) ?? Y.moduloM(de[t.id] ?? Y.posM(t.id.slice(2))?.modulo);
      if (!S.dentro(r, m.rect)) m2.push(t.id + ' fuera de ' + m.id);
      if (t.fila === 'display' && r.u1 > Y.DISPLAY_TEXTO_U1) m2.push(t.id + ' sobre la onda');
      for (const p of P) if (S.seSuperponen(r, Y.huellaM(p))) m2.push(t.id + '↔' + p.id);
      for (const [n, rr] of extra) if (S.seSuperponen(r, rr)) m2.push(t.id + '↔' + n);
    }
    for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) if (S.seSuperponen(S.rectTexto(T[i]), S.rectTexto(T[j]))) m2.push(T[i].id + '↔' + T[j].id);
    check(m2.length === 0, `ETIQUETA_ESCALA ${esc}: ${T.length} textos, ninguno cortado, fuera de su módulo o encimado${m2.length ? ': ' + m2.slice(0, 5).join(', ') : ''}`);
  }
  for (const [nom, a] of [['16:10', 1.6], ['16:9', 16 / 9]]) {
    const p = Y.buscarPoseSampler(S.GEO_DEFECTO, a, S.escalaEfectiva(1, true, a));
    check(!!p && p.pasada < 3 && p.legible >= S.LEGIBLE_MIN, `${nom}: cámara del modo atril fov ${p?.fov}° h ${p?.height.toFixed(2)} d ${p?.dist.toFixed(2)} pitch ${p?.pitch}° → texto más lejano ${(100 * (p?.legible ?? 0)).toFixed(2)} % (≥ 2,5 %)`);
  }
  check(/legibilidadMinimaM\(geoAtril\(\), cp, escalaEfectiva\(DBG_ATRIL_SAMPLER\.ETIQUETA_ESCALA/.test(LS) && /\|\| esSinte \|\| esSampler;/.test(LS), 'fitLecternCamera: el SM-40 busca como el de sonido y exige legibilidadMinimaM');
  check(Y.TEXTO_PLACA_M("IN-GO'S WAN INC.") === "SAMPLER SM-40 · IN-GO'S WAN INC. · SAMPLER DE 8 PADS · 4 MÓDULOS" && /TEXTO_PLACA_M\(NOMBRE_EMPRESA_MAYUS\)/.test(LS)
    && /<PlacaBarraSonido texto=\{TEXTO_PLACA_SAMPLER\} leyenda=\{LEYENDA_FILAS_M\}/.test(LS) && /esSampler && <PlacaFrenteSonido [^\n]*nombre=\{NOMBRE_EQUIPO_M\}/.test(LS) && /FRANJAS_PLACA/.test(COMP),
    'placa "SAMPLER SM-40 · IN-GO\'S WAN INC. · SAMPLER DE 8 PADS · 4 MÓDULOS" en la barra y en el frente; franjas de la marca');
  const a = { x: 0, z: 0, yaw: 0 }, b = { x: 0, z: 0, yaw: 0 };
  POSE.poseInstrumento(2, a); POSE.poseAtrilSampler(b);
  check(a.x === b.x && a.z === b.z && a.yaw === b.yaw && Y.ATRIL_SAMPLER.x === b.x && Y.ATRIL_SAMPLER.yaw === b.yaw && cerca(Math.hypot(b.x - POSE.EJE_INSTRUMENTOS.cx, b.z - POSE.EJE_INSTRUMENTOS.cz), POSE.radioCaja(), 1e-9),
    `poseAtrilSampler = poseInstrumento(2) (${f(b.x)}, ${f(b.z)}, yaw ${f(b.yaw * 180 / Math.PI, 1)}°), a la distancia de la caja (${f(POSE.radioCaja())} m); escribe ATRIL_SAMPLER`);
  check(/export const INDICE_SAMPLER = 2;/.test(POSE_SRC) && /poseInstrumento\(INDICE_SAMPLER, out\)/.test(cuerpo(POSE_SRC, 'poseAtrilSampler'))
    && /if \(side === "sampler"\) return poseAtrilSampler\(_poseLado\);/.test(LS) && /side === "sampler" && poseRef\.current\)[\s\S]{0,80}poseLado\("sampler"\)/.test(LS)
    && /frenteAtrilSampler:[\s\S]{0,160}poseAtrilSampler\(_poseSampler\)/.test(CKA) && /ATRIL_SAMPLER\.visible && Math\.hypot\(cam\.position\.x - ATRIL_SAMPLER\.x/.test(TS)
    && /dSampler = ATRIL_SAMPLER\.visible \? Math\.hypot\(camera\.position\.x - ATRIL_SAMPLER\.x/.test(LS),
    'pose y yaw de UNA fuente: pedestal, atril, cámara (poseLado), checkpoint (poseAtrilSampler); aviso "E" y tecla E leen ATRIL_SAMPLER');
  const escritores = ['lib', 'components'].flatMap(d => fs.readdirSync(new URL(`../${d}/`, import.meta.url), { recursive: true }).filter(n => /\.tsx?$/.test(n)).map(n => `../${d}/${n}`)).filter(p => /ATRIL_SAMPLER\.(x|z|yaw) =/.test(leer(p)));
  check(escritores.length === 1 && escritores[0].endsWith('instrumentosPose.ts'), 'solo lib/instrumentosPose.ts escribe la posición viva del SM-40');
  check(/\{ id: "atril_sampler", nombre: "Atril del sampler"/.test(CK) && /\["frenteAtrilSampler"\]/.test(CK), 'checkpoint "atril_sampler": atriles afuera y frente al SM-40'); }

console.log('\n(j) sin allocations en el reloj y en el dibujo');
{ const prohibido = /new |`|\[\s*\]|\[\s*[\w.]+\s*,|\.map\(|\.slice\(|\.filter\(|\.concat\(|\{\s*\.\.\./;
  const reloj = [cuerpoFlecha(MOTOR, 'oyenteReloj'), ...['cortar', 'apagarRanura', 'cancelarYMantener', 'tickSampler', 'quantActivo'].map(n => cuerpo(MOTOR, n))].join('\n');
  const puros = ['asignarRanura', 'cortarPad', 'vivas', 'padSonando', 'proximaGrilla', 'inicioCompas', 'picosOnda', 'velocidadDeAfinacion', 'rangoReproduccion', 'valorIdx'].map(n => cuerpo(PURO, n)).join('\n');
  const dib = ['dibujarDisplaySampler', 'dibujarContador', 'fuentesDisplay'].map(n => cuerpo(COMP, n)).join('\n');
  check(reloj.length > 1000 && !prohibido.test(sinCom(reloj)), 'oyente del reloj, cortes y cuadro: sin new, template strings ni arreglos u objetos nuevos');
  check(puros.length > 1500 && !prohibido.test(sinCom(puros)), 'funciones puras del bucle (ranuras, grilla, onda, recorte): sin allocations');
  check(dib.length > 900 && !/new |\[\s*\]|\.map\(|\.slice\(|\.filter\(/.test(sinCom(dib)), 'dibujo del display y del contador: sin allocations (el texto se arma solo al cambiar)');
  check(/if \(u\.va !== SAMPLER\.versionAudio \|\| u\.sel !== sel\) calcularOnda\(sel\);/.test(COMP) && /if \(!tocaActualizar\(ahora, u\.ms, DBG_ATRIL_SAMPLER\.VU_HZ\)\) return;[\s\S]*?if \(!enPantalla\(g, camera\)\) return;/.test(COMP),
    'la onda se recalcula solo al cambiar de pad o de audio; el display ≤ VU_HZ y con el atril en pantalla');
  check(/const IDS_PAD_M = Array\.from/.test(LS) && /ctrlState\[IDS_PAD_M\[p\]\]/.test(LS), 'luces de los pads: ids precalculados (sin template strings por cuadro)');
  check(!/createGain|createBiquadFilter|createAnalyser/.test(cuerpo(MOTOR, 'iniciarFuente')) && /createBufferSource\(\)/.test(cuerpo(MOTOR, 'iniciarFuente')),
    'por disparo solo se crea la fuente (de un solo uso); ganancias, filtro y salida nacen con el grafo'); }

console.log('\n(k) limpieza');
{ M.silenciarYReiniciarSampler(); RM.RITMOS.sonando = false;
  const limpiar = M.instalarSampler(), ctx = N.obtenerContexto(); ctx.currentTime = 50;
  const ones = N.RELOJ.oyentes.length;
  for (let k = 0; k < 5; k++) M.padAbajo(k);
  const vivas = FUENTES.slice(-5), d0 = CUENTA.disconnect;
  limpiar();
  check(vivas.every(s => s.parada !== null) && N.RELOJ.oyentes.length === ones - 1 && !M.SAMPLER.listo && CUENTA.disconnect - d0 >= 20, `al desmontar: se detienen todas las fuentes, se desuscribe del reloj y se desconectan los nodos (${CUENTA.disconnect - d0})`);
  check(/cancelarGrabacion\(\);/.test(cuerpo(MOTOR, 'liberarSampler')) && /GRAB\.stream\.getTracks\(\)\.forEach\(t => t\.stop\(\)\)/.test(cuerpo(MOTOR, 'cerrarEntradas')), 'liberarSampler cancela la grabación y cierra el micrófono');
  const td = COMP.slice(COMP.indexOf('export function TecladoSampler'));
  check(/window\.removeEventListener\("keydown", down\);/.test(td) && /window\.removeEventListener\("keyup", up\);/.test(td) && /window\.removeEventListener\("blur", soltarTodo\);/.test(td) && /document\.removeEventListener\("visibilitychange", onVis\);/.test(td),
    'se quitan los oyentes de teclas, foco y visibilidad');
  check(/const limpiar = instalarSampler\(\);[\s\S]{0,60}return \(\) => \{ limpiar\(\); ATRIL_SAMPLER\.visible = false; \};/.test(LS) && /r\.tex\.dispose\(\); r\.mat\.dispose\(\); r\.geo\.dispose\(\); r\.marcaGeo\.dispose\(\); r\.marcaMat\.dispose\(\);/.test(COMP),
    'el atril instala el motor al montar y lo libera al desmontar; contador y marca liberan textura, materiales y geometrías');
  check(/on\.connect\(entradaBus\(\)\)/.test(MOTOR) && /on\.connect\(analizador\)/.test(MOTOR) && !/vizAudio|obtenerSalidaTransmisible/.test(sinCom(MOTOR)), 'la salida entra al bus maestro con un analizador en derivación para el VU; vizAudio y la salida transmisible no se tocan'); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
