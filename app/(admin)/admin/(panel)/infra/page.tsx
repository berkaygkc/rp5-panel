"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Field, PageHeader, ReorderButtons, SaveBar, StatusDot, Toggle, api, loadSettings, move, saveSettings, useToast } from "@/components/admin/ui";

interface SystemRow { id: string; name: string; host: string; status: string; containers: number; displayName: string | null; order: number; hidden: boolean }
interface InfraResp { configured: boolean; error: string | null; updatedAt: number; systems: SystemRow[] }
interface Conn { url: string; email: string; password: string }
interface Thresholds { diskWarnPct: number; pollSec: number }

export default function InfraPage() {
  const [conn, setConn] = useState<Conn | null>(null);
  const [connSaved, setConnSaved] = useState("");
  const [test, setTest] = useState<{ ok: boolean; systems?: string[]; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [thr, setThr] = useState<Thresholds | null>(null);
  const [thrSaved, setThrSaved] = useState("");
  const [infra, setInfra] = useState<InfraResp | null>(null);
  const [rows, setRows] = useState<SystemRow[] | null>(null);
  const [rowsSaved, setRowsSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  const loadInfra = useCallback(
    () => api<InfraResp>("/api/admin/infra").then((r) => {
      setInfra(r);
      setRows(r.systems);
      setRowsSaved(JSON.stringify(r.systems));
    }),
    []
  );
  useEffect(() => {
    void loadSettings().then((s) => {
      const c = { url: String(s["beszel.url"] ?? ""), email: String(s["beszel.email"] ?? ""), password: String(s["beszel.password"] ?? "") };
      setConn(c); setConnSaved(JSON.stringify(c));
      const t = { diskWarnPct: Number(s["infra.diskWarnPct"] ?? 90), pollSec: Math.round(Number(s["infra.pollMs"] ?? 10000) / 1000) };
      setThr(t); setThrSaved(JSON.stringify(t));
    }).catch((e: Error) => show(e.message, "danger"));
    void loadInfra().catch((e: Error) => show(e.message, "danger"));
  }, [loadInfra, show]);

  const wrap = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); show(ok); return true; } catch (e) { show((e as Error).message, "danger"); return false; } finally { setBusy(false); }
  };
  const runTest = async () => {
    if (!conn) return;
    setTesting(true);
    try { setTest(await api("/api/admin/beszel/test", { method: "POST", json: conn })); } catch (e) { setTest({ ok: false, error: (e as Error).message }); } finally { setTesting(false); }
  };
  const saveConn = async () => {
    if (!conn) return;
    if (await wrap(() => saveSettings({ "beszel.url": conn.url, "beszel.email": conn.email, "beszel.password": conn.password }), "Beszel bağlantısı kaydedildi")) {
      setConnSaved(JSON.stringify(conn));
      setTimeout(() => void loadInfra().catch(() => null), 1500);
    }
  };
  const saveThr = async () => {
    if (!thr) return;
    if (await wrap(() => saveSettings({ "infra.diskWarnPct": thr.diskWarnPct, "infra.pollMs": thr.pollSec * 1000 }), "Eşikler kaydedildi")) setThrSaved(JSON.stringify(thr));
  };
  const saveRows = async () => {
    if (!rows) return;
    if (await wrap(() => api("/api/admin/infra", { method: "PUT", json: { systems: rows.map((r) => ({ id: r.id, displayName: r.displayName, hidden: r.hidden })) } }), "Sunucu görünümü kaydedildi")) setRowsSaved(JSON.stringify(rows));
  };
  const patchRow = (i: number, p: Partial<SystemRow>) => setRows((r) => r && r.map((x, j) => (j === i ? { ...x, ...p } : x)));

  return (
    <>
      <PageHeader title="Altyapı" sub="Kiosk’un Altyapı ekranı Beszel hub’ından beslenir. Bağlantıyı, sunucu adlarını ve uyarı eşiklerini buradan yönetin." />
      <div className="grid grid-cols-[1fr_360px] gap-5">
        <div className="flex flex-col gap-5">
          <Card
            title="Sunucular"
            sub={infra ? (infra.error ? `Beszel okunamıyor: ${infra.error}` : `${infra.systems.length} sistem; kiosk’ta buradaki sıra ve adlar kullanılır`) : "Yükleniyor"}
            right={<SaveBar dirty={rows !== null && JSON.stringify(rows) !== rowsSaved} busy={busy} onSave={() => void saveRows()} />}
          >
            {rows && rows.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>Göster</th>
                    <th>Beszel adı</th>
                    <th>Kiosk’ta görünen ad</th>
                    <th style={{ width: 110 }}>Durum</th>
                    <th style={{ width: 90 }}>Konteyner</th>
                    <th style={{ width: 70 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s, i) => (
                    <tr key={s.id} style={{ opacity: s.hidden ? 0.55 : 1 }}>
                      <td><Toggle checked={!s.hidden} onChange={(v) => patchRow(i, { hidden: !v })} /></td>
                      <td>
                        <div className="font-medium">{s.name}</div>
                        <div className="mono text-[12px]" style={{ color: "var(--admin-faint)" }}>{s.host}</div>
                      </td>
                      <td><input value={s.displayName ?? ""} onChange={(e) => patchRow(i, { displayName: e.target.value || null })} placeholder={s.name} /></td>
                      <td><StatusDot ok={s.status === "up"} label={s.status === "up" ? "ayakta" : s.status === "down" ? "düştü" : s.status} /></td>
                      <td className="text-[13px]">{s.containers}</td>
                      <td><div className="flex justify-end"><ReorderButtons canUp={i > 0} canDown={i < rows.length - 1} onUp={() => setRows((r) => r && move(r, i, i - 1))} onDown={() => setRows((r) => r && move(r, i, i + 1))} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="py-6 text-center text-[13px]" style={{ color: "var(--admin-faint)" }}>
                {infra && !infra.configured ? "Beszel kimliği tanımlı değil; sağdaki bağlantı kartını doldurun." : "Beszel’de sistem görünmüyor."}
              </p>
            )}
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          <Card title="Beszel bağlantısı" sub="Hub adresi ve panel kullanıcısı. Sistemler Beszel’de bu kullanıcıya atanmış olmalı.">
            {conn && (
              <div className="flex flex-col gap-3">
                <Field label="Hub adresi"><input type="url" value={conn.url} onChange={(e) => setConn({ ...conn, url: e.target.value })} placeholder="http://localhost:8090" className="mono" /></Field>
                <Field label="E-posta"><input type="email" value={conn.email} onChange={(e) => setConn({ ...conn, email: e.target.value })} /></Field>
                <Field label="Parola" hint="kayıtlıysa maskeli görünür; değiştirmek için yenisini yazın"><input type="password" value={conn.password} onChange={(e) => setConn({ ...conn, password: e.target.value })} /></Field>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <Button onClick={() => void runTest()} disabled={testing}>{testing ? "Deneniyor…" : "Bağlantıyı dene"}</Button>
                  <Button variant="primary" disabled={JSON.stringify(conn) === connSaved || busy} onClick={() => void saveConn()}>Kaydet</Button>
                </div>
                {test && (
                  <div className="rounded-lg px-3 py-2 text-[12.5px]" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-line)" }}>
                    <StatusDot ok={test.ok} label={test.ok ? `Giriş başarılı, ${test.systems?.length ?? 0} sistem görülüyor` : `Başarısız: ${test.error ?? "bilinmeyen hata"}`} />
                    {test.ok && test.systems && test.systems.length > 0 && <div className="mt-1.5 pl-4" style={{ color: "var(--admin-muted)" }}>{test.systems.join(", ")}</div>}
                  </div>
                )}
              </div>
            )}
          </Card>
          <Card title="Eşikler" sub="Disk doluluk uyarısı ve Beszel yoklama aralığı">
            {thr && (
              <div className="flex flex-col gap-3">
                <Field label="Disk uyarı eşiği (%)" hint="50–100; üstüne çıkan sunucu kiosk’ta uyarır"><input type="number" min={50} max={100} value={thr.diskWarnPct} onChange={(e) => setThr({ ...thr, diskWarnPct: Number(e.target.value) })} /></Field>
                <Field label="Yoklama aralığı (sn)" hint="en az 5"><input type="number" min={5} value={thr.pollSec} onChange={(e) => setThr({ ...thr, pollSec: Number(e.target.value) })} /></Field>
                <div className="flex justify-end"><Button variant="primary" disabled={JSON.stringify(thr) === thrSaved || busy} onClick={() => void saveThr()}>Kaydet</Button></div>
              </div>
            )}
          </Card>
        </div>
      </div>
      {toast}
    </>
  );
}
