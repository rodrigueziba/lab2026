// Z108: MANOS. Pruebas con landmarks sintéticos de 21 puntos (lib/manos.ts y lib/manoControl.ts, puros) y lectura de
// código de la integración. (a) tamaño, centro y apertura; (b) postura plana con tolerancia e histéresis; (c) etiqueta
// derecha/izquierda con ESPEJO; (d) pellizco con histéresis; (e) control relativo; (f) sensibilidad independiente de la
// distancia; (g) soltar, perder y volver sin salto; (h) modo absoluto sin saltos; (i) prioridad mano > cara y mouse;
// (j) lectura de código (solo con MANOS + atril, permiso al activar, liberación, sin allocations); (k) pads y botones
// intactos, pastilla MANOS sin colisiones y legibilidad. Uso: node scripts/manos-test.mjs
import fs from 'node:fs';
import { register } from 'node:module';
const RAIZ = new URL('../', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`const R = ${JSON.stringify(RAIZ)};
export async function resolve(s, c, n) {
  if (s.startsWith('@/')) s = R + s.slice(2);
  if ((/^\\.\\.?\\//.test(s) || s.startsWith('file:')) && !/\\.[a-z]+$/.test(s)) { try { return await n(s + '.ts', c); } catch {} }
  return n(s, c);
}`));

let ok = 0, mal = 0;
function check(c, msg) { if (c) { ok++; console.log('OK   ' + msg); } else { mal++; console.log('MAL  ' + msg); } }
const f = (x, d = 3) => Number(x).toFixed(d);
const cerca = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

const M = await import(RAIZ + 'lib/manos.ts');
const C = await import(RAIZ + 'lib/manoControl.ts');

const CFG = {
  MANO: 'derecha', ESPEJO: true, POSTURA: 'plana', POSTURA_TOL_GRADOS: 35, POSTURA_HIST_GRADOS: 10, ABIERTA_ENTRAR: 0.6, ABIERTA_SALIR: 0.45,
  UMBRAL_PELLIZCO: 0.35, UMBRAL_PELLIZCO_SALIDA: 0.5, TOLERANCIA_PERDIDA_MS: 300, DEADBAND: 0, MINCUTOFF: 1.5, BETA: 4, DCUTOFF: 1,
};
const buf = new Float32Array(M.N_BUF_MANOS);
function mano(o, h = 0, vaciar = true) {
  if (vaciar) M.vaciarBufManos(buf, 4 / 3);
  M.escribirManoSintetica(buf, h, { lado: 'derecha', espejo: true, cx: 0.5, cy: 0.6, t: 0.2, angulo: 0, abierta: true, pellizco: false, aspecto: 4 / 3, ...o });
  return buf;
}
const base0 = M.B_CABECERA + M.M_PUNTOS;

// ── (a) rasgos ──
{
  const r = M.rasgosMano(mano({}), base0, 4 / 3, 1, M.crearRasgos());
  check(cerca(r.tamano, 0.2, 1e-4), `(a) tamaño = muñeca → base del medio: ${f(r.tamano, 4)} (esperado 0,2000)`);
  const r2 = M.rasgosMano(mano({ t: 0.4 }), base0, 4 / 3, 1, M.crearRasgos());
  check(cerca(r2.tamano / r.tamano, 2, 1e-4), `(a) mano al doble de tamaño → tamaño ×${f(r2.tamano / r.tamano, 3)}`);
  check(r.apertura > 0.95, `(a) mano abierta → apertura ${f(r.apertura, 2)} (≈ 1)`);
  const rc = M.rasgosMano(mano({ abierta: false }), base0, 4 / 3, 1, M.crearRasgos());
  check(rc.apertura < 0.05, `(a) dedos curvados → apertura ${f(rc.apertura, 2)} (≈ 0)`);
  const ra = M.rasgosMano(mano({ cy: 0.4 }), base0, 4 / 3, 1, M.crearRasgos());
  check(cerca(ra.altura - r.altura, 0.2, 1e-4) && cerca(ra.cx, r.cx, 1e-6), `(a) subir la muñeca 0,2 → la altura del centro sube ${f(ra.altura - r.altura, 4)} y el centro no se corre en x`);
  const rx = M.rasgosMano(mano({ cx: 0.3 }), base0, 4 / 3, 1, M.crearRasgos());
  check(cerca(rx.cx - r.cx, -0.2 * 4 / 3, 1e-4), `(a) correr la muñeca 0,2 en x (imagen 4:3) → el centro se corre ${f(rx.cx - r.cx, 4)} altos de imagen (x × aspecto)`);
  check(cerca(r.angulo, 0, 1e-3), `(a) ángulo de una mano plana hacia la izquierda del usuario = ${f(r.angulo, 2)}°`);
}

