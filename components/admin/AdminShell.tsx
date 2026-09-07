"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bell, Cpu, ExternalLink, Gauge, Layers, LogOut, Mail, MessageSquare, Moon, RefreshCw,
  Search, Server, Settings, ShieldCheck, Sparkles, Sun, Zap, type LucideIcon,
} from "lucide-react";
import { Button, Dot, Kbd, ToastHost, api, usePoll } from "@/components/admin/ui";
import type { AdminStatus } from "@/components/admin/status";

interface NavItem { href: string; label: string; icon: LucideIcon; count?: (s: AdminStatus) => number | null }
const NAV: Array<{ group: string; items: NavItem[] }> = [
  { group: "Genel", items: [{ href: "/admin", label: "Pano", icon: Gauge }] },
  { group: "Kiosk", items: [
    { href: "/admin/screens", label: "Ekranlar", icon: Layers, count: (s) => s.counts.screens },
    { href: "/admin/shortcuts", label: "Kısayollar", icon: Zap, count: (s) => s.counts.shortcuts },
  ]},
  { group: "Dikkat katmanı", items: [
    { href: "/admin/notices", label: "Aktif bildirimler", icon: Bell, count: (s) => s.notices || null },
    { href: "/admin/rules", label: "Kurallar", icon: Sparkles, count: (s) => s.counts.rules },
  ]},
  { group: "Kaynaklar", items: [
    { href: "/admin/chat", label: "Sohbet", icon: MessageSquare },
    { href: "/admin/infra", label: "Altyapı", icon: Server, count: (s) => s.infra.systems || null },
    { href: "/admin/mail", label: "Posta", icon: Mail },
  ]},
  { group: "Sistem", items: [
    { href: "/admin/devices", label: "Cihazlar", icon: Cpu },
    { href: "/admin/settings", label: "Ayarlar", icon: Settings },
    { href: "/admin/security", label: "Güvenlik", icon: ShieldCheck },
  ]},
];

const StatusCtx = createContext<{ status: AdminStatus | null; refresh: () => void }>({ status: null, refresh: () => {} });
export const useStatus = () => useContext(StatusCtx);

function applyTheme(next: "light" | "dark") {
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("rp5-admin-theme", next); } catch { /* özel pencere */ }
}
function toggleTheme() {
  const el = document.documentElement;
  const current = el.dataset.theme ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(current === "dark" ? "light" : "dark");
}

/* ── Üst şerit: cihazın ve besleyicilerinin canlı durumu her sayfada görünür ── */

function Leds({ status }: { status: AdminStatus | null }) {
  const chat = status?.chat;
  const chatOn = Boolean(chat && (chat.chatwoot.configured || chat.mattermost.configured));
  const chatBad = Boolean(chat && (chat.chatwoot.error || chat.mattermost.error));
  const items: Array<{ href: string; label: string; tone?: "ok" | "warn" | "fault"; title: string }> = [
    { href: "/admin", label: "Ajan", tone: status ? (status.agent ? "ok" : "fault") : undefined, title: status?.agent ? "Mac ajanı bağlı" : "Mac ajanına ulaşılamıyor" },
    { href: "/admin/infra", label: "Altyapı", tone: status ? (!status.infra.configured ? undefined : status.infra.down > 0 ? "fault" : status.beszel ? "ok" : "warn") : undefined, title: status ? `${status.infra.systems - status.infra.down} / ${status.infra.systems} sunucu ayakta` : "" },
    { href: "/admin/chat", label: "Sohbet", tone: !chatOn ? undefined : chatBad ? "fault" : "ok", title: chatOn ? "Sohbet kaynakları bağlı" : "Sohbet kaynağı bağlı değil" },
  ];
  return (
    <nav className="a-leds">
      {items.map((i) => (
        <Link key={i.label} href={i.href} className="a-led" title={i.title}>
          <Dot tone={i.tone} live={i.tone === "ok"} />
          {i.label}
        </Link>
      ))}
      <Link href="/admin/notices" className="a-led" title="Kiosk'ta duran bildirimler">
        <Bell size={13} />
        {status ? status.notices : "—"}
      </Link>
    </nav>
  );
}

/* ── Komut paleti: klavyeyle açılır, bu yüzden animasyonsuz ── */

interface Command { label: string; hint?: string; icon: LucideIcon; run: () => void }

