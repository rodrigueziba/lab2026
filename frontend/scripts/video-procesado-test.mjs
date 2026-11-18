// Z94: prueba del video procesado de la transmisión (lib/vivo/videoProcesado.ts): selección de fuente con respaldo, ciclo
// de vida sin fugas (crear y destruir varias veces), sin transmisión no se crea ningún recurso, cadencia/fps sin
// allocations, e integración leyendo el código (mismo shader y uniforms del domo, sin readPixels, prototype.render).
// Uso: node scripts/video-procesado-test.mjs
import fs from 'node:fs';
import { elegirFuenteVideo, normalizarFuenteVideo, Cadencia, TransmisionProcesada } from '../lib/vivo/videoProcesado.ts';
import { PublicadorLiveKit } from '../lib/vivo/liveKitCiclo.ts';

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const src = leer('../lib/debugConfig.ts');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string/g, '')});`)();
const L = obj('DBG_LIVEKIT');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };

console.log('\nconfiguración');
check(L.PROCESADO_TIMEOUT_S === 3 && L.FUENTE_VIDEO === 'procesado' && L.PROCESADO_ANCHO === 640 && L.PROCESADO_ALTO === 360 && L.VIDEO_FPS === 15 && L.VIDEO_KBPS === 500,
  'DBG_LIVEKIT: FUENTE_VIDEO procesado, 640×360, 15 fps, 500 kbps (bitrate de Z92 sin cambios)');
check(/videoTransmitidoTarima: true/.test(src) && /id: "videoTransmitidoTarima"/.test(leer('../lib/rendimiento.ts')), 'fila del benchmark "videoTransmitidoTarima"');

console.log('\nselección de fuente con respaldo');
const D = (p, w, o = true) => ({ procesado: p, webcam: w, ondas: o });
const e = (...a) => { const r = elegirFuenteVideo(...a); return `${r.efectiva}|${r.respaldo}`; };
check(e('procesado', 'cara', D(true, true)) === 'procesado|false', 'procesado disponible → procesado (con webcam)');
check(e('procesado', 'privado', D(true, false)) === 'procesado|false', 'modo privado (sin webcam): también el pase procesado (de las ondas)');
check(e('procesado', 'cara', D(false, true)) === 'cruda|true' && elegirFuenteVideo('procesado', 'cara', D(false, true)).motivo === 'pase procesado no disponible', 'procesado NO disponible → respaldo "cruda" con motivo');
check(e('procesado', 'privado', D(false, false)) === 'ondas|true', 'sin pase ni webcam → ondas (como Z92)');
check(e('cruda', 'cara', D(true, true)) === 'cruda|false' && e('cruda', 'cara', D(true, false)) === 'ondas|false' && e('cruda', 'privado', D(true, true)) === 'ondas|false', '"cruda" = Z92 tal cual (webcam en modo cara; si no, ondas)');
check(e('ondas', 'cara', D(true, true)) === 'ondas|false', '"ondas": el canvas de ondas');
check(normalizarFuenteVideo('cualquiera') === 'procesado' && normalizarFuenteVideo('cruda') === 'cruda', 'valor desconocido → procesado');
check(elegirFuenteVideo('procesado', 'cara', D(true, true)) === elegirFuenteVideo('cruda', 'cara', D(true, true)), 'objeto de resultado reutilizado (sin allocations)');

console.log('\ncadencia y fps real');
{ const c = new Cadencia(); let n = 0;
  for (let t = 0; t <= 2000; t += 1000 / 60) if (c.toca(t, 15)) { c.dibujado(t); n++; }
  check(n >= 29 && n <= 32, `a 60 Hz con fps 15: ${n} cuadros en 2 s (~30)`);
  check(c.fpsReal > 14 && c.fpsReal < 16.5, `fps real ${c.fpsReal.toFixed(1)}`);
  const c2 = new Cadencia(); let m = 0;
  for (let t = 0; t <= 1000; t += 1000 / 30) if (c2.toca(t, 15)) { c2.dibujado(t); m++; }
  check(m >= 14 && m <= 16, `a 30 Hz con fps 15: ${m} cuadros en 1 s`); }

console.log('\nciclo de vida (sin fugas, sin recursos sin transmisión)');
let RELOJ = 0;
const reloj = () => RELOJ;
function fabrica() {
  const F = { vivos: new Set(), pistasVivas: new Set(), creados: 0, falla: false, buffers: new Set(), pintados: 0, requestFrame: 0 };
  F.fab = { crear: (w, h) => {
    if (F.falla) return null;
    const pista = { id: ++F.creados };
    const l = { canvas: { w, h }, ctx: {}, pista, buffer: new Uint8Array(w * h * 4),
      pintar: () => { F.pintados++; F.requestFrame++; },
      detenerPista: () => F.pistasVivas.delete(pista), quitar: () => F.vivos.delete(l) };
    F.requestFrame++;   // primer cuadro (negro) pedido al crear
    F.vivos.add(l); F.pistasVivas.add(pista); F.buffers.add(l.buffer); return l; } };
  return F;
}
{ const F = fabrica(), T = new TransmisionProcesada(F.fab, reloj);
  check(!T.activa && T.lienzo === null && F.creados === 0, 'sin transmisión: ningún canvas, buffer, pista ni recurso');
  check(!T.empezarLectura(RELOJ), 'sin transmisión no se empieza ninguna lectura');
  for (let i = 0; i < 5; i++) {
    const r = T.iniciar(640, 360, 15);
    if (!r || !T.activa) break;
    T.iniciar(640, 360, 15);   // repetido: no crea otro
    T.empezarLectura(RELOJ);        // una lectura queda en vuelo al cortar
    T.liberar(); T.liberar();  // doble liberación inocua
    T.alLeer();                // la lectura pendiente llega tarde: se ignora
  }
  check(F.creados === 5 && T.creados === 5 && T.liberados === 5, 'crear y destruir 5 veces: 5 creados, 5 liberados (iniciar repetido no duplica)');
  check(F.vivos.size === 0 && F.pistasVivas.size === 0 && !T.activa && !T.enVuelo, 'sin canvas ni pistas colgados; ninguna lectura en vuelo');
  check(T.ignoradas === 5 && F.pintados === 0, 'lecturas pendientes al cortar: ignoradas (no pintan en un canvas liberado)');
  const r = T.iniciar(640, 360, 15);
  check(r && T.ancho === 640 && T.alto === 360 && T.lienzo.buffer.length === 640 * 360 * 4, 'iniciar: canvas 640×360 y buffer único de 640·360·4');
  check(F.requestFrame === 6, 'cada pista nace con un primer cuadro pedido (nunca vacía)');
  T.liberar(); }
{ const F = fabrica(); F.falla = true; const T = new TransmisionProcesada(F.fab, reloj);
  check(T.iniciar(640, 360, 15) === null && !T.activa && T.fallo === 'no se pudo crear el canvas transmisible', 'si el canvas no se puede crear: null con motivo (el publicador cae a "cruda")'); }
{ const T = new TransmisionProcesada({ crear: () => { throw new Error('sin 2d'); } }, reloj);
  check(T.iniciar(640, 360, 15) === null && T.fallo === 'no se pudo crear el canvas: sin 2d', 'una excepción de la fábrica no se propaga y deja el motivo'); }

console.log('\nZ94b: una sola lectura en vuelo, requestFrame por cuadro, sin allocations');
{ const F = fabrica(), T = new TransmisionProcesada(F.fab, reloj);
  RELOJ = 0; T.iniciar(640, 360, 15);
  const buf = T.lienzo.buffer, rfIni = F.requestFrame;
  let maxVuelo = 0, enVuelo = 0, pend = [];
  // host simulado a 60 Hz; la lectura tarda 3 cuadros (50 ms)
  for (let f = 0; f < 120; f++) {
    RELOJ = f * 1000 / 60;
    pend = pend.filter(p => { if (RELOJ >= p) { enVuelo--; T.alLeer(); return false; } return true; });
    if (T.cadencia.toca(RELOJ, 15) && T.empezarLectura(RELOJ)) { enVuelo++; pend.push(RELOJ + 50); }
    maxVuelo = Math.max(maxVuelo, enVuelo);
  }
  check(maxVuelo === 1, 'nunca más de una lectura en vuelo');
  check(T.lecturas >= 28 && T.lecturas <= 31, `~15 cuadros por segundo (${T.lecturas} en 2 s)`);
  check(F.requestFrame - rfIni === T.pintados && T.pintados === T.lecturas, 'requestFrame exactamente una vez por cuadro actualizado');
  check(T.lienzo.buffer === buf && F.buffers.size === 1, 'buffer reutilizado (un único Uint8Array por transmisión)');
  check(T.estadoLectura === 'ok' && T.cadencia.fpsReal > 13 && T.cadencia.fpsReal < 16.5, `estado "ok", ${T.cadencia.fpsReal.toFixed(1)} fps reales`);
  // lectura lenta: se saltean cuadros
  pend.forEach(() => T.alLeer());
  const s0 = T.saltados;
  T.empezarLectura(RELOJ); for (let k = 0; k < 3; k++) T.empezarLectura(RELOJ);
  check(T.saltados - s0 === 3 && T.estadoLectura === 'saltando', 'lectura lenta: "saltando cuadros" (3 salteados)');
  T.alFallar(new Error('GL_INVALID_OPERATION: readPixels'));
  check(T.estadoLectura === 'falló' && T.motivoLectura === 'GL_INVALID_OPERATION: readPixels' && !T.enVuelo, 'lectura fallida: "falló" con el motivo real y libera el turno');
  T.liberar(); }
check(T_handlersEstables(), 'los handlers de la lectura se crean una vez (sin closures por cuadro)');
function T_handlersEstables() { const T = new TransmisionProcesada(fabrica().fab, reloj); const a = T.alLeer, b = T.alFallar; T.iniciar(640, 360, 15); T.liberar(); return a === T.alLeer && b === T.alFallar; }

console.log('\nZ94b: vigía (timeout) y respaldo con reloj simulado');
{ const F = fabrica(), T = new TransmisionProcesada(F.fab, reloj);
  RELOJ = 1000; T.iniciar(640, 360, 15);
  check(T.vigilar(3900, 3, false) === '', 'antes de 3 s sin lecturas: nada');
  check(T.vigilar(4000, 3, false).startsWith('ninguna lectura en 3 s'), 'a los 3 s sin ninguna lectura: motivo → respaldo');
  T.marcarFallo('el domo de la tarima no está en pantalla');
  check(T.vigilar(4000, 3, false) === 'ninguna lectura en 3 s (el domo de la tarima no está en pantalla)', 'el motivo incluye la causa real');
  RELOJ = 1500; T.empezarLectura(RELOJ); T.alLeer();
  check(T.vigilar(4400, 3, false) === '', 'con lecturas recientes: nada');
  check(T.vigilar(4500, 3, false).startsWith('sin cuadros nuevos en 3 s'), '3 s seguidos sin cuadros nuevos: motivo → respaldo');
  check(T.vigilar(9000, 3, true) === '' && T.vigilar(9100, 3, false) === '', 'benchmark (pausa intencional): no dispara el respaldo');
  T.liberar(); check(T.vigilar(99999, 3, false) === '', 'sin transmisión: el vigía no hace nada'); }
{ // respaldo en caliente: cambiarVideo del publicador (mismo publicador, sin reconectar, audio intacto)
  const sala = { conectada: false, desconectada: 0, video: null, audio: null, reemplazos: [],
    conectar: async () => { sala.conectada = true; }, publicarVideo: async p => { sala.video = p; }, publicarAudio: async p => { sala.audio = p; },
    reemplazarVideo: async p => { sala.reemplazos.push(p); }, alEvento: () => {}, pausar: () => {}, kbps: () => 0, desconectar: () => { sala.desconectada++; } };
  const lib = { proc: 0, cruda: 0 };
  const deps = { pedirToken: async () => ({ ok: true, token: 't', url: 'wss://x' }), crearSala: async () => sala,
    video: () => ({ track: 'proc', liberar: () => lib.proc++ }), audio: () => ({ track: 'a', liberar: () => {} }) };
  const P = new PublicadorLiveKit(deps, L);
  P.iniciar({ consentimiento: true, modo: 'cara', sesionId: 'sesion-abc12345' });
  for (let k = 0; k < 20; k++) await Promise.resolve();
  check(P.estado === 'publicando' && sala.video.track === 'proc', 'publica la pista procesada');
  const ok = await P.cambiarVideo({ track: 'cruda', liberar: () => lib.cruda++ });
  check(ok && sala.reemplazos.length === 1 && sala.reemplazos[0].track === 'cruda', 'respaldo: reemplaza la pista en el mismo publicador (replaceTrack)');
  check(lib.proc === 1 && sala.desconectada === 0 && P.estado === 'publicando' && sala.audio.track === 'a', '…libera la procesada sin desconectar ni tocar el audio');
  P.detener();
  check(lib.cruda === 1 && P.recursosVivos === 0, 'cortar después del respaldo libera la pista cruda');
  const ok2 = await P.cambiarVideo({ track: 'x', liberar: () => lib.cruda++ });
  check(!ok2 && lib.cruda === 2, 'sin transmisión: no reemplaza y libera la pista nueva'); }

console.log('\nintegración (lectura del código)');
{ const H = leer('../components/VideoTransmitidoTarima.tsx'), P = leer('../lib/vivo/publicarLiveKit.ts'), FD = leer('../components/FaceDome.tsx'), TS = leer('../components/ThreeScene.tsx'), RP = leer('../components/RetroPostFX.tsx');
  check(/export const DOME_FRAG/.test(FD) && /fragmentShader: FRAG/.test(H) && /DOME_FRAG\.replace/.test(H), 'mismo fragment shader del domo (efectos por sector, psico, ajustes del atril)');
  check(/uniforms: \{ \.\.\.base\.uniforms, uEspejo: U_ESPEJO, uSrgb: U_SRGB \}/.test(H), 'uniforms del domo compartidos por referencia: el atril y los glitches se ven en vivo');
  check(!/prototype\.render/.test(H.replace(/\/\/.*$/gm, '')) && /RENDER_ORIGINAL\.fn = origRender/.test(RP) && /const r = RENDER_ORIGINAL\.fn;/.test(H), 'render original expuesto por RetroPostFX (Z94 usaba prototype.render: undefined en three 0.183)');
  check(/new THREE\.WebGLRenderTarget\(T\.ancho, T\.alto, \{[\s\S]*?format: THREE\.RGBAFormat, type: THREE\.UnsignedByteType, generateMipmaps: false/.test(H), 'render target propio 640×360 RGBA UnsignedByte sin mipmaps');
  check(/gl\.readRenderTargetPixelsAsync\(g\.rt, 0, 0, T\.ancho, T\.alto, l\.buffer\)\.then\(T\.alLeer, T\.alFallar\)/.test(H) && !/drawImage/.test(H.replace(/\/\/.*$/gm, '')), 'lectura asíncrona al buffer único; sin drawImage del canvas WebGL');
  check(/if \(!T\.empezarLectura\(ahora\)\) return;/.test(H), 'una lectura en vuelo como máximo (si no, se saltea el cuadro)');
  check(/1\.0 - uv\.y/.test(H), 'orientación corregida en el vertex (sin trabajo extra)');
  check(/captureStream\(0\)/.test(P) && /pintar: \(\) => \{ ctx\.putImageData\(imagen, 0, 0\); pista\.requestFrame\(\); \}/.test(P) && /pista\.requestFrame\(\);   \/\/ primer cuadro/.test(P), 'captureStream(0) + putImageData + requestFrame por cuadro; primer cuadro antes de publicar');
  check(/new ImageData\(new Uint8ClampedArray\(buffer\.buffer\), ancho, alto\)/.test(P), 'ImageData único sobre la misma memoria que el buffer (sin copias)');
  check(/soltar\(gpu\.current\); gpu\.current = null; \} return; \}/.test(H) && /g\.rt\.dispose\(\)/.test(H), 'sin transmisión: libera render target, material y quad');
  check(/SIS\.videoTransmitidoTarima === false\) return;/.test(H), 'benchmark: apagado no dibuja');
  check(/await videoLocal\.replaceTrack\(p\.track as MediaStreamTrack, true\)/.test(P) && /TX_PROC\.vigilar\(performance\.now\(\), DBG_LIVEKIT\.PROCESADO_TIMEOUT_S/.test(P), 'vigía cada 0,5 s y respaldo con replaceTrack (sin reconectar)');
  check(/procesado falló: \$\{motivo\} → \$\{VIDEO_TX\.efectiva\}/.test(P) && !/console\.(error|warn)/.test(H + P), 'línea de estado "procesado falló: <motivo> → cruda", sin errores en consola');
  check(/data-debug-panel/.test(P) && /export function alternarPanelCuadro/.test(P), 'panel "Ver el cuadro procesado" (oculto por defecto)');
  check(/FACE_DOME_VIS\.value = showDome/.test(FD) && /PASE_HOST\.listo = FACE_DOME_VIS\.value && !!base/.test(H), 'disponible solo con el domo de la tarima en pantalla');
  check(/path !== "sillas" && <VideoTransmitidoTarima \/>/.test(TS), 'montado en el camino de la tarima'); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
