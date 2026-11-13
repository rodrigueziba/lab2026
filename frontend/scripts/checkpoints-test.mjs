// Z40: prueba del registro y el ejecutor de checkpoints (lib/checkpoints.ts) con acciones SIMULADAS que
// usan el reloj real (lib/relojExperiencia.ts): saltos cruzados, doble salto, cancelación de esperas, un
// solo evento por salto, encolado desde un handler y tope por paso. Uso: node scripts/checkpoints-test.mjs
import { CHECKPOINTS, CK_STATE, irACheckpoint, checkpointActual, instalarAcciones, tickCheckpoints } from '../lib/checkpoints.ts';
import { crearEspera, tickReloj, limpiarEsperas, esperasPendientes, adelantarReloj } from '../lib/relojExperiencia.ts';

let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
globalThis.window = new EventTarget();
const emit = n => window.dispatchEvent(new CustomEvent(n));
const log = [];
for (const n of ['alight:checkpoint', 'alight:sala-activa', 'alight:dome-revealed', 'alight:chose-chairs', 'alight:chose-light'])
  window.addEventListener(n, e => log.push(n.replace('alight:', '') + (e.detail?.id ? ':' + e.detail.id : '')));

// ── mundo simulado: lo mínimo para que los pasos reales tengan qué esperar ──
const MUNDO = { montajes: 0, framesMontado: 0, remontarPedido: false, zona: '', dialogo: false, secuencia: null, viz: false, amanecer: 'inactivo', premio: false };
function secuenciaSillas() {   // chose-chairs → prism-landed 5,5 s → dome-revealed +9,8 s → sala-activa +5 s (con el reloj real)
  const s = { landed: false, revealed: false };
  s.e1 = crearEspera(5500, () => { s.landed = true; s.e2 = crearEspera(9800, () => { s.revealed = true; emit('alight:dome-revealed'); s.e3 = crearEspera(5000, () => emit('alight:sala-activa')); }); });
  return s;
}
let esperado = { n: '', visto: false }; const alVer = () => { esperado.visto = true; };
const escuchar = n => { soltar(); esperado = { n, visto: false }; window.addEventListener(n, alVer); };
const soltar = () => { if (esperado.n) window.removeEventListener(esperado.n, alVer); esperado = { n: '', visto: false }; };
instalarAcciones({
  base: () => { soltar(); limpiarEsperas(); MUNDO.secuencia = null; MUNDO.zona = ''; MUNDO.dialogo = false; MUNDO.viz = false; MUNDO.amanecer = 'inactivo'; MUNDO.tarimaEmitida = false; return true; },
  remontar: (_p, c) => { if (c.primera) { MUNDO.remontarPedido = true; MUNDO.antes = MUNDO.montajes; } return MUNDO.montajes > MUNDO.antes && MUNDO.framesMontado >= 3; },
  spawn: () => true,
  cruzarTelon: () => true,
  esperarFrames: (p, c) => c.frames >= Number(p[1]),
  irASillas: () => { MUNDO.zona = 'sillas'; return true; },
  irATarima: () => { MUNDO.zona = 'tarima'; return true; },
  esperarEvento: (p, c) => { if (c.primera && esperado.n !== p[1]) escuchar(p[1]); return esperado.visto; },
  adelantarHasta: (p, c) => { if (c.primera) escuchar(p[1]); if (esperado.visto) { soltar(); return true; } adelantarReloj(1); return false; },
  visualizador: () => { MUNDO.viz = true; return true; },
  amanecerFinal: () => { MUNDO.amanecer = 'completo'; return true; },
  diaEn: (p) => { MUNDO.dia = Number(p[1]); return true; },   // Z48
  tarimaVacia: () => { MUNDO.zona = 'tarima'; setTimeout(() => {}, 0); MUNDO.atriles = 2; return true; },
  irALuz: () => { MUNDO.zona = 'luz'; return true; },
  esperarDialogo: () => MUNDO.dialogo,
  premio: () => { MUNDO.premio = true; return true; },
});
// un frame del mundo: remontaje pedido → monta en el frame siguiente; zonas del Player; diálogo bajo la luz
function frame(dt = 1 / 60) {
  if (MUNDO.remontarPedido) { MUNDO.remontarPedido = false; MUNDO.montajes++; MUNDO.framesMontado = 0; return; }   // frame sin anfitrión
  MUNDO.framesMontado++;
  tickReloj(dt, false);
  if (MUNDO.zona === 'sillas' && !MUNDO.secuencia) { emit('alight:chose-chairs'); MUNDO.secuencia = secuenciaSillas(); }
  if (MUNDO.zona === 'tarima' && !MUNDO.tarimaEmitida) { MUNDO.tarimaEmitida = true; emit('alight:chose-light'); if (MUNDO.atriles) emit('alight:lecterns-visible'); }
  if (MUNDO.zona === 'luz') MUNDO.dialogo = true;
  tickCheckpoints(dt);
}
const hasta = (cond, max = 2000) => { let n = 0; while (!cond() && n++ < max) frame(); return n; };

