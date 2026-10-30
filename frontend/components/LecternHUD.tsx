"use client";

// K3: value HUD — shows last changed knob/slider label+value for 1200ms.
// Reads LECTERN_DBG and renders a fixed HTML overlay, pointer-events:none.

import { useEffect, useState } from "react";
import { INTERACT_STATE } from "@/lib/alightStore";
import { LECTERN_DBG } from "./LecternSystem";

export default function LecternHUD() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let raf = 0;
    function tick() {
      if (INTERACT_STATE.mode !== "none") {
        const expired = performance.now() > LECTERN_DBG.hudExpiry;
        setText(expired ? null : LECTERN_DBG.hudLabel);
      } else {
        setText(null);
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // L5: always in DOM for smooth 200ms fade; opacity drives visibility
  return (
    <div style={{
      position: "fixed",
      top: 24,
      left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(42,20,0,0.88)",
      color: "#FF9A1F",
      fontFamily: "monospace",
      fontSize: 16,
      fontWeight: "bold",
      letterSpacing: "0.08em",
      padding: "4px 14px",
      borderRadius: 3,
      border: "1px solid rgba(255,154,31,0.35)",
      zIndex: 3100,
      pointerEvents: "none",
      whiteSpace: "nowrap",
      opacity: text ? 1 : 0,
      transition: "opacity 0.2s ease",
    }}>
      {text}
    </div>
  );
}
