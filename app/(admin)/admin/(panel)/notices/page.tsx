"use client";

import { useCallback, useState } from "react";
import { Bell, Send } from "lucide-react";
import {
  Button, ConfirmButton, Drawer, Empty, Field, Panel, Skeleton, Tag,
  ago, api, usePoll, useToast,
} from "@/components/admin/ui";
import type { Notice, NoticeSeverity } from "@/lib/notices/types";

const SEV: Record<NoticeSeverity, { label: string; tone: "ok" | "warn" | "fault" }> = {
  info: { label: "Bilgi", tone: "ok" },
  attention: { label: "Dikkat", tone: "warn" },
  urgent: { label: "Acil", tone: "fault" },
};

function remaining(expiresAt: number | null) {
  if (expiresAt === null) return "kalıcı";
  const s = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
  return s < 60 ? `${s} sn` : `${Math.ceil(s / 60)} dk`;
}

export default function NoticesPage() {
  const load = useCallback(() => api<{ notices: Notice[] }>("/api/admin/notices").then((r) => [...r.notices].sort((a, b) => b.ts - a.ts)), []);
  const { data, loading, refresh } = usePoll(load, 5000);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ title: "Test bildirimi", body: "Yönetim konsolundan gönderildi", severity: "attention" as NoticeSeverity, kind: "system" });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const notices = data ?? [];

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); refresh(); toast.ok(ok); return true; }
    catch (e) { toast.fail((e as Error).message); return false; }
    finally { setBusy(false); }
  };

  return (
    <>
      <header className="a-head">
        <div>
          <h1 className="a-title">Aktif bildirimler</h1>
          <p className="a-sub">
            Kiosk’un Dynamic Island’ında şu an duran bildirimler. Bilgi ve dikkat bildirimleri süresi dolunca düşer; acil olanlar siz ya da üretici kapatana kadar kalır.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {notices.length > 0 && (
            <ConfirmButton label="Tümünü kapat" confirm={`${notices.length} bildirimi kapat`} onConfirm={() => void run(() => api("/api/admin/notices", { method: "DELETE", json: { all: true } }), "Bildirimler kapatıldı")} />
          )}
          <Button variant="primary" onClick={() => setOpen(true)}><Send size={14} /> Test gönder</Button>
        </div>
      </header>

      <Panel flush>
        {loading ? (
          <div className="flex flex-col gap-3 p-4"><Skeleton /><Skeleton /></div>
        ) : notices.length === 0 ? (
          <Empty>
            <Bell size={18} className="mx-auto mb-2 opacity-50" />
            Kiosk sakin. Bekleyen bildirim yok.
          </Empty>
        ) : (
          <table className="a-tbl">
            <thead>
              <tr>
                <th style={{ width: 84 }}>Önem</th>
                <th>Bildirim</th>
                <th style={{ width: 96 }}>Tür</th>
                <th style={{ width: 160 }}>Üretici</th>
                <th style={{ width: 110 }}>Geldi</th>
                <th style={{ width: 92 }}>Kalan</th>
                <th style={{ width: 84 }} />
              </tr>
            </thead>
            <tbody>
              {notices.map((n) => (
                <tr key={n.id}>
                  <td><Tag tone={SEV[n.severity]?.tone}>{SEV[n.severity]?.label ?? n.severity}</Tag></td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{n.title}</div>
                    {n.body && <div className="a-muted text-[12px]">{n.body}</div>}
                    {n.screen && <div className="a-faint text-[11.5px]">dokununca {n.screen} ekranına gider</div>}
                  </td>
                  <td className="a-muted">{n.kind}</td>
                  <td><code className="a-muted">{n.source}</code></td>
                  <td className="a-num a-muted">{ago(n.ts)}</td>
                  <td className="a-num" style={{ color: n.expiresAt === null ? "var(--a-fault)" : "var(--a-muted)" }}>{remaining(n.expiresAt)}</td>
                  <td>
                    <div className="a-tbl-actions">
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => api("/api/admin/notices", { method: "DELETE", json: { id: n.id } }), "Bildirim kapatıldı")}>Kapat</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Drawer
        open={open}
        title="Test bildirimi gönder"
        desc="Bildirim kurallardan geçer ve gerçek bir bildirim gibi kiosk’ta görünür."
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Vazgeç</Button>
            <Button
              variant="primary"
              disabled={!draft.title.trim() || busy}
              onClick={() => void run(() => api("/api/admin/notices", { method: "POST", json: draft }), "Bildirim kiosk’a gönderildi").then((ok) => { if (ok) setOpen(false); })}
            >
              Gönder
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Başlık"><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
          <Field label="Gövde"><input value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></Field>
          <Field label="Önem" hint="Acil seçilirse kapatılana kadar kiosk’ta kalır">
            <select value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value as NoticeSeverity })}>
              {(Object.keys(SEV) as NoticeSeverity[]).map((s) => <option key={s} value={s}>{SEV[s].label}</option>)}
            </select>
          </Field>
          <Field label="Tür" hint="Kiosk’taki ikonu belirler: claude, mail, chat, ci, server, system">
            <input value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} />
          </Field>
        </div>
      </Drawer>
    </>
  );
}
