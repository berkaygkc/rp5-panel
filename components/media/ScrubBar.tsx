"use client";

import { useEffect, useRef } from "react";
import { playbackPosition } from "@/lib/data/useMedia";
import { fmtTime } from "@/lib/format";
import type { MediaState } from "@/lib/types/media";

/**
 * Dokunarak sürüklenebilir scrub bar. Görsel bar ince, dokunma alanı 56px.
 * İlerleme her karede requestAnimationFrame ile ref'ler üzerinden çizilir —
 * React render'ı tetiklenmez, saniyede bir zıplama olmaz.
 * Sürüklerken konum optimistic olarak parmağı takip eder.
 */
export function ScrubBar({
  state,
  onSeek,
}: {
  state: MediaState;
  onSeek: (sec: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLSpanElement>(null);
  const dragSec = useRef<number | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const s = stateRef.current;
      const pos = dragSec.current ?? playbackPosition(s);
      const ratio = pos / (s.track?.durationSec || 1);
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${ratio})`;
      if (thumbRef.current && barRef.current) {
        const w = barRef.current.clientWidth;
        thumbRef.current.style.transform = `translate(${ratio * w}px, -50%)`;
      }
      if (currentRef.current) currentRef.current.textContent = fmtTime(pos);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const secFromEvent = (clientX: number) => {
    const rect = barRef.current!.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * (stateRef.current.track?.durationSec ?? 0);
  };

  return (
    <div className="flex items-center gap-4">
      <span ref={currentRef} className="w-12 shrink-0 text-[13px] font-medium tabular-nums text-dim" />
      <div
        data-no-swipe
        className="flex h-14 flex-1 cursor-pointer items-center"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragSec.current = secFromEvent(e.clientX);
        }}
        onPointerMove={(e) => {
          if (dragSec.current !== null) dragSec.current = secFromEvent(e.clientX);
        }}
        onPointerUp={(e) => {
          if (dragSec.current === null) return;
          onSeek(dragSec.current);
          // State güncellenene kadar optimistic konumu koru, geri sıçramasın
          setTimeout(() => (dragSec.current = null), 120);
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
      >
        <div ref={barRef} className="relative h-[5px] w-full rounded-full bg-raised">
          <div
            ref={fillRef}
            className="absolute inset-0 origin-left rounded-full bg-ink"
            style={{ transform: "scaleX(0)" }}
          />
          <div
            ref={thumbRef}
            className="absolute -left-2 top-1/2 h-4 w-4 rounded-full bg-ink"
            style={{ transform: "translate(0, -50%)" }}
          />
        </div>
      </div>
      <span className="w-12 shrink-0 text-right text-[13px] font-medium tabular-nums text-dim">
        {fmtTime(state.track?.durationSec ?? 0)}
      </span>
    </div>
  );
}
