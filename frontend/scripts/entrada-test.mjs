// Z59: prueba de la línea de tiempo de la entrada tras el telón (lib/entradaTelon.ts) contra la máquina del destello
// (fases de lib/curtainFlash.ts con los tiempos de DBG_FLASH). Uso: node scripts/entrada-test.mjs
import fs from 'node:fs';
import { BLOQUEO_MOV, iniciarEntrada, tickEntrada, cancelarEntrada, movimientoBloqueado, bloquearMovimiento, liberarMovimiento, crearEstadoEntrada, poseEntrada, crearPoseEntrada } from '../lib/entradaTelon.ts';

const src = fs.readFileSync(new URL('../lib/debugConfig.ts', import.meta.url), 'utf8');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string/g, '')});`)();
const C = obj('DBG_ENTRADA'), FL = obj('DBG_FLASH');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const f = (n, d = 0) => n.toFixed(d);

// fases del destello normal (el sostenido real se extiende hasta que el telón se apaga; acá usamos el mínimo)
const SUB = FL.FLASH_SUBIDA_MS, SOS = FL.FLASH_SOSTENIDO_MS, BAJ = FL.FLASH_BAJADA_MS, GLA = FL.FLASH_GLARE_MS;
const FIN = SUB + SOS + BAJ + GLA;
const fase = t => (t < 0 ? 'inactivo' : t < SUB ? 'subida' : t < SUB + SOS ? 'sostenido' : t < SUB + SOS + BAJ ? 'bajada' : t < FIN ? 'glare' : 'inactivo');
console.log(`\ndestello: subida ${SUB} ms · sostenido ≥ ${SOS} ms · bajada ${BAJ} ms · glare ${GLA} ms → fin a los ${FIN} ms del cruce`);

// simula a 60 fps desde el cruce (t = 0); el destello arranca en el mismo instante
const simular = (cfg = C, opts = {}) => {
  const e = crearEstadoEntrada(); BLOQUEO_MOV.razones.clear(); if (opts.ajeno) bloquearMovimiento('ajeno');
  iniciarEntrada(e, cfg, 0);
  const r = { teleportT: [], faseEnTeleport: [], libreT: -1, bloqueadoTrasCruce: movimientoBloqueado() };
  for (let t = 0; t <= 15000; t += 1000 / 60) {
    const fd = opts.sinDestello ? 'inactivo' : fase(t);
    if (tickEntrada(e, cfg, fd, t, opts.ck && t > opts.ck)) { r.teleportT.push(t); r.faseEnTeleport.push(fd); }
    if (r.libreT < 0 && e.fase === 'inactiva' && !BLOQUEO_MOV.razones.has('entrada')) r.libreT = t;
  }
  r.estado = e; r.razonesFinal = [...BLOQUEO_MOV.razones];
  return r;
};

console.log('\nlínea de tiempo');
const a = simular();
console.log(`    teletransporte a ${f(a.teleportT[0])} ms (fase ${a.faseEnTeleport[0]}) · movimiento libre a ${f(a.libreT)} ms (fin del destello ${FIN} + extra ${C.BLOQUEO_EXTRA_S * 1000})`);
check(a.bloqueadoTrasCruce, 'WASD bloqueado desde el cruce');
check(a.teleportT.length === 1 && a.faseEnTeleport[0] === 'sostenido' && a.teleportT[0] >= SUB, 'un solo teletransporte, en el pico (blanco total, fase sostenido)');
check(a.libreT >= FIN + C.BLOQUEO_EXTRA_S * 1000 - 1 && a.libreT < FIN + C.BLOQUEO_EXTRA_S * 1000 + 20, `se libera tras el fin del destello + BLOQUEO_EXTRA_S (${f(a.libreT)} ms)`);
{ // sigue bloqueado durante bajada y glare
  const e = crearEstadoEntrada(); BLOQUEO_MOV.razones.clear(); iniciarEntrada(e, C, 0); let libreAntes = false;
  for (let t = 0; t < FIN + C.BLOQUEO_EXTRA_S * 1000 - 20; t += 1000 / 60) { tickEntrada(e, C, fase(t), t, false); if (!movimientoBloqueado()) libreAntes = true; }
  check(!libreAntes, 'no se libera antes de tiempo (ni en la bajada ni en el glare ni en el extra)'); }

console.log('\nbloqueos ajenos');
const b = simular(C, { ajeno: true });
check(b.razonesFinal.length === 1 && b.razonesFinal[0] === 'ajeno', 'al terminar libera solo su razón: un bloqueo ajeno sigue activo');
{ BLOQUEO_MOV.razones.clear(); bloquearMovimiento('entrada'); liberarMovimiento('otra'); check(movimientoBloqueado(), 'liberar otra razón no libera la de la entrada'); BLOQUEO_MOV.razones.clear(); }

console.log('\ncasos');
const c = simular(C, { sinDestello: true });
check(c.teleportT.length === 1 && c.teleportT[0] === 0 && Math.abs(c.libreT - C.BLOQUEO_EXTRA_S * 1000) < 20, `sin destello (apagado): teletransporta enseguida y libera a los ${C.BLOQUEO_EXTRA_S} s`);
const d = simular(C, { ck: 50 });
check(d.teleportT.length === 0 && d.estado.fase === 'inactiva' && d.razonesFinal.length === 0, 'un checkpoint en curso cancela la entrada (no teletransporta, libera su bloqueo): manda el checkpoint');
{ const e = crearEstadoEntrada(); BLOQUEO_MOV.razones.clear(); check(!iniciarEntrada(e, { ...C, ACTIVO: false }, 0) && !movimientoBloqueado(), 'ACTIVO false: no bloquea ni teletransporta (como antes)'); }
{ const e = crearEstadoEntrada(); BLOQUEO_MOV.razones.clear(); iniciarEntrada(e, C, 0); let t = 0;
  for (; t < 30000 && e.fase !== 'inactiva'; t += 1000 / 60) tickEntrada(e, C, 'sostenido', t, false);   // destello trabado en blanco
  check(e.fase === 'inactiva' && !movimientoBloqueado() && Math.abs(t - C.TOPE_S * 1000) < 40, `tope de seguridad: con el destello trabado libera a los ${C.TOPE_S} s`); }
{ // segundo cruce: repite la entrada
  const e = crearEstadoEntrada(); BLOQUEO_MOV.razones.clear(); let n = 0;
  for (const t0 of [0, 20000]) { iniciarEntrada(e, C, t0); for (let t = t0; t <= t0 + 10000; t += 1000 / 60) if (tickEntrada(e, C, fase(t - t0), t, false)) n++; }
  check(n === 2 && !movimientoBloqueado(), 'cruzar el telón otra vez repite la entrada (dos saltos, ambos liberados)'); }
{ const e = crearEstadoEntrada(); BLOQUEO_MOV.razones.clear(); iniciarEntrada(e, C, 0); cancelarEntrada(e); check(!movimientoBloqueado(), 'al desmontar (cancelar) no queda el WASD bloqueado'); }
{ // la pose: dentro de la sala, fuera de la tarima (3,19 × 3,19 m centrada) y de la fila de sillas (z = −7, x −2,5…2,5)
  const x = C.POS_X, z = C.POS_Z, dT = Math.hypot(x, z);
  const yawMira = Math.atan2(-(0 - x), -(0 - z)) * 180 / Math.PI;
  console.log(`    pose: (${x}, 1,6, ${z}) · ${f(dT, 2)} m del centro de la tarima · yaw ${C.YAW_DEG}° (el que mira al centro: ${f(yawMira, 1)}°) · pitch ${C.PITCH_DEG}°`);
  check(Math.abs(x) < 39.5 && Math.abs(z) < 39.5 && (Math.abs(x) > 1.6 + 0.4 || Math.abs(z) > 1.6 + 0.4) && !(z > -7.6 && z < -6.4 && x > -3.1 && x < 3.1), 'dentro de la sala, fuera de la tarima y de las sillas');
  check(dT >= 6 && dT <= 7.5 && Math.abs(yawMira - C.YAW_DEG) < 0.5, 'a 6–7,5 m de la tarima, mirando a su centro'); }

// ── Z65: pose final = pose de Z59 + DESPLAZ_IZQ_M a la izquierda de la mirada (perpendicular al yaw, en el suelo) ──
console.log('\nZ65: desplazamiento a la izquierda');
{ const OBST = [{ x0: -1.596 - 0.6, z0: -1.596 - 0.6, x1: 1.596 + 0.6, z1: 1.596 + 0.6 }, { x0: -3.3, z0: -7.9, x1: 3.3, z1: -6.1 }];   // = calcularPoseEntrada
  const P = poseEntrada(C, 39.5, OBST, { x: 0, z: 0 }, crearPoseEntrada());
  const yaw = C.YAW_DEG * Math.PI / 180, fwd = [-Math.sin(yaw), -Math.cos(yaw)], izq = [-Math.cos(yaw), Math.sin(yaw)];
  const d = [P.x - C.POS_X, P.z - C.POS_Z];
  console.log(`    mirada (${f(fwd[0], 3)}, ${f(fwd[1], 3)}) · izquierda (${f(izq[0], 3)}, ${f(izq[1], 3)}) · pose final x ${f(P.x, 2)} · z ${f(P.z, 2)} · yaw ${f(P.yawDeg, 1)}° · pitch ${f(P.pitchDeg, 1)}°${P.ajustada ? ' · AJUSTADA' : ''}`);
  check(Math.abs(Math.hypot(...d) - C.DESPLAZ_IZQ_M) < 1e-9 && Math.abs(d[0] * fwd[0] + d[1] * fwd[1]) < 1e-9, `se movió ${C.DESPLAZ_IZQ_M} m, perpendicular a la mirada`);
  check(fwd[0] * izq[1] - fwd[1] * izq[0] < 0 && d[0] * izq[0] + d[1] * izq[1] > 0, 'hacia la izquierda (en three, con +Y arriba, girar la mirada 90° antihorario visto desde arriba)');
  check(!P.ajustada && P.yawDeg === C.YAW_DEG && P.pitchDeg === C.PITCH_DEG, 'MIRAR_TARIMA false: mismo yaw y pitch, sin ajustes (no cae en la tarima, las sillas ni fuera de la sala)');
  const Q = poseEntrada({ ...C, MIRAR_TARIMA: true }, 39.5, OBST, { x: 0, z: 0 }, crearPoseEntrada());
  const fq = [-Math.sin(Q.yawDeg * Math.PI / 180), -Math.cos(Q.yawDeg * Math.PI / 180)], aT = [-Q.x, -Q.z], nT = Math.hypot(...aT);
  check(Math.abs(fq[0] * aT[0] / nT + fq[1] * aT[1] / nT - 1) < 1e-9 && Q.x === P.x && Q.z === P.z, `MIRAR_TARIMA true: misma posición, yaw ${f(Q.yawDeg, 1)}° apunta al centro de la tarima`);
  const Z = poseEntrada({ ...C, DESPLAZ_IZQ_M: 0 }, 39.5, OBST, { x: 0, z: 0 }, crearPoseEntrada());
  check(Z.x === C.POS_X && Z.z === C.POS_Z, 'DESPLAZ_IZQ_M 0 = pose de Z59');
  const T = poseEntrada({ ...C, POS_X: -1, POS_Z: 0.5, DESPLAZ_IZQ_M: 1 }, 39.5, OBST, { x: 0, z: 0 }, crearPoseEntrada());
  check(T.ajustada && !(Math.abs(T.x) < 2.196 && Math.abs(T.z) < 2.196), `si cae en la tarima se lo empuja afuera por el lado más cercano (${f(T.x, 2)}, ${f(T.z, 2)})`);
  const S = poseEntrada({ ...C, POS_X: 0, POS_Z: 0, YAW_DEG: 0, DESPLAZ_IZQ_M: 60 }, 39.5, [], { x: 0, z: 0 }, crearPoseEntrada());
  check(S.ajustada && S.x === -39.5, 'fuera de la sala: se recorta al límite');
  // el telón (ancla (−10, −7) + EJE × curtainDistM): se oculta en el destello y se desmonta, pero informamos la distancia
  const L = Math.hypot(10, 7), ej = [10 / L, 7 / L], tc = [-10 + ej[0] * 3, -7 + ej[1] * 3];
  console.log(`    centro del telón (${f(tc[0], 2)}, ${f(tc[1], 2)}): la entrada queda a ${f(Math.hypot(P.x - tc[0], P.z - tc[1]), 2)} m de su centro y a ${f((P.x - tc[0]) * ej[0] + (P.z - tc[1]) * ej[1], 2)} m de su plano (del lado de la tarima)`); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
