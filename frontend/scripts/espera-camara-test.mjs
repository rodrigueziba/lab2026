// Z105: modo de espera (cámara cenital con esfera) y duración del título del telón.
// (a) cuenta de 60 s; (b) ascenso e inclinación (−90° justo a los 9 m); (c) altura de encuadre en varias proporciones;
// (d) inversión a mitad del ascenso sin saltos y misma trayectoria; (e) aterrizaje sin salto; (f) la esfera con W A S D
// (velocidad de caminata, límites reales); (g) pausa y bloqueos (camaraLibre); (h) reducir movimiento; (i) avisos
// accesibles; (j) lectura de código; (k) título y crédito del telón visibles a los 119 s.
// Uso: node scripts/espera-camara-test.mjs
import fs from 'node:fs';
import { register } from 'node:module';
const RAIZ = new URL('../', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`const R = ${JSON.stringify(RAIZ)};
export async function resolve(s, c, n) {
  if (s.startsWith('@/')) s = R + s.slice(2);
  if ((/^\\.\\.?\\//.test(s) || s.startsWith('file:')) && !/\\.[a-z]+$/.test(s)) { try { return await n(s + '.ts', c); } catch {} }
  return n(s, c);
}`));
const L = await import('../lib/esperaCamara.ts');
const CFGM = await import('../lib/debugConfig.ts');
const LUZ = await import('../lib/caminoLuz.ts');
const LT = await import('../lib/telonTexto/lineaTiempo.ts');
const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const sinCom = t => t.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const D = CFGM.DBG_ESPERA;
const cfg = (o = {}) => ({ ...D, ...o });
const DT = 1 / 60;
const EN0 = { entrada: false, bloqueado: false, pausado: false, oculto: false, reducir: false, forzar: false, salir: false, abortar: false };
/** corre la máquina; f(t, e) devuelve las entradas del cuadro; g(t, e) observa. */
function correr(c, tFin, f = () => ({}), g = () => {}) {
  const e = L.crearEstadoEspera(); let t = 0;
  while (t < tFin - 1e-9) { L.avanzarEspera(e, DT, { ...EN0, ...f(t, e) }, c); t += DT; g(t, e); }
  return e;
}

console.log('\nconstantes');
{ const PURO = leer('../lib/esperaCamara.ts');
  check(!/^import /m.test(PURO), 'lib/esperaCamara.ts sin imports (lógica pura)');
  check(D.ACTIVO === true && D.IDLE_S === 60 && D.SUBIDA_S === 16 && D.BAJADA_S === 20 && D.ALTURA_CENITAL_M === 9 && D.MARGEN === 1.15 && D.ALTURA_MAX_M === 120
    && D.CENTRAR === true && D.EN_TELON === false && D.RADIO_M === 0.35 && D.APARECE_S === 0.6 && D.ESCUCHA_EN_ESFERA === true && D.RESPETAR_REDUCIR_MOVIMIENTO === true
    && D.SUAVIZADO_S === 0.4 && D.UMBRAL_MOUSE_PX > 0 && D.ESCALA_ALTURA > 0 && D.GUIA === false,
    'DBG_ESPERA: ACTIVO, IDLE_S 60, SUBIDA_S 16, BAJADA_S 20, ALTURA_CENITAL_M 9, MARGEN 1,15, ALTURA_MAX_M 120, CENTRAR, EN_TELON false, RADIO_M 0,35, APARECE_S 0,6, ESCUCHA_EN_ESFERA, reducir movimiento, SUAVIZADO_S 0,4, guía apagada'); }

console.log('\n(a) cuenta regresiva');
{ let a599 = null, a601 = null;
  correr(cfg(), 61, () => ({}), (t, e) => { if (a599 === null && t >= 59.9 - 1e-9) a599 = e.fase; if (a601 === null && t >= 60.0 + DT) a601 = e.fase; });
  check(a599 === 'contando' && a601 === 'subiendo', `sin entrada: a los 59,9 s sigue contando (${a599}) y a los 60 s empieza (${a601})`);
  let fase61 = null, inicio = null;
  correr(cfg(), 125, t => ({ entrada: Math.abs(t - 59.9) < DT / 2 }), (t, e) => { if (fase61 === null && t >= 61) fase61 = e.fase; if (inicio === null && e.fase === 'subiendo') inicio = t; });
  check(fase61 === 'contando' && Math.abs(inicio - (59.9 + 60)) < 0.05, `una entrada a los 59,9 s reinicia la cuenta (a los 61 s: ${fase61}; empieza a los ${inicio?.toFixed(2)} s)`); }

