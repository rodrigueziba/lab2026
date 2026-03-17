'use client';

/**
 * ScreensaverGallery.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Protector de pantalla para Film TDF.
 *
 * Extiende DepthGallery (v4) con:
 *  - Video YouTube de fondo al llegar al final del scroll (efecto "cine cóncavo")
 *  - Filtro tipo TV (scanlines + CRT leve) sobre el video
 *  - Al hacer scroll atrás desde el video → vuelve a la última imagen
 *  - Flechas laterales para cambiar de prestador (izq / der)
 *  - Auto-advance al siguiente prestador cada 60 segundos
 *  - Transición suave entre prestadores (fade + slide)
 *
 * INSTALACIÓN:  npm install three @types/three
 * USO (Next.js):
 *   import dynamic from 'next/dynamic'
 *   const ScreensaverGallery = dynamic(
 *     () => import('@/components/ScreensaverGallery'),
 *     { ssr: false }
 *   )
 *
 *   <ScreensaverGallery
 *     prestadores={[
 *       {
 *         id: '1',
 *         nombre: 'Pelpe Farano',
 *         categoria: 'Fotografía',
 *         videoReel: 'https://www.youtube.com/watch?v=XXXX',
 *         imagenes: [
 *           { src: '/img/foto1.jpg', title: 'Golden', mood: { background: '#fbe8cd', blob1: '#ffd56d', blob2: '#5d816a' } },
 *           ...
 *         ]
 *       },
 *       ...
 *     ]}
 *     height="100vh"
 *   />
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface GalleryItem {
  src: string;
  title?: string;
  description?: string;
  mood?: { background: string; blob1: string; blob2: string };
  positionX?: number;
  colorLabel?: string;
}

export interface Prestador {
  id: string;
  nombre: string;
  categoria?: string;
  /** URL de YouTube: https://youtube.com/watch?v=ID o https://youtu.be/ID */
  videoReel?: string | null;
  imagenes: GalleryItem[];
}

export interface ScreensaverGalleryProps {
  prestadores: Prestador[];
  height?: string;
  /** Segundos antes de avanzar al siguiente prestador (default: 60) */
  autoAdvanceSeconds?: number;
  onPrestadorChange?: (prestador: Prestador, index: number) => void;
}

// ─── Shaders ─────────────────────────────────────────────────────────────────

const PLANE_VERT = /* glsl */ `
  varying vec2 vUv;
  uniform float uVelocity;
  uniform float uTime;
  void main() {
    vUv = uv;
    vec3 pos = position;
    float bend = sin(pos.x * 2.2 + uTime * 0.8) * uVelocity * 0.035;
    pos.y += bend;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const PLANE_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform float uVelocity;
  uniform float uOpacity;
  void main() {
    float ca = abs(uVelocity) * 0.004;
    float r = texture2D(uTexture, vUv + vec2( ca, 0.0)).r;
    float g = texture2D(uTexture, vUv            ).g;
    float b = texture2D(uTexture, vUv - vec2( ca, 0.0)).b;
    gl_FragColor = vec4(r, g, b, uOpacity);
  }
`;

