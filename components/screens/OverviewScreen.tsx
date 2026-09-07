"use client";

import { Mail, Music2, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyTile } from "@/components/ui/EmptyTile";
import AnalogClock from "@/components/clock/AnalogClock";
import { NowPlayingCard } from "@/components/media/NowPlayingCard";
import { UnreadSummaryCard } from "@/components/mail/UnreadSummaryCard";
import { LiveSessionsCard } from "@/components/claude/LiveSessionsCard";
import { useClaude } from "@/lib/data/useClaude";
import { InfraComplication } from "@/components/infra/InfraComplication";
import { useInfra } from "@/lib/data/useInfra";
import { useMail } from "@/lib/data/useMail";
import { useMedia } from "@/lib/data/useMedia";
import { useNow } from "@/lib/data/useNow";

/** Şeritteki açık modül: yüzey yok, komşusundan saç teliyle ayrılır */
function Module({ divider = true, className = "", children }: { divider?: boolean; className?: string; children: ReactNode }) {
  return (
    <section
      className={`flex min-h-0 min-w-0 flex-col ${className}`}
      style={divider ? { borderLeft: "1px solid var(--hairline)" } : undefined}
    >
      {children}
    </section>
  );
}

/**
 * Genel Bakış — şeridin ana görünümü.
 *
 * Dört eşit kutu yerine bir ufuk: solda kahraman modül yüzeyiyle öne çıkar
 * (müzik çalıyorsa çalar, çalmıyorsa sessiz boş durumu), sağında Claude, Posta
 * ve saat kadranı yüzeysiz bir şerit olarak, aralarında yalnızca saç teli
 * çizgiyle durur. Hiyerarşi kutu çizerek değil, malzeme vererek kuruluyor.
 */
export default function OverviewScreen() {
  const media = useMedia();
  const mail = useMail();
  const claude = useClaude({ feed: false });
  const infra = useInfra();
  const now = useNow(1000);

  const unread = mail.data.accounts.reduce((sum, a) => sum + a.unread, 0);
  const liveClaude = claude.data.sessions.some((s) => s.status !== "closed");

  return (
    <div
      className="stage-in grid h-full p-5"
      style={{ gridTemplateColumns: "1.34fr 0.84fr 0.84fr 0.98fr" }}
    >
      {/* 1 — Kahraman: tek yüzey taşıyan modül */}
      <section className="flex min-h-0 min-w-0 flex-col pr-5">
        {media.data.track ? (
          <NowPlayingCard data={media.data} stale={media.stale} actions={media.actions} />
        ) : (
          <EmptyTile
            icon={<Music2 size={19} strokeWidth={1.75} />}
            title={media.stale ? "Mac ajanına bağlanılamadı" : "Şu an çalan yok"}
            sub={media.stale ? "clients/mac-agent çalışıyor mu?" : "Mac'te müzik başlayınca çalar burada belirir"}
            tint="var(--color-blue)"
          />
        )}
      </section>

      {/* 2 — Claude */}
      <Module divider={false} className="px-5">
        {liveClaude ? (
          <LiveSessionsCard bare sessions={claude.data.sessions} usage={claude.data.usage} now={now?.getTime() ?? 0} />
        ) : (
          <EmptyTile
            bare
            icon={<Sparkles size={19} strokeWidth={1.75} />}
            title="Canlı Claude oturumu yok"
            sub="Oturum açılınca burada görünür"
            screen="claude"
            tint="var(--color-terracotta)"
          />
        )}
      </Module>

      {/* 3 — Posta */}
      <Module className="px-5">
        {unread > 0 ? (
          <UnreadSummaryCard bare accounts={mail.data.accounts} messages={mail.data.messages} now={now?.getTime() ?? 0} />
        ) : (
          <EmptyTile
            bare
            icon={<Mail size={19} strokeWidth={1.75} />}
            title="Gelen kutusu temiz"
            sub={mail.stale ? "Posta verisi bekleniyor" : "Okunmamış posta yok"}
            screen="mail"
            tint="var(--color-indigo)"
          />
        )}
      </Module>

      {/* 4 — Kadran: cihazın yüzü */}
      <Module className="items-center justify-center gap-3 pl-5">
        <div className="flex min-h-0 w-full flex-1 items-center justify-center" style={{ maxHeight: 262 }}>
          <AnalogClock size={262} tint="var(--screen-tint)" />
        </div>
        <div className="flex shrink-0 flex-col items-center gap-2 text-center leading-tight">
          <div>
            <div className="text-[16px] font-semibold tracking-[-0.01em]">
              {now ? now.toLocaleDateString("tr-TR", { day: "numeric", month: "long" }) : " "}
            </div>
            <div className="mt-0.5 text-[13px] text-dim">
              {now ? now.toLocaleDateString("tr-TR", { weekday: "long" }) : " "}
            </div>
          </div>
          <InfraComplication data={infra.data} />
        </div>
      </Module>
    </div>
  );
}
