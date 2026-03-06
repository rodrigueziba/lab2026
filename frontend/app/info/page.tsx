"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, Settings2 } from "lucide-react";
import TopologyBackground from "./TopologyBackground";

// Ruta del audio: colocar el archivo MP3 en frontend/public/music.mp3 (o cambiar la ruta aquí)
const INFO_PAGE_MUSIC_URL = "/music.mp3";

const WHO_CARDS = [
  { icon: "🎬", title: "Productoras",          desc: "Empresas de producción local o nacional con actividad en la provincia." },
  { icon: "🎭", title: "Profesionales",         desc: "Directores, directores de fotografía, sonidistas, actores y técnicos especializados." },
  { icon: "🔧", title: "Empresas de servicios", desc: "Equipamiento, transporte, catering, arte, postproducción y más." },
  { icon: "🎓", title: "Estudiantes",           desc: "Futuros realizadores que quieren visibilidad y conectarse con proyectos." },
];

const STEPS = [
  { num: 1, title: "Creá tu cuenta",                  desc: "Ingresá a la plataforma y completá el formulario con tu email y contraseña. El acceso es gratuito y tus datos están protegidos con cifrado bcrypt y autenticación JWT. Tus datos de contacto nunca son públicos",                    tags: ["Email + contraseña","Verificación segura","Sin costo"],                color: "gold"   },
  { num: 2, title: "Completá tu perfil de prestador", desc: "Cargá tu categoría, especialidad, descripción de servicios, zona de trabajo (Ushuaia, Tolhuin, Río Grande) y datos de contacto.",                                                             tags: ["Categoría profesional","Zona geográfica","Portfolio","Contacto"],       color: "blue"   },
  { num: 3, title: "Aparecés en el directorio",       desc: "Tu perfil queda visible en la Guía de Prestadores. Cualquier producción que busque servicios en TDF puede encontrarte y solicitarte los datos de contacto.",                                            tags: ["Directorio público","Búsqueda por categoría","Solicitud de contacto"],       color: "purple" },
  { num: 4, title: "Explorá el mapa nodal 3D",        desc: "Visualizá en tiempo real cómo tu nodo se conecta con proyectos, locaciones y otros prestadores mediante físicas de grafos 3D y shaders WebGL.",                                               tags: ["Grafo 3D interactivo","Conexiones en tiempo real","WebGL"],             color: "gold"   },
  { num: 5, title: "Conectate con proyectos",         desc: "Explorá la Cartelera de Proyectos: producciones audiovisuales activas que buscan servicios, técnicos o locaciones con sus etapas y roles.",                                                   tags: ["Estado del proyecto","Roles disponibles","Tipo de producción"],         color: "blue"   },
  { num: 6, title: "Gestioná tu presencia",           desc: "Actualizá tu perfil en cualquier momento: nuevos servicios, información de contacto y mantené tu nodo activo dentro de la red de la Film Commission.",                                        tags: ["Edición de perfil","Historial de actividad","Panel personal"],          color: "purple" },
];

const FEATURES = [
  { icon: "📋", color: "gold",   title: "Perfil de Prestador",    desc: "Creá tu ficha profesional con categoría, servicios, zona de cobertura y datos de contacto. Aparecés en búsquedas." },
  { icon: "🗺️", color: "blue",   title: "Directorio Público",     desc: "Formá parte de la guía de prestadores de TDF. Filtrá por especialidad, zona o tipo de servicio." },
  { icon: "🌐", color: "purple", title: "Mapa Nodal 3D",           desc: "Visualización interactiva que muestra tu nodo y sus conexiones con proyectos, locaciones y otros prestadores." },
  { icon: "🎞️", color: "green",  title: "Cartelera de Proyectos", desc: "Accedé al catálogo de producciones activas: largometrajes, series, documentales, publicidades y más." },
  { icon: "📍", color: "gold",   title: "Catálogo de Locaciones",  desc: "Explorá los espacios disponibles para filmación en Ushuaia, Tolhuin y Río Grande." },
  { icon: "🔒", color: "blue",   title: "Acceso Seguro",           desc: "Autenticación JWT y cifrado bcrypt. Tu información está protegida y solo vos podés editar tu perfil." },
];

