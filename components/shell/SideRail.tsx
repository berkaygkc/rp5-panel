"use client";

import { Lock } from "lucide-react";
import { MenuIcon } from "@/components/icons/RailIcons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useNow } from "@/lib/data/useNow";
import { useScreens } from "@/lib/config/ConfigContext";

/**
 * CarPlay tarzı sol rail: üstte saat + tarih; 2×2 karo — Genel Bakış,
 * son girilen iki ekran ve Menü; altta tema anahtarı ve kilit.
 */
export default function SideRail({
  index,
  recents,
  menuOpen,
  onSelect,
  onMenu,
  onLock,
}: {
  index: number;
  /** Son ziyaret edilen ekran kimlikleri (en yeni önce) */
  recents: string[];
  menuOpen: boolean;
  onSelect: (i: number) => void;
  onMenu: () => void;
  onLock: () => void;
}) {
  const SCREENS = useScreens();
  const now = useNow(1000);

  const recentIdx = recents
    .map((id) => SCREENS.findIndex((s) => s.id === id))
    .filter((i) => i > 0)
    .slice(0, 2);
  const screenTiles = [0, ...recentIdx];

  const tileClass =
    "flex h-[90px] w-[94px] flex-col items-center justify-center gap-1.5 rounded-2xl transition-[transform,background-color] duration-100 [transition-timing-function:var(--ease-out-strong)] active:scale-95";

  return (
    <nav className="flex h-full w-52 shrink-0 flex-col items-center px-3 py-4">
      {/* Saat + tarih birlikte, üstte */}
      <div className="text-center leading-none">
        <div className="font-clock text-[40px] font-medium tracking-[-0.01em] tabular-nums">
          {now
            ? now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
            : "--:--"}
        </div>
        <div className="mt-1.5 text-[12px] font-medium leading-tight text-dim">
          {now
            ? now.toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" })
            : " "}
        </div>
      </div>

      {/* Karolar kalan alanda ortalanır */}
      <div className="flex min-h-0 flex-1 items-center">
        <div className="grid w-full grid-cols-2 gap-2">
          {screenTiles.map((i) => {
            const s = SCREENS[i];
            const active = i === index && !menuOpen;
            return (
              <button
                key={s.id}
                onClick={() => onSelect(i)}
                aria-label={s.title}
                aria-current={active ? "page" : undefined}
                className={tileClass}
                style={{
                  background: active
                    ? `color-mix(in srgb, ${s.tint} 15%, transparent)`
                    : undefined,
                  color: s.tint,
                  opacity: active ? 1 : 0.55,
                }}
              >
                <s.icon size={28} active={active} />
                <span
                  className="max-w-full truncate px-1 text-[11px] font-medium leading-tight"
                  style={{ color: active ? "var(--color-ink)" : "var(--color-dim)" }}
                >
                  {s.title}
                </span>
              </button>
            );
          })}

          {/* Menü — tüm ekranların büyük ızgarası */}
          <button
            onClick={onMenu}
            aria-label="Menü"
            aria-expanded={menuOpen}
            className={`${tileClass} ${menuOpen ? "bg-raised" : ""}`}
            style={{ color: menuOpen ? "var(--color-ink)" : "var(--color-dim)" }}
          >
            <MenuIcon size={28} active={menuOpen} />
            <span
              className="text-[11px] font-medium leading-tight"
              style={{ color: menuOpen ? "var(--color-ink)" : "var(--color-dim)" }}
            >
              Menü
            </span>
          </button>
        </div>
      </div>

      {/* Tema anahtarı + kilit — rail'in altında, her ekrandan erişilir */}
      <div className="mt-1 flex shrink-0 gap-2">
        <ThemeToggle />
        <button
          onClick={onLock}
          aria-label="Paneli kilitle"
          className="flex h-12 w-12 items-center justify-center rounded-full text-dim transition-[transform,background-color] duration-100 [transition-timing-function:var(--ease-out-strong)] active:scale-90 active:bg-pressed"
          style={{
            background: "linear-gradient(180deg, var(--card-top), var(--card-bottom))",
            boxShadow: "inset 0 2px 0 var(--card-highlight), inset 0 0 0 1px var(--card-ring)",
          }}
        >
          <Lock size={20} strokeWidth={2} />
        </button>
      </div>
    </nav>
  );
}
