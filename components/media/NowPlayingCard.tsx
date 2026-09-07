"use client";

import { AudioLines, Minus, Music2, Pause, Play, Plus, SkipBack, SkipForward } from "lucide-react";
import { ScrubBar } from "@/components/media/ScrubBar";
import { Card } from "@/components/ui/Card";
import { TactileButton } from "@/components/ui/TactileButton";
import type { MediaActions, MediaSource, MediaState } from "@/lib/types/media";

const sourceLabels: Record<MediaSource, string> = {
  spotify: "Spotify",
  music: "Apple Music",
  browser: "Tarayıcı",
  mpv: "mpv",
  system: "Sistem",
};

/** Ses adımı — Apple'ın klavye adımına yakın, dokunmatikte rahat */
const VOLUME_STEP = 5;

/**
 * "Şu an çalıyor" kartı — Genel Bakış'ta müzik algılanınca takvimin yerini alır.
 * Tam genişlik dokunsal kontroller: transport satırı (−10 · önceki · oynat ·
 * sonraki · +10) ve altında ses satırı (kıs · %yüzde · aç, basılı tutunca tekrar).
 */
export function NowPlayingCard({
  data,
  stale,
  actions,
}: {
  data: MediaState;
  stale: boolean;
  actions: MediaActions;
}) {
  const track = data.track;
  if (!track) return null;

  const vol = data.volume;
  const volumeDown = () => actions.adjustVolume(-VOLUME_STEP);
  const volumeUp = () => actions.adjustVolume(VOLUME_STEP);

  return (
    <Card
      className="animate-card-in relative overflow-hidden"
      title="Şu an çalıyor"
      right={
        stale ? (
          <span className="flex items-center gap-1.5 text-[12px] text-dim">
            <span className="h-2 w-2 rounded-full bg-warn" /> Bağlantı yok
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-dim">
            <AudioLines size={13} style={{ color: "var(--color-pink)" }} />
            {sourceLabels[data.source]}
          </span>
        )
      }
    >
      {/* Kapak renginden parıltı — kart kimliği parçayla değişir */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(520px 260px at 0% 0%, color-mix(in srgb, ${track.artColors[1]} 26%, transparent), transparent 70%)`,
        }}
      />

      <div className="relative flex min-h-0 flex-1 flex-col justify-between gap-2.5">
        {/* Kapak + parça */}
        <div className="flex items-center gap-4">
          <div
            className="flex h-[92px] w-[92px] shrink-0 items-center justify-center overflow-hidden rounded-[16px]"
            style={{
              background: `linear-gradient(135deg, ${track.artColors[0]}, ${track.artColors[1]})`,
              boxShadow: `0 14px 40px -14px ${track.artColors[1]}aa`,
            }}
          >
            {track.artworkUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- rastgele dış kaynak
              <img src={track.artworkUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              <Music2 size={36} strokeWidth={1.25} className="text-ink opacity-30" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-[20px] font-semibold leading-tight tracking-[-0.01em]">
              {track.title}
            </div>
            <div className="mt-0.5 truncate text-[14px] text-dim">
              {track.artist}
              {track.album ? ` · ${track.album}` : ""}
            </div>
          </div>
        </div>

        <ScrubBar state={data} onSeek={actions.seekTo} />

        {/* Transport — tam genişlik, 5 eşit dokunsal düğme */}
        <div className="grid grid-cols-5 gap-2.5">
          <TactileButton
            onPress={() => actions.seekBy(-10)}
            ariaLabel="10 saniye geri"
            className="h-[58px] rounded-2xl text-[15px] font-semibold tabular-nums text-dim"
          >
            −10
          </TactileButton>
          <TactileButton onPress={actions.prev} ariaLabel="Önceki parça" className="h-[58px] rounded-2xl">
            <SkipBack size={26} fill="currentColor" strokeWidth={0} />
          </TactileButton>
          <TactileButton
            onPress={actions.togglePlay}
            variant="solid"
            ariaLabel={data.playing ? "Duraklat" : "Oynat"}
            className="h-[58px] rounded-2xl"
          >
            {data.playing ? (
              <Pause size={28} fill="currentColor" strokeWidth={0} />
            ) : (
              <Play size={28} fill="currentColor" strokeWidth={0} className="ml-0.5" />
            )}
          </TactileButton>
          <TactileButton onPress={actions.next} ariaLabel="Sonraki parça" className="h-[58px] rounded-2xl">
            <SkipForward size={26} fill="currentColor" strokeWidth={0} />
          </TactileButton>
          <TactileButton
            onPress={() => actions.seekBy(10)}
            ariaLabel="10 saniye ileri"
            className="h-[58px] rounded-2xl text-[15px] font-semibold tabular-nums text-dim"
          >
            +10
          </TactileButton>
        </div>

        {/* Ses — kıs · yüzde · aç; basılı tutunca tekrarlar */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
          <TactileButton
            onPress={volumeDown}
            onHold={volumeDown}
            disabled={vol === null}
            ariaLabel="Sesi kıs"
            className="h-[50px] rounded-2xl text-dim"
          >
            <Minus size={22} strokeWidth={2.5} />
          </TactileButton>
          <div className="flex w-[104px] flex-col items-center leading-none">
            <span className="text-[22px] font-semibold tabular-nums">
              {vol === null ? "—" : `%${vol}`}
            </span>
            <span className="mt-1 text-[11px] font-medium text-faint">
              {vol === null ? "ses kontrolü yok" : "ses"}
            </span>
          </div>
          <TactileButton
            onPress={volumeUp}
            onHold={volumeUp}
            disabled={vol === null}
            ariaLabel="Sesi aç"
            className="h-[50px] rounded-2xl text-dim"
          >
            <Plus size={22} strokeWidth={2.5} />
          </TactileButton>
        </div>
      </div>
    </Card>
  );
}
