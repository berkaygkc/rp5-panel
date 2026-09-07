"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Layers, Server, Settings, Sparkles, Zap } from "lucide-react";
import { Card, PageHeader, StatusDot, api } from "@/components/admin/ui";

interface Status {
  agent: boolean;
  beszel: boolean;
  infra: { configured: boolean; systems: number; down: number; error: string | null };
  notices: number;
  counts: { screens: number; shortcuts: number; rules: number };
  node: string;
  uptimeSec: number;
}

function uptime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h} sa ${m} dk` : `${m} dk`;
}

export default function DashboardPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api<Status>("/api/admin/status")
        .then((d) => { if (alive) { setStatus(d); setError(null); } })
        .catch((e: Error) => { if (alive) setError(e.message); });
    void load();
    const t = setInterval(load, 10_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const tiles = [
    { label: "Mac ajanı", ok: status ? status.agent : null, value: status ? (status.agent ? "Bağlı" : "Erişilemiyor") : "…", sub: "WebSocket 17705" },
    { label: "Beszel hub", ok: status ? status.beszel : null, value: status ? (status.beszel ? "Erişilebilir" : "Erişilemiyor") : "…", sub: status?.infra.configured ? "kimlik tanımlı" : "kimlik eksik" },
    { label: "Sunucular", ok: status ? (status.infra.systems === 0 ? null : status.infra.down === 0) : null, value: status ? (status.infra.systems === 0 ? "Sistem yok" : `${status.infra.systems - status.infra.down} / ${status.infra.systems} ayakta`) : "…", sub: status?.infra.error ?? (status?.infra.configured ? "Beszel'den okunuyor" : "Beszel bağlantısı Altyapı sayfasında") },
    { label: "Aktif bildirim", ok: status ? status.notices === 0 : null, value: status ? String(status.notices) : "…", sub: "kiosk'ta gösteriliyor" },
  ];
  const links = [
    { href: "/admin/screens", icon: Layers, title: "Ekranlar", desc: "Sıra, başlık, renk ve görünürlük", meta: status ? `${status.counts.screens} etkin` : "" },
    { href: "/admin/shortcuts", icon: Zap, title: "Kısayollar", desc: "Proje ve sunucu düğmeleri", meta: status ? `${status.counts.shortcuts} kısayol` : "" },
    { href: "/admin/rules", icon: Sparkles, title: "Bildirim kuralları", desc: "Önem, tür ve hedef ekran ataması", meta: status ? `${status.counts.rules} etkin kural` : "" },
    { href: "/admin/notices", icon: Bell, title: "Aktif bildirimler", desc: "Şu an gösterilenler; test gönder", meta: status ? `${status.notices} aktif` : "" },
    { href: "/admin/infra", icon: Server, title: "Altyapı", desc: "Beszel bağlantısı, sunucu adları, eşikler", meta: status ? `${status.infra.systems} sunucu` : "" },
    { href: "/admin/settings", icon: Settings, title: "Ayarlar", desc: "Kilit, tema, rail ve Claude eşiği", meta: "" },
  ];

  return (
    <>
      <PageHeader
        title="Pano"
        sub="Servislerin durumu ve kiosk yapılandırmasının özeti"
        right={status && <span className="text-[12.5px]" style={{ color: "var(--admin-faint)" }}>Node {status.node}, {uptime(status.uptimeSec)} süredir açık</span>}
      />
      {error && <p className="mb-4 text-[13px]" style={{ color: "var(--admin-danger)" }}>{error}</p>}
      <div className="grid grid-cols-4 gap-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <div className="text-[12.5px] font-medium" style={{ color: "var(--admin-muted)" }}>{t.label}</div>
            <div className="mt-2 text-[20px] font-semibold tracking-[-0.01em]">{t.value}</div>
            <div className="mt-2"><StatusDot ok={t.ok} label={t.sub} /></div>
          </Card>
        ))}
      </div>
      <h2 className="mb-3 mt-8 text-[15px] font-semibold">Yönetim</h2>
      <div className="grid grid-cols-3 gap-4">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="group flex items-start gap-3 rounded-xl p-4 transition-colors"
            style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-line)", boxShadow: "var(--admin-shadow)" }}
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }}>
              <l.icon size={16} />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold">{l.title}</span>
              <span className="block text-[12.5px]" style={{ color: "var(--admin-muted)" }}>{l.desc}</span>
              {l.meta && <span className="mt-1.5 block text-[12px]" style={{ color: "var(--admin-faint)" }}>{l.meta}</span>}
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
