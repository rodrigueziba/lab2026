import { VT323 } from "next/font/google";

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
  display: "swap",
});

export default function AlightLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={vt323.variable} style={{ width: "100%", height: "100%" }}>
      {children}
    </div>
  );
}
