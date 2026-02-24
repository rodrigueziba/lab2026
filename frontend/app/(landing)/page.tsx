"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const SplatScrollLanding = dynamic(
  () => import("../../components/landing/SplatScrollLanding"),
  { ssr: false }
);

export default function Page() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // localStorage solo existe en el cliente — nunca en SSR
    try {
      const raw = localStorage.getItem("user");
      const user = raw ? (JSON.parse(raw) as { role?: string }) : null;
      setIsAdmin(user?.role === "admin");
    } catch {
      setIsAdmin(false);
    }
  }, []);

  return <SplatScrollLanding isAdmin={isAdmin} />;
}