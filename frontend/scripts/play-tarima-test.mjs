// Z79: prueba del PLAY del atril de sonido (lib/playTarima.ts): decisiones play/pausa, bandera AUTOPLAY, estado y evento
// solo al cambiar, slots de los atriles de instrumentos; y que el código viejo siga detrás de la bandera.
// Uso: node scripts/play-tarima-test.mjs
import fs from 'node:fs';
import {
  arrancaSolo, accionAlternar, accionPlay, accionPausa, PLAY_TARIMA, actualizarPlay, slotsInstrumentos,
} from '../lib/playTarima.ts';

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const src = leer('../lib/debugConfig.ts');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string \| number/g, '').replace(/ as string/g, '')});`)();
const P = obj('DBG_PLAY');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const cerca = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

console.log('\nbandera AUTOPLAY');
check(P.AUTOPLAY === false && !arrancaSolo(P), 'por defecto la música NO arranca sola');
check(arrancaSolo({ AUTOPLAY: true }), 'AUTOPLAY = true restaura el arranque automático');
check(P.MOSTRAR_SLOTS === false && P.APARECER_TRAS_PLAY === false, 'MOSTRAR_SLOTS off (overlay oculto) y APARECER_TRAS_PLAY false (Z88: antes true; la caja sale con los atriles)');

console.log('\ndecisiones del botón (alterna)');
const E = (o = {}) => ({ motorListo: true, hayPistas: true, cargado: false, sonando: false, pausaCentral: false, ...o });
check(accionAlternar(E()) === 'iniciar', 'primera vez: iniciar (pone la pista y reproduce)');
check(accionAlternar(E({ cargado: true, sonando: true })) === 'pausar', 'sonando: pausar');
check(accionAlternar(E({ cargado: true })) === 'reanudar', 'pausada con pista: reanudar');
check(accionAlternar(E({ motorListo: false })) === 'ignorar', 'motor sin preparar (atriles sin aparecer): no hace nada');
check(accionAlternar(E({ hayPistas: false })) === 'ignorar', 'sin pistas (/api/music vacío o caído): no hace nada, sin errores');
check(accionAlternar(E({ pausaCentral: true })) === 'ignorar' && accionAlternar(E({ pausaCentral: true, cargado: true })) === 'ignorar', 'en la pausa central no arranca');
check(accionAlternar(E({ pausaCentral: true, cargado: true, sonando: true })) === 'pausar', 'en la pausa central sí puede pausar');

console.log('\nplay y pausa explícitos (menú, otros sistemas)');
check(accionPlay(E()) === 'iniciar' && accionPlay(E({ cargado: true })) === 'reanudar', 'play arranca o reanuda');
check(accionPlay(E({ cargado: true, sonando: true })) === 'ignorar', 'play con música sonando: no la pausa');
check(accionPausa(E({ cargado: true, sonando: true })) === 'pausar' && accionPausa(E()) === 'ignorar', 'pausa solo si suena');
check(accionPausa(E({ motorListo: false, sonando: true })) === 'ignorar', 'pausa sin motor: nada');

console.log('\nsecuencia play → pausa → play (simulada)');
{
  const s = { motorListo: true, hayPistas: true, cargado: false, sonando: false, pausaCentral: false };
  const pasos = [];
  const aplicar = a => { pasos.push(a); if (a === 'iniciar') { s.cargado = true; s.sonando = true; } else if (a === 'reanudar') s.sonando = true; else if (a === 'pausar') s.sonando = false; };
  for (let i = 0; i < 4; i++) aplicar(accionAlternar(s));
  check(pasos.join(',') === 'iniciar,pausar,reanudar,pausar', `alterna: ${pasos.join(' → ')}`);
}

console.log('\nestado compartido y evento (solo al cambiar)');
{
  const st = { ...PLAY_TARIMA };
  let ev = 0;
  const emitir = (s, i) => { if (actualizarPlay(st, s, i)) ev++; };
  emitir(false, false); emitir(true, true); emitir(true, true); emitir(true, true); emitir(false, true); emitir(false, true);
  check(ev === 2 && st.cambios === 2, `6 actualizaciones, 2 cambios reales → 2 eventos (${ev})`);
  check(st.sonando === false && st.iniciado === true, 'queda pausada con pista puesta');
  check(PLAY_TARIMA.sonando === false && PLAY_TARIMA.iniciado === false, 'estado global inicial: en silencio, sin pista');
}

console.log('\nslots de los atriles de instrumentos');
{
  const ATRIL_X = 1.3 + 0.30, MEDIA = 3.192 / 2, H = 0.267;
  const s = slotsInstrumentos(P, ATRIL_X, MEDIA, H);
  check(s.length === P.SLOTS_N, `${s.length} slots`);
  check(s.every(o => cerca(o.x, ATRIL_X + P.SLOTS_DIST_M)), `en línea, ${P.SLOTS_DIST_M} m detrás del atril de sonido (x = ${(ATRIL_X + P.SLOTS_DIST_M).toFixed(2)})`);
  const zs = s.map(o => o.z);
  check(cerca(zs[0] + zs[zs.length - 1], 0) && zs.every((z, i) => i === 0 || cerca(z - zs[i - 1], P.SLOTS_SEP_M)), `centrados y separados ${P.SLOTS_SEP_M} m (z = ${zs.map(z => z.toFixed(2)).join(', ')})`);
  // frente local +Z = (sin yaw, cos yaw) debe apuntar al centro (0, 0)
  const miraCentro = s.every(o => { const fx = Math.sin(o.yaw), fz = Math.cos(o.yaw), d = Math.hypot(o.x, o.z); return (fx * -o.x + fz * -o.z) / d > 0.999; });
  check(miraCentro, 'cada slot mira al centro de la tarima (como los atriles)');
  check(s.every(o => !o.sobreTarima && o.y === 0), 'el atril de sonido está en el borde de la tarima: los slots caen fuera, sobre el piso (y = 0)');
  const enTarima = slotsInstrumentos({ ...P, SLOTS_N: 1, SLOTS_DIST_M: -1.0 }, ATRIL_X, MEDIA, H);
  check(enTarima.length === 1 && enTarima[0].sobreTarima === false, 'distancia negativa se acota a 0 (no pasa por delante del atril)');
  const uno = slotsInstrumentos({ ...P, SLOTS_N: 1, SLOTS_DIST_M: 0 }, 1.0, MEDIA, H);
  check(uno[0].sobreTarima && uno[0].y === H, 'un slot sobre la tarima toma su altura');
  const arco = slotsInstrumentos({ ...P, SLOTS_ARCO_GRADOS: 90 }, ATRIL_X, MEDIA, H);
  const centro = (arco[1].x + arco[2].x) / 2;
  check(arco[0].x < centro && arco[3].x < centro && cerca(arco[0].z, -arco[3].z), 'en arco: los extremos se curvan hacia el centro, simétrico');
  const sepArco = Math.hypot(arco[1].x - arco[0].x, arco[1].z - arco[0].z);
  check(sepArco > P.SLOTS_SEP_M * 0.9, `en arco no se pisan (${sepArco.toFixed(2)} m entre vecinos)`);
  const out = []; slotsInstrumentos(P, ATRIL_X, MEDIA, H, out); const ref0 = out[0]; slotsInstrumentos(P, ATRIL_X, MEDIA, H, out);
  check(out[0] === ref0, 'reutiliza los objetos del arreglo de salida (sin allocations por frame)');
  check(slotsInstrumentos({ ...P, SLOTS_N: 99 }, ATRIL_X, MEDIA, H).length === 12 && slotsInstrumentos({ ...P, SLOTS_N: -3 }, ATRIL_X, MEDIA, H).length === 0, 'cantidad acotada a 0…12');
}

console.log('\ncódigo viejo detrás de la bandera (LecternSystem.tsx)');
{
  const ls = leer('../components/LecternSystem.tsx');
  check(/if \(DBG_PLAY\.AUTOPLAY\) \{[^}]*if \(data\.tracks\.length\) await playTrack\(0\);/.test(ls), 'el arranque automático viejo sigue, dentro de if (DBG_PLAY.AUTOPLAY)');
  check(/else prepararSinAutoplay\(\)/.test(ls), 'sin AUTOPLAY: prepararSinAutoplay (motor listo, en silencio)');
  check(!/_isPlaying/.test(ls.replace(/\/\/.*$/gm, '')), 'el PLAY/PAUSA chico ya no usa un booleano propio (lee PLAY_TARIMA)');
  check(/onActivate: \(v\) => \{ if \(v > 0\.5\) alternarPlay\(\); \}/.test(ls), 'PLAY/PAUSA chico alterna una vez por pulsación');
}

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
