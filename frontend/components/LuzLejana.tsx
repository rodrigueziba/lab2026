"use client";
// Z28: camino LUZ. Una luz tenue a ~40 m detrás del inicio (sentido opuesto al telón), visible
// desde cualquier punto y estado; al acercarse sube su intensidad, aparece un cono sobre el suelo y
// se encienden estrellas. Debajo de ella (ACTIVACION_M, con histéresis) se bloquea el movimiento
// (INTERACT_STATE.movementLocked, el mismo bloqueo del camino SILLAS), la cámara gira hacia la luz
// en GIRO_MS y queda fija, y arranca el diálogo (DialogoTerminal, Z27) desde n_1. Con
// 'alight:dialogo-fin' (o si la terminal se cierra) se libera todo.
// Salir/volver del área → 'alight:salir-del-area' / 'alight:volver-al-area' (pausa central en
// lib/pausaExperiencia.ts). Sin luces reales: sprite aditivo + cono/pozo con shader + un Points.
// Orden de dibujo: estrellas renderOrder −2 (fondo, debajo del caparazón del domo), luz/cono 10
// (encima del caparazón y del cielo del domo, que no escriben profundidad). Sin fog en lo emisivo.

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_LUZ } from "@/lib/debugConfig";
import { LUZ_STATE, actualizarPosLuz, fueraDelArea, curvaCercania } from "@/lib/caminoLuz";
import { INTERACT_STATE, isVizActivated } from "@/lib/alightStore";
import { instalarPausa, tickPausa } from "@/lib/pausaExperiencia";
import { abrirDialogo, cerrarDialogo } from "@/lib/dialogo/dialogoEstado";

const ESTRELLAS_R = 400;   // radio de la esfera de estrellas (sigue a la cámara)
const DOMO_EXT_R  = 30;    // caparazón del domo (DOME_R + 2 en ExperienceDome)

// ── uniforms de módulo (mismo patrón que DOME_SHELL_UNIFORMS / PANEL_LAYOUT_UNIFORMS) ──
const CONO_UNIFORMS = {
  uColor:    { value: new THREE.Color(DBG_LUZ.LUZ_COLOR) },
  uOpacidad: { value: 0 },
};
const POZO_UNIFORMS = {
  uColor:    { value: new THREE.Color(DBG_LUZ.LUZ_COLOR) },
  uOpacidad: { value: 0 },
};
const ESTRELLAS_UNIFORMS = {
  uOpacidad:   { value: 0 },
  uTiempo:     { value: 0 },
  uTam:        { value: DBG_LUZ.ESTRELLAS_TAM_PX },
  uPixelRatio: { value: 1 },
};

const CONO_VERT = /* glsl */`
  varying vec2 vUv;
  varying float vBorde;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec3 n  = normalize(mat3(modelMatrix) * normal);
    vec3 v  = normalize(cameraPosition - wp.xyz);
    vBorde  = abs(dot(n, v));            // 1 de frente, 0 en el contorno → bordes suaves
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const CONO_FRAG = /* glsl */`
  uniform vec3  uColor;
  uniform float uOpacidad;
  varying vec2  vUv;
  varying float vBorde;
  void main() {
    float alto  = mix(0.35, 1.0, vUv.y);           // más denso arriba, junto a la fuente
    float borde = pow(vBorde, 1.6);
    // bandas horizontales tenues (polvo en suspensión, guiño a las scanlines)
    float banda = 0.85 + 0.15 * sin(vUv.y * 90.0);
    gl_FragColor = vec4(uColor, uOpacidad * alto * borde * banda);
  }
`;
const POZO_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const POZO_FRAG = /* glsl */`
  uniform vec3  uColor;
  uniform float uOpacidad;
  varying vec2  vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = 1.0 - smoothstep(0.0, 1.0, d);
    gl_FragColor = vec4(uColor, uOpacidad * a * a);
  }
