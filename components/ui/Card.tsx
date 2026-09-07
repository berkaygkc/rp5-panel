import type { ReactNode } from "react";

/**
 * Temel yüzey — cam hissi veren modern kart: yukarıdan aşağı incelen
 * gradyan + üst kenarda ışık yakalayan iç vurgu (blur yok, statik boyama).
 * Kart layout-agnostic'tir: parent'ın verdiği alanı doldurur.
 */
export function Card({
  title,
  right,
  className = "",
  compact = false,
  children,
}: {
  title?: string;
  right?: ReactNode;
  className?: string;
  /** Daha sıkı iç boşluk (yükseklik kısıtlı kartlar) */
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex min-h-0 min-w-0 flex-col rounded-[26px] ${compact ? "p-4" : "p-5"} ${className}`}
      style={{
        background:
          "linear-gradient(180deg, var(--card-top), var(--card-bottom))",
        boxShadow:
          "inset 0 2px 0 var(--card-highlight), inset 0 0 0 1px var(--card-ring), var(--card-shadow)",
      }}
    >
      {title && (
        <header className="mb-3 flex shrink-0 items-baseline justify-between gap-3">
          <h2 className="text-[13.5px] font-medium text-dim">{title}</h2>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}
