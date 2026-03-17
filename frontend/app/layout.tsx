import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Inter } from "next/font/google";
import Navbar from "../components/Navbar";
import FooterWrapper from '../components/FooterWrapper';
import PageTransitionWrapper from '../components/PageTransitionWrapper';
import WelcomeTour from '../components/WelcomeTour';
import { Toaster } from 'sonner';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeUnlockedProvider } from '@/contexts/ThemeUnlockedContext';
import { PrestadorVisitProvider } from '@/contexts/PrestadorVisitContext';
import { ScreensaverProvider } from '@/contexts/ScreensaverContext';
import ThemeUnlockedContent from '../components/ThemeUnlockedContent';
import ScreensaverOverlay from '../components/ScreensaverOverlay';

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
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.className} bg-slate-950 text-white flex flex-col min-h-screen`}>
        <LanguageProvider>
          <ThemeUnlockedProvider>
            <PrestadorVisitProvider>
            <ScreensaverProvider>
            <Navbar />
            <ScreensaverOverlay />
            <WelcomeTour />
            <main className="flex-1 flex flex-col min-h-0 bg-slate-950 relative">
              <ThemeUnlockedContent>
                <PageTransitionWrapper>{children}</PageTransitionWrapper>
              </ThemeUnlockedContent>
              <Toaster position="bottom-right" richColors />
            </main>
            <div className="relative z-20 shrink-0">
              <FooterWrapper />
            </div>
            </ScreensaverProvider>
            </PrestadorVisitProvider>
          </ThemeUnlockedProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
