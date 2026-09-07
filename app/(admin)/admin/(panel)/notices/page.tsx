"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ConfirmButton, Empty, Field, PageHeader, api, useToast } from "@/components/admin/ui";
import type { Notice, NoticeSeverity } from "@/lib/notices/types";

const SEV: Record<NoticeSeverity, { label: string; tone: "accent" | "warn" | "danger" }> = {
  info: { label: "Bilgi", tone: "accent" },
  attention: { label: "Dikkat", tone: "warn" },
  urgent: { label: "Acil", tone: "danger" },
};

function ago(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s} sn önce`;
  if (s < 3600) return `${Math.floor(s / 60)} dk önce`;
  return `${Math.floor(s / 3600)} sa ${Math.floor((s % 3600) / 60)} dk önce`;
}
function left(expiresAt: number | null, now: number) {
  if (expiresAt === null) return "kalıcı";
  const s = Math.max(0, Math.round((expiresAt - now) / 1000));
  return s < 60 ? `${s} sn kaldı` : `${Math.ceil(s / 60)} dk kaldı`;
}

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [now, setNow] = useState(0);
  const [draft, setDraft] = useState<{ title: string; body: string; severity: NoticeSeverity; kind: string }>({ title: "Test bildirimi", body: "Yönetim panelinden gönderildi", severity: "attention", kind: "system" });
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  const reload = useCallback(
    () => api<{ notices: Notice[] }>("/api/admin/notices").then((r) => { setNotices([...r.notices].sort((a, b) => b.ts - a.ts)); setNow(Date.now()); }),
    []
  );
  useEffect(() => {
    void reload().catch((e: Error) => show(e.message, "danger"));
    const t = setInterval(() => void reload().catch(() => null), 5000);
    return () => clearInterval(t);
  }, [reload, show]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); await reload(); show(ok); } catch (e) { show((e as Error).message, "danger"); } finally { setBusy(false); }
  };
  const send = () => run(() => api("/api/admin/notices", { method: "POST", json: draft }), "Bildirim kiosk'a gönderildi");
  const clear = (id: string) => run(() => api("/api/admin/notices", { method: "DELETE", json: { id } }), "Bildirim kapatıldı");
  const clearAll = () => run(() => api("/api/admin/notices", { method: "DELETE", json: { all: true } }), "Tüm bildirimler kapatıldı");

  return (
    <>
      <PageHeader
        title="Aktif bildirimler"
        sub="Kiosk'un Dynamic Island'ında şu an duran bildirimler. Acil olanlar süresiz kalır; buradan ya da kiosk'tan kapatılana dek."
        right={notices && notices.length > 0 ? <ConfirmButton label="Tümünü kapat" confirmLabel={`${notices.length} bildirimi kapat`} onConfirm={() => void clearAll()} /> : null}
      />
      <div className="grid grid-cols-[1fr_360px] gap-5">
        <Card>
          {!notices ? null : notices.length === 0 ? (
            <Empty>Aktif bildirim yok. Sağdaki formla bir test gönderebilirsiniz.</Empty>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Önem</th>
                  <th>Bildirim</th>
                  <th style={{ width: 90 }}>Tür</th>
                  <th style={{ width: 150 }}>Kaynak</th>
                  <th style={{ width: 120 }}>Zaman</th>
                  <th style={{ width: 100 }}>Süre</th>
                  <th style={{ width: 70 }}></th>
                </tr>
              </thead>
              <tbody>
                {notices.map((n) => (
                  <tr key={n.id}>
                    <td><Badge tone={SEV[n.severity]?.tone ?? "neutral"}>{SEV[n.severity]?.label ?? n.severity}</Badge></td>
                    <td>
                      <div className="font-medium">{n.title}</div>
                      {n.body && <div className="text-[12px]" style={{ color: "var(--admin-muted)" }}>{n.body}</div>}
                      {n.screen && <div className="text-[11.5px]" style={{ color: "var(--admin-faint)" }}>dokununca {n.screen} ekranına gider</div>}
                    </td>
                    <td className="text-[12.5px]">{n.kind}</td>
                    <td><code className="mono" style={{ color: "var(--admin-muted)" }}>{n.source}</code></td>
                    <td className="text-[12.5px]" style={{ color: "var(--admin-muted)" }}>{ago(n.ts, now)}</td>
                    <td className="text-[12.5px]" style={{ color: n.expiresAt === null ? "var(--admin-danger)" : "var(--admin-muted)" }}>{left(n.expiresAt, now)}</td>
                    <td><div className="flex justify-end"><Button size="sm" variant="ghost" onClick={() => void clear(n.id)} disabled={busy}>Kapat</Button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Test bildirimi gönder" sub="Kurallardan geçer ve kiosk'ta görünür; 5 dk sonra kendiliğinden düşer (acil seçilirse kalıcı olur).">
          <div className="flex flex-col gap-3">
            <Field label="Başlık"><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
            <Field label="Gövde"><input value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Önem">
                <select value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value as NoticeSeverity })}>
                  {(Object.keys(SEV) as NoticeSeverity[]).map((s) => <option key={s} value={s}>{SEV[s].label}</option>)}
                </select>
              </Field>
              <Field label="Tür"><input value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} /></Field>
            </div>
            <div className="flex justify-end"><Button variant="primary" disabled={!draft.title.trim() || busy} onClick={() => void send()}>Gönder</Button></div>
          </div>
        </Card>
      </div>
      {toast}
    </>
  );
}
