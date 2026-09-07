"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, api } from "@/components/admin/ui";

/** İlk kurulum: yönetici parolası belirlenir (yalnızca bir kez) */
export default function SetupPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void api<{ setupDone: boolean }>("/api/admin/setup").then((r) => { if (r.setupDone) router.replace("/admin/login"); });
  }, [router]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== again) { setError("parolalar eşleşmiyor"); return; }
    setBusy(true); setError(null);
    try {
      await api("/api/admin/setup", { method: "POST", json: { password } });
      router.replace("/admin");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-[420px] rounded-2xl p-7" style={{ background: "var(--admin-surface)", boxShadow: "var(--admin-shadow)", border: "1px solid var(--admin-line)" }}>
        <div className="mb-1 text-[18px] font-semibold">Yönetici parolası oluşturun</div>
        <p className="mb-6 text-[13px]" style={{ color: "var(--admin-muted)" }}>Bu panel tek yöneticilidir. Parola scrypt ile karılarak saklanır; ileride Güvenlik sayfasından değiştirebilirsiniz.</p>
        <div className="flex flex-col gap-4">
          <Field label="Parola" hint="en az 8 karakter">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="new-password" />
          </Field>
          <Field label="Parola (tekrar)">
            <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />
          </Field>
        </div>
        {error && <p className="mt-3 text-[12.5px]" style={{ color: "var(--admin-danger)" }}>{error}</p>}
        <Button type="submit" variant="primary" disabled={busy || password.length < 8} className="mt-6 w-full">Kurulumu tamamla</Button>
      </form>
    </div>
  );
}
