"use client";

import { useScreens } from "@/lib/config/ConfigContext";

/**
 * CarPlay tarzı uygulama menüsü: pager'ın üstünde açılan katman, ortada büyük
 * squircle ikonlar. Açılışta karolar 30 ms arayla yaylanarak belirir; kapanış
 * hızlı bir solma. Mevcut ekran vurgulu; bir karoya dokunmak ekrana gidip menüyü kapatır.
 */
export default function AppMenu({
  open,
  openCount,
  index,
  onSelect,
  onClose,
}: {
  open: boolean;
  /** Her açılışta artar — ızgara yeniden monte edilip stagger animasyonu tekrar oynar */
  openCount: number;
  index: number;
  onSelect: (i: number) => void;
  onClose: () => void;
}) {
  const SCREENS = useScreens();
  return (
    <div
      aria-hidden={!open}
      className={`absolute inset-0 z-10 flex items-center justify-center ${
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
      style={{
        background: "color-mix(in srgb, var(--color-night) 92%, transparent)",
        transition: `opacity ${open ? 220 : 160}ms var(--ease-out-strong)`,
      }}
      onClick={onClose}
    >
      <div key={openCount} className="flex items-start gap-8" onClick={(e) => e.stopPropagation()}>
        {SCREENS.map((s, i) => {
          const active = i === index;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(i)}
              className="flex w-[128px] flex-col items-center gap-3 transition-transform duration-100 [transition-timing-function:var(--ease-out-strong)] active:scale-[0.94]"
              style={open ? { animation: `menu-tile-in 360ms var(--ease-out-strong) ${i * 30}ms both` } : undefined}
            >
              <span
                className="flex h-[108px] w-[108px] items-center justify-center rounded-[30px]"
                style={{
                  background: `color-mix(in srgb, ${s.tint} ${active ? 30 : 16}%, transparent)`,
                  boxShadow: active
                    ? `inset 0 0 0 2px color-mix(in srgb, ${s.tint} 55%, transparent)`
                    : "inset 0 2px 0 var(--card-highlight)",
                  color: s.tint,
                }}
              >
                <s.icon size={56} active={active} />
              </span>
              <span
                className="text-[15px] font-semibold leading-tight"
                style={{ color: active ? "var(--color-ink)" : "var(--color-dim)" }}
              >
                {s.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
