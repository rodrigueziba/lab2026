// Z106: grabación del SM-40 (lib/muestreoGrabacion.ts + lib/audio/sampler.ts) con getUserMedia y MediaRecorder simulados.
// (a) recorrido feliz; (b) errores de getUserMedia; (c) elección de mimeType; (d) corte a los 8 s; (e) parar y cancelar
// liberan las pistas; (f) pointer lock: se libera antes del pedido y se recupera después; (g) lectura de código;
// (h) MEZCLA con un destino simulado. Además: el motor real con el navegador simulado (pad cargado, error visible,
// console.warn [SM-40]). Uso: node scripts/muestreo-grabacion-test.mjs
import fs from 'node:fs';
import { register } from 'node:module';
const RAIZ = new URL('../', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`const R = ${JSON.stringify(RAIZ)};
export async function resolve(s, c, n) {
  if (s.startsWith('@/')) s = R + s.slice(2);
  if ((/^\\.\\.?\\//.test(s) || s.startsWith('file:')) && !/\\.[a-z]+$/.test(s)) { try { return await n(s + '.ts', c); } catch {} }
  return n(s, c);
}`));
const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const sinCom = t => t.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const espera = ms => new Promise(r => setTimeout(r, ms));
const L = await import('../lib/muestreoGrabacion.ts');

// ── navegador simulado para el orquestador ──
function entorno(o = {}) {
  const log = [], C = { pistasCerradas: 0, cerrarMezcla: 0, listo: 0, avisos: [] };
  let reloj = 0, pendiente = null;
  const pista = () => ({ stop() { C.pistasCerradas++; } });
  class Rec {
    constructor(stream, mime) { this.stream = stream; this.mimeType = mime || 'audio/webm'; this.state = 'inactive'; this.ondataavailable = null; this.onstop = null; this.onerror = null; log.push('grabador ' + (mime || '(del navegador)')); }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; if (o.sinDatos !== true) this.ondataavailable?.({ data: { size: 128 } }); this.onstop?.(); }
  }
  const e = L.crearEstadoMuestreo();
  const deps = {
    pedirMic: () => { log.push('pedirMic'); if (o.error) { const x = new Error(o.mensaje ?? 'simulado'); x.name = o.error; return Promise.reject(x); }
      if (o.manual) return new Promise((res) => { pendiente = () => res({ getTracks: () => [pista(), pista()] }); });
      return Promise.resolve({ getTracks: () => [pista(), pista()] }); },
    crearGrabador: (s, m) => { const r = new Rec(s, m); C.rec = r; return r; },
    soporta: o.soporta === undefined ? (m => ['audio/webm;codecs=opus', 'audio/webm'].includes(m)) : o.soporta,
    aArrayBuffer: () => Promise.resolve(new ArrayBuffer(16)),
    decodificar: () => (o.decodeFalla ? Promise.reject(Object.assign(new Error('bad'), { name: 'EncodingError' })) : Promise.resolve({ duracion: 1.2 })),
    ahora: () => reloj,
    puntero: o.puntero,
    alListo: (buf, pad, fuente) => { C.listo++; C.pad = pad; C.fuente = fuente; C.buf = buf; return 0.42; },
    alCambio: ee => log.push('fase ' + ee.fase),
    avisar: (n, m) => C.avisos.push(`[SM-40] ${n}: ${m}`),
  };
  const g = L.crearGrabacion(e, deps);
  return { e, g, log, C, avanzar: s => { reloj += s; }, conceder: () => pendiente?.() };
}
const tic = () => espera(0);

