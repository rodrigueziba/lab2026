"use client";
// F2: Audio-reactive sky visualizer — login GLSL rendered offscreen to a WebGLRenderTarget,
// then projected onto an exterior sphere with zenith polar UV mapping.
// Covers the entire sky dome without the black-disk artefact of direct sphere UV mapping.
// Mounted by ExperienceDome only after alight:visualizer-activate fires.

import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_SILLAS } from "@/lib/debugConfig";
import { prepareVizAudio, stopVizAudio, getVizBands, BAND_STATE, N5_STATE } from "@/lib/vizAudio";
import { getDawnState } from "@/lib/alightStore";
import { getHazEnteredOnce, getHazBandOn } from "@/lib/haz";
import { VIZ_SUN_AZ_DEG, VIZ_SUN_EL_DEG } from "@/lib/vizSunState";
import VizPanorama from "./VizPanorama";
import DomeSky from "@/app/alight/dome/DomeSky";

const DOME_R = 28;
const LOGIN_VISUALIZER_ENABLED = false; // N3: sky + sun replace /login FBO on dome sphere
const SUN_SPHERE_ENABLED = false;       // T2: old emissive sphere + halo — disabled, shader handles sun

// T2: cubic ease-out — module level, no per-frame allocation
const _easeOut3 = (t: number): number => 1 - (1 - t) ** 3;

// N3: Sun azimuth/elevation — imported from vizSunState for session stability.
// U1: elevation range updated to 8°–20° (VIZ_SUN_EL_DEG).
const _SUN_AZ_DEG = VIZ_SUN_AZ_DEG;
const _SUN_EL_DEG = VIZ_SUN_EL_DEG;

