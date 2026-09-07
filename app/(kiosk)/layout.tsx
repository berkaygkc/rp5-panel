import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
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
      className={inter.variable}
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
