"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/* ── Yönetim paneli ortak parçaları ── */

export function Card({ title, sub, right, children, className = "" }: { title?: string; sub?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-xl ${className}`}
      style={{ background: "var(--admin-surface)", boxShadow: "var(--admin-shadow)", border: "1px solid var(--admin-line)" }}
    >
      {(title || right) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div>
            {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
            {sub && <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--admin-muted)" }}>{sub}</p>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

export function Button({
  children, onClick, variant = "secondary", disabled, type = "button", size = "md", className = "",
}: { children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "danger" | "ghost"; disabled?: boolean; type?: "button" | "submit"; size?: "sm" | "md"; className?: string }) {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-[background-color,transform,opacity] duration-100 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";
  const sz = size === "sm" ? "h-8 px-3 text-[12.5px]" : "h-9 px-3.5 text-[13.5px]";
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: "var(--admin-accent)", color: "#fff" },
    secondary: { background: "var(--admin-surface)", border: "1px solid var(--admin-line-strong)", color: "var(--color-ink)" },
    danger: { background: "transparent", border: "1px solid color-mix(in srgb, var(--admin-danger) 40%, transparent)", color: "var(--admin-danger)" },
    ghost: { background: "transparent", color: "var(--admin-muted)" },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sz} ${className}`} style={styles[variant]}>
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[12.5px] font-medium" style={{ color: "var(--admin-muted)" }}>{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px]" style={{ color: "var(--admin-faint)" }}>{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2"
    >
      <span
        className="inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full px-[2px] transition-colors duration-150"
        style={{ background: checked ? "var(--admin-accent)" : "var(--admin-line-strong)" }}
      >
        <span
          className="block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-150"
          style={{ transform: checked ? "translateX(16px)" : "translateX(0)" }}
        />
      </span>
      {label && <span className="text-[13px]">{label}</span>}
    </button>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ok" | "warn" | "danger" | "accent" }) {
  const color = { neutral: "var(--admin-muted)", ok: "var(--admin-ok)", warn: "var(--admin-warn)", danger: "var(--admin-danger)", accent: "var(--admin-accent)" }[tone];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
      {children}
    </span>
  );
}

export function StatusDot({ ok, label }: { ok: boolean | null; label: string }) {
  const color = ok === null ? "var(--admin-faint)" : ok ? "var(--admin-ok)" : "var(--admin-danger)";
  return (
    <span className="inline-flex items-center gap-2 text-[13px]">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

/** Basit kaydet/hata bildirimi */
export function useToast(): { toast: ReactNode; show: (msg: string, tone?: "ok" | "danger") => void } {
  const [state, setState] = useState<{ msg: string; tone: "ok" | "danger"; id: number } | null>(null);
  useEffect(() => {
    if (!state) return;
    const t = setTimeout(() => setState(null), 2600);
    return () => clearTimeout(t);
  }, [state]);
  const toast = state ? (
    <div
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-[13px] font-medium text-white shadow-lg"
      style={{ background: state.tone === "ok" ? "var(--admin-ok)" : "var(--admin-danger)" }}
    >
      {state.msg}
    </div>
  ) : null;
  const show = useCallback((msg: string, tone: "ok" | "danger" = "ok") => setState({ msg, tone, id: Date.now() }), []);
  return { toast, show };
}

/** JSON API yardımcısı — hata gövdesini mesaj olarak yükseltir */
export async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...(init?.json !== undefined ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: "no-store",
  });
  if (res.status === 401 && typeof window !== "undefined" && path.startsWith("/api/admin/") && !/\/(login|setup)$/.test(path)) window.location.assign(new URL("/admin/login", window.location.origin).href);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">{title}</h1>
        {sub && <p className="mt-1 text-[13px]" style={{ color: "var(--admin-muted)" }}>{sub}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-[13px]" style={{ color: "var(--admin-faint)" }}>{children}</div>;
}

/** Diziyi yerinde değil kopyalayarak taşır; sınır dışıysa aynı diziyi döndürür */
export function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length || from === to) return arr;
  const next = [...arr];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

export function ReorderButtons({ onUp, onDown, canUp, canDown }: { onUp: () => void; onDown: () => void; canUp: boolean; canDown: boolean }) {
  const cls = "rounded p-1 transition-colors disabled:opacity-25 hover:bg-[var(--admin-accent-soft)] disabled:hover:bg-transparent";
  return (
    <span className="inline-flex">
      <button type="button" onClick={onUp} disabled={!canUp} aria-label="Yukarı taşı" className={cls}><ChevronUp size={15} /></button>
      <button type="button" onClick={onDown} disabled={!canDown} aria-label="Aşağı taşı" className={cls}><ChevronDown size={15} /></button>
    </span>
  );
}

/** İki adımlı silme: ilk tık silahlandırır, 4 sn içinde onay gelmezse geri döner */
export function ConfirmButton({ label = "Sil", confirmLabel = "Evet, sil", onConfirm }: { label?: string; confirmLabel?: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  if (!armed) return <Button size="sm" variant="danger" onClick={() => setArmed(true)}>{label}</Button>;
  return (
    <span className="inline-flex gap-1">
      <Button size="sm" variant="danger" onClick={() => { setArmed(false); onConfirm(); }}>{confirmLabel}</Button>
      <Button size="sm" variant="ghost" onClick={() => setArmed(false)}>Vazgeç</Button>
    </span>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }> }) {
  return (
    <div className="inline-flex rounded-lg p-0.5" style={{ background: "var(--admin-line)" }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className="rounded-md px-3 py-1 text-[13px] font-medium transition-colors"
          style={{
            background: value === o.value ? "var(--admin-surface)" : "transparent",
            boxShadow: value === o.value ? "0 1px 2px rgba(0,0,0,.08)" : "none",
            color: value === o.value ? "var(--color-ink)" : "var(--admin-muted)",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export type SettingsMap = Record<string, unknown>;
export const loadSettings = () => api<{ settings: SettingsMap }>("/api/admin/settings").then((r) => r.settings);
export const saveSettings = (values: SettingsMap) => api<{ ok: true; updated: string[] }>("/api/admin/settings", { method: "PUT", json: values });

/** Kaydet düğmesi + kirli durum etiketi: her sayfada aynı dil */
export function SaveBar({ dirty, busy, onSave, note }: { dirty: boolean; busy?: boolean; onSave: () => void; note?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[12.5px]" style={{ color: "var(--admin-faint)" }}>{dirty ? "Kaydedilmemiş değişiklik var" : (note ?? "Kiosk değişiklikleri bir dakika içinde alır")}</span>
      <Button variant="primary" disabled={!dirty || busy} onClick={onSave}>Kaydet</Button>
    </div>
  );
}
