"use client";

import { useCallback, useState } from "react";
import { Button, Field, Panel, api, loadSettings, saveSettings, usePoll, useToast } from "@/components/admin/ui";

export default function SecurityPage() {
  const load = useCallback(() => loadSettings().then((s) => Boolean(s["pin.code"])), []);
  const { data: pinSet, refresh } = usePoll(load);
  const [pin, setPin] = useState({ next: "", again: "" });
  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const pinValid = /^\d{4,8}$/.test(pin.next) && pin.next === pin.again;
  const pwValid = pw.current.length > 0 && pw.next.length >= 8 && pw.next === pw.again;

  const savePin = async () => {
    setBusy("pin");
    try { await saveSettings({ "pin.code": pin.next }); setPin({ next: "", again: "" }); refresh(); toast.ok("Kiosk PIN’i güncellendi"); }
    catch (e) { toast.fail((e as Error).message); }
    finally { setBusy(null); }
  };
  const savePw = async () => {
    setBusy("pw");
    try { await api("/api/admin/settings", { method: "PATCH", json: { current: pw.current, next: pw.next } }); setPw({ current: "", next: "", again: "" }); toast.ok("Yönetici parolası değiştirildi"); }
    catch (e) { toast.fail((e as Error).message); }
    finally { setBusy(null); }
  };

  return (
    <>
      <header className="a-head">
        <div>
          <h1 className="a-title">Güvenlik</h1>
          <p className="a-sub">
            Kiosk’un kilit PIN’i ve bu konsolun yönetici parolası. İkisi de yalnızca sunucuda doğrulanır; PIN kiosk’un JavaScript’ine hiçbir zaman gönderilmez.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <Panel
          title="Kiosk PIN’i"
          desc={pinSet === null ? " " : pinSet ? "Tanımlı. Kilit ekranında bu PIN sorulur." : "Tanımlı değil."}
          footer={
            <>
              <span>4–8 rakam. Dakikada en fazla 8 deneme kabul edilir.</span>
              <Button variant="primary" disabled={!pinValid || busy === "pin"} onClick={() => void savePin()}>PIN’i güncelle</Button>
            </>
          }
        >
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (pinValid) void savePin(); }}>
            <Field label="Yeni PIN">
              <input type="password" inputMode="numeric" autoComplete="off" value={pin.next} onChange={(e) => setPin({ ...pin, next: e.target.value.replace(/\D/g, "").slice(0, 8) })} />
            </Field>
            <Field label="Yeni PIN (tekrar)" hint={pin.next && pin.again && pin.next !== pin.again ? "PIN’ler eşleşmiyor" : undefined}>
              <input type="password" inputMode="numeric" autoComplete="off" value={pin.again} onChange={(e) => setPin({ ...pin, again: e.target.value.replace(/\D/g, "").slice(0, 8) })} />
            </Field>
          </form>
        </Panel>

        <Panel
          title="Yönetici parolası"
          desc="Bu konsola girişte kullanılır. scrypt ile karılarak saklanır."
          footer={
            <>
              <span>En az 8 karakter. Oturum 7 gün geçerlidir.</span>
              <Button variant="primary" disabled={!pwValid || busy === "pw"} onClick={() => void savePw()}>Parolayı değiştir</Button>
            </>
          }
        >
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (pwValid) void savePw(); }}>
            <Field label="Mevcut parola"><input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
            <Field label="Yeni parola"><input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
            <Field label="Yeni parola (tekrar)" hint={pw.next && pw.again && pw.next !== pw.again ? "Parolalar eşleşmiyor" : undefined}>
              <input type="password" autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} />
            </Field>
          </form>
        </Panel>
      </div>
    </>
  );
}
