"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, api } from "@/components/admin/ui";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api("/api/admin/login", { method: "POST", json: { password } });
      router.replace("/admin");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-[380px] rounded-2xl p-7" style={{ background: "var(--admin-surface)", boxShadow: "var(--admin-shadow)", border: "1px solid var(--admin-line)" }}>
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl text-[13px] font-bold text-white" style={{ background: "var(--admin-accent)" }}>RP5</span>
          <div>
            <div className="text-[16px] font-semibold">Yönetim paneli</div>
            <div className="text-[12.5px]" style={{ color: "var(--admin-muted)" }}>Devam etmek için parolanızı girin</div>
          </div>
        </div>
        <Field label="Parola">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="current-password" />
        </Field>
        {error && <p className="mt-2 text-[12.5px]" style={{ color: "var(--admin-danger)" }}>{error}</p>}
        <Button type="submit" variant="primary" disabled={busy || !password} className="mt-5 w-full">Giriş yap</Button>
      </form>
    </div>
  );
}
