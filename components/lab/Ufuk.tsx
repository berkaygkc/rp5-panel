"use client";

import { useEffect, useRef, useState } from "react";
import type { Gear } from "@/lib/kokpit/model";
import { waited, type LabItem, type LabModel } from "@/lib/kokpit/model";

/**
 * UFUK — enstrüman köprüsü.
 *
 * Ekranı boydan boya tek bir çizgi geçer. O çizgi zaman değil, **bekleme**:
 * sağ uç "az önce", sola gittikçe daha uzun bekleyen. Mesafe doğrudan
 * aciliyettir; bir şeyin ne kadar soldaysa o kadar geciktiğini ölçmek için
 * okumaya gerek yoktur. Ufkun altında kendi kendine akan her şey durur.
 *
 * Ölçek logaritmiktir: dakikalar da günler de aynı ekranda okunur.
 */

const LANES = 2;
const MIN_GAP = 236;
/** Sağ kolon "süregelen" durumlara ayrılır; ufuk onun solunda biter */
const RIGHT_PAD = 330;
const LEFT_PAD = 56;

interface Placed extends LabItem {
  x: number;
  lane: number;
}

/** 0 → sağ uç, span → sol uç; log ölçek kümeleri açar */
function scale(waitMs: number, spanMs: number, w: number) {
  const t = Math.max(0, Math.min(spanMs, waitMs));
  const k = Math.log1p(t / 60_000) / Math.log1p(spanMs / 60_000);
  return w - RIGHT_PAD - k * (w - RIGHT_PAD - LEFT_PAD);
}

const TICKS = [
  { m: 1, label: "1 dk" },
  { m: 5, label: "5 dk" },
  { m: 15, label: "15 dk" },
  { m: 60, label: "1 sa" },
  { m: 240, label: "4 sa" },
  { m: 720, label: "12 sa" },
  { m: 1440, label: "1 gün" },
  { m: 4320, label: "3 gün" },
];

