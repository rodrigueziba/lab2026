"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls, SpotLight } from "@react-three/drei";
import * as THREE from "three";
import Chairs from "./Chairs";
import ExperienceDome from "./ExperienceDome";
import Audience from "./Audience";
import Prism from "./Prism";
import Tarima from "./Tarima";
import FaceDome from "./FaceDome";
import LecternSystem, { LECTERN_X, LECTERN_PROMPT_M } from "./LecternSystem";
import DebugMenu from "./DebugMenu";
import { STORE, INTERACT_STATE, storeSubscribe } from "@/lib/alightStore";
import { DBG_SPOTLIGHT, DBG_SILLAS, POINTERLOCK_RETRY_MS, DEBUG_ENABLED } from "@/lib/debugConfig";
import { startVizAudio, VIZ_AUDIO_DEBUG, VIZ_EFFECTS_DEBUG } from "@/lib/vizAudio";

const ZONA_LUZ    = new THREE.Vector3(0, 1.6,  0);
const ZONA_SILLAS = new THREE.Vector3(0, 1.6, -6); // G2: 1 m further

// ── F1: SILLAS visualizer activation (idempotent, module-level) ───────────────
const _D = { path: "none", prismLanded: false, vizActive: false, d: 999, minD: 999 };
let _vizActivated = false;
function activateVisualizer(): void {
  if (_vizActivated) return;
  _vizActivated = true; _D.vizActive = true;
  window.dispatchEvent(new CustomEvent("alight:visualizer-activate"));
}
function deactivateVisualizer(): void {
  _vizActivated = false; _D.vizActive = false;
  window.dispatchEvent(new CustomEvent("alight:visualizer-deactivate"));
}

