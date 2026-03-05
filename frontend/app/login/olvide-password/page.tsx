'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, Loader2 } from 'lucide-react';

// Importaciones de Three.js
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader.js';

export default function OlvidePasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  
  const mountRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) setSent(true);
      else alert("No se pudo enviar el correo. Verifica el email.");
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // --- Efecto Three.js ---
  useEffect(() => {
    if (window.innerWidth < 768 || !mountRef.current) return;

    const currentMount = mountRef.current;

    const params = {
      warpDrive: false,
      speed: 0.2,
      cameraOffsetY: 3.0,
      angleOffset: -0.25,
      topColor: '#0a198c',
      bottomColor: '#11133b',
      bloomStrength: 1.0,
      bloomRadius: 0.2,
      bloomThreshold: 0.15,
      lightIntensity: 1.2,
      depthFade: 0.001,
      showRings: true,
      ringCount: 10.0,
      rgbShiftAmount: 0.001,
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
      { top: '#0a198c', bottom: '#11133b' },
      { top: '#004d1a', bottom: '#001a08' },
      { top: '#4a0072', bottom: '#1a0029' },
      { top: '#801300', bottom: '#2b0600' },
      { top: '#004059', bottom: '#00141c' } 
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
      
      tubeMaterial.uniforms.uTopColor.value.set(newColors.top);
      tubeMaterial.uniforms.uBottomColor.value.set(newColors.bottom);
      if (scene.fog) {
          scene.fog.color.set(newColors.top);
      }
    };

    // --- Control de Velocidad con la Rueda del Mouse (Scroll) ---
    const onWheel = (e: WheelEvent) => {
      const scrollSensibility = 0.0015;
      params.speed -= e.deltaY * scrollSensibility;
      params.speed = Math.max(0.02, Math.min(params.speed, 5.0));
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

      tubeMaterial.uniforms.uTime.value = time;

      const targetSpeed = params.warpDrive ? 1.2 : params.speed;
      const targetFOV = params.warpDrive ? 130 : 85;
      const targetRGB = params.warpDrive ? 0.008 : params.rgbShiftAmount;
      const targetBloom = params.warpDrive ? 2.5 : params.bloomStrength;

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

      {/* Contenido Condicional (Mantenemos el fondo siempre activo) */}
      <div className="relative z-10 w-full max-w-md">
        {sent ? (
          // UI de Éxito
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 p-8 rounded-3xl shadow-2xl text-center">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
               <Mail size={32}/>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">¡Correo Enviado!</h2>
            <p className="text-slate-400 mb-6">Revisa tu bandeja de entrada. Hemos enviado un enlace para restablecer tu contraseña.</p>
            <Link href="/login" className="text-blue-400 font-bold hover:text-blue-300">Volver al Login</Link>
          </div>
        ) : (
          // UI del Formulario
          <>
            <Link href="/login" className="flex items-center gap-2 text-slate-400 mb-8 font-bold text-sm hover:text-white transition-colors"><ArrowLeft size={16}/> Volver</Link>
            
            <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 p-8 rounded-3xl shadow-2xl">
               <h1 className="text-3xl font-black text-white mb-2">Recuperar Cuenta</h1>
               <p className="text-slate-400 mb-8">Ingresa tu email y te enviaremos las instrucciones.</p>

               <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2 relative">
                     <label className="text-xs font-bold text-slate-500 uppercase">Tu Email</label>
                     <input 
                       type="email" 
                       required 
                       value={email}
                       onChange={(e) => setEmail(e.target.value)}
                       className="w-full bg-slate-950/80 border border-slate-800 p-4 rounded-xl text-white focus:border-orange-500 focus:bg-slate-950 focus:outline-none transition-all"
                       placeholder="ejemplo@email.com"
                     />
                  </div>
                  <button disabled={loading} className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 py-4 rounded-xl text-white font-bold flex justify-center items-center gap-2 shadow-lg shadow-orange-900/30 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                     {loading && <Loader2 className="animate-spin"/>} Enviar Instrucciones
                  </button>
               </form>
            </div>
          </>
        )}
      </div>
      
    </div>
  );
}