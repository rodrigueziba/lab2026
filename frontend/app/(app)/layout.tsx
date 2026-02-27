// frontend/src/app/(app)/layout.tsx
//
// Layout para todas las rutas internas de la app (locaciones, proyectos, etc.)
// Este layout SÍ tiene Navbar y Footer, y el fondo oscuro.
// El Footer se oculta en mobile (< sm = 640px) con la clase "hidden sm:block".

import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-950 text-white flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 pt-24">{children}</main>
      {/* Footer visible solo en sm+ (≥640px). En mobile no aparece. */}
      <div className="hidden sm:block">
        <Footer />
      </div>
    </div>
  );
}