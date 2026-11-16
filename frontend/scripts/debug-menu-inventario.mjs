// Z70: inventario del menú de debug (paso 1). Analiza el DebugMenu.tsx MONOLÍTICO (el de antes de la reorganización:
// por defecto, el del commit indicado en BASE) y escribe docs/debug-menu-inventario.json: secciones, controles (con su
// firma, para que scripts/debug-menu-test.mjs verifique que no se perdió ninguno), Z de origen y de última modificación
// (comentarios del código + git blame con el número Z del mensaje del commit) y los defaults de todos los DBG_*.
// Uso (en frontend/): node scripts/debug-menu-inventario.mjs [commit]   (se corrió una vez, en Z70)
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { seccionesMonoliticas, controles, zetas, nombresControles } from './debug-menu-lib.mjs';

const BASE = process.argv[2] || '9470cea';   // commit de seguridad de Z69, antes de reorganizar
const RUTA = 'frontend/components/DebugMenu.tsx';
const raiz = execSync('git rev-parse --show-toplevel').toString().trim();
const src = execSync(`git show ${BASE}:${RUTA}`, { cwd: raiz, maxBuffer: 1 << 26 }).toString();

// git blame: Z de cada línea según el mensaje del commit ("… (Z65 …) antes de Z66" → 65; sin Z → 0)
const blame = execSync(`git blame --line-porcelain ${BASE} -- ${RUTA}`, { cwd: raiz, maxBuffer: 1 << 28 }).toString().split('\n');
const zLinea = [], resumen = {};
let hash = '';
for (const l of blame) {
  const m = /^([0-9a-f]{40}) \d+ (\d+)/.exec(l);
  if (m) { hash = m[1]; zLinea[Number(m[2])] = hash; continue; }
  if (l.startsWith('summary ')) resumen[hash] = l.slice(8);
}
const zDeCommit = h => { const m = /Z(\d{1,3})/.exec(resumen[h] || ''); return m ? Number(m[1]) : 0; };

const slug = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

const S = seccionesMonoliticas(src);
const ids = new Set();
const secciones = S.map(s => {
  let id = slug(s.titulo) || 'seccion';
  while (ids.has(id)) id += '-2';
  ids.add(id);
  const c = controles(s.texto);
  const porTipo = {};
  for (const x of c) porTipo[x.tipo] = (porTipo[x.tipo] || 0) + 1;
  const zc = zetas(s.texto);
  const zb = [];
  for (let n = s.desde; n <= s.hasta; n++) { const z = zDeCommit(zLinea[n]); if (z) zb.push(z); }
  const dbg = [...new Set([...s.texto.matchAll(/\bDBG_[A-Z_]+\b/g)].map(m => m[0]))];
  return {
    id, titulo: s.titulo, pestanaVieja: s.tab, lineas: [s.desde, s.hasta], dbg,
    controles: c.length, porTipo, firmas: c.map(x => x.firma), nombres: nombresControles(s.texto),
    zComentarios: zc.length ? [Math.min(...zc), Math.max(...zc)] : null,
    zBlame: zb.length ? [Math.min(...zb), Math.max(...zb)] : null,
  };
});

// defaults de todos los exports de debugConfig (en el commit BASE)
const cfgSrc = execSync(`git show ${BASE}:frontend/lib/debugConfig.ts`, { cwd: raiz, maxBuffer: 1 << 26 }).toString();
const tmp = new URL('../.debug-config-base.ts', import.meta.url);
fs.writeFileSync(tmp, cfgSrc);
const cfg = await import(tmp.href);
fs.unlinkSync(tmp);
const defaults = {};
for (const [k, v] of Object.entries(cfg)) defaults[k] = JSON.parse(JSON.stringify(v ?? null));

const todos = controles(src);
const out = {
  generado: new Date().toISOString().slice(0, 10), base: BASE,
  lineasDebugMenu: src.split('\n').length, lineasDebugConfig: cfgSrc.split('\n').length,
  objetosDBG: Object.keys(cfg).filter(k => k.startsWith('DBG_')).length, exports: Object.keys(cfg).length,
  controlesEnSecciones: secciones.reduce((a, s) => a + s.controles, 0), controlesEnArchivo: todos.length,
  secciones, defaults,
};
fs.writeFileSync(new URL('../../docs/debug-menu-inventario.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(`${secciones.length} secciones · ${out.controlesEnSecciones} controles en secciones (${todos.length} en el archivo) · ${out.objetosDBG} DBG_* · ${out.lineasDebugMenu} líneas`);
