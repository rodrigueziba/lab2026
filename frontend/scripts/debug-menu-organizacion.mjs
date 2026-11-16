// Z73: organización actual del menú de debug. Recalcula, a partir de components/debug/pestanas/*.tsx (marcas
// "// sección:" y "// subsección:") y de lib/debugSecciones.ts, qué secciones hay, en qué pestaña, cuántos controles
// tienen y de qué partes están hechas; lo guarda en docs/debug-menu-inventario.json (clave "organizacion", sin tocar la
// base de Z70 que usa scripts/debug-menu-test.mjs) y reescribe docs/DEBUG_MENU_INVENTARIO.md.
// Uso (en frontend/): node scripts/debug-menu-organizacion.mjs
import fs from 'node:fs';
import { controles } from './debug-menu-lib.mjs';
import { SECCIONES_DEBUG, PESTANAS_DEBUG, ordenPestanas, seccionesDePestana, zetasDistintas, N_RECIENTES } from '../lib/debugSecciones.ts';

const RAIZ = new URL('..', import.meta.url), DOCS = new URL('../../docs/', import.meta.url);
const RUTA_JSON = new URL('debug-menu-inventario.json', DOCS), RUTA_MD = new URL('DEBUG_MENU_INVENTARIO.md', DOCS);
const inv = JSON.parse(fs.readFileSync(RUTA_JSON, 'utf8'));
const dir = new URL('components/debug/pestanas/', RAIZ);

// secciones dibujadas y sus partes
const dib = {};
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.tsx')).sort()) {
  const txt = fs.readFileSync(new URL(f, dir), 'utf8');
  for (const p of txt.split(/^\/\/ sección: /m).slice(1)) {
    const id = p.slice(0, p.indexOf('\n')).trim();
    const partes = [...p.matchAll(/^\/\/ subsección: (\S+)/gm)].map(m => m[1]);
    const porTipo = {};
    for (const c of controles(p)) porTipo[c.tipo] = (porTipo[c.tipo] || 0) + 1;
    dib[id] = { archivo: f, controles: controles(p).length, porTipo, partes };
  }
}
const lineas = rel => fs.readFileSync(new URL(rel, RAIZ), 'utf8').split('\n').length;
const archivosMenu = ['components/DebugMenu.tsx', 'components/debug/comun.tsx', 'components/debug/estado.tsx', 'components/debug/contexto.ts', 'components/debug/mapaSecciones.ts',
  ...fs.readdirSync(dir).filter(x => x.endsWith('.tsx')).map(x => 'components/debug/pestanas/' + x)];
const organizacion = {
  generado: new Date().toISOString().slice(0, 10),
  lineas: Object.fromEntries(archivosMenu.map(a => [a, lineas(a)])),
  lineasDebugConfig: lineas('lib/debugConfig.ts'),
  pestanas: ordenPestanas().map(p => p.id),
  secciones: SECCIONES_DEBUG.map(s => ({ ...s, controles: dib[s.id]?.controles ?? 0, porTipo: dib[s.id]?.porTipo ?? {}, partes: dib[s.id]?.partes ?? [], archivo: dib[s.id]?.archivo ?? '' })),
};
organizacion.controles = organizacion.secciones.reduce((a, s) => a + s.controles, 0);
inv.organizacion = organizacion;
fs.writeFileSync(RUTA_JSON, JSON.stringify(inv, null, 1));

// ── markdown ──
const z = n => (n > 0 ? `Z${n}` : 'pre-Z');
const titP = id => ({ recientes: 'Recientes', favoritos: 'Favoritos' })[id] ?? PESTANAS_DEBUG.find(p => p.id === id)?.titulo ?? id;
const tipos = {};
for (const s of organizacion.secciones) for (const [k, v] of Object.entries(s.porTipo)) tipos[k] = (tipos[k] || 0) + v;
const total = Object.values(organizacion.lineas).reduce((a, b) => a + b, 0);
const cl = c => organizacion.secciones.filter(s => s.clase === c);
const titulosInv = Object.fromEntries(inv.secciones.map(s => [s.id, s.titulo]));
const L = [];
L.push('# Inventario del menú de debug', '');
L.push(`Organización actual (Z73), generada con \`node scripts/debug-menu-organizacion.mjs\` el ${organizacion.generado}. Datos completos en`,
  '`docs/debug-menu-inventario.json`: `organizacion` (esta foto) y `secciones` (la base de Z70: el `DebugMenu.tsx` monolítico del',
  `commit \`${inv.base}\`, con la firma de cada control; la usa \`scripts/debug-menu-test.mjs\` para verificar que no se perdió ninguno).`, '');
