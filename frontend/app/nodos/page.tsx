'use client';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import * as THREE from 'three';
import {
  Network, RefreshCw, Maximize, MapPin, Layers,
  Clapperboard, Focus, Zap, Wind, Mountain, User, Users, Building2, GraduationCap
} from 'lucide-react';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });
 const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'; 



// ─────────────────────────────────────────────
// NODOS ANCLA POR CIUDAD (esferas grandes atractoras)
// Posición fija en el eje Y, separadas 500u entre sí.
// Cámara frontal z:1800 → Y positivo = arriba, Y negativo = abajo.
// ─────────────────────────────────────────────
const CIUDAD_CONFIG: Record<string, { y: number; color: string; label: string }> = {
  'Río Grande': { y:  480, color: '#f97316', label: 'RÍO GRANDE' },  // naranja
  'Rio Grande': { y:  480, color: '#f97316', label: 'RÍO GRANDE' },
  'Tolhuin':    { y:    0, color: '#a78bfa', label: 'TOLHUIN'    },  // violeta
  'Ushuaia':    { y: -480, color: '#38bdf8', label: 'USHUAIA'    },  // celeste
};
const CIUDAD_RADIUS = 95; // radio de la esfera ancla

function getCiudadY(ciudad: string): number {
  const cfg = CIUDAD_CONFIG[ciudad];
  const cy = cfg ? cfg.y : 0;
  // Nodos hijos se inicializan cerca de su ancla
  return cy + (Math.random() - 0.5) * 80;
}

const LAYERS_Z: Record<string, number> = { ciudad: 0, locacion: 0, proyecto: 60, prestador: 120 };