const BG_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BG_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uBgColor;
  uniform vec3 uBlob1Color;
  uniform vec3 uBlob2Color;
  uniform float uTime;
  uniform float uVelocityIntensity;
  uniform float uVideoBlend; // 0=fondo normal, 1=oscurecer para mostrar video

  float random(vec2 st) {
    return fract(sin(dot(st, vec2(1387.13, 947.91))) * 43758.5453);
  }

  void main() {
    float t1 = uTime * 0.11;
    vec2 b1 = vec2(0.22 + sin(t1) * 0.13, 0.74 + cos(t1 * 0.8) * 0.10);
    float d1 = smoothstep(0.52, 0.0, distance(vUv, b1));

    float t2 = uTime * 0.16 + 2.1;
    vec2 b2 = vec2(0.75 + cos(t2) * 0.11, 0.27 + sin(t2 * 0.9) * 0.09);
    float d2 = smoothstep(0.42, 0.0, distance(vUv, b2));

    vec3 color = uBgColor;
    vec3 s1 = mix(uBlob1Color, uBgColor, 0.35);
    vec3 s2 = mix(uBlob2Color, uBgColor, 0.35);
    color = mix(color, s1, d1 * 0.90);
    color = mix(color, s2, d2 * 0.90);
    color += uVelocityIntensity * 0.08;
    float grain = random(vUv * 312.0 + uTime * 0.3) - 0.5;
    color += grain * 0.022;

    // Fade a negro cuando se muestra el video
    color = mix(color, vec3(0.0), uVideoBlend);

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function toHex2(v: number) { return clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'); }

/** Extrae ID de YouTube de cualquier formato de URL */
function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function extractPalette(
  image: HTMLImageElement | ImageBitmap | HTMLCanvasElement
): { background: string; blob1: string; blob2: string } {
  try {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(image as CanvasImageSource, 0, 0, 32, 32);
    const d = ctx.getImageData(0, 0, 32, 32).data;
    let rs = 0, gs = 0, bs = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { rs += d[i]; gs += d[i+1]; bs += d[i+2]; n++; }
    const bg = `#${toHex2(rs/n)}${toHex2(gs/n)}${toHex2(bs/n)}`;
    let r1=0,g1=0,b1=0,n1=0;
    for (let row=0;row<16;row++) for (let col=0;col<16;col++) {
      const i=(row*32+col)*4; r1+=d[i];g1+=d[i+1];b1+=d[i+2];n1++;
    }
    const blob1=`#${toHex2(r1/n1*1.1)}${toHex2(g1/n1*1.05)}${toHex2(b1/n1)}`;
    let r2=0,g2=0,b2=0,n2=0;
    for (let row=16;row<32;row++) for (let col=16;col<32;col++) {
      const i=(row*32+col)*4; r2+=d[i];g2+=d[i+1];b2+=d[i+2];n2++;
    }
    const blob2=`#${toHex2(r2/n2)}${toHex2(g2/n2*1.05)}${toHex2(b2/n2*1.1)}`;
    return { background: bg, blob1, blob2 };
  } catch {
    return { background: '#fbe8cd', blob1: '#ffd56d', blob2: '#5d816a' };
  }
}

const DEFAULT_X = [-1.2, 0.9, -0.6, 1.3, -1.1, 0.7, -1.4, 1.0];

// ─── Hook: motor Three.js ─────────────────────────────────────────────────────
// Encapsulado para poder reiniciar solo los planos/paletas al cambiar prestador
// sin destruir el renderer ni la cámara.

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ScreensaverGallery({
  prestadores,
  height = '100vh',
  autoAdvanceSeconds = 60,
  onPrestadorChange,
}: ScreensaverGalleryProps) {

  const mountRef       = useRef<HTMLDivElement>(null);
  const iframeRef      = useRef<HTMLIFrameElement>(null);

  // Estado UI
  const [activeIdx,     setActiveIdx]     = useState(0);
  const [isReady,       setIsReady]       = useState(false);
  const [prestadorIdx,  setPrestadorIdx]  = useState(0);
  const [showVideo,     setShowVideo]     = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  // Refs para comunicar con el loop sin recrear efectos
  const prestadorIdxRef = useRef(0);
  const showVideoRef    = useRef(false);
  const videoBlendRef   = useRef(0); // 0–1 lerpeado en el loop

  // ─── Three.js refs (persisten entre cambios de prestador) ──────────────────
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null);
  const bgUniformsRef= useRef<Record<string, { value: unknown }> | null>(null);
  const planesRef    = useRef<THREE.Mesh[]>([]);
  const palettesRef  = useRef<Array<{ background: string; blob1: string; blob2: string }>>([]);
  const sceneRef     = useRef<THREE.Scene | null>(null);
  const cameraRef    = useRef<THREE.PerspectiveCamera | null>(null);
  const scrollRef    = useRef({ target: 0, current: 0, min: 0, max: 0 });
  const motionRef    = useRef({
    velocity: 0, prevScroll: 0,
    pointerX: 0, pointerY: 0,
    driftTarget: 0, driftCurrent: 0,
  });
  const frameIdRef    = useRef(0);
  const activeIdxRef  = useRef(0);
  const clockRef      = useRef(new THREE.Clock());

  // ─── Auto-advance timer ────────────────────────────────────────────────────
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetAutoTimer = useCallback(() => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    autoTimerRef.current = setTimeout(() => {
      goToNext();
    }, autoAdvanceSeconds * 1000);
  }, [autoAdvanceSeconds]);

  // ─── Cambio de prestador ───────────────────────────────────────────────────

  const loadPrestador = useCallback((idx: number) => {
    if (!sceneRef.current) return;
    const prestador = prestadores[idx];
    if (!prestador) return;

    setTransitioning(true);
    setIsReady(false);
    setShowVideo(false);
    showVideoRef.current = false;
    setActiveIdx(0);
    activeIdxRef.current = 0;

    // Reset scroll al inicio
    scrollRef.current.target  = 0;
    scrollRef.current.current = 0;

    // Limpiar planos anteriores
    planesRef.current.forEach(p => {
      sceneRef.current!.remove(p);
      (p as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>).geometry.dispose();
      (p as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>).material.dispose();
    });
    planesRef.current = [];
    palettesRef.current = [];

    const items     = prestador.imagenes;
    const PLANE_H   = 1.8;
    const PLANE_GAP = 2.5;

    // Inicializar paletas
    palettesRef.current = items.map(
      it => it.mood ?? { background: '#fbe8cd', blob1: '#ffd56d', blob2: '#5d816a' }
    );

    // Scroll max = llegar hasta justo después del último plano
    // + un "extra" para hacer scroll al modo video
    const VIDEO_EXTRA    = 0.55; // factor extra de scroll después del último plano
    const SCROLL_TO_WORLD= 0.003;
    const CAM_Z_START    = 2.5;
    const scrollFromZ    = (z: number) => (CAM_Z_START - z) / SCROLL_TO_WORLD;
    const lastZ          = -(items.length - 1) * PLANE_GAP;
    const scrollMax      = scrollFromZ(lastZ - 0.4) + (scrollFromZ(lastZ - 0.4) * VIDEO_EXTRA) / (items.length);

    // En realidad queremos: llegar al último plano + algo extra para el video
    // Calculamos un "video threshold" en unidades de scroll
    const scrollAtLastPlane = scrollFromZ(lastZ - 0.4);
    const VIDEO_SCROLL_EXTRA = 300; // px de scroll extra después del último plano

    scrollRef.current.min = 0;
    scrollRef.current.max = Math.max(0, scrollAtLastPlane + VIDEO_SCROLL_EXTRA);

    const loader = new THREE.TextureLoader();
    let loaded = 0;

    for (let i = 0; i < items.length; i++) {
      const item  = items[i];
      const baseX = item.positionX ?? DEFAULT_X[i % DEFAULT_X.length];

      const mat = new THREE.ShaderMaterial({
        vertexShader: PLANE_VERT, fragmentShader: PLANE_FRAG,
        uniforms: {
          uTexture:  { value: new THREE.Texture() },
          uVelocity: { value: 0 },
          uOpacity:  { value: 0 },
          uTime:     { value: 0 },
        },
        transparent: true,
      });

      const geo  = new THREE.PlaneGeometry(PLANE_H * 0.75, PLANE_H, 24, 24);
      const mesh = new THREE.Mesh(geo, mat);
      (mesh as any).userData = { index: i, item, baseX };
      mesh.position.set(baseX, 0, -i * PLANE_GAP);
      sceneRef.current!.add(mesh);
      planesRef.current.push(mesh);

      const capturedIdx = i;
      loader.load(item.src, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const iw = (tex.image as HTMLImageElement).naturalWidth  || tex.image.width  || 1;
        const ih = (tex.image as HTMLImageElement).naturalHeight || tex.image.height || 1;
        const aspect = iw / ih;
        const h = PLANE_H, w = h * aspect;
        (mesh as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>).geometry.dispose();
        (mesh as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>).geometry =
          new THREE.PlaneGeometry(w, h, 24, 24);
        mat.uniforms.uTexture.value = tex;
        mat.uniforms.uOpacity.value = 0.001;
        if (!item.mood) palettesRef.current[capturedIdx] = extractPalette(tex.image as HTMLImageElement);
        loaded++;
        if (loaded === 1) { setIsReady(true); setTransitioning(false); }
      }, undefined, () => {
        mat.uniforms.uOpacity.value = 0.001;
        loaded++;
        if (loaded === 1) { setIsReady(true); setTransitioning(false); }
      });
    }

    // Si no hay imágenes, igual marcar como listo
    if (items.length === 0) { setIsReady(true); setTransitioning(false); }

    resetAutoTimer();
  }, [prestadores, resetAutoTimer]);

  const goToNext = useCallback(() => {
    const next = (prestadorIdxRef.current + 1) % prestadores.length;
    prestadorIdxRef.current = next;
    setPrestadorIdx(next);
    onPrestadorChange?.(prestadores[next], next);
    loadPrestador(next);
  }, [prestadores, loadPrestador, onPrestadorChange]);

  const goToPrev = useCallback(() => {
    const prev = (prestadorIdxRef.current - 1 + prestadores.length) % prestadores.length;
    prestadorIdxRef.current = prev;
    setPrestadorIdx(prev);
    onPrestadorChange?.(prestadores[prev], prev);
    loadPrestador(prev);
  }, [prestadores, loadPrestador, onPrestadorChange]);

  // ─── Inicialización Three.js (una sola vez) ────────────────────────────────

  useEffect(() => {
    if (!mountRef.current || prestadores.length === 0) return;
    const el = mountRef.current;

    const PLANE_H        = 1.8;
    const PLANE_GAP      = 2.5;
    const CAM_Z_START    = 2.5;
    const SCROLL_TO_WORLD= 0.003;
    const SCROLL_SMOOTH  = 0.07;
    const VEL_DAMPING    = 0.12;
    const VEL_MAX        = 0.012;
    const VEL_THRESHOLD  = 0.00008;
    const PARALLAX       = 0.12;
    const DRIFT_AMT      = 0.15;
    const DRIFT_SMOOTH   = 0.06;
    const BREATH_TILT    = 0.06;
    const BREATH_SCALE   = 0.03;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.autoClear = false;
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Escenas
    const bgScene   = new THREE.Scene();
    const mainScene = new THREE.Scene();
    sceneRef.current = mainScene;

    const camera = new THREE.PerspectiveCamera(55, el.clientWidth / el.clientHeight, 0.01, 200);
    camera.position.z = CAM_Z_START;
    cameraRef.current = camera;

    const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Fondo
    const bgUniforms = {
      uBgColor:           { value: new THREE.Color('#fbe8cd') },
      uBlob1Color:        { value: new THREE.Color('#ffd56d') },
      uBlob2Color:        { value: new THREE.Color('#5d816a') },
      uTime:              { value: 0 },
      uVelocityIntensity: { value: 0 },
      uVideoBlend:        { value: 0 },
    };
    bgUniformsRef.current = bgUniforms as any;
    const bgMat = new THREE.ShaderMaterial({
      vertexShader: BG_VERT, fragmentShader: BG_FRAG,
      uniforms: bgUniforms, depthTest: false, depthWrite: false,
    });
    bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat));

    // Colores del fondo interpolados
    const curBg    = new THREE.Color('#fbe8cd');
    const curBlob1 = new THREE.Color('#ffd56d');
    const curBlob2 = new THREE.Color('#5d816a');

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2(-99, -99);

    // Eventos de scroll/mouse
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = scrollRef.current;
      s.target += e.deltaY;
      s.target  = clamp(s.target, s.min, s.max);
      motionRef.current.driftTarget = clamp(-e.deltaY / 80, -1, 1);
    };

    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0].clientY; };
    const onTouchMove  = (e: TouchEvent) => {
      const dy = touchY - e.touches[0].clientY;
      touchY = e.touches[0].clientY;
      const s = scrollRef.current;
      s.target += dy * 2.5;
      s.target  = clamp(s.target, s.min, s.max);
      motionRef.current.driftTarget = clamp(-dy / 40, -1, 1);
    };

    const onMouseMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const m = motionRef.current;
      m.pointerX = ((e.clientX - r.left) / r.width) * 2 - 1;
      m.pointerY = ((e.clientY - r.top)  / r.height) * 2 - 1;
      m.pointerY = -m.pointerY;
      mouse.x = m.pointerX;
      mouse.y = m.pointerY;
    };

    const onClick = () => {
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(planesRef.current);
      // Solo interacción visual, sin callback de item en este componente
    };

    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    // ─── VIDEO SCROLL THRESHOLD ─────────────────────────────────────────────
    // "Zona video" = cuando scrollCurrent supera el 85% del scrollMax
    const VIDEO_ZONE_RATIO = 0.85;

    // ─── Loop ───────────────────────────────────────────────────────────────
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);
      const t  = clockRef.current.getElapsedTime();
      const s  = scrollRef.current;
      const mo = motionRef.current;

      // Scroll suavizado
      s.current = lerp(s.current, s.target, SCROLL_SMOOTH);
      s.current = clamp(s.current, s.min, s.max);
      s.target  = clamp(s.target,  s.min, s.max);

      // Velocidad
      const rawVel = s.current - mo.prevScroll;
      mo.velocity  = lerp(mo.velocity, rawVel, VEL_DAMPING);
      mo.velocity  = clamp(mo.velocity, -VEL_MAX, VEL_MAX);
      if (Math.abs(mo.velocity) < VEL_THRESHOLD) mo.velocity = 0;
      mo.prevScroll = s.current;
      const velNorm = Math.abs(mo.velocity) / VEL_MAX;

      // Drift
      mo.driftTarget  = lerp(mo.driftTarget, 0, 0.09);
      mo.driftCurrent = lerp(mo.driftCurrent, mo.driftTarget, DRIFT_SMOOTH);

      // Cámara
      camera.position.z = CAM_Z_START - s.current * SCROLL_TO_WORLD;

      // Detectar si estamos en "zona video"
      const videoZoneThreshold = s.max * VIDEO_ZONE_RATIO;
      const inVideoZone = s.max > 0 && s.current >= videoZoneThreshold;

      if (inVideoZone !== showVideoRef.current) {
        showVideoRef.current = inVideoZone;
        setShowVideo(inVideoZone);
      }

      // Lerp del blend video → oscurece el fondo
      const targetBlend = inVideoZone
        ? clamp((s.current - videoZoneThreshold) / (s.max - videoZoneThreshold), 0, 1)
        : 0;
      videoBlendRef.current = lerp(videoBlendRef.current, targetBlend, 0.05);
      (bgUniforms as any).uVideoBlend.value = videoBlendRef.current;

      // Plano activo (solo entre los planos reales, no la "zona video")
      const camZ    = camera.position.z;
      const planes  = planesRef.current;
      let closest   = 0, closestDist = Infinity;
      planes.forEach((p, i) => {
        const d = Math.abs(p.position.z - camZ);
        if (d < closestDist) { closestDist = d; closest = i; }
      });
      if (closest !== activeIdxRef.current && !inVideoZone) {
        activeIdxRef.current = closest;
        setActiveIdx(closest);
      }

      // Blend fondo
      if (palettesRef.current.length > 0) {
        const idxA = closest;
        const idxB = Math.min(closest + 1, palettesRef.current.length - 1);
        const zA   = -idxA * PLANE_GAP;
        const zB   = -idxB * PLANE_GAP;
        const blend = zA !== zB ? clamp((zA - camZ) / (zA - zB), 0, 1) : 0;
        const palA  = palettesRef.current[idxA];
        const palB  = palettesRef.current[idxB];
        if (palA && palB) {
          curBg.copy(new THREE.Color(palA.background)).lerp(new THREE.Color(palB.background), blend);
          curBlob1.copy(new THREE.Color(palA.blob1)).lerp(new THREE.Color(palB.blob1), blend);
          curBlob2.copy(new THREE.Color(palA.blob2)).lerp(new THREE.Color(palB.blob2), blend);
        }
      }

      bgUniforms.uBgColor.value.lerp(curBg, 0.06);
      bgUniforms.uBlob1Color.value.lerp(curBlob1, 0.06);
      bgUniforms.uBlob2Color.value.lerp(curBlob2, 0.06);
      bgUniforms.uTime.value = t;
      bgUniforms.uVelocityIntensity.value = velNorm;

      // Hover
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(planes);
      el.style.cursor = hits.length > 0 ? 'pointer' : 'default';

      // Micro-motion por plano
      planes.forEach((p) => {
        const mat  = (p as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>).material;
        const dist = Math.abs(p.position.z - camZ);
        const targetOp = Math.max(0, 1.0 - dist / (PLANE_GAP * 1.8));
        mat.uniforms.uOpacity.value  = lerp(mat.uniforms.uOpacity.value, targetOp, 0.06);
        mat.uniforms.uVelocity.value = mo.velocity * 50;
        mat.uniforms.uTime.value     = t;

        const parallaxInfluence = 1 + dist * 0.12;
        const baseX = (p as any).userData.baseX as number;
        const targetX = baseX + mo.pointerX * PARALLAX * parallaxInfluence;
        const targetY = mo.pointerY * PARALLAX * parallaxInfluence + mo.driftCurrent * DRIFT_AMT;
        p.position.x = lerp(p.position.x, targetX, 0.055);
        p.position.y = lerp(p.position.y, targetY, 0.055);

        p.rotation.x = lerp(p.rotation.x, mo.pointerY * BREATH_TILT * velNorm, 0.07);
        const sc = lerp(p.scale.x, 1 + BREATH_SCALE * velNorm, 0.07);
        p.scale.setScalar(sc);
      });

      renderer.clear();
      renderer.render(bgScene,   bgCam);
      renderer.render(mainScene, camera);
    };

    animate();

    el.addEventListener('wheel',      onWheel,      { passive: false });
    el.addEventListener('mousemove',  onMouseMove);
    el.addEventListener('click',      onClick);
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove',  onTouchMove,  { passive: true });
    window.addEventListener('resize', onResize);

    // Cargar primer prestador
    setTimeout(() => loadPrestador(0), 0);

    return () => {
      cancelAnimationFrame(frameIdRef.current);
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
      el.removeEventListener('wheel',      onWheel);
      el.removeEventListener('mousemove',  onMouseMove);
      el.removeEventListener('click',      onClick);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      window.removeEventListener('resize', onResize);
      planesRef.current.forEach(p => {
        (p as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>).geometry.dispose();
        (p as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>).material.dispose();
      });
      bgMat.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── UI Data ──────────────────────────────────────────────────────────────

  const prestador = prestadores[prestadorIdx];
  const items     = prestador?.imagenes ?? [];
  const item      = items[activeIdx];
  const mood      = item?.mood;
  const bgHex     = mood?.background ?? '#fbe8cd';
  const hex       = bgHex.replace('#', '');
  const rr        = parseInt(hex.slice(0, 2), 16);
  const gg        = parseInt(hex.slice(2, 4), 16);
  const bb        = parseInt(hex.slice(4, 6), 16);

  const youtubeId = prestador?.videoReel ? getYouTubeId(prestador.videoReel) : null;
  const iframeUrl = youtubeId
    ? `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1`
    : null;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        overflow: 'hidden',
        background: '#0a0a0a',
        userSelect: 'none',
      }}
    >
      {/* ── Canvas Three.js ── */}
      <div ref={mountRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />

      {/* ── VIDEO DE FONDO (YouTube embed, efecto cine cóncavo) ── */}
      {iframeUrl && (
        <div
          style={{
            position: 'absolute', inset: 0,
            zIndex: 1,
            // Perspectiva cóncava: la pantalla del cine se curva hacia adentro
            perspective: '800px',
            perspectiveOrigin: '50% 50%',
            opacity: showVideo ? 1 : 0,
            transition: 'opacity 0.8s cubic-bezier(0.4,0,0.2,1)',
            pointerEvents: showVideo ? 'auto' : 'none',
          }}
        >
          {/* Contenedor del video con efecto concave */}
          <div
            style={{
              position: 'absolute',
              // Exceder el contenedor para efecto "más grande que la pantalla" (cine)
              top: '-8%', left: '-8%',
              width: '116%', height: '116%',
              transform: 'rotateX(4deg) scale(1.05)',
              transformStyle: 'preserve-3d',
            }}
          >
            <iframe
              ref={iframeRef}
              src={showVideo ? iframeUrl : ''}
              style={{
                width: '100%', height: '100%',
                border: 'none',
                display: 'block',
              }}
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </div>

          {/* ── Filtro CRT / TV scanlines ── */}
          <div
            style={{
              position: 'absolute', inset: 0,
              zIndex: 2,
              pointerEvents: 'none',
              backgroundImage: `
                repeating-linear-gradient(
                  0deg,
                  transparent,
                  transparent 2px,
                  rgba(0,0,0,0.18) 2px,
                  rgba(0,0,0,0.18) 4px
                )
              `,
            }}
          />

          {/* Vignette de cine (bordes muy oscuros) */}
          <div
            style={{
              position: 'absolute', inset: 0,
              zIndex: 3,
              pointerEvents: 'none',
              background: `
                radial-gradient(
                  ellipse 85% 80% at 50% 50%,
                  transparent 50%,
                  rgba(0,0,0,0.55) 80%,
                  rgba(0,0,0,0.85) 100%
                )
              `,
            }}
          />

          {/* Aberración cromática CRT en las esquinas */}
          <div
            style={{
              position: 'absolute', inset: 0,
              zIndex: 3,
              pointerEvents: 'none',
              background: `
                radial-gradient(
                  ellipse 100% 100% at 50% 50%,
                  transparent 60%,
                  rgba(0, 20, 40, 0.3) 100%
                )
              `,
            }}
          />

          {/* Ruido de película (pseudo noise con CSS) */}
          <div
            style={{
              position: 'absolute', inset: 0,
              zIndex: 3,
              pointerEvents: 'none',
              opacity: 0.04,
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundSize: '200px 200px',
              animation: 'crtNoise 0.1s steps(1) infinite',
            }}
          />

          {/* Label "REEL" en video */}
          <div
            style={{
              position: 'absolute', bottom: '2rem', left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              fontFamily: '"Courier New", Courier, monospace',
              fontSize: '0.6rem', letterSpacing: '0.35em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.35)',
              pointerEvents: 'none',
              animation: 'dgFadeIn 1s ease both',
            }}
          >
            {prestador?.nombre} · reel
          </div>

          {/* Hint scroll atrás */}
          <div
            style={{
              position: 'absolute', top: '1.5rem', left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              fontFamily: '"Courier New", Courier, monospace',
              fontSize: '0.58rem', letterSpacing: '0.22em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.25)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
              pointerEvents: 'none',
              animation: 'dgFadeIn 1s ease both',
            }}
          >
            ↑ volver
          </div>
        </div>
      )}

      {/* ── Overlay de carga / transición ── */}
      {(!isReady || transitioning) && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: transitioning ? 'rgba(0,0,0,0.6)' : 'rgba(251,232,205,0.9)',
            backdropFilter: 'blur(8px)',
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '0.65rem', letterSpacing: '0.3em', textTransform: 'uppercase',
            color: transitioning ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
            transition: 'opacity 0.4s',
            pointerEvents: 'none',
          }}
        >
          {transitioning ? prestador?.nombre ?? 'cargando…' : 'loading…'}
        </div>
      )}

      {/* ── Top-left: nombre del prestador ── */}
      {isReady && !showVideo && (
        <div
          key={`TL-${prestadorIdx}`}
          style={{
            position: 'absolute', top: '1.4rem', left: '1.5rem',
            zIndex: 10, pointerEvents: 'none',
            fontFamily: '"Courier New", Courier, monospace',
            animation: 'dgFadeIn 0.4s ease both',
          }}
        >
          <div style={{
            fontSize: '0.68rem', letterSpacing: '0.16em',
            textTransform: 'uppercase', color: 'rgba(0,0,0,0.55)',
          }}>
            {prestador?.nombre}
          </div>
          {prestador?.categoria && (
            <div style={{
              fontSize: '0.58rem', letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'rgba(0,0,0,0.3)', marginTop: '3px',
            }}>
              {prestador.categoria}
            </div>
          )}
        </div>
      )}

      {/* ── Left-center: número + título + chip ── */}
      {item && isReady && !showVideo && (
        <div
          key={`LC-${prestadorIdx}-${activeIdx}`}
          style={{
            position: 'absolute', left: '1.5rem', top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10, pointerEvents: 'none',
            fontFamily: '"Courier New", Courier, monospace',
            animation: 'dgSlideIn 0.3s ease both',
          }}
        >
          <div style={{ fontSize: '0.6rem', color: 'rgba(0,0,0,0.35)', letterSpacing: '0.05em', marginBottom: '5px' }}>
            {String(activeIdx + 1).padStart(2, '0')}
          </div>
          {item.title && (
            <div style={{
              fontSize: '0.72rem', letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'rgba(0,0,0,0.62)', maxWidth: '120px', lineHeight: 1.35,
            }}>
              {item.title}
            </div>
          )}
          {mood?.background && (
            <div style={{
              width: '18px', height: '18px', borderRadius: '50%',
              background: mood.background, marginTop: '10px',
              boxShadow: '0 1px 5px rgba(0,0,0,0.18)',
            }} />
          )}
        </div>
      )}

      {/* ── Right-center: panel HEX/RGB ── */}
      {mood?.background && isReady && !showVideo && (
        <div
          key={`RC-${prestadorIdx}-${activeIdx}`}
          style={{
            position: 'absolute', right: '1.5rem', top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10, pointerEvents: 'none',
            fontFamily: '"Courier New", Courier, monospace',
            animation: 'dgSlideIn 0.3s ease both',
          }}
        >
          <table style={{ borderCollapse: 'collapse', fontSize: '0.6rem', letterSpacing: '0.05em', lineHeight: 2 }}>
            <tbody>
              <tr>
                <td style={{ color: 'rgba(0,0,0,0.28)', paddingRight: '1rem' }}>RGB</td>
                <td style={{ color: 'rgba(0,0,0,0.55)' }}>{rr}, {gg}, {bb}</td>
              </tr>
              <tr>
                <td style={{ color: 'rgba(0,0,0,0.28)' }}>HEX</td>
                <td style={{ color: 'rgba(0,0,0,0.55)' }}>{bgHex.toUpperCase()}</td>
              </tr>
              {item.colorLabel && (
                <tr>
                  <td style={{ color: 'rgba(0,0,0,0.28)' }}>REF</td>
                  <td style={{ color: 'rgba(0,0,0,0.55)' }}>{item.colorLabel}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Bottom-left: descripción ── */}
      {item?.description && isReady && !showVideo && (
        <div
          key={`BL-${prestadorIdx}-${activeIdx}`}
          style={{
            position: 'absolute', bottom: '1.75rem', left: '1.5rem',
            zIndex: 10, pointerEvents: 'none',
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '0.6rem', color: 'rgba(0,0,0,0.38)',
            letterSpacing: '0.07em', maxWidth: '280px', lineHeight: 1.6,
            animation: 'dgSlideIn 0.3s ease both',
          }}
        >
          {item.description}
        </div>
      )}

      {/* ── Bottom-center: hint scroll ── */}
      {isReady && items.length > 1 && activeIdx === 0 && !showVideo && (
        <div style={{
          position: 'absolute', bottom: '1.75rem', left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10, pointerEvents: 'none',
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: '0.58rem', letterSpacing: '0.22em', textTransform: 'uppercase',
          color: 'rgba(0,0,0,0.28)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
        }}>
          <span style={{ animation: 'dgBounce 1.8s ease-in-out infinite' }}>↓</span>
          scroll
        </div>
      )}

      {/* ── Bottom-right: progreso imágenes ── */}
      {items.length > 1 && isReady && !showVideo && (
        <div style={{
          position: 'absolute', bottom: '1.75rem', right: '1.5rem',
          zIndex: 10, pointerEvents: 'none',
          display: 'flex', gap: '4px', alignItems: 'center',
        }}>
          {items.map((_, i) => (
            <div key={i} style={{
              height: '1.5px',
              width: i === activeIdx ? '20px' : '7px',
              background: i <= activeIdx ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.15)',
              borderRadius: '2px',
              transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
            }} />
          ))}
        </div>
      )}

      {/* ── FLECHAS DE NAVEGACIÓN entre prestadores ── */}
      {prestadores.length > 1 && (
        <>
          {/* Flecha izquierda */}
          <button
            onClick={goToPrev}
            aria-label="Prestador anterior"
            style={{
              position: 'absolute', left: 0, top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 15,
              width: '48px', height: '120px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0,
            }}
          >
            <div
              style={{
                width: '36px', height: '36px',
                borderRadius: '50%',
                background: showVideo ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
                color: showVideo ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)',
                fontSize: '14px',
              }}
              className="nav-arrow"
            >
              ←
            </div>
          </button>

          {/* Flecha derecha */}
          <button
            onClick={goToNext}
            aria-label="Siguiente prestador"
            style={{
              position: 'absolute', right: 0, top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 15,
              width: '48px', height: '120px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0,
            }}
          >
            <div
              style={{
                width: '36px', height: '36px',
                borderRadius: '50%',
                background: showVideo ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
                color: showVideo ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)',
                fontSize: '14px',
              }}
            >
              →
            </div>
          </button>
        </>
      )}

      {/* ── Dots de prestadores (bottom center, sobre el video también) ── */}
      {prestadores.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: showVideo ? '3rem' : '1.75rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 15,
            display: 'flex', gap: '6px', alignItems: 'center',
            transition: 'bottom 0.4s ease',
            // Solo mostrar dots cuando no hay hint de scroll
            opacity: activeIdx > 0 || showVideo ? 1 : 0,
            pointerEvents: 'none',
          }}
        >
          {prestadores.map((_, i) => (
            <div key={i} style={{
              width: i === prestadorIdx ? '20px' : '5px',
              height: '5px',
              borderRadius: '3px',
              background: showVideo
                ? (i === prestadorIdx ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)')
                : (i === prestadorIdx ? 'rgba(0,0,0,0.6)'       : 'rgba(0,0,0,0.15)'),
              transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
            }} />
          ))}
        </div>
      )}

      {/* ── Auto-advance countdown bar ── */}
      {isReady && !transitioning && (
        <div
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: '2px', zIndex: 15, pointerEvents: 'none',
          }}
        >
          <div
            key={`bar-${prestadorIdx}`}
            style={{
              height: '100%',
              background: showVideo ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.2)',
              animation: `dgAutoBar ${autoAdvanceSeconds}s linear forwards`,
              transformOrigin: 'left center',
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes dgSlideIn {
          from { opacity: 0; transform: translateY(8px) translateY(-50%); }
          to   { opacity: 1; transform: translateY(0px) translateY(-50%); }
        }
        @keyframes dgFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes dgBounce {
          0%, 100% { transform: translateY(0px);  opacity: 0.7; }
          50%       { transform: translateY(4px); opacity: 0.25; }
        }
        @keyframes dgAutoBar {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
        @keyframes crtNoise {
          0%   { background-position: 0 0; }
          10%  { background-position: -5% -10%; }
          20%  { background-position: -15% 5%; }
          30%  { background-position: 7% -25%; }
          40%  { background-position: 20% 25%; }
          50%  { background-position: -25% 10%; }
          60%  { background-position: 15% 5%; }
          70%  { background-position: 0% 15%; }
          80%  { background-position: 25% 35%; }
          90%  { background-position: -10% 10%; }
          100% { background-position: 0 0; }
        }
        .nav-arrow:hover {
          background: rgba(0,0,0,0.15) !important;
          transform: scale(1.1);
        }
      `}</style>
    </div>
  );
}