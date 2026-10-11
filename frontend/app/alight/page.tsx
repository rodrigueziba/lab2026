"use client";
import { useEffect } from "react";
import dynamic from "next/dynamic";

const ThreeScene = dynamic(() => import("@/components/ThreeScene"), { ssr: false });

export default function AlightPage() {
  // G1: prevent screen-saver / display sleep while on this route
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lock: any = null;
    const acquire = async () => {
      try {
        if ("wakeLock" in navigator) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          lock = await (navigator as any).wakeLock.request("screen");
        }
      } catch { /* denied or not supported — ignore */ }
    };
    acquire();
    const onVisible = () => {
      // Wake Lock is automatically released when the tab goes to background;
      // re-acquire when the user returns.
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release?.();
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#020202" }}>
      <ThreeScene />
    </div>
  );
}