console.log('\n(a) recorrido feliz');
{ const T = entorno();
  check(T.g.iniciar('MIC', 2, 8) && T.e.fase === 'pidiendo', 'GRABAR con MIC pide el permiso (fase "pidiendo")');
  await tic();
  check(T.e.fase === 'grabando' && T.e.mime === 'audio/webm;codecs=opus' && T.log.includes('grabador audio/webm;codecs=opus'), 'permiso concedido: graba con un formato soportado (audio/webm;codecs=opus)');
  T.avanzar(1.5); T.g.tick();
  check(Math.abs(T.e.segundos - 1.5) < 1e-9 && L.textoMuestreo(T.e) === 'MIC: GRABANDO 1,5 / 8 S', `cuenta los segundos (${L.textoMuestreo(T.e)})`);
  T.g.parar(); await tic(); await tic(); await tic();
  check(T.e.fase === 'listo' && T.C.listo === 1 && T.C.pad === 2 && T.C.fuente === 'MIC' && T.e.pico === 0.42, 'trozos → Blob → decodeAudioData → el audio queda en el pad 3 (estado "listo")');
  check(T.C.pistasCerradas === 2 && T.g.stream() === null && T.g.grabador() === null, 'las pistas del micrófono se detienen al terminar');
  check(L.textoMuestreo(T.e, T.e.tFin + 1) === 'MIC: LISTO, PAD 3' && L.textoMuestreo(T.e, T.e.tFin + 7, 6) === '', '"MIC: LISTO, PAD 3" y después se apaga solo');
  check(T.log.join(' > ') === 'pedirMic > fase pidiendo > grabador audio/webm;codecs=opus > fase grabando > fase procesando > fase listo'.replace('pedirMic > fase pidiendo', 'fase pidiendo > pedirMic'), `orden: ${T.log.join(' > ')}`);
  const D = entorno({ decodeFalla: true }); D.g.iniciar('MIC', 0, 8); await tic(); D.g.parar(); await tic(); await tic(); await tic();
  check(D.e.fase === 'error' && D.e.codigo === 'decodificar' && /NO SE PUDO LEER EL AUDIO/.test(L.textoMuestreo(D.e)), 'si decodeAudioData falla: error visible "NO SE PUDO LEER EL AUDIO"');
  const V = entorno({ sinDatos: true }); V.g.iniciar('MIC', 0, 8); await tic(); V.g.parar(); await tic();
  check(V.e.fase === 'error' && V.e.codigo === 'vacio' && V.C.pistasCerradas === 2, 'si el grabador no entrega audio: error "NO LLEGÓ AUDIO" (antes volvía a libre sin decir nada) y se cierran las pistas'); }

console.log('\n(b) errores de getUserMedia');
{ const esperado = { NotAllowedError: 'DENEGADO (REVISÁ EL CANDADO DEL NAVEGADOR)', NotFoundError: 'NO HAY MICRÓFONO', NotReadableError: 'EN USO POR OTRA APP', OverconstrainedError: 'EL MICRÓFONO NO ACEPTA EL PEDIDO', SecurityError: 'BLOQUEADO POR SEGURIDAD (HACE FALTA HTTPS)' };
  for (const [nombre, msj] of Object.entries(esperado)) {
    const T = entorno({ error: nombre, mensaje: 'detalle del navegador' }); T.g.iniciar('MIC', 1, 8); await tic();
    check(T.e.fase === 'error' && L.textoMuestreo(T.e) === 'MIC: ' + msj && T.e.nombreError === nombre && !T.g.viva() && T.C.avisos.length === 1 && T.C.avisos[0].startsWith('[SM-40] ' + nombre) && T.C.avisos[0].includes('detalle del navegador'),
      `${nombre} → "MIC: ${msj}", no queda en "grabando" y avisa por consola con el nombre y el mensaje`);
    check(T.g.iniciar('MIC', 1, 8), `  después de ${nombre} se puede volver a intentar`);
  } }

console.log('\n(c) elección de mimeType');
{ const s = lista => m => lista.includes(m);
  check(L.elegirMime(s(['audio/webm;codecs=opus', 'audio/webm'])).mime === 'audio/webm;codecs=opus', 'Chrome: audio/webm;codecs=opus');
  check(L.elegirMime(s(['audio/mp4'])).mime === 'audio/mp4', 'Safari: audio/mp4');
  check(L.elegirMime(s(['audio/ogg;codecs=opus'])).mime === 'audio/ogg;codecs=opus', 'solo ogg: audio/ogg;codecs=opus');
  check(!L.elegirMime(s([])).ok, 'lista vacía: no hay formato');
  check(L.elegirMime(null).ok && L.elegirMime(null).mime === '', 'sin isTypeSupported: se usa el formato del navegador');
  check(L.elegirMime(() => { throw new Error('x'); }).ok === false, 'si isTypeSupported tira error, cuenta como no soportado');
  const T = entorno({ soporta: () => false }); T.g.iniciar('MIC', 0, 8); await tic();
  check(T.e.fase === 'error' && L.textoMuestreo(T.e) === 'MIC: FORMATO NO SOPORTADO' && T.C.pistasCerradas === 2, 'grabar con lista vacía: "MIC: FORMATO NO SOPORTADO" y se cierra el micrófono'); }

