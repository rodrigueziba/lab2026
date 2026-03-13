'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type PrestadorVisitContextValue = {
  musicaYoutubeUrl: string | null;
  setMusicaYoutubeUrl: (url: string | null) => void;
};

const PrestadorVisitContext = createContext<PrestadorVisitContextValue | null>(null);

export function PrestadorVisitProvider({ children }: { children: ReactNode }) {
  const [musicaYoutubeUrl, setMusicaYoutubeUrl] = useState<string | null>(null);
  return (
    <PrestadorVisitContext.Provider value={{ musicaYoutubeUrl, setMusicaYoutubeUrl }}>
      {children}
    </PrestadorVisitContext.Provider>
  );
}

export function usePrestadorVisit() {
  return useContext(PrestadorVisitContext);
}
