'use client';
import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Loader2, AlertCircle, Settings2, X } from 'lucide-react';

// Importaciones de Three.js
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader.js';

// --- Componente del Formulario ---
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  // Tras login con Google, el backend redirige aquí con ?token= y ?user=
  useEffect(() => {
    const token = searchParams.get('token');
    const userStr = searchParams.get('user');

    if (token && userStr) {
      localStorage.setItem('token', token);
      localStorage.setItem('user', decodeURIComponent(userStr));
      window.dispatchEvent(new Event('storage'));
      router.push('/'); 
    }
  }, [searchParams, router]);

  // Login Normal (Email/Pass)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.dispatchEvent(new Event('storage'));
        router.push('/');
      } else {
        setError('Credenciales inválidas');
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  // Función para iniciar el viaje a Google
  const handleGoogleLogin = () => {
    window.location.href = `${apiUrl}/auth/google`;
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-md relative z-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-white mb-2">Bienvenido</h1>
        <p className="text-slate-400">Ingresa a tu cuenta para continuar</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl mb-6 flex items-center gap-2 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* --- BOTÓN DE GOOGLE --- */}
      <button 
        onClick={handleGoogleLogin}
        className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3.5 rounded-xl transition flex justify-center items-center gap-3 mb-6 relative group overflow-hidden"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        <span>Continuar con Google</span>
      </button>

      <div className="relative flex py-2 items-center mb-6">
        <div className="flex-grow border-t border-slate-700"></div>
        <span className="flex-shrink mx-4 text-slate-500 text-xs font-bold uppercase">O ingresa con email</span>
        <div className="flex-grow border-t border-slate-700"></div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="email"
            placeholder="Correo electrónico"
            className="w-full bg-slate-950/80 border border-slate-800 p-4 pl-12 rounded-xl text-white focus:border-orange-500 focus:bg-slate-950 focus:outline-none placeholder:text-slate-600 transition-all"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="password"
            placeholder="Contraseña"
            className="w-full bg-slate-950/80 border border-slate-800 p-4 pl-12 rounded-xl text-white focus:border-orange-500 focus:bg-slate-950 focus:outline-none placeholder:text-slate-600 transition-all"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />
        </div>

        <div className="flex justify-end">
          <Link href="/login/olvide-password" className="text-sm text-orange-500 hover:text-orange-400 font-bold">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <button
          disabled={loading}
          className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 py-4 rounded-xl text-white font-bold flex justify-center items-center gap-2 transition-all shadow-lg shadow-orange-900/30 hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="animate-spin" /> : 'Ingresar'}
        </button>
      </form>

      <div className="mt-8 text-center">
        <p className="text-slate-400 text-sm">
          ¿No tienes cuenta?{' '}
          <Link href="/registro" className="text-orange-500 font-bold hover:text-orange-400">
            Regístrate aquí
          </Link>
        </p>
      </div>
    </div>
  );
}

const LOGIN_MUSIC_URL = "/music.mp3";

const DEFAULT_LOGIN_DEBUG = {
  topColor: '#0a198c',
  bottomColor: '#11133b',
  bloomStrength: 1.0,
  speed: 0.2,
  lightIntensity: 1.2,
  rgbShiftAmount: 0.001,
};

