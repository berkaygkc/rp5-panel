"use client";

import { useId } from "react";

/**
 * Kütüphanesiz mini çizgi grafik. Yalnızca SVG; `preserveAspectRatio="none"`
 * ile kutusuna gerilir. Alan dolgusu hafif, çizgi ince — veri süs değil, yön.
 */
export function Sparkline({
  values,
  width = 96,
  height = 28,
  color = "var(--color-teal)",
  max,
  className = "",
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  /** Üst sınır; verilmezse serinin en büyüğü (en az 1) */
  max?: number;
  className?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const n = values.length;
  if (n < 2) {
    return <div className={className} style={{ width, height }} />;
  }
  const top = Math.max(max ?? Math.max(...values), 1);
  const pts = values.map((v, i) => {
    const x = (i / (n - 1)) * 100;
    const y = 100 - (Math.max(0, Math.min(top, v)) / top) * 100;
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `0,100 ${line} 100,100`;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      width={width}
      height={height}
      className={className}
      style={{ width, height, display: "block", overflow: "visible" }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sp-${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
