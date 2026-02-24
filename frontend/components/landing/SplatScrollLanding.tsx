'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { SplatMesh, SparkRenderer } from '@sparkjsdev/spark';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN — Editá con el panel debug y pegá el JSON exportado aquí
// ═══════════════════════════════════════════════════════════════════════════════
type V3 = [number, number, number];
type CamWaypoint = { pos: V3; lookAt: V3 };

const CAM_CONFIG: { splatRotation: V3; waypoints: CamWaypoint[] } = {
  "splatRotation": [
    0,
    0,
    3
  ],
  "waypoints": [
    {
      "pos": [
        0.3,
        2.55,
        1
      ],
      "lookAt": [
        -2.603,
        -7.611,
        -9.645
      ]
    },
    {
      "pos": [
        0.95,
        1.5,
        2.2
      ],
      "lookAt": [
        0.1,
        0.4,
        0.65
      ]
    },
    {
      "pos": [
        3.2,
        1.2,
        4.1
      ],
      "lookAt": [
        0.05,
        0,
        0
      ]
    },
    {
      "pos": [
        -3,
        3,
        5
      ],
      "lookAt": [
        0,
        0,
        0
      ]
    },
    {
      "pos": [
        0,
        5,
        3
      ],
      "lookAt": [
        0,
        0,
        0
      ]
    }
  ]
};


const SPLAT_URL = '/splats/4.spz'; // ← URL del splat
// ═══════════════════════════════════════════════════════════════════════════════

