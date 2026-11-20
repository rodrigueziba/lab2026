"use client";
// Z108: MANOS en los atriles (montado por LecternSystem junto a InteractionHandler; vive dentro del <Canvas>, que ya se
// carga con dynamic + ssr:false). Hace cuatro cosas:
//  1. la tecla de embrague (DBG_MANOS.EMBRAGUE_TECLA, ESPACIO por defecto) mantenida, solo con MANOS activo y en un atril;
//  2. el tick del seguimiento (lib/manosAtril.ts: cuadros al worker, lógica pura, aplicar por la vía del mouse);
//  3. el resalte: un anillo sobre el control bajo el cursor (ámbar) y sobre el agarrado (verde), además del cursor;
//  4. el esqueleto de debug (21 puntos) en un canvas chico, oculto por defecto (DBG_MANOS.MOSTRAR_ESQUELETO).
// Sin allocations por cuadro (vectores, cuaternión y colores reutilizados). Al desmontar: listeners, anillo, aria y
// overlay fuera, y MANOS apagado (worker, cuadros y stream propio liberados).
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DBG_MANOS } from "@/lib/debugConfig";
import { INTERACT_STATE } from "@/lib/alightStore";
import { MANOS, EST_MANOS, AGARRE, PUENTE_MANOS, tickManos, setTeclaEmbrague, setMouseSimManos, liberarManos } from "@/lib/manosAtril";
import { esContinuo } from "@/lib/manoControl";
import { N_PUNTOS } from "@/lib/manos";

const COLOR_HOVER = new THREE.Color("#FF9A1F");     // ámbar de las pantallas
const COLOR_AGARRADO = new THREE.Color("#2E9E5B");  // verde de las franjas
const _pos = new THREE.Vector3(), _q = new THREE.Quaternion(), _qp = new THREE.Quaternion();
const Q_PLANO = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));   // anillo acostado sobre el panel
// pares de puntos del esqueleto (dedos y palma)
const HUESOS = [0, 1, 1, 2, 2, 3, 3, 4, 0, 5, 5, 6, 6, 7, 7, 8, 5, 9, 9, 10, 10, 11, 11, 12, 9, 13, 13, 14, 14, 15, 15, 16, 13, 17, 17, 18, 18, 19, 19, 20, 0, 17];

export default function ManosTarima() {
  const anillo = useRef<THREE.Mesh>(null);
  const esqueleto = useRef<HTMLCanvasElement | null>(null);
  const recursos = useMemo(() => ({
    geo: new THREE.RingGeometry(0.058, 0.068, 40),
    mat: new THREE.MeshBasicMaterial({ color: COLOR_HOVER, toneMapped: false, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
  }), []);

  useEffect(() => {
    // aria-live "polite": anuncio al activar y desactivar
    const div = document.createElement("div");
    div.setAttribute("aria-live", "polite"); div.setAttribute("role", "status");
    div.style.cssText = "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0";
    document.body.appendChild(div);
    PUENTE_MANOS.aria = div;
    const enDebug = (t: EventTarget | null) => !!(t as Element | null)?.closest?.("[data-debug-panel]");
    const activo = () => MANOS.on && INTERACT_STATE.mode !== "none";
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== DBG_MANOS.EMBRAGUE_TECLA || !activo() || enDebug(e.target)) return;
      e.preventDefault();   // sin desplazar la página ni "apretar" un botón enfocado
      if (!e.repeat) setTeclaEmbrague(true);
    };
    const onUp = (e: KeyboardEvent) => { if (e.code === DBG_MANOS.EMBRAGUE_TECLA) setTeclaEmbrague(false); };
    const onBlur = () => setTeclaEmbrague(false);
    const onMove = (e: PointerEvent) => { if (DBG_MANOS.SIM_CON_MOUSE) setMouseSimManos(1 - e.clientY / Math.max(1, window.innerHeight)); };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointermove", onMove);
      liberarManos();
      PUENTE_MANOS.aria = null; div.remove();
      if (esqueleto.current) { esqueleto.current.remove(); esqueleto.current = null; }
    };
  }, []);

  useEffect(() => () => { recursos.geo.dispose(); recursos.mat.dispose(); }, [recursos]);

  useFrame(() => {
    const modo = INTERACT_STATE.mode;
    tickManos(modo, typeof document !== "undefined" && document.hidden);
    // resalte: agarrado (verde) o, con MANOS activo, el control continuo bajo el cursor (ámbar)
    const m = anillo.current;
    if (m) {
      const obj = (AGARRE.agarrado ? MANOS.agarradoObj : MANOS.on && PUENTE_MANOS.hover && esContinuo(PUENTE_MANOS.hover.type) ? PUENTE_MANOS.hoverObj : null) as THREE.Object3D | null;
      const ver = DBG_MANOS.RESALTE && modo !== "none" && !!obj && !!obj.parent;
      m.visible = ver;
      if (ver && obj) {
        obj.getWorldPosition(_pos); obj.getWorldQuaternion(_q);
        if (m.parent) { m.parent.worldToLocal(_pos); m.parent.getWorldQuaternion(_qp); _q.premultiply(_qp.invert()); }   // a coordenadas del padre
        m.position.copy(_pos); m.quaternion.copy(_q).multiply(Q_PLANO);
        recursos.mat.color.copy(AGARRE.agarrado ? COLOR_AGARRADO : COLOR_HOVER);
      }
    }
    dibujarEsqueleto(esqueleto);
  });

  return <mesh ref={anillo} geometry={recursos.geo} material={recursos.mat} visible={false} renderOrder={20} frustumCulled={false} />;
}

/** Overlay de debug con los 21 puntos de la mano elegida (oculto por defecto; se crea solo si se pide). */
function dibujarEsqueleto(ref: React.MutableRefObject<HTMLCanvasElement | null>): void {
  if (!DBG_MANOS.MOSTRAR_ESQUELETO || !MANOS.on) {
    if (ref.current && ref.current.style.display !== "none") ref.current.style.display = "none";
    return;
  }
  let cv = ref.current;
  if (!cv) {
    cv = document.createElement("canvas");
    cv.width = 192; cv.height = 144;
    cv.setAttribute("data-debug-panel", "manos-esqueleto");
    cv.style.cssText = "position:fixed;left:12px;bottom:12px;width:192px;height:144px;background:#2A1400;border:1px solid #FF9A1F;z-index:60;pointer-events:none";
    document.body.appendChild(cv);
    ref.current = cv;
  }
  if (cv.style.display === "none") cv.style.display = "block";
  const c = cv.getContext("2d");
  if (!c) return;
  c.fillStyle = "#2A1400"; c.fillRect(0, 0, 192, 144);
  if (!EST_MANOS.vista) return;
  const P = EST_MANOS.puntos;
  // espejado para que se vea como un espejo (la mano derecha a la derecha)
  c.strokeStyle = EST_MANOS.postura ? "#2E9E5B" : "#FF9A1F"; c.lineWidth = 1.5;
  c.beginPath();
  for (let k = 0; k < HUESOS.length; k += 2) {
    const a = HUESOS[k], b = HUESOS[k + 1];
    c.moveTo((1 - P[a * 2]) * 192, P[a * 2 + 1] * 144); c.lineTo((1 - P[b * 2]) * 192, P[b * 2 + 1] * 144);
  }
  c.stroke();
  c.fillStyle = EST_MANOS.pellizco ? "#E5322B" : "#FF9A1F";
  for (let i = 0; i < N_PUNTOS; i++) c.fillRect((1 - P[i * 2]) * 192 - 1.5, P[i * 2 + 1] * 144 - 1.5, 3, 3);
}
