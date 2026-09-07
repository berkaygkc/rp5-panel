"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/**
 * Dashboard'daki boş yuva: gösterecek bir şey olmayan kartın yerini sessizce tutar,
 * ızgara ritmini korur ve dokununca ilgili ekrana götürür. Süs değil, dürüst boş durum.
 */
export function EmptyTile({
  icon,
  title,
  sub,
  screen,
  tint = "var(--color-ink)",
}: {
  icon: ReactNode;
  title: string;
  sub?: string;
  /** Dokununca gidilecek ekran kimliği */
  screen?: string;
  tint?: string;
}) {
  const [pressed, setPressed] = useState(false);
  const release = () => setPressed(false);
  const Tag = screen ? "button" : "div";
  return (
    <Tag
      onClick={screen ? () => window.dispatchEvent(new CustomEvent("panel-goto", { detail: screen })) : undefined}
      onPointerDown={screen ? () => setPressed(true) : undefined}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      aria-label={screen ? `${title} — ekrana git` : undefined}
      className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 rounded-[26px] p-5 text-center"
      style={{
        background: "linear-gradient(180deg, var(--card-top), var(--card-bottom))",
        boxShadow: "inset 0 2px 0 var(--card-highlight), inset 0 0 0 1px var(--card-ring), var(--card-shadow)",
        opacity: 0.72,
        transform: pressed ? "scale(0.985)" : undefined,
        transition: "transform 120ms var(--ease-out-strong)",
      }}
    >
      <span
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={{ background: `color-mix(in srgb, ${tint} 12%, transparent)`, color: tint }}
      >
        {icon}
      </span>
      <span className="text-[14px] font-medium text-dim">{title}</span>
      {sub && <span className="text-[12px] text-faint">{sub}</span>}
      {screen && <ChevronRight size={14} className="mt-1 text-faint" />}
    </Tag>
  );
}
