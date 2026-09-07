/**
 * Kompozisyon motoru testleri.
 *   npx tsx scripts/compose.test.ts
 *
 * Motor saf bir fonksiyon olduğu için arayüz olmadan sınanabilir. Buradaki
 * senaryolar panonun sözünü tarif eder: önemli olan büyür, sessiz olan küçülür
 * ya da hiç görünmez, sabitlenen yerinde kalır, boşluğu dolgular kapatır.
 */
import { compose, hasPreemption, scoreOf } from "../lib/os/compose";
import type { OsData, Placement, WidgetConfig, WidgetDef } from "../lib/os/types";

let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failed++;
    console.log(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail) : "");
  }
}

const data = { now: Date.now() } as unknown as OsData;
const noop = () => null;
const W = (id: string, priority: number, urgency: number, sizes: WidgetDef["sizes"], filler = false): WidgetDef => ({
  id,
  appId: id.split(".")[0],
  title: id,
  sizes,
  priority,
  urgency: () => urgency,
  filler,
  component: noop as unknown as WidgetDef["component"],
});
const cfg = (over: Partial<WidgetConfig> & { id: string }): WidgetConfig => ({
  enabled: true, priority: 50, sizes: [], pinned: null, ...over,
});
const at = (p: Placement[], id: string) => p.find((x) => x.widgetId === id);
const grid = { cols: 4, rows: 2 };

console.log("kompozisyon motoru");

/* 1 — Aciliyeti sıfır olan yer kaplamaz */
{
  const widgets = [W("media.now", 60, 0, ["2x2", "2x1", "1x1"]), W("claude.sessions", 60, 40, ["2x2", "1x1"])];
  const p = compose({ widgets, config: {}, data, grid });
  check("çalan yoksa medya widget'ı yerleşmez", !at(p, "media.now"));
  check("veri olan widget yerleşir", Boolean(at(p, "claude.sessions")));
}

/* 2 — Puan büyüdükçe yuva büyür */
{
  const low = compose({ widgets: [W("a", 10, 10, ["2x2", "2x1", "1x1"])], config: {}, data, grid });
  const mid = compose({ widgets: [W("a", 50, 60, ["2x2", "2x1", "1x1"])], config: {}, data, grid });
  const high = compose({ widgets: [W("a", 90, 95, ["2x2", "2x1", "1x1"])], config: {}, data, grid });
  check("düşük puan 1x1", at(low, "a")?.size === "1x1", at(low, "a")?.size);
  check("orta puan 2x1", at(mid, "a")?.size === "2x1", at(mid, "a")?.size);
  check("yüksek puan 2x2", at(high, "a")?.size === "2x2", at(high, "a")?.size);
}

/* 3 — Sabitlenen widget yerinde kalır ve devrilemez */
{
  const widgets = [W("clock", 20, 5, ["1x1"], true), W("urgent", 90, 100, ["2x2", "1x1"])];
  const p = compose({
    widgets,
    config: { clock: cfg({ id: "clock", pinned: { col: 3, row: 1, size: "1x1" } }) },
    data,
    grid,
  });
  const c = at(p, "clock");
  check("sabit yuva korunur", c?.col === 3 && c?.row === 1, c);
  check("acil widget yine de yerleşir", Boolean(at(p, "urgent")));
}

/* 4 — Dolgular boşluğu kapatır ama önce sıradakiler yerleşir */
{
  const widgets = [
    W("clock", 30, 5, ["1x2", "1x1"], true),
    W("weather", 25, 5, ["1x1"], true),
    W("mail", 70, 80, ["2x2", "2x1", "1x1"]),
  ];
  const p = compose({ widgets, config: {}, data, grid });
  check("veri widget'ı önce ve büyük yerleşir", at(p, "mail")?.size === "2x2", at(p, "mail")?.size);
  check("dolgular kalan boşluğu kapatır", Boolean(at(p, "clock")) && Boolean(at(p, "weather")));
  const cells = p.reduce((n, x) => n + x.w * x.h, 0);
  check("ızgara taşmaz", cells <= grid.cols * grid.rows, cells);
}

/* 5 — Çakışma yok */
{
  const widgets = [
    W("a", 90, 95, ["2x2", "1x1"]), W("b", 80, 85, ["2x2", "1x1"]),
    W("c", 60, 60, ["2x1", "1x1"]), W("d", 40, 40, ["1x1"]), W("e", 20, 10, ["1x1"], true),
  ];
  const p = compose({ widgets, config: {}, data, grid });
  const seen = new Set<string>();
  let overlap = false;
  for (const x of p) for (let r = x.row; r < x.row + x.h; r++) for (let c = x.col; c < x.col + x.w; c++) {
    const k = `${c},${r}`;
    if (seen.has(k)) overlap = true;
    seen.add(k);
  }
  check("hiçbir widget üst üste binmez", !overlap);
  check("hepsi ızgaranın içinde", p.every((x) => x.col + x.w <= grid.cols && x.row + x.h <= grid.rows));
}

/* 6 — Telefonda tek sütun: büyük widget küçük boyutuna iner */
{
  const widgets = [W("mail", 70, 80, ["2x2", "2x1", "1x1"]), W("clock", 30, 5, ["1x2", "1x1"], true)];
  const p = compose({ widgets, config: {}, data, grid: { cols: 1, rows: 6 } });
  check("tek sütunda 1x1'e iner", at(p, "mail")?.size === "1x1", at(p, "mail")?.size);
  check("dolgu da sığar", Boolean(at(p, "clock")));
}

/* 7 — Kapalı widget hiç görünmez */
{
  const widgets = [W("a", 90, 90, ["1x1"])];
  const p = compose({ widgets, config: { a: cfg({ id: "a", enabled: false }) }, data, grid });
  check("kapatılan widget yerleşmez", p.length === 0);
}

/* 8 — Kritik widget dışarıda kalırsa devralma sinyali üretilir */
{
  const widgets = [W("crit", 95, 100, ["1x1"])];
  check("kritik widget yerleşmemişse devralma istenir", hasPreemption(widgets, {}, data, []));
  check("yerleşmişse istenmez", !hasPreemption(widgets, {}, data, [{ widgetId: "crit", size: "1x1", col: 0, row: 0, w: 1, h: 1, score: 99, pinned: false }]));
}

/* 9 — Kullanıcının önceliği sonucu değiştirir */
{
  const w = W("a", 0, 50, ["2x2", "2x1", "1x1"]);
  const low = compose({ widgets: [w], config: { a: cfg({ id: "a", priority: 0 }) }, data, grid });
  const high = compose({ widgets: [w], config: { a: cfg({ id: "a", priority: 100 }) }, data, grid });
  check("öncelik yükseltilince yuva büyür", sizeRank(high) > sizeRank(low), [sizeRank(low), sizeRank(high)]);
  function sizeRank(p: Placement[]) { const s = at(p, "a")?.size ?? "1x1"; return { "1x1": 1, "2x1": 2, "1x2": 2, "2x2": 4, "4x2": 8 }[s]; }
}

/* 10 — Puan formülü */
{
  const s = scoreOf(W("a", 100, 0, ["1x1"]), undefined, data);
  check("yalnızca öncelik: 0.4 ağırlık", Math.round(s.score) === 40, s.score);
}

console.log(failed === 0 ? "\ntüm testler geçti" : `\n${failed} test başarısız`);
process.exit(failed === 0 ? 0 : 1);
