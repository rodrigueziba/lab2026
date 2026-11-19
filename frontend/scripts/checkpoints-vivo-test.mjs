// Z95: checkpoints de la prueba en vivo con dos ventanas ("sillas_recibir" y "tarima_compartir"): registro, parseo de
// ?cp= (válido, desconocido, vacío), posición de "sillas_recibir" (fuera de RADIO_INICIO_M, a menos de 5,5 m, mirando al
// monolito de sonido), que "tarima_compartir" abre el texto 2 sin atriles (lógica real del consentimiento) y lectura del
// código (acciones instaladas, gesto del navegador, limpieza). Uso: node scripts/checkpoints-vivo-test.mjs
import fs from 'node:fs';
import { buscarCheckpoint, checkpointDeUrl, posicionRecibir } from '../lib/checkpoints.ts';
import { crearConsent, iniciarConsent, forzarEleccion, atrilesPermitidos, elegirConsent } from '../lib/consentTarima.ts';

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const src = leer('../lib/debugConfig.ts');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string/g, '')});`)();
const CK = obj('DBG_CHECKPOINTS'), MV = obj('DBG_MONO_VIVO');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };

console.log('\nregistro');
const R = buscarCheckpoint('sillas_recibir'), T = buscarCheckpoint('tarima_compartir');
check(!!R && !!T, 'los dos checkpoints están registrados');
const nombres = c => c.pasos.map(p => p[0]);
check(['visualizador', 'amanecerFinal', 'pastoCompleto', 'esperarMonolitos', 'frenteMonolitos', 'avisoListo'].every(n => nombres(R).includes(n))
  && nombres(R).indexOf('avisoListo') > nombres(R).indexOf('frenteMonolitos'), 'sillas_recibir: visualizador + amanecer + pasto + monolitos + posición + aviso reiniciado (en ese orden)');
check(nombres(T).join() === 'base,remontar,base,spawn,cruzarTelon,esperarFrames,irATarima,esperarEvento,forzarDomo,esperarEvento,mostrarEleccion,esperarDialogo'
  && T.pasos.some(p => p[0] === 'esperarEvento' && p[1] === 'alight:people-visible'), 'tarima_compartir: tarima → domo ya → figuras en escena → elección abierta');
check(!nombres(R).some(n => /acept|decidir/i.test(n)), 'sillas_recibir no acepta el aviso por el usuario (solo lo reinicia)');

console.log('\nparámetro de URL');
const warns = []; const w0 = console.warn; console.warn = (...a) => warns.push(a);
check(checkpointDeUrl('?cp=sillas_recibir') === 'sillas_recibir' && checkpointDeUrl('?cp=tarima_compartir') === 'tarima_compartir', '?cp= válido');
check(checkpointDeUrl('?checkpoint=tarima_compartir') === 'tarima_compartir' && checkpointDeUrl('?checkpoint=visualizador') === 'visualizador', '?checkpoint= de Z40 sigue andando');
check(checkpointDeUrl('?cp=no_existe') === null && checkpointDeUrl('?cp=<script>') === null, 'desconocido: se ignora');
check(checkpointDeUrl('') === null && checkpointDeUrl('?cp=') === null && checkpointDeUrl('?otra=1') === null && checkpointDeUrl(undefined) === null, 'vacío o sin parámetro: nada');
check(checkpointDeUrl('?cp=%20sillas_recibir%20') === 'sillas_recibir', 'espacios alrededor: se recortan');
console.warn = w0;
check(warns.length === 0, 'sin avisos en la consola');

console.log('\nposición de sillas_recibir');
check(CK.RECIBIR_DIST_M === 5 && MV.RADIO_INICIO_M === 3, 'RECIBIR_DIST_M 5 m · RADIO_INICIO_M 3 m');
for (const [xL, xR, z] of [[-6, 6, 0], [-8.5, 8.5, 0.2], [-4, 4, 0]]) {
  const p = posicionRecibir({ x: xR, z }, CK.RECIBIR_DIST_M, { x: 0, z: 0, mirarX: 0, mirarZ: 0 });
  const dR = Math.hypot(p.x - xR, p.z - z), dL = Math.hypot(p.x - xL, p.z - z);
  const fx = p.mirarX - p.x, fz = p.mirarZ - p.z, n = Math.hypot(fx, fz);
  const cos = ((xR - p.x) * fx + (z - p.z) * fz) / (n * dR);
  check(dR > MV.RADIO_INICIO_M && dR < 5.5 && dL > dR && cos > 0.999 && Math.hypot(p.x, p.z) > 2.5 + 1,
    `monolitos en x=±${xR}: a ${dR.toFixed(2)} m del derecho (fuera del radio de ${MV.RADIO_INICIO_M} m, < 5,5 m), mirándolo; el izquierdo a ${dL.toFixed(1)} m; lejos de la zona de la tarima`);
}
{ const p = posicionRecibir({ x: 6, z: 0 }, CK.RECIBIR_DIST_M, { x: 0, z: 0, mirarX: 0, mirarZ: 0 });
  check(p.z < 0, 'del lado de las sillas (z menor que la línea de la tarima)'); }

console.log('\ntarima_compartir: texto 2 abierto, sin atriles');
{ const C = crearConsent();
  iniciarConsent(C, 0);                 // figuras en escena → espera inicial
  check(forzarEleccion(C, 100) && C.estado === 'eligiendo', 'mostrarEleccion = forzarEleccion: estado "eligiendo" (texto 2 con las dos opciones)');
  check(!atrilesPermitidos(C, true, true), 'los atriles siguen sin poder salir hasta elegir');
  const r = elegirConsent(C, 'privado', 'privado', 200);
  check(r.atriles && !r.publicar && atrilesPermitidos(C, true, true), 'al elegir (No compartir) salen los atriles; nada se publica sin elegir Compartir'); }

console.log('\nintegración (lectura del código)');
{ const A = leer('../lib/checkpointsAcciones.ts'), H = leer('../components/CheckpointsHost.tsx'), FD = leer('../components/FaceDome.tsx'), N = leer('../components/debug/pestanas/narrativa.tsx');
  for (const n of ['pastoCompleto', 'esperarMonolitos', 'frenteMonolitos', 'avisoListo', 'forzarDomo', 'mostrarEleccion'])
    check(new RegExp(`\\n  ${n}: `).test(A), `acción "${n}" instalada`);
  check(/mostrarEleccion: \(\) => \{ mostrarEleccionAhora\(\); return true; \}/.test(A), 'mostrarEleccion = el botón "Mostrar elección ahora" (misma lógica)');
  check(/avisoListo: \(\) => \{ reiniciarDecisionAviso\(\); reiniciarMonolitosVivo\(\); return true; \}/.test(A), 'el aviso se reinicia (vuelve a preguntar al entrar al radio)');
  check(/alight:debug-mostrar-domo/.test(FD) && /removeEventListener\("alight:debug-mostrar-domo", onMostrar\)/.test(FD), 'FaceDome: mostrar el domo ya (con limpieza)');
  check(/detenerLiveKit\(\);\n  detenerPresencia\(\);/.test(A), 'base: sin transmisión ni presencia del checkpoint anterior');
  check(/checkpointDeUrl\(window\.location\.search\)/.test(H) && /DBG_CHECKPOINTS\.HABILITADOS && \(DEBUG_ENABLED \|\| leerPremio\(\)\)/.test(H), 'URL: solo con checkpoints habilitados y debug (DEBUG_ENABLED o premio)');
  check(/userActivation\?\.hasBeenActive/.test(H) && /botonEntrar\(id\)/.test(H), 'sin gesto previo: botón ENTRAR (habilita el audio) antes de aplicar');
  check(/CHECKPOINTS\.map\(c =>/.test(N), 'el menú "Narrativa y checkpoints" lista todos los del registro (los dos nuevos incluidos)'); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