// ─────────────────────────────────────────────
// SHADER IFRAME — lerp suave en el shader
// ─────────────────────────────────────────────
const SHADER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html,body { width:100%; height:100%; overflow:hidden; background:#000; }
canvas { display:block; width:100%; height:100%; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2', { preserveDrawingBuffer:true });
if (!gl) throw new Error('No WebGL2');

let targetSpeed = 1.0, targetDist = 0.0;
let curSpeed    = 1.0, curDist    = 0.0;
const LERP = 0.03;

window.addEventListener('message', e => {
  if (e.data && e.data.type === 'SHADER_CTRL') {
    if (e.data.speed      !== undefined) targetSpeed = e.data.speed;
    if (e.data.distortion !== undefined) targetDist  = e.data.distortion;
  }
});

const VS = \`#version 300 es
in vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
\`;
const FS = \`#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2  u_resolution;
uniform float u_time;
uniform float u_speed;
uniform float u_distortion;
void main() {
    float t = u_time * u_speed;
    fragColor = vec4(0.0);
    for(float z,d,i; i++ < 2e1; ) {
        vec3 p = z * normalize(gl_FragCoord.rgb*2.0 - vec3(u_resolution,1.0).xyx);
        p = vec3(atan(p.y/0.2,p.x)*2.0, p.z/3.0, length(p.xy)-5.0-z*0.2);
        float de = clamp(abs(u_distortion),0.0,5.0);
        for(d=1.0; d<7.0+de; d++) p += sin(p.yzx*d*(1.0+u_distortion*0.1)+t+0.3*i)/d;
        if(u_distortion < 0.0) {
            float a = t*0.05;
            p.xy = vec2(p.x*cos(a)-p.y*sin(a), p.x*sin(a)+p.y*cos(a));
        }
        z += d = length(vec4(0.4*cos(p)-0.4, p.z));
        fragColor += (cos(p.x+i*0.4+z+vec4(6,1,2,0))+1.0)/d;
    }
    fragColor = tanh(fragColor*fragColor/1.4e3);
}
\`;

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
  return s;
}
const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
gl.linkProgram(prog);

const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);

const aPos = gl.getAttribLocation(prog, 'a_position');
gl.useProgram(prog); gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

const loc = {
  res: gl.getUniformLocation(prog,'u_resolution'), time: gl.getUniformLocation(prog,'u_time'),
  spd: gl.getUniformLocation(prog,'u_speed'),      dist: gl.getUniformLocation(prog,'u_distortion'),
};

function resize() {
  const dpr = window.devicePixelRatio||1;
  canvas.width  = Math.round(canvas.clientWidth *dpr);
  canvas.height = Math.round(canvas.clientHeight*dpr);
}
window.addEventListener('resize', resize); resize();

const start = performance.now();
(function loop(now) {
  requestAnimationFrame(loop);
  curSpeed += (targetSpeed - curSpeed) * LERP;
  curDist  += (targetDist  - curDist)  * LERP;
  resize();
  const t = (now-start)/1000;
  gl.viewport(0,0,canvas.width,canvas.height);
  gl.uniform2f(loc.res, canvas.width, canvas.height);
  gl.uniform1f(loc.time, t);
  gl.uniform1f(loc.spd,  curSpeed);
  gl.uniform1f(loc.dist, curDist);
  gl.drawArrays(gl.TRIANGLES,0,6);
})(performance.now());
<\/script>
</body>
</html>`;

// ─────────────────────────────────────────────
// TV OVERLAY
// ─────────────────────────────────────────────
const TVOverlay = () => (
  <div className="absolute inset-0 pointer-events-none z-10">
    <div className="absolute inset-0" style={{
      background:'linear-gradient(rgba(0,0,0,0) 50%,rgba(0,0,0,0.45) 50%),linear-gradient(90deg,rgba(255,0,0,0.04),rgba(0,255,0,0.015),rgba(0,0,255,0.04))',
      backgroundSize:'100% 3px,3px 100%', opacity:0.85,
    }}/>
    <div className="absolute inset-0" style={{ background:'radial-gradient(circle,rgba(0,0,0,0.1) 0%,rgba(0,0,0,0.55) 55%,rgba(0,0,0,0.92) 100%)' }}/>
    <div className="absolute inset-0 bg-black/35"/>
  </div>
);

// ─────────────────────────────────────────────
// ONDAS CSS
// ─────────────────────────────────────────────
const WAVE_COLORS = [
  'rgba(249,115,22,','rgba(239,68,68,','rgba(59,130,246,',
  'rgba(168,85,247,','rgba(16,185,129,','rgba(234,179,8,','rgba(251,191,36,',
];
interface Wave { id: number; color: string; startTime: number; }

const WaveOverlay = ({ waves }: { waves: Wave[] }) => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex:5 }}>
    {waves.map(w => (
      <div key={w.id} className="absolute" style={{
        left:'50%', top:'50%', transform:'translate(-50%,-50%)',
        width:'10px', height:'10px', borderRadius:'50%',
        border:`2px solid ${w.color}0.8)`,
        boxShadow:`0 0 20px ${w.color}0.4),0 0 60px ${w.color}0.2)`,
        animation:'waveExpand 4s ease-out forwards',
        marginLeft:`${(w.id%7-3)*8}px`, marginTop:`${(w.id%5-2)*8}px`,
      }}/>
    ))}
    <style>{`@keyframes waveExpand{0%{width:10px;height:10px;opacity:1}30%{opacity:0.8}100%{width:180vmax;height:180vmax;opacity:0}}`}</style>
  </div>
);

// ─────────────────────────────────────────────
// HUD SHADER
// ─────────────────────────────────────────────
const ShaderHUD = ({ speed, distortion }: { speed: number; distortion: number }) => {
  const speedPct = ((speed-0.1)/3.9)*100;
  const distPct  = ((distortion+5)/10)*100;
  const distLeft = distortion >= 0 ? 50 : distPct;
  const distW    = Math.abs(distPct-50);
  return (
    <div className="absolute bottom-8 left-6 z-50 pointer-events-none select-none">
      <div className="bg-slate-950/70 backdrop-blur-xl rounded-xl border border-white/10 p-4 w-64 space-y-3">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Controles de fondo</p>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] font-bold text-orange-400 flex items-center gap-1"><Wind size={9}/> VELOCIDAD &nbsp;↑↓</span>
            <span className="text-[9px] font-mono text-orange-300">{speed.toFixed(2)}x</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-600 to-red-500 rounded-full transition-all duration-150" style={{width:`${speedPct}%`}}/>
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] font-bold text-blue-400 flex items-center gap-1"><Zap size={9}/> PERTURBACIÓN &nbsp;←→</span>
            <span className="text-[9px] font-mono text-blue-300">{distortion>0?'+':''}{distortion.toFixed(1)}</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden relative">
            <div className="absolute inset-y-0 bg-gradient-to-r from-blue-600 to-violet-500 rounded-full transition-all duration-150" style={{left:`${distLeft}%`,width:`${distW}%`}}/>
            <div className="absolute inset-y-0 w-px bg-white/30" style={{left:'50%'}}/>
          </div>
        </div>
        <p className="text-[8px] text-slate-600 tracking-wide">Usa las flechas del teclado</p>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// NODO 3D 
