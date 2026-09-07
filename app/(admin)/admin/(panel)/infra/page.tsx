"use client";

import { useCallback, useState } from "react";
import { Button, Empty, Field, Panel, Reorder, SaveBar, Skeleton, Status, Switch, ago, api, loadSettings, move, saveSettings, usePoll, useToast } from "@/components/admin/ui";

interface SystemRow { id: string; name: string; host: string; status: string; containers: number; displayName: string | null; order: number; hidden: boolean }
interface InfraResp { configured: boolean; error: string | null; updatedAt: number; systems: SystemRow[] }
interface Conn { url: string; email: string; password: string }
interface Thresholds { diskWarnPct: number; pollSec: number }
type Test = { ok: boolean; systems?: string[]; error?: string };

const STATUS_TR: Record<string, { label: string; tone: "ok" | "warn" | "fault" }> = {
  up: { label: "ayakta", tone: "ok" },
  down: { label: "yanıt yok", tone: "fault" },
  paused: { label: "duraklatıldı", tone: "warn" },
  pending: { label: "bekleniyor", tone: "warn" },
};

export default function InfraPage() {
  const loadInfra = useCallback(() => api<InfraResp>("/api/admin/infra"), []);
  const loadConn = useCallback(
    () =>
      loadSettings().then((s) => ({
        conn: { url: String(s["beszel.url"] ?? ""), email: String(s["beszel.email"] ?? ""), password: String(s["beszel.password"] ?? "") },
        thr: { diskWarnPct: Number(s["infra.diskWarnPct"] ?? 90), pollSec: Math.round(Number(s["infra.pollMs"] ?? 10000) / 1000) },
      })),
    []
  );
  const infra = usePoll(loadInfra, 15_000);
  const settings = usePoll(loadConn);
  const [rows, setRows] = useState<SystemRow[] | null>(null);
  const [conn, setConn] = useState<Conn | null>(null);
  const [thr, setThr] = useState<Thresholds | null>(null);
  const [test, setTest] = useState<Test | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const systems = rows ?? infra.data?.systems ?? [];
  const dirty = rows !== null && JSON.stringify(rows) !== JSON.stringify(infra.data?.systems ?? []);
  const c = conn ?? settings.data?.conn ?? null;
  const t = thr ?? settings.data?.thr ?? null;
  const connDirty = conn !== null && JSON.stringify(conn) !== JSON.stringify(settings.data?.conn);
  const thrDirty = thr !== null && JSON.stringify(thr) !== JSON.stringify(settings.data?.thr);

  const saveRows = useCallback(async () => {
    if (!rows) return;
    setBusy("rows");
    try {
      await api("/api/admin/infra", { method: "PUT", json: { systems: rows.map((r) => ({ id: r.id, displayName: r.displayName, hidden: r.hidden })) } });
      setRows(null);
      infra.refresh();
      toast.ok("Sunucu görünümü kaydedildi");
    } catch (e) { toast.fail((e as Error).message); } finally { setBusy(null); }
  }, [rows, infra, toast]);

  const saveConn = async () => {
    if (!c) return;
    setBusy("conn");
    try {
      await saveSettings({ "beszel.url": c.url, "beszel.email": c.email, "beszel.password": c.password });
      setConn(null);
      settings.refresh();
      toast.ok("Beszel bağlantısı kaydedildi");
      setTimeout(() => infra.refresh(), 1500);
    } catch (e) { toast.fail((e as Error).message); } finally { setBusy(null); }
  };
  const saveThr = async () => {
    if (!t) return;
    setBusy("thr");
    try {
      await saveSettings({ "infra.diskWarnPct": t.diskWarnPct, "infra.pollMs": t.pollSec * 1000 });
      setThr(null);
      settings.refresh();
      toast.ok("Eşikler kaydedildi");
    } catch (e) { toast.fail((e as Error).message); } finally { setBusy(null); }
  };
  const runTest = async () => {
    if (!c) return;
    setBusy("test");
    try { setTest(await api<Test>("/api/admin/beszel/test", { method: "POST", json: c })); }
    catch (e) { setTest({ ok: false, error: (e as Error).message }); }
    finally { setBusy(null); }
  };

  return (
    <>
      <header className="a-head">
        <div>
          <h1 className="a-title">Altyapı</h1>
          <p className="a-sub">
            Kiosk’un Altyapı ekranı bir Beszel hub’ından beslenir. Sunucular Beszel’de panel kullanıcısına atanmış olmalı.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-[1fr_368px] items-start gap-4">
        <Panel
          title="Sunucular"
          desc="Kiosk bu sırayı ve buradaki adları kullanır. Kapattığınız sunucu kiosk’ta hiç görünmez."
          flush
          footer={infra.data ? <><span>{infra.data.systems.length} sistem</span><span className="a-num">{ago(infra.data.updatedAt)} güncellendi</span></> : undefined}
        >
          {infra.loading ? (
            <div className="flex flex-col gap-3 p-4"><Skeleton /><Skeleton /><Skeleton /></div>
          ) : infra.data?.error ? (
            <Empty>Beszel okunamıyor: {infra.data.error}</Empty>
          ) : systems.length === 0 ? (
            <Empty>{infra.data?.configured ? "Beszel’de bu kullanıcıya atanmış sistem yok." : "Beszel kimliği tanımlı değil. Sağdaki karttan bağlanın."}</Empty>
          ) : (
            <table className="a-tbl">
              <thead>
                <tr>
                  <th style={{ width: 66 }}>Göster</th>
                  <th>Beszel’deki ad</th>
                  <th>Kiosk’ta görünen ad</th>
                  <th style={{ width: 120 }}>Durum</th>
                  <th style={{ width: 96 }} data-align="right">Konteyner</th>
                  <th style={{ width: 76 }} />
                </tr>
              </thead>
              <tbody>
                {systems.map((s, i) => {
                  const st = STATUS_TR[s.status] ?? { label: s.status, tone: "warn" as const };
                  return (
                    <tr key={s.id} data-off={s.hidden}>
                      <td><Switch checked={!s.hidden} onChange={(v) => setRows(systems.map((x, j) => (j === i ? { ...x, hidden: !v } : x)))} label={undefined} /></td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{s.name}</div>
                        <code className="a-faint">{s.host}</code>
                      </td>
                      <td>
                        <input className="a-inline-input" value={s.displayName ?? ""} placeholder={s.name} aria-label={`${s.name} görünen adı`} onChange={(e) => setRows(systems.map((x, j) => (j === i ? { ...x, displayName: e.target.value || null } : x)))} />
                      </td>
                      <td><Status tone={st.tone}>{st.label}</Status></td>
                      <td className="a-num" data-align="right">{s.containers}</td>
                      <td>
                        <div className="a-tbl-actions">
                          <Reorder canUp={i > 0} canDown={i < systems.length - 1} onUp={() => setRows(move(systems, i, i - 1))} onDown={() => setRows(move(systems, i, i + 1))} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel
            title="Beszel bağlantısı"
            desc="Hub adresi ve panel için açılmış salt okunur kullanıcı."
            footer={
              <>
                <Button size="sm" onClick={() => void runTest()} disabled={busy === "test" || !c?.url}>{busy === "test" ? "Deneniyor" : "Bağlantıyı dene"}</Button>
                <Button size="sm" variant="primary" disabled={!connDirty || busy === "conn"} onClick={() => void saveConn()}>Kaydet</Button>
              </>
            }
          >
            {!c ? <Skeleton h={120} /> : (
              <div className="flex flex-col gap-4">
                <Field label="Hub adresi"><input type="url" className="a-mono" value={c.url} onChange={(e) => setConn({ ...c, url: e.target.value })} placeholder="http://localhost:8090" /></Field>
                <Field label="E-posta"><input type="email" value={c.email} onChange={(e) => setConn({ ...c, email: e.target.value })} /></Field>
                <Field label="Parola" hint="Kayıtlı parola maskeli görünür; değiştirmek için yenisini yazın."><input type="password" autoComplete="off" value={c.password} onChange={(e) => setConn({ ...c, password: e.target.value })} /></Field>
                {test && (
                  <div className="rounded-[7px] p-3" style={{ background: "var(--a-sunken)", border: "1px solid var(--a-line)" }}>
                    <Status tone={test.ok ? "ok" : "fault"}>
                      {test.ok ? `Giriş başarılı, ${test.systems?.length ?? 0} sistem görülüyor` : `Bağlanılamadı: ${test.error}`}
                    </Status>
                    {test.ok && test.systems && test.systems.length > 0 && <div className="a-muted mt-2 pl-4 text-[12px]">{test.systems.join(", ")}</div>}
                  </div>
                )}
              </div>
            )}
          </Panel>

          <Panel
            title="Eşikler"
            footer={<><span>Kiosk yeni değerleri hemen alır.</span><Button size="sm" variant="primary" disabled={!thrDirty || busy === "thr"} onClick={() => void saveThr()}>Kaydet</Button></>}
          >
            {!t ? <Skeleton h={80} /> : (
              <div className="flex flex-col gap-4">
                <Field label="Disk uyarı eşiği" hint="Bu doluluğu aşan sunucu için dikkat bildirimi düşer.">
                  <div className="flex items-center gap-2">
                    <input type="number" min={50} max={100} value={t.diskWarnPct} onChange={(e) => setThr({ ...t, diskWarnPct: Number(e.target.value) })} style={{ width: 90 }} />
                    <span className="a-muted">yüzde</span>
                  </div>
                </Field>
                <Field label="Yoklama aralığı" hint="En az 5 saniye.">
                  <div className="flex items-center gap-2">
                    <input type="number" min={5} value={t.pollSec} onChange={(e) => setThr({ ...t, pollSec: Number(e.target.value) })} style={{ width: 90 }} />
                    <span className="a-muted">saniye</span>
                  </div>
                </Field>
              </div>
            )}
          </Panel>
        </div>
      </div>

      <SaveBar dirty={dirty} busy={busy === "rows"} onSave={() => void saveRows()} onReset={() => setRows(null)} note="Sunucu adları ve sırası değişti." />
    </>
  );
}
