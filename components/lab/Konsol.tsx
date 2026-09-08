"use client";

import { useRef, useState } from "react";
import type { Gear } from "@/lib/kokpit/model";
import { runShortcutOnAgent } from "@/lib/data/runShortcut";
import { useShortcuts } from "@/lib/data/useShortcuts";
import type { LabModel } from "@/lib/kokpit/model";

/**
 * KONSOL — işlenmiş ön panel.
 *
 * Ekran bir arayüz değil, bir cihazın yüzü. Etiketler kazınmış, sayılar nokta
 * matris göstergede, seviyeler gerçekten hareket eden metrelerde. Veri
 * "gösterilmez", ölçülür. İkinci panel kısayolların jak alanıdır.
 */

const SEGMENTS = 18;

/** Cam pencerenin altındaki yatay seviye şeridi */
function Meter({ value }: { value: number }) {
  const lit = Math.round((Math.max(0, Math.min(100, value)) / 100) * SEGMENTS);
  return (
    <span className="k-meter" aria-hidden>
      {Array.from({ length: SEGMENTS }).map((_, i) => {
        const on = i < lit;
        const hot = i >= SEGMENTS - 3;
        return <i key={i} className={`${on ? "on" : ""} ${hot ? "hot" : ""}`} />;
      })}
    </span>
  );
}

function Channel({
  label,
  caption,
  read,
  unit,
  value,
  sub,
  alarm,
  buttons,
}: {
  label: string;
  caption: string;
  read: string;
  unit?: string;
  value: number;
  sub: string;
  alarm?: boolean;
  buttons?: { key: string; text: string; on?: boolean; onPress?: () => void }[];
}) {
  return (
    <section className={`k-ch ${alarm ? "alarm" : ""}`}>
      <h2 className="k-label">{label}</h2>
      <div className="k-glass">
        <span className="k-cap">{caption}</span>
        <span className="k-readout">
          <span className="k-num">{read}</span>
          {unit && <span className="k-unit">{unit}</span>}
        </span>
        <Meter value={value} />
      </div>
      <p className="k-sub">{sub}</p>
      <div className="k-btns">
        {(buttons ?? []).map((b) => (
          <button key={b.key} className={b.on ? "on" : ""} onClick={b.onPress} disabled={!b.onPress}>
            {b.text}
          </button>
        ))}
      </div>
    </section>
  );
}

