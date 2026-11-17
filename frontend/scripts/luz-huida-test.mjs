// Z76: prueba de la huida de la luz del camino LUZ (lib/luzHuida.ts) con una réplica del bucle de LuzLejana
// (activación a ACTIVACION_M, apertura de la terminal = visita) y del usuario caminando. Uso: node scripts/luz-huida-test.mjs
import fs from 'node:fs';
import {
  crearEstadoHuida, semillaDe, diametroHaz, tamCelda, movimientosRestantes, bloqueaActivacion, registrarVisita, consumirVisita,
  reiniciarHuida, offsetCelda, desplazamientoEn, posicionValidaSala, elegirCelda, tickHuida, moverAhora, volverAlOrigen,
  serializarHuida, restaurarHuida,
} from '../lib/luzHuida.ts';

const src = fs.readFileSync(new URL('../lib/debugConfig.ts', import.meta.url), 'utf8');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string \| number/g, '').replace(/ as string/g, '')});`)();
const M = obj('DBG_LUZ_MOV'), L = obj('DBG_LUZ');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const f = (n, d = 2) => n.toFixed(d);

// origen real de la luz: spawn (Z25) − EJE_TELON × LUZ_DISTANCIA_M (lib/inicioEscena.ts, lib/caminoLuz.ts)
const EL = Math.hypot(10, 7), EJE = [10 / EL, 7 / EL];
const spawn = [-10 + EJE[0] * 3 - EJE[0] * (3 + 5), -7 + EJE[1] * 3 - EJE[1] * (3 + 5)];
const BASE = [spawn[0] - EJE[0] * L.LUZ_DISTANCIA_M, spawn[1] - EJE[1] * L.LUZ_DISTANCIA_M];
const TAM = tamCelda(M.TAM_CELDA_M, diametroHaz(L.CONO_RADIO_M, L.LUZ_HALO_M));
const SALA = L.SALA_MEDIA_M - L.SALA_MARGEN_M, BORDE0 = Math.max(Math.abs(BASE[0]), Math.abs(BASE[1]));
console.log(`\nspawn (${f(spawn[0])}, ${f(spawn[1])}) · origen de la luz (${f(BASE[0])}, ${f(BASE[1])}) · celda ${f(TAM)} m (diámetro del haz) · DIST_HUIDA ${M.DIST_HUIDA_M} m · ACTIVACION ${L.ACTIVACION_M} m`);

console.log('\ndiámetro y celda');
check(Math.abs(TAM - 7.2) < 1e-9, `diámetro total del haz = charco (radio 1,5 × CONO_RADIO_M ${L.CONO_RADIO_M}) = ${f(TAM)} m (cono ${2 * L.CONO_RADIO_M}, halo ${L.LUZ_HALO_M})`);
check(tamCelda(5, 7.2) === 5 && tamCelda('auto', 7.2) === 7.2 && tamCelda(-1, 7.2) === 7.2, 'TAM_CELDA_M: "auto" = diámetro, número = ese número');
check(M.DIST_HUIDA_M > L.ACTIVACION_SALIDA_M && M.DIST_HUIDA_M < TAM, `DIST_HUIDA_M (${M.DIST_HUIDA_M}) entre la salida de la activación (${L.ACTIVACION_SALIDA_M}) y una celda: tras huir el usuario queda lejos`);

// ── simulación: usuario que camina hacia la luz y se va, con la réplica de LuzLejana ──
const sim = (cfg = M, s = crearEstadoHuida(semillaDe(12345, 0)), visitas = 5, opts = {}) => {
  const valida = (c, fi) => { if (!c && !fi) return true; const o = offsetCelda(s, c, fi, TAM, { x: 0, z: 0 }); return posicionValidaSala(BASE[0] + o.x, BASE[1] + o.z, BORDE0, SALA, L.EXTERIOR_RADIO_M, cfg.CORREDOR_M); };
  const ctx = { vx: 0, vz: 0, dLuz: 0, tam: TAM, libre: true, valida };
  const off = { x: 0, z: 0 };
  const log = []; let maxCheb = 0, abiertas = 0, huidasVisita = [], h = 0, eventos = [];
  const u = [spawn[0], spawn[1]]; const dt = 1 / 60, vel = opts.vel ?? 2.0;
  let fase = 'libre', objetivoLejos = false, t = 0;
  for (let paso = 0; paso < 60 * 60 * 20 && abiertas < visitas; paso++, t += dt) {
    desplazamientoEn(s, TAM, 0, off);
    const lx = BASE[0] + off.x, lz = BASE[1] + off.z, d = Math.hypot(u[0] - lx, u[1] - lz);
    ctx.vx = u[0] - BASE[0]; ctx.vz = u[1] - BASE[1]; ctx.dLuz = d; ctx.libre = fase === 'libre';
    const r = tickHuida(s, cfg, dt, ctx);
    if (r === 1) { h++; eventos.push({ col: s.col, fila: s.fila, t }); }
    maxCheb = Math.max(maxCheb, Math.abs(s.col), Math.abs(s.fila));
    // activación (LuzLejana): d ≤ ACTIVACION_M y la huida no bloquea → terminal → visita
    if (fase === 'libre' && d <= L.ACTIVACION_M && !bloqueaActivacion(s)) { abiertas++; huidasVisita.push(h); h = 0; registrarVisita(s, cfg); fase = 'rearmar'; objetivoLejos = true; log.push({ visita: abiertas, celda: [s.col, s.fila] }); }
    if (fase === 'rearmar' && d > L.ACTIVACION_SALIDA_M) fase = 'libre';
    // caminar: hacia la luz, o (tras una visita) alejarse 20 m hacia el spawn y volver
    let tx = lx, tz = lz;
    if (objetivoLejos) { tx = spawn[0]; tz = spawn[1]; if (Math.hypot(u[0] - lx, u[1] - lz) > 20) objetivoLejos = false; }
    const vx = tx - u[0], vz = tz - u[1], l = Math.hypot(vx, vz);
    if (l > 0.05 && !(fase !== 'libre' && !objetivoLejos)) { u[0] += vx / l * vel * dt; u[1] += vz / l * vel * dt; }
  }
  return { s, log, maxCheb, abiertas, huidasVisita, eventos };
};

console.log('\nvisitas y huidas (usuario a 2 m/s: va, abre la terminal, se aleja 20 m y vuelve)');
const A = sim();
console.log(`    huidas antes de cada apertura: ${A.huidasVisita.join(', ')} · celdas: ${A.eventos.map(e => `(${e.col},${e.fila})`).join(' ')}`);
check(A.abiertas === 5, 'el usuario siempre termina abriendo la terminal (5 visitas)');
check(A.huidasVisita.join() === '0,1,2,3,4', 'visita k → la luz se mueve k − 1 veces (0, 1, 2, 3, 4)');
check(A.s.visitas === 5 && A.s.movsTotal === 10, `contador de visitas ${A.s.visitas}, movimientos totales ${A.s.movsTotal}`);
const e = A.eventos;
check(e[0].col === -1 && e[0].fila === 0, '1.º movimiento: izquierda (col −1)');
check(e[1].col === -1 && e[1].fila === 1, '2.º: un espacio hacia atrás (fila +1, alejándose del usuario)');
check(e[2].col === 0 && e[2].fila === 1, '3.º: derecha (col +1)');
check(A.maxCheb <= M.RADIO_CELDAS, `nunca más de ${M.RADIO_CELDAS} celdas del origen (máx. ${A.maxCheb})`);
{ // izquierda y atrás respecto del usuario en la primera aproximación (que viene del spawn)
  const s = A.s, R = [-s.fz, s.fx], ap = [BASE[0] - spawn[0], BASE[1] - spawn[1]], la = Math.hypot(...ap);
  check(Math.abs(s.fx - ap[0] / la) < 0.05 && Math.abs(s.fz - ap[1] / la) < 0.05, `ejes: delante = usuario → luz en la primera aproximación (${f(s.fx, 3)}, ${f(s.fz, 3)})`);
  const cruz = s.fx * R[1] - s.fz * R[0];   // en three (+Y arriba, vista desde arriba con +Z hacia abajo) derecha = giro horario
  check(cruz > 0 && Math.abs(R[0] - Math.cos(Math.atan2(-s.fx, -s.fz))) < 1e-9, 'derecha = la derecha de la cámara que mira hacia la luz (cos yaw, −sin yaw)');
}
{ // azar: vecinas, sin quedarse, sin volver a la anterior si hay otra
  const s = crearEstadoHuida(7); s.ejes = true; s.fx = 0; s.fz = 1; s.movsTotal = 3; s.col = 3; s.fila = 3; s.colPrev = 2; s.filaPrev = 3; s.hayPrev = true;
  const o = { col: 0, fila: 0 }, vistas = new Set(); let malas = 0;
  for (let i = 0; i < 400; i++) { s.rng = i * 7919; elegirCelda(s, { RADIO_CELDAS: 3, DIAGONALES: true }, 99, 99, () => true, o); vistas.add(`${o.col},${o.fila}`); if (Math.max(Math.abs(o.col), Math.abs(o.fila)) > 3 || (o.col === 3 && o.fila === 3) || (o.col === 2 && o.fila === 3) || Math.max(Math.abs(o.col - 3), Math.abs(o.fila - 3)) !== 1) malas++; }
  check(malas === 0 && vistas.size === 2, `en la esquina (3, 3): solo vecinas dentro del radio, sin quedarse y sin volver a (2, 3) → ${[...vistas].join(' · ')}`);
  s.col = 0; s.fila = 0; s.hayPrev = false; vistas.clear();
  for (let i = 0; i < 400; i++) { elegirCelda(s, { RADIO_CELDAS: 3, DIAGONALES: false }, 1, 0, () => true, o); vistas.add(`${o.col},${o.fila}`); }
  check(vistas.size === 3 && !vistas.has('1,0'), `sin DIAGONALES y con el usuario en (1, 0): solo ortogonales, nunca la celda del usuario → ${[...vistas].join(' · ')}`);
  s.hayPrev = true; s.colPrev = 0; s.filaPrev = 1; vistas.clear();
  for (let i = 0; i < 200; i++) { elegirCelda(s, { RADIO_CELDAS: 3, DIAGONALES: false }, 9, 9, (c, fi) => c === 0 && fi === 1, o); vistas.add(`${o.col},${o.fila}`); }
  check(vistas.size === 1 && vistas.has('0,1'), 'si la única opción es la anterior, vuelve a ella');
  check(!elegirCelda(s, { RADIO_CELDAS: 0, DIAGONALES: true }, 9, 9, () => true, o), 'RADIO_CELDAS 0: ninguna celda posible');
}
{ // radio 0: la huida se consume y el usuario igual llega
  const B = sim({ ...M, RADIO_CELDAS: 0 }, undefined, 3);
  check(B.abiertas === 3 && B.maxCheb === 0, 'sin celdas posibles la huida se consume: la luz se queda y se puede llegar');
}

console.log('\nacumulación, reinicio por visita y límites de la sala');
{ const s = A.s, o = { x: 0, z: 0 }; offsetCelda(s, s.col, s.fila, TAM, o);
  check(posicionValidaSala(BASE[0] + o.x, BASE[1] + o.z, BORDE0, SALA, L.EXTERIOR_RADIO_M, M.CORREDOR_M), `acumulativa: tras 5 visitas en (${s.col}, ${s.fila}) = (${f(BASE[0] + o.x)}, ${f(BASE[1] + o.z)}), todavía conectada a la sala`); }
{ const C = sim({ ...M, RESET_POR_VISITA: true }, undefined, 4);
  check(C.huidasVisita.join() === '0,1,2,3', 'RESET_POR_VISITA: mismas huidas por visita');
  check(C.log[1].celda.join() === '-1,0' && C.log[2].celda.join() !== '-2,1' && C.maxCheb <= 2, `RESET_POR_VISITA: cada visita arranca del origen (celdas al abrir: ${C.log.map(v => `(${v.celda})`).join(' ')})`); }
{ let malas = 0, n = 0;
  for (let c = -3; c <= 3; c++) for (let fi = -3; fi <= 3; fi++) {
    const s = A.s, o = offsetCelda(s, c, fi, TAM, { x: 0, z: 0 }), x = BASE[0] + o.x, z = BASE[1] + o.z;
    if (!posicionValidaSala(x, z, BORDE0, SALA, L.EXTERIOR_RADIO_M, M.CORREDOR_M)) { n++; continue; }
    const borde = Math.max(Math.abs(x), Math.abs(z)), dSala = Math.hypot(Math.max(Math.abs(x) - SALA, 0), Math.max(Math.abs(z) - SALA, 0));
    if (borde < BORDE0 - 1e-6 || dSala > L.EXTERIOR_RADIO_M - M.CORREDOR_M) malas++;
  }
  check(malas === 0, `celdas válidas: la luz no se acerca a la sala más que su origen (fuera del área) y su disco caminable (${L.EXTERIOR_RADIO_M} m) sigue tocando la sala (${n} de 49 celdas descartadas)`); }

console.log('\nsemilla y persistencia en la sesión');
{ const a = sim(M, crearEstadoHuida(semillaDe(99, 0)), 6), b = sim(M, crearEstadoHuida(semillaDe(99, 0)), 6), c = sim(M, crearEstadoHuida(semillaDe(4242, 0)), 6);
  const k = r => r.eventos.map(e => `${e.col},${e.fila}`).join(' ');
  check(k(a) === k(b), 'misma semilla → mismos movimientos');
  check(k(a).split(' ').slice(0, 3).join() === k(c).split(' ').slice(0, 3).join() && k(a) !== k(c), 'otra semilla → misma secuencia inicial (izq., atrás, der.) y otro azar');
  check(semillaDe('auto', 0.25) === Math.floor(0.25 * 2147483647) && semillaDe(17, 0.9) === 17, 'SEMILLA "auto" = aleatoria por sesión; número = ese número'); }
{ const s = sim(M, undefined, 3).s, txt = serializarHuida(s), r = crearEstadoHuida(1);
  check(restaurarHuida(r, txt) && r.visitas === 3 && r.col === s.col && r.fila === s.fila && r.rng === s.rng && r.ejes && r.pc === s.col && r.fase === 'quieta' && r.armada,
    `sessionStorage: se guarda y se restaura (visitas ${r.visitas}, celda (${r.col}, ${r.fila}), ejes y azar; quieta y armada)`);
  // almacenamiento falso con la misma API (getItem/setItem) que sessionStorage
  const mem = new Map(), st = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
  st.setItem('alight:luz-visitas', txt);
  const r2 = crearEstadoHuida(1); restaurarHuida(r2, st.getItem('alight:luz-visitas'));
  check(r2.visitas === 3, 'tras "recargar" (otro estado, mismo almacenamiento) sigue en la visita 4');
  check(!restaurarHuida(crearEstadoHuida(1), null) && !restaurarHuida(crearEstadoHuida(1), '{roto') && !restaurarHuida(crearEstadoHuida(1), '{"x":1}'), 'sin datos o con datos rotos: no restaura (PERSISTENCIA "memoria" = no se lee ni se escribe)'); }
{ const s = crearEstadoHuida(1);
  check(movimientosRestantes(s) === 0 && !bloqueaActivacion(s), '1.ª visita: sin huidas ni bloqueo (nada cambia)');
  registrarVisita(s, M); check(s.visitas === 1 && movimientosRestantes(s) === 1 && !s.armada && !bloqueaActivacion(s), 'tras abrir la terminal: 1 huida pendiente, sin armar (no huye mientras el usuario se va)');
  s.armada = true; check(bloqueaActivacion(s), 'armada con huida pendiente: la terminal no se abre');
  consumirVisita(s); check(movimientosRestantes(s) === 0 && !bloqueaActivacion(s), 'checkpoint luz_dialogo: consume la huida pendiente → se abre');
  reiniciarHuida(s, 5); check(s.visitas === 0 && s.col === 0 && !s.ejes && s.rng === 5, '"Reiniciar visitas": todo a cero'); }

console.log('\ntiempos, pausa y botones');
{ const s = crearEstadoHuida(3); registrarVisita(s, M); s.armada = true;
  const ctx = { vx: 0, vz: 30, dLuz: 3, tam: TAM, libre: true, valida: () => true };
  const t0 = tickHuida(s, M, 1 / 60, ctx); let t = 0, tFin = -1, tLibre = -1;
  while (t < 3) { t += 1 / 60; const r = tickHuida(s, M, 1 / 60, ctx); if (r === 2) tFin = t; if (s.fase === 'quieta' && tLibre < 0 && tFin > 0) tLibre = t; }
  check(t0 === 1 && s.fase === 'quieta', `huye al acercarse a ${ctx.dLuz} m`);
  check(Math.abs(tFin - (M.ANTICIPO_S + M.MOVER_S)) < 0.05 && Math.abs(tLibre - tFin - M.ESPERA_S) < 0.05, `anticipo ${M.ANTICIPO_S} s + deslizamiento ${M.MOVER_S} s (llega a los ${f(tFin)} s) + espera ${M.ESPERA_S} s`);
  const s2 = crearEstadoHuida(3); registrarVisita(s2, M); s2.armada = true; tickHuida(s2, { ...M, ANTICIPO_S: 0 }, 1 / 60, ctx);
  check(s2.fase === 'mueve', 'ANTICIPO_S 0: se mueve sin temblor');
  const s3 = crearEstadoHuida(3); registrarVisita(s3, M); s3.armada = true;
  check(tickHuida(s3, M, 1 / 60, { ...ctx, libre: false }) === 0 && tickHuida(s3, { ...M, ACTIVO: false }, 1 / 60, ctx) === 0 && tickHuida(s3, M, 1 / 60, { ...ctx, dLuz: M.DIST_HUIDA_M + 0.1 }) === 0,
    'no huye en diálogo/checkpoint, con ACTIVO false ni más lejos que DIST_HUIDA_M');
  const s4 = crearEstadoHuida(3); registrarVisita(s4, M); tickHuida(s4, M, 1 / 60, { ...ctx, dLuz: M.REARME_M - 1 });
  check(!s4.armada && tickHuida(s4, M, 1 / 60, ctx) === 0, `sin alejarse más de REARME_M (${M.REARME_M} m) no se rearma`);
  tickHuida(s4, M, 1 / 60, { ...ctx, dLuz: M.REARME_M + 1 }); check(s4.armada, 'alejándose más de REARME_M se rearma');
  const s5 = crearEstadoHuida(3); s5.ejes = true; s5.fase = 'mueve'; s5.c1 = 1;
  for (let i = 0; i < 100; i++) tickHuida(s5, M, 0, ctx);
  check(s5.pc === 0 && s5.fase === 'mueve', 'con dt 0 (pestaña oculta / sin frames) no avanza');
  const s6 = crearEstadoHuida(3);
  check(moverAhora(s6, M, ctx) && s6.col === -1 && s6.movsVisita === 0 && s6.movsTotal === 1, '"Mover luz ahora": huye sin consumir la visita (avanza la secuencia)');
  s6.fase = 'quieta'; s6.pc = s6.col; volverAlOrigen(s6, M); check(s6.c1 === 0 && s6.f1 === 0 && s6.movsTotal === 1, '"Volver al origen": se desliza a (0, 0) sin contar');
}

console.log('\nun solo origen (código): todo lo ligado a la luz lee LUZ_STATE.x/z = origen + LUZ_DESPLAZ');
{ const rd = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
  const cl = rd('../lib/caminoLuz.ts'), ll = rd('../components/LuzLejana.tsx'), ck = rd('../lib/checkpointsAcciones.ts');
  check(/LUZ_STATE\.x = LUZ_STATE\.xBase \+ LUZ_DESPLAZ\.x/.test(cl) && /LUZ_STATE\.z = LUZ_STATE\.zBase \+ LUZ_DESPLAZ\.z/.test(cl), 'actualizarPosLuz: posición = origen + desplazamiento (con 0, idéntica a antes)');
  check(/const dx = x - LUZ_STATE\.x, dz = z - LUZ_STATE\.z, r = DBG_LUZ\.EXTERIOR_RADIO_M/.test(cl), 'disco caminable exterior: centrado en la luz desplazada');
  const usos = ['sp.position.set(LUZ_STATE.x', 'cono.position.set(LUZ_STATE.x', 'pozo.position.set(LUZ_STATE.x', 'suelo.position.set(LUZ_STATE.x',
    'const dx = camera.position.x - LUZ_STATE.x', 'const ddx = LUZ_STATE.x - camera.position.x', 'const sx = camera.position.x - LUZ_STATE.x'];
  check(usos.every(u => ll.includes(u)), 'LuzLejana: halo, cono, charco, suelo, distancia (activación, curvas), giro de cámara y teletransporte leen LUZ_STATE');
  check(ck.includes('const x = LUZ_STATE.x + EJE_TELON.fx * 1.0') && ck.includes('consumirHuidaVisita()'), 'checkpoint luz_dialogo: va a la luz donde esté y consume la huida pendiente');
  const fuera = ['components', 'lib', 'app'].flatMap(d => fs.readdirSync(new URL(`../${d}/`, import.meta.url), { recursive: true }).filter(n => /\.(ts|tsx)$/.test(n)).map(n => `../${d}/${n}`))
    .filter(p => !/caminoLuz\.ts$|debugConfig\.ts$|debugIndiceControles\.ts$|pestanas\/narrativa\.tsx$/.test(p))
    .filter(p => /LUZ_DISTANCIA_M|LUZ_POS_X|LUZ_POS_Z/.test(rd(p)));
  check(fuera.length === 0, `nadie más calcula la posición de la luz desde DBG_LUZ (${fuera.join(', ') || 'ninguno'})`);
  check(ll.includes('registrarVisitaLuz();') && ll.indexOf('abrirDialogo();') < ll.indexOf('registrarVisitaLuz();') && ll.includes('!huidaBloqueaActivacion()'), 'LuzLejana: la visita se cuenta al abrir la terminal (girando → dialogo) y la huida bloquea la activación');
}

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
