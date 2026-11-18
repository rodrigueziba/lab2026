// Z95: robustez de la presencia con un cliente de Supabase SIMULADO (lib/vivo/canalSupabase.ts fabricaCon +
// lib/vivo/presencia.ts): cierre inesperado del canal, reintentos con espera creciente (1, 2, 4, 8, 15 s), tope y
// "Reintentar presencia", motivo real (estado exacto + mensaje), cada rol con su instancia (el cierre del publicador no
// tumba al oyente), sin latidos ni listeners duplicados, y limpieza al desmontar. Uso: node scripts/presencia-robusta-test.mjs
import fs from 'node:fs';
import { OyentePresencia, PublicadorPresencia, esperaReintentoMs, motivoCanal } from '../lib/vivo/presencia.ts';
import { fabricaCon } from '../lib/vivo/canalSupabase.ts';

const src = fs.readFileSync(new URL('../lib/debugConfig.ts', import.meta.url), 'utf8');
const CFG = Function(`return (${/export const DBG_VIVO = (\{[\s\S]*?\n\});/.exec(src)[1].replace(/ as string/g, '')});`)();
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };

function crearReloj() {
  const r = { t: 1.7e12, cola: [], n: 0 };
  r.ahora = () => r.t;
  r.despues = (ms, fn) => { const h = ++r.n; r.cola.push({ h, at: r.t + ms, fn }); return h; };
  r.cancelar = h => { r.cola = r.cola.filter(x => x.h !== h); };
  r.avanzar = async (ms, paso = 100, alPaso) => {
    const fin = r.t + ms;
    while (r.t < fin) {
      r.t = Math.min(fin, r.t + paso);
      for (;;) { r.cola.sort((a, b) => a.at - b.at); const x = r.cola[0]; if (!x || x.at > r.t) break; r.cola.shift(); x.fn(); }
      for (let i = 0; i < 4; i++) await Promise.resolve();
      alPaso?.();
    }
  };
  return r;
}
// ── supabase-js simulado: un servidor de temas; cada cliente tiene sus canales ──
function crearMundo() {
  const W = { clientes: [], creados: { publicar: 0, escuchar: 0 }, caido: false, mensajeError: 'Realtime was unable to connect to the project database' };
  W.crear = rol => {
    W.creados[rol]++;
    const cl = { rol, canales: [], desconectado: false, removidos: 0 };
    cl.channel = (nombre) => {
      const ch = { topic: 'realtime:' + nombre, subs: [], syncs: [], tracks: 0, untracks: 0, cliente: cl };
      ch.on = (_t, _f, cb) => { ch.syncs.push(cb); return ch; };
      ch.subscribe = cb => { ch.subs.push(cb); queueMicrotask(() => W.caido ? cb('CHANNEL_ERROR', new Error(W.mensajeError)) : cb('SUBSCRIBED')); return ch; };
      ch.presenceState = () => ({});
      ch.track = () => { ch.tracks++; return Promise.resolve('ok'); };
      ch.untrack = () => { ch.untracks++; return Promise.resolve('ok'); };
      ch.emitir = (s, err) => ch.subs.forEach(f => f(s, err));
      cl.canales.push(ch);
      return ch;
    };
    cl.removeChannel = ch => { cl.removidos++; cl.canales = cl.canales.filter(c => c !== ch); queueMicrotask(() => ch.emitir('CLOSED')); return Promise.resolve('ok'); };
    cl.getChannels = () => cl.canales;
    cl.realtime = { disconnect() { cl.desconectado = true; } };
    W.clientes.push(cl);
    return cl;
  };
  W.fab = fabricaCon(W.crear);
  W.canalActual = rol => { const cl = W.fab.clientes[rol]; return cl ? cl.canales[cl.canales.length - 1] : null; };
  return W;
}
const deps = (R, W) => ({ fabrica: W.fab, ahora: R.ahora, despues: R.despues, cancelar: R.cancelar, enLinea: () => true });
const ID = 'sesion-abc-123456';

console.log('\nconfiguración y motivo');
check(CFG.REINTENTO_S === 1 && CFG.REINTENTO_MAX_S === 15 && CFG.MAX_REINTENTOS === 8, 'DBG_VIVO: reintentos desde 1 s, tope 15 s, máximo 8');
check([0, 1, 2, 3, 4, 5].map(n => esperaReintentoMs(n, CFG) / 1000).join() === '1,2,4,8,15,15', 'esperas 1, 2, 4, 8, 15, 15 s');
check(motivoCanal('CHANNEL_ERROR', 'Realtime was unable to connect\nstack…') === 'CHANNEL_ERROR: Realtime was unable to connect' && motivoCanal('CLOSED') === 'CLOSED'
  && motivoCanal('CHANNEL_ERROR', 'bad jwt eyJa.eyJb.c apikey=xyz') === 'CHANNEL_ERROR: bad jwt [token] apikey=[token]', 'motivo: estado exacto + mensaje de Supabase, una línea, sin tokens ni claves');

