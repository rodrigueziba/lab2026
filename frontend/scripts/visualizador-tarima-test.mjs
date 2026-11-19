// Z98: visualizador retro de la tarima sin cámara (lib/visualizadorTarima.ts, lib/visualizadorTarimaDibujo.ts) y su módulo
// VISUALIZADOR en el atril IMAGEN IM-40. (a) paletas; (b) historial circular; (c) suavizado; (d) eje logarítmico;
// (e) retardo XY; (f) silencio y NaN; (g) radios ESTILO / PALETA; (h) lectura de código del bucle de dibujo;
// (i) layout del atril sin colisiones ni textos cortados a 0,7, 1,0 y 1,15. Uso: node scripts/visualizador-tarima-test.mjs
import fs from 'node:fs';
import { register } from 'node:module';
const RAIZ = new URL('../', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`const R = ${JSON.stringify(RAIZ)};
export async function resolve(s, c, n) {
  if (s.startsWith('@/')) s = R + s.slice(2);
  if ((/^\\.\\.?\\//.test(s) || s.startsWith('file:')) && !/\\.[a-z]+$/.test(s)) { try { return await n(s + '.ts', c); } catch {} }
  return n(s, c);
}`));
const V = await import('../lib/visualizadorTarima.ts');
const { FRANJAS_PLACA } = await import('../lib/marca.ts');
const I = await import('../lib/atrilImagen.ts');
const S = await import('../lib/atrilSonido.ts');

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const DIB = leer('../lib/visualizadorTarimaDibujo.ts'), PURO = leer('../lib/visualizadorTarima.ts'), FV = leer('../lib/fuenteVideoTarima.ts');
const LS = leer('../components/LecternSystem.tsx'), CFG = leer('../lib/debugConfig.ts'), AS = leer('../components/AtrilSonidoNuevo.tsx'), AI = leer('../components/AtrilImagenNuevo.tsx');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(CFG)[1].replace(/ as string/g, '')});`)();
const D = obj('DBG_ONDAS_TARIMA');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const fin = a => Array.from(a).every(Number.isFinite);

console.log('\nconstantes');
check(D.ESTILO === 'cascada' && D.PALETA === 'ambar' && D.VISUALIZADOR_NUEVO === true && D.LINEAS === 24 && D.COLOR_VELOC === 0.15 && D.ROTULO === true
  && D.XY_RETARDO >= 8 && D.XY_RETARDO <= 12, `DBG_ONDAS_TARIMA: cascada · ámbar, 24 líneas, COLOR_VELOC 0,15, retardo XY ${D.XY_RETARDO}, rótulo visible`);
check(!/^export const PALETA_PROYECTO/m.test(PURO) && !/^import /m.test(PURO), 'lib/visualizadorTarima.ts no tiene imports (lógica pura)');

console.log('\n(a) paletas');
check(V.PALETA_FIJA.ambar.trazo === '#FF9A1F' && V.hexARgb(V.PALETA_FIJA.ambar.trazo).join() === '255,154,31' && V.FONDO_VIS === '#0b0703', 'ÁMBAR: rgba(255,154,31) sobre #0b0703 (el de siempre)');
check(V.PALETA_FIJA.fosforo.trazo === '#33FF66' && V.PALETA_FIJA.fosforo.brillo === '#C8FFD2', 'FÓSFORO: verde #33FF66 con brillo #C8FFD2');
check(FRANJAS_PLACA.join() === '#E5322B,#F0742A,#F4B62E,#2E9E5B,#1F7FB8', 'franjas de las placas (lib/marca.ts): rojo, naranja, amarillo, verde, azul');
check(/import \{ FRANJAS_PLACA \} from "@\/lib\/marca";/.test(DIB) && /tablaColores\(FRANJAS_PLACA, N_TABLA\)/.test(DIB) && /FRANJAS_PLACA\[i % k\]/.test(DIB)
  && /const FRANJAS = FRANJAS_PLACA;/.test(AS) && /const FRANJAS = FRANJAS_PLACA;/.test(AI), 'IDENTIDAD usa EXACTAMENTE FRANJAS_PLACA; las placas de los dos atriles la importan (sin copias)');
{ const T = V.tablaColores(FRANJAS_PLACA, 5);
  check(T.join() === FRANJAS_PLACA.map(h => `rgb(${V.hexARgb(h).join(',')})`).join(), 'la tabla de IDENTIDAD con 5 colores da exactamente las 5 franjas, en orden');
  const a = V.indiceColor(0.3, 2, 0.15, 5), b = V.indiceColor(0.3, 2 + 1 / 0.15, 0.15, 5), c = V.indiceColor(0.3, 3, 0.15, 5);
  check(Math.abs(a - b) < 1e-9 && c !== a && a >= 0 && a < 5, `el índice avanza con el tiempo (${a.toFixed(2)} → ${c.toFixed(2)}) y es periódico (período 1/0,15 s)`);
  let okR = true; for (let t = -10; t < 50; t += 0.37) for (let p = 0; p <= 1; p += 0.1) { const i = V.indiceColor(p, t, 0.15, 5); if (!(i >= 0 && i < 5)) okR = false; }
  check(okR && V.indiceColor(NaN, NaN, NaN, 5) === 0, 'siempre dentro de [0, 5), también con tiempo negativo o NaN'); }

console.log('\n(b) historial circular');
{ const h = V.crearHistorial(4, 3), largo = h.data.length, buf = h.data;
  for (let k = 1; k <= 10; k++) V.escribirLinea(h, [k / 10, k / 10, k / 10]);
  const edades = [0, 1, 2, 3].map(e => h.data[V.offsetLinea(h, e)]);
  check(h.data.length === largo && h.data === buf && h.cuenta === 4, '10 escrituras en 4 líneas: el buffer no crece ni se reemplaza');
  check(edades.map(x => x.toFixed(1)).join() === '1.0,0.9,0.8,0.7', `orden por edad (la más nueva primero): ${edades.map(x => x.toFixed(1)).join(', ')}`); }

console.log('\n(c) suavizado');
{ let v = 0; const sube = []; for (let i = 0; i < 3; i++) { v = V.suavizar(v, 1, 0.6, 0.12); sube.push(v); }
  let w = 1; const baja = []; for (let i = 0; i < 3; i++) { w = V.suavizar(w, 0, 0.6, 0.12); baja.push(w); }
  check(sube[0] > 1 - baja[0] && sube[2] > 0.9 && baja[2] > 0.6, `sube rápido (${sube.map(x => x.toFixed(2)).join(' ')}) y baja lento (${baja.map(x => x.toFixed(2)).join(' ')})`);
  let okR = true; for (const [p, n, s, b] of [[2, -5, 3, 3], [NaN, 0.5, 0.5, 0.5], [0.5, Infinity, 1, 1], [-1, 2, -1, 9]]) { const r = V.suavizar(p, n, s, b); if (!(r >= 0 && r <= 1)) okR = false; }
  check(okR, 'nunca sale de [0, 1] (entradas fuera de rango, NaN o infinitas)'); }

console.log('\n(d) eje de frecuencia logarítmico');
{ let mono = true, dentro = true, prev = -1;
  for (let x = 0; x <= 1.0001; x += 0.01) { const f = V.frecLog(x, 0.006, 0.75); if (f < prev) mono = false; if (!(f >= 0 && f <= 1)) dentro = false; prev = f; }
  check(mono && dentro, 'frecLog monótona creciente y dentro de [0, 1]');
  check(V.frecLog(0.5, 0.006, 1) < V.frecLog(0.5, 0.006, 0), 'con FREC_SUAVE 1 la mitad del eje cae en frecuencias más bajas que con 0 (logarítmica)');
  const out = new Float32Array(96), bytes = new Uint8Array(1024).fill(255);
  V.espectroALinea(bytes, 1024, 96, 1, 0.006, 0.75, out);
  check(Array.from(out).every(v => v === 1), 'espectro lleno → todas las columnas en 1 (acotado)'); }

console.log('\n(e) XY con retardo');
{ const onda = new Float32Array(64).map((_, i) => Math.sin(i / 3)), out = new Float32Array(4096);
  const n = V.puntosXY(onda, null, 64, 512, 10, 0, 0, 1, 1, out);
  check(n === 54 && Math.abs(out[1] + onda[10]) < 1e-6 && Math.abs(out[0] - onda[0]) < 1e-6, `mono: X = muestra i, Y = muestra i + 10 (${n} puntos de 64 − 10)`);
  check(V.retardoSeguro(64, 500) === 62 && V.retardoSeguro(64, -3) === 1 && V.retardoSeguro(3, 10) === 1, 'retardo acotado: nunca se lee fuera del arreglo');
  const prox = new Proxy(onda, { get: (t, k) => { if (typeof k === 'string' && /^\d+$/.test(k) && +k >= t.length) throw new Error('fuera de rango ' + k); return Reflect.get(t, k); } });
  let err = ''; try { for (const r of [0, 1, 10, 63, 64, 1000]) V.puntosXY(prox, null, 64, 2048, r, 0, 0, 1, 1, out); } catch (e) { err = e.message; }
  check(!err, `sin accesos fuera de rango con retardos 0…1000${err ? ': ' + err : ''}`);
  const der = new Float32Array(64).map((_, i) => Math.cos(i / 3)), n2 = V.puntosXY(onda, der, 64, 64, 10, 0, 0, 1, 1, out);
  check(n2 === 64 && Math.abs(out[3] + der[1]) < 1e-6, 'estéreo: X = izquierdo, Y = derecho');
  check(V.casiMono(onda, onda, 64) && !V.casiMono(onda, der, 64), 'canales iguales → se usa el retardo (el XY estéreo sería una diagonal)');
  check(/an\.connect\(sp\); sp\.connect\(aL, 0\); sp\.connect\(aR, 1\);/.test(DIB) && !/aL\.connect\(|aR\.connect\(|sp\.connect\([^a]/.test(DIB.replace('sp.connect(aL, 0); sp.connect(aR, 1);', ''))
    && /x\.fuente\.disconnect\(x\.sp\)/.test(DIB), 'estéreo en derivación: maestro → divisor → 2 analizadores (sin salida); se desconecta al soltar'); }

console.log('\n(f) silencio y NaN');
{ const out = new Float32Array(200), z = new Float32Array(128), nan = new Float32Array(128).fill(NaN);
  V.espectroALinea(new Uint8Array(512), 512, 96, 2, 0.006, 0.75, out);
  check(fin(out) && out.every(v => v === 0) && V.rmsSeguro(z, 128) === 0 && V.rmsSeguro(nan, 128) === 0, 'silencio total: espectro en 0 y RMS 0');
  const n = V.puntosXY(nan, nan, 128, 64, 10, 320, 180, 100, 3, out);
  check(fin(out.subarray(0, 2 * n)) && out[0] === 320 && out[1] === 180, 'NaN en la onda → puntos en el centro, sin valores inválidos');
  const h = V.crearHistorial(3, 4); V.escribirLinea(h, [NaN, Infinity, -1, 2]);
  check(fin(h.data) && Array.from(h.data.subarray(V.offsetLinea(h, 0), V.offsetLinea(h, 0) + 4)).join() === '0,0,0,1', 'el historial nunca guarda NaN ni valores fuera de [0, 1]');
  check(/if \(silencio\) sinSenal\(/.test(DIB) && /const cuantas = silencio \? 1 :/.test(DIB) && /SIN SEÑAL/.test(DIB), 'sin audio: "SIN SEÑAL" parpadeando y una sola línea plana (no recorre el historial)'); }

console.log('\n(g) radios ESTILO y PALETA');
{ const e = [0, 0], p = [0, 0, 0];
  check(V.radio(['cascada', 'xy'], 'xy', e).join() === '0,1' && V.radio(['ambar', 'fosforo', 'identidad'], 'identidad', p).join() === '0,0,1', 'uno solo encendido por grupo');
  check(V.radio(['cascada', 'xy'], 'onda', e).join() === '1,0', 'un estilo de Z87 (onda) enciende el primero (CASCADA): nunca quedan dos ni ninguno');
  check(/function elegirVis\(grupo: "estilo" \| "paleta", valor: string\): void \{[\s\S]{0,200}sincronizarVis\(\);/.test(LS)
    && /onActivate: \(\) => elegirVis\("estilo", "cascada"\)/.test(LS) && /onActivate: \(\) => elegirVis\("paleta", "identidad"\)/.test(LS),
    'cada pad elige su valor y resincroniza el grupo (apretar el ya elegido lo deja encendido)');
  check(V.textoRotulo('cascada', 'ambar') === 'CASCADA · ÁMBAR' && V.textoRotulo('xy', 'identidad') === 'XY · IDENTIDAD', 'rótulo "CASCADA · ÁMBAR" / "XY · IDENTIDAD"');
  check(/id\.startsWith\("vis_"\) && def\.type === "toggle" \? \(FUENTE_TARIMA\.eleccion\.tipo === "webcam" \? `\$\{p\.nombreLargo\} · SE VE SIN CÁMARA` : p\.nombreLargo\)/.test(LS)
    && I.posI('vis_cascada').nombreLargo === 'VISUALIZADOR CASCADA' && I.posI('vis_identidad').nombreLargo === 'PALETA IDENTIDAD',
    'display: "» VISUALIZADOR CASCADA" / "» PALETA IDENTIDAD"; con cámara agrega "· SE VE SIN CÁMARA"'); }

console.log('\n(h) lectura de código del dibujo');
{ const cuerpo = n => { const i = DIB.indexOf(`function ${n}(`); return i < 0 ? '' : DIB.slice(i, DIB.indexOf('\n}\n', i)); };
  const bucle = ['dibujarVisualizador', 'cascada', 'osciloscopio', 'trazar', 'sinSenal'].map(cuerpo).join('\n');
  check(bucle.length > 2000, 'funciones del dibujo encontradas');
  check(!/createLinearGradient|createRadialGradient|createPattern/.test(bucle), 'sin createLinearGradient (ni otros gradientes o patrones) en el dibujo por cuadro');
  check(!/shadowBlur/.test(DIB.replace(/\/\/.*$/gm, '')), 'sin shadowBlur (fuera de los comentarios)');
  check(!/`/.test(bucle), 'sin template strings en el bucle de dibujo');
  check(!/new (Float32Array|Uint8Array|Array|Path2D|Map|Set)|\.subarray\(|\.map\(|\.slice\(/.test(bucle), 'sin arreglos, Path2D ni subarray nuevos por cuadro (vistas cacheadas)');
  check(/createPattern\(tiraCv, "repeat"\)/.test(cuerpo('asegurarRecursos')) && /setTransform\(1, 0, 0, 1, off, 0\)/.test(bucle) && /"source-in"/.test(bucle),
    'IDENTIDAD: tira construida una vez y desplazada con setTransform numérico + source-in');
  check(/liberarVisualizador\(\);   \/\/ Z98/.test(FV) && /soltarXYVisualizador\(\); return; \}/.test(FV) && /R\.capa\.width = 0; R\.estatica\.width = 0; R\.tiraCv\.width = 0;/.test(DIB),
    'limpieza: al desmontar se liberan analizadores, capas y patrón; sin dibujo se sueltan los analizadores del XY');
  check(/if \(D\.VISUALIZADOR_NUEVO && \(D\.ESTILO === "cascada" \|\| D\.ESTILO === "xy"\)\) \{\s*if \(DBG_RENDIMIENTO\.SIS\.visualizadorTarima === false\) return;/.test(FV)
    && /F\.acc < 1 \/ Math\.max\(1, DBG_ONDAS_TARIMA\.FPS\)/.test(FV), 'corre donde corría el canvas de ondas (mismo tick y FPS), con su fila de benchmark');
  check(/\{ id: "visualizadorTarima",/.test(leer('../lib/rendimiento.ts')) && /visualizadorTarima: true,/.test(CFG), 'fila "visualizadorTarima" en el benchmark'); }

console.log('\n(i) layout del atril IMAGEN IM-40');
{ const M = I.MODULOS_I, P = I.POSICIONES_I, vis = I.moduloI('visual');
  check(vis.titulo === 'VISUALIZADOR' && vis.etiqueta === 'SIN CÁMARA · SE TRANSMITE' && !vis.punteado, 'módulo VISUALIZADOR · SIN CÁMARA · SE TRANSMITE');
  check(['vis_cascada', 'vis_xy', 'vis_ambar', 'vis_fosforo', 'vis_identidad'].every(id => I.posI(id).forma === 'pad' && I.posI(id).tipo === 'toggle') && I.posI('vis_color_v').tipo === 'knob',
    '5 pads (misma forma que los de EFECTOS) y la perilla VEL. COLOR');
  check(M.every(m => S.dentro(m.rect, S.PANEL)), 'los módulos dentro del panel (sin agrandarlo)');
  let mal = [];
  for (let i = 0; i < M.length; i++) for (let j = i + 1; j < M.length; j++) if (S.seSuperponen(M[i].rect, M[j].rect)) mal.push(`${M[i].id}↔${M[j].id}`);
  for (const p of P) if (!S.dentro(I.huellaI(p), I.moduloI(p.modulo).rect)) mal.push(`${p.id} fuera`);
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (S.seSuperponen(I.huellaI(P[i]), I.huellaI(P[j]))) mal.push(`${P[i].id}↔${P[j].id}`);
  check(mal.length === 0, `sin colisiones de módulos ni controles${mal.length ? ': ' + mal.join(', ') : ''}`);
  for (const esc of [0.7, 1, 1.15]) {
    const T = I.textosI(esc), m2 = [];
    for (const t of T) {
      const r = S.rectTexto(t);
      const m = t.fila === 'display' ? I.moduloI('display') : M.find(mm => t.id === `t_${mm.id}` || t.id === `g_${mm.id}`) ?? I.moduloI(I.posI(t.id.slice(2))?.modulo ?? 'escena');
      if (!S.dentro(r, m.rect)) m2.push(`${t.id} fuera de ${m.id}`);
      for (const p of P) if (S.seSuperponen(r, I.huellaI(p))) m2.push(`${t.id}↔${p.id}`);
    }
    for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) if (S.seSuperponen(S.rectTexto(T[i]), S.rectTexto(T[j]))) m2.push(`${T[i].id}↔${T[j].id}`);
    const tag = T.find(t => t.id === 'g_visual');
    check(m2.length === 0, `ETIQUETA_ESCALA ${esc}: ningún texto cortado, fuera de su módulo o encimado (etiqueta "SIN CÁMARA · SE TRANSMITE" ${(tag.alto * 1000).toFixed(1)} mm)${m2.length ? ': ' + m2.slice(0, 5).join(', ') : ''}`);
  }
  const g = S.GEO_DEFECTO;
  for (const [nom, a] of [['16:10', 1.6], ['16:9', 16 / 9]]) {
    const p = I.buscarPoseImagenPanel(g, a, S.escalaEfectiva(1, true, a));
    check(!!p && p.legible >= S.LEGIBLE_MIN, `${nom}: legibilidad con la cámara "panel" ${(100 * (p?.legible ?? 0)).toFixed(2)} % (≥ 2,5 %)`);
  }
  check(!LS.split('const IMAGE_CONTROLS: CtrlDef[] = [')[1].split('const SOUND_CONTROLS')[0].includes('vis_'), 'el diseño anterior (DISENO_NUEVO false) no muestra los controles nuevos'); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
