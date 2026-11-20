// Z104: orden de las canciones del visualizador de las SILLAS. (i) muchos archivos; (j) faltantes; (k) mayúsculas;
// (l) solo music.mp3; (m) ORDEN_FIJO_ACTIVO false. Uso: node scripts/playlist-sillas-test.mjs
import fs from 'node:fs';
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(s, c, n) { if (/^\\.\\.?\\//.test(s) && !/\\.[a-z]+$/.test(s)) { try { return await n(s + '.ts', c); } catch {} } return n(s, c); }`));
const L = await import('../lib/playlistSillas.ts');
const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const PURO = leer('../lib/playlistSillas.ts'), VIZ = leer('../lib/vizAudio.ts'), CFG = leer('../lib/debugConfig.ts');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const INI = ['music.mp3', 'anycolour.mp3', 'breathe.mp3'];
const reales = fs.readdirSync(new URL('../public/', import.meta.url)).filter(f => f.toLowerCase().endsWith('.mp3'));

console.log('\nestructura');
check(!/^import /m.test(PURO), 'lib/playlistSillas.ts sin imports (lógica pura)');
check(/ORDEN_FIJO_ACTIVO: true/.test(CFG) && /ORDEN_INICIAL:\s+\["music\.mp3", "anycolour\.mp3", "breathe\.mp3"\]/.test(CFG), 'DBG_PLAYLIST_SILLAS: ORDEN_FIJO_ACTIVO true, ORDEN_INICIAL music, anycolour, breathe');
console.log(`  · en /public hay ${reales.length} mp3: ${reales.join(', ')}`);

console.log('\n(i) muchos archivos');
{ let todo = true;
  for (let s = 1; s <= 50; s++) {
    const r = L.armarListaSillas(reales, INI, s * 7919);
    const resto = r.lista.slice(3), otros = reales.filter(n => !INI.includes(n.toLowerCase()));
    if (r.lista.slice(0, 3).join() !== INI.join() || resto.length !== otros.length || new Set(resto).size !== resto.length || !otros.every(n => resto.includes(n))) todo = false;
  }
  const a = L.armarListaSillas(reales, INI, 1), b = L.armarListaSillas(reales, INI, 1), c = L.armarListaSillas(reales, INI, 2);
  check(todo, `con los ${reales.length} mp3 reales y 50 semillas: empieza con music, anycolour, breathe y el resto es una permutación de los otros ${reales.length - 3} (sin perder ni repetir)`);
  check(a.lista.join() === b.lista.join() && a.lista.slice(3).join() !== c.lista.slice(3).join(), 'la misma semilla da el mismo orden; otra semilla, otro'); }

console.log('\n(j) faltantes');
{ const r = L.armarListaSillas(['music.mp3', 'breathe.mp3', 'x.mp3', 'y.mp3'], INI, 3);
  check(r.lista.slice(0, 2).join() === 'music.mp3,breathe.mp3' && r.faltantes.join() === 'anycolour.mp3' && r.lista.length === 4, 'falta anycolour: se omite sin error, se informa, y sigue breathe y el resto'); }

console.log('\n(k) mayúsculas');
{ const r = L.armarListaSillas(['Music.MP3', 'ANYCOLOUR.mp3', 'breathe.mp3', 'music.mp3', 'otro.mp3'], INI, 5);
  check(r.lista.slice(0, 3).join() === 'Music.MP3,ANYCOLOUR.mp3,breathe.mp3' && r.lista.length === 4 && !r.lista.includes('music.mp3'), 'sin distinguir mayúsculas, con el nombre real; con duplicados por mayúsculas se usa el primero'); }

console.log('\n(l) solo music.mp3');
{ const r = L.armarListaSillas(['music.mp3'], INI, 9);
  check(r.lista.join() === 'music.mp3' && r.faltantes.length === 2, 'la lista es solo music.mp3'); }

console.log('\n(m) ORDEN_FIJO_ACTIVO false');
{ const r = L.armarListaSillas(reales, INI, 4, false);
  check(r.lista.join() === 'music.mp3' && r.resto.length === 0, 'como antes: solo music.mp3 primero (el resto lo elige vizAudio al azar)');
  check(/_cola = !DBG_PLAYLIST_SILLAS\.ORDEN_FIJO_ACTIVO \? \[\]/.test(VIZ) && /const deCola = _cola\.shift\(\);/.test(VIZ) && /const candidates = _playlist\.filter\(u => !_recentUrls\.includes\(u\)\);/.test(VIZ),
    'vizAudio: la cola va primero y, al vaciarse, sigue el sorteo de siempre (sin repetir los dos últimos) sin volver a fijar los tres');
  check(/if \(!_colaArmada\) armarCola\(data\.files\);/.test(VIZ) && /_cola = \[\]; _colaArmada = false;/.test(VIZ), 'la cola se arma una vez por sesión del visualizador y se limpia al parar'); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
