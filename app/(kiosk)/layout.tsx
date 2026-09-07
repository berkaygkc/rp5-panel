import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "../globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
});

/* Rail saati için modern, karakterli bir grotesk */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-grotesk",
});

export const metadata: Metadata = {
  title: "RP5 Panel",
  description: "Masa üstü dokunmatik panel — UI prototipi",
  // Chrome'un çeviri balonunu engelle (arayüz zaten Türkçe)
  other: { google: "notranslate" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      translate="no"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable}`}
    >
      <head>
        {/* Kaydedilmiş tema, ilk boyamadan önce uygulanır (flaş yok) */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(localStorage.getItem(\"rp5-theme\")===\"light\")document.documentElement.dataset.theme=\"light\"}catch(e){}",
          }}
        />
      </head>
      <body className="kiosk antialiased">{children}</body>
    </html>
  );
}