const pose0 = { x: 2, y: 1.6, z: -3, yaw: 0.7, pitch: 0.12 };
const centro = { x: -3.7, z: -3.7 };
const usuario = { x: 2, z: -3 };
const HF = 15.6;
console.log('\n(b) ascenso e inclinación');
{ const muestras = [];
  correr(cfg(), 60 + 20, () => ({}), (t, e) => { if (e.modo) { const P = L.poseDeCamara(e.p, pose0, usuario, centro, HF, D, L.crearPose()); muestras.push({ t, p: e.p, ...P }); } });
  let mono = true, saltos = 0, maxDy = 0, maxDp = 0;
  for (let i = 1; i < muestras.length; i++) { const a = muestras[i - 1], b = muestras[i];
    if (b.y < a.y - 1e-12) mono = false; maxDy = Math.max(maxDy, Math.abs(b.y - a.y)); maxDp = Math.max(maxDp, Math.abs(b.pitch - a.pitch));
    if (Math.abs(b.y - a.y) > 0.05 || Math.abs(b.pitch - a.pitch) > 0.03) saltos++; }
  check(mono && saltos === 0 && muestras.at(-1).p === 1, `el ascenso es monótono y sin saltos (máx. ${maxDy.toFixed(4)} m y ${(maxDp * 180 / Math.PI).toFixed(3)}° por cuadro a 60 FPS) y termina arriba (p = 1)`);
  const debajo = muestras.filter(m => m.y < 9 - 1e-6), encima = muestras.filter(m => m.y >= 9);
  check(debajo.every(m => m.pitch > -Math.PI / 2) && encima.length > 0 && encima.every(m => m.pitch === -Math.PI / 2), 'la inclinación es mayor que −90° por debajo de los 9 m y exactamente −90° desde los 9 m hacia arriba');
  // justo a los 9 m: buscar p con y = 9 (bisección)
  let lo = 0, hi = 1; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (L.poseDeCamara(m, pose0, usuario, centro, HF, D, L.crearPose()).y < 9) lo = m; else hi = m; }
  const p9 = L.poseDeCamara(hi, pose0, usuario, centro, HF, D, L.crearPose()), pAntes = L.poseDeCamara(hi - 0.01, pose0, usuario, centro, HF, D, L.crearPose());
  check(Math.abs(p9.y - 9) < 1e-9 && p9.pitch === -Math.PI / 2 && pAntes.pitch > -Math.PI / 2 && Math.abs(pAntes.pitch + Math.PI / 2) < 0.01,
    `llega a −90° justo a los 9 m, con curva suave al final (un poco antes: ${(pAntes.pitch * 180 / Math.PI).toFixed(3)}°)`);
  const y0 = L.poseDeCamara(0, pose0, usuario, centro, HF, D, L.crearPose()), yd = L.poseDeCamara(0.001, pose0, usuario, centro, HF, D, L.crearPose());
  check((yd.y - y0.y) / 0.001 < 0.05 && Math.abs(yd.pitch - y0.pitch) < 1e-5, 'arranca suave (derivada casi 0 al comenzar)');
  const sub = muestras.filter(m => m.y < 9 - 1e-6);
  check(sub.every(m => Math.abs(m.x - usuario.x) < 1e-12 && Math.abs(m.z - usuario.z) < 1e-12) && Math.abs(muestras.at(-1).x - centro.x) < 1e-9 && Math.abs(muestras.at(-1).z - centro.z) < 1e-9,
    'hasta los 9 m sube sobre el usuario; en el tramo cenital se desliza al centro del escenario (CENTRAR)');
  check(muestras.every(m => m.yaw === pose0.yaw), 'el yaw se conserva (arriba en la pantalla = hacia donde miraba)');
  const sinC = L.poseDeCamara(1, pose0, usuario, centro, HF, { ...D, CENTRAR: false }, L.crearPose());
  check(sinC.x === usuario.x && sinC.z === usuario.z, 'con CENTRAR false se queda sobre la esfera');
  const tSub = muestras.find(m => m.p === 1).t - 60;
  check(tSub > 16 && tSub < 17.5, `la subida dura SUBIDA_S (${tSub.toFixed(2)} s con el suavizado)`); }

