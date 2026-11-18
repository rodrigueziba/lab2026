// Z92: prueba de la transmisión por LiveKit: reglas del token (lib/vivo/tokenLiveKit.ts: validación, permisos por rol,
// TTL, límite por IP), ciclo de vida del publicador con un CLIENTE SIMULADO (lib/vivo/liveKitCiclo.ts: rechazo sin
// consentimiento, publicar, reconexión, falla → sin conexión, cortar libera todo, cortar a mitad de la conexión) e
// integración leyendo el código. Uso: node scripts/livekit-test.mjs
import fs from 'node:fs';
import {
  validarSolicitud, permisosPorRol, ttlPorRol, salaServidor, ipDe, LimitePorIp, SALA_POR_DEFECTO, TTL_PUBLICAR_S, TTL_ESCUCHAR_S, DURACION_MAX_SERVIDOR_S,
} from '../lib/vivo/tokenLiveKit.ts';
import { PublicadorLiveKit } from '../lib/vivo/liveKitCiclo.ts';

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const src = leer('../lib/debugConfig.ts');
const obj = n => Function(`return (${new RegExp(`export const ${n} = (\\{[\\s\\S]*?\\n\\});`).exec(src)[1].replace(/ as string/g, '')});`)();
const L = obj('DBG_LIVEKIT'), C = obj('DBG_CONSENT');
let ok = 0, fallas = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { fallas++; console.log('  ✗ ' + m); } };
const ID = 'sesion-abc12345';
const tick = async (n = 6) => { for (let i = 0; i < n; i++) await Promise.resolve(); };

console.log('\nconfiguración');
check(L.ACTIVO === true && L.SALA === SALA_POR_DEFECTO && L.VIDEO_FPS === 15 && L.VIDEO_KBPS === 500 && L.AUDIO_KBPS === 64, 'DBG_LIVEKIT: activo, sala alight-tarima-v1, 15 fps, 500 kbps video, 64 kbps audio');
check(C.RECORDAR_TRANSMISION === false, 'DBG_CONSENT.RECORDAR_TRANSMISION false: al recargar no se reanuda la transmisión');

console.log('\nsolicitud del token (validación estricta)');
check(validarSolicitud({ rol: 'publicar', sesionId: ID }).ok && validarSolicitud({ rol: 'escuchar', sesionId: ID }).ok, 'válidas: publicar y escuchar con un sesionId correcto');
for (const [m, x] of [['rol desconocido', { rol: 'admin', sesionId: ID }], ['sin sesionId', { rol: 'publicar' }], ['sesionId corto', { rol: 'publicar', sesionId: 'abc' }],
  ['sesionId largo', { rol: 'publicar', sesionId: 'a'.repeat(65) }], ['caracteres raros', { rol: 'publicar', sesionId: 'hola<script>1234' }],
  ['clave extra (sala)', { rol: 'publicar', sesionId: ID, sala: 'otra' }], ['sesionId número', { rol: 'publicar', sesionId: 12345678 }], ['arreglo', ['publicar']], ['null', null], ['texto', 'publicar']])
  check(!validarSolicitud(x).ok, `rechaza: ${m}`);
check(salaServidor(undefined) === SALA_POR_DEFECTO && salaServidor('mala sala!') === SALA_POR_DEFECTO && salaServidor('sala-2') === 'sala-2', 'sala del servidor: la variable si es válida; si no, la fija (el cliente no la elige)');

console.log('\npermisos y TTL');
{ const p = permisosPorRol('publicar', 's'), e = permisosPorRol('escuchar', 's');
  check(p.canPublish && !p.canSubscribe && !p.canPublishData && p.fuentes.join() === 'camera,microphone' && p.room === 's', 'publicar: solo cámara y audio, sin suscribirse ni datos');
  check(!e.canPublish && e.canSubscribe && !e.canPublishData && e.fuentes.length === 0, 'escuchar: solo suscribirse');
  check(ttlPorRol('publicar') === DURACION_MAX_SERVIDOR_S + 60 && TTL_PUBLICAR_S === 360 && ttlPorRol('escuchar') === TTL_ESCUCHAR_S && TTL_ESCUCHAR_S === 600, 'TTL: publicar 300 + 60 s; escuchar 10 min');
  check(DURACION_MAX_SERVIDOR_S === C.DURACION_MAX_S, 'la duración del servidor coincide con DBG_CONSENT.DURACION_MAX_S'); }

