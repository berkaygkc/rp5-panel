"use client";

import Link from "next/link";
import { useCallback } from "react";
import { ArrowUpRight, Bell } from "lucide-react";
import { Empty, Panel, Skeleton, Status, Tag, ago, api, duration, usePoll } from "@/components/admin/ui";
import { ScreenStrip, type StripScreen } from "@/components/admin/ScreenStrip";
import { useStatus } from "@/components/admin/AdminShell";
import type { Notice } from "@/lib/notices/types";

const SEV: Record<string, { label: string; tone: "ok" | "warn" | "fault" }> = {
  info: { label: "Bilgi", tone: "ok" },
  attention: { label: "Dikkat", tone: "warn" },
  urgent: { label: "Acil", tone: "fault" },
};

function ServiceRow({ title, desc, tone, state, href }: { title: string; desc: string; tone?: "ok" | "warn" | "fault"; state: string; href: string }) {
  return (
    <div className="a-row">
      <div className="a-row-text">
        <div className="a-row-title">{title}</div>
        <div className="a-row-desc">{desc}</div>
      </div>
      <div className="a-row-control">
        <Status tone={tone}>{state}</Status>
        <Link href={href} className="a-btn" data-size="icon" data-variant="ghost" title={`${title} ayarları`}>
          <ArrowUpRight size={15} />
        </Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { status } = useStatus();
  const loadScreens = useCallback(() => api<{ screens: StripScreen[] }>("/api/admin/screens").then((r) => r.screens), []);
  const loadNotices = useCallback(() => api<{ notices: Notice[] }>("/api/admin/notices").then((r) => r.notices), []);
  const screens = usePoll(loadScreens, 30_000);
  const notices = usePoll(loadNotices, 10_000);

  const visible = (screens.data ?? []).filter((s) => s.enabled);
  const chat = status?.chat;
  const chatState = (src?: { configured: boolean; error: string | null; items: number }) =>
    !src?.configured ? { tone: undefined, text: "bağlı değil" } : src.error ? { tone: "fault" as const, text: "hata" } : { tone: "ok" as const, text: `${src.items} öğe` };
  const cw = chatState(chat?.chatwoot);
  const mm = chatState(chat?.mattermost);

  return (
    <>
      <header className="a-head">
        <div>
          <h1 className="a-title">Pano</h1>
          <p className="a-sub">Güvertenin düzeni, onu besleyen servisler ve şu an cihazda bekleyen bildirimler.</p>
        </div>
        {status && (
          <div className="a-faint text-right text-[12px]">
            <div>Node {status.node}</div>
            <div className="a-num">{duration(status.uptimeSec)} süredir açık</div>
          </div>
        )}
      </header>

      <Panel
        title="Güverte düzeni"
        desc="Paneller soldan sağa bu sırayla dizilir. Bir panele dokunarak ayarlarına gidin."
        actions={<Link href="/admin/screens" className="a-btn" data-size="sm" data-variant="default">Sırayı düzenle</Link>}
        footer={
          <>
            <span className="a-num">1973 × 426 · DPR 0.75</span>
            <span>
              {status ? `${status.counts.screens} panel açık · ${status.counts.shortcuts} kısayol · ${status.counts.rules} etkin kural` : ""}
            </span>
          </>
        }
      >
        {screens.loading ? <Skeleton h={132} /> : <ScreenStrip screens={screens.data ?? []} />}
        {!screens.loading && visible.length === 0 && <p className="a-faint mt-3 text-center">Açık panel yok.</p>}
      </Panel>

      <div className="mt-4 grid grid-cols-2 items-start gap-4">
        <Panel title="Servisler" desc="Paneli besleyen kaynakların canlı durumu" flush>
          <div className="a-rows">
            <ServiceRow
              title="Mac ajanı"
              desc="Medya, Claude oturumları, posta ve kısayollar bu bağlantıdan gelir"
              tone={status ? (status.agent ? "ok" : "fault") : undefined}
              state={status ? (status.agent ? "bağlı" : "erişilemiyor") : "…"}
              href="/admin/settings"
            />
            <ServiceRow
              title="Beszel hub"
              desc={status?.infra.error ?? "Sunucu ve konteyner ölçümleri"}
              tone={status ? (!status.infra.configured ? undefined : status.infra.down > 0 ? "fault" : status.beszel ? "ok" : "warn") : undefined}
              state={status ? (!status.infra.configured ? "bağlı değil" : `${status.infra.systems - status.infra.down} / ${status.infra.systems} ayakta`) : "…"}
              href="/admin/infra"
            />
            <ServiceRow title="Chatwoot" desc={chat?.chatwoot.error ?? "Müşteri sohbetleri"} tone={cw.tone} state={cw.text} href="/admin/chat" />
            <ServiceRow title="Mattermost" desc={chat?.mattermost.error ?? "Ekip içi sohbet"} tone={mm.tone} state={mm.text} href="/admin/chat" />
          </div>
        </Panel>

        <Panel
          title="Dikkat katmanı"
          desc="Cihazın omurgasında şu an duranlar"
          flush
          actions={<Link href="/admin/notices" className="a-btn" data-size="sm" data-variant="ghost">Tümünü yönet</Link>}
        >
          {notices.loading ? (
            <div className="flex flex-col gap-3 p-4">
              <Skeleton /><Skeleton w="70%" /><Skeleton w="85%" />
            </div>
          ) : (notices.data ?? []).length === 0 ? (
            <Empty>
              <Bell size={18} className="mx-auto mb-2 opacity-50" />
              Kiosk sakin. Bekleyen bildirim yok.
            </Empty>
          ) : (
            <div className="a-rows">
              {(notices.data ?? []).slice(0, 6).map((n) => (
                <div key={n.id} className="a-row">
                  <div className="a-row-text">
                    <div className="flex items-center gap-2">
                      <Tag tone={SEV[n.severity]?.tone}>{SEV[n.severity]?.label ?? n.severity}</Tag>
                      <span className="a-row-title truncate">{n.title}</span>
                    </div>
                    {n.body && <div className="a-row-desc truncate">{n.body}</div>}
                  </div>
                  <div className="a-row-control a-faint text-[12px]">
                    <span className="a-mono">{n.source}</span>
                    <span className="a-num">{ago(n.ts)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
