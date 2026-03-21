'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';
import { useScreensaver } from '@/contexts/ScreensaverContext';
import type { GalleryItem } from './Depthgallery';

const DepthGallery = dynamic(() => import('@/components/Depthgallery'), { ssr: false });

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Prestador {
  id: number;
  nombre: string;
  tipoPerfil?: string;
  galeria?: string[];
  videoReel?: string | null;
}

/** Tipos de perfil que se muestran en el screensaver (galería/videoreel) */
const SCREENSAVER_TIPOS = ['PROFESIONAL', 'ESTUDIANTE'];

function prestadorAllowedForScreensaver(p: Prestador): boolean {
  const tipo = (p.tipoPerfil ?? '').toUpperCase().trim();
  if (!SCREENSAVER_TIPOS.includes(tipo)) return false;
  const galeria = Array.isArray(p.galeria) ? p.galeria : [];
  const hasReel = !!p.videoReel?.trim() && !!getYoutubeVideoId(p.videoReel);
  const hasImages = galeria.some((src) => src?.trim());
  return hasImages || hasReel;
}

function getYoutubeVideoId(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = u.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

function getYoutubeThumbnail(url: string): string {
  const id = getYoutubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildGalleryItems(prestadores: Prestador[]): GalleryItem[] {
  const filtered = prestadores.filter(prestadorAllowedForScreensaver);
  const shuffled = shuffle(filtered);
  const items: GalleryItem[] = [];
  for (const p of shuffled) {
    const galeria = Array.isArray(p.galeria) ? p.galeria : [];
    const hasReel = !!p.videoReel?.trim() && !!getYoutubeVideoId(p.videoReel);
    if (galeria.length === 0 && !hasReel) continue; // ya filtrados, pero por si acaso
    for (const src of galeria) {
      if (src?.trim()) {
        items.push({ src: src.trim(), title: p.nombre });
      }
    }
    if (hasReel && p.videoReel) {
      const thumb = getYoutubeThumbnail(p.videoReel);
      if (thumb) {
        items.push({
          src: thumb,
          title: `${p.nombre} · Reel`,
          videoUrl: p.videoReel.trim(),
        });
      }
    }
  }
  return items;
}

export default function ScreensaverOverlay() {
  const screensaver = useScreensaver();
  const isDesktop = screensaver?.isDesktop ?? false;
  const isScreensaverActive = screensaver?.isScreensaverActive ?? false;
  const closeScreensaver = screensaver?.closeScreensaver ?? (() => {});
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isDesktop || !isScreensaverActive) return;
    let cancelled = false;
    setLoading(true);
    fetch(`${apiUrl}/prestador`)
      .then((res) => res.json())
      .then((data: Prestador[]) => {
        if (!cancelled && Array.isArray(data)) setPrestadores(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isDesktop, isScreensaverActive]);

  const items = useMemo(() => buildGalleryItems(prestadores), [prestadores]);

  const handleItemClick = useCallback((item: GalleryItem) => {
    if (item.videoUrl) window.open(item.videoUrl, '_blank', 'noopener,noreferrer');
  }, []);

  if (!isDesktop || !isScreensaverActive) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-slate-950 flex flex-col"
      role="dialog"
      aria-label="Galería protector de pantalla"
    >
      <button
        type="button"
        onClick={closeScreensaver}
        className="absolute top-4 right-4 z-[210] flex items-center justify-center w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
        aria-label="Cerrar galería"
      >
        <X size={24} strokeWidth={2} />
      </button>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-white/50 font-mono text-sm tracking-widest uppercase">
          Cargando…
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-white/50 font-mono text-sm">
          No hay galerías disponibles.
        </div>
      ) : (
        <div className="flex-1 min-h-0 w-full">
          <DepthGallery
            items={items}
            height="100vh"
            title="TDF FILM"
            subtitle="Guía audiovisual"
            onItemClick={handleItemClick}
            autoScrollAfterMs={10000}
            autoScrollSpeed={1.5}
          />
        </div>
      )}
    </div>
  );
}