console.log('\n(c) altura de encuadre');
{ const r = 13.6, fov = Math.PI / 2;
  let todo = true; const txt = [];
  for (const [n, asp] of [['16:9', 16 / 9], ['16:10', 16 / 10], ['4:3', 4 / 3], ['ventana angosta 9:16', 9 / 16], ['angosta 1:2', 0.5]]) {
    const h = L.alturaDeEncuadre(r, fov, asp, 1.15, 120);
    const mv = h * Math.tan(fov / 2), mh = h * Math.tan(fov / 2) * asp;
    if (!(Math.min(mv, mh) >= r * 1.15 - 1e-9) || h > 120) todo = false;
    txt.push(`${n} ${h.toFixed(1)} m`);
  }
  check(todo, `el círculo del escenario (r 13,6 m) entra con el margen 1,15 en todas: ${txt.join(' · ')}`);
  check(L.alturaDeEncuadre(500, fov, 16 / 9, 1.15, 120) === 120, 'nunca supera el tope (ALTURA_MAX_M)');
  check(L.alturaDeEncuadre(r, fov, 0.5, 1.15, 120) > L.alturaDeEncuadre(r, fov, 16 / 9, 1.15, 120) && L.alturaDeEncuadre(20, fov, 16 / 9, 1.15, 120) > L.alturaDeEncuadre(r, fov, 16 / 9, 1.15, 120),
    'más angosta o escenario más grande → más alto');
  check(L.alturaFinalEfectiva(4, 1.6, D) === 9, 'si el escenario entrara antes de los 9 m, se detiene en la altura cenital');
  const c = L.circuloEscenario([-14.1, -3.5, 6.75, 1.7], [-9.9, -11, 0, 3.6], 4, 1.5, { cx: 0, cz: 0, r: 0 });
  check(c.r > 0 && [[-14.1, -9.9], [-3.5, -11], [6.75, 0], [1.7, 3.6]].every(([x, z]) => Math.hypot(x - c.cx, z - c.cz) <= c.r - 1.5 + 1e-9), 'el círculo abarca todos los puntos (más el margen)');
  check(L.radioAEncuadrar(10, { x: 0, z: 0 }, { x: 3, z: 4 }, false) === 15, 'sin CENTRAR: radio = distancia al borde más lejano desde la esfera'); }

