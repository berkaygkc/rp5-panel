"use client";

import { useCallback, useState } from "react";
import { Empty, Panel, Reorder, SaveBar, Skeleton, Switch, api, move, usePoll, useToast } from "@/components/admin/ui";
import { ScreenStrip } from "@/components/admin/ScreenStrip";

interface Screen { id: string; title: string; tint: string; order: number; enabled: boolean }

const TINTS: Array<{ value: string; label: string }> = [
  { value: "var(--color-blue)", label: "Mavi" },
  { value: "var(--color-teal)", label: "Deniz" },
  { value: "var(--color-mint)", label: "Nane" },
  { value: "var(--color-green)", label: "Yeşil" },
  { value: "var(--color-yellow)", label: "Sarı" },
  { value: "var(--color-orange)", label: "Turuncu" },
  { value: "var(--color-terracotta)", label: "Kiremit" },
  { value: "var(--color-red)", label: "Kırmızı" },
  { value: "var(--color-pink)", label: "Pembe" },
  { value: "var(--color-purple)", label: "Mor" },
  { value: "var(--color-indigo)", label: "İndigo" },
];

export default function ScreensPage() {
  const load = useCallback(() => api<{ screens: Screen[] }>("/api/admin/screens").then((r) => r.screens), []);
  const { data, loading, refresh } = usePoll(load);
  const [draft, setDraft] = useState<Screen[] | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const rows = draft ?? data ?? [];
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(data);
  const patch = (i: number, p: Partial<Screen>) => setDraft(rows.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const save = useCallback(async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await api("/api/admin/screens", { method: "PUT", json: { screens: draft } });
      setDraft(null);
      refresh();
      toast.ok("Ekran düzeni kaydedildi");
    } catch (e) {
      toast.fail((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [draft, refresh, toast]);

  return (
    <>
      <header className="a-head">
        <div>
          <h1 className="a-title">Ekranlar</h1>
          <p className="a-sub">
            Kiosk’un menüsü, sağ rail’i ve kaydırma sırası buradaki sırayı izler. Genel Bakış her zaman ilk sırada ve açık kalır.
          </p>
        </div>
      </header>

      <Panel title="Önizleme" desc="Sıralama değiştikçe cihazda ne göreceğinizi gösterir; henüz kaydedilmedi.">
        {loading ? <Skeleton h={132} /> : <ScreenStrip screens={rows} onPick={() => {}} />}
      </Panel>

      <Panel className="mt-4" flush>
        {loading ? (
          <div className="flex flex-col gap-3 p-4"><Skeleton /><Skeleton /><Skeleton /></div>
        ) : rows.length === 0 ? (
          <Empty>Kayıtlı ekran yok. Tohum betiği (npm run db:seed) varsayılanları yükler.</Empty>
        ) : (
          <table className="a-tbl">
            <thead>
              <tr>
                <th style={{ width: 52 }}>Sıra</th>
                <th style={{ width: 76 }}>Açık</th>
                <th>Başlık</th>
                <th style={{ width: 190 }}>Kimlik rengi</th>
                <th style={{ width: 130 }}>Kimlik</th>
                <th style={{ width: 84 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => {
                const locked = s.id === "overview";
                const known = TINTS.some((t) => t.value === s.tint);
                return (
                  <tr key={s.id} data-off={!s.enabled}>
                    <td className="a-num a-faint">{String(i + 1).padStart(2, "0")}</td>
                    <td>
                      <Switch checked={locked || s.enabled} onChange={(v) => !locked && patch(i, { enabled: v })} label={undefined} />
                    </td>
                    <td>
                      <input
                        className="a-inline-input"
                        value={s.title}
                        onChange={(e) => patch(i, { title: e.target.value })}
                        aria-label={`${s.id} başlığı`}
                      />
                    </td>
                    <td>
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: s.tint }} />
                        <select value={s.tint} onChange={(e) => patch(i, { tint: e.target.value })} aria-label={`${s.id} rengi`} style={{ width: 140 }}>
                          {!known && <option value={s.tint}>{s.tint}</option>}
                          {TINTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </span>
                    </td>
                    <td><code className="a-muted">{s.id}</code></td>
                    <td>
                      <div className="a-tbl-actions">
                        <Reorder
                          canUp={i > 1}
                          canDown={i > 0 && i < rows.length - 1}
                          onUp={() => setDraft(move(rows, i, i - 1))}
                          onDown={() => setDraft(move(rows, i, i + 1))}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      <SaveBar dirty={dirty} busy={busy} onSave={() => void save()} onReset={() => setDraft(null)} />
    </>
  );
}