console.log('\n(d) corte a los 8 s');
{ const T = entorno(); T.g.iniciar('MIC', 4, 8); await tic();
  T.avanzar(7.9); check(!T.g.tick() && T.e.fase === 'grabando', 'a los 7,9 s sigue grabando');
  T.avanzar(0.1); const corto = T.g.tick(); await tic(); await tic(); await tic();
  check(corto && T.e.fase === 'listo' && T.C.listo === 1 && T.C.pistasCerradas === 2, 'a los 8 s corta y GUARDA (pad cargado, pistas cerradas)'); }

console.log('\n(e) parar y cancelar');
{ const T = entorno(); T.g.iniciar('MIC', 0, 8); await tic(); T.g.parar(); await tic(); await tic(); await tic();
  check(T.C.pistasCerradas === 2 && T.e.fase === 'listo', 'PARAR (clic o tecla) durante la grabación: guarda y libera las pistas');
  const C2 = entorno(); C2.g.iniciar('MIC', 0, 8); await tic(); C2.g.cancelar(); await tic(); await tic();
  check(C2.C.pistasCerradas === 2 && C2.e.fase === 'inactivo' && C2.C.listo === 0 && !C2.g.viva(), 'cancelar (menú, reinicio, desmontar): libera las pistas y no guarda');
  const P = entorno({ manual: true }); P.g.iniciar('MIC', 0, 8);
  P.g.parar(); P.g.parar();
  check(P.e.fase === 'pidiendo', 'un segundo GRABAR mientras el navegador espera el permiso NO cancela (antes descartaba en silencio el permiso que llegaba después)');
  P.conceder(); await tic();
  check(P.e.fase === 'grabando', 'cuando el usuario acepta, graba');
  const Q = entorno({ manual: true }); Q.g.iniciar('MIC', 0, 8); Q.g.cancelar(); Q.conceder(); await tic();
  check(Q.C.pistasCerradas === 2 && Q.e.fase === 'inactivo' && !Q.C.rec, 'si se cancela y el permiso llega tarde, las pistas se detienen igual (no queda el micrófono abierto)'); }

console.log('\n(f) pointer lock');
{ const orden = [];
  const pt = { bloqueado: () => true, liberar: () => orden.push('liberar'), recuperar: () => orden.push('recuperar') };
  const T = entorno({ puntero: pt }); const log = T.log;
  const p0 = T.g.iniciar('MIC', 0, 8); const antes = [...orden, ...log.filter(x => x === 'pedirMic')];
  await tic();
  check(p0 && antes.join(' > ') === 'liberar > pedirMic' && orden.join(' > ') === 'liberar > recuperar' && T.e.fase === 'grabando', `con el puntero bloqueado: libera, pide el permiso y recupera al responder (${orden.join(' > ')})`);
  const o2 = [], T2 = entorno({ puntero: { bloqueado: () => true, liberar: () => o2.push('liberar'), recuperar: () => o2.push('recuperar') }, error: 'NotAllowedError' });
  T2.g.iniciar('MIC', 0, 8); await tic();
  check(o2.join(' > ') === 'liberar > recuperar' && T2.e.fase === 'error', 'también recupera si el permiso se deniega');
  const o3 = [], T3 = entorno({ puntero: { bloqueado: () => false, liberar: () => o3.push('liberar'), recuperar: () => o3.push('recuperar') } });
  T3.g.iniciar('MIC', 0, 8); await tic();
  check(o3.length === 0, 'sin pointer lock (el modo atril ya lo libera) no toca nada'); }

console.log('\n(h) MEZCLA');
{ let cerrada = 0;
  const T = entorno(); const st = { getTracks: () => [] };
  check(T.g.iniciar('MEZCLA', 5, 8, { stream: st, cerrar: () => { cerrada++; } }) && T.e.fase === 'grabando' && !T.log.includes('pedirMic'), 'MEZCLA graba el stream del destino (sin pedir el micrófono) con el mismo MediaRecorder');
  T.g.parar(); await tic(); await tic(); await tic();
  check(T.e.fase === 'listo' && cerrada === 1 && T.C.fuente === 'MEZCLA' && T.C.pad === 5, 'al terminar: el mismo decodeAudioData, el audio va al pad 6 y se desconecta la derivación');
  const N = entorno(); N.g.iniciar('MEZCLA', 0, 8, null);
  check(N.e.fase === 'error' && L.textoMuestreo(N.e) === 'MEZCLA: NO HAY NADA SONANDO', 'sin bus armado: "MEZCLA: NO HAY NADA SONANDO"'); }

