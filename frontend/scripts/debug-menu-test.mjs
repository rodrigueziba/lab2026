// Z70: prueba del menú de debug reorganizado. Uso (en frontend/): node scripts/debug-menu-test.mjs
//  (a) cada sección dibujada (marca "// sección: <id>" en components/debug/pestanas/*.tsx y entrada del mapa) tiene su
//      entrada en lib/debugSecciones.ts y viceversa; la pestaña del registro es la del archivo
//  (b) el orden por ultimoZ (pestañas, secciones, Recientes, NUEVO) es el esperado
//  (c) ningún control perdido: los controles de cada sección (firma = código normalizado del elemento) del inventario del
//      paso 1 (docs/debug-menu-inventario.json, DebugMenu.tsx monolítico de Z69) siguen, idénticos, en su sección.
//      Los controles agregados después (Z71 en adelante) se informan y no son error
//  (d) todos los exports de debugConfig (DBG_*) conservan nombre y default respecto de la copia del inventario (los
//      campos nuevos se informan y no son error)
//      (si se cambia un default A PROPÓSITO: node scripts/debug-menu-test.mjs --actualizar-defaults)
//  (e) el índice del buscador (lib/debugIndiceControles.ts) está al día
//  (f) estado persistente: lectura y escritura con almacenamiento bloqueado o con datos inválidos
import fs from 'node:fs';
import { controles, normalizar } from './debug-menu-lib.mjs';
import { construirIndice, textoIndice } from './debug-menu-indice.mjs';
import {
  SECCIONES_DEBUG, PESTANAS_DEBUG, PESTANA_RECIENTES, ordenPestanas, seccionesDePestana, esNueva, zetasDistintas,
  ordenarSecciones, buscarSecciones, leerEstadoMenu, guardarEstadoMenu, CLAVE_MENU, N_RECIENTES, N_NUEVO,
  PESTANA_FAVORITOS, PESTANA_OBSOLETOS, seccionesFavoritas, leerFavoritos, guardarFavoritos, alternarFavorito, CLAVE_FAVORITOS,
} from '../lib/debugSecciones.ts';

let ok = 0, fallas = 0;
const check = (c, m, detalle) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); if (detalle) console.log('      ' + detalle); } };
const RUTA_INV = new URL('../../docs/debug-menu-inventario.json', import.meta.url);
const inv = JSON.parse(fs.readFileSync(RUTA_INV, 'utf8'));
const dir = new URL('../components/debug/pestanas/', import.meta.url);

