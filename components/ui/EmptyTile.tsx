"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/**
 * Gösterecek bir şey olmayan modülün yerini sessizce tutar: ızgara ritmi bozulmaz,
 * dürüst bir boş durum kalır. Şerit ekranda boşluk da bir bilgidir — bu yüzden
 * kutu çizmez, yalnızca ortalanmış küçük bir işaret bırakır.
 */
export function EmptyTile({
  icon,
  title,
  sub,
  screen,
  tint = "var(--color-ink)",
  bare = false,
}: {
  icon: ReactNode;
  title: string;
  sub?: string;
  /** Dokununca gidilecek ekran kimliği */
  screen?: string;
  tint?: string;
  /** Açık sunum: yüzey yok */
  bare?: boolean;
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
      className={`flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 text-center ${
        bare ? "" : "surface rounded-[var(--r-lg)] p-5"
      }`}
      style={{
        opacity: bare ? 1 : 0.72,
        transform: pressed ? "scale(0.985)" : undefined,
        transition: "transform 120ms var(--ease-out-strong)",
      }}
    >
      <span
        className="flex h-10 w-10 items-center justify-center rounded-full"
        style={{ background: `color-mix(in srgb, ${tint} 10%, transparent)`, color: tint, opacity: 0.9 }}
      >
        {icon}
      </span>
      <span className="text-[13.5px] font-medium text-dim">{title}</span>
      {sub && <span className="max-w-[240px] text-[11.5px] leading-snug text-faint">{sub}</span>}
      {screen && <ChevronRight size={13} className="mt-0.5 text-faint" />}
    </Tag>
  );
}
