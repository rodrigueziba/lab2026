"use client";
// H2: Four-sector floor with dynamic noise textures.
// Only mounted while the visualizer is active; see ExperienceDome.tsx.

import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_FLOOR, DBG_SILLAS } from "@/lib/debugConfig";
import { getSectorInfo } from "@/lib/floorSectors";

const DOME_R      = 28; // geometry radius (shader clips to outerR)
const CROSSFADE_S = 1.2;
const N_TYPES     = 4;

// ── Per-sector runtime state ─────────────────────────────────────────────────
interface SS {
  typeA: number; typeB: number; blend: number;
  timer: number;
  dotSz: number; dotTgt: number; dotTimer: number;
  shpT:  number; shpTgt: number; shpTimer: number;
  dirA:  number; dirTgt: number; dirTimer: number;
  phase: number;
}

function mkSS(i: number): SS {
  return {
    typeA: i % N_TYPES, typeB: (i + 2) % N_TYPES, blend: 0,
    timer: DBG_FLOOR.typeMinS + Math.random() * (DBG_FLOOR.typeMaxS - DBG_FLOOR.typeMinS),
    dotSz: 0.05 + Math.random() * 0.1,  dotTgt: 0.05 + Math.random() * 0.1,  dotTimer: 2 + Math.random() * 4,
    shpT:  Math.random() * 3,           shpTgt: Math.random() * 3,           shpTimer: 3 + Math.random() * 6,
    dirA:  Math.random() * Math.PI * 2, dirTgt: Math.random() * Math.PI * 2, dirTimer: 3 + Math.random() * 5,
    phase: 0,
  };
}

function nxt(cur: number): number {
  let t = Math.floor(Math.random() * N_TYPES);
  while (t === cur) t = Math.floor(Math.random() * N_TYPES);
  return t;
}

