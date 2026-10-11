import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path from "path";

// T4: returns the sorted list of .mp3 files served from /public
// stress.mp3 is placed first if it exists; otherwise alphabetical order.
export async function GET() {
  try {
    const publicDir = path.join(process.cwd(), "public");
    const files = await readdir(publicDir);
    const mp3s = files
      .filter(f => f.toLowerCase().endsWith(".mp3"))
      .sort((a, b) => {
        if (a === "stress.mp3") return -1;
        if (b === "stress.mp3") return  1;
        return a.localeCompare(b);
      })
      .map(f => `/${f}`);
    return NextResponse.json({ tracks: mp3s });
  } catch {
    return NextResponse.json({ tracks: [] }, { status: 500 });
  }
}
