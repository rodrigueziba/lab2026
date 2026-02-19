import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Inter } from "next/font/google";
import Navbar from "../components/Navbar";
import Footer from '../components/Footer';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ["latin"] });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tierra del Fuego Film Commission",
  description: "Base de datos audiovisual TDF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-slate-950 text-white flex flex-col min-h-screen`}>
       
         {/* <main className="min-h-screen pt-24 bg-slate-950"></main> */}
        <Navbar />
        <main className="flex-1">
        {children}
        <Toaster position="bottom-right" richColors />
        </main>
        <Footer />
      </body>
    </html>
  );
}