L.push('## a) Tamaño', '');
L.push('| | Antes (Z69) | Ahora |', '|---|---|---|');
L.push(`| Código del menú | \`DebugMenu.tsx\`: ${inv.lineasDebugMenu} líneas | ${archivosMenu.length} archivos, ${total} líneas (\`DebugMenu.tsx\` ${organizacion.lineas['components/DebugMenu.tsx']}) |`);
L.push(`| \`lib/debugConfig.ts\` | ${inv.lineasDebugConfig} líneas | ${organizacion.lineasDebugConfig} líneas |`);
L.push(`| Secciones | ${inv.secciones.length} | ${organizacion.secciones.length} (las fusionadas cuentan como una) |`);
L.push(`| Controles en secciones | ${inv.controlesEnSecciones} | ${organizacion.controles} (ninguno perdido; los agregados son de Z71 a Z73) |`);
L.push(`| Pestañas | 2 (SILLAS, TARIMA) | ${organizacion.pestanas.length}: ${organizacion.pestanas.map(titP).join(', ')} |`, '');
L.push(`Controles por tipo: numéricos ${tipos.numero || 0} · interruptores ${tipos.interruptor || 0} · botones ${tipos.boton || 0} · sliders ${tipos.slider || 0} · color ${tipos.color || 0} · selectores ${tipos.selector || 0} · campos ${tipos.campo || 0} · panel de rendimiento ${tipos.panel || 0}.`, '');
L.push('## b) Secciones por pestaña', '');
L.push('Orden real: Recientes (las de los últimos 5 Z distintos), Favoritos (las fijadas con ☆), el resto por la última modificación de', 'sus secciones, y Obsoletos al final. Dentro de cada pestaña, por `ultimoZ` de mayor a menor.', '');
for (const p of organizacion.pestanas.filter(p => p !== 'recientes' && p !== 'favoritos')) {
  L.push(`### ${titP(p)}`, '', '| Sección | Controles | Origen | Última | Clase | Partes |', '|---|---|---|---|---|---|');
  for (const s of seccionesDePestana(p)) {
    const o = organizacion.secciones.find(x => x.id === s.id);
    const partes = o.partes.length ? o.partes.map(x => titulosInv[x] ?? x).join(' · ') : '';
    const clase = `${s.clase}${s.avanzada ? ' · plegada' : ''}${s.etiqueta ? ` · ${s.etiqueta}` : ''}`;
    L.push(`| ${s.titulo} | ${o.controles} | ${z(s.desdeZ)} | ${z(s.ultimoZ)} | ${clase} | ${partes} |`);
  }
  L.push('');
}
L.push(`Recientes hoy: ${seccionesDePestana('recientes').map(s => s.titulo).join(', ')} (Z ${zetasDistintas().slice(0, N_RECIENTES).join(', ')}).`, '');
L.push('## c) Clasificación', '');
for (const [c, n] of [['frecuente', 'Frecuente (se retoca al ajustar el aspecto)'], ['ocasional', 'Ocasional (pruebas, simulación, saltos)'], ['tecnica', 'Técnica o avanzada'], ['obsoleta', 'Obsoleta (en la pestaña Obsoletos)']])
  L.push(`- **${n}**: ${cl(c).length}${c === 'obsoleta' || c === 'ocasional' ? `: ${cl(c).map(s => s.titulo).join(', ')}` : ''}.`);
