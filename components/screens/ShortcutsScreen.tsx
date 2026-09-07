"use client";

import { useEffect, useState } from "react";
import { FolderGit2, Server, type LucideIcon } from "lucide-react";
import { Module, Stage, modulePad } from "@/components/ui/Stage";
import { IconChip } from "@/components/ui/IconChip";
import { runShortcutOnAgent } from "@/lib/data/runShortcut";
import { useShortcuts } from "@/lib/data/useShortcuts";
import type { ShortcutItem, ShortcutKind } from "@/lib/types/shortcuts";

const KIND_META: Record<ShortcutKind, { icon: LucideIcon; hue: string }> = {
  project: { icon: FolderGit2, hue: "var(--color-blue)" },
  server: { icon: Server, hue: "var(--color-teal)" },
};

function ShortcutTile({
  item,
  running,
  onRun,
}: {
  item: ShortcutItem;
  running: boolean;
  onRun: () => void;
}) {
  // Simge öğenin kendi türünden gelir: bir grup proje ve sunucuyu karıştırabilir
  const { icon, hue } = KIND_META[item.run.kind === "ssh" ? "server" : "project"];
  return (
    <button
      onClick={onRun}
      disabled={running}
      className={`surface flex h-[70px] min-w-0 items-center gap-3 rounded-[var(--r-md)] px-4 text-left transition-[transform,background-color] duration-100 [transition-timing-function:var(--ease-out-strong)] active:scale-[0.97] active:bg-pressed ${
        running ? "animate-soft-pulse" : ""
      }`}
    >
      <IconChip icon={icon} tint={hue} size={38} iconSize={19} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">
          {running ? "Çalıştırılıyor…" : item.label}
        </span>
        {item.sublabel && !running && (
          <span className="block truncate text-[12px] leading-tight text-faint">{item.sublabel}</span>
        )}
      </span>
    </button>
  );
}

/** Gerçek kısayollar — her dokunuş Mac ajanında çalışır, toast gerçek sonucu gösterir. */
export default function ShortcutsScreen() {
  const { data: groups } = useShortcuts();
  const [runningId, setRunningId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ key: number; text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.ok ? 2400 : 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const run = (item: ShortcutItem) => {
    if (runningId) return;
    setRunningId(item.id);
    void runShortcutOnAgent(item.id, item.run).then((result) => {
      setRunningId(null);
      setToast({
        key: Date.now(),
        text: result.ok ? item.feedback : `Olmadı: ${result.message ?? "bilinmeyen hata"}`,
        ok: result.ok,
      });
    });
  };

  return (
    <div className="relative h-full">
      <Stage cols={groups.map(() => "1fr").join(" ")}>
        {groups.map((group, i) => (
          <Module key={group.id} title={group.title} divider={i > 0} className={modulePad(i, groups.length)}>
            <div className="grid grid-cols-2 content-start gap-3">
              {group.items.map((item) => (
                <ShortcutTile
                  key={item.id}
                  item={item}
                  running={runningId === item.id}
                  onRun={() => run(item)}
                />
              ))}
            </div>
          </Module>
        ))}
      </Stage>

      {toast && (
        <div
          key={toast.key}
          className="animate-toast absolute bottom-8 left-1/2 z-10 flex items-center gap-2.5 rounded-full px-6 py-3 text-[15px] font-medium"
          style={{ background: "var(--color-toast)", boxShadow: "var(--toast-shadow)" }}
        >
          {!toast.ok && <span className="h-2 w-2 shrink-0 rounded-full bg-warn" />}
          {toast.text}
        </div>
      )}
    </div>
  );
}
