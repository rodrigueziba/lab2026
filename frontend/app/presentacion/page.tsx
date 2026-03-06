"use client";

/**
 * FILM COMMISSION TDF — Presentación Interactiva
 * ─────────────────────────────────────────────────
 * Colocar este archivo en: frontend/src/app/presentacion/page.tsx
 * (o en cualquier ruta que prefieras dentro de app/)
 *
 * Requiere TopologyBackground.jsx en la misma carpeta, o ajustar el import.
 *
 * Dependencias ya presentes en el proyecto:
 *   - tailwindcss
 *   - lucide-react
 *   - next/link (no se usa aquí, pero lo podés agregar)
 *
 * Controles:
 *   ← →  /  A D   → navegar slides
 *   Espacio        → siguiente
 *   Shift          → mostrar/ocultar botón Debug
 *   Click izq/der  → navegar por mitad de pantalla
 *   Swipe          → táctil
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Settings2, ChevronLeft, ChevronRight } from "lucide-react";
import TopologyBackground from "./TopologyBackground";   // ajustar ruta si es necesario

// ─────────────────────────────────────────────────────────────────────────────
// TOPOLOGY DEBUG (mismo código que page.tsx)
// ─────────────────────────────────────────────────────────────────────────────
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
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else                h = ((r - g) / d + 4) / 6;
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
function gradientColorsFromBase(baseHex: string): string[] {
  const [r, g, b] = hexToRgb(baseHex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) out.push(hslToHex((h + (i * 360) / 7) % 360, s, l));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE DATA
// ─────────────────────────────────────────────────────────────────────────────
type SlideId =
  | "portada" | "que-es" | "contexto" | "problema"
  | "solucion" | "usuarios" | "perfiles"
  | "journey-prestador" | "journey-contratante"
  | "modulos" | "mapa-nodal" | "seguridad"
  | "locaciones" | "dashboard" | "stack"
  | "notificaciones" | "impacto" | "resumen"
  | "demo" | "cierre";

interface Slide { id: SlideId; label: string; }

const SLIDES: Slide[] = [
  { id: "portada",              label: "Portada"             },
  { id: "que-es",               label: "¿Qué es?"            },
  { id: "contexto",             label: "Contexto"            },
  { id: "problema",             label: "Problema"            },
  { id: "solucion",             label: "Solución"            },
  { id: "usuarios",             label: "Usuarios"            },
  { id: "perfiles",             label: "Perfiles"            },
  { id: "journey-prestador",    label: "Journey Prestador"   },
  { id: "journey-contratante",  label: "Journey Contratante" },
  { id: "modulos",              label: "Módulos"             },
  { id: "mapa-nodal",           label: "Mapa Nodal 3D"       },
  { id: "seguridad",            label: "Seguridad"           },
  { id: "locaciones",           label: "Locaciones"          },
  { id: "dashboard",            label: "Dashboard Admin"     },
  { id: "stack",                label: "Stack Técnico"       },
  { id: "notificaciones",       label: "Notificaciones"      },
  { id: "impacto",              label: "Impacto"             },
  { id: "resumen",              label: "Resumen"             },
  { id: "demo",                 label: "Demo"                },
  { id: "cierre",               label: "Cierre"              },
];

// Color tokens — idénticos a page.tsx
const C = {
  orange:    "text-orange-500",
  orangeBg:  "bg-orange-500",
  goldNum:   "bg-orange-500/10 border-orange-500/40 text-orange-500",
  blueNum:   "bg-[#4f9cf9]/10 border-[#4f9cf9]/35 text-[#4f9cf9]",
  purpleNum: "bg-[#7c3aed]/10 border-[#7c3aed]/35 text-[#7c3aed]",
  greenNum:  "bg-[#10b981]/10 border-[#10b981]/35 text-[#10b981]",
  card:      "bg-[#111827]/80 backdrop-blur-sm border border-white/[.07] rounded-2xl",
  section:   "bg-[#0d1120]/60 backdrop-blur-sm",
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-orange-500 text-xs font-bold tracking-[.15em] uppercase">
      {children}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
      {children}
    </h2>
  );
}

function Sub({ children, center = false }: { children: React.ReactNode; center?: boolean }) {
  return (
    <p className={`mt-3 text-slate-400 max-w-lg text-sm leading-relaxed ${center ? "mx-auto text-center" : ""}`}>
      {children}
    </p>
  );
}

function Divider() {
  return <div className="h-px w-12 bg-orange-500/60 rounded my-4" />;
}

function Card({ children, className = "", accent }: {
  children: React.ReactNode;
  className?: string;
  accent?: "orange" | "blue" | "purple" | "green";
}) {
  const topBorder = {
    orange: "border-t-2 border-t-orange-500",
    blue:   "border-t-2 border-t-[#4f9cf9]",
    purple: "border-t-2 border-t-[#7c3aed]",
    green:  "border-t-2 border-t-[#10b981]",
  };
  return (
    <div className={`${C.card} p-6 transition-all duration-300 hover:-translate-y-1 hover:border-orange-500/30 hover:shadow-[0_12px_40px_rgba(0,0,0,.5)] ${accent ? topBorder[accent] : ""} ${className}`}>
      {children}
    </div>
  );
}

function IconBox({ icon, color }: { icon: string; color: "gold" | "blue" | "purple" | "green" }) {
  const bg = {
    gold:   "bg-orange-500/10",
    blue:   "bg-[#4f9cf9]/10",
    purple: "bg-[#7c3aed]/10",
    green:  "bg-[#10b981]/10",
  };
  return (
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${bg[color]}`}>
      {icon}
    </div>
  );
}

function Tag({ children, color = "default" }: { children: React.ReactNode; color?: "default" | "orange" | "blue" | "purple" }) {
  const styles = {
    default: "bg-white/5 border border-white/[.07] text-slate-400",
    orange:  "bg-orange-500/10 border border-orange-500/25 text-orange-400",
    blue:    "bg-[#4f9cf9]/10 border border-[#4f9cf9]/25 text-[#4f9cf9]",
    purple:  "bg-[#7c3aed]/10 border border-[#7c3aed]/25 text-[#7c3aed]",
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${styles[color]}`}>
      {children}
    </span>
  );
}

// Journey card (usado en slides 8 y 9)
function JourneyCard({
  num, icon, title, desc, tags, color, last,
}: {
  num: number; icon: string; title: string; desc: string; tags: string[];
  color: "gold" | "blue" | "purple"; last?: boolean;
}) {
  const numClass = { gold: C.goldNum, blue: C.blueNum, purple: C.purpleNum };
  return (
    <div className="flex items-start gap-5 relative">
      {/* vertical line */}
      {!last && (
        <div className="absolute left-7 top-14 bottom-0 w-0.5 bg-gradient-to-b from-orange-500/30 via-[#4f9cf9]/20 to-transparent" />
      )}
      <div className={`flex-shrink-0 w-14 h-14 rounded-full border-2 flex items-center justify-center font-extrabold text-lg relative z-10 ${numClass[color]}`}>
        {num}
      </div>
      <div className="flex-1 pb-7">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">{icon}</span>
          <h3 className="font-bold text-base text-white">{title}</h3>
        </div>
        <p className="text-slate-400 text-sm leading-relaxed mb-3">{desc}</p>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => <Tag key={t}>{t}</Tag>)}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDES CONTENT
