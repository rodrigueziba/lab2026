"use client";
// Z3: capa de datos del panel abierto (camino SILLAS). Sin render.
// Reutiliza la lógica de app/proyectos/[id]/page.tsx: mismo endpoint (GET /proyecto/:id),
// misma base de API, mismo formato de fecha es-AR y mismo extractor de YouTube
// (la página ahora importa formatFechaAR y getYoutubeId de acá).
// Backend sin cambios.

import { useEffect, useState } from "react";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// ── Tipos crudos de la API (findOne/findAll incluyen puestos y user{nombre,email}) ──
export interface PuestoApi {
  id: number;
  nombre: string;
  descripcion: string;
  estado: string;        // "Vacante" | …
  proyectoId: number;
}

export interface ProyectoApi {
  id: number;
  titulo: string;
  descripcion: string;   // sinopsis
  tipo: string;
  estado: string;        // Abierto | En Producción | Finalizado
  foto: string | null;
  fotoProfundidad: string | null;
  ciudad: string;
  referencias: string[];
  galeria: string[];
  fechaInicio: string | null;
  fechaFin: string | null;
  esEstudiante: boolean;
  esRemunerado: boolean;
  esBorrador: boolean;
  esPlantilla: boolean;
  userId: number;
  user?: { nombre: string; email: string } | null;
  puestos?: PuestoApi[];
  createdAt?: string;
  updatedAt?: string;
}

// ── Datos normalizados para el panel abierto ──────────────────────────────────
export interface ProyectoDetalle {
  id: number;
  titulo: string;
  sinopsis: string;
  foto: string | null;
  fotoProfundidad: string | null;
  galeria: string[];                 // URLs limpias; si está vacía → [foto]
  ficha: {
    tipo: string;
    estado: string;
    ciudad: string;
    fechaInicio: string | null;      // "12 mar 2027" (es-AR)
    fechaFin: string | null;
    fechas: string | null;           // "12 mar 2027 – 30 abr 2027" o solo inicio
    esEstudiante: boolean;
    esRemunerado: boolean;
    referencias: { cantidad: number; hosts: string[] };  // hosts únicos, sin "www."
    puestos: { cantidad: number; vacantes: number };
  };
  referencias: string[];             // URLs limpias (para Z4)
  videoRef: string | null;           // primera de YouTube/Vimeo (como la página)
  youtubeId: string | null;
  autor: string | null;              // user.nombre
}

// ── Helpers compartidos con la página /proyectos/[id] ─────────────────────────
/** Mismo formato que la página de detalle. */
export function formatFechaAR(d: string | Date | null | undefined): string | null {
  return d ? new Date(d).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) : null;
}

/** Mismo extractor que la página de detalle. */
export function getYoutubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

/** La página usa las URLs tal cual (son absolutas, de Supabase Storage). Acá solo se
 *  limpian espacios y vacíos (hay referencias con espacio final en los datos). */
function limpiarUrl(u: unknown): string | null {
  if (typeof u !== "string") return null;
  const t = u.trim();
  return t.length ? t : null;
}

function hostDe(u: string): string | null {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; }
}

export function normalizarProyecto(p: ProyectoApi): ProyectoDetalle {
  const foto = limpiarUrl(p.foto);
  const galeriaCruda = (Array.isArray(p.galeria) ? p.galeria : []).map(limpiarUrl).filter((u): u is string => !!u);
  const galeria = [...new Set(galeriaCruda)];
  if (galeria.length === 0 && foto) galeria.push(foto);

  const referencias = (Array.isArray(p.referencias) ? p.referencias : []).map(limpiarUrl).filter((u): u is string => !!u);
  const hosts = [...new Set(referencias.map(hostDe).filter((h): h is string => !!h))];
  const videoRef = referencias.find(r => r.includes("youtu") || r.includes("vimeo")) ?? null;

  const puestos = Array.isArray(p.puestos) ? p.puestos : [];
  const fechaInicio = formatFechaAR(p.fechaInicio);
  const fechaFin = formatFechaAR(p.fechaFin);

  return {
    id: p.id,
    titulo: p.titulo ?? "",
    sinopsis: (p.descripcion ?? "").trim(),
    foto,
    fotoProfundidad: limpiarUrl(p.fotoProfundidad),
    galeria,
    ficha: {
      tipo: p.tipo ?? "",
      estado: p.estado ?? "",
      ciudad: p.ciudad ?? "",
      fechaInicio,
      fechaFin,
      fechas: fechaInicio ? (fechaFin ? `${fechaInicio} – ${fechaFin}` : fechaInicio) : null,
      esEstudiante: !!p.esEstudiante,
      esRemunerado: !!p.esRemunerado,
      referencias: { cantidad: referencias.length, hosts },
      puestos: { cantidad: puestos.length, vacantes: puestos.filter(x => x.estado === "Vacante").length },
    },
    referencias,
    videoRef,
    youtubeId: videoRef ? getYoutubeId(videoRef) : null,
    autor: p.user?.nombre ?? null,
  };
}

// ── Fetch con caché por id ────────────────────────────────────────────────────
const CACHE = new Map<number, ProyectoDetalle>();

/** GET /proyecto/:id normalizado. Un id inexistente responde 200 con cuerpo vacío
 *  (findUnique → null), así que se lee como texto y se trata como "no encontrado". */
export async function fetchProyectoDetalle(id: number, signal?: AbortSignal): Promise<ProyectoDetalle> {
  const hit = CACHE.get(id);
  if (hit) return hit;
  const res = await fetch(`${API_URL}/proyecto/${id}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const txt = await res.text();
  if (!txt.trim()) throw new Error("proyecto no encontrado");
  const raw = JSON.parse(txt) as ProyectoApi | null;
  if (!raw || typeof raw.id !== "number") throw new Error("proyecto no encontrado");
  const det = normalizarProyecto(raw);
  CACHE.set(id, det);
  return det;
}

export function proyectoDetalleEnCache(id: number): ProyectoDetalle | null {
  return CACHE.get(id) ?? null;
}

export function limpiarCacheProyectoDetalle(): void {
  CACHE.clear();
}

/**
 * Z3: hook perezoso. Con id null no hace nada; con un id pide el detalle (una vez por id,
 * caché de módulo) y aborta la petición si cambia el id o se desmonta.
 */
export function useProyectoDetalle(id: number | null): {
  data: ProyectoDetalle | null;
  loading: boolean;
  error: string | null;
} {
  // solo el resultado asíncrono va al estado (nunca setState sincrónico en el efecto)
  const [res, setRes] = useState<{ id: number; error: string | null; n: number } | null>(null);

  useEffect(() => {
    if (id === null || CACHE.has(id)) return;
    const ctrl = new AbortController();
    fetchProyectoDetalle(id, ctrl.signal)
      .then(() => setRes(r => ({ id, error: null, n: (r?.n ?? 0) + 1 })))
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setRes(r => ({ id, error: e instanceof Error ? e.message : String(e), n: (r?.n ?? 0) + 1 }));
      });
    return () => ctrl.abort();
  }, [id]);

  if (id === null) return { data: null, loading: false, error: null };
  const data = CACHE.get(id) ?? null;
  const error = !data && res?.id === id ? res.error : null;
  return { data, loading: !data && !error, error };
}
