'use client';
import { useState, useEffect, useRef, useMemo, useCallback, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import * as THREE from 'three';
import {
  Network, RefreshCw, Maximize, MapPin, Layers,
  Clapperboard, Focus, Zap, Wind, Mountain,
} from 'lucide-react';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/* ═══════════════════════════════════════════════════════════════
   CONFIGURACIÓN GLOBAL
═══════════════════════════════════════════════════════════════ */

const CIUDAD_CONFIG: Record<string, { y: number; color: string; label: string }> = {
  'Río Grande': { y:  550, color: '#f97316', label: 'RÍO GRANDE' },
  'Rio Grande': { y:  550, color: '#f97316', label: 'RÍO GRANDE' },
  'Tolhuin':    { y:    0, color: '#a78bfa', label: 'TOLHUIN'    },
  'Ushuaia':    { y: -550, color: '#38bdf8', label: 'USHUAIA'    },
};

// Radios orbitales por tipo (3D y 2D)
const ORBIT_RADIUS_3D = { locacion: 80,  proyecto: 150, prestador: 230 };
const ORBIT_SPEED_3D  = { locacion: 0.009, proyecto: 0.006, prestador: 0.003 };
const ORBIT_RADIUS_2D = { locacion: 48,  proyecto: 82,  prestador: 118 };
const ORBIT_SPEED_2D  = { locacion: 0.012, proyecto: 0.007, prestador: 0.004 };

function normalizarCiudad(ciudad?: string): string {
  if (!ciudad) return 'Ushuaia';
  const l = ciudad.toLowerCase();
  if (l.includes('grande')) return 'Río Grande';
  if (l.includes('tolhuin')) return 'Tolhuin';
  return 'Ushuaia';
}

function getSubtipo(prest: any): string {
  const raw = (prest.tipoPerfil || prest.tipoPrestador || prest.tipo || '').toLowerCase();
  if (raw.includes('productora')) return 'productora audiovisual';
  if (raw.includes('empresa'))    return 'empresa';
  if (raw.includes('estudiante')) return 'estudiante';
  return 'profesional';
}

/* ═══════════════════════════════════════════════════════════════
   SHADER IFRAME
═══════════════════════════════════════════════════════════════ */
const SHADER_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:#000}canvas{display:block;width:100%;height:100%}</style>
</head><body><canvas id="c"></canvas><script>
const canvas=document.getElementById('c');
const gl=canvas.getContext('webgl2',{preserveDrawingBuffer:true});
if(!gl)throw new Error('No WebGL2');
let targetSpeed=1.0,targetDist=0.0,curSpeed=1.0,curDist=0.0;
const LERP=0.03;
window.addEventListener('message',e=>{if(e.data&&e.data.type==='SHADER_CTRL'){if(e.data.speed!==undefined)targetSpeed=e.data.speed;if(e.data.distortion!==undefined)targetDist=e.data.distortion;}});
const VS=\`#version 300 es\nin vec2 a_position;\nvoid main(){gl_Position=vec4(a_position,0.0,1.0);}\`;
const FS=\`#version 300 es\nprecision highp float;\nout vec4 fragColor;\nuniform vec2 u_resolution;\nuniform float u_time;\nuniform float u_speed;\nuniform float u_distortion;\nvoid main(){\nfloat t=u_time*u_speed;\nfragColor=vec4(0.0);\nfor(float z,d,i;i++<2e1;){\nvec3 p=z*normalize(gl_FragCoord.rgb*2.0-vec3(u_resolution,1.0).xyx);\np=vec3(atan(p.y/0.2,p.x)*2.0,p.z/3.0,length(p.xy)-5.0-z*0.2);\nfloat de=clamp(abs(u_distortion),0.0,5.0);\nfor(d=1.0;d<7.0+de;d++)p+=sin(p.yzx*d*(1.0+u_distortion*0.1)+t+0.3*i)/d;\nif(u_distortion<0.0){float a=t*0.05;p.xy=vec2(p.x*cos(a)-p.y*sin(a),p.x*sin(a)+p.y*cos(a));}\nz+=d=length(vec4(0.4*cos(p)-0.4,p.z));\nfragColor+=(cos(p.x+i*0.4+z+vec4(6,1,2,0))+1.0)/d;}\nfragColor=tanh(fragColor*fragColor/1.4e3);}\`;
function compile(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.error(gl.getShaderInfoLog(s));return null;}return s;}
const prog=gl.createProgram();
gl.attachShader(prog,compile(gl.VERTEX_SHADER,VS));
gl.attachShader(prog,compile(gl.FRAGMENT_SHADER,FS));
gl.linkProgram(prog);
const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
const aPos=gl.getAttribLocation(prog,'a_position');
gl.useProgram(prog);gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,0,0);
const loc={res:gl.getUniformLocation(prog,'u_resolution'),time:gl.getUniformLocation(prog,'u_time'),spd:gl.getUniformLocation(prog,'u_speed'),dist:gl.getUniformLocation(prog,'u_distortion')};
function resize(){const dpr=window.devicePixelRatio||1;canvas.width=Math.round(canvas.clientWidth*dpr);canvas.height=Math.round(canvas.clientHeight*dpr);}
window.addEventListener('resize',resize);resize();
const start=performance.now();
(function loop(now){requestAnimationFrame(loop);curSpeed+=(targetSpeed-curSpeed)*LERP;curDist+=(targetDist-curDist)*LERP;resize();const t=(now-start)/1000;gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(loc.res,canvas.width,canvas.height);gl.uniform1f(loc.time,t);gl.uniform1f(loc.spd,curSpeed);gl.uniform1f(loc.dist,curDist);gl.drawArrays(gl.TRIANGLES,0,6);})(performance.now());
<\/script></body></html>`;

/* ═══════════════════════════════════════════════════════════════
   TV OVERLAY + ONDAS
═══════════════════════════════════════════════════════════════ */
const TVOverlay = () => (
  <div className="absolute inset-0 pointer-events-none z-10">
    <div className="absolute inset-0" style={{
      background:'linear-gradient(rgba(0,0,0,0) 50%,rgba(0,0,0,0.45) 50%),linear-gradient(90deg,rgba(255,0,0,0.04),rgba(0,255,0,0.015),rgba(0,0,255,0.04))',
      backgroundSize:'100% 3px,3px 100%',opacity:0.85,
    }}/>
    <div className="absolute inset-0" style={{background:'radial-gradient(circle,rgba(0,0,0,0.1) 0%,rgba(0,0,0,0.55) 55%,rgba(0,0,0,0.92) 100%)'}}/>
    <div className="absolute inset-0 bg-black/35"/>
  </div>
);

const WAVE_COLORS = [
  'rgba(249,115,22,','rgba(239,68,68,','rgba(59,130,246,',
  'rgba(168,85,247,','rgba(16,185,129,','rgba(234,179,8,','rgba(251,191,36,',
];
interface Wave { id: number; color: string; startTime: number; }

const WaveOverlay = ({ waves }: { waves: Wave[] }) => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{zIndex:5}}>
    <style>{`@keyframes waveExpand{0%{width:10px;height:10px;opacity:1}30%{opacity:0.8}100%{width:180vmax;height:180vmax;opacity:0}}`}</style>
    {waves.map(w => (
      <div key={w.id} className="absolute" style={{
        left:'50%',top:'50%',transform:'translate(-50%,-50%)',
        width:'10px',height:'10px',borderRadius:'50%',
        border:`2px solid ${w.color}0.8)`,
        boxShadow:`0 0 20px ${w.color}0.4),0 0 60px ${w.color}0.2)`,
        animation:'waveExpand 4s ease-out forwards',
        marginLeft:`${(w.id%7-3)*8}px`,marginTop:`${(w.id%5-2)*8}px`,
      }}/>
    ))}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   HUD SHADER