console.log('\nlímite por IP');
{ const lim = new LimitePorIp(20, 60000); let n = 0;
  for (let i = 0; i < 25; i++) if (lim.permitir('1.2.3.4', 1000 + i)) n++;
  check(n === 20, '20 pedidos por minuto por IP; el 21 se rechaza');
  check(lim.permitir('5.6.7.8', 2000), 'otra IP no se ve afectada');
  check(lim.permitir('1.2.3.4', 61001), 'pasado el minuto vuelve a permitir');
  for (let i = 0; i < 100; i++) lim.permitir('10.0.0.' + i, 70000);
  lim.permitir('x', 200000);
  check(lim.tamano <= 2, 'purga las ventanas viejas (no crece sin fin)');
  check(ipDe('9.9.9.9, 10.0.0.1', null) === '9.9.9.9' && ipDe(null, '8.8.8.8') === '8.8.8.8' && ipDe(null, null) === 'sin-ip', 'IP: primer x-forwarded-for, x-real-ip o un balde común'); }

// ── cliente simulado ──
function crearMundo(o = {}) {
  const M = { tokens: 0, salas: [], pistas: [], liberadas: 0, conectar: o.conectar ?? (() => Promise.resolve()) };
  M.deps = {
    pedirToken: async () => { M.tokens++; return o.token ?? { ok: true, token: 'jwt', url: 'wss://x' }; },
    crearSala: async () => {
      const s = { conectada: false, desconectada: 0, video: null, audio: null, cbs: [], pausa: false };
      M.salas.push(s);
      return {
        conectar: async () => { await M.conectar(); s.conectada = true; },
        publicarVideo: async (p, cfg) => { s.video = { p, cfg }; },
        publicarAudio: async (p, cfg) => { s.audio = { p, cfg }; },
        alEvento: cb => s.cbs.push(cb),
        pausar: p => { s.pausa = p; },
        kbps: () => 512,
        desconectar: () => { s.desconectada++; s.conectada = false; },
      };
    },
    video: (modo) => { const p = { track: 'v-' + modo, liberar: () => { M.liberadas++; p.lib = true; } }; M.pistas.push(p); return p; },
    audio: () => { const p = { track: 'a', liberar: () => { M.liberadas++; p.lib = true; } }; M.pistas.push(p); return p; },
  };
  return M;
}

console.log('\npublicador (cliente simulado)');
{ const M = crearMundo(), P = new PublicadorLiveKit(M.deps, L);
  for (const x of [{ modo: 'cara', sesionId: ID }, { consentimiento: false, modo: 'cara', sesionId: ID }, { consentimiento: 'true', modo: 'cara', sesionId: ID }, undefined])
    check(!P.iniciar(x).ok, `sin consentimiento === true se rechaza (${JSON.stringify(x)})`);
  check(!P.iniciar({ consentimiento: true, modo: 'cara', sesionId: 'x' }).ok, 'sesionId inválido: rechazado');
  await tick();
  check(M.tokens === 0 && M.salas.length === 0, '…y no se pidió token ni se abrió sala');
  check(P.iniciar({ consentimiento: true, modo: 'cara', sesionId: ID }).ok && P.estado === 'pidiendo', 'con consentimiento: pide el token');
  check(P.iniciar({ consentimiento: true, modo: 'cara', sesionId: ID }).ok, 'un segundo iniciar no abre otra conexión');
  await tick(12);
  const s = M.salas[0];
  check(P.estado === 'publicando' && M.salas.length === 1 && M.tokens === 1 && s.conectada, 'conecta y publica (una sala, un token)');
  check(s.video?.p.track === 'v-cara' && s.audio?.p.track === 'a' && P.pistas.video && P.pistas.audio, 'pistas: video (modo cara = webcam) y audio del núcleo');
  check(s.video.cfg.VIDEO_KBPS === 500 && s.video.cfg.VIDEO_FPS === 15 && s.audio.cfg.AUDIO_KBPS === 64, 'bitrates y fps de DBG_LIVEKIT');
  s.cbs.forEach(f => f('reconectando'));
  check(P.estado === 'reconectando' && P.reconexiones === 1, 'el SDK reconecta: estado "reconectando" (rótulo RECONECTANDO…)');
  s.cbs.forEach(f => f('reconectado'));
  check(P.estado === 'publicando', 'reconectado: vuelve a publicar');
  P.pausar(true); check(s.pausa === true, 'benchmark: pausa la subida sin desconectar'); P.pausar(false);
  P.detener();
  check(P.estado === 'detenido' && s.desconectada === 1 && M.pistas.every(p => p.lib) && P.recursosVivos === 0 && !P.pistas.video && !P.pistas.audio,
    'cortar: desconecta, libera las dos pistas (clon de la webcam y salida del núcleo) y no queda nada vivo');
  s.cbs.forEach(f => f('desconectado'));
  check(P.estado === 'detenido' && P.errores === 0, 'eventos tardíos de una sala cortada se ignoran'); }
{ const M = crearMundo(), P = new PublicadorLiveKit(M.deps, L);
  P.iniciar({ consentimiento: true, modo: 'privado', sesionId: ID }); await tick(12);
  check(M.salas[0].video.p.track === 'v-privado', 'modo privado: video = canvas de ondas');
  M.salas[0].cbs.forEach(f => f('desconectado'));
  check(P.estado === 'sin_conexion' && P.recursosVivos === 0 && M.pistas.every(p => p.lib), 'el SDK se rinde (desconectado): "sin conexión" y libera todo');
  check(P.iniciar({ consentimiento: true, modo: 'privado', sesionId: ID }).ok && P.estado === 'pidiendo', 'se puede volver a intentar con un nuevo consentimiento'); P.detener(); }
