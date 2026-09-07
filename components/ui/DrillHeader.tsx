"use client";

import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

export interface Crumb {
  label: string;
  /** Verilirse kırıntıya dokunmak o seviyeye döner */
  onTap?: () => void;
}

/**
 * Hiyerarşik ekranların ortak başlığı — standart: geri düğmesi + kırıntı yolu.
 * Son kırıntı bulunulan yer (vurgulu), öncekiler dokunulabilir.
 */
export function DrillHeader({
  crumbs,
  onBack,
  right,
}: {
  crumbs: Crumb[];
  onBack: () => void;
  right?: ReactNode;
}) {
  return (
    <header className="mb-3 flex h-11 shrink-0 items-center gap-2">
      <button
        onClick={onBack}
        aria-label="Geri"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-raised text-dim transition-transform duration-100 [transition-timing-function:var(--ease-out-strong)] active:scale-90"
      >
        <ChevronLeft size={20} strokeWidth={2.25} />
      </button>
      <nav className="flex min-w-0 items-center gap-1.5 text-[15px]">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <span key={i} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <span className="text-faint">›</span>}
              {last || !c.onTap ? (
                <span className={`truncate ${last ? "font-semibold" : "text-dim"}`}>{c.label}</span>
              ) : (
                <button onClick={c.onTap} className="truncate text-dim active:text-ink">
                  {c.label}
                </button>
              )}
            </span>
          );
        })}
      </nav>
      {right && <span className="ml-auto flex shrink-0 items-center gap-3">{right}</span>}
    </header>
  );
}
