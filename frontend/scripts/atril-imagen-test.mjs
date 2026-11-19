// Z97: prueba del atril de IMAGEN rediseñado ("IMAGEN IM-40", lib/atrilImagen.ts + lib/domoEfectos.ts):
// (a) inventario: cada control original sigue (mismo id) o figura como retirado con su motivo; (b) módulos, controles y textos
// sin superponerse ni salirse; (c) el ON de cada módulo en la misma posición relativa que en el atril de sonido;
// (d) semántica de los pads (opción A) con reloj simulado; (e) VELOC. es un acumulador de dt (sin timers nuevos);
// (f) legibilidad ≥ 2,5 % con la cámara real ("panel") y rótulos de fila ≥ 2,0 %; (g) uniforms compartidos con la
// transmisión y el shader sin lecturas extra; (h) el flag recupera el layout anterior; (i) limpieza al desmontar.
// Uso: node scripts/atril-imagen-test.mjs
import fs from 'node:fs';
import { register } from 'node:module';
// lib/atrilImagen.ts importa "./atrilSonido" sin extensión (así lo pide tsconfig): en Node se agrega ".ts"
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(s, c, n) { if (/^\\.\\.?\\//.test(s) && !/\\.[a-z]+$/.test(s)) { try { return await n(s + '.ts', c); } catch {} } return n(s, c); }`));
const I = await import('../lib/atrilImagen.ts');
const S = await import('../lib/atrilSonido.ts');
const E = await import('../lib/domoEfectos.ts');

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const LS = leer('../components/LecternSystem.tsx'), AI = leer('../components/AtrilImagenNuevo.tsx'), FD = leer('../components/FaceDome.tsx');
const VT = leer('../components/VideoTransmitidoTarima.tsx'), CFG = leer('../lib/debugConfig.ts');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(CFG)[1].replace(/ as [A-Za-z"| ]+/g, '')});`)();
const D = obj('DBG_ATRIL_VIDEO');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };

// inventario original: el bloque IMAGE_CONTROLS de LecternSystem
const bloque = LS.split('const IMAGE_CONTROLS: CtrlDef[] = [')[1].split('const SOUND_CONTROLS')[0];
const ORIG = [...bloque.matchAll(/\{\s*id:\s*"([a-z_]+)",\s*type:\s*"(\w+)",\s*label:\s*"([^"]+)"/g)].map(m => ({ id: m[1], tipo: m[2], label: m[3] }));

console.log('\nconfiguración');
check(D.DISENO_NUEVO === true && D.ETIQUETA_ESCALA === 1 && D.DISPLAY_VALOR_S === 2.5 && D.VELOC_MIN_S === 1 && D.VELOC_MAX_S === 10
  && D.VELOC_DEFECTO_S === 5 && D.PADS_INICIO === 0x7f && D.CAMARA === 'panel' && D.ROTULOS_MODO === 'margen',
  'DBG_ATRIL_VIDEO: DISENO_NUEVO true, ETIQUETA_ESCALA 1, DISPLAY_VALOR_S 2,5, VELOC 1…10 (5), PADS_INICIO 0x7f, CAMARA panel, ROTULOS_MODO margen');
check(I.NOMBRE_EQUIPO_I === 'IMAGEN IM-40' && I.DESCRIPCION_EQUIPO_I === 'PROCESADOR DE IMAGEN · 3 MÓDULOS', 'nombre "IMAGEN IM-40" · "PROCESADOR DE IMAGEN · 3 MÓDULOS"');

console.log('\n(a) inventario');
check(ORIG.length >= 14, `inventario original: ${ORIG.length} controles (${ORIG.map(o => o.id).join(', ')})`);
for (const o of ORIG) {
  const p = I.posI(o.id), r = I.RETIRADOS_I[o.id];
  check(!!p !== !!r, `${o.id} (${o.tipo} "${o.label}") → ${p ? `${p.modulo} · "${p.etiqueta}"` : r ? 'RETIRADO: ' + r : 'FALTA'}`);
}
check(I.POSICIONES_I.every(p => ORIG.some(o => o.id === p.id) || I.NUEVOS_I.includes(p.id)), 'cada control nuevo es un id original o figura en NUEVOS_I');
check(I.NUEVOS_I.every(id => !!I.posI(id)) && I.NUEVOS_I.every(id => new RegExp(`id: [\`"]${id.replace(/\d$/, '\\$\\{i\\}')}|id: "${id}"`).test(LS)),
  `los ${I.NUEVOS_I.length} controles nuevos (Z97 + Z98 VISUALIZADOR) tienen posición y definición en IMAGE_CONTROLS_EXTRA`);
check(/IMAGE_CONTROLS\.find\(c => c\.id === p\.id\) \?\? IMAGE_CONTROLS_EXTRA\.find/.test(LS) && /return \{ \.\.\.d, px: p\.u, py: p\.v, label: p\.etiqueta/.test(LS),
  'IMAGE_CONTROLS_NUEVO copia cada definición original (mismo onActivate y rango): cambian posición, etiqueta y forma');
check(I.posI('cam_fov').tipo === 'knob', 'FOV pasa de fader a perilla (mismo id cam_fov, mismo rango)');
check(['dom_onoff', 'reactive', 'dom_nxt', 'dom_speed'].every(id => /RETIRADO|consumidor|reemplaz/.test(I.RETIRADOS_I[id]) && bloque.includes(`"${id}"`)),
  'retirados (ON/OFF, REACTIVO, SIG.EFE., VELOC. vieja): su código y su id siguen en IMAGE_CONTROLS (flag)');

console.log('\n(b) colisiones y bordes');
const M = I.MODULOS_I;
check(M.every(m => S.dentro(m.rect, S.PANEL)), 'los 4 módulos dentro del panel');
let malos = [];
for (let i = 0; i < M.length; i++) for (let j = i + 1; j < M.length; j++) if (S.seSuperponen(M[i].rect, M[j].rect)) malos.push(`${M[i].id}↔${M[j].id}`);
check(malos.length === 0, `ningún módulo se superpone${malos.length ? ': ' + malos.join(', ') : ''}`);
const fuera = I.POSICIONES_I.filter(p => !S.dentro(I.huellaI(p), I.moduloI(p.modulo).rect));
check(fuera.length === 0, `cada control dentro de su módulo${fuera.length ? ': ' + fuera.map(p => p.id).join(', ') : ''}`);
malos = [];
const P = I.POSICIONES_I;
for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (S.seSuperponen(I.huellaI(P[i]), I.huellaI(P[j]))) malos.push(`${P[i].id}↔${P[j].id}`);
check(malos.length === 0, `ningún control se superpone con otro (cuerpo + escala)${malos.length ? ': ' + malos.join(', ') : ''}`);
for (const esc of [0.7, 1, 1.15, 1.2]) {
  const T = I.textosI(esc), mal = [];
  for (const t of T) {
    const r = S.rectTexto(t);
    const m = t.fila === 'display' ? I.moduloI('display') : M.find(mm => t.id === `t_${mm.id}` || t.id === `g_${mm.id}`) ?? I.moduloI(I.posI(t.id.slice(2))?.modulo ?? 'escena');
    if (!S.dentro(r, m.rect)) mal.push(`${t.id} fuera de ${m.id}`);
    for (const p of P) if (S.seSuperponen(r, I.huellaI(p))) mal.push(`${t.id}↔${p.id}`);
  }
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) if (S.seSuperponen(S.rectTexto(T[i]), S.rectTexto(T[j]))) mal.push(`${T[i].id}↔${T[j].id}`);
  check(mal.length === 0, `ETIQUETA_ESCALA ${esc}: ningún texto fuera de su módulo, sobre un control ni sobre otro texto${mal.length ? ': ' + mal.slice(0, 6).join(', ') : ''}`);
}
{ const nums = P.filter(p => p.tipo === 'knob').flatMap(p => I.numerosPerillaI(p).map(n => [p, n]));
  check(nums.every(([p, n]) => S.dentro(S.rectTexto(n), I.huellaI(p))), 'números 0/10 (FOV: MIN/MAX) de las perillas dentro de su huella');
  const fad = P.filter(p => p.tipo === 'slider');
  check(fad.length === 4 && fad.every(p => I.numerosFaderI(p).every(n => S.dentro(S.rectTexto(n), I.moduloI('imagen').rect))
    && P.every(q => q === p || !S.seSuperponen(I.marcasFaderI(p), I.huellaI(q)))), 'escala 0/5/10 de los 4 faders dentro de IMAGEN, sin tocar otro control'); }
check(I.moduloI('escena').punteado && !I.moduloI('imagen').punteado && I.moduloI('escena').etiqueta === 'SOLO PARA VOS'
  && I.moduloI('imagen').etiqueta === 'SE TRANSMITE' && I.moduloI('efectos').etiqueta === 'SE TRANSMITE', 'EFECTOS e IMAGEN "se transmite"; ESCENA "solo para vos" con borde punteado');
{ const largos = []; const st = E.crearEstadoEfectos();
  for (let m = 0; m < 128; m++) for (const auto of [true, false]) for (const on of [true, false]) { st.mascara = m; st.auto = auto; st.on = on; st.rotS = 10; largos.push(E.textoEfectos(st).length); }
  const l2 = ['● EN VIVO · SE TRANSMITE', 'PRIVADO · NADA SE TRANSMITE', ...P.map(p => `» ${p.nombreLargo} 100 %`), '» VELOCIDAD DE ROTACIÓN 10.0 s'].map(t => t.length);
  check(Math.max(...largos) <= I.DISPLAY_CHARS_I[0] && Math.max(...l2) <= I.DISPLAY_CHARS_I[1],
    `display: línea 1 ≤ ${I.DISPLAY_CHARS_I[0]} caracteres en las 512 combinaciones (máx. ${Math.max(...largos)}) y línea 2 ≤ ${I.DISPLAY_CHARS_I[1]} (máx. ${Math.max(...l2)})`); }

console.log('\n(c) el ON de cada módulo');
for (const m of M.filter(m => m.on)) {
  const p = I.posI(m.on), o = I.posOnI(m);
  check(p.forma === 'pastilla' && Math.abs(p.u - o.u) < 1e-9 && Math.abs(p.v - o.v) < 1e-9, `${m.id}: ON (${m.on}) arriba a la derecha de la banda del título, igual que en SONIDO SN-40`);
}
check(M.find(m => m.id === 'escena').on === null, 'ESCENA no tiene ON (lo local no se apaga en bloque)');

console.log('\n(d) pads: opción A con reloj simulado');
{ const st = E.crearEstadoEfectos(), out = [0, 0, 0, 0, 0, 0, 0];
  E.asignarSectores(st, out);
  check(out.join() === '0,1,2,3,4,5,6', 'los 7 pads y AUTO: arranca con un efecto distinto por sector');
  // con los 7 pads, la rotación es la de siempre: sector i → (i + paso) % 7 cada 5 s
  let pasos = 0;
  for (let f = 0; f < 29.9 * 60; f++) if (E.tickRotacion(st, 1 / 60)) pasos++;
  E.asignarSectores(st, out);
  check(pasos === 5 && out.join() === [0, 1, 2, 3, 4, 5, 6].map(i => (i + 5) % 7).join(), `29,9 s a 60 fps con VELOC. 5 s → ${pasos} pasos, sectores ${out.join(',')} (= rotación de hoy)`);
  E.fijarPad(st, 0, false); E.fijarPad(st, 1, false); E.fijarPad(st, 3, false); E.fijarPad(st, 4, false); E.fijarPad(st, 5, false); E.fijarPad(st, 6, false);
  st.auto = false; E.asignarSectores(st, out);
  check(out.every(x => x === 2) && E.textoEfectos(st) === 'EFECTO ONDA 3/7', `un solo pad (ONDA) sin AUTO → los 7 sectores con ONDA al instante · "${E.textoEfectos(st)}"`);
  E.fijarPad(st, 0, true); E.asignarSectores(st, out);
  check(out.every(x => x === 0 || x === 2) && out.includes(0) && out.includes(2), `dos pads (RGB + ONDA) sin AUTO → combinados: ${out.join(',')} · "${E.textoEfectos(st)}"`);
  st.auto = true; const antes = out.join(); for (let f = 0; f < 21; f++) E.tickRotacion(st, 0.25); E.asignarSectores(st, out);
  check(out.join() !== antes && out.every(x => x === 0 || x === 2), `dos pads con AUTO → rotan solo entre RGB y ONDA (${antes} → ${out.join(',')})`);
  E.fijarPad(st, 0, false); E.fijarPad(st, 2, false); E.asignarSectores(st, out);
  check(out.every(x => x === E.EFECTO_NINGUNO), 'ningún pad → 7 (sin efecto) en todos los sectores');
  E.fijarPad(st, 4, true); st.on = false; E.asignarSectores(st, out);
  check(out.every(x => x === E.EFECTO_NINGUNO) && E.textoEfectos(st) === 'EFECTOS APAGADOS', 'ON de EFECTOS apagado → sin efecto, y el display lo dice');
  const v = st.version; E.fijarPad(st, 4, true);
  check(st.version === v, 'repetir el mismo estado de un pad no reescribe los uniforms (version igual)');
  check(/onActivate: \(v\) => fijarPad\(DOMO_EFECTOS, i, v > 0\.5\)/.test(LS) && /\(DBG_ATRIL_VIDEO\.PADS_INICIO >> i\) & 1/.test(LS), 'cada pad es un toggle con luz que escribe DOMO_EFECTOS; arrancan según PADS_INICIO'); }

console.log('\n(e) VELOC.: acumulador de dt');
{ const st = E.crearEstadoEfectos(); st.rotS = 2; let n = 0;   // dt 0,25 s (exacto en binario)
  for (let f = 0; f < 40; f++) if (E.tickRotacion(st, 0.25)) n++;          // 10 s a 2 s → 5
  st.rotS = 8; for (let f = 0; f < 64; f++) if (E.tickRotacion(st, 0.25)) n++;   // 16 s a 8 s → 2
  check(n === 7, `cambiar VELOC. en caliente (2 s → 8 s) cambia el ritmo sin reprogramar nada: 5 + 2 = ${n} pasos`);
  st.rotS = 0.1; st.acum = 0; let m = 0; for (let f = 0; f < 20; f++) if (E.tickRotacion(st, 0.25, 1, 10)) m++;
  check(m === 5, `VELOC. por debajo del mínimo se acota a VELOC_MIN_S (1 s): ${m} pasos en 5 s`);
  const st2 = E.crearEstadoEfectos(); st2.rotS = 1; let k = 0; for (let i = 0; i < 4; i++) if (E.tickRotacion(st2, 30)) k++;
  const st3 = E.crearEstadoEfectos(); let k3 = 0; for (let i = 0; i < 4; i++) if (E.tickRotacion(st3, 30)) k3++;
  check(k === 4 && st2.acum < 1 && k3 === 0, 'una pausa larga (dt enorme) da un paso por frame como máximo, sin ráfagas acumuladas');
  const src = leer('../lib/domoEfectos.ts');
  check(!/setInterval|setTimeout|new |\[\]|\{\s*\}/.test(src.split('export function tickRotacion')[1].split('\n}\n')[0])
    && !/setInterval|setTimeout/.test(src), 'tickRotacion y asignarSectores no crean timers ni objetos');
  check(/tickRotacion\(DOMO_EFECTOS, delta, DBG_ATRIL_VIDEO\.VELOC_MIN_S, DBG_ATRIL_VIDEO\.VELOC_MAX_S\)/.test(FD)
    && /if \(DBG_ATRIL_VIDEO\.DISENO_NUEVO\) return;/.test(FD), 'FaceDome avanza la rotación en su useFrame; el setInterval de 5 s no actúa con el diseño nuevo'); }

console.log('\n(f) legibilidad con la cámara real');
{ const g = S.GEO_DEFECTO;
  for (const [nom, a] of [['16:10', 1.6], ['16:9', 16 / 9], ['21:9', 21 / 9]]) {
    const e = S.escalaEfectiva(D.ETIQUETA_ESCALA, D.ETIQUETA_AUTO_ASPECTO, a), p = I.buscarPoseImagenPanel(g, a, e);
    const cam = p && S.camaraAtril(g, p.fov, p.height, p.dist, p.pitch, a);
    const rot = cam ? I.rotulosFilaI().map(r => I.fraccionRotuloI(g, cam, r)) : [];
    check(!!p && p.pasada < 3 && p.legible >= S.LEGIBLE_MIN, `${nom}: cámara "panel" fov ${p?.fov}° h ${p?.height.toFixed(2)} d ${p?.dist.toFixed(2)} pitch ${p?.pitch}° (pasada ${p?.pasada}) → texto más lejano ${(100 * (p?.legible ?? 0)).toFixed(2)} %`);
    check(rot.length === 2 && rot.every(f => f >= 0.02), `${nom}: rótulos verticales DOMO ${(100 * rot[0]).toFixed(2)} % · IMAGEN ${(100 * rot[1]).toFixed(2)} % (≥ 2,0 %: modo margen)`);
  }
  const d = I.buscarPoseImagen(g, 16 / 9, false, 1);
  console.log(`  · referencia, cámara "domo" (la de antes) 16:9: fov ${d.fov}° pitch ${d.pitch}° → ${(100 * d.legible).toFixed(2)} % (no llega: por eso "panel" es el default)`);
  check(/const modoImagen = isImage && !\(nuevoImagen && DBG_ATRIL_VIDEO\.CAMARA !== "domo"\);/.test(LS) && /legibilidadMinimaI\(geoAtril\(\), cp, escalaEfectiva\(DBG_ATRIL_VIDEO\.ETIQUETA_ESCALA/.test(LS),
    'fitLecternCamera: el atril de imagen nuevo busca como el de sonido y exige legibilidadMinimaI (CAMARA "domo" = la de antes)'); }

console.log('\n(g) uniforms compartidos y shader');
check(/uniforms: \{ \.\.\.base\.uniforms,/.test(VT), 'el pase de transmisión comparte por referencia los uniforms del domo (uE0..uE6, uPsych, uBrightness…)');
check(/eff < 6\.5\)/.test(FD) && /7 = sin efecto/.test(FD) && !/uniform float uFx|uMascara|uPads/.test(FD), 'shader: el 7 = sin efecto usa la lectura inicial; no hay uniforms nuevos');
check(/domeUniforms\.uBrightness\.value = imgOn \? STORE\.webcam\.brightness : 1;/.test(FD), 'ON de IMAGEN apagado = brillo/contraste/saturación/zoom neutros (también en lo transmitido)');
check(/if \(DOMO_EFECTOS\.version !== efVersion\.current\)/.test(FD) && /const _sectores: number\[\] = \[0, 1, 2, 3, 4, 5, 6\];/.test(FD), 'uE0..uE6 se escriben solo cuando cambian, con buffers de módulo (sin allocations por frame)');

console.log('\n(h) flag');
check(/function controlesImagen\(\): CtrlDef\[\] \{ return DBG_ATRIL_VIDEO\.DISENO_NUEVO \? IMAGE_CONTROLS_NUEVO : IMAGE_CONTROLS; \}/.test(LS), 'DISENO_NUEVO false → IMAGE_CONTROLS tal cual (ON/OFF, REACTIVO, SIG.EFE., VELOC.)');
check(/key=\{`imagen-\$\{disenoV\}`\} side="left" controls=\{controlesImagen\(\)\}/.test(LS) && /"alight:atril-imagen-cambio"/.test(leer('../components/debug/pestanas/tarima.tsx')),
  'el menú (Shift → Tarima → Atril de imagen Z97) remonta el atril al cambiar el flag');
check(/nuevoImagen \? buildSilkscreenImagen/.test(LS) && /side === "left" && DBG_ATRIL_VIDEO\.DISENO_NUEVO && <DisplayImagen \/>/.test(LS), 'serigrafía, display, placas y rótulos nuevos solo con el flag');
check(/"atril_imagen"/.test(leer('../lib/checkpoints.ts')) && /frenteAtrilImagen: \(\) =>/.test(leer('../lib/checkpointsAcciones.ts')), 'checkpoint "atril_imagen" (menú y ?cp=atril_imagen)');
{ const p = I.poseFrenteAtrilImagen(S.ATRIL_X_BASE + 0.3, 1.0);
  check(Math.abs(Math.hypot(p.x + 1.6, p.z) - 1.0) < 1e-9 && Math.hypot(p.x - 1.6, p.z) > 1.8, `checkpoint atril_imagen: a 1 m del atril de imagen (x ${p.x.toFixed(2)}) y a más de 1,8 m del de sonido`); }

console.log('\n(i) limpieza al desmontar');
check(/useEffect\(\(\) => \(\) => \{ r\.tex\.dispose\(\); r\.mat\.dispose\(\); r\.geo\.dispose\(\); r\.marcoGeo\.dispose\(\); r\.marcoMat\.dispose\(\); \}, \[r\]\);/.test(AI), 'display: textura, material y geometrías se liberan');
check(/window\.removeEventListener\("alight:atril-imagen-cambio", on\)/.test(LS), 'el listener del menú se quita al desmontar');
check(/return \(\) => \{ if \(glitchTimer\.current\) clearInterval\(glitchTimer\.current\); \};/.test(FD), 'FaceDome sigue limpiando su intervalo (no se agregó ninguno)');
check(/propia\?\.dispose\(\)|propia\.dispose\(\)/.test(LS), 'la serigrafía propia del atril se libera al cambiarla o desmontar');

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