console.log('\nregistro');
check(CHECKPOINTS.length === 13, `13 checkpoints (Z48: + dia_mediodia, dia_atardecer, dia_noche): ${CHECKPOINTS.map(c => c.id).join(', ')}`);
check(CHECKPOINTS.every(c => c.pasos[0][0] === 'base' && c.pasos[1][0] === 'remontar' && c.pasos[2][0] === 'base' && c.pasos[3][0] === 'spawn'), 'todos empiezan por base → remontar → base → spawn');
check(!irACheckpoint('no_existe') && CK_STATE.fase === 'inactivo', 'id inexistente: false y no hace nada');

console.log('\nsaltos cruzados (cada uno desde el anterior)');
for (const c of CHECKPOINTS) {
  log.length = 0; MUNDO.tarimaEmitida = false; MUNDO.atriles = 0;
  irACheckpoint(c.id);
  const n = hasta(() => CK_STATE.fase === 'listo' || CK_STATE.fase === 'error');
  const salas = log.filter(x => x === 'sala-activa').length, revs = log.filter(x => x === 'dome-revealed').length;
  const ev = log.filter(x => x.startsWith('checkpoint')).length;
  check(CK_STATE.fase === 'listo' && checkpointActual() === c.id && ev === 1,
    `${c.id.padEnd(17)} listo en ${String(n).padStart(3)} frames · checkpoint=1 · dome-revealed=${revs} · sala-activa=${salas}`);
}

console.log('\ndoble salto (ráfaga) y cancelación de esperas');
log.length = 0;
const colgada = crearEspera(3000, () => log.push('ESPERA-COLGADA'));   // p. ej. una liberación pendiente
irACheckpoint('sala_activa'); for (let i = 0; i < 12; i++) frame();          // a mitad de la secuencia SILLAS
const pendientesAMitad = esperasPendientes();
irACheckpoint('inicio');                                                       // ráfaga: salto antes de terminar
hasta(() => CK_STATE.fase === 'listo');
for (let i = 0; i < 2000; i++) frame();                                        // ~33 s más de reloj
check(checkpointActual() === 'inicio' && CK_STATE.saltos >= 12, `termina en "inicio" (había ${pendientesAMitad} esperas a mitad)`);
check(!colgada.activa && !log.includes('ESPERA-COLGADA'), 'la espera previa se cancela y nunca dispara');
check(!log.includes('sala-activa') && !log.includes('dome-revealed') && esperasPendientes() === 0, 'sin sala-activa ni dome-revealed de más, ninguna espera colgada');
check(log.filter(x => x.startsWith('checkpoint')).join() === 'checkpoint:inicio', 'un solo alight:checkpoint (el del salto que terminó)');
log.length = 0;
irACheckpoint('visualizador'); irACheckpoint('amanecer_completo');             // dos seguidos en el mismo frame
hasta(() => CK_STATE.fase === 'listo');
check(checkpointActual() === 'amanecer_completo' && log.filter(x => x === 'sala-activa').length === 1 && MUNDO.amanecer === 'completo', 'dos saltos en el mismo frame: gana el último, una sola sala-activa');

console.log('\nencolado y tope');
instalarAcciones({ ...{}, ...Object.fromEntries(CHECKPOINTS.flatMap(c => c.pasos.map(p => [p[0], () => true]))),
  esperarDialogo: () => false, irALuz: () => { irACheckpoint('exploracion'); return true; } });
irACheckpoint('luz_dialogo'); frame();
check(CK_STATE.objetivo === 'luz_dialogo' && CK_STATE.pendiente === 'exploracion', 'un irACheckpoint dentro de una acción se encola (no interrumpe en el mismo tick)');
frame();
check(CK_STATE.objetivo === 'exploracion', '…y se atiende en el tick siguiente');
instalarAcciones({ ...Object.fromEntries(CHECKPOINTS.flatMap(c => c.pasos.map(p => [p[0], () => true]))), esperarDialogo: () => false });
irACheckpoint('luz_dialogo'); for (let i = 0; i < 60 * 14; i++) tickCheckpoints(1 / 60);
check(CK_STATE.fase === 'error' && /esperarDialogo/.test(CK_STATE.error), `tope por paso: "${CK_STATE.error}"`);

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
