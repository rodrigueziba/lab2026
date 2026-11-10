// scripts/ink-build.mjs
// Uso: node scripts/ink-build.mjs   (o: npm run ink:build, desde frontend/)
// 1) Compila docs/dialogos/dialogo-luz.ink -> public/alight/dialogo/dialogo-luz.json (para inkjs)
// 2) Genera docs/dialogos/MAPA_DIALOGOS.md (tabla + diagrama Mermaid) y docs/dialogos/mapa.mmd
// Depende de las convenciones descritas en la cabecera del .ink.
// Z26: rutas adaptadas al repo: el script vive en frontend/scripts; public/ es frontend/public y
// docs/ está en la raíz del repo (frontend/..). La lógica y las convenciones de tags no cambian.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Compiler } from 'inkjs/full';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // frontend/
const repo = path.resolve(root, '..');                                          // raíz del repo
const inkPath = path.join(repo, 'docs/dialogos/dialogo-luz.ink');
const jsonOut = path.join(root, 'public/alight/dialogo/dialogo-luz.json');
const mdOut = path.join(repo, 'docs/dialogos/MAPA_DIALOGOS.md');
const mmdOut = path.join(repo, 'docs/dialogos/mapa.mmd');

const src = fs.readFileSync(inkPath, 'utf8');

// ---- 1) compilar ----
const errors = [];
const compiler = new Compiler(src, { errorHandler: (m, t) => errors.push(`[${t}] ${m}`) });
const story = compiler.Compile();
if (errors.length) { console.error('Errores de ink:\n' + errors.join('\n')); process.exit(1); }
fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
fs.writeFileSync(jsonOut, story.ToJson());

// ---- 2) analizar knots ----
const knots = new Map();
let cur = null;
for (const raw of src.split(/\r?\n/)) {
  const line = raw.trim();
  const k = line.match(/^===\s*(\w+)\s*===?$/);
  if (k) { cur = { name: k[1], tags: {}, text: [], opts: [], goto: null, ends: false }; knots.set(cur.name, cur); continue; }
  if (!cur || !line || line.startsWith('//')) continue;
  const t = line.match(/^#\s*(\w+)\s*:\s*(.+)$/);
  if (t) { cur.tags[t[1]] = t[2].trim(); continue; }
  const o = line.match(/^\*\s*\[(.+)\]\s*->\s*(\w+)\s*$/);
  if (o) { cur.opts.push({ text: o[1], to: o[2] }); continue; }
  if (line === '-> END') { cur.ends = true; continue; }
  const d = line.match(/^->\s*(\w+)\s*$/);
  if (d) { cur.goto = d[1]; continue; }
  if (line.startsWith('~')) continue;
  cur.text.push(line);
}
const list = [...knots.values()].filter(k => k.tags.id);
const idOf = n => knots.get(n)?.tags.id ?? n;
const natural = (a, b) => a.tags.id.localeCompare(b.tags.id, undefined, { numeric: true });
list.sort(natural);
const short = (s, n = 38) => (s.length > n ? s.slice(0, n - 1) + '…' : s).replace(/"/g, "'").replace(/\*/g, '');
const estado = k => k.tags.estado;
const cerradas = list.filter(k => estado(k) === 'cerrado');
const pendientes = list.filter(k => estado(k) === 'pendiente');
const efectos = list.filter(k => k.tags.efecto);

let md = `# Mapa de diálogos — camino LUZ (generado)\n\n`;
md += `> Archivo generado por \`scripts/ink-build.mjs\` desde \`docs/dialogos/dialogo-luz.ink\`. No lo edites a mano: editá el .ink (tags \`# estado:\`) y volvé a correr el script.\n\n`;
md += `**Resumen:** ${list.length} líneas · ${cerradas.length} cerradas · ${pendientes.length} pendientes · ${efectos.length} con efecto del juego.\n\n`;
md += `## Líneas\n\n| ID | Nodo | Dice la entidad | Estado | Efecto | Opciones → destino |\n|---|---|---|---|---|---|\n`;
for (const k of list) {
  const opts = k.opts.map((o, i) => `${'abcd'[i]}) ${short(o.text, 28)} → ${idOf(o.to)}`).join('<br>') || (k.goto ? `→ ${idOf(k.goto)}` : '—');
  md += `| ${k.tags.id} | \`${k.name}\` | ${k.text.join(' ').replace(/\|/g, '/') || '—'} | ${estado(k) === 'cerrado' ? '✅ cerrada' : '🟧 pendiente'} | ${k.tags.efecto ?? '—'} | ${opts} |\n`;
}
md += `\n## Pendientes por completar\n\n` + pendientes.map(k => `- [ ] **${k.tags.id}** (\`${k.name}\`)`).join('\n') + '\n';
md += `\n## Efectos del juego (los ejecuta el código, no ink)\n\n` + efectos.map(k => `- **${k.tags.id}** → \`${k.tags.efecto}\``).join('\n') + '\n';

// ---- diagrama Mermaid ----
let m = `flowchart TD\n`;
const nid = n => 'N_' + n;
for (const k of list) {
  const label = `${k.tags.id}<br/>${short(k.text.join(' ') || (k.tags.efecto ? '⚙ ' + k.tags.efecto : '(sin texto)'), 34)}`;
  const cls = k.tags.efecto ? 'efecto' : estado(k) === 'pendiente' ? 'pendiente' : 'cerrado';
  m += `  ${nid(k.name)}["${label}"]:::${cls}\n`;
}
for (const k of list) for (const o of k.opts) if (knots.get(o.to)?.tags.id) m += `  ${nid(k.name)} -->|"${short(o.text, 22)}"| ${nid(o.to)}\n`;
m += `  classDef cerrado fill:#2E9E5B,stroke:#12101A,color:#fff;\n  classDef pendiente fill:#F4B62E,stroke:#12101A,color:#12101A;\n  classDef efecto fill:#1F7FB8,stroke:#12101A,color:#fff;\n`;
md += `\n## Diagrama\n\nVerde = cerrada · Amarillo = pendiente · Azul = dispara un efecto del juego.\n\n\`\`\`mermaid\n${m}\`\`\`\n`;
fs.writeFileSync(mdOut, md);
fs.writeFileSync(mmdOut, m);
console.log(`OK: ${list.length} líneas (${cerradas.length} cerradas, ${pendientes.length} pendientes, ${efectos.length} con efecto).`);
