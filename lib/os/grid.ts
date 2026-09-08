import type { GridSize, SurfaceClass } from "./types";

/**
 * Yüzey sınıfı ve ızgara türetimi.
 *
 * Sabit 1973×426 kuralı yok: her yüzey kendi ölçüsüne bakıp ızgarasını çıkarır.
 * Widget'lar boyutlarını piksel değil hücre cinsinden bildirdiği için kompozisyon
 * aynı kalır; yalnızca tuval değişir.
 */
export interface SurfaceInfo {
  surface: SurfaceClass;
  grid: GridSize;
  /** Dikeyde taşarsa kaydırılır (telefon) */
  scroll: boolean;
  /** Gezinme yerleşimi */
  nav: "rail" | "tabs";
}

export function surfaceFor(width: number, height: number): SurfaceInfo {
  // Şerit: alçak ve çok geniş — masadaki cihaz
  if (width >= 1400 && height <= 560) {
    return { surface: "strip", grid: { cols: 4, rows: 2 }, scroll: false, nav: "rail" };
  }
  if (width >= 1180) {
    return { surface: "desktop", grid: { cols: 4, rows: 3 }, scroll: false, nav: "rail" };
  }
  if (width >= 900) {
    return { surface: "desktop", grid: { cols: 3, rows: 3 }, scroll: false, nav: "rail" };
  }
  if (width >= 620) {
    return { surface: "tablet", grid: { cols: 2, rows: 4 }, scroll: true, nav: "tabs" };
  }
  return { surface: "phone", grid: { cols: 1, rows: 8 }, scroll: true, nav: "tabs" };
}
