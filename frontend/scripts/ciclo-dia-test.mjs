// Z48: prueba del ciclo de día (lib/cicloDia.ts): estado del cielo en los puntos clave, continuidad, pausa,
// duración atada al tema, LOOP, cambio de tema, skip / reset de la máquina única, checkpoints y el orden de la
// introducción (montañas → sol → resto). Uso: node scripts/ciclo-dia-test.mjs
// DBG_DIA se lee de lib/debugConfig.ts (mismos valores que el juego, sin copiarlos).
import fs from 'node:fs';
import {
  crearEstadoDia, avanzarDia, estadoCielo, tDiaDesdeT, tDesdeTDia, largoDia, posicionarDia, hexARgb, SKIP_TFIN,
} from '../lib/cicloDia.ts';

const fuente = fs.readFileSync(new URL('../lib/debugConfig.ts', import.meta.url), 'utf8');
const m = /export const DBG_DIA = (\{[\s\S]*?\n\});/.exec(fuente);
const BASE = Function(`return (${m[1].replace(/ as string/g, '')});`)();
const cfg = (o = {}) => ({ ...structuredClone(BASE), ...o });

let ok = 0, fallas = 0;
const check = (c, msg) => { if (c) { ok++; console.log('  ✓ ' + msg); } else { fallas++; console.log('  ✗ ' + msg); } };
const f = (n, d = 3) => n.toFixed(d);
const deg = r => r * 180 / Math.PI;
const amNuevo = () => ({ fase: 'inactivo', pendiente: false, t: 0, p1: 0, tFin: 0 });
const igualRgb = (a, hex, tol = 1e-6) => { const b = hexARgb(hex); return Math.abs(a[0] - b[0]) < tol && Math.abs(a[1] - b[1]) < tol && Math.abs(a[2] - b[2]) < tol; };

console.log('\nestado del cielo en los puntos clave');
const C = cfg();
const E = crearEstadoDia();
const ver = x => { estadoCielo(x, C, E); return `${f(x, 2)}: etapa=${E.etapa} sol=${f(deg(E.solAlt), 1)}° az=${f(deg(E.solAz) % 360, 0)}° luz=${f(E.luz, 2)} estrellas=${f(E.estrellas, 2)} glow=${f(E.brilloSol, 2)} expo=${f(E.expo, 2)}`; };
for (const x of [0, 0.12, 0.2, 0.35, 0.5, 0.8, 0.92, 1]) console.log('    ' + ver(x));
estadoCielo(0, C, E); check(igualRgb(E.hor, C.ETAPAS.noche.hor) && igualRgb(E.fondo, '#0A0812') && E.estrellas === 1 && E.luz === 0 && E.solAlt < 0, '0: noche cerrada (colores de noche, fondo actual #0A0812, estrellas 1, sol bajo el horizonte)');
estadoCielo(0.12, C, E); check(igualRgb(E.hor, C.ETAPAS.alba.hor) && E.solAlt < 0 && E.etapa === 'alba', `0,12: alba (azul), sol todavía bajo el horizonte (${f(deg(E.solAlt), 1)}°)`);
estadoCielo(0.2, C, E); check(Math.abs(E.solAlt) < 1e-9 && igualRgb(E.hor, C.ETAPAS.salida.hor) && E.brilloSol === C.ETAPAS.salida.brilloSol && E.brilloSol >= C.ETAPAS.mediodia.brilloSol, '0,20: el sol en el horizonte, resplandor de la salida (mayor que al mediodía)');
estadoCielo(0.5, C, E); check(Math.abs(deg(E.solAlt) - 60) < 1e-6 && E.luz === 1 && E.estrellas === 0 && Math.abs(E.expo - 1.19) < 1e-9, '0,50: mediodía (sol a 60°, luz 1, sin estrellas, exposición × 1,19 = 0,95)');
estadoCielo(0.8, C, E); check(Math.abs(E.solAlt) < 1e-9 && igualRgb(E.hor, C.ETAPAS.atardecer.hor), '0,80: se pone el sol (colores del portal)');
estadoCielo(0.92, C, E); check(E.solAlt < 0 && igualRgb(E.cen, C.ETAPAS.crepusculo.cen) && E.etapa === 'crepusculo', '0,92: crepúsculo');
const e0 = crearEstadoDia(), e1 = crearEstadoDia(); estadoCielo(0, C, e0); estadoCielo(1, C, e1);
check([0, 1, 2].every(i => Math.abs(e0.hor[i] - e1.hor[i]) < 1e-9 && Math.abs(e0.solDir[i] - e1.solDir[i]) < 1e-9), '1 = 0: el ciclo cierra (colores y sol iguales)');
// dirección: el sol sale en SOL_AZ_SALIDA_DEG
estadoCielo(0.2, C, E); check(Math.abs((deg(E.solAz) % 360) - 120) < 1e-6 && Math.abs(Math.atan2(E.solDir[0], -E.solDir[2]) - E.solAz) < 1e-9, 'sale en el azimut 120° (convención del shader del domo)');

