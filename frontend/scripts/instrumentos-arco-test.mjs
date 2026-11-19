// Z99b: instrumentos en arco detrás de la tarima (lib/instrumentosDisposicion.ts, lib/instrumentosPose.ts).
// (a) el índice 0 = la caja de ritmos exactamente donde está (Z88); (b) todos a la misma distancia del centro; (c) vecinos
// a SEPARACION_M y no vecinos a más de 1,8 m; (d) simetría ±k; (e) todos miran al centro; (f) arco total ≤ ARCO_MAX_GRADOS
// con 7 slots (reduce la separación); (g) "linea" = Z88; (h) ningún slot en la tarima, del lado de las sillas ni fuera de
// la sala; (i) consumidores con la función única (lectura de código); (j) legibilidad del BA-40 con el yaw nuevo.
// Uso: node scripts/instrumentos-arco-test.mjs
import fs from 'node:fs';
import { register } from 'node:module';
const RAIZ = new URL('../', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`const R = ${JSON.stringify(RAIZ)};
export async function resolve(s, c, n) {
  if (s.startsWith('@/')) s = R + s.slice(2);
  if ((/^\\.\\.?\\//.test(s) || s.startsWith('file:')) && !/\\.[a-z]+$/.test(s)) { try { return await n(s + '.ts', c); } catch {} }
  return n(s, c);
}`));
const D = await import('../lib/instrumentosDisposicion.ts');
const P = await import('../lib/instrumentosPose.ts');
const PT = await import('../lib/playTarima.ts');
const LY = await import('../lib/layoutSala.ts');
const CFG = await import('../lib/debugConfig.ts');
const B = await import('../lib/atrilBajo.ts');
const S = await import('../lib/atrilSonido.ts');
const { DBG_INSTRUMENTOS: I, DBG_ATRIL_BAJO: AB, DBG_RITMOS, DBG_PLAY, DBG_LAYOUT, DBG_LUZ } = CFG;

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const sinCom = t => t.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const PURO = leer('../lib/instrumentosDisposicion.ts'), POSE = leer('../lib/instrumentosPose.ts');
const LS = sinCom(leer('../components/LecternSystem.tsx')), CA = sinCom(leer('../lib/checkpointsAcciones.ts'));
const TS = sinCom(leer('../components/ThreeScene.tsx')), PTX = sinCom(leer('../components/PlayTarima.tsx'));
const GUIA = leer('../components/GuiaArcoInstrumentos.tsx'), CFGT = leer('../lib/debugConfig.ts');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const grados = r => (r * 180) / Math.PI;
const difAng = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const f = (v, n = 3) => v.toFixed(n).replace('.', ',');

// Geometría de hoy (la registra LecternSystem: LECTERN_PLACE_X = 1,3 + 0,3; TARIMA_W / 2; TARIMA_H_REF)
P.GEO_INSTRUMENTOS.atrilX = 1.3 + CFG.LECTERN_OUTWARD_OFFSET_M;
P.GEO_INSTRUMENTOS.tarimaMedia = 4.2 * 0.76 / 2;
P.GEO_INSTRUMENTOS.tarimaH = 0.267;
const G = P.GEO_INSTRUMENTOS;

// caja de hoy (Z88), calculada como CajaRitmos: slotsActuales(...)[DBG_RITMOS.SLOT]
const eje = { cx: 0, cz: 0, ux: 0, uz: 1 }, sil = { x: 0, z: 0 };
LY.centroSillasEn(DBG_LAYOUT, sil);
PT.ejeDetrasTarima(LY.TARIMA_CENTRO.x, LY.TARIMA_CENTRO.z, sil.x, sil.z, eje);
const z88 = PT.slotsSegunUbicacion(DBG_PLAY, DBG_RITMOS, G.atrilX, eje, G.tarimaMedia, G.tarimaH, []);
const caja = z88[DBG_RITMOS.SLOT];
const R0 = Math.hypot(caja.x - eje.cx, caja.z - eje.cz);

