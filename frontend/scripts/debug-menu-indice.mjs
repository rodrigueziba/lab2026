// Z70: genera lib/debugIndiceControles.ts (nombres de los controles de cada sección, para el buscador del menú de
// debug) a partir de components/debug/pestanas/*.tsx (marcas "// sección: <id>"). La sección que monta
// <RendimientoPanel /> suma los nombres de components/RendimientoPanel.tsx.
// Uso (en frontend/): node scripts/debug-menu-indice.mjs        · --verificar: falla si el archivo no está al día
import fs from 'node:fs';
import { nombresControles } from './debug-menu-lib.mjs';

export function construirIndice(base = new URL('..', import.meta.url)) {
  const dir = new URL('components/debug/pestanas/', base);
  const indice = {};
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.tsx')).sort()) {
    const txt = fs.readFileSync(new URL(f, dir), 'utf8');
    const partes = txt.split(/^\/\/ sección: /m).slice(1);
    for (const p of partes) {
      const id = p.slice(0, p.indexOf('\n')).trim();
      let nombres = nombresControles(p);
      if (/<RendimientoPanel\s*\/>/.test(p)) nombres = [...new Set([...nombres, ...nombresControles(fs.readFileSync(new URL('components/RendimientoPanel.tsx', base), 'utf8'))])];
      indice[id] = nombres;
    }
  }
  return indice;
}
export function textoIndice(indice) {
  const filas = Object.keys(indice).sort().map(id => `  ${JSON.stringify(id)}: ${JSON.stringify(indice[id])},`);
  return ['// Z70: GENERADO por scripts/debug-menu-indice.mjs (no editar a mano). Nombres de los controles de cada sección del',
    '// menú de debug, para el buscador. Se regenera con: node scripts/debug-menu-indice.mjs',
    'export const INDICE_CONTROLES: Record<string, readonly string[]> = {', ...filas, '};', ''].join('\n');
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const salida = new URL('../lib/debugIndiceControles.ts', import.meta.url);
  const txt = textoIndice(construirIndice());
  if (process.argv.includes('--verificar')) {
    const actual = fs.existsSync(salida) ? fs.readFileSync(salida, 'utf8') : '';
    if (actual !== txt) { console.error('lib/debugIndiceControles.ts no está al día: correr node scripts/debug-menu-indice.mjs'); process.exit(1); }
    console.log('índice al día');
  } else { fs.writeFileSync(salida, txt); console.log('lib/debugIndiceControles.ts:', Object.keys(construirIndice()).length, 'secciones'); }
}
