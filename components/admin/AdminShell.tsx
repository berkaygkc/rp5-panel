"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Gauge, Layers, LogOut, Mail, Server, Settings, ShieldCheck, Sparkles, Zap } from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { group: "Genel", items: [
    { href: "/admin", label: "Pano", icon: Gauge },
  ]},
  { group: "Kiosk", items: [
    { href: "/admin/screens", label: "Ekranlar", icon: Layers },
    { href: "/admin/shortcuts", label: "Kısayollar", icon: Zap },
  ]},
  { group: "Bildirim", items: [
    { href: "/admin/rules", label: "Kurallar", icon: Sparkles },
    { href: "/admin/notices", label: "Aktif bildirimler", icon: Bell },
  ]},
  { group: "Kaynaklar", items: [
    { href: "/admin/infra", label: "Altyapı (Beszel)", icon: Server },
    { href: "/admin/mail", label: "Posta", icon: Mail },
  ]},
  { group: "Sistem", items: [
    { href: "/admin/settings", label: "Ayarlar", icon: Settings },
    { href: "/admin/security", label: "Güvenlik", icon: ShieldCheck },
  ]},
];

/** Yönetim paneli iskeleti: sol gezinti, üst şerit, içerik */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  };
  return (
    <div className="flex min-h-screen">
      <aside
        className="sticky top-0 flex h-screen w-[236px] shrink-0 flex-col px-3 py-4"
        style={{ background: "var(--admin-surface)", borderRight: "1px solid var(--admin-line)" }}
      >
        <div className="mb-5 flex items-center gap-2.5 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-bold text-white" style={{ background: "var(--admin-accent)" }}>RP5</span>
          <div className="leading-tight">
            <div className="text-[13.5px] font-semibold">RP5 Yönetim</div>
            <div className="text-[11.5px]" style={{ color: "var(--admin-faint)" }}>panel · ajan · altyapı</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto">
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="mb-1 px-2 text-[11.5px] font-semibold" style={{ color: "var(--admin-faint)" }}>{g.group}</div>
              <ul className="flex flex-col gap-0.5">
                {g.items.map((it) => {
                  const active = pathname === it.href || (it.href !== "/admin" && pathname.startsWith(it.href));
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13.5px] font-medium transition-colors"
                        style={{ background: active ? "var(--admin-accent-soft)" : "transparent", color: active ? "var(--admin-accent)" : "var(--color-ink)" }}
                      >
                        <it.icon size={16} strokeWidth={2} />
                        {it.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mt-4 flex items-center justify-between px-2 text-[12px]" style={{ color: "var(--admin-faint)" }}>
          <a href="/" target="_blank" rel="noreferrer" className="hover:underline">Kiosk’u aç ↗</a>
          <button onClick={logout} className="inline-flex items-center gap-1 hover:underline"><LogOut size={13} /> Çıkış</button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-7">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>
    </div>
  );
}
