"use client";
// Z104: ayuda de movimiento proyectada sobre el telón rojo, debajo del título y su crédito. Usa el MISMO mecanismo que
// el texto del telón (Z46): un plano con el vértice que sigue los pliegues (VERT_TELON) y mezcla multiplicativa de gobo
// (las letras quedan en sombra sobre la tela), la misma fuente Anton y el mismo borde suave; las flechas son formas en
// la misma textura. La línea de tiempo es pura (lib/telonAyuda.ts) y avanza con el dt del cuadro: sin timers.
// Se monta con el telón (ThreeScene: curtainVisible) y se desmonta al cruzarlo: limpia textura, oyentes y el aviso
// accesible (un texto oculto con aria-live "polite" que anuncia la instrucción una sola vez).
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_TELON_AYUDA, DBG_TELON_TEXTO, DBG_SILLAS } from "@/lib/debugConfig";
import { anclarTelon } from "@/lib/inicioEscena";
import { RELOJ } from "@/lib/relojExperiencia";
import { PAUSA } from "@/lib/pausaExperiencia";
import { INTERACT_STATE } from "@/lib/alightStore";
import { LUZ_STATE } from "@/lib/caminoLuz";
import { CK_STATE } from "@/lib/checkpoints";
import { DIALOGO_STATE } from "@/lib/dialogo/dialogoEstado";
import { crearEstadoAyuda, avanzarAyuda, reiniciarAyuda, dispararAyuda, TEXTO_ACCESIBLE_AYUDA, type EntradaAyuda } from "@/lib/telonAyuda";
import { anchoZonaIluminada } from "@/lib/telonTexto/lineaTiempo";
import { crearTexturaAyuda, CELDA_W, CELDA_H, N_CELDAS } from "@/lib/telonTexto/texturaAyuda";
import { TAM_REF } from "@/lib/telonTexto/layoutTexto";
import { anton } from "@/app/alight/fuentes";
import { REFLECTOR, VERT_TELON, TELON_TEXTO_DIAG } from "./TelonTexto";

/** Estado de módulo (lo lee el menú de debug). Se reinicia en cada visita (al montar el telón). */
export const AYUDA = crearEstadoAyuda();
const _entrada: EntradaAyuda = { presente: false, pausado: false, movio: false, miro: false };
const INICIO_DEMORA_S = 0.3;

const FRAG = /* glsl */`
  uniform sampler2D uMapa;
  uniform float uInicio;     // primera celda que se ve (0…3)
  uniform float uCeldas;     // cuántas celdas se ven (1…4)
  uniform float uUltima;     // índice de la celda que está entrando
  uniform float uAlfa;       // opacidad de la que entra
  uniform float uAlfaResto;  // opacidad de las anteriores ("acumulado")
  uniform float uInvertido;
  uniform vec3  uTinte;
  uniform float uBrillo;
  varying vec2 vUv;
  void main() {
    float x = uInicio + vUv.x * uCeldas;
    float celda = floor(min(x, 3.999));
    float a = texture2D(uMapa, vec2(x / ${N_CELDAS.toFixed(1)}, vUv.y)).a;
    float k = a * (abs(celda - uUltima) < 0.5 ? uAlfa : uAlfaResto);
    vec3 gobo = mix(vec3(1.0), uTinte, k);
    vec3 inv = vec3(1.0 + uBrillo * k);
    gl_FragColor = vec4(mix(gobo, inv, uInvertido), 1.0);
  }
`;
const UNIFORMS = {
  uMapa: { value: null as THREE.Texture | null },
  uInicio: { value: 0 }, uCeldas: { value: 1 }, uUltima: { value: 0 }, uAlfa: { value: 0 }, uAlfaResto: { value: 0 },
  uInvertido: { value: 0 }, uTinte: { value: new THREE.Color(DBG_TELON_TEXTO.TINTE_SOMBRA) }, uBrillo: { value: DBG_TELON_TEXTO.BRILLO_INV },
  uFwd: { value: new THREE.Vector2(0, -1) }, uRight: { value: new THREE.Vector2(1, 0) }, uCentroTelon: { value: new THREE.Vector2(0, 0) },
  uAnchoTelon: { value: DBG_SILLAS.curtainWidthM }, uFrunce: { value: DBG_SILLAS.curtainGather },
  uPliegue: { value: DBG_TELON_TEXTO.PLIEGUE }, uSep: { value: DBG_TELON_TEXTO.SEPARACION_M },
};

