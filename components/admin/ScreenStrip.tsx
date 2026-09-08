"use client";

import { useRouter } from "next/navigation";
import { APP_HUE, APP_IDS, APP_NAME, type AppId } from "@/components/kokpit/ids";

export interface StripScreen {
  id: string;
  title: string;
  tint: string;
  enabled: boolean;
}

interface Column {
  key: string;
  apps: { id: AppId; title: string; enabled: boolean; index: number | null }[];
}

/** Güvertede bir sütunu paylaşan uygulamalar — Deck ile aynı kural */
const PAIRS: AppId[][] = [["mail", "chat"]];

/**
 * Güverte diyagramı — konsolun imza öğesi.
 *
 * Cihazın gerçek en-boy oranında (1973×426) çizilir: solda dar omurga, sağda
 * panellerin sırası. Posta ile Sohbet bir sütunu paylaşır, medyanın ekran
 * satırı yoktur ama güvertede durur. Sıralama değiştikçe canlı güncellenir,
 * böylece kaydetmeden önce cihazda ne olacağı görülür.
 */
export function ScreenStrip({ screens, onPick }: { screens: StripScreen[]; onPick?: (id: string) => void }) {
  const router = useRouter();
  const go = onPick ?? ((id: string) => router.push(`/admin/screens#${id}`));

  const onDeck = screens.filter((s) => s.enabled && (APP_IDS as string[]).includes(s.id));
  const order = onDeck.map((s) => s.id as AppId);
  if (!order.includes("media")) order.push("media");

  const seen = new Set<AppId>();
  const columns: Column[] = [];
  for (const id of order) {
    if (seen.has(id)) continue;
    const pair = PAIRS.find((p) => p.includes(id) && p.every((x) => order.includes(x)));
    const ids = pair ?? [id];
    ids.forEach((x) => seen.add(x));
    columns.push({
      key: ids.join("+"),
      apps: ids.map((x) => {
        const row = screens.find((s) => s.id === x);
        const i = onDeck.findIndex((s) => s.id === x);
        return { id: x, title: row?.title ?? APP_NAME[x], enabled: row?.enabled ?? true, index: i < 0 ? null : i + 1 };
      }),
    });
  }

  const offDeck = screens.filter((s) => !s.enabled || !(APP_IDS as string[]).includes(s.id));

  return (
    <>
      <div className="a-strip-device">
        <div className="a-strip-spine" aria-hidden>
          <span className="a-strip-clock" />
          <span className="a-strip-dots">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="a-strip-keys">
            <i />
            <i />
          </span>
        </div>
        <div className="a-strip-screens">
          {columns.map((col) => (
            <div key={col.key} className="a-strip-col">
              {col.apps.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="a-strip-screen"
                  onClick={() => go(a.id)}
                  title={`${a.title} — ayarları`}
                  style={{
                    background: `linear-gradient(180deg, hsl(${APP_HUE[a.id]} / 0.24), hsl(${APP_HUE[a.id]} / 0.06))`,
                    boxShadow: `inset 0 0 0 1px hsl(${APP_HUE[a.id]} / 0.34)`,
                  }}
                >
                  <span className="a-strip-name">{a.title}</span>
                  <span className="a-strip-index">
                    {a.index ? String(a.index).padStart(2, "0") : "sabit"}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {offDeck.length > 0 && (
        <p className="a-faint mt-3 text-[12px]">
          Güvertede değil:{" "}
          {offDeck.map((s, i) => (
            <span key={s.id}>
              {i > 0 ? ", " : ""}
              {s.title}
              {s.enabled ? " (yalnızca /classic)" : " (kapalı)"}
            </span>
          ))}
        </p>
      )}
    </>
  );
}
