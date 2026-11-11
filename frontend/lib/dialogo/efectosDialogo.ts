// Z29: ÚNICO módulo que ejecuta los efectos que el diálogo dispara con tags ("# efecto: <nombre>").
// Escucha 'alight:dialogo-efecto' { efecto, id } y mapea nombre → acción (ACCIONES). Lo instala el
// componente EfectosDialogo (montado por LuzLejana), que también llama a tickEfectos() en useFrame.
// Flag general: DBG_EFECTOS.EFECTOS_DIALOGO. Estado y premio: lib/dialogo/efectosEstado.ts.
//
// juego_alarma (1.a): fundido de las luces a LUCES_MIN (solo intensidad, sin agregar ni quitar luces),
//   alarm.mp3 en bucle como THREE.PositionalAudio (PannerNode HRTF) en el centro de la tarima, con el
//   AudioListener en la cámara: volumen y paneo según distancia y dirección. El movimiento lo libera
//   LuzLejana con 'alight:dialogo-fin' (fin de 1.a), que además cierra la terminal. Se espera a que el
//   usuario TOQUE la tarima: su planta (TARIMA_W × TARIMA_D centrada en el origen) + TOQUE_MARGEN_M.
//   Mientras tanto la zona de elección TARIMA (ZONA_LUZ, radio 2,5 m) queda bloqueada.
// Al tocarla: alarma fuera, luces con fundido, premio=true en localStorage (1 h), terminal en el knot
//   'premio_otorgado' (irA en ink) → la terminal escribe la línea y emite 'alight:dialogo-fin'; se
//   cierra tras CIERRE_PREMIO_MS. Se emite 'alight:premio-otorgado' (el menú de debug se desbloquea).
// ir_tarima_sin_publico (1.b.a): público apagado (Audience lee EFECTOS_STATE.sinPublico), teleport
//   al centro de la tarima mirando a las sillas: la zona existente ZONA_LUZ dispara 'alight:chose-light'
//   (el flujo de elegir TARIMA, sin duplicarlo); después se piden los atriles ('alight:request-lecterns').
//
// Luces: el multiplicador se aplica en scene.onBeforeRender y se restaura en onAfterRender, así no
// pelea con los sistemas que escriben intensidades en su useFrame (curtain, lecterns, hemi...).
// Sin allocations por frame: lista de luces y buffer de intensidades reutilizados.

import * as THREE from "three";
import { DBG_EFECTOS } from "@/lib/debugConfig";
import { INTERACT_STATE } from "@/lib/alightStore";
import { abrirDialogo, cerrarDialogo, DIALOGO_STATE } from "@/lib/dialogo/dialogoEstado";
import { EFECTOS_STATE, leerPremio, guardarPremio } from "@/lib/dialogo/efectosEstado";
import { TARIMA_W, TARIMA_D, TARIMA_H } from "@/components/Tarima";

export const RUTA_ALARMA = "/alight/audio/alarm.mp3";
const SILLAS_MIRAR = { x: 0, z: -6 };   // = ZONA_SILLAS de ThreeScene (hacia donde mira tras el teleport)

type Accion = () => void;

interface Ctx {
  scene: THREE.Scene;
  camera: THREE.Camera;
  luces: THREE.Light[];
  intens: Float32Array;
  aplicadas: number;           // luces escaladas en el render en curso (0 = nada que restaurar)
  objetivo: number;            // multiplicador objetivo de luces
  buscarT: number;
  listener: THREE.AudioListener | null;
  sonido: THREE.PositionalAudio | null;
  buffer: AudioBuffer | null;
  cargando: boolean;
  timers: ReturnType<typeof setTimeout>[];
  prevBefore: THREE.Scene["onBeforeRender"];
  prevAfter: THREE.Scene["onAfterRender"];
  ultParams: Float64Array;     // últimos parámetros de audio aplicados
}

let C: Ctx | null = null;