// ── Room ──────────────────────────────────────────────────────────────────────
function Room() {
  const ceilRef = useRef<THREE.Mesh>(null);
  // H1.1 fix: ceiling at y=22 blocks DomeVisualizer sphere (y=28) via depth test.
  // Hide it while the visualizer is active so the sky is visible.
  useFrame(() => {
    if (ceilRef.current) ceilRef.current.visible = !_D.vizActive;
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#0d0d0f" roughness={0.95} />
      </mesh>
      <mesh position={[0, 11, -40]}>
        <planeGeometry args={[80, 22]} />
        <meshStandardMaterial color="#080809" roughness={1} />
      </mesh>
      <mesh position={[0, 11, 40]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[80, 22]} />
        <meshStandardMaterial color="#080809" roughness={1} />
      </mesh>
      <mesh position={[-40, 11, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[80, 22]} />
        <meshStandardMaterial color="#080809" roughness={1} />
      </mesh>
      <mesh position={[40, 11, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[80, 22]} />
        <meshStandardMaterial color="#080809" roughness={1} />
      </mesh>
      {/* H1.1: ref tracked; hidden when visualizer active (it would block the sky sphere) */}
      <mesh ref={ceilRef} name="room-ceiling" position={[0, 22, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#060606" roughness={1} />
      </mesh>
    </group>
  );
}

// ── C1: DiagonalSpot — responds to STORE.lights.globalIntensity ───────────────
function DiagonalSpot() {
  const [intensity, setIntensity] = useState(DBG_SPOTLIGHT.intensity);
  useEffect(() => storeSubscribe(() => setIntensity(DBG_SPOTLIGHT.intensity * STORE.lights.globalIntensity)), []);
  return (
    <SpotLight
      position={[9, 18, 10]}
      color="#fff5dc"
      intensity={intensity}
      distance={55}
      angle={0.3}
      penumbra={0.4}
      attenuation={6}
      anglePower={5}
      castShadow
    />
  );
}

// ── Dynamic extra lights (T5 add-light button) ────────────────────────────────
function DynamicLights() {
  const [lights, setLights] = useState(STORE.lights.extras.slice());
  useEffect(() => storeSubscribe(() => setLights([...STORE.lights.extras])), []);
  return (
    <>
      {lights.map((l, i) => (
        <pointLight key={i} color={l.color} intensity={l.intensity} position={l.position} />
      ))}
    </>
  );
}

// ── Player movement ───────────────────────────────────────────────────────────
interface Keys { w: boolean; a: boolean; s: boolean; d: boolean }

const SEAT_CAM_Y = 1.0;

function Player() {
  const keys        = useRef<Keys>({ w: false, a: false, s: false, d: false });
  const triggered   = useRef(false);
  const seated      = useRef(false);
  const pathRef     = useRef<"none" | "sillas" | "tarima">("none");
  const prismLanded = useRef(false);
  const prismNearRef = useRef(false); // within prismInteractM horizontally
  const nearLectern = useRef<"none" | "image" | "sound">("none");
  const front       = useRef(new THREE.Vector3());
  const side        = useRef(new THREE.Vector3());
  const dir         = useRef(new THREE.Vector3());
  const leftPos     = useMemo(() => new THREE.Vector3(-LECTERN_X, 1.6, 0), []);
  const rightPos    = useMemo(() => new THREE.Vector3( LECTERN_X, 1.6, 0), []);
  const { camera }  = useThree();

  useEffect(() => { camera.position.set(-10, 1.6, -7); }, [camera]);

  useEffect(() => {
    const onSit    = () => { seated.current = true;  pathRef.current = "sillas"; _D.path = "sillas"; };
    const onLight  = () => {                          pathRef.current = "tarima"; _D.path = "tarima"; };
    const onReveal = () => { seated.current = false; };
    const onLanded = () => { prismLanded.current = true; _D.prismLanded = true; };
    window.addEventListener("alight:chose-chairs", onSit);
    window.addEventListener("alight:chose-light",  onLight);
    window.addEventListener("alight:dome-revealed", onReveal);
    window.addEventListener("alight:prism-landed",  onLanded);
    return () => {
      window.removeEventListener("alight:chose-chairs", onSit);
      window.removeEventListener("alight:chose-light",  onLight);
      window.removeEventListener("alight:dome-revealed", onReveal);
      window.removeEventListener("alight:prism-landed",  onLanded);
    };
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in keys.current) keys.current[k as keyof Keys] = true;
      // E key: activate visualizer (SILLAS only, when close to prism)
      // startVizAudio() is called first so it runs within the gesture stack → no NotAllowedError
      if (k === "e" && pathRef.current === "sillas" && prismNearRef.current && !_vizActivated) {
        startVizAudio().then(r => {
          if (r === "need-gesture")
            window.dispatchEvent(new CustomEvent("alight:audio-need-gesture", { detail: { need: true } }));
        });
        activateVisualizer();
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in keys.current) keys.current[k as keyof Keys] = false;
    };
    document.addEventListener("keydown", down);
    document.addEventListener("keyup",   up);
    return () => {
      document.removeEventListener("keydown", down);
      document.removeEventListener("keyup",   up);
    };
  }, []);

  useFrame(({ camera: cam }) => {
    // Always write player position so Prism.tsx can compute proximity shader
    INTERACT_STATE.playerPos.x = cam.position.x;
    INTERACT_STATE.playerPos.y = cam.position.y;
    INTERACT_STATE.playerPos.z = cam.position.z;

    const perspCam = cam as THREE.PerspectiveCamera;
    if (perspCam.isPerspectiveCamera && perspCam.fov !== STORE.cam.fov) {
      perspCam.fov = STORE.cam.fov;
      perspCam.updateProjectionMatrix();
    }

    // Camera fly-in/out for lectern interaction (Prompt C)
    if (INTERACT_STATE.camAnimActive && INTERACT_STATE.camSaved && INTERACT_STATE.camTarget) {
      const t    = Math.min(1, (Date.now() - INTERACT_STATE.camAnimStart) / INTERACT_STATE.camAnimDur);
      const ease = 1 - Math.pow(1 - t, 3);
      const from = INTERACT_STATE.camAnimReverse ? INTERACT_STATE.camTarget : INTERACT_STATE.camSaved;
      const to   = INTERACT_STATE.camAnimReverse ? INTERACT_STATE.camSaved  : INTERACT_STATE.camTarget;
      cam.position.lerpVectors(
        new THREE.Vector3(...from.pos),
        new THREE.Vector3(...to.pos),
        ease,
      );
      const qFrom = new THREE.Quaternion(...from.quat);
      const qTo   = new THREE.Quaternion(...to.quat);
      cam.quaternion.slerpQuaternions(qFrom, qTo, ease);
      if (t >= 1) INTERACT_STATE.camAnimActive = false;
      return;
    }

    if (seated.current) {
      cam.position.y = THREE.MathUtils.lerp(cam.position.y, SEAT_CAM_Y, 0.04);
      return;
    }

    if (INTERACT_STATE.mode !== "none") return;

    cam.getWorldDirection(front.current);
    front.current.y = 0;
    front.current.normalize();
    side.current.crossVectors(cam.up, front.current).normalize();

    dir.current.set(0, 0, 0);
    if (keys.current.w) dir.current.add(front.current);
    if (keys.current.s) dir.current.sub(front.current);
    if (keys.current.a) dir.current.add(side.current);
    if (keys.current.d) dir.current.sub(side.current);

    if (dir.current.lengthSq() > 0) {
      dir.current.normalize().multiplyScalar(0.12);
      cam.position.add(dir.current);
    }
    cam.position.y = 1.6;

    if (!triggered.current) {
      if (cam.position.distanceTo(ZONA_LUZ) < 2.5) {
        triggered.current = true;
        window.dispatchEvent(new CustomEvent("alight:chose-light"));
      } else if (cam.position.distanceTo(ZONA_SILLAS) < 2.5) {
        triggered.current = true;
        window.dispatchEvent(new CustomEvent("alight:chose-chairs"));
        window.dispatchEvent(new CustomEvent("activar-prisma"));
      }
    }

    // ── SILLAS path: horizontal prism proximity ───────────────────────────────
    if (prismLanded.current && pathRef.current === "sillas") {
      const horizDist = Math.sqrt(cam.position.x * cam.position.x + cam.position.z * cam.position.z);
      _D.d    = horizDist;
      _D.minD = Math.min(_D.minD, horizDist);

      const nearNow = horizDist <= DBG_SILLAS.prismInteractM;
      if (nearNow !== prismNearRef.current) {
        prismNearRef.current = nearNow;
        window.dispatchEvent(new CustomEvent("alight:near-prism", { detail: { near: nearNow } }));
      }

      // Auto-activate on touch distance (player already clicked to enter pointer lock)
      if (!_vizActivated && horizDist <= DBG_SILLAS.prismTouchM) {
        startVizAudio().then(r => {
          if (r === "need-gesture")
            window.dispatchEvent(new CustomEvent("alight:audio-need-gesture", { detail: { need: true } }));
        });
        activateVisualizer();
      }
    }

    // ── TARIMA path: lectern proximity prompt ─────────────────────────────────
    if (pathRef.current === "tarima") {
      leftPos.set(-LECTERN_X, cam.position.y, 0);
      rightPos.set( LECTERN_X, cam.position.y, 0);
      const dL = cam.position.distanceTo(leftPos);
      const dR = cam.position.distanceTo(rightPos);
      let near: "none" | "image" | "sound" = "none";
      if (dL < LECTERN_PROMPT_M) near = "image";
      else if (dR < LECTERN_PROMPT_M) near = "sound";
      if (near !== nearLectern.current) {
        nearLectern.current = near;
        window.dispatchEvent(new CustomEvent("alight:near-lectern", { detail: { which: near } }));
      }
    }
  });

  return null;
}

// ── Scene content ─────────────────────────────────────────────────────────────
function Scene() {
  const [path, setPath] = useState<"none" | "sillas" | "tarima">("none");

  useEffect(() => {
    const onS = () => setPath("sillas");
    const onT = () => setPath("tarima");
    window.addEventListener("alight:chose-chairs", onS);
    window.addEventListener("alight:chose-light",  onT);
    return () => {
      window.removeEventListener("alight:chose-chairs", onS);
      window.removeEventListener("alight:chose-light",  onT);
    };
  }, []);

  return (
    <>
      <color attach="background" args={["#020202"]} />
      <fog attach="fog" args={["#020202", 25, 65]} />
      <ambientLight intensity={0.04} />
      <Room />
      <DiagonalSpot />
      <Tarima />
      <Chairs />
      {path !== "tarima" && <Prism />}
      {path !== "tarima" && <ExperienceDome />}
      {path !== "sillas" && <Audience />}
      {path !== "sillas" && <FaceDome />}
      {path !== "sillas" && <LecternSystem />}
      {path !== "sillas" && <DynamicLights />}
      <Player />
      <PointerLockControls />
    </>
  );
}

// ── HUD: proximity prompts + lectern mode + pointer-lock fallback ─────────────
function NearLecternHUD() {
  const [nearMsg,    setNearMsg]    = useState("");
  const [modeMsg,    setModeMsg]    = useState("");
  const [showRetake, setShowRetake] = useState(false);

  useEffect(() => {
    // TARIMA: lectern proximity
    const onNearLectern = (e: Event) => {
      const which = (e as CustomEvent).detail?.which as string;
      setNearMsg(which !== "none" ? "Tocar E para interactuar" : "");
    };
    // SILLAS: prism proximity (hide on visualizer activation)
    const onNearPrism = (e: Event) => {
      const near = (e as CustomEvent).detail?.near as boolean;
      setNearMsg(near ? "Tocar E para interactuar" : "");
    };
    const onVizOn = () => setNearMsg(""); // hide once activated
    const onMode  = (e: Event) => {
      const mode = (e as CustomEvent).detail?.mode as string;
      if (mode !== "none") { setNearMsg(""); setModeMsg("Apretar Q para dejar el atril"); }
      else setModeMsg("");
    };
    const onLockFail   = () => setShowRetake(true);
    const onShowRetake = () => setShowRetake(true);
    const onLockChange = () => { if (document.pointerLockElement) setShowRetake(false); };

    window.addEventListener("alight:near-lectern",        onNearLectern);
    window.addEventListener("alight:near-prism",          onNearPrism);
    window.addEventListener("alight:visualizer-activate", onVizOn);
    window.addEventListener("alight:lectern-mode",        onMode);
    window.addEventListener("alight:pointerlock-failed",  onLockFail);
    window.addEventListener("alight:show-retake",         onShowRetake);
    document.addEventListener("pointerlockchange",        onLockChange);
    return () => {
      window.removeEventListener("alight:near-lectern",        onNearLectern);
      window.removeEventListener("alight:near-prism",          onNearPrism);
      window.removeEventListener("alight:visualizer-activate", onVizOn);
      window.removeEventListener("alight:lectern-mode",        onMode);
      window.removeEventListener("alight:pointerlock-failed",  onLockFail);
      window.removeEventListener("alight:show-retake",         onShowRetake);
      document.removeEventListener("pointerlockchange",        onLockChange);
    };
  }, []);

  const hudStyle: React.CSSProperties = {
    position: "fixed", bottom: 60, left: "50%", transform: "translateX(-50%)",
    background: "rgba(10,10,20,0.78)", color: "#c8c8e0",
    fontFamily: "monospace", fontSize: 13, padding: "7px 18px",
    borderRadius: 4, border: "1px solid rgba(100,120,180,0.3)",
    pointerEvents: "none", zIndex: 1000, letterSpacing: "0.06em",
  };

  return (
    <>
      {nearMsg && <div style={hudStyle}>{nearMsg}</div>}
      {modeMsg && <div style={{ ...hudStyle, color: "#e0d8ff", border: "1px solid rgba(160,120,255,0.4)" }}>{modeMsg}</div>}
      {showRetake && (
        <div
          onClick={() => { setShowRetake(false); document.querySelector("canvas")?.requestPointerLock(); }}
          style={{
            position: "fixed", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            background: "rgba(10,10,20,0.90)", color: "#e8e0ff",
            fontFamily: "monospace", fontSize: 15, padding: "14px 28px",
            borderRadius: 6, border: "1px solid rgba(140,100,255,0.5)",
            cursor: "pointer", zIndex: 1100, letterSpacing: "0.05em",
            userSelect: "none",
          }}
        >
          Hacé clic para retomar la cámara
        </div>
      )}
    </>
  );
}

// ── HUD: audio autoplay blocked ───────────────────────────────────────────────
function AudioGestureHUD() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onNeed = (e: Event) => setShow(!!(e as CustomEvent).detail?.need);
    window.addEventListener("alight:audio-need-gesture", onNeed);
    return () => window.removeEventListener("alight:audio-need-gesture", onNeed);
  }, []);

  const retry = () => {
    setShow(false);
    window.dispatchEvent(new CustomEvent("alight:retry-viz-audio"));
  };

  if (!show) return null;
  return (
    <div
      onClick={retry}
      style={{
        position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)",
        background: "rgba(10,10,25,0.88)", color: "#a8d0ff",
        fontFamily: "monospace", fontSize: 13, padding: "8px 20px",
        borderRadius: 4, border: "1px solid rgba(80,140,255,0.4)",
        cursor: "pointer", zIndex: 1050, letterSpacing: "0.06em",
        userSelect: "none",
      }}
    >
      Hacé clic para activar el sonido
    </div>
  );
}

