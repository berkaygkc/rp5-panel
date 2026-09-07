"use client";

import { useCallback, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  Button, ConfirmButton, Drawer, Empty, Field, Panel, Reorder, Skeleton, Switch, Tag,
  api, move, usePoll, useToast,
} from "@/components/admin/ui";

interface Rule { id: string; name: string; enabled: boolean; order: number; field: string; pattern: string; setSeverity: string | null; setKind: string | null; setScreen: string | null }
interface Screen { id: string; title: string }
type Draft = Omit<Rule, "id" | "order"> & { id?: string };

const FIELDS: Array<[string, string]> = [["text", "Başlık + gövde"], ["title", "Başlık"], ["body", "Gövde"], ["kind", "Tür"], ["account", "Hesap"]];
const SEVERITIES: Array<[string, string]> = [["", "değiştirme"], ["info", "Bilgi"], ["attention", "Dikkat"], ["urgent", "Acil"]];
const TONE: Record<string, "ok" | "warn" | "fault"> = { info: "ok", attention: "warn", urgent: "fault" };
const EMPTY: Draft = { name: "", enabled: true, field: "text", pattern: "", setSeverity: "urgent", setKind: null, setScreen: null };

export default function RulesPage() {
  const loadRules = useCallback(() => api<{ rules: Rule[] }>("/api/admin/rules").then((r) => r.rules), []);
  const loadScreens = useCallback(() => api<{ screens: Screen[] }>("/api/admin/screens").then((r) => r.screens), []);
  const { data, loading, refresh } = usePoll(loadRules);
  const screens = usePoll(loadScreens);
  const [local, setLocal] = useState<Rule[] | null>(null);
  const [editor, setEditor] = useState<{ key: string; draft: Draft } | null>(null);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);
  const toast = useToast();

  const rules = local ?? data ?? [];
  const run = useCallback(
    async (fn: () => Promise<unknown>, ok: string) => {
      try { await fn(); setLocal(null); refresh(); toast.ok(ok); return true; }
      catch (e) { setLocal(null); refresh(); toast.fail((e as Error).message); return false; }
    },
    [refresh, toast]
  );

  const moveRule = (i: number, dir: -1 | 1) => {
    const next = move(rules, i, i + dir);
    if (next === rules) return;
    setLocal(next);
    void run(() => api("/api/admin/rules", { method: "PUT", json: { reorder: next.map((x) => x.id) } }), "Kural sırası güncellendi");
  };
  const toggle = (r: Rule, enabled: boolean) => {
    setLocal(rules.map((x) => (x.id === r.id ? { ...x, enabled } : x)));
    void run(() => api("/api/admin/rules", { method: "PUT", json: { ...r, enabled } }), enabled ? "Kural açıldı" : "Kural kapatıldı");
  };
  const save = async (d: Draft) => {
    if (await run(() => api("/api/admin/rules", { method: d.id ? "PUT" : "POST", json: d }), d.id ? "Kural kaydedildi" : "Kural eklendi")) setOpen(false);
  };
  const edit = (r?: Rule) => {
    seq.current += 1;
    setEditor({ key: `${r?.id ?? "yeni"}:${seq.current}`, draft: r ? { ...r } : EMPTY });
    setOpen(true);
  };

  return (
    <>
      <header className="a-head">
        <div>
          <h1 className="a-title">Bildirim kuralları</h1>
          <p className="a-sub">
            Panele düşen her bildirim bu kurallardan sırayla geçer. Eşleşen kural bildirimin önemini, türünü ve dokunulduğunda açılacak ekranı değiştirir.
          </p>
        </div>
        <Button variant="primary" onClick={() => edit()}><Plus size={14} /> Kural ekle</Button>
      </header>

      <Panel flush>
        {loading ? (
          <div className="flex flex-col gap-3 p-4"><Skeleton /><Skeleton /><Skeleton /></div>
        ) : rules.length === 0 ? (
          <Empty>Kural yok; her bildirim geldiği gibi gösterilir.</Empty>
        ) : (
          <table className="a-tbl">
            <thead>
              <tr>
                <th style={{ width: 52 }}>Sıra</th>
                <th style={{ width: 66 }}>Açık</th>
                <th>Kural</th>
                <th style={{ width: 130 }}>Alan</th>
                <th>Desen</th>
                <th style={{ width: 96 }}>Önem</th>
                <th style={{ width: 150 }} />
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={r.id} data-off={!r.enabled}>
                  <td className="a-num a-faint">{String(i + 1).padStart(2, "0")}</td>
                  <td><Switch checked={r.enabled} onChange={(v) => toggle(r, v)} label={undefined} /></td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{r.name}</div>
                    <div className="a-muted text-[12px]">
                      {r.setKind ? `tür → ${r.setKind}` : "türü değiştirmez"}
                      {r.setScreen ? ` · ekran → ${screens.data?.find((s) => s.id === r.setScreen)?.title ?? r.setScreen}` : ""}
                    </div>
                  </td>
                  <td className="a-muted">{FIELDS.find(([v]) => v === r.field)?.[1] ?? r.field}</td>
                  <td><code>{r.pattern}</code></td>
                  <td>{r.setSeverity ? <Tag tone={TONE[r.setSeverity]}>{SEVERITIES.find(([v]) => v === r.setSeverity)?.[1]}</Tag> : <span className="a-faint">—</span>}</td>
                  <td>
                    <div className="a-tbl-actions">
                      <Reorder canUp={i > 0} canDown={i < rules.length - 1} onUp={() => moveRule(i, -1)} onDown={() => moveRule(i, 1)} />
                      <Button size="sm" variant="ghost" onClick={() => edit(r)}>Düzenle</Button>
                      <ConfirmButton onConfirm={() => void run(() => api("/api/admin/rules", { method: "DELETE", json: { id: r.id } }), "Kural silindi")} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Tester screens={screens.data ?? []} />

      <Drawer
        open={open}
        title={editor?.draft.id ? "Kuralı düzenle" : "Kural ekle"}
        desc="Desen, büyük/küçük harf duyarsız bir düzenli ifadedir."
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Vazgeç</Button>
            <Button variant="primary" onClick={() => { const f = document.getElementById("rule-form") as HTMLFormElement | null; f?.requestSubmit(); }}>
              {editor?.draft.id ? "Değişiklikleri kaydet" : "Kuralı ekle"}
            </Button>
          </>
        }
      >
        {editor && <RuleForm key={editor.key} draft={editor.draft} screens={screens.data ?? []} onSave={(d) => void save(d)} />}
      </Drawer>
    </>
  );
}

