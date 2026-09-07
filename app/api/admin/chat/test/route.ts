import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin/auth";
import { getAllSettings } from "@/lib/server/config/settings";
import { cwConversations, cwNotifications, cwProfile } from "@/lib/server/chat/chatwoot";
import { mmDisplayName, mmFetch, mmLogin, type MmChannel, type MmMember, type MmTeam, type MmUser } from "@/lib/server/chat/mattermost";

export const dynamic = "force-dynamic";
const MASK = "••••••";

interface Body {
  source?: "chatwoot" | "mattermost";
  url?: string;
  token?: string;
  accountId?: string | number;
  login?: string;
  password?: string;
}

/** Bağlantı denemesi: formdaki (ya da maskeliyse kayıtlı) kimlikle gerçek istek atar, ne görüldüğünü özetler */
export async function POST(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as Body;
  const s = await getAllSettings();
  const url = String(body.url ?? "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(url)) return NextResponse.json({ ok: false, error: "adres http(s):// ile başlamalı" });

  try {
    if (body.source === "chatwoot") {
      const token = body.token && body.token !== MASK ? body.token : s["chatwoot.token"];
      if (!token) return NextResponse.json({ ok: false, error: "erişim anahtarı gerekli" });
      const profile = await cwProfile({ url, token });
      const wanted = Number(body.accountId) || 0;
      const accountId = wanted || profile.accounts[0]?.id;
      if (!accountId) return NextResponse.json({ ok: false, error: "kullanıcı hiçbir hesaba üye değil" });
      if (wanted && !profile.accounts.some((a) => a.id === wanted))
        return NextResponse.json({ ok: false, error: `hesap ${wanted} bu kullanıcıda yok; hesaplar: ${profile.accounts.map((a) => `${a.id} ${a.name}`).join(", ")}` });
      const cfg = { url, token, accountId };
      const [mine, notif] = await Promise.all([cwConversations(cfg, "me"), cwNotifications(cfg).catch(() => null)]);
      return NextResponse.json({
        ok: true,
        profile: { name: profile.name, email: profile.email },
        accounts: profile.accounts,
        accountId,
        counts: {
          mine: mine.data.meta.mine_count,
          waiting: mine.data.payload.filter((c) => (c.unread_count ?? 0) > 0).length,
          mentions: notif?.data.meta.unread_count ?? 0,
        },
      });
    }
    if (body.source === "mattermost") {
      let token = body.token && body.token !== MASK ? body.token : s["mattermost.token"];
      let tokenSource: "token" | "login" = "token";
      if (!token) {
        const login = body.login || s["mattermost.login"];
        const password = body.password && body.password !== MASK ? body.password : s["mattermost.password"];
        if (!login || !password) return NextResponse.json({ ok: false, error: "erişim anahtarı ya da kullanıcı adı + parola gerekli" });
        token = await mmLogin(url, login, password);
        tokenSource = "login";
      }
      const call = <T,>(path: string) => mmFetch<T>(url, token, path);
      const me = await call<MmUser>("/users/me");
      const teams = await call<MmTeam[]>("/users/me/teams");
      let mentions = 0, channels = 0, dms = 0;
      const seen = new Set<string>();
      await Promise.all(teams.map(async (t) => {
        const [chs, mems] = await Promise.all([call<MmChannel[]>(`/users/${me.id}/teams/${t.id}/channels`), call<MmMember[]>(`/users/${me.id}/teams/${t.id}/channels/members`)]);
        const byId = new Map(mems.map((m) => [m.channel_id, m]));
        for (const ch of chs) {
          if (seen.has(ch.id)) continue;
          seen.add(ch.id);
          const m = byId.get(ch.id);
          if (!m) continue;
          const unread = Math.max(0, ch.total_msg_count - m.msg_count);
          const men = Math.max(m.mention_count ?? 0, m.mention_count_root ?? 0);
          mentions += men;
          if (unread > 0 || men > 0) { if (ch.type === "D") dms++; else channels++; }
        }
      }));
      return NextResponse.json({ ok: true, me: mmDisplayName(me), username: me.username, teams: teams.map((t) => t.display_name), tokenSource, unread: { mentions, channels, dms } });
    }
    return NextResponse.json({ ok: false, error: "source gerekli" });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message });
  }
}
