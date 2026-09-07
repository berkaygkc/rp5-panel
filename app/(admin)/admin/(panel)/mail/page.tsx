"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button, Card, Field, PageHeader, SaveBar, loadSettings, saveSettings, useToast } from "@/components/admin/ui";

interface MailCfg { excluded: string[]; maxNotices: number; messageLimit: number }

export default function MailPage() {
  const [cfg, setCfg] = useState<MailCfg | null>(null);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  useEffect(() => {
    void loadSettings().then((s) => {
      const c = {
        excluded: Array.isArray(s["mail.excludedAddresses"]) ? (s["mail.excludedAddresses"] as string[]) : [],
        maxNotices: Number(s["mail.maxNoticesPerRefresh"] ?? 5),
        messageLimit: Number(s["mail.messageLimit"] ?? 80),
      };
      setCfg(c); setSaved(JSON.stringify(c));
    }).catch((e: Error) => show(e.message, "danger"));
  }, [show]);

  const save = async () => {
    if (!cfg) return;
    setBusy(true);
    try {
      await saveSettings({ "mail.excludedAddresses": cfg.excluded.map((x) => x.trim()).filter(Boolean), "mail.maxNoticesPerRefresh": cfg.maxNotices, "mail.messageLimit": cfg.messageLimit });
      setSaved(JSON.stringify(cfg));
      show("Posta ayarları kaydedildi");
    } catch (e) { show((e as Error).message, "danger"); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Posta" sub="Mac ajanı Spark'ın yerel veritabanını okur; buradaki ayarları bir sonraki yoklamada alır." right={<SaveBar dirty={cfg !== null && JSON.stringify(cfg) !== saved} busy={busy} onSave={() => void save()} />} />
      {cfg && (
        <div className="grid grid-cols-[1fr_360px] gap-5">
          <Card title="Hariç tutulan hesaplar" sub="Adresi bu düzenli ifadelerden biriyle eşleşen hesaplar kiosk'ta ve bildirimlerde görünmez.">
            <div className="flex flex-col gap-2">
              {cfg.excluded.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={p} onChange={(e) => setCfg({ ...cfg, excluded: cfg.excluded.map((x, j) => (j === i ? e.target.value : x)) })} className="mono" placeholder="@gmail\.com$" />
                  <Button size="sm" variant="ghost" onClick={() => setCfg({ ...cfg, excluded: cfg.excluded.filter((_, j) => j !== i) })} aria-label="Kaldır"><X size={14} /></Button>
                </div>
              ))}
              {cfg.excluded.length === 0 && <p className="text-[13px]" style={{ color: "var(--admin-faint)" }}>Hariç tutulan hesap yok; tüm hesaplar gösterilir.</p>}
              <div><Button size="sm" onClick={() => setCfg({ ...cfg, excluded: [...cfg.excluded, ""] })}><Plus size={14} /> Desen ekle</Button></div>
            </div>
          </Card>
          <Card title="Sınırlar">
            <div className="flex flex-col gap-3">
              <Field label="Yoklama başına en çok bildirim" hint="yeni gelen postaların kaçı Dynamic Island'a düşer; 0 kapatır"><input type="number" min={0} value={cfg.maxNotices} onChange={(e) => setCfg({ ...cfg, maxNotices: Number(e.target.value) })} /></Field>
              <Field label="Kiosk'ta listelenen posta sayısı" hint="10–500"><input type="number" min={10} max={500} value={cfg.messageLimit} onChange={(e) => setCfg({ ...cfg, messageLimit: Number(e.target.value) })} /></Field>
            </div>
          </Card>
        </div>
      )}
      {toast}
    </>
  );
}
