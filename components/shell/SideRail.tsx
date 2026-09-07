"use client";

import { Lock } from "lucide-react";
import { MenuIcon } from "@/components/icons/RailIcons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useNow } from "@/lib/data/useNow";
import { useScreens } from "@/lib/config/ConfigContext";
import { RAIL_WIDTH } from "@/lib/config";

/** Dock satır yüksekliği; gösterge de bu adımla kayar */
const SLOT = 54;

/**
 * Omurga: cihazın sabit sol kenarı.
 *
 * Üstte saat — panelin en çok bakılan öğesi, bu yüzden en büyük tipografi ve
 * altında dakikayı dolduran saç teli bir saniye ibresi. Ortada dock: dört
 * hedef, etiket yok; hangisinde olduğunuzu kayan tint göstergesi ve dockun
 * altındaki tek satırlık ad söyler. Altta tema ve kilit.
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
  const tiles = [0, ...recentIdx];
  const activeRow = menuOpen ? tiles.length : tiles.indexOf(index);
  const label = menuOpen ? "Menü" : (SCREENS[index]?.title ?? "");
  const seconds = now ? now.getSeconds() + now.getMilliseconds() / 1000 : 0;

  const slotClass =
    "relative flex items-center justify-center transition-transform duration-100 [transition-timing-function:var(--ease-out-strong)] active:scale-90";

  return (
    <nav className="flex h-full shrink-0 flex-col items-center px-3 py-3.5" style={{ width: RAIL_WIDTH }}>
      {/* Saat — imza öğe: sıkı tracking, tabular, altında dakikayı dolduran ibre */}
      <div className="w-full px-1 text-center leading-none">
        <div className="font-clock text-[54px] font-medium tabular-nums tracking-[-0.045em]">
          {now ? now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
        </div>
        <div className="seconds-track mt-2.5">
          <div
            className="seconds-fill"
            style={{
              transform: `scaleX(${seconds / 60})`,
              transition: seconds < 1 ? "none" : undefined,
            }}
          />
        </div>
        <div className="mt-2 text-[12px] font-medium leading-tight text-dim">
          {now ? now.toLocaleDateString("tr-TR", { day: "numeric", month: "long" }) : " "}
        </div>
      </div>

      {/* Dock — tek gövde, kayan seçim göstergesi */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2.5">
        <div
          className="surface-shell relative rounded-[24px] p-1.5"
          style={{ ["--dock-slot" as string]: `${SLOT}px` }}
        >
          {activeRow >= 0 && (
            <span
              aria-hidden
              className="dock-indicator"
              style={{
                top: 6,
                transform: `translateY(${activeRow * SLOT}px)`,
                background: menuOpen ? "var(--color-raised)" : undefined,
                boxShadow: menuOpen ? "inset 0 0 0 1px var(--card-ring)" : undefined,
              }}
            />
          )}

          {tiles.map((i) => {
            const s = SCREENS[i];
            const active = i === index && !menuOpen;
            return (
              <button
                key={s.id}
                onClick={() => onSelect(i)}
                aria-label={s.title}
                aria-current={active ? "page" : undefined}
                className={slotClass}
                style={{
                  width: SLOT,
                  height: SLOT,
                  color: active ? "var(--color-ink)" : "var(--color-dim)",
                }}
              >
                <s.icon size={27} active={active} />
              </button>
            );
          })}

          <button
            onClick={onMenu}
            aria-label="Menü"
            aria-expanded={menuOpen}
            className={slotClass}
            style={{ width: SLOT, height: SLOT, color: menuOpen ? "var(--color-ink)" : "var(--color-dim)" }}
          >
            <MenuIcon size={27} active={menuOpen} />
          </button>
        </div>

        {/* Tek satırlık ad: dört etiket yerine bulunulan yeri söyleyen tek etiket */}
        <div className="h-4 text-[12.5px] font-medium leading-none text-dim">{label}</div>
      </div>

      {/* Tema ve kilit */}
      <div className="flex shrink-0 gap-2">
        <ThemeToggle />
        <button
          onClick={onLock}
          aria-label="Paneli kilitle"
          className="surface-quiet flex h-11 w-11 items-center justify-center rounded-full text-dim transition-[transform,background-color] duration-100 [transition-timing-function:var(--ease-out-strong)] active:scale-90 active:bg-pressed"
          style={{ boxShadow: "inset 0 0 0 1px var(--card-ring)" }}
        >
          <Lock size={19} strokeWidth={2} />
        </button>
      </div>
    </nav>
  );
}
