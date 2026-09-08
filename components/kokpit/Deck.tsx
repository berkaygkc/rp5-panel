"use client";

import { useCallback, useState } from "react";
import { Mail, MessagesSquare, Music2, Server, Sparkles, Zap, type LucideIcon } from "lucide-react";
import { ChevronLeft } from "lucide-react";
import PanelArt from "./PanelArt";
import PanelFull, { Art, Spark, fmtClock, initials } from "./PanelFull";
import { APP_HUE, APP_IDS, APP_NAME, type AppId } from "./ids";
import { runShortcutOnAgent } from "@/lib/data/runShortcut";
import { useMedia } from "@/lib/data/useMedia";
import { useShortcuts } from "@/lib/data/useShortcuts";
import { waited, type LabModel } from "@/lib/kokpit/model";

/**
 * Güverte — altı panelin ızgarası.
 *
 * Izgara altı sütun genişliğinde düşünülmüştür: bir uygulama bir sütunun iki
 * satırını da kaplar (6x2), iki uygulama bir sütunu paylaşabilir (6x1 + 6x1).
 * Posta ile Sohbet varsayılan olarak paylaşır, böylece güverteye bir sütun
 * genişliği kazandırır.
 *
 * Açılma hem yatay hem dikeydir: sütun genişler, paylaşılan bir panel
 * odaklandığında komşusu ince bir bara iner. Geçiş `grid-template-*` üzerinden
 * yapılır ve içerik, kutu yerine oturana kadar beklediği için sarsıntı olmaz.
 */

const ICON: Record<AppId, LucideIcon> = {
  claude: Sparkles,
  infra: Server,
  mail: Mail,
  chat: MessagesSquare,
  media: Music2,
  shortcuts: Zap,
};

/** Bir sütunu paylaşan uygulamalar */
const PAIRS: AppId[][] = [["mail", "chat"]];

interface Column {
  key: string;
  apps: AppId[];
}

function buildColumns(order: AppId[]): Column[] {
  const list = order.length ? order : APP_IDS;
  const seen = new Set<AppId>();
  const cols: Column[] = [];
  for (const id of list) {
    if (seen.has(id)) continue;
    const pair = PAIRS.find((p) => p.includes(id) && p.every((x) => list.includes(x)));
    if (pair) {
      pair.forEach((x) => seen.add(x));
      cols.push({ key: pair.join("+"), apps: [...pair] as AppId[] });
    } else {
      seen.add(id);
      cols.push({ key: id, apps: [id] });
    }
  }
  return cols;
}