// ── GLSL ─────────────────────────────────────────────────────────────────────
const FLOOR_VERT = /* glsl */`
  varying vec3 vWP;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWP = wp.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FLOOR_FRAG = /* glsl */`
  uniform float uFade, uOpacity;
  uniform float uInnerR, uOuterR;
  uniform float uRotRad;
  uniform float uBaseSpeed, uSpeedGain, uSpeedExp;
  uniform float uSpeedMode;   // 0=spatial  1=user
  uniform float uTime, uHue;

  // Per-sector data packed as vec4 (x=S0, y=S1, z=S2, w=S3)
  uniform vec4 uTypeA, uTypeB, uBlend;
  uniform vec4 uDotSz, uShpT, uDirA, uPhase;

  varying vec3 vWP;

  // ── Noise ────────────────────────────────────────────────────────────────────
  float h1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  vec2  h2(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p)*43758.5453);}
  float vn(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);
    return mix(mix(h1(i),h1(i+vec2(1,0)),u.x),mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),u.x),u.y);}
  float fbm(vec2 p){float v=0.,a=0.5;
    for(int i=0;i<4;i++){v+=a*vn(p);p=p*2.07+vec2(1.73,9.2);a*=0.5;}return v;}

  // ── SDF shape blend (0=circle 1=box 2=diamond 3=star) ───────────────────────
  float sdf(vec2 p, float r, float s){
    float c=length(p)-r;
    float b=length(max(abs(p)-r*0.72,0.))+min(max(abs(p.x)-r*0.72,abs(p.y)-r*0.72),0.);
    float d=(abs(p.x)+abs(p.y))*0.707-r*0.9;
    float st=length(p)-r*(0.45+0.45*cos(atan(p.y,p.x)*5.));
    s=clamp(s,0.,3.);
    if(s<1.) return mix(c,b,s);
    if(s<2.) return mix(b,d,s-1.);
    return mix(d,st,s-2.);
  }

  // ── Pattern 0: halftone ──────────────────────────────────────────────────────
  float halftone(vec2 p,float t,float ds,float s,float da){
    vec2 sc=p+vec2(cos(da),sin(da))*t*.4;
    float cs=ds*2.5;
    vec2 cell=floor(sc/cs),lp=fract(sc/cs)-.5;
    float r=ds*(.25+.4*h1(cell+13.7));
    return smoothstep(.012,-.012,sdf(lp*cs,r,s));
  }

  // ── Pattern 1: Voronoi dots ──────────────────────────────────────────────────
  float voronoi(vec2 p,float t,float ds,float s,float da){
    vec2 sc=p+vec2(cos(da),sin(da))*t*.22;
    float cs=ds*4.5;
    vec2 cell=floor(sc/cs);
    float md=1e9; vec2 nc=vec2(0.);
    for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++){
      vec2 n=cell+vec2(float(i),float(j));
      vec2 c=(n+h2(n)*.8+.1)*cs;
      float d=length(sc-c);
      if(d<md){md=d;nc=c;}
    }
    return smoothstep(.015,-.015,sdf(sc-nc,ds*.32,s));
  }

  // ── Pattern 2: FBM dots ──────────────────────────────────────────────────────
  float fbmDots(vec2 p,float t,float ds,float s,float da){
    vec2 scroll=vec2(cos(da),sin(da))*t*.12;
    float n=fbm((p+scroll)/(ds*7.)+t*.07);
    return smoothstep(.47,.53,n);
  }

  // ── Pattern 3: Flow-field particles ─────────────────────────────────────────
  float flowField(vec2 p,float t,float ds,float s,float da){
    float cs=ds*5.5,res=0.;
    for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++){
      vec2 cell=floor(p/cs)+vec2(float(i),float(j));
      vec2 base=(cell+h2(cell)*.9)*cs;
      float fa=h1(cell+7.3)*6.2832+da;
      vec2 fd=vec2(cos(fa),sin(fa));
      vec2 pos=base+fd*fract(t*.22+h1(cell+3.1))*cs*2.2;
      res=max(res,smoothstep(.015,-.015,sdf(p-pos,ds*.42,s)));
    }
    return res;
  }

  // ── Dispatch ────────────────────────────────────────────────────────────────
  float evalP(float type,vec2 p,float t,float ds,float s,float da){
    if(type<.5) return halftone(p,t,ds,s,da);
    if(type<1.5) return voronoi(p,t,ds,s,da);
    if(type<2.5) return fbmDots(p,t,ds,s,da);
    return flowField(p,t,ds,s,da);
  }

  // ── Per-sector lookup ────────────────────────────────────────────────────────
  float sv(vec4 v,int s){if(s==0)return v.x;if(s==1)return v.y;if(s==2)return v.z;return v.w;}

  // ── HSL ──────────────────────────────────────────────────────────────────────
  vec3 hsl(float h,float s,float l){
    vec3 p=abs(fract(h+vec3(1.,2./3.,1./3.))*6.-3.);
    return l+s*(clamp(p-1.,0.,1.)-.5)*(1.-abs(2.*l-1.));
  }

  void main(){
    vec2 xz=vWP.xz;
    float r=length(xz);
    if(r>uOuterR||r<uInnerR) discard;

    float t=clamp((r-uInnerR)/(uOuterR-uInnerR),0.,1.);
    float ef=smoothstep(0.,.05,t)*smoothstep(1.,.96,t);

    // Sector
    float cosR=cos(-uRotRad),sinR=sin(-uRotRad);
    vec2 rxz=vec2(xz.x*cosR-xz.y*sinR,xz.x*sinR+xz.y*cosR);
    int sector;
    if(rxz.x>=0.&&rxz.y<0.) sector=0;
    else if(rxz.x>0.&&rxz.y>=0.) sector=1;
    else if(rxz.x<=0.&&rxz.y>0.) sector=2;
    else sector=3;

    float tA=sv(uTypeA,sector), tB=sv(uTypeB,sector);
    float bl=sv(uBlend,sector),  ds=sv(uDotSz,sector);
    float sh=sv(uShpT,sector),   da=sv(uDirA,sector);
    float ph=sv(uPhase,sector);

    float speed=uBaseSpeed*(1.+uSpeedGain*pow(t,uSpeedExp));
    float effT=(uSpeedMode<.5)?uTime*speed:ph;

    float pat=mix(evalP(tA,xz,effT,ds,sh,da),evalP(tB,xz,effT,ds,sh,da),bl);

    float hue=uHue+float(sector)*.25+t*.08;
    vec3 col=mix(vec3(.01,.005,.025),hsl(hue,.85,.5),pat);

    float alpha=pat*ef*uFade*uOpacity;
    if(alpha<.005) discard;
    gl_FragColor=vec4(col,alpha);
  }