// ── luces ──────────────────────────────────────────────────────────────────────
function juntarLuces(c: Ctx): void {
  c.luces.length = 0;
  c.scene.traverse(o => { if ((o as THREE.Light).isLight) c.luces.push(o as THREE.Light); });
  if (c.intens.length < c.luces.length) c.intens = new Float32Array(c.luces.length * 2);
}

// ── audio posicional ───────────────────────────────────────────────────────────
function iniciarAudio(c: Ctx): void {
  if (!c.listener) {
    c.listener = new THREE.AudioListener();
    c.camera.add(c.listener);
  }
  // dentro del gesto (tecla del diálogo o clic de debug): habilita el AudioContext
  void c.listener.context.resume();
  if (!c.sonido) {
    c.sonido = new THREE.PositionalAudio(c.listener);
    c.sonido.name = "alarma-tarima";
    c.scene.add(c.sonido);
  }
  aplicarParamsAudio(c, true);
  const s = c.sonido;
  const tocar = () => {
    if (!EFECTOS_STATE.alarmaActiva || !c.buffer || s.isPlaying) return;
    s.setBuffer(c.buffer);
    s.setLoop(true);
    s.play();
  };
  if (c.buffer) { tocar(); return; }
  if (c.cargando) return;
  c.cargando = true;
  new THREE.AudioLoader().load(RUTA_ALARMA, buf => { c.cargando = false; c.buffer = buf; tocar(); },
    undefined, err => { c.cargando = false; console.warn("[efectosDialogo] no se pudo cargar", RUTA_ALARMA, err); });
}

function aplicarParamsAudio(c: Ctx, forzar = false): void {
  const s = c.sonido;
  if (!s) return;
  // solo si cambió algo (setVolume programa una rampa en el AudioParam: no repetirla cada frame)
  const u = c.ultParams, D = DBG_EFECTOS;
  if (!forzar && u[0] === D.ALARMA_VOLUMEN && u[1] === D.ALARMA_REF_M && u[2] === D.ALARMA_MAX_M &&
      u[3] === D.ALARMA_ROLLOFF && u[4] === D.ALARMA_ALTURA_M) return;
  u[0] = D.ALARMA_VOLUMEN; u[1] = D.ALARMA_REF_M; u[2] = D.ALARMA_MAX_M; u[3] = D.ALARMA_ROLLOFF; u[4] = D.ALARMA_ALTURA_M;
  s.position.set(0, TARIMA_H + DBG_EFECTOS.ALARMA_ALTURA_M, 0);
  s.setDistanceModel("inverse");
  s.setRefDistance(Math.max(0.1, DBG_EFECTOS.ALARMA_REF_M));
  s.setMaxDistance(Math.max(1, DBG_EFECTOS.ALARMA_MAX_M));
  s.setRolloffFactor(Math.max(0, DBG_EFECTOS.ALARMA_ROLLOFF));
  s.setVolume(Math.max(0, DBG_EFECTOS.ALARMA_VOLUMEN));
}

function detenerAudio(c: Ctx): void {
  if (c.sonido?.isPlaying) c.sonido.stop();
}

// ── acciones ───────────────────────────────────────────────────────────────────
function juegoAlarma(): void {
  const c = C;
  if (!c || EFECTOS_STATE.alarmaActiva) return;
  EFECTOS_STATE.alarmaActiva = true;
  EFECTOS_STATE.bloqueaZonaTarima = true;
  c.objetivo = Math.max(0, Math.min(1, DBG_EFECTOS.LUCES_MIN));
  c.buscarT = 99;   // juntar luces ya
  iniciarAudio(c);
  // desde el botón de debug (sin diálogo): liberar el movimiento acá. Con diálogo lo hace LuzLejana.
  if (!DIALOGO_STATE.activo) INTERACT_STATE.movementLocked = INTERACT_STATE.experienceState === "sillas_secuencia";
}