export default function Deck({
  model,
  focus,
  setFocus,
  sub,
  setSub,
  order,
}: {
  model: LabModel;
  focus: AppId | null;
  setFocus: (id: AppId | null) => void;
  sub: string | null;
  setSub: (v: string | null) => void;
  /** Yönetim panelindeki ekran sırası; medya listede olmasa da güvertede durur */
  order?: AppId[];
}) {
  const media = useMedia();
  const { data: groups } = useShortcuts();
  const [fired, setFired] = useState<Record<string, "run" | "ok" | "fail">>({});
  const shortcuts = groups.flatMap((g) => g.items);
  const os = model.os;

  const open = useCallback(
    (id: AppId) => {
      setFocus(focus === id ? null : id);
      setSub(null);
    },
    [focus, setFocus, setSub]
  );

  const run = (id: string, action: Parameters<typeof runShortcutOnAgent>[1]) => {
    setFired((f) => ({ ...f, [id]: "run" }));
    void runShortcutOnAgent(id, action).then((r) => {
      setFired((f) => ({ ...f, [id]: r.ok ? "ok" : "fail" }));
      setTimeout(() => setFired((f) => ({ ...f, [id]: undefined as never })), 1800);
    });
  };

  const wanted = order?.length ? [...order] : [...APP_IDS];
  if (!wanted.includes("media")) wanted.push("media");
  const columns = buildColumns(wanted);

  const focusCol = columns.findIndex((c) => focus && c.apps.includes(focus));
  const gridTemplateColumns = columns
    .map((_, i) => (i === focusCol ? "34fr" : focusCol >= 0 ? "6fr" : "10fr"))
    .join(" ");
  const pairIndex = focusCol >= 0 && columns[focusCol].apps.length > 1 ? columns[focusCol].apps.indexOf(focus!) : -1;
  const gridTemplateRows = pairIndex === 0 ? "1fr 84px" : pairIndex === 1 ? "84px 1fr" : "1fr 1fr";

  const badges = counters(model);

  return (
    <div className="k4-deck" style={{ gridTemplateColumns, gridTemplateRows }}>
      {columns.map((col, ci) =>
        col.apps.map((id, ri) => {
          const on = focus === id;
          const half = col.apps.length > 1;
          /* Odaklanan panelin sütun arkadaşı: dar değil, ince bir bara iner —
           * o yüzden özetini tek satırda göstermeye devam eder. */
          const sibling = half && ci === focusCol && !on;
          const b = badges[id];
          const Icon = ICON[id];
          return (
            <section
              key={id}
              className={`k4-panel ${on ? "on" : ""} ${focus && !on ? "off" : ""} ${half ? "half" : ""} ${sibling ? "sibling" : ""}`}
              style={{
                ["--hue" as string]: APP_HUE[id],
                gridColumn: ci + 1,
                gridRow: half ? ri + 1 : "1 / span 2",
              }}
            >
              <PanelArt app={id} artwork={id === "media" ? media.data.track?.artworkUrl ?? null : null} />
              <span className="k4-sheen" aria-hidden />

              <header className="k4-head">
                <button className="k4-icon" onClick={() => open(id)} aria-label={APP_NAME[id]}>
                  <Icon size={17} strokeWidth={2.2} />
                </button>
                <span className="k4-name">{APP_NAME[id]}</span>
                {b.count > 0 && <span className={`k4-badge ${b.tone}`}>{b.count}</span>}
                {on && sub && (
                  <button
                    className="k4-back"
                    onClick={() => setSub(sub.includes("|") ? sub.split("|")[0] : null)}
                    aria-label="Geri"
                  >
                    <ChevronLeft size={15} strokeWidth={2.4} />
                  </button>
                )}
              </header>

              <div className="k4-body">
                {on ? (
                  <PanelFull
                    app={id}
                    model={model}
                    sub={sub}
                    setSub={setSub}
                    media={media}
                    shortcuts={shortcuts}
                    fired={fired}
                    run={run}
                  />
                ) : (
                  <Compact app={id} model={model} media={media} shortcuts={shortcuts} half={half} />
                )}
              </div>

              {!on && <button className="k4-hit" onClick={() => open(id)} aria-label={`${APP_NAME[id]} panelini aç`} />}
            </section>
          );
        })
      )}
      {os.now === 0 && <span className="sr-only">yükleniyor</span>}
    </div>
  );
}

/** Panel rozetleri — kaç iş bekliyor ve ne kadar acil */
function counters(model: LabModel): Record<AppId, { count: number; tone: "crit" | "warn" | "calm" }> {
  const os = model.os;
  const chat = model.items.filter((i) => i.app === "chat").length;
  const infra = model.items.filter((i) => i.app === "infra").length;
  const waiting = os.claude.sessions.filter((s) => s.status === "waiting").length;
  return {
    claude: { count: waiting, tone: waiting ? "warn" : "calm" },
    infra: { count: infra, tone: infra ? "crit" : "calm" },
    mail: { count: os.mail.accounts.reduce((n, a) => n + a.unread, 0), tone: "calm" },
    chat: { count: chat, tone: chat ? "warn" : "calm" },
    media: { count: 0, tone: "calm" },
    shortcuts: { count: 0, tone: "calm" },
  };
}

/* ── Kapalı panel: sayı, canlı grafik, tek satır ───────────────────────── */