const CARDS = [
  { key: 'locaciones', title: 'Locaciones',    subtitle: 'Glaciares, bosques y costa patagónica al alcance de tu producción.' },
  { key: 'talento',    title: 'Talento local', subtitle: 'Técnicos y profesionales audiovisuales conectados con el territorio.' },
  { key: 'proyectos',  title: 'Proyectos',     subtitle: 'Gestión real de producciones en el fin del mundo.' },
  { key: 'incentivos', title: 'Incentivos',    subtitle: 'Beneficios fiscales y logística para producir en Tierra del Fuego.' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function easeInOut(t: number) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }
function v3(a: V3) { return new THREE.Vector3(a[0], a[1], a[2]); }
function fmt(n: number) { return parseFloat(n.toFixed(3)); }

const HERO_TEXT = 'FILMA EN TIERRA DEL FUEGO';
const N_SECTIONS = CARDS.length + 1; // hero + tarjetas

// ─── Types ────────────────────────────────────────────────────────────────────
type LogEntry = { time: string; level: 'info' | 'ok' | 'warn' | 'error'; msg: string };
type RuntimeConfig = typeof CAM_CONFIG;

// ─── Vec3Field ────────────────────────────────────────────────────────────────
function Vec3Field({ label, value, onChange, step = 0.05 }: {
  label: string; value: V3; step?: number; onChange: (v: V3) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">{label}</p>
      <div className="flex gap-1">
        {(['X','Y','Z'] as const).map((ax, i) => (
          <label key={ax} className="flex-1 flex flex-col gap-0.5">
            <span className={`text-[9px] font-bold ${i===0?'text-red-400':i===1?'text-green-400':'text-blue-400'}`}>{ax}</span>
            <input
              type="number" step={step} value={value[i]}
              onChange={e => { const n=[...value] as V3; n[i]=parseFloat(e.target.value)||0; onChange(n); }}
              className="w-full rounded-md bg-white/5 border border-white/10 px-1.5 py-1 text-[11px] text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── DebugPanel ───────────────────────────────────────────────────────────────
function DebugPanel({
  config, onApply, logs,
  camPos, camLook, isFreeRoam, flySpeed,
  onToggleFreeRoam, onSetSpeed,
  activeWaypoint, onSavePos, onSaveLook, onJump,
}: {
  config: RuntimeConfig; onApply: (c: RuntimeConfig) => void;
  logs: LogEntry[];
  camPos: V3; camLook: V3;
  isFreeRoam: boolean; flySpeed: number;
  onToggleFreeRoam: () => void; onSetSpeed: (v: number) => void;
  activeWaypoint: number;
  onSavePos: (i: number) => void; onSaveLook: (i: number) => void; onJump: (i: number) => void;
}) {
  const [local, setLocal]   = useState<RuntimeConfig>(structuredClone(config));
  const [open,  setOpen]    = useState(true);
  const [tab,   setTab]     = useState<'cam'|'splat'|'logs'|'export'>('logs');
  const [copied, setCopied] = useState(false);
  const logsEndRef          = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocal(structuredClone(config)); }, [config]);
  // Auto-scroll logs
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const updateWP = (idx: number, field: 'pos'|'lookAt', val: V3) => {
    const next = structuredClone(local);
    next.waypoints[idx][field] = val;
    setLocal(next); onApply(next);
  };
  const updateRot = (val: V3) => {
    const next = { ...local, splatRotation: val };
    setLocal(next); onApply(next);
  };
  const addWP = () => {
    const next = structuredClone(local);
    next.waypoints.push({ pos: [...camPos] as V3, lookAt: [...camLook] as V3 });
    setLocal(next); onApply(next);
  };
  const removeWP = (idx: number) => {
    if (local.waypoints.length <= 2) return;
    const next = structuredClone(local);
    next.waypoints.splice(idx, 1);
    setLocal(next); onApply(next);
  };

  const exportJson = JSON.stringify({ splatRotation: local.splatRotation, waypoints: local.waypoints }, null, 2);
  const copyJson = () => { navigator.clipboard.writeText(exportJson); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const levelColor = (l: LogEntry['level']) =>
    l === 'ok' ? 'text-emerald-400' : l === 'warn' ? 'text-amber-400' : l === 'error' ? 'text-red-400' : 'text-white/50';

  return (
    <div data-debug-panel className="absolute left-1/2 -translate-x-1/2 top-16 z-50 w-96 pointer-events-auto font-mono select-none">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between rounded-t-2xl bg-[#0a0a18]/97 border border-white/10 px-4 py-2.5 backdrop-blur-2xl text-xs text-white/60 hover:text-white/90 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-indigo-400">⚙</span>
          <span className="font-bold tracking-wide text-white/80">DEBUG</span>
          <span className="rounded-full bg-indigo-600/30 px-1.5 py-0.5 text-[9px] text-indigo-300 border border-indigo-500/30">WP {activeWaypoint}</span>
          {logs.some(l => l.level === 'error') && (
            <span className="rounded-full bg-red-600/30 px-1.5 py-0.5 text-[9px] text-red-300 border border-red-500/30">ERROR</span>
          )}
        </span>
        <span className="text-white/30">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="rounded-b-2xl bg-[#0a0a18]/97 border-x border-b border-white/10 backdrop-blur-2xl divide-y divide-white/5 overflow-hidden">
          {/* Tabs */}
          <div className="flex">
            {(['logs','cam','splat','export'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-widest transition-colors relative ${
                  tab===t ? 'bg-indigo-600/20 text-indigo-300' : 'text-white/30 hover:text-white/60'
                }`}>
                {t}
                {t==='logs' && logs.some(l=>l.level==='error') && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
                )}
              </button>
            ))}
          </div>

          {/* ── LOGS ── */}
          {tab === 'logs' && (
            <div className="p-2 space-y-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-widest text-white/30">Registro de eventos</span>
                <span className="text-[9px] text-white/20">{logs.length} entradas</span>
              </div>
              <div className="rounded-xl bg-black/50 border border-white/8 p-2 h-52 overflow-y-auto space-y-0.5">
                {logs.length === 0 && (
                  <p className="text-[10px] text-white/20 text-center py-4">Sin eventos todavía…</p>
                )}
                {logs.map((l, i) => (
                  <div key={i} className="flex gap-2 text-[10px] leading-relaxed">
                    <span className="text-white/20 shrink-0">{l.time}</span>
                    <span className={`font-semibold shrink-0 ${levelColor(l.level)}`}>
                      {l.level === 'ok' ? '✓' : l.level === 'warn' ? '⚠' : l.level === 'error' ? '✗' : '·'}
                    </span>
                    <span className={levelColor(l.level)}>{l.msg}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
              {/* Live cam mini-readout */}
              <div className="grid grid-cols-2 gap-1.5 text-[10px] pt-1">
                <div className="rounded-lg bg-black/40 border border-white/8 px-2 py-1.5">
                  <span className="text-white/25 block text-[9px] mb-0.5">POS</span>
                  <span className="text-emerald-300 font-semibold">[{camPos.map(n=>n.toFixed(2)).join(', ')}]</span>
                </div>
                <div className="rounded-lg bg-black/40 border border-white/8 px-2 py-1.5">
                  <span className="text-white/25 block text-[9px] mb-0.5">MIRA</span>
                  <span className="text-pink-300 font-semibold">[{camLook.map(n=>n.toFixed(2)).join(', ')}]</span>
                </div>
              </div>
            </div>
          )}

          {/* ── CAM ── */}
          {tab === 'cam' && (
            <div className="p-3 space-y-3">
              <button onClick={onToggleFreeRoam}
                className={`w-full rounded-xl py-2 text-xs font-bold tracking-wide transition-all ${
                  isFreeRoam
                    ? 'bg-indigo-600 text-white ring-1 ring-indigo-500 shadow-lg shadow-indigo-900/40'
                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white border border-white/10'
                }`}>
                {isFreeRoam ? '🎮 VUELO ACTIVO — WASD + Drag' : '🚀 Activar vuelo libre (WASD)'}
              </button>

              {isFreeRoam && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[10px] text-white/40">
                    <span>Velocidad</span>
                    <input type="range" min="0.02" max="3" step="0.02" value={flySpeed}
                      onChange={e => onSetSpeed(parseFloat(e.target.value))}
                      className="flex-1 accent-indigo-500" />
                    <span className="text-white/60 w-10 text-right">{flySpeed.toFixed(2)}</span>
                  </div>
                  <p className="text-[9px] text-white/20 text-center">Q sube · E baja · click+drag rota</p>
                </div>
              )}

              {/* Waypoints */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-widest text-white/30">Waypoints</p>
                  <button onClick={addWP}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 rounded-lg px-2 py-0.5 hover:bg-indigo-600/10 transition-colors">
                    + Añadir
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                  {local.waypoints.map((wp, i) => (
                    <div key={i} className={`rounded-xl p-2.5 space-y-2 border transition-colors ${
                      i === activeWaypoint ? 'border-indigo-500/40 bg-indigo-950/30' : 'border-white/8 bg-white/3'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-white/50">
                          WP {i}{i===0?' — Hero':i===local.waypoints.length-1?' — Final':''}
                          {i===activeWaypoint && <span className="ml-1 text-indigo-400">● activo</span>}
                        </span>
                        <div className="flex gap-1">
                          <button onClick={() => onJump(i)} className="text-[9px] text-white/30 hover:text-white/70 border border-white/10 rounded px-1.5 py-0.5">ir</button>
                          <button onClick={() => onSavePos(i)} className="text-[9px] text-emerald-400/70 hover:text-emerald-300 border border-emerald-800/40 rounded px-1.5 py-0.5">pos</button>
                          <button onClick={() => onSaveLook(i)} className="text-[9px] text-sky-400/70 hover:text-sky-300 border border-sky-800/40 rounded px-1.5 py-0.5">mira</button>
                          {local.waypoints.length > 2 && (
                            <button onClick={() => removeWP(i)} className="text-[9px] text-red-400/50 hover:text-red-400 border border-red-900/30 rounded px-1.5 py-0.5">×</button>
                          )}
                        </div>
                      </div>
                      <Vec3Field label="Posición"   value={wp.pos}    onChange={v => updateWP(i,'pos',v)} />
                      <Vec3Field label="Mira hacia" value={wp.lookAt} onChange={v => updateWP(i,'lookAt',v)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── SPLAT ── */}
          {tab === 'splat' && (
            <div className="p-3 space-y-3">
              <Vec3Field label="Rotación splat (radianes)" value={local.splatRotation} onChange={updateRot} step={0.05} />
              <p className="text-[9px] text-white/20">π ≈ 3.14159 · π/2 ≈ 1.5708</p>
              <div className="rounded-xl bg-black/40 border border-white/8 p-2.5 text-[10px] space-y-0.5 text-white/40">
                <p>URL del splat:</p>
                <p className="text-indigo-300 break-all">{SPLAT_URL}</p>
              </div>
            </div>
          )}

          {/* ── EXPORT ── */}
          {tab === 'export' && (
            <div className="p-3 space-y-2">
              <p className="text-[10px] text-white/30 uppercase tracking-widest">Pegá en CAM_CONFIG</p>
              <pre className="rounded-xl bg-black/50 border border-white/8 p-2.5 text-[9px] text-indigo-200/80 overflow-auto max-h-64 leading-relaxed">{exportJson}</pre>
              <button onClick={copyJson}
                className={`w-full rounded-xl py-2 text-[10px] font-semibold tracking-wide transition-all ${
                  copied ? 'bg-emerald-600/80 text-white ring-1 ring-emerald-500' : 'bg-white/6 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white'
                }`}>
                {copied ? '✓ Copiado!' : 'Copiar JSON'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export type SplatScrollLandingProps = { isAdmin?: boolean };

export default function SplatScrollLanding({ isAdmin = false }: SplatScrollLandingProps) {
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const rendererRef   = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef      = useRef<THREE.Scene | null>(null);
  const cameraRef     = useRef<THREE.PerspectiveCamera | null>(null);
  const splatRef      = useRef<SplatMesh | null>(null);
  // ✅ Usamos mountId para detectar re-mounts y forzar recarga del splat
  const mountIdRef    = useRef(0);

  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollProgressRef = useRef(0);

  const [atEnd, setAtEnd] = useState(false);
  const atEndRef          = useRef(false);

  // Debug
  const [debugOpen,  setDebugOpen]  = useState(false);
  const [isFreeRoam, setIsFreeRoam] = useState(false);
  const [flySpeed,   setFlySpeed]   = useState(0.3);
  const [liveCamPos, setLiveCamPos] = useState<V3>([0,0,0]);
  const [liveLookAt, setLiveLookAt] = useState<V3>([0,0,0]);
  const [activeWP,   setActiveWP]   = useState(0);
  const [logs,       setLogs]       = useState<LogEntry[]>([]);

  // Runtime config
  const [rtConfig, setRtConfig] = useState<RuntimeConfig>(() => structuredClone(CAM_CONFIG));
  const rtConfigRef   = useRef(rtConfig);
  const freeRoamRef   = useRef(false);
  const flySpeedRef   = useRef(0.3);
  const isDraggingRef = useRef(false);
  const lastMouseRef  = useRef({ x: 0, y: 0 });
  const lookAngles    = useRef({ yaw: 0, pitch: 0 });
  const keys          = useRef<Record<string,boolean>>({ w:false,a:false,s:false,d:false,q:false,e:false });

  useEffect(() => { freeRoamRef.current = isFreeRoam; }, [isFreeRoam]);
  useEffect(() => { flySpeedRef.current = flySpeed; },   [flySpeed]);
  useEffect(() => { rtConfigRef.current = rtConfig; },   [rtConfig]);
  useEffect(() => { atEndRef.current = atEnd; },         [atEnd]);

  // Logger
  const log = useCallback((msg: string, level: LogEntry['level'] = 'info') => {
    const time = new Date().toLocaleTimeString('es', { hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`[SplatLanding] ${msg}`);
    setLogs(prev => [...prev.slice(-99), { time, level, msg }]);
  }, []);

  // ── 1) Init Three.js ──────────────────────────────────────────────────────────
  useEffect(() => {
    const wrap = canvasWrapRef.current;
    if (!wrap) return;

    // ✅ Si ya hay renderer (Strict Mode re-mount), lo destruimos y rehacemos
    if (rendererRef.current) {
      log('Re-mount detectado — reinicializando renderer', 'warn');
      rendererRef.current.setAnimationLoop(null);
      rendererRef.current.dispose();
      rendererRef.current = null;
      sceneRef.current    = null;
      cameraRef.current   = null;
      splatRef.current    = null;
    }

    mountIdRef.current++;
    const thisMountId = mountIdRef.current;
    log(`Inicializando Three.js (mount #${thisMountId})`);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#06060f');
    sceneRef.current = scene;
    log('Scene creada');

    const camera = new THREE.PerspectiveCamera(55, wrap.clientWidth / wrap.clientHeight, 0.01, 10000);
    const wp0 = CAM_CONFIG.waypoints[0];
    camera.position.copy(v3(wp0.pos));
    camera.lookAt(v3(wp0.lookAt));
    cameraRef.current = camera;
    log(`Cámara en [${wp0.pos.join(', ')}]`);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(wrap.clientWidth, wrap.clientHeight);
    renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
    wrap.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    log('WebGLRenderer creado');

    // ✅ SparkRenderer — imprescindible para ver splats
    try {
      const spark = new SparkRenderer({ renderer });
      scene.add(spark);
      log('SparkRenderer inicializado', 'ok');
    } catch (e) {
      log(`SparkRenderer ERROR: ${e}`, 'error');
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const dl = new THREE.DirectionalLight(0xffffff, 0.7);
    dl.position.set(2, 5, 3);
    scene.add(dl);

    const onResize = () => {
      renderer.setSize(wrap.clientWidth, wrap.clientHeight);
      camera.aspect = wrap.clientWidth / wrap.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    // ── Animation loop ────────────────────────────────────────────────────────
    let frame = 0;
    renderer.setAnimationLoop(() => {
      frame++;
      const cfg  = rtConfigRef.current;
      const wps  = cfg.waypoints;

      if (freeRoamRef.current || atEndRef.current) {
        const spd = flySpeedRef.current;
        const fwd = new THREE.Vector3();
        camera.getWorldDirection(fwd);
        const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
        if (keys.current['w']) camera.position.addScaledVector(fwd,   spd);
        if (keys.current['s']) camera.position.addScaledVector(fwd,  -spd);
        if (keys.current['a']) camera.position.addScaledVector(right, -spd);
        if (keys.current['d']) camera.position.addScaledVector(right,  spd);
        if (keys.current['q']) camera.position.y += spd;
        if (keys.current['e']) camera.position.y -= spd;
        camera.quaternion.setFromEuler(new THREE.Euler(lookAngles.current.pitch, lookAngles.current.yaw, 0, 'YXZ'));
      } else {
        const prog  = scrollProgressRef.current;
        const total = wps.length - 1;
        const fIdx  = clamp01(prog) * total;
        const i0    = Math.max(0, Math.min(total - 1, Math.floor(fIdx)));
        const i1    = Math.min(total, i0 + 1);
        const t     = easeInOut(fIdx - i0);
        const wp0   = wps[i0];
        const wp1   = wps[i1];

        const tPos  = new THREE.Vector3(lerp(wp0.pos[0],wp1.pos[0],t), lerp(wp0.pos[1],wp1.pos[1],t), lerp(wp0.pos[2],wp1.pos[2],t));
        const tLook = new THREE.Vector3(lerp(wp0.lookAt[0],wp1.lookAt[0],t), lerp(wp0.lookAt[1],wp1.lookAt[1],t), lerp(wp0.lookAt[2],wp1.lookAt[2],t));

        camera.position.lerp(tPos, 0.07);
        camera.lookAt(tLook);

        // Sync look angles para transición suave a free roam
        const fd = new THREE.Vector3();
        camera.getWorldDirection(fd);
        lookAngles.current.yaw   = Math.atan2(fd.x, fd.z);
        lookAngles.current.pitch = Math.asin(clamp01(-fd.y));

        if (frame % 20 === 0) setActiveWP(Math.round(clamp01(prog) * total));
      }

      if (frame % 4 === 0) {
        const p = camera.position;
        setLiveCamPos([fmt(p.x), fmt(p.y), fmt(p.z)]);
        const fd = new THREE.Vector3();
        camera.getWorldDirection(fd);
        const lp = p.clone().addScaledVector(fd, 15);
        setLiveLookAt([fmt(lp.x), fmt(lp.y), fmt(lp.z)]);
      }

      renderer.render(scene, camera);
    });
    log('Animation loop iniciado', 'ok');

    // ── Cargar splat ──────────────────────────────────────────────────────────
    log(`Cargando splat: ${SPLAT_URL}`);
    try {
      const splat = new SplatMesh({
        url: SPLAT_URL,
        onLoad: () => {
          if (mountIdRef.current !== thisMountId) return; // mount viejo, ignorar
          log('Splat cargado y visible', 'ok');
        },
      });
      splat.rotation.copy(new THREE.Euler(...CAM_CONFIG.splatRotation));
      scene.add(splat);
      splatRef.current = splat;
      log('SplatMesh agregado a la scene');
    } catch (e) {
      log(`Error creando SplatMesh: ${e}`, 'error');
    }

    return () => {
      log(`Desmontando mount #${thisMountId}`, 'warn');
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', onResize);
      if (splatRef.current) {
        scene.remove(splatRef.current);
        splatRef.current.dispose?.();
        splatRef.current = null;
      }
      // Remover canvas del DOM antes de dispose
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
      rendererRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Aplicar rotación del splat en tiempo real ─────────────────────────────────
  useEffect(() => {
    if (!splatRef.current) return;
    splatRef.current.rotation.copy(new THREE.Euler(...rtConfig.splatRotation));
  }, [rtConfig.splatRotation]);

  // ── Scroll ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => {
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      const prog  = maxY > 0 ? clamp01(window.scrollY / maxY) : 0;
      scrollProgressRef.current = prog;
      setScrollProgress(prog);

      const end = prog >= 0.97;
      if (end !== atEndRef.current) {
        setAtEnd(end);
        if (end && cameraRef.current) {
          const fd = new THREE.Vector3();
          cameraRef.current.getWorldDirection(fd);
          lookAngles.current.yaw   = Math.atan2(fd.x, fd.z);
          lookAngles.current.pitch = Math.asin(clamp01(-fd.y));
          log('Llegaste al final — free roam activado', 'ok');
        }
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [log]);

  // ── Mouse & Keyboard ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canDrag = () => freeRoamRef.current || atEndRef.current;
    const onDown  = (e: PointerEvent) => {
      if (!canDrag()) return;
      if ((e.target as HTMLElement)?.closest('[data-debug-panel]')) return;
      isDraggingRef.current = true;
      lastMouseRef.current  = { x: e.clientX, y: e.clientY };
    };
    const onUp   = () => { isDraggingRef.current = false; };
    const onMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      lookAngles.current.yaw   -= dx * 0.003;
      lookAngles.current.pitch  = Math.max(-1.35, Math.min(1.35, lookAngles.current.pitch - dy * 0.003));
    };
    const onKeyDown = (e: KeyboardEvent) => { const k=e.key.toLowerCase(); if(k in keys.current) keys.current[k]=true; };
    const onKeyUp   = (e: KeyboardEvent) => { const k=e.key.toLowerCase(); if(k in keys.current) keys.current[k]=false; };

    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup',   onUp);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('keydown',     onKeyDown);
    window.addEventListener('keyup',       onKeyUp);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup',   onUp);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('keydown',     onKeyDown);
      window.removeEventListener('keyup',       onKeyUp);
    };
  }, []);

  // ── Debug: guardar pos/look ───────────────────────────────────────────────────
  const savePos = useCallback((idx: number) => {
    const cam = cameraRef.current; if (!cam) return;
    const val: V3 = [fmt(cam.position.x), fmt(cam.position.y), fmt(cam.position.z)];
    log(`WP${idx} pos guardada: [${val.join(', ')}]`, 'ok');
    setRtConfig(prev => { const n=structuredClone(prev); if(n.waypoints[idx]) n.waypoints[idx].pos=val; return n; });
  }, [log]);

  const saveLook = useCallback((idx: number) => {
    const cam = cameraRef.current; if (!cam) return;
    const fd = new THREE.Vector3(); cam.getWorldDirection(fd);
    const t  = cam.position.clone().addScaledVector(fd, 15);
    const val: V3 = [fmt(t.x), fmt(t.y), fmt(t.z)];
    log(`WP${idx} lookAt guardado: [${val.join(', ')}]`, 'ok');
    setRtConfig(prev => { const n=structuredClone(prev); if(n.waypoints[idx]) n.waypoints[idx].lookAt=val; return n; });
  }, [log]);

  const jumpToWP = useCallback((idx: number) => {
    const cam = cameraRef.current; if (!cam) return;
    const wp  = rtConfigRef.current.waypoints[idx]; if (!wp) return;
    cam.position.copy(v3(wp.pos));
    cam.lookAt(v3(wp.lookAt));
    const fd = new THREE.Vector3(); cam.getWorldDirection(fd);
    lookAngles.current.yaw   = Math.atan2(fd.x, fd.z);
    lookAngles.current.pitch = Math.asin(-clamp01(fd.y));
    log(`Salté a WP${idx}`);
  }, [log]);

  // ── Hero parallax ─────────────────────────────────────────────────────────────
  const heroLetters = useMemo(() => HERO_TEXT.split(''), []);
  const [heroMouse, setHeroMouse] = useState({ nx:0.5, ny:0.5, hover:false });
  const onHeroMove: React.MouseEventHandler<HTMLDivElement> = e => {
    const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    setHeroMouse(s => ({ ...s, nx:(e.clientX-r.left)/r.width, ny:(e.clientY-r.top)/r.height }));
  };

  const cardSlot     = 1 / N_SECTIONS;
  const isHeroVisible = scrollProgress < cardSlot;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    // ✅ FIX: altura SOLO en el wrapper exterior — sin div aria-hidden duplicado
    <div className="relative text-white" style={{ height: `${N_SECTIONS * 100}svh` }}>

      {/* Canvas fijo — ocupa el viewport completo, no genera scroll */}
      <div
        ref={canvasWrapRef}
        className={`fixed inset-0 h-[100svh] w-full ${(atEnd || isFreeRoam) ? 'cursor-crosshair' : 'cursor-default'}`}
      >
        {/* Viñeta */}
        <div className="pointer-events-none absolute inset-0 z-10
          bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_60%,rgba(0,0,0,0.82)_100%)]" />

        {/* ── Botón debug — centrado horizontal, debajo de la navbar ── */}
        {isAdmin && (
          <button
            onClick={() => setDebugOpen(o => !o)}
            className={`absolute top-16 left-1/2 -translate-x-1/2 z-50 rounded-xl px-4 py-1.5 text-xs font-semibold border backdrop-blur transition-all duration-200 flex items-center gap-2 ${
              debugOpen
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/40'
                : 'bg-black/60 border-white/10 text-white/40 hover:text-white hover:border-white/20 hover:bg-black/70'
            }`}
          >
            <span>⚙</span>
            <span>Debug</span>
            {logs.some(l => l.level === 'error') && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            )}
          </button>
        )}

        {/* Panel debug */}
        {isAdmin && debugOpen && (
          <DebugPanel
            config={rtConfig} onApply={setRtConfig}
            logs={logs}
            camPos={liveCamPos} camLook={liveLookAt}
            isFreeRoam={isFreeRoam} flySpeed={flySpeed}
            onToggleFreeRoam={() => setIsFreeRoam(o => !o)} onSetSpeed={setFlySpeed}
            activeWaypoint={activeWP}
            onSavePos={savePos} onSaveLook={saveLook} onJump={jumpToWP}
          />
        )}

        {/* Hero */}
        <div className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6 transition-opacity duration-700 ${isHeroVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div
            className={isHeroVisible ? 'pointer-events-auto' : ''}
            onMouseEnter={() => setHeroMouse(s => ({ ...s, hover:true }))}
            onMouseLeave={() => setHeroMouse({ nx:0.5, ny:0.5, hover:false })}
            onMouseMove={onHeroMove}
          >
            <h1 className="select-none text-center text-5xl font-black tracking-tight drop-shadow-xl md:text-7xl">
              {heroLetters.map((ch, i) => {
                const dx=(heroMouse.nx-0.5)*18, dy=(heroMouse.ny-0.5)*10;
                const w=((i-heroLetters.length/2)/heroLetters.length)*2;
                const s=heroMouse.hover?1:0;
                return (
                  <span key={`${ch}-${i}`} className="inline-block transition-transform duration-75"
                    style={{ transform:`translate3d(${dx*w*s}px,${dy*(1-Math.abs(w))*s}px,0)` }}>
                    {ch===' '?'\u00A0':ch}
                  </span>
                );
              })}
            </h1>
            <p className="mt-4 text-center text-sm text-white/50 tracking-widest uppercase">
              Patagonia · Ushuaia · Tierra del Fuego
            </p>
            <div className="mt-12 flex flex-col items-center gap-2 animate-bounce">
              <span className="text-xs text-white/30 uppercase tracking-widest">Scroll</span>
              <svg width="14" height="22" viewBox="0 0 14 22" className="text-white/30" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M7 3 L7 19 M3 15 L7 19 L11 15"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Tarjetas */}
        {CARDS.map((card, i) => {
          const slotStart = (i + 1) * cardSlot;
          const slotEnd   = (i + 2) * cardSlot;
          const inSlot    = scrollProgress >= slotStart && scrollProgress < slotEnd;
          return (
            <div key={card.key}
              className="pointer-events-none absolute inset-0 z-20 flex items-center px-8 md:px-16"
              style={{ opacity: inSlot?1:0, transform: inSlot?'translateY(0)':'translateY(20px)', transition:'opacity 0.6s ease, transform 0.6s ease' }}
            >
              <div className="max-w-sm rounded-3xl border border-white/10 bg-black/40 p-8 shadow-2xl backdrop-blur-md pointer-events-auto">
                <div className="text-[10px] uppercase tracking-widest text-white/35 mb-2">0{i+1} — {card.key}</div>
                <div className="text-3xl font-semibold leading-tight">{card.title}</div>
                <div className="mt-3 text-white/65 leading-relaxed text-sm">{card.subtitle}</div>
              </div>
            </div>
          );
        })}

        {/* Free roam hint */}
        <div className={`pointer-events-none absolute bottom-6 inset-x-0 z-20 flex justify-center transition-opacity duration-700 ${atEnd ? 'opacity-100' : 'opacity-0'}`}>
          <div className="rounded-full bg-black/50 border border-white/10 backdrop-blur px-4 py-2 text-xs text-white/50 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Arrastrá para explorar · WASD para moverte
          </div>
        </div>
      </div>
    </div>
  );
}