`;

// ── Component ─────────────────────────────────────────────────────────────────
export default function FloorVisualizer() {
  const { camera } = useThree();
  const ssRef  = useRef<SS[]>([0,1,2,3].map(mkSS));
  const hueRef = useRef(0);

  const uniforms = useMemo<Record<string,THREE.IUniform>>(() => ({
    uFade:      { value: 0 },
    uOpacity:   { value: DBG_FLOOR.opacity },
    uInnerR:    { value: DBG_FLOOR.innerR },
    uOuterR:    { value: DBG_FLOOR.outerR },
    uRotRad:    { value: THREE.MathUtils.degToRad(DBG_FLOOR.rotationDeg) },
    uBaseSpeed: { value: DBG_FLOOR.baseSpeed },
    uSpeedGain: { value: DBG_FLOOR.speedGain },
    uSpeedExp:  { value: DBG_FLOOR.speedExp },
    uSpeedMode: { value: 0 },
    uTime:      { value: 0 },
    uHue:       { value: 0 },
    uTypeA:     { value: new THREE.Vector4(0,1,2,3) },
    uTypeB:     { value: new THREE.Vector4(2,3,0,1) },
    uBlend:     { value: new THREE.Vector4(0,0,0,0) },
    uDotSz:     { value: new THREE.Vector4(.08,.06,.10,.07) },
    uShpT:      { value: new THREE.Vector4(0,1,2,1.5) },
    uDirA:      { value: new THREE.Vector4(0,1.57,3.14,4.71) },
    uPhase:     { value: new THREE.Vector4(0,0,0,0) },
  }), []);

  useFrame(({ clock }, dt) => {
    const U  = uniforms;
    const ss = ssRef.current;

    U.uFade.value = Math.min(1, U.uFade.value + dt / (DBG_SILLAS.vizFadeMs / 1000));

    U.uOpacity.value   = DBG_FLOOR.opacity;
    U.uInnerR.value    = DBG_FLOOR.innerR;
    U.uOuterR.value    = DBG_FLOOR.outerR;
    U.uRotRad.value    = THREE.MathUtils.degToRad(DBG_FLOOR.rotationDeg);
    U.uBaseSpeed.value = DBG_FLOOR.baseSpeed;
    U.uSpeedGain.value = DBG_FLOOR.speedGain;
    U.uSpeedExp.value  = DBG_FLOOR.speedExp;
    U.uSpeedMode.value = DBG_FLOOR.speedMode === "user" ? 1 : 0;
    U.uTime.value      = clock.elapsedTime;

    hueRef.current += dt * 0.03;
    U.uHue.value = hueRef.current;

    // Player info for user speed mode
    const pi = getSectorInfo(camera.position.x, camera.position.z);

    const forced = [DBG_FLOOR.s0Type, DBG_FLOOR.s1Type, DBG_FLOOR.s2Type, DBG_FLOOR.s3Type];

    for (let i = 0; i < 4; i++) {
      const s = ss[i];

      // Type state machine
      if (forced[i] >= 0) {
        if (s.typeA !== forced[i]) { s.typeB = s.typeA; s.typeA = forced[i]; s.blend = 1; s.timer = 9999; }
      } else {
        s.timer -= dt;
        if (s.timer <= 0) {
          s.typeB = s.typeA; s.typeA = nxt(s.typeA);
          s.blend = 1;
          s.timer = DBG_FLOOR.typeMinS + Math.random() * (DBG_FLOOR.typeMaxS - DBG_FLOOR.typeMinS);
        }
      }
      if (s.blend > 0) s.blend = Math.max(0, s.blend - dt / CROSSFADE_S);

      // Dot size
      s.dotTimer -= dt;
      if (s.dotTimer <= 0) { s.dotTgt = 0.02 + Math.random() * 0.23; s.dotTimer = 2 + Math.random() * 5; }
      s.dotSz = THREE.MathUtils.lerp(s.dotSz, s.dotTgt, dt * 0.8);

      // Shape
      s.shpTimer -= dt;
      if (s.shpTimer <= 0) { s.shpTgt = Math.random() * 3; s.shpTimer = 3 + Math.random() * 6; }
      s.shpT = THREE.MathUtils.lerp(s.shpT, s.shpTgt, dt * 0.6);

      // Direction (shortest-arc lerp)
      s.dirTimer -= dt;
      if (s.dirTimer <= 0) { s.dirTgt = Math.random() * Math.PI * 2; s.dirTimer = 3 + Math.random() * 5; }
      let diff = s.dirTgt - s.dirA;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      s.dirA += diff * Math.min(1, dt * 2);

      // Phase (user speed mode)
      let spd = DBG_FLOOR.baseSpeed;
      if (DBG_FLOOR.speedMode === "user" && pi.sector === i) {
        spd = DBG_FLOOR.baseSpeed * (1 + DBG_FLOOR.speedGain * Math.pow(pi.t, DBG_FLOOR.speedExp));
      }
      s.phase += dt * spd;
    }

    // Pack into vec4 uniforms (mutate in-place, no GC)
    const pack = (u: THREE.IUniform, fn: (s: SS) => number) =>
      (u.value as THREE.Vector4).set(fn(ss[0]), fn(ss[1]), fn(ss[2]), fn(ss[3]));

    pack(U.uTypeA, s => s.typeA);
    pack(U.uTypeB, s => s.typeB);
    pack(U.uBlend, s => s.blend);
    pack(U.uDotSz, s => s.dotSz);
    pack(U.uShpT,  s => s.shpT);
    pack(U.uDirA,  s => s.dirA);
    pack(U.uPhase, s => s.phase);
  });

  return (
    <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[DOME_R, 128]} />
      <shaderMaterial
        vertexShader={FLOOR_VERT}
        fragmentShader={FLOOR_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
}