/** Al tocar la tarima (o botón de debug). */
function premiar(): void {
  const c = C;
  if (!c) return;
  EFECTOS_STATE.alarmaActiva = false;
  detenerAudio(c);
  c.objetivo = 1;
  guardarPremio();
  window.dispatchEvent(new CustomEvent("alight:premio-otorgado"));
  // la terminal (Z27) hace irA('premio_otorgado'), escribe la línea y emite 'alight:dialogo-fin'
  const onFin = (e: Event) => {
    const id = (e as CustomEvent<{ id?: string }>).detail?.id ?? "";
    if (id !== "1.a.premio") return;
    window.removeEventListener("alight:dialogo-fin", onFin);
    c.timers.push(setTimeout(() => cerrarDialogo(), Math.max(0, DBG_EFECTOS.CIERRE_PREMIO_MS)));
  };
  window.addEventListener("alight:dialogo-fin", onFin);
  c.timers.push(setTimeout(() => window.removeEventListener("alight:dialogo-fin", onFin), 60_000));
  abrirDialogo("premio_otorgado");
}

function irTarimaSinPublico(): void {
  const c = C;
  if (!c) return;
  EFECTOS_STATE.sinPublico = true;
  // con el diálogo abierto (bajo la luz) LuzLejana fija la mirada hasta el fin: se espera a ese evento
  if (DIALOGO_STATE.activo) {
    const onFin = () => { window.removeEventListener("alight:dialogo-fin", onFin); llevarATarima(c); };
    window.addEventListener("alight:dialogo-fin", onFin);
  } else {
    llevarATarima(c);
  }
}

function llevarATarima(c: Ctx): void {
  // si nunca cruzó el telón, la zona de elección está bloqueada: mismo atajo que el debug del telón
  if (INTERACT_STATE.experienceState === "cortina") window.dispatchEvent(new CustomEvent("alight:debug-skip-curtain"));
  EFECTOS_STATE.bloqueaZonaTarima = false;
  INTERACT_STATE.movementLocked = false;
  c.camera.position.set(0, 1.6, 0);                       // centro de la tarima = ZONA_LUZ
  c.camera.lookAt(SILLAS_MIRAR.x, 1.6, SILLAS_MIRAR.z);
  // la zona ZONA_LUZ dispara 'alight:chose-light' en el próximo frame; si no (ya había elegido camino),
  // se emite acá una sola vez
  let elegido = false;
  const onLight = () => { elegido = true; };
  window.addEventListener("alight:chose-light", onLight);
  c.timers.push(setTimeout(() => {
    window.removeEventListener("alight:chose-light", onLight);
    if (!elegido) window.dispatchEvent(new CustomEvent("alight:chose-light"));
    c.timers.push(setTimeout(() => window.dispatchEvent(new CustomEvent("alight:request-lecterns")),
      Math.max(0, DBG_EFECTOS.ATRILES_DELAY_MS)));
  }, 400));
}

const ACCIONES: Record<string, Accion> = {
  juego_alarma: juegoAlarma,
  premio_otorgado: () => { /* el tag lo emite la terminal al entrar al knot: el juego ya premió */ },
  ir_tarima_sin_publico: irTarimaSinPublico,
};