console.log('\ncontinuidad (sin saltos)');
{ const a = crearEstadoDia(), b = crearEstadoDia(); let maxC = 0, maxS = 0, maxL = 0;
  for (let x = 0; x < 1; x += 1e-4) { estadoCielo(x, C, a); estadoCielo(x + 1e-4, C, b);
    for (let i = 0; i < 3; i++) { maxC = Math.max(maxC, Math.abs(a.hor[i] - b.hor[i]), Math.abs(a.cen[i] - b.cen[i]), Math.abs(a.fondo[i] - b.fondo[i])); maxS = Math.max(maxS, Math.abs(a.solDir[i] - b.solDir[i])); }
    maxL = Math.max(maxL, Math.abs(a.luz - b.luz), Math.abs(a.estrellas - b.estrellas)); }
  check(maxC < 0.01 && maxS < 0.003 && maxL < 0.005,   // Z50: 0,003 (giro de noche del sol, bajo el horizonte)
   `paso de 1e-4: color ≤ ${f(maxC, 4)}, sol ≤ ${f(maxS, 4)}, luz/estrellas ≤ ${f(maxL, 4)}`); }
{ let prev = -1, mono = true, maxSalto = 0; for (let t = 0; t <= largoDia(180, C); t += 0.05) { const x = tDiaDesdeT(t, 180, C); if (x < prev - 1e-12) mono = false; if (prev >= 0) maxSalto = Math.max(maxSalto, x - prev); prev = x; }
  check(mono && maxSalto < 0.003, `tDia crece sin saltos con el tiempo (máx. ${f(maxSalto, 4)} cada 0,05 s)`); }
check(Math.abs(tDiaDesdeT(60, 180, C) - C.INTRO_TDIA_FIN) < 1e-9 && Math.abs(tDiaDesdeT(largoDia(180, C), 180, C) - 1) < 1e-9, 'la introducción termina en tDia 0,27 y el día en 1');
for (const x of [0.05, 0.2, 0.5, 0.8, 0.97]) check(Math.abs(tDiaDesdeT(tDesdeTDia(x, 180, C), 180, C) - x) < 1e-6, `inversa (checkpoints): tDia ${x} ↔ t ${f(tDesdeTDia(x, 180, C), 1)} s`);

