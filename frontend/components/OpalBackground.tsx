"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * OpalBackground v2
 * Ondas lentas y direccionadas + ripples en click.
 * Parámetros configurables vía props.params (velocidad, dirección, color, ripples).
 */

const VERT = `
  attribute vec2 a_position;
  void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const FRAG = `
  precision highp float;

  uniform float u_time;
  uniform vec2  u_resolution;
  uniform vec2  u_ripple_pos[6];
  uniform float u_ripple_time[6];
  uniform int   u_ripple_count;

  uniform float u_speed;
  uniform vec2  u_flow;
  uniform float u_color_speed;
  uniform vec3  u_palette_base;

  vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 0.5);
    vec3 d = u_palette_base;
    return a + b * cos(6.28318 * (c * t + d));
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
  }
  float fbm(vec2 p) {
    float v=0.0, a=0.5;
    for (int i=0;i<6;i++) { v+=a*noise(p); p=p*2.1+vec2(1.7,9.2); a*=0.5; }
    return v;
  }

  vec2 warp(vec2 uv, float t) {
    float s    = 0.00032 * u_speed;
    vec2  flow = u_flow;

    vec2 q = vec2(
      fbm(uv + t*s * flow * vec2(1.0,  0.35)),
      fbm(uv + t*s * flow * vec2(0.25,-0.75))
    );
    vec2 r = vec2(
      fbm(uv + 3.2*q + t*s*0.45 * vec2(-0.7, 0.5)),
      fbm(uv + 3.2*q + t*s*0.45 * vec2( 0.5, 0.7))
    );
    return vec2(fbm(uv + 5.5*r), fbm(uv + 5.5*r + vec2(5.2,1.3)));
  }

  float ripple(vec2 uv, vec2 center, float age) {
    float dist  = length(uv - center);
    float speed = 0.5;
    float front = age * speed;
    float w     = 0.16;
    float fade  = exp(-age * 1.2);

    float r1 = exp(-pow((dist - front)        / w,          2.0));
    float r2 = exp(-pow((dist - front*0.62)   / (w*0.65),   2.0)) * 0.45;
    float r3 = exp(-pow((dist - front*0.32)   / (w*0.45),   2.0)) * 0.2;

    return (r1 + r2 + r3) * fade * smoothstep(0.0, 0.04, dist);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;

    vec2 uvW = uv;
    uvW.x *= aspect;
    uvW   *= 2.5;

    vec2  w = warp(uvW, u_time);
    float f = fbm(uvW + w*4.2 + u_time*0.00016*u_speed);

    float rippleSum = 0.0;
    for (int i = 0; i < 6; i++) {
      if (i >= u_ripple_count) break;
      vec2 rp = u_ripple_pos[i];
      rp.x   *= aspect;
      rp     *= 2.5;
      rippleSum += ripple(uvW, rp, u_ripple_time[i]);
    }

    float fMod = f + rippleSum * 0.25;

    vec3 col = palette(fMod + u_time * 0.00005 * u_color_speed) * 1.2;

    float bri  = smoothstep(0.22, 0.70, fMod);
    col *= bri * bri;

    float spec = pow(max(0.0, fMod - 0.57), 3.0) * 2.8;
    col += spec * vec3(0.55, 0.88, 1.0);

    col += rippleSum * 0.20 * vec3(0.4, 0.85, 1.0);

    vec2 m = smoothstep(0.0,0.06,uv) * smoothstep(0.0,0.06,1.0-uv);
    col   *= m.x * m.y;

    col *= 0.64;
    gl_FragColor = vec4(col, 1.0);
  }
