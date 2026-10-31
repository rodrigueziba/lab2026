import * as THREE from "three";

// Amber CRT terminal UI drawn on a 2D canvas — use as map on a plane.
// TypeScript port of terminalUI.js (brief 2.4).

const MONO = '"VT323","IBM Plex Mono","Space Mono",ui-monospace,Menlo,Consolas,monospace';

export interface TerminalState {
  title?:  string;
  ch?:     number;
  status?: string;
  signal?: number;  // 0–4
  power?:  number;  // 0–100
}

export interface TerminalScreen {
  texture: THREE.CanvasTexture;
  draw:    (state?: TerminalState) => void;
  dispose: () => void;
}

export function createTerminalScreen({
  width  = 512,
  height = 384,
  fg     = "#FF9A1F",
  bg     = "#2A1400",
}: {
  width?:  number;
  height?: number;
  fg?:     string;
  bg?:     string;
} = {}): TerminalScreen {
  const canvas   = document.createElement("canvas");
  canvas.width   = width;
  canvas.height  = height;
  const ctx      = canvas.getContext("2d")!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  function draw(state: TerminalState = {}): void {
    const { title = "COMM-LINK [ACTIVE]", ch = 8, status = "ONLINE", signal = 4, power = 74 } = state;

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = fg;
    for (let i = 0; i < 6; i++) ctx.fillRect(14 + i * 26, 12, 16, 16);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 2;
    ctx.strokeRect(width - 54, 12, 38, 16);
    ctx.fillRect(width - 51, 15, Math.round(32 * (power / 100)), 10);
    ctx.fillRect(width - 14, 17, 4, 6);
    ctx.fillRect(10, 36, width - 20, 2);

    ctx.fillStyle = fg;
    ctx.textBaseline = "top";
    ctx.font = `34px ${MONO}`;
    ctx.fillText(title,                      24, 52);
    ctx.fillText(`CH: ${String(ch).padStart(2, "0")}`, 24, 100);
    ctx.fillText(`STATUS: ${status}`,        24, 144);
    ctx.fillText("SIGNAL:",                  24, 188);
    ctx.fillText(`POWER: ${power}%`,         24, 232);

    for (let i = 0; i < 4; i++) {
      const bh = 10 + i * 8;
      ctx.globalAlpha = i < signal ? 1 : 0.25;
      ctx.fillRect(150 + i * 14, 188 + 28 - bh, 9, bh);
    }
    ctx.globalAlpha = 1;

    ctx.strokeRect(24, height - 48, width - 48, 18);
    ctx.fillRect(28, height - 44, Math.round((width - 56) * (power / 100)), 10);

    texture.needsUpdate = true;
  }

  draw();
  return { texture, draw, dispose: () => texture.dispose() };
}