const TIPS = [
  { icon: "📝", title: "Completá todos los campos",      body: "Los perfiles completos aparecen primero en las búsquedas." },
  { icon: "📍", title: "Indicá tu zona de cobertura",   body: "Seleccioná si trabajás en Ushuaia, Tolhuin, Río Grande." },
  { icon: "🔄", title: "Mantené el perfil actualizado", body: "Actualizá tu disponibilidad y servicios para mantenerte activo en el grafo nodal." },
  { icon: "🎯", title: "Elegí bien tu categoría",       body: "La categoría define en qué búsquedas aparecer. Detallá el resto en la descripción." },
  { icon: "🌐", title: "Revisá la cartelera",           body: "Los proyectos en preproducción son los que más buscan prestadores nuevos." },
  { icon: "🤝", title: "Explorá el directorio",         body: "Conocé otros prestadores y locaciones. Las conexiones del grafo reflejan la red real." },
];

const stepNumClass = {
  gold:   "bg-orange-500/10 border-orange-500/40 text-orange-500",
  blue:   "bg-[#4f9cf9]/10 border-[#4f9cf9]/35 text-[#4f9cf9]",
  purple: "bg-[#7c3aed]/10 border-[#7c3aed]/35 text-[#7c3aed]",
};

const featIconClass = {
  gold:   "bg-orange-500/10",
  blue:   "bg-[#4f9cf9]/10",
  purple: "bg-[#7c3aed]/10",
  green:  "bg-[#10b981]/10",
};