console.log('\n(d) inversión a mitad del ascenso');
{ const tIn = 60 + 6;
  const tray = [];
  const e = correr(cfg(), 60 + 6 + 30, t => ({ entrada: Math.abs(t - tIn) < DT / 2 }), (t, e) => { if (e.modo || e.aterrizo) tray.push({ t, p: e.p, fase: e.fase, ...L.poseDeCamara(e.p, pose0, usuario, centro, HF, D, L.crearPose()) }); });
  let maxDv = 0, maxDy = 0, maxDpitch = 0;
  for (let i = 2; i < tray.length; i++) { const a = tray[i - 2], b = tray[i - 1], c = tray[i];
    const v1 = (b.y - a.y) / DT, v2 = (c.y - b.y) / DT; maxDv = Math.max(maxDv, Math.abs(v2 - v1)); maxDy = Math.max(maxDy, Math.abs(c.y - b.y)); maxDpitch = Math.max(maxDpitch, Math.abs(c.pitch - b.pitch)); }
  const iIn = tray.findIndex(m => m.t >= tIn), cerca = tray.slice(Math.max(2, iIn - 5), iIn + 60);
  let dvInv = 0; for (let i = 2; i < cerca.length; i++) { const a = cerca[i - 2], b = cerca[i - 1], c = cerca[i]; dvInv = Math.max(dvInv, Math.abs((c.y - b.y) / DT - (b.y - a.y) / DT)); }
  const vAntes = Math.abs((tray[iIn - 1].y - tray[iIn - 2].y) / DT);
  // la velocidad pasa de +v a −v en ~SUAVIZADO_S: ningún cuadro cambia más de una décima de la velocidad que traía
  check(maxDy < 0.05 && maxDpitch < 0.03 && dvInv < 0.1 * vAntes, `sin saltos de posición (${maxDy.toFixed(4)} m/cuadro), de inclinación (${(maxDpitch * 180 / Math.PI).toFixed(3)}°) ni de velocidad al invertir (Δv máx. ${dvInv.toFixed(4)} m/s por cuadro con ${vAntes.toFixed(2)} m/s antes)`);
  const pMax = Math.max(...tray.map(m => m.p));
  check(tray.some(m => m.fase === 'bajando') && e.fase === 'contando' && pMax < 0.6, `invierte desde ese punto (p máx. ${pMax.toFixed(3)}) y termina abajo`);
  // misma trayectoria: para el mismo p, la misma pose en la subida y en la bajada
  const sube = tray.filter(m => m.t < tIn), baja = tray.filter(m => m.fase === 'bajando');
  // a la misma altura, la misma inclinación y posición en la subida y en la bajada (interpolando la subida)
  const subeMax = Math.max(...sube.map(m => m.y));
  let difMax = 0, n = 0;
  for (const b of baja) {
    if (b.y > subeMax - 1e-6) continue;   // el tramo que sube un poco más mientras la velocidad pasa por 0
    const j = sube.findIndex(m => m.y >= b.y); if (j <= 0) continue;
    const a0 = sube[j - 1], a1 = sube[j], u = (b.y - a0.y) / Math.max(1e-12, a1.y - a0.y);
    difMax = Math.max(difMax, Math.abs(a0.pitch + (a1.pitch - a0.pitch) * u - b.pitch), Math.abs(a0.x + (a1.x - a0.x) * u - b.x)); n++;
  }
  check(n > 100 && difMax < 2e-4, `la bajada reproduce la misma trayectoria al revés: a la misma altura, la misma inclinación y posición (${n} cuadros, dif. máx. ${difMax.toExponential(1)})`);
  const tBaj = [];
  correr(cfg(), 60 + 18 + 30, t => ({ entrada: Math.abs(t - (60 + 18)) < DT / 2 }), (t, e) => { if (e.fase === 'bajando') tBaj.push(t); });
  const dur = tBaj.at(-1) - tBaj[0];
  check(dur > 20 && dur < 21.5, `desde arriba, la bajada dura BAJADA_S (${dur.toFixed(2)} s), más lenta que la subida`); }

console.log('\n(e) aterrizaje');
{ let aterrizajes = 0, poseFin = null, pAnterior = 1;
  correr(cfg(), 60 + 20 + 25, t => ({ entrada: Math.abs(t - 80) < DT / 2 }), (t, e) => { if (e.aterrizo) { aterrizajes++; poseFin = L.poseDeCamara(e.p, pose0, usuario, centro, HF, D, L.crearPose()); } if (e.modo) pAnterior = e.p; });
  check(aterrizajes === 1 && poseFin.x === usuario.x && poseFin.z === usuario.z && poseFin.y === pose0.y && poseFin.yaw === pose0.yaw && poseFin.pitch === pose0.pitch,
    'al llegar a p = 0, la cámara coincide con los ojos de la esfera, el yaw y la inclinación del despegue (sin salto)');
  check(pAnterior < 0.01, 'llega a p = 0 deslizándose (el último cuadro antes ya estaba casi abajo)'); }

