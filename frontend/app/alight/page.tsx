"use client";
import dynamic from "next/dynamic";

const ThreeScene = dynamic(() => import("@/components/ThreeScene"), { ssr: false });

export default function AlightPage() {
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#020202" }}>
      <ThreeScene />
    </div>
  );
}
