'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SECTIONS = ['/locaciones', '/guia', '/proyectos'];
const DESKTOP_BREAKPOINT = 768;

function getSectionIndex(path: string): number {
  const i = SECTIONS.findIndex((s) => path === s || path.startsWith(s + '/'));
  return i >= 0 ? i : 0;
}

export default function PageTransitionWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDesktop, setIsDesktop] = useState(false);
  const prevIndexRef = useRef(0);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const sectionIndex = getSectionIndex(pathname);
  const direction = sectionIndex >= prevIndexRef.current ? 1 : -1;
  useEffect(() => {
    prevIndexRef.current = sectionIndex;
  }, [sectionIndex]);

  useEffect(() => {
    if (!isDesktop) return;
    const current = SECTIONS.find((s) => pathname === s || pathname.startsWith(s + '/'));
    if (!current) return;
    SECTIONS.forEach((route) => {
      if (route !== current) router.prefetch(route);
    });
  }, [pathname, isDesktop, router]);

  const isSectionPage = SECTIONS.some((s) => pathname === s || pathname.startsWith(s + '/'));
  const useTransition = isDesktop && isSectionPage;

  if (!useTransition) {
    return <>{children}</>;
  }

  const slideDistance = 72;
  const transition = { duration: 0.35, ease: [0.32, 0.72, 0, 1] };

  return (
    <div className="flex-1 min-h-0 overflow-hidden relative bg-slate-950 w-full">
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={pathname}
          initial={{
            x: direction > 0 ? slideDistance : -slideDistance,
            opacity: 1,
          }}
          animate={{
            x: 0,
            opacity: 1,
          }}
          exit={{
            transition: { duration: 0 },
          }}
          transition={transition}
          className="w-full min-h-full bg-slate-950"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
