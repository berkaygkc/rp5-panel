"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Button, Card, ConfirmButton, Empty, Field, PageHeader, ReorderButtons, Toggle, api, move, useToast } from "@/components/admin/ui";

interface Rule { id: string; name: string; enabled: boolean; order: number; field: string; pattern: string; setSeverity: string | null; setKind: string | null; setScreen: string | null }
interface Screen { id: string; title: string }
type Draft = Omit<Rule, "id" | "order">;

const FIELDS = [["text", "Başlık + gövde"], ["title", "Başlık"], ["body", "Gövde"], ["kind", "Tür"], ["account", "Hesap"]] as const;
const SEVERITIES = [["", "(değiştirme)"], ["info", "Bilgi"], ["attention", "Dikkat"], ["urgent", "Acil"]] as const;
const EMPTY: Draft = { name: "", enabled: true, field: "text", pattern: "", setSeverity: "urgent", setKind: null, setScreen: null };
const SEV_TONE: Record<string, "neutral" | "warn" | "danger" | "accent"> = { info: "accent", attention: "warn", urgent: "danger" };

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [screens, setScreens] = useState<Screen[]>([]);
  const [adding, setAdding] = useState(false);
  const { toast, show } = useToast();

  const reload = useCallback(
    () => api<{ rules: Rule[] }>("/api/admin/rules").then((r) => {
      setRules(r.rules);
      setSaved(Object.fromEntries(r.rules.map((x) => [x.id, JSON.stringify(x)])));
    }),
    []
  );
  useEffect(() => {
    void reload().catch((e: Error) => show(e.message, "danger"));
    void api<{ screens: Screen[] }>("/api/admin/screens").then((r) => setScreens(r.screens)).catch(() => null);
  }, [reload, show]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); await reload(); show(ok); return true; } catch (e) { show((e as Error).message, "danger"); return false; }
  };
  const patch = (id: string, p: Partial<Rule>) => setRules((rs) => rs && rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const saveRule = (r: Rule) => run(() => api("/api/admin/rules", { method: "PUT", json: r }), "Kural kaydedildi");
  const toggle = (r: Rule, enabled: boolean) => { patch(r.id, { enabled }); void run(() => api("/api/admin/rules", { method: "PUT", json: { ...r, enabled } }), enabled ? "Kural açıldı" : "Kural kapatıldı"); };
  const moveRule = (i: number, dir: -1 | 1) => {
    if (!rules) return;
    const next = move(rules, i, i + dir);
    if (next === rules) return;
    setRules(next);
    void run(() => api("/api/admin/rules", { method: "PUT", json: { reorder: next.map((x) => x.id) } }), "Sıra güncellendi");
  };
  const remove = (id: string) => run(() => api("/api/admin/rules", { method: "DELETE", json: { id } }), "Kural silindi");
  const create = async (d: Draft) => {
    if (await run(() => api("/api/admin/rules", { method: "POST", json: d }), "Kural eklendi")) setAdding(false);
  };

  return (
    <>
      <PageHeader
        title="Bildirim kuralları"
        sub="Gelen her bildirim sırayla bu kurallardan geçer; eşleşen kural önemi, türü ve hedef ekranı değiştirir. İlk kural önce uygulanır."
        right={<Button variant="primary" onClick={() => setAdding(true)} disabled={adding}><Plus size={14} /> Kural ekle</Button>}
      />
      <div className="flex flex-col gap-3">
        {adding && (
          <Card title="Yeni kural">
            <RuleForm draft={EMPTY} screens={screens} onSave={(d) => void create(d)} onCancel={() => setAdding(false)} saveLabel="Kural ekle" />
          </Card>
        )}
        {rules?.map((r, i) => {
          const dirty = JSON.stringify(r) !== saved[r.id];
          return (
            <Card key={r.id} className={r.enabled ? "" : "opacity-60"}>
              <div className="mb-3 flex items-center gap-3">
                <Toggle checked={r.enabled} onChange={(v) => toggle(r, v)} />
                <span className="text-[12.5px]" style={{ color: "var(--admin-faint)" }}>{i + 1}</span>
                <input value={r.name} onChange={(e) => patch(r.id, { name: e.target.value })} style={{ width: 280, fontWeight: 600 }} aria-label="Kural adı" />
                {r.setSeverity && <Badge tone={SEV_TONE[r.setSeverity] ?? "neutral"}>{SEVERITIES.find((s) => s[0] === r.setSeverity)?.[1]}</Badge>}
                <div className="ml-auto flex items-center gap-2">
                  {dirty && <Button size="sm" variant="primary" onClick={() => void saveRule(r)}>Kaydet</Button>}
                  <ReorderButtons canUp={i > 0} canDown={i < rules.length - 1} onUp={() => moveRule(i, -1)} onDown={() => moveRule(i, 1)} />
                  <ConfirmButton onConfirm={() => void remove(r.id)} />
                </div>
              </div>
              <RuleFields value={r} screens={screens} onChange={(p) => patch(r.id, p)} />
            </Card>
          );
        })}
        {rules && rules.length === 0 && !adding && <Card><Empty>Kural yok; her bildirim geldiği gibi gösterilir. “Kural ekle” ile başlayın.</Empty></Card>}
      </div>
      <RuleTester screens={screens} />
      {toast}
    </>
  );
}

