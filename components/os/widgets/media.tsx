"use client";

import { Music2, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { ScrubBar } from "@/components/media/ScrubBar";
import { TactileButton } from "@/components/ui/TactileButton";
import { Metric, Tile, TileHead } from "@/components/os/parts";
import { useMedia } from "@/lib/data/useMedia";
import type { WidgetProps } from "@/lib/os/types";

const TINT = "var(--color-blue)";

/** Kapak: gerçek görsel yoksa parçadan türeyen renkli bir yüzey */
function Art({ size, url, colors }: { size: number; url: string | null; colors: [string, string] }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--r-md)]"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
        boxShadow: `0 12px 32px -16px ${colors[1]}`,
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- rastgele dış kaynak
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <Music2 size={Math.round(size * 0.34)} strokeWidth={1.25} className="text-ink opacity-30" />
      )}
    </span>
  );
}

/**
 * Şu an çalıyor.
 * 2x2 tam kontrol, 2x1 parça ve geçiş, 1x1 yalnızca ne çaldığı ve durdur/oynat.
 */
export function NowPlayingWidget({ size }: WidgetProps) {
  const { data, actions } = useMedia();
  const track = data.track;
  if (!track) return null;

  const playPause = (
    <TactileButton
      onPress={actions.togglePlay}
      variant="solid"
      ariaLabel={data.playing ? "Duraklat" : "Oynat"}
      className={size === "2x2" ? "h-[52px] rounded-2xl" : "h-10 w-10 rounded-full"}
    >
      {data.playing ? (
        <Pause size={size === "2x2" ? 24 : 18} fill="currentColor" strokeWidth={0} />
      ) : (
        <Play size={size === "2x2" ? 24 : 18} fill="currentColor" strokeWidth={0} className="ml-0.5" />
      )}
    </TactileButton>
  );

  if (size === "1x1") {
    return (
      <Tile tint={TINT} screen="overview" interactive={false}>
        <TileHead icon={Music2} title="Şu an çalıyor" tint={TINT} />
        <div className="flex min-h-0 flex-1 items-center gap-3">
          <Art size={52} url={track.artworkUrl ?? null} colors={track.artColors} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold leading-tight">{track.title}</span>
            <span className="mt-0.5 block truncate text-[11.5px] text-dim">{track.artist}</span>
          </span>
          {playPause}
        </div>
      </Tile>
    );
  }

  if (size === "2x1") {
    return (
      <Tile tint={TINT} interactive={false}>
        <div className="flex min-h-0 flex-1 items-center gap-3.5">
          <Art size={62} url={track.artworkUrl ?? null} colors={track.artColors} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold leading-tight tracking-[-0.01em]">{track.title}</span>
            <span className="mt-0.5 block truncate text-[12px] text-dim">{track.artist}</span>
            <span className="mt-2 block"><ScrubBar state={data} onSeek={actions.seekTo} /></span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <TactileButton onPress={actions.prev} ariaLabel="Önceki" className="h-10 w-10 rounded-full">
              <SkipBack size={16} fill="currentColor" strokeWidth={0} />
            </TactileButton>
            {playPause}
            <TactileButton onPress={actions.next} ariaLabel="Sonraki" className="h-10 w-10 rounded-full">
              <SkipForward size={16} fill="currentColor" strokeWidth={0} />
            </TactileButton>
          </span>
        </div>
      </Tile>
    );
  }

  return (
    <Tile tint={TINT} interactive={false}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(420px 220px at 0% 0%, color-mix(in srgb, ${track.artColors[1]} 22%, transparent), transparent 70%)` }}
      />
      <div className="relative flex min-h-0 flex-1 flex-col justify-between gap-3">
        <div className="flex items-center gap-4">
          <Art size={92} url={track.artworkUrl ?? null} colors={track.artColors} />
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-[20px] font-semibold leading-tight tracking-[-0.02em]">{track.title}</div>
            <div className="mt-1 truncate text-[13px] text-dim">
              {track.artist}
              {track.album ? ` · ${track.album}` : ""}
            </div>
          </div>
        </div>
        <ScrubBar state={data} onSeek={actions.seekTo} />
        <div className="grid grid-cols-5 gap-2">
          <TactileButton onPress={() => actions.seekBy(-10)} ariaLabel="10 saniye geri" className="h-[52px] rounded-2xl text-[14px] font-semibold tabular-nums text-dim">−10</TactileButton>
          <TactileButton onPress={actions.prev} ariaLabel="Önceki parça" className="h-[52px] rounded-2xl">
            <SkipBack size={22} fill="currentColor" strokeWidth={0} />
          </TactileButton>
          {playPause}
          <TactileButton onPress={actions.next} ariaLabel="Sonraki parça" className="h-[52px] rounded-2xl">
            <SkipForward size={22} fill="currentColor" strokeWidth={0} />
          </TactileButton>
          <TactileButton onPress={() => actions.seekBy(10)} ariaLabel="10 saniye ileri" className="h-[52px] rounded-2xl text-[14px] font-semibold tabular-nums text-dim">+10</TactileButton>
        </div>
      </div>
    </Tile>
  );
}

export { Metric };