function RuleForm({ draft, screens, onSave }: { draft: Draft; screens: Screen[]; onSave: (d: Draft) => void }) {
  const [d, setD] = useState<Draft>(draft);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const bad = (() => { try { new RegExp(d.pattern, "i"); return null; } catch { return "Bu düzenli ifade geçersiz"; } })();
  const valid = d.name.trim() !== "" && d.pattern.trim() !== "" && !bad;
  return (
    <form id="rule-form" className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (valid) onSave(d); }}>
      <Field label="Ad" hint="Kural listesinde göreceğiniz isim"><input value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="CI hatası" autoFocus /></Field>
      <Field label="Hangi alana bakılsın">
        <select value={d.field} onChange={(e) => set({ field: e.target.value })}>
          {FIELDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="Desen" hint={bad ?? "Düzenli ifade, büyük/küçük harf duyarsız"}>
        <input className="a-mono" value={d.pattern} onChange={(e) => set({ pattern: e.target.value })} placeholder="(ci|build|deploy).*(fail|hata)" style={bad ? { borderColor: "var(--a-fault)" } : undefined} />
      </Field>
      <Field label="Önemi şuna çevir">
        <select value={d.setSeverity ?? ""} onChange={(e) => set({ setSeverity: e.target.value || null })}>
          {SEVERITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="Türü şuna çevir" hint="Boş bırakılırsa dokunulmaz. Kiosk ikonu bu türden gelir."><input value={d.setKind ?? ""} onChange={(e) => set({ setKind: e.target.value || null })} placeholder="ci, mail, chat, server" /></Field>
      <Field label="Dokununca açılacak ekran">
        <select value={d.setScreen ?? ""} onChange={(e) => set({ setScreen: e.target.value || null })}>
          <option value="">değiştirme</option>
          {screens.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
      </Field>
      <div className="pt-1"><Switch checked={d.enabled} onChange={(v) => set({ enabled: v })} label="Kural etkin" /></div>
    </form>
  );
}

/** Örnek bir bildirimi kurallardan geçirir; hiçbir şey gönderilmez */
function Tester({ screens }: { screens: Screen[] }) {
  const [sample, setSample] = useState({ title: "CI: build failed on main", body: "", kind: "mail" });
  const [result, setResult] = useState<{ matched: string[]; result: { severity: string; kind: string; screen?: string } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const test = async () => {
    try { setResult(await api("/api/admin/rules/test", { method: "POST", json: sample })); setError(null); }
    catch (e) { setError((e as Error).message); setResult(null); }
  };
  return (
    <Panel
      className="mt-4"
      title="Kuralları dene"
      desc="Örnek bir bildirim yazın; hangi kuralların eşleştiğini ve sonucun ne olacağını görün. Kiosk’a hiçbir şey gönderilmez."
      footer={
        result ? (
          <>
            <span>Eşleşen kural: {result.matched.length ? result.matched.join(", ") : "hiçbiri"}</span>
            <span className="flex items-center gap-3">
              <Tag tone={TONE[result.result.severity]}>{SEVERITIES.find(([v]) => v === result.result.severity)?.[1] ?? result.result.severity}</Tag>
              <span>tür {result.result.kind}</span>
              {result.result.screen && <span>ekran {screens.find((s) => s.id === result.result.screen)?.title ?? result.result.screen}</span>}
            </span>
          </>
        ) : error ? (
          <span style={{ color: "var(--a-fault)" }}>{error}</span>
        ) : undefined
      }
    >
      <div className="grid grid-cols-[1fr_1fr_150px_auto] items-end gap-3">
        <Field label="Başlık"><input value={sample.title} onChange={(e) => setSample({ ...sample, title: e.target.value })} /></Field>
        <Field label="Gövde"><input value={sample.body} onChange={(e) => setSample({ ...sample, body: e.target.value })} /></Field>
        <Field label="Tür"><input value={sample.kind} onChange={(e) => setSample({ ...sample, kind: e.target.value })} /></Field>
        <Button onClick={() => void test()}>Kurallardan geçir</Button>
      </div>
    </Panel>
  );
}
