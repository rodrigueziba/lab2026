// Z39: prueba del reloj de la experiencia (lib/relojExperiencia.ts) y línea de tiempo de la secuencia
// SILLAS con la lógica real de lib/secuenciaSillas.ts. Uso: node scripts/reloj-test.mjs
import { RELOJ, ahoraExp, crearEspera, tickReloj, limpiarEsperas, esperasPendientes } from '../lib/relojExperiencia.ts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
// secuenciaSillas.ts importa con el alias "@/": se carga una copia temporal con la ruta absoluta del MISMO
// relojExperiencia.ts (misma URL → misma instancia del reloj)
const lib = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../lib');
const fuente = fs.readFileSync(path.join(lib, 'secuenciaSillas.ts'), 'utf8')
  .replace('"@/lib/relojExperiencia"', JSON.stringify(pathToFileURL(path.join(lib, 'relojExperiencia.ts')).href));
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'reloj-test-')), 'secuenciaSillas.ts');
fs.writeFileSync(tmp, fuente);
const { SECUENCIA, iniciarRevelado, revelarFinal, cancelarSecuencia } = await import(pathToFileURL(tmp).href);

let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
globalThis.window = new EventTarget();
const DT = 1 / 60;
const correr = (s, p = false, dt = DT) => { for (let i = 0; i < Math.round(s / dt); i++) tickReloj(dt, p); };

console.log('\nreloj de la experiencia');
correr(1);
check(Math.abs(RELOJ.tExp - 1) < 1e-6 && Math.abs(ahoraExp() - 1000) < 1e-3, 'avanza con dt: 1 s → tExp 1, ahoraExp 1000 ms');
correr(2, true);
check(Math.abs(RELOJ.tExp - 1) < 1e-6 && RELOJ.dtExp === 0, 'la pausa congela (2 s en pausa → sigue en 1 s, dtExp 0)');
let disparos = []; const t0 = RELOJ.tExp;
crearEspera(500, () => disparos.push(+(RELOJ.tExp - t0).toFixed(3)));
correr(0.3); correr(1, true);
check(disparos.length === 0, 'una espera de 500 ms no dispara en pausa');
correr(0.25);
check(disparos.length === 1 && disparos[0] >= 0.5 && disparos[0] < 0.52, `crearEspera(500) dispara a los ${disparos[0]} s de experiencia (no cuenta la pausa)`);
const e = crearEspera(200, () => disparos.push('cancelada')); e.cancel(); correr(0.5);
check(disparos.length === 1 && !e.activa, 'cancel(): no dispara y queda inactiva');
crearEspera(100, () => disparos.push('x')); crearEspera(100, () => disparos.push('y'));
check(esperasPendientes() === 2, 'dos esperas pendientes');
limpiarEsperas(); correr(0.5);
check(esperasPendientes() === 0 && disparos.length === 1, 'limpiarEsperas(): se descartan sin disparar');
const anid = []; crearEspera(100, () => { anid.push('a'); crearEspera(0, () => anid.push('b')); }); correr(0.2);
check(anid.join('') === 'ab', 'una espera creada dentro de otra también dispara');

