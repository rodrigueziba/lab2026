"use client";
// R4: Post-proceso retro. Componente R3F — montar dentro del <Canvas>.
// La lógica de composer vive aquí; lib/retro/composer.ts queda como legado.

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer }  from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass }      from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass }      from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass }      from "three/addons/postprocessing/OutputPass.js";
import { Pass }            from "three/addons/postprocessing/Pass.js";
import { CAPA_UI, CAPA_UI_ESTADO } from "@/lib/retro/capaUI";
import { RetroCRTShader, CRT_UNIFORMS } from "@/lib/retro/retroCRT";
import { DBG_RETRO_FX, DBG_FLASH, DBG_DIA, DBG_RENDIMIENTO } from "@/lib/debugConfig";
import { DIA } from "@/lib/cicloDia"; // Z48
import { flashBoost, FLASH_STATE, medicionFlashLista, medirPicoFlash } from "@/lib/curtainFlash";
import { createFlashBlowoutMaterial } from "@/lib/retro/flashBlowout";
import { RETRO_FLAGS } from "@/lib/retro/retroFlags";
import { SMAAPass }        from "three/addons/postprocessing/SMAAPass.js";    // Z69: ANTIALIAS_MODO "smaa" (se crea al elegirlo)
import { BloomLigeroPass } from "@/lib/retro/bloomLigero";                     // Z69
import { PaseFinalPass }   from "@/lib/retro/paseFinal";                       // Z69
import { E_GPU, medirIni, medirFin } from "@/lib/gpuPases";                    // Z69

const QUALITY_BLOOM_SCALE: Record<string, number> = {
  low: 0.25, medium: 0.5, high: 1.0,
};
const CURVE_ANIM_MS = 400;

// Z17: pase de la interfaz del domo cercano. Dibuja SOLO la capa CAPA_UI sobre el resultado de
// la escena, con el depth buffer limpio (depthTest normal entre los elementos de la interfaz,
// sin mezclarse con sillas/piso/cúpula). Va antes del bloom y del CRT → el CRT se aplica igual.
// Si no hay nada en la capa, no hace nada. Sin allocations por frame.
class CapaUIPass extends Pass {
  private readonly escena: THREE.Scene;
  private readonly camara: THREE.Camera;
  constructor(escena: THREE.Scene, camara: THREE.Camera) {
    super();
    this.escena = escena; this.camara = camara;
    this.needsSwap = false;               // dibuja encima del mismo buffer que dejó el RenderPass
  }
  render(renderer: THREE.WebGLRenderer, _w: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    if (!CAPA_UI_ESTADO.activa) return;
    const cam = this.camara, esc = this.escena;
    const mascara = cam.layers.mask, auto = renderer.autoClear, fondo = esc.background;
    cam.layers.set(CAPA_UI);
    renderer.autoClear = false;
    esc.background = null;                // que no se vuelva a dibujar/limpiar el fondo
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    renderer.clearDepth();
    renderer.render(esc, cam);
    esc.background = fondo;
    renderer.autoClear = auto;
    cam.layers.mask = mascara;
  }
}
// G2: ShaderPass CLONA los uniforms que recibe (UniformsUtils.clone), así que lo que
// se escribía en CRT_UNIFORMS nunca llegaba al shader. Estos se reconectan al objeto
// compartido (los del destello/glare siempre; el resto solo con DBG_RETRO_FX.crtUniformsVivos).
const CRT_FLASH_KEYS = [
  "uFlash", "uFlashColor", "uFlashGlow", "uFlashScanMax", "uFlashVigAten", "uFlashCapMax",
  "uGlare", "uGlareCA", "uFlashHDR", "uHdrClamp", "uGlareColor", "uFlashBorde",
] as const;

// Z69: tiempo de GPU por pase (lib/gpuPases; no hace nada si DBG_RENDIMIENTO.GPU_POR_PASE está apagado).
// Se envuelve el render de la instancia una vez al crear el pase (sin allocations por frame).
function envolverGpu(p: Pass, e: number): void {
  const orig = p.render.bind(p);
  p.render = (r: THREE.WebGLRenderer, w: THREE.WebGLRenderTarget, rb: THREE.WebGLRenderTarget, dt: number, m: boolean) => {
    medirIni(e);
    try { orig(r, w, rb, dt, m); } finally { medirFin(); }
  };
}