═══════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════
   NODO 3D — orbital, emissive, sin ancla visible
═══════════════════════════════════════════════════════════════ */
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

  // Ciudad: completamente invisible en 3D (solo ancla de física)
  if (node.type === 'ciudad') return group;

  const type   = node.type === 'prestador' ? (node.subTipo?.toLowerCase() || 'profesional') : node.type;
  const hex    = NODE_HEX[type] ?? NODE_HEX.profesional;
  const color  = new THREE.Color(hex);
  const radius = node.type === 'proyecto' ? 7 : node.type === 'locacion' ? 5 : 4;

  // Núcleo emissive
  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(radius, 20, 20),
    new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 2.0,
      roughness: 0.1, metalness: 0.5,
      transparent: true, opacity: 0.95,
    })
  ));
  // Halo aditivo
  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(radius * 2.4, 12, 12),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.1,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  ));
  group.add(new THREE.PointLight(hex, 1.0, radius * 14));
  return group;
}

/* ═══════════════════════════════════════════════════════════════
   TOOLTIP
═══════════════════════════════════════════════════════════════ */
interface TooltipData {
  name: string; type: string; subTipo?: string;
  ciudad?: string; categoria?: string; tipo?: string;
}
const NodeTooltip = ({ node }: { node: TooltipData }) => {
  const typeLabel   = node.type === 'locacion' ? 'Locación' : node.type === 'proyecto' ? 'Proyecto' : 'Prestador';
  const accentColor = node.type === 'locacion' ? 'text-slate-300' : node.type === 'proyecto' ? 'text-red-400' : 'text-blue-400';
  const subinfo     = node.type === 'locacion' ? node.categoria : node.type === 'proyecto' ? node.tipo : node.subTipo;
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

/* ═══════════════════════════════════════════════════════════════
   VERSIÓN 2D — Canvas orbital para mobile / low-end
═══════════════════════════════════════════════════════════════ */
const CITY_FRACTIONS: Record<string, number> = {
  'Río Grande': 0.17,
  'Rio Grande': 0.17,
  'Tolhuin':    0.50,
  'Ushuaia':    0.83,
};

const NODE_COLOR_2D: Record<string, string> = {
  locacion:                '#f1f5f9',
  proyecto:                '#ef4444',
  profesional:             '#3b82f6',
  'productora audiovisual':'#a855f7',
  productora:              '#a855f7',
  empresa:                 '#eab308',
  estudiante:              '#10b981',
};

interface Node2D {
  id: string; type: string; subTipo?: string;
  ciudad: string; name?: string;
  _angle: number; _tilt: number;
}

function NeuralCanvas2D({
  nodes,
  visibleLayers,
  onNodeClick,
}: {
  nodes: Node2D[];
  visibleLayers: { prestador: boolean; proyecto: boolean; locacion: boolean };
  onNodeClick?: (node: Node2D) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const nodesRef  = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onNodeClick) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
    const cx = canvas.width / 2;
    const W  = canvas.width; const H = canvas.height;
    const scale = W / 420;

    for (const node of nodesRef.current) {
      const ciudad = normalizarCiudad(node.ciudad);
      const cy = H * (CITY_FRACTIONS[ciudad] ?? 0.5);
      const ro = ORBIT_RADIUS_2D[node.type as keyof typeof ORBIT_RADIUS_2D] ?? 80;
      const nx = cx + Math.cos(node._angle) * ro * scale;
      const ny = cy + Math.sin(node._angle) * ro * scale * 0.35;
      const nr = (node.type === 'proyecto' ? 7 : node.type === 'locacion' ? 5 : 4) * scale;
      if (Math.hypot(mx - nx, my - ny) < nr * 2.5) { onNodeClick(node); return; }
    }
  }, [onNodeClick]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);

    const loop = () => {
      const W = canvas.width; const H = canvas.height; const cx = W / 2;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#000010'; ctx.fillRect(0, 0, W, H);
      const scale = W / 420;

      const ciudades = ['Río Grande', 'Tolhuin', 'Ushuaia'];
      ciudades.forEach(ciudad => {
        const cy = H * (CITY_FRACTIONS[ciudad] ?? 0.5);
        const cityColor = CIUDAD_CONFIG[ciudad]?.color ?? '#ffffff';
        const rC = Math.min(W, H) * 0.055;

        // Anillos guía
        const tipos: Array<keyof typeof ORBIT_RADIUS_2D> = ['locacion', 'proyecto', 'prestador'];
        tipos.forEach(tipo => {
          const ro = ORBIT_RADIUS_2D[tipo] * scale;
          ctx.beginPath(); ctx.arc(cx, cy, ro, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffffff0a'; ctx.lineWidth = 0.5; ctx.stroke();
        });

        // Halo ciudad
        const grad = ctx.createRadialGradient(cx, cy, rC * 0.2, cx, cy, rC * 2.5);
        grad.addColorStop(0, cityColor + '30'); grad.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(cx, cy, rC * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.fill();

        // Esfera ciudad visible
        ctx.beginPath(); ctx.arc(cx, cy, rC, 0, Math.PI * 2);
        ctx.strokeStyle = cityColor + 'bb'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle   = cityColor + '15'; ctx.fill();

        // Label ciudad
        ctx.font = `bold ${Math.round(rC * 0.6)}px system-ui,sans-serif`;
        ctx.fillStyle = cityColor + 'cc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(ciudad.toUpperCase(), cx, cy);

        // Nodos orbitando
        nodesRef.current
          .filter(n => {
            const nc = normalizarCiudad(n.ciudad);
            return nc === ciudad && visibleLayers[n.type as keyof typeof visibleLayers];
          })
          .forEach(n => {
            const tipo = n.type as keyof typeof ORBIT_RADIUS_2D;
            n._angle += ORBIT_SPEED_2D[tipo] ?? 0.005;
            const ro = ORBIT_RADIUS_2D[tipo] ?? 80;
            const nx = cx + Math.cos(n._angle) * ro * scale;
            const ny = cy + Math.sin(n._angle) * ro * scale * 0.35;
            const subTipo   = n.subTipo ?? n.type;
            const nodeColor = NODE_COLOR_2D[subTipo] ?? '#ffffff';
            const nr = (n.type === 'proyecto' ? 5 : n.type === 'locacion' ? 3.5 : 3) * scale;

            // Halo nodo
            const gn = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr * 3.5);
            gn.addColorStop(0, nodeColor + '60'); gn.addColorStop(1, 'transparent');
            ctx.beginPath(); ctx.arc(nx, ny, nr * 3.5, 0, Math.PI * 2);
            ctx.fillStyle = gn; ctx.fill();

            // Punto
            ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2);
            ctx.fillStyle = nodeColor; ctx.fill();
          });
      });

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); };
  }, [visibleLayers]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block', cursor: 'pointer' }}
      onClick={handleClick}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   PANEL IZQUIERDO — compartido entre 3D y 2D
