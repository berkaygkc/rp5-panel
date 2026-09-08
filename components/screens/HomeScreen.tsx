"use client";

import { WidgetGrid } from "@/components/os/WidgetGrid";
import { useOsData } from "@/lib/data/useOsData";
import { useWidgetConfig } from "@/lib/data/useWidgetConfig";
import { WIDGETS } from "@/lib/os/registry";
import { useComposition } from "@/lib/os/useComposition";
import { useSurface } from "@/lib/os/useSurface";

/**
 * Pano — işletim sisteminin ana ekranı.
 *
 * Burada sabit bir düzen yoktur. Widget'lar önem sırasına göre yerleşir:
 * önemli olan büyür, sessiz olan küçülür, gösterecek bir şeyi olmayan hiç
 * görünmez. Saat ve hava durumu boşluğu doldurur ve bir şey olduğunda yerini
 * bırakır. Izgara da yüzeyden türer; aynı pano telefonda tek sütun olur.
 */
export default function HomeScreen() {
  const data = useOsData();
  const { ref, info } = useSurface();
  const config = useWidgetConfig();
  const placements = useComposition(WIDGETS, config, data, info.grid);

  return (
    <div ref={ref} className="h-full w-full p-5">
      <WidgetGrid
        placements={placements}
        data={data}
        cols={info.grid.cols}
        rows={info.grid.rows}
        scroll={info.scroll}
      />
    </div>
  );
}
