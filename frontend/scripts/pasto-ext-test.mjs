// Z74: prueba de los dos cambios del pasto. Uso (en frontend/): node scripts/pasto-ext-test.mjs
//  1) el pasto crece SIEMPRE bajo la luz: se reproduce el síntoma de Z64 con una réplica exacta del interruptor de
//     lib/haz.ts (entrar a ≤ hazZoneRadiusM invierte la luz, con 800 ms de espera; salir a > 1,1 × el radio) y se
//     comprueba el arreglo con la luz encendida y apagada al empezar, y con varios ciclos seguidos
//  2) extensión: arranque tras los monolitos, duración, pausa, reinicio por checkpoint (reiniciarPasto), modo manual,
//     orden del umbral (de adentro hacia afuera), bloques, selección (tope, cercanía) y costo estimado en tres poses
import { crearEstadoPasto, avanzarPasto, reiniciarPasto, completarCuarto, chequearTodoCompleto, umbralPasto, manchaPasto, rectPasto } from '../lib/pasto.ts';
import { avanzarExtension, extenderAhora, radioExt, dnExt, armarBloquesExt, umbralMinBloqueExt, seleccionarBloques,
  radioRecorteMonolito, RADIO_PISO_M } from '../lib/pastoExt.ts';
import { capasObjetivo } from '../lib/pastoChunks.ts';

let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const f = (n, d = 2) => Number(n).toFixed(d);
const CFG = await import('../lib/debugConfig.ts');
const S = CFG.DBG_SILLAS;
// luces (hazPosXZEn): radio hazRadiusM a ±45° y ±135°
const lx = [], lz = [];
for (const a of [-Math.PI / 4, Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4]) { lx.push(S.hazRadiusM * Math.cos(a)); lz.push(S.hazRadiusM * Math.sin(a)); }

// réplica del interruptor de lib/haz.ts (updateHazState): flanco de entrada invierte bandOn con espera
function crearHaz(on0) { return { dentro: [false, false, false, false], on: [on0, on0, on0, on0], ultimo: [-1e9, -1e9, -1e9, -1e9] }; }
function tickHaz(h, x, z, ahoraMs) {
  for (let i = 0; i < 4; i++) {
    const d = Math.hypot(x - lx[i], z - lz[i]);
    if (!h.dentro[i] && d <= S.hazZoneRadiusM) { h.dentro[i] = true; if (ahoraMs - h.ultimo[i] >= S.hazToggleCooldownMs) { h.ultimo[i] = ahoraMs; h.on[i] = !h.on[i]; } }
    else if (h.dentro[i] && d > S.hazZoneRadiusM * 1.1) h.dentro[i] = false;
  }
}
/** Camina hacia la luz 0 desde 4 m, se queda `quieto` s debajo y se va; devuelve cuánto creció el cuarto 0 en esa visita. */
function visita(estado, h, cfg, reloj, quieto) {
  const dt = 1 / 60, cx = lx[0], cz = lz[0];
  const p0 = estado.p[0];
  let primerCuadroDentro = -1, pEnEseCuadro = 0, k = 0;
  const paso = (x, z) => {
    reloj.t += dt; k++;
    tickHaz(h, x, z, reloj.t * 1000);   // ThreeScene actualiza los haces en el mismo frame
    avanzarPasto(estado, cfg, dt, x, z, lx, lz, h.on);
    if (primerCuadroDentro < 0 && estado.dentro[0]) { primerCuadroDentro = k; pEnEseCuadro = estado.p[0]; }
  };
  for (let s = 0; s <= 1; s += dt / 2) paso(cx + 4 * (1 - s), cz);          // entra caminando (2 m/s)
  for (let s = 0; s < quieto; s += dt) paso(cx, cz);                          // queda debajo
  const pMax = estado.p[0];
  for (let s = 0; s <= 1; s += dt / 2) paso(cx + 4 * s, cz);                  // sale
  for (let s = 0; s < 3; s += dt) paso(cx + 4, cz);                           // espera afuera
  return { creció: pMax - p0, empiezaEnElCuadro: primerCuadroDentro > 0 && pEnEseCuadro > p0, pFinal: estado.p[0] };
}

