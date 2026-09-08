"use client";

import { useEffect, useState } from "react";
import { Check, FolderGit2, Server, TriangleAlert, type LucideIcon } from "lucide-react";
import { Module, Stage, modulePad } from "@/components/ui/Stage";
import { IconChip } from "@/components/ui/IconChip";
import { runShortcutOnAgent } from "@/lib/data/runShortcut";
import { useNow } from "@/lib/data/useNow";
import { useShortcuts } from "@/lib/data/useShortcuts";
import { fmtAgo } from "@/lib/format";
import type { ShortcutItem, ShortcutKind } from "@/lib/types/shortcuts";

const KIND_META: Record<ShortcutKind, { icon: LucideIcon; hue: string }> = {
  project: { icon: FolderGit2, hue: "var(--color-blue)" },
  server: { icon: Server, hue: "var(--color-teal)" },
};

type KeyState = "idle" | "running" | "ok" | "fail";

/** Kısayolun gerçekte ne yapacağı: yol ya da adres. Tuşun sözü budur. */
function target(item: ShortcutItem): string {
  if (item.run.kind === "project") {
    const parts = item.run.path.split("/").filter(Boolean);
    return parts.length > 2 ? `…/${parts.slice(-2).join("/")}` : item.run.path;
  }
  const { user, host, port } = item.run;
  return `${user ? `${user}@` : ""}${host}${port && port !== 22 ? `:${port}` : ""}`;
}

/**
 * Kısayol tuşu. Geri bildirim uzakta bir bildirimde değil, basılan tuşun
 * üstünde belirir: çalışırken nabız, bitince yeşil onay, olmazsa kırmızı.
 */
function ShortcutKey({
  item,
  state,
  lastRunAt,
  now,
  onRun,
}: {
  item: ShortcutItem;
  state: KeyState;
  lastRunAt: number | null;
  now: number;
  onRun: () => void;
}) {
  const { icon, hue } = KIND_META[item.run.kind === "ssh" ? "server" : "project"];
  const busy = state === "running";
  const edge = state === "ok" ? "var(--color-ok)" : state === "fail" ? "var(--color-err)" : null;
  const tgt = target(item);
  // Alt başlık adresi zaten söylüyorsa iki kez yazma
  const sub = item.sublabel && !item.sublabel.includes(item.run.kind === "ssh" ? item.run.host : tgt) ? item.sublabel : null;
  return (
    <button
      onClick={onRun}
      disabled={busy}
      className="surface relative flex min-h-0 min-w-0 flex-col justify-between overflow-hidden rounded-[var(--r-lg)] p-4 text-left transition-transform duration-100 [transition-timing-function:var(--ease-out-strong)] active:scale-[0.98]"
      style={edge ? { boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${edge} 55%, transparent)` } : undefined}
    >
      <span className="flex items-start gap-3">
        <IconChip icon={icon} tint={hue} size={38} iconSize={19} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold leading-tight tracking-[-0.01em]">{item.label}</span>
          {sub && <span className="mt-0.5 block truncate text-[11.5px] leading-tight text-faint">{sub}</span>}
        </span>
        {state === "ok" && <Check size={17} strokeWidth={2.5} className="shrink-0 text-ok" />}
        {state === "fail" && <TriangleAlert size={16} strokeWidth={2.25} className="shrink-0 text-err" />}
      </span>

      {/* Alt ray: solda tuşun ne yapacağı, sağda en son ne zaman yaptığı */}
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-mono text-[11.5px] text-dim">{tgt}</span>
        <span className="shrink-0 text-[11px] tabular-nums text-faint">
          {busy ? "gönderiliyor…" : lastRunAt ? `${fmtAgo(lastRunAt, now)} önce` : ""}
        </span>
      </span>

      {/* Çalışırken tuşun alt kenarında ilerleyen bir iz: bekleyiş sessiz kalmasın */}
      <span
        className="absolute inset-x-0 bottom-0 h-[2px] origin-left"
        style={{
          background: busy ? hue : edge ?? "transparent",
          transform: busy ? undefined : "scaleX(0)",
          animation: busy ? "key-run 1.1s var(--ease-out-strong) infinite" : undefined,
          transition: "transform 300ms var(--ease-out-strong)",
        }}
      />
    </button>
  );
}

/** Gerçek kısayollar — her dokunuş çekirdek üzerinden Mac ajanında çalışır. */
export default function ShortcutsScreen() {
  const { data: groups } = useShortcuts();
  const now = useNow(30_000)?.getTime() ?? 0;
  const [states, setStates] = useState<Record<string, KeyState>>({});
  const [ranAt, setRanAt] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<{ key: number; text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.ok ? 2400 : 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const run = (item: ShortcutItem) => {
    if (states[item.id] === "running") return;
    setStates((s) => ({ ...s, [item.id]: "running" }));
    void runShortcutOnAgent(item.id, item.run).then((result) => {
      setStates((s) => ({ ...s, [item.id]: result.ok ? "ok" : "fail" }));
      if (result.ok) setRanAt((r) => ({ ...r, [item.id]: Date.now() }));
      setToast({
        key: Date.now(),
        text: result.ok ? item.feedback : `Olmadı: ${result.message ?? "bilinmeyen hata"}`,
        ok: result.ok,
      });
      setTimeout(() => setStates((s) => ({ ...s, [item.id]: "idle" })), result.ok ? 2200 : 4000);
    });
  };

  // Sütun genişliği grubun büyüklüğüne göre: altı proje üç sütun ister, iki sunucu bir
  const colsFor = (n: number) => (n > 4 ? 3 : n > 2 ? 2 : 1);

  return (
    <div className="relative h-full">
      <Stage cols={groups.map((g) => `${colsFor(g.items.length)}fr`).join(" ")}>
        {groups.map((group, i) => (
          <Module
            key={group.id}
            title={group.title}
            divider={i > 0}
            className={modulePad(i, groups.length)}
            right={<span className="text-[11px] tabular-nums text-faint">{group.items.length}</span>}
          >
            <div
              className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto"
              style={{
                gridTemplateColumns: `repeat(${colsFor(group.items.length)}, minmax(0, 1fr))`,
                // Sabit tuş yüksekliği: sütunlar farklı sayıda kısayol taşısa da
                // tuşlar aynı boyda kalır, artan yer alanı boş bırakır.
                gridAutoRows: "134px",
              }}
            >
              {group.items.map((item) => (
                <ShortcutKey
                  key={item.id}
                  item={item}
                  state={states[item.id] ?? "idle"}
                  lastRunAt={ranAt[item.id] ?? item.lastRunAt ?? null}
                  now={now}
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
          {!toast.ok && <span className="h-2 w-2 shrink-0 rounded-full bg-err" />}
          {toast.text}
        </div>
      )}
    </div>
  );
}
