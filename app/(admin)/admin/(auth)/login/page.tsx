"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/admin/ui";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/login", { method: "POST", json: { password } });
      router.replace("/admin");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div style={{ width: 372 }}>
        <div className="mb-5 flex items-center gap-2.5">
          <span className="a-mark-badge" style={{ width: 30, height: 30, borderRadius: 8 }}>RP5</span>
          <span>
            <span className="block text-[14px] font-semibold">Yönetim konsolu</span>
            <span className="a-faint block text-[12px]">Panel, ajan ve veri kaynakları</span>
          </span>
        </div>
        <form onSubmit={submit} className="a-panel" style={{ padding: 20 }}>
          <label className="a-field">
            <span className="a-label">Yönetici parolası</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="current-password" />
          </label>
          {error && <p className="mt-3 text-[12.5px]" style={{ color: "var(--a-fault)" }}>{error}</p>}
          <button type="submit" className="a-btn mt-4 w-full" data-variant="primary" disabled={busy || !password}>
            {busy ? "Giriş yapılıyor" : "Giriş yap"}
          </button>
        </form>
        <p className="a-faint mt-4 text-center text-[12px]">Parolanızı unuttuysanız sunucuda veritabanındaki yönetici kaydını silip kurulumu yeniden çalıştırın.</p>
      </div>
    </div>
  );
}