console.log('\n1) el pasto crece siempre bajo la luz');
{
  const base = { ...CFG.DBG_PASTO, CRECE_S: 14, DECAE_S: 7, SIMULAR: -1 };
  // síntoma (regla de Z64): entrar, salir, entrar
  for (const on0 of [false, true]) {
    const e = crearEstadoPasto(), h = crearHaz(on0), reloj = { t: 0 };
    const v = [visita(e, h, { ...base, REQUIERE_LUZ_ENCENDIDA: true }, reloj, 3), visita(e, h, { ...base, REQUIERE_LUZ_ENCENDIDA: true }, reloj, 3)];
    console.log(`    Z64, luz ${on0 ? 'encendida' : 'apagada'} al empezar: visita 1 crece ${f(v[0].creció, 3)} · visita 2 crece ${f(v[1].creció, 3)}`);
    if (!on0) check(v[0].creció > 0.15 && v[1].creció < 0.02, 'síntoma reproducido: con la luz apagada al llegar crece; a la segunda visita (la luz quedó encendida y entrar la apaga) no crece');
    else check(v[0].creció < 0.02, 'síntoma reproducido: con la luz encendida al llegar, entrar la apaga y no crece');
  }
  // arreglo
  for (const on0 of [false, true]) {
    const e = crearEstadoPasto(), h = crearHaz(on0), reloj = { t: 0 };
    const cfg = { ...base, REQUIERE_LUZ_ENCENDIDA: false };
    const vs = []; for (let i = 0; i < 6; i++) vs.push(visita(e, h, cfg, reloj, 1.5));
    check(vs.every(v => v.creció > 0.08), `Z74, luz ${on0 ? 'encendida' : 'apagada'} al empezar: crece en las 6 visitas seguidas (${vs.map(v => f(v.creció, 2)).join(', ')}); la luz terminó ${h.on[0] ? 'encendida' : 'apagada'}`);
    check(vs.every(v => v.empiezaEnElCuadro), 'empieza a crecer en el mismo cuadro en que se entra al radio de presencia (1,2 m, antes del interruptor a 1,0 m)');
  }
  {
    const e = crearEstadoPasto(), h = crearHaz(false), reloj = { t: 0 };
    const v = visita(e, h, { ...base }, reloj, 2);
    check(v.pFinal < v.creció && v.pFinal >= 0, `salir antes de completar decae (de ${f(v.creció, 3)} a ${f(v.pFinal, 3)} en ~4 s afuera)`);
    // el interruptor sigue igual: cada entrada invierte la luz
    const h2 = crearHaz(false), e2 = crearEstadoPasto(), r2 = { t: 0 }, estados = [];
    for (let i = 0; i < 4; i++) { visita(e2, h2, base, r2, 1); estados.push(h2.on[0]); }
    check(estados.join() === 'true,false,true,false', 'el interruptor de la luz no cambia: cada entrada la enciende o la apaga');
  }
  check(CFG.DBG_PASTO.REQUIERE_LUZ_ENCENDIDA === false, 'REQUIERE_LUZ_ENCENDIDA por defecto false');
}