// ── el motor real con el navegador simulado ──
console.log('\nmotor (lib/audio/sampler.ts) con el navegador simulado');
{ class Param { constructor(v = 0) { this.value = v; } setTargetAtTime() { return this; } setValueAtTime() { return this; } linearRampToValueAtTime() { return this; } cancelScheduledValues() { return this; } cancelAndHoldAtTime() { return this; } }
  class Nodo { connect(x) { return x; } disconnect() {} }
  class Buf { constructor(nc, len, sr) { this.numberOfChannels = nc; this.length = len; this.sampleRate = sr; this.duration = len / sr; this._c = Array.from({ length: nc }, () => new Float32Array(len)); } getChannelData(i) { return this._c[i]; } }
  class Fuente extends Nodo { constructor() { super(); this.playbackRate = new Param(1); } start() {} stop() {} }
  let PICO = 0.05, PEDIDOS = 0, MODO = 'ok', CERRADAS = 0;
  class Ctx {
    constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 48000; this.destination = new Nodo(); }
    resume() { return Promise.resolve(); }
    createGain() { const g = new Nodo(); g.gain = new Param(1); return g; }
    createBiquadFilter() { const f = new Nodo(); f.frequency = new Param(350); f.Q = new Param(1); return f; }
    createAnalyser() { const a = new Nodo(); a.fftSize = 2048; return a; }
    createWaveShaper() { return new Nodo(); }
    createOscillator() { const o = new Fuente(); o.frequency = new Param(440); o.detune = new Param(0); return o; }
    createBuffer(nc, len, sr) { return new Buf(nc, len, sr); }
    createBufferSource() { return new Fuente(); }
    createMediaStreamDestination() { const d = new Nodo(); d.stream = { getTracks: () => [] }; return d; }
    decodeAudioData() { const b = new Buf(1, 48000, 48000); b.getChannelData(0)[100] = PICO; return Promise.resolve(b); }
  }
  class Rec { constructor() { this.state = 'inactive'; this.mimeType = 'audio/webm;codecs=opus'; } start() { this.state = 'recording'; } stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob([new Uint8Array(16)]) }); this.onstop?.(); } }
  Rec.isTypeSupported = m => m.startsWith('audio/webm');
  globalThis.AudioContext = Ctx; globalThis.MediaRecorder = Rec;
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: { getUserMedia: () => { PEDIDOS++; if (MODO !== 'ok') { const e = new Error('Permission denied by system'); e.name = MODO; return Promise.reject(e); } return Promise.resolve({ getTracks: () => [{ stop() { CERRADAS++; } }] }); } } }, configurable: true });
  const avisos = []; const warn0 = console.warn; console.warn = (...a) => avisos.push(a.join(' '));
  const M = await import('../lib/audio/sampler.ts');
  const { DBG_SAMPLER: CS } = await import('../lib/debugConfig.ts');
  const limpiar = M.instalarSampler();
  check(PEDIDOS === 0, 'el motor no pide el micrófono al montar');
  CS.FUENTE_GRAB = 0; M.seleccionarPad(2);
  M.grabar(); await espera(5); M.pararGrabacion(); await espera(10);
  check(M.MUESTREO.fase === 'listo' && M.SAMPLER.grabado[2] === 1 && M.SAMPLER.estadoGrab === 'libre' && CERRADAS === 1, 'MIC: el pad 3 queda cargado, el estado vuelve a libre y la pista se cierra');
  const d = M.datosPad(2); let p = 0; for (const v of d) p = Math.max(p, Math.abs(v));
  check(Math.abs(M.MUESTREO.pico - 0.05) < 1e-6 && Math.abs(p - 0.9) < 1e-6, `una grabación baja (pico 0,05, sin AGC) se normaliza a 0,9 como los sonidos de fábrica (GRAB_NORMALIZAR)`);
  check(/MIC: LISTO, PAD 3/.test(M.textoGrabacion()), 'el atril muestra "MIC: LISTO, PAD 3"');
  MODO = 'NotAllowedError'; M.grabar(); await espera(5);
  check(M.MUESTREO.fase === 'error' && M.SAMPLER.estadoGrab === 'libre' && M.textoGrabacion() === 'MIC: DENEGADO (REVISÁ EL CANDADO DEL NAVEGADOR)' && /DENEGADO/.test(M.SAMPLER.mensaje),
    'permiso denegado (también el del sistema en macOS): el atril muestra el motivo y no queda trabado');
  check(avisos.some(a => /^\[SM-40\] NotAllowedError: .*Permission denied by system/.test(a)), 'consola: console.warn("[SM-40] NotAllowedError: … Permission denied by system")');
  MODO = 'ok'; CS.FUENTE_GRAB = 1; M.seleccionarPad(5); M.padAbajo(0); M.seleccionarPad(5);
  M.grabar(); await espera(5);
  check(M.MUESTREO.fuente === 'MEZCLA' && M.SAMPLER.estadoGrab === 'grabando' && M.GRAB.tap !== null, 'MEZCLA en el motor: derivación del analizador maestro conectada mientras graba');
  M.pararGrabacion(); await espera(10);
  check(M.MUESTREO.fase === 'listo' && M.SAMPLER.grabado[5] === 1 && M.GRAB.tap === null, 'MEZCLA: el pad 6 queda cargado y la derivación se desconecta');
  limpiar(); console.warn = warn0; CS.FUENTE_GRAB = 0; }