function Palette({ open, onClose, commands }: { open: boolean; onClose: () => void; commands: Command[] }) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const matches = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    if (!needle) return commands;
    return commands.filter((c) => `${c.label} ${c.hint ?? ""}`.toLocaleLowerCase("tr").includes(needle));
  }, [q, commands]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, matches.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
      if (e.key === "Enter") { e.preventDefault(); const m = matches[cursor]; if (m) { onClose(); m.run(); } }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, matches, cursor]);

  if (!open) return null;
  return (
    <>
      <div className="a-palette-scrim" onClick={onClose} aria-hidden />
      <div className="a-palette" role="dialog" aria-modal aria-label="Komut paleti">
        <input
          autoFocus
          value={q}
          onChange={(e) => { setQ(e.target.value); setCursor(0); }}
          placeholder="Sayfa ara ya da komut çalıştır"
          aria-label="Komut ara"
        />
        <div className="a-palette-list">
          {matches.length === 0 && <div className="a-empty">Eşleşen komut yok</div>}
          {matches.map((c, i) => (
            <button
              key={c.label}
              type="button"
              className="a-palette-item"
              data-active={i === cursor}
              onMouseEnter={() => setCursor(i)}
              onClick={() => { onClose(); c.run(); }}
            >
              <c.icon size={15} />
              {c.label}
              {c.hint && <span className="a-palette-hint">{c.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ── Kabuk ── */

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const loadStatus = useCallback(() => api<AdminStatus>("/api/admin/status"), []);
  const { data: status, refresh } = usePoll(loadStatus, 10_000);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }, [router]);

  const commands = useMemo<Command[]>(() => {
    const pages = NAV.flatMap((g) => g.items.map((i) => ({ label: i.label, hint: g.group, icon: i.icon, run: () => router.push(i.href) })));
    return [
      ...pages,
      { label: "Kiosk'u yeni sekmede aç", icon: ExternalLink, run: () => window.open("/", "_blank") },
      { label: "Temayı değiştir", icon: Moon, run: toggleTheme },
      { label: "Sohbet kaynaklarını şimdi yokla", icon: RefreshCw, run: () => void api("/api/admin/chat/status", { method: "POST" }).then(refresh) },
      { label: "Durumu yenile", icon: RefreshCw, run: refresh },
      { label: "Çıkış yap", icon: LogOut, run: () => void logout() },
    ];
  }, [router, refresh, logout]);

  const ctx = useMemo(() => ({ status, refresh }), [status, refresh]);

  return (
    <StatusCtx.Provider value={ctx}>
      <ToastHost>
        <header className="a-strip">
          <Link href="/admin" className="a-mark">
            <span className="a-mark-badge">RP5</span>
            <span className="a-mark-name">Yönetim</span>
          </Link>
          <Leds status={status} />
          <div className="ml-auto flex items-center gap-1">
            <button type="button" className="a-led" onClick={() => setPaletteOpen(true)} title="Komut paleti">
              <Search size={13} />
              Ara
              <Kbd>⌘K</Kbd>
            </button>
            <Button size="icon" variant="ghost" onClick={toggleTheme} title="Temayı değiştir">
              <Sun size={15} className="a-theme-dark" />
              <Moon size={15} className="a-theme-light" />
            </Button>
            <a href="/" target="_blank" rel="noreferrer" className="a-btn" data-size="icon" data-variant="ghost" title="Kiosk'u aç">
              <ExternalLink size={15} />
            </a>
            <Button size="icon" variant="ghost" onClick={() => void logout()} title="Çıkış yap"><LogOut size={15} /></Button>
          </div>
        </header>

        <div className="a-shell">
          <nav className="a-nav" aria-label="Bölümler">
            {NAV.map((g) => (
              <div key={g.group}>
                <div className="a-nav-group-label">{g.group}</div>
                <ul>
                  {g.items.map((it) => {
                    const active = pathname === it.href || (it.href !== "/admin" && pathname.startsWith(it.href));
                    const count = status && it.count ? it.count(status) : null;
                    return (
                      <li key={it.href}>
                        <Link href={it.href} className="a-nav-item" aria-current={active ? "page" : undefined}>
                          <it.icon size={15} strokeWidth={2} />
                          {it.label}
                          {count !== null && <span className="a-nav-count">{count}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
          <main className="a-main">
            <div className="a-page">{children}</div>
          </main>
        </div>

        <Palette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
      </ToastHost>
    </StatusCtx.Provider>
  );
}
