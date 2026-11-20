// Z104: ayuda de movimiento del telón. (a) línea de tiempo sin movimiento; (b) moverse la corta; (c) CUENTA_MIRAR;
// (d) REARMAR; (e) MODO "acumulado"; (f) telón cruzado o pausa; (g) lectura de código (sin allocations, limpieza);
// (h) texto accesible una sola vez. Uso: node scripts/telon-ayuda-test.mjs
import fs from 'node:fs';
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(s, c, n) { if (/^\\.\\.?\\//.test(s) && !/\\.[a-z]+$/.test(s)) { try { return await n(s + '.ts', c); } catch {} } return n(s, c); }`));
const L = await import('../lib/telonAyuda.ts');
const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const PURO = leer('../lib/telonAyuda.ts'), COMP = leer('../components/TelonAyuda.tsx'), TS = leer('../components/ThreeScene.tsx'), CFG = leer('../lib/debugConfig.ts'), TEX = leer('../lib/telonTexto/texturaAyuda.ts');
const sinCom = t => t.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const cfg = (o = {}) => ({ ESPERA_S: 5, INTERVALO_S: 2, PASADAS: 2, MODO: 'uno', REARMAR: false, CUENTA_MIRAR: false, ENTRADA_S: 0.6, SALIDA_S: 0.4, FLICKER_S: 0.35, FLICKER_N: 3, FLICKER_PICO: 0.7, ...o });
const DT = 1 / 60;
/** Corre hasta tFin (s) llamando a f(t) para decidir la entrada; devuelve una función que muestrea el estado en t. */
function simular(c, tFin, entrada = () => ({}), alPaso = () => {}) {
  const e = L.crearEstadoAyuda(), muestras = [];
  let t = 0;
  while (t < tFin + 1e-9) {
    const en = { presente: true, pausado: false, movio: false, miro: false, ...entrada(t) };
    L.avanzarAyuda(e, DT, c, en);
    t += DT;
    muestras.push({ t, ind: e.indicacion, celdas: e.celdas, pasada: e.pasada, fase: e.fase, alfa: e.alfa, resto: e.alfaResto, anunciar: e.anunciar });
    alPaso(e, t);
  }
  const en = tt => muestras.reduce((m, x) => (Math.abs(x.t - tt) < Math.abs(m.t - tt) ? x : m));
  return { e, muestras, en };
}
const LET = i => (i < 0 ? '-' : L.LETRAS_AYUDA[i]);

console.log('\nconstantes y estructura');
check(!/^import /m.test(PURO), 'lib/telonAyuda.ts sin imports (lógica pura)');
for (const k of ['ACTIVO', 'ESPERA_S', 'INTERVALO_S', 'PASADAS', 'MODO', 'CUENTA_MIRAR', 'REARMAR', 'TAMANO', 'OPACIDAD'])
  check(new RegExp(`export const DBG_TELON_AYUDA = \\{[\\s\\S]*?\\n  ${k}:`).test(CFG), `DBG_TELON_AYUDA.${k}`);
check(/ESPERA_S:\s+5,/.test(CFG) && /INTERVALO_S:\s+2,/.test(CFG) && /PASADAS:\s+2,/.test(CFG) && /MODO:\s+"uno"/.test(CFG) && /CUENTA_MIRAR:\s+false/.test(CFG) && /REARMAR:\s+false/.test(CFG), 'por defecto: 5 s, 2 s, 2 pasadas, "uno", mirar no cuenta, no rearma');

console.log('\n(a) sin movimiento');
{ const s = simular(cfg(), 23);
  const at = tt => LET(s.en(tt).ind);
  const sec = [4.9, 5.5, 7.5, 9.5, 11.5, 13.5, 15.5, 17.5, 19.5, 21.2].map(at).join(' ');
  check(sec === '- W S A D W S A D -', `4,9 s: nada · 5 s W · 7 s S · 9 s A · 11 s D · 13…19 s segunda pasada · 21 s nada (${sec})`);
  check(s.en(5.5).pasada === 0 && s.en(13.5).pasada === 1 && s.e.fase === 'terminada', 'pasada 1 y pasada 2; después queda terminada (no vuelve)');
  check(s.muestras.filter(m => m.t > 21.05).every(m => m.ind === -1 && m.alfa === 0), 'después de los 21 s no se proyecta nada');
  const enW = s.muestras.filter(m => m.t > 5 && m.t < 7);
  check(enW.some(m => m.alfa > 0.95) && enW[enW.length - 1].alfa < 0.05 && enW.slice(0, 20).some(m => m.alfa === 0.7), 'cada indicación entra con el parpadeo de reflector y el fundido del texto del telón, y se apaga suave antes de la siguiente'); }

console.log('\n(b) moverse la corta');
{ for (const tm of [2, 6.3, 12.1]) {
    const s = simular(cfg(), 23, t => ({ movio: Math.abs(t - tm) < DT / 2 + 1e-9 }));
    const despues = s.muestras.filter(m => m.t > tm + 0.45);
    const nuevas = s.muestras.filter(m => m.t > tm + DT).map(m => m.ind).filter((x, i, a) => x >= 0 && x !== a[0]);
    check(despues.every(m => m.ind === -1 && m.alfa === 0) && s.e.fase === 'cancelada' && nuevas.length === 0 && s.e.movido,
      `se mueve a los ${tm} s: la indicación visible se apaga con su fundido y no se proyecta nada más`);
  }
  const s = simular(cfg(), 8, t => ({ movio: Math.abs(t - 6) < DT / 2 }));
  const tras = s.muestras.filter(m => m.t > 6.01 && m.t < 6.36);
  check(tras.length > 3 && tras.every((m, i, a) => i === 0 || m.alfa <= a[i - 1].alfa + 1e-9) && tras.every(m => m.ind === 0), 'al cortar, la misma indicación (W) baja su opacidad hasta 0, sin pasar a la siguiente'); }

console.log('\n(c) CUENTA_MIRAR');
{ const mira = t => ({ miro: t > 6 && t < 6.1 });
  const a = simular(cfg(), 12, mira), b = simular(cfg({ CUENTA_MIRAR: true }), 12, mira);
  check(a.en(7.5).ind === 1 && a.e.fase === 'mostrando', 'con CUENTA_MIRAR false, mirar con el mouse no la corta');
  check(b.en(7.5).ind === -1 && b.e.fase === 'cancelada', 'con CUENTA_MIRAR true, mirar la corta'); }

console.log('\n(d) REARMAR');
{ const mov = t => ({ movio: Math.abs(t - 6) < DT / 2 });
  const a = simular(cfg({ REARMAR: true }), 13, mov), b = simular(cfg(), 13, mov);
  const vuelve = a.muestras.find(m => m.t > 6.5 && m.ind >= 0);
  check(vuelve && vuelve.ind === 0 && vuelve.t > 6 + 0.4 + 5 - 0.05 && vuelve.t < 6 + 0.4 + 5 + 0.1, `REARMAR true: vuelve a empezar (W) después de otros 5 s quieto (a los ${vuelve?.t.toFixed(2)} s)`);
  check(b.muestras.filter(m => m.t > 6.5).every(m => m.ind === -1), 'REARMAR false: no vuelve'); }

console.log('\n(e) MODO acumulado');
{ const s = simular(cfg({ MODO: 'acumulado' }), 22);
  const c = [5.5, 7.5, 9.5, 11.5, 13.5].map(t => s.en(t).celdas).join(',');
  check(c === '1,2,3,4,1', `las indicaciones se suman en una fila (celdas visibles: ${c}) y la segunda pasada vuelve a empezar`);
  check(s.en(9.5).resto === 1 && s.en(9.5).ind === 2, 'las anteriores quedan encendidas mientras entra la nueva');
  const u = simular(cfg(), 12);
  check(u.en(9.5).celdas === 1, 'con "uno" se ve una sola, en el mismo lugar'); }

console.log('\n(f) telón cruzado o pausa');
{ const p = simular(cfg(), 23, t => ({ pausado: t > 2 && t < 12 }));
  check(p.en(11).ind === -1 && p.en(15.5).ind === 0 && p.en(17.5).ind === 1, 'en pausa (o con un diálogo) el tiempo no corre: la ayuda empieza 10 s más tarde');
  const x = simular(cfg(), 23, t => ({ presente: !(t > 4 && t < 9) }));
  check(x.en(8).ind === -1 && x.en(9 + 5.5).ind === 0, 'sin el telón (cruzado, camino LUZ o checkpoint) no se muestra y la espera vuelve a cero');
  check(/curtainVisible && DBG_TELON_AYUDA\.ACTIVO && <TelonAyuda \/>/.test(TS) && /experienceState === "cortina" && LUZ_STATE\.fase === "libre"/.test(COMP) && /PAUSA\.activa \|\| DIALOGO_STATE\.activo/.test(COMP),
    'el componente vive solo con el telón y pausa con la pausa de la experiencia o el diálogo'); }

console.log('\n(g) lectura de código');
{ const i = COMP.indexOf('useFrame((_, dt) => {'), cuadro = COMP.slice(i, COMP.indexOf('\n  });', i));
  const sc = sinCom(cuadro).replace('crearTexturaAyuda(', 'X(');   // la textura se crea UNA vez (guardada por !texRef.current)
  check(cuadro.length > 1500 && !/new |`|\[\s*\]|\.map\(|\.filter\(|\.slice\(|\{\s*\.\.\./.test(sc) && /if \(!texRef\.current && familia\.current\)/.test(cuadro), 'el cuadro no crea objetos (la textura una sola vez, con la fuente lista)');
  const pu = ['avanzarAyuda', 'alfaEntradaAyuda'].map(n => { const k = PURO.indexOf(`export function ${n}(`); return PURO.slice(k, PURO.indexOf('\n}', k)); }).join('\n');
  check(!/new |`|\[\s*\]|\.map\(|\.filter\(|\{\s*\.\.\./.test(sinCom(pu)), 'la línea de tiempo pura no crea objetos (escribe en el estado)');
  check(!/setTimeout|setInterval/.test(sinCom(COMP)) && /avanzarAyuda\(AYUDA, dt, D, _entrada\)/.test(COMP), 'sin timers: avanza con el dt del cuadro');
  check(/window\.removeEventListener\("keydown", onTecla\)/.test(COMP) && /div\.remove\(\)/.test(COMP) && /texRef\.current\?\.dispose\(\)/.test(COMP) && /removeEventListener\("alight:telon-ayuda-probar"/.test(COMP),
    'al desmontar (cruzar el telón): se quitan los oyentes, el aviso accesible y la textura');
  check(/VERT_TELON/.test(COMP) && /blendSrc=\{THREE\.DstColorFactor\}/.test(COMP) && /anton/.test(COMP) && /flecha\(/.test(TEX) && !/[↑↓←→]/.test(sinCom(TEX)),
    'mismo mecanismo que el texto del telón (pliegues, gobo multiplicativo, fuente Anton); las flechas son formas, no una fuente de reemplazo'); }

console.log('\n(h) texto accesible');
{ let n = 0;
  simular(cfg({ REARMAR: true }), 30, t => ({ movio: Math.abs(t - 6) < DT / 2 }), e => { if (e.anunciar) n++; });
  check(n === 1, `se anuncia una sola vez aunque la ayuda vuelva a empezar (${n})`);
  check(L.TEXTO_ACCESIBLE_AYUDA === 'Usá la tecla W para avanzar, S para retroceder, A para ir a la izquierda y D a la derecha' && /aria-live", "polite"/.test(COMP) && /clip:rect\(0 0 0 0\)/.test(COMP),
    'texto oculto con aria-live "polite" en español, sin ruido visual'); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