// ── Login GLSL rendered to offscreen FBO ─────────────────────────────────────
// Renders to a flat quad (PlaneGeometry 2×2) with an orthographic camera.
// UVs match exactly what /login uses on its TubeGeometry, so the result is identical.
const VIZ_VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWP;
  varying vec3 vWN;
  void main() {
    vUv = uv;
    vWN = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWP = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const VIZ_FRAG = /* glsl */`
  uniform float uTime;
  uniform vec3  uTop, uBot;
  uniform float uAngle, uIntensity, uDepth, uRefStr;
  uniform float uShowRings, uRingCount, uGhost, uMatrix;
  uniform sampler2D uMatTex;
  uniform float uSub, uBass, uLM, uMid, uHM, uPres, uBril, uAir, uBeat, uRMS;
  uniform float uLayerLines, uLayerDots, uLayerMatrix, uLayerRings;
  uniform float uLayerReflection, uLayerGhost, uLayerCeiling;
  varying vec2 vUv;
  varying vec3 vWP, vWN;

  float rand(float n) { return fract(sin(n) * 43758.5453123); }

  vec3 line(vec3 col, float uvP, float tgt, float w, float uvS, float id, float t, float spd, bool ring) {
    float sh  = ring ? tgt : tgt + (rand(id*8.2)-.5)*.12;
    float wt  = exp(-pow((uvP-sh)*w*(0.1+rand(id*4.5)*12.), 2.));
    float sp  = (0.5+rand(id)*4.)*spd, dir = rand(id*2.1)>.5?1.:-1.;
    float sc  = ring ? floor(2.+rand(id*1.3)*6.) : .05+rand(id*1.3)*30.;
    float ph  = rand(id*1.7)*20.;
    float pos = fract(uvS*sc+t*sp*dir+ph);
    float len = .01+rand(id*3.4)*.93, fd = .01+rand(id*7.1)*.08;
    float mask= smoothstep(0.,fd,pos)*smoothstep(len+fd,len,pos);
    float bPos= fract(uvS*sc*.1+t*sp*.1*dir+ph*2.);
    float bMask=smoothstep(0.,.1,bPos)*smoothstep(.9,.8,bPos);
    return col*wt*(0.25*bMask+0.85*mask);
  }
  vec3 dot3(vec3 col, float uvP, float tgt, float w, float uvS, float id, float t, float spd) {
    float wt  = exp(-pow((uvP-tgt)*w*(0.5+rand(id*6.1)*3.), 2.));
    float sp  = (2.+rand(id)*4.)*spd, dir = rand(id*2.1)>.5?1.:-1.;
    float pos = fract(uvS*(10.+rand(id*1.3)*80.)+t*sp*dir+rand(id*1.7)*10.);
    float len = .001+rand(id*3.4)*.015;
    return col*wt*smoothstep(0.,.005,pos)*smoothstep(len+.005,len,pos)*4.;
  }
  vec3 ghost(float h, float uvX, float t, float seed) {
    float sc   = uvX*12.+t*.3*(rand(seed)>.5?1.:-1.);
    float idX  = floor(sc), lx = fract(sc);
    float hasP = step(.7, rand(idX+seed)), idY = floor(h*80.);
    float hasB = step(.3, rand(idY*15.+idX));
    float pulse= pow(sin(t*1.2+rand(idX)*10.)*.5+.5, 2.);
    float mx   = smoothstep(0.,.2,lx)*smoothstep(1.,.8,lx);
    vec3 tc    = mix(vec3(.2,.7,1.), vec3(1.,.3,.7), rand(idX*1.1));
    vec3 panel = tc*hasP*hasB*mx*pulse*.35;
    float wave = pow(sin(uvX*5.+t*.5+seed)*sin(h*10.-t*.4+seed)*.5+.5, 5.);
    vec3 wash  = mix(vec3(.1,.5,1.), vec3(.8,.1,.5), rand(seed*2.))*wave*.03;
    return (panel+wash)*uGhost;
  }
  vec3 rightSide(float h, float uvX, float t) {
    vec3 c = vec3(0.);
    float bB=1.+uBass*2.+uBeat*1.5, mB=1.+uMid*1.5+uHM, hB=1.+uPres*1.2+uBril*.8;
    float sB=2.+uBass*3., sM=2.+uMid*2.5, sH=2.+uPres*4.;
    c+=line(vec3(.2,.4,1.)*bB,h,.35,60.,uvX*100.,10.,t,sB,false);
    c+=line(vec3(1.,.2,.7)*bB,h,.28,300.,uvX*100.,11.,t,sB,false);
    c+=line(vec3(1.,.6,.1)*bB,h,.20,120.,uvX*100.,12.,t,sB,false);
    c+=line(vec3(0.,.8,1.)*mB,h,.10,40.,uvX*100.,13.,t,sM,false);
    c+=line(vec3(1.,.9,.2)*mB,h,.02,500.,uvX*100.,14.,t,sM,false);
    c+=line(vec3(.1,.9,.3)*mB,h,-.08,150.,uvX*100.,15.,t,sM,false);
    c+=line(vec3(1.,.4,0.)*hB,h,-.18,80.,uvX*100.,16.,t,sH,false);
    c+=line(vec3(1.,.1,.1)*hB,h,-.28,400.,uvX*100.,17.,t,sH,false);
    float bf=.5+uBeat*2.;
    c+=line(vec3(1.),h,.28,450.,uvX*100.,18.,t,2.5+uBeat*5.,false)*bf;
    c+=line(vec3(1.),h,.10,800.,uvX*100.,19.,t,2.5+uBeat*5.,false)*bf;
    c+=dot3(vec3(1.,.5,1.)*mB,h,.30,400.,uvX*100.,80.,t,1.5+uMid*2.)*uLayerDots;
    c+=dot3(vec3(.5,1.,1.)*hB,h,.15,350.,uvX*100.,81.,t,2.5+uHM*3.)*uLayerDots;
    c+=dot3(vec3(1.,1.,.5)*mB,h,-.05,450.,uvX*100.,82.,t,2.+uLM*2.)*uLayerDots;
    c+=dot3(vec3(1.,.2,.2)*bB,h,-.20,300.,uvX*100.,83.,t,3.+uBass*4.)*uLayerDots;
    c+=ghost(h,uvX,t,112.3)*uLayerGhost; return c;
  }
  vec3 leftSide(float h, float uvX, float t) {
    vec3 c = vec3(0.);
    float bB=1.+uBass*2.+uBeat*1.5, mB=1.+uMid*1.5+uHM, hB=1.+uPres*1.2+uBril*.8;
    float sB=2.+uBass*3., sM=2.+uMid*2.5, sH=2.+uPres*4.;
    c+=line(vec3(1.,.4,0.)*bB,h,.32,70.,uvX*100.,20.,t,sB,false);
    c+=line(vec3(1.,.1,.5)*bB,h,.25,350.,uvX*100.,21.,t,sB,false);
    c+=line(vec3(.1,.6,1.)*mB,h,.15,120.,uvX*100.,22.,t,sM,false);
    c+=line(vec3(.2,.9,.4)*mB,h,.05,50.,uvX*100.,23.,t,sM,false);
    c+=line(vec3(1.,.8,0.)*mB,h,-.05,450.,uvX*100.,24.,t,sM,false);
    c+=line(vec3(1.,.2,.1)*hB,h,-.15,150.,uvX*100.,25.,t,sH,false);
    c+=line(vec3(.6,.1,1.)*hB,h,-.25,60.,uvX*100.,26.,t,sH,false);
    float bf=.5+uBeat*2.;
    c+=line(vec3(1.),h,.15,600.,uvX*100.,27.,t,2.5+uBeat*5.,false)*bf;
    c+=line(vec3(1.),h,-.05,900.,uvX*100.,28.,t,2.5+uBeat*5.,false)*bf;
    c+=dot3(vec3(1.,.8,.2)*mB,h,.28,350.,uvX*100.,90.,t,1.8+uMid*2.)*uLayerDots;
    c+=dot3(vec3(.2,.8,1.)*hB,h,.10,400.,uvX*100.,91.,t,2.2+uHM*3.)*uLayerDots;
    c+=dot3(vec3(.5,1.,.5)*mB,h,-.10,300.,uvX*100.,92.,t,1.5+uLM*2.)*uLayerDots;
    c+=dot3(vec3(1.,.4,.8)*bB,h,-.20,450.,uvX*100.,93.,t,2.7+uBass*4.)*uLayerDots;
    c+=ghost(h,uvX,t,442.1)*uLayerGhost; return c;
  }
  vec3 rings(float uvX, float uvY, float t) {
    vec3 c = vec3(0.);
    float lx = fract(uvX*uRingCount), cid = floor(uvX*uRingCount);
    float rt = fract(rand(cid)*10.);
    vec3 rc;
    if     (rt<.2) rc=vec3(1.,.2,.7)*(1.+uSub*3.);
    else if(rt<.4) rc=vec3(0.,.8,1.)*(1.+uBass*2.5);
    else if(rt<.6) rc=vec3(1.,.6,.1)*(1.+uLM*2.);
    else if(rt<.8) rc=vec3(.1,.9,.3)*(1.+uMid*2.);
    else           rc=vec3(1.,.9,.2)*(1.+uBeat*4.);
    c+=line(rc,lx,.5,60.+rand(cid)*40.,uvY,cid,t,1.+uBass*2.,true);
    return c*(rand(cid+10.)>.3?1.:0.);
  }

  void main() {
    float y  = fract(vUv.y + uAngle);
    float cy = sin(y * 6.2831853);
    float cx = cos(y * 6.2831853);
    vec3 bg  = mix(uBot, uTop, smoothstep(-.2,.5,cy)) * (1.+uSub*.5+uBeat*.3);

    vec3 st  = cx > 0. ? rightSide(cy, vUv.x, uTime) : leftSide(cy, vUv.x, uTime);

    vec3 ceil = vec3(0.);
    if (uLayerCeiling>.5 && cy>.4) {
      float hc=cy+sin(vUv.x*80.)*.005, cs=.5+uMid*2.;
      ceil+=line(vec3(.6,.8,1.),hc,.70,500.,vUv.x*100.,30.,uTime,cs,false)*.5;
      ceil+=line(vec3(.8,.9,1.)*(1.+uHM),hc,.82,800.,vUv.x*100.,31.,uTime,cs,false)*.7;
      ceil+=line(vec3(.9,.95,1.)*(1.+uPres),hc,.92,1000.,vUv.x*100.,32.,uTime,cs*1.2,false)*.9;
      ceil+=line(vec3(1.)*(1.+uBeat*2.),hc,.76,600.,vUv.x*100.,40.,uTime,3.+uBeat*5.,false)*.7;
    }
    float sm = smoothstep(.7,.1,abs(cy));
    vec3 fc  = bg + (st*uIntensity*sm*uLayerLines) + (ceil*uIntensity);

    if (uShowRings>.5 && uLayerRings>.5)
      fc += rings(vUv.x, y, uTime) * uIntensity * smoothstep(-.8,-.4,cy);

    if (uLayerMatrix>.5 && uMatrix>0.) {
      vec2  tu  = vec2(vUv.x*250., y*14.);
      float tv  = texture2D(uMatTex, tu).r;
      float sid = floor(tu.y);
      float sp  = .5+rand(sid*1.5)*1.5+uBril*3., dir = rand(sid*3.3)>.5?1.:-1.;
      float tp  = fract(vUv.x*8.+uTime*sp*dir+rand(sid*7.1)*10.);
      float trM = smoothstep(0.,.8,tp)*smoothstep(1.,.95,tp), hM = smoothstep(.95,1.,tp);
      float fl  = sin(uTime*15.+rand(floor(tu.x)+sid*100.)*20.)*.5+.5;
      vec3 mc2  = mix(vec3(0.,.9,.3), vec3(.6,1.,.8), hM);
      fc += mc2*tv*(trM*.6+hM*2.)*(0.3+0.7*fl)*(uMatrix+uAir*.5)
          * smoothstep(.8,.2,abs(cy))*uIntensity;
    }

    if (uLayerReflection>.5 && cy<-.2 && uRefStr>0.) {
      float rip = sin(vUv.x*300.-uTime*5.)*(0.03+uSub*.05)+sin(vUv.x*1000.)*.01;
      float rcx = cx+rip;
      vec3 ref  = rcx>0. ? rightSide(abs(cy),vUv.x,uTime) : leftSide(abs(cy),vUv.x,uTime);
      fc += ref*uRefStr*smoothstep(-.2,-.8,cy)*smoothstep(-1.,-.9,cy);
    }

    float ff = exp(-length(cameraPosition - vWP)*uDepth);
    float fr = max(0., dot(-vWN, normalize(cameraPosition - vWP)));
    fc *= mix(.5, 1., smoothstep(0., .8, fr));
    fc  = mix(uBot, fc, ff);

    gl_FragColor = vec4(fc, 1.0);
  }
`;

// ── Exterior sphere shaders — zenith polar UV projection ─────────────────────
// Samples the FBO texture using polar coordinates centred on the +Y axis (zenith).
// θ=0 → zenith (top of sky), θ=thetaMax → edge of texture (~10° below horizon).
const SPHERE_VERT = /* glsl */`
  varying vec3 vWorldPos;
  void main() {
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Kept for LOGIN_VISUALIZER_ENABLED re-enable — not currently used.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SPHERE_FRAG = /* glsl */`
  uniform sampler2D uVizTex;
  uniform float     uFade;
  uniform float     uThetaMax;    // radians
  uniform float     uTestPattern; // G1 debug: >0.5 paints θ/φ grid, bypasses FBO
  uniform float     uSolidTest;   // H1 Prueba A: >0.5 → solid magenta (depth/side test)
  varying vec3 vWorldPos;

  void main() {
    // H1 Prueba A: solid magenta fill — depthTest=false set from JS for this branch
    if (uSolidTest > 0.5) {
      gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
      return;
    }

    // Floor fade: smooth disappearance near y=0 (scene floor)
    float floorFade = smoothstep(-2.0, 2.0, vWorldPos.y);
    if (vWorldPos.y < -3.0) discard;

    // Polar angle from +Y (θ=0 at zenith)
    vec3  dir   = normalize(vWorldPos);
    float theta = acos(clamp(dir.y, -1.0, 1.0));
    float phi   = atan(dir.z, dir.x);

    // Discard beyond thetaMax
    float r = theta / uThetaMax;
    if (r > 1.0) discard;

    // G1 debug test pattern: shows θ/φ grid without FBO
    if (uTestPattern > 0.5) {
      float sectors = 16.0;
      float rings   = 8.0;
      float cx = mod(floor(r * rings) + floor((phi + 3.14159) / (6.28318 / sectors)), 2.0);
      vec3 baseCol = cx > 0.5 ? vec3(0.7, 0.7, 0.0) : vec3(0.1, 0.1, 0.5);
      if (r < 0.05) baseCol = vec3(1.0, 0.0, 0.0);             // red dot at zenith
      if (r > 0.85 && r < 0.93) baseCol = vec3(0.0, 1.0, 0.0); // green ring at horizon
      gl_FragColor = vec4(baseCol, uFade * floorFade);
      return;
    }

    // Zenith-centred UV: center of texture = zenith
    vec2 uv  = vec2(0.5) + 0.5 * r * vec2(cos(phi), sin(phi));
    vec4 col = texture2D(uVizTex, uv);

    gl_FragColor = vec4(col.rgb, uFade * floorFade);
  }
`;

// ── U1: Sky gradient shader — SOL/MONTAÑAS/LÍNEAS moved to VizPanorama. ──────
// Groups kept in uniforms for compat (unused ones compiled out by GLSL).
// CIELO: warm 3-stop gradient #B5432A → #E2702A → #F5B83A (U1 spec).
const PANORAMA_FRAG = /* glsl */`
  uniform float uFade;
  uniform float uTime;
  uniform vec3  uSunDir;
  uniform float uSunAngularRad;
  uniform float uSunIntensity;
  uniform float uRemoteMix;
  uniform float uStaticMix;
  uniform float uGrow0, uGrow1, uGrow2, uGrow3;
  uniform float uDawnSkyT; // U9: 0=dark sky, 1=full warm sky (replaces uGrow2 in sky section)
  uniform float uPulse0, uPulse1, uPulse2, uPulse3;
  uniform float uFlow3, uKick;
  uniform float uMtH, uMtB, uMtK, uSkyB, uSunB, uLineA;
  uniform float uSkyVis;     // U7: 0=hide warm sky, 1=show
  uniform float uSkyMagenta; // U7: 1=replace sky with magenta
  varying vec3 vWorldPos;

  float hash31(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }

  void main() {
    float floorFade = smoothstep(-2.0, 2.0, vWorldPos.y);
    if (vWorldPos.y < -3.0) discard;

    vec3  dir  = normalize(vWorldPos);
    float elev = dir.y;

    // ── Base dark sky (always — N3/R4 reference) ─────────────────────────────
    vec3 zenith    = vec3(0.03922, 0.03137, 0.07059);
    vec3 horiz     = vec3(0.10588, 0.07843, 0.14902);
    vec3 sky       = mix(horiz, zenith, smoothstep(-0.30, 0.80, elev));
    vec3 horizGlow = vec3(0.16471, 0.07843, 0.0);
    sky = mix(sky, horizGlow, 0.15 * smoothstep(0.25, 0.0, abs(elev)));

    float breath = 1.0 + 0.02 * sin(uTime * 1.2566);

    // ── Grupo 2: CIELO — warm 3-stop gradient ────────────────────────────────
    // U1 palette: zenith #B5432A, mid #E2702A, horizon #F5B83A
    // U9: driven by uDawnSkyT (0=dark, 1=full dawn) instead of uGrow2
    if (uDawnSkyT > 0.001 && uSkyVis > 0.5) {
      float skyEdge  = mix(1.20, -0.50, uDawnSkyT);
      float skyMask  = smoothstep(skyEdge - 0.10, skyEdge + 0.10, elev);
      float skyBrght = breath * (1.0 + uPulse2 * uSkyB);
      vec3 top = vec3(0.710, 0.263, 0.165); // #B5432A (zenith)
      vec3 mid = vec3(0.886, 0.439, 0.165); // #E2702A (mid)
      vec3 bot = vec3(0.961, 0.722, 0.227); // #F5B83A (horizon)
      float t  = smoothstep(-0.30, 0.80, elev);
      vec3 warmSky = mix(bot, mix(mid, top, smoothstep(0.35, 0.80, t)), t) * skyBrght;
      if (uSkyMagenta > 0.5) warmSky = vec3(1.0, 0.0, 1.0);
      sky = mix(sky, warmSky, skyMask * uDawnSkyT);
    }

    // ── N5: static interference (preserved) ──────────────────────────────────
    if (uStaticMix > 0.001) {
      float nt = floor(uTime * 15.0);
      float n  = hash31(floor(dir * 12.0) + vec3(nt * 0.11, nt * 0.07, 0.0));
      sky = mix(sky, vec3(n * 0.7 + 0.08) * vec3(1.05, 0.88, 0.55), uStaticMix * 0.38);
    }

    gl_FragColor = vec4(sky, uFade * floorFade);
  }
`;

// ── N3: Night sky shader — DISABLED in T2, kept for reference ────────────────
// N5: uRemoteMix drives image blend weight; uStaticMix drives interference noise overlay.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _DOMESKY_FRAG_DISABLED = /* glsl */`
  uniform float uFade;
  uniform float uTime;
  uniform vec3  uSunDir;
  uniform float uSunAngularRad;
  uniform float uSunIntensity;
  uniform float uRemoteMix;
  uniform float uStaticMix;
  varying vec3  vWorldPos;

  float hash31(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }

  void main() {
    float floorFade = smoothstep(-2.0, 2.0, vWorldPos.y);
    if (vWorldPos.y < -3.0) discard;

    vec3  dir  = normalize(vWorldPos);
    float elev = dir.y;

    // R4: Dark sky — #0a0812 (zenith) → #1b1426 (horizon), amber glow #2A1400 near horizon
    vec3 zenith  = vec3(0.03922, 0.03137, 0.07059);
    vec3 horiz   = vec3(0.10588, 0.07843, 0.14902);
    vec3 sky     = mix(horiz, zenith, smoothstep(-0.30, 0.80, elev));
    // Horizon amber glow: 15% of #2A1400 fades in near elev=0
    vec3 horizGlow = vec3(0.16471, 0.07843, 0.0);
    sky = mix(sky, horizGlow, 0.15 * smoothstep(0.25, 0.0, abs(elev)));

    // Sun disc + soft glow — R4: amber phosphor #FF9A1F
    float cosAngle  = dot(dir, normalize(uSunDir));
    float cosEdge   = cos(uSunAngularRad);
    float cosInner  = cos(uSunAngularRad * 0.65);
    float sunDisc   = smoothstep(cosEdge, cosInner, cosAngle);
    float sunGlow   = pow(max(0.0, cosAngle), 48.0) * 0.45;
    vec3  sunColor  = vec3(1.0, 0.60392, 0.12157);
    sky += sunColor * (sunDisc + sunGlow) * uSunIntensity;

    // N5: static interference overlay (left monolith proximity)
    if (uStaticMix > 0.001) {
      float t  = floor(uTime * 15.0);
      float n  = hash31(floor(dir * 12.0) + vec3(t * 0.11, t * 0.07, 0.0));
      vec3 staticCol = vec3(n * 0.7 + 0.08) * vec3(1.05, 0.88, 0.55);
      sky = mix(sky, staticCol, uStaticMix * 0.38);
    }

    gl_FragColor = vec4(sky, uFade * floorFade);
  }
`;

// ── Matrix canvas texture (lazy singleton) ───────────────────────────────────
let _matTex: THREE.CanvasTexture | null = null;
function getMatTex(): THREE.CanvasTexture {
  if (_matTex) return _matTex;
  const mc   = document.createElement("canvas");
  mc.width   = mc.height = 1024;
  const mctx = mc.getContext("2d")!;
  mctx.fillStyle = "#000";
  mctx.fillRect(0, 0, 1024, 1024);
  mctx.fillStyle = "#fff";
  mctx.font = "bold 44px monospace";
  mctx.textAlign = "center";
  mctx.textBaseline = "middle";
  for (let y = 24; y < 1024; y += 48)
    for (let x = 24; x < 1024; x += 48) {
      mctx.globalAlpha = 0.4 + Math.random() * 0.6;
      mctx.fillText(String.fromCharCode(0xff66 + Math.floor(Math.random() * 55)), x, y);
    }
  _matTex = new THREE.CanvasTexture(mc);
  _matTex.wrapS = _matTex.wrapT = THREE.RepeatWrapping;
  return _matTex;
}

// ── W1/W2: DomeSky wrapper — esfera de cielo centrada en la cámara ───────────
const _zeroBands = () => ({ bass: 0, lowMid: 0, highMid: 0, treble: 0 });

// W2: attack/release por grupo (SOL, MONTAÑAS, CIELO, LÍNEAS) en segundos
const _GRP_ATK = [0.015, 0.120, 0.030, 0.060];
const _GRP_REL = [0.120, 0.600, 0.300, 0.400];

function DomeSkyAnchor() {
  const groupRef = useRef<THREE.Group>(null);
  // W2: estado de energía de grupo sin allocations por frame
  const _s = useRef({ gp: [0, 0, 0, 0], kick: 0, kickSeen: false });

  const getGroupEnergy = useMemo(() => () => {
    const s = _s.current;
    return { sol: s.gp[0], mont: s.gp[1], cielo: s.gp[2], lin: s.gp[3], kick: s.kick };
  }, []);

  useFrame(({ camera }, dt) => {
    groupRef.current?.position.copy(camera.position);

    const s = _s.current;
    const assign = BAND_STATE.assignment;
    const norm   = BAND_STATE.normEnergy;

    // W2: per-group envelope — gated by bandOn, smoothed with group-specific τ
    for (let i = 0; i < 4; i++) {
      const raw    = norm[assign[i]] ?? 0;
      const gated  = getHazBandOn(i) ? raw : 0;
      const prev   = s.gp[i];
      const af = 1 - Math.exp(-dt / _GRP_ATK[i]);
      const rf = 1 - Math.exp(-dt / _GRP_REL[i]);
      s.gp[i] = gated > prev ? prev + (gated - prev) * af : prev + (gated - prev) * rf;
    }

    // W2: kick — detecta flanco de subida (BAND_STATE.kick verdadero 1 frame)
    if (BAND_STATE.kick && !s.kickSeen) { s.kick = 1.0; s.kickSeen = true; }
    if (!BAND_STATE.kick) s.kickSeen = false;
    s.kick *= Math.exp(-dt / 0.065); // τ=65ms → ~0.1 a los 150ms
  });

  return (
    <group ref={groupRef}>
      <DomeSky
        getBands={_zeroBands}
        getGroupEnergy={getGroupEnergy}
        solAmt={DBG_SILLAS.domeSolAmt}
        montAmt={DBG_SILLAS.domeMontAmt}
        cieloAmt={DBG_SILLAS.domeCieloAmt}
        linAmt={DBG_SILLAS.domeLinAmt}
        kickAmt={DBG_SILLAS.domeKickAmt}
        portalAzimuth={DBG_SILLAS.domePortalAzimuth}
        portalElevation={DBG_SILLAS.domePortalElevation}
        portalHalfFovDeg={DBG_SILLAS.domePortalHalfFovDeg}
        radius={100}
      />
    </group>
  );
}

// ── DomeVisualizer component ─────────────────────────────────────────────────
export default function DomeVisualizer() {
  // Offscreen render target — captures login shader output at vizTexSize resolution
  const renderTarget = useMemo(() => new THREE.WebGLRenderTarget(
    DBG_SILLAS.vizTexSize, DBG_SILLAS.vizTexSize,
    { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false },
  ), []);
  useEffect(() => () => renderTarget.dispose(), [renderTarget]);

  // Offscreen scene: orthographic camera + full-screen quad with login GLSL
  const { offScene, offCam } = useMemo(() => {
    const offScene = new THREE.Scene();
    const offCam   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    offCam.position.z = 1;
    return { offScene, offCam };
  }, []);

  // Login shader uniforms (for offscreen quad — renders opaque, alpha handled by sphere)
  const loginUniforms = useMemo<Record<string, THREE.IUniform>>(() => ({
    uTime:            { value: 0 },
    uTop:             { value: new THREE.Color(DBG_SILLAS.vizTopColor) },
    uBot:             { value: new THREE.Color(DBG_SILLAS.vizBottomColor) },
    uAngle:           { value: DBG_SILLAS.vizAngle },
    uIntensity:       { value: DBG_SILLAS.vizIntensity },
    uDepth:           { value: 0.001 },
    uRefStr:          { value: 0.35 },
    uShowRings:       { value: 1.0 },
    uRingCount:       { value: 10.0 },
    uGhost:           { value: DBG_SILLAS.vizGhost },
    uMatrix:          { value: DBG_SILLAS.vizMatrix },
    uMatTex:          { value: null as THREE.Texture | null },
    uSub:             { value: 0 },
    uBass:            { value: 0 },
    uLM:              { value: 0 },
    uMid:             { value: 0 },
    uHM:              { value: 0 },
    uPres:            { value: 0 },
    uBril:            { value: 0 },
    uAir:             { value: 0 },
    uBeat:            { value: 0 },
    uRMS:             { value: 0 },
    uLayerLines:      { value: 1.0 },
    uLayerDots:       { value: 1.0 },
    uLayerMatrix:     { value: 1.0 },
    uLayerRings:      { value: DBG_SILLAS.vizRings },
    uLayerReflection: { value: 1.0 },
    uLayerGhost:      { value: 1.0 },
    uLayerCeiling:    { value: 1.0 },
  }), []);

  // H1 Prueba B: log sphere geometry parameters on mount
  useEffect(() => {
    console.log("[DomeViz] sphere args:", DOME_R, 64, 32, "| scale target:", DBG_SILLAS.vizSphereScale,
      "| texSize:", DBG_SILLAS.vizTexSize, "| thetaMax°:", DBG_SILLAS.vizThetaMax);
  }, []);

  // Add quad mesh to offscreen scene, set matrix texture
  useEffect(() => {
    loginUniforms.uMatTex.value = getMatTex();
    const geo  = new THREE.PlaneGeometry(2, 2);
    const mat  = new THREE.ShaderMaterial({
      vertexShader:   VIZ_VERT,
      fragmentShader: VIZ_FRAG,
      uniforms:       loginUniforms,
    });
    const quad = new THREE.Mesh(geo, mat);
    offScene.add(quad);
    return () => { geo.dispose(); mat.dispose(); offScene.remove(quad); };
  }, [offScene, loginUniforms]);

  // N3: sun position derived from module-level random values (avoids Math.random in useMemo)
  const sunData = useMemo(() => {
    const az  = _SUN_AZ_DEG * Math.PI / 180;
    const el  = _SUN_EL_DEG * Math.PI / 180;
    const dir = new THREE.Vector3(
      Math.cos(el) * Math.cos(az),
      Math.sin(el),
      Math.cos(el) * Math.sin(az),
    ).normalize();
    console.log(`[DomeViz] N3 sun: az=${_SUN_AZ_DEG.toFixed(1)}° el=${_SUN_EL_DEG.toFixed(1)}°`);
    return { dir, pos: dir.clone().multiplyScalar(DOME_R * 0.92) };
  }, []);

  // N3: sky uniforms stored in a ref — mutable per-frame without triggering lint immutability rule.
  const skyUniformsRef = useRef<Record<string, THREE.IUniform> | null>(null);
  if (!skyUniformsRef.current) {
    skyUniformsRef.current = {
      uFade:          { value: 0 },
      uTime:          { value: 0 },
      uSunDir:        { value: sunData.dir },
      uSunAngularRad: { value: DBG_SILLAS.sunAngularDeg * Math.PI / 360 },
      uSunIntensity:  { value: DBG_SILLAS.sunIntensity },
      uRemoteMix:     { value: 0.0 },
      uStaticMix:     { value: 0.0 },
      uSkyVis:        { value: 1.0 },
      uSkyMagenta:    { value: 0.0 },
      uDawnSkyT:      { value: 0.0 }, // U9: driven by dawn sequence
      // T2: group growth
      uGrow0: { value: 0 }, uGrow1: { value: 0 }, uGrow2: { value: 0 }, uGrow3: { value: 0 },
      // T3: audio pulse + flow
      uPulse0: { value: 0 }, uPulse1: { value: 0 }, uPulse2: { value: 0 }, uPulse3: { value: 0 },
      uFlow3: { value: 0 },
      uKick:  { value: 0 },
      // T3: tunable intensities
      uMtH:   { value: DBG_SILLAS.mtHeightBoost  },
      uMtB:   { value: DBG_SILLAS.mtBrightBoost  },
      uMtK:   { value: DBG_SILLAS.kickExtraBoost },
      uSkyB:  { value: DBG_SILLAS.skyBrightBoost },
      uSunB:  { value: DBG_SILLAS.sunBrightBoost },
      uLineA: { value: DBG_SILLAS.lineAmpBoost   },
    };
  }
  const skyUniforms = skyUniformsRef.current;

  // N3: radial halo sprite texture (additive glow around sun sphere)
  const haloTex = useMemo(() => {
    const sz  = 256;
    const c   = document.createElement("canvas");
    c.width   = c.height = sz;
    const ctx = c.getContext("2d")!;
    const g   = ctx.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz / 2);
    g.addColorStop(0,    "rgba(255,220,160,0.9)");
    g.addColorStop(0.25, "rgba(255,190,100,0.5)");
    g.addColorStop(1,    "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, sz, sz);
    return new THREE.CanvasTexture(c);
  }, []);
  useEffect(() => () => haloTex.dispose(), [haloTex]);

  // Audio lifecycle — ThreeScene calls startVizAudio() on activation (gesture context).
  // This effect handles retry (user banner click) and cleanup on unmount.
  useEffect(() => {
    // N3: prepareVizAudio builds the audio graph without playing (play starts in N4 on haz entry)
    void prepareVizAudio();
    const onRetry = () => {
      void prepareVizAudio();
    };
    window.addEventListener("alight:retry-viz-audio", onRetry);
    return () => {
      stopVizAudio();
      window.dispatchEvent(new CustomEvent("alight:audio-need-gesture", { detail: { need: false } }));
      window.removeEventListener("alight:retry-viz-audio", onRetry);
    };
  }, []);

  const lastFBORef    = useRef(0);
  const meshRef       = useRef<THREE.Mesh>(null);
  const matRef        = useRef<THREE.ShaderMaterial>(null);
  const scaleRef      = useRef(1.0);
  const domeESmoothRef = useRef(0); // N4: smoothed domeEnergy — kept for compat

  // T2: grow progress per group (0→1); never allocates per frame
  const growRef = useRef([0, 0, 0, 0]);

  // T3: pulse pipeline — no allocations per frame
  // pulseGatedRef: energy after gate envelope; pulseSmoRef: extra 80ms smoothing
  const pulseGatedRef = useRef([0, 0, 0, 0]);
  const pulseSmoRef   = useRef([0, 0, 0, 0]);
  const flowRef       = useRef(0); // LÍNEAS accumulated phase
  const kickRef       = useRef(0); // kick impulse decaying to 0

  useFrame(({ gl, clock }, dt) => {
    // ── Update login shader uniforms ──────────────────────────────────────────
    const LU = loginUniforms;
    const b  = getVizBands();
    const ar = DBG_SILLAS.vizAudioReact;
    const L  = 0.12;
    const lp = THREE.MathUtils.lerp;

    LU.uSub.value  = lp(LU.uSub.value,  b.sub        * ar, L);
    LU.uBass.value = lp(LU.uBass.value, b.bass       * ar, L);
    LU.uLM.value   = lp(LU.uLM.value,   b.lowMid     * ar, L);
    LU.uMid.value  = lp(LU.uMid.value,  b.mid        * ar, L);
    LU.uHM.value   = lp(LU.uHM.value,   b.highMid    * ar, L);
    LU.uPres.value = lp(LU.uPres.value, b.presence   * ar, L);
    LU.uBril.value = lp(LU.uBril.value, b.brilliance * ar, L);
    LU.uAir.value  = lp(LU.uAir.value,  b.air        * ar, L);
    LU.uBeat.value = lp(LU.uBeat.value, b.beat       * ar, 0.25);
    LU.uRMS.value  = lp(LU.uRMS.value,  b.rms        * ar, L);

    LU.uTime.value       = clock.elapsedTime * DBG_SILLAS.vizSpeed;
    LU.uTop.value.set(DBG_SILLAS.vizTopColor);
    LU.uBot.value.set(DBG_SILLAS.vizBottomColor);
    LU.uIntensity.value  = DBG_SILLAS.vizIntensity + b.rms * ar * 0.8;
    LU.uGhost.value      = DBG_SILLAS.vizGhost;
    LU.uMatrix.value     = DBG_SILLAS.vizMatrix;
    LU.uLayerRings.value = DBG_SILLAS.vizRings;
    LU.uAngle.value      = DBG_SILLAS.vizAngle;

    // ── Render login shader to FBO (disabled in N3; flag re-enables) ────────────
    if (LOGIN_VISUALIZER_ENABLED) {
      const now = performance.now();
      if (now - lastFBORef.current >= 16.0) {
        lastFBORef.current = now;
        gl.setRenderTarget(renderTarget);
        gl.render(offScene, offCam);
        gl.setRenderTarget(null);
      }
    }

    // ── Update sky uniforms (N3 base + T2 grow + T3 audio) ───────────────────
    const SU = skyUniforms;
    SU.uFade.value      = Math.min(1, SU.uFade.value + dt / (DBG_SILLAS.vizFadeMs / 1000));
    SU.uTime.value      = clock.elapsedTime;
    SU.uSunIntensity.value  = DBG_SILLAS.sunIntensity; // breathing now in shader
    SU.uSunAngularRad.value = DBG_SILLAS.sunAngularDeg * Math.PI / 360;
    // N5: proximity-driven image blend + static interference
    SU.uRemoteMix.value = N5_STATE.leftProximity;
    SU.uStaticMix.value = N5_STATE.leftProximity * DBG_SILLAS.staticMixMax;
    // T3 intensity knobs (live from debug)
    SU.uMtH.value   = DBG_SILLAS.mtHeightBoost;
    SU.uMtB.value   = DBG_SILLAS.mtBrightBoost;
    SU.uMtK.value   = DBG_SILLAS.kickExtraBoost;
    SU.uSkyB.value      = DBG_SILLAS.skyBrightBoost;
    SU.uSunB.value      = DBG_SILLAS.sunBrightBoost;
    SU.uLineA.value     = DBG_SILLAS.lineAmpBoost;
    SU.uSkyVis.value    = DBG_SILLAS.u7VisSky     ? 1.0 : 0.0;
    SU.uSkyMagenta.value = DBG_SILLAS.u7MagentaIdx === 4 ? 1.0 : 0.0;
    // U9: dawn sky progress — replaces uGrow2 in sky gradient section
    { const ds = getDawnState();
      SU.uDawnSkyT.value = ds.phase === 'completo' ? 1.0
        : ds.phase === 'amanecer' ? THREE.MathUtils.clamp((clock.elapsedTime - ds.startT) / DBG_SILLAS.amanecerDurS, 0, 1)
        : 0.0; }

    // ── T2: group growth ──────────────────────────────────────────────────────
    const growS = DBG_SILLAS.vizGrowS;
    for (let i = 0; i < 4; i++) {
      if (getHazEnteredOnce(i) && growRef.current[i] < 1) {
        growRef.current[i] = Math.min(1, growRef.current[i] + dt / growS);
      }
    }
    const g0 = DBG_SILLAS.vizGrowForce0 >= 0 ? DBG_SILLAS.vizGrowForce0 : growRef.current[0];
    const g1 = DBG_SILLAS.vizGrowForce1 >= 0 ? DBG_SILLAS.vizGrowForce1 : growRef.current[1];
    const g2 = DBG_SILLAS.vizGrowForce2 >= 0 ? DBG_SILLAS.vizGrowForce2 : growRef.current[2];
    const g3 = DBG_SILLAS.vizGrowForce3 >= 0 ? DBG_SILLAS.vizGrowForce3 : growRef.current[3];
    SU.uGrow0.value = _easeOut3(g0);
    SU.uGrow1.value = _easeOut3(g1);
    SU.uGrow2.value = _easeOut3(g2);
    SU.uGrow3.value = _easeOut3(g3);

    // ── T3: pulse pipeline ────────────────────────────────────────────────────
    const atkA = Math.min(1, dt / (DBG_SILLAS.pulseAttackMs / 1000));
    const decA = Math.min(1, dt / (DBG_SILLAS.pulseDecayMs  / 1000));
    const smoA = Math.min(1, dt / (DBG_SILLAS.pulseSmoothMs / 1000));
    const sims = [DBG_SILLAS.simPulse0, DBG_SILLAS.simPulse1, DBG_SILLAS.simPulse2, DBG_SILLAS.simPulse3];
    for (let i = 0; i < 4; i++) {
      const bandIdx  = BAND_STATE.assignment[i];
      const rawE     = BAND_STATE.normEnergy[bandIdx] ?? 0; // U2: AGC-normalized
      const sim      = sims[i];
      const energy   = sim > 0 ? sim : rawE;
      const gate     = getHazBandOn(i);
      const alpha    = gate ? atkA : decA;
      const target   = gate ? energy : 0;
      pulseGatedRef.current[i] += (target - pulseGatedRef.current[i]) * alpha;
      pulseSmoRef.current[i]   += (pulseGatedRef.current[i] - pulseSmoRef.current[i]) * smoA;
    }
    SU.uPulse0.value = pulseSmoRef.current[0];
    SU.uPulse1.value = pulseSmoRef.current[1];
    SU.uPulse2.value = pulseSmoRef.current[2];
    SU.uPulse3.value = pulseSmoRef.current[3];

    // Kick impulse — U2: fires on any kick detection (all active groups flash)
    if (BAND_STATE.kick) kickRef.current = 1.0;
    kickRef.current = Math.max(0, kickRef.current - dt / (DBG_SILLAS.kickDecayMs / 1000));
    SU.uKick.value = kickRef.current;

    // LÍNEAS flow accumulation: idle at idleFlow, energetic at 1 + lineSpeedBoost
    const FLOW_BASE = Math.PI * 2; // U5: idleFlow + lineSpeedBoost are in rev/s; ×2π → rad/s
    flowRef.current += dt * FLOW_BASE * (DBG_SILLAS.idleFlow + pulseSmoRef.current[3] * DBG_SILLAS.lineSpeedBoost);
    SU.uFlow3.value = flowRef.current;

    // N4: keep domeESmoothRef updated (still used by BAND_STATE.domeEnergy consumer checks)
    domeESmoothRef.current += (BAND_STATE.domeEnergy - domeESmoothRef.current) * Math.min(1, dt * 4);

    // H1 Prueba A: when vizSolidTest is on, override depth/side/renderOrder for diagnostics
    if (matRef.current && meshRef.current) {
      const solid = DBG_SILLAS.vizSolidTest;
      const wantDepthTest = !solid;
      const wantSide      = solid ? THREE.DoubleSide : THREE.BackSide;
      if (matRef.current.depthTest !== wantDepthTest || matRef.current.side !== wantSide) {
        matRef.current.depthTest = wantDepthTest;
        matRef.current.side      = wantSide;
        matRef.current.needsUpdate = true;
      }
      meshRef.current.renderOrder = solid ? 10 : -1;
    }

    // G1: scale animation 1.0 → vizSphereScale over vizFadeMs (gives "dome expansion" effect)
    const targetScale = DBG_SILLAS.vizSphereScale;
    if (meshRef.current && scaleRef.current < targetScale) {
      const rate = (targetScale - 1.0) / (DBG_SILLAS.vizFadeMs / 1000);
      scaleRef.current = Math.min(targetScale, scaleRef.current + rate * dt);
      meshRef.current.scale.setScalar(scaleRef.current);
    }
  });

  return (
    <>
      {/* Sky dome sphere — renderOrder=-1 renders behind dome shell */}
      <mesh ref={meshRef} renderOrder={-1}>
        <sphereGeometry args={[DOME_R, 64, 32]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={SPHERE_VERT}
          fragmentShader={PANORAMA_FRAG}
          uniforms={skyUniforms}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* T2: SUN_SPHERE_ENABLED=false — sun is now drawn inside PANORAMA_FRAG shader */}
      {SUN_SPHERE_ENABLED && (
        <mesh position={sunData.pos}>
          <sphereGeometry args={[0.9, 12, 8]} />
          <meshBasicMaterial color="#FF9A1F" toneMapped={false} />
        </mesh>
      )}
      {SUN_SPHERE_ENABLED && (
        <sprite position={sunData.pos} scale={[7, 7, 1]}>
          <spriteMaterial
            map={haloTex}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      )}
      {/* U1/W1: panorama — VizPanorama (SVG layers) or DomeSky shader depending on flag */}
      {DBG_SILLAS.usarDomoShader
        ? <DomeSkyAnchor />
        : <VizPanorama growRef={growRef} pulseRef={pulseSmoRef} flowRef={flowRef} kickRef={kickRef} />
      }
    </>
  );
}