console.log('\nconstantes y estructura');
check(!/^import /m.test(PURO), 'lib/instrumentosDisposicion.ts sin imports (lógica pura)');
check(I.DISPOSICION === 'arco' && I.RADIO_M === 0 && I.SEPARACION_M === 2 && I.ARCO_MAX_GRADOS === 150 && I.MIRAR_AL_CENTRO === true && I.GUIA === false && AB.INDICE_ARCO === 1,
  'DBG_INSTRUMENTOS: arco, RADIO_M 0 (auto), SEPARACION_M 2,0, ARCO_MAX_GRADOS 150, MIRAR_AL_CENTRO, guía oculta; DBG_ATRIL_BAJO.INDICE_ARCO +1');
check(D.ORDEN_SLOTS[0]?.id === 'ritmos' && D.ORDEN_SLOTS[1]?.id === 'bajo' && D.ORDEN_SLOTS[-1]?.id === 'sintetizador' && D.ORDEN_SLOTS[2]?.id === 'sampler'
  && !D.ORDEN_SLOTS[-1].ocupado && !D.ORDEN_SLOTS[2].ocupado && D.ORDEN_SLOTS[3] === null && D.ORDEN_SLOTS[-2] === null && D.ORDEN_SLOTS[-3] === null,
  'orden: 0 caja, +1 BA-40, −1 SY-40 (reservado), +2 SM-40 (reservado), resto libres');
console.log(`  · centro de la tarima (${eje.cx}, ${eje.cz}) · eje hacia (${eje.ux}, ${eje.uz}) · caja en (${f(caja.x)}, ${f(caja.z)}) yaw ${f(grados(caja.yaw), 1)}° · radio ${f(R0, 4)} m`);

const pose = { x: 0, z: 0, yaw: 0 };
const todas = () => { const o = {}; for (let k = -3; k <= 3; k++) { const p = { x: 0, z: 0, yaw: 0 }; P.poseInstrumento(k, p); o[k] = p; } return o; };

console.log('\n(a) el índice 0 es la caja, exactamente donde está hoy');
{ const p = D.posicionSlot(0, eje, R0, 2, {}, { x: 0, z: 0, yaw: 0 });
  check(Math.abs(p.x - caja.x) < 1e-12 && Math.abs(p.z - caja.z) < 1e-12 && difAng(p.yaw, caja.yaw) < 1e-12, `posicionSlot(0) = caja (${f(p.x)}, ${f(p.z)}) yaw ${f(grados(p.yaw), 1)}°`);
  P.poseInstrumento(0, pose);
  check(pose.x === caja.x && pose.z === caja.z && pose.yaw === caja.yaw, 'poseInstrumento(0) devuelve el slot de la caja de Z88 bit a bit');
  check(Math.abs(P.radioCaja() - R0) < 1e-12 && Math.abs(P.radioArco() - R0) < 1e-12, `radio automático = distancia caja ↔ centro (${f(R0, 4)} m)`);
  I.RADIO_M = 5; P.poseInstrumento(0, pose); const quieta = pose.x === caja.x && pose.z === caja.z; I.RADIO_M = 0;
  check(quieta, 'con RADIO_M manual la caja no se mueve');
  check(difAng(caja.yaw, Math.atan2(eje.cx - caja.x, eje.cz - caja.z)) < 1e-12, 'el yaw actual de la caja ya apunta al centro de la tarima (no hubo que tocarlo)'); }

const A = todas();
console.log('\n(b) misma distancia del centro');
{ let peor = 0; for (let k = -3; k <= 3; k++) peor = Math.max(peor, Math.abs(Math.hypot(A[k].x - eje.cx, A[k].z - eje.cz) - R0));
  check(peor <= 1e-6, `7 slots a ${f(R0, 4)} m del centro (desvío máx ${peor.toExponential(1)})`); }