`;

interface Ripple { x: number; y: number; born: number; }

const RIPPLE_LIFE = 3400;

export interface OpalBackgroundParams {
  speed?: number;
  flowX?: number;
  flowY?: number;
  colorSpeed?: number;
  paletteBase?: string;
  maxRipples?: number;
}

const DEFAULT_PARAMS: Required<OpalBackgroundParams> = {
  speed: 1,
  flowX: 0.75,
  flowY: 0.95,
  colorSpeed: 1,
  paletteBase: "#1a6b9e",
  maxRipples: 6,
};

function hexToVec3(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return [r, g, b];
}

function initGL(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };

  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);

  const pos = gl.getAttribLocation(prog, "a_position");
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

  return {
    gl,
    uTime: gl.getUniformLocation(prog, "u_time"),
    uRes: gl.getUniformLocation(prog, "u_resolution"),
    uRipplePos: gl.getUniformLocation(prog, "u_ripple_pos"),
    uRippleTime: gl.getUniformLocation(prog, "u_ripple_time"),
    uRippleCount: gl.getUniformLocation(prog, "u_ripple_count"),
    uSpeed: gl.getUniformLocation(prog, "u_speed"),
    uFlow: gl.getUniformLocation(prog, "u_flow"),
    uColorSpeed: gl.getUniformLocation(prog, "u_color_speed"),
    uPaletteBase: gl.getUniformLocation(prog, "u_palette_base"),
  };
}

interface OpalBackgroundProps {
  children?: React.ReactNode;
  standalone?: boolean;
  className?: string;
  params?: OpalBackgroundParams;
}

const TARGET_FPS = 30;
const FPS_SAMPLE_FRAMES = 60;
const FPS_DISABLE_AFTER_FRAMES = 120;

export default function OpalBackground({
  children,
  standalone = false,
  className = "",
  params: paramsProp,
}: OpalBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const ripplesRef = useRef<Ripple[]>([]);
  const params = { ...DEFAULT_PARAMS, ...paramsProp };
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const maxRipplesRef = useRef(Math.max(1, Math.min(6, params.maxRipples)));
  maxRipplesRef.current = Math.max(1, Math.min(6, params.maxRipples));
  const [disabled, setDisabled] = useState(false);
  const resolutionScaleRef = useRef(1);
  const pixelRatioScaleRef = useRef(1);

  const addRippleAt = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = 1.0 - (clientY - rect.top) / rect.height;
    const now = performance.now();
    const maxR = maxRipplesRef.current;
    ripplesRef.current = [
      ...ripplesRef.current.filter((r) => now - r.born < RIPPLE_LIFE),
      { x, y, born: now },
    ].slice(-maxR);
  }, []);

  useEffect(() => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = initGL(canvas);
    if (!ctx) return;
    const {
      gl, uTime, uRes, uRipplePos, uRippleTime, uRippleCount,
      uSpeed, uFlow, uColorSpeed, uPaletteBase,
    } = ctx;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const scale = resolutionScaleRef.current * pixelRatioScaleRef.current;
      canvas.width = Math.max(1, Math.floor(canvas.offsetWidth * dpr * scale));
      canvas.height = Math.max(1, Math.floor(canvas.offsetHeight * dpr * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const start = performance.now();
    let frameCount = 0;
    let lastFpsTime = start;
    let hasReducedQuality = false;
    let framesAfterReduce = 0;
    let sampleStartAfterReduce = 0;

    const loop = () => {
      const now = performance.now();
      const t = now - start;
      frameCount++;

      const p = paramsRef.current;
      ripplesRef.current = ripplesRef.current.filter((r) => now - r.born < RIPPLE_LIFE);

      const posArr = new Float32Array(6 * 2);
      const timeArr = new Float32Array(6);
      ripplesRef.current.forEach((r, i) => {
        posArr[i * 2] = r.x;
        posArr[i * 2 + 1] = r.y;
        timeArr[i] = (now - r.born) / 1000;
      });

      const [pr, pg, pb] = hexToVec3(p.paletteBase);

      gl.uniform1f(uTime, t);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform2fv(uRipplePos, posArr);
      gl.uniform1fv(uRippleTime, timeArr);
      gl.uniform1i(uRippleCount, ripplesRef.current.length);
      gl.uniform1f(uSpeed, p.speed);
      gl.uniform2f(uFlow, p.flowX, p.flowY);
      gl.uniform1f(uColorSpeed, p.colorSpeed);
      gl.uniform3f(uPaletteBase, pr, pg, pb);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (!hasReducedQuality) {
        if (frameCount >= FPS_SAMPLE_FRAMES) {
          const elapsed = (now - lastFpsTime) / 1000;
          const fps = elapsed > 0 ? FPS_SAMPLE_FRAMES / elapsed : 60;
          if (fps < TARGET_FPS) {
            hasReducedQuality = true;
            resolutionScaleRef.current = 0.35;
            pixelRatioScaleRef.current = 0.5;
            resize();
            lastFpsTime = now;
            frameCount = 0;
            sampleStartAfterReduce = now;
          } else {
            lastFpsTime = now;
            frameCount = 0;
          }
        }
      } else {
        framesAfterReduce++;
        if (framesAfterReduce >= FPS_SAMPLE_FRAMES) {
          const elapsed = (now - sampleStartAfterReduce) / 1000;
          const fps = elapsed > 0 ? FPS_SAMPLE_FRAMES / elapsed : 0;
          if (fps < TARGET_FPS) {
            setDisabled(true);
            return;
          }
          framesAfterReduce = 0;
          sampleStartAfterReduce = now;
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [disabled]);

  const canvasStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    display: "block",
    cursor: "crosshair",
  };

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      addRippleAt(e.clientX, e.clientY);
    },
    [addRippleAt]
  );

  if (disabled) {
    return (
      <div className={`relative overflow-hidden bg-slate-950 ${className}`}>
        <div className="relative z-10">{children}</div>
      </div>
    );
  }

  if (standalone) {
    return (
      <>
        <canvas ref={canvasRef} style={{ ...canvasStyle, position: "fixed", inset: 0, zIndex: -1 }} />
        {children}
      </>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <canvas ref={canvasRef} style={{ ...canvasStyle, position: "absolute", inset: 0 }} />
      <div className="relative z-10">
        <div
          className="absolute inset-0 z-0 cursor-crosshair pointer-events-auto"
          onClick={handleOverlayClick}
          aria-hidden
        />
        {children}
      </div>
    </div>
  );
}
