"use client";
// Z46: "A LIGHT FOR ATTRACTING ATTENTION" proyectado sobre el telón rojo como un recorte del reflector
// (gobo, estilo batiseñal). Se monta junto al telón (ThreeScene: curtainVisible && DBG_TELON_TEXTO.ACTIVO) y se
// desmonta con él. La textura se dibuja una vez (lib/telonTexto/texturaTexto.ts) cuando la fuente (Anton,
// next/font) está lista; la línea de tiempo (lib/telonTexto/lineaTiempo.ts) usa el reloj de la experiencia.
//
// Mezcla: multiplicativa sobre el telón (CustomBlending: color = salida × destino). En modo gobo la salida es
// 1 fuera de las letras y TINTE_SOMBRA en ellas (las letras quedan en sombra y conservan los pliegues y la
// luz del telón debajo); en modo invertido oscurece alrededor del bloque y aclara las letras (> 1, el buffer
// del composer es de media precisión). El telón no escribe profundidad: el plano se dibuja después
// (renderOrder 1) y no hay z-fighting; los efectos de pantalla (bloom, CRT) van después en el composer.

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_TELON_TEXTO, DBG_SILLAS, DEBUG_ENABLED } from "@/lib/debugConfig";
import { anclarTelon } from "@/lib/inicioEscena";
import { RELOJ } from "@/lib/relojExperiencia";
import { PAUSA } from "@/lib/pausaExperiencia";
import { INTERACT_STATE } from "@/lib/alightStore";
import { LUZ_STATE } from "@/lib/caminoLuz";
import { CK_STATE } from "@/lib/checkpoints";
import { crearEstadoTexto, avanzarTexto, reiniciarTexto, anchoZonaIluminada } from "@/lib/telonTexto/lineaTiempo";
import { crearTexturaTexto, TEX_ANCHO, TEX_ALTO, type TexturaTexto } from "@/lib/telonTexto/texturaTexto";
import { anton } from "@/app/alight/fuentes";
// Z71: crédito debajo del bloque con efecto de foco
import { NOMBRE_EMPRESA_MAYUS } from "@/lib/marca";
import { crearEstadoEnfoque, avanzarEnfoque, forzarDesenfoque, posicionCredito, type PosCredito } from "@/lib/telonTexto/credito";
import { crearTexturaCredito, type TexturaCredito } from "@/lib/telonTexto/texturaCredito";
import { TAM_REF } from "@/lib/telonTexto/layoutTexto";

/** Z71: texto del crédito ("An" y "Simulation" con mayúsculas normales; el nombre de la empresa en mayúsculas). */
export const TEXTO_CREDITO = `An ${NOMBRE_EMPRESA_MAYUS} Simulation`;
/** Z71: estado del foco del crédito (módulo: lo lee el menú y el diagnóstico). */
export const ENFOQUE_CREDITO = crearEstadoEnfoque(DBG_TELON_TEXTO.SEMILLA);

// Reflector del telón (valores de Curtain.tsx: 5 m delante del telón, 9 m de alto, apunta a y = 4 m,
// ángulo 0,6 rad, penumbra 0,7). Se repiten acá para no tocar Curtain.tsx.
const REFLECTOR = { atrasM: 5, altoM: 9, objetivoY: 4, angulo: 0.6, penumbra: 0.7 };
const PLIEGUES = 8, PLIEGUE_M = 0.15;   // patrón de pliegues de buildSim (Curtain.tsx)
const INICIO_DEMORA_S = 0.3;            // deja arrancar un checkpoint pedido por URL antes de empezar

/** Estado de módulo: sobrevive a los remontajes del telón (no reaparece al volver). */
export const TELON_TEXTO = crearEstadoTexto();
/** Diagnóstico (lo lee el test en el navegador; sin overlay). */
export const TELON_TEXTO_DIAG = { listo: false, aspecto: 0, bordeG: 0, bordeN: 0, interletra: 0, anchoZonaM: 0, anchoBloqueM: 0, familia: "",
  creditoListo: false, creditoAltoTintaM: 0, creditoCx: 0, creditoCy: 0, altoBloqueM: 0 };   // Z71