console.log('\n(c) separación entre vecinos y no vecinos');
{ // con los ocupados y reservados (−1…+2: índice máx auto 2) no se reduce
  const paso = P.pasoArcoActual();
  check(P.indiceMaxArco() === 2 && !paso.reducida && Math.abs(paso.separacion - I.SEPARACION_M) < 1e-9, `índice máx auto 2: sin reducción, separación ${f(paso.separacion, 3)} m, arco total ${f(paso.arcoTotalGrados, 1)}°`);
  let mal = []; for (let k = -2; k < 2; k++) { const d = Math.hypot(A[k + 1].x - A[k].x, A[k + 1].z - A[k].z); if (Math.abs(d - I.SEPARACION_M) > 1e-9) mal.push(`${k}↔${k + 1} ${f(d)}`); }
  check(mal.length === 0, `vecinos −2…+2 a ${f(I.SEPARACION_M, 1)} m en línea recta${mal.length ? ': ' + mal.join(', ') : ''}`);
  let minNo = Infinity; for (let a = -3; a <= 3; a++) for (let b = a + 2; b <= 3; b++) minNo = Math.min(minNo, Math.hypot(A[a].x - A[b].x, A[a].z - A[b].z));
  check(minNo > 1.8, `no vecinos: mínimo ${f(minNo)} m (> 1,8 m)`);
  // parado frente al BA-40 (1 m), la caja y el siguiente quedan fuera del rango de E
  const fr = B.poseFrenteAtrilBajo(A[1].x, A[1].z, A[1].yaw, 1.0);
  const dCaja = Math.hypot(fr.x - A[0].x, fr.z - A[0].z), dSig = Math.hypot(fr.x - A[2].x, fr.z - A[2].z), dSon = Math.hypot(fr.x - G.atrilX, fr.z);
  check(dCaja > 1.8 && dSig > 1.8 && dSon > 1.8, `frente al BA-40 (checkpoint): caja a ${f(dCaja, 2)} m, slot +2 a ${f(dSig, 2)} m, SN-40 a ${f(dSon, 2)} m (> 1,8)`);
  const frC = B.poseFrenteAtrilBajo(A[0].x, A[0].z, A[0].yaw, 1.0);
  check(Math.hypot(frC.x - A[1].x, frC.z - A[1].z) > 1.8 && Math.hypot(frC.x - A[-1].x, frC.z - A[-1].z) > 1.8, 'frente a la caja, el BA-40 y el slot −1 quedan fuera de 1,8 m'); }

console.log('\n(d) simetría ±k respecto del eje de la caja');
{ let peor = 0; for (let k = 1; k <= 3; k++) {
    // espejo respecto de la recta centro + t·u: componente perpendicular cambia de signo
    const perp = p => (p.x - eje.cx) * eje.uz - (p.z - eje.cz) * eje.ux, par = p => (p.x - eje.cx) * eje.ux + (p.z - eje.cz) * eje.uz;
    peor = Math.max(peor, Math.abs(perp(A[k]) + perp(A[-k])), Math.abs(par(A[k]) - par(A[-k])), difAng(A[k].yaw - caja.yaw, -(A[-k].yaw - caja.yaw)));
  }
  check(peor < 1e-9, `+k y −k espejados (desvío ${peor.toExponential(1)}) · +1 hacia +X (lado del atril de sonido): x ${f(A[1].x)}`);
  check(A[1].x > 0 && A[-1].x < 0, '+1 del lado del atril de sonido (+X), −1 del otro'); }

console.log('\n(e) todos miran al centro');
{ let peor = 0; for (let k = -3; k <= 3; k++) peor = Math.max(peor, difAng(A[k].yaw, Math.atan2(eje.cx - A[k].x, eje.cz - A[k].z)));
  check(peor < 1e-9, `yaw = dirección al centro (desvío ${peor.toExponential(1)} rad)`);
  I.MIRAR_AL_CENTRO = false; const p = { x: 0, z: 0, yaw: 0 }; P.poseInstrumento(2, p); I.MIRAR_AL_CENTRO = true;
  check(difAng(p.yaw, caja.yaw) < 1e-12, 'MIRAR_AL_CENTRO false: yaw fijo (el de la caja, de frente a la tarima)'); }

