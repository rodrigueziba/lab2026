// Z66: prueba de lib/pastoChunks.ts (bloques, culling por progreso, LOD con histéresis, orden de capas) y estimación de
// draw calls y fragmentos del pasto antes (Z64) y después, por raycast desde una pose de cámara. Uso:
// node scripts/pasto-chunks-test.mjs
import fs from 'node:fs';
import { cuartoDe, rectPasto, distMaxCuarto, umbralPasto, manchaPasto } from '../lib/pasto.ts';
import { armarChunks, umbralMinChunk, chunkConPasto, distOjoChunk, capasObjetivo, capasLod, ordenCapas } from '../lib/pastoChunks.ts';
const src = fs.readFileSync(new URL('../lib/debugConfig.ts', import.meta.url), 'utf8');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string \| number/g, '').replace(/ as string/g, '').replace(/ as Record<string, boolean>/g, '')});`)();
const C = obj('DBG_PASTO'), R = obj('DBG_RENDIMIENTO');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const f = (n, d = 2) => n.toFixed(d);
const Rl = 15, ang = [-Math.PI / 4, Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4];
const LX = ang.map(a => Rl * Math.cos(a)), LZ = ang.map(a => Rl * Math.sin(a));
const rect = rectPasto(LX, LZ, C.MARGEN_M, [0, 0, 0, 0]);
const dm = [0, 1, 2, 3].map(i => distMaxCuarto(i, LX, LZ, rect));
const cuartoEn = (x, z) => cuartoDe(x, z, LX, LZ);
const umbralEn = (x, z, dn) => umbralPasto(dn, manchaPasto(x, z, C.ESCALA_MANCHA_M), C);

console.log('\nbloques');
const chunks = armarChunks(rect, cuartoEn, R.CHUNK_M);
for (const ch of chunks) ch.uMin = umbralMinChunk(ch, LX, LZ, dm[ch.cuarto], cuartoEn, umbralEn);
console.log(`    rectángulo ${f(rect[2] - rect[0])} × ${f(rect[3] - rect[1])} m · CHUNK_M ${R.CHUNK_M} → ${chunks.length} mallas de ${f(chunks[0].w)} × ${f(chunks[0].d)} m`);
check(chunks.length >= 36 && chunks.length <= 64, 'entre 36 y 64 mallas (bloque × cuarto)');
{ let falta = 0; for (let x = rect[0] + 0.01; x < rect[2]; x += 0.37) for (let z = rect[1] + 0.01; z < rect[3]; z += 0.37) {
    const q = cuartoEn(x, z); if (!chunks.some(c => c.cuarto === q && x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1)) falta++; }
  check(falta === 0, 'todo punto del pasto queda cubierto por un bloque de su cuarto'); }
check(chunks.every(c => Math.abs(c.cx) > 0 || true) && new Set(chunks.map(c => `${c.x0},${c.z0},${c.cuarto}`)).size === chunks.length, 'sin bloques repetidos');

console.log('\nculling por progreso (umbral mínimo muestreado + margen)');
{ let violaciones = 0, culled = 0, tot = 0;
  for (const p of [0.02, 0.05, 0.1, 0.2, 0.35, 0.5, 0.7, 0.9]) for (const ch of chunks) {
    tot++; if (chunkConPasto(p, ch.uMin)) continue; culled++;
    // ningún punto del bloque (muestreo fino de 5 cm) debería verse con este p
    for (let x = ch.x0; x <= ch.x1; x += 0.05) for (let z = ch.z0; z <= ch.z1; z += 0.05) {
      if (cuartoEn(x, z) !== ch.cuarto) continue;
      const dn = Math.min(1, Math.hypot(x - LX[ch.cuarto], z - LZ[ch.cuarto]) / dm[ch.cuarto]);
      if (p > umbralEn(x, z, dn)) { violaciones++; break; }
    }
  }
  console.log(`    p ∈ {0,02 … 0,9}: ${culled} de ${tot} bloques descartados sin dibujar`);
  check(violaciones === 0, 'ningún bloque descartado tenía pasto visible (muestreo de 5 cm)');
  const cerca = chunks.filter(c => c.x0 <= LX[0] && LX[0] <= c.x1 && c.z0 <= LZ[0] && LZ[0] <= c.z1 && c.cuarto === 0);
  check(cerca.length === 1 && cerca[0].uMin === 0 && chunkConPasto(0.001, cerca[0].uMin), 'el bloque bajo la luz se dibuja desde el primer instante (uMin 0)');
  check(!chunkConPasto(0, 0), 'p = 0: nada'); }

console.log('\nLOD');
const L = { CAPAS: C.CAPAS, CAPAS_LEJOS: R.CAPAS_LEJOS, LOD_CERCA_M: R.LOD_CERCA_M, LOD_LEJOS_M: R.LOD_LEJOS_M, DIST_MAX_M: C.DIST_MAX_M };
console.log(`    capas por distancia: ${[0, 4, 8, 11, 14, 17, 20, 24, 27.9, 28, 40].map(d => `${d} m → ${capasObjetivo(d, L)}`).join(' · ')}`);
check(capasObjetivo(R.LOD_CERCA_M, L) === C.CAPAS && capasObjetivo(R.LOD_LEJOS_M, L) === R.CAPAS_LEJOS && capasObjetivo(C.DIST_MAX_M, L) === 0, `CAPAS (${C.CAPAS}) hasta ${R.LOD_CERCA_M} m, CAPAS_LEJOS (${R.CAPAS_LEJOS}) desde ${R.LOD_LEJOS_M} m, 0 desde DIST_MAX_M (${C.DIST_MAX_M} m)`);
{ let a = capasObjetivo(14, L), cambios = 0;
  for (let i = 0; i < 400; i++) { const d = 14 + 0.3 * Math.sin(i * 0.7); const n = capasLod(d, a, L, R.LOD_HISTERESIS_M); if (n !== a) cambios++; a = n; }
  check(cambios === 0, `histéresis: oscilar ±0,3 m alrededor de 14 m no cambia las capas (banda ±${R.LOD_HISTERESIS_M} m)`);
  let b = capasObjetivo(9, L), c2 = 0; for (let d = 9; d < 19; d += 0.05) { const n = capasLod(d, b, L, R.LOD_HISTERESIS_M); if (n !== b) c2++; b = n; }
  check(c2 > 0 && c2 <= C.CAPAS - R.CAPAS_LEJOS, `al alejarse de 9 a 19 m baja de a una capa (${c2} cambios)`); }
check(Math.abs(distOjoChunk(chunks[0], chunks[0].cx, 1.6, chunks[0].cz, 0.35) - 1.25) < 1e-9, 'distancia al bloque: 0 en planta si el ojo está encima (solo la altura)');

console.log('\norden de capas (cualquier prefijo cubre 0…1)');
{ const n = C.CAPAS, a = ordenCapas(n, new Float32Array(40));
  check(a[0] === 0 && a[1] === 1 && new Set(Array.from(a.slice(0, n)).map(v => Math.round(v * (n - 1)))).size === n, `las ${n} alturas, cada una una vez; empieza por el suelo y la punta`);
  let peor = 0; for (let k = 2; k <= n; k++) { const s = Array.from(a.slice(0, k)).sort((x, y) => x - y); let g = 0; for (let i = 1; i < k; i++) g = Math.max(g, s[i] - s[i - 1]); peor = Math.max(peor, g * (k - 1)); }
  check(peor <= 2.5, `el mayor hueco de un prefijo de k capas es ≤ 2,5 / (k − 1), parejo (peor ${f(peor)} / (k − 1))`); }

// ── estimación de draw calls y fragmentos (raycast) ──
console.log('\nestimación de fragmentos del pasto (raycast; pantalla 1440 × 900 a DPR 1,5 = 2160 × 1350; FOV vertical 90°)');
const W = 2160, H = 1350, PASO = 6, fov = Math.PI / 2;
const poses = { 'entrada (−7,74; −4,49) mirando a la tarima': { x: -7.74, z: -4.49, yaw: -86.1 }, 'centro del pasto mirando a +X': { x: -6, z: 6, yaw: -90 }, 'bajo la luz 1 mirando al centro': { x: LX[0], z: LZ[0], yaw: Math.atan2(LX[0], LZ[0]) * 180 / Math.PI } };
const orden = ordenCapas(C.CAPAS, new Float32Array(40));
const pos = new Map(); for (let k = 0; k < C.CAPAS; k++) pos.set(Math.round(orden[k] * (C.CAPAS - 1)), k);   // capa → lugar en el orden
for (const [nombre, P] of Object.entries(poses)) for (const p of [1, 0.5]) {
  const pp = [p, p, p, p], y0 = 1.6, yaw = P.yaw * Math.PI / 180;
  const fw = [-Math.sin(yaw), 0, -Math.cos(yaw)], rt = [Math.cos(yaw), 0, -Math.sin(yaw)], tanV = Math.tan(fov / 2), tanH = tanV * W / H;
  let antes = 0, despues = 0, texAntes = 0, texDespues = 0;
  const dibuja = chunks.map(ch => {
    if (!chunkConPasto(pp[ch.cuarto], ch.uMin)) return 0;
    return capasObjetivo(distOjoChunk(ch, P.x, y0, P.z, C.ALTURA_M), L);
  });
  // frustum (aprox.): bloques cuyo centro está delante del ojo o a menos de su radio
  const llamadasDesp = chunks.filter((ch, i) => dibuja[i] > 0 && ((ch.cx - P.x) * fw[0] + (ch.cz - P.z) * fw[2] > -Math.hypot(ch.w, ch.d) / 2)).length;
  for (let py = 0; py < H; py += PASO) for (let px = 0; px < W; px += PASO) {
    const sx = (2 * (px + 0.5) / W - 1) * tanH, sy = (1 - 2 * (py + 0.5) / H) * tanV;
    const d = [fw[0] + sx * rt[0], sy, fw[2] + sx * rt[2]];
    if (d[1] >= 0) continue;
    for (let k = 0; k < C.CAPAS; k++) {
      const h = 0.006 + (k / (C.CAPAS - 1)) * C.ALTURA_M, t = (h - y0) / d[1];
      const x = P.x + d[0] * t, z = P.z + d[2] * t;
      if (x < rect[0] || x > rect[2] || z < rect[1] || z > rect[3]) continue;
      const dist = Math.hypot(x - P.x, h - y0, z - P.z), q = cuartoEn(x, z);
      const dn = Math.min(1, Math.hypot(x - LX[q], z - LZ[q]) / dm[q]);
      const g = (pp[q] - umbralEn(x, z, dn)) / C.FRENTE_ANCHO, vivo = g > 0 && (k / (C.CAPAS - 1)) <= Math.min(1, g) && dist < C.DIST_MAX_M;
      // Z64: 4 mallas del rectángulo entero → 4 invocaciones por capa (3 se descartan por celda)
      antes += 4; if (vivo) texAntes++;
      // después: 1 malla (la del bloque de su cuarto) si el bloque se dibuja y esta capa entra en su LOD
      const ci = chunks.findIndex(c => c.cuarto === q && x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1);
      if (ci >= 0 && pos.get(k) < dibuja[ci]) { despues++; if (vivo) texDespues++; }
    }
  }
  const esc = PASO * PASO / 1e6;
  console.log(`    ${nombre}, p = ${p}: draw calls 4 → ${llamadasDesp} · fragmentos ${f(antes * esc)} M → ${f(despues * esc)} M (${f(100 * despues / Math.max(1, antes), 0)} %) · con lectura de textura ${f(texAntes * esc)} M → ${f(texDespues * esc)} M`);
}
console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
