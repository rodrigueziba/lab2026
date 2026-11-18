// Z83: prueba del domo con la sesión en vivo (lib/domoVivo.ts): repeticiones, proporción, bordes, sector, pesos y que
// con uRemoteMix = 0 el shader no cambie nada (la rama queda fuera). Uso: node scripts/domo-vivo-test.mjs
import fs from 'node:fs';
import { geometriaFranja, mapearFranja, pesosDomo, TAU } from '../lib/domoVivo.ts';

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const src = leer('../lib/debugConfig.ts');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string/g, '')});`)();
const C = obj('DBG_DOMO_VIVO');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const cerca = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const dir = (azV, elDeg) => { const e = elDeg * Math.PI / 180, a = azV * TAU; return [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)]; };
const m = { u: 0, v: 0, dentro: 0, mascara: 0 };

console.log('\nconfiguración');
check(C.ACTIVO === true && C.REPETICIONES === 6 && C.COBERTURA === 'banda' && C.FPS === 15 && C.FORZAR === 'ninguno', 'ACTIVO, 6 repeticiones, banda de 360°, 15 cuadros/s, sin forzar');

console.log('\nbanda: 6 repeticiones alrededor de la franja');
{
  const g = geometriaFranja(C, 0, {});
  check(g.rep === 6 && cerca(g.anchoV, 1 / 6), 'cada imagen ocupa 60°');
  check(cerca(g.anchoV * TAU / g.alto, 16 / 9), `proporción 16:9 sin deformar (alto ${g.alto.toFixed(3)} en tan(elev))`);
  const elC = Math.atan(g.centro) * 180 / Math.PI, elLo = Math.atan(g.centro - g.alto / 2) * 180 / Math.PI, elHi = Math.atan(g.centro + g.alto / 2) * 180 / Math.PI;
  check(elLo > 0 && elHi < 45 && cerca(elC, C.ELEV_CENTRO_DEG, 1e-9), `la franja va de ${elLo.toFixed(1)}° a ${elHi.toFixed(1)}° de elevación (sobre el horizonte)`);
  const elCentro = Math.atan(g.centro) * 180 / Math.PI;
  const centros = [];
  for (let k = 0; k < 6; k++) { mapearFranja(...dir(k / 6, elCentro), g, m); centros.push([m.u, m.v, m.mascara]); }
  check(centros.every(([u, v, k]) => cerca(u, 0.5, 1e-9) && cerca(v, 0.5, 0.02) && cerca(k, 1, 1e-9)), 'cada 60° (desde el portal) cae el centro de una imagen, con máscara 1');
  mapearFranja(...dir(1 / 12, elCentro), g, m);
  check(m.dentro === 1 && m.mascara < 1e-6 && (cerca(m.u, 0, 1e-9) || cerca(m.u, 1, 1e-9)), 'a 30° del centro está el borde entre dos imágenes (máscara 0: borde suave)');
  mapearFranja(...dir(1 / 12 - 0.5 * C.BORDE / 6, elCentro), g, m);
  check(m.mascara > 0.1 && m.mascara < 0.9, `a medio borde la máscara está a mitad (${m.mascara.toFixed(2)})`);
  let ida = 0, total = 0;
  for (let az = 0; az < 1; az += 1 / 360) { mapearFranja(...dir(az, elCentro), g, m); total++; if (m.dentro) ida++; }
  check(ida === total, 'toda la franja (360°) queda cubierta a la altura del centro');
  mapearFranja(...dir(0.2, 60), g, m);
  check(m.dentro === 0 && m.mascara === 0, 'arriba de la franja (60°) no hay imagen');
  mapearFranja(...dir(0.2, -5), g, m);
  check(m.dentro === 0, 'bajo el horizonte no hay imagen');
  // u crece hacia la derecha del espectador (horario visto desde arriba = como el azimut)
  mapearFranja(...dir(0.01, elCentro), g, m); const u1 = m.u; mapearFranja(...dir(0.02, elCentro), g, m);
  check(m.u > u1, 'u crece con el azimut (la imagen no sale espejada)');
  mapearFranja(...dir(0, elCentro + 5), g, m); const v1 = m.v; mapearFranja(...dir(0, elCentro - 5), g, m);
  check(v1 > m.v, 'v crece hacia arriba (la imagen no sale invertida, con flipY de la textura)');
}

console.log('\nsector');
{
  const g = geometriaFranja({ ...C, COBERTURA: 'sector', SECTOR_ANCHO_DEG: 70 }, 0.25, {});
  check(g.sector === 1 && g.rep === 1 && cerca(g.anchoV, 70 / 360), 'una sola imagen de 70°');
  const el = Math.atan(g.centro) * 180 / Math.PI;
  mapearFranja(...dir(0.25, el), g, m);
  check(cerca(m.u, 0.5, 1e-9) && m.mascara === 1, 'centrada en el azimut del portal');
  mapearFranja(...dir(0.25 + 34 / 360, el), g, m); const dentro34 = m.dentro;
  mapearFranja(...dir(0.25 + 36 / 360, el), g, m);
  check(dentro34 === 1 && m.dentro === 0, 'dentro hasta ±35° y afuera después');
  mapearFranja(...dir(0.75, el), g, m);
  check(m.dentro === 0, 'del lado opuesto no hay imagen (el visualizador se apaga con FONDO)');
  const g2 = geometriaFranja({ ...C, COBERTURA: 'sector', SECTOR_DESPLAZ_DEG: 90 }, 0, {});
  check(cerca(g2.az0, 0.25), 'SECTOR_DESPLAZ_DEG gira el centro');
}

console.log('\npesos (monolito de video de Z82)');
{
  const p = { mix: 0, staticMix: 0, remoteOn: 0, necesitaVideo: false };
  const E = (o = {}) => ({ activo: true, benchOn: true, forzar: 'ninguno', pesoVideo: 0, haySesion: false, ...o });
  pesosDomo(E(), p); check(p.mix === 0 && !p.necesitaVideo, 'lejos del monolito: mezcla 0 y sin video (no se sube textura)');
  pesosDomo(E({ pesoVideo: 0.4 }), p); check(p.mix === 0.4 && p.staticMix === 1 && p.remoteOn === 0 && !p.necesitaVideo, 'sin sesión: estática con el peso del monolito');
  pesosDomo(E({ pesoVideo: 0.4, haySesion: true }), p); check(p.mix === 0.4 && p.staticMix === 0 && p.remoteOn === 1 && p.necesitaVideo, 'con sesión: video con el peso del monolito');
  pesosDomo(E({ pesoVideo: 1, activo: false }), p); check(p.mix === 0, 'ACTIVO = false: mezcla 0 (domo como estaba)');
  pesosDomo(E({ pesoVideo: 1, benchOn: false }), p); check(p.mix === 0, 'benchmark "videoDomo" apagado: mezcla 0');
  pesosDomo(E({ forzar: 'video' }), p); check(p.mix === 1 && p.remoteOn === 1 && p.staticMix === 0 && p.necesitaVideo, 'Forzar video 100 %');
  pesosDomo(E({ forzar: 'estatica', haySesion: true }), p); check(p.mix === 1 && p.remoteOn === 0, 'Forzar estática 100 % (aunque haya sesión)');
  pesosDomo(E({ forzar: 'apagar', pesoVideo: 1, haySesion: true }), p); check(p.mix === 0, 'Apagar');
  pesosDomo(E({ pesoVideo: 7 }), p); check(p.mix === 1, 'peso acotado a 0…1');
}

console.log('\nshader, DomeSky, SPEC y domeShaders');
{
  const frag = leer('../app/alight/dome/dome.frag.glsl'), ts = leer('../app/alight/dome/domeShaders.ts');
  const sky = leer('../app/alight/dome/DomeSky.tsx'), spec = leer('../../docs/dome/SPEC.md');
  const nuevos = ['uRemoteTex', 'uRemoteMix', 'uStaticMix', 'uRemoteOn', 'uVivoGeo', 'uVivoCob', 'uVivoBorde', 'uVivoFondo', 'uVivoT', 'uEstatica'];
  check(nuevos.every(n => new RegExp(`uniform \\w+\\s+${n};`).test(frag) && sky.includes(`${n}:`) && spec.includes('`' + n + '`')), `${nuevos.length} uniforms nuevos en el shader, en DomeSky y en SPEC.md`);
  const enTs = ts.slice(ts.indexOf('export const domeFrag = `') + 'export const domeFrag = `'.length, ts.lastIndexOf('`;'));
  check(enTs === frag, 'domeShaders.ts regenerado con el mismo fragment');
  // con uRemoteMix = 0 la rama no se ejecuta: todo lo que escribe col está dentro del if
  const i = frag.indexOf('if (uRemoteMix > 0.0) {'), j = frag.indexOf('float a = smoothstep(-0.015, 0.015, d.y);');
  const rama = frag.slice(i, j);
  let prof = 0, fin = -1;
  for (let k = rama.indexOf('{'); k < rama.length; k++) { if (rama[k] === '{') prof++; else if (rama[k] === '}') { prof--; if (prof === 0) { fin = k; break; } } }
  const despues = rama.slice(fin + 1);
  check(i > 0 && fin > 0 && !/col\s*=/.test(despues) && /col = mix\(col, cont, uRemoteMix \* masc\);/.test(rama), 'con uRemoteMix = 0 el color no cambia: toda escritura de col está dentro de if (uRemoteMix > 0.0)');
  check(/uRemoteMix\.value = p\.mix;\s*\n\s*if \(p\.mix <= 0\) return;/.test(leer('../lib/domoVivoAcciones.ts')), 'con mezcla 0 no se toca ninguna textura (return antes de la fuente de video)');
}

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
