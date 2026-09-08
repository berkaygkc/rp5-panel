"use client";

import { useState } from "react";
import { Check, FolderGit2, Server, TriangleAlert, Zap } from "lucide-react";
import { Tile, TileHead } from "@/components/os/parts";
import { IconChip } from "@/components/ui/IconChip";
import { runShortcutOnAgent } from "@/lib/data/runShortcut";
import { useShortcuts } from "@/lib/data/useShortcuts";
import type { WidgetProps } from "@/lib/os/types";
import type { ShortcutItem } from "@/lib/types/shortcuts";

const TINT = "var(--color-orange)";

type KeyState = "running" | "ok" | "fail";

/** Kısayolun hedefi tek satırda: proje klasörü ya da sunucu adresi */
function target(item: ShortcutItem): string {
  if (item.run.kind === "project") return item.run.path.split("/").filter(Boolean).slice(-1)[0] ?? item.run.path;
  return `${item.run.user ? `${item.run.user}@` : ""}${item.run.host}`;
}

/**
 * Kısayollar: en son kullandıkların önde. Widget bir liste değil, tuş takımı —
 * dokunuş burada da gerçekten çalışır ve sonucu tuşun üstünde gösterir.
 */
export function ShortcutsWidget({ size }: WidgetProps) {
  const { data: groups } = useShortcuts();
  const [state, setState] = useState<Record<string, KeyState>>({});
  const items = groups.flatMap((g) => g.items);
  if (items.length === 0) return null;

  // Sıra kullanımdan gelir: en son çalıştırdığın en üstte, hiç çalışmamışlar sonda
  const ordered = [...items].sort((a, b) => (b.lastRunAt ?? 0) - (a.lastRunAt ?? 0) || (b.runCount ?? 0) - (a.runCount ?? 0));
  const count = size === "2x2" ? 6 : size === "1x2" ? 5 : size === "2x1" ? 4 : 2;
  const cols = size === "2x2" || size === "2x1" ? 2 : 1;
  const shown = ordered.slice(0, count);

  const run = (item: ShortcutItem) => {
    if (state[item.id] === "running") return;
    setState((s) => ({ ...s, [item.id]: "running" }));
    void runShortcutOnAgent(item.id, item.run).then((r) => {
      setState((s) => ({ ...s, [item.id]: r.ok ? "ok" : "fail" }));
      setTimeout(() => setState((s) => ({ ...s, [item.id]: undefined as unknown as KeyState })), 2200);
    });
  };

  return (
    <Tile tint={TINT} interactive={false}>
      <TileHead
        icon={Zap}
        title="Kısayollar"
        tint={TINT}
        trailing={<span className="text-[11px] tabular-nums text-faint">{items.length}</span>}
      />
      <div
        className="grid min-h-0 flex-1 content-center gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {shown.map((item) => {
          const ssh = item.run.kind === "ssh";
          const st = state[item.id];
          return (
            <button
              key={item.id}
              onClick={() => run(item)}
              disabled={st === "running"}
              className="surface-quiet flex min-w-0 items-center gap-2.5 rounded-[var(--r-md)] px-2.5 py-2 text-left transition-transform duration-100 [transition-timing-function:var(--ease-out-strong)] active:scale-[0.97]"
              style={{
                boxShadow:
                  st === "ok"
                    ? "inset 0 0 0 1.5px color-mix(in srgb, var(--color-ok) 55%, transparent)"
                    : st === "fail"
                      ? "inset 0 0 0 1.5px color-mix(in srgb, var(--color-err) 55%, transparent)"
                      : "inset 0 0 0 1px var(--card-ring)",
                opacity: st === "running" ? 0.72 : undefined,
                transition: "box-shadow 240ms var(--ease-out-strong), opacity 160ms ease, transform 120ms var(--ease-out-strong)",
              }}
            >
              <IconChip icon={ssh ? Server : FolderGit2} tint={ssh ? "var(--color-teal)" : "var(--color-blue)"} size={28} iconSize={14} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold leading-tight">{item.label}</span>
                <span className="block truncate font-mono text-[10.5px] leading-tight text-faint">{target(item)}</span>
              </span>
              {st === "ok" && <Check size={14} strokeWidth={2.5} className="shrink-0 text-ok" />}
              {st === "fail" && <TriangleAlert size={13} strokeWidth={2.25} className="shrink-0 text-err" />}
            </button>
          );
        })}
      </div>
    </Tile>
  );
}
