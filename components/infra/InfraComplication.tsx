"use client";

import { useState } from "react";
import type { InfraState } from "@/lib/types/infra";
import { isProblem } from "@/lib/types/infra";

/**
 * Saat kadranının altındaki altyapı "komplikasyonu" — watchOS mantığı: bir bakışta
 * tek satır. Sağlıklıysa sessiz ("1 sunucu · 21 servis · sağlıklı"), sorun varsa
 * kırmızı ve adıyla ("api durdu"). Dokununca Altyapı ekranı.
 */
export function InfraComplication({ data }: { data: InfraState }) {
  const [pressed, setPressed] = useState(false);
  if (!data.configured || data.systems.length === 0) return null;

  const down = data.systems.filter((s) => s.status === "down");
  const broken = data.systems.flatMap((s) => s.containers.filter(isProblem).map((c) => ({ c, s })));
  const services = data.systems.reduce((n, s) => n + s.containers.length, 0);

  let color = "var(--color-ok)";
  let text: string;
  if (down.length > 0) {
    color = "var(--color-err)";
    text = `${down[0].name} yanıt vermiyor${down.length > 1 ? ` +${down.length - 1}` : ""}`;
  } else if (broken.length > 0) {
    color = "var(--color-err)";
    text = `${broken[0].c.name} ${broken[0].c.running ? "sağlıksız" : "durdu"}${broken.length > 1 ? ` +${broken.length - 1}` : ""}`;
  } else if (data.error) {
    color = "var(--color-warn)";
    text = "Beszel'e ulaşılamıyor";
  } else {
    text = `${data.systems.length} sunucu · ${services} servis · sağlıklı`;
  }

  const ok = color === "var(--color-ok)";
  const release = () => setPressed(false);
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("panel-goto", { detail: "infra" }))}
      onPointerDown={() => setPressed(true)}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      aria-label={`Altyapı: ${text}`}
      className="flex max-w-[380px] items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium"
      style={{
        background: ok ? "var(--color-raised)" : `color-mix(in srgb, ${color} 14%, transparent)`,
        color: ok ? "var(--color-dim)" : color,
        transform: pressed ? "scale(0.97)" : undefined,
        transition: "transform 120ms var(--ease-out-strong)",
      }}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${ok ? "animate-soft-pulse" : ""}`} style={{ background: color }} />
      <span className="truncate">{text}</span>
    </button>
  );
}
