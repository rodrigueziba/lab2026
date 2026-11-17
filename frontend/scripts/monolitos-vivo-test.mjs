// Z82: prueba de la máquina de estados de los monolitos (lib/monolitosVivo.ts) con tiempo simulado y un usuario que
// camina: acercarse, sostener 15 s, reinicio del contador, ir al otro monolito, ir a otro lado, cancelar a 0,6 s,
// mezcla equal-power, con y sin sesión (aceptación). Uso: node scripts/monolitos-vivo-test.mjs
import fs from 'node:fs';
import { crearMono, reiniciarMono, tickPar, pesoDistancia, mezclaEqualPower, pesoEfectivo } from '../lib/monolitosVivo.ts';
import { llenarPatronPrueba } from '../lib/sesionPrueba.ts';

const src = fs.readFileSync(new URL('../lib/debugConfig.ts', import.meta.url), 'utf8');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string/g, '')});`)();
const C = obj('DBG_MONO_VIVO');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const cerca = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

// escena: monolito de sonido en (+6, 0), de video en (−6, 0) (separados 12 m, como en la sala)
const S = [6, 0], V = [-6, 0], DT = 1 / 60;
function escena() {
  const s = crearMono(), v = crearMono(), u = [0, 8];
  const st = { s, v, u, t: 0, log: [] };
  st.paso = (dt = DT) => {
    const dS = Math.hypot(u[0] - S[0], u[1] - S[1]), dV = Math.hypot(u[0] - V[0], u[1] - V[1]);
    const cambio = tickPar(s, v, dS, dV, dt, C);
    if (cambio & 1) st.log.push(`${st.t.toFixed(2)} sonido ${s.estado}`);
    if (cambio & 2) st.log.push(`${st.t.toFixed(2)} video ${v.estado}`);
    st.t += dt;
  };
  st.ir = (x, z, vel = 1.4) => { for (let k = 0; k < 60 * 120; k++) { const dx = x - u[0], dz = z - u[1], l = Math.hypot(dx, dz); if (l < 0.02) break; const p = Math.min(l, vel * DT); u[0] += dx / l * p; u[1] += dz / l * p; st.paso(); } };
  st.esperar = seg => { for (let k = 0; k < Math.round(seg / DT); k++) st.paso(); };
  st.paso();
  return st;
}

console.log('\nconfiguración DBG_MONO_VIVO');
check(C.ACTIVO === true && C.SOSTENER_S === 15 && C.RETORNO_S === 6 && C.CANCELAR_S === 0.6, 'ACTIVO, SOSTENER_S 15, RETORNO_S 6, CANCELAR_S 0,6');
check(C.RADIO_INICIO_M > C.RADIO_TOTAL_M && C.REQUIERE_ACEPTACION === false && C.OVERLAY === false, 'radios coherentes, sin aceptación requerida, overlay oculto');

console.log('\nacercarse');
{
  const e = escena();
  check(e.s.estado === 'lejos' && e.s.peso === 0, 'lejos: peso 0 (audio propio entero)');
  e.ir(6 - C.RADIO_INICIO_M + 0.5, 0);
  check(e.s.estado === 'acercandose' && e.s.peso > 0 && e.s.peso < 1, `acercándose: peso ${e.s.peso.toFixed(2)} según la distancia`);
  check(cerca(e.s.peso, pesoDistancia(Math.hypot(e.u[0] - S[0], e.u[1] - S[1]), C)), 'el peso es la curva de la distancia');
  e.ir(6 - C.RADIO_TOTAL_M + 0.1, 0);
  check(e.s.estado === 'cerca' && e.s.peso === 1 && e.s.sostenRestanteS === C.SOSTENER_S, 'cerca: reemplazo total y contador en 15 s');
  check(e.v.estado === 'lejos', 'el monolito de video no se entera');
}

console.log('\nalejarse y sostener 15 s');
{
  const e = escena();
  e.ir(5.5, 0);
  e.ir(2.5, 2);          // se aleja y se queda quieto en un punto lejos de los dos (fuera de ambos radios)
  const t0 = e.t;
  check(e.s.estado === 'sosteniendo' && e.s.peso === 1 && e.s.alejandoseTrasCerca, 'sosteniendo: peso 1 y "alejándose tras cerca" (gancho del tiempo detenido)');
  e.esperar(C.SOSTENER_S - (e.t - t0) - 0.2);
  check(e.s.estado === 'sosteniendo' && e.s.peso === 1, 'a los 14,8 s sigue sostenido');
  e.esperar(0.4);
  check(e.s.estado === 'retornando', 'a los 15 s empieza el retorno');
  const p0 = e.s.peso; e.esperar(C.RETORNO_S / 2);
  check(cerca(e.s.peso, p0 - 0.5, 0.02), `retorno progresivo: a mitad de RETORNO_S el peso es ${e.s.peso.toFixed(2)}`);
  check(e.s.alejandoseTrasCerca, 'durante el retorno sigue "alejándose tras cerca"');
  e.esperar(C.RETORNO_S);
  check(e.s.estado === 'lejos' && e.s.peso === 0 && !e.s.alejandoseTrasCerca, 'vuelve a lejos y al audio propio entero');
}

console.log('\nvolver a acercarse reinicia el contador');
{
  const e = escena();
  e.ir(5.5, 0); e.ir(2.5, 2); e.esperar(10);
  check(e.s.estado === 'sosteniendo' && e.s.sostenRestanteS < 6, `a los 10 s quedan ${e.s.sostenRestanteS.toFixed(1)} s`);
  e.ir(5.5, 0);
  check(e.s.estado === 'cerca' && e.s.sostenRestanteS === C.SOSTENER_S, 'al volver a estar cerca el contador vuelve a 15 s');
  e.ir(2.5, 2); e.esperar(12);
  check(e.s.estado === 'sosteniendo', 'y vuelve a sostener 15 s completos');
}

console.log('\nir al monolito de video dentro de la ventana');
{
  const e = escena();
  e.ir(5.5, 0);
  e.ir(-5.5, 0, 1.0);      // camina 11 m (11 s) hasta el monolito de video
  check(e.s.estado === 'sosteniendo' && e.s.peso === 1, 'el sonido de la tarima se mantiene mientras va al monolito de video');
  check(e.v.estado === 'cerca' && e.v.peso === 1, 'el video llega a cerca');
  e.esperar(20);
  check(e.s.estado === 'sosteniendo' && e.s.congelado, 'quieto en el monolito de video: el sostén del sonido queda congelado (20 s más)');
  e.ir(-2.5, 3);   // se aleja del video (y también del sonido? no: se acerca en x al sonido)
  const log = e.log.join(' | ');
  check(e.v.estado === 'sosteniendo', `al alejarse del video, el video sostiene (${log.slice(-60)})`);
}

console.log('\nir a otro lado: retorno inmediato (progresivo) a los 0,6 s');
{
  const e = escena();
  e.ir(5.5, 0);
  const t0 = e.t;
  e.ir(6, 9, 1.4);          // se aleja de los dos (hacia +z): ambas distancias crecen
  const corte = e.log.find(l => l.includes('sonido retornando'));
  const tCorte = corte ? parseFloat(corte) - t0 : NaN;
  check(!!corte && tCorte < 2, `pasa a retornando enseguida (${tCorte.toFixed(2)} s después de dejar "cerca"), sin esperar 15 s`);
  check(e.s.peso < 1, `y el peso baja progresivamente (${e.s.peso.toFixed(2)})`);
}
{
  // cancelar exactamente a CANCELAR_S: alejarse de los dos a velocidad constante
  const s = crearMono(), v = crearMono();
  tickPar(s, v, 0.5, 12, DT, C);                 // cerca del de sonido
  let dS = 1.2, dV = 12.2, t = 0, tRet = NaN;
  for (let k = 0; k < 300; k++) { tickPar(s, v, dS, dV, DT, C); dS += 1.4 * DT; dV += 0.5 * DT; t += DT; if (s.estado === 'retornando') { tRet = t; break; } }
  check(Math.abs(tRet - C.CANCELAR_S) <= 2 * DT + 1e-9, `alejándose de los dos se cancela a los ${tRet.toFixed(3)} s (CANCELAR_S ${C.CANCELAR_S})`);
  const s2 = crearMono(), v2 = crearMono();
  tickPar(s2, v2, 0.5, 12, DT, C);
  let d2 = 1.2;
  for (let k = 0; k < 60 * 3; k++) { tickPar(s2, v2, d2, 12, DT, C); d2 += 1.4 * DT; }
  check(s2.estado === 'sosteniendo', 'alejándose solo del de sonido (el de video a la misma distancia) no cancela: sigue el sostén');
  const s3 = crearMono(), v3 = crearMono();
  tickPar(s3, v3, 0.5, 12, DT, C);
  let a = 1.2, b = 12, sentido = 1;
  for (let k = 0; k < 60 * 3; k++) { if (k % 30 === 0) sentido = -sentido; tickPar(s3, v3, a, b, DT, C); a += 1.4 * DT; b += sentido * 1.0 * DT; }
  check(s3.estado === 'sosteniendo', 'zigzag (nunca 0,6 s seguidos alejándose de los dos): no cancela');
}

console.log('\nmezcla equal-power');
{
  const m = { orig: 0, rem: 0 }; let maxErr = 0;
  for (let p = 0; p <= 1.0001; p += 0.01) { mezclaEqualPower(p, m); maxErr = Math.max(maxErr, Math.abs(m.orig * m.orig + m.rem * m.rem - 1)); }
  check(maxErr < 1e-12, `potencia total constante: orig² + rem² = 1 (error ${maxErr.toExponential(1)})`);
  mezclaEqualPower(0, m); check(m.orig === 1 && m.rem === 0, 'peso 0: solo el audio propio (sin interacción no cambia nada)');
  mezclaEqualPower(1, m); check(cerca(m.orig, 0, 1e-12) && m.rem === 1, 'peso 1: solo el remoto');
  mezclaEqualPower(0.5, m); check(cerca(m.orig, Math.SQRT1_2) && cerca(m.rem, Math.SQRT1_2), 'peso 0,5: −3 dB cada uno (sin hueco de volumen)');
}

console.log('\ncon y sin sesión');
check(pesoEfectivo(0.7, false, false, false) === 0.7, 'sin sesión: el peso mezcla la estática');
check(pesoEfectivo(0.7, true, false, false) === 0.7, 'con sesión: el peso mezcla la sesión');
check(pesoEfectivo(0.7, true, true, false) === 0 && pesoEfectivo(0.7, true, true, true) === 0.7, 'REQUIERE_ACEPTACION: sin aceptar no hay mezcla remota; aceptada sí');
check(pesoEfectivo(0.7, false, true, false) === 0.7, 'REQUIERE_ACEPTACION no frena la estática (no es transmisión)');
{
  const d = new Float32Array(96000); llenarPatronPrueba(d, 48000);
  let pico = 0, e = 0; for (const x of d) { pico = Math.max(pico, Math.abs(x)); e += x * x; }
  check(pico > 0.2 && pico < 1 && e / d.length > 0.003, `patrón de prueba de la sesión simulada: con señal y sin saturar (pico ${pico.toFixed(2)})`);
}
{
  const s = crearMono(), v = crearMono();
  tickPar(s, v, 0.5, 12, DT, C); tickPar(s, v, 5, 12, DT, C);
  reiniciarMono(s);
  check(s.estado === 'lejos' && s.peso === 0 && !s.alejandoseTrasCerca, 'Reiniciar vuelve a lejos');
  tickPar(s, v, 0.5, 12, 0, C); tickPar(s, v, 5, 12, 0, C); const r0 = s.sostenRestanteS;
  for (let k = 0; k < 100; k++) tickPar(s, v, 5, 12, 0, C);
  check(s.sostenRestanteS === r0, 'en la pausa central (dt = 0) el contador no avanza');
}

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