console.log('\n(g) lectura de código');
{ const MOTOR = leer('../lib/audio/sampler.ts'), PURO = leer('../lib/muestreoGrabacion.ts'), LS = leer('../components/LecternSystem.tsx'), AT = leer('../components/AtrilSamplerNuevo.tsx'), TS = leer('../components/ThreeScene.tsx');
  check(!/^import /m.test(PURO), 'lib/muestreoGrabacion.ts sin imports (lógica pura)');
  const usos = (sinCom(MOTOR).match(/getUserMedia\(/g) || []).length;
  check(usos === 2 && /pedirMic: \(\) => navigator\.mediaDevices\.getUserMedia\(restriccionesMic\(\)\)/.test(MOTOR) && /export async function probarMicrofono/.test(MOTOR)
    && !/getUserMedia/.test(sinCom(AT)) && !/getUserMedia/.test(sinCom(LS)) && !/getUserMedia/.test(sinCom(MOTOR.slice(MOTOR.indexOf('export function instalarSampler'), MOTOR.indexOf('export function instalarSampler') + 400))),
    'el permiso se pide solo al apretar GRABAR con MIC o «Probar micrófono ahora»; nunca al montar');
  check(/const soltarEntradas = \(\) => \{[\s\S]*?t\.stop\(\)/.test(PURO) && /fallar = \([^)]*\) => \{\s*soltarEntradas\(\);/.test(PURO) && /cancelar\(\) \{[\s\S]*?soltarEntradas\(\);/.test(PURO) && /r\.onstop = \(\) => \{[\s\S]*?soltarEntradas\(\);/.test(PURO) && /miTurno !== turno \|\| e\.fase !== "pidiendo"\) \{ try \{ s\.getTracks\(\)\.forEach\(t => t\.stop\(\)\)/.test(PURO)
    && /st\?\.getTracks\(\)\.forEach\(t => t\.stop\(\)\)/.test(MOTOR),
    'las pistas se detienen siempre: al terminar, con error, al cancelar, si el permiso llega tarde y en la prueba del menú');
  check(/echoCancellation: DBG_SAMPLER\.GRAB_ECO, noiseSuppression: DBG_SAMPLER\.GRAB_RUIDO, autoGainControl: DBG_SAMPLER\.GRAB_AGC/.test(MOTOR) && /GRAB_ECO:\s+false/.test(leer('../lib/debugConfig.ts')),
    'procesamiento del micrófono en constantes de debug (apagado por defecto para samplear)');
  check(/console\.warn\(`\[SM-40\] \$\{nombre\}: \$\{msj\}`\)/.test(MOTOR), 'consola: prefijo [SM-40] con el nombre y el mensaje del error');
  check(/u\.l2 \|\| TEXTO_REPOSO_SAMPLER/.test(AT), 'el display del atril muestra el estado de la grabación (y el motivo de una falla) en su línea 2');
  check(/MIC: SI COMPARTÍS, SE TRANSMITE/.test(MOTOR), 'se mantiene la advertencia "MIC: SI COMPARTÍS, SE TRANSMITE"');
  check(/sin pose de 60° a 90° con proporción/.test(LS) && !/No pose found for side=/.test(LS), 'aviso de pose del atril: dice la causa real (la proporción de la ventana)');
  check(/shadows="percentage"/.test(TS), 'sombras: PCFShadowMap explícito (el que three ya usaba), sin el aviso de PCFSoftShadowMap'); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