console.log('\n(f) la esfera con W A S D');
{ const M = CFGM.DBG_MOV;
  const vel = M.VELOCIDAD_BASE_MS * M.VELOCIDAD_FACTOR;
  const paso = dt => (M.POR_DELTA ? M.VELOCIDAD_BASE_MS * Math.min(dt, M.DT_MAX_S) : M.PASO_POR_FRAME_M) * M.VELOCIDAD_FACTOR;
  const esf = L.crearEsfera(), tmp = { x: 0, z: 0 };
  esf.x = 0; esf.z = 5;
  const fases = {};
  correr(cfg(), 60 + 50, t => ({ entrada: Math.abs(t - 85) < DT / 2 }), (t, e) => {
    if (!e.modo) return;
    const w = (t > 62 && t < 63) || (t > 80 && t < 81) || (t > 90 && t < 91);
    const r = L.avanzarEsfera(esf, { w, a: false, s: false, d: false }, Math.PI, paso(DT), LUZ.moverConLimites, tmp);
    if (w) fases[e.fase] = (fases[e.fase] || 0) + r;
  });
  const f = Object.entries(fases).map(([k, v]) => `${k} ${v.toFixed(2)} m`).join(' · ');
  check(['subiendo', 'arriba', 'bajando'].every(k => Math.abs((fases[k] ?? 0) - vel) < vel * 0.05), `avanza en las tres fases a la velocidad de caminata (${vel.toFixed(2)} m/s): ${f}`);
  check(Math.abs(esf.z - (5 + 3 * vel)) < 0.1 && Math.abs(esf.x) < 1e-9, 'W con yaw π va hacia +z (hacia donde miraba el usuario)');
  const yawX = -Math.PI / 2, e2 = L.crearEsfera(); e2.x = 38; e2.z = 0;
  for (let i = 0; i < 600; i++) L.avanzarEsfera(e2, { w: true, a: false, s: false, d: false }, yawX, paso(DT), LUZ.moverConLimites, tmp);
  const sala = CFGM.DBG_LUZ.SALA_MEDIA_M;
  const xFin = e2.x; L.avanzarEsfera(e2, { w: true, a: false, s: false, d: false }, yawX, paso(DT), LUZ.moverConLimites, tmp);
  check(e2.x === xFin && e2.x < sala && e2.x > 38.5 && LUZ.caminable(e2.x, e2.z), `no atraviesa los límites: se frena en la pared y ahí queda (x = ${e2.x.toFixed(2)}, sala ±${sala})`);
  const e3 = L.crearEsfera(); e3.x = 0; e3.z = 0;
  L.avanzarEsfera(e3, { w: false, a: true, s: false, d: false }, 0, 1, LUZ.moverConLimites, tmp);
  check(Math.abs(e3.x + 1) < 1e-9 && Math.abs(e3.z) < 1e-9, 'A va a la izquierda de hacia donde miraba (yaw 0: −x), como Player');
  const P = L.poseDeCamara(0, pose0, esf, centro, HF, D, L.crearPose());
  check(P.x === esf.x && P.z === esf.z, 'la cámara baja a donde terminó la esfera');
  check(L.escalaEsfera(1.6, 0.1, 3) === 1 && Math.abs(L.escalaEsfera(15.6, 0.1, 3) - 1.56) < 1e-9 && L.escalaEsfera(100, 0.1, 3) === 3, 'la esfera crece con la altura de la cámara, con tope');
  const COMP = leer('../components/EsperaCamara.tsx');
  check(/avanzarEsfera\(esf, teclas\.current, R\.pose0\.yaw, paso, moverConLimites, R\.tmp\)/.test(COMP) && /DBG_MOV\.VELOCIDAD_BASE_MS \* Math\.min\(dt, DBG_MOV\.DT_MAX_S\)/.test(COMP),
    'el componente usa la MISMA función de límites (moverConLimites) y la misma caminata que Player');
  check(/R\.qr\.setFromAxisAngle\(R\.eje, d \/ Math\.max\(1e-3, D\.RADIO_M \* R\.escala\)\)/.test(COMP), 'rueda: ángulo = distancia / radio'); }

