// Z94: prueba del video procesado de la transmisión (lib/vivo/videoProcesado.ts): selección de fuente con respaldo, ciclo
// de vida sin fugas (crear y destruir varias veces), sin transmisión no se crea ningún recurso, cadencia/fps sin
// allocations, e integración leyendo el código (mismo shader y uniforms del domo, sin readPixels, prototype.render).
// Uso: node scripts/video-procesado-test.mjs
import fs from 'node:fs';
import { elegirFuenteVideo, normalizarFuenteVideo, Cadencia, TransmisionProcesada } from '../lib/vivo/videoProcesado.ts';

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const src = leer('../lib/debugConfig.ts');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string/g, '')});`)();
const L = obj('DBG_LIVEKIT');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };

console.log('\nconfiguración');
check(L.FUENTE_VIDEO === 'procesado' && L.PROCESADO_ANCHO === 640 && L.PROCESADO_ALTO === 360 && L.VIDEO_FPS === 15 && L.VIDEO_KBPS === 500,
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
function fabrica() {
  const F = { vivos: new Set(), pistasVivas: new Set(), creados: 0, falla: false };
  F.fab = { crear: (w, h, fps) => {
    if (F.falla) return null;
    const l = { canvas: { w, h }, ctx: {}, pista: { id: ++F.creados, fps }, detenerPista: () => F.pistasVivas.delete(l.pista), quitar: () => F.vivos.delete(l) };
    F.vivos.add(l); F.pistasVivas.add(l.pista); return l; } };
  return F;
}
{ const F = fabrica(), T = new TransmisionProcesada(F.fab);
  check(!T.activa && T.lienzo === null && F.creados === 0, 'sin transmisión: ningún canvas, pista ni recurso');
  for (let i = 0; i < 5; i++) {
    const r = T.iniciar(640, 360, 15);
    if (!r || !T.activa) break;
    T.iniciar(640, 360, 15);   // repetido: no crea otro
    T.liberar(); T.liberar();   // doble liberación inocua
  }
  check(F.creados === 5 && T.creados === 5 && T.liberados === 5, 'crear y destruir 5 veces: 5 creados, 5 liberados (iniciar repetido no duplica)');
  check(F.vivos.size === 0 && F.pistasVivas.size === 0 && !T.activa, 'sin canvas ni pistas colgados');
  const r = T.iniciar(640, 360, 15);
  check(r && r.track.fps === 15 && T.ancho === 640 && T.alto === 360, 'iniciar: pista de captureStream a 15 fps, 640×360');
  T.liberar(); }
{ const F = fabrica(); F.falla = true; const T = new TransmisionProcesada(F.fab);
  check(T.iniciar(640, 360, 15) === null && !T.activa && T.fallo === 'no se pudo crear el canvas transmisible', 'si el canvas no se puede crear: null con motivo (el publicador cae a "cruda")'); }
{ const T = new TransmisionProcesada({ crear: () => { throw new Error('x'); } });
  check(T.iniciar(640, 360, 15) === null && T.fallo !== '', 'una excepción de la fábrica no se propaga'); }

console.log('\nintegración (lectura del código)');
{ const H = leer('../components/VideoTransmitidoTarima.tsx'), P = leer('../lib/vivo/publicarLiveKit.ts'), FD = leer('../components/FaceDome.tsx'), TS = leer('../components/ThreeScene.tsx');
  check(/export const DOME_FRAG/.test(FD) && /fragmentShader: FRAG/.test(H) && /DOME_FRAG\.replace/.test(H), 'mismo fragment shader del domo (efectos por sector, psico, ajustes del atril)');
  check(/uniforms: \{ \.\.\.base\.uniforms, uEspejo, uSrgb \}/.test(H), 'uniforms del domo compartidos por referencia: el atril y los glitches se ven en vivo');
  check(!/\.readPixels\(/.test(H + P) && /ctx\.drawImage\(cv,/.test(H), 'sin readPixels: drawImage del framebuffer al canvas transmisible');
  check(/const RENDER = THREE\.WebGLRenderer\.prototype\.render/.test(H) && /RENDER\.call\(gl, g\.escena, g\.cam\)/.test(H), 'render original (no el del composer que instala RetroPostFX)');
  check(/if \(!TX_PROC\.activa\) \{[\s\S]*?g\.geo\.dispose\(\); g\.mat\.dispose\(\)/.test(H), 'sin transmisión: libera material y quad (cero costo)');
  check(/if \(!TX_PROC\.cadencia\.toca\(ahora, TX_PROC\.fps\)\) return;/.test(H), 'a la cadencia de la transmisión (15 fps), no por cuadro');
  check(/SIS\.videoTransmitidoTarima === false\) return;/.test(H), 'benchmark: apagado no dibuja');
  check(/gl\.setScissorTest\(scT\); gl\.setScissor\(_sc\); gl\.setViewport\(_vp\); gl\.autoClear = auto; gl\.setRenderTarget\(rt\);/.test(H), 'restaura viewport, scissor, autoClear y render target');
  check(/const _vp = new THREE\.Vector4\(\), _sc = new THREE\.Vector4\(\);/.test(H) && !/useFrame\([\s\S]*new THREE\.Vector/.test(H.split('useFrame(')[1]?.split('if (!g || g.base !== base)')[0] ?? ''), 'sin allocations por cuadro (vectores de módulo; el material solo se crea una vez por transmisión)');
  check(/video: \(modo: ModoLK, cfg: CfgLK\) => pistaVideo\(modo, cfg\)/.test(P) && /liberar: \(\) => TX_PROC\.liberar\(\)/.test(P), 'el publicador usa la pista procesada y la libera al cortar (detener libera todas las pistas)');
  check(/VIDEO_TX\.motivo = TX_PROC\.fallo \|\| "falló el pase procesado"/.test(P) && !/console\.(error|warn)/.test(H + P), 'falla al iniciar → "cruda" con motivo en la línea de estado, sin errores en consola');
  check(/FACE_DOME_VIS\.value = showDome/.test(FD) && /PASE_HOST\.listo = FACE_DOME_VIS\.value && !!base/.test(H), 'disponible solo con el domo de la tarima en pantalla');
  check(/path !== "sillas" && <VideoTransmitidoTarima \/>/.test(TS), 'montado en el camino de la tarima'); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
