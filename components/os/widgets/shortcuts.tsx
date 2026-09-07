"use client";

import { useState } from "react";
import { FolderGit2, Server, Zap } from "lucide-react";
import { Tile, TileHead } from "@/components/os/parts";
import { IconChip } from "@/components/ui/IconChip";
import { runShortcutOnAgent } from "@/lib/data/runShortcut";
import { useShortcuts } from "@/lib/data/useShortcuts";
import type { WidgetProps } from "@/lib/os/types";
import type { ShortcutItem } from "@/lib/types/shortcuts";

const TINT = "var(--color-orange)";

/** En sık kullanılan kısayollar; dokunulunca gerçekten çalışır */
export function ShortcutsWidget({ size }: WidgetProps) {
  const { data: groups } = useShortcuts();
  const [running, setRunning] = useState<string | null>(null);
  const items = groups.flatMap((g) => g.items);
  if (items.length === 0) return null;

  const count = size === "2x2" ? 6 : size === "2x1" ? 3 : 2;
  const shown = items.slice(0, count);
  const run = (item: ShortcutItem) => {
    if (running) return;
    setRunning(item.id);
    void runShortcutOnAgent(item.id, item.run).finally(() => setRunning(null));
  };

  return (
    <Tile tint={TINT} interactive={false}>
      <TileHead icon={Zap} title="Kısayollar" tint={TINT} />
      <div
        className="grid min-h-0 flex-1 content-center gap-2"
        style={{ gridTemplateColumns: size === "2x2" || size === "2x1" ? "1fr 1fr" : "1fr" }}
      >
        {shown.map((item) => {
          const ssh = item.run.kind === "ssh";
          return (
            <button
              key={item.id}
              onClick={() => run(item)}
              disabled={running !== null}
              className={`surface-quiet flex items-center gap-2.5 rounded-[var(--r-md)] px-2.5 py-2 text-left transition-transform duration-100 [transition-timing-function:var(--ease-out-strong)] active:scale-[0.97] ${
                running === item.id ? "animate-soft-pulse" : ""
              }`}
              style={{ boxShadow: "inset 0 0 0 1px var(--card-ring)" }}
            >
              <IconChip icon={ssh ? Server : FolderGit2} tint={ssh ? "var(--color-teal)" : "var(--color-blue)"} size={28} iconSize={14} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{item.label}</span>
            </button>
          );
        })}
      </div>
    </Tile>
  );
}
