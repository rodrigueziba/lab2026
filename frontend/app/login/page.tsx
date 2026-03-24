'use client';
import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Loader2, AlertCircle, Settings2, X, Activity, Play, Pause, SkipForward } from 'lucide-react';

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
  // Sphere
  sphSize: number;            // 0.2–4  sphere scale multiplier  ← NEW
  sphRefraction: number;      // 0–1  refraction strength
  sphFractalSpeed: number;    // 0.1–3 zoom + animation speed
  sphFractalIter: number;     // 8–64  Julia iterations (detail)
  sphFractalIntensity: number;// 0–1  fractal vs plain refraction
  sphFractalScale: number;    // 0.1–2 fractal window size (zoom out/in)
  sphPalette: number;         // 0–4  color palette index
}
const DEFAULT_DEBUG: DebugParams = {
  topColor:'#0a198c', bottomColor:'#11133b',
  bloomStrength:1.0, speed:0.069, lightIntensity:1.2,
  rgbShiftAmount:0.001, matrixIntensity:0.25,
  tvFilterEnabled:1,
  reflectionStrength:0.35, ghostIntensity:1.0,
  audioReactivity:1.0,
  sphSize:1.0,               // ← NEW
  sphRefraction:0.71,
  sphFractalSpeed:1.49,
  sphFractalIter:61,
  sphFractalIntensity:0.56,
  sphFractalScale:1.47,
  sphPalette:0,
};

// ─── Login Form ───────────────────────────────────────────────────────────────
function LoginForm({ onMobilePlay }: { onMobilePlay?: () => void | Promise<void> }) {
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

      {/* Mobile: esfera cromada (sin texto ni iconos) — referencia estética tipo “mercury sphere” */}
      {onMobilePlay && (
        <div className="mt-8 flex justify-center md:hidden">
          <button
            type="button"
            onClick={() => void onMobilePlay()}
            aria-label="Activar música y fondo reactivo"
            className="h-[88px] w-[88px] shrink-0 rounded-full active:scale-[0.96] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            style={{
              background: `
                radial-gradient(circle at 28% 26%, rgba(255,255,255,1) 0%, rgba(255,255,255,0.55) 6%, rgba(255,255,255,0.12) 14%, transparent 38%),
                radial-gradient(circle at 18% 20%, rgba(255,255,255,0.9) 0%, transparent 12%),
                radial-gradient(circle at 24% 30%, rgba(255,255,255,0.95) 0%, transparent 4%),
                radial-gradient(circle at 78% 82%, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 38%, transparent 58%),
                radial-gradient(circle at 50% 50%, #c4c4c4 0%, #6b7280 42%, #1f2937 72%, #0a0a0a 100%)
              `,
              boxShadow: `
                inset -20px -26px 40px rgba(0,0,0,0.72),
                inset 18px 22px 34px rgba(255,255,255,0.38),
                0 14px 36px rgba(0,0,0,0.55),
                0 0 0 1px rgba(255,255,255,0.08)
              `,
            }}
          />
        </div>
      )}
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

// ─── Barra de scroll táctil (debug móvil inmersivo) ──────────────────────────
function LoginMobileScrollRail({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ top: 0, h: 56, show: false });

  const sync = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + 2) {
      setThumb((t) => ({ ...t, show: false }));
      return;
    }
    const thumbH = Math.max(52, (clientHeight / scrollHeight) * clientHeight);
    const maxScroll = scrollHeight - clientHeight;
    const maxTop = Math.max(0, clientHeight - thumbH);
    const top = maxScroll > 0 ? (scrollTop / maxScroll) * maxTop : 0;
    setThumb({ top, h: thumbH, show: true });
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', sync);
      ro.disconnect();
    };
  }, [scrollRef, sync]);

  const applyClientY = (clientY: number) => {
    const track = trackRef.current;
    const el = scrollRef.current;
    if (!track || !el || !thumb.show) return;
    const tr = track.getBoundingClientRect();
    const thumbH = thumb.h;
    const usable = Math.max(1, tr.height - thumbH);
    const rel = Math.max(0, Math.min(tr.height, clientY - tr.top));
    const ratio = Math.max(0, Math.min(1, (rel - thumbH / 2) / usable));
    el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
  };

  return (
    <div
      ref={trackRef}
      className="relative flex-1 w-14 shrink-0 rounded-2xl bg-slate-900/95 border border-white/15 mx-1 mb-2 touch-none select-none"
      style={{ minHeight: 140, touchAction: 'none' }}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        applyClientY(e.clientY);
      }}
      onPointerMove={(e) => {
        if (!(e.target as HTMLElement).hasPointerCapture?.(e.pointerId)) return;
        applyClientY(e.clientY);
      }}
    >
      {thumb.show && (
        <div
          className="absolute left-1/2 -translate-x-1/2 w-10 rounded-full bg-gradient-to-b from-slate-100 via-slate-400 to-slate-700 border-2 border-white/40 shadow-[0_0_0_4px_rgba(255,255,255,0.08)] pointer-events-none"
          style={{ top: thumb.top, height: thumb.h }}
        />
      )}
    </div>
  );
}

