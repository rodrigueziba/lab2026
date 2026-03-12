"use client";

/**
 * FILM COMMISSION TDF — Presentación Interactiva (Versión Actualizada)
 * ─────────────────────────────────────────────────
 * Frontend: app/presentacion/page.tsx
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { 
  X, Settings2, ChevronLeft, ChevronRight, 
  Globe, Rocket, Sparkles, Dices, Target 
} from "lucide-react";
import TopologyBackground from "./TopologyBackground";

// ─────────────────────────────────────────────────────────────────────────────
// TOPOLOGY DEBUG 
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
// SLIDE DATA (25 Slides Totales - Reordenado)
// ─────────────────────────────────────────────────────────────────────────────
type SlideId =
  | "portada" | "que-es" | "contexto" | "problema" | "enfoque" | "stack" | "impacto" 
  | "solucion" | "internacionalizacion" | "usuarios" | "perfiles"
  | "journey-prestador" | "journey-contratante" 
  | "onboarding" | "gamificacion" | "descubrimiento-ia"
  | "modulos" | "mapa-nodal" | "seguridad"
  | "locaciones" | "dashboard" 
  | "notificaciones" | "resumen" | "demo" | "cierre";

interface Slide { id: SlideId; label: string; }

const SLIDES: Slide[] = [
  { id: "portada",              label: "Portada"             },
  { id: "que-es",               label: "¿Qué es?"            },
  { id: "contexto",             label: "Contexto"            },
  { id: "problema",             label: "Problema"            },
  { id: "enfoque",              label: "El Enfoque"          },
  { id: "stack",                label: "Stack Técnico"       },
  { id: "impacto",              label: "Impacto"             },
  { id: "solucion",             label: "Solución"            },
  { id: "internacionalizacion", label: "Visión Global"       },
  { id: "usuarios",             label: "Usuarios"            },
  { id: "perfiles",             label: "Perfiles"            },
  { id: "journey-prestador",    label: "Journey Prestador"   },
  { id: "journey-contratante",  label: "Journey Contratante" },
  { id: "onboarding",           label: "Retención/Onboarding"},
  { id: "gamificacion",         label: "Gamificación"        },
  { id: "descubrimiento-ia",    label: "IA & Descubrimiento" },
  { id: "modulos",              label: "Módulos"             },
  { id: "mapa-nodal",           label: "Mapa Nodal 3D"       },
  { id: "seguridad",            label: "Seguridad"           },
  { id: "locaciones",           label: "Locaciones"          },
  { id: "dashboard",            label: "Dashboard Admin"     },
  { id: "notificaciones",       label: "Matchmaking & Alertas"},
  { id: "resumen",              label: "Resumen"             },
  { id: "demo",                 label: "Demo"                },
  { id: "cierre",               label: "Cierre"              },
];

// Color tokens
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
  return <span className="text-orange-500 text-xs font-bold tracking-[.15em] uppercase">{children}</span>;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">{children}</h2>;
}
function Sub({ children, center = false }: { children: React.ReactNode; center?: boolean }) {
  return <p className={`mt-3 text-slate-400 max-w-lg text-sm leading-relaxed ${center ? "mx-auto text-center" : ""}`}>{children}</p>;
}
function Divider() {
  return <div className="h-px w-12 bg-orange-500/60 rounded my-4" />;
}
function Card({ children, className = "", accent }: { children: React.ReactNode; className?: string; accent?: "orange" | "blue" | "purple" | "green"; }) {
  const topBorder = { orange: "border-t-2 border-t-orange-500", blue: "border-t-2 border-t-[#4f9cf9]", purple: "border-t-2 border-t-[#7c3aed]", green: "border-t-2 border-t-[#10b981]" };
  return (
    <div className={`${C.card} p-6 transition-all duration-300 hover:-translate-y-1 hover:border-orange-500/30 hover:shadow-[0_12px_40px_rgba(0,0,0,.5)] ${accent ? topBorder[accent] : ""} ${className}`}>
      {children}
    </div>
  );
}
function IconBox({ icon, color }: { icon: string; color: "gold" | "blue" | "purple" | "green" }) {
  const bg = { gold: "bg-orange-500/10", blue: "bg-[#4f9cf9]/10", purple: "bg-[#7c3aed]/10", green: "bg-[#10b981]/10" };
  return <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${bg[color]}`}>{icon}</div>;
}
function Tag({ children, color = "default" }: { children: React.ReactNode; color?: "default" | "orange" | "blue" | "purple" | "green" }) {
  const styles = { default: "bg-white/5 border border-white/[.07] text-slate-400", orange: "bg-orange-500/10 border border-orange-500/25 text-orange-400", blue: "bg-[#4f9cf9]/10 border border-[#4f9cf9]/25 text-[#4f9cf9]", purple: "bg-[#7c3aed]/10 border border-[#7c3aed]/25 text-[#7c3aed]", green: "bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981]" };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${styles[color]}`}>{children}</span>;
}
function JourneyCard({ num, icon, title, desc, tags, color, last }: { num: number; icon: string; title: string; desc: string; tags: string[]; color: "gold" | "blue" | "purple"; last?: boolean; }) {
  const numClass = { gold: C.goldNum, blue: C.blueNum, purple: C.purpleNum };
  return (
    <div className="flex items-start gap-5 relative">
      {!last && <div className="absolute left-7 top-14 bottom-0 w-0.5 bg-gradient-to-b from-orange-500/30 via-[#4f9cf9]/20 to-transparent" />}
      <div className={`flex-shrink-0 w-14 h-14 rounded-full border-2 flex items-center justify-center font-extrabold text-lg relative z-10 ${numClass[color]}`}>{num}</div>
      <div className="flex-1 pb-7">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">{icon}</span>
          <h3 className="font-bold text-base text-white">{title}</h3>
        </div>
        <p className="text-slate-400 text-sm leading-relaxed mb-3">{desc}</p>
        <div className="flex flex-wrap gap-2">{tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>
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
      <div className="flex items-center gap-1 opacity-60 mb-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className={`${i % 3 === 1 ? "w-6 h-4 border border-orange-500/60 rounded-sm flex items-center justify-center" : "w-2 h-2 bg-orange-500/50 rounded-sm"}`}>
            {i % 3 === 1 && <div className="w-3 h-2 bg-orange-500/30 rounded-sm" />}
          </div>
        ))}
      </div>
      <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-500 text-xs font-semibold tracking-widest uppercase animate-fade-up">
        📽 Laboratorio de Software (IF055) · 2026
      </span>
      <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight animate-fade-up [animation-delay:100ms]">
        Film Commission<br /><span className="text-orange-500">TDF</span>
      </h1>
      <p className="text-slate-400 max-w-xl text-lg animate-fade-up [animation-delay:200ms]">
        Plataforma Integral de la Industria Audiovisual de Tierra del Fuego
      </p>
      <div className="w-12 h-0.5 bg-orange-500/60 rounded animate-fade-up [animation-delay:300ms]" />
      <div className="flex gap-8 text-center animate-fade-up [animation-delay:400ms]">
        {[{ label: "Desarrollador", val: "Ezequiel Ibarra" }, { label: "Cátedra", val: "Laboratorio de Software (IF055)" }, { label: "Año", val: "2026" }].map((m) => (
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
      <div><Eyebrow>Contexto</Eyebrow><SectionTitle>¿Qué es una <span className="text-orange-500">Film Commission</span>?</SectionTitle></div>
      <Card accent="orange">
        <p className="text-slate-200 text-sm leading-relaxed">
          Es una entidad destinada a facilitar a los productores audiovisuales nacionales e internacionales toda la información y logística que precisen para la realización de rodajes en un lugar determinado.
        </p>
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[{ icon: "🎬", color: "gold" as const, title: "Promoción", desc: "Promueve la industria y visibiliza la zona en la que opera." }, { icon: "🌍", color: "blue" as const, title: "Asesoramiento", desc: "Brinda información, oferta de locaciones y apoyo logístico integral." }, { icon: "🤝", color: "purple" as const, title: "Conexión", desc: "Conecta productores externos con prestadores y talento local." }].map((c) => (
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
      <div><Eyebrow>Historia y Actualidad</Eyebrow><SectionTitle>El Contexto <span className="text-[#4f9cf9]">Fueguino</span></SectionTitle></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-3"><IconBox icon="📽" color="gold" /><div className="font-bold text-white text-sm">La mirada externa</div></div>
          <p className="text-slate-400 text-xs leading-relaxed">Durante casi 100 años, el territorio fueguino fue registrado por producciones ajenas. Sus representaciones se construyeron desde afuera.</p>
        </Card>
        <Card accent="blue" className="flex flex-col gap-3">
          <div className="flex items-center gap-3"><IconBox icon="✨" color="blue" /><div className="font-bold text-white text-sm">La irrupción local</div></div>
          <p className="text-slate-400 text-xs leading-relaxed">En los últimos cinco años surgieron las primeras producciones independientes fueguinas con estándares profesionales.</p>
          <div className="flex flex-wrap gap-2 mt-1"><Tag>UNTDF</Tag><Tag>INCAA</Tag></div>
        </Card>
      </div>
      <Card className="bg-orange-500/[.03] border-l-2 border-l-orange-500 !rounded-xl py-4">
        <p className="text-slate-300 text-sm leading-relaxed">⚡ Sin embargo, persisten <strong className="text-white">dificultades para articularse como industria</strong>: fragmentación de información y falta de visibilidad.</p>
      </Card>
    </div>
  );
}

function SlideProblema() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div><Eyebrow>El Problema</Eyebrow><SectionTitle>Fragmentación &amp; <span className="text-orange-500">Invisibilidad</span></SectionTitle></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="flex flex-col gap-4 border-l-2 border-l-orange-500">
          <div className="flex items-start gap-3"><span className="text-4xl">🧩</span><div><div className="font-bold text-white mb-1">Fragmentación de la Información</div><p className="text-slate-400 text-xs leading-relaxed">La falta de una base de datos unificada de servicios y prestadores dificulta enormemente el desarrollo del sector local.</p></div></div>
        </Card>
        <Card className="flex flex-col gap-4 border-l-2 border-l-[#f59e0b]">
          <div className="flex items-start gap-3"><span className="text-4xl">👻</span><div><div className="font-bold text-white mb-1">Invisibilidad del Talento</div><p className="text-slate-400 text-xs leading-relaxed">Los productores y profesionales audiovisuales fueguinos son invisibles ante grandes oportunidades. Los externos traen sus propios equipos.</p></div></div>
        </Card>
      </div>
    </div>
  );
}

function SlideEnfoque() {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 flex flex-col gap-6">
      <div>
        <Eyebrow>Estrategia y Desarrollo</Eyebrow>
        <SectionTitle>Comunidad & <span className="text-[#7c3aed]">Retención</span></SectionTitle>
        <Sub>
          Frente a alternativas centradas solo en logística, el objetivo de esta plataforma es consolidar a la comunidad audiovisual: lograr que se registren, interactúen y exhiban su portfolio con el respeto que merece.
        </Sub>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
        <Card className="flex flex-col gap-4 border-l-2 border-l-[#4f9cf9]">
          <div className="font-bold text-white text-lg">Un desarrollador, un lenguaje</div>
          <p className="text-slate-400 text-sm leading-relaxed text-justify">
            Afrontando las limitaciones de ser un único programador sin experiencia previa, se optó por utilizar <strong>JavaScript en todo el ecosistema</strong>. <br/><br/>
            El foco absoluto se puso en retener la atención del usuario y reducir la fricción al completar formularios. Para lograrlo, se priorizó un diseño hiperatractivo apoyado en librerías experimentales para generar curiosidad estética.
          </p>
        </Card>
        <Card accent="purple" className="flex flex-col gap-4 justify-center">
          <div className="font-bold text-white text-sm mb-1 text-center">Características y Herramientas Integradas</div>
          <div className="flex flex-wrap gap-2 justify-center">
            <Tag color="purple">Efectos 3D y 2D</Tag>
            <Tag color="orange">Mapa Galaxia (Nodos)</Tag>
            <Tag color="green">Gamificación de Perfil</Tag>
            <Tag color="blue">IA (Perfiles y Roles)</Tag>
            <Tag color="default">Fotos con Profundidad 3D</Tag>
            <Tag color="purple">Shake to Shuffle (Móvil)</Tag>
            <Tag color="orange">Formularios por Pasos</Tag>
            <Tag color="green">Borradores Automáticos</Tag>
            <Tag color="blue">Fondos Interactivos</Tag>
            <Tag color="default">Tour de Bienvenida</Tag>
            <Tag color="purple">Traducción (EN/ES)</Tag>
            <Tag color="orange">Easter Eggs</Tag>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SlideStack() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div><Eyebrow>Arquitectura</Eyebrow><SectionTitle>El Ecosistema <span className="text-[#f59e0b]">JS Everywhere</span></SectionTitle><Sub>Unificar el código bajo JavaScript/TypeScript eliminó fricciones en un equipo de un solo programador.</Sub></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="flex flex-col gap-3">
          {[{ icon: "⚛️", label: "Frontend", tech: "Next.js 14 · Tailwind · JavaScript/TS", color: "border-l-[#4f9cf9]", textColor: "text-[#4f9cf9]" }, { icon: "⚙️", label: "Backend API", tech: "NestJS · JWT · RBAC", color: "border-l-orange-500", textColor: "text-orange-500" }, { icon: "🗄️", label: "Base de Datos", tech: "PostgreSQL (Supabase) · Prisma", color: "border-l-[#f59e0b]", textColor: "text-[#f59e0b]" }, { icon: "🐳", label: "Deploy", tech: "Docker · Vercel · Render", color: "border-l-[#7c3aed]", textColor: "text-[#7c3aed]" }].map((l) => (
            <div key={l.label} className={`${C.card} px-4 py-3 flex gap-3 items-center border-l-2 ${l.color}`}><span className="text-xl w-6 text-center">{l.icon}</span><div><div className={`text-xs font-bold tracking-widest uppercase ${l.textColor}`}>{l.label}</div><div className="text-slate-300 text-xs">{l.tech}</div></div></div>
          ))}
        </div>
        <div className="flex flex-col gap-4 justify-center">
          <Card accent="blue" className="flex flex-col gap-2"><div className="text-xs font-bold text-[#4f9cf9] tracking-widest uppercase">Producto Final</div><p className="text-slate-300 text-xs leading-relaxed">NestJS modular · Next.js SSR · Contenedores Docker · Integración de WebGL y Three.js para inmersión 3D.</p></Card>
          <Card className="flex items-center gap-4 bg-slate-900/50 border-dashed"><div className="text-4xl">🐳</div><div><div className="font-bold text-white text-sm">Dockerizado</div><p className="text-slate-400 text-xs">Entorno aislado para despliegues seguros.</p></div></Card>
        </div>
      </div>
    </div>
  );
}

function SlideImpacto() {
  return (
    <div className="w-full max-w-3xl mx-auto px-4 flex flex-col gap-6">
      <div><Eyebrow>Propuesta de Valor</Eyebrow><SectionTitle>El Código al Servicio del Arte y<br />de la <span className="text-orange-500">Industria</span></SectionTitle></div>
      <Card className="border-l-2 border-l-orange-500 relative overflow-hidden">
        <div className="pointer-events-none absolute top-0 right-0 text-[120px] opacity-[.03] leading-none select-none">🎬</div>
        <p className="text-slate-200 text-lg font-light italic leading-relaxed mb-4">Identifiqué que la plataforma podría ser útil para reunir a los prestadores entre sí y generar una comunidad cohesionada para la industria audiovisual fueguina.</p>
        <div className="flex flex-wrap gap-2 mt-4"><Tag color="orange">Industria Cultural</Tag><Tag color="blue">Políticas Públicas</Tag><Tag color="purple">Consolidación</Tag></div>
      </Card>
    </div>
  );
}

function SlideSolucion() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6 items-center text-center">
      <div><Eyebrow>La Plataforma</Eyebrow><SectionTitle>Film Commission <span className="text-orange-500">TDF</span></SectionTitle><Sub center>Una plataforma web integral para centralizar, gestionar y promover la industria audiovisual fueguina.</Sub></div>
      <div className="grid grid-cols-3 gap-4 w-full">
        {[{ num: "6", label: "Módulos", color: "text-orange-500" }, { num: "3", label: "Tipos de usuario", color: "text-[#4f9cf9]" }, { num: "3", label: "Bases de datos principales", color: "text-[#10b981]" }].map((s) => (
          <div key={s.num} className={`${C.card} p-5 flex flex-col items-center gap-1.5`}><div className={`text-4xl font-extrabold ${s.color}`}>{s.num}</div><div className="text-xs text-slate-400">{s.label}</div></div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4 w-full">
        {[{ icon: "📋", color: "gold" as const, title: "Directorio Público", desc: "Perfiles filtrados por ciudad y rubro" }, { icon: "📍", color: "blue" as const, title: "Catálogo de Locaciones", desc: "Escenarios georreferenciados con fotos" }, { icon: "🎞️", color: "purple" as const, title: "Cartelera de Proyectos", desc: "Producciones activas con roles vacantes" }].map((c) => (
          <Card key={c.title} className="flex flex-col gap-3 text-left"><IconBox icon={c.icon} color={c.color} /><div className="font-bold text-white text-sm">{c.title}</div><p className="text-slate-400 text-xs">{c.desc}</p></Card>
        ))}
      </div>
    </div>
  );
}

function SlideInternacionalizacion() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div><Eyebrow>Atracción de Inversiones</Eyebrow><SectionTitle>Plataforma <span className="text-[#4f9cf9]">Internacional</span></SectionTitle><Sub>El fin del mundo es un destino soñado para productoras extranjeras. La barrera no debe ser el idioma.</Sub></div>
      <Card accent="blue" className="flex flex-col items-center text-center gap-4 py-8">
        <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center animate-pulse">
          <Globe className="text-[#4f9cf9]" size={40} />
        </div>
        <div className="font-bold text-white text-xl">Traducción Nativa EN/ES</div>
        <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
          La plataforma integra un sistema de traducción que permite a productores extranjeros acceder a toda la base de profesionales, locaciones y servicios locales en inglés, facilitando y atrayendo la inversión externa directa en la provincia.
        </p>
        <div className="flex gap-4 mt-2">
          <Tag color="blue">Productores Extranjeros</Tag>
          <Tag color="orange">Atracción de Capital</Tag>
        </div>
      </Card>
    </div>
  );
}

function SlideUsuarios() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div><Eyebrow>Ecosistema</Eyebrow><SectionTitle>Tipos de <span className="text-[#4f9cf9]">Usuario</span></SectionTitle></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[{ icon: "🛡", accent: "orange" as const, title: "Administrador", desc: "Control total del sistema. Modera contenido y accede al dashboard con analítica avanzada.", tags: ["Dashboard", "ABM Total"] }, { icon: "👤", accent: "blue" as const, title: "Prestador", desc: "Profesionales y estudiantes que ofrecen servicios. Se postulan a proyectos.", tags: ["Múltiples perfiles", "Directorio"] }, { icon: "🎬", accent: "purple" as const, title: "Contratante", desc: "Productoras que buscan talento o locaciones. Publican proyectos y gestionan candidatos.", tags: ["Proyectos", "Scouting"] }].map((u) => (
          <Card key={u.title} accent={u.accent} className="flex flex-col gap-4 items-center text-center">
            <div className="text-4xl mt-1">{u.icon}</div>
            <div className="font-bold text-white">{u.title}</div>
            <p className="text-slate-400 text-xs leading-relaxed flex-1">{u.desc}</p>
            <div className="flex flex-wrap gap-2 justify-center">{u.tags.map((t) => (<Tag key={t} color={u.accent === "orange" ? "orange" : u.accent === "blue" ? "blue" : "purple"}>{t}</Tag>))}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SlidePerfiles() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div><Eyebrow>Módulo 1 — Perfiles</Eyebrow><SectionTitle>Estructura de <span className="text-orange-500">Perfiles</span></SectionTitle><Sub>Un mismo usuario Prestador puede generar hasta <strong className="text-white">4 perfiles</strong> simultáneos.</Sub></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[{ num: "1", icon: "🎭", color: C.goldNum, title: "Profesional", desc: "Director, DP, sonidista, técnicos especializados." }, { num: "2", icon: "🎬", color: C.blueNum, title: "Productora", desc: "Empresa de producción local o nacional." }, { num: "3", icon: "🔧", color: C.purpleNum, title: "Empresa Afín", desc: "Equipamiento, transporte, catering, arte, etc." }, { num: "4", icon: "🎓", color: C.greenNum, title: "Estudiante", desc: "Futuros realizadores buscando visibilidad." }].map((p) => (
          <div key={p.title} className={`${C.card} p-5 flex flex-col gap-3 items-center text-center relative overflow-hidden transition-all hover:-translate-y-1 hover:border-orange-500/30`}><div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-extrabold text-lg ${p.color}`}>{p.num}</div><div className="text-2xl">{p.icon}</div><div className="font-bold text-white text-sm">{p.title}</div><p className="text-slate-400 text-xs leading-relaxed">{p.desc}</p></div>
        ))}
      </div>
    </div>
  );
}

function SlideJourneyPrestador() {
  const steps = [
    { num: 1, icon: "🔑", title: "Registrarse", desc: "Email + contraseña o Google OAuth.", tags: ["Sin costo", "Formulario en Pasos"], color: "gold" as const },
    { num: 2, icon: "✏️", title: "Completá tu perfil", desc: "Cargá especialidad, descripción, zona de trabajo y contacto.", tags: ["IA para biografía", "Autoguardado"], color: "blue" as const },
    { num: 3, icon: "👁", title: "Aparecés en el directorio", desc: "Visible en la Guía pública para contratantes.", tags: ["Directorio público"], color: "purple" as const },
    { num: 4, icon: "📢", title: "Conectate con proyectos", desc: "Explorá y postulate a producciones activas.", tags: ["Roles disponibles"], color: "gold" as const },
  ];
  return (
    <div className="w-full max-w-3xl mx-auto px-4 flex flex-col gap-6">
      <div><Eyebrow>User Journey</Eyebrow><SectionTitle>Camino del <span className="text-[#4f9cf9]">Prestador</span></SectionTitle></div>
      <div className="flex flex-col gap-0 relative">{steps.map((s, i) => (<JourneyCard key={s.num} {...s} last={i === steps.length - 1} />))}</div>
    </div>
  );
}

function SlideJourneyContratante() {
  const steps = [
    { num: 1, icon: "🌐", title: "Registrarse", desc: "Acceso al directorio y locaciones.", tags: ["OAuth Google"], color: "gold" as const },
    { num: 2, icon: "🔍", title: "Buscar talento", desc: "Filtra el directorio por rubro y ciudad.", tags: ["Shake to Shuffle"], color: "blue" as const },
    { num: 3, icon: "📍", title: "Explorar locaciones", desc: "Navega locaciones georreferenciadas con fotos.", tags: ["Mapa interactivo"], color: "purple" as const },
    { num: 4, icon: "📋", title: "Publicar proyectos", desc: "Creá proyecto, definí roles y recibí postulaciones.", tags: ["IA para sugerir roles"], color: "gold" as const },
  ];
  return (
    <div className="w-full max-w-3xl mx-auto px-4 flex flex-col gap-6">
      <div><Eyebrow>User Journey</Eyebrow><SectionTitle>Camino del <span className="text-orange-500">Contratante</span></SectionTitle></div>
      <div className="flex flex-col gap-0 relative">{steps.map((s, i) => (<JourneyCard key={s.num} {...s} last={i === steps.length - 1} />))}</div>
    </div>
  );
}

function SlideOnboarding() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div><Eyebrow>Diseño como Estrategia</Eyebrow><SectionTitle>Retención &amp; <span className="text-orange-500">Onboarding</span></SectionTitle><Sub>El éxito del sistema depende del tiempo que los usuarios pasan en él. El diseño guía desde el primer clic.</Sub></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="flex flex-col justify-center border-l-2 border-l-orange-500 py-8">
          <div className="flex items-center gap-3 mb-4"><Rocket className="text-orange-500" size={32} /><span className="font-bold text-white text-xl">Tour de Bienvenida</span></div>
          <p className="text-slate-400 text-sm mb-4 leading-relaxed">
            Un sistema de onboarding inteligente que detecta si sos un invitado o un usuario registrado, guiándote interactivamente por las secciones clave (Directorio, Locaciones, Proyectos) reduciendo drásticamente la sensación de sentirse abrumado.
          </p>
        </Card>
        <Card accent="blue" className="flex flex-col justify-center py-8">
          <div className="flex items-center gap-3 mb-4"><Target className="text-[#4f9cf9]" size={32} /><span className="font-bold text-white text-xl">Experiencia sin Fricción</span></div>
          <p className="text-slate-400 text-sm mb-4 leading-relaxed">
            Navegación fluida, transiciones de estado limpias y una jerarquía visual que respeta y expone el portfolio de los profesionales. Se habilitó el guardado de borradores automático para que nadie pierda su progreso.
          </p>
        </Card>
      </div>
    </div>
  );
}

function SlideGamificacion() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div><Eyebrow>Participación Activa</Eyebrow><SectionTitle>Comunidad <span className="text-[#10b981]">Gamificada</span></SectionTitle><Sub>Recompensamos a los profesionales que mantienen la plataforma viva y completa.</Sub></div>
      <Card accent="green" className="p-8">
        <div className="flex justify-between items-end mb-3">
          <div><div className="text-white font-bold text-lg">Salud de tu perfil</div><div className="text-slate-400 text-sm">Completaste todos los pasos necesarios.</div></div>
          <div className="text-4xl font-black text-[#10b981]">100%</div>
        </div>
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden mb-6"><div className="h-full bg-[#10b981] w-full" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {["Cuenta Creada", "Datos Profesionales", "Foto / Logo Subida", "Reel Enlazado"].map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-slate-300"><div className="w-5 h-5 rounded-full bg-[#10b981]/20 border border-[#10b981] flex items-center justify-center text-[#10b981] text-xs">✓</div>{step}</div>
          ))}
        </div>
      </Card>
      <div className="flex items-start gap-4 mt-2 px-2">
        <div className="text-3xl">🎁</div>
        <div>
          <div className="font-bold text-white mb-1">Recompensas y Easter Eggs</div>
          <p className="text-slate-400 text-sm leading-relaxed">Al llegar al 100%, los usuarios desbloquean fondos animados interactivos y un menú oculto presionando <strong className="text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded">Shift</strong>, incentivándolos a participar de forma lúdica.</p>
        </div>
      </div>
    </div>
  );
}

function SlideDescubrimientoIA() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div><Eyebrow>IA & Algoritmos</Eyebrow><SectionTitle>Cero Fricción &amp; <span className="text-[#7c3aed]">Descubrimiento</span></SectionTitle><Sub>Democratizando la visibilidad del talento fueguino.</Sub></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card accent="purple" className="flex flex-col gap-4">
          <div className="flex items-center gap-3"><Dices className="text-[#7c3aed]" size={32} /><div className="font-bold text-white text-lg">Descubrimiento Interactivo</div></div>
          <p className="text-slate-400 text-sm leading-relaxed">Los directorios clásicos esconden a los perfiles más antiguos. Se implementó un botón en forma de 'Dado' (y el uso del movimiento del celular) para reorganizar aleatoriamente los listados, garantizando rotación y visibilidad equitativa.</p>
        </Card>
        <Card className="flex flex-col gap-4 relative overflow-hidden">
          <div className="absolute top-4 right-4 opacity-10"><Sparkles size={80}/></div>
          <div className="flex items-center gap-3"><Sparkles className="text-orange-400" size={32} /><div className="font-bold text-white text-lg">Asistencia de IA (Cero Fricción)</div></div>
          <p className="text-slate-400 text-sm leading-relaxed z-10">La gente abandona los formularios largos. El sistema asiste con Inteligencia Artificial para ayudar a crear descripciones atractivas para el perfil y sugerir automáticamente los puestos a cubrir al crear una nueva producción.</p>
        </Card>
      </div>
    </div>
  );
}

function SlideModulos() {
  const mods = [
    { icon: "🔐", color: "gold" as const, title: "Autenticación", desc: "Login, OAuth Google, JWT · Control RBAC" },
    { icon: "👥", color: "blue" as const, title: "Directorio", desc: "CRUD de perfiles, búsqueda en tiempo real" },
    { icon: "📋", color: "purple" as const, title: "Cartelera", desc: "Publicar proyectos y gestionar postulaciones" },
    { icon: "📍", color: "green" as const, title: "Catálogo", desc: "Fichas con fotos con profundidad 3D" },
    { icon: "📊", color: "blue" as const, title: "Dashboard", desc: "Métricas Recharts y ABM de usuarios" },
    { icon: "🔔", color: "gold" as const, title: "Notificaciones", desc: "Alertas en tiempo real y Matchmaking" },
  ];
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div><Eyebrow>Arquitectura Funcional</Eyebrow><SectionTitle>Los 6 <span className="text-orange-500">Módulos</span></SectionTitle></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {mods.map((m) => (
          <div key={m.title} className={`${C.card} p-5 flex flex-col gap-3 transition-all hover:-translate-y-1`}>
            <IconBox icon={m.icon} color={m.color} />
            <div><h3 className="font-bold text-white text-sm mb-1">{m.title}</h3><p className="text-slate-400 text-xs leading-relaxed">{m.desc}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideMapaNodal() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div><Eyebrow>Innovación Técnica</Eyebrow><SectionTitle>Mapa Galaxia <span className="text-[#4f9cf9]">Nodal 3D</span></SectionTitle><Sub>El motor psicológico: los usuarios quieren completar su perfil para verse brillando como un planeta en la red de la provincia.</Sub></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="flex flex-col gap-3">
          {[{ icon: "⬡", color: "gold" as const, title: "Shaders WebGL", desc: "Renderizado 3D sin plugins." }, { icon: "🌀", color: "blue" as const, title: "Físicas de grafos", desc: "Conexiones con peso real del ecosistema." }, { icon: "🔗", color: "purple" as const, title: "Nodos Interactivos", desc: "Prestadores, Proyectos y Locaciones." }].map((f) => (
            <div key={f.title} className={`${C.card} px-4 py-3 flex gap-3 items-start`}><IconBox icon={f.icon} color={f.color} /><div><div className="font-bold text-white text-xs mb-0.5">{f.title}</div><p className="text-slate-400 text-xs">{f.desc}</p></div></div>
          ))}
        </div>
        <div className={`${C.card} p-8 relative overflow-hidden flex flex-col gap-4 items-center justify-center`}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(79,156,249,.06),transparent_70%)]" />
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
            <line x1="200" y1="100" x2="80" y2="35" stroke="rgba(79,156,249,.5)" strokeWidth="2" />
            <line x1="200" y1="100" x2="320" y2="35" stroke="rgba(124,58,237,.5)" strokeWidth="2" />
            <line x1="200" y1="100" x2="150" y2="160" stroke="rgba(16,185,129,.5)" strokeWidth="2" />
          </svg>
          <div className="absolute w-16 h-16 rounded-full bg-orange-500/20 border-2 border-orange-500/50 flex items-center justify-center text-2xl animate-pulse z-10">⬡</div>
          <div className="flex gap-2 relative z-20 mt-32"><Tag color="blue">Three.js</Tag><Tag color="purple">WebGL</Tag></div>
        </div>
      </div>
    </div>
  );
}

function SlideSeguridad() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div><Eyebrow>Módulo 1 — Seguridad</Eyebrow><SectionTitle>Privacidad <span className="text-orange-500">por Diseño</span></SectionTitle></div>
      <Card className="border-l-2 border-l-[#4f9cf9] flex gap-5 items-start">
        <span className="text-5xl mt-1">🛡</span>
        <div className="flex flex-col gap-2">
          <div className="font-bold text-white">Protección de Datos Personales</div>
          <p className="text-slate-400 text-sm leading-relaxed">En el Directorio, teléfonos y correos están ocultos. Si un productor se interesa en un talento, envía una Solicitud. El prestador recibe una alerta y decide si aprueba o rechaza revelar sus datos.</p>
        </div>
      </Card>
      <div className="grid grid-cols-3 gap-4">
        {[{ label: "JWT", color: "orange" as const, desc: "Tokens seguros para autenticar sesiones." }, { label: "BCRYPT", color: "blue" as const, desc: "Cifrado de contraseñas. Nunca en texto plano." }, { label: "RBAC GUARDS", color: "purple" as const, desc: "NestJS Guards diferencian permisos estrictamente." }].map((s) => (
          <Card key={s.label} className="flex flex-col gap-2"><Tag color={s.color}>{s.label}</Tag><p className="text-slate-400 text-xs leading-relaxed">{s.desc}</p></Card>
        ))}
      </div>
    </div>
  );
}

function SlideLocaciones() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div><Eyebrow>Módulo 3 — Locaciones</Eyebrow><SectionTitle>Scouting <span className="text-[#4f9cf9]">Digital</span></SectionTitle></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="flex flex-col gap-4">
          {[{ icon: "📷", color: "gold" as const, title: "Fichas Técnicas", desc: "Galerías fotográficas con profundidad 3D." }, { icon: "🗺️", color: "blue" as const, title: "Geolocalización", desc: "Coordenadas con mapa interactivo Leaflet." }, { icon: "🏙️", color: "purple" as const, title: "Tres ciudades", desc: "Ushuaia · Tolhuin · Río Grande" }].map((f) => (
            <Card key={f.title} className="flex gap-3 items-center py-4"><IconBox icon={f.icon} color={f.color} /><div><div className="font-bold text-white text-sm">{f.title}</div><p className="text-slate-400 text-xs">{f.desc}</p></div></Card>
          ))}
        </div>
        <Card className="flex items-center justify-center p-8 bg-[#111827]/60">
           <div className="text-center">
             <div className="text-6xl mb-4">🌲⚓🏛️</div>
             <p className="text-slate-400 text-sm">8 Categorías de clasificación visual para facilitar la planificación de rodajes.</p>
           </div>
        </Card>
      </div>
    </div>
  );
}

function SlideDashboard() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div><Eyebrow>Módulo 5 — Admin</Eyebrow><SectionTitle>Panel <span className="text-orange-500">Master Admin</span></SectionTitle></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="flex flex-col gap-4">
          {[{ icon: "📊", accent: "orange" as const, title: "Métricas Dinámicas", desc: "Gráficos en vivo con Recharts." }, { icon: "🎛️", accent: "blue" as const, title: "Control ABM Total", desc: "Moderación de contenido integral." }, { icon: "🌐", accent: "purple" as const, title: "Visualizador 3D", desc: "Vista panorámica del ecosistema." }].map((f) => (
            <Card key={f.title} accent={f.accent} className="flex gap-3 items-center py-4"><IconBox icon={f.icon} color={f.accent === "orange" ? "gold" : f.accent as "blue"|"purple"} /><div><div className="font-bold text-white text-sm">{f.title}</div><p className="text-slate-400 text-xs">{f.desc}</p></div></Card>
          ))}
        </div>
        <Card className="flex flex-col gap-5 items-center text-center justify-center">
          <span className="text-6xl mt-2">🛡</span>
          <div className="font-bold text-white">Acceso Exclusivo</div>
          <p className="text-slate-400 text-sm">Protegido por Guards RBAC de NestJS.</p>
          <div className="flex flex-wrap gap-2 justify-center"><Tag color="orange">Recharts</Tag><Tag color="blue">JWT Guard</Tag></div>
        </Card>
      </div>
    </div>
  );
}

function SlideNotificaciones() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div><Eyebrow>Módulo 6 — Comunicación</Eyebrow><SectionTitle>Matchmaking &amp; <span className="text-[#f59e0b]">Alertas</span></SectionTitle><Sub>El sistema cruza datos y mantiene informados a todos en tiempo real.</Sub></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="flex flex-col gap-4">
          <Card accent="orange" className="flex flex-col gap-2">
            <div className="flex items-center gap-3"><span className="text-2xl">⚡</span><div className="font-bold text-white text-lg">Matchmaking Automático</div></div>
            <p className="text-xs text-slate-400 leading-relaxed">Al publicar un proyecto, el backend cruza la ciudad y roles, disparando alertas directas a los talentos: <strong className="text-orange-400">"¡Nuevo proyecto en tu área y rubro!"</strong>.</p>
          </Card>
          <Card className="flex gap-3 items-start"><IconBox icon="📧" color="blue" /><div><div className="font-bold text-white text-sm mb-1">Mailing y Trazabilidad</div><p className="text-xs text-slate-400 leading-relaxed">Correos vía Nodemailer y badges UI de estado ("Vista", "En consideración").</p></div></Card>
        </div>
        <div className="flex flex-col gap-3">
          {[{ icon: "📢", title: "Postulación Directa", desc: "El productor recibe notificación con link al perfil." }, { icon: "🤝", title: "Solicitud de Contacto", desc: "Alerta para aprobar o rechazar compartir datos privados." }, { icon: "✅", title: "Candidatura", desc: "El prestador sabe cuándo fue aceptado o rechazado." }].map((f) => (
            <div key={f.title} className={`${C.card} rounded-xl p-4 border-l-2 border-orange-500 bg-orange-500/[.03] text-sm transition-all hover:bg-orange-500/[.06] hover:translate-x-1`}><span className="block text-slate-200 font-bold mb-1 text-xs">{f.icon} {f.title}</span><span className="text-slate-400 text-xs leading-relaxed">{f.desc}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SlideResumen() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6 items-center text-center">
      <div><Eyebrow>Resumen</Eyebrow><SectionTitle>Una plataforma <span className="text-[#4f9cf9]">completa</span></SectionTitle></div>
      <div className="grid grid-cols-3 gap-4 w-full">
        {[{ num: "6", label: "Módulos funcionales", color: "text-orange-500" }, { num: "3", label: "Tipos de usuario", color: "text-[#4f9cf9]" }, { num: "4", label: "Perfiles simultáneos", color: "text-[#10b981]" }].map((s) => (
          <div key={s.num} className={`${C.card} p-6 flex flex-col items-center gap-2`}><div className={`text-5xl font-extrabold ${s.color}`}>{s.num}</div><div className="text-xs text-slate-400">{s.label}</div></div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-3 w-full mt-4">
        {[{ icon: "⚛️", label: "Next.js 14", sub: "Frontend", color: "text-[#4f9cf9]" }, { icon: "⚙️", label: "NestJS", sub: "Backend API", color: "text-orange-500" }, { icon: "🗄️", label: "PostgreSQL", sub: "+ Prisma ORM", color: "text-[#f59e0b]" }, { icon: "🐳", label: "Docker", sub: "Containerized", color: "text-[#7c3aed]" }].map((s) => (
          <div key={s.label} className={`${C.card} p-5 flex flex-col items-center gap-2`}><span className="text-3xl">{s.icon}</span><div className={`text-sm font-bold ${s.color}`}>{s.label}</div><div className="text-xs text-slate-500">{s.sub}</div></div>
        ))}
      </div>
    </div>
  );
}

function SlideDemo() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 h-full gap-6">
      <div><Eyebrow>Demo</Eyebrow><SectionTitle>Plataforma <span className="text-[#4f9cf9]">en Vivo</span></SectionTitle></div>
      <div className="bg-white p-3 rounded-2xl shadow-[0_0_40px_rgba(79,156,249,.2)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://lab2026.vercel.app/info&color=060810&bgcolor=ffffff" alt="QR" className="w-36 h-36 rounded-lg block" />
      </div>
      <div className="font-mono text-slate-400 text-lg">lab2026.<span className="text-[#4f9cf9]">vercel.app</span></div>
      <div className={`${C.card} px-8 py-4 flex gap-6 items-center`}>
        {[{ label: "Frontend", sub: "Vercel", color: "text-orange-500" }, { label: "Backend", sub: "Render", color: "text-[#4f9cf9]" }, { label: "Database", sub: "Supabase", color: "text-[#10b981]" }].map((s, i) => (
          <div key={s.label} className="flex items-center gap-6">{i > 0 && <div className="w-px h-8 bg-white/10" />}<div className="flex flex-col items-center gap-0.5"><div className={`text-xs font-bold tracking-widest uppercase ${s.color}`}>{s.label}</div><div className="text-sm text-slate-400">{s.sub}</div></div></div>
        ))}
      </div>
    </div>
  );
}

function SlideCierre() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 h-full gap-6">
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(234,88,12,.07),transparent_70%)]" />
      <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight relative">¡Muchas <span className="text-orange-500">Gracias</span>!</h1>
      <div className="w-12 h-0.5 bg-orange-500/60 rounded" />
      <p className="text-slate-400 max-w-md">Film Commission TDF — conectando la industria audiovisual del Fin del Mundo.</p>
    </div>
  );
}

// Map slide id → component
const SLIDE_COMPONENTS: Record<SlideId, React.FC> = {
  portada:              SlidePortada,
  "que-es":             SlideQueEs,
  contexto:             SlideContexto,
  problema:             SlideProblema,
  enfoque:              SlideEnfoque,
  stack:                SlideStack,
  impacto:              SlideImpacto,
  solucion:             SlideSolucion,
  internacionalizacion: SlideInternacionalizacion,
  usuarios:             SlideUsuarios,
  perfiles:             SlidePerfiles,
  "journey-prestador":  SlideJourneyPrestador,
  "journey-contratante":SlideJourneyContratante,
  onboarding:           SlideOnboarding,
  gamificacion:         SlideGamificacion,
  "descubrimiento-ia":  SlideDescubrimientoIA,
  modulos:              SlideModulos,
  "mapa-nodal":         SlideMapaNodal,
  seguridad:            SlideSeguridad,
  locaciones:           SlideLocaciones,
  dashboard:            SlideDashboard,
  notificaciones:       SlideNotificaciones,
  resumen:              SlideResumen,
  demo:                 SlideDemo,
  cierre:               SlideCierre,
};

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG PANEL (topology controls)
// ─────────────────────────────────────────────────────────────────────────────
function DebugPanel({ params, setParams, onClose }: { params: typeof DEFAULT_TOPOLOGY; setParams: React.Dispatch<React.SetStateAction<typeof DEFAULT_TOPOLOGY>>; onClose: () => void; }) {
  return (
    <div className="fixed left-24 top-1/2 -translate-y-1/2 w-72 rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-2xl overflow-hidden z-[61]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-gradient-to-r from-slate-900/90 to-transparent">
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">TopologyBackground</span>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"><X size={18} /></button>
      </div>
      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        <div>
          <span className="text-xs font-bold text-slate-400 block mb-2">Color base gradiente</span>
          <div className="flex items-center gap-3">
            <input type="color" value={params.gradientBaseColor ?? "#3b82f6"} onChange={(e) => setParams((p) => ({ ...p, gradientBaseColor: e.target.value }))} className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent" />
            <span className="text-xs font-mono text-slate-500">{params.gradientBaseColor ?? "Por defecto"}</span>
            {params.gradientBaseColor != null && (<button type="button" onClick={() => setParams((p) => ({ ...p, gradientBaseColor: null }))} className="text-xs text-slate-500 hover:text-white">Quitar</button>)}
          </div>
        </div>
        {[{ key: "LINES", label: "Líneas", min: 4, max: 40, step: 1 }, { key: "STEPS", label: "Pasos", min: 40, max: 280, step: 10 }, { key: "BASE_SPEED", label: "Velocidad", min: 0.2, max: 2, step: 0.05 }, { key: "WAVE_AMP", label: "Amplitud onda", min: 5, max: 80, step: 1 }, { key: "MOUSE_RADIUS", label: "Radio mouse", min: 40, max: 320, step: 10 }, { key: "MOUSE_FORCE", label: "Fuerza mouse", min: 10, max: 80, step: 2 }].map(({ key, label, min, max, step }) => (
          <div key={key}>
            <label className="flex justify-between items-center gap-2 mb-1"><span className="text-xs font-bold text-slate-400">{label}</span><span className="text-xs font-mono text-orange-400">{typeof params[key as keyof typeof params] === "number" ? params[key as keyof typeof params] : ""}</span></label>
            <input type="range" min={min} max={max} step={step} value={(params[key as keyof typeof params] as number) ?? min} onChange={(e) => setParams((p) => ({ ...p, [key]: step >= 1 ? parseInt(e.target.value, 10) : parseFloat(e.target.value) }))} className="w-full h-2 rounded-full bg-slate-800 accent-orange-500" />
          </div>
        ))}
        <button type="button" onClick={() => setParams(DEFAULT_TOPOLOGY)} className="w-full py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white border border-white/10 hover:border-orange-500/30 transition-colors">Restaurar valores</button>
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

  const touchX = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    const diff = touchX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) diff > 0 ? next() : prev();
  };

  const onDeckClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("[data-no-nav]")) return;
    if (e.clientX > window.innerWidth / 2) next(); else prev();
  };

  const topoProps = {
    ...topoParams,
    gradientColors: topoParams.gradientBaseColor != null ? gradientColorsFromBase(topoParams.gradientBaseColor) : undefined,
  };

  const progress = ((current + 1) / total) * 100;
  const SlideContent = SLIDE_COMPONENTS[SLIDES[current].id];

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <main className="bg-[#060810] text-slate-200 w-screen h-screen overflow-hidden relative select-none">
      <TopologyBackground {...(topoProps as Record<string, unknown>)} />
      
      <div className="fixed top-0 left-0 h-0.5 bg-gradient-to-r from-orange-500 to-[#f59e0b] z-50 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
            
      <div className="fixed top-5 right-6 z-40 text-xs font-bold text-slate-500 tracking-widest opacity-70 pointer-events-none">
        {String(current + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>

      {showDebugBtn && (
        <div className="hidden md:block fixed left-6 top-[38%] -translate-y-1/2 z-[60]">
          <button type="button" data-no-nav onClick={() => setDebugOpen((o) => !o)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950/90 backdrop-blur-xl border border-white/10 text-slate-300 hover:text-white hover:border-orange-500/40 hover:shadow-[0_0_20px_rgba(249,115,22,0.15)] transition-all font-bold text-sm">
            <Settings2 size={18} /> Debug
          </button>
          {debugOpen && <DebugPanel params={topoParams} setParams={setTopoParams} onClose={() => setDebugOpen(false)} />}
        </div>
      )}

      <div className="relative z-10 w-full h-full flex items-center justify-center cursor-pointer" onClick={onDeckClick} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div key={current} className="w-full h-full flex items-center justify-center overflow-y-auto py-16" style={{ animation: animating ? `${direction === "forward" ? "slideIn" : "slideInBack"} 0.5s cubic-bezier(0.22,1,0.36,1) both` : "none" }}>
          <SlideContent />
        </div>
      </div>

      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-2.5 rounded-full bg-slate-950/85 backdrop-blur-xl border border-white/10 shadow-xl" data-no-nav onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={prev} disabled={current === 0} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={18} /></button>
        <div className="flex items-center gap-1.5">
          {SLIDES.map((_, i) => {
            const dist = Math.abs(i - current);
            if (dist > 4) return null;
            return (
              <button key={i} type="button" onClick={() => goTo(i, i > current ? "forward" : "back")} className={`rounded-full transition-all duration-300 ${i === current ? "w-5 h-2 bg-orange-500" : dist <= 1 ? "w-2 h-2 bg-slate-600 hover:bg-slate-400" : "w-1.5 h-1.5 bg-slate-700 hover:bg-slate-500"}`} title={SLIDES[i].label} />
            );
          })}
        </div>
        <button type="button" onClick={next} disabled={current === total - 1} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight size={18} /></button>
        <span className="ml-1 text-[10px] font-bold text-slate-500 tracking-widest uppercase hidden sm:block min-w-[120px] text-center">{SLIDES[current].label}</span>
      </div>

      <div className="fixed bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-slate-700 tracking-widest z-30 pointer-events-none">
        ← → · Espacio · Click · Shift = Debug
      </div>

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(40px) scale(0.98); } to { opacity: 1; transform: none; } }
        @keyframes slideInBack { from { opacity: 0; transform: translateX(-40px) scale(0.98); } to { opacity: 1; transform: none; } }
        @keyframes fade-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-up { animation: fade-up 0.65s ease both; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>
    </main>
  );
}