// ── (b) postura ──
{
  const e = M.crearEstadoManos();
  const paso = (o, t) => M.procesarManos(e, mano(o), t, CFG);
  paso({ angulo: 0 }, 0);
  check(e.postura && e.valida, '(b) plana hacia la izquierda del usuario (0°) → postura');
  M.reiniciarManos(e); paso({ angulo: 180 }, 0);
  check(!e.posturaCuadro, '(b) apuntando hacia la DERECHA del usuario (180°) → no es plana');
  M.reiniciarManos(e); paso({ angulo: 90 }, 0);
  check(!e.posturaCuadro, '(b) vertical (90°, dedos arriba) → no es plana');
  M.reiniciarManos(e); paso({ angulo: -90 }, 0);
  check(!e.posturaCuadro, '(b) vertical (−90°, dedos abajo) → no es plana');
  M.reiniciarManos(e); paso({ angulo: 30 }, 0);
  check(e.posturaCuadro, '(b) 30° (dentro de ±35°) → plana');
  M.reiniciarManos(e); paso({ angulo: -40 }, 0);
  check(!e.posturaCuadro, '(b) −40° desde cero → no entra (tolerancia 35°)');
  M.reiniciarManos(e); paso({ angulo: 30 }, 0); paso({ angulo: 42 }, 33);
  check(e.posturaCuadro, '(b) histéresis: ya plana, 42° (≤ 35 + 10) → sigue plana (no parpadea)');
  paso({ angulo: 50 }, 66);
  check(!e.posturaCuadro, '(b) histéresis: 50° (> 45°) → la pierde');
  M.reiniciarManos(e); paso({ abierta: false }, 0);
  check(!e.posturaCuadro, '(b) puño (dedos curvados) → no es plana');
  // tolerancia de pérdida
  M.reiniciarManos(e); paso({}, 1000);
  M.vaciarBufManos(buf); M.procesarManos(e, buf, 1200, CFG);
  check(e.postura && !e.valida, '(b) la mano desaparece 200 ms → la postura se sostiene (tolerancia 300 ms) pero la altura no se usa');
  M.procesarManos(e, buf, 1350, CFG);
  check(!e.postura, '(b) 350 ms sin mano → se suelta la postura');
  // POSTURA "abierta": cualquier mano abierta sirve
  M.reiniciarManos(e); M.procesarManos(e, mano({ angulo: 90 }), 0, { ...CFG, POSTURA: 'abierta' });
  check(e.posturaCuadro, '(b) POSTURA "abierta": vertical y abierta también vale');
}

// ── (c) lado con ESPEJO ──
{
  check(M.ladoUsuario(false, true) === 'derecha' && M.ladoUsuario(true, true) === 'izquierda', '(c) ESPEJO true: "Left" de MediaPipe = mano DERECHA del usuario (cámara cruda)');
  check(M.ladoUsuario(true, false) === 'derecha' && M.ladoUsuario(false, false) === 'izquierda', '(c) ESPEJO false: la etiqueta se toma tal cual');
  // geometría: mano derecha del usuario con la palma hacia la cámara y los dedos arriba. En la imagen cruda de una webcam
  // (sin espejar) la izquierda del usuario es la derecha de la imagen, así que el pulgar queda a la DERECHA del meñique
  // (x mayor). MediaPipe supone una imagen espejada y a esa mano la llama "Left": con ESPEJO true, "derecha".
  const sIzq = M.signoIzquierdaUsuario(true);
  const xPulgar = 0.5 + sIzq * 0.05, xMenique = 0.5 - sIzq * 0.05;
  check(xPulgar > xMenique && M.ladoUsuario(false /* "Left" */, true) === 'derecha', `(c) geometría: palma al frente, pulgar en x ${f(xPulgar, 2)} > meñique ${f(xMenique, 2)} (imagen cruda) → etiqueta "Left" → derecha`);
  // con dos manos en cuadro, MANO "derecha" elige la del usuario aunque la otra sea más confiable
  const e = M.crearEstadoManos();
  M.vaciarBufManos(buf);
  M.escribirManoSintetica(buf, 0, { lado: 'izquierda', espejo: true, cx: 0.7, cy: 0.5, t: 0.2, angulo: 0, abierta: true, pellizco: false, aspecto: 4 / 3, confianza: 0.99 });
  M.escribirManoSintetica(buf, 1, { lado: 'derecha', espejo: true, cx: 0.3, cy: 0.5, t: 0.2, angulo: 0, abierta: true, pellizco: false, aspecto: 4 / 3, confianza: 0.80 });
  M.procesarManos(e, buf, 0, CFG);
  check(e.indice === 1 && e.lado === 'derecha', '(c) dos manos: con MANO "derecha" se elige la derecha del usuario (índice 1)');
  M.procesarManos(e, buf, 33, { ...CFG, MANO: 'izquierda' });
  check(e.indice === 0 && e.lado === 'izquierda' && e.posturaCuadro, '(c) MANO "izquierda": se elige la otra, y su "plana" apunta a la derecha del usuario (en espejo)');
  const e2 = M.crearEstadoManos();
  M.procesarManos(e2, buf, 0, { ...CFG, ESPEJO: false });
  check(e2.lado === 'derecha' && e2.indice === 0, '(c) con ESPEJO false las etiquetas se leen al revés (la mano 0, etiquetada "Right", pasa a ser la derecha)');
  M.vaciarBufManos(buf); M.escribirManoSintetica(buf, 0, { lado: 'izquierda', espejo: true, cx: 0.5, cy: 0.5, t: 0.2, angulo: 0, abierta: true, pellizco: false, aspecto: 4 / 3 });
  const e3 = M.crearEstadoManos(); M.procesarManos(e3, buf, 0, CFG);
  check(!e3.vista, '(c) solo la mano izquierda en cuadro con MANO "derecha" → "no se ve la mano"');
}

