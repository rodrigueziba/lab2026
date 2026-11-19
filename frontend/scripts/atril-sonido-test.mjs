// Z96: prueba del atril de SONIDO rediseñado ("SONIDO SN-40", lib/atrilSonido.ts): (a) cada control del inventario original
// existe en el nuevo con el mismo id (mismo parámetro o acción); (b) módulos, controles y textos sin superponerse y sin salir
// del panel ni de su módulo; (c) el ON de cada módulo en la misma posición relativa; (d) PLAY ≥ 3 veces el anterior;
// (e) legibilidad del texto más lejano ≥ 2,5 % de la altura de la pantalla con la cámara real del modo atril;
// (f) el flag recupera el layout anterior; (g) limpieza al desmontar (lectura del código). Uso: node scripts/atril-sonido-test.mjs
import fs from 'node:fs';
import * as A from '../lib/atrilSonido.ts';

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const LS = leer('../components/LecternSystem.tsx'), AN = leer('../components/AtrilSonidoNuevo.tsx'), CFG = leer('../lib/debugConfig.ts');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(CFG)[1].replace(/ as string/g, '')});`)();
const D = obj('DBG_ATRIL_SONIDO');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };

// inventario original: el bloque SOUND_CONTROLS de LecternSystem
const bloque = LS.split('const SOUND_CONTROLS: CtrlDef[] = [')[1].split('] as CtrlDef[];')[0];
const ORIG = [...bloque.matchAll(/\{ id: "(s_[a-z_A-Z]+)",\s*type: "(\w+)",\s*label: "([^"]+)"/g)].map(m => ({ id: m[1], tipo: m[2], label: m[3] }));

console.log('\nconfiguración');
check(D.DISENO_NUEVO === true && D.PLAY_ESCALA === 1 && D.ETIQUETA_ESCALA === 1 && D.DISPLAY_VALOR_S === 2.5 && D.VU_HZ === 30,
  'DBG_ATRIL_SONIDO: DISENO_NUEVO true, PLAY_ESCALA 1, ETIQUETA_ESCALA 1, DISPLAY_VALOR_S 2,5, VU_HZ 30');

console.log('\n(a) inventario: los mismos controles con el mismo id');
check(ORIG.length === 28, `inventario original: ${ORIG.length} controles (${ORIG.map(o => o.id).join(', ')})`);
for (const o of ORIG) check(!!A.pos(o.id), `${o.id} (${o.tipo} "${o.label}") → ${A.pos(o.id)?.modulo ?? 'FALTA'} · "${A.pos(o.id)?.etiqueta ?? ''}"`);
check(A.POSICIONES.length === ORIG.length && A.POSICIONES.every(p => ORIG.some(o => o.id === p.id)), 'ni uno de más ni uno de menos');
check(/SOUND_CONTROLS\.map\(d => \{[\s\S]*?return \{ \.\.\.d, px: p\.u, py: p\.v, label: p\.etiqueta, forma: p\.forma, nombreLargo: p\.nombreLargo,/.test(LS)
  && !/SOUND_CONTROLS_NUEVO[\s\S]{0,400}onActivate:/.test(LS), 'SOUND_CONTROLS_NUEVO copia cada definición (mismo onActivate, rango y tipo): solo cambian posición, etiqueta y forma');
check(['s_lp_on', 's_hp_on', 's_phs_on', 's_pit_on', 's_dist_on'].every(id => A.pos(id).forma === 'pastilla'), 'P.BAJOS y P.ALTOS pasan a ser el ON de cada filtro (igual que PHASER, PITCH y DISTORSIÓN)');
check(A.pos('s_play').forma === 'play' && A.pos('s_lp_fr').forma === 'grande' && A.pos('s_hp_fr').forma === 'grande', 'PLAY grande y CORTE de los filtros más grandes');

console.log('\n(b) colisiones y bordes');
const mods = A.MODULOS;
check(mods.every(m => A.dentro(m.rect, A.PANEL)), 'todos los módulos dentro del panel');
let solap = [];
for (let i = 0; i < mods.length; i++) for (let j = i + 1; j < mods.length; j++) if (A.seSuperponen(mods[i].rect, mods[j].rect)) solap.push(`${mods[i].id}↔${mods[j].id}`);
check(solap.length === 0, `ningún módulo se superpone con otro${solap.length ? ': ' + solap.join(', ') : ''}`);
const fuera = A.POSICIONES.filter(p => !A.dentro(A.huella(p), A.modulo(p.modulo).rect));
check(fuera.length === 0, `cada control dentro de su módulo${fuera.length ? ': ' + fuera.map(p => p.id).join(', ') : ''}`);
solap = [];
for (let i = 0; i < A.POSICIONES.length; i++) for (let j = i + 1; j < A.POSICIONES.length; j++)
  if (A.seSuperponen(A.huella(A.POSICIONES[i]), A.huella(A.POSICIONES[j]))) solap.push(`${A.POSICIONES[i].id}↔${A.POSICIONES[j].id}`);
check(solap.length === 0, `ningún control se superpone con otro (cuerpo + escala)${solap.length ? ': ' + solap.join(', ') : ''}`);
const vu = { u0: A.VU.u - A.VU.ancho / 2 - 0.004, u1: A.VU.u + A.VU.ancho / 2 + 0.004, v0: A.VU.v0 - 0.006, v1: A.VU.v1 + 0.006 };
check(A.dentro(vu, A.modulo('salida').rect) && !A.seSuperponen(vu, A.huella(A.pos('s_vol'))), 'VU dentro de SALIDA, al lado del fader sin tocarlo');
for (const esc of [0.7, 1, 1.2]) {
  const T = A.textos(esc);
  const malos = [];
  for (const t of T) {
    const r = A.rectTexto(t);
    const m = t.fila === 'display' ? A.modulo('display') : A.MODULOS.find(mm => t.id === `t_${mm.id}`) ?? A.modulo(A.pos(t.id.slice(2))?.modulo ?? 'salida');
    if (!A.dentro(r, m.rect)) malos.push(`${t.id} fuera de ${m.id}`);
    if (!A.dentro(r, A.PANEL)) malos.push(`${t.id} cruza el marco`);
    for (const p of A.POSICIONES) if (A.seSuperponen(r, A.huella(p))) malos.push(`${t.id}↔${p.id}`);
  }
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) if (A.seSuperponen(A.rectTexto(T[i]), A.rectTexto(T[j]))) malos.push(`${T[i].id}↔${T[j].id}`);
  check(malos.length === 0, `ETIQUETA_ESCALA ${esc}: ningún texto cortado, fuera de su módulo, sobre un control ni sobre otro texto${malos.length ? ': ' + malos.slice(0, 6).join(', ') : ''}`);
}
{ const T = A.textos(1);
  const malos = A.MODULOS.filter(m => m.fila !== 'display').filter(m => {
    const t = T.find(x => x.id === `t_${m.id}`), r = A.rectTexto(t);
    const banda = m.fila === 'transporte' ? A.BANDA_TITULO_TRANSPORTE : A.BANDA_TITULO;
    return !(r.v0 >= m.rect.v1 - banda && r.v1 <= m.rect.v1);
  });
  check(malos.length === 0, `cada título dentro de la banda de título de su módulo (con margen al marco)${malos.length ? ': ' + malos.map(m => m.id).join(', ') : ''}`); }

console.log('\n(c) ON en la misma posición relativa');
{ const conOn = A.MODULOS.filter(m => m.on);
  const rel = conOn.map(m => { const p = A.pos(m.on); return [(m.rect.u1 - p.u).toFixed(4), (m.rect.v1 - p.v).toFixed(4)].join(','); });
  check(conOn.length === 5 && new Set(rel).size === 1, `PHASER, PITCH, PASA-BAJOS, PASA-ALTOS y DISTORSIÓN: ON a ${rel[0]} m (u, v) de la esquina superior derecha`);
  check(conOn.every(m => { const h = A.huella(A.pos(m.on)); return h.v0 >= m.rect.v1 - A.BANDA_TITULO && h.v1 <= m.rect.v1; }), 'cada ON dentro de la banda de título de su módulo'); }

console.log('\n(d) PLAY/PAUSA');
{ const area = A.PLAY_W * A.PLAY_D, viejo = A.PLAY_VIEJO.w * A.PLAY_VIEJO.d, z79 = A.PLAY_GRANDE_Z79.w * A.PLAY_GRANDE_Z79.d;
  check(area >= 3 * viejo && A.PLAY_W >= 3 * A.PLAY_VIEJO.w, `PLAY ${(A.PLAY_W * 100).toFixed(0)} × ${(A.PLAY_D * 100).toFixed(1)} cm: ${(area / viejo).toFixed(1)}× el área de la tecla anterior (${(A.PLAY_W / A.PLAY_VIEJO.w).toFixed(1)}× el ancho)`);
  check(area >= 3 * z79, `y ${(area / z79).toFixed(1)}× el botón grande de Z79`);
  const pct = A.PLAY_W / (2 * A.PANEL_U);
  check(pct >= 0.22 && pct <= 0.25, `ancho = ${(pct * 100).toFixed(1)} % del panel (22 a 25 %)`);
  const fuera = A.POSICIONES.filter(p => p.id !== 's_play' && A.seSuperponen(A.huella(A.pos('s_play'), 1.04), A.huella(p)));
  check(fuera.length === 0 && A.dentro(A.huella(A.pos('s_play')), A.modulo('transporte').rect), 'el PLAY entra en TRANSPORTE sin tocar ANT. ni SIG.');
  check(A.pos('s_play').v < A.FILAS.tono.v0, 'en la fila más cercana al jugador'); }

console.log('\n(e) legibilidad con la cámara real del modo atril');
const g = A.GEO_DEFECTO;
for (const asp of [1.6, 16 / 10 + 0.06, 16 / 9, 1.9]) {
  const p = A.buscarPoseSonido(g, asp, false, 1);   // la búsqueda de hoy, sin la exigencia nueva: el encuadre no cambia
  check(p && p.legible >= A.LEGIBLE_MIN, `proporción ${asp.toFixed(2)}: pose fov ${p?.fov}° h ${p?.height.toFixed(2)} d ${p?.dist.toFixed(2)} pitch ${p?.pitch}° → texto más lejano ${(p?.legible * 100).toFixed(2)} % de la altura`);
}
{ const p = A.buscarPoseSonido(g, 16 / 9, false, 1), cam = A.camaraAtril(g, p.fov, p.height, p.dist, p.pitch, 16 / 9);
  const lej = A.textoMasLejano(1);
  check(lej.fila === 'display' && A.fraccionAltura(g, cam, lej) >= A.LEGIBLE_MIN, `el texto más lejano (${lej.id}, display) mide ${(A.fraccionAltura(g, cam, lej) * 100).toFixed(2)} %`);
  const tit = A.textos(1).filter(t => t.fila === 'efectos' && t.id.startsWith('t_')).map(t => A.fraccionAltura(g, cam, t));
  check(Math.min(...tit) >= A.LEGIBLE_MIN, `títulos de la fila de efectos: ${(Math.min(...tit) * 100).toFixed(2)} %`);
  const et = A.textos(1).filter(t => t.fila === 'efectos' && t.id.startsWith('e_')).map(t => A.fraccionAltura(g, cam, t));
  const et2 = A.textos(1).filter(t => t.fila === 'tono' && t.id.startsWith('e_')).map(t => A.fraccionAltura(g, cam, t));
  check(Math.min(...et) > Math.max(...et2) * 0.99, `etiquetas de efectos (${(Math.min(...et) * 100).toFixed(2)} %) no más chicas en pantalla que las de tono (${(Math.max(...et2) * 100).toFixed(2)} %): compensan la distancia`);
  const p2 = A.buscarPoseSonido(g, 16 / 9, true, 1);
  check(p2 && p2.fov === p.fov && p2.dist === p.dist && p2.height === p.height && p2.pitch === p.pitch, 'exigir la legibilidad no cambia la pose en 16:9 (encuadre coherente)'); }
{ const p = A.buscarPoseSonido(g, 2.1, true, 1, 1.3);
  check(p && p.legible >= A.LEGIBLE_MIN, `pantallas muy anchas (2,1): sin pose con la búsqueda de hoy; la 2.ª pasada (ancho relajado) da ${(p.legible * 100).toFixed(2)} %`); }
// Z97: la misma exigencia, compartida con el atril de imagen nuevo (legibilidadMinimaI en la rama isImage)
check(/: legibilidadMinima\(geoAtril\(\), cp, escalaEfectiva\(DBG_ATRIL_SONIDO\.ETIQUETA_ESCALA, DBG_ATRIL_SONIDO\.ETIQUETA_AUTO_ASPECTO, aspect\)\)\.min;\s*if \(leg < LEGIBLE_MIN\) continue;/.test(LS)
  && /const conPasadas = nuevoSonido \|\| imagenPanel;/.test(LS) && /if \(conPasadas && pasada < 3\) return fitLecternCamera\(side, aspect, pasada \+ 1\);/.test(LS),
  'fitLecternCamera exige la legibilidad con el diseño nuevo (y vuelve a la búsqueda anterior si no hay pose)');

console.log('\n(f) el flag recupera el layout anterior');
check(/function controlesSonido\(\): CtrlDef\[\] \{ return DBG_ATRIL_SONIDO\.DISENO_NUEVO \? SOUND_CONTROLS_NUEVO : SOUND_CONTROLS; \}/.test(LS), 'DISENO_NUEVO false → SOUND_CONTROLS de J3 (sin tocar)');
check(/side === "right" && !DBG_ATRIL_SONIDO\.DISENO_NUEVO && <PlayGrande \/>/.test(LS), '…con el botón grande de Z79');
check(/\(nuevoSonido \? buildSilkscreenSonido\(\{[^}]*\}\)\s*: nuevoImagen \? buildSilkscreenImagen\(\{[^}]*\}\) : buildSilkscreen\(side\)\)/.test(LS), '…y la serigrafía anterior (buildSilkscreen intacta)');
check(/const SOUND_SECTIONS: SecDef\[\] = \[/.test(LS) && /validateLayout\(SOUND_CONTROLS, SOUND_SECTIONS\);/.test(LS), 'el código viejo sigue (secciones y validación)');
check(/key=\{`sonido-\$\{disenoV\}`\}/.test(LS), 'cambiar el flag remonta el atril de sonido (mallas y serigrafía limpias)');
// Z97: el atril de imagen tiene su propio rediseño (scripts/atril-imagen-test.mjs); con DBG_ATRIL_VIDEO.DISENO_NUEVO false es el de antes
check(!/side === "left"[^\n]*SOUND_CONTROLS_NUEVO/.test(LS) && /side="left" controls=\{controlesImagen\(\)\}/.test(LS)
  && /return DBG_ATRIL_VIDEO\.DISENO_NUEVO \? IMAGE_CONTROLS_NUEVO : IMAGE_CONTROLS;/.test(LS), 'el atril de imagen no usa nada del de sonido (su diseño anterior vuelve con su propio flag)');

console.log('\n(g) limpieza y costo');
check(/useEffect\(\(\) => \(\) => \{ r\.tex\.dispose\(\); r\.mat\.dispose\(\); r\.geo\.dispose\(\); r\.marcoGeo\.dispose\(\); r\.marcoMat\.dispose\(\); \}, \[r\]\);/.test(AN), 'display: textura, material y geometrías se liberan');
check(/r\.geo\.dispose\(\); r\.apagado\.dispose\(\); r\.encendido\.forEach\(m => m\.dispose\(\)\);/.test(AN), 'VU: geometría y materiales se liberan');
check(/useEffect\(\(\) => \(\) => \{ r\.tex\.dispose\(\); r\.mat\.dispose\(\); r\.geo\.dispose\(\); \}, \[r\]\);/.test(AN), 'placa frontal: se libera');
check(/if \(propia\) \{ if \(silkMatRef\.current\?\.map === propia\) silkMatRef\.current\.map = null; propia\.dispose\(\); \}/.test(LS), 'serigrafía: la anterior se libera al rehacerla o desmontar');
check(/useEffect\(\(\) => \(\) => \{ playTex\?\.dispose\(\); \}, \[playTex\]\);/.test(LS), 'PLAY: su textura se libera');
check(/for \(const m of meshesRef\.current\) \{ const i = ex\.indexOf\(m\); if \(i >= 0\) ex\.splice\(i, 1\); \}/.test(LS), 'al desmontar el atril, sus mallas de impacto dejan de ser clickeables');
check(/window\.removeEventListener\("alight:atril-sonido-cambio", on\)/.test(LS), 'listener del menú: se quita');
check(/analizadorMaestro\(\)/.test(AN) && !/createAnalyser/.test(AN), 'VU: usa el analizador maestro existente (no crea otro)');
check(/if \(!tocaActualizar\(ahora, s\.ms, DBG_ATRIL_SONIDO\.VU_HZ\)\) return;[\s\S]*?if \(!enPantalla\(g, camera\)\) return;/.test(AN)
  && /if \(!tocaActualizar\(ahora, ult\.current\.ms, DBG_ATRIL_SONIDO\.VU_HZ\)\) return;[\s\S]*?if \(!enPantalla\(g, camera\)\) return;/.test(AN), 'VU y display: ≤ VU_HZ y solo con el atril en pantalla');
check(/s\.buf = new Float32Array\(an\.fftSize\); \}   \/\/ una vez por analizador/.test(AN), 'VU: búfer reutilizado (se crea una vez por analizador)');
check(/if \(lit === s\.lit && s\.p\.idx === s\.pico && A === s\.ambar && R === s\.rojo\) return;/.test(AN) && /return;\n    u\.t = t;/.test(AN), 'VU cambia materiales y el display redibuja solo cuando algo cambió');
{ let n = 0, u = -1e9; for (let t = 0; t < 1000; t += 1000 / 144) if (A.tocaActualizar(t, u, 30)) { n++; u = t; }
  check(n <= 31, `a 144 Hz, el VU se actualiza ${n} veces por segundo (≤ 30)`); }

console.log('\nfunciones puras');
check(A.lineasDisplay({ pista: 'mi_tema.mp3', t: 65, dur: 200, sonando: true, loopIn: 10, loopOut: 30, loopOn: true }).join(' | ') === 'MI_TEMA  01:05 / 03:20 | ▶ PLAY   LOOP A 00:10  B 00:30  [ON]', 'display: pista, tiempo, estado y loop A-B');
check(A.textoValor('CORTE PASA-BAJOS', 'knob', 14456, 200, 20000) === 'CORTE PASA-BAJOS 7.2' && A.textoValor('PHASER', 'toggle', 1, 0, 1) === 'PHASER ON', 'valor del control tocado: "CORTE PASA-BAJOS 7.2", "PHASER ON"');
{ const e = { id: '', t: -1e9 };
  check(!A.esDobleClic(e, 's_rev', 1000) && A.esDobleClic(e, 's_rev', 1200) && !A.esDobleClic(e, 's_rev', 1300) && !A.esDobleClic(e, 's_dlyA', 1350), 'doble clic: mismo control dentro de 350 ms (y se consume)'); }
check(/esDobleClic\(_dobleClic, def\.id, performance\.now\(\)\)\) \{\n        setCtrl\(def\.id, def\.initial, def\);/.test(LS), 'doble clic → valor por defecto (def.initial) en perillas y fader del atril de sonido');
check(Math.abs(A.nivelVu(1) - 1) < 1e-9 && A.nivelVu(0) === 0 && A.balistica(0.8, 0.2, 0.1) > 0.2 && A.balistica(0.2, 0.8, 0.1) === 0.8, 'VU: nivel en dB y balística (sube al instante, cae despacio)');
{ const pf = A.poseFrenteAtril(1.6, 1.0);
  check(Math.hypot(pf.x - 1.6, pf.z) === 1.0 && Math.hypot(pf.x + 1.6, pf.z) > 1.8, 'checkpoint atril_sonido: a 1 m del atril de sonido (rango de E 1,8 m) y a más de 1,8 m del de imagen'); }
check(/"atril_sonido"/.test(leer('../lib/checkpoints.ts')) && /atrilesSinConsentimiento: \(_p, ctx\) =>/.test(leer('../lib/checkpointsAcciones.ts')), 'checkpoint "atril_sonido" registrado (menú y ?cp=atril_sonido)');

// ════════════════════════════ Z96b ════════════════════════════
console.log('\nZ96b (a) PLAY: texto fijo y luz según el estado');
{ check(/export const TEXTO_TECLA_PLAY = "PLAY \/ PAUSA";/.test(LS) && /c\.fillText\(TEXTO_TECLA_PLAY, 270, 132\);/.test(LS), 'la tecla muestra siempre "PLAY / PAUSA" (con ▶❚❚): una sola textura');
  check(!/playTex\.pausa|texPlayGrande\(true\)/.test(LS), 'ya no cambia la pantalla de la tecla según el estado (no contradice al display)');
  const m = /export function intensidadLuzPlay\(sonando: boolean, ahoraMs: number\): number \{\n  return ([^\n]+)\n\}/.exec(LS);
  const fn = Function('sonando', 'ahoraMs', 'LUZ_PLAY', `return ${m[1].replace(/;$/, '')}`);
  const LP = { pulsoHz: 0.8 };
  const vals = Array.from({ length: 50 }, (_, i) => fn(true, i * 40, LP));
  check(Math.min(...vals) >= 1.6 && Math.max(...vals) <= 2.8 && Math.max(...vals) - Math.min(...vals) > 0.5, `reproduciendo: luz verde con pulso suave (${Math.min(...vals).toFixed(2)}…${Math.max(...vals).toFixed(2)})`);
  check(fn(false, 1234, LP) === 0.25, 'en pausa: ámbar apagada (0,25)');
  check(/LUZ_PLAY = \{ sonando: "#2E9E5B", pausa: "#FF9A1F"/.test(LS) && /emissive\.set\(s \? LUZ_PLAY\.sonando : LUZ_PLAY\.pausa\)/.test(LS), 'verde = reproduciendo · ámbar = pausa');
  check(A.lineasDisplay({ pista: 'x', t: 1, dur: 2, sonando: false, loopIn: 0, loopOut: 0, loopOn: false })[1].startsWith('❚❚ PAUSA') && A.lineasDisplay({ pista: 'x', t: 1, dur: 2, sonando: true, loopIn: 0, loopOut: 0, loopOn: false })[1].startsWith('▶ PLAY'), 'el estado en texto lo dice solo el display');
  check(/onActivate: \(v\) => \{ if \(v > 0\.5\) alternarPlay\(\); \}/.test(LS) && A.PLAY_W === 0.32 && A.PLAY_D === 0.082, 'misma función alternarPlay() y mismo tamaño'); }

console.log('\nZ96b (b) todas las perillas mostaza');
check(/\.\.\.\(d\.type === "knob" \? \{ color: "mustard" as const \} : \{\}\)/.test(LS) && /const knobMat = def\.color === "mustard" \? KNOB_MUSTARD_MAT : KNOB_BODY_MAT;/.test(LS), 'en el diseño nuevo, toda perilla usa KNOB_MUSTARD_MAT (las de los filtros venían negras de J3, sin color "mustard")');
check(A.GRANDE_ESCALA === 1.25, 'las CORTE siguen a 1,25×');
check(/MARCA_PERILLA_MAT = new THREE\.MeshStandardMaterial\(\{ color: "#14100c"/.test(LS) && /boxGeometry args=\{\[0\.0075, 0\.0024, indLen\]\}/.test(LS), 'marca de valor oscura y gruesa (7,5 mm) con punto, en vez de la raya crema');

console.log('\nZ96b (c) VU retro con picos (reloj simulado)');
{ const D2 = obj('DBG_ATRIL_SONIDO');
  check(D2.VU_SEG_AMBAR_DESDE === 9 && D2.VU_SEG_ROJO_DESDE === 12 && D2.VU_PICO_RETENCION_MS === 800, 'VU_SEG_AMBAR_DESDE 9, VU_SEG_ROJO_DESDE 12, VU_PICO_RETENCION_MS 800');
  const col = Array.from({ length: 14 }, (_, i) => A.colorSegmento(i, 9, 12));
  check(col.join('') === '00000000011122', `14 segmentos: 9 verdes, 3 ámbar, los últimos 2 rojos (${col.join('')})`);
  const p = { idx: -1, t: 0 };
  A.tickPico(p, 13, 0, 800);
  check(p.idx === 12, 'el pico sube al segmento más alto encendido');
  let t = 0; const idxs = [];
  for (let k = 0; k < 60; k++) { t += 1000 / 30; A.tickPico(p, 3, t, 800); idxs.push(p.idx); }
  const quieto = idxs.findIndex(i => i < 12);
  check(quieto >= 0 && quieto * (1000 / 30) >= 800 - 1000 / 30 && quieto * (1000 / 30) <= 800 + 1000 / 30, `se queda ~800 ms arriba (baja en el tick ${quieto})`);
  check(idxs.slice(quieto).every((v, i, a) => i === 0 || a[i - 1] - v <= 1) && idxs.at(-1) === 2, 'después baja de a un segmento por tick, hasta el último encendido');
  A.tickPico(p, 10, t + 10, 800); check(p.idx === 9, 'un nivel nuevo más alto lo vuelve a subir');
  check(/tickPico\(s\.p, lit, ahora, DBG_ATRIL_SONIDO\.VU_PICO_RETENCION_MS\);/.test(AN) && /i < lit \|\| i === s\.p\.idx \? r\.encendido\[colorSegmento\(i, A, R\)\]/.test(AN), 'el VU dibuja el pico con el color de su zona');
  check(/p: \{ idx: -1, t: 0 \}/.test(AN) && !/useFrame[\s\S]*new Float32Array\(an\.fftSize\)[\s\S]*every frame/.test(AN), 'sin allocations por frame: estado del pico en un objeto reutilizado'); }

console.log('\nZ96b (d) columna SALIDA');
{ const T = A.textos(1), ts = T.find(t => t.id === 't_salida'), te = T.filter(t => t.fila === 'efectos' && t.id.startsWith('t_'));
  check(Math.abs(ts.alto - te[0].alto) < 1e-9, `título SALIDA del mismo alto que los de su fila (${(ts.alto * 100).toFixed(2)} cm = ${(te[0].alto * 100).toFixed(2)} cm)`);
  const vol = A.pos('s_vol'), ev = T.find(t => t.id === 'e_s_vol'), h = A.huella(vol);
  const gap = h.v0 - (ev.v + ev.alto / 2);
  check(gap >= 0 && gap <= 0.004 && Math.abs(ev.u - vol.u) < 1e-9, `VOLUMEN pegado debajo del recorrido del fader (${(gap * 1000).toFixed(1)} mm), centrado`);
  const nf = A.numerosFader(), sal = A.modulo('salida').rect;
  check(nf.map(n => n.texto).join() === '0,5,10' && nf.every(n => A.dentro(A.rectTexto(n), sal) && !A.seSuperponen(A.rectTexto(n), h)), 'escala 0, 5, 10 a la izquierda del fader, dentro de SALIDA y sin tocar el pomo');
  const marcas = { u0: vol.u - A.HUELLA.FADER_U - 0.004 - A.ESCALA_FADER.marcaLarga, u1: vol.u - A.HUELLA.FADER_U - 0.004, v0: A.FADER_V - A.FADER_RAIL / 2 - 0.002, v1: A.FADER_V + A.FADER_RAIL / 2 + 0.002 };
  check(A.dentro(marcas, sal) && !nf.some(n => A.seSuperponen(A.rectTexto(n), marcas)) && !A.seSuperponen(marcas, h), 'marcas entre los números y el pomo');
  const vu = { u0: A.VU.u - A.VU.ancho / 2 - 0.004, u1: A.VU.u + A.VU.ancho / 2 + 0.004, v0: A.VU.v0 - 0.006, v1: A.VU.v1 + 0.006 };
  check(!A.seSuperponen(vu, h) && A.dentro(vu, sal), 'el fader corrido deja el VU sin tocar');
  check(A.textoValor('VOLUMEN', 'slider', 0.8, 0, 1) === 'VOLUMEN 8.0', 'al tocarlo, el display muestra "VOLUMEN 8.0"'); }

console.log('\nZ96b (e) escala de las perillas sin colisiones');
{ const perillas = A.POSICIONES.filter(A.esPerilla), malos = [];
  check(perillas.length === 13, `13 perillas con escala impresa (${perillas.map(p => p.id).join(', ')})`);
  for (const p of perillas) {
    const nums = A.numerosPerilla(p);
    for (const n of nums) {
      const r = A.rectTexto(n);
      if (!A.dentro(r, A.huella(p))) malos.push(`${n.id} fuera de la huella`);
      for (const q of A.POSICIONES) if (q.id !== p.id && A.seSuperponen(r, A.huella(q))) malos.push(`${n.id}↔${q.id}`);
      for (const t of A.textos(1.15)) if (A.seSuperponen(r, A.rectTexto(t))) malos.push(`${n.id}↔${t.id}`);
    }
  }
  check(malos.length === 0, `"0/10" (o "MIN/MAX") dentro de la huella de cada perilla, sin pisar controles ni etiquetas${malos.length ? ': ' + malos.slice(0, 5).join(', ') : ''}`);
  check(A.numerosPerilla(A.pos('s_lp_fr')).map(n => n.texto).join() === 'MIN,MAX' && A.numerosPerilla(A.pos('s_rev')).map(n => n.texto).join() === '0,10', 'MIN/MAX en las de Hz, 0/10 en el resto'); }

console.log('\nZ96b (f) placa de la barra y rótulos (cámara real)');
const g2 = A.GEO_DEFECTO, MARCA = "IN-GO'S WAN INC.";
const poseDe = asp => A.buscarPoseSonido(g2, asp, false, 1) ?? { fov: 60, height: 0.8, dist: 0.8, pitch: -45 };
const camDe = asp => { const p = poseDe(asp); return A.camaraAtril(g2, p.fov, p.height, p.dist, p.pitch, asp); };
{ const txt = A.TEXTO_PLACA(MARCA), l = A.lineasBarra(txt.length, true);
  check(txt === "SONIDO SN-40 · IN-GO'S WAN INC. · PROCESADOR DE SONIDO · 10 MÓDULOS", 'texto de la placa con la constante de marca');
  for (const asp of [1.6, 16 / 9]) {
    const cam = camDe(asp), fp = A.fraccionAlturaY(g2, cam, l.placa, A.BARRA.y), fl = A.fraccionAlturaY(g2, cam, l.leyenda, A.BARRA.y);
    check(fp >= A.LEGIBLE_MIN, `${asp.toFixed(2)}: placa (${(l.placa.alto * 100).toFixed(1)} cm) ${(fp * 100).toFixed(2)} % · leyenda (${(l.leyenda.alto * 100).toFixed(1)} cm) ${(fl * 100).toFixed(2)} %`);
  }
  const ancho = txt.length * A.ANCHO_CHAR * l.placa.alto, anchoL = A.LEYENDA_FILAS.length * A.ANCHO_CHAR * l.leyenda.alto;
  const prof = A.BARRA_2L.margen + l.placa.alto + A.BARRA_2L.gap + l.leyenda.alto + A.BARRA_2L.gap + A.BARRA_2L.franjas + A.BARRA_2L.margen;
  check(ancho <= A.PLACA_BARRA.ancho - 0.03 && anchoL <= A.PLACA_BARRA.ancho && prof <= A.PLACA_BARRA.prof + 1e-9 && A.PLACA_BARRA.prof <= A.BARRA.v1 - A.BARRA.v0, `placa en la barra: ${(ancho * 100).toFixed(0)} cm de texto en ${(A.PLACA_BARRA.ancho * 100).toFixed(0)} cm; ${(prof * 100).toFixed(1)} cm de profundidad en ${((A.BARRA.v1 - A.BARRA.v0) * 100).toFixed(0)} cm`); }
{ const cam = camDe(16 / 9), rot = A.rotulosFila();
  const fr = rot.map(r => A.fraccionAlturaVertical(g2, cam, r));
  const caben = rot.every(r => r.v0 >= A.FILAS[A.ROTULOS.find(x => x.id === r.id).fila].v0 && r.v1 <= A.FILAS[A.ROTULOS.find(x => x.id === r.id).fila].v1);
  const minF = Math.min(...fr);
  console.log(`     rótulos verticales en el margen (16:9): ${rot.map((r, i) => `${r.texto} ${(fr[i] * 100).toFixed(2)} %`).join(' · ')}`);
  const usarMargen = minF >= A.ROTULO_MIN && caben;
  check(!usarMargen, `margen: el más chico (TRANSPORTE, fila de ${((A.FILAS.transporte.v1 - A.FILAS.transporte.v0) * 100).toFixed(1)} cm) da ${(minF * 100).toFixed(2)} % < 2,0 % → se usa la ALTERNATIVA (barra)`);
  check(obj('DBG_ATRIL_SONIDO').ROTULOS_MODO === 'barra' && obj('DBG_ATRIL_SONIDO').ROTULOS_FILA === true, 'ROTULOS_FILA true · ROTULOS_MODO "barra" por defecto');
  const nums = A.numerosFilaMargen(), fn = nums.map(n => A.fraccionAltura(g2, cam, n));
  check(Math.min(...fn) >= A.LEGIBLE_MIN && nums.every(n => n.alto <= A.MARGEN_ROTULOS.u1 - A.MARGEN_ROTULOS.u0), `números de fila 1·2·3 en el margen: ${fn.map(f => (f * 100).toFixed(2) + ' %').join(' · ')}`); }

console.log('\nZ96b (g) ajuste por proporción de pantalla');
{ check(A.escalaEfectiva(1, true, 1.5) === 1.15 && A.escalaEfectiva(1, true, 1.6) === 1 && A.escalaEfectiva(1, true, 16 / 9) === 1 && A.escalaEfectiva(1, false, 1.5) === 1, 'escala efectiva: 1,15 en 1,5 · 1 desde 1,6 · sin efecto con el flag apagado');
  const res = [];
  for (const asp of [1.5, 1.6, 16 / 9]) {
    const cam = camDe(asp), antes = A.legibilidadMinima(g2, cam, 1).min, despues = A.legibilidadMinima(g2, cam, A.escalaEfectiva(1, true, asp)).min;
    res.push(`${asp.toFixed(2)}: ${(antes * 100).toFixed(2)} % → ${(despues * 100).toFixed(2)} %`);
    if (despues < antes - 1e-9) res.push('EMPEORA');
  }
  check(!res.includes('EMPEORA'), `texto más lejano, antes → después: ${res.join(' · ')}`);
  const T = A.textos(1.15), malos = [];
  for (const t of T) { const r = A.rectTexto(t); for (const p of A.POSICIONES) if (A.seSuperponen(r, A.huella(p))) malos.push(t.id); }
  check(malos.length === 0, 'a × 1,15 ningún texto pisa controles (el acotado por lugar lo evita)');
  check(/escPrev = e;( escPrevI = ei;)? setSilkV\(v => v \+ 1\);/.test(LS) && /window\.removeEventListener\("resize", onResize\)/.test(LS), 'al cambiar el tamaño de la ventana, si cambia la escala se rehace la serigrafía (y se quita el listener)'); }

console.log('\nZ96b (h) el flag recupera el diseño anterior con sus 28 controles');
{ check(/function controlesSonido\(\): CtrlDef\[\] \{ return DBG_ATRIL_SONIDO\.DISENO_NUEVO \? SOUND_CONTROLS_NUEVO : SOUND_CONTROLS; \}/.test(LS) && ORIG.length === 28, 'DISENO_NUEVO false → SOUND_CONTROLS (28 controles originales)');
  check(/side === "right" && DBG_ATRIL_SONIDO\.DISENO_NUEVO && \(\n\s+<PlacaBarraSonido/.test(LS) && /side === "right" && DBG_ATRIL_SONIDO\.DISENO_NUEVO && DBG_ATRIL_SONIDO\.ROTULOS_FILA && \(\n\s+<MargenRotulos/.test(LS), 'placa de la barra y rótulos solo con el diseño nuevo');
  check(/\{def\.forma \? \(/.test(LS) && /<primitive object=\{SILK_MAT\} attach="material" \/>\n            <\/mesh>\n          \)\}/.test(LS), 'la marca crema de las perillas sigue igual en el diseño anterior');
  check(!/s_lp_fr[^\n]*color: "mustard"/.test(bloque), 'SOUND_CONTROLS (J3) sin tocar: los filtros siguen negros en el diseño anterior'); }

console.log('\nZ96b (i) limpieza de las piezas nuevas');
check((AN.match(/useEffect\(\(\) => \(\) => \{ r\.tex\.dispose\(\); r\.mat\.dispose\(\); r\.geo\.dispose\(\); \}, \[r\]\);/g) || []).length >= 3, 'placa de la barra y margen de rótulos (y la placa frontal) liberan textura, material y geometría');

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
