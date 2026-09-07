"use client";

import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
  type ChangeEvent, type ReactNode,
} from "react";
import { ChevronDown, ChevronUp, Trash2, X } from "lucide-react";

/* ============================================================================
 * Konsol bileşenleri.
 * Stil sınıfları app/admin.css'te; burada yalnızca davranış var.
 * ========================================================================== */

/* ── Ağ ── */

/** JSON API yardımcısı: hata gövdesini mesaja çevirir, 401'de girişe atar */
export async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...(init?.json !== undefined ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: "no-store",
  });
  if (res.status === 401 && typeof window !== "undefined" && path.startsWith("/api/admin/") && !/\/(login|setup)$/.test(path)) {
    window.location.assign(new URL("/admin/login", window.location.origin).href);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `İstek başarısız (HTTP ${res.status})`);
  return data;
}

/** Yoklama: yükleme/hata durumlarını tek yerde tutar, elle tazelenebilir */
export function usePoll<T>(load: () => Promise<T>, intervalMs = 0): { data: T | null; error: string | null; loading: boolean; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = () =>
      load().then(
        (d) => { if (alive) { setData(d); setError(null); setLoading(false); } },
        (e: Error) => { if (alive) { setError(e.message); setLoading(false); } }
      );
    void tick();
    if (!intervalMs) return () => { alive = false; };
    const t = setInterval(() => void tick(), intervalMs);
    return () => { alive = false; clearInterval(t); };
  }, [load, intervalMs, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, refresh };
}

/* ── Bildirim (toast) ── */

interface ToastItem { id: number; text: string; tone: "ok" | "fault"; open: boolean }
interface ToastApi { ok: (text: string) => void; fail: (text: string) => void }
const ToastCtx = createContext<ToastApi>({ ok: () => {}, fail: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastHost({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const push = useCallback((text: string, tone: "ok" | "fault") => {
    const id = ++seq.current;
    setItems((list) => [...list.slice(-3), { id, text, tone, open: false }]);
    // Giriş geçişi: eklendikten sonraki karede açılır (transition retarget edilebilir kalır)
    requestAnimationFrame(() => setItems((list) => list.map((t) => (t.id === id ? { ...t, open: true } : t))));
    setTimeout(() => setItems((list) => list.map((t) => (t.id === id ? { ...t, open: false } : t))), tone === "ok" ? 2600 : 5200);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), tone === "ok" ? 2900 : 5500);
  }, []);

  const value = useMemo<ToastApi>(() => ({ ok: (t) => push(t, "ok"), fail: (t) => push(t, "fault") }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="a-toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="a-toast" data-open={t.open} data-tone={t.tone}>
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ── Düzen ── */

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <header className="a-head">
      <div>
        <h1 className="a-title">{title}</h1>
        {sub && <p className="a-sub">{sub}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title, titleNode, desc, actions, footer, flush = false, className = "", children,
}: { title?: string; titleNode?: ReactNode; desc?: string; actions?: ReactNode; footer?: ReactNode; flush?: boolean; className?: string; children?: ReactNode }) {
  return (
    <section className={`a-panel ${className}`}>
      {(title || titleNode || actions) && (
        <header className="a-panel-head">
          <div className="min-w-0">
            {titleNode ?? (title && <h2 className="a-panel-title">{title}</h2>)}
            {desc && <p className="a-panel-desc">{desc}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children !== undefined && <div className="a-panel-body" data-flush={flush}>{children}</div>}
      {footer && <div className="a-panel-foot">{footer}</div>}
    </section>
  );
}

/* ── Kontroller ── */

export function Button({
  children, onClick, variant = "default", size, disabled, type = "button", title, className = "",
}: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "default" | "danger" | "ghost";
  size?: "sm" | "icon"; disabled?: boolean; type?: "button" | "submit"; title?: string; className?: string;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} aria-label={size === "icon" ? title : undefined} className={`a-btn ${className}`} data-variant={variant} data-size={size}>
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`a-field ${className}`}>
      <span className="a-label">{label}</span>
      {children}
      {hint && <span className="a-hint">{hint}</span>}
    </label>
  );
}

export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label?: string; id?: string }) {
  const auto = useId();
  const knob = <button type="button" id={id ?? auto} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="a-switch"><span /></button>;
  if (!label) return knob;
  return (
    <span className="a-switch-row">
      {knob}
      <label htmlFor={id ?? auto}>{label}</label>
    </span>
  );
}

export function Tag({ children, tone }: { children: ReactNode; tone?: "ok" | "warn" | "fault" | "solid" }) {
  return <span className="a-tag" data-tone={tone}>{children}</span>;
}

export function Dot({ tone, live }: { tone?: "ok" | "warn" | "fault"; live?: boolean }) {
  return <span className="a-dot" data-tone={tone} data-live={live ? "true" : undefined} />;
}

export function Status({ tone, children }: { tone?: "ok" | "warn" | "fault"; children: ReactNode }) {
  return <span className="inline-flex items-center gap-2"><Dot tone={tone} live={tone === "ok"} />{children}</span>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="a-kbd">{children}</kbd>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="a-empty">{children}</div>;
}