// ── (d) pellizco con histéresis ──
{
  const e = M.crearEstadoManos();
  function conPellizco(dist, t) {
    mano({});
    const b = base0, ip = M.L_INDICE_PUNTA, pp = M.L_PULGAR_PUNTA;
    buf[b + pp * 3] = buf[b + ip * 3]; buf[b + pp * 3 + 1] = buf[b + ip * 3 + 1] + dist * 0.2;   // dist en tamaños
    M.procesarManos(e, buf, t, CFG);
  }
  conPellizco(1.2, 0); check(!e.pellizco, '(d) pulgar lejos del índice (1,2 tamaños) → sin pellizco');
  conPellizco(0.42, 33); check(!e.pellizco, '(d) 0,42 (entre 0,35 y 0,50) sin pellizco previo → sigue sin pellizco');
  conPellizco(0.2, 66); check(e.pellizco, '(d) 0,20 (< 0,35) → pellizco');
  conPellizco(0.42, 99); check(e.pellizco, '(d) histéresis: 0,42 con pellizco → se sostiene');
  conPellizco(0.6, 132); check(!e.pellizco && e.pellizcoValido, '(d) 0,60 (> 0,50) → se suelta (el pellizco "válido" dura la tolerancia de 300 ms)');
  conPellizco(0.6, 500); check(!e.pellizcoValido, '(d) pasada la tolerancia → embrague suelto');
  const s = M.rasgosMano(mano({ pellizco: true }), base0, 4 / 3, 1, M.crearRasgos());
  check(s.pellizco < 0.35 && s.apertura >= 0.6, `(d) la mano sintética pellizcando sigue "abierta" (apertura ${f(s.apertura, 2)}, pellizco ${f(s.pellizco, 2)}): pellizco y postura plana conviven`);
}

// ── (e) control relativo ──
const CC = { MODO_MANO: 'relativo', RECORRIDO_MANOS: 3.5, SUAVIZADO_ABS_S: 0.25 };
const cal = C.crearCalMano();
{
  const t = 0.2, h0 = 0.5;
  const ag = C.crearAgarre();
  const prueba = (dh) => { C.iniciarAgarre(ag, 'x', 0.40); C.pasoAgarre(ag, true, h0, t, 1 / 30, CC, cal); return C.pasoAgarre(ag, true, h0 + dh * t, t, 1 / 30, CC, cal); };
  check(cerca(prueba(3.5), 1.0), `(e) valor inicial 0,40, mano 3,5 tamaños arriba → ${f(prueba(3.5), 2)}`);
  check(cerca(prueba(1.75), 0.90), `(e) 1,75 tamaños arriba → ${f(prueba(1.75), 2)}`);
  check(cerca(prueba(-0.7), 0.20), `(e) 0,7 tamaños abajo → ${f(prueba(-0.7), 2)} (bajar da valores menores)`);
  check(cerca(prueba(-5), 0) && cerca(prueba(10), 1), '(e) se recorta en 0 y en 1');
  check(cerca(prueba(0), 0.40), '(e) sin mover la mano el valor no cambia (al agarrar no salta)');
  check(Number.isNaN(C.pasoAgarre(C.crearAgarre(), true, 0.5, t, 1 / 30, CC, cal)), '(e) sin agarre no se mueve nada');
}

// ── (f) sensibilidad independiente de la distancia ──
{
  const ag = C.crearAgarre();
  const mov = (t, dh) => { C.iniciarAgarre(ag, 'x', 0.40); C.pasoAgarre(ag, true, 0.5, t, 1 / 30, CC, cal); return C.pasoAgarre(ag, true, 0.5 + dh, t, 1 / 30, CC, cal); };
  const lejos = mov(0.1, 0.1 * 1.4), cerca2 = mov(0.2, 0.2 * 1.4);
  check(cerca(lejos, cerca2) && cerca(lejos, 0.8), `(f) el mismo movimiento en tamaños de mano (1,4) da lo mismo lejos (tamaño 0,1 → ${f(lejos, 2)}) y cerca (tamaño 0,2 → ${f(cerca2, 2)})`);
  // con la lógica completa: la mano sintética al doble de tamaño moviendo el doble en la imagen
  const res = [];
  for (const t of [0.12, 0.24]) {
    const e = M.crearEstadoManos(), a = C.crearAgarre();
    C.iniciarAgarre(a, 'x', 0.4);
    let tm = 0, v = NaN;
    for (let k = 0; k <= 30; k++) {
      M.procesarManos(e, mano({ t, cy: 0.7 - (k / 30) * t * 1.75 }), tm, { ...CFG, MINCUTOFF: 50, BETA: 0 });
      v = C.pasoAgarre(a, e.valida, e.alturaSalida, e.tamano, 1 / 30, CC, cal); tm += 33;
    }
    res.push(v);
  }
  check(cerca(res[0], res[1], 0.01) && cerca(res[0], 0.9, 0.02), `(f) de punta a punta (rasgos + filtro + control): mano chica ${f(res[0], 3)} y al doble ${f(res[1], 3)} subiendo 1,75 tamaños`);
}