console.log('\n2) extensión: línea de tiempo');
{
  const D = { ...CFG.DBG_PASTO };
  const e = crearEstadoPasto();
  const dt = 1 / 60; let t = 0, inicio = -1, fin = -1;
  // monolitos: aparecen 3 s después de completar (MONOLITOS_APARICION_S); "listo" = completo y monolitos arriba
  for (let i = 0; i < 4; i++) completarCuarto(e, i);
  chequearTodoCompleto(e);
  let kMono = 0;
  for (let n = 0; n < 60 * 40; n++) {
    t += dt; kMono = Math.min(1, kMono + dt / D.MONOLITOS_APARICION_S);
    const ev = avanzarExtension(e, D, dt, e.todoEmitido && kMono >= 1);
    if (ev === 1) inicio = t; if (ev === 2) fin = t;
  }
  check(Math.abs(inicio - (D.MONOLITOS_APARICION_S + D.EXT_ARRANQUE_S)) < 0.05, `arranca ${f(inicio, 2)} s después de completar = aparición de los monolitos (${D.MONOLITOS_APARICION_S} s) + EXT_ARRANQUE_S (${D.EXT_ARRANQUE_S} s)`);
  check(Math.abs(fin - inicio - D.EXT_DURACION_S) < 0.05 && e.ext === 1 && e.extFase === 'completo', `dura EXT_DURACION_S (${f(fin - inicio, 2)} s) y queda completa`);
  // pausa
  const e2 = crearEstadoPasto(); for (let i = 0; i < 4; i++) completarCuarto(e2, i); chequearTodoCompleto(e2);
  extenderAhora(e2); for (let n = 0; n < 300; n++) avanzarExtension(e2, D, dt, true);
  const antes = e2.ext; for (let n = 0; n < 300; n++) avanzarExtension(e2, D, 0, true);
  check(antes > 0 && e2.ext === antes, 'en pausa (dt del reloj de la experiencia = 0) queda quieta');
  // reinicio por checkpoint
  reiniciarPasto(e2);
  check(e2.ext === 0 && e2.extFase === 'espera' && !e2.todoEmitido, 'reiniciarPasto (checkpoints, "Reiniciar pasto") deja la extensión en 0');
  for (let n = 0; n < 600; n++) avanzarExtension(e2, D, dt, e2.todoEmitido);
  check(e2.ext === 0, 'después del reinicio no vuelve a crecer hasta completar otra vez los cuartos');
  // manual
  const e3 = crearEstadoPasto(); for (let n = 0; n < 600; n++) avanzarExtension(e3, { ...D, EXT_MODO: 'manual' }, dt, true);
  check(e3.ext === 0 && e3.extFase === 'espera', 'modo manual: no arranca solo');
  extenderAhora(e3); for (let n = 0; n < 120; n++) avanzarExtension(e3, { ...D, EXT_MODO: 'manual' }, dt, true);
  check(e3.ext > 0.07 && e3.ext < 0.09, `"Extender pasto ahora": crece desde ya (${f(e3.ext, 3)} en 2 s)`);
  const e4 = crearEstadoPasto(); extenderAhora(e4); avanzarExtension(e4, { ...D, EXT_ACTIVO: false }, dt, true);
  check(e4.ext === 0, 'EXT_ACTIVO off: sin extensión');
}

