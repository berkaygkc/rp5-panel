import type { Metadata } from "next";
import { Archivo, Doto, Martian_Mono } from "next/font/google";
import localFont from "next/font/local";
import "../../globals.css";
import "./lab.css";

/* Üç tasarım yönünün üç ayrı sesi var; hepsi burada yüklenir, her yön
 * yalnızca kendi ailesini kullanır. */
const archivo = Archivo({ subsets: ["latin", "latin-ext"], variable: "--lab-grotesk", axes: ["wdth"] });
const martian = Martian_Mono({ subsets: ["latin"], variable: "--lab-mono", axes: ["wdth"] });
const doto = Doto({ subsets: ["latin"], variable: "--lab-led", axes: ["ROND"] });
const departure = localFont({
  src: "../../../public/fonts/departure-mono/DepartureMono-Regular.woff2",
  variable: "--lab-flap",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RP5 · tasarım laboratuvarı",
  description: "Şerit ekran için üç tasarım yönü",
  other: { google: "notranslate" },
};

export default function LabLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="tr"
      translate="no"
      suppressHydrationWarning
      className={`${archivo.variable} ${martian.variable} ${doto.variable} ${departure.variable}`}
    >
      <body className="lab antialiased">{children}</body>
    </html>
  );
}
