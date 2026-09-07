"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Button, Card, ConfirmButton, Empty, Field, PageHeader, ReorderButtons, Toggle, api, move, useToast } from "@/components/admin/ui";

interface Item {
  id: string; groupId: string; label: string; sublabel: string | null; feedback: string;
  kind: "project" | "ssh"; path: string | null; host: string | null; port: number | null; user: string | null; via: string | null;
  order: number; enabled: boolean;
}
interface Group { id: string; title: string; order: number; items: Item[] }
type Draft = Omit<Item, "id" | "order" | "groupId"> & { id?: string };

const EMPTY: Draft = { label: "", sublabel: null, feedback: "", kind: "project", path: "", host: null, port: 22, user: null, via: null, enabled: true };

function target(i: Item) {
  if (i.kind === "project") return i.path ?? "";
  return `${i.user ? `${i.user}@` : ""}${i.host ?? ""}${i.port && i.port !== 22 ? `:${i.port}` : ""}`;
}

export default function ShortcutsPage() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [editing, setEditing] = useState<{ groupId: string; draft: Draft } | null>(null);
  const [newGroup, setNewGroup] = useState("");
  const { toast, show } = useToast();

  const reload = useCallback(
    () => api<{ groups: Group[] }>("/api/admin/shortcuts/groups").then((r) => setGroups(r.groups)),
    []
  );
  useEffect(() => { void reload().catch((e: Error) => show(e.message, "danger")); }, [reload, show]);

  /** Mutasyon + yeniden yükleme + bildirim; başarı durumunu döndürür */
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      await reload();
      show(ok);
      return true;
    } catch (e) {
      show((e as Error).message, "danger");
      return false;
    }
  };

  const addGroup = async () => {
    if (await run(() => api("/api/admin/shortcuts/groups", { method: "POST", json: { title: newGroup } }), "Grup eklendi")) setNewGroup("");
  };
  const renameGroup = (g: Group, title: string) => {
    if (!groups || !title.trim() || title.trim() === g.title) return;
    void run(() => api("/api/admin/shortcuts/groups", { method: "PUT", json: { groups: groups.map((x) => ({ id: x.id, title: x.id === g.id ? title.trim() : x.title })) } }), "Grup adı güncellendi");
  };
  const moveGroup = (i: number, dir: -1 | 1) => {
    if (!groups) return;
    const next = move(groups, i, i + dir);
    if (next === groups) return;
    setGroups(next);
    void run(() => api("/api/admin/shortcuts/groups", { method: "PUT", json: { groups: next.map((x) => ({ id: x.id })) } }), "Grup sırası güncellendi");
  };
  const deleteGroup = (id: string) => run(() => api("/api/admin/shortcuts/groups", { method: "DELETE", json: { id } }), "Grup silindi");
  const moveItem = (g: Group, i: number, dir: -1 | 1) => {
    const items = move(g.items, i, i + dir);
    if (items === g.items) return;
    setGroups((gs) => gs && gs.map((x) => (x.id === g.id ? { ...x, items } : x)));
    void run(() => api("/api/admin/shortcuts/items", { method: "PUT", json: { reorder: items.map((it) => ({ id: it.id, groupId: g.id })) } }), "Sıra güncellendi");
  };
  const toggleItem = (it: Item, enabled: boolean) => run(() => api("/api/admin/shortcuts/items", { method: "PUT", json: { ...it, enabled } }), enabled ? "Kısayol kiosk'ta gösteriliyor" : "Kısayol kiosk'tan gizlendi");
  const deleteItem = (id: string) => run(() => api("/api/admin/shortcuts/items", { method: "DELETE", json: { id } }), "Kısayol silindi");
  const saveDraft = async (groupId: string, d: Draft) => {
    if (await run(() => api("/api/admin/shortcuts/items", { method: d.id ? "PUT" : "POST", json: { ...d, groupId } }), d.id ? "Kısayol güncellendi" : "Kısayol eklendi")) setEditing(null);
  };

  return (
    <>
      <PageHeader title="Kısayollar" sub="Kiosk'un Kısayollar ekranındaki gruplar ve düğmeler. Projeler VS Code'da, sunucular Termius ya da Terminal'de açılır." />
      <div className="flex flex-col gap-5">
        {groups?.map((g, gi) => (
          <Card key={g.id}>
            <div className="mb-3 flex items-center gap-3">
              <input key={g.title} defaultValue={g.title} onBlur={(e) => renameGroup(g, e.target.value)} style={{ width: 260, fontWeight: 600 }} aria-label="Grup adı" />
              <span className="text-[12.5px]" style={{ color: "var(--admin-faint)" }}>{g.items.length} kısayol</span>
              <div className="ml-auto flex items-center gap-2">
                <ReorderButtons canUp={gi > 0} canDown={gi < groups.length - 1} onUp={() => moveGroup(gi, -1)} onDown={() => moveGroup(gi, 1)} />
                <Button size="sm" onClick={() => setEditing({ groupId: g.id, draft: EMPTY })}><Plus size={14} /> Kısayol ekle</Button>
                <ConfirmButton label="Grubu sil" confirmLabel={`${g.items.length} kısayolla birlikte sil`} onConfirm={() => void deleteGroup(g.id)} />
              </div>
            </div>
            {g.items.length === 0 ? (
              editing?.groupId !== g.id && <Empty>Bu grupta kısayol yok. “Kısayol ekle” ile başlayın.</Empty>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>Açık</th>
                    <th>Etiket</th>
                    <th style={{ width: 90 }}>Tür</th>
                    <th>Hedef</th>
                    <th style={{ width: 100 }}>Açılış</th>
                    <th style={{ width: 230 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((it, ii) => (
                    <Fragment key={it.id}>
                      <tr style={{ opacity: it.enabled ? 1 : 0.55 }}>
                        <td><Toggle checked={it.enabled} onChange={(v) => void toggleItem(it, v)} /></td>
                        <td>
                          <div className="font-medium">{it.label}</div>
                          {it.sublabel && <div className="text-[12px]" style={{ color: "var(--admin-muted)" }}>{it.sublabel}</div>}
                        </td>
                        <td><Badge tone={it.kind === "ssh" ? "accent" : "neutral"}>{it.kind === "ssh" ? "SSH" : "Proje"}</Badge></td>
                        <td><code className="mono">{target(it)}</code></td>
                        <td className="text-[12.5px]" style={{ color: "var(--admin-muted)" }}>{it.kind === "ssh" ? (it.via === "terminal" ? "Terminal" : "Termius") : "VS Code"}</td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <ReorderButtons canUp={ii > 0} canDown={ii < g.items.length - 1} onUp={() => moveItem(g, ii, -1)} onDown={() => moveItem(g, ii, 1)} />
                            <Button size="sm" variant="ghost" onClick={() => setEditing({ groupId: g.id, draft: { ...it } })}>Düzenle</Button>
                            <ConfirmButton onConfirm={() => void deleteItem(it.id)} />
                          </div>
                        </td>
                      </tr>
                      {editing?.groupId === g.id && editing.draft.id === it.id && (
                        <tr><td colSpan={6} style={{ padding: "4px 0 12px" }}><ItemEditor draft={editing.draft} onSave={(d) => void saveDraft(g.id, d)} onCancel={() => setEditing(null)} /></td></tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
            {editing?.groupId === g.id && !editing.draft.id && (
              <div className="mt-3"><ItemEditor draft={editing.draft} onSave={(d) => void saveDraft(g.id, d)} onCancel={() => setEditing(null)} /></div>
            )}
          </Card>
        ))}
        {groups && groups.length === 0 && <Card><Empty>Henüz grup yok. Aşağıdan ilk grubu ekleyin.</Empty></Card>}
        <Card title="Yeni grup" sub="Örneğin Projeler, Sunucular, Araçlar">
          <div className="flex gap-2">
            <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newGroup.trim()) void addGroup(); }} placeholder="Grup adı" style={{ width: 320 }} />
            <Button variant="primary" disabled={!newGroup.trim()} onClick={() => void addGroup()}>Grup ekle</Button>
          </div>
        </Card>
      </div>
      {toast}
    </>
  );
}

function ItemEditor({ draft, onSave, onCancel }: { draft: Draft; onSave: (d: Draft) => void; onCancel: () => void }) {
  const [d, setD] = useState<Draft>(draft);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const valid = d.label.trim() !== "" && (d.kind === "project" ? (d.path ?? "").trim() !== "" : (d.host ?? "").trim() !== "");
  return (
    <div className="rounded-lg p-4" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-line)" }}>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Etiket"><input value={d.label} onChange={(e) => set({ label: e.target.value })} autoFocus /></Field>
        <Field label="Alt yazı" hint="düğmede küçük satır"><input value={d.sublabel ?? ""} onChange={(e) => set({ sublabel: e.target.value || null })} /></Field>
        <Field label="Geri bildirim" hint="dokununca kiosk'ta gösterilen mesaj"><input value={d.feedback} onChange={(e) => set({ feedback: e.target.value })} placeholder={`${d.label || "…"} açıldı`} /></Field>
        <Field label="Tür">
          <select value={d.kind} onChange={(e) => set({ kind: e.target.value === "ssh" ? "ssh" : "project" })}>
            <option value="project">Proje (VS Code)</option>
            <option value="ssh">Sunucu (SSH)</option>
          </select>
        </Field>
        {d.kind === "project" ? (
          <Field label="Proje yolu" className="col-span-2" hint="Mac'teki mutlak klasör yolu"><input value={d.path ?? ""} onChange={(e) => set({ path: e.target.value })} placeholder="/Users/…/proje" className="mono" /></Field>
        ) : (
          <>
            <Field label="Sunucu"><input value={d.host ?? ""} onChange={(e) => set({ host: e.target.value })} placeholder="ör. 10.0.0.5 ya da sunucu.alan" className="mono" /></Field>
            <Field label="Kullanıcı"><input value={d.user ?? ""} onChange={(e) => set({ user: e.target.value || null })} placeholder="root" /></Field>
            <Field label="Port"><input type="number" value={d.port ?? 22} onChange={(e) => set({ port: Number(e.target.value) || 22 })} /></Field>
            <Field label="Açılış">
              <select value={d.via === "terminal" ? "terminal" : "termius"} onChange={(e) => set({ via: e.target.value === "terminal" ? "terminal" : null })}>
                <option value="termius">Termius</option>
                <option value="terminal">Terminal</option>
              </select>
            </Field>
          </>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <Toggle checked={d.enabled} onChange={(v) => set({ enabled: v })} label="Kiosk'ta göster" />
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>Vazgeç</Button>
          <Button variant="primary" disabled={!valid} onClick={() => onSave(d)}>{d.id ? "Değişiklikleri kaydet" : "Kısayol ekle"}</Button>
        </div>
      </div>
    </div>
  );
}
