"use client";
// Z42: las 4 luces del visualizador con el diseño de la luz de la narrativa (LuzLejana, Z28):
// halo (sprite aditivo con scanlines tenues), cono suave y charco en el piso, en el color de cada una
// (DBG_SILLAS.hazColor0…3). Reemplaza solo lo VISUAL de la lámpara de HazSystem (carcasa, cable, LED,
// franjas, cono a franjas), que queda detrás de DBG_LUCES.DISENO_NUEVO=false. La lógica no cambia y
// sigue en HazSystem / lib/haz.ts: posiciones, activación al pasar, 'alight:haz-toggle', estado, audio,
// amanecer y SpotLights (no se agregan ni quitan luces reales → no recompila materiales).
// Estado: encendida = getHazBandOn(i). Apagada = halo tenue (INT_APAGADA) y cono/charco × APAGADA_CONO.
// Música: energía de la banda asignada a esa luz (BAND_STATE.assignment[i], la misma de su grupo del
// domo; simPulse i en debug), solo encendida → brillo y tamaño del halo, opacidad y radio de cono y charco.
// Al cambiar de estado, el mismo destello U6B que el cono anterior (u6Flash*/u6Dim*).
// Orden de dibujo: renderOrder 10 como la luz de la narrativa (después del cielo −0,5 y el domo −1);
// depthTest normal y sin depthWrite: el prisma, los monolitos y los paneles opacos la tapan.
// Sin allocations por frame; geometrías y textura del halo compartidas; un material por luz (color propio;
// R3F los libera al desmontar).

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_SILLAS, DBG_LUCES } from "@/lib/debugConfig";
import { hazPosXZEn, getHazBandOn } from "@/lib/haz";
import { BAND_STATE } from "@/lib/vizAudio";
import { CONO_VERT, CONO_FRAG, POZO_VERT, POZO_FRAG, CONO_GEO_ARGS, crearHalo } from "@/lib/luz/luzVisual";

const N = 4;
const COLOR_KEYS = ["hazColor0", "hazColor1", "hazColor2", "hazColor3"] as const;
const SIM_KEYS = ["simPulse0", "simPulse1", "simPulse2", "simPulse3"] as const;
const POZO_Y = 0.02;      // por encima de los anillos U6A (0,008) y los símbolos del piso (0,006)
const POZO_FACTOR = 1.5;  // el charco es 1,5 × el radio del cono (igual que la luz de la narrativa)

// uniforms de módulo, uno por luz (mismo patrón que CONO_UNIFORMS / POZO_UNIFORMS de LuzLejana)
const UNIF_CONO = COLOR_KEYS.map(k => ({ uColor: { value: new THREE.Color(DBG_SILLAS[k]) }, uOpacidad: { value: 0 } }));
const UNIF_POZO = COLOR_KEYS.map(k => ({ uColor: { value: new THREE.Color(DBG_SILLAS[k]) }, uOpacidad: { value: 0 } }));

const _pos = { x: 0, z: 0 };  // salida reutilizada de hazPosXZEn

interface Destello { activo: boolean; t0: number; on: boolean }

