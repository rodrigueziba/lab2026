'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import * as THREE from 'three';

// ── Sphere params ────────────────────────────────────────────────────────────
const SPH_REFRACTION        = 0.71;
const SPH_FRACTAL_SPEED     = 1.49;
const SPH_FRACTAL_ITER      = 61;
const SPH_FRACTAL_INTENSITY = 0.56;
const SPH_FRACTAL_SCALE     = 1.47;
const SPHERE_3D_R           = 0.17; 
const CAMERA_Z              = 2.0;
const SPRING_K              = 0.18;
const SPRING_D              = 0.72;

// ── GLSL vertex ─────────────────────────────────────────────────────────────
const SPH_VERT = /* glsl */`
  varying vec3 vNormal; varying vec3 vViewDir; varying vec3 vWorldPos;
  void main(){
    vWorldPos=(modelMatrix*vec4(position,1.0)).xyz;
    vec4 mv=modelViewMatrix*vec4(position,1.0);
    vNormal=normalize(normalMatrix*normal);
    vViewDir=normalize(-mv.xyz);
    gl_Position=projectionMatrix*mv;
  }`;

// ── GLSL fragment ────────────────────────────────────────────────────────────
const SPH_FRAG = /* glsl */`
  uniform sampler2D uBgTex;
  uniform vec2  uRes; uniform float uTime;
  uniform vec3  uTint;
  uniform float uBeat,uRMS,uBass,uMid,uAir,uSub;
  uniform float uRefraction,uFractalSpeed,uFractalIter,uFractalIntensity,uFractalScale,uPalette;
  varying vec3 vNormal,vViewDir,vWorldPos;

  vec2 rot2(vec2 p,float a){float c=cos(a),s=sin(a);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);}
  vec3 pal(float t,vec3 a,vec3 b,vec3 c,vec3 d){return a+b*cos(6.28318*(c*t+d));}
  vec3 applyPal(float t,float p){
    if(p<0.5)return pal(t,vec3(.5,.5,.5),vec3(.5,.5,.5),vec3(1.,1.,1.),vec3(0.,.33,.67));
    if(p<1.5)return pal(t,vec3(0.,.5,0.),vec3(.2,.5,.1),vec3(1.,1.,1.),vec3(0.,.15,.3));
    if(p<2.5)return pal(t,vec3(.5,0.,.5),vec3(.5,.3,.5),vec3(1.,.7,1.),vec3(.8,0.,.5));
    if(p<3.5)return pal(t,vec3(.5,.2,0.),vec3(.5,.3,0.),vec3(1.,.8,.6),vec3(0.,.1,.2));
    return     pal(t,vec3(0.,.4,.5),vec3(.2,.4,.3),vec3(1.,1.,.8),vec3(.5,.6,.7));
  }
  void main(){
    vec3 N=normalize(vNormal),V=normalize(vViewDir);
    float ndv=max(0.,dot(N,V));
    vec2 uv=gl_FragCoord.xy/uRes;
    float IOR=1.3+uBass*0.4;
    vec3 refr=refract(-V,N,1./IOR);
    float rs=uRefraction*(0.28+uBeat*0.14+uRMS*0.08);
    vec2 ro=refr.xy*rs;
    float ca=uRefraction*(0.032+uBeat*.02+uBass*.012);
    vec2 cv=vec2(ca,ca*.5);
    vec3 bg=vec3(texture2D(uBgTex,uv+ro+cv).r,texture2D(uBgTex,uv+ro).g,texture2D(uBgTex,uv+ro-cv).b);
    float spd=uFractalSpeed*(1.+uBeat*.6+uRMS*.25);
    vec2 du=rot2(vNormal.xy,uTime*spd*0.05);
    float per=7.,zA_t=mod(uTime*spd*.22,per),zB_t=mod(uTime*spd*.22+per*.5,per);
    float zA=exp(zA_t*.9),zB=exp(zB_t*.9);
    float wA=smoothstep(0.,.12,zA_t/per)*smoothstep(1.,.88,zA_t/per);
    float wB=smoothstep(0.,.12,zB_t/per)*smoothstep(1.,.88,zB_t/per);
    float ws=wA+wB+.001; wA/=ws; wB/=ws;
    float pA=uTime*spd*.06,pB=uTime*spd*.04+1.57;
    vec2 panA=vec2(cos(pA)*.32,sin(pA*.77)*.24),panB=vec2(cos(pB)*.28,sin(pB*.61)*.20);
    vec2 jc=vec2(-0.7269+sin(uTime*spd*.09)*.22+uBass*.15,0.1889+cos(uTime*spd*.07)*.16+uMid*.10);
    vec2 fcA=du*uFractalScale/zA+panA,fcB=du*uFractalScale/zB+panB;
    int mi=int(uFractalIter);
    vec2 z1=fcA; float tRA=1e5,tLA=1e5,tCA=1e5;
    for(int i=0;i<64;i++){if(i>=mi)break;z1=vec2(z1.x*z1.x-z1.y*z1.y,2.*z1.x*z1.y)+jc;float r=length(z1);tRA=min(tRA,r);tLA=min(tLA,abs(z1.x*z1.y));tCA=min(tCA,abs(r-.5));if(r>4.)break;}
    float pA2=fract(mix(1.-exp(-tRA*3.),1.-exp(-tLA*7.),.5)+uTime*spd*.035+uBeat*.12);
    vec3 fA=applyPal(pA2,uPalette)*((0.5+(1.-exp(-tRA*2.5))*.5+(1.-exp(-tCA*5.))*.4)*(1.+uBeat*.7+uRMS*.5));
    vec2 z2=fcB; float tRB=1e5,tLB=1e5,tCB=1e5;
    for(int i=0;i<64;i++){if(i>=mi)break;z2=vec2(z2.x*z2.x-z2.y*z2.y,2.*z2.x*z2.y)+jc;float r=length(z2);tRB=min(tRB,r);tLB=min(tLB,abs(z2.x*z2.y));tCB=min(tCB,abs(r-.5));if(r>4.)break;}
    float pB2=fract(mix(1.-exp(-tRB*3.),1.-exp(-tLB*7.),.5)+uTime*spd*.035+uBeat*.12+.5);
    vec3 fB=applyPal(pB2,uPalette)*((0.5+(1.-exp(-tRB*2.5))*.5+(1.-exp(-tCB*5.))*.4)*(1.+uBeat*.7+uRMS*.5));
    vec3 fc=fA*wA+fB*wB;
    float fm=smoothstep(0.,.45,ndv)*uFractalIntensity*(0.9+uRMS*.5+uBeat*.4);
    float lf=smoothstep(.25,.85,ndv)*(.35+uRMS*.55);
    bg=mix(bg,bg*(1.+lf*1.3),.65)*(1.-smoothstep(.85,.5,ndv)*.22);
    float fr=pow(1.-ndv,3.),se=pow(1.-ndv,10.);
    vec3 rim=mix(vec3(.6,.9,1.),uTint+.2,sin(vWorldPos.x*9.+uTime*2.)*sin(vWorldPos.y*7.-uTime*1.6)*.5+.5)*(1.+uBeat*1.8+uRMS*.7);
    vec3 L1=normalize(vec3(-.5,.75,.4)),L2=normalize(vec3(.55,-.3,.3));
    float s1=pow(max(0.,dot(reflect(-V,N),L1)),40.)*1.1,s2=pow(max(0.,dot(reflect(-V,N),L2)),90.)*.6;
    vec3 col=mix(bg,fc,fm)+rim*fr*.6+vec3(1.)*se*.95+vec3(1.)*(s1+s2)*(.9+uBeat*.5);
    float al=fm*.85+fr*.65+se*.95+s1*.75+s2*.45;
    gl_FragColor=vec4(col,clamp(al,0.,1.));
  }`;

