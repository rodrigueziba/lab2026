'use client';
import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Loader2, AlertCircle, Settings2, X, Activity } from 'lucide-react';

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader.js';

import { useLanguage } from '@/contexts/LanguageContext';

const MUSIC_FIRST = '/music.mp3';

// 12 sampler keys: A S D F G H J K L ; ' (mapped to codes)
const SAMPLER_KEYS = [
  'KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL',
  'Semicolon','Quote','Backslash'
];

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function fetchPlaylist(): Promise<string[]> {
  try {
    const res = await fetch('/api/music-list');
    if (res.ok) {
      const data = await res.json();
      const files: string[] = (data.files as string[]).filter((f: string) => f.endsWith('.mp3'));
      const rest = shuffle(files.filter(f => f !== 'music.mp3').map(f => `/${f}`));
      return [MUSIC_FIRST, ...rest];
    }
  } catch (_) {}
  return [MUSIC_FIRST];
}

// ─── Audio bands ──────────────────────────────────────────────────────────────
interface AudioBands {
  subBass: number; bass: number; lowMid: number; mid: number;
  highMid: number; presence: number; brilliance: number; air: number;
  rms: number; beat: number;
}
const zeroBands = (): AudioBands => ({
  subBass:0,bass:0,lowMid:0,mid:0,highMid:0,presence:0,brilliance:0,air:0,rms:0,beat:0
});

// ─── EQ state ─────────────────────────────────────────────────────────────────
interface EQState {
  mode: 'hp' | 'lp' | null;
  freq: number;
  gain: number;
  firstKey: 'left' | 'right' | null;
  lastKeyTime: number;
}

type SamplerState = 'idle' | 'recording' | 'playing';

// ─── Debug params ─────────────────────────────────────────────────────────────
interface DebugParams {
  topColor: string; bottomColor: string;
  bloomStrength: number; speed: number; lightIntensity: number;
  rgbShiftAmount: number; matrixIntensity: number;
  tvFilterEnabled: number;
  reflectionStrength: number; ghostIntensity: number;
  audioReactivity: number;
}
const DEFAULT_DEBUG: DebugParams = {
  topColor:'#0a198c', bottomColor:'#11133b',
  bloomStrength:1.0, speed:0.069, lightIntensity:1.2,
  rgbShiftAmount:0.001, matrixIntensity:0.25,
  tvFilterEnabled:1,
  reflectionStrength:0.35, ghostIntensity:1.0,
  audioReactivity:1.0,
};