export default function Konsol({ model, gear }: { model: LabModel; gear: Gear }) {
  const { data: groups } = useShortcuts();
  const [page, setPage] = useState(0);
  const [dx, setDx] = useState(0);
  const [fired, setFired] = useState<string | null>(null);
  const drag = useRef<{ x: number } | null>(null);

  const os = model.os;
  const claudeWaiting = os.claude.sessions.filter((s) => s.status === "waiting").length;
  const claudeLive = os.claude.sessions.filter((s) => s.status !== "closed").length;
  const chatWaiting = model.items.filter((i) => i.app === "chat").length;
  const unread = os.mail.accounts.reduce((n, a) => n + a.unread, 0);
  const worst = model.ambient.servers.reduce((m, s) => Math.max(m, s.worst), 0);
  const broken = model.ambient.servers.filter((s) => !s.ok).length;
  const items = groups.flatMap((g) => g.items).slice(0, 8);

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (drag.current) setDx(e.clientX - drag.current.x);
  };
  const onUp = () => {
    if (!drag.current) return;
    const moved = dx;
    drag.current = null;
    setDx(0);
    if (Math.abs(moved) > 90) setPage((p) => Math.max(0, Math.min(1, p + (moved < 0 ? 1 : -1))));
  };

  const patch = (id: string, run: Parameters<typeof runShortcutOnAgent>[1]) => {
    setFired(id);
    void runShortcutOnAgent(id, run).finally(() => setTimeout(() => setFired(null), 1400));
  };

  return (
    <div className={`k-root ${gear}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <div className="k-track" style={{ transform: `translate3d(calc(${-page * 50}% + ${dx}px), 0, 0)` }}>
        <div className="k-panel">
          <aside className="k-master">
            <div className="k-clock">{fmtTime(os.now)}</div>
            <div className="k-day">{fmtDate(os.now)}</div>
            <div className="k-lamps">
              {(["media", "shortcuts", "claude", "mail"] as const).map((c) => (
                <span key={c} className={`k-lamp ${os.online.includes(c) ? "on" : ""}`}>
                  <i />
                  {c === "media" ? "medya" : c === "shortcuts" ? "kısayol" : c === "claude" ? "claude" : "posta"}
                </span>
              ))}
            </div>
            <div className="k-screws">
              <i />
              <i />
            </div>
          </aside>

          <div className="k-channels">
            <Channel
              label="Claude"
              caption={claudeWaiting ? "bekleyen" : "canlı"}
              read={String(claudeWaiting || claudeLive)}
              unit={claudeWaiting ? "soru" : "oturum"}
              value={claudeLive ? (claudeWaiting ? 100 : 45) : 0}
              alarm={claudeWaiting > 0}
              sub={model.items.find((i) => i.app === "claude")?.detail ?? "sessiz"}
              buttons={[{ key: "a", text: "aç", on: claudeWaiting > 0 }]}
            />
            <Channel
              label="Sohbet"
              caption="yanıt bekleyen"
              read={String(chatWaiting)}
              unit="bekler"
              value={Math.min(100, chatWaiting * 25)}
              sub={model.items.find((i) => i.app === "chat")?.title ?? "kimse beklemiyor"}
              buttons={[{ key: "a", text: "aç" }]}
            />
            <Channel
              label="Posta"
              caption="gelen kutusu"
              read={String(unread)}
              unit="okunmadı"
              value={Math.min(100, unread * 4)}
              sub={model.items.find((i) => i.app === "mail")?.detail ?? "kutu boş"}
              buttons={[{ key: "a", text: "aç" }]}
            />
            <Channel
              label="Altyapı"
              caption={broken > 0 ? "sorunlu" : "en yüklü"}
              read={`${Math.round(worst)}`}
              unit="%"
              value={worst}
              alarm={broken > 0}
              sub={broken > 0 ? `${broken} sunucuda sorun` : `${model.ambient.services} servis ayakta`}
              buttons={[{ key: "a", text: "filo" }]}
            />
            <Channel
              label="Plan"
              caption="bu oturum"
              read={`${model.ambient.usagePct}`}
              unit="%"
              value={model.ambient.usagePct}
              sub={model.ambient.usageLabel || "oturum"}
            />
            <Channel
              label="Medya"
              caption={os.media.playing ? "çalıyor" : "duraklatıldı"}
              read={os.media.track ? (os.media.playing ? "▶" : "II") : "–"}
              value={os.media.track ? 62 : 0}
              sub={os.media.track ? `${os.media.track.title} · ${os.media.track.artist}` : "sessiz"}
              buttons={[
                { key: "p", text: "◀◀" },
                { key: "n", text: "▶▶" },
              ]}
            />
          </div>
        </div>

        {/* İkinci panel: kısayollar jak alanı */}
        <div className="k-panel">
          <aside className="k-master">
            <div className="k-plate">patch</div>
            <div className="k-day">kısayollar</div>
            <div className="k-screws">
              <i />
              <i />
            </div>
          </aside>
          <div className="k-patch">
            {items.map((it) => (
              <button
                key={it.id}
                className={`k-jack ${fired === it.id ? "fired" : ""}`}
                onClick={() => patch(it.id, it.run)}
              >
                <span className="k-socket" />
                <span className="k-jack-label">{it.label}</span>
                <span className="k-jack-sub">{it.run.kind === "ssh" ? it.run.host : "proje"}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <span className="k-pages" aria-hidden>
        <i className={page === 0 ? "on" : ""} />
        <i className={page === 1 ? "on" : ""} />
      </span>
    </div>
  );
}

const fmtTime = (ms: number) =>
  ms ? new Date(ms).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "--:--";
const fmtDate = (ms: number) =>
  ms ? new Date(ms).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) : "";