// ── (g) soltar, perder y volver ──
{
  const ag = C.crearAgarre(), t = 0.2;
  C.iniciarAgarre(ag, 'x', 0.4); C.pasoAgarre(ag, true, 0.5, t, 1 / 30, CC, cal);
  const v1 = C.pasoAgarre(ag, true, 0.5 + 0.35, t, 1 / 30, CC, cal);
  C.soltarAgarre(ag);
  check(!ag.agarrado && Number.isNaN(C.pasoAgarre(ag, true, 0.9, t, 1 / 30, CC, cal)) && cerca(v1, 0.9), `(g) al soltar el embrague el control se queda en ${f(v1, 2)} (la mano ya no lo mueve)`);
  C.iniciarAgarre(ag, 'x', 0.5); C.pasoAgarre(ag, true, 0.5, t, 1 / 30, CC, cal);
  const vA = C.pasoAgarre(ag, true, 0.57, t, 1 / 30, CC, cal);
  const vPerdida = C.pasoAgarre(ag, false, 0.1, t, 1 / 30, CC, cal);
  check(Number.isNaN(vPerdida) && cerca(ag.valor, vA), `(g) se pierde la mano con el embrague apretado → el control queda quieto en ${f(ag.valor, 2)}`);
  const vVuelve = C.pasoAgarre(ag, true, 0.2, t, 1 / 30, CC, cal);   // vuelve MUCHO más abajo
  check(cerca(vVuelve, vA), `(g) la mano vuelve en otra altura (0,20 en vez de 0,57) → sin salto (${f(vVuelve, 2)})`);
  const vSigue = C.pasoAgarre(ag, true, 0.2 + 0.07, t, 1 / 30, CC, cal);
  check(cerca(vSigue - vA, 0.07 / (3.5 * t)), `(g) y retoma desde ahí: subir 0,07 suma ${f(vSigue - vA, 3)}`);
}

// ── (h) modo absoluto sin saltos ──
{
  const CA = { ...CC, MODO_MANO: 'absoluto' };
  const ag = C.crearAgarre();
  C.iniciarAgarre(ag, 'x', 0.1);
  let maxPaso = 0, prev = 0.1, v = 0.1;
  for (let k = 0; k < 90; k++) { v = C.pasoAgarre(ag, true, 0.8, 0.2, 1 / 30, CA, cal); maxPaso = Math.max(maxPaso, Math.abs(v - prev)); prev = v; }
  check(maxPaso < 0.13 && cerca(v, 1, 0.01), `(h) absoluto: de 0,10 a la altura 0,8 (= 1,00 sin calibrar) sin saltos (paso máximo ${f(maxPaso, 3)} por cuadro a 30 Hz) y llega a ${f(v, 2)}`);
  // calibración rápida: 3 s abajo (0,3) y 3 s arriba (0,7)
  const cm = C.crearCalMano(), ec = C.crearEstadoCalMano();
  C.iniciarCalMano(ec, 0);
  let fin = false;
  for (let k = 0; k <= 200 && !fin; k++) { const tS = k / 30; fin = C.pasoCalMano(ec, true, tS < 3 ? 0.3 : 0.7, tS, 3, cm); }
  check(fin && cm.calibrada && cerca(cm.min, 0.3, 0.01) && cerca(cm.max, 0.7, 0.01), `(h) calibración: abajo ${f(cm.min, 2)}, arriba ${f(cm.max, 2)} (en memoria)`);
  const ag2 = C.crearAgarre(); C.iniciarAgarre(ag2, 'x', 0.5);
  for (let k = 0; k < 120; k++) v = C.pasoAgarre(ag2, true, 0.6, 0.2, 1 / 30, CA, cm);
  check(cerca(v, 0.75, 0.01), `(h) con calibración 0,3…0,7 la altura 0,6 da ${f(v, 2)}`);
}

