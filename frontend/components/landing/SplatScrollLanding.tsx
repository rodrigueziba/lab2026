'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { SplatMesh, SparkRenderer } from '@sparkjsdev/spark';
import Link from 'next/link';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════════
type V3 = [number, number, number];

type CamWaypoint = {
  pos: V3;
  lookAt: V3;
  splatPos: V3;
};

const CAM_CONFIG: {
  splatRotation: V3;
  waypoints: CamWaypoint[];
} = {
  "splatRotation": [
    -0.2,
    2.65,
    -3.05
  ],
  "waypoints": [
    {
      "pos": [
        -0.65,
        0.15,
        0.9
      ],
      "lookAt": [
        -0.05,
        -0.25,
        -0.15
      ],
      "splatPos": [
        0.95,
        0,
        1.6
      ]
    },
    {
      "pos": [
        0,
        0.35,
        0.65
      ],
      "lookAt": [
        0.25,
        0.05,
        0
      ],
      "splatPos": [
        -0.2,
        0.2,
        0.25
      ]
    },
    {
      "pos": [
        3,
        0.95,
        1.2
      ],
      "lookAt": [
        5.7,
        -0.45,
        -4.65
      ],
      "splatPos": [
        3.55,
        0.45,
        0
      ]
    },
    {
      "pos": [
        -3.3,
        1.2,
        5
      ],
      "lookAt": [
        0,
        -0.6,
        0.05
      ],
      "splatPos": [
        -1.85,
        -0.65,
        2.6
      ]
    }
  ]
};

const SPLAT_URL = '/splats/10.spz';

// Más bajo = más suave / más lento
const SCROLL_RESPONSE = 3.2;
const CAMERA_RESPONSE = 2.8;
const SPLAT_RESPONSE = 2.4;

// ═══════════════════════════════════════════════════════════════════════════════

const CARDS = [
  {
    key: 'locaciones',
    title: 'Locaciones',
    subtitle: 'Glaciares, bosques y costa patagónica al alcance de tu producción.',
    href: '/locaciones',
  },
  {
    key: 'guia',
    title: 'Guía de Prestadores',
    subtitle: 'Todo lo que necesitás para filmar en el fin del mundo.',
    href: '/guia',
  },
  {
    key: 'proyectos',
    title: 'Proyectos',
    subtitle: 'Gestión y busqueda de producciones audiovisuales en Tierra del Fuego.',
    href: '/proyectos',
  },
];

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
function v3(a: V3) {
  return new THREE.Vector3(a[0], a[1], a[2]);
}
function fmt(n: number) {
  return parseFloat(n.toFixed(3));
}
function expAlpha(response: number, dt: number) {
  return 1 - Math.exp(-response * dt);
}

// IMPORTANTE:
// usar una cámara real para calcular el quaternion.
// Con Object3D puede quedar invertido para cámara.
function quatFromPosLookAt(pos: V3, lookAt: V3) {
  const cam = new THREE.PerspectiveCamera();
  cam.position.copy(v3(pos));
  cam.lookAt(v3(lookAt));
  return cam.quaternion.clone();
}

const HERO_TEXT = 'FILMA EN TIERRA DEL FUEGO';
const N_SECTIONS = CARDS.length + 1;

type LogEntry = { time: string; level: 'info' | 'ok' | 'warn' | 'error'; msg: string };
type RuntimeConfig = typeof CAM_CONFIG;