const VERT = /* glsl */`
  uniform vec2  uFwd;          // hacia el telón (xz)
  uniform vec2  uRight;        // a la derecha vista desde el público (xz)
  uniform vec2  uCentroTelon;  // centro del telón (xz)
  uniform float uAnchoTelon;   // curtainWidthM
  uniform float uFrunce;       // curtainGather
  uniform float uPliegue;      // 0 = plano, 1 = sigue el pliegue
  uniform float uSep;          // separación delante de los pliegues (m)
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    // mismo patrón de pliegues que buildSim: ut = (span / frunce + mitad) / ancho, pliegue = sin(ut·8·2π)·0,15
    float span = dot(wp.xz - uCentroTelon, uRight);
    float ut = (span / max(uFrunce, 1e-3) + 0.5 * uAnchoTelon) / max(uAnchoTelon, 1e-3);
    float pl = sin(ut * ${PLIEGUES.toFixed(1)} * 6.2831853) * ${PLIEGUE_M.toFixed(3)};
    float off = mix(-${PLIEGUE_M.toFixed(3)}, pl, uPliegue) - uSep;   // a lo largo de uFwd (negativo = hacia el público)
    wp.xz += uFwd * off;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */`
  uniform sampler2D uMapa;
  uniform float uAlfa;         // fundido × opacidad
  uniform float uInvertido;
  uniform vec3  uTinte;
  uniform float uOscuro;
  uniform float uBrillo;
  uniform vec2  uBloque;       // fracción del plano que ocupa el bloque (u, v)
  varying vec2 vUv;
  void main() {
    float a = texture2D(uMapa, vUv).a;
    // gobo: sombra multiplicativa en las letras
    vec3 gobo = mix(vec3(1.0), uTinte, a * uAlfa);
    // invertido: viñeta del tamaño del bloque que se apaga hasta el borde del plano (sin corte)
    vec2 d = abs(vUv - 0.5) * 2.0 / max(uBloque, vec2(1e-3));
    float v = (1.0 - smoothstep(1.0, 1.0 / max(uBloque.x, 1e-3), d.x)) * (1.0 - smoothstep(1.0, 1.0 / max(uBloque.y, 1e-3), d.y));
    vec3 inv = vec3(mix(1.0, mix(uOscuro, 1.0 + uBrillo, a), v * uAlfa));
    gl_FragColor = vec4(mix(gobo, inv, uInvertido), 1.0);
  }
`;

// Z71: crédito. Desenfoque en el shader con 10 lecturas en disco (espiral de ángulo áureo) de radio proporcional al nivel
// de desenfoque, más 4 lecturas corridas para la imagen doble; con nivel ≈ 0 hace UNA lectura (costo nulo enfocado).
// Baja un poco el contraste al desenfocarse. Solo afecta al crédito: el título usa su propio material.
const FRAG_CREDITO = /* glsl */`
  uniform sampler2D uMapa;
  uniform float uAlfa;
  uniform float uNivel;        // 0 = enfocado, 1 = desenfoque máximo
  uniform vec2  uRadio;        // radio máximo del disco en uv (x corregido por el aspecto)
  uniform float uDoble;
  uniform float uInvertido;
  uniform vec3  uTinte;
  uniform float uBrillo;
  varying vec2 vUv;
  const vec2 DISCO[10] = vec2[10](
    vec2( 0.316,  0.000), vec2(-0.333,  0.305), vec2( 0.052, -0.632), vec2( 0.470,  0.555), vec2(-0.795, -0.133),
    vec2( 0.737, -0.488), vec2(-0.190,  0.913), vec2(-0.513, -0.794), vec2( 0.982,  0.250), vec2(-0.946,  0.415));
  void main() {
    float a;
    if (uNivel < 0.004) {
      a = texture2D(uMapa, vUv).a;
    } else {
      vec2 r = uRadio * uNivel;
      float s = 0.0;
      for (int i = 0; i < 10; i++) s += texture2D(uMapa, vUv + DISCO[i] * r).a;
      a = s * 0.1 * (1.0 - 0.15 * uNivel);                    // pierde un poco de contraste
      if (uDoble > 0.001) {
        vec2 o = vec2(r.x * 1.6, r.y * 0.25);
        float g = 0.0;
        for (int i = 0; i < 4; i++) g += texture2D(uMapa, vUv + o + DISCO[i] * r * 0.6).a;
        a = max(a, g * 0.25 * uDoble * min(1.0, uNivel * 1.5));
      }
    }
    float k = a * uAlfa;
    vec3 gobo = mix(vec3(1.0), uTinte, k);
    vec3 inv = vec3(1.0 + uBrillo * k);
    gl_FragColor = vec4(mix(gobo, inv, uInvertido), 1.0);
  }
