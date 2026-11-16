"use client";
// Z70: estado, efectos y manejadores del menú de debug (movidos tal cual desde el cuerpo de DebugMenu).
// El contenedor (DebugMenu.tsx) lo llama una vez y lo pasa por contexto a las secciones (components/debug/contexto.ts).
import { useState, useEffect, useRef } from "react";
import { leerPremio } from "@/lib/dialogo/efectosEstado";
import { DBG_EFECTOS, DBG_MOV, DBG_AMANECER, DBG_SECUENCIA, DBG_CHECKPOINTS, DBG_LAYOUT, DBG_FRACTAL, DBG_TELON_TEXTO, DBG_LUCES, DBG_SPOTLIGHT, DBG_STARS, DBG_DOME, DBG_FACE, DBG_LECTERNS, DBG_RETRO, DBG_RETRO_FX, DBG_SILLAS, DBG_PRISM, DBG_FLOOR, DBG_EFFECTS, DBG_CAM_IMAGE, DBG_CAM_SOUND, DOME_METERS, DBG_DOME_LIVE, DBG_FLASH, DBG_LINTERNA, DBG_SUBPANELES, DBG_ORBITAS, DBG_ACERC, DBG_PRIORIDAD, DBG_LOG_PANEL, DBG_AISLAR_UI, DBG_FOCO, DBG_VIDEO, DBG_DIALOGO, DBG_LUZ, DBG_PISO_ICONOS, DBG_INICIO, DBG_PANELES, DEBUG_MENU_ESTADO, DEBUG_ENABLED } from "@/lib/debugConfig";
import { PASTO } from "@/lib/pasto";
import { FLUIDO } from "@/lib/fluidoBloques";
import { DIA, PORTAL_GEOM } from "@/lib/cicloDia";
import { EJE_PANT } from "@/components/EjeOverlay";
import { FLOR } from "@/lib/prismaFlor";
import { STORE, PANELES_SILLAS, storeSubscribe } from "@/lib/alightStore";
import { FLASH_STATE, FLASH_MEDICION, estimarLuminanciaPico } from "@/lib/curtainFlash";
import { CRT_UNIFORMS } from "@/lib/retro/retroCRT";
import { LINTERNA_STATE, ACERC, ORBITAS_INFO } from "@/lib/linternaPaneles";
import { FOCO, FOCO_PASO, FOCO_COBERTURA } from "@/lib/focoSubpanel";
import { BIG_MESH_DATA } from "@/lib/bigMeshData";
import { DBG_STAR_MAT, DBG_DOME_MAT } from "@/components/FaceDome";
import { Tab } from "./comun";

