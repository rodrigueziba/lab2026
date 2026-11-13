// Z43: prueba de la progresión del fractal del prisma (lib/prisma/fractalProgresion.ts): prox por distancia
// con inercia, velocidad, tiempo acumulado (sin saltos), pausa, PROX_FORZADA y entrada/salida de la música.
// Uso: node scripts/fractal-test.mjs
import {
  crearEstadoFractal, avanzarFractal, proxObjetivo, velocidad, kPorFrame60, DT_MAX,
} from '../lib/prisma/fractalProgresion.ts';

let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const f = (n, d = 3) => n.toFixed(d);
// valores de DBG_FRACTAL (copiados: el test no importa debugConfig por el alias @/)
const CFG = {
  DIST_INICIO_M: 5.0, DIST_MAX_M: 1.2, INERCIA_60: 0.04, PROX_FORZADA: -1, VEL_MIN: 0.15, VEL_MAX: 1.5,
  PROX_MIN_MUSICA: 0.15, MUSICA_GRAVES: 0.5, MUSICA_MEDIOS: 0.5, MUSICA_AGUDOS: 0.5, MUSICA_SUAVE_S: 0.12, MUSICA_ENTRADA_S: 0.6,
};
const correr = (e, seg, fps, dist, o = {}) => {
  const dt = 1 / fps; const c = { ...CFG, ...(o.cfg ?? {}) };
  for (let i = 0; i < Math.round(seg * fps); i++) avanzarFractal(e, c, dt, dist, o.hab ?? true, o.pausa ?? false, o.viz ?? false, o.g ?? 0, o.m ?? 0, o.a ?? 0);
  return e;
};

console.log('\nprox objetivo (smoothstep 5 m → 1,2 m)');
check(proxObjetivo(8, 5, 1.2) === 0 && proxObjetivo(5, 5, 1.2) === 0, 'lejos (≥ 5 m) = 0');
check(proxObjetivo(1.2, 5, 1.2) === 1 && proxObjetivo(0.4, 5, 1.2) === 1, 'pegado (≤ 1,2 m) = 1');
check(Math.abs(proxObjetivo(3.1, 5, 1.2) - 0.5) < 1e-9, 'a mitad de camino (3,1 m) = 0,5');
let mono = true; for (let d = 6; d > 0; d -= 0.05) if (proxObjetivo(d, 5, 1.2) < proxObjetivo(d + 0.05, 5, 1.2) - 1e-12) mono = false;
check(mono, 'crece al acercarse (monótona)');
check(proxObjetivo(NaN, 5, 1.2) === 0 && proxObjetivo(3, 2, 2) === 0 && proxObjetivo(1, 2, 2) === 1, 'NaN y bordes iguales no rompen');

console.log('\ninercia (= lerp 0,04 por frame del S2, independiente de los fps)');
check(Math.abs(kPorFrame60(0.04, 1 / 60) - 0.04) < 1e-12, 'a 60 fps aplica 0,04 por frame');
const a60 = correr(crearEstadoFractal(), 1, 60, 1.0), a30 = correr(crearEstadoFractal(), 1, 30, 1.0), a144 = correr(crearEstadoFractal(), 1, 144, 1.0);
console.log(`    prox tras 1 s pegado: 60 fps ${f(a60.prox)} · 30 fps ${f(a30.prox)} · 144 fps ${f(a144.prox)}`);
check(Math.abs(a60.prox - a30.prox) < 1e-9 && Math.abs(a60.prox - a144.prox) < 1e-9, 'mismo resultado a 30, 60 y 144 fps');
check(Math.abs(a60.prox - (1 - Math.pow(0.96, 60))) < 1e-9, `1 s → ${f(a60.prox)} (= 1 − 0,96^60)`);
const t95 = (() => { const e = crearEstadoFractal(); let n = 0; while (e.prox < 0.95 && n < 10000) { avanzarFractal(e, CFG, 1 / 60, 1.0, true, false, false, 0, 0, 0); n++; } return n / 60; })();
check(t95 > 1 && t95 < 2, `llega al 95 % en ${f(t95, 2)} s`);
check(correr(crearEstadoFractal(), 3, 60, 1.0, { hab: false }).prox === 0, 'sin aterrizar: prox 0 (como el S2)');

