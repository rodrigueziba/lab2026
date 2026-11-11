"use client";
// Z32: diagnóstico TEMPORAL de los cambios de tono del cielo estrellado. Inactivo salvo
// DBG_DIAG_CIELO.ACTIVO (panel plegado en el DebugMenu). Oculta superficies de a una con
// material.visible (no pelea con los useFrame que manejan object.visible), cambia fog y fondo, y
// publica en DIAG_CIELO.tabla el estado de cada superficie (una vez por segundo, solo activo).
// Evento de debug 'alight:debug-mirar' {yaw, pitch} (grados): orienta la cámara para capturas sin
// pointer lock. Al desactivar o desmontar restaura todo.

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_DIAG_CIELO } from "@/lib/debugConfig";
import { DIAG_CIELO } from "@/lib/caminoLuz";

const NOMBRES: [string, keyof typeof DBG_DIAG_CIELO | null][] = [
  ["domo-cascaron", "OCULTAR_CASCARON"],
  ["domo-cielo", "OCULTAR_CIELO_DOMO"],
  ["room-ceiling", "OCULTAR_TECHO"],
  ["room-walls", "OCULTAR_PAREDES"],
  ["room-floor", "OCULTAR_PISO"],
  ["luz-suelo-exterior", "OCULTAR_SUELO_EXT"],
  ["cielo-estrellas", null],
  ["luz-sprite", null],
  ["luz-cono", null],
  ["luz-pozo", null],
];

function materiales(o: THREE.Object3D, out: THREE.Material[]): void {
  o.traverse(c => {
    const m = (c as THREE.Mesh).material;
    if (m && !Array.isArray(m)) out.push(m);
  });
}

function hex(c: THREE.Color | undefined): string {
  return c ? "#" + c.getHexString() : "shader";
}

const BLEND = ["No", "Normal", "Aditivo", "Sustractivo", "Multiplicar", "Custom"];

export default function DiagnosticoCielo() {
  const { scene, camera, gl } = useThree();
  const st = useRef({
    activo: false,
    fog: null as THREE.Fog | THREE.FogExp2 | null,
    fondo: null as THREE.Color | THREE.Texture | null,
    testigo: new THREE.Color("#ff00ff"),
    ocultos: [] as THREE.Material[],
    t: 0,
  });

  useEffect(() => {
    const onMirar = (e: Event) => {
      const d = (e as CustomEvent<{ yaw?: number; pitch?: number }>).detail ?? {};
      camera.rotation.order = "YXZ";
      camera.rotation.set(((d.pitch ?? 0) * Math.PI) / 180, ((d.yaw ?? 0) * Math.PI) / 180, 0);
    };
    window.addEventListener("alight:debug-mirar", onMirar);
    const s = st.current;
    return () => {
      window.removeEventListener("alight:debug-mirar", onMirar);
      restaurar(scene, s);
    };
  }, [camera, scene]);

  useFrame((state, dt) => {
    const s = st.current;
    const escena = state.scene;   // del estado del frame (no el valor del hook): se puede modificar
    if (!DBG_DIAG_CIELO.ACTIVO) {
      if (s.activo) { restaurar(escena, s); s.activo = false; }
      return;
    }
    if (!s.activo) { s.activo = true; s.fog = scene.fog; s.fondo = scene.background as THREE.Color | null; s.t = 1; }

    // ocultar (material.visible) según flags; se recalcula cada frame (barato: 6 búsquedas por nombre)
    aplicarOcultos(escena, s.ocultos);
    escena.fog = DBG_DIAG_CIELO.SIN_FOG ? null : s.fog;
    escena.background = DBG_DIAG_CIELO.FONDO_TESTIGO ? s.testigo : s.fondo;

    // tabla una vez por segundo
    s.t += dt;
    if (s.t < 1) return;
    s.t = 0;
    const filas: string[] = [];
    for (const [n] of NOMBRES) {
      const o = scene.getObjectByName(n);
      if (!o) { filas.push(`${n}: (no montado)`); continue; }
      const ms: THREE.Material[] = [];
      materiales(o, ms);
      const m = ms[0] as (THREE.Material & { color?: THREE.Color; uniforms?: Record<string, { value: unknown }> }) | undefined;
      const op = m?.uniforms?.uShellOpacity?.value ?? m?.opacity;
      filas.push(`${n}: vis=${o.visible} ro=${o.renderOrder} ${m?.type ?? "-"} color=${hex(m?.color)} op=${typeof op === "number" ? op.toFixed(2) : op}` +
        ` transp=${m?.transparent} dW=${m?.depthWrite} dT=${m?.depthTest} blend=${BLEND[m?.blending ?? 0]} fog=${(m as { fog?: boolean })?.fog ?? "-"} n=${ms.length}`);
    }
    const f = s.fog as THREE.FogExp2 | null;
    const cc = new THREE.Color();
    gl.getClearColor(cc);
    filas.push(`scene.background=${s.fondo instanceof THREE.Color ? hex(s.fondo) : String(s.fondo)} · fog=${f ? hex(f.color) + " d=" + f.density : "null"} · clear=${hex(cc)} a=${gl.getClearAlpha()}`);
    DIAG_CIELO.tabla = filas.join("\n");
  });

  return null;
}

function restaurar(scene: THREE.Scene, s: { fog: THREE.Fog | THREE.FogExp2 | null; fondo: THREE.Color | THREE.Texture | null; ocultos: THREE.Material[]; activo: boolean }): void {
  for (const m of s.ocultos) m.visible = true;
  s.ocultos.length = 0;
  if (s.activo) { scene.fog = s.fog; scene.background = s.fondo; }
}

/** Repone los materiales ocultados el frame anterior y oculta los que piden los flags. */
function aplicarOcultos(escena: THREE.Scene, ocultos: THREE.Material[]): void {
  for (const m of ocultos) m.visible = true;
  ocultos.length = 0;
  for (const [n, flag] of NOMBRES) {
    if (!flag || !DBG_DIAG_CIELO[flag]) continue;
    const o = escena.getObjectByName(n);
    if (o) materiales(o, ocultos);
  }
  for (const m of ocultos) m.visible = false;
}
