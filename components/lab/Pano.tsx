"use client";

import { useRef, useState } from "react";
import type { Gear } from "./LabHost";
import { waited, type LabModel } from "./data";

/**
 * PANO — kalkış tabelası.
 *
 * Uygulama diye bir şey yok: senden bir şey isteyen her şey aynı kuyruğun
 * satırı. Sütunlar sabit, tipografi tek. Bir satır değişince harfleri kanat
 * gibi çevrilir — bilginin değiştiğini gözün değil, kulağın alışkanlığı fark eder.
 */

/* Sütunlar şeridi baştan sona doldurur: 81 karakter × ~0.63em = 1913 px */
const COLS = { what: 34, where: 20, wait: 9, state: 18 };
const ROWS = 6;

/** Değeri değişince yeniden monte olur; harfler sırayla çevrilir. */
function Flap({ text, width, className = "" }: { text: string; width: number; className?: string }) {
  const chars = text.toLocaleUpperCase("tr-TR").slice(0, width).padEnd(width, " ").split("");
  return (
    <span key={text} className={`p-flap ${className}`}>
      {chars.map((c, i) => (
        <span key={i} className="p-c" style={{ animationDelay: `${i * 18}ms` }}>
          {c === " " ? " " : c}
        </span>
      ))}
    </span>
  );
}

export default function Pano({ model, gear }: { model: LabModel; gear: Gear }) {
  const [page, setPage] = useState(0);
  const drag = useRef<{ x: number; page: number } | null>(null);
  const [dx, setDx] = useState(0);

  const now = model.os.now;
  const rows = model.items.slice(0, ROWS);
  const blanks = Math.max(0, ROWS - rows.length);
  const hero = model.items[0];

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, page };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setDx(e.clientX - drag.current.x);
  };
  const onUp = () => {
    if (!drag.current) return;
    const moved = dx;
    drag.current = null;
    setDx(0);
    if (Math.abs(moved) > 90) setPage((p) => Math.max(0, Math.min(1, p + (moved < 0 ? 1 : -1))));
  };

  /* Sakin vites: tabela tek satıra iner, kalan kanatlar boş kalır */
  if (gear === "calm") {
    return (
      <div className="p-root calm">
        <div className="p-calm">
          <Flap text={fmtTime(now)} width={5} className="huge" />
          <Flap text={hero ? hero.title : "her sey yolunda"} width={22} className="big" />
          <div className="p-calm-sub">
            <Flap text={`${model.ambient.servers.length} sunucu`} width={12} />
            <Flap text={`${model.ambient.services} servis`} width={12} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-root" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <div className="p-track" style={{ transform: `translate3d(calc(${-page * 50}% + ${dx}px), 0, 0)` }}>
        {/* Sayfa 1 — kuyruk */}
        <section className="p-page">
          <header className="p-head">
            <span style={{ width: `${COLS.what}ch` }}>
              <b>ne</b>
            </span>
            <span style={{ width: `${COLS.where}ch` }}>
              <b>nerede</b>
            </span>
            <span style={{ width: `${COLS.wait}ch` }}>
              <b>süre</b>
            </span>
            <span style={{ width: `${COLS.state}ch` }}>
              <b>durum</b>
            </span>
            <span className="p-head-right">
              <b>{fmtTime(now)}</b>
            </span>
          </header>

          <div className="p-rows">
            {rows.map((it) => (
              <div key={it.id} className={`p-row ${it.severity}`}>
                <Flap text={it.title} width={COLS.what} />
                <Flap text={it.where} width={COLS.where} className="dim" />
                <Flap text={waited(it.since, now)} width={COLS.wait} className="dim" />
                <span className="p-state">
                  <i />
                  <Flap text={it.state} width={COLS.state} />
                </span>
              </div>
            ))}
            {Array.from({ length: blanks }).map((_, i) => (
              <div key={`b${i}`} className="p-row blank">
                <Flap text="" width={COLS.what} />
                <Flap text="" width={COLS.where} />
                <Flap text="" width={COLS.wait} />
                <Flap text="" width={COLS.state} />
              </div>
            ))}
          </div>

          <footer className="p-foot">
            <Flap text={`${model.ambient.servers.length} sunucu · ${model.ambient.services} servis`} width={30} className="dim" />
            <span className="p-pages">
              <i className="on" />
              <i />
            </span>
            <Flap text={model.os.media.track ? `♪ ${model.os.media.track.title}` : `plan %${model.ambient.usagePct}`} width={28} className="dim" />
          </footer>
        </section>

        {/* Sayfa 2 — filo */}
        <section className="p-page">
          <header className="p-head">
            <span style={{ width: "34ch" }}>
              <b>sunucu</b>
            </span>
            <span style={{ width: "20ch" }}>
              <b>yük</b>
            </span>
            <span style={{ width: "18ch" }}>
              <b>durum</b>
            </span>
            <span className="p-head-right">
              <b>filo</b>
            </span>
          </header>
          <div className="p-rows">
            {model.ambient.servers.slice(0, ROWS).map((s) => (
              <div key={s.name} className={`p-row ${s.ok ? "" : "critical"}`}>
                <Flap text={s.name} width={34} />
                <Flap text={`en yüklü %${Math.round(s.worst)}`} width={20} className="dim" />
                <span className="p-state">
                  <i />
                  <Flap text={s.ok ? "sağlıklı" : "sorunlu"} width={18} />
                </span>
              </div>
            ))}
          </div>
          <footer className="p-foot">
            <Flap text={fmtTime(now)} width={10} className="dim" />
            <span className="p-pages">
              <i />
              <i className="on" />
            </span>
            <Flap text={`plan %${model.ambient.usagePct}`} width={16} className="dim" />
          </footer>
        </section>
      </div>
    </div>
  );
}

const fmtTime = (ms: number) =>
  ms ? new Date(ms).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "--:--";