// ── instalación ────────────────────────────────────────────────────────────────
export function instalarEfectos(scene: THREE.Scene, camera: THREE.Camera): () => void {
  leerPremio();
  const c: Ctx = {
    scene, camera, luces: [], intens: new Float32Array(16), aplicadas: 0, objetivo: 1, buscarT: 99,
    listener: null, sonido: null, buffer: null, cargando: false, timers: [],
    prevBefore: scene.onBeforeRender, prevAfter: scene.onAfterRender, ultParams: new Float64Array(5),
  };
  C = c;

  scene.onBeforeRender = function (renderer, sc, cam, geo, mat, grp) {
    c.prevBefore.call(this, renderer, sc, cam, geo, mat, grp);
    c.aplicadas = 0;
    const m = EFECTOS_STATE.luces;
    if (m >= 0.999) return;
    const n = c.luces.length;
    for (let i = 0; i < n; i++) { c.intens[i] = c.luces[i].intensity; c.luces[i].intensity *= m; }
    c.aplicadas = n;
  };
  scene.onAfterRender = function (renderer, sc, cam, geo, mat, grp) {
    for (let i = 0; i < c.aplicadas; i++) c.luces[i].intensity = c.intens[i];
    c.aplicadas = 0;
    c.prevAfter.call(this, renderer, sc, cam, geo, mat, grp);
  };

  const onEfecto = (e: Event) => {
    if (!DBG_EFECTOS.EFECTOS_DIALOGO) return;
    const ef = (e as CustomEvent<{ efecto?: string }>).detail?.efecto ?? "";
    const a = ACCIONES[ef];
    if (a) a();
    else console.warn("[efectosDialogo] efecto sin acción:", ef);
  };
  const onTocar = () => premiar();   // debug: simula tocar la tarima (también sin alarma)
  const onDetener = () => {                                                         // debug: corta la alarma sin premio
    EFECTOS_STATE.alarmaActiva = false;
    EFECTOS_STATE.bloqueaZonaTarima = false;
    detenerAudio(c);
    c.objetivo = 1;
  };
  window.addEventListener("alight:dialogo-efecto", onEfecto);
  window.addEventListener("alight:debug-tocar-tarima", onTocar);
  window.addEventListener("alight:debug-detener-alarma", onDetener);

  return () => {
    window.removeEventListener("alight:dialogo-efecto", onEfecto);
    window.removeEventListener("alight:debug-tocar-tarima", onTocar);
    window.removeEventListener("alight:debug-detener-alarma", onDetener);
    for (const t of c.timers) clearTimeout(t);
    c.timers.length = 0;
    scene.onBeforeRender = c.prevBefore;
    scene.onAfterRender = c.prevAfter;
    if (c.sonido) {
      detenerAudio(c);
      c.sonido.disconnect();
      scene.remove(c.sonido);
    }
    if (c.listener) camera.remove(c.listener);
    EFECTOS_STATE.alarmaActiva = false;
    EFECTOS_STATE.bloqueaZonaTarima = false;
    EFECTOS_STATE.luces = 1;
    if (C === c) C = null;
  };
}

/** Una vez por frame (EfectosDialogo). Sin allocations. */
export function tickEfectos(dt: number): void {
  const c = C;
  if (!c) return;
  EFECTOS_STATE.alarmaSonando = !!c.sonido?.isPlaying;
  EFECTOS_STATE.audioCtx = c.listener ? c.listener.context.state : "";
  // fundido de luces
  const obj = c.objetivo, cur = EFECTOS_STATE.luces;
  if (cur !== obj) {
    const ms = obj < cur ? DBG_EFECTOS.FUNDIDO_APAGAR_MS : DBG_EFECTOS.FUNDIDO_ENCENDER_MS;
    const paso = ms <= 0 ? 1 : (dt * 1000) / ms;
    EFECTOS_STATE.luces = obj < cur ? Math.max(obj, cur - paso) : Math.min(obj, cur + paso);
  }
  if (EFECTOS_STATE.luces < 0.999) {
    c.buscarT += dt;
    if (c.buscarT > 1) { c.buscarT = 0; juntarLuces(c); }   // luces que aparecen después (atriles: LUZ *)
  }
  if (EFECTOS_STATE.alarmaActiva) {
    aplicarParamsAudio(c);   // volumen y distancias en vivo (setters baratos, sin allocations)
    const p = c.camera.position;
    if (Math.abs(p.x) <= TARIMA_W / 2 + DBG_EFECTOS.TOQUE_MARGEN_M &&
        Math.abs(p.z) <= TARIMA_D / 2 + DBG_EFECTOS.TOQUE_MARGEN_M) premiar();
  } else if (EFECTOS_STATE.bloqueaZonaTarima) {
    // tras el premio: la zona de elección TARIMA se rearma recién al alejarse
    const p = c.camera.position;
    if (Math.hypot(p.x, p.z) > DBG_EFECTOS.ZONA_REARME_M) EFECTOS_STATE.bloqueaZonaTarima = false;
  }
}