// ── Debug: audio state overlay (G2) ───────────────────────────────────────────
function AudioDebugOverlay() {
  const [info, setInfo] = useState("");
  useEffect(() => {
    const id = setInterval(() => {
      const d = VIZ_AUDIO_DEBUG;
      setInfo(
        `ctx=${d.ctxState} | ${d.sourceType} | paused=${d.paused} | t=${d.currentTime.toFixed(1)}s` +
        ` | vol=${d.volume.toFixed(2)} | muted=${d.muted} | rms=${d.rms.toFixed(3)}` +
        (d.lastPlayResult ? ` | play=${d.lastPlayResult}` : ""),
      );
    }, 200);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{
      position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)",
      background: "rgba(0,0,0,0.8)", color: "#ffd080",
      fontFamily: "monospace", fontSize: 10, padding: "4px 12px",
      borderRadius: 3, zIndex: 2001, pointerEvents: "none", whiteSpace: "nowrap",
    }}>
      🔊 {info}
    </div>
  );
}

// ── Debug: sector audio effects overlay (H3) ─────────────────────────────────
function EffectsDebugOverlay() {
  const [info, setInfo] = useState("");
  useEffect(() => {
    const id = setInterval(() => {
      const d = VIZ_EFFECTS_DEBUG;
      const sName = d.sector === -1 ? "inner" : `S${d.sector}`;
      setInfo(
        `fx: ${sName} t=${d.t.toFixed(2)} | LP=${d.lpCut.toFixed(0)}Hz HP=${d.hpCut.toFixed(0)}Hz` +
        ` rate=${d.rate.toFixed(3)} | echoFB=${d.echoFB.toFixed(2)} echoMx=${d.echoMx.toFixed(2)} revMx=${d.revMx.toFixed(2)}`,
      );
    }, 100);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{
      position: "fixed", top: 40, left: "50%", transform: "translateX(-50%)",
      background: "rgba(0,0,0,0.8)", color: "#80d0ff",
      fontFamily: "monospace", fontSize: 10, padding: "3px 12px",
      borderRadius: 3, zIndex: 2002, pointerEvents: "none", whiteSpace: "nowrap",
    }}>
      {info}
    </div>
  );
}

