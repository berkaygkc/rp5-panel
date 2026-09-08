"use client";

import { useEffect, useRef } from "react";
import { FolderGit2, Pause, Play, Server, SkipBack, SkipForward } from "lucide-react";
import { useContainerHistory } from "@/lib/data/useContainerHistory";
import { useContainerInfo, useContainerLogs } from "@/lib/data/useContainerDetail";
import { runShortcutOnAgent } from "@/lib/data/runShortcut";
import { playbackPosition, type useMedia } from "@/lib/data/useMedia";
import type { useShortcuts } from "@/lib/data/useShortcuts";
import { fmtAgo } from "@/lib/format";
import { waited, type LabModel } from "@/lib/kokpit/model";
import { isProblem, type InfraContainer, type InfraSystem, type LogLine } from "@/lib/types/infra";
import type { MediaState, Track } from "@/lib/types/media";
import type { AppId } from "./ids";

/**
 * Açılmış panelin içi.
 *
 * Her uygulama burada listesini, ayrıntısını ve yapabildiği işi gösterir.
 * Altyapı üç seviye derinleşir: filo → sunucu → container raporu; sonuncusu
 * eski Altyapı ekranındaki tam künyenin aynısıdır, çünkü orada işe yarıyordu.
 */
export default function PanelFull({
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
          {live.length === 0 && <li className="k4-empty">açık oturum yok</li>}
        </ul>
        {sel && (
          <div className="k4-detail">
            <p className="k4-quote">
              {sel.activity?.kind === "assistant" && sel.activity.text ? sel.activity.text : sel.activity?.text || "Çalışıyor"}
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
              <button className="k4-btn primary" onClick={() => run(`claude:${sel.id}`, { kind: "project", path: sel.cwd })}>
                {fired[`claude:${sel.id}`] === "ok" ? "açıldı" : "projeyi aç"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (app === "infra") {
    const [sysId, containerId] = (sub ?? "").split("|");
    const sys = os.infra.systems.find((s) => s.id === sysId) ?? null;
    const container = sys?.containers.find((c) => c.id === containerId) ?? null;
    if (sys && container) return <ContainerReport sys={sys} c={container} now={os.now} />;
    if (sys) return <ServerDetail sys={sys} onOpen={(c) => setSub(`${sys.id}|${c.id}`)} />;
    return (
      <ul className="k4-list wide">
        {[...os.infra.systems]
          .sort((a, b) => Number(bad(b)) - Number(bad(a)))
          .map((s) => (
            <li key={s.id}>
              <button className="k4-row" onClick={() => setSub(s.id)}>
                <i className={`k4-pulse ${bad(s) ? "bad" : "ok"}`} />
                <span className="k4-row-main">
                  <span className="k4-row-t">{s.name}</span>
                  <span className="k4-row-s">{s.containers.length} servis · {s.host}</span>
                </span>
                <span className="k4-bars">
                  <Bar v={s.cpu} />
                  <Bar v={s.memPct} />
                  <Bar v={s.diskPct} />
                </span>
              </button>
            </li>
          ))}
        {os.infra.systems.length === 0 && <li className="k4-empty">Beszel bağlantısı yok</li>}
      </ul>
    );
  }

  if (app === "mail") {
    const msgs = os.mail.messages;
    const sel = msgs.find((m) => String(m.pk) === sub) ?? msgs[0] ?? null;
    return (
      <div className="k4-split">
        <ul className="k4-list">
          {msgs.slice(0, 14).map((m) => (
            <li key={m.pk}>
              <button className={`k4-row ${sel?.pk === m.pk ? "sel" : ""}`} onClick={() => setSub(String(m.pk))}>
                <i className={m.unseen ? "k4-unread" : "k4-pulse"} />
                <span className="k4-row-main">
                  <span className="k4-row-t">{m.fromName || m.fromAddress}</span>
                  <span className="k4-row-s">{m.subject}</span>
                </span>
                <span className="k4-row-x">{fmtClock(m.receivedAt)}</span>
              </button>
            </li>
          ))}
          {msgs.length === 0 && <li className="k4-empty">kutu boş</li>}
        </ul>
        {sel && (
          <div className="k4-detail">
            <p className="k4-d-from">{sel.fromName || sel.fromAddress}</p>
            <h3 className="k4-d-title">{sel.subject}</h3>
            <p className="k4-d-body">{sel.preview}</p>
            <dl className="k4-meta">
              <div>
                <dt>hesap</dt>
                <dd>{os.mail.accounts.find((a) => a.pk === sel.accountPk)?.title ?? "—"}</dd>
              </div>
              <div>
                <dt>geldi</dt>
                <dd>{fmtClock(sel.receivedAt)}</dd>
              </div>
              <div>
                <dt>ek</dt>
                <dd>{sel.attachments || "—"}</dd>
              </div>
            </dl>
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
          {items.slice(0, 14).map((i) => (
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
            <p className="k4-d-from">{sel.title} · {sel.subtitle}</p>
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
    /* Çalan bir şey yokken de tuşlar dursun: oynat, en son çalanı geri getirir */
    if (!t)
      return (
        <div className="k4-media quiet">
          <div className="k4-media-main">
            <h3 className="k4-d-title big">Sessiz</h3>
            <p className="k4-d-from">şu an bir şey çalmıyor</p>
            <div className="k4-transport">
              <button className="k4-key" onClick={media.actions.prev} aria-label="Önceki">
                <SkipBack size={20} fill="currentColor" strokeWidth={0} />
              </button>
              <button className="k4-key big" onClick={media.actions.togglePlay} aria-label="Oynat">
                <Play size={26} fill="currentColor" strokeWidth={0} />
              </button>
              <button className="k4-key" onClick={media.actions.next} aria-label="Sonraki">
                <SkipForward size={20} fill="currentColor" strokeWidth={0} />
              </button>
            </div>
          </div>
        </div>
      );
    return (
      <div className="k4-media">
        <Art track={t} size={172} playing={media.data.playing} />
        <div className="k4-media-main">
          <h3 className="k4-d-title big">{t.title}</h3>
          <p className="k4-d-from">
            {t.artist}
            {t.album ? ` · ${t.album}` : ""}
          </p>
          <Scrub state={media.data} onSeek={media.actions.seekTo} />
          <div className="k4-transport">
            <button className="k4-key" onClick={media.actions.prev} aria-label="Önceki">
              <SkipBack size={20} fill="currentColor" strokeWidth={0} />
            </button>
            <button className="k4-key big" onClick={media.actions.togglePlay} aria-label="Oynat">
              {media.data.playing ? <Pause size={26} fill="currentColor" strokeWidth={0} /> : <Play size={26} fill="currentColor" strokeWidth={0} />}
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

/* ── Altyapı seviye 2: sunucu ─────────────────────────────────────────── */

function ServerDetail({ sys, onOpen }: { sys: InfraSystem; onOpen: (c: InfraContainer) => void }) {
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
            <button className="k4-row" onClick={() => onOpen(c)}>
              <i className={`k4-pulse ${isProblem(c) ? "bad" : "ok"}`} />
              <span className="k4-row-main">
                <span className="k4-row-t">{c.name}</span>
                <span className="k4-row-s">{c.image || "—"}</span>
              </span>
              <span className="k4-row-x">%{c.cpu.toFixed(1)}</span>
            </button>
          </li>
        ))}
        {sorted.length === 0 && <li className="k4-empty">bu sunucuda container yok</li>}
      </ul>
    </div>
  );
}

/* ── Altyapı seviye 3: container raporu ───────────────────────────────── */

const LEVEL_COLOR: Record<string, string> = {
  fatal: "var(--k4-red)",
  error: "var(--k4-red)",
  warn: "var(--k4-amber)",
  warning: "var(--k4-amber)",
  info: "hsl(var(--hue))",
};

/** Arka arkaya yinelenen satırlar tek satıra toplanır */
function groupLogs(lines: LogLine[]): { l: LogLine; n: number }[] {
  const out: { l: LogLine; n: number }[] = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    if (prev && prev.l.text === l.text && prev.l.level === l.level) out[out.length - 1] = { l, n: prev.n + 1 };
    else out.push({ l, n: 1 });
  }
  return out;
}

function ContainerReport({ sys, c, now }: { sys: InfraSystem; c: InfraContainer; now: number }) {
  const { history } = useContainerHistory(sys.id, c.name);
  const { data: logs, error: logsError } = useContainerLogs(sys.id, c.id);
  const { data: info } = useContainerInfo(sys.id, c.id);
  const pts = history?.points ?? [];
  const last = pts[pts.length - 1];
  const hasNet = pts.some((p) => p.rx !== null);
  const problem = isProblem(c);
  const errors = logs ? logs.lines.filter((l) => l.level === "error" || l.level === "fatal").length : 0;
  const grouped = logs ? groupLogs(logs.lines) : [];
  const showTime = logs ? logs.lines.some((l) => l.t !== null) : false;

  return (
    <div className="k4-report">
      <div className="k4-report-left">
        <div className="k4-report-head">
          <i className={`k4-pulse ${problem ? "bad" : "ok"}`} />
          <span className="k4-row-t">{c.name}</span>
          {info && info.restartCount > 0 && <span className="k4-chip warn">{info.restartCount}× yeniden</span>}
        </div>
        <div className="k4-metrics">
          <Metric label="işlemci" value={`%${(last?.cpu ?? c.cpu).toFixed(1)}`} series={pts.map((p) => p.cpu)} />
          <Metric label="bellek" value={fmtMb(last?.memMb ?? c.memMb)} series={pts.map((p) => p.memMb)} />
          {hasNet && (
            <Metric
              label="ağ"
              value={`↓${fmtRate(last?.rx ?? 0)}`}
              sub={`↑${fmtRate(last?.tx ?? 0)}`}
              series={pts.map((p) => (p.rx ?? 0) + (p.tx ?? 0))}
            />
          )}
        </div>
        <dl className="k4-kv">
          <dt>durum</dt>
          <dd>{c.status || "—"}</dd>
          <dt>başladı</dt>
          <dd>{info?.startedAt ? `${fmtAgo(info.startedAt, now)} önce` : "—"}</dd>
          {info?.finishedAt && !c.running && (
            <>
              <dt>durdu</dt>
              <dd className="bad">{fmtAgo(info.finishedAt, now)} önce · çıkış {info.exitCode}</dd>
            </>
          )}
          <dt>imaj</dt>
          <dd>{info?.image ?? c.image ?? "—"}</dd>
          <dt>komut</dt>
          <dd className="mono">{info?.command ?? "—"}</dd>
          <dt>portlar</dt>
          <dd>{(info?.ports.length ? info.ports.join(", ") : c.ports) || "—"}</dd>
          <dt>politika</dt>
          <dd>{info?.restartPolicy || "—"}</dd>
          <dt>ortam</dt>
          <dd>{info ? `${info.envCount} değişken · ${info.mountCount} mount` : "—"}</dd>
          <dt>sunucu</dt>
          <dd>{sys.name}</dd>
        </dl>
      </div>

      <div className="k4-report-logs">
        <header>
          <span>loglar</span>
          {errors > 0 && <span className="bad">{errors} hata</span>}
          {logs && <span className="dim">son {logs.lines.length} satır</span>}
        </header>
        <div className="k4-loglines" data-interactive>
          {logsError ? (
            <p className="k4-empty">loglar alınamadı: {logsError}</p>
          ) : !logs ? (
            <p className="k4-empty">loglar getiriliyor…</p>
          ) : grouped.length === 0 ? (
            <p className="k4-empty">log yok</p>
          ) : (
            grouped.map((g, i) => {
              const color = (g.l.level && LEVEL_COLOR[g.l.level]) || undefined;
              const loud = g.l.level === "error" || g.l.level === "fatal" || g.l.level === "warn" || g.l.level === "warning";
              return (
                <p key={i} className={`k4-logline ${loud ? "loud" : ""}`} style={loud ? { color } : undefined}>
                  {showTime && <span className="t">{g.l.t ? new Date(g.l.t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}</span>}
                  <span className="m">{g.l.text}</span>
                  {g.n > 1 && <span className="n">×{g.n}</span>}
                </p>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, series }: { label: string; value: string; sub?: string; series: number[] }) {
  return (
    <div className="k4-metric">
      <span className="k4-metric-l">{label}</span>
      <span className="k4-metric-v">{value}</span>
      {sub && <span className="k4-metric-s">{sub}</span>}
      <Spark values={series} />
    </div>
  );
}

/* ── Ortak küçük parçalar ─────────────────────────────────────────────── */

export function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const top = Math.max(1, ...values);
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * 100).toFixed(1)},${(100 - (Math.max(0, Math.min(top, v)) / top) * 100).toFixed(1)}`)
    .join(" ");
  return (
    <svg className="k4-spark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <polygon points={`0,100 ${pts} 100,100`} fill="hsl(var(--hue) / 0.16)" />
      <polyline points={pts} fill="none" stroke="hsl(var(--hue))" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function Bar({ v }: { v: number }) {
  const p = Math.max(0, Math.min(100, v));
  return (
    <span className="k4-bar">
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
      <svg width={84} height={84}>
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

export function Art({ track, size, playing }: { track: Track; size: number; playing: boolean }) {
  return (
    <span className="k4-art" style={{ width: size, height: size, background: `linear-gradient(140deg, ${track.artColors[0]}, ${track.artColors[1]})` }}>
      {track.artworkUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- dış kaynak kapak
        <img src={track.artworkUrl} alt="" />
      ) : null}
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

/**
 * Konum çubuğu.
 *
 * `positionSec` bir çıpadır, canlı konum değildir: çalarken geçen süre onun
 * üstüne eklenir. O yüzden değer her karede `playbackPosition` ile hesaplanır
 * ve doğrudan ref'lere yazılır — React'i her saniye yeniden çizdirmeden akar.
 */
function Scrub({ state, onSeek }: { state: MediaState; onSeek: (sec: number) => void }) {
  const bar = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const knob = useRef<HTMLSpanElement>(null);
  const cur = useRef<HTMLSpanElement>(null);
  const rest = useRef<HTMLSpanElement>(null);
  const drag = useRef<number | null>(null);
  const live = useRef(state);

  useEffect(() => {
    live.current = state;
  }, [state]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const s = live.current;
      const dur = s.track?.durationSec || 1;
      const pos = drag.current ?? playbackPosition(s);
      const r = Math.min(1, Math.max(0, pos / dur));
      if (fill.current) fill.current.style.transform = `scaleX(${r})`;
      if (knob.current && bar.current) knob.current.style.transform = `translate(${r * bar.current.clientWidth}px, -50%)`;
      if (cur.current) cur.current.textContent = mmss(pos);
      if (rest.current) rest.current.textContent = `-${mmss(Math.max(0, dur - pos))}`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const at = (e: React.PointerEvent) => {
    const el = bar.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (live.current.track?.durationSec ?? 0);
  };

  return (
    <div className="k4-scrub">
      <div
        ref={bar}
        className="k4-scrub-track"
        data-interactive
        onPointerDown={(e) => {
          (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
          drag.current = at(e);
        }}
        onPointerMove={(e) => {
          if (drag.current !== null) drag.current = at(e);
        }}
        onPointerUp={(e) => {
          if (drag.current === null) return;
          onSeek(at(e));
          // Ajan onayı gelene dek parmağın bıraktığı yeri koru, geri sıçramasın
          setTimeout(() => (drag.current = null), 150);
        }}
      >
        <span ref={fill} className="k4-scrub-fill" />
        <span ref={knob} className="k4-scrub-knob" />
      </div>
      <div className="k4-scrub-time">
        <span ref={cur} />
        <span ref={rest} />
      </div>
    </div>
  );
}

const bad = (s: InfraSystem) => s.status !== "up" || s.containers.some(isProblem) || s.diskPct >= 90;
export const initials = (n: string) =>
  n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toLocaleUpperCase("tr-TR");
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const fmtTok = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));
const fmtMb = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`);
const fmtRate = (b: number) => (b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)}MB/s` : b >= 1024 ? `${Math.round(b / 1024)}KB/s` : `${Math.round(b)}B/s`);
export const fmtClock = (ms: number) => new Date(ms).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