export function Skeleton({ h = 14, w = "100%", className = "" }: { h?: number; w?: number | string; className?: string }) {
  return <div className={`a-skeleton ${className}`} style={{ height: h, width: w }} />;
}

/** Yukarı/aşağı taşıma — sürükle-bırak yerine kesin ve klavyeyle erişilebilir */
export function Reorder({ onUp, onDown, canUp, canDown }: { onUp: () => void; onDown: () => void; canUp: boolean; canDown: boolean }) {
  return (
    <span className="inline-flex">
      <Button size="icon" variant="ghost" onClick={onUp} disabled={!canUp} title="Yukarı taşı"><ChevronUp size={15} /></Button>
      <Button size="icon" variant="ghost" onClick={onDown} disabled={!canDown} title="Aşağı taşı"><ChevronDown size={15} /></Button>
    </span>
  );
}

/** İki adımlı silme: ilk dokunuş silahlandırır, 4 sn sonra kendiliğinden geri alır */
export function ConfirmButton({ label, confirm = "Silmeyi onayla", onConfirm }: { label?: string; confirm?: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  if (!armed) {
    return label
      ? <Button size="sm" variant="ghost" onClick={() => setArmed(true)}>{label}</Button>
      : <Button size="icon" variant="ghost" onClick={() => setArmed(true)} title="Sil"><Trash2 size={15} /></Button>;
  }
  return (
    <span className="inline-flex gap-1">
      <Button size="sm" variant="danger" onClick={() => { setArmed(false); onConfirm(); }}>{confirm}</Button>
      <Button size="sm" variant="ghost" onClick={() => setArmed(false)}>Vazgeç</Button>
    </span>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }> }) {
  return (
    <div className="inline-flex gap-1 rounded-[9px] p-1" style={{ background: "var(--a-ink-wash)" }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className="a-btn"
          data-size="sm"
          data-variant={value === o.value ? "default" : "ghost"}
          style={value === o.value ? undefined : { borderColor: "transparent" }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Kaydet çubuğu: kirli durumda yükselir, ⌘S ile de kaydeder ── */

export function SaveBar({ dirty, busy, onSave, onReset, note }: { dirty: boolean; busy?: boolean; onSave: () => void; onReset?: () => void; note?: string }) {
  useEffect(() => {
    if (!dirty || busy) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, busy, onSave]);

  return (
    <div className="a-savebar" data-open={dirty} aria-hidden={!dirty}>
      <span className="a-muted">{note ?? "Kaydedilmemiş değişiklikler var. Kiosk yeni ayarları bir dakika içinde alır."}</span>
      <span className="flex items-center gap-2">
        {onReset && <Button variant="ghost" onClick={onReset} disabled={busy}>Değişiklikleri geri al</Button>}
        <Button variant="primary" onClick={onSave} disabled={busy}>
          {busy ? "Kaydediliyor" : "Kaydet"} <Kbd>⌘S</Kbd>
        </Button>
      </span>
    </div>
  );
}

/* ── Çekmece: düzenleme formları sayfayı bölmek yerine yandan gelir ── */

export function Drawer({
  open, title, desc, onClose, footer, children,
}: { open: boolean; title: string; desc?: string; onClose: () => void; footer?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div className="a-scrim" data-open={open} onClick={onClose} aria-hidden />
      <aside className="a-drawer" data-open={open} role="dialog" aria-modal={open} aria-label={title} aria-hidden={!open}>
        <header className="a-drawer-head">
          <div className="min-w-0">
            <h2 className="a-panel-title">{title}</h2>
            {desc && <p className="a-panel-desc">{desc}</p>}
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} title="Kapat"><X size={16} /></Button>
        </header>
        <div className="a-drawer-body">{children}</div>
        {footer && <div className="a-drawer-foot">{footer}</div>}
      </aside>
    </>
  );
}

/* ── Yardımcılar ── */

/** Diziyi kopyalayarak taşır; sınır dışıysa aynı diziyi döndürür */
export function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length || from === to) return arr;
  const next = [...arr];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

export const num = (e: ChangeEvent<HTMLInputElement>) => Number(e.target.value);

export type SettingsMap = Record<string, unknown>;
export const loadSettings = () => api<{ settings: SettingsMap }>("/api/admin/settings").then((r) => r.settings);
export const saveSettings = (values: SettingsMap) => api<{ ok: true; updated: string[] }>("/api/admin/settings", { method: "PUT", json: values });

/** Göreli zaman — konsol dilinde kısa */
export function ago(ts: number): string {
  if (!ts) return "henüz yok";
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s} sn önce`;
  if (s < 3600) return `${Math.floor(s / 60)} dk önce`;
  if (s < 86_400) return `${Math.floor(s / 3600)} sa önce`;
  return `${Math.floor(s / 86_400)} gün önce`;
}

export function duration(sec: number): string {
  const d = Math.floor(sec / 86_400);
  const h = Math.floor((sec % 86_400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d) return `${d} g ${h} sa`;
  if (h) return `${h} sa ${m} dk`;
  return `${m} dk`;
}
