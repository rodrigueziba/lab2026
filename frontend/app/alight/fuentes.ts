// Z46: tipografías de /alight resueltas por next/font (se sirven desde el propio sitio; sin fetch en tiempo
// de ejecución). Anton: condensada muy pesada, estilo cartel, para el texto proyectado sobre el telón.
import { Anton } from "next/font/google";

export const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});
