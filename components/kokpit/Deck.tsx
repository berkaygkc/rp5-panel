"use client";

import { useCallback, useRef, useState } from "react";
import {
  ChevronLeft,
  FolderGit2,
  Mail,
  MessagesSquare,
  Music2,
  Pause,
  Play,
  Server,
  SkipBack,
  SkipForward,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { waited, type LabModel } from "@/lib/kokpit/model";
import { runShortcutOnAgent } from "@/lib/data/runShortcut";
import { useMedia } from "@/lib/data/useMedia";
import { useShortcuts } from "@/lib/data/useShortcuts";
import { isProblem, type InfraSystem } from "@/lib/types/infra";
import type { Track } from "@/lib/types/media";

/**
 * KOKPİT — bakılan değil, kullanılan ekran.
 *
 * Şerit altı panelden kurulu bir akordeondur. Hiçbiri seçili değilken hepsi
 * eşit genişlikte durur ve özetini gösterir; birine dokunduğunda o panel
 * yerinde açılır, komşuları omurgaya iner. Açılan panelin içinde ikinci bir
 * seviye vardır (sunucu → container, posta → ileti) ve gerçek eylemler
 * buradadır: kısayolu çalıştır, projeyi aç, parçayı değiştir.
 *
 * Görsel dil CarPlay'in iOS 26 katmanlarından: koyu zemin, odaklanan
 * uygulamanın rengiyle boyanan aurora, üst kenarı ışık alan cam yüzeyler.
 */

export type AppId = "claude" | "infra" | "mail" | "chat" | "media" | "shortcuts";

const APPS: { id: AppId; name: string; icon: LucideIcon; hue: string }[] = [
  { id: "claude", name: "Claude", icon: Sparkles, hue: "22 92% 62%" },
  { id: "infra", name: "Altyapı", icon: Server, hue: "190 95% 55%" },
  { id: "mail", name: "Posta", icon: Mail, hue: "248 90% 68%" },
  { id: "chat", name: "Sohbet", icon: MessagesSquare, hue: "150 75% 50%" },
  { id: "media", name: "Medya", icon: Music2, hue: "330 85% 62%" },
  { id: "shortcuts", name: "Kısayollar", icon: Zap, hue: "38 96% 58%" },
];

/** Uygulama kimliği → renk; aurora ve kabuk bunu okur */
export const APP_HUE: Record<AppId, string> = {
  claude: "22 92% 62%",
  infra: "190 95% 55%",
  mail: "248 90% 68%",
  chat: "150 75% 50%",
  media: "330 85% 62%",
  shortcuts: "38 96% 58%",
};

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
  /** Yönetim panelindeki ekran sırası; verilmezse katalog sırası */
  order?: string[];
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

  const counts: Record<AppId, { badge: number; tone: "crit" | "warn" | "calm" }> = {
    claude: {
      badge: os.claude.sessions.filter((s) => s.status === "waiting").length,
      tone: os.claude.sessions.some((s) => s.status === "waiting") ? "warn" : "calm",
    },
    infra: {
      badge: model.items.filter((i) => i.app === "infra").length,
      tone: model.items.some((i) => i.app === "infra") ? "crit" : "calm",
    },
    mail: { badge: os.mail.accounts.reduce((n, a) => n + a.unread, 0), tone: "calm" },
    chat: {
      badge: model.items.filter((i) => i.app === "chat").length,
      tone: model.items.some((i) => i.app === "chat") ? "warn" : "calm",
    },
    media: { badge: 0, tone: "calm" },
    shortcuts: { badge: 0, tone: "calm" },
  };

  /* Panel sırası ve görünürlüğü yönetim panelindeki ekran listesinden gelir.
   * Medyanın ekran satırı yok — o hep güvertede durur. */
  const deck = order?.length
    ? [...APPS]
        .filter((a) => a.id === "media" || order.includes(a.id))
        .sort((a, b) => {
          const ia = a.id === "media" ? order.length : order.indexOf(a.id);
          const ib = b.id === "media" ? order.length : order.indexOf(b.id);
          return ia - ib;
        })
    : APPS;

  return (
      <div className="k4-deck">
        {deck.map((app) => {
          const on = focus === app.id;
          const c = counts[app.id];
          return (
            <section
              key={app.id}
              className={`k4-panel ${on ? "on" : ""} ${focus && !on ? "off" : ""}`}
              style={{ ["--hue" as string]: app.hue, flexGrow: on ? 46 : focus ? 4.5 : 10 }}
            >
              <span className="k4-sheen" aria-hidden />
              <header className="k4-head">
                <button className="k4-icon" onClick={() => open(app.id)} aria-label={app.name}>
                  <app.icon size={17} strokeWidth={2.2} />
                </button>
                <span className="k4-name">{app.name}</span>
                {c.badge > 0 && <span className={`k4-badge ${c.tone}`}>{c.badge}</span>}
                {on && sub && (
                  <button className="k4-back" onClick={() => setSub(null)} aria-label="Geri">
                    <ChevronLeft size={15} strokeWidth={2.4} />
                  </button>
                )}
              </header>

              <div className="k4-body">
                {on ? (
                  <Full
                    app={app.id}
                    model={model}
                    sub={sub}
                    setSub={setSub}
                    media={media}
                    shortcuts={shortcuts}
                    fired={fired}
                    run={run}
                  />
                ) : (
                  <Compact app={app.id} model={model} media={media} shortcuts={shortcuts} />
                )}
              </div>

              {!on && <button className="k4-hit" onClick={() => open(app.id)} aria-label={`${app.name} panelini aç`} />}
            </section>
          );
        })}
      </div>
  );
}