export default function TelonAyuda() {
  const { gl, camera } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const texRef = useRef<THREE.CanvasTexture | null>(null);
  const familia = useRef("");
  const tecla = useRef(false);
  const prev = useRef({ x: NaN, z: NaN, qx: 0, qy: 0, qz: 0, qw: 1, tinte: "" });
  const vivo = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    reiniciarAyuda(AYUDA);   // una visita nueva al telón
    let activo = true;
    const fam = anton.style.fontFamily;
    (async () => {
      try { await document.fonts.load(`200px ${fam}`); await document.fonts.ready; } catch { /* sigue con el respaldo */ }
      if (activo) familia.current = fam;
    })();
    // texto para lectores de pantalla: oculto a la vista, se anuncia una sola vez
    const div = document.createElement("div");
    div.setAttribute("aria-live", "polite"); div.setAttribute("role", "status");
    div.style.cssText = "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0";
    document.body.appendChild(div); vivo.current = div;
    const onTecla = (e: KeyboardEvent) => { if (e.code === "KeyW" || e.code === "KeyA" || e.code === "KeyS" || e.code === "KeyD") tecla.current = true; };
    const onProbar = () => dispararAyuda(AYUDA);
    const onReiniciar = () => reiniciarAyuda(AYUDA);
    window.addEventListener("keydown", onTecla);
    window.addEventListener("alight:telon-ayuda-probar", onProbar);
    window.addEventListener("alight:telon-ayuda-reiniciar", onReiniciar);
    return () => {
      activo = false;
      window.removeEventListener("keydown", onTecla);
      window.removeEventListener("alight:telon-ayuda-probar", onProbar);
      window.removeEventListener("alight:telon-ayuda-reiniciar", onReiniciar);
      div.remove(); vivo.current = null;
      texRef.current?.dispose(); texRef.current = null; UNIFORMS.uMapa.value = null;
      if (AYUDA.fase !== "cancelada") AYUDA.fase = "terminada";   // cruzó el telón: no se muestra más en esta visita
      AYUDA.indicacion = -1; AYUDA.alfa = 0; AYUDA.alfaResto = 0;
    };
  }, []);

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const D = DBG_TELON_AYUDA, T = DBG_TELON_TEXTO;
    // textura: una vez, con la fuente lista (mismo borde suave relativo que el título)
    if (!texRef.current && familia.current) {
      texRef.current = crearTexturaAyuda(familia.current, T.BLUR_PX / Math.max(1e-3, TAM_REF), gl.capabilities.getMaxAnisotropy());
      UNIFORMS.uMapa.value = texRef.current;
    }
    // ¿se movió? teclas W A S D o cambio de posición; ¿miró? giro de la cámara (solo con CUENTA_MIRAR)
    const p = prev.current, q = camera.quaternion;
    const movioPos = Number.isFinite(p.x) && Math.hypot(camera.position.x - p.x, camera.position.z - p.z) > D.UMBRAL_MOV_M;
    const giro = 1 - Math.abs(q.x * p.qx + q.y * p.qy + q.z * p.qz + q.w * p.qw);
    p.x = camera.position.x; p.z = camera.position.z; p.qx = q.x; p.qy = q.y; p.qz = q.z; p.qw = q.w;
    const ck = CK_STATE.fase === "aplicando" || CK_STATE.pendiente !== "";
    _entrada.presente = D.ACTIVO && !ck && INTERACT_STATE.experienceState === "cortina" && LUZ_STATE.fase === "libre" && RELOJ.tExp >= INICIO_DEMORA_S;
    _entrada.pausado = PAUSA.activa || DIALOGO_STATE.activo;
    _entrada.movio = tecla.current || movioPos;
    _entrada.miro = giro > D.UMBRAL_MIRAR;
    tecla.current = false;
    avanzarAyuda(AYUDA, dt, D, _entrada);
    if (AYUDA.anunciar && vivo.current) vivo.current.textContent = TEXTO_ACCESIBLE_AYUDA;

    const tx = texRef.current, aspecto = TELON_TEXTO_DIAG.aspecto > 0 ? TELON_TEXTO_DIAG.aspecto : 4.79;   // sin el título, su proporción de siempre
    const visible = !!tx && aspecto > 0 && AYUDA.celdas > 0 && Math.max(AYUDA.alfa, AYUDA.alfaResto) > 0.001;
    mesh.visible = visible;
    if (!visible) return;

    // ubicación: debajo del bloque del título y de su crédito, centrada (mismas cuentas que TelonTexto)
    const A = anclarTelon(), rx = -A.fz, rz = A.fx;
    const zona = anchoZonaIluminada(Math.hypot(REFLECTOR.atrasM, REFLECTOR.altoM - REFLECTOR.objetivoY), REFLECTOR.angulo, REFLECTOR.penumbra);
    const anchoBloque = Math.max(0.1, T.TAMANO) * zona, altoBloque = anchoBloque / aspecto;
    const hCelda = Math.max(0.05, D.TAMANO) * altoBloque, wCelda = hCelda * (CELDA_W / CELDA_H);
    const credito = T.CREDITO_ACTIVO ? T.CREDITO_MARGEN + T.CREDITO_TAMANO : 0;
    const y = REFLECTOR.objetivoY + T.OFFSET_Y_M - altoBloque * (0.5 + credito + Math.max(0, D.BAJAR)) - hCelda / 2;
    const acumulado = D.MODO === "acumulado";
    mesh.scale.set(wCelda * AYUDA.celdas, hCelda, 1);
    mesh.position.set(A.cx + rx * T.OFFSET_X_M, y, A.cz + rz * T.OFFSET_X_M);
    mesh.rotation.set(0, Math.atan2(-A.fx, -A.fz), 0);
    const U = UNIFORMS;
    U.uInicio.value = acumulado ? 0 : AYUDA.indicacion;
    U.uCeldas.value = AYUDA.celdas;
    U.uUltima.value = AYUDA.indicacion;
    const op = Math.max(0, Math.min(1, D.OPACIDAD));
    U.uAlfa.value = AYUDA.alfa * op; U.uAlfaResto.value = AYUDA.alfaResto * op;
    U.uInvertido.value = T.INVERTIDO ? 1 : 0; U.uBrillo.value = T.BRILLO_INV;
    if (p.tinte !== T.TINTE_SOMBRA) { p.tinte = T.TINTE_SOMBRA; U.uTinte.value.set(T.TINTE_SOMBRA); }
    U.uFwd.value.set(A.fx, A.fz); U.uRight.value.set(rx, rz); U.uCentroTelon.value.set(A.cx, A.cz);
    U.uAnchoTelon.value = DBG_SILLAS.curtainWidthM; U.uFrunce.value = DBG_SILLAS.curtainGather;
    U.uPliegue.value = Math.max(0, Math.min(1, T.PLIEGUE)); U.uSep.value = T.SEPARACION_M;
  });

  return (
    <mesh ref={meshRef} visible={false} renderOrder={1} frustumCulled={false}>
      <planeGeometry args={[1, 1, 48, 1]} />
      <shaderMaterial
        vertexShader={VERT_TELON}
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
  );
}