// ── línea de tiempo de la secuencia SILLAS ──
function secuencia(fps, { nPaneles = 60, unificado = true, pausa = null } = {}) {
  limpiarEsperas(); cancelarSecuencia();
  RELOJ.tExp = 0; SECUENCIA.activadoExpMs = -1; SECUENCIA.domeRevealedEmitido = false;
  SECUENCIA.maxStagger = (nPaneles - 1) * 0.12;
  const ev = {}; let wall = 0;
  const onRev = () => { ev.revealed = wall; if (unificado) crearEspera(5000, () => { ev.sala = wall; }); };
  window.addEventListener('alight:dome-revealed', onRev);
  const dt = 1 / fps, u = new Float64Array(nPaneles); let startExp = 0, startWall = 0, landed = false;
  for (let f = 0; f < fps * 40 && ev.sala === undefined; f++) {
    wall += dt;
    const pausado = !!pausa && wall >= pausa[0] && wall < pausa[0] + pausa[1];
    tickReloj(dt, pausado);
    if (unificado) {
      const el = RELOJ.tExp - startExp;
      if (!landed && el >= 5.5) { landed = true; ev.landed = wall; iniciarRevelado(14); }
      if (landed) for (let i = 0; i < nPaneles; i++) {
        const st = i * 0.12, e2 = (ahoraExp() - SECUENCIA.activadoExpMs) / 1000 - st;
        if (e2 > 0 && u[i] < 1) { u[i] = Math.min(1, u[i] + 0.42 * RELOJ.dtExp); if (u[i] >= 1 && st >= SECUENCIA.maxStagger) { ev.ultimoPanel = wall; revelarFinal(9.8); } }
      }
    } else {
      // comportamiento anterior: clock (= wall), setTimeout 9 800, +0.007/frame, setTimeout 5 000
      if (!landed && wall - startWall >= 5.5) { landed = true; ev.landed = wall; ev._revAt = wall + 9.8; }
      if (landed) for (let i = 0; i < nPaneles; i++) { const e2 = wall - ev.landed - i * 0.12; if (e2 > 0 && u[i] < 1) { u[i] = Math.min(1, u[i] + 0.007); if (u[i] >= 1 && i === nPaneles - 1) ev.ultimoPanel = wall; } }
      if (ev._revAt !== undefined && ev.revealed === undefined && wall >= ev._revAt) { ev.revealed = wall; ev._salaAt = wall + 5; }
      if (ev._salaAt !== undefined && wall >= ev._salaAt) ev.sala = wall;
    }
  }
  window.removeEventListener('alight:dome-revealed', onRev);
  const f = x => x === undefined ? '  —  ' : x.toFixed(2).padStart(5);
  return { ev, linea: `prism-landed ${f(ev.landed)} · último panel ${f(ev.ultimoPanel)} · dome-revealed ${f(ev.revealed)} (${unificado ? SECUENCIA.motivo : 'timer'}) · sala-activa ${f(ev.sala)} s` };
}
console.log('\nlínea de tiempo SILLAS (s de reloj de pared desde elegir sillas; 60 paneles)');
const filas = [];
for (const fps of [60, 30, 15]) {
  const a = secuencia(fps, { unificado: false }); console.log(`  antes  ${String(fps).padStart(2)} fps: ${a.linea}`);
  const b = secuencia(fps); console.log(`  Z39    ${String(fps).padStart(2)} fps: ${b.linea}`); filas.push(b.ev);
}
check(filas.every((e2, k) => Math.abs(e2.sala - 20.3) < 3 / [60, 30, 15][k] + 0.01), 'Z39: total ≈ 20,3 s a 60, 30 y 15 fps (± 3 frames de cuantización, igual que antes)');
check(filas.every(e2 => Math.abs(e2.revealed - e2.landed - 9.8) < 0.15), 'Z39: dome-revealed ≈ +9,8 s de prism-landed (mínimo REVELADO_MIN_S)');
const p = secuencia(60, { pausa: [8, 6] }); console.log(`  Z39 60 fps con 6 s de pausa a los 8 s: ${p.linea}`);
check(Math.abs(p.ev.sala - 26.3) < 0.15, 'pausa de 6 s en mitad del revelado: todo se corre 6 s (≈26,3 s)');
const pocos = secuencia(60, { nPaneles: 20 }); console.log(`  Z39 60 fps con 20 paneles:          ${pocos.linea}`);
check(Math.abs(pocos.ev.revealed - pocos.ev.landed - 9.8) < 0.15, 'con 20 paneles el revelado termina antes, pero dome-revealed espera el mínimo de 9,8 s');
// tope: el último panel nunca completa
limpiarEsperas(); RELOJ.tExp = 0; SECUENCIA.domeRevealedEmitido = false; let tope = null;
const onT = () => { tope = RELOJ.tExp; }; window.addEventListener('alight:dome-revealed', onT);
iniciarRevelado(14); correr(20); window.removeEventListener('alight:dome-revealed', onT);
check(tope !== null && Math.abs(tope - 14) < 0.02 && SECUENCIA.motivo === 'tope', `tope de seguridad: sin revelado completo, dome-revealed a los ${tope?.toFixed(2)} s (motivo "${SECUENCIA.motivo}")`);
let n = 0; const onN = () => n++; window.addEventListener('alight:dome-revealed', onN);
limpiarEsperas(); RELOJ.tExp = 0; iniciarRevelado(14); correr(10); revelarFinal(9.8); revelarFinal(9.8); correr(6);
check(n === 1, 'dome-revealed se emite una sola vez (revelado + tope + llamadas repetidas)');

fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
