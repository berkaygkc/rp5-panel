"use client";

import { Cpu } from "lucide-react";
import { Tile, TileHead } from "@/components/os/parts";
import type { WidgetProps } from "@/lib/os/types";

const TINT = "var(--color-purple)";

/** Çekirdeğin bildiği yetenekler — kullanıcı "medya" değil, ne çalıştığını görür */
const CAPS: [string, string][] = [
  ["media", "Medya"],
  ["shortcuts", "Kısayollar"],
  ["claude", "Claude"],
  ["mail", "Posta"],
];

/**
 * Sistem: hangi yetenekler çevrimiçi. Kopunca panonun en önemli bilgisi olur,
 * bu yüzden sessiz halinde de dürüst durur — eksik olanı soluk da olsa yazar.
 */
export function SystemWidget({ data }: WidgetProps) {
  const online = new Set(data.online);
  const missing = CAPS.filter(([id]) => !online.has(id));
  const allDown = online.size === 0;

  return (
    <Tile tint={TINT} interactive={false}>
      <TileHead
        icon={Cpu}
        title="Sistem"
        tint={TINT}
        trailing={
          <span
            className="h-[7px] w-[7px] rounded-full"
            style={{ background: allDown ? "var(--color-err)" : missing.length ? "var(--color-warn)" : "var(--color-ok)" }}
          />
        }
      />
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <span
          className="truncate text-[15px] font-semibold leading-tight tracking-[-0.01em]"
          style={allDown ? { color: "var(--color-err)" } : undefined}
        >
          {allDown ? "Cihaz bağlı değil" : missing.length ? `${missing.length} yetenek eksik` : "Her şey bağlı"}
        </span>
        <span className="mt-0.5 truncate text-[11.5px] text-dim">
          {allDown ? "Mac ajanı çekirdeğe bağlanmadı" : `${online.size} yetenek çevrimiçi`}
        </span>

        {/* Yetenek listesi: bağlı olan yanar, olmayan soluk kalır ama görünür */}
        <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1">
          {CAPS.map(([id, name]) => {
            const up = online.has(id);
            return (
              <span key={id} className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-[5px] w-[5px] shrink-0 rounded-full"
                  style={{ background: up ? "var(--color-ok)" : "var(--color-faint)" }}
                />
                <span className={`truncate text-[11px] ${up ? "text-dim" : "text-faint"}`}>{name}</span>
              </span>
            );
          })}
        </div>
      </div>
    </Tile>
  );
}