// secciones dibujadas: marcas en los archivos de pestaña
const dibujadas = {};   // id → { archivo, texto, comp }
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.tsx'))) {
  const txt = fs.readFileSync(new URL(f, dir), 'utf8');
  for (const p of txt.split(/^\/\/ sección: /m).slice(1)) {
    const id = p.slice(0, p.indexOf('\n')).trim();
    const comp = /export function (\w+)\(/.exec(p)?.[1];
    dibujadas[id] = { archivo: f.replace('.tsx', ''), texto: p, comp };
  }
}
const mapa = fs.readFileSync(new URL('../components/debug/mapaSecciones.ts', import.meta.url), 'utf8');
const enMapa = Object.fromEntries([...mapa.matchAll(/^\s+"([^"]+)": (\w+),$/gm)].map(m => [m[1], m[2]]));

console.log('\n(a) registro ↔ secciones dibujadas');
{
  const reg = new Set(SECCIONES_DEBUG.map(s => s.id)), dib = new Set(Object.keys(dibujadas)), map = new Set(Object.keys(enMapa));
  const faltanReg = [...dib].filter(x => !reg.has(x)), faltanDib = [...reg].filter(x => !dib.has(x)), faltanMapa = [...reg].filter(x => !map.has(x));
  check(!faltanReg.length && !faltanDib.length, `cada sección dibujada está en el registro y viceversa (${reg.size})`, `sin registro: ${faltanReg.join(', ')} · sin dibujar: ${faltanDib.join(', ')}`);
  check(!faltanMapa.length && map.size === reg.size && [...map].every(id => enMapa[id] === dibujadas[id]?.comp), 'el mapa id → componente cubre todo el registro con el componente correcto', faltanMapa.join(', '));
  const malPestana = SECCIONES_DEBUG.filter(s => dibujadas[s.id] && dibujadas[s.id].archivo !== s.pestana).map(s => s.id);
  check(!malPestana.length, 'cada sección vive en el archivo de su pestaña', malPestana.join(', '));
  check(SECCIONES_DEBUG.every(s => PESTANAS_DEBUG.some(p => p.id === s.pestana)), 'todas las pestañas del registro existen');
  check(new Set(SECCIONES_DEBUG.map(s => s.id)).size === SECCIONES_DEBUG.length, 'ids únicos');
}

console.log('\n(b) orden por ultimoZ');
{
  const P = ordenPestanas();
  check(P[0].id === PESTANA_RECIENTES, 'la primera pestaña es Recientes');
  // Z73: Favoritos siempre segunda y Obsoletos última; el resto por última modificación
  check(P[1].id === PESTANA_FAVORITOS && P[P.length - 1].id === PESTANA_OBSOLETOS, 'Favoritos segunda y Obsoletos última (Z73)');
  const medio = P.slice(2, -1);
  check(medio.every((p, i, a) => i === 0 || a[i - 1].ultimoZ >= p.ultimoZ), `pestañas por última modificación: ${P.map(p => `${p.titulo} (Z${p.ultimoZ})`).join(' · ')}`);
  let bien = true;
  for (const p of PESTANAS_DEBUG) { const s = seccionesDePestana(p.id); for (let i = 1; i < s.length; i++) if (s[i - 1].ultimoZ < s[i].ultimoZ) bien = false; }
  check(bien, 'dentro de cada pestaña, las secciones van de ultimoZ mayor a menor');
  const Z = zetasDistintas(), rec = seccionesDePestana(PESTANA_RECIENTES);
  check(rec.length > 0 && rec.every(s => Z.slice(0, N_RECIENTES).includes(s.ultimoZ)) && SECCIONES_DEBUG.filter(s => Z.slice(0, N_RECIENTES).includes(s.ultimoZ)).length === rec.length,
    `Recientes = secciones de los últimos ${N_RECIENTES} Z distintos (${Z.slice(0, N_RECIENTES).join(', ')}): ${rec.map(s => s.id).join(', ')}`);
  check(SECCIONES_DEBUG.filter(s => esNueva(s)).every(s => Z.slice(0, N_NUEVO).includes(s.ultimoZ)), `NUEVO = últimos ${N_NUEVO} Z distintos (${Z.slice(0, N_NUEVO).join(', ')})`);
  // registro ficticio: una sección tocada en Z99 pasa a encabezar su pestaña, Recientes y el orden de pestañas
  const fict = SECCIONES_DEBUG.map(s => (s.id === 'telon-n6' ? { ...s, ultimoZ: 99 } : s));
  check(ordenPestanas(fict)[2].id === 'telon' && seccionesDePestana('telon', fict)[0].id === 'telon-n6' && seccionesDePestana(PESTANA_RECIENTES, fict)[0].id === 'telon-n6' && esNueva(fict.find(s => s.id === 'telon-n6'), fict),
    'al subir ultimoZ de una sección (prueba con Z99) se ordena sola: primera de su pestaña, de Recientes y su pestaña primera, con NUEVO');
  check(ordenarSecciones(SECCIONES_DEBUG).length === SECCIONES_DEBUG.length, 'ordenar no pierde secciones');
  const b = buscarSecciones('ESCALA', { 'composicion-del-domo-z49': ['ESCALA'] });
  check(b.some(r => r.seccion.id === 'composicion-del-domo-z49' && r.coincidencias.includes('ESCALA')) && buscarSecciones('  ', {}).length === 0, 'buscador: encuentra por nombre de control; vacío = sin resultados');
  check(buscarSecciones('telon', {}).some(r => r.seccion.id === 'telon-n6'), 'buscador: sin distinguir tildes ni mayúsculas (telon → "Telón N6")');
}

console.log('\n(c) ningún control perdido');
{
  // Z73: secciones fusionadas o movidas (id del inventario → id actual) y controles que cambiaron de sección
  const REUBICADAS = {
    'panorama-t2-crecimiento-de-grupos': 'panorama-svg', 'u4-sol': 'panorama-svg', 'u4-montanas': 'panorama-svg', 'u4-cielo': 'panorama-svg',
    'u4-lineas': 'panorama-svg', 'u5-lineas-liquidas': 'panorama-svg', 'u7-capas-visibles': 'panorama-svg', 'u10a-parallax-por-capa': 'panorama-svg',
    'aa1-domo-original': 'panorama-svg',
    'w1-domo-de-shader': 'shader-del-domo', 'w2-multiplicadores-de-grupo': 'shader-del-domo', 'w4-domesky-ajuste-de-shader': 'shader-del-domo',
    'w5-siluetas-suaves': 'shader-del-domo', 'x2-domo-diagnostico': 'shader-del-domo',
    'u9-secuencia-amanecer': 'amanecer-viejo', 'w3-amanecer-domesky': 'amanecer-viejo',
    'paneles-sillas-p1': 'paneles-sillas', 'orbitas-z7-paneles-sillas': 'paneles-sillas', 'linterna-z2-paneles-sillas': 'paneles-sillas',
  };
  const MOVIDOS = { 'cielo-estrellado-z30': ['camino-luz-z28'], 'prism-proximity': ['controles-sin-efecto'] };   // controles sueltos
  // Z73: botones repetidos del día que pasaron a ser atajos de lib/controlDia.ts (misma lógica, ya no duplicada)
  const ATAJOS = [
    { viejo: 'DBG_DIA.VELOCIDAD = 24', texto: '>Probar flor</button>' }, { viejo: '{ DBG_DIA.VELOCIDAD = 1; tocarDia(); }}>velocidad 1', texto: '>velocidad 1</button>' },
    { viejo: 'irACheckpoint("dia_flor")', texto: '>Mostrar base con flor</button>' }, { viejo: 'DBG_DIA.VELOCIDAD = 3', texto: '>Animar nacimiento</button>' },
    { viejo: 'base-flor-reiniciar")); tocarDia(); }}>Reiniciar', texto: '>Reiniciar</button>' },
  ];
  const disponibles = {};
  for (const [id, d] of Object.entries(dibujadas)) disponibles[id] = controles(d.texto).map(c => c.firma);
  const total = Object.values(disponibles).reduce((a, l) => a + l.length, 0);
  let presentes = 0, atajos = 0; const malos = [];
  const tomar = (id, f) => { const l = disponibles[id]; const i = l ? l.indexOf(f) : -1; if (i < 0) return false; l.splice(i, 1); return true; };
  for (const s of inv.secciones) {
    const destinos = [REUBICADAS[s.id] ?? s.id, ...(MOVIDOS[s.id] ?? [])];
    for (const f of s.firmas) {
      if (destinos.some(d => tomar(d, f))) { presentes++; continue; }
      const a = ATAJOS.find(x => f.includes(x.viejo));
      const destino = REUBICADAS[s.id] ?? s.id;
      const nuevo = a && (disponibles[destino] ?? []).find(n => n.includes(a.texto) && n.includes('atajo · Control del día'));
      if (nuevo) { tomar(destino, nuevo); presentes++; atajos++; continue; }
      malos.push(`${s.id}: falta ${f.slice(0, 90)}`);
    }
  }
  check(!malos.length && presentes === inv.controlesEnSecciones, `los ${inv.controlesEnSecciones} controles del inventario están en su sección o en la que los reunió (${presentes}; ${atajos} convertidos en atajos)`, malos.slice(0, 5).join(' | '));
  check(atajos === ATAJOS.length, `los ${ATAJOS.length} botones repetidos del día son atajos marcados de lib/controlDia.ts`);
  console.log(`      controles dibujados ahora: ${total} (agregados después del inventario: ${total - presentes})`);
  const menu = fs.readFileSync(new URL('../components/DebugMenu.tsx', import.meta.url), 'utf8');
  check(normalizar(menu).includes(normalizar('<button style={{ ...INPUT, opacity: 0.4, cursor: "not-allowed" }} disabled>off</button>')),
    'el control del premio (mapa de decisiones) sigue en el contenedor');
  const comun = fs.readFileSync(new URL('../components/debug/comun.tsx', import.meta.url), 'utf8');
  check(/requiereRecargar\(note\) && <span style=\{RECARGA\}/.test(comun) && /onChange \? INPUT : INPUT_LECTURA/.test(comun), 'indicadores: ⟳ en los que piden recargar y estilo propio para los de solo lectura (Z73)');
}

console.log('\n(d) DBG_* con sus nombres y defaults');
{
  const cfg = await import('../lib/debugConfig.ts');
  const actual = {};
  for (const [k, v] of Object.entries(cfg)) actual[k] = JSON.parse(JSON.stringify(v ?? null));
  if (process.argv.includes('--actualizar-defaults')) {
    inv.defaults = actual; fs.writeFileSync(RUTA_INV, JSON.stringify(inv, null, 1)); console.log('  (copia de defaults actualizada)');
  }
  const faltan = Object.keys(inv.defaults).filter(k => !(k in actual));
  check(!faltan.length, `los ${Object.keys(inv.defaults).length} exports de debugConfig siguen existiendo con el mismo nombre`, faltan.join(', '));
  const distintos = [], nuevosCampos = [];
  const cmp = (a, b, ruta) => {
    if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) { distintos.push(ruta); return; }
    if (a && typeof a === 'object') { for (const k of Object.keys(a)) if (!(k in b)) distintos.push(`${ruta}.${k} (falta)`); else cmp(a[k], b[k], `${ruta}.${k}`); for (const k of Object.keys(b)) if (!(k in a)) nuevosCampos.push(`${ruta}.${k}`); return; }
    if (a !== b) distintos.push(`${ruta} (${JSON.stringify(a)} → ${JSON.stringify(b)})`);
  };
  for (const k of Object.keys(inv.defaults)) if (k in actual) cmp(inv.defaults[k], actual[k], k);
  check(!distintos.length, 'ningún default ni campo existente cambió', distintos.slice(0, 6).join(' · '));
  console.log(`      campos nuevos después del inventario: ${nuevosCampos.length}${nuevosCampos.length ? ` (${nuevosCampos.slice(0, 4).join(', ')}${nuevosCampos.length > 4 ? '…' : ''})` : ''}`);
}

