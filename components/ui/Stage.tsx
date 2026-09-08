"use client";

import type { ReactNode } from "react";

/**
 * Sahne — şeridin içerik alanı.
 *
 * Ekranlar kutulardan değil, bir ufuk boyunca dizilmiş modüllerden kurulur.
 * Sütunlar açıkça verilir; modüller açılışta 40 ms arayla sırayla belirir.
 */
export function Stage({ cols, className = "", children }: { cols: string; className?: string; children: ReactNode }) {
  return (
    <div className={`stage-in grid h-full p-5 ${className}`} style={{ gridTemplateColumns: cols }}>
      {children}
    </div>
  );
}

/**
 * Açık modül: kendi yüzeyi yoktur, alanın üstünde durur ve komşusundan yalnızca
 * saç teli bir çizgiyle ayrılır. Yüzeyi (Card) ekrandaki tek kahraman modüle
 * ayırın; hiyerarşi böyle kurulur.
 */
export function Module({
  title,
  right,
  divider = true,
  className = "",
  children,
}: {
  title?: string;
  right?: ReactNode;
  /** Solunda saç teli ayraç (şeridin ilk modülünde kapatın) */
  divider?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex min-h-0 min-w-0 flex-col ${className}`}
      style={divider ? { borderLeft: "1px solid var(--hairline)" } : undefined}
    >
      {(title || right) && (
        <header className="mb-3 flex h-6 shrink-0 items-center justify-between gap-3">
          {title && <h2 className="text-[12.5px] font-medium leading-none tracking-[0.01em] text-dim">{title}</h2>}
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

/** Modülün şeritteki konumuna göre iç boşluk: uçlarda tek yön, ortada iki yön */
export const modulePad = (i: number, count: number) =>
  count === 1 ? "" : i === 0 ? "pr-5" : i === count - 1 ? "pl-5" : "px-5";
