// Z86: prueba del historial del slit-scan (lib/tiempoHistorial.ts): fila → retraso con cada curva y dirección, índice y
// mezcla entre cuadros del anillo, tamaño del anillo, armado y desarmado, pre-roll, congelado en pausa; y que el GLSL
// replique la lógica y que con k = 0 el pase final no cambie. Uso: node scripts/tiempo-historial-test.mjs
import fs from 'node:fs';
import {
  tamAnillo, fraccionFila, retrasoFila, crearAnillo, vaciarAnillo, tickCaptura, leerHistorial, crearArmado, tickArmado,
  decaimientoEstela, megabytes, tamHistorial,
} from '../lib/tiempoHistorial.ts';

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const src = leer('../lib/debugConfig.ts');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string \| number/g, '').replace(/ as string/g, '')});`)();
const T = obj('DBG_TIEMPO');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const cerca = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const SIN_ONDA = { ...T, ONDA_AMP: 0 };

console.log('\nconfiguración');
check(T.ESTILO === 'slitscan' && T.RETRASO_MAX_S === 1.2 && T.HIST_HZ === 20 && T.HIST_ESCALA === 0.5 && T.PERSISTENCIA_S === 0.35 && T.DESFASE_RGB_S === 0.05 && T.DESARMAR_S === 2, 'defaults: slit-scan, 1,2 s, 20 Hz, 0,5 de escala, estela 0,35 s, desfase 0,05 s, desarme 2 s');
check(T.RETRASO && T.ESTELA && T.DESFASE && T.BANDA && T.PRE_ROLL === 'al_acercarse', 'los cuatro efectos encendidos y pre-roll al acercarse');
check(T.DURACION_S === 6 && T.CORTE_S === 1 && T.RATE_MIN === 0.5, 'constantes de Z84 sin cambios');

console.log('\nfila → retraso');
check(cerca(fraccionFila(1, SIN_ONDA), 0) && cerca(fraccionFila(0, SIN_ONDA), 1), '"abajo_mas_viejo": arriba retraso 0 (lo más reciente), abajo el máximo');
check(cerca(fraccionFila(1, { ...SIN_ONDA, DIRECCION: 'arriba_mas_viejo' }), 1) && cerca(fraccionFila(0, { ...SIN_ONDA, DIRECCION: 'arriba_mas_viejo' }), 0), '"arriba_mas_viejo": al revés');
check(cerca(fraccionFila(0.5, SIN_ONDA), 0.5) && cerca(fraccionFila(0.25, SIN_ONDA), 0.75), 'lineal: crece parejo de una fila a otra');
check(cerca(fraccionFila(0.75, { ...SIN_ONDA, CURVA: 'suave' }), 0.15625) && cerca(fraccionFila(0.5, { ...SIN_ONDA, CURVA: 'suave' }), 0.5), 'suave: smoothstep');
check(cerca(fraccionFila(0.5, { ...SIN_ONDA, EXPONENTE: 2 }), 0.25), 'exponente 2: el retraso se concentra abajo');
let mono = true; for (let y = 1; y >= 0; y -= 0.01) if (fraccionFila(y, SIN_ONDA) < fraccionFila(y + 0.01, SIN_ONDA) - 1e-12) mono = false;
check(mono, 'sin escalones ni inversiones entre filas (monótona)');
check(cerca(retrasoFila(0, 1, 0, SIN_ONDA), 1.2) && cerca(retrasoFila(0, 0.5, 0, SIN_ONDA), 0.6) && retrasoFila(0, 0, 0, SIN_ONDA) === 0, 'retraso = k · RETRASO_MAX_S · fracción: al decaer k se vuelve a sincronizar');
let maxOnda = 0; for (let t = 0; t < 20; t += 0.1) for (let y = 0; y <= 1; y += 0.05) { const d = retrasoFila(y, 1, t, T); maxOnda = Math.max(maxOnda, Math.abs(d - retrasoFila(y, 1, t, SIN_ONDA))); if (d < 0) maxOnda = 99; }
check(maxOnda <= 1.2 * T.ONDA_AMP + 1e-9, `ondulación lenta acotada (± ${(maxOnda * 1000).toFixed(0)} ms) y nunca negativa`);

console.log('\nanillo');
check(tamAnillo(T) === Math.ceil(1.2 * 20) + 2, `tamaño "auto" = ceil(1,2 × 20) + 2 = ${tamAnillo(T)}`);
check(tamAnillo({ ...T, HIST_N: 10 }) === 10 && tamAnillo({ ...T, RETRASO_MAX_S: 100 }) === 120 && tamAnillo({ ...T, HIST_N: 0 }) === 2, 'HIST_N fijo y límites 2…120');
{
  const a = crearAnillo(5); const capas = [];
  for (let i = 0; i < 60 * 1; i++) { const c = tickCaptura(a, 1 / 60, 20); if (c >= 0) capas.push(c); }
  check(capas.length === 20 || capas.length === 21, `a 20 Hz: ${capas.length} capturas en 1 s (una por cuadro como máximo)`);
  check(capas.slice(0, 7).join(',') === '0,1,2,3,4,0,1' && a.disponibles === 5, 'el anillo da la vuelta y queda lleno');
  const k0 = a.nueva, e0 = a.edad;
  for (let i = 0; i < 100; i++) tickCaptura(a, 0, 20);
  check(a.nueva === k0 && a.edad === e0, 'en pausa (dt = 0) no captura y la edad no avanza: congelado');
  vaciarAnillo(a); check(a.disponibles === 0 && a.nueva === -1, 'vaciar');
}
{
  const a = { n: 26, nueva: 10, disponibles: 26, edad: 0.02, acc: 0 }, L = { a: 0, b: 0, f: 0, vivo: 0 };
  leerHistorial(0, a, 20, L); check(L.vivo === 1, 'retraso 0: el cuadro en vivo (fila de arriba)');
  leerHistorial(0.01, a, 20, L); check(cerca(L.vivo, 0.5) && L.a === 10, 'retraso menor que la edad de la capa nueva: mezcla vivo con la más nueva (sin escalón)');
  leerHistorial(0.02 + 0.075, a, 20, L);
  check(L.vivo === 0 && L.a === 9 && L.b === 8 && cerca(L.f, 0.5), '1,5 cuadros atrás: mezcla 50/50 de las capas 9 y 8');
  leerHistorial(0.02 + 0.5, a, 20, L);
  check(L.a === 0 && L.b === 25 && cerca(L.f, 0), '10 cuadros atrás: da la vuelta por el anillo (capa 0 → 25)');
  let maxSalto = 0, prev = null;
  for (let d = 0.02; d < 1.2; d += 0.001) { leerHistorial(d, a, 20, L); const pos = (10 - L.a + 26) % 26 + L.f; if (prev !== null && pos < 25) maxSalto = Math.max(maxSalto, Math.abs(pos - prev)); prev = pos; }
  check(maxSalto < 0.05, 'interpolación continua entre cuadros vecinos (sin escalones entre filas)');
  const corto = { n: 26, nueva: 3, disponibles: 4, edad: 0, acc: 0 };
  leerHistorial(1.2, corto, 20, L);
  check(L.a === 0 && L.f === 0, 'historial más corto que el retraso pedido: usa el cuadro más viejo disponible');
  leerHistorial(0.5, { n: 26, nueva: -1, disponibles: 0, edad: 0, acc: 0 }, 20, L);
  check(L.vivo === 1, 'sin historial: el cuadro en vivo');
}

console.log('\narmado, desarmado y pre-roll');
{
  const st = crearArmado();
  tickArmado(st, false, false, 0, 1 / 60, T); check(!st.armado, 'lejos y sin efecto: desarmado (costo cero)');
  tickArmado(st, true, false, 0, 1 / 60, T); check(st.armado, 'al_acercarse: se arma al entrar al radio sin sesión (pre-roll)');
  const st2 = crearArmado(); tickArmado(st2, true, true, 0, 1 / 60, T);
  check(!st2.armado, 'con sesión no se arma');
  const st3 = crearArmado(); tickArmado(st3, true, false, 0, 1 / 60, { ...T, PRE_ROLL: 'al_disparar' });
  check(!st3.armado, 'al_disparar: acercarse no arma');
  tickArmado(st3, false, false, 0.4, 1 / 60, { ...T, PRE_ROLL: 'al_disparar' }); check(st3.armado, 'al_disparar: se arma con k > 0');
  for (let i = 0; i < Math.round(1.9 * 60); i++) tickArmado(st3, false, false, 0, 1 / 60, T);
  check(st3.armado, 'con k = 0 sigue armado durante DESARMAR_S');
  for (let i = 0; i < 12; i++) tickArmado(st3, false, false, 0, 1 / 60, T);
  check(!st3.armado, 'y se desarma a los 2 s');
  const st4 = crearArmado(); tickArmado(st4, false, false, 1, 1 / 60, T);
  for (let i = 0; i < 600; i++) tickArmado(st4, false, false, 0, 0, T);
  check(st4.armado, 'en pausa (dt = 0) el desarme no avanza');
}

console.log('\nestela y memoria');
check(cerca(decaimientoEstela(T.PERSISTENCIA_S, T.PERSISTENCIA_S), Math.exp(-1)) && decaimientoEstela(0, 0.35) === 1, 'estela: decae e^(−dt/PERSISTENCIA_S); en pausa no decae');
{
  const t1 = tamHistorial(1920, 1080, 0.5, 1280), t4 = tamHistorial(3840, 2160, 0.5, 1280);
  check(t1.w === 960 && t1.h === 540 && t4.w === 1280 && t4.h === 720, 'tamaño del historial: 1080p → 960×540; 4K → tope 1280×720');
  const mb = megabytes(t1.w, t1.h, tamAnillo(T) + 2);
  check(mb > 50 && mb < 60, `memoria a 1080p: ${mb.toFixed(1)} MB (26 capas RGBA8 + 2 de estela)`);
}

console.log('\nGLSL y pase final');
{
  const glsl = leer('../lib/retro/tiempoDetenido.ts'), pf = leer('../lib/retro/paseFinal.ts');
  check(/float f = uRetro\.y > 0\.5 \? clamp\(y, 0\.0, 1\.0\) : 1\.0 - clamp\(y, 0\.0, 1\.0\);/.test(glsl) && /if \(uRetro\.z > 0\.5\) f = f \* f \* \(3\.0 - 2\.0 \* f\);/.test(glsl), 'el shader replica la fracción de fila (dirección y curva)');
  check(/float x = min\(\(d - edad\) \* uOnda\.z, disp - 1\.0\);/.test(glsl) && /if \(d < edad\) return mix\(tdCapa\(p, nueva\), vivo, 1\.0 - d \/ max\(edad, 1e-6\)\);/.test(glsl), 'el shader replica la lectura del anillo (cuadros atrás, vivo con la más nueva)');
  check(/vec3 escena\(vec2 p\) \{\s*if \(uTiempoK > 0\.0 && uTiempoSlit > 0\.5\) return escenaTiempoDetenido\(p, uTiempoK, uTiempoT\);\s*return escenaBase\(p\);/.test(pf), 'con k = 0 escena() devuelve la lectura original: imagen idéntica');
  check(/if \(HIST_PLAN\.armado\) HISTORIAL\.paso\(renderer, readBuffer, u\);/.test(pf), 'sin armar no se captura ni se calcula la estela (costo cero)');
  check(/sampler2DArray uHist/.test(glsl) && /WebGLArrayRenderTarget/.test(leer('../lib/retro/historialTiempo.ts')), 'historial en una textura de capas (WebGL2), no en miniaturas');
}

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