console.log('\nintroducción: orden montañas → sol → resto (INTRO_S 60)');
{ const e = crearEstadoDia(), am = amNuevo(); const c = cfg();
  avanzarDia(e, c, 1 / 60, false, am, NaN, 1);
  check(e.fase === 'espera' && e.dia === 0 && e.montCrece === 0 && e.revPortal === 0 && e.estrellas === 1, 'antes de la primera luz: noche, montañas en silueta, portal oculto, estrellas visibles');
  am.pendiente = true;   // dispararAmanecer()
  const hitos = {}; let dawn = 0; const muestras = {};
  for (let i = 0; i <= 65 * 60; i++) {
    avanzarDia(e, c, 1 / 60, false, am, NaN, 1);
    const t = e.t;
    if (e.evDawn) { dawn++; hitos.dawn = t; }
    if (hitos.mont === undefined && e.montCrece >= 1) hitos.mont = t;
    if (hitos.sol0 === undefined && e.solAlt > 0) hitos.sol0 = t;
    if (hitos.solLibre === undefined && e.solAlt > 0.14) hitos.solLibre = t;   // sobre la cordillera (≤ 0,13 rad)
    if (hitos.portal === undefined && e.revPortal > 0) hitos.portal = t;
    if (hitos.olas === undefined && e.revOlas > 0) hitos.olas = t;
    if (hitos.anillos === undefined && e.revAnillos > 0) hitos.anillos = t;
    if (hitos.cielo === undefined && e.revCielo > 0) hitos.cielo = t;
    if (hitos.resto === undefined && e.revCielo >= 1) hitos.resto = t;
    for (const s of [5, 20, 40, 60]) if (muestras[s] === undefined && t >= s) muestras[s] = `tDia=${f(e.dia, 3)} sol=${f(deg(e.solAlt), 1)}° montañas=${f(e.montCrece, 2)} portal=${f(e.revPortal, 2)} olas=${f(e.revOlas, 2)} anillos=${f(e.revAnillos, 2)} cielo=${f(e.revCielo, 2)} estrellas=${f(e.estrellas, 2)}`;
  }
  for (const s of [5, 20, 40, 60]) console.log(`    ${s} s: ${muestras[s]}`);
  console.log(`    montañas completas ${f(hitos.mont, 1)} s · sol en el horizonte ${f(hitos.sol0, 1)} s · sol sobre la cordillera ${f(hitos.solLibre, 1)} s · portal ${f(hitos.portal, 1)} · olas ${f(hitos.olas, 1)} · anillos ${f(hitos.anillos, 1)} · cielo ${f(hitos.cielo, 1)} · todo ${f(hitos.resto, 1)} s · dawn-complete ${f(hitos.dawn, 1)} s`);
  check(hitos.mont < hitos.sol0 && hitos.sol0 < hitos.solLibre && hitos.solLibre <= hitos.portal + 0.5, 'primero las montañas, después sale el sol (detrás de la cordillera), después el resto');
  check(hitos.portal < hitos.olas && hitos.olas < hitos.anillos && hitos.anillos < hitos.cielo, 'el resto escalonado: portal/nubes → olas → anillos → cielo (confeti, warp)');
  check(dawn === 1 && Math.abs(hitos.dawn - 60) < 0.05 && Math.abs(hitos.resto - 60) < 0.05, 'dawn-complete una vez, a los 60 s, cuando termina el resto');
  check(am.fase === 'completo' && am.p1 === 1, 'la máquina única queda en "completo" (checkpoints, debug)');
  estadoCielo(0, C, E); check(e.estrellas < 0.3, `las estrellas se apagan con la luz (al final de la intro ${f(e.estrellas, 2)})`); }

console.log('\npausa');
{ const e = crearEstadoDia(), am = amNuevo(); const c = cfg(); am.pendiente = true;
  for (let i = 0; i < 600; i++) avanzarDia(e, c, 1 / 60, false, am, 200, 1);
  const t0 = e.t, d0 = e.dia;
  for (let i = 0; i < 6000; i++) avanzarDia(e, c, 1 / 60, true, am, 200, 1);
  check(e.t === t0 && e.dia === d0, `pausado 100 s: t y tDia congelados (t ${f(t0, 2)} s)`);
  avanzarDia(e, c, 1 / 60, false, am, 200, 1); check(e.t > t0, 'al reanudar sigue'); }