// ── Debug: prism proximity overlay (F1) ───────────────────────────────────────
function PrismDebugOverlay() {
  const [info, setInfo] = useState("");
  useEffect(() => {
    const id = setInterval(() => {
      setInfo(
        `path=${_D.path} | prismLanded=${_D.prismLanded} | vizActive=${_D.vizActive}` +
        ` | d=${_D.d.toFixed(2)}m | minD=${_D.minD.toFixed(2)}m`,
      );
    }, 100);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{
      position: "fixed", top: 8, left: "50%", transform: "translateX(-50%)",
      background: "rgba(0,0,0,0.75)", color: "#7fff7f",
      fontFamily: "monospace", fontSize: 11, padding: "4px 12px",
      borderRadius: 3, zIndex: 2000, pointerEvents: "none", whiteSpace: "nowrap",
    }}>
      {info}
    </div>
  );
}

// ── Canvas wrapper ─────────────────────────────────────────────────────────────
export default function ThreeScene() {
  // Pointer lock cooldown: blocks canvas click if within POINTERLOCK_RETRY_MS of lock exit,
  // preventing drei's PointerLockControls from requesting lock too early after Escape.
  useEffect(() => {
    const lockExit = { t: 0 };
    const onLockChange = () => { if (!document.pointerLockElement) lockExit.t = Date.now(); };
    document.addEventListener("pointerlockchange", onLockChange);

    // Canvas created by R3F, available after child effects run
    const canvas = document.querySelector("canvas");
    const onClick = (e: MouseEvent) => {
      const elapsed = Date.now() - lockExit.t;
      if (elapsed > 0 && elapsed < POINTERLOCK_RETRY_MS) {
        e.stopImmediatePropagation(); // prevent drei from calling requestPointerLock
        window.dispatchEvent(new CustomEvent("alight:show-retake"));
      }
    };
    canvas?.addEventListener("click", onClick, { capture: true });

    return () => {
      document.removeEventListener("pointerlockchange", onLockChange);
      canvas?.removeEventListener("click", onClick, { capture: true });
    };
  }, []);

  return (
    <>
      <Canvas
        style={{ width: "100vw", height: "100vh" }}
        shadows
        camera={{ position: [-10, 1.6, -7], fov: 90 }}
        gl={{ antialias: true }}
      >
        <Scene />
      </Canvas>
      <DebugMenu />
      <NearLecternHUD />
      <AudioGestureHUD />
      {DEBUG_ENABLED && <PrismDebugOverlay />}
      {DEBUG_ENABLED && <AudioDebugOverlay />}
      {DEBUG_ENABLED && <EffectsDebugOverlay />}
    </>
  );
}
