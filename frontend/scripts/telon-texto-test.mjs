// Z46: prueba del layout del texto del telón (lib/telonTexto/layoutTexto.ts) con un medidor simulado y de la
// línea de tiempo (lib/telonTexto/lineaTiempo.ts). Uso: node scripts/telon-texto-test.mjs
// La forma final con Anton real se verifica en el navegador (TELON_TEXTO_DIAG).
import { calcularLayout, TAM_REF } from '../lib/telonTexto/layoutTexto.ts';
import { crearEstadoTexto, avanzarTexto, reiniciarTexto, parpadeo, alfaEntrada, anchoZonaIluminada } from '../lib/telonTexto/lineaTiempo.ts';

let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const f = (n, d = 3) => n.toFixed(d);

// medidor simulado: avances por letra en em (proporciones de una condensada pesada), tinta con márgenes
const AV = { A: 0.50, L: 0.42, I: 0.24, G: 0.50, H: 0.50, T: 0.42, F: 0.40, O: 0.50, R: 0.50, C: 0.48, N: 0.50, E: 0.42 };
const KERN = { AT: -0.03, TT: -0.01, RA: -0.02 };   // algo de kerning para probar que se conserva
const medir = (texto, tam) => {
  let av = 0; for (let i = 0; i < texto.length; i++) { av += AV[texto[i]] ?? 0.5; if (i > 0) av += KERN[texto[i - 1] + texto[i]] ?? 0; }
  return { avance: av * tam, izq: -0.02 * tam, der: av * tam - 0.025 * tam, asc: 0.735 * tam };
};
const CFG = { INTERLINEA: 0.16, COLUMNAS: 0.13 };

console.log('\nlayout (medidor simulado)');
const L = calcularLayout(medir, CFG, 0.55);
const tr = Object.fromEntries(L.trazos.map(t => [t.texto, t]));
console.log(`    bloque ${f(L.ancho, 1)} × ${f(L.alto, 1)} · aspecto ${f(L.aspecto, 2)} · interletra ENTION ${f(L.interletraENTION, 2)} px`);
check(Math.abs(L.bordeG - L.bordeN) < 1e-9, `bordes derechos de la G y la N alineados (G ${f(L.bordeG, 4)} · N ${f(L.bordeN, 4)})`);
check(Math.abs(L.ancho - L.bordeG) < 1e-9, 'ese borde es el borde derecho del bloque');
const capS = medir('LIGHT', TAM_REF).asc, capG = medir('ATT', tr.ATT.tam).asc;
check(Math.abs(capG - L.alto) < 1e-9 && Math.abs(medir('A', tr.A.tam).asc - L.alto) < 1e-9, '"A" y "ATT" ocupan la altura de las dos líneas');
check(Math.abs(L.alto - (2 * capS + 0.16 * capS)) < 1e-9, 'alto = 2 líneas + interlínea');
check(tr.LIGHT.y === capS && tr.FOR.y === L.alto && tr.RACTING.y === capS && tr.ENTION.y === L.alto, 'líneas base: LIGHT / RACTING arriba, FOR / ENTION abajo');
const tintaIzq = t => t.x - medir(t.texto[0] === 'A' && t.texto.length === 1 ? 'A' : t.texto, t.tam).izq;
check(Math.abs(tintaIzq(tr.LIGHT) - tintaIzq(tr.FOR)) < 1e-9, 'LIGHT y FOR alineadas a la izquierda (tinta)');
check(Math.abs((tr.RACTING.x - medir('RACTING', TAM_REF).izq) - (tr.ENTION.x - medir('E', TAM_REF).izq)) < 1e-9, 'RACTING y ENTION empiezan en el mismo borde izquierdo');
check(L.interletraENTION > 0, 'ENTION se justifica con más interletra (no se estiran las letras)');
check(tr.ENTION.intensidad === 0.55 && L.trazos.filter(t => t.texto !== 'ENTION').every(t => t.intensidad === 1), 'ENTION al 55 %');
// columnas en orden y sin superponerse
const c1d = tr.A.x + medir('A', tr.A.tam).der, c2i = tintaIzq(tr.LIGHT), c3i = tr.ATT.x - medir('ATT', tr.ATT.tam).izq, c2d = Math.max(tr.LIGHT.x + medir('LIGHT', TAM_REF).der, tr.FOR.x + medir('FOR', TAM_REF).der);
check(c2i > c1d && c3i > c2d, 'columnas separadas y en orden (A | LIGHT/FOR | ATT | RACTING/ENTION)');
// kerning conservado: la posición de cada letra de ENTION es el avance del prefijo + i·extra
const pref = i => i === 0 ? 0 : medir('ENTION'.slice(0, i), TAM_REF).avance;
check(tr.ENTION.letras.every((x, i) => Math.abs(x - (pref(i) + i * L.interletraENTION)) < 1e-9), 'letras de ENTION: avance del prefijo (kerning) + interletra uniforme');
check(Math.abs(L.aspecto - L.ancho / L.alto) < 1e-12 && L.aspecto > 1, `aspecto informado = ancho / alto (${f(L.aspecto, 2)} con el medidor simulado; con Anton real se mide en el navegador)`);
// escala: todo es proporcional al tamaño de referencia
const L2 = calcularLayout((t, s) => medir(t, s), { INTERLINEA: 0.3, COLUMNAS: 0.13 }, 0.55);
check(L2.aspecto < L.aspecto, 'más interlínea → bloque más alto (aspecto menor)');