// ─── Debug Panel ──────────────────────────────────────────────────────────────
function DebugPanel({ params, onChange, onClose, onReset, bandsRef, playing, hideCard, onToggleCard, trackName, onSkip, eqState, isMobile, mobileImmersive, onTogglePlay }: {
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
  isMobile?: boolean;
  mobileImmersive?: boolean;
  onTogglePlay?: () => void | Promise<void>;
}) {
  const [live, setLive] = useState(params);
  const rafRef = useRef<number|null>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);

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

  const scrollBody = (
        <>
        {playing && trackName && (
          <div className="rounded-lg border border-white/5 bg-black/30 px-2.5 py-1.5 flex items-center gap-2 min-w-0">
            <span className="text-[8px] font-bold text-slate-500 uppercase flex-shrink-0">♪</span>
            <span className="text-[9px] text-slate-400 truncate font-mono flex-1">{trackName}</span>
            {!mobileImmersive && (
              <button type="button" onClick={onSkip} title="Skip" className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-md text-slate-500 hover:text-white hover:bg-white/10 transition-colors" style={{fontSize:10}}>⏭</button>
            )}
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

        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
          <span className="text-[10px] font-bold text-slate-400">Ocultar tarjeta login</span>
          <div onClick={onToggleCard} className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer flex-shrink-0 ${hideCard?'bg-orange-500':'bg-slate-700'}`}>
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${hideCard?'left-4':'left-0.5'}`}/>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
          <span className="text-[10px] font-bold text-slate-400">Filtro TV (scanlines)</span>
          <div onClick={()=>onChange('tvFilterEnabled',params.tvFilterEnabled>0?0:1)} className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer flex-shrink-0 ${params.tvFilterEnabled>0?'bg-orange-500':'bg-slate-700'}`}>
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${params.tvFilterEnabled>0?'left-4':'left-0.5'}`}/>
          </div>
        </div>

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

        {/* ── Sphere section ───────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/8 bg-white/[0.015] overflow-hidden">
          <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400/70"/>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Esfera</span>
          </div>
          <div className="p-3 space-y-3">
            {/* Palette picker */}
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase mb-2">Paleta de colores</p>
              <div className="flex gap-1.5">
                {[
                  {label:'Eléctrico', colors:['#0088ff','#00ffee']},
                  {label:'Matrix',    colors:['#00ff44','#004422']},
                  {label:'Cyber',     colors:['#cc00ff','#ff0088']},
                  {label:'Lava',      colors:['#ff4400','#ffaa00']},
                  {label:'Océano',    colors:['#004466','#00ccbb']},
                ].map((pal,i)=>(
                  <button
                    key={i}
                    onClick={()=>onChange('sphPalette',i)}
                    title={pal.label}
                    className="flex-1 h-6 rounded-lg border-2 transition-all relative overflow-hidden"
                    style={{
                      background:`linear-gradient(135deg,${pal.colors[0]},${pal.colors[1]})`,
                      borderColor: params.sphPalette===i ? '#ffffff' : 'rgba(255,255,255,0.1)',
                      boxShadow: params.sphPalette===i ? `0 0 8px ${pal.colors[0]}` : 'none',
                    }}
                  >
                    {params.sphPalette===i && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white shadow"/>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Sphere sliders — sphSize first ← NEW */}
            {([
              {label:'Tamaño',      key:'sphSize'            as const, min:0.2, max:4,  step:0.1,  col:'#ffd700'},
              {label:'Refracción',  key:'sphRefraction'      as const, min:0,   max:1,  step:0.02, col:'#00ccff'},
              {label:'Vel. Fractal',key:'sphFractalSpeed'    as const, min:0.05,max:3,  step:0.05, col:'#aa44ff'},
              {label:'Iteraciones', key:'sphFractalIter'     as const, min:8,   max:64, step:4,    col:'#ff44aa'},
              {label:'Intensidad',  key:'sphFractalIntensity'as const, min:0,   max:1,  step:0.02, col:'#44ff88'},
              {label:'Escala',      key:'sphFractalScale'    as const, min:0.05,max:2,  step:0.05, col:'#ffaa00'},
            ] as const).map(({label,key,min,max,step,col})=>{
              const val = params[key] as number;
              const pct = Math.min(100,((val-min)/(max-min))*100);
              return(
                <div key={key}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-slate-400">{label}</span>
                    <span className="text-[10px] font-mono text-orange-400">{val.toFixed(key==='sphFractalIter'?0:2)}</span>
                  </div>
                  <div className="relative h-2.5 rounded-full bg-slate-800/80 cursor-pointer"
                    onClick={e=>{
                      const r=e.currentTarget.getBoundingClientRect();
                      onChange(key, parseFloat(Math.min(max,Math.max(min,min+(e.clientX-r.left)/r.width*(max-min))).toFixed(key==='sphFractalIter'?0:5)));
                    }}>
                    <div className="absolute inset-y-0 left-0 rounded-full pointer-events-none" style={{width:`${pct}%`,background:`linear-gradient(90deg,${col}55,${col})`}}/>
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-white/90 pointer-events-none" style={{left:`${pct}%`,background:col,boxShadow:`0 0 8px ${col}99`}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-black/20 p-2.5 space-y-1">
          <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mb-1.5">Atajos</p>
          {[['SPACE','Play / Pausa'],['← →','Mover filtro EQ'],['↑ ↓','Ganancia EQ'],['I','Grabar sample'],['O','Stop + loop'],['A→L','12 semitonos del sample'],['SHIFT','Debug'],['SCROLL','Velocidad + tamaño esfera'],['CLICK','Paleta']].map(([k,v])=>(
            <div key={k} className="flex items-center gap-2">
              <kbd className="text-[7px] font-black bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 flex-shrink-0 min-w-[28px] text-center">{k}</kbd>
              <span className="text-[8px] text-slate-600">{v}</span>
            </div>
          ))}
        </div>
        </>
  );

  const panelMaxH = mobileImmersive ? '100dvh' : (isMobile ? 'min(85dvh, 85vh)' : 'min(calc(100dvh - 72px), 680px)');

  if (mobileImmersive) {
    return (
      <div
        className="fixed inset-0 z-[61] flex flex-col w-full max-w-none bg-slate-950/98 backdrop-blur-xl border-0 rounded-none"
        style={{
          height: '100dvh',
          maxHeight: '100dvh',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex items-center gap-3 px-3 py-3 border-b border-white/10 flex-shrink-0 bg-slate-950/95">
          {onTogglePlay && (
            <button
              type="button"
              onClick={() => void onTogglePlay()}
              className="flex items-center justify-center w-14 h-14 min-w-[56px] min-h-[56px] rounded-2xl bg-white/12 border border-white/20 text-white active:scale-95 transition-transform"
              aria-label={playing ? 'Pausar' : 'Reproducir'}
            >
              {playing ? <Pause size={28} strokeWidth={2.2} /> : <Play size={28} className="ml-0.5" strokeWidth={2.2} />}
            </button>
          )}
          <button
            type="button"
            onClick={onSkip}
            className="flex items-center justify-center w-14 h-14 min-w-[56px] min-h-[56px] rounded-2xl bg-white/12 border border-white/20 text-white active:scale-95 transition-transform"
            aria-label="Siguiente tema"
          >
            <SkipForward size={28} strokeWidth={2.2} />
          </button>
          <div className="flex-1 min-w-0" />
          <div className="flex items-center gap-2 shrink-0">
            <Activity size={14} className={playing ? 'text-green-400 animate-pulse' : 'text-slate-600'} />
            <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Debug</span>
            {playing && (
              <span className="text-[8px] font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full border border-green-400/20 whitespace-nowrap">LIVE</span>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 shrink-0" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="flex flex-1 min-h-0 w-full min-w-0 flex-row overflow-hidden">
          <div
            ref={mobileScrollRef}
            className="flex-1 min-w-0 overflow-y-auto overscroll-y-contain p-3 space-y-3"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {scrollBody}
          </div>
          <div className="flex flex-col shrink-0 w-14 min-w-[56px] border-l border-white/10 bg-slate-950/90">
            <LoginMobileScrollRail scrollRef={mobileScrollRef} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed z-[61] rounded-2xl border border-white/10 bg-slate-950/97 backdrop-blur-xl shadow-2xl flex flex-col"
      style={{
        boxShadow:'0 0 60px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.04)',
        left: isMobile ? '0' : 'clamp(8px, 4vw, 16px)',
        right: isMobile ? '0' : 'auto',
        bottom: isMobile ? '0' : 'auto',
        top: isMobile ? 'auto' : 'clamp(64px, 8vh, 80px)',
        width: isMobile ? '100%' : 'min(256px, calc(100vw - 16px))',
        borderRadius: isMobile ? '20px 20px 0 0' : '16px',
        maxHeight: panelMaxH,
        height:'auto',
      }}
    >
      {isMobile && <div className="flex justify-center pt-2 pb-0 flex-shrink-0"><div className="w-10 h-1 rounded-full bg-white/20"/></div>}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-gradient-to-r from-slate-900/60 to-transparent flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Activity size={13} className={playing?'text-green-400 animate-pulse':'text-slate-600'}/>
          <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Debug</span>
          {playing&&<span className="text-[8px] font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full border border-green-400/20 whitespace-nowrap">LIVE</span>}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 ml-2"><X size={14}/></button>
      </div>

      <div className="p-3 space-y-3 overflow-y-auto flex-1 min-h-0">
        {scrollBody}
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
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    pos.current = { x: -200, y: -200 };
    function tick() {
      rafRef.current = requestAnimationFrame(tick);
      const el = elRef.current;
      const glow = glowRef.current;
      if (!el || !glow) return;
      const target = mousePixelRef.current;
      const b = bandsRef.current;
      const dx = target.x - pos.current.x;
      const dy = target.y - pos.current.y;
      const springK = 0.18;
      const damping  = 0.72;
      vel.current.x = vel.current.x * damping + dx * springK;
      vel.current.y = vel.current.y * damping + dy * springK;
      pos.current.x += vel.current.x;
      pos.current.y += vel.current.y;
      const beat   = audioPlaying ? b.beat   : 0;
      const rms    = audioPlaying ? b.rms    : 0;
      const bass   = audioPlaying ? b.bass   : 0;
      const size   = 42 + beat * 22 + bass * 12;
      const blur   = 6  + rms  * 8;
      const r = Math.round(60  + (audioPlaying ? b.subBass : 0) * 160);
      const g = Math.round(120 + (audioPlaying ? b.mid     : 0) * 100);
      const bv= Math.round(220 + (audioPlaying ? b.air     : 0) *  35);
      const rimAlpha = 0.7 + beat * 0.3;
      const half = size / 2;
      el.style.transform = `translate(${pos.current.x - half}px, ${pos.current.y - half}px)`;
      el.style.width  = `${size}px`;
      el.style.height = `${size}px`;
      el.style.boxShadow = [
        `0 0 ${blur}px rgba(${r},${g},${bv},0.5)`,
        `0 0 ${blur*3}px rgba(${r},${g},${bv},0.15)`,
        `inset 0 0 ${blur*0.5}px rgba(255,255,255,0.12)`,
      ].join(',');
      el.style.borderColor = `rgba(${r},${g},${bv},${rimAlpha})`;
      const haloSize = size * (1.5 + beat * 0.4);
      const haloHalf = haloSize / 2;
      glow.style.transform = `translate(${pos.current.x - haloHalf}px, ${pos.current.y - haloHalf}px)`;
      glow.style.width  = `${haloSize}px`;
      glow.style.height = `${haloSize}px`;
      glow.style.opacity = String(0.12 + beat * 0.18);
      glow.style.background = `radial-gradient(circle, rgba(${r},${g},${bv},0.6) 0%, transparent 70%)`;
    }
    tick();
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [mousePixelRef, bandsRef, audioPlaying]);

  return (
    <>
      <div ref={glowRef} className="fixed top-0 left-0 rounded-full pointer-events-none hidden md:block" style={{ zIndex: 9999, willChange: 'transform', mixBlendMode: 'screen' }}/>
      <div ref={elRef} className="fixed top-0 left-0 rounded-full pointer-events-none hidden md:block"
        style={{
          zIndex: 9999, willChange: 'transform',
          border: '1.5px solid rgba(140,180,255,0.7)',
          backdropFilter: 'blur(3px) saturate(160%)',
          WebkitBackdropFilter: 'blur(3px) saturate(160%)',
          background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.14) 0%, rgba(100,160,255,0.06) 45%, rgba(40,80,200,0.04) 100%)',
          boxShadow: '0 0 10px rgba(100,160,255,0.4), inset 0 0 6px rgba(255,255,255,0.1)',
        }}
      >
        <div className="absolute rounded-full" style={{ width: '28%', height: '28%', top: '14%', left: '18%', background: 'radial-gradient(circle, rgba(255,255,255,0.55) 0%, transparent 80%)' }}/>
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
  const [mobileActive, setMobileActive] = useState(false);   // ← NEW: mobile bg active
  const [showShiftHint, setShowShiftHint] = useState(false); // ← NEW: "shift para opciones"
  const [viewportNarrow, setViewportNarrow] = useState(false);
  /** Coherente con el viewport: retrato vs apaisado (giroscopio + resize canvas). */
  const loginGyroLayoutRef = useRef<'portrait' | 'landscape'>('portrait');
  const mobileActiveRef = useRef(false);                     // ← NEW: ref for closures
  const shiftHintShownRef = useRef(false);                   // ← NEW: only show once
  const debugRef = useRef<DebugParams>({...DEFAULT_DEBUG});

  const audioRef = useRef<HTMLAudioElement|null>(null);
  const audioCtxRef = useRef<AudioContext|null>(null);
  const analyserRef = useRef<AnalyserNode|null>(null);
  const freqRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const bandsRef = useRef<AudioBands>(zeroBands());
  const beatRef = useRef({prev:0,lastBeat:0});
  const portalRef = useRef({active:false,opacity:0,nextShow:0,hold:0});
  const playlistRef = useRef<string[]>([]);
  const trackIdxRef = useRef(0);

  const eqFilterRef = useRef<BiquadFilterNode|null>(null);
  const [eqState, setEqState] = useState<EQState>({mode:null,freq:200,gain:0.8,firstKey:null,lastKeyTime:0});
  const eqStateRef = useRef<EQState>({mode:null,freq:200,gain:0.8,firstKey:null,lastKeyTime:0});
  useEffect(()=>{ eqStateRef.current=eqState; },[eqState]);

  const [samplerState, setSamplerState] = useState<SamplerState>('idle');
  const samplerStateRef = useRef<SamplerState>('idle');
  const mediaRecorderRef = useRef<MediaRecorder|null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const sampleBlobUrlRef = useRef<string|null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement|null>(null);
  const samplerDestRef = useRef<MediaStreamAudioDestinationNode|null>(null);
  const semitonePlayersRef = useRef<HTMLAudioElement[]>([]);

  const audioRampRef = useRef<{active:boolean;audioStartTime:number}>({active:false,audioStartTime:0});
  const secondRampRef = useRef<{done:boolean}>({done:false});
  const thirdRampRef = useRef<{done:boolean}>({done:false});

  const mousePosRef = useRef({x:0,y:0});
  const mousePixelRef = useRef({x: -200, y: -200});
  const mobileImmersionT0Ref = useRef<number | null>(null);
  const loginShellRef = useRef<HTMLDivElement | null>(null);

  useEffect(()=>{ debugRef.current={...debugParams}; },[debugParams]);

  useEffect(()=>{
    return ()=>{
      window.dispatchEvent(new CustomEvent('login-immersive',{detail:{active:false}}));
      const a = audioRef.current;
      if (a?.parentNode === document.body) {
        try { document.body.removeChild(a); } catch (_) {}
      }
    };
  },[]);

  useEffect(() => {
    const q = () => setViewportNarrow(window.innerWidth < 768);
    q();
    window.addEventListener('resize', q);
    return () => window.removeEventListener('resize', q);
  }, []);

  // Móvil inmersivo: el botón Debug (FAB) desaparece solo a los 10s si el panel sigue cerrado
  useEffect(()=>{
    if(!mobileActive||!showDebug||debugOpen) return;
    const t=setTimeout(()=>setShowDebug(false),10000);
    return ()=>clearTimeout(t);
  },[mobileActive,showDebug,debugOpen]);

  // ── "Shift para opciones" hint: show 10s after first audio play ──────────
  useEffect(()=>{
    if(audioState==='playing' && !shiftHintShownRef.current && window.innerWidth>=768){
      shiftHintShownRef.current=true;
      setShowShiftHint(true);
      const t=setTimeout(()=>setShowShiftHint(false),10000);
      return ()=>clearTimeout(t);
    }
  },[audioState]);

  // ── Orientación del viewport (canvas + mapeo giroscopio) ──────────────────
  useEffect(() => {
    const sync = () => {
      loginGyroLayoutRef.current =
        typeof window !== 'undefined' && window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait';
    };
    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
    };
  }, []);

  // ── Sync mobileActive ref for use in closures ────────────────────────────
  useEffect(()=>{ mobileActiveRef.current=mobileActive; },[mobileActive]);

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

  const toggleAudioPlayPause = useCallback(async () => {
    if (samplerStateRef.current === 'playing') {
      sampleAudioRef.current?.pause();
      sampleAudioRef.current = null;
      semitonePlayersRef.current.forEach((sp) => { try { sp.pause(); } catch (_) {} });
      semitonePlayersRef.current = [];
      if (sampleBlobUrlRef.current) {
        URL.revokeObjectURL(sampleBlobUrlRef.current);
        sampleBlobUrlRef.current = null;
      }
      samplerStateRef.current = 'idle';
      setSamplerState('idle');
      const audio = audioRef.current;
      const ctx = audioCtxRef.current;
      if (audio && ctx) {
        if (ctx.state === 'suspended') await ctx.resume();
        await audio.play().catch(() => {});
        setAudioState('playing');
      }
      return;
    }
    if (samplerStateRef.current === 'recording') return;
    const audio = audioRef.current;
    const ctx = audioCtxRef.current;
    if (!audio || !ctx) return;
    if (ctx.state === 'suspended') await ctx.resume();
    if (audio.paused) {
      await audio.play().catch(() => {});
      setAudioState('playing');
    } else {
      audio.pause();
      setAudioState('paused');
    }
  }, []);

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      if(e.code!=='ShiftLeft'&&e.code!=='ShiftRight') return;
      setShowDebug(v=>{ const next=!v; if(!next) setDebugOpen(false); return next; });
    };
    window.addEventListener('keydown',h);
    return ()=>window.removeEventListener('keydown',h);
  },[]);

  useEffect(()=>{
    const h=(e:MouseEvent)=>{
      mousePosRef.current={x:(e.clientX/window.innerWidth)*2-1, y:-(e.clientY/window.innerHeight)*2+1};
      mousePixelRef.current={x:e.clientX, y:e.clientY};
    };
    window.addEventListener('mousemove',h);
    return ()=>window.removeEventListener('mousemove',h);
  },[]);

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

  useEffect(()=>{
    const h=async(e:KeyboardEvent)=>{
      if(e.repeat) return;
      const ae=document.activeElement;
      if(ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA')) return;
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
      if(e.code==='KeyO'){
        if(samplerStateRef.current!=='recording') return;
        const mr=mediaRecorderRef.current; if(!mr) return;
        mr.stop();
        mr.onstop=()=>{
          const blob=new Blob(recordedChunksRef.current,{type:mr.mimeType||'audio/webm'});
          const url=URL.createObjectURL(blob);
          sampleBlobUrlRef.current=url;
          audioRef.current?.pause();
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
      const keyIdx=SAMPLER_KEYS.indexOf(e.code);
      if(keyIdx!==-1&&sampleBlobUrlRef.current){
        const url=sampleBlobUrlRef.current;
        const rate=Math.pow(2,keyIdx/12);
        const existing=semitonePlayersRef.current[keyIdx];
        if(existing&&!existing.paused) return;
        const sp=new Audio(url);
        sp.loop=true;
        sp.playbackRate=rate;
        semitonePlayersRef.current[keyIdx]=sp;
        connectSampleToEQ(sp);
        sp.play().catch(()=>{});
        if(sampleAudioRef.current) sampleAudioRef.current.volume=0;
        return;
      }
    };
    const hUp=(e:KeyboardEvent)=>{
      const keyIdx=SAMPLER_KEYS.indexOf(e.code);
      if(keyIdx!==-1){
        const sp=semitonePlayersRef.current[keyIdx];
        if(sp){ sp.pause(); sp.currentTime=0; semitonePlayersRef.current[keyIdx]=undefined as any; }
        const anyHeld=semitonePlayersRef.current.some(p=>p&&!p.paused);
        if(!anyHeld&&sampleAudioRef.current) sampleAudioRef.current.volume=1;
      }
    };
    window.addEventListener('keydown',h);
    window.addEventListener('keyup',hUp);
    return ()=>{ window.removeEventListener('keydown',h); window.removeEventListener('keyup',hUp); };
  },[]);

  useEffect(()=>{
    const h=async(e:KeyboardEvent)=>{
      if(e.code!=='Space') return;
      const ae=document.activeElement;
      if(ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA')) return;
      e.preventDefault();
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
        freqRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
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

  // ── Mobile play handler (gesto de usuario: sin await antes del audio; permisos en macrotarea — iOS) ──
  const handleMobilePlay = useCallback(() => {
    const kickAudio = (): void => {
      if (audioCtxRef.current && audioRef.current) {
        const audio = audioRef.current;
        const ctx = audioCtxRef.current;
        void ctx.resume().then(() => {
          if (audio.paused) {
            void audio.play().then(() => setAudioState('playing')).catch(() => {});
          }
        });
        return;
      }
      setAudioState('loading');
      const audio = new Audio(MUSIC_FIRST);
      audio.preload = 'auto';
      audio.setAttribute('playsinline', '');
      audio.setAttribute('webkit-playsinline', '');
      (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      audio.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:0;';
      try {
        document.body.appendChild(audio);
      } catch (_) {}

      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      freqRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
      const src = ctx.createMediaElementSource(audio);
      src.connect(analyser);
      analyser.connect(ctx.destination);
      audio.addEventListener('ended', () => skipTrack());

      audioRef.current = audio;
      audioCtxRef.current = ctx;
      playlistRef.current = [MUSIC_FIRST];
      trackIdxRef.current = 0;
      setTrackName('music');

      try {
        audio.load();
      } catch (_) {}

      void ctx.resume().then(() => {
        void audio.play().then(() => {
          setAudioState('playing');
          audioRampRef.current = { active: true, audioStartTime: performance.now() };
          secondRampRef.current = { done: false };
          thirdRampRef.current = { done: false };
        }).catch(() => {
          setAudioState('idle');
        });
      });
    };

    mobileImmersionT0Ref.current = performance.now();
    setMobileActive(true);
    setHideCard(true);
    setShowDebug(true);
    window.dispatchEvent(new CustomEvent('login-immersive', { detail: { active: true } }));
    window.dispatchEvent(new CustomEvent('login-music-state', { detail: { playing: true } }));

    kickAudio();

    requestAnimationFrame(() => {
      const el = loginShellRef.current;
      if (!el) return;
      const anyEl = el as unknown as { requestFullscreen?: () => Promise<void>; webkitRequestFullscreen?: () => void };
      const req = anyEl.requestFullscreen?.bind(el) ?? anyEl.webkitRequestFullscreen?.bind(el);
      try {
        void req?.();
      } catch (_) {}
    });

    void fetchPlaylist().then((files) => {
      if (!files.length || !audioRef.current) return;
      playlistRef.current = files;
    });

    window.setTimeout(() => {
      void (async () => {
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function') {
          try {
            const perm = await (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
            if (perm !== 'granted') {
              alert('Se necesita acceso al sensor de movimiento para la experiencia completa.');
            }
          } catch (_) {}
        }
      })();
    }, 0);
  }, [skipTrack]);

  // ── Gyroscope → mousePosRef (mobile only): retrato = eje actual; apaisado = ejes adaptados)
  useEffect(()=>{
    const h=(e:DeviceOrientationEvent)=>{
      if(!mobileActiveRef.current) return;
      const gamma=e.gamma??0;  // -90..90 left/right tilt
      const beta =e.beta??45;  // -180..180 front/back tilt
      const landscape = loginGyroLayoutRef.current === 'landscape';
      let x: number;
      let y: number;
      if (!landscape) {
        x = Math.max(-1, Math.min(1, gamma / 45));
        y = Math.max(-1, Math.min(1, -(beta - 45) / 45));
      } else {
        // Apaisado: intercambia la influencia de beta/gamma respecto a los ejes de pantalla
        x = Math.max(-1, Math.min(1, (beta - 45) / 45));
        y = Math.max(-1, Math.min(1, -gamma / 45));
      }
      mousePosRef.current = { x, y };
    };
    window.addEventListener('deviceorientation',h,{passive:true});
    return ()=>window.removeEventListener('deviceorientation',h);
  },[]);

  // ── Mobile touch events ───────────────────────────────────────────────────
  useEffect(()=>{
    // Two-finger tap → open debug
    const onTouchStart=(e:TouchEvent)=>{
      if(!mobileActiveRef.current) return;
      if(e.touches.length>=2){ setShowDebug(true); setDebugOpen(true); }
    };
    // Single tap → palette change (same as mouse click)
    let tapStartTime=0,tapStartX=0,tapStartY=0;
    const onTouchEnd=(e:TouchEvent)=>{
      if(!mobileActiveRef.current||e.changedTouches.length!==1) return;
      const dt=Date.now()-tapStartTime;
      const dx=e.changedTouches[0].clientX-tapStartX;
      const dy=e.changedTouches[0].clientY-tapStartY;
      // Short tap with little movement = palette change
      if(dt<300&&Math.hypot(dx,dy)<15){
        // Dispatch a click to trigger the onClick handler in Three.js
        window.dispatchEvent(new MouseEvent('click',{bubbles:true}));
      }
    };
    const onTouchStartForTap=(e:TouchEvent)=>{
      if(e.touches.length===1){
        tapStartTime=Date.now();
        tapStartX=e.touches[0].clientX;
        tapStartY=e.touches[0].clientY;
      }
    };
    window.addEventListener('touchstart',onTouchStart,{passive:true});
    window.addEventListener('touchstart',onTouchStartForTap,{passive:true});
    window.addEventListener('touchend',onTouchEnd,{passive:true});

    // Touch scroll → speed + sphSize (same as wheel)
    let lastTouchY=0;
    const onTouchMoveStart=(e:TouchEvent)=>{
      if(e.touches.length===1) lastTouchY=e.touches[0].clientY;
    };
    const onTouchMove=(e:TouchEvent)=>{
      if(!mobileActiveRef.current||e.touches.length!==1) return;
      const dy=lastTouchY-e.touches[0].clientY; // positive = scroll up
      lastTouchY=e.touches[0].clientY;
      const scrollDown=dy<0;
      setDebugParams(p=>({
        ...p,
        speed:Math.max(0.02,Math.min(p.speed+dy*0.0008,2.0)),
        sphSize:parseFloat(Math.max(0.2,Math.min(p.sphSize+(scrollDown?-0.04:0.04),4.0)).toFixed(2)),
      }));
    };
    window.addEventListener('touchstart',onTouchMoveStart,{passive:true});
    window.addEventListener('touchmove',onTouchMove,{passive:true});

    return ()=>{
      window.removeEventListener('touchstart',onTouchStart);
      window.removeEventListener('touchstart',onTouchStartForTap);
      window.removeEventListener('touchend',onTouchEnd);
      window.removeEventListener('touchstart',onTouchMoveStart);
      window.removeEventListener('touchmove',onTouchMove);
    };
  },[]);

  // ── Scroll → speed + playbackRate + sphere size ← MODIFIED ──────────────
  useEffect(()=>{
    const h=(e:WheelEvent)=>{
      const scrollDown = e.deltaY > 0;
      setDebugParams(p=>({
        ...p,
        speed: Math.max(0.02, Math.min(p.speed - e.deltaY * 0.0015, 2.0)),
        // scroll down (deltaY>0) → sphere bigger; scroll up → smaller
        sphSize: parseFloat(Math.max(0.2, Math.min(p.sphSize + (scrollDown ? 0.06 : -0.06), 4.0)).toFixed(2)),
      }));
      if(audioRef.current)
        audioRef.current.playbackRate = Math.max(0.5, Math.min((audioRef.current.playbackRate||1) - e.deltaY * 0.0003, 2.0));
    };
    window.addEventListener('wheel',h,{passive:true});
    return ()=>window.removeEventListener('wheel',h);
  },[]);

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

  useEffect(()=>{
    if(!mountRef.current) return;
    const mount=mountRef.current;
    const mobile=window.innerWidth<768;

    const scene=new THREE.Scene();
    scene.fog=new THREE.FogExp2(DEFAULT_DEBUG.topColor,0.008);
    // Viewport real (retrato o apaisado); el canvas sigue al girar el dispositivo
    const canvasW = window.innerWidth;
    const canvasH = window.innerHeight;
    const camera=new THREE.PerspectiveCamera(85, canvasW/canvasH, 0.1, 1000);
    const renderer=new THREE.WebGLRenderer({antialias:!mobile,powerPreference:'high-performance'});
    renderer.setSize(canvasW, canvasH);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
    mount.appendChild(renderer.domElement);

    const composer=new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene,camera));
    const bloomPass=new UnrealBloomPass(new THREE.Vector2(canvasW, canvasH),1.0,0.2,0.15);
    composer.addPass(bloomPass);
    const rgbPass=new ShaderPass(RGBShiftShader);
    rgbPass.uniforms['amount'].value=0.001;
    composer.addPass(rgbPass);

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

    const ambientLight = new THREE.AmbientLight(0x334466, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0x8899ff, 0.8);
    dirLight.position.set(1, 2, 1);
    scene.add(dirLight);

    const W = renderer.domElement.width;
    const H = renderer.domElement.height;
    const bgRT = new THREE.WebGLRenderTarget(W, H, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });

    const SPHERE_DIST = 5.0;
    const SPHERE_R    = 0.65;
    const sphereScene = new THREE.Scene();

    const sphVert = `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vWorldPos;
      void main() {
        vWorldPos = (modelMatrix * vec4(position,1.0)).xyz;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vNormal  = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`;

    const sphGlassFrag = `
      uniform sampler2D uBgTex;
      uniform vec2  uRes;
      uniform float uTime;
      uniform vec3  uTint;
      uniform float uBeat;
      uniform float uRMS;
      uniform float uBass;
      uniform float uMid;
      uniform float uAir;
      uniform float uSub;
      uniform float uRefraction;
      uniform float uFractalSpeed;
      uniform float uFractalIter;
      uniform float uFractalIntensity;
      uniform float uFractalScale;
      uniform float uPalette;
      varying vec3 vNormal; varying vec3 vViewDir; varying vec3 vWorldPos;

      vec2 rot2(vec2 p,float a){float c=cos(a),s=sin(a);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);}

      vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d){
        return a + b*cos(6.28318*(c*t+d));
      }
      vec3 applyPalette(float t, float pal){
        if(pal<0.5) return palette(t, vec3(0.5,0.5,0.5), vec3(0.5,0.5,0.5), vec3(1.0,1.0,1.0), vec3(0.0,0.33,0.67));
        if(pal<1.5) return palette(t, vec3(0.0,0.5,0.0), vec3(0.2,0.5,0.1), vec3(1.0,1.0,1.0), vec3(0.0,0.15,0.3));
        if(pal<2.5) return palette(t, vec3(0.5,0.0,0.5), vec3(0.5,0.3,0.5), vec3(1.0,0.7,1.0), vec3(0.8,0.0,0.5));
        if(pal<3.5) return palette(t, vec3(0.5,0.2,0.0), vec3(0.5,0.3,0.0), vec3(1.0,0.8,0.6), vec3(0.0,0.1,0.2));
        return        palette(t, vec3(0.0,0.4,0.5), vec3(0.2,0.4,0.3), vec3(1.0,1.0,0.8), vec3(0.5,0.6,0.7));
      }

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(vViewDir);
        float ndv = max(0.0, dot(N,V));
        vec2 screenUV = gl_FragCoord.xy / uRes;

        float IOR = 1.3 + uBass * 0.4;
        vec3 refr = refract(-V, N, 1.0/IOR);
        float refStr = uRefraction * (0.28 + uBeat*0.14 + uRMS*0.08);
        vec2 refOff = refr.xy * refStr;
        float ca = uRefraction * (0.032 + uBeat*0.020 + uBass*0.012);
        vec2 caV = vec2(ca, ca*0.5);
        float rC = texture2D(uBgTex, screenUV+refOff+caV).r;
        float gC = texture2D(uBgTex, screenUV+refOff     ).g;
        float bC = texture2D(uBgTex, screenUV+refOff-caV ).b;
        vec3 bgCol = vec3(rC,gC,bC);

        float speed = uFractalSpeed * (1.0 + uBeat*0.6 + uRMS*0.25);
        vec2 diskUV = rot2(vNormal.xy, uTime * speed * 0.05);

        float period = 7.0;
        float zA_t = mod(uTime * speed * 0.22,         period);
        float zB_t = mod(uTime * speed * 0.22 + period*0.5, period);
        float zoomA = exp(zA_t * 0.9);
        float zoomB = exp(zB_t * 0.9);
        float wA = smoothstep(0.0,0.12,zA_t/period) * smoothstep(1.0,0.88,zA_t/period);
        float wB = smoothstep(0.0,0.12,zB_t/period) * smoothstep(1.0,0.88,zB_t/period);
        float wSum = wA + wB + 0.001;
        wA /= wSum; wB /= wSum;

        float pAngA = uTime * speed * 0.06;
        float pAngB = uTime * speed * 0.04 + 1.57;
        vec2 panA = vec2(cos(pAngA)*0.32, sin(pAngA*0.77)*0.24);
        vec2 panB = vec2(cos(pAngB)*0.28, sin(pAngB*0.61)*0.20);

        vec2 jc = vec2(
          -0.7269 + sin(uTime*speed*0.09)*0.22 + uBass*0.15,
           0.1889 + cos(uTime*speed*0.07)*0.16 + uMid *0.10
        );

        vec2 fcA = diskUV * uFractalScale / zoomA + panA;
        vec2 fcB = diskUV * uFractalScale / zoomB + panB;
        int maxI = int(uFractalIter);

        vec2 zA = fcA;
        float iterA=0.0, trapRA=1e5, trapLA=1e5, trapCA=1e5;
        for(int i=0;i<64;i++){
          if(i>=maxI) break;
          zA = vec2(zA.x*zA.x-zA.y*zA.y, 2.0*zA.x*zA.y) + jc;
          float rA=length(zA);
          trapRA=min(trapRA,rA); trapLA=min(trapLA,abs(zA.x*zA.y)); trapCA=min(trapCA,abs(rA-0.5));
          if(rA>4.0){iterA=float(i);break;} iterA=float(i);
        }
        float palA = fract(mix(1.0-exp(-trapRA*3.0), 1.0-exp(-trapLA*7.0), 0.5) + uTime*speed*0.035 + uBeat*0.12);
        vec3 fracA = applyPalette(palA, uPalette);
        float brigA = 0.5 + (1.0-exp(-trapRA*2.5))*0.5 + (1.0-exp(-trapCA*5.0))*0.4;
        fracA *= brigA * (1.0 + uBeat*0.7 + uRMS*0.5);

        vec2 zB2 = fcB;
        float iterB=0.0, trapRB=1e5, trapLB=1e5, trapCB=1e5;
        for(int i=0;i<64;i++){
          if(i>=maxI) break;
          zB2 = vec2(zB2.x*zB2.x-zB2.y*zB2.y, 2.0*zB2.x*zB2.y) + jc;
          float rB=length(zB2);
          trapRB=min(trapRB,rB); trapLB=min(trapLB,abs(zB2.x*zB2.y)); trapCB=min(trapCB,abs(rB-0.5));
          if(rB>4.0){iterB=float(i);break;} iterB=float(i);
        }
        float palB = fract(mix(1.0-exp(-trapRB*3.0), 1.0-exp(-trapLB*7.0), 0.5) + uTime*speed*0.035 + uBeat*0.12 + 0.5);
        vec3 fracB = applyPalette(palB, uPalette);
        float brigB = 0.5 + (1.0-exp(-trapRB*2.5))*0.5 + (1.0-exp(-trapCB*5.0))*0.4;
        fracB *= brigB * (1.0 + uBeat*0.7 + uRMS*0.5);

        vec3 fractalCol = fracA * wA + fracB * wB;
        float fracMask = smoothstep(0.0, 0.45, ndv) * uFractalIntensity * (0.9 + uRMS*0.5 + uBeat*0.4);

        float lensFocus = smoothstep(0.25, 0.85, ndv) * (0.35 + uRMS*0.55);
        bgCol = mix(bgCol, bgCol*(1.0+lensFocus*1.3), 0.65);
        bgCol *= 1.0 - smoothstep(0.85,0.5,ndv)*0.22;

        float fresnel   = pow(1.0-ndv, 3.0);
        float sharpEdge = pow(1.0-ndv, 10.0);
        vec3 rimSh = sin(vWorldPos.x*9.0+uTime*2.0)*sin(vWorldPos.y*7.0-uTime*1.6)*0.5+0.5 * vec3(1.0);
        vec3 rimCol = mix(vec3(0.6,0.9,1.0), uTint+0.2, rimSh.x);
        rimCol *= 1.0 + uBeat*1.8 + uRMS*0.7;

        vec3 L1=normalize(vec3(-0.5,0.75,0.4));
        vec3 L2=normalize(vec3(0.55,-0.3,0.3));
        float spec1=pow(max(0.0,dot(reflect(-V,N),L1)),40.0)*1.1;
        float spec2=pow(max(0.0,dot(reflect(-V,N),L2)),90.0)*0.6;

        vec3 col = mix(bgCol, fractalCol, fracMask)
                 + rimCol * fresnel * 0.60
                 + vec3(1.0) * sharpEdge * 0.95
                 + vec3(1.0) * (spec1+spec2) * (0.9+uBeat*0.5);

        float alpha = fracMask * 0.85
                    + fresnel    * 0.65
                    + sharpEdge  * 0.95
                    + spec1      * 0.75
                    + spec2      * 0.45;

        gl_FragColor = vec4(col, clamp(alpha,0.0,1.0));
      }`;

    const sphGeo  = new THREE.SphereGeometry(SPHERE_R, 64, 64);
    const haloGeo = new THREE.SphereGeometry(SPHERE_R, 32, 32);
    const BASE = { transparent:true, depthWrite:false, depthTest:false };

    const sphGlassMat = new THREE.ShaderMaterial({
      ...BASE,
      vertexShader: sphVert, fragmentShader: sphGlassFrag,
      uniforms: {
        uBgTex: { value: bgRT.texture },
        uRes:   { value: new THREE.Vector2(W * renderer.getPixelRatio(), H * renderer.getPixelRatio()) },
        uTime:  { value: 0 },
        uTint:  { value: new THREE.Color(0.3, 0.65, 1.0) },
        uBeat:  { value: 0 }, uRMS:  { value: 0 },
        uBass:  { value: 0 }, uMid:  { value: 0 },
        uAir:   { value: 0 }, uSub:  { value: 0 },
        uRefraction:         { value: DEFAULT_DEBUG.sphRefraction },
        uFractalSpeed:       { value: DEFAULT_DEBUG.sphFractalSpeed },
        uFractalIter:        { value: DEFAULT_DEBUG.sphFractalIter },
        uFractalIntensity:   { value: DEFAULT_DEBUG.sphFractalIntensity },
        uFractalScale:       { value: DEFAULT_DEBUG.sphFractalScale },
        uPalette:            { value: DEFAULT_DEBUG.sphPalette },
      },
      side: THREE.FrontSide,
      blending: THREE.NormalBlending,
    });

    const sphHaloMat = null;
    const sphGroup = new THREE.Group();
    const sphGlassMesh = new THREE.Mesh(sphGeo, sphGlassMat);
    sphGlassMesh.renderOrder = 1;
    sphGroup.add(sphGlassMesh);
    sphereScene.add(sphGroup);

    const sphSpring = { x:0, y:0, vx:0, vy:0 };
    const sphereLight = new THREE.PointLight(0x88aaff, 1.0, 22);
    scene.add(sphereLight);

    const mc=document.createElement('canvas');mc.width=mc.height=1024;
    const mctx=mc.getContext('2d')!;
    mctx.fillStyle='#000';mctx.fillRect(0,0,1024,1024);
    mctx.fillStyle='#fff';mctx.font='bold 44px monospace';mctx.textAlign='center';mctx.textBaseline='middle';
    for(let y=24;y<1024;y+=48)for(let x=24;x<1024;x+=48){
      mctx.globalAlpha=0.4+Math.random()*0.6;mctx.fillText(String.fromCharCode(0xFF66+Math.floor(Math.random()*55)),x,y);
    }
    const matTex=new THREE.CanvasTexture(mc);matTex.wrapS=matTex.wrapT=THREE.RepeatWrapping;

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
    const onClick=()=>{
      pi=(pi+1)%pals.length;
      const nc=pals[pi];
      setDebugParams(p=>({...p,topColor:nc.t,bottomColor:nc.b,sphPalette:pi}));
    };
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
      U.uMatrix.value=live.matrixIntensity;
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

      const mp = mousePosRef.current;
      let effX = mp.x;
      let effY = mp.y;
      if (mobileActiveRef.current && mobileImmersionT0Ref.current != null) {
        const elapsedMs = performance.now() - mobileImmersionT0Ref.current;
        if (elapsedMs > 10000) {
          const u = Math.min(1, (elapsedMs - 10000) / 6500);
          const s = u * u * (3 - 2 * u);
          effX = mp.x * (1 - s);
          effY = mp.y * (1 - s);
        }
      }
      camera.updateMatrixWorld();
      const camRight2 = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const camUp2    = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      const camFwd2   = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2).negate().normalize();

      const MAX_LAT = 3.0, MAX_VERT = 2.0;
      const targetX = effX * MAX_LAT, targetY = effY * MAX_VERT;
      const SPR = 0.20, DAMP = 0.68;
      sphSpring.vx = sphSpring.vx * DAMP + (targetX - sphSpring.x) * SPR;
      sphSpring.vy = sphSpring.vy * DAMP + (targetY - sphSpring.y) * SPR;
      sphSpring.x += sphSpring.vx;
      sphSpring.y += sphSpring.vy;

      const sphWorldPos = camera.position.clone()
        .addScaledVector(camFwd2,   SPHERE_DIST)
        .addScaledVector(camRight2, sphSpring.x)
        .addScaledVector(camUp2,    sphSpring.y);

      const beatPulse = 1.0 + b.beat * 0.28;
      const tint = new THREE.Color(
        0.25 + b.subBass * 0.75,
        0.40 + b.mid     * 0.60,
        0.65 + b.air     * 0.35,
      );

      sphGlassMat.uniforms.uTime.value = time;
      sphGlassMat.uniforms.uBeat.value = b.beat * ar;
      sphGlassMat.uniforms.uRMS.value  = b.rms  * ar;
      sphGlassMat.uniforms.uBass.value = b.bass * ar;
      sphGlassMat.uniforms.uMid.value  = b.mid  * ar;
      sphGlassMat.uniforms.uAir.value  = b.air  * ar;
      sphGlassMat.uniforms.uSub.value  = b.subBass * ar;
      sphGlassMat.uniforms.uTint.value.copy(tint);
      sphGlassMat.uniforms.uRefraction.value       = live.sphRefraction;
      sphGlassMat.uniforms.uFractalSpeed.value      = live.sphFractalSpeed;
      sphGlassMat.uniforms.uFractalIter.value       = live.sphFractalIter;
      sphGlassMat.uniforms.uFractalIntensity.value  = live.sphFractalIntensity;
      sphGlassMat.uniforms.uFractalScale.value      = live.sphFractalScale;
      sphGlassMat.uniforms.uPalette.value           = live.sphPalette;
      sphGroup.position.copy(sphWorldPos);
      // ── sphSize * beatPulse — scroll and debug slider both control size ← NEW
      sphGroup.scale.setScalar(live.sphSize * beatPulse);
      sphereLight.position.copy(sphWorldPos);
      sphereLight.color.copy(tint);
      sphereLight.intensity = 0.6 + b.rms * ar * 1.4;

      const pv=portalRef.current;
      if(!pv.active&&time>pv.nextShow){pv.active=true;pv.opacity=0;pv.hold=time+4+Math.random()*5;pv.nextShow=pv.hold+15+Math.random()*25;}
      if(pv.active){
        if(time<pv.hold)pv.opacity=Math.min(1,pv.opacity+dt*.7);
        else{pv.opacity=Math.max(0,pv.opacity-dt*.35);if(pv.opacity<=0)pv.active=false;}
        drawPortal(pv.opacity,b);pMat.opacity=pv.opacity*.9;
        const pt=(prog+.08)%1.,ppos=curve.getPointAt(pt),ptan=curve.getTangentAt(pt).normalize();
        pMesh.position.copy(ppos);pMesh.lookAt(ppos.clone().add(ptan));
      } else pMat.opacity=0;

      renderer.setRenderTarget(bgRT);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);

      composer.render();

      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(sphereScene, camera);
      renderer.autoClear = true;
    }

    portalRef.current.nextShow=6+Math.random()*10;
    const onResize=()=>{
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect=w/h; camera.updateProjectionMatrix();
      renderer.setSize(w,h); composer.setSize(w,h);
      bgRT.setSize(w*renderer.getPixelRatio(), h*renderer.getPixelRatio());
      sphGlassMat.uniforms.uRes.value.set(w*renderer.getPixelRatio(), h*renderer.getPixelRatio());
    };
    window.addEventListener('resize',onResize);
    animate();

    return ()=>{
      cancelAnimationFrame(animId);
      window.removeEventListener('resize',onResize);window.removeEventListener('mousemove',onMouse);window.removeEventListener('click',onClick);
      if(mount.contains(renderer.domElement))mount.removeChild(renderer.domElement);
      renderer.dispose();tubeMat.dispose();tubeGeo.dispose();pGeo.dispose();pMat.dispose();pTex.dispose();matTex.dispose();
      sphGeo.dispose();haloGeo.dispose();sphGlassMat.dispose();bgRT.dispose();
    };
  },[]);

  useEffect(()=>{
    const r60=setInterval(()=>{
      const ramp=audioRampRef.current;
      if(ramp.audioStartTime<=0) return;
      const elapsed=(performance.now()-ramp.audioStartTime)/1000;
      if(elapsed<60||elapsed>75) return;
      setDebugParams(p=>({...p,audioReactivity:parseFloat(Math.min(3,p.audioReactivity*1.0035).toFixed(4))}));
    },150);
    const r120=setInterval(()=>{
      const ramp=audioRampRef.current;
      if(ramp.audioStartTime<=0) return;
      const elapsed=(performance.now()-ramp.audioStartTime)/1000;
      if(elapsed<120||elapsed>140) return;
      setDebugParams(p=>{
        const f=1.0018;
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
    <div
      ref={loginShellRef}
      className={
        mobileActive
          ? 'fixed inset-0 z-[5] flex min-h-[100dvh] w-full max-w-none flex-col items-center justify-center overflow-hidden bg-slate-950 p-0'
          : 'relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-950 p-6'
      }
    >

      {showDebug&&(
        <>
          <div
            className="fixed left-4 top-1/2 -translate-y-1/2 z-[60] transition-opacity duration-150 hidden md:block"
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
              isMobile={mobileActive || viewportNarrow}
              mobileImmersive={mobileActive}
              onTogglePlay={toggleAudioPlayPause}
            />
          )}
        </>
      )}

      {/* Three.js canvas — desktop always, mobile only when active */}
      <div ref={mountRef}
        className={`absolute inset-0 z-0 ${mobileActive ? 'block' : 'hidden md:block'}`}
        style={mobileActive ? {position:'fixed',inset:0,zIndex:0} : {}}
      />

      {live.tvFilterEnabled>0&&(
        <div className="hidden md:block absolute inset-0 z-[1] pointer-events-none bg-black/60 shadow-[inset_0_0_150px_rgba(0,0,0,0.8)]"
          style={{backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.3) 2px,rgba(0,0,0,0.3) 4px)'}}/>
      )}

      <div className="absolute md:hidden top-0 left-0 w-[500px] h-[500px] bg-orange-600/20 blur-[120px] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 z-0"/>

      <div className={`relative z-10 w-full max-w-md transition-opacity duration-200 ${(hideCard||mobileActive)?'opacity-0 pointer-events-none':''}`}>
        <Suspense fallback={<div className="text-white text-center">Cargando...</div>}>
          <LoginForm onMobilePlay={handleMobilePlay}/>
        </Suspense>
      </div>

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

      <EQBadge eq={eqState} samplerState={samplerState}/>

      {/* "Shift para opciones" hint — desktop only, 10s after music starts ← NEW */}
      {showShiftHint && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 hidden md:flex items-center gap-3 px-5 py-2.5 rounded-full pointer-events-none select-none transition-opacity"
          style={{background:'rgba(2,4,20,0.85)',backdropFilter:'blur(12px)',border:'1px solid rgba(255,255,255,0.1)'}}>
          <kbd className="text-[10px] font-black tracking-widest text-slate-300 bg-white/10 px-2 py-1 rounded-md">SHIFT</kbd>
          <span className="text-[11px] text-slate-400">Para opciones</span>
        </div>
      )}

      {/* Mobile debug toggle button (two-finger tap also works) */}
      {mobileActive && showDebug && !debugOpen && (
        <button
          className="fixed bottom-6 right-4 z-[60] w-12 h-12 rounded-full bg-slate-950/90 border border-white/10 flex items-center justify-center md:hidden"
          style={{backdropFilter:'blur(12px)'}}
          onClick={()=>setDebugOpen(true)}
        >
          <Settings2 size={20} className="text-slate-300"/>
        </button>
      )}
      {/* Glass cursor — CSS spring physics — DISABLED (Three.js sphere active)
      <GlassCursor
        mousePixelRef={mousePixelRef}
        bandsRef={bandsRef}
        audioPlaying={audioPlaying}
      />
      */}
    </div>
  );
}