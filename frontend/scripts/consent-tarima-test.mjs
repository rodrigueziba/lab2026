// Z91: prueba del consentimiento de la tarima (lib/consentTarima.ts): tiempos y estados, "no compartir" por defecto,
// cerrar sin elegir, compartir publica una sola vez, corte, límite de duración con aviso, recordado en la sesión, modo
// según la fuente; el .ink compilado recorrido con inkjs (textos exactos, 2 opciones, efectos); sin presencia si falla
// la red (publicador de Z89 con un canal que no responde); e integración leyendo el código. Uso: node scripts/consent-tarima-test.mjs
import fs from 'node:fs';
import { Story } from 'inkjs';
import {
  crearConsent, iniciarConsent, tickConsent, finTexto1, elegirConsent, cortarConsent, forzarEleccion, reiniciarConsent,
  modoSegunFuente, segundosTx, segundosRestantes, serializarConsent, leerRecordado, aplicarRecordado,
  crearSubida, tickSubida, faseConsent, atrilesPermitidos,
} from '../lib/consentTarima.ts';
import { PublicadorPresencia } from '../lib/vivo/presencia.ts';

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const src = leer('../lib/debugConfig.ts');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string/g, '')});`)();
const C = obj('DBG_CONSENT'), V = obj('DBG_VIVO');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const T1 = 'La luz viene con propio peso. Exponerse y ser juzgado por uno mismo y por otros.';
const T2 = 'Podés elegir compartir con otros tu experiencia en la luz siendo el centro de atención por un rato. Hasta ahora nada estuvo expuesto ni en línea, pero si querés podés ser el centro de atención de las personas que eligen el camino de las sillas.';

console.log('\nconfiguración');
check(C.ACTIVO === true && C.ESPERA_INICIAL_S === 8 && C.ESPERA_ENTRE_S === 8 && C.RECORDAR_EN_SESION === false && C.DURACION_MAX_S === 300 && C.AVISO_FIN_S === 30,
  'DBG_CONSENT: ACTIVO, esperas 8 y 8 s, sin recordar en la sesión (Z93a), 300 s de máximo, aviso a 30 s');

// simulación a 10 Hz: devuelve los instantes (s) de cada acción
const T0 = 1_763_500_000_000;
const correr = (st, hasta, cfg = C, libre = () => true, al = {}) => {
  const ev = [];
  for (let t = st._t ?? 0; t <= hasta + 1e-9; t = Math.round((t + 0.1) * 10) / 10) {
    st._t = t;
    const a = tickConsent(st, cfg, T0 + t * 1000, libre(t));
    if (a !== 'ninguna') { ev.push([a, t]); al[a]?.(t); }
  }
  st._t = hasta + 0.1;
  return ev;
};

console.log('\nsecuencia de tiempos');
{ const st = crearConsent();
  check(st.estado === 'inactivo' && tickConsent(st, C, T0 + 60000, true) === 'ninguna', 'antes de las figuras: inactivo (no pasa nada)');
  iniciarConsent(st, T0);   // alight:people-visible en t = 0
  let ev = correr(st, 7.9);
  check(ev.length === 0 && st.estado === 'esperando', 'figuras en escena: espera 8 s sin mostrar nada');
  ev = correr(st, 8.0);
  check(ev[0]?.[0] === 'abrirTexto1' && ev[0][1] === 8 && st.estado === 'texto1', 'a los 8 s se abre el texto 1');
  // el texto se escribe (~4 s) y termina
  finTexto1(st, T0 + 12000); st._t = 12.0;
  ev = correr(st, 19.9);
  check(ev.length === 0 && st.estado === 'esperando2', 'después de que termina el texto 1: segunda espera');
  ev = correr(st, 20.0);
  check(ev[0]?.[0] === 'abrirEleccion' && ev[0][1] === 20 && st.estado === 'eligiendo', '8 s después del fin del texto 1 se abre la elección');
  const r = elegirConsent(st, 'privado', 'cara', T0 + 25000);
  check(st.estado === 'privado' && r.atriles && !r.publicar && st.publicaciones === 0, '"No compartir": salen los atriles y no se publica nada');
  check(correr(st, 400).length === 0, 'en privado no hay aviso ni corte'); }
{ const st = crearConsent(); iniciarConsent(st, T0);
  correr(st, 8, C, t => t >= 11);   // otra terminal abierta hasta t = 11
  check(st.estado === 'esperando', 'si otra terminal está abierta (camino LUZ, aviso de Z85), espera');
  const ev = correr(st, 11, C, t => t >= 11);
  check(ev[0]?.[0] === 'abrirTexto1' && ev[0][1] === 11, '…y abre el texto 1 cuando se libera'); }

console.log('\nno compartir por defecto · cerrar sin elegir');
{ const st = crearConsent(); iniciarConsent(st, T0); forzarEleccion(st, T0);
  // cerrar la terminal sin elegir: consentTarimaAcciones llama elegir("privado")
  const r = elegirConsent(st, 'privado', 'cara', T0 + 1000);
  check(st.estado === 'privado' && r.atriles && !r.publicar, 'cerrar sin elegir = No compartir: atriles, sin publicar');
  const r2 = elegirConsent(st, 'compartir', 'cara', T0 + 2000);
  check(st.estado === 'privado' && !r2.publicar && !r2.atriles, 'después de decidir, una elección tardía no hace nada (no publica, no repite los atriles)');
  const st2 = crearConsent(); iniciarConsent(st2, T0);
  check(!elegirConsent(st2, 'compartir', 'cara', T0).publicar && st2.estado === 'esperando', 'compartir antes de que aparezca la elección: ignorado (nada sin elección explícita)'); }

console.log('\ncompartir · una sola publicación · corte · límite');
{ const st = crearConsent(); iniciarConsent(st, T0); forzarEleccion(st, T0);
  const r = elegirConsent(st, 'compartir', 'privado', T0);
  check(st.estado === 'compartiendo' && r.atriles && r.publicar && st.publicaciones === 1 && st.modo === 'privado', '"Compartir": salen los atriles y se publica una vez');
  check(!elegirConsent(st, 'compartir', 'privado', T0 + 1000).publicar && st.publicaciones === 1, 'un segundo "compartir" no vuelve a publicar');
  st._t = 0;
  const ev = correr(st, 300);
  const av = ev.find(e => e[0] === 'avisoFin'), fin = ev.find(e => e[0] === 'cortarPorTiempo');
  check(av && av[1] === 270, `aviso "La transmisión termina en ${C.AVISO_FIN_S} s" a los 270 s`);
  check(fin && fin[1] === 300 && st.estado === 'cortado' && st.motivoCorte === 'tiempo', 'a los 300 s se corta igual que con el botón');
  check(Math.round(segundosTx(st, T0 + 400000)) === 300, 'tiempo transmitido = 300 s (no sigue contando después del corte)');
  check(ev.filter(e => e[0] === 'avisoFin').length === 1, 'el aviso se muestra una sola vez');
  check(correr(st, 600).length === 0 && st.estado === 'cortado' && st.publicaciones === 1, 'cortado: no se vuelve a transmitir');
  reiniciarConsent(st); iniciarConsent(st, T0);
  check(st.estado === 'esperando' && st.publicaciones === 0 && !st.atrilesPedidos, 'solo pasando otra vez por el consentimiento (reiniciar) se puede volver a transmitir'); }
{ const st = crearConsent(); iniciarConsent(st, T0); forzarEleccion(st, T0); elegirConsent(st, 'compartir', 'cara', T0);
  check(cortarConsent(st, T0 + 42000, 'boton') && st.estado === 'cortado' && Math.round(segundosTx(st, T0 + 99000)) === 42, 'botón o X: corte al instante (42 s transmitidos)');
  check(!cortarConsent(st, T0 + 50000), 'cortar de nuevo no hace nada'); }
{ const cfg = { ...C, DURACION_MAX_S: 40 }, st = crearConsent(); iniciarConsent(st, T0); forzarEleccion(st, T0); elegirConsent(st, 'compartir', 'cara', T0); st._t = 0;
  const ev = correr(st, 40, cfg);
  check(ev[0]?.[0] === 'avisoFin' && ev[0][1] === 10 && ev[1]?.[0] === 'cortarPorTiempo' && ev[1][1] === 40, 'DURACION_MAX_S 40: aviso a los 10 s y corte a los 40 s');
  check(Math.round(segundosRestantes({ ...st, estado: 'compartiendo' }, cfg, T0 + 25000)) === 15, 'segundos restantes para el rótulo'); }

console.log('\nmodo según la fuente de video (Z87)');
check(modoSegunFuente('webcam') === 'cara' && modoSegunFuente('ondas') === 'privado' && modoSegunFuente(undefined) === 'privado', 'webcam → "cara"; ondas o sin cámara → "privado"');

console.log('\nrecordar en la sesión de la pestaña');
{ const st = crearConsent(); iniciarConsent(st, T0); forzarEleccion(st, T0); elegirConsent(st, 'privado', 'cara', T0);
  const txt = serializarConsent(st);
  check(JSON.parse(txt).eleccion === 'privado' && serializarConsent(crearConsent()) === null, 'se guarda solo la elección (nada antes de elegir)');
  const r = crearConsent(), res = aplicarRecordado(r, leerRecordado(txt), C, 'cara', T0 + 5000);
  check(r.estado === 'privado' && res.atriles && !res.publicar, 'al recargar con "No compartir": atriles sin preguntar, sin publicar');
  const s2 = crearConsent(); iniciarConsent(s2, T0); forzarEleccion(s2, T0); elegirConsent(s2, 'compartir', 'cara', T0);
  const t2 = serializarConsent(s2), r2 = crearConsent(), res2 = aplicarRecordado(r2, leerRecordado(t2), C, 'cara', T0 + 60000);
  check(r2.estado === 'compartiendo' && res2.publicar && r2.inicioTx === T0 && Math.round(segundosRestantes(r2, C, T0 + 60000)) === 240, 'al recargar con "Compartir": sigue transmitiendo con el mismo límite (le quedan 240 s)');
  const r3 = crearConsent(), res3 = aplicarRecordado(r3, leerRecordado(t2), C, 'cara', T0 + 301000);
  check(r3.estado === 'cortado' && !res3.publicar && res3.atriles, 'si al recargar ya pasó el límite: cortado, sin publicar');
  cortarConsent(s2, T0 + 1000);
  check(JSON.parse(serializarConsent(s2)).eleccion === 'privado', 'cortado se recuerda como privado (no se reanuda solo)');
  check(leerRecordado('{"eleccion":"todo"}') === null && leerRecordado('basura') === null && leerRecordado(null) === null, 'valores raros en sessionStorage: se ignoran'); }

console.log('\nsin presencia si falla la red (publicador de Z89)');
{ let tracks = 0;
  const canalMuerto = { alSincronizar() {}, estado: () => ({}), suscribir(cb) { queueMicrotask(() => cb('CHANNEL_ERROR')); }, track() { tracks++; }, untrack() {}, cerrar() {} };
  const D = { fabrica: () => canalMuerto, ahora: () => T0, despues: () => 1, cancelar() {}, enLinea: () => true };
  const pub = new PublicadorPresencia(D, V, 'sesion-prueba-1234');
  const r = pub.publicar({ modo: 'privado', consentimiento: true });
  await Promise.resolve(); await Promise.resolve();
  check(r.ok && pub.estado === 'error' && tracks === 0, 'canal caído: no se publica ninguna presencia (estado error → el rótulo dice SIN CONEXIÓN)');
  const sinRed = new PublicadorPresencia({ ...D, enLinea: () => false }, V, 'sesion-prueba-5678');
  sinRed.publicar({ modo: 'cara', consentimiento: true });
  check(sinRed.estado === 'error' && tracks === 0, 'sin red: error, sin presencia');
  const st = crearConsent(); iniciarConsent(st, T0); forzarEleccion(st, T0); elegirConsent(st, 'compartir', 'privado', T0);
  check(st.estado === 'compartiendo', 'la sesión sigue local (atriles, indicador, límite) aunque la presencia falle'); }

console.log('\ntexto (docs/dialogos/tarima-exponerse.ink compilado)');
{ const json = leer('../public/alight/dialogo/tarima-exponerse.json');
  const ink = leer('../../docs/dialogos/tarima-exponerse.ink');
  const correrInk = (knot, opcion) => {
    const s = new Story(json); const efectos = []; let texto = '';
    if (knot) s.ChoosePathString(knot);
    const leerTodo = () => { while (s.canContinue) { texto += s.Continue(); for (const t of s.currentTags) { const m = /^efecto:\s*(\S+)/.exec(t); if (m) efectos.push(m[1]); } } };
    leerTodo();
    const ops = s.currentChoices.map(c => c.text);
    if (opcion !== undefined) { s.ChooseChoiceIndex(opcion); leerTodo(); }
    return { texto: texto.trim(), ops, efectos };
  };
  const a = correrInk(null);
  check(a.texto === T1 && a.ops.length === 0, 'inicio = texto 1 exacto, sin opciones (termina solo → dialogo-fin)');
  const b = correrInk('tx_eleccion');
  check(b.texto === T2, 'texto de la elección exacto');
  check(b.ops.join(' | ') === 'Compartir mi sesión. | No compartir.', 'dos opciones: "Compartir mi sesión." y "No compartir."');
  check(correrInk('tx_eleccion', 0).efectos.join() === 'tarima_compartir' && correrInk('tx_eleccion', 1).efectos.join() === 'tarima_privado', 'efectos: tarima_compartir y tarima_privado');
  check(/# id: tx\.1/.test(ink) && /# estado: cerrado/.test(ink), 'mismas convenciones (tags id / estado / efecto)'); }

console.log('\nintegración (lectura del código)');
{ const LS = leer('../components/LecternSystem.tsx'), TS = leer('../components/ThreeScene.tsx'), EF = leer('../lib/dialogo/efectosDialogo.ts');
  const AC = leer('../lib/consentTarimaAcciones.ts'), VA = leer('../lib/vivo/vivoAcciones.ts'), IB = leer('./ink-build.mjs'), MAPA = leer('../../docs/dialogos/MAPA_DIALOGOS.md');
  check(/if \(DBG_CONSENT\.ACTIVO && DBG_CONSENT\.ATRILES_TRAS_CONSENTIMIENTO\) return;\n\s*if \(timer\) clearTimeout\(timer\);\n\s*timer = setTimeout\(\(\) => \{ timer = null; requestLecterns\(\); \}, LECTERNS_AFTER_PEOPLE_MS\);/.test(LS),
    'ACTIVO false: el temporizador de J1 sigue igual (atriles a los 10 s); true: los pide el consentimiento');
  check(/path !== "sillas" && <ConsentTarimaHost \/>/.test(TS), 'host montado junto a LecternSystem (al salir de la tarima se desmonta y corta)');
  check(/tarima_compartir:/.test(EF) && /tarima_privado:/.test(EF), 'efectos mapeados en efectosDialogo.ts');
  check(/\['tarima-exponerse'\]/.test(IB) && !/tx_eleccion|tarima_compartir/.test(MAPA), 'ink-build lo compila aparte (no entra en el mapa del diálogo de la luz)');
  check(/window\.addEventListener\("pagehide", _alSalir\)/.test(VA) && /_alSalir = \(\) => detenerPresencia\(\)/.test(VA), 'recargar o cerrar la pestaña: pagehide → detenerPresencia (Z89)');
  check(/publicarPresencia\(\{ modo: CONSENT\.modo \?\? "privado", consentimiento: true \}\)/.test(AC) && (AC.match(/publicarPresencia\(/g) || []).length === 1, 'publicarPresencia solo en aplicar() tras una elección "compartir" (una llamada)');
  check(/cortarTransmision\("salida"\)/.test(AC), 'al desmontar (salir de la tarima) se corta'); }

// ── Z93a: orden de la tarima (reloj simulado) ──
console.log('\nZ93a: cronología con reloj simulado');
const R = 2.5;   // radio de ZONA_TARIMA
// simula ConsentTarimaHost + consentTarimaAcciones: tick por "cuadro" de 100 ms; el texto 1 termina 4 s después de abrirse;
// la elección llega cuando el test la da. Devuelve la línea de tiempo de eventos.
function simular({ conCamara = true, figurasEn = 9000, fuera = [], eligeEn = null, eleccion = 'privado', hasta = 60000, cfg = {} } = {}) {
  const c = { ...C, ...cfg };
  const st = crearConsent(), sb = crearSubida(), ev = [];
  let atriles = false, terminal = null, finTx1 = -1;
  const pedirAtriles = (t, por) => { if (!atriles && atrilesPermitidos(st, c.ACTIVO, c.ATRILES_TRAS_CONSENTIMIENTO)) { atriles = true; ev.push([t, 'atriles', por]); } };
  sb.tEntrada = 0;
  for (let t = 0; t <= hasta; t += 100) {
    if (t === 100) sb.tEntrada = t;                                        // alight:chose-light
    if (figurasEn !== null && t === figurasEn) { sb.figuras = true; ev.push([t, 'figuras']); }   // alight:people-visible
    if (!c.ATRILES_TRAS_CONSENTIMIENTO && figurasEn !== null && t === figurasEn + 10000) pedirAtriles(t, 'J1');
    const afuera = fuera.some(([a, b]) => t >= a && t < b);
    if (c.ACTIVO) {
      const a = tickSubida(st, sb, c, t, afuera ? 4 : 0, R, atriles);
      if (a === 'iniciar') ev.push([t, 'inicia']);
      if (a === 'cancelar') { ev.push([t, 'cancela']); terminal = null; }
    }
    const acc = tickConsent(st, c, t, terminal === null);
    if (acc === 'abrirTexto1') { terminal = 'texto1'; finTx1 = t + 4000; ev.push([t, 'texto1']); }
    else if (acc === 'abrirEleccion') { terminal = 'eleccion'; ev.push([t, 'texto2']); }
    if (terminal === 'texto1' && t === finTx1) { finTexto1(st, t); terminal = null; ev.push([t, 'fin texto1']); }
    if (terminal === 'eleccion' && eligeEn !== null && t >= eligeEn) {
      const r = elegirConsent(st, eleccion, conCamara ? 'cara' : 'privado', t); terminal = null; ev.push([t, 'elige ' + eleccion]);
      if (r.atriles) pedirAtriles(t, 'consentimiento');
      if (r.publicar) ev.push([t, 'publica ' + st.modo]);
    }
  }
  return { ev, st, sb, at: n => (ev.find(e => e[1] === n) || [null])[0] };
}
{ const S = simular({ eligeEn: 35000 });
  check(S.at('inicia') === 9000 && S.at('texto1') === 9000 + C.ESPERA_INICIAL_S * 1000, `texto 1 a ESPERA_INICIAL_S (${C.ESPERA_INICIAL_S} s) de que emergen las figuras (t=${S.at('texto1')})`);
  check(S.at('texto2') === S.at('fin texto1') + C.ESPERA_ENTRE_S * 1000, `texto 2 a ESPERA_ENTRE_S (${C.ESPERA_ENTRE_S} s) del fin del texto 1 (t=${S.at('texto2')})`);
  check(S.at('atriles') === 35000 && S.at('atriles') > S.at('texto2') && S.ev.filter(e => e[1] === 'atriles').length === 1, 'atriles SOLO tras la elección (una vez)');
  check(!S.ev.some(e => e[1].startsWith('publica')), 'No compartir: no se publica nada'); }
{ const S = simular({ eligeEn: 35000, eleccion: 'compartir' });
  check(S.at('publica cara') === 35000 && S.at('atriles') === 35000 && !S.ev.some(e => e[1].startsWith('publica') && e[0] < 35000), 'Compartir: atriles y publicación al elegir; nada antes'); }
{ const S = simular({ eligeEn: null, hasta: 120000 });
  check(S.at('texto2') !== null && S.at('atriles') === null && S.st.estado === 'eligiendo', 'sin elección: los atriles siguen esperando (nada se transmite)'); }
{ // re-render / cuadros repetidos: un solo disparo por subida
  const st = crearConsent(), sb = crearSubida(); sb.tEntrada = 1; sb.figuras = true; let n = 0;
  for (let t = 0; t < 3000; t += 16) if (tickSubida(st, sb, C, t, 0, R, false) === 'iniciar') n++;
  check(n === 1 && st.estado === 'esperando', 'un solo inicio por subida aunque el tick corra muchas veces'); }

console.log('\nZ93a: bajar de la tarima cancela; volver a subir reinicia');
{ const S = simular({ fuera: [[12000, 15000]], eligeEn: 50000 });
  check(S.at('cancela') !== null && S.at('cancela') >= 12000 && S.at('cancela') < 12200, 'baja durante la espera inicial: se cancela');
  const inicios = S.ev.filter(e => e[1] === 'inicia').map(e => e[0]);
  check(inicios.length === 2 && inicios[1] === 15000, 'vuelve a subir: reinicia (segundo inicio al subir)');
  check(S.at('texto1') === 15000 + C.ESPERA_INICIAL_S * 1000, 'la espera inicial cuenta de nuevo desde la nueva subida');
  check(S.at('atriles') === 50000, 'atriles solo tras la elección'); }
{ const S = simular({ fuera: [[25000, 27000]], eligeEn: 60000 });   // durante la espera entre textos
  const c = S.ev.find(e => e[1] === 'cancela');
  check(c && S.ev.filter(e => e[1] === 'texto1').length === 2, 'baja entre el texto 1 y el 2: cancela y al volver empieza desde el texto 1'); }
{ const st = crearConsent(), sb = crearSubida(); sb.tEntrada = 1; sb.figuras = true;
  tickSubida(st, sb, C, 0, 0, R, false);
  check(tickSubida(st, sb, C, 100, R + C.SALIDA_EXTRA_M - 0.01, R, false) === 'ninguna' && st.estado === 'esperando', 'histéresis: entre el radio y radio + SALIDA_EXTRA_M no cancela');
  check(tickSubida(st, sb, C, 200, R + C.SALIDA_EXTRA_M + 0.01, R, false) === 'cancelar' && st.estado === 'inactivo', 'más allá: cancela');
  check(tickSubida(st, sb, C, 300, R + 0.2, R, false) === 'ninguna' && st.estado === 'inactivo', 'para volver hay que entrar al radio');
  check(tickSubida(st, sb, C, 400, R - 0.1, R, false) === 'iniciar', 'adentro del radio: reinicia'); }
{ const S = simular({ fuera: [[45000, 48000]], eligeEn: 35000 });
  check(S.at('cancela') === null && S.st.estado === 'privado', 'después de elegir, bajar no cancela nada'); }

console.log('\nZ93a: sin cámara');
{ // sin cámara: face-captured llega por el fallo → las figuras emergen igual; el modo es "privado" (ondas)
  const S = simular({ conCamara: false, eligeEn: 35000, eleccion: 'compartir' });
  check(S.at('texto1') === 9000 + C.ESPERA_INICIAL_S * 1000 && S.at('publica privado') === 35000, 'sin cámara: el flujo avanza igual y comparte en modo privado (ondas)'); }
{ // permiso sin responder: las figuras nunca llegan → arranca ESPERA_FIGURAS_MAX_S después de elegir la tarima
  const S = simular({ figurasEn: null, eligeEn: 70000, hasta: 80000 });
  check(S.at('inicia') === 100 + C.ESPERA_FIGURAS_MAX_S * 1000 && S.at('texto1') !== null && S.at('atriles') === 70000, `sin figuras: arranca a ESPERA_FIGURAS_MAX_S (${C.ESPERA_FIGURAS_MAX_S} s) de subir; nunca se queda esperando`); }
{ const st = crearConsent(), sb = crearSubida(); sb.tEntrada = 1;
  check(tickSubida(st, sb, C, 999999, 0, R, true) === 'ninguna', 'atriles ya afuera por otro camino (TARIMA sin público): no arranca'); }

console.log('\nZ93a: flag ATRILES_TRAS_CONSENTIMIENTO');
check(C.ATRILES_TRAS_CONSENTIMIENTO === true && C.ESPERA_FIGURAS_MAX_S === 30 && C.SALIDA_EXTRA_M === 0.5, 'DBG_CONSENT: ATRILES_TRAS_CONSENTIMIENTO true, ESPERA_FIGURAS_MAX_S 30, SALIDA_EXTRA_M 0.5');
{ const S = simular({ cfg: { ATRILES_TRAS_CONSENTIMIENTO: false }, eligeEn: 35000 });
  check(S.at('atriles') === 19000 && S.at('texto1') === 17000, 'false: como antes (atriles 10 s después de las figuras, J1) y los textos siguen');
  check(S.ev.filter(e => e[1] === 'atriles').length === 1, '…sin repetir los atriles al elegir'); }
{ const S = simular({ cfg: { ACTIVO: false }, eligeEn: 35000 });
  check(S.at('texto1') === null && S.at('atriles') === null, 'ACTIVO false sin el temporizador simulado: ni textos (los atriles los pide J1 en LecternSystem)');
  const st = crearConsent(); st.estado = 'esperando';
  check(atrilesPermitidos(st, false, true) && atrilesPermitidos(st, true, false) && !atrilesPermitidos(st, true, true), 'puerta de los atriles: cerrada solo con ACTIVO y el flag, antes de elegir'); }
{ const st = crearConsent(), sb = crearSubida();
  check(faseConsent(st, sb, C, 0, false).fase === 'sin subir a la tarima', 'fase: sin subir');
  sb.tEntrada = 1000; check(faseConsent(st, sb, C, 3000, false).fase === 'esperando las figuras' && Math.abs(faseConsent(st, sb, C, 3000, false).faltan - (C.ESPERA_FIGURAS_MAX_S - 2)) < 1e-9, 'fase: esperando las figuras, con segundos que faltan');
  iniciarConsent(st, 5000); check(faseConsent(st, sb, C, 7000, false).fase === 'esperando texto 1' && faseConsent(st, sb, C, 7000, false).faltan === C.ESPERA_INICIAL_S - 2, 'fase: esperando texto 1 y faltan');
  st.estado = 'eligiendo'; check(faseConsent(st, sb, C, 0, false).fase.startsWith('texto 2'), 'fase: texto 2');
  st.estado = 'privado'; check(faseConsent(st, sb, C, 0, true).fase === 'elegido (privado) · atriles visibles', 'fase: elegido · atriles visibles'); }
{ const AC = leer('../lib/consentTarimaAcciones.ts'), LS = leer('../components/LecternSystem.tsx'), H = leer('../components/ConsentTarimaHost.tsx');
  check(/if \(!atrilesPermitidosAhora\(\)\) return;/.test(LS), 'LecternSystem no muestra los atriles (ni la caja de ritmos, que vive adentro) antes de la elección');
  check(/tickConsentTarima\(camera\.position\.x, camera\.position\.z\)/.test(H) && /tickSubida\(CONSENT, SUBIDA/.test(AC), 'el host pasa la posición; el tick decide arranque y cancelación');
  check(!/function alPersonas[\s\S]*?iniciarConsent\(CONSENT[\s\S]*?\n}/.test(AC.split('export function instalarConsentTarima')[0].split('function alPersonas')[1] ? 'function alPersonas' + AC.split('function alPersonas')[1].split('\n}\n')[0] + '\n}' : ''), 'alPersonas ya no arranca la espera directamente (no depende del cuadro de cara)');
  check(/Object\.assign\(SUBIDA, crearSubida\(\)\)/.test(AC) && /removeEventListener\("alight:chose-light", onLight\)/.test(AC), 'limpieza al desmontar'); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