// --- Página Principal (Wrapper con Suspense y Three.js) ---
export default function LoginPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const loginParamsRef = useRef({ ...DEFAULT_LOGIN_DEBUG });
  const [showDebugButton, setShowDebugButton] = useState(false);
  const [debugMenuOpen, setDebugMenuOpen] = useState(false);
  const [loginDebugParams, setLoginDebugParams] = useState(DEFAULT_LOGIN_DEBUG);
  const [hideLoginCard, setHideLoginCard] = useState(false);

  // Sincronizar params del debug al ref que usa el bucle de animación
  useEffect(() => {
    loginParamsRef.current = { ...loginDebugParams };
  }, [loginDebugParams]);

  // En escritorio: Shift muestra/oculta el botón Debug
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "ShiftLeft" && e.code !== "ShiftRight") return;
      if (typeof window !== "undefined" && window.innerWidth < 768) return;
      setShowDebugButton((v) => !v);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // En escritorio (≥768px): barra espaciadora activa/pausa la música de fondo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (typeof window !== "undefined" && window.innerWidth < 768) return;
      if (!musicRef.current) {
        const audio = new Audio(LOGIN_MUSIC_URL);
        musicRef.current = audio;
      }
      const audio = musicRef.current;
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (window.innerWidth < 768 || !mountRef.current) return;

    const currentMount = mountRef.current;
    const p = loginParamsRef.current;

    const params = {
      warpDrive: false,
      speed: p.speed,
      cameraOffsetY: 3.0,
      angleOffset: -0.25,
      topColor: p.topColor,
      bottomColor: p.bottomColor,
      bloomStrength: p.bloomStrength,
      bloomRadius: 0.2,
      bloomThreshold: 0.15,
      lightIntensity: p.lightIntensity,
      depthFade: 0.001,
      showRings: true,
      ringCount: 10.0,
      rgbShiftAmount: p.rgbShiftAmount,
      reflectionStrength: 0.35,
      mouseParallax: 5.0,
      ghostIntensity: 1.0,
      matrixIntensity: 0.25
    };

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(params.topColor, 0.008);

    const camera = new THREE.PerspectiveCamera(85, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    currentMount.appendChild(renderer.domElement);

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      params.bloomStrength,
      params.bloomRadius,
      params.bloomThreshold
    );

    const rgbShiftPass = new ShaderPass(RGBShiftShader);
    rgbShiftPass.uniforms['amount'].value = params.rgbShiftAmount;

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composer.addPass(rgbShiftPass);

    const points = [];
    const segments = 400;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = t * Math.PI * 2;
      const x = Math.cos(angle) * 350;
      const z = Math.sin(angle * 2) * 250;
      const y = Math.sin(angle * 3) * 35;
      points.push(new THREE.Vector3(x, y, z));
    }

    const curve = new THREE.CatmullRomCurve3(points, true);
    curve.computeFrenetFrames = function(segments, closed) {
        const tangents = [], normals = [], binormals = [];
        const up = new THREE.Vector3(0, 1, 0);

        for ( let i = 0; i <= segments; i ++ ) {
            const u = i / segments;
            const tangent = this.getTangentAt( u ).normalize();
            tangents.push( tangent );

            const binormal = new THREE.Vector3().crossVectors( tangent, up ).normalize();
            const normal = new THREE.Vector3().crossVectors( binormal, tangent ).normalize();

            binormals.push( binormal );
            normals.push( normal );
        }
        return { tangents, normals, binormals };
    };

    const tubeRadius = 15;
    const tubeGeometry = new THREE.TubeGeometry(curve, segments * 2, tubeRadius, 64, true);

    const matrixCanvas = document.createElement('canvas');
    matrixCanvas.width = 1024;
    matrixCanvas.height = 1024;
    const ctx = matrixCanvas.getContext('2d');
    if(ctx) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 1024, 1024);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 44px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for(let y = 24; y < 1024; y += 48) {
            for(let x = 24; x < 1024; x += 48) {
                const char = String.fromCharCode(0xFF66 + Math.floor(Math.random() * 55));
                ctx.globalAlpha = 0.4 + Math.random() * 0.6;
                ctx.fillText(char, x, y);
            }
        }
    }
    const matrixTexture = new THREE.CanvasTexture(matrixCanvas);
    matrixTexture.wrapS = THREE.RepeatWrapping;
    matrixTexture.wrapT = THREE.RepeatWrapping;

    const vertexShader = `
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      void main() {
          vUv = uv;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `;

    const fragmentShader = `
      uniform float uTime;
      uniform vec3 uTopColor;
      uniform vec3 uBottomColor;
      uniform float uAngleOffset;
      uniform float uIntensity;
      uniform float uDepthFade;
      uniform float uReflectionStrength;
      uniform float uShowRings;
      uniform float uRingCount;
      uniform float uGhostIntensity; 
      uniform sampler2D uMatrixTex;
      uniform float uMatrixIntensity;

      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      float rand(float n) { return fract(sin(n) * 43758.5453123); }

      vec3 addSegmentedLine(vec3 color, float uvPrimary, float targetPrimary, float width, float uvSecondary, float id, float time, float speedMult, bool isRing) {
          float shiftedTarget = targetPrimary;
          if (!isRing) {
              shiftedTarget += (rand(id * 8.2) - 0.5) * 0.12; 
          }
          float actualWidth = width * (0.1 + rand(id * 4.5) * 12.0);
          float weight = exp(-pow((uvPrimary - shiftedTarget) * actualWidth, 2.0));
          float speed = (0.5 + rand(id) * 4.0) * speedMult;
          float dir = rand(id * 2.1) > 0.5 ? 1.0 : -1.0;
          float scale = isRing ? floor(2.0 + rand(id * 1.3) * 6.0) : 0.05 + rand(id * 1.3) * 30.0;
          float phase = rand(id * 1.7) * 20.0;
          float movingCoord = uvSecondary * scale + time * speed * dir + phase;
          float dashPos = fract(movingCoord);
          float dashLen = 0.01 + rand(id * 3.4) * 0.93; 
          float dashFade = 0.01 + rand(id * 7.1) * 0.08; 
          float mask = smoothstep(0.0, dashFade, dashPos) * smoothstep(dashLen + dashFade, dashLen, dashPos);
          float baseScale = scale * (0.02 + rand(id * 5.2) * 0.3); 
          float baseSpeed = speed * 0.1; 
          float baseCoord = uvSecondary * baseScale + time * baseSpeed * dir + phase * 2.0;
          float basePos = fract(baseCoord);
          float baseLen = 0.1 + rand(id * 2.2) * 0.8; 
          float baseFade = 0.1;
          float baseMask = smoothstep(0.0, baseFade, basePos) * smoothstep(baseLen + baseFade, baseLen, basePos);
          return color * weight * (0.25 * baseMask + 0.85 * mask);
      }

      vec3 addParticleDot(vec3 color, float uvPrimary, float targetPrimary, float width, float uvSecondary, float id, float time, float speedMult) {
          float actualWidth = width * (0.5 + rand(id * 6.1) * 3.0);
          float weight = exp(-pow((uvPrimary - targetPrimary) * actualWidth, 2.0));
          float speed = (2.0 + rand(id) * 4.0) * speedMult; 
          float dir = rand(id * 2.1) > 0.5 ? 1.0 : -1.0;
          float scale = 10.0 + rand(id * 1.3) * 80.0;
          float phase = rand(id * 1.7) * 10.0;
          float movingCoord = uvSecondary * scale + time * speed * dir + phase;
          float dashPos = fract(movingCoord);
          float dashLen = 0.001 + rand(id * 3.4) * 0.015; 
          float dashFade = 0.005;
          float mask = smoothstep(0.0, dashFade, dashPos) * smoothstep(dashLen + dashFade, dashLen, dashPos);
          return color * weight * mask * 4.0;
      }

      vec3 getGhostLayer(float h, float uvX, float time, float seed) {
          float scroll = uvX * 12.0 + time * 0.3 * (rand(seed) > 0.5 ? 1.0 : -1.0); 
          float idX = floor(scroll);
          float localX = fract(scroll);
          float hasPanel = step(0.70, rand(idX + seed));
          float idY = floor(h * 80.0);
          float hasBar = step(0.30, rand(idY * 15.0 + idX));
          float pulse = pow(sin(time * 1.2 + rand(idX) * 10.0) * 0.5 + 0.5, 2.0);
          float maskX = smoothstep(0.0, 0.2, localX) * smoothstep(1.0, 0.8, localX);
          vec3 techColor = mix(vec3(0.2, 0.7, 1.0), vec3(1.0, 0.3, 0.7), rand(idX * 1.1)); 
          vec3 panel = techColor * hasPanel * hasBar * maskX * pulse * 0.35;
          float wave = sin(uvX * 5.0 + time * 0.5 + seed) * sin(h * 10.0 - time * 0.4 + seed) * 0.5 + 0.5;
          wave = pow(wave, 5.0); 
          vec3 washColor = mix(vec3(0.1, 0.5, 1.0), vec3(0.8, 0.1, 0.5), rand(seed * 2.0));
          vec3 wash = washColor * wave * 0.03;
          return (panel + wash) * uGhostIntensity;
      }

      vec3 getRightSideColor(float h, float uvX, float time) {
          vec3 c = vec3(0.0);
          float hw = h + sin(uvX * 100.0) * 0.003;
          c += addSegmentedLine(vec3(0.2, 0.4, 1.0), hw, 0.35, 60.0,  uvX * 100.0, 10.0, time, 2.0, false); 
          c += addSegmentedLine(vec3(1.0, 0.2, 0.7), hw, 0.28, 300.0, uvX * 100.0, 11.0, time, 2.0, false); 
          c += addSegmentedLine(vec3(1.0, 0.6, 0.1), hw, 0.20, 120.0, uvX * 100.0, 12.0, time, 2.0, false); 
          c += addSegmentedLine(vec3(0.0, 0.8, 1.0), hw, 0.10, 40.0,  uvX * 100.0, 13.0, time, 2.0, false); 
          c += addSegmentedLine(vec3(1.0, 0.9, 0.2), hw, 0.02, 500.0, uvX * 100.0, 14.0, time, 2.0, false); 
          c += addSegmentedLine(vec3(0.1, 0.9, 0.3), hw, -0.08, 150.0, uvX * 100.0, 15.0, time, 2.0, false); 
          c += addSegmentedLine(vec3(1.0, 0.4, 0.0), hw, -0.18, 80.0,  uvX * 100.0, 16.0, time, 2.0, false); 
          c += addSegmentedLine(vec3(1.0, 0.1, 0.1), hw, -0.28, 400.0, uvX * 100.0, 17.0, time, 2.0, false); 
          c += addSegmentedLine(vec3(1.0), hw, 0.28, 450.0, uvX * 100.0, 18.0, time, 2.5, false) * 0.5;
          c += addSegmentedLine(vec3(1.0), hw, 0.10, 800.0, uvX * 100.0, 19.0, time, 2.5, false) * 0.5;
          c += addParticleDot(vec3(1.0, 0.5, 1.0), hw, 0.30, 400.0, uvX * 100.0, 80.0, time, 1.5);
          c += addParticleDot(vec3(0.5, 1.0, 1.0), hw, 0.15, 350.0, uvX * 100.0, 81.0, time, 2.5);
          c += addParticleDot(vec3(1.0, 1.0, 0.5), hw, -0.05, 450.0, uvX * 100.0, 82.0, time, 2.0);
          c += addParticleDot(vec3(1.0, 0.2, 0.2), hw, -0.20, 300.0, uvX * 100.0, 83.0, time, 3.0);
          c += getGhostLayer(hw, uvX, time, 112.3);
          return c;
      }

      vec3 getLeftSideColor(float h, float uvX, float time) {
          vec3 c = vec3(0.0);
          float hw = h + sin(uvX * 120.0 + 1.0) * 0.003;
          c += addSegmentedLine(vec3(1.0, 0.4, 0.0), hw, 0.32,  70.0,  uvX * 100.0, 20.0, time, 2.0, false); 
          c += addSegmentedLine(vec3(1.0, 0.1, 0.5), hw, 0.25,  350.0, uvX * 100.0, 21.0, time, 2.0, false); 
          c += addSegmentedLine(vec3(0.1, 0.6, 1.0), hw, 0.15,  120.0, uvX * 100.0, 22.0, time, 2.0, false); 
          c += addSegmentedLine(vec3(0.2, 0.9, 0.4), hw, 0.05,  50.0,  uvX * 100.0, 23.0, time, 2.0, false); 
          c += addSegmentedLine(vec3(1.0, 0.8, 0.0), hw, -0.05, 450.0, uvX * 100.0, 24.0, time, 2.0, false); 
          c += addSegmentedLine(vec3(1.0, 0.2, 0.1), hw, -0.15, 150.0, uvX * 100.0, 25.0, time, 2.0, false); 
          c += addSegmentedLine(vec3(0.6, 0.1, 1.0), hw, -0.25, 60.0,  uvX * 100.0, 26.0, time, 2.0, false); 
          c += addSegmentedLine(vec3(1.0), hw, 0.15, 600.0, uvX * 100.0, 27.0, time, 2.5, false) * 0.5;
          c += addSegmentedLine(vec3(1.0), hw, -0.05, 900.0, uvX * 100.0, 28.0, time, 2.5, false) * 0.5;
          c += addParticleDot(vec3(1.0, 0.8, 0.2), hw, 0.28, 350.0, uvX * 100.0, 90.0, time, 1.8);
          c += addParticleDot(vec3(0.2, 0.8, 1.0), hw, 0.10, 400.0, uvX * 100.0, 91.0, time, 2.2);
          c += addParticleDot(vec3(0.5, 1.0, 0.5), hw, -0.10, 300.0, uvX * 100.0, 92.0, time, 1.5);
          c += addParticleDot(vec3(1.0, 0.4, 0.8), hw, -0.20, 450.0, uvX * 100.0, 93.0, time, 2.7);
          c += getGhostLayer(hw, uvX, time, 442.1);
          return c;
      }

      vec3 getColorfulRings(float uvX, float uvY, float time) {
          vec3 c = vec3(0.0);
          float localX = fract(uvX * uRingCount);
          float cellId = floor(uvX * uRingCount);
          float ringType = fract(rand(cellId) * 10.0); 
          vec3 rColor = vec3(0.0);
          if (ringType < 0.2) rColor = vec3(1.0, 0.2, 0.7);
          else if (ringType < 0.4) rColor = vec3(0.0, 0.8, 1.0);
          else if (ringType < 0.6) rColor = vec3(1.0, 0.6, 0.1);
          else if (ringType < 0.8) rColor = vec3(0.1, 0.9, 0.3);
          else rColor = vec3(1.0, 0.9, 0.2);
          c += addSegmentedLine(rColor, localX, 0.5, 60.0 + rand(cellId)*40.0, uvY, cellId, time, 1.0, true);
          float activeMask = rand(cellId + 10.0) > 0.3 ? 1.0 : 0.0;
          return c * activeMask;
      }

      void main() {
          float y = fract(vUv.y + uAngleOffset);
          float cy = sin(y * 6.2831853); 
          float cx = cos(y * 6.2831853);
          vec3 bgColor = mix(uBottomColor, uTopColor, smoothstep(-0.2, 0.5, cy));
          vec3 streakColor = vec3(0.0);
          if (cx > 0.0) {
              streakColor = getRightSideColor(cy, vUv.x, uTime);
          } else {
              streakColor = getLeftSideColor(cy, vUv.x, uTime);
          }
          vec3 ceilingColor = vec3(0.0);
          if (cy > 0.4) { 
              float hwCeiling = cy + sin(vUv.x * 80.0) * 0.005; 
              ceilingColor += addSegmentedLine(vec3(0.6, 0.8, 1.0), hwCeiling, 0.70, 500.0, vUv.x * 100.0, 30.0, uTime, 0.5, false) * 0.5;
              ceilingColor += addSegmentedLine(vec3(0.8, 0.9, 1.0), hwCeiling, 0.82, 800.0, vUv.x * 100.0, 31.0, uTime, 0.4, false) * 0.7;
              ceilingColor += addSegmentedLine(vec3(0.9, 0.95, 1.0), hwCeiling, 0.92, 1000.0, vUv.x * 100.0, 32.0, uTime, 0.6, false) * 0.9;
              ceilingColor += addSegmentedLine(vec3(1.0, 1.0, 1.0), hwCeiling, 0.76, 600.0, vUv.x * 100.0, 40.0, uTime, 3.0, false) * 0.7;
              ceilingColor += addSegmentedLine(vec3(0.5, 0.8, 1.0), hwCeiling, 0.88, 700.0, vUv.x * 100.0, 41.0, uTime, 2.5, false) * 0.6;
          }
          float sideMask = smoothstep(0.7, 0.1, abs(cy));
          vec3 finalColor = bgColor + (streakColor * uIntensity * sideMask) + (ceilingColor * uIntensity);
          if (uShowRings > 0.5) {
              vec3 ringsColor = getColorfulRings(vUv.x, y, uTime);
              float ringMask = smoothstep(-0.8, -0.4, cy); 
              finalColor += ringsColor * uIntensity * ringMask;
          }
          if (uMatrixIntensity > 0.0) {
              vec2 texUv = vec2(vUv.x * 250.0, y * 14.0);
              float textVal = texture2D(uMatrixTex, texUv).r;
              float streamId = floor(texUv.y);
              float speed = 0.5 + rand(streamId * 1.5) * 1.5;
              float phase = rand(streamId * 7.1) * 10.0;
              float dir = rand(streamId * 3.3) > 0.5 ? 1.0 : -1.0; 
              float trailCoord = vUv.x * 8.0 + uTime * speed * dir + phase;
              float trailPos = fract(trailCoord);
              float trailMask = smoothstep(0.0, 0.8, trailPos) * smoothstep(1.0, 0.95, trailPos);
              float headMask = smoothstep(0.95, 1.0, trailPos);
              float cellId = floor(texUv.x) + streamId * 100.0;
              float flicker = sin(uTime * 15.0 + rand(cellId) * 20.0) * 0.5 + 0.5;
              float matrixVisibility = (trailMask * 0.6 + headMask * 2.0) * (0.3 + 0.7 * flicker);
              vec3 matrixBaseColor = vec3(0.0, 0.9, 0.3);
              vec3 matrixHeadColor = vec3(0.6, 1.0, 0.8);
              vec3 mColor = mix(matrixBaseColor, matrixHeadColor, headMask);
              float matrixSideMask = smoothstep(0.8, 0.2, abs(cy));
              finalColor += mColor * textVal * matrixVisibility * uMatrixIntensity * matrixSideMask * uIntensity;
          }
          if (cy < -0.2 && uReflectionStrength > 0.0) {
              float refCy = abs(cy); 
              float ripple = sin(vUv.x * 300.0 - uTime * 5.0) * 0.03 + sin(vUv.x * 1000.0) * 0.01;
              float refCx = cx + ripple;
              vec3 reflection = vec3(0.0);
              if (refCx > 0.0) {
                  reflection = getRightSideColor(refCy, vUv.x, uTime);
              } else {
                  reflection = getLeftSideColor(refCy, vUv.x, uTime);
              }
              float refMask = smoothstep(-0.2, -0.8, cy) * smoothstep(-1.0, -0.9, cy);
              finalColor += reflection * uReflectionStrength * refMask;
          }
          float dist = length(cameraPosition - vWorldPosition);
          float fogFactor = exp(-dist * uDepthFade);
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          float fresnel = max(0.0, dot(-vWorldNormal, viewDir));
          float cavityShadow = mix(0.5, 1.0, smoothstep(0.0, 0.8, fresnel)); 
          finalColor *= cavityShadow; 
          finalColor = mix(uBottomColor, finalColor, fogFactor); 
          gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const tubeMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uTopColor: { value: new THREE.Color(params.topColor) },
        uBottomColor: { value: new THREE.Color(params.bottomColor) },
        uAngleOffset: { value: params.angleOffset },
        uIntensity: { value: params.lightIntensity },
        uDepthFade: { value: params.depthFade },
        uShowRings: { value: params.showRings ? 1.0 : 0.0 },
        uRingCount: { value: params.ringCount },
        uReflectionStrength: { value: params.reflectionStrength },
        uGhostIntensity: { value: params.ghostIntensity },
        uMatrixTex: { value: matrixTexture },
        uMatrixIntensity: { value: params.matrixIntensity }
      },
      side: THREE.BackSide
    });

    const tunnelMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);
    scene.add(tunnelMesh);

    // --- Paletas de Colores Armónicas ---
    const colorPalettes = [
      { top: '#0a198c', bottom: '#11133b' }, // 0. Azul Profundo (Original)
      { top: '#004d1a', bottom: '#001a08' }, // 1. Verde Matrix
      { top: '#4a0072', bottom: '#1a0029' }, // 2. Cyberpunk Púrpura
      { top: '#801300', bottom: '#2b0600' }, // 3. Rojo Lava/Carmesi
      { top: '#004059', bottom: '#00141c' }  // 4. Teal / Océano
    ];
    let currentPaletteIndex = 0;

    // --- Interacción con Mouse y Teclado ---
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const onMouseMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
      targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.code === 'Space') {
        params.warpDrive = !params.warpDrive;
      }
    };

    const onClick = () => {
      currentPaletteIndex = (currentPaletteIndex + 1) % colorPalettes.length;
      const newColors = colorPalettes[currentPaletteIndex];
      loginParamsRef.current = { ...loginParamsRef.current, topColor: newColors.top, bottomColor: newColors.bottom };
      tubeMaterial.uniforms.uTopColor.value.set(newColors.top);
      tubeMaterial.uniforms.uBottomColor.value.set(newColors.bottom);
      if (scene.fog) {
          scene.fog.color.set(newColors.top);
      }
    };

    // --- Control de Velocidad con la Rueda del Mouse (Scroll) ---
    const onWheel = (e: WheelEvent) => {
      const scrollSensibility = 0.0015;
      const r = loginParamsRef.current;
      r.speed = Math.max(0.02, Math.min(r.speed - e.deltaY * scrollSensibility, 5.0));
      if (params.warpDrive) params.warpDrive = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('click', onClick);
    window.addEventListener('wheel', onWheel); 

    // --- Bucle de Animación ---
    const clock = new THREE.Clock();
    let flightProgress = 0;
    let currentSpeed = params.speed;
    let animationId: number;
    
    function getFloorPosition(t: number, yOffset: number) {
      const pos = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(tan, up).normalize();
      const normal = new THREE.Vector3().crossVectors(right, tan).normalize();
      return pos.add(normal.multiplyScalar(yOffset));
    }

    function animate() {
      animationId = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const time = clock.getElapsedTime();
      const live = loginParamsRef.current;

      tubeMaterial.uniforms.uTime.value = time;
      tubeMaterial.uniforms.uTopColor.value.set(live.topColor);
      tubeMaterial.uniforms.uBottomColor.value.set(live.bottomColor);
      tubeMaterial.uniforms.uIntensity.value = live.lightIntensity;
      if (scene.fog) (scene.fog as THREE.FogExp2).color.set(live.topColor);

      const targetSpeed = params.warpDrive ? 1.2 : live.speed;
      const targetFOV = params.warpDrive ? 130 : 85;
      const targetRGB = params.warpDrive ? 0.008 : live.rgbShiftAmount;
      const targetBloom = params.warpDrive ? 2.5 : live.bloomStrength;

      currentSpeed = THREE.MathUtils.lerp(currentSpeed, targetSpeed, dt * 2.0);
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFOV, dt * 3.0);
      camera.updateProjectionMatrix();
      
      rgbShiftPass.uniforms['amount'].value = THREE.MathUtils.lerp(rgbShiftPass.uniforms['amount'].value, targetRGB, dt * 3.0);
      bloomPass.strength = THREE.MathUtils.lerp(bloomPass.strength, targetBloom, dt * 3.0);

      flightProgress += (currentSpeed * dt) * 0.1; 
      flightProgress = flightProgress % 1.0; 

      const camPos = getFloorPosition(flightProgress, params.cameraOffsetY);
      const lookAtPos = curve.getPointAt((flightProgress + 0.012) % 1.0);

      camera.position.copy(camPos);
      camera.lookAt(lookAtPos);

      mouseX = THREE.MathUtils.lerp(mouseX, targetMouseX, dt * 4.0);
      mouseY = THREE.MathUtils.lerp(mouseY, targetMouseY, dt * 4.0);
      
      camera.translateX(mouseX * params.mouseParallax);
      camera.translateY(mouseY * params.mouseParallax * 0.5); 
      camera.rotateZ(-mouseX * 0.1 * params.mouseParallax);
      camera.rotateX(mouseY * 0.05 * params.mouseParallax);

      composer.render();
    }

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    animate();

    // --- Limpieza al desmontar ---
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('click', onClick);
      window.removeEventListener('wheel', onWheel);
      if (currentMount.contains(renderer.domElement)) {
          currentMount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      tubeMaterial.dispose();
      tubeGeometry.dispose();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Debug (solo escritorio): Shift para mostrar; mismo estilo que /info */}
      {showDebugButton && (
        <div className="hidden md:block fixed left-6 top-[38%] -translate-y-1/2 z-[60] flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDebugMenuOpen((o) => !o)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950/90 backdrop-blur-xl border border-white/10 text-slate-300 hover:text-white hover:border-orange-500/40 hover:shadow-[0_0_20px_rgba(249,115,22,0.15)] transition-all font-bold text-sm"
          >
            <Settings2 size={18} />
            Debug
          </button>
          {debugMenuOpen && (
            <div className="fixed left-24 top-1/2 -translate-y-1/2 w-72 rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-2xl overflow-hidden z-[61]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-gradient-to-r from-slate-900/90 to-transparent">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Fondo Login</span>
                <button
                  type="button"
                  onClick={() => setDebugMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <label className="flex items-center justify-between gap-3 cursor-pointer py-2 border-b border-white/5">
                  <span className="text-xs font-bold text-slate-400">Ocultar tarjeta de login (solo fondo)</span>
                  <input
                    type="checkbox"
                    checked={hideLoginCard}
                    onChange={(e) => setHideLoginCard(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-slate-800 text-orange-500 focus:ring-orange-500/50"
                  />
                </label>
                <div>
                  <span className="text-xs font-bold text-slate-400 block mb-1">Color superior</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={loginDebugParams.topColor}
                      onChange={(e) => setLoginDebugParams((p) => ({ ...p, topColor: e.target.value }))}
                      className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent"
                    />
                    <span className="text-xs font-mono text-slate-500">{loginDebugParams.topColor}</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 block mb-1">Color inferior</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={loginDebugParams.bottomColor}
                      onChange={(e) => setLoginDebugParams((p) => ({ ...p, bottomColor: e.target.value }))}
                      className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent"
                    />
                    <span className="text-xs font-mono text-slate-500">{loginDebugParams.bottomColor}</span>
                  </div>
                </div>
                <div>
                  <label className="flex justify-between items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-400">Bloom</span>
                    <span className="text-xs font-mono text-orange-400">{loginDebugParams.bloomStrength.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.05}
                    value={loginDebugParams.bloomStrength}
                    onChange={(e) => setLoginDebugParams((p) => ({ ...p, bloomStrength: parseFloat(e.target.value) }))}
                    className="w-full h-2 rounded-full bg-slate-800 accent-orange-500"
                  />
                </div>
                <div>
                  <label className="flex justify-between items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-400">Velocidad</span>
                    <span className="text-xs font-mono text-orange-400">{loginDebugParams.speed.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min={0.02}
                    max={2}
                    step={0.01}
                    value={loginDebugParams.speed}
                    onChange={(e) => setLoginDebugParams((p) => ({ ...p, speed: parseFloat(e.target.value) }))}
                    className="w-full h-2 rounded-full bg-slate-800 accent-orange-500"
                  />
                </div>
                <div>
                  <label className="flex justify-between items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-400">Intensidad luz</span>
                    <span className="text-xs font-mono text-orange-400">{loginDebugParams.lightIntensity.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min={0.2}
                    max={3}
                    step={0.05}
                    value={loginDebugParams.lightIntensity}
                    onChange={(e) => setLoginDebugParams((p) => ({ ...p, lightIntensity: parseFloat(e.target.value) }))}
                    className="w-full h-2 rounded-full bg-slate-800 accent-orange-500"
                  />
                </div>
                <div>
                  <label className="flex justify-between items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-400">RGB Shift</span>
                    <span className="text-xs font-mono text-orange-400">{loginDebugParams.rgbShiftAmount.toFixed(4)}</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={0.02}
                    step={0.0005}
                    value={loginDebugParams.rgbShiftAmount}
                    onChange={(e) => setLoginDebugParams((p) => ({ ...p, rgbShiftAmount: parseFloat(e.target.value) }))}
                    className="w-full h-2 rounded-full bg-slate-800 accent-orange-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setLoginDebugParams(DEFAULT_LOGIN_DEBUG)}
                  className="w-full py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white border border-white/10 hover:border-orange-500/30 transition-colors"
                >
                  Restaurar valores
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contenedor del fondo Three.js */}
      <div ref={mountRef} className="hidden md:block absolute inset-0 z-0"></div>

      {/* Filtro CRT de TV y Oscurecimiento al 60% */}
      <div 
        className="hidden md:block absolute inset-0 z-[1] pointer-events-none bg-black/60 shadow-[inset_0_0_150px_rgba(0,0,0,0.8)]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)'
        }}
      ></div>

      {/* Decoración original que actúa como fallback en móviles */}
      <div className="absolute md:hidden top-0 left-0 w-[500px] h-[500px] bg-orange-600/20 blur-[120px] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 z-0"></div>
        
      {/* Contenedor del Formulario centrado usando Suspense (ocultable desde Debug) */}
      <div
        className={`relative z-10 w-full max-w-md transition-opacity duration-200 ${hideLoginCard ? "opacity-0 pointer-events-none" : ""}`}
      >
        <Suspense fallback={<div className="text-white text-center">Cargando login...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}