// Z68: prueba del nombre de la empresa de la ficción. Correr en frontend/: node scripts/marca-test.mjs
// 1) lib/marca.ts tiene los valores esperados (NOMBRE_EMPRESA y su variante en mayúsculas).
// 2) Ningún texto visible del código de la experiencia (app, components, lib, hooks, public) dice "austral":
//    se quitan los comentarios y los identificadores permitidos (EXCEPCIONES) y se busca lo que queda.
//    Fuera del recorrido: node_modules, .next, docs/, CREDITOS.md (documentación: no se toca).
// 3) Los archivos que mostraban el nombre usan la constante (NOMBRE_EMPRESA o NOMBRE_EMPRESA_MAYUS).
// 4) Diálogos ink: ni la fuente (.ink) ni el compilado (.json) dicen "austral", y cada vez que la fuente nombra a la
//    empresa el compilado también la nombra (hoy el diálogo no la nombra: la comprobación queda lista para cuando lo haga).
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { NOMBRE_EMPRESA, NOMBRE_EMPRESA_MAYUS } from "../lib/marca.ts";

let fallas = 0, oks = 0;
const ok = (c, msg) => { if (c) { oks++; console.log("OK  ", msg); } else { fallas++; console.log("FALLA", msg); } };

// ── 1) constante ────────────────────────────────────────────────────────────────────────────────────────────────────
ok(NOMBRE_EMPRESA === "In-Go's Wan Inc.", `NOMBRE_EMPRESA = ${JSON.stringify(NOMBRE_EMPRESA)}`);
ok(NOMBRE_EMPRESA_MAYUS === "IN-GO'S WAN INC.", `NOMBRE_EMPRESA_MAYUS = ${JSON.stringify(NOMBRE_EMPRESA_MAYUS)}`);
ok(!/[‘’"]/.test(NOMBRE_EMPRESA), "apóstrofo recto y sin comillas");

// ── 2) sin "austral" en textos visibles ─────────────────────────────────────────────────────────────────────────────
// EXCEPCIONES: identificadores internos que pueden contener "austral" (no se muestran). Agregar acá con su motivo.
const EXCEPCIONES = [
  /\bAUSTRAL_BASE\b/g,   // lib/retro/brandDecal.ts: nombre de la constante base de las marcas de equipo (identificador)
];
const RAICES = ["app", "components", "lib", "hooks", "public"];
const EXT = /\.(tsx?|jsx?|mjs|cjs|json|css|html|svg|txt|md|ink)$/i;
const FUERA = new Set(["node_modules", ".next"]);
function* recorrer(dir) {
  for (const n of readdirSync(dir)) {
    if (FUERA.has(n)) continue;
    const p = join(dir, n), st = statSync(p);
    if (st.isDirectory()) yield* recorrer(p);
    else if (EXT.test(n)) yield p;
  }
}
const sinComentarios = (s, p) => {
  if (/\.(json|svg|html|txt)$/i.test(p)) return s;          // datos: todo cuenta
  return s
    .replace(/\/\*[\s\S]*?\*\//g, "")                        // /* … */ y {/* … */}
    .replace(/(^|[^:\\"'`])\/\/.*$/gm, "$1");                // // … (sin cortar "https://")
};
const hallazgos = [];
let archivos = 0;
for (const raiz of RAICES) {
  if (!existsSync(raiz)) continue;
  for (const p of recorrer(raiz)) {
    archivos++;
    let s = sinComentarios(readFileSync(p, "utf8"), p);
    for (const re of EXCEPCIONES) s = s.replace(re, "");
    s.split("\n").forEach((l, i) => { if (/austral/i.test(l)) hallazgos.push(`${relative(".", p)} (línea aprox. ${i + 1}): ${l.trim().slice(0, 100)}`); });
  }
}
ok(hallazgos.length === 0, `sin "austral" en textos visibles (${archivos} archivos)`);
for (const h of hallazgos) console.log("      ", h);

// ── 3) la constante se usa donde estaba el nombre ──────────────────────────────────────────────────────────────────
const USAN = [
  "components/DialogoTerminal.tsx", "components/VideoModal.tsx", "components/Monoliths.tsx",
  "lib/retro/subpanelCanvas.ts", "lib/retro/panelPlaceholder.ts", "lib/retro/brandDecal.ts",
];
for (const f of USAN) {
  const s = readFileSync(f, "utf8");
  ok(/from "@\/lib\/marca"/.test(s) && /\bNOMBRE_EMPRESA(_MAYUS)?\b/.test(s.replace(/^import .*$/gm, "")), `${f} importa y usa la constante`);
}
// en JSX nunca el nombre literal con el apóstrofo suelto (react/no-unescaped-entities)
for (const f of USAN.filter(f => f.endsWith(".tsx"))) {
  ok(!/IN-GO'S|In-Go's/.test(readFileSync(f, "utf8")), `${f} sin el nombre literal (solo la constante)`);
}

// ── 4) diálogos ink ─────────────────────────────────────────────────────────────────────────────────────────────────
const INK = "../docs/dialogos/dialogo-luz.ink", JSONC = "public/alight/dialogo/dialogo-luz.json";
const ink = readFileSync(INK, "utf8"), jsn = readFileSync(JSONC, "utf8");
ok(!/austral/i.test(ink), "dialogo-luz.ink sin \"austral\"");
ok(!/austral/i.test(jsn), "dialogo-luz.json (compilado) sin \"austral\"");
const cuenta = (s) => (s.match(/in-go's wan inc/gi) || []).length;
const nInk = cuenta(ink), nJson = cuenta(jsn);
ok(nJson >= nInk, `el compilado nombra a la empresa tantas veces como la fuente (ink ${nInk}, json ${nJson})`);
if (nInk === 0) console.log("      nota: el diálogo LUZ hoy no nombra a la empresa (no había nada que reemplazar en ink)");

console.log(`\n${oks} OK, ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