`;
const ESTRELLAS_VERT = /* glsl */`
  attribute float aTam;
  attribute float aBrillo;
  attribute float aFase;
  uniform float uTiempo;
  uniform float uTam;
  uniform float uPixelRatio;
  varying float vBrillo;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw  = 0.72 + 0.28 * sin(uTiempo * (0.5 + aFase * 1.7) + aFase * 40.0);
    float hor = smoothstep(0.02, 0.20, normalize(position).y);   // se apagan cerca del horizonte
    vBrillo = aBrillo * tw * hor;
    gl_PointSize = uTam * aTam * uPixelRatio;
  }
`;
const ESTRELLAS_FRAG = /* glsl */`
  uniform float uOpacidad;
  varying float vBrillo;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = 1.0 - smoothstep(0.2, 1.0, d);
    gl_FragColor = vec4(vec3(0.95, 0.90, 0.80), a * vBrillo * uOpacidad);   // beige cálido, no blanco puro
  }
`;

/** Halo de la luz: núcleo cálido + halo + scanlines tenues (estilo CRT). Una sola textura. */
function crearHalo(): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  r.addColorStop(0.00, "rgba(255,250,236,1)");
  r.addColorStop(0.06, "rgba(255,238,200,0.95)");
  r.addColorStop(0.18, "rgba(255,226,168,0.45)");
  r.addColorStop(0.45, "rgba(255,200,130,0.12)");
  r.addColorStop(1.00, "rgba(255,180,110,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = "rgba(0,0,0,0.18)";
  for (let y = 0; y < S; y += 4) g.fillRect(0, y, S, 1);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function crearEstrellas(n: number): THREE.BufferGeometry {
  const pos = new Float32Array(n * 3);
  const tam = new Float32Array(n);
  const bri = new Float32Array(n);
  const fas = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const y = 0.03 + 0.97 * Math.pow(Math.random(), 0.8);   // hemisferio superior, algo más cerca del horizonte
    const phi = Math.random() * Math.PI * 2;
    const h = Math.sqrt(Math.max(0, 1 - y * y));
    pos[i * 3] = Math.cos(phi) * h * ESTRELLAS_R;
    pos[i * 3 + 1] = y * ESTRELLAS_R;
    pos[i * 3 + 2] = Math.sin(phi) * h * ESTRELLAS_R;
    const k = Math.random();
    tam[i] = 0.6 + 1.6 * k * k * k;                       // pocas grandes
    bri[i] = 0.35 + 0.65 * Math.random();
    fas[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aTam", new THREE.BufferAttribute(tam, 1));
  geo.setAttribute("aBrillo", new THREE.BufferAttribute(bri, 1));
  geo.setAttribute("aFase", new THREE.BufferAttribute(fas, 1));
  return geo;
}

export default function LuzLejana() {
  const { camera, gl } = useThree();
  const raizRef     = useRef<THREE.Group>(null);
  const spriteRef   = useRef<THREE.Sprite>(null);
  const conoRef     = useRef<THREE.Mesh>(null);
  const pozoRef     = useRef<THREE.Mesh>(null);
  const sueloRef    = useRef<THREE.Mesh>(null);
  const estrellasRef = useRef<THREE.Points>(null);

  const halo = useMemo(() => crearHalo(), []);
  const geoEstrellas = useMemo(() => crearEstrellas(Math.max(0, Math.round(DBG_LUZ.ESTRELLAS_N))), []);

  // estado de la secuencia (sin React: se lee y escribe en useFrame y en listeners)
  const sec = useRef({
    t0: 0,
    qIni: new THREE.Quaternion(),
    qFin: new THREE.Quaternion(),
    eul: new THREE.Euler(0, 0, 0, "YXZ"),
    cierre: null as ReturnType<typeof setTimeout> | null,
  });
  const colorBase = useRef(new THREE.Color(DBG_LUZ.LUZ_COLOR));
  const colorHex  = useRef(DBG_LUZ.LUZ_COLOR);

  // limpieza de recursos
  useEffect(() => () => { halo.dispose(); }, [halo]);
  useEffect(() => () => { geoEstrellas.dispose(); }, [geoEstrellas]);
  useEffect(() => { ESTRELLAS_UNIFORMS.uPixelRatio.value = gl.getPixelRatio(); }, [gl]);

  // pausa central + eventos del diálogo + teleport de debug
  useEffect(() => {
    const quitarPausa = instalarPausa();
    const s = sec.current;

    const liberar = () => {
      if (LUZ_STATE.fase !== "girando" && LUZ_STATE.fase !== "dialogo") return;
      LUZ_STATE.fase = "rearmar";
      // el único otro bloqueo por movementLocked es la secuencia SILLAS: se respeta
      INTERACT_STATE.movementLocked = INTERACT_STATE.experienceState === "sillas_secuencia";
    };
    const onFin = () => {
      if (LUZ_STATE.fase !== "dialogo") return;
      liberar();
      if (s.cierre) clearTimeout(s.cierre);
      s.cierre = setTimeout(() => { s.cierre = null; cerrarDialogo(); }, Math.max(0, DBG_LUZ.CIERRE_DIALOGO_MS));
    };
    const onCerrado = () => liberar();   // Escape u otro cierre a mitad del diálogo

    const onTeleport = () => {
      if (LUZ_STATE.fase === "girando" || LUZ_STATE.fase === "dialogo") return;
      actualizarPosLuz();
      // sobre la recta luz → usuario, a TELEPORT_DIST_M de la luz, mirándola (pitch 0)
      const sx = camera.position.x - LUZ_STATE.x, sz = camera.position.z - LUZ_STATE.z;
      const l = Math.hypot(sx, sz) || 1;
      const d = Math.max(DBG_LUZ.ACTIVACION_SALIDA_M + 0.5, DBG_LUZ.TELEPORT_DIST_M);
      camera.position.set(LUZ_STATE.x + (sx / l) * d, 1.6, LUZ_STATE.z + (sz / l) * d);
      camera.rotation.order = "YXZ";
      camera.rotation.set(0, Math.atan2(sx / l, sz / l), 0);
      LUZ_STATE.fase = "libre";
    };

    window.addEventListener("alight:dialogo-fin", onFin);
    window.addEventListener("alight:dialogo-cerrado", onCerrado);
    window.addEventListener("alight:debug-teleport-luz", onTeleport);
    return () => {
      window.removeEventListener("alight:dialogo-fin", onFin);
      window.removeEventListener("alight:dialogo-cerrado", onCerrado);
      window.removeEventListener("alight:debug-teleport-luz", onTeleport);
      if (s.cierre) { clearTimeout(s.cierre); s.cierre = null; }
      if (LUZ_STATE.fase === "girando" || LUZ_STATE.fase === "dialogo") { liberar(); cerrarDialogo(); }
      LUZ_STATE.fase = "libre";
      if (LUZ_STATE.fuera) { LUZ_STATE.fuera = false; }
      quitarPausa();   // reanuda si quedó en pausa
    };
  }, [camera]);

  useFrame(({ clock }, dt) => {
    const on = DBG_LUZ.CAMINO_LUZ;
    if (raizRef.current) raizRef.current.visible = on;
    if (estrellasRef.current) estrellasRef.current.visible = on && ESTRELLAS_UNIFORMS.uOpacidad.value > 0.002;

    // ── área y pausa ──
    const fuera = on && fueraDelArea(camera.position.x, camera.position.z, LUZ_STATE.fuera);
    if (fuera !== LUZ_STATE.fuera) {
      LUZ_STATE.fuera = fuera;
      if (fuera && DBG_LUZ.PAUSA) window.dispatchEvent(new CustomEvent("alight:salir-del-area"));
      else if (!fuera) window.dispatchEvent(new CustomEvent("alight:volver-al-area"));
    }
    tickPausa(dt);
    if (!on) return;

    // ── luz: posición, distancia, curva ──
    actualizarPosLuz();
    const dx = camera.position.x - LUZ_STATE.x, dz = camera.position.z - LUZ_STATE.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    LUZ_STATE.dLuz = d;
    const k = curvaCercania(d, DBG_LUZ.LUZ_D_LEJOS_M, DBG_LUZ.LUZ_D_CERCA_M, DBG_LUZ.LUZ_CURVA);
    LUZ_STATE.cercania = k;

    if (colorHex.current !== DBG_LUZ.LUZ_COLOR) {
      colorHex.current = DBG_LUZ.LUZ_COLOR;
      colorBase.current.set(DBG_LUZ.LUZ_COLOR);
      CONO_UNIFORMS.uColor.value.copy(colorBase.current);
      POZO_UNIFORMS.uColor.value.copy(colorBase.current);
    }
    const intensidad = DBG_LUZ.LUZ_INT_LEJOS + (DBG_LUZ.LUZ_INT_CERCA - DBG_LUZ.LUZ_INT_LEJOS) * k;
    const sp = spriteRef.current;
    if (sp) {
      sp.position.set(LUZ_STATE.x, LUZ_STATE.y, LUZ_STATE.z);
      sp.scale.setScalar(DBG_LUZ.LUZ_HALO_M);
      (sp.material as THREE.SpriteMaterial).color.copy(colorBase.current).multiplyScalar(intensidad);
    }
    const kCono = curvaCercania(d, DBG_LUZ.CONO_D_INICIO_M, DBG_LUZ.LUZ_D_CERCA_M, 1.5);
    CONO_UNIFORMS.uOpacidad.value = DBG_LUZ.CONO_OPACIDAD * kCono;
    POZO_UNIFORMS.uOpacidad.value = DBG_LUZ.POZO_OPACIDAD * (0.25 + 0.75 * kCono);
    const cono = conoRef.current;
    if (cono) {
      cono.position.set(LUZ_STATE.x, LUZ_STATE.y * 0.5, LUZ_STATE.z);
      cono.scale.set(DBG_LUZ.CONO_RADIO_M, LUZ_STATE.y, DBG_LUZ.CONO_RADIO_M);
      cono.visible = kCono > 0.001;
    }
    const pozo = pozoRef.current;
    if (pozo) {
      pozo.position.set(LUZ_STATE.x, 0.03, LUZ_STATE.z);
      pozo.scale.setScalar(DBG_LUZ.CONO_RADIO_M * 1.5);
    }
    // suelo exterior: con el visualizador activo y el usuario dentro del domo se oculta (como el
    // piso cuadrado en AA1), para que no se vea a través del cielo transparente del domo
    const suelo = sueloRef.current;
    if (suelo) {
      suelo.position.set(LUZ_STATE.x, -0.02, LUZ_STATE.z);
      suelo.scale.setScalar(DBG_LUZ.EXTERIOR_RADIO_M);
      const rUsuario = Math.hypot(camera.position.x, camera.position.z);
      suelo.visible = !isVizActivated() || rUsuario > DOMO_EXT_R;
    }

    // ── estrellas: solo fuera de la sala, más brillantes cerca de la luz ──
    const borde = Math.max(Math.abs(camera.position.x), Math.abs(camera.position.z));
    const gate = THREE.MathUtils.smoothstep(borde, DBG_LUZ.SALA_MEDIA_M - 2, DBG_LUZ.SALA_MEDIA_M + 2);
    const kEst = curvaCercania(d, DBG_LUZ.ESTRELLAS_D_LEJOS_M, DBG_LUZ.ESTRELLAS_D_CERCA_M, 1.2);
    ESTRELLAS_UNIFORMS.uOpacidad.value = DBG_LUZ.ESTRELLAS_MAX * kEst * gate;
    ESTRELLAS_UNIFORMS.uTiempo.value = clock.elapsedTime;
    ESTRELLAS_UNIFORMS.uTam.value = DBG_LUZ.ESTRELLAS_TAM_PX;
    if (estrellasRef.current) estrellasRef.current.position.copy(camera.position);

    // ── activación bajo la luz ──
    const s = sec.current;
    if (LUZ_STATE.fase === "libre") {
      if (d <= DBG_LUZ.ACTIVACION_M && INTERACT_STATE.mode === "none" && !INTERACT_STATE.camAnimActive) {
        LUZ_STATE.fase = "girando";
        INTERACT_STATE.movementLocked = true;
        s.t0 = performance.now();
        s.qIni.copy(camera.quaternion);
        const ddx = LUZ_STATE.x - camera.position.x, ddz = LUZ_STATE.z - camera.position.z;
        const dy = LUZ_STATE.y - camera.position.y;
        const maxP = (DBG_LUZ.PITCH_MAX_DEG * Math.PI) / 180;
        const pitch = Math.min(maxP, Math.atan2(dy, Math.max(0.05, Math.hypot(ddx, ddz))));
        s.eul.set(pitch, Math.atan2(-ddx, -ddz), 0, "YXZ");
        s.qFin.setFromEuler(s.eul);
      }
    } else if (LUZ_STATE.fase === "girando") {
      INTERACT_STATE.movementLocked = true;      // por si otro sistema lo liberó en el medio
      const t = Math.min(1, (performance.now() - s.t0) / Math.max(1, DBG_LUZ.GIRO_MS));
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;   // ease in-out cúbico
      camera.quaternion.slerpQuaternions(s.qIni, s.qFin, e);
      if (t >= 1) {
        LUZ_STATE.fase = "dialogo";
        abrirDialogo();                           // iniciar() → reset + knot n_1
      }
    } else if (LUZ_STATE.fase === "dialogo") {
      INTERACT_STATE.movementLocked = true;
      camera.quaternion.copy(s.qFin);             // la mirada queda fija (pisa el mouse antes del render)
    } else if (LUZ_STATE.fase === "rearmar") {
      if (d > DBG_LUZ.ACTIVACION_SALIDA_M) LUZ_STATE.fase = "libre";
    }
  });

  return (
    <>
      <group ref={raizRef}>
        {/* fuente: un solo sprite aditivo con halo (sin luces reales) */}
        <sprite ref={spriteRef} renderOrder={10}>
          <spriteMaterial map={halo} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
        </sprite>
        {/* cono sobre el suelo (cilindro abierto unitario, escalado en useFrame) */}
        <mesh ref={conoRef} renderOrder={10} frustumCulled={false}>
          <cylinderGeometry args={[0.06, 1, 1, 48, 1, true]} />
          <shaderMaterial vertexShader={CONO_VERT} fragmentShader={CONO_FRAG} uniforms={CONO_UNIFORMS}
            transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
        {/* charco de luz en el suelo */}
        <mesh ref={pozoRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
          <circleGeometry args={[1, 64]} />
          <shaderMaterial vertexShader={POZO_VERT} fragmentShader={POZO_FRAG} uniforms={POZO_UNIFORMS}
            transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
        {/* suelo exterior oscuro alrededor de la luz (mismo material que el piso de la sala) */}
        <mesh ref={sueloRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[1, 96]} />
          <meshStandardMaterial color="#0d0d0f" roughness={0.95} />
        </mesh>
      </group>
      {/* estrellas: un solo Points que sigue a la cámara; fondo (renderOrder bajo, sin profundidad) */}
      <points ref={estrellasRef} geometry={geoEstrellas} renderOrder={-2} frustumCulled={false} visible={false}>
        <shaderMaterial vertexShader={ESTRELLAS_VERT} fragmentShader={ESTRELLAS_FRAG} uniforms={ESTRELLAS_UNIFORMS}
          transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </>
  );
}
