"use client";

import { useCallback, useState } from "react";
import { Panel, SaveBar, Segmented, Skeleton, api, loadSettings, saveSettings, usePoll, useToast } from "@/components/admin/ui";

interface Cfg { theme: "dark" | "light"; lockMin: number; waitMin: number; recents: [string, string] }
interface Screen { id: string; title: string; enabled: boolean }

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="a-row">
      <div className="a-row-text">
        <div className="a-row-title">{title}</div>
        <div className="a-row-desc">{desc}</div>
      </div>
      <div className="a-row-control">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const load = useCallback(
    () =>
      loadSettings().then((s) => ({
        theme: s["theme.default"] === "light" ? "light" : "dark",
        lockMin: Math.round(Number(s["lock.timeoutMs"] ?? 7_200_000) / 60_000),
        waitMin: Math.round(Number(s["claude.waitNoticeMs"] ?? 180_000) / 60_000),
        recents: [
          (s["rail.defaultRecents"] as string[])?.[0] ?? "claude",
          (s["rail.defaultRecents"] as string[])?.[1] ?? "shortcuts",
        ] as [string, string],
      })) as Promise<Cfg>,
    []
  );
  const loadScreens = useCallback(() => api<{ screens: Screen[] }>("/api/admin/screens").then((r) => r.screens.filter((x) => x.enabled && x.id !== "overview")), []);
  const { data, loading, refresh } = usePoll(load);
  const screens = usePoll(loadScreens);
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
        "theme.default": draft.theme,
        "lock.timeoutMs": draft.lockMin * 60_000,
        "claude.waitNoticeMs": draft.waitMin * 60_000,
        "rail.defaultRecents": draft.recents,
      });
      setDraft(null);
      refresh();
      toast.ok("Ayarlar kaydedildi");
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
          <h1 className="a-title">Ayarlar</h1>
          <p className="a-sub">Kiosk’un davranışı. Kilit PIN’i ve yönetici parolası Güvenlik sayfasındadır.</p>
        </div>
      </header>

      {loading || !cfg ? (
        <Panel><div className="flex flex-col gap-3"><Skeleton /><Skeleton /><Skeleton /></div></Panel>
      ) : (
        <div className="flex flex-col gap-4">
          <Panel title="Görünüm" flush>
            <div className="a-rows">
              <Row title="Varsayılan tema" desc="Kiosk’ta elle seçilen tema o cihazda kalır; bu yalnızca ilk açılışı belirler.">
                <Segmented value={cfg.theme} onChange={(theme) => set({ theme })} options={[{ value: "dark", label: "Koyu" }, { value: "light", label: "Açık" }]} />
              </Row>
              <Row title="Rail’in başlangıç yuvaları" desc="Kiosk ilk açıldığında sağ rail’de duran iki ekran. Sonrasında en son kullanılanlar buraya geçer.">
                {[0, 1].map((i) => (
                  <select
                    key={i}
                    aria-label={`${i + 1}. yuva`}
                    value={cfg.recents[i]}
                    onChange={(e) => {
                      const recents: [string, string] = [...cfg.recents] as [string, string];
                      recents[i] = e.target.value;
                      set({ recents });
                    }}
                    style={{ width: 160 }}
                  >
                    {(screens.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                ))}
              </Row>
            </div>
          </Panel>

          <Panel title="Süreler" flush>
            <div className="a-rows">
              <Row title="Otomatik kilit" desc="Bu kadar süre hiç dokunulmazsa kiosk kilitlenir ve PIN ister.">
                <input type="number" min={1} value={cfg.lockMin} onChange={(e) => set({ lockMin: Number(e.target.value) })} style={{ width: 90 }} aria-label="Kilit süresi, dakika" />
                <span className="a-muted">dakika</span>
              </Row>
              <Row title="Claude bekleme uyarısı" desc="Bir Claude Code oturumu bu kadar süredir sizden yanıt bekliyorsa dikkat bildirimi düşer.">
                <input type="number" min={1} value={cfg.waitMin} onChange={(e) => set({ waitMin: Number(e.target.value) })} style={{ width: 90 }} aria-label="Bekleme eşiği, dakika" />
                <span className="a-muted">dakika</span>
              </Row>
            </div>
          </Panel>
        </div>
      )}

      <SaveBar dirty={dirty} busy={busy} onSave={() => void save()} onReset={() => setDraft(null)} />
    </>
  );
}
