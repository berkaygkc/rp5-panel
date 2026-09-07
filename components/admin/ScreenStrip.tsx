"use client";

import { useRouter } from "next/navigation";

export interface StripScreen { id: string; title: string; tint: string; enabled: boolean }

/**
 * Kiosk düzeninin şerit diyagramı — konsolun imza öğesi.
 * Cihazın gerçek en-boy oranında (1973×426) çizilir: solda sabit rail, sağda
 * ekranların sırası. Sıralama değiştikçe canlı güncellenir, böylece kaydetmeden
 * önce cihazda ne olacağı görülür.
 */
export function ScreenStrip({ screens, onPick }: { screens: StripScreen[]; onPick?: (id: string) => void }) {
  const router = useRouter();
  const go = onPick ?? ((id: string) => router.push(`/admin/screens#${id}`));
  return (
    <div className="a-strip-device">
      <div className="a-strip-rail" aria-hidden>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "rgba(255,255,255,.5)" }} />
        <span className="flex flex-col gap-1">
          <span className="h-1 w-6 rounded-full" style={{ background: "rgba(255,255,255,.28)" }} />
          <span className="h-1 w-6 rounded-full" style={{ background: "rgba(255,255,255,.16)" }} />
        </span>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "rgba(255,255,255,.2)" }} />
      </div>
      <div className="a-strip-screens">
        {screens.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className="a-strip-screen"
            data-off={!s.enabled}
            onClick={() => go(s.id)}
            title={s.enabled ? `${s.title} — düzenle` : `${s.title} — kiosk'ta gizli`}
            style={{
              background: `linear-gradient(180deg, color-mix(in srgb, ${s.tint} 26%, #101216), color-mix(in srgb, ${s.tint} 9%, #0b0d11))`,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${s.tint} 34%, transparent)`,
            }}
          >
            <span className="a-strip-name">{s.title}</span>
            <span className="a-strip-index">{s.enabled ? String(i + 1).padStart(2, "0") : "gizli"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
