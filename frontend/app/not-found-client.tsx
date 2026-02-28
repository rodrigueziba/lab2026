'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { SplatMesh, SparkRenderer } from '@sparkjsdev/spark';
import Link from 'next/link';

type V3 = [number, number, number];

type CamWaypoint = {
  pos: V3;
  lookAt: V3;
  splatPos: V3;
};

const SPLAT_URL = '/splats/4.spz';

const CAM_CONFIG: {
  splatRotation: V3;
  waypoints: CamWaypoint[];
} = {
  splatRotation: [0, 0, 3.14],
  waypoints: [
    { pos: [0, 0.2, 1.8], lookAt: [0, 0, 0], splatPos: [0, 0, 0] },
    { pos: [0.6, 0.35, 1.2], lookAt: [0.15, 0.05, 0], splatPos: [-0.15, 0.05, 0.4] },
    { pos: [-0.5, 0.5, 0.9], lookAt: [0, 0.1, -0.2], splatPos: [0.2, -0.05, 0.7] },
    { pos: [0.1, 0.8, 1.4], lookAt: [0, 0.2, 0], splatPos: [0, 0.15, 0.2] },
  ],
};

const SCROLL_RESPONSE = 2.6;
const CAMERA_RESPONSE = 2.4;
const SPLAT_RESPONSE = 2.1;

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

function expAlpha(response: number, dt: number) {
  return 1 - Math.exp(-response * dt);
}

function quatFromPosLookAt(pos: V3, lookAt: V3) {
  const cam = new THREE.PerspectiveCamera();
  cam.position.copy(v3(pos));
  cam.lookAt(v3(lookAt));
  return cam.quaternion.clone();
}

export default function NotFoundClient() {
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const splatRef = useRef<SplatMesh | null>(null);
  const mountIdRef = useRef(0);

  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollProgressRef = useRef(0);
  const smoothScrollRef = useRef(0);

  const titleLetters = useMemo(() => 'ERROR 404'.split(''), []);
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

  useEffect(() => {
    const wrap = canvasWrapRef.current;
    if (!wrap) return;

    if (rendererRef.current) {
      rendererRef.current.setAnimationLoop(null);
      rendererRef.current.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      splatRef.current = null;
    }

    mountIdRef.current++;
    const thisMountId = mountIdRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#06060f');
    sceneRef.current = scene;

    const wp0 = CAM_CONFIG.waypoints[0];
    const camera = new THREE.PerspectiveCamera(55, wrap.clientWidth / wrap.clientHeight, 0.01, 10000);
    camera.position.copy(v3(wp0.pos));
    camera.quaternion.copy(quatFromPosLookAt(wp0.pos, wp0.lookAt));
    cameraRef.current = camera;

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
    } catch (e) {
      console.error('SparkRenderer error:', e);
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
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
    const tmpQuat = new THREE.Quaternion();

    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const wps = CAM_CONFIG.waypoints;

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

      renderer.render(scene, camera);
    });

    try {
      const splat = new SplatMesh({
        url: SPLAT_URL,
        onLoad: () => {
          if (mountIdRef.current !== thisMountId) return;
          console.log('404 splat cargado');
        },
      });

      splat.rotation.copy(new THREE.Euler(...CAM_CONFIG.splatRotation));
      splat.position.copy(v3(CAM_CONFIG.waypoints[0].splatPos));
      scene.add(splat);
      splatRef.current = splat;
    } catch (e) {
      console.error('SplatMesh error:', e);
    }

    return () => {
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
  }, []);

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

  const getLetterStyle = (i: number, total: number): React.CSSProperties => {
    if (!heroMouse.hover) return { transform: 'translate3d(0,0,0)', textShadow: 'none' };

    const sm = smoothMouse.current;
    const lx = i / (total - 1);
    const dx = lx - sm.nx;
    const dy = 0.5 - sm.ny;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    const force = Math.max(0, 34 * (1 - dist * 2.2));
    const tx = (dx / dist) * force;
    const ty = (dy / dist) * force * 0.55;

    return {
      transform: `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0)`,
      textShadow: `${(-tx * 0.35).toFixed(1)}px ${(-ty * 0.35 + 4).toFixed(1)}px 18px rgba(99,102,241,0.28)`,
    };
  };

  const onHeroMove: React.MouseEventHandler<HTMLDivElement> = e => {
    const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    setHeroMouse(s => ({
      ...s,
      nx: (e.clientX - r.left) / r.width,
      ny: (e.clientY - r.top) / r.height,
    }));
  };

  return (
    <div className="relative text-white" style={{ height: '220svh' }}>
      <div ref={canvasWrapRef} className="fixed inset-0 h-[100svh] w-full">
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              'radial-gradient(ellipse 58% 58% at 50% 50%, transparent 0%, transparent 34%, rgba(6,6,15,0.28) 54%, rgba(6,6,15,0.76) 72%, rgba(6,6,15,0.95) 86%, #06060f 100%)',
          }}
        />

        <div className="absolute inset-0 z-20 flex items-center justify-center px-6">
          <div
            className="max-w-4xl text-center"
            onMouseEnter={() => setHeroMouse(s => ({ ...s, hover: true }))}
            onMouseLeave={() => setHeroMouse({ nx: 0.5, ny: 0.5, hover: false })}
            onMouseMove={onHeroMove}
          >
            <h1 className="select-none text-center text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-none">
              {titleLetters.map((ch, i) => (
                <span
                  key={`${ch}-${i}`}
                  className="inline-block"
                  style={{
                    ...getLetterStyle(i, titleLetters.length),
                    transition: heroMouse.hover
                      ? 'transform 0.18s cubic-bezier(0.23,1,0.32,1), text-shadow 0.18s ease'
                      : 'transform 0.6s cubic-bezier(0.23,1,0.32,1), text-shadow 0.6s ease',
                  }}
                >
                  {ch === ' ' ? '\u00A0' : ch}
                </span>
              ))}
            </h1>

            <p className="mt-4 text-base sm:text-lg md:text-xl text-white/72">
              Página no encontrada
            </p>

            <p className="mt-3 text-sm sm:text-base text-white/45 max-w-xl mx-auto leading-relaxed">
              La ruta que intentaste abrir no existe o fue movida. Podés volver al inicio y seguir explorando.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/"
                className="rounded-2xl border border-white/12 bg-white/10 px-5 py-3 text-sm font-medium text-white hover:bg-white/14 transition-colors backdrop-blur"
              >
                Volver al inicio
              </Link>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/50 backdrop-blur">
                Scroll para explorar
              </div>
            </div>
          </div>
        </div>
      </div>

      <div aria-hidden className="h-[220svh]" />
    </div>
  );
}