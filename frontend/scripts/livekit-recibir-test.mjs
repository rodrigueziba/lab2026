// Z93: prueba de la recepción de la tarima en SILLAS con un livekit-client SIMULADO (lib/vivo/recibirCiclo.ts): no
// conecta antes de aceptar ni sin sesión; conecta con aceptación y sesión; suscribe audio solo con kSonido > 0 y video
// solo con kVideo > 0; des-suscribe tras la espera; señal débil; reintentos con espera creciente y límite; 503 → sin
// servidor sin errores; limpieza completa (sin elementos, nodos ni sala colgados). Más integración leyendo el código.
// Uso: node scripts/livekit-recibir-test.mjs
import fs from 'node:fs';
import { ReceptorLiveKit, MediosRemotos, esperaReintentoS, textoRx, motivoCorto } from '../lib/vivo/recibirCiclo.ts';

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const src = leer('../lib/debugConfig.ts');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string/g, '')});`)();
const R = obj('DBG_LIVEKIT_RECIBIR'), V = obj('DBG_VIVO');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const tick = async (n = 8) => { for (let i = 0; i < n; i++) await Promise.resolve(); };

// ── livekit-client simulado ──
function mundo(o = {}) {
  const W = { tokens: 0, salas: [], token: o.token ?? (() => ({ ok: true, token: 'jwt', url: 'wss://x' })), conectar: o.conectar ?? (() => Promise.resolve()) };
  W.deps = {
    pedirToken: async () => { W.tokens++; return W.token(W.tokens); },
    crearSala: async () => {
      const s = { pistas: { audio: o.pistas?.audio ?? true, video: o.pistas?.video ?? true }, sus: { audio: false, video: false }, llegan: { audio: false, video: false },
        cbs: [], desconectada: 0, conectada: false, llamadas: [] };
      W.salas.push(s);
      return {
        conectar: async (url, token) => { s.url = url; s.token = token; await W.conectar(W.salas.length); s.conectada = true; },
        alEvento: cb => s.cbs.push(cb),
        hayPista: t => s.pistas[t],
        suscribir: (t, si) => { s.sus[t] = si; s.llamadas.push(`${si ? '+' : '-'}${t}`); },
        llega: t => s.sus[t] && s.llegan[t],
        kbps: () => 300,
        desconectar: () => { s.desconectada++; s.conectada = false; },
      };
    },
  };
  return W;
}
const E = (o = {}) => ({ aceptada: true, sesionViva: true, fuenteReal: true, kSonido: 0, kVideo: 0, ahora: 0, pausarRecepcion: false, ...o });
async function correr(rx, desde, hasta, f, paso = 100) { for (let t = desde; t <= hasta; t += paso) { rx.tick(E({ ...f(t), ahora: t })); await tick(2); } }

console.log('\nconfiguración');
check(R.ESPERA_DESUSCRIBIR_S === 2 && R.SENAL_DEBIL_S === 5 && R.CONTORNO_ELEMENTO_AUDIO === true && R.REINTENTO_BASE_S === 1 && R.REINTENTO_MAX_S === 15 && R.MAX_REINTENTOS === 6 && R.DEBIL_MEZCLA === 0.3,
  'DBG_LIVEKIT_RECIBIR: 2 s, 5 s, contorno on, reintentos 1→15 s, 6 intentos, débil 30 %');
check(V.FUENTE === 'auto', 'DBG_VIVO.FUENTE "auto" (real si hay variables; 503 → mock)');

console.log('\nno conecta sin las tres condiciones');
for (const [m, e] of [['sin aceptar', { aceptada: false }], ['sin sesión', { sesionViva: false }], ['fuente mock', { fuenteReal: false }], ['lejos de los monolitos (k = 0)', {}]]) {
  const W = mundo(), rx = new ReceptorLiveKit(W.deps, R);
  await correr(rx, 0, 3000, () => ({ kSonido: m.startsWith('lejos') ? 0 : 1, kVideo: 0, ...e }));
  check(W.tokens === 0 && W.salas.length === 0, `${m}: no pide token ni abre sala (estado ${rx.estado})`);
}
{ const W = mundo(), rx = new ReceptorLiveKit(W.deps, R);
  rx.tick(E({ aceptada: false, kSonido: 1 }));
  check(rx.estado === 'esperando_aceptacion' && textoRx(rx) === 'esperando aceptación', 'sesión viva sin aceptar: "esperando aceptación"'); }

console.log('\nconecta con aceptación y sesión; suscripción manual');
{ const W = mundo(), rx = new ReceptorLiveKit(W.deps, R);
  await correr(rx, 0, 500, () => ({ kSonido: 0.4, kVideo: 0 }));
  const s = W.salas[0];
  check(W.tokens === 1 && W.salas.length === 1 && s.conectada && rx.estado === 'conectado', 'aceptado + sesión + kSonido > 0: un token, una sala, conectado');
  check(s.url === 'wss://x' && s.token === 'jwt', 'conecta con la url y el token que dio el servidor');
  check(s.sus.audio && !s.sus.video && s.llamadas.join() === '+audio', 'suscribe SOLO el audio (kVideo = 0)');
  check(textoRx(rx) === 'conectado sin medios', 'estado: conectado sin medios');
  s.llegan.audio = true; await correr(rx, 600, 700, () => ({ kSonido: 0.4 }));
  check(rx.senal.audio && !rx.senal.video && textoRx(rx) === 'recibiendo audio', 'llegan medios: "recibiendo audio"');
  await correr(rx, 800, 900, () => ({ kSonido: 0.4, kVideo: 0.2 }));
  check(s.sus.video && s.llamadas.join() === '+audio,+video', 'kVideo > 0: suscribe el video');
  s.llegan.video = true; await correr(rx, 1000, 1000, () => ({ kSonido: 0.4, kVideo: 0.2 }));
  check(textoRx(rx) === 'recibiendo ambos', 'recibiendo ambos');
  check(rx.kbps() === 300, 'bitrate recibido (kbps) del SDK');
  // kVideo vuelve a 0: espera corta antes de des-suscribir
  await correr(rx, 1100, 1100 + R.ESPERA_DESUSCRIBIR_S * 1000 - 200, () => ({ kSonido: 0.4, kVideo: 0 }));
  check(s.sus.video, `el video sigue suscrito durante la espera (${R.ESPERA_DESUSCRIBIR_S} s, sin oscilar)`);
  await correr(rx, 1100 + R.ESPERA_DESUSCRIBIR_S * 1000, 1100 + R.ESPERA_DESUSCRIBIR_S * 1000 + 100, () => ({ kSonido: 0.4, kVideo: 0 }));
  check(!s.sus.video && s.sus.audio && s.llamadas.at(-1) === '-video', '…y tras la espera se des-suscribe solo el video');
  // un vaivén corto no des-suscribe
  const n = s.llamadas.length;
  await correr(rx, 4000, 5000, t => ({ kSonido: t % 600 < 300 ? 0.4 : 0, kVideo: 0 }));
  check(s.llamadas.length === n && s.sus.audio, 'pesos que van y vienen en menos de la espera: sin des-suscribir');
  // sin uso (terminaron sostén y retorno): des-suscribe y desconecta tras la espera
  await correr(rx, 5100, 5100 + R.ESPERA_DESUSCRIBIR_S * 1000 + 200, () => ({ kSonido: 0, kVideo: 0 }));
  check(rx.estado === 'desconectado' && s.desconectada === 1 && !rx.abierta, 'pesos en 0 (sostén y retorno terminados) + espera: desconecta');
  await correr(rx, 9000, 9200, () => ({ kSonido: 1 }));
  check(W.salas.length === 2 && W.tokens === 2, 'al volver a acercarse, reconecta (token nuevo)');
  rx.detener(); }

console.log('\nseñal débil y salida del participante');
{ const W = mundo(), rx = new ReceptorLiveKit(W.deps, R);
  await correr(rx, 0, 300, () => ({ kSonido: 1, kVideo: 1 }));
  await correr(rx, 400, 400 + R.SENAL_DEBIL_S * 1000 - 600, () => ({ kSonido: 1, kVideo: 1 }));
  check(!rx.senal.debil, `antes de ${R.SENAL_DEBIL_S} s sin medios: todavía no es débil`);
  await correr(rx, 400 + R.SENAL_DEBIL_S * 1000, 400 + R.SENAL_DEBIL_S * 1000 + 200, () => ({ kSonido: 1, kVideo: 1 }));
  check(rx.senal.debil && textoRx(rx) === 'señal débil', `suscrito ${R.SENAL_DEBIL_S} s sin medios: "señal débil"`);
  W.salas[0].llegan.video = true; await correr(rx, 6000, 6100, () => ({ kSonido: 1, kVideo: 1 }));
  check(!rx.senal.debil && rx.senal.video, 'llega algo: deja de ser débil');
  W.salas[0].pistas.audio = false; W.salas[0].pistas.video = false;   // la tarima se fue
  await correr(rx, 6200, 6300, () => ({ kSonido: 1, kVideo: 1 }));
  check(!rx.senal.audio && !rx.senal.video && !rx.senal.debil && !rx.sus.audio && !rx.sus.video && textoRx(rx) === 'conectado sin medios', 'el participante se va: sin pistas → estática (no débil)');
  await correr(rx, 6400, 6500, () => ({ kSonido: 1, sesionViva: false }));
  check(rx.estado === 'desconectado' && W.salas[0].desconectada === 1, 'la presencia se cae: desconecta'); }

console.log('\nreintentos con espera creciente y límite');
check([1, 2, 3, 4, 5, 6].map(n => esperaReintentoS(n, R)).join() === '1,2,4,8,15,15', 'esperas 1, 2, 4, 8, 15, 15 s (tope REINTENTO_MAX_S)');
{ const W = mundo({ conectar: () => Promise.reject(new Error('could not establish signal connection')) }), rx = new ReceptorLiveKit(W.deps, R);
  const intentos = [];
  for (let t = 0; t <= 120000; t += 100) { const antes = W.salas.length; rx.tick(E({ kSonido: 1, ahora: t })); await tick(3); if (W.salas.length > antes) intentos.push(t); }
  const difs = intentos.slice(1).map((t, i) => (t - intentos[i]) / 1000);
  check(intentos.length === R.MAX_REINTENTOS + 1, `${R.MAX_REINTENTOS} reintentos después del primer intento (${intentos.length} conexiones)`);
  check(difs.every((d, i) => Math.abs(d - esperaReintentoS(i + 1, R)) <= 0.2), `esperas crecientes entre intentos: ${difs.join(', ')} s`);
  check(rx.estado === 'error' && textoRx(rx).startsWith('error: falló la conexión: could not establish'), `al límite: "${textoRx(rx)}"`);
  check(W.salas.every(s => s.desconectada >= 1) && !rx.abierta, 'cada intento fallido suelta su sala');
  await correr(rx, 130000, 130100, () => ({ kSonido: 1, sesionViva: false }));
  check(rx.estado === 'desconectado', 'cuando la sesión termina, el error se olvida (la próxima sesión vuelve a intentar)'); }
{ // caída con sesión viva → reconecta y vuelve a 0 reintentos al conectar
  const W = mundo(), rx = new ReceptorLiveKit(W.deps, R);
  await correr(rx, 0, 300, () => ({ kSonido: 1 }));
  W.salas[0].cbs.forEach(f => f('reconectando'));
  check(rx.estado === 'reconectando' && textoRx(rx) === 'reconectando', 'el SDK reconecta: "reconectando"');
  W.salas[0].cbs.forEach(f => f('reconectado')); check(rx.estado === 'conectado', 'reconectado: vuelve a conectado');
  W.salas[0].cbs.forEach(f => f('desconectado'));
  check(rx.estado === 'esperando_reintento' && rx.intento === 1, 'el SDK se rinde con la sesión viva: reintento propio');
  await correr(rx, 400, 1600, () => ({ kSonido: 1 }));
  check(W.salas.length === 2 && rx.estado === 'conectado' && rx.intento === 0 && rx.reconexiones >= 2, 'reconecta tras REINTENTO_BASE_S y reinicia el contador'); rx.detener(); }

console.log('\n503 y otros errores del token');
{ const W = mundo({ token: () => ({ ok: false, estado: 503, motivo: 'servidor sin claves (503)' }) }), rx = new ReceptorLiveKit(W.deps, R);
  const errores = []; const orig = console.error; console.error = (...a) => errores.push(a);
  await correr(rx, 0, 20000, () => ({ kSonido: 1, kVideo: 1 }));
  console.error = orig;
  check(rx.estado === 'sin_servidor' && textoRx(rx) === 'sin servidor (503)' && W.tokens === 1 && W.salas.length === 0, '503: "sin servidor (503)", un solo pedido, sin sala (no se reintenta)');
  check(errores.length === 0, '…sin errores en la consola');
  check(!rx.senal.audio && !rx.senal.video && !rx.senal.debil, '…medios vacíos: el audio y el domo quedan en estática');
  await correr(rx, 20100, 20200, () => ({ kSonido: 1, sesionViva: false }));
  check(rx.estado === 'desconectado', 'termina la sesión: se olvida el 503'); }
{ const W = mundo({ token: n => (n < 3 ? { ok: false, estado: 0, motivo: 'sin red al pedir el token' } : { ok: true, token: 'jwt', url: 'wss://x' }) }), rx = new ReceptorLiveKit(W.deps, R);
  await correr(rx, 0, 8000, () => ({ kSonido: 1 }));
  check(W.tokens === 3 && rx.estado === 'conectado', 'sin red al pedir el token: reintenta con espera y conecta'); rx.detener(); }

console.log('\nbenchmark (recepcionTarima off)');
{ const W = mundo(), rx = new ReceptorLiveKit(W.deps, R);
  await correr(rx, 0, 300, () => ({ kSonido: 1, kVideo: 1 }));
  await correr(rx, 400, 400 + R.ESPERA_DESUSCRIBIR_S * 1000 + 200, () => ({ kSonido: 1, kVideo: 1, pausarRecepcion: true }));
  check(!W.salas[0].sus.audio && !W.salas[0].sus.video && rx.abierta, 'pausa: des-suscribe audio y video sin desconectar'); rx.detener(); }

console.log('\nlimpieza');
{ const W = mundo(), rx = new ReceptorLiveKit(W.deps, R);
  await correr(rx, 0, 300, () => ({ kSonido: 1, kVideo: 1 }));
  rx.detener();
  check(!rx.abierta && W.salas[0].desconectada === 1 && rx.estado === 'desconectado' && !rx.sus.audio && !rx.sus.video, 'detener: sala desconectada, sin suscripciones');
  W.salas[0].cbs.forEach(f => f('desconectado'));
  check(rx.estado === 'desconectado' && rx.errores === 0, 'eventos tardíos de la sala cortada se ignoran'); }
{ let soltar; const W = mundo({ conectar: () => new Promise(r => { soltar = r; }) }), rx = new ReceptorLiveKit(W.deps, R);
  rx.tick(E({ kSonido: 1, ahora: 0 })); await tick(8);
  rx.detener(); soltar(); await tick(10);
  check(!rx.abierta && W.salas[0].desconectada >= 1, 'desmontar a mitad de la conexión: la sala se cierra al llegar'); }
{ // medios: elementos y nodos con un entorno simulado
  const vivos = new Set(), nodos = new Set();
  const ent = { crear: tag => { const el = { tag, srcObject: null, muted: true, autoplay: true, play: () => Promise.resolve(), remove: () => vivos.delete(el) }; vivos.add(el); return el; }, stream: p => ({ p }) };
  const mkNodo = k => { const n = { k, destinos: [], connect: d => { n.destinos.push(d); nodos.add(n); return d; }, disconnect: () => { n.destinos = []; nodos.delete(n); } }; return n; };
  const ctx = { createGain: () => { const g = mkNodo('gain'); nodos.add(g); return g; }, createMediaStreamSource: s => mkNodo('src:' + s.p) };
  const M = new MediosRemotos(ent);
  const v = M.elementoVideo();
  check(v.tag === 'video' && v.muted && v.autoplay && M.elementoVideo() === v, '<video> oculto estable (muted, autoplay)');
  const salida = M.nodoAudio(ctx);
  M.ponerAudio('pistaA', true);
  check(M.audioEl && M.audioEl.muted && M.audioEl.srcObject?.p === 'pistaA', 'contorno de Chrome: la pista en un <audio> SILENCIADO');
  check([...nodos].some(n => n.k === 'src:pistaA' && n.destinos[0] === salida), 'la pista entra por un MediaStreamAudioSourceNode al nodo que va a la ganancia remota');
  M.ponerAudio('pistaA', false);
  check(!M.audioEl, 'contorno apagado: sin <audio>');
  M.ponerVideo('pistaV');
  check(v.srcObject?.p === 'pistaV', 'la pista de video se asocia al <video> del domo');
  M.ponerVideo(null); check(v.srcObject === null, 'sin video: el <video> queda vacío (el domo muestra estática)');
  M.ponerAudio('pistaA', true);
  M.liberar();
  check(M.vivos === 0 && vivos.size === 0 && nodos.size === 0, 'liberar: sin elementos <video>/<audio> ni nodos de audio colgados'); }
check(motivoCorto(new Error('fallo eyJa.eyJb.c y token=abc')) === 'fallo [token] y token=[token]', 'motivo corto sin el token');

console.log('\nintegración (lectura del código)');
{ const RL = leer('../lib/vivo/recibirLiveKit.ts'), VA = leer('../lib/vivo/vivoAcciones.ts'), MV = leer('../lib/monolitosVivoAcciones.ts'), DV = leer('../lib/domoVivoAcciones.ts'),
    VZ = leer('../lib/vizAudio.ts'), RC = leer('../lib/vivo/recibirCiclo.ts');
  check(/await import\("livekit-client"\)/.test(RL) && !/^import [^\n]* from "livekit-client"/m.test(RL + VA), 'livekit-client solo con import() dinámico (el espectador que no recibe no lo descarga)');
  check(/rol: "escuchar"/.test(RL) && /autoSubscribe: false/.test(RL) && /setSubscribed\(si\)/.test(RL), 'token rol "escuchar", autoSubscribe false, suscripción manual');
  check(/SESSION\.tickMedios\?\.\(M\.aceptada, peso, M\.video\.peso/.test(MV), 'los monolitos pasan aceptación, kSonido y kVideo');
  check(/if \(M\.haySesion && sn && !sn\.audio\)/.test(MV) && /if \(_ent\.haySesion && sn && !sn\.video && _ent\.forzar === "ninguno"\)/.test(DV), 'sin medios reales: estática (audio y domo); el mock no tiene senal → igual que antes');
  check(/Solo el elemento <audio> del visualizador: la fuente remota de Z82 \(sesión o estática\) no pasa por acá/.test(VZ), 'tiempo detenido: solo el <audio> propio (la ganancia remota no se toca)');
  check(/_lk503 = true; setSession\(new MockRemoteSession\(\)\)/.test(VA) && /DBG_VIVO\.FUENTE === "auto"/.test(VA), '"auto" + 503 → mock por el resto de la página');
  check(/class SesionLiveKit extends SesionPresencia/.test(VA) && /dispose\(\): void \{ this\.rx\.liberar\(\); super\.dispose\(\); \}/.test(VA), 'SesionLiveKit libera la recepción al desecharse (soltarMonolitosVivo → setSession(mock))');
  check(!/console\.(error|warn)/.test(RL + RC), 'sin errores en consola en la recepción');
  check(/this\.audioEl\.muted = true/.test(RC), 'nada suena dos veces: el <audio> del contorno está silenciado'); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
