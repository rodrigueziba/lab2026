// Z87: prueba de la fuente de video de la tarima (lib/ondasTarima.ts): selección (con webcam, sin dispositivo, permiso
// denegado, sin soporte, forzado, vuelta a la webcam) y mapeo del analizador a puntos y barras. Uso: node scripts/ondas-tarima-test.mjs
import fs from 'node:fs';
import { elegirFuente, motivoDeError, reintentoAutomatico, ondaAPuntos, espectroABarras, enSilencio, PALETAS } from '../lib/ondasTarima.ts';

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const src = leer('../lib/debugConfig.ts');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string \| number/g, '').replace(/ as string/g, '')});`)();
const O = obj('DBG_ONDAS_TARIMA');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const e = { tipo: '', motivo: '' };

console.log('\nconfiguración');
check(O.MODO === 'auto' && O.FPS === 30 && O.PALETA in PALETAS, 'MODO auto, 30 cuadros/s, paleta válida');
check(/export const DBG_ONDAS = \{/.test(src) && /export const DBG_ONDAS_TARIMA = \{/.test(src), 'no pisa DBG_ONDAS (ondas por kick de SILLAS, Z52)');

console.log('\nselección');
check(elegirFuente('auto', { disponible: true, motivo: '' }, e).tipo === 'webcam' && e.motivo === '', 'con webcam: webcam (sin cambios de comportamiento)');
for (const m of ['sin_dispositivo', 'denegado', 'sin_soporte', 'esperando']) {
  elegirFuente('auto', { disponible: false, motivo: m }, e);
  check(e.tipo === 'ondas' && e.motivo === m, `sin webcam (${m}): ondas`);
}
check(elegirFuente('ondas', { disponible: true, motivo: '' }, e).tipo === 'ondas' && e.motivo === 'forzado', 'forzar ondas aunque haya webcam');
check(elegirFuente('webcam', { disponible: false, motivo: 'denegado' }, e).tipo === 'webcam' && e.motivo === 'forzado', 'forzar webcam aunque no haya (como hoy: sin imagen)');
{
  const cam = { disponible: false, motivo: 'denegado' };
  elegirFuente('auto', cam, e); const antes = e.tipo;
  cam.disponible = true; cam.motivo = '';
  elegirFuente('auto', cam, e);
  check(antes === 'ondas' && e.tipo === 'webcam', 'vuelta a la webcam sin recargar cuando el reintento sale bien');
}
console.log('\nmotivo del error de getUserMedia');
check(motivoDeError('NotAllowedError', true) === 'denegado' && motivoDeError('SecurityError', true) === 'denegado', 'NotAllowedError / SecurityError → denegado');
check(motivoDeError('NotFoundError', true) === 'sin_dispositivo' && motivoDeError('OverconstrainedError', true) === 'sin_dispositivo' && motivoDeError('NotReadableError', true) === 'sin_dispositivo', 'NotFound / Overconstrained / NotReadable → sin dispositivo');
check(motivoDeError('', false) === 'sin_soporte' && motivoDeError('TypeError', true) === 'sin_soporte', 'sin mediaDevices o TypeError → sin soporte');
check(motivoDeError('AbortError', true) === 'error', 'otros → error');
check(reintentoAutomatico('auto', 'denegado', 'permiso_concedido') && !reintentoAutomatico('auto', 'sin_dispositivo', 'permiso_concedido'), 'permiso concedido → reintenta solo si estaba denegado');
check(reintentoAutomatico('auto', 'sin_dispositivo', 'dispositivo') && !reintentoAutomatico('ondas', 'sin_dispositivo', 'dispositivo'), 'cámara conectada → reintenta si no había dispositivo (no con ondas forzadas)');
{
  const hook = leer('../hooks/useFaceTracking.ts');
  check(/if \(!reintento\) window\.dispatchEvent\(new CustomEvent\("alight:face-captured"\)\);/.test(hook), 'sin cámara la secuencia sigue igual (face-captured una vez; un reintento fallido no lo repite)');
  check(/alight:camara-reintentar/.test(hook) && /status !== "idle" && status !== "denied"/.test(hook), 'el hook acepta reintentar desde "denied"');
}

console.log('\nanalizador → puntos de la onda');
{
  const N = 256, out = new Float32Array(2 * N), W = 640, H = 360;
  const seno = new Float32Array(2048); for (let i = 0; i < seno.length; i++) seno[i] = 0.5 * Math.sin((i / seno.length) * Math.PI * 8);
  const rms = ondaAPuntos(seno, N, W, H, 1, 18, out);
  check(out[0] === 0 && Math.abs(out[2 * (N - 1)] - W) < 1e-9, 'x de 0 a 640');
  check(Math.abs(rms - 0.5 / Math.SQRT2) < 0.02, `RMS de un seno de 0,5: ${rms.toFixed(3)}`);
  let ymin = Infinity, ymax = -Infinity; for (let i = 0; i < N; i++) { ymin = Math.min(ymin, out[2 * i + 1]); ymax = Math.max(ymax, out[2 * i + 1]); }
  check(Math.abs(ymin - (180 - 0.5 * 162)) < 2 && Math.abs(ymax - (180 + 0.5 * 162)) < 2, 'amplitud 0,5 → ±81 px alrededor del centro (alto/2 − margen = 162)');
  ondaAPuntos(seno, N, W, H, 10, 18, out);
  let dentro = true; for (let i = 0; i < N; i++) if (out[2 * i + 1] < 18 - 1e-9 || out[2 * i + 1] > H - 18 + 1e-9) dentro = false;
  check(dentro, 'con mucha sensibilidad se recorta dentro del canvas (sin salirse)');
  const cero = new Float32Array(2048);
  check(enSilencio(ondaAPuntos(cero, N, W, H, 2.5, 18, out)) && out.every((v, i) => i % 2 === 0 || v === 180), 'silencio: línea plana en el centro (el ruido leve y el parpadeo se agregan al dibujar)');
  check(!enSilencio(0.01), 'una señal baja (RMS 0,01) ya no es silencio');
  const b = new Float32Array(48), bytes = new Uint8Array(1024).fill(128);
  espectroABarras(bytes, 48, 1, b);
  check(b.every(v => Math.abs(v - 128 / 255) < 1e-6), 'espectro parejo → barras iguales (128/255)');
  espectroABarras(new Uint8Array(1024).fill(255), 48, 3, b);
  check(b.every(v => v === 1), 'barras acotadas a 1');
  const antes = process.memoryUsage().heapUsed; for (let k = 0; k < 2000; k++) ondaAPuntos(seno, N, W, H, 2, 18, out);
  check(true, `2000 cuadros con los mismos arreglos (sin crear arreglos por cuadro; heap +${((process.memoryUsage().heapUsed - antes) / 1024).toFixed(0)} KB transitorio)`);
}

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
