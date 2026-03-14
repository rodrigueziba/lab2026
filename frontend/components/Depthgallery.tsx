'use client';

/**
 * DepthGallery.tsx — v4
 * Fixes:
 *  - Imágenes correctamente dimensionadas (no gigantes)
 *  - Sin flash/reinicio (useRef para items, no useEffect con [items])
 *  - Cámara a distancia correcta de los planos
 *  - Planos invisibles hasta que carga la textura (no aparecen grises)
 */

import { useEffect, useRef, useState } from 'react';
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

export interface DepthGalleryProps {
  items: GalleryItem[];
  title?: string;
  subtitle?: string;
  height?: string;
  onItemClick?: (item: GalleryItem, index: number) => void;
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

    // velocity lifts brightness
    color += uVelocityIntensity * 0.08;

    // film grain
    float grain = random(vUv * 312.0 + uTime * 0.3) - 0.5;
    color += grain * 0.022;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function toHex2(v: number) { return clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'); }

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

    let r1 = 0, g1 = 0, b1 = 0, n1 = 0;
    for (let row = 0; row < 16; row++)
      for (let col = 0; col < 16; col++) {
        const i = (row * 32 + col) * 4;
        r1 += d[i]; g1 += d[i+1]; b1 += d[i+2]; n1++;
      }
    const blob1 = `#${toHex2(r1/n1 * 1.1)}${toHex2(g1/n1 * 1.05)}${toHex2(b1/n1)}`;

    let r2 = 0, g2 = 0, b2 = 0, n2 = 0;
    for (let row = 16; row < 32; row++)
      for (let col = 16; col < 32; col++) {
        const i = (row * 32 + col) * 4;
        r2 += d[i]; g2 += d[i+1]; b2 += d[i+2]; n2++;
      }
    const blob2 = `#${toHex2(r2/n2)}${toHex2(g2/n2 * 1.05)}${toHex2(b2/n2 * 1.1)}`;

    return { background: bg, blob1, blob2 };
  } catch {
    return { background: '#fbe8cd', blob1: '#ffd56d', blob2: '#5d816a' };
  }
}

const DEFAULT_X = [-1.2, 0.9, -0.6, 1.3, -1.1, 0.7, -1.4, 1.0];

// ─── Componente ───────────────────────────────────────────────────────────────

