"use client";

import { useCallback, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  Button, ConfirmButton, Drawer, Empty, Field, Panel, Reorder, Skeleton, Switch, Tag,
  api, move, usePoll, useToast,
} from "@/components/admin/ui";

interface Item {
  id: string; groupId: string; label: string; sublabel: string | null; feedback: string;
  kind: "project" | "ssh"; path: string | null; host: string | null; port: number | null; user: string | null; via: string | null;
  order: number; enabled: boolean;
}
interface Group { id: string; title: string; order: number; items: Item[] }
type Draft = Omit<Item, "order" | "groupId" | "id"> & { id?: string };

const EMPTY: Draft = { label: "", sublabel: null, feedback: "", kind: "project", path: "", host: null, port: 22, user: null, via: null, enabled: true };
const target = (i: Item) => (i.kind === "project" ? (i.path ?? "") : `${i.user ? `${i.user}@` : ""}${i.host ?? ""}${i.port && i.port !== 22 ? `:${i.port}` : ""}`);
const opensWith = (i: Item) => (i.kind === "ssh" ? (i.via === "terminal" ? "Terminal" : "Termius") : "VS Code");

export default function ShortcutsPage() {
  const load = useCallback(() => api<{ groups: Group[] }>("/api/admin/shortcuts/groups").then((r) => r.groups), []);
  const { data, loading, refresh } = usePoll(load);
  const [editor, setEditor] = useState<{ key: string; groupId: string; groupTitle: string; draft: Draft } | null>(null);
  const [open, setOpen] = useState(false);
  const [newGroup, setNewGroup] = useState("");
  const [local, setLocal] = useState<Group[] | null>(null);
  const seq = useRef(0);
  const toast = useToast();

  const groups = local ?? data ?? [];

  const run = useCallback(
    async (fn: () => Promise<unknown>, ok: string) => {
      try {
        await fn();
        setLocal(null);
        refresh();
        toast.ok(ok);
        return true;
      } catch (e) {
        setLocal(null);
        refresh();
        toast.fail((e as Error).message);
        return false;
      }
    },
    [refresh, toast]
  );

  const addGroup = async () => {
    if (await run(() => api("/api/admin/shortcuts/groups", { method: "POST", json: { title: newGroup } }), "Grup eklendi")) setNewGroup("");
  };
  const renameGroup = (g: Group, title: string) => {
    if (!title.trim() || title.trim() === g.title) return;
    void run(() => api("/api/admin/shortcuts/groups", { method: "PUT", json: { groups: groups.map((x) => ({ id: x.id, title: x.id === g.id ? title.trim() : x.title })) } }), "Grup adı güncellendi");
  };
  const moveGroup = (i: number, dir: -1 | 1) => {
    const next = move(groups, i, i + dir);
    if (next === groups) return;
    setLocal(next);
    void run(() => api("/api/admin/shortcuts/groups", { method: "PUT", json: { groups: next.map((x) => ({ id: x.id })) } }), "Grup sırası güncellendi");
  };
  const moveItem = (g: Group, i: number, dir: -1 | 1) => {
    const items = move(g.items, i, i + dir);
    if (items === g.items) return;
    setLocal(groups.map((x) => (x.id === g.id ? { ...x, items } : x)));
    void run(() => api("/api/admin/shortcuts/items", { method: "PUT", json: { reorder: items.map((it) => ({ id: it.id, groupId: g.id })) } }), "Sıra güncellendi");
  };
  const toggleItem = (it: Item, enabled: boolean) => {
    setLocal(groups.map((g) => ({ ...g, items: g.items.map((x) => (x.id === it.id ? { ...x, enabled } : x)) })));
    void run(() => api("/api/admin/shortcuts/items", { method: "PUT", json: { ...it, enabled } }), enabled ? "Kısayol kiosk'ta görünüyor" : "Kısayol kiosk'tan gizlendi");
  };
  const saveDraft = async (d: Draft, groupId: string) => {
    if (await run(() => api("/api/admin/shortcuts/items", { method: d.id ? "PUT" : "POST", json: { ...d, groupId } }), d.id ? "Kısayol güncellendi" : "Kısayol eklendi")) setOpen(false);
  };
  const edit = (g: Group, item?: Item) => {
    seq.current += 1;
    setEditor({ key: `${g.id}:${item?.id ?? "yeni"}:${seq.current}`, groupId: g.id, groupTitle: g.title, draft: item ? { ...item } : EMPTY });
    setOpen(true);
  };

  return (
    <>
      <header className="a-head">
        <div>
          <h1 className="a-title">Kısayollar</h1>
          <p className="a-sub">
            Kiosk’un Kısayollar ekranındaki gruplar ve düğmeler. Bir düğmeye dokunmak Mac’te projeyi VS Code’da, sunucuyu Termius ya da Terminal’de açar.
          </p>
        </div>
      </header>

      {loading && <Panel><div className="flex flex-col gap-3"><Skeleton /><Skeleton /><Skeleton /></div></Panel>}

      <div className="flex flex-col gap-4">
        {groups.map((g, gi) => (
          <Panel
            key={g.id}
            flush
            actions={
              <>
                <Reorder canUp={gi > 0} canDown={gi < groups.length - 1} onUp={() => moveGroup(gi, -1)} onDown={() => moveGroup(gi, 1)} />
                <Button size="sm" onClick={() => edit(g)}><Plus size={14} /> Kısayol ekle</Button>
                <ConfirmButton label="Grubu sil" confirm={`${g.items.length} kısayolla birlikte sil`} onConfirm={() => void run(() => api("/api/admin/shortcuts/groups", { method: "DELETE", json: { id: g.id } }), "Grup silindi")} />
              </>
            }
            titleNode={
              <input
                key={g.title}
                className="a-inline-input"
                defaultValue={g.title}
                onBlur={(e) => renameGroup(g, e.target.value)}
                aria-label="Grup adı"
              />
            }
          >
            {g.items.length === 0 ? (
              <Empty>Bu grupta kısayol yok.</Empty>
            ) : (
              <table className="a-tbl">
                <thead>
                  <tr>
                    <th style={{ width: 66 }}>Açık</th>
                    <th>Etiket</th>
                    <th style={{ width: 92 }}>Tür</th>
                    <th>Hedef</th>
                    <th style={{ width: 104 }}>Açılış</th>
                    <th style={{ width: 210 }} />
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((it, ii) => (
                    <tr key={it.id} data-off={!it.enabled}>
                      <td><Switch checked={it.enabled} onChange={(v) => toggleItem(it, v)} label={undefined} /></td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{it.label}</div>
                        {it.sublabel && <div className="a-muted text-[12px]">{it.sublabel}</div>}
                      </td>
                      <td><Tag tone={it.kind === "ssh" ? "solid" : undefined}>{it.kind === "ssh" ? "SSH" : "Proje"}</Tag></td>
                      <td><code className="a-muted">{target(it)}</code></td>
                      <td className="a-muted">{opensWith(it)}</td>
                      <td>
                        <div className="a-tbl-actions">
                          <Reorder canUp={ii > 0} canDown={ii < g.items.length - 1} onUp={() => moveItem(g, ii, -1)} onDown={() => moveItem(g, ii, 1)} />
                          <Button size="sm" variant="ghost" onClick={() => edit(g, it)}>Düzenle</Button>
                          <ConfirmButton onConfirm={() => void run(() => api("/api/admin/shortcuts/items", { method: "DELETE", json: { id: it.id } }), "Kısayol silindi")} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        ))}

        <Panel title="Yeni grup" desc="Kısayollar ekranında ayrı bir başlık olarak görünür. Örneğin Projeler, Sunucular, Araçlar.">
          <div className="flex gap-2">
            <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newGroup.trim()) void addGroup(); }} placeholder="Grup adı" style={{ width: 320 }} aria-label="Yeni grup adı" />
            <Button variant="primary" disabled={!newGroup.trim()} onClick={() => void addGroup()}>Grup ekle</Button>
          </div>
        </Panel>
      </div>

      <Drawer
        open={open}
        title={editor?.draft.id ? "Kısayolu düzenle" : "Kısayol ekle"}
        desc={editor ? `${editor.groupTitle} grubunda` : undefined}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Vazgeç</Button>
            <Button variant="primary" type="submit" onClick={() => { const f = document.getElementById("shortcut-form") as HTMLFormElement | null; f?.requestSubmit(); }}>
              {editor?.draft.id ? "Değişiklikleri kaydet" : "Kısayolu ekle"}
            </Button>
          </>
        }
      >
        {editor && <ItemForm key={editor.key} draft={editor.draft} onSave={(d) => void saveDraft(d, editor.groupId)} />}
      </Drawer>
    </>
  );
}

