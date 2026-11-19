// Z89: prueba de la presencia de la sesión en vivo (lib/vivo/presencia.ts) con un CANAL SIMULADO (un "servidor" de
// presencia en memoria) y temporizadores falsos: sesión más reciente, vigencia por reloj local, presencias inválidas,
// timeout, un solo publicador, rechazo sin consentimiento, errores, reintentos y cierre. Uso: node scripts/presencia-vivo-test.mjs
import fs from 'node:fs';
import { validarPresencia, actualizarRegistro, sesionMasReciente, esperaReintentoMs, OyentePresencia, PublicadorPresencia, MAX_FUTURO_MS } from '../lib/vivo/presencia.ts';

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const src = leer('../lib/debugConfig.ts');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string/g, '')});`)();
const CFG = obj('DBG_VIVO');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };

// ── reloj y temporizadores falsos ──
const T0 = 1_763_400_000_000;   // 2025-11
function crearReloj() {
  const r = { t: T0, cola: [], n: 0 };
  r.ahora = () => r.t;
  r.despues = (ms, fn) => { const h = ++r.n; r.cola.push({ h, at: r.t + ms, fn }); return h; };
  r.cancelar = h => { r.cola = r.cola.filter(x => x.h !== h); };
  r.avanzar = async (ms, paso = 100, alPaso) => {
    const fin = r.t + ms;
    while (r.t < fin) {
      r.t = Math.min(fin, r.t + paso);
      for (;;) { r.cola.sort((a, b) => a.at - b.at); const x = r.cola[0]; if (!x || x.at > r.t) break; r.cola.shift(); x.fn(); }
      await Promise.resolve(); await Promise.resolve();
      alPaso?.();
    }
  };
  return r;
}

// ── servidor de presencia simulado (un tema → presencias por canal) ──
function crearServidor() {
  const S = { temas: new Map(), caido: false, aperturas: 0, inyectadas: [] };
  const tema = n => { if (!S.temas.has(n)) S.temas.set(n, new Set()); return S.temas.get(n); };
  const notificar = n => { for (const c of tema(n)) c._sync.forEach(f => f()); };
  S.estadoDe = n => { const st = {}; let i = 0; for (const c of tema(n)) if (c._meta) st['k' + (i++)] = [{ ...c._meta, presence_ref: 'r' + i }]; S.inyectadas.forEach((m, j) => { st['x' + j] = [m]; }); return st; };
  S.fabrica = nombre => {
    if (S.sinConfig) return null;
    S.aperturas++;
    const c = { _sync: [], _est: [], _meta: null, cerrado: false };
    tema(nombre).add(c);
    return {
      alSincronizar(cb) { c._sync.push(cb); },
      estado() { return S.estadoDe(nombre); },
      suscribir(cb) { c._est.push(cb); queueMicrotask(() => { if (c.cerrado) return; cb(S.caido ? 'CHANNEL_ERROR' : 'SUBSCRIBED'); if (!S.caido) notificar(nombre); }); },
      track(p) { if (S.caido) return Promise.reject(new Error('caído')); c._meta = { ...p }; notificar(nombre); return Promise.resolve('ok'); },
      untrack() { c._meta = null; notificar(nombre); return Promise.resolve('ok'); },
      cerrar() { c.cerrado = true; tema(nombre).delete(c); notificar(nombre); },
    };
  };
  S.publicadas = n => [...tema(n)].filter(c => c._meta).map(c => c._meta);
  S.caerTodo = n => { for (const c of [...tema(n)]) c._est.forEach(f => f('CHANNEL_ERROR')); };
  S.notificar = notificar;
  return S;
}
const deps = (R, S, red = { on: true }) => ({ fabrica: S.fabrica, ahora: R.ahora, despues: R.despues, cancelar: R.cancelar, enLinea: () => red.on });
const cfg = (o = {}) => ({ ...CFG, ...o });
const ID = n => `sesion-${n}-abcdef`;

console.log('\nconfiguración');
check(CFG.FUENTE === 'auto' && CFG.CANAL === 'alight-tarima-v1' && CFG.LATIDO_S === 5 && CFG.TIMEOUT_S === 15, 'DBG_VIVO: FUENTE auto (Z93: livekit si hay variables; mock sigue disponible), canal alight-tarima-v1, latido 5 s, timeout 15 s');

console.log('\nvalidación (presencias inválidas se ignoran)');
const P = (o = {}) => ({ sesionId: ID(1), inicioMs: T0, modo: 'privado', latido: 0, ...o });
check(validarPresencia(P(), T0) && validarPresencia({ ...P(), presence_ref: 'abc' }, T0), 'formato correcto (con o sin presence_ref de Supabase)');
for (const [m, x] of [['clave extra (contenido)', { ...P(), nombre: 'Ana' }], ['id corto', P({ sesionId: 'abc' })], ['id con espacios', P({ sesionId: 'hola mundo 1234' })],
  ['modo desconocido', P({ modo: 'publico' })], ['latido texto', P({ latido: '3' })], ['latido decimal', P({ latido: 1.5 })], ['latido negativo', P({ latido: -1 })],
  ['inicioMs en el futuro lejano', P({ inicioMs: T0 + MAX_FUTURO_MS + 1 })], ['inicioMs absurdo', P({ inicioMs: 5 })], ['no objeto', 'hola'], ['arreglo', [1]], ['null', null]])
  check(validarPresencia(x, T0) === null, `rechaza: ${m}`);

console.log('\nregistro y sesión más reciente (puro)');
{ const reg = [], out = { vigentes: 0 };
  const inv = actualizarRegistro(reg, { a: [P({ sesionId: ID(1), inicioMs: T0 - 60000 })], b: [P({ sesionId: ID(2), inicioMs: T0 - 1000 })], c: [{ basura: 1 }], d: 'x' }, T0);
  check(reg.length === 2 && inv === 2, 'dos válidas registradas, dos inválidas ignoradas');
  check(sesionMasReciente(reg, T0, 15, out)?.sesionId === ID(2) && out.vigentes === 2, 'la más reciente = mayor inicioMs entre las vigentes');
  actualizarRegistro(reg, { a: [P({ sesionId: ID(1), inicioMs: T0 - 60000, latido: 1 })], b: [P({ sesionId: ID(2), inicioMs: T0 - 1000, latido: 0 })] }, T0 + 10000);
  check(sesionMasReciente(reg, T0 + 16000, 15, out)?.sesionId === ID(1) && out.vigentes === 1, 'la 2 sin cambio de latido > 15 s (reloj local) deja de contar → queda la 1');
  check(sesionMasReciente(reg, T0 + 15000, 15, out)?.sesionId === ID(2), 'en el borde (15 s justos) todavía cuenta');
  actualizarRegistro(reg, { a: [P({ sesionId: ID(1), inicioMs: T0 - 60000, latido: 1 })] }, T0 + 11000);
  check(reg.length === 1 && reg[0].sesionId === ID(1), 'una sesión que se va del canal se quita del registro');
  check([0, 1, 2, 3, 4, 7].map(n => esperaReintentoMs(n, CFG) / 1000).join() === '1,2,4,8,15,15' && CFG.MAX_REINTENTOS === 8, 'Z95: reintentos 1, 2, 4, 8, 15 s (tope 15 s), máximo 8'); }

console.log('\npublicador y oyente con el canal simulado');
{ const R = crearReloj(), S = crearServidor(), D = deps(R, S);
  const oy = new OyentePresencia(D, cfg());
  const tick = () => oy.tick(true);
  tick(); await R.avanzar(100, 100, tick);
  check(oy.estado === 'idle' && oy.sesionActual === null, 'oyente suscripto sin nadie: idle (= no hay sesión)');
  const pubA = new PublicadorPresencia(D, cfg(), ID('A'));
  check(pubA.publicar({ modo: 'privado' }).ok === false && pubA.publicar({ modo: 'privado', consentimiento: 'true' }).ok === false
    && pubA.publicar({ modo: 'privado', consentimiento: false }).ok === false && pubA.publicar(undefined).ok === false, 'sin consentimiento === true se rechaza (sin excepción)');
  await R.avanzar(500, 100, tick);
  check(S.publicadas('alight-tarima-v1').length === 0 && !pubA.publicando, '…y no se publicó nada');
  check(pubA.publicar({ modo: 'privado', consentimiento: true }).ok, 'con consentimiento: publica');
  await R.avanzar(200, 100, tick);
  check(oy.estado === 'active' && oy.sesionActual === ID('A'), 'el oyente ve la sesión A (activa)');
  const pubs = S.publicadas('alight-tarima-v1');
  check(pubs.length === 1 && Object.keys(pubs[0]).sort().join() === 'inicioMs,latido,modo,sesionId', 'la presencia lleva solo { sesionId, inicioMs, modo, latido }');
  pubA.publicar({ modo: 'cara', consentimiento: true }); await R.avanzar(200, 100, tick);
  check(S.publicadas('alight-tarima-v1').length === 1 && S.publicadas('alight-tarima-v1')[0].modo === 'cara' && S.aperturas === 2, 'un solo publicador: publicar otra vez actualiza el modo, no abre otro canal ni otra presencia');
  await R.avanzar(12000, 100, tick);
  check(pubA.presencia.latido === 2 && oy.estado === 'active', `latido cada ${CFG.LATIDO_S} s (latido ${pubA.presencia.latido} a los ~12 s); A sigue vigente`);
  // B: otro navegador con el reloj ADELANTADO 3 min (la vigencia no compara relojes)
  const RB = { ...D, ahora: () => R.t + 180000 };
  const pubB = new PublicadorPresencia(RB, cfg(), ID('B'));
  pubB.publicar({ modo: 'privado', consentimiento: true }); await R.avanzar(300, 100, tick);
  check(oy.sesionActual === ID('B') && oy.vigentes === 2, 'B (inicio más reciente, reloj adelantado 3 min) pasa a ser la sesión actual; 2 vigentes');
  // B se cuelga sin untrack (pestaña congelada, red del publicador caída): su presencia queda en el canal pero deja de latir
  pubB.estado = 'idle';   // el callback del latido sale si el estado no es "active"
  await R.avanzar(14000, 100, tick);
  check(oy.sesionActual === ID('B'), 'B sin latido 14 s: todavía cuenta (timeout 15 s)');
  await R.avanzar(2000, 100, tick);
  check(oy.sesionActual === ID('A') && oy.vigentes === 1, 'B sin latido > 15 s (reloj local): deja de contar → vuelve A');
  pubA.detener(); await R.avanzar(200, 100, tick);
  check(S.publicadas('alight-tarima-v1').filter(m => m.sesionId === ID('A')).length === 0, 'detener: untrack + cierre (la presencia de A desaparece)');
  await R.avanzar(16000, 100, tick);
  check(oy.estado === 'idle' && oy.sesionActual === null, 'sin presencias vigentes: idle (= no hay sesión → estática, ruido, tiempo detenido)');
  // presencias falsas inyectadas en el canal
  S.inyectadas.push({ sesionId: ID('X'), inicioMs: T0 + 1e9, modo: 'cara', latido: 1 }, { sesionId: ID('Y'), inicioMs: T0, modo: 'cara', latido: 1, texto: 'hola' });
  S.notificar('alight-tarima-v1'); await R.avanzar(200, 100, tick);
  check(oy.sesionActual === null && oy.invalidas >= 2, `presencias inválidas inyectadas (inicio en el futuro, clave extra) se ignoran (inválidas ${oy.invalidas})`);
  S.inyectadas.length = 0;
  pubB.detener();   // (B colgado seguía con el canal abierto; si no, al resuscribirse su presencia vieja contaría de nuevo 15 s)
  // cierre sin uso
  oy.tick(false); await R.avanzar(CFG.CIERRE_SIN_USO_S * 1000 + 200, 100, () => oy.tick(false));
  check(S.temas.get('alight-tarima-v1').size === 0 || [...S.temas.get('alight-tarima-v1')].every(c => c.cerrado), `sin uso ${CFG.CIERRE_SIN_USO_S} s (monolitos fuera): el oyente cierra el canal`);
  const ap = S.aperturas; oy.tick(true); await R.avanzar(200, 100, tick);
  check(S.aperturas === ap + 1 && oy.estado === 'idle', 'vuelve a hacer falta: se suscribe de nuevo');
  oy.cerrar();
  check(oy.estado === 'idle' && [...S.temas.get('alight-tarima-v1')].length === 0, 'cerrar (desmontaje): canal cerrado'); }

console.log('\nerrores y degradado');
{ const R = crearReloj(), S = crearServidor(); S.sinConfig = true;
  const oy = new OyentePresencia(deps(R, S), cfg());
  let tiro = false; try { oy.tick(true); await R.avanzar(5000, 100, () => oy.tick(true)); } catch { tiro = true; }
  check(!tiro && oy.estado === 'error' && oy.sinConfig && oy.sesionActual === null && S.aperturas === 0, 'sin variables de entorno: "error" (= no hay sesión), sin excepciones ni reintentos');
  const pub = new PublicadorPresencia(deps(R, S), cfg(), ID('P'));
  const r = pub.publicar({ modo: 'privado', consentimiento: true });
  check(r.ok && pub.estado === 'error' && !pub.publicando, 'publicador sin variables: "error", no queda publicando'); }
{ const R = crearReloj(), S = crearServidor(), red = { on: false };
  const oy = new OyentePresencia(deps(R, S, red), cfg()), tick = () => oy.tick(true);
  tick(); await R.avanzar(500, 100, tick);
  check(oy.estado === 'error' && S.aperturas === 0 && oy.ultimoError === 'sin conexión', 'sin red: "error" sin intentar abrir el canal');
  red.on = true; await R.avanzar(2100, 100, tick);
  check(oy.estado === 'idle' && S.aperturas === 1, 'vuelve la red: tras la espera (2 s) se suscribe'); }
{ const R = crearReloj(), S = crearServidor(); S.caido = true;
  const oy = new OyentePresencia(deps(R, S), cfg({ REINTENTO_S: 2, REINTENTO_MAX_S: 60 })), tick = () => oy.tick(true);
  tick(); await R.avanzar(100, 100, tick);
  check(oy.estado === 'error' && oy.errores === 1, 'canal caído (proyecto pausado / error): "error"');
  await R.avanzar(1800, 100, tick); const a1 = S.aperturas;
  await R.avanzar(300, 100, tick); const a2 = S.aperturas;
  await R.avanzar(3800, 100, tick); const a3 = S.aperturas;
  await R.avanzar(300, 100, tick); const a4 = S.aperturas;
  check(a1 === 1 && a2 === 2 && a3 === 2 && a4 === 3, `reintentos con espera creciente (aperturas ${a1} → ${a2} a los 2 s → ${a4} a los 6 s)`);
  S.caido = false; await R.avanzar(9000, 100, tick);
  check(oy.estado === 'idle' && oy.errores === 3, 'se recupera cuando el canal vuelve');
  const pub = new PublicadorPresencia(deps(R, S), cfg(), ID('Q'));
  pub.publicar({ modo: 'privado', consentimiento: true }); await R.avanzar(300, 100, tick);
  check(oy.sesionActual === ID('Q'), 'publicador y oyente activos');
  S.caerTodo('alight-tarima-v1'); await R.avanzar(100, 100, tick);
  check(oy.estado === 'error' && oy.sesionActual === null && pub.estado === 'error' && pub.publicando, 'caída del canal en vivo: oyente sin sesión; el publicador sigue intentando');
  await R.avanzar(2500, 100, tick);
  check(oy.sesionActual === ID('Q') && pub.estado === 'active', 'tras el reintento vuelven los dos'); pub.detener(); oy.cerrar(); }

console.log('\nintegración (lectura del código)');
{ const MV = leer('../lib/monolitosVivoAcciones.ts'), TD = leer('../lib/tiempoDetenidoAcciones.ts'), VA = leer('../lib/vivo/vivoAcciones.ts'), CS = leer('../lib/vivo/canalSupabase.ts');
  check(/tickFuenteVivo\(op > 0\.001\);[^\n]*\n\s*M\.haySesion = SESSION\.status === "active";/.test(MV), 'tickMonolitosVivo actualiza la fuente ANTES de calcular haySesion = status "active"');
  check(/soltarFuenteVivo\(\)/.test(MV), 'al soltar los monolitos (desmontaje / N5) se cierra el canal del oyente');
  check(/tickTiempo\(TIEMPO, MONO_VIVO\.sonido, MONO_VIVO\.video, MONO_VIVO\.haySesion/.test(TD), 'tiempo detenido usa MONO_VIVO.haySesion: con "error" o "idle" (falla de red incluida) = sin sesión → se dispara');
  check(/else if \(SESSION instanceof SesionPresencia\)/.test(VA) && /else if \(f === "supabase"\)/.test(VA) && /if \(f === "supabase" \|\| f === "livekit" \|\| f === "mock"\) return f;/.test(VA), 'FUENTE "mock": la sesión solo se toca si era la de Supabase o LiveKit (el mock y "Simular sesión en vivo" quedan como Z82–Z86)');
  check(/NEXT_PUBLIC_SUPABASE_URL/.test(CS) && /NEXT_PUBLIC_SUPABASE_ANON_KEY/.test(CS) && !/SERVICE_ROLE/.test(CS), 'mismas variables que el sitio (URL y clave anónima), sin claves de servicio');
  check(/consentimiento !== true/.test(VA), 'publicarPresencia exige consentimiento: true'); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