export default function DepthGallery({
  items,
  title,
  subtitle,
  height = '100vh',
  onItemClick,
}: DepthGalleryProps) {
  const mountRef  = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isReady,   setIsReady]   = useState(false);

  // Guardamos items en ref para que el useEffect no se re-ejecute si el padre
  // recrea el array en cada render (causa del flash/reinicio)
  const itemsRef       = useRef(items);
  const onItemClickRef = useRef(onItemClick);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { onItemClickRef.current = onItemClick; }, [onItemClick]);

  useEffect(() => {
    const items = itemsRef.current;
    if (!mountRef.current || items.length === 0) return;
    const el = mountRef.current;

    // ─── Constantes de la escena ──────────────────────────────────────────────
    //
    // La cámara usa FOV=55°. Para que un plano de altura H se vea completo
    // a una distancia D, necesitamos:
    //   H/2 = D * tan(FOV/2)  →  D = (H/2) / tan(27.5°) ≈ H * 1.04
    //
    // Usamos planos de altura 1.8 → distancia visual ≈ 1.9 unidades.
    // Ponemos la cámara a Z = 0 + 2.5 = 2.5 del primer plano (un poco de aire).
    //
    const PLANE_H        = 1.8;   // altura del plano en world units
    const CAM_DISTANCE   = 2.5;   // distancia de la cámara al plano activo
    const PLANE_GAP      = 2.5;   // separación entre planos en Z
    const CAM_Z_START    = CAM_DISTANCE; // plano[0] está en z=0, cámara en z=2.5
    const SCROLL_TO_WORLD= 0.003; // px de wheel → world units
    const SCROLL_SMOOTH  = 0.07;
    const VEL_DAMPING    = 0.12;
    const VEL_MAX        = 0.012;
    const VEL_THRESHOLD  = 0.00008;
    const PARALLAX       = 0.12;
    const DRIFT_AMT      = 0.15;
    const DRIFT_SMOOTH   = 0.06;
    const BREATH_TILT    = 0.06;
    const BREATH_SCALE   = 0.03;

    // ─── Renderer ─────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.autoClear = false;
    el.appendChild(renderer.domElement);

    // ─── Escenas ──────────────────────────────────────────────────────────────
    const bgScene   = new THREE.Scene();
    const mainScene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      55,
      el.clientWidth / el.clientHeight,
      0.01,
      200
    );
    camera.position.z = CAM_Z_START;

    const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // ─── Fondo ────────────────────────────────────────────────────────────────
    const bgUniforms = {
      uBgColor:           { value: new THREE.Color('#fbe8cd') },
      uBlob1Color:        { value: new THREE.Color('#ffd56d') },
      uBlob2Color:        { value: new THREE.Color('#5d816a') },
      uTime:              { value: 0 },
      uVelocityIntensity: { value: 0 },
    };
    const bgMat = new THREE.ShaderMaterial({
      vertexShader: BG_VERT, fragmentShader: BG_FRAG,
      uniforms: bgUniforms, depthTest: false, depthWrite: false,
    });
    bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat));

    // ─── Planos ───────────────────────────────────────────────────────────────
    type PlaneMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> & {
      userData: { index: number; item: GalleryItem; baseX: number };
    };

    const planes: PlaneMesh[]  = [];
    const palettes: Array<{ background: string; blob1: string; blob2: string }> = items.map(
      it => it.mood ?? { background: '#fbe8cd', blob1: '#ffd56d', blob2: '#5d816a' }
    );

    // Colores del fondo interpolados en CPU frame a frame
    const curBg    = new THREE.Color('#fbe8cd');
    const curBlob1 = new THREE.Color('#ffd56d');
    const curBlob2 = new THREE.Color('#5d816a');

    const loader = new THREE.TextureLoader();
    let loadedCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item  = items[i];
      const idx   = i;
      const baseX = item.positionX ?? DEFAULT_X[idx % DEFAULT_X.length];

      // Material: opacidad 0 hasta que carga la textura
      const mat = new THREE.ShaderMaterial({
        vertexShader: PLANE_VERT, fragmentShader: PLANE_FRAG,
        uniforms: {
          uTexture:  { value: new THREE.Texture() },
          uVelocity: { value: 0 },
          uOpacity:  { value: 0 },  // ← empieza invisible
          uTime:     { value: 0 },
        },
        transparent: true,
      });

      // Geometría inicial con dimensiones correctas para PLANE_H
      // Aspect ratio 3:4 (portrait) como placeholder hasta que cargue la textura
      const initAspect = 0.75;
      const geo = new THREE.PlaneGeometry(PLANE_H * initAspect, PLANE_H, 24, 24);
      const mesh = new THREE.Mesh(geo, mat) as PlaneMesh;
      mesh.userData = { index: idx, item, baseX };
      mesh.position.set(baseX, 0, -idx * PLANE_GAP);
      mainScene.add(mesh);
      planes.push(mesh);

      loader.load(
        item.src,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;

          // Aspect ratio real de la imagen
          const iw = (tex.image as HTMLImageElement).naturalWidth  || tex.image.width  || 1;
          const ih = (tex.image as HTMLImageElement).naturalHeight || tex.image.height || 1;
          const aspect = iw / ih;
          const h = PLANE_H;
          const w = h * aspect;

          mesh.geometry.dispose();
          mesh.geometry = new THREE.PlaneGeometry(w, h, 24, 24);
          mat.uniforms.uTexture.value = tex;
          // Fade-in suave: el loop lerp este valor hacia el target
          mat.uniforms.uOpacity.value = 0.001;

          if (!item.mood) {
            palettes[idx] = extractPalette(tex.image as HTMLImageElement);
          }

          loadedCount++;
          if (loadedCount === 1) setIsReady(true);
        },
        undefined,
        () => {
          // Error de carga: mostrar plano gris muy transparente
          mat.uniforms.uOpacity.value = 0.001;
          loadedCount++;
          if (loadedCount === 1) setIsReady(true);
        }
      );
    }

    // ─── Scroll ───────────────────────────────────────────────────────────────
    let scrollTarget  = 0;
    let scrollCurrent = 0;
    let velocity      = 0;
    let prevScroll    = 0;

    // scrollFromCameraZ: devuelve el valor de scrollCurrent para una Z de cámara dada
    // camera.z = CAM_Z_START - scrollCurrent * SCROLL_TO_WORLD
    // → scrollCurrent = (CAM_Z_START - camZ) / SCROLL_TO_WORLD
    const FIRST_OFFSET =  0.4; // no entrar al primer plano
    const LAST_OFFSET  = -0.4; // no pasar del último
    const scrollFromZ  = (z: number) => (CAM_Z_START - z) / SCROLL_TO_WORLD;

    const minScroll = scrollFromZ(FIRST_OFFSET);                          // ~  -133  → en práctica 0 porque clampeamos
    const maxScroll = scrollFromZ(-(items.length - 1) * PLANE_GAP + LAST_OFFSET);

    // Clampear: mínimo real es 0 (no queremos ir "detrás" del primer plano)
    const scrollMin = 0;
    const scrollMax = Math.max(0, maxScroll);

    // ─── Pointer / drift ──────────────────────────────────────────────────────
    let pointerX = 0, pointerY = 0;
    let driftTarget = 0, driftCurrent = 0;
    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2(-99, -99);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      scrollTarget += e.deltaY;
      scrollTarget  = clamp(scrollTarget, scrollMin, scrollMax);
      driftTarget   = clamp(-e.deltaY / 80, -1, 1);
    };

    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0].clientY; };
    const onTouchMove  = (e: TouchEvent) => {
      const dy = touchY - e.touches[0].clientY;
      touchY = e.touches[0].clientY;
      scrollTarget += dy * 2.5;
      scrollTarget  = clamp(scrollTarget, scrollMin, scrollMax);
      driftTarget   = clamp(-dy / 40, -1, 1);
    };

    const onMouseMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      pointerX = ((e.clientX - r.left) / r.width)  * 2 - 1;
      pointerY = (((e.clientY - r.top) / r.height) * 2 - 1) * -1;
      mouse.x  = pointerX;
      mouse.y  = pointerY;
    };

    const onClick = () => {
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(planes);
      if (hits.length > 0) {
        const m = hits[0].object as PlaneMesh;
        onItemClickRef.current?.(m.userData.item, m.userData.index);
      }
    };

    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    // ─── Loop ─────────────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let frameId = 0;
    let currentActiveIdx = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Scroll suavizado + clamp en ambos lados (evita overshoot del lerp)
      scrollCurrent = lerp(scrollCurrent, scrollTarget, SCROLL_SMOOTH);
      scrollCurrent = clamp(scrollCurrent, scrollMin, scrollMax);
      scrollTarget  = clamp(scrollTarget,  scrollMin, scrollMax);

      // Velocidad
      const rawVel = scrollCurrent - prevScroll;
      velocity = lerp(velocity, rawVel, VEL_DAMPING);
      velocity = clamp(velocity, -VEL_MAX, VEL_MAX);
      if (Math.abs(velocity) < VEL_THRESHOLD) velocity = 0;
      prevScroll = scrollCurrent;
      const velNorm = Math.abs(velocity) / VEL_MAX;

      // Drift decae
      driftTarget  = lerp(driftTarget,  0, 0.09);
      driftCurrent = lerp(driftCurrent, driftTarget, DRIFT_SMOOTH);

      // Mover cámara — fórmula del artículo
      camera.position.z = CAM_Z_START - scrollCurrent * SCROLL_TO_WORLD;

      // Plano activo
      const camZ = camera.position.z;
      let closest = 0, closestDist = Infinity;
      planes.forEach((p, i) => {
        const d = Math.abs(p.position.z - camZ);
        if (d < closestDist) { closestDist = d; closest = i; }
      });
      if (closest !== currentActiveIdx) {
        currentActiveIdx = closest;
        setActiveIdx(closest);
      }

      // Blend de fondo entre plano actual y el siguiente
      const idxA = closest;
      const idxB = Math.min(closest + 1, items.length - 1);
      const zA   = -idxA * PLANE_GAP;
      const zB   = -idxB * PLANE_GAP;
      const blend = zA !== zB
        ? clamp((zA - camZ) / (zA - zB), 0, 1)
        : 0;

      const palA = palettes[idxA];
      const palB = palettes[idxB];
      curBg.copy(new THREE.Color(palA.background)).lerp(new THREE.Color(palB.background), blend);
      curBlob1.copy(new THREE.Color(palA.blob1)).lerp(new THREE.Color(palB.blob1), blend);
      curBlob2.copy(new THREE.Color(palA.blob2)).lerp(new THREE.Color(palB.blob2), blend);

      // Suavizar la transición del fondo frame a frame (evita saltos bruscos)
      bgUniforms.uBgColor.value.lerp(curBg, 0.06);
      bgUniforms.uBlob1Color.value.lerp(curBlob1, 0.06);
      bgUniforms.uBlob2Color.value.lerp(curBlob2, 0.06);
      bgUniforms.uTime.value = t;
      bgUniforms.uVelocityIntensity.value = velNorm;

      // Hover
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(planes);
      el.style.cursor = hits.length > 0 ? 'pointer' : 'default';

      // Uniforms y micro-motion por plano
      planes.forEach((p) => {
        const dist    = Math.abs(p.position.z - camZ);

        // Opacidad: plano activo = 1.0, se apaga a partir de 1 gap de distancia
        const targetOp = Math.max(0, 1.0 - dist / (PLANE_GAP * 1.8));
        p.material.uniforms.uOpacity.value  = lerp(
          p.material.uniforms.uOpacity.value, targetOp, 0.06
        );
        p.material.uniforms.uVelocity.value = velocity * 50;
        p.material.uniforms.uTime.value     = t;

        // Parallax (planos más lejanos se mueven más)
        const parallaxInfluence = 1 + dist * 0.12;
        const targetX = p.userData.baseX + pointerX * PARALLAX * parallaxInfluence;
        const targetY = pointerY * PARALLAX * parallaxInfluence + driftCurrent * DRIFT_AMT;
        p.position.x = lerp(p.position.x, targetX, 0.055);
        p.position.y = lerp(p.position.y, targetY, 0.055);

        // Breath: tilt + scale con velocity
        p.rotation.x  = lerp(p.rotation.x,  pointerY * BREATH_TILT * velNorm, 0.07);
        const sc       = lerp(p.scale.x, 1 + BREATH_SCALE * velNorm, 0.07);
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

    return () => {
      cancelAnimationFrame(frameId);
      el.removeEventListener('wheel',      onWheel);
      el.removeEventListener('mousemove',  onMouseMove);
      el.removeEventListener('click',      onClick);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      window.removeEventListener('resize', onResize);
      planes.forEach(p => { p.geometry.dispose(); p.material.dispose(); });
      bgMat.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  // ← Sin [items] como dependencia: el efecto corre UNA sola vez al montar.
  // Los cambios de items se manejan via itemsRef arriba.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── UI ───────────────────────────────────────────────────────────────────

  const item  = items[activeIdx];
  const mood  = item?.mood;
  const bgHex = mood?.background ?? '#fbe8cd';
  const hex   = bgHex.replace('#', '');
  const rr    = parseInt(hex.slice(0, 2), 16);
  const gg    = parseInt(hex.slice(2, 4), 16);
  const bb    = parseInt(hex.slice(4, 6), 16);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        overflow: 'hidden',
        background: '#fbe8cd',
        userSelect: 'none',
      }}
    >
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* Loading */}
      {!isReady && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: '0.65rem', letterSpacing: '0.3em',
          textTransform: 'uppercase', color: 'rgba(0,0,0,0.3)',
        }}>
          loading…
        </div>
      )}

      {/* Top-left: título entidad */}
      {(title || subtitle) && (
        <div style={{
          position: 'absolute', top: '1.4rem', left: '1.5rem',
          zIndex: 10, pointerEvents: 'none',
          fontFamily: '"Courier New", Courier, monospace',
        }}>
          {title && (
            <div style={{
              fontSize: '0.68rem', letterSpacing: '0.16em',
              textTransform: 'uppercase', color: 'rgba(0,0,0,0.55)',
            }}>
              {title}
            </div>
          )}
          {subtitle && (
            <div style={{
              fontSize: '0.58rem', letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'rgba(0,0,0,0.3)', marginTop: '3px',
            }}>
              {subtitle}
            </div>
          )}
        </div>
      )}

      {/* Left-center: número + nombre + chip */}
      {item && isReady && (
        <div
          key={`L${activeIdx}`}
          style={{
            position: 'absolute', left: '1.5rem', top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10, pointerEvents: 'none',
            fontFamily: '"Courier New", Courier, monospace',
            animation: 'dgIn 0.3s ease both',
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

      {/* Right-center: panel HEX / RGB */}
      {mood?.background && isReady && (
        <div
          key={`R${activeIdx}`}
          style={{
            position: 'absolute', right: '1.5rem', top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10, pointerEvents: 'none',
            fontFamily: '"Courier New", Courier, monospace',
            animation: 'dgIn 0.3s ease both',
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

      {/* Bottom-left: descripción */}
      {item?.description && isReady && (
        <div
          key={`D${activeIdx}`}
          style={{
            position: 'absolute', bottom: '1.75rem', left: '1.5rem',
            zIndex: 10, pointerEvents: 'none',
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '0.6rem', color: 'rgba(0,0,0,0.38)',
            letterSpacing: '0.07em', maxWidth: '280px', lineHeight: 1.6,
            animation: 'dgIn 0.3s ease both',
          }}
        >
          {item.description}
        </div>
      )}

      {/* Bottom-center: hint scroll */}
      {isReady && items.length > 1 && activeIdx === 0 && (
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

      {/* Bottom-right: progreso */}
      {items.length > 1 && isReady && (
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

      <style>{`
        @keyframes dgIn {
          from { opacity: 0; transform: translateY(8px) translateY(-50%); }
          to   { opacity: 1; transform: translateY(0px) translateY(-50%); }
        }
        @keyframes dgBounce {
          0%, 100% { transform: translateY(0px);  opacity: 0.7; }
          50%       { transform: translateY(4px); opacity: 0.25; }
        }
      `}</style>
    </div>
  );
}