console.log('\ncierre inesperado → reintentos con espera creciente y canal NUEVO');
{ const R = crearReloj(), W = crearMundo();
  const oy = new OyentePresencia(deps(R, W), CFG), tick = () => oy.tick(true);
  tick(); await R.avanzar(100, 100, tick);
  check(oy.estadoCanal === 'SUBSCRIBED' && oy.estado === 'idle' && W.creados.escuchar === 1, 'oyente suscripto (un cliente propio del rol "escuchar")');
  W.caido = true;
  W.canalActual('escuchar').emitir('CLOSED');   // el servidor cierra el canal
  check(oy.estado === 'error' && oy.ultimoError === 'CLOSED' && oy.reconectando && oy.intento === 1, 'cierre inesperado: "reconectando (intento 1)" con el estado exacto (CLOSED)');
  const aperturas = [];
  let antes = W.creados.escuchar;
  for (let t = 0; t < 90000; t += 100) { await R.avanzar(100, 100, tick); if (W.creados.escuchar !== antes) { aperturas.push(t + 100); antes = W.creados.escuchar; } }
  const difs = aperturas.map((t, i) => (t - (i ? aperturas[i - 1] : 0)) / 1000);
  check(aperturas.length === 8, `8 reintentos, cada uno con un cliente/canal nuevo (${aperturas.length})`);
  check(difs.slice(0, 6).map(d => Math.round(d)).join() === '1,2,4,8,15,15', `esperas crecientes: ${difs.map(d => d.toFixed(1)).join(', ')} s`);
  check(oy.agotado && !oy.reconectando && oy.ultimoError.startsWith('CHANNEL_ERROR: Realtime was unable'), `tope: "agotado" con el motivo real (${oy.ultimoError})`);
  const n = W.creados.escuchar; await R.avanzar(60000, 500, tick);
  check(W.creados.escuchar === n, 'agotado: no vuelve a intentar solo');
  check(W.clientes.filter(c => c.rol === 'escuchar' && c !== W.fab.clientes.escuchar).every(c => c.desconectado), 'cada cliente viejo quedó desconectado (sin sockets colgados)');
  W.caido = false; oy.reintentar(); await R.avanzar(300, 100, tick);
  check(oy.estadoCanal === 'SUBSCRIBED' && !oy.agotado && oy.intento === 0, '"Reintentar presencia": vuelve a suscribirse'); oy.cerrar(); }

console.log('\ncada rol con su instancia: el publicador no tumba al oyente');
{ const R = crearReloj(), W = crearMundo();
  const oy = new OyentePresencia(deps(R, W), CFG), tick = () => oy.tick(true);
  const pub = new PublicadorPresencia(deps(R, W), CFG, ID);
  tick(); pub.publicar({ modo: 'privado', consentimiento: true }); await R.avanzar(300, 100, tick);
  const chO = W.canalActual('escuchar'), chP = W.canalActual('publicar');
  check(chO && chP && chO !== chP && chO.cliente !== chP.cliente, 'misma pestaña: dos clientes y dos canales (no se comparten)');
  pub.detener(); await R.avanzar(300, 100, tick);
  check(chP.untracks === 1 && chP.cliente.removidos === 1 && chO.cliente.removidos === 0, 'detener el publicador: untrack y quita SOLO su canal');
  check(oy.estadoCanal === 'SUBSCRIBED' && oy.errores === 0, '…el oyente sigue suscripto (sin errores)');
  chP.emitir('CHANNEL_ERROR', new Error('x'));
  check(oy.errores === 0 && pub.errores === 0, 'un error tardío del canal cerrado del publicador no llega a nadie');
  // error del canal del oyente: no toca al publicador
  const pub2 = new PublicadorPresencia(deps(R, W), CFG, ID); pub2.publicar({ modo: 'cara', consentimiento: true }); await R.avanzar(300, 100, tick);
  W.canalActual('escuchar').emitir('CHANNEL_ERROR', new Error('boom'));
  check(oy.errores === 1 && pub2.errores === 0 && pub2.estado === 'active', 'un error del canal del oyente no tumba al publicador');
  oy.cerrar(); pub2.detener(); }

console.log('\nsin latidos ni listeners duplicados');
{ const R = crearReloj(), W = crearMundo();
  const pub = new PublicadorPresencia(deps(R, W), { ...CFG, LATIDO_S: 5 }, ID);
  pub.publicar({ modo: 'privado', consentimiento: true }); await R.avanzar(300);
  for (let k = 0; k < 3; k++) { W.canalActual('publicar').emitir('CLOSED'); await R.avanzar(20000); }   // tres caídas y reconexiones
  const ch = W.canalActual('publicar'), l0 = pub.presencia.latido, tr0 = ch.tracks;
  await R.avanzar(20000);
  check(pub.estado === 'active' && pub.presencia.latido - l0 === 4 && ch.tracks - tr0 === 4, `tras 3 reconexiones: un solo latido (4 en 20 s, no ${pub.presencia.latido - l0 > 4 ? 'duplicados' : 'menos'})`);
  check(ch.subs.length === 1 && ch.syncs.length === 1, 'el canal vigente tiene un solo callback de estado y uno de sync');
  const viejos = W.clientes.filter(c => c !== W.fab.clientes.publicar);
  check(viejos.length === 3 && viejos.every(c => c.desconectado), 'los 3 clientes anteriores quedaron desconectados');
  pub.detener(); }

console.log('\nlimpieza al desmontar');
{ const R = crearReloj(), W = crearMundo();
  const oy = new OyentePresencia(deps(R, W), CFG), tick = () => oy.tick(true);
  tick(); await R.avanzar(200, 100, tick);
  W.caido = true; W.canalActual('escuchar').emitir('CLOSED');
  check(oy.reconectando, 'reintento pendiente');
  oy.cerrar();
  check(!oy.reconectando && R.cola.length === 0 && oy.estado === 'idle', 'cerrar: cancela el reintento pendiente (ningún temporizador queda vivo)');
  const n = W.creados.escuchar; await R.avanzar(30000);
  check(W.creados.escuchar === n, 'nada se reabre solo después de desmontar'); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