function ItemForm({ draft, onSave }: { draft: Draft; onSave: (d: Draft) => void }) {
  const [d, setD] = useState<Draft>(draft);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const valid = d.label.trim() !== "" && (d.kind === "project" ? (d.path ?? "").trim() !== "" : (d.host ?? "").trim() !== "");
  return (
    <form id="shortcut-form" className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (valid) onSave(d); }}>
      <Field label="Etiket" hint="Düğmenin üstündeki ad"><input value={d.label} onChange={(e) => set({ label: e.target.value })} autoFocus /></Field>
      <Field label="Alt yazı" hint="İsteğe bağlı ikinci satır"><input value={d.sublabel ?? ""} onChange={(e) => set({ sublabel: e.target.value || null })} /></Field>

      <Field label="Tür">
        <select value={d.kind} onChange={(e) => set({ kind: e.target.value === "ssh" ? "ssh" : "project" })}>
          <option value="project">Proje — VS Code’da açılır</option>
          <option value="ssh">Sunucu — SSH oturumu</option>
        </select>
      </Field>

      {d.kind === "project" ? (
        <Field label="Proje yolu" hint="Mac’teki mutlak klasör yolu">
          <input className="a-mono" value={d.path ?? ""} onChange={(e) => set({ path: e.target.value })} placeholder="/Users/ad/Projects/uygulama" />
        </Field>
      ) : (
        <>
          <Field label="Sunucu adresi"><input className="a-mono" value={d.host ?? ""} onChange={(e) => set({ host: e.target.value })} placeholder="sunucu.alan.com" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kullanıcı"><input value={d.user ?? ""} onChange={(e) => set({ user: e.target.value || null })} placeholder="root" /></Field>
            <Field label="Port"><input type="number" value={d.port ?? 22} onChange={(e) => set({ port: Number(e.target.value) || 22 })} /></Field>
          </div>
          <Field label="Nerede açılsın" hint="Terminal, SSH anahtarı kuruluysa hiçbir şey sormaz; Termius kimlik seçtirir">
            <select value={d.via === "terminal" ? "terminal" : "termius"} onChange={(e) => set({ via: e.target.value === "terminal" ? "terminal" : null })}>
              <option value="termius">Termius</option>
              <option value="terminal">Terminal</option>
            </select>
          </Field>
        </>
      )}

      <Field label="Geri bildirim" hint="Dokunulduğunda kiosk’ta beliren mesaj">
        <input value={d.feedback} onChange={(e) => set({ feedback: e.target.value })} placeholder={`${d.label || "…"} açıldı`} />
      </Field>
      <div className="pt-1"><Switch checked={d.enabled} onChange={(v) => set({ enabled: v })} label="Kiosk’ta göster" /></div>
    </form>
  );
}
