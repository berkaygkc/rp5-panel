"use client";

import { Mail, Music2, Sparkles } from "lucide-react";
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

const TINT = "var(--color-blue)";

/**
 * Genel Bakış: sağda saat (imza), solda müzik algılandığında çalar kartı.
 * Yalnızca gerçek veri — müzik yoksa sessiz bir boş durum.
 */
export default function OverviewScreen() {
  const media = useMedia();
  const mail = useMail();
  const claude = useClaude({ feed: false });
  const infra = useInfra();
  const now = useNow(1000);

  // Dört sabit yuva: Medya · Claude · Posta · Saat. Boş yuva sessiz bir karo — ritim bozulmaz.
  const unread = mail.data.accounts.reduce((sum, a) => sum + a.unread, 0);
  const liveClaude = claude.data.sessions.some((s) => s.status !== "closed");

  return (
    <div
      className="grid h-full grid-cols-4 gap-4 p-5"
      style={{
        background: `radial-gradient(900px 320px at 80% -12%, color-mix(in srgb, ${TINT} 9%, transparent), transparent 60%)`,
      }}
    >
      {/* 1 — Medya */}
      {media.data.track ? (
        <NowPlayingCard data={media.data} stale={media.stale} actions={media.actions} />
      ) : (
        <EmptyTile
          icon={<Music2 size={20} strokeWidth={1.75} />}
          title={media.stale ? "Mac ajanına bağlanılamadı" : "Şu an çalan yok"}
          sub={media.stale ? "clients/mac-agent çalışıyor mu?" : "Mac'te müzik başlayınca çalar burada"}
          tint="var(--color-blue)"
        />
      )}

      {/* 2 — Claude */}
      {liveClaude ? (
        <LiveSessionsCard sessions={claude.data.sessions} usage={claude.data.usage} now={now?.getTime() ?? 0} />
      ) : (
        <EmptyTile
          icon={<Sparkles size={20} strokeWidth={1.75} />}
          title="Canlı Claude oturumu yok"
          sub="Oturum açılınca burada görünür"
          screen="claude"
          tint="var(--color-terracotta)"
        />
      )}

      {/* 3 — Posta */}
      {unread > 0 ? (
        <UnreadSummaryCard accounts={mail.data.accounts} messages={mail.data.messages} now={now?.getTime() ?? 0} />
      ) : (
        <EmptyTile
          icon={<Mail size={20} strokeWidth={1.75} />}
          title="Gelen kutusu temiz"
          sub={mail.stale ? "Posta verisi bekleniyor" : "Okunmamış posta yok"}
          screen="mail"
          tint="var(--color-indigo)"
        />
      )}

      {/* 4 — Saat */}
      {/* İmza öğesi: yüksek saatçilik kadranı — alan daralırsa kadran küçülür, tarih kalır */}
      <div className="flex min-h-0 flex-col items-center justify-center gap-3">
        <div className="flex min-h-0 w-full flex-1 items-center justify-center" style={{ maxHeight: 288 }}>
          <AnalogClock size={288} tint={TINT} />
        </div>
        <div className="flex shrink-0 flex-col items-center gap-2 text-center leading-tight">
          <div>
            <div className="text-[17px] font-semibold">
              {now ? now.toLocaleDateString("tr-TR", { day: "numeric", month: "long" }) : " "}
            </div>
            <div className="mt-0.5 text-[15px] text-dim">
              {now ? now.toLocaleDateString("tr-TR", { weekday: "long" }) : " "}
            </div>
          </div>
          {/* Kadran altı komplikasyon: altyapı özeti */}
          <InfraComplication data={infra.data} />
        </div>
      </div>
    </div>
  );
}
