"use client";
// Z70: contexto del menú de debug. DebugMenu.tsx llama una vez a useDebugEstado() y pasa el resultado; cada sección
// (components/debug/pestanas/*) toma solo lo que usa con useDbg().
import { createContext, useContext } from "react";
import type { useDebugEstado } from "./estado";

export type DebugEstado = ReturnType<typeof useDebugEstado>;
export const DebugCtx = createContext<DebugEstado | null>(null);
export function useDbg(): DebugEstado {
  const v = useContext(DebugCtx);
  if (!v) throw new Error("useDbg: sección del menú de debug fuera de DebugCtx");
  return v;
}
