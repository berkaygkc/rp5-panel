"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/** Bir dokunuşta kayılacak mesafe (px) */
const STEP = 132;
/** Bu mesafeden yakınsa "dipte" sayılır (geç gelen içerik payı) */
const BOTTOM_SLACK = 64;

/**
 * Dokunmatik kaydırma alanı: parmakla sürüklenebilir (touch-action: pan-y —
 * body genelinde kaydırma kapalı olduğu için burada açıkça açılır) ve sağ
 * kenarda yukarı/aşağı düğmeleriyle kademeli kaydırma sunar.
 * Düğmeler yalnızca o yönde kaydırılacak içerik varken görünür.
 */
export function ScrollArea({
  className = "",
  stickToBottom = false,
  bottomKey,
  children,
}: {
  className?: string;
  /** Yeni içerik geldiğinde, kullanıcı zaten alttaysa alta yapış (canlı akış) */
  stickToBottom?: boolean;
  /** Değeri değişince kaydırma koşulsuz dibe alınır (ör. seçili oturum değişti) */
  bottomKey?: string | null;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canUp, setCanUp] = useState(false);
  const [canDown, setCanDown] = useState(false);
  const atBottom = useRef(true);
  const prevKey = useRef(bottomKey);

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const bottomGap = el.scrollHeight - el.scrollTop - el.clientHeight;
    setCanUp(el.scrollTop > 4);
    setCanDown(bottomGap > 4);
  }, []);

  /**
   * Dibe yapışma kararı YALNIZCA gerçek kaydırma olayında güncellenir.
   * (Boyut gözlemcisinde güncellenirse, içerik büyüdüğü anda "kullanıcı yukarıda"
   * sanılıp yapışma düşer — yeni gelen akış dipte kalmaz.)
   */
  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_SLACK;
    sync();
  }, [sync]);

  /** Dibe git; içerik geç yerleştiğinde eksik kalmasın diye bir kare sonra tekrarla */
  const toBottom = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => {
      const late = ref.current;
      if (late) late.scrollTop = late.scrollHeight;
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Anahtar değiştiyse (yeni oturum) en güncel içerik dipte olduğu için oraya git
    const keyChanged = prevKey.current !== bottomKey;
    prevKey.current = bottomKey;
    if (stickToBottom && (keyChanged || atBottom.current)) {
      atBottom.current = true;
      toBottom();
    }
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [sync, toBottom, children, stickToBottom, bottomKey]);

  const step = (dir: 1 | -1) => ref.current?.scrollBy({ top: dir * STEP, behavior: "smooth" });

  const arrow =
    "absolute right-0 z-10 flex h-7 w-7 items-center justify-center rounded-full text-dim transition-[transform,opacity] duration-150 [transition-timing-function:var(--ease-out-strong)] active:scale-90";

  return (
    <div className={`relative min-h-0 flex-1 ${className}`}>
      <div
        ref={ref}
        onScroll={onScroll}
        className="scroll-area h-full overflow-y-auto pr-9"
        style={{ touchAction: "pan-y", overscrollBehavior: "contain" }}
      >
        {children}
      </div>

      <button
        onClick={() => step(-1)}
        aria-label="Yukarı kaydır"
        tabIndex={canUp ? 0 : -1}
        className={`${arrow} top-0`}
        style={{
          background: "var(--color-raised)",
          opacity: canUp ? 1 : 0,
          pointerEvents: canUp ? "auto" : "none",
        }}
      >
        <ChevronUp size={16} strokeWidth={2.5} />
      </button>
      <button
        onClick={() => step(1)}
        aria-label="Aşağı kaydır"
        tabIndex={canDown ? 0 : -1}
        className={`${arrow} bottom-0`}
        style={{
          background: "var(--color-raised)",
          opacity: canDown ? 1 : 0,
          pointerEvents: canDown ? "auto" : "none",
        }}
      >
        <ChevronDown size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
}
