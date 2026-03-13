'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Settings2, X } from 'lucide-react';

// ─── types ────────────────────────────────────────────────────────────────────
interface GravPoint { x: number; y: number; type: 1 | -1; id: number; }
interface Particle {
  x: number; y: number; vx: number; vy: number;
  colorIdx: number; size: number; life: number; maxLife: number;
}

// ─── color helpers ────────────────────────────────────────────────────────────
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h=0, s=0; const l=(max+min)/2;
  if (max!==min) {
    const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min);
    switch(max){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;case b:h=((r-g)/d+4)/6;break;}
  }
  return [h*360,s*100,l*100];
}
function hue2rgb(p:number,q:number,t:number):number{
  if(t<0)t+=1;if(t>1)t-=1;
  if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;
}
function hslToHex(h:number,s:number,l:number):string{
  h/=360;s/=100;l/=100;let r:number,g:number,b:number;
  if(s===0){r=g=b=l;}else{const q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q;r=hue2rgb(p,q,h+1/3);g=hue2rgb(p,q,h);b=hue2rgb(p,q,h-1/3);}
  return '#'+[r,g,b].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');
}
function hexToRgb(hex:string):[number,number,number]{
  return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
}
function buildPalette(hex:string):string[]{
  const [h,s,l]=hexToHsl(hex);
  return Array.from({length:10},(_,i)=>hslToHex((h+i*36)%360,s*(0.7+(i%3)*0.15),Math.min(85,l*(0.75+(i%4)*0.1))));
}

// ─── default config ───────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  baseColor: '#aaff00',
  particleCount: 3000,
  speed: 0.4,
  loopDuration: 7.5,
  randomness: 1.0,
  gravStrength: 800,
  maxPoints: 4,
};
const SNAP_R = 18;

// ─── component ────────────────────────────────────────────────────────────────
interface DustSimProps {
  /** En true solo se muestra el canvas (sin botón Debug ni hint); para usar como fondo en otras páginas */
  backgroundOnly?: boolean;
}