console.log('\n(g) pausa y bloqueos');
{ const pDurante = new Set(); let pDespues = 0, pausa = false;
  correr(cfg(), 60 + 12, t => { pausa = t > 66 && t < 70; return { pausado: pausa }; }, (t, e) => { if (pausa) pDurante.add(e.p); else if (t > 70.5 && !pDespues) pDespues = e.p; });
  check(pDurante.size === 1 && pDespues > [...pDurante][0], `con pausa el modo no avanza (p congelado en ${[...pDurante][0]?.toFixed(3)}; después sigue: ${pDespues.toFixed(3)})`);
  const b = correr(cfg(), 120, t => ({ bloqueado: t > 30 && t < 40 }));
  let inicio = null; correr(cfg(), 120, t => ({ bloqueado: t > 30 && t < 40 }), (t, e) => { if (inicio === null && e.fase === 'subiendo') inicio = t; });
  check(Math.abs(inicio - 100) < 0.05 && b.modo, `con un bloqueo no se activa y la cuenta se reinicia (bloqueado de 30 a 40 s: empieza a los ${inicio?.toFixed(2)} s)`);
  const ab = correr(cfg(), 70, t => ({ abortar: t > 65 }));
  check(!ab.modo && ab.p === 0, 'si algo toma la cámara en pleno modo, vuelve al instante');
  // camaraLibre con los estados reales
  globalThis.window ??= new EventTarget();
  const CL = await import('../lib/esperaCamaraLibre.ts');
  const { PAUSA } = await import('../lib/pausaExperiencia.ts');
  const { DIALOGO_STATE } = await import('../lib/dialogo/dialogoEstado.ts');
  const { INTERACT_STATE } = await import('../lib/alightStore.ts');
  const { LUZ_STATE } = await import('../lib/caminoLuz.ts');
  INTERACT_STATE.experienceState = 'exploracion';
  const casos = [];
  casos.push(['libre', CL.camaraLibre(false, false) === '']);
  PAUSA.activa = true; casos.push(['pausa', CL.camaraLibre(false, false) === 'pausa']); PAUSA.activa = false;
  DIALOGO_STATE.activo = true; casos.push(['diálogo', CL.camaraLibre(false, false) === 'dialogo']); DIALOGO_STATE.activo = false;
  INTERACT_STATE.mode = 'image'; casos.push(['atril', CL.camaraLibre(false, false) === 'atril']); INTERACT_STATE.mode = 'none';
  LUZ_STATE.fase = 'dialogo'; casos.push(['camino LUZ', CL.camaraLibre(false, false) === 'camino LUZ']); LUZ_STATE.fase = 'libre';
  INTERACT_STATE.movementLocked = true; casos.push(['secuencia SILLAS', CL.camaraLibre(false, false) === 'secuencia SILLAS']); INTERACT_STATE.movementLocked = false;
  INTERACT_STATE.experienceState = 'cortina'; casos.push(['telón (EN_TELON false)', CL.camaraLibre(false, false) === 'telon']); casos.push(['telón con EN_TELON true', CL.camaraLibre(true, false) === '']);
  INTERACT_STATE.experienceState = 'exploracion';
  casos.push(['benchmark', CL.camaraLibre(false, true) === 'benchmark']);
  check(casos.every(c => c[1]), `camaraLibre(): ${casos.map(c => (c[1] ? '' : '✗ ') + c[0]).join(' · ')}`); }

console.log('\n(h) reducir movimiento');
{ const e = correr(cfg(), 200, () => ({ reducir: true }));
  check(!e.modo && e.fase === 'inactivo', 'con prefers-reduced-motion el modo no se activa');
  const o = correr(cfg(), 100, t => ({ oculto: t < 50 }));
  let inicio = null; correr(cfg(), 120, t => ({ oculto: t < 50 }), (t, e) => { if (inicio === null && e.modo) inicio = t; });
  check(Math.abs(inicio - 110) < 0.05 && !!o, `con la pestaña oculta o sin foco no cuenta y al volver empieza de 0 (empieza a los ${inicio?.toFixed(2)} s)`); }

console.log('\n(i) avisos accesibles');
{ let entra = 0, sale = 0;
  correr(cfg(), 260, t => ({ entrada: Math.abs(t - 85) < DT / 2 || Math.abs(t - 86) < DT / 2 || Math.abs(t - 200) < DT / 2 }), (t, e) => { if (e.anunciarEntrada) entra++; if (e.anunciarSalida) sale++; });
  check(entra === 2 && sale === 2, `dos ciclos completos: ${entra} avisos de entrada y ${sale} de salida (uno por cada una, aunque haya varias entradas)`);
  check(L.TEXTO_ESPERA_ENTRA === 'Modo de espera: mové el mouse o apretá una tecla para volver' && L.TEXTO_ESPERA_SALE === 'Volviste al control', 'textos en español'); }