console.log('\nzona iluminada por el reflector');
const z = anchoZonaIluminada(Math.hypot(5, 5), 0.6, 0.7);
console.log(`    ancho a media intensidad: ${f(z, 2)} m · bloque al 60 %: ${f(0.6 * z, 2)} m`);
check(z > 5 && z < 8, 'entre 5 y 8 m (reflector a 7,07 m, 0,6 rad, penumbra 0,7)');
check(anchoZonaIluminada(7.07, 0.6, 0) > z, 'sin penumbra la zona es más ancha (borde duro)');

console.log('\nlínea de tiempo');
const C = { FADE_IN_S: 2.5, FADE_OUT_S: 2, DURACION_S: 25, FLICKER_S: 0.6, FLICKER_N: 4, FLICKER_PICO: 0.7 };
// parpadeo: 4 destellos en 0,6 s
{ let flancos = 0, prev = false; for (let t = 0; t < 0.6; t += 0.002) { const on = parpadeo(t, C) >= 0.69; if (on && !prev) flancos++; prev = on; }
  check(flancos === 4, `parpadeo: ${flancos} destellos en 0,6 s`); }
check(parpadeo(0.61, C) === -1 && Math.abs(alfaEntrada(2.5, C) - 1) < 1e-9 && alfaEntrada(1.25, C) > 0.4 && alfaEntrada(1.25, C) < 0.6, 'después del parpadeo, fundido suave hasta 1 a los 2,5 s');
const correr = (e, desde, hasta, o = {}) => { for (let t = desde; t <= hasta + 1e-9; t += 1 / 60) avanzarTexto(e, C, t, o.pausa ?? false, o.puede ?? true, o.lejos ?? false, o.siguio ?? false); return e; };
{ const e = crearEstadoTexto(); correr(e, 0, 0.2, { puede: false });
  check(e.fase === 'espera' && e.alfa === 0, 'no empieza sin la textura / el telón a la vista');
  correr(e, 0.3, 3); check(e.fase === 'activo' && Math.abs(e.alfa - 1) < 1e-6 && Math.abs(e.t0 - 0.3) < 1e-9, `aparece a los 0,3 s y llega a 1 (t0 ${f(e.t0, 2)})`);
  correr(e, 3, 25.2); check(e.fase === 'activo', 'sigue visible antes de 25 s');
  correr(e, 25.3, 26.3); check(e.fase === 'saliendo' && e.motivo === 'duracion' && e.alfa > 0 && e.alfa < 1, `a los 25 s de iniciado empieza a irse (alfa ${f(e.alfa, 2)})`);
  correr(e, 26.4, 28); check(e.fase === 'terminado' && e.alfa === 0, 'se fue en 2 s');
  correr(e, 28, 40); check(e.fase === 'terminado', 'no reaparece');
  reiniciarTexto(e); correr(e, 40, 41); check(e.fase === 'activo' && e.alfa > 0, '"Reproducir texto" lo reinicia'); }
{ const e = crearEstadoTexto(); correr(e, 0.3, 5); correr(e, 5, 5.5, { lejos: true });
  check(e.fase === 'saliendo' && e.motivo === 'distancia', 'alejarse del telón lo desvanece'); correr(e, 5.5, 6, { lejos: false });
  check(e.fase === 'saliendo', 'volver a acercarse no lo trae de vuelta'); }
{ const e = crearEstadoTexto(); correr(e, 0.3, 1.0); const a0 = e.alfa, t0 = e.t0;
  correr(e, 1.0, 30, { pausa: true }); check(e.alfa === a0 && e.t0 === t0 && e.fase === 'activo', 'en pausa queda congelado (el reloj de la experiencia no avanza)'); }
{ const e = crearEstadoTexto(); correr(e, 0.3, 4); correr(e, 4, 4.1, { siguio: true });
  check(e.fase === 'saliendo' && e.motivo === 'experiencia', 'si la experiencia siguió (telón cruzado, camino LUZ), se va'); }
{ const e = crearEstadoTexto(); correr(e, 0, 5, { siguio: true });
  check(e.fase === 'espera' && e.alfa === 0, 'si ya no está al inicio, nunca empieza'); }
{ const e = crearEstadoTexto(); avanzarTexto(e, C, NaN, false, true, false, false);
  check(Number.isFinite(e.alfa), 'tiempo NaN no rompe'); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