function Compact({
  app,
  model,
  media,
  shortcuts,
  half,
}: {
  app: AppId;
  model: LabModel;
  media: ReturnType<typeof useMedia>;
  shortcuts: ReturnType<typeof useShortcuts>["data"][number]["items"];
  half: boolean;
}) {
  const os = model.os;
  const rows = half ? 3 : 8;

  if (app === "claude") {
    const waiting = os.claude.sessions.filter((s) => s.status === "waiting");
    const live = os.claude.sessions.filter((s) => s.status !== "closed");
    const hero = waiting[0] ?? live[0];
    return (
      <div className="k4-c">
        <Big value={String(waiting.length || live.length)} unit={waiting.length ? "soru" : "oturum"} tone={waiting.length ? "warn" : undefined} />
        <div className="k4-mid">
          {live.slice(0, rows).map((s) => (
            <span key={s.id} className="k4-mini">
              <i className={`k4-pulse ${s.status}`} />
              <b>{s.project}</b>
              <em>{s.status === "waiting" ? "soruyor" : "çalışıyor"}</em>
            </span>
          ))}
        </div>
        <div className="k4-foot">
          <p className="k4-c-title">{hero?.project ?? "sessiz"}</p>
          <p className="k4-c-sub">{waiting.length ? "sizi bekliyor" : "çalışıyor"}</p>
        </div>
      </div>
    );
  }

  if (app === "infra") {
    const faults = model.items.filter((i) => i.app === "infra");
    return (
      <div className="k4-c">
        <Big value={String(faults.length || model.ambient.servers.length)} unit={faults.length ? "sorun" : "sunucu"} tone={faults.length ? "crit" : undefined} />
        <div className="k4-mid graph">
          <Spark values={model.ambient.ridges[0]?.values ?? []} />
        </div>
        <div className="k4-foot">
          <div className="k4-dots">
            {model.ambient.servers.map((s) => (
              <i key={s.name} className={s.ok ? "" : "bad"} />
            ))}
          </div>
          <p className="k4-c-title">{faults[0]?.title ?? `${model.ambient.services} servis ayakta`}</p>
        </div>
      </div>
    );
  }

  if (app === "mail") {
    const unread = os.mail.messages.filter((m) => m.unseen);
    return (
      <div className="k4-c">
        <Big value={String(os.mail.accounts.reduce((n, a) => n + a.unread, 0))} unit="okunmadı" />
        <div className="k4-mid">
          {unread.slice(0, rows).map((m) => (
            <span key={m.pk} className="k4-mini">
              <i className="k4-unread" />
              <b>{m.fromName || m.fromAddress}</b>
              <em>{fmtClock(m.receivedAt)}</em>
            </span>
          ))}
        </div>
        <div className="k4-foot">
          <p className="k4-c-title">{unread[0]?.fromName || unread[0]?.fromAddress || "kutu boş"}</p>
          {!half && <p className="k4-c-sub">{unread[0]?.subject ?? ""}</p>}
        </div>
      </div>
    );
  }

  if (app === "chat") {
    const items = model.items.filter((i) => i.app === "chat");
    return (
      <div className="k4-c">
        <Big value={String(items.length)} unit="bekliyor" tone={items.length ? "warn" : undefined} />
        <div className="k4-mid">
          {items.slice(0, rows).map((i) => (
            <span key={i.id} className="k4-mini">
              <span className="k4-av sm">{initials(i.title)}</span>
              <b>{i.title}</b>
              <em>{waited(i.since, os.now)}</em>
            </span>
          ))}
          {items.length === 0 && <span className="k4-quiet">kimse yanıt beklemiyor</span>}
        </div>
        <div className="k4-foot">
          <p className="k4-c-sub">
            {os.chat.chatwoot.configured && !os.chat.chatwoot.error ? "chatwoot ✓" : "chatwoot —"} ·{" "}
            {os.chat.mattermost.configured && !os.chat.mattermost.error ? "mattermost ✓" : "mattermost —"}
          </p>
        </div>
      </div>
    );
  }

  if (app === "media") {
    const t = media.data.track;
    return (
      <div className="k4-c">
        <div className="k4-mid center">{t ? <Art track={t} size={half ? 56 : 96} playing={media.data.playing} /> : <Wave />}</div>
        <div className="k4-foot">
          <p className="k4-c-title">{t?.title ?? "sessiz"}</p>
          <p className="k4-c-sub">{t?.artist ?? "çalan bir şey yok"}</p>
        </div>
      </div>
    );
  }

  const top = [...shortcuts].sort((a, b) => (b.lastRunAt ?? 0) - (a.lastRunAt ?? 0)).slice(0, rows);
  return (
    <div className="k4-c">
      <Big value={String(shortcuts.length)} unit="kısayol" />
      <div className="k4-mid">
        {top.map((s) => (
          <span key={s.id} className="k4-mini">
            <i className="k4-dotk" />
            <b>{s.label}</b>
            <em>{s.lastRunAt ? waited(s.lastRunAt, os.now) : ""}</em>
          </span>
        ))}
      </div>
      <div className="k4-foot">
        <p className="k4-c-sub">dokun, çalışsın</p>
      </div>
    </div>
  );
}

function Big({ value, unit, tone }: { value: string; unit: string; tone?: "crit" | "warn" }) {
  return (
    <div className={`k4-big ${tone ?? ""}`}>
      <span className="k4-big-v">{value}</span>
      <span className="k4-big-u">{unit}</span>
    </div>
  );
}

/** Sessizken bile bir nabız: durmuş dalga formu */
function Wave() {
  return (
    <span className="k4-wave" aria-hidden>
      {Array.from({ length: 22 }).map((_, i) => (
        <i key={i} style={{ height: `${Math.round(20 + 60 * Math.abs(Math.sin(i * 0.7)))}%` }} />
      ))}
    </span>
  );
}

export { APP_HUE, APP_IDS, type AppId };
