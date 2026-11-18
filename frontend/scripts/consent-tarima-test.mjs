// Z91: prueba del consentimiento de la tarima (lib/consentTarima.ts): tiempos y estados, "no compartir" por defecto,
// cerrar sin elegir, compartir publica una sola vez, corte, límite de duración con aviso, recordado en la sesión, modo
// según la fuente; el .ink compilado recorrido con inkjs (textos exactos, 2 opciones, efectos); sin presencia si falla
// la red (publicador de Z89 con un canal que no responde); e integración leyendo el código. Uso: node scripts/consent-tarima-test.mjs
import fs from 'node:fs';
import { Story } from 'inkjs';
import {
  crearConsent, iniciarConsent, tickConsent, finTexto1, elegirConsent, cortarConsent, forzarEleccion, reiniciarConsent,
  modoSegunFuente, segundosTx, segundosRestantes, serializarConsent, leerRecordado, aplicarRecordado,
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
check(C.ACTIVO === true && C.ESPERA_INICIAL_S === 8 && C.ESPERA_ENTRE_S === 8 && C.RECORDAR_EN_SESION === true && C.DURACION_MAX_S === 300 && C.AVISO_FIN_S === 30,
  'DBG_CONSENT: ACTIVO, esperas 8 y 8 s, recordar en la sesión, 300 s de máximo, aviso a 30 s');

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
  check(/if \(DBG_CONSENT\.ACTIVO\) return;[^\n]*\n\s*if \(timer\) clearTimeout\(timer\);\n\s*timer = setTimeout\(\(\) => \{ timer = null; requestLecterns\(\); \}, LECTERNS_AFTER_PEOPLE_MS\);/.test(LS),
    'ACTIVO false: el temporizador de J1 sigue igual (atriles a los 10 s); true: los pide el consentimiento');
  check(/path !== "sillas" && <ConsentTarimaHost \/>/.test(TS), 'host montado junto a LecternSystem (al salir de la tarima se desmonta y corta)');
  check(/tarima_compartir:/.test(EF) && /tarima_privado:/.test(EF), 'efectos mapeados en efectosDialogo.ts');
  check(/\['tarima-exponerse'\]/.test(IB) && !/tx_eleccion|tarima_compartir/.test(MAPA), 'ink-build lo compila aparte (no entra en el mapa del diálogo de la luz)');
  check(/window\.addEventListener\("pagehide", _alSalir\)/.test(VA) && /_alSalir = \(\) => detenerPresencia\(\)/.test(VA), 'recargar o cerrar la pestaña: pagehide → detenerPresencia (Z89)');
  check(/publicarPresencia\(\{ modo: CONSENT\.modo \?\? "privado", consentimiento: true \}\)/.test(AC) && (AC.match(/publicarPresencia\(/g) || []).length === 1, 'publicarPresencia solo en aplicar() tras una elección "compartir" (una llamada)');
  check(/cortarTransmision\("salida"\)/.test(AC), 'al desmontar (salir de la tarima) se corta'); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