export default function DustSim({ backgroundOnly = false }: DustSimProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showDebugButton, setShowDebugButton] = useState(false); // Shift para mostrar/ocultar; por defecto oculto
  const [debugOpen, setDebugOpen] = useState(false);

  const sr = useRef({
    config:     { ...DEFAULT_CONFIG },
    palette:    buildPalette(DEFAULT_CONFIG.baseColor),
    paletteRgb: buildPalette(DEFAULT_CONFIG.baseColor).map(hexToRgb) as [number,number,number][],
    particles:  [] as Particle[],
    gravPoints: [] as GravPoint[],
    nextId:     0,
    W: 0, H: 0,
    pixelRatio: typeof window!=='undefined' ? Math.min(window.devicePixelRatio||1,2) : 1,
    animId:     0,
    lastTime:   0,
    // mode
    usePixelMode: false,
    // perf phase 1: first 5s, detect <10fps → pixel mode
    p1Done:  false,
    p1Start: 0,
    p1Frames:[] as number[],
    // perf phase 2: next 10s, detect <30fps → reduce
    p2Done:  false,
    p2Start: 0,
    p2Frames:[] as number[],
  });

  // ── particle factory ──────────────────────────────────────────────────────
  const newParticle = useCallback(():Particle => {
    const s=sr.current, {W,H,config}=s;
    const base=config.speed*(0.5+Math.random()*0.5), r=config.randomness;
    let x:number,y:number,vx:number,vy:number;
    const side=['left','right','top','bottom'][Math.floor(Math.random()*4)];
    if(side==='left')      {x=-10;    y=H*(0.1+Math.random()*0.8); vx= base*(0.8+r*0.4); vy=(Math.random()-0.5)*base*r*2;}
    else if(side==='right'){x=W+10;   y=H*(0.1+Math.random()*0.8); vx=-base*(0.8+r*0.4); vy=(Math.random()-0.5)*base*r*2;}
    else if(side==='top')  {x=W*Math.random(); y=-10;    vx=(Math.random()-0.5)*base*r*2; vy= base*(0.8+r*0.4);}
    else                   {x=W*Math.random(); y=H+10;   vx=(Math.random()-0.5)*base*r*2; vy=-base*(0.8+r*0.4);}
    return {x,y,vx,vy,colorIdx:Math.floor(Math.random()*s.palette.length),size:0.6+Math.random()*0.9,life:0,maxLife:config.loopDuration*60*(0.6+Math.random()*0.8)};
  },[]);

  const initParticles = useCallback(()=>{
    const s=sr.current; s.particles=[];
    for(let i=0;i<s.config.particleCount;i++){const p=newParticle();p.life=Math.random()*p.maxLife;s.particles.push(p);}
  },[newParticle]);

  // ── canvas setup ──────────────────────────────────────────────────────────
  const setupCanvas = useCallback(()=>{
    const canvas=canvasRef.current; if(!canvas)return;
    const s=sr.current;
    s.W=window.innerWidth; s.H=window.innerHeight;
    canvas.style.width=s.W+'px'; canvas.style.height=s.H+'px';
    canvas.width=Math.floor(s.W*s.pixelRatio); canvas.height=Math.floor(s.H*s.pixelRatio);
    const ctx=canvas.getContext('2d')!; ctx.setTransform(1,0,0,1,0,0); ctx.scale(s.pixelRatio,s.pixelRatio);
  },[]);

  function syncSlider(id:string,valId:string,v:number,dec:number){
    const el=document.getElementById(id) as HTMLInputElement|null;
    const ve=document.getElementById(valId);
    if(el)el.value=String(v); if(ve)ve.textContent=v.toFixed(dec);
  }

  // ── perf monitor ──────────────────────────────────────────────────────────
  const checkPerf = useCallback((now:number)=>{
    const s=sr.current;

    // Phase 1 — first 5 s: if fps < 10 → pixel mode
    if(!s.p1Done){
      if(s.p1Start===0){s.p1Start=now;return;}
      s.p1Frames.push(now);
      const elapsed=(now-s.p1Start)/1000;
      if(elapsed>=5){
        s.p1Done=true;
        const fps=s.p1Frames.length/elapsed;
        if(fps<10){
          s.usePixelMode=true;
          s.config.particleCount=Math.min(s.config.particleCount,1500);
          initParticles();
          syncSlider('ds-particleCount','ds-particleCountVal',s.config.particleCount,0);
        }
        s.p2Start=now; // kick off phase 2 immediately after
      }
      return;
    }

    // Phase 2 — next 10 s: if fps < 30 → reduce further
    if(!s.p2Done){
      if(s.p2Start===0){s.p2Start=now;return;}
      s.p2Frames.push(now);
      const elapsed2=(now-s.p2Start)/1000;
      if(elapsed2>=10){
        s.p2Done=true;
        const recent=s.p2Frames.filter(t=>t>now-5000);
        const fps2=recent.length/5;
        if(fps2<30){
          s.config.particleCount=1500;
          s.pixelRatio=Math.max(0.5,s.pixelRatio*0.6);
          setupCanvas(); initParticles();
          syncSlider('ds-particleCount','ds-particleCountVal',1500,0);
        }
      }
    }
  },[initParticles,setupCanvas]);

  // ── physics step (shared) ─────────────────────────────────────────────────
  function stepParticles(particles:Particle[], gravPoints:GravPoint[], config:typeof DEFAULT_CONFIG, W:number, H:number, dt:number, newP:()=>Particle){
    for(let i=0;i<particles.length;i++){
      const p=particles[i];
      p.life+=dt;
      if(p.life>p.maxLife||p.x<-100||p.x>W+100||p.y<-100||p.y>H+100){particles[i]=newP();continue;}
      for(const gp of gravPoints){
        const dx=gp.x-p.x,dy=gp.y-p.y,dist2=dx*dx+dy*dy,dist=Math.sqrt(dist2)+1;
        const force=(config.gravStrength*gp.type)/(dist2*0.01+dist*2+20);
        p.vx+=(dx/dist)*force*dt*0.016; p.vy+=(dy/dist)*force*dt*0.016;
      }
      const spd=Math.sqrt(p.vx*p.vx+p.vy*p.vy),maxSpd=config.speed*10;
      if(spd>maxSpd){p.vx=(p.vx/spd)*maxSpd;p.vy=(p.vy/spd)*maxSpd;}
      p.x+=p.vx*dt; p.y+=p.vy*dt;
    }
    while(particles.length<config.particleCount)particles.push(newP());
    while(particles.length>config.particleCount)particles.pop();
  }

  // ── circle renderer ───────────────────────────────────────────────────────
  const renderCircle = useCallback((ctx:CanvasRenderingContext2D,dt:number,W:number,H:number)=>{
    const s=sr.current;
    ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.fillRect(0,0,W,H);
    for(const gp of s.gravPoints){
      const fade=gp.type===1?'rgba(255,50,50,':'rgba(50,150,255,';
      const grad=ctx.createRadialGradient(gp.x,gp.y,0,gp.x,gp.y,22);
      grad.addColorStop(0,fade+'0.18)'); grad.addColorStop(1,fade+'0)');
      ctx.beginPath();ctx.arc(gp.x,gp.y,22,0,Math.PI*2);ctx.fillStyle=grad;ctx.fill();
      ctx.beginPath();ctx.arc(gp.x,gp.y,3.5,0,Math.PI*2);ctx.fillStyle=gp.type===1?'#ff3333':'#3399ff';ctx.fill();
    }
    stepParticles(s.particles,s.gravPoints,s.config,W,H,dt,newParticle);
    for(const p of s.particles){
      ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fillStyle=s.palette[p.colorIdx];ctx.fill();
    }
  },[newParticle]);

  // ── pixel renderer ────────────────────────────────────────────────────────
  const renderPixel = useCallback((ctx:CanvasRenderingContext2D,dt:number,W:number,H:number)=>{
    const s=sr.current;
    // fade
    ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.fillRect(0,0,W,H);
    // grav point markers (cross, no arc)
    for(const gp of s.gravPoints){
      ctx.fillStyle=gp.type===1?'#ff3333':'#3399ff';
      ctx.fillRect(gp.x-1,gp.y-5,2,10); ctx.fillRect(gp.x-5,gp.y-1,10,2);
      ctx.fillStyle=gp.type===1?'rgba(255,50,50,0.07)':'rgba(50,150,255,0.07)';
      ctx.fillRect(gp.x-16,gp.y-16,32,32);
    }
    stepParticles(s.particles,s.gravPoints,s.config,W,H,dt,newParticle);
    // write pixels via ImageData
    const imgData=ctx.getImageData(0,0,W,H);
    const data=imgData.data;
    for(const p of s.particles){
      const px=Math.round(p.x),py=Math.round(p.y);
      if(px<0||px>=W||py<0||py>=H)continue;
      const [cr,cg,cb]=s.paletteRgb[p.colorIdx];
      const sz=p.size>1.2?2:1;
      for(let dy2=0;dy2<sz;dy2++)for(let dx2=0;dx2<sz;dx2++){
        const nx=px+dx2,ny=py+dy2;
        if(nx>=W||ny>=H)continue;
        const idx=(ny*W+nx)*4;
        data[idx]=cr;data[idx+1]=cg;data[idx+2]=cb;data[idx+3]=255;
      }
    }
    ctx.putImageData(imgData,0,0);
  },[newParticle]);

  // ── animation loop ────────────────────────────────────────────────────────
  const animate = useCallback((ts:number)=>{
    const canvas=canvasRef.current; if(!canvas)return;
    const ctx=canvas.getContext('2d'); if(!ctx)return;
    const s=sr.current;
    const dt=Math.min((ts-s.lastTime)/16.67,3); s.lastTime=ts;
    checkPerf(ts);
    if(s.usePixelMode) renderPixel(ctx,dt,s.W,s.H);
    else               renderCircle(ctx,dt,s.W,s.H);
    s.animId=requestAnimationFrame(animate);
  },[checkPerf,renderCircle,renderPixel]);

  // ── pointer ───────────────────────────────────────────────────────────────
  const handlePointer = useCallback((e:MouseEvent)=>{
    e.preventDefault();
    const s=sr.current, type:1|-1=e.button===2?-1:1, mx=e.clientX, my=e.clientY;
    const idx=s.gravPoints.findIndex(gp=>gp.type===type&&Math.hypot(gp.x-mx,gp.y-my)<SNAP_R);
    if(idx!==-1){s.gravPoints.splice(idx,1);return;}
    if(s.gravPoints.length>=s.config.maxPoints)s.gravPoints.shift();
    s.gravPoints.push({x:mx,y:my,type,id:s.nextId++});
  },[]);

  // ── mount ─────────────────────────────────────────────────────────────────
  useEffect(()=>{
    setupCanvas(); initParticles();
    const canvas=canvasRef.current!;
    canvas.addEventListener('click',handlePointer);
    canvas.addEventListener('contextmenu',handlePointer);
    const onKey=(e:KeyboardEvent)=>{if(!backgroundOnly&&e.key==='Shift')setShowDebugButton((v)=>!v);};
    document.addEventListener('keydown',onKey);
    window.addEventListener('resize',setupCanvas);
    sr.current.animId=requestAnimationFrame(animate);
    return()=>{
      cancelAnimationFrame(sr.current.animId);
      canvas.removeEventListener('click',handlePointer);
      canvas.removeEventListener('contextmenu',handlePointer);
      document.removeEventListener('keydown',onKey);
      window.removeEventListener('resize',setupCanvas);
    };
  },[setupCanvas,initParticles,animate,handlePointer,backgroundOnly]);

  // ── panel bindings ────────────────────────────────────────────────────────
  useEffect(()=>{
    function bindRange(id:string,key:keyof typeof DEFAULT_CONFIG,dec:number,cb?:()=>void){
      const el=document.getElementById('ds-'+id) as HTMLInputElement|null;
      const ve=document.getElementById('ds-'+id+'Val');
      if(!el||!ve)return;
      el.value=String(sr.current.config[key]);
      ve.textContent=Number(sr.current.config[key]).toFixed(dec);
      el.addEventListener('input',()=>{
        (sr.current.config as Record<string,unknown>)[key]=parseFloat(el.value);
        ve.textContent=Number(el.value).toFixed(dec);
        cb?.();
      });
    }
    bindRange('particleCount','particleCount',0,initParticles);
    bindRange('speed','speed',2);
    bindRange('loopDuration','loopDuration',1);
    bindRange('randomness','randomness',2);
    bindRange('gravStrength','gravStrength',0);
    bindRange('maxPoints','maxPoints',0);
    const ce=document.getElementById('ds-baseColor') as HTMLInputElement|null;
    ce?.addEventListener('input',()=>{
      sr.current.config.baseColor=ce.value;
      sr.current.palette=buildPalette(ce.value);
      sr.current.paletteRgb=sr.current.palette.map(hexToRgb) as [number,number,number][];
      for(const p of sr.current.particles) p.colorIdx=Math.floor(Math.random()*sr.current.palette.length);
    });
    document.getElementById('ds-clearPoints')?.addEventListener('click',()=>{sr.current.gravPoints=[];});
    document.getElementById('ds-resetParticles')?.addEventListener('click',initParticles);
  },[initParticles]);

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        .ds-canvas{display:block;cursor:crosshair;}
      `}</style>

      <div className="fixed inset-0 bg-black overflow-hidden font-[inherit]">
        <canvas ref={canvasRef} className="ds-canvas" />

        {/* Debug: solo si no es backgroundOnly. Shift muestra/oculta el botón; por defecto oculto. Panel siempre en DOM para bindings. */}
        {!backgroundOnly && (
        <div className={`fixed left-6 top-[38%] -translate-y-1/2 z-[60] flex items-center gap-2 ${showDebugButton ? '' : 'hidden'}`}>
          <button
            type="button"
            onClick={() => setDebugOpen((o) => !o)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950/90 backdrop-blur-xl border border-white/10 text-slate-300 hover:text-white hover:border-orange-500/40 hover:shadow-[0_0_20px_rgba(249,115,22,0.15)] transition-all font-bold text-sm"
          >
            <Settings2 size={18} />
            Debug
          </button>
          <div className={`fixed left-24 top-1/2 -translate-y-1/2 w-72 rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-2xl overflow-hidden z-[61] ${debugOpen ? 'block' : 'hidden'}`}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-gradient-to-r from-slate-900/90 to-transparent">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">DustSim</span>
                <button
                  type="button"
                  onClick={() => setDebugOpen(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-white/5 pb-1 mb-1">Partículas</div>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="ds-baseColor" className="text-xs font-bold text-slate-400">Color base</label>
                  <input type="color" id="ds-baseColor" defaultValue={DEFAULT_CONFIG.baseColor} className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent" />
                </div>
                <div>
                  <label className="flex justify-between items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-400">Cantidad</span>
                    <span className="text-xs font-mono text-orange-400" id="ds-particleCountVal">{DEFAULT_CONFIG.particleCount}</span>
                  </label>
                  <input type="range" id="ds-particleCount" min="100" max="30000" step="500" defaultValue={DEFAULT_CONFIG.particleCount} className="w-full h-2 rounded-full bg-slate-800 accent-orange-500" />
                </div>
                <div>
                  <label className="flex justify-between items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-400">Velocidad</span>
                    <span className="text-xs font-mono text-orange-400" id="ds-speedVal">{DEFAULT_CONFIG.speed.toFixed(2)}</span>
                  </label>
                  <input type="range" id="ds-speed" min="0.05" max="10" step="0.05" defaultValue={DEFAULT_CONFIG.speed} className="w-full h-2 rounded-full bg-slate-800 accent-orange-500" />
                </div>
                <div>
                  <label className="flex justify-between items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-400">Loop (s)</span>
                    <span className="text-xs font-mono text-orange-400" id="ds-loopDurationVal">{DEFAULT_CONFIG.loopDuration.toFixed(1)}</span>
                  </label>
                  <input type="range" id="ds-loopDuration" min="1" max="60" step="0.5" defaultValue={DEFAULT_CONFIG.loopDuration} className="w-full h-2 rounded-full bg-slate-800 accent-orange-500" />
                </div>
                <div>
                  <label className="flex justify-between items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-400">Aleatoriedad</span>
                    <span className="text-xs font-mono text-orange-400" id="ds-randomnessVal">{DEFAULT_CONFIG.randomness.toFixed(2)}</span>
                  </label>
                  <input type="range" id="ds-randomness" min="0" max="1" step="0.01" defaultValue={DEFAULT_CONFIG.randomness} className="w-full h-2 rounded-full bg-slate-800 accent-orange-500" />
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-white/5 pb-1 mb-1 pt-2">Gravedad</div>
                <div>
                  <label className="flex justify-between items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-400">Fuerza</span>
                    <span className="text-xs font-mono text-orange-400" id="ds-gravStrengthVal">{DEFAULT_CONFIG.gravStrength}</span>
                  </label>
                  <input type="range" id="ds-gravStrength" min="10" max="5000" step="10" defaultValue={DEFAULT_CONFIG.gravStrength} className="w-full h-2 rounded-full bg-slate-800 accent-orange-500" />
                </div>
                <div>
                  <label className="flex justify-between items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-400">Máx. puntos</span>
                    <span className="text-xs font-mono text-orange-400" id="ds-maxPointsVal">{DEFAULT_CONFIG.maxPoints}</span>
                  </label>
                  <input type="range" id="ds-maxPoints" min="1" max="30" step="1" defaultValue={DEFAULT_CONFIG.maxPoints} className="w-full h-2 rounded-full bg-slate-800 accent-orange-500" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" id="ds-clearPoints" className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white border border-white/10 hover:border-orange-500/30 transition-colors">Limpiar puntos</button>
                  <button type="button" id="ds-resetParticles" className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white border border-white/10 hover:border-orange-500/30 transition-colors">Reset</button>
                </div>
              </div>
            </div>
        </div>
        )}

        {!backgroundOnly && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 text-xs tracking-widest uppercase text-white/30 pointer-events-none whitespace-nowrap font-[inherit]">
          click izq: gravedad · click der: repulsión · sobre punto: borrar · shift: botón debug
        </div>
        )}
      </div>
    </>
  );
}