for (const [m, motivo] of [['sin variables (503)', 'sin configuración de LiveKit'], ['token rechazado', 'token rechazado (429)'], ['sin red', 'sin red']]) {
  const M = crearMundo({ token: { ok: false, motivo } }), P = new PublicadorLiveKit(M.deps, L);
  P.iniciar({ consentimiento: true, modo: 'cara', sesionId: ID }); await tick(8);
  check(P.estado === 'sin_conexion' && P.ultimoError === motivo && M.salas.length === 0 && M.pistas.length === 0, `${m}: "sin conexión", sin sala ni pistas (no se toca nada local)`);
}
{ let soltar; const M = crearMundo({ conectar: () => new Promise(r => { soltar = r; }) }), P = new PublicadorLiveKit(M.deps, L);
  P.iniciar({ consentimiento: true, modo: 'cara', sesionId: ID }); await tick(8);
  check(P.estado === 'conectando', 'conectando…');
  P.detener(); soltar(); await tick(12);
  check(P.estado === 'detenido' && M.pistas.length === 0 && M.salas[0].desconectada >= 1 && P.recursosVivos === 0, 'cortar a mitad de la conexión: no se publica nada y la sala se cierra'); }
{ const M = crearMundo({ conectar: () => Promise.reject(new Error('x')) }), P = new PublicadorLiveKit(M.deps, L);
  P.iniciar({ consentimiento: true, modo: 'cara', sesionId: ID }); await tick(12);
  check(P.estado === 'sin_conexion' && P.recursosVivos === 0, 'falla al conectar: "sin conexión" sin excepciones'); }

console.log('\nintegración (lectura del código)');
{ const R = leer('../app/api/livekit/token/route.ts'), G = leer('../lib/vivo/publicarLiveKit.ts'), A = leer('../lib/consentTarimaAcciones.ts');
  check(/process\.env\.LIVEKIT_API_SECRET/.test(R) && !/NEXT_PUBLIC_LIVEKIT_API|NEXT_PUBLIC_LIVEKIT_SECRET/.test(R + G) && !/LIVEKIT_API_SECRET|LIVEKIT_API_KEY/.test(G), 'clave y secreto solo en el servidor; el cliente solo recibe la URL');
  check(/error\(503, "no disponible"\)/.test(R) && /error\(429/.test(R) && !/err\.message|String\(e/.test(R), 'sin variables: 503 genérico; errores sin información interna');
  check(/await import\("livekit-client"\)/.test(G) && !/^import .* from "livekit-client"/m.test(G), 'livekit-client se carga con import() dinámico');
  check(/orig\.clone\(\)/.test(G) && /liberarSalidaTransmisible/.test(G), 'webcam clonada (no se apaga la cámara local) y salida del núcleo liberada al cortar');
  check(/addEventListener\("pagehide", _alSalir\)/.test(G), 'pagehide detiene la publicación');
  check(/if \(DBG_LIVEKIT\.ACTIVO\) publicarLiveKit\(\{ consentimiento: true/.test(A) && (A.match(/publicarLiveKit\(/g) || []).length === 1, 'se publica solo desde la elección "compartir" de Z91');
  check((A.match(/detenerLiveKit\(\)/g) || []).length >= 2, 'se detiene en el corte (botón, X, salida) y en el límite de duración');
  check(/r\?\.eleccion === "compartir" && !DBG_CONSENT\.RECORDAR_TRANSMISION\) r = null/.test(A), 'al recargar, una transmisión recordada no se reanuda: vuelve a preguntar'); }

console.log(`\n${ok} OK · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