console.log('\n(f) tope del arco con 7 slots');
{ I.INDICE_MAX = 3;
  const paso = P.pasoArcoActual(); const B7 = todas();
  const ang = Math.abs(Math.atan2(B7[3].x - eje.cx, B7[3].z - eje.cz) - Math.atan2(B7[-3].x - eje.cx, B7[-3].z - eje.cz));
  check(paso.reducida && grados(ang) <= I.ARCO_MAX_GRADOS + 1e-9, `7 slots: arco ${f(grados(ang), 1)}° ≤ ${I.ARCO_MAX_GRADOS}°, separación reducida a ${f(paso.separacion)} m`);
  const dv = Math.hypot(B7[1].x - B7[0].x, B7[1].z - B7[0].z);
  check(Math.abs(dv - paso.separacion) < 1e-9, `vecinos a la separación reducida (${f(dv)} m)`);
  console.log(`  · aviso: con 7 slots y radio ${f(R0, 3)} m los vecinos quedan a ${f(paso.separacion, 2)} m (< 1,8 m); para 2,0 m con 150° hace falta radio ≥ ${f(D.radioMinimoPara(2, 150, 3), 2)} m`);
  for (const [r, sep, tope, n] of [[3, 2, 150, 3], [6, 2, 150, 3], [3.596, 3, 120, 2], [10, 1, 150, 3]]) {
    const pa = D.pasoArco(r, sep, tope, n, { angulo: 0, separacion: 0, reducida: false, arcoTotalGrados: 0 });
    check(pa.arcoTotalGrados <= tope + 1e-9 && (pa.reducida ? pa.separacion < sep : Math.abs(pa.separacion - sep) < 1e-9), `R ${r} sep ${sep} tope ${tope}° ±${n}: arco ${f(pa.arcoTotalGrados, 1)}°, sep ${f(pa.separacion)}${pa.reducida ? ' (reducida)' : ''}`);
  }
  I.INDICE_MAX = 0; }

console.log('\n(g) "linea" = Z88');
{ I.DISPOSICION = 'linea';
  let mal = 0; for (let i = 0; i < z88.length; i++) { const k = D.indiceDesdeSlotLinea(i, DBG_RITMOS.SLOT); const p = { x: 0, z: 0, yaw: 0 };
    if (!P.poseInstrumento(k, p) || p.x !== z88[i].x || p.z !== z88[i].z || p.yaw !== z88[i].yaw) mal++; }
  check(mal === 0, `los ${z88.length} slots de la línea idénticos a slotsSegunUbicacion de Z88`);
  const b = P.poseAtrilBajo({ x: 0, z: 0, yaw: 0 });
  check(b.x === z88[AB.SLOT].x && b.z === z88[AB.SLOT].z && Math.abs(b.x - 1.7) < 1e-12 && Math.abs(b.z - R0) < 1e-12, `BA-40 con "linea": slot ${AB.SLOT} de Z88 (${f(b.x)}, ${f(b.z)}) como en Z99`);
  check(B.ATRIL_BAJO.x === b.x && B.ATRIL_BAJO.z === b.z && B.ATRIL_BAJO.yaw === b.yaw, 'poseAtrilBajo escribe ATRIL_BAJO (aviso "E" y tecla E)');
  const p = { x: 0, z: 0, yaw: 0 };
  check(P.poseInstrumento(3, p) === false, 'con "linea" (4 slots) el índice +3 no existe');
  const l = D.posicionLinea(1, eje, R0, DBG_PLAY.SLOTS_SEP_M, true, { x: 0, z: 0, yaw: 0 });
  check(Math.abs(l.x - z88[0].x) < 1e-12 && Math.abs(l.z - z88[0].z) < 1e-12, 'posicionLinea pura = Z88');
  I.DISPOSICION = 'arco';
  const ba = P.poseAtrilBajo({ x: 0, z: 0, yaw: 0 });
  check(ba.x === A[1].x && ba.z === A[1].z && ba.yaw === A[1].yaw, `BA-40 con "arco": índice +1 (${f(ba.x)}, ${f(ba.z)}) yaw ${f(grados(ba.yaw), 1)}°`);
  DBG_RITMOS.UBICACION = 'slot_atril'; check(!P.enArco(), 'con la caja en "slot_atril" (Z79) no vale el arco'); DBG_RITMOS.UBICACION = 'detras_tarima'; }

