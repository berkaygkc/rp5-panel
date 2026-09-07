"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader, ReorderButtons, SaveBar, Toggle, api, move, useToast } from "@/components/admin/ui";

interface Screen { id: string; title: string; tint: string; order: number; enabled: boolean }

const TINTS: Array<{ value: string; label: string }> = [
  { value: "var(--color-blue)", label: "Mavi" },
  { value: "var(--color-orange)", label: "Turuncu" },
  { value: "var(--color-terracotta)", label: "Kiremit" },
  { value: "var(--color-indigo)", label: "İndigo" },
  { value: "var(--color-teal)", label: "Deniz" },
  { value: "var(--color-green)", label: "Yeşil" },
  { value: "var(--color-mint)", label: "Nane" },
  { value: "var(--color-purple)", label: "Mor" },
  { value: "var(--color-pink)", label: "Pembe" },
  { value: "var(--color-red)", label: "Kırmızı" },
  { value: "var(--color-yellow)", label: "Sarı" },
];

export default function ScreensPage() {
  const [rows, setRows] = useState<Screen[] | null>(null);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  useEffect(() => {
    void api<{ screens: Screen[] }>("/api/admin/screens")
      .then((r) => { setRows(r.screens); setSaved(JSON.stringify(r.screens)); })
      .catch((e: Error) => show(e.message, "danger"));
  }, [show]);

  const dirty = rows !== null && JSON.stringify(rows) !== saved;
  const patch = (i: number, p: Partial<Screen>) => setRows((r) => r && r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const save = async () => {
    if (!rows) return;
    setBusy(true);
    try {
      await api("/api/admin/screens", { method: "PUT", json: { screens: rows } });
      setSaved(JSON.stringify(rows));
      show("Ekranlar kaydedildi");
    } catch (e) {
      show((e as Error).message, "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Ekranlar" sub="Menü, rail ve kaydırma sırası buradaki sırayı izler. Genel Bakış her zaman ilk ve açık kalır." right={<SaveBar dirty={dirty} busy={busy} onSave={save} />} />
      <Card>
        {!rows ? null : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                <th style={{ width: 70 }}>Açık</th>
                <th>Başlık</th>
                <th style={{ width: 200 }}>Renk</th>
                <th style={{ width: 140 }}>Kimlik</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => {
                const locked = s.id === "overview";
                const known = TINTS.some((t) => t.value === s.tint);
                return (
                  <tr key={s.id}>
                    <td className="text-[12.5px]" style={{ color: "var(--admin-faint)" }}>{i + 1}</td>
                    <td><Toggle checked={locked || s.enabled} onChange={(v) => !locked && patch(i, { enabled: v })} /></td>
                    <td><input value={s.title} onChange={(e) => patch(i, { title: e.target.value })} style={{ width: 280 }} aria-label="Ekran başlığı" /></td>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: s.tint }} />
                        <select value={s.tint} onChange={(e) => patch(i, { tint: e.target.value })} style={{ width: 140 }}>
                          {!known && <option value={s.tint}>{s.tint}</option>}
                          {TINTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </span>
                    </td>
                    <td><code className="mono" style={{ color: "var(--admin-muted)" }}>{s.id}</code></td>
                    <td>
                      <div className="flex justify-end">
                        <ReorderButtons
                          canUp={i > 1}
                          canDown={i > 0 && i < rows.length - 1}
                          onUp={() => setRows((r) => r && move(r, i, i - 1))}
                          onDown={() => setRows((r) => r && move(r, i, i + 1))}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      {toast}
    </>
  );
}
