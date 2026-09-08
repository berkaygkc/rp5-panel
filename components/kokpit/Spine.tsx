"use client";

import type { ReactNode } from "react";
import type { LabModel } from "@/lib/kokpit/model";

/**
 * Omurga — ekranın hiç değişmeyen sol kenarı.
 *
 * Saat, tarih, çekirdek bağlantısı, hava ve tek cümlelik hüküm. Güverte ne
 * yaparsa yapsın bu sütun yerinde durur; kiosk'un "burada bir cihaz var"
 * duygusu buradan gelir. Bildirimler ve kabuk düğmeleri dışarıdan verilir.
 */
export default function Spine({
  model,
  notices,
  actions,
}: {
  model: LabModel;
  /** Bildirim yığını (kabuk verir; laboratuvarda boş) */
  notices?: ReactNode;
  /** Alt köşedeki kabuk düğmeleri */
  actions?: ReactNode;
}) {
  const os = model.os;
  return (
    <aside className="k4-spine">
      <div className="k4-time">{fmtTime(os.now)}</div>
      <div className="k4-date">{fmtDate(os.now)}</div>

      <div className="k4-lamps" title="çekirdeğe bağlı yetenekler">
        {(["claude", "shortcuts", "mail", "media"] as const).map((c) => (
          <i key={c} className={os.online.includes(c) ? "on" : ""} />
        ))}
      </div>

      {os.weather.available && (
        <div className="k4-weather">
          <span className="k4-temp">{os.weather.tempC}°</span>
          <span className="k4-wlabel">{os.weather.label}</span>
        </div>
      )}

      {notices}

      <div className="k4-spine-foot">
        <div className="k4-verdict">
          {model.criticals > 0
            ? `${model.criticals} sorun`
            : model.waiting > 0
              ? `${model.waiting} bekliyor`
              : "her şey yolunda"}
        </div>
        {actions}
      </div>
    </aside>
  );
}

const fmtTime = (ms: number) =>
  ms ? new Date(ms).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "--:--";
const fmtDate = (ms: number) =>
  ms ? new Date(ms).toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" }) : "";
