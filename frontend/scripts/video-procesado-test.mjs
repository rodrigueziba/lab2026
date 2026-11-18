// Z94: prueba del video procesado de la transmisión (lib/vivo/videoProcesado.ts): selección de fuente con respaldo, ciclo
// de vida sin fugas (crear y destruir varias veces), sin transmisión no se crea ningún recurso, cadencia/fps sin
// allocations, e integración leyendo el código (mismo shader y uniforms del domo, sin readPixels, prototype.render).
// Uso: node scripts/video-procesado-test.mjs
import fs from 'node:fs';
import { elegirFuenteVideo, normalizarFuenteVideo, Cadencia, TransmisionProcesada, RespaldoVideo } from '../lib/vivo/videoProcesado.ts';
import { PublicadorLiveKit } from '../lib/vivo/liveKitCiclo.ts';

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const src = leer('../lib/debugConfig.ts');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string/g, '')});`)();
const L = obj('DBG_LIVEKIT');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };

console.log('\nconfiguración');
check(L.PROCESADO_REINTENTO_S === 10 && L.PROCESADO_MAX_REINTENTOS === 5 && L.PROCESADO_CONFIRMAR_S === 2 && L.PROCESADO_TIMEOUT_S === 3 && L.FUENTE_VIDEO === 'procesado' && L.PROCESADO_ANCHO === 640 && L.PROCESADO_ALTO === 360 && L.VIDEO_FPS === 15 && L.VIDEO_KBPS === 500,
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

console.log('\nZ94c: vigía por turnos (solo mientras el pase puede dibujar)');
// host simulado: replica las condiciones de components/VideoTransmitidoTarima.tsx (sin cámara ni frustum)
function hostCuadro(T, ahora, { domo = true, bench = false, leer = 'ok' } = {}) {
  T.vigilarLectura(ahora, L.PROCESADO_LECTURA_MAX_MS);
  if (bench) { T.marcarPase('pausado', 'benchmark'); return; }
  if (!domo) { T.marcarPase('no disponible', 'el domo de la tarima todavía no existe'); return; }
  T.marcarPase('dibujando', '');
  if (!T.cadencia.toca(ahora, T.fps)) return;
  T.turno();
  if (!T.empezarLectura(ahora)) return;
  if (leer === 'ok') T.alLeer(); else if (leer === 'falla') T.alFallar(new Error('GL_INVALID_OPERATION'));   // 'colgada': nunca vuelve
}
{ const F = fabrica(), T = new TransmisionProcesada(F.fab, reloj);
  RELOJ = 0; T.iniciar(640, 360, 15); T.publicando = true;
  // 20 s mirando hacia abajo dentro del atril: para el pase no cambia nada (no depende de la cámara)
  for (RELOJ = 0; RELOJ <= 20000; RELOJ += 1000 / 60) hostCuadro(T, RELOJ);
  check(T.pase === 'dibujando' && T.lecturas >= 295 && T.vigilar(RELOJ, 3, false) === '', `domo fuera de cámara 20 s: el pase sigue dibujando (${T.lecturas} cuadros) y el vigía no dispara`);
  check(T.publicadosTotal === T.lecturas, 'contador de cuadros procesados publicados');
  // un cuadro de 4 s del hilo principal (p. ej. recompilar materiales): no es falla
  const t0 = RELOJ; RELOJ += 4000;
  check(T.vigilar(RELOJ, 3, false) === '', 'un cuadro largo (4 s sin turnos) no dispara el respaldo: no hubo turnos perdidos');
  hostCuadro(T, RELOJ);
  check(T.vigilar(RELOJ + 10, 3, false) === '' && RELOJ - t0 === 4000, '…y al seguir dibujando todo vuelve a la normalidad');
  // pausa legítima: benchmark y domo todavía inexistente
  for (let k = 0; k < 600; k++) { RELOJ += 1000 / 60; hostCuadro(T, RELOJ, { bench: true }); T.vigilar(RELOJ, 3, false); }
  check(T.pase === 'pausado' && T.vigilar(RELOJ, 3, false) === '', 'benchmark en pausa 10 s: "pausado (benchmark)", el vigía no dispara');
  for (let k = 0; k < 600; k++) { RELOJ += 1000 / 60; hostCuadro(T, RELOJ, { domo: false }); T.vigilar(RELOJ, 3, false); }
  check(T.pase === 'no disponible' && T.vigilar(RELOJ, 3, false) === '', 'domo todavía inexistente 10 s: "no disponible", el vigía no dispara');
  // falla real: lecturas colgadas → el guardián las libera; lecturas que fallan → el vigía dispara con el motivo
  for (let k = 0; k < 240; k++) { RELOJ += 1000 / 60; hostCuadro(T, RELOJ, { leer: 'colgada' }); }
  check(T.colgadas >= 2 && !(T.enVuelo && T.colgadas === 0), `lecturas colgadas liberadas por el guardián (${T.colgadas})`);
  const m = T.vigilar(RELOJ, 3, false);
  check(m.startsWith('sin cuadros nuevos en 3 s (') && /turnos/.test(m), `falla real: el vigía dispara con detalle → "${m}"`);
  T.liberar(); }

console.log('\nZ94c: respaldo reversible con reloj simulado');
{ const R = new RespaldoVideo(L);
  R.reiniciar('procesado');
  R.fallo(1000, 'sin cuadros nuevos en 3 s');
  check(R.estado === 'cruda' && R.aCruda === 1 && Math.round(R.faltaS(1000)) === L.PROCESADO_REINTENTO_S, `falla → cruda, próximo reintento en ${L.PROCESADO_REINTENTO_S} s`);
  check(!R.debeProbar(1000 + L.PROCESADO_REINTENTO_S * 1000 - 1, true), 'antes del intervalo: no prueba');
  check(!R.debeProbar(11000, false) && R.estado === 'cruda', 'sin condiciones del pase (domo no disponible, benchmark): no prueba');
  check(R.debeProbar(11000, true) && R.estado === 'probando' && R.reintentos === 1, 'a los 10 s con condiciones: prueba en segundo plano (reintento 1)');
  check(R.evaluar(12000, 15, 15, '') === 'seguir', 'menos de CONFIRMAR_S: sigue');
  check(R.evaluar(13000, 30, 15, '') === 'confirmar', 'cuadros durante 2 s seguidos: confirmar');
  R.confirmado();
  check(R.estado === 'procesado' && R.aProcesado === 1, 'vuelve a "procesado"'); }
{ const R = new RespaldoVideo(L); R.reiniciar('procesado'); R.fallo(0, 'x');
  let t = 0, pruebas = 0;
  for (let i = 0; i < 20; i++) {
    t += L.PROCESADO_REINTENTO_S * 1000;
    if (R.debeProbar(t, true)) { pruebas++; if (R.evaluar(t + 500, 0, 15, 'ninguna lectura en 3 s') !== 'fallar') fallas++; R.pruebaFallida(t + 500, 'ninguna lectura'); }
  }
  check(pruebas === L.PROCESADO_MAX_REINTENTOS && R.estado === 'cruda_final' && R.faltaS(t) === -1, `tope: ${L.PROCESADO_MAX_REINTENTOS} reintentos y queda en cruda (sin más pruebas)`);
  check(R.evaluar(0, 0, 15, '') === 'seguir', 'cruda_final: no evalúa nada'); }
{ const R = new RespaldoVideo(L); R.reiniciar('procesado'); R.fallo(0, 'x'); R.debeProbar(10000, true);
  check(R.evaluar(10000 + (L.PROCESADO_CONFIRMAR_S + L.PROCESADO_TIMEOUT_S) * 1000, 3, 15, '') === 'fallar', 'prueba sin cuadros suficientes: falla tras CONFIRMAR_S + TIMEOUT_S');
  R.pruebaFallida(15000, 'cuadros insuficientes');
  check(R.estado === 'cruda' && R.ultimoMotivo === 'cuadros insuficientes' && R.proximoMs === 25000, 'vuelve a cruda y espera otro intervalo');
  R.reiniciar('inactivo'); check(R.estado === 'inactivo' && R.reintentos === 0 && !R.debeProbar(1e9, true), 'al cortar: sin reintentos pendientes'); }

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
  check(/SIS\.videoTransmitidoTarima === false\) \{ T\.marcarPase\("pausado", "benchmark"\); return; \}/.test(H), 'benchmark: apagado no dibuja (pase "pausado")');
  check(/await videoLocal\.replaceTrack\(p\.track as MediaStreamTrack, true\)/.test(P) && /TX_PROC\.vigilar\(ahora, DBG_LIVEKIT\.PROCESADO_TIMEOUT_S/.test(P), 'vigía cada 0,5 s y respaldo con replaceTrack (sin reconectar)');
  check(/procesado falló: \$\{motivo\} → \$\{VIDEO_TX\.efectiva\}/.test(P) && !/console\.(error|warn)/.test(H + P), 'línea de estado "procesado falló: <motivo> → cruda", sin errores en consola');
  check(/data-debug-panel/.test(P) && /export function alternarPanelCuadro/.test(P), 'panel "Ver el cuadro procesado" (oculto por defecto)');
  check(/FACE_DOME_VIS\.value = showDome/.test(FD) && /PASE_HOST\.listo = FACE_DOME_VIS\.value && !!base/.test(H), 'disponible solo con el domo de la tarima en pantalla');
  check(/path !== "sillas" && <VideoTransmitidoTarima \/>/.test(TS), 'montado en el camino de la tarima');
  const HC = H.replace(/\/\/.*$/gm, '');
  check(!/frustum\.|\.visible|camera\.|getWorldDirection|isMeshVisible/.test(HC.split('useFrame(')[1] ?? ''), 'Z94c: el pase no mira la cámara ni la visibilidad del domo');
  const FU = FD.split('useFrame(')[1] ?? '';
  check(/if \(showDome\) \{[\s\S]*?domeUniforms\.uBrightness\.value = STORE\.webcam\.brightness;[\s\S]*?domeUniforms\.uPsych\.value/.test(FU) && /domeUniforms\.uTime\.value = t;/.test(FU) && !/frustum|isVisible|\.visible/.test(FU.split('if (!active) return null;')[0]),
    'Z94c: FaceDome actualiza uTime, uMap y los ajustes del atril en su useFrame aunque el domo esté fuera de cámara');
  check(/mesh\.frustumCulled = false/.test(H), 'el quad del pase no se descarta por frustum');
  check(/T\.marcarPase\("pausado", "benchmark"\)/.test(H) && /T\.marcarPase\("no disponible"/.test(H) && /T\.turno\(\);/.test(H), 'Z94c: el host informa dibujando / pausado / no disponible y cuenta turnos');
  check(/TX_PROC\.liberar\(\);                 \/\/ Z94c/.test(P) && /RESPALDO\.reiniciar\("inactivo"\);    \/\/ Z94c/.test(P), 'Z94c: cortar libera la prueba en segundo plano y los reintentos pendientes');
  check(/await PUB\.cambiarVideo\(pistaDeTxProc\(pista\)\)/.test(P), 'Z94c: volver a procesado con replaceTrack (cambiarVideo), sin reconectar'); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