console.log('\n2) extensión: forma, bloques y selección');
const rect = rectPasto(lx, lz, CFG.DBG_PASTO.MARGEN_M, [0, 0, 0, 0]);
const R = radioExt(CFG.DBG_PASTO.EXT_RADIO_M);
{
  check(R === RADIO_PISO_M && radioExt(20) === 20 && radioExt('auto') === 28, `radio "auto" = disco del piso (${R} m)`);
  check(dnExt(0, 0, rect, R) === -1 && dnExt(30, 0, rect, R) === -1, 'dentro del rectángulo o fuera del círculo: no es de la extensión');
  let mono = true, bordes = true;
  for (const a of [0, 0.3, Math.PI / 4, 1.2, Math.PI / 2, 2.5, Math.PI]) {
    let prev = -1;
    for (let r = 0; r <= R; r += 0.25) {
      const x = r * Math.cos(a), z = r * Math.sin(a), dn = dnExt(x, z, rect, R);
      if (dn < 0) continue;
      if (dn < prev - 1e-9) mono = false; prev = dn;
    }
    const x0 = Math.cos(a), z0 = Math.sin(a);
    if (dnExt(x0 * (R - 1e-6), z0 * (R - 1e-6), rect, R) < 0.999) bordes = false;
  }
  check(mono && bordes, 'dn crece del borde del rectángulo (0) al del círculo (1) en todas las direcciones');
  // orden del umbral con irregularidad 0: los puntos más cercanos al rectángulo aparecen antes
  const u = (x, z, irr) => umbralPasto(dnExt(x, z, rect, R), manchaPasto(x, z, 1.2), { IRREGULARIDAD: irr, FRENTE_ANCHO: 0.25 });
  check(u(14, 0, 0) < u(20, 0, 0) && u(20, 0, 0) < u(27, 0, 0), 'irregularidad 0: el frente avanza de adentro hacia afuera');
  let prom = [0, 0], n = [0, 0];
  for (let i = 0; i < 4000; i++) { const a = i * 2.399, r = 13 + (i % 15); const x = r * Math.cos(a), z = r * Math.sin(a); const d = dnExt(x, z, rect, R); if (d < 0) continue; const k = d < 0.5 ? 0 : 1; prom[k] += u(x, z, 0.6); n[k]++; }
  check(prom[0] / n[0] < prom[1] / n[1], `irregularidad 0,6: en promedio sigue de adentro hacia afuera (umbral medio ${f(prom[0] / n[0])} < ${f(prom[1] / n[1])}) con manchones al azar`);
}
const bloques = armarBloquesExt(rect, R, CFG.DBG_RENDIMIENTO.CHUNK_M);
{
  for (const b of bloques) b.uMin = umbralMinBloqueExt(b, rect, R, (x, z, dn) => umbralPasto(dn, manchaPasto(x, z, 1.2), { IRREGULARIDAD: 0.6, FRENTE_ANCHO: 0.25 }));
  const area = Math.PI * R * R - (rect[2] - rect[0]) * (rect[3] - rect[1]);
  console.log(`    círculo r ${R} m: ${f(Math.PI * R * R, 0)} m² · rectángulo ${f(rect[2] - rect[0], 2)} × ${f(rect[3] - rect[1], 2)} = ${f((rect[2] - rect[0]) * (rect[3] - rect[1]), 0)} m² · extensión ${f(area, 0)} m² · ${bloques.length} bloques de ${f(bloques[0].w, 2)} m`);
  check(bloques.length > 100 && bloques.length < 200, `bloques posibles: ${bloques.length} (los que tocan la zona)`);
  let okU = true;
  for (const b of bloques.slice(0, 40)) for (let i = 0; i < 30; i++) {
    const x = b.x0 + b.w * ((i * 0.37) % 1), z = b.z0 + b.d * ((i * 0.61) % 1), dn = dnExt(x, z, rect, R);
    if (dn >= 0 && umbralPasto(dn, manchaPasto(x, z, 1.2), { IRREGULARIDAD: 0.6, FRENTE_ANCHO: 0.25 }) < b.uMin) okU = false;
  }
  check(okU, 'culling por progreso: el umbral mínimo de cada bloque no supera el de ningún punto suyo');
  check(radioRecorteMonolito(1.334) > 1.2 && radioRecorteMonolito(1.334) < 1.3, `recorte de los monolitos: círculo libre de ${f(radioRecorteMonolito(1.334), 2)} m (base 1,334 m + 0,3 m)`);
  // selección
  const N = bloques.length, dist = new Float32Array(N), eleg = new Uint8Array(N), sel = new Int32Array(200), selD = new Float32Array(200);
  for (let k = 0; k < N; k++) { dist[k] = Math.hypot(bloques[k].cx - 20, bloques[k].cz); eleg[k] = k % 3 === 0 ? 0 : 1; }
  const c = seleccionarBloques(dist, eleg, N, 60, sel, selD);
  const elegidos = [...sel.slice(0, c)];
  const resto = [...Array(N).keys()].filter(k => eleg[k] && !elegidos.includes(k));
  check(c === 60 && elegidos.every(k => eleg[k]) && Math.max(...elegidos.map(k => dist[k])) <= Math.min(...resto.map(k => dist[k])), 'selección: tope de 60, solo elegibles y los más cercanos');
  check(elegidos.every((k, i) => i === 0 || dist[elegidos[i - 1]] <= dist[k]), 'ordenados de cerca a lejos');
  const c2 = seleccionarBloques(dist, eleg, N, 500, sel, selD);
  const nEleg = eleg.reduce((a, v) => a + v, 0);
  check(c2 === Math.min(nEleg, 200), `con un tope mayor que los elegibles devuelve todos (${c2} de ${nEleg}) sin pasar el tamaño de los arreglos (200)`);
  const antes = process.memoryUsage().heapUsed;
  for (let i = 0; i < 20000; i++) seleccionarBloques(dist, eleg, N, 60, sel, selD);
  const crecio = process.memoryUsage().heapUsed - antes;
  check(crecio < 2e6, `sin allocations: 20 000 selecciones ${f(crecio / 1024, 0)} KB de heap (arreglos preasignados)`);
}