// ─────────────────────────────────────────────
const NODE_HEX: Record<string, string> = {
  locacion:                '#f1f5f9',
  proyecto:                '#ef4444',
  profesional:             '#3b82f6',
  'productora audiovisual':'#a855f7',
  productora:              '#a855f7',
  empresa:                 '#eab308',
  estudiante:              '#10b981',
};

function makeNodeObject(node: any): THREE.Object3D {
  const group = new THREE.Group();

  // ── ESFERA ANCLA DE CIUDAD (cel-shading) ──────────────────────────────────
  if (node.type === 'ciudad') {
    const cfg = CIUDAD_CONFIG[node.ciudad] ?? { color: '#ffffff' };
    const color = new THREE.Color(cfg.color);
    const R = CIUDAD_RADIUS;

    // Interior casi invisible (solo para que THREE la registre)
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(R, 32, 32),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.04,
        side: THREE.FrontSide, depthWrite: false,
      })
    ));

    // Borde exterior cel-shading: esfera BackSide más grande, opaca en borde
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(R + 3, 32, 32),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.55,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    ));

    // Segundo halo más amplio y tenue
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(R + 18, 24, 24),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.08,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    ));

    // Luz puntual suave desde el centro
    group.add(new THREE.PointLight(cfg.color, 0.6, R * 4));
    return group;
  }

  // ── NODOS NORMALES ─────────────────────────────────────────────────────────
  const type   = node.type === 'prestador' ? (node.subTipo?.toLowerCase() || 'profesional') : node.type;
  const hex    = NODE_HEX[type] ?? NODE_HEX.profesional;
  const color  = new THREE.Color(hex);
  const radius = node.val ? Math.cbrt(node.val) * 1.4 : 2.5;

  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 24),
    new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 1.8,
      roughness: 0.15, metalness: 0.6,
      transparent: true, opacity: 0.95,
    })
  ));

  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(radius * 2.2, 16, 16),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.12,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  ));

  group.add(new THREE.PointLight(hex, 1.2, radius * 12));
  return group;
}

