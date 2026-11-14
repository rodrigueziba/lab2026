// Z49: prueba del sol sobre el eje del portal (lib/cicloDia.ts) y de la escala de la composición
// (lib/portalEscala.ts). Uso: node scripts/portal-sol-test.mjs
// DBG_DIA y DBG_PORTAL se leen de lib/debugConfig.ts; la geometría del portal, de los valores de DBG_SILLAS
// (domePortalAzimuth / Elevation / HalfFovDeg) y de las constantes del shader (PORTAL_C, PORTAL_R).
import fs from 'node:fs';
import { crearEstadoDia, estadoCielo, PORTAL_GEOM } from '../lib/cicloDia.ts';
import { escalaPortal, elevacionDeP } from '../lib/portalEscala.ts';

const src = fs.readFileSync(new URL('../lib/debugConfig.ts', import.meta.url), 'utf8');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string/g, '').replace(/ as number\[\]/g, '')});`)();
const DIA_CFG = obj('DBG_DIA'), PORTAL = obj('DBG_PORTAL');
const num = k => Number(new RegExp(`${k}:\\s*([^,]+),`).exec(src)[1].replace('Math.PI', String(Math.PI)));
const AZ = num('domePortalAzimuth'), EL = num('domePortalElevation'), FOV = num('domePortalHalfFovDeg'), FADE1 = num('domeRingFade1');
const frag = fs.readFileSync(new URL('../app/alight/dome/dome.frag.glsl', import.meta.url), 'utf8');
const PC = /PORTAL_C\s*=\s*vec2\(([-\d.]+),\s*([-\d.]+)\)/.exec(frag).slice(1).map(Number);
const PR = Number(/PORTAL_R\s*=\s*([\d.]+)/.exec(frag)[1]);

let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const f = (n, d = 2) => n.toFixed(d);
const deg = r => r * 180 / Math.PI;
const cfg = (o = {}) => ({ ...structuredClone(DIA_CFG), ...o });
const azTurn = r => { let a = ((r / (2 * Math.PI)) % 1 + 1) % 1; return a > 0.5 ? a - 1 : a; };   // vueltas −0,5…0,5

console.log(`\nportal (DBG_SILLAS): azimut ${f(deg(AZ), 1)}° (convención atan(d.x, −d.z)), elevación del centro ${f(deg(EL), 1)}°, semi-FOV ${FOV}°, PORTAL_C (${PC}), PORTAL_R ${PR}`);
PORTAL_GEOM.azRad = AZ;   // lo escribe DomeSky en el juego

console.log('\nsol sobre el eje del portal');
const C = cfg(), E = crearEstadoDia(), K = C.KEYS;
estadoCielo(K.SALIDA, C, E);
check(Math.abs(azTurn(E.solAz - AZ)) < 1e-9 && Math.abs(E.solAlt) < 1e-9, `sale en el azimut del portal (${f(deg(E.solAz), 1)}°) sobre el horizonte`);
let maxDeriva = 0, altDeriva1 = 0;
for (let d = K.SALIDA; d <= K.SALIDA + 0.2; d += 1e-4) { estadoCielo(d, C, E); const der = Math.abs(deg(azTurn(E.solAz - AZ) * 2 * Math.PI)); if (deg(E.solAlt) <= 15) maxDeriva = Math.max(maxDeriva, der); if (!altDeriva1 && der > 1) altDeriva1 = deg(E.solAlt); }
check(maxDeriva < 1.0, `sube casi en vertical: hasta 15° de altura se corre ${f(maxDeriva, 2)}° en azimut (se abre recién a ${f(altDeriva1, 1)}° de altura)`);
estadoCielo(K.MEDIODIA, C, E); const azMed = deg(E.solAz) % 360, altMed = deg(E.solAlt);
estadoCielo(K.ATARDECER, C, E);
check(Math.abs(altMed - C.SOL_ALT_MAX_DEG) < 1e-6 && Math.abs(azTurn(E.solAz - AZ - Math.PI)) < 1e-9, `mediodía a ${f(altMed, 0)}° (azimut ${f(azMed, 0)}°) y se pone en el azimut opuesto al portal, como en Z48`);
{ const a = crearEstadoDia(), b = crearEstadoDia(); let maxS = 0, maxU = 0;
  for (let x = 0; x < 1; x += 1e-4) { estadoCielo(x, C, a); estadoCielo(x + 1e-4, C, b); for (let i = 0; i < 3; i++) maxS = Math.max(maxS, Math.abs(a.solDir[i] - b.solDir[i])); maxU = Math.max(maxU, Math.abs(a.solUnico - b.solUnico)); }
  check(maxS < 0.003, `continuidad 0…1 con el sol alineado: el paso de 1e-4 mueve el sol ≤ ${f(maxS, 4)} (Z50: el máximo es el giro de noche, bajo el horizonte)`);
  estadoCielo(0, C, a); estadoCielo(1, C, b); check([0, 1, 2].every(i => Math.abs(a.solDir[i] - b.solDir[i]) < 1e-9), 'el ciclo cierra (1 = 0)'); }
estadoCielo(K.SALIDA, cfg({ SOL_AZ_OFFSET_DEG: 5 }), E); check(Math.abs(deg(azTurn(E.solAz - AZ) * 2 * Math.PI) - 5) < 1e-6, 'SOL_AZ_OFFSET_DEG 5 corre la salida 5°');
estadoCielo(K.SALIDA, cfg({ SOL_ALINEAR_PORTAL: false }), E); check(Math.abs(deg(E.solAz) - 120) < 1e-6, 'SOL_ALINEAR_PORTAL false: azimut de Z48 (120°)');
PORTAL_GEOM.azRad = NaN; estadoCielo(K.SALIDA, C, E); check(Math.abs(deg(E.solAz) - 120) < 1e-6, 'sin domo montado (geometría desconocida): azimut de respaldo SOL_AZ_SALIDA_DEG');
PORTAL_GEOM.azRad = AZ;

console.log('\nSOL_UNICO (atenuación del sol ilustrado)');
{ const c = cfg({ SOL_UNICO: true }), e = crearEstadoDia(); const v = x => (estadoCielo(x, c, e), e.solUnico);
  console.log(`    tDia 0,10: ${f(v(0.1))} · 0,19: ${f(v(0.19))} · 0,20: ${f(v(0.2))} · 0,22: ${f(v(0.22))} · 0,50: ${f(v(0.5))} · 0,92: ${f(v(0.92))} · 0,97: ${f(v(0.97))}`);
  check(v(0.1) === 0 && v(0.5) === 1 && v(0.99) < 0.01 && v(0.22) === 1, 'se funde al salir el sol (0,19 → 0,22), queda atenuado todo el día y vuelve de noche');
  let maxU = 0; const a = crearEstadoDia(), b = crearEstadoDia(); for (let x = 0; x < 1; x += 1e-4) { estadoCielo(x, c, a); estadoCielo(x + 1e-4, c, b); maxU = Math.max(maxU, Math.abs(a.solUnico - b.solUnico)); }
  check(maxU < 0.01, `fundido suave (paso máx. ${f(maxU, 4)})`);
  check((estadoCielo(0.5, C, e), e.solUnico) === 0, 'con SOL_UNICO false no se atenúa nunca'); }

console.log('\nescala de la composición (ESCALA, apoyada en el horizonte)');
const geo = S => { const o = escalaPortal(EL, FOV, S, { elev: 0, tan: 1 });
  const at = Math.atan(o.tan);
  const centro = elevacionDeP(PC[1], o.elev, o.tan);   // centro del círculo (PORTAL_C.y)
  const radio = PR * at, alcance = FADE1 * at;           // s = ángulo / atan(tan)
  const pyHor = -Math.tan(o.elev) / o.tan;               // fila de la imagen que cae en el horizonte
  return { ...o, centro, radio, alcance, pyHor, arriba: centro + radio, abajo: centro - radio, anillosArriba: centro + alcance }; };
const g1 = geo(1), g13 = geo(PORTAL.ESCALA);
for (const [n, g] of [['1,0', g1], [String(PORTAL.ESCALA).replace('.', ','), g13]]) console.log(`    ESCALA ${n}: centro ${f(deg(g.elev), 1)}° (círculo ${f(deg(g.centro), 1)}°), radio del círculo ${f(deg(g.radio), 1)}°, de ${f(deg(g.abajo), 1)}° a ${f(deg(g.arriba), 1)}°; anillos hasta ${f(deg(g.anillosArriba), 1)}° de altura (alcance ${f(deg(g.alcance), 1)}°); fila del horizonte p.y = ${f(g.pyHor, 3)}`);
check(Math.abs(g1.elev - EL) < 1e-12 && Math.abs(g1.tan - Math.tan(FOV * Math.PI / 180)) < 1e-12, 'ESCALA 1: exactamente la geometría anterior');
check(Math.abs(g13.tan / g1.tan - PORTAL.ESCALA) < 1e-12, `ESCALA ${PORTAL.ESCALA}: la composición crece × ${PORTAL.ESCALA} en el plano del portal (todo en coordenadas p: portal, montañas, sol, nubes, anillos, confeti)`);
const filaVieja = g1.pyHor;   // la fila de la imagen que estaba en el horizonte
check(Math.abs(elevacionDeP(filaVieja, g13.elev, g13.tan)) < 1e-12, 'la base sigue apoyada: la misma fila de la imagen sigue exactamente en el horizonte');
check(deg(g13.arriba) < 90, `el círculo no pasa el cénit: llega a ${f(deg(g13.arriba), 1)}°`);
if (deg(g13.anillosArriba) >= 90) console.log(`    ⚠ AVISO: el alcance de los anillos llega a ${f(deg(g13.anillosArriba), 1)}° (pasa el cénit, 90°) con ESCALA ${PORTAL.ESCALA}`);
check(Math.abs(geo(0).tan - g1.tan) < 1e-12 && Math.abs(geo(NaN).elev - EL) < 1e-12, 'escala inválida (0, NaN) → 1');

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