console.log('\nvelocidad y tiempo propio');
check(velocidad(0, 0.15, 1.5) === 0.15 && velocidad(1, 0.15, 1.5) === 1.5 && Math.abs(velocidad(0.5, 0.15, 1.5) - 0.825) < 1e-12, 'VEL_MIN lejos, VEL_MAX pegado, lineal');
const lejos = correr(crearEstadoFractal(), 10, 60, 20);
check(Math.abs(lejos.t - 1.5) < 1e-6, `lejos 10 s → t = ${f(lejos.t)} (0,15 × 10)`);
const cerca = correr(crearEstadoFractal(), 10, 60, 20, { cfg: { PROX_FORZADA: 1 } });
check(Math.abs(cerca.t - 15) < 1e-6, `pegado 10 s → t = ${f(cerca.t)} (1,5 × 10)`);
// sin saltos: al cambiar la velocidad de golpe, el incremento por frame queda acotado por VEL_MAX · dt
const e = crearEstadoFractal(); let maxPaso = 0, prev = 0;
for (let i = 0; i < 600; i++) { const forz = i < 300 ? 0 : 1; avanzarFractal(e, { ...CFG, PROX_FORZADA: forz }, 1 / 60, 10, true, false, false, 0, 0, 0); maxPaso = Math.max(maxPaso, e.t - prev); prev = e.t; }
check(maxPaso <= 1.5 / 60 + 1e-12, `cambio brusco de velocidad: paso máximo ${f(maxPaso, 4)} ≤ VEL_MAX·dt (sin saltos)`);
const largo = crearEstadoFractal(); avanzarFractal(largo, CFG, 5, 1, true, false, false, 0, 0, 0);
check(largo.t <= 1.5 * DT_MAX + 1e-12, `frame de 5 s (pestaña oculta) avanza como ${DT_MAX} s`);

console.log('\npausa (PAUSA.activa)');
const p = correr(crearEstadoFractal(), 2, 60, 1.0); const antes = { ...p };
correr(p, 5, 60, 1.0, { pausa: true, viz: true, g: 1, m: 1, a: 1 });
check(p.t === antes.t && p.prox === antes.prox && p.musica === antes.musica && p.graves === antes.graves, 'pausada 5 s: tiempo, prox y música congelados');
correr(p, 1, 60, 1.0);
check(p.t > antes.t, 'al reanudar sigue desde donde estaba');

console.log('\nPROX_FORZADA');
for (const v of [0, 0.3, 0.7, 1]) { const q = correr(crearEstadoFractal(), 0.1, 60, 50, { hab: false, cfg: { PROX_FORZADA: v } }); check(q.prox === v, `forzada ${v} → prox ${q.prox} (inmediato, aun sin aterrizar)`); }

console.log('\nmúsica (graves → zoom, medios → X/Y, agudos → brillo)');
const sinViz = correr(crearEstadoFractal(), 3, 60, 1.0, { viz: false, g: 1, m: 1, a: 1 });
check(sinViz.musZoom === 1 && sinViz.musCx === 0 && sinViz.musBrillo === 1, 'sin visualizador: sin reacción (anima solo por tiempo)');
const lejosM = correr(crearEstadoFractal(), 3, 60, 4.9, { viz: true, g: 1, m: 1, a: 1 });
check(lejosM.prox < 0.15 && lejosM.musica === 0, `con visualizador pero lejos (prox ${f(lejosM.prox)} < 0,15): sin reacción`);
const m = correr(crearEstadoFractal(), 3, 60, 1.0, { viz: true, g: 1, m: 1, a: 1 });
console.log(`    cerca 3 s, bandas al 100 %: zoom ×${f(m.musZoom)} · c += (${f(m.musCx)}, ${f(m.musCy)}) · brillo ×${f(m.musBrillo)}`);
check(m.musZoom < 0.9 && m.musCx > 0.02 && m.musBrillo > 1.4, 'cerca y con visualizador: reacciona');
// entrada suave: sin saltos grandes por frame
const ent = correr(crearEstadoFractal(), 3, 60, 1.0); let maxSalto = 0, pm = 0;
for (let i = 0; i < 120; i++) { avanzarFractal(ent, CFG, 1 / 60, 1.0, true, false, true, 1, 1, 1); maxSalto = Math.max(maxSalto, ent.musica - pm); pm = ent.musica; }
check(maxSalto < 0.05, `entrada suavizada: máximo ${f(maxSalto)} por frame`);
correr(m, 4, 60, 9, { viz: true, g: 1, m: 1, a: 1 });
check(m.musica < 0.01 && Math.abs(m.musBrillo - 1) < 0.01, `al alejarse se va (factor ${f(m.musica)})`);
const apag = correr(crearEstadoFractal(), 3, 60, 1.0, { viz: true, g: 1, m: 1, a: 1, cfg: { MUSICA_GRAVES: 0, MUSICA_MEDIOS: 0, MUSICA_AGUDOS: 0 } });
check(apag.musZoom === 1 && apag.musCx === 0 && apag.musBrillo === 1, 'ganancias en 0: apagadas');
const nan = correr(crearEstadoFractal(), 1, 60, NaN, { viz: true, g: NaN, m: Infinity, a: -3 });
check([nan.prox, nan.t, nan.musZoom, nan.musCx, nan.musBrillo].every(Number.isFinite), 'entradas NaN / infinitas no rompen');

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
