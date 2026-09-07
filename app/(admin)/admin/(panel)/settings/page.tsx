"use client";

import { useEffect, useState } from "react";
import { Card, Field, PageHeader, SaveBar, Segmented, api, loadSettings, saveSettings, useToast } from "@/components/admin/ui";

interface Cfg { theme: "dark" | "light"; lockMin: number; waitMin: number; recents: [string, string] }
interface Screen { id: string; title: string; enabled: boolean }

export default function SettingsPage() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [saved, setSaved] = useState("");
  const [screens, setScreens] = useState<Screen[]>([]);
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  useEffect(() => {
    void loadSettings().then((s) => {
      const r = Array.isArray(s["rail.defaultRecents"]) ? (s["rail.defaultRecents"] as string[]) : [];
      const c: Cfg = {
        theme: s["theme.default"] === "light" ? "light" : "dark",
        lockMin: Math.round(Number(s["lock.timeoutMs"] ?? 7_200_000) / 60_000),
        waitMin: Math.round(Number(s["claude.waitNoticeMs"] ?? 180_000) / 60_000),
        recents: [r[0] ?? "claude", r[1] ?? "shortcuts"],
      };
      setCfg(c); setSaved(JSON.stringify(c));
    }).catch((e: Error) => show(e.message, "danger"));
    void api<{ screens: Screen[] }>("/api/admin/screens").then((r) => setScreens(r.screens.filter((x) => x.enabled && x.id !== "overview"))).catch(() => null);
  }, [show]);

  const save = async () => {
    if (!cfg) return;
    setBusy(true);
    try {
      await saveSettings({ "theme.default": cfg.theme, "lock.timeoutMs": cfg.lockMin * 60_000, "claude.waitNoticeMs": cfg.waitMin * 60_000, "rail.defaultRecents": cfg.recents });
      setSaved(JSON.stringify(cfg));
      show("Ayarlar kaydedildi");
    } catch (e) { show((e as Error).message, "danger"); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Ayarlar" sub="Kiosk davranışı. PIN ve yönetici parolası Güvenlik sayfasındadır." right={<SaveBar dirty={cfg !== null && JSON.stringify(cfg) !== saved} busy={busy} onSave={() => void save()} />} />
      {cfg && (
        <div className="grid grid-cols-2 gap-5">
          <Card title="Görünüm">
            <div className="flex flex-col gap-4">
              <div>
                <div className="mb-1 text-[12.5px] font-medium" style={{ color: "var(--admin-muted)" }}>Varsayılan tema</div>
                <Segmented value={cfg.theme} onChange={(theme) => setCfg({ ...cfg, theme })} options={[{ value: "dark", label: "Koyu" }, { value: "light", label: "Açık" }]} />
                <p className="mt-1 text-[12px]" style={{ color: "var(--admin-faint)" }}>Kiosk’ta elle seçilen tema cihazda kalır; bu yalnızca ilk açılışı belirler.</p>
              </div>
              <div>
                <div className="mb-1 text-[12.5px] font-medium" style={{ color: "var(--admin-muted)" }}>Rail’deki başlangıç yuvaları</div>
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1].map((i) => (
                    <select key={i} value={cfg.recents[i]} onChange={(e) => { const recents: [string, string] = [...cfg.recents] as [string, string]; recents[i] = e.target.value; setCfg({ ...cfg, recents }); }}>
                      {screens.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  ))}
                </div>
                <p className="mt-1 text-[12px]" style={{ color: "var(--admin-faint)" }}>Kiosk ilk açıldığında sağ raildeki iki yuva; sonra en son kullanılan ekranlar geçer.</p>
              </div>
            </div>
          </Card>
          <Card title="Süreler">
            <div className="flex flex-col gap-3">
              <Field label="Kilit süresi (dk)" hint="bu kadar dokunulmazsa kiosk kilitlenir; en az 1"><input type="number" min={1} value={cfg.lockMin} onChange={(e) => setCfg({ ...cfg, lockMin: Number(e.target.value) })} /></Field>
              <Field label="Claude bekleme uyarısı (dk)" hint="bir oturum bu kadar süredir sizi bekliyorsa bildirim düşer; en az 1"><input type="number" min={1} value={cfg.waitMin} onChange={(e) => setCfg({ ...cfg, waitMin: Number(e.target.value) })} /></Field>
            </div>
          </Card>
        </div>
      )}
      {toast}
    </>
  );
}