export default function RetroPostFX() {
  const { gl, scene, camera, size } = useThree();
  const dpr = useThree(s => s.viewport.dpr);   // Z66: el composer sigue al DPR (resolución adaptativa)

  const composerRef  = useRef<EffectComposer | null>(null);
  const crtPassRef   = useRef<ShaderPass | null>(null);
  const bloomRef     = useRef<UnrealBloomPass | null>(null);
  const blowoutRef   = useRef<ShaderPass | null>(null); // G2
  const outputRef    = useRef<OutputPass | null>(null); // Z66: interruptor de rendimiento
  const ligeroRef    = useRef<BloomLigeroPass | null>(null); // Z69
  const finalRef     = useRef<PaseFinalPass | null>(null);   // Z69
  const smaaRef      = useRef<SMAAPass | null>(null);        // Z69 (se crea la primera vez que se elige SMAA)
  const colorRef     = useRef({ flash: "", glare: "" }); // G2: último color aplicado (sin parsear por frame)
  const blowoutCompiled = useRef(false); // G2
  const curveBaseRef = useRef(0.06);
  const curveTarget  = useRef(0.06);
  const curveStart   = useRef(0.06);
  const curveAnimT0  = useRef(-1);

  useEffect(() => {
    if (!RETRO_FLAGS.enabled) return;

    const w = size.width, h = size.height;
    const bloomScale = QUALITY_BLOOM_SCALE[RETRO_FLAGS.quality] ?? 0.5;

    const composer = new EffectComposer(gl);
    const renderPass = new RenderPass(scene, camera);
    const capaUI = new CapaUIPass(scene, camera);
    composer.addPass(renderPass);
    composer.addPass(capaUI); // Z17: interfaz del domo, antes del bloom y del CRT

    const bloom = new UnrealBloomPass(
      new THREE.Vector2(w * bloomScale, h * bloomScale),
      DBG_RETRO_FX.bloomIntensity, 0.5, DBG_RETRO_FX.bloomThreshold,
    );
    composer.addPass(bloom);
    bloomRef.current = bloom;
    // Z69: bloom liviano (BLOOM_OPTIMIZADO): escala y niveles propios; el Unreal de arriba queda para comparar
    const ligero = new BloomLigeroPass(DBG_RENDIMIENTO.BLOOM_ESCALA, DBG_RENDIMIENTO.BLOOM_NIVELES,
      DBG_RETRO_FX.bloomIntensity, 0.5, DBG_RETRO_FX.bloomThreshold);
    composer.addPass(ligero);
    ligeroRef.current = ligero;

    const crt = new ShaderPass({
      uniforms: {
        tDiffuse:   { value: null as THREE.Texture | null },
        uTime:      CRT_UNIFORMS.uTime,
        uRes:       CRT_UNIFORMS.uRes,
        uCurve:     CRT_UNIFORMS.uCurve,
        uScan:      CRT_UNIFORMS.uScan,
        uScanCount: CRT_UNIFORMS.uScanCount,
        uCA:        CRT_UNIFORMS.uCA,
        uGrain:     CRT_UNIFORMS.uGrain,
        uVig:       CRT_UNIFORMS.uVig,
        uWobble:    CRT_UNIFORMS.uWobble,
        uTint:      CRT_UNIFORMS.uTint,
        uLift:      CRT_UNIFORMS.uLift,
        uComfort:   CRT_UNIFORMS.uComfort,
        uFlash:      CRT_UNIFORMS.uFlash,      // F2
        uFlashColor: CRT_UNIFORMS.uFlashColor, // F2
        uFlashGlow:  CRT_UNIFORMS.uFlashGlow,  // F2
        uFlashScanMax: CRT_UNIFORMS.uFlashScanMax, // F3
        uFlashVigAten: CRT_UNIFORMS.uFlashVigAten, // F3
        uFlashCapMax:  CRT_UNIFORMS.uFlashCapMax,  // F3
        uGlare:        CRT_UNIFORMS.uGlare,        // G1
        uGlareCA:      CRT_UNIFORMS.uGlareCA,      // G1
        uFlashHDR:     CRT_UNIFORMS.uFlashHDR,     // G2
        uHdrClamp:     CRT_UNIFORMS.uHdrClamp,     // G2
        uGlareColor:   CRT_UNIFORMS.uGlareColor,   // G2
        uFlashBorde:   CRT_UNIFORMS.uFlashBorde,   // G3
      },
      vertexShader:   RetroCRTShader.vertexShader,
      fragmentShader: RetroCRTShader.fragmentShader,
    });
    // G2: reconectar al objeto compartido (antes de la primera compilación; material.uniforms === crt.uniforms)
    {
      const dst = crt.uniforms as Record<string, THREE.IUniform>;
      const src = CRT_UNIFORMS as unknown as Record<string, THREE.IUniform>;
      const keys: readonly string[] = DBG_RETRO_FX.crtUniformsVivos
        ? Object.keys(src).filter(k => k !== "tDiffuse")
        : CRT_FLASH_KEYS;
      for (const k of keys) dst[k] = src[k];
    }
    composer.addPass(crt);
    const output = new OutputPass();
    composer.addPass(output);
    outputRef.current = output;
    // Z69: pase final fusionado (PASES_FUSIONADOS): bloom + CRT + salida + FXAA en un pase; comparte los uniforms del CRT
    const final = new PaseFinalPass(crt.uniforms as Record<string, THREE.IUniform>);
    composer.addPass(final);
    finalRef.current = final;
    // G2: blow-out final tras ACES + sRGB (solo habilitado con uBlowout > 0).
    // Arranca habilitado para que su shader compile en el primer frame (uBlowout 0 → imagen idéntica)
    // y no al disparar el destello.
    const blowout = new ShaderPass(createFlashBlowoutMaterial());
    blowoutCompiled.current = false;
    composer.addPass(blowout);
    blowoutRef.current = blowout;
    // Z69: medición por pase (no-op con GPU_POR_PASE apagado)
    envolverGpu(renderPass, E_GPU.escena); envolverGpu(capaUI, E_GPU.escena);
    envolverGpu(bloom, E_GPU.bloom); envolverGpu(ligero, E_GPU.bloom);
    envolverGpu(crt, E_GPU.crt); envolverGpu(output, E_GPU.salida);
    envolverGpu(final, E_GPU.final); envolverGpu(blowout, E_GPU.destello);
    aplicarPases(composer, bloom, ligero, crt, output, final, null);   // estado inicial antes del primer cuadro

    composer.setSize(w, h);
    CRT_UNIFORMS.uRes.value.set(w * gl.getPixelRatio(), h * gl.getPixelRatio());
    gl.toneMappingExposure = DBG_RETRO_FX.toneExposure;

    composerRef.current = composer;
    crtPassRef.current  = crt;
    curveBaseRef.current = CRT_UNIFORMS.uCurve.value;

    const origRender = gl.render.bind(gl) as typeof gl.render;
    const overriddenRender = (_scene: THREE.Scene, _camera: THREE.Camera) => {
      gl.render = origRender;
      composerRef.current?.render();
      // G2: medición real del pico — mismo frame que se acaba de dibujar en pantalla
      if (medicionFlashLista(performance.now())) {
        gl.setRenderTarget(null);
        medirPicoFlash(gl.getContext());
      }
      gl.render = overriddenRender;
    };
    gl.render = overriddenRender;

    return () => {
      gl.render = origRender;
      for (const p of composer.passes) p.dispose(); // G2: materiales/quads de los pases
      composer.dispose();
      composerRef.current = null;
      crtPassRef.current  = null;
      bloomRef.current    = null;
      blowoutRef.current  = null;
      outputRef.current   = null;
      ligeroRef.current   = null;   // Z69 (sus targets y materiales se liberan con el resto de los pases)
      finalRef.current    = null;
      smaaRef.current     = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  useEffect(() => {
    if (!composerRef.current) return;
    // Z66: setPixelRatio también: el EffectComposer copia el DPR del renderer al crearse y no lo vuelve a leer
    // (sus render targets y el bloom quedaban al DPR inicial si este cambiaba)
    composerRef.current.setPixelRatio(gl.getPixelRatio());
    composerRef.current.setSize(size.width, size.height);
    const pr = gl.getPixelRatio();
    CRT_UNIFORMS.uRes.value.set(size.width * pr, size.height * pr);
  }, [size, gl, dpr]);

  useEffect(() => {
    const onMode = (e: Event) => {
      const mode = (e as CustomEvent).detail?.mode as string;
      const inLectern = mode !== "none";
      curveStart.current  = CRT_UNIFORMS.uCurve.value;
      curveTarget.current = inLectern ? 0 : curveBaseRef.current;
      curveAnimT0.current = performance.now();
    };
    window.addEventListener("alight:lectern-mode", onMode);
    return () => window.removeEventListener("alight:lectern-mode", onMode);
  }, []);

  useFrame(({ gl: renderer, clock }) => {
    if (!RETRO_FLAGS.enabled) return;
    CRT_UNIFORMS.uTime.value = clock.elapsedTime;
    CRT_UNIFORMS.uComfort.value = RETRO_FLAGS.comfortMode ? 1 : 0;
    // F1: boost temporal de exposición + bloom durante el destello del telón (b=0 → valores normales)
    const b = flashBoost();
    // F2: destello diegético dentro del CRT (tope < 1 para que se vea grano/scanlines sobre el blanco)
    // G1: uFlash sale de la opacidad (el boost de bloom/exposición ya no es igual a ella)
    const op = FLASH_STATE.fase === "inactivo" ? 0 : FLASH_STATE.opacidad;
    // G3: perilla maestra. uFlash × I escala en el shader la mezcla a blanco, scanlines
    // (uScan → FLASH_SCAN_MAX), viñeta (VIG_ATEN × I), tinte, tope, borde y blow-out (BLOWOUT × I).
    const I = Math.max(0, Math.min(1, DBG_FLASH.FLASH_INTENSIDAD));
    CRT_UNIFORMS.uFlash.value     = DBG_FLASH.FLASH_OVERLAY_DOM ? 0 : Math.min(op, DBG_FLASH.FLASH_CRT_MAX) * I;
    CRT_UNIFORMS.uGlare.value     = DBG_FLASH.FLASH_OVERLAY_DOM ? 0 : FLASH_STATE.glare; // G1
    CRT_UNIFORMS.uGlareCA.value   = DBG_FLASH.FLASH_GLARE_ABERRACION;                   // G1
    CRT_UNIFORMS.uFlashGlow.value = DBG_FLASH.FLASH_GLOW;
    CRT_UNIFORMS.uFlashScanMax.value = DBG_FLASH.FLASH_SCAN_MAX;  // F3
    CRT_UNIFORMS.uFlashVigAten.value = DBG_FLASH.FLASH_VIG_ATEN;  // F3
    CRT_UNIFORMS.uFlashCapMax.value  = DBG_FLASH.FLASH_TOPE_LUM;  // F3
    CRT_UNIFORMS.uFlashHDR.value     = 1 + (Math.max(1, DBG_FLASH.FLASH_HDR) - 1) * I; // G2; G3: × intensidad
    CRT_UNIFORMS.uFlashBorde.value   = Math.max(0, DBG_FLASH.FLASH_BORDE);             // G3
    CRT_UNIFORMS.uHdrClamp.value     = Math.max(1, DBG_FLASH.FLASH_HDR_CLAMP); // G2
    // G2: colores solo cuando cambia el string (Color.set parsea → no por frame)
    if (colorRef.current.flash !== DBG_FLASH.FLASH_COLOR) {
      colorRef.current.flash = DBG_FLASH.FLASH_COLOR;
      CRT_UNIFORMS.uFlashColor.value.set(DBG_FLASH.FLASH_COLOR);
    }
    if (colorRef.current.glare !== DBG_FLASH.FLASH_GLARE_COLOR) {
      colorRef.current.glare = DBG_FLASH.FLASH_GLARE_COLOR;
      CRT_UNIFORMS.uGlareColor.value.set(DBG_FLASH.FLASH_GLARE_COLOR);
    }
    // G2: blow-out final = uFlash × FLASH_BLOWOUT; el pase solo corre mientras > 0
    // G3: uFlash ya incluye I → uBlowout = uFlash × (FLASH_BLOWOUT × I), sin escalar dos veces
    const bo = Math.max(0, Math.min(1, CRT_UNIFORMS.uFlash.value * DBG_FLASH.FLASH_BLOWOUT));
    if (blowoutRef.current) {
      const u = blowoutRef.current.uniforms;
      u.uBlowout.value    = bo;
      u.uBlowoutTex.value = DBG_FLASH.FLASH_BLOWOUT_TEXTURA;
      // primer frame: queda habilitado para compilar; después solo con bo > 0
      if (blowoutCompiled.current) blowoutRef.current.enabled = bo > 0;
      blowoutCompiled.current = true;
    }
    // G2: topes absolutos (finitos) para exposición y bloom
    // G3: multiplicador de pico = 1 + (MULT − 1) × I
    // Z48: el ciclo de día varía levemente la exposición (DIA.expo, 1 = sin cambio) mientras sigue a la escena
    const expoDia = DIA.escena && DBG_DIA.NUEVO ? DIA.expo : 1;
    const expo = DBG_RETRO_FX.toneExposure * expoDia * (1 + (DBG_FLASH.FLASH_EXPOSICION_MULT - 1) * I * b);
    renderer.toneMappingExposure = Number.isFinite(expo) ? Math.min(expo, DBG_FLASH.FLASH_EXPOSICION_TOPE) : DBG_RETRO_FX.toneExposure;
    // Z66: interruptores del panel de rendimiento (un pase deshabilitado no se ejecuta; el último habilitado va a pantalla)
    // Z69: + bloom liviano, pase final fusionado y antialiasing (aplicarPases)
    const composer = composerRef.current;
    if (composer && bloomRef.current && ligeroRef.current && crtPassRef.current && outputRef.current && finalRef.current) {
      // SMAA: se crea la primera vez que se elige (pase aparte, después de la salida ACES + sRGB)
      if (DBG_RENDIMIENTO.ANTIALIAS_MODO === "smaa" && !smaaRef.current && blowoutRef.current) smaaRef.current = crearSmaa(composer, blowoutRef.current);
      aplicarPases(composer, bloomRef.current, ligeroRef.current, crtPassRef.current, outputRef.current, finalRef.current, smaaRef.current);
    }
    const bs = DBG_RETRO_FX.bloomIntensity * (1 + (DBG_FLASH.FLASH_BLOOM_MULT - 1) * I * b);
    const fuerza = Number.isFinite(bs) ? Math.min(bs, DBG_FLASH.FLASH_BLOOM_TOPE) : DBG_RETRO_FX.bloomIntensity;
    if (bloomRef.current) {
      bloomRef.current.threshold = DBG_RETRO_FX.bloomThreshold;
      bloomRef.current.strength  = fuerza;
    }
    if (ligeroRef.current) { ligeroRef.current.threshold = DBG_RETRO_FX.bloomThreshold; ligeroRef.current.strength = fuerza; }

    if (curveAnimT0.current >= 0) {
      const t = Math.min(1, (performance.now() - curveAnimT0.current) / CURVE_ANIM_MS);
      const ease = 1 - Math.pow(1 - t, 3);
      CRT_UNIFORMS.uCurve.value = curveStart.current + (curveTarget.current - curveStart.current) * ease;
      if (t >= 1) curveAnimT0.current = -1;
    }
  });

  return null;
}

// Z69: qué pases corren (por frame; sin allocations). Interruptores de Z66 (SIS) + flags de Z69:
//  BLOOM_OPTIMIZADO → bloom liviano en vez del Unreal · PASES_FUSIONADOS → pase final en vez de CRT + salida (el bloom
//  liviano deja su textura y no suma a pantalla completa) · ANTIALIAS_MODO → FXAA dentro del pase final o SMAA aparte.
function aplicarPases(
  _c: EffectComposer, unreal: UnrealBloomPass, ligero: BloomLigeroPass, crt: ShaderPass, output: OutputPass,
  final: PaseFinalPass, smaa: SMAAPass | null,
): void {
  const R = DBG_RENDIMIENTO, SIS = R.SIS;
  const fus = R.PASES_FUSIONADOS, opt = R.BLOOM_OPTIMIZADO, bOn = SIS.bloom !== false;
  unreal.enabled = bOn && !opt;
  ligero.enabled = bOn && opt;
  ligero.mezclar = !fus;
  ligero.configurar(R.BLOOM_ESCALA, R.BLOOM_NIVELES);
  crt.enabled = !fus && SIS.crt !== false;
  output.enabled = !fus && SIS.salida !== false;
  final.enabled = fus;
  const u = final.uniforms;
  u.uBloomOn.value = bOn && opt ? 1 : 0;
  u.tBloom.value = ligero.textura;
  u.uCrtOn.value = SIS.crt !== false ? 1 : 0;
  u.uSalidaOn.value = SIS.salida !== false ? 1 : 0;
  final.fijarAA(fus && R.ANTIALIAS_MODO === "fxaa");
  if (smaa) smaa.enabled = R.ANTIALIAS_MODO === "smaa";
}
/** Crea el pase SMAA y lo inserta después de la salida (o del pase final) y antes del destello: SMAA detecta bordes
 *  con umbrales pensados para colores con gamma; sobre la escena HDR lineal casi no encontraba bordes. */
function crearSmaa(c: EffectComposer, blowout: ShaderPass): SMAAPass {
  const smaa = new SMAAPass();
  const i = c.passes.indexOf(blowout);
  c.insertPass(smaa, i >= 0 ? i : c.passes.length);
  envolverGpu(smaa, E_GPU.aa);
  return smaa;
}