function RuleFields({ value, screens, onChange }: { value: Draft; screens: Screen[]; onChange: (p: Partial<Draft>) => void }) {
  return (
    <div className="grid grid-cols-[150px_1fr_150px_150px_160px] gap-3">
      <Field label="Alan">
        <select value={value.field} onChange={(e) => onChange({ field: e.target.value })}>
          {FIELDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="Desen" hint="düzenli ifade, büyük/küçük harf duyarsız">
        <input value={value.pattern} onChange={(e) => onChange({ pattern: e.target.value })} className="mono" placeholder="ör. (ci|build|deploy).*(fail|hata)" />
      </Field>
      <Field label="Önem">
        <select value={value.setSeverity ?? ""} onChange={(e) => onChange({ setSeverity: e.target.value || null })}>
          {SEVERITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="Tür" hint="boşsa değişmez">
        <input value={value.setKind ?? ""} onChange={(e) => onChange({ setKind: e.target.value || null })} placeholder="ci, mail, system…" />
      </Field>
      <Field label="Hedef ekran">
        <select value={value.setScreen ?? ""} onChange={(e) => onChange({ setScreen: e.target.value || null })}>
          <option value="">(değiştirme)</option>
          {screens.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
      </Field>
    </div>
  );
}

function RuleForm({ draft, screens, onSave, onCancel, saveLabel }: { draft: Draft; screens: Screen[]; onSave: (d: Draft) => void; onCancel: () => void; saveLabel: string }) {
  const [d, setD] = useState<Draft>(draft);
  const valid = d.name.trim() !== "" && d.pattern.trim() !== "";
  return (
    <div className="flex flex-col gap-3">
      <Field label="Ad"><input value={d.name} onChange={(e) => setD((x) => ({ ...x, name: e.target.value }))} autoFocus style={{ width: 320 }} placeholder="ör. CI hatası" /></Field>
      <RuleFields value={d} screens={screens} onChange={(p) => setD((x) => ({ ...x, ...p }))} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Vazgeç</Button>
        <Button variant="primary" disabled={!valid} onClick={() => onSave(d)}>{saveLabel}</Button>
      </div>
    </div>
  );
}

/** Örnek bildirimi kurallardan geçirip sonucu gösterir */
function RuleTester({ screens }: { screens: Screen[] }) {
  const [sample, setSample] = useState({ title: "CI: build failed on main", body: "", kind: "mail" });
  const [result, setResult] = useState<{ matched: string[]; result: { severity: string; kind: string; screen?: string } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const test = async () => {
    try { setResult(await api("/api/admin/rules/test", { method: "POST", json: sample })); setError(null); } catch (e) { setError((e as Error).message); }
  };
  return (
    <Card title="Kuralları dene" sub="Örnek bir bildirim yazın; hangi kuralların eşleştiğini ve sonucu görün. Hiçbir şey gönderilmez." className="mt-6">
      <div className="grid grid-cols-[1fr_1fr_140px_auto] items-end gap-3">
        <Field label="Başlık"><input value={sample.title} onChange={(e) => setSample((s) => ({ ...s, title: e.target.value }))} /></Field>
        <Field label="Gövde"><input value={sample.body} onChange={(e) => setSample((s) => ({ ...s, body: e.target.value }))} /></Field>
        <Field label="Tür"><input value={sample.kind} onChange={(e) => setSample((s) => ({ ...s, kind: e.target.value }))} /></Field>
        <Button onClick={() => void test()} className="mb-[1px]">Dene</Button>
      </div>
      {error && <p className="mt-3 text-[12.5px]" style={{ color: "var(--admin-danger)" }}>{error}</p>}
      {result && (
        <div className="mt-4 flex items-center gap-4 text-[13px]">
          <span>Eşleşen: {result.matched.length ? result.matched.join(", ") : "hiçbiri"}</span>
          <Badge tone={SEV_TONE[result.result.severity] ?? "neutral"}>{SEVERITIES.find((s) => s[0] === result.result.severity)?.[1] ?? result.result.severity}</Badge>
          <span style={{ color: "var(--admin-muted)" }}>tür {result.result.kind}</span>
          {result.result.screen && <span style={{ color: "var(--admin-muted)" }}>ekran {screens.find((s) => s.id === result.result.screen)?.title ?? result.result.screen}</span>}
        </div>
      )}
    </Card>
  );
}