export default function Ufuk({ model, gear }: { model: LabModel; gear: Gear }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(1600);
  const [h, setH] = useState(426);
  const [spanH, setSpanH] = useState(12); // ufkun sol ucundaki bekleme, saat
  const drag = useRef<{ x: number; span: number } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setW(el.clientWidth);
      setH(el.clientHeight);
    });
    ro.observe(el);
    setW(el.clientWidth);
    setH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const now = model.os.now;
  const horizon = Math.round(h * 0.62);
  const spanMs = spanH * 3600_000;

  /* Bekleme süresi olanlar ufka oturur; süresi olmayan durumlar sağ kolona */
  const timed = model.items.filter((i) => i.since);
  const ongoing = model.items.filter((i) => !i.since);

  const laneEnd: number[] = new Array(LANES).fill(Infinity);
  const placed: Placed[] = [];
  const byWait = [...timed].sort((a, b) => (now - (a.since ?? now)) - (now - (b.since ?? now)));
  for (const it of byWait) {
    const x = scale(now - (it.since ?? now), spanMs, w);
    let lane = 0;
    for (let i = 0; i < LANES; i++) {
      if (laneEnd[i] - x > MIN_GAP) {
        lane = i;
        break;
      }
      if (i === LANES - 1) lane = placed.length % LANES;
    }
    laneEnd[lane] = x;
    placed.push({ ...it, x, lane });
  }

  /* Ufkun altı: her sunucunun işlemci sırtı, üst üste binen bir manzara.
   * Sayı okunmaz, nefes okunur — filo çalışıyor mu, uyuyor mu. */
  const ridges = model.ambient.ridges.slice(0, 6);
  const depth = h - horizon - 62;
  const bands = ridges.map((r, i) => {
    const base = horizon + 44 + (i * depth) / Math.max(3, ridges.length);
    const amp = depth / (ridges.length + 1.2);
    const top = Math.max(12, ...r.values);
    const pts = r.values.map((v, j) => {
      const x = (j / (r.values.length - 1)) * w;
      const y = base - (Math.max(0, Math.min(top, v)) / top) * amp;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return { name: r.name, line: pts.join(" "), area: `0,${base} ${pts.join(" ")} ${w},${base}` };
  });

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, span: spanH };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    // Sola sürüklemek ufku uzatır: dakikalardan günlere
    const f = Math.exp(-(e.clientX - d.x) / 260);
    setSpanH(Math.max(0.5, Math.min(168, d.span * f)));
  };
  const onUp = () => {
    drag.current = null;
  };

  const verdict =
    model.criticals > 0
      ? `${model.criticals} şey bozuk`
      : model.waiting > 0
        ? `${model.waiting} şey seni bekliyor`
        : "her şey yolunda";

  return (
    <div className="u-root">
      <header className="u-clock">
        <div className="u-time">{fmtTime(now)}</div>
        <div className="u-date">{fmtDate(now)}</div>
        <div className={`u-verdict ${model.criticals > 0 ? "crit" : model.waiting > 0 ? "warn" : ""}`}>{verdict}</div>
        <dl className="u-amb">
          <div>
            <dt>filo</dt>
            <dd>
              {model.ambient.servers.length} sunucu · {model.ambient.services} servis
            </dd>
          </div>
          <div>
            <dt>plan</dt>
            <dd>%{model.ambient.usagePct}</dd>
          </div>
          {model.os.media.track && (
            <div>
              <dt>çalan</dt>
              <dd>{model.os.media.track.title}</dd>
            </div>
          )}
        </dl>
      </header>

      <div
        ref={wrap}
        className="u-field"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <svg className="u-svg" width={w} height={h} aria-hidden>
          {bands.map((b, i) => (
            <g key={b.name} style={{ opacity: 1 - i * 0.11 }}>
              <polygon className="u-ridge" points={b.area} />
              <polyline className="u-ridge-line" points={b.line} />
            </g>
          ))}
          <line className="u-line" x1={0} y1={horizon} x2={w} y2={horizon} />
          {TICKS.filter((t) => t.m * 60_000 <= spanMs).map((t) => {
            const x = scale(t.m * 60_000, spanMs, w);
            return (
              <g key={t.m}>
                <line className="u-tick" x1={x} y1={horizon} x2={x} y2={horizon + 7} />
                <text className="u-tick-label" x={x} y={horizon + 24} textAnchor="middle">
                  {t.label}
                </text>
              </g>
            );
          })}
          <line className="u-now" x1={w - RIGHT_PAD} y1={20} x2={w - RIGHT_PAD} y2={h - 20} />
          {placed.map((p) => (
            <line key={`s-${p.id}`} className={`u-stem ${p.severity}`} x1={p.x} y1={horizon} x2={p.x} y2={stemTop(p.lane, horizon)} />
          ))}
          {placed.map((p) => (
            <circle key={`d-${p.id}`} className={`u-dot ${p.severity}`} cx={p.x} cy={horizon} r={p.severity === "critical" ? 4.5 : 3.5} />
          ))}
        </svg>

        {placed.map((p) => (
          <article
            key={p.id}
            className={`u-item ${p.severity}`}
            style={{ left: p.x, top: stemTop(p.lane, horizon) - 52 }}
          >
            <span className="u-state">{p.state}</span>
            <span className="u-title">{p.title}</span>
            <span className="u-detail">{p.detail}</span>
            <span className="u-since">
              {p.since ? waited(p.since, now) : "—"} · {p.where}
            </span>
          </article>
        ))}

        <span className="u-nowlabel" style={{ left: w - RIGHT_PAD }}>
          şimdi
        </span>

        {/* Süregelen durumlar: bekleme süresi yok, geçmiyorlar. Ufkun sağında dururlar. */}
        {ongoing.length > 0 && (
          <aside className="u-ongoing">
            <h3>süregelen</h3>
            {ongoing.slice(0, 4).map((o) => (
              <div key={o.id} className={`u-on ${o.severity}`}>
                <i />
                <span className="u-on-title">{o.title}</span>
                <span className="u-on-state">{o.state}</span>
              </div>
            ))}
          </aside>
        )}
        <span className="u-span">ufuk: {spanH < 1 ? `${Math.round(spanH * 60)} dk` : `${Math.round(spanH)} sa`}</span>
        <footer className="u-below">
          <span>{model.ambient.loadLabel || "filo"} · işlemci</span>
        </footer>
      </div>
      {gear === "calm" && <div className="u-gear">sakin</div>}
    </div>
  );
}

const stemTop = (lane: number, horizon: number) => horizon - 30 - lane * 104;

const fmtTime = (ms: number) =>
  ms ? new Date(ms).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "--:--";
const fmtDate = (ms: number) =>
  ms ? new Date(ms).toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" }) : "";
