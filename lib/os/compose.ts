import { SIZE_DIMS, sizeArea, type GridSize, type OsData, type Placement, type WidgetConfig, type WidgetMeta } from "./types";

/**
 * Kompozisyon motoru — saf fonksiyon.
 *
 * Girdi: widget'lar, kullanıcının ayarı, canlı veri ve ızgara ölçüsü.
 * Çıktı: yerleşim. Yan etkisi yok, bu yüzden test edilebilir ve yönetim
 * panelinde "sunucu düşerse pano neye benzer" diye senaryo denenebilir.
 *
 * Puan, kullanıcının verdiği temel önemle verinin ürettiği aciliyetin
 * ağırlıklı toplamıdır. Yüksek puan daha büyük yuva ister; eşiğin altındaki
 * widget hiç yerleşmez. Boşlukları saat ve hava durumu gibi dolgu widget'ları
 * kapatır, önemli bir şey geldiğinde yerlerini bırakırlar.
 */

const WEIGHT_PRIORITY = 0.4;
const WEIGHT_URGENCY = 0.6;

/** Puan bandına göre bir widget'ın kaplayabileceği en fazla hücre */
function areaCap(score: number): number {
  if (score >= 68) return 4;
  if (score >= 42) return 2;
  return 1;
}

export function scoreOf(def: WidgetMeta, cfg: WidgetConfig | undefined, data: OsData): { score: number; urgency: number } {
  const urgency = Math.max(0, Math.min(100, def.urgency(data)));
  const priority = cfg?.priority ?? def.priority;
  return { score: WEIGHT_PRIORITY * priority + WEIGHT_URGENCY * urgency, urgency };
}

class Board {
  private cells: boolean[];
  constructor(private grid: GridSize) {
    this.cells = new Array(grid.cols * grid.rows).fill(false);
  }
  private idx(col: number, row: number) {
    return row * this.grid.cols + col;
  }
  fits(col: number, row: number, w: number, h: number): boolean {
    if (col + w > this.grid.cols || row + h > this.grid.rows) return false;
    for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) if (this.cells[this.idx(c, r)]) return false;
    return true;
  }
  take(col: number, row: number, w: number, h: number): void {
    for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) this.cells[this.idx(c, r)] = true;
  }
  /** Satır satır tarayıp sığdığı ilk yeri bulur */
  find(w: number, h: number): { col: number; row: number } | null {
    for (let row = 0; row + h <= this.grid.rows; row++) {
      for (let col = 0; col + w <= this.grid.cols; col++) {
        if (this.fits(col, row, w, h)) return { col, row };
      }
    }
    return null;
  }
  get free(): number {
    return this.cells.filter((x) => !x).length;
  }
}

export interface ComposeInput {
  widgets: WidgetMeta[];
  config: Record<string, WidgetConfig | undefined>;
  data: OsData;
  grid: GridSize;
}

export function compose({ widgets, config, data, grid }: ComposeInput): Placement[] {
  const board = new Board(grid);
  const out: Placement[] = [];

  const candidates = widgets
    .map((def) => {
      const cfg = config[def.id];
      const { score, urgency } = scoreOf(def, cfg, data);
      const allowed = (cfg?.sizes?.length ? cfg.sizes : def.sizes).filter((s) => def.sizes.includes(s));
      return { def, cfg, score, urgency, allowed };
    })
    .filter((c) => c.cfg?.enabled !== false)
    // Aciliyeti sıfır olan widget yer kaplamaz; dolgular her zaman aday kalır
    .filter((c) => c.urgency > 0 || c.def.filler)
    .filter((c) => c.allowed.length > 0);

  // 1) Sabitlenmiş widget'lar: kullanıcının koyduğu yerde kalırlar
  for (const c of candidates) {
    const pin = c.cfg?.pinned;
    if (!pin) continue;
    const dims = SIZE_DIMS[pin.size];
    if (!board.fits(pin.col, pin.row, dims.w, dims.h)) continue;
    board.take(pin.col, pin.row, dims.w, dims.h);
    out.push({ widgetId: c.def.id, size: pin.size, col: pin.col, row: pin.row, w: dims.w, h: dims.h, score: c.score, pinned: true });
  }
  const placed = new Set(out.map((p) => p.widgetId));

  // 2) Kalanlar puana göre; dolgular en sona, boşluk kalırsa
  const rest = candidates
    .filter((c) => !placed.has(c.def.id))
    .sort((a, b) => {
      if (Boolean(a.def.filler) !== Boolean(b.def.filler)) return a.def.filler ? 1 : -1;
      return b.score - a.score;
    });

  for (const c of rest) {
    const cap = c.def.filler ? 4 : areaCap(c.score);
    const sizes = c.allowed
      .filter((s) => SIZE_DIMS[s].w <= grid.cols && SIZE_DIMS[s].h <= grid.rows)
      .filter((s) => sizeArea(s) <= cap)
      .sort((a, b) => sizeArea(b) - sizeArea(a));
    for (const size of sizes) {
      const dims = SIZE_DIMS[size];
      const spot = board.find(dims.w, dims.h);
      if (!spot) continue;
      board.take(spot.col, spot.row, dims.w, dims.h);
      out.push({ widgetId: c.def.id, size, col: spot.col, row: spot.row, w: dims.w, h: dims.h, score: c.score, pinned: false });
      break;
    }
    if (board.free === 0) break;
  }

  return out.sort((a, b) => a.row - b.row || a.col - b.col);
}

/** İki yerleşim aynı mı (widget, boyut ve konum bazında) */
export function samePlacement(a: Placement[], b: Placement[]): boolean {
  if (a.length !== b.length) return false;
  const key = (p: Placement) => `${p.widgetId}:${p.size}:${p.col}:${p.row}`;
  const sa = a.map(key).sort();
  const sb = b.map(key).sort();
  return sa.every((k, i) => k === sb[i]);
}

/** Yerleşimde olmayan ama kritik puana ulaşmış bir widget var mı */
export function hasPreemption(widgets: WidgetMeta[], config: Record<string, WidgetConfig | undefined>, data: OsData, current: Placement[]): boolean {
  const shown = new Set(current.map((p) => p.widgetId));
  return widgets.some((def) => {
    if (shown.has(def.id) || config[def.id]?.enabled === false) return false;
    return scoreOf(def, config[def.id], data).score >= 90;
  });
}