const BG_VERT = `void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const BG_FRAG = /* glsl */`
  uniform float uTime;
  void main(){
    vec2 uv=gl_FragCoord.xy*.0008;
    float n=sin(uv.x*5.+uTime*.2)*sin(uv.y*3.5-uTime*.15)*.5+.5;
    gl_FragColor=vec4(mix(vec3(.005,.022,.07),vec3(.012,.045,.13),n*.35+length(uv-.5)*.25),1.);
  }`;

// ── COMPONENTE HELPER PARA LETRAS INTERACTIVAS ─────────────────────────────
const TextLetters = ({ text, style }: { text: string, style?: React.CSSProperties }) => (
  <span style={{ display: 'block', ...style }} className="whitespace-nowrap">
    {text.split('').map((char, i) => (
      <span 
        key={i} 
        className="hover-letter inline-block" 
        style={{ position: 'relative' }}
      >
        {char === ' ' ? '\u00A0' : char}
      </span>
    ))}
  </span>
);

// ════════════════════════════════════════════════════════════════════════════
export default function Footer() {
  const { t }  = useLanguage();
  const router   = useRouter();
  const pathname = usePathname();
  const allowSpecialAnim = pathname === '/proyectos';

  const footerRef      = useRef<HTMLElement>(null);
  const mountRef       = useRef<HTMLDivElement>(null);
  const lightForRef    = useRef<HTMLDivElement>(null);

  const [animating, setAnimating] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const [started,   setStarted]   = useState(false);
  const [phase, setPhase] = useState(0);
  const phaseRef = useRef(0);

  const [spotPos, setSpotPos] = useState({ x: 0.38, y: 0.32, pxX: 0, pxY: 0 });
  const spotPosRef = useRef({ x: 0.38, y: 0.32 });
  const aRef   = useRef<HTMLDivElement>(null);
  const attRef = useRef<HTMLDivElement>(null);
  const [beamBounds, setBeamBounds] = useState({ svgLeft: 0, svgWidth: 200, apexFrac: 0.38 });
  const [coneAngles, setConeAngles] = useState({ right: 144, left: 220 });

  const obsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouseRef    = useRef({ x: 0, y: 0 });
  const maxLatRef   = useRef(1.2); 

  useEffect(() => {
    if (!allowSpecialAnim) return;
    if (triggered) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        obsTimerRef.current = setTimeout(() => { setAnimating(true); setTriggered(true); }, 10_000);
      } else {
        if (obsTimerRef.current) { clearTimeout(obsTimerRef.current); obsTimerRef.current = null; }
      }
    }, { threshold: 0.25 });
    if (footerRef.current) obs.observe(footerRef.current);
    return () => {
      obs.disconnect();
      if (obsTimerRef.current) { clearTimeout(obsTimerRef.current); obsTimerRef.current = null; }
    };
  }, [triggered, allowSpecialAnim]);

  useEffect(() => {
    if (allowSpecialAnim) return;
    setAnimating(false);
    setTriggered(false);
    setStarted(false);
    setPhase(0);
    phaseRef.current = 0;
  }, [allowSpecialAnim]);

  useEffect(() => {
    if (!animating) return;
    const set = (p: number) => { setPhase(p); phaseRef.current = p; };
    const ts = [
      setTimeout(() => setStarted(true),  120),
      setTimeout(() => set(1),           2800),
      setTimeout(() => set(2),           7000),
      setTimeout(() => set(3),           8500),
      setTimeout(() => set(4),          10500),
      setTimeout(() => set(5),          11500),
    ];
    return () => ts.forEach(clearTimeout);
  }, [animating]);

  useEffect(() => {
    if (!animating || !footerRef.current) return;
    footerRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [animating]);

  // ── POSICIÓN DINÁMICA DE LA LUZ + BEAM BOUNDS ────────────────────────────
  useEffect(() => {
    const computeBeam = (fr: DOMRect, pxX: number, pxY: number) => {
      if (!aRef.current || !attRef.current) return;
      const ar   = aRef.current.getBoundingClientRect();
      const attr = attRef.current.getBoundingClientRect();
      const srcX = pxX - fr.left;
      const srcY = pxY - fr.top;
      const svgLeft  = ar.left   - fr.left;
      const svgRight = attr.right - fr.left;
      const svgWidth = svgRight - svgLeft;
      const apexFrac = svgWidth > 0 ? (srcX - svgLeft) / svgWidth : 0.5;
      const dy = fr.height - srcY;
      const norm = (a: number) => ((a * 180 / Math.PI) % 360 + 360) % 360;
      setBeamBounds({ svgLeft, svgWidth, apexFrac: Math.max(0.05, Math.min(0.95, apexFrac)) });
      setConeAngles({
        right: Math.round(norm(Math.atan2(svgRight - srcX, -dy))),
        left:  Math.round(norm(Math.atan2(svgLeft  - srcX, -dy))),
      });
    };

    if (phase >= 1 && lightForRef.current && footerRef.current) {
      const cr = lightForRef.current.getBoundingClientRect();
      const fr = footerRef.current.getBoundingClientRect();
      const pxX = cr.left + cr.width * 0.85;
      const pxY = cr.bottom - (cr.height * 0.28);
      const xFrac = (pxX - fr.left) / fr.width;
      const yFrac = (pxY - fr.top) / fr.height;
      const clamped = {
        x: Math.max(0.05, Math.min(0.95, xFrac)),
        y: Math.max(0.05, Math.min(0.90, yFrac)),
        pxX, pxY,
      };
      setSpotPos(clamped);
      spotPosRef.current = clamped;
      computeBeam(fr, pxX, pxY);
    }

    const handleResize = () => {
      if (!lightForRef.current || !footerRef.current) return;
      const cr = lightForRef.current.getBoundingClientRect();
      const fr = footerRef.current.getBoundingClientRect();
      (window as any).__letterRects = null;
      const pxX = cr.left + cr.width * 0.85;
      const pxY = cr.bottom - (cr.height * 0.28);
      setSpotPos(prev => ({ ...prev, pxX, pxY }));
      computeBeam(fr, pxX, pxY);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [phase]);

  // ── Three.js setup ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!animating || !mountRef.current) return;
    const mount = mountRef.current;
    const W = mount.clientWidth || 900;
    const H = mount.clientHeight || 450;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.autoClear = false;
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
    camera.position.z = CAMERA_Z;

    const PR = renderer.getPixelRatio();
    const bgRT = new THREE.WebGLRenderTarget(W * PR, H * PR, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });

    const bgScene = new THREE.Scene();
    const bgMat = new THREE.ShaderMaterial({ vertexShader: BG_VERT, fragmentShader: BG_FRAG, uniforms: { uTime: { value: 0 } } });
    bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(14, 8), bgMat));

    const sphereScene = new THREE.Scene();
    const sphGeo = new THREE.SphereGeometry(SPHERE_3D_R, 64, 64);
    const sphMat = new THREE.ShaderMaterial({
      vertexShader: SPH_VERT, fragmentShader: SPH_FRAG,
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.NormalBlending, side: THREE.FrontSide,
      uniforms: {
        uBgTex: { value: bgRT.texture },
        uRes:   { value: new THREE.Vector2(W * PR, H * PR) },
        uTime:  { value: 0 }, uTint: { value: new THREE.Color(0.3, 0.65, 1.0) },
        uBeat: { value: 0 }, uRMS:  { value: 0 },
        uBass: { value: 0 }, uMid:  { value: 0 },
        uAir:  { value: 0 }, uSub:  { value: 0 },
        uRefraction:       { value: SPH_REFRACTION },
        uFractalSpeed:     { value: SPH_FRACTAL_SPEED },
        uFractalIter:      { value: SPH_FRACTAL_ITER },
        uFractalIntensity: { value: 0 },
        uFractalScale:     { value: SPH_FRACTAL_SCALE },
        uPalette:          { value: 0 },
      },
    });
    const sphMesh = new THREE.Mesh(sphGeo, sphMat);
    sphMesh.renderOrder = 1;
    sphMesh.visible = false;
    sphereScene.add(sphMesh);

    const spring = { x: 0, y: 0, vx: 0, vy: 0 };
    let sphereReady = false;
    let curFracI = 0;
    let palIdx = 0;
    const onClickPal = () => { palIdx = (palIdx + 1) % 5; sphMat.uniforms.uPalette.value = palIdx; };
    mount.addEventListener('click', onClickPal);

    const frac2wx = (f: number) => {
      const vFov = camera.fov * Math.PI / 180;
      const halfH = Math.tan(vFov / 2) * CAMERA_Z;
      const halfW = halfH * camera.aspect;
      return -halfW + f * 2 * halfW;
    };
    const updateMaxLat = (w: number, h: number) => {
      const vFov = camera.fov * Math.PI / 180;
      const halfH2 = Math.tan(vFov / 2) * CAMERA_Z;
      const halfW2 = halfH2 * (w / h);
      maxLatRef.current = halfW2 * 0.94;
    };
    updateMaxLat(W, H);

    let time = 0, lastT = performance.now(), animId: number;

    function animate() {
      animId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;
      time += dt;
      const p = phaseRef.current;

      const beat = Math.max(0, Math.sin(time * 2.5) * 0.5) * 0.18;
      const rms  = 0.09 + Math.sin(time * 0.75) * 0.04;
      const bass = Math.max(0, Math.sin(time * 3.1) * 0.4) * 0.14;
      const mid  = 0.07 + Math.sin(time * 1.4) * 0.03;
      const air  = 0.03 + Math.sin(time * 0.5) * 0.02;

      if (p >= 3) {
        if (!sphereReady) {
          sphereReady = true;
          sphMesh.visible = true;
          spring.x  = -(maxLatRef.current * 1.4 + 0.3);
          spring.y  = 0;
          spring.vx = 0.06;
          spring.vy = 0;
        }
        const tScale = p === 3
          ? THREE.MathUtils.clamp((spring.x + maxLatRef.current * 1.4 + 0.3) / (maxLatRef.current * 1.2), 0, 1)
          : 1.0 + beat * 0.18;
        sphMesh.scale.setScalar(THREE.MathUtils.lerp(sphMesh.scale.x, tScale, dt * 4));

        const spotWX = frac2wx(spotPosRef.current.x);
        const ml = maxLatRef.current;
        const tx = p >= 4 ? mouseRef.current.x * ml : spotWX;
        const ty = p >= 4 ? mouseRef.current.y * (ml * 0.45) : 0;

        spring.vx = spring.vx * SPRING_D + (tx - spring.x) * SPRING_K;
        spring.vy = spring.vy * SPRING_D + (ty - spring.y) * SPRING_K;
        spring.x += spring.vx;
        spring.y += spring.vy;
        sphMesh.position.set(spring.x, spring.y, 0);

        const coneHalf = 15.4 * Math.PI / 180;
        const coneW = CAMERA_Z * Math.tan(coneHalf);
        const dx = Math.abs(spring.x - spotWX);
        const underLight = dx < coneW + SPHERE_3D_R * 1.2;
        curFracI = THREE.MathUtils.lerp(curFracI, underLight ? SPH_FRACTAL_INTENSITY : 0, dt * 1.5);
        sphMat.uniforms.uFractalIntensity.value = curFracI;

        // ── INTERACCIÓN ESFERA > LETRAS ────────────────────────────────────
        // Proyectamos la posición 3D de la esfera a coordenadas de píxeles en pantalla
        if (p >= 4) {
          const vec = new THREE.Vector3(spring.x, spring.y, 0);
          vec.project(camera);
          const rect = mount.getBoundingClientRect();
          const pxX = (vec.x * 0.5 + 0.5) * rect.width + rect.left;
          const pxY = -(vec.y * 0.5 - 0.5) * rect.height + rect.top;

          // Cacheamos los bounding boxes para evitar problemas de rendimiento
          const w = window as any;
          if (!w.__letterRects || w.__letterRects.length === 0) {
            w.__letterRects = Array.from(document.querySelectorAll('.hover-letter')).map((el: any) => ({
              el, rect: el.getBoundingClientRect()
            }));
          }
          
          w.__letterRects.forEach(({ el, rect }: { el: HTMLElement, rect: DOMRect }) => {
            // Expandimos levemente la caja de colisión (hitbox)
            if (pxX >= rect.left - 20 && pxX <= rect.right + 20 && pxY >= rect.top - 20 && pxY <= rect.bottom + 20) {
               if (el.dataset.active !== "true") {
                  el.dataset.active = "true";
                  // Genera un color aleatorio vibrante para la letra
                  const colors = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ef4444', '#eab308'];
                  const color = colors[Math.floor(Math.random() * colors.length)];
                  
                  el.style.transition = 'none';
                  el.style.color = color;
                  el.style.textShadow = `0 0 15px ${color}, 0 0 30px ${color}`; // Brillo neón
                  
                  // Inicia el desvanecimiento (fade out)
                  setTimeout(() => {
                     el.style.transition = 'color 1.2s ease, text-shadow 1.2s ease';
                     el.style.color = '';
                     el.style.textShadow = 'none';
                     setTimeout(() => { el.dataset.active = "false"; }, 1200);
                  }, 50); // Mantiene el brillo por un breve instante antes de apagar
               }
            }
          });
        }
      }

      bgMat.uniforms.uTime.value  = time;
      sphMat.uniforms.uTime.value = time;
      sphMat.uniforms.uBeat.value = beat; sphMat.uniforms.uRMS.value = rms;
      sphMat.uniforms.uBass.value = bass; sphMat.uniforms.uMid.value = mid;
      sphMat.uniforms.uAir.value  = air;  sphMat.uniforms.uSub.value = bass * 0.5;
      sphMat.uniforms.uTint.value.set(0.25 + bass * 0.75, 0.40 + mid * 0.60, 0.65 + air * 0.35);

      renderer.setRenderTarget(bgRT); renderer.clear(); renderer.render(bgScene, camera);
      renderer.setRenderTarget(null); renderer.clear();
      renderer.render(bgScene, camera);
      renderer.clearDepth();
      renderer.render(sphereScene, camera);
    }

    animate();

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      const pr = renderer.getPixelRatio();
      renderer.setSize(w, h); bgRT.setSize(w * pr, h * pr);
      sphMat.uniforms.uRes.value.set(w * pr, h * pr);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      updateMaxLat(w, h);
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      mount.removeEventListener('click', onClickPal);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose(); sphGeo.dispose(); sphMat.dispose(); bgMat.dispose(); bgRT.dispose();
    };
  }, [animating]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const r = mountRef.current?.getBoundingClientRect();
    if (!r) return;
    mouseRef.current.x =   (e.clientX - r.left) / r.width  * 2 - 1;
    mouseRef.current.y = -(((e.clientY - r.top)  / r.height) * 2 - 1);
  }, []);
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const r = mountRef.current?.getBoundingClientRect();
    if (!r) return;
    mouseRef.current.x =   (e.touches[0].clientX - r.left) / r.width  * 2 - 1;
    mouseRef.current.y = -(((e.touches[0].clientY - r.top)  / r.height) * 2 - 1);
  }, []);

  useEffect(() => {
    if (!animating || typeof window === 'undefined') return;
    if (!/Android/i.test(navigator.userAgent)) return;
    const h = (e: DeviceOrientationEvent) => {
      mouseRef.current.x = Math.max(-1, Math.min(1, (e.gamma ?? 0) / 45));
      mouseRef.current.y = Math.max(-1, Math.min(1, -((e.beta ?? 45) - 45) / 45));
    };
    window.addEventListener('deviceorientation', h, { passive: true });
    return () => window.removeEventListener('deviceorientation', h);
  }, [animating]);

  if (!animating) {
    return (
      <footer ref={footerRef} className="border-t border-slate-800 bg-slate-950 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h4 className="text-xl font-black tracking-tighter text-white mb-4">
              TDF<span className="text-orange-600">FILM</span>
            </h4>
            <p className="text-slate-500 text-sm leading-relaxed">{t('footer.mission')}</p>
          </div>
          <div>
            <h5 className="font-bold text-white mb-4 uppercase text-xs tracking-wider">{t('footer.explore')}</h5>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><Link href="/locaciones" className="hover:text-orange-500 transition">{t('nav.locaciones')}</Link></li>
              <li><Link href="/guia"       className="hover:text-orange-500 transition">{t('footer.guia')}</Link></li>
              <li><Link href="/proyectos"  className="hover:text-orange-500 transition">{t('footer.cartelera')}</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold text-white mb-4 uppercase text-xs tracking-wider">{t('footer.contact')}</h5>
            <p className="text-sm text-slate-500 mb-2">info@nosoyoficial.com.ar</p>
            <p className="text-sm text-slate-500">Ushuaia, Tierra del Fuego, Argentina</p>
          </div>
        </div>
        <div className="text-center mt-12 pt-8 border-t border-slate-900 text-xs text-slate-600">
          {t('footer.rights')}
        </div>
      </footer>
    );
  }

  const darkAlpha = phase >= 2 ? 1 : 0; 
  const textDim   = phase >= 2 ? 0.30 : 1;   
  const spotXpct  = `${(spotPos.x * 100).toFixed(1)}%`;
  const spotYpct  = `${(spotPos.y * 100).toFixed(1)}%`;

  // Máscara cónica dinámica — ángulos calculados desde A hasta ATT
  const coneMask = (() => {
    const { right: cR, left: cL } = coneAngles;
    return [
      `conic-gradient(`,
      `  from 0deg at ${spotXpct} ${spotYpct},`,
      `  black 0deg, black ${Math.max(0, cR - 6)}deg,`,
      `  transparent ${cR}deg, transparent ${cL}deg,`,
      `  black ${Math.min(360, cL + 6)}deg, black 360deg`,
      `)`,
    ].join('');
  })();

  return (
    <>
      {/* ══ PORTAL GLOBAL MEJORADO (Oscuridad sólida + Blur) ══ 
          Usamos mask-image radial para que el centro (la luz) sea 100% transparente 
          y NO tenga blur, mientras que el resto de la página oscurece y se difumina. */}
      {typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0,
            zIndex: 9997,
            background: 'rgba(1,7,18,0.62)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            opacity: darkAlpha,
            transition: 'opacity 8s ease',
            pointerEvents: 'none',
            maskImage: `radial-gradient(circle at ${spotPos.pxX}px ${spotPos.pxY}px, transparent 0%, transparent 12%, rgba(0,0,0,0.3) 35%, black 65%)`,
            WebkitMaskImage: `radial-gradient(circle at ${spotPos.pxX}px ${spotPos.pxY}px, transparent 0%, transparent 12%, rgba(0,0,0,0.3) 35%, black 65%)`,
          }}
        />,
        document.body,
      )}

      <footer
        ref={footerRef}
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        onClick={() => { if (phase >= 4) router.push('/alight'); }}
        style={{
          position: 'relative',
          zIndex: 9998,
          minHeight: '450px',
          background: '#010912',
          overflow: 'hidden',
          cursor: phase >= 4 ? 'pointer' : 'default',
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Anton&display=swap');
          @keyframes fHint  { 0%,100%{opacity:.15} 50%{opacity:.50} }
          @keyframes srcPls { 0%,100%{opacity:.8}  50%{opacity:1}   }
          @keyframes geminiFlow { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
          @keyframes geminiGlow {
            0%,100%{filter:drop-shadow(0 0 10px #4285f4) drop-shadow(0 0 22px rgba(155,114,203,0.7))}
            33%{filter:drop-shadow(0 0 10px #d96570) drop-shadow(0 0 22px rgba(244,180,0,0.7))}
            66%{filter:drop-shadow(0 0 10px #0f9d58) drop-shadow(0 0 22px rgba(66,133,244,0.7))}
          }
        `}</style>

        <div ref={mountRef} style={{ position:'absolute', inset:0, zIndex:0, pointerEvents:'none' }} />

        {/* ── TIPOGRAFÍAS ───────────────────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: '12%',
            left: 0, right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'clamp(.2rem, .8vw, .6rem)',
            fontFamily: '"Anton", "Impact", sans-serif',
            userSelect: 'none',
            pointerEvents: 'none',
            zIndex: 1,
            opacity: textDim,
            transition: 'opacity 3.5s ease',
            lineHeight: 1,
          }}
        >
          {/* Altura de A y ATT aumentada para mejor simetría */}
          <div ref={aRef} style={{
            fontSize: 'clamp(3.8rem, 10.6vw, 9.8rem)',
            lineHeight: 0.85,
            color: '#fff',
            transform: started ? 'translateX(0)' : 'translateX(-160vw)',
            opacity: started ? 1 : 0,
            transition: 'transform 2.4s cubic-bezier(.16,1,.3,1), opacity 1.2s ease',
          }}>
            <TextLetters text="A" />
          </div>

          <div
            ref={lightForRef}
            style={{
              display: 'flex', flexDirection: 'column',
              fontSize: 'clamp(1.65rem, 4.6vw, 4.3rem)',
              color: '#fff',
              gap: 0,
              transform: started ? 'translateX(0)' : 'translateX(-160vw)',
              opacity: started ? 1 : 0,
              transition: 'transform 2.4s cubic-bezier(.16,1,.3,1) .18s, opacity 1.2s ease .18s',
              lineHeight: 1.05,
            }}
          >
            <TextLetters text="LIGHT" />
            <TextLetters text="FOR" />
          </div>

          <div ref={attRef} style={{
            fontSize: 'clamp(3.8rem, 10.6vw, 9.8rem)',
            lineHeight: 0.85,
            color: '#fff',
            transform: started ? 'translateX(0)' : 'translateX(-160vw)',
            opacity: started ? 1 : 0,
            transition: 'transform 2.4s cubic-bezier(.16,1,.3,1) .36s, opacity 1.2s ease .36s',
          }}>
            <TextLetters text="ATT" />
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column',
            fontSize: 'clamp(1.65rem, 4.6vw, 4.3rem)',
            color: '#fff',
            gap: 0,
            lineHeight: 1.05,
          }}>
            <div style={{
              transform: started ? 'translate(0,0)' : 'translate(80vw,-120%)',
              opacity: started ? 1 : 0,
              transition: 'transform 2.4s cubic-bezier(.16,1,.3,1) .5s, opacity 1.2s ease .5s',
            }}>
              <TextLetters text="RACTING" style={{ letterSpacing: '0.09em', paddingLeft: '0.04em' }} />
            </div>
            
            <div style={{
              transform: started ? 'translate(0,0)' : 'translate(80vw,120%)',
              opacity: started ? 0.7 : 0,
              transition: 'transform 2.4s cubic-bezier(.16,1,.3,1) .65s, opacity 1.2s ease .65s',
              color: 'rgba(255,255,255,.72)',
            }}>
              {/* Ajuste considerable del interletrado para "ENTION" */}
              <TextLetters text="ENTION" style={{ letterSpacing: '0.19em', paddingLeft: '0.04em' }} />
            </div>
          </div>
        </div>

        {/* ── SVG DEL SPOTLIGHT ──────────────────────────────────────────────── */}
        <svg
          viewBox="0 0 100 400"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            left:   `${beamBounds.svgLeft}px`,
            top:    `${(spotPos.y * 100).toFixed(1)}%`,
            width:  `${Math.max(1, beamBounds.svgWidth)}px`,
            height: `${((1 - spotPos.y) * 100).toFixed(1)}%`,
            zIndex: 2,
            pointerEvents: 'none',
            opacity: phase >= 1 ? 1 : 0,
            transition: 'opacity 2s ease',
            overflow: 'visible',
            animation: phase >= 1 ? 'srcPls 5s ease-in-out infinite' : 'none',
          }}
        >
          <defs>
            <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="rgba(255,248,200,0.95)"/>
              <stop offset="25%"  stopColor="rgba(255,242,165,0.65)"/>
              <stop offset="65%"  stopColor="rgba(255,238,148,0.30)"/>
              <stop offset="100%" stopColor="rgba(255,235,130,0.00)"/>
            </linearGradient>
            <linearGradient id="cgC" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="rgba(255,255,220,0.85)"/>
              <stop offset="100%" stopColor="rgba(255,255,200,0.10)"/>
            </linearGradient>
            <filter id="cb"><feGaussianBlur stdDeviation="1.8"/></filter>
          </defs>
          <polygon
            points={`${(beamBounds.apexFrac * 100).toFixed(1)},0 0,400 100,400`}
            fill="url(#cg)" filter="url(#cb)"
          />
          <polygon
            points={`${(beamBounds.apexFrac * 100).toFixed(1)},0 10,400 90,400`}
            fill="url(#cgC)"
          />
          <ellipse
            cx={`${(beamBounds.apexFrac * 100).toFixed(1)}`}
            cy="1" rx="4" ry="2"
            fill="rgba(255,255,215,1.0)"
          />
        </svg>

        {/* ── OVERLAY INTERNO DEL FOOTER ────────────────────────────────────── */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 3,
          background: `rgba(1,7,18,0.62)`,
          transition: 'opacity 8s ease',
          opacity: darkAlpha,
          pointerEvents: 'none',
          maskImage: phase >= 1 ? coneMask : 'none',
          WebkitMaskImage: phase >= 1 ? coneMask : 'none',
        }} />

        <div style={{
          position:'absolute', bottom:'1rem', left:'50%',
          transform:'translateX(-50%)',
          whiteSpace:'nowrap', pointerEvents:'none', zIndex:4,
          opacity: phase >= 5 ? 1 : 0,
          transition: 'opacity 2s ease',
        }}>
          <div style={{ animation: phase >= 5 ? 'geminiGlow 4s ease-in-out infinite' : 'none' }}>
            <span style={{
              background: 'linear-gradient(90deg,#4285f4,#9b72cb,#d96570,#f4b400,#0f9d58,#4285f4)',
              backgroundSize: '300% 100%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontSize: 'clamp(.65rem,1.1vw,.85rem)',
              letterSpacing: '.28em',
              textTransform: 'uppercase',
              fontFamily: '"Anton",sans-serif',
              animation: phase >= 5 ? 'geminiFlow 3s linear infinite' : 'none',
            }}>
              toca para entrar
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}