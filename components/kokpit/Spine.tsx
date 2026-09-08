"use client";

import type { ReactNode } from "react";
import { useNow } from "@/lib/data/useNow";
import type { LabModel } from "@/lib/kokpit/model";

/**
 * Omurga — ekranın hiç değişmeyen sol kenarı, olabilecek en dar hâliyle.
 *
 * Saat iki satırda durur (üstte saat, altta dakika), böylece 104 piksellik bir
 * şerit yeter ve kalan genişlik güverteye kalır. Altında yetenek lambaları,
 * hava ve kabuk düğmeleri. Saniyeyi burada tutuyoruz: modelin geri kalanı
 * on saniyede bir tazelenir, saat her saniye.
 */
export default function Spine({
  model,
  badge,
  actions,
}: {
  model: LabModel;
  /** Bildirim rozeti (kabuk verir) */
  badge?: ReactNode;
  /** Alt köşedeki kabuk düğmeleri */
  actions?: ReactNode;
}) {
  const tick = useNow(1000)?.getTime() ?? model.os.now;
  const d = tick ? new Date(tick) : null;
  const hh = d ? String(d.getHours()).padStart(2, "0") : "--";
  const mm = d ? String(d.getMinutes()).padStart(2, "0") : "--";

  return (
    <aside className="k4-spine">
      <div className="k4-clock">
        <span className="k4-hh">{hh}</span>
        <span className="k4-mm">{mm}</span>
      </div>
      <div className="k4-date">
        {d ? d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) : ""}
        <span>{d ? d.toLocaleDateString("tr-TR", { weekday: "short" }) : ""}</span>
      </div>

      <div className="k4-lamps" title="çekirdeğe bağlı yetenekler">
        {(["claude", "shortcuts", "mail", "media"] as const).map((c) => (
          <i key={c} className={model.os.online.includes(c) ? "on" : ""} />
        ))}
      </div>

      {model.os.weather.available && (
        <div className="k4-wx">
          <span className="k4-temp">{model.os.weather.tempC}°</span>
        </div>
      )}

      <div className="k4-spine-foot">
        {badge}
        {actions}
      </div>
    </aside>
  );
}