═══════════════════════════════════════════════════════════════ */
function LeftPanel({
  loading, stats, visibleLayers, toggleLayer, resetCamera, isMobile,
}: {
  loading: boolean;
  stats: { locaciones: number; proyectos: number; prestadores: number };
  visibleLayers: { prestador: boolean; proyecto: boolean; locacion: boolean };
  toggleLayer: (l: 'prestador' | 'proyecto' | 'locacion') => void;
  resetCamera: () => void;
  isMobile: boolean;
}) {
  return (
    <div className={`absolute left-3 z-50 pointer-events-none select-none ${isMobile ? 'top-3 w-[calc(100vw-24px)] max-w-xs' : 'top-1/2 -translate-y-1/2'}`}>
      <div className="bg-slate-950/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.8)] pointer-events-auto overflow-hidden flex flex-col w-72">

        {/* Header */}
        <div className="p-4 border-b border-white/5 bg-gradient-to-r from-slate-900/90 to-transparent">
          <h1 className="text-lg font-black text-white flex items-center gap-3 tracking-tight">
            <div className="bg-orange-500/10 p-2 rounded-lg border border-orange-500/30 text-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.2)]">
              <Network size={18}/>
            </div>
            NODOS TDF
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"/>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"/>
            </span>
            <span className="text-[10px] font-bold text-emerald-500 tracking-widest uppercase">Sistema Online</span>
          </div>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="px-4 py-3 grid grid-cols-3 gap-2 border-b border-white/5 bg-black/20">
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

        <div className="p-4 space-y-3">

          {/* Capa prestadores */}
          <div
            onClick={() => toggleLayer('prestador')}
            className={`cursor-pointer transition-all duration-300 p-3 rounded-xl border border-white/5 ${visibleLayers.prestador ? 'bg-white/5 opacity-100' : 'bg-white/5 opacity-40 grayscale'}`}
          >
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
              <Layers size={9}/> Capa 3 · Talento {visibleLayers.prestador ? '(ON)':'(OFF)'}
            </p>
            <div className="grid grid-cols-2 gap-y-2 gap-x-2">
              {([
                { key:'profesional',              label:'Profesional', color:'#3b82f6' },
                { key:'productora audiovisual',    label:'Productora',  color:'#a855f7' },
                { key:'empresa',                  label:'Empresa',     color:'#eab308' },
                { key:'estudiante',               label:'Estudiante',  color:'#10b981' },
              ] as const).map(({ key, label, color }) => (
                <div key={key} className="flex items-center justify-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:color, boxShadow:`0 0 5px ${color}`}}/>
                  <span className="text-[9px] font-bold text-slate-300">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Capa proyectos */}
          <div
            onClick={() => toggleLayer('proyecto')}
            className={`flex items-center justify-between p-3 rounded-xl border border-white/5 cursor-pointer transition-all duration-300 ${visibleLayers.proyecto ? 'bg-white/5 opacity-100' : 'bg-white/5 opacity-40 grayscale'}`}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-slate-900 flex items-center justify-center text-red-500 border border-red-500/30"><Clapperboard size={13}/></div>
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
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-slate-900 flex items-center justify-center text-slate-200 border border-slate-500/30"><Mountain size={13}/></div>
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
            className="w-full py-2.5 rounded-xl text-xs font-bold transition-all bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white shadow-lg shadow-orange-900/30 flex items-center justify-center gap-2 group border border-white/10">
            <Focus size={14} className="group-hover:scale-110 transition-transform"/>
            RECENTRAR VISTA MAPA
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MARCAS DE AGUA CIUDAD (lado derecho)
═══════════════════════════════════════════════════════════════ */
const CityWatermarks = () => (
  <div className="absolute right-10 top-1/2 -translate-y-1/2 flex flex-col justify-between h-[65%] pointer-events-none select-none text-right z-20 opacity-70">
    <div>
      <span className="block text-xs font-bold text-orange-500 tracking-[0.5em] mb-1 opacity-60">NORTE</span>
      <div className="text-white font-black text-6xl opacity-20 tracking-tighter leading-none">RIO<br/>GRANDE</div>
    </div>
    <div>
      <div className="text-white font-black text-6xl opacity-20 tracking-tighter leading-none">TOLHUIN</div>
    </div>
    <div>
      <span className="block text-xs font-bold text-blue-500 tracking-[0.5em] mb-1 opacity-60">SUR</span>
      <div className="text-white font-black text-6xl opacity-20 tracking-tighter leading-none">USHUAIA</div>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   TOOLTIP 2D MOBILE
═══════════════════════════════════════════════════════════════ */
function MobileTooltip({ node, onClose }: { node: TooltipData | null; onClose: () => void }) {
  if (!node) return null;
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50" onClick={onClose}>
      <NodeTooltip node={node}/>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════════════════════════ */
export default function AdminDashboardPage() {
  const graphRef        = useRef<any>();
  const iframeRef       = useRef<HTMLIFrameElement>(null);
  const waveCounterRef  = useRef(0);
  const speedRef        = useRef(1.0);
  const distortionRef   = useRef(0.0);
  const boostRef        = useRef(0);

  const [loading, setLoading]             = useState(true);
  const [graphData, setGraphData]         = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [waves, setWaves]                 = useState<Wave[]>([]);
  const [visibleLayers, setVisibleLayers] = useState({ prestador: true, proyecto: true, locacion: true });
  const [speed, setSpeed]                 = useState(1.0);
  const [distortion, setDistortion]       = useState(0.0);
  const [hoveredNode, setHoveredNode]     = useState<TooltipData | null>(null);
  const [tooltipPos, setTooltipPos]       = useState({ x: 0, y: 0 });
  const [mobileTooltip, setMobileTooltip] = useState<TooltipData | null>(null);
  const [stats, setStats]                 = useState({ locaciones: 0, proyectos: 0, prestadores: 0 });
  const [isMobile, setIsMobile]           = useState(false);
  // Solo renderizar iframe en cliente (mismo HTML en server y primer paint del client = sin hydration mismatch)
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  // ── Detector mobile ────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── Carga de datos ─────────────────────────────────────────
  useEffect(() => {
    const buildGraph = async () => {
      try {
        const [resLoc, resProj, resPrest] = await Promise.all([
          fetch(`${API}/locacion`).then(r => r.json()),
          fetch(`${API}/proyecto`).then(r => r.json()),
          fetch(`${API}/prestador`).then(r => r.json()),
        ]);
        const nodes: any[] = [];
        const links: any[] = [];

        // Anclas ciudad (invisibles en 3D)
        ['Río Grande', 'Tolhuin', 'Ushuaia'].forEach(ciudad => {
          const cfg = CIUDAD_CONFIG[ciudad]!;
          nodes.push({ id:`ciudad_${ciudad}`, name:cfg.label, type:'ciudad', ciudad, fx:0, fy:cfg.y, fz:0, val:1 });
        });

        // Locaciones
        resLoc.forEach((loc: any) => {
          const ciudad = normalizarCiudad(loc.ciudad);
          const cfg    = CIUDAD_CONFIG[ciudad] ?? CIUDAD_CONFIG['Ushuaia'];
          nodes.push({
            id:`loc_${loc.id}`, name:loc.nombre, type:'locacion', ciudad,
            categoria:loc.categoria, foto:loc.foto,
            _angle: Math.random() * Math.PI * 2, _tilt: (Math.random() - 0.5) * 0.4,
            x:(Math.random()-0.5)*60, y:cfg.y+(Math.random()-0.5)*60, z:0, val:4,
          });
        });

        // Proyectos
        resProj.forEach((proj: any) => {
          const ciudad = normalizarCiudad(proj.ciudad);
          const cfg    = CIUDAD_CONFIG[ciudad] ?? CIUDAD_CONFIG['Ushuaia'];
          nodes.push({
            id:`proj_${proj.id}`, name:proj.titulo, type:'proyecto', ciudad,
            tipo:proj.tipo, foto:proj.foto,
            _angle: Math.random() * Math.PI * 2, _tilt: (Math.random() - 0.5) * 0.4,
            x:(Math.random()-0.5)*60, y:cfg.y+(Math.random()-0.5)*60, z:60, val:12,
          });
          const loc = nodes.find(n => n.type==='locacion' && n.ciudad===ciudad);
          if (loc) links.push({ source:`proj_${proj.id}`, target:loc.id });
        });

        // Prestadores
        resPrest.forEach((prest: any) => {
          const ciudad  = normalizarCiudad(prest.ciudad);
          const cfg     = CIUDAD_CONFIG[ciudad] ?? CIUDAD_CONFIG['Ushuaia'];
          const subTipo = getSubtipo(prest);
          nodes.push({
            id:`prest_${prest.id}`, name:prest.nombre, type:'prestador', subTipo, ciudad,
            foto:prest.foto||prest.avatar,
            _angle: Math.random() * Math.PI * 2, _tilt: (Math.random() - 0.5) * 0.4,
            x:(Math.random()-0.5)*70, y:cfg.y+(Math.random()-0.5)*70, z:120, val:6,
          });
          if (Math.random() > 0.55) {
            const pool = (Math.random() < 0.8
              ? nodes.filter(n => n.type==='proyecto' && n.ciudad===ciudad)
              : nodes.filter(n => n.type==='proyecto' && n.ciudad!==ciudad));
            if (pool.length > 0) links.push({ source:`prest_${prest.id}`, target:pool[Math.floor(Math.random()*pool.length)].id });
          }
        });

        setStats({ locaciones:resLoc.length, proyectos:resProj.length, prestadores:resPrest.length });
        setGraphData({ nodes, links });
        setLoading(false);
      } catch (err) {
        console.error('Backend no disponible, usando mock:', err);
        buildMock();
      }
    };

    const buildMock = () => {
      const nodes: any[] = [], links: any[] = [];
      const ciudades = ['Río Grande', 'Tolhuin', 'Ushuaia'];
      ciudades.forEach(ciudad => {
        const cfg = CIUDAD_CONFIG[ciudad]!;
        nodes.push({ id:`ciudad_${ciudad}`, name:cfg.label, type:'ciudad', ciudad, fx:0, fy:cfg.y, fz:0, val:1 });
      });
      for (let i=1;i<=20;i++){
        const c=ciudades[Math.floor(Math.random()*ciudades.length)];
        const cfg=CIUDAD_CONFIG[c]!;
        nodes.push({ id:`loc${i}`, name:`Locación ${i}`, type:'locacion', ciudad:c, categoria:'Paisaje Natural',
          _angle:Math.random()*Math.PI*2, _tilt:(Math.random()-0.5)*0.4,
          x:(Math.random()-0.5)*60, y:cfg.y+(Math.random()-0.5)*60, z:0, val:4 });
      }
      for (let i=1;i<=15;i++){
        const c=ciudades[Math.floor(Math.random()*ciudades.length)];
        const cfg=CIUDAD_CONFIG[c]!;
        nodes.push({ id:`proj${i}`, name:`Proyecto ${i}`, type:'proyecto', ciudad:c, tipo:'Cortometraje',
          _angle:Math.random()*Math.PI*2, _tilt:(Math.random()-0.5)*0.4,
          x:(Math.random()-0.5)*60, y:cfg.y+(Math.random()-0.5)*60, z:60, val:12 });
        const loc=nodes.find(n=>n.type==='locacion'&&n.ciudad===c);
        if(loc) links.push({source:`proj${i}`,target:loc.id});
      }
      const tipos=['profesional','productora audiovisual','empresa','estudiante'];
      for (let i=1;i<=40;i++){
        const c=ciudades[Math.floor(Math.random()*ciudades.length)];
        const cfg=CIUDAD_CONFIG[c]!;
        const sub=tipos[Math.floor(Math.random()*tipos.length)];
        nodes.push({ id:`prest${i}`, name:`Prestador ${i}`, type:'prestador', subTipo:sub, ciudad:c,
          _angle:Math.random()*Math.PI*2, _tilt:(Math.random()-0.5)*0.4,
          x:(Math.random()-0.5)*70, y:cfg.y+(Math.random()-0.5)*70, z:120, val:6 });
        if(Math.random()>0.55){
          const pool=Math.random()<0.8
            ?nodes.filter(n=>n.type==='proyecto'&&n.ciudad===c)
            :nodes.filter(n=>n.type==='proyecto'&&n.ciudad!==c);
          if(pool.length>0) links.push({source:`prest${i}`,target:pool[Math.floor(Math.random()*pool.length)].id});
        }
      }
      setStats({locaciones:20,proyectos:15,prestadores:40});
      setGraphData({nodes,links});
      setLoading(false);
    };

    buildGraph();
  }, []);

  // ── Filtro capas (ciudad siempre presente) ──────────────────
  const filteredGraphData = useMemo(() => {
    const an = graphData.nodes.filter((n: any) =>
      n.type === 'ciudad' || visibleLayers[n.type as keyof typeof visibleLayers]
    );
    const ids = new Set(an.map((n: any) => n.id));
    const al  = graphData.links.filter((l: any) => {
      const s = typeof l.source==='object' ? l.source.id : l.source;
      const t = typeof l.target==='object' ? l.target.id : l.target;
      return ids.has(s) && ids.has(t);
    });
    return { nodes: an, links: al };
  }, [graphData, visibleLayers]);

  // Nodos 2D (sin anclas)
  const nodes2D = useMemo(
    () => filteredGraphData.nodes.filter(n => n.type !== 'ciudad') as Node2D[],
    [filteredGraphData]
  );

  // ── Shader control ──────────────────────────────────────────
  const sendShaderCtrl = useCallback((s: number, d: number) => {
    iframeRef.current?.contentWindow?.postMessage({ type:'SHADER_CTRL', speed:s, distortion:d }, '*');
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag==='INPUT'||tag==='TEXTAREA') return;
      let moved = false;
      if      (e.key==='ArrowUp')    { speedRef.current=Math.min(4.0,+(speedRef.current+0.15).toFixed(2));setSpeed(speedRef.current);moved=true; }
      else if (e.key==='ArrowDown')  { speedRef.current=Math.max(0.1,+(speedRef.current-0.15).toFixed(2));setSpeed(speedRef.current);moved=true; }
      else if (e.key==='ArrowRight') { distortionRef.current=Math.min(5.0,+(distortionRef.current+0.5).toFixed(1));setDistortion(distortionRef.current);moved=true; }
      else if (e.key==='ArrowLeft')  { distortionRef.current=Math.max(-5.0,+(distortionRef.current-0.5).toFixed(1));setDistortion(distortionRef.current);moved=true; }
      if (moved) { e.preventDefault(); sendShaderCtrl(speedRef.current, distortionRef.current); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sendShaderCtrl]);

  // ── Reset camera + wave + boost ────────────────────────────
  const resetCamera = useCallback(() => {
    graphRef.current?.cameraPosition({ x:0, y:0, z:1500 }, { x:0, y:0, z:0 }, 1800);
    boostRef.current = performance.now() + 2000;
    const id = ++waveCounterRef.current;
    setWaves(prev => [...prev.slice(-8), { id, color:WAVE_COLORS[id%WAVE_COLORS.length], startTime:performance.now() }]);
  }, []);

  useEffect(() => { if (!loading) setTimeout(resetCamera, 200); }, [loading]);

  useEffect(() => {
    const iv = setInterval(() => setWaves(prev => prev.filter(w => performance.now()-w.startTime < 4100)), 1000);
    return () => clearInterval(iv);
  }, []);

  const toggleLayer = (l: keyof typeof visibleLayers) =>
    setVisibleLayers(prev => ({ ...prev, [l]: !prev[l] }));

  // ── Hover tooltip 3D ───────────────────────────────────────
  const handleNodeHover = useCallback((node: any) => {
    if (!node || node.type==='ciudad') { setHoveredNode(null); return; }
    setHoveredNode({ name:node.name, type:node.type, subTipo:node.subTipo, ciudad:node.ciudad, categoria:node.categoria, tipo:node.tipo });
  }, []);

  // ── onEngineTick: órbita real alrededor del ancla ──────────
  const handleEngineTick = useCallback(() => {
    const now = performance.now();
    const boosting = now < boostRef.current;

    // Mapa de posiciones de anclas
    const anclas: Record<string, { x:number; y:number; z:number }> = {};
    filteredGraphData.nodes.forEach((d: any) => {
      if (d.type === 'ciudad') anclas[d.ciudad] = { x:d.x??0, y:d.y??0, z:d.z??0 };
    });

    filteredGraphData.nodes.forEach((d: any) => {
      if (d.type === 'ciudad') return;

      const ancla = anclas[d.ciudad];
      if (!ancla) return;

      const tipo = d.type as keyof typeof ORBIT_RADIUS_3D;
      const R    = ORBIT_RADIUS_3D[tipo] ?? 150;
      const spd  = ORBIT_SPEED_3D[tipo] ?? 0.005;

      if (d._angle === undefined) d._angle = Math.random() * Math.PI * 2;
      if (d._tilt  === undefined) d._tilt  = (Math.random() - 0.5) * 0.4;

      if (boosting) {
        // Durante boost: converger hacia la ancla rápido
        const dx = ancla.x - (d.x??0);
        const dy = ancla.y - (d.y??0);
        const dz = ancla.z - (d.z??0);
        d.vx = ((d.vx??0) + dx * 0.22) * 0.78;
        d.vy = ((d.vy??0) + dy * 0.22) * 0.78;
        d.vz = ((d.vz??0) + dz * 0.22) * 0.78;
        // Actualizar ángulo para que la órbita retome bien
        d._angle = Math.atan2(d.z??0, d.x??0);
      } else {
        // Órbita estable alrededor del ancla
        d._angle += spd;
        const tx = ancla.x + Math.cos(d._angle) * R;
        const ty = ancla.y + Math.sin(d._angle) * R * d._tilt;
        const tz = ancla.z + Math.sin(d._angle) * R;
        d.vx = ((d.vx??0) + (tx - (d.x??0)) * 0.08) * 0.88;
        d.vy = ((d.vy??0) + (ty - (d.y??0)) * 0.08) * 0.88;
        d.vz = ((d.vz??0) + (tz - (d.z??0)) * 0.08) * 0.88;
      }

      const maxV = boosting ? 10 : 5;
      if (Math.abs(d.vx)>maxV) d.vx=Math.sign(d.vx)*maxV;
      if (Math.abs(d.vy)>maxV) d.vy=Math.sign(d.vy)*maxV;
      if (Math.abs(d.vz)>maxV) d.vz=Math.sign(d.vz)*maxV;
    });
  }, [filteredGraphData]);

  /* ───────────────────────────────────────────────────────────
     RENDER
  ─────────────────────────────────────────────────────────── */
  return (
    <div
      className="h-screen w-full relative overflow-hidden bg-slate-950"
      onMouseMove={e => setTooltipPos({ x:e.clientX+16, y:e.clientY-8 })}
    >
      {/* 1. SHADER DE FONDO (solo en cliente para evitar hydration mismatch) */}
      {mounted ? (
        <iframe
          ref={iframeRef}
          srcDoc={SHADER_HTML}
          className="absolute inset-0 w-full h-full"
          style={{ zIndex:0, border:'none', pointerEvents:'none' }}
          title="shader-bg"
          sandbox="allow-scripts"
        />
      ) : (
        <div
          className="absolute inset-0 w-full h-full bg-black"
          style={{ zIndex:0 }}
          aria-hidden
        />
      )}

      {/* 2. ONDAS */}
      <WaveOverlay waves={waves}/>

      {/* 3. FILTRO TV */}
      <TVOverlay/>

      {/* 4. PANEL IZQUIERDO */}
      <LeftPanel
        loading={loading}
        stats={stats}
        visibleLayers={visibleLayers}
        toggleLayer={toggleLayer}
        resetCamera={resetCamera}
        isMobile={isMobile}
      />

      {/* 5. HUD SHADER (solo desktop) */}
      {!isMobile && <ShaderHUD speed={speed} distortion={distortion}/>}

      {/* 6. TOOLTIP HOVER (solo desktop) */}
      {!isMobile && hoveredNode && (
        <div className="fixed z-50 pointer-events-none" style={{ left:tooltipPos.x, top:tooltipPos.y }}>
          <NodeTooltip node={hoveredNode}/>
        </div>
      )}

      {/* 7A. GRAFO 3D — Desktop */}
      {!isMobile && (
        <div className="absolute inset-0 cursor-move z-20">
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
                if (s?.type==='ciudad'||t?.type==='ciudad') return 'rgba(0,0,0,0)';
                return '#ffffff15';
              }}
              linkWidth={(link: any) => {
                const s = typeof link.source==='object' ? link.source : link;
                const t = typeof link.target==='object' ? link.target : link;
                if (s?.type==='ciudad'||t?.type==='ciudad') return 0;
                return 0.3;
              }}
              linkDirectionalParticles={visibleLayers.proyecto && visibleLayers.prestador ? 2 : 0}
              linkDirectionalParticleColor={() => '#fdba74'}
              linkDirectionalParticleWidth={3}
              linkDirectionalParticleResolution={8}
              linkDirectionalParticleSpeed={0.003}
              d3AlphaDecay={1}
              d3VelocityDecay={0.3}
              onEngineTick={handleEngineTick}
            />
          )}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-30">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"/>
                <p className="text-slate-500 text-sm animate-pulse tracking-widest uppercase">Conectando con la base de datos</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7B. CANVAS 2D — Mobile */}
      {isMobile && !loading && (
        <div className="absolute inset-0 z-20">
          <NeuralCanvas2D
            nodes={nodes2D}
            visibleLayers={visibleLayers}
            onNodeClick={n => setMobileTooltip({ name:n.name??'', type:n.type, subTipo:n.subTipo, ciudad:n.ciudad })}
          />
          <MobileTooltip node={mobileTooltip} onClose={() => setMobileTooltip(null)}/>
        </div>
      )}
      {isMobile && loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-500"/>
            <p className="text-slate-500 text-sm animate-pulse tracking-widest uppercase">Conectando red...</p>
          </div>
        </div>
      )}

      {/* 8. MARCAS DE AGUA (solo desktop) */}
      {!isMobile && <CityWatermarks/>}

      {/* 9. BOTONES INFERIORES (solo desktop) */}
      {!isMobile && (
        <div className="absolute bottom-8 right-8 z-50 flex gap-2">
          <button
            onClick={() => graphRef.current?.zoomToFit(400)}
            className="bg-slate-900/80 backdrop-blur p-3 rounded-full text-white hover:bg-orange-600 transition shadow-lg border border-white/10"
            title="Zoom para ver todo"
          ><Maximize size={20}/></button>
          <button
            onClick={() => window.location.reload()}
            className="bg-slate-900/80 backdrop-blur p-3 rounded-full text-white hover:bg-orange-600 transition shadow-lg border border-white/10"
            title="Recargar datos"
          ><RefreshCw size={20}/></button>
        </div>
      )}

    </div>
  );
}