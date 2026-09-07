import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "../../globals.css";
import "../../admin.css";

/* Mühendislik konsolu tipografisi: Plex'in dar, teknik karakteri veriyi veri gibi gösterir. */
const plex = IBM_Plex_Sans({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], variable: "--font-plex", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin", "latin-ext"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: "RP5 Yönetim",
  description: "RP5 panelinin yönetim konsolu",
  other: { google: "notranslate" },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" translate="no" className={`${plex.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Kaydedilmiş tema ilk boyamadan önce uygulanır; yoksa sistem tercihi geçerli olur */}
        <script
          dangerouslySetInnerHTML={{
            __html: 'try{var t=localStorage.getItem("rp5-admin-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}',
          }}
        />
      </head>
      <body className="admin">{children}</body>
    </html>
  );
}