export default function LucesHaz() {
  const raizRef = useRef<THREE.Group>(null);
  const haloRefs = useRef<(THREE.Sprite | null)[]>([null, null, null, null]);
  const conoRefs = useRef<(THREE.Mesh | null)[]>([null, null, null, null]);
  const pozoRefs = useRef<(THREE.Mesh | null)[]>([null, null, null, null]);
  const energia = useRef([0, 0, 0, 0]);
  const destello = useRef<Destello[]>([0, 1, 2, 3].map(() => ({ activo: false, t0: 0, on: false })));
  const pendiente = useRef<(boolean | null)[]>([null, null, null, null]);
  const colorHex = useRef<string[]>(["", "", "", ""]);   // "" → el primer frame copia el color actual

  const halo = useMemo(() => crearHalo("neutra"), []);
  const geoCono = useMemo(() => new THREE.CylinderGeometry(...CONO_GEO_ARGS), []);
  const geoPozo = useMemo(() => new THREE.CircleGeometry(1, 64), []);

  useEffect(() => () => { halo.dispose(); geoCono.dispose(); geoPozo.dispose(); }, [halo, geoCono, geoPozo]);

  // destello al cambiar de estado (el evento lo emite lib/haz.ts; el tiempo se toma en useFrame)
  useEffect(() => {
    const onToggle = (e: Event) => {
      const { index, on } = (e as CustomEvent).detail as { index: number; on: boolean };
      if (index >= 0 && index < N) pendiente.current[index] = on;
    };
    window.addEventListener("alight:haz-toggle", onToggle);
    return () => window.removeEventListener("alight:haz-toggle", onToggle);
  }, []);

  useFrame(({ clock }, dt) => {
    const on = DBG_LUCES.DISENO_NUEVO;
    if (raizRef.current) raizRef.current.visible = on;
    if (!on) return;

    const alto = DBG_SILLAS.hazOriginHM;
    const now = clock.elapsedTime;
    const kAt = 1 - Math.exp(-dt / Math.max(0.005, DBG_LUCES.ATAQUE_S));
    const kCa = 1 - Math.exp(-dt / Math.max(0.005, DBG_LUCES.CAIDA_S));

    for (let i = 0; i < N; i++) {
      const uCono = UNIF_CONO[i], uPozo = UNIF_POZO[i];
      const hex = DBG_SILLAS[COLOR_KEYS[i]];
      if (hex !== colorHex.current[i]) {
        colorHex.current[i] = hex;
        uCono.uColor.value.set(hex); uPozo.uColor.value.set(hex);
      }

      // destello U6B (mismas constantes y curva que el cono anterior de HazSystem)
      const fl = destello.current[i];
      const p = pendiente.current[i];
      if (p !== null) { fl.activo = true; fl.t0 = now; fl.on = p; pendiente.current[i] = null; }
      let flash = 1;
      if (fl.activo) {
        const fe = now - fl.t0;
        if (fl.on) {
          const pk = DBG_SILLAS.u6FlashPeak, atk = Math.max(1e-3, DBG_SILLAS.u6FlashAtkS);
          flash = fe < atk ? 1 + (pk - 1) * fe / atk : 1 + (pk - 1) * Math.exp(-(fe - atk) / Math.max(1e-3, DBG_SILLAS.u6FlashDecS));
          if (fe >= atk && flash < 1.005) { fl.activo = false; flash = 1; }
        } else {
          const dim = DBG_SILLAS.u6DimFactor;
          flash = dim + (1 - dim) * (1 - Math.exp(-fe / Math.max(1e-3, DBG_SILLAS.u6DimDecS)));
          if (flash > 0.995) { fl.activo = false; flash = 1; }
        }
      }

      // energía de su banda (misma fuente que el domo), solo encendida
      const encendida = getHazBandOn(i);
      const sim = DBG_SILLAS[SIM_KEYS[i]];
      const bruta = sim > 0 ? sim : (BAND_STATE.normEnergy[BAND_STATE.assignment[i]] ?? 0);
      const objetivo = encendida ? Math.min(1, Math.max(0, bruta)) : 0;
      const ePrev = energia.current[i];
      const e = ePrev + (objetivo - ePrev) * (objetivo > ePrev ? kAt : kCa);
      energia.current[i] = e;

      const base = encendida ? 1 : DBG_LUCES.APAGADA_CONO;
      const rad = DBG_LUCES.CONO_RADIO_M * DBG_LUCES.RADIO_X[i] * (1 + DBG_LUCES.REACT_RADIO * e);
      const kCono = base * (1 + DBG_LUCES.REACT_CONO * e) * flash;
      hazPosXZEn(i, _pos);
      const bx = _pos.x, bz = _pos.z;

      const sp = haloRefs.current[i];
      if (sp) {
        sp.position.set(bx, alto, bz);
        sp.scale.setScalar(DBG_LUCES.HALO_M * DBG_LUCES.HALO_X[i] * (1 + DBG_LUCES.REACT_HALO * e));
        const int = (encendida ? DBG_LUCES.INT_ENCENDIDA : DBG_LUCES.INT_APAGADA) * (1 + DBG_LUCES.REACT_INT * e) * flash;
        (sp.material as THREE.SpriteMaterial).color.copy(uCono.uColor.value).multiplyScalar(int);
      }
      const cono = conoRefs.current[i];
      if (cono) {
        cono.position.set(bx, alto * 0.5, bz);
        cono.scale.set(rad, alto, rad);
        uCono.uOpacidad.value = DBG_LUCES.CONO_OPACIDAD * DBG_LUCES.CONO_X[i] * kCono;
      }
      const pozo = pozoRefs.current[i];
      if (pozo) {
        pozo.position.set(bx, POZO_Y, bz);
        pozo.scale.setScalar(rad * POZO_FACTOR);
        uPozo.uOpacidad.value = DBG_LUCES.POZO_OPACIDAD * DBG_LUCES.POZO_X[i] * kCono;
      }
    }
  });

  return (
    <group ref={raizRef} name="luces-haz">
      {COLOR_KEYS.map((k, i) => (
        <group key={k}>
          <sprite ref={el => { haloRefs.current[i] = el; }} name={`luz-haz-halo-${i}`} renderOrder={10}>
            <spriteMaterial map={halo} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
          </sprite>
          <mesh ref={el => { conoRefs.current[i] = el; }} name={`luz-haz-cono-${i}`} geometry={geoCono} renderOrder={10} frustumCulled={false}>
            <shaderMaterial vertexShader={CONO_VERT} fragmentShader={CONO_FRAG} uniforms={UNIF_CONO[i]}
              transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
          </mesh>
          <mesh ref={el => { pozoRefs.current[i] = el; }} name={`luz-haz-pozo-${i}`} geometry={geoPozo} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
            <shaderMaterial vertexShader={POZO_VERT} fragmentShader={POZO_FRAG} uniforms={UNIF_POZO[i]}
              transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
