import { NextResponse } from "next/server";
import { requireAdmin, hashPassword, verifyPassword } from "@/lib/server/admin/auth";
import { getAllSettings, SECRET_KEYS, SETTING_DEFAULTS, setSettings, type SettingKey } from "@/lib/server/config/settings";

export const dynamic = "force-dynamic";

/** Ayarlar — gizli olanlar maskelenir (parola var/yok) */
export async function GET(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const s = await getAllSettings();
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(SETTING_DEFAULTS) as SettingKey[]) {
    out[k] = SECRET_KEYS.includes(k) ? (s[k] ? "••••••" : "") : s[k];
  }
  return NextResponse.json({ settings: out });
}

const VALIDATORS: Partial<Record<SettingKey, (v: unknown) => unknown>> = {
  "pin.code": (v) => (/^\d{4,8}$/.test(String(v)) ? String(v) : undefined),
  "lock.timeoutMs": (v) => (Number(v) >= 30_000 ? Math.round(Number(v)) : undefined),
  "theme.default": (v) => (v === "light" || v === "dark" ? v : undefined),
  "rail.defaultRecents": (v) => (Array.isArray(v) ? v.map(String).slice(0, 2) : undefined),
  "claude.waitNoticeMs": (v) => (Number(v) >= 30_000 ? Math.round(Number(v)) : undefined),
  "mail.excludedAddresses": (v) => (Array.isArray(v) ? v.map(String).filter(Boolean) : undefined),
  "mail.maxNoticesPerRefresh": (v) => (Number(v) >= 0 ? Math.round(Number(v)) : undefined),
  "mail.messageLimit": (v) => (Number(v) >= 10 && Number(v) <= 500 ? Math.round(Number(v)) : undefined),
  "infra.diskWarnPct": (v) => (Number(v) >= 50 && Number(v) <= 100 ? Math.round(Number(v)) : undefined),
  "infra.pollMs": (v) => (Number(v) >= 5000 ? Math.round(Number(v)) : undefined),
  "beszel.url": (v) => String(v).replace(/\/+$/, ""),
  "beszel.email": (v) => String(v),
  "beszel.password": (v) => String(v),
};

/** Ayar güncelle — maskelenmiş gizli değer ("••••••") gönderilirse dokunulmaz */
export async function PUT(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const entries: Partial<Record<SettingKey, unknown>> = {};
  const errors: string[] = [];
  for (const [k, v] of Object.entries(body)) {
    const key = k as SettingKey;
    const validate = VALIDATORS[key];
    if (!validate) continue;
    if (SECRET_KEYS.includes(key) && v === "••••••") continue;
    const val = validate(v);
    if (val === undefined) { errors.push(k); continue; }
    entries[key] = val;
  }
  if (errors.length) return NextResponse.json({ error: `geçersiz: ${errors.join(", ")}` }, { status: 400 });
  await setSettings(entries);
  return NextResponse.json({ ok: true, updated: Object.keys(entries) });
}

/** Yönetici parolası değiştir */
export async function PATCH(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const { current, next } = (await req.json().catch(() => ({}))) as { current?: string; next?: string };
  const stored = String((await getAllSettings())["admin.passwordHash"]);
  if (!current || !verifyPassword(current, stored)) return NextResponse.json({ error: "mevcut parola yanlış" }, { status: 401 });
  if (!next || next.length < 8) return NextResponse.json({ error: "yeni parola en az 8 karakter" }, { status: 400 });
  await setSettings({ "admin.passwordHash": hashPassword(next) });
  return NextResponse.json({ ok: true });
}
