"use client";

import { useCallback, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  Button, Panel, PageHeader, Segmented, Skeleton, Switch, Tag, api, usePoll, useToast,
} from "@/components/admin/ui";
import { compose } from "@/lib/os/compose";
import { APP_NAMES, CATALOG, DEFAULT_PINS } from "@/lib/os/catalog";
import type { OsData, Placement, WidgetConfig, WidgetSize } from "@/lib/os/types";
import { SCENARIOS, type ScenarioId } from "@/lib/os/scenarios";

const ALL_SIZES: WidgetSize[] = ["1x1", "2x1", "1x2", "2x2"];
const GRIDS = [
  { value: "strip", label: "Şerit 4×2", cols: 4, rows: 2 },
  { value: "desktop", label: "Masaüstü 4×3", cols: 4, rows: 3 },
  { value: "phone", label: "Telefon 1×6", cols: 1, rows: 6 },
] as const;

interface Row { id: string; enabled: boolean; priority: number; sizes: string[]; pinned: { col: number; row: number; size: string } | null }

export default function WidgetsPage() {
  const load = useCallback(() => api<{ settings: Row[] }>("/api/admin/widgets").then((r) => r.settings), []);
  const { data, loading, refresh } = usePoll(load);
  const [grid, setGrid] = useState<(typeof GRIDS)[number]["value"]>("strip");
  const [scenario, setScenario] = useState<ScenarioId>("busy");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  /** Veritabanı satırı + kayıt defteri varsayılanı */
  const config = useMemo(() => {
    const rows = new Map((data ?? []).map((r) => [r.id, r]));
    const out: Record<string, WidgetConfig> = {};
    for (const w of CATALOG) {
      const row = rows.get(w.id);
      const pin = DEFAULT_PINS[w.id];
      out[w.id] = {
        id: w.id,
        enabled: row?.enabled ?? true,
        priority: row?.priority ?? w.priority,
        sizes: (row?.sizes as WidgetSize[])?.length ? (row!.sizes as WidgetSize[]) : w.sizes,
        pinned: row ? (row.pinned as WidgetConfig["pinned"]) : pin ? { col: pin.col, row: pin.row, size: pin.size } : null,
      };
    }
    return out;
  }, [data]);

  const save = async (id: string, patch: Partial<WidgetConfig>) => {
    const next = { ...config[id], ...patch };
    setBusy(true);
    try {
      await api("/api/admin/widgets", { method: "PUT", json: { id, enabled: next.enabled, priority: next.priority, sizes: next.sizes, pinned: next.pinned } });
      refresh();
    } catch (e) { toast.fail((e as Error).message); } finally { setBusy(false); }
  };
  const reset = async (id: string) => {
    setBusy(true);
    try { await api("/api/admin/widgets", { method: "DELETE", json: { id } }); refresh(); toast.ok("Varsayılana döndü"); }
    catch (e) { toast.fail((e as Error).message); } finally { setBusy(false); }
  };

  const chosen = GRIDS.find((g) => g.value === grid)!;
  const preview: Placement[] = useMemo(() => {
    const scen = SCENARIOS.find((s) => s.id === scenario);
    if (!scen) return [];
    return compose({ widgets: CATALOG, config, data: scen.build() as OsData, grid: { cols: chosen.cols, rows: chosen.rows } });
  }, [config, scenario, chosen]);

  const byApp = useMemo(() => {
    const groups = new Map<string, typeof CATALOG>();
    for (const w of CATALOG) {
      if (!groups.has(w.appId)) groups.set(w.appId, []);
      groups.get(w.appId)!.push(w);
    }
    return [...groups.entries()];
  }, []);

  return (
    <>
      <PageHeader
        title="Widget'lar"
        sub="Pano sabit değil: her widget verisine bakıp ne kadar acil olduğunu söyler, sizin verdiğiniz önemle harmanlanır ve puanı yüksek olan daha büyük yuva alır. Gösterecek bir şeyi olmayan hiç görünmez, boşluğu saat ve hava durumu doldurur."
      />

      <div className="grid grid-cols-[1fr_420px] items-start gap-4">
        <div className="flex flex-col gap-4">
          {loading ? (
            <Panel><div className="flex flex-col gap-3"><Skeleton /><Skeleton /><Skeleton /></div></Panel>
          ) : (
            byApp.map(([appId, widgets]) => (
              <Panel key={appId} title={APP_NAMES[appId] ?? appId} flush>
                <table className="a-tbl">
                  <thead>
                    <tr>
                      <th style={{ width: 62 }}>Açık</th>
                      <th>Widget</th>
                      <th style={{ width: 128 }}>Önem</th>
                      <th style={{ width: 190 }}>İzin verilen boyutlar</th>
                      <th style={{ width: 150 }}>Sabit yuva</th>
                      <th style={{ width: 44 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {widgets.map((w) => {
                      const c = config[w.id];
                      if (!c) return null;
                      return (
                        <tr key={w.id} data-off={!c.enabled}>
                          <td><Switch checked={c.enabled} onChange={(v) => void save(w.id, { enabled: v })} label={undefined} /></td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{w.title}</div>
                            <code className="a-faint">{w.id}</code>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <input
                                type="range" min={0} max={100} value={c.priority} disabled={busy}
                                onChange={(e) => void save(w.id, { priority: Number(e.target.value) })}
                                style={{ width: 78 }} aria-label={`${w.title} önemi`}
                              />
                              <span className="a-num a-muted" style={{ width: 24 }}>{c.priority}</span>
                            </div>
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {ALL_SIZES.filter((s) => w.sizes.includes(s)).map((s) => {
                                const on = c.sizes.includes(s);
                                return (
                                  <button
                                    key={s}
                                    className="a-btn"
                                    data-size="sm"
                                    data-variant={on ? "default" : "ghost"}
                                    disabled={busy || (on && c.sizes.length === 1)}
                                    onClick={() => void save(w.id, { sizes: on ? c.sizes.filter((x) => x !== s) : [...c.sizes, s] })}
                                  >
                                    {s}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td>
                            {c.pinned ? (
                              <span className="flex items-center gap-1.5">
                                <Tag tone="solid">{c.pinned.size} @ {c.pinned.col},{c.pinned.row}</Tag>
                                <Button size="sm" variant="ghost" onClick={() => void save(w.id, { pinned: null })}>kaldır</Button>
                              </span>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => void save(w.id, { pinned: { col: 0, row: 0, size: c.sizes[c.sizes.length - 1] } })}>sabitle</Button>
                            )}
                          </td>
                          <td>
                            <div className="a-tbl-actions">
                              <Button size="icon" variant="ghost" title="Varsayılana dön" onClick={() => void reset(w.id)}><RotateCcw size={14} /></Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Panel>
            ))
          )}
        </div>

        <Panel
          title="Panoyu dene"
          desc="Bir durum seçin, panonun o anda nasıl dizileceğini kaydetmeden görün."
          footer={<><span>{preview.length} widget yerleşti</span><span className="a-num">{chosen.cols}×{chosen.rows}</span></>}
        >
          <div className="flex flex-col gap-3">
            <Segmented value={grid} onChange={setGrid} options={GRIDS.map((g) => ({ value: g.value, label: g.label }))} />
            <select value={scenario} onChange={(e) => setScenario(e.target.value as ScenarioId)} aria-label="Senaryo">
              {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <div
              className="grid gap-1.5 rounded-[10px] p-2"
              style={{
                background: "var(--a-sunken)",
                border: "1px solid var(--a-line)",
                aspectRatio: `${chosen.cols * 2.2} / ${chosen.rows}`,
                gridTemplateColumns: `repeat(${chosen.cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${chosen.rows}, minmax(0, 1fr))`,
              }}
            >
              {preview.map((p) => {
                const w = CATALOG.find((x) => x.id === p.widgetId);
                return (
                  <div
                    key={p.widgetId}
                    className="flex flex-col justify-between overflow-hidden rounded-[7px] p-2"
                    style={{
                      gridColumn: `${p.col + 1} / span ${p.w}`,
                      gridRow: `${p.row + 1} / span ${p.h}`,
                      background: "var(--a-panel)",
                      border: `1px solid ${p.pinned ? "var(--a-ink)" : "var(--a-line-strong)"}`,
                    }}
                  >
                    <span className="truncate text-[11.5px] font-medium">{w?.title ?? p.widgetId}</span>
                    <span className="a-num a-faint text-[10.5px]">{p.size} · {Math.round(p.score)}</span>
                  </div>
                );
              })}
            </div>
            <p className="a-faint text-[12px]">
              Kenarlığı vurgulu olan widget sabitlenmiştir. Sağdaki sayı puandır: 68 üstü büyük yuva, 42 üstü orta, altı küçük alır.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