L.push('');
L.push('## d) Cambios de Z73 y lo que sigue repetido', '');
L.push('- **Movidos**: los controles de `DBG_LUZ` del final de "Cielo estrellado Z30" (EXTERIOR_RADIO_M, AREA_HIST_M, ACTIVACION_M,',
  '  ACTIVACION_SALIDA_M, GIRO_MS, PITCH_MAX_DEG, CIERRE_DIALOGO_MS, TELEPORT_DIST_M, LUZ_COLOR) pasaron a "Camino LUZ Z28";',
  '  `prismRangeScale` (sin efecto) pasó de "Prism proximity" a Obsoletos › Controles sin efecto.',
  '- **Renombrados**: "Sol N3" → "Sol de la sala (N3)", "Sol nuevo Z51" → "Sol del cielo (Z51)", "Debug overlays" (R1) →',
  '  "Overlays del prisma, audio y efectos (R1)", "Debug overlays (mode/lock/hover)" de Lecterns → "Overlays de atriles".',
  '- **Fusionados** (cada parte conserva su título como subtítulo): Panorama SVG (apagado), Shader del domo, Amanecer viejo,',
  '  Paneles SILLAS.',
  '- **Control del día** (nuevo): T_MANUAL, VELOCIDAD, ir a una etapa, checkpoints del día y las acciones de la flor, todo en',
  '  `lib/controlDia.ts`. Los botones de "Prisma y flor" y "Base de la flor" quedaron como atajos a esas mismas funciones.',
  '- **Sigue repetido a propósito**: T_MANUAL y VELOCIDAD también están en la lista de "Ciclo de día" (no se quita ningún control);',
  '  VELOCIDAD de "Movimiento" es otro objeto (`DBG_MOV`). Los saltos a checkpoints del día también están en "Checkpoints Z40".',
  '- **Indicadores**: ⟳ en los controles que piden recargar o remontar; los de solo lectura van sin caja, punteados y en gris.', '');
L.push('## e) Costo del menú', '');
L.push('- Antes de Z70: ~640 controles dibujados de una vez, ~20 renders por segundo con el menú abierto y ~16 actualizaciones de',
  '  estado por segundo con el menú cerrado.',
  '- Desde Z70: solo se dibuja la pestaña activa (o los resultados del buscador); con el menú cerrado no corre ningún intervalo.', '');
L.push('## f) Candidatas a borrar más adelante (no se borró nada)', '');
L.push('| Candidata | Qué la deja sin efecto | De qué depende |', '|---|---|---|');
L.push('| Legado (FloorVisualizer, SectorAudioFX) | `LEGACY_FLOOR_TEXTURES_ENABLED`, `LEGACY_SECTOR_AUDIO_ENABLED` = false | `components/FloorVisualizer.tsx`, `SectorAudioFX.tsx`, `DBG_FLOOR`, `DBG_EFFECTS`; montaje en `ExperienceDome.tsx` |');
L.push('| Panorama SVG (T2, U4, U5, U7, U10A, AA1) | `DBG_SILLAS.usarDomoShader` true y `domoOriginal` false | `components/VizPanorama.tsx`, `public/alight/visualizer/*.svg`, campos `viz*` y `u4*`…`u10*` de `DBG_SILLAS`; `domoOriginal` lo vuelve a encender (AA1) |');
L.push('| Amanecer viejo (U9, W3) | `DBG_AMANECER.UNIFICADO` = true | máquinas viejas de `alightStore` (U9) y de `DomeSky` (W3); con `UNIFICADO` false vuelven. Sus fases 2 y paletas todavía se leen |');
L.push('| Prism (info) | solo lectura | `DBG_PRISM.landOffset` (se usa en Prism.tsx: no borrar el campo) |');
L.push('| `prismRangeScale` | legacy N1, ya no se aplica | campo de `DBG_PRISM`; buscar usos antes de quitarlo |');
L.push('| Reloj de la experiencia: `RELOJ_UNIFICADO` false | camino viejo de tiempos | `lib/relojExperiencia.ts`, `Prism`, `ExperienceDome`, `linternaPaneles`, `ThreeScene` |');
L.push('| Ciclo de día: `DBG_DIA.NUEVO` false | amanecer de 10 s de Z38 | `lib/cicloDia.ts`, `DomeSky` (uDiaNuevo), `CicloDiaEscena` |');
L.push('| Cielo estrellado: `ESTRELLAS_MODO_VIEJO`, `ESTRELLAS_MODO_Z30` | modos anteriores del cielo | `components/CieloEstrellado.tsx`, `lib/luz/estrellasCielo.glsl.ts` |');
L.push('| `MONOLITOS_CAPTURA` (Amanecer Z38) | false por defecto (colores falsos al completar) | captura del reflejo en `Monoliths.tsx` |');
L.push('| Bloom Unreal (`BLOOM_OPTIMIZADO` false), pases separados (`PASES_FUSIONADOS` false), `ACES_RAPIDO`, `FXAA_LIGERO` | flags de comparación de Z69 y Z72 | `components/RetroPostFX.tsx`, `lib/retro/paseFinal.ts` |', '');
fs.writeFileSync(RUTA_MD, L.join('\n') + '\n');
console.log(`organización: ${organizacion.secciones.length} secciones · ${organizacion.controles} controles · ${organizacion.pestanas.length} pestañas`);