export function useDebugEstado() {
  const [visible, setVisible] = useState(false);
  // Z29: el premio (localStorage, 1 h) desbloquea el menú aunque DEBUG_ENABLED sea false
  const [premio, setPremio] = useState(() => leerPremio());
  const [avisoDesbloqueo, setAvisoDesbloqueo] = useState(false);
  const [efx, setEfx] = useState({ ...DBG_EFECTOS });
  const [mov, setMov] = useState({ ...DBG_MOV });                          // Z34
  const [amn, setAmn] = useState({ ...DBG_AMANECER });                     // Z38
  const [sec, setSec] = useState({ ...DBG_SECUENCIA });                    // Z39
  const [ckf, setCkf] = useState({ ...DBG_CHECKPOINTS });                  // Z40
  const [lay, setLay] = useState({ ...DBG_LAYOUT });                       // Z41
  const [frc, setFrc] = useState({ ...DBG_FRACTAL });                      // Z43
  const [ttx, setTtx] = useState({ ...DBG_TELON_TEXTO });                  // Z46
  // Z48: ciclo de día — los valores viven en DBG_DIA (anidados); diaV fuerza el re-render al cambiarlos
  const [, setDiaV] = useState(0);
  const tocarDia = () => setDiaV(n => n + 1);
  const [diaLive, setDiaLive] = useState("");
  const [ejeLive, setEjeLive] = useState("");   // Z50: indicador del eje del sol (OVERLAY_EJE)
  const [fluLive, setFluLive] = useState({ a: 0, n: 0, ba: 0, bn: 0 });   // Z63: energía de cada bloque
  const [pastoLive, setPastoLive] = useState("");   // Z64: progreso de cada cuarto
  // Z70: las lecturas en vivo solo corren con el menú abierto (antes también cerrado: re-render cada 150–250 ms)
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setPastoLive(PASTO.p.map((p, i) => `${i + 1}: ${p.toFixed(2)}${PASTO.completo[i] ? " ✓" : PASTO.dentro[i] ? " bajo la luz" : ""}`).join(" · ")), 200);
    return () => clearInterval(id);
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setFluLive({ a: FLUIDO.eA, n: FLUIDO.eN, ba: FLUIDO.bandaA, bn: FLUIDO.bandaN }), 150);
    return () => clearInterval(id);
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      const g = (r: number) => ((r * 180 / Math.PI) % 360 + 360) % 360;
      const dAz = ((DIA.solAz - PORTAL_GEOM.azRad) * 180 / Math.PI % 360 + 540) % 360 - 180;
      setEjeLive(Number.isFinite(PORTAL_GEOM.azRad)
        ? `portal az ${g(PORTAL_GEOM.azRad).toFixed(2)}° · sol az ${g(DIA.solAz).toFixed(2)}° · Δaz centro ${dAz.toFixed(3)}° · sol elev ${(DIA.solAlt * 180 / Math.PI).toFixed(1)}° · tDia ${DIA.dia.toFixed(3)}`
          + (Number.isFinite(EJE_PANT.difPx) ? ` · Z55 sol − eje: ${EJE_PANT.difPx.toFixed(1)} px, ${EJE_PANT.difDeg.toFixed(3)}° az` : "")
        : "portal sin montar");
    }, 250);
    return () => clearInterval(id);
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setDiaLive(
      `tDia=${DIA.dia.toFixed(3)} · ${DIA.etapa} · sol ${(DIA.solAlt * 180 / Math.PI).toFixed(1)}° · fase=${DIA.fase}` +
      ` · t=${DIA.t.toFixed(1)}/${(DIA.dur).toFixed(0)} s · intro=${(DIA.intro * 100).toFixed(0)}% · montañas=${DIA.montCrece.toFixed(2)}` +
      ` · luz=${DIA.luz.toFixed(2)} · estrellas=${DIA.estrellas.toFixed(2)} · ciclos=${DIA.ciclos}` +
      ` · prisma ${FLOR.altura.toFixed(2)} · flor ${FLOR.escala.toFixed(2)} / apertura ${FLOR.apertura.toFixed(2)}`), 250);   // Z54
    return () => clearInterval(id);
  }, [visible]);
  const [luc, setLuc] = useState({ ...DBG_LUCES, HALO_X: [...DBG_LUCES.HALO_X], RADIO_X: [...DBG_LUCES.RADIO_X], CONO_X: [...DBG_LUCES.CONO_X], POZO_X: [...DBG_LUCES.POZO_X] }); // Z42
  const [tab, setTab]         = useState<Tab>("SILLAS");
  const [spot,     setSpot]     = useState({ ...DBG_SPOTLIGHT });
  const [stars,    setStars]    = useState({ ...DBG_STARS });
  const [dome,     setDome]     = useState({ ...DBG_DOME });
  const [face,     setFace]     = useState({ ...DBG_FACE });
  const [lectern,  setLectern]  = useState({ ...DBG_LECTERNS });
  const [retro,    setRetro]    = useState({ ...DBG_RETRO });
  const [retroFx,  setRetroFx]  = useState({ ...DBG_RETRO_FX });
  const [sillas,   setSillas]   = useState({ ...DBG_SILLAS });
  const [legacyOpen, setLegacyOpen] = useState(false); // N2: Legado section collapsed by default
  const [bandRev,    setBandRev]    = useState(0);     // N4: bumped on reshuffle to re-render assignment
  const [bandOnArr,  setBandOnArr]  = useState([false, false, false, false]); // R3: toggle state per beam
  const [prism,    setPrism]    = useState({ ...DBG_PRISM });
  const [floor,    setFloor]    = useState({ ...DBG_FLOOR });
  const [fx,       setFx]       = useState({ ...DBG_EFFECTS });
  const [camImg,   setCamImg]   = useState({ ...DBG_CAM_IMAGE });
  const [camSnd,   setCamSnd]   = useState({ ...DBG_CAM_SOUND });
  const [audioVol, setAudioVol] = useState(STORE.audio.volume);
  const focusRef                = useRef(false);
  // W4: medidores del domo — se pollea a 10fps solo cuando showDomeMeters está activo
  const [domeM, setDomeM] = useState({ sol: 0, mont: 0, cielo: 0, lin: 0, kick: 0, dawn: 0, phase: 'inactivo' });
  useEffect(() => {
    if (!sillas.showDomeMeters || !visible) return;   // Z70: solo con el menú abierto
    const id = setInterval(() => setDomeM({ ...DOME_METERS }), 100);
    return () => clearInterval(id);
  }, [sillas.showDomeMeters, visible]);
  // X2: diagnóstico domo — se pollea a 10fps solo cuando showDomeX2 está activo
  const [domeX2, setDomeX2] = useState({ ...DBG_DOME_LIVE });
  const [domeForce, setDomeForce] = useState({ visible: false, masks: false });
  useEffect(() => {
    if (!sillas.showDomeX2 || !visible) return;   // Z70: solo con el menú abierto
    const id = setInterval(() => setDomeX2({ ...DBG_DOME_LIVE }), 100);
    return () => clearInterval(id);
  }, [sillas.showDomeX2, visible]);

  // F1: destello del telón — constantes + estado en vivo (poll 10fps solo con el menú abierto)
  const [flash, setFlash] = useState({ ...DBG_FLASH });
  const [flashLive, setFlashLive] = useState({ fase: FLASH_STATE.fase as string, luz: 0, visible: false, uFlash: 0, uGlare: 0, lum: 0 });
  const [medicion, setMedicion] = useState({ ...FLASH_MEDICION }); // G2: medición real del pico
  // Z2: linterna — constantes + estado en vivo (mismo poll de 10 fps)
  const [linterna, setLinterna] = useState({ ...DBG_LINTERNA });
  const [linternaLive, setLinternaLive] = useState("inactiva");
  const [subp, setSubp] = useState({ ...DBG_SUBPANELES }); // Z4
  const [orb, setOrb] = useState({ ...DBG_ORBITAS });       // Z7
  const [acerc, setAcerc] = useState({ ...DBG_ACERC });     // Z8
  const [prio, setPrio] = useState({ ...DBG_PRIORIDAD });   // Z10
  const [logPanelOn, setLogPanelOn] = useState(DBG_LOG_PANEL.LOG_ACTIVO); // Z12
  const [aislar, setAislar] = useState(DBG_AISLAR_UI.MODO);                // Z17
  const [foco, setFoco] = useState({ ...DBG_FOCO });                        // Z19
  const [video, setVideo] = useState({ ...DBG_VIDEO });                     // video etapa 1
  const [dlg, setDlg] = useState({ ...DBG_DIALOGO });                      // Z27
  const [luz, setLuz] = useState({ ...DBG_LUZ });                          // Z28
  const [piso, setPiso] = useState({ ...DBG_PISO_ICONOS });                 // Z23
  const [inicio, setInicio] = useState({ ...DBG_INICIO });                  // Z24
  const [focoLive, setFocoLive] = useState("nada");                          // Z19
  const [acercLive, setAcercLive] = useState("orbita");     // Z8
  const [orbInfo, setOrbInfo] = useState("");               // Z7: tabla de anillos
  // P1: paneles SILLAS — constantes + estado en vivo (mismo poll)
  const [paneles, setPaneles] = useState({ ...DBG_PANELES, forzado: false });
  const [panelesFase, setPanelesFase] = useState(PANELES_SILLAS.fase as string);
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setFlashLive({
      fase: FLASH_STATE.fase, luz: FLASH_STATE.luzTelon,
      visible: FLASH_STATE.telonMontado && FLASH_STATE.telonVisible,
      uFlash: CRT_UNIFORMS.uFlash.value, // F2
      uGlare: CRT_UNIFORMS.uGlare.value, // G1
      // F3: luminancia final estimada en el centro en el pico (fórmula CRT + ACES + sRGB)
      lum: estimarLuminanciaPico(CRT_UNIFORMS.uFlashColor.value, CRT_UNIFORMS.uTint.value,
        CRT_UNIFORMS.uScan.value, CRT_UNIFORMS.uLift.value, DBG_RETRO_FX.toneExposure, CRT_UNIFORMS.uGrain.value),
    }), 100);
    const idP = setInterval(() => {
      setPanelesFase(PANELES_SILLAS.fase); // P1
      { // Z2
        const L = LINTERNA_STATE;
        const txt = `${L.habilitada ? "habilitada" : "NO habilitada (movimiento bloqueado)"} · ${L.fase}${L.sel ? ` · panel ${L.sel.indice} · ${L.sel.angulo.toFixed(1)}° · ${Math.round(L.progreso * 100)}%` : ""}${L.apagada ? " · apagada" : ""}`;
        setLinternaLive(prev => (prev === txt ? prev : txt));
      }
      { // Z19
        const txt = `${FOCO.fase}${FOCO.candidato && FOCO.fase === "nada" ? ` · dwell ${Math.round(FOCO_PASO.progreso * 100)}%` : ""}${FOCO.id ? ` · ${FOCO.id} · ${Math.round(FOCO.f * 100)}% · pantalla ${(FOCO_COBERTURA.ancho * 100).toFixed(0)}×${(FOCO_COBERTURA.alto * 100).toFixed(0)}% · ${(FOCO.ancho * 180 / Math.PI).toFixed(0)}×${(FOCO.alto * 180 / Math.PI).toFixed(0)}°` : FOCO.candidato ? ` · dwell ${FOCO.candidato}` : ""} · resto ${(FOCO.atenua * 100).toFixed(0)}%`;
        setFocoLive(prev => (prev === txt ? prev : txt));
      }
      { // Z8
        const L = ACERC.layout;
        const D2 = 180 / Math.PI;
        const esf = L.esferico ? ` · esférico: panel ${((L.pAncho ?? 0) * D2).toFixed(1)}×${((L.pAlto ?? 0) * D2).toFixed(1)}° a ${((L.pPitch ?? 0) * D2).toFixed(1)}° · laterales ${((L.lAncho ?? 0) * D2).toFixed(1)}° a ±${((L.lYaw ?? 0) * D2).toFixed(1)}° (borde ${((L.yawExt ?? 0) * D2).toFixed(1)}°) · FICHA a ${((L.fPitch ?? 0) * D2).toFixed(1)}°${L.entra ? "" : " ✗ no entra"}` : "";
        const conc = L.esferico ? esf : L.domo ? ` · domo R ${L.d.toFixed(1)} m · laterales ${(L.latDeg ?? 0).toFixed(1)}° a ±${((L.yaw ?? 0) * 180 / Math.PI).toFixed(1)}° (borde ${((L.yawExt ?? 0) * 180 / Math.PI).toFixed(1)}°)${L.lateralesEntran === false ? " ✗ laterales no entran" : ""}`
          : L.concavo ? ` · cóncavo yaw ${((L.yaw ?? 0) * 180 / Math.PI).toFixed(0)}° (borde ${((L.yawExt ?? 0) * 180 / Math.PI).toFixed(0)}°) · FICHA ${((L.pitch ?? 0) * 180 / Math.PI).toFixed(0)}°` : "";
        const txt = `${ACERC.fase}${conc}${ACERC.fase === "abierto" ? (ACERC.miraDentro ? " · mira dentro" : ` · fuera ${ACERC.tFuera ? Math.round(performance.now() - ACERC.tFuera) : 0} ms`) : ""}${ACERC.panel ? ` · panel ${ACERC.panel.indice} · d ${ACERC.distancia.toFixed(2)} m · sube ${L.up.toFixed(2)} m${L.alejado ? " · alejado" : ""}${L.entra ? "" : " · ✗ no entra"}` : ""} · subpaneles ${(ACERC.escalaSub * 100).toFixed(0)} %`;
        setAcercLive(prev => (prev === txt ? prev : txt));
      }
      { // Z7
        const I = ORBITAS_INFO;
        const txt = I.anillos.map((a, i) => `A${i}: r ${a.radio.toFixed(1)} · y ${a.altura.toFixed(2)} [${a.yMin.toFixed(1)}–${a.yMax.toFixed(1)}] · v ${(a.vel * 60).toFixed(4)} rad/s · ${a.cantidad}/${a.capacidad}${a.entra ? "" : " ✗ no entra"}`).join("\n")
          + `\nTOTAL ${I.total} de ${I.pedidos} · origen haces y ${I.yHaz.toFixed(2)} · regeneración ${I.version}`;
        setOrbInfo(prev => (prev === txt ? prev : txt));
      }
      setMedicion(m => (m.estado === FLASH_MEDICION.estado && m.centro === FLASH_MEDICION.centro ? m : { ...FLASH_MEDICION })); // G2
    }, 100);
    return () => { clearInterval(id); clearInterval(idP); };
  }, [visible]);

  // Z2: Meshes grandes — se pollea a 2fps solo cuando showBigMeshes está activo
  const [bigMeshList, setBigMeshList] = useState<typeof BIG_MESH_DATA>([]);
  const [meshHidden, setMeshHidden] = useState<Record<number, boolean>>({});
  useEffect(() => {
    if (!sillas.showBigMeshes || !visible) return;   // Z70: solo con el menú abierto
    const id = setInterval(() => { if (BIG_MESH_DATA.length) setBigMeshList([...BIG_MESH_DATA]); }, 500);
    return () => clearInterval(id);
  }, [sillas.showBigMeshes, visible]);

  // Sync audio volume from STORE changes
  useEffect(() => storeSubscribe(() => setAudioVol(STORE.audio.volume)), []);

  // R3: keep bandOnArr in sync — fires from both walking and debug buttons
  useEffect(() => {
    const onToggle = (e: Event) => {
      const { index, on } = (e as CustomEvent).detail as { index: number; on: boolean };
      setBandOnArr(arr => { const next = [...arr]; next[index] = on; return next; });
    };
    window.addEventListener("alight:haz-toggle", onToggle);
    return () => window.removeEventListener("alight:haz-toggle", onToggle);
  }, []);

  // Shift toggles the panel; ignore when focus is in a text/number input.
  // U8: release pointer lock when opening so the user doesn't need ESC first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Shift" && !focusRef.current) {
        setVisible(v => {
          if (!v && document.pointerLockElement) document.exitPointerLock();
          return !v;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Z27: la terminal de diálogo lee si el menú está abierto (marca de líneas pendientes)
  useEffect(() => {
    DEBUG_MENU_ESTADO.visible = DEBUG_ENABLED && visible;
  }, [visible]);

  // Z29: premio otorgado → menú visible + aviso tenue de desbloqueo; premio borrado o vencido → se relee
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const onPremio = () => {
      setPremio(true);
      setVisible(true);
      setAvisoDesbloqueo(true);
      if (t) clearTimeout(t);
      t = setTimeout(() => setAvisoDesbloqueo(false), Math.max(0, DBG_EFECTOS.AVISO_DESBLOQUEO_MS));
    };
    const onCambio = () => setPremio(leerPremio());
    // el premio vence aunque la página siga abierta: se relee cada minuto
    const iv = setInterval(onCambio, 60_000);
    window.addEventListener("alight:premio-otorgado", onPremio);
    window.addEventListener("alight:premio-cambio", onCambio);
    return () => {
      if (t) clearTimeout(t);
      clearInterval(iv);
      window.removeEventListener("alight:premio-otorgado", onPremio);
      window.removeEventListener("alight:premio-cambio", onCambio);
    };
  }, []);

  // ── Spotlight handlers (changes apply on next scene load) ─────────────────
  const setSpotField = (key: keyof typeof DBG_SPOTLIGHT, val: number | string) => {
    (DBG_SPOTLIGHT as Record<string, number | string>)[key] = val;
    setSpot(s => ({ ...s, [key]: val }));
  };

  // ── Star handlers (twinkle speed is LIVE via shader uniform) ──────────────
  const setStarTwinkle = (v: number) => {
    DBG_STARS.twinkleSpeed = v;
    if (DBG_STAR_MAT.value) {
      DBG_STAR_MAT.value.uniforms.uTwinkleSpeed.value = v;
    }
    setStars(s => ({ ...s, twinkleSpeed: v }));
  };

  // ── Dome sector handler (LIVE via shader uniforms) ─────────────────────────
  const setSector = (sectorIdx: number, effectIdx: number) => {
    const keys = ["uE0","uE1","uE2","uE3","uE4","uE5","uE6"] as const;
    if (DBG_DOME_MAT.value) {
      DBG_DOME_MAT.value.uniforms[keys[sectorIdx]].value = effectIdx;
    }
  };

  return {
    visible,
    setVisible,
    premio,
    setPremio,
    avisoDesbloqueo,
    setAvisoDesbloqueo,
    efx,
    setEfx,
    mov,
    setMov,
    amn,
    setAmn,
    sec,
    setSec,
    ckf,
    setCkf,
    lay,
    setLay,
    frc,
    setFrc,
    ttx,
    setTtx,
    setDiaV,
    tocarDia,
    diaLive,
    setDiaLive,
    ejeLive,
    setEjeLive,
    fluLive,
    setFluLive,
    pastoLive,
    setPastoLive,
    luc,
    setLuc,
    tab,
    setTab,
    spot,
    setSpot,
    stars,
    setStars,
    dome,
    setDome,
    face,
    setFace,
    lectern,
    setLectern,
    retro,
    setRetro,
    retroFx,
    setRetroFx,
    sillas,
    setSillas,
    legacyOpen,
    setLegacyOpen,
    bandRev,
    setBandRev,
    bandOnArr,
    setBandOnArr,
    prism,
    setPrism,
    floor,
    setFloor,
    fx,
    setFx,
    camImg,
    setCamImg,
    camSnd,
    setCamSnd,
    audioVol,
    setAudioVol,
    focusRef,
    domeM,
    setDomeM,
    domeX2,
    setDomeX2,
    domeForce,
    setDomeForce,
    flash,
    setFlash,
    flashLive,
    setFlashLive,
    medicion,
    setMedicion,
    linterna,
    setLinterna,
    linternaLive,
    setLinternaLive,
    subp,
    setSubp,
    orb,
    setOrb,
    acerc,
    setAcerc,
    prio,
    setPrio,
    logPanelOn,
    setLogPanelOn,
    aislar,
    setAislar,
    foco,
    setFoco,
    video,
    setVideo,
    dlg,
    setDlg,
    luz,
    setLuz,
    piso,
    setPiso,
    inicio,
    setInicio,
    focoLive,
    setFocoLive,
    acercLive,
    setAcercLive,
    orbInfo,
    setOrbInfo,
    paneles,
    setPaneles,
    panelesFase,
    setPanelesFase,
    bigMeshList,
    setBigMeshList,
    meshHidden,
    setMeshHidden,
    setSpotField,
    setStarTwinkle,
    setSector,
  };
}