// ── (i) prioridad ──
{
  check(C.quienManda('b_corte', 'b_corte', true, 'b_corte', true) === 'mano', '(i) embrague apretado sobre el control: manda la MANO (sobre el mouse y la cara)');
  check(C.quienManda('b_corte', 'b_corte', false, '', true) === 'cara', '(i) al soltar: la cara retoma los suyos como hoy');
  check(C.quienManda('b_corte', 'b_res', true, 'b_corte', true) === 'mouse', '(i) la mano agarra otro control: este sigue con el mouse');
  check(C.quienManda('s_vol', '', false, '', false) === 'manual', '(i) sin nadie: manual');
  const LS = fs.readFileSync(new URL('../components/LecternSystem.tsx', import.meta.url), 'utf8');
  check(/if \(manoAgarra\(_drag\.def\.id\)\) return;/.test(LS), '(i) código: el arrastre del mouse no mueve el control que la mano tiene agarrado (solo en ese caso)');
  check(/const iMano = paramIdxAgarrado\(\);[\s\S]{0,140}if \(iMano >= 0\) CARA\.arrastreIdx = iMano;/.test(LS), '(i) código: con la mano agarrando una perilla del BA-40, la cara la suelta (misma vía que el arrastre del mouse) y la retoma al soltar');
  check(/PUENTE_MANOS\.aplicar = \(d, v\) => \{ setCtrl\(d\.id, v, d as CtrlDef\); \};/.test(LS), '(i) código: la mano aplica por setCtrl (la misma vía que el mouse; el onActivate de cada instrumento marca "manual")');
}