console.log('\n(e) índice del buscador');
{
  const actual = fs.readFileSync(new URL('../lib/debugIndiceControles.ts', import.meta.url), 'utf8');
  check(actual === textoIndice(construirIndice()), 'lib/debugIndiceControles.ts al día (si no: node scripts/debug-menu-indice.mjs)');
}

console.log('\n(f) estado persistente');
{
  const mem = {}; const st = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
  check(leerEstadoMenu(st) === null && guardarEstadoMenu(st, { pestana: 'pasto', plegadas: { legado: false } }) && leerEstadoMenu(st).pestana === 'pasto' && leerEstadoMenu(st).plegadas.legado === false,
    'guarda y lee la pestaña y las secciones plegadas');
  mem[CLAVE_MENU] = '{"pestana":"no-existe","plegadas":{"a":1,"b":true}}';
  const e = leerEstadoMenu(st);
  check(e.pestana === PESTANA_RECIENTES && !('a' in e.plegadas) && e.plegadas.b === true, 'pestaña inexistente → Recientes; valores no booleanos se ignoran');
  mem[CLAVE_MENU] = '{roto'; check(leerEstadoMenu(st) === null, 'JSON roto → null');
  const roto = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  check(leerEstadoMenu(roto) === null && guardarEstadoMenu(roto, { pestana: 'x', plegadas: {} }) === false && leerEstadoMenu(null) === null, 'almacenamiento bloqueado o ausente (SSR): sin errores');
}

