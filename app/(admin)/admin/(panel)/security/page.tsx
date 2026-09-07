"use client";

import { useEffect, useState } from "react";
import { Button, Card, Field, PageHeader, api, loadSettings, saveSettings, useToast } from "@/components/admin/ui";

export default function SecurityPage() {
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  useEffect(() => {
    void loadSettings().then((s) => setPinSet(Boolean(s["pin.code"]))).catch((e: Error) => show(e.message, "danger"));
  }, [show]);

  const pinValid = /^\d{4,8}$/.test(pin) && pin === pin2;
  const pwValid = pw.current.length > 0 && pw.next.length >= 8 && pw.next === pw.again;

  const savePin = async () => {
    setBusy(true);
    try { await saveSettings({ "pin.code": pin }); setPin(""); setPin2(""); setPinSet(true); show("Kiosk PIN’i güncellendi"); } catch (e) { show((e as Error).message, "danger"); } finally { setBusy(false); }
  };
  const savePw = async () => {
    setBusy(true);
    try { await api("/api/admin/settings", { method: "PATCH", json: { current: pw.current, next: pw.next } }); setPw({ current: "", next: "", again: "" }); show("Yönetici parolası değiştirildi"); } catch (e) { show((e as Error).message, "danger"); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Güvenlik" sub="Kiosk kilit PIN’i ve bu panelin yönetici parolası. İkisi de yalnızca sunucuda doğrulanır; kiosk’a hiçbir zaman gönderilmez." />
      <div className="grid grid-cols-2 gap-5">
        <Card title="Kiosk PIN’i" sub={pinSet === null ? "" : pinSet ? "PIN tanımlı" : "PIN tanımlı değil"}>
          <div className="flex flex-col gap-3">
            <Field label="Yeni PIN" hint="4–8 rakam"><input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} /></Field>
            <Field label="Yeni PIN (tekrar)"><input type="password" inputMode="numeric" autoComplete="off" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 8))} /></Field>
            {pin && pin2 && pin !== pin2 && <p className="text-[12.5px]" style={{ color: "var(--admin-danger)" }}>PIN’ler eşleşmiyor</p>}
            <div className="flex justify-end"><Button variant="primary" disabled={!pinValid || busy} onClick={() => void savePin()}>PIN’i güncelle</Button></div>
          </div>
        </Card>
        <Card title="Yönetici parolası" sub="Bu panele girişte kullanılır">
          <div className="flex flex-col gap-3">
            <Field label="Mevcut parola"><input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
            <Field label="Yeni parola" hint="en az 8 karakter"><input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
            <Field label="Yeni parola (tekrar)"><input type="password" autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} /></Field>
            {pw.next && pw.again && pw.next !== pw.again && <p className="text-[12.5px]" style={{ color: "var(--admin-danger)" }}>Parolalar eşleşmiyor</p>}
            <div className="flex justify-end"><Button variant="primary" disabled={!pwValid || busy} onClick={() => void savePw()}>Parolayı değiştir</Button></div>
          </div>
        </Card>
      </div>
      {toast}
    </>
  );
}