console.log('\n(h) ni en la tarima, ni del lado de las sillas, ni fuera de la sala');
{ const ch = { dentroTarima: false, ladoSillas: false, fueraSala: false };
  const sala = DBG_LUZ.SALA_MEDIA_M - DBG_LUZ.SALA_MARGEN_M;
  const radioAtril = Math.hypot(1.40, 0.65) / 2;   // medio diagonal del panel del atril (OUTER_W × OUTER_D aprox.)
  for (const [nom, cfg] of [['índice máx auto (±2, los slots en uso)', 0], ['7 slots (±3)', 3]]) {
    I.INDICE_MAX = cfg; const T = todas(); const mal = []; const km = P.indiceMaxArco();
    for (let k = -km; k <= km; k++) {
      D.chequearSlot(T[k], eje, G.tarimaMedia, radioAtril * 0.5, sala, ch);
      if (ch.dentroTarima || ch.ladoSillas || ch.fueraSala) mal.push(k);
      if (Math.hypot(T[k].x - G.atrilX, T[k].z) < 2 * radioAtril && k !== 0) mal.push(`${k}↔SN-40`);
      if (Math.hypot(T[k].x + G.atrilX, T[k].z) < 2 * radioAtril && k !== 0) mal.push(`${k}↔IM-40`);
      const m = { x: 0, z: 0 }; for (const lado of [-1, 1]) { LY.monolitoEn(lado, CFG.DBG_SILLAS.monolithDistM, DBG_LAYOUT, m); if (!(Math.hypot(T[k].x - m.x, T[k].z - m.z) >= 2)) mal.push(`${k}↔monolito`); }
    }
    check(mal.length === 0, `${nom}: ningún slot dentro de la tarima, del lado de las sillas (z < 0), fuera de ±${sala} m ni encima de SN-40, IM-40 o los monolitos${mal.length ? ': ' + mal.join(', ') : ''}`);
    console.log('  · ' + Array.from({ length: 7 }, (_, j) => j - 3).map(k => `${k > 0 ? '+' : ''}${k}: (${f(T[k].x, 2)}, ${f(T[k].z, 2)}) ${f(grados(T[k].yaw), 1)}°`).join(' · '));
  }
  I.INDICE_MAX = 0;
  // separación 2,0 sin tope (índice máx 3): el ±3 cae del lado de las sillas → el tope lo evita
  const p = D.posicionSlot(3, eje, R0, 2, { arcoMaxGrados: 360, indiceMax: 3 }, { x: 0, z: 0, yaw: 0 });
  check(p.z < 0, `sin el tope, el ±3 a 2,0 m caería del lado de las sillas (z ${f(p.z, 2)}): el tope de 150° lo evita`);
  check(/k > km \|\| -k > km/.test(GUIA), 'la guía muestra solo los slots dentro del índice máximo vigente (con auto, ±2: los ±3 libres caerían del lado de las sillas)'); }

