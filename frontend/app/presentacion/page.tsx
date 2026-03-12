"use client";

/**
 * FILM COMMISSION TDF — Presentación Interactiva
 * ─────────────────────────────────────────────────
 * Frontend: app/presentacion/page.tsx
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Settings2, ChevronLeft, ChevronRight, Sparkles, Target, Zap, LayoutTemplate } from "lucide-react";
import TopologyBackground from "./TopologyBackground";

// ─────────────────────────────────────────────────────────────────────────────
// TOPOLOGY DEBUG (Mantenido intacto)
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
// SLIDE DATA ACTUALIZADO
// ─────────────────────────────────────────────────────────────────────────────
type SlideId =
  | "portada" | "problema" | "paradigma" 
  | "ia-friccion" | "gamificacion" | "mapa-nodal" 
  | "stack" | "diseno" | "demo" | "cierre";

interface Slide { id: SlideId; label: string; }

const SLIDES: Slide[] = [
  { id: "portada",       label: "Portada"             },
  { id: "problema",      label: "El Problema"         },
  { id: "paradigma",     label: "Ecosistema Vivo"     },
  { id: "ia-friccion",   label: "Cero Fricción (IA)"  },
  { id: "gamificacion",  label: "Gamificación"        },
  { id: "stack",         label: "JS Everywhere"       },
  { id: "diseno",        label: "Diseño & 3D"         },
  { id: "mapa-nodal",    label: "Mapa Nodal"          },
  { id: "demo",          label: "Demo Interactiva"    },
  { id: "cierre",        label: "Cierre"              },
];

const C = {
  orange:    "text-orange-500",
  orangeBg:  "bg-orange-500",
  card:      "bg-[#111827]/80 backdrop-blur-md border border-white/[.07] rounded-2xl",
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES REUTILIZABLES
// ─────────────────────────────────────────────────────────────────────────────
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="text-orange-500 text-xs font-bold tracking-[.15em] uppercase">{children}</span>;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">{children}</h2>;
}
function Sub({ children, center = false }: { children: React.ReactNode; center?: boolean }) {
  return <p className={`mt-4 text-slate-400 max-w-xl text-base leading-relaxed ${center ? "mx-auto text-center" : ""}`}>{children}</p>;
}
function Card({ children, className = "", accent }: { children: React.ReactNode; className?: string; accent?: "orange" | "blue" | "purple" }) {
  const borders = { orange: "border-t-2 border-t-orange-500", blue: "border-t-2 border-t-[#4f9cf9]", purple: "border-t-2 border-t-[#7c3aed]" };
  return <div className={`${C.card} p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-2xl ${accent ? borders[accent] : ""} ${className}`}>{children}</div>;
}
function Tag({ children, color = "default" }: { children: React.ReactNode; color?: "default" | "orange" | "blue" | "purple" | "green" }) {
  const styles = {
    default: "bg-white/5 border border-white/[.07] text-slate-400",
    orange:  "bg-orange-500/10 border border-orange-500/30 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.2)]",
    blue:    "bg-[#4f9cf9]/10 border border-[#4f9cf9]/30 text-[#4f9cf9]",
    purple:  "bg-[#7c3aed]/10 border border-[#7c3aed]/30 text-[#7c3aed]",
    green:   "bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981]",
  };
  return <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${styles[color]}`}>{children}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// DIAPOSITIVAS
// ─────────────────────────────────────────────────────────────────────────────

function SlidePortada() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 h-full gap-6">
      <div className="flex items-center gap-1 opacity-60 mb-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className={`${i % 3 === 1 ? "w-6 h-4 border border-orange-500/60 rounded-sm" : "w-2 h-2 bg-orange-500/50 rounded-sm"}`} />
        ))}
      </div>
      <span className="inline-flex items-center px-4 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-500 text-xs font-semibold tracking-widest uppercase animate-fade-up">
        Trabajo Final · Analista de Sistemas
      </span>
      <h1 className="text-5xl sm:text-7xl font-extrabold leading-[1.05] tracking-tight animate-fade-up [animation-delay:100ms]">
        Film Commission
        <br /><span className="text-orange-500">TDF</span>
      </h1>
      <p className="text-slate-400 max-w-xl text-lg animate-fade-up [animation-delay:200ms]">
        Ecosistema digital y comunidad interactiva para la industria audiovisual de Tierra del Fuego.
      </p>
      <div className="w-12 h-0.5 bg-orange-500/60 rounded animate-fade-up [animation-delay:300ms]" />
      <div className="text-center animate-fade-up [animation-delay:400ms]">
        <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-orange-500 block mb-1">Alumno / Desarrollador</span>
        <span className="text-lg text-white font-medium">Ezequiel Rodríguez Ibarra</span>
      </div>
    </div>
  );
}

function SlideProblema() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div>
        <Eyebrow>El Problema</Eyebrow>
        <SectionTitle>Fragmentación y <span className="text-orange-500">Logística</span></SectionTitle>
        <Sub>Armar un equipo audiovisual en la provincia es un rompecabezas logístico dominado por la informalidad.</Sub>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="flex flex-col gap-4">
          <div className="text-4xl">🧩</div>
          <div className="font-bold text-white text-lg">Información Fragmentada</div>
          <p className="text-slate-400 text-sm leading-relaxed">No existe un registro centralizado. Todo se maneja por contactos informales, dificultando que las productoras encuentren locaciones, técnicos o empresas de servicios locales rápidamente.</p>
        </Card>
        <Card accent="orange" className="flex flex-col gap-4 relative overflow-hidden">
          <div className="text-4xl">👻</div>
          <div className="font-bold text-white text-lg">Invisibilidad del Talento</div>
          <p className="text-slate-400 text-sm leading-relaxed">La falta de visibilidad provoca que las producciones externas traigan sus propios equipos, dejando fuera al profesional fueguino de las oportunidades laborales grandes.</p>
        </Card>
      </div>
    </div>
  );
}

function SlideParadigma() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div>
        <Eyebrow>Cambio de Paradigma</Eyebrow>
        <SectionTitle>De Directorio a <span className="text-[#4f9cf9]">Comunidad Viva</span></SectionTitle>
        <Sub>El objetivo no era crear una tabla de base de datos aburrida, sino un ecosistema bidireccional donde todos son protagonistas.</Sub>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card className="flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 mb-2"><Target size={24} /></div>
          <div className="font-bold text-white">Múltiples Sombreros</div>
          <p className="text-slate-400 text-xs leading-relaxed">Un usuario puede postularse como Sonidista hoy, y crear un proyecto como Productor mañana.</p>
        </Card>
        <Card className="flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 mb-2"><LayoutTemplate size={24} /></div>
          <div className="font-bold text-white">Matchmaking Automático</div>
          <p className="text-slate-400 text-xs leading-relaxed">El backend cruza roles vacantes con perfiles locales y notifica instantáneamente a los candidatos ideales.</p>
        </Card>
        <Card className="flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 mb-2"><Zap size={24} /></div>
          <div className="font-bold text-white">Trazabilidad Total</div>
          <p className="text-slate-400 text-xs leading-relaxed">Insignias en tiempo real ("Vista", "En consideración", "Aceptada") que eliminan la incertidumbre de la industria.</p>
        </Card>
      </div>
    </div>
  );
}

function SlideIA() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div>
        <Eyebrow>Reducción de Fricción</Eyebrow>
        <SectionTitle>Asistencia con <span className="text-purple-500">Inteligencia Artificial</span></SectionTitle>
        <Sub>El mayor desafío humano del software es lograr que el usuario llene los datos. La IA asume el trabajo pesado para garantizar la adopción.</Sub>
      </div>
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 flex flex-col gap-4">
          <Card accent="purple" className="flex items-start gap-4">
            <Sparkles className="text-purple-400 flex-shrink-0" size={32} />
            <div>
              <div className="font-bold text-white mb-1">Generación de Biografías</div>
              <p className="text-slate-400 text-xs">Si el profesional no sabe cómo redactar su perfil de venta, la IA redacta una biografía atractiva basándose en sus roles y experiencia previa.</p>
            </div>
          </Card>
          <Card accent="blue" className="flex items-start gap-4">
            <Target className="text-blue-400 flex-shrink-0" size={32} />
            <div>
              <div className="font-bold text-white mb-1">Sugerencia de Roles</div>
              <p className="text-slate-400 text-xs">Al crear un proyecto nuevo, la plataforma analiza la sinopsis y sugiere automáticamente los puestos técnicos necesarios (ej: Foley, Gaffer, Foquista).</p>
            </div>
          </Card>
        </div>
        <Card className="flex-1 border border-purple-500/30 bg-purple-900/10 flex flex-col justify-center items-center p-8 relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.15),transparent)] pointer-events-none" />
          <button className="relative z-10 flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(124,58,237,0.4)] animate-pulse">
            <Sparkles size={18} /> Redactar con IA
          </button>
          <div className="mt-6 w-full h-20 bg-slate-900/50 rounded-lg border border-slate-700/50 p-3 text-xs text-slate-500 font-mono">
            Escribiendo perfil profesional...
            <span className="animate-ping ml-1">_</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SlideGamificacion() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div>
        <Eyebrow>Retención de Usuarios</Eyebrow>
        <SectionTitle>Salud del Perfil y <span className="text-[#10b981]">Gamificación</span></SectionTitle>
        <Sub>Incentivamos la calidad de la información recompensando a los usuarios más comprometidos con la comunidad.</Sub>
      </div>
      <Card className="p-8">
        <div className="flex justify-between items-end mb-3">
          <div>
            <div className="text-white font-bold text-lg">Tu perfil está al 100%</div>
            <div className="text-slate-400 text-sm">Completaste todos los pasos necesarios.</div>
          </div>
          <div className="text-4xl font-black text-[#10b981]">100%</div>
        </div>
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-gradient-to-r from-orange-500 via-[#4f9cf9] to-[#10b981] w-full" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {["Cuenta Creada", "Datos Profesionales", "Foto / Logo Subida", "Portfolio Enlazado"].map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
              <div className="w-5 h-5 rounded-full bg-[#10b981]/20 border border-[#10b981] flex items-center justify-center text-[#10b981] text-xs">✓</div>
              {step}
            </div>
          ))}
        </div>
      </Card>
      <div className="flex items-center gap-4 mt-2">
        <div className="text-3xl animate-bounce">🎁</div>
        <div>
          <div className="font-bold text-white">Recompensas Desbloqueadas (Easter Eggs)</div>
          <p className="text-slate-400 text-sm">Al llegar al 100%, se habilitan fondos interactivos ocultos en la plataforma. Usando la tecla <strong className="text-orange-500 bg-orange-500/10 px-1 rounded">Shift</strong> y el scroll, los usuarios pueden alterar las animaciones del entorno espacial.</p>
        </div>
      </div>
    </div>
  );
}

function SlideStack() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div>
        <Eyebrow>Decisión de Arquitectura</Eyebrow>
        <SectionTitle>El Ecosistema <span className="text-[#f59e0b]">JavaScript Everywhere</span></SectionTitle>
        <Sub>Unificar el código bajo TypeScript de extremo a extremo elimina fricciones y errores en producción.</Sub>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4 items-stretch">
        <Card accent="blue" className="flex-1 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="font-bold text-white text-lg">Next.js 14</span>
            <Tag color="blue">Frontend</Tag>
          </div>
          <p className="text-slate-400 text-xs">Interfaces rápidas con Server-Side Rendering (SSR), estados complejos y componentes interactivos para la mejor experiencia de usuario.</p>
        </Card>
        
        <div className="hidden md:flex flex-col justify-center items-center px-4">
          <div className="h-0.5 w-16 bg-gradient-to-r from-[#4f9cf9] via-[#f59e0b] to-orange-500" />
          <span className="text-[10px] font-bold text-white bg-slate-800 px-2 py-1 rounded-full absolute mt-8 border border-slate-600">TypeScript</span>
        </div>

        <Card accent="orange" className="flex-1 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="font-bold text-white text-lg">NestJS + Prisma</span>
            <Tag color="orange">Backend</Tag>
          </div>
          <p className="text-slate-400 text-xs">Arquitectura modular y robusta. Prisma ORM tipifica la base de datos PostgreSQL, garantizando que el matchmaking y las relaciones sean seguras.</p>
        </Card>
      </div>
      <Card className="bg-[#111827]/40 border-dashed border-white/20 flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🐳</span>
          <div>
            <div className="font-bold text-white text-sm">Dockerizado y Listo para Producción</div>
            <div className="text-slate-400 text-xs">Aislamiento total del entorno asegurando que el despliegue no falle.</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function SlideDiseno() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6 text-center items-center">
      <div>
        <Eyebrow>Estética y Vanguardia</Eyebrow>
        <SectionTitle>Diseño como <span className="text-[#4f9cf9]">Retención</span></SectionTitle>
        <Sub center>La funcionalidad no alcanza si la plataforma no atrapa al usuario. Una herramienta institucional debe estar a la altura visual de la industria audiovisual moderna.</Sub>
      </div>
      <div className="grid grid-cols-2 gap-6 w-full mt-4">
        <Card className="flex flex-col items-center gap-3 text-center group border border-[#4f9cf9]/20">
          <div className="text-5xl group-hover:scale-110 transition-transform">🌌</div>
          <div className="font-bold text-white">Three.js & WebGL</div>
          <p className="text-slate-400 text-xs">Fondos topográficos inmersivos renderizados por GPU en el navegador, sin plugins adicionales.</p>
        </Card>
        <Card className="flex flex-col items-center gap-3 text-center group border border-[#10b981]/20">
          <div className="text-5xl group-hover:scale-110 transition-transform">📸</div>
          <div className="font-bold text-white">Gaussian Splatting</div>
          <p className="text-slate-400 text-xs">Archivos de escaneo tridimensional (.spz) experimentales para una visualización revolucionaria.</p>
        </Card>
      </div>
    </div>
  );
}

function SlideMapaNodal() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-6">
      <div>
        <Eyebrow>La Pieza Central</Eyebrow>
        <SectionTitle>Mapa Neuronal <span className="text-orange-500">3D</span></SectionTitle>
        <Sub>El motor psicológico del ecosistema. Los usuarios quieren completar su perfil para verse brillando como nodos interconectados en la provincia.</Sub>
      </div>
      <div className={`${C.card} p-0 overflow-hidden relative h-64 border-orange-500/30 flex items-center justify-center`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(234,88,12,.15),transparent_70%)]" />
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
          <line x1="200" y1="100" x2="80"  y2="50"  stroke="rgba(79,156,249,.5)"  strokeWidth="2" />
          <line x1="200" y1="100" x2="320" y2="40"  stroke="rgba(124,58,237,.5)" strokeWidth="2" />
          <line x1="200" y1="100" x2="120" y2="160" stroke="rgba(16,185,129,.5)"  strokeWidth="2" />
          <line x1="200" y1="100" x2="300" y2="150" stroke="rgba(234,88,12,.5)"  strokeWidth="2" />
        </svg>
        <div className="absolute w-20 h-20 rounded-full bg-orange-500/20 border-2 border-orange-500 shadow-[0_0_30px_rgba(234,88,12,0.6)] flex items-center justify-center text-3xl z-10 animate-pulse">⬡</div>
        <div className="absolute top-[15%] left-[15%] w-12 h-12 rounded-full bg-[#4f9cf9]/20 border-2 border-[#4f9cf9] flex items-center justify-center text-xl">🎬</div>
        <div className="absolute top-[10%] right-[15%] w-12 h-12 rounded-full bg-[#7c3aed]/20 border-2 border-[#7c3aed] flex items-center justify-center text-xl">🎭</div>
        <div className="absolute bottom-[10%] left-[25%] w-12 h-12 rounded-full bg-[#10b981]/20 border-2 border-[#10b981] flex items-center justify-center text-xl">📍</div>
        <div className="absolute bottom-[15%] right-[20%] w-12 h-12 rounded-full bg-orange-500/20 border-2 border-orange-500 flex items-center justify-center text-xl">🎞️</div>
      </div>
      <div className="flex justify-center gap-4 flex-wrap mt-2">
        <Tag color="orange">Prestador</Tag>
        <Tag color="blue">Proyectos</Tag>
        <Tag color="purple">Productoras</Tag>
        <Tag color="green">Locaciones</Tag>
      </div>
    </div>
  );
}

function SlideDemo() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 h-full gap-8">
      <div>
        <Eyebrow>Hora de la verdad</Eyebrow>
        <SectionTitle>Demostración <span className="text-[#4f9cf9]">en Vivo</span></SectionTitle>
        <Sub center>Dejemos la teoría. Veamos el ecosistema funcionando en tiempo real.</Sub>
      </div>
      <div className="flex gap-4">
        <div className="w-24 h-24 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-4xl shadow-xl shadow-orange-500/10 hover:-translate-y-2 transition-transform">1️⃣</div>
        <div className="w-24 h-24 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-4xl shadow-xl shadow-blue-500/10 hover:-translate-y-2 transition-transform">2️⃣</div>
        <div className="w-24 h-24 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-4xl shadow-xl shadow-purple-500/10 hover:-translate-y-2 transition-transform">3️⃣</div>
      </div>
      <div className="flex gap-12 mt-4 text-left border-t border-white/10 pt-8">
        <div>
          <h4 className="font-bold text-white mb-2 text-sm text-center">Frontend</h4>
          <Tag color="orange">Vercel</Tag>
        </div>
        <div>
          <h4 className="font-bold text-white mb-2 text-sm text-center">Backend</h4>
          <Tag color="blue">Render</Tag>
        </div>
        <div>
          <h4 className="font-bold text-white mb-2 text-sm text-center">Base de Datos</h4>
          <Tag color="green">Supabase</Tag>
        </div>
      </div>
    </div>
  );
}

function SlideCierre() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 h-full gap-6">
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(234,88,12,.07),transparent_70%)]" />
      <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight relative">
        ¡Muchas <span className="text-orange-500">Gracias</span>!
      </h1>
      <div className="w-12 h-0.5 bg-orange-500/60 rounded my-2" />
      <p className="text-slate-400 max-w-md text-lg">
        Film Commission TDF — Conectando el ecosistema audiovisual del Fin del Mundo.
      </p>
      <div className="mt-8">
        <span className="text-[12px] font-bold tracking-[0.2em] uppercase text-slate-500 block mb-1">Ezequiel Rodríguez Ibarra</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRO DE DIAPOSITIVAS Y MAIN WRAPPER
// ─────────────────────────────────────────────────────────────────────────────
const SLIDE_COMPONENTS: Record<SlideId, React.FC> = {
  portada:        SlidePortada,
  problema:       SlideProblema,
  paradigma:      SlideParadigma,
  "ia-friccion":  SlideIA,
  gamificacion:   SlideGamificacion,
  stack:          SlideStack,
  diseno:         SlideDiseno,
  "mapa-nodal":   SlideMapaNodal,
  demo:           SlideDemo,
  cierre:         SlideCierre,
};

export default function PresentationPage() {
  const [current, setCurrent]   = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);
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
      if (e.code === "ArrowRight" || e.code === "KeyD" || e.code === "Space") { e.preventDefault(); next(); }
      if (e.code === "ArrowLeft"  || e.code === "KeyA")                         { e.preventDefault(); prev(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev]);

  const progress = ((current + 1) / total) * 100;
  const SlideContent = SLIDE_COMPONENTS[SLIDES[current].id];

  return (
    <main className="bg-[#060810] text-slate-200 w-screen h-screen overflow-hidden relative select-none font-sans">
      <TopologyBackground {...DEFAULT_TOPOLOGY as Record<string, unknown>} />
      
      <div className="fixed top-0 left-0 h-1 bg-gradient-to-r from-orange-500 via-[#4f9cf9] to-[#10b981] z-50 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
      <div className="fixed top-5 left-6 z-40 flex items-center gap-2 opacity-60">
        <span className="text-orange-500">▶</span><span className="text-sm font-bold tracking-wide">TDFFILM</span>
      </div>
      <div className="fixed top-5 right-6 z-40 text-xs font-bold text-slate-500 tracking-widest">{current + 1} / {total}</div>

      <div className="relative z-10 w-full h-full flex items-center justify-center cursor-pointer" onClick={(e) => {if(e.clientX > window.innerWidth/2) next(); else prev();}}>
        <div key={current} className="w-full h-full flex items-center justify-center py-16" style={{ animation: animating ? `${direction === "forward" ? "slideIn" : "slideInBack"} 0.5s cubic-bezier(0.22,1,0.36,1) both` : "none" }}>
          <SlideContent />
        </div>
      </div>

      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-2.5 rounded-full bg-slate-950/85 backdrop-blur-xl border border-white/10 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={prev} disabled={current === 0} className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-30"><ChevronLeft size={18} /></button>
        <div className="flex gap-1.5">
          {SLIDES.map((_, i) => Math.abs(i - current) <= 4 && (
            <button key={i} onClick={() => goTo(i, i > current ? "forward" : "back")} className={`rounded-full transition-all ${i === current ? "w-6 h-2 bg-orange-500" : "w-2 h-2 bg-slate-700 hover:bg-slate-400"}`} />
          ))}
        </div>
        <button onClick={next} disabled={current === total - 1} className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-30"><ChevronRight size={18} /></button>
        <span className="ml-2 text-[10px] font-bold text-slate-500 tracking-widest uppercase hidden sm:block">{SLIDES[current].label}</span>
      </div>

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(50px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes slideInBack { from { opacity: 0; transform: translateX(-50px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes fade-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        .animate-fade-up { animation: fade-up 0.7s cubic-bezier(0.22,1,0.36,1) both; }
      `}</style>
    </main>
  );
}