"use client";

import type { ReactNode } from "react";

/**
 * Halka gösterge — Apple Watch halkalarının mantığı: dolduğu kadarı renkli,
 * kalanı sessiz bir iz. Yüzde metin olarak da yazılır; halka onu tekrarlamaz,
 * bir bakışta okunmasını sağlar.
 *
 * stroke-dashoffset geçişi tek ve küçük bir öğede çalışır; sayfa düzenini
 * etkilemez, bu yüzden Pi'de de ucuzdur.
 */
export function Gauge({
  percent,
  size = 120,
  thickness = 10,
  color,
  children,
}: {
  percent: number;
  size?: number;
  thickness?: number;
  color: string;
  children?: ReactNode;
}) {
  const p = Math.max(0, Math.min(100, percent));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-track)" strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * p) / 100}
          style={{ transition: "stroke-dashoffset 600ms var(--ease-out-strong), stroke 300ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">{children}</div>
    </div>
  );
}
