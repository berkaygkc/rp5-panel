"use client";

import { useCallback, useState } from "react";
import { Copy, Plus } from "lucide-react";
import {
  Button, ConfirmButton, Drawer, Empty, Field, Panel, Skeleton, Status, Switch, Tag,
  ago, api, usePoll, useToast,
} from "@/components/admin/ui";

interface Device {
  id: string; name: string; role: string; capabilities: string[];
  lastSeenAt: number | null; revoked: boolean; createdAt: number; online: boolean;
}
interface Live { providers: Array<{ name: string; capabilities: string[] }>; surfaces: number; domains: string[]; capabilities: string[] }
interface Resp { devices: Device[]; live: Live; capabilities: string[] }

const ROLE_TR: Record<string, string> = { provider: "Sağlayıcı", surface: "Yüzey" };

export default function DevicesPage() {
  const load = useCallback(() => api<Resp>("/api/admin/devices"), []);
  const { data, loading, refresh } = usePoll(load, 8000);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ name: string; role: string; capabilities: string[] }>({
    name: "", role: "provider", capabilities: ["media", "shortcuts", "claude", "mail"],
  });
  const [issued, setIssued] = useState<{ name: string; token: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); refresh(); toast.ok(ok); return true; }
    catch (e) { toast.fail((e as Error).message); return false; }
    finally { setBusy(false); }
  };
  const create = async () => {
    setBusy(true);
    try {
      const r = await api<{ token: string }>("/api/admin/devices", { method: "POST", json: draft });
      setIssued({ name: draft.name, token: r.token });
      setOpen(false);
      setDraft({ name: "", role: "provider", capabilities: ["media", "shortcuts", "claude", "mail"] });
      refresh();
      toast.ok("Cihaz eklendi");
    } catch (e) { toast.fail((e as Error).message); } finally { setBusy(false); }
  };
  const toggleCap = (c: string) =>
    setDraft((d) => ({ ...d, capabilities: d.capabilities.includes(c) ? d.capabilities.filter((x) => x !== c) : [...d.capabilities, c] }));

  const live = data?.live;

  return (
    <>
      <header className="a-head">
        <div>
          <h1 className="a-title">Cihazlar</h1>
          <p className="a-sub">
            Çekirdeğe bağlanan her şey burada. Sağlayıcılar yetenek sunar, örneğin Mac ajanı. Yüzeyler ekranlardır: Pi, telefon, tarayıcı. Anahtar bir kez gösterilir ve yalnızca özeti saklanır.
          </p>
        </div>
        <Button variant="primary" onClick={() => setOpen(true)}><Plus size={14} /> Cihaz ekle</Button>
      </header>

      {issued && (
        <Panel className="mb-4" title={`${issued.name} için anahtar`} desc="Bu anahtar bir daha gösterilmeyecek. Cihazın ayar dosyasına şimdi kopyalayın.">
          <div className="flex items-center gap-3">
            <code className="a-mono flex-1 truncate rounded-[7px] px-3 py-2" style={{ background: "var(--a-sunken)", border: "1px solid var(--a-line)" }}>{issued.token}</code>
            <Button onClick={() => { void navigator.clipboard?.writeText(issued.token); toast.ok("Panoya kopyalandı"); }}><Copy size={14} /> Kopyala</Button>
            <Button variant="ghost" onClick={() => setIssued(null)}>Kapat</Button>
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-[1fr_320px] items-start gap-4">
        <Panel flush>
          {loading ? (
            <div className="flex flex-col gap-3 p-4"><Skeleton /><Skeleton /></div>
          ) : (data?.devices.length ?? 0) === 0 ? (
            <Empty>Kayıtlı cihaz yok. Mac ajanı için bir sağlayıcı ekleyerek başlayın.</Empty>
          ) : (
            <table className="a-tbl">
              <thead>
                <tr>
                  <th style={{ width: 96 }}>Durum</th>
                  <th>Cihaz</th>
                  <th style={{ width: 110 }}>Rol</th>
                  <th>Yetenekler</th>
                  <th style={{ width: 130 }}>Son görülme</th>
                  <th style={{ width: 170 }} />
                </tr>
              </thead>
              <tbody>
                {data?.devices.map((d) => (
                  <tr key={d.id} data-off={d.revoked}>
                    <td><Status tone={d.online ? "ok" : d.revoked ? "fault" : undefined}>{d.online ? "bağlı" : d.revoked ? "iptal" : "çevrimdışı"}</Status></td>
                    <td style={{ fontWeight: 500 }}>{d.name}</td>
                    <td className="a-muted">{ROLE_TR[d.role] ?? d.role}</td>
                    <td className="a-muted">{d.capabilities.length ? d.capabilities.join(", ") : "—"}</td>
                    <td className="a-num a-muted">{d.lastSeenAt ? ago(d.lastSeenAt) : "hiç"}</td>
                    <td>
                      <div className="a-tbl-actions">
                        <Button size="sm" variant="ghost" disabled={busy}
                          onClick={() => void run(() => api("/api/admin/devices", { method: "PUT", json: { id: d.id, revoked: !d.revoked } }), d.revoked ? "Cihaz yeniden açıldı" : "Cihaz iptal edildi")}>
                          {d.revoked ? "Geri aç" : "İptal et"}
                        </Button>
                        <ConfirmButton onConfirm={() => void run(() => api("/api/admin/devices", { method: "DELETE", json: { id: d.id } }), "Cihaz silindi")} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Santral" desc="Şu an çekirdeğe bağlı olanlar">
          {!live ? <Skeleton h={90} /> : (
            <div className="flex flex-col gap-3 text-[13px]">
              <div className="flex justify-between"><span className="a-muted">Sağlayıcı</span><span className="a-num">{live.providers.length}</span></div>
              <div className="flex justify-between"><span className="a-muted">Yüzey</span><span className="a-num">{live.surfaces}</span></div>
              <div>
                <div className="a-muted mb-1.5">Çevrimiçi yetenekler</div>
                <div className="flex flex-wrap gap-1.5">
                  {live.capabilities.length === 0 ? <span className="a-faint">yok</span> : live.capabilities.map((c) => <Tag key={c} tone="ok">{c}</Tag>)}
                </div>
              </div>
              <div>
                <div className="a-muted mb-1.5">Yayınlanan alanlar</div>
                <div className="flex flex-wrap gap-1.5">
                  {live.domains.length === 0 ? <span className="a-faint">yok</span> : live.domains.map((c) => <Tag key={c}>{c}</Tag>)}
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Drawer
        open={open}
        title="Cihaz ekle"
        desc="Anahtar oluşturulduktan sonra bir kez gösterilir."
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Vazgeç</Button>
            <Button variant="primary" disabled={!draft.name.trim() || busy} onClick={() => void create()}>Anahtar üret</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Ad" hint="Örneğin “Berkay MacBook” ya da “Salon Pi”">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
          </Field>
          <Field label="Rol">
            <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
              <option value="provider">Sağlayıcı — yetenek sunar</option>
              <option value="surface">Yüzey — ekran</option>
            </select>
          </Field>
          {draft.role === "provider" && (
            <div>
              <div className="a-label">Yetenekler</div>
              <div className="flex flex-col gap-2">
                {(data?.capabilities ?? []).map((c) => (
                  <Switch key={c} checked={draft.capabilities.includes(c)} onChange={() => toggleCap(c)} label={c} />
                ))}
              </div>
            </div>
          )}
        </div>
      </Drawer>
    </>
  );
}
