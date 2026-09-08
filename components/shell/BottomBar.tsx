"use client";

import { Lock } from "lucide-react";
import { MenuIcon } from "@/components/icons/RailIcons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useScreens } from "@/lib/config/ConfigContext";

/**
 * Dar yüzeylerde gezinme: omurga yatar, alt bara döner.
 * Aynı hedefler, aynı seçim göstergesi mantığı — yalnızca eksen değişir.
 */
export default function BottomBar({
  index,
  recents,
  menuOpen,
  onSelect,
  onMenu,
  onLock,
  className = "",
}: {
  index: number;
  recents: string[];
  menuOpen: boolean;
  onSelect: (i: number) => void;
  onMenu: () => void;
  onLock: () => void;
  className?: string;
}) {
  const SCREENS = useScreens();
  const recentIdx = recents
    .map((id) => SCREENS.findIndex((s) => s.id === id))
    .filter((i) => i > 0)
    .slice(0, 2);
  const tiles = [0, ...recentIdx];

  const slot =
    "flex h-12 w-12 items-center justify-center rounded-[16px] transition-[transform,background-color] duration-100 [transition-timing-function:var(--ease-out-strong)] active:scale-90";

  return (
    <nav className={`shrink-0 px-4 pb-4 pt-2 ${className}`}>
      <div className="surface-shell flex items-center justify-between gap-1 rounded-[22px] p-1.5">
        {tiles.map((i) => {
          const s = SCREENS[i];
          const active = i === index && !menuOpen;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(i)}
              aria-label={s.title}
              aria-current={active ? "page" : undefined}
              className={slot}
              style={{
                background: active ? `color-mix(in srgb, ${s.tint} 22%, transparent)` : undefined,
                boxShadow: active ? `inset 0 0 0 1px color-mix(in srgb, ${s.tint} 30%, transparent)` : undefined,
                color: active ? "var(--color-ink)" : "var(--color-dim)",
              }}
            >
              <s.icon size={24} active={active} />
            </button>
          );
        })}
        <button
          onClick={onMenu}
          aria-label="Menü"
          aria-expanded={menuOpen}
          className={slot}
          style={{
            background: menuOpen ? "var(--color-raised)" : undefined,
            color: menuOpen ? "var(--color-ink)" : "var(--color-dim)",
          }}
        >
          <MenuIcon size={24} active={menuOpen} />
        </button>
        <span className="mx-1 h-7 w-px shrink-0" style={{ background: "var(--hairline)" }} />
        <ThemeToggle className="!h-11 !w-11" />
        <button
          onClick={onLock}
          aria-label="Paneli kilitle"
          className="surface-quiet flex h-11 w-11 items-center justify-center rounded-full text-dim transition-transform duration-100 [transition-timing-function:var(--ease-out-strong)] active:scale-90"
          style={{ boxShadow: "inset 0 0 0 1px var(--card-ring)" }}
        >
          <Lock size={18} strokeWidth={2} />
        </button>
      </div>
    </nav>
  );
}