console.log('\n(g) Z73: favoritos y obsoletos');
{
  const mem = {}; const st = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
  let f = leerFavoritos(st);
  f = alternarFavorito(f, 'pasto-z64'); f = alternarFavorito(f, 'telon-n6'); guardarFavoritos(st, f);
  check(JSON.stringify(leerFavoritos(st)) === '["pasto-z64","telon-n6"]' && JSON.parse(mem[CLAVE_FAVORITOS]).length === 2, 'fijar y guardar favoritos (clave propia)');
  check(alternarFavorito(f, 'pasto-z64').join() === 'telon-n6', 'quitar un favorito');
  mem[CLAVE_FAVORITOS] = '["no-existe","pasto-z64",3]';
  check(leerFavoritos(st).join() === 'pasto-z64' && seccionesFavoritas(['pasto-z64', 'x']).map(s => s.id).join() === 'pasto-z64', 'ids inexistentes o inválidos se ignoran');
  const roto = { getItem() { throw 0; }, setItem() { throw 0; } };
  check(leerFavoritos(roto).length === 0 && !guardarFavoritos(roto, ['a']), 'almacenamiento bloqueado: sin errores');
  const obs = SECCIONES_DEBUG.filter(s => s.pestana === PESTANA_OBSOLETOS);
  check(obs.length >= 5 && obs.every(s => s.clase === 'obsoleta' && s.avanzada && s.etiqueta && s.flagApaga), `Obsoletos: ${obs.map(s => s.titulo).join(', ')} (plegadas, con etiqueta y flag)`);
  check(SECCIONES_DEBUG.filter(s => s.clase === 'obsoleta').every(s => s.pestana === PESTANA_OBSOLETOS), 'todas las secciones obsoletas están en Obsoletos');
  const t = id => SECCIONES_DEBUG.find(s => s.id === id)?.titulo;
  check(t('sol-n3') === 'Sol de la sala (N3)' && t('sol-nuevo-z51') === 'Sol del cielo (Z51)' && t('debug-overlays') === 'Overlays del prisma, audio y efectos (R1)', 'nombres que se distinguen (Z73)');
}

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