console.log('\n(j) lectura de código');
{ const COMP = leer('../components/EsperaCamara.tsx'), TS = leer('../components/ThreeScene.tsx'), FOOT = leer('../components/Footer.tsx'), SF = leer('../lib/esferaFooter.ts');
  const cuadros = []; let k = 0;
  while ((k = COMP.indexOf('useFrame(', k)) >= 0) { const fin = COMP.indexOf('\n  }, ', k); cuadros.push(COMP.slice(k, fin)); k = fin; }
  const sc = cuadros.map(sinCom).join('\n');
  check(cuadros.length === 3 && !/new |`|\[\s*\]|\.map\(|\.filter\(|\.slice\(|\{\s*\.\.\./.test(sc), 'tres pasos por cuadro (−1, 0,5 y 2) y ninguno crea objetos');
  check(/\}, -1\);/.test(COMP) && /\}, 0\.5\);/.test(COMP) && /\}, 2\);/.test(COMP), 'prioridades: lógica −1, pose elevada 0,5 (antes del dibujo de RendimientoHost, prioridad 1) y vuelta 2');
  check(!/setTimeout|setInterval/.test(sinCom(COMP)), 'sin timers sueltos (todo con el reloj del cuadro)');
  const add = (COMP.match(/addEventListener\(/g) || []).length, rem = (COMP.match(/removeEventListener\(/g) || []).length;
  check(add === rem && add >= 10 && /div\.remove\(\)/.test(COMP) && /recursos\.geo\.dispose\(\); recursos\.mat\.dispose\(\); recursos\.fondo\.dispose\(\); recursos\.guiaGeo\.dispose\(\); recursos\.guiaMat\.dispose\(\)/.test(COMP),
    `limpieza al desmontar: ${add} oyentes agregados y ${rem} quitados, aviso accesible, geometrías, material y textura`);
  check(/if \(ESPERA\.modo\) return;/.test(TS) && /<EsperaCamara \/>/.test(TS), 'ThreeScene: un montaje y una línea en Player (no mueve la cámara mientras dura el modo)');
  check(/from '@\/lib\/esferaFooter'/.test(FOOT) && !/const SPH_FRAG/.test(FOOT) && /export const SPH_FRAG/.test(SF) && /uniform sampler2D uBgTex/.test(SF),
    'la esfera del footer se comparte desde lib/esferaFooter.ts (el footer la importa, sin copia)');
  const { SPH_VERT, SPH_FRAG } = await import('../lib/esferaFooter.ts');
  check(SPH_VERT.includes('varying vec3 vNormal;') && SPH_VERT.includes('vNormal=normalize(normalMatrix*normal);') && SPH_FRAG.includes('varying vec3 vNormal,vViewDir,vWorldPos;')
    && SPH_FRAG.includes('vec2 du=rot2(vNormal.xy,') && SPH_FRAG.includes('gl_FragColor=vec4(col,clamp(al,0.,1.));'), 'las variantes del shader de la esfera (giro al rodar y fundido) encuentran sus puntos de anclaje');
  const RD = leer('../lib/rendimiento.ts');
  check(/id: "esperaCamara"/.test(RD) && /esperaCamara:\s+true/.test(leer('../lib/debugConfig.ts')), 'fila de benchmark "esperaCamara"'); }

console.log('\n(k) título y crédito del telón');
{ const T = CFGM.DBG_TELON_TEXTO;
  check(T.DURACION_S === 120, `DBG_TELON_TEXTO.DURACION_S = ${T.DURACION_S}`);
  const e = LT.crearEstadoTexto(); let t = 0, a119 = null, f119 = null, f121 = null, tSal = null;
  while (t < 130) { LT.avanzarTexto(e, T, t, false, true, false, false); if (a119 === null && t >= 0.3 + 119) { a119 = e.alfa; f119 = e.fase; } if (tSal === null && e.fase === 'saliendo') tSal = t; if (f121 === null && t >= 0.3 + 121) f121 = e.fase; t += DT; }
  check(f119 === 'activo' && a119 === 1 && tSal >= 120 && tSal < 120.5, `visible a los 119 s desde que aparece (alfa ${a119}) y empieza a apagarse recién a los ${tSal?.toFixed(2)} s`);
  // pausa de 90 s (el reloj de la experiencia no corre): sale a los 120 s de experiencia, no de reloj de pared
  const p = LT.crearEstadoTexto(); let tt = 0, pared = 0, salePared = null;
  while (pared < 240) { const enPausa = pared > 10 && pared < 100; LT.avanzarTexto(p, T, tt, enPausa, true, false, false); if (salePared === null && p.fase === 'saliendo') salePared = pared; if (!enPausa) tt += DT; pared += DT; }
  check(salePared > 209.9 && salePared < 210.6, `con el reloj de la experiencia: con 90 s de pausa empieza a apagarse a los ${salePared?.toFixed(1)} s de reloj de pared (120 s de experiencia)`);
  const TT = leer('../components/TelonTexto.tsx');
  check(/UC\.uAlfa\.value = alfa \* /.test(TT) && /avanzarTexto\(TELON_TEXTO, CFG_TIEMPO, RELOJ\.tExp/.test(TT), 'el crédito usa la misma opacidad que el título (dura lo mismo; no se apaga antes)'); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
