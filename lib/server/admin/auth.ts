import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getSetting, setSettings } from "@/lib/server/config/settings";

/**
 * Yönetim paneli kimliği — tek yönetici, parola scrypt ile karılır; oturum HMAC
 * imzalı httpOnly çerezdir (7 gün). Gizli anahtar: ADMIN_SESSION_SECRET (.env.local).
 */
export const SESSION_COOKIE = "rp5_admin";
const SESSION_TTL_MS = 7 * 86_400_000;

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET ?? "";
  if (!s) throw new Error("ADMIN_SESSION_SECRET tanımlı değil");
  return s;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const a = scryptSync(password, salt, 64);
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS, n: randomBytes(8).toString("hex") })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return false;
  }
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const j = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return typeof j.exp === "number" && j.exp > Date.now();
  } catch {
    return false;
  }
}

/** Sunucu bileşenleri için: oturum var mı */
export async function isAdminSession(): Promise<boolean> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

/** Kurulum tamamlandı mı (yönetici parolası belirlendi mi) */
export async function isSetupDone(): Promise<boolean> {
  return Boolean(await getSetting("admin.setupDone")) && Boolean(await getSetting("admin.passwordHash"));
}

export async function setAdminPassword(password: string): Promise<void> {
  await setSettings({ "admin.passwordHash": hashPassword(password), "admin.setupDone": true });
}

/** Route handler koruması: çerezi doğrular, yoksa 401 */
export function requireAdmin(req: Request): Response | null {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (verifySessionToken(m?.[1])) return null;
  return Response.json({ error: "oturum gerekli" }, { status: 401 });
}

export function sessionCookieHeader(token: string | null): string {
  const base = `${SESSION_COOKIE}=${token ?? ""}; Path=/; HttpOnly; SameSite=Lax`;
  return token ? `${base}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}` : `${base}; Max-Age=0`;
}