// ─── Login Form ───────────────────────────────────────────────────────────────
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({ email:'', password:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  useEffect(() => {
    const token = searchParams.get('token');
    const userStr = searchParams.get('user');
    if (token && userStr) {
      localStorage.setItem('token', token);
      localStorage.setItem('user', decodeURIComponent(userStr));
      window.dispatchEvent(new Event('storage'));
      const redirect = searchParams.get('redirect') || sessionStorage.getItem('loginRedirect') || '/';
      try { sessionStorage.removeItem('loginRedirect'); } catch (_) {}
      router.push(redirect);
    }
  }, [searchParams, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const res = await fetch(`${apiUrl}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(formData)});
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.dispatchEvent(new Event('storage'));
        router.push(searchParams.get('redirect') || '/');
      } else { setError(t('login.credenciales_invalidas')); }
    } catch { setError(t('login.error_conexion')); }
    finally { setLoading(false); }
  };

  const handleGoogleLogin = () => {
    const redirect = searchParams.get('redirect');
    if (redirect) try { sessionStorage.setItem('loginRedirect', redirect); } catch (_) {}
    window.location.href = `${apiUrl}/auth/google`;
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-md relative z-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-white mb-2">{t('login.bienvenido')}</h1>
        <p className="text-slate-400">{t('login.ingresa_cuenta')}</p>
      </div>
      {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl mb-6 flex items-center gap-2 text-sm"><AlertCircle size={16}/>{error}</div>}
      <button onClick={handleGoogleLogin} className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3.5 rounded-xl transition flex justify-center items-center gap-3 mb-6">
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        <span>{t('login.continuar_google')}</span>
      </button>
      <div className="relative flex py-2 items-center mb-6">
        <div className="flex-grow border-t border-slate-700"/>
        <span className="flex-shrink mx-4 text-slate-500 text-xs font-bold uppercase">{t('login.o_email')}</span>
        <div className="flex-grow border-t border-slate-700"/>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
          <input type="email" placeholder={t('login.correo')} className="w-full bg-slate-950/80 border border-slate-800 p-4 pl-12 rounded-xl text-white focus:border-orange-500 focus:outline-none placeholder:text-slate-600 transition-all" value={formData.email} onChange={(e)=>setFormData({...formData,email:e.target.value})} required/>
        </div>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
          <input type="password" placeholder={t('login.password')} className="w-full bg-slate-950/80 border border-slate-800 p-4 pl-12 rounded-xl text-white focus:border-orange-500 focus:outline-none placeholder:text-slate-600 transition-all" value={formData.password} onChange={(e)=>setFormData({...formData,password:e.target.value})} required/>
        </div>
        <div className="flex justify-end">
          <Link href="/login/olvide-password" className="text-sm text-orange-500 hover:text-orange-400 font-bold">{t('login.olvidaste')}</Link>
        </div>
        <button disabled={loading} className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 py-4 rounded-xl text-white font-bold flex justify-center items-center gap-2 transition-all shadow-lg shadow-orange-900/30 hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading?<Loader2 className="animate-spin"/>:t('login.iniciar')}
        </button>
      </form>
      <div className="mt-8 text-center">
        <p className="text-slate-400 text-sm">{t('login.no_cuenta')}{' '}<Link href="/registro" className="text-orange-500 font-bold hover:text-orange-400">{t('login.registrate_aqui')}</Link></p>
      </div>
    </div>
  );
}

// ─── Spectrum Canvas ──────────────────────────────────────────────────────────
function SpectrumBars({ bandsRef, eqState }: { bandsRef: React.MutableRefObject<AudioBands>; eqState: EQState }) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = cvRef.current; if(!cv) return;
    const ctx = cv.getContext('2d')!;
    let raf: number;
    const KEYS: (keyof AudioBands)[] = ['subBass','bass','lowMid','mid','highMid','presence','brilliance','air'];
    const LABELS = ['SUB','BASS','LO-M','MID','HI-M','PRES','BRIL','AIR'];
    const BAND_FREQS = [40,150,375,1000,3000,5000,9000,16000];
    const COLORS = ['#ff3366','#ff6600','#ffaa00','#44ff88','#00ccff','#aa44ff','#ff44aa','#ffffff'];
    function draw() {
      raf = requestAnimationFrame(draw);
      const b = bandsRef.current;
      const W=cv!.width, H=cv!.height;
      ctx.clearRect(0,0,W,H);
      const bw = Math.floor(W/8)-2;
      const eq = eqState;
      // EQ attenuation overlay
      if (eq.mode && eq.gain > 0) {
        for (let i = 0; i < 8; i++) {
          const f = BAND_FREQS[i];
          const attenuated = eq.mode==='hp' ? f < eq.freq : f > eq.freq;
          if (attenuated) {
            ctx.save(); ctx.globalAlpha = 0.15 * eq.gain;
            ctx.fillStyle = '#ff3333';
            ctx.fillRect(i*(bw+2), 0, bw, H-14);
            ctx.restore();
          }
        }
      }
      KEYS.forEach((k,i)=>{
        const v = b[k] as number;
        const x = i*(bw+2);
        const bh = Math.max(1,Math.round(v*(H-14)));
        ctx.shadowBlur=12; ctx.shadowColor=COLORS[i];
        const g=ctx.createLinearGradient(0,H-14,0,H-14-bh);
        g.addColorStop(0,COLORS[i]+'66'); g.addColorStop(1,COLORS[i]+'ff');
        ctx.fillStyle=g;
        ctx.fillRect(x,H-14-bh,bw,bh);
        ctx.shadowBlur=0;
        ctx.fillStyle='#ffffff44'; ctx.font='7px monospace';
        ctx.textAlign='center'; ctx.fillText(LABELS[i],x+bw/2,H-2);
      });
      // EQ cutoff line
      if (eq.mode && eq.freq > 0) {
        const logMin=Math.log10(20),logMax=Math.log10(20000);
        const xPos=((Math.log10(eq.freq)-logMin)/(logMax-logMin))*W;
        ctx.save(); ctx.globalAlpha=0.85;
        ctx.strokeStyle=eq.mode==='hp'?'#ff6600':'#00ccff';
        ctx.lineWidth=1.5; ctx.setLineDash([3,3]);
        ctx.beginPath(); ctx.moveTo(xPos,0); ctx.lineTo(xPos,H-14); ctx.stroke();
        ctx.restore();
      }
    }
    draw();
    return ()=>cancelAnimationFrame(raf);
  },[bandsRef,eqState]);
  return <canvas ref={cvRef} width={200} height={60} className="w-full rounded-lg"/>;
}

// ─── EQ + Sampler Status Badge ────────────────────────────────────────────────
function EQBadge({ eq, samplerState }: { eq: EQState; samplerState: SamplerState }) {
  if (!eq.mode && samplerState === 'idle') return null;
  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 hidden md:flex flex-col items-center gap-2 pointer-events-none select-none">
      {eq.mode && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-full"
          style={{background:'rgba(2,4,20,0.9)',backdropFilter:'blur(12px)',border:`1px solid ${eq.mode==='hp'?'rgba(255,102,0,0.4)':'rgba(0,204,255,0.4)'}`}}>
          <span className="text-[10px] font-black tracking-widest uppercase" style={{color:eq.mode==='hp'?'#ff6600':'#00ccff'}}>{eq.mode==='hp'?'HIGH-PASS':'LOW-PASS'}</span>
          <span className="text-[10px] text-slate-400 font-mono">{eq.freq>=1000?`${(eq.freq/1000).toFixed(1)}kHz`:`${Math.round(eq.freq)}Hz`}</span>
          <span className="text-[9px] text-slate-500 font-mono">{Math.round(eq.gain*100)}%</span>
          <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full" style={{width:`${eq.gain*100}%`,background:eq.mode==='hp'?'#ff6600':'#00ccff'}}/>
          </div>
        </div>
      )}
      {samplerState==='recording'&&(
        <div className="flex items-center gap-2 px-4 py-2 rounded-full animate-pulse" style={{background:'rgba(30,0,0,0.9)',backdropFilter:'blur(12px)',border:'1px solid rgba(255,30,30,0.5)'}}>
          <span className="w-2 h-2 rounded-full bg-red-500"/>
          <span className="text-[10px] font-black tracking-widest uppercase text-red-400">GRABANDO</span>
          <span className="text-[9px] text-slate-500">[ O ] para detener</span>
        </div>
      )}
      {samplerState==='playing'&&(
        <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{background:'rgba(0,20,30,0.9)',backdropFilter:'blur(12px)',border:'1px solid rgba(0,200,255,0.4)'}}>
          <span className="text-[10px]">🔁</span>
          <span className="text-[10px] font-black tracking-widest uppercase text-cyan-400">SAMPLE</span>
          <span className="text-[9px] text-slate-500 hidden sm:inline">A-L = semitonos · SPACE = volver</span>
        </div>
      )}
    </div>
  );
}

// ─── Debug Panel ──────────────────────────────────────────────────────────────
function DebugPanel({ params, onChange, onClose, onReset, bandsRef, playing, hideCard, onToggleCard, trackName, onSkip, eqState }: {
  params: DebugParams;
  onChange: (k: keyof DebugParams, v: number|string) => void;
  onClose: ()=>void; onReset: ()=>void;
  bandsRef: React.MutableRefObject<AudioBands>;
  playing: boolean;
  hideCard: boolean;
  onToggleCard: ()=>void;
  trackName: string;
  onSkip: ()=>void;
  eqState: EQState;
}) {
  const [live, setLive] = useState(params);
  const rafRef = useRef<number|null>(null);

  useEffect(()=>{
    function tick(){
      rafRef.current=requestAnimationFrame(tick);
      if(!playing){setLive(params);return;}
      const b=bandsRef.current,r=params.audioReactivity;
      setLive({...params,
        bloomStrength:Math.min(3,params.bloomStrength+b.bass*1.8*r),
        speed:Math.min(2,params.speed+b.beat*0.15*r),
        lightIntensity:Math.min(3,params.lightIntensity+b.rms*1.0*r),
        rgbShiftAmount:Math.min(0.02,params.rgbShiftAmount+b.brilliance*0.008*r),
        matrixIntensity:Math.min(1,params.matrixIntensity+b.air*0.4*r),
        reflectionStrength:Math.min(1,params.reflectionStrength+b.subBass*0.3*r),
        ghostIntensity:Math.min(3,params.ghostIntensity+b.mid*0.8*r),
      });
    }
    tick();
    return ()=>{if(rafRef.current!=null)cancelAnimationFrame(rafRef.current);};
  },[params,bandsRef,playing]);

  const SLIDERS: {label:string;key:keyof DebugParams;min:number;max:number;step:number;audioKey?:keyof AudioBands;col:string}[] = [
    {label:'Bloom',        key:'bloomStrength',     min:0,    max:3,    step:0.05,  audioKey:'bass',       col:'#ff6600'},
    {label:'Velocidad',    key:'speed',             min:0.02, max:2,    step:0.01,  audioKey:'beat',       col:'#44ff88'},
    {label:'Luz',          key:'lightIntensity',    min:0.2,  max:3,    step:0.05,  audioKey:'rms',        col:'#ffaa00'},
    {label:'RGB Shift',    key:'rgbShiftAmount',    min:0,    max:0.02, step:0.0005,audioKey:'brilliance', col:'#aa44ff'},
    {label:'Matrix',       key:'matrixIntensity',   min:0,    max:1,    step:0.01,  audioKey:'air',        col:'#00ccff'},
    {label:'Reflexión',    key:'reflectionStrength',min:0,    max:1,    step:0.01,  audioKey:'subBass',    col:'#ff3366'},
    {label:'Ghost',        key:'ghostIntensity',    min:0,    max:3,    step:0.05,  audioKey:'mid',        col:'#ff44aa'},
    {label:'Reactividad',  key:'audioReactivity',   min:0,    max:3,    step:0.05,  col:'#ffffff'},
  ];

  // Height: leave room for navbar (≈56px) and bottom gap — so max is 100dvh - 56px - 16px
  const panelMaxH = 'min(calc(100dvh - 72px), 680px)';

  return (
    <div className="fixed z-[61] rounded-2xl border border-white/10 bg-slate-950/97 backdrop-blur-xl shadow-2xl flex flex-col"
      style={{
        boxShadow:'0 0 60px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.04)',
        left:'clamp(8px, 4vw, 16px)',
        top:'clamp(64px, 8vh, 80px)', // below navbar
        width:'min(256px, calc(100vw - 16px))',
        maxHeight: panelMaxH,
        height:'auto',
      }}
    >
      {/* Header — sticky, never scrolls away */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-gradient-to-r from-slate-900/60 to-transparent flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Activity size={13} className={playing?'text-green-400 animate-pulse':'text-slate-600'}/>
          <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Debug</span>
          {playing&&<span className="text-[8px] font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full border border-green-400/20 whitespace-nowrap">LIVE</span>}
        </div>
        {/* X is always visible because panel starts below navbar */}
        <button onClick={onClose} className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 ml-2"><X size={14}/></button>
      </div>

      {/* Scrollable body */}
      <div className="p-3 space-y-3 overflow-y-auto flex-1 min-h-0">
        {playing && trackName && (
          <div className="rounded-lg border border-white/5 bg-black/30 px-2.5 py-1.5 flex items-center gap-2 min-w-0">
            <span className="text-[8px] font-bold text-slate-500 uppercase flex-shrink-0">♪</span>
            <span className="text-[9px] text-slate-400 truncate font-mono flex-1">{trackName}</span>
            <button onClick={onSkip} title="Skip" className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-md text-slate-500 hover:text-white hover:bg-white/10 transition-colors" style={{fontSize:10}}>⏭</button>
          </div>
        )}

        {playing&&(
          <div className="rounded-xl border border-white/5 bg-black/50 p-2">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Espectro en vivo</p>
              {eqState.mode&&(
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full border"
                  style={{color:eqState.mode==='hp'?'#ff6600':'#00ccff',borderColor:eqState.mode==='hp'?'rgba(255,102,0,0.3)':'rgba(0,204,255,0.3)',background:eqState.mode==='hp'?'rgba(255,102,0,0.08)':'rgba(0,204,255,0.08)'}}>
                  {eqState.mode==='hp'?'HP':'LP'} {eqState.freq>=1000?`${(eqState.freq/1000).toFixed(1)}k`:`${Math.round(eqState.freq)}`}Hz
                </span>
              )}
            </div>
            <SpectrumBars bandsRef={bandsRef} eqState={eqState}/>
            {eqState.mode&&(
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-[8px] text-slate-600 uppercase tracking-wider">Gain</span>
                <div className="flex-1 h-1 rounded-full bg-slate-800">
                  <div className="h-full rounded-full" style={{width:`${eqState.gain*100}%`,background:eqState.mode==='hp'?'#ff6600':'#00ccff'}}/>
                </div>
                <span className="text-[8px] font-mono text-slate-500">{Math.round(eqState.gain*100)}%</span>
              </div>
            )}
            <p className="text-[8px] text-slate-600 mt-1">← → filtro · ↑↓ ganancia · I/O sampler</p>
          </div>
        )}

        {/* Ocultar tarjeta */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
          <span className="text-[10px] font-bold text-slate-400">Ocultar tarjeta login</span>
          <div onClick={onToggleCard} className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer flex-shrink-0 ${hideCard?'bg-orange-500':'bg-slate-700'}`}>
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${hideCard?'left-4':'left-0.5'}`}/>
          </div>
        </div>

        {/* Filtro TV — controla el div CRT overlay */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
          <span className="text-[10px] font-bold text-slate-400">Filtro TV (scanlines)</span>
          <div onClick={()=>onChange('tvFilterEnabled',params.tvFilterEnabled>0?0:1)} className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer flex-shrink-0 ${params.tvFilterEnabled>0?'bg-orange-500':'bg-slate-700'}`}>
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${params.tvFilterEnabled>0?'left-4':'left-0.5'}`}/>
          </div>
        </div>

        {/* Colors */}
        <div className="grid grid-cols-2 gap-2">
          {(['topColor','bottomColor'] as const).map(k=>(
            <div key={k}>
              <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">{k==='topColor'?'Superior':'Inferior'}</p>
              <div className="flex items-center gap-1.5">
                <input type="color" value={params[k]} onChange={e=>onChange(k,e.target.value)} className="w-8 h-8 rounded-lg border border-white/10 cursor-pointer bg-transparent flex-shrink-0"/>
                <span className="text-[9px] font-mono text-slate-500 truncate">{params[k]}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Sliders */}
        {SLIDERS.map(({label,key,min,max,step,audioKey,col})=>{
          const base=params[key] as number;
          const lv=live[key] as number;
          const pct=Math.min(100,((base-min)/(max-min))*100);
          const lpct=Math.min(100,((lv-min)/(max-min))*100);
          const delta=playing&&audioKey?Math.max(0,lv-base):0;
          return(
            <div key={key}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-slate-400">{label}</span>
                <div className="flex items-center gap-1.5">
                  {delta>0.0005&&<span className="text-[9px] font-mono" style={{color:col}}>+{delta.toFixed(3)}</span>}
                  <span className="text-[10px] font-mono" style={{color:delta>0.001?col:'#fb923c'}}>{lv.toFixed(3)}</span>
                </div>
              </div>
              <div className="relative h-2.5 rounded-full bg-slate-800/80 cursor-pointer"
                onClick={e=>{
                  const r=e.currentTarget.getBoundingClientRect();
                  onChange(key,parseFloat(Math.min(max,Math.max(min,min+(e.clientX-r.left)/r.width*(max-min))).toFixed(5)));
                }}>
                {playing&&delta>0&&<div className="absolute inset-y-0 left-0 rounded-full opacity-25 pointer-events-none" style={{width:`${lpct}%`,background:col}}/>}
                <div className="absolute inset-y-0 left-0 rounded-full pointer-events-none" style={{width:`${pct}%`,background:`linear-gradient(90deg,${col}55,${col})`}}/>
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-white/90 pointer-events-none" style={{left:`${pct}%`,background:col,boxShadow:`0 0 8px ${col}99,0 0 2px ${col}`}}/>
              </div>
            </div>
          );
        })}

        <button onClick={onReset} className="w-full py-2 rounded-xl text-[10px] font-bold text-slate-500 hover:text-white border border-white/5 hover:border-orange-500/20 transition-all">
          ↺ Restaurar defaults
        </button>

        <div className="rounded-xl border border-white/5 bg-black/20 p-2.5 space-y-1">
          <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mb-1.5">Atajos</p>
          {[['SPACE','Play / Pausa'],['← →','Mover filtro EQ'],['↑ ↓','Ganancia EQ'],['I','Grabar sample'],['O','Stop + loop'],['A→L','12 semitonos del sample'],['SHIFT','Debug'],['SCROLL','Velocidad'],['CLICK','Paleta']].map(([k,v])=>(
            <div key={k} className="flex items-center gap-2">
              <kbd className="text-[7px] font-black bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 flex-shrink-0 min-w-[28px] text-center">{k}</kbd>
              <span className="text-[8px] text-slate-600">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Glass Cursor (CSS — always visible, physics spring) ─────────────────────
function GlassCursor({
  mousePixelRef,
  bandsRef,
  audioPlaying,
}: {
  mousePixelRef: React.MutableRefObject<{x:number;y:number}>;
  bandsRef: React.MutableRefObject<AudioBands>;
  audioPlaying: boolean;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: -200, y: -200 });
  const vel = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>();

  useEffect(() => {
    // Init position offscreen until first mouse move
    pos.current = { x: -200, y: -200 };

    function tick() {
      rafRef.current = requestAnimationFrame(tick);
      const el = elRef.current;
      const glow = glowRef.current;
      if (!el || !glow) return;

      const target = mousePixelRef.current;
      const b = bandsRef.current;

      // Spring physics (pixel space)
      const dx = target.x - pos.current.x;
      const dy = target.y - pos.current.y;
      const springK = 0.18;   // spring strength — lower = more lag
      const damping  = 0.72;  // velocity decay — lower = bouncier

      vel.current.x = vel.current.x * damping + dx * springK;
      vel.current.y = vel.current.y * damping + dy * springK;
      pos.current.x += vel.current.x;
      pos.current.y += vel.current.y;

      // Base size + audio beat pulse
      const beat   = audioPlaying ? b.beat   : 0;
      const rms    = audioPlaying ? b.rms    : 0;
      const bass   = audioPlaying ? b.bass   : 0;
      const size   = 42 + beat * 22 + bass * 12;
      const blur   = 6  + rms  * 8;

      // Colour: tint from subBass (red) + mid (green) + air (blue)
      const r = Math.round(60  + (audioPlaying ? b.subBass : 0) * 160);
      const g = Math.round(120 + (audioPlaying ? b.mid     : 0) * 100);
      const bv= Math.round(220 + (audioPlaying ? b.air     : 0) *  35);
      const rimAlpha = 0.7 + beat * 0.3;

      const half = size / 2;
      el.style.transform = `translate(${pos.current.x - half}px, ${pos.current.y - half}px)`;
      el.style.width  = `${size}px`;
      el.style.height = `${size}px`;

      // Rim border colour
      el.style.boxShadow = [
        `0 0 ${blur}px rgba(${r},${g},${bv},0.5)`,
        `0 0 ${blur*3}px rgba(${r},${g},${bv},0.15)`,
        `inset 0 0 ${blur*0.5}px rgba(255,255,255,0.12)`,
      ].join(',');
      el.style.borderColor = `rgba(${r},${g},${bv},${rimAlpha})`;

      // Outer halo
      const haloSize = size * (1.5 + beat * 0.4);
      const haloHalf = haloSize / 2;
      glow.style.transform = `translate(${pos.current.x - haloHalf}px, ${pos.current.y - haloHalf}px)`;
      glow.style.width  = `${haloSize}px`;
      glow.style.height = `${haloSize}px`;
      glow.style.opacity = String(0.12 + beat * 0.18);
      glow.style.background = `radial-gradient(circle, rgba(${r},${g},${bv},0.6) 0%, transparent 70%)`;
    }
    tick();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [mousePixelRef, bandsRef, audioPlaying]);

  return (
    <>
      {/* Outer halo */}
      <div
        ref={glowRef}
        className="fixed top-0 left-0 rounded-full pointer-events-none hidden md:block"
        style={{ zIndex: 9999, willChange: 'transform', mixBlendMode: 'screen' }}
      />
      {/* Glass sphere */}
      <div
        ref={elRef}
        className="fixed top-0 left-0 rounded-full pointer-events-none hidden md:block"
        style={{
          zIndex: 9999,
          willChange: 'transform',
          border: '1.5px solid rgba(140,180,255,0.7)',
          backdropFilter: 'blur(3px) saturate(160%)',
          WebkitBackdropFilter: 'blur(3px) saturate(160%)',
          background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.14) 0%, rgba(100,160,255,0.06) 45%, rgba(40,80,200,0.04) 100%)',
          boxShadow: '0 0 10px rgba(100,160,255,0.4), inset 0 0 6px rgba(255,255,255,0.1)',
          // Inner specular highlight (top-left)
          // pseudo-element not available here, using inner gradient
        }}
      >
        {/* Specular highlight dot */}
        <div
          className="absolute rounded-full"
          style={{
            width: '28%', height: '28%',
            top: '14%', left: '18%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.55) 0%, transparent 80%)',
          }}
        />
      </div>
    </>
  );
}
export default function LoginPage() {
  const mountRef = useRef<HTMLDivElement>(null);

  const [showDebug, setShowDebug] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugParams, setDebugParams] = useState<DebugParams>({...DEFAULT_DEBUG});
  const [hideCard, setHideCard] = useState(false);
  const [audioState, setAudioState] = useState<'idle'|'loading'|'playing'|'paused'>('idle');
  const [trackName, setTrackName] = useState('');
  const debugRef = useRef<DebugParams>({...DEFAULT_DEBUG});

  // Audio nodes
  const audioRef = useRef<HTMLAudioElement|null>(null);
  const audioCtxRef = useRef<AudioContext|null>(null);
  const analyserRef = useRef<AnalyserNode|null>(null);
  const freqRef = useRef<Uint8Array|null>(null);
  const bandsRef = useRef<AudioBands>(zeroBands());
  const beatRef = useRef({prev:0,lastBeat:0});
  const portalRef = useRef({active:false,opacity:0,nextShow:0,hold:0});
  const playlistRef = useRef<string[]>([]);
  const trackIdxRef = useRef(0);

  // EQ
  const eqFilterRef = useRef<BiquadFilterNode|null>(null);
  const [eqState, setEqState] = useState<EQState>({mode:null,freq:200,gain:0.8,firstKey:null,lastKeyTime:0});
  const eqStateRef = useRef<EQState>({mode:null,freq:200,gain:0.8,firstKey:null,lastKeyTime:0});
  useEffect(()=>{ eqStateRef.current=eqState; },[eqState]);

  // Sampler
  const [samplerState, setSamplerState] = useState<SamplerState>('idle');
  const samplerStateRef = useRef<SamplerState>('idle');
  const mediaRecorderRef = useRef<MediaRecorder|null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const sampleBlobUrlRef = useRef<string|null>(null); // stored URL for semitone players
  const sampleAudioRef = useRef<HTMLAudioElement|null>(null); // default playback (A key / loop)
  const samplerDestRef = useRef<MediaStreamAudioDestinationNode|null>(null);
  // Active semitone players (to stop on space)
  const semitonePlayersRef = useRef<HTMLAudioElement[]>([]);

  // Ramp refs
  const audioRampRef = useRef<{active:boolean;audioStartTime:number}>({active:false,audioStartTime:0});
  const secondRampRef = useRef<{done:boolean}>({done:false});
  const thirdRampRef = useRef<{done:boolean}>({done:false}); // 2min ramp

  // Mouse position for sphere (normalized -1 to 1)
  const mousePosRef = useRef({x:0,y:0});

  useEffect(()=>{ debugRef.current={...debugParams}; },[debugParams]);

  const handleChange = useCallback((k:keyof DebugParams,v:number|string)=>{
    setDebugParams(p=>({...p,[k]:v}));
  },[]);

  const skipTrack = useCallback(()=>{
    const audio=audioRef.current,pl=playlistRef.current;
    if(!audio||pl.length===0) return;
    audio.pause(); audio.currentTime=0;
    trackIdxRef.current=(trackIdxRef.current+1)%pl.length;
    const next=pl[trackIdxRef.current];
    audio.src=next;
    setTrackName(next.replace(/^\//,'').replace('.mp3',''));
    audio.play().then(()=>setAudioState('playing')).catch(()=>{});
  },[]);

  // ── Shift → toggle debug (hides panel too) ───────────────────────────────
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      if(e.code!=='ShiftLeft'&&e.code!=='ShiftRight') return;
      if(window.innerWidth<768) return;
      setShowDebug(v=>{ const next=!v; if(!next) setDebugOpen(false); return next; });
    };
    window.addEventListener('keydown',h);
    return ()=>window.removeEventListener('keydown',h);
  },[]);

  // ── Mouse position tracking (pixel coords for CSS cursor) ───────────────
  const mousePixelRef = useRef({x: -200, y: -200}); // start offscreen
  useEffect(()=>{
    const h=(e:MouseEvent)=>{
      mousePosRef.current={x:(e.clientX/window.innerWidth)*2-1, y:-(e.clientY/window.innerHeight)*2+1};
      mousePixelRef.current={x:e.clientX, y:e.clientY};
    };
    window.addEventListener('mousemove',h);
    return ()=>window.removeEventListener('mousemove',h);
  },[]);

  // ── EQ filter management ─────────────────────────────────────────────────
  function rewireChain(mode:'hp'|'lp'|null,freq:number,gain:number){
    const ctx=audioCtxRef.current,analyser=analyserRef.current;
    if(!ctx||!analyser) return;
    try{analyser.disconnect();}catch(_){}
    if(eqFilterRef.current){try{eqFilterRef.current.disconnect();}catch(_){} eqFilterRef.current=null;}
    if(mode){
      const f=ctx.createBiquadFilter();
      f.type=mode==='hp'?'highpass':'lowpass';
      f.frequency.value=freq;
      f.Q.value=0.5+gain*5;
      eqFilterRef.current=f;
      analyser.connect(f);
      f.connect(ctx.destination);
    } else {
      analyser.connect(ctx.destination);
    }
  }

  // Apply EQ to a sample audio element (connect through same filter chain)
  function connectSampleToEQ(sa:HTMLAudioElement){
    const ctx=audioCtxRef.current;
    if(!ctx) return;
    try{
      const src=ctx.createMediaElementSource(sa);
      const dest=eqFilterRef.current||analyserRef.current;
      if(dest) src.connect(dest);
      else src.connect(ctx.destination);
    }catch(_){}
  }

  // ── Arrow keys: EQ ────────────────────────────────────────────────────────
  useEffect(()=>{
    const FREQ_STEPS=[20,40,80,150,250,500,1000,2000,4000,8000,12000,16000,20000];
    const RESET_MS=5000;
    const h=(e:KeyboardEvent)=>{
      const ae=document.activeElement;
      if(ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA')) return;
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) return;
      e.preventDefault();
      const now=performance.now(),eq=eqStateRef.current;
      if(e.code==='ArrowUp'||e.code==='ArrowDown'){
        if(!eq.mode) return;
        const newGain=Math.max(0.05,Math.min(1,eq.gain+(e.code==='ArrowUp'?0.1:-0.1)));
        const next={...eq,gain:newGain,lastKeyTime:now};
        eqStateRef.current=next; setEqState(next);
        if(eqFilterRef.current) eqFilterRef.current.Q.value=0.5+newGain*5;
        return;
      }
      const isLeft=e.code==='ArrowLeft',isRight=e.code==='ArrowRight';
      const curIdx=FREQ_STEPS.reduce((b,f,i)=>Math.abs(f-eq.freq)<Math.abs(FREQ_STEPS[b]-eq.freq)?i:b,0);
      const isReset=now-eq.lastKeyTime>RESET_MS||eq.firstKey===null;
      if(isReset){
        const newMode:'hp'|'lp'=isRight?'hp':'lp';
        const startFreq=isRight?FREQ_STEPS[0]:FREQ_STEPS[FREQ_STEPS.length-1];
        const next={mode:newMode,freq:startFreq,gain:eq.gain||0.8,firstKey:isRight?'right' as const:'left' as const,lastKeyTime:now};
        eqStateRef.current=next; setEqState(next); rewireChain(next.mode,next.freq,next.gain);
        return;
      }
      let newIdx=Math.max(0,Math.min(FREQ_STEPS.length-1,curIdx+(isRight?1:-1)));
      const newFreq=FREQ_STEPS[newIdx];
      const deactivate=(eq.mode==='hp'&&isLeft&&newIdx===0&&curIdx===0)||(eq.mode==='lp'&&isRight&&newIdx===FREQ_STEPS.length-1&&curIdx===FREQ_STEPS.length-1);
      if(deactivate){
        const next={...eq,mode:null as null,firstKey:null as null,lastKeyTime:now};
        eqStateRef.current=next; setEqState(next); rewireChain(null,newFreq,eq.gain);
        return;
      }
      const next={...eq,freq:newFreq,lastKeyTime:now};
      eqStateRef.current=next; setEqState(next);
      if(eqFilterRef.current) eqFilterRef.current.frequency.value=newFreq;
    };
    const interval=setInterval(()=>{
      const eq=eqStateRef.current;
      if(!eq.mode) return;
      if(performance.now()-eq.lastKeyTime>RESET_MS){
        const next={...eq,mode:null as null,firstKey:null as null};
        eqStateRef.current=next; setEqState(next); rewireChain(null,eq.freq,eq.gain);
      }
    },1000);
    window.addEventListener('keydown',h);
    return ()=>{ window.removeEventListener('keydown',h); clearInterval(interval); };
  },[]);

  // ── Sampler: I=record, O=stop+loop, A-L=semitones ───────────────────────
  useEffect(()=>{
    const h=async(e:KeyboardEvent)=>{
      // CRITICAL: ignore OS key-repeat events — they cause the glitch
      if(e.repeat) return;
      const ae=document.activeElement;
      if(ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA')) return;

      // I → start recording
      if(e.code==='KeyI'){
        const ctx=audioCtxRef.current;
        if(!ctx||samplerStateRef.current!=='idle') return;
        const dest=ctx.createMediaStreamDestination();
        samplerDestRef.current=dest;
        const source=eqFilterRef.current||analyserRef.current;
        if(!source) return;
        try{source.connect(dest);}catch(_){}
        const chunks:BlobPart[]=[];
        recordedChunksRef.current=chunks;
        const mimeType=['audio/webm;codecs=opus','audio/webm','audio/ogg'].find(m=>MediaRecorder.isTypeSupported(m))||'';
        const mr=new MediaRecorder(dest.stream,mimeType?{mimeType}:{});
        mediaRecorderRef.current=mr;
        mr.ondataavailable=(ev)=>{if(ev.data.size>0)chunks.push(ev.data);};
        mr.start(100);
        samplerStateRef.current='recording';
        setSamplerState('recording');
        return;
      }

      // O → stop recording + start looping
      if(e.code==='KeyO'){
        if(samplerStateRef.current!=='recording') return;
        const mr=mediaRecorderRef.current; if(!mr) return;
        mr.stop();
        mr.onstop=()=>{
          const blob=new Blob(recordedChunksRef.current,{type:mr.mimeType||'audio/webm'});
          const url=URL.createObjectURL(blob);
          sampleBlobUrlRef.current=url;
          audioRef.current?.pause();
          // Start default loop at root pitch
          const sa=new Audio(url);
          sa.loop=true;
          sampleAudioRef.current=sa;
          connectSampleToEQ(sa);
          sa.play().catch(()=>{});
          samplerStateRef.current='playing';
          setSamplerState('playing');
          setAudioState('paused');
        };
        const dest=samplerDestRef.current;
        if(dest){const src=eqFilterRef.current||analyserRef.current;if(src)try{src.disconnect(dest);}catch(_){}}
        return;
      }

      // A–L → 12 semitones — only fires once per physical keydown (e.repeat=false)
      const keyIdx=SAMPLER_KEYS.indexOf(e.code);
      if(keyIdx!==-1&&sampleBlobUrlRef.current){
        const url=sampleBlobUrlRef.current;
        const rate=Math.pow(2,keyIdx/12); // equal-temperament semitone

        // If a player already running at this slot, do nothing (it keeps looping)
        const existing=semitonePlayersRef.current[keyIdx];
        if(existing&&!existing.paused) return;

        const sp=new Audio(url);
        sp.loop=true;
        sp.playbackRate=rate;
        semitonePlayersRef.current[keyIdx]=sp;
        connectSampleToEQ(sp);
        sp.play().catch(()=>{});

        // Mute default loop when any semitone key is held
        if(sampleAudioRef.current) sampleAudioRef.current.volume=0;
        return;
      }
    };

    // Key-up: stop the semitone player (gate behaviour)
    const hUp=(e:KeyboardEvent)=>{
      const keyIdx=SAMPLER_KEYS.indexOf(e.code);
      if(keyIdx!==-1){
        const sp=semitonePlayersRef.current[keyIdx];
        if(sp){ sp.pause(); sp.currentTime=0; semitonePlayersRef.current[keyIdx]=undefined as any; }
        // Restore default loop volume if no keys held
        const anyHeld=semitonePlayersRef.current.some(p=>p&&!p.paused);
        if(!anyHeld&&sampleAudioRef.current) sampleAudioRef.current.volume=1;
      }
    };

    window.addEventListener('keydown',h);
    window.addEventListener('keyup',hUp);
    return ()=>{ window.removeEventListener('keydown',h); window.removeEventListener('keyup',hUp); };
  },[]);

  // ── Space → play/pause / resume from sampler ──────────────────────────────
  useEffect(()=>{
    const h=async(e:KeyboardEvent)=>{
      if(e.code!=='Space') return;
      if(window.innerWidth<768) return;
      const ae=document.activeElement;
      if(ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA')) return;
      e.preventDefault();

      // Sampler playing → stop all and resume main
      if(samplerStateRef.current==='playing'){
        sampleAudioRef.current?.pause();
        sampleAudioRef.current=null;
        semitonePlayersRef.current.forEach(sp=>{ try{sp.pause();}catch(_){} });
        semitonePlayersRef.current=[];
        if(sampleBlobUrlRef.current){ URL.revokeObjectURL(sampleBlobUrlRef.current); sampleBlobUrlRef.current=null; }
        samplerStateRef.current='idle';
        setSamplerState('idle');
        const audio=audioRef.current,ctx=audioCtxRef.current;
        if(audio&&ctx){
          if(ctx.state==='suspended') await ctx.resume();
          await audio.play().catch(()=>{});
          setAudioState('playing');
        }
        return;
      }
      if(samplerStateRef.current==='recording') return;

      // First time init
      if(!audioCtxRef.current){
        setAudioState('loading');
        const playlist=await fetchPlaylist();
        playlistRef.current=playlist; trackIdxRef.current=0;
        const audio=new Audio(playlist[0]);
        audioRef.current=audio;
        setTrackName(playlist[0].replace(/^\//,'').replace('.mp3',''));
        const ctx=new AudioContext();
        audioCtxRef.current=ctx;
        const analyser=ctx.createAnalyser();
        analyser.fftSize=2048; analyser.smoothingTimeConstant=0.8;
        analyserRef.current=analyser;
        freqRef.current=new Uint8Array(analyser.frequencyBinCount);
        const src=ctx.createMediaElementSource(audio);
        src.connect(analyser);
        analyser.connect(ctx.destination);
        audio.addEventListener('ended',()=>skipTrack());
        await audio.play();
        if(ctx.state==='suspended') await ctx.resume();
        setAudioState('playing');
        audioRampRef.current={active:true,audioStartTime:performance.now()};
        secondRampRef.current={done:false};
        thirdRampRef.current={done:false};
        return;
      }
      const audio=audioRef.current!,ctx=audioCtxRef.current!;
      if(ctx.state==='suspended') await ctx.resume();
      if(audio.paused){await audio.play();setAudioState('playing');}
      else{audio.pause();setAudioState('paused');}
    };
    window.addEventListener('keydown',h);
    return ()=>window.removeEventListener('keydown',h);
  },[audioState,skipTrack]);

  // ── Scroll → speed + playbackRate ────────────────────────────────────────
  useEffect(()=>{
    const h=(e:WheelEvent)=>{
      setDebugParams(p=>({...p,speed:Math.max(0.02,Math.min(p.speed-e.deltaY*0.0015,2.0))}));
      if(audioRef.current) audioRef.current.playbackRate=Math.max(0.5,Math.min((audioRef.current.playbackRate||1)-e.deltaY*0.0003,2.0));
    };
    window.addEventListener('wheel',h,{passive:true});
    return ()=>window.removeEventListener('wheel',h);
  },[]);

  // ── Navbar events ─────────────────────────────────────────────────────────
  useEffect(()=>{
    if(typeof window==='undefined') return;
    window.dispatchEvent(new CustomEvent('login-music-state',{detail:{playing:audioState==='playing'}}));
  },[audioState]);

  useEffect(()=>{
    if(typeof window==='undefined') return;
    const onToggle=async()=>{
      const audio=audioRef.current,ctx=audioCtxRef.current;
      if(!audio||!ctx) return;
      if(ctx.state==='suspended') await ctx.resume();
      if(audio.paused){await audio.play().catch(()=>{});setAudioState('playing');}
      else{audio.pause();setAudioState('paused');}
    };
    window.addEventListener('login-music-toggle',onToggle as EventListener);
    window.addEventListener('login-music-skip',skipTrack as EventListener);
    return ()=>{ window.removeEventListener('login-music-toggle',onToggle as EventListener); window.removeEventListener('login-music-skip',skipTrack as EventListener); };
  },[skipTrack]);

  // ── Audio analysis ────────────────────────────────────────────────────────
  function analyseAudio(){
    if(!analyserRef.current||!freqRef.current){bandsRef.current=zeroBands();return;}
    analyserRef.current.getByteFrequencyData(freqRef.current);
    const d=freqRef.current,sampleRate=audioCtxRef.current!.sampleRate;
    const nyq=sampleRate/2,binHz=nyq/d.length;
    function band(lo:number,hi:number){
      let s=0,n=0;
      for(let i=Math.floor(lo/binHz);i<=Math.min(d.length-1,Math.ceil(hi/binHz));i++){s+=d[i];n++;}
      return n>0?s/(n*255):0;
    }
    const sub=band(20,60),bass=band(60,250),lm=band(250,500),mid=band(500,2000),
          hm=band(2000,4000),pr=band(4000,6000),br=band(6000,12000),air=band(12000,20000);
    const rms=sub*.2+bass*.25+lm*.15+mid*.15+hm*.1+pr*.07+br*.05+air*.03;
    const energy=sub*.5+bass*.5,bs=beatRef.current;
    let beat=bandsRef.current.beat*0.82;
    const now=performance.now()/1000;
    if(energy>bs.prev*1.35&&now-bs.lastBeat>0.18){beat=1.0;bs.lastBeat=now;}
    bs.prev=THREE.MathUtils.lerp(bs.prev,energy,0.15);
    bandsRef.current={subBass:sub,bass,lowMid:lm,mid,highMid:hm,presence:pr,brilliance:br,air,rms,beat};
  }

  // ── Three.js ──────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(window.innerWidth<768||!mountRef.current) return;
    const mount=mountRef.current;

    const scene=new THREE.Scene();
    scene.fog=new THREE.FogExp2(DEFAULT_DEBUG.topColor,0.008);
    const camera=new THREE.PerspectiveCamera(85,window.innerWidth/window.innerHeight,0.1,1000);
    const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
    renderer.setSize(window.innerWidth,window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    mount.appendChild(renderer.domElement);

    const composer=new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene,camera));
    const bloomPass=new UnrealBloomPass(new THREE.Vector2(window.innerWidth,window.innerHeight),1.0,0.2,0.15);
    composer.addPass(bloomPass);
    const rgbPass=new ShaderPass(RGBShiftShader);
    rgbPass.uniforms['amount'].value=0.001;
    composer.addPass(rgbPass);

    // Curve
    const N=400; const pts=[];
    for(let i=0;i<=N;i++){const t=i/N,a=t*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(a)*350,Math.sin(a*3)*35,Math.sin(a*2)*250));}
    const curve=new THREE.CatmullRomCurve3(pts,true);
    (curve as any).computeFrenetFrames=function(s:number){
      const T:THREE.Vector3[]=[],No:THREE.Vector3[]=[],B:THREE.Vector3[]=[];
      const up=new THREE.Vector3(0,1,0);
      for(let i=0;i<=s;i++){
        const tan=this.getTangentAt(i/s).normalize();T.push(tan);
        const bi=new THREE.Vector3().crossVectors(tan,up).normalize();B.push(bi);
        No.push(new THREE.Vector3().crossVectors(bi,tan).normalize());
      }
      return{tangents:T,normals:No,binormals:B};
    };
    const TR=15;
    const tubeGeo=new THREE.TubeGeometry(curve,N*2,TR,64,true);

    // ── Ambient + directional lights (needed for sphere shading) ─────────────
    const ambientLight = new THREE.AmbientLight(0x334466, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0x8899ff, 0.8);
    dirLight.position.set(1, 2, 1);
    scene.add(dirLight);

    // ── Glass sphere — rendered in a SEPARATE SCENE after composer ───────────
    // This avoids depth-buffer conflicts with the BackSide tunnel mesh.
    const SPHERE_R = 1.4;
    const sphereScene = new THREE.Scene(); // isolated — no fog, no tunnel

    const sphereVert = `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vWorldPos;
      void main() {
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormal   = normalize(normalMatrix * normal);
        vViewDir  = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `;

    // Fill: dark semi-transparent interior — always visible over bright bg
    const sphereSilFrag = `
      uniform float uTime;
      uniform vec3  uTint;
      uniform float uBeat;
      varying vec3 vNormal; varying vec3 vViewDir; varying vec3 vWorldPos;
      void main() {
        float ndv = max(0.0, dot(vNormal, vViewDir));
        float alpha = smoothstep(0.6, 0.05, ndv) * 0.6;
        float shimmer = sin(vWorldPos.x*5.0+uTime*1.5)*sin(vWorldPos.z*4.0-uTime*1.2)*0.5+0.5;
        vec3 col = mix(vec3(0.02,0.04,0.12), uTint*0.25, shimmer);
        gl_FragColor = vec4(col, alpha);
      }
    `;
    // Rim: bright fresnel edge — sharp and always punchy
    const sphereRimFrag = `
      uniform float uTime;
      uniform vec3  uTint;
      uniform float uBeat;
      uniform float uRMS;
      varying vec3 vNormal; varying vec3 vViewDir; varying vec3 vWorldPos;
      void main() {
        float ndv     = max(0.0, dot(vNormal, vViewDir));
        float fresnel = pow(1.0 - ndv, 2.8);
        float edge    = pow(1.0 - ndv, 7.0);
        float shimmer = sin(vWorldPos.x*8.0+uTime*2.0)*sin(vWorldPos.y*6.0-uTime*1.6)*0.5+0.5;
        vec3 rimCol = mix(vec3(0.6, 0.85, 1.0), uTint+0.2, shimmer);
        rimCol *= (1.0 + uBeat*1.5 + uRMS*0.5);
        vec3 edgeCol = vec3(1.0)*(0.9+uBeat*0.5);
        float alpha = fresnel*0.8 + edge*1.0;
        gl_FragColor = vec4(rimCol*fresnel + edgeCol*edge, clamp(alpha,0.0,1.0));
      }
    `;
    // Outer halo (additive, bigger sphere)
    const sphereHaloFrag = `
      uniform vec3  uTint;
      uniform float uBeat;
      varying vec3 vNormal; varying vec3 vViewDir;
      void main() {
        float ndv  = max(0.0, dot(vNormal, vViewDir));
        float halo = pow(1.0-ndv, 3.5) * (0.4 + uBeat*0.5);
        gl_FragColor = vec4(uTint*(1.2+uBeat), halo);
      }
    `;

    const mkU = (tint:number) => ({
      uTime:{value:0}, uTint:{value:new THREE.Color(tint)},
      uBeat:{value:0}, uRMS:{value:0},
    });

    const sphereGeo   = new THREE.SphereGeometry(SPHERE_R, 64, 64);
    const haloGeo     = new THREE.SphereGeometry(SPHERE_R*1.4, 32, 32);

    const sphereSilMat = new THREE.ShaderMaterial({
      vertexShader:sphereVert, fragmentShader:sphereSilFrag,
      uniforms:mkU(0x3366bb),
      transparent:true, side:THREE.FrontSide, depthWrite:false, depthTest:false,
      blending:THREE.NormalBlending, renderOrder:1,
    });
    const sphereRimMat = new THREE.ShaderMaterial({
      vertexShader:sphereVert, fragmentShader:sphereRimFrag,
      uniforms:{...mkU(0x4488ff), uRMS:{value:0}},
      transparent:true, side:THREE.FrontSide, depthWrite:false, depthTest:false,
      blending:THREE.NormalBlending, renderOrder:2,
    });
    const sphereHaloMat = new THREE.ShaderMaterial({
      vertexShader:sphereVert, fragmentShader:sphereHaloFrag,
      uniforms:{uTint:{value:new THREE.Color(0x2255cc)}, uBeat:{value:0}},
      transparent:true, side:THREE.BackSide, depthWrite:false, depthTest:false,
      blending:THREE.AdditiveBlending, renderOrder:0,
    });

    const sphereSilMesh  = new THREE.Mesh(sphereGeo, sphereSilMat);
    const sphereRimMesh  = new THREE.Mesh(sphereGeo, sphereRimMat);
    const sphereHaloMesh = new THREE.Mesh(haloGeo,   sphereHaloMat);

    const sphereGroup = new THREE.Group();
    sphereGroup.add(sphereHaloMesh);
    sphereGroup.add(sphereSilMesh);
    sphereGroup.add(sphereRimMesh);
    sphereScene.add(sphereGroup);

    // Light in main scene (illuminates tunnel around sphere position)
    const sphereLight = new THREE.PointLight(0x88aaff, 1.2, 25);
    scene.add(sphereLight);

    // Physics state — will be corrected to camera position on first frame
    const sphState = {
      pos: new THREE.Vector3(352, 3, 4), // near curve t=0 — corrected first frame
      vel: new THREE.Vector3(0, 0, 0),
      initialized: false,
    };

    // Matrix texture
    const mc=document.createElement('canvas');mc.width=mc.height=1024;
    const mctx=mc.getContext('2d')!;
    mctx.fillStyle='#000';mctx.fillRect(0,0,1024,1024);
    mctx.fillStyle='#fff';mctx.font='bold 44px monospace';mctx.textAlign='center';mctx.textBaseline='middle';
    for(let y=24;y<1024;y+=48)for(let x=24;x<1024;x+=48){
      mctx.globalAlpha=0.4+Math.random()*0.6;mctx.fillText(String.fromCharCode(0xFF66+Math.floor(Math.random()*55)),x,y);
    }
    const matTex=new THREE.CanvasTexture(mc);matTex.wrapS=matTex.wrapT=THREE.RepeatWrapping;

    // Portal
    const pc=document.createElement('canvas');pc.width=pc.height=512;
    const pctx=pc.getContext('2d')!;
    const pTex=new THREE.CanvasTexture(pc);
    const pGeo=new THREE.CircleGeometry(TR*0.82,64);
    const pMat=new THREE.MeshBasicMaterial({map:pTex,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
    const pMesh=new THREE.Mesh(pGeo,pMat);scene.add(pMesh);

    function drawPortal(opacity:number,b:AudioBands){
      pctx.clearRect(0,0,512,512);
      const t=performance.now()/1000;
      [[256*0.9,`rgba(${Math.round(80+175*b.subBass)},30,220,`],[256*0.65,`rgba(255,${Math.round(80+175*b.bass)},10,`],[256*0.4,`rgba(20,${Math.round(180+75*b.mid)},255,`]].forEach(([r,col])=>{
        const g=pctx.createRadialGradient(256,256,(r as number)*0.05,256,256,r as number);
        g.addColorStop(0,(col as string)+(opacity*0.95)+')');g.addColorStop(1,(col as string)+'0)');
        pctx.beginPath();pctx.arc(256,256,r as number,0,Math.PI*2);pctx.fillStyle=g;pctx.fill();
      });
      if(b.beat>0.2){pctx.beginPath();pctx.arc(256,256,100*b.beat,0,Math.PI*2);pctx.fillStyle=`rgba(255,255,255,${opacity*b.beat*0.7})`;pctx.fill();}
      if(b.presence>0.1){
        for(let i=0;i<6;i++){
          const ang=t*2+i*(Math.PI/3);
          pctx.save();pctx.translate(256,256);pctx.rotate(ang);
          const sg=pctx.createLinearGradient(0,-256,0,256);
          sg.addColorStop(0,'rgba(255,255,255,0)');sg.addColorStop(0.5,`rgba(255,180,50,${opacity*b.presence*0.3})`);sg.addColorStop(1,'rgba(255,255,255,0)');
          pctx.fillStyle=sg;pctx.fillRect(-2,-256,4,512);pctx.restore();
        }
      }
      pTex.needsUpdate=true;
    }

    const vert=`varying vec2 vUv;varying vec3 vWP;varying vec3 vWN;
    void main(){vUv=uv;vWN=normalize(mat3(modelMatrix)*normal);vec4 wp=modelMatrix*vec4(position,1.0);vWP=wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`;

    const frag=`
    uniform float uTime;uniform vec3 uTop,uBot;
    uniform float uAngle,uIntensity,uDepth,uRefStr,uShowRings,uRingCount,uGhost,uMatrix;
    uniform sampler2D uMatTex;
    uniform float uSub,uBass,uLM,uMid,uHM,uPres,uBril,uAir,uBeat,uRMS;
    varying vec2 vUv;varying vec3 vWP,vWN;
    float rand(float n){return fract(sin(n)*43758.5453123);}
    vec3 line(vec3 col,float uvP,float tgt,float w,float uvS,float id,float t,float spd,bool ring){
      float sh=ring?tgt:tgt+(rand(id*8.2)-.5)*.12;
      float wt=exp(-pow((uvP-sh)*w*(0.1+rand(id*4.5)*12.),2.));
      float sp=(0.5+rand(id)*4.)*spd,dir=rand(id*2.1)>.5?1.:-1.;
      float sc=ring?floor(2.+rand(id*1.3)*6.):.05+rand(id*1.3)*30.;
      float ph=rand(id*1.7)*20.;
      float pos=fract(uvS*sc+t*sp*dir+ph);
      float len=.01+rand(id*3.4)*.93,fd=.01+rand(id*7.1)*.08;
      float mask=smoothstep(0.,fd,pos)*smoothstep(len+fd,len,pos);
      float bPos=fract(uvS*sc*.1+t*sp*.1*dir+ph*2.);
      float bMask=smoothstep(0.,.1,bPos)*smoothstep(.9,.8,bPos);
      return col*wt*(0.25*bMask+0.85*mask);
    }
    vec3 dot3(vec3 col,float uvP,float tgt,float w,float uvS,float id,float t,float spd){
      float wt=exp(-pow((uvP-tgt)*w*(0.5+rand(id*6.1)*3.),2.));
      float sp=(2.+rand(id)*4.)*spd,dir=rand(id*2.1)>.5?1.:-1.;
      float pos=fract(uvS*(10.+rand(id*1.3)*80.)+t*sp*dir+rand(id*1.7)*10.);
      float len=.001+rand(id*3.4)*.015;
      return col*wt*smoothstep(0.,.005,pos)*smoothstep(len+.005,len,pos)*4.;
    }
    vec3 ghost(float h,float uvX,float t,float seed){
      float sc=uvX*12.+t*.3*(rand(seed)>.5?1.:-1.);
      float idX=floor(sc),lx=fract(sc);
      float hasP=step(.7,rand(idX+seed)),idY=floor(h*80.);
      float hasB=step(.3,rand(idY*15.+idX));
      float pulse=pow(sin(t*1.2+rand(idX)*10.)*.5+.5,2.);
      float mx=smoothstep(0.,.2,lx)*smoothstep(1.,.8,lx);
      vec3 tc=mix(vec3(.2,.7,1.),vec3(1.,.3,.7),rand(idX*1.1));
      vec3 panel=tc*hasP*hasB*mx*pulse*.35;
      float wave=pow(sin(uvX*5.+t*.5+seed)*sin(h*10.-t*.4+seed)*.5+.5,5.);
      vec3 wash=mix(vec3(.1,.5,1.),vec3(.8,.1,.5),rand(seed*2.))*wave*.03;
      return (panel+wash)*uGhost;
    }
    vec3 rightSide(float h,float uvX,float t){
      vec3 c=vec3(0.);float hw=h+sin(uvX*100.)*.003;
      float bB=1.+uBass*2.+uBeat*1.5,mB=1.+uMid*1.5+uHM,hB=1.+uPres*1.2+uBril*.8;
      float sB=2.+uBass*3.,sM=2.+uMid*2.5,sH=2.+uPres*4.;
      c+=line(vec3(.2,.4,1.)*bB,hw,.35,60.,uvX*100.,10.,t,sB,false);c+=line(vec3(1.,.2,.7)*bB,hw,.28,300.,uvX*100.,11.,t,sB,false);c+=line(vec3(1.,.6,.1)*bB,hw,.20,120.,uvX*100.,12.,t,sB,false);
      c+=line(vec3(0.,.8,1.)*mB,hw,.10,40.,uvX*100.,13.,t,sM,false);c+=line(vec3(1.,.9,.2)*mB,hw,.02,500.,uvX*100.,14.,t,sM,false);c+=line(vec3(.1,.9,.3)*mB,hw,-.08,150.,uvX*100.,15.,t,sM,false);
      c+=line(vec3(1.,.4,0.)*hB,hw,-.18,80.,uvX*100.,16.,t,sH,false);c+=line(vec3(1.,.1,.1)*hB,hw,-.28,400.,uvX*100.,17.,t,sH,false);
      float bf=.5+uBeat*2.;c+=line(vec3(1.),hw,.28,450.,uvX*100.,18.,t,2.5+uBeat*5.,false)*bf;c+=line(vec3(1.),hw,.10,800.,uvX*100.,19.,t,2.5+uBeat*5.,false)*bf;
      c+=line(vec3(.8,.9,1.)*(1.+uAir*3.),hw,.40,2000.,uvX*100.,50.,t,1.+uAir*8.,false)*uAir;c+=line(vec3(.6,1.,.8)*(1.+uAir*3.),hw,-.35,1500.,uvX*100.,51.,t,1.+uAir*6.,false)*uAir;
      c+=dot3(vec3(1.,.5,1.)*mB,hw,.30,400.,uvX*100.,80.,t,1.5+uMid*2.);c+=dot3(vec3(.5,1.,1.)*hB,hw,.15,350.,uvX*100.,81.,t,2.5+uHM*3.);c+=dot3(vec3(1.,1.,.5)*mB,hw,-.05,450.,uvX*100.,82.,t,2.+uLM*2.);c+=dot3(vec3(1.,.2,.2)*bB,hw,-.20,300.,uvX*100.,83.,t,3.+uBass*4.);
      c+=ghost(hw,uvX,t,112.3);return c;
    }
    vec3 leftSide(float h,float uvX,float t){
      vec3 c=vec3(0.);float hw=h+sin(uvX*120.+1.)*.003;
      float bB=1.+uBass*2.+uBeat*1.5,mB=1.+uMid*1.5+uHM,hB=1.+uPres*1.2+uBril*.8;
      float sB=2.+uBass*3.,sM=2.+uMid*2.5,sH=2.+uPres*4.;
      c+=line(vec3(1.,.4,0.)*bB,hw,.32,70.,uvX*100.,20.,t,sB,false);c+=line(vec3(1.,.1,.5)*bB,hw,.25,350.,uvX*100.,21.,t,sB,false);c+=line(vec3(.1,.6,1.)*mB,hw,.15,120.,uvX*100.,22.,t,sM,false);c+=line(vec3(.2,.9,.4)*mB,hw,.05,50.,uvX*100.,23.,t,sM,false);c+=line(vec3(1.,.8,0.)*mB,hw,-.05,450.,uvX*100.,24.,t,sM,false);c+=line(vec3(1.,.2,.1)*hB,hw,-.15,150.,uvX*100.,25.,t,sH,false);c+=line(vec3(.6,.1,1.)*hB,hw,-.25,60.,uvX*100.,26.,t,sH,false);
      float bf=.5+uBeat*2.;c+=line(vec3(1.),hw,.15,600.,uvX*100.,27.,t,2.5+uBeat*5.,false)*bf;c+=line(vec3(1.),hw,-.05,900.,uvX*100.,28.,t,2.5+uBeat*5.,false)*bf;
      c+=line(vec3(.9,.8,1.)*(1.+uAir*3.),hw,.38,2000.,uvX*100.,52.,t,1.+uAir*8.,false)*uAir;
      c+=dot3(vec3(1.,.8,.2)*mB,hw,.28,350.,uvX*100.,90.,t,1.8+uMid*2.);c+=dot3(vec3(.2,.8,1.)*hB,hw,.10,400.,uvX*100.,91.,t,2.2+uHM*3.);c+=dot3(vec3(.5,1.,.5)*mB,hw,-.10,300.,uvX*100.,92.,t,1.5+uLM*2.);c+=dot3(vec3(1.,.4,.8)*bB,hw,-.20,450.,uvX*100.,93.,t,2.7+uBass*4.);
      c+=ghost(hw,uvX,t,442.1);return c;
    }
    vec3 rings(float uvX,float uvY,float t){
      vec3 c=vec3(0.);float lx=fract(uvX*uRingCount),cid=floor(uvX*uRingCount),rt=fract(rand(cid)*10.);
      vec3 rc;
      if(rt<.2)rc=vec3(1.,.2,.7)*(1.+uSub*3.);else if(rt<.4)rc=vec3(0.,.8,1.)*(1.+uBass*2.5);else if(rt<.6)rc=vec3(1.,.6,.1)*(1.+uLM*2.);else if(rt<.8)rc=vec3(.1,.9,.3)*(1.+uMid*2.);else rc=vec3(1.,.9,.2)*(1.+uBeat*4.);
      c+=line(rc,lx,.5,60.+rand(cid)*40.,uvY,cid,t,1.+uBass*2.,true);
      return c*(rand(cid+10.)>.3?1.:0.);
    }
    void main(){
      float y=fract(vUv.y+uAngle),cy=sin(y*6.2831853),cx=cos(y*6.2831853);
      vec3 bg=mix(uBot,uTop,smoothstep(-.2,.5,cy))*(1.+uSub*.5+uBeat*.3);
      vec3 st=cx>0.?rightSide(cy,vUv.x,uTime):leftSide(cy,vUv.x,uTime);
      vec3 ceil=vec3(0.);
      if(cy>.4){float hc=cy+sin(vUv.x*80.)*.005;float cs=.5+uMid*2.;ceil+=line(vec3(.6,.8,1.),hc,.70,500.,vUv.x*100.,30.,uTime,cs,false)*.5;ceil+=line(vec3(.8,.9,1.)*(1.+uHM),hc,.82,800.,vUv.x*100.,31.,uTime,cs,false)*.7;ceil+=line(vec3(.9,.95,1.)*(1.+uPres),hc,.92,1000.,vUv.x*100.,32.,uTime,cs*1.2,false)*.9;ceil+=line(vec3(1.)*(1.+uBeat*2.),hc,.76,600.,vUv.x*100.,40.,uTime,3.+uBeat*5.,false)*.7;}
      float sm=smoothstep(.7,.1,abs(cy));
      vec3 fc=bg+(st*uIntensity*sm)+(ceil*uIntensity);
      if(uShowRings>.5)fc+=rings(vUv.x,y,uTime)*uIntensity*smoothstep(-.8,-.4,cy);
      if(uMatrix>0.){vec2 tu=vec2(vUv.x*250.,y*14.);float tv=texture2D(uMatTex,tu).r,sid=floor(tu.y);float sp=.5+rand(sid*1.5)*1.5+uBril*3.,dir=rand(sid*3.3)>.5?1.:-1.;float tp=fract(vUv.x*8.+uTime*sp*dir+rand(sid*7.1)*10.);float trM=smoothstep(0.,.8,tp)*smoothstep(1.,.95,tp),hM=smoothstep(.95,1.,tp);float fl=sin(uTime*15.+rand(floor(tu.x)+sid*100.)*20.)*.5+.5;vec3 mc2=mix(vec3(0.,.9,.3),vec3(.6,1.,.8),hM);fc+=mc2*tv*(trM*.6+hM*2.)*(0.3+0.7*fl)*(uMatrix+uAir*.5)*smoothstep(.8,.2,abs(cy))*uIntensity;}
      if(cy<-.2&&uRefStr>0.){float rip=sin(vUv.x*300.-uTime*5.)*(0.03+uSub*.05)+sin(vUv.x*1000.)*.01;float rcx=cx+rip;vec3 ref=rcx>0.?rightSide(abs(cy),vUv.x,uTime):leftSide(abs(cy),vUv.x,uTime);fc+=ref*uRefStr*smoothstep(-.2,-.8,cy)*smoothstep(-1.,-.9,cy);}
      float ff=exp(-length(cameraPosition-vWP)*uDepth);float fr=max(0.,dot(-vWN,normalize(cameraPosition-vWP)));fc*=mix(.5,1.,smoothstep(0.,.8,fr));fc=mix(uBot,fc,ff);
      gl_FragColor=vec4(fc,1.);
    }`;

    const U:Record<string,THREE.IUniform>={
      uTime:{value:0},uTop:{value:new THREE.Color(DEFAULT_DEBUG.topColor)},uBot:{value:new THREE.Color(DEFAULT_DEBUG.bottomColor)},
      uAngle:{value:-.25},uIntensity:{value:1.2},uDepth:{value:.001},uRefStr:{value:.35},
      uShowRings:{value:1.},uRingCount:{value:10.},uGhost:{value:1.},
      uMatTex:{value:matTex},uMatrix:{value:.25},
      uSub:{value:0},uBass:{value:0},uLM:{value:0},uMid:{value:0},uHM:{value:0},uPres:{value:0},uBril:{value:0},uAir:{value:0},uBeat:{value:0},uRMS:{value:0},
    };
    const tubeMat=new THREE.ShaderMaterial({vertexShader:vert,fragmentShader:frag,uniforms:U,side:THREE.BackSide});
    scene.add(new THREE.Mesh(tubeGeo,tubeMat));

    const pals=[{t:'#0a198c',b:'#11133b'},{t:'#004d1a',b:'#001a08'},{t:'#4a0072',b:'#1a0029'},{t:'#801300',b:'#2b0600'},{t:'#004059',b:'#00141c'}];
    let pi=0;
    let mx=0,my=0,tmx=0,tmy=0;
    const onMouse=(e:MouseEvent)=>{tmx=(e.clientX/window.innerWidth)*2-1;tmy=-(e.clientY/window.innerHeight)*2+1;};
    const onClick=()=>{pi=(pi+1)%pals.length;const nc=pals[pi];setDebugParams(p=>({...p,topColor:nc.t,bottomColor:nc.b}));};
    window.addEventListener('mousemove',onMouse);window.addEventListener('click',onClick);

    const clock=new THREE.Clock();
    let prog=0,curSpd=DEFAULT_DEBUG.speed;
    let animId:number;

    function getPos(t:number,yo:number){
      const pos=curve.getPointAt(t),tan=curve.getTangentAt(t).normalize();
      const up=new THREE.Vector3(0,1,0),right=new THREE.Vector3().crossVectors(tan,up).normalize();
      return pos.add(new THREE.Vector3().crossVectors(right,tan).normalize().multiplyScalar(yo));
    }

    function animate(){
      animId=requestAnimationFrame(animate);
      const dt=Math.min(clock.getDelta(),.05),time=clock.getElapsedTime();
      analyseAudio();

      // ── Ramp 1: speed+reactivity on audio start ───────────────────────────
      if(audioRampRef.current.active){
        const rR=0.770,rA=1.2,rRate=dt*0.18;
        setDebugParams(p=>{
          const nS=Math.abs(p.speed-rR)<0.002?rR:p.speed+(rR-p.speed)*rRate;
          const nA=Math.abs(p.audioReactivity-rA)<0.005?rA:p.audioReactivity+(rA-p.audioReactivity)*rRate;
          if(Math.abs(nS-rR)<0.002&&Math.abs(nA-rA)<0.005)audioRampRef.current.active=false;
          return{...p,speed:nS,audioReactivity:nA};
        });
      }

      const b=bandsRef.current,live=debugRef.current,ar=live.audioReactivity;
      const L=0.12;
      U.uSub.value=THREE.MathUtils.lerp(U.uSub.value,b.subBass*ar,L);U.uBass.value=THREE.MathUtils.lerp(U.uBass.value,b.bass*ar,L);U.uLM.value=THREE.MathUtils.lerp(U.uLM.value,b.lowMid*ar,L);U.uMid.value=THREE.MathUtils.lerp(U.uMid.value,b.mid*ar,L);U.uHM.value=THREE.MathUtils.lerp(U.uHM.value,b.highMid*ar,L);U.uPres.value=THREE.MathUtils.lerp(U.uPres.value,b.presence*ar,L);U.uBril.value=THREE.MathUtils.lerp(U.uBril.value,b.brilliance*ar,L);U.uAir.value=THREE.MathUtils.lerp(U.uAir.value,b.air*ar,L);U.uBeat.value=THREE.MathUtils.lerp(U.uBeat.value,b.beat*ar,.25);U.uRMS.value=THREE.MathUtils.lerp(U.uRMS.value,b.rms*ar,L);
      U.uTime.value=time;U.uTop.value.set(live.topColor);U.uBot.value.set(live.bottomColor);
      U.uIntensity.value=live.lightIntensity+b.rms*ar*.8;U.uGhost.value=live.ghostIntensity;
      U.uMatrix.value=live.matrixIntensity;  // matrix shader (particles) always driven by matrixIntensity
      U.uRefStr.value=live.reflectionStrength;
      if(scene.fog)(scene.fog as THREE.FogExp2).color.set(live.topColor);
      curSpd=THREE.MathUtils.lerp(curSpd,live.speed+b.beat*.12*ar,dt*2.);
      camera.fov=THREE.MathUtils.lerp(camera.fov,85+b.bass*10*ar,dt*3.);camera.updateProjectionMatrix();
      rgbPass.uniforms['amount'].value=THREE.MathUtils.lerp(rgbPass.uniforms['amount'].value,live.rgbShiftAmount+b.brilliance*.006*ar+b.beat*.003*ar,dt*3.);
      bloomPass.strength=THREE.MathUtils.lerp(bloomPass.strength,live.bloomStrength+b.bass*1.5*ar+b.beat*.8*ar,dt*3.);
      prog=(prog+curSpd*dt*.1)%1.;
      const cp=getPos(prog,3.),la=curve.getPointAt((prog+.012)%1.);
      camera.position.copy(cp);camera.lookAt(la);
      mx=THREE.MathUtils.lerp(mx,tmx,dt*4.);my=THREE.MathUtils.lerp(my,tmy,dt*4.);
      camera.translateX(mx*5.);camera.translateY(my*2.5);camera.rotateZ(-mx*.5);camera.rotateX(my*.25);

      // ── Sphere physics ────────────────────────────────────────────────────
      const mp=mousePosRef.current;
      // Build camera axes AFTER all camera transforms so matrix is up to date
      camera.updateMatrixWorld();
      const camRight=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
      const camUp2=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
      const camFwd=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,2).negate().normalize();

      // On first frame, snap sphere in front of camera so it's immediately visible
      if(!sphState.initialized){
        sphState.pos.copy(camera.position).addScaledVector(camFwd, 3.5);
        sphState.initialized=true;
      }

      // Mouse target: 4 units ahead (very close), offset by mouse
      const mouseTarget=camera.position.clone()
        .addScaledVector(camFwd, 4.0)
        .addScaledVector(camRight, mp.x * 3.5)
        .addScaledVector(camUp2,  mp.y * 2.5);

      // Spring attraction toward mouse target (delayed / inertial)
      const toTarget=mouseTarget.clone().sub(sphState.pos);
      const distToMouse=toTarget.length();
      const springK = 9.0; // tighter spring — follows mouse more responsively
      sphState.vel.addScaledVector(toTarget.normalize(), Math.min(distToMouse * springK, 30) * dt);
      // Fluid damping
      sphState.vel.multiplyScalar(Math.exp(-10 * dt));
      sphState.pos.addScaledVector(sphState.vel, dt);

      // Wall constraint: clamp laterally within tunnel (sphere is close to camera, use smaller radius)
      const toSphere=sphState.pos.clone().sub(camera.position);
      const fwdProj=toSphere.dot(camFwd);
      const lateral=toSphere.clone().addScaledVector(camFwd, -fwdProj);
      const latLen=lateral.length();
      const maxR = 5.5; // tight — sphere stays well within visible tunnel walls
      if(latLen > maxR) {
        const n=lateral.clone().normalize();
        sphState.pos.addScaledVector(n, -(latLen - maxR));
        const vDotN=sphState.vel.dot(n);
        if(vDotN > 0) sphState.vel.addScaledVector(n, -vDotN * 1.4);
      }

      // Update sphere uniforms + position
      const beatPulse = 1.0 + b.beat * 0.35;
      const tint = new THREE.Color(
        0.3 + b.subBass * 0.7,
        0.4 + b.mid * 0.6,
        0.6 + b.air * 0.4
      );
      // Update Three.js sphere meshes (separate scene)
      sphereRimMat.uniforms.uTime.value  = time;
      sphereRimMat.uniforms.uBeat.value  = b.beat * ar;
      sphereRimMat.uniforms.uRMS.value   = b.rms  * ar;
      sphereRimMat.uniforms.uTint.value.copy(tint);
      sphereSilMat.uniforms.uTime.value  = time;
      sphereSilMat.uniforms.uBeat.value  = b.beat * ar;
      sphereSilMat.uniforms.uTint.value.copy(tint.clone().multiplyScalar(0.5));
      sphereHaloMat.uniforms.uBeat.value = b.beat * ar;
      sphereHaloMat.uniforms.uTint.value.copy(tint);
      // Position + scale the group
      sphereGroup.position.copy(sphState.pos);
      sphereGroup.scale.setScalar(beatPulse);
      sphereLight.position.copy(sphState.pos);
      sphereLight.color.copy(tint);
      sphereLight.intensity = 0.5 + b.rms * ar * 1.5;

      // Portal
      const pv=portalRef.current;
      if(!pv.active&&time>pv.nextShow){pv.active=true;pv.opacity=0;pv.hold=time+4+Math.random()*5;pv.nextShow=pv.hold+15+Math.random()*25;}
      if(pv.active){
        if(time<pv.hold)pv.opacity=Math.min(1,pv.opacity+dt*.7);
        else{pv.opacity=Math.max(0,pv.opacity-dt*.35);if(pv.opacity<=0)pv.active=false;}
        drawPortal(pv.opacity,b);pMat.opacity=pv.opacity*.9;
        const pt=(prog+.08)%1.,ppos=curve.getPointAt(pt),ptan=curve.getTangentAt(pt).normalize();
        pMesh.position.copy(ppos);pMesh.lookAt(ppos.clone().add(ptan));
      } else pMat.opacity=0;

      // Render tunnel through post-processing composer
      composer.render();

      // Sphere light still illuminates the tunnel (no visual sphere mesh needed)
      sphereLight.position.copy(sphState.pos);
    }

    portalRef.current.nextShow=6+Math.random()*10;
    const onResize=()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);composer.setSize(window.innerWidth,window.innerHeight);};
    window.addEventListener('resize',onResize);
    animate();

    return ()=>{
      cancelAnimationFrame(animId);
      window.removeEventListener('resize',onResize);window.removeEventListener('mousemove',onMouse);window.removeEventListener('click',onClick);
      if(mount.contains(renderer.domElement))mount.removeChild(renderer.domElement);
      renderer.dispose();tubeMat.dispose();tubeGeo.dispose();pGeo.dispose();pMat.dispose();pTex.dispose();matTex.dispose();
      sphereGeo.dispose();haloGeo.dispose();sphereRimMat.dispose();sphereSilMat.dispose();sphereHaloMat.dispose();
    };
  },[]);

  // ── Ramp intervals (run outside Three.js loop for smooth gradual effect) ──
  useEffect(()=>{
    // 60s ramp: +35% reactivity over ~15s window
    const r60=setInterval(()=>{
      const ramp=audioRampRef.current;
      if(ramp.audioStartTime<=0) return;
      const elapsed=(performance.now()-ramp.audioStartTime)/1000;
      if(elapsed<60||elapsed>75) return;
      setDebugParams(p=>({...p,audioReactivity:parseFloat(Math.min(3,p.audioReactivity*1.0035).toFixed(4))}));
    },150);
    // 2min ramp: +25% ALL params over ~20s window
    const r120=setInterval(()=>{
      const ramp=audioRampRef.current;
      if(ramp.audioStartTime<=0) return;
      const elapsed=(performance.now()-ramp.audioStartTime)/1000;
      if(elapsed<120||elapsed>140) return;
      setDebugParams(p=>{
        const f=1.0018; // small multiplier each tick → ~+25% over 20s (140 ticks × ln(1.0018) ≈ 0.252)
        return {
          ...p,
          bloomStrength:    parseFloat(Math.min(3,   p.bloomStrength*f).toFixed(4)),
          speed:            parseFloat(Math.min(2,   p.speed*f).toFixed(4)),
          lightIntensity:   parseFloat(Math.min(3,   p.lightIntensity*f).toFixed(4)),
          rgbShiftAmount:   parseFloat(Math.min(0.02,p.rgbShiftAmount*f).toFixed(5)),
          matrixIntensity:  parseFloat(Math.min(1,   p.matrixIntensity*f).toFixed(4)),
          reflectionStrength:parseFloat(Math.min(1,  p.reflectionStrength*f).toFixed(4)),
          ghostIntensity:   parseFloat(Math.min(3,   p.ghostIntensity*f).toFixed(4)),
          audioReactivity:  parseFloat(Math.min(3,   p.audioReactivity*f).toFixed(4)),
        };
      });
    },150);
    return ()=>{ clearInterval(r60); clearInterval(r120); };
  },[]);

  const audioPlaying=audioState==='playing';
  const live=debugParams;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">

      {/* Debug toggle — always mounted when showDebug, visibility toggled via opacity */}
      {showDebug&&(
        <>
          <div
            className="fixed left-4 top-1/2 -translate-y-1/2 z-[60] transition-opacity duration-150"
            style={{opacity: debugOpen ? 0 : 1, pointerEvents: debugOpen ? 'none' : 'auto'}}
          >
            <button type="button" onClick={()=>setDebugOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950/90 backdrop-blur-xl border border-white/10 text-slate-300 hover:text-white hover:border-orange-500/40 transition-all font-bold text-sm">
              <Settings2 size={16}/>Debug
              {audioPlaying&&<span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>}
            </button>
          </div>
          {debugOpen&&(
            <DebugPanel
              params={debugParams} onChange={handleChange}
              onClose={()=>setDebugOpen(false)} onReset={()=>setDebugParams({...DEFAULT_DEBUG})}
              bandsRef={bandsRef} playing={audioPlaying}
              hideCard={hideCard} onToggleCard={()=>setHideCard(v=>!v)}
              trackName={trackName} onSkip={skipTrack} eqState={eqState}
            />
          )}
        </>
      )}

      {/* Three.js canvas */}
      <div ref={mountRef} className="hidden md:block absolute inset-0 z-0"/>

      {/* TV CRT overlay — controlled by tvFilterEnabled */}
      {live.tvFilterEnabled>0&&(
        <div className="hidden md:block absolute inset-0 z-[1] pointer-events-none bg-black/60 shadow-[inset_0_0_150px_rgba(0,0,0,0.8)]"
          style={{backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.3) 2px,rgba(0,0,0,0.3) 4px)'}}/>
      )}

      {/* Mobile fallback */}
      <div className="absolute md:hidden top-0 left-0 w-[500px] h-[500px] bg-orange-600/20 blur-[120px] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 z-0"/>

      {/* Login card */}
      <div className={`relative z-10 w-full max-w-md transition-opacity duration-200 ${hideCard?'opacity-0 pointer-events-none':''}`}>
        <Suspense fallback={<div className="text-white text-center">Cargando...</div>}>
          <LoginForm/>
        </Suspense>
      </div>

      {/* Audio state hints */}
      {audioState==='idle'&&(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 hidden md:flex items-center gap-3 px-5 py-2.5 rounded-full pointer-events-none select-none"
          style={{background:'rgba(2,4,20,0.85)',backdropFilter:'blur(12px)',border:'1px solid rgba(255,255,255,0.07)'}}>
          <kbd className="text-[10px] font-black tracking-widest text-slate-300 bg-white/10 px-2 py-1 rounded-md">SPACE</kbd>
          <span className="text-[11px] text-slate-500">activar música reactiva</span>
        </div>
      )}
      {audioState==='loading'&&(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 hidden md:flex items-center gap-3 px-5 py-2.5 rounded-full pointer-events-none select-none"
          style={{background:'rgba(2,4,20,0.85)',backdropFilter:'blur(12px)',border:'1px solid rgba(255,165,0,0.25)'}}>
          <Loader2 size={13} className="text-orange-400 animate-spin"/>
          <span className="text-[11px] text-slate-400">Cargando audio...</span>
        </div>
      )}

      {/* EQ + Sampler badges */}
      <EQBadge eq={eqState} samplerState={samplerState}/>

      {/* Glass cursor — CSS spring physics, always visible */}
      <GlassCursor
        mousePixelRef={mousePixelRef}
        bandsRef={bandsRef}
        audioPlaying={audioPlaying}
      />
    </div>
  );
}