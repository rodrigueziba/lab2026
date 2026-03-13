'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ThemeUnlockedContextValue = {
  themeUnlocked: boolean;
  setThemeUnlocked: (v: boolean) => void;
};

const ThemeUnlockedContext = createContext<ThemeUnlockedContextValue | null>(null);

export function ThemeUnlockedProvider({ children }: { children: ReactNode }) {
  const [themeUnlocked, setThemeUnlocked] = useState(false);
  return (
    <ThemeUnlockedContext.Provider value={{ themeUnlocked, setThemeUnlocked }}>
      {children}
    </ThemeUnlockedContext.Provider>
  );
}

export function useThemeUnlocked() {
  const ctx = useContext(ThemeUnlockedContext);
  return ctx;
}