`;

const UNIFORMS = {
  uMapa:        { value: null as THREE.Texture | null },
  uAlfa:        { value: 0 },
  uInvertido:   { value: 0 },
  uTinte:       { value: new THREE.Color(DBG_TELON_TEXTO.TINTE_SOMBRA) },
  uOscuro:      { value: DBG_TELON_TEXTO.OSCURO_INV },
  uBrillo:      { value: DBG_TELON_TEXTO.BRILLO_INV },
  uBloque:      { value: new THREE.Vector2(0.8, 0.8) },
  uFwd:         { value: new THREE.Vector2(0, -1) },
  uRight:       { value: new THREE.Vector2(1, 0) },
  uCentroTelon: { value: new THREE.Vector2(0, 0) },
  uAnchoTelon:  { value: DBG_SILLAS.curtainWidthM },
  uFrunce:      { value: DBG_SILLAS.curtainGather },
  uPliegue:     { value: DBG_TELON_TEXTO.PLIEGUE },
  uSep:         { value: DBG_TELON_TEXTO.SEPARACION_M },
};

// Z71: uniforms del crédito; los de los pliegues, el tinte y el brillo son los MISMOS objetos que los del título
const UNIFORMS_CREDITO = {
  uMapa:        { value: null as THREE.Texture | null },
  uAlfa:        { value: 0 },
  uNivel:       { value: 0 },
  uRadio:       { value: new THREE.Vector2(0, 0) },
  uDoble:       { value: DBG_TELON_TEXTO.ENFOQUE_DOBLE },
  uInvertido:   UNIFORMS.uInvertido,
  uTinte:       UNIFORMS.uTinte,
  uBrillo:      UNIFORMS.uBrillo,
  uFwd:         UNIFORMS.uFwd,
  uRight:       UNIFORMS.uRight,
  uCentroTelon: UNIFORMS.uCentroTelon,
  uAnchoTelon:  UNIFORMS.uAnchoTelon,
  uFrunce:      UNIFORMS.uFrunce,
  uPliegue:     UNIFORMS.uPliegue,
  uSep:         UNIFORMS.uSep,
};

const CFG_TIEMPO = DBG_TELON_TEXTO;   // FADE_IN_S, FADE_OUT_S, DURACION_S, FLICKER_* (vivo)

export default function TelonTexto() {
  const { gl, camera } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const texRef = useRef<TexturaTexto | null>(null);
  const hecho = useRef({ blur: -1, inter: -1, col: -1, ent: -1, tinte: "", crTrack: -1, crBlur: -1 });
  const creditoRef = useRef<THREE.Mesh>(null);                 // Z71
  const texCredRef = useRef<TexturaCredito | null>(null);       // Z71
  const posCred = useRef<PosCredito>({ cx: 0, cy: 0, ancho: 0, alto: 0, inkDerX: 0, inkArribaY: 0, inkAbajoY: 0, inkAltoM: 0 });
  const familia = useRef("");

  // fuente lista → textura (una vez). Sin fetch propio: la carga la resuelve next/font.
  useEffect(() => {
    let vivo = true;
    const fam = anton.style.fontFamily;
    const listo = async () => {
      try { await document.fonts.load(`200px ${fam}`); await document.fonts.ready; } catch { /* sigue con el respaldo */ }
      if (!vivo) return;
      familia.current = fam;
      TELON_TEXTO_DIAG.familia = fam;
    };
    void listo();
    const onReproducir = () => reiniciarTexto(TELON_TEXTO);
    const onDesenfocar = () => forzarDesenfoque(ENFOQUE_CREDITO);   // Z71: botón del menú
    // diagnóstico solo en modo debug (pruebas en Chrome headless): estado, medidas y la textura como imagen
    const w = window as unknown as { __telonTexto?: object };
    if (DEBUG_ENABLED) w.__telonTexto = {
      diag: TELON_TEXTO_DIAG, estado: TELON_TEXTO,
      textura: () => (texRef.current?.tex.image as HTMLCanvasElement | undefined)?.toDataURL() ?? "",
      enfoque: ENFOQUE_CREDITO,   // Z71
    };
    window.addEventListener("alight:telon-texto-reproducir", onReproducir);
    window.addEventListener("alight:telon-credito-desenfocar", onDesenfocar);
    return () => {
      vivo = false;
      window.removeEventListener("alight:telon-texto-reproducir", onReproducir);
      window.removeEventListener("alight:telon-credito-desenfocar", onDesenfocar);
      texCredRef.current?.tex.dispose();   // Z71
      texCredRef.current = null;
      UNIFORMS_CREDITO.uMapa.value = null;
      TELON_TEXTO_DIAG.creditoListo = false;
      if (DEBUG_ENABLED) delete w.__telonTexto;
      // el telón se fue: el texto no vuelve a aparecer (salvo "Reproducir texto")
      if (TELON_TEXTO.fase === "activo" || TELON_TEXTO.fase === "saliendo") { TELON_TEXTO.fase = "terminado"; TELON_TEXTO.alfa = 0; }
      texRef.current?.tex.dispose();
      texRef.current = null;
      UNIFORMS.uMapa.value = null;
      TELON_TEXTO_DIAG.listo = false;
    };
  }, []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const D = DBG_TELON_TEXTO;

    // textura: se crea cuando la fuente está lista y se recrea SOLO si cambia el blur o el layout
    const h = hecho.current;
    if (familia.current && (h.blur !== D.BLUR_PX || h.inter !== D.INTERLINEA || h.col !== D.COLUMNAS || h.ent !== D.INTENSIDAD_ENTION)) {
      texRef.current?.tex.dispose();
      const t = crearTexturaTexto(familia.current, D.BLUR_PX, D.INTERLINEA, D.COLUMNAS, D.INTENSIDAD_ENTION, gl.capabilities.getMaxAnisotropy());
      texRef.current = t;
      UNIFORMS.uMapa.value = t.tex;
      UNIFORMS.uBloque.value.set(t.bloqueU, t.bloqueV);
      h.blur = D.BLUR_PX; h.inter = D.INTERLINEA; h.col = D.COLUMNAS; h.ent = D.INTENSIDAD_ENTION;
      TELON_TEXTO_DIAG.listo = true;
      TELON_TEXTO_DIAG.aspecto = t.layout.aspecto;
      TELON_TEXTO_DIAG.bordeG = t.layout.bordeG;
      TELON_TEXTO_DIAG.bordeN = t.layout.bordeN;
      TELON_TEXTO_DIAG.interletra = t.layout.interletraENTION;
    }
    const tx = texRef.current;

    // ubicación sobre el telón (eje fijo de la escena)
    const A = anclarTelon();
    const rx = -A.fz, rz = A.fx;
    const dCam = Math.hypot(camera.position.x - A.cx, camera.position.z - A.cz);

    // línea de tiempo (reloj de la experiencia; congelada en pausa)
    const ck = CK_STATE.fase === "aplicando" || CK_STATE.pendiente !== "";
    if (ck && (TELON_TEXTO.fase === "espera" || TELON_TEXTO.fase === "activo")) { TELON_TEXTO.fase = "terminado"; TELON_TEXTO.alfa = 0; }
    const siguio = INTERACT_STATE.experienceState !== "cortina" || LUZ_STATE.fase !== "libre";
    const puede = !!tx && !ck && RELOJ.tExp >= INICIO_DEMORA_S && dCam <= D.DIST_OCULTAR_M;
    avanzarTexto(TELON_TEXTO, CFG_TIEMPO, RELOJ.tExp, PAUSA.activa, puede, dCam > D.DIST_OCULTAR_M, siguio);

    const alfa = D.ACTIVO && tx ? TELON_TEXTO.alfa : 0;
    mesh.visible = alfa > 0.001;
    // Z71: foco del crédito (reloj de la experiencia: quieto en pausa)
    avanzarEnfoque(ENFOQUE_CREDITO, D, RELOJ.tExp, mesh.visible && D.CREDITO_ACTIVO);
    const cred = creditoRef.current;
    if (cred) cred.visible = false;
    if (!mesh.visible || !tx) return;

    // tamaño: TAMANO × ancho de la zona iluminada; el plano incluye el margen de la textura
    const zona = anchoZonaIluminada(Math.hypot(REFLECTOR.atrasM, REFLECTOR.altoM - REFLECTOR.objetivoY), REFLECTOR.angulo, REFLECTOR.penumbra);
    const anchoBloque = Math.max(0.1, D.TAMANO) * zona;
    const anchoPlano = anchoBloque / Math.max(1e-3, tx.bloqueU);
    TELON_TEXTO_DIAG.anchoZonaM = zona; TELON_TEXTO_DIAG.anchoBloqueM = anchoBloque;
    mesh.scale.set(anchoPlano, anchoPlano * (TEX_ALTO / TEX_ANCHO), 1);
    mesh.position.set(A.cx + rx * D.OFFSET_X_M, REFLECTOR.objetivoY + D.OFFSET_Y_M, A.cz + rz * D.OFFSET_X_M);
    mesh.rotation.set(0, Math.atan2(-A.fx, -A.fz), 0);   // +Z local hacia el público

    const U = UNIFORMS;
    U.uAlfa.value = alfa * Math.max(0, Math.min(1, D.OPACIDAD));
    U.uInvertido.value = D.INVERTIDO ? 1 : 0;
    if (h.tinte !== D.TINTE_SOMBRA) { h.tinte = D.TINTE_SOMBRA; U.uTinte.value.set(D.TINTE_SOMBRA); }
    U.uOscuro.value = D.OSCURO_INV;
    U.uBrillo.value = D.BRILLO_INV;
    U.uFwd.value.set(A.fx, A.fz);
    U.uRight.value.set(rx, rz);
    U.uCentroTelon.value.set(A.cx, A.cz);
    U.uAnchoTelon.value = DBG_SILLAS.curtainWidthM;
    U.uFrunce.value = DBG_SILLAS.curtainGather;
    U.uPliegue.value = Math.max(0, Math.min(1, D.PLIEGUE));
    U.uSep.value = D.SEPARACION_M;

    // Z71: crédito. Textura una vez (y al cambiar el tracking o el borde suave); posición a partir del bloque
    if (!cred || !D.CREDITO_ACTIVO) return;
    const blurRel = D.BLUR_PX / Math.max(1e-3, TAM_REF * tx.escala);   // mismo borde suave relativo que el título
    if (h.crTrack !== D.CREDITO_TRACKING || h.crBlur !== blurRel) {
      texCredRef.current?.tex.dispose();
      const tc = crearTexturaCredito(familia.current, TEXTO_CREDITO, D.CREDITO_TRACKING, blurRel, gl.capabilities.getMaxAnisotropy());
      texCredRef.current = tc;
      UNIFORMS_CREDITO.uMapa.value = tc.tex;
      h.crTrack = D.CREDITO_TRACKING; h.crBlur = blurRel;
      TELON_TEXTO_DIAG.creditoListo = true;
    }
    const tc = texCredRef.current;
    if (!tc) return;
    const altoBloque = anchoBloque / Math.max(1e-3, tx.layout.aspecto);
    const P = posicionCredito(anchoBloque, altoBloque, tc.medidas, D.CREDITO_TAMANO, D.CREDITO_MARGEN, posCred.current);
    TELON_TEXTO_DIAG.creditoAltoTintaM = P.inkAltoM; TELON_TEXTO_DIAG.creditoCx = P.cx; TELON_TEXTO_DIAG.creditoCy = P.cy;
    TELON_TEXTO_DIAG.altoBloqueM = altoBloque;
    // el bloque está centrado en el plano del título: centro del bloque = posición del plano
    cred.position.set(mesh.position.x + rx * P.cx, mesh.position.y + P.cy, mesh.position.z + rz * P.cx);
    cred.rotation.copy(mesh.rotation);
    cred.scale.set(P.ancho, P.alto, 1);
    cred.visible = true;
    const UC = UNIFORMS_CREDITO;
    UC.uAlfa.value = alfa * Math.max(0, Math.min(1, D.CREDITO_OPACIDAD));
    UC.uNivel.value = ENFOQUE_CREDITO.nivel;
    // radio máximo: DESENFOQUE_MAX × alto de la tinta, en uv (x corregido por el aspecto de la textura)
    const rV = Math.max(0, D.ENFOQUE_DESENFOQUE_MAX) * (tc.medidas.inkAbajo - tc.medidas.inkArriba) / tc.medidas.texH;
    UC.uRadio.value.set(rV * tc.medidas.texH / tc.medidas.texW, rV);
    UC.uDoble.value = Math.max(0, D.ENFOQUE_DOBLE);
  });

  return (
    <>
    <mesh ref={meshRef} visible={false} renderOrder={1} frustumCulled={false}>
      <planeGeometry args={[1, 1, 96, 1]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={UNIFORMS}
        transparent
        depthWrite={false}
        depthTest
        blending={THREE.CustomBlending}
        blendEquation={THREE.AddEquation}
        blendSrc={THREE.DstColorFactor}
        blendDst={THREE.ZeroFactor}
        blendSrcAlpha={THREE.ZeroFactor}
        blendDstAlpha={THREE.OneFactor}
      />
    </mesh>
    {/* Z71: crédito (misma técnica: gobo multiplicativo; desenfoque solo acá) */}
    <mesh ref={creditoRef} visible={false} renderOrder={1} frustumCulled={false}>
      <planeGeometry args={[1, 1, 24, 1]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG_CREDITO}
        uniforms={UNIFORMS_CREDITO}
        transparent
        depthWrite={false}
        depthTest
        blending={THREE.CustomBlending}
        blendEquation={THREE.AddEquation}
        blendSrc={THREE.DstColorFactor}
        blendDst={THREE.ZeroFactor}
        blendSrcAlpha={THREE.ZeroFactor}
        blendDstAlpha={THREE.OneFactor}
      />
    </mesh>
    </>
  );
}