console.log('\n2) costo estimado (fragmentos por cuadro, 1440×900 a DPR 1,5, fov vertical 90°)');
{
  const H = 900 * 1.5, foco = H / 2;   // px por unidad de tangente (fov 90°)
  const L = { CAPAS: 20, CAPAS_LEJOS: 6, LOD_CERCA_M: 8, LOD_LEJOS_M: 20, DIST_MAX_M: CFG.DBG_PASTO.DIST_MAX_M };
  const aspecto = 16 / 10, tanH = Math.tan(Math.PI / 4) * aspecto;
  // fragmentos de una muestra del suelo de área A (m²) a distancia d con el ojo a 1,6 m: px = A · f² · (h/d) / d²
  const px = (A, d) => (A * foco * foco * (1.6 / d)) / (d * d);
  const pose = (ex, ez, yaw, extOn) => {
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);
    let fr = 0, frLejano = 0, bloquesVis = new Set();
    const paso = 0.5;
    for (let x = -28; x <= 28; x += paso) for (let z = -28; z <= 28; z += paso) {
      const r = Math.hypot(x, z); if (r > 28) continue;
      const vx = x - ex, vz = z - ez, d = Math.max(0.8, Math.hypot(vx, vz, 1.6));
      const delante = (vx * fx + vz * fz) / Math.hypot(vx, vz);
      if (!(delante > Math.cos(Math.atan(tanH)))) continue;                 // fuera del cuadro (horizontal)
      const enRect = x >= rect[0] && x <= rect[2] && z >= rect[1] && z <= rect[3];
      const A = paso * paso, p = px(A, d);
      if (enRect) { const c = capasObjetivo(d, L); fr += p * c; if (d > 0.55 * L.DIST_MAX_M) frLejano += p; continue; }
      if (!extOn) continue;
      frLejano += p;                                                            // suelo lejano de la extensión (todo)
      if (d < L.DIST_MAX_M) {
        const b = bloques.findIndex(b => x >= b.x0 && x < b.x1 && z >= b.z0 && z < b.z1);
        bloquesVis.add(b);
        fr += p * capasObjetivo(d, L);
      }
    }
    return { fr, frLejano, bloques: bloquesVis.size };
  };
  const poses = [['centro (0, 0) mirando a +x', 0, 0, Math.PI / 2], ['cerca de la luz 1 (10,6, −10,6) mirando afuera', lx[0], lz[0], Math.PI / 4], ['cerca del borde (0, −25) mirando al centro', 0, -25, Math.PI]];
  for (const [nombre, x, z, yaw] of poses) {
    const sin = pose(x, z, yaw, false), con = pose(x, z, yaw, true);
    const extra = con.fr + con.frLejano - (sin.fr + sin.frLejano);
    console.log(`    ${nombre}: estrés hoy ${f((sin.fr + sin.frLejano) / 1e6, 1)} M frag · con extensión ${f((con.fr + con.frLejano) / 1e6, 1)} M (capas ${f(con.fr / 1e6, 1)} M + suelo lejano ${f(con.frLejano / 1e6, 1)} M) · bloques de la extensión en cuadro y cerca: ${con.bloques} · ${f(100 * extra / Math.max(1, sin.fr + sin.frLejano), 0)} % más`);
  }
  check(true, 'estimación impresa (cota alta: no descuenta los descartes tempranos por umbral ni por alfa)');
}

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