console.log('\n(i) función única (lectura de código)');
check(/function poseLado[\s\S]{0,200}return poseAtrilBajo\(_poseLado\)/.test(LS) && !/slotsActuales\(/.test(LS), 'LecternSystem: poseLado("bajo") = poseAtrilBajo (atril, pedestal, cámara del modo atril _makePose / fitLecternCamera)');
check(/side === "bajo" && poseRef\.current\)[\s\S]{0,80}poseLado\("bajo"\)/.test(LS) && /<group ref=\{poseRef\}/.test(LS), 'el atril y su pedestal siguen la pose en vivo (useFrame)');
check(/GEO_INSTRUMENTOS\.atrilX = LECTERN_PLACE_X; GEO_INSTRUMENTOS\.tarimaMedia = TARIMA_W \/ 2; GEO_INSTRUMENTOS\.tarimaH = TARIMA_H_REF;/.test(LS), 'LecternSystem registra la geometría real');
check(/frenteAtrilBajo:[\s\S]{0,120}poseAtrilBajo\(_poseBajo\)/.test(CA) && !/ATRIL_BAJO\./.test(CA), 'checkpoint atril_bajo: poseAtrilBajo, no la caché ATRIL_BAJO');
check(/function irAInstrumento[\s\S]{0,120}poseInstrumento\(k, _poseBajo\)/.test(CA), '"Ir al instrumento": poseInstrumento');
check(/ATRIL_BAJO\.x = out\.x; ATRIL_BAJO\.z = out\.z; ATRIL_BAJO\.yaw = out\.yaw;/.test(POSE) && /ATRIL_BAJO\.visible && Math\.hypot\(cam\.position\.x - ATRIL_BAJO\.x/.test(TS) && /dBajo\s*=\s*ATRIL_BAJO\.visible \? Math\.hypot\(camera\.position\.x - ATRIL_BAJO\.x/.test(LS),
  'aviso "E" y tecla E leen ATRIL_BAJO, que solo escribe poseAtrilBajo (cada cuadro)');
check(/if \(enArco\(\)\)[\s\S]{0,200}i === centro \|\| !poseInstrumento\(indiceDesdeSlotLinea\(i, centro\), _poseArco\)/.test(PTX), 'marcadores de slots (MOSTRAR_SLOTS): poseInstrumento, salvo el de la caja');
check(/poseInstrumento\(k, _p\)/.test(GUIA) && /visible=\{false\}/.test(GUIA) && /DBG_INSTRUMENTOS\.GUIA/.test(GUIA), 'guía del arco: poseInstrumento, oculta por defecto');
check(/GUIA:\s+false/.test(CFGT), 'DBG_INSTRUMENTOS.GUIA false');
{ const uf = GUIA.slice(GUIA.indexOf('useFrame(')); const cuerpo = uf.slice(0, uf.indexOf('\n  });'));
  check(!/new [A-Z]|\[\s*\]|\{\s*\}/.test(cuerpo), 'guía: sin new ni arreglos u objetos nuevos en useFrame'); }
{ const c = POSE.slice(POSE.indexOf('export function poseInstrumento')); check(!/new |\{ x: 0/.test(c), 'instrumentosPose: sin allocations (objetos de salida reutilizados)'); }

console.log('\n(j) legibilidad del BA-40 con el yaw nuevo');
{ const g = S.GEO_DEFECTO;
  const ba = P.poseAtrilBajo({ x: 0, z: 0, yaw: 0 });
  for (const [nom, a] of [['16:10', 1.6], ['16:9', 16 / 9]]) {
    const p = B.buscarPoseBajo(g, a, S.escalaEfectiva(1, true, a));
    check(!!p && p.legible >= 0.025, `${nom}: ${f(100 * p.legible, 2)} % (≥ 2,5 %) · fov ${p.fov}° h ${f(p.height, 2)} d ${f(p.dist, 2)} pitch ${p.pitch}° · pasada ${p.pasada}`);
  }
  check(/makeTranslation\(pl\.x, TARIMA_H_REF, pl\.z\)[\s\S]{0,80}makeRotationY\(pl\.yaw\)/.test(LS),
    `la búsqueda es en coordenadas del atril y _makePose la lleva al mundo con poseLado (yaw nuevo ${f(grados(ba.yaw), 1)}°): la legibilidad no depende del yaw`); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