// ── (j) lectura de código ──
{
  const A = fs.readFileSync(new URL('../lib/manosAtril.ts', import.meta.url), 'utf8');
  const T = fs.readFileSync(new URL('../components/ManosTarima.tsx', import.meta.url), 'utf8');
  const cuerpo = (src, nombre) => { const i = src.indexOf(`function ${nombre}(`); if (i < 0) return ''; let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(j, k + 1); } } return ''; };
  const tick = cuerpo(A, 'tickManos');
  check(/if \(!MANOS\.on\) return;/.test(tick) && /if \(modo === "none" && !DBG_MANOS\.SIMULAR\) \{ apagarManos\("apagado", modo\); return; \}/.test(tick) && /if \(oculta\)/.test(tick),
    '(j) solo corre con MANOS activo, un atril enfocado (sin atril se apaga y libera todo) y la pestaña visible');
  const gum = [...A.matchAll(/getUserMedia\(/g)].length;
  check(gum === 1 && /async function conseguirCamara/.test(A) && /void arrancar\(_generacion, modo\)/.test(cuerpo(A, 'encenderManos')), `(j) el permiso de cámara se pide en un solo lugar (conseguirCamara), al activar MANOS (encenderManos → arrancar) y nunca al montar`);
  check(!/getUserMedia|encenderManos/.test(T.replace(/\/\/.*$/gm, '')), '(j) ManosTarima (el montaje) no pide la cámara ni enciende MANOS');
  const ap = cuerpo(A, 'apagarManos');
  check(/detenerWorker\(\)/.test(ap) && /soltarCamara\(\)/.test(ap) && /w\.terminate\(\)/.test(cuerpo(A, 'detenerWorker')), '(j) al apagar o salir: worker cerrado (terminate) y cámara soltada');
  const sc = cuerpo(A, 'soltarCamara');
  check(/if \(_stream\) \{ for \(const t of _stream\.getTracks\(\)\) t\.stop\(\); _stream = null; \}/.test(sc) && !/LIVE_TEX_REF|videoCaraCompartible/.test(sc), '(j) solo se cierra el stream PROPIO; el de la tarima o la cara (compartidos) nunca');
  check(/useEffect\(\(\) => \{[\s\S]*liberarManos\(\);[\s\S]*div\.remove\(\);/.test(T) && /removeEventListener\("keydown"/.test(T) && /recursos\.geo\.dispose\(\); recursos\.mat\.dispose\(\);/.test(T), '(j) al desmontar: listeners, aria, anillo y MANOS liberados');
  const porCuadro = [cuerpo(A, 'controlar'), cuerpo(A, 'alMensaje'), cuerpo(A, 'llenarSimulacionManos'), cuerpo(A, 'alBitmap')].join('\n').replace(/ as \{[^}]*\}/g, '');   // los tipos (as { … }) no crean nada
  const tickSinRescate = tick.replace('_buf = new Float32Array(N_BUF_MANOS); }   // trabado (raro)', '');
  check(!/new [A-Z]|\[\]|\{ *[a-z]+:|=> \{/.test(porCuadro) && !/new [A-Z]/.test(tickSinRescate), '(j) sin allocations por cuadro en el hilo principal (tick, controlar, alMensaje, simulación, envío; solo el rescate de un worker trabado crea un buffer)');
  const MS = fs.readFileSync(new URL('../lib/manos.ts', import.meta.url), 'utf8');
  const proc = cuerpo(MS, 'procesarManos') + cuerpo(MS, 'rasgosMano') + cuerpo(MS, 'escribirManoSintetica') + cuerpo(MS, 'filtrarUnEuro');
  check(!/new |=>|\[[^\]]*,[^\]]*\] =|const \[/.test(proc), '(j) lógica pura por cuadro sin clausuras, arreglos ni objetos nuevos (rasgos, postura, filtro, mano sintética)');
  const CS = fs.readFileSync(new URL('../lib/manoControl.ts', import.meta.url), 'utf8');
  check(!/new |=>/.test(cuerpo(CS, 'pasoAgarre') + cuerpo(CS, 'iniciarAgarre') + cuerpo(CS, 'embragueActivo')), '(j) control por cuadro sin allocations');
  const uf = T.slice(T.indexOf('useFrame(() => {'), T.indexOf('return <mesh'));
  check(!/new [A-Z]/.test(uf) && /const _pos = new THREE\.Vector3\(\), _q = new THREE\.Quaternion\(\), _qp = new THREE\.Quaternion\(\);/.test(T), '(j) resalte por cuadro con vector y cuaterniones reutilizados');
  check(/periodo = 1000 \/ Math\.max\(1, Math\.min\(60, DBG_MANOS\.MANOS_HZ\)\)/.test(tick) && /if \(_enVuelo \|\| !_buf\) \{\s*MANOS\.descartados\+\+;/.test(tick), '(j) a MANOS_HZ como máximo, uno en vuelo: si el worker está ocupado el cuadro se DESCARTA (nunca hay cola)');
  check(/DBG_RENDIMIENTO\.SIS\.manosTarima !== false/.test(tick), '(j) interruptor del benchmark (SIS.manosTarima)');
  check(/MANOS: USA LA CÁMARA, NO SE TRANSMITE/.test(CS) && C.textoLineaManos('lista', '', '', 0, true) === 'MANOS: USA LA CÁMARA, NO SE TRANSMITE' && C.textoLineaManos('lista', '', '', 0, false) === 'MANOS: LISTA',
    '(j) con la tarima compartiendo en vivo la línea avisa "MANOS: USA LA CÁMARA, NO SE TRANSMITE"');
  check(C.textoLineaManos('agarrando', '', 'CORTE', 42, false) === 'MANOS: AGARRANDO CORTE 42 %' && C.textoLineaManos('pidiendo', '', '', 0, false) === 'MANOS: PIDIENDO CÁMARA' && C.textoLineaManos('sin_mano', '', '', 0, false) === 'MANOS: NO SE VE LA MANO',
    '(j) líneas de estado: PIDIENDO CÁMARA, NO SE VE LA MANO, LISTA, AGARRANDO CORTE 42 %');
  check(C.errorDeCamara('NotAllowedError') === 'denegado' && C.errorDeCamara('NotFoundError') === 'sin_camara' && C.errorDeCamara('NotReadableError') === 'en_uso'
    && C.textoLineaManos('error', 'denegado', '', 0, false) === 'MANOS: CÁMARA DENEGADA' && /console\.warn\(`\[MANOS\]/.test(A), '(j) errores con motivo (denegado, sin cámara, en uso) y console.warn con [MANOS] y el nombre del error');
  check(/aria-live", "polite"/.test(T) && C.ANUNCIO_ACTIVADO === 'Control con manos activado. Poné el cursor sobre una perilla, mantené el embrague y subí o bajá la mano', '(j) anuncio aria-live "polite" en español al activar y desactivar');
  const W = fs.readFileSync(new URL('../lib/manosWorker.ts', import.meta.url), 'utf8');
  check(/HandLandmarker\.createFromOptions/.test(W) && /runningMode: "VIDEO"/.test(W) && /numHands: Math\.max\(1, Math\.min\(MAX_MANOS, numManos\)\)/.test(W) && /numManos: 2/.test(A), '(j) worker: Hand Landmarker en modo VIDEO con numHands 2');
  check(/hand_landmarker\.task/.test(A) && /storage\.googleapis\.com\/mediapipe-models\/hand_landmarker\/hand_landmarker\/float16\/1\/hand_landmarker\.task/.test(A) && fs.existsSync(new URL('../public/alight/mediapipe/hand_landmarker.task', import.meta.url)),
    '(j) modelo local /alight/mediapipe/hand_landmarker.task con caída al CDN oficial (el archivo local está)');
}

// ── (k) pads, botones y teclado intactos; pastilla MANOS en los cinco atriles ──
{
  check(C.esContinuo('knob') && C.esContinuo('slider') && !C.esContinuo('button') && !C.esContinuo('toggle') && !C.esContinuo('indicator') && !C.esContinuo('superficie'),
    '(k) solo perillas y deslizadores se agarran; pads, botones, palancas, indicadores y el disco de ritmos no');
  const A = fs.readFileSync(new URL('../lib/manosAtril.ts', import.meta.url), 'utf8');
  check(/if \(def && esContinuo\(def\.type\) && PUENTE_MANOS\.leer\)/.test(A), '(k) el agarre exige un control continuo bajo el cursor');
  const LS = fs.readFileSync(new URL('../components/LecternSystem.tsx', import.meta.url), 'utf8');
  check(/c\.type === "toggle"\) && !IDS_MANOS\.includes\(c\.id\)\)/.test(LS), '(k) la pastilla MANOS no recibe letra Z–M: los atajos de los demás botones no cambian');
  const SI = await import(RAIZ + 'lib/sinte.ts'), SA = await import(RAIZ + 'lib/sampler.ts');
  check(SI.semitonoDeTecla('Space') < 0 && SA.padDeTecla('Space') < 0 && SI.TECLAS_RESERVADAS.includes('Space') && SA.TECLAS_PROHIBIDAS.includes('Space'),
    '(k) ESPACIO (embrague) no es tecla del piano del SY-40 ni pad del SM-40 (ya estaba reservado)');
  const T = fs.readFileSync(new URL('../components/ManosTarima.tsx', import.meta.url), 'utf8');
  check(/if \(e\.code !== DBG_MANOS\.EMBRAGUE_TECLA \|\| !activo\(\) \|\| enDebug\(e\.target\)\) return;/.test(T), '(k) la tecla de embrague solo se toma con MANOS activo y en un atril (si no, ESPACIO hace lo de siempre)');
  // pastilla: colisiones y legibilidad en los cinco layouts
  const S = await import(RAIZ + 'lib/atrilSonido.ts'), I = await import(RAIZ + 'lib/atrilImagen.ts'), B = await import(RAIZ + 'lib/atrilBajo.ts'), Y = await import(RAIZ + 'lib/atrilSinte.ts'), MM = await import(RAIZ + 'lib/atrilSampler.ts');
  const AM = await import(RAIZ + 'lib/atrilManos.ts');
  const rt = (t) => t.alinear === 'izq' ? { id: t.id, u0: t.u, u1: t.u + t.ancho, v0: t.v - t.alto / 2, v1: t.v + t.alto / 2 } : { id: t.id, u0: t.u - t.ancho / 2, u1: t.u + t.ancho / 2, v0: t.v - t.alto / 2, v1: t.v + t.alto / 2 };
  const L = {
    sonido: [S.POSICIONES.map(p => ({ id: p.id, ...S.huella(p) })), S.textos(1).map(rt)],
    imagen: [I.POSICIONES_I.map(p => ({ id: p.id, ...I.huellaI(p) })), I.textosI(1).map(rt)],
    bajo: [B.POSICIONES_B.map(p => ({ id: p.id, ...B.huellaB(p) })), B.textosB(1).map(rt)],
    sinte: [Y.POSICIONES_Y.map(p => ({ id: p.id, ...Y.huellaY(p) })), Y.textosY(1).map(rt)],
    sampler: [MM.POSICIONES_M.map(p => ({ id: p.id, ...MM.huellaM(p) })), MM.textosM(1).map(rt)],
  };
  const SEP = 0.004;
  for (const [lado, [hs, ts]] of Object.entries(L)) {
    const h = AM.huellaManos(lado);
    const choques = [...hs, ...ts].filter(b => h.u0 - SEP < b.u1 && h.u1 + SEP > b.u0 && h.v0 - SEP < b.v1 && h.v1 + SEP > b.v0).map(b => b.id);
    const dentro = h.u0 >= -S.PANEL_U + S.MARGEN && h.u1 <= S.PANEL_U - S.MARGEN && h.v0 >= -S.PANEL_V + S.MARGEN && h.v1 <= S.PANEL_V - S.MARGEN;
    const p = AM.posManos(lado);
    check(choques.length === 0 && dentro, `(k) ${lado}: pastilla MANOS en (${f(p.u)}, ${f(p.v)}), banda de título de "${AM.MODULO_MANOS[lado]}", sin tocar controles ni textos (${SEP * 1000} mm de aire) y dentro del panel${choques.length ? ' — choca con ' + choques.join(', ') : ''}`);
  }
  // legibilidad: el texto MANOS (mismo plano y letra que el ON) con la cámara de cada atril, y que no cambia la de los textos lejanos
  const g = S.GEO_DEFECTO;
  const poses = { sonido: S.buscarPoseSonido?.(g, 16 / 9, 1), sampler: MM.buscarPoseSampler(g, 16 / 9, 1) };
  for (const [lado, pose] of Object.entries(poses)) {
    if (!pose) continue;
    const cam = S.camaraAtril(g, pose.fov, pose.height, pose.dist, pose.pitch, 16 / 9);
    const p = AM.posManos(lado);
    const fr = S.fraccionAltura(g, cam, { u: p.u, v: p.v, alto: 0.0125 * 0.5 });
    console.log(`     ${lado}: letra de MANOS ≈ ${f(fr * 100, 2)} % del alto de pantalla (la del ON es la misma; la regla de 2,5 % es para el display y los títulos lejanos)`);
  }
  check(AM.IDS_MANOS.every(id => /^manos_/.test(id)) && !AM.IDS_MANOS.some(id => /^(s_|b_|y_|m_|dom_|wcam_|vis_)/.test(id)), '(k) ids manos_* fuera de los prefijos de cada atril: no pasan por los displays de valor ni por los atajos');
}

// ── (l) integración (lib/manosAtril.ts) con "Simular manos": reloj y puente simulados ──
{
  let T = 1000;
  Object.defineProperty(globalThis, 'performance', { value: { now: () => T }, configurable: true, writable: true });
  const { DBG_MANOS } = await import(RAIZ + 'lib/debugConfig.ts');
  const { CONSENT } = await import(RAIZ + 'lib/consentTarimaAcciones.ts');
  const A = await import(RAIZ + 'lib/manosAtril.ts');
  const P = A.PUENTE_MANOS;
  const aplicados = [], lineas = []; let boton = -1;
  const knob = { id: 'b_corte', type: 'knob', label: 'CORTE', nombreLargo: 'CORTE', min: 0, max: 1, paramIdx: 0 };
  const pad = { id: 'm_pad_0', type: 'button', label: 'PAD 1', min: 0, max: 1 };
  const valores = { b_corte: 0.4 };
  P.leer = (d) => valores[d.id] ?? 0; P.aplicar = (d, v) => { valores[d.id] = v; aplicados.push([d.id, v]); };
  P.mostrar = (modo, t) => lineas.push(t); P.boton = (v) => { boton = v; }; P.aria = { textContent: '' };
  const correr = (n, modo = 'bass') => { for (let k = 0; k < n; k++) { T += 34; A.tickManos(modo, false); } };
  DBG_MANOS.SIMULAR = true; DBG_MANOS.SIM_ALTURA = 0.4; DBG_MANOS.SIM_TAMANO = 0.2; DBG_MANOS.SIM_MANO_VISTA = true; DBG_MANOS.MINCUTOFF = 50; DBG_MANOS.BETA = 0; DBG_MANOS.DEADBAND = 0;
  A.encenderManos('bass');
  check(A.MANOS.on && boton === 1 && /Control con manos activado/.test(P.aria.textContent), '(l) activar: MANOS encendido, pastillas en ON y anuncio aria-live');
  correr(3);
  check(A.MANOS.estado === 'lista' && lineas.at(-1) === 'MANOS: LISTA', `(l) mano simulada plana → «${lineas.at(-1)}»`);
  P.hover = knob; A.setTeclaEmbrague(true); correr(2);
  check(A.AGARRE.agarrado && A.manoAgarra('b_corte') && A.paramIdxAgarrado() === 0, '(l) embrague (tecla) con el cursor sobre la perilla → la agarra (y manda sobre el mouse y la cara)');
  P.hover = null;   // el cursor se va: el control agarrado sigue siendo el mismo
  DBG_MANOS.SIM_ALTURA = 0.4 + 1.75 * 0.2; correr(4);
  check(cerca(valores.b_corte, 0.9, 0.01) && lineas.at(-1) === 'MANOS: AGARRANDO CORTE 90 %', `(l) subir la mano 1,75 tamaños → setCtrl con ${f(valores.b_corte, 2)} y «${lineas.at(-1)}»`);
  DBG_MANOS.SIM_MANO_VISTA = false; const nAp = aplicados.length; correr(15);
  check(aplicados.length === nAp && cerca(valores.b_corte, 0.9, 0.01), '(l) se pierde la mano con el embrague apretado → el control queda quieto');
  DBG_MANOS.SIM_MANO_VISTA = true; DBG_MANOS.SIM_ALTURA = 0.2; correr(3);
  check(cerca(valores.b_corte, 0.9, 0.01), `(l) vuelve mucho más abajo → sin salto (${f(valores.b_corte, 2)})`);
  DBG_MANOS.SIM_ALTURA = 0.2 + 0.35 * 0.2; correr(3);
  check(cerca(valores.b_corte, 1.0, 0.01), `(l) y retoma desde ahí (${f(valores.b_corte, 2)})`);
  A.setTeclaEmbrague(false); correr(1); const nSuelto = aplicados.length;
  DBG_MANOS.SIM_ALTURA = 0.1; correr(5);
  check(!A.AGARRE.agarrado && aplicados.length === nSuelto && !A.manoAgarra('b_corte') && A.paramIdxAgarrado() === -1, '(l) al soltar el embrague el control se queda y la cara puede retomar (paramIdxAgarrado −1)');
  P.hover = pad; A.setTeclaEmbrague(true); correr(3); A.setTeclaEmbrague(false); correr(1);
  check(!A.AGARRE.agarrado && aplicados.every(([id]) => id === 'b_corte'), '(k) con el cursor sobre un PAD el embrague no agarra nada (pads y botones intactos)');
  DBG_MANOS.SIM_EMBRAGUE = true; P.hover = knob; correr(2);
  check(A.AGARRE.agarrado, '(l) el forzador de embrague del menú agarra sin teclado');
  DBG_MANOS.SIM_EMBRAGUE = false; correr(1);
  CONSENT.estado = 'compartiendo'; correr(2);
  check(lineas.at(-1) === 'MANOS: USA LA CÁMARA, NO SE TRANSMITE', `(l) tarima compartiendo → «${lineas.at(-1)}»`);
  CONSENT.estado = 'inactivo';
  DBG_MANOS.SIMULAR = false; correr(1, 'none');
  check(!A.MANOS.on && boton === 0 && /desactivado/.test(P.aria.textContent), '(l) salir del atril → MANOS se apaga solo (pastillas en OFF y anuncio)');
  correr(5, 'bass');
  check(!A.MANOS.on, '(l) volver a un atril NO lo enciende de nuevo (hace falta apretar MANOS: el permiso nunca se pide solo)');
}

console.log(`\n${ok} OK, ${mal} MAL`);
if (mal) process.exit(1);