// ─────────────────────────────────────────────────────────────────────────────

function SlidePortada() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 h-full gap-6">
      {/* Film strip decorative */}
      <div className="flex items-center gap-1 opacity-60 mb-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className={`${i % 3 === 1 ? "w-6 h-4 border border-orange-500/60 rounded-sm flex items-center justify-center" : "w-2 h-2 bg-orange-500/50 rounded-sm"}`}>
            {i % 3 === 1 && <div className="w-3 h-2 bg-orange-500/30 rounded-sm" />}
          </div>
        ))}
      </div>

      <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-500 text-xs font-semibold tracking-widest uppercase animate-fade-up">
        📽 Laboratorio de Desarrollo de Software · 2026
      </span>

      <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight animate-fade-up [animation-delay:100ms]">
        Film Commission
        <br />
        <span className="text-orange-500">TDF</span>
      </h1>

      <p className="text-slate-400 max-w-xl text-lg animate-fade-up [animation-delay:200ms]">
        Plataforma Integral de la Industria Audiovisual de Tierra del Fuego
      </p>

      <div className="w-12 h-0.5 bg-orange-500/60 rounded animate-fade-up [animation-delay:300ms]" />

      <div className="flex gap-8 text-center animate-fade-up [animation-delay:400ms]">
        {[
          { label: "Desarrollador", val: "Ezequiel Rodríguez Ibarra" },
          { label: "Cátedra",       val: "Lab. de Desarrollo de Software" },
          { label: "Año",           val: "2026" },
        ].map((m) => (
          <div key={m.label} className="flex flex-col gap-1">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-orange-500">{m.label}</span>
            <span className="text-sm text-slate-300 font-medium">{m.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideQueEs() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div>
        <Eyebrow>Contexto</Eyebrow>
        <SectionTitle>¿Qué es una <span className="text-orange-500">Film Commission</span>?</SectionTitle>
      </div>
      <Card accent="orange">
        <p className="text-slate-200 text-sm leading-relaxed">
          Es una entidad destinada a facilitar a los productores audiovisuales nacionales e internacionales toda la información y logística que precisen para la realización de rodajes en un lugar determinado — incluyendo películas, televisión y publicidad.
        </p>
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: "🎬", color: "gold"   as const, title: "Promoción",      desc: "Promueve la industria y visibiliza la zona en la que opera." },
          { icon: "🌍", color: "blue"   as const, title: "Asesoramiento",   desc: "Brinda información, oferta de locaciones y apoyo logístico integral." },
          { icon: "🤝", color: "purple" as const, title: "Conexión",        desc: "Conecta productores externos con prestadores y talento local." },
        ].map((c) => (
          <Card key={c.title} className="flex flex-col gap-3">
            <IconBox icon={c.icon} color={c.color} />
            <div className="font-bold text-white text-sm">{c.title}</div>
            <p className="text-slate-400 text-xs leading-relaxed">{c.desc}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SlideContexto() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div>
        <Eyebrow>Historia y Actualidad</Eyebrow>
        <SectionTitle>El Contexto <span className="text-[#4f9cf9]">Fueguino</span></SectionTitle>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <IconBox icon="📽" color="gold" />
            <div className="font-bold text-white text-sm">La mirada externa</div>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            Desde la década del 20 del siglo pasado, durante casi 100 años, el territorio fueguino fue registrado por producciones ajenas — atraídas por sus paisajes y la mitología del "Fin del Mundo". Sus representaciones se construyeron desde afuera.
          </p>
        </Card>
        <Card accent="blue" className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <IconBox icon="✨" color="blue" />
            <div className="font-bold text-white text-sm">La irrupción local</div>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            En los últimos cinco años surgieron las primeras producciones independientes fueguinas: documentales, series y cortometrajes con estándares profesionales, gracias a la UNTDF, concursos del INCAA y jóvenes profesionales locales.
          </p>
          <div className="flex flex-wrap gap-2 mt-1">
            <Tag>UNTDF — Lic. Medios Audiovisuales</Tag>
            <Tag>INCAA — Concursos regionales</Tag>
          </div>
        </Card>
      </div>
      <Card className="bg-orange-500/[.03] border-l-2 border-l-orange-500 !rounded-xl py-4">
        <p className="text-slate-300 text-sm leading-relaxed">
          ⚡ Sin embargo, persisten <strong className="text-white">dificultades para articularse como industria</strong>: fragmentación de información, falta de visibilidad y ausencia de políticas culturales integradas en la provincia.
        </p>
      </Card>
    </div>
  );
}

function SlideProblema() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div>
        <Eyebrow>El Problema</Eyebrow>
        <SectionTitle>Fragmentación &amp; <span className="text-orange-500">Invisibilidad</span></SectionTitle>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="flex flex-col gap-4 border-l-2 border-l-orange-500">
          <div className="flex items-start gap-3">
            <span className="text-4xl">🧩</span>
            <div>
              <div className="font-bold text-white mb-1">Fragmentación de la Información</div>
              <p className="text-slate-400 text-xs leading-relaxed">La falta de una base de datos unificada de servicios audiovisuales, productoras y prestadores de industrias conexas dificulta enormemente el desarrollo del sector local.</p>
            </div>
          </div>
        </Card>
        <Card className="flex flex-col gap-4 border-l-2 border-l-[#f59e0b]">
          <div className="flex items-start gap-3">
            <span className="text-4xl">👻</span>
            <div>
              <div className="font-bold text-white mb-1">Invisibilidad del Talento</div>
              <p className="text-slate-400 text-xs leading-relaxed">Las incipientes PYMES audiovisuales fueguinas son invisibles ante grandes oportunidades. Los productores externos traen sus propios equipos desde otras regiones.</p>
            </div>
          </div>
        </Card>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { num: "~100", label: "años de producción mayoritariamente externa", color: "text-orange-500" },
          { num: "0",    label: "plataformas digitales unificadas previas",     color: "text-[#4f9cf9]" },
          { num: "∞",    label: "potencial de las industrias culturales en TDF", color: "text-[#10b981]" },
        ].map((s) => (
          <div key={s.num} className={`${C.card} p-5 flex flex-col items-center text-center gap-1`}>
            <div className={`text-3xl font-extrabold tracking-tight ${s.color}`} style={{ fontFamily: "inherit" }}>{s.num}</div>
            <div className="text-xs text-slate-400 leading-relaxed">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideSolucion() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6 items-center text-center">
      <div>
        <Eyebrow>La Plataforma</Eyebrow>
        <SectionTitle>Film Commission <span className="text-orange-500">TDF</span></SectionTitle>
        <Sub center>
          Una plataforma web integral para centralizar, gestionar y promover la industria audiovisual fueguina — conectando talento, locaciones y proyectos del Fin del Mundo.
        </Sub>
      </div>
      <div className="grid grid-cols-3 gap-4 w-full">
        {[
          { num: "6",  label: "Módulos funcionales",          color: "text-orange-500" },
          { num: "3",  label: "Tipos de usuario",             color: "text-[#4f9cf9]"  },
          { num: "3D", label: "Mapa nodal WebGL interactivo", color: "text-[#10b981]"  },
        ].map((s) => (
          <div key={s.num} className={`${C.card} p-5 flex flex-col items-center gap-1.5`}>
            <div className={`text-4xl font-extrabold ${s.color}`}>{s.num}</div>
            <div className="text-xs text-slate-400">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4 w-full">
        {[
          { icon: "📋", color: "gold"   as const, title: "Directorio Público",     desc: "Perfiles filtrados por ciudad y rubro" },
          { icon: "📍", color: "blue"   as const, title: "Catálogo de Locaciones", desc: "Escenarios georreferenciados con fotos" },
          { icon: "🎞️", color: "purple" as const, title: "Cartelera de Proyectos", desc: "Producciones activas con roles vacantes" },
        ].map((c) => (
          <Card key={c.title} className="flex flex-col gap-3 text-left">
            <IconBox icon={c.icon} color={c.color} />
            <div className="font-bold text-white text-sm">{c.title}</div>
            <p className="text-slate-400 text-xs">{c.desc}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SlideUsuarios() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div>
        <Eyebrow>Ecosistema</Eyebrow>
        <SectionTitle>Tipos de <span className="text-[#4f9cf9]">Usuario</span></SectionTitle>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[
          {
            icon: "🛡", accent: "orange" as const,
            title: "Administrador",
            desc: "Control total del sistema. Modera contenido, habilita usuarios, gestiona roles y accede al dashboard con analítica avanzada y mapa nodal 3D.",
            tags: ["Dashboard", "ABM Total", "Estadísticas"],
          },
          {
            icon: "👤", accent: "blue" as const,
            title: "Prestador",
            desc: "Profesionales, productoras, empresas o estudiantes que ofrecen servicios. Crean su perfil público, se postular a proyectos y reciben solicitudes.",
            tags: ["Hasta 4 perfiles", "Postulaciones", "Directorio"],
          },
          {
            icon: "🎬", accent: "purple" as const,
            title: "Contratante",
            desc: "Productoras o realizadores que buscan servicios, talento o locaciones. Publican proyectos, solicitan contactos y gestionan candidatos.",
            tags: ["Publicar proyectos", "Scouting", "Gestión candidatos"],
          },
        ].map((u) => (
          <Card key={u.title} accent={u.accent} className="flex flex-col gap-4 items-center text-center">
            <div className="text-4xl mt-1">{u.icon}</div>
            <div className="font-bold text-white">{u.title}</div>
            <p className="text-slate-400 text-xs leading-relaxed flex-1">{u.desc}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {u.tags.map((t) => (
                <Tag key={t} color={u.accent === "orange" ? "orange" : u.accent === "blue" ? "blue" : "purple"}>{t}</Tag>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SlidePerfiles() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div>
        <Eyebrow>Módulo 1 — Perfiles</Eyebrow>
        <SectionTitle>Estructura de <span className="text-orange-500">Perfiles</span></SectionTitle>
        <Sub>Un mismo usuario Prestador puede generar hasta <strong className="text-white">4 perfiles</strong> simultáneos en categorías distintas.</Sub>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { num: "1", icon: "🎭", color: C.goldNum,   title: "Profesional",    desc: "Director, DP, sonidista, actor, montajista — técnicos especializados." },
          { num: "2", icon: "🎬", color: C.blueNum,   title: "Productora",     desc: "Empresa de producción local o nacional con actividad en TDF." },
          { num: "3", icon: "🔧", color: C.purpleNum, title: "Empresa Afín",   desc: "Equipamiento, transporte, catering, arte, postproducción y más." },
          { num: "4", icon: "🎓", color: C.greenNum,  title: "Estudiante",     desc: "Futuros realizadores buscando visibilidad y primeras experiencias." },
        ].map((p) => (
          <div key={p.title} className={`${C.card} p-5 flex flex-col gap-3 items-center text-center relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-orange-500/30`}>
            <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-extrabold text-lg ${p.color}`}>{p.num}</div>
            <div className="text-2xl">{p.icon}</div>
            <div className="font-bold text-white text-sm">{p.title}</div>
            <p className="text-slate-400 text-xs leading-relaxed">{p.desc}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="flex gap-3 items-start py-4">
          <IconBox icon="🔒" color="blue" />
          <p className="text-xs text-slate-400 leading-relaxed"><strong className="text-white">Privacidad:</strong> los datos de contacto están ocultos. Los interesados solicitan acceso a través del sistema de notificaciones.</p>
        </Card>
        <Card className="flex gap-3 items-start py-4">
          <IconBox icon="🔍" color="purple" />
          <p className="text-xs text-slate-400 leading-relaxed"><strong className="text-white">Filtros:</strong> búsqueda en tiempo real por ciudad (Ushuaia · Tolhuin · Río Grande) y por rubro especializado.</p>
        </Card>
      </div>
    </div>
  );
}

function SlideJourneyPrestador() {
  const steps = [
    { num: 1, icon: "🔑", title: "Registrarse",           desc: "Email + contraseña o Google OAuth. JWT generado automáticamente. El acceso es gratuito y tus datos están protegidos con cifrado bcrypt.",                         tags: ["Email + contraseña", "OAuth Google", "Sin costo"],                    color: "gold" as const },
    { num: 2, icon: "✏️", title: "Completá tu perfil",    desc: "Cargá tu categoría, especialidad, descripción de servicios, zona de trabajo (Ushuaia, Tolhuin, Río Grande) y datos de contacto.",                              tags: ["Categoría profesional", "Zona geográfica", "Portfolio"],               color: "blue" as const },
    { num: 3, icon: "👁",  title: "Aparecés en el directorio", desc: "Tu perfil queda visible en la Guía de Prestadores. Cualquier producción que busque servicios en TDF puede encontrarte.",                                   tags: ["Directorio público", "Búsqueda por categoría", "Solicitud contacto"], color: "purple" as const },
    { num: 4, icon: "🌐", title: "Explorá el mapa nodal 3D", desc: "Visualizá en tiempo real cómo tu nodo se conecta con proyectos, locaciones y otros prestadores mediante físicas de grafos 3D y shaders WebGL.",            tags: ["Grafo 3D interactivo", "Conexiones en tiempo real", "WebGL"],          color: "gold" as const },
    { num: 5, icon: "📢", title: "Conectate con proyectos", desc: "Explorá la Cartelera de Proyectos: producciones audiovisuales activas que buscan servicios, técnicos o locaciones con sus etapas y roles.",                  tags: ["Estado del proyecto", "Roles disponibles", "Tipo de producción"],      color: "blue" as const },
    { num: 6, icon: "⚙️", title: "Gestioná tu presencia", desc: "Actualizá tu perfil en cualquier momento: nuevos servicios, información de contacto y mantené tu nodo activo dentro de la red.",                              tags: ["Edición de perfil", "Historial de actividad", "Panel personal"],       color: "purple" as const },
  ];
  return (
    <div className="w-full max-w-3xl mx-auto px-4 flex flex-col gap-6">
      <div>
        <Eyebrow>User Journey</Eyebrow>
        <SectionTitle>Camino del <span className="text-[#4f9cf9]">Prestador</span></SectionTitle>
        <Sub>De la cuenta al mapa nodal — paso a paso</Sub>
      </div>
      <div className="flex flex-col gap-0 relative">
        {steps.map((s, i) => (
          <JourneyCard key={s.num} {...s} last={i === steps.length - 1} />
        ))}
      </div>
    </div>
  );
}

function SlideJourneyContratante() {
  const steps = [
    { num: 1, icon: "🌐", title: "Registrarse",              desc: "Cuenta gratuita con acceso completo al directorio, catálogo de locaciones y cartelera de proyectos.",                                                          tags: ["Acceso completo", "Sin costo", "OAuth Google"],                        color: "gold"   as const },
    { num: 2, icon: "🔍", title: "Buscar talento",           desc: "Filtra el directorio de prestadores por rubro, ciudad o especialidad en tiempo real para encontrar al profesional ideal.",                                      tags: ["Filtro por rubro", "Filtro por ciudad", "Búsqueda en tiempo real"],    color: "blue"   as const },
    { num: 3, icon: "📩", title: "Solicitar contacto",       desc: "Los datos de contacto son privados. El sistema envía una solicitud al prestador, quien decide si aprueba o rechaza revelar sus datos. Protección anti-spam.", tags: ["Sistema de solicitudes", "Privacidad protegida", "Anti-spam"],         color: "purple" as const },
    { num: 4, icon: "📍", title: "Explorar locaciones",      desc: "Navega el catálogo de locaciones georreferenciadas de TDF con fotos, fichas técnicas, nivel de accesibilidad y coordenadas exactas.",                         tags: ["Mapa interactivo", "Fichas técnicas", "8 categorías"],                 color: "gold"   as const },
    { num: 5, icon: "📋", title: "Publicar proyectos",       desc: "Creá tu proyecto audiovisual, definí los roles técnicos necesarios y recibí postulaciones directas de prestadores interesados.",                              tags: ["Definir roles", "Recibir postulaciones", "Gestión de candidatos"],     color: "blue"   as const },
    { num: 6, icon: "✅", title: "Gestionar candidaturas",   desc: "Accedé a la lista privada de candidatos, evaluá sus portfolios directamente desde la plataforma y aceptá o rechazá postulaciones.",                           tags: ["Perfiles candidatos", "Aceptar / Rechazar", "Notificaciones"],         color: "purple" as const },
  ];
  return (
    <div className="w-full max-w-3xl mx-auto px-4 flex flex-col gap-6">
      <div>
        <Eyebrow>User Journey</Eyebrow>
        <SectionTitle>Camino del <span className="text-orange-500">Contratante</span></SectionTitle>
        <Sub>De la idea al equipo — búsqueda de talento y locaciones</Sub>
      </div>
      <div className="flex flex-col gap-0 relative">
        {steps.map((s, i) => (
          <JourneyCard key={s.num} {...s} last={i === steps.length - 1} />
        ))}
      </div>
    </div>
  );
}

function SlideModulos() {
  const mods = [
    { icon: "🔐", color: "gold"   as const, title: "Autenticación",          desc: "Login, OAuth Google, JWT · Control de roles Admin / Usuario (RBAC Guards en NestJS)" },
    { icon: "👥", color: "blue"   as const, title: "Directorio de Prestadores", desc: "CRUD de perfiles, búsqueda en tiempo real por ciudad y rubro" },
    { icon: "📋", color: "purple" as const, title: "Cartelera de Proyectos", desc: "Publicar producciones, definir roles técnicos, gestionar postulaciones" },
    { icon: "📍", color: "green"  as const, title: "Catálogo de Locaciones", desc: "Fichas con fotos (Supabase Storage), coordenadas y mapa Leaflet interactivo" },
    { icon: "📊", color: "blue"   as const, title: "Dashboard Admin",        desc: "Métricas Recharts en vivo, moderación ABM total y visualizador de nodos 3D" },
    { icon: "🔔", color: "gold"   as const, title: "Notificaciones",         desc: "Alertas en tiempo real, mailing Nodemailer y trazabilidad de estados leído/no leído" },
  ];
  return (
    <div className="w-full max-w-5xl mx-auto px-4 flex flex-col gap-6">
      <div>
        <Eyebrow>Arquitectura Funcional</Eyebrow>
        <SectionTitle>Los 6 <span className="text-orange-500">Módulos</span></SectionTitle>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {mods.map((m, i) => (
          <div
            key={m.title}
            className={`${C.card} p-6 flex gap-4 items-start transition-all duration-300 hover:-translate-y-1 hover:border-[#4f9cf9]/30 hover:shadow-[0_12px_48px_rgba(0,0,0,.5)]`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <IconBox icon={m.icon} color={m.color} />
            <div>
              <h3 className="font-bold text-white text-sm mb-1">{m.title}</h3>
              <p className="text-slate-400 text-xs leading-relaxed">{m.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideMapaNodal() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div>
        <Eyebrow>Innovación Técnica</Eyebrow>
        <SectionTitle>Mapa Nodal <span className="text-[#4f9cf9]">3D</span></SectionTitle>
        <Sub>Cada prestador, proyecto y locación es un nodo. El grafo 3D muestra cómo se conectan todos en tiempo real.</Sub>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="flex flex-col gap-3">
          {[
            { icon: "⬡", color: "gold"   as const, title: "Shaders WebGL personalizados",       desc: "Renderizado 3D en tiempo real directamente en el navegador sin plugins." },
            { icon: "🌀", color: "blue"   as const, title: "Físicas de grafos 3D",               desc: "Conexiones con peso y distancia basadas en relaciones reales del ecosistema." },
            { icon: "🔗", color: "purple" as const, title: "Nodos: Prestadores · Proyectos · Locaciones", desc: "Cada entidad es un nodo interactivo en el grafo tridimensional." },
            { icon: "📡", color: "green"  as const, title: "Conexiones dinámicas en tiempo real", desc: "El grafo se actualiza con cada nueva relación creada en la plataforma." },
          ].map((f) => (
            <div key={f.title} className={`${C.card} px-4 py-3 flex gap-3 items-start transition-all duration-200 hover:border-[#4f9cf9]/30`}>
              <IconBox icon={f.icon} color={f.color} />
              <div>
                <div className="font-bold text-white text-xs mb-0.5">{f.title}</div>
                <p className="text-slate-400 text-xs leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Animated node graph — same as page.tsx */}
        <div className={`${C.card} p-8 relative overflow-hidden flex flex-col gap-4`}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(79,156,249,.06),transparent_70%)]" />
          <div className="relative h-44">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
              <line x1="200" y1="100" x2="80"  y2="35"  stroke="rgba(79,156,249,.25)"  strokeWidth="1.5" strokeDasharray="5 5"/>
              <line x1="200" y1="100" x2="320" y2="35"  stroke="rgba(124,58,237,.25)" strokeWidth="1.5" strokeDasharray="5 5"/>
              <line x1="200" y1="100" x2="60"  y2="170" stroke="rgba(16,185,129,.2)"  strokeWidth="1.5" strokeDasharray="5 5"/>
              <line x1="200" y1="100" x2="340" y2="168" stroke="rgba(239,68,68,.18)"  strokeWidth="1.5" strokeDasharray="5 5"/>
            </svg>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-orange-500/20 border-2 border-orange-500/50 flex items-center justify-center text-2xl animate-pulse">⬡</div>
            <div className="absolute top-[10%] left-[15%] w-11 h-11 rounded-full bg-[#4f9cf9]/15 border-2 border-[#4f9cf9]/40 flex items-center justify-center text-lg" style={{animation:"pulse 3s ease-in-out .5s infinite"}}>🎬</div>
            <div className="absolute top-[10%] right-[15%] w-11 h-11 rounded-full bg-[#7c3aed]/15 border-2 border-[#7c3aed]/40 flex items-center justify-center text-lg" style={{animation:"pulse 3s ease-in-out 1s infinite"}}>🎭</div>
            <div className="absolute bottom-[10%] left-[10%] w-11 h-11 rounded-full bg-[#10b981]/12 border-2 border-[#10b981]/35 flex items-center justify-center text-lg" style={{animation:"pulse 3s ease-in-out 1.5s infinite"}}>📍</div>
            <div className="absolute bottom-[10%] right-[10%] w-11 h-11 rounded-full bg-[#ef4444]/12 border-2 border-[#ef4444]/30 flex items-center justify-center text-lg" style={{animation:"pulse 3s ease-in-out 2s infinite"}}>🎞️</div>
          </div>
          <div className="flex justify-center gap-4 flex-wrap relative z-10">
            {[["rgb(234 88 12)","Prestador"],["#4f9cf9","Proyectos"],["#7c3aed","Productoras"],["#10b981","Locaciones"]].map(([c,l])=>(
              <div key={l as string} className="flex items-center gap-1.5 text-slate-400 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{background:c as string}}/>{l}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <Tag color="blue">react-force-graph-3d</Tag>
            <Tag color="blue">WebGL Shaders</Tag>
            <Tag>Three.js</Tag>
          </div>
        </div>
      </div>
    </div>
  );
}

function SlideSeguridad() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div>
        <Eyebrow>Módulo 1 — Seguridad</Eyebrow>
        <SectionTitle>Privacidad <span className="text-orange-500">por Diseño</span></SectionTitle>
      </div>
      <Card className="border-l-2 border-l-[#4f9cf9] flex gap-5 items-start">
        <span className="text-5xl mt-1">🛡</span>
        <div className="flex flex-col gap-2">
          <div className="font-bold text-white">Protección de Datos Personales</div>
          <p className="text-slate-400 text-sm leading-relaxed">En el Directorio Público, teléfonos y correos están ocultos. Si un productor se interesa en un talento, debe enviar una "Solicitud de Contacto" a través del sistema. El prestador recibe una alerta y <strong className="text-white">decide si aprueba o rechaza</strong> revelar sus datos.</p>
        </div>
      </Card>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "JWT",        color: "orange" as const, desc: "Tokens seguros para autenticar sesiones sin estado entre frontend y backend." },
          { label: "BCRYPT",     color: "blue"   as const, desc: "Cifrado de contraseñas con hashing adaptativo. Nunca se almacenan en texto plano." },
          { label: "RBAC GUARDS",color: "purple" as const, desc: "NestJS Guards diferencian estrictamente los permisos entre Admin, Prestador y Contratante." },
        ].map((s) => (
          <Card key={s.label} className="flex flex-col gap-2">
            <Tag color={s.color}>{s.label}</Tag>
            <p className="text-slate-400 text-xs leading-relaxed">{s.desc}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SlideLocaciones() {
  const cats = [
    { icon: "🌲", label: "Paisaje Natural" },
    { icon: "🏙️", label: "Paisaje Urbano" },
    { icon: "🏚️", label: "Abandonados" },
    { icon: "⚓",  label: "Infra. Acuática" },
    { icon: "🏛️", label: "Gubernamental" },
    { icon: "✈️",  label: "Infra. Aérea" },
    { icon: "🛤️",  label: "Paisaje Rural" },
    { icon: "⛪",  label: "Religioso" },
  ];
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div>
        <Eyebrow>Módulo 3 — Locaciones</Eyebrow>
        <SectionTitle>Scouting <span className="text-[#4f9cf9]">Digital</span></SectionTitle>
        <Sub>Base de datos visual para realizar scouting a distancia — clave para atraer producciones nacionales.</Sub>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="flex flex-col gap-4">
          {[
            { icon: "📷", color: "gold"   as const, title: "Fichas Técnicas",     desc: "Descripción, nivel de accesibilidad logística y galerías fotográficas alojadas en Supabase Storage." },
            { icon: "🗺️", color: "blue"   as const, title: "Geolocalización",     desc: "Coordenadas exactas (Lat/Long) con visualización en mapa interactivo Leaflet para planificación de rodaje." },
            { icon: "🏙️", color: "purple" as const, title: "Tres ciudades cubiertas", desc: "Ushuaia · Tolhuin · Río Grande" },
          ].map((f) => (
            <Card key={f.title} className="flex gap-3 items-start py-4">
              <IconBox icon={f.icon} color={f.color} />
              <div>
                <div className="font-bold text-white text-sm mb-1">{f.title}</div>
                <p className="text-slate-400 text-xs leading-relaxed">{f.desc}</p>
              </div>
            </Card>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <div className="text-xs font-bold text-slate-400 tracking-widest uppercase">Categorías de Locación</div>
          <div className="grid grid-cols-2 gap-2">
            {cats.map((c) => (
              <div key={c.label} className={`${C.card} px-3 py-2 flex items-center gap-2 text-xs text-slate-300 transition-colors hover:border-orange-500/30`}>
                <span>{c.icon}</span>{c.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SlideDashboard() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div>
        <Eyebrow>Módulo 5 — Admin</Eyebrow>
        <SectionTitle>Panel <span className="text-orange-500">Master Admin</span></SectionTitle>
        <Sub>Dashboard exclusivo con visión total y control absoluto del ecosistema.</Sub>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="flex flex-col gap-4">
          {[
            { icon: "📊", accent: "orange" as const, title: "Métricas Dinámicas",       desc: "Gráficos en vivo con Recharts: cantidad de usuarios, crecimiento de proyectos y distribución del talento por ciudad." },
            { icon: "🎛️", accent: "blue"   as const, title: "Control ABM Total",         desc: "Alta, Baja y Modificación sobre cualquier usuario, perfil, locación o proyecto. Moderación de contenido." },
            { icon: "🌐", accent: "purple" as const, title: "Visualizador de Nodos 3D", desc: "Representación espacial e interactiva de conexiones entre locaciones, proyectos y talento en tiempo real." },
          ].map((f) => (
            <Card key={f.title} accent={f.accent} className="flex gap-3 items-start py-4">
              <IconBox icon={f.icon} color={f.accent === "orange" ? "gold" : f.accent as "blue"|"purple"} />
              <div>
                <div className="font-bold text-white text-sm mb-1">{f.title}</div>
                <p className="text-slate-400 text-xs leading-relaxed">{f.desc}</p>
              </div>
            </Card>
          ))}
        </div>
        <Card className="flex flex-col gap-5 items-center text-center">
          <span className="text-6xl mt-2">🛡</span>
          <div className="font-bold text-white">Acceso Exclusivo</div>
          <p className="text-slate-400 text-sm leading-relaxed">El Panel Admin es accesible solo para usuarios con rol <strong className="text-orange-500">Master Admin</strong>, protegido por Guards RBAC de NestJS en cada endpoint.</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Tag color="orange">Recharts</Tag>
            <Tag color="blue">JWT Guard</Tag>
            <Tag color="purple">RBAC</Tag>
            <Tag>Three.js</Tag>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SlideStack() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div>
        <Eyebrow>Arquitectura</Eyebrow>
        <SectionTitle>Stack <span className="text-[#4f9cf9]">Técnico</span></SectionTitle>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="flex flex-col gap-3">
          <div className="text-xs font-bold text-slate-400 tracking-widest uppercase px-1 mb-1">Capas del Sistema</div>
          {[
            { icon: "⚛️", label: "Frontend",     tech: "Next.js 14 · Tailwind CSS · Framer Motion · TypeScript",  color: "border-l-[#4f9cf9]",  textColor: "text-[#4f9cf9]"  },
            { icon: "⚙️", label: "Backend API",  tech: "NestJS · REST · Passport.js · JWT · RBAC Guards",         color: "border-l-orange-500", textColor: "text-orange-500" },
            { icon: "🗄️", label: "Base de Datos",tech: "PostgreSQL (Supabase) · Prisma ORM · Supabase Storage",    color: "border-l-[#f59e0b]",  textColor: "text-[#f59e0b]"  },
            { icon: "🐳", label: "Deploy",       tech: "Docker · Vercel (Frontend) · Render (Backend) · CI/CD",   color: "border-l-[#7c3aed]",  textColor: "text-[#7c3aed]"  },
          ].map((l) => (
            <div key={l.label} className={`${C.card} px-4 py-3 flex gap-3 items-center border-l-2 ${l.color}`}>
              <span className="text-xl w-6 text-center">{l.icon}</span>
              <div>
                <div className={`text-xs font-bold tracking-widest uppercase ${l.textColor}`}>{l.label}</div>
                <div className="text-slate-300 text-xs">{l.tech}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <div className="text-xs font-bold text-slate-400 tracking-widest uppercase px-1 mb-1">Evolución Arquitectónica</div>
          <Card className="opacity-50 flex flex-col gap-2">
            <div className="text-xs font-bold text-slate-400 tracking-widest uppercase">Plan Inicial 2023</div>
            <p className="text-slate-400 text-xs">JavaScript vainilla · Node.js + Express simple · Mapas 2D · Deploy monolítico</p>
          </Card>
          <Card accent="blue" className="flex flex-col gap-2">
            <div className="text-xs font-bold text-[#4f9cf9] tracking-widest uppercase">Producto Final — Enterprise</div>
            <p className="text-slate-300 text-xs leading-relaxed">TypeScript estricto en todo el stack · NestJS modular · Next.js SSR · Prisma ORM · Contenedores Docker · WebGL 3D</p>
          </Card>
          <Card className="flex flex-col gap-2">
            <div className="text-xs font-bold text-white tracking-widest uppercase">Metodología</div>
            <p className="text-slate-400 text-xs leading-relaxed">Kanban adaptado (Trello) para equipo unipersonal. Entregas iterativas modulares con foco en flexibilidad técnica.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SlideNotificaciones() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div>
        <Eyebrow>Módulo 6 — Comunicación</Eyebrow>
        <SectionTitle>Alertas en <span className="text-[#f59e0b]">Tiempo Real</span></SectionTitle>
        <Sub>El sistema mantiene informados a todos los actores sobre las interacciones clave.</Sub>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="flex flex-col gap-4">
          <Card accent="orange" className="flex gap-3 items-start">
            <IconBox icon="🔔" color="gold" />
            <div>
              <div className="font-bold text-white text-sm mb-1">Notificaciones UI</div>
              <p className="text-xs text-slate-400 leading-relaxed">Campanita de notificaciones con trazabilidad de estados (Leído/No Leído). Alertas para solicitudes de contacto y nuevas postulaciones.</p>
            </div>
          </Card>
          <Card accent="blue" className="flex gap-3 items-start">
            <IconBox icon="📧" color="blue" />
            <div>
              <div className="font-bold text-white text-sm mb-1">Mailing Automático</div>
              <p className="text-xs text-slate-400 leading-relaxed">Correos automáticos vía Nodemailer: confirmación de registro, recuperación de contraseña y notificaciones de actividad clave.</p>
            </div>
          </Card>
        </div>
        <div className="flex flex-col gap-3">
          {[
            { icon: "📢", title: "Postulación",              desc: "Cuando un prestador aplica a un proyecto, el productor recibe notificación instantánea con link al perfil del candidato." },
            { icon: "🤝", title: "Solicitud de Contacto",    desc: "Si un productor pide los datos de un talento, éste recibe una alerta para aprobar o rechazar la solicitud." },
            { icon: "✅", title: "Aceptación de Candidatura", desc: "El prestador recibe confirmación cuando su postulación es aceptada o rechazada por el productor." },
          ].map((f) => (
            <div key={f.title} className={`${C.card} rounded-xl p-4 border-l-2 border-orange-500 bg-orange-500/[.03] text-sm transition-all hover:bg-orange-500/[.06] hover:translate-x-1`}>
              <span className="block text-slate-200 font-bold mb-1 text-xs">{f.icon} {f.title}</span>
              <span className="text-slate-400 text-xs leading-relaxed">{f.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SlideImpacto() {
  return (
    <div className="w-full max-w-3xl mx-auto px-4 flex flex-col gap-6">
      <div>
        <Eyebrow>Propuesta de Valor</Eyebrow>
        <SectionTitle>El Código al Servicio<br />del <span className="text-orange-500">Arte</span></SectionTitle>
      </div>
      <Card className="border-l-2 border-l-orange-500 relative overflow-hidden">
        <div className="pointer-events-none absolute top-0 right-0 text-[120px] opacity-[.03] leading-none select-none">🎬</div>
        <p className="text-slate-200 text-lg font-light italic leading-relaxed mb-4">
          "Identifiqué que la plataforma podría ser útil para reunir a los prestadores entre sí y generar una comunidad cohesionada para la industria audiovisual fueguina."
        </p>
        <Divider />
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          La migración a TypeScript, Docker y arquitecturas enterprise no fue un fin en sí mismo — fue el medio necesario para construir un producto real, escalable y duradero que la industria necesita.
        </p>
        <div className="flex flex-wrap gap-2">
          <Tag color="orange">Industria Cultural</Tag>
          <Tag color="blue">Políticas Públicas Digitales</Tag>
          <Tag color="purple">Diversificación Productiva TDF</Tag>
        </div>
      </Card>
    </div>
  );
}

function SlideResumen() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6 items-center text-center">
      <div>
        <Eyebrow>Resumen</Eyebrow>
        <SectionTitle>Una plataforma <span className="text-[#4f9cf9]">completa</span></SectionTitle>
      </div>
      <div className="grid grid-cols-3 gap-4 w-full">
        {[
          { num: "6", label: "Módulos funcionales implementados",    color: "text-orange-500" },
          { num: "3", label: "Tipos de usuario con roles diferenciados", color: "text-[#4f9cf9]" },
          { num: "4", label: "Perfiles simultáneos por prestador",   color: "text-[#10b981]" },
        ].map((s) => (
          <div key={s.num} className={`${C.card} p-6 flex flex-col items-center gap-2`}>
            <div className={`text-5xl font-extrabold ${s.color}`}>{s.num}</div>
            <div className="text-xs text-slate-400 leading-relaxed">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-3 w-full">
        {[
          { icon: "⚛️", label: "Next.js 14",  sub: "Frontend SSR",  color: "text-[#4f9cf9]" },
          { icon: "⚙️", label: "NestJS",      sub: "Backend API",   color: "text-orange-500" },
          { icon: "🗄️", label: "PostgreSQL",  sub: "+ Prisma ORM",  color: "text-[#f59e0b]" },
          { icon: "🐳", label: "Docker",      sub: "Containerized", color: "text-[#7c3aed]" },
        ].map((s) => (
          <div key={s.label} className={`${C.card} p-5 flex flex-col items-center gap-2`}>
            <span className="text-3xl">{s.icon}</span>
            <div className={`text-sm font-bold ${s.color}`}>{s.label}</div>
            <div className="text-xs text-slate-500">{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideDemo() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 h-full gap-6">
      <div>
        <Eyebrow>Demo</Eyebrow>
        <SectionTitle>Plataforma <span className="text-[#4f9cf9]">en Vivo</span></SectionTitle>
      </div>
      <div className="bg-white p-3 rounded-2xl shadow-[0_0_40px_rgba(79,156,249,.2)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://lab2026.vercel.app/info&color=060810&bgcolor=ffffff"
          alt="QR Code lab2026.vercel.app"
          className="w-36 h-36 rounded-lg block"
        />
      </div>
      <div className="font-mono text-slate-400 text-lg">
        lab2026.<span className="text-[#4f9cf9]">vercel.app</span>
      </div>
      <div className={`${C.card} px-8 py-4 flex gap-6 items-center`}>
        {[
          { label: "Frontend", sub: "Vercel",   color: "text-orange-500" },
          { label: "Backend",  sub: "Render",   color: "text-[#4f9cf9]"  },
          { label: "Database", sub: "Supabase", color: "text-[#10b981]"  },
        ].map((s, i) => (
          <div key={s.label} className="flex items-center gap-6">
            {i > 0 && <div className="w-px h-8 bg-white/10" />}
            <div className="flex flex-col items-center gap-0.5">
              <div className={`text-xs font-bold tracking-widest uppercase ${s.color}`}>{s.label}</div>
              <div className="text-sm text-slate-400">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideCierre() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 h-full gap-6">
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(234,88,12,.07),transparent_70%)]" />
      {/* Film strip */}
      <div className="flex items-center gap-1 opacity-60 mb-2">
        {[...Array(10)].map((_, i) => (
          <div key={i} className={`${i % 3 === 1 ? "w-6 h-4 border border-orange-500/60 rounded-sm flex items-center justify-center" : "w-2 h-2 bg-orange-500/50 rounded-sm"}`}>
            {i % 3 === 1 && <div className="w-3 h-2 bg-orange-500/30 rounded-sm" />}
          </div>
        ))}
      </div>
      <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight relative">
        ¡Muchas <span className="text-orange-500">Gracias</span>!
      </h1>
      <div className="w-12 h-0.5 bg-orange-500/60 rounded" />
      <p className="text-slate-400 max-w-md">
        Film Commission TDF — conectando la industria audiovisual del Fin del Mundo.
      </p>
      <div className="flex gap-8 text-center mt-2">
        {[
          { label: "Desarrollador", val: "Ezequiel Rodríguez Ibarra"  },
          { label: "Plataforma",    val: "lab2026.vercel.app",         highlight: true },
        ].map((m) => (
          <div key={m.label} className="flex flex-col gap-1">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-orange-500">{m.label}</span>
            <span className={`text-sm font-medium ${m.highlight ? "text-[#4f9cf9]" : "text-slate-300"}`}>{m.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Map slide id → component
const SLIDE_COMPONENTS: Record<SlideId, React.FC> = {
  portada:             SlidePortada,
  "que-es":            SlideQueEs,
  contexto:            SlideContexto,
  problema:            SlideProblema,
  solucion:            SlideSolucion,
  usuarios:            SlideUsuarios,
  perfiles:            SlidePerfiles,
  "journey-prestador":   SlideJourneyPrestador,
  "journey-contratante": SlideJourneyContratante,
  modulos:             SlideModulos,
  "mapa-nodal":        SlideMapaNodal,
  seguridad:           SlideSeguridad,
  locaciones:          SlideLocaciones,
  dashboard:           SlideDashboard,
  stack:               SlideStack,
  notificaciones:      SlideNotificaciones,
  impacto:             SlideImpacto,
  resumen:             SlideResumen,
  demo:                SlideDemo,
  cierre:              SlideCierre,
};

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG PANEL (topology controls — mismo que page.tsx)
// ─────────────────────────────────────────────────────────────────────────────
function DebugPanel({
  params,
  setParams,
  onClose,
}: {
  params: typeof DEFAULT_TOPOLOGY;
  setParams: React.Dispatch<React.SetStateAction<typeof DEFAULT_TOPOLOGY>>;
  onClose: () => void;
}) {
  return (
    <div className="fixed left-24 top-1/2 -translate-y-1/2 w-72 rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-2xl overflow-hidden z-[61]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-gradient-to-r from-slate-900/90 to-transparent">
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">TopologyBackground</span>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors">
          <X size={18} />
        </button>
      </div>
      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Gradient color */}
        <div>
          <span className="text-xs font-bold text-slate-400 block mb-2">Color base del gradiente (izq. → der.)</span>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={params.gradientBaseColor ?? "#3b82f6"}
              onChange={(e) => setParams((p) => ({ ...p, gradientBaseColor: e.target.value }))}
              className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent"
            />
            <span className="text-xs font-mono text-slate-500">{params.gradientBaseColor ?? "Por defecto"}</span>
            {params.gradientBaseColor != null && (
              <button type="button" onClick={() => setParams((p) => ({ ...p, gradientBaseColor: null }))} className="text-xs text-slate-500 hover:text-white">
                Quitar
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-600 mt-1">Genera 7 colores por rotación de tono de izquierda a derecha.</p>
        </div>
        {/* Sliders */}
        {[
          { key: "LINES",        label: "Líneas",           min: 4,   max: 40,  step: 1    },
          { key: "STEPS",        label: "Pasos",            min: 40,  max: 280, step: 10   },
          { key: "BASE_SPEED",   label: "Velocidad base",   min: 0.2, max: 2,   step: 0.05 },
          { key: "WAVE_AMP",     label: "Amplitud onda",    min: 5,   max: 80,  step: 1    },
          { key: "MOUSE_RADIUS", label: "Radio mouse (px)", min: 40,  max: 320, step: 10   },
          { key: "MOUSE_FORCE",  label: "Fuerza mouse",     min: 10,  max: 80,  step: 2    },
        ].map(({ key, label, min, max, step }) => (
          <div key={key}>
            <label className="flex justify-between items-center gap-2 mb-1">
              <span className="text-xs font-bold text-slate-400">{label}</span>
              <span className="text-xs font-mono text-orange-400 tabular-nums">
                {typeof params[key as keyof typeof params] === "number" ? params[key as keyof typeof params] : ""}
              </span>
            </label>
            <input
              type="range" min={min} max={max} step={step}
              value={(params[key as keyof typeof params] as number) ?? min}
              onChange={(e) => setParams((p) => ({
                ...p,
                [key]: step >= 1 ? parseInt(e.target.value, 10) : parseFloat(e.target.value),
              }))}
              className="w-full h-2 rounded-full bg-slate-800 accent-orange-500"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setParams(DEFAULT_TOPOLOGY)}
          className="w-full py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white border border-white/10 hover:border-orange-500/30 transition-colors"
        >
          Restaurar valores
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function PresentationPage() {
  const [current, setCurrent]   = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);

  // Debug
  const [showDebugBtn, setShowDebugBtn] = useState(false);
  const [debugOpen, setDebugOpen]       = useState(false);
  const [topoParams, setTopoParams]     = useState(DEFAULT_TOPOLOGY);

  const total = SLIDES.length;

  const goTo = useCallback((idx: number, dir: "forward" | "back" = "forward") => {
    if (animating || idx === current || idx < 0 || idx >= total) return;
    setDirection(dir);
    setAnimating(true);
    setCurrent(idx);
    setTimeout(() => setAnimating(false), 500);
  }, [animating, current, total]);

  const next = useCallback(() => goTo(current + 1, "forward"),  [goTo, current]);
  const prev = useCallback(() => goTo(current - 1, "back"),     [goTo, current]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        if (typeof window !== "undefined" && window.innerWidth < 768) return;
        setShowDebugBtn((v) => !v);
        return;
      }
      if (e.code === "ArrowRight" || e.code === "KeyD" || e.code === "Space") { e.preventDefault(); next(); }
      if (e.code === "ArrowLeft"  || e.code === "KeyA")                         { e.preventDefault(); prev(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev]);

  // Touch swipe
  const touchX = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    const diff = touchX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) diff > 0 ? next() : prev();
  };

  // Click half-screen
  const onDeckClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("[data-no-nav]")) return;
    if (e.clientX > window.innerWidth / 2) next(); else prev();
  };

  const topoProps = {
    ...topoParams,
    gradientColors: topoParams.gradientBaseColor != null
      ? gradientColorsFromBase(topoParams.gradientBaseColor)
      : undefined,
  };

  const progress = ((current + 1) / total) * 100;
  const SlideContent = SLIDE_COMPONENTS[SLIDES[current].id];

  // Scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <main className="bg-[#060810] text-slate-200 w-screen h-screen overflow-hidden relative select-none">

      {/* Topology animated background */}
      <TopologyBackground {...(topoProps as Record<string, unknown>)} />

      {/* Progress bar */}
      <div
        className="fixed top-0 left-0 h-0.5 bg-gradient-to-r from-orange-500 to-[#f59e0b] z-50 transition-all duration-500 ease-out"
        style={{ width: `${progress}%` }}
      />

      {/* Logo — top left */}
      <div className="fixed top-5 left-6 z-40 flex items-center gap-2 opacity-60 pointer-events-none">
        <span className="text-orange-500 text-base">▶</span>
        <span className="text-sm font-bold text-slate-300 tracking-wide">TDFFILM</span>
      </div>

      {/* Slide counter — top right */}
      <div className="fixed top-5 right-6 z-40 text-xs font-bold text-slate-500 tracking-widest opacity-70 pointer-events-none">
        {String(current + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>

      {/* Debug button (Shift para mostrar) */}
      {showDebugBtn && (
        <div className="hidden md:block fixed left-6 top-[38%] -translate-y-1/2 z-[60]">
          <button
            type="button"
            data-no-nav
            onClick={() => setDebugOpen((o) => !o)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950/90 backdrop-blur-xl border border-white/10 text-slate-300 hover:text-white hover:border-orange-500/40 hover:shadow-[0_0_20px_rgba(249,115,22,0.15)] transition-all font-bold text-sm"
          >
            <Settings2 size={18} />
            Debug
          </button>
          {debugOpen && (
            <DebugPanel
              params={topoParams}
              setParams={setTopoParams}
              onClose={() => setDebugOpen(false)}
            />
          )}
        </div>
      )}

      {/* Slide area */}
      <div
        className="relative z-10 w-full h-full flex items-center justify-center cursor-pointer"
        onClick={onDeckClick}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Slide wrapper with transition */}
        <div
          key={current}
          className="w-full h-full flex items-center justify-center overflow-y-auto py-16"
          style={{
            animation: animating
              ? `${direction === "forward" ? "slideIn" : "slideInBack"} 0.5s cubic-bezier(0.22,1,0.36,1) both`
              : "none",
          }}
        >
          <SlideContent />
        </div>
      </div>

      {/* Bottom nav bar */}
      <div
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-2.5 rounded-full bg-slate-950/85 backdrop-blur-xl border border-white/10 shadow-xl"
        data-no-nav
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={prev}
          disabled={current === 0}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={18} />
        </button>

        {/* Dot indicators — only show 5 around current */}
        <div className="flex items-center gap-1.5">
          {SLIDES.map((_, i) => {
            const dist = Math.abs(i - current);
            if (dist > 4) return null;
            return (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i, i > current ? "forward" : "back")}
                className={`rounded-full transition-all duration-300 ${
                  i === current
                    ? "w-5 h-2 bg-orange-500"
                    : dist <= 1
                    ? "w-2 h-2 bg-slate-600 hover:bg-slate-400"
                    : "w-1.5 h-1.5 bg-slate-700 hover:bg-slate-500"
                }`}
                title={SLIDES[i].label}
              />
            );
          })}
        </div>

        <button
          type="button"
          onClick={next}
          disabled={current === total - 1}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={18} />
        </button>

        {/* Slide label */}
        <span className="ml-1 text-[10px] font-bold text-slate-500 tracking-widest uppercase hidden sm:block min-w-[120px] text-center">
          {SLIDES[current].label}
        </span>
      </div>

      {/* Key hint */}
      <div className="fixed bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-slate-700 tracking-widest z-30 pointer-events-none">
        ← → · Espacio · Click · Shift = Debug
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(40px) scale(0.98); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes slideInBack {
          from { opacity: 0; transform: translateX(-40px) scale(0.98); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up { animation: fade-up 0.65s ease both; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>
    </main>
  );
}