// ─────────────────────────────────────────────
// TOOLTIP 
// ─────────────────────────────────────────────
interface TooltipData {
  name: string; type: string; subTipo?: string;
  ciudad?: string; categoria?: string; tipo?: string;
}
const NodeTooltip = ({ node }: { node: TooltipData }) => {
  const typeLabel = node.type === 'locacion' ? 'Locación' : node.type === 'proyecto' ? 'Proyecto' : 'Prestador';
  const accentColor = node.type === 'locacion' ? 'text-slate-300' : node.type === 'proyecto' ? 'text-red-400' : 'text-blue-400';
  const subinfo = node.type === 'locacion' ? node.categoria : node.type === 'proyecto' ? node.tipo : node.subTipo;
  return (
    <div className="bg-slate-900/95 backdrop-blur border border-white/10 rounded-xl px-4 py-3 shadow-2xl min-w-[160px] pointer-events-none">
      <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${accentColor}`}>{typeLabel}</p>
      <p className="text-white font-bold text-sm leading-tight mb-1">{node.name}</p>
      {subinfo && <p className="text-slate-400 text-[10px] capitalize">{subinfo}</p>}
      {node.ciudad && (
        <p className="text-slate-500 text-[10px] flex items-center gap-1 mt-1">
          <MapPin size={9} className="text-orange-500"/> {node.ciudad}
        </p>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
export default function AdminDashboardPage() {
  const graphRef       = useRef<any>(null); 
  const iframeRef      = useRef<HTMLIFrameElement>(null);
  const waveCounterRef = useRef(0);
  const speedRef       = useRef(1.0);
  const distortionRef  = useRef(0.0);

  const [loading, setLoading]       = useState(true);
  const [graphData, setGraphData]   = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [waves, setWaves]           = useState<Wave[]>([]);
  const [visibleLayers, setVisibleLayers] = useState({ prestador: true, proyecto: true, locacion: true });
  const [speed, setSpeed]           = useState(1.0);
  const [distortion, setDistortion] = useState(0.0);
  const [hoveredNode, setHoveredNode] = useState<TooltipData | null>(null);
  const [tooltipPos, setTooltipPos]   = useState({ x: 0, y: 0 });
  const [stats, setStats]           = useState({ locaciones: 0, proyectos: 0, prestadores: 0 });

  // ── CARGA DE DATOS ──────────────────────────
  useEffect(() => {
    const buildGraph = async () => {
      try {
        const [resLoc, resProj, resPrest] = await Promise.all([
          fetch(`${apiUrl}/locacion`).then(r => r.json()),
          fetch(`${apiUrl}/proyecto`).then(r => r.json()),
          fetch(`${apiUrl}/prestador`).then(r => r.json()),
        ]);

        const nodes: any[] = [];
        const links: any[] = [];

        // — NODOS ANCLA DE CIUDAD (fijos, atraen los demás)
        const ciudadesUnicas = ['Río Grande', 'Tolhuin', 'Ushuaia'];
        ciudadesUnicas.forEach(ciudad => {
          const cfg = CIUDAD_CONFIG[ciudad]!;
          nodes.push({
            id:     `ciudad_${ciudad}`,
            name:   cfg.label,
            type:   'ciudad',
            ciudad,
            fx: 0, fy: cfg.y, fz: 0,
            val: 1,
          });
        });

        // — LOCACIONES (capa base, z=0, fx/fy fijas)
        resLoc.forEach((loc: any) => {
          nodes.push({
            id:        `loc_${loc.id}`,
            name:      loc.nombre,
            type:      'locacion',
            ciudad:    loc.ciudad,
            categoria: loc.categoria,
            foto:      loc.foto,
            fx: (Math.random() - 0.5) * 350,
            fy: getCiudadY(loc.ciudad),
            fz: 0,
            val: 4,
          });
        });

        // — PROYECTOS (capa media, z=150)
        resProj.forEach((proj: any) => {
          nodes.push({
            id:     `proj_${proj.id}`,
            name:   proj.titulo,
            type:   'proyecto',
            ciudad: proj.ciudad,
            tipo:   proj.tipo,
            foto:   proj.foto,
            // No fx/fy fijos: la fuerza Y los atraerá a su tercio
            x:  (Math.random() - 0.5) * 180,
            y:  getCiudadY(proj.ciudad),
            z:  LAYERS_Z.proyecto,
            val: 12,
          });
          // Enlace a locación de la misma ciudad
          const loc = nodes.find(n => n.type === 'locacion' && n.ciudad === proj.ciudad);
          if (loc) links.push({ source: `proj_${proj.id}`, target: loc.id });
        });

        // — PRESTADORES (capa superior, z=300)
        resPrest.forEach((prest: any) => {
          const rawTipo = (prest.tipoPrestador || prest.tipo || prest.rol || '').toLowerCase();
          const subTipo = rawTipo.includes('productora') ? 'productora audiovisual'
            : rawTipo.includes('empresa')    ? 'empresa'
            : rawTipo.includes('estudiante') ? 'estudiante'
            : 'profesional';

          nodes.push({
            id:      `prest_${prest.id}`,
            name:    prest.nombre,
            type:    'prestador',
            subTipo,
            ciudad:  prest.ciudad,
            foto:    prest.foto || prest.avatar,
            x:  (Math.random() - 0.5) * 300,
            y:  getCiudadY(prest.ciudad),
            z:  LAYERS_Z.prestador,
            val: 6,
          });

          // Enlace a proyecto — si es de otra ciudad, se permitirá salir del tercio
          if (Math.random() > 0.55) {
            const projSameCiudad  = nodes.filter(n => n.type === 'proyecto' && n.ciudad === prest.ciudad);
            const projOtraCiudad  = nodes.filter(n => n.type === 'proyecto' && n.ciudad !== prest.ciudad);
            // 80% misma ciudad, 20% otra (cross-city = sale del tercio)
            const pool = Math.random() < 0.8 ? projSameCiudad : projOtraCiudad;
            if (pool.length > 0) {
              const proj = pool[Math.floor(Math.random() * pool.length)];
              links.push({ source: `prest_${prest.id}`, target: proj.id });
            }
          }
        });

        setStats({ locaciones: resLoc.length, proyectos: resProj.length, prestadores: resPrest.length });
        setGraphData({ nodes, links });
        setLoading(false);
      } catch (err) {
        console.error('Backend no disponible, usando datos mock:', err);
        buildMockGraph();
      }
    };

    // Fallback mock con la misma lógica de tercios
    const buildMockGraph = () => {
      const nodes: any[] = [], links: any[] = [];
      const ciudades = ['Ushuaia', 'Río Grande', 'Tolhuin'];
      // Nodos ancla mock
      ['Río Grande', 'Tolhuin', 'Ushuaia'].forEach(ciudad => {
        const cfg = CIUDAD_CONFIG[ciudad]!;
        nodes.push({ id:`ciudad_${ciudad}`, name:cfg.label, type:'ciudad', ciudad, fx:0, fy:cfg.y, fz:0, val:1 });
      });

      for (let i = 1; i <= 20; i++) {
        const c = ciudades[Math.floor(Math.random() * ciudades.length)];
        nodes.push({ id:`loc${i}`, name:`Locación ${i}`, type:'locacion', ciudad:c, categoria:'Paisaje Natural',
          fx:(Math.random()-0.5)*350, fy:getCiudadY(c), fz:0, val:4 });
      }
      for (let i = 1; i <= 15; i++) {
        const c = ciudades[Math.floor(Math.random() * ciudades.length)];
        nodes.push({ id:`proj${i}`, name:`Proyecto ${i}`, type:'proyecto', ciudad:c, tipo:'Cortometraje',
          x:(Math.random()-0.5)*180, y:getCiudadY(c), z:150, val:12 });
        const loc = nodes.find(n => n.type==='locacion' && n.ciudad===c);
        if (loc) links.push({ source:`proj${i}`, target:loc.id });
      }
      const tipos = ['profesional','productora audiovisual','empresa','estudiante'];
      for (let i = 1; i <= 40; i++) {
        const c   = ciudades[Math.floor(Math.random() * ciudades.length)];
        const sub = tipos[Math.floor(Math.random() * tipos.length)];
        nodes.push({ id:`prest${i}`, name:`Prestador ${i}`, type:'prestador', subTipo:sub, ciudad:c,
          x:(Math.random()-0.5)*300, y:getCiudadY(c), z:300, val:6 });
        if (Math.random() > 0.55) {
          const pool = Math.random() < 0.8
            ? nodes.filter(n => n.type==='proyecto' && n.ciudad===c)
            : nodes.filter(n => n.type==='proyecto' && n.ciudad!==c);
          if (pool.length > 0) {
            const proj = pool[Math.floor(Math.random() * pool.length)];
            links.push({ source:`prest${i}`, target:proj.id });
          }
        }
      }
      setStats({ locaciones:20, proyectos:15, prestadores:40 });
      setGraphData({ nodes, links });
      setLoading(false);
    };

    buildGraph();
  }, []);

  // ── FILTRO CAPAS ───────────────────────────
  const filteredGraphData = useMemo(() => {
    const an  = graphData.nodes.filter((n: any) => visibleLayers[n.type as keyof typeof visibleLayers]);
    const ids = new Set(an.map((n: any) => n.id));
    const al  = graphData.links.filter((l: any) => {
      const s = typeof l.source==='object' ? l.source.id : l.source;
      const t = typeof l.target==='object' ? l.target.id : l.target;
      return ids.has(s) && ids.has(t);
    });
    return { nodes: an, links: al };
  }, [graphData, visibleLayers]);

  // ── SHADER CTRL ────────────────────────────
  const sendShaderCtrl = useCallback((s: number, d: number) => {
    iframeRef.current?.contentWindow?.postMessage({ type:'SHADER_CTRL', speed:s, distortion:d }, '*');
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      let moved = false;
      if      (e.key === 'ArrowUp')    { speedRef.current      = Math.min(4.0, +(speedRef.current+0.15).toFixed(2)); setSpeed(speedRef.current); moved=true; }
      else if (e.key === 'ArrowDown')  { speedRef.current      = Math.max(0.1, +(speedRef.current-0.15).toFixed(2)); setSpeed(speedRef.current); moved=true; }
      else if (e.key === 'ArrowRight') { distortionRef.current = Math.min(5.0, +(distortionRef.current+0.5).toFixed(1)); setDistortion(distortionRef.current); moved=true; }
      else if (e.key === 'ArrowLeft')  { distortionRef.current = Math.max(-5.0,+(distortionRef.current-0.5).toFixed(1)); setDistortion(distortionRef.current); moved=true; }
      if (moved) { e.preventDefault(); sendShaderCtrl(speedRef.current, distortionRef.current); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sendShaderCtrl]);

  // ── RECENTRAR + OLA ────────────────────────
  const resetCamera = useCallback(() => {
    graphRef.current?.cameraPosition({ x:0, y:0, z:1600 }, { x:0, y:0, z:0 }, 2500);
    const id    = ++waveCounterRef.current;
    const color = WAVE_COLORS[id % WAVE_COLORS.length];
    setWaves(prev => [...prev.slice(-8), { id, color, startTime: performance.now() }]);
  }, []);

  useEffect(() => { if (!loading) resetCamera(); }, [loading, resetCamera]);

  useEffect(() => {
    const iv = setInterval(() => {
      setWaves(prev => prev.filter(w => (performance.now()-w.startTime) < 4100));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const toggleLayer = (l: keyof typeof visibleLayers) =>
    setVisibleLayers(prev => ({ ...prev, [l]: !prev[l] }));

  const handleNodeHover = useCallback((node: any) => {
    if (!node || node.type === 'ciudad') { setHoveredNode(null); return; }
    setHoveredNode({ name:node.name, type:node.type, subTipo:node.subTipo, ciudad:node.ciudad, categoria:node.categoria, tipo:node.tipo });
  }, []);

  return (
    <div
      className="h-screen w-full relative overflow-hidden bg-slate-950"
      onMouseMove={e => setTooltipPos({ x:e.clientX+16, y:e.clientY-8 })}
    >
      {/* 1. SHADER */}
      <iframe ref={iframeRef} srcDoc={SHADER_HTML}
        className="absolute inset-0 w-full h-full"
        style={{ zIndex:0, border:'none', pointerEvents:'none' }}
        title="shader-bg" sandbox="allow-scripts"/>

      {/* 2. ONDAS */}
      <WaveOverlay waves={waves}/>

      {/* 3. FILTRO TV */}
      <TVOverlay/>

      {/* ─────────────────────────────────────
          4. PANEL IZQUIERDO
          — posición: left-6, centrado verticalmente (top-1/2 -translate-y-1/2)
          ───────────────────────────────────── */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 z-50 pointer-events-none select-none">
        <div className="bg-slate-950/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.8)] pointer-events-auto w-80 overflow-hidden flex flex-col">

          {/* Header */}
          <div className="p-5 border-b border-white/5 bg-gradient-to-r from-slate-900/90 to-transparent">
            <h1 className="text-xl font-black text-white flex items-center gap-3 tracking-tight">
              <div className="bg-orange-500/10 p-2 rounded-lg border border-orange-500/30 text-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                <Network size={20}/>
              </div>
              MAPA DE NODOS TDF
            </h1>
            <div className="flex items-center gap-2 mt-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"/>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"/>
              </span>
              <span className="text-[10px] font-bold text-emerald-500 tracking-widest uppercase">Sistema Online</span>
            </div>
          </div>

          {/* Stats */}
          {!loading && (
            <div className="px-5 py-3 grid grid-cols-3 gap-2 border-b border-white/5 bg-black/20">
              <div className="text-center">
                <p className="text-lg font-black text-slate-200">{stats.locaciones}</p>
                <p className="text-[8px] text-slate-500 uppercase tracking-widest">Locac.</p>
              </div>
              <div className="text-center border-x border-white/5">
                <p className="text-lg font-black text-red-400">{stats.proyectos}</p>
                <p className="text-[8px] text-slate-500 uppercase tracking-widest">Proy.</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-blue-400">{stats.prestadores}</p>
                <p className="text-[8px] text-slate-500 uppercase tracking-widest">Prest.</p>
              </div>
            </div>
          )}

          <div className="p-5 space-y-4">

            {/* Capa prestadores — texto centrado horizontalmente */}
            <div
              className={`cursor-pointer transition-all duration-300 p-3 rounded-xl border border-white/5 ${visibleLayers.prestador ? 'bg-white/5 opacity-100' : 'bg-white/5 opacity-40 grayscale'}`}
              onClick={() => toggleLayer('prestador')}
            >
              {/* título centrado */}
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center justify-center gap-2">
                <Layers size={10}/> Capa 3 · Talento {visibleLayers.prestador ? '(ON)':'(OFF)'}
              </p>
              {/* grid de leyenda — cada item centrado */}
              <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                {([
                  { key:'profesional',             label:'Profesional',  color:'#3b82f6' },
                  { key:'productora audiovisual',   label:'Productora',   color:'#a855f7' },
                  { key:'empresa',                 label:'Empresa',      color:'#eab308' },
                  { key:'estudiante',              label:'Estudiante',   color:'#10b981' },
                ] as const).map(({ key, label, color }) => (
                  <div key={key} className="flex items-center justify-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:color, boxShadow:`0 0 6px ${color}`}}/>
                    <span className="text-[10px] font-bold text-slate-300">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Capa proyectos */}
            <div
              onClick={() => toggleLayer('proyecto')}
              className={`flex items-center justify-between p-3 rounded-xl border border-white/5 cursor-pointer transition-all duration-300 ${visibleLayers.proyecto ? 'bg-white/5 opacity-100' : 'bg-white/5 opacity-40 grayscale'}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-slate-900 flex items-center justify-center text-red-500 border border-red-500/30"><Clapperboard size={14}/></div>
                <div><p className="text-[10px] font-bold text-white">Proyectos</p><p className="text-[9px] text-slate-500">Capa 2</p></div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]"/>
                <span className="text-[9px] text-slate-600">{visibleLayers.proyecto?'ON':'OFF'}</span>
              </div>
            </div>

            {/* Capa locaciones */}
            <div
              onClick={() => toggleLayer('locacion')}
              className={`flex items-center justify-between p-3 rounded-xl border border-white/5 cursor-pointer transition-all duration-300 ${visibleLayers.locacion ? 'bg-white/5 opacity-100' : 'bg-white/5 opacity-40 grayscale'}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-slate-900 flex items-center justify-center text-slate-200 border border-slate-500/30"><Mountain size={14}/></div>
                <div><p className="text-[10px] font-bold text-white">Locaciones</p><p className="text-[9px] text-slate-500">Capa 1 · Base</p></div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="w-2 h-2 rounded-full bg-slate-200 shadow-[0_0_8px_white]"/>
                <span className="text-[9px] text-slate-600">{visibleLayers.locacion?'ON':'OFF'}</span>
              </div>
            </div>

          </div>

          <div className="p-4 bg-slate-900/80 border-t border-white/5">
            <button onClick={resetCamera}
              className="w-full py-3 rounded-xl text-xs font-bold transition-all bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white shadow-lg shadow-orange-900/30 flex items-center justify-center gap-2 group border border-white/10">
              <Focus size={16} className="group-hover:scale-110 transition-transform"/> RECENTRAR VISTA MAPA
            </button>
          </div>
        </div>
      </div>

      {/* 5. HUD SHADER */}
      <ShaderHUD speed={speed} distortion={distortion}/>

      {/* 6. TOOLTIP */}
      {hoveredNode && (
        <div className="fixed z-50 pointer-events-none" style={{ left:tooltipPos.x, top:tooltipPos.y }}>
          <NodeTooltip node={hoveredNode}/>
        </div>
      )}

      {/* 7. GRÁFICO 3D
          nodeLabel="" suprime el texto que aparece al hover nativo */}
      <div className="flex-1 w-full h-full cursor-move relative z-20">
        {!loading && (
          <ForceGraph3D
            ref={graphRef}
            graphData={filteredGraphData}
            backgroundColor="rgba(0,0,0,0)"
            showNavInfo={false}
            nodeLabel=""
            nodeThreeObject={makeNodeObject}
            nodeThreeObjectExtend={false}
            nodeVal="val"
            nodeOpacity={1}
            onNodeHover={handleNodeHover}
            linkColor={(link: any) => {
              const s = typeof link.source==='object' ? link.source : link;
              const t = typeof link.target==='object' ? link.target : link;
              if (s?.type==='ciudad' || t?.type==='ciudad') return 'rgba(0,0,0,0)';
              return '#ffffff18';
            }}
            linkWidth={(link: any) => {
              const s = typeof link.source==='object' ? link.source : link;
              const t = typeof link.target==='object' ? link.target : link;
              if (s?.type==='ciudad' || t?.type==='ciudad') return 0;
              return 0.3;
            }}
            linkDirectionalParticles={visibleLayers.proyecto && visibleLayers.prestador ? 2 : 0}
            linkDirectionalParticleColor={() => '#fdba74'}
            linkDirectionalParticleWidth={3}
            linkDirectionalParticleResolution={8}
            linkDirectionalParticleSpeed={0.003}
            d3AlphaDecay={0.008}
            d3VelocityDecay={0.4}
            onEngineTick={() => {
              // Construimos mapa de posición de cada nodo-ancla
              const anclas: Record<string, {x:number,y:number,z:number}> = {};
              filteredGraphData.nodes.forEach((d: any) => {
                if (d.type === 'ciudad') anclas[d.ciudad] = { x: d.x??0, y: d.y??0, z: d.z??0 };
              });

              filteredGraphData.nodes.forEach((d: any) => {
                if (d.type === 'ciudad') return; // anclas son fijas (fx/fy/fz)

                const ancla = anclas[d.ciudad];
                if (!ancla) return;

                // Atracción gravitacional hacia la esfera-ancla de su ciudad
                const dx = ancla.x - (d.x ?? 0);
                const dy = ancla.y - (d.y ?? 0);
                const dz = ancla.z - (d.z ?? 0);
                const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;

                // Fuerza inversamente proporcional a la distancia (atracción suave)
                // Si está dentro del radio, fuerza casi nula → dispersión natural
                const inside = dist < CIUDAD_RADIUS * 0.9;
                const strength = inside ? 0.005 : Math.min(0.12, 0.8 / dist);

                d.vx = ((d.vx ?? 0) + dx * strength) * 0.88;
                d.vy = ((d.vy ?? 0) + dy * strength) * 0.88;
                d.vz = ((d.vz ?? 0) + dz * strength) * 0.88;

                // Cap de velocidad
                const maxV = 4;
                if (Math.abs(d.vx) > maxV) d.vx = Math.sign(d.vx) * maxV;
                if (Math.abs(d.vy) > maxV) d.vy = Math.sign(d.vy) * maxV;
                if (Math.abs(d.vz) > maxV) d.vz = Math.sign(d.vz) * maxV;
              });
            }}
          />
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-30">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"/>
              <p className="text-slate-500 text-sm animate-pulse tracking-widest uppercase">Conectando red de nodos...</p>
            </div>
          </div>
        )}
      </div>

      {/* 8. MARCAS DE AGUA */}
      <div className="absolute right-12 top-1/2 -translate-y-1/2 flex flex-col justify-between h-[65%] pointer-events-none select-none text-right z-20 opacity-70">
        <div>
          <span className="block text-xs font-bold text-orange-500 tracking-[0.5em] mb-1 opacity-60">NORTE</span>
          <div className="text-white font-black text-6xl opacity-20 tracking-tighter">RIO<br/>GRANDE</div>
        </div>
        <div>
          <div className="text-white font-black text-6xl opacity-20 tracking-tighter">TOLHUIN</div>
        </div>
        <div>
          <span className="block text-xs font-bold text-blue-500 tracking-[0.5em] mb-1 opacity-60">SUR</span>
          <div className="text-white font-black text-6xl opacity-20 tracking-tighter">USHUAIA</div>
        </div>
      </div>

      {/* 9. BOTONES INFERIORES */}
      <div className="absolute bottom-8 right-8 z-50 flex gap-2 pointer-events-auto">
        <button onClick={() => graphRef.current?.zoomToFit(400)}
          className="bg-slate-900/80 backdrop-blur p-3 rounded-full text-white hover:bg-orange-600 transition shadow-lg border border-white/10" title="Zoom para ver todo">
          <Maximize size={20}/>
        </button>
        <button onClick={() => window.location.reload()}
          className="bg-slate-900/80 backdrop-blur p-3 rounded-full text-white hover:bg-orange-600 transition shadow-lg border border-white/10" title="Recargar datos">
          <RefreshCw size={20}/>
        </button>
      </div>
    </div>
  );
}