/* ── Kapalı hal: panel kendi özetini anlatır ───────────────────────────── */

function Compact({
  app,
  model,
  media,
  shortcuts,
}: {
  app: AppId;
  model: LabModel;
  media: ReturnType<typeof useMedia>;
  shortcuts: ReturnType<typeof useShortcuts>["data"][number]["items"];
}) {
  const os = model.os;

  if (app === "claude") {
    const waiting = os.claude.sessions.filter((s) => s.status === "waiting");
    const live = os.claude.sessions.filter((s) => s.status !== "closed");
    const hero = waiting[0] ?? live[0];
    return (
      <div className="k4-c">
        <Big value={waiting.length > 0 ? String(waiting.length) : String(live.length)} unit={waiting.length ? "soru" : "oturum"} tone={waiting.length ? "warn" : undefined} />
        <div className="k4-mid">
          {live.slice(0, 8).map((s) => (
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
    const ridge = model.ambient.ridges[0]?.values ?? [];
    return (
      <div className="k4-c">
        <Big
          value={faults.length ? String(faults.length) : String(model.ambient.servers.length)}
          unit={faults.length ? "sorun" : "sunucu"}
          tone={faults.length ? "crit" : undefined}
        />
        <div className="k4-mid graph">
          <Spark values={ridge} />
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
          {unread.slice(0, 8).map((m) => (
            <span key={m.pk} className="k4-mini">
              <i className="k4-unread" />
              <b>{m.fromName || m.fromAddress}</b>
              <em>{fmtClock(m.receivedAt)}</em>
            </span>
          ))}
        </div>
        <div className="k4-foot">
          <p className="k4-c-title">{unread[0]?.fromName || unread[0]?.fromAddress || "kutu boş"}</p>
          <p className="k4-c-sub">{unread[0]?.subject ?? ""}</p>
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
          {items.slice(0, 8).map((i) => (
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
        <div className="k4-mid center">
          {t ? (
            <Art track={t} size={92} playing={media.data.playing} />
          ) : (
            <Wave />
          )}
        </div>
        <div className="k4-foot">
          <p className="k4-c-title">{t?.title ?? "sessiz"}</p>
          <p className="k4-c-sub">{t?.artist ?? "çalan bir şey yok"}</p>
        </div>
      </div>
    );
  }

  const top = [...shortcuts].sort((a, b) => (b.lastRunAt ?? 0) - (a.lastRunAt ?? 0)).slice(0, 8);
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

/** Panel içi mini eğri — kütüphanesiz, yalnızca yön gösterir */
function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const top = Math.max(12, ...values);
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * 100).toFixed(1)},${(100 - (Math.max(0, Math.min(top, v)) / top) * 100).toFixed(1)}`)
    .join(" ");
  return (
    <svg className="k4-spark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <polygon points={`0,100 ${pts} 100,100`} fill="hsl(var(--hue) / 0.18)" />
      <polyline points={pts} fill="none" stroke="hsl(var(--hue))" strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/** Sessizken bile bir nabız: durmuş dalga formu */
function Wave() {
  return (
    <span className="k4-wave" aria-hidden>
      {Array.from({ length: 22 }).map((_, i) => (
        <i key={i} style={{ height: `${20 + 60 * Math.abs(Math.sin(i * 0.7))}%` }} />
      ))}
    </span>
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

/* ── Açık hal: içerik ve gerçek eylemler ──────────────────────────────── */

function Full({
  app,
  model,
  sub,
  setSub,
  media,
  shortcuts,
  fired,
  run,
}: {
  app: AppId;
  model: LabModel;
  sub: string | null;
  setSub: (v: string | null) => void;
  media: ReturnType<typeof useMedia>;
  shortcuts: ReturnType<typeof useShortcuts>["data"][number]["items"];
  fired: Record<string, "run" | "ok" | "fail">;
  run: (id: string, action: Parameters<typeof runShortcutOnAgent>[1]) => void;
}) {
  const os = model.os;

  if (app === "claude") {
    const live = os.claude.sessions.filter((s) => s.status !== "closed");
    const sel = live.find((s) => s.id === sub) ?? live[0] ?? null;
    return (
      <div className="k4-split">
        <ul className="k4-list">
          {live.map((s) => (
            <li key={s.id}>
              <button className={`k4-row ${sel?.id === s.id ? "sel" : ""}`} onClick={() => setSub(s.id)}>
                <i className={`k4-pulse ${s.status}`} />
                <span className="k4-row-main">
                  <span className="k4-row-t">{s.project}</span>
                  <span className="k4-row-s">{s.status === "waiting" ? "sizi bekliyor" : "çalışıyor"}</span>
                </span>
                <span className="k4-row-x">{waited(s.lastActiveAt, os.now)}</span>
              </button>
            </li>
          ))}
        </ul>
        {sel && (
          <div className="k4-detail">
            <p className="k4-quote">
              {sel.activity?.kind === "assistant" && sel.activity.text
                ? sel.activity.text
                : sel.activity?.text || "Çalışıyor"}
            </p>
            {sel.lastPrompt && (
              <div className="k4-prompt">
                <span className="k4-prompt-l">son istem</span>
                <p>{sel.lastPrompt}</p>
              </div>
            )}
            <dl className="k4-meta">
              <div>
                <dt>dal</dt>
                <dd>{sel.branch || "—"}</dd>
              </div>
              <div>
                <dt>model</dt>
                <dd>{(sel.model || "—").replace("claude-", "")}</dd>
              </div>
              <div>
                <dt>istem</dt>
                <dd>{sel.prompts}</dd>
              </div>
              <div>
                <dt>çıktı</dt>
                <dd>{fmtTok(sel.tokens.output)}</dd>
              </div>
              <div>
                <dt>satır</dt>
                <dd className="k4-diff">
                  <span className="plus">+{sel.linesAdded}</span>
                  <span className="minus">−{sel.linesRemoved}</span>
                </dd>
              </div>
            </dl>
            <div className="k4-actions">
              <button
                className="k4-btn primary"
                onClick={() => run(`claude:${sel.id}`, { kind: "project", path: sel.cwd })}
              >
                {fired[`claude:${sel.id}`] === "ok" ? "açıldı" : "projeyi aç"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (app === "infra") {
    const sys = os.infra.systems.find((s) => s.id === sub) ?? null;
    if (sys) return <InfraDetail sys={sys} />;
    return (
      <ul className="k4-list wide">
        {[...os.infra.systems]
          .sort((a, b) => Number(b.containers.some(isProblem)) - Number(a.containers.some(isProblem)))
          .map((s) => {
            const bad = s.status !== "up" || s.containers.some(isProblem) || s.diskPct >= 90;
            return (
              <li key={s.id}>
                <button className="k4-row" onClick={() => setSub(s.id)}>
                  <i className={`k4-pulse ${bad ? "bad" : "ok"}`} />
                  <span className="k4-row-main">
                    <span className="k4-row-t">{s.name}</span>
                    <span className="k4-row-s">{s.containers.length} servis</span>
                  </span>
                  <span className="k4-bars">
                    <Bar v={s.cpu} label="cpu" />
                    <Bar v={s.memPct} label="ram" />
                    <Bar v={s.diskPct} label="disk" />
                  </span>
                </button>
              </li>
            );
          })}
      </ul>
    );
  }

  if (app === "mail") {
    const msgs = os.mail.messages;
    const sel = msgs.find((m) => String(m.pk) === sub) ?? msgs[0] ?? null;
    return (
      <div className="k4-split">
        <ul className="k4-list">
          {msgs.slice(0, 12).map((m) => (
            <li key={m.pk}>
              <button className={`k4-row ${sel?.pk === m.pk ? "sel" : ""}`} onClick={() => setSub(String(m.pk))}>
                {m.unseen && <i className="k4-unread" />}
                <span className="k4-row-main">
                  <span className="k4-row-t">{m.fromName || m.fromAddress}</span>
                  <span className="k4-row-s">{m.subject}</span>
                </span>
                <span className="k4-row-x">{fmtClock(m.receivedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
        {sel && (
          <div className="k4-detail">
            <p className="k4-d-from">{sel.fromName || sel.fromAddress}</p>
            <h3 className="k4-d-title">{sel.subject}</h3>
            <p className="k4-d-body">{sel.preview}</p>
          </div>
        )}
      </div>
    );
  }

  if (app === "chat") {
    const items = [...os.chat.chatwoot.items, ...os.chat.mattermost.items];
    const sel = items.find((i) => i.id === sub) ?? items[0] ?? null;
    return (
      <div className="k4-split">
        <ul className="k4-list">
          {items.slice(0, 12).map((i) => (
            <li key={i.id}>
              <button className={`k4-row ${sel?.id === i.id ? "sel" : ""}`} onClick={() => setSub(i.id)}>
                <span className="k4-av">{initials(i.title)}</span>
                <span className="k4-row-main">
                  <span className="k4-row-t">{i.title}</span>
                  <span className="k4-row-s">{i.preview || i.subtitle}</span>
                </span>
                {i.waitingSince && <span className="k4-row-x warn">{waited(i.waitingSince, os.now)}</span>}
              </button>
            </li>
          ))}
          {items.length === 0 && <li className="k4-empty">kimse yanıt beklemiyor</li>}
        </ul>
        {sel && (
          <div className="k4-detail">
            <p className="k4-d-from">
              {sel.title} · {sel.subtitle}
            </p>
            <p className="k4-bubble">{sel.preview}</p>
            <dl className="k4-meta">
              <div>
                <dt>okunmadı</dt>
                <dd>{sel.unread}</dd>
              </div>
              <div>
                <dt>bahsetme</dt>
                <dd>{sel.mentions}</dd>
              </div>
              <div>
                <dt>bekleme</dt>
                <dd>{sel.waitingSince ? waited(sel.waitingSince, os.now) : "—"}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    );
  }

  if (app === "media") {
    const t = media.data.track;
    if (!t) return <p className="k4-empty">şu an bir şey çalmıyor</p>;
    const pos = media.data.positionSec;
    const dur = Math.max(1, t.durationSec);
    return (
      <div className="k4-media">
        <Art track={t} size={168} playing={media.data.playing} />
        <div className="k4-media-main">
          <h3 className="k4-d-title big">{t.title}</h3>
          <p className="k4-d-from">
            {t.artist}
            {t.album ? ` · ${t.album}` : ""}
          </p>
          <Scrub pos={pos} dur={dur} onSeek={media.actions.seekTo} />
          <div className="k4-transport">
            <button className="k4-key" onClick={media.actions.prev} aria-label="Önceki">
              <SkipBack size={20} fill="currentColor" strokeWidth={0} />
            </button>
            <button className="k4-key big" onClick={media.actions.togglePlay} aria-label="Oynat">
              {media.data.playing ? (
                <Pause size={26} fill="currentColor" strokeWidth={0} />
              ) : (
                <Play size={26} fill="currentColor" strokeWidth={0} />
              )}
            </button>
            <button className="k4-key" onClick={media.actions.next} aria-label="Sonraki">
              <SkipForward size={20} fill="currentColor" strokeWidth={0} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="k4-keys">
      {shortcuts.map((s) => {
        const st = fired[s.id];
        return (
          <button key={s.id} className={`k4-shortcut ${st ?? ""}`} onClick={() => run(s.id, s.run)}>
            <span className="k4-sc-icon">
              {s.run.kind === "ssh" ? <Server size={16} strokeWidth={2.2} /> : <FolderGit2 size={16} strokeWidth={2.2} />}
            </span>
            <span className="k4-sc-main">
              <span className="k4-sc-label">{s.label}</span>
              <span className="k4-sc-sub">
                {st === "run" ? "gönderiliyor…" : st === "ok" ? "açıldı" : st === "fail" ? "olmadı" : s.run.kind === "ssh" ? s.run.host : "proje"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function InfraDetail({ sys }: { sys: InfraSystem }) {
  const sorted = [...sys.containers].sort((a, b) => Number(isProblem(b)) - Number(isProblem(a)));
  return (
    <div className="k4-split infra">
      <div className="k4-rings">
        <Ring v={sys.cpu} label="işlemci" />
        <Ring v={sys.memPct} label="bellek" />
        <Ring v={sys.diskPct} label="disk" />
      </div>
      <ul className="k4-list two">
        {sorted.map((c) => (
          <li key={c.id}>
            <span className="k4-row static">
              <i className={`k4-pulse ${isProblem(c) ? "bad" : "ok"}`} />
              <span className="k4-row-main">
                <span className="k4-row-t">{c.name}</span>
                <span className="k4-row-s">{c.image || "—"}</span>
              </span>
              <span className="k4-row-x">%{c.cpu.toFixed(1)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Küçük parçalar ───────────────────────────────────────────────────── */

function Bar({ v, label }: { v: number; label: string }) {
  const p = Math.max(0, Math.min(100, v));
  return (
    <span className="k4-bar" title={label}>
      <span style={{ height: `${Math.max(4, p)}%`, background: p >= 90 ? "var(--k4-red)" : p >= 75 ? "var(--k4-amber)" : "hsl(var(--hue) / 0.9)" }} />
    </span>
  );
}

function Ring({ v, label }: { v: number; label: string }) {
  const p = Math.max(0, Math.min(100, v));
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="k4-ring">
      <svg width={84} height={84} className="-rotate-90">
        <circle cx={42} cy={42} r={r} fill="none" stroke="var(--k4-track)" strokeWidth={7} />
        <circle
          cx={42}
          cy={42}
          r={r}
          fill="none"
          stroke={p >= 90 ? "var(--k4-red)" : p >= 75 ? "var(--k4-amber)" : "hsl(var(--hue))"}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * p) / 100}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.23,1,0.32,1)" }}
        />
      </svg>
      <span className="k4-ring-v">%{Math.round(p)}</span>
      <span className="k4-ring-l">{label}</span>
    </div>
  );
}

function Art({ track, size, playing }: { track: Track; size: number; playing: boolean }) {
  return (
    <span className="k4-art" style={{ width: size, height: size, background: `linear-gradient(140deg, ${track.artColors[0]}, ${track.artColors[1]})` }}>
      {track.artworkUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- dış kaynak, boyut bilinmiyor
        <img src={track.artworkUrl} alt="" />
      ) : (
        <Music2 size={Math.round(size * 0.3)} strokeWidth={1.25} />
      )}
      {playing && (
        <span className="k4-eq" aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </span>
      )}
    </span>
  );
}

function Scrub({ pos, dur, onSeek }: { pos: number; dur: number; onSeek: (s: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const pct = ((drag ?? pos) / dur) * 100;
  const at = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur;
  };
  return (
    <div className="k4-scrub">
      <div
        ref={ref}
        className="k4-scrub-track"
        onPointerDown={(e) => {
          (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
          setDrag(at(e));
        }}
        onPointerMove={(e) => drag !== null && setDrag(at(e))}
        onPointerUp={(e) => {
          const v = at(e);
          setDrag(null);
          onSeek(v);
        }}
      >
        <span className="k4-scrub-fill" style={{ width: `${pct}%` }} />
        <span className="k4-scrub-knob" style={{ left: `${pct}%` }} />
      </div>
      <div className="k4-scrub-time">
        <span>{mmss(drag ?? pos)}</span>
        <span>-{mmss(Math.max(0, dur - (drag ?? pos)))}</span>
      </div>
    </div>
  );
}

const initials = (n: string) =>
  n
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toLocaleUpperCase("tr-TR");
const fmtTok = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const fmtClock = (ms: number) => new Date(ms).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
