'use client';

import { useThemeUnlocked } from '@/contexts/ThemeUnlockedContext';
import dynamic from 'next/dynamic';

const Anycolour = dynamic(() => import('@/components/anycolour'), { ssr: false });

export default function ThemeUnlockedContent({ children }: { children: React.ReactNode }) {
  const ctx = useThemeUnlocked();
  if (ctx?.themeUnlocked) {
    return (
      <div className="fixed inset-0 z-[50] flex flex-col min-h-screen">
        <Anycolour />
      </div>
    );
  }
  return <>{children}</>;
}