console.log('\nduración atada al tema');
{ const corre = (o, durTema) => { const e = crearEstadoDia(), am = amNuevo(); const c = cfg(o); am.pendiente = true; let fin = -1;
    for (let i = 0; i < 400 * 20; i++) { avanzarDia(e, c, 1 / 20, false, am, durTema, 1); if (e.evFin) { fin = i / 20; break; } } return fin; };
  const a = corre({}, 240), b = corre({}, NaN), cc = corre({ SINCRONIZAR_CON_TEMA: false }, 240), d = corre({}, 50);
  console.log(`    tema 240 s → fin a los ${f(a, 1)} s · sin duración → ${f(b, 1)} s · sin sincronizar → ${f(cc, 1)} s · tema de 50 s → ${f(d, 1)} s`);
  check(Math.abs(a - 240) < 0.2, 'el día dura lo que dura el tema (240 s)');
  check(Math.abs(b - 180) < 0.2 && Math.abs(cc - 180) < 0.2, 'sin duración o sin sincronizar: DURACION_FALLBACK_S (180 s)');
  check(Math.abs(d - 90) < 0.2, 'tema más corto que la intro + 30 s: intro 60 + mínimo 30 = 90 s'); }
{ const e = crearEstadoDia(), am = amNuevo(); const c = cfg({ VELOCIDAD: 8 }); am.pendiente = true; let fin = -1;
  for (let i = 0; i < 100 * 60; i++) { avanzarDia(e, c, 1 / 60, false, am, 240, 1); if (e.evFin) { fin = i / 60; break; } }
  check(Math.abs(fin - 30) < 0.1, `VELOCIDAD 8: un día de 240 s en ${f(fin, 1)} s`); }

console.log('\nLOOP y cambio de tema');
{ const e = crearEstadoDia(), am = amNuevo(); const c = cfg(); am.pendiente = true; let fines = 0, reinicios = 0, dawn = 0;
  for (let i = 0; i < 400 * 20; i++) { avanzarDia(e, c, 1 / 20, false, am, 180, 1); if (e.evFin) fines++; if (e.evReinicio) reinicios++; if (e.evDawn) dawn++; }
  check(fines === 2 && reinicios === 2 && e.ciclos === 2 && e.fase !== 'fin', `LOOP: 400 s con días de 180 s → ${fines} fines, ${reinicios} reinicios (dia-fin / dia-reinicio)`);
  check(dawn === 1, 'dawn-complete sigue siendo uno solo (los días siguientes no lo repiten)'); }
{ const e = crearEstadoDia(), am = amNuevo(); const c = cfg({ LOOP: false }); am.pendiente = true; let fines = 0;
  for (let i = 0; i < 400 * 20; i++) { avanzarDia(e, c, 1 / 20, false, am, 180, 1); if (e.evFin) fines++; }
  check(fines === 1 && e.fase === 'fin' && e.dia === 1, 'sin LOOP: termina en noche y se queda'); }
{ const e = crearEstadoDia(), am = amNuevo(); const c = cfg(); am.pendiente = true; let reinicios = 0;
  for (let i = 0; i < 100 * 20; i++) { avanzarDia(e, c, 1 / 20, false, am, 180, 1); if (e.evReinicio) reinicios++; }
  avanzarDia(e, c, 1 / 20, false, am, 200, 2); if (e.evReinicio) reinicios++;
  check(reinicios === 1 && e.t < 0.1 && e.dur === 200, 'el tema cambió (id 2, 200 s): empieza otro día con la nueva duración'); }
{ const e = crearEstadoDia(), am = amNuevo(); const c = cfg(); am.pendiente = true;
  avanzarDia(e, c, 1 / 20, false, am, NaN, 1); avanzarDia(e, c, 1 / 20, false, am, 180, 2);
  check(!e.evReinicio && e.fase === 'intro', 'el primer tema arranca durante la introducción: no la reinicia'); }

console.log('\nmáquina única: reset, skip y checkpoints');
{ const e = crearEstadoDia(), am = amNuevo(); const c = cfg(); am.pendiente = true;
  for (let i = 0; i < 600; i++) avanzarDia(e, c, 1 / 60, false, am, 180, 1);
  am.fase = 'completo'; am.p1 = 1; am.tFin = SKIP_TFIN;   // skipAmanecer()
  avanzarDia(e, c, 1 / 60, false, am, 180, 1);
  check(e.fase === 'dia' && Math.abs(e.dia - C.INTRO_TDIA_FIN) < 0.001 && !e.evDawn && e.revCielo === 1, `skip ("Saltar al final" / amanecer_completo): fin de la introducción, sin emitir (tDia ${f(e.dia, 3)})`);
  am.fase = 'inactivo'; am.pendiente = false; am.tFin = 0;   // resetAmanecer()
  avanzarDia(e, c, 1 / 60, false, am, 180, 1);
  check(e.fase === 'espera' && e.dia === 0 && e.montCrece === 0, 'reset ("Reiniciar amanecer" / checkpoints): vuelve a la noche, todo sin revelar'); }