const DEFAULT_TOPOLOGY = {
  LINES: 18,
  STEPS: 140,
  BASE_SPEED: 0.855,
  WAVE_AMP: 35,
  MOUSE_RADIUS: 160,
  MOUSE_FORCE: 38,
  gradientBaseColor: null as string | null,
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}
function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return "#" + [f(0), f(8), f(4)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
/** A partir de un color base hex genera 7 colores para el gradiente (base + 6 con hue rotado). */
function gradientColorsFromBase(baseHex: string): string[] {
  const [r, g, b] = hexToRgb(baseHex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) out.push(hslToHex((h + (i * 360) / 7) % 360, s, l));
  return out;
}

export default function GuiaPrestadorPage() {
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const [showDebugButton, setShowDebugButton] = useState(false);
  const [debugMenuOpen, setDebugMenuOpen] = useState(false);
  const [topologyParams, setTopologyParams] = useState(DEFAULT_TOPOLOGY);

  // En escritorio: Shift muestra/oculta el botón Debug
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "ShiftLeft" && e.code !== "ShiftRight") return;
      if (typeof window !== "undefined" && window.innerWidth < 768) return;
      setShowDebugButton((v) => !v);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("opacity-100","translate-x-0","translate-y-0")),
      { threshold: 0.1 }
    );
    document.querySelectorAll("[data-animate]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // En escritorio (≥768px): barra espaciadora activa/pausa la música de fondo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (typeof window !== "undefined" && window.innerWidth < 768) return;

      if (!musicRef.current) {
        const audio = new Audio(INFO_PAGE_MUSIC_URL);
        musicRef.current = audio;
      }
      const audio = musicRef.current;
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const topologyProps = {
    ...topologyParams,
    gradientColors:
      topologyParams.gradientBaseColor != null
        ? gradientColorsFromBase(topologyParams.gradientBaseColor)
        : undefined,
  };

  return (
    <main className="bg-[#060810] text-slate-200 overflow-x-hidden">
      <TopologyBackground {...(topologyProps as Record<string, unknown>)} />

      {/* Debug (solo escritorio): botón más arriba; menú centrado verticalmente; Shift para mostrar */}
      {showDebugButton && (
        <div className="hidden md:block fixed left-6 top-[38%] -translate-y-1/2 z-[60] flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDebugMenuOpen((o) => !o)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950/90 backdrop-blur-xl border border-white/10 text-slate-300 hover:text-white hover:border-orange-500/40 hover:shadow-[0_0_20px_rgba(249,115,22,0.15)] transition-all font-bold text-sm"
          >
            <Settings2 size={18} />
            Debug
          </button>
          {debugMenuOpen && (
            <div className="fixed left-24 top-1/2 -translate-y-1/2 w-72 rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-2xl overflow-hidden z-[61]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-gradient-to-r from-slate-900/90 to-transparent">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">TopologyBackground</span>
                <button
                  type="button"
                  onClick={() => setDebugMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <span className="text-xs font-bold text-slate-400 block mb-2">Color base del gradiente (izq. → der.)</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={topologyParams.gradientBaseColor ?? "#3b82f6"}
                      onChange={(e) =>
                        setTopologyParams((p) => ({ ...p, gradientBaseColor: e.target.value }))
                      }
                      className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent"
                    />
                    <span className="text-xs font-mono text-slate-500">
                      {topologyParams.gradientBaseColor ?? "Por defecto"}
                    </span>
                    {topologyParams.gradientBaseColor != null && (
                      <button
                        type="button"
                        onClick={() =>
                          setTopologyParams((p) => ({ ...p, gradientBaseColor: null }))
                        }
                        className="text-xs text-slate-500 hover:text-white"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1">
                    Genera 7 colores (base + 6 por rotación de tono) de izquierda a derecha.
                  </p>
                </div>
                {[
                  { key: "LINES", label: "Líneas", min: 4, max: 40, step: 1 },
                  { key: "STEPS", label: "Pasos", min: 40, max: 280, step: 10 },
                  { key: "BASE_SPEED", label: "Velocidad base", min: 0.2, max: 2, step: 0.05 },
                  { key: "WAVE_AMP", label: "Amplitud onda", min: 5, max: 80, step: 1 },
                  { key: "MOUSE_RADIUS", label: "Radio mouse (px)", min: 40, max: 320, step: 10 },
                  { key: "MOUSE_FORCE", label: "Fuerza mouse", min: 10, max: 80, step: 2 },
                ].map(({ key, label, min, max, step }) => (
                  <div key={key}>
                    <label className="flex justify-between items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-400">{label}</span>
                      <span className="text-xs font-mono text-orange-400 tabular-nums">
                        {typeof topologyParams[key as keyof typeof topologyParams] === "number"
                          ? topologyParams[key as keyof typeof topologyParams]
                          : ""}
                      </span>
                    </label>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={(topologyParams[key as keyof typeof topologyParams] as number) ?? min}
                      onChange={(e) =>
                        setTopologyParams((p) => ({
                          ...p,
                          [key]: step >= 1 ? parseInt(e.target.value, 10) : parseFloat(e.target.value),
                        }))
                      }
                      className="w-full h-2 rounded-full bg-slate-800 accent-orange-500"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setTopologyParams(DEFAULT_TOPOLOGY)}
                  className="w-full py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white border border-white/10 hover:border-orange-500/30 transition-colors"
                >
                  Restaurar valores
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ position: "relative", zIndex: 1 }}>

        {/* HERO */}
        <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-28 pb-20">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-500 text-xs font-semibold tracking-widest uppercase mb-8 animate-fade-up">
            📽 Guía para Prestadores · Film Commission TDF
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight max-w-3xl animate-fade-up [animation-delay:100ms]">
            Todo lo que necesitás saber para{" "}
            <span className="text-orange-500">aparecer en el mapa</span>
          </h1>
          <p className="mt-5 text-slate-400 max-w-xl text-lg animate-fade-up [animation-delay:200ms]">
            Sumá tu perfil a la plataforma oficial de la industria audiovisual de Tierra del Fuego.
            Conectá con producciones, locaciones y talento del Fin del Mundo.
          </p>
          <div className="mt-10 flex flex-wrap gap-3 justify-center animate-fade-up [animation-delay:300ms]">
            <Link href="/registro" className="px-7 py-3 rounded-lg bg-orange-500 text-white font-bold text-sm transition-all hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-[0_8px_28px_rgba(234,88,12,.25)]">
              Crear mi perfil gratis
            </Link>
            <Link href="#recorrido" className="px-7 py-3 rounded-lg border border-white/10 text-slate-200 font-semibold text-sm transition-all hover:border-white/25 hover:bg-white/[.04]">
              Ver recorrido →
            </Link>
          </div>
          <div className="mt-16 flex flex-col items-center gap-1.5 text-slate-500 text-xs tracking-widest uppercase animate-fade-up [animation-delay:500ms]">
            <svg className="animate-bounce" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
            Explorá la guía
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-transparent via-white/7 to-transparent" />

        {/* WHO */}
        <section className="py-24 px-4">
          <div className="max-w-5xl mx-auto">
            <span className="text-orange-500 text-xs font-bold tracking-[.15em] uppercase">¿A quién está dirigido?</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">¿Sos un prestador audiovisual?</h2>
            <p className="mt-3 text-slate-400 max-w-lg">La plataforma da visibilidad a todos los perfiles que forman parte de la cadena de valor audiovisual en Tierra del Fuego.</p>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {WHO_CARDS.map((c) => (
                <div key={c.title} className="bg-[#111827]/80 backdrop-blur-sm border border-white/7 rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1 hover:border-orange-500/35 hover:shadow-[0_12px_40px_rgba(0,0,0,.4)]">
                  <div className="text-3xl mb-4">{c.icon}</div>
                  <h3 className="font-bold mb-1">{c.title}</h3>
                  <p className="text-slate-400 text-sm">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-transparent via-white/7 to-transparent" />

        {/* STEPS */}
        <section id="recorrido" className="py-24 px-4 bg-[#0d1120]/60 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto">
            <span className="text-orange-500 text-xs font-bold tracking-[.15em] uppercase">Recorrido del prestador</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">Tu camino, paso a paso</h2>
            <p className="mt-3 text-slate-400 max-w-lg">Desde el registro hasta aparecer en el mapa nodal de la industria.</p>
            <div className="mt-12 relative">
              <div className="absolute left-[27px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-orange-500/40 via-[#4f9cf9]/30 to-[#7c3aed]/30" />
              <div className="flex flex-col gap-0">
                {STEPS.map((s, i) => (
                  <div key={s.num} data-animate className="flex gap-6 py-7 opacity-0 -translate-x-5 transition-all duration-500" style={{ transitionDelay: `${i * 100}ms` }}>
                    <div className={`flex-shrink-0 w-14 h-14 rounded-full border-2 flex items-center justify-center font-extrabold text-base relative z-10 ${stepNumClass[s.color as keyof typeof stepNumClass] ?? ""}`}>{s.num}</div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">{s.title}</h3>
                      <p className="text-slate-400 text-sm mb-3">{s.desc}</p>
                      <div className="flex flex-wrap gap-2">
                        {s.tags.map((t) => (
                          <span key={t} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/5 border border-white/7 text-slate-400">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-transparent via-white/7 to-transparent" />

        {/* FEATURES */}
        <section id="funcionalidades" className="py-24 px-4">
          <div className="max-w-5xl mx-auto">
            <span className="text-orange-500 text-xs font-bold tracking-[.15em] uppercase">Funcionalidades</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">Qué podés hacer en la plataforma</h2>
            <p className="mt-3 text-slate-400 max-w-lg">Herramientas pensadas para conectar la industria audiovisual fueguina.</p>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((f, i) => (
                <div key={f.title} data-animate className="bg-[#111827]/80 backdrop-blur-sm border border-white/7 rounded-2xl p-7 opacity-0 translate-y-5 transition-all duration-500 hover:border-[#4f9cf9]/30 hover:shadow-[0_12px_48px_rgba(0,0,0,.5)]" style={{ transitionDelay: `${i * 80}ms` }}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-5 ${featIconClass[f.color as keyof typeof featIconClass] ?? ""}`}>{f.icon}</div>
                  <h3 className="font-bold mb-2">{f.title}</h3>
                  <p className="text-slate-400 text-sm">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-transparent via-white/7 to-transparent" />

        {/* NODAL MAP */}
        <section id="mapa" className="py-24 px-4 bg-[#0d1120]/60 backdrop-blur-sm text-center">
          <div className="max-w-5xl mx-auto">
            <span className="text-orange-500 text-xs font-bold tracking-[.15em] uppercase">El mapa nodal</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">Tu nodo en la red audiovisual</h2>
            <p className="mt-3 text-slate-400 max-w-lg mx-auto">Cada prestador, proyecto y locación es un nodo. El grafo 3D muestra cómo se conectan todos en tiempo real.</p>
            <div className="mt-10 mx-auto max-w-xl bg-[#111827]/80 backdrop-blur-sm border border-white/7 rounded-2xl p-10 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(79,156,249,.06),transparent_70%)]" />
              <div className="relative h-52">
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                  <line x1="200" y1="100" x2="80"  y2="35"  stroke="rgba(79,156,249,.2)"  strokeWidth="1.5" strokeDasharray="5 5"/>
                  <line x1="200" y1="100" x2="320" y2="35"  stroke="rgba(124,58,237,.2)" strokeWidth="1.5" strokeDasharray="5 5"/>
                  <line x1="200" y1="100" x2="60"  y2="170" stroke="rgba(16,185,129,.18)" strokeWidth="1.5" strokeDasharray="5 5"/>
                  <line x1="200" y1="100" x2="340" y2="168" stroke="rgba(239,68,68,.15)"  strokeWidth="1.5" strokeDasharray="5 5"/>
                </svg>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-orange-500/20 border-2 border-orange-500/50 flex items-center justify-center text-2xl animate-pulse">⬡</div>
                <div className="absolute top-[10%] left-[15%] w-12 h-12 rounded-full bg-[#4f9cf9]/15 border-2 border-[#4f9cf9]/40 flex items-center justify-center text-lg" style={{animation:"pulse 3s ease-in-out .5s infinite"}}>🎬</div>
                <div className="absolute top-[10%] right-[15%] w-12 h-12 rounded-full bg-[#7c3aed]/15 border-2 border-[#7c3aed]/40 flex items-center justify-center text-lg" style={{animation:"pulse 3s ease-in-out 1s infinite"}}>🎭</div>
                <div className="absolute bottom-[10%] left-[10%] w-12 h-12 rounded-full bg-[#10b981]/12 border-2 border-[#10b981]/35 flex items-center justify-center text-lg" style={{animation:"pulse 3s ease-in-out 1.5s infinite"}}>📍</div>
                <div className="absolute bottom-[10%] right-[10%] w-12 h-12 rounded-full bg-[#ef4444]/12 border-2 border-[#ef4444]/30 flex items-center justify-center text-lg" style={{animation:"pulse 3s ease-in-out 2s infinite"}}>🎞️</div>
              </div>
              <div className="flex justify-center gap-5 flex-wrap mt-4 relative z-10">
                {[["rgb(234 88 12)","Vos (Prestador)"],["#4f9cf9","Proyectos"],["#7c3aed","Productoras"],["#10b981","Locaciones"]].map(([c,l])=>(
                  <div key={l} className="flex items-center gap-1.5 text-slate-400 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{background:c}}/>{l}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-transparent via-white/7 to-transparent" />

        {/* TIPS */}
        <section id="consejos" className="py-24 px-4">
          <div className="max-w-5xl mx-auto">
            <span className="text-orange-500 text-xs font-bold tracking-[.15em] uppercase">Consejos</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">Para sacarle el máximo al perfil</h2>
            <p className="mt-3 text-slate-400 max-w-lg">Pequeños pasos que hacen una gran diferencia en tu visibilidad.</p>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TIPS.map((t) => (
                <div key={t.title} className="rounded-xl p-6 border-l-2 border-orange-500 bg-orange-500/[.03] text-sm text-slate-400 transition-all duration-200 hover:bg-orange-500/[.06] hover:translate-x-1">
                  <span className="block text-slate-200 font-bold mb-1.5 text-[.9rem]">{t.icon} {t.title}</span>
                  {t.body}
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-transparent via-white/7 to-transparent" />

        {/* CTA */}
        <section className="py-28 px-4 bg-[#0d1120]/60 backdrop-blur-sm text-center relative overflow-hidden">
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(234,88,12,.07),transparent_70%)]" />
          <div className="relative max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Empezá a ser parte <span className="text-orange-500">hoy</span>
            </h2>
            <p className="mt-4 text-slate-400 text-lg">Creá tu perfil gratis y aparecé en el mapa de la industria audiovisual del Fin del Mundo.</p>
            <div className="mt-8 flex gap-3 justify-center flex-wrap">
              <Link href="/registro" className="px-7 py-3 rounded-lg bg-orange-500 text-white font-bold text-sm transition-all hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-[0_8px_28px_rgba(234,88,12,.25)]">
                Crear mi perfil →
              </Link>
              <Link href="/guia" className="px-7 py-3 rounded-lg border border-white/10 text-slate-200 font-semibold text-sm transition-all hover:border-white/25 hover:bg-white/[.04]">
                Ver el directorio
              </Link>
            </div>
          </div>
        </section>

      </div>

      <style>{`
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up { animation: fade-up .65s ease both; }
      `}</style>
    </main>
  );
}