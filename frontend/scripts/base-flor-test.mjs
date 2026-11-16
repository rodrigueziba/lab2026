// Z67: prueba de lib/baseFlor.ts: progreso del hueco, las grietas y el pasto de la base respecto de la escala de la flor
// (monotonía, retrasos al nacer y adelanto del pasto al desaparecer, sin saltos ni NaN), recorrido real del ciclo
// (lib/prismaFlor.ts), borde irregular del hueco, color térmico y costo estimado del pasto de la base.
// Uso: node scripts/base-flor-test.mjs
import fs from 'node:fs';
import { progresoBase, avanzarBase, crearEstadoBase, reiniciarBase, radioHueco, colorTermico, mBaseTallo, aleatorio } from '../lib/baseFlor.ts';
import { estadoPrismaFlor, crearEstadoFlor } from '../lib/prismaFlor.ts';
const src = fs.readFileSync(new URL('../lib/debugConfig.ts', import.meta.url), 'utf8');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string\[\]/g, '').replace(/ as string/g, '')});`)();
const B = obj('DBG_BASE_FLOR'), F = obj('DBG_FLOR');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const f = (n, d = 2) => n.toFixed(d);

console.log('\ndefaults');
check(B.ACTIVO && B.RADIO_HUECO_M === 0.2 && B.PROFUNDIDAD_M === 0.25 && B.BRILLO_BORDE === 0.25 && B.N_GRIETAS === 9 && B.RADIO_GRIETAS_M === 1.3
  && B.ASTILLAS === 8 && B.PASTO_ACTIVO && B.PASTO_RADIO_M === 0.6 && B.PASTO_ALTURA_M === 0.28 && B.PASTO_CAPAS === 10 && !B.OVERLAY,
  'DBG_BASE_FLOR con los valores pedidos (OVERLAY off)');

console.log('\nprogreso según la escala');
for (const fase of ['nace', 'achica']) {
  let mono = true, ant = { hueco: -1, grietas: -1, pasto: -1 };
  for (let e = 0; e <= 1.0001; e += 0.001) { const o = progresoBase(e, fase, {}); for (const k of ['hueco', 'grietas', 'pasto']) { if (o[k] < ant[k] - 1e-12) mono = false; } ant = o; }
  const p0 = progresoBase(0, fase, {}), p1 = progresoBase(1, fase, {});
  check(mono && p0.hueco === 0 && p0.grietas === 0 && p0.pasto === 0 && p1.hueco === 1 && p1.grietas === 1 && p1.pasto === 1, `${fase}: monótono en la escala, 0 sin flor y 1 con la flor completa`);
}
{ let orden = true; for (let e = 0; e <= 1; e += 0.01) { const o = progresoBase(e, 'nace', {}); if (!(o.hueco >= o.grietas - 1e-9 && o.grietas >= o.pasto - 1e-9)) orden = false; }
  const m = progresoBase(0.3, 'nace', {});
  check(orden, `al nacer: primero el hueco, después las grietas (retraso) y el pasto (más retraso) · escala 0,3 → hueco ${f(m.hueco)} grietas ${f(m.grietas)} pasto ${f(m.pasto)}`); }
{ let orden = true; for (let e = 0; e <= 1; e += 0.01) { const o = progresoBase(e, 'achica', {}); if (!(o.pasto <= o.grietas + 1e-9 && o.grietas <= o.hueco + 1e-9)) orden = false; }
  const m = progresoBase(0.3, 'achica', {});
  check(orden && m.pasto === 0, `al desaparecer: el pasto se va primero (adelanto: en 0 con la flor al 35 %), las grietas se cierran y el hueco al final · escala 0,3 → hueco ${f(m.hueco)} grietas ${f(m.grietas)} pasto ${f(m.pasto)}`); }

console.log('\nrecorrido real del ciclo de la flor (tDia 0 → 1)');
{ const s = crearEstadoBase(), fl = crearEstadoFlor(); const dt = 1 / 60, durDia = 180;
  let maxSalto = 0, nacio = -1, abrioGrietas = -1, pastoT = -1, cerroPasto = -1, cerroGrietas = -1, cerroHueco = -1, fases = new Set(), prev = { h: 0, g: 0, p: 0 }, nan = false;
  for (let t = 0; t <= durDia; t += dt) {
    estadoPrismaFlor(t / durDia, F, true, fl);
    avanzarBase(s, fl.escala, dt);
    fases.add(s.fase);
    for (const v of [s.hueco, s.grietas, s.pasto]) if (!Number.isFinite(v)) nan = true;
    maxSalto = Math.max(maxSalto, Math.abs(s.hueco - prev.h), Math.abs(s.grietas - prev.g), Math.abs(s.pasto - prev.p));
    const td = t / durDia;
    if (nacio < 0 && s.hueco > 0.01) nacio = td; if (abrioGrietas < 0 && s.grietas > 0.01) abrioGrietas = td; if (pastoT < 0 && s.pasto > 0.01) pastoT = td;
    if (td > 0.5 && cerroPasto < 0 && s.pasto < 0.01) cerroPasto = td; if (td > 0.5 && cerroGrietas < 0 && s.grietas < 0.01) cerroGrietas = td; if (td > 0.5 && cerroHueco < 0 && s.hueco < 0.01) cerroHueco = td;
    prev = { h: s.hueco, g: s.grietas, p: s.pasto };
  }
  console.log(`    día de ${durDia} s · aparecen: hueco ${f(nacio, 3)} · grietas ${f(abrioGrietas, 3)} · pasto ${f(pastoT, 3)} (la flor nace ${F.NACE_INICIO}…${F.NACE_FIN}) · se van: pasto ${f(cerroPasto, 3)} · grietas ${f(cerroGrietas, 3)} · hueco ${f(cerroHueco, 3)} (la flor desaparece ${F.ACHICA_INICIO}…${F.ACHICA_FIN})`);
  check(nacio >= F.NACE_INICIO && nacio < abrioGrietas && abrioGrietas < pastoT && pastoT < F.NACE_FIN, 'nacen con la flor: hueco, grietas (retraso), pasto (más retraso)');
  check(cerroPasto < cerroGrietas && cerroGrietas <= cerroHueco && cerroHueco <= F.ACHICA_FIN + 1e-3, 'se van con la flor: pasto primero, grietas, hueco junto con ella');
  check(fases.has('nace') && fases.has('achica'), 'detecta las dos fases por el signo del cambio de la escala');
  check(maxSalto < 0.05, `sin saltos (mayor cambio por cuadro ${f(maxSalto, 4)})`);
  check(!nan && s.hueco === 0 && s.grietas === 0 && s.pasto === 0, 'sin NaN y todo en 0 al terminar el día'); }
{ const s = crearEstadoBase(); for (let i = 0; i < 60; i++) avanzarBase(s, 0.5, 1 / 60); const a = { ...s };
  for (let i = 0; i < 120; i++) avanzarBase(s, 0.5, 0);
  check(s.hueco === a.hueco && s.grietas === a.grietas && s.pasto === a.pasto && s.fase === a.fase, 'pausa (dt 0, escala quieta): todo quieto');
  const q = crearEstadoBase(); for (let i = 0; i < 200; i++) avanzarBase(q, 1, 1 / 60);
  check(q.hueco === 1 && q.grietas === 1 && q.pasto === 1, '"Mostrar base con flor" (escala fija en 1): todo completo');
  const r = crearEstadoBase(); for (let i = 0; i < 50; i++) avanzarBase(r, NaN, NaN); check([r.hueco, r.grietas, r.pasto].every(Number.isFinite), 'escala o dt NaN: sin NaN');
  reiniciarBase(q); check(q.hueco === 0 && q.fase === 'nace', 'reiniciar'); }

console.log('\nborde del hueco, color y semilla');
{ let mn = 9, mx = 0; for (let a = 0; a < Math.PI * 2; a += 0.01) { const r = radioHueco(a, B.RADIO_HUECO_M, B.IRREGULARIDAD, B.SEMILLA); mn = Math.min(mn, r); mx = Math.max(mx, r); }
  console.log(`    radio del hueco ${f(mn, 3)} … ${f(mx, 3)} m (irregular, IRREGULARIDAD ${B.IRREGULARIDAD})`);
  check(mn > 0.12 && mx < 0.28 && mx - mn > 0.03, 'irregular pero cerca de RADIO_HUECO_M');
  check(radioHueco(1, 0.2, 0, 7) === 0.2, 'IRREGULARIDAD 0: círculo');
  const c = colorTermico(0.5, 0, [0, 0, 0]); check(c[0] > 0.9 && c[1] > 0.2 && c[2] < 0.15, `m 0,5: rojo anaranjado (${c.map(v => f(v)).join(', ')})`);
  check(mBaseTallo(0) === 0 && Math.abs(mBaseTallo(0.25) - 0.5) < 1e-9, 'm en la base del tallo como el shader (vU = 0)');
  const a1 = aleatorio(7), a2 = aleatorio(7), a3 = aleatorio(8);
  const s1 = [a1(), a1(), a1()], s2 = [a2(), a2(), a2()], s3 = [a3(), a3(), a3()];
  check(s1.join() === s2.join() && s1.join() !== s3.join(), 'astillas: la misma semilla da lo mismo; otra semilla, otro'); }

// ── costo del pasto de la base (raycast: píxeles del anillo en pantalla × capas) ──
console.log('\ncosto estimado del pasto de la base (pantalla 1440 × 900 a DPR 1,5, FOV vertical 90°)');
{ const W = 2160, H = 1350, tanV = 1, tanH = W / H, TH = 1.6 / 6, area = Math.PI * B.PASTO_RADIO_M ** 2;
  for (const dist of [1.5, 3, 6]) {
    const P = { x: 0, z: -dist, y: 1.6 };   // mirando a +Z, hacia el tallo
    let n = 0;
    for (let py = 0; py < H; py += 2) for (let px = 0; px < W; px += 2) {
      const sx = (2 * (px + 0.5) / W - 1) * tanH, sy = (1 - 2 * (py + 0.5) / H) * tanV;
      const d = [sx, sy, 1]; if (d[1] >= 0) continue;
      const t = (TH - P.y) / d[1], x = P.x + d[0] * t, z = P.z + d[2] * t;
      if (Math.hypot(x, z) < B.PASTO_RADIO_M * 1.2) n++;   // la malla cubre el cuadrado; el shader descarta afuera de 1,2 R
    }
    const px = n * 4;
    console.log(`    a ${dist} m: ${f(px / 1e3, 0)} mil px por capa × ${B.PASTO_CAPAS} capas = ${f(px * B.PASTO_CAPAS / 1e6)} M fragmentos (pasto de los cuartos, Z66: ~25 M)`);
  }
  console.log(`    área del anillo ${f(area)} m² (π · ${B.PASTO_RADIO_M}²)`); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