// ─── Vec3Field ────────────────────────────────────────────────────────────────
function Vec3Field({
  label,
  value,
  onChange,
  step = 0.05,
}: {
  label: string;
  value: V3;
  step?: number;
  onChange: (v: V3) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">{label}</p>
      <div className="flex gap-1">
        {(['X', 'Y', 'Z'] as const).map((ax, i) => (
          <label key={ax} className="flex-1 flex flex-col gap-0.5">
            <span
              className={`text-[9px] font-bold ${
                i === 0 ? 'text-red-400' : i === 1 ? 'text-green-400' : 'text-blue-400'
              }`}
            >
              {ax}
            </span>
            <input
              type="number"
              step={step}
              value={value[i]}
              onChange={e => {
                const n = [...value] as V3;
                n[i] = parseFloat(e.target.value) || 0;
                onChange(n);
              }}
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
  config,
  onApply,
  logs,
  camPos,
  camLook,
  isFreeRoam,
  flySpeed,
  onToggleFreeRoam,
  onSetSpeed,
  activeWaypoint,
  onSavePos,
  onSaveLook,
  onSaveSplatPos,
  onJump,
}: {
  config: RuntimeConfig;
  onApply: (c: RuntimeConfig) => void;
  logs: LogEntry[];
  camPos: V3;
  camLook: V3;
  isFreeRoam: boolean;
  flySpeed: number;
  onToggleFreeRoam: () => void;
  onSetSpeed: (v: number) => void;
  activeWaypoint: number;
  onSavePos: (i: number) => void;
  onSaveLook: (i: number) => void;
  onSaveSplatPos: (i: number) => void;
  onJump: (i: number) => void;
}) {
  const [local, setLocal] = useState<RuntimeConfig>(structuredClone(config));
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<'logs' | 'cam' | 'splat' | 'export'>('logs');
  const [copied, setCopied] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocal(structuredClone(config));
  }, [config]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const updWP = (idx: number, field: keyof CamWaypoint, val: V3) => {
    const next = structuredClone(local);
    (next.waypoints[idx] as Record<string, V3>)[field] = val;
    setLocal(next);
    onApply(next);
  };

  const updRot = (val: V3) => {
    const n = { ...local, splatRotation: val };
    setLocal(n);
    onApply(n);
  };

  const addWP = () => {
    const next = structuredClone(local);
    next.waypoints.push({
      pos: [...camPos] as V3,
      lookAt: [...camLook] as V3,
      splatPos: [0, 0, 0],
    });
    setLocal(next);
    onApply(next);
  };

  const rmWP = (idx: number) => {
    if (local.waypoints.length <= 2) return;
    const next = structuredClone(local);
    next.waypoints.splice(idx, 1);
    setLocal(next);
    onApply(next);
  };

  const exportJson = JSON.stringify(
    {
      splatRotation: local.splatRotation,
      waypoints: local.waypoints,
    },
    null,
    2
  );

  const copyJson = () => {
    navigator.clipboard.writeText(exportJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lvlColor = (l: LogEntry['level']) =>
    l === 'ok'
      ? 'text-emerald-400'
      : l === 'warn'
      ? 'text-amber-400'
      : l === 'error'
      ? 'text-red-400'
      : 'text-white/45';

  return (
    <div
      data-debug-panel
      className="absolute left-1/2 -translate-x-1/2 top-32 z-50 w-[22rem] max-w-[calc(100vw-2rem)] pointer-events-auto font-mono select-none"
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between rounded-t-2xl bg-[#0a0a18]/97 border border-white/10 px-4 py-2.5 backdrop-blur-2xl text-xs text-white/60 hover:text-white/90 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-indigo-400">⚙</span>
          <span className="font-bold tracking-wide text-white/80">DEBUG</span>
          <span className="rounded-full bg-indigo-600/30 px-1.5 py-0.5 text-[9px] text-indigo-300 border border-indigo-500/30">
            WP {activeWaypoint}
          </span>
          {logs.some(l => l.level === 'error') && (
            <span className="rounded-full bg-red-600/30 px-1.5 py-0.5 text-[9px] text-red-300 border border-red-500/30">
              ERROR
            </span>
          )}
        </span>
        <span className="text-white/30">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="rounded-b-2xl bg-[#0a0a18]/97 border-x border-b border-white/10 backdrop-blur-2xl divide-y divide-white/5 overflow-hidden">
          <div className="flex">
            {(['logs', 'cam', 'splat', 'export'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-widest transition-colors relative ${
                  tab === t ? 'bg-indigo-600/20 text-indigo-300' : 'text-white/30 hover:text-white/60'
                }`}
              >
                {t}
                {t === 'logs' && logs.some(l => l.level === 'error') && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
                )}
              </button>
            ))}
          </div>

          {tab === 'logs' && (
            <div className="p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-white/30">Eventos</span>
                <span className="text-[9px] text-white/20">{logs.length}</span>
              </div>

              <div className="rounded-xl bg-black/50 border border-white/8 p-2 h-48 overflow-y-auto space-y-0.5">
                {logs.length === 0 && (
                  <p className="text-[10px] text-white/20 text-center py-6">Sin eventos…</p>
                )}
                {logs.map((l, i) => (
                  <div key={i} className="flex gap-2 text-[10px] leading-relaxed">
                    <span className="text-white/20 shrink-0">{l.time}</span>
                    <span className={`font-semibold shrink-0 ${lvlColor(l.level)}`}>
                      {l.level === 'ok' ? '✓' : l.level === 'warn' ? '⚠' : l.level === 'error' ? '✗' : '·'}
                    </span>
                    <span className={lvlColor(l.level)}>{l.msg}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <div className="rounded-lg bg-black/40 border border-white/8 px-2 py-1.5">
                  <span className="text-white/25 block text-[9px] mb-0.5">POS CAM</span>
                  <span className="text-emerald-300 font-semibold">
                    [{camPos.map(n => n.toFixed(2)).join(', ')}]
                  </span>
                </div>
                <div className="rounded-lg bg-black/40 border border-white/8 px-2 py-1.5">
                  <span className="text-white/25 block text-[9px] mb-0.5">MIRA A</span>
                  <span className="text-pink-300 font-semibold">
                    [{camLook.map(n => n.toFixed(2)).join(', ')}]
                  </span>
                </div>
              </div>
            </div>
          )}

          {tab === 'cam' && (
            <div className="p-3 space-y-3">
              <button
                onClick={onToggleFreeRoam}
                className={`w-full rounded-xl py-2 text-xs font-bold tracking-wide transition-all ${
                  isFreeRoam
                    ? 'bg-indigo-600 text-white ring-1 ring-indigo-500 shadow-lg shadow-indigo-900/40'
                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white border border-white/10'
                }`}
              >
                {isFreeRoam ? '🎮 VUELO ACTIVO — WASD + Drag' : '🚀 Activar vuelo libre (WASD)'}
              </button>

              {isFreeRoam && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[10px] text-white/40">
                    <span>Velocidad</span>
                    <input
                      type="range"
                      min="0.02"
                      max="3"
                      step="0.02"
                      value={flySpeed}
                      onChange={e => onSetSpeed(parseFloat(e.target.value))}
                      className="flex-1 accent-indigo-500"
                    />
                    <span className="text-white/60 w-10 text-right">{flySpeed.toFixed(2)}</span>
                  </div>
                  <p className="text-[9px] text-white/20 text-center">Q sube · E baja · click+drag rota</p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-widest text-white/30">Waypoints</p>
                  <button
                    onClick={addWP}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 rounded-lg px-2 py-0.5 hover:bg-indigo-600/10 transition-colors"
                  >
                    + Añadir
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                  {local.waypoints.map((wp, i) => (
                    <div
                      key={i}
                      className={`rounded-xl p-2.5 space-y-2 border transition-colors ${
                        i === activeWaypoint
                          ? 'border-indigo-500/40 bg-indigo-950/30'
                          : 'border-white/8 bg-white/3'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-white/50">
                          WP {i}
                          {i === 0 && <span className="ml-1 text-indigo-400">— Hero</span>}
                          {i === activeWaypoint && <span className="ml-1 text-indigo-400">● activo</span>}
                        </span>

                        <div className="flex gap-1">
                          <button
                            onClick={() => onJump(i)}
                            className="text-[9px] text-white/30 hover:text-white/70 border border-white/10 rounded px-1.5 py-0.5 transition-colors"
                          >
                            ir
                          </button>
                          <button
                            onClick={() => onSavePos(i)}
                            className="text-[9px] text-emerald-400/70 hover:text-emerald-300 border border-emerald-800/40 rounded px-1.5 py-0.5 transition-colors"
                          >
                            pos
                          </button>
                          <button
                            onClick={() => onSaveLook(i)}
                            className="text-[9px] text-sky-400/70 hover:text-sky-300 border border-sky-800/40 rounded px-1.5 py-0.5 transition-colors"
                          >
                            mira
                          </button>
                          <button
                            onClick={() => onSaveSplatPos(i)}
                            className="text-[9px] text-violet-400/70 hover:text-violet-300 border border-violet-800/40 rounded px-1.5 py-0.5 transition-colors"
                          >
                            splat
                          </button>
                          {local.waypoints.length > 2 && (
                            <button
                              onClick={() => rmWP(i)}
                              className="text-[9px] text-red-400/50 hover:text-red-400 border border-red-900/30 rounded px-1.5 py-0.5 transition-colors"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>

                      <Vec3Field label="Pos cámara" value={wp.pos} onChange={v => updWP(i, 'pos', v)} />
                      <Vec3Field label="Mira hacia" value={wp.lookAt} onChange={v => updWP(i, 'lookAt', v)} />
                      <Vec3Field label="Pos splat" value={wp.splatPos} onChange={v => updWP(i, 'splatPos', v)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'splat' && (
            <div className="p-3 space-y-3">
              <Vec3Field
                label="Rotación splat (radianes)"
                value={local.splatRotation}
                onChange={updRot}
                step={0.05}
              />
              <p className="text-[9px] text-white/20">π ≈ 3.14159 · π/2 ≈ 1.5708</p>
              <div className="rounded-xl bg-black/40 border border-white/8 p-2.5 text-[10px] space-y-0.5 text-white/40">
                <p>
                  URL: <span className="text-indigo-300 break-all">{SPLAT_URL}</span>
                </p>
              </div>
            </div>
          )}

          {tab === 'export' && (
            <div className="p-3 space-y-2">
              <p className="text-[10px] text-white/30 uppercase tracking-widest">Pegá en CAM_CONFIG</p>
              <pre className="rounded-xl bg-black/50 border border-white/8 p-2.5 text-[9px] text-indigo-200/80 overflow-auto max-h-64 leading-relaxed">
                {exportJson}
              </pre>
              <button
                onClick={copyJson}
                className={`w-full rounded-xl py-2 text-[10px] font-semibold tracking-wide transition-all ${
                  copied
                    ? 'bg-emerald-600/80 text-white ring-1 ring-emerald-500'
                    : 'bg-white/6 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white'
                }`}
              >
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
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const splatRef = useRef<SplatMesh | null>(null);
  const mountIdRef = useRef(0);

  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollProgressRef = useRef(0);
  const smoothScrollRef = useRef(0);

  const [debugOpen, setDebugOpen] = useState(false);
  const [isFreeRoam, setIsFreeRoam] = useState(false);
  const [flySpeed, setFlySpeed] = useState(0.3);
  const [liveCamPos, setLiveCamPos] = useState<V3>([0, 0, 0]);
  const [liveLookAt, setLiveLookAt] = useState<V3>([0, 0, 0]);
  const [activeWP, setActiveWP] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const [rtConfig, setRtConfig] = useState<RuntimeConfig>(() => structuredClone(CAM_CONFIG));
  const rtConfigRef = useRef(rtConfig);
  const freeRoamRef = useRef(false);
  const flySpeedRef = useRef(0.3);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const lookAngles = useRef({ yaw: 0, pitch: 0 });
  const keys = useRef<Record<string, boolean>>({
    w: false,
    a: false,
    s: false,
    d: false,
    q: false,
    e: false,
  });

  useEffect(() => {
    freeRoamRef.current = isFreeRoam;
  }, [isFreeRoam]);

  useEffect(() => {
    flySpeedRef.current = flySpeed;
  }, [flySpeed]);

  useEffect(() => {
    rtConfigRef.current = rtConfig;
  }, [rtConfig]);

  const log = useCallback((msg: string, level: LogEntry['level'] = 'info') => {
    const time = new Date().toLocaleTimeString('es', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`[SplatLanding] ${msg}`);
    setLogs(prev => [...prev.slice(-99), { time, level, msg }]);
  }, []);

  // ── Init Three.js ───────────────────────────────────────────────────────────
  useEffect(() => {
    const wrap = canvasWrapRef.current;
    if (!wrap) return;

    if (rendererRef.current) {
      log('Re-mount — reinicializando', 'warn');
      rendererRef.current.setAnimationLoop(null);
      rendererRef.current.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      splatRef.current = null;
    }

    mountIdRef.current++;
    const thisMountId = mountIdRef.current;
    log(`Init Three.js (mount #${thisMountId})`);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#06060f');
    sceneRef.current = scene;

    const wp0 = rtConfigRef.current.waypoints[0];
    const camera = new THREE.PerspectiveCamera(55, wrap.clientWidth / wrap.clientHeight, 0.01, 10000);
    camera.position.copy(v3(wp0.pos));
    camera.quaternion.copy(quatFromPosLookAt(wp0.pos, wp0.lookAt));
    cameraRef.current = camera;

    {
      const dir = v3(wp0.lookAt).sub(v3(wp0.pos)).normalize();
      lookAngles.current.yaw = Math.atan2(dir.x, dir.z);
      lookAngles.current.pitch = Math.asin(Math.max(-1, Math.min(1, -dir.y)));
    }

    smoothScrollRef.current = scrollProgressRef.current;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(wrap.clientWidth, wrap.clientHeight);
    renderer.domElement.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
    wrap.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    try {
      const spark = new SparkRenderer({ renderer });
      scene.add(spark);
      log('SparkRenderer OK', 'ok');
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

    const clock = new THREE.Clock();
    let frame = 0;
    const tmpQuat = new THREE.Quaternion();

    renderer.setAnimationLoop(() => {
      frame++;
      const dt = Math.min(clock.getDelta(), 0.05);
      const cfg = rtConfigRef.current;
      const wps = cfg.waypoints;

      if (freeRoamRef.current) {
        const spd = flySpeedRef.current;
        const fwd = new THREE.Vector3();
        camera.getWorldDirection(fwd);

        const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();

        if (keys.current['w']) camera.position.addScaledVector(fwd, spd);
        if (keys.current['s']) camera.position.addScaledVector(fwd, -spd);
        if (keys.current['a']) camera.position.addScaledVector(right, -spd);
        if (keys.current['d']) camera.position.addScaledVector(right, spd);
        if (keys.current['q']) camera.position.y += spd;
        if (keys.current['e']) camera.position.y -= spd;

        camera.quaternion.setFromEuler(
          new THREE.Euler(lookAngles.current.pitch, lookAngles.current.yaw, 0, 'YXZ')
        );
      } else {
        const scrollAlpha = expAlpha(SCROLL_RESPONSE, dt);
        smoothScrollRef.current = lerp(smoothScrollRef.current, scrollProgressRef.current, scrollAlpha);

        const total = wps.length - 1;
        const fIdx = clamp01(smoothScrollRef.current) * total;
        const i0 = Math.max(0, Math.min(total - 1, Math.floor(fIdx)));
        const i1 = Math.min(total, i0 + 1);
        const t = easeInOut(fIdx - i0);

        const w0 = wps[i0];
        const w1 = wps[i1];

        const targetPos = new THREE.Vector3(
          lerp(w0.pos[0], w1.pos[0], t),
          lerp(w0.pos[1], w1.pos[1], t),
          lerp(w0.pos[2], w1.pos[2], t)
        );

        const targetSplat = new THREE.Vector3(
          lerp(w0.splatPos[0], w1.splatPos[0], t),
          lerp(w0.splatPos[1], w1.splatPos[1], t),
          lerp(w0.splatPos[2], w1.splatPos[2], t)
        );

        const q0 = quatFromPosLookAt(w0.pos, w0.lookAt);
        const q1 = quatFromPosLookAt(w1.pos, w1.lookAt);
        tmpQuat.copy(q0).slerp(q1, t);

        const camAlpha = expAlpha(CAMERA_RESPONSE, dt);
        const splatAlpha = expAlpha(SPLAT_RESPONSE, dt);

        camera.position.lerp(targetPos, camAlpha);
        camera.quaternion.slerp(tmpQuat, camAlpha);

        if (splatRef.current) {
          splatRef.current.position.lerp(targetSplat, splatAlpha);
        }

        const fd = new THREE.Vector3();
        camera.getWorldDirection(fd);
        lookAngles.current.yaw = Math.atan2(fd.x, fd.z);
        lookAngles.current.pitch = Math.asin(Math.max(-1, Math.min(1, -fd.y)));

        if (frame % 20 === 0) {
          setActiveWP(Math.round(clamp01(smoothScrollRef.current) * total));
        }
      }

      if (frame % 4 === 0) {
        const p = camera.position;
        setLiveCamPos([fmt(p.x), fmt(p.y), fmt(p.z)]);

        const fd = new THREE.Vector3();
        camera.getWorldDirection(fd);
        const lp = p.clone().addScaledVector(fd, 3);
        setLiveLookAt([fmt(lp.x), fmt(lp.y), fmt(lp.z)]);
      }

      renderer.render(scene, camera);
    });

    log('Loop iniciado', 'ok');
    log(`Cargando: ${SPLAT_URL}`);

    try {
      const splat = new SplatMesh({
        url: SPLAT_URL,
        onLoad: () => {
          if (mountIdRef.current !== thisMountId) return;
          log('Splat cargado ✓', 'ok');
        },
      });

      splat.rotation.copy(new THREE.Euler(...rtConfigRef.current.splatRotation));
      splat.position.copy(v3(rtConfigRef.current.waypoints[0].splatPos));
      scene.add(splat);
      splatRef.current = splat;
      log('SplatMesh en scene');
    } catch (e) {
      log(`SplatMesh ERROR: ${e}`, 'error');
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

      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }

      renderer.dispose();
      rendererRef.current = null;
    };
  }, [log]);

  useEffect(() => {
    if (!splatRef.current) return;
    splatRef.current.rotation.copy(new THREE.Euler(...rtConfig.splatRotation));
  }, [rtConfig.splatRotation]);

  // ── Scroll ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => {
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      const prog = maxY > 0 ? clamp01(window.scrollY / maxY) : 0;
      scrollProgressRef.current = prog;
      setScrollProgress(prog);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Mouse & Keyboard ───────────────────────────────────────────────────────
  useEffect(() => {
    const canDrag = () => freeRoamRef.current;

    const onDown = (e: PointerEvent) => {
      if (!canDrag()) return;
      if ((e.target as HTMLElement)?.closest('[data-debug-panel]')) return;
      isDragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const onUp = () => {
      isDragging.current = false;
    };

    const onMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };

      lookAngles.current.yaw -= dx * 0.003;
      lookAngles.current.pitch = Math.max(
        -1.35,
        Math.min(1.35, lookAngles.current.pitch - dy * 0.003)
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in keys.current) keys.current[k] = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in keys.current) keys.current[k] = false;
    };

    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // ── Debug helpers ───────────────────────────────────────────────────────────
  const savePos = useCallback(
    (idx: number) => {
      const cam = cameraRef.current;
      if (!cam) return;

      const val: V3 = [fmt(cam.position.x), fmt(cam.position.y), fmt(cam.position.z)];
      log(`WP${idx} pos: [${val.join(', ')}]`, 'ok');

      setRtConfig(prev => {
        const n = structuredClone(prev);
        if (n.waypoints[idx]) n.waypoints[idx].pos = val;
        return n;
      });
    },
    [log]
  );

  const saveLook = useCallback(
    (idx: number) => {
      const cam = cameraRef.current;
      if (!cam) return;

      const fd = new THREE.Vector3();
      cam.getWorldDirection(fd);
      const t = cam.position.clone().addScaledVector(fd, 3);
      const val: V3 = [fmt(t.x), fmt(t.y), fmt(t.z)];
      log(`WP${idx} lookAt: [${val.join(', ')}]`, 'ok');

      setRtConfig(prev => {
        const n = structuredClone(prev);
        if (n.waypoints[idx]) n.waypoints[idx].lookAt = val;
        return n;
      });
    },
    [log]
  );

  const saveSplatPos = useCallback(
    (idx: number) => {
      const splat = splatRef.current;
      if (!splat) return;

      const val: V3 = [fmt(splat.position.x), fmt(splat.position.y), fmt(splat.position.z)];
      log(`WP${idx} splatPos: [${val.join(', ')}]`, 'ok');

      setRtConfig(prev => {
        const n = structuredClone(prev);
        if (n.waypoints[idx]) n.waypoints[idx].splatPos = val;
        return n;
      });
    },
    [log]
  );

  const jumpToWP = useCallback(
    (idx: number) => {
      const cam = cameraRef.current;
      if (!cam) return;

      const wp = rtConfigRef.current.waypoints[idx];
      if (!wp) return;

      cam.position.copy(v3(wp.pos));
      cam.quaternion.copy(quatFromPosLookAt(wp.pos, wp.lookAt));

      const dir = v3(wp.lookAt).sub(v3(wp.pos)).normalize();
      lookAngles.current.yaw = Math.atan2(dir.x, dir.z);
      lookAngles.current.pitch = Math.asin(Math.max(-1, Math.min(1, -dir.y)));

      if (splatRef.current) {
        splatRef.current.position.copy(v3(wp.splatPos));
      }

      log(`Salté a WP${idx}`);
    },
    [log]
  );

  // ── Hero ───────────────────────────────────────────────────────────────────
  const heroLetters = useMemo(() => HERO_TEXT.split(''), []);
  const [heroMouse, setHeroMouse] = useState({ nx: 0.5, ny: 0.5, hover: false });
  const smoothMouse = useRef({ nx: 0.5, ny: 0.5 });
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      smoothMouse.current.nx = lerp(smoothMouse.current.nx, heroMouse.nx, 0.06);
      smoothMouse.current.ny = lerp(smoothMouse.current.ny, heroMouse.ny, 0.06);
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [heroMouse.nx, heroMouse.ny]);

  const getLetterStyle = useCallback(
    (i: number, total: number): React.CSSProperties => {
      if (!heroMouse.hover) return { transform: 'translate3d(0,0,0)', textShadow: 'none' };

      const sm = smoothMouse.current;
      const lx = i / (total - 1);
      const dx = lx - sm.nx;
      const dy = 0.5 - sm.ny;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const force = Math.max(0, 38 * (1 - dist * 2.2));
      const tx = (dx / dist) * force;
      const ty = (dy / dist) * force * 0.6;

      return {
        transform: `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0)`,
        textShadow: `${(-tx * 0.4).toFixed(1)}px ${(-ty * 0.4 + 4).toFixed(1)}px 18px rgba(99,102,241,0.35)`,
      };
    },
    [heroMouse.hover]
  );

  const onHeroMove: React.MouseEventHandler<HTMLDivElement> = e => {
    const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    setHeroMouse(s => ({
      ...s,
      nx: (e.clientX - r.left) / r.width,
      ny: (e.clientY - r.top) / r.height,
    }));
  };

  const cardSlot = 1 / N_SECTIONS;
  const isHeroVisible = scrollProgress < cardSlot;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative text-white" style={{ height: `${N_SECTIONS * 100}svh` }}>
      <div
        ref={canvasWrapRef}
        className={`fixed inset-0 h-[100svh] w-full ${isFreeRoam ? 'cursor-crosshair' : 'cursor-default'}`}
      >
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              'radial-gradient(ellipse 55% 55% at 50% 50%, transparent 0%, transparent 35%, rgba(6,6,15,0.35) 55%, rgba(6,6,15,0.82) 72%, rgba(6,6,15,0.97) 86%, #06060f 100%)',
          }}
        />

        {isAdmin && (
          <button
            onClick={() => setDebugOpen(o => !o)}
            className={`absolute top-24 left-1/2 -translate-x-1/2 z-50 rounded-xl px-4 py-1.5 text-xs font-semibold border backdrop-blur transition-all duration-200 flex items-center gap-2 ${
              debugOpen
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/40'
                : 'bg-black/60 border-white/10 text-white/40 hover:text-white hover:border-white/20 hover:bg-black/70'
            }`}
          >
            <span>⚙</span>
            <span>Debug</span>
            {logs.some(l => l.level === 'error') && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
          </button>
        )}

        {isAdmin && debugOpen && (
          <DebugPanel
            config={rtConfig}
            onApply={setRtConfig}
            logs={logs}
            camPos={liveCamPos}
            camLook={liveLookAt}
            isFreeRoam={isFreeRoam}
            flySpeed={flySpeed}
            onToggleFreeRoam={() => setIsFreeRoam(o => !o)}
            onSetSpeed={setFlySpeed}
            activeWaypoint={activeWP}
            onSavePos={savePos}
            onSaveLook={saveLook}
            onSaveSplatPos={saveSplatPos}
            onJump={jumpToWP}
          />
        )}

        <div
          className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6 transition-opacity duration-700 ${
            isHeroVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div
            className={isHeroVisible ? 'pointer-events-auto' : ''}
            onMouseEnter={() => setHeroMouse(s => ({ ...s, hover: true }))}
            onMouseLeave={() => setHeroMouse({ nx: 0.5, ny: 0.5, hover: false })}
            onMouseMove={onHeroMove}
          >
            <h1 className="select-none text-center text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-none">
              {heroLetters.map((ch, i) => (
                <span
                  key={`${ch}-${i}`}
                  className="inline-block"
                  style={{
                    ...getLetterStyle(i, heroLetters.length),
                    transition: heroMouse.hover
                      ? 'transform 0.18s cubic-bezier(0.23,1,0.32,1), text-shadow 0.18s ease'
                      : 'transform 0.6s cubic-bezier(0.23,1,0.32,1), text-shadow 0.6s ease',
                  }}
                >
                  {ch === ' ' ? '\u00A0' : ch}
                </span>
              ))}
            </h1>

            <p className="mt-3 sm:mt-4 text-center text-xs sm:text-sm text-white/50 tracking-widest uppercase">
              Patagonia · Argentina
            </p>

            <div
              className="mt-8 sm:mt-12 flex flex-col items-center gap-2"
              style={{ animation: 'scrollBounce 3s ease-in-out infinite' }}
            >
              <style>{`@keyframes scrollBounce{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(8px);opacity:.9}}`}</style>
              <span className="text-xs text-white/40 uppercase tracking-widest">Scroll</span>
              <svg
                width="14"
                height="22"
                viewBox="0 0 14 22"
                className="text-white/40"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M7 3 L7 19 M3 15 L7 19 L11 15" />
              </svg>
            </div>
          </div>
        </div>

        {CARDS.map((card, i) => {
          const slotStart = (i + 1) * cardSlot;
          const slotEnd = (i + 2) * cardSlot;
          const inSlot = scrollProgress >= slotStart && scrollProgress < slotEnd;

          return (
            <div
              key={card.key}
              className="pointer-events-none absolute inset-0 z-20 flex items-end sm:items-center px-5 sm:px-12 md:px-20 pb-20 sm:pb-0"
              style={{
                opacity: inSlot ? 1 : 0,
                transform: inSlot ? 'translateY(0)' : 'translateY(28px)',
                transition: 'opacity 0.55s ease, transform 0.55s ease',
              }}
            >
              <Link href={card.href} className="w-full max-w-xs sm:max-w-sm pointer-events-auto group block focus:outline-none">
                <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-black/30 backdrop-blur-xl shadow-2xl shadow-black/50 transition-all duration-300 group-hover:border-white/25 group-hover:bg-black/45 group-hover:scale-[1.02] group-focus-visible:ring-2 group-focus-visible:ring-indigo-500">
                  <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent transition-all duration-300 group-hover:via-indigo-400/80" />
                  <div className="p-6 sm:p-8">
                    <h2 className="text-2xl sm:text-3xl font-bold leading-tight tracking-tight text-white">
                      {card.title}
                    </h2>
                    <p className="mt-2.5 text-sm sm:text-base text-white/55 leading-relaxed">
                      {card.subtitle}
                    </p>
                    <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-indigo-300 group-hover:text-indigo-200 transition-colors">
                      Ver más
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="transition-transform duration-200 group-hover:translate-x-0.5"
                      >
                        <path d="M2 6h8M6 2l4 4-4 4" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}