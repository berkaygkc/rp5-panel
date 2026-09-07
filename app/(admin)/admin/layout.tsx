import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../../globals.css";
import "../../admin.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "RP5 Yönetim",
  description: "RP5 panel yönetimi",
};

/** Yönetim paneli kök düzeni — kiosk'tan bağımsız: akışkan sayfa, açık tema varsayılan */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" data-theme="light" className={inter.variable} suppressHydrationWarning>
      <body className="admin">{children}</body>
    </html>
  );
}
