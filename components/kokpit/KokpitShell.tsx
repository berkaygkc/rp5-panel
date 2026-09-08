"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Lock, X } from "lucide-react";
import Deck, { APP_HUE, type AppId } from "./Deck";
import Spine from "./Spine";
import LockScreen from "@/components/shell/LockScreen";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { getCore } from "@/lib/data/core";
import { useKioskConfig } from "@/lib/config/ConfigContext";
import { useNotices } from "@/lib/data/useNotices";
import { useLabModel, type Gear } from "@/lib/kokpit/model";
import { SEVERITY_RANK, type Notice } from "@/lib/notices/types";

/** Odak bu kadar dokunulmadan durursa güverte kendi kendine toparlanır */
const COLLAPSE_AFTER_MS = 60_000;
/** Ortalık sakinse ve bu kadar dokunulmadıysa ekran sakin vitese düşer */
const CALM_AFTER_MS = 90_000;

const APP_IDS: AppId[] = ["claude", "infra", "mail", "chat", "media", "shortcuts"];

/**
 * Kokpit kabuğu — panelin üretimdeki hâli.
 *
 * Kilit, tema, bildirimler ve yönetim panelinden gelen ekran sırası burada;
 * güverte (Deck) yalnızca içeriği çizer. Ekranın iki vitesi vardır: dokunulduğu
 * sürece çalışma, uzun süre sessizlikte sakin. Odak da kendi kendine bırakılır,
 * böylece panel her sabah aynı yerden başlar.
 */
export default function KokpitShell() {
  const model = useLabModel();
  const { screens, lockTimeoutMs } = useKioskConfig();
  const notices = useNotices();
  const [locked, setLocked] = useState(true);
  const [focus, setFocusState] = useState<AppId | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [touchedAt, setTouchedAt] = useState(0);

  const now = model.os.now;
  const order = useMemo(
    () => screens.map((s) => s.id).filter((id): id is AppId => (APP_IDS as string[]).includes(id)),
    [screens]
  );

  const setFocus = useCallback((id: AppId | null) => {
    setFocusState(id);
    setSub(null);
    setTouchedAt(Date.now());
  }, []);

  /* Dokunuş ekranı uyandırır; sessizlik önce odağı, sonra vitesi düşürür */
  useEffect(() => {
    const wake = () => setTouchedAt(Date.now());
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  const idleFor = touchedAt ? now - touchedAt : Infinity;
  const busy = model.criticals > 0 || model.waiting > 0;
  const gear: Gear = idleFor < CALM_AFTER_MS || busy ? "work" : "calm";
  const shownFocus = idleFor > COLLAPSE_AFTER_MS || gear === "calm" ? null : focus;
  const hue = shownFocus ? APP_HUE[shownFocus] : "220 18% 55%";

  /* Kilit: hareketsizlikte geri kapanır */
  const lock = useCallback(() => setLocked(true), []);
  useEffect(() => {
    if (locked) return;
    let t = window.setTimeout(lock, lockTimeoutMs);
    const reset = () => {
      window.clearTimeout(t);
      t = window.setTimeout(lock, lockTimeoutMs);
    };
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [locked, lock, lockTimeoutMs]);

  /* Kiosk: uzun basış menüsü hiçbir yerde açılmasın */
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    window.addEventListener("contextmenu", block);
    return () => window.removeEventListener("contextmenu", block);
  }, []);

  /* Bildirimden ya da bir bileşenden gelen "şu uygulamayı aç" isteği */
  useEffect(() => {
    const onGoto = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if ((APP_IDS as string[]).includes(id)) setFocus(id as AppId);
    };
    window.addEventListener("panel-goto", onGoto);
    window.addEventListener("panel-lock", lock);
    return () => {
      window.removeEventListener("panel-goto", onGoto);
      window.removeEventListener("panel-lock", lock);
    };
  }, [setFocus, lock]);

  /* Klavye: Esc odağı bırakır, rakamlar paneli açar (geliştirme kolaylığı) */
  useEffect(() => {
    if (locked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocus(null);
      const n = Number(e.key);
      if (n >= 1 && n <= APP_IDS.length) setFocus(APP_IDS[n - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, setFocus]);

  return (
    <main className={`k4-root g-${gear}`} style={{ ["--k4-hue" as string]: hue }}>
      <div className="k4-aurora" key={shownFocus ?? "none"} aria-hidden />

      <div
        className="k4-stage"
        style={{
          transform: locked ? "scale(0.97)" : "scale(1)",
          opacity: locked ? 0.35 : 1,
          transition: "transform 550ms var(--k4-ease), opacity 550ms var(--k4-ease)",
        }}
      >
        <Spine
          model={model}
          notices={
            <SpineNotices
              notices={notices.notices}
              now={now}
              onDismiss={notices.dismiss}
              onOpen={(screen) => {
                if ((APP_IDS as string[]).includes(screen)) setFocus(screen as AppId);
              }}
            />
          }
          actions={
            <div className="k4-spine-actions">
              <ThemeToggle className="k4-sbtn" />
              <button className="k4-sbtn" onClick={lock} aria-label="Ekranı kilitle">
                <Lock size={15} strokeWidth={2.1} />
              </button>
            </div>
          }
        />

        <Deck
          model={model}
          focus={shownFocus}
          setFocus={setFocus}
          sub={sub}
          setSub={setSub}
          order={order}
        />
      </div>

      {locked && <LockScreen onUnlock={() => setLocked(false)} pending={notices.notices.length} />}
    </main>
  );
}

/* ── Bildirimler omurgada: hiçbir paneli örtmezler ─────────────────────── */

function SpineNotices({
  notices,
  now,
  onDismiss,
  onOpen,
}: {
  notices: Notice[];
  now: number;
  onDismiss: (id: string) => void;
  onOpen: (screen: string) => void;
}) {
  const busy = useRef<string | null>(null);
  const active = [...notices]
    .filter((n) => n.expiresAt === null || now === 0 || n.expiresAt > now)
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.ts - a.ts);
  if (active.length === 0) return null;
  const top = active.slice(0, 2);

  return (
    <div className="k4-notices">
      {top.map((n) => (
        <article key={n.id} className={`k4-notice ${n.severity}`}>
          <button
            className="k4-notice-main"
            onClick={() => n.screen && onOpen(n.screen)}
            disabled={!n.screen}
          >
            <span className="k4-notice-t">{n.title}</span>
            {n.body && <span className="k4-notice-b">{n.body}</span>}
          </button>
          <button className="k4-notice-x" onClick={() => onDismiss(n.id)} aria-label="Kapat">
            <X size={12} strokeWidth={2.6} />
          </button>
          {(n.actions ?? []).slice(0, 2).map((a) => (
            <button
              key={a.id}
              className="k4-notice-act"
              onClick={() => {
                if (busy.current) return;
                busy.current = a.id;
                void getCore()
                  .intent(a.capability, a.action, a.args)
                  .then((ack) => {
                    busy.current = null;
                    if (ack.ok && a.dismiss !== false) onDismiss(n.id);
                  });
              }}
            >
              {a.label}
            </button>
          ))}
        </article>
      ))}
      {active.length > top.length && <span className="k4-notice-more">+{active.length - top.length} bildirim</span>}
    </div>
  );
}