for (const x of [0.5, 0.8, 0.97]) { const e = crearEstadoDia(), am = amNuevo(); const c = cfg();
  posicionarDia(e, c, x, am, 180, 1); avanzarDia(e, c, 0, false, am, 180, 1);
  check(Math.abs(e.dia - x) < 1e-4 && am.fase === 'completo' && e.revCielo === 1, `checkpoint dia_*: tDia ${x} (etapa ${e.etapa})`); }
{ const e = crearEstadoDia(), am = amNuevo(); avanzarDia(e, cfg({ T_MANUAL: 0.5 }), 1 / 60, false, am, NaN, 1);
  check(e.dia === 0.5 && e.revCielo === 1 && e.montCrece === 1 && e.fase === 'espera', 'T_MANUAL 0,5: mediodía con todo revelado, sin tocar el reloj'); }
{ const e = crearEstadoDia(), am = amNuevo(); am.pendiente = true; avanzarDia(e, cfg(), NaN, false, am, Infinity, 1);
  check([e.dia, e.t, e.solDir[0], e.hor[0]].every(Number.isFinite), 'dt NaN y duración infinita no rompen'); }

console.log('\nZ50: sol sobre el eje del centro del portal');
{ const { PORTAL_GEOM } = await import('../lib/cicloDia.ts');
  const { escalaPortal, centroPortal, PORTAL_C_SHADER } = await import('../lib/portalEscala.ts');
  const frag = fs.readFileSync(new URL('../app/alight/dome/dome.frag.glsl', import.meta.url), 'utf8');
  const pc = /PORTAL_C\s*=\s*vec2\(([-\d.]+),\s*([-\d.]+)\)/.exec(frag).slice(1).map(Number);
  check(pc[0] === PORTAL_C_SHADER[0] && pc[1] === PORTAL_C_SHADER[1], `PORTAL_C de JS = PORTAL_C del shader (${pc})`);
  const num = k => Number(new RegExp(`${k}:\\s*([^,]+),`).exec(fuente)[1].replace('Math.PI', String(Math.PI)));
  const POR = Function(`return (${/export const DBG_PORTAL = (\{[\s\S]*?\n\});/.exec(fuente)[1]});`)();
  const esc = escalaPortal(num('domePortalElevation'), num('domePortalHalfFovDeg'), POR.ESCALA, { elev: 0, tan: 1 });
  const cen = centroPortal(num('domePortalAzimuth'), esc.elev, esc.tan, { az: 0, elev: 0 });
  PORTAL_GEOM.azRad = cen.az; PORTAL_GEOM.elevRad = cen.elev;
  const wrap = x => ((x + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  const c = cfg({ SOL_RECORRIDO: 'arco' }), e = crearEstadoDia(); let maxIntro = 0, maxEje = 0, hastaElev = 0;   // Z51: el modo de Z50
  for (let x = 0; x <= 0.30 + 1e-9; x += 1e-4) { estadoCielo(x, c, e); maxIntro = Math.max(maxIntro, Math.abs(wrap(e.solAz - cen.az))); }
  for (let x = 0.2; x < 0.5; x += 1e-4) { estadoCielo(x, c, e); if (deg(e.solAlt) <= c.SOL_EJE_HASTA_ELEV_DEG) { maxEje = Math.max(maxEje, Math.abs(wrap(e.solAz - cen.az))); hastaElev = deg(e.solAlt); } }
  console.log(`    centro del círculo: az ${f(deg(cen.az) < 0 ? deg(cen.az) + 360 : deg(cen.az), 2)}° el ${f(deg(cen.elev), 2)}° (ESCALA ${POR.ESCALA})`);
  check(maxIntro < 1e-9, `Δaz = 0 de tDia 0 a 0,30 (toda la introducción y el alba; máx. ${maxIntro.toExponential(1)} rad)`);
  check(maxEje < 1e-9 && hastaElev > c.SOL_EJE_HASTA_ELEV_DEG - 0.5, `Δaz = 0 mientras sube hasta ${c.SOL_EJE_HASTA_ELEV_DEG}° (máx. ${maxEje.toExponential(1)} rad)`);
  const a = crearEstadoDia(), b = crearEstadoDia(); let maxS = 0;
  for (let x = 0; x < 1; x += 1e-4) { estadoCielo(x, c, a); estadoCielo(x + 1e-4, c, b); for (let i = 0; i < 3; i++) maxS = Math.max(maxS, Math.abs(a.solDir[i] - b.solDir[i])); }
  estadoCielo(0, c, a); estadoCielo(1, c, b);
  check(maxS < 0.003 && [0, 1, 2].every(i => Math.abs(a.solDir[i] - b.solDir[i]) < 1e-9), `después se abre sin saltos (paso ≤ ${f(maxS, 4)} por 1e-4 de tDia; el máximo es el giro de noche, bajo el horizonte) y el ciclo cierra`);
  estadoCielo(c.KEYS.ATARDECER, c, e); check(Math.abs(wrap(e.solAz - cen.az - Math.PI)) < 1e-9 && Math.abs(e.solAlt) < 1e-9, 'se pone en el azimut opuesto al portal');

  console.log('\nZ51: SOL_RECORRIDO');
  const eje = cfg({ SOL_RECORRIDO: 'eje' }); let maxD = 0, maxPaso = 0, maxAlt = -9, minAlt = 9; const a1 = crearEstadoDia(), b1 = crearEstadoDia();
  for (let x = 0; x <= 1 + 1e-12; x += 1e-4) { estadoCielo(x, eje, a1); estadoCielo(Math.min(1, x + 1e-4), eje, b1);
    maxD = Math.max(maxD, Math.abs(wrap(Math.atan2(a1.solDir[0], -a1.solDir[2]) - cen.az)), Math.abs(wrap(a1.solAz - cen.az)));
    for (let i = 0; i < 3; i++) maxPaso = Math.max(maxPaso, Math.abs(a1.solDir[i] - b1.solDir[i])); maxAlt = Math.max(maxAlt, a1.solAlt); minAlt = Math.min(minAlt, a1.solAlt); }
  check(maxD < 1e-9, `"eje": Δaz = 0 en TODO el ciclo, tDia 0…1 (máx. ${maxD.toExponential(1)} rad; también la dirección que llega al shader)`);
  check(maxPaso < 0.003 && Math.abs(deg(maxAlt) - eje.SOL_ALT_MAX_DEG) < 1e-3 && deg(minAlt) < -40, `"eje": altura continua (paso ≤ ${f(maxPaso, 4)}), máximo ${f(deg(maxAlt), 1)}° al mediodía, ${f(deg(minAlt), 1)}° a medianoche`);
  for (const [x, nombre] of [[eje.KEYS.SALIDA, 'sale'], [eje.KEYS.ATARDECER, 'se pone']]) { estadoCielo(x, eje, a1); check(Math.abs(a1.solAlt) < 1e-9 && Math.abs(wrap(a1.solAz - cen.az)) < 1e-12, `"eje": ${nombre} en el horizonte detrás de la composición (az del portal)`); }
  estadoCielo(0, eje, a1); estadoCielo(1, eje, b1); check([0, 1, 2].every(i => Math.abs(a1.solDir[i] - b1.solDir[i]) < 1e-12), '"eje": el ciclo cierra sin saltos');
  const mer = cfg({ SOL_RECORRIDO: 'meridiano' }); let maxPM = 0;
  for (let x = 0; x < 1; x += 1e-4) { estadoCielo(x, mer, a1); estadoCielo(x + 1e-4, mer, b1); for (let i = 0; i < 3; i++) maxPM = Math.max(maxPM, Math.abs(a1.solDir[i] - b1.solDir[i])); }
  estadoCielo(0.5, mer, a1); const cen90 = Math.abs(deg(a1.solAlt) - 90) < 1e-6;
  estadoCielo(mer.KEYS.SALIDA, mer, a1); const sale = Math.abs(wrap(a1.solAz - cen.az)) < 1e-12 && Math.abs(a1.solAlt) < 1e-9;
  estadoCielo(mer.KEYS.ATARDECER, mer, a1); const pone = Math.abs(wrap(Math.atan2(a1.solDir[0], -a1.solDir[2]) - cen.az - Math.PI)) < 1e-6;
  check(cen90 && sale && pone && maxPM < 0.006, `"meridiano": sale por el portal, cénit al mediodía, se pone en el lado opuesto, continuo (paso ≤ ${f(maxPM, 4)})`);

  console.log('\nZ55: sol sobre la RECTA vertical de la composición (SOL_EJE_IMAGEN)');
  { // geometría como la escribe DomeSky
    const { SUN_C_SHADER } = await import('../lib/portalEscala.ts');
    const sc = /SUN_C\s*=\s*vec2\(([-\d.]+),\s*([-\d.]+)\)/.exec(frag).slice(1).map(Number);
    check(sc[0] === SUN_C_SHADER[0] && sc[1] === SUN_C_SHADER[1], `SUN_C de JS = SUN_C del shader (${sc}); PORTAL_C.x − SUN_C.x = ${f(PORTAL_C_SHADER[0] - SUN_C_SHADER[0], 4)}`);
    const EX = SUN_C_SHADER[0];   // SOL_EJE_CENTRO "composicion" (default)
    const az = num('domePortalAzimuth'), ce = Math.cos(esc.elev), se = Math.sin(esc.elev);
    const F = [Math.sin(az) * ce, se, -Math.cos(az) * ce], R = [Math.cos(az), 0, Math.sin(az)];
    const U = [R[1] * F[2] - R[2] * F[1], R[2] * F[0] - R[0] * F[2], R[0] * F[1] - R[1] * F[0]];
    const k = EX * esc.tan, Pq = [0, 1, 2].map(i => F[i] + R[i] * k), L = Math.hypot(...Pq);
    const dot = (x, y) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
    const pImg = d => { const t = dot(d, F); const q = [0, 1, 2].map(i => d[i] / t - F[i]); return [dot(q, R) / esc.tan, dot(q, U) / esc.tan]; };
    const ejeOn = cfg({ SOL_RECORRIDO: 'eje', SOL_EJE_IMAGEN: true }), ejeOff = cfg({ SOL_RECORRIDO: 'eje', SOL_EJE_IMAGEN: false });
    const sOn = crearEstadoDia(), sOff = crearEstadoDia();
    // antes (Z51, sin la geometría del eje): azimut constante del centro del círculo
    console.log('    tDia · altura · p.x antes (Z51) → ahora (eje SUN_C.x = ' + EX + ', pico y discos) · Δaz del sol de antes respecto del eje');
    let maxPx = 0, maxAlt = 0;
    for (const x of [0.2, 0.22, 0.25, 0.3, 0.4, 0.5, 0.65, 0.8]) {
      PORTAL_GEOM.ejeP[0] = NaN; estadoCielo(x, ejeOff, sOff);
      PORTAL_GEOM.ejeP[0] = Pq[0] / L; PORTAL_GEOM.ejeP[1] = Pq[1] / L; PORTAL_GEOM.ejeP[2] = Pq[2] / L;
      PORTAL_GEOM.ejeU[0] = U[0]; PORTAL_GEOM.ejeU[1] = U[1]; PORTAL_GEOM.ejeU[2] = U[2];
      estadoCielo(x, ejeOn, sOn);
      const pa = pImg(sOff.solDir), pn = pImg(sOn.solDir);
      const dAz = deg(wrap(sOff.solAz - sOn.solAz));
      console.log(`    ${f(x, 2)} · ${f(deg(sOn.solAlt), 1)}° · ${f(pa[0], 4)} → ${f(pn[0], 4)} · ${f(dAz, 3)}° `);
      maxPx = Math.max(maxPx, Math.abs(pn[0] - EX)); maxAlt = Math.max(maxAlt, Math.abs(sOn.solAlt - sOff.solAlt));
    }
    { // Z57: diferencia en grados de azimut entre el sol y la recta del eje a la MISMA altura (criterio < 0,05°)
      const { solSobreEje } = await import('../lib/cicloDia.ts'); const ax = [0, 0, 0]; let maxDeg = 0;
      console.log('    Z57 · tDia · altura · Δaz sol − eje (°)');
      for (const x of [0.2, 0.22, 0.25, 0.3, 0.4, 0.5, 0.65, 0.8]) {
        estadoCielo(x, ejeOn, sOn); solSobreEje(PORTAL_GEOM.ejeP, PORTAL_GEOM.ejeU, sOn.solAlt, ax);
        const dd = deg(wrap(sOn.solAz - Math.atan2(ax[0], -ax[2]))); maxDeg = Math.max(maxDeg, Math.abs(dd));
        console.log(`    Z57 · ${f(x, 2)} · ${f(deg(sOn.solAlt), 1)}° · ${dd.toExponential(1)}`);
      }
      check(maxDeg < 0.05, `Z57: |Δaz| sol − eje < 0,05° en todos esos tDia (máx. ${maxDeg.toExponential(1)}°)`);
    }
    check(maxPx < 1e-9, `el sol queda sobre la recta p.x = SUN_C.x en todos esos tDia (máx. ${maxPx.toExponential(1)})`);
    check(maxAlt < 1e-9, `misma altura que antes (solo cambia el azimut; máx. ${maxAlt.toExponential(1)} rad)`);
    let maxPaso = 0, maxRecta = 0;
    for (let x = 0; x < 1; x += 1e-4) { estadoCielo(x, ejeOn, sOn); estadoCielo(x + 1e-4, ejeOn, sOff);
      for (let i = 0; i < 3; i++) maxPaso = Math.max(maxPaso, Math.abs(sOn.solDir[i] - sOff.solDir[i]));
      if (sOn.solDir[1] > -0.2 && dot(sOn.solDir, F) > 0.1) maxRecta = Math.max(maxRecta, Math.abs(pImg(sOn.solDir)[0] - EX)); }
    estadoCielo(0, ejeOn, sOn); estadoCielo(1, ejeOn, sOff);
    check(maxPaso < 0.003 && [0, 1, 2].every(i => Math.abs(sOn.solDir[i] - sOff.solDir[i]) < 1e-12) && maxRecta < 1e-9, `todo el ciclo sobre la recta (máx. ${maxRecta.toExponential(1)}), continuo (paso ≤ ${f(maxPaso, 4)}) y cierra`);
    estadoCielo(0.4, cfg({ SOL_RECORRIDO: 'eje', SOL_EJE_IMAGEN: true, SOL_AZ_OFFSET_DEG: 5 }), sOff); estadoCielo(0.4, ejeOn, sOn);
    check(Math.abs(deg(wrap(sOff.solAz - sOn.solAz)) - 5) < 1e-9 && Math.abs(sOff.solAlt - sOn.solAlt) < 1e-12, 'SOL_AZ_OFFSET_DEG 5 gira el sol 5° (misma altura)');
    estadoCielo(0.4, ejeOff, sOff); check(Math.abs(wrap(sOff.solAz - cen.az)) < 1e-12, 'SOL_EJE_IMAGEN false: azimut constante del centro del círculo (Z51)');
    PORTAL_GEOM.ejeP[0] = NaN; PORTAL_GEOM.ejeP[1] = 0; PORTAL_GEOM.ejeP[2] = 0; PORTAL_GEOM.ejeU[0] = 0; PORTAL_GEOM.ejeU[1] = 1; PORTAL_GEOM.ejeU[2] = 0;
  }
  PORTAL_GEOM.azRad = NaN; PORTAL_GEOM.elevRad = NaN; }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
