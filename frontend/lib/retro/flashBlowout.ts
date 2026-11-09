import * as THREE from "three";
import { CRT_UNIFORMS } from "@/lib/retro/retroCRT";

// G2: blow-out final del destello de cortina — último pase, DESPUÉS de OutputPass
// (ACES + sRGB). Mezcla hacia blanco puro: col = mix(col, 1, uBlowout), con
// uBlowout = uFlash × FLASH_BLOWOUT. Encima deja asomar una textura leve de
// scanlines + grano (uBlowoutTex × uBlowout) para que siga siendo diegético.
// El pase se habilita solo con uBlowout > 0 (RetroPostFX); con 0 no se dibuja.
// Sin colorspace_fragment / tonemapping_fragment: escribe los valores tal cual.

export function createFlashBlowoutMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: "FlashBlowout",
    uniforms: {
      tDiffuse:   { value: null as THREE.Texture | null },
      uBlowout:   { value: 0 },
      uBlowoutTex:{ value: 0.03 },
      // compartidos con el CRT (mismo objeto → siempre en sincronía)
      uTime:      CRT_UNIFORMS.uTime,
      uRes:       CRT_UNIFORMS.uRes,
      uCurve:     CRT_UNIFORMS.uCurve,
      uScanCount: CRT_UNIFORMS.uScanCount,
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse;
      uniform float uBlowout, uBlowoutTex, uTime, uCurve, uScanCount;
      uniform vec2  uRes;
      varying vec2  vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }
      vec2 barrel(vec2 uv, float k) {
        vec2 c = uv * 2.0 - 1.0;
        c *= 1.0 + k * dot(c, c);
        return c * 0.5 + 0.5;
      }

      void main() {
        vec4 src = texture2D(tDiffuse, vUv);
        vec3 col = mix(src.rgb, vec3(1.0), uBlowout);
        // textura diegética: misma densidad y curvatura de scanlines que el CRT
        vec2  uv = barrel(vUv, uCurve);
        float s  = 0.5 - 0.5 * cos(uv.y * uScanCount * 6.28318);
        float g  = hash(vUv * uRes + uTime);
        col *= 1.0 - uBlowoutTex * uBlowout * (0.6 * s + 0.4 * g);
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), src.a);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
}
