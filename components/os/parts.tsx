"use client";

import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { WidgetSize } from "@/lib/os/types";

/**
 * Widget parçaları.
 *
 * Widget'lar ızgarada gerçek nesnelerdir, bu yüzden her biri kendi yüzeyini
 * taşır. Hiyerarşi malzemeyle değil, boyut ve konumla kurulur: motor önemli
 * olana daha büyük yuva verir. Tek yarıçap, tek gölge, boyuta göre tanımlı
 * tipografi — tutarlılık platformun sözüdür.
 */

export function Tile({
  tint,
  screen,
  interactive = true,
  className = "",
  children,
}: {
  tint: string;
  /** Dokununca gidilecek uygulama ekranı */
  screen?: string;
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [pressed, setPressed] = useState(false);
  const release = () => setPressed(false);
  const Tag = screen && interactive ? "button" : "div";
  return (
    <Tag
      onClick={screen ? () => window.dispatchEvent(new CustomEvent("panel-goto", { detail: screen })) : undefined}
      onPointerDown={screen && interactive ? () => setPressed(true) : undefined}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      className={`surface relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-[var(--r-lg)] p-3.5 text-left ${className}`}
      style={{
        transform: pressed ? "scale(0.985)" : undefined,
        transition: "transform 120ms var(--ease-out-strong)",
        ["--tile-tint" as string]: tint,
      }}
    >
      {children}
    </Tag>
  );
}

/** Widget başlığı: renkli küçük ikon, ad ve sağda tek bir işaret */
export function TileHead({
  icon: Icon,
  title,
  tint,
  trailing,
}: {
  icon: LucideIcon;
  title: string;
  tint: string;
  trailing?: ReactNode;
}) {
  return (
    <header className="mb-2 flex shrink-0 items-center gap-2">
      <span
        className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px]"
        style={{ background: `color-mix(in srgb, ${tint} 18%, transparent)`, color: tint }}
      >
        <Icon size={13} strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-dim">{title}</span>
      {trailing}
    </header>
  );
}

/** 1x1 widget'ın gövdesi: tek büyük sayı ve altında bir satır */
export function Metric({
  value,
  label,
  tone,
}: {
  value: ReactNode;
  label: string;
  tone?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center">
      <div
        className="text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums"
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </div>
      <div className="mt-1.5 truncate text-[11.5px] text-dim">{label}</div>
    </div>
  );
}

/** Rozet: sayaç ya da durum */
export function Pill({ children, tint }: { children: ReactNode; tint: string }) {
  return (
    <span
      className="rounded-full px-1.5 py-[1px] text-[10.5px] font-bold tabular-nums leading-none"
      style={{ background: `color-mix(in srgb, ${tint} 20%, transparent)`, color: tint }}
    >
      {children}
    </span>
  );
}

/** Boyut sınıflarına göre satır sayısı — widget'lar bunu kullanarak içeriğini kırpar */
export function rowsFor(size: WidgetSize): number {
  if (size === "2x2") return 3;
  if (size === "1x2") return 4;
  if (size === "2x1") return 1;
  return 0;
}
