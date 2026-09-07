"use client";

import { useCallback, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button, Field, Panel, SaveBar, Skeleton, loadSettings, saveSettings, usePoll, useToast } from "@/components/admin/ui";

interface Cfg { excluded: string[]; maxNotices: number; messageLimit: number }

export default function MailPage() {
  const load = useCallback(
    () =>
      loadSettings().then((s) => ({
        excluded: Array.isArray(s["mail.excludedAddresses"]) ? (s["mail.excludedAddresses"] as string[]) : [],
        maxNotices: Number(s["mail.maxNoticesPerRefresh"] ?? 5),
        messageLimit: Number(s["mail.messageLimit"] ?? 80),
      })) as Promise<Cfg>,
    []
  );
  const { data, loading, refresh } = usePoll(load);
  const [draft, setDraft] = useState<Cfg | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const cfg = draft ?? data;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(data);
  const set = (p: Partial<Cfg>) => cfg && setDraft({ ...cfg, ...p });

  const save = useCallback(async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await saveSettings({
        "mail.excludedAddresses": draft.excluded.map((x) => x.trim()).filter(Boolean),
        "mail.maxNoticesPerRefresh": draft.maxNotices,
        "mail.messageLimit": draft.messageLimit,
      });
      setDraft(null);
      refresh();
      toast.ok("Posta ayarları kaydedildi");
    } catch (e) {
      toast.fail((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [draft, refresh, toast]);

  return (
    <>
      <header className="a-head">
        <div>
          <h1 className="a-title">Posta</h1>
          <p className="a-sub">
            Mac ajanı Spark Desktop’ın yerel veritabanını salt okunur açar. Buradaki ayarları bir sonraki yoklamada alır.
          </p>
        </div>
      </header>

      {loading || !cfg ? (
        <Panel><div className="flex flex-col gap-3"><Skeleton /><Skeleton /></div></Panel>
      ) : (
        <div className="grid grid-cols-[1fr_360px] gap-4">
          <Panel
            title="Hariç tutulan hesaplar"
            desc="Adresi bu düzenli ifadelerden biriyle eşleşen hesaplar kiosk’ta ve bildirimlerde hiç görünmez."
            footer={<Button size="sm" onClick={() => set({ excluded: [...cfg.excluded, ""] })}><Plus size={14} /> Desen ekle</Button>}
          >
            {cfg.excluded.length === 0 ? (
              <p className="a-faint">Hariç tutulan hesap yok; Spark’taki tüm hesaplar gösterilir.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {cfg.excluded.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input className="a-mono" value={p} onChange={(e) => set({ excluded: cfg.excluded.map((x, j) => (j === i ? e.target.value : x)) })} placeholder="@gmail\.com$" aria-label={`${i + 1}. desen`} />
                    <Button size="icon" variant="ghost" title="Deseni kaldır" onClick={() => set({ excluded: cfg.excluded.filter((_, j) => j !== i) })}><X size={15} /></Button>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Sınırlar">
            <div className="flex flex-col gap-4">
              <Field label="Yoklama başına en çok bildirim" hint="Yeni gelen postalardan kaçı Dynamic Island’a düşsün. 0 yazarsanız posta bildirimi kapanır.">
                <input type="number" min={0} value={cfg.maxNotices} onChange={(e) => set({ maxNotices: Number(e.target.value) })} />
              </Field>
              <Field label="Kiosk’ta listelenen posta sayısı" hint="10 ile 500 arası">
                <input type="number" min={10} max={500} value={cfg.messageLimit} onChange={(e) => set({ messageLimit: Number(e.target.value) })} />
              </Field>
            </div>
          </Panel>
        </div>
      )}

      <SaveBar dirty={dirty} busy={busy} onSave={() => void save()} onReset={() => setDraft(null)} />
    </>
  );
}
